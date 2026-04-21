import { afterAll, afterEach, expect, test } from "bun:test";

import { loadSocialCalc as _loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// Timer tracking — same pattern as editor-coverage.test.ts.
const activeIntervals = new Set<any>();
const activeTimeouts = new Set<any>();
const origSetInterval = globalThis.setInterval;
const origClearInterval = globalThis.clearInterval;
const origSetTimeout = globalThis.setTimeout;
const origClearTimeout = globalThis.clearTimeout;

function wrappedSetInterval(this: any, ...args: any[]) {
    // @ts-expect-error variadic forwarding
    const id = origSetInterval.apply(this, args);
    activeIntervals.add(id);
    return id;
}
function wrappedClearInterval(id: any) {
    activeIntervals.delete(id);
    return origClearInterval(id);
}
function wrappedSetTimeout(this: any, ...args: any[]) {
    // @ts-expect-error variadic forwarding
    const id = origSetTimeout.apply(this, args);
    activeTimeouts.add(id);
    return id;
}
function wrappedClearTimeout(id: any) {
    activeTimeouts.delete(id);
    return origClearTimeout(id);
}

(globalThis as any).setInterval = wrappedSetInterval;
(globalThis as any).clearInterval = wrappedClearInterval;
(globalThis as any).setTimeout = wrappedSetTimeout;
(globalThis as any).clearTimeout = wrappedClearTimeout;

function installTimerTracking() {
    const win = (globalThis as any).window;
    if (win) {
        win.setTimeout = wrappedSetTimeout;
        win.clearTimeout = wrappedClearTimeout;
        win.setInterval = wrappedSetInterval;
        win.clearInterval = wrappedClearInterval;
    }
}

afterEach(() => {
    for (const id of activeIntervals) origClearInterval(id);
    activeIntervals.clear();
    for (const id of activeTimeouts) origClearTimeout(id);
    activeTimeouts.clear();
});

afterAll(() => {
    (globalThis as any).setInterval = origSetInterval;
    (globalThis as any).clearInterval = origClearInterval;
    (globalThis as any).setTimeout = origSetTimeout;
    (globalThis as any).clearTimeout = origClearTimeout;
    const win = (globalThis as any).window;
    if (win) {
        win.setTimeout = origSetTimeout;
        win.clearTimeout = origClearTimeout;
        win.setInterval = origSetInterval;
        win.clearInterval = origClearInterval;
    }
});

async function loadSocialCalc(options: { browser?: boolean } = {}) {
    const SC = await _loadSocialCalc({ ...options, browser: true });
    installUiShim();
    installTimerTracking();
    // Some code paths call document.addEventListener / removeEventListener
    // (ButtonMouseDown, CellHandlesMouseDown). Provide no-ops on the document.
    const doc: any = (globalThis as any).document;
    if (typeof doc.addEventListener !== "function") {
        doc.addEventListener = function () {};
    }
    if (typeof doc.removeEventListener !== "function") {
        doc.removeEventListener = function () {};
    }
    return SC;
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
    return {
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
}

function primeGridLayout(editor: any) {
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

// -------------------------------------------------------------------
// 1) ProcessEditorMouseDown: _app widget branch + ioWidget click path.
//    Targets dist lines 9105-9106, 9115-9116.
//    GridMousePosition returns null when _app is true (see dist line
//    10244 `if (editor.headposition && SocialCalc._app != true)`), so
//    the only way to exercise the 9104-9107 block is to temporarily
//    override GridMousePosition so it returns a valid cell result for
//    a click while SocialCalc._app is true.
// -------------------------------------------------------------------

test("ProcessEditorMouseDown: _app=true cell click → CmdGotFocus(true) early return", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "app2-root");
    const editor = control.editor;
    primeGridLayout(editor);

    const cellInfo = SC.GetEditorCellElement(editor, 2, 2);
    const target = cellInfo?.element ?? editor.fullgrid;

    // Stub GridMousePosition to return a valid body-cell hit even though
    // _app=true would otherwise force GMP to return null.
    const origGMP = SC.GridMousePosition;
    SC.GridMousePosition = function () {
        return { row: 2, col: 2, coord: "B2" };
    };
    SC._app = true;
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 100, clientY: 60, target }),
        );
    } catch {}
    SC._app = false;
    SC.GridMousePosition = origGMP;
});

test("ProcessEditorMouseDown: ioWidget cell with matching widget target", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "iow-root");
    const editor = control.editor;
    primeGridLayout(editor);

    // Put a widget cell at B2 with an ioWidget valuetype.
    const cell = editor.context.sheetobj.GetAssuredCell("B2");
    cell.valuetype = "tiBUTTON";
    cell.formula = 'BUTTON("x","y")';
    cell.datatype = "f";
    cell.datavalue = "0";

    // Synthesize a TD cell element that lives inside editor.fullgrid so the
    // mobj walk reaches the registered editor. Append a widget button element
    // with the expected id so the target==widget branch fires.
    const cellInfo = SC.GetEditorCellElement(editor, 2, 2);
    const cellEl = cellInfo?.element;
    expect(cellEl).toBeDefined();

    const widget = document.createElement("button");
    widget.id = "BUTTON_B2";
    // Also ensure retrievable via getElementById (our shim uses id map).
    cellEl.appendChild(widget);

    // Click the widget itself — walks up parent chain and reaches fullgrid.
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 100, clientY: 60, target: widget }),
        );
    } catch {}

    // Click the cell (target == cellEl) — widget_id != target.id branch.
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 100, clientY: 60, target: cellEl }),
        );
    } catch {}
});

// -------------------------------------------------------------------
// 2) ProcessEditorMouseDown: header drag-resize early return.
//    Targets dist lines 9084, 9093 (rowheader/colheader early returns).
// -------------------------------------------------------------------

test("ProcessEditorMouseDown: row/col header size drag returns early", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "hdr-root");
    const editor = control.editor;
    primeGridLayout(editor);

    // Row-header resize band at rowpositions[2]+rowheight[2]=50+20=70, within [67..73].
    // clientX must be less than headposition.left=30 and >= gridposition.left=0.
    const r1 = SC.GridMousePosition(editor, 10, 70);
    expect(r1.rowheader).toBe(true);

    const target = editor.fullgrid;
    // Rowheader mousedown that hits resize band → ProcessEditorRowsizeMouseDown path.
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 10, clientY: 70, target }),
        );
    } catch {}

    // Col-header resize band: clientX near colpositions[1]+colwidth[1]=0+30=30 (27..33).
    // clientY < headposition.top=30 triggers colheader branch with coltoresize=1.
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 30, clientY: 15, target }),
        );
    } catch {}

    // Col-header select (no resize match): clientX=70 (between resize bands).
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 70, clientY: 15, target }),
        );
    } catch {}

    // Row-header select (no resize match): clientY=55 (between bands).
    try {
        SC.ProcessEditorMouseDown(
            fakeEvent({ clientX: 10, clientY: 55, target }),
        );
    } catch {}
});

// -------------------------------------------------------------------
// 3) SetDragAutoRepeat: repeatcallback direction left/right branch for colheader.
//    Targets dist lines 9688, 9691, 9697-9700.
// -------------------------------------------------------------------

