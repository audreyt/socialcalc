import { afterAll, afterEach, expect, test } from "vite-plus/test";
import { loadSocialCalc as _loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

// Same timer-tracking rationale as editor-coverage-a/b/gaps-b: the InputEcho
// heartbeat, auto-repeat timers, hover timeouts and drag timers must be
// cancelled between tests to avoid firing against stale module state.
ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
});

afterAll(() => {
  restoreOriginalTimers();
});

// The built bundle is loaded at runtime—the SocialCalc namespace is declared
// in js/socialcalctableeditor.d.ts, so we cast the returned module to that type.
type SC = typeof SocialCalc;
type Editor = SocialCalc.TableEditor;
type Control = SocialCalc.SpreadsheetControl;

async function loadSocialCalc(): Promise<SC> {
  const mod = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  return mod as unknown as SC;
}

async function newControl(SC: SC, containerId = "egd-root") {
  const container = document.createElement("div");
  container.id = containerId;
  window.document.body.appendChild(container);
  const control = new SC.SpreadsheetControl() as unknown as Control;
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

/** Shim document.addEventListener/removeEventListener when the test-env's
 * document lacks them — SetMouseMoveUp/RemoveMouseMoveUp use them for the
 * capture phase and will throw without this stub. */
function ensureDocumentEvents() {
  const doc = window.document as unknown as {
    addEventListener?: unknown;
    removeEventListener?: unknown;
  };
  if (typeof doc.addEventListener !== "function") {
    doc.addEventListener = (() => {}) as typeof document.addEventListener;
  }
  if (typeof doc.removeEventListener !== "function") {
    doc.removeEventListener = (() => {}) as typeof document.removeEventListener;
  }
}

function teardownEditor(SC: SC, editor: Editor) {
  { if (editor?.inputEcho?.interval) {
    clearInterval(editor.inputEcho.interval);
    editor.inputEcho.interval = null;
  } }
  { if (SC.AutoRepeatInfo?.timer) {
    clearTimeout(SC.AutoRepeatInfo.timer);
    SC.AutoRepeatInfo.timer = null;
    SC.AutoRepeatInfo.mouseinfo = null;
  } }
  { if (SC.ButtonInfo?.timer) {
    clearTimeout(SC.ButtonInfo.timer);
    SC.ButtonInfo.timer = null;
  } }
  { if (SC.Keyboard) {
    SC.Keyboard.focusTable = null;
    SC.Keyboard.passThru = null;
  } }
  { if (editor) {
    editor.state = "start";
    if (editor.timeout) {
      clearTimeout(editor.timeout);
      editor.timeout = null;
    }
  } }
}

// A minimal event shape sufficient for the mouse/keyboard handlers under test.
type FakeEvent = {
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
  [key: string]: unknown;
};

function fakeEvent(extras: Partial<FakeEvent> = {}): FakeEvent {
  const target = extras.target ?? null;
  const ev: FakeEvent = {
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
  return ev;
}

function primeGridLayout(editor: Editor) {
  { editor.CalculateEditorPositions(); }
  editor.gridposition = editor.gridposition || { left: 0, top: 0 };
  editor.headposition = editor.headposition || { left: 30, top: 30 };
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
  editor.verticaltablecontrol =
    editor.verticaltablecontrol || ({ controlborder: 500 } as SocialCalc.TableControl);
  editor.horizontaltablecontrol =
    editor.horizontaltablecontrol || ({ controlborder: 500 } as SocialCalc.TableControl);
  (editor.verticaltablecontrol as SocialCalc.TableControl).controlborder = 500;
  (editor.horizontaltablecontrol as SocialCalc.TableControl).controlborder = 500;
  editor.griddiv = editor.griddiv || document.createElement("div");
  const vtc = editor.verticaltablecontrol as SocialCalc.TableControl;
  if (vtc.thumb) {
    vtc.thumb.style.top = "100px";
    vtc.thumb.style.left = "100px";
  }
  if (vtc.paneslider) {
    vtc.paneslider.style.top = "100px";
    vtc.paneslider.style.left = "100px";
  }
  const htc = editor.horizontaltablecontrol as SocialCalc.TableControl;
  if (htc.thumb) {
    htc.thumb.style.top = "100px";
    htc.thumb.style.left = "100px";
  }
  if (htc.paneslider) {
    htc.paneslider.style.top = "100px";
    htc.paneslider.style.left = "100px";
  }
}

// ---------------------------------------------------------------------------
// Gap cluster B1: ScrollTableDownOneRow cellskip with no rowspanned origin (8321-8323)
// ---------------------------------------------------------------------------

test("ScrollTableDownOneRow: cellskip pointing at a non-rowspanned origin — false branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stdr-no-span");
  const editor = control.editor;
  await scheduleCommands(SC, editor.context.sheetobj, ["set A2 value n 2", "set A3 value n 3"]);
  // rowspan stays undefined for A2 — we want the cellskip lookup to find a cell
  // where `cell.rowspan > 1` evaluates to false (NaN), covering 8322 alt1.
  editor.context.rowpanes = [{ first: 2, last: 7 }];
  editor.context.colpanes = [{ first: 1, last: 3 }];
  { // Update editor.fullgrid to match the new rowpane config so ScrollTableDownOneRow
  // can iterate tbody.childNodes by the rowpane (otherwise Stale tbody throws).
  editor.EditorRenderSheet(); }
  { editor.context.CalculateCellSkipData(); }
  // After ScrollTableDownOneRow decrements rowpanes[0].last (7→6), the bottom
  // row scan uses bottomrownum=6. Inject a cellskip+coordToCR pair mapping A6→A2
  // manually, so the code path enters the cellskip lookup branch and finds
  // cell A2 (defined) with rowspan undefined (NaN > 1 is false → alt1).
  (editor.context.cellskip as Record<string, string>)["A6"] = "A2";
  (editor.context.coordToCR as Record<string, unknown>)["A2"] = { row: 2, col: 1 };
  { SC.ScrollTableDownOneRow(editor); }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B2: InputBoxDisplayCellContents no-coord + no-editor + no-ecell (8385, 8386)
// ---------------------------------------------------------------------------

test("InputBoxDisplayCellContents: falsy coord falls through to editor/ecell fallback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ibdcc-no-coord");
  const editor = control.editor;

  // !inputbox → return
  { SC.InputBoxDisplayCellContents(null as unknown as SocialCalc.InputBox, "A1"); }

  // !coord + !inputbox.editor → return (covers bid=1603 alt0 + stmt 8386)
  const fakeInputBox = {
    editor: null as unknown as Editor,
    element: document.createElement("input"),
  } as unknown as SocialCalc.InputBox;
  { SC.InputBoxDisplayCellContents(fakeInputBox, null as unknown as string); }

  // !coord + editor set but !editor.ecell — return (covers !editor.ecell sanity path)
  const fakeInputBox2 = {
    editor: editor,
    element: document.createElement("input"),
  } as unknown as SocialCalc.InputBox;
  const savedEcell = editor.ecell;
  editor.ecell = null as unknown as SocialCalc.ECell;
  { SC.InputBoxDisplayCellContents(fakeInputBox2, null as unknown as string); }
  editor.ecell = savedEcell;

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B3: InputEcho style false-side branches (8455, 8461, 8469)
// ---------------------------------------------------------------------------

test("InputEcho: empty style constants skip setStyles branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ie-empty-styles");
  const editor = control.editor;
  const scc = SC.Constants;
  const saved: Record<string, unknown> = {};
  const keys = [
    "defaultInputEchoStyle",
    "defaultInputEchoHintStyle",
    "defaultInputEchoPromptStyle",
  ];
  for (const k of keys) {
    saved[k] = (scc as Record<string, unknown>)[k];
    (scc as Record<string, unknown>)[k] = "";
  }
  { const echo = new SC.InputEcho(editor);
  expect(echo).toBeTruthy(); }
  for (const k of keys) {
    (scc as Record<string, unknown>)[k] = saved[k];
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B4: ShowCellHandles horizontaltablecontrol.controlborder exceeded break (8625, 8626)
// ---------------------------------------------------------------------------

test("ShowCellHandles: rowpositions + 20 > controlborder — break branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sch-cb-exceed");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.MoveECell("B3");

  // The editor.rowpositions[row + rowinc] must exceed controlborder.
  // With B3, row=3, colinc=1, rowinc=1 (no hidden rows): rowpositions[4] = 90.
  // 90 + 20 = 110. controlborder=500 → no break. Lower controlborder to make it exceed.
  const htc = editor.horizontaltablecontrol as SocialCalc.TableControl;
  const vtc = editor.verticaltablecontrol as SocialCalc.TableControl;
  htc.controlborder = 100; // 110 > 100 → trigger break
  vtc.controlborder = 500;
  editor.headposition.top = 30;
  editor.headposition.left = 30;
  { SC.ShowCellHandles(editor.cellhandles as SocialCalc.CellHandles, true, false); }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B5: CellHandlesMouseMoveOnHandle target falsy / target != dragpalette (8661, 8674)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMoveOnHandle: target falsy + target != dragpalette", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmoh-target");
  const editor = control.editor;
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.mouseDown = false;
  SC.KeyboardSetFocus(editor);
  primeGridLayout(editor);

  // event.target falsy → event.target || event.srcElement evaluates srcElement (alt1)
  // event.srcElement also fallback null, target = null
  // Then target != cellhandles.dragpalette (which is a real element) → cover 8674 alt1
  { SC.CellHandlesMouseMoveOnHandle(fakeEvent() as unknown as MouseEvent); }

  // e = undefined → event || window.event alt1 of 8661 (window.event evaluated, may be undefined)
  (globalThis as any).event = fakeEvent();
  { SC.CellHandlesMouseMoveOnHandle(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B6: CellHandlesHoverTimeout no-editor (8780, 8781)
// ---------------------------------------------------------------------------

test("CellHandlesHoverTimeout: Keyboard.focusTable falsy returns true", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chht-noeditor");
  const editor = control.editor;
  SC.KeyboardSetFocus(editor);
  SC.Keyboard.focusTable = null;
  { const r = SC.CellHandlesHoverTimeout();
  expect(r).toBe(true); }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B7: CellHandlesMouseDown editor null + busy early returns (8793, 8796, 8797)
// ---------------------------------------------------------------------------

test("CellHandlesMouseDown: editor falsy + busy returns; e falsy fallback path", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmd-noeditor");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);

  // event falsy (e || window.event)
  (globalThis as any).event = fakeEvent({ clientX: 50, clientY: 50 });
  { SC.CellHandlesMouseDown(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // editor falsy (Keyboard.focusTable null)
  SC.Keyboard.focusTable = null;
  { SC.CellHandlesMouseDown(fakeEvent() as unknown as MouseEvent); }
  SC.KeyboardSetFocus(editor);

  // editor.busy truthy → return
  editor.busy = true;
  { SC.CellHandlesMouseDown(fakeEvent() as unknown as MouseEvent); }
  editor.busy = false;

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B8: CellHandlesMouseDown switch default + Move detection (8826, 8833, 8838, 8865)
// ---------------------------------------------------------------------------

test("CellHandlesMouseDown: whichhandle==4 and nonzero alts + switch default", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmd-switchalts");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  editor.MoveECell("C3");
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  editor.range = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 } as SocialCalc.EditorRange;

  // Mock SegmentDivHit to return 4 → triggers -? "MoveIC" case and noCursorSuffix=false
  const fakeDragpalette = (editor.cellhandles as SocialCalc.CellHandles).dragpalette as unknown as {
    offsetWidth: number;
    offsetHeight: number;
    offsetLeft: number;
    offsetTop: number;
  };
  fakeDragpalette.offsetWidth = 90;
  fakeDragpalette.offsetHeight = 90;
  fakeDragpalette.offsetLeft = 0;
  fakeDragpalette.offsetTop = 0;

  const origSDH = SC.SegmentDivHit;

  // whichhandle = 4 → MoveIC (covers stmt 8826-ish? actually need -2 for Move)
  (SC as Record<string, unknown>).SegmentDivHit = () => 4;
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.mouseDown = false;
  { SC.CellHandlesMouseDown(fakeEvent({ clientX: 50, clientY: 50 }) as unknown as MouseEvent); }

  // whichhandle = -2 → Move (covers stmt 8826 = noCursorSuffix = true)
  (SC as Record<string, unknown>).SegmentDivHit = () => -2;
  ch.mouseDown = false;
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  editor.range = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 } as SocialCalc.EditorRange;
  { SC.CellHandlesMouseDown(fakeEvent({ clientX: 50, clientY: 50 }) as unknown as MouseEvent); }

  // whichhandle = 5 (unmatched) → all if-else-if skip → switch default (alt6) — covers 8865 stmt
  (SC as Record<string, unknown>).SegmentDivHit = () => 5 as unknown as number;
  ch.mouseDown = false;
  // preset dragtype to a non-matching string so switch hits default
  (ch as Record<string, unknown>).dragtype = "abc";
  { SC.CellHandlesMouseDown(fakeEvent({ clientX: 50, clientY: 50 }) as unknown as MouseEvent); }

  (SC as Record<string, unknown>).SegmentDivHit = origSDH;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B9: CellHandlesMouseMove e falsy + no result + no coord (8889, 8900, 8901, 8907, 8908)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMove: e falsy fallback + no-result/no-coord returns", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmv-noresult");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  (editor.cellhandles as SocialCalc.CellHandles).startingcoord = "C3";

  // e falsy → e || window.event alt1
  (globalThis as any).event = fakeEvent({ clientX: 50, clientY: 90 });
  { SC.CellHandlesMouseMove(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // !result path → 8900 IF alt0 + stmt 8901. Mock GridMousePosition to return null.
  const origGMP = SC.GridMousePosition;
  (SC as Record<string, unknown>).GridMousePosition = () => null;
  SC.EditorMouseInfo.editor = editor;
  { SC.CellHandlesMouseMove(fakeEvent({ clientX: 50, clientY: 90 }) as unknown as MouseEvent); }

  // !result.coord path → 8907 IF alt0 + stmt 8908. result.coord truthy at the 8902
  // check, then falsy at the 8907 check. Use a Proxy-like getter that morphs on second
  // access (necessary because if !result.coord were true at 8902 we'd return early).
  let coordReads = 0;
  (SC as Record<string, unknown>).GridMousePosition = (() =>
    ({
      row: 3,
      col: 3,
      get coord() {
        coordReads++;
        return coordReads === 1 ? "C3" : null;
      },
    }) as unknown as SocialCalc.GridMousePositionResult) as typeof SocialCalc.GridMousePosition;
  { SC.CellHandlesMouseMove(fakeEvent({ clientX: 50, clientY: 90 }) as unknown as MouseEvent); }

  (SC as Record<string, unknown>).GridMousePosition = origGMP;

  // result && !result.coord early-return path (covers 8902 IF body returned)
  {
    const origGMP2 = SC.GridMousePosition;
    (SC as Record<string, unknown>).GridMousePosition = (() =>
      ({
        row: 3,
        col: 3,
        rowheader: true,
      }) as unknown as SocialCalc.GridMousePositionResult) as typeof SocialCalc.GridMousePosition;
    const ch = editor.cellhandles as SocialCalc.CellHandles;
    ch.dragtype = "Fill";
    ch.startingcoord = "C3";
    editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
    SC.EditorMouseInfo.mouselastcoord = "Z0";
    { SC.CellHandlesMouseMove(fakeEvent({ clientX: 50, clientY: 5 }) as unknown as MouseEvent); }
    (SC as Record<string, unknown>).GridMousePosition = origGMP2;
  }

  // !editor early return
  SC.EditorMouseInfo.editor = null;
  { SC.CellHandlesMouseMove(fakeEvent({ clientX: 9999, clientY: 9999 }) as unknown as MouseEvent); }
  SC.EditorMouseInfo.editor = editor;

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B10: CellHandlesMouseMove switch alt branches for Move+MoveI (8972, 8945)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMove: Move case coord-equal skip body (8945 alt1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmv-coordmatch");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("C3");
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.startingcoord = "C3";
  ch.startingX = 160;
  ch.startingY = 90;
  ch.dragtype = "Move";
  ch.filltype = null;
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  // Deterministic mocking so we know exact result.coord ("D4") and mouselastcoord value.
  const origGMP = SC.GridMousePosition;
  (SC as Record<string, unknown>).GridMousePosition = (() =>
    ({
      coord: "D4",
      row: 4,
      col: 4,
    }) as unknown as SocialCalc.GridMousePositionResult) as typeof SocialCalc.GridMousePosition;
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  // First call: sets mouselastcoord = "D4"
  { SC.CellHandlesMouseMove(fakeEvent({ clientX: 240, clientY: 110 }) as unknown as MouseEvent); }
  // Second call: result.coord == mouselastcoord → skip Move body (8945 alt1)
  { SC.CellHandlesMouseMove(fakeEvent({ clientX: 240, clientY: 110 }) as unknown as MouseEvent); }
  (SC as Record<string, unknown>).GridMousePosition = origGMP;

  teardownEditor(SC, editor);
});

test("CellHandlesMouseMove: Fill Right col-clamp + MoveI null-filltype deltas<=10", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmv-fillalts2");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("C3");
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.startingcoord = "C3";
  ch.startingX = 160;
  ch.startingY = 90;

  // Fill, Right, crend.col < crstart.col → CLAMP body — bid=1714 alt0 + stmt 8927
  // Use monkeypatched GridMousePosition so crend is deterministically {col:2,row:4}.
  const origGMP = SC.GridMousePosition;
  (SC as Record<string, unknown>).GridMousePosition = (() =>
    ({
      coord: "B4",
      row: 4,
      col: 2,
    }) as unknown as SocialCalc.GridMousePositionResult) as typeof SocialCalc.GridMousePosition;
  ch.dragtype = "Fill";
  ch.filltype = "Right";
  ch.startingcoord = "C3";
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  { SC.CellHandlesMouseMove(fakeEvent({ clientX: 80, clientY: 90 }) as unknown as MouseEvent); }
  (SC as Record<string, unknown>).GridMousePosition = origGMP;

  // MoveI, null filltype, both abs deltas <= 10 → bid=1727 alt1 (skip Horizontal-set)
  ch.dragtype = "MoveI";
  ch.filltype = null;
  ch.startingcoord = "C3";
  ch.startingX = 160;
  ch.startingY = 90;
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  // GridMousePosition returns "C4" (col=3, row=4); abs(165-160)=5, abs(95-90)=5, both <= 10
  { SC.CellHandlesMouseMove(fakeEvent({ clientX: 165, clientY: 95 }) as unknown as MouseEvent); }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B12: CellHandlesDragAutoRepeat direction unmatched + MoveI Vertical/Horizontal out-of-range (9016, 9057, 9061)
// ---------------------------------------------------------------------------

test("CellHandlesDragAutoRepeat: unmatched direction + MoveI Vertical/Horizontal out-of-range", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chdar-alts");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("C3");
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.startingcoord = "C3";

  // direction != left/right/up/down → 9016 alt1
  ch.dragtype = "Fill";
  ch.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "C3";
  { SC.CellHandlesDragAutoRepeat("C3", "backwards"); }

  // MoveI, Vertical, crend.row NOT in [top, bottom+1] → 9057 alt1 (no bump)
  ch.dragtype = "MoveI";
  ch.filltype = "Vertical";
  editor.range2 = { hasrange: true, top: 2, bottom: 4, left: 3, right: 4 };
  SC.EditorMouseInfo.mouselastcoord = "C3";
  { SC.CellHandlesDragAutoRepeat("C9", "down"); }

  // MoveI, Horizontal, crend.col NOT in [left, right+1] → 9061 alt1 (no bump)
  ch.dragtype = "MoveI";
  ch.filltype = "Horizontal";
  editor.range2 = { hasrange: true, top: 2, bottom: 4, left: 3, right: 4 };
  SC.EditorMouseInfo.mouselastcoord = "C3";
  { SC.CellHandlesDragAutoRepeat("J3", "right"); }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B13: CellHandlesMouseUp e falsy + no-result fallback (9084, 9100, 9101, 9102, 9103, 9128)
// ---------------------------------------------------------------------------

test("CellHandlesMouseUp: e falsy + result.falsy/coord.falsy + filltype null alt", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmu-falsy");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  const ch = editor.cellhandles as SocialCalc.CellHandles;

  // e falsy → 9084 alt1 (window.event evaluated)
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "Fill";
  ch.filltype = "Down";
  ch.startingcoord = "C3";
  editor.MoveECell("C3");
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  (globalThis as any).event = fakeEvent({ clientX: 160, clientY: 110 });
  { SC.CellHandlesMouseUp(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // !result → alt0 + stmt 9101 (result = {}) + 9102 alt0 + stmt 9103 (coord=editor.ecell.coord)
  // Mock GridMousePosition to return null
  const origGMP = SC.GridMousePosition;
  (SC as Record<string, unknown>).GridMousePosition = () => null;
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "Fill";
  ch.filltype = "Down";
  ch.startingcoord = "C3";
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  { SC.CellHandlesMouseUp(fakeEvent({ clientX: 160, clientY: 110 }) as unknown as MouseEvent); }

  // !result.coord → alt0 + stmt 9103
  (SC as Record<string, unknown>).GridMousePosition = () =>
    ({}) as unknown as SocialCalc.GridMousePositionResult;
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "Fill";
  ch.filltype = "Down";
  ch.startingcoord = "C3";
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  { SC.CellHandlesMouseUp(fakeEvent({ clientX: 160, clientY: 110 }) as unknown as MouseEvent); }

  (SC as Record<string, unknown>).GridMousePosition = origGMP;

  // Fill case with filltype=null → 9128 alt1
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "Fill";
  ch.filltype = null;
  ch.startingcoord = "C3";
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  { SC.CellHandlesMouseUp(fakeEvent({ clientX: 160, clientY: 110 }) as unknown as MouseEvent); }

  SC.EditorMouseInfo.ignore = false;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B14: DragMouseDown/Move/Up + ButtonMouse* e falsy alt paths (9729-9918)
// ---------------------------------------------------------------------------

test("Drag functions: e falsy · dragpalette no-parent · MouseMove/Up calling", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-falsy");
  const editor = control.editor;
  ensureDocumentEvents();
  const el = document.createElement("div");
  editor.toplevel.appendChild(el);

  // DragRegister WITHOUT parent → cover 9740 alt1 (dobj.parent falsy)
  SC.DragRegister(
    el,
    true,
    true,
    {} as SocialCalc.DragFunctionObject,
    undefined as unknown as HTMLElement,
  );

  // DragMouseDown with event undefined (e || window.event alt1 of 9729)
  (globalThis as any).event = fakeEvent({ target: el, clientX: 10, clientY: 10 });
  { SC.DragMouseDown(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // DragMouseDown with target=null (e.target || e.srcElement alt1 of 9731) — LookupElement returns null → early return
  { SC.DragMouseDown(fakeEvent() as unknown as MouseEvent); }

  // DragMouseDown with target=el → dobj found, no parent → 9740 alt1 covered
  { SC.DragMouseDown(fakeEvent({ target: el, clientX: 10, clientY: 10 }) as unknown as MouseEvent); }

  // DragMouseMove with event undefined (9757 alt1 of e || window.event)
  (globalThis as any).event = fakeEvent({ target: el, clientX: 20, clientY: 20 });
  { SC.DragMouseMove(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // DragMouseMove with target=null (sets draggingElement via the found dobj path)
  const foundDobj = SC.DragInfo.registeredElements[SC.DragInfo.registeredElements.length - 1];
  SC.DragInfo.draggingElement = foundDobj;
  { SC.DragMouseMove(fakeEvent({ clientX: 20, clientY: 20 }) as unknown as MouseEvent); }

  // DragMouseUp with event undefined (9768 alt1 of e || window.event)
  SC.DragInfo.draggingElement = foundDobj;
  (globalThis as any).event = fakeEvent({ target: el, clientX: 25, clientY: 25 });
  { SC.DragMouseUp(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // DragMouseUp with target=null and editable proper flow
  SC.DragInfo.draggingElement = foundDobj;
  { SC.DragMouseUp(fakeEvent({ clientX: 25, clientY: 25 }) as unknown as MouseEvent); }

  teardownEditor(SC, editor);
});

test("Button functions: event falsy alt paths + pre-defined state branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "btn-falsy");
  const editor = control.editor;
  ensureDocumentEvents();
  const b = document.createElement("div");
  editor.toplevel.appendChild(b);
  SC.ButtonRegister(
    editor,
    b,
    {
      name: "X",
      normalstyle: "a",
      hoverstyle: "h",
      downstyle: "d",
    } as SocialCalc.ButtonParamObject,
    {
      MouseOver: () => {},
      MouseOut: () => {},
      MouseDown: () => {},
      MouseUp: () => {},
      Repeat: () => {},
      Disabled: () => false,
    } as SocialCalc.ButtonFunctionObject,
  );
  const ourBtn = SC.ButtonInfo.registeredElements.find((r) => r.element === b) ?? null;

  // ButtonMouseOver with event undefined (9823 alt1 of e || window.event)
  SC.ButtonInfo.buttonDown = false;
  SC.ButtonInfo.doingHover = false;
  SC.ButtonInfo.buttonElement = null;
  (globalThis as any).event = fakeEvent({ target: b });
  { SC.ButtonMouseOver(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // ButtonMouseOver with target=null (9825 alt1 of e.target || e.srcElement)
  SC.ButtonInfo.buttonDown = false;
  SC.ButtonInfo.doingHover = false;
  { SC.ButtonMouseOver(fakeEvent() as unknown as MouseEvent); }

  // ButtonMouseOut with event undefined (9845 alt1 of e || window.event)
  SC.ButtonInfo.buttonDown = false;
  (globalThis as any).event = fakeEvent({ target: b });
  { SC.ButtonMouseOut(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // ButtonMouseOut with target=null (9851 alt1)
  SC.ButtonInfo.buttonDown = false;
  SC.ButtonInfo.doingHover = false;
  { SC.ButtonMouseOut(fakeEvent() as unknown as MouseEvent); }

  // ButtonMouseOut with buttonElement=null AND doingHover=true → 9853 alt1 of (buttoninfo.buttonElement)
  SC.ButtonInfo.buttonDown = false;
  SC.ButtonInfo.doingHover = true;
  SC.ButtonInfo.buttonElement = null;
  { SC.ButtonMouseOut(fakeEvent({ target: b }) as unknown as MouseEvent); }

  // ButtonMouseDown with event undefined (9863 alt1 of e || window.event)
  SC.ButtonInfo.buttonDown = false;
  (globalThis as any).event = fakeEvent({ target: b });
  { SC.ButtonMouseDown(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // ButtonMouseDown with target=null (9866 alt1)
  SC.ButtonInfo.buttonDown = false;
  { SC.ButtonMouseDown(fakeEvent() as unknown as MouseEvent); }

  // ButtonMouseUp with event undefined (9890 alt1)
  SC.ButtonInfo.buttonElement = ourBtn;
  (globalThis as any).event = fakeEvent({ target: b });
  { SC.ButtonMouseUp(undefined as unknown as MouseEvent); }
  delete (globalThis as any).event;

  // ButtonRepeat: bobj found, but Repeat fn null (9916 alt1)
  const btnNoRepeat = document.createElement("div");
  editor.toplevel.appendChild(btnNoRepeat);
  SC.ButtonRegister(
    editor,
    btnNoRepeat,
    {} as SocialCalc.ButtonParamObject,
    {} as SocialCalc.ButtonFunctionObject,
  );
  const bobjNoRepeat = SC.ButtonInfo.registeredElements.find((r) => r.element === btnNoRepeat);
  if (bobjNoRepeat) {
    SC.ButtonInfo.buttonElement = bobjNoRepeat;
    { SC.ButtonRepeat(); }
  }

  // ButtonRepeat: bobj with Repeat but no repeatinterval (9918 alt1: bobj.repeatinterval || 100)
  const btnRepeat = document.createElement("div");
  editor.toplevel.appendChild(btnRepeat);
  SC.ButtonRegister(
    editor,
    btnRepeat,
    {} as SocialCalc.ButtonParamObject,
    { Repeat: () => {} } as SocialCalc.ButtonFunctionObject,
  );
  const bobjRepeat = SC.ButtonInfo.registeredElements.find((r) => r.element === btnRepeat);
  if (bobjRepeat) {
    SC.ButtonInfo.buttonElement = bobjRepeat;
    { SC.ButtonRepeat(); }
    if (SC.ButtonInfo.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B15: ProcessMouseWheel event falsy / target falsy / preventDefault missing (9931, 9936, 9951)
// ---------------------------------------------------------------------------

test("ProcessMouseWheel: event undefined · target null · preventDefault missing", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pmw-falsy");
  const editor = control.editor;
  const parent = document.createElement("div");
  const child = document.createElement("div");
  parent.appendChild(child);
  editor.toplevel.appendChild(parent);
  SC.MouseWheelRegister(parent, {} as SocialCalc.MouseWheelFunctionObject);

  // event undefined → 9931 alt1 of e || window.event
  (globalThis as any).event = fakeEvent({ target: child, wheelDelta: 120 });
  { SC.ProcessMouseWheel(undefined as unknown as Event); }
  delete (globalThis as any).event;

  // target=null → 9936 alt1 of event.target || event.srcElement
  { SC.ProcessMouseWheel(fakeEvent() as unknown as Event); }

  // No preventDefault field on event → 9951 alt1 (if falsy)
  { SC.ProcessMouseWheel({
    target: child,
    wheelDelta: 120,
    detail: 100,
    returnValue: true,
  } as unknown as Event); }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B16: ProcessKeyDown/ProcessKeyPress event undefined (10087, 10122)
// ---------------------------------------------------------------------------

test("ProcessKeyDown: event undefined — e || window.event alt1", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pkd-undef");
  SC.KeyboardSetFocus(control.editor);
  (globalThis as any).event = fakeEvent({ which: 0, keyCode: 0 });
  { SC.ProcessKeyDown(undefined as unknown as KeyboardEvent); }
  delete (globalThis as any).event;
  teardownEditor(SC, control.editor);
});

test("ProcessKeyPress: event undefined — e || window.event alt1", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pkp-undef");
  SC.KeyboardSetFocus(control.editor);
  (globalThis as any).event = fakeEvent({ which: 0, keyCode: 0 });
  { SC.ProcessKeyPress(undefined as unknown as KeyboardEvent); }
  delete (globalThis as any).event;
  teardownEditor(SC, control.editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B17: CreateTableControl callback branches — Disabled/MouseDown/Repeat on paneslider/lessbutton/morebutton/thumb (9259, 9288, 9292, 9322, 9326, 9374)
// ---------------------------------------------------------------------------

test("CreateTableControl: register + invoke paneslider/lessbutton/morebutton/thumb callbacks", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctc-callbacks");
  const editor = control.editor;
  ensureDocumentEvents();
  primeGridLayout(editor);
  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  const hctrl = editor.horizontaltablecontrol as SocialCalc.TableControl;
  // Build the controls and register their internal callbacks
  { SC.CreateTableControl(vctrl); }
  { SC.CreateTableControl(hctrl); }

  // Vertical paneslider — DragMouseDown triggers Disabled (line 9259)
  editor.busy = false;
  { SC.DragMouseDown(
    fakeEvent({ target: vctrl.paneslider, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }

  // Vertical thumb — DragMouseDown triggers Disabled (line 9374)
  { SC.DragMouseDown(
    fakeEvent({ target: vctrl.thumb, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }

  // Vertical lessbutton — ButtonMouseDown triggers MouseDown (line 9287-9288)
  (SC.ButtonInfo as Record<string, unknown>).buttonDown = false;
  { SC.ButtonMouseDown(
    fakeEvent({ target: vctrl.lessbutton, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }

  // Vertical lessbutton — ButtonRepeat triggers Repeat (line 9291-9292). ButtonRepeat reads ButtonInfo.buttonElement.
  // editor.busy must be false so !busy=true → enter body. It may have been set true by
  // earlier ScrollRelative (which runs SchedulePositionCalculations → schedposcalc).
  editor.busy = false;
  const lessBtnReg = SC.ButtonInfo.registeredElements.find((r) => r.element === vctrl.lessbutton);
  if (lessBtnReg) {
    (SC.ButtonInfo as Record<string, unknown>).buttonElement = lessBtnReg;
    { SC.ButtonRepeat(); }
    if (SC.ButtonInfo.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  }

  // Vertical morebutton — ButtonMouseDown triggers MouseDown (line 9321-9322)
  editor.busy = false;
  (SC.ButtonInfo as Record<string, unknown>).buttonDown = false;
  { SC.ButtonMouseDown(
    fakeEvent({ target: vctrl.morebutton, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }

  // Vertical morebutton — ButtonRepeat triggers Repeat (line 9325-9326). Set busy=false so alt0 covers.
  editor.busy = false;
  const moreBtnReg = SC.ButtonInfo.registeredElements.find((r) => r.element === vctrl.morebutton);
  if (moreBtnReg) {
    (SC.ButtonInfo as Record<string, unknown>).buttonElement = moreBtnReg;
    { SC.ButtonRepeat(); }
    if (SC.ButtonInfo.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  }

  // Horizontal paneslider/thumb/lessbutton/morebutton — both vertical=false callback paths
  editor.busy = false;
  { SC.DragMouseDown(
    fakeEvent({ target: hctrl.paneslider, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }
  { SC.DragMouseDown(
    fakeEvent({ target: hctrl.thumb, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }
  (SC.ButtonInfo as Record<string, unknown>).buttonDown = false;
  editor.busy = false;
  { SC.ButtonMouseDown(
    fakeEvent({ target: hctrl.lessbutton, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }
  const hLess = SC.ButtonInfo.registeredElements.find((r) => r.element === hctrl.lessbutton);
  if (hLess) {
    editor.busy = false;
    (SC.ButtonInfo as Record<string, unknown>).buttonElement = hLess;
    { SC.ButtonRepeat(); }
    if (SC.ButtonInfo.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  }
  (SC.ButtonInfo as Record<string, unknown>).buttonDown = false;
  editor.busy = false;
  { SC.ButtonMouseDown(
    fakeEvent({ target: hctrl.morebutton, clientX: 10, clientY: 10 }) as unknown as MouseEvent,
  ); }
  const hMore = SC.ButtonInfo.registeredElements.find((r) => r.element === hctrl.morebutton);
  if (hMore) {
    editor.busy = false;
    (SC.ButtonInfo as Record<string, unknown>).buttonElement = hMore;
    { SC.ButtonRepeat(); }
    if (SC.ButtonInfo.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B18: ScrollAreaClick cond-expr alt1 (-1 page direction) (9397)
// ---------------------------------------------------------------------------

test("ScrollAreaClick: clickpos <= thumbpos → PageRelative(-1) alt1", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sac-cond");
  const editor = control.editor;
  primeGridLayout(editor);
  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  { SC.CreateTableControl(vctrl); }
  const btnInfo = SC.ButtonInfo;
  const scrollareaReg = btnInfo.registeredElements.find((r) => r.element === vctrl.scrollarea);
  if (scrollareaReg) {
    (vctrl as Record<string, unknown>).thumbpos = 1000000; // clickpos much less than thumbpos
    editor.busy = false;
    { SC.ScrollAreaClick(
      fakeEvent({ clientX: 10, clientY: 10 }) as unknown as MouseEvent,
      btnInfo,
      scrollareaReg,
    ); }
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B18b: TCpanesliderClass falsy path (9250 alt1)
// ---------------------------------------------------------------------------

test("CreateTableControl: TCpanesliderClass falsy skip paneslider.className set", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctc-paneslider-falsy");
  const editor = control.editor;
  primeGridLayout(editor);
  const scc = SC.Constants;
  const saved = (scc as Record<string, unknown>).TCpanesliderClass;
  (scc as Record<string, unknown>).TCpanesliderClass = "";
  { const vctrl = new SC.TableControl(editor, true, 400);
  SC.CreateTableControl(vctrl);
  editor.verticaltablecontrol = vctrl;
  // Also build a horizontal control so both branches of TClessbuttonClass/etc are exercised
  // (alt1 = empty — skipped). The vTCpanesliderClass is the only branch missing before this test.
  const hctrl = new SC.TableControl(editor, false, 400);
  SC.CreateTableControl(hctrl);
  editor.horizontaltablecontrol = hctrl; }
  (scc as Record<string, unknown>).TCpanesliderClass = saved;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B19: ComputeTableControlPositions throw (9445, 9446)
// ---------------------------------------------------------------------------

test("ComputeTableControlPositions: throws when gridposition or headposition falsy", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctcp-throw");
  const editor = control.editor;
  primeGridLayout(editor);
  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  const savedGP = editor.gridposition;
  editor.gridposition = null as unknown as { left: number; top: number };
  try {
    expect(() => SC.ComputeTableControlPositions(vctrl)).toThrow(
      "Can't compute table control positions before editor positions",
    );
  } finally {
    editor.gridposition = savedGP;
  }

  // Also test the headposition falsy path:
  const savedHP = editor.headposition;
  editor.gridposition = savedGP;
  editor.headposition = null as unknown as { left: number; top: number };
  try {
    expect(() => SC.ComputeTableControlPositions(vctrl)).toThrow(
      "Can't compute table control positions before editor positions",
    );
  } finally {
    editor.headposition = savedHP;
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B20: TCPSDragFunctionStart/Move fallback || alt paths (9480, 9491, 9529)
// ---------------------------------------------------------------------------

test("TCPSDragFunctionStart/Move: rowpositions/colpositions out-of-range alt1 fallback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tcps-fallback");
  const editor = control.editor;
  primeGridLayout(editor);
  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  (vctrl as Record<string, unknown>).morebuttonstart = 350;
  (vctrl as Record<string, unknown>).minscrollingpanesize = 30;
  (vctrl as Record<string, unknown>).sliderthickness = 8;
  const dobj: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.paneslider as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobj.functionobj as Record<string, unknown>).control = vctrl;
  // negative clientY forces Lookup to return null (value < rowpositions[0])
  const draginfo: Record<string, unknown> = {
    clientX: -10000,
    clientY: -10000,
    offsetX: 0,
    offsetY: 0,
  };
  { SC.TCPSDragFunctionStart({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj); }

  // For TCPSDragFunctionMove (line 9529 alt1) — same negative case
  { SC.TCPSDragFunctionMove({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj); }

  // Horizontal
  const hctrl = editor.horizontaltablecontrol as SocialCalc.TableControl;
  (hctrl as Record<string, unknown>).morebuttonstart = 350;
  (hctrl as Record<string, unknown>).minscrollingpanesize = 30;
  (hctrl as Record<string, unknown>).sliderthickness = 8;
  const dobjH: SocialCalc.DragRegisteredElement = {
    vertical: false,
    horizontal: true,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: hctrl.paneslider as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjH.functionobj as Record<string, unknown>).control = hctrl;
  const draginfoH: Record<string, unknown> = {
    clientX: -10000,
    clientY: -10000,
    offsetX: 0,
    offsetY: 0,
  };
  { SC.TCPSDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH); }
  { SC.TCPSDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH); }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B21: TCTDragFunctionStart class/style truthy + rowpreviewele handled (9578, 9580, 9602)
// ---------------------------------------------------------------------------

test("TCTDragFunctionStart: tracking-then-clear path + horizontal class/style truthy + RowSetStatus call", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tct-preset");
  const editor = control.editor;
  primeGridLayout(editor);
  const scc = SC.Constants;

  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  const dobjV: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjV.functionobj as Record<string, unknown>).control = vctrl;
  const draginfoV: Record<string, unknown> = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };

  // First call: no pre-existing thumbstatus
  { SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV); }

  // Second call: thumbstatus already set → covers 9578 alt1 (truth) and 9580 alt1 (rowpreviewele truthy)
  { SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV); }

  // TCTDragFunctionRowSetStatus — covers 9602 binary-expr alt1 by using firstscrollingrow not falsy
  { SC.TCTDragFunctionRowSetStatus(draginfoV as typeof SocialCalc.DragInfo, editor, 5); }

  // Horizontal TCTDragFunctionStart with style/class truthy const-overrides (covers truthy-side of conditional classes which istanbul sometimes splits)
  const saved: Record<string, unknown> = {};
  const clsK = ["TCTDFSthumbstatusvClass", "TCTDFSthumbstatushClass"];
  for (const k of clsK) {
    saved[k] = (scc as Record<string, unknown>)[k];
    (scc as Record<string, unknown>)[k] = "tct-" + k;
  }
  const hctrl = editor.horizontaltablecontrol as SocialCalc.TableControl;
  const dobjH: SocialCalc.DragRegisteredElement = {
    vertical: false,
    horizontal: true,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: hctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjH.functionobj as Record<string, unknown>).control = hctrl;
  const draginfoH: Record<string, unknown> = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
  { SC.TCTDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH); }
  for (const [k, v] of Object.entries(saved)) {
    (scc as Record<string, unknown>)[k] = v;
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster B22: SegmentDivHit quadrant 2 and 4 outside-radii (8708, 8720)
// ---------------------------------------------------------------------------

test("SegmentDivHit: quadrant 2 and 4 outside both radii — alt1 of 8708/8720", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sdh-q-alts");
  const editor = control.editor;
  const scc = SC.Constants;
  const palette = editor.cellhandles.dragpalette as unknown as {
    offsetWidth: number;
    offsetHeight: number;
    offsetLeft: number;
    offsetTop: number;
  };
  palette.offsetWidth = 100;
  palette.offsetHeight = 100;
  palette.offsetLeft = 0;
  palette.offsetTop = 0;

  // Save and shrink CH_radius2 so that corner-positions exceed outer radius - covers 8708/8720 alt1 (len > segtable[1])
  // Top-right (q2) → 8708 alt1
  const v2 = SC.SegmentDivHit([scc.CH_radius1, 1], editor.cellhandles.dragpalette, 95, 5);
  // Bottom-left (q4) → 8720 alt1
  const v4 = SC.SegmentDivHit([scc.CH_radius1, 1], editor.cellhandles.dragpalette, 5, 95);
  // Sanity: outside both radii should yield v=0 (no assignment)
  expect(v2).toBe(0);
  expect(v4).toBe(0);

  teardownEditor(SC, editor);
});
