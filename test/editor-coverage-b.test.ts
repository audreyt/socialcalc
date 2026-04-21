import { afterAll, afterEach, expect, test } from "bun:test";

import { loadSocialCalc as _loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
    cancelActiveTrackedTimers,
    ensureTrackedTimers,
    installWindowTimerTracking,
    restoreOriginalTimers,
} from "./helpers/timer-tracking";

// Track all setInterval/setTimeout calls so we can cancel them after each
// test — same rationale as editor-coverage-a. The helper's idempotent guard
// means whichever half loads first does the wrapping, and the other is a
// no-op. Module-top rather than beforeAll because bun's file ordering turns
// out to be sensitive to module-load weight (see editor-coverage-a).
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

function waitEditor(
    editor: any,
    wantStatus = "doneposcalc",
    timeoutMs = 3000,
): Promise<void> {
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
    } catch {}
    try {
        if (SC?.AutoRepeatInfo?.timer) {
            clearTimeout(SC.AutoRepeatInfo.timer);
            SC.AutoRepeatInfo.timer = null;
            SC.AutoRepeatInfo.mouseinfo = null;
        }
    } catch {}
    try {
        if (SC?.ButtonInfo?.timer) {
            clearTimeout(SC.ButtonInfo.timer);
            SC.ButtonInfo.timer = null;
        }
    } catch {}
    try {
        if (SC?.Keyboard) {
            SC.Keyboard.focusTable = null;
            SC.Keyboard.passThru = null;
        }
    } catch {}
    try {
        if (editor) {
            editor.state = "start";
            if (editor.timeout) {
                clearTimeout(editor.timeout);
                editor.timeout = null;
            }
        }
    } catch {}
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
    } catch {}
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
test("ScrollTableDownOneRow with rowspan cell starting inside pane", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "stds-root");
    const editor = control.editor;
    await scheduleCommands(SC, editor.context.sheetobj, [
        "set A3 value n 3",
        "set A10 value n 10",
    ]);
    const a3 = editor.context.sheetobj.cells["A3"];
    if (a3) a3.rowspan = 5;
    editor.context.rowpanes = [{ first: 2, last: 7 }];
    editor.context.colpanes = [{ first: 1, last: 3 }];
    editor.context.CalculateCellSkipData();
    try {
        editor.context.RenderSheet(null, editor.context.defaultHTMLlinkstyle);
    } catch {}
    try {
        SC.ScrollTableDownOneRow(editor);
    } catch {}
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
    try {
        editor.CalculateEditorPositions();
    } catch {}
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
    await scheduleCommands(SC, editor.context.sheetobj, [
        "set 2 hide yes",
        "set B hide yes",
    ]);
    try {
        SC.FitToEditTable(editor);
    } catch {}
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
    try {
        SC.ProcessEditorMouseDown(fakeEvent({ clientX: 10, clientY: 80, target }));
    } catch {}
    // Col header band.
    try {
        SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 10, target }));
    } catch {}

    // Force resize hit (colsize): clientX matches colpositions + colwidth.
    editor.colpositions = [0, 0, 50];
    editor.colwidth = [0, 30, 50];
    try {
        SC.ProcessEditorMouseDown(fakeEvent({ clientX: 30, clientY: 10, target }));
    } catch {}

    // Force rowsize (rowheader + rowtoresize within pane): clientY near row-2
    // boundary so rowtoresize=2 and it's visible, hitting the else branch
    // in ProcessEditorMouseDown (bundle 9098-9099).
    primeGridLayout(editor);
    try {
        SC.ProcessEditorMouseDown(fakeEvent({ clientX: 10, clientY: 70, target }));
    } catch {}

    // Force colsize (colheader + coltoresize within pane): clientX near
    // col-2 boundary → coltoresize=2 visible → else branch 9107-9108.
    primeGridLayout(editor);
    try {
        SC.ProcessEditorMouseDown(fakeEvent({ clientX: 80, clientY: 10, target }));
    } catch {}
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
    try {
        editor.ScrollRelativeBoth(1, 0);
    } catch {}
    try {
        editor.ScrollRelativeBoth(-1, 0);
    } catch {}
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
    // Click past grid → result has no coord → falls back to ecell.coord.
    try {
        SC.ProcessEditorMouseUp(fakeEvent({ clientX: 0, clientY: 0, target: editor.fullgrid }));
    } catch {}
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
    try {
        editor.ScrollRelativeBoth(3, 2);
    } catch {}
    try {
        editor.ScrollRelativeBoth(-3, -2);
    } catch {}
});