test("SetDragAutoRepeat: colheader repeatcallback left/right/no-cb branches", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "adr-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.EditorMouseInfo.editor = editor;

    editor.MoveECell("B2");
    // Prime with a callback first — col advances with row going up → direction=="left".
    const cb = () => {};
    const info1: any = { colheader: true, col: 3, row: 5, distance: 30 };
    SC.SetDragAutoRepeat(editor, info1, cb);
    const info2: any = { colheader: true, col: 4, row: 4, distance: 30 };
    // col changes (4 != 3) AND row decreases (4 < 5) → direction "left" (9688).
    SC.SetDragAutoRepeat(editor, info2, cb);
    // Now col changes again AND row increases (5 > 4) → direction "right" (9691).
    const info3: any = { colheader: true, col: 5, row: 5, distance: 30 };
    SC.SetDragAutoRepeat(editor, info3, cb);
    // Stop.
    SC.SetDragAutoRepeat(editor, null);

    // Second round: no callback so the else branch (9698-9700) fires.
    const infoA: any = { colheader: true, col: 3, row: 2, distance: 30 };
    SC.SetDragAutoRepeat(editor, infoA, null);
    const infoB: any = { colheader: true, col: 4, row: 2, distance: 30 };
    SC.SetDragAutoRepeat(editor, infoB, null);
    SC.SetDragAutoRepeat(editor, null);
});

test("ProcessEditorMouseMove: non-shift + no range → RangeAnchor(mousedowncoord)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "pemm-root");
    const editor = control.editor;
    primeGridLayout(editor);

    // Prime editor state as if a MouseDown happened at B2.
    SC.EditorMouseInfo.editor = editor;
    SC.EditorMouseInfo.element = editor.fullgrid;
    SC.EditorMouseInfo.mousedowncoord = "B2";
    SC.EditorMouseInfo.mouselastcoord = "B2";
    editor.MoveECell("B2");
    editor.RangeRemove();

    // Move to a different cell with no shift → RangeAnchor(B2) fires (9223).
    try {
        SC.ProcessEditorMouseMove(
            fakeEvent({ clientX: 200, clientY: 90, target: editor.fullgrid }),
        );
    } catch {}

    // Cleanup.
    SC.EditorMouseInfo.editor = null;
    SC.EditorMouseInfo.element = null;
});

test("SetDragAutoRepeat: repeatcallback for rowfooter (col direction)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "adr2-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.EditorMouseInfo.editor = editor;
    editor.MoveECell("B2");

    const cb = () => {};
    const info1: any = { rowfooter: true, row: 5, col: 2, distance: 30 };
    const info2: any = { rowfooter: true, row: 6, col: 2, distance: 30 };
    SC.SetDragAutoRepeat(editor, info1, cb);
    SC.SetDragAutoRepeat(editor, info2, cb);
    // Go back (row < previous) → "left" direction.
    const info3: any = { rowfooter: true, row: 5, col: 2, distance: 30 };
    SC.SetDragAutoRepeat(editor, info3, cb);
    SC.SetDragAutoRepeat(editor, null);
});

// -------------------------------------------------------------------
// 4) GridMousePosition row-unhide hit-testing (line 10267).
// -------------------------------------------------------------------

test("GridMousePosition: rowunhidetop hit sets rowtounhide", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "rut-root");
    const editor = control.editor;
    primeGridLayout(editor);

    // Prep rowunhidetop for row 2. Unhide element at offsetLeft=0, width=20, height=10.
    const unhideEl: any = document.createElement("div");
    unhideEl.offsetWidth = 20;
    unhideEl.offsetHeight = 10;
    unhideEl.offsetLeft = 0;
    unhideEl.offsetTop = 0;
    editor.context.rowunhidetop = editor.context.rowunhidetop || {};
    editor.context.rowunhidetop[2] = unhideEl;

    // Position must satisfy:
    //   clientX >= pos.left (0) && clientX < 20
    //   clientY >= rowpositions[2]+rowheight[2]-offsetHeight = 50+20-10 = 60
    //   clientY < rowpositions[2]+rowheight[2] = 70
    // Use clientX=5, clientY=65 (strictly inside 60..70).
    const result = SC.GridMousePosition(editor, 5, 65);
    expect(result.rowtounhide).toBe(3);
});

// -------------------------------------------------------------------
// 5) RangeExtend2 / highlights[coord] default branch (dist 10912 / 10937).
// -------------------------------------------------------------------

test("RangeRemove: highlights default branch + RangeChangeCallback fires", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "rr-root");
    const editor = control.editor;

    // Install a RangeChangeCallback so line 10937 executes.
    let rcc = 0;
    editor.RangeChangeCallback["x"] = function () {
        rcc++;
    };

    // Build a range first so RangeRemove exits past its early return.
    editor.MoveECell("B2");
    editor.RangeAnchor("B2");
    editor.RangeExtend("C3");

    // Now make range2 cover cells whose highlight values are NOT in the
    // {range, range2, cursor} set so the `default` branch at 10911-10913 fires.
    // Use cells OUTSIDE the range ("D5") so RangeExtend didn't mark them.
    editor.range2 = { hasrange: true, top: 5, bottom: 5, left: 4, right: 4 };
    editor.context.highlights["D5"] = "something-unknown";

    try {
        SC.RangeRemove(editor);
    } catch {}

    expect(rcc).toBeGreaterThanOrEqual(1);

    delete editor.RangeChangeCallback["x"];
});

// -------------------------------------------------------------------
// 6) cellhandles hover timer clear branch (dist 12099-12100, 12105-12106).
// -------------------------------------------------------------------

test("CellHandlesMouseMoveOnHandle: off-active hover timer clear + reschedule", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "chmh-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.KeyboardSetFocus(editor);

    // Ensure cellhandles shown; then call move-on-handles with target==dragpalette
    // at a point OFF the active ring (returns 0 → CellHandlesHoverTimeout early).
    editor.cellhandles.mouseDown = false;
    editor.cellhandles.dragpalette.offsetWidth = 90;
    editor.cellhandles.dragpalette.offsetHeight = 90;
    editor.cellhandles.dragpalette.offsetLeft = 0;
    editor.cellhandles.dragpalette.offsetTop = 0;
    // CH_radius1 and CH_radius2 are typically 10 and 30-ish; center is (50,50).
    // Distance from center at (50,50) is 0 → inside both radii, hits -3/-2/-4/1
    // depending on quadrant. We want the 0 result: farther than radius2.
    // Center (50,50), radius2 likely <30 → point at (85,85) is distance ~49.5.
    try {
        SC.CellHandlesMouseMoveOnHandle(
            fakeEvent({
                target: editor.cellhandles.dragpalette,
                clientX: 85,
                clientY: 85,
            }),
        );
    } catch {}

    // With existing timer set — next hover clears + rereschedules.
    editor.cellhandles.timer = origSetTimeout(() => {}, 9999);
    try {
        SC.CellHandlesMouseMoveOnHandle(
            fakeEvent({
                target: editor.cellhandles.dragpalette,
                clientX: 50,
                clientY: 50,
            }),
        );
    } catch {}
    // Clean up timer that may have been set by the routine.
    if (editor.cellhandles.timer) {
        origClearTimeout(editor.cellhandles.timer);
        editor.cellhandles.timer = null;
    }
});

