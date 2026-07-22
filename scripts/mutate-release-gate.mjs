#!/usr/bin/env node
// Release gate for the full (all-13-module) mutation scope: refuses to pass
// unless EVERY module in ALL_MUTATE_FILES (stryker-file.mjs) has both (a) a
// registered, actually-measured baseline in stryker-mutation-baseline.json
// (`measured:true`, a finite break number in the 0..100 range, and the
// measured full-module mutant count as a minimum) and (b) a fresh
// mutation.json whose count is at least that complete-module measurement and
// whose score meets the registered floor. A missing report, a
// partial/empty/malformed report, and a score below its floor are all hard
// failures — "report-only" is not "passing", and 80 is never used as a
// stand-in for evidence. Never treat an unmeasured/guessed number as
// evidence.
//
// A report is also rejected unless it PROVES it is evidence for the exact
// module it claims to be: report.files must contain exactly one entry that
// normalizes (relative path / "./"-prefixed / absolute / file:// URL /
// backslash-separated, all resolved down to the "js/<name>.ts" suffix every
// ALL_MUTATE_FILES entry is written as) to that module's own path, and NO
// other mutated source file. A miswired, stale, or copy-pasted artifact
// (e.g. a leg accidentally uploading another module's report under this
// module's artifact name) satisfying only a bare "is it non-empty JSON"
// check would otherwise silently pass as this module's evidence — this
// closes that gap. Every mutant's `status` must also be one of Stryker's
// own recognized terminal statuses (mutation-testing-report-schema's
// MutantStatus enum); an unrecognized/typo'd status is a hard failure, not
// something that silently drops out of the score denominator.
//
// Sharded modules (MUTATION_SHARDS in stryker-file.mjs) publish one report
// per complementary line range under `<module>-shard-<n>/`. The gate requires
// EVERY declared shard, verifies ranges are contiguous/non-overlapping and
// cover the whole file (1..EOF), verifies mutant locations fall inside each
// shard's declared range with zero cross-shard overlap, merges the mutant
// lists, then applies the module floor + minimumMutants checks to the MERGED
// result exactly as for unsharded modules. A missing shard, overlapping
// ranges, a gap, or a `<module>-partial/` exploratory report used as
// full-module evidence is a hard failure. Baselines stay keyed by module.
//
// Looks for each module's fresh report at, in order:
//   <MUTATION_ARTIFACTS_DIR or "artifacts">/mutation-report-<slug>/mutation.json
//     (matches .github/workflows/mutation.yml's mutate-full upload naming +
//     the release-gate job's download-artifact step, for CI)
//   reports/mutation/<slug>/mutation.json
//     (matches `vp run mutate:all`'s local sequential layout)
// In CI (GITHUB_ACTIONS=true) the local fallback is never used: only the
// artifact downloaded fresh for this exact run counts as evidence, never a
// stale on-disk report left over from a previous checkout state.
//
// Usage: vp run mutate:release-gate  (or: node scripts/mutate-release-gate.mjs)

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ALL_MUTATE_FILES, MUTATION_SHARDS, validateShardRanges } from "../stryker-file.mjs";

// Stryker's own MutantStatus enum (mutation-testing-report-schema's
// mutation-testing-report-schema.json). A status outside this set is either
// a malformed/hand-edited report or a schema drift this gate has not been
// taught about yet — either way, never silently excluded from the score
// denominator as if it just weren't Killed/Timeout.
export const STRYKER_MUTANT_STATUSES = new Set([
  "Killed",
  "Survived",
  "NoCoverage",
  "CompileError",
  "RuntimeError",
  "Timeout",
  "Ignored",
  "Pending",
]);

/**
 * The registry's module key set must exactly track ALL_MUTATE_FILES — no
 * silently-omitted module, no stale leftover entry for a module that no
 * longer exists in stryker-file.mjs.
 */
export function checkBaselineRegistry(allMutateFiles, baselineModules) {
  const registered = new Set(Object.keys(baselineModules ?? {}));
  const expected = new Set(allMutateFiles);
  return {
    missingFromRegistry: allMutateFiles.filter((f) => !registered.has(f)),
    staleInRegistry: [...registered].filter((f) => !expected.has(f)),
  };
}

