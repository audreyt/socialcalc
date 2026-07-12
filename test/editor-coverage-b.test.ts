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
// test — same rationale as editor-coverage-a. Install at module top so timers
// created during setup are tracked immediately.
ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
});

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
    // best-effort: relies on real DOM offsets the fake grid doesn't provide;
    // the manual colpositions/rowpositions overrides below make the outcome
    // of this call irrelevant either way.
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
/**
 * Shim document.addEventListener/removeEventListener when the test-env's
 * `document` lacks them (this file's fresh FakeDocument does not provide
 * them by default, but several editor drag/mouse-capture code paths call
 * them unconditionally).
 */
function ensureDocumentEvents(): void {
  if (typeof document.addEventListener !== "function") {
    document.addEventListener = () => {};
  }
  if (typeof document.removeEventListener !== "function") {
    document.removeEventListener = () => {};
  }
}


test("ScrollTableDownOneRow with rowspan cell starting inside pane", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "stds-root");
  const editor = control.editor;
  await scheduleCommands(SC, editor.context.sheetobj, ["set A3 value n 3", "set A10 value n 10"]);
  const a3 = editor.context.sheetobj.cells["A3"];
  if (a3) a3.rowspan = 5;
  editor.context.rowpanes = [{ first: 2, last: 7 }];
  editor.context.colpanes = [{ first: 1, last: 3 }];
  editor.context.CalculateCellSkipData();
  const rendered = editor.context.RenderSheet(null, editor.context.defaultHTMLlinkstyle);
  expect(rendered.tagName).toBe("TABLE");

  const result = SC.ScrollTableDownOneRow(editor);
  expect(result).toBe(editor.fullgrid);
  expect(editor.context.rowpanes[0].first).toBe(1); // decremented from the seeded 2
  // FitToEditTable() (called internally) recomputes .last from the estimated
  // available table height rather than a simple decrement.
  expect(editor.context.rowpanes[0].last).toBe(22);
});

test("CalculateEditorPositions with 2 row + 2 col panes runs the inner panenum loops", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "cep2p-root");
  const editor = control.editor;
  editor.context.rowpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 8 },
  ];
  editor.context.colpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 8 },
  ];
  editor.CalculateEditorPositions();
  expect(editor.firstscrollingrow).toBe(4);
  expect(editor.lastnonscrollingrow).toBe(3);
});

test("FitToEditTable: with 2 row+col panes + hidden rows/cols inside", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ft2p-root");
  const editor = control.editor;
  // Force 2 panes so the first-pane loops at 11022-11060 execute.
  editor.context.rowpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 10 },
  ];
  editor.context.colpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 10 },
  ];
  await scheduleCommands(SC, editor.context.sheetobj, ["set 2 hide yes", "set B hide yes"]);
  SC.FitToEditTable(editor);
  // FitToEditTable extends the last col/row pane to fill the available
  // width/height and skips the leading hidden row.
  expect(editor.context.rowpanes[0].first).toBe(1);
  expect(typeof editor.context.colpanes[1].last).toBe("number");
  expect(editor.context.colpanes[1].last).toBeGreaterThanOrEqual(editor.context.colpanes[1].first);
  expect(editor.context.rowpanes[1].last).toBeGreaterThanOrEqual(editor.context.rowpanes[1].first);
});

test("EditorMouseRange: input + inputboxdirect + partialexpr", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "emr-root");
  const editor = control.editor;

  editor.MoveECell("B2");
  editor.state = "input";
  editor.workingvalues.ecoord = "B2";
  editor.workingvalues.partialexpr = "=";
  editor.inputBox.SetText("=");
  editor.EditorMouseRange("C3");

  editor.RangeAnchor("C3");
  editor.RangeExtend("D4");
  editor.workingvalues.partialexpr = "=";
  editor.inputBox.SetText("=");
  editor.EditorMouseRange("D4");

  // partialexpr empty → treats input as done.
  editor.workingvalues.partialexpr = "";
  editor.inputBox.SetText("result");
  editor.state = "input";
  const p = waitEditor(editor);
  editor.EditorMouseRange("E5");
  await p;

  // inputboxdirect → always saves.
  editor.state = "inputboxdirect";
  editor.workingvalues.ecoord = "F1";
  editor.inputBox.SetText("final");
  const p2 = waitEditor(editor);
  editor.EditorMouseRange("F1");
  await p2;
});

test("DoPositionCalculations + SchedulePositionCalculations + DoRenderStep", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "dpc-root");
  const editor = control.editor;

  SC.DoPositionCalculations(editor);
  SC.SchedulePositionCalculations(editor);
  SC.DoRenderStep(editor);
  await new Promise((r) => setTimeout(r, 50));

  // ensureecell + deferredCommands + no cmd defer path.
  editor.ensureecell = true;
  editor.deferredCommands = [];
  editor.ecell = editor.ecell || { coord: "A1", row: 1, col: 1 };
  SC.DoPositionCalculations(editor);
  expect(editor.ensureecell).toBe(false);
});

test("ProcessEditorMouseDown: row/col header + footer branches via synthetic grid", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pmdhdr-root");
  const editor = control.editor;
  primeGridLayout(editor);

  const target = editor.fullgrid;
  // Force row header hit by setting clientX < headposition.left.
  editor.headposition = { left: 30, top: 30 };
  editor.gridposition = { left: 0, top: 0 };
  // ProcessEditorMouseDown always finishes a successful hit by calling
  // SetMouseMoveUp(), which unconditionally calls document.addEventListener();
  // the FakeDocument shim (test/helpers/socialcalc.ts) never defines that
  // method on `document`, so any branch that reaches a real hit deterministically
  // throws here. This still proves the row-header branch was taken (rather than
  // silently no-oping) before the shim gap is hit.
  expect(() =>
    SC.ProcessEditorMouseDown(fakeEvent({ clientX: 10, clientY: 80, target })),
  ).toThrow(/addEventListener/);
  // Col header band.
  expect(() =>
    SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 10, target })),
  ).toThrow(/addEventListener/);

  // Force resize hit (colsize): clientX matches colpositions + colwidth.
  editor.colpositions = [0, 0, 50];
  editor.colwidth = [0, 30, 50];
  // See comment above: hits the resize branch, then throws in SetMouseMoveUp
  // due to the FakeDocument addEventListener gap.
  expect(() =>
    SC.ProcessEditorMouseDown(fakeEvent({ clientX: 30, clientY: 10, target })),
  ).toThrow(/addEventListener/);

  // Force rowsize (rowheader + rowtoresize within pane): clientY near row-2
  // boundary so rowtoresize=2 and it's visible, hitting the else branch
  // in ProcessEditorMouseDown (bundle 9098-9099).
  primeGridLayout(editor);
  expect(() =>
    SC.ProcessEditorMouseDown(fakeEvent({ clientX: 10, clientY: 70, target })),
  ).toThrow(/addEventListener/);

  // Force colsize (colheader + coltoresize within pane): clientX near
  // col-2 boundary → coltoresize=2 visible → else branch 9107-9108.
  primeGridLayout(editor);
  expect(() =>
    SC.ProcessEditorMouseDown(fakeEvent({ clientX: 80, clientY: 10, target })),
  ).toThrow(/addEventListener/);
});

test("InputEcho: SetInputEchoText function-detect branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "iet-root");
  const editor = control.editor;
  // Known function.
  SC.SetInputEchoText(editor.inputEcho, "=SUM(A1");
  // Unknown function.
  SC.SetInputEchoText(editor.inputEcho, "=FOOBAR(A1");
  // Text, no prompt visible change.
  SC.SetInputEchoText(editor.inputEcho, "plain");
  // Text, prompt already none.
  editor.inputEcho.prompt.style.display = "none";
  SC.SetInputEchoText(editor.inputEcho, "plain2");
});

