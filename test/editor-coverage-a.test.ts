import { afterAll, afterEach, expect, test } from "vite-plus/test";

import { loadSocialCalc as _loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

// Track all setInterval/setTimeout calls so we can cancel them after each
// test. Without this, the InputEcho heartbeat (50 ms repeating) and various
// cleanup timeouts fire against stale module state in later tests, tripping
// errors like `editor.inputEcho.SetText` on a null editor.
//
// The SocialCalc bundle mostly calls `window.setTimeout` (bound at module
// load time), so we also re-wire `window.setTimeout/Interval` after each
// installBrowserShim(). Our loadSocialCalc wrapper below handles that.
//
// Install at module top so timers created during module setup are tracked
// immediately. Vitest isolates each file, and the helper's idempotent guard
// makes repeated setup within this worker safe.
ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
});

// Restore original timers after this suite so other test files run with
// unmodified globals.
afterAll(() => {
  restoreOriginalTimers();
});

/**
 * editor-coverage.test.ts
 *
 * Drives js/socialcalctableeditor.js through the TableEditor, CellHandles,
 * InputBox, InputEcho, TableControl, Drag/Button, MouseWheel, and Keyboard
 * subsystems. Most handlers are invoked directly with synthetic event objects
 * (the fake DOM does not dispatch).
 *
 * The test file uses `-coverage` fixtures with a SpreadsheetControl because
 * many code paths need the editor to be fully initialized (cellhandles,
 * inputBox, colpositions, etc.). Mouse handlers that depend on grid layout
 * positions get synthetic `editor.rowpositions` / `editor.colpositions`
 * populated directly. See NOTES at bottom of the file for gaps that remain
 * uncoverable under a headless fake-DOM.
 */

async function loadSocialCalc(options: { browser?: boolean } = {}) {
  const SC = await _loadSocialCalc({ ...options, browser: true });
  installUiShim();
  installWindowTimerTracking();
  return SC;
}

function waitEditor(editor: any, wantStatus = "doneposcalc", timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const key = "tmp_" + Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      delete editor.StatusCallback[key];
      resolve();
    }, timeoutMs);
    editor.StatusCallback[key] = {
      func: (_e: any, status: string) => {
        if (status === wantStatus) {
          clearTimeout(timer);
          delete editor.StatusCallback[key];
          resolve();
        }
      },
      params: null,
    };
  });
}

async function newControl(SC: any, containerId = "ed-root") {
  const container = document.createElement("div");
  container.id = containerId;
  (document as any).body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

/**
 * Clean up state that would leak between tests: running InputEcho heartbeat,
 * stale Keyboard.focusTable, stale AutoRepeat timer, stale ButtonInfo timer.
 * Call at the end of tests that touched any of those.
 */
function teardownEditor(SC: any, editor: any) {
  try {
    if (editor?.inputEcho?.interval) {
      clearInterval(editor.inputEcho.interval);
      editor.inputEcho.interval = null;
    }
  } catch {
    // cleanup: inputEcho heartbeat may already be stopped/cleared by SocialCalc; best-effort clear only.
  }
  try {
    if (SC?.AutoRepeatInfo?.timer) {
      clearTimeout(SC.AutoRepeatInfo.timer);
      SC.AutoRepeatInfo.timer = null;
      SC.AutoRepeatInfo.mouseinfo = null;
    }
  } catch {
    // cleanup: AutoRepeat timer may already have fired/cleared; best-effort clear only.
  }
  try {
    if (SC?.ButtonInfo?.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  } catch {
    // cleanup: ButtonInfo repeat timer may already have fired/cleared; best-effort clear only.
  }
  try {
    if (SC?.Keyboard) {
      SC.Keyboard.focusTable = null;
      SC.Keyboard.passThru = null;
    }
  } catch {
    // cleanup: resetting stale global Keyboard focus/passThru; failure here is not test-relevant.
  }
  try {
    if (editor) {
      editor.state = "start";
      if (editor.timeout) {
        clearTimeout(editor.timeout);
        editor.timeout = null;
      }
    }
  } catch {
    // cleanup: resetting editor.state/timeout for the next test; failure here is not test-relevant.
  }
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

/** Populate colpositions/rowpositions so GridMousePosition can map clientX/Y to row/col. */
function primeGridLayout(editor: any) {
  // Make sure the editor has computed positions we can rely on.
  try {
    editor.CalculateEditorPositions();
  } catch {
    // setup: layout may not be computable yet under the fake DOM; the explicit
    // fallback defaults below are applied unconditionally regardless of success.
  }
  editor.gridposition = editor.gridposition || { left: 0, top: 0 };
  editor.headposition = editor.headposition || { left: 30, top: 30 };
  const colwidths = [0, 30, 80, 80, 80, 80, 80, 80];
  const rowheights = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.colpositions = [0, 0, 80, 160, 240, 320, 400, 480];
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.colwidth = colwidths;
  editor.rowheight = rowheights;
  editor.firstscrollingrow = editor.firstscrollingrow ?? 1;
  editor.firstscrollingcol = editor.firstscrollingcol ?? 1;
  editor.lastnonscrollingrow = editor.lastnonscrollingrow ?? 0;
  editor.lastnonscrollingcol = editor.lastnonscrollingcol ?? 0;
  editor.lastvisiblerow = editor.lastvisiblerow ?? 7;
  editor.lastvisiblecol = editor.lastvisiblecol ?? 7;
  editor.firstscrollingrowtop = editor.firstscrollingrowtop ?? 30;
  editor.firstscrollingcolleft = editor.firstscrollingcolleft ?? 30;
  editor.verticaltablecontrol = editor.verticaltablecontrol || { controlborder: 500 };
  editor.horizontaltablecontrol = editor.horizontaltablecontrol || { controlborder: 500 };
}
test("TableEditor: prototype passthrough methods", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "proto-root");
  const editor = control.editor;

  // ScheduleSheetCommands / SheetUndo / SheetRedo (proxy-through)
  editor.ScheduleSheetCommands("recalc", false);
  editor.SheetUndo();
  editor.SheetRedo();
  // EditorStepSet proxy references a standalone TableEditorSC.EditorStepSet
  // that does not exist as its own export, so the prototype method always
  // throws when called — this is a real (if unfortunate) reference bug in
  // production code, not a test setup gap.
  if (typeof editor.EditorStepSet === "function") {
    expect(() => editor.EditorStepSet("calcstart", null)).toThrow(/EditorStepSet is not a function/);
  }
  // StopPropagation prototype version forwards `this` (the editor) as the
  // "event" object, so it sets cancelBubble/returnValue directly on editor.
  editor.StopPropagation();
  expect(editor.cancelBubble).toBe(true);
  expect(editor.returnValue).toBe(false);
  // SetMouseMoveUp/RemoveMouseMoveUp prototype versions only forward `this`
  // as the first arg (`move`), leaving `event` undefined; StopPropagation is
  // always invoked with that undefined event, which throws a specific,
  // deterministic TypeError reading `.stopPropagation` off `undefined`
  // before either call can complete.
  const missingEventPattern =
    /Cannot read propert(?:y|ies) of undefined.*stopPropagation|undefined is not an object.*event\.stopPropagation/;
  expect(() => editor.SetMouseMoveUp()).toThrow(missingEventPattern);
  expect(() => editor.RemoveMouseMoveUp()).toThrow(missingEventPattern);
  expect(editor.context).toBeDefined();
});

test("CreateTableEditor / ResizeTableEditor / SafariPasteFunction", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  const ele = SC.CreateTableEditor(editor, 300, 200);
  expect(ele).toBeDefined();
  expect(editor.toplevel).toBe(ele);
  expect(editor.griddiv).toBeDefined();

  // Resize rerouter.
  SC.ResizeTableEditor(editor, 500, 400);
  expect(editor.width).toBe(500);
  expect(editor.height).toBe(400);

  // SafariPasteFunction only calls preventDefault.
  let called = false;
  SC.SafariPasteFunction({
    preventDefault() {
      called = true;
    },
  });
  expect(called).toBe(true);
});

test("EditorSheetStatusCallback: all switch branches + alert fallback", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "st-root");
  const editor = control.editor;
  // Register a custom StatusCallback so signalstatus has something to fire.
  const seen: string[] = [];
  editor.StatusCallback["test"] = {
    func: (_e: any, s: string) => {
      seen.push(s);
    },
    params: null,
  };
  const statuses = [
    "startup",
    "cmdstart",
    "cmdextension",
    "cmdend",
    "calcstart",
    "calccheckdone",
    "calcorder",
    "calcstep",
    "calcloading",
    "calcserverfunc",
    "calcfinished",
    "schedrender",
    "renderdone",
    "schedposcalc",
    "doneposcalc",
    "emailing",
    "confirmemailsent",
  ];
  // calcorder/calcstep/calcserverfunc build a "N%" progress string from
  // arg.count/arg.total, and calcloading reads arg.sheetname — seed a
  // realistic arg per status instead of a shared `null` so those branches
  // run their real formatting logic instead of throwing on null.
  const statusArgs: Record<string, any> = {
    calcorder: { coord: "A1", total: 10, count: 3 },
    calcstep: { coord: "A1", total: 10, count: 3 },
    calcloading: { sheetname: "TestSheet" },
    calcserverfunc: { total: 10, count: 3 },
  };
  for (const s of statuses) {
    expect(() => SC.EditorSheetStatusCallback(null, s, statusArgs[s] ?? null, editor)).not.toThrow();
  }
  // Stack up a deferred command so the cmdend branch pops it.
  editor.deferredCommands.push({ cmdstr: "recalc", saveundo: false });
  expect(() => SC.EditorSheetStatusCallback(null, "cmdend", null, editor)).not.toThrow();
  // Trigger hidden-col movement branch.
  editor.context.sheetobj.hiddencolrow = "col";
  expect(() => SC.EditorSheetStatusCallback(null, "cmdend", null, editor)).not.toThrow();
  editor.context.sheetobj.hiddencolrow = "row";
  expect(() => SC.EditorSheetStatusCallback(null, "cmdend", null, editor)).not.toThrow();

  // Unknown status hits alert branch (alert is a no-op in our shim).
  expect(() => SC.EditorSheetStatusCallback(null, "qqq-unknown", null, editor)).not.toThrow();
  // doneposcalc with deferredCommands also deferredEmailCommands.
  editor.deferredEmailCommands.push({ cmdstr: "recalc", saveundo: false });
  expect(() => SC.EditorSheetStatusCallback(null, "doneposcalc", null, editor)).not.toThrow();
  expect(seen.length).toBeGreaterThan(0);
});

test("EditorGetStatuslineString: params with emailing/response + circular-ref", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "gs-root");
  const editor = control.editor;
  // Email flow: emailing → params.emailing ="sending".
  const params: any = {};
  let s = editor.GetStatuslineString("emailing", null, params);
  expect(s).toBe("A1 &nbsp; Sending Email ");
  // Calcstart sets params.calculating true; hitting fallthrough with null progress.
  s = editor.GetStatuslineString("calcstart", null, params);
  expect(s).toBe("A1 &nbsp; Calculation start...Sending Email ");
  s = editor.GetStatuslineString("calcfinished", 10, params);
  expect(s).toBe("A1 &nbsp; Sending Email ");
  // confirmemailsent
  s = editor.GetStatuslineString("confirmemailsent", " ok", params);
  expect(s).toBe("A1 &nbsp;  ok");
  // doneposcalc with sent response
  s = editor.GetStatuslineString("doneposcalc", null, params);
  expect(s).toBe("A1 &nbsp;  ok");
  // default fallthrough: arbitrary status
  s = editor.GetStatuslineString("customStatus", null, params);
  expect(s).toBe("A1 &nbsp; customStatus");

  // Range-sum path: set up a range and make sure it's computed.
  editor.MoveECell("A1");
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 10",
    "set B1 value n 20",
    "set C1 value n 30",
  ]);
  editor.RangeAnchor("A1");
  editor.RangeExtend("C1");
  s = editor.GetStatuslineString("cmdend", null, {});
  expect(s).toContain("SUM=");

  // Circular-reference path.
  editor.context.sheetobj.attribs.circularreferencecell = "A1|B1";
  s = editor.GetStatuslineString("renderdone", null, {});
  expect(s).toContain("Circular reference: A1 referenced by B1");
  editor.context.sheetobj.attribs.circularreferencecell = "";

  // Needs-recalc path.
  editor.context.sheetobj.attribs.needsrecalc = "yes";
  s = editor.GetStatuslineString("startup", null, {});
  expect(s).toContain("(Recalc needed)");
  editor.context.sheetobj.attribs.needsrecalc = "no";
});

