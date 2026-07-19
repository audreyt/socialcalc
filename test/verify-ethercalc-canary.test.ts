// Unit coverage for scripts/verify-ethercalc-canary.mjs's pure local-tandem
// source override validation/resolution. Importing the script must never
// trigger the networked, release-time canary as a side effect.

import { describe, expect, test } from "vite-plus/test";

import {
  resolveEthercalcSource,
  validateShaOverride,
} from "../scripts/verify-ethercalc-canary.mjs";

const DEFAULT_REPO = "https://github.com/audreyt/ethercalc.git";
const DEFAULT_SHA = "8674374d2a4da7aff7004b6e7bdf35a310ad1aab";
const VALID_FULL_SHA = "b160b7df96c64ad2962bce35b170ba6b0fc98112";

describe("validateShaOverride", () => {
  test("accepts a full 40-character lowercase-hex SHA and returns it trimmed", () => {
    expect(validateShaOverride(`  ${VALID_FULL_SHA}  `)).toBe(VALID_FULL_SHA);
  });

  test("rejects a short/abbreviated SHA (ambiguity risk to the immutability guarantee)", () => {
    expect(() => validateShaOverride("b160b7d")).toThrow(/40-character/);
  });

  test("rejects uppercase hex (git SHAs are canonically lowercase)", () => {
    expect(() => validateShaOverride(VALID_FULL_SHA.toUpperCase())).toThrow(/40-character/);
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
    const source = resolveEthercalcSource({ SC_ETHERCALC_SHA: VALID_FULL_SHA });
    expect(source.repo).toBe(DEFAULT_REPO);
    expect(source.sha).toBe(VALID_FULL_SHA);
    expect(source.repoOverridden).toBe(false);
    expect(source.shaOverridden).toBe(true);
  });

  test("both overrides apply together (local tandem rehearsal: local checkout + its exact tip SHA)", () => {
    const source = resolveEthercalcSource({
      SC_ETHERCALC_REPO: "/Users/au/w/ethercalc",
      SC_ETHERCALC_SHA: VALID_FULL_SHA,
    });
    expect(source).toEqual({
      repo: "/Users/au/w/ethercalc",
      sha: VALID_FULL_SHA,
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
