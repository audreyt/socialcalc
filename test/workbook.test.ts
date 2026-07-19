import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

// Formula.SheetCache/RecalcInfo are shared globals across every loadSocialCalc()
// caller in one isolated Vitest worker (see test/formula-coverage.test.ts's
// resetFormulaGlobals). Workbook.AddSheet/DeleteSheet/RenameSheet register
// sheets directly into that same cache, so each test resets it to avoid
// leaking sheets/state into siblings.
function resetWorkbookGlobals(SC: any) {
  if (SC.RecalcInfo) {
    SC.RecalcInfo.LoadSheet = () => false;
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
    SC.RecalcInfo.sheet = null;
    if (SC.RecalcInfo.recalctimer) {
      try {
        clearTimeout(SC.RecalcInfo.recalctimer);
      } catch {
        // cleanup: recalctimer may already have fired/cleared; best-effort clear only.
      }
      SC.RecalcInfo.recalctimer = null;
    }
    SC.RecalcInfo.firstRenderScheduled = false;
  }
  if (SC.Formula) {
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;
    SC.Formula.FreshnessInfo.sheets = {};
    SC.Formula.FreshnessInfo.volatile = {};
    SC.Formula.RemoteFunctionInfo.waitingForServer = null;
  }
}

async function freshSC() {
  const SC = await loadSocialCalc();
  resetWorkbookGlobals(SC);
  return SC;
}

function setValue(sheet: any, coord: string, value: number) {
  const cell = sheet.GetAssuredCell(coord);
  cell.datatype = "v";
  cell.datavalue = value;
  cell.valuetype = "n";
}

function setFormula(sheet: any, coord: string, formula: string) {
  const cell = sheet.GetAssuredCell(coord);
  cell.datatype = "f";
  cell.formula = formula;
  delete cell.parseinfo;
}

function recalcAll(wb: any): Promise<void> {
  return new Promise((resolve) => wb.RecalcAll(() => resolve()));
}

// ---------------------------------------------------------------------------
// Model: add / delete / rename / reorder / hide / unhide
// ---------------------------------------------------------------------------