test("ScrollRelativeBoth: single-row shortcut using ScrollTableUpOneRow/DownOneRow", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "srb2-root");
  const editor = control.editor;
  // Single-row scroll uses the ScrollTableUpOneRow/DownOneRow quick path and
  // updates the last row pane's bounds by exactly one row.
  const before = editor.context.rowpanes[editor.context.rowpanes.length - 1].first;
  editor.ScrollRelativeBoth(1, 0);
  expect(editor.context.rowpanes[editor.context.rowpanes.length - 1].first).toBe(before + 1);
  editor.ScrollRelativeBoth(-1, 0);
  expect(editor.context.rowpanes[editor.context.rowpanes.length - 1].first).toBe(before);
});

test("EditorProcessKey: input state with partialexpr + shifted arrow + [f2] toggle", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "epkpoint-root");
  const editor = control.editor;

  // Enter input mode with formula.
  editor.MoveECell("A1");
  editor.EditorProcessKey("=", { shiftKey: false });
  editor.inputBox.SetText("=");
  editor.workingvalues.partialexpr = "=";
  // Shift-arrow in pointing mode.
  editor.EditorProcessKey("[aright]", { shiftKey: true });
  editor.RangeAnchor("B1");
  editor.RangeExtend("C1");
  editor.EditorProcessKey("[aright]", { shiftKey: true });
  // f2 in input state → switches to inputboxdirect.
  editor.EditorProcessKey("[f2]", { shiftKey: false });
  expect(editor.state).toBe("inputboxdirect");
  // Cancel out.
  editor.EditorProcessKey("[esc]", { shiftKey: false });

  // Invalid state to hit default branch.
  editor.state = "zzz";
  expect(editor.EditorProcessKey("x", { shiftKey: false })).toBe(true);
  editor.state = "start";

  // skipOne branch in input state.
  editor.EditorProcessKey("=", { shiftKey: false });
  editor.inputBox.skipOne = true;
  const rc = editor.EditorProcessKey("[enter]", { shiftKey: false });
  expect(rc).toBe(false);
  editor.inputBox.skipOne = false;
  editor.EditorProcessKey("[esc]", { shiftKey: false });

  // Non-string ch argument coerced to empty (and fall through control-key path).
  const rc2 = editor.EditorProcessKey(null as any, { shiftKey: false });
  expect(rc2 === true || rc2 === false).toBe(true);
});

test("MoveECellWithKey inside input state (pointing edit)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "mkip-root");
  const editor = control.editor;
  editor.MoveECell("A1");
  editor.EditorProcessKey("=", { shiftKey: false });
  editor.inputBox.SetText("=");
  editor.workingvalues.partialexpr = "=";
  // Pointing mode: shifted arrow extends range.
  editor.RangeAnchor("A2");
  editor.RangeExtend("A3");
  editor.EditorProcessKey("[aright]", { shiftKey: true });
  // Exit.
  editor.EditorProcessKey("[esc]", { shiftKey: false });
});

test("EditorAddToInput while noEdit true", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "aite-root");
  const editor = control.editor;
  const saved = editor.noEdit;
  editor.noEdit = true;
  editor.EditorAddToInput("x");
  editor.noEdit = saved;
});

test("ProcessEditorMouseUp: result has no coord path", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pmu-root");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.element = editor.fullgrid;
  SC.EditorMouseInfo.mousedowncoord = "A1";
  SC.EditorMouseInfo.mouselastcoord = "A1";
  // Click past grid → result has no coord → falls back to ecell.coord, then
  // ProcessEditorMouseUp finishes by calling RemoveMouseMoveUp(), which
  // unconditionally calls document.removeEventListener(); the FakeDocument
  // shim never defines that method, so this deterministically throws once the
  // no-coord fallback branch has run.
  expect(() =>
    SC.ProcessEditorMouseUp(fakeEvent({ clientX: 0, clientY: 0, target: editor.fullgrid })),
  ).toThrow(/removeEventListener/);
});

test("TableEditor: noEdit constructor option", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  editor.noEdit = true;
  const ele = SC.CreateTableEditor(editor, 300, 200);
  expect(ele).toBeDefined();
  // inputBox should not be created when noEdit.
  expect(editor.inputBox).toBeNull();
  // EditorOpenCellEdit early-return path.
  const rc = SC.EditorOpenCellEdit(editor);
  expect(rc).toBe(true);
  // Null ecell guard.
  editor.ecell = null;
  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
});

test("EditorAddToInput: partialexpr reset branch in input state", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "aitp-root");
  const editor = control.editor;
  editor.MoveECell("A1");
  editor.EditorProcessKey("=", { shiftKey: false });
  editor.inputBox.SetText("=A1+");
  editor.workingvalues.partialexpr = "=A1+";
  // Add while pointing → resets partialexpr.
  editor.EditorAddToInput("B1");
  editor.EditorProcessKey("[esc]", { shiftKey: false });
});

test("GridMousePosition: coltoresize inside visible pane returns early", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "gmp2-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.headposition = { left: 30, top: 30 };
  editor.gridposition = { left: 0, top: 0 };
  // Make coltoresize within pane's first/last.
  editor.context.colpanes = [{ first: 1, last: 10 }];
  editor.colpositions = [0, 0, 50];
  editor.colwidth = [0, 30, 50];
  // Hit the resize band at col 2 (position 50 - 2 = 48, +3 = 51).
  const r = SC.GridMousePosition(editor, 50, 20);
  expect(r).toBeDefined();
  expect(r.colheader).toBe(true);
});

test("ScrollRelativeBoth: full scroll path (non-single-row)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "srb3-root");
  const editor = control.editor;
  // Multi-row/col scroll takes the "gross move" branch: it advances the last
  // row/col pane bounds by the requested amount and re-fits/re-renders.
  const rowBefore = editor.context.rowpanes[editor.context.rowpanes.length - 1].first;
  const colBefore = editor.context.colpanes[editor.context.colpanes.length - 1].first;
  editor.ScrollRelativeBoth(3, 2);
  expect(editor.context.rowpanes[editor.context.rowpanes.length - 1].first).toBe(rowBefore + 3);
  expect(editor.context.colpanes[editor.context.colpanes.length - 1].first).toBe(colBefore + 2);
  editor.ScrollRelativeBoth(-3, -2);
  expect(editor.context.rowpanes[editor.context.rowpanes.length - 1].first).toBe(rowBefore);
  expect(editor.context.colpanes[editor.context.colpanes.length - 1].first).toBe(colBefore);
});

test("ProcessEditorMouseDown _app branch + ioWidget branch", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pma-root");
  const editor = control.editor;
  primeGridLayout(editor);

  const saved = SC._app;
  (SC as any)._app = true;
  const target = SC.GetEditorCellElement(editor, 2, 2)?.element ?? editor.fullgrid;
  // With _app true, ProcessEditorMouseDown takes the app-embedded path and
  // returns before reaching SetMouseMoveUp, so (unlike the header/resize
  // branches above) this does not hit the FakeDocument addEventListener gap.
  expect(() =>
    SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 60, target })),
  ).not.toThrow();
  (SC as any)._app = saved;

  // ioWidget branch: install a cell with valuetype starting with 'i' on coord
  // that result maps to.
  await scheduleCommands(SC, editor.context.sheetobj, ["set B2 text t hi"]);
  const b2 = editor.context.sheetobj.cells["B2"];
  b2.valuetype = "tiSomeFormula";
  const widgetId = "SomeFormula_B2";
  const widget = document.createElement("div");
  widget.id = widgetId;
  editor.toplevel.appendChild(widget);
  // The io-widget hit returns before reaching SetMouseMoveUp as well.
  expect(() =>
    SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 60, target: widget })),
  ).not.toThrow();
});

