// scripts/merge-browser-coverage.mjs
//
// Honest merge of Chromium Playwright V8 JS coverage with Vitest's Istanbul
// source-attributed coverage so DOM-heavy UI paths count from real browser
// tests rather than fake-DOM invocation.
//
// Reads:
//   coverage/coverage-final.json   Vitest/coverage-v8 output (Istanbul format)
//                                  keyed by absolute path to js/*.ts; emitted
//                                  because vite.config.ts's reporter list
//                                  includes "json".
//   coverage-browser-v8/*.json     Per-spec raw `page.coverage.stopJSCoverage()`
//                                  V8 entries (filtered to /dist/SocialCalc.js),
//                                  written by e2e/fixtures/editor.ts's `coverage`
//                                  auto-fixture when SOCIALCALC_BROWSER_COVERAGE=1.
//   dist/SocialCalc.js              The coverage-built bundle (with trailing
//                                  `//# sourceMappingURL=...` comment).
//   dist/SocialCalc.js.map          The composed sourcemap (build.ts emits
//                                  this when SOCIALCALC_COVERAGE=1).
//
// Writes (under coverage-merged/):
//   coverage-final.json   merged Istanbul map (hand-off format)
//   lcov.info             lcov for external tooling
//   lcov-report/          html walk
//   coverage-summary.json per-file pct summary
//   text                  printed to stdout by the "text" reporter
//
// Enforces {@linkcode thresholdContract} thresholds (per-file + global) on the
// MERGED result, using the same Istanbul CoverageSummary computations Vitest
// itself uses. The unit-only Vitest gate already enforces the same thresholds
// via the imported contract — browser coverage can only ever RAISE merged
// percentages (V8 hits are unioned by max), never lower them, so a regression
// caught by the unit-only gate still fails the merged gate.
//
// Determinism: `istanbul-lib-coverage`'s `CoverageMap.merge()` unions hits by
// absolute path and is order-independent. This script processes browser files
// in sorted filename order so the on-disk JSON is byte-identical across
// reruns with the same inputs. Filters V8 entries to the bundle URL only —
// never counts fixture/server code, never counts anonymous scripts. No network
// at runtime; everything reads from local dist/ + coverage directories.
//
// Invoked as: `node scripts/merge-browser-coverage.mjs` (plain Node — no tsx,
// no Vite transform — because the threshold contract lives in *.mjs).

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { convert as v8ToIstanbul } from "ast-v8-to-istanbul";
import { parse } from "@babel/parser";
import istanbulCoverage from "istanbul-lib-coverage";
import istanbulReport from "istanbul-lib-report";
import istanbulReports from "istanbul-reports";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { thresholdContract, mergedReporters } from "../coverage-thresholds.mjs";

const { createCoverageMap } = istanbulCoverage;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const bundlePath = join(repoRoot, "dist", "SocialCalc.js");
const mapPath = join(repoRoot, "dist", "SocialCalc.js.map");
const unitFinalPath = join(repoRoot, "coverage", "coverage-final.json");
// `SOCIALCALC_BROWSER_COVERAGE_DIR` overrides the input directory read below
// (default unchanged: repo-root coverage-browser-v8/). Narrow, test-only
// escape hatch — scripts/merge-browser-coverage.mjs's own regression suite
// (test/merge-browser-coverage-guard.test.ts) points this at an isolated
// `mkdtempSync` directory per test run instead of writing fixtures into the
// real shared coverage-browser-v8/, so a broken/interrupted test run can
// never strand or clobber real collected evidence, and concurrent
// invocations (e.g. two guard tests, or a guard test racing a real
// `vp exec playwright test` run) never contend for the same directory.
// Every other consumer (package.json's test:coverage:merged, CI, release)
// leaves this unset and gets the real directory exactly as before.
const browserDir = process.env.SOCIALCALC_BROWSER_COVERAGE_DIR
  ? resolve(process.env.SOCIALCALC_BROWSER_COVERAGE_DIR)
  : join(repoRoot, "coverage-browser-v8");
const mergedDir = join(repoRoot, "coverage-merged");
const bundleUrlSuffix = "/dist/SocialCalc.js";

// --- Validate preconditions -------------------------------------------------