test("EditorMouseRegister / Unregister: double-register re-uses slot, unregister cleans up", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "mreg-root");
  // Register again with the same editor.
  SC.EditorMouseRegister(control.editor);
  // Replace fullgrid so the "element changed" branch fires.
  const oldGrid = control.editor.fullgrid;
  const newGrid = document.createElement("table");
  control.editor.fullgrid = newGrid;
  SC.EditorMouseRegister(control.editor);
  // Restore so teardown is clean.
  control.editor.fullgrid = oldGrid;
  // Unregister twice — second one is a no-op.
  SC.EditorMouseUnregister(control.editor);
  SC.EditorMouseUnregister(control.editor);
  expect(control).toBeDefined();
});

test("StopPropagation / SetMouseMoveUp / RemoveMouseMoveUp: IE branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  // IE branches require no addEventListener on doc, but we can still exercise
  // the DOM-level-2 path via a synthetic event.
  const ev = {
    preventDefault() {},
    stopPropagation() {},
  };
  SC.StopPropagation(ev);
  // Event without preventDefault/stopPropagation (falls back to cancelBubble/returnValue).
  const ev2: any = {};
  SC.StopPropagation(ev2);
  expect(ev2.cancelBubble).toBe(true);
  expect(ev2.returnValue).toBe(false);

  // SetMouseMoveUp with full DOM-L2 surface on the document so it picks
  // the Firefox branch rather than the IE setCapture branch.
  const noop = () => {};
  const holder = document.createElement("div");
  (holder as any).setCapture = function () {};
  (holder as any).releaseCapture = function () {};
  (document as any).addEventListener = (document as any).addEventListener || function () {};
  (document as any).removeEventListener = (document as any).removeEventListener || function () {};
  SC.SetMouseMoveUp(noop, noop, holder, { preventDefault() {} });
  SC.RemoveMouseMoveUp(noop, noop, holder, { preventDefault() {} });

  // Force IE branch by temporarily nulling addEventListener.
  const savedAddListener = (document as any).addEventListener;
  const savedRemoveListener = (document as any).removeEventListener;
  (document as any).addEventListener = null;
  (document as any).removeEventListener = null;
  // With addEventListener/removeEventListener forced unavailable, both
  // calls reach document.addEventListener/removeEventListener directly
  // (there is no separate IE fallback path in SetMouseMoveUp/RemoveMouseMoveUp
  // itself) and reliably throw a specific "is not a function" TypeError.
  expect(() => {
    const ele = document.createElement("div");
    (ele as any).setCapture = function () {};
    (ele as any).releaseCapture = function () {};
    SC.SetMouseMoveUp(noop, noop, ele, { preventDefault() {} });
  }).toThrow(/document\.addEventListener is not a function/);
  expect(() => {
    const ele = document.createElement("div");
    (ele as any).setCapture = function () {};
    (ele as any).releaseCapture = function () {};
    SC.RemoveMouseMoveUp(noop, noop, ele, { preventDefault() {} });
  }).toThrow(/document\.removeEventListener is not a function/);
  (document as any).addEventListener = savedAddListener;
  (document as any).removeEventListener = savedRemoveListener;
});

test("ProcessEditorMouseDown: valid target, shiftKey range extension", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pmd-root");
  const editor = control.editor;
  primeGridLayout(editor);
  // SetMouseMoveUp/RemoveMouseMoveUp (invoked by MouseDown/Up below) need
  // document.addEventListener/removeEventListener, which the fresh
  // FakeDocument for this test does not provide by default.
  ensureDocumentEvents();

  // Find the target cell element via GetEditorCellElement.
  const cellInfo = SC.GetEditorCellElement(editor, 2, 2);
  const target = cellInfo?.element ?? editor.fullgrid;

  // Fire mousedown inside grid area — no range yet, result.coord != mousedown.
  const ev = fakeEvent({ clientX: 100, clientY: 60, target });
  SC.ProcessEditorMouseDown(ev);
  expect(editor.ecell.coord).toBe("B2");
  expect(editor.range.hasrange).toBe(false);
  // Then release at a different cell — a plain (non-shift) drag-release
  // still anchors a range between the down/up cells.
  const ev2 = fakeEvent({ clientX: 160, clientY: 80, target });
  SC.ProcessEditorMouseUp(ev2);
  expect(editor.ecell.coord).toBe("C3");
  expect(editor.range.hasrange).toBe(true);

  // Shift-click re-anchors a fresh single-cell range at the clicked cell.
  primeGridLayout(editor);
  const ev3 = fakeEvent({ clientX: 100, clientY: 60, target, shiftKey: true });
  SC.ProcessEditorMouseDown(ev3);
  expect(editor.range.hasrange).toBe(true);
  expect(editor.range.anchorcoord).toBe("B2");
  expect(editor.range.top).toBe(2);
  expect(editor.range.bottom).toBe(2);
  expect(editor.range.left).toBe(2);
  expect(editor.range.right).toBe(2);
  // Shift-drag extends the range from the anchor toward the new position.
  const ev4 = fakeEvent({ clientX: 200, clientY: 100, target, shiftKey: true });
  SC.ProcessEditorMouseMove(ev4);
  expect(editor.range.anchorcoord).toBe("B2");
  expect(editor.range.bottom).toBe(4);
  expect(editor.range.right).toBe(3);
  SC.ProcessEditorMouseUp(ev4);
  expect(editor.range.bottom).toBe(4);
  expect(editor.range.right).toBe(3);

  // ignore=true branch — a no-op early return.
  SC.EditorMouseInfo.ignore = true;
  expect(() => SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 60, target }))).not.toThrow();
  SC.EditorMouseInfo.ignore = false;

  // Target not in registeredElements path.
  expect(() => SC.ProcessEditorMouseDown(fakeEvent({ target: document.createElement("div") }))).not.toThrow();

  // Text node target (nodeType 3) — goes to parentNode.
  const textTarget: any = document.createTextNode("x");
  (textTarget as any).parentNode = target;
  expect(() => SC.ProcessEditorMouseDown(fakeEvent({ target: textTarget, clientX: 100, clientY: 60 }))).not.toThrow();

  // ProcessEditorMouseMove without mouseinfo.editor — early return.
  SC.EditorMouseInfo.editor = null;
  expect(() => SC.ProcessEditorMouseMove(fakeEvent({ clientX: 100, clientY: 60, target }))).not.toThrow();
  expect(() => SC.ProcessEditorMouseUp(fakeEvent({ clientX: 100, clientY: 60, target }))).not.toThrow();
});

test("ProcessEditorMouseDown: SocialCalc._app=true takes CmdGotFocus branch", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "app-mode-root");
  const editor = control.editor;
  primeGridLayout(editor);

  const cellInfo = SC.GetEditorCellElement(editor, 2, 2);
  const target = cellInfo?.element ?? editor.fullgrid;

  const prevApp = SC._app;
  SC._app = true;
  // clientY=70 lands squarely in body rows (not the 30-50 header band).
  expect(() => {
    const ev = fakeEvent({ clientX: 100, clientY: 70, target });
    SC.ProcessEditorMouseDown(ev);
  }).not.toThrow();
  SC._app = prevApp;
});

test("ProcessEditorMouseDown: cell containing ioWidget (valuetype 'ni') is clickable", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "iowidget-root");
  const editor = control.editor;
  primeGridLayout(editor);

  // Put a widget cell at B2 with valuetype "ni" (numeric + ioWidget 'i').
  const cell = editor.context.sheetobj.GetAssuredCell("B2");
  cell.valuetype = "niBUTTON";
  cell.formula = 'BUTTON("x","y")';
  cell.datatype = "f";
  cell.datavalue = "0";

  const cellInfo = SC.GetEditorCellElement(editor, 2, 2);
  const target = cellInfo?.element ?? editor.fullgrid;
  // The widget_id is "BUTTON_B2" per the source; fire a click on both the
  // cell itself and on a fake widget element with matching id.
  expect(() => SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 60, target }))).not.toThrow();
  const widget = document.createElement("button");
  widget.id = "BUTTON_B2";
  document.body.appendChild(widget);
  expect(() => SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 60, target: widget }))).not.toThrow();
});

test("ProcessEditorDblClick → EditorOpenCellEdit", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "dbl-root");
  const editor = control.editor;
  primeGridLayout(editor);

  const cellInfo = SC.GetEditorCellElement(editor, 2, 2);
  const target = cellInfo?.element ?? editor.fullgrid;

  // Ensure a good state="start" + ecell.
  editor.MoveECell("B2");
  const ev = fakeEvent({ clientX: 100, clientY: 60, target });
  expect(() => SC.ProcessEditorDblClick(ev)).not.toThrow();
  // After opening: state == "input".
  expect(editor.state === "input" || editor.state === "start").toBe(true);
  // Cancel via esc.
  expect(() => editor.EditorProcessKey("[esc]", { shiftKey: false })).not.toThrow();

  // Dblclick when ignored.
  SC.EditorMouseInfo.ignore = true;
  expect(() => SC.ProcessEditorDblClick(ev)).not.toThrow();
  SC.EditorMouseInfo.ignore = false;

  // No editor target in registered elements.
  expect(() => SC.ProcessEditorDblClick(fakeEvent({ target: document.createElement("div") }))).not.toThrow();

  // State != start should fall through default.
  editor.state = "input";
  expect(() => SC.ProcessEditorDblClick(fakeEvent({ clientX: 100, clientY: 60, target }))).not.toThrow();
  editor.state = "start";
});

test("EditorProcessKey: full state machine coverage", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "epk-root");
  const editor = control.editor;

  // state=start: [esc] with range → removes range.
  editor.MoveECell("B2");
  editor.RangeAnchor("A1");
  editor.RangeExtend("C3");
  editor.EditorProcessKey("[esc]", { shiftKey: false });
  expect(editor.range.hasrange).toBe(false);

  // [del] / [backspace] → empties range.
  editor.MoveECell("A1");
  editor.EditorProcessKey("[del]", { shiftKey: false });
  editor.EditorProcessKey("[backspace]", { shiftKey: false });

  // [enter], [tab] → converts to [adown]/[aleft].
  editor.EditorProcessKey("[enter]", { shiftKey: false });
  editor.EditorProcessKey("[tab]", { shiftKey: true });

  // [f2] → opens input box in "inputboxdirect" mode.
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  expect(editor.state).toBe("inputboxdirect");

  // [f2] again while inputboxdirect → flips to "input"
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  expect(editor.state).toBe("input");

  // [esc] from input state → back to start.
  editor.EditorProcessKey("[esc]", { shiftKey: false });
  expect(editor.state).toBe("start");

  // Character that opens input, then [tab] saves and moves.
  editor.EditorProcessKey("h", { shiftKey: false });
  expect(editor.state).toBe("input");
  const p = waitEditor(editor);
  editor.EditorProcessKey("[tab]", { shiftKey: false });
  await p;

  // Input state: partialexpr path. Feed "=" then shift-arrow to enter pointing mode.
  editor.MoveECell("A1");
  editor.EditorProcessKey("=", { shiftKey: false });
  expect(editor.state).toBe("input");
  // Simulate a character input to make inputBox contain a formula operator ending.
  editor.inputBox.SetText("=");
  editor.workingvalues.partialexpr = "=";
  editor.EditorProcessKey("[aright]", { shiftKey: false });
  // Now abort pointing and finish editing.
  editor.inputBox.SetText("=A2+A3");
  editor.workingvalues.partialexpr = "";
  const p2 = waitEditor(editor);
  editor.EditorProcessKey("[enter]", { shiftKey: false });
  await p2;

  // backspace in pointing mode.
  editor.MoveECell("B1");
  editor.EditorProcessKey("=", { shiftKey: false });
  editor.inputBox.SetText("=");
  editor.workingvalues.partialexpr = "=";
  editor.EditorProcessKey("[backspace]", { shiftKey: false });
  // Exit input.
  editor.EditorProcessKey("[esc]", { shiftKey: false });

  // Unknown ctrl key passes through ctrlkeyFunction or returns true.
  const rc = editor.EditorProcessKey("[ctrl-q]", { shiftKey: false });
  expect(rc === true || rc === false).toBe(true);

  // skip-and-start state.
  editor.state = "skip-and-start";
  editor.EditorProcessKey("x", { shiftKey: false });
  expect(editor.state).toBe("start");

  // Default unknown state.
  editor.state = "unknown-state";
  const rc2 = editor.EditorProcessKey("x", { shiftKey: false });
  expect(rc2).toBe(true);
  editor.state = "start";

  // [home] with shift → range anchor/extend.
  editor.MoveECell("C3");
  editor.EditorProcessKey("[aright]", { shiftKey: true });

  // readonly cell returns early on typed input.
  await scheduleCommands(SC, editor.context.sheetobj, ["set D5 readonly yes"]);
  editor.MoveECell("D5");
  const rc3 = editor.EditorProcessKey("q", { shiftKey: false });
  expect(rc3).toBe(true);

  // Clear readonly so subsequent tests don't mis-fire.
  await scheduleCommands(SC, editor.context.sheetobj, ["set D5 readonly no"]);
});