describe("Workbook model: basic sheet lifecycle", () => {
  test("new Workbook starts empty; AddSheet becomes active automatically", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    expect(wb.sheetOrder).toEqual([]);
    expect(wb.activeSheetName).toBeNull();

    const code = wb.AddSheet("Sheet1");
    expect(code).toBe(SC.WorkbookNameValidation.OK);
    expect(wb.sheetOrder).toEqual(["Sheet1"]);
    expect(wb.activeSheetName).toBe("Sheet1");
    expect(wb.GetSheet("Sheet1")).not.toBeNull();
    expect(wb.GetActiveSheet()).toBe(wb.GetSheet("Sheet1"));
  });

  test("AddSheet: subsequent sheets do not steal the active pointer", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("First");
    wb.AddSheet("Second");
    expect(wb.activeSheetName).toBe("First");
    expect(wb.sheetOrder).toEqual(["First", "Second"]);
  });

  test("AddSheet: rejects empty, too-long, invalid-char, and duplicate names", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Sheet1");

    expect(wb.AddSheet("   ")).toBe(SC.WorkbookNameValidation.EMPTY);
    expect(wb.AddSheet("a".repeat(300))).toBe(SC.WorkbookNameValidation.TOO_LONG);
    expect(wb.AddSheet("Bad:Name")).toBe(SC.WorkbookNameValidation.INVALID_CHARS);
    expect(wb.AddSheet("Sheet1")).toBe(SC.WorkbookNameValidation.DUPLICATE);
    expect(wb.AddSheet("sheet1")).toBe(SC.WorkbookNameValidation.DUPLICATE); // case-insensitive
    // None of the rejected calls actually added a sheet.
    expect(wb.sheetOrder).toEqual(["Sheet1"]);
  });

  test("DeleteSheet: refuses to delete the last remaining sheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Only");
    expect(wb.DeleteSheet("Only")).toBe(false);
    expect(wb.sheetOrder).toEqual(["Only"]);
  });

  test("DeleteSheet: removes the sheet and unregisters it from the SheetCache", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    expect(SC.Formula.SheetCache.sheets[SC.WorkbookNormalizeSheetName("B")]).toBeDefined();

    expect(wb.DeleteSheet("B")).toBe(true);
    expect(wb.sheetOrder).toEqual(["A"]);
    expect(wb.GetSheet("B")).toBeNull();
    expect(SC.Formula.SheetCache.sheets[SC.WorkbookNormalizeSheetName("B")]).toBeUndefined();
  });

  test("DeleteSheet: unknown name is a no-op returning false", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(wb.DeleteSheet("DoesNotExist")).toBe(false);
  });

  test("regression: DeleteSheet refuses to delete the last VISIBLE sheet even when hidden sheets exist (min-1-visible invariant)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Visible");
    wb.AddSheet("Hidden");
    wb.HideSheet("Hidden");

    // Without the fix, only the total-sheet-count guard applied here (2 > 1
    // passes), so deleting the workbook's only visible sheet would succeed
    // and strand activeSheetName on the now-sole (hidden) sheet — zero
    // visible sheets, and an active sheet that isn't visible.
    expect(wb.DeleteSheet("Visible")).toBe(false);
    expect(wb.sheetOrder).toEqual(["Visible", "Hidden"]);
    expect(wb.activeSheetName).toBe("Visible");
    expect(wb.IsSheetVisible(wb.activeSheetName!)).toBe(true);
  });

  test("regression: deleting the active sheet with another visible sheet present lands on that visible sheet, never a hidden one", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.AddSheet("HiddenC");
    wb.HideSheet("HiddenC");
    wb.SetActiveSheet("A");

    expect(wb.DeleteSheet("A")).toBe(true);
    expect(wb.activeSheetName).toBe("B");
    expect(wb.IsSheetVisible(wb.activeSheetName!)).toBe(true);
  });

  test("RenameSheet: validates the new name and updates sheetOrder/lookup", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Old");
    wb.AddSheet("Other");

    expect(wb.RenameSheet("Old", "New")).toBe(SC.WorkbookNameValidation.OK);
    expect(wb.sheetOrder).toEqual(["New", "Other"]);
    expect(wb.GetSheet("Old")).toBeNull();
    expect(wb.GetSheet("New")).not.toBeNull();

    // Renaming to an existing name is rejected and leaves state untouched.
    expect(wb.RenameSheet("New", "Other")).toBe(SC.WorkbookNameValidation.DUPLICATE);
    expect(wb.sheetOrder).toEqual(["New", "Other"]);

    // No-op rename to the SAME name (own name excluded from the dup check).
    expect(wb.RenameSheet("New", "New")).toBe(SC.WorkbookNameValidation.OK);
  });

  test("RenameSheet: active sheet name follows the rename", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Old");
    expect(wb.activeSheetName).toBe("Old");
    wb.RenameSheet("Old", "New");
    expect(wb.activeSheetName).toBe("New");
  });

  test("ReorderSheet: moves a sheet and clamps out-of-range indices", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.AddSheet("C");

    expect(wb.ReorderSheet("C", 0)).toBe(true);
    expect(wb.sheetOrder).toEqual(["C", "A", "B"]);

    expect(wb.ReorderSheet("A", 99)).toBe(true); // clamps to last index
    expect(wb.sheetOrder).toEqual(["C", "B", "A"]);

    expect(wb.ReorderSheet("B", -5)).toBe(true); // clamps to 0
    expect(wb.sheetOrder).toEqual(["B", "C", "A"]);
  });

  test("HideSheet/UnhideSheet: toggles visibility; refuses to hide the last visible sheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");

    expect(wb.IsSheetVisible("B")).toBe(true);
    expect(wb.HideSheet("B")).toBe(true);
    expect(wb.IsSheetVisible("B")).toBe(false);
    expect(wb.ListSheets()).toEqual([
      { name: "A", visible: true },
      { name: "B", visible: false },
    ]);

    // Only A remains visible now; hiding it must be refused.
    expect(wb.HideSheet("A")).toBe(false);
    expect(wb.IsSheetVisible("A")).toBe(true);

    expect(wb.UnhideSheet("B")).toBe(true);
    expect(wb.IsSheetVisible("B")).toBe(true);
  });

  test("per-sheet editor settings: set/get is independent per sheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");

    wb.SetSheetEditorSettings("A", "version:1.0\necell:B2\n");
    expect(wb.GetSheetEditorSettings("A")).toBe("version:1.0\necell:B2\n");
    expect(wb.GetSheetEditorSettings("B")).toBe(""); // untouched sheet defaults to ""
  });
});

// ---------------------------------------------------------------------------
// Active-sheet / visible-sheet invariants under delete/hide
// ---------------------------------------------------------------------------

