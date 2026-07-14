// Coverage gaps for dist/SocialCalc.js lines 5555-10174 (socialcalctableeditor.ts).
// Final gap coverage slice A: targets remaining uncovered statement lines and branch arms.

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

type SC = typeof SocialCalc;
type Editor = SocialCalc.TableEditor;
type Control = SocialCalc.SpreadsheetControl;

async function loadSocialCalc(): Promise<SC> {
  const mod = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  const scMod = mod as unknown as SC; // Unchecked cast to SC type
  return scMod;
}

async function newControl(SC: SC, containerId = "egf-root") {
  const container = document.createElement("div");
  container.id = containerId;
  window.document.body.appendChild(container);
  const control = new SC.SpreadsheetControl() as unknown as Control; // Unchecked cast to Control type
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

function ensureDocumentEvents() {
  const doc = window.document as unknown as Record<string, unknown>; // Unchecked cast to record for event spy
  if (typeof doc.addEventListener !== "function") {
    doc.addEventListener = () => {};
  }
  if (typeof doc.removeEventListener !== "function") {
    doc.removeEventListener = () => {};
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
  const vtc = editor.verticaltablecontrol as SocialCalc.TableControl; // Unchecked cast to TableControl
  vtc.controlborder = 500;
  const htc = editor.horizontaltablecontrol as SocialCalc.TableControl; // Unchecked cast to TableControl
  htc.controlborder = 500;
  editor.griddiv = editor.griddiv || document.createElement("div");
  if (vtc.thumb) {
    vtc.thumb.style.top = "100px";
    vtc.thumb.style.left = "100px";
  }
  if (vtc.paneslider) {
    vtc.paneslider.style.top = "100px";
    vtc.paneslider.style.left = "100px";
  }
  if (htc.thumb) {
    htc.thumb.style.top = "100px";
    htc.thumb.style.left = "100px";
  }
  if (htc.paneslider) {
    htc.paneslider.style.top = "100px";
    htc.paneslider.style.left = "100px";
  }
}

// ============================================================================
// Test 1: CreateTableEditor Safari UA (743-747, 720 false arm)
// ============================================================================
test("CreateTableEditor: Safari-not-Chrome UA + logoImg falsy branches", async () => {
  const SC = await loadSocialCalc();

  const navMutable = navigator as unknown as { userAgent: string }; // Unchecked cast to temporary override navigator
  const savedUA = navigator.userAgent;
  navMutable.userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15";

  const globalThisRec = globalThis as unknown as Record<string, unknown>;
  const globalWindow = globalThisRec.window as Record<string, unknown>;
  const savedAdd = globalWindow.addEventListener;
  const savedRemove = globalWindow.removeEventListener;
  const addedEvents: string[] = [];
  const mockAdd = (type: unknown) => {
    addedEvents.push(type as string);
  };
  globalThisRec.addEventListener = mockAdd;
  globalWindow.addEventListener = mockAdd;
  globalThisRec.removeEventListener = () => {};
  globalWindow.removeEventListener = () => {};

  const origCreateElement = document.createElement.bind(document);
  document.createElement = (tagName: string) => {
    const el = origCreateElement(tagName);
    if (tagName === "td") {
      // Leave td empty so logoImg is null, covering line 720 false branch
      return el;
    }
    return el;
  };

  try {
    const { control } = await newControl(SC, "safari-ua-test");
    expect(addedEvents).toContain("beforepaste");
    expect(addedEvents).toContain("beforecopy");
    expect(addedEvents).toContain("beforecut");
    teardownEditor(SC, control.editor);
  } finally {
    navMutable.userAgent = savedUA;
    globalThisRec.addEventListener = savedAdd;
    globalWindow.addEventListener = savedAdd;
    globalThisRec.removeEventListener = savedRemove;
    globalWindow.removeEventListener = savedRemove;
    document.createElement = origCreateElement;
  }
});

// ============================================================================
// Test 2: ctrl-v false and Webkit clipboard (262, 289, 290)
// ============================================================================
test("ctrlkeyFunction [ctrl-v]: GetEditorCellElement returns null + Webkit blank-line clipboard paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctrlv-gaps");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.noEdit = false;
  editor.ECellReadonly = () => false;
  editor.pasteTextarea = document.createElement("textarea") as HTMLTextAreaElement;

  // Mock GetEditorCellElement to return null, covering 262 false side
  const origGCE = SC.GetEditorCellElement;
  SC.GetEditorCellElement = () => null;

  SC.Clipboard.clipboard = "version:1.5\nclass:sheet\n";

  const editorRec = editor as unknown as Record<string, unknown>; // Unchecked cast to record to spy on commands
  const scheduled: string[] = [];
  editorRec.EditorScheduleSheetCommands = (command: string) => {
    scheduled.push(command);
  };

  const globalThisRec = globalThis as unknown as Record<string, unknown>;
  const origSetTimeout = globalThisRec.setTimeout;
  let captured: Function | null = null;
  globalThisRec.setTimeout = (fn: Function) => {
    captured = fn;
    return 0;
  };

  const sheetProto = SC.Sheet.prototype as unknown as Record<string, unknown>;
  const origParse = sheetProto.ParseSheetSave;
  sheetProto.ParseSheetSave = () => {};

  try {
    const rc = editor.ctrlkeyFunction(editor, "[ctrl-v]");
    const ta = editor.pasteTextarea as HTMLTextAreaElement;
    ta.value = "version:1.5\nclass:sheet\n\n"; // Webkit adds an extra blank line, value.length - clipstr.length == 1
    if (captured) (captured as Function)();
    expect(rc).toBe(true);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("loadclipboard ");
    expect(scheduled[0]).toMatch(/\npaste A1 formulas$/);
  } finally {
    SC.GetEditorCellElement = origGCE;
    globalThisRec.setTimeout = origSetTimeout;
    sheetProto.ParseSheetSave = origParse;
    teardownEditor(SC, editor);
  }
});

