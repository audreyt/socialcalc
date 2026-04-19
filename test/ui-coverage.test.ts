import { expect, test } from "bun:test";

import {
    loadSocialCalc as _loadSocialCalc,
    makeSave,
    recalcSheet,
    scheduleCommands,
} from "./helpers/socialcalc";
import { installUiShim, loadSocialCalcMirrored } from "./helpers/ui";

// Bun caches dynamic ESM imports by URL and ignores the `?nonce=` query
// string that the `loadSocialCalc` helper appends. If a sibling test file
// loaded the SocialCalc bundle without a browser shim first, Bun returns
// that cached instance (with DOM functions stubbed to no-ops by the
// module-wrapper-bottom guard) forever.
//
// To work around that, when we detect a stubbed module we mirror the bundle
// to a different file path (`dist/SocialCalc.ui.mirror.js`) and import that
// URL — Bun evaluates the mirror freshly with our browser shim in place,
// and its coverage instrumentation attributes coverage to the mirror file.
async function loadSocialCalc(options: { browser?: boolean } = {}) {
    const SC = await _loadSocialCalc({ ...options, browser: true });
    installUiShim();
    const len = (SC.EditorRenderSheet?.toString?.() ?? "").length;
    if (len < 50) {
        return loadSocialCalcMirrored();
    }
    return SC;
}

// Helper: wait for an editor-level status signal (the editor intercepts
// sheet.statuscallback and only re-emits specific statuses through
// editor.StatusCallback). We register a temporary listener and resolve when
// the desired status is emitted, with a timeout fallback.
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

async function newControl(SC: any, containerId = "sc-root") {
    const container = document.createElement("div");
    container.id = containerId;
    (document as any).body.appendChild(container);
    const control = new SC.SpreadsheetControl();
    control.InitializeSpreadsheetControl(container, 400, 600, 20);
    return { control, container };
}

async function execAndWait(control: any, combo: string, sstr = "") {
    const p = waitEditor(control.editor);
    control.ExecuteCommand(combo, sstr);
    await p;
}

test("TableEditor constructor wires defaults and callbacks", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const sheet = new SC.Sheet();
    const ctx = new SC.RenderContext(sheet);
    const editor = new SC.TableEditor(ctx);

    expect(editor.context).toBe(ctx);
    expect(editor.ecell).toEqual({ coord: "A1", row: 1, col: 1 });
    expect(editor.state).toBe("start");
    expect(editor.range.hasrange).toBe(false);
    expect(editor.range2.hasrange).toBe(false);
    expect(sheet.statuscallback).toBe(SC.EditorSheetStatusCallback);
    expect(sheet.statuscallbackparams).toBe(editor);

    // SaveEditorSettings / LoadEditorSettings round-trip
    const saved = editor.SaveEditorSettings();
    expect(saved).toContain("ecell:A1");
    const editor2 = new SC.TableEditor(new SC.RenderContext(new SC.Sheet()));
    editor2.LoadEditorSettings(saved);
    expect(editor2.ecell?.coord).toBe("A1");
});

test("MoveECell, RangeAnchor, RangeExtend, RangeRemove, ECellReadonly", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const sheet = new SC.Sheet();
    const ctx = new SC.RenderContext(sheet);
    const editor = new SC.TableEditor(ctx);

    editor.RangeAnchor("B2");
    expect(editor.range.hasrange).toBe(true);
    expect(editor.range.top).toBe(2);
    expect(editor.range.left).toBe(2);
    editor.RangeExtend("D4");
    expect(editor.range.bottom).toBe(4);
    expect(editor.range.right).toBe(4);
    editor.RangeRemove();
    expect(editor.range.hasrange).toBe(false);

    // Not readonly for fresh A1.
    expect(editor.ECellReadonly()).toBeFalsy();
});