describe("Workbook invariants: active sheet always exists and is visible", () => {
  test("deleting the active (middle) sheet moves active to the sheet that slides into its slot", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Alpha");
    wb.AddSheet("Beta");
    wb.AddSheet("Gamma");
    wb.SetActiveSheet("Beta");

    wb.DeleteSheet("Beta");
    expect(wb.sheetOrder).toEqual(["Alpha", "Gamma"]);
    expect(wb.activeSheetName).toBe("Gamma");
  });

  test("deleting the active (last) sheet moves active to the new last sheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Alpha");
    wb.AddSheet("Beta");
    wb.SetActiveSheet("Beta");

    wb.DeleteSheet("Beta");
    expect(wb.sheetOrder).toEqual(["Alpha"]);
    expect(wb.activeSheetName).toBe("Alpha");
  });

  test("deleting a non-active sheet leaves the active sheet untouched", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Alpha");
    wb.AddSheet("Beta");
    wb.AddSheet("Gamma");
    wb.SetActiveSheet("Gamma");

    wb.DeleteSheet("Alpha");
    expect(wb.activeSheetName).toBe("Gamma");
  });

  test("hiding the active sheet moves active to the next visible sheet, else the previous one", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.AddSheet("C");
    wb.SetActiveSheet("B");

    wb.HideSheet("B");
    expect(wb.activeSheetName).toBe("C"); // next visible sheet preferred

    wb.SetActiveSheet("C");
    wb.HideSheet("C");
    expect(wb.activeSheetName).toBe("A"); // no next visible sheet -> falls back to previous
  });

  test("SetActiveSheet refuses hidden or nonexistent sheets", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.HideSheet("B");

    expect(wb.SetActiveSheet("B")).toBe(false);
    expect(wb.activeSheetName).toBe("A");
    expect(wb.SetActiveSheet("Nope")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Command undo/redo, including the delete-active/hide-active ordering fixes
// ---------------------------------------------------------------------------

describe("Workbook undo/redo", () => {
  test("undo/redo AddSheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.WorkbookUndo();
    expect(wb.sheetOrder).toEqual(["A"]);
    wb.WorkbookRedo();
    expect(wb.sheetOrder).toEqual(["A", "B"]);
  });

  test("undo restores a deleted sheet's exact saved content, order, visibility, and editor settings", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.AddSheet("C");
    setValue(wb.GetSheet("B"), "A1", 99);
    wb.SetSheetEditorSettings("B", "version:1.0\necell:C3\n");
    wb.HideSheet("B");
    wb.UnhideSheet("B"); // back to visible; just exercising both directions first

    wb.DeleteSheet("B");
    expect(wb.sheetOrder).toEqual(["A", "C"]);

    wb.WorkbookUndo();
    expect(wb.sheetOrder).toEqual(["A", "B", "C"]); // original position restored
    expect(wb.GetSheet("B")!.GetAssuredCell("A1").datavalue).toBe(99);
    expect(wb.GetSheetEditorSettings("B")).toBe("version:1.0\necell:C3\n");
    expect(wb.IsSheetVisible("B")).toBe(true);
  });

  test("regression: undoing delete of the ACTIVE sheet restores it as active (undo-order fix)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Alpha");
    wb.AddSheet("Beta");
    wb.AddSheet("Gamma");
    wb.SetActiveSheet("Beta");

    wb.DeleteSheet("Beta");
    expect(wb.activeSheetName).toBe("Gamma"); // shifted away during delete

    wb.WorkbookUndo();
    // Without the fix, "setactivesheet Beta" would replay BEFORE
    // "restoresheet Beta" (undo commands replay last-added-first) and
    // silently no-op because Beta does not exist yet at that point,
    // leaving activeSheetName stuck on Gamma.
    expect(wb.activeSheetName).toBe("Beta");
    expect(wb.sheetOrder).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  test("regression: undoing hide of the ACTIVE sheet restores it as active (undo-order fix)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("X");
    wb.AddSheet("Y");
    wb.SetActiveSheet("Y");

    wb.HideSheet("Y");
    expect(wb.activeSheetName).toBe("X"); // shifted away during hide
    expect(wb.IsSheetVisible("Y")).toBe(false);

    wb.WorkbookUndo();
    // Without the fix, "setactivesheet Y" would replay BEFORE "unhidesheet
    // Y" and SetActiveSheet's visibility guard would reject it, leaving
    // activeSheetName stuck on X even though Y is visible again.
    expect(wb.IsSheetVisible("Y")).toBe(true);
    expect(wb.activeSheetName).toBe("Y");
  });

  test("undo/redo RenameSheet round-trips the active-sheet name", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Old");
    wb.RenameSheet("Old", "New");
    expect(wb.activeSheetName).toBe("New");

    wb.WorkbookUndo();
    expect(wb.activeSheetName).toBe("Old");
    expect(wb.sheetOrder).toEqual(["Old"]);

    wb.WorkbookRedo();
    expect(wb.activeSheetName).toBe("New");
    expect(wb.sheetOrder).toEqual(["New"]);
  });

  test("undo/redo ReorderSheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.AddSheet("C");
    wb.ReorderSheet("C", 0);
    expect(wb.sheetOrder).toEqual(["C", "A", "B"]);

    wb.WorkbookUndo();
    expect(wb.sheetOrder).toEqual(["A", "B", "C"]);

    wb.WorkbookRedo();
    expect(wb.sheetOrder).toEqual(["C", "A", "B"]);
  });

  test("undo/redo Hide/Unhide", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.HideSheet("B");
    expect(wb.IsSheetVisible("B")).toBe(false);

    wb.WorkbookUndo();
    expect(wb.IsSheetVisible("B")).toBe(true);

    wb.WorkbookRedo();
    expect(wb.IsSheetVisible("B")).toBe(false);
  });

  test("undo/redo SetActiveSheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    wb.AddSheet("B");
    wb.SetActiveSheet("B");
    expect(wb.activeSheetName).toBe("B");

    wb.WorkbookUndo();
    expect(wb.activeSheetName).toBe("A");

    wb.WorkbookRedo();
    expect(wb.activeSheetName).toBe("B");
  });

  test("WorkbookUndo never violates the min-1-sheet invariant, even when the undo command targets the last sheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    // AddSheet's undo action is "delete A" — replaying it would leave the
    // workbook with zero sheets, so DeleteSheet's own invariant guard
    // refuses it (same as calling DeleteSheet directly on the last sheet).
    // The undo pointer still advances (matches SheetUndo's unconditional
    // replay semantics) but the sheet itself is never actually removed.
    expect(() => wb.WorkbookUndo()).not.toThrow();
    expect(wb.sheetOrder).toEqual(["A"]);
    expect(() => wb.WorkbookUndo()).not.toThrow(); // second undo: nothing left on the stack
    expect(wb.sheetOrder).toEqual(["A"]);
    expect(() => wb.WorkbookRedo()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cross-sheet formula chains, cycles, and rename/delete rewrite
// ---------------------------------------------------------------------------

describe("Workbook cross-sheet formulas", () => {
  test("RecalcAll resolves a two-sheet chain synchronously (no async LoadSheet needed)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Data");
    wb.AddSheet("Summary");
    setValue(wb.GetSheet("Data"), "A1", 10);
    setValue(wb.GetSheet("Data"), "A2", 20);
    setFormula(wb.GetSheet("Summary"), "A1", "SUM(Data!A1:A2)");
    setFormula(wb.GetSheet("Summary"), "A2", "Data!A1+1");

    await recalcAll(wb);

    expect(wb.GetSheet("Summary")!.GetAssuredCell("A1").datavalue).toBe(30);
    expect(wb.GetSheet("Summary")!.GetAssuredCell("A2").datavalue).toBe(11);
  });

  test("RecalcAll converges a three-sheet dependency chain (Alpha depends on Beta depends on Gamma)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    // Add in reverse dependency order so a single naive pass over
    // sheetOrder would NOT converge without RecalcAll's multi-round logic.
    // Sheet names are 3+ characters: SocialCalc's formula grammar resolves
    // a bare 1-2 letter name as a whole-column reference (see
    // Formula.LookupName's `/^[a-zA-Z][a-zA-Z]?$/` column fallback), so
    // single-letter sheet names like "B"/"C" would collide with that and
    // is not something workbook sheet naming can special-case around.
    wb.AddSheet("Alpha");
    wb.AddSheet("Beta");
    wb.AddSheet("Gamma");
    setValue(wb.GetSheet("Gamma"), "A1", 5);
    setFormula(wb.GetSheet("Beta"), "A1", "Gamma!A1*2");
    setFormula(wb.GetSheet("Alpha"), "A1", "Beta!A1+1");

    await recalcAll(wb);

    expect(wb.GetSheet("Beta")!.GetAssuredCell("A1").datavalue).toBe(10);
    expect(wb.GetSheet("Alpha")!.GetAssuredCell("A1").datavalue).toBe(11);
  });

  test("a formula cycle across sheets terminates deterministically without hanging or crashing (RecalcAll's bounded round cap)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Cross");
    wb.AddSheet("Ways");
    setFormula(wb.GetSheet("Cross"), "A1", "Ways!A1+1");
    setFormula(wb.GetSheet("Ways"), "A1", "Cross!A1+1");

    // Known limitation (documented, not a crash/hang risk): per-sheet
    // RecalcCheckCell dependency tracking does not span sheet boundaries,
    // so a genuine cross-sheet cycle is NOT flagged with a circular-
    // reference error the way a same-sheet cycle is. RecalcAll's bounded
    // round cap (sheetOrder.length rounds) still guarantees termination:
    // each round both cells resolve against the OTHER sheet's value from
    // the previous round, so the result stabilizes deterministically once
    // the round budget is exhausted rather than looping forever.
    await recalcAll(wb);

    const crossCell = wb.GetSheet("Cross")!.GetAssuredCell("A1");
    const waysCell = wb.GetSheet("Ways")!.GetAssuredCell("A1");
    expect(crossCell.valuetype.charAt(0)).not.toBe("e"); // no crash/error type
    expect(waysCell.valuetype.charAt(0)).not.toBe("e");
    expect(typeof crossCell.datavalue).toBe("number");
    expect(typeof waysCell.datavalue).toBe("number");

    // Determinism: re-running from the same initial formulas on a fresh
    // workbook produces the identical bounded result every time.
    const wb2 = new SC.Workbook();
    wb2.AddSheet("Cross");
    wb2.AddSheet("Ways");
    setFormula(wb2.GetSheet("Cross"), "A1", "Ways!A1+1");
    setFormula(wb2.GetSheet("Ways"), "A1", "Cross!A1+1");
    await recalcAll(wb2);
    expect(wb2.GetSheet("Cross")!.GetAssuredCell("A1").datavalue).toBe(crossCell.datavalue);
    expect(wb2.GetSheet("Ways")!.GetAssuredCell("A1").datavalue).toBe(waysCell.datavalue);
  });

  test("a formula cycle WITHIN a single sheet is still flagged with a circular-reference error (unaffected by Workbook)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Loop");
    // Mutual scalar reference (A1=B1, B1=A1): the proven shape that trips
    // RecalcCheckCell's scalar-path circular detector (see
    // test/hardening-sheet-core-branches.test.ts's C-4199 case). A1=A2+1/
    // A2=A1+1 does NOT trip it — the "+1" op breaks the direct token chain
    // RecalcCheckCell walks, so it is not equivalent for this assertion.
    setFormula(wb.GetSheet("Loop"), "A1", "B1");
    setFormula(wb.GetSheet("Loop"), "B1", "A1");

    await recalcAll(wb);

    // RecalcCheckCell's circular-ref detector sets cell.errors only on the
    // detector's OWN pass; the subsequent calc pass evaluates the formula
    // successfully (it just resolves to a shared numeric value with no
    // arithmetic error) and clears cell.errors again (see
    // RecalcTimerRoutine's "if (eresult.error) ... else delete cell.errors"
    // branch). sheet.attribs.circularreferencecell is the detector's
    // PERSISTENT marker and is the durable contract to assert here.
    expect(wb.GetSheet("Loop")!.attribs.circularreferencecell).toBeTruthy();
  });

  test("RenameSheet rewrites cross-sheet formula AND named-range references", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Old");
    wb.AddSheet("Ref");
    setValue(wb.GetSheet("Old"), "A1", 7);
    setFormula(wb.GetSheet("Ref"), "A1", "Old!A1+Old!A1");
    wb.GetSheet("Ref").names["MYNAME"] = { desc: "", definition: "=Old!A1" };

    expect(wb.RenameSheet("Old", "Renamed")).toBe(SC.WorkbookNameValidation.OK);

    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("Renamed!A1+Renamed!A1");
    expect(wb.GetSheet("Ref")!.names["MYNAME"].definition).toBe("=Renamed!A1");

    await recalcAll(wb);
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").datavalue).toBe(14);
  });

  test("DeleteSheet rewrites every referencing formula to #REF! (single coord and range forms)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Data");
    wb.AddSheet("Ref");
    setFormula(wb.GetSheet("Ref"), "A1", "Data!A1");
    setFormula(wb.GetSheet("Ref"), "A2", "SUM(Data!A1:A2)");
    setFormula(wb.GetSheet("Ref"), "A3", "Data!A1+1");

    wb.DeleteSheet("Data");

    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("#REF!");
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A2").formula).toBe("SUM(#REF!)");
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A3").formula).toBe("#REF!+1");

    await recalcAll(wb);
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").valuetype.charAt(0)).toBe("e");
  });

  test("DeleteSheet collapses a sheet-qualified reference to a NAME (not a cell coord) to a bare #REF! without consuming extra tokens", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Data");
    wb.AddSheet("Ref");
    wb.GetSheet("Data")!.names["MYNAME"] = { desc: "", definition: "A1" };
    // "Data!MYNAME" — the token right after "Data!" is a NAME token, not a
    // coord, so the delete-band's optional single/range-coord consumption
    // must NOT eat it: only "Data!" collapses to "#REF!", leaving "MYNAME"
    // as a separate (now-dangling but syntactically untouched) token.
    setFormula(wb.GetSheet("Ref"), "A1", "Data!MYNAME+1");

    wb.DeleteSheet("Data");

    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("#REF!MYNAME+1");
  });

  test("undo of DeleteSheet restores the exact pre-delete formula text in every referencing sheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Data");
    wb.AddSheet("Ref");
    setFormula(wb.GetSheet("Ref"), "A1", "SUM(Data!A1:A2)");

    wb.DeleteSheet("Data");
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("SUM(#REF!)");

    wb.WorkbookUndo();
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("SUM(Data!A1:A2)");
  });

  test("undo of RenameSheet restores the exact pre-rename formula text", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Old");
    wb.AddSheet("Ref");
    setFormula(wb.GetSheet("Ref"), "A1", "Old!A1+Old!A2");

    wb.RenameSheet("Old", "New");
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("New!A1+New!A2");

    wb.WorkbookUndo();
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("Old!A1+Old!A2");
  });

  test("rename rewrites only the matching sheet-qualifier; other sheet-qualified references in the same formula keep their target but go through the shipping tokenizer's uppercase-name normalization", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Alpha");
    wb.AddSheet("Beta");
    wb.AddSheet("Ref");
    setFormula(wb.GetSheet("Ref"), "A1", "Alpha!A1+Beta!A1");

    wb.RenameSheet("Alpha", "Gamma");
    // Beta!A1 is untouched in TARGET (still points at Beta), but the
    // formula is reconstructed token-by-token (same as the shipping
    // AdjustFormulaCoords/ReplaceFormulaCoords full-formula rewrites),
    // which uppercases bare NAME tokens exactly like the tokenizer does
    // at parse time (formula-parse.ts's `str.toUpperCase()` name push).
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe("Gamma!A1+BETA!A1");
  });

  test("rename of a sheet with no references anywhere leaves every unrelated formula byte-identical (no spurious rewrite)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Alpha");
    wb.AddSheet("Unrelated");
    // Deliberately lowercase/mixed-case bare name and no sheet qualifier at
    // all: if RewriteSheetNameInFormula token-reconstructed unconditionally,
    // this would get silently uppercased even though it never referenced
    // Alpha.
    setFormula(wb.GetSheet("Unrelated"), "A1", "myname+1");
    wb.GetSheet("Unrelated").names["MYNAME"] = { desc: "", definition: "A1" };

    wb.RenameSheet("Alpha", "Gamma");

    expect(wb.GetSheet("Unrelated")!.GetAssuredCell("A1").formula).toBe("myname+1");
    expect(wb.GetSheet("Unrelated")!.names["MYNAME"].definition).toBe("A1");
  });

  test("regression: renaming to a 1-2 letter sheet name quotes the emitted reference so it stays a usable sheet-qualifier", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Data");
    wb.AddSheet("Ref");
    setValue(wb.GetSheet("Data"), "A1", 9);
    setFormula(wb.GetSheet("Ref"), "A1", "Data!A1");

    // Without quoting, "B!A1" (bare) would collide with LookupName's
    // whole-column-reference fallback for 1-2 letter alpha names and the
    // reference would resolve to a WRONG value instead of erroring loudly
    // (silent data corruption, not just an inconvenience).
    expect(wb.RenameSheet("Data", "B")).toBe(SC.WorkbookNameValidation.OK);
    const formula = wb.GetSheet("Ref")!.GetAssuredCell("A1").formula;
    expect(formula).toBe('"B"!A1');

    await recalcAll(wb);
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").datavalue).toBe(9);
  });

  test("a matched rename preserves a string-literal token elsewhere in the same formula", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Old");
    wb.AddSheet("Ref");
    setFormula(wb.GetSheet("Ref"), "A1", 'Old!A1&"static text"');

    wb.RenameSheet("Old", "New");
    // The sheet-qualifier is rewritten; the string literal token is
    // re-emitted through quoteFormulaString verbatim (RewriteSheetNameInFormula's
    // token_string branch), unaffected by the rename.
    expect(wb.GetSheet("Ref")!.GetAssuredCell("A1").formula).toBe('New!A1&"static text"');
  });
});

