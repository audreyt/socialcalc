// Config-load coverage for the hybrid Stryker runner. The config reads its
// scope and concurrency from process.env at module-load time, so each case
// imports a fresh module under an isolated environment snapshot.

import { describe, expect, test } from "vite-plus/test";

const CONFIG_ENV_KEYS = [
  "MUTATE_SCOPE",
  "MUTATE_TARGET",
  "MUTATE_TESTS",
  "MUTATE_PARTIAL_RANGE",
  "SOCIALCALC_MUTATION_RUN",
  "SOCIALCALC_MUTATION_TESTS",
  "STRYKER_CONCURRENCY",
  "TEST_RUNNER_MAX_WORKERS",
] as const;

interface StrykerOptionsShape {
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
  test("legacy all-files scope uses the rebuilding command runner", async () => {
    const { config, mutationRun, mutationTestFiles } = await loadConfig({});
    expect(config).toMatchObject({
      testRunner: "command",
      coverageAnalysis: "off",
      commandRunner: { command: expect.stringMatching(/^vp build && vp test --maxWorkers=2$/) },
      concurrency: 4,
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

  test("partial ranges use isolated reports and no full-module break floor", async () => {
    const { config } = await loadConfig({
      MUTATE_TARGET: "js/formula1.ts",
      MUTATE_PARTIAL_RANGE: "1",
    });
    expect(config.testRunner).toBe("vitest");
    expect(config.thresholds.break).toBeNull();
    expect(config.htmlReporter.fileName).toBe("reports/mutation/formula1-partial/index.html");
    expect(config.jsonReporter.fileName).toBe("reports/mutation/formula1-partial/mutation.json");
    expect(config.incrementalFile).toBe(".stryker-tmp/incremental-formula1-partial.json");
  });

  test.each(["js/formatnumber2.ts", "js/socialcalcconstants.ts"])(
    "%s rebuilds its top-level initializers for every mutant",
    async (mutationTarget) => {
      const { config } = await loadConfig({ MUTATE_TARGET: mutationTarget });
      expect(config.testRunner).toBe("command");
      expect(config.coverageAnalysis).toBe("off");
      expect(config.commandRunner?.command).toMatch(/^vp build && vp test run --maxWorkers=2 /);
    },
  );

  test("an explicit MUTATE_TESTS list wins over the scope mapping", async () => {
    const { mutationTestFiles } = await loadConfig({
      MUTATE_TARGET: "js/socialcalcviewer.ts",
      MUTATE_TESTS: "test/viewer-a.test.ts test/viewer-b.test.ts",
    });
    expect(mutationTestFiles).toEqual(["test/viewer-a.test.ts", "test/viewer-b.test.ts"]);
  });

  test("STRYKER_CONCURRENCY accepts positive integers and rejects unsafe values", async () => {
    const overridden = await loadConfig({ STRYKER_CONCURRENCY: "8" });
    expect(overridden.config.concurrency).toBe(8);

    const invalid = await loadConfig({ STRYKER_CONCURRENCY: "-3" });
    expect(invalid.config.concurrency).toBe(4);

    const nonNumeric = await loadConfig({ STRYKER_CONCURRENCY: "not-a-number" });
    expect(nonNumeric.config.concurrency).toBe(4);
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
