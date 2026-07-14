// Coverage gaps for dist/SocialCalc.js lines 5557-8320 (TableEditor part A).
// Targets uncovered statements not exercised by editor-coverage-a/b, editor-dom-coverage,
// or editor-coverage-gaps-a/b.

import { afterAll, afterEach, expect, test } from "vite-plus/test";

import { loadSocialCalc as _loadSocialCalc } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
});

afterAll(() => {
  restoreOriginalTimers();
});

// -- Local type helpers (strict — no `any`) -------------------------------

interface EditorLike {
  griddiv: HTMLElement & { className: string; style: CSSStyleDeclaration };
  fullgrid: HTMLElement;
  tablewidth: number;
  tableheight: number;
  gridposition: { left: number; top: number };
  headposition: { left: number; top: number };
  colpositions: number[];
  rowpositions: number[];
  colwidth: number[];
  rowheight: number[];
  firstscrollingrow: number;
  firstscrollingcol: number;
  lastnonscrollingrow: number;
  lastnonscrollingcol: number;
  lastvisiblerow: number;
  lastvisiblecol: number;
  firstscrollingrowtop: number;
  firstscrollingcolleft: number;
  verticaltablecontrol: { controlborder: number; main: { style: Record<string, string> } };
  horizontaltablecontrol: { controlborder: number; main: { style: Record<string, string> } };
  toplevel: HTMLElement;
  range: { hasrange: boolean; left: number; right: number; top: number; bottom: number };
  state: string;
  ecell: { coord: string; row: number; col: number } | null;
  timeout: ReturnType<typeof setTimeout> | null;
  inputBox: unknown;
  inputEcho: { interval: ReturnType<typeof setInterval> | null } | null;
  inputboxEcho: unknown;
  pageUpDnAmount: number;
  cellhandles: { ShowCellHandles: (v: boolean) => void } | null;
  busy: boolean;
  ensureecell: boolean;
  context: ContextLike;
  CalculateEditorPositions: () => void;
  CalculateRowPositions: (rp: number, arr: number[], arr2: number[]) => void;
  CalculateColPositions: (cp: number, arr: number[], arr2: number[]) => void;
  FitToEditTable: () => void;
  EditorRenderSheet: () => void;
  EditorScheduleSheetCommands: (cmd: string, a: boolean, b: boolean) => void;
  LimitLastPanes: () => void;
  ScheduleRender: () => void;
  RangeRemove: () => void;
  RangeExtend: (ecoord?: string) => void;
  RangeAnchor: (ecoord?: string) => void;
  MoveECell: (coord: string) => string;
  EnsureECellVisible: () => void;
  EditorMouseRange: (coord: string) => void;
  ScrollRelativeBoth: (v: number, h: number) => void;
  workingvalues: {
    partialexpr?: string;
    ecoord?: string;
    erow?: number;
    ecol?: number;
    [key: string]: unknown;
  };
  EditorSaveEdit: (text?: unknown) => void;
}

interface ContextLike {
  sheetobj: {
    cells: Record<
      string,
      { rowspan?: number; colspan?: number; readonly?: boolean; valuetype?: string } | undefined
    >;
    colattribs: { hide: Record<string, string>; width: Record<string, string | number> };
    rowattribs: { hide: Record<number, string> };
    attribs: {
      usermaxcol?: number;
      usermaxrow?: number;
      defaultcolwidth?: string | number;
      needsrecalc?: string;
      circularreferencecell?: string;
      lastrow?: number;
    };
  };
  rowpanes: { first: number; last: number }[];
  colpanes: { first: number; last: number }[];
  cellskip: Record<string, string | boolean>;
  coordToCR: Record<string, { row: number; col: number }>;
  showRCHeaders: boolean;
  classnames: Record<string, string> | null;
  explicitStyles: Record<string, string> | null;
  rownamewidth: number;
  CalculateColWidthData: () => void;
  RenderRow: (rownum: number, rowpane: number) => HTMLElement;
  RenderCell: (
    row: number,
    col: number,
    rowpane: number,
    colpane: number,
    b: boolean,
    n: unknown,
  ) => HTMLElement;
}