// ---------------------------------------------------------------------------
// Status callback, undo-command dispatch edge cases, RecalcAll edge cases
// ---------------------------------------------------------------------------

describe("Workbook status callback and command-dispatch edge cases", () => {
  test("workbook.statuscallback fires with (workbook, status, arg, params) on every mutating operation", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    const calls: Array<{ status: string; arg: unknown; params: unknown }> = [];
    wb.statuscallbackparams = { host: true };
    wb.statuscallback = (workbookArg: unknown, status: string, arg: unknown, params: unknown) => {
      expect(workbookArg).toBe(wb);
      calls.push({ status, arg, params });
    };

    wb.AddSheet("A");
    expect(calls).toEqual([{ status: "addsheet", arg: { name: "A" }, params: { host: true } }]);
  });

  test("ExecuteWorkbookCommand ignores an unrecognized command verb (default switch case)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(() => SC.ExecuteWorkbookCommand(wb, "workbook bogusverb foo", false)).not.toThrow();
    // No state changed by the unrecognized command.
    expect(wb.sheetOrder).toEqual(["A"]);
  });

  test("RecalcAll on an empty workbook calls back synchronously without iterating any sheet", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    let called = false;
    await new Promise<void>((resolve) => {
      wb.RecalcAll(() => {
        called = true;
        resolve();
      });
    });
    expect(called).toBe(true);
  });

  test("RecalcAll works with no callback argument at all (empty workbook)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    expect(() => wb.RecalcAll()).not.toThrow();
  });

  test("RecalcAll works with no callback argument at all (non-empty workbook) and still fires 'recalcallfinished'", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Only");
    setValue(wb.GetSheet("Only"), "A1", 1);

    const statuses: string[] = [];
    wb.statuscallback = (_wb: unknown, status: string) => statuses.push(status);

    expect(() => wb.RecalcAll()).not.toThrow();
    // Give the timer-driven per-sheet recalc a tick to finish, then verify
    // the completion status still fired even with callback omitted.
    await new Promise<void>((resolve) => {
      const check = () => {
        if (statuses.includes("recalcallfinished")) {
          resolve();
        } else {
          setTimeout(check, 5);
        }
      };
      check();
    });
    expect(statuses).toContain("recalcallfinished");
  });

  test("RecalcAll tolerates a sheet name that no longer resolves mid-round (defensive null-sheet skip)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Real");
    // Simulate a sheet vanishing between RecalcAll's initial sheetOrder
    // snapshot and the per-sheet start: GetSheet returns null for one name
    // in the (already-snapshotted) round list.
    const originalGetSheet = wb.GetSheet.bind(wb);
    let callCount = 0;
    wb.GetSheet = (name: string) => {
      callCount++;
      if (callCount === 1) return null;
      return originalGetSheet(name);
    };
    await expect(recalcAll(wb)).resolves.toBeUndefined();
    expect(callCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Legacy single-sheet API/byte compatibility
// ---------------------------------------------------------------------------

describe("Workbook is purely additive: legacy single-sheet APIs are unaffected", () => {
  test("a plain SC.Sheet never touched by a Workbook behaves and serializes exactly as before", async () => {
    const SC = await freshSC();
    const sheet = new SC.Sheet();
    setValue(sheet, "A1", 42);
    const saved = sheet.CreateSheetSave();
    expect(saved.startsWith("version:1.5\n")).toBe(true);
    expect(saved).toContain("cell:A1:v:42");
    expect(saved).not.toContain("workbook");
  });

  test("SC.SpreadsheetControl constructor/single-sheet fields are unchanged without EnableWorkbookMode", async () => {
    const SC = await freshSC();
    const control = new SC.SpreadsheetControl("Test-");
    expect(control.sheet).toBeInstanceOf(SC.Sheet);
    expect(control.workbookState).toBeUndefined();
    expect(typeof control.IsWorkbookMode).toBe("function");
    expect(control.IsWorkbookMode()).toBe(false);
  });
});

test("ExecuteWorkbookCommand: a 'restoreformula' command targeting a sheet that no longer exists is a silent no-op", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  expect(() =>
    SC.ExecuteWorkbookCommand(wb, "workbook restoreformula NoSuchSheet A1 =1", false),
  ).not.toThrow();
  expect(wb.sheetOrder).toEqual(["A"]);
});