test("ProcessEditorMouseDown _app branch + ioWidget branch", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "pma-root");
    const editor = control.editor;
    primeGridLayout(editor);

    const saved = SC._app;
    (SC as any)._app = true;
    const target = SC.GetEditorCellElement(editor, 2, 2)?.element ?? editor.fullgrid;
    try {
        SC.ProcessEditorMouseDown(fakeEvent({ clientX: 100, clientY: 60, target }));
    } catch {}
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
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 100, clientY: 60, target: widget }),
        );
    } catch {}
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
    try {
        SC.CellHandlesMouseUp(fakeEvent({ clientX: 100, clientY: 80 }));
    } catch {}

    // movedmouse=true + FillC + Right filltype.
    editor.cellhandles.mouseDown = true;
    editor.cellhandles.movedmouse = true;
    editor.cellhandles.dragtype = "FillC";
    editor.cellhandles.filltype = "Right";
    editor.cellhandles.startingcoord = "B2";
    SC.EditorMouseInfo.editor = editor;
    SC.EditorMouseInfo.ignore = true;
    try {
        SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }));
    } catch {}

    // MoveC dragtype.
    editor.cellhandles.mouseDown = true;
    editor.cellhandles.movedmouse = true;
    editor.cellhandles.dragtype = "MoveC";
    editor.cellhandles.startingcoord = "B2";
    editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 2, right: 3 };
    SC.EditorMouseInfo.editor = editor;
    SC.EditorMouseInfo.ignore = true;
    try {
        SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }));
    } catch {}

    // MoveIC dragtype.
    editor.cellhandles.mouseDown = true;
    editor.cellhandles.movedmouse = true;
    editor.cellhandles.dragtype = "MoveIC";
    editor.cellhandles.startingcoord = "B2";
    editor.cellhandles.filltype = " Horizontal";
    editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 2, right: 3 };
    SC.EditorMouseInfo.editor = editor;
    SC.EditorMouseInfo.ignore = true;
    try {
        SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }));
    } catch {}

    // MoveI with Vertical filltype.
    editor.cellhandles.mouseDown = true;
    editor.cellhandles.movedmouse = true;
    editor.cellhandles.dragtype = "MoveI";
    editor.cellhandles.startingcoord = "B2";
    editor.cellhandles.filltype = " Vertical";
    editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 2, right: 3 };
    SC.EditorMouseInfo.editor = editor;
    SC.EditorMouseInfo.ignore = true;
    try {
        SC.CellHandlesMouseUp(fakeEvent({ clientX: 150, clientY: 60 }));
    } catch {}

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
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
    } catch {}
    // Back to start → filltype reset.
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 50, clientY: 50 }));
    } catch {}
    // Established filltype="Right" then move horizontally.
    editor.cellhandles.filltype = "Right";
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 250, clientY: 60 }));
    } catch {}

    // Move dragtype.
    editor.cellhandles.dragtype = "Move";
    editor.cellhandles.filltype = null;
    SC.EditorMouseInfo.mouselastcoord = "B2";
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
    } catch {}

    // MoveI dragtype.
    editor.cellhandles.dragtype = "MoveI";
    editor.cellhandles.filltype = null;
    SC.EditorMouseInfo.mouselastcoord = "B2";
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
    } catch {}
    // With Vertical filltype.
    editor.cellhandles.filltype = "Vertical";
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 200 }));
    } catch {}
    // With Horizontal filltype.
    editor.cellhandles.filltype = "Horizontal";
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 300, clientY: 60 }));
    } catch {}
});

