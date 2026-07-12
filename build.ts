// Vite+ plugin for SocialCalc's ordered global-script build.
// Concatenates SocialCalc sources (order matters — files share the
// factory-local `SocialCalc` bag) and emits the package artifacts to ./dist.
//
// UMD open/close wrappers live here as strings (not js/*.js files): the
// halves are intentionally not standalone-parseable, so they cannot be
// individual Vite module entries.
//
// Core entries may be `.js` or `.ts`. A listed `.js` path prefers a sibling
// `.ts` when present. Vite+'s Oxc transformer strips TypeScript before concat
// so dist/SocialCalc.js stays a browser-ready UMD bundle with no runtime tax.

import type { MinifyResult, Plugin } from "vite-plus";
import { minify, transformWithOxc } from "vite-plus";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const jsDir = join(root, "js");
const cssDir = join(root, "css");

export const socialCalcBuildInput = "virtual:socialcalc-build";
const resolvedBuildInput = `\0${socialCalcBuildInput}`;

// UMD open (formerly js/module-wrapper-top.js). Creates factory-local bag.
const umdWrapperTop = `// Opening half of a UMD IIFE. Inlined in build.ts — not a standalone module.
//
// Taken from https://github.com/umdjs/umd/blob/master/templates/returnExports.js
// (c) by The UMD contributors
// MIT License: https://github.com/umdjs/umd/blob/master/LICENSE.md
(function (root, factory) {
    "use strict";
    // Evaluate once and fan out to both deliveries:
    //   * browser / globalThis (root.SocialCalc) — always set
    //   * CommonJS / Node (module.exports) — when present
    // AMD was dropped from this wrapper: the npm package is its
    // canonical entry point today, and AMD loaders (RequireJS, Dojo
    // legacy) have been unmaintained for years. Anyone still wiring
    // AMD can wrap the CommonJS module themselves.
    var exported = factory.call(root, root);
    root.SocialCalc = exported;
    if (typeof module === 'object' && module && module.exports) {
        module.exports = exported;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (window) {
"use strict";
// Factory-local bag. Formerly created in socialcalcconstants as
// \`var SocialCalc; if (!SocialCalc) SocialCalc = {}\`. Hoisted here so
// converted TypeScript sources can typecheck against the ambient
// \`declare namespace SocialCalc\` without a runtime \`var SocialCalc\`
// that would shadow/collapse the namespace during \`tsc\`.
var SocialCalc = {};
`;

// UMD close (formerly js/module-wrapper-bottom.js).
const umdWrapperBottom = `// Closing half of a UMD IIFE. Inlined in build.ts — not a standalone module.

// Leading \`;\` defuses an ASI trap: the preceding file may end with a
// function expression and no trailing semicolon, so a bare \`(\` would be
// parsed as a call applied to that function expression.
;(function () {
    // DOM-free safety net. Full implementations live in
    // socialcalctableeditor.ts / socialcalcspreadsheetcontrol.ts and touch
    // \`document\`. Each wrapper checks at call time so tests that install a
    // DOM shim *after* bundle load still reach the real methods — the old
    // load-time replacement permanently stomped them once the bundle had
    // been loaded in a non-DOM context.
    var fallbacks = {
        GetEditorCellElement: function () {},
        ReplaceCell: function () {},
        EditorRenderSheet: function () {},
        SpreadsheetControlSortSave: function () { return ""; },
        SpreadsheetControlStatuslineCallback: function () {},
        DoPositionCalculations: function (editor) {
            SocialCalc.EditorSheetStatusCallback(
                null, "doneposcalc", null, editor
            );
        }
    };
    for (var name in fallbacks) {
        if (!Object.prototype.hasOwnProperty.call(fallbacks, name)) continue;
        (function (name, fallback) {
            var real = SocialCalc[name];
            SocialCalc[name] = function () {
                var fn = typeof document !== 'undefined' && real ? real : fallback;
                return fn.apply(this, arguments);
            };
        }(name, fallbacks[name]));
    }
}());

    // Just return a value to define the module export.
    return SocialCalc;
}));
`;

