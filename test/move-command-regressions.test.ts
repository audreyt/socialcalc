import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";

import { loadSocialCalc, scheduleCommands, sheetRedo, sheetUndo } from "./helpers/socialcalc";

interface HeadlessEditorStub {
  range2: { hasrange: boolean };
  Range2Remove(): void;
  context: {
    sheetobj: unknown;
    rowpanes: { first: number; last: number }[];
    colpanes: { first: number; last: number }[];
    SetRowPaneFirstLast(_n: number, _f: number, _l: number): void;
    SetColPaneFirstLast(_n: number, _f: number, _l: number): void;
  };
  timeout: null;
  griddiv: null;
  ScheduleRender(): void;
  FitToEditTable(): void;
}

interface SocialCalcHarness {
  CurrentSpreadsheetControlObject: { editor: HeadlessEditorStub } | null;
  Formula?: { SheetCache?: { waitingForLoading: unknown } };
}

function installEditorMock(sc: SocialCalcHarness) {
  const fakeEditor: HeadlessEditorStub = {
    range2: { hasrange: false },
    Range2Remove() {
      this.range2 = { hasrange: false };
    },
    context: {
      sheetobj: null,
      rowpanes: [{ first: 1, last: 10 }],
      colpanes: [{ first: 1, last: 10 }],
      SetRowPaneFirstLast(_n: number, _f: number, _l: number) {},
      SetColPaneFirstLast(_n: number, _f: number, _l: number) {},
    },
    timeout: null,
    griddiv: null,
    ScheduleRender() {},
    FitToEditTable() {},
  };
  sc.CurrentSpreadsheetControlObject = { editor: fakeEditor };
}

beforeAll(async () => {
  const SC = await loadSocialCalc();
  installEditorMock(SC as unknown as SocialCalcHarness);
});

afterAll(async () => {
  const SC = await loadSocialCalc();
  const harness = SC as unknown as SocialCalcHarness;
  if (harness.Formula?.SheetCache) {
    harness.Formula.SheetCache.waitingForLoading = null;
  }
});

describe("move command regressions (Leanstral MoveOps)", () => {
  test("movepaste rewrites moved and observer formulas while preserving sheet-qualified refs", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 2",
      "set A2 formula A1+Z1+Sheet2!A1",
      "set Z1 value n 5",
      "set E1 formula A1+A2+Z1+Sheet2!A2",
    ]);

    await scheduleCommands(SC, sheet, ["movepaste A1:A2 C1 all"]);

    expect(sheet.cells.C1?.datavalue).toBe(2);
    expect(sheet.cells.C2?.formula).toBe("C1+Z1+SHEET2!A1");
    expect(sheet.cells.E1?.formula).toBe("C1+C2+Z1+SHEET2!A2");
    expect(sheet.cells.Z1?.datavalue).toBe(5);
    expect(sheet.cells.A1).toBeUndefined();
    expect(sheet.cells.A2).toBeUndefined();
  });

  test("moveinsert vertical push maps moved and intervening cells into observer formulas", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 10",
      "set A2 value n 20",
      "set A3 value n 30",
      "set A4 value n 40",
      "set B1 formula A1+A2+A3+A4+Sheet2!A2",
    ]);

    await scheduleCommands(SC, sheet, ["moveinsert A1:A2 A4 all"]);

    expect(sheet.cells.A1?.datavalue).toBe(30);
    expect(sheet.cells.A2?.datavalue).toBe(10);
    expect(sheet.cells.A3?.datavalue).toBe(20);
    expect(sheet.cells.A4?.datavalue).toBe(40);
    expect(sheet.cells.B1?.formula).toBe("A2+A3+A1+A4+SHEET2!A2");
  });

  test("movepaste rewrites named range and named formula definitions with undo redo", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set B1 value n 2",
      "set C1 value n 3",
      "name define MOVEDRANGE A1:B1",
      "name define MIXEDFORM =A1+B1+C1+Sheet2!A1",
    ]);

    await scheduleCommands(SC, sheet, ["movepaste A1:B1 D1 all"]);

    expect(sheet.names.MOVEDRANGE.definition).toBe("D1:E1");
    expect(sheet.names.MIXEDFORM.definition).toBe("=D1+E1+C1+SHEET2!A1");
    expect(sheet.cells.C1?.datavalue).toBe(3);
    expect(sheet.cells.D1?.datavalue).toBe(1);
    expect(sheet.cells.E1?.datavalue).toBe(2);

    await sheetUndo(SC, sheet);
    expect(sheet.names.MOVEDRANGE.definition).toBe("A1:B1");
    expect(sheet.names.MIXEDFORM.definition).toBe("=A1+B1+C1+Sheet2!A1");
    expect(sheet.cells.A1?.datavalue).toBe(1);
    expect(sheet.cells.B1?.datavalue).toBe(2);

    await sheetRedo(SC, sheet);
    expect(sheet.names.MOVEDRANGE.definition).toBe("D1:E1");
    expect(sheet.names.MIXEDFORM.definition).toBe("=D1+E1+C1+SHEET2!A1");
    expect(sheet.cells.D1?.datavalue).toBe(1);
    expect(sheet.cells.E1?.datavalue).toBe(2);
  });
});