interface SCLike {
  TableEditor: new (sheet: unknown, container: HTMLElement, w: number, h: number) => EditorLike;
  SpreadsheetControl: new () => {
    editor: EditorLike;
    InitializeSpreadsheetControl: (c: HTMLElement, w: number, h: number, s: number) => void;
  };
  Constants: {
    defaultMinimumColWidth: number;
    defaultAssumedRowHeight: number;
    defaultColWidth: number;
    cteGriddivClass?: string;
  };
  EditorMouseInfo: MouseInfoLike;
  AutoRepeatInfo: {
    timer: ReturnType<typeof setTimeout> | null;
    mouseinfo: unknown;
    editor: unknown;
    repeatcallback: ((c: string, d: string) => void) | null;
  };
  ButtonInfo: { timer: ReturnType<typeof setTimeout> | null };
  Keyboard: { focusTable: unknown; passThru: unknown };
  GridMousePosition: (editor: EditorLike, cx: number, cy: number) => GridResultLike | null;
  ProcessEditorMouseDown: (e: Event) => void;
  ProcessEditorMouseMove: (e: Event) => void;
  ProcessEditorMouseUp: (e: Event) => unknown;
  ProcessEditorColsizeMouseMove: (e: Event) => unknown;
  ProcessEditorColsizeMouseUp: (e: Event) => unknown;
  ProcessEditorRowsizeMouseUp: (e: Event) => unknown;
  ProcessEditorDblClick: (e: Event) => unknown;
  FinishColRowSize: () => void;
  PageRelative: (editor: EditorLike, vertical: boolean, direction: number) => void;
  ScrollTableUpOneRow: (editor: EditorLike) => unknown;
  ScrollTableDownOneRow: (editor: EditorLike) => unknown;
  GetElementPositionWithScroll: (el: HTMLElement) => { left: number; top: number };
  GetElementPosition: (el: HTMLElement) => { left: number; top: number };
  GetSpreadsheetControlObject: () => { spreadsheetDiv: { firstChild: { offsetHeight: number } } };
  LookupElement: (
    el: HTMLElement,
    arr: { editor: EditorLike; element: HTMLElement }[],
  ) => { editor: EditorLike; element: HTMLElement } | null;
  SetMouseMoveUp: (m: unknown, u: unknown, e: HTMLElement, ev: Event) => void;
  RemoveMouseMoveUp: (m: unknown, u: unknown, e: HTMLElement, ev: Event) => void;
  SetDragAutoRepeat: (ed: EditorLike, mi: GridResultLike | null, cb?: unknown) => void;
  KeyboardSetFocus: (ed: EditorLike) => void;
  crToCoord: (col: number, row: number) => string;
  rcColname: (col: number) => string;
  coordToCr: (coord: string) => { row: number; col: number };
  setStyles: (el: unknown, s: string) => void;
  StopPropagation: (e: Event) => void;
  _app: boolean;
}

interface MouseInfoLike {
  registeredElements: { editor: EditorLike; element: HTMLElement }[];
  editor: EditorLike | null;
  element: HTMLElement | null;
  ignore: boolean;
  mousedowncoord: string;
  mouselastcoord: string;
  mouseresizecol: string | number;
  mouseresizecolnum: number | null;
  mouseresizeclientx: number | null;
  mouseresizedisplay: HTMLElement | null;
  mouseresizerownum: number | null;
  mouserowtounhide: number | null;
  mousecoltounhide: number | null;
  mousedownclientx: number;
  mousedownclienty: number;
}

interface GridResultLike {
  row: number;
  col: number;
  coord?: string;
  rowheader?: boolean;
  colheader?: boolean;
  rowselect?: boolean;
  colselect?: boolean;
  rowtoresize?: number | boolean;
  coltoresize?: number | boolean;
  rowfooter?: boolean;
  colfooter?: boolean;
  distance?: number;
  rowtounhide?: number | null;
  coltounhide?: number | null;
}

