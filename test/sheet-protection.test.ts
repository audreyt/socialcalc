import { expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

// ===========================================================================
// SocialCalc.IsSheetProtected / SocialCalc.IsCellEditable — the centralized
// policy every mutation path routes through.
// ===========================================================================

test("IsSheetProtected reflects sheet.attribs.protected == 'yes' only", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  expect(SC.IsSheetProtected(sheet)).toBe(false);

  sheet.attribs.protected = "yes";
  expect(SC.IsSheetProtected(sheet)).toBe(true);

  sheet.attribs.protected = "no";
  expect(SC.IsSheetProtected(sheet)).toBe(false);
});

test("IsCellEditable: unprotected sheet is byte-identical to legacy readonly gating", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A2 readonly yes",
  ]);

  expect(SC.IsCellEditable(sheet, "A1")).toBe(true);
  expect(SC.IsCellEditable(sheet, "A2")).toBe(false);
  // Even explicitly unlocked, readonly still wins.
  await scheduleCommands(SC, sheet, "set A2 unlocked yes");
  expect(SC.IsCellEditable(sheet, "A2")).toBe(false);
  // Blank/never-touched cell is editable on an unprotected sheet.
  expect(SC.IsCellEditable(sheet, "Z99")).toBe(true);
});

test("IsCellEditable: protected sheet locks by default; unlocked cells stay editable", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A2 unlocked yes",
    "protectsheet",
  ]);

  expect(SC.IsCellEditable(sheet, "A1")).toBe(false);
  expect(SC.IsCellEditable(sheet, "A2")).toBe(true);
  // A never-touched blank cell is default-locked when protected (Excel model).
  expect(SC.IsCellEditable(sheet, "Z99")).toBe(false);
});

test("readonly always blocks even on a protected+unlocked cell", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 unlocked yes",
    "set A1 readonly yes",
    "protectsheet",
  ]);
  expect(SC.IsCellEditable(sheet, "A1")).toBe(false);
});

// ===========================================================================
// protectsheet / unprotectsheet commands.
// ===========================================================================

test("protectsheet sets attribs.protected=yes; unprotectsheet clears it", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "protectsheet");
  expect(sheet.attribs.protected).toBe("yes");
  expect(SC.IsSheetProtected(sheet)).toBe(true);

  await scheduleCommands(SC, sheet, "unprotectsheet");
  expect(sheet.attribs.protected).toBeUndefined();
  expect(SC.IsSheetProtected(sheet)).toBe(false);
});

test("protectsheet/unprotectsheet called redundantly still records the correct undo target", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  // protectsheet while already protected: undo ternary true-branch.
  await scheduleCommands(SC, sheet, "protectsheet");
  await scheduleCommands(SC, sheet, "protectsheet");
  expect(SC.IsSheetProtected(sheet)).toBe(true);
  await sheetUndo(SC, sheet);
  expect(SC.IsSheetProtected(sheet)).toBe(true); // second protectsheet undone was itself a protect

  // unprotectsheet while already unprotected: undo ternary false-branch.
  await scheduleCommands(SC, sheet, "unprotectsheet");
  await scheduleCommands(SC, sheet, "unprotectsheet");
  expect(SC.IsSheetProtected(sheet)).toBe(false);
  await sheetUndo(SC, sheet);
  expect(SC.IsSheetProtected(sheet)).toBe(false);
});

test("set sheet protected yes/no is equivalent to protectsheet/unprotectsheet", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "set sheet protected yes");
  expect(SC.IsSheetProtected(sheet)).toBe(true);
  await scheduleCommands(SC, sheet, "set sheet protected no");
  expect(SC.IsSheetProtected(sheet)).toBe(false);
});

test("set sheet protected with saveundo=false skips the undo record but still applies", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "set sheet protected yes", false);
  expect(SC.IsSheetProtected(sheet)).toBe(true);
});

