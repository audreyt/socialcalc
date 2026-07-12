// Behavior-contract coverage for js/socialcalctableeditor.ts, focused on the
// "commands" half of the module: clipboard/copy-cut-paste plumbing, fill
// handles, drag/drop (TableControl scrollbars, generic Drag*, Button*),
// row/column resize, command callbacks (EditorScheduleSheetCommands's
// undo/redo routing, EditedTriggerCell email triggers), undo/redo, and
// teardown/timers (FinishColRowSize, CellHandlesHoverTimeout, ButtonRepeat,
// SetDragAutoRepeat/DragAutoRepeat).
//
// Companion file test/hardening-tableeditor-interactions.test.ts (owned by a
// sibling branch) covers editor init, cell movement/range selection, edit
// lifecycle, keyboard/mouse input handling, and command scheduling/dispatch
// (EditorScheduleSheetCommands's deferred-queue plumbing, status-callback
// signalstatus branches, render/position-calc scheduling) — deliberately not
// duplicated here.
//
// Every test asserts real production state: scheduled commands actually
// completing (via waitForStatus/scheduleCommands on the sheet), resulting
// cell/attribute values, editor/range/highlight state, or real callback
// invocation — never a bare "did not throw".

import { afterAll, afterEach, expect, test } from "vite-plus/test";

import { loadSocialCalc as _loadSocialCalc, scheduleCommands, waitForStatus } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

// Timers created by hover/repeat/drag-autoscroll must be cancelled between
// tests, matching the convention in the other editor-coverage files.
ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
});

afterAll(() => {
  restoreOriginalTimers();
});

// The built bundle is loaded at runtime; the SocialCalc namespace is
// declared ambiently in js/socialcalctableeditor.d.ts (aggregated into
// dist/SocialCalc.d.ts), so we cast the returned module to that type once at
// the VM-loading boundary.
type SC = typeof SocialCalc;
type Editor = SocialCalc.TableEditor;
type Control = SocialCalc.SpreadsheetControl;
type Sheet = SocialCalc.Sheet;
type TableControl = SocialCalc.TableControl;

async function loadSocialCalc(): Promise<SC> {
  const mod = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  return mod as unknown as SC;
}

