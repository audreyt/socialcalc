// Config-load coverage for the hybrid Stryker runner. The config reads its
// scope and concurrency from process.env at module-load time, so each case
// imports a fresh module under an isolated environment snapshot.

import * as os from "node:os";

import { describe, expect, test, vi } from "vite-plus/test";
const defaultConcurrency = (parallelism: number) => Math.max(4, Math.min(8, parallelism));

const CONFIG_ENV_KEYS = [
  "MUTATE_SCOPE",
  "MUTATE_TARGET",
  "MUTATE_TESTS",
  "MUTATE_PARTIAL_RANGE",
  "MUTATE_SHARD",
  "MUTATE_SHARD_RANGE",
  "SOCIALCALC_COVERAGE",
  "SOCIALCALC_MUTATION_RUN",
  "SOCIALCALC_MUTATION_TESTS",
  "STRYKER_CONCURRENCY",
  "TEST_RUNNER_MAX_WORKERS",
] as const;

interface StrykerOptionsShape {
  buildCommand: string;
  concurrency: number;
  coverageAnalysis: string;
  mutate: string[];
  testRunner: string;
  vitest: { configFile: string; related: boolean };
  commandRunner?: { command: string };
  htmlReporter: { fileName: string };
  incrementalFile: string;
  jsonReporter: { fileName: string };
  thresholds: { break: number | null };
}

interface LoadedConfig {
  config: StrykerOptionsShape;
  mutationTestFiles: string[] | undefined;
  mutationRun: string | undefined;
}