export function validMeasuredBaseline(entry) {
  return (
    entry?.measured === true &&
    typeof entry.break === "number" &&
    Number.isFinite(entry.break) &&
    entry.break >= 0 &&
    entry.break <= 100 &&
    Number.isInteger(entry.minimumMutants) &&
    entry.minimumMutants > 0
  );
}

/**
 * Where a fresh report for `slug` would live for this run: the CI artifact
 * path first, falling back (outside CI only) to a local sequential-run
 * layout. `cwd` is injectable so this stays pure/testable against an
 * isolated temp directory instead of the real process cwd.
 */
export function reportPathFor(slug, { artifactsDir, isCI, cwd }) {
  const ciPath = join(cwd, artifactsDir, `mutation-report-${slug}`, "mutation.json");
  if (existsSync(ciPath)) return ciPath;
  // In CI, never fall back to a checkout-local report: only the artifact
  // downloaded from this run proves that this matrix leg uploaded evidence.
  if (isCI) return null;
  const localPath = join(cwd, "reports", "mutation", slug, "mutation.json");
  if (existsSync(localPath)) return localPath;
  return null;
}

/**
 * Normalizes a Stryker report's `files` key to the "js/<name>.ts"-relative
 * form every ALL_MUTATE_FILES entry is written as, regardless of whether
 * Stryker recorded it as a bare relative path, a "./"-prefixed path, an
 * absolute filesystem path (any repo-root prefix, any OS), or a `file://`
 * URL, and regardless of path separator.
 */
export function normalizeReportFileKey(key) {
  let k = String(key);
  if (k.startsWith("file://")) {
    try {
      k = fileURLToPath(k);
    } catch {
      // Malformed file:// URL — leave as-is; it will simply fail to match
      // any expected target and get reported as an unexpected/missing file.
    }
  }
  k = k.replace(/\\/g, "/").replace(/^\.\//, "");
  const marker = "/js/";
  const idx = k.lastIndexOf(marker);
  if (idx !== -1) k = k.slice(idx + 1);
  return k;
}

/**
 * Validates that `mutationJson` is well-formed AND is specifically evidence
 * for `expectedFile` — exactly one file entry, normalizing to that exact
 * module path, no other mutated source file present — with every mutant a
 * well-formed object carrying a recognized terminal status. Returns
 * `{ ok: true, total, score }` on success or `{ ok: false, detail }` on any
 * failure, never partially trusting a malformed shape.
 */
export function evaluateFileReport(mutationJson, expectedFile) {
  if (!mutationJson || typeof mutationJson !== "object" || Array.isArray(mutationJson)) {
    return { ok: false, detail: "invalid mutation report shape: expected an object" };
  }
  const files = mutationJson.files;
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return { ok: false, detail: "invalid mutation report shape: expected a files object" };
  }

  const keys = Object.keys(files);
  const matches = keys.filter((k) => normalizeReportFileKey(k) === expectedFile);
  const extras = keys.filter((k) => normalizeReportFileKey(k) !== expectedFile);

  if (matches.length === 0) {
    return {
      ok: false,
      detail: `report does not contain the expected mutated file ${expectedFile} (found: ${keys.length ? keys.join(", ") : "<none>"})`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      detail: `report contains ${matches.length} entries all normalizing to ${expectedFile}: ${matches.join(", ")}`,
    };
  }
  if (extras.length > 0) {
    return {
      ok: false,
      detail: `report contains file(s) not owned by this leg (${expectedFile}): ${extras.join(", ")}`,
    };
  }

  const fileEntry = files[matches[0]];
  if (!fileEntry || typeof fileEntry !== "object" || Array.isArray(fileEntry)) {
    return { ok: false, detail: `file entry for ${expectedFile} is not an object` };
  }
  if (!Array.isArray(fileEntry.mutants)) {
    return { ok: false, detail: `file entry for ${expectedFile} has no mutants array` };
  }

  let total = 0;
  let killedLike = 0;
  for (let i = 0; i < fileEntry.mutants.length; i++) {
    const m = fileEntry.mutants[i];
    if (!m || typeof m !== "object" || Array.isArray(m)) {
      return { ok: false, detail: `${expectedFile} mutant[${i}] is not an object` };
    }
    if (typeof m.id !== "string" && typeof m.id !== "number") {
      return { ok: false, detail: `${expectedFile} mutant[${i}] is missing a valid id` };
    }
    if (typeof m.mutatorName !== "string" || m.mutatorName.length === 0) {
      return { ok: false, detail: `${expectedFile} mutant[${i}] is missing mutatorName` };
    }
    if (typeof m.status !== "string" || !STRYKER_MUTANT_STATUSES.has(m.status)) {
      return {
        ok: false,
        detail: `${expectedFile} mutant[${i}] has unrecognized status: ${JSON.stringify(m.status)}`,
      };
    }
    total++;
    if (m.status === "Killed" || m.status === "Timeout") killedLike++;
  }

  if (total === 0) {
    return { ok: false, detail: `${expectedFile} mutation report contains no mutants` };
  }

  return { ok: true, total, score: (100 * killedLike) / total };
}