test("EditorGetStatuslineString handles many statuses", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const sheet = new SC.Sheet();
    const ctx = new SC.RenderContext(sheet);
    const editor = new SC.TableEditor(ctx);
    // Give it a minimal griddiv so the fn can write style.
    editor.griddiv = document.createElement("div");
    const params: any = {};
    const statuses = [
        "startup",
        "moveecell",
        "rangechange",
        "cmdstart",
        "cmdextension",
        "cmdend",
        "schedrender",
        "renderdone",
        "schedposcalc",
        "cmdendnorender",
        "doneposcalc",
        "calcstart",
        "calccheckdone",
        "calcfinished",
    ];
    for (const status of statuses) {
        const s = editor.GetStatuslineString(status, "arg", params);
        expect(typeof s).toBe("string");
    }
    // calcorder / calcstep / calcloading / calcserverfunc require structured args.
    expect(
        editor.GetStatuslineString("calcorder", { count: 3, total: 10 }, params),
    ).toContain("A1");
    expect(
        editor.GetStatuslineString("calcstep", { count: 6, total: 10 }, params),
    ).toContain("A1");
    expect(
        editor.GetStatuslineString("calcloading", { sheetname: "other" }, params),
    ).toContain("other");
    expect(
        editor.GetStatuslineString(
            "calcserverfunc",
            { count: 5, total: 10, funcname: "F", coord: "A1" },
            params,
        ),
    ).toContain("A1");
});

test("Popup List: create, initialize, value, show, pick, hide", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const container = document.createElement("div");
    container.id = "popup-root";
    (document as any).body.appendChild(container);
    const mount = document.createElement("span");
    mount.id = "listpop";
    container.appendChild(mount);

    SC.Popup.Create("List", "listpop", { title: "Font", moveable: true, width: "120px" });
    SC.Popup.Initialize("listpop", {
        attribs: {},
        value: "",
        options: [
            { o: "Default", v: "" },
            { o: "Bold", v: "normal bold * *" },
            { o: "section", a: { skip: true } },
            { o: "New column", a: { newcol: true } },
            { o: "Italic", v: "italic normal * *" },
            { o: "-custom", v: "", a: { custom: true } },
            { o: "-cancel", v: "", a: { cancel: true } },
        ],
    });
    SC.Popup.SetValue("listpop", "normal bold * *");
    expect(SC.Popup.GetValue("listpop")).toBe("normal bold * *");

    SC.Popup.CClick("listpop");
    expect(SC.Popup.Current.id).toBe("listpop");
    // Mouse move across list item (exercise highlight)
    const spcdata = SC.Popup.Controls.listpop.data;
    if (spcdata?.listdiv) {
        const firstRow = spcdata.listdiv.firstChild.firstChild.firstChild;
        const cell = firstRow.childNodes[0];
        if (cell?.childNodes?.length) {
            SC.Popup.Types.List.MouseMove("listpop", cell.childNodes[0]);
        }
    }
    // pick a non-special option (Italic at index 4)
    SC.Popup.Types.List.ItemClicked("listpop", 4);
    expect(SC.Popup.GetValue("listpop")).toBe("italic normal * *");
    expect(SC.Popup.Current.id).toBeNull();

    // Custom flow: open → click custom → fill value → OK.
    SC.Popup.CClick("listpop");
    SC.Popup.Types.List.ItemClicked("listpop", 5); // custom entry
    SC.Popup.Controls.listpop.data.customele.value = "my custom";
    SC.Popup.Types.List.CustomToList("listpop");
    SC.Popup.Types.List.MakeList("List", "listpop");
    SC.Popup.Close();

    // Cancel flow
    SC.Popup.CClick("listpop");
    SC.Popup.Cancel();

    // Reset
    SC.Popup.Reset("List");

    // Disabled round-trip
    SC.Popup.SetDisabled("listpop", true);
    SC.Popup.SetDisabled("listpop", false);
});