// Core sources only (no UMD halves). Prefer sibling `.ts` when listed as `.js`.
const coreFiles = [
  "socialcalcconstants.js",
  "socialcalc-3.js",
  "socialcalctableeditor.js",
  "formatnumber2.js",
  "formula1.js",
  "formula-parse.ts",
  "formula-operand.ts",
  "formula-ref.ts",
  "socialcalcpopup.js",
  "socialcalcspreadsheetcontrol.js",
  "socialcalcviewer.js",
];

const cssFiles = ["socialcalc.css"];

function splitLeadingCommentPreamble(source: string) {
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (source.startsWith("//", i)) {
      const eol = source.indexOf("\n", i);
      i = eol === -1 ? n : eol + 1;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    break;
  }
  return {
    body: source.slice(i),
    preamble: i === 0 ? "" : `${source.slice(0, i).replace(/\s+$/u, "")}\n\n`,
  };
}

function assertMinified(filename: string, result: MinifyResult) {
  if (result.errors.length > 0) {
    throw new Error(
      `Failed to process ${filename}:\n${result.errors.map((error) => error.message).join("\n")}`,
    );
  }
  return result.code;
}

function resolveJsSource(name: string): string {
  if (name.endsWith(".js")) {
    const tsName = `${name.slice(0, -3)}.ts`;
    if (existsSync(join(jsDir, tsName))) {
      return tsName;
    }
  }
  if (name.endsWith(".ts") && !existsSync(join(jsDir, name))) {
    const jsName = `${name.slice(0, -3)}.js`;
    if (existsSync(join(jsDir, jsName))) {
      return jsName;
    }
  }
  return name;
}

async function readJsSource(name: string): Promise<string> {
  const resolved = resolveJsSource(name);
  const sourcePath = join(jsDir, resolved);
  const text = await readFile(sourcePath, "utf8");
  if (!resolved.endsWith(".ts")) {
    return text;
  }

  const { body, preamble } = splitLeadingCommentPreamble(text);
  const transformed = await transformWithOxc(body, sourcePath, {
    target: "esnext",
  });
  for (const warning of transformed.warnings) {
    console.warn(warning);
  }
  const normalized = await minify(sourcePath, transformed.code, {
    codegen: {
      legalComments: "none",
      removeWhitespace: false,
    },
    compress: false,
    mangle: false,
  });
  return preamble + assertMinified(sourcePath, normalized);
}

async function concatCore(files: readonly string[]): Promise<string> {
  const parts = await Promise.all(files.map((name) => readJsSource(name)));
  return parts.join("\n");
}

async function concatCss(dir: string, files: readonly string[]): Promise<string> {
  const parts = await Promise.all(files.map((name) => readFile(join(dir, name), "utf8")));
  return parts.join("\n");
}

export function socialCalcBuildPlugin(): Plugin {
  let emitMinified = false;

  return {
    name: "socialcalc-build",
    apply: "build",
    configResolved(config) {
      emitMinified = config.build.minify !== false;
    },
    resolveId(source) {
      return source === socialCalcBuildInput ? resolvedBuildInput : null;
    },
    load(id) {
      return id === resolvedBuildInput ? "globalThis;" : null;
    },
    buildStart() {
      for (const name of coreFiles) {
        this.addWatchFile(join(jsDir, resolveJsSource(name)));
      }
      for (const name of cssFiles) {
        this.addWatchFile(join(cssDir, name));
      }
    },
    async generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        delete bundle[fileName];
      }

      const core = await concatCore(coreFiles);
      const js = `${umdWrapperTop}\n${core}\n${umdWrapperBottom}`;
      this.emitFile({
        type: "asset",
        fileName: "SocialCalc.js",
        source: js,
      });

      if (emitMinified) {
        const result = await minify("SocialCalc.min.js", js);
        this.emitFile({
          type: "asset",
          fileName: "SocialCalc.min.js",
          source: assertMinified("SocialCalc.min.js", result),
        });
      }

      this.emitFile({
        type: "asset",
        fileName: "socialcalc.css",
        source: await concatCss(cssDir, cssFiles),
      });
    },
  };
}
