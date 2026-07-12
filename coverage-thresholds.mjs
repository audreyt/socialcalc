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
 * @property {FileThresholds} global Global floor (applies to the union of
 *   every covered file).
 * @property {Record<string, FileThresholds>} perFile Per-file floors, keyed by
 *   path relative to the repo root.
 */

// Honest js/*.ts-only baseline (lemma/*.ts and scripts/** excluded) measured
// on current harden/integration (3956b52) with
// `SOCIALCALC_COVERAGE=1 vp build --minify && vp test --coverage`
// (2026-07-12). Floors sit just below that deterministic run so a real
// regression fails while normal scheduling noise does not.
//
// The merged unit+browser gate (scripts/merge-browser-coverage.mjs) enforces
// this SAME contract on the merged result; the unit-only Vitest gate uses it
// via v8 coverage. Browser coverage can only ever raise these, never lower
// them — so a regression caught by Vitest alone still fails the same floor.
export const thresholdContract = /** @type {ThresholdContract} */ ({
  exclude: ["test/**", "lemma/**", "scripts/**"],
  include: ["test/**/*.test.ts"],
  global: {
    statements: 98,
    branches: 80,
    functions: 98,
    lines: 98,
  },
  perFile: {
    "js/formatnumber2.ts": { statements: 98, branches: 85, functions: 100, lines: 98 },
    "js/socialcalc-3.ts": { statements: 98, branches: 79, functions: 99, lines: 98 },
    "js/formula1.ts": { statements: 98, branches: 83, functions: 98, lines: 98 },
    "js/formula-ref.ts": { statements: 99, branches: 75, functions: 99, lines: 99 },
    "js/formula-parse.ts": { statements: 98, branches: 88, functions: 100, lines: 98 },
    "js/formula-operand.ts": { statements: 97, branches: 75, functions: 100, lines: 97 },
    "js/socialcalcconstants.ts": { statements: 100, branches: 95, functions: 100, lines: 100 },
  },
});

/** Istanbul reporters the merge step emits (unit+browser union). */
export const mergedReporters = ["text", "lcov", "html", "json", "json-summary"];
