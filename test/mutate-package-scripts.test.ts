// Package-script contract for the mutate:* entry points that `vp run`
// invokes. Nested `vp node …` under `vp run` fails with "Command node not
// found" because the managed PATH does not re-expose node to the nested
// invocation. These scripts must therefore invoke `node …` directly, matching
// test:package-contract / check:test-credibility / etc. This is a config
// smoke only — it never launches Stryker.

import { describe, expect, test } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
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

  test("mutate:file forwards the selected module into Stryker configuration", () => {
    const temp = mkdtempSync(join(tmpdir(), "socialcalc-mutate-file-"));
    const capture = join(temp, "env.txt");
    const fakeVp = join(temp, "vp");
    writeFileSync(
      fakeVp,
      `#!/bin/sh\nprintf '%s\\n%s\\n%s\\n%s\\n' "$MUTATE_TARGET" "$MUTATE_PARTIAL_RANGE" "$MUTATE_TESTS" "$*" > "$CAPTURE"\n`,
    );
    chmodSync(fakeVp, 0o755);

    try {
      const result = spawnSync(
        process.execPath,
        [join(root, "stryker-file.mjs"), "js/formula1.ts", "1815-1821"],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            CAPTURE: capture,
            PATH: `${temp}${delimiter}${process.env.PATH ?? ""}`,
          },
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const [target, partialRange, tests, args] = readFileSync(capture, "utf8")
        .trimEnd()
        .split("\n");
      expect(target).toBe("js/formula1.ts");
      expect(partialRange).toBe("1");
      expect(tests).toContain("test/formula-coverage.test.ts");
      expect(args).toContain("--mutate js/formula1.ts:1815-1821");
      expect(args).toContain("--incrementalFile .stryker-tmp/incremental-formula1-partial.json");
    } finally {
      rmSync(temp, { force: true, recursive: true });
    }
  });

  test("mutate:release-gate points at the release-gate script", () => {
    expect(pkg.scripts["mutate:release-gate"]).toBe("node scripts/mutate-release-gate.mjs");
  });
});
