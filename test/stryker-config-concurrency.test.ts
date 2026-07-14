// Config-load coverage for the native Stryker/Vitest runner. The config reads
// its scope and concurrency from process.env at module-load time, so each case
// imports a fresh module under an isolated environment snapshot.

import { describe, expect, test } from "vite-plus/test";

const CONFIG_ENV_KEYS = [
  "MUTATE_SCOPE",
  "MUTATE_TARGET",
  "MUTATE_TESTS",
  "SOCIALCALC_MUTATION_TESTS",
  "STRYKER_CONCURRENCY",
] as const;

interface StrykerOptionsShape {
  concurrency: number;
  coverageAnalysis: string;
  mutate: string[];
  testRunner: string;
  vitest: { configFile: string; related: boolean };
  commandRunner?: unknown;
}

interface LoadedConfig {
  config: StrykerOptionsShape;
  mutationTestFiles: string[] | undefined;
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
    return { config: mod.default, mutationTestFiles };
  } finally {
    for (const key of CONFIG_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("stryker.config.mjs native Vitest runner", () => {
  test("uses per-test Vitest mutation coverage without a per-mutant command", async () => {
    const { config, mutationTestFiles } = await loadConfig({});
    expect(config).toMatchObject({
      testRunner: "vitest",
      coverageAnalysis: "perTest",
      vitest: { configFile: "vite.config.ts", related: false },
      concurrency: 4,
    });
    expect(config.commandRunner).toBeUndefined();
    expect(mutationTestFiles).toBeUndefined();
  });

  test("critical scope selects the three formula modules and their focused tests", async () => {
    const { config, mutationTestFiles } = await loadConfig({ MUTATE_SCOPE: "critical" });
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
    expect(mutationTestFiles).toContain("test/popup-viewer-coverage.test.ts");
    expect(mutationTestFiles).not.toContain("test/formula-ref-mutation-survivors.test.ts");
  });

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
});