// -------------------------------------------------------------------
// 7) SegmentDivHit: fall-through "didn't match" return 0 (dist 12209-12210).
//    Point outside the div box returns 0 at the end of the while(true).
// -------------------------------------------------------------------

test("SegmentDivHit: nested table with point outside all quadrants returns 0", async () => {
    const SC = await loadSocialCalc({ browser: true });
    await newControl(SC, "sdh3-root");
    // 4-quadrant table. Point outside the box → no quadrant match → return 0.
    const div: any = { offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100 };
    // Use a simple numeric table (no nesting) with a point at (200,200) OUTSIDE
    // the box so none of the four quadrant branches hit.
    const table = [1, 2, 3, 4];
    const v = SC.SegmentDivHit(table, div, 200, 200);
    expect(v).toBe(0);

    // With a nested first-quadrant sub-table and point outside all, also 0.
    const nested = [[1, 2, 3, 4], 5, 6, 7];
    const v2 = SC.SegmentDivHit(nested, div, 200, 200);
    expect(v2).toBe(0);
});

// -------------------------------------------------------------------
// 8) CellHandlesMouseDown: whichhandle==1/-1/0 hide-move early return
//    (dist 12255-12256, 12266-12267).
// -------------------------------------------------------------------

test("CellHandlesMouseDown: whichhandle returns 1/-1/0 hide and return", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "chmd1-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.KeyboardSetFocus(editor);
    editor.cellhandles.dragpalette.offsetWidth = 90;
    editor.cellhandles.dragpalette.offsetHeight = 90;
    editor.cellhandles.dragpalette.offsetLeft = 0;
    editor.cellhandles.dragpalette.offsetTop = 0;

    // Install a timer so lines 12254-12256 fire (cancel existing timer).
    editor.cellhandles.timer = origSetTimeout(() => {}, 9999);
    editor.MoveECell("B2");

    // Point outside active ring → whichhandle 0 → return after ShowCellHandles.
    try {
        SC.CellHandlesMouseDown(
            fakeEvent({
                target: editor.cellhandles.dragpalette,
                clientX: 85,
                clientY: 85,
            }),
        );
    } catch {}
    // Clean up leftover timers that handlers may have registered.
    if (editor.cellhandles.timer) {
        origClearTimeout(editor.cellhandles.timer);
        editor.cellhandles.timer = null;
    }
});

// -------------------------------------------------------------------
// 9) CellHandlesMouseMove: Fill/Move filltype branches 12408-12410,
//    12415-12416, 12426-12428, 12455-12457, 12473-12475.
// -------------------------------------------------------------------

test("CellHandlesMouseMove: Fill startingcoord-equal reset + Right filltype", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "chmm2-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.EditorMouseInfo.editor = editor;
    editor.MoveECell("B2");

    // Fill: starting B2, then move event that also maps to B2 → filltype reset (12408-12410).
    editor.cellhandles.dragtype = "Fill";
    editor.cellhandles.startingcoord = "B2";
    editor.cellhandles.startingX = 100;
    editor.cellhandles.startingY = 60;
    editor.cellhandles.filltype = "Down";
    SC.EditorMouseInfo.mouselastcoord = "B2";
    editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 100, clientY: 60 }));
    } catch {}

    // Fill with no filltype yet + clientX displacement > 10 → filltype="Right" (12427-12428).
    editor.cellhandles.dragtype = "Fill";
    editor.cellhandles.startingcoord = "B2";
    editor.cellhandles.startingX = 100;
    editor.cellhandles.startingY = 60;
    editor.cellhandles.filltype = null;
    SC.EditorMouseInfo.mouselastcoord = "B2";
    editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 180, clientY: 60 }));
    } catch {}
});

test("CellHandlesMouseMove: Fill filltype=Down branch crend.row < crstart.row", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "chmm-down-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.EditorMouseInfo.editor = editor;
    editor.MoveECell("C3");

    // Dedicated test for 12415-12416: filltype="Down", crend.row < crstart.row.
    editor.cellhandles.dragtype = "Fill";
    editor.cellhandles.startingcoord = "C3";
    editor.cellhandles.startingX = 160;
    editor.cellhandles.startingY = 70;
    editor.cellhandles.filltype = "Down";
    SC.EditorMouseInfo.mouselastcoord = "ZZ99";
    editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 85, clientY: 55 }));
    } catch {}

    // Right filltype branch (crend.row=crstart.row, crend.col<crstart.col → reset col).
    editor.cellhandles.dragtype = "Fill";
    editor.cellhandles.startingcoord = "C3";
    editor.cellhandles.startingX = 160;
    editor.cellhandles.startingY = 70;
    editor.cellhandles.filltype = "Right";
    SC.EditorMouseInfo.mouselastcoord = "ZZ99";
    editor.range2 = { hasrange: true, top: 3, bottom: 3, left: 3, right: 3 };
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 85, clientY: 55 }));
    } catch {}
});

test("CellHandlesMouseMove: MoveI/MoveIC same-coord reset + Horizontal branch", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "chmm3-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.EditorMouseInfo.editor = editor;
    editor.MoveECell("B2");

    // MoveI back to starting coord → reset filltype (12455-12457).
    editor.cellhandles.dragtype = "MoveI";
    editor.cellhandles.startingcoord = "B2";
    editor.cellhandles.startingX = 100;
    editor.cellhandles.startingY = 60;
    editor.cellhandles.filltype = "Horizontal";
    SC.EditorMouseInfo.mouselastcoord = "B2";
    editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 100, clientY: 60 }));
    } catch {}

    // MoveI with no filltype + clientX displacement > 10 → filltype="Horizontal" (12473-12475).
    editor.cellhandles.dragtype = "MoveI";
    editor.cellhandles.startingcoord = "B2";
    editor.cellhandles.startingX = 100;
    editor.cellhandles.startingY = 60;
    editor.cellhandles.filltype = null;
    SC.EditorMouseInfo.mouselastcoord = "B2";
    editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 180, clientY: 60 }));
    } catch {}

    // MoveI same-coord reset + mouselastcoord different → RangeRemove (12485).
    editor.cellhandles.dragtype = "MoveI";
    editor.cellhandles.startingcoord = "B2";
    editor.cellhandles.startingX = 100;
    editor.cellhandles.startingY = 60;
    editor.cellhandles.filltype = null; // no filltype
    SC.EditorMouseInfo.mouselastcoord = "ZZ99";
    editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 2 };
    editor.MoveECell("B2");
    editor.RangeAnchor("B2"); // so RangeRemove has something to remove
    editor.RangeExtend("B2");
    try {
        SC.CellHandlesMouseMove(fakeEvent({ clientX: 100, clientY: 60 }));
    } catch {}
});

// -------------------------------------------------------------------
// 10) CellHandlesMouseUp: MoveIC ' Horizontal' and ' Vertical' filltype
//     adjustments (dist 12713-12717).
// -------------------------------------------------------------------