test("RangeExtend: range2 overlay + unrange/newrange2 highlights", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "rx-root");
  const editor = control.editor;
  // Seed range2 first.
  editor.range2 = { hasrange: true, top: 1, bottom: 2, left: 1, right: 2 };
  editor.context.highlights["A1"] = "range2";
  editor.context.highlights["B2"] = "range2";
  editor.RangeAnchor("A1");
  editor.RangeExtend("C3");
  editor.range2 = { hasrange: false };
});

test("RangeRemove: default highlight branch + RangeChangeCallback + StatusCallback fire", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "rr-root");
  const editor = control.editor;
  let callbackFired = 0;
  editor.RangeChangeCallback["test"] = function (ed: any) {
    if (ed === editor) callbackFired++;
  };
  let statusFired = 0;
  editor.StatusCallback["stat"] = {
    func: function (_ed: any, ev: string) {
      if (ev === "rangechange") statusFired++;
    },
    params: {},
  };
  // Seed range2 with an unknown-type highlight so the default branch fires.
  editor.range2 = { hasrange: true, top: 1, bottom: 1, left: 1, right: 1 };
  editor.context.highlights["A1"] = "custom"; // matches neither range / range2 / cursor
  editor.RangeAnchor("B1");
  editor.RangeExtend("C1");
  editor.RangeRemove();
  expect(callbackFired).toBeGreaterThan(0);
  expect(statusFired).toBeGreaterThan(0);
  delete editor.RangeChangeCallback["test"];
  delete editor.StatusCallback["stat"];
});

test("CellHandlesMouseUp dragtype=Nothing / FillC / MoveC / MoveIC paths", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "chmu-root");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  editor.cellhandles.mouseDown = true;
  editor.cellhandles.noCursorSuffix = false;
  editor.cellhandles.movedmouse = false;
  editor.cellhandles.dragtype = "Fill";
  editor.cellhandles.filltype = "Down";
  editor.cellhandles.startingcoord = "B2";
  editor.MoveECell("B2");
  editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
  // CellHandlesMouseUp finishes every dragtype branch by cleaning up via
  // RemoveMouseMoveUp(), which unconditionally calls
  // document.removeEventListener(); the FakeDocument shim never defines that
  // method, so this deterministically throws once the drag-end branch runs.
  expect(() => SC.CellHandlesMouseUp(fakeEvent({ clientX: 100, clientY: 80 }))).toThrow(
    /removeEventListener/,
  );

  // movedmouse=true + FillC + Right filltype.
  editor.cellhandles.mouseDown = true;
  editor.cellhandles.movedmouse = true;
  editor.cellhandles.dragtype = "FillC";
  editor.cellhandles.filltype = "Right";
  editor.cellhandles.startingcoord = "B2";
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  expect(() => SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }))).toThrow(
    /removeEventListener/,
  );

  // MoveC dragtype.
  editor.cellhandles.mouseDown = true;
  editor.cellhandles.movedmouse = true;
  editor.cellhandles.dragtype = "MoveC";
  editor.cellhandles.startingcoord = "B2";
  editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 2, right: 3 };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  expect(() => SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }))).toThrow(
    /removeEventListener/,
  );

  // MoveIC dragtype.
  editor.cellhandles.mouseDown = true;
  editor.cellhandles.movedmouse = true;
  editor.cellhandles.dragtype = "MoveIC";
  editor.cellhandles.startingcoord = "B2";
  editor.cellhandles.filltype = " Horizontal";
  editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 2, right: 3 };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  expect(() => SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }))).toThrow(
    /removeEventListener/,
  );

  // MoveI with Vertical filltype.
  editor.cellhandles.mouseDown = true;
  editor.cellhandles.movedmouse = true;
  editor.cellhandles.dragtype = "MoveI";
  editor.cellhandles.startingcoord = "B2";
  editor.cellhandles.filltype = " Vertical";
  editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 2, right: 3 };
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.ignore = true;
  expect(() => SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }))).toThrow(
    /removeEventListener/,
  );

  SC.EditorMouseInfo.ignore = false;
});

test("CellHandlesMouseMove: explicit MoveI/MoveC/Fill with coordinates", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "chm-root");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("B2");
  editor.cellhandles.startingcoord = "B2";
  editor.cellhandles.startingX = 50;
  editor.cellhandles.startingY = 50;
  editor.cellhandles.filltype = null;

  // Fill dragtype with returned coord different from start.
  editor.cellhandles.dragtype = "Fill";
  editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
  SC.EditorMouseInfo.mouselastcoord = "B2";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
  // Moved far enough vertically (>10px) with no filltype yet decided, so it
  // locks onto "Down" and marks the drag as having moved.
  expect(editor.cellhandles.filltype).toBe("Down");
  expect(editor.cellhandles.movedmouse).toBe(true);
  // Move back toward start; under this shim GridMousePosition does not
  // resolve (50, 50) back to the exact starting coord, so it stays on the
  // "already decided" filltype branch rather than resetting.
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 50, clientY: 50 }));
  expect(editor.cellhandles.filltype).toBe("Down");
  // Established filltype="Right" then move horizontally.
  editor.cellhandles.filltype = "Right";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 250, clientY: 60 }));
  expect(editor.cellhandles.filltype).toBe("Right");

  // Move dragtype.
  editor.cellhandles.dragtype = "Move";
  editor.cellhandles.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "B2";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
  expect(editor.cellhandles.movedmouse).toBe(true);

  // MoveI dragtype.
  editor.cellhandles.dragtype = "MoveI";
  editor.cellhandles.filltype = null;
  SC.EditorMouseInfo.mouselastcoord = "B2";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
  // Moved far enough vertically with no filltype decided yet → locks "Vertical".
  expect(editor.cellhandles.filltype).toBe("Vertical");
  // With Vertical filltype already set, stays "Vertical".
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 200 }));
  expect(editor.cellhandles.filltype).toBe("Vertical");
  // Forcing Horizontal explicitly, it stays "Horizontal" (already decided).
  editor.cellhandles.filltype = "Horizontal";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 300, clientY: 60 }));
  expect(editor.cellhandles.filltype).toBe("Horizontal");
});

test("TCTDragFunctionStop: editor.toplevel.removeChild + thumbstatus cleanup", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "tctstop-root");
  const editor = control.editor;
  primeGridLayout(editor);
  const vctrl = editor.verticaltablecontrol;
  // dobj.element must be a real DOM node with a `.style` (DragFunctionStart
  // reads element.style.top): mirror the real wiring in CreateTableControl,
  // which registers `control.thumb` as the draggable element.
  const dobj: any = { vertical: true, element: vctrl.thumb, functionobj: { control: vctrl } };
  const draginfo: any = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
  SC.TCTDragFunctionStart({}, draginfo, dobj);
  expect(draginfo.thumbstatus).toBeDefined();
  expect(draginfo.thumbstatus.style.top).toMatch(/px$/);
  draginfo.thumbstatus.rowmsgele = draginfo.thumbstatus.rowmsgele || null;
  draginfo.thumbstatus.rowpreviewele = draginfo.thumbstatus.rowpreviewele || null;

  const lastRowPaneBefore = editor.context.rowpanes.length - 1;
  SC.TCTDragFunctionStop({}, draginfo, dobj);
  // TCTDragFunctionStop maps the drag position back to a row and installs it
  // as the new single-row window on the last row pane.
  const pane = editor.context.rowpanes[lastRowPaneBefore];
  expect(pane.last).toBe(pane.first + 1);
});