async function loadConfig(
  env: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string>>,
): Promise<LoadedConfig> {
  const saved: Record<string, string | undefined> = {};
  for (const key of CONFIG_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
  try {
    const mod = (await import(
      /* @vite-ignore */ `../stryker.config.mjs?t=${Date.now()}-${Math.random()}`
    )) as {
      default: StrykerOptionsShape;
    };
    const mutationTestFiles = process.env.SOCIALCALC_MUTATION_TESTS
      ? (JSON.parse(process.env.SOCIALCALC_MUTATION_TESTS) as string[])
      : undefined;
    return {
      config: mod.default,
      mutationTestFiles,
      mutationRun: process.env.SOCIALCALC_MUTATION_RUN,
    };
  } finally {
    for (const key of CONFIG_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("stryker.config.mjs hybrid runner", () => {
  test("legacy all-files scope builds once before using the command runner", async () => {
    const { config, mutationRun, mutationTestFiles } = await loadConfig({});
    expect(config).toMatchObject({
      buildCommand: "vp build",
      testRunner: "command",
      coverageAnalysis: "off",
      commandRunner: { command: "vp test --maxWorkers=2" },
      concurrency: defaultConcurrency(os.availableParallelism()),
    });
    expect(mutationRun).toBe("1");
    expect(mutationTestFiles).toBeUndefined();
  });

  test("critical scope selects the three formula modules and their focused tests", async () => {
    const { config, mutationTestFiles } = await loadConfig({ MUTATE_SCOPE: "critical" });
    expect(config).toMatchObject({
      testRunner: "vitest",
      coverageAnalysis: "perTest",
      vitest: { configFile: "vite.config.ts", related: false },
    });
    expect(config.commandRunner).toBeUndefined();
    expect(config.mutate).toEqual([
      "js/formula-parse.ts",
      "js/formula-operand.ts",
      "js/formula-ref.ts",
    ]);
    expect(mutationTestFiles).toContain("test/formula-ref-mutation-survivors.test.ts");
    expect(mutationTestFiles).toContain("test/formula-operand-mutation-survivors.test.ts");
    expect(mutationTestFiles).toContain("test/formula-parse-mutation-survivors.test.ts");
  });

  test("formula1-only ownership stays off the critical PR gate", async () => {
    // Representative high-density formula1 suite from formula1OnlyTests —
    // must be owned by formula1 (MUTATE_TARGET) and absent from the critical
    // scope union (formula-parse/operand/ref via shared formulaOnlyTests only).
    const formula1OnlySuite = "test/formula-rank-median-quartile.test.ts";
    const { mutationTestFiles: formula1Tests } = await loadConfig({
      MUTATE_TARGET: "js/formula1.ts",
    });
    const { mutationTestFiles: criticalTests } = await loadConfig({
      MUTATE_SCOPE: "critical",
    });
    const { mutationTestFiles: parseTests } = await loadConfig({
      MUTATE_TARGET: "js/formula-parse.ts",
    });
    const { mutationTestFiles: operandTests } = await loadConfig({
      MUTATE_TARGET: "js/formula-operand.ts",
    });
    const { mutationTestFiles: refTests } = await loadConfig({
      MUTATE_TARGET: "js/formula-ref.ts",
    });
    expect(formula1Tests).toContain(formula1OnlySuite);
    expect(criticalTests).not.toContain(formula1OnlySuite);
    expect(parseTests).not.toContain(formula1OnlySuite);
    expect(operandTests).not.toContain(formula1OnlySuite);
    expect(refTests).not.toContain(formula1OnlySuite);
  });

  test("socialcalcconstants per-file scope keeps survivor and oracle-parity suites", async () => {
    // Both suites are required ownership for the constants matrix leg; a
    // mid-edit list truncation must fail closed rather than silently drop
    // either (oracle-parity was once dropped by an accidental SWAP range).
    const { config, mutationTestFiles } = await loadConfig({
      MUTATE_TARGET: "js/socialcalcconstants.ts",
    });
    expect(config.mutate).toEqual(["js/socialcalcconstants.ts"]);
    expect(mutationTestFiles).toContain("test/socialcalcconstants-mutation-survivors.test.ts");
    expect(mutationTestFiles).toContain("test/socialcalcconstants-oracle-parity.test.ts");
  });

  test("per-file scope passes its mapped test subset to Vitest", async () => {
    const { config, mutationTestFiles } = await loadConfig({
      MUTATE_TARGET: "js/socialcalcviewer.ts",
    });
    expect(config.mutate).toEqual(["js/socialcalcviewer.ts"]);
    expect(config.testRunner).toBe("vitest");
    expect(config.commandRunner).toBeUndefined();
    expect(mutationTestFiles).toContain("test/popup-viewer-coverage.test.ts");
    expect(mutationTestFiles).not.toContain("test/formula-ref-mutation-survivors.test.ts");
  });

  test("partial ranges use isolated reports, caches, and no full-module floor", async () => {
    const { config } = await loadConfig({
      MUTATE_TARGET: "js/formula1.ts",
      MUTATE_PARTIAL_RANGE: "100-220",
    });
    const { config: otherRange } = await loadConfig({
      MUTATE_TARGET: "js/formula1.ts",
      MUTATE_PARTIAL_RANGE: "221-240",
    });
    expect(config.testRunner).toBe("vitest");
    expect(config.thresholds.break).toBeNull();
    expect(config.htmlReporter.fileName).toBe("reports/mutation/formula1-partial/index.html");
    expect(config.jsonReporter.fileName).toBe("reports/mutation/formula1-partial/mutation.json");
    expect(config.incrementalFile).toBe(
      ".stryker-tmp/incremental-formula1-partial-100-220-build-once-v1.json",
    );
    expect(otherRange.incrementalFile).toBe(
      ".stryker-tmp/incremental-formula1-partial-221-240-build-once-v1.json",
    );
    expect(otherRange.incrementalFile).not.toBe(config.incrementalFile);
  });

  test("release shards use module-shard report dirs, range mutate spec, and no floor", async () => {
    const { config } = await loadConfig({
      MUTATE_TARGET: "js/formula1.ts",
      MUTATE_SHARD: "1",
      MUTATE_SHARD_RANGE: "1-7073",
    });
    expect(config.mutate).toEqual(["js/formula1.ts:1-7073"]);
    expect(config.testRunner).toBe("vitest");
    expect(config.thresholds.break).toBeNull();
    expect(config.htmlReporter.fileName).toBe("reports/mutation/formula1-shard-1/index.html");
    expect(config.jsonReporter.fileName).toBe("reports/mutation/formula1-shard-1/mutation.json");
    expect(config.incrementalFile).toBe(
      ".stryker-tmp/incremental-formula1-shard-1-build-once-v1.json",
    );
  });

  test("shard and partial range are mutually exclusive", async () => {
    await expect(
      loadConfig({
        MUTATE_TARGET: "js/formula1.ts",
        MUTATE_SHARD: "1",
        MUTATE_SHARD_RANGE: "1-7073",
        MUTATE_PARTIAL_RANGE: "100-220",
      }),
    ).rejects.toThrow(/mutually exclusive/);
  });

  test.each(["js/formatnumber2.ts", "js/socialcalcconstants.ts"])(
    "%s re-evaluates its top-level initializers in a fresh test process",
    async (mutationTarget) => {
      const { config } = await loadConfig({ MUTATE_TARGET: mutationTarget });
      expect(config.buildCommand).toBe("vp build");
      expect(config.testRunner).toBe("command");
      expect(config.coverageAnalysis).toBe("off");
      expect(config.commandRunner?.command).toMatch(/^vp test run --maxWorkers=2 /);
    },
  );

  test("an explicit MUTATE_TESTS list wins over the scope mapping", async () => {
    const { mutationTestFiles } = await loadConfig({
      MUTATE_TARGET: "js/socialcalcviewer.ts",
      MUTATE_TESTS: "test/viewer-a.test.ts test/viewer-b.test.ts",
    });
    expect(mutationTestFiles).toEqual(["test/viewer-a.test.ts", "test/viewer-b.test.ts"]);
  });

  test("default concurrency derives floor 4 and cap 8 from host parallelism", async () => {
    const cases = [
      [2, 4],
      [6, 6],
      [16, 8],
    ] as const;
    for (const [parallelism, expected] of cases) {
      vi.resetModules();
      vi.doMock("node:os", async () => ({
        ...(await vi.importActual("node:os")),
        availableParallelism: () => parallelism,
      }));
      try {
        const loaded = await loadConfig({});
        expect(loaded.config.concurrency).toBe(expected);
      } finally {
        vi.doUnmock("node:os");
        vi.resetModules();
      }
    }
  });

  test("STRYKER_CONCURRENCY accepts positive integers and rejects unsafe values", async () => {
    const overridden = await loadConfig({ STRYKER_CONCURRENCY: "8" });
    expect(overridden.config.concurrency).toBe(8);

    const expectedDefault = defaultConcurrency(os.availableParallelism());
    const invalid = await loadConfig({ STRYKER_CONCURRENCY: "-3" });
    expect(invalid.config.concurrency).toBe(expectedDefault);

    const nonNumeric = await loadConfig({ STRYKER_CONCURRENCY: "not-a-number" });
    expect(nonNumeric.config.concurrency).toBe(expectedDefault);
  });
  test("TEST_RUNNER_MAX_WORKERS only changes command-runner child pools", async () => {
    const command = await loadConfig({
      MUTATE_TARGET: "js/formatnumber2.ts",
      TEST_RUNNER_MAX_WORKERS: "6",
    });
    expect(command.config.commandRunner?.command).toMatch(/--maxWorkers=6\b/);

    const native = await loadConfig({
      MUTATE_TARGET: "js/socialcalcviewer.ts",
      TEST_RUNNER_MAX_WORKERS: "6",
    });
    expect(native.config.testRunner).toBe("vitest");
    expect(native.config.commandRunner).toBeUndefined();
  });
});
