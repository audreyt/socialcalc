// Shared coverage thresholds + filtering contract for the SocialCalc shipping
// coverage gate. Imported by both `vite.config.ts` (so Vitest's
// `vp test --coverage` enforces the SAME threshold on the unit-only result) and
// `scripts/merge-browser-coverage.mjs` (so the merged unit+browser result
// enforces the SAME threshold, with no duplicated copy that can drift).
//
// Plain `.mjs` (not `.ts`) on purpose: the merge script is plain Node (no Vite
// transform, no tsx), so it can only `import` a module Node understands
// natively. Both consumers import THIS file as the single source of truth.
//
// Type-checked at compile time by `coverage-thresholds.d.ts` (interface shapes
// for `vite.config.ts`'s `vendor.config.test.coverage.thresholds` consumer).

/**
 * Per-file threshold floor. Applied to the merged result; the unit-only
 * Vitest gate applies the same numbers via `vendor.config.test.coverage`.
 *
 * @typedef {Object} FileThresholds
 * @property {number} statements
 * @property {number} branches
 * @property {number} functions
 * @property {number} lines
 */

/**
 * The whole shipping-gate contract.
 *
 * @typedef {Object} ThresholdContract
 * @property {string[]} exclude Coverage exclude globs (applied to both Vitest
 *   and merged browser coverage).
 * @property {string[]} include Vitest test-file discovery globs (NOT a
 *   coverage filter — see vite.config.ts for why `coverage.include` must stay
 *   unset).
 * @property {FileThresholds} global Global floor for the UNIT-ONLY gate
 *   (`vite.config.ts`, `vp test --coverage`). Applies to the union of every
 *   covered file measured from Vitest/Istanbul coverage alone.
 * @property {FileThresholds} mergedGlobal Global floor for the MERGED
 *   unit+browser gate (`scripts/merge-browser-coverage.mjs` only — never
 *   imported by `vite.config.ts`). Kept as a SEPARATE field, not shared with
 *   `global`, because Chromium coverage soundly raises branch coverage well
 *   above what unit tests alone can reach (real click/keyboard/layout paths
 *   FakeDocument's shim never drives) — a single shared branch floor honest
 *   enough for the merged result would fail the unit-only gate before any
 *   browser coverage ever runs. `statements`/`functions`/`lines` are
 *   identical to `global` here (unit-only already clears 98 on those three;
 *   merged can only raise them further per `assertMonotonic`, so one shared
 *   value is safe) — only `branches` diverges.
 * @property {Record<string, FileThresholds>} perFile Per-file floors, keyed
 *   by path relative to the repo root. Shared between both gates — every
 *   value here is bounded by what the UNIT-ONLY run alone measures, so it
 *   never needs a merged-only variant the way the global branch floor does.
 */

// Honest js/*.ts-only baseline (lemma/*.ts and scripts/** excluded) measured
// on current harden/integration (3956b52) with
// `SOCIALCALC_COVERAGE=1 vp build --minify && vp test --coverage`
// (2026-07-12). Floors sit just below that deterministic run so a real
// regression fails while normal scheduling noise does not.
//
// The merged unit+browser gate (scripts/merge-browser-coverage.mjs) enforces
// `mergedGlobal` (below) instead of `global` for its global floor — see that
// field's doc comment. Per-file floors and the unit-only global floor are
// shared between both gates; browser coverage can only ever raise those,
// never lower them, so a regression caught by Vitest alone still fails the
// same floor.
export const thresholdContract = /** @type {ThresholdContract} */ ({
  exclude: ["test/**", "lemma/**", "scripts/**"],
  include: ["test/**/*.test.ts"],
  global: {
    statements: 98,
    branches: 80,
    functions: 98,
    lines: 98,
  },
  // Merged (unit + Chromium V8) global floor, re-measured 2026-07-12 on this
  // branch's `test:coverage:merged` run: 98.75/84.6X/98.95/98.86 stmts/
  // branches/funcs/lines. `branches` floored to the honest integer (84,
  // matching how the other three metrics are already floored to 98) instead
  // of staying at the stale unit-only value (80) inherited from before this
  // pipeline could measure real browser branch coverage at all.
  mergedGlobal: {
    statements: 98,
    branches: 84,
    functions: 98,
    lines: 98,
  },
  perFile: {
    // Re-measured 2026-07-14 after removing documented unreachable branches:
    // format branches 84.83%; formula1 functions 97.97%.
    // Re-measured 2026-07-20 after the July 18–19 formula expansion:
    // formula1 V8 branches were 3168/3858 (82.115%). All misses are
    // ast-v8-to-istanbul 1.0.4 synthetic absent-alternates for no-else guards
    // (locations[1] empty); demonstrated false paths cannot credit them under
    // the full-suite gate. The prior integer floor 82 rested on that
    // nondeterministic synthetic-arm attribution with only four covered-arm
    // slots of headroom — release run 29817081561 and local full-suite
    // re-measures landed at 81.88–81.91% (3159–3160/3858) with zero
    // real-location uncovered arms (evidence: location arm-diff vs the 3168
    // baseline + false-path probe; /tmp/formula1-structural-coverage-finding.json).
    // Honest measured low-water mark: Math.floor(81.88) = 81. Shared unit+merged
    // per-file entry (browser can only raise branches per assertMonotonic).
    "js/formatnumber2.ts": { statements: 98, branches: 84, functions: 100, lines: 98 },
    "js/socialcalc-3.ts": { statements: 98, branches: 79, functions: 99, lines: 98 },
    "js/formula1.ts": { statements: 98, branches: 81, functions: 97, lines: 98 },
    // formula-ref branches ratcheted 75 -> 76 (2026-07-12): unit-only measures 76.11%,
    // the prior 75 floor was stale slack, not volatility headroom.
    "js/formula-ref.ts": { statements: 99, branches: 76, functions: 99, lines: 99 },
    "js/formula-parse.ts": { statements: 98, branches: 88, functions: 100, lines: 98 },
    "js/formula-operand.ts": { statements: 97, branches: 75, functions: 100, lines: 97 },
    "js/socialcalcconstants.ts": { statements: 100, branches: 95, functions: 100, lines: 100 },
  },
});

/** Istanbul reporters the merge step emits (unit+browser union). */
export const mergedReporters = ["text", "lcov", "html", "json", "json-summary"];