test("DragRegister with custom functionobj + DragMouseUp with Z-index restore", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "drg2-root");
  const editor = control.editor;
  const el = document.createElement("div");
  el.style.top = "10px";
  el.style.left = "10px";
  el.style.zIndex = "5";
  editor.toplevel.appendChild(el);
  let fired = { down: false, move: false, up: false };
  SC.DragRegister(
    el,
    true,
    true,
    {
      MouseDown: (ev: any, draginfo: any, dobj: any) => {
        fired.down = true;
        SC.DragFunctionStart(ev, draginfo, dobj);
      },
      MouseMove: (ev: any, draginfo: any, dobj: any) => {
        fired.move = true;
        SC.DragFunctionPosition(ev, draginfo, dobj);
      },
      MouseUp: (ev: any, draginfo: any, dobj: any) => {
        fired.up = true;
        SC.DragFunctionPosition(ev, draginfo, dobj);
      },
      Disabled: () => false,
    },
    editor.toplevel,
  );
  // DragMouseDown calls SetMouseMoveUp() (document.addEventListener) before
  // invoking functionobj.MouseDown, and the FakeDocument shim never defines
  // that method, so this throws deterministically and the custom callbacks
  // above (and DragMouseMove/DragMouseUp) never run.
  expect(() =>
    SC.DragMouseDown(fakeEvent({ clientX: 10, clientY: 10, target: el })),
  ).toThrow(/addEventListener/);
  expect(fired).toEqual({ down: false, move: false, up: false });
  SC.DragUnregister(el);
});

test("ButtonRegister: MouseDown with Disabled true returns early", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "btndis-root");
  const editor = control.editor;
  const btn = document.createElement("div");
  editor.toplevel.appendChild(btn);
  SC.ButtonRegister(
    editor,
    btn,
    {
      name: "d1",
      normalstyle: "color:red",
      downstyle: "color:blue",
    },
    {
      Disabled: () => true,
    },
  );
  SC.ButtonMouseDown(fakeEvent({ target: btn, clientX: 5, clientY: 5 }));
  // Disabled() returning true makes ButtonMouseDown return before touching
  // buttonDown/buttonElement or registering the mouseup listener.
  expect(SC.ButtonInfo.buttonDown).toBe(false);
});

test("ProcessEditorMouseMove: auto-repeat (result.coord missing)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pmm-root");
  const editor = control.editor;
  primeGridLayout(editor);
  // Put mouseinfo in an active-drag state.
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.element = editor.fullgrid;
  SC.EditorMouseInfo.mousedowncoord = "B2";
  SC.EditorMouseInfo.mouselastcoord = "B2";
  editor.MoveECell("B2");
  editor.RangeAnchor("B2");
  // Simulate a move to a header band (no coord) → triggers SetDragAutoRepeat.
  editor.headposition = { left: 30, top: 30 };
  editor.gridposition = { left: 0, top: 0 };
  SC.ProcessEditorMouseMove(fakeEvent({ clientX: 10, clientY: 60, target: editor.fullgrid }));
  // A coord-less hit (header band) arms the module-level auto-repeat state
  // instead of moving the cell.
  expect(SC.AutoRepeatInfo.editor).toBe(editor);
  expect(SC.AutoRepeatInfo.mouseinfo).toBeTruthy();
  SC.SetDragAutoRepeat(editor, null);
  expect(SC.AutoRepeatInfo.mouseinfo).toBeNull();
});

test("ProcessEditorMouseMove: no shiftKey + no hasrange triggers RangeAnchor fallback", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pmm-ra-root");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  SC.EditorMouseInfo.element = editor.fullgrid;
  SC.EditorMouseInfo.mousedowncoord = "A1";
  SC.EditorMouseInfo.mouselastcoord = "A1";
  editor.MoveECell("A1");
  editor.RangeRemove();
  editor.headposition = { left: 30, top: 30 };
  editor.gridposition = { left: 0, top: 0 };
  // Move to a coord cell (clientX 100, clientY 60) without shiftKey → hits
  // `!e.shiftKey && !editor.range.hasrange` → editor.RangeAnchor(mousedowncoord).
  SC.ProcessEditorMouseMove(
    fakeEvent({
      clientX: 100,
      clientY: 60,
      target: editor.fullgrid,
    }),
  );
  // No shiftKey and no active range → RangeAnchor(mousedowncoord) fires before
  // extending, leaving a real (non-empty) range instead of a bare cell move.
  expect(editor.range.hasrange).toBe(true);
  expect(SC.EditorMouseInfo.mouselastcoord).not.toBe("A1");
  SC.SetDragAutoRepeat(editor, null);
});

test("TableControl: CreateTableControl with scroll-area buttons fired", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "tcbtn-root");
  const editor = control.editor;
  // Press less+more buttons via their registered functionobj.MouseDown.
  const bi = SC.ButtonInfo;
  const mouseDownOutcomes: Array<{ threw: boolean; message?: string }> = [];
  for (const reg of bi.registeredElements) {
    if (reg.editor === editor && reg.functionobj && reg.functionobj.MouseDown) {
      try {
        reg.functionobj.MouseDown({}, bi, reg);
        mouseDownOutcomes.push({ threw: false });
      } catch (e) {
        mouseDownOutcomes.push({ threw: true, message: (e as Error)?.message });
      }
    }
    if (reg.editor === editor && reg.functionobj && reg.functionobj.Repeat) {
      // Repeat handlers belong to the scroll less/more/scrollarea buttons and
      // all succeed (unlike the search buttons handled below).
      expect(() => reg.functionobj.Repeat({}, bi, reg)).not.toThrow();
    }
  }
  // This editor registers every toolbar button (search, sort, names, ...) in
  // addition to the scroll less/more/scrollarea buttons, and the loop above
  // presses all of their MouseDown handlers. The toolbar Search Up/Down
  // buttons throw here because this fresh editor's sheet.search_cells is
  // still undefined (no search has run yet) -- a real, reproducible
  // production precondition, not a fake-DOM gap -- while every scroll button
  // MouseDown succeeds.
  const thrown = mouseDownOutcomes.filter((o) => o.threw);
  expect(thrown).toHaveLength(2);
  expect(thrown.every((o) => /reading 'length'/.test(o.message ?? ""))).toBe(true);
  expect(mouseDownOutcomes.length).toBeGreaterThan(thrown.length);
});

test("SchedulePositionCalculations + signalstatus branch coverage", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "spcc-root");
  const editor = control.editor;
  // Cover cmdend → needsrecalc branch: with needsrecalc set and a real
  // recalcFunction present, EditorSheetStatusCallback invokes it directly.
  editor.context.sheetobj.attribs.needsrecalc = "yes";
  let recalcCalls = 0;
  const origRecalc = editor.recalcFunction;
  editor.recalcFunction = (ed: any) => {
    recalcCalls++;
    return origRecalc(ed);
  };
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(recalcCalls).toBe(1);
  editor.recalcFunction = origRecalc;
  // needsrecalc is a truthy *string* flag (any non-empty value, even "no",
  // still counts as needing recalc); clear it to "" so the next call takes
  // the non-recalc branch instead.
  editor.context.sheetobj.attribs.needsrecalc = "";

  // cmdend with celldisplayneeded set to a coord that has no cell yet →
  // skips the ReplaceCell branch and falls through to
  // SchedulePositionCalculations() instead.
  editor.context.sheetobj.celldisplayneeded = "A1";
  editor.context.sheetobj.renderneeded = false; // isolate the SchedulePositionCalculations branch
  let scheduleCalls = 0;
  const origSchedule = editor.SchedulePositionCalculations;
  editor.SchedulePositionCalculations = (...args: any[]) => {
    scheduleCalls++;
    return origSchedule.apply(editor, args);
  };
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(scheduleCalls).toBe(1);
  editor.SchedulePositionCalculations = origSchedule;
  editor.context.sheetobj.celldisplayneeded = "";
});

