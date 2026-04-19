#!/usr/bin/env bun
// Run Stryker against a single source file in fast in-place mode.
//
// Usage: bun run mutate:file <path/to/source.js> [startLine-endLine]
//
// Maps each source file to its relevant test subset so a mutant only has to
// run the ~100 tests that exercise that module, not all 315.

import { spawn } from "node:child_process";
import { resolve, relative, basename } from "node:path";
import { existsSync } from "node:fs";

const [, , rawTarget, range] = process.argv;

if (!rawTarget) {
    console.error(
        "usage: bun run mutate:file <path/to/source.js> [startLine-endLine]",
    );
    process.exit(2);
}

const absolute = resolve(rawTarget);
if (!existsSync(absolute)) {
    console.error(`no such file: ${absolute}`);
    process.exit(2);
}

// Tests that exercise each source module. Keep in sync with the coverage
// ownership mapping in CLAUDE.md / README if one is added later.
const testsByFile = {
    "formatnumber2.js": [
        "test/format-coverage.test.ts",
        "test/formatting.test.ts",
    ],
    "formula1.js": [
        "test/formula-coverage.test.ts",
        "test/formula.test.ts",
    ],
    "socialcalc-3.js": [
        "test/sheet-coverage.test.ts",
        "test/core.test.ts",
    ],
    "socialcalctableeditor.js": ["test/ui-coverage.test.ts"],
    "socialcalcpopup.js": ["test/ui-coverage.test.ts"],
    "socialcalcspreadsheetcontrol.js": ["test/ui-coverage.test.ts"],
    "socialcalcviewer.js": ["test/ui-coverage.test.ts"],
};

const tests = testsByFile[basename(absolute)];
if (!tests) {
    console.error(
        `no test mapping for ${basename(absolute)}. Add one to stryker-file.mjs.`,
    );
    process.exit(2);
}

const relativeTarget = relative(process.cwd(), absolute);
const mutateSpec = range ? `${relativeTarget}:${range}` : relativeTarget;

// Incremental file keyed per target so iterating on one file does not
// invalidate cached mutants for others.
const incrementalFile = `.stryker-tmp/incremental-${basename(absolute)}.json`;

const child = spawn(
    "bunx",
    [
        "stryker",
        "run",
        "--mutate",
        mutateSpec,
        "--incrementalFile",
        incrementalFile,
    ],
    {
        stdio: "inherit",
        env: {
            ...process.env,
            MUTATE_IN_PLACE: "1",
            MUTATE_TESTS: tests.join(" "),
        },
    },
);

child.on("exit", (code) => {
    process.exit(code ?? 1);
});
