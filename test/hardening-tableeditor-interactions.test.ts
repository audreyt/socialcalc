import { afterAll, afterEach, expect, test } from "vite-plus/test";

import { loadSocialCalc as _loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import type { SheetInstance } from "./helpers/socialcalc-runtime-types";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

import type SCModule from "../dist/SocialCalc.js";

// Track setInterval/setTimeout the same way the sibling editor-coverage
// files do, so any stray InputEcho heartbeat / cellhandles hover timer left
// running by a test gets cancelled instead of firing against stale state
// in a later file within the same isolated Vitest worker.
ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
});

afterAll(() => {
  restoreOriginalTimers();
});

/**
 * hardening-tableeditor-interactions.test.ts
 *
 * Targets js/socialcalctableeditor.ts: editor initialization, cell
 * movement/range selection, edit lifecycle, keyboard/mouse/input handling,
 * and command scheduling. Explicitly NOT drag/paste/clipboard/row-col-resize
 * (owned by a sibling hardening pass) or CellHandles/TableControl/Button/
 * Drag chrome (same reason).
 *
 * Every test asserts real observable editor state (range/ecell,
 * highlights, scheduled commands/deferred queues, DOM element wiring, or a
 * status-callback signal) — never a swallowed exception or a source-text
 * match. Deterministic: coordinates SUT timers via real StatusCallback
 * signals or direct synchronous calls, never a fixed sleep.
 */

type SC = typeof SCModule;

async function loadSocialCalc(): Promise<SC> {
  const instance = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  // The bundle is loaded dynamically at test runtime via vm.Script, but its
  // exported shape is exactly the ambient `SocialCalc` namespace declared
  // across js/*.d.ts (bridged by dist/SocialCalc.d.ts) — a well-known
  // runtime shape, not raw/unvalidated external data.
  return instance as SC;
}

function getEditor(control: SocialCalc.SpreadsheetControl): SocialCalc.TableEditor {
  // SpreadsheetControl.editor is declared `any` in the ambient .d.ts, but
  // InitializeSpreadsheetControl always assigns a real TableEditor.
  return control.editor as SocialCalc.TableEditor;
}

function getSheet(control: SocialCalc.SpreadsheetControl): SheetInstance {
  return control.sheet as SheetInstance;
}

async function newControl(
  SC: SC,
  containerId = "hti-root",
): Promise<{ control: SocialCalc.SpreadsheetControl; container: HTMLElement }> {
  const container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

/** Populate colpositions/rowpositions so GridMousePosition can map clientX/Y to row/col. */
function primeGridLayout(editor: SocialCalc.TableEditor) {
  editor.CalculateEditorPositions();
  editor.gridposition = editor.gridposition ?? { left: 0, top: 0 };
  editor.headposition = editor.headposition ?? { left: 30, top: 30 };
  editor.colpositions = [0, 0, 80, 160, 240, 320, 400, 480];
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.firstscrollingrow = editor.firstscrollingrow ?? 1;
  editor.firstscrollingcol = editor.firstscrollingcol ?? 1;
  editor.lastnonscrollingrow = editor.lastnonscrollingrow ?? 0;
  editor.lastnonscrollingcol = editor.lastnonscrollingcol ?? 0;
  editor.lastvisiblerow = editor.lastvisiblerow ?? 7;
  editor.lastvisiblecol = editor.lastvisiblecol ?? 7;
}

interface FakeEventOptions {
  type?: string;
  clientX?: number;
  clientY?: number;
  target?: HTMLElement | null;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  wheelDelta?: number;
  detail?: number;
  which?: number;
  keyCode?: number;
}

function fakeMouseEvent(extras: FakeEventOptions = {}): MouseEvent {
  const ev = {
    type: extras.type ?? "mousedown",
    clientX: extras.clientX ?? 10,
    clientY: extras.clientY ?? 10,
    target: extras.target ?? null,
    srcElement: extras.target ?? null,
    shiftKey: extras.shiftKey ?? false,
    ctrlKey: extras.ctrlKey ?? false,
    metaKey: extras.metaKey ?? false,
    wheelDelta: extras.wheelDelta ?? 0,
    detail: extras.detail ?? 0,
    which: extras.which ?? 0,
    keyCode: extras.keyCode ?? 0,
    preventDefault() {},
    stopPropagation() {},
  };
  // Synthetic fixture structurally covers the MouseEvent surface the
  // TableEditor handlers actually read under the fake-DOM harness (no real
  // browser MouseEvent is constructible here).
  return ev as unknown as MouseEvent;
}

// ─────────────────────────────────────────────────────────────────────────
// Editor initialization / layout
// ─────────────────────────────────────────────────────────────────────────

test("CreateTableEditor / ResizeTableEditor via prototype passthrough", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);

  const ele = editor.CreateTableEditor(300, 200);
  expect(editor.toplevel).toBe(ele);
  expect(editor.griddiv).toBeDefined();
  expect(editor.width).toBe(300);

  editor.ResizeTableEditor(500, 400);
  expect(editor.width).toBe(500);
  expect(editor.height).toBe(400);
});

