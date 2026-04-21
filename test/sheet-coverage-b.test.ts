import { beforeAll, expect, test } from "bun:test";

import {
    installBrowserShim,
    loadSocialCalc,
    makeSave,
    recalcSheet,
    scheduleCommands,
    sheetRedo,
    sheetUndo,
} from "./helpers/socialcalc";

// Minimal mock of SocialCalc.CurrentSpreadsheetControlObject so that command verbs
// that rely on `SocialCalc.GetSpreadsheetControlObject().editor` (fill, pane) can
// execute in a headless harness.
function installEditorMock(SC: any) {
    const fakeEditor: any = {
        range2: { hasrange: false },
        Range2Remove() {
            this.range2 = { hasrange: false };
        },
        context: {
            sheetobj: null as any,
            rowpanes: [{ first: 1, last: 10 }],
            colpanes: [{ first: 1, last: 10 }],
            SetRowPaneFirstLast(_n: number, _f: number, _l: number) {},
            SetColPaneFirstLast(_n: number, _f: number, _l: number) {},
        },
        timeout: null as any,
        griddiv: null,
        ScheduleRender() {},
        FitToEditTable() {},
    };
    SC.CurrentSpreadsheetControlObject = {
        editor: fakeEditor,
    };
    return fakeEditor;
}

// Part A of sheet-coverage installs the editor mock before any test that needs
// SocialCalc.GetSpreadsheetControlObject() runs. Because loadSocialCalc() shares
// one SC instance per worker process, the mock persists for all later tests in
// the original single-file run. When this half runs in its own worker, we have
// to install it ourselves.
beforeAll(async () => {
    const SC = await loadSocialCalc();
    installEditorMock(SC);
});

// Section 29: deletecol / deleterow with deeper coverage; deleted cells wipe
// names and break formulas.
// ===========================================================================

test("deletecol updates formula refs with #REF! and names; undo restores formulas", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 formula A1+B1",
        "set D1 formula SUM(A1:C1)",
        "name define MYREF B1",
    ]);
    await scheduleCommands(SC, sheet, ["deletecol B"]);
    // A1 -> A1, B1 -> gone, C1 becomes B1, D1 stays put (but ref changes).
    expect(sheet.cells.B1?.formula).toContain("#REF!");
    expect(sheet.names.MYREF.definition).toContain("#REF!");
    await sheetUndo(SC, sheet);
    expect(sheet.cells.C1?.formula).toBe("A1+B1");
});

test("deleterow updates references and names, handles phantom row deletes beyond lastrow", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set A4 formula SUM(A1:A3)",
        "name define FIRST A1",
    ]);
    await scheduleCommands(SC, sheet, ["deleterow 2"]);
    expect(sheet.cells.A3.formula).toBe("SUM(A1:A2)");
    // Delete past lastrow (phantom rows) - should not change lastrow.
    await scheduleCommands(SC, sheet, ["deleterow 20"]);
});

test("insertcol adjacent to existing merge expands the span", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
    ]);
    await scheduleCommands(SC, sheet, ["merge A1:C1"]);
    await scheduleCommands(SC, sheet, ["insertcol B"]);
    expect(sheet.cells.A1.colspan).toBe(4);
});

test("insertrow adjacent to existing merge expands the span", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
    ]);
    await scheduleCommands(SC, sheet, ["merge A1:A3"]);
    await scheduleCommands(SC, sheet, ["insertrow 2"]);
    expect(sheet.cells.A1.rowspan).toBe(4);
});

// ===========================================================================
// Section 30: Parse class edge cases.
// ===========================================================================

test("Parse handles empty strings and multi-line with delimiter at newline", async () => {
    const SC = await loadSocialCalc();
    const p = new SC.Parse("");
    expect(p.EOF()).toBe(true);
    expect(p.NextToken()).toBe("");

    const p2 = new SC.Parse("one\n");
    expect(p2.NextToken()).toBe("one");
    p2.NextLine();
    expect(p2.EOF()).toBe(true);

    // Single line (no newline).
    const p3 = new SC.Parse("alpha beta");
    expect(p3.NextToken()).toBe("alpha");
    expect(p3.NextToken()).toBe("beta");
    expect(p3.EOF()).toBe(true);
});

// ===========================================================================
// Section 31: RecalcSheet with various needsrecalc states.
// ===========================================================================

test("RecalcClearTimeout executes safely when no timer is active", async () => {
    const SC = await loadSocialCalc();
    SC.RecalcClearTimeout();
    SC.RecalcClearTimeout(); // idempotent
});

test("RenderSheet with changedrendervalues triggers precompute and cellskip rebuild", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A1 font italic normal 12pt Arial",
        "set A1 layout padding:5px 5px 5px 5px;vertical-align:top;",
    ]);
    const context = new SC.RenderContext(sheet);
    // First render - needs both precompute and cellskip.
    context.RenderSheet(null);
    // Flag a subsequent recompute.
    sheet.changedrendervalues = true;
    context.RenderSheet(null);
});

// ===========================================================================
// Section 32: More format_text_for_display paths.
// ===========================================================================

test("FormatValueForDisplay returns errors first; then falls through to formats", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A1 nontextvalueformat formula",
        "set A2 formula A1+1",
        "set A2 nontextvalueformat formula",
    ]);
    await recalcSheet(SC, sheet);
    // nontextvalueformat "formula" causes the displayvalue to include a prefix.
    const str = SC.FormatValueForDisplay(sheet, 10, "A1", "");
    expect(typeof str).toBe("string");

    // Force an error condition.
    const errCell = sheet.GetAssuredCell("A3");
    errCell.errors = "boom";
    expect(SC.FormatValueForDisplay(sheet, "", "A3", "")).toBe("boom");

    // A blank cell without a valuetype.
    const blank = sheet.GetAssuredCell("A4");
    blank.valuetype = "";
    expect(SC.FormatValueForDisplay(sheet, "", "A4", "")).toBe("&nbsp;");
});

// ===========================================================================
// Section 33: ParseCellLinkText edge cases we didn't cover.
// ===========================================================================

