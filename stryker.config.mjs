// Stryker mutation-testing config.
//
// Four modes, selected by env var:
//
// 1. Per-file full-scope run (`MUTATE_TARGET=js/<source>.ts bun run mutate`)
//    — mutates exactly one module from ALL_MUTATE_FILES against the FULL
//    test subset stryker-file.mjs's `testsByFile` maps to that module (not
//    a stripped-down slice — the same set `vp run mutate:file` would use).
//    This is what .github/workflows/mutation.yml's `mutate-full` matrix job
//    runs, once per module, in parallel: comprehensive (every one of the 11
//    shipping modules gets gated) but far more attributable and far faster
//    wall-clock than mutating all 11 in a single sandboxed process against
//    the whole suite. Refuses to run (throws) if the target isn't in
//    ALL_MUTATE_FILES or has no testsByFile entry — a silently-untested
//    module is a bug, not an empty-suite no-op.
//
//    Break threshold is looked up per module in
//    stryker-mutation-baseline.json: a module with no recorded, actually-
//    measured baseline gets `break: null` (report-only — Stryker still
//    runs and scores it, it just can't fail the build on a number nobody
//    ever measured). Only after a real `MUTATE_TARGET=<module> bun run
//    mutate` run establishes a floor does that module's registry entry
//    flip to `measured: true` with a concrete number, and only then does
//    it gate. scripts/mutate-release-gate.mjs (run in CI on a `v*` tag
//    push, after the matrix) refuses to let a release proceed unless EVERY
//    module in ALL_MUTATE_FILES has both a fresh report and a measured,
//    passing baseline — an unmeasured module blocks a release exactly like
//    a regressed one; 80 is never treated as if it were evidence. Reports
//    go to `reports/mutation/<module-basename>/`.
//
// 2. Focused critical-baseline run (`MUTATE_SCOPE=critical bun run mutate`)
//    — mutates only CRITICAL_FILES (the 3 modules with the tightest
//    correctness bar: formula lexer/parser, operand-stack coercions, and
//    formula-reference rewrite algebra) against the deterministic union of
//    their `testsByFile` subsets. Small, fast, and reproducible enough to gate
//    a PR. `socialcalcconstants.ts` is intentionally covered only by the full
//    11-module matrix because its large data-table mutation profile needs a
//    separate literal-value baseline rather than this algorithmic gate.
//    The non-null break threshold below is the actual measured floor (see
//    the measurement note, never a guess). Reports go to
//    `reports/mutation/critical/`.
//
// 3. Per-file sandboxed iteration (`vp run mutate:file <path>`) — stryker-file.mjs
//    sets MUTATE_TESTS to the subset that exercises the target module. The
//    sandbox is intentional: source mutations must never touch the caller's
//    working tree or leak between test processes.
//
//    No inPlace mode is supported. In-place mutation is unsafe for this
//    concatenated global-script build and is prohibited by the mutation gate.
//
// 4. Legacy full-sandbox run (`bun run mutate`, no MUTATE_SCOPE/
//    MUTATE_TARGET) — mutates every file in ALL_MUTATE_FILES in one
//    sandboxed process against the whole `vp test` suite per mutant. Report-
//    only (`break: null`): an 11-module combined run can't honestly map to
//    any single module's registered floor. Kept available for an occasional
//    manual "mutate literally everything, don't care about attribution or
//    wall time" run. `vp run mutate:all` (scripts/mutate-all.mjs) is the
//    supported way to get full-11 coverage locally without CI: it loops
//    mode 1 over ALL_MUTATE_FILES sequentially, one module + its own test
//    subset at a time, reporting sequentially instead of in a parallel
//    matrix, but still faster than this legacy mode since each module only
//    pays for its own test subset, not the whole suite.
//
// Filtered test subsets keep sandboxed per-file runs attributable without
// weakening the isolation guarantee.

import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { testsByFile, ALL_MUTATE_FILES } from "./stryker-file.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Per-module measured baseline registry — see its own $description for the
// "report-only until actually measured" contract this file enforces.
const mutationBaseline = JSON.parse(readFileSync(`${here}/stryker-mutation-baseline.json`, "utf8"));

