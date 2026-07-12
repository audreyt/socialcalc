#!/usr/bin/env bun
/**
 * Mechanical in-place conversion: js/<name>.js → js/<name>.ts
 *
 * Constraints:
 * - Keep SocialCalc global-script shape (no ES modules)
 * - Convert immediately-preceding JSDoc @param/@returns into TS types
 * - Map JSDoc `any` → `unknown` (no `: any`)
 * - Do not touch module-wrapper-*.js
 * - Do not rewrite public *.d.ts
 *
 * Usage: bun scripts/js-to-ts-global.mjs [file.js ...]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";

const jsDir = join(import.meta.dir, "..", "js");
const SKIP = new Set(["module-wrapper-top.js", "module-wrapper-bottom.js"]);

function mapJsDocType(jsType) {
  let t = jsType.trim().replace(/\s+/g, " ");
  t = t.replace(/Object\.<([^,]+),\s*([^>]+)>/g, "{ [key: string]: $2 }");
  t = t.replace(/Array\.<([^>]+)>/g, "$1[]");
  // Nested object types already start with `{`
  return t
    .split(/\s*\|\s*/)
    .map((part) => mapOne(part.trim()))
    .join(" | ");
}

function mapOne(t) {
  if (!t) return "unknown";
  if (t === "any" || t === "*" || t === "Object" || t === "object") return "unknown";
  if (t === "Boolean") return "boolean";
  if (t === "Number") return "number";
  if (t === "String") return "string";
  if (t === "function") return "(...args: unknown[]) => unknown";
  if (
    t === "void" ||
    t === "undefined" ||
    t === "null" ||
    t === "boolean" ||
    t === "number" ||
    t === "string"
  ) {
    return t;
  }
  // any[] / Array
  t = t.replace(/\bany\b/g, "unknown");
  return t;
}

/** Extract balanced `{...}` starting at index of `{`. */
function readBalanced(source, openIdx) {
  if (source[openIdx] !== "{") return null;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(openIdx + 1, i);
    }
  }
  return null;
}

/**
 * Parse JSDoc block text (without / ** * /).
 * @returns {{ params: Map<string,string>, returns: string | null }}
 */
function parseJsDoc(jsdoc) {
  const params = new Map();
  let returns = null;
  const lines = jsdoc.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const paramIdx = line.indexOf("@param");
    if (paramIdx >= 0) {
      const after = line.slice(paramIdx + 6).trimStart();
      if (after.startsWith("{")) {
        // find `{` position in original line
        const braceAt = line.indexOf("{", paramIdx);
        const inner = readBalanced(line, braceAt);
        if (inner == null) {
          // multi-line type — rare; skip typing this param
          continue;
        }
        const rest = line.slice(braceAt + inner.length + 2).trim();
        const nameMatch = rest.match(/^\[?([.\w]+)\]?/);
        if (!nameMatch) continue;
        const name = nameMatch[1].includes(".") ? nameMatch[1].split(".").pop() : nameMatch[1];
        params.set(name, mapJsDocType(inner));
      }
      continue;
    }
    const retIdx = line.search(/@returns?\b/);
    if (retIdx >= 0) {
      const braceAt = line.indexOf("{", retIdx);
      if (braceAt >= 0) {
        const inner = readBalanced(line, braceAt);
        if (inner != null) returns = mapJsDocType(inner);
      }
    }
  }
  return { params, returns };
}

function typeParams(rawParams, paramTypes) {
  if (!rawParams.trim()) return "";
  return rawParams
    .split(",")
    .map((part) => {
      const p = part.trim();
      if (!p) return p;
      if (p.includes(":")) return p;
      const def = p.match(/^(\w+)\s*=\s*(.*)$/);
      if (def) {
        const ty = paramTypes.get(def[1]) || "unknown";
        return `${def[1]}: ${ty} = ${def[2]}`;
      }
      const rest = p.match(/^\.\.\.(\w+)$/);
      if (rest) {
        const ty = paramTypes.get(rest[1]) || "unknown[]";
        return `...${rest[1]}: ${ty}`;
      }
      const name = p.replace(/\?$/, "");
      const ty = paramTypes.get(name) || "unknown";
      return `${name}: ${ty}`;
    })
    .join(", ");
}