test("EditorProcessKey: inputboxdirect branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "epk2-root");
  const editor = control.editor;
  editor.MoveECell("A1");
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  expect(editor.state).toBe("inputboxdirect");
  // Type something then enter saves.
  editor.inputBox.SetText("hello");
  editor.EditorProcessKey("[enter]", { shiftKey: false });
  // state should go to start synchronously (the save is async but the state
  // flip is immediate).
  expect(editor.state).toBe("start");

  // Esc in inputboxdirect drops changes.
  editor.MoveECell("B1");
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  editor.inputBox.SetText("discard");
  editor.EditorProcessKey("[esc]", { shiftKey: false });
  expect(editor.state).toBe("start");

  // Tab from inputboxdirect.
  editor.MoveECell("C1");
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  editor.inputBox.SetText("t");
  editor.EditorProcessKey("[tab]", { shiftKey: true });
  expect(editor.state).toBe("start");

  // enter with ecell != wval.ecoord → MoveECell(wval.ecoord) branch.
  editor.MoveECell("D5");
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  editor.inputBox.SetText("moved");
  // Simulate ecell moving elsewhere before enter fires (e.g. via a stray
  // RangeAnchor side effect).
  (editor.workingvalues as any).ecoord = "D5";
  editor.MoveECell("F7");
  editor.EditorProcessKey("[enter]", { shiftKey: false });
  expect(editor.state).toBe("start");

  // f2 while in inputboxdirect → state "input" (covers 9993-9995 branch).
  editor.MoveECell("E1");
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  const r = editor.EditorProcessKey("[f2]", { shiftKey: false });
  expect(r).toBe(false);
  expect(editor.state).toBe("input");
});

test("EditorAddToInput: start + input branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ait-root");
  const editor = control.editor;

  // readonly early return.
  await scheduleCommands(SC, editor.context.sheetobj, ["set A5 readonly yes"]);
  editor.MoveECell("A5");
  editor.EditorAddToInput("x");
  await scheduleCommands(SC, editor.context.sheetobj, ["set A5 readonly no"]);

  // Start state → open input.
  editor.MoveECell("A1");
  editor.EditorAddToInput("=SUM(", "");
  expect(editor.state).toBe("input");
  // Input state extends text.
  editor.EditorAddToInput("A1)");
  // Add while partialexpr is truthy — resets to partialexpr.
  editor.workingvalues.partialexpr = "=SUM(";
  editor.EditorAddToInput("B2");
  // Cancel via esc so we leave a clean state.
  editor.EditorProcessKey("[esc]", { shiftKey: false });

  // Default state branch (unrecognized).
  editor.state = "not-a-state";
  editor.EditorAddToInput("noop");
  editor.state = "start";
});

test("EditorSaveEdit: text/formula/constant/text-prefix/empty paths", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ese-root");
  const editor = control.editor;

  // Use explicit text arg → bypasses inputBox.GetText().
  editor.MoveECell("A1");
  editor.workingvalues.ecoord = "A1";
  editor.EditorSaveEdit("hello");
  // Same-value early return branch.
  editor.EditorSaveEdit("hello");

  editor.workingvalues.ecoord = "B1";
  editor.EditorSaveEdit("=2+2");

  editor.workingvalues.ecoord = "C1";
  editor.EditorSaveEdit("'123abc");

  editor.workingvalues.ecoord = "A1";
  editor.EditorSaveEdit("");

  editor.workingvalues.ecoord = "D1";
  editor.EditorSaveEdit("$1,234.50");

  editor.workingvalues.ecoord = "E1";
  editor.EditorSaveEdit("42");

  editor.workingvalues.ecoord = "F1";
  const pendingDrain = waitEditor(editor);
  editor.EditorSaveEdit("<span>hi</span>");
  // Await the real doneposcalc signal instead of a fixed delay.
  await pendingDrain;
  expect(editor.context.sheetobj.cells["F1"]?.datavalue).toContain("hi");

  // ioEventTree branch for EditedTriggerCell. Invoke directly so we cover
  // its switch without going through the deferred email command pipeline.
  editor.context.sheetobj.ioEventTree = { G1: { G1: true } };
  editor.context.sheetobj.ioParameterList = {
    G1: { function_name: "EMAILONEDIT" },
  };
  // Also: call EditorSaveEdit on G1 with ioEventTree already set so the
  // trailing `if (typeof ioEventTree[ecoord] !== 'undefined')` branch
  // fires from EditorSaveEdit directly.
  editor.workingvalues.ecoord = "G1";
  expect(() => editor.EditorSaveEdit("triggered")).not.toThrow();
  expect(() => SC.EditedTriggerCell({ G1: true }, "G1", editor, editor.context.sheetobj)).not.toThrow();
  editor.context.sheetobj.ioEventTree = { H1: { H1: true } };
  editor.context.sheetobj.ioParameterList = {
    H1: { function_name: "OTHER" },
  };
  expect(() => SC.EditedTriggerCell({ H1: true }, "H1", editor, editor.context.sheetobj)).not.toThrow();
  editor.context.sheetobj.ioParameterList = {};
  expect(() => SC.EditedTriggerCell({ Z1: true }, "Z1", editor, editor.context.sheetobj)).not.toThrow();

  delete editor.context.sheetobj.ioEventTree;
  delete editor.context.sheetobj.ioParameterList;
  editor.deferredEmailCommands = [];
  expect(editor.state).toBe("start");
});

test("EditorApplySetCommandsToRange: with and without range", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "asc-root");
  const editor = control.editor;

  editor.MoveECell("A1");
  const p1 = waitEditor(editor);
  editor.EditorApplySetCommandsToRange("bgcolor rgb(1,2,3)");
  await p1;

  editor.RangeAnchor("A1");
  editor.RangeExtend("B2");
  const p2 = waitEditor(editor);
  editor.EditorApplySetCommandsToRange("font normal normal * *");
  await p2;
});

test("EditorProcessMouseWheel: positive and negative delta", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "mw-root");
  const editor = control.editor;

  const wobj = { functionobj: { editor } };
  // Delta > 0 triggers one branch.
  expect(() => SC.EditorProcessMouseWheel({ preventDefault() {} }, 2, null, wobj)).not.toThrow();
  expect(() => SC.EditorProcessMouseWheel({ preventDefault() {} }, -2, null, wobj)).not.toThrow();
  // Busy short-circuit.
  editor.busy = true;
  expect(() => SC.EditorProcessMouseWheel({ preventDefault() {} }, 2, null, wobj)).not.toThrow();
  editor.busy = false;
});

test("GridMousePosition: row/col header, unhide, footer, resize branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "gmp-root");
  const editor = control.editor;
  primeGridLayout(editor);

  // Inside the grid.
  const r = SC.GridMousePosition(editor, 100, 60);
  expect(r).toBeDefined();
  // Row header band (x<headposition.left, x>=gridposition.left).
  editor.headposition = { left: 50, top: 50 };
  editor.gridposition = { left: 0, top: 0 };
  const rh = SC.GridMousePosition(editor, 20, 60);
  expect(rh).toBeDefined();
  // Column header band.
  const ch = SC.GridMousePosition(editor, 100, 20);
  expect(ch).toBeDefined();
  // Footer.
  editor.verticaltablecontrol = { controlborder: 400 };
  editor.horizontaltablecontrol = { controlborder: 400 };
  const rf = SC.GridMousePosition(editor, 420, 60);
  expect(rf).toBeDefined();
  const cf = SC.GridMousePosition(editor, 100, 420);
  expect(cf).toBeDefined();
  // Off-grid.
  const off = SC.GridMousePosition(editor, 9999, 9999);
  expect(off).toBeDefined();

  // Col resize hit zone: clientX near colposition + colwidth.
  editor.colpositions = [0, 0, 80, 160];
  editor.colwidth = [0, 30, 80, 80];
  const resizeCol = SC.GridMousePosition(editor, 30 - 2, 20);
  expect(resizeCol).toBeDefined();
});

test("ProcessEditorColsize Down/Move/Up: full sequence", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "csz-root");
  const editor = control.editor;
  primeGridLayout(editor);

  // Stub document.addEventListener/removeEventListener so SetMouseMoveUp /
  // RemoveMouseMoveUp don't throw — without this MouseDown/Up bail out
  // before reaching the colnum-resize branch.
  if (typeof (document as any).addEventListener !== "function") {
    (document as any).addEventListener = () => {};
    (document as any).removeEventListener = () => {};
  }

  // Simulate a synthetic result object for colsize.
  SC.EditorMouseInfo.editor = editor;
  const result: any = { coltoresize: 2, coltounhide: null };
  const ev = fakeEvent({ clientX: 100, clientY: 0 });
  expect(() => SC.ProcessEditorColsizeMouseDown(ev, editor.fullgrid, result)).not.toThrow();
  expect(() => SC.ProcessEditorColsizeMouseMove(fakeEvent({ clientX: 120, clientY: 0 }))).not.toThrow();
  expect(() => SC.ProcessEditorColsizeMouseUp(fakeEvent({ clientX: 130, clientY: 0 }))).not.toThrow();
  // FinishColRowSize runs deferred (we invoke directly to cover it).
  expect(() => SC.FinishColRowSize()).not.toThrow();

  // Unhide branch
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.mouseresizedisplay = document.createElement("div");
  editor.toplevel.appendChild(SC.EditorMouseInfo.mouseresizedisplay);
  expect(() => SC.ProcessEditorColsizeMouseUp(fakeEvent({ clientX: 130, clientY: 0 }))).not.toThrow();

  // Colsize with coltounhide.
  const resultU: any = { coltoresize: null, coltounhide: 3 };
  expect(() => SC.ProcessEditorColsizeMouseDown(ev, editor.fullgrid, resultU)).not.toThrow();
  expect(() => SC.ProcessEditorColsizeMouseUp(fakeEvent({ clientX: 130, clientY: 0 }))).not.toThrow();
});

test("ProcessEditorRowsize Down/Move/Up: full sequence", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "rsz-root");
  const editor = control.editor;
  primeGridLayout(editor);

  // Stub document event listener surface so SetMouseMoveUp/RemoveMouseMoveUp
  // don't throw before the rownum-resize branch fires.
  if (typeof (document as any).addEventListener !== "function") {
    (document as any).addEventListener = () => {};
    (document as any).removeEventListener = () => {};
  }

  // Patch spreadsheetDiv.firstChild.offsetHeight for the rowsize handlers.
  expect(() => {
    SC.GetSpreadsheetControlObject().spreadsheetDiv = {
      firstChild: { offsetHeight: 30 },
    };
  }).not.toThrow();

  SC.EditorMouseInfo.editor = editor;
  const result: any = { rowtoresize: 2, rowtounhide: null };
  const ev = fakeEvent({ clientX: 0, clientY: 100 });
  expect(() => SC.ProcessEditorRowsizeMouseDown(ev, editor.fullgrid, result)).not.toThrow();
  expect(() => SC.ProcessEditorRowsizeMouseMove(fakeEvent({ clientX: 0, clientY: 120 }))).not.toThrow();
  expect(() => SC.ProcessEditorRowsizeMouseUp(fakeEvent({ clientX: 0, clientY: 130 }))).not.toThrow();

  // rowtounhide branch.
  SC.EditorMouseInfo.editor = editor;
  const resultU: any = { rowtoresize: null, rowtounhide: 3 };
  expect(() => SC.ProcessEditorRowsizeMouseDown(ev, editor.fullgrid, resultU)).not.toThrow();
  expect(() => SC.ProcessEditorRowsizeMouseUp(fakeEvent({ clientX: 0, clientY: 130 }))).not.toThrow();
});

