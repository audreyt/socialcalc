// Explicit classification of confirmed candidate-vs-oracle@3.0.8 behavior
// differences (test/fixtures/differential-known-diffs.json). Every other
// file under test/differential/ asserts parity; this is the one place a
// divergence is expected — and each entry must reproduce it exactly, so a
// silent behavior drift (in either direction) fails the suite instead of
// rotting into stale prose.
//
// The JSON import is statically type-checked by tsconfig's
// `resolveJsonModule` against the file's literal content, so no runtime
// schema validation or cast is needed to read it safely.
import { describe, expect, test } from "vite-plus/test";

import { createOracleSocialCalc } from "../helpers/oracle";
import { loadSocialCalc } from "../helpers/socialcalc";
import knownDiffs from "../fixtures/differential-known-diffs.json";

describe("known intended differences", () => {
  for (const entry of knownDiffs.entries) {
    test(`${entry.id}: ${entry.summary}`, async () => {
      const candidate = await loadSocialCalc();
      // Fresh, uncached oracle instance per probe — see
      // createOracleSocialCalc()'s doc comment: the shared per-worker
      // oracle singleton is unsafe here because two crash probes in the
      // same file would otherwise share a vm sandbox that V8 coverage
      // instrumentation can leave in a state where the second probe's
      // undeclared-variable read silently stops throwing.
      const oracle = createOracleSocialCalc();

      if (entry.api !== "FormatNumber.formatNumberWithFormat") {
        throw new Error(`known-intended-differences.test.ts has no runner for api "${entry.api}"`);
      }

      const { format, value } = entry.probe;
      const candidateResult = candidate.FormatNumber.formatNumberWithFormat(value, format);
      expect(candidateResult, `candidate should NOT throw for ${entry.id}`).toBe(entry.expected.candidateReturns);

      let oracleThrew = false;
      try {
        oracle.FormatNumber.formatNumberWithFormat(value, format);
      } catch {
        oracleThrew = true;
      }
      expect(oracleThrew, `oracle@3.0.8 throw expectation for ${entry.id}`).toBe(entry.expected.oracleThrows);
    });
  }

  test("the registry is non-empty and every id is unique", () => {
    expect(knownDiffs.entries.length).toBeGreaterThan(0);
    const ids = knownDiffs.entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
