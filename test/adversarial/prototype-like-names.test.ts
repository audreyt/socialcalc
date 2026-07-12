// Bounded adversarial coverage: named ranges and bare formula names that
// collide with JavaScript's Object.prototype surface (`__proto__`,
// `constructor`, `hasOwnProperty`, `toString`, `valueOf`) must behave as
// ordinary spreadsheet data — no prototype pollution, no accidental
// resolution to a JS builtin instead of #NAME? or the defined value.
import { describe, expect, test } from "vite-plus/test";

import { expectParity, loadPair, recalcSheet, scheduleCommands } from "../helpers/differential";

const PROTOTYPE_LIKE_NAMES = ["__proto__", "constructor", "hasOwnProperty", "toString", "valueOf"] as const;

describe("prototype-like named ranges", () => {
  test("defining __proto__ as a name does not pollute Object.prototype", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, ["set A1 value n 42", "name define __proto__ A1"], true);
      expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(sheet.names, "__proto__")).toBe(false);
    }
  });

  test.each(PROTOTYPE_LIKE_NAMES)(
    "a name defined as '%s' resolves to its own value in a formula on both runtimes",
    async (name) => {
      const { candidate, oracle } = await loadPair();
      const outcomes: Array<{ datavalue: unknown; valuetype: string }> = [];
      for (const SC of [candidate, oracle]) {
        const sheet = new SC.Sheet();
        await scheduleCommands(SC, sheet, [`set A1 value n 7`, `name define ${name} A1`, `set B1 formula ${name}`]);
        await recalcSheet(SC, sheet);
        outcomes.push({ datavalue: sheet.cells.B1.datavalue, valuetype: sheet.cells.B1.valuetype });
      }
      expectParity(`name "${name}" resolves`, outcomes[0], outcomes[1]);
      expect(outcomes[0].datavalue).toBe(7);
      expect(outcomes[0].valuetype).toBe("n");
    },
  );

  test.each(PROTOTYPE_LIKE_NAMES)(
    "an UNDEFINED bare name '%s' is #NAME?, never a JS builtin's stringified value",
    async (name) => {
      const { candidate, oracle } = await loadPair();
      const outcomes: Array<{ datavalue: unknown; valuetype: string }> = [];
      for (const SC of [candidate, oracle]) {
        const sheet = new SC.Sheet();
        await scheduleCommands(SC, sheet, [`set B1 formula ${name}`]);
        await recalcSheet(SC, sheet);
        outcomes.push({ datavalue: sheet.cells.B1.datavalue, valuetype: sheet.cells.B1.valuetype });
      }
      expectParity(`undefined name "${name}"`, outcomes[0], outcomes[1]);
      expect(outcomes[0].valuetype).toBe("e#NAME?");
    },
  );

  test("a sheet-qualified reference to a prototype-like sheet name does not crash either runtime", async () => {
    const { candidate, oracle } = await loadPair();
    const formula = "constructor!A1+hasOwnProperty!B1";
    const candidateResult = candidate.OffsetFormulaCoords(formula, 1, 0);
    const oracleResult = oracle.OffsetFormulaCoords(formula, 1, 0);
    expectParity(formula, candidateResult, oracleResult);
  });
});
