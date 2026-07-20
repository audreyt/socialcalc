// Unit coverage for scripts/verify-ethercalc-canary.mjs's pure local-tandem
// source override validation/resolution. Importing the script must never
// trigger the networked, release-time canary as a side effect.

import { describe, expect, test } from "vite-plus/test";

import {
  resolveEthercalcSource,
  summarizeVitestOutput,
  validateShaOverride,
} from "../scripts/verify-ethercalc-canary.mjs";

const DEFAULT_REPO = "https://github.com/audreyt/ethercalc.git";
const DEFAULT_SHA = "b160b7df96c64ad2962bce35b170ba6b0fc98112";
const OVERRIDE_SHA = "8674374d2a4da7aff7004b6e7bdf35a310ad1aab";

describe("validateShaOverride", () => {
  test("accepts a full 40-character lowercase-hex SHA and returns it trimmed", () => {
    expect(validateShaOverride(`  ${OVERRIDE_SHA}  `)).toBe(OVERRIDE_SHA);
  });

  test("rejects a short/abbreviated SHA (ambiguity risk to the immutability guarantee)", () => {
    expect(() => validateShaOverride("b160b7d")).toThrow(/40-character/);
  });

  test("rejects uppercase hex (git SHAs are canonically lowercase)", () => {
    expect(() => validateShaOverride(OVERRIDE_SHA.toUpperCase())).toThrow(/40-character/);
  });

  test("rejects a non-hex string of the right length", () => {
    expect(() => validateShaOverride("z".repeat(40))).toThrow(/40-character/);
  });

  test("rejects an empty or whitespace-only string", () => {
    expect(() => validateShaOverride("")).toThrow(/non-empty/);
    expect(() => validateShaOverride("   ")).toThrow(/non-empty/);
  });

  test("rejects a branch/tag-like ref instead of a commit SHA", () => {
    expect(() => validateShaOverride("main")).toThrow(/40-character/);
  });

  test("rejects non-string input", () => {
    expect(() => validateShaOverride(12345 as unknown as string)).toThrow(/non-empty/);
  });
});

describe("resolveEthercalcSource", () => {
  test("defaults to the pinned repo/SHA when no override env vars are set", () => {
    const source = resolveEthercalcSource({});
    expect(source).toEqual({
      repo: DEFAULT_REPO,
      sha: DEFAULT_SHA,
      repoOverridden: false,
      shaOverridden: false,
    });
  });

  test("SC_ETHERCALC_REPO overrides the repo only, SHA stays pinned", () => {
    const source = resolveEthercalcSource({
      SC_ETHERCALC_REPO: "/Users/au/w/ethercalc",
    });
    expect(source.repo).toBe("/Users/au/w/ethercalc");
    expect(source.sha).toBe(DEFAULT_SHA);
    expect(source.repoOverridden).toBe(true);
    expect(source.shaOverridden).toBe(false);
  });

  test("SC_ETHERCALC_SHA overrides the SHA only, repo stays pinned", () => {
    const source = resolveEthercalcSource({ SC_ETHERCALC_SHA: OVERRIDE_SHA });
    expect(source.repo).toBe(DEFAULT_REPO);
    expect(source.sha).toBe(OVERRIDE_SHA);
    expect(source.repoOverridden).toBe(false);
    expect(source.shaOverridden).toBe(true);
  });

  test("both overrides apply together (local tandem rehearsal: local checkout + its exact tip SHA)", () => {
    const source = resolveEthercalcSource({
      SC_ETHERCALC_REPO: "/Users/au/w/ethercalc",
      SC_ETHERCALC_SHA: OVERRIDE_SHA,
    });
    expect(source).toEqual({
      repo: "/Users/au/w/ethercalc",
      sha: OVERRIDE_SHA,
      repoOverridden: true,
      shaOverridden: true,
    });
  });

  test("blank/whitespace-only SC_ETHERCALC_REPO is treated as unset", () => {
    const source = resolveEthercalcSource({ SC_ETHERCALC_REPO: "   " });
    expect(source.repo).toBe(DEFAULT_REPO);
    expect(source.repoOverridden).toBe(false);
  });

  test("an invalid SC_ETHERCALC_SHA override throws (still requires the exact/immutable SHA)", () => {
    expect(() => resolveEthercalcSource({ SC_ETHERCALC_SHA: "deadbeef" })).toThrow(/40-character/);
  });

  test("setting SC_ETHERCALC_REPO to the exact default value is NOT reported as an override", () => {
    const source = resolveEthercalcSource({ SC_ETHERCALC_REPO: DEFAULT_REPO });
    expect(source.repoOverridden).toBe(false);
  });
});

describe("summarizeVitestOutput", () => {
  test("reads a single Vitest summary", () => {
    expect(summarizeVitestOutput("Tests  7 passed (7)")).toEqual({
      passed: 7,
      failed: 0,
      skipped: 0,
      total: 7,
    });
  });

  test("aggregates every summary emitted by a compound package script", () => {
    expect(
      summarizeVitestOutput(
        ["Tests  4 passed (4)", "Tests  3 passed | 1 failed | 2 skipped (6)"].join("\n"),
      ),
    ).toEqual({
      passed: 7,
      failed: 1,
      skipped: 2,
      total: 10,
    });
  });

  test("reports an all-skipped filtered run as zero passed", () => {
    expect(summarizeVitestOutput("Tests  17 skipped (17)")).toEqual({
      passed: 0,
      failed: 0,
      skipped: 17,
      total: 17,
    });
  });

  test("rejects output without a Vitest summary", () => {
    expect(() => summarizeVitestOutput("no test reporter output")).toThrow(/could not find/);
  });
});
