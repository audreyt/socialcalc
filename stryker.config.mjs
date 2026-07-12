// Stryker mutation-testing config.
//
// Two modes:
//
// 1. Full sandbox run (`vp run mutate`) — Stryker copies the project into
//    parallel sandboxes and mutates everything in the `mutate` list. Slow
//    but isolated; run it once overall coverage/mutation scores look good.
//
// 2. In-place single-file iteration (`vp run mutate:file <path>`) — the
//    helper sets MUTATE_TESTS to the subset of test files that exercise the
//    target module, flips Stryker to inPlace mode, and uses concurrency=1.
//    This is the fast loop you run during development.
//
// Speed math: a filtered test run is milliseconds vs ~7 s for the full suite.
// With a ~30 ms Vite+ rebuild per mutant, inPlace iteration keeps feedback
// tight even for a 50-line slice.

const testsFilter = process.env.MUTATE_TESTS?.trim();
const inPlace = process.env.MUTATE_IN_PLACE === "1";

const testCommand = testsFilter ? `vp test run ${testsFilter}` : "vp test";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    "js/formatnumber2.ts",
    "js/formula1.ts",
    "js/socialcalc-3.ts",
    "js/socialcalctableeditor.ts",
    "js/socialcalcpopup.ts",
    "js/socialcalcspreadsheetcontrol.ts",
    "js/socialcalcviewer.ts",
  ],

  testRunner: "command",
  commandRunner: {
    command: `vp build && ${testCommand}`,
  },
  coverageAnalysis: "off",

  // inPlace mode skips the per-mutant sandbox copy (node_modules + all
  // assets). Required for fast iteration. Safe because the helper reverts
  // source files after each mutant and we don't leak state across test
  // processes.
  inPlace,

  // With inPlace there's only one working copy, so concurrency must be 1.
  concurrency: inPlace ? 1 : 4,

  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },

  thresholds: { high: 90, low: 70, break: null },

  // Formula RATE solver can take a few hundred ms, so keep headroom.
  timeoutMS: 60000,
  timeoutFactor: 2,

  incremental: true,
  incrementalFile: ".stryker-tmp/incremental.json",
  tempDirName: ".stryker-tmp",

  logLevel: "info",
  fileLogLevel: "trace",

  ignorePatterns: ["node_modules", "dist", "coverage", "reports", ".stryker-tmp", "images", ".git"],

  mutator: {
    excludedMutations: [
      // User-facing strings churn with no behavioural signal.
      "StringLiteral",
      // Date/format regex mutants generate near-equivalent behaviours
      // on our inputs; leave the regex path alone.
      "Regex",
    ],
  },
};
