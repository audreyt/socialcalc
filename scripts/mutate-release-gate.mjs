#!/usr/bin/env node
// Release gate for the full (all-11-module) mutation scope: refuses to pass
// unless EVERY module in ALL_MUTATE_FILES (stryker-file.mjs) has both (a) a
// registered, actually-measured baseline in stryker-mutation-baseline.json
// (measured:true with a finite break number in the 0..100 range — never a
// placeholder) and (b) a fresh mutation.json from this run whose score meets
// that registered floor. A missing report, a missing/false/malformed baseline,
// an empty report, and a score below its floor are all hard failures —
// "report-only" is not "passing", and 80 is never used as a stand-in for
// evidence. Never treat an unmeasured/guessed number as evidence.
//
// Looks for each module's fresh report at, in order:
//   <MUTATION_ARTIFACTS_DIR or "artifacts">/mutation-report-<slug>/mutation.json
//     (matches .github/workflows/mutation.yml's mutate-full upload naming +
//     the release-gate job's download-artifact step, for CI)
//   reports/mutation/<slug>/mutation.json
//     (matches `bun run mutate:all`'s local sequential layout)
//
// Usage: vp node scripts/mutate-release-gate.mjs

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_MUTATE_FILES } from "../stryker-file.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, "..", "stryker-mutation-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

// The registry must exactly track ALL_MUTATE_FILES — no silently-omitted
// module, no stale leftover entry for a module that no longer exists.
const registered = new Set(Object.keys(baseline.modules));
const expected = new Set(ALL_MUTATE_FILES);
const missingFromRegistry = ALL_MUTATE_FILES.filter((f) => !registered.has(f));
const staleInRegistry = [...registered].filter((f) => !expected.has(f));
if (missingFromRegistry.length > 0 || staleInRegistry.length > 0) {
  console.error("stryker-mutation-baseline.json is out of sync with stryker-file.mjs's ALL_MUTATE_FILES:");
  if (missingFromRegistry.length > 0) console.error(`  missing entries: ${missingFromRegistry.join(", ")}`);
  if (staleInRegistry.length > 0) console.error(`  stale entries: ${staleInRegistry.join(", ")}`);
  process.exit(1);
}

const artifactsDir = process.env.MUTATION_ARTIFACTS_DIR?.trim() || "artifacts";

function reportPathFor(slug) {
  const ciPath = join(artifactsDir, `mutation-report-${slug}`, "mutation.json");
  if (existsSync(ciPath)) return ciPath;
  // In CI, never fall back to a checkout-local report: only the artifact
  // downloaded from this run proves that this matrix leg uploaded evidence.
  if (process.env.GITHUB_ACTIONS === "true") return null;
  const localPath = join("reports", "mutation", slug, "mutation.json");
  if (existsSync(localPath)) return localPath;
  return null;
}
function scoreOf(mutationJson) {
  let total = 0;
  let killedLike = 0;
  for (const info of Object.values(mutationJson.files ?? {})) {
    for (const m of info.mutants ?? []) {
      total++;
      if (m.status === "Killed" || m.status === "Timeout") killedLike++;
    }
  }
  return { total, score: total > 0 ? (100 * killedLike) / total : 0 };
}

function validMeasuredBaseline(entry) {
  return (
    entry?.measured === true &&
    typeof entry.break === "number" &&
    Number.isFinite(entry.break) &&
    entry.break >= 0 &&
    entry.break <= 100
  );
}
const rows = [];
let failed = false;

for (const file of ALL_MUTATE_FILES) {
  const slug = basename(file, ".ts");
  const entry = baseline.modules[file];
  const reportPath = reportPathFor(slug);

  if (!reportPath) {
    rows.push({ file, status: "FAIL", detail: "no fresh report found for this run" });
    failed = true;
    continue;
  }
  if (!validMeasuredBaseline(entry)) {
    rows.push({
      file,
      status: "FAIL",
      detail:
        "missing or malformed measured baseline — requires measured:true and a finite numeric break in the 0..100 range; run MUTATE_TARGET=<module> bun run mutate (or bun run mutate:all) and ratchet stryker-mutation-baseline.json before release",
    });
    failed = true;
    continue;
  }

  let mutationJson;
  try {
    mutationJson = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    rows.push({ file, status: "FAIL", detail: `invalid mutation report JSON: ${error.message}` });
    failed = true;
    continue;
  }
  if (!mutationJson || typeof mutationJson.files !== "object" || mutationJson.files === null || Array.isArray(mutationJson.files)) {
    rows.push({ file, status: "FAIL", detail: "invalid mutation report shape: expected a files object" });
    failed = true;
    continue;
  }
  const { total, score } = scoreOf(mutationJson);
  if (total === 0) {
    rows.push({ file, status: "FAIL", detail: "mutation report contains no mutants" });
    failed = true;
    continue;
  }
  const ok = score >= entry.break;
  if (!ok) failed = true;
  rows.push({ file, status: ok ? "PASS" : "FAIL", detail: `${score.toFixed(2)}% (floor ${entry.break}%)` });
}

console.log("Mutation release gate — all 11 shipping modules:\n");
for (const { file, status, detail } of rows) {
  console.log(`${status}  ${file}  ${detail}`);
}

if (failed) {
  console.error(
    "\nRelease gate FAILED: every shipping module needs a real measured baseline, a fresh report from this run, and a score at or above its registered floor before a release tag can proceed.",
  );
  process.exit(1);
}

console.log("\nRelease gate PASSED: all 11 modules measured, reported, and at or above their floor.");
