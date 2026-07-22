#!/usr/bin/env node
// @ts-nocheck
// Static, deterministic release-safety assertions for the reusable mutation
// workflow and its release.yml caller. This never executes GitHub Actions or
// Stryker; it proves the source/config contracts that make a release fail
// closed when a matrix leg, artifact, baseline, or score is missing.

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";
import {
  ALL_MUTATE_FILES,
  testsByFile,
  MUTATION_SHARDS,
  mutationMatrixLegs,
  validateShardRanges,
} from "../stryker-file.mjs";

const mutationPath = ".github/workflows/mutation.yml";
const releasePath = ".github/workflows/release.yml";
const mutation = readFileSync(mutationPath, "utf8");
const release = readFileSync(releasePath, "utf8");

function jobIf(source, job) {
  const match = source.match(
    new RegExp(`^  ${job}:\\n(?:.*\\n)*?    if: >-\\n((?:      .*\\n)+)`, "m"),
  );
  assert(match, `${job} must have a multiline if expression`);
  return match[1]
    .replace(/^      /gm, "")
    .replace(/\s+$/g, "")
    .replace(/\n/g, " ");
}

const criticalIf = jobIf(mutation, "critical");
const discoverIf = jobIf(mutation, "mutate-discover");
const releaseIf = mutation.match(/^  release-gate:\n(?:.*\n)*?    if: (.+)$/m)?.[1];
assert(releaseIf, "release-gate must have an if expression");

// A called workflow inherits the caller's event_name. Model release.yml's
// tag-push caller explicitly: inputs.scope=full and enforce_release=true.
const releaseCaller = { eventName: "push", scope: "full", enforceRelease: true };
assert.equal(
  releaseCaller.eventName === "pull_request" || releaseCaller.scope === "critical",
  false,
);
assert.equal(releaseCaller.eventName === "schedule" || releaseCaller.scope === "full", true);
assert.equal(releaseCaller.enforceRelease === true, true);
assert.match(criticalIf, /inputs\.scope == 'critical'/);
assert.doesNotMatch(criticalIf, /event_name == 'workflow_call'/);
assert.match(discoverIf, /inputs\.scope == 'full'/);
assert.doesNotMatch(discoverIf, /event_name == 'workflow_call'/);
assert.match(releaseIf, /always\(\) && inputs\.enforce_release == true/);
assert.doesNotMatch(releaseIf, /event_name == 'workflow_call'/);

// The release call is the only tag trigger. A distinct literal concurrency
// prefix prevents the reusable workflow from deadlocking behind its caller.
assert.doesNotMatch(mutation, /^push:\s*$/m);
assert.doesNotMatch(mutation, /^\s+tags:\s*v\*/m);
assert.match(mutation, /^  group: mutation-\$\{\{ github\.ref \}\}$/m);
assert.match(
  release,
  /^\s+mutation:\n\s+name: full mutation testing\n\s+if: github\.ref_type == 'tag'\n\s+uses: \.\/\.github\/workflows\/mutation\.yml\n\s+with:\n\s+scope: full\n\s+enforce_release: true/m,
);