test("CalculateEditorPositions / CalculateRowPositions / CalculateColPositions via prototype", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "cep-proto-root");
  const editor = getEditor(control);

  editor.CalculateEditorPositions();
  expect(editor.rowpositions.length).toBeGreaterThan(0);
  expect(editor.colpositions.length).toBeGreaterThan(0);
  expect(editor.gridposition).not.toBeNull();

  const positions: number[] = [];
  const sizes: number[] = [];
  editor.CalculateRowPositions(0, positions, sizes);
  expect(positions.length).toBeGreaterThan(0);

  const cpositions: number[] = [];
  const csizes: number[] = [];
  editor.CalculateColPositions(0, cpositions, csizes);
  expect(cpositions.length).toBeGreaterThan(0);
});

test("ScheduleRender schedules a timer; DoRenderStep runs synchronously and schedules position calc", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sr-root");
  const editor = getEditor(control);
  primeGridLayout(editor);

  editor.ScheduleRender();
  expect(editor.timeout).not.toBeNull();

  let renderSheetCalled = false;
  const origRenderSheet = editor.EditorRenderSheet.bind(editor);
  editor.EditorRenderSheet = () => {
    renderSheetCalled = true;
    origRenderSheet();
  };
  // Call the scheduled step directly (deterministic — no real-timer wait).
  editor.DoRenderStep();
  expect(renderSheetCalled).toBe(true);
  expect(editor.timeout).not.toBeNull(); // DoRenderStep re-schedules DoPositionCalculations
});

test("SchedulePositionCalculations schedules a timer; DoPositionCalculations recomputes layout and shows cell handles", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "spc-root");
  const editor = getEditor(control);
  primeGridLayout(editor);

  editor.SchedulePositionCalculations();
  expect(editor.timeout).not.toBeNull();

  let handlesShown = false;
  const cellhandles = editor.cellhandles as SocialCalc.CellHandles;
  const origShow = cellhandles.ShowCellHandles.bind(cellhandles);
  cellhandles.ShowCellHandles = (show: boolean, moveshow?: boolean) => {
    if (show) handlesShown = true;
    origShow(show, moveshow);
  };

  editor.DoPositionCalculations();
  expect(editor.timeout).toBeNull();
  expect(handlesShown).toBe(true);
  expect(editor.rowpositions.length).toBeGreaterThan(0);
});

test("FitToEditTable: colwidth 'blank' in a non-last pane falls back to the 10px minimum", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "fte2-root");
  const editor = getEditor(control);
  const sheet = getSheet(control);

  editor.context.colpanes = [
    { first: 1, last: 2 },
    { first: 3, last: 3 },
  ];
  sheet.colattribs.width["A"] = "blank";
  sheet.colattribs.width["B"] = "auto";
  editor.tablewidth = 400;

  editor.FitToEditTable();
  // Non-last pane column widths that resolve to "" must fall back to 10px
  // each, so the pane boundary still advances rather than staying stuck.
  expect(editor.context.colpanes[1].first).toBe(3);
});

// ─────────────────────────────────────────────────────────────────────────
// Cell movement / range selection
// ─────────────────────────────────────────────────────────────────────────

test("MoveECell: same-coord no-op and range2 overlap sets the 'range2' highlight", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mec2-root");
  const editor = getEditor(control);

  editor.MoveECell("B2");
  const before = editor.context.highlights["B2"];
  const result = editor.MoveECell("B2"); // already there — early return
  expect(result).toBe("B2");
  expect(editor.context.highlights["B2"]).toBe(before);

  editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
  editor.MoveECell("A1"); // leave B2 — B2 now falls inside range2
  expect(editor.context.highlights["B2"]).toBe("range2");
  editor.range2 = { hasrange: false };
});