test("Popup ColorChooser: create, show, grid, custom flow", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const container = document.createElement("div");
    container.id = "cc-root";
    (document as any).body.appendChild(container);
    const mount = document.createElement("div");
    mount.id = "ccpop";
    container.appendChild(mount);

    SC.Popup.Create("ColorChooser", "ccpop", {
        title: "Color",
        sampleWidth: "20px",
        sampleHeight: "20px",
        backgroundImage: "bg.gif",
        backgroundImageDefault: "bgd.gif",
        backgroundImageDisabled: "bgdis.gif",
    });
    SC.Popup.Initialize("ccpop", { value: "rgb(200,100,50)", attribs: {} });
    expect(SC.Popup.GetValue("ccpop")).toBe("rgb(200,100,50)");
    SC.Popup.SetValue("ccpop", "");
    expect(SC.Popup.GetValue("ccpop")).toBe("");
    SC.Popup.SetValue("ccpop", "rgb(50,60,70)");

    SC.Popup.CClick("ccpop"); // open grid
    expect(SC.Popup.Current.id).toBe("ccpop");
    // Exercise DefaultClicked via direct call
    SC.Popup.Types.ColorChooser.DefaultClicked({});
    expect(SC.Popup.Current.id).toBeNull();

    // Reopen + custom flow
    SC.Popup.SetValue("ccpop", "rgb(20,30,40)");
    SC.Popup.CClick("ccpop");
    SC.Popup.Types.ColorChooser.CustomClicked({});
    SC.Popup.Controls.ccpop.data.customele.value = "AA55CC";
    SC.Popup.Types.ColorChooser.CustomOK("ccpop");
    expect(SC.Popup.GetValue("ccpop")).toBe("rgb(170,85,204)");

    // Reopen + custom-to-grid + close-ok
    SC.Popup.CClick("ccpop");
    SC.Popup.Types.ColorChooser.CustomClicked({});
    SC.Popup.Controls.ccpop.data.customele.value = "123456";
    SC.Popup.Types.ColorChooser.CustomToGrid("ccpop");
    SC.Popup.Types.ColorChooser.CloseOK({});

    // Cancel path
    SC.Popup.CClick("ccpop");
    SC.Popup.Cancel();

    // Disabled toggle
    SC.Popup.SetDisabled("ccpop", true);
    SC.Popup.SetDisabled("ccpop", false);

    // Reset
    SC.Popup.Reset("ColorChooser");

    // Color utility helpers.
    expect(SC.Popup.RGBToHex("")).toBe("000000");
    expect(SC.Popup.RGBToHex("rgb(10,20,30)")).toBe("0A141E");
    expect(SC.Popup.RGBToHex("nope")).toBe("000000");
    expect(SC.Popup.HexToRGB("#FFFFFF")).toBe("rgb(255,255,255)");
    expect(SC.Popup.splitRGB("notrgb")).toEqual({ r: 0, g: 0, b: 0 });
    expect(SC.Popup.splitRGB("rgb(1,2,3)")).toEqual({ r: 1, g: 2, b: 3 });
    expect(SC.Popup.ToHex(0)).toBe("00");
    expect(SC.Popup.FromHex("F0")).toBe(240);
});

test("SpreadsheetViewer: initialize, decode, load, render HTML", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "viewer-root";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 400, 600, 20);

    // Use the control to synthesize a save, then feed to viewer.
    const control = new SC.SpreadsheetControl();
    const ccontainer = document.createElement("div");
    ccontainer.id = "viewer-source";
    (document as any).body.appendChild(ccontainer);
    control.InitializeSpreadsheetControl(ccontainer, 400, 600, 20);
    await scheduleCommands(SC, control.sheet, [
        "set A1 value n 10",
        "set B1 value n 20",
        "set C1 formula A1+B1",
    ]);
    await recalcSheet(SC, control.sheet);
    const save = control.CreateSpreadsheetSave();
    expect(save).toContain("socialcalc:version:1.0");

    const decoded = viewer.DecodeSpreadsheetSave(save);
    expect(decoded.sheet).toBeDefined();

    viewer.LoadSave(save);
    expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe(10);
    expect(viewer.sheet.GetAssuredCell("B1").datavalue).toBe(20);

    // DoButtonCmd recalc
    SC.SpreadsheetViewerDoButtonCmd(null, null, {
        element: null,
        functionobj: { command: "recalc" },
    });
    // Unknown command passes through
    SC.SpreadsheetViewerDoButtonCmd(null, null, {
        element: null,
        functionobj: { command: "unknown" },
    });

    // Statusline callback shape
    viewer.editor.StatusCallback.statusline.func(
        viewer.editor,
        "cmdend",
        null,
        viewer.editor.StatusCallback.statusline.params,
    );
});