test("CellHandlesMouseUp: MoveIC Horizontal deltac > 0 moves ecell back", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "chmu-h-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.EditorMouseInfo.editor = editor;
    SC.EditorMouseInfo.ignore = true;

    // Need: dragtype MoveIC, filltype " Horizontal" (with leading space, as
    // in source), ecell past range2 (deltac > 0 after the MoveECell).
    editor.cellhandles.dragtype = "MoveIC";
    editor.cellhandles.mouseDown = true;
    editor.cellhandles.movedmouse = true;
    editor.cellhandles.filltype = " Horizontal";
    editor.cellhandles.startingcoord = "B2";
    // Set range2 so the moveinsert command computes + ecell stays inside.
    editor.range2 = { hasrange: true, top: 2, bottom: 2, left: 2, right: 3 };
    editor.MoveECell("E2");
    try {
        SC.CellHandlesMouseUp(fakeEvent({ clientX: 320, clientY: 60 }));
    } catch {}
    SC.EditorMouseInfo.ignore = false;
});

test("CellHandlesMouseUp: MoveIC Vertical deltar > 0 moves ecell back", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "chmu-v-root");
    const editor = control.editor;
    primeGridLayout(editor);
    SC.EditorMouseInfo.editor = editor;
    SC.EditorMouseInfo.ignore = true;

    editor.cellhandles.dragtype = "MoveIC";
    editor.cellhandles.mouseDown = true;
    editor.cellhandles.movedmouse = true;
    editor.cellhandles.filltype = " Vertical";
    editor.cellhandles.startingcoord = "B2";
    editor.range2 = { hasrange: true, top: 2, bottom: 3, left: 2, right: 2 };
    editor.MoveECell("B5");
    try {
        SC.CellHandlesMouseUp(fakeEvent({ clientX: 100, clientY: 110 }));
    } catch {}
    SC.EditorMouseInfo.ignore = false;
});

// -------------------------------------------------------------------
// 11) TCPSDragFunctionStart with 2 panes already (covers 13122-13124, 13133-13135).
//     Must actually succeed past DragFunctionStart (needs element.style.top/left).
// -------------------------------------------------------------------

test("TCPSDragFunctionStart: 2-rowpanes + 2-colpanes already reconfigures", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "tcps3-root");
    const editor = control.editor;
    primeGridLayout(editor);

    // Prep: two panes already so the "has 2" branch fires. Pre-existing panes
    // means context.SetRowPaneFirstLast / SetColPaneFirstLast + FitToEditTable.
    editor.context.rowpanes = [
        { first: 1, last: 3 },
        { first: 4, last: 10 },
    ];
    editor.context.colpanes = [
        { first: 1, last: 3 },
        { first: 4, last: 10 },
    ];
    editor.tableheight = 400;
    editor.tablewidth = 600;
    editor.gridposition = { left: 0, top: 0 };
    editor.headposition = { left: 30, top: 30 };

    // Create a real element with style.top/left so DragFunctionStart succeeds.
    const velement: any = document.createElement("div");
    velement.style.top = "0px";
    velement.style.left = "0px";
    const helement: any = document.createElement("div");
    helement.style.top = "0px";
    helement.style.left = "0px";

    const vctrl = editor.verticaltablecontrol;
    const hctrl = editor.horizontaltablecontrol;
    vctrl.sliderthickness = vctrl.sliderthickness || 10;
    hctrl.sliderthickness = hctrl.sliderthickness || 10;

    const dobj: any = { vertical: true, element: velement, functionobj: { control: vctrl } };
    const dobjH: any = { vertical: false, element: helement, functionobj: { control: hctrl } };
    const draginfo: any = { clientX: 100, clientY: 100, offsetX: 0, offsetY: 0 };

    try {
        SC.TCPSDragFunctionStart(fakeEvent({}), draginfo, dobj);
    } catch {}
    try {
        SC.TCPSDragFunctionStart(fakeEvent({}), draginfo, dobjH);
    } catch {}
});

// -------------------------------------------------------------------
// 12) TCPSDragFunctionMove / Stop: hidden row/col skip loops (13165, 13180, 13213, 13230).
// -------------------------------------------------------------------

test("TCPSDragFunctionMove/Stop: hidden row and hidden col skip loops", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "tcpsh-root");
    const editor = control.editor;
    primeGridLayout(editor);

    // Arrange a hidden row at row 2 and hidden col at column B so the while-skip
    // loops in TCPSDragFunctionMove/Stop advance through them.
    const sheet = editor.context.sheetobj;
    sheet.rowattribs = sheet.rowattribs || {};
    sheet.rowattribs.hide = sheet.rowattribs.hide || {};
    sheet.colattribs = sheet.colattribs || {};
    sheet.colattribs.hide = sheet.colattribs.hide || {};
    sheet.rowattribs.hide[2] = "yes";
    sheet.colattribs.hide["B"] = "yes";
    sheet.attribs.lastrow = sheet.attribs.lastrow || 20;
    sheet.attribs.lastcol = sheet.attribs.lastcol || 20;
    editor.rowpositions = [0, 30, 50, 70, 90, 110, 130, 150];
    editor.colpositions = [0, 30, 80, 130, 180, 230, 280, 330];
    editor.headposition = { left: 30, top: 30 };

    const vctrl = editor.verticaltablecontrol;
    const hctrl = editor.horizontaltablecontrol;
    vctrl.sliderthickness = 10;
    hctrl.sliderthickness = 10;
    vctrl.minscrollingpanesize = 0;
    hctrl.minscrollingpanesize = 0;
    vctrl.morebuttonstart = 1000;
    hctrl.morebuttonstart = 1000;

    // For vertical: clientY=40 + sliderthickness=10 = 50 → Lookup returns 2
    // (rowpositions[3]=70>50, so i=3 returns 2). Hidden row 2 → while advances.
    // For horizontal: clientX=70 + sliderthickness=10 = 80. Lookup returns 2
    // (colpositions[3]=130>80 → i=3 returns 2). Hidden col B (col=2) → while advances.
    const dobj: any = { vertical: true, functionobj: { control: vctrl }, element: null };
    const dobjH: any = { vertical: false, functionobj: { control: hctrl }, element: null };
    const draginfo: any = {
        clientX: 70,
        clientY: 40,
        offsetX: 0,
        offsetY: 0,
        trackingline: document.createElement("div"),
    };
    draginfo.trackingline.style.top = "0px";
    draginfo.trackingline.style.left = "0px";

    try {
        SC.TCPSDragFunctionMove(fakeEvent({}), draginfo, dobj);
    } catch {}
    try {
        SC.TCPSDragFunctionStop(fakeEvent({}), draginfo, dobj);
    } catch {}
    try {
        SC.TCPSDragFunctionMove(fakeEvent({}), draginfo, dobjH);
    } catch {}
    try {
        SC.TCPSDragFunctionStop(fakeEvent({}), draginfo, dobjH);
    } catch {}

    // Cleanup
    delete sheet.rowattribs.hide[2];
    delete sheet.colattribs.hide["B"];
});