test("WorkbookRedo on a workbook with no undone operation (empty/exhausted redo stack) is a silent no-op", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  // No WorkbookUndo() call precedes this: the redo stack is empty.
  expect(() => wb.WorkbookRedo()).not.toThrow();
  expect(wb.sheetOrder).toEqual(["A"]);
});

test("RecalcAll chains through and restores a sheet's pre-existing statuscallback rather than clobbering it", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("Only");
  setValue(wb.GetSheet("Only"), "A1", 1);

  const preExistingCalls: string[] = [];
  const preExistingCallback = (
    _sheet: unknown,
    status: string,
    _arg: unknown,
    _params: unknown,
  ) => {
    preExistingCalls.push(status);
  };
  wb.GetSheet("Only")!.statuscallback = preExistingCallback;

  await recalcAll(wb);

  // The pre-existing callback was chained through DURING the recalc (it
  // must have observed at least one status, e.g. "calcfinished") and then
  // restored as the sheet's callback afterward — never silently dropped.
  expect(preExistingCalls.length).toBeGreaterThan(0);
  expect(wb.GetSheet("Only")!.statuscallback).toBe(preExistingCallback);
});

describe("Workbook operations on a nonexistent sheet name return the falsy/empty sentinel", () => {
  test("RenameSheet: nonexistent old name returns EMPTY", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(wb.RenameSheet("DoesNotExist", "New")).toBe(SC.WorkbookNameValidation.EMPTY);
  });

  test("ReorderSheet: nonexistent name returns false", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(wb.ReorderSheet("DoesNotExist", 0)).toBe(false);
  });

  test("HideSheet: nonexistent name returns false", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(wb.HideSheet("DoesNotExist")).toBe(false);
  });

  test("UnhideSheet: nonexistent name returns false", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(wb.UnhideSheet("DoesNotExist")).toBe(false);
  });

  test("SetActiveSheet: nonexistent name returns false", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(wb.SetActiveSheet("DoesNotExist")).toBe(false);
  });

  test("SetSheetEditorSettings: nonexistent name is a silent no-op", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(() => wb.SetSheetEditorSettings("DoesNotExist", "version:1.0\n")).not.toThrow();
  });

  test("GetSheetEditorSettings: nonexistent name returns empty string", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("A");
    expect(wb.GetSheetEditorSettings("DoesNotExist")).toBe("");
  });
});

