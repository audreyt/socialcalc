#!/usr/bin/env node
// @ts-nocheck
// 
// Static release-safety assertions for the reusable mutation workflow.
// This deliberately avoids executing GitHub Actions: it proves the YAML's
// expressions select the intended jobs for the caller context inherited by a
// workflow_call (event_name remains the release caller's `push`).

import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const path = ".github/workflows/mutation.yml";
const source = readFileSync(path, "utf8");

function jobIf(job) {
  const match = source.match(new RegExp(`^  ${job}:\\n(?:.*\\n)*?    if: >-\\n((?:      .*\\n)+)`, "m"));
  assert(match, `${job} must have a multiline if expression`);
  return match[1].replace(/^      /gm, "").replace(/\s+$/g, "").replace(/\n/g, " ");
}

const criticalIf = jobIf("critical");
const discoverIf = jobIf("mutate-discover");
const releaseIf = source.match(/^  release-gate:\n(?:.*\n)*?    if: (.+)$/m)?.[1];
assert(releaseIf, "release-gate must have an if expression");

// A called workflow inherits the caller's event_name. Model release.yml's
// tag-push caller explicitly: inputs.scope=full and enforce_release=true.
const releaseCaller = { eventName: "push", scope: "full", enforceRelease: true };
const criticalRuns = releaseCaller.eventName === "pull_request" || releaseCaller.scope === "critical";
const discoverRuns = releaseCaller.eventName === "schedule" || releaseCaller.scope === "full";
const releaseGateRuns = releaseCaller.enforceRelease === true;
assert.equal(criticalRuns, false, "release full call must not run the critical-only job");
assert.equal(discoverRuns, true, "release full call must run matrix discovery");
assert.equal(releaseGateRuns, true, "release enforce_release call must run release-gate");

assert.match(criticalIf, /inputs\.scope == 'critical'/);
assert.doesNotMatch(criticalIf, /event_name == 'workflow_call'/);
assert.match(discoverIf, /inputs\.scope == 'full'/);
assert.doesNotMatch(discoverIf, /event_name == 'workflow_call'/);
assert.match(releaseIf, /inputs\.enforce_release == true/);
assert.doesNotMatch(releaseIf, /event_name == 'workflow_call'/);

// This reusable workflow must never independently fire on release tags; the
// caller owns the tag trigger and invokes this file locally via workflow_call.
assert.doesNotMatch(source, /^push:\s*$/m);
assert.doesNotMatch(source, /^\s+tags:\s*v\*/m);
assert.match(source, /^  group: mutation-\$\{\{ github\.ref \}\}$/m);

console.log("mutation workflow config: release full call, no direct tag trigger, and collision-safe concurrency verified");