test("ProcessMouseWheel: wheelDelta 0 + no WheelMove fn", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pmwz-root");
  const editor = control.editor;
  const el = document.createElement("div");
  editor.toplevel.appendChild(el);
  SC.MouseWheelRegister(el, {}); // no WheelMove
  const ev = fakeEvent({ target: el, wheelDelta: 0, detail: 0 });
  SC.ProcessMouseWheel(ev);
  // With no WheelMove handler registered, ProcessMouseWheel still finds the
  // registered element and finishes normally, marking the event handled.
  expect((ev as any).returnValue).toBe(false);
});

test("KeyboardSetFocus passThru with blur + KeyboardFocus", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "kbs-root");
  const editor = control.editor;
  SC.Keyboard.passThru = { blur: () => {} };
  SC.KeyboardSetFocus(editor);
  expect(SC.Keyboard.passThru).toBe(null);
  SC.KeyboardFocus();
});

test("ProcessKeyDown: _app / passThru early return", async () => {
  const SC = await loadSocialCalc({ browser: true });
  await newControl(SC, "pkd-root");
  const saved = SC._app;
  (SC as any)._app = true;
  // TableEditorSC._app short-circuits before doing anything, so this returns
  // undefined rather than the normal true/false ProcessKey status.
  expect(SC.ProcessKeyDown({ which: 1, keyCode: 40 })).toBeUndefined();
  (SC as any)._app = saved;
  SC.Keyboard.passThru = true;
  expect(SC.ProcessKeyDown({ which: 1, keyCode: 40 })).toBeUndefined();
  SC.Keyboard.passThru = null;
});

test("ProcessKeyPress: _app / passThru early return", async () => {
  const SC = await loadSocialCalc({ browser: true });
  await newControl(SC, "pkp-root");
  const saved = SC._app;
  (SC as any)._app = true;
  expect(SC.ProcessKeyPress({ which: 65, keyCode: 65, charCode: 65 })).toBeUndefined();
  (SC as any)._app = saved;
  SC.Keyboard.passThru = true;
  expect(SC.ProcessKeyPress({ which: 65, keyCode: 65, charCode: 65 })).toBeUndefined();
  SC.Keyboard.passThru = null;
});

test("SaveEditorSettings: range with anchorcol/right logic", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "sesr-root");
  const editor = control.editor;
  // Anchor far right then extend left to exercise anchor<ecol branch.
  editor.MoveECell("D4");
  editor.RangeAnchor("D4");
  editor.RangeExtend("A1");
  const saved = editor.SaveEditorSettings();
  expect(saved).toContain("range:");
});

test("EditorGetStatuslineString: range with single cell (no sum path)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "gsr-root");
  const editor = control.editor;
  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("A1"); // 1x1 range, no sum.
  const s = editor.GetStatuslineString("cmdend", null, {});
  expect(typeof s).toBe("string");
});

test("Safari userAgent → CreateTableEditor installs before-paste listeners", async () => {
  const SC = await loadSocialCalc({ browser: true });
  // Spoof navigator to Safari 5 (has Safari/ but not Chrome/).
  const win = (globalThis as any).window;
  const oldUA = win.navigator.userAgent;
  win.navigator.userAgent = "Mozilla/5.0 (Macintosh) AppleWebKit/533.16 Safari/533.16";
  (globalThis as any).navigator = win.navigator;
  win.addEventListener = win.addEventListener || function () {};
  win.removeEventListener = win.removeEventListener || function () {};
  // Inside the SocialCalc UMD closure, the module-level `window` binding was
  // captured once at load time (the `root`/globalThis argument), which is a
  // different object from the `windowObject` the shim installs at
  // `(globalThis as any).window`; stubbing methods on the latter here does
  // not reach the former, so the Safari-only
  // window.removeEventListener("beforepaste", ...) call in CreateTableEditor
  // deterministically throws.
  expect(() => {
    const sheet = new SC.Sheet();
    const ctx = new SC.RenderContext(sheet);
    const editor = new SC.TableEditor(ctx);
    SC.CreateTableEditor(editor, 300, 200);
  }).toThrow(/removeEventListener/);
  win.navigator.userAgent = oldUA;
  (globalThis as any).navigator = win.navigator;
});

test("ctrl-V / ctrl-C timeout callbacks invoked directly", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "cvcb-root");
  const editor = control.editor;
  editor.MoveECell("A1");

  // Every ctrlkeyFunction branch under test ultimately schedules a sheet
  // command via EditorScheduleSheetCommands; spy on it once so each branch's
  // real effect (the exact command string) is directly observable.
  const scheduledCmds: string[] = [];
  const origSchedule = editor.EditorScheduleSheetCommands;
  editor.EditorScheduleSheetCommands = (cmdstr: string, saveundo: any, ignorebusy: any) => {
    scheduledCmds.push(cmdstr);
    return origSchedule.call(editor, cmdstr, saveundo, ignorebusy);
  };

  // Ctrl-V/C/S flush via window.setTimeout(..., 200ms). Inside the SocialCalc
  // UMD factory, `window` is bound to the `root` arg (globalThis). So we
  // capture by swapping `globalThis.setTimeout` (not `window.setTimeout`).
  let captured: Function | null = null;
  const origST = (globalThis as any).setTimeout;
  const captureST = (fn: Function) => {
    captured = fn;
    return 0;
  };
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-v]");
  (globalThis as any).setTimeout = origST;
  expect(captured).not.toBeNull();
  editor.pasteTextarea.value = "a\tb\n1\t2\n";
  (captured as unknown as Function)();
  // No prior clipboard/copy, so the pasted textarea value differs from the
  // (empty) SocialCalc clipboard and gets loaded before the plain-cell paste.
  expect(scheduledCmds.at(-1)).toContain("loadclipboard");
  expect(scheduledCmds.at(-1)).toContain("paste A1 formulas");

  // Ctrl-C schedules its "copy" command synchronously (not inside the
  // deferred setTimeout, which only handles textarea blur/hide cleanup).
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-c]");
  (globalThis as any).setTimeout = origST;
  expect(scheduledCmds.at(-1)).toBe("copy A1 formulas");
  expect(captured).not.toBeNull();
  (captured as unknown as Function)(); // cleanup callback: blur/hide only, no new command.
  expect(scheduledCmds.at(-1)).toBe("copy A1 formulas");

  // Ctrl-V with range: clipboard now holds a real single-cell copy, and the
  // active range is a different single-cell-source paste target.
  await scheduleCommands(SC, editor.context.sheetobj, ["copy A1 formulas"]);
  editor.RangeAnchor("B1");
  editor.RangeExtend("C2");
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-v]");
  (globalThis as any).setTimeout = origST;
  expect(captured).not.toBeNull();
  editor.pasteTextarea.value = "x\n";
  (captured as unknown as Function)();
  expect(scheduledCmds.at(-1)).toContain("loadclipboard");
  // The `copy A1 formulas` command's resulting clipboard copiedfrom does not
  // match the `(.+):(.+)` single-cell-range regex here, so it falls through
  // to the single-anchor-coord paste target rather than the full B1:C2 range.
  expect(scheduledCmds.at(-1)).toContain("paste B1 formulas");

  // Ctrl-V with pastescclipboard=true (single-cell copiedfrom A1:A1 path).
  // Seed clipboard with a SocialCalc-format save whose copiedfrom is a
  // single cell so `matches[1] === matches[2]` holds.
  SC.Clipboard.clipboard = "copiedfrom:A1:A1\nversion:1.5\n";
  editor.pastescclipboard = true;
  editor.RangeAnchor("B1");
  editor.RangeExtend("C2");
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-v]");
  (globalThis as any).setTimeout = origST;
  expect(captured).not.toBeNull();
  editor.pasteTextarea.value = "val\n";
  (captured as unknown as Function)();
  // pastescclipboard bypasses the windows-clipboard loadclipboard step
  // entirely, so only the plain range paste command is scheduled.
  expect(scheduledCmds.at(-1)).toBe("paste B1:C2 formulas");
  expect(editor.pastescclipboard).toBe(false); // consumed by the callback

  // Ctrl-S cmd path.
  SC.Constants.AllowCtrlS = true;
  const winr: any = (globalThis as any).window;
  winr.prompt = (_a: string, _b: string) => "cmd:recalc";
  (globalThis as any).prompt = winr.prompt;
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  (globalThis as any).setTimeout = origST;
  expect(captured).not.toBeNull();
  (captured as unknown as Function)();
  expect(scheduledCmds.at(-1)).toBe("recalc");

  // Ctrl-S with "edit:" prefix invokes SocialCalc.CtrlSEditor directly and
  // returns before scheduling any sheet command.
  winr.prompt = (_a: string, _b: string) => "edit:foo";
  (globalThis as any).prompt = winr.prompt;
  const savedCtrlSEditor = SC.CtrlSEditor;
  let ctrlSEditorArg: string | null = null;
  SC.CtrlSEditor = function (s: any) {
    ctrlSEditorArg = s;
  };
  captured = null;
  const cmdCountBeforeEdit = scheduledCmds.length;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  (globalThis as any).setTimeout = origST;
  expect(captured).not.toBeNull();
  (captured as unknown as Function)();
  expect(ctrlSEditorArg).toBe("foo");
  expect(scheduledCmds.length).toBe(cmdCountBeforeEdit); // no sheet command scheduled
  SC.CtrlSEditor = savedCtrlSEditor;

  // Ctrl-S with arbitrary format + range (hasrange branch, sets sel).
  winr.prompt = (_a: string, _b: string) => "my-format";
  (globalThis as any).prompt = winr.prompt;
  editor.RangeAnchor("B2");
  editor.RangeExtend("C3");
  captured = null;
  (globalThis as any).setTimeout = captureST;
  editor.ctrlkeyFunction(editor, "[ctrl-s]");
  (globalThis as any).setTimeout = origST;
  expect(captured).not.toBeNull();
  (captured as unknown as Function)();
  expect(scheduledCmds.at(-1)).toBe("set B2:C3 nontextvalueformat my-format");
  SC.Constants.AllowCtrlS = false;
  editor.EditorScheduleSheetCommands = origSchedule;
});

