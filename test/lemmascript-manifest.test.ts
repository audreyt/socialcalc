// Focused coverage for scripts/lemmascript-manifest.mjs: the manifest parser's
// path-safety allowlist (no shell injection / path traversal from
// LemmaScript-files.txt content), the non-empty-artifact assertion, the CLI's
// exact per-facade subprocess dispatch, and the package.json/workflow
// contracts that route verify:dafny:regen / verify:lean:gen / verify:lean /
// the lemmascript.yml lean-gen job through this script instead of a
// hand-maintained per-facade chain.

import { describe, expect, test } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNonEmpty,
  leanArtifactsFor,
  parseManifestEntries,
  readManifest,
  repoRoot,
  validateManifestPath,
} from "../scripts/lemmascript-manifest.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/lemmascript-manifest.mjs", import.meta.url));
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("parseManifestEntries", () => {
  test("parses one path per line, in order, skipping blank lines", () => {
    const entries = parseManifestEntries(
      "lemma/a1.ts\n\nlemma/eval-ops.ts\nlemma/lookup-result.ts\n\nlemma/spill.ts\n",
    );
    expect(entries).toEqual([
      "lemma/a1.ts",
      "lemma/eval-ops.ts",
      "lemma/lookup-result.ts",
      "lemma/spill.ts",
    ]);
  });

  test("ignores lsc's own optional [timeout] [extra flags] trailing fields", () => {
    // LemmaScript-files.txt is shared with lsc's own `readEntries` batcher,
    // which parses `file [timeout] [extra dafny flags...]` per line for
    // check-mode >60s-timeout handling. A slow-facade entry must keep
    // verify:dafny (lsc's batcher) AND this script's regen/lean-gen/
    // assert-lean green — so only the first token is treated as the path.
    const entries = parseManifestEntries(
      "lemma/a1.ts\nlemma/eval-ops.ts 120 --extra-flags=--boogie-arg\n",
    );
    expect(entries).toEqual(["lemma/a1.ts", "lemma/eval-ops.ts"]);
  });

  test("still validates the first token even with trailing fields present", () => {
    expect(() => parseManifestEntries("/etc/passwd 60\n")).toThrow(
      /LemmaScript-files\.txt:1: rejected path/,
    );
  });

  test("error identifies the exact malformed line number, not just the first", () => {
    expect(() => parseManifestEntries("lemma/a1.ts\n/etc/passwd 60\n")).toThrow(
      /LemmaScript-files\.txt:2:/,
    );
  });
});

describe("validateManifestPath — shell-injection / path-traversal allowlist", () => {
  test("accepts a well-formed lemma/<name>.ts entry", () => {
    expect(validateManifestPath("lemma/a1.ts", 1)).toBe("lemma/a1.ts");
    expect(validateManifestPath("lemma/weekday-policy.ts", 1)).toBe("lemma/weekday-policy.ts");
  });

  test("rejects parent-directory traversal", () => {
    expect(() => validateManifestPath("lemma/../../../etc/passwd", 1)).toThrow(/rejected path/);
  });

  test("rejects an absolute path", () => {
    expect(() => validateManifestPath("/etc/passwd", 1)).toThrow(/rejected path/);
  });

  test("rejects a nested subdirectory under lemma/", () => {
    expect(() => validateManifestPath("lemma/sub/a1.ts", 1)).toThrow(/rejected path/);
  });

  test("rejects a path outside lemma/", () => {
    expect(() => validateManifestPath("js/formula1.ts", 1)).toThrow(/rejected path/);
  });

  test("rejects shell metacharacters embedded in the entry", () => {
    for (const payload of [
      "lemma/a1.ts; rm -rf /",
      "lemma/a1.ts && echo pwned",
      "lemma/$(whoami).ts",
      "lemma/`whoami`.ts",
      "lemma/a1.ts|cat /etc/passwd",
    ]) {
      expect(() => validateManifestPath(payload, 1), payload).toThrow(/rejected path/);
    }
  });

  test("rejects a non-.ts extension", () => {
    expect(() => validateManifestPath("lemma/a1.dfy", 1)).toThrow(/rejected path/);
  });

  test("includes the offending line number in every rejection", () => {
    expect(() => validateManifestPath("/etc/passwd", 7)).toThrow(/LemmaScript-files\.txt:7:/);
  });
});

describe("readManifest — real LemmaScript-files.txt", () => {
  test("returns the exact tracked facade list, in file order", () => {
    expect(readManifest()).toEqual([
      "lemma/a1.ts",
      "lemma/eval-ops.ts",
      "lemma/lookup-result.ts",
      "lemma/spill.ts",
    ]);
  });
});

