#!/usr/bin/env node
// Deterministic coverage-attribution regression. A shared vm.Script loader is
// the control (A); adding the type smoke test (B) must only add coverage. A
// runtime ESM import of the same UMD bundle creates a second V8 record and
// poisons the merged report with zero-hit regions. Comparing source-attributed
// Istanbul hit maps catches that failure without pinning source lines or names.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const vpBin = resolve(repoRoot, "node_modules/.bin/vp");
const expectedSources = [
  "js/chart.ts",
  "js/formatnumber2.ts",
  "js/formula-operand.ts",
  "js/formula-parse.ts",
  "js/formula-ref.ts",
  "js/formula1.ts",
  "js/socialcalc-3.ts",
  "js/socialcalcconstants.ts",
  "js/socialcalcpopup.ts",
  "js/socialcalcspreadsheetcontrol.ts",
  "js/socialcalctableeditor.ts",
  "js/socialcalcviewer.ts",
];

function writeThresholdFreeConfig(dir) {
  // Keep the repository's normal pool/reporters untouched. The temporary
  // config only removes thresholds so this intentionally small probe can run
  // without pretending to meet the full-suite floors.
  const configPath = resolve(dir, "coverage-attribution.config.mjs");
  writeFileSync(
    configPath,
    `import base from ${JSON.stringify(resolve(repoRoot, "vite.config.ts"))};\n` +
      `const thresholds = Object.fromEntries(Object.keys(base.test.coverage.thresholds).map((key) => [key, 0]));\n` +
      `export default { ...base, test: { ...base.test, coverage: { ...base.test.coverage, thresholds } } };\n`,
  );
  return configPath;
}

function buildCoverageBundle() {
  const result = spawnSync(vpBin, ["build"], {
    cwd: repoRoot,
    env: { ...process.env, SOCIALCALC_COVERAGE: "1" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`coverage build failed with exit code ${result.status}`);
}

function runProbe(reportDir, testFiles, configPath) {
  const result = spawnSync(
    vpBin,
    [
      "test",
      "run",
      ...testFiles,
      "--config",
      configPath,
      "--coverage",
      "--coverage.reporter=json",
      `--coverage.reportsDirectory=${reportDir}`,
    ],
    { cwd: repoRoot, env: { ...process.env, SOCIALCALC_COVERAGE: "1" }, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`coverage probe failed with exit code ${result.status}`);
  const reportPath = resolve(reportDir, "coverage-final.json");
  return JSON.parse(readFileSync(reportPath, "utf8"));
}

function normalizeReport(report) {
  const normalized = new Map();
  for (const [absolutePath, entry] of Object.entries(report)) {
    const source = relative(repoRoot, absolutePath).split("\\").join("/");
    if (!source.startsWith("js/")) continue;
    normalized.set(source, entry);
  }
  return normalized;
}

function coveredSet(values) {
  return new Set(
    Object.entries(values)
      .filter(([, count]) => count > 0)
      .map(([id]) => id),
  );
}

function metricSets(entry) {
  const lines = new Set();
  for (const [id, count] of Object.entries(entry.s)) {
    if (count > 0) lines.add(String(entry.statementMap[id].start.line));
  }
  return {
    statements: coveredSet(entry.s),
    functions: coveredSet(entry.f),
    branches: new Set(
      Object.entries(entry.b).flatMap(([id, counts]) =>
        counts.flatMap((count, index) => {
          const location = entry.branchMap[id].locations[index];
          return count > 0 && location?.start?.line != null ? [`${id}:${index}`] : [];
        }),
      ),
    ),
    lines,
  };
}

const tempRoot = mkdtempSync(resolve(tmpdir(), "socialcalc-coverage-attribution-"));
try {
  buildCoverageBundle();
  const configPath = writeThresholdFreeConfig(tempRoot);
  const reportA = runProbe(resolve(tempRoot, "a"), ["test/bundle-loader.test.ts"], configPath);
  const reportB = runProbe(
    resolve(tempRoot, "b"),
    ["test/bundle-loader.test.ts", "test/types.smoke.test.ts"],
    configPath,
  );
  const a = normalizeReport(reportA);
  const b = normalizeReport(reportB);
  for (const source of expectedSources) {
    if (!a.has(source) || !b.has(source)) {
      throw new Error(`coverage probe is missing source-attributed map ${source}`);
    }
  }
  for (const source of expectedSources) {
    const metricsA = metricSets(a.get(source));
    const metricsB = metricSets(b.get(source));
    for (const metric of Object.keys(metricsA)) {
      const lost = [...metricsA[metric]].filter((key) => !metricsB[metric].has(key));
      if (lost.length > 0) {
        throw new Error(`${source} lost ${lost.length} covered ${metric} in the augmented probe`);
      }
    }
  }
  console.log(`coverage attribution monotonic: ${expectedSources.length} js/*.ts source maps`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  // Leave the checkout in the normal byte-clean build state even when a
  // probe fails; the coverage map is an ephemeral test artifact.
  spawnSync(vpBin, ["build"], {
    cwd: repoRoot,
    env: { ...process.env, SOCIALCALC_COVERAGE: "0" },
    stdio: "ignore",
  });
}