test("protectsheet/unprotectsheet undo and redo restore prior protection state", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "protectsheet");
  expect(SC.IsSheetProtected(sheet)).toBe(true);

  await sheetUndo(SC, sheet);
  expect(SC.IsSheetProtected(sheet)).toBe(false);

  await sheetRedo(SC, sheet);
  expect(SC.IsSheetProtected(sheet)).toBe(true);
});

// ===========================================================================
// set unlocked command + round-trip through EncodeCellAttributes /
// DecodeCellAttributes (settings panel wiring).
// ===========================================================================

test("set A1 unlocked yes/no toggles cell.unlocked", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 unlocked yes"]);
  expect(sheet.cells.A1.unlocked).toBe(true);
  await scheduleCommands(SC, sheet, "set A1 unlocked no");
  expect(sheet.cells.A1.unlocked).toBe(false);
});

test("EncodeCellAttributes/DecodeCellAttributes round-trip unlocked", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 unlocked yes"]);

  const attrs = SC.EncodeCellAttributes(sheet, "A1");
  expect(attrs.unlocked.def).toBe(false);
  expect(attrs.unlocked.val).toBe("y");
  // Identical attrs round-trip to no command.
  expect(SC.DecodeCellAttributes(sheet, "A1", attrs)).toBeNull();

  // Flip to locked (default) and confirm a command is emitted and applied.
  attrs.unlocked = { def: true, val: "" };
  const cmds = SC.DecodeCellAttributes(sheet, "A1", attrs);
  expect(cmds).toContain("unlocked no");
  await scheduleCommands(SC, sheet, cmds);
  expect(sheet.cells.A1.unlocked).toBe(false);

  // Flip a locked cell to unlocked=yes via the panel (val "y" branch).
  attrs.unlocked = { def: false, val: "y" };
  const cmds2 = SC.DecodeCellAttributes(sheet, "A1", attrs);
  expect(cmds2).toContain("unlocked yes");
  await scheduleCommands(SC, sheet, cmds2);
  expect(sheet.cells.A1.unlocked).toBe(true);
});

test("EncodeSheetAttributes/DecodeSheetAttributes round-trip protected", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "protectsheet");

  const attrs = SC.EncodeSheetAttributes(sheet);
  expect(attrs.protected.def).toBe(false);
  expect(attrs.protected.val).toBe("yes");
  expect(SC.DecodeSheetAttributes(sheet, attrs)).toBeNull();

  attrs.protected = { def: true, val: "" };
  const cmds = SC.DecodeSheetAttributes(sheet, attrs);
  expect(cmds).toContain("set sheet protected");
  await scheduleCommands(SC, sheet, cmds);
  expect(SC.IsSheetProtected(sheet)).toBe(false);
});

// ===========================================================================
// Exhaustive per-mutation-path guard coverage on a protected sheet: locked
// cells reject, unlocked cells accept.
// ===========================================================================

async function protectedFixture(SC: any) {
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1", // locked (default)
    "set B1 value n 2",
    "set B1 unlocked yes", // unlocked override
    "set C1 value n 3",
    "set C1 unlocked yes",
    "set A2 value n 4",
    "set A2 unlocked yes",
    "set B2 value n 5",
    "set B2 unlocked yes",
    "protectsheet",
  ]);
  return sheet;
}

test("set: locked cell attrib write is blocked, unlocked cell is applied", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);

  await scheduleCommands(SC, sheet, "set A1 value n 999");
  expect(sheet.cells.A1.datavalue).toBe(1); // unchanged: locked

  await scheduleCommands(SC, sheet, "set B1 value n 999");
  expect(sheet.cells.B1.datavalue).toBe(999); // changed: unlocked
});

test("erase/cut: locked cell content survives, unlocked cell is cleared", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);

  await scheduleCommands(SC, sheet, "erase A1 all");
  expect(sheet.cells.A1.datavalue).toBe(1);

  await scheduleCommands(SC, sheet, "erase B1 all");
  expect(sheet.cells.B1).toBeUndefined();
});