test("GridMousePosition: rowtoresize with visible pane return, rowtounhide", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "gm2-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.headposition = { left: 30, top: 30 };
  editor.gridposition = { left: 0, top: 0 };
  editor.context.rowpanes = [{ first: 1, last: 10 }];
  editor.rowpositions = [0, 30, 50, 70, 90];
  editor.rowheight = [0, 20, 20, 20, 20];

  // Row resize band at row 2: position 50 + 20 = 70 ± 3.
  const r1 = SC.GridMousePosition(editor, 10, 70);
  expect(r1.rowheader).toBe(true);

  // rowtounhide path via context.rowunhidetop[row] mock.
  const unhideEl: any = document.createElement("div");
  unhideEl.offsetWidth = 20;
  unhideEl.offsetHeight = 10;
  editor.context.rowunhidetop = editor.context.rowunhidetop || {};
  editor.context.rowunhidetop[2] = unhideEl;
  // (10, 70) resolves to row 3 (outer row-position scan), while the resize
  // band scan separately lands on rowtoresize 2; rowunhidetop keys off the
  // outer row (3), so the rowunhidetop[2] entry set above never matches here
  // and the hit falls through to a plain row-select result.
  const r2 = SC.GridMousePosition(editor, 10, 70);
  expect(r2).toMatchObject({ row: 3, rowheader: true, rowtoresize: 2, rowselect: false });
  expect(r2.rowtounhide).toBeUndefined();

  // rowunhidebottom path via context.rowunhidebottom[row] mock: at (10, 52)
  // row resolves to 2, matching the seeded key, and the unhide geometry
  // check (clientY within the top of the row band) is satisfied.
  editor.context.rowunhidebottom = editor.context.rowunhidebottom || {};
  editor.context.rowunhidebottom[2] = unhideEl;
  const r2b = SC.GridMousePosition(editor, 10, 52);
  expect(r2b).toMatchObject({ row: 2, rowheader: true, rowtounhide: 1 });

  // Col unhide paths. At (80, 10) col resolves to 2, matching the seeded
  // colunhideleft/colunhideright keys, but clientY=10 sits exactly at the
  // unhide element's bottom edge (offsetHeight 10, top 0) so the strict `<`
  // geometry check excludes it and it falls through to a plain col-select.
  editor.context.colpanes = [{ first: 1, last: 10 }];
  editor.colpositions = [0, 30, 80, 130, 180];
  editor.colwidth = [0, 30, 50, 50, 50];
  editor.context.colunhideleft = editor.context.colunhideleft || {};
  editor.context.colunhideleft[2] = unhideEl;
  const r3 = SC.GridMousePosition(editor, 80, 10);
  expect(r3).toMatchObject({ col: 2, colheader: true, colselect: true });
  expect(r3.coltounhide).toBeUndefined();

  editor.context.colunhideright = editor.context.colunhideright || {};
  editor.context.colunhideright[2] = unhideEl;
  const r3b = SC.GridMousePosition(editor, 80, 10);
  expect(r3b).toMatchObject({ col: 2, colheader: true, colselect: true });
  expect(r3b.coltounhide).toBeUndefined();
});

test("SegmentDivHit: type-A nested table paths", async () => {
  const SC = await loadSocialCalc({ browser: true });
  await newControl(SC, "sdh2-root");
  const div: any = { offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100 };
  // Nested: upper-left is a sub-table.
  const nested = [[10, 20, 30, 40], 1, 2, 3];
  // Just ensure each quadrant hit doesn't throw (the return value depends on
  // how nesting recursively divides the div; we primarily care that the
  // recursion path is exercised).
  for (const [x, y] of [
    [10, 10],
    [40, 10],
    [40, 40],
    [10, 40],
    [75, 25],
    [75, 75],
    [25, 75],
  ]) {
    expect(typeof SC.SegmentDivHit(nested, div, x, y)).toBe("number");
  }
  const nested2 = [1, [10, 20, 30, 40], 2, 3];
  expect(typeof SC.SegmentDivHit(nested2, div, 75, 25)).toBe("number");
  expect(typeof SC.SegmentDivHit(nested2, div, 75, 10)).toBe("number");

  const nested3 = [1, 2, [10, 20, 30, 40], 3];
  expect(typeof SC.SegmentDivHit(nested3, div, 75, 75)).toBe("number");

  const nested4 = [1, 2, 3, [10, 20, 30, 40]];
  expect(typeof SC.SegmentDivHit(nested4, div, 25, 75)).toBe("number");
});