test("RangeExtend: overlapping range + range2 exercises the range2-loop skip branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "re2-root");
  const editor = getEditor(control);

  // Pre-seed range2 so RangeExtend's range2 highlight loop runs with a
  // "range"/"cursor" cell it must skip over (not overwrite).
  editor.MoveECell("B2");
  editor.range2 = { hasrange: true, top: 1, bottom: 3, left: 1, right: 3 };
  editor.RangeAnchor("A1");
  editor.RangeExtend("C3"); // range now covers the same A1:C3 block as range2

  // The cursor cell (B2) must stay "cursor", not get overwritten by either
  // range highlight pass.
  expect(editor.context.highlights["B2"]).toBe("cursor");
  // A1 is in both range and range2 — "range" wins, never "range2".
  expect(editor.context.highlights["A1"]).toBe("range");
  editor.range2 = { hasrange: false };
  editor.RangeRemove();
});

test("Range2Remove: range2 highlight deleted, range/cursor cells left untouched", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "r2r-root");
  const editor = getEditor(control);

  editor.MoveECell("B2");
  editor.RangeAnchor("D4");
  editor.RangeExtend("D4");
  editor.context.highlights["A1"] = "range2";
  editor.range2 = { hasrange: true, top: 1, bottom: 1, left: 1, right: 1 };

  editor.Range2Remove();
  expect(editor.range2.hasrange).toBe(false);
  expect(editor.context.highlights["A1"]).toBeUndefined();
  expect(editor.context.highlights["B2"]).toBe("cursor");
  expect(editor.context.highlights["D4"]).toBe("range");
  editor.RangeRemove();
});

test("ECellReadonly: explicit ecoord, default ecell, readonly cell, and no-ecell fallback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ecr-root");
  const editor = getEditor(control);

  editor.MoveECell("A1");
  expect(editor.ECellReadonly()).toBeFalsy(); // default ecell, not readonly (Cell.readonly is often left undefined, not false)

  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 readonly yes"]);
  expect(editor.ECellReadonly()).toBe(true); // default ecell path
  expect(editor.ECellReadonly("A1")).toBe(true); // explicit ecoord path
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 readonly no"]);

  const savedEcell = editor.ecell;
  editor.ecell = null;
  expect(editor.ECellReadonly()).toBeFalsy(); // no ecoord and no ecell
  editor.ecell = savedEcell;
});

test("SetECellHeaders: hidden col AND hidden row both advance ecell before styling", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sech2-root");
  const editor = getEditor(control);
  primeGridLayout(editor);

  editor.MoveECell("B2");
  await scheduleCommands(SC, editor.context.sheetobj, ["set B hide yes", "set 2 hide yes"]);
  editor.ecell = { coord: "B2", row: 2, col: 2 };

  editor.SetECellHeaders("selected");
  expect(editor.ecell.col).toBeGreaterThan(2);
  expect(editor.ecell.row).toBeGreaterThan(2);

  await scheduleCommands(SC, editor.context.sheetobj, ["set C hide no", "set 3 hide no"]);
});

// ─────────────────────────────────────────────────────────────────────────
// Edit lifecycle
// ─────────────────────────────────────────────────────────────────────────

test("EditorOpenCellEdit: no-ecell, no-inputBox, and disabled-inputBox all return true without opening", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "eoce2-root");
  const editor = getEditor(control);
  editor.MoveECell("A1");

  const savedEcell = editor.ecell;
  editor.ecell = null;
  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
  editor.ecell = savedEcell;

  const savedInputBox = editor.inputBox;
  editor.inputBox = null;
  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
  editor.inputBox = savedInputBox;

  const inputBox = editor.inputBox as SocialCalc.InputBox;
  (inputBox.element as HTMLInputElement).disabled = true;
  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
  expect(editor.state).toBe("start"); // never entered "input" state
  (inputBox.element as HTMLInputElement).disabled = false;
});