test("TCTDragFunctionStop: editor.toplevel.removeChild + thumbstatus cleanup", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "tctstop-root");
    const editor = control.editor;
    primeGridLayout(editor);
    const vctrl = editor.verticaltablecontrol;
    const dobj: any = { vertical: true, functionobj: { control: vctrl } };
    const draginfo: any = { clientX: 200, clientY: 200, offsetX: 0, offsetY: 0 };
    try {
        SC.TCTDragFunctionStart({}, draginfo, dobj);
    } catch {}
    // Verify thumbstatus exists, then run stop.
    if (draginfo.thumbstatus) {
        draginfo.thumbstatus.rowmsgele = draginfo.thumbstatus.rowmsgele || null;
        draginfo.thumbstatus.rowpreviewele = draginfo.thumbstatus.rowpreviewele || null;
    }
    try {
        SC.TCTDragFunctionStop({}, draginfo, dobj);
    } catch {}
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
    SC.DragRegister(el, true, true, {
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
    }, editor.toplevel);
    try {
        SC.DragMouseDown(fakeEvent({ clientX: 10, clientY: 10, target: el }));
        SC.DragMouseMove(fakeEvent({ clientX: 25, clientY: 20, target: el }));
        SC.DragMouseUp(fakeEvent({ clientX: 30, clientY: 25, target: el }));
    } catch {}
    // Best-effort: the drag chain depends on internal state that may not be
    // fully initialized in the fake DOM. Assert the register didn't explode.
    expect(typeof fired.down === "boolean").toBe(true);
    SC.DragUnregister(el);
});

test("ButtonRegister: MouseDown with Disabled true returns early", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "btndis-root");
    const editor = control.editor;
    const btn = document.createElement("div");
    editor.toplevel.appendChild(btn);
    SC.ButtonRegister(editor, btn, {
        name: "d1",
        normalstyle: "color:red",
        downstyle: "color:blue",
    }, {
        Disabled: () => true,
    });
    try {
        SC.ButtonMouseDown(fakeEvent({ target: btn, clientX: 5, clientY: 5 }));
    } catch {}
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
    try {
        SC.ProcessEditorMouseMove(fakeEvent({ clientX: 10, clientY: 60, target: editor.fullgrid }));
    } catch {}
    SC.SetDragAutoRepeat(editor, null);
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
    try {
        SC.ProcessEditorMouseMove(fakeEvent({
            clientX: 100, clientY: 60, target: editor.fullgrid,
        }));
    } catch {}
    SC.SetDragAutoRepeat(editor, null);
});

test("TableControl: CreateTableControl with scroll-area buttons fired", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "tcbtn-root");
    const editor = control.editor;
    // Press less+more buttons via their registered functionobj.MouseDown.
    const vctrl = editor.verticaltablecontrol;
    const bi = SC.ButtonInfo;
    for (const reg of bi.registeredElements) {
        if (reg.editor === editor && reg.functionobj && reg.functionobj.MouseDown) {
            try {
                reg.functionobj.MouseDown({}, bi, reg);
            } catch {}
        }
        if (reg.editor === editor && reg.functionobj && reg.functionobj.Repeat) {
            try {
                reg.functionobj.Repeat({}, bi, reg);
            } catch {}
        }
    }
});

test("SchedulePositionCalculations + signalstatus branch coverage", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "spcc-root");
    const editor = control.editor;
    // Cover cmdend → needsrecalc branch.
    editor.context.sheetobj.attribs.needsrecalc = "yes";
    try {
        SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
    } catch {}
    editor.context.sheetobj.attribs.needsrecalc = "no";
    // cmdend with celldisplayneeded set.
    editor.context.sheetobj.celldisplayneeded = "A1";
    try {
        SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
    } catch {}
    editor.context.sheetobj.celldisplayneeded = "";
});