let containerSeq = 0;
async function newControl(SC: SC): Promise<{ control: Control; container: HTMLElement }> {
  const container = document.createElement("div");
  container.id = "htc-root-" + containerSeq++;
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl() as unknown as Control;
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

function editorOf(control: Control): Editor {
  return control.editor as unknown as Editor;
}

function sheetOf(editor: Editor): Sheet {
  return editor.context.sheetobj;
}

// editor.cellhandles is typed as CellHandles | null; after InitializeSpreadsheetControl
// it is always non-null. This helper centralizes the non-null narrowing.
function handlesOf(editor: Editor): SocialCalc.CellHandles {
  return editor.cellhandles as unknown as SocialCalc.CellHandles;
}

/** Shim document.addEventListener/removeEventListener — SetMouseMoveUp /
 * RemoveMouseMoveUp and several *Register functions use the capture-phase
 * form, which the fake DOM shim does not provide by default. */
function ensureDocumentEvents() {
  const doc = document as unknown as {
    addEventListener?: unknown;
    removeEventListener?: unknown;
  };
  if (typeof doc.addEventListener !== "function") {
    doc.addEventListener = (() => {}) as typeof document.addEventListener;
  }
  if (typeof doc.removeEventListener !== "function") {
    doc.removeEventListener = (() => {}) as typeof document.removeEventListener;
  }
  // FakeElement lacks contains() and getAttributeNames(); chai's
  // inspectHTML calls getAttributeNames when formatting an element in an
  // assertion failure message, and production code calls contains() on
  // editor.toplevel. Patch the prototype once.
  const proto = Object.getPrototypeOf((document as unknown as { body: unknown }).body);
  if (typeof (proto as { contains?: unknown }).contains !== "function") {
    (proto as { contains: (node: unknown) => boolean }).contains = function (node: unknown) {
      let cur: unknown = node;
      while (cur) {
        if (cur === this) return true;
        cur = (cur as { parentNode?: unknown })?.parentNode;
      }
      return false;
    };
  }
  if (typeof (proto as { getAttributeNames?: unknown }).getAttributeNames !== "function") {
    (proto as { getAttributeNames: () => string[] }).getAttributeNames = function () {
      return Object.keys((this as unknown as { attributes: Record<string, string> }).attributes);
    };
  }
}

// A minimal event shape sufficient for the mouse handlers under test.
interface FakeEvent {
  type: string;
  clientX: number;
  clientY: number;
  target: unknown;
  srcElement: unknown;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  wheelDelta: number;
  detail: number;
  which: number;
  keyCode: number;
  charCode: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}

function fakeEvent(extras: Partial<FakeEvent> = {}): FakeEvent {
  const target = extras.target ?? null;
  return {
    type: "mousedown",
    clientX: 10,
    clientY: 10,
    target,
    srcElement: target,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    wheelDelta: 0,
    detail: 0,
    which: 0,
    keyCode: 0,
    charCode: 0,
    preventDefault() {},
    stopPropagation() {},
    ...extras,
  };
}

function asMouseEvent(e: FakeEvent): MouseEvent {
  // The production handlers only read the plain-object fields declared on
  // FakeEvent; this is the same "test-double at a DOM boundary" cast used
  // throughout the existing coverage suite.
  return e as unknown as MouseEvent;
}

/**
 * Deterministically primes the pixel geometry the mouse-position math reads
 * (colpositions/rowpositions/headposition/gridposition/controlborder), so
 * clientX/clientY in tests map to known rows/cols/panes instead of whatever
 * the fake DOM's zero-sized offsets would produce. Must be re-applied after
 * any scheduleCommands()/render cycle, since a real render recomputes these
 * fields from the (zero-offset) fake DOM.
 */
function primeGridLayout(editor: Editor) {
  try {
    editor.CalculateEditorPositions();
  } catch {
    // Best-effort: the fake DOM lacks real offsets: the manual overrides
    // below make the outcome of this call irrelevant either way.
  }
  editor.gridposition = { left: 0, top: 0 };
  editor.headposition = { left: 30, top: 30 };
  editor.tablewidth = editor.tablewidth ?? 400;
  editor.tableheight = editor.tableheight ?? 400;
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
  editor.firstscrollingrowtop = editor.firstscrollingrowtop ?? 30;
  editor.firstscrollingcolleft = editor.firstscrollingcolleft ?? 30;
  if (editor.verticaltablecontrol) editor.verticaltablecontrol.controlborder = 500;
  if (editor.horizontaltablecontrol) editor.horizontaltablecontrol.controlborder = 500;
  editor.griddiv = editor.griddiv || document.createElement("div");
  // A leftover busy=true from a prior synchronous command dispatch would
  // route EditorScheduleSheetCommands into the deferred queue instead of
  // executing synchronously — every test needs a clean slate.
  editor.busy = false;
}

// ===========================================================================
// Row/column resize
// ===========================================================================

test("column resize: full mousedown/move/up cycle applies the new width and clears the size-display overlay", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  SC.EditorMouseInfo.editor = editor;
  const result = { coltoresize: 2, coltounhide: null } as unknown as SocialCalc.GridMousePositionResult;
  editor.busy = false;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.ProcessEditorColsizeMouseDown(asMouseEvent(fakeEvent({ clientX: 100, clientY: 0 })), editor.fullgrid as HTMLElement, result);
      SC.ProcessEditorColsizeMouseMove(asMouseEvent(fakeEvent({ clientX: 160, clientY: 0 })));
      SC.ProcessEditorColsizeMouseUp(asMouseEvent(fakeEvent({ clientX: 160, clientY: 0 })));
    },
    2000,
  );

  // Column B's default width (80) grew by the drag delta (160-100=60).
  expect(sheet.colattribs.width["B"]).toBe("140");
  // FinishColRowSize is normally deferred via setTimeout; call it
  // directly to verify the cleanup side-effect synchronously.
 SC.FinishColRowSize();
  expect(SC.EditorMouseInfo.mouseresizedisplay).toBeFalsy();
});

test("column resize: clamps to the minimum column width when dragged far left", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  SC.EditorMouseInfo.editor = editor;
  const result = { coltoresize: 2, coltounhide: null } as unknown as SocialCalc.GridMousePositionResult;
  editor.busy = false;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.ProcessEditorColsizeMouseDown(asMouseEvent(fakeEvent({ clientX: 100, clientY: 0 })), editor.fullgrid as HTMLElement, result);
      SC.ProcessEditorColsizeMouseUp(asMouseEvent(fakeEvent({ clientX: -500, clientY: 0 })));
    },
    2000,
  );

  expect(sheet.colattribs.width["B"]).toBe(String(SC.Constants.defaultMinimumColWidth));
});

test("column resize: mouseup with coltounhide clears the hidden flag for that column", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  await scheduleCommands(SC, sheet, "set B hide yes");
  expect(sheet.colattribs.hide["B"]).toBe("yes");
  primeGridLayout(editor);

  SC.EditorMouseInfo.editor = editor;
  const result = { coltoresize: null, coltounhide: 2 } as unknown as SocialCalc.GridMousePositionResult;
  editor.busy = false;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.ProcessEditorColsizeMouseDown(asMouseEvent(fakeEvent({ clientX: 100, clientY: 0 })), editor.fullgrid as HTMLElement, result);
      SC.ProcessEditorColsizeMouseUp(asMouseEvent(fakeEvent({ clientX: 100, clientY: 0 })));
    },
    2000,
  );

  expect(sheet.colattribs.hide["B"]).toBeUndefined();
});

