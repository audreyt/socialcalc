import { defineConfig } from "vite-plus";

import { socialCalcBuildInput, socialCalcBuildPlugin } from "./build";
import { thresholdContract } from "./coverage-thresholds.mjs";

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: false,
    rolldownOptions: {
      input: socialCalcBuildInput,
    },
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      denyWarnings: true,
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: [socialCalcBuildPlugin()],
  test: {
    coverage: {
      // Shared shipping coverage contract: same exclude/thresholds as the
      // merged unit+browser gate in scripts/merge-browser-coverage.mjs
      // (both import {@link thresholdContract}), so the unit-only Vitest gate
      // and the merged gate can never drift. See coverage-thresholds.ts for
      // the rationale and the honest measured baseline.
      //
      // NOTE: `coverage.include` is intentionally NOT set here — Vitest
      // treats `coverage.include` as a filter on which source files to
      // count coverage for. The shipping gate counts js/*.ts only BECAUSE
      // `coverage.exclude` drops test/lemma/scripts and only js/*.ts is ever
      // loaded into a Script during tests. Setting `coverage.include` would
      // silently re-include js/*.ts (no effect) or, if set wrong
      // (e.g. `test/**`), zero out every source file's coverage.
      exclude: thresholdContract.exclude,
      // `json` writes coverage-final.json (Istanbul format), which
      // scripts/merge-browser-coverage.mjs reads back to merge with Chromium's
      // V8 coverage. `text`/`lcov` give the visible unit-only report.
      reporter: ["text", "lcov", "json"],
      thresholds: {
        statements: thresholdContract.global.statements,
        branches: thresholdContract.global.branches,
        functions: thresholdContract.global.functions,
        lines: thresholdContract.global.lines,
        ...Object.fromEntries(
          Object.entries(thresholdContract.perFile).map(([file, t]) => [
            file,
            {
              statements: t.statements,
              branches: t.branches,
              functions: t.functions,
              lines: t.lines,
            },
          ]),
        ),
      },
    },
    include: ["test/**/*.test.ts"],
  },
});
