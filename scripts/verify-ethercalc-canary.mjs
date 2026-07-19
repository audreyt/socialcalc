#!/usr/bin/env node
// Release canary: proves that a pinned, immutable audreyt/ethercalc commit's
// @ethercalc/socialcalc-headless package can actually consume the CURRENT
// SocialCalc candidate — not the last npm-published release — by packing
// this repo through `vp pm pack`, regenerating EtherCalc's embedded headless
// bundle from that exact tarball's dist/SocialCalc.js, and running the
// package's real current headless test suite against it. This is the
// automated form of the manual candidate-tarball canary that previously
// gated SocialCalc releases by hand before publish.
//
// Supply-chain determinism: everything EXCEPT the SocialCalc candidate
// itself comes from the pinned commit's own bun.lock via
// `bun install --frozen-lockfile` (fails loudly if the lockfile would need
// to change) — same wrangler/vitest/workers-types/pool-workers/typescript
// versions EtherCalc's own CI tests against, not freshly re-resolved ranges.
// The candidate is then swapped in as a pure node_modules/socialcalc
// filesystem replacement (extract the tarball, hash-verify) — no
// package.json or bun.lock is ever written, which is itself the proof that
// the rest of the installed tree stayed exactly as locked.
//
// NOT part of `vp test` (vite.config.ts's test.include is scoped to
// "test/**/*.test.ts", which this file is not — see
// scripts/verify-package-contract.mjs for the same precedent/rationale):
// this canary needs network (fetch the pinned EtherCalc commit, `bun
// install --frozen-lockfile` its locked dependency tree) and is
// release-time-only. Invoke explicitly: `vp run test:ethercalc-canary` or
// `node scripts/verify-ethercalc-canary.mjs`.
//
// Every SocialCalc-side step goes through `vp` (never a bare npm/bun
// command in this repo). The pinned EtherCalc commit is fetched fresh into
// an isolated temp directory and installed with EtherCalc's own tooling
// (bun — its package.json declares `engines.bun` and ships a bun.lock);
// EtherCalc itself is never vendored into this repo, only ever a throwaway
// temp checkout that is always removed before this script exits.
//
// Local tandem rehearsal: SC_ETHERCALC_REPO / SC_ETHERCALC_SHA override the
// repo/commit above for a local, committed sibling checkout (see the
// "Local tandem rehearsal overrides" section below) - unset, this script's
// behavior is unchanged. A temporary SocialCalc.Workbook behavioral smoke
// is always injected and cleaned up after bundle regeneration, proving the
// candidate exposes the real multi-sheet API - see step 8.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// --- Provenance: pinned immutable EtherCalc commit --------------------------
// Full 40-hex SHA of audreyt/ethercalc's `main` branch tip, researched
// 2026-07-12. A git commit SHA is content-addressed and immutable no matter
// which ref later moves past it — this script always fetches exactly this
// object (never a branch/tag name) and verifies the checkout matches it
// exactly before doing anything else with it (see "provenance:" check below).
const ETHERCALC_REPO = "https://github.com/audreyt/ethercalc.git";
const ETHERCALC_PINNED_SHA = "8674374d2a4da7aff7004b6e7bdf35a310ad1aab";
const ETHERCALC_PINNED_DATE = "2026-07-12T01:23:14+08:00";
const ETHERCALC_PINNED_SUBJECT = "chore: remove obsolete pre-rewrite deployment/legacy files";
const HEADLESS_WORKSPACE = "@ethercalc/socialcalc-headless";
const HEADLESS_SUBDIR = "packages/socialcalc-headless";

// --- Local tandem rehearsal overrides ---------------------------------------
// Everything above is the deterministic, reproducible release-pin. These
// env vars exist ONLY so a local tandem SocialCalc/EtherCalc rehearsal can
// point this canary at a committed sibling checkout (repo URL OR a local
// filesystem path - `git remote add origin <path>` accepts either) and its
// exact tip SHA, without weakening the canary's core guarantee: whichever
// source/SHA is in effect, this script still fetches and hard-verifies that
// EXACT commit object before doing anything else with it (see "provenance:"
// below) - never a branch/tag name, overridden or not. Unset either/both and
// source selection retains the hardcoded release-pin defaults above.
const ETHERCALC_REPO_ENV = "SC_ETHERCALC_REPO";
const ETHERCALC_SHA_ENV = "SC_ETHERCALC_SHA";

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