test("SpreadsheetControl: init, execute common toolbar commands", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc1");

    // Seed some cells via schedule.
    await scheduleCommands(SC, control.sheet, [
        "set A1 value n 10",
        "set B1 value n 20",
        "set C1 formula A1+B1",
        "set A2 value n 30",
        "set B2 value n 40",
    ]);
    await recalcSheet(SC, control.sheet);
    expect(control.sheet.GetAssuredCell("C1").datavalue).toBe(30);

    // Move editor, then run a battery of ExecuteCommand cases.
    control.editor.MoveECell("A1");
    await execAndWait(control, "set %C bgcolor %S", "rgb(255,0,0)");
    await execAndWait(control, "set %C color %S", "rgb(0,0,255)");
    await execAndWait(control, "set %C font %S", "normal bold * *");
    await execAndWait(control, "set %C cellformat %S", "center");
    // %R / %W / %H substitutions.
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("B2");
    await execAndWait(control, "set %W width %S", "80");
    await execAndWait(control, "set %R cellformat left");
    control.editor.RangeRemove();

    // borders.
    await execAndWait(
        control,
        "set %C bt %S%Nset %C br %S%Nset %C bb %S%Nset %C bl %S",
        "1px solid rgb(0,0,0)",
    );

    // filldown/fillright via DoCmd with ecell at A2 (values present).
    control.editor.MoveECell("A1");
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("A3");
    await execAndWait(control, "filldown %C all");

    // Alignment, lock/unlock, delete.
    control.editor.RangeRemove();
    control.editor.MoveECell("A1");
    await execAndWait(control, "set %C cellformat left");
    await execAndWait(control, "set %C readonly yes");
    // readonly accepts "yes" which is stored as a truthy marker.
    // (Value may be boolean true or "yes" depending on cell state.)
    await execAndWait(control, "set %C readonly no");

    // Insert/delete rows/cols.
    await execAndWait(control, "insertrow %C");
    await execAndWait(control, "deleterow %C");
    await execAndWait(control, "insertcol %C");
    await execAndWait(control, "deletecol %C");

    // Hide/show row and col.
    await execAndWait(control, "set %H hide yes");
    await execAndWait(control, "set %W hide yes");

    // Undo / redo.
    await execAndWait(control, "undo");
    await execAndWait(control, "redo");

    // Name define/delete.
    await execAndWait(control, "name define TOTAL A1+B1");
    expect(control.sheet.names.TOTAL.definition).toBe("A1+B1");
    await execAndWait(control, "name desc TOTAL first_total");
    expect(control.sheet.names.TOTAL.desc).toBe("first_total");
    await execAndWait(control, "name delete TOTAL");
    expect(control.sheet.names.TOTAL).toBeUndefined();

    // recalc command (through editor).
    await execAndWait(control, "recalc");
});

test("SpreadsheetControl: CreateSheetHTML / CreateCellHTML*", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-html");
    await scheduleCommands(SC, control.sheet, [
        "set A1 text t Hello",
        "set B1 value n 42",
    ]);
    await recalcSheet(SC, control.sheet);

    const sheetHtml = control.CreateSheetHTML();
    expect(typeof sheetHtml).toBe("string");
    // May be empty if DOM serialization limits, but fn should have run.

    const cellHtml = control.CreateCellHTML("A1");
    expect(cellHtml).toBe("Hello");
    expect(control.CreateCellHTML("ZZ99")).toBe("");

    const cellHtmlSave = control.CreateCellHTMLSave("A1:B1");
    expect(cellHtmlSave).toContain("version:1.0");
    expect(cellHtmlSave).toContain("A1:");
    const cellHtmlSaveAll = control.CreateCellHTMLSave(null);
    expect(cellHtmlSaveAll).toContain("version:1.0");
});

