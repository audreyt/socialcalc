// Stryker mutation-testing config.
//
// Two modes:
//
// 1. Full sandbox run (`bun run mutate`) — Stryker copies the project into
//    parallel sandboxes and mutates everything in the `mutate` list. Slow
//    but isolated; run it once overall coverage/mutation scores look good.
//
// 2. In-place single-file iteration (`bun run mutate:file <path>`) — the
//    helper sets MUTATE_TESTS to the subset of test files that exercise the
//    target module, flips Stryker to inPlace mode, and uses concurrency=1.
//    This is the fast loop you run during development.
//
// Speed math: a filtered test run is ~20 ms vs ~12 s for the full suite.
// With a ~400 ms rebuild per mutant, inPlace iteration on formatnumber2.js
// (~93 mutants in a 50-line slice) finishes in well under a minute.

const testsFilter = process.env.MUTATE_TESTS?.trim();
const inPlace = process.env.MUTATE_IN_PLACE === "1";

const testCommand = testsFilter
    ? `bun test ${testsFilter}`
    : "bun test";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
    mutate: [
        "js/formatnumber2.js",
        "js/formula1.js",
        "js/socialcalc-3.js",
        "js/socialcalctableeditor.js",
        "js/socialcalcpopup.js",
        "js/socialcalcspreadsheetcontrol.js",
        "js/socialcalcviewer.js",
    ],

    testRunner: "command",
    commandRunner: {
        command: `bun run build.ts && ${testCommand}`,
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

    ignorePatterns: [
        "node_modules",
        "dist",
        "coverage",
        "reports",
        ".stryker-tmp",
        "images",
        ".git",
    ],

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