/**
 * Validates a full, unambiguous 40-character lowercase-hex git commit SHA.
 * Short/abbreviated SHAs are rejected on purpose: this canary's whole
 * immutability guarantee rests on fetching and verifying one exact
 * content-addressed object, and a short SHA's resolution is ambiguous
 * (depends on repo history and the local object cache) in a way a full SHA
 * is not - see the ETHERCALC_PINNED_SHA doc comment above.
 */
export function validateShaOverride(sha) {
  if (typeof sha !== "string" || sha.trim().length === 0) {
    throw new Error(`${ETHERCALC_SHA_ENV} must be a non-empty string if set`);
  }
  const trimmed = sha.trim();
  if (!FULL_SHA_RE.test(trimmed)) {
    throw new Error(
      `${ETHERCALC_SHA_ENV}=${JSON.stringify(sha)} is not a full 40-character lowercase-hex git commit SHA ` +
        "(short/abbreviated SHAs are rejected - this canary's immutability guarantee requires an exact, unambiguous object)",
    );
  }
  return trimmed;
}

/**
 * Resolves the effective EtherCalc source (repo URL/path + pinned commit)
 * for this run: the hardcoded release-pin defaults, unless overridden via
 * SC_ETHERCALC_REPO / SC_ETHERCALC_SHA (local tandem rehearsal only - see
 * doc comment above). Pure function of its input for testability; `env`
 * defaults to `process.env` and is only ever overridden by tests.
 */
export function resolveEthercalcSource(env = process.env) {
  const repoOverride = env[ETHERCALC_REPO_ENV];
  const shaOverride = env[ETHERCALC_SHA_ENV];
  const repo =
    typeof repoOverride === "string" && repoOverride.trim().length > 0
      ? repoOverride.trim()
      : ETHERCALC_REPO;
  const sha = shaOverride ? validateShaOverride(shaOverride) : ETHERCALC_PINNED_SHA;
  return {
    repo,
    sha,
    repoOverridden: repo !== ETHERCALC_REPO,
    shaOverridden: sha !== ETHERCALC_PINNED_SHA,
  };
}

/**
 * Source of a temporary, uncommitted test file this script injects into the
 * checkout's own `test/` directory (see steps 6 and 8 below). Typechecking
 * covers it after bundle regeneration; a separate focused run then proves
 * the regenerated headless bundle actually exposes the candidate's
 * `SocialCalc.Workbook` multi-sheet API
 * end-to-end (two sheets, distinct values on one, a cross-sheet formula on
 * the other, full save/decode/load/recalc round trip) without touching any
 * EtherCalc source file - this string is the only thing written, into an
 * isolated temp checkout, and it is removed (with the whole temp checkout)
 * before this script exits.
 */
