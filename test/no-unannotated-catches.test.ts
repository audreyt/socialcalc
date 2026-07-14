import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

// Anti-regression guard: an empty `catch {}` block in a test file either
// suppresses a real failure from the operation under test (the exact
// anti-pattern this repo's coverage-test cleanup targeted), or is a
// deliberate, narrow allowance for cleanup code that may legitimately fail
// (e.g. clearing a timer/listener left by a previous test). This test
// enforces the distinction STRUCTURALLY, not via a per-line allowlist:
//
//   1. Every empty catch block (no real statements — comments don't count)
//      must carry a "Cleanup-only:" comment, either leading the `try`
//      statement or inside the catch block itself. Undocumented empty
//      catches fail.
//   2. No `try` block whose catch is empty may contain an `expect(...)`
//      call anywhere inside it — an assertion inside a swallowed try can
//      never actually fail the test, which is the core anti-pattern.
//
// New empty catches added later automatically require the same discipline;
// there is nothing here to "allowlist" per file/line.
//
// Implementation note: this deliberately does NOT use the `typescript`
// compiler API. The package pinned in this repo (7.0.2, the Go-native
// "tsgo" preview) only exports a slim `lib/version.cjs` shim at its main
// entry point — `ts.createSourceFile`/`ts.ScriptTarget`/etc. are undefined
// at runtime even though `@types/node`-style ambient types may suggest
// otherwise. Instead this uses a small hand-rolled, string/comment-aware
// brace scanner sufficient for finding `try { } catch { }` blocks reliably
// across this codebase's syntax (no unusual template-literal-embedded
// try/catch, no JSX).

interface CommentRange {
  start: number;
  end: number;
  text: string;
}

interface SkeletonResult {
  code: string;
  comments: CommentRange[];
}

/**
 * Returns a same-length "code skeleton" of `src` where every character
 * inside a string literal, template literal, or comment is replaced with a
 * space (newlines preserved), plus the list of comment ranges (with their
 * original text) for marker-comment detection. Brace matching and
 * `expect(`/`try`/`catch` keyword detection run against the skeleton only,
 * so occurrences inside strings/comments never produce false positives.
 */
function tokenizeSkeleton(src: string): SkeletonResult {
  let i = 0;
  const n = src.length;
  const codeMask = src.split("");
  const comments: CommentRange[] = [];

  const maskRange = (start: number, end: number) => {
    for (let k = start; k < end; k++) {
      if (src[k] !== "\n") codeMask[k] = " ";
    }
  };

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    if (c === "/" && c2 === "/") {
      const start = i;
      while (i < n && src[i] !== "\n") i++;
      maskRange(start, i);
      comments.push({ start, end: i, text: src.slice(start, i) });
      continue;
    }

    if (c === "/" && c2 === "*") {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      if (i < n) i += 2;
      maskRange(start, i);
      comments.push({ start, end: i, text: src.slice(start, i) });
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      maskRange(start, i);
      continue;
    }

    if (c === "`") {
      // Template literal, including any ${...} interpolation. Masking the
      // whole thing (interpolated code included) is an accepted
      // simplification: try/catch/expect() are never written only inside a
      // template interpolation in this codebase.
      const start = i;
      i++;
      let depth = 0;
      while (i < n) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (depth === 0 && src[i] === "`") {
          i++;
          break;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          depth++;
          i += 2;
          continue;
        }
        if (depth > 0 && src[i] === "{") {
          depth++;
          i++;
          continue;
        }
        if (depth > 0 && src[i] === "}") {
          depth--;
          i++;
          continue;
        }
        i++;
      }
      maskRange(start, i);
      continue;
    }

    i++;
  }

  return { code: codeMask.join(""), comments };
}

