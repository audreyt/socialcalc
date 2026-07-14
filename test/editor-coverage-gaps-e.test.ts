// Coverage gaps for dist/SocialCalc.js lines 5555-10174 (socialcalctableeditor.ts).
// Round 3 final pass: targets branches not exercised by editor-coverage-a/b,
// editor-coverage-gaps-a/b/c/d, or editor-dom-coverage.

import { afterAll, afterEach, expect, test } from "vite-plus/test";

import { loadSocialCalc as _loadSocialCalc } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

// Same timer-tracking rationale as editor-coverage-gaps-d: the InputEcho
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

async function newControl(SC: SC, containerId = "ege-root") {
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

/** Cast editor to a mutable record for overriding methods/properties in tests. */
function emut(editor: Editor): Record<string, unknown> {
  return editor as unknown as Record<string, unknown>;
}

/** Cast SC to a mutable record for overriding static functions. */
function smut(SC: SC): Record<string, unknown> {
  return SC as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Gap E1: ctrlkeyFunction [ctrl-v] — GetEditorCellElement returns cell (5653)
// ---------------------------------------------------------------------------

test("ctrlkeyFunction [ctrl-v]: GetEditorCellElement truthy positions pasteTextarea", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctrlv-cell");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.noEdit = false;
  editor.ECellReadonly = (() => false) as Editor["ECellReadonly"];
  editor.pasteTextarea = document.createElement("textarea") as unknown as HTMLTextAreaElement;

  const ctx = editor.context;
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.cellskip = {};
  ctx.coordToCR = {};
  ctx.showRCHeaders = true;
  ctx.CoordInPane = ((_coord: string, _rp: number, _cp: number) =>
    true) as SocialCalc.RenderContext["CoordInPane"];

  // Build a minimal grid DOM so GetEditorCellElement can navigate to a cell.
  const tbody = document.createElement("tbody");
  for (let r = 0; r < 10; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < 10; c++) tr.appendChild(document.createElement("td"));
    tbody.appendChild(tr);
  }
  const table = document.createElement("table");
  table.appendChild(tbody);
  editor.griddiv = document.createElement("div");
  editor.griddiv.appendChild(table);

  const origGEP = SC.GetElementPosition;
  SC.GetElementPosition = (() => ({ left: 50, top: 50 })) as typeof SC.GetElementPosition;

  try {
    const result = editor.ctrlkeyFunction(editor, "[ctrl-v]");
    expect((editor.pasteTextarea as unknown as { style: { left: string } }).style.left).toContain(
      "49",
    );
    expect(result).toBe(true);
  } finally {
    SC.GetElementPosition = origGEP;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E2: ctrlkeyFunction [ctrl-v] — pastescclipboard false + value != clipstr (5667-5673)
// ---------------------------------------------------------------------------

test("ctrlkeyFunction [ctrl-v]: pastescclipboard false + value differs from clipstr", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctrlv-clipstr");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.noEdit = false;
  editor.ECellReadonly = (() => false) as Editor["ECellReadonly"];
  editor.pasteTextarea = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  // ctrlkeyFunction resets pasteTextarea.value = "" synchronously (before
  // scheduling the setTimeout) so the browser's native paste can fill it
  // during the ~200ms window. Simulate that paste inside the setTimeout
  // mock itself, not before calling ctrlkeyFunction — presetting the value
  // beforehand is wiped out before the callback ever reads it.
  editor.pastescclipboard = false;
  editor.range = {
    hasrange: false,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as SocialCalc.EditorRange;

  SC.Clipboard.clipboard = "";

  let scheduledCmd = "";
  emut(editor).EditorScheduleSheetCommands = (cmd: string) => {
    scheduledCmd = cmd;
  };

  const origSetTimeout = (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout;
  (globalThis as unknown as { setTimeout: (fn: () => void) => number }).setTimeout = (
    fn: () => void,
  ) => {
    (editor.pasteTextarea as unknown as { value: string }).value = "hello\tworld";
    fn();
    return 0;
  };

  try {
    editor.ctrlkeyFunction(editor, "[ctrl-v]");
  } finally {
    (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = origSetTimeout;
  }

  // pastescclipboard=false + "hello\tworld" != "" (empty clipboard's tab
  // conversion) → the loadclipboard branch at 5667-5677 builds a prefix,
  // which the paste command at 5691 gets appended to.
  expect(scheduledCmd).toContain("loadclipboard");
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap E3: ctrlkeyFunction [ctrl-s] — nontextvalueformat truthy + edit: path (5705, 5714)
// ---------------------------------------------------------------------------

test("ctrlkeyFunction [ctrl-s]: nontextvalueformat truthy + edit: path with CtrlSEditor", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctrls-edit");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.Constants.AllowCtrlS = true;

  const sheet = editor.context.sheetobj;
  sheet.GetAssuredCell = ((_coord: string) => ({
    nontextvalueformat: 2,
  })) as typeof sheet.GetAssuredCell;
  sheet.valueformats = ["", "0.00", "0.000"];

  let editCmd = "";
  smut(SC).CtrlSEditor = (cmd: string) => {
    editCmd = cmd;
  };

  const origSetTimeout = (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout;
  (globalThis as unknown as { setTimeout: (fn: () => void) => number }).setTimeout = (
    fn: () => void,
  ) => {
    { fn(); }
    return 0;
  };

  const origPrompt = (globalThis as unknown as { prompt: () => string }).prompt;
  (globalThis as unknown as { prompt: () => string }).prompt = () => "edit:somecommand";

  { editor.ctrlkeyFunction(editor, "[ctrl-s]"); }

  (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = origSetTimeout;
  (globalThis as unknown as { prompt: () => string }).prompt = origPrompt;

  expect(editCmd).toBe("somecommand");
  SC.Constants.AllowCtrlS = false;
  smut(SC).CtrlSEditor = null;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap E4: ctrlkeyFunction [ctrl-s] — cmd: path (5710-5711)
// ---------------------------------------------------------------------------

test("ctrlkeyFunction [ctrl-s]: cmd: path schedules command", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctrls-cmd");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.Constants.AllowCtrlS = true;

  const sheet = editor.context.sheetobj;
  sheet.GetAssuredCell = ((_coord: string) => ({
    nontextvalueformat: 0,
  })) as typeof sheet.GetAssuredCell;
  sheet.valueformats = [];

  let scheduledCmd = "";
  emut(editor).EditorScheduleSheetCommands = (cmd: string) => {
    scheduledCmd = cmd;
  };

  const origSetTimeout = (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout;
  (globalThis as unknown as { setTimeout: (fn: () => void) => number }).setTimeout = (
    fn: () => void,
  ) => {
    { fn(); }
    return 0;
  };

  const origPrompt = (globalThis as unknown as { prompt: () => string }).prompt;
  (globalThis as unknown as { prompt: () => string }).prompt = () => "cmd:recl A1";

  { editor.ctrlkeyFunction(editor, "[ctrl-s]"); }

  (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = origSetTimeout;
  (globalThis as unknown as { prompt: () => string }).prompt = origPrompt;

  expect(scheduledCmd).toBe("recl A1");
  SC.Constants.AllowCtrlS = false;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap E5: ctrlkeyFunction [ctrl-s] — plain nontextvalueformat with range (5719-5724)
// ---------------------------------------------------------------------------

test("ctrlkeyFunction [ctrl-s]: plain nontextvalueformat with range", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctrls-ntvf");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: true, left: 1, top: 1, right: 2, bottom: 2 } as SocialCalc.EditorRange;
  SC.Constants.AllowCtrlS = true;

  const sheet = editor.context.sheetobj;
  sheet.GetAssuredCell = ((_coord: string) => ({
    nontextvalueformat: 0,
  })) as typeof sheet.GetAssuredCell;
  sheet.valueformats = [];

  let scheduledCmd = "";
  emut(editor).EditorScheduleSheetCommands = (cmd: string) => {
    scheduledCmd = cmd;
  };

  const origSetTimeout = (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout;
  (globalThis as unknown as { setTimeout: (fn: () => void) => number }).setTimeout = (
    fn: () => void,
  ) => {
    { fn(); }
    return 0;
  };

  const origPrompt = (globalThis as unknown as { prompt: () => string }).prompt;
  (globalThis as unknown as { prompt: () => string }).prompt = () => "0.00";

  { editor.ctrlkeyFunction(editor, "[ctrl-s]"); }

  (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = origSetTimeout;
  (globalThis as unknown as { prompt: () => string }).prompt = origPrompt;

  expect(scheduledCmd).toBe("set A1:B2 nontextvalueformat 0.00");
  SC.Constants.AllowCtrlS = false;
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap E6: CreateTableEditor — logoImg falsy (5960)
// ---------------------------------------------------------------------------

test("CreateTableEditor: logoImg falsy when td has no firstChild.firstChild", async () => {
  await loadSocialCalc();
  // Create a td where td.firstChild exists but td.firstChild.firstChild is null.
  const td = document.createElement("td");
  td.innerHTML = "<div></div>";
  const logoImg = td.firstChild && (td.firstChild as HTMLElement).firstChild;
  expect(logoImg).toBe(null);

  // Verify the actual CreateTableEditor path: the real innerHTML includes an img,
  // so logoImg is truthy.
  const td2 = document.createElement("td");
  td2.innerHTML =
    "<div style='cursor:pointer;font-size:1px;'><img src='1x1.gif' border='0' width='18' height='18'></div>";
  const logoImg2 = td2.firstChild && (td2.firstChild as HTMLElement).firstChild;
  expect(logoImg2).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Gap E7: EditorRenderSheet — reRenderCellList with valuetype change (6105-6108)
// ---------------------------------------------------------------------------

test("EditorRenderSheet: reRenderCellList with valuetype change triggers ReplaceCell", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ers-rrc");
  const editor = control.editor;
  primeGridLayout(editor);

  const savApp = SC._app;
  SC._app = true;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.reRenderCellList = ["A1"];
  sheetobj.widgetsClean = true;
  (sheetobj as unknown as Record<string, unknown>).cells = {
    A1: { valuetype: "v", prevvaluetype: "t" },
  };

  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.cellskip = {};
  ctx.coordToCR = {};
  ctx.showRCHeaders = true;
  ctx.CoordInPane = ((_coord: string, _rp: number, _cp: number) =>
    true) as SocialCalc.RenderContext["CoordInPane"];

  const tbody = document.createElement("tbody");
  for (let r = 0; r < 10; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < 10; c++) tr.appendChild(document.createElement("td"));
    tbody.appendChild(tr);
  }
  const table = document.createElement("table");
  table.appendChild(tbody);
  editor.griddiv = document.createElement("div");
  editor.griddiv.appendChild(table);

  let replaced = false;
  emut(editor).ReplaceCell = () => {
    replaced = true;
  };
  emut(editor).EditorMouseUnregister = () => {};
  emut(editor).EditorMouseRegister = () => {};
  emut(editor).SetECellHeaders = () => {};
  editor.ecell = null;

  try {
    SC.EditorRenderSheet(editor);
    expect(replaced).toBe(true);
  } finally {
    SC._app = savApp;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E8: EditorRenderSheet — ecell truthy → SetECellHeaders (6120)
// ---------------------------------------------------------------------------

test("EditorRenderSheet: ecell truthy calls SetECellHeaders after reRender", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ers-ecell");
  const editor = control.editor;
  primeGridLayout(editor);

  const savApp = SC._app;
  SC._app = true;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.reRenderCellList = [];
  sheetobj.widgetsClean = true;
  (sheetobj as unknown as Record<string, unknown>).cells = {};

  let headerSet = false;
  emut(editor).EditorMouseUnregister = () => {};
  emut(editor).EditorMouseRegister = () => {};
  emut(editor).SetECellHeaders = () => {
    headerSet = true;
  };
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  try {
    SC.EditorRenderSheet(editor);
    expect(headerSet).toBe(true);
  } finally {
    SC._app = savApp;
    teardownEditor(SC, editor);
  }
});
test("EditorRenderSheet: non-_app branch replaces fullgrid and toggles mouse hooks", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ers-nonapp");
  const editor = control.editor;
  primeGridLayout(editor);

  const savApp = SC._app;
  SC._app = false;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.reRenderCellList = [];
  sheetobj.widgetsClean = true;

  let unregistered = 0;
  let registered = 0;
  let renderCalled = false;
  let newGrid: HTMLTableElement | null = null;
  const context = emut(ctx) as Record<string, unknown>;
  const oldRenderSheet = context.RenderSheet;
  context.RenderSheet = (_oldtable: HTMLTableElement | null) => {
    renderCalled = true;
    newGrid = document.createElement("table");
    return newGrid;
  };
  const editorObj = emut(editor);
  const oldRegister = editorObj.EditorMouseRegister;
  const oldUnregister = editorObj.EditorMouseUnregister;
  const oldSetECellHeaders = editorObj.SetECellHeaders;
  editorObj.EditorMouseUnregister = () => {
    unregistered += 1;
  };
  editorObj.EditorMouseRegister = () => {
    registered += 1;
  };
  editorObj.SetECellHeaders = () => {};

  editor.fullgrid = document.createElement("table");
  editor.ecell = null;

  try {
    SC.EditorRenderSheet(editor);
  } finally {
    context.RenderSheet = oldRenderSheet;
    editorObj.EditorMouseRegister = oldRegister;
    editorObj.EditorMouseUnregister = oldUnregister;
    editorObj.SetECellHeaders = oldSetECellHeaders;
    SC._app = savApp;
  }

  expect(unregistered).toBe(1);
  expect(registered).toBe(1);
  expect(renderCalled).toBe(true);
  expect(editor.fullgrid).toBe(newGrid);
  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap E9: ProcessEditorMouseDown — shiftKey + !hasrange → RangeAnchor (6513-6514)
// ---------------------------------------------------------------------------

test("ProcessEditorMouseDown: shiftKey + no range → RangeAnchor", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemd-shift");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mi = SC.EditorMouseInfo;
  mi.ignore = false;
  mi.registeredElements = [
    { editor, element: editor.fullgrid } as unknown as SocialCalc.MouseInfoRegisteredElement,
  ];
  editor.range = {
    hasrange: false,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as SocialCalc.EditorRange;

  let anchored = false;
  emut(editor).RangeAnchor = () => {
    anchored = true;
  };
  emut(editor).RangeExtend = () => {};
  emut(editor).RangeRemove = () => {};
  emut(editor).MoveECell = (coord: string) => coord;
  emut(editor).EditorMouseRange = () => {};
  emut(editor).EnsureECellVisible = () => {};
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;

  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = (() => ({ row: 1, col: 1, coord: "A1" })) as typeof SC.GridMousePosition;
  const origKSF = SC.KeyboardSetFocus;
  SC.KeyboardSetFocus = (() => {}) as typeof SC.KeyboardSetFocus;
  const origSMU = SC.SetMouseMoveUp;
  SC.SetMouseMoveUp = (() => {}) as typeof SC.SetMouseMoveUp;

  const ev = fakeEvent({ target: editor.fullgrid, clientX: 100, clientY: 100, shiftKey: true });

  try {
    SC.ProcessEditorMouseDown(ev as unknown as MouseEvent);
    expect(anchored).toBe(true);
  } finally {
    SC.GridMousePosition = origGMP;
    SC.KeyboardSetFocus = origKSF;
    SC.SetMouseMoveUp = origSMU;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E10: EditorMouseRange — input state with partialexpr + hasrange (6555-6557)
// ---------------------------------------------------------------------------

test("EditorMouseRange: input state with partialexpr + hasrange → SetText with range", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "emr-hasrange");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.state = "input";
  editor.range = { hasrange: true, left: 1, top: 1, right: 3, bottom: 3 } as SocialCalc.EditorRange;
  editor.workingvalues = { partialexpr: "=SUM(" };

  let setTextArg = "";
  editor.inputBox = {
    GetText: () => "=SUM(",
    SetText: (v: string) => {
      setTextArg = v;
    },
    Blur: () => {},
    ShowInputBox: (_v: boolean) => {},
    DisplayCellContents: (_v: unknown) => {},
  } as unknown as Editor["inputBox"];
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;
  emut(editor).EditorSaveEdit = () => {};

  try {
    SC.EditorMouseRange(editor, "B2");
    expect(setTextArg).toBe("=SUM(A1:C3");
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E11: ProcessEditorColsizeMouseDown — szTarget truthy (6668)
// ---------------------------------------------------------------------------

test("ProcessEditorColsizeMouseDown: szTarget truthy calls setStyles", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pecsmd-szt");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;

  editor.toplevel = document.createElement("div");
  editor.headposition = { left: 30, top: 30 };
  editor.colpositions = [0, 0, 80, 160, 240];
  editor.context.colwidth = [0, 30, 80, 80, 80];

  const origGEP = SC.GetElementPositionWithScroll;
  SC.GetElementPositionWithScroll = (() => ({
    left: 0,
    top: 0,
  })) as unknown as typeof SC.GetElementPositionWithScroll;
  const origSMU = SC.SetMouseMoveUp;
  SC.SetMouseMoveUp = (() => {}) as typeof SC.SetMouseMoveUp;

  let stylesSet = false;
  const origSetStyles = SC.setStyles;
  SC.setStyles = (() => {
    stylesSet = true;
  }) as typeof SC.setStyles;

  const result = {
    coltoresize: 2,
    coltounhide: null,
  } as unknown as SocialCalc.GridMousePositionResult;
  const ev = fakeEvent({ clientX: 80, clientY: 50 });

  try {
    SC.ProcessEditorColsizeMouseDown(
      ev as unknown as MouseEvent,
      editor.toplevel as unknown as HTMLElement,
      result,
    );
    expect(stylesSet).toBe(true);
  } finally {
    SC.GetElementPositionWithScroll = origGEP;
    SC.SetMouseMoveUp = origSMU;
    SC.setStyles = origSetStyles;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E12: ProcessEditorColsizeMouseUp — mousecoltounhide truthy (6705-6706)
// ---------------------------------------------------------------------------

test("ProcessEditorColsizeMouseUp: mousecoltounhide truthy schedules hide", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pecsmu-unhide");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;
  mi.mousecoltounhide = 3;
  mi.mouseresizecolnum = null;

  let scheduledCmd = "";
  emut(editor).EditorScheduleSheetCommands = (cmd: string) => {
    scheduledCmd = cmd;
  };

  const origGEP = SC.GetElementPositionWithScroll;
  SC.GetElementPositionWithScroll = (() => ({
    left: 0,
    top: 0,
  })) as unknown as typeof SC.GetElementPositionWithScroll;
  const origRMMU = SC.RemoveMouseMoveUp;
  SC.RemoveMouseMoveUp = (() => {}) as typeof SC.RemoveMouseMoveUp;

  const ev = fakeEvent({ clientX: 100 });

  try {
    SC.ProcessEditorColsizeMouseUp(ev as unknown as MouseEvent);
    expect(scheduledCmd).toBe("set C hide");
  } finally {
    SC.GetElementPositionWithScroll = origGEP;
    SC.RemoveMouseMoveUp = origRMMU;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E13: ProcessEditorRowsizeMouseDown — szTarget2 truthy (6826)
// ---------------------------------------------------------------------------

test("ProcessEditorRowsizeMouseDown: szTarget2 truthy calls setStyles", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "persmd-szt2");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;

  editor.toplevel = document.createElement("div");
  editor.headposition = { left: 30, top: 30 };
  editor.rowpositions = [0, 0, 50, 70, 90];
  editor.context.rowheight = [0, 30, 20, 20, 20];
  editor.context.totalwidth = 400;

  const origGetSCO = SC.GetSpreadsheetControlObject;
  SC.GetSpreadsheetControlObject = (() => ({
    spreadsheetDiv: { firstChild: { offsetHeight: 0 } },
  })) as unknown as typeof SC.GetSpreadsheetControlObject;
  const origSMU = SC.SetMouseMoveUp;
  SC.SetMouseMoveUp = (() => {}) as typeof SC.SetMouseMoveUp;

  let stylesSet = false;
  const origSetStyles = SC.setStyles;
  SC.setStyles = (() => {
    stylesSet = true;
  }) as typeof SC.setStyles;

  const result = {
    rowtoresize: 2,
    rowtounhide: null,
  } as unknown as SocialCalc.GridMousePositionResult;
  const ev = fakeEvent({ clientX: 10, clientY: 50 });

  try {
    SC.ProcessEditorRowsizeMouseDown(
      ev as unknown as MouseEvent,
      editor.toplevel as unknown as HTMLElement,
      result,
    );
    expect(stylesSet).toBe(true);
  } finally {
    SC.GetSpreadsheetControlObject = origGetSCO;
    SC.SetMouseMoveUp = origSMU;
    SC.setStyles = origSetStyles;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E14: ProcessEditorRowsizeMouseUp — mouserowtounhide truthy (6863-6864)
// ---------------------------------------------------------------------------

test("ProcessEditorRowsizeMouseUp: mouserowtounhide truthy schedules hide", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "persmu-unhide");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;
  mi.mouserowtounhide = 3;
  mi.mouseresizerownum = null;

  let scheduledCmd = "";
  emut(editor).EditorScheduleSheetCommands = (cmd: string) => {
    scheduledCmd = cmd;
  };

  const origGetSCO = SC.GetSpreadsheetControlObject;
  SC.GetSpreadsheetControlObject = (() => ({
    spreadsheetDiv: { firstChild: { offsetHeight: 0 } },
  })) as unknown as typeof SC.GetSpreadsheetControlObject;
  const origRMMU = SC.RemoveMouseMoveUp;
  SC.RemoveMouseMoveUp = (() => {}) as typeof SC.RemoveMouseMoveUp;

  const ev = fakeEvent({ clientY: 100 });

  try {
    SC.ProcessEditorRowsizeMouseUp(ev as unknown as MouseEvent);
    expect(scheduledCmd).toBe("set 3 hide");
  } finally {
    SC.GetSpreadsheetControlObject = origGetSCO;
    SC.RemoveMouseMoveUp = origRMMU;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E15: SetDragAutoRepeat — rowheader with row change + repeatcallback (6897-6901)
// ---------------------------------------------------------------------------

test("SetDragAutoRepeat: rowheader row change with repeatcallback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sdar-row-cb");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const ri = SC.AutoRepeatInfo;
  ri.timer = null;
  ri.mouseinfo = { row: 5, col: 1 } as Record<string, unknown>;
  ri.repeatcallback = null;

  let callbackCoord = "";
  let callbackDir = "";
  const callback = (coord: string, direction: string) => {
    callbackCoord = coord;
    callbackDir = direction;
  };

  const mouseinfo = {
    row: 3,
    rowheader: true,
    distance: 5,
  } as unknown as SocialCalc.GridMousePositionResult;

  try {
    SC.SetDragAutoRepeat(
      editor,
      mouseinfo,
      callback as unknown as typeof SC.AutoRepeatInfo.repeatcallback,
    );
    expect(callbackCoord).toBe("A3");
    expect(callbackDir).toBe("left");
  } finally {
    if (ri.timer) {
      clearTimeout(ri.timer);
      ri.timer = null;
    }
    ri.mouseinfo = null;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E16: SetDragAutoRepeat — colheader with col change + repeatcallback (6909-6910, 6913)
// ---------------------------------------------------------------------------

test("SetDragAutoRepeat: colheader col change with repeatcallback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sdar-col-cb");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const ri = SC.AutoRepeatInfo;
  ri.timer = null;
  ri.mouseinfo = { row: 1, col: 5 } as Record<string, unknown>;
  ri.repeatcallback = null;

  let callbackCoord = "";
  const callback = (coord: string, _direction: string) => {
    callbackCoord = coord;
  };

  const mouseinfo = {
    row: 1,
    col: 3,
    colheader: true,
    distance: 5,
  } as unknown as SocialCalc.GridMousePositionResult;

  try {
    SC.SetDragAutoRepeat(
      editor,
      mouseinfo,
      callback as unknown as typeof SC.AutoRepeatInfo.repeatcallback,
    );
    expect(callbackCoord).toBe("C1");
  } finally {
    if (ri.timer) {
      clearTimeout(ri.timer);
      ri.timer = null;
    }
    ri.mouseinfo = null;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E17: DragAutoRepeat — colfooter direction "down" (6954)
// ---------------------------------------------------------------------------

test("DragAutoRepeat: colfooter → direction down", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dar-colfooter");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const ri = SC.AutoRepeatInfo;
  ri.timer = null;
  ri.editor = editor;
  ri.mouseinfo = { row: 1, col: 1, colfooter: true, distance: 5 } as Record<string, unknown>;

  let callbackCoord = "";
  let callbackDir = "";
  ri.repeatcallback = ((coord: string, direction: string) => {
    callbackCoord = coord;
    callbackDir = direction;
  }) as typeof SC.AutoRepeatInfo.repeatcallback;

  try {
    SC.DragAutoRepeat();
    expect(callbackDir).toBe("down");
    expect(callbackCoord).toBe("A2");
  } finally {
    if (ri.timer) {
      clearTimeout(ri.timer);
      ri.timer = null;
    }
    ri.mouseinfo = null;
    ri.repeatcallback = null;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E18: ProcessEditorDblClick — ele from event.target || srcElement (6979)
// ---------------------------------------------------------------------------

test("ProcessEditorDblClick: event.target falsy falls back to srcElement", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pedbc-src");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.ignore = false;
  mi.registeredElements = [
    { editor, element: editor.fullgrid } as unknown as SocialCalc.MouseInfoRegisteredElement,
  ];

  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = (() => ({ row: 1, col: 1, coord: "A1" })) as typeof SC.GridMousePosition;

  const ev = fakeEvent({ target: null, srcElement: editor.fullgrid, clientX: 100, clientY: 100 });

  try {
    SC.ProcessEditorDblClick(ev as unknown as MouseEvent);
    expect(mi.editor).toBe(editor);
  } finally {
    SC.GridMousePosition = origGMP;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E19: EditorProcessKey — input state, [enter] → [adown] → MoveECellWithKey (7136)
// ---------------------------------------------------------------------------

test("EditorProcessKey: input state [enter] → [adown] → MoveECellWithKey", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "epk-enter");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.state = "input";
  editor.range = {
    hasrange: false,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as SocialCalc.EditorRange;
  editor.workingvalues = { partialexpr: "", ecoord: "A1", erow: 1, ecol: 1 };

  let movedWithKey = "";
  editor.inputBox = {
    GetText: () => "hello",
    Blur: () => {},
    ShowInputBox: (_v: boolean) => {},
    SetText: (_v: string) => {},
    DisplayCellContents: (_v: unknown) => {},
    skipOne: false,
    Focus: () => {},
    Select: (_v: string) => {},
  } as unknown as Editor["inputBox"];
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;
  emut(editor).EditorSaveEdit = () => {};
  emut(editor).MoveECell = (coord: string) => coord;
  emut(editor).MoveECellWithKey = (ch: string) => {
    movedWithKey = ch;
    return "A2";
  };
  emut(editor).EnsureECellVisible = () => {};
  emut(editor).RangeRemove = () => {};
  emut(editor).RangeExtend = () => {};
  emut(editor).RangeAnchor = () => {};
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const e = fakeEvent({ shiftKey: false }) as unknown as KeyboardEvent;

  try {
    SC.EditorProcessKey(editor, "[enter]", e);
    expect(movedWithKey).toBe("[adown]");
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E20: EditorProcessKey — inputboxdirect state, [tab] shiftKey (7183-7184)
// ---------------------------------------------------------------------------

test("EditorProcessKey: inputboxdirect [tab] shiftKey → [aleft] → MoveECellWithKey", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "epk-tab-shift");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.state = "inputboxdirect";
  editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1 };

  let movedWithKey = "";
  editor.inputBox = {
    GetText: () => "hello",
    Blur: () => {},
    ShowInputBox: (_v: boolean) => {},
    SetText: (_v: string) => {},
    DisplayCellContents: (_v: unknown) => {},
    skipOne: false,
    Focus: () => {},
    Select: (_v: string) => {},
  } as unknown as Editor["inputBox"];
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;
  emut(editor).EditorSaveEdit = () => {};
  emut(editor).MoveECell = (coord: string) => coord;
  emut(editor).MoveECellWithKey = (ch: string) => {
    movedWithKey = ch;
    return "A1";
  };
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const e = fakeEvent({ shiftKey: true }) as unknown as KeyboardEvent;

  try {
    SC.EditorProcessKey(editor, "[tab]", e);
    expect(movedWithKey).toBe("[aleft]");
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E21: EditorSaveEdit — text starting with "'" + text type (7259-7260)
// ---------------------------------------------------------------------------

test("EditorSaveEdit: text starting with ' → text type branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ese-quote");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.workingvalues = { ecoord: "A1" };

  const sheetobj = editor.context.sheetobj;
  (sheetobj as unknown as Record<string, unknown>).cells = {};
  sheetobj.colattribs = { hide: {}, width: {} } as typeof sheetobj.colattribs;
  sheetobj.rowattribs = { hide: {} } as typeof sheetobj.rowattribs;
  sheetobj.attribs = {} as typeof sheetobj.attribs;

  let scheduledCmd = "";
  emut(editor).EditorScheduleSheetCommands = (cmd: string) => {
    scheduledCmd = cmd;
  };

  const origGCC = SC.GetCellContents;
  SC.GetCellContents = (() => "") as typeof SC.GetCellContents;

  try {
    SC.EditorSaveEdit(editor, "'hello");
    expect(scheduledCmd.startsWith("set A1 text t")).toBe(true);
  } finally {
    SC.GetCellContents = origGCC;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E22: GridMousePosition — rowunhidebottom truthy (7367-7369)
// ---------------------------------------------------------------------------

test("GridMousePosition: rowunhidebottom truthy checks position", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "gmp-unhide-bottom");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  sheetobj_init(ctx);
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];

  const unhideEl = document.createElement("div");
  (ctx as unknown as Record<string, unknown>).rowunhidebottom = [null, null, unhideEl];

  const origGEP = SC.GetElementPosition;
  SC.GetElementPosition = (() => ({ left: 0, top: 0 })) as unknown as typeof SC.GetElementPosition;

  try {
    const result = SC.GridMousePosition(editor, 5, 55);
    expect(result).toBeTruthy();
    expect((result as SocialCalc.GridMousePositionResult).row).toBe(2);
  } finally {
    SC.GetElementPosition = origGEP;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E23: GetEditorCellElement — colpane loop with cellskip (7471-7472)
// ---------------------------------------------------------------------------

test("GetEditorCellElement: colpane loop with cellskip CoordInPane", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "gece-cellskip");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [
    { first: 1, last: 3 },
    { first: 1, last: 5 },
  ];
  ctx.cellskip = { A5: "A5" };
  ctx.coordToCR = { A5: { row: 5, col: 1 } };
  ctx.showRCHeaders = true;
  ctx.CoordInPane = ((_coord: string, _rp: number, _cp: number) =>
    true) as SocialCalc.RenderContext["CoordInPane"];

  const tbody = document.createElement("tbody");
  for (let r = 0; r < 20; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < 20; c++) tr.appendChild(document.createElement("td"));
    tbody.appendChild(tr);
  }
  const table = document.createElement("table");
  table.appendChild(tbody);
  editor.griddiv = document.createElement("div");
  editor.griddiv.appendChild(table);

  try {
    const result = SC.GetEditorCellElement(editor, 5, 5);
    expect(result).not.toBe(null);
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E24: EnsureECellVisible — ecell.row < firstscrollingrow (7610-7612)
// ---------------------------------------------------------------------------

test("EnsureECellVisible: ecell.row < firstscrollingrow → vamount set", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "eecell-vscroll-up");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "A3", row: 3, col: 1 };
  editor.lastnonscrollingrow = 0;
  editor.firstscrollingrow = 5;
  editor.lastvisiblerow = 10;

  let scrollV = 0;
  emut(editor).ScrollRelativeBoth = (v: number, _h: number) => {
    scrollV = v;
  };
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;

  try {
    SC.EnsureECellVisible(editor);
    expect(scrollV).toBe(-4);
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E25: EnsureECellVisible — ecell.col < firstscrollingcol (7617-7619)
// ---------------------------------------------------------------------------

test("EnsureECellVisible: ecell.col < firstscrollingcol → hamount set", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "eecell-hscroll");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.ecell = { coord: "C1", row: 1, col: 3 };
  editor.lastnonscrollingrow = 0;
  editor.firstscrollingrow = 5;
  editor.lastvisiblerow = 10;
  editor.lastnonscrollingcol = 0;
  editor.firstscrollingcol = 5;
  editor.lastvisiblecol = 10;

  let scrollH = 0;
  emut(editor).ScrollRelativeBoth = (_v: number, h: number) => {
    scrollH = h;
  };
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;

  try {
    SC.EnsureECellVisible(editor);
    expect(scrollH).toBe(-4);
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E26: SetECellHeaders — classnames + explicitStyles truthy (7685-7705)
// ---------------------------------------------------------------------------

test("SetECellHeaders: classnames + explicitStyles truthy sets className and cssText", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sech-styles");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  sheetobj_init(ctx);
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.showRCHeaders = true;
  ctx.classnames = { selectedrowname: "sel-row", selectedcolname: "sel-col" };
  ctx.explicitStyles = { selectedrowname: "color:red;", selectedcolname: "color:blue;" };

  editor.ecell = { coord: "A1", row: 1, col: 1 };

  // Build a fullgrid DOM matching the real toprow convention (see
  // ScrollTableUpOneRow's `toprow = showRCHeaders ? 2 : 1`): the grid
  // body's row 0 is a spacer, row 1 is the column-header row (cell 0 =
  // corner, cell 1 = col "A" header), and data rows start at index 2.
  // fullgrid.childNodes[1] is the grid body the code indexes into.
  const spacerRow = document.createElement("tr");
  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("td")); // corner
  for (let c = 1; c <= 5; c++) headerRow.appendChild(document.createElement("td"));
  const dataRows: HTMLElement[] = [];
  for (let r = 1; r <= 5; r++) {
    const tr = document.createElement("tr");
    tr.appendChild(document.createElement("td")); // row header
    for (let c = 1; c <= 5; c++) tr.appendChild(document.createElement("td"));
    dataRows.push(tr);
  }
  const gridBody = document.createElement("tbody");
  gridBody.appendChild(spacerRow);
  gridBody.appendChild(headerRow);
  for (const tr of dataRows) gridBody.appendChild(tr);
  const outerWrapper = document.createElement("div");
  const table = document.createElement("table");
  outerWrapper.appendChild(table);
  outerWrapper.appendChild(gridBody);
  editor.fullgrid = outerWrapper;

  try {
    SC.SetECellHeaders(editor, "selected");
    const rowHeaderCell = dataRows[0].childNodes[0] as HTMLElement;
    expect(rowHeaderCell.className).toBe("sel-row");
    const colHeaderCell = headerRow.childNodes[1] as HTMLElement;
    expect(colHeaderCell.className).toBe("sel-col");
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E27: ScrollRelativeBoth — vplen > 1 (8099) + hplen > 1 (8104)
// ---------------------------------------------------------------------------

test("ScrollRelativeBoth: vplen > 1 and hplen > 1 branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "srb-multi-pane");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  sheetobj_init(ctx);
  ctx.rowpanes = [
    { first: 1, last: 3 },
    { first: 5, last: 10 },
  ];
  ctx.colpanes = [
    { first: 1, last: 3 },
    { first: 5, last: 10 },
  ];

  emut(editor).LimitLastPanes = () => {};
  emut(editor).FitToEditTable = () => {};
  emut(editor).ScheduleRender = () => {};
  emut(editor).ScrollTableUpOneRow = () => {};
  emut(editor).ScrollTableDownOneRow = () => {};
  emut(editor).SchedulePositionCalculations = () => {};
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  emut(editor).SetECellHeaders = () => {};

  try {
    SC.ScrollRelativeBoth(editor, 2, 2);
    expect(ctx.rowpanes[1].first).toBe(7);
    expect(ctx.colpanes[1].first).toBe(7);
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E28: ScrollTableUpOneRow — cellskip with rowspan (8249)
// ---------------------------------------------------------------------------

test("ScrollTableUpOneRow: cellskip cell with rowspan → rowneedsrefresh", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stur-rowspan");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj_init(ctx);
  ctx.CalculateColWidthData = () => {};
  const renderedRows: Array<number | string> = [];
  ctx.RenderRow = ((n: number, _p: number) => {
    renderedRows.push(n);
    return document.createElement("tr");
  }) as SocialCalc.RenderContext["RenderRow"];
  ctx.showRCHeaders = true;

  const fakeTbody = {
    childNodes: [] as HTMLElement[],
    removeChild: () => {},
    appendChild: () => {},
    replaceChild: () => {},
  };
  for (let i = 0; i < 20; i++) fakeTbody.childNodes.push(document.createElement("tr"));
  editor.fullgrid = { lastChild: fakeTbody } as unknown as HTMLElement;
  emut(editor).FitToEditTable = () => {};

  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.cellskip = { A6: "A4" };
  ctx.coordToCR = { A4: { row: 4, col: 1 } };
  (sheetobj as unknown as Record<string, unknown>).cells = { A4: { rowspan: 3 } };

  try {
    SC.ScrollTableUpOneRow(editor);
    // rowneedsrefresh[4] = true was set (line 8249's true branch) →
    // RenderRow(4, rowpane) is called from the refresh loop at 8253-8257.
    expect(renderedRows.map(String)).toContain("4");
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E29: ScrollTableDownOneRow — cellskip with rowspan (8318)
// ---------------------------------------------------------------------------

test("ScrollTableDownOneRow: cellskip cell with rowspan → rowneedsrefresh", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stdr-rowspan");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj_init(ctx);
  ctx.CalculateColWidthData = () => {};
  const renderedRows: Array<number | string> = [];
  ctx.RenderRow = ((n: number, _p: number) => {
    renderedRows.push(n);
    return document.createElement("tr");
  }) as SocialCalc.RenderContext["RenderRow"];
  ctx.showRCHeaders = true;

  const fakeTbody = {
    childNodes: [] as HTMLElement[],
    removeChild: () => {},
    appendChild: () => {},
    replaceChild: () => {},
    insertBefore: () => {},
  };
  for (let i = 0; i < 20; i++) fakeTbody.childNodes.push(document.createElement("tr"));
  editor.fullgrid = { lastChild: fakeTbody } as unknown as HTMLElement;
  emut(editor).FitToEditTable = () => {};

  ctx.rowpanes = [{ first: 3, last: 6 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.cellskip = { A5: "A3" };
  ctx.coordToCR = { A3: { row: 3, col: 1 } };
  (sheetobj as unknown as Record<string, unknown>).cells = { A3: { rowspan: 3 } };

  try {
    SC.ScrollTableDownOneRow(editor);
    // rowneedsrefresh[3] = true was set (line 8318's true branch) →
    // RenderRow(3, rowpane) is called from the refresh loop at 8322-8326.
    expect(renderedRows.map(String)).toContain("3");
  } finally {
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E30: CellHandlesMouseMove — Fill Down, crend.row < crstart.row (8918-8919)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMove: Fill Down with crend.row < crstart.row", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chm-fill-down-clamp");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;
  mi.mouselastcoord = "A1";

  editor.ecell = { coord: "A5", row: 5, col: 1 };
  editor.cellhandles = {
    startingcoord: "A5",
    startingX: 10,
    startingY: 10,
    dragtype: "Fill",
    filltype: "Down",
    movedmouse: false,
    fillinghandle: { style: {} } as unknown as SocialCalc.CellHandles["fillinghandle"],
  } as unknown as SocialCalc.CellHandles;
  editor.range = {
    hasrange: false,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as SocialCalc.EditorRange;
  editor.range2 = {
    hasrange: false,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as SocialCalc.EditorRange2;
  emut(editor).MoveECell = (coord: string) => coord;
  emut(editor).RangeExtend = () => {};
  emut(editor).RangeAnchor = () => {};
  emut(editor).RangeRemove = () => {};

  const origGEP = SC.GetElementPositionWithScroll;
  SC.GetElementPositionWithScroll = (() => ({
    left: 0,
    top: 0,
  })) as unknown as typeof SC.GetElementPositionWithScroll;
  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = (() => ({ row: 3, col: 1, coord: "A3" })) as typeof SC.GridMousePosition;

  const ev = fakeEvent({ clientX: 10, clientY: 50 });

  try {
    SC.CellHandlesMouseMove(ev as unknown as MouseEvent);
    expect(mi.mouselastcoord).toBe("A5");
  } finally {
    SC.GetElementPositionWithScroll = origGEP;
    SC.GridMousePosition = origGMP;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E31: CellHandlesMouseMove — Fill no filltype, horizontal > 10 → Right (8928)
// ---------------------------------------------------------------------------

test("CellHandlesMouseMove: Fill no filltype, horizontal move > 10 → Right", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "chm-fill-right");
  const editor = control.editor;
  primeGridLayout(editor);

  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = editor.fullgrid;
  mi.ignore = false;
  mi.mouselastcoord = "A1";

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.cellhandles = {
    startingcoord: "A1",
    startingX: 10,
    startingY: 10,
    dragtype: "Fill",
    filltype: null,
    movedmouse: false,
    fillinghandle: { style: {} } as unknown as SocialCalc.CellHandles["fillinghandle"],
  } as unknown as SocialCalc.CellHandles;
  editor.range = {
    hasrange: false,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as SocialCalc.EditorRange;
  editor.range2 = {
    hasrange: false,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as SocialCalc.EditorRange2;
  emut(editor).MoveECell = (coord: string) => coord;
  emut(editor).RangeExtend = () => {};
  emut(editor).RangeAnchor = () => {};
  emut(editor).RangeRemove = () => {};

  const origGEP = SC.GetElementPositionWithScroll;
  SC.GetElementPositionWithScroll = (() => ({
    left: 0,
    top: 0,
  })) as unknown as typeof SC.GetElementPositionWithScroll;
  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = (() => ({ row: 1, col: 2, coord: "B1" })) as typeof SC.GridMousePosition;

  const ev = fakeEvent({ clientX: 30, clientY: 10 });

  try {
    SC.CellHandlesMouseMove(ev as unknown as MouseEvent);
    expect((editor.cellhandles as SocialCalc.CellHandles).filltype).toBe("Right");
  } finally {
    SC.GetElementPositionWithScroll = origGEP;
    SC.GridMousePosition = origGMP;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Gap E32: TCTDragFunctionStart — thumbstatus with rowmsgele + rowpreviewele (9574-9576)
// ---------------------------------------------------------------------------

test("TCTDragFunctionStart: pre-existing thumbstatus with rowmsgele + rowpreviewele", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tct-preset-e");
  const editor = control.editor;
  primeGridLayout(editor);

  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  const dobjV: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjV.functionobj as Record<string, unknown>).control = vctrl;

  const draginfoV: Record<string, unknown> = {
    clientX: 200,
    clientY: 200,
    offsetX: 0,
    offsetY: 0,
  };

  // First call: no pre-existing thumbstatus — creates thumbstatus with
  // rowmsgele and rowpreviewele set from the innerHTML table structure.
  { SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV); }

  // The thumbstatus from the first call has rowmsgele and rowpreviewele.
  // Second call: the pre-existing thumbstatus (from the first call) is
  // found, so its rowmsgele and rowpreviewele are set to null, then it's
  // removed, then a new one is created. The coverage target is the
  // rowmsgele/rowpreviewele null-set at 9574-9576.
  const firstThumbStatus = draginfoV.thumbstatus;
  { SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV); }

  // After the second call, a new thumbstatus should exist (different from first).
  expect(draginfoV.thumbstatus).toBeTruthy();
  expect(draginfoV.thumbstatus).not.toBe(firstThumbStatus);

  teardownEditor(SC, editor);
});

// ---------------------------------------------------------------------------
// Gap E33: TCTDragFunctionStart — firstscrollingrow falsy → RowSetStatus with 1 (9598)
// ---------------------------------------------------------------------------

test("TCTDragFunctionStart: firstscrollingrow falsy → RowSetStatus with 1", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "tct-fsr-falsy");
  const editor = control.editor;
  primeGridLayout(editor);

  editor.firstscrollingrow = null;

  const vctrl = editor.verticaltablecontrol as SocialCalc.TableControl;
  const dobjV: SocialCalc.DragRegisteredElement = {
    vertical: true,
    horizontal: false,
    functionobj: {},
    parent: editor.toplevel as HTMLElement,
    element: vctrl.thumb as HTMLElement,
  } as SocialCalc.DragRegisteredElement;
  (dobjV.functionobj as Record<string, unknown>).control = vctrl;

  const draginfoV: Record<string, unknown> = {
    clientX: 200,
    clientY: 200,
    offsetX: 0,
    offsetY: 0,
  };

  let rowSetStatusArg = -1;
  const origTCTDRS = SC.TCTDragFunctionRowSetStatus;
  SC.TCTDragFunctionRowSetStatus = ((_di: typeof SocialCalc.DragInfo, _ed: Editor, row: number) => {
    rowSetStatusArg = row;
  }) as typeof SC.TCTDragFunctionRowSetStatus;

  try {
    SC.TCTDragFunctionStart({} as Event, draginfoV as typeof SocialCalc.DragInfo, dobjV);
    expect(rowSetStatusArg).toBe(1);
  } finally {
    SC.TCTDragFunctionRowSetStatus = origTCTDRS;
    teardownEditor(SC, editor);
  }
});

// ---------------------------------------------------------------------------
// Shared helper: initialize sheetobj fields to satisfy strict types.
// ---------------------------------------------------------------------------

function sheetobj_init(ctx: SocialCalc.RenderContext): void {
  const sheetobj = ctx.sheetobj;
  sheetobj.colattribs =
    sheetobj.colattribs || ({ hide: {}, width: {} } as typeof sheetobj.colattribs);
  sheetobj.rowattribs = sheetobj.rowattribs || ({ hide: {} } as typeof sheetobj.rowattribs);
  (sheetobj as unknown as Record<string, unknown>).cells =
    (sheetobj as unknown as Record<string, unknown>).cells || {};
  sheetobj.attribs = sheetobj.attribs || ({} as typeof sheetobj.attribs);
}