test("row resize: full mousedown/move/up cycle applies the new height", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);
  SC.GetSpreadsheetControlObject()!.spreadsheetDiv = {
    firstChild: { offsetHeight: 0 },
  } as unknown as HTMLElement;

  SC.EditorMouseInfo.editor = editor;
  const result = { rowtoresize: 2, rowtounhide: null } as unknown as SocialCalc.GridMousePositionResult;
  editor.busy = false;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.ProcessEditorRowsizeMouseDown(asMouseEvent(fakeEvent({ clientX: 0, clientY: 100 })), editor.fullgrid as HTMLElement, result);
      SC.ProcessEditorRowsizeMouseMove(asMouseEvent(fakeEvent({ clientX: 0, clientY: 130 })));
      SC.ProcessEditorRowsizeMouseUp(asMouseEvent(fakeEvent({ clientX: 0, clientY: 130 })));
    },
    2000,
  );

  // Default row height (15) grew by the drag delta (130-100=30).
  // Default row height (15) grew by the drag delta (130-100=30); stored as string.
  expect(String(sheet.rowattribs.height[2])).toBe("45");
});

test("row resize: clamps to the minimum assumed row height when dragged far up", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);
  SC.GetSpreadsheetControlObject()!.spreadsheetDiv = {
    firstChild: { offsetHeight: 0 },
  } as unknown as HTMLElement;

  SC.EditorMouseInfo.editor = editor;
  const result = { rowtoresize: 2, rowtounhide: null } as unknown as SocialCalc.GridMousePositionResult;
  editor.busy = false;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.ProcessEditorRowsizeMouseDown(asMouseEvent(fakeEvent({ clientX: 0, clientY: 100 })), editor.fullgrid as HTMLElement, result);
      SC.ProcessEditorRowsizeMouseUp(asMouseEvent(fakeEvent({ clientX: 0, clientY: -500 })));
    },
    2000,
  );

  expect(String(sheet.rowattribs.height[2])).toBe(String(SC.Constants.defaultAssumedRowHeight));
});

test("row resize: mouseup with rowtounhide clears the hidden flag for that row", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);
  SC.GetSpreadsheetControlObject()!.spreadsheetDiv = {
    firstChild: { offsetHeight: 0 },
  } as unknown as HTMLElement;

  await scheduleCommands(SC, sheet, "set 3 hide yes");
  expect(sheet.rowattribs.hide[3]).toBe("yes");
  primeGridLayout(editor);

  SC.EditorMouseInfo.editor = editor;
  const result = { rowtoresize: null, rowtounhide: 3 } as unknown as SocialCalc.GridMousePositionResult;
  editor.busy = false;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.ProcessEditorRowsizeMouseDown(asMouseEvent(fakeEvent({ clientX: 0, clientY: 100 })), editor.fullgrid as HTMLElement, result);
      SC.ProcessEditorRowsizeMouseUp(asMouseEvent(fakeEvent({ clientX: 0, clientY: 100 })));
    },
    2000,
  );

  expect(sheet.rowattribs.hide[3]).toBeUndefined();
});

test("FinishColRowSize: removes the size-display overlay and guards when no resize is in progress", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  // Guard clause: mouseinfo.editor is null -> no-op, does not throw.
  SC.EditorMouseInfo.editor = null;
  expect(() => SC.FinishColRowSize()).not.toThrow();

  // Real cleanup: a real overlay element attached to editor.toplevel is
  // removed and the mouseinfo reference is cleared.
  SC.EditorMouseInfo.editor = editor;
  const overlay = document.createElement("div");
  (editor.toplevel as HTMLElement).appendChild(overlay);
  SC.EditorMouseInfo.mouseresizedisplay = overlay;
  expect((editor.toplevel as HTMLElement).contains(overlay)).toBe(true);

  SC.FinishColRowSize();

  expect((editor.toplevel as HTMLElement).contains(overlay)).toBe(false);
  expect(SC.EditorMouseInfo.mouseresizedisplay).toBeNull();
});

// ===========================================================================
// Fill handles / cell-handle drag (Fill, Move, MoveInsert, Nothing)
// ===========================================================================

test("fill handle: dragging down extends a numeric series into the newly selected cells", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  await scheduleCommands(SC, sheet, ["set A1 value n 10", "set A2 value n 20"]);
  primeGridLayout(editor);

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("A2");
  handlesOf(editor).dragtype = "Fill";
  handlesOf(editor).filltype = "Down";
  handlesOf(editor).movedmouse = true;
  handlesOf(editor).startingcoord = "A1";
  editor.range2 = { top: 1, bottom: 2, left: 1, right: 1, hasrange: true };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.mouselastcoord = "A2";
  editor.busy = false;

  // clientY=100 maps to row 4 with the primed rowpositions/rowheight.
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.CellHandlesMouseUp(asMouseEvent(fakeEvent({ clientX: 40, clientY: 100 })));
    },
    2000,
  );

  expect(sheet.cells["A3"]?.datavalue).toBe(30);
  expect(sheet.cells["A4"]?.datavalue).toBe(40);
  expect(editor.ecell?.coord).toBe("A4");
  expect(editor.range).toMatchObject({ top: 1, bottom: 4, left: 1, right: 1 });
});

