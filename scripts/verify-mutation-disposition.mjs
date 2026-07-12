#!/usr/bin/env node
// Verifies that stryker-mutation-disposition.json's proof-quality
// equivalence registry accounts for every "Survived" mutant in a fresh
// Stryker mutation.json report by stable tuple identity — never by Stryker's
// per-run numeric mutant id.
//
// This is a documentation-honesty gate, not a mutation-testing gate: it never
// runs Stryker. It cross-checks two JSON documents that must already exist on
// disk. Missing or malformed evidence is a hard failure, not a silent pass.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const DEFAULT_REPORT_PATH = join("reports", "mutation", "critical", "mutation.json");
const DEFAULT_DISPOSITION_PATH = join(here, "..", "stryker-mutation-disposition.json");

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Normalize Stryker's source-file key without changing its identity. */
export function normalizeFilePath(file) {
  if (typeof file !== "string" || file.length === 0) {
    throw new Error("mutant file must be a non-empty string");
  }
  // Reports created on Windows use backslashes; registry entries conventionally
  // use POSIX separators. Strip only redundant relative prefixes, never a
  // leading slash, so unrelated absolute paths cannot collide accidentally.
  return posix.normalize(file.replaceAll("\\", "/")).replace(/^(?:\.\/)+/, "");
}

function validateLocation(location, label) {
  if (!isRecord(location) || !isRecord(location.start) || !isRecord(location.end)) {
    throw new Error(`${label}.location must contain start and end objects`);
  }
  for (const edge of ["start", "end"]) {
    const point = location[edge];
    for (const field of ["line", "column"]) {
      if (!Number.isInteger(point[field]) || point[field] < (field === "line" ? 1 : 0)) {
        throw new Error(`${label}.location.${edge}.${field} must be an integer`);
      }
    }
  }
}

function validateMutant(mutant, label, requireStatus = false) {
  if (!isRecord(mutant)) throw new Error(`${label} must be an object`);
  if (requireStatus && typeof mutant.status !== "string") {
    throw new Error(`${label}.status must be a string`);
  }
  if (typeof mutant.mutatorName !== "string" || mutant.mutatorName.length === 0) {
    throw new Error(`${label}.mutatorName must be a non-empty string`);
  }
  if (typeof mutant.replacement !== "string") {
    throw new Error(`${label}.replacement must be a string`);
  }
  validateLocation(mutant.location, label);
}

/** Validate the subset of Stryker's report schema used by this gate. */
export function validateReport(report) {
  if (!isRecord(report) || !isRecord(report.files)) {
    throw new Error("mutation report must contain a files object");
  }
  for (const [file, data] of Object.entries(report.files)) {
    normalizeFilePath(file);
    if (!isRecord(data) || !Array.isArray(data.mutants)) {
      throw new Error(`mutation report file ${file} must contain a mutants array`);
    }
    data.mutants.forEach((mutant, index) =>
      validateMutant(mutant, `mutation report ${file}.mutants[${index}]`, true),
    );
  }
  return report;
}

/** Validate disposition shape and reject ambiguous duplicate tuple keys. */
export function validateDisposition(disposition) {
  if (!isRecord(disposition) || !Array.isArray(disposition.entries)) {
    throw new Error("disposition registry must contain an entries array");
  }
  const seen = new Set();
  disposition.entries.forEach((entry, index) => {
    if (!isRecord(entry)) throw new Error(`disposition.entries[${index}] must be an object`);
    normalizeFilePath(entry.file);
    validateMutant(entry, `disposition.entries[${index}]`);
    const key = stableKey(entry);
    if (seen.has(key)) throw new Error(`duplicate disposition key at entries[${index}]: ${key}`);
    seen.add(key);
  });
  return disposition;
}

/**
 * Stable identity for a mutant, independent of Stryker's per-run numeric id.
 * Two mutants with the same (file, mutatorName, location, replacement) are
 * the same mutant across runs as long as the source line has not moved.
 */
export function stableKey(entry) {
  const { file, mutatorName, location, replacement } = entry;
  const { start, end } = location;
  return `${normalizeFilePath(file)}::${mutatorName}::${start.line}:${start.column}-${end.line}:${end.column}::${replacement}`;
}

/** Every Survived mutant in a mutation.json report, flattened across files. */
export function extractSurvivors(report) {
  validateReport(report);
  const survivors = [];
  for (const [file, data] of Object.entries(report.files)) {
    for (const mutant of data.mutants) {
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
 * Survived mutants from report that have no matching entries[] tuple in the
 * registry. Order matches the report's own file/mutant iteration order.
 */
export function findUndispositioned(report, disposition) {
  validateReport(report);
  validateDisposition(disposition);
  const dispositionedKeys = new Set(disposition.entries.map(stableKey));
  return extractSurvivors(report).filter((survivor) => !dispositionedKeys.has(stableKey(survivor)));
}

/**
 * Registry entries whose tuple does not occur in the report at any status.
 * A tuple present as Killed is intentionally not stale: it may be a retained
 * proof entry whose mutant was killed incidentally by a later test change.
 */
export function findStaleEntries(report, disposition) {
  validateReport(report);
  validateDisposition(disposition);
  const reportKeys = new Set();
  for (const [file, data] of Object.entries(report.files)) {
    for (const mutant of data.mutants) reportKeys.add(stableKey({ ...mutant, file }));
  }
  return disposition.entries.filter((entry) => !reportKeys.has(stableKey(entry)));
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

  try {
    validateReport(report.value);
    validateDisposition(disposition.value);
    const stale = findStaleEntries(report.value, disposition.value);
    if (stale.length > 0) {
      console.error(
        `verify-mutation-disposition: FAILED — ${stale.length} disposition entr${stale.length === 1 ? "y is" : "ies are"} stale (no matching mutant tuple in ${report.resolved}):\n${formatUndispositioned(stale)}`,
      );
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
  } catch (err) {
    console.error(`verify-mutation-disposition: FAILED — invalid input: ${err.message}`);
    process.exit(1);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
