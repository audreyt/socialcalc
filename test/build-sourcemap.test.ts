// Regression coverage for build.ts's coverage-only dist/SocialCalc.js.map:
// a `SOCIALCALC_COVERAGE=1 vp build` must produce a sourceMappingURL
// comment + map that correctly attributes every generated range back to
// the js/*.ts source that produced it (not just "somewhere in the right
// file" — the exact original line/column).
//
// Gated behind `SOCIALCALC_COVERAGE === "1"` (same contract as
// test/browser-coverage-mapping.test.ts and
// test/merge-browser-coverage-guard.test.ts): this suite only has teeth
// as part of a coverage-mode run (`test:coverage`/`test:coverage:merged`,
// both of which now set the flag for their own `vp test --coverage` step,
// not just the preceding build). Without this gate, merely including this
// file in ANY `vp test` invocation (e.g. plain `vp test run`) would
// unconditionally rebuild dist/SocialCalc.js in coverage mode as a side
// effect via `beforeAll` below — silently mutating a git-tracked build
// artifact, and racing any other worker/test file concurrently loading
// dist/SocialCalc.js from disk — even though every test in this file is
// then skipped. `describe.skip` alone does not stop this: `beforeAll` is
// registered at file (root-suite) scope, not nested inside the describe
// block, so Vitest still invokes it regardless of which nested tests are
// skipped — the early return inside `beforeAll` is the actual guard.
//
// Deliberately idempotent, never destructive, when the flag IS set: when
// the ambient dist/SocialCalc.js + .map are already coverage-mode (the
// normal case under `vp test --coverage`, since test:coverage's prefix
// already built them before any test file started), this is a pure read —
// no rebuild, no write. It only actually invokes `vp build` when the
// ambient state isn't already correct (e.g. this file run standalone).
// This file must NEVER rebuild dist/SocialCalc.js *away* from coverage
// mode mid-suite: coverage-v8 re-reads it from disk at report time to
// remap every other test file's coverage too, and other test files/workers
// load it concurrently — a mid-suite plain rebuild would race and could
// silently collapse the whole run's per-file attribution back to one dist
// blob (reproduced empirically while developing this test; removed that
// destructive check from the automated suite for exactly this reason —
// "plain build emits no comment and removes a stale map" is instead
// verified manually, see the coverage-gate hardening report).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { beforeAll, describe, expect, test } from "vite-plus/test";

const sourcemapTestEnabled = process.env.SOCIALCALC_COVERAGE === "1";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(repoRoot, "dist");
const bundlePath = resolve(distDir, "SocialCalc.js");
const mapPath = resolve(distDir, "SocialCalc.js.map");
const vpBin = resolve(repoRoot, "node_modules/.bin/vp");

let bundleText: string;
let bundleLines: string[];
let map: { version: number; file: string; sources: string[] };
let trace: TraceMap;

beforeAll(() => {
  // No-op unless the opt-in flag is set — see the file-header comment.
  if (!sourcemapTestEnabled) return;

  const alreadyCoverageBuilt =
    existsSync(mapPath) && readFileSync(bundlePath, "utf8").includes("sourceMappingURL");
  if (!alreadyCoverageBuilt) {
    execFileSync(vpBin, ["build"], {
      cwd: repoRoot,
      env: { ...process.env, SOCIALCALC_COVERAGE: "1" },
      stdio: "pipe",
    });
  }
  bundleText = readFileSync(bundlePath, "utf8");
  bundleLines = bundleText.split("\n");
  map = JSON.parse(readFileSync(mapPath, "utf8"));
  trace = new TraceMap(map as never);
});

// Resolve a `sources[]` entry the exact way ast-v8-to-istanbul (Vitest's
// v8 coverage remapper) resolves it: relative to the bundle's own directory.
function resolveSource(relativeSource: string): string {
  return resolve(dirname(bundlePath), relativeSource);
}

// Finds the (1-based line, 0-based column) of a unique substring in the
// generated bundle, independently finds that same substring's (1-based)
// line in the real on-disk original source, and asserts the sourcemap
// resolves the bundle position back to exactly that source/line — never a
// hardcoded line number, so the test survives unrelated line-count shifts
// elsewhere in the same source file (e.g. another stream adding code
// above the anchor). Both lookups require the needle to be unique in its
// file, so a stale or duplicated anchor fails loudly instead of silently
// picking the wrong occurrence.
function expectRoundTrip(needle: string, expectedRelativeSource: string) {
  const bundleMatches = bundleLines.filter((line) => line.includes(needle));
  expect(bundleMatches, `expected exactly one "${needle}" in dist/SocialCalc.js`).toHaveLength(1);
  const lineIndex = bundleLines.findIndex((line) => line.includes(needle));
  const column = bundleLines[lineIndex]!.indexOf(needle);

  const sourcePath = resolveSource(expectedRelativeSource);
  const sourceLines = readFileSync(sourcePath, "utf8").split("\n");
  const sourceMatches = sourceLines.filter((line) => line.includes(needle));
  expect(
    sourceMatches,
    `expected exactly one "${needle}" in ${expectedRelativeSource}`,
  ).toHaveLength(1);
  const expectedOriginalLine = sourceLines.findIndex((line) => line.includes(needle)) + 1;

  const original = originalPositionFor(trace, { line: lineIndex + 1, column });
  expect(original.source).toBe(expectedRelativeSource);
  expect(original.line).toBe(expectedOriginalLine);
  expect(sourceLines[original.line! - 1]).toContain(needle);
}

const sourcemapDescribe = sourcemapTestEnabled ? describe : describe.skip;
sourcemapDescribe("SOCIALCALC_COVERAGE=1 vp build: dist/SocialCalc.js sourcemap", () => {
  test("bundle ships a sourceMappingURL pointing at SocialCalc.js.map, appended after the UMD close", () => {
    expect(bundleText.endsWith("//# sourceMappingURL=SocialCalc.js.map\n")).toBe(true);
    expect(bundleText).toContain(
      "return SocialCalc;\n}));\n//# sourceMappingURL=SocialCalc.js.map\n",
    );
  });

  test("map is a valid v3 sourcemap listing every js/*.ts core source relative to dist/", () => {
    expect(map.version).toBe(3);
    expect(map.file).toBe("SocialCalc.js");
    const expectedSources = [
      "../js/socialcalcconstants.ts",
      "../js/socialcalc-3.ts",
      "../js/chart.ts",
      "../js/socialcalctableeditor.ts",
      "../js/formatnumber2.ts",
      "../js/formula1.ts",
      "../js/formula-parse.ts",
      "../js/formula-operand.ts",
      "../js/formula-ref.ts",
      "../js/socialcalcpopup.ts",
      "../js/socialcalcspreadsheetcontrol.ts",
      "../js/socialcalcviewer.ts",
    ];
    expect(map.sources).toEqual(expectedSources);
    for (const source of expectedSources) {
      const resolved = resolveSource(source);
      expect(existsSync(resolved), `${source} must resolve to a real file from dist/`).toBe(true);
    }
  });

  test("attributes a socialcalc-3.ts function to its exact original line", () => {
    expectRoundTrip("SC.CreateSheetSave = function", "../js/socialcalc-3.ts");
  });

  test("attributes a formula1.ts function to its exact original line", () => {
    expectRoundTrip("SocialCalc.DebugLog = function", "../js/formula1.ts");
  });

  test("attributes a formatnumber2.ts function to its exact original line", () => {
    expectRoundTrip("SocialCalc.intFunc = function", "../js/formatnumber2.ts");
  });
});