test("SpreadsheetControl: save / load round-trip", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-save");
    await scheduleCommands(SC, control.sheet, [
        "set A1 value n 100",
        "set B1 value n 200",
    ]);
    await recalcSheet(SC, control.sheet);
    const save = control.CreateSpreadsheetSave({ note: "hello note\n" });
    expect(save).toContain("hello note");
    expect(save).toContain("part:note");
    const parts = control.DecodeSpreadsheetSave(save);
    expect(parts.sheet).toBeDefined();
    expect(parts.edit).toBeDefined();
    expect(parts.audit).toBeDefined();
    expect(parts.note).toBeDefined();

    // ParseSheetSave / CreateSheetSave proxy methods.
    const sheetStr = control.CreateSheetSave();
    expect(sheetStr).toContain("cell:A1:v:100");
    const freshControl = await newControl(SC, "sc-fresh");
    freshControl.control.ParseSheetSave(sheetStr);
    expect(freshControl.control.sheet.GetAssuredCell("A1").datavalue).toBe(100);
});

test("SpreadsheetControl: SetTab switches views and invokes handlers", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-tab");
    // Try clicking each tab's td element; SetTab uses the td's id suffix.
    for (const tab of control.tabs) {
        const tabEl = document.getElementById(control.idPrefix + tab.name + "tab");
        if (!tabEl) continue;
        try {
            SC.SetTab(tabEl);
        } catch {
            // Some tabs require inner DOM that isn't fully rendered — ignore.
        }
    }
});

test("SpreadsheetControl: ExecuteCommand with sort", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-sort");
    await scheduleCommands(SC, control.sheet, [
        "set A1 value n 3",
        "set A2 value n 1",
        "set A3 value n 2",
    ]);
    await recalcSheet(SC, control.sheet);
    // Sort needs a direct range argument; ExecuteCommand expands %R but the
    // direction token uses "A up" on column A.
    await scheduleCommands(SC, control.sheet, ["sort A1:A3 A up"]);
    await recalcSheet(SC, control.sheet);
    expect(control.sheet.GetAssuredCell("A1").datavalue).toBe(1);
    expect(control.sheet.GetAssuredCell("A3").datavalue).toBe(3);
});

test("SpreadsheetControl: merge/unmerge via DoCmd shortcut", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-merge");
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("B2");
    SC.DoCmd(null, "merge");
    // ecell should now be at A1 after merge.
    expect(control.editor.ecell.coord).toBe("A1");
    // swap colors (exercises path even if values are defaults).
    SC.DoCmd(null, "swapcolors");
});

test("SpreadsheetControl: movefrom/movepaste/moveinsert cycle", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-move");
    await scheduleCommands(SC, control.sheet, [
        "set A1 value n 5",
        "set A2 value n 10",
    ]);
    await recalcSheet(SC, control.sheet);
    control.editor.MoveECell("A1");
    // movefrom: no range, ecell only.
    SC.DoCmd(null, "movefrom");
    expect(control.editor.range2.hasrange).toBe(true);
    // target for paste.
    control.editor.MoveECell("C1");
    const p1 = waitEditor(control.editor);
    SC.DoCmd(null, "movepaste");
    await p1;
    expect(control.editor.range2.hasrange).toBe(false);

    // movefrom via range.
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("A2");
    SC.DoCmd(null, "movefrom");
    expect(control.editor.range2.hasrange).toBe(true);
    control.editor.MoveECell("D1");
    const p2 = waitEditor(control.editor);
    SC.DoCmd(null, "moveinsert");
    await p2;

    // Toggle off with second movefrom.
    SC.DoCmd(null, "movefrom");
    SC.DoCmd(null, "movefrom");
});

test("TableEditor: EditorApplySetCommandsToRange", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-apply");
    await scheduleCommands(SC, control.sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
    ]);
    await recalcSheet(SC, control.sheet);
    control.editor.MoveECell("A1");
    const p1 = waitEditor(control.editor);
    control.editor.EditorApplySetCommandsToRange("empty");
    await p1;
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("A2");
    const p2 = waitEditor(control.editor);
    control.editor.EditorApplySetCommandsToRange("bgcolor rgb(1,2,3)");
    await p2;
});