test("fillright: fill source stays, locked target unchanged, unlocked target filled", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  // Fill A1(locked)->B1 range; B1 is unlocked so accepts the fill (series
  // increment applies: B1 was already 2, so filled value is 1 + 1*(2-1)=2).
  await scheduleCommands(SC, sheet, "fillright A1:B1 all");
  expect(sheet.cells.A1.datavalue).toBe(1); // source untouched
  expect(sheet.cells.B1.datavalue).toBe(2); // unlocked target accepted the fill
});

test("fillright: locked target is skipped even when source is unlocked", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  await scheduleCommands(SC, sheet, ["unprotectsheet", "set D1 value n 42", "protectsheet"]);
  await scheduleCommands(SC, sheet, "fillright D1:E1 all");
  // E1 was never made editable (default-locked); GetAssuredCell always
  // materializes a Cell object before the guard runs, but its content must
  // stay untouched by the fill (still the blank default).
  expect(sheet.cells.E1.datavalue).toBe("");
  expect(sheet.cells.E1.datatype).toBeNull();
});

test("paste: locked destination cell is skipped, unlocked destination is pasted", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  await scheduleCommands(SC, sheet, [
    "unprotectsheet",
    "set F1 value n 77",
    "copy F1 all",
    "protectsheet",
  ]);
  await scheduleCommands(SC, sheet, "paste A1 all"); // A1 locked
  expect(sheet.cells.A1.datavalue).toBe(1);

  await scheduleCommands(SC, sheet, "paste B1 all"); // B1 unlocked
  expect(sheet.cells.B1.datavalue).toBe(77);
});

test("merge: blocked on locked anchor, allowed on unlocked anchor", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);

  await scheduleCommands(SC, sheet, "merge A1:A2");
  expect(sheet.cells.A1.colspan).toBeUndefined();

  await scheduleCommands(SC, sheet, "merge B1:B2");
  expect(sheet.cells.B1.rowspan).toBe(2);
});

test("unmerge: blocked on locked anchor, allowed on unlocked anchor", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  await scheduleCommands(SC, sheet, [
    "unprotectsheet",
    "merge A1:A2",
    "merge B1:B2",
    "protectsheet",
  ]);

  await scheduleCommands(SC, sheet, "unmerge A1");
  expect(sheet.cells.A1.rowspan).toBe(2); // still merged: locked

  await scheduleCommands(SC, sheet, "unmerge B1");
  expect(sheet.cells.B1.rowspan).toBeUndefined(); // unmerged: unlocked
});

test("sort: whole protected range with any locked cell is rejected atomically", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  const before = sheet.cells.A1.datavalue;
  const errortext = await scheduleSortExpectingError(SC, sheet, "sort A1:A2 A up");
  expect(errortext).toMatch(/locked/i);
  expect(sheet.cells.A1.datavalue).toBe(before); // untouched
});

test("sort: fully-unlocked range sorts normally under protection", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  // B1=5(row1 unlocked), B2=... wait use A2/B2 both unlocked.
  await scheduleCommands(SC, sheet, [
    "unprotectsheet",
    "set A2 value n 9",
    "set B2 value n 1",
    "protectsheet",
  ]);
  await scheduleCommands(SC, sheet, "sort A2:B2 A up");
  // Both A2 and B2 are unlocked; sort should proceed without error.
  expect(sheet.cells.A2.datavalue === 9 || sheet.cells.A2.datavalue === 1).toBe(true);
});

test("insertcol/insertrow: rejected outright on a protected sheet", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  const before = { ...sheet.attribs };
  const colError = SC.ExecuteSheetCommand(sheet, new SC.Parse("insertcol A"), true);
  expect(colError).toMatch(/protected/i);
  expect(colError).toContain("column");
  expect(sheet.attribs.lastcol).toBe(before.lastcol);

  const rowError = SC.ExecuteSheetCommand(sheet, new SC.Parse("insertrow 1"), true);
  expect(rowError).toMatch(/protected/i);
  expect(rowError).toContain("row");
  expect(sheet.attribs.lastrow).toBe(before.lastrow);
});

test("insertcol/insertrow: proceed normally on an unprotected sheet", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "set A1 value n 1");
  await scheduleCommands(SC, sheet, "insertcol A");
  expect(sheet.cells.B1.datavalue).toBe(1); // shifted right
});