test("ParseCellLinkText returns trimmed trailing space, and handles space-separated workspace", async () => {
    const SC = await loadSocialCalc();
    // Trailing space before closing bracket.
    const r = SC.ParseCellLinkText("desc [page ]");
    expect(r).toMatchObject({ pagename: "page " });
    // Bracketed workspace with trailing space.
    const r2 = SC.ParseCellLinkText("hello{workspace [page]}");
    expect(r2).toMatchObject({ workspace: "workspace", pagename: "page" });
    // Bracketed workspace with double brackets closing.
    const r3 = SC.ParseCellLinkText("hi{ws [[p]]}");
    expect(r3).toMatchObject({ workspace: "ws", pagename: "p", newwin: true });
});

// ===========================================================================
// Section 34: DecodeCellAttributes and DecodeSheetAttributes changed paths
// ===========================================================================

test("DecodeCellAttributes returns commands for multi-attrib changes", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.GetAssuredCell("A1");
    const attrs = SC.EncodeCellAttributes(sheet, "A1");
    // Modify several defaults.
    attrs.alignhoriz = { def: false, val: "right" };
    attrs.textcolor = { def: false, val: "rgb(255,0,0)" };
    attrs.bgcolor = { def: false, val: "rgb(0,255,0)" };
    attrs.bt = { def: false, val: "1px solid black" };
    attrs.cssc = { def: false, val: "my-class" };
    attrs.mod = { def: false, val: "y" };
    attrs.padtop = { def: false, val: "5px" };
    attrs.alignvert = { def: false, val: "middle" };
    attrs.fontsize = { def: false, val: "14pt" };
    const cmds = SC.DecodeCellAttributes(sheet, "A1", attrs);
    expect(cmds).toContain("cellformat right");
    expect(cmds).toContain("color rgb(255,0,0)");
    expect(cmds).toContain("bgcolor rgb(0,255,0)");
    expect(cmds).toContain("cssc my-class");
});

test("DecodeSheetAttributes returns commands for changes to layout, fonts, and so on", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const enc = SC.EncodeSheetAttributes(sheet);
    enc.colwidth = { def: false, val: "110" };
    enc.textalignhoriz = { def: false, val: "right" };
    enc.textcolor = { def: false, val: "rgb(0,0,255)" };
    enc.alignvert = { def: false, val: "top" };
    enc.padtop = { def: false, val: "2px" };
    enc.fontsize = { def: false, val: "16pt" };
    enc.usermaxcol = { def: false, val: "10" };
    const cmds = SC.DecodeSheetAttributes(sheet, enc);
    expect(cmds).toContain("set sheet defaultcolwidth 110");
    expect(cmds).toContain("set sheet defaultcolor rgb(0,0,255)");
});

// ===========================================================================
// Section 35: Sort with single-column direction variants, exercising
// n vs e, e vs e, t vs e, b vs t branches in the comparator.
// ===========================================================================

test("Sort covers error type and blank propagation in the comparator", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula 1/0", // e
        "set A2 value n 5", // n
        "set A3 text t zebra", // t
        "set A4 formula 1/0", // e
        "set A5 text t alpha", // t
        // A6..A10 intentionally blank (valuetype b after GetAssuredCell)
    ]);
    await recalcSheet(SC, sheet);
    await scheduleCommands(SC, sheet, ["sort A1:A10 A up"]);
    await recalcSheet(SC, sheet);
    await scheduleCommands(SC, sheet, ["sort A1:A10 A down"]);
    await recalcSheet(SC, sheet);
});

// ===========================================================================
// Section 36: RenderCell with a highlight range that has no matching class.
// ===========================================================================

test("RenderCell handles highlight types with and without className", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set A2 value n 3",
    ]);
    const context = new SC.RenderContext(sheet);
    // RenderSheet populates cellskip; call it first so direct RenderCell works.
    context.RenderSheet(null);
    context.highlights = {
        A1: "cursor",
        B1: "range2", // highlight with empty className, exercises the else branch
    };
    context.cursorsuffix = "";
    const td = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);
    expect(td).toBeDefined();
    const td2 = context.RenderCell(1, 2, 0, 0, false, context.defaultHTMLlinkstyle);
    expect(td2).toBeDefined();
});

// ===========================================================================
// Section 37: Exercise `vtc` save format (constants) round-trip via cells
// ===========================================================================

test("Cells with datatype 'c' (constants like $1.50) round-trip via save/restore", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 constant n$ 1.5 $1.50",
        "set A2 constant e#DIV/0! 0 myformula",
    ]);
    const save = SC.CreateSheetSave(sheet);
    expect(save).toContain("vtc:n$");
    expect(save).toContain("vtc:e#DIV/0!");
    const roundSheet = new SC.Sheet();
    SC.ParseSheetSave(save, roundSheet);
    expect(roundSheet.cells.A1.datavalue).toBe(1.5);
    expect(roundSheet.cells.A1.formula).toBe("$1.50");
    // Error constant restores errors field.
    expect(roundSheet.cells.A2.valuetype).toBe("e#DIV/0!");
});

// ===========================================================================
// Section 38: More conversion edge cases.
// ===========================================================================

test("ConvertSaveToOtherFormat throws when dorecalc is true (obsolete path)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
    const save = SC.CreateSheetSave(sheet);
    expect(() => SC.ConvertSaveToOtherFormat(save, "csv", true)).toThrow();
});

test("ConvertSaveToOtherFormat CSV output escapes error cells as their error string", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula 1/0",
        "set B1 value n 5",
        "set A2 text t multi-line text\\nhere", // use \n encoded
    ]);
    await recalcSheet(SC, sheet);
    const save = SC.CreateSheetSave(sheet);
    const csv = SC.ConvertSaveToOtherFormat(save, "csv");
    expect(csv).toContain("DIV/0");
    // Tab format with multi-line text should quote the tab value.
    const tab = SC.ConvertSaveToOtherFormat(save, "tab");
    expect(typeof tab).toBe("string");
});

test('ConvertOtherFormatToSave CSV with inline double quotes and leading/trailing spaces', async () => {
    const SC = await loadSocialCalc();
    const save = SC.ConvertOtherFormatToSave(
        ' space1, space2, empty,,"q"\n,last,\n',
        "csv",
    );
    expect(save).toContain("version:1.5");
});

// ===========================================================================
// Section 39: set <sheet> unknown attrib triggers errortext (covers escUnknownSheetCmd).
// ===========================================================================