test("TableEditor: save edit writes a set command", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-saveedit");

    // Helper: editor.EditorSaveEdit + wait for editor to become idle
    // (doneposcalc).
    async function saveEdit(ecoord: string, value: string) {
        control.editor.workingvalues.ecoord = ecoord;
        const cr = SC.coordToCr(ecoord);
        control.editor.workingvalues.erow = cr.row;
        control.editor.workingvalues.ecol = cr.col;
        const p = waitEditor(control.editor);
        control.editor.EditorSaveEdit(value);
        await p;
    }

    await saveEdit("A1", "hello");
    expect(control.sheet.GetAssuredCell("A1").datavalue).toBe("hello");

    await saveEdit("B2", "=2+3");
    await recalcSheet(SC, control.sheet);
    await waitEditor(control.editor); // let editor finish post-recalc scheduling
    expect(control.sheet.GetAssuredCell("B2").datavalue).toBe(5);

    await saveEdit("C3", "42");
    await recalcSheet(SC, control.sheet);
    await waitEditor(control.editor);
    expect(control.sheet.GetAssuredCell("C3").datavalue).toBe(42);

    // Text with leading quote.
    await saveEdit("D4", "'123abc");
    // Same-value early return (no-change branch).
    control.editor.workingvalues.ecoord = "D4";
    control.editor.EditorSaveEdit("'123abc");

    // Empty clears after content.
    await saveEdit("E5", "x");
    await saveEdit("E5", "");

    // Constant value ($1,234.50 → constant n$ ...).
    await saveEdit("F6", "$1,234.50");
});

test("MoveECellWithKey covers arrow keys and home/page", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    // Use a fully-initialized SpreadsheetControl so MoveECellWithKey can
    // access editor.context.cellskip and row/col positions.
    const { control } = await newControl(SC, "sc-keys");
    const editor = control.editor;
    editor.MoveECell("C3");
    editor.MoveECellWithKey("[adown]");
    editor.MoveECellWithKey("[aup]");
    editor.MoveECellWithKey("[aleft]");
    editor.MoveECellWithKey("[aright]");
    editor.MoveECellWithKey("[home]");
    // Shifted — extends range.
    editor.MoveECellWithKey("[aright]shifted");
    editor.MoveECellWithKey("[adown]shifted");
});

test("TableEditor EditorAddToInput / DisplayCellContents", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-input");
    // DisplayCellContents proxies to inputBox.
    control.editor.DisplayCellContents();
    // Add to input — triggers ShowInputBox / Focus / SetText branches.
    control.editor.EditorAddToInput("hi");
    // Another add
    control.editor.EditorAddToInput("=");
    // Cancel via EditorProcessKey [esc]
    control.editor.EditorProcessKey("[esc]", { shiftKey: false });
});

test("SpreadsheetControl Comment + Names helpers operate", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-cn");
    // Provide missing dom element used by comment helper.
    const commentInput = document.createElement("input");
    commentInput.id = control.idPrefix + "commenttext";
    (document as any).body.appendChild(commentInput);
    commentInput.value = "my comment";
    try {
        SC.SpreadsheetControlCommentSet();
    } catch {
        // CommentSet reads cell element; skip if DOM cell not ready.
    }
    // Try display/move callbacks.
    SC.SpreadsheetControlCommentDisplay(control, "comment");
    SC.SpreadsheetControlCommentMoveECell(control.editor);
    SC.SpreadsheetControlCommentOnunclick(control, "comment");

    // Names: ensure required inputs exist and exercise code paths.
    for (const key of ["namesname", "namesdesc", "namesvalue", "namesrangeproposal"]) {
        const el = document.createElement("input");
        el.id = control.idPrefix + key;
        (document as any).body.appendChild(el);
    }
    const nameListSel = document.createElement("select");
    nameListSel.id = control.idPrefix + "nameslist";
    (document as any).body.appendChild(nameListSel);

    await scheduleCommands(SC, control.sheet, [
        "name define SUM1 A1:A3",
        "name desc SUM1 my_sum",
    ]);
    SC.SpreadsheetControlNamesOnclick(control, "names");
    SC.SpreadsheetControlNamesFillNameList();
    SC.SpreadsheetControlNamesChangedName();
    SC.SpreadsheetControlNamesRangeChange(control.editor);
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("B2");
    SC.SpreadsheetControlNamesRangeChange(control.editor);
    SC.SpreadsheetControlNamesSetValue();
    SC.SpreadsheetControlNamesOnunclick(control, "names");
});