function findMatchingBrace(code: string, openPos: number): number {
  let depth = 0;
  for (let i = openPos; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface TryCatchMatch {
  tryStart: number;
  tryOpenBrace: number;
  tryCloseBrace: number;
  catchOpenBrace: number;
  catchCloseBrace: number;
  isEmpty: boolean;
  tryBodyCode: string;
}

function scanTryCatchBlocks(src: string): { matches: TryCatchMatch[]; comments: CommentRange[] } {
  const { code, comments } = tokenizeSkeleton(src);
  const tryRe = /\btry\s*\{/g;
  const matches: TryCatchMatch[] = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint: intentional stateful regex loop
  while ((m = tryRe.exec(code))) {
    const tryOpenBrace = m.index + m[0].length - 1;
    const tryCloseBrace = findMatchingBrace(code, tryOpenBrace);
    if (tryCloseBrace === -1) continue;

    let j = tryCloseBrace + 1;
    while (j < code.length && /\s/.test(code[j]!)) j++;
    const catchMatch = /^catch(\s*\([^)]*\))?\s*\{/.exec(code.slice(j));
    if (!catchMatch) continue; // try/finally with no catch — not our concern

    const catchOpenBrace = j + catchMatch[0].length - 1;
    const catchCloseBrace = findMatchingBrace(code, catchOpenBrace);
    if (catchCloseBrace === -1) continue;

    const catchBodyCode = code.slice(catchOpenBrace + 1, catchCloseBrace);
    const tryBodyCode = code.slice(tryOpenBrace + 1, tryCloseBrace);

    matches.push({
      tryStart: m.index,
      tryOpenBrace,
      tryCloseBrace,
      catchOpenBrace,
      catchCloseBrace,
      isEmpty: catchBodyCode.trim().length === 0,
      tryBodyCode,
    });
  }
  return { matches, comments };
}

const CLEANUP_MARKER = "Cleanup-only:";

function markerImmediatelyBefore(src: string, comments: CommentRange[], pos: number): boolean {
  const before = comments.filter((c) => c.end <= pos).sort((a, b) => b.end - a.end);
  let cursor = pos;
  let sawMarker = false;
  for (const c of before) {
    const between = src.slice(c.end, cursor);
    if (!/^\s*$/.test(between)) break; // not contiguous with `try` anymore
    if (c.text.includes(CLEANUP_MARKER)) sawMarker = true;
    cursor = c.start;
  }
  return sawMarker;
}

const guardedFiles = [
  "iofunctions-coverage.test.ts",
  "control-coverage.test.ts",
  "editor-dom-coverage.test.ts",
];

interface Violation {
  file: string;
  line: number;
  reason: string;
}

function scanFile(relPath: string): Violation[] {
  const absPath = fileURLToPath(new URL(`./${relPath}`, import.meta.url));
  const src = readFileSync(absPath, "utf8");
  const { matches, comments } = scanTryCatchBlocks(src);

  const lineOf = (pos: number) => src.slice(0, pos).split("\n").length;

  const violations: Violation[] = [];
  for (const tc of matches) {
    if (!tc.isEmpty) continue;

    const hasMarker =
      markerImmediatelyBefore(src, comments, tc.tryStart) ||
      comments.some(
        (c) =>
          c.start >= tc.catchOpenBrace &&
          c.end <= tc.catchCloseBrace &&
          c.text.includes(CLEANUP_MARKER),
      );
    if (!hasMarker) {
      violations.push({
        file: relPath,
        line: lineOf(tc.tryStart),
        reason: `empty catch block is missing a "${CLEANUP_MARKER}" annotation`,
      });
    }

    if (/\bexpect\s*\(/.test(tc.tryBodyCode)) {
      violations.push({
        file: relPath,
        line: lineOf(tc.tryStart),
        reason:
          "try block with an empty catch contains an expect(...) call " +
          "(a swallowed assertion can never fail the test)",
      });
    }
  }
  return violations;
}

test("no unannotated empty catches or swallowed assertions in owned coverage test files", () => {
  const allViolations = guardedFiles.flatMap(scanFile);

  if (allViolations.length > 0) {
    const summary = allViolations.map((v) => `  ${v.file}:${v.line} — ${v.reason}`).join("\n");
    throw new Error(
      `Found ${allViolations.length} unannotated/unsafe empty catch(es):\n${summary}`,
    );
  }

  expect(allViolations).toEqual([]);
});