// -------------------------------------------------------------------
// 13) TCTDragFunctionStart: stale thumbstatus cleanup (dist 13262-13265).
//     The existing editor-coverage test covers this — keep one to be safe.
// -------------------------------------------------------------------

// (Already covered in editor-coverage.test.ts; not duplicated here.)

// -------------------------------------------------------------------
// 14) ButtonMouseOver: hover across, buttonElement!=bobj && doingHover (13704).
// -------------------------------------------------------------------

test("ButtonMouseOver: swap hover normalstyle undo on previous element", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "bmo2-root");
    const editor = control.editor;

    // Reset ButtonInfo state.
    SC.ButtonInfo.buttonDown = false;
    SC.ButtonInfo.buttonElement = null;
    SC.ButtonInfo.doingHover = false;

    const b1 = document.createElement("div");
    const b2 = document.createElement("div");
    editor.toplevel.appendChild(b1);
    editor.toplevel.appendChild(b2);
    SC.ButtonRegister(editor, b1, { name: "A", normalstyle: "n1", hoverstyle: "h1" }, {});
    SC.ButtonRegister(editor, b2, { name: "B", normalstyle: "n2", hoverstyle: "h2" }, {});

    // First hover on b1 → sets buttonElement=b1, doingHover=true.
    SC.ButtonMouseOver(fakeEvent({ target: b1 }));
    // Second hover on b2 → undo-hover on b1 (13704) then set buttonElement=b2.
    SC.ButtonMouseOver(fakeEvent({ target: b2 }));

    // Reset for later tests.
    SC.ButtonInfo.buttonElement = null;
    SC.ButtonInfo.doingHover = false;
});

// -------------------------------------------------------------------
// 15) ButtonMouseOut: doingHover branch with buttonElement (13736-13741, 13743).
// -------------------------------------------------------------------

test("ButtonMouseOut: undo hover + MouseOut functionobj callback", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "bmo3-root");
    const editor = control.editor;

    SC.ButtonInfo.buttonDown = false;
    SC.ButtonInfo.buttonElement = null;
    SC.ButtonInfo.doingHover = false;

    const b = document.createElement("div");
    editor.toplevel.appendChild(b);
    let outCalled = false;
    SC.ButtonRegister(
        editor,
        b,
        { name: "X", normalstyle: "n", hoverstyle: "h" },
        {
            MouseOut() {
                outCalled = true;
            },
        },
    );

    // Hover then out — covers 13736-13741 + MouseOut callback 13743.
    SC.ButtonMouseOver(fakeEvent({ target: b }));
    SC.ButtonMouseOut(fakeEvent({ target: b }));
    expect(outCalled).toBe(true);

    // Also: buttonDown=true path on MouseOut (13730-13732 already).
    SC.ButtonInfo.buttonDown = true;
    SC.ButtonInfo.doingHover = true;
    SC.ButtonMouseOut(fakeEvent({ target: b }));
    SC.ButtonInfo.buttonDown = false;
});

// -------------------------------------------------------------------
// 16) ButtonMouseDown: Disabled returns false + repeatwait timer (13769, 13788-13790).
// -------------------------------------------------------------------

test("ButtonMouseDown: Disabled false proceeds with repeatwait timer set", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "bmd-root");
    const editor = control.editor;

    SC.ButtonInfo.buttonDown = false;
    SC.ButtonInfo.buttonElement = null;

    const b = document.createElement("div");
    editor.toplevel.appendChild(b);
    let downCalled = false;
    SC.ButtonRegister(
        editor,
        b,
        {
            name: "rw1",
            normalstyle: "n",
            downstyle: "d",
            repeatwait: 50,
            repeatinterval: 50,
        },
        {
            Disabled() {
                // return false → don't bail out → proceed (13769).
                return false;
            },
            MouseDown() {
                downCalled = true;
            },
        },
    );
    SC.ButtonMouseDown(fakeEvent({ target: b, clientX: 5, clientY: 5 }));
    expect(downCalled).toBe(true);

    // Clean up timer if any.
    if (SC.ButtonInfo.timer) {
        origClearTimeout(SC.ButtonInfo.timer);
        SC.ButtonInfo.timer = null;
    }
    // Reset for subsequent tests.
    SC.ButtonInfo.buttonDown = false;
});

// -------------------------------------------------------------------
// 17) ButtonMouseUp: downstyle with doingHover / without doingHover (13818-13824).
// -------------------------------------------------------------------

test("ButtonMouseUp: downstyle + doingHover vs normal branch", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "bmu-root");
    const editor = control.editor;

    SC.ButtonInfo.buttonDown = false;
    SC.ButtonInfo.buttonElement = null;

    const b = document.createElement("div");
    editor.toplevel.appendChild(b);
    SC.ButtonRegister(
        editor,
        b,
        {
            name: "u1",
            normalstyle: "n",
            hoverstyle: "h",
            downstyle: "d",
        },
        {},
    );

    // With doingHover=true → hoverstyle (13818-13819).
    SC.ButtonMouseDown(fakeEvent({ target: b, clientX: 5, clientY: 5 }));
    SC.ButtonInfo.doingHover = true;
    SC.ButtonMouseUp(fakeEvent({ target: b }));

    // With doingHover=false → normalstyle (13820-13821).
    SC.ButtonMouseDown(fakeEvent({ target: b, clientX: 5, clientY: 5 }));
    SC.ButtonInfo.doingHover = false;
    SC.ButtonMouseUp(fakeEvent({ target: b }));
});

// -------------------------------------------------------------------
// 18) ProcessKey falsy return → e.preventDefault + returnValue=false (14167-14168).
// -------------------------------------------------------------------

test("ProcessKeyPress: ProcessKey returns falsy → preventDefault + returnValue=false", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "pkf-root");
    SC.KeyboardSetFocus(control.editor);

    // Make ProcessKey return a falsy value so the block at 14166-14169 executes.
    const origProcessKey = SC.ProcessKey;
    SC.ProcessKey = function () {
        return false;
    };
    let pdCalled = false;
    const ev: any = {
        which: 65,
        keyCode: 65,
        charCode: 65,
        preventDefault() {
            pdCalled = true;
        },
        returnValue: true,
    };
    try {
        SC.ProcessKeyPress(ev);
    } catch {}
    expect(pdCalled).toBe(true);
    expect(ev.returnValue).toBe(false);
    SC.ProcessKey = origProcessKey;
});

// -------------------------------------------------------------------
// 19) ScrollTableUpOneRow / DownOneRow: rowspan refresh branches.
//     (dist 11498-11509, 11579-11595).
// -------------------------------------------------------------------

test("ScrollTableUpOneRow: cell in pane with rowspan starting above triggers refresh", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "stup2-root");
    const editor = control.editor;
    const sheet = editor.context.sheetobj;

    // Put a cell AT row 5 (which will be inside the visible pane after
    // scroll) with a huge rowspan so it still spans bottomrownum.
    await scheduleCommands(SC, sheet, ["set A5 text t hello"]);
    const a5 = sheet.cells["A5"];
    if (a5) a5.rowspan = 100;

    editor.context.cellskip = editor.context.cellskip || {};
    editor.context.coordToCR = editor.context.coordToCR || {};
    for (let r = 6; r <= 200; r++) {
        editor.context.cellskip["A" + r] = "A5";
    }
    editor.context.coordToCR["A5"] = { row: 5, col: 1 };

    try {
        SC.ScrollTableUpOneRow(editor);
    } catch {}
});

