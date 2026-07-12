// Focused regression for scripts/merge-browser-coverage.mjs's fail-open
// guards: a broken/truncated browser-coverage collector must NEVER let the
// merge silently fall back to unit-only coverage while still reporting (and
// enforcing thresholds on) what it claims is a merged unit+browser result.
//
// Both scenarios below run the REAL script as a subprocess against REAL
// on-disk fixtures — but under an ISOLATED `mkdtempSync` temp directory
// passed via `SOCIALCALC_BROWSER_COVERAGE_DIR`, never the shared repo-root
// coverage-browser-v8/. This is intentionally NOT a source-text assertion:
// it proves the process actually exits nonzero, names the offending file,
// and never reaches report/threshold-enforcement stdout, exactly what a CI
// consumer observes — while never renaming, backing up, or otherwise
// touching the real shared directory, so a broken/interrupted test run
// can't strand or clobber real collected evidence and concurrent
// invocations (another guard test, a real `vp exec playwright test` run)
// can't race for the same path.
//
// (1) Malformed JSON in a *.json file under the coverage dir must fail the
//     whole merge immediately, naming the file — never warn+continue
//     (which previously let the merge complete on unit-only data while
//     still printing "all thresholds met").
// (2) A well-formed but entirely non-executing browser-coverage payload
//     (matches the bundle URL, but reports zero executed V8 ranges — e.g. a
//     broken collector that started/stopped coverage without ever really
//     driving the page) must also fail the merge, rather than silently
//     merging a no-op coverage map and reporting a "sound" merged result
//     that in fact carries zero real browser signal.
//
// Gated behind SOCIALCALC_BROWSER_COVERAGE_TEST=1 (same flag
// test/browser-coverage-mapping.test.ts uses): belongs to the same
// sequenced "merger regression" step in package.json's test:coverage:merged
// (run only after a real `SOCIALCALC_COVERAGE=1 vp test --coverage` has
// produced a real coverage/coverage-final.json — this file only READS that
// path, via the merge script's own precondition check, never writes it).

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(repoRoot, "dist");
const bundlePath = join(distDir, "SocialCalc.js");
const mapPath = join(distDir, "SocialCalc.js.map");
const unitFinalPath = join(repoRoot, "coverage", "coverage-final.json");
const mergeScriptPath = join(repoRoot, "scripts", "merge-browser-coverage.mjs");
const vpBin = join(repoRoot, "node_modules", ".bin", "vp");

const guardTestEnabled = process.env.SOCIALCALC_BROWSER_COVERAGE_TEST === "1";

// Fresh, unique, isolated temp directory per test run — never the shared
// repo-root coverage-browser-v8/. Created once in beforeAll and removed
// once in afterAll; each test clears its own contents in beforeEach so one
// test's fixture can't leak into the next.
let tempDir: string | undefined;