const fail = (msg) => {
  console.error(`[merge-browser-coverage] ${msg}`);
  process.exit(2);
};

if (!existsSync(unitFinalPath)) {
  fail(
    `missing Vitest coverage-final.json at ${unitFinalPath}.\n` +
      `  Run \`SOCIALCALC_COVERAGE=1 vp test --coverage\` first.`,
  );
}
if (!existsSync(mapPath) || !existsSync(bundlePath)) {
  fail(
    `missing dist/SocialCalc.js or dist/SocialCalc.js.map.\n` +
      `  Run \`SOCIALCALC_COVERAGE=1 vp build\` first so build.ts composes the sourcemap.`,
  );
}
if (!existsSync(browserDir) || readdirSync(browserDir).filter((f) => f.endsWith(".json")).length === 0) {
  fail(
    `missing browser coverage at ${browserDir}.\n` +
      `  Run \`SOCIALCALC_BROWSER_COVERAGE=1 vp exec playwright test\` first.`,
  );
}

// --- Load bundle code + sourcemap (shared across every per-spec convert) ----

const bundleCode = readFileSync(bundlePath, "utf8");
const bundleMap = JSON.parse(readFileSync(mapPath, "utf8"));
const bundleFileUrl = pathToFileURL(bundlePath).href;

// Parse the bundle into an ESTree AST once; every per-spec
// `v8ToIstanbul({ ast, ... })` reuses this cached parse.
const ast = parse(bundleCode, {
  sourceType: "script",
  allowReturnOutsideFunction: true,
});

// --- Sourcemap round-trip sanity --------------------------------------------
// Every `bundleMap.sources` entry must resolve to a real file; and at least
// one well-known anchor in the bundle must round-trip through `TraceMap` to a
// non-null `originalPositionFor`. This is the same cross-check that
// test/build-sourcemap.test.ts runs at test time — refused up front so a
// stale/dist sourcemap can't silently mis-attribute every V8 range.
{
  const trace = new TraceMap(bundleMap);
  for (const s of bundleMap.sources ?? []) {
    const sp = resolve(dirname(bundlePath), s);
    if (!existsSync(sp)) {
      fail(`sourcemap source ${s} resolves to ${sp}, which does not exist on disk — dist/SocialCalc.js.map is stale.`);
    }
  }
  // Locating "SC.CreateSheetSave = function" inside the bundle independently
  // of any line number (the bundle layout shifts whenever a source above it
  // changes); only the column where it first occurs is needed.
  const idx = bundleCode.indexOf("SC.CreateSheetSave = function");
  if (idx < 0) fail('anchor "SC.CreateSheetSave = function" not found in dist/SocialCalc.js');
  const lineNum = bundleCode.slice(0, idx).split("\n").length;
  const lineStart = bundleCode.lastIndexOf("\n", idx - 1) + 1;
  const col = idx - lineStart;
  const orig = originalPositionFor(trace, { line: lineNum, column: col });
  if (!orig.source || !orig.line) {
    fail("sourcemap round-trip failed for SC.CreateSheetSave anchor — bundle map is unsound.");
  }
}

// --- Track which sources count (matches what dist/SocialCalc.js bundles) ----

const trackedSources = new Set(
  (bundleMap.sources ?? []).map((s) => resolve(dirname(bundlePath), s)),
);

// --- Load Vitest Istanbul coverage ------------------------------------------

const unitMap = createCoverageMap(JSON.parse(readFileSync(unitFinalPath, "utf8")));

// --- Accumulate merged coverage ---------------------------------------------
//
// Start from the unit map, then merge in converted browser coverage.
// `CoverageMap.merge()` is deterministic and order-independent (per-file
// statement/branch/function counts are unioned by max — V8 hits can only
// raise, never lower, Istanbul counts). Process files in sorted filename
// order so the on-disk JSON is byte-identical across reruns of the same
// input. The merge is the same primitive Vitest itself uses to fold V8
// coverage across test runs.

const merged = createCoverageMap();
merged.merge(unitMap);

const browserFiles = readdirSync(browserDir)
  .filter((f) => f.endsWith(".json"))
  .sort();
let processedFiles = 0;
let skippedFiles = 0;
let convertedRanges = 0;
let processedSpecTitles = [];
let preMerge = snapshot(merged);