test("EditedTriggerCell: EMAILONEDIT/EMAILONEDITIF queue an email command; unknown function and missing parameters are no-ops", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "etc-root");
  const editor = getEditor(control);
  const sheet = getSheet(control);

  sheet.ioParameterList = {
    onedit: { function_name: "EMAILONEDIT" },
    oneditif: { function_name: "EMAILONEDITIF" },
    other: { function_name: "SOMETHINGELSE" },
  };
  editor.deferredEmailCommands = [];

  SC.EditedTriggerCell({ onedit: true, missing: true }, "B2", editor, sheet);
  expect(editor.deferredEmailCommands.length).toBe(1);
  expect(editor.deferredEmailCommands[0].cmdstr).toBe("setemailparameters onedit B2");

  SC.EditedTriggerCell({ oneditif: true }, "C3", editor, sheet);
  expect(editor.deferredEmailCommands.length).toBe(2);

  SC.EditedTriggerCell({ other: true }, "D4", editor, sheet);
  expect(editor.deferredEmailCommands.length).toBe(2); // unrelated function_name: no push

  editor.deferredEmailCommands = [];
});

// ─────────────────────────────────────────────────────────────────────────
// Keyboard / mouse / input handling
// ─────────────────────────────────────────────────────────────────────────

test("KeyboardSetFocus: registers document key listeners once, releases a passThru element with blur", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ksf-root");
  const editor = getEditor(control);

  SC.Keyboard.areListener = false;
  SC.KeyboardSetFocus(editor);
  expect(SC.Keyboard.focusTable).toBe(editor);
  expect(SC.Keyboard.areListener).toBe(true);
  expect(document.onkeydown).toBe(SC.ProcessKeyDown);
  expect(document.onkeypress).toBe(SC.ProcessKeyPress);

  let blurred = false;
  const passThru = document.createElement("input");
  passThru.blur = () => {
    blurred = true;
  };
  SC.Keyboard.passThru = passThru;
  SC.KeyboardSetFocus(editor);
  expect(blurred).toBe(true);
  expect(SC.Keyboard.passThru).toBeNull();

  // Second call with areListener already true must not throw re-wiring.
  SC.KeyboardSetFocus(editor);
  expect(document.onkeydown).toBe(SC.ProcessKeyDown);
});

test("InputBox formulabar MoveECellCallback: only fires DisplayCellContents while state=='start'", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ibfb-root");
  const editor = getEditor(control);
  const inputBox = editor.inputBox as SocialCalc.InputBox;

  let displayed: string | undefined;
  const origDisplay = inputBox.DisplayCellContents.bind(inputBox);
  const _sheet = getSheet(control); // layout side-effect only, value unused
  inputBox.DisplayCellContents = (coord: string) => {
    displayed = coord;
    origDisplay(coord);
  };

  editor.state = "start";
  editor.MoveECell("C3");
  expect(displayed).toBe("C3");

  displayed = undefined;
  editor.state = "input";
  editor.MoveECell("D4");
  expect(displayed).toBeUndefined(); // formulabar callback bails when state != "start"
  editor.state = "start";
});

test("InputEchoHeartbeat: refreshes the echo text from the input box while focused, no-ops when unfocused", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ieh-root");
  const editor = getEditor(control);
  const inputBox = editor.inputBox as SocialCalc.InputBox;
  const inputEcho = editor.inputEcho as SocialCalc.InputEcho;

  const savedFocus = SC.Keyboard.focusTable;
  SC.Keyboard.focusTable = editor;
  inputBox.SetText("hello");
  inputEcho.text = "";
  SC.InputEchoHeartbeat();
  expect(inputEcho.text).toContain("hello");

  SC.Keyboard.focusTable = null;
  inputEcho.text = "";
  SC.InputEchoHeartbeat();
  expect(inputEcho.text).toBe(""); // no focusTable: no-op
  SC.Keyboard.focusTable = savedFocus;
});

test("SetInputEchoText: known formula function shows an arg-string prompt, unknown hides it", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "siet-root");
  const editor = getEditor(control);
  const inputEcho = editor.inputEcho as SocialCalc.InputEcho;

  inputEcho.SetText("=SUM(");
  expect(inputEcho.prompt.style.display).toBe("block");
  expect(inputEcho.prompt.innerHTML.toUpperCase()).toContain("SUM");

  inputEcho.SetText("=NOPE(");
  expect(inputEcho.prompt.style.display).toBe("block");

  inputEcho.SetText("plain text");
  expect(inputEcho.prompt.style.display).toBe("none");
});