const WORKBOOK_SMOKE_TEST_SOURCE = `import { describe, expect, it } from 'vite-plus/test';
import { loadSocialCalc } from '../src/index.js';

// Narrow structural view of the SocialCalc.Workbook multi-sheet API (not
// part of the headless package's own SocialCalcNamespace type, which only
// covers the single-sheet surface) - mirrors the same
// \`as unknown as { ... }\` pattern src/index.ts's addSiblingSheet() already
// uses for the same reason (an @ts-nocheck bundled factory with no static
// return type).
interface WorkbookCell {
  datatype: string;
  datavalue: unknown;
  valuetype: string;
  formula?: string;
}
interface WorkbookSheet {
  GetAssuredCell(coord: string): WorkbookCell;
}
interface Workbook {
  sheetOrder: string[];
  AddSheet(name: string): void;
  GetSheet(name: string): WorkbookSheet;
  RecalcAll(callback: () => void): void;
}
interface WorkbookNamespace {
  Workbook: new () => Workbook;
  CreateWorkbookSave(workbook: Workbook): string;
  DecodeWorkbookSave(str: string): { sheets: { name: string }[] } | null;
  LoadWorkbookSave(workbook: Workbook, str: string): void;
}

describe('candidate SocialCalc.Workbook smoke (injected by verify-ethercalc-canary.mjs)', () => {
  it('two-sheet workbook: distinct values/formula survive save/decode/load/recalc', () => {
    const SC = loadSocialCalc() as unknown as WorkbookNamespace;
    expect(typeof SC.Workbook).toBe('function');
    expect(typeof SC.CreateWorkbookSave).toBe('function');
    expect(typeof SC.LoadWorkbookSave).toBe('function');

    const wb = new SC.Workbook();
    wb.AddSheet('Data');
    wb.AddSheet('Summary');

    const dataSheet = wb.GetSheet('Data');
    const dataA1 = dataSheet.GetAssuredCell('A1');
    dataA1.datatype = 'v';
    dataA1.datavalue = 11;
    dataA1.valuetype = 'n';
    const dataA2 = dataSheet.GetAssuredCell('A2');
    dataA2.datatype = 'v';
    dataA2.datavalue = 31;
    dataA2.valuetype = 'n';

    const summarySheet = wb.GetSheet('Summary');
    const summaryA1 = summarySheet.GetAssuredCell('A1');
    summaryA1.datatype = 'f';
    summaryA1.formula = 'SUM(Data!A1:A2)';

    const saved = SC.CreateWorkbookSave(wb);
    expect(typeof saved).toBe('string');
    expect(saved.length).toBeGreaterThan(0);

    const decoded = SC.DecodeWorkbookSave(saved);
    expect(decoded).not.toBeNull();
    expect(decoded?.sheets.map((s) => s.name)).toEqual(['Data', 'Summary']);

    const loaded = new SC.Workbook();
    SC.LoadWorkbookSave(loaded, saved);
    expect(loaded.sheetOrder).toEqual(['Data', 'Summary']);

    return new Promise<void>((resolve, reject) => {
      loaded.RecalcAll(() => {
        try {
          expect(loaded.GetSheet('Data').GetAssuredCell('A1').datavalue).toBe(11);
          expect(loaded.GetSheet('Data').GetAssuredCell('A2').datavalue).toBe(31);
          const summaryCell = loaded.GetSheet('Summary').GetAssuredCell('A1');
          expect(summaryCell.datatype).toBe('f');
          expect(summaryCell.formula).toBe('SUM(Data!A1:A2)');
          expect(summaryCell.datavalue).toBe(42);
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
  });
});
`;
const WORKBOOK_SMOKE_TEST_FILENAME = "candidate-workbook-smoke.test.ts";

const checks = [];

function step(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail });
    console.log(`ok - ${name}${detail ? ` (${detail})` : ""}`);
    return detail;
  } catch (error) {
    checks.push({ name, ok: false, detail: error.stack ?? String(error) });
    console.error(`FAIL - ${name}`);
    console.error(error.stack ?? String(error));
    throw error; // steps are sequential and dependent; stop at first failure
  }
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

