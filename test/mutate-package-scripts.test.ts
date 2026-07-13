// Package-script contract for the mutate:* entry points that `vp run`
// invokes. Nested `vp node …` under `vp run` fails with "Command node not
// found" because the managed PATH does not re-expose node to the nested
// invocation. These scripts must therefore invoke `node …` directly, matching
// test:package-contract / check:test-credibility / etc. This is a config
// smoke only — it never launches Stryker.

import { describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const MUTATE_VP_RUN_SCRIPTS = [
  "mutate:file",
  "mutate:format",
  "mutate:sheet",
  "mutate:formula",
  "mutate:all",
  "mutate:release-gate",
] as const;

describe("mutate package scripts for vp run", () => {
  test("use direct node, never nested vp node", () => {
    for (const name of MUTATE_VP_RUN_SCRIPTS) {
      const body = pkg.scripts[name];
      expect(body, name).toBeDefined();
      expect(body, name).toMatch(/^node\s+/);
      expect(body, name).not.toMatch(/\bvp\s+node\b/);
    }
  });

  test("mutate:all points at the sequential orchestrator without launching Stryker", () => {
    expect(pkg.scripts["mutate:all"]).toBe("node scripts/mutate-all.mjs");
    const src = readFileSync(join(root, "scripts/mutate-all.mjs"), "utf8");
    expect(src).toMatch(/ALL_MUTATE_FILES/);
    expect(src).toMatch(/MUTATE_TARGET/);
    expect(src).toMatch(/spawnSync\(\s*["']vp["']/);
    expect(src).toMatch(/stryker/);
  });

  test("mutate:release-gate points at the release-gate script", () => {
    expect(pkg.scripts["mutate:release-gate"]).toBe("node scripts/mutate-release-gate.mjs");
  });
});
