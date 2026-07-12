import { defineConfig } from "vite-plus";

import { socialCalcBuildInput, socialCalcBuildPlugin } from "./build";

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
      // lemma/*.ts is a separate LemmaScript formal-verification facade
      // (tested independently, never baked into dist/SocialCalc.js) — the
      // shipping-coverage gate below measures only js/*.ts, the sources
      // that are actually concatenated into the shipped bundle.
      exclude: ["test/**", "lemma/**"],
      reporter: ["text", "lcov"],
      // Honest js/*.ts-only baseline (lemma/*.ts excluded above, since it
      // never ships in dist/SocialCalc.js) measured on tracked tests with
      // `SOCIALCALC_COVERAGE=1 vp build` (2026-07-12). Set at-or-just-below
      // that measurement (not an aspirational round number) so a real
      // regression fails the gate; re-measure and raise deliberately as
      // coverage improves. Per-file entries cover every module
      // package.json's mutate:*/Stryker scripts already treat as critical
      // (formatnumber2.ts, socialcalc-3.ts, formula1.ts) plus the formula
      // parser/evaluator support modules and the constants module.
      thresholds: {
        statements: 78,
        branches: 66,
        functions: 63,
        lines: 78,
        "js/formatnumber2.ts": { statements: 86, branches: 71, functions: 85, lines: 86 },
        "js/socialcalc-3.ts": { statements: 85, branches: 72, functions: 72, lines: 85 },
        "js/formula1.ts": { statements: 76, branches: 63, functions: 74, lines: 76 },
        "js/formula-ref.ts": { statements: 78, branches: 64, functions: 75, lines: 77 },
        "js/formula-parse.ts": { statements: 70, branches: 67, functions: 85, lines: 70 },
        "js/formula-operand.ts": { statements: 71, branches: 53, functions: 60, lines: 71 },
        "js/socialcalcconstants.ts": { statements: 100, branches: 75, functions: 100, lines: 100 },
      },
    },
    include: ["test/**/*.test.ts"],
  },
});