test("ProcessMouseWheel: registered element dispatches WheelMove for wheelDelta, detail, and zero-delta events", async () => {
  const SC = await loadSocialCalc();
  await newControl(SC, "pmw2-root");
  const el = document.createElement("div");

  const deltas: number[] = [];
  SC.MouseWheelRegister(el, {
    WheelMove: (_event, delta) => {
      deltas.push(delta);
    },
  });

  SC.ProcessMouseWheel(fakeMouseEvent({ target: el, wheelDelta: 240 }));
  expect(deltas).toEqual([2]);

  SC.ProcessMouseWheel(fakeMouseEvent({ target: el, wheelDelta: 0, detail: 9 }));
  expect(deltas).toEqual([2, -3]);

  SC.ProcessMouseWheel(fakeMouseEvent({ target: el, wheelDelta: 0, detail: 0 }));
  expect(deltas).toEqual([2, -3, 0]); // WheelMove always fires; a 0/0 event still resolves delta to 0
});

test("ProcessEditorMouseDown real dispatch: row-header click routes to row-select and anchors the whole row", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemd-route-root");
  const editor = getEditor(control);
  primeGridLayout(editor);
  await scheduleCommands(SC, editor.context.sheetobj, ["set E1 text t x", "set A5 text t y"]);
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.registeredElements = [{ element: editor.fullgrid as HTMLElement, editor }];

  // clientY=60 lands in the body-row band, clientX=10 is left of headposition.left(30) → row header.
  const target = editor.fullgrid as HTMLElement;
  SC.ProcessEditorMouseDown(fakeMouseEvent({ clientX: 10, clientY: 60, target }));

  expect(editor.range.hasrange).toBe(true);
  expect(editor.range.left).toBe(1);
  expect(editor.range.right).toBe(5); // Sheet.LastCol() is derived from populated cells, not attribs.lastcol
  editor.RangeRemove();
});

// ─────────────────────────────────────────────────────────────────────────
// Command scheduling
// ─────────────────────────────────────────────────────────────────────────

test("EditorScheduleSheetCommands: _app=true undo/redo forces widgetsClean=false", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "app-undo-root");
  const editor = getEditor(control);
  const sheet = getSheet(control);

  const savedApp = SC._app;
  SC._app = true;
  sheet.widgetsClean = true;
  editor.EditorScheduleSheetCommands("undo", true, true);
  expect(sheet.widgetsClean).toBe(false);

  sheet.widgetsClean = true;
  editor.EditorScheduleSheetCommands("redo", true, true);
  expect(sheet.widgetsClean).toBe(false);
  SC._app = savedApp;
});

test("EditorSheetStatusCallback cmdend: changedrendervalues, celldisplayneeded, and its own deferredCommands branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "cmdend-root");
  const editor = getEditor(control);
  const sheet = getSheet(control);

  await scheduleCommands(SC, sheet, ["set A1 text t hello"]);
  editor.busy = true;

  // changedrendervalues branch: PrecomputeSheetFontsAndLayouts + CalculateCellSkipData run.
  sheet.changedrendervalues = true;
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(sheet.changedrendervalues).toBe(false);

  // celldisplayneeded branch with a real, non-#N/A cell: ReplaceCell path.
  editor.busy = true;
  sheet.celldisplayneeded = "A1";
  sheet.renderneeded = false;
  const cell = sheet.cells["A1"];
  const savedValuetype = cell.valuetype;
  cell.valuetype = "t";
  let replaced = false;
  const origReplace = editor.ReplaceCell.bind(editor);
  editor.ReplaceCell = (c, row, col) => {
    replaced = true;
    origReplace(c, row, col);
  };
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(replaced).toBe(true);
  cell.valuetype = savedValuetype;

  // cmdend's own deferredCommands.length branch (distinct from doneposcalc's).
  let rescheduled: { cmdstr: string; saveundo: boolean } | null = null;
  const origSchedule = editor.EditorScheduleSheetCommands.bind(editor);
  editor.EditorScheduleSheetCommands = (
    cmdstr: string,
    saveundo?: boolean,
    ignorebusy?: boolean,
  ) => {
    rescheduled = { cmdstr, saveundo: saveundo ?? false };
    origSchedule(cmdstr, saveundo, ignorebusy);
  };
  editor.busy = true;
  editor.deferredCommands = [{ cmdstr: "recalc", saveundo: false }];
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(editor.deferredCommands.length).toBe(0); // shifted off the queue
  expect(rescheduled).toEqual({ cmdstr: "recalc", saveundo: false }); // re-dispatched with ignorebusy=true
  editor.EditorScheduleSheetCommands = origSchedule;
  editor.busy = false;
});

