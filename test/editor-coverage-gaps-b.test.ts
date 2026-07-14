import { afterAll, afterEach, expect, test } from "vite-plus/test";
import { loadSocialCalc as _loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

// Same timer-tracking rationale as editor-coverage-a/b: the InputEcho heartbeat
// and various auto-repeat timers must be cancelled between tests to avoid
// firing against stale module state.
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

async function newControl(SC: SC, containerId = "egb-root") {
  const container = document.createElement("div");
  container.id = containerId;
  window.document.body.appendChild(container);
  const control = new SC.SpreadsheetControl() as unknown as Control;
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

/** Shim document.addEventListener/removeEventListener when the test-env's
 * document lacks them — SetMouseMoveUp/RemoveMouseMoveUp use them for the
 * capture phase and will throw without this stub. Same pattern as
 * editor-coverage-a.ts's ensureDocumentEvents. */
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
  {
    if (editor?.inputEcho?.interval) {
      clearInterval(editor.inputEcho.interval);
      editor.inputEcho.interval = null;
    }
  }
  {
    if (SC.AutoRepeatInfo?.timer) {
      clearTimeout(SC.AutoRepeatInfo.timer);
      SC.AutoRepeatInfo.timer = null;
      SC.AutoRepeatInfo.mouseinfo = null;
    }
  }
  {
    if (SC.ButtonInfo?.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  }
  {
    if (SC.Keyboard) {
      SC.Keyboard.focusTable = null;
      SC.Keyboard.passThru = null;
    }
  }
  {
    if (editor) {
      editor.state = "start";
      if (editor.timeout) {
        clearTimeout(editor.timeout);
        editor.timeout = null;
      }
    }
  }
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
  {
    editor.CalculateEditorPositions();
  }
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
  // Set controlborder directly — CreateTableEditor already created these controls with
  // controlborder = null. Without this, GridMousePosition treats every position as a
  // colfooter/rowfooter (clientY >= null = true), never returning a coord.
  (editor.verticaltablecontrol as SocialCalc.TableControl).controlborder = 500;
  (editor.horizontaltablecontrol as SocialCalc.TableControl).controlborder = 500;
  editor.griddiv = editor.griddiv || document.createElement("div");
  // DragFunctionStart reads parseInt(style.top/left) — populate so offsetY/X are valid numbers, not NaN.
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
// Gap cluster 1: ScrollTableUpOneRow rowspan refresh (8246-8255)
// ---------------------------------------------------------------------------

test("ScrollTableUpOneRow: rowspan cell straddling pane boundary triggers refresh loop", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stuor-span");
  const editor = control.editor;
  await scheduleCommands(SC, editor.context.sheetobj, ["set A2 value n 2", "set A8 value n 8"]);
  const cell = editor.context.sheetobj.cells["A2"];
  if (cell) cell.rowspan = 5;
  editor.context.rowpanes = [{ first: 2, last: 7 }];
  editor.context.colpanes = [{ first: 1, last: 3 }];
  editor.context.CalculateCellSkipData();
  {
    editor.context.RenderSheet(null, editor.context.defaultHTMLlinkstyle);
  }
  {
    SC.ScrollTableUpOneRow(editor);
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 2: ScrollTableDownOneRow rowspan refresh rows (8290-8330)
// ---------------------------------------------------------------------------

test("ScrollTableDownOneRow: bottom rowspan cell + cellskip refresh loop", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stdr-bottom-span");
  const editor = control.editor;
  await scheduleCommands(SC, editor.context.sheetobj, ["set A3 value n 3", "set A7 value n 7"]);
  const a3 = editor.context.sheetobj.cells["A3"];
  if (a3) a3.rowspan = 5;
  const a7 = editor.context.sheetobj.cells["A7"];
  if (a7) a7.rowspan = 3;
  editor.context.rowpanes = [{ first: 2, last: 7 }];
  editor.context.colpanes = [{ first: 1, last: 3 }];
  editor.context.CalculateCellSkipData();
  {
    editor.context.RenderSheet(null, editor.context.defaultHTMLlinkstyle);
  }
  {
    SC.ScrollTableDownOneRow(editor);
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 3: InputBox.SetText / Select / DisplayCellContents (8357-8398)
// ---------------------------------------------------------------------------

test("InputBox: TextSet/Select/DisplayCellContents falsy-element + multiline branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ib-falsy");
  const editor = control.editor;

  // TextSet with no element → early return.
  const savedEl = editor.inputBox.element;
  editor.inputBox.element = null as unknown as HTMLElement;
  editor.inputBox.SetText("hello");
  editor.inputBox.Select("end");
  editor.inputBox.element = savedEl;

  // DisplayCellContents with no inputbox → return.
  SC.InputBoxDisplayCellContents(null as unknown as SocialCalc.InputBox, "A1");

  // DisplayCellContents with no coord and no ecell → return.
  const savedEcell = editor.ecell;
  editor.ecell = null;
  SC.InputBoxDisplayCellContents(editor.inputBox, undefined);
  editor.ecell = savedEcell;

  // DisplayCellContents: multiline text → disabled.
  const sheet = editor.context.sheetobj;
  sheet.cells["A1"] = sheet.cells["A1"] || new SC.Cell("A1");
  (sheet.cells["A1"] as SocialCalc.Cell).datavalue = "line1\nline2";
  (sheet.cells["A1"] as SocialCalc.Cell).datatype = "t";
  editor.inputBox.element.disabled = false;
  SC.InputBoxDisplayCellContents(editor.inputBox, "A1");
  expect(editor.inputBox.element.disabled).toBe(true);

  // DisplayCellContents: ECellReadonly → disabled.
  sheet.cells["A2"] = sheet.cells["A2"] || new SC.Cell("A2");
  (sheet.cells["A2"] as SocialCalc.Cell).datavalue = "hello";
  (sheet.cells["A2"] as SocialCalc.Cell).datatype = "t";
  const origReadonly = editor.ECellReadonly;
  editor.ECellReadonly = (() => true) as typeof editor.ECellReadonly;
  editor.MoveECell("A2");
  SC.InputBoxDisplayCellContents(editor.inputBox, "A2");
  expect(editor.inputBox.element.disabled).toBe(true);
  editor.ECellReadonly = origReadonly;

  // DisplayCellContents: normal text → not disabled.
  editor.MoveECell("A2");
  (sheet.cells["A2"] as SocialCalc.Cell).datavalue = "plain text";
  editor.ECellReadonly = (() => false) as typeof editor.ECellReadonly;
  SC.InputBoxDisplayCellContents(editor.inputBox, "A2");
  expect(editor.inputBox.element.disabled).toBe(false);
  editor.ECellReadonly = origReadonly;

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 4: InputEcho constructor - style class + style branches (8453-8470)
// ---------------------------------------------------------------------------

test("InputEcho: constructor applies default class + style branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ie-ctor");
  const editor = control.editor;
  expect(editor.inputEcho).toBeTruthy();
  expect(editor.inputEcho.container).toBeTruthy();
  expect(editor.inputEcho.main).toBeTruthy();
  expect(editor.inputEcho.hint).toBeTruthy();
  expect(editor.inputEcho.prompt).toBeTruthy();

  const scc = SC.Constants;
  const saved: Record<string, unknown> = {};
  const keys = [
    "defaultInputEchoClass",
    "defaultInputEchoStyle",
    "defaultInputEchoHintClass",
    "defaultInputEchoHintStyle",
    "defaultInputEchoPromptClass",
    "defaultInputEchoPromptStyle",
    "defaultInputEchoFunctionboxClass",
    "defaultInputEchoFunctionboxStyle",
  ];
  for (const k of keys) {
    saved[k] = scc[k as keyof typeof scc];
    (scc as Record<string, unknown>)[k] = "echo-" + k;
  }
  {
    const echo = new SC.InputEcho(editor);
    expect(echo.main.className).toBe("echo-defaultInputEchoClass");
    expect(echo.hint.className).toBe("echo-defaultInputEchoHintClass");
    expect(echo.prompt.className).toBe("echo-defaultInputEchoPromptClass");
  }
  for (const k of keys) {
    (scc as Record<string, unknown>)[k] = saved[k];
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 5: ShowCellHandles do/while boundary-break branches (8619-8675)
// ---------------------------------------------------------------------------

test("ShowCellHandles: boundary-break branches (controlborder/headposition)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sch-bb");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.MoveECell("B2");

  // horizontaltablecontrol.controlborder exceeded → break
  const htc = editor.horizontaltablecontrol as SocialCalc.TableControl;
  htc.controlborder = 100;
  {
    SC.ShowCellHandles(editor.cellhandles as SocialCalc.CellHandles, true, false);
  }

  // headposition.top exceeded → break
  htc.controlborder = 500;
  editor.headposition.top = 200;
  {
    SC.ShowCellHandles(editor.cellhandles as SocialCalc.CellHandles, true, false);
  }
  editor.headposition.top = 30;

  // verticaltablecontrol.controlborder exceeded → break
  const vtc = editor.verticaltablecontrol as SocialCalc.TableControl;
  vtc.controlborder = 100;
  {
    SC.ShowCellHandles(editor.cellhandles as SocialCalc.CellHandles, true, false);
  }
  vtc.controlborder = 500;

  // headposition.left exceeded → break
  editor.headposition.left = 200;
  {
    SC.ShowCellHandles(editor.cellhandles as SocialCalc.CellHandles, true, false);
  }
  editor.headposition.left = 30;

  // doshow=true path with moveshow=true
  vtc.controlborder = 500;
  htc.controlborder = 500;
  {
    SC.ShowCellHandles(editor.cellhandles as SocialCalc.CellHandles, true, true);
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 6: CellHandlesMouseMoveOnHandle (8661-8686)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMoveOnHandle: editor null / no cellhandles.editor / palette hit + hover timeout", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmoh-root");
  const editor = control.editor;
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.mouseDown = false;
  const fakeDragpalette1 = ch.dragpalette as unknown as {
    offsetWidth: number;
    offsetHeight: number;
    offsetLeft: number;
    offsetTop: number;
  };
  fakeDragpalette1.offsetWidth = 90;
  fakeDragpalette1.offsetHeight = 90;
  fakeDragpalette1.offsetLeft = 10;
  fakeDragpalette1.offsetTop = 10;
  SC.KeyboardSetFocus(editor);

  // whichhandle==0 (outside radius)
  {
    SC.CellHandlesMouseMoveOnHandle(
      fakeEvent({
        target: ch.dragpalette,
        clientX: 5,
        clientY: 5,
      }) as unknown as MouseEvent,
    );
  }

  // whichhandle!=0 → clear timer + set new timer
  ch.timer = null;
  {
    SC.CellHandlesMouseMoveOnHandle(
      fakeEvent({
        target: ch.dragpalette,
        clientX: 55,
        clientY: 55,
      }) as unknown as MouseEvent,
    );
  }

  // mouseDown=true path
  ch.mouseDown = true;
  {
    SC.CellHandlesMouseMoveOnHandle(
      fakeEvent({ target: ch.main, clientX: 50, clientY: 50 }) as unknown as MouseEvent,
    );
  }

  // cellhandles.editor falsy → return
  const savedChEditor = ch.editor;
  ch.editor = null as unknown as SocialCalc.TableEditor;
  SC.KeyboardSetFocus(editor);
  {
    SC.CellHandlesMouseMoveOnHandle(fakeEvent() as unknown as MouseEvent);
  }
  ch.editor = savedChEditor;

  // Keyboard.focusTable null → return
  SC.Keyboard.focusTable = null;
  {
    SC.CellHandlesMouseMoveOnHandle(fakeEvent() as unknown as MouseEvent);
  }
  SC.KeyboardSetFocus(editor);

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 7: CellHandlesMouseDown whichhandle==0 early return (8813-8816)
// ---------------------------------------------------------------------------

test("CellHandlesMouseDown: whichhandle 0/1/-1 early return paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmd-zero");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  const fakeDragpalette2 = ch.dragpalette as unknown as {
    offsetWidth: number;
    offsetHeight: number;
    offsetLeft: number;
    offsetTop: number;
  };
  fakeDragpalette2.offsetWidth = 90;
  fakeDragpalette2.offsetHeight = 90;
  fakeDragpalette2.offsetLeft = 0;
  fakeDragpalette2.offsetTop = 0;
  editor.MoveECell("B2");

  // whichhandle=0
  ch.mouseDown = false;
  {
    SC.CellHandlesMouseDown(
      fakeEvent({ target: ch.dragpalette, clientX: 500, clientY: 500 }) as unknown as MouseEvent,
    );
  }

  // whichhandle=1 (center → outer radius)
  ch.mouseDown = false;
  {
    SC.CellHandlesMouseDown(
      fakeEvent({ target: ch.dragpalette, clientX: 50, clientY: 50 }) as unknown as MouseEvent,
    );
  }

  // whichhandle=-1 (center → inner radius)
  ch.mouseDown = false;
  {
    SC.CellHandlesMouseDown(
      fakeEvent({ target: ch.dragpalette, clientX: 45, clientY: 45 }) as unknown as MouseEvent,
    );
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 8: CellHandlesMouseMove no result / no coord (8892-8908)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMove: no-editor / no-result / no-coord auto-repeat branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmv-nocoord");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  (editor.cellhandles as SocialCalc.CellHandles).startingcoord = "B2";

  // !result path
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 9999, clientY: 9999 }) as unknown as MouseEvent);
  }

  // result && !result.coord: hit a header area
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.dragtype = "Fill";
  editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 50, clientY: 15 }) as unknown as MouseEvent);
  }

  // !editor early return
  SC.EditorMouseInfo.editor = null;
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 9999, clientY: 9999 }) as unknown as MouseEvent);
  }
  SC.EditorMouseInfo.editor = editor;

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 9: CellHandlesMouseMove Fill filltype branches (8919-8942)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMove: Fill/Move/MoveI filltype clamp + direction branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmv-fill");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("C4");
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.startingcoord = "C4";
  ch.startingX = 160;
  ch.startingY = 90;
  editor.range2 = { hasrange: true, top: 4, bottom: 4, left: 3, right: 3 };
  const originalGridMousePosition = SC.GridMousePosition;
  const positions = [
    { coord: "B2", row: 2, col: 2 },
    { coord: "A4", row: 4, col: 1 },
    { coord: "C5", row: 5, col: 3 },
    { coord: "D4", row: 4, col: 4 },
    { coord: "C3", row: 3, col: 3 },
    { coord: "D3", row: 3, col: 4 },
    { coord: "D5", row: 5, col: 4 },
  ];
  SC.GridMousePosition = () => positions.shift() as unknown as SocialCalc.GridMousePositionResult;
  const anchors: Array<string | undefined> = [];
  editor.RangeAnchor = (coord?: string) => {
    anchors.push(coord);
  };
  editor.RangeExtend = () => {};

  // Fill, Down, crend.row < crstart.row → clamp
  ch.dragtype = "Fill";
  ch.filltype = "Down";
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 160, clientY: 50 }) as unknown as MouseEvent);
  }

  // Fill, Right, crend.col < crstart.col → clamp
  ch.filltype = "Right";
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 80, clientY: 90 }) as unknown as MouseEvent);
  }

  // Fill, null, abs(clientY)>10 → Down
  ch.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 160, clientY: 130 }) as unknown as MouseEvent);
  }

  // Fill, null, abs(clientX)>10 → Right
  ch.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 240, clientY: 90 }) as unknown as MouseEvent);
  }

  // MoveI, Vertical, crend in range → bump
  ch.dragtype = "MoveI";
  ch.filltype = "Vertical";
  editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 3, right: 4 };
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 160, clientY: 70 }) as unknown as MouseEvent);
  }

  // MoveI, Horizontal, crend in range → bump
  ch.filltype = "Horizontal";
  editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 3, right: 4 };
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 240, clientY: 90 }) as unknown as MouseEvent);
  }

  // Move, new coord → MoveECell + RangeExtend
  ch.dragtype = "Move";
  ch.filltype = null;
  editor.range2 = { hasrange: true, top: 4, bottom: 4, left: 3, right: 3 };
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 240, clientY: 110 }) as unknown as MouseEvent);
  }
  expect(editor.ecell.coord).toBe("D5");
  expect(positions).toHaveLength(0);
  expect(anchors.at(-1)).toBe("D5");
  SC.GridMousePosition = originalGridMousePosition;

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 10: CellHandlesDragAutoRepeat branches (9010-9078)
// ---------------------------------------------------------------------------