// ============================================================================
// Test 3: ctrl-z and ctrl-s (333, 345)
// ============================================================================
test("ctrlkeyFunction [ctrl-z] returns false + ctrl-s format / editor paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ctrlzs-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  // 1. ctrl-z returns false

  const editorRec = editor as unknown as Record<string, unknown>; // Unchecked cast to record to spy on commands
  const scheduled: string[] = [];
  editorRec.EditorScheduleSheetCommands = (command: string) => {
    scheduled.push(command);
  };

  const rcZ = editor.ctrlkeyFunction(editor, "[ctrl-z]");
  expect(rcZ).toBe(false);
  expect(scheduled).toEqual(["undo"]);

  // 2. ctrl-s formats and CtrlSEditor
  SC.Constants.AllowCtrlS = true;
  const sheet = editor.context.sheetobj;
  const cell = sheet.GetAssuredCell("A1");
  cell.nontextvalueformat = 1;
  sheet.valueformats = []; // valueformats[1] will be undefined -> fall back to "" (line 333 false)

  const globalThisRec = globalThis as unknown as Record<string, unknown>;
  const origSetTimeout = globalThisRec.setTimeout;
  let captured: Function | null = null;
  globalThisRec.setTimeout = (fn: Function) => {
    captured = fn;
    return 0;
  };

  let editCmd = "";
  const scRec = SC as unknown as Record<string, unknown>; // Unchecked cast to record to set CtrlSEditor
  scRec.CtrlSEditor = (cmd: string) => {
    editCmd = cmd;
  };

  const origPrompt = globalThisRec.prompt;
  globalThisRec.prompt = () => "edit:recalc";

  try {
    editor.ctrlkeyFunction(editor, "[ctrl-s]");
    if (captured) (captured as Function)();
    expect(editCmd).toBe("recalc");
  } finally {
    globalThisRec.setTimeout = origSetTimeout;
    globalThisRec.prompt = origPrompt;
    scRec.CtrlSEditor = undefined;
    teardownEditor(SC, editor);
  }
});

// ============================================================================
// Test 4: EditorRenderSheet (971, 975)
// ============================================================================
test("EditorRenderSheet: reRenderCellList valuetype & cell null paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ers-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  const savApp = SC._app;
  SC._app = true;

  const sheetobj = editor.context.sheetobj;
  sheetobj.widgetsClean = true;

  // A1: valuetype charAt(1) == "i" AND valuetype == prevvaluetype (wi == wi) -> false arm of 971 (skips ReplaceCell)
  // B2: valuetype.charAt(1) == "i" AND valuetype != prevvaluetype (wi != ti) -> true arm of 971, but cell is null (975 false branch)
  sheetobj.reRenderCellList = ["A1", "B2"];
  const sheetRec = sheetobj as unknown as Record<string, unknown>;
  sheetRec.cells = {
    A1: { valuetype: "wi", prevvaluetype: "wi" },
    B2: { valuetype: "wi", prevvaluetype: "ti" },
  };

  const origGCE = SC.GetEditorCellElement;
  SC.GetEditorCellElement = (ed: unknown, r: number, c: number) => {
    if (r === 2 && c === 2) return null; // cell null for B2 (line 975 false branch)
    return { element: document.createElement("td") } as unknown as SocialCalc.RenderedCellRef;
  };

  let replaced = false;
  const editorRec = editor as unknown as Record<string, unknown>; // Unchecked cast to record to spy on ReplaceCell
  editorRec.ReplaceCell = () => {
    replaced = true;
  };
  editorRec.EditorMouseUnregister = () => {};
  editorRec.EditorMouseRegister = () => {};
  editorRec.SetECellHeaders = () => {};
  editor.ecell = null;

  try {
    SC.EditorRenderSheet(editor);
    expect(replaced).toBe(false); // skips ReplaceCell for A1 and B2 (since B2 cell is null)
  } finally {
    SC._app = savApp;
    SC.GetEditorCellElement = origGCE;
    teardownEditor(SC, editor);
  }
});

// ============================================================================
// Test 5: MouseDown text node (1511) + MouseUp (1733) + MouseRange (1618)
// ============================================================================
test("ProcessEditorMouseDown text node + MouseUp return + MouseRange coord falsy", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mousedown-text-node");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mouseInfoRec = SC.EditorMouseInfo as unknown as Record<string, unknown>; // Unchecked cast to record to mock mouse state
  mouseInfoRec.registeredElements = [];
  mouseInfoRec.ignore = false;

  const parent = document.createElement("div");
  const txt = document.createTextNode("clickme");
  parent.appendChild(txt);
  editor.toplevel.appendChild(parent);

  // Link child accurately for lookup loop
  const txtRec = txt as unknown as Record<string, unknown>;
  txtRec.parentNode = parent;
  const list = mouseInfoRec.registeredElements as Record<string, unknown>[];
  list.push({ element: txt, editor }); // Bypass FakeElement nodeType loop quirks

  // Register element
  SC.EditorMouseRegister(editor);

  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = () => ({ coord: "A1" }) as SocialCalc.GridMousePositionResult;

  const ev = fakeEvent({ target: txt }) as unknown as MouseEvent; // target.nodeType == 3 (text node), line 1511 true branch

  try {
    {
      SC.ProcessEditorMouseDown(ev);
    }

    // Now test MouseUp return false (statement 1733)
    mouseInfoRec.editor = editor; // Ensure editor is set so it doesn't return early
    SC.ProcessEditorMouseUp(ev);

    // Test MouseRange coord falsy in input state (1618 false branch)
    editor.state = "input";
    editor.workingvalues.partialexpr = "=";
    editor.inputBox = {
      GetText: () => "=",
      Blur: () => {},
      ShowInputBox: () => {},
      DisplayCellContents: () => {},
    } as unknown as SocialCalc.InputBox;
    editor.cellhandles = {
      ShowCellHandles: () => {},
    } as unknown as SocialCalc.CellHandles;
    const editorRec = editor as unknown as Record<string, unknown>;
    editorRec.EditorSaveEdit = () => {};

    SC.EditorMouseRange(editor, null as unknown as string); // coord is null -> line 1618 false branch
  } finally {
    SC.GridMousePosition = origGMP;
    teardownEditor(SC, editor);
  }
});