for (const fname of browserFiles) {
  const fpath = join(browserDir, fname);
  let payload;
  try {
    payload = JSON.parse(readFileSync(fpath, "utf8"));
  } catch (e) {
    // A broken/truncated collector must not silently degrade to unit-only
    // coverage while the report still claims a merged result — fail loud
    // and name the offending file rather than warn+continue.
    fail(`malformed JSON in browser coverage file ${fname}: ${e.message}`);
  }
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    // Specs that didn't load the bundle (a project-level setup page, etc.)
    // write an empty array; nothing to merge. Track separately so the
    // report stays honest about how many specs contributed coverage.
    skippedFiles++;
    continue;
  }
  const entry = payload.entries.find((e) => e.url.endsWith(bundleUrlSuffix));
  if (!entry) {
    skippedFiles++;
    continue;
  }
  // Refuse to merge a V8 entry whose bytes diverge from dist/SocialCalc.js:
  // if they do, every byte offset V8 reported would map through stale
  // sourcemap segments to the wrong js/*.ts line. (Happens if the page served
  // an older bundle — e.g. a `normal.html` left over from before a rebuild.)
  // A MISSING `source` is refused too, not silently skipped: without it there
  // is no way to prove the reported ranges belong to the on-disk bundle, so a
  // truncated/forged collector payload could otherwise inject fabricated
  // ranges that convert "successfully" against unrelated byte offsets.
  if (entry.source == null) {
    fail(
      `browser coverage entry for the bundle URL is missing its "source" field — cannot verify ` +
        `it matches on-disk dist/SocialCalc.js, so its V8 ranges cannot be trusted. ` +
        `(test=${payload.testTitle ?? fname}, file=${fname})`,
    );
  }
  if (entry.source !== bundleCode) {
    fail(
      `page bundle bytes differ from on-disk dist/SocialCalc.js — this would silently ` +
        `mis-attribute every V8 range. Rebuild (\`SOCIALCALC_COVERAGE=1 vp build\`) and ` +
        `re-run the browser suite. (test=${payload.testTitle ?? fname})`,
    );
  }

  const covData = await v8ToIstanbul({
    code: bundleCode,
    sourceMap: bundleMap,
    ast,
    coverage: { functions: entry.functions, url: bundleFileUrl },
    wrapperLength: 0,
  });
  // Normalize in-memory convert output (sentinel Infinity for missing end
  // columns) to the JSON-serialized form Vitest's coverage-final.json already
  // has (Infinity -> null under JSON.stringify), so CoverageMap.merge()'s
  // `keyFromLoc` produces identical keys for the same statement on both sides.
  // Without this round-trip the same statement ends up with two merged
  // entries ("...|null" vs "...|Infinity"), which doubles the total and halves
  // the unified pct — observed at integration: per-file totals went from
  // 3531 -> 7053 and pct 85.75% -> 56.2% when only Vitest's own run had
  // produced 3531. Coverage counts are always finite numeric, so JSON
  // round-trip cannot lose any legitimate data.
  const covDataNormalized = JSON.parse(JSON.stringify(covData));
  merged.merge(covDataNormalized);
  processedFiles++;
  // Count real executed V8 ranges contributed by this entry (count > 0).
  // A broken/no-op collector can produce a well-formed payload whose
  // `functions` array is empty or whose every range has count 0 — that
  // would still increment `processedFiles` and merge a valid-looking (but
  // entirely zero-hit) coverage map, silently degrading to unit-only
  // coverage while the report still claims a sound merged result. Track
  // this separately so the post-scan guard below can refuse to report or
  // enforce thresholds when nothing was actually converted.
  for (const fn of entry.functions ?? []) {
    for (const range of fn.ranges ?? []) {
      if (range.count > 0) convertedRanges++;
    }
  }
  if (payload.testTitle) processedSpecTitles.push(`${payload.testTitle} (${fname})`);
}

const postMerge = snapshot(merged);