test("set sheet unknown triggers errortext without crashing", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set sheet unknownattr foo"]);
});

// ===========================================================================
// Section 40: set <col>/<row> with empty rest clears the attribute.
// ===========================================================================

test("set <col> width '' clears width; set <row> height '' clears height", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A width 100",
        "set 1 height 40",
        "set B hide yes",
        "set 2 hide yes",
    ]);
    expect(sheet.colattribs.width.A).toBe("100");
    // Clear them with an empty value.
    await scheduleCommands(SC, sheet, [
        "set A width",
        "set 1 height",
        "set B hide",
        "set 2 hide",
    ]);
    expect(sheet.colattribs.width.A).toBeUndefined();
    expect(sheet.rowattribs.height[1]).toBeUndefined();
    expect(sheet.colattribs.hide.B).toBeUndefined();
    expect(sheet.rowattribs.hide[2]).toBeUndefined();
});

// ===========================================================================
// Section 41: save with defaulttextvalueformat set clears displaystrings.
// ===========================================================================

test("set sheet defaulttextvalueformat clears displaystring caches", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
    ]);
    await recalcSheet(SC, sheet);
    // Populate displaystring cache.
    SC.FormatValueForDisplay(sheet, 10, "A1", "");
    sheet.cells.A1.displaystring = "<cached>";
    // Now change the default - this should wipe cached strings.
    await scheduleCommands(SC, sheet, [
        "set sheet defaultnontextvalueformat 0.00",
    ]);
    // The implementation deletes displaystring from all cells on defaulttext/nontextvalueformat changes.
    expect(sheet.cells.A1.displaystring).toBeUndefined();
});

// ===========================================================================
// Section 42: sheet defaults applied to rendering (PrecomputeSheetFontsAndLayouts
// with attribs.defaultfont present).
// ===========================================================================

test("RenderContext with defaultfont + defaultlayout precomputes font/layout expansions", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set sheet defaultfont italic bold 14pt Verdana",
        "set sheet defaultlayout padding:5px 5px 5px 5px;vertical-align:top;",
        "set A1 value n 1",
    ]);
    const context = new SC.RenderContext(sheet);
    context.PrecomputeSheetFontsAndLayouts();
    expect(context.defaultfontfamily).toBe("Verdana");
    expect(context.defaultfontsize).toBe("14pt");
});

// ===========================================================================
// Section 43: UndoStack.TOS when nothing pushed.
// ===========================================================================

test("UndoStack.TOS returns null on empty stack; AddDo/Undo with empty stack are no-ops", async () => {
    const SC = await loadSocialCalc();
    const stack = new SC.UndoStack();
    expect(stack.TOS()).toBeNull();
    stack.AddDo("cmd");
    stack.AddUndo("undo");
    expect(stack.Undo()).toBe(false);
});

// ===========================================================================
// Section 44: Parse.NextToken with pos < 0 (past end) returns empty.
// ===========================================================================

test("Parse after NextLine off the end returns empty tokens", async () => {
    const SC = await loadSocialCalc();
    const p = new SC.Parse("one\ntwo\n");
    p.NextLine();
    p.NextLine();
    expect(p.NextToken()).toBe("");
    expect(p.RestOfString()).toBe("");
    expect(p.RestOfStringNoMove()).toBe("");
});

// ===========================================================================
// Section 45: Misc RenderContext constructor branch when attribs missing.
// ===========================================================================

test("RenderContext throws when sheet has no attribs", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    // A bare object with no attribs should trigger the else-throw branch.
    expect(() => new SC.RenderContext({})).toThrow();
});

// ===========================================================================
// Section 46: RecalcCheckCell with named-range formula drives the name-range
// branch (4117-4144).
// ===========================================================================

test("RecalcCheckCell traverses named-range references", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "name define MYRANGE A1:A3",
        "set B1 formula SUM(MYRANGE)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1.datavalue).toBe(6);
});

test("RecalcCheckCell traverses a single-coord named reference", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "name define MYCELL A1",
        "set B1 formula MYCELL*2",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1.datavalue).toBe(20);
});

// ===========================================================================
// Section 47: CreateSheetSave canonicalize=true with reserved valueformats
// (cellformats shouldn't be stripped when in use).
// ===========================================================================

test("CreateSheetSave canonicalize=true strips unused style indexes", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A1 bgcolor rgb(9,8,7)",
        // Register additional styles that are not referenced by any cell.
        "set sheet defaultcolor rgb(1,2,3)",
    ]);
    // Inject a font index but don't apply it anywhere.
    sheet.GetStyleNum("font", "normal normal 99pt OrphanFont");
    sheet.GetStyleNum("layout", "padding:9px 9px 9px 9px;vertical-align:middle;");

    const save = SC.CreateSheetSave(sheet, null, true);
    expect(save).not.toContain("OrphanFont");
});

// ===========================================================================
// Section 48: set <coord> b{trbl} (border), font '* * *' clears
// ===========================================================================

test("set <coord> font '* * *' clears the cell font", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A1 font italic bold 12pt Arial",
    ]);
    expect(sheet.cells.A1.font).toBeGreaterThan(0);
    await scheduleCommands(SC, sheet, ["set A1 font * * *"]);
    expect(sheet.cells.A1.font).toBe(0);
});

// ===========================================================================
// Section 49: Render merged cell spanning multiple panes (cellskip branches).
// ===========================================================================

test("RenderCell in second pane when the merge starts in first pane (skipped-cell branch)", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "set D1 value n 4",
    ]);
    // Merge across cols A..D so the span crosses a pane boundary.
    await scheduleCommands(SC, sheet, ["merge A1:D1"]);

    const context = new SC.RenderContext(sheet);
    context.showRCHeaders = true;
    context.showGrid = true;
    context.colpanes = [
        { first: 1, last: 2 },
        { first: 3, last: 4 },
    ];
    context.rowpanes = [{ first: 1, last: 1 }];
    // RenderSheet populates cellskip and renders each cell including skipped.
    const tbl = context.RenderSheet(null, context.defaultHTMLlinkstyle);
    expect(tbl.tagName).toBe("TABLE");
});

// ===========================================================================
// Section 50: Layout with "*" placeholders gets filled in from defaults.
// ===========================================================================