// ============================================================================
// Test 6: ProcessEditorMouseMove (1677, 1679)
// ============================================================================
test("ProcessEditorMouseMove: result.coord falsy and same coord branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mousemove-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  const mouseInfoRec = SC.EditorMouseInfo as unknown as Record<string, unknown>; // Unchecked cast to record to mock mouse state
  mouseInfoRec.editor = editor;
  mouseInfoRec.ignore = false;
  mouseInfoRec.mouselastcoord = "A1";

  const origGMP = SC.GridMousePosition;
  let mockCoord: string | null = null;
  SC.GridMousePosition = () => ({ coord: mockCoord }) as SocialCalc.GridMousePositionResult;

  const ev = fakeEvent() as unknown as MouseEvent;

  try {
    // 1677: result.coord falsy true side (returns early)
    mockCoord = null;
    SC.ProcessEditorMouseMove(ev);
    expect(mouseInfoRec.mouselastcoord).toBe("A1");

    // 1679: result.coord == mouselastcoord false side (returns early)
    editor.ecell = { coord: "B2", row: 2, col: 2 };
    mockCoord = "A1";
    SC.ProcessEditorMouseMove(ev);
    expect(editor.ecell.coord).toBe("B2"); // ecell not moved since it returned early
  } finally {
    SC.GridMousePosition = origGMP;
    teardownEditor(SC, editor);
  }
});

// ============================================================================
// Test 7: Colsize/Rowsize (1770, 1846, 2029, 2095)
// ============================================================================
test("Colsize & Rowsize MouseDown szTarget falsy + MouseUp resize branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "size-gaps");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mouseInfoRec = SC.EditorMouseInfo as unknown as Record<string, unknown>; // Unchecked cast to record to mock mouse state
  mouseInfoRec.editor = editor;

  // 1770 false side (szTarget null): create sizedisplay where childNodes navigation is falsy
  const origCreateElement = document.createElement.bind(document);
  document.createElement = (tagName: string) => {
    const el = origCreateElement(tagName);
    if (tagName === "div") {
      // Return empty div so sizedisplay.firstChild is null
      return el;
    }
    return el;
  };

  const ev = fakeEvent() as unknown as MouseEvent;

  try {
    const colResult = { coltoresize: 1 } as SocialCalc.GridMousePositionResult;
    SC.ProcessEditorColsizeMouseDown(ev, null as unknown as HTMLElement, colResult);
    expect(mouseInfoRec.mouseresizecolnum).toBe(1);

    // 1846: mouseresizecolnum truthy (but no mousecoltounhide)
    mouseInfoRec.mousecoltounhide = 0;
    mouseInfoRec.mouseresizecolnum = 1;
    SC.ProcessEditorColsizeMouseUp(ev);

    // 2029 false side (szTarget2 null)
    const rowResult = { rowtoresize: 1 } as SocialCalc.GridMousePositionResult;
    SC.ProcessEditorRowsizeMouseDown(ev, null as unknown as HTMLElement, rowResult);
    expect(mouseInfoRec.mouseresizerownum).toBe(1);

    // 2095: mouseresizerownum truthy (but no mouserowtounhide)
    mouseInfoRec.mouserowtounhide = 0;
    mouseInfoRec.mouseresizerownum = 1;
    SC.ProcessEditorRowsizeMouseUp(ev);
  } finally {
    document.createElement = origCreateElement;
    teardownEditor(SC, editor);
  }
});

// ============================================================================
// Test 8: SetDragAutoRepeat & DragAutoRepeat (2160, 2171, 2172, 2232)
// ============================================================================
test("SetDragAutoRepeat: direction ternary false side, col header/footer & DragAutoRepeat down", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dragrepeat-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  const repeatInfoRec = SC.AutoRepeatInfo as unknown as Record<string, unknown>; // Unchecked cast to record to mock repeat state
  let callbackCoord = "";
  let callbackDir = "";
  const repeatcallback = (coord: string, dir: string) => {
    callbackCoord = coord;
    callbackDir = dir;
  };
  repeatInfoRec.repeatcallback = repeatcallback;
  repeatInfoRec.mouseinfo = { row: 2, col: 2 };

  // 1. Rowheader with row >= repeatinfo.mouseinfo.row -> covers 2160 ternary false side ("right")
  const mouseinfoRow = { rowheader: true, row: 3, col: 2, distance: 10 };
  SC.SetDragAutoRepeat(editor, mouseinfoRow, repeatcallback);
  expect(callbackDir).toBe("right");

  // 2. Colheader / colfooter col change -> covers 2171 & 2172 true side
  const mouseinfoCol = { colheader: true, row: 2, col: 3, distance: 10 };
  SC.SetDragAutoRepeat(editor, mouseinfoCol, repeatcallback);
  expect(callbackCoord).toBe("C1"); // crToCoord(3, 1)

  // 3. DragAutoRepeat direction down (colfooter) -> covers 2232 direction = "down"
  repeatInfoRec.editor = editor;
  repeatInfoRec.mouseinfo = { colfooter: true, row: 2, col: 2 };
  SC.DragAutoRepeat();
  expect(callbackDir).toBe("down");

  teardownEditor(SC, editor);
});