// Release-critical baseline: pure formula lexer/parser (formula-parse.ts),
// operand-stack coercions (formula-operand.ts), A1/coordinate-rewrite
// algebra (formula-ref.ts) — the LemmaScript-verified core a bad edit is
// most likely to silently corrupt sheet math through. socialcalcconstants.ts
// is deliberately NOT in this set: it's a large default-style/string data
// table (not algorithmic control flow), its mutation profile is
// dominated by hundreds of StringLiteral default-value mutants that need
// a different remediation strategy (literal-value assertions, not
// boundary/error/reference-behaviour tests), and mixing it into the PR
// gate's target-zero-unexplained-survivors bar would either block PRs on
// an unrelated, much larger backlog or force a diluted threshold that
// hides real regressions in the 3 algorithm modules. It stays covered
// (never globally excluded) by the full 11-module per-file matrix below.
const CRITICAL_FILES = ["js/formula-parse.ts", "js/formula-operand.ts", "js/formula-ref.ts"];

const scope = process.env.MUTATE_SCOPE?.trim();
const isCriticalScope = scope === "critical";

const target = process.env.MUTATE_TARGET?.trim();
if (target && !ALL_MUTATE_FILES.includes(target)) {
  throw new Error(
    `MUTATE_TARGET=${target} is not one of ALL_MUTATE_FILES (${ALL_MUTATE_FILES.join(", ")}). ` +
      "Add it to stryker-file.mjs's testsByFile — ALL_MUTATE_FILES picks it up automatically — before gating it.",
  );
}

const mutate = isCriticalScope ? CRITICAL_FILES : target ? [target] : ALL_MUTATE_FILES;

