// Types for `coverage-thresholds.mjs`, used by `vite.config.ts` and
// `scripts/merge-browser-coverage.ts` to get compile-time-shaped access to the
// threshold contract. The runtime data lives in the `.mjs` (single source of
// truth) so plain-Node scripts can `import` it without a TS transform.

export interface FileThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface ThresholdContract {
  /** Coverage exclude globs (applied to both Vitest and merged coverage). */
  exclude: string[];
  /** Vitest test-file discovery globs (NOT a coverage filter). */
  include: string[];
  /** Global floor for the unit-only gate (`vite.config.ts`). */
  global: FileThresholds;
  /**
   * Global floor for the merged unit+browser gate
   * (`scripts/merge-browser-coverage.mjs` only). Kept separate from `global`
   * because merged branch coverage sits well above what unit tests alone can
   * reach; see `coverage-thresholds.mjs` for the full rationale.
   */
  mergedGlobal: FileThresholds;
  /** Per-file floors, keyed by path relative to the repo root. */
  perFile: Record<string, FileThresholds>;
}

/** Istanbul reporters the merge step emits (unit+browser union). */
export declare const mergedReporters: readonly ["text", "lcov", "html", "json", "json-summary"];

export declare const thresholdContract: ThresholdContract;