// A broken collector (crashed mid-write, wrong page, disabled coverage API,
// etc.) must not be able to pass this gate on unit-only coverage while the
// report still claims a merged unit+browser result. Refuse to proceed to
// filtering/reporting/threshold enforcement unless at least one browser
// coverage file was both accepted AND actually contributed real executed
// ranges. Specs that legitimately never load the bundle (skippedFiles) are
// still allowed — only the AGGREGATE must show real signal.
if (processedFiles === 0 || convertedRanges === 0) {
  fail(
    `browser coverage directory ${browserDir} contained ${browserFiles.length} file(s) but none ` +
      `produced real converted coverage (processed=${processedFiles}, convertedRanges=${convertedRanges}, ` +
      `skipped=${skippedFiles}). Refusing to report or enforce thresholds on a merge that would ` +
      `silently fall back to unit-only coverage while claiming a merged browser result.`,
  );
}

// --- Filter merged map to js/*.ts only --------------------------------------
//
// Defense in depth: the Playwright fixture filters at write time to the
// /dist/SocialCalc.js URL only (so jQuery and any future fixture script
// never enter coverage-browser-v8/). The Vitest unit map's exclude already
// drops lemma/scripts/test. Just in case a future fixture/server script
// counts ONLY what's bundled into dist/SocialCalc.js (the source-of-truth
// sourcemap's `sources`). This is where we refuse fixture/server code.
const excluded = [];
for (const f of merged.files()) {
  if (!trackedSources.has(f)) excluded.push(f);
}
merged.filter((f) => trackedSources.has(f));
const filtered = merged;

// The browser side is an additive union, never a second independent
// instrumentation pass. Assert that every unit file, counter, and hit set is
// preserved (or raised) after conversion and filtering. This catches a
// sourcemap/key normalization regression that could otherwise make the merged
// headline look plausible while silently losing unit-observed paths.
assertMonotonic(unitMap, filtered, trackedSources);

// --- Emit merged reports under coverage-merged/ ------------------------------
rmSync(mergedDir, { recursive: true, force: true });
mkdirSync(mergedDir, { recursive: true });

const context = istanbulReport.createContext({
  dir: mergedDir,
  coverageMap: filtered,
  watermarks: istanbulReport.getDefaultWatermarks(),
});

for (const name of mergedReporters) {
  istanbulReports
    .create(name, {
      skipFull: false,
      projectRoot: repoRoot,
      file:
        name === "json"
          ? "coverage-final.json"
          : name === "json-summary"
            ? "coverage-summary.json"
            : undefined,
    })
    .execute(context);
}

// --- Enforce thresholds on the MERGED result --------------------------------
//
// Same algorithm Vitest's BaseCoverageProvider uses (see
// node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js): resolve thresholds
// into per-glob CoverageMaps, compute summary pct, and exit nonzero on any
// breach. The contract is the same `thresholdContract` imported by
// vite.config.ts, so the unit-only gate and the merged gate share one source
// of truth and can never drift.

const violations = [];

function checkOne(name, map, floors) {
  const summary = map.getCoverageSummary();
  for (const key of ["statements", "branches", "functions", "lines"]) {
    const floor = floors[key];
    if (floor === undefined) continue;
    const pct = summary[key].pct;
    if (pct < floor) {
      violations.push(
        `ERROR: Coverage for ${key} (${pct}%) does not meet ${name === GLOBAL_KEY ? name : `"${name}"`} threshold (${floor}%).`,
      );
    }
  }
}

const GLOBAL_KEY = "global threshold";

// Global: union of every file in the filtered map.
const globalMap = createCoverageMap();
for (const f of filtered.files()) globalMap.addFileCoverage(filtered.fileCoverageFor(f));
checkOne(GLOBAL_KEY, globalMap, thresholdContract.global);

// Per-file: glob-matched per-file floors.
for (const [globPattern, floors] of Object.entries(thresholdContract.perFile)) {
  const matchFiles = filtered
    .files()
    .filter(
      (f) => {
        const r = relative(repoRoot, f).replace(/\\/g, "/");
        return r === globPattern || r.endsWith("/" + globPattern);
      },
    );
  if (matchFiles.length === 0) {
    // A per-file floor for a module that has no source in the bundle would be
    // a misconfiguration — fail loud so the contract stays honest.
    violations.push(`ERROR: per-file threshold "${globPattern}" matched zero merged files (no such js/*.ts source).`);
    continue;
  }
  const m = createCoverageMap();
  for (const f of matchFiles) m.addFileCoverage(filtered.fileCoverageFor(f));
  checkOne(globPattern, m, floors);
}

