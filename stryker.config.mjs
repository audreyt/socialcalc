// Stryker mutation-testing config.
//
// Strategy: mutate the individual js/*.js source files, rebuild the bundle,
// then run bun test. Each surviving mutant points at a behaviour the test
// suite does not pin down — that becomes a line to add a meaningful test for.
//
// Note on scale: this codebase is ~27k legacy lines. A single full run can
// produce thousands of mutants and take hours. Use `bun run mutate:file
// js/formatnumber2.js` to iterate on one module at a time during development,
// then `bun run mutate` for a full pass when closing in on 100%.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
    // Stryker drives the run via Node; Bun handles the build and the tests.
    packageManager: "npm",

    // What we mutate. Wrapper fragments don't parse in isolation, and the
    // constants file is pure data — no branches to mutate.
    mutate: [
        "js/formatnumber2.js",
        "js/formula1.js",
        "js/socialcalc-3.js",
        "js/socialcalctableeditor.js",
        "js/socialcalcpopup.js",
        "js/socialcalcspreadsheetcontrol.js",
        "js/socialcalcviewer.js",
    ],

    // We don't have a Stryker plugin for Bun, so run the tests via a generic
    // command. The build step re-concatenates the mutated source into
    // dist/SocialCalc.js before the test runner loads it.
    testRunner: "command",
    commandRunner: {
        command: "bun run build.ts && bun test",
    },

    // 'off' is required with the command runner — per-test coverage data is
    // only produced by the native test-runner plugins.
    coverageAnalysis: "off",

    // Reports.
    reporters: ["clear-text", "progress", "html", "json"],
    htmlReporter: { fileName: "reports/mutation/index.html" },
    jsonReporter: { fileName: "reports/mutation/mutation.json" },

    // Pass/fail thresholds. `break: null` means the run never exits non-zero
    // on score alone; CI should look at the score itself.
    thresholds: { high: 90, low: 70, break: null },

    // Run several bun-test processes in parallel. Bun tests are fast; the
    // bottleneck is the sandbox copy. Tune to taste.
    concurrency: 4,

    // Stryker's built-in timeout-factor + timeout-ms. A few functions in
    // formula1.js (RATE solver) can take a few hundred ms, so give headroom.
    timeoutMS: 60000,
    timeoutFactor: 2,

    // Incremental mode remembers per-mutant outcomes between runs, so after
    // you add a killing test you only re-run the mutants whose status could
    // have changed.
    incremental: true,
    incrementalFile: ".stryker-tmp/incremental.json",

    tempDirName: ".stryker-tmp",

    // Stryker prints one line per mutant with `clear-text`; keep the console
    // readable by hiding the per-file detail until the end.
    logLevel: "info",
    fileLogLevel: "trace",

    // Ignore everything the sandbox doesn't need so each mutant run copies
    // less data.
    ignorePatterns: [
        "node_modules",
        "dist",
        "coverage",
        "reports",
        ".stryker-tmp",
        "images",
        ".git",
    ],

    // Don't let Stryker mutate the test suite itself.
    ignoredByWatchPlugin: ["test"],

    // Default mutators are fine for plain JS; opt out of a few that churn out
    // mutants with low signal for this codebase.
    mutator: {
        excludedMutations: [
            // "StringLiteral" would flip every user-facing label; we're not
            // testing display strings exhaustively.
            "StringLiteral",
            // "Regex" churns a lot of date/format regex variants that all
            // produce equivalent behaviour on our test inputs.
            "Regex",
        ],
    },
};
