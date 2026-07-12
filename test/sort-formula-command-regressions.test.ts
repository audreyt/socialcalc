import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("sort formula external relative refs", () => {
  test("sort freezes external relative anchors; rewrites in-band relatives; keeps $ abs", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set Z1 value n 100",
      "set A1 value n 30",
      "set B1 formula Z1+A1",
      "set C1 formula $Z$1+A1",
      "set A2 value n 10",
      "set B2 formula Z1+A2",
      "set C2 formula $Z$1+A2",
      "set A3 value n 20",
      "set B3 formula Z1+A3",
      "set C3 formula $Z$1+A3",
      "sort A1:C3 A up",
    ]);
    await recalcSheet(SC, sheet);

    // Sorted order by A: 10, 20, 30 → rows 1..3
    expect(sheet.cells.A1.datavalue).toBe(10);
    expect(sheet.cells.A2.datavalue).toBe(20);
    expect(sheet.cells.A3.datavalue).toBe(30);

    // External Z1 stays Z1 (not #REF!/Z3)
    expect(sheet.cells.B1.formula).toBe("Z1+A1");
    expect(sheet.cells.B2.formula).toBe("Z1+A2");
    expect(sheet.cells.B3.formula).toBe("Z1+A3");
    expect(sheet.cells.B1.datavalue).toBe(110);
    expect(sheet.cells.B2.datavalue).toBe(120);
    expect(sheet.cells.B3.datavalue).toBe(130);

    // Absolute external stays absolute
    expect(sheet.cells.C1.formula).toBe("$Z$1+A1");
    expect(sheet.cells.C2.formula).toBe("$Z$1+A2");
    expect(sheet.cells.C3.formula).toBe("$Z$1+A3");
    expect(sheet.cells.C1.datavalue).toBe(110);
    expect(sheet.cells.C3.datavalue).toBe(130);
  });

  test("OffsetFormulaCoords band option freezes out-of-band relative coords", async () => {
    const SC = await loadSocialCalc();
    expect(SC.OffsetFormulaCoords("Z1+A1", 0, 2)).toBe("Z3+A3");
    expect(
      SC.OffsetFormulaCoords("Z1+A1", 0, 2, {
        startCol: 1,
        endCol: 3,
        startRow: 1,
        endRow: 3,
      }),
    ).toBe("Z1+A3");
    expect(
      SC.OffsetFormulaCoords("$Z$1+A1", 0, 2, {
        startCol: 1,
        endCol: 3,
        startRow: 1,
        endRow: 3,
      }),
    ).toBe("$Z$1+A3");
  });

  test("OffsetFormulaCoords band freezes sheet-qualified coords", async () => {
    const SC = await loadSocialCalc();
    const band = { startCol: 1, endCol: 3, startRow: 1, endRow: 3 };
    expect(SC.OffsetFormulaCoords("Sheet2!A1+B1", 0, 2, band)).toBe("SHEET2!A1+B3");
    expect(SC.OffsetFormulaCoords("Sheet2!A1:B1", 0, 2, band)).toBe("SHEET2!A1:B1");
  });
});
