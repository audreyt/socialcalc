// Coverage gaps for dist/SocialCalc.js lines 5552-8245 (TableEditor construction,
// rendering/position calculation, scrolling, mouse-move/drag-repeat plumbing).
// Targets branches not exercised by editor-coverage-a/b or editor-dom-coverage.

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

// Helpers mirror editor-coverage-a.test.ts exactly (which uses `any` from
// the helper boundary — these wrappers inherit that typing).
async function loadSocialCalc(): Promise<any> {
  const SC = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  return SC as any;
}

async function newControl(
  SC: any,
  containerId = "gap-root",
): Promise<{ control: any; container: HTMLElement }> {
  const container = document.createElement("div");
  container.id = containerId;
  (document.body as any).appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

function teardownEditor(SC: any, editor: any): void {
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
  { SC.Keyboard.focusTable = null;
  SC.Keyboard.passThru = null; }
  { if (editor) {
    editor.state = "start";
    if (editor.timeout) {
      clearTimeout(editor.timeout);
      editor.timeout = null;
    }
  } }
}

function fakeEvent(extras: Record<string, any> = {}): any {
  const ev: any = {
    type: "mousedown",
    clientX: 10,
    clientY: 10,
    target: extras.target ?? null,
    srcElement: extras.target ?? null,
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

function primeGridLayout(editor: any): void {
  { editor.CalculateEditorPositions(); }
  editor.gridposition = editor.gridposition || { left: 0, top: 0 };
  editor.headposition = editor.headposition || { left: 30, top: 30 };
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
  editor.verticaltablecontrol = editor.verticaltablecontrol || {
    controlborder: 500,
    main: { style: {} },
  };
  editor.horizontaltablecontrol = editor.horizontaltablecontrol || {
    controlborder: 500,
    main: { style: {} },
  };
}

// ============================================================================
// TEST: ResizeTableEditor prototype passthrough (line 5754 — uncovered func)
// ============================================================================
test("ResizeTableEditor prototype passthrough", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "resize-te");
  const editor = control.editor;
  { editor.ResizeTableEditor(500, 400); }
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ScheduleRender with _app=true (line 5849-5850)
// + DoRenderStep, DoPositionCalculations, ScrollTableLeft/RightOneCol
// (lines 5853-5854, 5859-5860, 5886-5887, 5889-5890)
// ============================================================================
test("ScheduleRender _app + DoRenderStep/DoPositionCalculations/ScrollTableLeft/RightOneCol", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "proto-passthrough");
  const editor = control.editor;

  // ScheduleRender with _app=true and renderwidgets=true (line 5849-5850)
  const savApp = SC._app;
  SC._app = true;
  { editor.ScheduleRender(true); }
  // ScheduleRender with _app=true and renderwidgets=false (false branch of 5849)
  { editor.ScheduleRender(false); }
  SC._app = savApp;

  // DoRenderStep (line 5853-5854 — uncovered function)
  { editor.DoRenderStep(); }

  // DoPositionCalculations (line 5859-5860 — uncovered function)
  { editor.DoPositionCalculations(); }

  // ScrollTableLeftOneCol (line 5886-5887 — uncovered function)
  { editor.ScrollTableLeftOneCol(); }

  // ScrollTableRightOneCol (line 5889-5890 — uncovered function)
  { editor.ScrollTableRightOneCol(); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: CreateTableEditor with _app=true (lines 5941, 5948, 5954, 5964)
// ============================================================================
test("CreateTableEditor: _app=true branches", async () => {
  const SC = await loadSocialCalc();
  // Set _app=true BEFORE creating the control so CreateTableEditor takes
  // the _app branches (5941: skip verticaltablecontrol, 5948: skip
  // horizontaltablecontrol, 5954: right center logo, 5964: logoImg true)
  const savApp = SC._app;
  SC._app = true;
  try {
    const { control } = await newControl(SC, "cte-app");
    const editor = control.editor;
    teardownEditor(SC, editor);
  } finally {
    SC._app = savApp;
  }
});

// ============================================================================
// TEST: ResizeTableEditor with _app=true (line 6000-6001)
// ============================================================================
test("ResizeTableEditor: _app=true tablewidth branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "resize-app");
  const editor = control.editor;
  const savApp = SC._app;
  SC._app = true;
  { editor.ResizeTableEditor(500, 400); }
  SC._app = savApp;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorScheduleSheetCommands undo/redo with _app=true (lines 6146-6147, 6151-6154)
// ============================================================================
test("EditorScheduleSheetCommands: undo/redo with _app=true", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "esc-app");
  const editor = control.editor;
  editor.state = "start";
  editor.busy = false;
  const savApp = SC._app;
  SC._app = true;
  { editor.EditorScheduleSheetCommands("undo", true, true); }
  { editor.EditorScheduleSheetCommands("redo", true, true); }
  SC._app = savApp;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorSheetStatusCallback — uncovered status branches
// 6168: StatusCallback[f].func null
// 6201: needsrecalc with recalconce
// 6217: hiddencolrow=="col" with ecell null
// 6228: hiddencolrow=="row" with ecell null
// 6274: doneposcalc with state=="start"
// 6292: switch cases
// ============================================================================
test("EditorSheetStatusCallback: uncovered status branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "essc-gap");
  const editor = control.editor;

  // Register a StatusCallback with func=null to test the false branch of 6168
  editor.StatusCallback = editor.StatusCallback || {};
  editor.StatusCallback["nullfunc"] = { func: null, params: null };
  // And one with a real func to test the true branch
  const seen: string[] = [];
  editor.StatusCallback["realfunc"] = {
    func: (_e: any, s: string) => {
      seen.push(s);
    },
    params: null,
  };

  const sheetobj = editor.context.sheetobj;

  // cmdend with needsrecalc=true and recalc != "off" (line 6201 true)
  sheetobj.attribs.needsrecalc = true;
  sheetobj.attribs.recalc = "auto";
  sheetobj.renderneeded = false;
  sheetobj.changedrendervalues = false;
  sheetobj.celldisplayneeded = "";
  editor.deferredCommands = [];
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }

  // cmdend with recalconce (line 6201 — recalconce branch)
  sheetobj.attribs.needsrecalc = true;
  sheetobj.attribs.recalc = "off";
  sheetobj.recalconce = true;
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }
  delete sheetobj.recalconce;

  // hiddencolrow == "col" with ecell !== null (line 6217 true)
  sheetobj.hiddencolrow = "col";
  editor.ecell = editor.ecell || { coord: "A1", row: 1, col: 1 };
  sheetobj.colattribs.hide = sheetobj.colattribs.hide || {};
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }

  // hiddencolrow == "col" with ecell === null (line 6217 false)
  const savedEcell = editor.ecell;
  editor.ecell = null;
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }
  editor.ecell = savedEcell;

  // hiddencolrow == "row" with ecell !== null (line 6228 true)
  sheetobj.hiddencolrow = "row";
  sheetobj.rowattribs.hide = sheetobj.rowattribs.hide || {};
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }

  // hiddencolrow == "row" with ecell === null (line 6228 false)
  editor.ecell = null;
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }
  editor.ecell = savedEcell;
  sheetobj.hiddencolrow = "";

  // doneposcalc with state == "start" (line 6274)
  editor.state = "start";
  editor.busy = true;
  editor.deferredCommands = [];
  editor.deferredEmailCommands = [];
  { SC.EditorSheetStatusCallback(null, "doneposcalc", null, editor); }

  // doneposcalc with state != "start"
  editor.state = "input";
  editor.busy = true;
  { SC.EditorSheetStatusCallback(null, "doneposcalc", null, editor); }

  // Other switch cases in EditorSheetStatusCallback (line 6292)
  { SC.EditorSheetStatusCallback(null, "schedposcalc", null, editor); }
  { SC.EditorSheetStatusCallback(null, "schedrender", null, editor); }
  { SC.EditorSheetStatusCallback(null, "donerecalc", null, editor); }
  { SC.EditorSheetStatusCallback(null, "donecalc", null, editor); }
  { SC.EditorSheetStatusCallback(null, "calccycle", null, editor); }
  { SC.EditorSheetStatusCallback(null, "calcorder", { count: 1, total: 2 }, editor); }
  { SC.EditorSheetStatusCallback(null, "calcstep", { count: 2, total: 2 }, editor); }
  {
    SC.EditorSheetStatusCallback(
      null,
      "calcserverfunc",
      { count: 1, total: 1, funcname: "SUM", coord: "A1" },
      editor,
    );
  }
  { SC.EditorSheetStatusCallback(null, "calcloading", { sheetname: "Sheet2" }, editor); }
  { SC.EditorSheetStatusCallback(null, "confirmemailsent", "sent", editor); }
  { SC.EditorSheetStatusCallback(null, "unknownstatus", null, editor); }

  expect(seen.length).toBeGreaterThan(0);
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorGetStatuslineString — calcorder, calcstep, calcserverfunc,
// confirmemailsent with undefined emailreponse (lines 6329, 6332, 6338, 6357-6358)
// ============================================================================
test("EditorGetStatuslineString: calcorder/calcstep/calcserverfunc + confirmemailsent", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "egss-gap");
  const editor = control.editor;

  // calcorder (line 6329)
  let s = editor.GetStatuslineString("calcorder", { count: 5, total: 10 }, {});
  expect(typeof s).toBe("string");

  // calcstep (line 6332)
  s = editor.GetStatuslineString("calcstep", { count: 3, total: 10 }, {});
  expect(typeof s).toBe("string");

  // calcserverfunc (line 6338)
  s = editor.GetStatuslineString(
    "calcserverfunc",
    { count: 2, total: 10, funcname: "SUM", coord: "A1" },
    {},
  );
  expect(typeof s).toBe("string");

  // confirmemailsent with undefined emailreponse (lines 6357-6358)
  const params: any = {};
  s = editor.GetStatuslineString("confirmemailsent", "response data", params);
  expect(typeof s).toBe("string");
  expect(params.emailreponse).toBe("response data");

  // calcloading
  s = editor.GetStatuslineString("calcloading", { sheetname: "Sheet2" }, {});
  expect(typeof s).toBe("string");

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorMouseDown — no-coord return, shiftKey range, state!=start
// Lines 6474, 6476, 6514-6515, 6517-6518, 6543-6544
// ============================================================================
test("ProcessEditorMouseDown: no-coord, shiftKey, state!=start branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemn-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.registeredElements = mi.registeredElements || [];
  mi.registeredElements.push({ element: target, editor });
  mi.ignore = false;

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };

  // Valid mousedown — exercises the normal path including 6543-6544
  { SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 100, target })); }

  // no-coord return (line 6514-6515) — position in rowheader area
  { SC.ProcessEditorMouseDown(fakeEvent({ clientX: 5, clientY: 100, target })); }

  // shiftKey with no range → RangeAnchor (line 6517-6518)
  editor.range = { hasrange: false };
  { SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 100, target, shiftKey: true })); }

  // state != "start" → inputBox.element.focus (line 6543-6544)
  editor.state = "input";
  editor.range = { hasrange: false };
  { SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 100, target })); }

  // ignore=true → return
  mi.ignore = true;
  { SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 100, target })); }
  mi.ignore = false;

  // no mobj found (target not in registeredElements)
  const otherEl = document.createElement("div");
  { SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 100, target: otherEl })); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorMouseMove — ignore, no result, no coord, coord changed