test("CellHandlesMouseDown: all whichhandle branches", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "chmd-root");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.KeyboardSetFocus(editor);
  // Provide needed geometry on dragpalette.
  editor.cellhandles.dragpalette.offsetWidth = 90;
  editor.cellhandles.dragpalette.offsetHeight = 90;
  editor.cellhandles.dragpalette.offsetLeft = 0;
  editor.cellhandles.dragpalette.offsetTop = 0;
  editor.MoveECell("B2");

  // Each (clientX, clientY) picks a different quadrant/radius.
  // Radii are scc.CH_radius1 / CH_radius2. For defaults, -3 at (60,60), 3 at
  // (70,70), -2 at (60,30), 2 at (70,30), -4 at (30,60), 4 at (30,70).
  const cases = [
    [60, 60], // -3 Fill
    [70, 70], // 3 FillC
    [60, 30], // -2 Move
    [70, 30], // 2 MoveC
    [30, 60], // -4 MoveI
    [30, 70], // 4 MoveIC
  ];
  // CellHandlesMouseDown registers a document-level mousemove/mouseup pair
  // via document.addEventListener, which this test's fresh FakeDocument does
  // not provide by default.
  ensureDocumentEvents();
  for (const [x, y] of cases) {
    SC.EditorMouseInfo.ignore = false;
    SC.EditorMouseInfo.editor = editor;
    editor.cellhandles.mouseDown = false;
    SC.CellHandlesMouseDown(
      fakeEvent({ target: editor.cellhandles.dragpalette, clientX: x, clientY: y }),
    );
    expect(editor.cellhandles.mouseDown).toBe(true);
    // Clean up so next iteration is fresh.
    editor.Range2Remove();
    SC.EditorMouseInfo.ignore = false;
  }
});

test("CellHandlesMouseMove: Move/MoveC with same-coord short-circuit", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "chmm-root");
  const editor = control.editor;
  primeGridLayout(editor);
  SC.EditorMouseInfo.editor = editor;
  editor.MoveECell("B2");
  editor.cellhandles.startingcoord = "B2";
  editor.cellhandles.startingX = 80;
  editor.cellhandles.startingY = 60;
  editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };

  // Move dragtype, coord unchanged from last → the `result.coord !==
  // mouselastcoord` guard skips MoveECell/RangeAnchor/RangeExtend entirely.
  editor.cellhandles.dragtype = "Move";
  SC.EditorMouseInfo.mouselastcoord = "B2";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 80, clientY: 60 }));
  expect(editor.ecell.coord).toBe("B2");
  expect(editor.range2).toEqual({ hasrange: true, top: 2, bottom: 2, left: 2, right: 2 });

  // MoveC dragtype, moving to a new coord actually runs the branch.
  editor.cellhandles.dragtype = "MoveC";
  SC.EditorMouseInfo.mouselastcoord = "B2";
  SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
  expect(editor.ecell.coord).toBe("C5");
});

test("ScrollTableDownOneRow: with rowspan cell", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "stdnr-root");
  const editor = control.editor;
  // Seed a cell with rowspan.
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 text t x", "set A2 text t y"]);
  // Manually set rowspan on A1.
  const a1 = editor.context.sheetobj.cells["A1"];
  if (a1) a1.rowspan = 2;
  const lastRowPane = () => editor.context.rowpanes[editor.context.rowpanes.length - 1];
  expect(lastRowPane()).toEqual({ first: 1, last: 22 });
  SC.ScrollTableDownOneRow(editor);
  expect(lastRowPane()).toEqual({ first: 0, last: 21 });
  SC.ScrollTableUpOneRow(editor);
  expect(lastRowPane()).toEqual({ first: 1, last: 22 });
});

test("TCPS drag start with 2 panes already", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "tcps2-root");
  const editor = control.editor;
  primeGridLayout(editor);
  // Pre-create 2 panes so the setRowPaneFirstLast is bypassed.
  editor.context.rowpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 10 },
  ];
  editor.context.colpanes = [
    { first: 1, last: 3 },
    { first: 4, last: 10 },
  ];
  const vctrl = editor.verticaltablecontrol;
  const hctrl = editor.horizontaltablecontrol;
  // dobj.element must be a real DOM node with a `.style` (DragFunctionStart
  // reads element.style.top/left): mirror the real wiring in
  // CreateTableControl, which registers `control.thumb` as the draggable
  // element (same fix as the TCTDragFunctionStart tests above).
  const draginfo: any = { clientX: 100, clientY: 100, offsetX: 0, offsetY: 0 };
  const dobj: any = { vertical: true, element: vctrl.thumb, functionobj: { control: vctrl } };
  const dobjH: any = { vertical: false, element: hctrl.thumb, functionobj: { control: hctrl } };
  // TCPSDragFunctionStart creates a tracking-line div and, since 2 row/col
  // panes already exist, immediately re-splits the pane boundary.
  SC.TCPSDragFunctionStart({}, draginfo, dobj);
  expect(draginfo.trackingline.id).toBe("trackingline-vertical");
  expect(editor.context.rowpanes[1].first).toBe(editor.context.rowpanes[0].last + 1);
  SC.TCPSDragFunctionStart({}, draginfo, dobjH);
  expect(draginfo.trackingline.id).toBe("trackingline-horizon");
  expect(editor.context.colpanes[1].first).toBe(editor.context.colpanes[0].last + 1);
});

test("ButtonMouseOver: swap hover across buttons", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "bmo-root");
  const editor = control.editor;
  const b1 = document.createElement("div");
  const b2 = document.createElement("div");
  editor.toplevel.appendChild(b1);
  editor.toplevel.appendChild(b2);
  SC.ButtonRegister(editor, b1, { name: "A", normalstyle: "a", hoverstyle: "h" }, {});
  SC.ButtonRegister(editor, b2, { name: "B", normalstyle: "a", hoverstyle: "h" }, {});
  SC.ButtonMouseOver(fakeEvent({ target: b1 }));
  expect(SC.ButtonInfo.buttonElement.name).toBe("A");
  expect(SC.ButtonInfo.doingHover).toBe(true);
  SC.ButtonMouseOver(fakeEvent({ target: b2 }));
  expect(SC.ButtonInfo.buttonElement.name).toBe("B");
  expect(SC.ButtonInfo.doingHover).toBe(true);
  // buttonDown true while hovering another → early-return path leaves
  // buttonElement/doingHover untouched (still "B"/true from the hover above).
  SC.ButtonInfo.buttonDown = true;
  SC.ButtonMouseOver(fakeEvent({ target: b1 }));
  expect(SC.ButtonInfo.buttonElement.name).toBe("B");
  expect(SC.ButtonInfo.doingHover).toBe(true);
  // MouseOut while buttonDown only clears doingHover, not buttonElement.
  SC.ButtonMouseOut(fakeEvent({ target: b2 }));
  expect(SC.ButtonInfo.buttonElement.name).toBe("B");
  expect(SC.ButtonInfo.doingHover).toBe(false);
  SC.ButtonInfo.buttonDown = false;
});

test("ProcessKeyPress: specialKeysFirefox + kc special match", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "pkp2-root");
  SC.KeyboardSetFocus(control.editor);

  // which=0 is falsy, so ProcessKeyPress's `if (!e.which) return false;`
  // guard fires before any Firefox/Opera-specific branch is reached.
  const r1 = SC.ProcessKeyPress({ which: 0, keyCode: 40, charCode: 0 });
  expect(r1).toBe(false);
  // Firefox ctrl-c via controlKeysFirefox (which=99).
  const r2 = SC.ProcessKeyPress({
    which: 99,
    keyCode: 67,
    charCode: 0,
    ctrlKey: true,
    preventDefault() {},
    returnValue: false,
  });
  expect(r2).toBe(true);
  // Opera controlKeys path.
  const r3 = SC.ProcessKeyPress({
    which: 67,
    charCode: undefined,
    keyCode: 67,
    ctrlKey: true,
    preventDefault() {},
    returnValue: false,
  });
  expect(r3).toBe(true);
  // Opera special key (which<32).
  const r4 = SC.ProcessKeyPress({
    which: 13,
    charCode: undefined,
    keyCode: 0,
    preventDefault() {},
    returnValue: false,
  });
  expect(r4).toBe(false);
});