describe("leanArtifactsFor", () => {
  test("derives the exact three generated/hand-written Lean paths for one facade", () => {
    expect(leanArtifactsFor("lemma/a1.ts")).toEqual([
      "lemma/a1.types.lean",
      "lemma/a1.def.lean",
      "lemma/a1.proof.lean",
    ]);
    expect(leanArtifactsFor("lemma/spill.ts")).toEqual([
      "lemma/spill.types.lean",
      "lemma/spill.def.lean",
      "lemma/spill.proof.lean",
    ]);
  });
});

describe("assertNonEmpty", () => {
  test("throws a missing-artifact error for a nonexistent path", () => {
    const temp = mkdtempSync(join(tmpdir(), "socialcalc-lemmascript-assert-"));
    try {
      const missing = relative(repoRoot, join(temp, "does-not-exist.lean"));
      expect(() => assertNonEmpty(missing)).toThrow(/missing artifact:/);
    } finally {
      rmSync(temp, { force: true, recursive: true });
    }
  });

  test("throws an empty-artifact error for a zero-byte file", () => {
    const temp = mkdtempSync(join(tmpdir(), "socialcalc-lemmascript-assert-"));
    try {
      const emptyFile = join(temp, "empty.lean");
      writeFileSync(emptyFile, "");
      expect(() => assertNonEmpty(relative(repoRoot, emptyFile))).toThrow(/empty artifact:/);
    } finally {
      rmSync(temp, { force: true, recursive: true });
    }
  });

  test("does not throw for a non-empty file", () => {
    const temp = mkdtempSync(join(tmpdir(), "socialcalc-lemmascript-assert-"));
    try {
      const fullFile = join(temp, "full.lean");
      writeFileSync(fullFile, "content");
      expect(() => assertNonEmpty(relative(repoRoot, fullFile))).not.toThrow();
    } finally {
      rmSync(temp, { force: true, recursive: true });
    }
  });
});