/**
 * Read source line count (1-based EOF = number of lines including a trailing
 * empty line from a final newline, matching `content.split("\\n").length`).
 */
export function fileEofLine(file, cwd) {
  const abs = join(cwd, file);
  if (!existsSync(abs)) {
    return { ok: false, detail: `source file missing for shard EOF check: ${file}` };
  }
  const text = readFileSync(abs, "utf8");
  return { ok: true, eofLine: text.split("\n").length };
}

/**
 * Extract a mutant's start line. Missing/malformed location is a hard failure
 * for shard merge (we cannot prove range membership).
 */
export function mutantStartLine(mutant) {
  const line = mutant?.location?.start?.line;
  return Number.isInteger(line) && line >= 1 ? line : null;
}

/**
 * Merge complementary shard reports into one full-module evidence object.
 * `shardReports` is an ordered array of `{ shard, startLine, endLine, mutationJson }`.
 * Returns `{ ok:true, mutationJson, total, score }` or `{ ok:false, detail }`.
 */
export function mergeShardReports(expectedFile, shardSpecs, shardReports) {
  if (!Array.isArray(shardSpecs) || shardSpecs.length === 0) {
    return { ok: false, detail: "no shard specs declared" };
  }
  if (!Array.isArray(shardReports) || shardReports.length !== shardSpecs.length) {
    return {
      ok: false,
      detail: `expected ${shardSpecs.length} shard reports, found ${shardReports?.length ?? 0}`,
    };
  }

  const byShard = new Map(shardReports.map((r) => [r.shard, r]));
  const mergedMutants = [];
  /** @type {Map<string, { shard: number, line: number }>} */
  const seenKeys = new Map();

  for (const spec of shardSpecs) {
    const report = byShard.get(spec.shard);
    if (!report) {
      return { ok: false, detail: `missing shard ${spec.shard} report` };
    }
    if (report.startLine !== spec.startLine || report.endLine !== spec.endLine) {
      return {
        ok: false,
        detail: `shard ${spec.shard} range mismatch: declared ${spec.startLine}-${spec.endLine}, report meta ${report.startLine}-${report.endLine}`,
      };
    }

    const evaluated = evaluateFileReport(report.mutationJson, expectedFile);
    if (!evaluated.ok) {
      return { ok: false, detail: `shard ${spec.shard}: ${evaluated.detail}` };
    }

    const files = report.mutationJson.files;
    const fileKey = Object.keys(files).find((k) => normalizeReportFileKey(k) === expectedFile);
    const mutants = files[fileKey].mutants;

    for (let i = 0; i < mutants.length; i++) {
      const m = mutants[i];
      const line = mutantStartLine(m);
      if (line === null) {
        return {
          ok: false,
          detail: `shard ${spec.shard} mutant[${i}] missing location.start.line`,
        };
      }
      if (line < spec.startLine || line > spec.endLine) {
        return {
          ok: false,
          detail: `shard ${spec.shard} mutant[${i}] at line ${line} outside declared range ${spec.startLine}-${spec.endLine}`,
        };
      }
      // Identity for overlap detection: location + mutator + replacement.
      // Ranges are disjoint so ids may collide across shards; we key by locus.
      const locus = `${line}:${m.location?.start?.column ?? ""}:${m.location?.end?.line ?? ""}:${m.location?.end?.column ?? ""}:${m.mutatorName}:${JSON.stringify(m.replacement)}`;
      const prior = seenKeys.get(locus);
      if (prior) {
        return {
          ok: false,
          detail: `overlapping mutant locus between shard ${prior.shard} and shard ${spec.shard} at line ${line}`,
        };
      }
      seenKeys.set(locus, { shard: spec.shard, line });
      mergedMutants.push(m);
    }
  }

  if (mergedMutants.length === 0) {
    return { ok: false, detail: `${expectedFile} merged shard reports contain no mutants` };
  }

  const mutationJson = {
    files: {
      [expectedFile]: { mutants: mergedMutants },
    },
  };
  const evaluated = evaluateFileReport(mutationJson, expectedFile);
  if (!evaluated.ok) return evaluated;
  return { ok: true, mutationJson, total: evaluated.total, score: evaluated.score };
}