function must(cmd, args, options, label) {
  const result = run(cmd, args, options);
  if (result.status !== 0) {
    throw new Error(
      `${label ?? `${cmd} ${args.join(" ")}`} failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function requireBinary(cmd) {
  const result = run(cmd, ["--version"]);
  if (result.error || result.status !== 0) {
    throw new Error(`required tool "${cmd}" not found or not runnable on PATH`);
  }
  return result.stdout.trim().split("\n")[0];
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256OfFile(filePath) {
  return sha256(readFileSync(filePath));
}

function extractTarMember(tarballPath, memberPath) {
  const result = spawnSync("tar", ["-xzOf", tarballPath, memberPath], { encoding: "buffer" });
  if (result.error || result.status !== 0) {
    throw new Error(
      `tar extract of ${memberPath} failed: ${result.stderr?.toString() ?? result.error}`,
    );
  }
  return result.stdout;
}

function summarizeVitestOutput(stdout) {
  const plain = stripVTControlCharacters(stdout);
  // Order in vitest's own summary line is always passed, then failed, then
  // skipped, but a segment is entirely OMITTED (not printed as "0 X") when
  // its count is zero — including "passed" itself, e.g. a `-t` filter that
  // matches nothing prints "Tests  17 skipped (17)" with no "N passed"
  // segment at all. Each capture group is therefore independently
  // optional so every combination the real reporter emits is matched.
  const match = plain.match(
    /Tests\s+(?:(\d+) passed)?(?:\s*\|\s*)?(?:(\d+) failed)?(?:\s*\|\s*)?(?:(\d+) skipped)?\s*\((\d+)\)/,
  );
  if (!match)
    throw new Error(`could not find a "Tests ... (N)" summary line in vitest output:\n${plain}`);
  const [, passed = "0", failed = "0", skipped = "0", total] = match;
  return {
    passed: Number(passed),
    failed: Number(failed),
    skipped: Number(skipped),
    total: Number(total),
  };
}

async function main() {
  const source = resolveEthercalcSource();
  console.log(`ethercalc canary: pinning audreyt/ethercalc @ ${source.sha}`);
  if (!source.shaOverridden) {
    console.log(`  (${ETHERCALC_PINNED_DATE} - "${ETHERCALC_PINNED_SUBJECT}")`);
  }
  if (source.repoOverridden || source.shaOverridden) {
    console.log(
      "  *** LOCAL TANDEM REHEARSAL OVERRIDE IN EFFECT (not the default release pin) ***",
    );
    if (source.repoOverridden) {
      console.log(`  ${ETHERCALC_REPO_ENV}=${source.repo} (default: ${ETHERCALC_REPO})`);
    }
    if (source.shaOverridden) {
      console.log(`  ${ETHERCALC_SHA_ENV}=${source.sha} (default: ${ETHERCALC_PINNED_SHA})`);
    }
  }

  step("preflight: git is available", () => requireBinary("git"));
  step("preflight: bun is available (EtherCalc's own package manager)", () => requireBinary("bun"));
  step("preflight: tar is available", () => requireBinary("tar"));

  const workDir = mkdtempSync(path.join(tmpdir(), "socialcalc-ethercalc-canary-"));
  const tarballPath = path.join(workDir, "socialcalc-candidate.tgz");
  const ethercalcDir = path.join(workDir, "ethercalc");
  const extractDir = path.join(workDir, "candidate-extracted");

  try {
    // 1. Pack the CURRENT SocialCalc candidate through vp — never a bare
    //    npm/bun pack in this repo. `prepack` (vp build --minify) runs as
    //    part of this, so a broken build fails right here. ------------------
    step("vp pm pack produces the current SocialCalc candidate tarball", () => {
      must("vp", ["pm", "pack", "--out", tarballPath], { cwd: repoRoot }, "vp pm pack");
      if (!existsSync(tarballPath)) throw new Error(`expected tarball at ${tarballPath}`);
      const size = readFileSync(tarballPath).length;
      return `${tarballPath} (${size} bytes)`;
    });
    const candidateSha256 = step("candidate tarball sha256 (for the release report)", () =>
      sha256OfFile(tarballPath),
    );

    // 2. Fetch the pinned, immutable EtherCalc commit — full checkout (not
    //    just the headless subdir), because `bun install --frozen-lockfile`
    //    validates the whole workspace against the whole lockfile. Network
    //    happens here, and only here (this + step 5's install). ------------
    step(
      `clone pinned EtherCalc commit ${source.sha.slice(0, 12)} into an isolated temp dir`,
      () => {
        must("git", ["init", "-q", ethercalcDir], {}, "git init");
        must(
          "git",
          ["remote", "add", "origin", source.repo],
          { cwd: ethercalcDir },
          "git remote add origin",
        );
        must(
          "git",
          ["fetch", "--depth", "1", "origin", source.sha],
          { cwd: ethercalcDir },
          "git fetch pinned SHA",
        );
        must(
          "git",
          ["checkout", "-q", "FETCH_HEAD"],
          { cwd: ethercalcDir },
          "git checkout FETCH_HEAD",
        );
        return ethercalcDir;
      },
    );

    step("provenance: checked-out commit matches the pinned SHA exactly", () => {
      const actual = must(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: ethercalcDir },
        "git rev-parse HEAD",
      ).stdout.trim();
      if (actual !== source.sha) {
        throw new Error(`checked out ${actual}, expected pinned ${source.sha}`);
      }
      return actual;
    });

    const commitMeta = source.shaOverridden
      ? step("commit metadata (overridden pin - fetched from the actual checkout)", () => {
          const [committed, subject] = must(
            "git",
            ["log", "-1", "--format=%cI%x00%s", "HEAD"],
            { cwd: ethercalcDir },
            "git log -1 (commit metadata)",
          )
            .stdout.trim()
            .split("\0");
          return { committed, subject };
        })
      : { committed: ETHERCALC_PINNED_DATE, subject: ETHERCALC_PINNED_SUBJECT };

    const lockfilePath = path.join(ethercalcDir, "bun.lock");
    const headlessDir = path.join(ethercalcDir, HEADLESS_SUBDIR);
    step(`pinned commit ships a root bun.lock and ${HEADLESS_SUBDIR} in the expected shape`, () => {
      if (!existsSync(lockfilePath))
        throw new Error(`pinned EtherCalc commit is missing root bun.lock`);
      for (const rel of [
        "package.json",
        "scripts/build.js",
        "src/index.ts",
        "src/dom-shim.ts",
        "test/smoke.test.ts",
      ]) {
        if (!existsSync(path.join(headlessDir, rel))) {
          throw new Error(
            `pinned EtherCalc commit is missing ${HEADLESS_SUBDIR}/${rel} - package layout changed, update this script's pin/adapter`,
          );
        }
      }
      return headlessDir;
    });

    const lockfileShaBefore = step(
      "bun.lock sha256 before install (baseline for the frozen-lockfile proof)",
      () => sha256OfFile(lockfilePath),
    );

    // 3. Install with bun --frozen-lockfile at the checkout ROOT — this is
    //    EtherCalc's own package manager and its own exact locked toolchain
    //    (wrangler/vitest/workers-types/pool-workers/typescript), never a
    //    freshly re-resolved range and never this repo's package manager.
    //    `--filter` (scoped to just the headless workspace) was evaluated
    //    and rejected: it installs that workspace's OWN declared deps but
    //    skips EtherCalc root-only devDependencies (typescript) that its
    //    headless "typecheck" script needs, which a root-scoped `bun run
    //    --cwd packages/socialcalc-headless typecheck` (EtherCalc CI's own
    //    invocation form) resolves via hoisting — root install is what
    //    actually reproduces that. `--frozen-lockfile` makes bun fail hard
    //    if the lockfile would need any change, so success here is itself
    //    proof the entire non-candidate tree matches the pinned commit's
    //    own recorded resolutions. ------------------------------------------
    step(
      "bun install --frozen-lockfile resolves EtherCalc's own pinned toolchain (root, not this repo's package manager)",
      () => {
        must(
          "bun",
          ["install", "--frozen-lockfile"],
          { cwd: ethercalcDir },
          "bun install --frozen-lockfile",
        );
        return ethercalcDir;
      },
    );

    step(
      "provenance: bun.lock is byte-identical after install (frozen — nothing was re-resolved)",
      () => {
        const after = sha256OfFile(lockfilePath);
        if (after !== lockfileShaBefore) {
          throw new Error(
            `bun.lock changed during install (before=${lockfileShaBefore} after=${after}) - frozen-lockfile should have failed instead of silently re-resolving`,
          );
        }
        return after;
      },
    );

    const installedSocialcalcDir = path.join(headlessDir, "node_modules/socialcalc");
    step(
      "locked npm-resolved socialcalc version was installed (about to be replaced by the real candidate)",
      () => {
        if (!existsSync(installedSocialcalcDir))
          throw new Error(`expected ${installedSocialcalcDir} after frozen-lockfile install`);
        const pkg = JSON.parse(
          readFileSync(path.join(installedSocialcalcDir, "package.json"), "utf8"),
        );
        return `locked version ${pkg.version} (npm registry, about to be discarded)`;
      },
    );

    // 4. Extract the ACTUAL candidate tarball and replace the locked
    //    node_modules/socialcalc directory with its exact contents — never
    //    touching package.json or bun.lock (that's the proof, from step
    //    above, that everything else stayed exactly as locked). -----------
    step("extract the candidate tarball", () => {
      mkdirSync(extractDir, { recursive: true });
      must("tar", ["-xzf", tarballPath, "-C", extractDir], {}, "tar extract candidate tarball");
      const pkgDir = path.join(extractDir, "package");
      if (!existsSync(pkgDir)) throw new Error(`expected ${pkgDir} after tar extract`);
      return pkgDir;
    });

    step(
      "replace node_modules/socialcalc with the extracted candidate (file-swap, not a manifest edit)",
      () => {
        rmSync(installedSocialcalcDir, { recursive: true, force: true });
        cpSync(path.join(extractDir, "package"), installedSocialcalcDir, { recursive: true });
        const pkg = JSON.parse(
          readFileSync(path.join(installedSocialcalcDir, "package.json"), "utf8"),
        );
        return `now version ${pkg.version} (the actual candidate)`;
      },
    );

    step(
      "swapped node_modules/socialcalc/dist/SocialCalc.js is byte-identical to the candidate tarball",
      () => {
        const installedHash = sha256OfFile(path.join(installedSocialcalcDir, "dist/SocialCalc.js"));
        const tarballMemberHash = sha256(
          extractTarMember(tarballPath, "package/dist/SocialCalc.js"),
        );
        if (installedHash !== tarballMemberHash) {
          throw new Error(
            `swapped socialcalc dist (${installedHash}) does not match the packed candidate tarball (${tarballMemberHash})`,
          );
        }
        return installedHash;
      },
    );

    // 5. Regenerate the embedded headless bundle FROM the candidate - the
    //    real adapter step this whole canary exists to exercise. Uses the
    //    pinned commit's own unmodified scripts/build.js. -------------------
    step("regenerate src/socialcalc.bundled.ts from the candidate's dist/SocialCalc.js", () => {
      must("node", ["scripts/build.js"], { cwd: headlessDir }, "node scripts/build.js");
      const bundledPath = path.join(headlessDir, "src/socialcalc.bundled.ts");
      if (!existsSync(bundledPath)) throw new Error(`expected regenerated ${bundledPath}`);
      return bundledPath;
    });

    // 6. Typecheck the candidate bundle and injected workbook smoke using
    //    EtherCalc's exact locked toolchain. The temporary test is present
    //    during typechecking, then removed even if the check fails.
    const workbookSmokeTestPath = path.join(headlessDir, "test", WORKBOOK_SMOKE_TEST_FILENAME);
    step("headless package and injected workbook smoke typecheck against the candidate", () => {
      writeFileSync(workbookSmokeTestPath, WORKBOOK_SMOKE_TEST_SOURCE);
      try {
        must(
          "bun",
          ["run", "--cwd", HEADLESS_SUBDIR, "typecheck"],
          { cwd: ethercalcDir },
          "bun run --cwd packages/socialcalc-headless typecheck",
        );
      } finally {
        rmSync(workbookSmokeTestPath, { force: true });
      }
    });

    // 7. The package's real current headless suite - fail on ANY test/build
    //    error. Not hardcoded to 16: whatever the pinned commit's own "test"
    //    script currently runs is what must pass in full. --------------------
    const testSummary = step(
      "headless suite (the package's own current test script) passes in full",
      () => {
        const result = must(
          "bun",
          ["run", "--cwd", HEADLESS_SUBDIR, "test"],
          { cwd: ethercalcDir },
          "bun run --cwd packages/socialcalc-headless test",
        );
        const summary = summarizeVitestOutput(result.stdout);
        // summarizeVitestOutput's regex now also matches an all-skipped
        // summary line (0 tests actually run, e.g. everything filtered
        // out) - `passed > 0` keeps this step exactly as strict as before
        // that broadening: a headless suite that "passed" zero tests is a
        // failure here, not a silent green.
        if (summary.failed > 0 || summary.total === 0 || summary.passed === 0) {
          throw new Error(`headless suite did not pass cleanly: ${JSON.stringify(summary)}`);
        }
        return `${summary.passed}/${summary.total} passed, 0 failed`;
      },
    );

    // 8. Injected temporary behavioral smoke: proves the just-regenerated
    //    headless bundle actually exposes the candidate's
    //    SocialCalc.Workbook multi-sheet API end-to-end, not just that it
    //    typechecks/exists. Written into the pinned checkout's own test/
    //    directory (so it runs through the exact same vitest/workerd
    //    config as every other headless test) as a temporary, uncommitted
    //    file - it never touches EtherCalc source, and is removed with the
    //    rest of the isolated temp workDir in the `finally` block below.
    //    The same temporary test was already included in step 6's typecheck.
    //    This explicit positional test filter proves its behavior ran rather
    //    than relying on suite auto-discovery.
    const workbookSmokeSummary = step(
      "injected temporary smoke: two-sheet SocialCalc.Workbook save/decode/load/recalc against the candidate",
      () => {
        writeFileSync(workbookSmokeTestPath, WORKBOOK_SMOKE_TEST_SOURCE);
        try {
          const result = must(
            "bun",
            [
              "run",
              "--cwd",
              HEADLESS_SUBDIR,
              "test",
              WORKBOOK_SMOKE_TEST_FILENAME.replace(/\.test\.ts$/, ""),
            ],
            { cwd: ethercalcDir },
            "bun run --cwd packages/socialcalc-headless test candidate-workbook-smoke",
          );
          const summary = summarizeVitestOutput(result.stdout);
          if (summary.failed > 0 || summary.passed === 0) {
            throw new Error(
              `injected workbook smoke did not pass cleanly: ${JSON.stringify(summary)}`,
            );
          }
          return `${summary.passed}/${summary.total} passed, 0 failed`;
        } finally {
          rmSync(workbookSmokeTestPath, { force: true });
        }
      },
    );

    console.log("");
    console.log("=== ethercalc release canary report ===");
    console.log(`SocialCalc candidate:  ${repoRoot}`);
    console.log(`  tarball sha256:      ${candidateSha256}`);
    console.log(`EtherCalc pin:         ${source.repo}`);
    console.log(`  commit:              ${source.sha}`);
    console.log(`  committed:           ${commitMeta.committed}`);
    console.log(`  subject:             ${commitMeta.subject}`);
    if (source.repoOverridden) {
      console.log(`  ${ETHERCALC_REPO_ENV} override:  ${source.repo} (default: ${ETHERCALC_REPO})`);
    }
    if (source.shaOverridden) {
      console.log(
        `  ${ETHERCALC_SHA_ENV} override:   ${source.sha} (default: ${ETHERCALC_PINNED_SHA})`,
      );
    }
    console.log(`  bun.lock sha256:     ${lockfileShaBefore} (unchanged by install)`);
    console.log(`Workspace:             ${HEADLESS_WORKSPACE}`);
    console.log(`Headless suite:        ${testSummary}`);
    console.log(`Workbook smoke:        ${workbookSmokeSummary}`);
  } finally {
    if (process.env.SC_KEEP_ETHERCALC_CANARY_TMP) {
      console.log(`kept scratch dir: ${workDir}`);
    } else {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  console.log("");
  console.log(
    `${checks.filter((c) => c.ok).length}/${checks.length} ethercalc-canary checks passed`,
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error("");
    console.error("ethercalc-canary FAILED");
    console.error(error.stack ?? String(error));
    process.exitCode = 1;
  });
}
