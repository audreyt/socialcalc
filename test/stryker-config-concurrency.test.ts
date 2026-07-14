// Config-load smoke coverage for stryker.config.mjs's test-runner concurrency
// cap (see that file's TEST_RUNNER_MAX_WORKERS/STRYKER_CONCURRENCY comment
// for the measured timeout-storm/recovery evidence this test guards against
// regressing): Stryker's own `concurrency` spawns several `vp test` command-
// runner invocations at once, and each invocation's vitest pool defaults to
// nearly every logical core, so an uncapped pool means `concurrency`
// invocations each fighting for (cores - 1) workers. Without an explicit
// `--maxWorkers` on the test command, that oversubscription reproduces the
// exact timeout storm this branch fixes.
//
// stryker.config.mjs reads MUTATE_SCOPE/MUTATE_TARGET/MUTATE_TESTS/
// TEST_RUNNER_MAX_WORKERS/STRYKER_CONCURRENCY from `process.env` once, at
// module-load time, and has no runtime API to reconfigure afterward — the
// only way to observe how a given env combination resolves is to re-import
// the module fresh under that combination. A static top-level import would
// only ever observe the first env snapshot, so each case below intentionally
// dynamic-imports the config with a cache-busting query string after setting
// process.env (exercising the module's own load-time boundary, not routing
// around a static import that could work here).

import { describe, expect, test } from "vite-plus/test";

const CONFIG_ENV_KEYS = [
  "MUTATE_SCOPE",
  "MUTATE_TARGET",
  "MUTATE_TESTS",
  "TEST_RUNNER_MAX_WORKERS",
  "STRYKER_CONCURRENCY",
] as const;

interface StrykerOptionsShape {
  concurrency: number;
  mutate: string[];
  commandRunner: { command: string };
}

/** Re-imports stryker.config.mjs under a fresh env snapshot (see file header). */
async function loadConfig(
  env: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string>>,
): Promise<StrykerOptionsShape> {
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
    return mod.default;
  } finally {
    for (const key of CONFIG_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("stryker.config.mjs test-runner concurrency cap", () => {
  test("default (no MUTATE_SCOPE/MUTATE_TARGET) caps vitest workers and matches the measured default concurrency", async () => {
    const config = await loadConfig({});
    expect(config.commandRunner.command).toMatch(/--maxWorkers=2\b/);
    expect(config.concurrency).toBe(4);
  });

  test("MUTATE_SCOPE=critical still caps vitest workers on the filtered test command", async () => {
    const config = await loadConfig({ MUTATE_SCOPE: "critical" });
    expect(config.commandRunner.command).toMatch(/vp test run --maxWorkers=2 /);
    expect(config.mutate).toEqual([
      "js/formula-parse.ts",
      "js/formula-operand.ts",
      "js/formula-ref.ts",
    ]);
  });

  test("MUTATE_TARGET still caps vitest workers on the filtered test command", async () => {
    const config = await loadConfig({ MUTATE_TARGET: "js/socialcalc-3.ts" });
    expect(config.commandRunner.command).toMatch(/vp test run --maxWorkers=2 /);
    expect(config.mutate).toEqual(["js/socialcalc-3.ts"]);
  });

  test("TEST_RUNNER_MAX_WORKERS is env-overridable independent of STRYKER_CONCURRENCY", async () => {
    const config = await loadConfig({ TEST_RUNNER_MAX_WORKERS: "6" });
    expect(config.commandRunner.command).toMatch(/--maxWorkers=6\b/);
    expect(config.concurrency).toBe(4);
  });

  test("STRYKER_CONCURRENCY is env-overridable independent of TEST_RUNNER_MAX_WORKERS", async () => {
    const config = await loadConfig({ STRYKER_CONCURRENCY: "8" });
    expect(config.concurrency).toBe(8);
    expect(config.commandRunner.command).toMatch(/--maxWorkers=2\b/);
  });

  test("non-numeric or non-positive overrides fall back to the measured safe defaults, never NaN/0/negative", async () => {
    const config = await loadConfig({
      TEST_RUNNER_MAX_WORKERS: "not-a-number",
      STRYKER_CONCURRENCY: "-3",
    });
    expect(config.commandRunner.command).toMatch(/--maxWorkers=2\b/);
    expect(config.concurrency).toBe(4);
    expect(config.commandRunner.command).not.toMatch(/NaN/);
  });

  test("never runs Stryker's test command in-place: sandboxed vp build always precedes the capped test invocation", async () => {
    const config = await loadConfig({});
    expect(config.commandRunner.command.startsWith("vp build && ")).toBe(true);
  });
});