/**
 * Shim document.addEventListener/removeEventListener when the test-env's
 * `document` lacks them — SetMouseMoveUp/RemoveMouseMoveUp use them for
 * the capture phase and will throw without this stub. The drag-select
 * behavior tests below all need the stub.
 */
function ensureDocumentEvents() {
  if (typeof (document as any).addEventListener !== "function") {
    (document as any).addEventListener = () => {};
  }
  if (typeof (document as any).removeEventListener !== "function") {
    (document as any).removeEventListener = () => {};
  }
}

test("Rowselect drag: Down → Move → Up anchors row & extends across drag range", async () => {
  // Behavior test for drag-to-select on a row header. Unlike the coverage
  // test below (which just invokes the handlers for line hits), this one
  // asserts the range state after each transition.
  //
  // Scenario: mousedown on row 2 header → anchor at A2, extend to last col
  // of row 2 via sheet.LastCol(). Move to row 4 → extend span to row 4.
  // MouseUp → capture released (subsequent stray move events must NOT
  // extend further).
  const SC = await loadSocialCalc({ browser: true });
  ensureDocumentEvents();
  const { control } = await newControl(SC, "rcselect-behavior-root");
  const editor = control.editor;
  const sheet = control.sheet;
  primeGridLayout(editor);
  // Give the sheet a known extent so sheet.LastCol()/LastRow() return
  // deterministic values rather than depending on primeGridLayout.
  sheet.attribs.lastcol = 6;
  sheet.attribs.lastrow = 6;
  SC.EditorMouseInfo.editor = editor;

  // ── Rowselect Down on row 2 ──────────────────────────────────────
  SC.ProcessEditorRowselectMouseDown(fakeEvent({ clientX: 10, clientY: 60 }), editor.fullgrid, {
    row: 2,
  });
  expect(editor.range.hasrange).toBe(true);
  expect(editor.range.anchorrow).toBe(2);
  expect(editor.range.top).toBe(2);
  expect(editor.range.bottom).toBe(2);
  expect(editor.range.left).toBe(1);
  // Right edge of the selection = LastCol() of the sheet, not viewport.
  expect(editor.range.right).toBe(sheet.LastCol());

  // ── Rowselect Move down to row 4 (clientY lands in that row band) ──
  // primeGridLayout maps clientY=110 → row 4 (rowpositions[4]=90, next=110).
  SC.ProcessEditorRowselectMouseMove(fakeEvent({ clientX: 10, clientY: 105 }));
  expect(editor.range.top).toBe(2);
  expect(editor.range.bottom).toBe(4);
  expect(editor.range.anchorrow).toBe(2); // anchor stays put.

  // ── Rowselect Up releases the capture ─────────────────────────────
  SC.ProcessEditorRowselectMouseUp(fakeEvent({ clientX: 10, clientY: 105 }));
  // After Up, additional Move calls should be ignored (detached). The
  // handler's early-return guard checks `mouseinfo.editor`, so simulate
  // a stale move by flipping that and re-dispatching; range must not grow.
  const snapshotBefore = { ...editor.range };
  SC.EditorMouseInfo.editor = null;
  SC.ProcessEditorRowselectMouseMove(fakeEvent({ clientX: 10, clientY: 135 }));
  expect(editor.range.top).toBe(snapshotBefore.top);
  expect(editor.range.bottom).toBe(snapshotBefore.bottom);

  teardownEditor(SC, editor);
});

test("Colselect drag: Down → Move → Up anchors col & extends across drag range", async () => {
  const SC = await loadSocialCalc({ browser: true });
  ensureDocumentEvents();
  const { control } = await newControl(SC, "colselect-behavior-root");
  const editor = control.editor;
  const sheet = control.sheet;
  primeGridLayout(editor);
  sheet.attribs.lastcol = 6;
  sheet.attribs.lastrow = 6;
  SC.EditorMouseInfo.editor = editor;

  SC.ProcessEditorColselectMouseDown(fakeEvent({ clientX: 100, clientY: 10 }), editor.fullgrid, {
    col: 3,
  });
  expect(editor.range.hasrange).toBe(true);
  expect(editor.range.anchorcol).toBe(3);
  expect(editor.range.left).toBe(3);
  expect(editor.range.right).toBe(3);
  expect(editor.range.top).toBe(1);
  expect(editor.range.bottom).toBe(sheet.LastRow());

  // Move right: primeGridLayout has colpositions[5]=320 — land at 325.
  SC.ProcessEditorColselectMouseMove(fakeEvent({ clientX: 325, clientY: 10 }));
  expect(editor.range.left).toBe(3);
  expect(editor.range.right).toBe(5);
  expect(editor.range.anchorcol).toBe(3);

  SC.ProcessEditorColselectMouseUp(fakeEvent({ clientX: 325, clientY: 10 }));
  const snapshotBefore = { ...editor.range };
  SC.EditorMouseInfo.editor = null;
  SC.ProcessEditorColselectMouseMove(fakeEvent({ clientX: 400, clientY: 10 }));
  expect(editor.range.left).toBe(snapshotBefore.left);
  expect(editor.range.right).toBe(snapshotBefore.right);

  teardownEditor(SC, editor);
});

test("Rowselect drag: reverse-direction extend flips top/bottom around anchor", async () => {
  // Start on row 5, drag UP to row 2 — anchor stays on 5, top becomes 2,
  // bottom stays on 5. Verifies the RangeExtend direction logic.
  const SC = await loadSocialCalc({ browser: true });
  ensureDocumentEvents();
  const { control } = await newControl(SC, "rcselect-reverse-root");
  const editor = control.editor;
  const sheet = control.sheet;
  primeGridLayout(editor);
  sheet.attribs.lastcol = 6;
  sheet.attribs.lastrow = 6;
  SC.EditorMouseInfo.editor = editor;

  SC.ProcessEditorRowselectMouseDown(fakeEvent({ clientX: 10, clientY: 125 }), editor.fullgrid, {
    row: 5,
  });
  expect(editor.range.anchorrow).toBe(5);
  expect(editor.range.top).toBe(5);
  expect(editor.range.bottom).toBe(5);

  // Drag up to row 2 — clientY 65 lands in row 2 band (rowposition 50..70).
  SC.ProcessEditorRowselectMouseMove(fakeEvent({ clientX: 10, clientY: 65 }));
  expect(editor.range.top).toBe(2);
  expect(editor.range.bottom).toBe(5);
  expect(editor.range.anchorrow).toBe(5);

  SC.ProcessEditorRowselectMouseUp(fakeEvent({ clientX: 10, clientY: 65 }));
  teardownEditor(SC, editor);
});

test("ProcessEditorRowselect / Colselect Down/Move/Up", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "rcselect-root");
  const editor = control.editor;
  const sheet = control.sheet;
  primeGridLayout(editor);
  // SetMouseMoveUp (invoked by Down below) needs document.addEventListener,
  // which this test's fresh FakeDocument does not provide by default.
  ensureDocumentEvents();
  SC.EditorMouseInfo.editor = editor;

  // Rowselect: anchors row 2 and extends to sheet.LastCol() (this sheet has
  // no explicit lastcol, so LastCol()==firstscrollingcol==1 — see the
  // "Rowselect drag" behavior test above for a wider-sheet worked case).
  SC.ProcessEditorRowselectMouseDown(fakeEvent({ clientX: 10, clientY: 60 }), editor.fullgrid, {
    row: 2,
  });
  expect(editor.range.hasrange).toBe(true);
  expect(editor.range.anchorrow).toBe(2);
  expect(editor.range.right).toBe(sheet.LastCol());
  // clientY=100 maps to row 4 under primeGridLayout's rowpositions.
  SC.ProcessEditorRowselectMouseMove(fakeEvent({ clientX: 10, clientY: 100 }));
  expect(editor.range.bottom).toBe(4);
  expect(() => SC.ProcessEditorRowselectMouseUp(fakeEvent({ clientX: 10, clientY: 120 }))).not.toThrow();

  // Colselect: anchors col 3 and extends to sheet.LastRow() (==1 here).
  SC.EditorMouseInfo.editor = editor;
  SC.ProcessEditorColselectMouseDown(fakeEvent({ clientX: 100, clientY: 10 }), editor.fullgrid, {
    col: 3,
  });
  expect(editor.range.hasrange).toBe(true);
  expect(editor.range.anchorcol).toBe(3);
  expect(editor.range.bottom).toBe(sheet.LastRow());
  // clientX=200 still maps to col 3 under primeGridLayout's colpositions,
  // so the move is a no-op extension (range stays anchored at col 3).
  SC.ProcessEditorColselectMouseMove(fakeEvent({ clientX: 200, clientY: 10 }));
  expect(editor.range.left).toBe(3);
  expect(editor.range.right).toBe(3);
  expect(() => SC.ProcessEditorColselectMouseUp(fakeEvent({ clientX: 250, clientY: 10 }))).not.toThrow();

  // Without editor (early return): each handler's `if (!editor) return;`
  // guard means the range is left completely untouched.
  SC.EditorMouseInfo.editor = null;
  const rangeSnapshot = { ...editor.range };
  SC.ProcessEditorRowselectMouseMove(fakeEvent({}));
  SC.ProcessEditorRowselectMouseUp(fakeEvent({}));
  SC.ProcessEditorColselectMouseMove(fakeEvent({}));
  SC.ProcessEditorColselectMouseUp(fakeEvent({}));
  expect(editor.range).toEqual(rangeSnapshot);
});

test("SetDragAutoRepeat + DragAutoRepeat", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "dar-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.MoveECell("C3");

  // rowheader with small distance
  SC.SetDragAutoRepeat(editor, {
    rowheader: true,
    row: 2,
    col: 3,
    distance: 4,
  });
  // Switch row to trigger internal move.
  SC.SetDragAutoRepeat(editor, {
    rowheader: true,
    row: 3,
    col: 3,
    distance: 4,
  });
  // callback variant. Track calls so DragAutoRepeat's callback branch can
  // be asserted on directly (see below).
  const cbCalls: Array<[string, string]> = [];
  const cb = (coord: string, direction: string) => {
    cbCalls.push([coord, direction]);
  };
  SC.SetDragAutoRepeat(
    editor,
    {
      rowheader: true,
      row: 4,
      col: 3,
      distance: 8,
    },
    cb,
  );
  // colheader with callback
  SC.SetDragAutoRepeat(
    editor,
    {
      colheader: true,
      row: 4,
      col: 2,
      distance: 15,
    },
    cb,
  );
  SC.SetDragAutoRepeat(
    editor,
    {
      colheader: true,
      row: 4,
      col: 3,
      distance: 30,
    },
    cb,
  );
  // Distance large → cancel.
  SC.SetDragAutoRepeat(editor, {
    rowheader: true,
    row: 2,
    col: 2,
    distance: 999,
  });
  // Cancel.
  SC.SetDragAutoRepeat(editor, null);

  // Direct DragAutoRepeat call. With no repeatcallback, rowheader → "left"
  // moves the ecell one column left via MoveECellWithKey and (re)schedules
  // its own repeat timer.
  SC.AutoRepeatInfo.mouseinfo = { rowheader: true, col: 3, row: 3, distance: 4 };
  SC.AutoRepeatInfo.editor = editor;
  SC.AutoRepeatInfo.repeatcallback = null;
  SC.AutoRepeatInfo.repeatinterval = 100;
  const ecellColBefore = editor.ecell.col;
  SC.DragAutoRepeat();
  expect(editor.ecell.col).toBe(ecellColBefore - 1);
  expect(SC.AutoRepeatInfo.timer).toBeTruthy();
  // Cleanup the timer we just scheduled.
  if (SC.AutoRepeatInfo.timer) clearTimeout(SC.AutoRepeatInfo.timer);
  SC.AutoRepeatInfo.timer = null;
  SC.AutoRepeatInfo.mouseinfo = null;

  // DragAutoRepeat with callback: colheader → "up" invokes repeatcallback
  // with the row-decremented coord instead of moving the ecell directly.
  SC.AutoRepeatInfo.mouseinfo = { colheader: true, col: 3, row: 3, distance: 4 };
  SC.AutoRepeatInfo.editor = editor;
  SC.AutoRepeatInfo.repeatcallback = cb;
  SC.AutoRepeatInfo.repeatinterval = 100;
  const ecellCoordBefore = editor.ecell.coord;
  const cbCallsBefore = cbCalls.length;
  SC.DragAutoRepeat();
  expect(editor.ecell.coord).toBe(ecellCoordBefore);
  expect(cbCalls.length).toBe(cbCallsBefore + 1);
  expect(cbCalls[cbCalls.length - 1][1]).toBe("up");
  expect(SC.AutoRepeatInfo.timer).toBeTruthy();
  if (SC.AutoRepeatInfo.timer) clearTimeout(SC.AutoRepeatInfo.timer);
  SC.AutoRepeatInfo.timer = null;
  SC.AutoRepeatInfo.mouseinfo = null;
});

