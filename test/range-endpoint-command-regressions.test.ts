import { describe, expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

const MAX_COL = 702;

describe("range endpoint command regressions (Leanstral RangeEndpoints)", () => {
  test("insertcol inside horizontal range expands trailing endpoint and moves formula cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set B1 value n 2",
      "set C1 value n 3",
      "set E1 formula SUM(A1:C1)",
      "name define WIDE A1:C1",
    ]);
    await scheduleCommands(SC, sheet, ["insertcol B"]);
    await recalcSheet(SC, sheet);

    expect(sheet.attribs.lastcol).toBe(6);
    expect(sheet.cells.E1).toBeUndefined();
    expect(sheet.cells.F1?.formula).toBe("SUM(A1:D1)");
    expect(sheet.cells.F1?.datavalue).toBe(6);
    expect(sheet.names.WIDE.definition).toBe("A1:D1");
    expect(sheet.cells.B1?.valuetype).toBe("b");
    expect(sheet.cells.C1?.datavalue).toBe(2);
    expect(sheet.cells.D1?.datavalue).toBe(3);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.attribs.lastcol).toBe(5);
    expect(sheet.cells.E1?.formula).toBe("SUM(A1:C1)");
    expect(sheet.cells.E1?.datavalue).toBe(6);
    expect(sheet.cells.F1).toBeUndefined();
    expect(sheet.names.WIDE.definition).toBe("A1:C1");

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.attribs.lastcol).toBe(6);
    expect(sheet.cells.F1?.formula).toBe("SUM(A1:D1)");
    expect(sheet.cells.F1?.datavalue).toBe(6);
    expect(sheet.names.WIDE.definition).toBe("A1:D1");
  });

  test("deletecol inside horizontal range shrinks trailing endpoint and moves formula cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set B1 value n 2",
      "set C1 value n 3",
      "set E1 formula SUM(A1:C1)",
      "name define WIDE A1:C1",
    ]);
    await scheduleCommands(SC, sheet, ["deletecol B"]);
    await recalcSheet(SC, sheet);

    expect(sheet.attribs.lastcol).toBe(4);
    expect(sheet.cells.D1?.formula).toBe("SUM(A1:B1)");
    expect(sheet.cells.D1?.datavalue).toBe(4);
    expect(sheet.cells.E1).toBeUndefined();
    expect(sheet.names.WIDE.definition).toBe("A1:B1");
    expect(sheet.cells.B1?.datavalue).toBe(3);
    expect(sheet.cells.C1).toBeUndefined();

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.attribs.lastcol).toBe(5);
    expect(sheet.cells.E1?.formula).toBe("SUM(A1:C1)");
    expect(sheet.cells.E1?.datavalue).toBe(6);
    expect(sheet.cells.D1).toBeUndefined();
    expect(sheet.names.WIDE.definition).toBe("A1:C1");

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.attribs.lastcol).toBe(4);
    expect(sheet.cells.D1?.formula).toBe("SUM(A1:B1)");
    expect(sheet.cells.D1?.datavalue).toBe(4);
    expect(sheet.names.WIDE.definition).toBe("A1:B1");
  });

  test("insertcol at ZY expands a ZY-ending range to ZZ at max column", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      `set sheet lastcol ${MAX_COL - 1}`,
      "set ZX1 value n 1",
      "set ZY1 value n 2",
      "set A1 formula SUM(ZX1:ZY1)",
      "name define EDGERANGE ZX1:ZY1",
    ]);
    await scheduleCommands(SC, sheet, ["insertcol ZY"]);
    await recalcSheet(SC, sheet);

    expect(sheet.attribs.lastcol).toBe(MAX_COL);
    expect(sheet.cells.A1?.formula).toBe("SUM(ZX1:ZZ1)");
    expect(sheet.cells.A1?.datavalue).toBe(3);
    expect(sheet.names.EDGERANGE.definition).toBe("ZX1:ZZ1");
    expect(sheet.cells.ZX1?.datavalue).toBe(1);
    expect(sheet.cells.ZY1?.valuetype).toBe("b");
    expect(sheet.cells.ZZ1?.datavalue).toBe(2);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.attribs.lastcol).toBe(MAX_COL - 1);
    expect(sheet.cells.A1?.formula).toBe("SUM(ZX1:ZY1)");
    expect(sheet.cells.A1?.datavalue).toBe(3);
    expect(sheet.names.EDGERANGE.definition).toBe("ZX1:ZY1");
    expect(sheet.cells.ZY1?.datavalue).toBe(2);

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.attribs.lastcol).toBe(MAX_COL);
    expect(sheet.cells.A1?.formula).toBe("SUM(ZX1:ZZ1)");
    expect(sheet.cells.A1?.datavalue).toBe(3);
    expect(sheet.names.EDGERANGE.definition).toBe("ZX1:ZZ1");
  });
});