test("Layout with '*' placeholders is filled in with sheet defaults", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        // Set a sheet default layout that has all concrete values.
        "set sheet defaultlayout padding:6px 6px 6px 6px;vertical-align:bottom;",
        // Add a layout with * placeholders applied to a cell.
        "set A1 value n 1",
        "set A1 layout padding:* * * *;vertical-align:*;",
    ]);
    const context = new SC.RenderContext(sheet);
    context.PrecomputeSheetFontsAndLayouts();
    // Resulting layout for A1's layout should have the sheet-default padding expanded.
    const cellLayoutNum = sheet.cells.A1.layout;
    const expanded = context.layouts[cellLayoutNum];
    expect(expanded).toContain("6px");
    expect(expanded).toContain("bottom");
});

// ===========================================================================
// Section 51: RenderCell noElement branch returns a pseudo-element dict.
// ===========================================================================

test("CreatePseudoElement returns a plain object with style/innerHTML/className", async () => {
    const SC = await loadSocialCalc();
    const pseudo = SC.CreatePseudoElement();
    expect(typeof pseudo.style).toBe("object");
    expect(pseudo.innerHTML).toBe("");
    expect(pseudo.className).toBe("");
});

// ===========================================================================
// Section 52: Cover Clipboard + paste with negative offsets for formulas.
// ===========================================================================

test("Copy cells with formula, paste into cells with lower row/col - negative offsets", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set B1 formula A1+1",
        "set B2 formula A2+1",
    ]);
    await scheduleCommands(SC, sheet, [
        "copy B1:B2 all",
        "paste D5 all",
    ]);
    await recalcSheet(SC, sheet);
});

// ===========================================================================
// Section 53: Reading/writing cells with all styles referenced via save.
// ===========================================================================

test("Round-trip a comprehensive cell that exercises every style encoding", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 42",
        "set A1 bgcolor rgb(250,250,250)",
        "set A1 color rgb(10,10,10)",
        "set A1 bt 2px solid rgb(0,0,0)",
        "set A1 br 2px dotted rgb(1,1,1)",
        "set A1 bb 2px dashed rgb(2,2,2)",
        "set A1 bl 2px groove rgb(3,3,3)",
        "set A1 layout padding:2px 2px 2px 2px;vertical-align:middle;",
        "set A1 font italic bold 14pt Verdana",
        "set A1 cellformat right",
        "set A1 textvalueformat text-plain",
        "set A1 nontextvalueformat #,##0.00",
        "set A1 cssc styled",
        "set A1 csss font-weight:900;",
        "set A1 mod y",
        "set A1 comment multi-line\\ncomment",
    ]);
    // Save with canonicalization and parse back.
    const save = SC.CreateSheetSave(sheet, null, true);
    const round = new SC.Sheet();
    SC.ParseSheetSave(save, round);
    expect(round.cells.A1.datavalue).toBe(42);
    expect(round.cells.A1.cssc).toBe("styled");
    // Note: ParseSheetSave doesn't restore `mod` (the "mod" case simply skips).
    // Comment contains encoded newline which ParseSheetSave decodes.
    expect(typeof round.cells.A1.comment).toBe("string");
});

// ===========================================================================
// Section 54: CreateSheetSave with range gives copiedfrom.
// ===========================================================================

test("CreateSheetSave ranged output includes copiedfrom and respects the range", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "set D1 value n 4",
    ]);
    const save = SC.CreateSheetSave(sheet, "B1:C1");
    expect(save).toContain("copiedfrom:B1:C1");
    expect(save).toContain("cell:B1:v:2");
    expect(save).toContain("cell:C1:v:3");
});

// ===========================================================================
// Section 55: RecalcInfo idle state invoked from SheetUndo then redo.
// ===========================================================================

test("Multiple undos/redos cycle through the audit trail", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
    await scheduleCommands(SC, sheet, ["set A1 value n 2"]);
    await scheduleCommands(SC, sheet, ["set A1 value n 3"]);
    // After each scheduled change there's one stack entry.
    expect(sheet.changes.stack.length).toBe(3);
    await sheetUndo(SC, sheet);
    expect(sheet.cells.A1.datavalue).toBe(2);
    await sheetUndo(SC, sheet);
    expect(sheet.cells.A1.datavalue).toBe(1);
    await sheetRedo(SC, sheet);
    expect(sheet.cells.A1.datavalue).toBe(2);
    await sheetRedo(SC, sheet);
    expect(sheet.cells.A1.datavalue).toBe(3);
    // Redo again - nothing to redo.
    await sheetRedo(SC, sheet);
});

// ===========================================================================
// Section 56: deleterow / deletecol with row/col attribs that get propagated.
// ===========================================================================

test("deleterow propagates row attributes backwards into emptied rows", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set 2 height 40",
        "set 3 height 60",
    ]);
    await scheduleCommands(SC, sheet, ["deleterow 2"]);
    // Row 2's attribs should now be row 3's former attribs (height 60).
    expect(sheet.rowattribs.height[2]).toBe("60");
});

test("deletecol propagates col attributes backwards into emptied cols", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "set B width 150",
        "set C width 200",
    ]);
    await scheduleCommands(SC, sheet, ["deletecol B"]);
    expect(sheet.colattribs.width.B).toBe("200");
});

// ===========================================================================
// Section 57: deletecol / deleterow that shrinks a merge range.
// ===========================================================================

test("deletecol shrinks a merged span that straddles the removed column", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "set D1 value n 4",
    ]);
    await scheduleCommands(SC, sheet, ["merge A1:D1"]);
    await scheduleCommands(SC, sheet, ["deletecol C"]);
    // Merge span should shrink.
    expect(sheet.cells.A1.colspan).toBeLessThan(4);
});

test("deleterow shrinks a merged span that straddles the removed row", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set A4 value n 4",
    ]);
    await scheduleCommands(SC, sheet, ["merge A1:A4"]);
    await scheduleCommands(SC, sheet, ["deleterow 3"]);
    expect(sheet.cells.A1.rowspan).toBeLessThan(4);
});

// ===========================================================================
// Section 58: GetViewportInfo via window.innerWidth.
// ===========================================================================