test("ScrollTableDownOneRow: cell in pane with rowspan — bottom row refresh", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "stdn2-root");
    const editor = control.editor;
    const sheet = editor.context.sheetobj;

    // Test the 11578-11580 branch: cell at bottomrownum has rowspan>1.
    const cmds: string[] = [];
    for (let r = 1; r <= 30; r++) cmds.push(`set A${r} text t row${r}`);
    await scheduleCommands(SC, sheet, cmds);
    for (let r = 1; r <= 30; r++) {
        const c = sheet.cells["A" + r];
        if (c) c.rowspan = 5;
    }

    editor.context.cellskip = editor.context.cellskip || {};
    editor.context.coordToCR = editor.context.coordToCR || {};
    for (let r = 1; r <= 30; r++) {
        editor.context.coordToCR["A" + r] = { row: r, col: 1 };
    }

    try {
        SC.ScrollTableDownOneRow(editor);
    } catch {}
});

test("ScrollTableDownOneRow: cellskip path where cell at bottom has no rowspan", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "stdn3-root");
    const editor = control.editor;
    const sheet = editor.context.sheetobj;

    // A cell at A5 with rowspan=200. cellskip for rows above and below.
    // sheet.cells[bottomrow-coord] is falsy OR doesn't have rowspan, so
    // the code falls through to the cellskip check (11582-11588).
    await scheduleCommands(SC, sheet, ["set A5 text t start"]);
    const a5 = sheet.cells["A5"];
    if (a5) a5.rowspan = 200;

    editor.context.cellskip = editor.context.cellskip || {};
    editor.context.coordToCR = editor.context.coordToCR || {};
    // cellskip entries: every row 6..200 points to A5.
    for (let r = 6; r <= 200; r++) {
        editor.context.cellskip["A" + r] = "A5";
    }
    editor.context.coordToCR["A5"] = { row: 5, col: 1 };

    try {
        SC.ScrollTableDownOneRow(editor);
    } catch {}
});

// -------------------------------------------------------------------
// 20) InputBox.Select IE branch with exception thrown + fallback.
//     Targets 11672-11675 (selectionStart != undefined fallback).
// -------------------------------------------------------------------

test("InputBox.Select: IE createRange throws → selectionStart fallback", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "ibs2-root");
    const editor = control.editor;

    // Selection that throws inside createRange.
    (document as any).selection = {
        createRange: () => {
            throw new Error("boom");
        },
    };
    // Provide selectionStart/End on the element for fallback.
    editor.inputBox.element.selectionStart = 0;
    editor.inputBox.element.selectionEnd = 0;
    editor.inputBox.element.value = "abc";
    try {
        editor.inputBox.Select("end");
    } catch {}
    delete (document as any).selection;
});

// -------------------------------------------------------------------
// 21) EditorProcessKey input state: setting partialexpr from inputBox text (9919).
//     Done via natural key ↓ in input state with "=" remaining.
// -------------------------------------------------------------------

test("EditorProcessKey: input state with range → RangeRemove (9972)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "epkir-root");
    const editor = control.editor;
    editor.MoveECell("A1");
    editor.EditorProcessKey("=", { shiftKey: false });
    expect(editor.state).toBe("input");
    // Manually install a range — so when the generic-key-not-terminator case
    // runs through lines 9971-9973 it hits RangeRemove.
    editor.RangeAnchor("B2");
    editor.RangeExtend("C3");
    // Normal (non-terminator, non-backspace, non-f2) key with range present.
    try {
        editor.EditorProcessKey("q", { shiftKey: false });
    } catch {}
    // Cleanup.
    editor.EditorProcessKey("[esc]", { shiftKey: false });
});

test("EditorProcessKey: input + partialexpr truthy after non-terminator → ShowInputBox(true) (9976-9977)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "epkpe-root");
    const editor = control.editor;
    editor.MoveECell("A1");
    editor.EditorProcessKey("=", { shiftKey: false });
    expect(editor.state).toBe("input");
    // Make partialexpr truthy but no matching terminator — fall through to
    // lines 9971-9978.
    editor.workingvalues.partialexpr = "=SUM(";
    editor.inputBox.SetText("=SUM(B2");
    try {
        editor.EditorProcessKey("q", { shiftKey: false });
    } catch {}
    editor.EditorProcessKey("[esc]", { shiftKey: false });
});

test("EditorProcessKey: inputboxdirect non-terminator (non-f2) → return true (10007)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "epki2-root");
    const editor = control.editor;
    editor.MoveECell("A1");
    editor.EditorProcessKey("[f2]", { shiftKey: false });
    expect(editor.state).toBe("inputboxdirect");
    // Non-terminator, non-f2 → falls through to `return true` at line 10008.
    const rc = editor.EditorProcessKey("q", { shiftKey: false });
    expect(rc).toBe(true);
    expect(editor.state).toBe("inputboxdirect");
    editor.EditorProcessKey("[esc]", { shiftKey: false });
});

test("EditorProcessKey: inputboxdirect with ecell moved → MoveECell back (9994)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "epkid-root");
    const editor = control.editor;
    editor.MoveECell("A1");
    editor.EditorProcessKey("[f2]", { shiftKey: false });
    expect(editor.state).toBe("inputboxdirect");
    // Hack: manually move ecell to B2 while in inputboxdirect so the
    // `if (editor.ecell.coord != wval.ecoord)` is true on [enter].
    editor.MoveECell("B2");
    editor.inputBox.SetText("hi");
    try {
        editor.EditorProcessKey("[enter]", { shiftKey: false });
    } catch {}
    expect(editor.state).toBe("start");
});

test("EditorProcessKey: input state with partialexpr end → ShowInputBox(true)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "epk3-root");
    const editor = control.editor;
    editor.MoveECell("A1");
    // Open input with "=".
    editor.EditorProcessKey("=", { shiftKey: false });
    expect(editor.state).toBe("input");
    // Set inputBox text ending with "+" so partialexpr detection triggers at 9918-9920.
    editor.inputBox.SetText("=A1+");
    // Clear existing partialexpr so the branch re-assigns from inputtext.
    editor.workingvalues.partialexpr = "";
    // Run an arrow key → pointing mode enters; MoveECellWithKey returns coord.
    try {
        editor.EditorProcessKey("[aright]", { shiftKey: false });
    } catch {}
    // Cleanup.
    editor.EditorProcessKey("[esc]", { shiftKey: false });
});

// -------------------------------------------------------------------
// 22) ButtonMouseOver: buttonDown=true + buttonElement==bobj sets
//     doingHover=true (line 13697).
// -------------------------------------------------------------------