test("fill handle: dragging right extends a numeric series horizontally", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  await scheduleCommands(SC, sheet, ["set A1 value n 5", "set B1 value n 15"]);
  primeGridLayout(editor);

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("B1");
  handlesOf(editor).dragtype = "Fill";
  handlesOf(editor).filltype = "Right";
  handlesOf(editor).movedmouse = true;
  handlesOf(editor).startingcoord = "A1";
  editor.range2 = { top: 1, bottom: 1, left: 1, right: 2, hasrange: true };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.mouselastcoord = "B1";
  editor.busy = false;

  // clientX=320 maps to a column past B with the primed colpositions.
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.CellHandlesMouseUp(asMouseEvent(fakeEvent({ clientX: 320, clientY: 50 })));
    },
    2000,
  );

  // Fill right extends A1:B1 (5,15) rightward. The fill range is
  // determined by GridMousePosition's result.coord clamped to the
  // starting row. Assert that at least one cell to the right was filled
  // with an incremented value from the series (5, 15, 25, 35, ...).
  const filled = ["C1", "D1", "E1", "F1", "G1"]
    .map((coord) => sheet.cells[coord])
    .filter((cell) => cell && cell.datavalue !== undefined && cell.datavalue !== null && cell.datavalue !== "");
  expect(filled.length).toBeGreaterThan(0);
  // Each filled cell's value should be a number continuing the series.
  for (const cell of filled) {
    const val = Number(cell.datavalue);
    expect(val).toBeGreaterThanOrEqual(25);
  }
});

test("cell-handle Move drag relocates range contents and clears the range2 preview highlight", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  await scheduleCommands(SC, sheet, "set A1 text t hello");
  primeGridLayout(editor);

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("A1");
  handlesOf(editor).dragtype = "Move";
  handlesOf(editor).movedmouse = true;
  handlesOf(editor).startingcoord = "A1";
  editor.range2 = { top: 1, bottom: 1, left: 1, right: 1, hasrange: true };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.mouselastcoord = "A1";
  editor.busy = false;
  // Real MouseMove would have already advanced ecell to the drop target;
  // simulate that directly (matches the established pattern for CellHandles
  // mouseup-only tests: prime the state a real MouseMove call left behind).
  editor.MoveECell("C3");

  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.CellHandlesMouseUp(asMouseEvent(fakeEvent({ clientX: 240, clientY: 90 })));
    },
    2000,
  );

  // movepaste clears the source cell; the cell object may be absent or have empty datavalue.
  expect(sheet.cells["A1"]?.datavalue ?? "").toBe("");
  expect(sheet.cells["C3"]?.datavalue).toBe("hello");
  expect(editor.range2.hasrange).toBe(false);
  expect(editor.context.highlights["C3"]).toBe("cursor");
  expect(editor.context.highlights["A1"]).toBeUndefined();
});

test("cell-handle MoveInsert drag clears the source range and anchors the post-move range", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  await scheduleCommands(SC, sheet, ["set A1 text t hello", "set A2 text t world"]);
  primeGridLayout(editor);

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("A2");
  handlesOf(editor).dragtype = "MoveI";
  handlesOf(editor).filltype = "Vertical";
  handlesOf(editor).movedmouse = true;
  handlesOf(editor).startingcoord = "A1";
  editor.range2 = { top: 1, bottom: 2, left: 1, right: 1, hasrange: true };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.mouselastcoord = "A1";
  editor.busy = false;
  editor.MoveECell("C1");

  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.CellHandlesMouseUp(asMouseEvent(fakeEvent({ clientX: 240, clientY: 20 })));
    },
    2000,
  );

  // The source range's contents are cleared by the real "moveinsert"
  // command regardless of how the insert shift lands.
  expect(sheet.cells["A1"]?.datavalue).toBe("");
  expect(sheet.cells["A2"]?.datavalue).toBe("");
  // Real Range2Remove/RangeAnchor/RangeExtend teardown anchored the new
  // selection at ecell (C1) sized by range2's original span (1 col x 2 rows).
  expect(editor.range2.hasrange).toBe(false);
  expect(editor.range).toMatchObject({ left: 3, right: 3, top: 1, bottom: 2 });
});

test("cell-handle mouseup with no movement (Nothing) clears both ranges without scheduling a command", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("B2");
  editor.range2 = { top: 1, bottom: 2, left: 1, right: 2, hasrange: true };
  handlesOf(editor).dragtype = "Fill";
  handlesOf(editor).movedmouse = false;
  SC.EditorMouseInfo.editor = editor;
  editor.busy = false;

  let sawCmdEnd = false;
  const previous = sheet.statuscallback;
  sheet.statuscallback = (data, status, arg, params) => {
    if (status === "cmdend") sawCmdEnd = true;
    previous?.(data, status, arg, params);
  };
  try {
    SC.CellHandlesMouseUp(asMouseEvent(fakeEvent({ clientX: 40, clientY: 60 })));
  } finally {
    sheet.statuscallback = previous;
  }

  expect(sawCmdEnd).toBe(false);
  expect(editor.range.hasrange).toBe(false);
  expect(editor.range2.hasrange).toBe(false);
  expect(editor.context.highlights).toEqual({ A1: "cursor" });
});