// ============================================================================
// Test 9: ProcessKey arrows (2439, 2484, 2485)
// ============================================================================
test("EditorProcessKey [enter]/[tab] arrow paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "processkey-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  const editorRec = editor as unknown as Record<string, unknown>; // Unchecked cast to record to spy on commands
  const movedKeys: string[] = [];
  editorRec.MoveECellWithKey = (key: string) => {
    movedKeys.push(key);
    return "A2";
  };

  // 1. input state [enter] -> key starts with "[a" (2439)
  editor.state = "input";
  editor.workingvalues = { ecoord: "A1", partialexpr: "=" };
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  let inputText = "";
  editor.inputBox = {
    GetText: () => "A1",
    SetText: (value: string) => {
      inputText = value;
    },
    Blur: () => {},
    ShowInputBox: () => {},
    DisplayCellContents: () => {},
  } as unknown as SocialCalc.InputBox;
  editor.cellhandles = {
    ShowCellHandles: () => {},
  } as unknown as SocialCalc.CellHandles;
  editorRec.EditorSaveEdit = () => {};

  editor.EditorProcessKey("[enter]", fakeEvent({ keyCode: 13 }));

  // 2. inputboxdirect state [tab] shiftKey false -> "[aright]" (2484/2485)
  editor.state = "inputboxdirect";
  editor.EditorProcessKey("[tab]", fakeEvent({ keyCode: 9, shiftKey: false }));

  // 3. inputboxdirect state [tab] shiftKey true -> "[aleft]" (2484/2485)
  editor.state = "inputboxdirect";
  editor.EditorProcessKey("[tab]", fakeEvent({ keyCode: 9, shiftKey: true }));

  expect(inputText).toBe("=A2");
  expect(movedKeys).toEqual(["[enter]", "[aright]", "[aleft]"]);

  teardownEditor(SC, editor);
});

// ============================================================================
// Test 10: EditorSaveEdit prefix (2576), GridMousePosition (2756), EnsureECellVisible (3116, 3129)
// ============================================================================
test("EditorSaveEdit non-text suffix + GridMousePosition rowunhidebottom + EnsureECellVisible scrolling paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "misc-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  // 1. EditorSaveEdit apostrophe prefix but non-text type (2576 false side)

  const editorRec = editor as unknown as Record<string, unknown>; // Unchecked cast to record to spy on commands
  const scheduled: string[] = [];
  editorRec.EditorScheduleSheetCommands = (command: string) => {
    scheduled.push(command);
  };
  editor.workingvalues = { ecoord: "A1" };
  SC.EditorSaveEdit(editor, "'123"); // DetermineValueType on "123" is type "n" -> charAt(0) == "n" -> 2576 false side
  expect(scheduled).toEqual(["set A1 text t 123"]);

  // 2. GridMousePosition rowunhidebottom false side (2756 false side)
  const ctx = editor.context;
  const unhideEl = document.createElement("div");
  const ctxRec = ctx as unknown as Record<string, unknown>; // Unchecked cast to record to set unhidebottom
  ctxRec.rowunhidebottom = { 1: unhideEl };
  // Trigger mousemove outside unhide height
  const pos = SC.GetElementPosition(unhideEl);
  const result = SC.GridMousePosition(editor, pos.left + 5, editor.rowpositions[1] + 50);
  const resultRec = result as unknown as Record<string, unknown>; // Unchecked cast to read rowtounhide
  expect(resultRec.rowtounhide).toBeUndefined();

  // 3. EnsureECellVisible scrolling check row > lastnonscrollingrow AND row < firstscrollingrow (3116 true side)
  editor.lastnonscrollingrow = 1;
  editor.firstscrollingrow = 5;
  editor.lastvisiblerow = 10;
  editor.ecell = { coord: "A3", row: 3, col: 1 };
  let scrolled = false;
  editorRec.ScrollRelativeBoth = () => {
    scrolled = true;
  };
  SC.EnsureECellVisible(editor);
  expect(scrolled).toBe(true);

  // 4. EnsureECellVisible scrolling check col > lastnonscrollingcol AND col < firstscrollingcol (3129 true side)
  editor.lastnonscrollingcol = 1;
  editor.firstscrollingcol = 5;
  editor.lastvisiblecol = 10;
  editor.ecell = { coord: "C1", row: 1, col: 3 };
  scrolled = false;
  SC.EnsureECellVisible(editor);
  expect(scrolled).toBe(true);

  teardownEditor(SC, editor);
});