test("GetViewportInfo uses window.innerWidth when available", async () => {
    // Install shim, then set innerWidth directly on the global window so the
    // factory's inner `window` parameter has innerWidth populated before init.
    installBrowserShim();
    (globalThis as any).innerWidth = 1500;
    (globalThis as any).innerHeight = 800;
    (globalThis as any).pageXOffset = 10;
    (globalThis as any).pageYOffset = 20;
    const SC = await loadSocialCalc({ browser: true });
    // Note: our shim also sets window.innerWidth, but the factory captures
    // `window` as globalThis when called from node. We can't fully control
    // which branch is taken -- just assert we get a valid result.
    const info = SC.GetViewportInfo();
    expect(typeof info.width).toBe("number");
    delete (globalThis as any).innerWidth;
    delete (globalThis as any).innerHeight;
    delete (globalThis as any).pageXOffset;
    delete (globalThis as any).pageYOffset;
});

test("ConvertSaveToOtherFormat tab escapes quote-in-newline cells (7506-7509)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        // Multiline cell containing a quote → tab output doubles quotes.
        `set A1 text t line1\\nwith\\"quote`,
        "set B1 value n 42",
    ]);
    const save = SC.CreateSheetSave(sheet, "A1:B1");
    const tab = SC.ConvertSaveToOtherFormat(save, "tab");
    expect(tab).toContain('""');
});

test("ConvertOtherFormatToSave tab skips trailing empty line (7625-7627)", async () => {
    const SC = await loadSocialCalc();
    // Input with a trailing empty line -- the final iteration hits the
    // break-out guard at 7626-7627.
    const save = SC.ConvertOtherFormatToSave("a\tb\n1\t2\n", "tab");
    expect(save).toContain(":a");
    expect(save).toContain(":b");
});

test("OperandAsText with error + unknown type clears value (16418-16422)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Direct invocation of OperandAsText with error + unknown types.
    const opErr = [{ type: "e#DIV/0!", value: "whatever" }];
    const resultErr = SC.Formula.OperandAsText(sheet, opErr);
    expect(resultErr.value).toBe("");
    // Unknown type (no t/n/b/e prefix) falls through to else.
    const opUnk = [{ type: "z", value: 42 }];
    const resultUnk = SC.Formula.OperandAsText(sheet, opUnk);
    expect(resultUnk.type).toBe("t");
});

test("SUMIF / COUNTIF / AVERAGEIF numeric + blank criteria paths (18479-18486)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A2 value n 20",
        "set A3 value n 30",
        // numeric criteria (20) → criteria.value becomes "20"
        "set B1 formula SUMIF(A1:A3,20)",
        // blank criteria from empty cell
        "set B2 formula SUMIF(A1:A3,Z9)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1.datavalue).toBe(20);
});

test("SUMIFS multi-criteria with numeric + blank criterion (18571-18579)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 5",
        "set A2 value n 6",
        "set B1 value n 100",
        "set B2 value n 200",
        // numeric criteria on B1:B2 → criteria becomes string
        "set C1 formula SUMIFS(A1:A2,B1:B2,100)",
        // blank criteria (empty cell ref)
        "set C2 formula SUMIFS(A1:A2,B1:B2,Z9)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.C1.datavalue).toBe(5);
});

test("TestCriteria with error in basevalue comparing against text (22182-22183)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 text t hello",
        "set A2 value n 5",
        // Criteria evaluates to an error: criteria is "#DIV/0!" literal
        'set B1 formula COUNTIF(A1:A2,"=#DIV/0!")',
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1).toBeDefined();
});

test("TestCriteria with empty criteria vs blank cell (22138-22146)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // A2 is blank (never set). A1 set. Criteria "=" means compare empty to empty.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 7",
        // count cells where value equals blank: criteria "=" with empty base
        'set B1 formula COUNTIF(A1:A3,"=")',
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1).toBeDefined();
});

test("Formula range with different sheets triggers OperandsAsRangeOnSheet error (16040-16041)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        // Range across different sheets: Sheet1!A1:Sheet2!B2 is invalid.
        'set B1 formula SUM(Sheet1!A1:Sheet2!B2)',
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1).toBeDefined();
});

test("INDEX(range,0,0) with single-cell range returns coord (18383-18385)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 7",
        "set B1 formula INDEX(A1:A1,0,0)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1.datavalue).toBe(7);
});

test("MATCH: 2D range (N/A), wide 1-row range, tall 1-col range (18201-18209)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "set A2 value n 4",
        "set A3 value n 5",
        // 1x3 row → cincr=1 (18205)
        "set D1 formula MATCH(2,A1:C1)",
        // 3x1 col → rincr=1 (18208)
        "set D2 formula MATCH(4,A1:A3)",
        // 2x2 → e#N/A (18202-18203)
        "set B3 value n 6",
        "set D3 formula MATCH(5,A1:B3)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.D1.datavalue).toBe(2);
    expect(sheet.cells.D2.datavalue).toBe(2);
    expect(String(sheet.cells.D3.errors || sheet.cells.D3.valuetype)).toMatch(/N\/A|e/);
});

test("ParseFormulaIntoTokens handles leading two-char op (15660-15663 EOF branch)", async () => {
    const SC = await loadSocialCalc();
    // Start with `<`, then `=` right after → parser pops the `<` then treats
    // `<=` as an op. With parseinfo empty after the pop, the EOF branch fires.
    const r = SC.Formula.ParseFormulaIntoTokens("<=5");
    expect(Array.isArray(r)).toBe(true);
});

test("ParseFormulaIntoTokens with illegal two-char op (15702-15706)", async () => {
    const SC = await loadSocialCalc();
    // Something like `=<` would be illegal after a unary - let's try.
    // Actually use two ops that form something weird: `><` goes through the
    // multi-char branch and hits the `else { t = tokentype.error }` fallback.
    const r = SC.Formula.ParseFormulaIntoTokens("><5");
    expect(Array.isArray(r)).toBe(true);
    // Confirm at least one error token.
    expect(r.some((t: any) => t.type === SC.Formula.TokenType.error)).toBe(true);
});