// ===========================================================================
// SetDragAutoRepeat / DragAutoRepeat / CellHandlesDragAutoRepeat
// ===========================================================================

test("SetDragAutoRepeat: a Fill drag that exits to the row footer schedules the auto-repeat callback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
  primeGridLayout(editor);

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("A2");
  handlesOf(editor).dragtype = "Fill";
  handlesOf(editor).filltype = "Down";
  handlesOf(editor).startingcoord = "A1";
  editor.busy = false;
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.mouselastcoord = "A2";

  // clientX=530 is past verticaltablecontrol.controlborder(500) -> rowfooter.
  SC.CellHandlesMouseMove(asMouseEvent(fakeEvent({ clientX: 530, clientY: 60 })));

  expect(SC.AutoRepeatInfo.timer).toBeTruthy();
  expect(SC.AutoRepeatInfo.repeatcallback).toBe(SC.CellHandlesDragAutoRepeat);
});

test("DragAutoRepeat: a real tick scrolls the pane, extends the fill selection, and reschedules itself", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);

  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
  primeGridLayout(editor);

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("A2");
  handlesOf(editor).dragtype = "Fill";
  handlesOf(editor).filltype = "Down";
  handlesOf(editor).startingcoord = "A1";
  editor.busy = false;
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.mouselastcoord = "A2";
  SC.CellHandlesMouseMove(asMouseEvent(fakeEvent({ clientX: 530, clientY: 60 })));
  expect(SC.AutoRepeatInfo.timer).toBeTruthy();

  const colpanesBefore = editor.context.colpanes[0].first;
  SC.DragAutoRepeat();

  // rowfooter -> direction "right" -> ScrollRelativeBoth(0, +1) shifts the
  // last colpane forward by one, and the fill's ecell advances.
  expect(editor.context.colpanes[0].first).toBe(colpanesBefore + 1);
  expect(editor.ecell?.coord).toBe("B1");
  // Self-perpetuating repeat: DragAutoRepeat reschedules its own timer.
  expect(SC.AutoRepeatInfo.timer).toBeTruthy();
});

test("SetDragAutoRepeat: cancels an active repeat once the pointer distance exceeds the repeat threshold", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const mouseinfoNear = { rowheader: false, rowfooter: true, colheader: false, colfooter: false, distance: 10, row: 3, col: 1 };
  SC.SetDragAutoRepeat(editor, mouseinfoNear, SC.CellHandlesDragAutoRepeat);
  expect(SC.AutoRepeatInfo.timer).toBeTruthy();

  const mouseinfoFar = { rowheader: false, rowfooter: true, colheader: false, colfooter: false, distance: 999, row: 3, col: 1 };
  SC.SetDragAutoRepeat(editor, mouseinfoFar, SC.CellHandlesDragAutoRepeat);

  expect(SC.AutoRepeatInfo.timer).toBeNull();
});

test("SetDragAutoRepeat(editor, null) cancels any pending repeat timer", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const mouseinfo = { rowheader: false, rowfooter: true, colheader: false, colfooter: false, distance: 10, row: 3, col: 1 };
  SC.SetDragAutoRepeat(editor, mouseinfo, SC.CellHandlesDragAutoRepeat);
  expect(SC.AutoRepeatInfo.timer).toBeTruthy();

  SC.SetDragAutoRepeat(editor, null);

  expect(SC.AutoRepeatInfo.timer).toBeNull();
  expect(SC.AutoRepeatInfo.mouseinfo).toBeNull();
});

// ===========================================================================
// Command callbacks: undo/redo routing, EditedTriggerCell
// ===========================================================================

test("EditorScheduleSheetCommands: undo/redo route through SheetUndo/SheetRedo and flip widgetsClean only when _app is set", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);

  await scheduleCommands(SC, sheet, "set A1 value n 5");
  expect(sheet.cells["A1"]?.datavalue).toBe(5);

  const smc = SC as unknown as { _app?: boolean };
  editor.busy = false;
  editor.state = "start";
  sheet.widgetsClean = true;
  smc._app = true;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      editor.EditorScheduleSheetCommands("undo", true, false);
    },
    2000,
  );
  expect(sheet.cells["A1"]?.datavalue).toBeUndefined();
  expect(sheet.widgetsClean).toBe(false);

  sheet.widgetsClean = true;
  smc._app = false;
  editor.busy = false;
  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      editor.EditorScheduleSheetCommands("redo", true, false);
    },
    2000,
  );
  expect(sheet.cells["A1"]?.datavalue).toBe(5);
  // _app is falsy: the widgetsClean=false side effect is skipped this time.
  expect(sheet.widgetsClean).toBe(true);
  smc._app = undefined;
});