test("EditorSheetStatusCallback cmdend: needsrecalc invokes recalcFunction, renderneeded schedules a render", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "cmdend2-root");
  const editor = getEditor(control);
  const sheet = getSheet(control);
  primeGridLayout(editor);

  let recalcCalled = false;
  editor.recalcFunction = () => {
    recalcCalled = true;
    return null;
  };
  editor.busy = true;
  sheet.attribs.needsrecalc = "yes";
  sheet.attribs.recalc = "on";
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(recalcCalled).toBe(true);
  sheet.attribs.needsrecalc = "";

  editor.busy = true;
  sheet.renderneeded = true;
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(editor.timeout).not.toBeNull(); // ScheduleRender(false) fired
  editor.DoRenderStep();
  editor.DoPositionCalculations();
});

test("ScrollRelativeBoth: single-row quick-scroll path and hidden-column skip resets to 0", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "srb2-root");
  const editor = getEditor(control);
  primeGridLayout(editor);
  editor.context.rowpanes = [{ first: 5, last: 12 }];
  editor.context.colpanes = [{ first: 1, last: 6 }];

  // Quick-scroll special case: vamount==1, hamount==0.
  editor.ScrollRelativeBoth(1, 0);
  expect(editor.context.rowpanes[0].first).toBe(6); // ScrollTableUpOneRow advances first+last by one row
  expect(editor.timeout).not.toBeNull(); // SchedulePositionCalculations fired
  editor.DoPositionCalculations();

  // Hide every column at/after the target so the hidden-column while-loop
  // walks off the left edge and resets hamount to 0.
  const sheet = getSheet(control);
  for (let c = 1; c <= 6; c++) {
    sheet.colattribs.hide[SC.rcColname(c)] = "yes";
  }
  const before = editor.context.colpanes[0].first;
  editor.ScrollRelativeBoth(0, -1);
  expect(editor.context.colpanes[0].first).toBe(before); // hamount reset to 0: no horizontal move
  for (let c = 1; c <= 6; c++) {
    sheet.colattribs.hide[SC.rcColname(c)] = "no";
  }
});

test("PageRelative: bumps at least one pane forward, clamps to row 1 going backward", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pr2-root");
  const editor = getEditor(control);
  primeGridLayout(editor);
  editor.context.rowpanes = [{ first: 5, last: 5 }];
  editor.lastvisiblerow = 5; // newfirst == lastpane.first triggers the "+1" bump

  editor.PageRelative(true, 1);
  expect(editor.context.rowpanes[0].first).toBe(6);

  editor.context.rowpanes = [{ first: 2, last: 2 }];
  editor.PageRelative(true, -1); // clamps below row 1 back up to 1
  expect(editor.context.rowpanes[0].first).toBe(1);
});

test("LimitLastPanes: clamps overlapping panes and caps at usermaxrow/usermaxcol", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "llp2-root");
  const editor = getEditor(control);
  const sheet = getSheet(control);

  editor.context.rowpanes = [
    { first: 1, last: 5 },
    { first: 3, last: 10 }, // overlaps previous pane's last (5)
  ];
  editor.context.colpanes = [{ first: 1, last: 3 }];
  sheet.attribs.usermaxrow = 0;
  sheet.attribs.usermaxcol = 0;

  editor.LimitLastPanes();
  expect(editor.context.rowpanes[1].first).toBe(6); // pushed past the previous pane's last

  sheet.attribs.usermaxrow = 6;
  editor.context.rowpanes[1].first = 20;
  editor.LimitLastPanes();
  expect(editor.context.rowpanes[1].first).toBe(6); // clamped to usermaxrow
  sheet.attribs.usermaxrow = 0;
});

test("ScrollTableDownOneRow via prototype: inserting a rowspan-starting row re-renders the spanned rows", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stdr2-root");
  const editor = getEditor(control);
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A3 text t top",
    "merge A3:A5",
    "set A2 text t above",
  ]);
  primeGridLayout(editor);
  editor.context.rowpanes = [{ first: 3, last: 8 }];
  editor.context.colpanes = [{ first: 1, last: 3 }];

  const result = editor.ScrollTableDownOneRow();
  expect(result).toBe(editor.fullgrid);
  expect(editor.context.rowpanes[0].first).toBe(2); // scrolled up by one row
});

