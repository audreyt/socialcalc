// Bounded adversarial coverage: save -> load -> recalc must be idempotent.
// Recalculating a freshly-loaded copy of a sheet must reproduce the exact
// same cell values as the original, and a second save/load/recalc cycle
// must converge to the same fixed point (no drift from repeated round
// trips) — on both runtimes.
import { describe, expect, test } from "vite-plus/test";

import { expectParity, loadPair, recalcSheet, runCommands } from "../helpers/differential";
import type { SheetInstance, SocialCalcRuntime } from "../helpers/socialcalc-runtime-types";

const SCENARIOS = [
  ["value/formula mix", ["set A1 value n 3", "set B1 formula A1*2+1", "set C1 formula SUM(A1:B1)"]],
  [
    "named range + dependent formula",
    [
      "set A1 value n 1",
      "set A2 value n 2",
      "set A3 value n 3",
      "name define BAND A1:A3",
      "set D1 formula SUM(BAND)",
    ],
  ],
  ["text and a direct error formula", ["set A1 text t hello", "set B1 formula 1/0"]],
] as const;

interface StableCellSnapshot {
  numericValue: number;
  valuetype: string;
}

/**
 * `datavalue`'s JS type for an error cell (number 0 vs the string "0") is
 * not guaranteed stable across a save/reload cycle — verified directly:
 * `1/0` keeps datavalue `0` in memory but comes back as `"0"` after
 * ParseSheetSave. `valuetype` (the documented error/type signal) and the
 * coerced numeric value are the actual stable, meaningful contract, so
 * that is what this invariant checks.
 */
function snapshotStable(sheet: SheetInstance): Record<string, StableCellSnapshot> {
  return Object.fromEntries(
    Object.keys(sheet.cells).map((coord) => {
      const cell = sheet.cells[coord];
      return [coord, { numericValue: Number(cell?.datavalue), valuetype: cell?.valuetype ?? "" }];
    }),
  );
}

async function valuesAfterOneRoundTrip(SC: SocialCalcRuntime, commands: readonly string[]) {
  const sheet = await runCommands(SC, commands);
  const originalValues = snapshotStable(sheet);

  const save = sheet.CreateSheetSave();
  const reloaded = new SC.Sheet();
  reloaded.ParseSheetSave(save);
  await recalcSheet(SC, reloaded);
  const reloadedValues = snapshotStable(reloaded);

  return { originalValues, reloadedValues, sheet: reloaded };
}

describe("save-load-recalc invariants", () => {
  test.each(SCENARIOS)(
    "%s: reload+recalc reproduces the original values",
    async (_label, commands) => {
      const { candidate, oracle } = await loadPair();
      for (const SC of [candidate, oracle]) {
        const { originalValues, reloadedValues } = await valuesAfterOneRoundTrip(SC, [...commands]);
        expect(reloadedValues).toStrictEqual(originalValues);
      }
    },
  );

  test.each(SCENARIOS)(
    "%s: two round trips converge to the same fixed point",
    async (_label, commands) => {
      const { candidate, oracle } = await loadPair();
      for (const SC of [candidate, oracle]) {
        const first = await valuesAfterOneRoundTrip(SC, [...commands]);
        const secondSave = first.sheet.CreateSheetSave();
        const secondSheet = new SC.Sheet();
        secondSheet.ParseSheetSave(secondSave);
        await recalcSheet(SC, secondSheet);
        const secondValues = snapshotStable(secondSheet);
        expect(secondValues).toStrictEqual(first.reloadedValues);
      }
    },
  );

  test.each(SCENARIOS)(
    "%s: candidate and oracle agree on the round-tripped values",
    async (_label, commands) => {
      const { candidate, oracle } = await loadPair();
      const candidateResult = await valuesAfterOneRoundTrip(candidate, [...commands]);
      const oracleResult = await valuesAfterOneRoundTrip(oracle, [...commands]);
      expectParity(
        `round trip: ${_label}`,
        candidateResult.reloadedValues,
        oracleResult.reloadedValues,
      );
    },
  );
});
