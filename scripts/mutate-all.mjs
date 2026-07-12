#!/usr/bin/env node
// Sequentially run the full all-11-module mutation gate locally: one
// Stryker process per module in ALL_MUTATE_FILES, each mutating only that
// module against the exact test subset stryker-file.mjs's `testsByFile`
// maps to it (MUTATE_TARGET mode in stryker.config.mjs — the same mode
// .github/workflows/mutation.yml's `mutate-full` matrix job runs, one
// module per parallel CI leg). Sequential here so a single machine doesn't
// need to run 11 processes at once; still far faster than the legacy
// mutate-everything-against-the-full-suite mode, since each module here
// only pays for its own test subset, not the whole suite.
//
// Usage: vp node scripts/mutate-all.mjs
//
// Runs every module even after an earlier one fails (so a single pass
// always yields every module's report/score, not just the first failure),
// then exits non-zero if any module's mutation score is below its break
// threshold.

import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { ALL_MUTATE_FILES } from "../stryker-file.mjs";

const results = [];

for (const file of ALL_MUTATE_FILES) {
  const label = basename(file, ".ts");
  console.log(`\n=== mutate:all — ${file} (reports/mutation/${label}/) ===\n`);

  const { status } = spawnSync("vp", ["exec", "stryker", "run"], {
    stdio: "inherit",
    env: { ...process.env, MUTATE_TARGET: file },
  });

  results.push({ file, label, status: status ?? 1 });
}

console.log("\n=== mutate:all summary ===");
let failed = false;
for (const { file, label, status } of results) {
  const ok = status === 0;
  failed = failed || !ok;
  console.log(`${ok ? "PASS" : "FAIL"}  ${file}  (reports/mutation/${label}/, exit ${status})`);
}

process.exit(failed ? 1 : 0);