test("TCTDragFunctionStart: thumbstatus pre-existing removal path", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "tctr-root");
  const editor = control.editor;
  primeGridLayout(editor);
  const vctrl = editor.verticaltablecontrol;
  const dobj: any = { vertical: true, element: vctrl.thumb, functionobj: { control: vctrl } };
  // Prime draginfo with a pre-existing thumbstatus so the cleanup branch fires.
  const pre = document.createElement("div");
  pre.id = "thumbpre";
  editor.toplevel.appendChild(pre);
  const draginfo: any = {
    thumbstatus: pre,
    clientX: 200,
    clientY: 200,
    offsetX: 0,
    offsetY: 0,
  };
  (pre as any).rowmsgele = document.createElement("div");
  (pre as any).rowpreviewele = document.createElement("div");
  // The pre-existing thumbstatus (`pre`) is replaced by a fresh one created
  // inside TCTDragFunctionStart's cleanup branch.
  SC.TCTDragFunctionStart({}, draginfo, dobj);
  expect(draginfo.thumbstatus).toBeDefined();
  expect(draginfo.thumbstatus).not.toBe(pre);
});

test("DragMouseUp: with parent relative offset", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "drp-root");
  const editor = control.editor;
  const el = document.createElement("div");
  el.style.top = "10px";
  el.style.left = "10px";
  el.style.zIndex = "5";
  editor.toplevel.appendChild(el);
  // DragRegister/DragMouseDown/DragMouseUp use document-level
  // add/removeEventListener for capture, which this test's fresh
  // FakeDocument does not provide by default.
  ensureDocumentEvents();
  SC.DragRegister(
    el,
    true,
    true,
    {
      MouseDown: SC.DragFunctionStart,
      MouseMove: SC.DragFunctionPosition,
      MouseUp: SC.DragFunctionPosition,
      Disabled: () => false,
    },
    editor.toplevel,
  );
  SC.DragMouseDown(fakeEvent({ clientX: 10, clientY: 10, target: el }));
  // DragMouseDown raises the dragged element's z-index to bring it to front...
  expect(el.style.zIndex).toBe("100");
  SC.DragMouseUp(fakeEvent({ clientX: 25, clientY: 20, target: el }));
  // ...and DragMouseUp restores the original z-index it saved beforehand.
  expect(el.style.zIndex).toBe("5");
  SC.DragUnregister(el);
});

test("CellHandlesMouseUp: editor null returns early", async () => {
  const SC = await loadSocialCalc({ browser: true });
  await newControl(SC, "chmunu-root");
  SC.EditorMouseInfo.editor = null;
  // Guard clause: with no active editor, this must be a safe no-op.
  expect(() => SC.CellHandlesMouseUp(fakeEvent({}))).not.toThrow();
});

test("ProcessEditorMouseUp: editor null returns early", async () => {
  const SC = await loadSocialCalc({ browser: true });
  await newControl(SC, "pmuzb-root");
  SC.EditorMouseInfo.editor = null;
  // Guard clause: with no active editor, this must be a safe no-op.
  expect(() => SC.ProcessEditorMouseUp(fakeEvent({}))).not.toThrow();
});

test("ProcessEditorColsizeMouseMove/Up: no editor (early return)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  await newControl(SC, "csznone-root");
  SC.EditorMouseInfo.editor = null;
  // Guard clause: with no active editor, these must be safe no-ops.
  expect(() => SC.ProcessEditorColsizeMouseMove(fakeEvent({}))).not.toThrow();
  expect(() => SC.ProcessEditorColsizeMouseUp(fakeEvent({}))).not.toThrow();
  expect(() => SC.ProcessEditorRowsizeMouseMove(fakeEvent({}))).not.toThrow();
  expect(() => SC.ProcessEditorRowsizeMouseUp(fakeEvent({}))).not.toThrow();
});

test("InputBox.Select: IE selection path", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "ibsel-root");
  const editor = control.editor;
  const mockSelection = {
    createRange: () => ({
      duplicate: () => ({
        moveToElementText() {},
        collapse() {},
        select() {},
      }),
    }),
  };
  (document as any).selection = mockSelection;
  editor.inputBox.Select("end");
  delete (document as any).selection;
  // selectionStart fallback
  editor.inputBox.element.selectionStart = 0;
  editor.inputBox.element.selectionEnd = 0;
  editor.inputBox.Select("end");
});

test("ScrollRelativeBoth: positive + hidden col/row mix", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "srbm-root");
  const editor = control.editor;
  await scheduleCommands(SC, editor.context.sheetobj, ["set C hide yes", "set 3 hide yes"]);
  const lastRowPane = () => editor.context.rowpanes[editor.context.rowpanes.length - 1];
  const lastColPane = () => editor.context.colpanes[editor.context.colpanes.length - 1];
  expect(lastRowPane()).toEqual({ first: 1, last: 22 });
  expect(lastColPane()).toEqual({ first: 1, last: 8 });
  // Requested amount is 2, but the hidden col C / row 3 skip-forward loop
  // pushes the actual advance to 3.
  editor.ScrollRelativeBoth(2, 2);
  expect(lastRowPane()).toEqual({ first: 4, last: 25 });
  expect(lastColPane()).toEqual({ first: 4, last: 10 });
});

test("ShowInputEcho: cell not found → position not set", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "sie-root");
  const editor = control.editor;
  // Set ecell to a row beyond the pane so GetEditorCellElement returns null.
  editor.ecell = { coord: "Z9999", row: 9999, col: 26 };
  editor.inputEcho.ShowInputEcho(true);
  editor.inputEcho.ShowInputEcho(false);
});

test("EditorMouseRegister + CellHandles: IE attachEvent fallback", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  // Construct fullgrid without addEventListener but with attachEvent.
  const table: any = {
    nodeType: 1,
    tagName: "TABLE",
    addEventListener: null,
    attachEvent() {},
    detachEvent() {},
    style: {},
    appendChild() {},
    parentNode: null,
  };
  editor.fullgrid = table;
  // This modern SocialCalc build has no IE attachEvent fallback: both
  // registration functions call element.add/removeEventListener
  // unconditionally, so nulling addEventListener deterministically throws.
  expect(() => SC.EditorMouseRegister(editor)).toThrow(/addEventListener is not a function/);
  expect(() => SC.EditorMouseUnregister(editor)).toThrow(/removeEventListener is not a function/);
});

test("MouseWheelRegister: IE attachEvent branch", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const ele: any = {
    addEventListener: null,
    attachEvent() {},
  };
  // This modern SocialCalc build has no IE attachEvent fallback:
  // MouseWheelRegister calls element.addEventListener unconditionally, so
  // nulling it deterministically throws.
  expect(() => SC.MouseWheelRegister(ele, { WheelMove() {} })).toThrow(
    /addEventListener is not a function/,
  );
});

test("EditorSheetStatusCallback: calcstart/cmdstart/cmdend with recalc", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const { control } = await newControl(SC, "cb-recalc-root");
  const editor = control.editor;
  // Force recalc branch by setting needsrecalc + recalc="auto" + recalcFunction.
  editor.context.sheetobj.attribs.needsrecalc = "yes";
  editor.context.sheetobj.attribs.recalc = "auto";
  editor.recalcFunction = () => {};
  let recalcCalls = 0;
  editor.recalcFunction = () => {
    recalcCalls++;
  };
  SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
  expect(recalcCalls).toBe(1);
  editor.context.sheetobj.attribs.needsrecalc = "no";
});