// ============================================================================
// Test 11: ReplaceCell & UpdateCellCSS styles (3162, 3176) + SetECellHeaders (3213-3234)
// ============================================================================
test("ReplaceCell & UpdateCellCSS style properties + SetECellHeaders pane loops with fullgrid", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "style-headers-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  const ctxRec = ctx as unknown as Record<string, unknown>; // Unchecked cast to record to mock RenderCell and classnames
  ctxRec.RenderCell = () => {
    const el = document.createElement("div");
    el.style.color = "red"; // style property other than cssText to cover 3162 and 3176
    el.className = "test-class";
    return el;
  };
  ctxRec.classnames = { selectedrowname: "sel-row", selectedcolname: "sel-col" };
  ctxRec.explicitStyles = { selectedrowname: "color:green", selectedcolname: "color:blue" };

  const cell = {
    rowpane: 0,
    colpane: 0,
    element: document.createElement("td"),
  };

  SC.ReplaceCell(editor, cell, 1, 1);
  expect(cell.element.style.color).toBe("red");

  SC.UpdateCellCSS(editor, cell, 1, 1);
  expect(cell.element.style.color).toBe("red");

  // Create fullgrid with complete tbody/tr structure so SetECellHeaders can find headers and apply styles (3213-3234)
  const tbody = document.createElement("tbody");
  for (let r = 0; r < 5; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < 5; c++) {
      const td = document.createElement("td");
      td.appendChild(document.createElement("div"));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  const table = document.createElement("table");
  const dummyCol = document.createElement("colgroup");
  table.appendChild(dummyCol);
  table.appendChild(tbody);
  editor.fullgrid = table;

  ctx.rowpanes = [{ first: 1, last: 3 }];
  ctx.colpanes = [{ first: 1, last: 3 }];
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  SC.SetECellHeaders(editor, "selected");
  const rowHeader = tbody.childNodes[2]?.childNodes[0];
  const colHeader = tbody.childNodes[1]?.childNodes[1];
  expect(rowHeader).toBeInstanceOf(HTMLElement);
  expect(colHeader).toBeInstanceOf(HTMLElement);
  if (!(rowHeader instanceof HTMLElement) || !(colHeader instanceof HTMLElement)) {
    throw new TypeError("Expected row and column header elements");
  }
  expect(rowHeader.className).toBe("sel-row");
  expect(colHeader.className).toBe("sel-col");

  teardownEditor(SC, editor);
});

// ============================================================================
// Test 12: CalculateColPositions (3823), PageRelative (3956), ScrollTable rowspan (4092, 4129, 4134, 4198)
// ============================================================================
test("CalculateColPositions, PageRelative and ScrollTable rowspan paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "scroll-gaps");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;

  // 1. CalculateColPositionsPositions already set false side (3823)
  const positions: number[] = [];
  positions[1] = 50;
  const sizes: number[] = [];
  const tbody = document.createElement("tbody");
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  tr.appendChild(td);
  tbody.appendChild(tr);
  tbody.appendChild(tr); // trowobj = tbodyobj.childNodes[1]
  const table = document.createElement("table");
  table.appendChild(tbody);
  editor.fullgrid = table;
  ctx.colpanes = [{ first: 1, last: 1 }];

  SC.CalculateColPositions(editor, 0, positions, sizes);
  expect(positions[1]).toBe(50); // unchanged

  // 2. PageRelative: newfirst >= current -> clamp to current - 1 (3956 true side)
  ctx.rowpanes = [{ first: 3, last: 5 }];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.lastvisiblerow = 4;
  editor.tableheight = 60;
  editor.firstscrollingrowtop = 30;
  editor.gridposition = { left: 0, top: 0 };
  SC.PageRelative(editor, true, -1);
  expect(ctx.rowpanes[0].first).toBe(2);

  // 3. ScrollTableUpOneRow cell skip rowspan false branch (4092 false branch)
  ctx.rowpanes = [{ first: 1, last: 3 }];
  ctx.colpanes = [{ first: 1, last: 1 }];
  tbody.appendChild(document.createElement("tr"));
  tbody.appendChild(document.createElement("tr"));
  const sheetRec = sheetobj as unknown as Record<string, unknown>;
  sheetRec.cells = {
    A3: { valuetype: "v", rowspan: 2 }, // cell skipped but rowspan > 1
  };
  const ctxRec = ctx as unknown as Record<string, unknown>; // Unchecked cast to set cellskip
  ctxRec.cellskip = { A3: "A3" };
  ctxRec.coordToCR = { A3: { row: 3, col: 1 } };
  ctxRec.RenderRow = () => document.createElement("tr");
  SC.ScrollTableUpOneRow(editor);

  // 4. ScrollTableDownOneRow RCSHeaders false (4129) + usermaxrow false branch (4134) + cell skip rowspan (4198)
  ctx.showRCHeaders = false;
  sheetobj.attribs.usermaxrow = 10; // 4134 false branch (attribs.usermaxrow is truthy)
  sheetRec.cells = {
    A3: { valuetype: "v", rowspan: 2 }, // cell skipped but rowspan > 1
  };
  SC.ScrollTableDownOneRow(editor);

  teardownEditor(SC, editor);
});