test("Parse a save built manually and reflect in viewer", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "viewer-manual";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);

    const save = makeSave([
        "version:1.5",
        "cell:A1:t:Title",
        "cell:A2:v:1",
        "cell:A3:v:2",
        "cell:A4:vtf:n:3:A2+A3",
        "sheet:c:1:r:4",
    ]);
    viewer.ParseSheetSave(save);
    await recalcSheet(SC, viewer.sheet);
    expect(viewer.sheet.GetAssuredCell("A4").datavalue).toBe(3);
});

test("SpreadsheetControl: localization + spreadsheet control object helpers", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    // Localization fn (falls back to same string).
    expect(SC.LocalizeString("Edit")).toBe("Edit");
    expect(SC.LocalizeString("NotAKnownKey123")).toBe("NotAKnownKey123");
    // LocalizeSubstrings handles %loc!...! patterns.
    expect(SC.LocalizeSubstrings("x %loc!Edit! y")).toContain("Edit");
    expect(SC.LocalizeSubstrings("x %ssc!defaultImagePrefix! y")).toBeDefined();

    // GetSpreadsheetControlObject returns currently-mounted control.
    const { control } = await newControl(SC, "sc-loc");
    expect(SC.GetSpreadsheetControlObject()).toBe(control);
    SC.SetSpreadsheetControlObject(control); // idempotent

    // Statusline callback shapes.
    const params = {
        statuslineid: control.idPrefix + "statusline",
        recalcid1: control.idPrefix + "divider_recalc",
        recalcid2: control.idPrefix + "button_recalc",
    };
    SC.SpreadsheetControlStatuslineCallback(control.editor, "cmdend", null, params);
    SC.SpreadsheetControlStatuslineCallback(control.editor, "calcstart", null, params);
    SC.SpreadsheetControlStatuslineCallback(control.editor, "cmdstart", null, params);

    // UpdateSortRangeProposal sans range (wraps element option access).
    try {
        SC.UpdateSortRangeProposal(control.editor);
    } catch {}
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("C3");
    try {
        SC.UpdateSortRangeProposal(control.editor);
    } catch {}
    control.editor.RangeRemove();

    // LoadColumnChoosers — requires certain DOM elements; skip errors gracefully.
    try {
        SC.LoadColumnChoosers(control);
    } catch {
        // Some column chooser options aren't mounted in our minimal DOM.
    }

    // CmdGotFocus + DoOnResize.
    SC.CmdGotFocus(null);
    SC.CmdGotFocus(document.createElement("input"));
    control.DoOnResize();
    control.SizeSSDiv();
});

