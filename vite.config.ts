import { defineConfig } from "vite-plus";

import { socialCalcBuildInput, socialCalcBuildPlugin } from "./build";
import { thresholdContract } from "./coverage-thresholds.mjs";

const v8Mode = process.env.SOCIALCALC_COVERAGE === "1";
const istanbulMode = !v8Mode;
if (istanbulMode) process.env.SOCIALCALC_COVERAGE_ISTANBUL = "1";

const focusedTestRun = process.argv.some(
  (argument) =>
    argument === "-t" ||
    argument === "--testNamePattern" ||
    argument === "--test-name-pattern" ||
    argument === "--changed" ||
    argument.startsWith("--changed=") ||
    argument === "--shard" ||
    argument.startsWith("--shard=") ||
    /(?:^|[/\\])(?:test|e2e)[/\\].+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(argument),
);

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: false,
    rolldownOptions: {
      input: socialCalcBuildInput,
    },
  },
  fmt: {},
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
    coverage: istanbulMode
      ? {
          // The default gate uses source counters injected into a fresh UMD by
          // test/global-setup.ts. SocialCalc is a vm.Script-loaded global
          // script, so Vitest cannot instrument the shipping sources through
          // its normal module transform.
          enabled: !focusedTestRun,
          provider: "istanbul" as const,
          include: ["js/**/*.ts", "lemma/**/*.ts"],
          exclude: ["test/**", "dist/**", "**/*.d.ts", "**/*.lean", "**/*.dfy", "**/*.mjs"],
          reporter: ["text", "lcov"],
          thresholds: {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
          },
        }
      : {
          // Explicit SOCIALCALC_COVERAGE=1 retains the V8+sourcemap diagnostic
          // and the shared shipping threshold contract used by merged browser
          // coverage. JSON is required by merge-browser-coverage.mjs.
          exclude: thresholdContract.exclude,
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
    globalSetup: istanbulMode ? ["./test/global-setup.ts"] : undefined,
    include: ["test/**/*.test.ts"],
  },
});
