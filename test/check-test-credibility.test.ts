// Guard self-test: scripts/check-test-credibility.mjs must scan BOTH
// `test/**/*.test.ts` (Vitest) and `e2e/**/*.spec.ts` (Playwright) — not
// just the former. This exercises the guard against the real, currently
// tracked repo tree (no synthetic fixture repo/mocked git output): if a
// future edit narrows the glob back to `test/**/*.test.ts` only, or a
// future e2e helper accidentally gets swept in, this fails on real,
// observable output from the guard's own exported functions.
import { describe, expect, test } from "vite-plus/test";
import { checkFile, listTrackedTestFiles } from "../scripts/check-test-credibility.mjs";

describe("check-test-credibility.mjs: e2e/**/*.spec.ts coverage", () => {
  const files = listTrackedTestFiles();

  test("includes tracked e2e/**/*.spec.ts files, not just test/**/*.test.ts", () => {
    const e2eSpecs = files.filter((f) => f.startsWith("e2e/"));
    const unitTests = files.filter((f) => f.startsWith("test/"));

    // Both globs must contribute real, currently-tracked files — this
    // fails loudly (rather than silently passing on an empty match) if
    // either e2e/ or test/ is ever removed from the branch or the glob.
    expect(e2eSpecs.length).toBeGreaterThan(0);
    expect(unitTests.length).toBeGreaterThan(0);

    for (const f of e2eSpecs) {
      expect(f).toMatch(/^e2e\/.*\.spec\.ts$/);
    }
  });

  test("excludes e2e helper/fixture files that are not *.spec.ts", () => {
    // e2e/fixtures/editor.ts, e2e/server.ts, e2e/tsconfig.json are real,
    // currently-tracked files in this branch's e2e/ directory that support
    // the spec files but assert nothing themselves — the guard must never
    // scan them as if they were tests.
    expect(files).not.toContain("e2e/fixtures/editor.ts");
    expect(files).not.toContain("e2e/server.ts");
    expect(files).not.toContain("e2e/tsconfig.json");
  });

  test("excludes test/ generated/vendor/oracle data by the same *.test.ts convention", () => {
    expect(files).not.toContain("test/fixtures/oracle-3.0.8/MANIFEST.json");
    expect(files).not.toContain("test/fixtures/oracle-3.0.8/SocialCalc.bundle.txt");
    expect(files).not.toContain("test/helpers/oracle.ts");
  });

  test("checkFile() runs the same anti-pattern scan against a real e2e spec file", () => {
    const target = files.find((f) => f.startsWith("e2e/") && f.endsWith(".spec.ts"));
    expect(target).toBeDefined();
    // This must not throw (proves checkFile()'s catch-block/tautology scan
    // runs cleanly on real e2e source, not just test/ source) and must
    // return the same { violations, cleanupCatches } shape used for
    // test/**/*.test.ts files.
    const result = checkFile(target as string);
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.cleanupCatches)).toBe(true);
  });
});