function runMergeScript(): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [mergeScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, SOCIALCALC_BROWSER_COVERAGE_DIR: tempDir },
    });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return {
      status: err.status ?? -1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

function unitCoverageAvailable(): boolean {
  if (existsSync(unitFinalPath)) return true;
  console.warn(
    `[merge-browser-coverage-guard] ${unitFinalPath} missing — run ` +
      `\`SOCIALCALC_COVERAGE=1 vp test --coverage\` first; these guard tests only have real ` +
      `preconditions to exercise alongside a genuine unit coverage result.`,
  );
  return false;
}

beforeAll(() => {
  if (!guardTestEnabled) return;

  // Ensure a coverage-mode build of dist/SocialCalc.js + .js.map exists —
  // same idempotent pattern as test/browser-coverage-mapping.test.ts. The
  // merge script refuses to run at all without these.
  const alreadyCoverageBuilt =
    existsSync(mapPath) && readFileSync(bundlePath, "utf8").includes("sourceMappingURL");
  if (!alreadyCoverageBuilt) {
    execFileSync(vpBin, ["build"], {
      cwd: repoRoot,
      env: { ...process.env, SOCIALCALC_COVERAGE: "1" },
      stdio: "pipe",
    });
  }

  tempDir = mkdtempSync(join(tmpdir(), "socialcalc-browser-coverage-guard-"));
});

afterAll(() => {
  if (!guardTestEnabled) return;
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
  if (!guardTestEnabled || !tempDir) return;
  // Every test starts from a clean, empty temp dir so the script's
  // aggregate (processedFiles/convertedRanges) guard is exercised against
  // exactly the one fixture file each test writes — no signal from a
  // sibling test's fixture can mask a failure.
  rmSync(tempDir, { recursive: true, force: true });
  tempDir = mkdtempSync(join(tmpdir(), "socialcalc-browser-coverage-guard-"));
});

afterEach(() => {
  if (!guardTestEnabled || !tempDir) return;
  rmSync(tempDir, { recursive: true, force: true });
});

const guardDescribe = guardTestEnabled ? describe : describe.skip;

guardDescribe("scripts/merge-browser-coverage.mjs: fail-open guards (focused tooling)", () => {
  test("malformed JSON in a browser-coverage file fails the merge immediately, naming the file, before any report is produced", () => {
    if (!unitCoverageAvailable()) {
      test.skip("coverage/coverage-final.json is unavailable");
      return;
    }
    writeFileSync(join(tempDir!, "malformed-guard-fixture.json"), "{ not valid json", "utf8");

    const result = runMergeScript();

    expect(result.status, "merge script must exit nonzero on malformed input").not.toBe(0);
    expect(result.stderr, "error must name the offending file").toContain(
      "malformed-guard-fixture.json",
    );
    expect(result.stderr, "error must say the JSON was malformed").toMatch(/malformed JSON/i);
    // Never reaches report generation: proves this is a fail-fast guard, not
    // a warn-then-continue that happens to trip a later threshold check.
    expect(result.stdout, "must never print the per-file report on this failure").not.toContain(
      "per-file merged result",
    );
    expect(result.stdout, "must never claim thresholds were met").not.toContain(
      "all thresholds met",
    );
  });

  test("a browser-coverage file whose only entry executed zero real V8 ranges fails the merge instead of silently reporting unit-only coverage as a merged result", () => {
    if (!unitCoverageAvailable()) {
      test.skip("coverage/coverage-final.json is unavailable");
      return;
    }
    const bundleCode = readFileSync(bundlePath, "utf8");
    const fixture = {
      testTitle: "no-op probe (guard test)",
      testId: "guard-no-convert-1",
      entries: [
        {
          url: "http://127.0.0.1:9999/dist/SocialCalc.js",
          scriptId: "1",
          source: bundleCode,
          // A broken collector that started/stopped coverage without the
          // page ever actually executing the bundle reports this shape:
          // matches the bundle URL, byte-identical source, but zero
          // executed ranges. Must not be treated as real browser signal.
          functions: [],
        },
      ],
    };
    writeFileSync(
      join(tempDir!, "no-convert-guard-fixture.json"),
      JSON.stringify(fixture),
      "utf8",
    );

    const result = runMergeScript();

    expect(
      result.status,
      "merge script must exit nonzero when no browser entry converts real coverage",
    ).not.toBe(0);
    expect(result.stderr, "error must mention zero converted ranges").toMatch(
      /convertedRanges=0/,
    );
    expect(result.stdout, "must never print the per-file report on this failure").not.toContain(
      "per-file merged result",
    );
    expect(result.stdout, "must never claim thresholds were met").not.toContain(
      "all thresholds met",
    );
  });

  test("a browser-coverage entry for the bundle URL with no \"source\" field fails the merge instead of silently trusting unverifiable V8 ranges", () => {
    if (!unitCoverageAvailable()) {
      test.skip("coverage/coverage-final.json is unavailable");
      return;
    }
    // A truncated/forged collector payload — or a future Playwright version
    // that stops always populating `source` — can match the bundle URL and
    // report real-looking executed ranges while omitting the one field the
    // merge script uses to prove those ranges belong to the on-disk bundle.
    // Without `source`, the byte-identity check has nothing to compare
    // against; the merge must refuse rather than silently skip the check
    // and accept unverifiable ranges as real browser signal.
    const fixture = {
      testTitle: "missing-source probe (guard test)",
      testId: "guard-no-source-1",
      entries: [
        {
          url: "http://127.0.0.1:9999/dist/SocialCalc.js",
          scriptId: "1",
          // `source` deliberately omitted.
          functions: [
            { functionName: "fake", isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 10, count: 5 }] },
          ],
        },
      ],
    };
    writeFileSync(
      join(tempDir!, "no-source-guard-fixture.json"),
      JSON.stringify(fixture),
      "utf8",
    );

    const result = runMergeScript();

    expect(
      result.status,
      "merge script must exit nonzero when a bundle-URL entry has no source field",
    ).not.toBe(0);
    expect(result.stderr, "error must name the offending file").toContain(
      "no-source-guard-fixture.json",
    );
    expect(result.stderr, "error must say the source field is missing").toMatch(
      /missing its "source" field/,
    );
    expect(result.stdout, "must never print the per-file report on this failure").not.toContain(
      "per-file merged result",
    );
    expect(result.stdout, "must never claim thresholds were met").not.toContain(
      "all thresholds met",
    );
  });
});
