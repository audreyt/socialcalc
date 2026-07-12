// Differential coverage: `name define`/`name delete` and how named ranges
// react to structural edits (delete shrinks a range, delete-through turns a
// single-coord name into #REF!) plus undo/redo of those definitions.
import { describe, expect, test } from "vite-plus/test";

import {
  evaluateFormula,
  loadPair,
  recalcSheet,
  runCommands,
  scheduleCommands,
  sheetUndo,
} from "../helpers/differential";

describe("named range parity", () => {
  test("a defined name resolves the same value through a dependent formula", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = await runCommands(SC, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "name define BAND A1:C1",
        "set E1 formula SUM(BAND)",
      ]);
      expect(sheet.cells.E1.datavalue).toBe(6);
    }
  });

  test("deletecol shrinks a named horizontal range and its dependent SUM", async () => {
    const { candidate, oracle } = await loadPair();
    const definitions: string[] = [];
    const values: number[] = [];
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "name define BAND A1:C1",
        "set E1 formula SUM(BAND)",
      ]);
      await scheduleCommands(SC, sheet, "deletecol B");
      await recalcSheet(SC, sheet);
      definitions.push(sheet.names.BAND.definition);
      values.push(sheet.cells.D1.datavalue as number);
    }
    expect(definitions[0]).toBe(definitions[1]);
    expect(values[0]).toBe(values[1]);
    expect(definitions[0]).toBe("A1:B1");
    expect(values[0]).toBe(4);
  });

  test("deleterow of a named single coordinate drives the dependent formula to #REF!", async () => {
    const { candidate, oracle } = await loadPair();
    const outcomes: Array<{ definition: string; formula: string; valuetype: string }> = [];
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, [
        "set A1 value n 4",
        "set A2 value n 5",
        "name define ROWTWO A2",
        "set B1 formula ROWTWO*10",
      ]);
      await scheduleCommands(SC, sheet, "deleterow 2");
      await recalcSheet(SC, sheet);
      outcomes.push({
        definition: sheet.names.ROWTWO.definition,
        formula: sheet.cells.B1.formula,
        valuetype: sheet.cells.B1.valuetype,
      });
    }
    expect(outcomes[0]).toStrictEqual(outcomes[1]);
    expect(outcomes[0].definition).toBe("#REF!");
    expect(outcomes[0].valuetype).toBe("e#REF!");
  });

  test("undo restores a name definition and its dependent formula's value", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "name define BAND A1:C1",
        "set E1 formula SUM(BAND)",
      ]);
      await scheduleCommands(SC, sheet, "deletecol B");
      expect(sheet.names.BAND.definition).toBe("A1:B1");

      await sheetUndo(SC, sheet);
      expect(sheet.names.BAND.definition).toBe("A1:C1");
    }
  });

  test("name delete removes the definition; formulas referencing it become #NAME?", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, ["set A1 value n 1", "name define MYVAL A1"]);
      await scheduleCommands(SC, sheet, "name delete MYVAL");
      expect(sheet.names.MYVAL).toBeUndefined();

      const evaluated = evaluateFormula(SC, "MYVAL*2", sheet);
      expect(evaluated.type).toBe("e#NAME?");
    }
  });
});