test("GetActiveSheet on a freshly-constructed empty workbook returns null", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  expect(wb.GetActiveSheet()).toBeNull();
});

test("ReorderSheet: moving a sheet to its own current index is a true no-op (clamped === oldIndex)", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  wb.AddSheet("B");
  expect(wb.ReorderSheet("A", 0)).toBe(true); // already at index 0
  expect(wb.sheetOrder).toEqual(["A", "B"]);
});

test("RenameSheet of a non-active sheet leaves activeSheetName untouched", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A"); // active
  wb.AddSheet("B");
  wb.RenameSheet("B", "Renamed");
  expect(wb.activeSheetName).toBe("A");
  expect(wb.sheetOrder).toEqual(["A", "Renamed"]);
});

test("hiding the active sheet with a LATER visible sheet lands on that later sheet (next-in-order branch)", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  wb.AddSheet("B");
  wb.AddSheet("C");
  wb.SetActiveSheet("A");

  wb.HideSheet("A");
  expect(wb.activeSheetName).toBe("B"); // next visible sheet in order
});

test("DeleteSheet: deleting an already-hidden sheet skips the visible-count guard entirely", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("Visible");
  wb.AddSheet("Hidden");
  wb.HideSheet("Hidden");

  expect(wb.DeleteSheet("Hidden")).toBe(true);
  expect(wb.sheetOrder).toEqual(["Visible"]);
});