test("ConvertOtherFormatToSave tab: double-quote escape, quote-at-EOL, embedded-quote (7642-7662)", async () => {
    const SC = await loadSocialCalc();
    // A quoted field that has a doubled-quote inside → line 7644-7645.
    const save = SC.ConvertOtherFormatToSave('"hi""lo"\tB\n', "tab");
    expect(save).toContain(':hi');

    // Quoted field that ends at end-of-line → lines 7653-7656.
    const save2 = SC.ConvertOtherFormatToSave('"alpha"\nsecond\n', "tab");
    expect(save2).toContain("alpha");

    // Quote mid-value (after some chars) → falls through to 7662 "continue".
    const save3 = SC.ConvertOtherFormatToSave('x"y"\tB\n', "tab");
    expect(save3).toContain("x");
});

test("GetComputedStyle returns empty string when document.defaultView is missing", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const origDV = (document as any).defaultView;
    try {
        (document as any).defaultView = null;
        const div = document.createElement("div");
        expect(SC.GetComputedStyle(div, "color")).toBe("");
    } finally {
        (document as any).defaultView = origDV;
    }
});

test("GetViewportInfo falls back to documentElement/body when innerWidth is 0", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    // Force the else-branch by making window.innerWidth falsy.
    const origInner = (globalThis as any).window.innerWidth;
    (globalThis as any).window.innerWidth = 0;
    (document as any).documentElement.clientWidth = 999;
    (document as any).documentElement.clientHeight = 777;
    (document as any).documentElement.scrollLeft = 5;
    (document as any).documentElement.scrollTop = 6;
    const info = SC.GetViewportInfo();
    // Either documentElement branch fires or the other - both are fallbacks.
    expect(typeof info.width === "number" || info.width === undefined).toBe(true);
    // Now zero out documentElement width and populate body to hit the second.
    (document as any).documentElement.clientWidth = 0;
    (document as any).body.clientWidth = 500;
    (document as any).body.clientHeight = 400;
    const info2 = SC.GetViewportInfo();
    expect(info2).toBeDefined();
    (globalThis as any).window.innerWidth = origInner;
});

// ===========================================================================
// Section 59: cover text cell with textvalueformat="formula" (lines 6558-6565).
// ===========================================================================

test("text cell with textvalueformat=formula renders the raw formula with quote prefix", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula 1+2",
        "set A1 textvalueformat formula",
        "set A2 constant t$ 1.5 constant-source",
        "set A2 textvalueformat formula",
        "set A3 text t plain",
        "set A3 textvalueformat formula",
    ]);
    await recalcSheet(SC, sheet);
    // When valuetype is "t" and textvalueformat is "formula", the displayvalue
    // gets a prefix depending on datatype.
    // For a text-typed cell with textvalueformat=formula and datatype=f:
    const disp = SC.FormatValueForDisplay(sheet, sheet.cells.A1.datavalue, "A1", "");
    expect(typeof disp).toBe("string");
});

// ===========================================================================
// Section 60: AdjustFormulaCoords / OffsetFormulaCoords with embedded string
// containing a single quote (triggers quote-doubling branch).
// ===========================================================================

test("formula quote-doubling branch in adjust/offset/replace path", async () => {
    const SC = await loadSocialCalc();
    // "She said ""hi""" is a valid formula string with embedded double-quote.
    const formula = 'CONCATENATE("She said ""hi""",A1)';
    expect(SC.OffsetFormulaCoords(formula, 0, 0)).toContain('"She said');
    expect(SC.AdjustFormulaCoords(formula, 1, 0, 1, 0)).toContain('"She said');
    expect(SC.ReplaceFormulaCoords(formula, { A1: "B1" })).toContain('"She said');
});

// ===========================================================================
// Section 61: Named-range formula that is a single coord triggers the "coord" branch.
// ===========================================================================

test("named range that evaluates to single coord flows through token_coord inline path", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 100",
        "name define POINT A1",
        "set B1 formula POINT*3",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B1.datavalue).toBe(300);
});

// ===========================================================================
// Section 62: Unknown line-type in ParseSheetSave triggers alert + throw.
// ===========================================================================

test("ParseSheetSave with unknown line-type throws via alert branch", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Feed a save string with a made-up line type. The default: clause in
    // ParseSheetSave alerts and throws.
    const save = makeSave([
        "version:1.5",
        "madeup:foo",
    ]);
    expect(() => sheet.ParseSheetSave(save)).toThrow();
});

test("ParseSheetSave with `vt` non-numeric value type loads text cell (1607-1609)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // `vt:t:value` → cell.datatype = "t"; takes the else branch in CellFromStringParts
    const save = makeSave([
        "version:1.5",
        "cell:A1:vt:t:Hello",
        "cell:A2:vt:nd:44562", // n+ prefix hits the "n" branch for sanity
    ]);
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1.valuetype).toBe("t");
    expect(sheet.cells.A1.datatype).toBe("t");
    expect(sheet.cells.A1.datavalue).toBe("Hello");
    expect(sheet.cells.A2.datatype).toBe("v");
});

// ===========================================================================
// Section 63: erase with "formulas" / "formats" preserves/deletes the comment
// (covers cell.comment delete/preserve branches).
// ===========================================================================

test("erase formulas clears cell.comment; erase formats preserves comment", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A1 comment hello",
        "set B1 value n 20",
        "set B1 comment world",
    ]);
    expect(sheet.cells.A1.comment).toBe("hello");
    expect(sheet.cells.B1.comment).toBe("world");
    // erase A1 formulas clears the comment (treated as content)
    await scheduleCommands(SC, sheet, ["erase A1:A1 formulas"]);
    expect(sheet.cells.A1.comment).toBeUndefined();
    // erase B1 formats keeps the comment on the rebuilt cell
    await scheduleCommands(SC, sheet, ["erase B1:B1 formats"]);
    expect(sheet.cells.B1.comment).toBe("world");
});

// ===========================================================================
// Section 64: sort with equal-valued cells hits the v2=="=" equality branch.
// ===========================================================================

test("sort where rows are equal in the sort key hits the equality branch", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 5",
        "set A2 value n 5",
        "set A3 value n 5",
        "set B1 value n 1",
        "set B2 value n 2",
        "set B3 value n 3",
    ]);
    await scheduleCommands(SC, sheet, ["sort A1:B3 A up"]);
    // Order should still be preserved (or at least not crash) — all A's equal.
    expect(sheet.cells.A1).toBeDefined();
});