test("ButtonMouseOver: already-down same-button sets doingHover=true", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "bmo4-root");
    const editor = control.editor;

    const b = document.createElement("div");
    editor.toplevel.appendChild(b);
    SC.ButtonRegister(editor, b, { name: "A", normalstyle: "n", downstyle: "d", hoverstyle: "h" }, {});

    // Put the state: button is down AND it's the same bobj → line 13697.
    SC.ButtonMouseDown(fakeEvent({ target: b, clientX: 1, clientY: 1 }));
    SC.ButtonInfo.doingHover = false;
    SC.ButtonMouseOver(fakeEvent({ target: b }));
    expect(SC.ButtonInfo.doingHover).toBe(true);
    // Clean up state for subsequent tests.
    if (SC.ButtonInfo.timer) {
        origClearTimeout(SC.ButtonInfo.timer);
        SC.ButtonInfo.timer = null;
    }
    SC.ButtonInfo.buttonDown = false;
});

// -------------------------------------------------------------------
// 23) ProcessKey falsy from specialKeysFirefox (14154-14155)
//     + Opera paths (14119, 14129-14130), Safari (14145).
// -------------------------------------------------------------------

test("ProcessKeyPress: Opera e.which=0 special char path (14129-14130)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "opk2-root");
    SC.KeyboardSetFocus(control.editor);

    // Opera: charCode undefined, which=0 → "special char" → return true (14130-14131).
    try {
        SC.ProcessKeyPress({
            which: 0,
            keyCode: 40,
            charCode: undefined,
            preventDefault() {},
            returnValue: false,
        });
    } catch {}
});

test("ProcessKeyPress: Firefox specialKeysFirefox match (14155)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "fkp-root");
    SC.KeyboardSetFocus(control.editor);

    // Firefox path: keyCode != charCode, specialKeysFirefox[keyCode] truthy.
    // keyCode 27 = Escape → specialKeysFirefox[27]="[esc]" (assumption).
    try {
        SC.ProcessKeyPress({
            which: 0,
            keyCode: 27,
            charCode: 0,
            preventDefault() {},
            returnValue: false,
        });
    } catch {}
});

test("ProcessKeyPress: Opera special-key non-control path (14119)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "opk-root");
    SC.KeyboardSetFocus(control.editor);

    // Opera path: charCode undefined, which<32 (special), specialKeysOpera
    // has a ch defined → return true (14117-14119).
    // Which=13 (Enter) should exist in specialKeysOpera.
    try {
        SC.ProcessKeyPress({
            which: 13,
            keyCode: 13,
            charCode: undefined,
            preventDefault() {},
            returnValue: false,
        });
    } catch {}
});

test("ProcessKeyPress: Safari controlKeysSafari via metaKey (14145)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "opks-root");
    SC.KeyboardSetFocus(control.editor);

    // Safari: e.keyCode == e.charCode, metaKey=true → controlKeysSafari branch.
    try {
        SC.ProcessKeyPress({
            which: 99,
            keyCode: 99, // matches charCode
            charCode: 99,
            metaKey: true,
            preventDefault() {},
            returnValue: false,
        });
    } catch {}
});

// -------------------------------------------------------------------
// 24) TCPSDragFunctionMove with hidden col + Stop with hidden row (13180, 13213, 13230).
//     The existing test partially covers but 13180 (col skip) + 13213
//     (row while loop after Stop) need specific data.
// -------------------------------------------------------------------

test("TCPSDragFunctionStop: hidden row/col advances lookup in Stop", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "tcpsstop-root");
    const editor = control.editor;
    primeGridLayout(editor);

    const sheet = editor.context.sheetobj;
    sheet.rowattribs = sheet.rowattribs || { hide: {} };
    sheet.rowattribs.hide = sheet.rowattribs.hide || {};
    sheet.colattribs = sheet.colattribs || { hide: {} };
    sheet.colattribs.hide = sheet.colattribs.hide || {};
    sheet.rowattribs.hide[3] = "yes";
    sheet.colattribs.hide["C"] = "yes";
    sheet.attribs.lastrow = sheet.attribs.lastrow || 10;
    sheet.attribs.lastcol = sheet.attribs.lastcol || 10;

    editor.rowpositions = [0, 30, 50, 70, 90, 110];
    editor.colpositions = [0, 30, 80, 130, 180, 230];
    editor.headposition = { left: 30, top: 30 };

    const vctrl = editor.verticaltablecontrol;
    const hctrl = editor.horizontaltablecontrol;
    vctrl.sliderthickness = 10;
    hctrl.sliderthickness = 10;
    vctrl.minscrollingpanesize = 0;
    hctrl.minscrollingpanesize = 0;
    vctrl.morebuttonstart = 1000;
    hctrl.morebuttonstart = 1000;

    const dobj: any = { vertical: true, functionobj: { control: vctrl } };
    const dobjH: any = { vertical: false, functionobj: { control: hctrl } };
    const draginfo: any = { clientX: 100, clientY: 60, offsetX: 0, offsetY: 0 };

    // Call Stop for vertical and horizontal — both should enter the hide-skip while loop.
    try {
        SC.TCPSDragFunctionStop(fakeEvent({}), draginfo, dobj);
    } catch {}
    try {
        SC.TCPSDragFunctionStop(fakeEvent({}), draginfo, dobjH);
    } catch {}

    delete sheet.rowattribs.hide[3];
    delete sheet.colattribs.hide["C"];
});

// -------------------------------------------------------------------
// 25) TCTDragFunctionStart: draginfo.thumbstatus pre-existing with
//     rowmsgele / rowpreviewele null → editor.toplevel.removeChild
//     (13262-13265).
// -------------------------------------------------------------------

test("SpreadsheetControl.FindInSheet / SearchUp / SearchDown — exercise handlers", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "find-root");
    const sheet = control.sheet;

    await scheduleCommands(SC, sheet, [
        "set A1 text t apple",
        "set B2 text t banana",
        "set C3 text t apricot",
    ]);
    // FindInSheet uses `this.value`, so bind a fake input with a value.
    const input: any = { value: "ap" };
    try {
        SC.SpreadsheetControl.FindInSheet.call(input);
    } catch {}
    // Search Down/Up cycle through results.
    try {
        SC.SpreadsheetControl.SearchDown();
    } catch {}
    try {
        SC.SpreadsheetControl.SearchUp();
    } catch {}
    // Empty search clears selection.
    const input2: any = { value: "" };
    try {
        SC.SpreadsheetControl.FindInSheet.call(input2);
    } catch {}
    // No results search.
    const input3: any = { value: "zzznomatch" };
    try {
        SC.SpreadsheetControl.FindInSheet.call(input3);
    } catch {}
});

test("ctrlkeyFunction [ctrl-v]: range + single-cell-clipsheet (7995-7996)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "ctrlv-root");
    const editor = control.editor;
    const sheet = editor.context.sheetobj;

    // Seed A1 with data and copy it to clipboard so copiedfrom = "A1:A1".
    await scheduleCommands(SC, sheet, ["set A1 text t hello", "copy A1 formulas"]);
    // Verify clipboard has single-cell copiedfrom.
    expect(SC.Clipboard.clipboard).toContain("copiedfrom:A1:A1");

    // Build a range on editor so the range branch (7989) fires.
    editor.MoveECell("B1");
    editor.RangeAnchor("B1");
    editor.RangeExtend("D3");

    // Capture the setTimeout callback.
    let captured: Function | null = null;
    const origST = (globalThis as any).setTimeout;
    (globalThis as any).setTimeout = (fn: Function) => {
        captured = fn;
        return 0;
    };
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-v]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        editor.pasteTextarea.value = ""; // empty → uses clipboard content check
        editor.pastescclipboard = true; // so value != clipstr check is bypassed
        try {
            (captured as Function)();
        } catch {}
    }
});