assert.equal(
  (mutation.match(/ref: \$\{\{ github\.sha \}\}/g) ?? []).length,
  4,
  "every mutation job must checkout caller SHA",
);
// ALL_MUTATE_FILES is the single source of truth for modules. Every entry
// must be a real source with at least one real test path, and the baseline
// registry must have exactly the same 13 keys. The matrix expands shards.
assert.equal(
  ALL_MUTATE_FILES.length,
  13,
  "release mutation matrix must cover all 13 shipping modules",
);
const baseline = JSON.parse(readFileSync("stryker-mutation-baseline.json", "utf8"));
assert.deepEqual(
  Object.keys(baseline.modules).sort(),
  [...ALL_MUTATE_FILES].sort(),
  "baseline/module set drift",
);
for (const file of ALL_MUTATE_FILES) {
  assert.ok(existsSync(file), `mutation target missing: ${file}`);
  const tests = testsByFile[file.replace(/^js\//, "")];
  assert.ok(tests?.length, `mutation target has no testsByFile mapping: ${file}`);
  for (const test of tests) assert.ok(existsSync(test), `mapped mutation test missing: ${test}`);
}

// Shard declarations must be complementary whole-file ranges and only cover
// modules that exist in ALL_MUTATE_FILES.
const legs = mutationMatrixLegs();
const shardedModules = Object.keys(MUTATION_SHARDS);
assert.ok(shardedModules.length >= 1, "expected at least one sharded module");
for (const file of shardedModules) {
  assert.ok(ALL_MUTATE_FILES.includes(file), `shard target not in ALL_MUTATE_FILES: ${file}`);
  const text = readFileSync(file, "utf8");
  const eofLine = text.split("\n").length;
  const check = validateShardRanges(MUTATION_SHARDS[file], eofLine);
  assert.equal(check.ok, true, `${file}: ${check.detail}`);
}
// Matrix leg count = modules + extra shards beyond the first per sharded module.
const extraShardLegs = shardedModules.reduce((n, f) => n + MUTATION_SHARDS[f].length - 1, 0);
assert.equal(
  legs.length,
  ALL_MUTATE_FILES.length + extraShardLegs,
  "matrix legs must equal modules plus extra shards",
);
assert.ok(
  legs.length <= 20,
  `matrix legs ${legs.length} must stay within GitHub's 20 concurrent-job soft limit`,
);
assert.ok(
  legs.some((l) => l.slug === "formula1-shard-1" && l.range === "1-7073"),
  "formula1 shard-1 leg missing or wrong range",
);
assert.ok(
  legs.some((l) => l.slug === "formula1-shard-2" && l.range === "7074-14064"),
  "formula1 shard-2 leg missing or wrong range",
);
assert.ok(
  legs.some((l) => l.slug === "socialcalc-3-shard-1" && l.range === "1-3858"),
  "socialcalc-3 shard-1 leg missing or wrong range",
);
assert.ok(
  legs.some((l) => l.slug === "socialcalc-3-shard-3" && l.range === "7829-11084"),
  "socialcalc-3 shard-3 leg missing or wrong range",
);
assert.ok(
  !legs.some((l) => l.file === "js/formula1.ts" && !l.shard),
  "formula1 must not also emit an unsharded leg",
);

// The discover output feeds a fail-fast-disabled matrix, and every leg uploads
// its own JSON under the exact directory consumed by release-gate.
assert.match(mutation, /outputs:\n\s+files: \$\{\{ steps\.list\.outputs\.files \}\}/);
assert.match(mutation, /mutationMatrixLegs\(\)/);
assert.match(
  mutation,
  /matrix:\n\s+leg: \$\{\{ fromJson\(needs\.mutate-discover\.outputs\.files\) \}\}/,
);
assert.match(
  mutation,
  /mutate-full:\n\s+name:.*\n\s+needs: mutate-discover\n\s+strategy:\n\s+fail-fast: false/,
);
assert.match(mutation, /name: mutation-report-\$\{\{ steps\.meta\.outputs\.slug \}\}/);
assert.match(mutation, /path: reports\/mutation\/\$\{\{ steps\.meta\.outputs\.slug \}\}\//);
assert.match(mutation, /MUTATE_SHARD: \$\{\{ matrix\.leg\.shard \}\}/);
assert.match(mutation, /MUTATE_SHARD_RANGE: \$\{\{ matrix\.leg\.range \}\}/);
assert.match(mutation, /MUTATE_TARGET: \$\{\{ matrix\.leg\.file \}\}/);
assert.match(mutation, /timeout-minutes: 360/);
assert.match(mutation, /if-no-files-found: warn/);
assert.match(mutation, /release-gate:\n\s+name: mutation \(release gate/);
assert.match(mutation, /release-gate:[\s\S]*?\n\s+needs: mutate-full\n/);
assert.match(mutation, /if: always\(\) && inputs\.enforce_release == true/);
assert.match(mutation, /pattern: mutation-report-\*/);
assert.match(mutation, /path: artifacts/);
assert.match(mutation, /run: vp run mutate:release-gate/);
const gate = readFileSync("scripts/mutate-release-gate.mjs", "utf8");
assert.match(gate, /export function validMeasuredBaseline/);
assert.match(gate, /GITHUB_ACTIONS === "true"/);
assert.match(gate, /if \(isCI\) return null/);
assert.match(gate, /invalid mutation report shape/);
assert.match(gate, /mutation report contains no mutants/);
assert.match(gate, /no fresh report found/);
assert.match(gate, /export function evaluateFileReport/);
assert.match(gate, /export function normalizeReportFileKey/);
assert.match(gate, /export function mergeShardReports/);
assert.match(gate, /export function loadShardReports/);
assert.match(gate, /MUTATION_SHARDS/);
assert.match(gate, /not owned by this leg/);
assert.match(gate, /has unrecognized status/);
assert.match(gate, /STRYKER_MUTANT_STATUSES/);
assert.match(gate, /missing shard report/);
assert.match(gate, /overlapping mutant locus/);

// Third-party actions are immutable commit-SHA references in both workflows.
// Local reusable workflow calls (`./.github/workflows/...`) are not third-party
// and are exempt from the SHA-pin requirement.
for (const source of [mutation, release]) {
  for (const match of source.matchAll(/uses:\s*([^\s#]+)\s*(?:#|$)/gm)) {
    const ref = match[1].trim();
    if (ref.startsWith("./")) continue;
    assert.match(ref, /@[0-9a-f]{40}$/, `action must be SHA-pinned: ${ref}`);
  }
}

console.log(
  `mutation/release workflow contracts: 13 modules, ${legs.length} matrix legs (shards for ${shardedModules.join(", ")}), fail-closed matrix/artifacts/baselines, caller context, pins, and deadlock-safe concurrency verified`,
);