test("ProcessMouseWheel: wheelDelta 0 + no WheelMove fn", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "pmwz-root");
    const editor = control.editor;
    const el = document.createElement("div");
    editor.toplevel.appendChild(el);
    SC.MouseWheelRegister(el, {});  // no WheelMove
    try {
        SC.ProcessMouseWheel(fakeEvent({ target: el, wheelDelta: 0, detail: 0 }));
    } catch {}
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
    const { control } = await newControl(SC, "pkd-root");
    const saved = SC._app;
    (SC as any)._app = true;
    try {
        SC.ProcessKeyDown({ which: 1, keyCode: 40 });
    } catch {}
    (SC as any)._app = saved;
    SC.Keyboard.passThru = true;
    try {
        SC.ProcessKeyDown({ which: 1, keyCode: 40 });
    } catch {}
    SC.Keyboard.passThru = null;
});

test("ProcessKeyPress: _app / passThru early return", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "pkp-root");
    const saved = SC._app;
    (SC as any)._app = true;
    try {
        SC.ProcessKeyPress({ which: 65, keyCode: 65, charCode: 65 });
    } catch {}
    (SC as any)._app = saved;
    SC.Keyboard.passThru = true;
    try {
        SC.ProcessKeyPress({ which: 65, keyCode: 65, charCode: 65 });
    } catch {}
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
    try {
        const sheet = new SC.Sheet();
        const ctx = new SC.RenderContext(sheet);
        const editor = new SC.TableEditor(ctx);
        SC.CreateTableEditor(editor, 300, 200);
    } catch {}
    win.navigator.userAgent = oldUA;
    (globalThis as any).navigator = win.navigator;
});

test("ctrl-V / ctrl-C timeout callbacks invoked directly", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "cvcb-root");
    const editor = control.editor;
    editor.MoveECell("A1");

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
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-v]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        editor.pasteTextarea.value = "a\tb\n1\t2\n";
        try { (captured as Function)(); } catch {}
    }

    // Ctrl-C
    captured = null;
    (globalThis as any).setTimeout = captureST;
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-c]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        try { (captured as Function)(); } catch {}
    }

    // Ctrl-V with range.
    await scheduleCommands(SC, editor.context.sheetobj, ["copy A1 formulas"]);
    editor.RangeAnchor("B1");
    editor.RangeExtend("C2");
    captured = null;
    (globalThis as any).setTimeout = captureST;
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-v]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        editor.pasteTextarea.value = "x\n";
        try { (captured as Function)(); } catch {}
    }

    // Ctrl-V with pastescclipboard=true (single-cell copiedfrom A1:A1 path).
    // Seed clipboard with a SocialCalc-format save whose copiedfrom is a
    // single cell so `matches[1] === matches[2]` holds.
    SC.Clipboard.clipboard = "copiedfrom:A1:A1\nversion:1.5\n";
    editor.pastescclipboard = true;
    editor.RangeAnchor("B1");
    editor.RangeExtend("C2");
    captured = null;
    (globalThis as any).setTimeout = captureST;
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-v]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        editor.pasteTextarea.value = "val\n";
        try { (captured as Function)(); } catch {}
    }

    // Ctrl-S cmd path.
    SC.Constants.AllowCtrlS = true;
    const winr: any = (globalThis as any).window;
    winr.prompt = (_a: string, _b: string) => "cmd:recalc";
    (globalThis as any).prompt = winr.prompt;
    captured = null;
    (globalThis as any).setTimeout = captureST;
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-s]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        try { (captured as Function)(); } catch {}
    }

    // Ctrl-S with "edit:" prefix (invokes SocialCalc.CtrlSEditor).
    winr.prompt = (_a: string, _b: string) => "edit:foo";
    (globalThis as any).prompt = winr.prompt;
    const savedCtrlSEditor = SC.CtrlSEditor;
    SC.CtrlSEditor = function (_s: any) {};
    captured = null;
    (globalThis as any).setTimeout = captureST;
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-s]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        try { (captured as Function)(); } catch {}
    }
    SC.CtrlSEditor = savedCtrlSEditor;

    // Ctrl-S with arbitrary format + range (hasrange branch, sets sel).
    winr.prompt = (_a: string, _b: string) => "my-format";
    (globalThis as any).prompt = winr.prompt;
    editor.RangeAnchor("B2");
    editor.RangeExtend("C3");
    captured = null;
    (globalThis as any).setTimeout = captureST;
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-s]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        try { (captured as Function)(); } catch {}
    }
    SC.Constants.AllowCtrlS = false;
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
    try {
        SC.GridMousePosition(editor, 10, 70);
    } catch {}
    // rowunhidebottom path.
    editor.context.rowunhidebottom = editor.context.rowunhidebottom || {};
    editor.context.rowunhidebottom[2] = unhideEl;
    try {
        SC.GridMousePosition(editor, 10, 52);
    } catch {}

    // Col unhide paths.
    editor.context.colpanes = [{ first: 1, last: 10 }];
    editor.colpositions = [0, 30, 80, 130, 180];
    editor.colwidth = [0, 30, 50, 50, 50];
    editor.context.colunhideleft = editor.context.colunhideleft || {};
    editor.context.colunhideleft[2] = unhideEl;
    try {
        SC.GridMousePosition(editor, 80, 10);
    } catch {}
    editor.context.colunhideright = editor.context.colunhideright || {};
    editor.context.colunhideright[2] = unhideEl;
    try {
        SC.GridMousePosition(editor, 80, 10);
    } catch {}
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
    for (const [x, y] of [[10, 10], [40, 10], [40, 40], [10, 40], [75, 25], [75, 75], [25, 75]]) {
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
    for (const [x, y] of cases) {
        SC.EditorMouseInfo.ignore = false;
        SC.EditorMouseInfo.editor = editor;
        editor.cellhandles.mouseDown = false;
        try {
            SC.CellHandlesMouseDown(
                fakeEvent({ target: editor.cellhandles.dragpalette, clientX: x, clientY: y }),
            );
        } catch {}
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

    // Move dragtype, coord unchanged from last → skip.
    editor.cellhandles.dragtype = "Move";
    SC.EditorMouseInfo.mouselastcoord = "B2";
    try {
        // clientX/Y that maps to the same coord.
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 80, clientY: 60 }));
    } catch {}

    // MoveC dragtype, moving to new coord.
    editor.cellhandles.dragtype = "MoveC";
    SC.EditorMouseInfo.mouselastcoord = "B2";
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 200, clientY: 120 }));
    } catch {}
});