describe("CLI — regen / lean-gen dispatch exact per-facade lsc invocation", () => {
  function withFakeLsc(recordArgsScript: string) {
    const temp = mkdtempSync(join(tmpdir(), "socialcalc-lemmascript-cli-"));
    const capture = join(temp, "calls.txt");
    const fakeLsc = join(temp, "lsc");
    writeFileSync(fakeLsc, recordArgsScript);
    chmodSync(fakeLsc, 0o755);
    return { temp, capture, fakeLsc };
  }

  test("regen invokes `lsc regen --backend=dafny <file>` once per manifest entry, in order", () => {
    const { temp, capture } = withFakeLsc(
      `#!/bin/sh\nprintf '%s\\n' "$*" >> "${join(mkdtempSync(join(tmpdir(), "x-")), "unused")}" 2>/dev/null; exit 0\n`,
    );
    // Rewrite with the real capture path now that it's known.
    const fakeLsc = join(temp, "lsc");
    writeFileSync(fakeLsc, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${capture}"\nexit 0\n`);
    chmodSync(fakeLsc, 0o755);
    try {
      const result = spawnSync(process.execPath, [scriptPath, "regen"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, PATH: `${temp}${delimiter}${process.env.PATH ?? ""}` },
      });
      expect(result.status, result.stderr).toBe(0);
      const calls = readFileSync(capture, "utf8").trimEnd().split("\n");
      expect(calls).toEqual([
        "regen --backend=dafny lemma/a1.ts",
        "regen --backend=dafny lemma/eval-ops.ts",
        "regen --backend=dafny lemma/lookup-result.ts",
        "regen --backend=dafny lemma/spill.ts",
      ]);
    } finally {
      rmSync(temp, { force: true, recursive: true });
    }
  });

  test("lean-gen invokes `lsc gen --backend=lean <file>` once per manifest entry, in order", () => {
    const temp = mkdtempSync(join(tmpdir(), "socialcalc-lemmascript-cli-"));
    const capture = join(temp, "calls.txt");
    const fakeLsc = join(temp, "lsc");
    writeFileSync(fakeLsc, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${capture}"\nexit 0\n`);
    chmodSync(fakeLsc, 0o755);
    try {
      const result = spawnSync(process.execPath, [scriptPath, "lean-gen"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, PATH: `${temp}${delimiter}${process.env.PATH ?? ""}` },
      });
      expect(result.status, result.stderr).toBe(0);
      const calls = readFileSync(capture, "utf8").trimEnd().split("\n");
      expect(calls).toEqual([
        "gen --backend=lean lemma/a1.ts",
        "gen --backend=lean lemma/eval-ops.ts",
        "gen --backend=lean lemma/lookup-result.ts",
        "gen --backend=lean lemma/spill.ts",
      ]);
    } finally {
      rmSync(temp, { force: true, recursive: true });
    }
  });

  test("a failing lsc invocation aborts the loop with a nonzero exit", () => {
    const temp = mkdtempSync(join(tmpdir(), "socialcalc-lemmascript-cli-"));
    const capture = join(temp, "calls.txt");
    const fakeLsc = join(temp, "lsc");
    // Fail on the second call (eval-ops) to prove regen doesn't silently
    // continue past a real lsc failure.
    writeFileSync(
      fakeLsc,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> "${capture}"\ncase "$*" in *eval-ops*) exit 1;; esac\nexit 0\n`,
    );
    chmodSync(fakeLsc, 0o755);
    try {
      const result = spawnSync(process.execPath, [scriptPath, "regen"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, PATH: `${temp}${delimiter}${process.env.PATH ?? ""}` },
      });
      expect(result.status).not.toBe(0);
      const calls = readFileSync(capture, "utf8").trimEnd().split("\n");
      // Only a1 and eval-ops ran; lookup-result/spill never got a chance.
      expect(calls).toEqual([
        "regen --backend=dafny lemma/a1.ts",
        "regen --backend=dafny lemma/eval-ops.ts",
      ]);
    } finally {
      rmSync(temp, { force: true, recursive: true });
    }
  });
});

describe("CLI — assert-lean against the real repo", () => {
  test("passes for every manifest facade including spill (closes the prior CI gap)", () => {
    const result = spawnSync(process.execPath, [scriptPath, "assert-lean"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("4 facade(s)");
    expect(result.stdout).toContain("spill");
  });

  test("the composed missing-artifact check (what assert-lean runs per facade) fails loud", () => {
    // assertLean() internally does exactly this composition
    // (leanArtifactsFor(file).forEach(assertNonEmpty)) for every manifest
    // entry; exercising it directly proves the failure path without
    // mutating the tracked manifest or generated proof artifacts.
    expect(() => leanArtifactsFor("lemma/does-not-exist.ts").forEach(assertNonEmpty)).toThrow(
      /missing artifact: lemma\/does-not-exist\.types\.lean/,
    );
  });
});

describe("CLI — usage/error surface", () => {
  test("exits nonzero with a usage message when no subcommand is given", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Usage: node scripts\/lemmascript-manifest\.mjs/);
  });

  test("exits nonzero with a usage message for an unknown subcommand", () => {
    const result = spawnSync(process.execPath, [scriptPath, "bogus"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Usage: node scripts\/lemmascript-manifest\.mjs/);
  });
});

describe("package.json verify:* scripts route through the manifest tool", () => {
  test("verify:dafny and verify:dafny:gen stay bare lsc batch calls (no per-file chain)", () => {
    expect(pkg.scripts["verify:dafny"]).toBe("lsc check --backend=dafny");
    expect(pkg.scripts["verify:dafny:gen"]).toBe("lsc gen --backend=dafny");
  });

  test("verify:dafny:regen / verify:lean:gen / verify:lean call the manifest script directly", () => {
    expect(pkg.scripts["verify:dafny:regen"]).toBe("node scripts/lemmascript-manifest.mjs regen");
    expect(pkg.scripts["verify:lean:gen"]).toBe("node scripts/lemmascript-manifest.mjs lean-gen");
    expect(pkg.scripts["verify:lean"]).toBe(
      "vp run verify:lean:gen && node scripts/lemmascript-manifest.mjs assert-lean",
    );
  });

  test("no verify:* script hand-lists an individual lemma/*.ts facade path", () => {
    for (const [name, body] of Object.entries(pkg.scripts)) {
      if (!name.startsWith("verify:")) continue;
      expect(body, name).not.toMatch(/lemma\/[a-z-]+\.ts/);
    }
  });
});

describe("lemmascript.yml lean-gen job routes through the manifest tool", () => {
  test("the non-empty assertion step calls the script instead of a hand-listed test -s chain", () => {
    const workflow = readFileSync(join(repoRoot, ".github/workflows/lemmascript.yml"), "utf8");
    expect(workflow).toMatch(
      /Assert Lean artifacts non-empty\n\s+run: node scripts\/lemmascript-manifest\.mjs assert-lean/,
    );
    expect(workflow).not.toMatch(/test -s lemma\//);
  });
});