test("CellHandlesDragAutoRepeat: Fill clamp + Move/MoveI direction branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chdar-clamp");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("C4");
  const ch = editor.cellhandles as SocialCalc.CellHandles;
  ch.startingcoord = "C4";
  editor.range2 = { hasrange: true, top: 4, bottom: 4, left: 3, right: 3 };

  // Fill, Down, crend.row < crstart.row → clamp
  ch.dragtype = "Fill";
  ch.filltype = "Down";
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesDragAutoRepeat("C1", "down");
  }

  // Fill, Right, crend.col < crstart.col → clamp
  ch.filltype = "Right";
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesDragAutoRepeat("A4", "right");
  }

  // Fill, null
  ch.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesDragAutoRepeat("C4", "down");
  }

  // Fill, newcoord != mouselastcoord
  SC.EditorMouseInfo.mouselastcoord = "C4";
  ch.filltype = null;
  {
    SC.CellHandlesDragAutoRepeat("C5", "down");
  }

  // Move, coord != mouselastcoord
  ch.dragtype = "Move";
  SC.EditorMouseInfo.mouselastcoord = "Z0";
  {
    SC.CellHandlesDragAutoRepeat("C5", "up");
  }

  // MoveC, coord == mouselastcoord
  ch.dragtype = "MoveC";
  SC.EditorMouseInfo.mouselastcoord = "C4";
  {
    SC.CellHandlesDragAutoRepeat("C4", "right");
  }

  // MoveI, Vertical, crend.row in range → bump
  ch.dragtype = "MoveI";
  ch.filltype = "Vertical";
  editor.range2 = { hasrange: true, top: 2, bottom: 4, left: 3, right: 4 };
  SC.EditorMouseInfo.mouselastcoord = "C4";
  {
    SC.CellHandlesDragAutoRepeat("C3", "left");
  }

  // MoveIC, Horizontal, crend.col in range → bump
  ch.dragtype = "MoveIC";
  ch.filltype = "Horizontal";
  editor.range2 = { hasrange: true, top: 2, bottom: 4, left: 3, right: 4 };
  SC.EditorMouseInfo.mouselastcoord = "C4";
  {
    SC.CellHandlesDragAutoRepeat("D4", "left");
  }

  // MoveI, null
  ch.dragtype = "MoveI";
  ch.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "C4";
  {
    SC.CellHandlesDragAutoRepeat("C5", "left");
  }

  // MoveIC, newcoord != mouselastcoord
  ch.dragtype = "MoveIC";
  ch.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "A0";
  {
    SC.CellHandlesDragAutoRepeat("C5", "left");
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 11: CellHandlesMouseUp Fill filltype Down/Right + Nothing (9096-9128)
// ---------------------------------------------------------------------------

test("CellHandlesMouseUp: Fill Down/Right + Nothing + result-fallback branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chmu-fill");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  const ch = editor.cellhandles as SocialCalc.CellHandles;

  // Fill, movedmouse=true, filltype=Down
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "Fill";
  ch.filltype = "Down";
  ch.startingcoord = "C3";
  editor.MoveECell("C3");
  editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
  {
    SC.CellHandlesMouseUp(fakeEvent({ clientX: 160, clientY: 110 }) as unknown as MouseEvent);
  }

  // Fill, movedmouse=true, filltype=Right
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "Fill";
  ch.filltype = "Right";
  ch.startingcoord = "C3";
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  {
    SC.CellHandlesMouseUp(fakeEvent({ clientX: 240, clientY: 90 }) as unknown as MouseEvent);
  }

  // Nothing (movedmouse=false)
  ch.mouseDown = true;
  ch.movedmouse = false;
  ch.dragtype = "Fill";
  ch.filltype = "Down";
  ch.startingcoord = "C3";
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  {
    SC.CellHandlesMouseUp(fakeEvent({ clientX: 160, clientY: 90 }) as unknown as MouseEvent);
  }

  // Move with movedmouse=true
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "Move";
  ch.filltype = null;
  ch.startingcoord = "C3";
  editor.range2 = { hasrange: true, top: 3, bottom: 4, left: 3, right: 4 };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  {
    SC.CellHandlesMouseUp(fakeEvent({ clientX: 240, clientY: 110 }) as unknown as MouseEvent);
  }

  // MoveI with movedmouse=true
  ch.mouseDown = true;
  ch.movedmouse = true;
  ch.dragtype = "MoveI";
  ch.filltype = null;
  ch.startingcoord = "C3";
  editor.range2 = { hasrange: true, top: 3, bottom: 4, left: 3, right: 4 };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  {
    SC.CellHandlesMouseUp(fakeEvent({ clientX: 240, clientY: 110 }) as unknown as MouseEvent);
  }

  SC.EditorMouseInfo.ignore = false;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 12: CreateTableControl class/style conditional branches (9225-9368)
// ---------------------------------------------------------------------------

test("CreateTableControl: all class/style conditional branches via constants", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctc-classes");
  const editor = control.editor;
  const scc = SC.Constants;
  const saved: Record<string, unknown> = {};
  const classKeys = [
    "TCmainClass",
    "TCendcapClass",
    "TCpanesliderClass",
    "TClessbuttonClass",
    "TCmorebuttonClass",
    "TCscrollareaClass",
    "TCthumbClass",
  ];
  for (const k of classKeys) {
    saved[k] = scc[k as keyof typeof scc];
    (scc as Record<string, unknown>)[k] = "tc-" + k;
  }
  {
    const vctrl = new SC.TableControl(editor, true, 400);
    SC.CreateTableControl(vctrl);
    editor.verticaltablecontrol = vctrl;
  }
  {
    const hctrl = new SC.TableControl(editor, false, 400);
    SC.CreateTableControl(hctrl);
    editor.horizontaltablecontrol = hctrl;
  }
  for (const k of classKeys) {
    (scc as Record<string, unknown>)[k] = saved[k];
  }
  teardownEditor(SC, editor);
});