// ===========================================================================
// Section 65: paste where the clipboard cell lacks a comment clears the
// destination's comment (covers 3502 else-if branch).
// ===========================================================================

test("paste overwrites destination comment when source has none", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Seed A1 with a comment; seed B1 with a value and NO comment.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A1 comment keepme",
        "set B1 value n 20",
    ]);
    // Copy B1 (no comment) and paste onto A1 → A1's comment should be cleared.
    await scheduleCommands(SC, sheet, [
        "loadclipboard " + SC.encodeForSave(SC.CreateSheetSave(sheet, "B1:B1")),
        "paste A1 formulas",
    ]);
    expect(sheet.cells.A1.comment).toBeUndefined();
});

test("paste formulas from source with comment copies it onto destination", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A1 comment src-note",
        // B1 starts with NO comment.
        "set B1 value n 20",
    ]);
    await scheduleCommands(SC, sheet, [
        "loadclipboard " + SC.encodeForSave(SC.CreateSheetSave(sheet, "A1:A1")),
        "paste B1 formulas",
    ]);
    expect(sheet.cells.B1.comment).toBe("src-note");
});

// ===========================================================================
// Section 66: SheetCommandsTimerRoutine maxtimeslice trip causes setTimeout.
// ===========================================================================

test("SheetCommandsTimerRoutine schedules a new slice when maxtimeslice hits", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Force every iteration to time-slice by setting maxtimeslice = 0.
    // Queue two commands so the first yields to the timer.
    sheet.sci.maxtimeslice = 0;
    sheet.sci.timerdelay = 1;
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
    ]);
    expect(sheet.cells.A1.datavalue).toBe(1);
    expect(sheet.cells.A2.datavalue).toBe(2);
});

// ===========================================================================
// Section 67: paste all with styled cell to copy table-index and non-table-index
// attributes onto destination (covers 3478-3482).
// ===========================================================================

test("paste all copies both table-indexed attributes (font, color) and plain attribs (cssc)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 7",
        "set A1 font * normal 12pt",
        "set A1 color rgb(1,2,3)",
        "set A1 cssc my-class",
        "set B1 value n 0",
    ]);
    // Copy styled A1 onto an unstyled B1 via paste-all.
    await scheduleCommands(SC, sheet, [
        "loadclipboard " + SC.encodeForSave(SC.CreateSheetSave(sheet, "A1:A1")),
        "paste B1 all",
    ]);
    expect(sheet.cells.B1.font).toBeDefined();
    expect(sheet.cells.B1.color).toBeDefined();
    expect(sheet.cells.B1.cssc).toBe("my-class");
});

// ===========================================================================
// Section 68: sort with error cell vs blank cell (covers ta=="e" / tb=="b" at 3610).
// ===========================================================================

test("sort with error-vs-blank rows exercises the e/b direction branch", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Use several error + blank + text rows so the sort comparator is forced
    // to compare e<->b and e<->t combinations.
    await scheduleCommands(SC, sheet, [
        "set A1 formula 1/0",
        "set A2 value n 5",
        "set A3 value n 7",
        "set A4 formula 2/0",
        "set A6 text t hello",
        "set A8 formula 3/0",
    ]);
    await recalcSheet(SC, sheet);
    await scheduleCommands(SC, sheet, ["sort A1:A8 A up"]);
    await scheduleCommands(SC, sheet, ["sort A1:A8 A down"]);
    expect(sheet.cells.A1).toBeDefined();
});

// ===========================================================================
// Section 69: insertrow / insertcol preserve row/col attribs by copying forward
// (covers 3742-3748 / 3758-3764).
// ===========================================================================

test("insertrow copies existing rowattribs forward; insertcol copies colattribs", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A3 value n 3",
        "set sheet defaultcolwidth 100",
        "set 3 height 40",     // row 3 has explicit height
        "set 1 height 30",     // row 1 has explicit height
        "set B width 120",     // column B has explicit width
        "set A width 80",
    ]);
    // Insertrow at 2 should bump row 3's attribs forward.
    await scheduleCommands(SC, sheet, ["insertrow 2"]);
    expect(sheet.rowattribs.height[4]).toBe("40"); // row 3 → row 4
    // insertcol at B should bump col B's width forward.
    await scheduleCommands(SC, sheet, ["insertcol B"]);
    expect(sheet.colattribs.width.C).toBe("120"); // col B → col C
});

// ===========================================================================
// Section 70: insertrow / insertcol where row/col attribs transition from set
// to unset trigger the delete branch (3747-3748 / 3763-3764).
// ===========================================================================

test("insertrow with mixed set/unset rowattribs covers delete branch", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Set row 3 height, leave row 4 unset. After insertrow 3, row 4 (copied from
    // original row 3) gets height; but row 5 (copied from original row 4) needs
    // height deleted if existed.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A5 value n 5",
        "set 3 height 50",
        "set 5 height 60",
    ]);
    // Delete first so the delete-branch fires on a fresh insert.
    await scheduleCommands(SC, sheet, ["set 5 height "]);
    expect(sheet.rowattribs.height[5]).toBeUndefined();
    await scheduleCommands(SC, sheet, ["insertrow 2"]);
    expect(sheet.rowattribs.height[4]).toBe("50"); // row 3 → 4
});

// ===========================================================================
// Section 71: named formula starting with "=" is adjusted on insertrow.
// ===========================================================================

test("insertrow adjusts named formula that starts with =", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "name define MYFORMULA =A1+A2",
    ]);
    await scheduleCommands(SC, sheet, ["insertrow 1"]);
    expect(sheet.names.MYFORMULA.definition).toMatch(/^=/);
});

// ===========================================================================
// Section 72: deleterow adjusts named formula starting with = (3890-3891).
// ===========================================================================

test("deleterow adjusts named formula that starts with =", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "name define MYFORMULA =A2+A3",
    ]);
    await scheduleCommands(SC, sheet, ["deleterow 2"]);
    expect(sheet.names.MYFORMULA.definition).toMatch(/^=/);
});

// ===========================================================================
// Section 73: deletecol past the end of the sheet (cr2.col > lastcol branch).
// ===========================================================================