// --- Print summary ----------------------------------------------------------

console.log("\n========== merged coverage report ==========");
console.log(`unit (Vitest, Istanbul):           ${describe(preMerge)}`);
console.log(`merged (unit + Chromium V8 → js/*.ts): ${describe(postMerge)}\n`);

console.log(`browser coverage entries processed: ${processedFiles}`);
console.log(`browser coverage entries skipped:   ${skippedFiles}`);
if (excluded.length > 0) {
  console.log(`\nfiles excluded from merged report (not bundled into dist/SocialCalc.js):`);
  for (const f of excluded) console.log(`  - ${relative(repoRoot, f) || f}`);
}
if (processedSpecTitles.length > 0) {
  console.log(`\nmerged ${processedSpecTitles.length} spec(s):`);
  for (const t of processedSpecTitles.slice(0, 50)) console.log(`  - ${t}`);
  if (processedSpecTitles.length > 50) console.log(`  ... and ${processedSpecTitles.length - 50} more`);
}

console.log(`\nper-file merged result:`);
const rows = filtered
  .files()
  .map((f) => {
    const fc = filtered.fileCoverageFor(f);
    const s = fc.toSummary();
    return {
      file: relative(repoRoot, f),
      stmts: round(s.statements.pct),
      branches: round(s.branches.pct),
      funcs: round(s.functions.pct),
      lines: round(s.lines.pct),
    };
  })
  .sort((a, b) => a.file.localeCompare(b.file));
console.table(rows);

if (violations.length > 0) {
  console.error("\n========== coverage threshold violations ==========");
  for (const v of violations) console.error(v);
  process.exit(1);
}

console.log("\nall thresholds met by merged unit+browser coverage.");
process.exit(0);

// --- helpers ----------------------------------------------------------------

function snapshot(map) {
  // Coverage-paths-only snapshot, omits any files outside the bundle sources.
  const m = createCoverageMap();
  for (const f of map.files()) {
    if (!trackedSources.has(f)) continue;
    m.addFileCoverage(map.fileCoverageFor(f));
  }
  const sum = m.getCoverageSummary();
  return {
    files: m.files().length,
    statements: sum.statements,
    branches: sum.branches,
    functions: sum.functions,
    lines: sum.lines,
  };
}

function assertMonotonic(unit, result, tracked) {
  const metrics = ["statements", "branches", "functions", "lines"];
  const compareCounters = (file, label, before, after) => {
    for (const [id, count] of Object.entries(before)) {
      const prior = Array.isArray(count) ? count : [count];
      const next = Array.isArray(after[id]) ? after[id] : [after[id] ?? 0];
      for (let i = 0; i < prior.length; i++) {
        if ((next[i] ?? 0) < prior[i]) {
          fail(`merged coverage lowered ${label} hit ${file}:${id}[${i}] from ${prior[i]} to ${next[i]}`);
        }
      }
    }
  };
  for (const file of unit.files()) {
    if (!tracked.has(file)) continue;
    if (!result.files().includes(file)) fail(`merged coverage dropped unit file ${file}`);
    const before = unit.fileCoverageFor(file);
    const after = result.fileCoverageFor(file);
    compareCounters(file, "statement", before.s, after.s);
    compareCounters(file, "function", before.f, after.f);
    compareCounters(file, "branch", before.b, after.b);
    const beforeSummary = before.toSummary();
    const afterSummary = after.toSummary();
    for (const metric of metrics) {
      if (afterSummary[metric].total < beforeSummary[metric].total) {
        fail(`merged coverage lowered ${metric} total for ${file}`);
      }
      if (afterSummary[metric].covered < beforeSummary[metric].covered) {
        fail(`merged coverage lowered ${metric} covered count for ${file}`);
      }
    }
  }
}

function describe(s) {
  return `${round(s.statements.pct)}% stmts / ${round(s.branches.pct)}% branches / ${round(s.functions.pct)}% funcs / ${round(s.lines.pct)}% lines (${s.statements.covered}/${s.statements.total} stmts, ${s.branches.covered}/${s.branches.total} branches, ${s.functions.covered}/${s.functions.total} funcs, ${s.lines.covered}/${s.lines.total} lines)`;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