test("CreateTableControl: TCPStrackinglineClass via TCPSDragFunctionStart", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tcps-class");
  const editor = control.editor;
  primeGridLayout(editor);
  const scc = SC.Constants;
  const savedClass = scc.TCPStrackinglineClass;
  const savedStyle = scc.TCPStrackinglineStyle;
  (scc as Record<string, unknown>).TCPStrackinglineClass = "tcpstl";
  (scc as Record<string, unknown>).TCPStrackinglineStyle = "border:1px solid blue;";
  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  const dobj: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.paneslider as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  // The functionobj.control ref is what TCPS uses
  (dobj.functionobj as Record<string, unknown>).control = vctrl;
  const draginfo: Record<string, unknown> = { clientX: 100, clientY: 100, offsetX: 0, offsetY: 0 };
  {
    SC.TCPSDragFunctionStart({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  const hctrl = editor.horizontaltablecontrol as SocialCalc.TableControl;
  const dobjH: SocialCalc.DragRegisteredElement = {
    vertical: false,
    horizontal: true,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: hctrl.paneslider as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjH.functionobj as Record<string, unknown>).control = hctrl;
  const draginfoH: Record<string, unknown> = { clientX: 100, clientY: 100, offsetX: 0, offsetY: 0 };
  {
    SC.TCPSDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (scc as Record<string, unknown>).TCPStrackinglineClass = savedClass;
  (scc as Record<string, unknown>).TCPStrackinglineStyle = savedStyle;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 13: TCPSDragFunctionMove vertical/horizontal clamp branches (9506-9530)
// ---------------------------------------------------------------------------

test("TCPSDragFunctionMove: vertical + horizontal clamp branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tcpsm-clamp");
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
  const draginfo: Record<string, unknown> = { clientX: 100, clientY: 100, offsetX: 5, offsetY: 10 };
  {
    SC.TCPSDragFunctionStart({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }

  // clientY > max
  (draginfo as Record<string, unknown>).clientY = 999;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  // clientY < min
  (draginfo as Record<string, unknown>).clientY = -999;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  // normal
  (draginfo as Record<string, unknown>).clientY = 150;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }

  // hidden row skip
  (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[150] = "yes";
  (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[151] = "yes";
  (draginfo as Record<string, unknown>).clientY = 148;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  delete (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[150];
  delete (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[151];

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
    clientX: 100,
    clientY: 100,
    offsetX: 5,
    offsetY: 10,
  };
  {
    SC.TCPSDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = 999;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = -999;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = 150;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }

  // hidden col skip
  (editor.context.sheetobj.colattribs.hide as Record<string, string>)["D"] = "yes";
  (editor.context.sheetobj.colattribs.hide as Record<string, string>)["E"] = "yes";
  (draginfoH as Record<string, unknown>).clientX = 148;
  {
    SC.TCPSDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  delete (editor.context.sheetobj.colattribs.hide as Record<string, string>)["D"];
  delete (editor.context.sheetobj.colattribs.hide as Record<string, string>)["E"];

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 14: TCPSDragFunctionStop clamp + hide skip (9538-9565)
// ---------------------------------------------------------------------------

test("TCPSDragFunctionStop: vertical + horizontal clamp + hide-skip branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tcpss-clamp");
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
  const draginfo: Record<string, unknown> = { clientX: 100, clientY: 100, offsetX: 5, offsetY: 10 };
  {
    SC.TCPSDragFunctionStart({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }

  (draginfo as Record<string, unknown>).clientY = 999;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  (draginfo as Record<string, unknown>).clientY = -999;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  (draginfo as Record<string, unknown>).clientY = 300;
  editor.context.sheetobj.attribs.lastrow = 3;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  editor.context.sheetobj.attribs.lastrow = 100;
  (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[10] = "yes";
  (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[11] = "yes";
  (draginfo as Record<string, unknown>).clientY = 100;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  delete (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[10];
  delete (editor.context.sheetobj.rowattribs.hide as Record<string, string>)[11];

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
    clientX: 100,
    clientY: 100,
    offsetX: 5,
    offsetY: 10,
  };
  {
    SC.TCPSDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = 999;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = -999;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = 300;
  editor.context.sheetobj.attribs.lastcol = 3;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  editor.context.sheetobj.attribs.lastcol = 100;
  (editor.context.sheetobj.colattribs.hide as Record<string, string>)["D"] = "yes";
  (editor.context.sheetobj.colattribs.hide as Record<string, string>)["E"] = "yes";
  (draginfoH as Record<string, unknown>).clientX = 100;
  {
    SC.TCPSDragFunctionStop({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  delete (editor.context.sheetobj.colattribs.hide as Record<string, string>)["D"];
  delete (editor.context.sheetobj.colattribs.hide as Record<string, string>)["E"];

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 15: TCTDragFunctionStart class/style (9585-9610)
// ---------------------------------------------------------------------------

test("TCTDragFunctionStart: v+h class/style + rowpreviewele branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tct-vh");
  const editor = control.editor;
  primeGridLayout(editor);
  const scc = SC.Constants;
  const saved: Record<string, unknown> = {};
  const clsKeys = [
    "TCTDFSthumbstatusvClass",
    "TCTDFSthumbstatushClass",
    "TCTDFSthumbstatusvStyle",
    "TCTDFSthumbstatushStyle",
  ];
  for (const k of clsKeys) {
    saved[k] = scc[k as keyof typeof scc];
    (scc as Record<string, unknown>)[k] = "tct-" + k;
  }
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
  {
    SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
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
  {
    SC.TCTDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }

  for (const [k, v] of Object.entries(saved)) {
    (scc as Record<string, unknown>)[k] = v;
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 16: TCTDragFunctionMove (9627-9656)
// ---------------------------------------------------------------------------

test("TCTDragFunctionMove: vertical+horizontal clamp + first-calc branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tctm-clamp");
  const editor = control.editor;
  primeGridLayout(editor);

  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  vctrl.scrollareaend = 1000;
  vctrl.scrollareastart = 100;
  vctrl.scrollareasize = 900;
  vctrl.thumbthickness = 20;
  vctrl.controlborder = 1500;
  const dobjV: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjV.functionobj as Record<string, unknown>).control = vctrl;
  const draginfoV: Record<string, unknown> = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
  {
    SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }

  // clamp high
  (draginfoV as Record<string, unknown>).clientY = 9999;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  // clamp low
  (draginfoV as Record<string, unknown>).clientY = -9999;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  // first <= lastnonscrollingrow (lastrow < lastnonscrollingrow makes difference negative → first low)
  (draginfoV as Record<string, unknown>).clientY = 990;
  (draginfoV as Record<string, unknown>).thumbrowshown = -1;
  editor.lastnonscrollingrow = 10;
  editor.context.sheetobj.attribs.lastrow = 5;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  editor.lastnonscrollingrow = 0;
  // first > lastrow (lastrow small, lastnonscrollingrow = 0)
  (draginfoV as Record<string, unknown>).clientY = 1050;
  (draginfoV as Record<string, unknown>).thumbrowshown = -1;
  editor.context.sheetobj.attribs.lastrow = 5;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  editor.context.sheetobj.attribs.lastrow = 100;
  // normal: first != thumbrowshown
  (draginfoV as Record<string, unknown>).clientY = 500;
  (draginfoV as Record<string, unknown>).thumbrowshown = -1;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  // first == thumbrowshown → skip
  (draginfoV as Record<string, unknown>).thumbrowshown = 0;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }

  // Horizontal
  const hctrl = editor.horizontaltablecontrol as SocialCalc.TableControl;
  hctrl.scrollareaend = 1000;
  hctrl.scrollareastart = 100;
  hctrl.scrollareasize = 900;
  hctrl.thumbthickness = 20;
  hctrl.controlborder = 1500;
  const dobjH: SocialCalc.DragRegisteredElement = {
    vertical: false,
    horizontal: true,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: hctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjH.functionobj as Record<string, unknown>).control = hctrl;
  const draginfoH: Record<string, unknown> = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
  {
    SC.TCTDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = 9999;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  (draginfoH as Record<string, unknown>).clientX = -9999;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  // first <= lastnonscrollingcol
  (draginfoH as Record<string, unknown>).clientX = 990;
  editor.lastnonscrollingcol = 10;
  editor.context.sheetobj.attribs.lastcol = 5;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  editor.lastnonscrollingcol = 0;
  // first > lastcol
  (draginfoH as Record<string, unknown>).clientX = 1050;
  editor.context.sheetobj.attribs.lastcol = 5;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  editor.context.sheetobj.attribs.lastcol = 100;
  (draginfoH as Record<string, unknown>).clientX = 500;
  {
    SC.TCTDragFunctionMove({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 17: TCTDragFunctionStop first calc + clamp (9663-9679)
// ---------------------------------------------------------------------------

test("TCTDragFunctionStop: v+h first-calc + clamp branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tcts-clamp");
  const editor = control.editor;
  primeGridLayout(editor);

  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  vctrl.scrollareaend = 1000;
  vctrl.scrollareastart = 100;
  vctrl.scrollareasize = 900;
  vctrl.thumbthickness = 20;
  vctrl.controlborder = 1500;
  const dobjV: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjV.functionobj as Record<string, unknown>).control = vctrl;
  const draginfoV: Record<string, unknown> = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
  {
    SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }

  // first <= lastnonscrollingrow (lastrow < lastnonscrollingrow → difference negative)
  (draginfoV as Record<string, unknown>).clientY = 990;
  editor.lastnonscrollingrow = 10;
  editor.context.sheetobj.attribs.lastrow = 5;
  {
    SC.TCTDragFunctionStop({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  editor.lastnonscrollingrow = 0;
  // first > lastrow
  (draginfoV as Record<string, unknown>).clientY = 1050;
  editor.context.sheetobj.attribs.lastrow = 5;
  {
    SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  {
    SC.TCTDragFunctionStop({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  editor.context.sheetobj.attribs.lastrow = 100;
  // normal
  (draginfoV as Record<string, unknown>).clientY = 500;
  {
    SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }
  {
    SC.TCTDragFunctionStop({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
  }

  const hctrl = editor.horizontaltablecontrol as SocialCalc.TableControl;
  hctrl.scrollareaend = 1000;
  hctrl.scrollareastart = 100;
  hctrl.scrollareasize = 900;
  hctrl.thumbthickness = 20;
  hctrl.controlborder = 1500;
  const dobjH: SocialCalc.DragRegisteredElement = {
    vertical: false,
    horizontal: true,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: hctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjH.functionobj as Record<string, unknown>).control = hctrl;
  const draginfoH: Record<string, unknown> = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
  {
    SC.TCTDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  // first <= lastnonscrollingcol
  (draginfoH as Record<string, unknown>).clientX = 990;
  editor.lastnonscrollingcol = 10;
  editor.context.sheetobj.attribs.lastcol = 5;
  {
    SC.TCTDragFunctionStop({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  editor.lastnonscrollingcol = 0;
  // first > lastcol
  (draginfoH as Record<string, unknown>).clientX = 1050;
  editor.context.sheetobj.attribs.lastcol = 5;
  {
    SC.TCTDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  {
    SC.TCTDragFunctionStop({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  editor.context.sheetobj.attribs.lastcol = 100;
  // normal
  (draginfoH as Record<string, unknown>).clientX = 500;
  {
    SC.TCTDragFunctionStart({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  {
    SC.TCTDragFunctionStop({} as Event, draginfoH as typeof SocialCalc.DragInfo, dobjH);
  }
  expect(editor.context.rowpanes.at(-1)?.first).toBeGreaterThan(0);
  expect(editor.context.rowpanes.at(-1)?.first).toBeLessThanOrEqual(100);
  expect(editor.context.colpanes.at(-1)?.first).toBeGreaterThan(0);
  expect(editor.context.colpanes.at(-1)?.first).toBeLessThanOrEqual(100);

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 18: DragMouseDown Disabled + parent + callbacks (9734-9754)
// ---------------------------------------------------------------------------

test("DragMouseDown: Disabled callback + parent + MouseMove/Up callbacks", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dm-cb");
  const editor = control.editor;
  ensureDocumentEvents();
  const el = document.createElement("div");
  editor.toplevel.appendChild(el);
  let downCalls = 0;
  let moveCalls = 0;
  let upCalls = 0;
  SC.DragRegister(
    el,
    true,
    true,
    {
      MouseDown: () => {
        downCalls++;
      },
      MouseMove: () => {
        moveCalls++;
      },
      MouseUp: () => {
        upCalls++;
      },
      Disabled: () => false,
    } as SocialCalc.DragFunctionObject,
    editor.toplevel as HTMLElement,
  );
  const regEl = SC.DragInfo.registeredElements.find((r) => r.element === el);
  if (regEl) regEl.parent = editor.toplevel as HTMLElement;
  {
    SC.DragMouseDown(fakeEvent({ clientX: 10, clientY: 10, target: el }) as unknown as MouseEvent);
  }
  {
    SC.DragMouseMove(fakeEvent({ clientX: 20, clientY: 20, target: el }) as unknown as MouseEvent);
  }
  {
    SC.DragMouseUp(fakeEvent({ clientX: 25, clientY: 25, target: el }) as unknown as MouseEvent);
  }
  expect(downCalls).toBeGreaterThan(0);
  expect(moveCalls).toBeGreaterThan(0);
  expect(upCalls).toBeGreaterThan(0);

  // Disabled callback returns true — unregister first entry so LookupElement finds the new one
  SC.DragUnregister(el);
  let disabledCalls = 0;
  const el3 = document.createElement("div");
  editor.toplevel.appendChild(el3);
  SC.DragRegister(
    el3,
    true,
    true,
    {
      Disabled: () => {
        disabledCalls++;
        return true;
      },
    } as SocialCalc.DragFunctionObject,
    editor.toplevel as HTMLElement,
  );
  {
    SC.DragMouseDown(fakeEvent({ clientX: 10, clientY: 10, target: el3 }) as unknown as MouseEvent);
  }
  expect(disabledCalls).toBeGreaterThan(0);

  // No dobj → return
  SC.DragInfo.registeredElements = [];
  {
    SC.DragMouseDown(fakeEvent({ clientX: 10, clientY: 10, target: el }) as unknown as MouseEvent);
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 19: ButtonMouseOver/Out/MouseDown/Up + Repeat (9823-9918)
// ---------------------------------------------------------------------------

test("ButtonMouseOver/Out: buttonDown + doingHover + MouseOver/Out callback branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "btn-mo");
  const editor = control.editor;
  const b1 = document.createElement("div");
  const b2 = document.createElement("div");
  editor.toplevel.appendChild(b1);
  editor.toplevel.appendChild(b2);
  let overCalls = 0;
  let outCalls = 0;
  SC.ButtonRegister(editor, b1, { name: "A", normalstyle: "a", hoverstyle: "h", downstyle: "d" }, {
    MouseOver: () => {
      overCalls++;
    },
    MouseOut: () => {
      outCalls++;
    },
  } as SocialCalc.ButtonFunctionObject);
  SC.ButtonRegister(
    editor,
    b2,
    { name: "B", normalstyle: "a", hoverstyle: "h", downstyle: "d" },
    {} as SocialCalc.ButtonFunctionObject,
  );

  // MouseOver normal path
  SC.ButtonInfo.buttonDown = false;
  SC.ButtonInfo.doingHover = false;
  SC.ButtonInfo.buttonElement = null;
  {
    SC.ButtonMouseOver(fakeEvent({ target: b1 }) as unknown as MouseEvent);
  }
  expect(overCalls).toBeGreaterThan(0);

  // MouseOver with bobj=null
  SC.ButtonInfo.buttonDown = false;
  {
    SC.ButtonMouseOver(
      fakeEvent({ target: document.createElement("div") }) as unknown as MouseEvent,
    );
  }

  // MouseOut with doingHover → reset
  SC.ButtonInfo.buttonDown = false;
  SC.ButtonInfo.doingHover = true;
  SC.ButtonInfo.buttonElement = SC.ButtonInfo.registeredElements[0] ?? null;
  {
    SC.ButtonMouseOut(fakeEvent({ target: b1 }) as unknown as MouseEvent);
  }
  expect(outCalls).toBeGreaterThan(0);

  // MouseOut buttonDown true
  SC.ButtonInfo.buttonDown = true;
  SC.ButtonInfo.doingHover = true;
  {
    SC.ButtonMouseOut(fakeEvent({ target: b1 }) as unknown as MouseEvent);
  }
  SC.ButtonInfo.buttonDown = false;

  // MouseOut with bobj not found
  SC.ButtonInfo.doingHover = false;
  {
    SC.ButtonMouseOut(
      fakeEvent({ target: document.createElement("div") }) as unknown as MouseEvent,
    );
  }

  // MouseOver while buttonDown=true + bobj==buttonElement
  SC.ButtonInfo.buttonDown = true;
  SC.ButtonInfo.buttonElement = SC.ButtonInfo.registeredElements[0] ?? null;
  SC.ButtonInfo.doingHover = false;
  {
    SC.ButtonMouseOver(fakeEvent({ target: b1 }) as unknown as MouseEvent);
  }

  // MouseOver while buttonDown=true + bobj!=buttonElement
  {
    SC.ButtonMouseOver(fakeEvent({ target: b2 }) as unknown as MouseEvent);
  }
  SC.ButtonInfo.buttonDown = false;

  teardownEditor(SC, editor);
});

test("ButtonMouseDown: Disabled + Repeat + MouseUp doingHover/normal branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "btn-md");
  const editor = control.editor;
  ensureDocumentEvents();
  const b = document.createElement("div");
  editor.toplevel.appendChild(b);
  let upCalls = 0;

  SC.ButtonRegister(
    editor,
    b,
    {
      name: "A",
      normalstyle: "a",
      hoverstyle: "h",
      downstyle: "d",
      repeatwait: 100,
      repeatinterval: 100,
    } as SocialCalc.ButtonParamObject,
    {
      MouseDown: () => {},
      MouseUp: () => {
        upCalls++;
      },
      Repeat: () => {},
      Disabled: () => false,
    } as SocialCalc.ButtonFunctionObject,
  );
  // Find our registered element by element reference (not array index 0,
  // which may point at a CreateTableControl-registered button).
  const ourBtn = SC.ButtonInfo.registeredElements.find((r) => r.element === b) ?? null;
  // MouseUp with doingHover=true
  SC.ButtonInfo.buttonDown = true;
  SC.ButtonInfo.doingHover = true;
  SC.ButtonInfo.buttonElement = ourBtn;
  {
    SC.ButtonMouseUp(fakeEvent({ target: b }) as unknown as MouseEvent);
  }
  expect(upCalls).toBeGreaterThan(0);

  // MouseUp with doingHover=false
  SC.ButtonInfo.buttonDown = true;
  SC.ButtonInfo.doingHover = false;
  SC.ButtonInfo.buttonElement = ourBtn;
  {
    SC.ButtonMouseUp(fakeEvent({ target: b }) as unknown as MouseEvent);
  }

  // MouseUp with buttonDown=false → early return
  SC.ButtonInfo.buttonDown = false;
  {
    SC.ButtonMouseUp(fakeEvent({ target: b }) as unknown as MouseEvent);
  }

  // MouseDown with bobj=null
  SC.ButtonInfo.buttonDown = false;
  {
    SC.ButtonMouseDown(
      fakeEvent({ target: document.createElement("div") }) as unknown as MouseEvent,
    );
  }

  // Disabled callback returns true — use a fresh element so LookupElement finds it
  const bDis = document.createElement("div");
  editor.toplevel.appendChild(bDis);
  SC.ButtonRegister(
    editor,
    bDis,
    {
      name: "C",
      normalstyle: "a",
      hoverstyle: "h",
      downstyle: "d",
    } as SocialCalc.ButtonParamObject,
    { Disabled: () => true } as SocialCalc.ButtonFunctionObject,
  );
  {
    SC.ButtonMouseDown(fakeEvent({ target: bDis }) as unknown as MouseEvent);
  }

  // Timer set → clear on MouseUp
  SC.ButtonInfo.timer = window.setTimeout(() => {}, 100);
  SC.ButtonInfo.buttonDown = true;
  SC.ButtonInfo.doingHover = false;
  SC.ButtonInfo.buttonElement = ourBtn;
  {
    SC.ButtonMouseUp(fakeEvent({ target: b }) as unknown as MouseEvent);
  }

  // ButtonRepeat with bobj
  SC.ButtonInfo.buttonElement = ourBtn;
  SC.ButtonInfo.buttonDown = true;
  {
    SC.ButtonRepeat();
  }
  if (SC.ButtonInfo.timer) clearTimeout(SC.ButtonInfo.timer);
  SC.ButtonInfo.timer = null;

  // ButtonRepeat with no bobj
  SC.ButtonInfo.buttonElement = null;
  {
    SC.ButtonRepeat();
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 20: ProcessMouseWheel parentNode walk + WheelMove (9935-9953)
// ---------------------------------------------------------------------------

test("ProcessMouseWheel: parentNode walk + WheelMove + preventDefault fallback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pw-walk");
  const editor = control.editor;
  const parent = document.createElement("div");
  const child = document.createElement("div");
  parent.appendChild(child);
  editor.toplevel.appendChild(parent);
  let wheelCalls = 0;
  SC.MouseWheelRegister(parent, {
    WheelMove: () => {
      wheelCalls++;
    },
  } as SocialCalc.MouseWheelFunctionObject);
  {
    SC.ProcessMouseWheel(fakeEvent({ target: child, wheelDelta: 120 }) as unknown as Event);
  }
  expect(wheelCalls).toBeGreaterThan(0);

  // passThru → early return
  SC.Keyboard.passThru = {} as unknown as HTMLElement;
  {
    SC.ProcessMouseWheel(fakeEvent({ target: child, wheelDelta: 120 }) as unknown as Event);
  }
  SC.Keyboard.passThru = null;

  // No registered element found
  {
    SC.ProcessMouseWheel(
      fakeEvent({ target: document.createElement("div"), wheelDelta: 120 }) as unknown as Event,
    );
  }

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 21: ProcessKeyDown IE path + controlKeysIE (10088-10101)
// ---------------------------------------------------------------------------

test("ProcessKeyDown: IE path (which=undefined) + specialKeys + controlKeys + preventDefault", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pkd-ie");
  SC.KeyboardSetFocus(control.editor);

  // which=undefined → specialKeysCommon path
  {
    SC.ProcessKeyDown({
      which: undefined,
      keyCode: 37,
      ctrlKey: false,
      preventDefault() {},
      returnValue: true,
    } as unknown as KeyboardEvent);
  }

  // which=undefined, not a special key, no ctrlKey → return true
  {
    SC.ProcessKeyDown({
      which: undefined,
      keyCode: 65,
      ctrlKey: false,
    } as unknown as KeyboardEvent);
  }

  // which=undefined → ctrlKey + controlKeysIE
  {
    SC.ProcessKeyDown({ which: undefined, keyCode: 65, ctrlKey: true } as unknown as KeyboardEvent);
  }

  // which=defined with controlKeysIE
  {
    SC.ProcessKeyDown({
      which: 1,
      keyCode: 67,
      ctrlKey: true,
      metaKey: false,
    } as unknown as KeyboardEvent);
  }

  // which=defined, not special, no ctrlKey → return true
  {
    SC.ProcessKeyDown({
      which: 1,
      keyCode: 65,
      ctrlKey: false,
      metaKey: false,
    } as unknown as KeyboardEvent);
  }

  // _app=true
  const savedApp = SC._app;
  (SC as Record<string, unknown>)._app = true;
  {
    SC.ProcessKeyDown({ which: 1, keyCode: 37 } as unknown as KeyboardEvent);
  }
  (SC as Record<string, unknown>)._app = savedApp;

  // passThru truthy
  SC.Keyboard.passThru = {} as unknown as HTMLElement;
  {
    SC.ProcessKeyDown({ which: 1, keyCode: 37 } as unknown as KeyboardEvent);
  }
  SC.Keyboard.passThru = null;

  teardownEditor(SC, control.editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 22: ProcessKeyPress Safari + IE + Firefox + repeatingKeyPress (10135-10166)
// ---------------------------------------------------------------------------

test("ProcessKeyPress: Safari + IE + Firefox + repeatingKeyPress branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pkp-safari");
  SC.KeyboardSetFocus(control.editor);
  const kt = SC.keyboardTables;

  // didProcessKey=true, repeatingKeyPress=false
  kt.didProcessKey = true;
  kt.repeatingKeyPress = false;
  kt.statusFromProcessKey = true;
  kt.chForProcessKey = "[aright]";
  {
    SC.ProcessKeyPress({ which: 1, keyCode: 39, charCode: 0 } as unknown as KeyboardEvent);
  }

  // didProcessKey=true, repeatingKeyPress=true → ProcessKey
  kt.repeatingKeyPress = true;
  {
    SC.ProcessKeyPress({ which: 1, keyCode: 39, charCode: 0 } as unknown as KeyboardEvent);
  }
  kt.didProcessKey = false;
  kt.repeatingKeyPress = false;

  // which=undefined → String.fromCharCode
  {
    SC.ProcessKeyPress({ which: undefined, keyCode: 65, charCode: 0 } as unknown as KeyboardEvent);
  }

  // which=0 → return false
  {
    SC.ProcessKeyPress({ which: 0, keyCode: 0, charCode: 0 } as unknown as KeyboardEvent);
  }

  // passThru
  SC.Keyboard.passThru = {} as unknown as HTMLElement;
  {
    SC.ProcessKeyPress({ which: 1, keyCode: 37, charCode: 0 } as unknown as KeyboardEvent);
  }
  SC.Keyboard.passThru = null;

  // _app
  (SC as Record<string, unknown>)._app = true;
  {
    SC.ProcessKeyPress({ which: 1, keyCode: 37 } as unknown as KeyboardEvent);
  }
  (SC as Record<string, unknown>)._app = false;

  teardownEditor(SC, control.editor);
});

test("ProcessKeyPress: Safari specialKeys + ignoreKeys + controlKeys + Firefox", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pkp-safari2");
  SC.KeyboardSetFocus(control.editor);

  // keyCode == charCode → Safari specialKeysSafari match (63232 = [aup])
  {
    SC.ProcessKeyPress({
      which: 63232,
      keyCode: 63232,
      charCode: 63232,
    } as unknown as KeyboardEvent);
  }

  // Safari ignoreKeysSafari (63238 = [f3]) → return true
  {
    SC.ProcessKeyPress({
      which: 63238,
      keyCode: 63238,
      charCode: 63238,
    } as unknown as KeyboardEvent);
  }

  // Safari metaKey + controlKeysSafari (97 = [ctrl-a])
  {
    SC.ProcessKeyPress({
      which: 97,
      keyCode: 97,
      charCode: 97,
      metaKey: true,
      preventDefault() {},
      returnValue: true,
    } as unknown as KeyboardEvent);
  }

  // Safari normal char
  {
    SC.ProcessKeyPress({
      which: 97,
      keyCode: 97,
      charCode: 97,
      metaKey: false,
    } as unknown as KeyboardEvent);
  }

  // Firefox keyCode != charCode, specialKeysFirefox match → return true
  {
    SC.ProcessKeyPress({ which: 1, keyCode: 37, charCode: 0 } as unknown as KeyboardEvent);
  }

  // Firefox controlKeysFirefox (which=99)
  {
    SC.ProcessKeyPress({
      which: 99,
      keyCode: 67,
      charCode: 0,
      ctrlKey: true,
      preventDefault() {},
      returnValue: true,
    } as unknown as KeyboardEvent);
  }

  // Firefox normal char + no ctrl/meta
  {
    SC.ProcessKeyPress({
      which: 65,
      keyCode: 0,
      charCode: 65,
      ctrlKey: false,
      metaKey: false,
    } as unknown as KeyboardEvent);
  }

  // status=false → preventDefault
  {
    SC.ProcessKeyPress({
      which: 97,
      keyCode: 97,
      charCode: 97,
      metaKey: true,
      preventDefault() {},
      returnValue: true,
    } as unknown as KeyboardEvent);
  }

  teardownEditor(SC, control.editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 23: DragUnregister element not found (9720-9727)
// ---------------------------------------------------------------------------

test("DragUnregister: element not found in registeredElements", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "du-nf");
  const editor = control.editor;
  const el1 = document.createElement("div");
  const el2 = document.createElement("div");
  editor.toplevel.appendChild(el1);
  SC.DragRegister(
    el1,
    true,
    true,
    {} as SocialCalc.DragFunctionObject,
    editor.toplevel as HTMLElement,
  );
  {
    SC.DragUnregister(el2);
  }
  {
    SC.DragUnregister(el1);
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 24: InputBoxOnMouseDown state variants (8415-8437)
// ---------------------------------------------------------------------------

test("InputBoxOnMouseDown: input + inputboxdirect state branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ibom-states");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  editor.MoveECell("B2");
  const wv = editor.workingvalues as Record<string, unknown>;
  wv.ecoord = "B2";
  wv.erow = 2;
  wv.ecol = 2;

  // start → inputboxdirect
  editor.state = "start";
  {
    SC.InputBoxOnMouseDown(fakeEvent() as unknown as MouseEvent);
  }

  // input → inputboxdirect via MoveECell
  editor.state = "input";
  {
    SC.InputBoxOnMouseDown(fakeEvent() as unknown as MouseEvent);
  }

  // inputboxdirect → no-op
  editor.state = "inputboxdirect";
  {
    SC.InputBoxOnMouseDown(fakeEvent() as unknown as MouseEvent);
  }

  // Keyboard.focusTable null
  SC.Keyboard.focusTable = null;
  {
    SC.InputBoxOnMouseDown(fakeEvent() as unknown as MouseEvent);
  }
  SC.KeyboardSetFocus(editor);

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 25: TCTDragFunctionRowSetStatus (9613-9619)
// ---------------------------------------------------------------------------

test("TCTDragFunctionRowSetStatus: normal path", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tctrss-root");
  const editor = control.editor;
  primeGridLayout(editor);
  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  const dobj: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobj.functionobj as Record<string, unknown>).control = vctrl;
  const draginfo: Record<string, unknown> = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
  {
    SC.TCTDragFunctionStart({} as Event, draginfo as typeof SocialCalc.DragInfo, dobj);
  }
  {
    SC.TCTDragFunctionRowSetStatus(draginfo as typeof SocialCalc.DragInfo, editor, 5);
  }
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap cluster 26: InputEcho DragRegister + functionbox (8473-8480)
// ---------------------------------------------------------------------------

test("InputEcho: DragRegister from constructor + functionbox", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ie-drag");
  const editor = control.editor;
  expect(editor.inputEcho.container).toBeTruthy();

  const scc = SC.Constants;
  const savedFbClass = (scc as Record<string, unknown>).defaultInputEchoFunctionboxClass;
  const savedFbStyle = (scc as Record<string, unknown>).defaultInputEchoFunctionboxStyle;
  (scc as Record<string, unknown>).defaultInputEchoFunctionboxClass = "echo-fb";
  (scc as Record<string, unknown>).defaultInputEchoFunctionboxStyle = "display:block;";
  {
    const echo = new SC.InputEcho(editor);
    expect(echo).toBeTruthy();
  }
  (scc as Record<string, unknown>).defaultInputEchoFunctionboxClass = savedFbClass;
  (scc as Record<string, unknown>).defaultInputEchoFunctionboxStyle = savedFbStyle;
  teardownEditor(SC, editor);
});