test("GridMousePosition: rowfooter, colfooter, _app==true skips header bands, and headposition-less returns null", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "gmp3-root");
  const editor = getEditor(control);
  primeGridLayout(editor);
  editor.verticaltablecontrol = { controlborder: 300 } as SocialCalc.TableControl;
  editor.horizontaltablecontrol = { controlborder: 300 } as SocialCalc.TableControl;

  // Past the vertical control border → rowfooter.
  const rowfooter = SC.GridMousePosition(editor, 350, 60);
  expect(rowfooter.rowfooter).toBe(true);
  expect(rowfooter.distance).toBe(50);

  // Below the horizontal control border, within vertical bounds → colfooter.
  const colfooter = SC.GridMousePosition(editor, 100, 350);
  expect(colfooter.colfooter).toBe(true);

  // _app==true skips the entire header/coord block (line 2723 guard is false) → null.
  const savedApp = SC._app;
  SC._app = true;
  expect(SC.GridMousePosition(editor, 100, 60)).toBeNull();
  SC._app = savedApp;

  // No headposition at all → same fall-through path → null.
  const savedHead = editor.headposition;
  editor.headposition = null;
  expect(SC.GridMousePosition(editor, 100, 60)).toBeNull();
  editor.headposition = savedHead;
});

test("GridMousePosition: a resize bar over a visible pane returns early before setting rowselect", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "gmp4-root");
  const editor = getEditor(control);
  primeGridLayout(editor);
  editor.context.rowpanes = [{ first: 1, last: 6 }];
  editor.context.colpanes = [{ first: 1, last: 6 }];

  // primeGridLayout sets rowpositions[3]=70, rowheight[3]=20, so the row-3
  // boundary is at 90. clientY=88 is within ±3px → resize-bar early return
  // (line 2773) fires before rowselect is set at line 2776.
  const rowResult = SC.GridMousePosition(editor, 10, 88);
  expect(rowResult).not.toBeNull();
  if (rowResult) {
    expect(rowResult.rowheader).toBe(true);
    // rowtoresize is kept (the delete at 2778 is after the early return).
    expect(rowResult.rowtoresize).toBe(3); // resize-bar boundary matched at row 3 (rowpositions[3]+rowheight[3]=90)
    expect(rowResult.rowselect).toBe(false); // stays false (init) — early return skips the `= true` line
  }
});

test("EditorGetStatuslineString: calcorder/calcstep/calcloading/calcserverfunc progress text and cmdstart/cmdextension cursor branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "egss2-root");
  const editor = getEditor(control);

  let s = editor.GetStatuslineString("calcorder", { count: 3, total: 12 }, {});
  expect(s).toContain("25%");

  s = editor.GetStatuslineString("calcstep", { count: 1, total: 4 }, {});
  expect(s).toContain("25%");

  s = editor.GetStatuslineString("calcloading", { sheetname: "Sheet2" }, {});
  expect(s).toContain("Sheet2");

  s = editor.GetStatuslineString(
    "calcserverfunc",
    { count: 2, total: 4, funcname: "REMOTE", coord: "B2" },
    {},
  );
  expect(s).toContain("REMOTE");
  expect(s).toContain("B2");

  const cmdParams: { command?: boolean } = {};
  s = editor.GetStatuslineString("cmdstart", null, cmdParams);
  expect(cmdParams.command).toBe(true);
  expect(editor.griddiv.style.cursor).toBe("progress");

  s = editor.GetStatuslineString("cmdextension", "widening", {});
  expect(s).toContain("widening");
});

test("MoveECellWithKey: primed pane-relative pgdn/pgup and usermaxrow clamp", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mekp-root");
  const editor = getEditor(control);
  primeGridLayout(editor);
  editor.lastvisiblerow = 9;
  editor.firstscrollingrow = 4;

  const moved = editor.MoveECell("C5");
  expect(moved).toBe("C5");
  expect(editor.ecell!.coord).toBe("C5");
  const keyResult = editor.MoveECellWithKey("[pgdn]");
  expect(keyResult).toBe("C11");
  expect(editor.ecell!.row).toBe(11);

  editor.MoveECellWithKey("[pgup]");
  // row 11 - (9-4+1) = 5
  expect(editor.ecell!.coord).toBe("C5");

  const sheet = getSheet(control);
  sheet.attribs.usermaxrow = 6;
  editor.MoveECell("C2");
  editor.MoveECellWithKey("[adown]shifted");
  expect(editor.ecell!.row).toBeLessThanOrEqual(6);
  sheet.attribs.usermaxrow = 0;
  editor.RangeRemove();
});