test("CellHandles: MouseMoveOnHandle / HoverTimeout / Down / Move / Up", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ch-root");
  const editor = control.editor;
  primeGridLayout(editor);
  // CellHandlesMouseDown (invoked below) calls SetMouseMoveUp, which needs
  // document.addEventListener — this test's fresh FakeDocument lacks it.
  ensureDocumentEvents();
  SC.KeyboardSetFocus(editor);

  // MoveOnHandle with no focus editor.
  const savedFocus = SC.Keyboard.focusTable;
  SC.Keyboard.focusTable = null;
  expect(() => SC.CellHandlesMouseMoveOnHandle(fakeEvent({}))).not.toThrow();
  SC.Keyboard.focusTable = savedFocus;

  // MoveOnHandle, target = dragpalette (covers SegmentDivHit branch).
  editor.cellhandles.dragpalette.offsetWidth = 90;
  editor.cellhandles.dragpalette.offsetHeight = 90;
  editor.cellhandles.dragpalette.offsetLeft = 10;
  editor.cellhandles.dragpalette.offsetTop = 10;
  expect(() =>
    SC.CellHandlesMouseMoveOnHandle(
      fakeEvent({ target: editor.cellhandles.dragpalette, clientX: 55, clientY: 55 }),
    ),
  ).not.toThrow();

  // MoveOnHandle, target=dragpalette, clientX/Y outside radius2 → whichhandle=0
  // → hits SocialCalc.CellHandlesHoverTimeout() + return inner branch.
  editor.cellhandles.dragpalette.offsetWidth = 10;
  editor.cellhandles.dragpalette.offsetHeight = 10;
  editor.cellhandles.dragpalette.offsetLeft = 0;
  editor.cellhandles.dragpalette.offsetTop = 0;
  expect(() =>
    SC.CellHandlesMouseMoveOnHandle(
      fakeEvent({ target: editor.cellhandles.dragpalette, clientX: 500, clientY: 500 }),
    ),
  ).not.toThrow();

  // HoverTimeout clears timer (set one first).
  editor.cellhandles.timer = setTimeout(() => {}, 1000);
  expect(() => SC.CellHandlesHoverTimeout()).not.toThrow();
  expect(editor.cellhandles.timer).toBeNull();

  // Down + Up when whichhandle is Fill (-3).
  editor.cellhandles.dragpalette.offsetWidth = 90;
  editor.cellhandles.dragpalette.offsetHeight = 90;
  // Match SegmentDivHit math for -3 (bottom-right inner quadrant).
  const dragDown = fakeEvent({
    target: editor.cellhandles.dragpalette,
    clientX: 60,
    clientY: 60,
  });
  expect(() => SC.CellHandlesMouseDown(dragDown)).not.toThrow();
  // Move across grid.
  expect(() => SC.CellHandlesMouseMove(fakeEvent({ clientX: 120, clientY: 80 }))).not.toThrow();
  // Up.
  expect(() => SC.CellHandlesMouseUp(fakeEvent({ clientX: 120, clientY: 80 }))).not.toThrow();

  // whichhandle=1 branch (Move quadrant center).
  expect(() =>
    SC.CellHandlesMouseDown(
      fakeEvent({
        target: editor.cellhandles.dragpalette,
        clientX: 55,
        clientY: 55,
      }),
    ),
  ).not.toThrow();

  // Editor busy short-circuit.
  editor.busy = true;
  expect(() => SC.CellHandlesMouseDown(dragDown)).not.toThrow();
  editor.busy = false;
});

test("SegmentDivHit: many quadrant sweeps", async () => {
  const SC = await loadSocialCalc({ browser: true });
  await newControl(SC, "seg-root");

  const div: any = { offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100 };
  // Type 2: radius segtable. For quadrant upper-left (x=25,y=25), the
  // distance from center (49.5,49.5) is ~34.6 → outside radius1=10, inside
  // radius2=40 → returns +1. Use generous radii to cover both inner
  // (-N) and outer (+N) quadrant branches.
  expect(SC.SegmentDivHit([45, 80], div, 45, 45)).toBe(-1);
  expect(SC.SegmentDivHit([45, 80], div, 55, 45)).toBe(-2);
  expect(SC.SegmentDivHit([45, 80], div, 55, 55)).toBe(-3);
  expect(SC.SegmentDivHit([45, 80], div, 45, 55)).toBe(-4);
  expect(SC.SegmentDivHit([10, 40], div, 25, 25)).toBe(1);
  expect(SC.SegmentDivHit([10, 40], div, 75, 25)).toBe(2);
  expect(SC.SegmentDivHit([10, 40], div, 75, 75)).toBe(3);
  expect(SC.SegmentDivHit([10, 40], div, 25, 75)).toBe(4);
  // No-hit (outside radius2).
  expect(SC.SegmentDivHit([10, 20], div, 25, 25)).toBe(0);

  // Type A: number leafs per quadrant.
  const table = [1, 2, 3, 4];
  expect(SC.SegmentDivHit(table, div, 25, 25)).toBe(1);
  expect(SC.SegmentDivHit(table, div, 75, 25)).toBe(2);
  expect(SC.SegmentDivHit(table, div, 75, 75)).toBe(3);
  expect(SC.SegmentDivHit(table, div, 25, 75)).toBe(4);
});

test("CellHandlesDragAutoRepeat: Fill/Move/MoveI direction branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "chdar-root");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("B2");
  editor.cellhandles.startingcoord = "B2";
  editor.cellhandles.dragtype = "Fill";
  editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };

  // Fill down direction.
  editor.cellhandles.filltype = "Down";
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "down")).not.toThrow();
  editor.cellhandles.filltype = null;
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "right")).not.toThrow();
  editor.cellhandles.filltype = "Right";
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "right")).not.toThrow();
  editor.cellhandles.dragtype = "Move";
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "up")).not.toThrow();
  editor.cellhandles.dragtype = "MoveI";
  editor.cellhandles.filltype = "Vertical";
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "left")).not.toThrow();
  editor.cellhandles.filltype = "Horizontal";
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "left")).not.toThrow();
  editor.cellhandles.filltype = null;
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "left")).not.toThrow();

  // With mouseinfo.editor = null early-return.
  SC.EditorMouseInfo.editor = null;
  expect(() => SC.CellHandlesDragAutoRepeat("C3", "down")).not.toThrow();
});

test("ShowCellHandles: show + moveshow variants", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "sh-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.MoveECell("B2");

  // show=true, moveshow=false
  SC.ShowCellHandles(editor.cellhandles, true, false);
  // show=true, moveshow=true
  SC.ShowCellHandles(editor.cellhandles, true, true);
  // show=false
  SC.ShowCellHandles(editor.cellhandles, false, false);
  // row beyond last visible
  editor.lastvisiblerow = 1;
  SC.ShowCellHandles(editor.cellhandles, true, false);
  editor.lastvisiblerow = 7;
  // editor.state != "start"
  editor.state = "input";
  SC.ShowCellHandles(editor.cellhandles, true, false);
  editor.state = "start";

  // Empty ecell / no editor path.
  SC.ShowCellHandles({ editor: null } as any);
  SC.ShowCellHandles({ editor: { ecell: null } } as any);
});

test("InputBox + InputEcho + InputBoxOnMouseDown + SetInputEchoText", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ibe-root");
  const editor = control.editor;

  // InputBox: null element early-return.
  new SC.InputBox(null, editor);

  // InputBox methods.
  editor.inputBox.SetText("=SU");
  editor.inputBox.Select("end");
  editor.inputBox.Focus();
  editor.inputBox.Blur();
  editor.inputBox.ShowInputBox(true);
  editor.inputBox.ShowInputBox(false);

  // InputBoxDisplayCellContents variants.
  SC.InputBoxDisplayCellContents(null, "A1");
  SC.InputBoxDisplayCellContents(editor.inputBox, "A1");
  SC.InputBoxDisplayCellContents(editor.inputBox, null);
  // Multi-line text path.
  await scheduleCommands(SC, editor.context.sheetobj, ["set Z1 text t line1\\nline2"]);
  SC.InputBoxDisplayCellContents(editor.inputBox, "Z1");
  // readonly path.
  await scheduleCommands(SC, editor.context.sheetobj, ["set Z2 text t x", "set Z2 readonly yes"]);
  editor.MoveECell("Z2");
  SC.InputBoxDisplayCellContents(editor.inputBox, "Z2");
  await scheduleCommands(SC, editor.context.sheetobj, ["set Z2 readonly no"]);

  // InputBoxFocus null argument.
  SC.InputBoxFocus(null);
  SC.InputBoxFocus(editor.inputBox);

  // InputBoxOnMouseDown in all states.
  SC.KeyboardSetFocus(editor);
  editor.state = "start";
  SC.InputBoxOnMouseDown(fakeEvent({}));
  editor.state = "input";
  SC.InputBoxOnMouseDown(fakeEvent({}));
  editor.state = "inputboxdirect";
  SC.InputBoxOnMouseDown(fakeEvent({}));
  editor.state = "start";
  // Without focusTable.
  const saved = SC.Keyboard.focusTable;
  SC.Keyboard.focusTable = null;
  SC.InputBoxOnMouseDown(fakeEvent({}));
  SC.Keyboard.focusTable = saved;

  // InputEcho methods.
  editor.inputEcho.ShowInputEcho(true);
  editor.inputEcho.SetText("=SUM(A1");
  editor.inputEcho.SetText("=XYZ(");
  editor.inputEcho.SetText("plain text");
  editor.inputEcho.ShowInputEcho(false);
  // Ensure heartbeat interval cleared (ShowInputEcho(false) clears it, but
  // belt & suspenders for any that might have leaked through):
  if (editor.inputEcho.interval) {
    clearInterval(editor.inputEcho.interval);
    editor.inputEcho.interval = null;
  }

  // ShowInputEcho without editor.
  SC.ShowInputEcho({ editor: null } as any, true);
  // InputEchoHeartbeat no-op when no focusTable.
  SC.Keyboard.focusTable = null;
  SC.InputEchoHeartbeat();
  SC.Keyboard.focusTable = editor;
  SC.InputEchoHeartbeat();
  // InputEchoMouseDown
  SC.Keyboard.focusTable = null;
  SC.InputEchoMouseDown(fakeEvent({}));
  SC.Keyboard.focusTable = editor;
  SC.InputEchoMouseDown(fakeEvent({}));

  // Clean up: abort any lingering input-echo heartbeat so its setInterval
  // does not fire against a stale editor in later tests.
  if (editor.inputEcho && editor.inputEcho.interval) {
    clearInterval(editor.inputEcho.interval);
    editor.inputEcho.interval = null;
  }
  editor.state = "start";
  SC.Keyboard.focusTable = null;
});