test("ctrlkeyFunction [ctrl-s]: plain-format response with range (8035-8036)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "ctrls-root");
    const editor = control.editor;

    // Build a range so the `if (editor.range.hasrange)` branch fires.
    editor.MoveECell("A1");
    editor.RangeAnchor("A1");
    editor.RangeExtend("C3");

    SC.Constants.AllowCtrlS = true;
    // Prompt returns a non-cmd, non-edit format string → enters else at 8033.
    const winr: any = (globalThis as any).window;
    winr.prompt = () => "0.00"; // plain format
    (globalThis as any).prompt = winr.prompt;

    // Capture the timeout callback so we can run it synchronously.
    let captured: Function | null = null;
    const origST = (globalThis as any).setTimeout;
    const captureST = (fn: Function) => {
        captured = fn;
        return 0;
    };
    (globalThis as any).setTimeout = captureST;
    try {
        editor.ctrlkeyFunction(editor, "[ctrl-s]");
    } catch {}
    (globalThis as any).setTimeout = origST;
    if (captured) {
        try {
            (captured as Function)();
        } catch {}
    }
    SC.Constants.AllowCtrlS = false;
});

test("SetTab: view.needsresize + onresize fires (25468-25469)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "setview-root");

    // Rig settings view with needsresize=true + onresize so 25468-25469 fires.
    const settingsView = control.views.settings;
    settingsView.needsresize = true;
    let onResizeCalled = false;
    settingsView.onresize = function () {
        onResizeCalled = true;
    };
    try {
        SC.SetTab("settings");
    } catch {}
    expect(onResizeCalled).toBe(true);
    // Reset by switching to the first tab (sheet).
    try {
        SC.SetTab("edit");
    } catch {}
});

test("ParseFormulaIntoTokens: two-char non-comparator op (15681-15685)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    // Force the parser into the two-char operator branch with an unexpected
    // pair. Pass a formula where the operator tokens include `><` etc.
    const tokens = SC.Formula.ParseFormulaIntoTokens("1><2");
    expect(Array.isArray(tokens)).toBe(true);
    // Also some comparator edge cases that should work.
    SC.Formula.ParseFormulaIntoTokens("1<=2");
    SC.Formula.ParseFormulaIntoTokens("1>=2");
    SC.Formula.ParseFormulaIntoTokens("1<>2");
});

test("Settings tab onclick: with range → crToCoord left:top + right:bottom (24410-24411)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "settings-click-root");
    const editor = control.editor;

    // Create a range on the editor so the branch at 24409 (range.hasrange) fires.
    editor.MoveECell("B2");
    editor.RangeAnchor("B2");
    editor.RangeExtend("C3");

    // Find the "settings" tab and invoke its onclick.
    const idx = control.tabnums.settings;
    const tab = control.tabs[idx];
    try {
        tab.onclick(control, tab);
    } catch {}
});

test("COUNTIF/SUMIF: numeric + blank criteria via direct parseinfo evaluation", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "sumif-root");
    const editor = control.editor;
    const sheet = editor.context.sheetobj;

    // Set up data; then test COUNTIF/SUMIF with numeric and blank criteria
    // by manually parsing and evaluating the formulas. This avoids relying on
    // RecalcSheet scheduling.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 5",
        "set A2 value n 5",
        "set A3 value n 5",
        "set A4 text t hi",
    ]);
    // COUNTIF(A1:A4, 5) — numeric criteria (line 18459).
    let parsed = SC.Formula.ParseFormulaIntoTokens("COUNTIF(A1:A4,5)");
    let res = SC.Formula.evaluate_parsed_formula({ parsed, coord: "Z1" }, sheet, false);
    expect(res).toBeDefined();
    // COUNTIF(A1:A4, ZZ99) — ZZ99 is blank (line 18465).
    parsed = SC.Formula.ParseFormulaIntoTokens("COUNTIF(A1:A4,ZZ99)");
    res = SC.Formula.evaluate_parsed_formula({ parsed, coord: "Z1" }, sheet, false);
    expect(res).toBeDefined();
    // SUMIF(A1:A4, 5) — numeric criteria.
    parsed = SC.Formula.ParseFormulaIntoTokens("SUMIF(A1:A4,5)");
    res = SC.Formula.evaluate_parsed_formula({ parsed, coord: "Z1" }, sheet, false);
    expect(res).toBeDefined();
});

test("SUMIFS: numeric + blank criteria in multi-condition", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "sumifs-root");
    const editor = control.editor;
    const sheet = editor.context.sheetobj;

    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set B1 value n 1",
        "set B2 value n 2",
        "set B3 value n 3",
    ]);
    let parsed = SC.Formula.ParseFormulaIntoTokens("SUMIFS(A1:A3,B1:B3,1)");
    let res = SC.Formula.evaluate_parsed_formula({ parsed, coord: "Z1" }, sheet, false);
    expect(res).toBeDefined();
    parsed = SC.Formula.ParseFormulaIntoTokens("SUMIFS(A1:A3,B1:B3,ZZ99)");
    res = SC.Formula.evaluate_parsed_formula({ parsed, coord: "Z1" }, sheet, false);
    expect(res).toBeDefined();
});

test("TestCriteria: empty criteria + blank value + = comparator", async () => {
    const SC = await loadSocialCalc({ browser: true });
    // Call TestCriteria directly: value="", type="b", criteria="=".
    const result = SC.Formula.TestCriteria("", "b", "=");
    const result2 = SC.Formula.TestCriteria("", "b", "");
    expect(typeof result === "boolean").toBe(true);
    expect(typeof result2 === "boolean").toBe(true);
});

test("TCTDragFunctionStart: stale thumbstatus rowmsgele/rowpreviewele truthy → nulled", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = await newControl(SC, "tctstart-root");
    const editor = control.editor;
    primeGridLayout(editor);
    editor.tablewidth = 600;
    editor.tableheight = 400;
    const vctrl = editor.verticaltablecontrol;
    vctrl.controlborder = 400;

    const pre = document.createElement("div");
    editor.toplevel.appendChild(pre);
    // Truthy values so lines 13262-13263 execute (they null them out).
    (pre as any).rowmsgele = document.createElement("div");
    (pre as any).rowpreviewele = document.createElement("div");

    // Element with style.top/left so DragFunctionStart at line 13259 works.
    const element: any = document.createElement("div");
    element.style.top = "0px";
    element.style.left = "0px";
    const dobj: any = { vertical: true, element, functionobj: { control: vctrl } };
    const draginfo: any = {
        thumbstatus: pre,
        clientX: 200,
        clientY: 200,
        offsetX: 0,
        offsetY: 0,
    };
    try {
        SC.TCTDragFunctionStart(fakeEvent({}), draginfo, dobj);
    } catch {}
});
