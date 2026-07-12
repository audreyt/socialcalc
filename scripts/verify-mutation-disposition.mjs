#!/usr/bin/env node
// Verifies that stryker-mutation-disposition.json's proof-quality
// equivalence registry actually accounts for every "Survived" mutant in a
// fresh Stryker mutation.json report, by stable tuple identity — never by
// Stryker's own numeric mutant `id` (which is reassigned per run; see the
// disposition file's own $schema_note).
//
// This is a documentation-honesty gate, not a mutation-testing gate: it
// never runs Stryker itself (see this repo's rule against running any
// mutation command outside an isolated sandbox), it only cross-checks two
// JSON documents that must already exist on disk — a fresh mutation.json
// report and the disposition registry. A missing report is a hard failure,
// not a silent pass: absence of evidence is not evidence of "covered".
//
// A mutant is "dispositioned" only when its (file, mutatorName, location,
// replacement) tuple exactly matches an entries[] row in the registry — a
// test file merely targeting a survivor's line is not a disposition; only
// an actual registry entry (backed by either a proof-quality equivalence
// argument or a confirmed-Killed rerun) counts.
//
// Usage:
//   node scripts/verify-mutation-disposition.mjs [reportPath] [--report=<path>] [--disposition=<path>]
//
// Defaults: reportPath = reports/mutation/critical/mutation.json (relative
// to cwd), dispositionPath = stryker-mutation-disposition.json next to this
// script. Both are resolvable from any cwd via --report/--disposition for
// fixture-driven tests.
//
// Deliberately NOT wired into `vp test`/the vitest include glob: it depends
// on a real Stryker report that this checkpoint does not generate (and
// must not — see the ABSOLUTE RULE against running Stryker in this
// worktree), so it never runs automatically as part of the normal unit
// suite. Invoke explicitly via `bun run test:mutation-disposition` once a
// fresh critical-scope report exists from an isolated sandbox run.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const DEFAULT_REPORT_PATH = join("reports", "mutation", "critical", "mutation.json");
const DEFAULT_DISPOSITION_PATH = join(here, "..", "stryker-mutation-disposition.json");

/**
 * Stable identity for a mutant, independent of Stryker's per-run numeric
 * `id`. Two mutants with the same (file, mutatorName, location, replacement)
 * are the same mutant across runs as long as the source line hasn't moved.
 */
export function stableKey(entry) {
  const { file, mutatorName, location, replacement } = entry;
  const { start, end } = location;
  return `${file}::${mutatorName}::${start.line}:${start.column}-${end.line}:${end.column}::${replacement}`;
}

/** Every Survived mutant in a Stryker mutation.json report, flattened across files. */
export function extractSurvivors(report) {
  const survivors = [];
  for (const [file, data] of Object.entries(report.files ?? {})) {
    for (const mutant of data.mutants ?? []) {
      if (mutant.status === "Survived") {
        survivors.push({
          file,
          mutatorName: mutant.mutatorName,
          location: mutant.location,
          replacement: mutant.replacement,
          id: mutant.id,
        });
      }
    }
  }
  return survivors;
}

/**
 * Survived mutants from `report` that have no matching entries[] tuple in
 * `disposition`. Order matches the report's own file/mutant iteration order.
 */
export function findUndispositioned(report, disposition) {
  const dispositionedKeys = new Set((disposition.entries ?? []).map(stableKey));
  return extractSurvivors(report).filter((survivor) => !dispositionedKeys.has(stableKey(survivor)));
}

function parseArgs(argv) {
  let reportPath;
  let dispositionPath;
  const positionals = [];
  for (const arg of argv) {
    if (arg.startsWith("--report=")) reportPath = arg.slice("--report=".length);
    else if (arg.startsWith("--disposition=")) dispositionPath = arg.slice("--disposition=".length);
    else positionals.push(arg);
  }
  return { reportPath: reportPath ?? positionals[0], dispositionPath };
}

function loadJson(path, label) {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return { error: `no ${label} found at ${resolved}` };
  try {
    return { value: JSON.parse(readFileSync(resolved, "utf8")), resolved };
  } catch (err) {
    return { error: `${label} at ${resolved} is not valid JSON: ${err.message}` };
  }
}

function formatUndispositioned(list) {
  return list
    .map((m) => {
      const { start, end } = m.location;
      return `  - ${m.file} ${m.mutatorName} @ ${start.line}:${start.column}-${end.line}:${end.column} -> ${m.replacement} (report id=${m.id})`;
    })
    .join("\n");
}

function main() {
  const { reportPath, dispositionPath } = parseArgs(process.argv.slice(2));

  const report = loadJson(reportPath ?? DEFAULT_REPORT_PATH, "mutation report");
  if (report.error) {
    console.error(`verify-mutation-disposition: ${report.error}`);
    console.error(
      "Run an isolated-sandbox MUTATE_SCOPE=critical Stryker pass first (never in this checkpoint worktree) and pass --report=<path>, or place the report at the default path.",
    );
    process.exit(1);
  }

  const disposition = loadJson(dispositionPath ?? DEFAULT_DISPOSITION_PATH, "disposition registry");
  if (disposition.error) {
    console.error(`verify-mutation-disposition: ${disposition.error}`);
    process.exit(1);
  }

  const undispositioned = findUndispositioned(report.value, disposition.value);
  const survivorCount = extractSurvivors(report.value).length;

  if (undispositioned.length > 0) {
    console.error(
      `verify-mutation-disposition: FAILED — ${undispositioned.length} of ${survivorCount} Survived mutant(s) in ${report.resolved} have no matching entry in ${disposition.resolved}:\n`,
    );
    console.error(formatUndispositioned(undispositioned));
    console.error(
      "\nEach one needs either a proof-quality equivalence entry, or a test proven (by an actual fresh/targeted Stryker rerun, not just added) to kill it — never claim 'covered' without that evidence.",
    );
    process.exit(1);
  }

  console.log(
    `verify-mutation-disposition: OK — all ${survivorCount} Survived mutant(s) in ${report.resolved} are accounted for in ${disposition.resolved}.`,
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
