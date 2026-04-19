#!/usr/bin/env bun
// Run Stryker against a single source file. Useful when iterating on one
// module at a time — otherwise a full run mutates all ~27k lines and can take
// hours.
//
// Usage: bun run mutate:file js/formatnumber2.js

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const target = process.argv[2];
if (!target) {
    console.error("usage: bun run mutate:file <path/to/source.js>");
    process.exit(2);
}

const absolute = resolve(target);
const child = spawn(
    "bunx",
    [
        "stryker",
        "run",
        "--mutate",
        absolute,
        // Scope the incremental file per target so different files don't
        // invalidate each other's cached results.
        "--incrementalFile",
        `.stryker-tmp/incremental-${target.replace(/[^a-z0-9]+/gi, "_")}.json`,
    ],
    {
        stdio: "inherit",
        env: process.env,
    },
);

child.on("exit", (code) => {
    process.exit(code ?? 1);
});