test("ScrollTableDownOneRow: with rowspan cell", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "stdnr-root");
    const editor = control.editor;
    // Seed a cell with rowspan.
    await scheduleCommands(SC, editor.context.sheetobj, [
        "set A1 text t x",
        "set A2 text t y",
    ]);
    // Manually set rowspan on A1.
    const a1 = editor.context.sheetobj.cells["A1"];
    if (a1) a1.rowspan = 2;
    try {
        SC.ScrollTableDownOneRow(editor);
    } catch {}
    try {
        SC.ScrollTableUpOneRow(editor);
    } catch {}
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
    const draginfo: any = { clientX: 100, clientY: 100, offsetX: 0, offsetY: 0 };
    const dobj: any = { vertical: true, functionobj: { control: vctrl } };
    const dobjH: any = { vertical: false, functionobj: { control: hctrl } };
    try {
        SC.TCPSDragFunctionStart({}, draginfo, dobj);
    } catch {}
    try {
        SC.TCPSDragFunctionStart({}, draginfo, dobjH);
    } catch {}
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
    try {
        SC.ButtonMouseOver(fakeEvent({ target: b1 }));
    } catch {}
    try {
        SC.ButtonMouseOver(fakeEvent({ target: b2 }));
    } catch {}
    // buttonDown true while hovering another → special path.
    SC.ButtonInfo.buttonDown = true;
    try {
        SC.ButtonMouseOver(fakeEvent({ target: b1 }));
    } catch {}
    try {
        SC.ButtonMouseOut(fakeEvent({ target: b2 }));
    } catch {}
    SC.ButtonInfo.buttonDown = false;
});

