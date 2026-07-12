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
//    — mutates only CRITICAL_FILES (the 4 modules with the tightest
//    correctness bar: formula lexer/parser, operand-stack coercions,
//    formula-reference rewrite algebra, and the constants/style bag every
//    UI surface reads) against the deterministic union of their
//    `testsByFile` subsets. Small, fast, and reproducible enough to gate a
//    PR. Non-null break threshold (CRITICAL_BREAK_THRESHOLD below, set to
//    the actual measured floor — see the measurement note below, not a
//    guess). Reports go to `reports/mutation/critical/`.
//
// 3. In-place single-file iteration (`vp run mutate:file <path>`) — the
//    stryker-file.mjs helper sets MUTATE_TESTS to the subset of test files
//    that exercise the target module, flips Stryker to inPlace mode, and
//    uses concurrency=1. This is the fast loop you run during development;
//    no break threshold (dev loop, not a gate).
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
// Speed math: a filtered test run is milliseconds vs ~7 s for the full suite.
// With a ~30 ms Vite+ rebuild per mutant, inPlace iteration keeps feedback
// tight even for a 50-line slice.

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
// most likely to silently corrupt sheet math through — plus the constants
// bag (socialcalcconstants.ts) every other shipping module reads for
// default styles/strings/behaviour flags.
const CRITICAL_FILES = [
  "js/formula-parse.ts",
  "js/formula-operand.ts",
  "js/formula-ref.ts",
  "js/socialcalcconstants.ts",
];

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

const inPlace = process.env.MUTATE_IN_PLACE === "1";

const testCommand = testsFilter ? `vp test run ${testsFilter}` : "vp test";

// Scope label used to namespace reports/ and the incremental cache so
// critical/per-file/legacy-full runs never clobber or cross-pollinate each
// other's state.
const scopeLabel = isCriticalScope ? "critical" : target ? basename(target, ".ts") : "full";

// Measured 2026-07-12 on the 4-file critical scope (js/formula-parse.ts,
// formula-operand.ts, formula-ref.ts, socialcalcconstants.ts) against the
// deterministic 31-file `criticalTests` union, sandboxed, concurrency 4, NO
// mutator exclusions (StringLiteral/Regex mutants are real, observable
// behaviour — see stryker-mutation-disposition.json's header for why a
// blanket exclusion was rejected). This is the only figure this file
// asserts as fact; a prior draft claimed a 97.42%/33-survivors rerun whose
// "5 additional survivors addressed with tests" was never actually
// re-verified against a fresh run — that claim is retracted, do not repeat
// it.
//
// Actual fresh measurement:
//   2119 tested, 1405 killed, 95 timeout, 619 survived => 70.79% score.
//   Per-file: formula-parse.ts 97.33% (17 survived), formula-operand.ts
//   91.99% (27 survived), formula-ref.ts 94.22% (27 survived),
//   socialcalcconstants.ts 19.29% (548 survived, all StringLiteral).
//
//   stryker-mutation-disposition.json documents 28 mutants (confined to the
//   3 formula-*.ts files) as reviewed and behaviorally equivalent; 26 of
//   those still show Survived in this run (expected — equivalence means no
//   test *can* kill them) and 2 now show Killed (an incidental kill from a
//   broader test addition; the equivalence reasoning is unaffected, they're
//   simply no longer counted as survivors either way).
//
//   socialcalcconstants.ts's 548 survivors are ALL StringLiteral mutants on
//   the CSS-class/format/default-style string literals that make up most of
//   that ~1000-line file — a large data table, not control flow. Almost
//   nothing in the current suite asserts the actual string VALUE of these
//   constants (tests assert downstream behaviour, which mutating a class
//   name to "" mostly doesn't observably break today). This is a real,
//   substantial coverage gap confirmed by inspecting the survivor list
//   directly — not an artifact of exclusions or test filtering, and not yet
//   reviewed for equivalence. Closing it needs deliberate literal-value
//   assertions added file by file; out of scope for this pass and tracked
//   honestly via the threshold below rather than hidden.
//
// Critical break threshold is set to 70 — the measured integer floor of the
// 70.79% score above, not a guessed/aspirational number. Ratchet this up as
// socialcalcconstants.ts's survivors get real tests (that file alone caps
// the achievable score; the other three are already at 92%+).
//
// Per-module (MUTATE_TARGET) and legacy full-sandbox break threshold: looked
// up from stryker-mutation-baseline.json rather than a flat guessed number.
// A module the registry marks `measured: false` (every one of the 11 today
// — none has yet been run under this per-file, no-exclusion config; the
// critical-scope run above tested formula-parse/operand/ref/constants
// against a WIDER union test set than each file's own testsByFile mapping,
// so it isn't directly reusable as that module's per-file floor either)
// gets `break: null` — Stryker still runs and scores it, it just can't
// fail the build on a number nobody measured. formula1.ts, socialcalc-3.ts
// (including its SafeUrlForRender/EscapeUntrustedHtml security surface —
// see README's "Trust boundary and host security"), and formatnumber2.ts
// are covered by this same per-file matrix rather than a separate release
// scope: the matrix runs on `push: tags: v*`, so a release tag exercises
// all 11 modules including the 3 named above — but
// scripts/mutate-release-gate.mjs still refuses to let that tag's release
// proceed until every module has flipped to `measured: true` with a real,
// passing score; an unmeasured module blocks a release exactly like a
// regressed one.
const CRITICAL_BREAK_THRESHOLD = 70;

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
  // resolves to (default "tsconfig.json") on every non-inPlace run, which
  // crashes under typescript@7 (see js/formula1.ts-era note: the whole TS7
  // programmatic API was dropped, only `tsc` CLI ships now). We don't use
  // the `@stryker-mutator/typescript-checker` plugin (coverageAnalysis is
  // "off" and there's no `checkers` entry below), so nothing else reads
  // this option — point it at a file that doesn't exist so the sandbox
  // preprocessor's existence guard (`project.files.get(...)`) short-circuits
  // and skips the broken rewrite entirely, in both sandboxed and inPlace
  // (which already returns before touching this) modes.
  tsconfigFile: "tsconfig.stryker-disabled.json",

  // inPlace mode skips the per-mutant sandbox copy (node_modules + all
  // assets). Required for fast iteration. Safe because the helper reverts
  // source files after each mutant and we don't leak state across test
  // processes.
  inPlace,

  // With inPlace there's only one working copy, so concurrency must be 1.
  concurrency: inPlace ? 1 : 4,

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