test("EditedTriggerCell: EMAILONEDITIF pushes a real setemailparameters command to deferredEmailCommands", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);

  sheet.ioParameterList = { G1: { function_name: "EMAILONEDITIF" } };
  editor.deferredEmailCommands = [];

  SC.EditedTriggerCell({ G1: true }, "A1", editor, sheet);

  expect(editor.deferredEmailCommands).toEqual([{ cmdstr: "setemailparameters G1 A1", saveundo: false }]);
});

test("EditedTriggerCell: an actionCellId absent from ioParameterList is skipped without pushing a command", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);

  sheet.ioParameterList = {};
  editor.deferredEmailCommands = [];

  SC.EditedTriggerCell({ Z9: true }, "A1", editor, sheet);

  expect(editor.deferredEmailCommands).toEqual([]);
});

// ===========================================================================
// TableControl: real less/more/scrollarea button closures
// ===========================================================================

test("TableControl less-button: real closure calls ScrollRelative(vertical,-1) and is suppressed while editor.busy", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const vtc = editor.verticaltablecontrol as TableControl;
  const calls: Array<[boolean, number]> = [];
  const original = editor.ScrollRelative.bind(editor);
  editor.ScrollRelative = (vertical: boolean, amount: number) => {
    calls.push([vertical, amount]);
    return original(vertical, amount);
  };

  editor.busy = false;
  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: vtc.lessbutton, clientX: 505, clientY: 60 })));
  expect(calls).toEqual([[true, -1]]);
  expect(SC.ButtonInfo.buttonDown).toBe(true);
  expect(SC.ButtonInfo.timer).toBeTruthy();

  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ clientX: 505, clientY: 60 })));
  expect(SC.ButtonInfo.buttonDown).toBe(false);
  expect(SC.ButtonInfo.timer).toBeNull();

  calls.length = 0;
  editor.busy = true;
  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: vtc.lessbutton, clientX: 505, clientY: 60 })));
  expect(calls).toEqual([]);
  expect(SC.ButtonInfo.buttonDown).toBe(false);
  editor.busy = false;

  editor.ScrollRelative = original;
});

test("TableControl more-button: real closure calls ScrollRelative(vertical,+1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const vtc = editor.verticaltablecontrol as TableControl;
  const calls: Array<[boolean, number]> = [];
  const original = editor.ScrollRelative.bind(editor);
  editor.ScrollRelative = (vertical: boolean, amount: number) => {
    calls.push([vertical, amount]);
    return original(vertical, amount);
  };

  editor.busy = false;
  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: vtc.morebutton, clientX: 505, clientY: 570 })));
  expect(calls).toEqual([[true, 1]]);
  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ clientX: 505, clientY: 570 })));

  editor.ScrollRelative = original;
});

test("TableControl scrollarea: ScrollAreaClick pages the last row pane past the click position", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const vtc = editor.verticaltablecontrol as TableControl;
  vtc.thumbpos = 300;
  const before = { ...editor.context.rowpanes[0] };
  editor.busy = false;

  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: vtc.scrollarea, clientX: 505, clientY: 400 })));

  // clickpos(400) > thumbpos(300) -> PageRelative(true, +1) advances the
  // last pane's "first" row to lastvisiblerow.
  expect(editor.context.rowpanes[0].first).toBeGreaterThan(before.first);
  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ clientX: 505, clientY: 400 })));
});

test("TableControl scrollarea: ScrollAreaClick is a no-op while editor.busy", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const vtc = editor.verticaltablecontrol as TableControl;
  vtc.thumbpos = 300;
  editor.busy = true;
  const before = { ...editor.context.rowpanes[0] };

  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: vtc.scrollarea, clientX: 505, clientY: 400 })));

  expect(editor.context.rowpanes[0]).toEqual(before);
  editor.busy = false;
});

// ===========================================================================
// Generic Button lifecycle (hover / down / up / repeat)
// ===========================================================================

function registerTestButton(SC: SC, editor: Editor) {
  const element = document.createElement("div");
  (editor.toplevel as HTMLElement).appendChild(element);
  const overCalls: unknown[] = [];
  const outCalls: unknown[] = [];
  SC.ButtonRegister(
    editor,
    element,
    { normalstyle: "color:black;", hoverstyle: "color:blue;", downstyle: "color:red;", repeatwait: 50, repeatinterval: 20 },
    {
      MouseOver: () => overCalls.push(true),
      MouseOut: () => outCalls.push(true),
    },
  );
  return { element, overCalls, outCalls };
}

test("ButtonRegister hover lifecycle: mouseover sets hoverstyle and invokes MouseOver; switching targets restores the previous normalstyle", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const a = registerTestButton(SC, editor);
  const b = registerTestButton(SC, editor);

  SC.ButtonMouseOver(asMouseEvent(fakeEvent({ target: a.element })));
  expect(a.element.style.color ?? a.element.style["color"]).toContain("blue");
  expect(a.overCalls).toEqual([true]);

  // Switching hover target restores A's normalstyle before applying B's hover.
  SC.ButtonMouseOver(asMouseEvent(fakeEvent({ target: b.element })));
  expect(a.element.style.color ?? a.element.style["color"]).toContain("black");
  expect(b.element.style.color ?? b.element.style["color"]).toContain("blue");
});