// Deterministic test subset for the critical scope: union of testsByFile's
// entries for CRITICAL_FILES, deduped.
const criticalTests = [...new Set(CRITICAL_FILES.flatMap((f) => testsByFile[f.replace(/^js\//, "")] ?? []))];

// Per-file scope's test subset: exactly what testsByFile maps for that one
// module — the same tests `vp run mutate:file` would use. Refuse to run
// with a missing/empty mapping rather than silently falling back to the
// full suite (which would hide a genuinely untested module behind a slow,
// misleadingly "passing" run) — do not silently omit a caller.
const targetTests = target ? testsByFile[target.replace(/^js\//, "")] : undefined;
if (target && (!targetTests || targetTests.length === 0)) {
  throw new Error(
    `MUTATE_TARGET=${target} has no (or an empty) testsByFile entry in stryker-file.mjs. ` +
      "Refusing to mutate a module with no known test-coverage mapping — add one first.",
  );
}

const testsFilter =
  process.env.MUTATE_TESTS?.trim() ??
  (isCriticalScope ? criticalTests.join(" ") : target ? targetTests.join(" ") : undefined);

// Small env-parsing helper shared by the two concurrency knobs below: a
// missing/non-numeric/non-positive override silently falls back to the
// measured default rather than producing `--maxWorkers=NaN` or a zero/
// negative Stryker `concurrency` (either of which would hang or no-op).
function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// Vitest's own "forks" pool defaults to using nearly every logical core for
// a single `vp test run` invocation. Stryker's `concurrency` below then runs
// several such invocations at once (one per in-flight mutant), so an
// uncapped pool means `concurrency` invocations each trying to claim
// (cores - 1) workers — e.g. 4 concurrent runs x up to 17 forks each on an
// 18-core box, ~4x oversubscription.
//
// Measured 2026-07-12 against socialcalc-3.ts's 34-file/444-test subset on
// an 18-logical-core host: a solo run with an uncapped pool took 7.9s; the
// identical command run 4-way concurrent with an uncapped pool never
// completed a single mutant inside the 60s+timeoutFactor budget and looped
// on TimeoutDecorator restarts indefinitely — a timeout storm, not a slow
// pass (see stryker.log from the 2026-07-12 20:36 socialcalc-3.ts run).
// Capping each invocation's own pool at --maxWorkers=2 fixed it: 4-way
// concurrent completed in ~21-23s each (8 threads/18 cores), 8-way
// concurrent completed in ~31-33s each (16 threads/18 cores, still
// comfortably under budget) — confirming real headroom past 4-way once
// each invocation's internal fan-out is capped.
//
// Both this and `concurrency` below are env-overridable
// (TEST_RUNNER_MAX_WORKERS, STRYKER_CONCURRENCY) so a smaller/larger CI
// runner — or a future remeasurement — can retune without editing this
// file. Keep their product comfortably under the host's logical core count;
// the 2x4=8 default was measured safe on 18 cores with real headroom to
// spare, so it is not a knife-edge tuning.
const TEST_RUNNER_MAX_WORKERS = parsePositiveInt(process.env.TEST_RUNNER_MAX_WORKERS, 2);

const testCommand = testsFilter
  ? `vp test run --maxWorkers=${TEST_RUNNER_MAX_WORKERS} ${testsFilter}`
  : `vp test --maxWorkers=${TEST_RUNNER_MAX_WORKERS}`;

// Scope label used to namespace reports/ and the incremental cache so
// critical/per-file/legacy-full runs never clobber or cross-pollinate each
// other's state.
const scopeLabel = isCriticalScope ? "critical" : target ? basename(target, ".ts") : "full";

// Measured 2026-07-12 on the exact 3-file critical scope (formula-parse.ts,
// formula-operand.ts, formula-ref.ts), against the deterministic 23-file
// `criticalTests` union, sandboxed, concurrency 4, with NO mutator exclusions.
// socialcalcconstants.ts is deliberately not in this PR-critical scope: it
// remains covered without exclusions by the full 11-module per-file matrix.
//
// Fresh run completed 2026-07-12 18:06:
//   1440 tested, 1280 killed, 88 timeout, 72 survived => 95.00% score.
//   Per-file: formula-parse.ts 97.17% (18 survived, 34 timeout),
//   formula-operand.ts 91.99% (27 survived, 36 timeout), formula-ref.ts
//   94.22% (27 survived, 18 timeout).
//
// The disposition registry (stryker-mutation-disposition.json) contains 44
// proof-reviewed equivalent-mutant entries (43 still survived in this fresh
// report; one, id=476, is now killed incidentally and was left in place as
// a still-valid proof). The remaining 29 fresh formula survivors are NOT
// dispositioned: new boundary/error/type/reference tests in the three
// survivor test files target them, but no isolated-sandbox Stryker rerun
// has confirmed any of the 29 actually flip to Killed, so they are
// UNVERIFIED gaps pending a real rerun, never claimed "covered" or
// "resolved" here. scripts/verify-mutation-disposition.mjs recomputes this
// exact 43-matched/29-open split from a fresh report and fails loudly if it
// disagrees. The 548 constants survivors are a separate, larger figure
// outside this critical registry, visible to the full matrix; nothing here
// claims zero undispositioned survivors anywhere in the codebase.
//
// Critical break threshold is the measured integer floor of this fresh score.
const CRITICAL_BREAK_THRESHOLD = 95;

function measuredBreakFor(file) {
  const entry = mutationBaseline.modules[file];
  return entry?.measured ? entry.break : null;
}

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate,

  testRunner: "command",
  commandRunner: {
    command: `vp build && ${testCommand}`,
  },
  coverageAnalysis: "off",

  // Stryker's sandbox preprocessor calls the removed
  // `ts.parseConfigFileTextToJson` API against whatever `tsconfigFile`
  // resolves to (default "tsconfig.json") on every sandboxed run, which
  // crashes under typescript@7 (see js/formula1.ts-era note: the whole TS7
  // programmatic API was dropped, only `tsc` CLI ships now). We don't use
  // the `@stryker-mutator/typescript-checker` plugin (coverageAnalysis is
  // "off" and there's no `checkers` entry below), so nothing else reads
  // this option — point it at a file that doesn't exist so the sandbox
  // preprocessor's existence guard (`project.files.get(...)`) short-circuits
  // and skips the broken rewrite entirely.
  tsconfigFile: "tsconfig.stryker-disabled.json",

  // Isolated sandboxes only; never mutate the caller's working tree.
  // Default 4 matches the concurrency this repo's existing measured
  // baselines (CRITICAL_BREAK_THRESHOLD above, the timeout-storm diagnosis
  // itself) were taken at, so running with no overrides reproduces exactly
  // what was measured. 8-way concurrency was also measured safe on an
  // 18-logical-core host once TEST_RUNNER_MAX_WORKERS caps each invocation
  // (see that const's comment) — override via STRYKER_CONCURRENCY on a host
  // with cores to spare. Keep TEST_RUNNER_MAX_WORKERS * concurrency
  // comfortably under the host's logical core count.
  concurrency: parsePositiveInt(process.env.STRYKER_CONCURRENCY, 4),

  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: `reports/mutation/${scopeLabel}/index.html` },
  jsonReporter: { fileName: `reports/mutation/${scopeLabel}/mutation.json` },

  thresholds: {
    high: 90,
    low: 70,
    break: isCriticalScope ? CRITICAL_BREAK_THRESHOLD : target ? measuredBreakFor(target) : null,
  },

  // Formula RATE solver can take a few hundred ms, so keep headroom.
  timeoutMS: 60000,
  timeoutFactor: 2,

  incremental: true,
  incrementalFile: `.stryker-tmp/incremental-${scopeLabel}.json`,
  tempDirName: ".stryker-tmp",

  logLevel: "info",
  fileLogLevel: "trace",

  ignorePatterns: ["node_modules", "dist", "coverage", "reports", ".stryker-tmp", "images", ".git"],
};