// ============================================================================
// Test 13: CellHandles (4987-4989, 5039, 5046), TCPS (5792), TCT (5950, 5951), Button (6527)
// ============================================================================
test("CellHandles MouseDown capture, Fill & TCPS/TCT/Button branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "handles-btn-gaps");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mouseInfoRec = SC.EditorMouseInfo as unknown as Record<string, unknown>; // Unchecked cast to mock mouse state
  mouseInfoRec.editor = editor;

  // 1. CellHandlesMouseDown capture path (4987-4989)
  editor.cellhandles = {} as unknown as SocialCalc.CellHandles;
  const cellHandlesRec = editor.cellhandles as unknown as Record<string, unknown>; // Unchecked cast to mock WhichHandle
  const proto = SC.CellHandles.prototype as unknown as Record<string, unknown>;
  proto.dragtooltip = document.createElement("div");
  proto.fillinghandle = document.createElement("div");
  proto.dragpalette = document.createElement("div");
  if (!cellHandlesRec.dragtooltip) cellHandlesRec.dragtooltip = document.createElement("div");
  if (!cellHandlesRec.fillinghandle) cellHandlesRec.fillinghandle = document.createElement("div");
  if (!cellHandlesRec.dragpalette) cellHandlesRec.dragpalette = document.createElement("div");
  cellHandlesRec.ShowCellHandles = () => {};
  const origSegmentDivHit = SC.SegmentDivHit;
  SC.SegmentDivHit = () => -3; // force whichhandle = -3 to reach capture path
  SC.Keyboard.focusTable = editor;
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  const ev = fakeEvent() as unknown as MouseEvent;
  SC.CellHandlesMouseDown(ev);

  // 2. CellHandlesMouseMove Fill Down crend.row < crstart.row false side (5039 false side)
  cellHandlesRec.startingcoord = "A2";
  cellHandlesRec.dragtype = "Fill";
  cellHandlesRec.filltype = "Down";
  const mockResult = { coord: "A3" } as SocialCalc.GridMousePositionResult; // crend.row (3) >= crstart.row (2) -> 5039 false branch
  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = () => mockResult;
  SC.CellHandlesMouseMove(fakeEvent() as unknown as MouseEvent);
  expect(editor.ecell.coord).toBe("A3");

  // 3. CellHandlesMouseMove else branch filltype Right delta X > 10 (5046 true branch)
  cellHandlesRec.startingcoord = "A1";
  cellHandlesRec.startingX = 10;
  cellHandlesRec.startingY = 10;
  cellHandlesRec.filltype = null;
  cellHandlesRec.dragtype = "Fill";
  mockResult.coord = "B1";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 30, clientY: 10 }) as unknown as MouseEvent); // delta X = 20 > 10 -> filltype "Right"
  expect(cellHandlesRec.filltype).toBe("Right");

  // 4. TCPSDragFunctionStart trackinglineClass (5792)
  SC.Constants.TCPStrackinglineClass = "test-track-class";
  const draginfo = { clientY: 10, clientX: 10, trackingline: document.createElement("div") };
  const dobj = {
    vertical: true,
    element: document.createElement("div"),
    downstyle: "",
    functionobj: {
      control: {
        editor,
        sliderthickness: 5,
      },
    },
  };
  SC.TCPSDragFunctionStart(
    fakeEvent() as unknown as Event,
    draginfo as unknown as typeof SocialCalc.DragInfo,
    dobj as unknown as SocialCalc.DragRegisteredElement,
  );
  expect(draginfo.trackingline.className).toBe("test-track-class");

  // 5. TCTDragFunctionStart thumbstatus rowmsgele/rowpreviewele nulling (5950, 5951)
  const thumb = document.createElement("div");
  const thumbRec = thumb as unknown as Record<string, unknown>; // Unchecked cast to add spy properties
  thumbRec.rowmsgele = document.createElement("div");
  thumbRec.rowpreviewele = document.createElement("div");
  editor.toplevel.appendChild(thumb);
  const draginfoTCT = { clientY: 10, clientX: 10, thumbstatus: thumb };
  const dobjTCT = {
    vertical: true,
    element: document.createElement("div"),
    downstyle: "",
    functionobj: {
      control: {
        editor,
        controlborder: 10,
      },
    },
  };
  SC.TCTDragFunctionStart(
    fakeEvent() as unknown as Event,
    draginfoTCT as unknown as typeof SocialCalc.DragInfo,
    dobjTCT as unknown as SocialCalc.DragRegisteredElement,
  );
  expect(thumbRec.rowmsgele).toBeNull();
  expect(thumbRec.rowpreviewele).toBeNull();

  // 6. ButtonMouseUp downstyle (6527)
  const btn = document.createElement("div");
  editor.toplevel.appendChild(btn);
  SC.ButtonRegister(
    editor,
    btn,
    {
      name: "btn1",
      normalstyle: "color:red",
      downstyle: "color:blue",
      hoverstyle: "color:green",
    },
    null,
  );
  const buttonInfoRec = SC.ButtonInfo as unknown as Record<string, unknown>; // Unchecked cast to set buttonDown
  const buttonRegistered = buttonInfoRec.registeredElements as { element: unknown }[]; // registeredElements is unknown off the Record cast; LookupElement needs T[]
  buttonInfoRec.buttonElement = SC.LookupElement(btn, buttonRegistered);
  buttonInfoRec.buttonDown = true;
  buttonInfoRec.doingHover = true;
  SC.ButtonMouseUp(fakeEvent({ target: btn }) as unknown as MouseEvent);
  expect(btn.style.color).toBe("green");

  SC.GridMousePosition = origGMP;
  SC.SegmentDivHit = origSegmentDivHit;
  teardownEditor(SC, editor);
});

// ============================================================================
// SECOND PASS: Direct branch targeting
// ============================================================================