test("TableControl: CreateTableControl, PositionTableControlElements, ComputeTableControlPositions", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "tc-root");
  const editor = control.editor;
  primeGridLayout(editor);
  const v = editor.verticaltablecontrol;
  const h = editor.horizontaltablecontrol;
  // First compute then position.
  expect(() => v.ComputeTableControlPositions()).not.toThrow();
  expect(() => v.PositionTableControlElements()).not.toThrow();
  expect(() => h.ComputeTableControlPositions()).not.toThrow();
  expect(() => h.PositionTableControlElements()).not.toThrow();

  // ScrollAreaClick: busy & non-busy branches.
  const bobj: any = { functionobj: { control: v } };
  expect(() => SC.ScrollAreaClick({}, { clientX: 0, clientY: 200 }, bobj)).not.toThrow();
  editor.busy = true;
  expect(() => SC.ScrollAreaClick({}, { clientX: 0, clientY: 200 }, bobj)).not.toThrow();
  editor.busy = false;
});

test("TableControl Pan Slider: TCPS start/move/stop vertical + horizontal", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "tcps-root");
  const editor = control.editor;
  primeGridLayout(editor);

  const vctrl = editor.verticaltablecontrol;
  const hctrl = editor.horizontaltablecontrol;
  // Populate positions for Lookup.
  editor.rowpositions = [0, 30, 50, 70, 90, 110];
  editor.colpositions = [0, 30, 80, 130, 180, 230];
  editor.tableheight = editor.tableheight || 400;
  editor.tablewidth = editor.tablewidth || 600;
  editor.gridposition = { left: 0, top: 0 };
  editor.headposition = { left: 30, top: 30 };

  // dobj.element must have style so DragFunctionStart can parse.
  const velement: any = document.createElement("div");
  velement.style.top = "0px";
  velement.style.left = "0px";
  const helement: any = document.createElement("div");
  helement.style.top = "0px";
  helement.style.left = "0px";
  const dobj: any = { vertical: true, element: velement, functionobj: { control: vctrl } };
  const dobjH: any = { vertical: false, element: helement, functionobj: { control: hctrl } };
  const draginfo: any = {
    clientX: 100,
    clientY: 100,
    offsetX: 0,
    offsetY: 0,
  };
  expect(() => SC.TCPSDragFunctionStart({}, draginfo, dobj)).not.toThrow();
  expect(() => SC.TCPSDragFunctionMove({}, draginfo, dobj)).not.toThrow();
  expect(() => SC.TCPSDragFunctionStop({}, draginfo, dobj)).not.toThrow();
  expect(() => SC.TCPSDragFunctionStart({}, draginfo, dobjH)).not.toThrow();
  expect(() => SC.TCPSDragFunctionMove({}, draginfo, dobjH)).not.toThrow();
  expect(() => SC.TCPSDragFunctionStop({}, draginfo, dobjH)).not.toThrow();
});

test("TableControl Thumb: TCT start/move/stop vertical + horizontal", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "tct-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.gridposition = { left: 0, top: 0 };
  editor.headposition = { left: 30, top: 30 };
  editor.tableheight = editor.tableheight || 400;
  editor.tablewidth = editor.tablewidth || 600;

  const vctrl = editor.verticaltablecontrol;
  const hctrl = editor.horizontaltablecontrol;
  // Required control fields (may be set via compute):
  vctrl.controlborder = 400;
  vctrl.scrollareaend = 300;
  vctrl.scrollareastart = 100;
  vctrl.scrollareasize = 200;
  vctrl.thumbthickness = 20;
  hctrl.controlborder = 400;
  hctrl.scrollareaend = 300;
  hctrl.scrollareastart = 100;
  hctrl.scrollareasize = 200;
  hctrl.thumbthickness = 20;
  const velement: any = document.createElement("div");
  velement.style.top = "0px";
  velement.style.left = "0px";
  const helement: any = document.createElement("div");
  helement.style.top = "0px";
  helement.style.left = "0px";
  const dobj: any = { vertical: true, element: velement, functionobj: { control: vctrl } };
  const dobjH: any = { vertical: false, element: helement, functionobj: { control: hctrl } };
  const draginfo: any = {
    clientX: 200,
    clientY: 200,
    offsetX: 0,
    offsetY: 0,
  };

  expect(() => SC.TCTDragFunctionStart({}, draginfo, dobj)).not.toThrow();
  expect(() => SC.TCTDragFunctionRowSetStatus(draginfo, editor, 2)).not.toThrow();
  expect(() => SC.TCTDragFunctionMove({}, draginfo, dobj)).not.toThrow();
  expect(() => SC.TCTDragFunctionStop({}, draginfo, dobj)).not.toThrow();

  expect(() => SC.TCTDragFunctionStart({}, draginfo, dobjH)).not.toThrow();
  expect(() => SC.TCTDragFunctionMove({}, draginfo, dobjH)).not.toThrow();
  expect(() => SC.TCTDragFunctionStop({}, draginfo, dobjH)).not.toThrow();
});

test("DragRegister/Unregister and DragMouseDown/Move/Up", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "drg-root");
  const editor = control.editor;
  const el = document.createElement("div");
  editor.toplevel.appendChild(el);
  // DragMouseDown/Up (invoked below) call SetMouseMoveUp/RemoveMouseMoveUp,
  // which need document.addEventListener/removeEventListener — this test's
  // fresh FakeDocument does not provide them by default.
  ensureDocumentEvents();

  // Null functionobj → use defaults.
  SC.DragRegister(el, true, true, null, editor.toplevel);

  const ev = fakeEvent({ clientX: 10, clientY: 10, target: el });
  expect(() => SC.DragMouseDown(ev)).not.toThrow();
  const ev2 = fakeEvent({ clientX: 20, clientY: 20, target: el });
  expect(() => SC.DragMouseMove(ev2)).not.toThrow();
  expect(() => SC.DragMouseUp(ev2)).not.toThrow();
  // Disabled branch.
  const el2 = document.createElement("div");
  editor.toplevel.appendChild(el2);
  SC.DragRegister(
    el2,
    true,
    false,
    {
      MouseDown: SC.DragFunctionStart,
      MouseMove: SC.DragFunctionPosition,
      MouseUp: SC.DragFunctionPosition,
      Disabled: () => true,
    },
    editor.toplevel,
  );
  expect(() => SC.DragMouseDown(fakeEvent({ target: el2 }))).not.toThrow();
  // Unregister.
  SC.DragUnregister(el);
  SC.DragUnregister(el2);
  SC.DragUnregister(null);
  SC.DragUnregister(document.createElement("div")); // not in list
});

test("ButtonRegister/Over/Out/Down/Up/Repeat: exercise all flows", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "btn-root");
  const editor = control.editor;

  const btn = document.createElement("div");
  editor.toplevel.appendChild(btn);
  const fn: any = {
    MouseDown(_ev: any) {},
    MouseOver(_ev: any) {},
    MouseOut(_ev: any) {},
    MouseUp(_ev: any) {},
    Repeat(_ev: any) {},
  };
  SC.ButtonRegister(
    editor,
    btn,
    {
      name: "b1",
      normalstyle: "color:red",
      downstyle: "color:blue",
      hoverstyle: "color:green",
      repeatwait: 50,
      repeatinterval: 50,
    },
    fn,
  );
  const ev = fakeEvent({ clientX: 5, clientY: 5, target: btn });
  expect(() => SC.ButtonMouseOver(ev)).not.toThrow();
  // ButtonMouseDown calls SetMouseMoveUp, which needs document.addEventListener
  // — this test's fresh FakeDocument does not provide it by default.
  ensureDocumentEvents();
  expect(() => SC.ButtonMouseDown(ev)).not.toThrow();
  // Two hovers to exercise hover swap branch.
  const btn2 = document.createElement("div");
  editor.toplevel.appendChild(btn2);
  SC.ButtonRegister(
    editor,
    btn2,
    {
      name: "b2",
      normalstyle: "color:red",
      downstyle: "color:blue",
      hoverstyle: "color:green",
    },
    null,
  );
  expect(() => SC.ButtonMouseOver(fakeEvent({ target: btn2 }))).not.toThrow();
  expect(() => SC.ButtonMouseOut(fakeEvent({ target: btn2 }))).not.toThrow();
  expect(() => SC.ButtonRepeat()).not.toThrow();
  expect(() => SC.ButtonMouseUp(fakeEvent({ target: btn }))).not.toThrow();

  // Second ButtonMouseUp is a no-op (buttonDown=false).
  expect(() => SC.ButtonMouseUp(fakeEvent({ target: btn }))).not.toThrow();

  // Unknown target.
  expect(() => SC.ButtonMouseOver(fakeEvent({ target: document.createElement("div") }))).not.toThrow();
  expect(() => SC.ButtonMouseDown(fakeEvent({ target: document.createElement("div") }))).not.toThrow();
  expect(() => SC.ButtonMouseOut(fakeEvent({ target: document.createElement("div") }))).not.toThrow();

  // Null paramobj in ButtonRegister.
  const btn3 = document.createElement("div");
  editor.toplevel.appendChild(btn3);
  SC.ButtonRegister(editor, btn3, null, null);
});

test("MouseWheelRegister / ProcessMouseWheel", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "mwr-root");
  const editor = control.editor;
  const el = document.createElement("div");
  editor.toplevel.appendChild(el);
  SC.MouseWheelRegister(el, {
    WheelMove: (_e: any, _d: number) => {},
  });
  // With wheelDelta set and no wheelDelta.
  expect(() => SC.ProcessMouseWheel(fakeEvent({ target: el, wheelDelta: 120 }))).not.toThrow();
  expect(() => SC.ProcessMouseWheel(fakeEvent({ target: el, wheelDelta: 0, detail: 3 }))).not.toThrow();
  // passThru branch.
  SC.Keyboard.passThru = true;
  expect(() => SC.ProcessMouseWheel(fakeEvent({ target: el }))).not.toThrow();
  SC.Keyboard.passThru = null;
  // Not one of our elements.
  expect(() => SC.ProcessMouseWheel(fakeEvent({ target: document.createElement("div") }))).not.toThrow();
});