test("ButtonRegister: mouseout while buttonDown only marks doingHover false, without restoring style or firing MouseOut", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const a = registerTestButton(SC, editor);
  SC.ButtonMouseOver(asMouseEvent(fakeEvent({ target: a.element })));
  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: a.element })));
  expect(SC.ButtonInfo.buttonDown).toBe(true);
  const styleAfterDown = a.element.style.color ?? a.element.style["color"];

  SC.ButtonMouseOut(asMouseEvent(fakeEvent({ target: a.element })));

  expect(SC.ButtonInfo.doingHover).toBe(false);
  expect(a.outCalls).toEqual([]);
  expect(a.element.style.color ?? a.element.style["color"]).toBe(styleAfterDown);

  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ target: a.element })));
});

test("ButtonRegister: mouseout while not down restores normalstyle and invokes MouseOut", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const a = registerTestButton(SC, editor);
  SC.ButtonMouseOver(asMouseEvent(fakeEvent({ target: a.element })));
  expect(a.element.style.color ?? a.element.style["color"]).toContain("blue");

  SC.ButtonMouseOut(asMouseEvent(fakeEvent({ target: a.element })));

  expect(a.element.style.color ?? a.element.style["color"]).toContain("black");
  expect(a.outCalls).toEqual([true]);
});

test("ButtonRegister mousedown: repeatwait schedules ButtonRepeat, which re-invokes Repeat and reschedules itself", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const element = document.createElement("div");
  (editor.toplevel as HTMLElement).appendChild(element);
  let repeatCalls = 0;
  SC.ButtonRegister(editor, element, { repeatwait: 50, repeatinterval: 20 }, { Repeat: () => repeatCalls++ });

  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: element })));
  expect(SC.ButtonInfo.timer).toBeTruthy();
  expect(repeatCalls).toBe(0);

  SC.ButtonRepeat();
  expect(repeatCalls).toBe(1);
  // ButtonRepeat reschedules itself using the registered repeatinterval.
  expect(SC.ButtonInfo.timer).toBeTruthy();

  SC.ButtonRepeat();
  expect(repeatCalls).toBe(2);

  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ target: element })));
  expect(SC.ButtonInfo.timer).toBeNull();
});

test("ButtonRepeat: is a no-op once buttonElement has been cleared", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const element = document.createElement("div");
  (editor.toplevel as HTMLElement).appendChild(element);
  let repeatCalls = 0;
  SC.ButtonRegister(editor, element, { repeatwait: 50 }, { Repeat: () => repeatCalls++ });
  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: element })));
  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ target: element })));
  // ButtonMouseUp clears buttonDown and timer, but NOT buttonElement.
  expect(SC.ButtonInfo.buttonDown).toBe(false);
  // Manually clear buttonElement to test ButtonRepeat's guard clause.
  SC.ButtonInfo.buttonElement = null;

  expect(() => SC.ButtonRepeat()).not.toThrow();
  expect(repeatCalls).toBe(0);
});

test("ButtonRegister mouseup: restores hoverstyle when still hovering, normalstyle otherwise", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const hovered = registerTestButton(SC, editor);
  SC.ButtonMouseOver(asMouseEvent(fakeEvent({ target: hovered.element })));
  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: hovered.element })));
  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ target: hovered.element })));
  expect(hovered.element.style.color ?? hovered.element.style["color"]).toContain("blue");

  const unhovered = registerTestButton(SC, editor);
  SC.ButtonMouseDown(asMouseEvent(fakeEvent({ target: unhovered.element })));
  SC.ButtonInfo.doingHover = false;
  SC.ButtonMouseUp(asMouseEvent(fakeEvent({ target: unhovered.element })));
  expect(unhovered.element.style.color ?? unhovered.element.style["color"]).toContain("black");
});

// ===========================================================================
// Generic Drag (DragRegister/Unregister/MouseDown/Move/Up)
// ===========================================================================

test("DragUnregister: removes a registered element so a subsequent DragMouseDown on it is a no-op", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const element = document.createElement("div");
  (editor.toplevel as HTMLElement).appendChild(element);
  let moveCalls = 0;
  SC.DragRegister(element, true, true, { MouseDown: () => moveCalls++ }, editor.toplevel as HTMLElement);
  const countBefore = SC.DragInfo.registeredElements.length;

  SC.DragUnregister(element);

  expect(SC.DragInfo.registeredElements.length).toBe(countBefore - 1);
  SC.DragMouseDown(asMouseEvent(fakeEvent({ target: element, clientX: 10, clientY: 10 })));
  expect(moveCalls).toBe(0);
  expect(SC.DragInfo.draggingElement).toBeNull();
});

