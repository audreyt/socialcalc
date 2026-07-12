#!/usr/bin/env node
// Guards test *credibility*, not test source text: scans every tracked
// `test/**/*.test.ts` file for two anti-patterns that let a test pass while
// asserting nothing about the code under test:
//
//   1. An exact tautology: `expect(true).toBe(true)`.
//   2. A `catch` block with no executable statements in its body — i.e. it
//      silently discards whatever the `try` block raised. This is allowed
//      ONLY when the block is annotated as a deliberate, code-free cleanup
//      catch: the body must contain nothing but comments, and those
//      comments must carry a real explanation (see MIN_ANNOTATION_CHARS
//      below), not a placeholder like `// TODO` or `// noop`.
//
// This is a standalone script (`node scripts/check-test-credibility.mjs`),
// not a Vitest test: behavior tests must assert observable behavior, not
// incidental source text of sibling test files.
//
// Usage: node scripts/check-test-credibility.mjs [--allow-known-debt]
//   --allow-known-debt  Exit 0 even if violations are found, but still
//                        print the full report. Intended only for this
//                        repo's pre-merge multi-branch remediation window,
//                        where files owned by a sibling branch may still
//                        contain unremediated catches; it does NOT
//                        allowlist specific files or catches, it only
//                        changes the exit code.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

// Minimum non-whitespace length (after stripping comment markers) a
// cleanup-only catch's explanation must have to be considered a real
// annotation rather than a placeholder.
const MIN_ANNOTATION_CHARS = 12;

const TAUTOLOGY_RE = /\bexpect\(\s*true\s*\)\.toBe\(\s*true\s*\)/g;

/**
 * @param {string} src
 * @returns {Array<{ index: number, bodyStart: number, bodyEnd: number }>}
 */
function findCatchBlocks(src) {
  const blocks = [];
  const catchHeaderRe = /\bcatch\b\s*(\([^)]*\))?\s*\{/g;
  let m;
  while ((m = catchHeaderRe.exec(src))) {
    const bodyStart = m.index + m[0].length;
    const bodyEnd = findMatchingBrace(src, bodyStart);
    if (bodyEnd === -1) continue; // unbalanced; ignore rather than false-positive
    blocks.push({ index: m.index, bodyStart, bodyEnd });
    catchHeaderRe.lastIndex = bodyEnd + 1;
  }
  return blocks;
}

/**
 * Given the index just after an opening `{`, find the index of its matching
 * `}`, correctly skipping over line comments, block comments, string
 * literals, and template literals (including `${...}` interpolation).
 * @param {string} src
 * @param {number} openIndex index right after the opening `{`
 * @returns {number} index of the matching `}`, or -1 if unbalanced
 */
function findMatchingBrace(src, openIndex) {
  let depth = 1;
  let i = openIndex;
  const stack = [];
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "/" && next === "/") {
      i = src.indexOf("\n", i);
      if (i === -1) return -1;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i = skipStringLiteral(src, i, ch);
      if (i === -1) return -1;
      continue;
    }
    if (ch === "`") {
      i = skipTemplateLiteral(src, i);
      if (i === -1) return -1;
      continue;
    }
    if (ch === "{") {
      depth++;
      stack.push(i);
      i++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
      stack.pop();
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

/** @param {string} src @param {number} start @param {string} quote @returns {number} */
function skipStringLiteral(src, start, quote) {
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === quote) return i + 1;
    if (src[i] === "\n") return -1; // unterminated single-line string
    i++;
  }
  return -1;
}

/** @param {string} src @param {number} start @returns {number} */
function skipTemplateLiteral(src, start) {
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === "`") return i + 1;
    if (src[i] === "$" && src[i + 1] === "{") {
      // Skip the interpolation expression by brace-matching from after `${`.
      const end = findMatchingBrace(src, i + 2);
      if (end === -1) return -1;
      i = end + 1;
      continue;
    }
    i++;
  }
  return -1;
}

/** Strip line and block comment markers from a catch body, returning
 * `{ code, commentText }` where `code` is what remains after removing all
 * comments (should be empty/whitespace for a code-free catch) and
 * `commentText` is the concatenated text of all comments found.
 * @param {string} body
 */