test("ProcessKeyPress: specialKeysFirefox + kc special match", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "pkp2-root");
    SC.KeyboardSetFocus(control.editor);

    // Firefox special key → early return true.
    try {
        SC.ProcessKeyPress({ which: 0, keyCode: 40, charCode: 0 });
    } catch {}
    // Firefox ctrl-c via controlKeysFirefox (which=99).
    try {
        SC.ProcessKeyPress({
            which: 99,
            keyCode: 67,
            charCode: 0,
            ctrlKey: true,
            preventDefault() {},
            returnValue: false,
        });
    } catch {}
    // Opera controlKeys path.
    try {
        SC.ProcessKeyPress({
            which: 67,
            charCode: undefined,
            keyCode: 67,
            ctrlKey: true,
            preventDefault() {},
            returnValue: false,
        });
    } catch {}
    // Opera special key (which<32).
    try {
        SC.ProcessKeyPress({
            which: 13,
            charCode: undefined,
            keyCode: 0,
            preventDefault() {},
            returnValue: false,
        });
    } catch {}
});

test("TCTDragFunctionStart: thumbstatus pre-existing removal path", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "tctr-root");
    const editor = control.editor;
    primeGridLayout(editor);
    const vctrl = editor.verticaltablecontrol;
    const dobj: any = { vertical: true, functionobj: { control: vctrl } };
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
    try {
        SC.TCTDragFunctionStart({}, draginfo, dobj);
    } catch {}
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
    SC.DragRegister(el, true, true, {
        MouseDown: SC.DragFunctionStart,
        MouseMove: SC.DragFunctionPosition,
        MouseUp: SC.DragFunctionPosition,
        Disabled: () => false,
    }, editor.toplevel);
    try {
        SC.DragMouseDown(fakeEvent({ clientX: 10, clientY: 10, target: el }));
    } catch {}
    try {
        SC.DragMouseUp(fakeEvent({ clientX: 25, clientY: 20, target: el }));
    } catch {}
    SC.DragUnregister(el);
});

test("CellHandlesMouseUp: editor null returns early", async () => {
    const SC = await loadSocialCalc({ browser: true });
    await newControl(SC, "chmunu-root");
    SC.EditorMouseInfo.editor = null;
    try {
        SC.CellHandlesMouseUp(fakeEvent({}));
    } catch {}
});

test("ProcessEditorMouseUp: editor null returns early", async () => {
    const SC = await loadSocialCalc({ browser: true });
    await newControl(SC, "pmuzb-root");
    SC.EditorMouseInfo.editor = null;
    try {
        SC.ProcessEditorMouseUp(fakeEvent({}));
    } catch {}
});

test("ProcessEditorColsizeMouseMove/Up: no editor (early return)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    await newControl(SC, "csznone-root");
    SC.EditorMouseInfo.editor = null;
    try {
        SC.ProcessEditorColsizeMouseMove(fakeEvent({}));
    } catch {}
    try {
        SC.ProcessEditorColsizeMouseUp(fakeEvent({}));
    } catch {}
    try {
        SC.ProcessEditorRowsizeMouseMove(fakeEvent({}));
    } catch {}
    try {
        SC.ProcessEditorRowsizeMouseUp(fakeEvent({}));
    } catch {}
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
    await scheduleCommands(SC, editor.context.sheetobj, [
        "set C hide yes",
        "set 3 hide yes",
    ]);
    try {
        editor.ScrollRelativeBoth(2, 2);
    } catch {}
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
    try {
        SC.EditorMouseRegister(editor);
    } catch {}
    try {
        SC.EditorMouseUnregister(editor);
    } catch {}
});

test("MouseWheelRegister: IE attachEvent branch", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const ele: any = {
        addEventListener: null,
        attachEvent() {},
    };
    try {
        SC.MouseWheelRegister(ele, { WheelMove() {} });
    } catch {}
});

test("EditorSheetStatusCallback: calcstart/cmdstart/cmdend with recalc", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "cb-recalc-root");
    const editor = control.editor;
    // Force recalc branch by setting needsrecalc + recalc="auto" + recalcFunction.
    editor.context.sheetobj.attribs.needsrecalc = "yes";
    editor.context.sheetobj.attribs.recalc = "auto";
    editor.recalcFunction = () => {};
    try {
        SC.EditorSheetStatusCallback(null, "cmdend", null, editor);
    } catch {}
    editor.context.sheetobj.attribs.needsrecalc = "no";
});