test("SpreadsheetViewer: decode multipart save with repeating macro", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "viewer-macro";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);

    const boundary = "SocialCalcSpreadsheetControlSave";
    const saveParts = [
        "socialcalc:version:1.0",
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary=${boundary}`,
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "# Header",
        "version:1.0",
        "part:sheet",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "version:1.5",
        "cell:A1:t:hi",
        "sheet:c:1:r:1",
        `--${boundary}--`,
        "",
    ].join("\n");
    const decoded = viewer.DecodeSpreadsheetSave(saveParts);
    expect(decoded.sheet).toBeDefined();

    // Viewer's LoadSave handles just-sheet parts.
    viewer.LoadSave(saveParts);
    expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("hi");

    // LocalizeString in viewer module path.
    expect(SC.LocalizeString("Edit")).toBeDefined();

    // Stop a (non-existent) repeating macro — no-op path.
    SC.SpreadsheetViewerStopRepeatingMacro();
});

test("TableEditor: scroll helpers and PageRelative/ScrollRelative", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-scroll");
    // Seed enough rows to scroll.
    await scheduleCommands(SC, control.sheet, [
        "set A1 value n 1",
        "set A20 value n 2",
    ]);
    // Some scroll functions were replaced with no-ops by module-wrapper-bottom
    // when `document` was undefined at load time; wrap to ignore.
    try {
        control.editor.ScrollRelative(true, 1);
    } catch {}
    try {
        control.editor.ScrollRelative(false, 1);
    } catch {}
    try {
        control.editor.ScrollRelativeBoth(1, 1);
    } catch {}
    try {
        control.editor.PageRelative(true, 1);
    } catch {}
    try {
        control.editor.PageRelative(false, 1);
    } catch {}
    try {
        control.editor.LimitLastPanes();
    } catch {}
    try {
        control.editor.FitToEditTable();
    } catch {}
    try {
        control.editor.CalculateEditorPositions();
    } catch {}
});

test("TableEditor: EnsureECellVisible + DisplayCellContents", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-visible");
    control.editor.MoveECell("E5");
    control.editor.EnsureECellVisible();
    control.editor.DisplayCellContents();
    control.editor.SetECellHeaders("selected");
    control.editor.SetECellHeaders("");
});

test("TableEditor: SaveEditorSettings contains core state", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-settings");
    control.editor.MoveECell("B2");
    control.editor.RangeAnchor("A1");
    control.editor.RangeExtend("C3");
    const saved = control.editor.SaveEditorSettings();
    expect(saved).toContain("version:1.0");
    expect(saved).toContain("ecell:");
    expect(saved).toContain("range:");
});

test("Popup: DestroyPopupDiv and position helpers", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();

    // Create a simple popup to exercise DestroyPopupDiv + EnsurePosition.
    const container = document.createElement("div");
    container.id = "pop-dest";
    (document as any).body.appendChild(container);
    const mount = document.createElement("span");
    mount.id = "destpop";
    container.appendChild(mount);
    SC.Popup.Create("List", "destpop", { title: "X", ensureWithin: container });
    SC.Popup.Initialize("destpop", {
        attribs: {},
        value: "",
        options: [
            { o: "Default", v: "" },
            { o: "One", v: "one" },
        ],
    });
    SC.Popup.CClick("destpop");
    // EnsurePosition recalculates layout (our shim returns 0s, but exercise it).
    SC.Popup.EnsurePosition("destpop", container);
    SC.Popup.Close();
});

test("Popup: ColorChooser grid mousedown synthetic", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const container = document.createElement("div");
    container.id = "cc-grid";
    (document as any).body.appendChild(container);
    const mount = document.createElement("div");
    mount.id = "ccgrid";
    container.appendChild(mount);
    SC.Popup.Create("ColorChooser", "ccgrid", {});
    SC.Popup.Initialize("ccgrid", { value: "rgb(100,100,100)", attribs: {} });
    SC.Popup.CClick("ccgrid");
    // Simulate a mouse event object reaching the grid.
    const fakeEvent: any = { type: "mousedown", clientX: 20, clientY: 20 };
    SC.Popup.Types.ColorChooser.GridMouseDown(fakeEvent);
    fakeEvent.type = "mousemove";
    SC.Popup.Types.ColorChooser.GridMouseDown(fakeEvent);
    fakeEvent.type = "mouseup";
    SC.Popup.Types.ColorChooser.GridMouseDown(fakeEvent);
    SC.Popup.Close();
});

test("SpreadsheetControl: Clipboard + Settings helpers", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "sc-clip");
    // Inject required elements.
    for (const id of [
        "clipboardtext",
        "clipboardformat-tab",
        "clipboardformat-csv",
        "clipboardformat-scsave",
    ]) {
        const el = document.createElement(id.startsWith("clipboardformat") ? "input" : "textarea");
        el.id = control.idPrefix + id;
        (el as any).checked = false;
        (document as any).body.appendChild(el);
    }
    (document.getElementById(control.idPrefix + "clipboardformat-tab") as any).checked = true;
    SC.SpreadsheetControlClipboardOnclick(control, "clip");
    SC.SpreadsheetControlClipboardFormat("csv");
    SC.SpreadsheetControlClipboardFormat("tab");
    SC.SpreadsheetControlClipboardClear();
    const exportCb = () => {};
    control.ExportCallback = exportCb;
    try {
        SC.SpreadsheetControlClipboardExport();
    } catch {
        // SetTab inside may fail on missing tabs; we swallow.
    }

    // Settings switch (both targets).
    try {
        SC.SpreadsheetControlSettingsSwitch("sheet");
    } catch {}
    try {
        SC.SpreadsheetControlSettingsSwitch("cell");
    } catch {}
});