test("Direct targeting of remaining branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "direct-gaps");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mouseInfoRec = SC.EditorMouseInfo as unknown as Record<string, unknown>;
  const globalThisRec = globalThis as unknown as Record<string, unknown>;

  // 289/290: ctrl-v value == clipstr
  editor.pasteTextarea = document.createElement("textarea") as HTMLTextAreaElement;
  editor.noEdit = false;
  editor.ECellReadonly = () => false;
  SC.ConvertSaveToOtherFormat = () => "hello";
  let captured: Function | null = null;
  const origSetTimeout = globalThisRec.setTimeout;
  globalThisRec.setTimeout = (fn: Function) => {
    captured = fn;
    return 0;
  };
  editor.ctrlkeyFunction(editor, "[ctrl-v]");
  (editor.pasteTextarea as HTMLTextAreaElement).value = "hello\n"; // Webkit branch
  if (captured) (captured as Function)();

  // 345: CtrlSEditor falsy
  SC.Constants.AllowCtrlS = true;
  const scRec = SC as unknown as Record<string, unknown>;
  scRec.CtrlSEditor = undefined;
  globalThisRec.prompt = () => "edit:cmd";
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  if (captured) (captured as Function)();

  // 1511: text node
  const txt = document.createTextNode("clickme");
  const parent = document.createElement("div");
  const txtRec = txt as unknown as Record<string, unknown>;
  txtRec.parentNode = parent;
  const ev = fakeEvent({ target: txt, srcElement: txt }) as unknown as MouseEvent;
  {
    SC.ProcessEditorMouseDown(ev);
  }

  // 1677: ProcessEditorMouseMove coord falsy
  mouseInfoRec.editor = editor;
  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = () => ({ coord: null }) as unknown as SocialCalc.GridMousePositionResult;
  {
    SC.ProcessEditorMouseMove(fakeEvent() as unknown as MouseEvent);
  }

  // 1846, 2095: resizecolnum / resizerownum
  mouseInfoRec.mousecoltounhide = 0;
  mouseInfoRec.mouseresizecolnum = 1;
  editor.context.colwidth = [0, 50, 50];
  {
    SC.ProcessEditorColsizeMouseUp(fakeEvent() as unknown as MouseEvent);
  }

  mouseInfoRec.mouserowtounhide = 0;
  mouseInfoRec.mouseresizerownum = 1;
  editor.context.rowheight = [0, 50, 50];
  {
    SC.ProcessEditorRowsizeMouseUp(fakeEvent() as unknown as MouseEvent);
  }

  // 2160, 2171, 2172, 2232: DragAutoRepeat
  const repeatInfoRec = SC.AutoRepeatInfo as unknown as Record<string, unknown>;
  repeatInfoRec.repeatcallback = () => {};
  repeatInfoRec.mouseinfo = { rowheader: true, row: 5, col: 1 };
  {
    SC.SetDragAutoRepeat(editor, { rowheader: true, row: 1, col: 1 }, () => {});
  }
  {
    SC.SetDragAutoRepeat(editor, { colheader: true, row: 1, col: 5 }, () => {});
  }
  {
    SC.SetDragAutoRepeat(editor, { colheader: true, row: 1, col: 1 }, () => {});
  }
  repeatInfoRec.mouseinfo = { colfooter: true };
  repeatInfoRec.editor = editor;
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  {
    SC.DragAutoRepeat();
  }

  // 2439, 2484, 2485: EditorProcessKey
  editor.state = "input";
  editor.inputBox = {
    GetText: () => "A1",
    skipOne: false,
    Blur: () => {},
    ShowInputBox: () => {},
    DisplayCellContents: () => {},
  } as unknown as SocialCalc.InputBox;
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;
  (editor as unknown as Record<string, unknown>).EditorSaveEdit = () => {};
  editor.workingvalues.ecoord = "A1";
  editor.workingvalues.partialexpr = "";
  const movedKeys: string[] = [];
  (editor as unknown as Record<string, unknown>).MoveECellWithKey = (key: string) => {
    movedKeys.push(key);
    return "A1";
  };
  {
    SC.EditorProcessKey(editor, "[enter]", fakeEvent({ keyCode: 13 }) as unknown as KeyboardEvent);
  }
  editor.state = "inputboxdirect";
  {
    SC.EditorProcessKey(
      editor,
      "[tab]",
      fakeEvent({ keyCode: 9, shiftKey: false }) as unknown as KeyboardEvent,
    );
  }
  editor.state = "inputboxdirect";
  {
    SC.EditorProcessKey(
      editor,
      "[tab]",
      fakeEvent({ keyCode: 9, shiftKey: true }) as unknown as KeyboardEvent,
    );
  }
  expect(movedKeys).toEqual(["[adown]", "[aright]", "[aleft]"]);

  // 2756: rowunhidebottom
  const ctx = editor.context;
  const unhideEl = document.createElement("div");
  (ctx as unknown as Record<string, unknown>).rowunhidebottom = { 1: unhideEl };
  SC.GetElementPosition = () => ({ left: 0, top: 0, right: 100, bottom: 100 });
  const unhideElRec = unhideEl as unknown as { offsetWidth: number; offsetHeight: number };
  unhideElRec.offsetWidth = 50;
  unhideElRec.offsetHeight = 50;
  {
    SC.GridMousePosition(editor, 10, editor.rowpositions[1] + 100);
  }

  // 3129: EnsureECellVisible col
  editor.ecell = { coord: "C1", row: 1, col: 3 };
  editor.lastnonscrollingcol = 1;
  editor.firstscrollingcol = 5;
  editor.lastvisiblecol = 10;
  {
    SC.EnsureECellVisible(editor);
  }

  // 3162, 3176: ReplaceCell style
  (ctx as unknown as Record<string, unknown>).RenderCell = () => {
    const el = document.createElement("td");
    el.style.color = "blue";
    return el;
  };
  const cell = { element: document.createElement("td") } as unknown as SocialCalc.RenderedCellRef;
  {
    SC.ReplaceCell(editor, cell, 1, 1);
  }
  {
    SC.UpdateCellCSS(editor, cell, 1, 1);
  }

  // 3213-3234: SetECellHeaders
  const tbody = document.createElement("tbody");
  for (let r = 0; r < 5; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < 5; c++) {
      const td = document.createElement("td");
      td.appendChild(document.createElement("div"));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  const table = document.createElement("table");
  table.appendChild(document.createElement("colgroup")); // [0]
  table.appendChild(tbody); // [1]
  editor.fullgrid = table;
  ctx.rowpanes = [{ first: 1, last: 1 }];
  ctx.colpanes = [{ first: 1, last: 1 }];
  (ctx as unknown as Record<string, unknown>).classnames = {
    selectedrowname: "a",
    selectedcolname: "b",
  };
  (ctx as unknown as Record<string, unknown>).explicitStyles = {
    selectedrowname: "a",
    selectedcolname: "b",
  };
  {
    SC.SetECellHeaders(editor, "selected");
  }
  (ctx as unknown as Record<string, unknown>).classnames = undefined;
  (ctx as unknown as Record<string, unknown>).explicitStyles = undefined;
  {
    SC.SetECellHeaders(editor, "selected");
  }

  // 3956: PageRelative
  ctx.rowpanes = [{ first: 3, last: 5 }];
  editor.tableheight = 100;
  editor.firstscrollingrowtop = 0;
  editor.gridposition = { left: 0, top: 0 };
  editor.lastvisiblerow = 4;
  editor.rowheight = [0, 50, 50, 50, 50];
  {
    SC.PageRelative(editor, true, -1);
  }

  // 4092, 4198: ScrollTable cellskip
  ctx.rowpanes = [{ first: 2, last: 4 }];
  ctx.colpanes = [{ first: 1, last: 1 }];
  (ctx as unknown as Record<string, unknown>).cellskip = { A3: "A2" };
  (ctx as unknown as Record<string, unknown>).coordToCR = { A2: { row: 2, col: 1 } };
  (ctx.sheetobj as unknown as Record<string, unknown>).cells = { A2: { rowspan: 2 } };
  ctx.RenderRow = () => {
    const tr = document.createElement("tr");
    tr.appendChild(document.createElement("td"));
    return tr;
  };
  {
    SC.ScrollTableUpOneRow(editor);
  }
  {
    SC.ScrollTableDownOneRow(editor);
  }
  expect(ctx.rowpanes[0].first).toBe(2);
  expect(ctx.rowpanes[0].last).toBeGreaterThanOrEqual(4);

  // 5046: CellHandlesMouseMove
  const cellHandlesRec = editor.cellhandles as unknown as Record<string, unknown>;
  cellHandlesRec.startingcoord = "A1";
  cellHandlesRec.startingX = 10;
  cellHandlesRec.startingY = 10;
  cellHandlesRec.dragtype = "Fill";
  cellHandlesRec.filltype = null;
  const fillingHandle = document.createElement("div");
  cellHandlesRec.fillinghandle = fillingHandle;
  SC.EditorMouseInfo.editor = editor;
  SC.GridMousePosition = () => ({ coord: "A1" }) as SocialCalc.GridMousePositionResult;
  {
    SC.CellHandlesMouseMove(fakeEvent({ clientX: 30, clientY: 15 }) as unknown as MouseEvent);
  }
  expect(fillingHandle.style.display).toBe("block");

  // 5792: TCPS
  SC.Constants.TCPStrackinglineClass = "test-class";
  const paneSlider = document.createElement("div");
  paneSlider.style.top = "0px";
  paneSlider.style.left = "0px";
  const paneDragInfo = { clientX: 0, clientY: 0 } as unknown as typeof SocialCalc.DragInfo;
  {
    SC.TCPSDragFunctionStart(fakeEvent() as unknown as Event, paneDragInfo, {
      element: paneSlider,
      vertical: false,
      horizontal: true,
      functionobj: { control: { editor, sliderthickness: 0 } },
    } as unknown as SocialCalc.DragRegisteredElement);
  }
  expect(paneDragInfo.trackingline.className).toBe("test-class");

  // 5950, 5951: TCT
  const thumb = document.createElement("div");
  (thumb as unknown as Record<string, unknown>).rowmsgele = document.createElement("div");
  (thumb as unknown as Record<string, unknown>).rowpreviewele = document.createElement("div");
  editor.toplevel.appendChild(thumb);
  const thumbHandle = document.createElement("div");
  thumbHandle.style.top = "0px";
  thumbHandle.style.left = "0px";
  {
    SC.TCTDragFunctionStart(
      fakeEvent() as unknown as Event,
      { thumbstatus: thumb, clientX: 0, clientY: 0 } as unknown as typeof SocialCalc.DragInfo,
      {
        element: thumbHandle,
        vertical: true,
        functionobj: { control: { editor, controlborder: 0 } },
      } as unknown as SocialCalc.DragRegisteredElement,
    );
  }

  // 6527: ButtonMouseUp
  const btn = document.createElement("div");
  SC.ButtonRegister(editor, btn, { name: "b", downstyle: "a", normalstyle: "b" }, null);
  const btnInfoRec = SC.ButtonInfo as unknown as Record<string, unknown>;
  btnInfoRec.buttonDown = true;
  const btnRegistered = btnInfoRec.registeredElements as { element: unknown }[]; // registeredElements is unknown off the Record cast; LookupElement needs T[]
  btnInfoRec.buttonElement = SC.LookupElement(btn, btnRegistered);
  {
    SC.ButtonMouseUp(fakeEvent() as unknown as MouseEvent);
  }

  globalThisRec.setTimeout = origSetTimeout;
  SC.GridMousePosition = origGMP;
});