// Lines 6587, 6592-6593, 6599-6600, 6606-6607, 6608
// ============================================================================
test("ProcessEditorMouseMove: ignore, no-result, no-coord, coord-changed branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemm-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = target;
  mi.ignore = false;
  mi.mouselastcoord = "A1";

  // ignore=true → return (line 6592-6593)
  mi.ignore = true;
  { SC.ProcessEditorMouseMove(fakeEvent({ clientX: 100, clientY: 100 })); }
  mi.ignore = false;

  // no result → return (line 6599-6600) — position outside grid
  { SC.ProcessEditorMouseMove(fakeEvent({ clientX: -100, clientY: -100 })); }

  // result with no coord → SetDragAutoRepeat + return (line 6601-6602)
  { SC.ProcessEditorMouseMove(fakeEvent({ clientX: 5, clientY: 100 })); }

  // result with coord, coord == mouselastcoord → no MoveECell
  mi.mouselastcoord = "A1";
  { SC.ProcessEditorMouseMove(fakeEvent({ clientX: 100, clientY: 100 })); }

  // result with coord, coord != mouselastcoord → MoveECell + RangeExtend
  mi.mouselastcoord = "B2";
  editor.range = { hasrange: false };
  { SC.ProcessEditorMouseMove(fakeEvent({ clientX: 100, clientY: 100 })); }

  // no editor → return
  mi.editor = null;
  { SC.ProcessEditorMouseMove(fakeEvent({ clientX: 100, clientY: 100 })); }
  mi.editor = editor;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorMouseUp — ignore, no result, no coord branches
// Lines 6622, 6627-6628, 6635-6636
// ============================================================================
test("ProcessEditorMouseUp: ignore, no-result, no-coord branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pemu-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = target;
  mi.ignore = false;
  mi.mousedowncoord = "A1";
  editor.range = { hasrange: false };
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  // no editor → return
  mi.editor = null;
  { SC.ProcessEditorMouseUp(fakeEvent({ clientX: 100, clientY: 100 })); }
  mi.editor = editor;

  // ignore=true → return (line 6627-6628)
  mi.ignore = true;
  { SC.ProcessEditorMouseUp(fakeEvent({ clientX: 100, clientY: 100 })); }
  mi.ignore = false;

  // no result → return (line 6635-6636)
  { SC.ProcessEditorMouseUp(fakeEvent({ clientX: -100, clientY: -100 })); }

  // result with coord, hasrange → MoveECell + RangeExtend
  editor.range = {
    hasrange: true,
    left: 1,
    right: 2,
    top: 1,
    bottom: 2,
    anchorcoord: "A1",
    anchorrow: 1,
    anchorcol: 1,
  };
  { SC.ProcessEditorMouseUp(fakeEvent({ clientX: 100, clientY: 100 })); }

  // result with no coord → result.coord = ecell.coord
  editor.range = { hasrange: false };
  { SC.ProcessEditorMouseUp(fakeEvent({ clientX: 5, clientY: 100 })); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorColsize — MouseMove + MouseUp + FinishColRowSize
// Lines 6653, 6680, 6685-6690, 6699, 6710-6713, 6724-6725
// ============================================================================
test("ProcessEditorColsize: MouseMove + MouseUp + FinishColRowSize", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pecs-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = target;
  mi.ignore = false;
  mi.mouseresizecolnum = 2;
  mi.mouseresizecol = "B";
  mi.mousedownclientx = 50;
  mi.mouseresizedisplay = document.createElement("div");
  mi.mousecoltounhide = null;
  editor.context.colwidth = [0, 80, 80, 80, 80];

  // MouseMove with mouseresizecolnum set (lines 6685-6690)
  { SC.ProcessEditorColsizeMouseMove(fakeEvent({ clientX: 60 })); }

  // MouseMove with no editor → return
  mi.editor = null;
  { SC.ProcessEditorColsizeMouseMove(fakeEvent({ clientX: 60 })); }
  mi.editor = editor;

  // MouseMove with no mouseresizecolnum → skip resize block
  mi.mouseresizecolnum = null;
  { SC.ProcessEditorColsizeMouseMove(fakeEvent({ clientX: 60 })); }
  mi.mouseresizecolnum = 2;

  // MouseUp with mouseresizecolnum set (lines 6710-6713)
  mi.mouseresizecolnum = 2;
  mi.mouseresizecol = "B";
  editor.timeout = null;
  { SC.ProcessEditorColsizeMouseUp(fakeEvent({ clientX: 60 })); }

  // MouseUp with mousecoltounhide set (line 6708-6709)
  mi.mousecoltounhide = 3;
  { SC.ProcessEditorColsizeMouseUp(fakeEvent({ clientX: 60 })); }
  mi.mousecoltounhide = null;

  // MouseUp with no editor → return
  mi.editor = null;
  { SC.ProcessEditorColsizeMouseUp(fakeEvent({ clientX: 60 })); }
  mi.editor = editor;

  // FinishColRowSize with no editor → return (line 6724-6725)
  mi.editor = null;
  { SC.FinishColRowSize(); }
  mi.editor = editor;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorRowsize — MouseMove + MouseUp resize branches
// Lines 6732, 6745, 6762, 6771, 6784, 6801, 6810, 6830, 6838, 6843-6848,
// 6857, 6868-6874
// ============================================================================
test("ProcessEditorRowsize: MouseMove + MouseUp resize + unhide branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pers-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.editor = editor;
  mi.element = target;
  mi.ignore = false;
  mi.mouseresizerownum = 2;
  mi.mouseresizerow = 2;
  mi.mousedownclienty = 50;
  mi.mouseresizedisplay = document.createElement("div");
  mi.mouserowtounhide = null;
  editor.context.rowheight = [0, 30, 20, 20, 20];

  // MouseMove with mouseresizerownum set (lines 6843-6848)
  { SC.ProcessEditorRowsizeMouseMove(fakeEvent({ clientY: 60 })); }

  // MouseMove with no editor → return
  mi.editor = null;
  { SC.ProcessEditorRowsizeMouseMove(fakeEvent({ clientY: 60 })); }
  mi.editor = editor;

  // MouseMove with no mouseresizerownum → skip resize block
  mi.mouseresizerownum = null;
  { SC.ProcessEditorRowsizeMouseMove(fakeEvent({ clientY: 60 })); }
  mi.mouseresizerownum = 2;

  // MouseUp with mouseresizerownum set (lines 6868-6874)
  mi.mouseresizerownum = 2;
  mi.mouserowtounhide = null;
  editor.timeout = null;
  { SC.ProcessEditorRowsizeMouseUp(fakeEvent({ clientY: 60 })); }

  // MouseUp with mouserowtounhide set (line 6866-6867)
  mi.mouserowtounhide = 3;
  { SC.ProcessEditorRowsizeMouseUp(fakeEvent({ clientY: 60 })); }
  mi.mouserowtounhide = null;

  // MouseUp with no editor → return
  mi.editor = null;
  { SC.ProcessEditorRowsizeMouseUp(fakeEvent({ clientY: 60 })); }
  mi.editor = editor;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: SetDragAutoRepeat — colheader/colfooter + callback direction branches
// Lines 6901, 6903-6904, 6913-6914, 6916-6917
// ============================================================================
test("SetDragAutoRepeat: colheader/colfooter + callback direction branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sdar-gap");
  const editor = control.editor;

  const ar = SC.AutoRepeatInfo;
  ar.timer = null;
  ar.mouseinfo = null;
  ar.editor = editor;
  ar.repeatcallback = null;
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  // rowheader, different row → direction "left" (line 6903-6904)
  ar.mouseinfo = { row: 3, col: 1, rowheader: true, distance: 10 };
  { SC.SetDragAutoRepeat(editor, { row: 5, col: 1, rowheader: true, distance: 10 }); }

  // rowheader, row < previous → direction "right"
  ar.mouseinfo = { row: 5, col: 1, rowheader: true, distance: 10 };
  { SC.SetDragAutoRepeat(editor, { row: 1, col: 1, rowheader: true, distance: 10 }); }

  // colheader/colfooter branch (lines 6913-6914)
  ar.mouseinfo = { row: 1, col: 3, colheader: true, distance: 10 };
  { SC.SetDragAutoRepeat(editor, { row: 1, col: 5, colheader: true, distance: 10 }); }

  // colfooter
  ar.mouseinfo = { row: 1, col: 3, colfooter: true, distance: 10 };
  { SC.SetDragAutoRepeat(editor, { row: 1, col: 5, colfooter: true, distance: 10 }); }

  // rowfooter
  ar.mouseinfo = { row: 3, col: 1, rowfooter: true, distance: 10 };
  { SC.SetDragAutoRepeat(editor, { row: 5, col: 1, rowfooter: true, distance: 10 }); }

  // With a repeatcallback
  ar.repeatcallback = (coord: string, dir: string) => {
    void coord;
    void dir;
  };
  ar.mouseinfo = { row: 3, col: 1, rowheader: true, distance: 10 };
  { SC.SetDragAutoRepeat(editor, { row: 5, col: 1, rowheader: true, distance: 10 }); }
  ar.repeatcallback = null;

  // null mouseinfo → clear timer
  { SC.SetDragAutoRepeat(editor, null); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: DragAutoRepeat — all direction branches
// Lines 6954-6955, 6956, 6958-6959, 6962-6963, 6964-6965, 6966-6968, 6969, 6974
// ============================================================================
test("DragAutoRepeat: rowfooter, colheader, colfooter, all direction branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dar-gap");
  const editor = control.editor;

  const ar = SC.AutoRepeatInfo;
  ar.timer = null;
  ar.editor = editor;
  ar.repeatinterval = 100;
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  // rowfooter → direction "right" (line 6954-6955)
  ar.mouseinfo = { rowheader: false, rowfooter: true, colheader: false, colfooter: false };
  ar.repeatcallback = (coord: string, dir: string) => {
    void coord;
    void dir;
  };
  { SC.DragAutoRepeat(); }

  // colheader → direction "up" (line 6956)
  ar.mouseinfo = { rowheader: false, rowfooter: false, colheader: true, colfooter: false };
  { SC.DragAutoRepeat(); }

  // colfooter → direction "down" (line 6958-6959)
  ar.mouseinfo = { rowheader: false, rowfooter: false, colheader: false, colfooter: true };
  { SC.DragAutoRepeat(); }

  // direction "left" with cr.col > 1 → cr.col-- (line 6962-6963)
  ar.mouseinfo = { rowheader: true, rowfooter: false, colheader: false, colfooter: false };
  editor.ecell = { coord: "C1", row: 1, col: 3 };
  { SC.DragAutoRepeat(); }

  // direction "left" with cr.col == 1 → no decrement (false branch of 6962)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  { SC.DragAutoRepeat(); }

  // direction "right" → cr.col++ (line 6964-6965)
  ar.mouseinfo = { rowheader: false, rowfooter: true, colheader: false, colfooter: false };
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  { SC.DragAutoRepeat(); }

  // direction "up" with cr.row > 1 → cr.row-- (line 6966-6968)
  ar.mouseinfo = { rowheader: false, rowfooter: false, colheader: true, colfooter: false };
  editor.ecell = { coord: "A3", row: 3, col: 1 };
  { SC.DragAutoRepeat(); }

  // direction "up" with cr.row == 1 → no decrement (false branch of 6966)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  { SC.DragAutoRepeat(); }

  // direction "down" → cr.row++ (line 6968-6969)
  ar.mouseinfo = { rowheader: false, rowfooter: false, colheader: false, colfooter: true };
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  { SC.DragAutoRepeat(); }

  // No repeatcallback → MoveECellWithKey path (line 6973-6975)
  ar.repeatcallback = null;
  ar.mouseinfo = { rowheader: true, rowfooter: false, colheader: false, colfooter: false };
  editor.ecell = { coord: "B2", row: 2, col: 2 };
  editor.range = { hasrange: false };
  { SC.DragAutoRepeat(); }

  // No repeatcallback, MoveECellWithKey returns null → no EditorMouseRange
  editor.MoveECellWithKey = () => null;
  { SC.DragAutoRepeat(); }

  ar.repeatcallback = null;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ProcessEditorDblClick — no result, no coord, state branches
// Lines 6981, 6983, 6999-7000, 7005, 7012
// ============================================================================
test("ProcessEditorDblClick: no-result, no-coord, input/default state", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pedc-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.registeredElements = mi.registeredElements || [];
  mi.registeredElements.push({ element: target, editor });
  mi.ignore = false;
  mi.editor = editor;

  // no mobj found (target not in registeredElements)
  const otherEl = document.createElement("div");
  { SC.ProcessEditorDblClick(fakeEvent({ target: otherEl, srcElement: otherEl })); }

  // ignore=true → return
  mi.ignore = true;
  { SC.ProcessEditorDblClick(fakeEvent({ target, srcElement: target })); }
  mi.ignore = false;

  // result with no coord → return (line 6999-7000)
  { SC.ProcessEditorDblClick(fakeEvent({ target, srcElement: target, clientX: 5, clientY: 100 })); }

  // state = "input" → break (line 7012)
  editor.state = "input";
  { SC.ProcessEditorDblClick(fakeEvent({ target, srcElement: target, clientX: 100, clientY: 100 })); }

  // default state (not start, not input) → default break
  editor.state = "other";
  { SC.ProcessEditorDblClick(fakeEvent({ target, srcElement: target, clientX: 100, clientY: 100 })); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorOpenCellEdit — disabled inputBox (line 7023-7024)
// ============================================================================
test("EditorOpenCellEdit: disabled inputBox early return", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "eoce-gap");
  const editor = control.editor;

  // no ecell → return true
  const savedEcell = editor.ecell;
  editor.ecell = null;
  let r = SC.EditorOpenCellEdit(editor);
  expect(r).toBe(true);
  editor.ecell = savedEcell;

  // no inputBox → return true
  const savedInputBox = editor.inputBox;
  editor.inputBox = null;
  r = SC.EditorOpenCellEdit(editor);
  expect(r).toBe(true);
  editor.inputBox = savedInputBox;

  // inputBox.element.disabled = true → return true (line 7023-7024)
  if (editor.inputBox?.element) {
    const savedDisabled = editor.inputBox.element.disabled;
    editor.inputBox.element.disabled = true;
    r = SC.EditorOpenCellEdit(editor);
    expect(r).toBe(true);
    editor.inputBox.element.disabled = savedDisabled;
  }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorProcessKey — uncovered branches
// 7052: tab with shiftKey → [aleft]
// 7058: del with noEdit/ECellReadonly
// 7064: esc with no range
// 7074-7075: f2 with noEdit/ECellReadonly
// 7087-7090: no ecell / no inputBox
// 7139-7140: input state tab → [aleft]/[aright] + MoveECellWithKey
// 7187-7188: inputboxdirect tab → [aleft]/[aright] + MoveECellWithKey
// ============================================================================
test("EditorProcessKey: tab-shift, del-readonly, esc-no-range, f2-readonly, no-ecell/inputbox, input/inputboxdirect tab", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "epk-gap");
  const editor = control.editor;

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };
  editor.state = "start";

  // [tab] with shiftKey → [aleft] (line 7052)
  { editor.EditorProcessKey("[tab]", { shiftKey: true }); }

  // [tab] without shiftKey → [aright] (line 7052 false branch)
  { editor.EditorProcessKey("[tab]", { shiftKey: false }); }

  // [del] with noEdit → skip (line 7058)
  editor.state = "start";
  editor.noEdit = true;
  { editor.EditorProcessKey("[del]", { shiftKey: false }); }
  editor.noEdit = false;

  // [del] with ECellReadonly → skip
  editor.ECellReadonly = () => true;
  editor.state = "start";
  { editor.EditorProcessKey("[del]", { shiftKey: false }); }
  editor.ECellReadonly = () => false;

  // [esc] with no range → no RangeRemove (line 7064 false branch)
  editor.state = "start";
  editor.range = { hasrange: false };
  { editor.EditorProcessKey("[esc]", { shiftKey: false }); }

  // [f2] with noEdit → return true (line 7074-7075)
  editor.state = "start";
  editor.noEdit = true;
  { editor.EditorProcessKey("[f2]", { shiftKey: false }); }
  editor.noEdit = false;

  // [f2] with ECellReadonly → return true
  editor.ECellReadonly = () => true;
  editor.state = "start";
  { editor.EditorProcessKey("[f2]", { shiftKey: false }); }
  editor.ECellReadonly = () => false;

  // no ecell → return true (line 7087-7088)
  editor.state = "start";
  const savedEcell = editor.ecell;
  editor.ecell = null;
  { editor.EditorProcessKey("x", { shiftKey: false }); }
  editor.ecell = savedEcell;

  // no inputBox → return true (line 7089-7090)
  editor.state = "start";
  const savedIB = editor.inputBox;
  editor.inputBox = null;
  { editor.EditorProcessKey("x", { shiftKey: false }); }
  editor.inputBox = savedIB;

  // input state: [enter] → EditorSaveEdit + MoveECellWithKey (line 7131+)
  editor.state = "input";
  editor.range = { hasrange: false };
  editor.inputBox.GetText = () => "hello";
  editor.inputBox.skipOne = false;
  editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1, partialexpr: "" };
  { editor.EditorProcessKey("[enter]", { shiftKey: false }); }

  // input state: [tab] with shiftKey → [aleft] (line 7139)
  editor.state = "input";
  editor.range = { hasrange: false };
  editor.inputBox.GetText = () => "hello";
  editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1, partialexpr: "" };
  { editor.EditorProcessKey("[tab]", { shiftKey: true }); }

  // input state: [tab] without shiftKey → [aright] (line 7140)
  editor.state = "input";
  editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1, partialexpr: "" };
  { editor.EditorProcessKey("[tab]", { shiftKey: false }); }

  // inputboxdirect state: [tab] with shiftKey → [aleft] (line 7187-7188)
  editor.state = "inputboxdirect";
  editor.range = { hasrange: false };
  editor.inputBox.GetText = () => "hello";
  editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1, partialexpr: "" };
  { editor.EditorProcessKey("[tab]", { shiftKey: true }); }

  // inputboxdirect: [enter] → [adown] + MoveECellWithKey
  editor.state = "inputboxdirect";
  { editor.EditorProcessKey("[enter]", { shiftKey: false }); }

  // inputboxdirect: [esc] → DisplayCellContents
  editor.state = "inputboxdirect";
  { editor.EditorProcessKey("[esc]", { shiftKey: false }); }

  // inputboxdirect: [f2] → state = "input"
  editor.state = "inputboxdirect";
  { editor.EditorProcessKey("[f2]", { shiftKey: false }); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorSaveEdit — ioEventTree/ioParameterList undefined + text type
// Lines 7264, 7267, 7284-7287
// ============================================================================
test("EditorSaveEdit: text-type + ioEventTree/ioParameterList undefined", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ese-gap");
  const editor = control.editor;

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1, partialexpr: "" };
  const sheetobj = editor.context.sheetobj;

  // text t type with value.charAt(0) == "'" (line 7264)
  editor.inputBox.GetText = () => "'hello";
  { SC.EditorSaveEdit(editor); }

  // ioEventTree undefined → return (line 7284-7285)
  sheetobj.ioEventTree = undefined;
  editor.inputBox.GetText = () => "newvalue";
  { SC.EditorSaveEdit(editor); }

  // ioParameterList undefined → return (line 7286-7287)
  sheetobj.ioEventTree = {};
  sheetobj.ioParameterList = undefined;
  { SC.EditorSaveEdit(editor); }

  // ioEventTree with a cell entry → EditedTriggerCell
  sheetobj.ioEventTree = { A1: { B1: {} } };
  sheetobj.ioParameterList = { B1: { function_name: "EMAILONEDIT" } };
  editor.deferredEmailCommands = [];
  { SC.EditorSaveEdit(editor); }

  // ioParameterList with undefined entry → continue
  sheetobj.ioEventTree = { A1: { B1: {} } };
  sheetobj.ioParameterList = {};
  { SC.EditorSaveEdit(editor); }

  // value == oldvalue → early return
  editor.inputBox.GetText = () => "";
  sheetobj.ioEventTree = undefined;
  sheetobj.ioParameterList = undefined;
  { SC.EditorSaveEdit(editor, ""); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: GridMousePosition — rowheight/colwidth zero-skip, rowunhidebottom
// Lines 7336-7337, 7343-7344, 7358-7359, 7373, 7393-7394
// ============================================================================
test("GridMousePosition: zero-skip, rowunhidebottom, coltoresize-skip branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "gmp-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  // Set some rowheights/colwidths to 0 to exercise the skip branches
  editor.rowheight = [0, 0, 20, 20, 20, 20, 20, 20];
  editor.colwidth = [0, 0, 80, 80, 80, 80, 80, 80];

  // Normal cell position
  let r = SC.GridMousePosition(editor, 100, 100);
  expect(r).toBeDefined();

  // Rowheader area with zero-height rows (7358-7359)
  editor.rowheight = [0, 0, 0, 20, 20, 20, 20, 20];
  r = SC.GridMousePosition(editor, 5, 100);
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];

  // Colheader area with zero-width cols (7393-7394)
  editor.colwidth = [0, 0, 0, 80, 80, 80, 80, 80];
  r = SC.GridMousePosition(editor, 100, 5);
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];

  // rowunhidebottom hit (line 7373)
  const ctx = editor.context;
  ctx.rowunhidetop = ctx.rowunhidetop || {};
  ctx.rowunhidebottom = ctx.rowunhidebottom || {};
  const fakeUnhide = { offsetWidth: 20, offsetHeight: 20 };
  ctx.rowunhidebottom[1] = fakeUnhide;
  SC.GetElementPosition = SC.GetElementPosition || (() => ({ left: 0, top: 0 }));
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  r = SC.GridMousePosition(editor, 5, 55);
  delete ctx.rowunhidebottom[1];

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: MoveECellWithKey — cell rowspan/colspan, pgdn/pgup, usermax, shifted
// Lines 7502, 7510, 7512, 7524, 7539, 7561, 7564
// ============================================================================
test("MoveECellWithKey: rowspan/colspan, pgdn/pgup, usermax, shifted RangeRemove", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mecwk-gap");
  const editor = control.editor;

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };
  const sheetobj = editor.context.sheetobj;
  sheetobj.cells = sheetobj.cells || {};
  sheetobj.colattribs = sheetobj.colattribs || { hide: {} };
  sheetobj.rowattribs = sheetobj.rowattribs || { hide: {} };
  sheetobj.attribs = sheetobj.attribs || {};
  // Mock MoveECell to avoid RenderCell chain
  editor.MoveECell = (coord: string) => coord;
  editor.RangeAnchor = () => {};
  editor.RangeExtend = () => {};
  editor.RangeRemove = () => {};

  // [adown] with cell rowspan (line 7502)
  sheetobj.cells["A1"] = { rowspan: 3 };
  let r = SC.MoveECellWithKey(editor, "[adown]");
  expect(r).toBeDefined();

  // [aup] (line 7505)
  editor.ecell = { coord: "B5", row: 5, col: 2 };
  r = SC.MoveECellWithKey(editor, "[aup]");
  expect(r).toBeDefined();

  // [pgdn] with lastvisiblerow and firstscrollingrow (line 7510)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.lastvisiblerow = 7;
  editor.firstscrollingrow = 1;
  sheetobj.cells["A1"] = { rowspan: 1 };
  r = SC.MoveECellWithKey(editor, "[pgdn]");
  expect(r).toBeDefined();

  // [pgdn] without lastvisiblerow/firstscrollingrow (line 7512)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.lastvisiblerow = null;
  editor.firstscrollingrow = null;
  editor.pageUpDnAmount = 10;
  r = SC.MoveECellWithKey(editor, "[pgdn]");
  expect(r).toBeDefined();

  // [pgup] with lastvisiblerow/firstscrollingrow
  editor.ecell = { coord: "A10", row: 10, col: 1 };
  editor.lastvisiblerow = 7;
  editor.firstscrollingrow = 1;
  r = SC.MoveECellWithKey(editor, "[pgup]");
  expect(r).toBeDefined();

  // [pgup] without lastvisiblerow/firstscrollingrow
  editor.ecell = { coord: "A10", row: 10, col: 1 };
  editor.lastvisiblerow = null;
  editor.firstscrollingrow = null;
  editor.pageUpDnAmount = 5;
  r = SC.MoveECellWithKey(editor, "[pgup]");
  expect(r).toBeDefined();

  // [aright] with cell colspan (line 7524)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  sheetobj.cells["A1"] = { colspan: 2 };
  r = SC.MoveECellWithKey(editor, "[aright]");
  expect(r).toBeDefined();

  // [aleft]
  editor.ecell = { coord: "C1", row: 1, col: 3 };
  r = SC.MoveECellWithKey(editor, "[aleft]");
  expect(r).toBeDefined();

  // [home]
  editor.ecell = { coord: "C5", row: 5, col: 3 };
  r = SC.MoveECellWithKey(editor, "[home]");
  expect(r).toBeDefined();

  // usermaxcol (line 7539)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  sheetobj.attribs.usermaxcol = 3;
  r = SC.MoveECellWithKey(editor, "[aright]");
  expect(r).toBeDefined();

  // usermaxrow (line 7540)
  sheetobj.attribs.usermaxrow = 3;
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  r = SC.MoveECellWithKey(editor, "[adown]");
  expect(r).toBeDefined();
  delete sheetobj.attribs.usermaxcol;
  delete sheetobj.attribs.usermaxrow;

  // shifted with hasrange → RangeExtend (line 7561)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: true };
  r = SC.MoveECellWithKey(editor, "[adown]shifted");
  expect(r).toBeDefined();

  // shifted without hasrange → RangeAnchor (line 7557)
  editor.range = { hasrange: false };
  r = SC.MoveECellWithKey(editor, "[adown]shifted");
  expect(r).toBeDefined();

  // shifted with hasrange → RangeRemove (line 7564)
  editor.range = { hasrange: true };
  r = SC.MoveECellWithKey(editor, "[adown]shifted");
  expect(r).toBeDefined();

  // no ecell → return null
  const savedEcell = editor.ecell;
  editor.ecell = null;
  r = SC.MoveECellWithKey(editor, "[adown]");
  expect(r).toBeNull();
  editor.ecell = savedEcell;

  // unknown key → return null
  r = SC.MoveECellWithKey(editor, "[unknown]");
  expect(r).toBeNull();

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: MoveECell — ecell.coord == newcell, cellhandles ShowCellHandles
// Lines 7577, 7587
// ============================================================================
test("MoveECell: same-coord return, cellhandles branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "mec-gap");
  const editor = control.editor;

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.context.highlights = {};
  editor.context.sheetobj.attribs = editor.context.sheetobj.attribs || {};
  editor.context.cellskip = {};
  editor.range2 = { hasrange: false };
  editor.EnsureECellVisible = () => {};

  // ecell.coord == newcell → return newcell (line 7577-7578)
  let r = SC.MoveECell(editor, "A1");
  expect(r).toBe("A1");

  // Move to a different cell — cellhandles exists → ShowCellHandles(false) (line 7587)
  r = SC.MoveECell(editor, "B2");
  expect(r).toBeDefined();

  // No cellhandles → skip (false branch of 7587)
  const savedCh = editor.cellhandles;
  editor.cellhandles = null;
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.context.highlights = {};
  r = SC.MoveECell(editor, "B2");
  expect(r).toBeDefined();
  editor.cellhandles = savedCh;

  // No ecell → skip the if block (false branch of 7577)
  const savedEcell = editor.ecell;
  editor.ecell = null;
  r = SC.MoveECell(editor, "A1");
  expect(r).toBeDefined();
  editor.ecell = savedEcell;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EnsureECellVisible — row > lastnonscrollingrow, col > lastnonscrollingcol
// Lines 7614, 7621
// ============================================================================
test("EnsureECellVisible: vertical + horizontal scroll branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "eecv-gap");
  const editor = control.editor;

  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.lastnonscrollingrow = 0;
  editor.lastnonscrollingcol = 0;
  editor.firstscrollingrow = 1;
  editor.firstscrollingcol = 1;
  editor.lastvisiblerow = 5;
  editor.lastvisiblecol = 5;

  // ecell.row < firstscrollingrow → vamount negative (line 7615-7616)
  editor.ecell = { coord: "A1", row: 1, col: 5 };
  { SC.EnsureECellVisible(editor); }

  // ecell.row + 1 > lastvisiblerow → vamount positive (line 7617-7618)
  editor.ecell = { coord: "A6", row: 6, col: 5 };
  { SC.EnsureECellVisible(editor); }

  // ecell.col < firstscrollingcol → hamount negative (line 7622-7623)
  editor.ecell = { coord: "A5", row: 5, col: 1 };
  { SC.EnsureECellVisible(editor); }

  // ecell.col + 1 > lastvisiblecol → hamount positive (line 7624-7625)
  editor.ecell = { coord: "F5", row: 5, col: 6 };
  { SC.EnsureECellVisible(editor); }

  // vamount == 0 && hamount == 0 → ShowCellHandles (line 7631)
  editor.ecell = { coord: "C3", row: 3, col: 3 };
  editor.firstscrollingrow = 1;
  editor.lastvisiblerow = 5;
  editor.firstscrollingcol = 1;
  editor.lastvisiblecol = 5;
  let handlesShown = false;
  editor.cellhandles.ShowCellHandles = () => {
    handlesShown = true;
  };
  { SC.EnsureECellVisible(editor); }
  expect(handlesShown).toBe(true);

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ReplaceCell + UpdateCellCSS — newelement && cell.element, style loop
// Lines 7639, 7644, 7654, 7658
// ============================================================================
test("ReplaceCell + UpdateCellCSS: newelement+element and style-loop branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "rcuc-gap");
  const editor = control.editor;

  const ctx = editor.context;

  // ReplaceCell: null cell → return
  SC.ReplaceCell(editor, null, 1, 1);

  // ReplaceCell: cell with element, newelement null → no innerHTML (line 7639 false)
  const cell1 = { element: document.createElement("td"), rowpane: 0, colpane: 0 };
  ctx.RenderCell = () => null;
  SC.ReplaceCell(editor, cell1, 1, 1);

  // ReplaceCell: cell with element, newelement with innerHTML (line 7639 true)
  const newEl = document.createElement("td");
  newEl.innerHTML = "test";
  newEl.className = "test-class";
  newEl.style.cssText = "color:red";
  ctx.RenderCell = () => newEl;
  SC.ReplaceCell(editor, cell1, 1, 1);

  // UpdateCellCSS: null cell → return
  SC.UpdateCellCSS(editor, null, 1, 1);

  // UpdateCellCSS: cell with element, newelement null (line 7654 false)
  ctx.RenderCell = () => null;
  SC.UpdateCellCSS(editor, cell1, 1, 1);

  // UpdateCellCSS: cell with element, newelement with style (line 7654 true, 7658)
  const newEl2 = document.createElement("td");
  newEl2.className = "test-class2";
  newEl2.style.cssText = "color:blue";
  ctx.RenderCell = () => newEl2;
  SC.UpdateCellCSS(editor, cell1, 1, 1);

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: SetECellHeaders — fullgrid null, headercell null, classnames, explicitStyles
// Lines 7686, 7688-7689, 7691, 7704, 7706-7707, 7709
// ============================================================================
test("SetECellHeaders: fullgrid-null, headercell-null, classnames/explicitStyles branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "sech-gap");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.showRCHeaders = true;
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  const sheetobj = ctx.sheetobj;
  sheetobj.colattribs = sheetobj.colattribs || { hide: {} };
  sheetobj.rowattribs = sheetobj.rowattribs || { hide: {} };
  sheetobj.colattribs.hide = {};
  sheetobj.rowattribs.hide = {};

  editor.ecell = { coord: "B3", row: 3, col: 2 };

  // fullgrid = null → i >= 0 check fails (line 7686 false branch)
  const savedGrid = editor.fullgrid;
  editor.fullgrid = null;
  { SC.SetECellHeaders(editor, "selected"); }
  editor.fullgrid = savedGrid;

  // fullgrid with DOM structure but no matching headercell (line 7688 false)
  const rows: HTMLElement[] = [];
  for (let i = 0; i < 10; i++) {
    const tr = document.createElement("tr");
    for (let j = 0; j < 10; j++) {
      const td = document.createElement("td");
      tr.appendChild(td);
    }
    rows.push(tr);
  }
  editor.fullgrid = {
    childNodes: [null, { childNodes: rows }],
  } as unknown as HTMLTableElement;
  // No classnames, no explicitStyles → skip inner branches
  ctx.classnames = null;
  ctx.explicitStyles = null;
  { SC.SetECellHeaders(editor, "selected"); }

  // With classnames and explicitStyles (lines 7689, 7691, 7707, 7709)
  ctx.classnames = { selectedrowname: "row-sel", selectedcolname: "col-sel" };
  ctx.explicitStyles = { selectedrowname: "color:red", selectedcolname: "color:blue" };
  { SC.SetECellHeaders(editor, "selected"); }
  const rowHeader = rows[4].childNodes[0];
  const colHeader = rows[1].childNodes[2];
  expect(rowHeader).toBeInstanceOf(HTMLElement);
  expect(colHeader).toBeInstanceOf(HTMLElement);
  if (!(rowHeader instanceof HTMLElement) || !(colHeader instanceof HTMLElement)) {
    throw new TypeError("Expected row and column header elements");
  }
  expect(rowHeader.className).toBe("row-sel");
  expect(rowHeader.style.cssText).toContain("color:red");
  expect(colHeader.className).toBe("col-sel");
  expect(colHeader.style.cssText).toContain("color:blue");
  ctx.classnames = null;
  ctx.explicitStyles = null;

  // headercell null (line 7688 false / 7706 false)
  const emptyRows = Array.from({ length: 5 }, () => ({ childNodes: [] as unknown[] }));
  emptyRows[1] = { childNodes: [null, null, null] };
  emptyRows[4] = { childNodes: [null] };
  editor.fullgrid = {
    childNodes: [null, { childNodes: emptyRows }],
  } as any;
  { SC.SetECellHeaders(editor, "selected"); }

  editor.fullgrid = savedGrid;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ECellReadonly — no ecoord with ecell, no ecoord without ecell
// Lines 7718, 7721-7722
// ============================================================================
test("ECellReadonly: ecoord fallback + no-ecoord return false", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ecr-gap");
  const editor = control.editor;

  // no ecoord, but ecell exists → use ecell.coord (line 7718 true)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  const sheetobj = editor.context.sheetobj;
  sheetobj.cells = sheetobj.cells || {};
  sheetobj.cells["A1"] = { readonly: true };
  let r = SC.ECellReadonly(editor);
  expect(r).toBe(true);

  // no ecoord, no ecell → return false (line 7721-7722)
  editor.ecell = null;
  r = SC.ECellReadonly(editor);
  expect(r).toBe(false);

  // ecoord provided, cell with readonly
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  sheetobj.cells["B2"] = { readonly: true };
  r = SC.ECellReadonly(editor, "B2");
  expect(r).toBe(true);

  // ecoord provided, cell without readonly
  sheetobj.cells["C3"] = { readonly: false };
  r = SC.ECellReadonly(editor, "C3");
  expect(r).toBe(false);

  // ecoord provided, no cell → returns undefined (cell && cell.readonly)
  r = SC.ECellReadonly(editor, "Z9");
  expect(r).toBeFalsy();

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: RangeExtend — no ecell return
// Line 7743-7744
// ============================================================================
test("RangeExtend: no-ecell early return", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "re-gap");
  const editor = control.editor;

  editor.range = { hasrange: false };
  editor.range2 = { hasrange: false };
  editor.context.highlights = {};

  // no ecoord, no ecell → return (line 7743-7744)
  editor.ecell = null;
  SC.RangeExtend(editor);
  expect(editor.range.hasrange).toBe(false);

  // with ecell → normal path
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.RangeExtend(editor);
  expect(editor.range.hasrange).toBe(true);

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: FitToEditTable — blank/auto colwidth, hidden col skip
// Lines 7924-7926, 7935-7937
// ============================================================================
test("FitToEditTable: blank/auto colwidth + hidden col branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ftet-gap");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.showRCHeaders = true;
  ctx.rownamewidth = 30;
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.rowpanes = [{ first: 1, last: 5 }];
  const sheetobj = ctx.sheetobj;
  sheetobj.colattribs = sheetobj.colattribs || { hide: {}, width: {} };
  sheetobj.rowattribs = sheetobj.rowattribs || { hide: {} };
  sheetobj.attribs = sheetobj.attribs || {};
  sheetobj.colattribs.hide = {};
  sheetobj.colattribs.width = {};
  sheetobj.attribs.defaultcolwidth = 80;
  sheetobj.rowattribs.hide = {};
  sheetobj.attribs.lastrow = 100;
  editor.tablewidth = 400;
  editor.tableheight = 300;
  ctx.pixelsPerRow = 20;

  // Normal colwidth (numeric)
  { SC.FitToEditTable(editor); }

  // colwidth = "blank" (line 7924)
  sheetobj.colattribs.width = { A: "blank" };
  sheetobj.attribs.defaultcolwidth = null;
  { SC.FitToEditTable(editor); }

  // colwidth = "auto" (line 7924)
  sheetobj.colattribs.width = { A: "auto" };
  { SC.FitToEditTable(editor); }

  // Hidden col in non-last pane (line 7922)
  sheetobj.colattribs.width = {};
  sheetobj.colattribs.hide = { A: "yes" };
  ctx.colpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 10 },
  ];
  { SC.FitToEditTable(editor); }

  // Hidden col in last pane (line 7933)
  sheetobj.colattribs.hide = { D: "yes" };
  { SC.FitToEditTable(editor); }

  // blank/auto in last pane (line 7935)
  sheetobj.colattribs.hide = {};
  sheetobj.colattribs.width = { D: "auto" };
  { SC.FitToEditTable(editor); }

  // usermaxcol
  sheetobj.colattribs.width = {};
  sheetobj.attribs.usermaxcol = 5;
  { SC.FitToEditTable(editor); }
  delete sheetobj.attribs.usermaxcol;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: CalculateEditorPositions — rowpositions > tableheight, colpositions > tablewidth
// Lines 7972-7973, 7981-7982
// ============================================================================
test("CalculateEditorPositions: break on position > table bounds", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "cep-gap");
  const editor = control.editor;

  // Set up a minimal griddiv with childNodes structure
  const headerCell = { offsetWidth: 30, offsetHeight: 20 };
  const fakeGrid = {
    firstChild: {
      lastChild: {
        childNodes: [null, { childNodes: [headerCell] }],
      },
    },
  } as unknown as HTMLElement;
  editor.griddiv = fakeGrid;

  const originalGetElementPosition = SC.GetElementPosition;
  SC.GetElementPosition = () => ({ left: 0, top: 0 });
  editor.context.rowpanes = [{ first: 1, last: 5 }];
  editor.context.colpanes = [{ first: 1, last: 5 }];
  const sheetobj = editor.context.sheetobj;
  sheetobj.rowattribs = sheetobj.rowattribs || { hide: {} };
  sheetobj.colattribs = sheetobj.colattribs || { hide: {} };
  sheetobj.rowattribs.hide = {};
  sheetobj.colattribs.hide = {};
  sheetobj.attribs = sheetobj.attribs || {};

  let nextRows = [0, 50, 70, 90, 110, 130, 150, 170, 200, 250, 300];
  let nextCols = [0, 80, 160, 240, 320, 400, 480, 560];
  editor.CalculateRowPositions = (_pane: number, positions: number[]) => {
    positions.push(...nextRows);
  };
  editor.CalculateColPositions = (_pane: number, positions: number[]) => {
    positions.push(...nextCols);
  };

  editor.gridposition = { left: 0, top: 0 };
  editor.tableheight = 200;
  editor.tablewidth = 400;
  editor.rowpositions = [];
  editor.colpositions = [];

  // rowpositions[i] > gridposition.top + tableheight → break (line 7972-7973)
  { SC.CalculateEditorPositions(editor); }
  expect(editor.lastvisiblerow).toBe(8);
  expect(editor.lastvisiblecol).toBe(5);

  // colpositions[i] > gridposition.left + tablewidth → break (line 7981-7982)
  nextRows = [0, 50, 70];
  nextCols = [0, 80, 160, 240, 320, 400, 480, 560, 640, 720, 800];
  { SC.CalculateEditorPositions(editor); }
  expect(editor.lastvisiblerow).toBe(2);
  expect(editor.lastvisiblecol).toBe(5);

  // No break (all positions within bounds)
  nextRows = [0, 50, 70, 90];
  nextCols = [0, 80, 160, 240];
  { SC.CalculateEditorPositions(editor); }
  expect(editor.lastvisiblerow).toBe(3);
  expect(editor.lastvisiblecol).toBe(3);

  SC.GetElementPosition = originalGetElementPosition;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: CalculateRowPositions — trowobj null, positions already set
// Lines 8055-8056, 8058
// ============================================================================
test("CalculateRowPositions: trowobj-null + position-already-set branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "crp-gap");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.showRCHeaders = true;
  ctx.rowpanes = [{ first: 1, last: 5 }];

  // Build a minimal fullgrid with lastChild having childNodes
  const fakeTbody = {
    childNodes: [
      {}, // row 0
      {}, // row 1
      null, // row 2 — trowobj is null (line 8055)
      {
        firstChild: { offsetTop: 90, offsetHeight: 20 },
      },
    ],
  };
  editor.fullgrid = { lastChild: fakeTbody } as any;

  // trowobj null → continue (line 8055-8056)
  { SC.CalculateRowPositions(editor, 0, [], []); }

  // position already set → skip (line 8058 false branch)
  { SC.CalculateRowPositions(editor, 0, [0, 50, 70, 90], [0, 20, 20, 20]); }

  // No positions set → set them (line 8058 true branch)
  { SC.CalculateRowPositions(editor, 0, [], []); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: CalculateColPositions — position already set
// Line 8081
// ============================================================================
test("CalculateColPositions: position-already-set branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ccp-gap");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.showRCHeaders = true;
  ctx.colpanes = [{ first: 1, last: 5 }];

  const fakeRow = {
    childNodes: [
      { offsetWidth: 30 },
      { offsetWidth: 80 },
      { offsetWidth: 80 },
      { offsetWidth: 80 },
    ],
  };
  const fakeTbody = { childNodes: [null, fakeRow] };
  editor.fullgrid = { lastChild: fakeTbody } as any;

  const originalGetElementPosition = SC.GetElementPosition;
  SC.GetElementPosition = () => ({ left: 0, top: 0 });

  // position already set → skip (line 8081 false branch)
  { SC.CalculateColPositions(editor, 0, [0, 30, 80, 160], [0, 30, 80, 80]); }

  // No positions set → set them (line 8081 true branch)
  { SC.CalculateColPositions(editor, 0, [], []); }
  SC.GetElementPosition = originalGetElementPosition;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ScrollRelativeBoth — single pane vlimit/hlimit, ecell SetECellHeaders
// Lines 8103, 8108, 8132
// ============================================================================
test("ScrollRelativeBoth: single-pane vlimit/hlimit + ecell branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "srb-gap");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  const sheetobj = ctx.sheetobj;
  sheetobj.rowattribs = sheetobj.rowattribs || { hide: {} };
  sheetobj.colattribs = sheetobj.colattribs || { hide: {} };
  sheetobj.rowattribs.hide = {};
  sheetobj.colattribs.hide = {};

  // vamount=1, hamount=0 → ScrollTableUpOneRow + ecell (line 8126-8132)
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  { SC.ScrollRelativeBoth(editor, 1, 0); }

  // vamount=-1, hamount=0 → ScrollTableDownOneRow + ecell (line 8129-8132)
  { SC.ScrollRelativeBoth(editor, -1, 0); }

  // vamount=1, hamount=0, no ecell → skip SetECellHeaders (line 8132 false)
  editor.ecell = null;
  { SC.ScrollRelativeBoth(editor, 1, 0); }
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  // vamount=0, hamount=1 → neither single-row path (line 8137)
  { SC.ScrollRelativeBoth(editor, 0, 1); }

  // vamount=2, hamount=2 → pane shift (line 8137-8145)
  { SC.ScrollRelativeBoth(editor, 2, 2); }

  // vamount=0, hamount=0 → no scroll
  { SC.ScrollRelativeBoth(editor, 0, 0); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: PageRelative — newfirst == lastpane.first, newfirst >= current, newfirst < 1
// Lines 8157-8158, 8173-8176
// ============================================================================
test("PageRelative: newfirst==lastpane.first, clamp branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pr-gap");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];

  // direction > 0, newfirst == lastpane.first → newfirst += 1 (line 8157-8158)
  editor.lastvisiblerow = 3;
  { SC.PageRelative(editor, true, 1); }

  // direction > 0, newfirst != lastpane.first
  editor.lastvisiblerow = 5;
  { SC.PageRelative(editor, true, 1); }

  // direction < 0, vertical — newfirst >= current → newfirst = current - 1 (line 8173-8174)
  editor.lastvisiblerow = 3;
  editor.firstscrollingrowtop = 30;
  editor.gridposition = { left: 0, top: 0 };
  editor.tableheight = 200;
  editor.rowheight = [0, 20, 20, 20, 20, 20, 20, 20];
  { SC.PageRelative(editor, true, -1); }

  // direction < 0, horizontal
  editor.lastvisiblecol = 3;
  editor.firstscrollingcolleft = 30;
  editor.gridposition = { left: 0, top: 0 };
  editor.tablewidth = 400;
  editor.colwidth = [0, 80, 80, 80, 80, 80, 80, 80];
  { SC.PageRelative(editor, false, -1); }

  // direction < 0, newfirst < 1 → newfirst = 1 (line 8175-8176)
  editor.lastvisiblerow = 1;
  editor.firstscrollingrowtop = 0;
  editor.tableheight = 50;
  editor.rowheight = [0, 20, 20];
  { SC.PageRelative(editor, true, -1); }

  teardownEditor(SC, editor);
});
test("PageRelative: negative vertical direction updates last pane first/last", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "pr-neg-vertical");
  const editor = control.editor;
  primeGridLayout(editor);

  const ctx = editor.context;
  ctx.rowpanes = [{ first: 4, last: 6 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  editor.lastvisiblerow = 4;
  editor.firstscrollingrowtop = 30;
  editor.gridposition = { left: 0, top: 0 };
  editor.tableheight = 120;
  editor.rowheight = [0, 20, 20, 20, 20, 20, 20];

  const before = ctx.rowpanes[ctx.rowpanes.length - 1].first;
  SC.PageRelative(editor, true, -1);
  const after = ctx.rowpanes[ctx.rowpanes.length - 1].first;
  expect(after).toBeLessThan(before);
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: LimitLastPanes — multi-pane overlap, usermax
// Lines 8188-8189, 8193-8194
// ============================================================================
test("LimitLastPanes: multi-pane overlap + usermax branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "llp-gap");
  const editor = control.editor;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.attribs = sheetobj.attribs || {};

  // Single pane → no overlap (false branch of 8188)
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  { SC.LimitLastPanes(editor); }

  // Multi-pane with overlap (line 8188 true)
  ctx.rowpanes = [
    { first: 1, last: 3 },
    { first: 2, last: 5 },
  ];
  ctx.colpanes = [
    { first: 1, last: 3 },
    { first: 2, last: 5 },
  ];
  { SC.LimitLastPanes(editor); }

  // Multi-pane no overlap (false branch of 8188)
  ctx.rowpanes = [
    { first: 1, last: 3 },
    { first: 5, last: 10 },
  ];
  ctx.colpanes = [
    { first: 1, last: 3 },
    { first: 5, last: 10 },
  ];
  { SC.LimitLastPanes(editor); }

  // usermaxrow (line 8190-8191)
  ctx.rowpanes = [
    { first: 1, last: 3 },
    { first: 5, last: 10 },
  ];
  sheetobj.attribs.usermaxrow = 7;
  { SC.LimitLastPanes(editor); }
  delete sheetobj.attribs.usermaxrow;

  // usermaxcol (line 8195-8196)
  ctx.colpanes = [
    { first: 1, last: 3 },
    { first: 5, last: 10 },
  ];
  sheetobj.attribs.usermaxcol = 7;
  { SC.LimitLastPanes(editor); }
  delete sheetobj.attribs.usermaxcol;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ScrollTableUpOneRow — cellskip continue, rowspan break, showRCHeaders false
// Lines 8206, 8218, 8227-8228, 8236-8237
// ============================================================================
test("ScrollTableUpOneRow: cellskip, rowspan, showRCHeaders=false, usermaxrow", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "stur-gap");
  const editor = control.editor;

  const ctx = editor.context;
  const sheetobj = ctx.sheetobj;
  sheetobj.attribs = sheetobj.attribs || {};
  sheetobj.colattribs = sheetobj.colattribs || { hide: {} };
  sheetobj.cells = sheetobj.cells || {};
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  sheetobj.colattribs.hide = {};
  ctx.cellskip = {};
  ctx.CalculateColWidthData = ctx.CalculateColWidthData || (() => {});
  ctx.RenderRow = ctx.RenderRow || (() => document.createElement("tr"));

  // Build a minimal fullgrid
  const fakeTbody = {
    childNodes: [] as any[],
    removeChild: () => {},
    appendChild: () => {},
    replaceChild: () => {},
  };
  for (let i = 0; i < 10; i++) {
    fakeTbody.childNodes.push(document.createElement("tr"));
  }
  editor.fullgrid = { lastChild: fakeTbody } as any;
  editor.FitToEditTable = editor.FitToEditTable || (() => {});

  // showRCHeaders = false → toprow = 1 (line 8206)
  ctx.showRCHeaders = false;
  { SC.ScrollTableUpOneRow(editor); }

  // showRCHeaders = true → toprow = 2 (line 8206 true branch)
  ctx.showRCHeaders = true;
  { SC.ScrollTableUpOneRow(editor); }

  // usermaxrow boundary (line 8210-8211)
  sheetobj.attribs.usermaxrow = ctx.rowpanes[0].first;
  { SC.ScrollTableUpOneRow(editor); }
  delete sheetobj.attribs.usermaxrow;

  // cellskip continue (line 8227-8228)
  ctx.rowpanes = [{ first: 2, last: 5 }];
  ctx.cellskip = { A2: "B2" };
  { SC.ScrollTableUpOneRow(editor); }
  ctx.cellskip = {};

  // rowspan > 1 → maxrowspan loop (line 8234-8237)
  ctx.rowpanes = [{ first: 2, last: 5 }];
  sheetobj.cells["A1"] = { rowspan: 2 };
  { SC.ScrollTableUpOneRow(editor); }

  // rowspan break (line 8236-8237: rownum + oldrownum >= last)
  ctx.rowpanes = [{ first: 2, last: 3 }];
  sheetobj.cells["A1"] = { rowspan: 5 };
  { SC.ScrollTableUpOneRow(editor); }

  // usermaxrow: last == usermaxrow → no RenderRow (line 8218 false branch)
  ctx.rowpanes = [{ first: 2, last: 5 }];
  sheetobj.attribs.usermaxrow = 5;
  { SC.ScrollTableUpOneRow(editor); }
  delete sheetobj.attribs.usermaxrow;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorMouseRange — input state with coord and no partialexpr
// Line 6559
// ============================================================================
test("EditorMouseRange: input state with coord + no-partialexpr", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "emr-gap");
  const editor = control.editor;

  editor.state = "input";
  editor.range = { hasrange: false };
  editor.inputBox.GetText = () => "hello";
  editor.cellhandles = editor.cellhandles || { ShowCellHandles: () => {} };
  editor.workingvalues = { partialexpr: "" };

  // input state, partialexpr = "" → else branch (Blur/ShowInputBox/EditorSaveEdit)
  { SC.EditorMouseRange(editor, "B2"); }

  // input state, partialexpr = "=SUM(", coord = "B2", hasrange = true (line 6559 true, 6560 true)
  editor.workingvalues = { partialexpr: "=SUM(" };
  editor.range = { hasrange: true, left: 1, right: 2, top: 1, bottom: 2 };
  { SC.EditorMouseRange(editor, "B2"); }

  // input state, partialexpr = "=SUM(", coord = "B2", hasrange = false (line 6560 false)
  editor.range = { hasrange: false };
  { SC.EditorMouseRange(editor, "B2"); }

  // input state, partialexpr = "=SUM(", coord = null (line 6559 false)
  { SC.EditorMouseRange(editor, ""); }

  // inputboxdirect state
  editor.state = "inputboxdirect";
  { SC.EditorMouseRange(editor, "B2"); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: SaveEditorSettings — ecell null branch
// Line 6029
// ============================================================================
test("SaveEditorSettings: ecell null + range hasrange branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "ses-gap");
  const editor = control.editor;

  editor.context.rowpanes = [{ first: 1, last: 5 }];
  editor.context.colpanes = [{ first: 1, last: 5 }];
  editor.SettingsCallbacks = {};

  // ecell = null → skip ecell line (line 6029 false branch)
  editor.ecell = null;
  editor.range = { hasrange: false };
  let s = SC.SaveEditorSettings(editor);
  expect(typeof s).toBe("string");

  // ecell set → include ecell line (line 6029 true)
  editor.ecell = { coord: "A1" };
  s = SC.SaveEditorSettings(editor);
  expect(s).toContain("ecell:A1");

  // range hasrange = true → include range line
  editor.range = { hasrange: true, anchorcoord: "A1", top: 1, bottom: 2, left: 1, right: 2 };
  s = SC.SaveEditorSettings(editor);
  expect(s).toContain("range:");

  // With SettingsCallbacks
  editor.SettingsCallbacks = {
    test: {
      save: (_e: any, setting: string) => "custom:" + setting,
      load: () => {},
    },
  };
  s = SC.SaveEditorSettings(editor);
  expect(s).toContain("custom:test");

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: GetEditorCellElement — CoordInPane false, colspan skip
// Lines 7465, 7476
// ============================================================================
test("GetEditorCellElement: CoordInPane false + colspan skip branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "gece-gap");
  const editor = control.editor;

  const ctx = editor.context;
  ctx.showRCHeaders = true;
  ctx.rowpanes = [{ first: 1, last: 5 }];
  ctx.colpanes = [{ first: 1, last: 5 }];
  ctx.cellskip = {};
  ctx.CoordInPane = (coord: string, _rp: number, _cp: number) => {
    return coord !== "B2";
  };

  // Build a minimal grid structure
  const fakeTbody = { childNodes: [] as any[] };
  for (let i = 0; i < 10; i++) {
    const tr = { childNodes: [] as any[] };
    for (let j = 0; j < 10; j++) {
      tr.childNodes.push({ tagName: "TD" });
    }
    fakeTbody.childNodes.push(tr);
  }
  editor.griddiv = { firstChild: { lastChild: fakeTbody } } as any;

  // cellskip with a coord that CoordInPane returns false for → colindex++ (line 7465)
  ctx.cellskip = { B2: "C2" };
  let r = SC.GetEditorCellElement(editor, 2, 2);
  expect(r).toBeDefined();

  // cellskip with coord that CoordInPane returns true → skip colindex++ (line 7465 false)
  ctx.cellskip = { A1: "B1" };
  r = SC.GetEditorCellElement(editor, 1, 1);
  expect(r).toBeDefined();

  // No cellskip → colindex++ (line 7465: !coord is true)
  ctx.cellskip = {};
  r = SC.GetEditorCellElement(editor, 1, 1);
  expect(r).toBeDefined();

  // showRCHeaders = false → headerColOffset = -1
  ctx.showRCHeaders = false;
  r = SC.GetEditorCellElement(editor, 1, 1);
  expect(r).toBeDefined();
  ctx.showRCHeaders = true;

  // Row beyond panes → return null
  r = SC.GetEditorCellElement(editor, 100, 100);
  expect(r).toBeNull();

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: ctrlkeyFunction branches — recalcFunction, ctrl-c cell, ctrl-v clipboard,
// ctrl-s ntvf, CtrlSEditor (lines 5606, 5657, 5677, 5709, 5718)
// ============================================================================
test("ctrlkeyFunction: recalcFunction + ctrl-c/ctrl-v/ctrl-s branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "te-ctor");
  const editor = control.editor;

  // recalcFunction branch (line 5606): call it
  { editor.recalcFunction(editor); }
  // false branch by nulling RecalcSheet
  const sheetobj = editor.context.sheetobj;
  const savedRecalc = sheetobj.RecalcSheet;
  sheetobj.RecalcSheet = undefined;
  { editor.recalcFunction(editor); }
  sheetobj.RecalcSheet = savedRecalc;

  // ctrl-c: cell exists branch (line 5657)
  editor.ecell = editor.ecell || { coord: "A1", row: 1, col: 1 };
  editor.range = editor.range || { hasrange: false };
  editor.pasteTextarea = editor.pasteTextarea || { style: {}, value: "", focus() {}, select() {} };

  { editor.ctrlkeyFunction(editor, "[ctrl-c]"); }

  // Ctrl-V: clipboard comparison branch (line 5677)
  editor.pastescclipboard = false;
  editor.noEdit = false;
  if (SC.Clipboard) {
    SC.Clipboard.clipboard = "test_clipboard_data";
  }
  { editor.ctrlkeyFunction(editor, "[ctrl-v]"); }
  editor.pastescclipboard = true;
  { editor.ctrlkeyFunction(editor, "[ctrl-v]"); }
  editor.pastescclipboard = false;

  // Ctrl-S: ntvf branch (line 5709) — cell with nontextvalueformat
  const scc = SC.Constants;
  scc.AllowCtrlS = true;
  const cellA1 = sheetobj.cells[editor.ecell.coord] || {};
  const savedNtvf = cellA1.nontextvalueformat;
  cellA1.nontextvalueformat = 1;
  sheetobj.valueformats[0] = "0.00";

  const savedPrompt = (globalThis as any).prompt;
  const origST = (globalThis as any).setTimeout;
  let captured: ((...args: any[]) => void) | null = null;
  const captureST = (fn: (...args: any[]) => void) => {
    captured = fn;
    return 0 as any;
  };

  (globalThis as any).prompt = (_m: string, _d: string) => "General";
  (globalThis as any).setTimeout = captureST;
  { editor.ctrlkeyFunction(editor, "[ctrl-s]"); }
  (globalThis as any).setTimeout = origST;
  if (captured) {
    { (captured as (...args: any[]) => void)(); }
  }

  // Ctrl-S with edit: prefix — CtrlSEditor branch (line 5718)
  SC.CtrlSEditor = (cmd: string) => {
    void cmd;
  };
  (globalThis as any).prompt = (_m: string, _d: string) => "edit:foo";
  captured = null;
  (globalThis as any).setTimeout = captureST;
  { editor.ctrlkeyFunction(editor, "[ctrl-s]"); }
  (globalThis as any).setTimeout = origST;
  if (captured) {
    { (captured as (...args: any[]) => void)(); }
  }
  delete SC.CtrlSEditor;

  // Ctrl-S with cmd: prefix
  (globalThis as any).prompt = (_m: string, _d: string) => "cmd:recalc";
  captured = null;
  (globalThis as any).setTimeout = captureST;
  { editor.ctrlkeyFunction(editor, "[ctrl-s]"); }
  (globalThis as any).setTimeout = origST;
  if (captured) {
    { (captured as (...args: any[]) => void)(); }
  }

  // Ctrl-S with null prompt
  (globalThis as any).prompt = (_m: string, _d: string) => null;
  captured = null;
  (globalThis as any).setTimeout = captureST;
  { editor.ctrlkeyFunction(editor, "[ctrl-s]"); }
  (globalThis as any).setTimeout = origST;
  if (captured) {
    { (captured as (...args: any[]) => void)(); }
  }

  (globalThis as any).prompt = savedPrompt;
  scc.AllowCtrlS = false;
  cellA1.nontextvalueformat = savedNtvf;

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: e || window.event branches in all mouse handlers
// Lines 6474, 6587, 6622, 6653, 6680, 6699, 6732, 6745, 6762, 6771, 6784,
// 6801, 6810, 6830, 6838, 6857, 6981, 6983
// ============================================================================
test("mouse handlers: e||window.event + target||srcElement fallback branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "fallback-evt");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.registeredElements = mi.registeredElements || [];
  mi.registeredElements.push({ element: target, editor });
  mi.ignore = false;
  mi.editor = editor;
  mi.element = target;

  // Set window.event so `e || window.event` takes the window.event branch
  const savedWindowEvent = (globalThis as any).event;

  // ProcessEditorMouseDown with e=null → window.event branch (line 6474)
  (globalThis as any).event = fakeEvent({ clientX: 100, clientY: 100, target });
  { SC.ProcessEditorMouseDown(null); }

  // ProcessEditorMouseDown with target=null, srcElement set (line 6476)
  (globalThis as any).event = fakeEvent({
    clientX: 100,
    clientY: 100,
    target: null,
    srcElement: target,
  });
  { SC.ProcessEditorMouseDown(null); }

  // ProcessEditorMouseMove with e=null → window.event branch (line 6587)
  mi.mouselastcoord = "A1";
  (globalThis as any).event = fakeEvent({ clientX: 100, clientY: 100, target });
  { SC.ProcessEditorMouseMove(null); }

  // ProcessEditorMouseUp with e=null → window.event branch (line 6622)
  mi.mousedowncoord = "A1";
  editor.range = { hasrange: false };
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  (globalThis as any).event = fakeEvent({ clientX: 100, clientY: 100, target });
  { SC.ProcessEditorMouseUp(null); }

  // ProcessEditorColsizeMouseMove with e=null → window.event branch (line 6653)
  mi.mouseresizecolnum = 2;
  mi.mouseresizecol = "B";
  mi.mousedownclientx = 50;
  mi.mouseresizedisplay = document.createElement("div");
  editor.context.colwidth = [0, 80, 80, 80, 80];
  (globalThis as any).event = fakeEvent({ clientX: 60, target });
  { SC.ProcessEditorColsizeMouseMove(null); }

  // ProcessEditorColsizeMouseUp with e=null → window.event branch (line 6680)
  mi.mouseresizecolnum = 2;
  mi.mouseresizecol = "B";
  editor.timeout = null;
  (globalThis as any).event = fakeEvent({ clientX: 60, target });
  { SC.ProcessEditorColsizeMouseUp(null); }

  // ProcessEditorRowsizeMouseMove with e=null → window.event branch (line 6732)
  mi.mouseresizerownum = 2;
  mi.mouseresizerow = 2;
  mi.mousedownclienty = 50;
  mi.mouseresizedisplay = document.createElement("div");
  editor.context.rowheight = [0, 30, 20, 20, 20];
  (globalThis as any).event = fakeEvent({ clientY: 60, target });
  { SC.ProcessEditorRowsizeMouseMove(null); }

  // ProcessEditorRowsizeMouseUp with e=null → window.event branch (line 6838)
  mi.mouseresizerownum = 2;
  mi.mouserowtounhide = null;
  editor.timeout = null;
  (globalThis as any).event = fakeEvent({ clientY: 60, target });
  { SC.ProcessEditorRowsizeMouseUp(null); }

  // ProcessEditorDblClick with e=null → window.event branch (line 6981)
  (globalThis as any).event = fakeEvent({ clientX: 100, clientY: 100, target });
  { SC.ProcessEditorDblClick(null); }

  // ProcessEditorDblClick with target=null, srcElement set (line 6983)
  (globalThis as any).event = fakeEvent({
    clientX: 100,
    clientY: 100,
    target: null,
    srcElement: target,
  });
  { SC.ProcessEditorDblClick(null); }

  (globalThis as any).event = savedWindowEvent;
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorSheetStatusCallback — switch case 6292[9] (calcserverfunc)
// and other uncovered switch cases
// ============================================================================
test("EditorSheetStatusCallback: calcserverfunc and other switch cases", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "essc-switch");
  const editor = control.editor;

  // These switch cases should call GetStatuslineString
  { SC.EditorSheetStatusCallback(
    null,
    "calcserverfunc",
    { count: 1, total: 5, funcname: "SUM", coord: "A1" },
    editor,
  ); }
  { SC.EditorSheetStatusCallback(null, "calcorder", { count: 1, total: 5 }, editor); }
  { SC.EditorSheetStatusCallback(null, "calcstep", { count: 1, total: 5 }, editor); }
  { SC.EditorSheetStatusCallback(null, "calcloading", { sheetname: "Sheet1" }, editor); }
  { SC.EditorSheetStatusCallback(null, "confirmemailsent", "test", editor); }

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorGetStatuslineString — binary-expr branches for count/total
// Lines 6329, 6332, 6338
// ============================================================================
test("EditorGetStatuslineString: count/total binary-expr branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "egss-binexpr");
  const editor = control.editor;

  // calcorder with undefined count → uses 0 (line 6329 binary-expr [1])
  let s = editor.GetStatuslineString("calcorder", {}, {});
  expect(typeof s).toBe("string");

  // calcstep with undefined count → uses 0 (line 6332 binary-expr [1])
  s = editor.GetStatuslineString("calcstep", {}, {});
  expect(typeof s).toBe("string");

  // calcserverfunc with undefined count → uses 0 (line 6338 binary-expr [1])
  s = editor.GetStatuslineString("calcserverfunc", {}, {});
  expect(typeof s).toBe("string");

  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: EditorSheetStatusCallback — hiddencolrow with ecell null (lines 6217, 6228)
// Already tested but let me ensure the branches are hit
// ============================================================================
test("EditorSheetStatusCallback: hiddencolrow branches with ecell null", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "essc-hidden");
  const editor = control.editor;
  const sheetobj = editor.context.sheetobj;

  // hiddencolrow == "col" with ecell null (line 6217 false branch)
  sheetobj.hiddencolrow = "col";
  sheetobj.colattribs.hide = sheetobj.colattribs.hide || {};
  editor.ecell = null;
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }

  // hiddencolrow == "row" with ecell null (line 6228 false branch)
  sheetobj.hiddencolrow = "row";
  sheetobj.rowattribs.hide = sheetobj.rowattribs.hide || {};
  editor.ecell = null;
  { SC.EditorSheetStatusCallback(null, "cmdend", null, editor); }

  sheetobj.hiddencolrow = "";
  teardownEditor(SC, editor);
});

// ============================================================================
// TEST: Colsize/Rowsize/Colselect/Rowselect MouseDown with e=null → window.event
// Lines 6653, 6732, 6762, 6770, 6784, 6801, 6810, 6830, 6838
// ============================================================================
test("colsize/rowsize/colselect/rowselect MouseDown: e||window.event branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "resize-md");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid || editor.griddiv;
  const mi = SC.EditorMouseInfo;
  mi.registeredElements = mi.registeredElements || [];
  mi.registeredElements.push({ element: target, editor });
  mi.ignore = false;
  mi.editor = editor;
  mi.element = target;

  const savedWindowEvent = (globalThis as any).event;
  const fakeEvt = fakeEvent({ clientX: 100, clientY: 100, target });

  // ProcessEditorColsizeMouseDown(e=null, ele, result) → line 6653
  (globalThis as any).event = fakeEvt;
  { SC.ProcessEditorColsizeMouseDown(null, target, { coltoresize: 2 }); }

  // ProcessEditorRowselectMouseDown(e=null, ele, result) → line 6732
  (globalThis as any).event = fakeEvt;
  { SC.ProcessEditorRowselectMouseDown(null, target, { row: 2 }); }

  // ProcessEditorRowselectMouseMove(e=null) → line 6745
  (globalThis as any).event = fakeEvt;
  mi.mouselastcoord = "A1";
  { SC.ProcessEditorRowselectMouseMove(null); }

  // ProcessEditorRowselectMouseUp(e=null) → line 6762
  (globalThis as any).event = fakeEvt;
  { SC.ProcessEditorRowselectMouseUp(null); }

  // ProcessEditorColselectMouseDown(e=null, ele, result) → line 6770
  (globalThis as any).event = fakeEvt;
  { SC.ProcessEditorColselectMouseDown(null, target, { col: 2 }); }

  // ProcessEditorColselectMouseMove(e=null) → line 6784
  (globalThis as any).event = fakeEvt;
  { SC.ProcessEditorColselectMouseMove(null); }

  // ProcessEditorColselectMouseUp(e=null) → line 6801
  (globalThis as any).event = fakeEvt;
  { SC.ProcessEditorColselectMouseUp(null); }

  // ProcessEditorRowsizeMouseDown(e=null, ele, result) → line 6810
  (globalThis as any).event = fakeEvt;
  { SC.ProcessEditorRowsizeMouseDown(null, target, { rowtoresize: 2 }); }

  // ProcessEditorRowsizeMouseMove(e=null) → line 6838
  (globalThis as any).event = fakeEvent({ clientY: 60, target });
  mi.mouseresizerownum = 2;
  mi.mouseresizerow = 2;
  mi.mousedownclienty = 50;
  mi.mouseresizedisplay = document.createElement("div");
  editor.context.rowheight = [0, 30, 20, 20, 20];
  { SC.ProcessEditorRowsizeMouseMove(null); }

  (globalThis as any).event = savedWindowEvent;
  teardownEditor(SC, editor);
});
