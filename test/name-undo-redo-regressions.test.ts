import { describe, expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

describe("name undo-redo regressions (Leanstral oracle)", () => {
  test("deletecol shrinks named horizontal range and dependent SUM through two undo-redo cycles", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set B1 value n 2",
      "set C1 value n 3",
      "name define BAND A1:C1",
      "set E1 formula SUM(BAND)",
    ]);

    await scheduleCommands(SC, sheet, ["deletecol B"]);
    await recalcSheet(SC, sheet);

    expect(sheet.names.BAND.definition).toBe("A1:B1");
    expect(sheet.cells.D1.formula).toBe("SUM(BAND)");
    expect(sheet.cells.D1.valuetype).toBe("n");
    expect(sheet.cells.D1.datavalue).toBe(4);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.BAND.definition).toBe("A1:C1");
    expect(sheet.cells.E1.formula).toBe("SUM(BAND)");
    expect(sheet.cells.E1.valuetype).toBe("n");
    expect(sheet.cells.E1.datavalue).toBe(6);

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.BAND.definition).toBe("A1:B1");
    expect(sheet.cells.D1.formula).toBe("SUM(BAND)");
    expect(sheet.cells.D1.datavalue).toBe(4);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.BAND.definition).toBe("A1:B1");
    expect(sheet.cells.D1.formula).toBe("SUM(BAND)");
    expect(sheet.cells.D1.datavalue).toBe(4);
  });

  test("deleterow of named single coordinate drives dependent formula to #REF! and restores idempotently", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 4",
      "set A2 value n 5",
      "set A3 value n 6",
      "name define ROWTWO A2",
      "set B1 formula ROWTWO*10",
    ]);

    await scheduleCommands(SC, sheet, ["deleterow 2"]);
    await recalcSheet(SC, sheet);

    expect(sheet.names.ROWTWO.definition).toBe("#REF!");
    expect(sheet.cells.B1.formula).toBe("ROWTWO*10");
    expect(sheet.cells.B1.valuetype).toBe("e#REF!");
    expect(sheet.cells.B1.datavalue).toBe(0);
    expect(sheet.cells.B1.errors).toBe("#REF!");

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.ROWTWO.definition).toBe("A2");
    expect(sheet.cells.B1.formula).toBe("ROWTWO*10");
    expect(sheet.cells.B1.valuetype).toBe("n");
    expect(sheet.cells.B1.datavalue).toBe(50);

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.ROWTWO.definition).toBe("#REF!");
    expect(sheet.cells.B1.valuetype).toBe("e#REF!");
    expect(sheet.cells.B1.errors).toBe("#REF!");

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.ROWTWO.definition).toBe("#REF!");
    expect(sheet.cells.B1.valuetype).toBe("e#REF!");
    expect(sheet.cells.B1.errors).toBe("#REF!");
  });

  test("insertcol before named formula rewrites the definition while dependent formula stays stable across undo-redo", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set B1 value n 2",
      "name define FML =A1+B1",
      "set C1 formula FML*10",
    ]);

    await scheduleCommands(SC, sheet, ["insertcol A"]);
    await recalcSheet(SC, sheet);

    expect(sheet.names.FML.definition).toBe("=B1+C1");
    expect(sheet.cells.D1.formula).toBe("FML*10");
    expect(sheet.cells.D1.valuetype).toBe("n");
    expect(sheet.cells.D1.datavalue).toBe(30);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.FML.definition).toBe("=A1+B1");
    expect(sheet.cells.C1.formula).toBe("FML*10");
    expect(sheet.cells.C1.valuetype).toBe("n");
    expect(sheet.cells.C1.datavalue).toBe(30);

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.FML.definition).toBe("=B1+C1");
    expect(sheet.cells.D1.formula).toBe("FML*10");
    expect(sheet.cells.D1.datavalue).toBe(30);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.names.FML.definition).toBe("=B1+C1");
    expect(sheet.cells.D1.formula).toBe("FML*10");
    expect(sheet.cells.D1.datavalue).toBe(30);
  });
});