test("EditorAddToInput: default state no-ops, inputboxdirect appends str, input state appends with partialexpr reset", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "eai2-root");
  const editor = getEditor(control);

  // Default (start) state → no-op.
  editor.state = "start";
  editor.EditorAddToInput("hello"); // start state transitions to "input"
  expect(editor.state).toBe("input"); // "start" case transitions to "input"

  // inputboxdirect → appends str to inputBox text.
  editor.state = "inputboxdirect";
  editor.inputBox!.SetText("=SUM");
  editor.EditorAddToInput("(A1"); // inputboxdirect appends str
  expect(editor.inputBox!.GetText()).toContain("=SUM");
  expect(editor.inputBox!.GetText()).toContain("(A1");

  // input state with partialexpr → replaces with partialexpr+str.
  editor.state = "input";
  editor.inputBox!.SetText("=SUM(");
  editor.workingvalues.partialexpr = "=SUM(";
  editor.EditorAddToInput("B2)"); // input state with partialexpr resets
  expect(editor.workingvalues.partialexpr).toBe("");
  expect(editor.inputBox!.GetText()).toBe("=SUM(B2)");

  // Clean up editing state.
  editor.EditorProcessKey("[esc]", { shiftKey: false } as unknown as KeyboardEvent); // synthetic event — library type gap
});

test("GridMousePosition: cell-interior path computes coord with cellskip redirect", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "gmp5-root");
  const editor = getEditor(control);
  primeGridLayout(editor);
  // Defensive: ensure _app is false so the headposition block isn't skipped.
  const savedApp = SC._app;
  SC._app = false;
  // Set control borders high so clientX/Y stays inside the cell-interior path
  // (rather than hitting rowfooter/colfooter branches).
  editor.verticaltablecontrol = { controlborder: 500 } as SocialCalc.TableControl;
  editor.horizontaltablecontrol = { controlborder: 500 } as SocialCalc.TableControl;
  editor.context.cellskip = {};
  const cellResult = SC.GridMousePosition(editor, 100, 60);
  expect(cellResult).not.toBeNull();
  if (cellResult) {
    expect(cellResult.coord).toBe("B2"); // row 2, col 2 from primed rowpositions/colpositions (see comment below)
    expect(cellResult.rowheader).toBeUndefined();
    expect(cellResult.colheader).toBeUndefined();
  }

  // With a cellskip entry, the coord is redirected.
  editor.context.cellskip = { B2: "D3" }; // GridMousePosition maps clientX=100,clientY=60 → B2
  const skipped = SC.GridMousePosition(editor, 100, 60);
  expect(skipped?.coord).toBe("D3"); // B2 is redirected to D3 via cellskip
  editor.context.cellskip = null;
  SC._app = savedApp;
});

test("EditorOpenCellEdit: early returns when ecell is null or inputBox is disabled; normal path fills workingvalues", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "eoce2-root");
  const editor = getEditor(control);

  // No ecell → returns true.
  const savedEcell = editor.ecell;
  editor.ecell = null;
  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
  editor.ecell = savedEcell;

  // Disabled inputBox element → returns true (multi-line mode ignore).
  (editor.inputBox!.element as HTMLInputElement).disabled = true;
  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
  (editor.inputBox!.element as HTMLInputElement).disabled = false;

  // Normal path fills workingvalues.
  const result = SC.EditorOpenCellEdit(editor);
  expect(result).toBeUndefined();
  expect(editor.workingvalues.ecoord).toBe(editor.ecell!.coord);
  expect(editor.workingvalues.partialexpr).toBe("");
});

test("MoveECellWithKey: [adown] on a rowspan cell advances by the rowspan count", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mekp2-root");
  const editor = getEditor(control);
  const sheet = getSheet(control);
  // Defensive: ensure _app is false so MoveECell prototype doesn't short-circuit.
  const savedApp = SC._app;
  SC._app = false;

  // Set rowspan=3 directly on the A1 cell so [adown] from A1 jumps 3 rows.
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 text t merged"]);
  sheet.cells["A1"].rowspan = 3;

  const moved = editor.MoveECell("A1");
  expect(moved).toBe("A1");
  editor.MoveECellWithKey("[adown]");
  // row 1 + rowspan(3) = 4
  expect(editor.ecell!.row).toBe(4);
  editor.RangeRemove();
  SC._app = savedApp;
});