// -- Load helpers -----------------------------------------------------------

async function loadSocialCalc(): Promise<SCLike> {
  const SC = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  return SC as unknown as SCLike;
}

async function newControl(
  SC: SCLike,
  containerId = "gap-c-root",
): Promise<{ control: { editor: EditorLike }; container: HTMLElement }> {
  const container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

function teardownEditor(SC: SCLike, editor: EditorLike | null): void {
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
    SC.Keyboard.focusTable = null;
    SC.Keyboard.passThru = null;
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

interface FakeEventOptions {
  target?: HTMLElement | null;
  clientX?: number;
  clientY?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  detail?: number;
  which?: number;
  keyCode?: number;
  charCode?: number;
  wheelDelta?: number;
}

function fakeEvent(extras: FakeEventOptions = {}): Event {
  const ev: Record<string, unknown> = {
    type: "mousedown",
    clientX: extras.clientX ?? 10,
    clientY: extras.clientY ?? 10,
    target: extras.target ?? null,
    srcElement: extras.target ?? null,
    shiftKey: extras.shiftKey ?? false,
    ctrlKey: extras.ctrlKey ?? false,
    metaKey: extras.metaKey ?? false,
    altKey: extras.altKey ?? false,
    wheelDelta: extras.wheelDelta ?? 0,
    detail: extras.detail ?? 0,
    which: extras.which ?? 0,
    keyCode: extras.keyCode ?? 0,
    charCode: extras.charCode ?? 0,
    preventDefault() {},
    stopPropagation() {},
  };
  return ev as unknown as Event;
}

function primeGridLayout(editor: EditorLike): void {
  {
    editor.CalculateEditorPositions();
  }
  editor.gridposition = editor.gridposition || { left: 0, top: 0 };
  editor.headposition = editor.headposition || { left: 30, top: 30 };
  editor.colpositions = [0, 0, 80, 160, 240, 320, 400, 480];
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.firstscrollingrow = 1;
  editor.firstscrollingcol = 1;
  editor.lastnonscrollingrow = 0;
  editor.lastnonscrollingcol = 0;
  editor.lastvisiblerow = 7;
  editor.lastvisiblecol = 7;
  editor.firstscrollingrowtop = 30;
  editor.firstscrollingcolleft = 30;
  editor.verticaltablecontrol = { controlborder: 500, main: { style: {} } };
  editor.horizontaltablecontrol = { controlborder: 500, main: { style: {} } };
}

// ============================================================================
// TEST: CreateTableEditor with cteGriddivClass truthy (line 5917)
// ============================================================================
test("CreateTableEditor: cteGriddivClass truthy sets className", async () => {
  const SC = await loadSocialCalc();

  // Set the class name before creating the control — CreateTableEditor reads
  // it during initialization.
  SC.Constants.cteGriddivClass = "my-grid-class";

  const { control } = await newControl(SC, "cte-griddiv-c");
  const editor = control.editor;

  {
    expect(editor.griddiv.className).toBe("my-grid-class");
  }
  teardownEditor(SC, editor);

  delete SC.Constants.cteGriddivClass;
});

// ============================================================================
// TEST: ProcessEditorMouseDown — no-coord return (line 6515)
// Need GridMousePosition to return a result with no .coord.
// ============================================================================
test("ProcessEditorMouseDown: no-coord return (no headers)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemnd-nocoord");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.ignore = false;
  mi.registeredElements = [{ editor, element: editor.fullgrid }];
  editor.range = { hasrange: false, left: 0, right: 0, top: 0, bottom: 0 };

  // Mock GridMousePosition to return result with no coord and no row/col headers.
  // This skips the rowheader/colheader branches and reaches `if (!result.coord) return;`.
  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = (() => ({ row: 2, col: 1 })) as unknown as SCLike["GridMousePosition"];

  const ev = fakeEvent({ target: editor.fullgrid, clientX: 100, clientY: 100 });

  {
    SC.ProcessEditorMouseDown(ev);
  }
  SC.GridMousePosition = origGMP;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorMouseDown — focus inputBox when state != "start" (line 6544)
test("ProcessEditorMouseDown: focus inputBox when state != start", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemnd-focus");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.ignore = false;
  mi.registeredElements = [{ editor, element: editor.fullgrid }];
  editor.range = { hasrange: false, left: 0, right: 0, top: 0, bottom: 0 };

  // Set state != "start" and provide an inputBox with element.focus().
  editor.state = "input";
  let focused = false;
  const focusElement = {
    focus: () => {
      focused = true;
    },
    style: {} as CSSStyleDeclaration,
  };
  editor.inputBox = {
    element: focusElement as unknown as HTMLElement,
    GetText: () => "",
    Blur: () => {},
    ShowInputBox: (_v: boolean) => {},
    SetText: (_v: string) => {},
    DisplayCellContents: (_v: unknown) => {},
    skipOne: false,
    Focus: () => {},
    Select: (_v: string) => {},
  };
  editor.workingvalues = { partialexpr: "" };
  editor.cellhandles = { ShowCellHandles: () => {} };
  editor.EditorSaveEdit = () => {};
  editor.EditorMouseRange = () => {};
  editor.MoveECell = (coord: string) => coord;
  editor.EnsureECellVisible = () => {};

  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = (() => ({
    row: 1,
    col: 1,
    coord: "A1",
  })) as unknown as SCLike["GridMousePosition"];
  const origKSF = SC.KeyboardSetFocus;
  SC.KeyboardSetFocus = () => {};
  const origSMU = SC.SetMouseMoveUp;
  SC.SetMouseMoveUp = () => {};

  const ev = fakeEvent({ target: editor.fullgrid, clientX: 100, clientY: 100 });

  {
    SC.ProcessEditorMouseDown(ev);
    expect(focused).toBe(true);
  }
  SC.GridMousePosition = origGMP;
  SC.KeyboardSetFocus = origKSF;
  SC.SetMouseMoveUp = origSMU;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorMouseMove — result null return (line 6600)
// ============================================================================
test("ProcessEditorMouseMove: null result return", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemv-null");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;

  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = () => null;

  {
    SC.ProcessEditorMouseMove(fakeEvent({ clientX: 100, clientY: 100 }));
  }
  SC.GridMousePosition = origGMP;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorMouseMove — no-coord return (line 6607)
// When GridMousePosition returns result with no .coord (header area).
// ============================================================================
test("ProcessEditorMouseMove: no-coord return", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemv-nocoord");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;

  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = () => ({ row: 2, col: 1, rowheader: true, distance: 10 });

  {
    SC.ProcessEditorMouseMove(fakeEvent({ clientX: 5, clientY: 50 }));
  }
  SC.GridMousePosition = origGMP;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorMouseUp — null result return (line 6636)
// ============================================================================
test("ProcessEditorMouseUp: null result return", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemu-null");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;

  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = () => null;

  {
    SC.ProcessEditorMouseUp(fakeEvent({ clientX: 100, clientY: 100 }));
  }
  SC.GridMousePosition = origGMP;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorColsizeMouseMove — newsize clamped to min (line 6690)
// ============================================================================
test("ProcessEditorColsizeMouseMove: newsize clamped to minimum", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pecsmv-clamp");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;
  mi.mouseresizecolnum = 2;
  mi.mouseresizecol = "B";
  mi.mousedownclientx = 50;
  mi.mouseresizedisplay = document.createElement("div");
  mi.mousecoltounhide = null;
  editor.context.sheetobj.colattribs = { hide: {}, width: {} };

  const origGEP = SC.GetElementPositionWithScroll;
  SC.GetElementPositionWithScroll = () => ({ left: 0, top: 0 });

  // clientX = -100, so newsize = 80 + (-100 - 50) = -70 → clamped to min.
  const ev = fakeEvent({ clientX: -100 });

  {
    SC.ProcessEditorColsizeMouseMove(ev);
  }

  SC.GetElementPositionWithScroll = origGEP;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorColsizeMouseUp — newsize clamped to min + clearTimeout (lines 6713, 6874-analog)
// ============================================================================
test("ProcessEditorColsizeMouseUp: newsize clamped to minimum + clearTimeout", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pecsmu-clamp");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;
  mi.mouseresizecolnum = 2;
  mi.mouseresizecol = "B";
  mi.mousedownclientx = 50;
  mi.mousecoltounhide = null;
  editor.context.sheetobj.colattribs = { hide: {}, width: {} };
  editor.timeout = null;
  editor.EditorScheduleSheetCommands = () => {};

  const origGEP = SC.GetElementPositionWithScroll;
  SC.GetElementPositionWithScroll = () => ({ left: 0, top: 0 });
  const origRMMU = SC.RemoveMouseMoveUp;
  SC.RemoveMouseMoveUp = () => {};

  // clientX = -200 → newsize = 80 + (-200 - 50) = -170 → clamped to min.
  const ev = fakeEvent({ clientX: -200 });

  {
    SC.ProcessEditorColsizeMouseUp(ev);
  }

  // Now test with editor.timeout set → clearTimeout branch.
  editor.timeout = setTimeout(() => {}, 10000);
  mi.mouseresizecolnum = 2;
  mi.mouseresizecol = "B";
  {
    SC.ProcessEditorColsizeMouseUp(ev);
  }

  if (editor.timeout) {
    clearTimeout(editor.timeout);
    editor.timeout = null;
  }
  SC.GetElementPositionWithScroll = origGEP;
  SC.RemoveMouseMoveUp = origRMMU;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorRowsizeMouseUp — newsize clamped to min + clearTimeout (lines 6871, 6874)
// ============================================================================
test("ProcessEditorRowsizeMouseUp: clamped + clearTimeout", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "persmu-clamp");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;
  mi.mouseresizerownum = 2;
  mi.mouserowtounhide = null;
  mi.mousedownclienty = 50;
  editor.context.sheetobj.rowattribs = { hide: {} };
  editor.timeout = null;
  editor.EditorScheduleSheetCommands = () => {};

  const origGetSCO = SC.GetSpreadsheetControlObject;
  SC.GetSpreadsheetControlObject = () => ({
    spreadsheetDiv: { firstChild: { offsetHeight: 0 } },
  });
  const origRMMU = SC.RemoveMouseMoveUp;
  SC.RemoveMouseMoveUp = () => {};

  // clientY far negative → newsize = 20 + (-200 - 50) = -230 → clamped to min.
  const ev = fakeEvent({ clientY: -200 });

  {
    SC.ProcessEditorRowsizeMouseUp(ev);
  }

  // Now with editor.timeout set → clearTimeout branch (line 6874).
  editor.timeout = setTimeout(() => {}, 10000);
  mi.mouseresizerownum = 2;
  {
    SC.ProcessEditorRowsizeMouseUp(ev);
  }

  if (editor.timeout) {
    clearTimeout(editor.timeout);
    editor.timeout = null;
  }
  SC.GetSpreadsheetControlObject = origGetSCO;
  SC.RemoveMouseMoveUp = origRMMU;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: MoveECellWithKey — RangeRemove non-shifted with hasrange (line 7564)
// ============================================================================
test("MoveECellWithKey: RangeRemove with hasrange and non-shifted key", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mecwk-rangeremove");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: true, left: 1, top: 1, right: 2, bottom: 2 };
  const ctx = editor.context;
  ctx.sheetobj.cells = {};
  ctx.sheetobj.colattribs = { hide: {}, width: {} };
  ctx.sheetobj.rowattribs = { hide: {} };

  let rangeRemoved = false;
  editor.RangeRemove = () => {
    editor.range.hasrange = false;
    rangeRemoved = true;
  };
  editor.RangeExtend = () => {};
  editor.RangeAnchor = () => {};
  editor.MoveECell = (coord: string) => coord;
  editor.EnsureECellVisible = () => {};
  editor.cellhandles = { ShowCellHandles: () => {} };

  {
    const result: unknown = (
      SC as unknown as { MoveECellWithKey: (e: EditorLike, ch: string) => string | null }
    ).MoveECellWithKey(editor, "[aright]");
    expect(result).toBeTruthy();
    expect(rangeRemoved).toBe(true);
  }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: FitToEditTable — colwidth == "blank" in non-last pane (line 7925)
// ============================================================================
test("FitToEditTable: colwidth blank in non-last pane", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "fte-blank");
  const editor = control.editor;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.colattribs = { hide: {}, width: { A: "blank" } };
  sheetobj.attribs = {};

  ctx.colpanes = [
    { first: 1, last: 3 },
    { first: 1, last: 5 },
  ];
  ctx.rowpanes = [{ first: 1, last: 5 }];
  sheetobj.colattribs.hide = {};

  editor.tablewidth = 500;
  ctx.showRCHeaders = true;
  ctx.rownamewidth = 30;
  ctx.CalculateColWidthData = () => {};

  {
    editor.FitToEditTable();
  }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: CalculateEditorPositions — break when row/col position exceeds table bounds (lines 7973, 7982)
// ============================================================================
test("CalculateEditorPositions: break on row/col position > table bounds", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "cep-rowbreak");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.rowpanes = [{ first: 1, last: 10 }];
  ctx.colpanes = [{ first: 1, last: 10 }];

  // Positions grow beyond tableheight so the break at line 7973 triggers.
  editor.CalculateRowPositions = (_rp: number, arr: number[], arr2: number[]) => {
    for (let i = 0; i <= 10; i++) arr.push(0);
    arr[0] = arr[1] = 0;
    arr2[1] = 30;
    arr2[2] = 30;
    for (let r = 3; r <= 10; r++) arr2[r] = 30;
    arr[2] = 30;
    arr[3] = 60;
    arr[4] = 90;
    arr[5] = 120;
    arr[6] = 150;
    arr[7] = 180;
    arr[8] = 210;
    arr[9] = 240;
    arr[10] = 270;
  };
  editor.CalculateColPositions = (_cp: number, arr: number[], arr2: number[]) => {
    for (let i = 0; i <= 10; i++) arr.push(0);
    arr2[1] = 80;
    arr2[2] = 80;
    arr2[3] = 80;
    arr2[4] = 80;
    arr2[5] = 80;
    for (let r = 6; r <= 10; r++) arr2[r] = 80;
    arr[0] = arr[1] = 0;
    arr[2] = 30;
    arr[3] = 110;
    arr[4] = 190;
    arr[5] = 270;
    arr[6] = 350;
    arr[7] = 430;
    arr[8] = 510;
    arr[9] = 590;
    arr[10] = 670;
  };

  editor.tableheight = 100;
  editor.tablewidth = 200;
  editor.verticaltablecontrol.controlborder = 500;
  Object.assign(editor.verticaltablecontrol, {
    ComputeTableControlPositions: () => {},
  });
  editor.horizontaltablecontrol.controlborder = 500;
  Object.assign(editor.horizontaltablecontrol, {
    ComputeTableControlPositions: () => {},
  });

  sheetobj_init(ctx);

  const origGEP = SC.GetElementPosition;
  SC.GetElementPosition = () => ({ left: 0, top: 0 });

  {
    editor.CalculateEditorPositions();
  }
  expect(editor.lastvisiblerow).toBe(4);
  expect(editor.lastvisiblecol).toBe(4);

  SC.GetElementPosition = origGEP;
  teardownEditor(SC, editor);

  function sheetobj_init(c: ContextLike): void {
    c.sheetobj.colattribs = c.sheetobj.colattribs || { hide: {}, width: {} };
    c.sheetobj.rowattribs = c.sheetobj.rowattribs || { hide: {} };
  }
});

// ============================================================================
// TEST: PageRelative — newfirst == lastpane.first, direction > 0 (line 8158)
// ============================================================================
test("PageRelative: newfirst == lastpane.first with dir > 0", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pr-newfirst-eq");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.rowpanes = [{ first: 5, last: 10 }];
  ctx.colpanes = [{ first: 1, last: 10 }];
  sheetobj_init(ctx);

  // lastvisiblerow == lastpane.first so newfirst == lastpane.first → newfirst += 1.
  editor.lastvisiblerow = 5;
  editor.rowheight = [0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30];
  editor.tableheight = 200;
  editor.firstscrollingrowtop = 0;
  editor.gridposition = { left: 0, top: 0 };

  editor.LimitLastPanes = () => {};
  editor.FitToEditTable = () => {};
  editor.ScheduleRender = () => {};

  {
    SC.PageRelative(editor, true, 1);
    expect(ctx.rowpanes[0].first).toBe(6);
  }

  teardownEditor(SC, editor);

  function sheetobj_init(c: ContextLike): void {
    c.sheetobj.attribs = c.sheetobj.attribs || {};
    c.sheetobj.colattribs = c.sheetobj.colattribs || { hide: {}, width: {} };
    c.sheetobj.rowattribs = c.sheetobj.rowattribs || { hide: {} };
  }
});

// ============================================================================
// TEST: PageRelative — newfirst < 1 clamp (line 8174 sibling: newfirst = current - 1 is
// structurally unreachable since the for loop guarantees newfirst < current;
// but the `newfirst < 1` clamp at the next line IS reachable when lastpane.first == 1
// and the loop never decrements past 0.)
// ============================================================================
test("PageRelative: newfirst < 1 clamp with direction < 0", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pr-clamp-lt1");
  const editor = control.editor;

  const ctx = editor.context;
  // lastpane.first = 1 → for loop starts at newfirst=0, condition fails → newfirst stays 0.
  // current = 1. 0 >= 1 → false (skip clamp). 0 < 1 → newfirst = 1.
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  sheetobj_init(ctx);

  editor.lastvisiblerow = 3;
  editor.rowheight = [0, 30, 30, 30, 30];
  editor.tableheight = 200;
  editor.firstscrollingrowtop = 0;
  editor.gridposition = { left: 0, top: 0 };

  editor.LimitLastPanes = () => {};
  editor.FitToEditTable = () => {};
  editor.ScheduleRender = () => {};

  {
    SC.PageRelative(editor, true, -1);
    // newfirst should be clamped to 1.
    expect(ctx.rowpanes[0].first).toBe(1);
  }

  teardownEditor(SC, editor);

  function sheetobj_init(c: ContextLike): void {
    c.sheetobj.attribs = c.sheetobj.attribs || {};
    c.sheetobj.colattribs = c.sheetobj.colattribs || { hide: {}, width: {} };
    c.sheetobj.rowattribs = c.sheetobj.rowattribs || { hide: {} };
  }
});

// ============================================================================
// TEST: ScrollTableUpOneRow — rowspan break + bottomrownum continue (lines 8237, 8251)
// ============================================================================
test("ScrollTableUpOneRow: rowspan break + bottomrownum continue", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stur-gap-c");
  const editor = control.editor;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.colattribs = { hide: {}, width: {} };
  sheetobj.rowattribs = { hide: {} };
  sheetobj.cells = {};
  sheetobj.attribs = {};
  ctx.CalculateColWidthData = () => {};
  ctx.RenderRow = (_n: number, _p: number) => document.createElement("tr");
  ctx.showRCHeaders = true;

  const fakeTbody = {
    childNodes: [] as HTMLElement[],
    removeChild: () => {},
    appendChild: () => {},
    replaceChild: () => {},
  };
  for (let i = 0; i < 20; i++) {
    fakeTbody.childNodes.push(document.createElement("tr"));
  }
  editor.fullgrid = { lastChild: fakeTbody } as unknown as HTMLElement;
  editor.FitToEditTable = () => {};

  // rowspan break (line 8237):
  // first=1 → after increment: first=2, last=6. oldrownum = first-1 = 1.
  // coord = crToCoord(colnum, 1) = A1. cells["A1"] = {rowspan: 10} → maxrowspan=10.
  // for loop: rownum=1..9. break when rownum+oldrownum >= last(6).
  //   rownum=5: 5+1=6 >= 6 → YES → break (L8237).
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.cellskip = {};
  ctx.coordToCR = {};
  sheetobj.cells = {};
  sheetobj.cells["A1"] = { rowspan: 10 };
  {
    SC.ScrollTableUpOneRow(editor);
  }

  // bottomrownum continue (line 8251):
  // After first/last increment: first=3, last=7. bottomrownum = 7.
  // coord = cellskip[crToCoord(colnum, 7)] = cellskip["A7"].
  // If truthy: rownum = coordToCR["A7"].row = 7. 7 == last(7) → continue (L8251).
  ctx.rowpanes = [{ first: 2, last: 6 }];
  ctx.cellskip = {};
  sheetobj.cells = {};
  sheetobj.cells["A2"] = { rowspan: 2 };
  ctx.coordToCR = { A7: { row: 7, col: 1 } };
  ctx.cellskip = { A7: "A7" };
  {
    SC.ScrollTableUpOneRow(editor);
  }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ScrollTableDownOneRow — cellskip continue + rowspan break + bottom continue (lines 8291, 8300, 8320)
// ============================================================================
test("ScrollTableDownOneRow: cellskip, rowspan break, bottom continue", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stdr-gap-c");
  const editor = control.editor;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.colattribs = { hide: {}, width: {} };
  sheetobj.rowattribs = { hide: {} };
  sheetobj.cells = {};
  sheetobj.attribs = {};
  ctx.CalculateColWidthData = () => {};
  ctx.RenderRow = (_n: number, _p: number) => document.createElement("tr");
  ctx.showRCHeaders = true;

  const fakeTbody = {
    childNodes: [] as HTMLElement[],
    removeChild: () => {},
    appendChild: () => {},
    replaceChild: () => {},
    insertBefore: () => {},
  };
  for (let i = 0; i < 20; i++) {
    fakeTbody.childNodes.push(document.createElement("tr"));
  }
  editor.fullgrid = { lastChild: fakeTbody } as unknown as HTMLElement;
  editor.FitToEditTable = () => {};

  // cellskip continue (line 8291):
  // first=2 → after decrement: first=1, last=4. newrownum = first = 1.
  // coord = crToCoord(colnum, 1) = A1.If cellskip["A1"] truthy → continue.
  ctx.rowpanes = [{ first: 2, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.cellskip = { A1: "A1" };
  ctx.coordToCR = {};
  sheetobj.cells = {};
  {
    SC.ScrollTableDownOneRow(editor);
  }

  // rowspan break (line 8300):
  // first=2 → after decrement: first=1, last=4. newrownum = 1.
  // coord = crToCoord(colnum, 1) = A1. cells["A1"] = {rowspan: 5} → maxrowspan=5.
  // for loop: rownum=1..4. break when rownum+newrownum > last(4).
  //   rownum=4: 4+1=5 > 4 → YES → break (L8300).
  ctx.rowpanes = [{ first: 2, last: 5 }];
  ctx.cellskip = {};
  sheetobj.cells = {};
  sheetobj.cells["A1"] = { rowspan: 5 };
  {
    SC.ScrollTableDownOneRow(editor);
  }

  // bottom continue (line 8320):
  // first=3 → after decrement: first=2, last=5. bottomrownum = 5.
  // coord = crToCoord(colnum, 5) = A5. cellskip["A5"] = "A5" → coord = "A5".
  // coordToCR["A5"].row = 5. 5 == bottomrownum(5) → continue (L8320).
  ctx.rowpanes = [{ first: 3, last: 6 }];
  ctx.cellskip = {};
  sheetobj.cells = {};
  sheetobj.cells["A3"] = { rowspan: 2 };
  ctx.coordToCR = { A5: { row: 5, col: 1 } };
  ctx.cellskip = { A5: "A5" };
  {
    SC.ScrollTableDownOneRow(editor);
  }

  teardownEditor(SC, editor);
});