test("DeleteSheet: reselecting the active sheet skips a HIDDEN sheet immediately after the deleted one, landing on the next VISIBLE sheet", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A"); // active, about to be deleted
  wb.AddSheet("B"); // hidden: forward scan must skip it
  wb.AddSheet("C"); // visible: forward scan should land here
  wb.HideSheet("B");

  expect(wb.DeleteSheet("A")).toBe(true);
  expect(wb.sheetOrder).toEqual(["B", "C"]);
  expect(wb.activeSheetName).toBe("C");
});

test("DeleteSheet: reselecting the active LAST sheet with no visible sheet after it falls back through a HIDDEN sheet to an earlier VISIBLE one", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A"); // visible: backward scan should land here
  wb.AddSheet("B"); // hidden: backward scan must skip it
  wb.AddSheet("C"); // active, last, about to be deleted
  wb.HideSheet("B");
  wb.SetActiveSheet("C");

  expect(wb.DeleteSheet("C")).toBe(true);
  expect(wb.sheetOrder).toEqual(["A", "B"]);
  expect(wb.activeSheetName).toBe("A");
});

test("HideSheet: reselecting the active sheet skips a HIDDEN sheet immediately after it, landing on the next VISIBLE sheet", async () => {
  const SC = await freshSC();
  const wb = new SC.Workbook();
  wb.AddSheet("A"); // active, about to be hidden
  wb.AddSheet("B"); // already hidden: forward scan must skip it
  wb.AddSheet("C"); // visible: forward scan should land here
  wb.HideSheet("B");

  expect(wb.HideSheet("A")).toBe(true);
  expect(wb.activeSheetName).toBe("C");
});