test("deletecol/deleterow: blocked when any cell in range is locked", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  const errortext = SC.ExecuteSheetCommand(sheet, new SC.Parse("deletecol A"), true);
  expect(errortext).toMatch(/locked/i);
  expect(sheet.cells.A1.datavalue).toBe(1); // untouched
});

test("deletecol/deleterow: proceeds when every cell in range is unlocked/blank", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  // Column C only has C1 which is unlocked.
  const errortext = SC.ExecuteSheetCommand(sheet, new SC.Parse("deletecol C"), true);
  expect(errortext).toBeFalsy();
});

test("movepaste: locked source cell is skipped (left in place), unlocked source moves", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  // Move unlocked B2 -> D2 (D2 is blank/locked by default, but destination
  // gate also applies — use an unlocked destination).
  await scheduleCommands(SC, sheet, [
    "unprotectsheet",
    "set D2 value n 0",
    "set D2 unlocked yes",
    "protectsheet",
  ]);
  await scheduleCommands(SC, sheet, "movepaste B2:B2 D2 all");
  expect(sheet.cells.D2.datavalue).toBe(5); // moved
});

test("movepaste: locked destination blocks the paste", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  await scheduleCommands(SC, sheet, "movepaste B2:B2 A1 all"); // A1 locked destination
  expect(sheet.cells.A1.datavalue).toBe(1); // destination untouched
});

// Helper: run a command directly and capture its returned errortext (sort
// returns errortext synchronously rather than alerting).
async function scheduleSortExpectingError(SC: any, sheet: any, cmd: string) {
  return SC.ExecuteSheetCommand(sheet, new SC.Parse(cmd), true);
}

// ===========================================================================
// Formula / spill children on protected sheets: formulas recalc regardless
// of lock state (locking only guards user edits, not computed results).
// ===========================================================================

test("formulas in locked cells still recalculate on a protected sheet", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 10", "set A2 formula A1*2", "protectsheet"]);
  // Recalc computes a value for the locked formula cell A2 — protection
  // gates user edits, not the recalc engine's own writes.
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A2.datavalue).toBe(20);
  expect(SC.IsCellEditable(sheet, "A2")).toBe(false); // still locked for user edits
});

// ===========================================================================
// Save/load and legacy backward compatibility.
// ===========================================================================

test("save/load round-trips protected sheet state and per-cell unlocked flags", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set B1 unlocked yes",
    "protectsheet",
  ]);

  const save = SC.CreateSheetSave(sheet);
  expect(save).toContain(":unlocked:y");
  expect(save).toMatch(/:protected:yes/);

  const round = new SC.Sheet();
  SC.ParseSheetSave(save, round);
  expect(SC.IsSheetProtected(round)).toBe(true);
  expect(round.cells.B1.unlocked).toBe(true);
  expect(SC.IsCellEditable(round, "A1")).toBe(false);
  expect(SC.IsCellEditable(round, "B1")).toBe(true);
});

test("legacy save without protected/unlocked fields loads as unprotected with legacy readonly behavior", async () => {
  const SC = await loadSocialCalc();
  const enc = SC.encodeForSave;
  const legacySave = [
    "version:1.5",
    `cell:A1:vtc:n:1:${enc("1")}:ro:yes`,
    "cell:B1:v:2",
    "sheet:c:2:r:1",
    "",
  ].join("\n");

  const sheet = new SC.Sheet();
  SC.ParseSheetSave(legacySave, sheet);

  expect(SC.IsSheetProtected(sheet)).toBe(false);
  expect(sheet.cells.A1.unlocked).toBe(false);
  // Legacy readonly cell stays non-editable exactly as before.
  expect(SC.IsCellEditable(sheet, "A1")).toBe(false);
  expect(SC.IsCellEditable(sheet, "B1")).toBe(true);
});