function splitCodeAndComments(body) {
  let code = "";
  let commentText = "";
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    const next = body[i + 1];
    if (ch === "/" && next === "/") {
      const end = body.indexOf("\n", i);
      const lineEnd = end === -1 ? body.length : end;
      commentText += body.slice(i + 2, lineEnd) + " ";
      i = lineEnd;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = body.indexOf("*/", i + 2);
      const blockEnd = end === -1 ? body.length : end + 2;
      commentText += body.slice(i + 2, end === -1 ? body.length : end) + " ";
      i = blockEnd;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = skipStringLiteral(body, i, ch);
      code += body.slice(i, end === -1 ? body.length : end);
      i = end === -1 ? body.length : end;
      continue;
    }
    if (ch === "`") {
      const end = skipTemplateLiteral(body, i);
      code += body.slice(i, end === -1 ? body.length : end);
      i = end === -1 ? body.length : end;
      continue;
    }
    code += ch;
    i++;
  }
  return { code, commentText };
}

function listTrackedTestFiles() {
  // `:(glob)` pathspec magic makes `**` match across directory boundaries
  // (plain git pathspecs treat `**` as a literal double-star otherwise).
  const out = execFileSync("git", ["ls-files", ":(glob)test/**/*.test.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src[i] === "\n") line++;
  return line;
}

function checkFile(relPath) {
  const src = readFileSync(resolve(repoRoot, relPath), "utf8");
  const violations = [];
  const cleanupCatches = [];

  for (const m of src.matchAll(TAUTOLOGY_RE)) {
    violations.push({
      file: relPath,
      line: lineOf(src, m.index),
      kind: "tautology",
      detail: "expect(true).toBe(true) asserts nothing about the code under test",
    });
  }

  for (const block of findCatchBlocks(src)) {
    const body = src.slice(block.bodyStart, block.bodyEnd);
    const { code, commentText } = splitCodeAndComments(body);
    if (code.trim() !== "") continue; // has real statements, not our concern
    const annotation = commentText.replace(/\s+/g, " ").trim();
    const line = lineOf(src, block.index);
    if (annotation.length >= MIN_ANNOTATION_CHARS) {
      cleanupCatches.push({ file: relPath, line, annotation });
    } else {
      violations.push({
        file: relPath,
        line,
        kind: annotation ? "trivial-annotation-catch" : "empty-catch",
        detail: annotation
          ? `catch body has no code and only a trivial comment ("${annotation}"); needs a real explanation (>=${MIN_ANNOTATION_CHARS} chars)`
          : "catch body has no code and no comment explaining why the error is discarded",
      });
    }
  }

  return { violations, cleanupCatches };
}

function main() {
  const allowKnownDebt = process.argv.includes("--allow-known-debt");
  const files = listTrackedTestFiles();
  let allViolations = [];
  let allCleanup = [];

  for (const file of files) {
    const { violations, cleanupCatches } = checkFile(file);
    allViolations = allViolations.concat(violations);
    allCleanup = allCleanup.concat(cleanupCatches);
  }

  console.log(`Scanned ${files.length} tracked test file(s).`);
  console.log("");

  if (allCleanup.length > 0) {
    console.log(`Annotated cleanup-only catches (allowed, ${allCleanup.length}):`);
    for (const c of allCleanup) {
      console.log(`  ${c.file}:${c.line} — ${c.annotation}`);
    }
    console.log("");
  }

  if (allViolations.length > 0) {
    console.log(`Violations (${allViolations.length}):`);
    for (const v of allViolations) {
      console.log(`  ${v.file}:${v.line} [${v.kind}] ${v.detail}`);
    }
    console.log("");
    console.log(`FAIL: ${allViolations.length} violation(s) found.`);
    if (allowKnownDebt) {
      console.log("--allow-known-debt set: exiting 0 despite violations above.");
      process.exit(0);
    }
    process.exit(1);
  }

  console.log("PASS: no tautologies or unannotated empty/comment-only catches found.");
  process.exit(0);
}

main();