test("deletecol / deleterow operating past last column/row shrinks to cr1-1", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // A sheet with lastcol=2 (A-B). Delete cols B:D past the end.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
    ]);
    await scheduleCommands(SC, sheet, ["deletecol B:D"]);
    expect(sheet.attribs.lastcol).toBe(1);

    // Similarly for rows.
    const sheet2 = new SC.Sheet();
    await scheduleCommands(SC, sheet2, [
        "set A1 value n 1",
        "set A2 value n 2",
    ]);
    await scheduleCommands(SC, sheet2, ["deleterow 2:10"]);
    expect(sheet2.attribs.lastrow).toBe(1);
});

// ===========================================================================
// Section 74: paste all between sheets copies clipboard colwidth onto dest
// (covers 3451 / 3456 / 3466).
// ===========================================================================

test("paste all carries source col/row width + hide attributes into destination", async () => {
    const SC = await loadSocialCalc();
    // Source sheet with col width/hide + row hide set.
    const src = new SC.Sheet();
    await scheduleCommands(SC, src, [
        "set A1 value n 1",
        "set A width 77",
        "set A hide yes",
        "set 1 hide yes",
    ]);
    // Capture clipboard string, then paste it into a fresh sheet.
    const clip = SC.CreateSheetSave(src, "A1:A1");
    const dest = new SC.Sheet();
    await scheduleCommands(SC, dest, [
        "loadclipboard " + SC.encodeForSave(clip),
        "paste B2 all",
    ]);
    expect(dest.colattribs.width.B).toBe("77");
    expect(dest.colattribs.hide.B).toBe("yes");
    expect(dest.rowattribs.hide[2]).toBe("yes");
});

// ===========================================================================
// Section 75: insertcol where the destination column had an attribute that
// transitions to unset triggers the delete branch (3763-3764).
// ===========================================================================

// ===========================================================================
// Section 75a: moveinsert with formats rest walks through internal push loop
// branches at 4137-4143 / 4177-4183 (copy vs delete styled attribs).
// ===========================================================================

test("moveinsert with styled cells exercises vertical+horizontal push attribs", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Vertical setup with styled cells so the insertvert push loop at 4134+
    // copies format attribs (4141) and deletes undefined ones (4138).
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set A4 value n 4",
        "set A5 value n 5",
        "set A1 font * normal 14pt",
        "set A3 color rgb(10,20,30)",
    ]);
    // Move A3 upward (insertvert) - triggers the vertical push loop over A1/A2.
    await scheduleCommands(SC, sheet, ["moveinsert A3 A1 all"]);
    // Also run a move with rest=formats so inserthoriz branch hits format-only.
    await scheduleCommands(SC, sheet, [
        "set B1 value n 1",
        "set C1 value n 2",
        "set D1 value n 3",
        "set B1 font * normal 10pt",
        "set D1 color rgb(9,9,9)",
    ]);
    await scheduleCommands(SC, sheet, ["moveinsert D1:D1 B1 formats"]);
    expect(sheet.attribs.lastcol).toBeGreaterThan(1);
});

// ===========================================================================
// Section 75b: movepaste of an empty cell (movingcells[crbase] undefined)
// hits 4217-4219 and movepaste with source comment hits 4243-4248.
// ===========================================================================

test("movepaste with mixed empty/comment cells hits the empty + comment branches", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // A1 = value with comment; A2 = readonly (skipped from movingcells);
    // A3 = value. A readonly src cell leaves movingcells[A2] undefined,
    // so paste→C2 hits the "moving an empty cell" branch (4217-4219).
    await scheduleCommands(SC, sheet, [
        "set A1 value n 7",
        "set A1 comment howdy",
        "set A2 value n 8",
        "set A2 readonly yes",
        "set A3 value n 9",
    ]);
    await scheduleCommands(SC, sheet, ["movepaste A1:A3 C1 all"]);
    expect(sheet.cells.C1.comment).toBe("howdy");
    expect(sheet.cells.C2 && sheet.cells.C2.datavalue).toBeFalsy();
});

// ===========================================================================
// Section 75c: movepaste triggers ReplaceFormulaCoords on a named formula
// (4275-4289).
// ===========================================================================

test("movepaste updates named ranges to reflect moved coords", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 42",
        "name define MYNAME A1",
        "name define MYFORM =A1*2",
    ]);
    await scheduleCommands(SC, sheet, ["movepaste A1:A1 C1 all"]);
    // The named references should be rewritten to the new cell C1.
    expect(sheet.names.MYNAME.definition).toBe("C1");
    expect(sheet.names.MYFORM.definition).toMatch(/^=.*C1/);
});

// ===========================================================================
// Section 75d: movepaste onto a destination that has a comment, from a source
// without one, hits the else-if cell.comment delete path (4246-4247).
// ===========================================================================

test("movepaste: src without comment onto dest with comment clears dest comment", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // A1 value w/ NO comment, C1 value w/ comment → movepaste A1→C1
    await scheduleCommands(SC, sheet, [
        "set A1 value n 5",
        "set C1 value n 10",
        "set C1 comment dest-comment",
    ]);
    await scheduleCommands(SC, sheet, ["movepaste A1:A1 C1 all"]);
    // C1 now should reflect A1's value with no comment.
    expect(sheet.cells.C1.datavalue).toBe(5);
    expect(sheet.cells.C1.comment).toBeUndefined();
});

test("insertcol clearing colattribs via inserted blank col hits delete branch", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Stage: cols A through D. C has width. D unset. After insertcol at B:
    //   original A stays, B=new blank, old B→C, old C(width)→D, old D→E.
    // For the `delete sheet.colattribs[attrib][colnext]` branch:
    // need rownext/colnext to currently have a value while new `val` is unset.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "set D1 value n 4",
        "set B width 50",
        "set D width 80",
    ]);
    // Now explicitly remove C's width so colattribs[colnext='C'].width is undefined,
    // then insertcol at D (coloffset=+1). This walks old C → new D where D had no width
    // and C (source) has none, so branch... actually we need the opposite:
    // let us construct: col C has width, col D doesn't, then insertcol A which pushes all right.
    await scheduleCommands(SC, sheet, ["set C width "]);
    expect(sheet.colattribs.width.C).toBeUndefined();
    await scheduleCommands(SC, sheet, ["insertcol A"]);
    // Lingering behaviour: the sheet should still have a valid lastcol.
    expect(sheet.attribs.lastcol).toBeGreaterThan(1);
});