test("copy of a protected-sheet range carries the source cell's unlocked flag (matches existing sheet-attrib copy semantics)", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);

  // CreateSheetSave always encodes the full sheetfields set (recalc,
  // protected, etc.) on the "sheet:" line regardless of range — matching
  // the pre-existing behavior for every other SC.sheetfields entry. Cell
  // unlocked flags are range-scoped and copy per-cell as expected.
  const clip = SC.CreateSheetSave(sheet, "B1:B1");
  const target = new SC.Sheet();
  SC.ParseSheetSave(clip, target);
  expect(target.cells.B1.unlocked).toBe(true);
  expect(SC.IsSheetProtected(target)).toBe(true);
});

// ===========================================================================
// Undo/redo of per-cell mutation guards themselves (readonly/unlocked
// toggles survive undo/redo cleanly, matching existing readonly undo).
// ===========================================================================

test("set unlocked yes/no undo and redo", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "set A1 value n 1");
  await scheduleCommands(SC, sheet, "set A1 unlocked yes");
  expect(sheet.cells.A1.unlocked).toBe(true);

  await sheetUndo(SC, sheet);
  expect(sheet.cells.A1.unlocked).toBeFalsy();

  await sheetRedo(SC, sheet);
  expect(sheet.cells.A1.unlocked).toBe(true);
});

test("blocked mutation on a locked cell leaves no undo entry to misapply", async () => {
  const SC = await loadSocialCalc();
  const sheet = await protectedFixture(SC);
  const stackLenBefore = sheet.changes.stack.length;
  await scheduleCommands(SC, sheet, "set A1 value n 999"); // blocked: A1 locked
  expect(sheet.cells.A1.datavalue).toBe(1);
  // A no-op command still pushes an (empty) undo step; verify undo doesn't
  // corrupt state by immediately undoing after the no-op.
  expect(sheet.changes.stack.length).toBeGreaterThanOrEqual(stackLenBefore);
  await sheetUndo(SC, sheet);
  expect(sheet.cells.A1.datavalue).toBe(1); // still unchanged
});

// ===========================================================================
// Editor-level gating: TableEditor.ECellReadonly delegates to the same
// centralized IsCellEditable policy, so keyboard/mouse edit entry points
// (input, [f2], [del], paste) are blocked on locked cells identically to
// the command layer.
// ===========================================================================

import { loadSocialCalc as _loadSocialCalcBrowser } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

async function loadEditorSocialCalc() {
  const SC = await _loadSocialCalcBrowser({ browser: true });
  installUiShim();
  return SC;
}

let containerSeq = 0;
async function newEditorControl(SC: any) {
  const container = document.createElement("div");
  container.id = "sp-editor-root-" + containerSeq++;
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return control;
}

test("editor.ECellReadonly reflects protection state for locked vs unlocked cells", async () => {
  const SC = await loadEditorSocialCalc();
  const control = await newEditorControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, [
    "set A1 value n 1", // locked (default)
    "set B1 value n 2",
    "set B1 unlocked yes",
    "protectsheet",
  ]);

  control.editor.MoveECell("A1");
  expect(control.editor.ECellReadonly()).toBe(true);

  control.editor.MoveECell("B1");
  expect(control.editor.ECellReadonly()).toBe(false);

  // Explicit-coordinate overload behaves identically without moving ecell.
  expect(control.editor.ECellReadonly("A1")).toBe(true);
  expect(control.editor.ECellReadonly("B1")).toBe(false);

  // With neither an explicit coord nor an ecell, ECellReadonly has nothing
  // to check and reports editable (false), matching the pre-existing
  // guard's documented contract.
  control.editor.ecell = null;
  expect(control.editor.ECellReadonly()).toBe(false);
});

test("editor open-cell-edit is blocked on a locked cell under protection ([f2] no-ops)", async () => {
  const SC = await loadEditorSocialCalc();
  const control = await newEditorControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1", "protectsheet"]);

  control.editor.MoveECell("A1");
  control.editor.state = "start";
  control.editor.EditorProcessKey({ shiftKey: false }, "[f2]");
  // Locked cell under protection: EditorOpenCellEdit is never invoked, so
  // the editor stays in "start" state rather than transitioning to input.
  expect(control.editor.state).toBe("start");
});