test("DragUnregister: a no-op for an element that was never registered", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  const element = document.createElement("div");
  const countBefore = SC.DragInfo.registeredElements.length;

  expect(() => SC.DragUnregister(element)).not.toThrow();

  expect(SC.DragInfo.registeredElements.length).toBe(countBefore);
});

// ===========================================================================
// TCPS/TCT drag stop commands (pane split, thumb scroll)
// ===========================================================================

test("TCPSDragFunctionStop: schedules a real pane-row command that splits the row panes", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);
  sheet.attribs.lastrow = 30;
  editor.context.rowpanes = [{ first: 1, last: 22 }];
  const vtc = editor.verticaltablecontrol as TableControl;
  vtc.morebuttonstart = 500;
  vtc.minscrollingpanesize = 20;
  const draginfo = { offsetY: 0, clientY: 300, thumbstatus: null } as unknown as typeof SC.DragInfo;
  const dobj = {
    vertical: true,
    horizontal: false,
    functionobj: { control: vtc },
    element: vtc.thumb,
  } as unknown as SocialCalc.DragRegisteredElement;

  await waitForStatus(
    sheet,
    "cmdend",
    () => {
      SC.TCPSDragFunctionStop({} as Event, draginfo, dobj);
    },
    2000,
  );

  expect(editor.context.rowpanes.length).toBe(2);
  expect(editor.context.rowpanes[0].first).toBe(1);
});

test("TCTDragFunctionStop: moves the scrolling pane to the computed thumb position and removes the status overlay", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();
  primeGridLayout(editor);
  sheet.attribs.lastrow = 30;
  editor.context.rowpanes = [
    { first: 1, last: 6 },
    { first: 7, last: 22 },
  ];
  const vtc = editor.verticaltablecontrol as TableControl;
  vtc.scrollareastart = 0;
  vtc.scrollareaend = 400;
  vtc.scrollareasize = 400;
  vtc.thumbthickness = 20;
  editor.lastnonscrollingrow = 0;

  const overlay = document.createElement("div");
  (editor.toplevel as HTMLElement).appendChild(overlay);
  const draginfo = { offsetY: 0, clientY: 100, thumbstatus: overlay } as unknown as typeof SC.DragInfo;
  const dobj = {
    vertical: true,
    horizontal: false,
    functionobj: { control: vtc },
    element: vtc.thumb,
  } as unknown as SocialCalc.DragRegisteredElement;
  const paneBefore = { ...editor.context.rowpanes[1] };

  SC.TCTDragFunctionStop({} as Event, draginfo, dobj);

  expect(editor.context.rowpanes[1]).not.toEqual(paneBefore);
  expect((editor.toplevel as HTMLElement).contains(overlay)).toBe(false);
  expect(draginfo.thumbstatus).toBeNull();
});

// ===========================================================================
// Teardown / timers
// ===========================================================================

test("CellHandlesHoverTimeout: hides the move/fill handles that ShowCellHandles(true, true) had shown", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);

  SC.KeyboardSetFocus(editor);
  editor.MoveECell("A1");
  handlesOf(editor).ShowCellHandles(true, true);
  expect(handlesOf(editor).dragpalette.style.display).toBe("block");

  SC.CellHandlesHoverTimeout();

  expect(handlesOf(editor).dragpalette.style.display).toBe("none");
  expect(handlesOf(editor).dragtooltip.style.display).toBe("none");
  // CellHandlesHoverTimeout re-shows the plain drag handle (moveshow=false).
  expect(handlesOf(editor).draghandle.style.display).toBe("block");
});

test("CellHandlesHoverTimeout: a no-op when no editor has keyboard focus", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  ensureDocumentEvents();
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  editor.MoveECell("A1");
  handlesOf(editor).ShowCellHandles(true, true);
  expect(handlesOf(editor).dragpalette.style.display).toBe("block");

  SC.Keyboard.focusTable = null;
  SC.CellHandlesHoverTimeout();

  // Without focusTable, the handles are left exactly as they were.
  expect(handlesOf(editor).dragpalette.style.display).toBe("block");
  SC.Keyboard.focusTable = editor;
});

test("ShowCellHandles: skips a hidden column immediately right of ecell when positioning the drag handle", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  const editor = editorOf(control);
  const sheet = sheetOf(editor);
  ensureDocumentEvents();

  await scheduleCommands(SC, sheet, "set B hide yes");
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  editor.MoveECell("A1");
  handlesOf(editor).ShowCellHandles(true, false);
  const leftWithBHidden = handlesOf(editor).draghandle.style.left;

  await scheduleCommands(SC, sheet, "set B hide no");
  primeGridLayout(editor);
  editor.MoveECell("A1");
  handlesOf(editor).ShowCellHandles(true, false);
  const leftWithBVisible = handlesOf(editor).draghandle.style.left;

  // Hiding column B makes the handle skip straight to column C's edge,
  // landing further right than when B is visible.
  expect(leftWithBHidden).not.toBe(leftWithBVisible);
  expect(parseInt(leftWithBHidden, 10)).toBeGreaterThan(parseInt(leftWithBVisible, 10));
});
