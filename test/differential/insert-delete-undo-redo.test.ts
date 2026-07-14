// Differential coverage: insertcol/insertrow, deletecol/deleterow, and the
// undo/redo cycle, including the max-column (ZZ = 702) boundary policy.
import { describe, expect, test } from "vite-plus/test";

import {
  installHeadlessEditorMock,
  loadPair,
  runCommands,
  runDifferentialCommands,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "../helpers/differential";

const MAX_COL = 702;

describe("insert/delete parity", () => {
  test("insertcol shifts formulas right of the insert point", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 1", "set B1 formula A1+1", "insertcol A"],
      ["B1", "C1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("insertrow shifts formulas below the insert point", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 1", "set A2 formula A1+1", "insertrow 1"],
      ["A2", "A3"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("deletecol turns formulas in the deleted band into #REF! and shifts survivors left", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 formula B1+C1", "deletecol B"],
      ["A1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("deleterow turns formulas in the deleted band into #REF! and shifts survivors up", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 formula A2+A3", "deleterow 2"],
      ["A1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("insertcol at the max-column boundary leaves the sheet unchanged", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      [`set sheet lastcol ${MAX_COL}`, "set ZY1 value n 1", "set ZZ1 value n 2", "insertcol A"],
      ["ZY1", "ZZ1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("fillright a relative reference past column ZZ becomes #REF! on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    installHeadlessEditorMock(candidate);
    installHeadlessEditorMock(oracle);
    const result = await runDifferentialCommands(
      { candidate, oracle },
      [
        `set sheet lastcol ${MAX_COL}`,
        "set ZY1 formula ZZ1",
        "set ZZ1 value n 0",
        "fillright ZY1:ZZ1 formulas",
      ],
      ["ZZ1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
    expect(result.candidate.ZZ1?.valuetype).toBe("e#REF!");
  });
});

describe("undo/redo parity", () => {
  test("deletecol undo restores the formula in the cell before the deleted column", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, [
        "set A1 formula B1+C1",
        "set B1 value n 2",
        "set C1 value n 3",
      ]);
      await scheduleCommands(SC, sheet, "deletecol B");
      expect(sheet.cells.A1?.formula).toBe("#REF!+B1");

      await sheetUndo(SC, sheet);
      expect(sheet.cells.A1?.formula).toBe("B1+C1");

      await sheetRedo(SC, sheet);
      expect(sheet.cells.A1?.formula).toBe("#REF!+B1");
    }
  });

  test("two undo/redo cycles converge to the same state on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    const snapshots: Array<Record<string, unknown>> = [];
    for (const SC of [candidate, oracle]) {
      const sheet = await runCommands(SC, [
        "set A1 value n 1",
        "set B1 formula A1+1",
        "insertcol A",
      ]);
      await sheetUndo(SC, sheet);
      await sheetRedo(SC, sheet);
      await sheetUndo(SC, sheet);
      await sheetRedo(SC, sheet);
      snapshots.push({
        B1: sheet.cells.B1 && sheet.cells.B1.formula,
        C1: sheet.cells.C1 && sheet.cells.C1.formula,
      });
    }
    expect(snapshots[0]).toStrictEqual(snapshots[1]);
  });
});