function convertHeader(text, filename) {
  // Drop @ts-check banners; keep license block comments.
  text = text.replace(
    /^\/\/ Opt-in TypeScript checking[\s\S]*?\/\/ @ts-check\n/m,
    `// In-place TypeScript conversion of ${filename} (SocialCalc global script).\n// Ambient API types live in the matching .d.ts (referenced by dist/SocialCalc.d.ts).\n// Build strips types via Bun.Transpiler before UMD concat — no runtime tax.\n`,
  );
  text = text.replace(
    /^\/\/ @ts-check\n(?:\/\/[^\n]*\n)*/m,
    `// In-place TypeScript conversion of ${filename} (SocialCalc global script).\n// Ambient API types live in the matching .d.ts (referenced by dist/SocialCalc.d.ts).\n// Build strips types via Bun.Transpiler before UMD concat — no runtime tax.\n`,
  );
  return text;
}

function convertSocialCalcRoot(text) {
  // Classic constants preamble:
  // /** @type {any} */
  // // @ts-ignore ...
  // var SocialCalc;
  // if (!SocialCalc) SocialCalc = {};
  text = text.replace(
    /(?:\/\*\*[\s\S]*?\*\/\s*)?(?:\/\/[^\n]*@ts-ignore[^\n]*\n)?var SocialCalc;\s*\nif\s*\(\s*!SocialCalc\s*\)\s*SocialCalc\s*=\s*\{\s*\};?/,
    `// Runtime root object. Ambient namespace is types-only; UMD factory provides the bag.
var SocialCalc = (typeof globalThis !== "undefined" && (globalThis as unknown as { SocialCalc?: typeof SocialCalc }).SocialCalc)
    ? (globalThis as unknown as { SocialCalc: typeof SocialCalc }).SocialCalc
    : ({} as typeof SocialCalc);`,
  );

  // Remaining guards — no reassignment of the namespace symbol.
  text = text.replace(
    /if\s*\(\s*!SocialCalc\s*\)\s*SocialCalc\s*=\s*\{\s*\};?/g,
    `// SocialCalc root provided by UMD / prior concat scripts.`,
  );
  return text;
}

function convertJsDocFunctions(text) {
  // Match /** ... */ followed by optional assignment and function.
  const re =
    /\/\*\*([\s\S]*?)\*\/(\s*)((?:(?:var|let|const)\s+)?(?:[\w$.]+(?:\s*\.\s*[\w$]+)*)\s*=\s*)?function(\s+[\w$]+)?\s*\(([^)]*)\)(\s*\{)/g;

  return text.replace(re, (full, jsdoc, ws, assignPrefix, namePart, params, brace) => {
    if (!jsdoc.includes("@param") && !jsdoc.includes("@return")) {
      return full;
    }
    const { params: pmap, returns } = parseJsDoc(jsdoc);
    if (pmap.size === 0 && !returns) return full;

    let typed;
    try {
      typed = typeParams(params, pmap);
    } catch {
      return full;
    }
    // Sanity: typed params must not introduce unbalanced braces/parens
    const opens = (typed.match(/[({[]/g) || []).length;
    const closes = (typed.match(/[)}\]]/g) || []).length;
    if (opens !== closes) return full;

    const ret = returns ? `: ${returns}` : "";
    const name = namePart || "";
    const assign = assignPrefix || "";
    // Keep JSDoc text as a block comment without type tags? Prefer drop — types moved to signature.
    // Preserve non-type description lines as a short comment if present.
    const desc = jsdoc
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter((l) => l && !l.startsWith("@") && l !== "/")
      .join(" ");
    const keep = desc ? `/** ${desc} */\n` : "";
    return `${keep}${assign}function${name}(${typed})${ret}${brace}`;
  });
}

function convertSource(source, filename) {
  let text = source;
  text = convertHeader(text, filename);
  text = convertSocialCalcRoot(text);
  text = convertJsDocFunctions(text);
  return text;
}

function targetsFromArgv() {
  const args = process.argv.slice(2);
  if (args.length) return args.map((a) => basename(a));
  return readdirSync(jsDir).filter(
    (f) => f.endsWith(".js") && !SKIP.has(f) && !existsSync(join(jsDir, f.replace(/\.js$/, ".ts"))),
  );
}

const targets = targetsFromArgv();
if (!targets.length) {
  console.log("nothing to convert");
  process.exit(0);
}

for (const file of targets) {
  if (SKIP.has(file)) continue;
  const srcPath = join(jsDir, file);
  if (!existsSync(srcPath)) {
    console.error("missing", srcPath);
    process.exit(1);
  }
  const dest = join(jsDir, file.replace(/\.js$/, ".ts"));
  const source = readFileSync(srcPath, "utf8");
  const converted = convertSource(source, file);
  writeFileSync(dest, converted);
  unlinkSync(srcPath);
  console.log(`converted ${file} -> ${basename(dest)}`);
}
console.log("done", targets.length);