/**
 * Resolve and load every shard report for a sharded module. Hard-fails on any
 * missing shard. Does not fall back to a full-module slug for sharded modules
 * (a full report would skip the complementary-range proof).
 */
export function loadShardReports(file, shardSpecs, { artifactsDir, isCI, cwd }) {
  const base = basename(file, ".ts");
  const loaded = [];
  const missing = [];
  for (const spec of shardSpecs) {
    const slug = `${base}-shard-${spec.shard}`;
    const reportPath = reportPathFor(slug, { artifactsDir, isCI, cwd });
    if (!reportPath) {
      missing.push(slug);
      continue;
    }
    let mutationJson;
    try {
      mutationJson = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch (error) {
      return {
        ok: false,
        detail: `invalid mutation report JSON for ${slug}: ${error.message}`,
      };
    }
    loaded.push({
      shard: spec.shard,
      startLine: spec.startLine,
      endLine: spec.endLine,
      mutationJson,
      reportPath,
    });
  }
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing shard report(s): ${missing.join(", ")}`,
    };
  }
  return { ok: true, reports: loaded };
}

/**
 * Runs the full per-module release-gate loop: for every module in
 * `allMutateFiles`, resolves its report path (or merges all shard reports),
 * validates the registered baseline, parses and validates the report, and
 * checks the score against the floor. Returns `{ rows, failed }` — one row
 * per module (never short-circuits on the first failure, so a release always
 * gets the full, honest picture of every module's state) and whether ANY
 * module failed. Pure aside from the injected filesystem reads, so it is the
 * single source of truth for both the CLI driver below and fixture-driven tests.
 */
export function evaluateAllModules(allMutateFiles, baselineModules, { artifactsDir, isCI, cwd }) {
  const rows = [];
  let failed = false;

  for (const file of allMutateFiles) {
    const slug = basename(file, ".ts");
    const entry = baselineModules[file];
    const shardSpecs = MUTATION_SHARDS[file] ?? null;

    if (!validMeasuredBaseline(entry)) {
      rows.push({
        file,
        status: "FAIL",
        detail:
          "missing or malformed measured baseline — requires measured:true, a finite numeric break in the 0..100 range, and a positive integer minimumMutants count; run MUTATE_TARGET=<module> vp run mutate (or vp run mutate:all) and ratchet stryker-mutation-baseline.json before release",
      });
      failed = true;
      continue;
    }

    let total;
    let score;

    if (shardSpecs) {
      const eof = fileEofLine(file, cwd);
      if (!eof.ok) {
        rows.push({ file, status: "FAIL", detail: eof.detail });
        failed = true;
        continue;
      }
      const rangeCheck = validateShardRanges(shardSpecs, eof.eofLine);
      if (!rangeCheck.ok) {
        rows.push({
          file,
          status: "FAIL",
          detail: `invalid MUTATION_SHARDS declaration: ${rangeCheck.detail}`,
        });
        failed = true;
        continue;
      }

      // Reject a lone full-module or -partial path masquerading as complete
      // evidence when the module is declared sharded — shards are mandatory.
      const loaded = loadShardReports(file, rangeCheck.shards, { artifactsDir, isCI, cwd });
      if (!loaded.ok) {
        rows.push({ file, status: "FAIL", detail: loaded.detail });
        failed = true;
        continue;
      }

      const merged = mergeShardReports(file, rangeCheck.shards, loaded.reports);
      if (!merged.ok) {
        rows.push({ file, status: "FAIL", detail: merged.detail });
        failed = true;
        continue;
      }
      total = merged.total;
      score = merged.score;
    } else {
      const reportPath = reportPathFor(slug, { artifactsDir, isCI, cwd });

      if (!reportPath) {
        rows.push({ file, status: "FAIL", detail: "no fresh report found for this run" });
        failed = true;
        continue;
      }

      let mutationJson;
      try {
        mutationJson = JSON.parse(readFileSync(reportPath, "utf8"));
      } catch (error) {
        rows.push({
          file,
          status: "FAIL",
          detail: `invalid mutation report JSON: ${error.message}`,
        });
        failed = true;
        continue;
      }

      const evaluated = evaluateFileReport(mutationJson, file);
      if (!evaluated.ok) {
        rows.push({ file, status: "FAIL", detail: evaluated.detail });
        failed = true;
        continue;
      }
      total = evaluated.total;
      score = evaluated.score;
    }

    if (total < entry.minimumMutants) {
      rows.push({
        file,
        status: "FAIL",
        detail: `${file} mutation report has ${total} mutants; complete measured baseline requires at least ${entry.minimumMutants}`,
      });
      failed = true;
      continue;
    }

    const ok = score >= entry.break;
    if (!ok) failed = true;
    rows.push({
      file,
      status: ok ? "PASS" : "FAIL",
      detail: `${score.toFixed(2)}% (floor ${entry.break}%, ${total} mutants${shardSpecs ? `, ${shardSpecs.length} shards` : ""})`,
    });
  }

  return { rows, failed };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const baselinePath = join(here, "..", "stryker-mutation-baseline.json");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

  const { missingFromRegistry, staleInRegistry } = checkBaselineRegistry(
    ALL_MUTATE_FILES,
    baseline.modules,
  );
  if (missingFromRegistry.length > 0 || staleInRegistry.length > 0) {
    console.error(
      "stryker-mutation-baseline.json is out of sync with stryker-file.mjs's ALL_MUTATE_FILES:",
    );
    if (missingFromRegistry.length > 0)
      console.error(`  missing entries: ${missingFromRegistry.join(", ")}`);
    if (staleInRegistry.length > 0) console.error(`  stale entries: ${staleInRegistry.join(", ")}`);
    process.exit(1);
  }

  const artifactsDir = process.env.MUTATION_ARTIFACTS_DIR?.trim() || "artifacts";
  const isCI = process.env.GITHUB_ACTIONS === "true";
  const cwd = process.cwd();

  const { rows, failed } = evaluateAllModules(ALL_MUTATE_FILES, baseline.modules, {
    artifactsDir,
    isCI,
    cwd,
  });

  console.log("Mutation release gate — all 13 shipping modules:\n");
  for (const { file, status, detail } of rows) {
    console.log(`${status}  ${file}  ${detail}`);
  }

  if (failed) {
    console.error(
      "\nRelease gate FAILED: every shipping module needs a real measured baseline, a fresh report from this run proven to be evidence for exactly that module, and a score at or above its registered floor before a release tag can proceed.",
    );
    process.exit(1);
  }

  console.log(
    "\nRelease gate PASSED: all 13 modules measured, reported, and at or above their floor.",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