test("KeyboardSetFocus, ProcessKey, ProcessKeyDown, ProcessKeyPress", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "kb-root");
  const editor = control.editor;
  SC.KeyboardSetFocus(editor);
  expect(SC.Keyboard.focusTable).toBe(editor);

  // ProcessKey without focusTable.
  const saved = SC.Keyboard.focusTable;
  SC.Keyboard.focusTable = null;
  expect(SC.ProcessKey("x", {})).toBe(true);
  SC.Keyboard.focusTable = saved;

  // ProcessKey with focusTable.
  SC.ProcessKey("[aright]", fakeEvent({ shiftKey: false }));

  // ProcessKeyDown: IE branch (e.which undefined).
  const ieEv = { which: undefined, keyCode: 40, preventDefault() {}, returnValue: false };
  expect(() => SC.ProcessKeyDown(ieEv)).not.toThrow();
  // ctrl key path.
  const ieCtrl: any = {
    which: undefined,
    keyCode: 67,
    ctrlKey: true,
    preventDefault() {},
    returnValue: false,
  };
  expect(() => SC.ProcessKeyDown(ieCtrl)).not.toThrow();

  // Non-IE branch.
  expect(() =>
    SC.ProcessKeyDown({
      which: 1,
      keyCode: 40,
      charCode: 0,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();
  // Ctrl+C non-IE path.
  expect(() =>
    SC.ProcessKeyDown({
      which: 1,
      keyCode: 67,
      charCode: 0,
      ctrlKey: true,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();
  // PassThru early return.
  SC.Keyboard.passThru = true;
  expect(() => SC.ProcessKeyDown({ which: 1, keyCode: 65 })).not.toThrow();
  SC.Keyboard.passThru = null;

  // ProcessKeyPress: already processed path.
  SC.keyboardTables.didProcessKey = true;
  SC.keyboardTables.repeatingKeyPress = false;
  SC.keyboardTables.statusFromProcessKey = false;
  expect(() =>
    SC.ProcessKeyPress({
      which: 65,
      keyCode: 65,
      charCode: 65,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();
  // Already processed + repeatingKeyPress true.
  SC.keyboardTables.didProcessKey = true;
  SC.keyboardTables.repeatingKeyPress = true;
  SC.keyboardTables.chForProcessKey = "x";
  expect(() => SC.ProcessKeyPress({ which: 65, keyCode: 65, charCode: 65 })).not.toThrow();
  SC.keyboardTables.didProcessKey = false;
  SC.keyboardTables.repeatingKeyPress = false;

  // Fresh key: Firefox branch.
  expect(() =>
    SC.ProcessKeyPress({
      which: 65,
      charCode: 65,
      keyCode: 0,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();
  // Safari branch.
  expect(() =>
    SC.ProcessKeyPress({
      which: 65,
      charCode: 65,
      keyCode: 65,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();
  // Opera branch (charCode == undefined, which!=0).
  expect(() =>
    SC.ProcessKeyPress({
      which: 65,
      charCode: undefined,
      keyCode: 0,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();

  // IE branch (which undefined) in ProcessKeyPress.
  expect(() =>
    SC.ProcessKeyPress({
      which: undefined,
      keyCode: 65,
      charCode: 0,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();

  // which=0 in ProcessKeyPress.
  expect(() => SC.ProcessKeyPress({ which: 0, keyCode: 0 })).not.toThrow();

  // OLPC Fn key (keyCode==0, charCode==0).
  expect(() =>
    SC.ProcessKeyPress({
      which: 1,
      keyCode: 0,
      charCode: 0,
      preventDefault() {},
      returnValue: false,
    }),
  ).not.toThrow();

  // KeyboardFocus
  SC.KeyboardFocus();
});

test("Ctrl-A/C/V/X/Z/S flows via ctrlkeyFunction", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ctrl-root");
  const editor = control.editor;
  editor.MoveECell("A1");

  // Ctrl-A selects whole sheet.
  const rc = editor.ctrlkeyFunction(editor, "[ctrl-a]");
  expect(rc).toBe(false);
  editor.RangeRemove();

  // Ctrl-C / Ctrl-X: with range.
  editor.RangeAnchor("A1");
  editor.RangeExtend("B2");
  editor.ctrlkeyFunction(editor, "[ctrl-c]");
  editor.RangeRemove();
  editor.ctrlkeyFunction(editor, "[ctrl-c]"); // single cell
  editor.ctrlkeyFunction(editor, "[ctrl-x]");

  // Readonly makes Ctrl-X act as copy.
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 readonly yes"]);
  editor.ctrlkeyFunction(editor, "[ctrl-x]");
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 readonly no"]);

  // Ctrl-V (requires non-readonly).
  editor.ctrlkeyFunction(editor, "[ctrl-v]");

  // Ctrl-Z undo.
  editor.ctrlkeyFunction(editor, "[ctrl-z]");

  // Ctrl-S: depends on AllowCtrlS constant — exercise the flag.
  // The prompt call is inside a setTimeout callback, and the UMD factory
  // binds `window` = globalThis, so we must mock globalThis.prompt (not
  // globalThis.window.prompt) and capture the setTimeout callback to
  // invoke it synchronously while the mock is active.
  SC.Constants.AllowCtrlS = true;
  const savedPrompt = (globalThis as any).prompt;
  const origST = (globalThis as any).setTimeout;
  let captured: Function | null = null;
  const captureST = (fn: Function) => {
    captured = fn;
    return 0;
  };

  (globalThis as any).prompt = (_m: string, _d: string) => "General";
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  (globalThis as any).setTimeout = origST;
  if (captured) {
    expect(() => (captured as Function)()).not.toThrow();
  }

  (globalThis as any).prompt = (_m: string, _d: string) => "cmd:recalc";
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  (globalThis as any).setTimeout = origST;
  if (captured) {
    expect(() => (captured as Function)()).not.toThrow();
  }

  (globalThis as any).prompt = (_m: string, _d: string) => "edit:foo";
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  (globalThis as any).setTimeout = origST;
  if (captured) {
    expect(() => (captured as Function)()).not.toThrow();
  }

  (globalThis as any).prompt = (_m: string, _d: string) => null;
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  (globalThis as any).setTimeout = origST;
  if (captured) {
    expect(() => (captured as Function)()).not.toThrow();
  }

  (globalThis as any).prompt = savedPrompt;
  SC.Constants.AllowCtrlS = false;
  const rc2 = editor.ctrlkeyFunction(editor, "[ctrl-s]");
  expect(rc2 === true || rc2 === false).toBe(true);

  // Unknown key passes through.
  const rc3 = editor.ctrlkeyFunction(editor, "[ctrl-q]");
  expect(rc3).toBe(true);

});

test("ScrollTable helpers (Up/Down): direct and boundary cases", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "st2-root");
  const editor = control.editor;
  // Seed enough rows to scroll.
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set A5 value n 5",
    "set A10 value n 10",
  ]);
  // ScrollTableUpOneRow/DownOneRow increment/decrement the last rowpane's
  // first/last bounds by exactly one row.
  const pane = editor.context.rowpanes[editor.context.rowpanes.length - 1];
  const firstBefore = pane.first;
  const lastBefore = pane.last;
  SC.ScrollTableUpOneRow(editor);
  expect(pane.first).toBe(firstBefore + 1);
  expect(pane.last).toBe(lastBefore + 1);

  SC.ScrollTableDownOneRow(editor);
  expect(pane.first).toBe(firstBefore);
  expect(pane.last).toBe(lastBefore);

  // usermaxrow boundary: `usermaxrow - pane.first < 1` aborts before any
  // mutation, so the pane bounds stay exactly where they were.
  editor.context.sheetobj.attribs.usermaxrow = pane.first;
  SC.ScrollTableUpOneRow(editor);
  expect(pane.first).toBe(firstBefore);
  expect(pane.last).toBe(lastBefore);
  delete editor.context.sheetobj.attribs.usermaxrow;
});

test("ScrollRelativeBoth: hidden row/col skip branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "srb-root");
  const editor = control.editor;
  // Hide row 2 and column B.
  await scheduleCommands(SC, editor.context.sheetobj, ["set 2 hide yes", "set B hide yes"]);
  expect(() => editor.ScrollRelativeBoth(1, 1)).not.toThrow();
  expect(() => editor.ScrollRelativeBoth(-1, -1)).not.toThrow();
  await scheduleCommands(SC, editor.context.sheetobj, ["set 2 hide no", "set B hide no"]);
});

test("PageRelative: vertical + horizontal directions", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pr-root");
  const editor = control.editor;
  primeGridLayout(editor);
  expect(() => editor.PageRelative(true, 1)).not.toThrow();
  expect(() => editor.PageRelative(true, -1)).not.toThrow();
  expect(() => editor.PageRelative(false, 1)).not.toThrow();
  expect(() => editor.PageRelative(false, -1)).not.toThrow();
});

test("SaveEditorSettings / LoadEditorSettings round-trip with SettingsCallbacks", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ses-root");
  const editor = control.editor;
  editor.MoveECell("B2");
  editor.RangeAnchor("A1");
  editor.RangeExtend("C3");
  editor.SettingsCallbacks["custom"] = {
    save: (_e: any, name: string) => `${name}:hello\n`,
    load: (_e: any, name: string, line: string) => {
      expect(line.startsWith(name + ":")).toBe(true);
    },
  };
  const saved = editor.SaveEditorSettings();
  expect(saved).toContain("custom:hello");
  editor.LoadEditorSettings(saved);
  expect(editor.ecell.coord).toBe("B2");
  expect(editor.range.hasrange).toBe(true);

  // Unknown setting name (default branch).
  editor.LoadEditorSettings("version:1.0\nunknown:line\n");
  delete editor.SettingsCallbacks["custom"];
});

test("EnsureECellVisible: vertical/horizontal scroll amount branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "eev-root");
  const editor = control.editor;

  // Force positions to trigger scrolling.
  primeGridLayout(editor);
  editor.lastnonscrollingrow = 1;
  editor.firstscrollingrow = 3;
  editor.lastvisiblerow = 4;
  editor.ecell = { coord: "A2", row: 2, col: 1 };
  expect(() => SC.EnsureECellVisible(editor)).not.toThrow();

  editor.ecell = { coord: "A5", row: 5, col: 1 };
  expect(() => SC.EnsureECellVisible(editor)).not.toThrow();
  editor.ecell = { coord: "F5", row: 5, col: 6 };
  editor.lastnonscrollingcol = 1;
  editor.firstscrollingcol = 3;
  editor.lastvisiblecol = 4;
  expect(() => SC.EnsureECellVisible(editor)).not.toThrow();
});

test("MoveECell: covered by span + usermax bounds + hidden row handling", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "mc-root");
  const editor = control.editor;

  // usermax clamp.
  editor.context.sheetobj.attribs.usermaxcol = 3;
  editor.context.sheetobj.attribs.usermaxrow = 3;
  const c = editor.MoveECell("F10");
  expect(c).toBe("C3");
  delete editor.context.sheetobj.attribs.usermaxcol;
  delete editor.context.sheetobj.attribs.usermaxrow;

  // Cover span via cellskip.
  editor.context.cellskip["D4"] = "C3";
  editor.MoveECell("D4");
  delete editor.context.cellskip["D4"];

  // range2 covers ecell → update highlight.
  editor.range2 = { hasrange: true, top: 1, bottom: 5, left: 1, right: 5 };
  editor.MoveECell("A1");
  editor.MoveECell("B2");
  editor.range2 = { hasrange: false };

  // busy→ensureecell
  editor.busy = true;
  editor.MoveECell("C3");
  editor.busy = false;
});

test("MoveECellWithKey: [home], hidden col delta flip, usermax clamp", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "mek-root");
  const editor = control.editor;

  // Ensure non-null ecell.
  editor.MoveECell("B2");
  editor.MoveECellWithKey("[home]");
  expect(editor.ecell.coord).toBe("A1");

  // Null ecell guard.
  const prev = editor.ecell;
  editor.ecell = null;
  const r = editor.MoveECellWithKey("[adown]");
  expect(r).toBe(null);
  editor.ecell = prev;

  // Unrecognized returns null.
  expect(editor.MoveECellWithKey("[xyz]")).toBe(null);

  // Pgup / pgdn.
  editor.MoveECell("C3");
  editor.MoveECellWithKey("[pgdn]");
  editor.MoveECellWithKey("[pgup]");

  // Hidden column delta flip.
  await scheduleCommands(SC, editor.context.sheetobj, ["set A hide yes"]);
  editor.MoveECell("B3");
  editor.MoveECellWithKey("[aleft]");
  await scheduleCommands(SC, editor.context.sheetobj, ["set A hide no"]);

  // Usermax clamp path.
  editor.context.sheetobj.attribs.usermaxcol = 2;
  editor.MoveECell("B2");
  editor.MoveECellWithKey("[aright]");
  delete editor.context.sheetobj.attribs.usermaxcol;
});

test("RangeAnchor reuse + Range2Remove", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "rr-root");
  const editor = control.editor;

  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("C3");
  // Calling RangeAnchor while hasrange removes first then re-anchors.
  editor.RangeAnchor("B2");
  editor.RangeExtend("D4");

  // Range2: set via handles logic, then remove.
  editor.range2 = { hasrange: true, top: 1, bottom: 2, left: 1, right: 2 };
  editor.Range2Remove();
  expect(editor.range2.hasrange).toBe(false);

  // Range2Remove when not set.
  editor.Range2Remove();
});

test("EditorScheduleSheetCommands: busy, deferred, recalc/undo/redo/setemail, default", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "sch-root");
  const editor = control.editor;

  // Ignore when state!=start.
  editor.state = "input";
  editor.EditorScheduleSheetCommands("set A1 text hi");
  editor.state = "start";

  // Busy buffering.
  editor.busy = true;
  editor.EditorScheduleSheetCommands("set A1 text x", true, false);
  expect(editor.deferredCommands.length).toBeGreaterThan(0);
  editor.busy = false;
  editor.deferredCommands = [];

  // recalc path.
  editor.EditorScheduleSheetCommands("recalc");

  // setemailparameters path (TriggerIoAction stub needed). Restore at
  // the end of the test — loadSocialCalc shares one SC instance across
  // the whole run, so a permanent stub would leak into later test files
  // (iofunctions-coverage relies on the real Email body).
  (SC as any).TriggerIoAction = (SC as any).TriggerIoAction || {};
  const origEmail = (SC as any).TriggerIoAction.Email;
  (SC as any).TriggerIoAction.Email = () => {};
  try {
    expect(() => editor.EditorScheduleSheetCommands("setemailparameters X Y")).not.toThrow();

    // Undo / Redo.
    editor.EditorScheduleSheetCommands("undo");
    editor.EditorScheduleSheetCommands("redo");

    // default (generic set). Force-clear busy/deferred state first (same
    // isolation technique as the "Busy buffering" section above) so this
    // exercises the default branch directly. Note: replaying a deferred
    // "setemailparameters" entry never fires a status callback (see
    // TableEditorSC.EditorScheduleSheetCommands), so without this reset any
    // commands queued behind the setemailparameters/undo/redo calls above
    // would never drain and editor.busy would stay stuck true permanently.
    editor.busy = false;
    editor.deferredCommands = [];
    const pDefault = waitEditor(editor);
    editor.EditorScheduleSheetCommands("set B1 text t y", true);
    await pDefault;
    expect(editor.context.sheetobj.cells["B1"]?.datavalue).toBe("y");
  } finally {
    (SC as any).TriggerIoAction.Email = origEmail;
  }
});

test("EditorRenderSheet: reRenderCellList + widget paths", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "er-root");
  const editor = control.editor;

  // Seed a real cell via schedule so it has datavalue/displayvalue set.
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 text t hello"]);

  // Flip the app guard on temporarily.
  const sav = SC._app;
  (SC as any)._app = true;
  editor.context.sheetobj.widgetsClean = true;
  editor.context.sheetobj.reRenderCellList = ["A1"];
  // Ensure cell has a valid valuetype & displayvalue.
  const a1 = editor.context.sheetobj.cells["A1"];
  a1.valuetype = a1.valuetype || "tw";
  a1.prevvaluetype = a1.valuetype;
  // EditorRenderSheet consumes reRenderCellList (drains it after rendering).
  SC.EditorRenderSheet(editor);
  expect(editor.context.sheetobj.reRenderCellList).toEqual([]);
  // widgetsClean = false path
  editor.context.sheetobj.widgetsClean = false;
  editor.context.sheetobj.reRenderCellList = ["A1"];
  SC.EditorRenderSheet(editor);
  expect(editor.context.sheetobj.reRenderCellList).toEqual([]);
  (SC as any)._app = sav;

  // Default rendering via MoveECell just to check the ecell setheaders path.
  editor.MoveECell("B2");
  SC.EditorRenderSheet(editor);
});

test("CalculateRowPositions/CalculateColPositions: skip when no RCHeaders", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "cp-root");
  const editor = control.editor;
  const positions: any[] = [];
  const sizes: any[] = [];
  // With showRCHeaders=false, early return.
  editor.context.showRCHeaders = false;
  SC.CalculateRowPositions(editor, 0, positions, sizes);
  SC.CalculateColPositions(editor, 0, positions, sizes);
  editor.context.showRCHeaders = true;
  // With headers true, row positions/sizes get populated by rendered-row index.
  const posLenBeforeRows = positions.length;
  SC.CalculateRowPositions(editor, 0, positions, sizes);
  expect(positions.length).toBeGreaterThan(posLenBeforeRows);
  expect(sizes.length).toBe(positions.length);
  // Column positions share the same `positions`/`sizes` arrays keyed by
  // column number; since the row pass above already claimed the low
  // indices this pane's columns fall in, `if (!positions[colnum])` means
  // the column pass is a no-op here — it must not throw either way.
  const posLenBeforeCols = positions.length;
  SC.CalculateColPositions(editor, 0, positions, sizes);
  expect(positions.length).toBeGreaterThanOrEqual(posLenBeforeCols);
});

test("ReplaceCell: null cell + render + css updating", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "rc-root");
  const editor = control.editor;
  // Null cell early return.
  SC.ReplaceCell(editor, null, 1, 1);
  SC.UpdateCellCSS(editor, null, 1, 1);
  // Non-null with ecell A1.
  const info = SC.GetEditorCellElement(editor, 1, 1);
  if (info?.element) {
    // The function expects an object { element, rowpane, colpane }.
    SC.ReplaceCell(editor, info, 1, 1);
    SC.UpdateCellCSS(editor, info, 1, 1);
  }
});

test("SetECellHeaders: hidden row/col, classnames, early return, no ecell", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "sech-root");
  const editor = control.editor;
  // showRCHeaders=false → early return.
  editor.context.showRCHeaders = false;
  SC.SetECellHeaders(editor, "selected");
  editor.context.showRCHeaders = true;
  // no ecell → early return.
  const e = editor.ecell;
  editor.ecell = null;
  SC.SetECellHeaders(editor, "selected");
  editor.ecell = e;
  // Hidden ecell column/row → advances.
  await scheduleCommands(SC, editor.context.sheetobj, ["set A hide yes"]);
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.SetECellHeaders(editor, "selected");
  await scheduleCommands(SC, editor.context.sheetobj, ["set A hide no"]);
});

test("GetEditorCellElement: beyond pane, with colspan skipping", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ge-root");
  const editor = control.editor;

  // Rows outside pane → returns null.
  expect(SC.GetEditorCellElement(editor, 500, 5)).toBe(null);

  // showRCHeaders false path.
  editor.context.showRCHeaders = false;
  SC.GetEditorCellElement(editor, 1, 1);
  editor.context.showRCHeaders = true;

  // A regular in-pane cell (just to exercise the normal return path).
  const e = SC.GetEditorCellElement(editor, 2, 3);
  expect(e !== undefined).toBe(true);
});

test("FitToEditTable: hidden first row + loops", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ft-root");
  const editor = control.editor;
  // Hide rows 1 and 2, then call FitToEditTable.
  await scheduleCommands(SC, editor.context.sheetobj, ["set 1 hide yes", "set 2 hide yes"]);
  expect(() => SC.FitToEditTable(editor)).not.toThrow();
  await scheduleCommands(SC, editor.context.sheetobj, ["set 1 hide no", "set 2 hide no"]);
});

test("ShowCellHandles with hidden adjacent col/row skips via while loop (12035-12041)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "sch-root");
  const editor = control.editor;
  primeGridLayout(editor);
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set B hide yes",
    "set 2 hide yes",
  ]);
  editor.MoveECell("A1");
  // The while loops skip past the hidden column B / row 2, landing the
  // drag handle at colpositions[3]-1 / rowpositions[3]-1 under
  // primeGridLayout's fixed grid.
  editor.cellhandles.ShowCellHandles(true);
  expect(editor.cellhandles.draghandle.style.left).toBe("159px");
  expect(editor.cellhandles.draghandle.style.top).toBe("69px");
});

test("GridMousePosition: rowunhidetop / colunhideleft/right hit unhide (10283-10334)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "gmp-root");
  const editor = control.editor;
  primeGridLayout(editor);
  // Force the positions so clientX=80/clientY=10 lands inside the col-
  // header band and clientX=10/clientY=60 in the row-header band.
  editor.gridposition = { left: 0, top: 0 };
  editor.headposition = { left: 30, top: 30 };
  const unhideRow: any = {
    offsetLeft: 0,
    offsetTop: 50,
    offsetWidth: 30,
    offsetHeight: 30,
    offsetParent: null,
    style: { position: "" },
  };
  const unhideCol: any = {
    offsetLeft: 70,
    offsetTop: 0,
    offsetWidth: 50,
    offsetHeight: 30,
    offsetParent: null,
    style: { position: "" },
  };
  editor.context.rowunhidetop = { 3: unhideRow };
  editor.context.rowunhidebottom = { 3: unhideRow };
  editor.context.colunhideleft = { 2: unhideCol };
  editor.context.colunhideright = { 2: unhideCol };
  // Row header hit at (10,60): row 2 doesn't match the seeded unhide row
  // (keyed at row 3), so this lands on the plain row-select branch instead.
  const rRow = SC.GridMousePosition(editor, 10, 60);
  expect(rRow.rowheader).toBe(true);
  expect(rRow.rowselect).toBe(true);
  // Col header hit at (80,10): col 2 matches colunhideleft/right, so
  // coltounhide gets set.
  const rCol = SC.GridMousePosition(editor, 80, 10);
  expect(rCol.colheader).toBe(true);
  expect(rCol.coltounhide).toBe(1);
  // Push gridposition beyond clientX/clientY to hit the later-else branches.
  editor.gridposition = { left: 100, top: 100 };
  editor.headposition = { left: 150, top: 150 };
  const rElse1 = SC.GridMousePosition(editor, 50, 150);
  expect(rElse1.row).toBe(7);
  expect(rElse1.col).toBe(2);
  const rElse2 = SC.GridMousePosition(editor, 150, 50);
  expect(rElse2.row).toBe(2);
  expect(rElse2.col).toBe(2);

  // cellskip branch: click a cell within a merged range → cellskip redirects.
  editor.gridposition = { left: 0, top: 0 };
  editor.headposition = { left: 10, top: 10 }; // tiny so 20,70 lands on grid
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 value n 1", "merge A1:A3"]);
  editor.context.CalculateCellSkipData();
  // A1 is at (1,1), A2 at (1,2), A3 at (1,3).
  // With colpositions=[0,0,80,...], col=1 when 0<=clientX<30.
  // With rowpositions=[0,0,50,70,90,...], row=3 when 70<=clientY<90.
  // The merged range redirects the cellskip hit at A3 back to A1.
  const rSkip = SC.GridMousePosition(editor, 20, 70);
  expect(rSkip.row).toBe(3);
  expect(rSkip.col).toBe(1);
  expect(rSkip.coord).toBe("A1");
});

test("MoveECellWithKey[ahome] on a sheet with first rows all hidden (10503-10508)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "mecwk-root");
  const editor = control.editor;
  // Hide rows 1 and 2 so moving to home (row=1) has to bounce back.
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set 1 hide yes",
    "set 2 hide yes",
  ]);
  editor.MoveECell("A3");
  // Rows 1-2 are hidden, so [home] (which targets A1) bounces to the first
  // visible row instead — row 3, i.e. no visible movement from A3.
  expect(editor.MoveECellWithKey("[home]")).toBe("A3");
  expect(editor.ecell.coord).toBe("A3");
  // [aup] with row=1 hidden and delta=-1: row-- → 0, row<1 → row=1, delta=1
  editor.MoveECell("A2");
  expect(editor.MoveECellWithKey("[aup]")).toBe("A3");
  expect(editor.ecell.coord).toBe("A3");
});

test("ScrollTableUpOneRow / DownOneRow with 2 row panes (11463-11464, 11463 row loop)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "stup-root");
  const editor = control.editor;
  editor.context.rowpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 8 },
  ];
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set A4 value n 4",
    "set A8 value n 8",
  ]);
  const pane = editor.context.rowpanes[editor.context.rowpanes.length - 1];
  const firstBefore = pane.first;
  const lastBefore = pane.last;
  SC.ScrollTableUpOneRow(editor);
  expect(pane.first).toBe(firstBefore + 1);
  expect(pane.last).toBe(lastBefore + 1);
  SC.ScrollTableDownOneRow(editor);
  expect(pane.first).toBe(firstBefore);
  expect(pane.last).toBe(lastBefore);
});

test("ScrollTableUpOneRow with a rowspan cell straddling pane boundary", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "stus-root");
  const editor = control.editor;
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set A3 value n 3",
    "set A15 value n 15",
  ]);
  // Span A3 over A3..A7 so after scroll (first=2,last=7) bottomrownum=7 is
  // a cellskip pointing at A3 (rownum=3), which is in [first=2, last=7] →
  // hits 11515-11519 and 11523-11526.
  const a3 = editor.context.sheetobj.cells["A3"];
  if (a3) a3.rowspan = 5;
  editor.context.rowpanes = [{ first: 1, last: 6 }];
  editor.context.colpanes = [{ first: 1, last: 3 }];
  editor.context.CalculateCellSkipData();
  editor.context.RenderSheet(null, editor.context.defaultHTMLlinkstyle);
  expect(editor.fullgrid.lastChild.childNodes.length).toBeGreaterThan(0);
  // ScrollTableUpOneRow always increments `first`; `last` gets recalculated
  // by the internal FitToEditTable() call rather than simply +1 once the
  // rowspan-straddling row is scrolled off, so only assert the invariant
  // that first advances and the pane stays well-formed.
  const pane = editor.context.rowpanes[editor.context.rowpanes.length - 1];
  const firstBefore = pane.first;
  SC.ScrollTableUpOneRow(editor);
  expect(pane.first).toBe(firstBefore + 1);
  expect(pane.last).toBeGreaterThanOrEqual(pane.first);
});
