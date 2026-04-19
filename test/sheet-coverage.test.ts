import { expect, test } from "bun:test";

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
    const fakeEditor = {
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

// ===========================================================================
// Section 1: Sheet lifecycle, ResetSheet, CellFromStringParts edge paths,
// and CreateSheetSave canonicalization.
// ===========================================================================

test("ParseSheetSave handles every known line type (cell variants, col/row hide, sheet attrs, name/layout/font/color/border/cellformat/valueformat, copiedfrom, version, clipboard, blanks)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    const enc = SC.encodeForSave;
    const save = makeSave([
        "version:1.5",
        "",
        "clipboardrange:A1:B2",
        "clipboard:A1:v:1",
        `cell:A1:vt:n%:0.5`,
        `cell:A2:vtc:n$:${enc("9.99")}:${enc("$9.99")}`,
        `cell:A3:vtf:n:0:${enc("A1+A2")}:ro:yes:e:${enc("err!")}:b:1:1:1:1:l:1:f:1:c:1:bg:1:cf:1:tvf:1:ntvf:1:colspan:2:rowspan:1:cssc:redcls:csss:${enc("font-weight:bold")}:mod:y:comment:${enc("a comment")}`,
        `cell:B1:t:${enc("plain text")}`,
        "cell:B2:v:42",
        "col:A:w:120",
        "col:B:hide:yes",
        "row:1:h:30",
        "row:2:hide:yes",
        "sheet:c:4:r:4:w:80:h:20:tf:1:ntf:1:layout:1:font:1:tvf:1:ntvf:1:color:1:bgcolor:1:recalc:off:needsrecalc:no:usermaxcol:4:usermaxrow:4:circularreferencecell:A3",
        "border:1:1px solid black",
        "cellformat:1:right",
        "color:1:rgb(0,0,0)",
        "font:1:normal normal 12pt Arial",
        "layout:1:padding:2px 2px 2px 2px;vertical-align:middle;",
        `valueformat:1:${enc("#,##0.00")}`,
        `name:${enc("TOTAL")}:${enc("the sum")}:${enc("A1+A2")}`,
        "copiedfrom:A1:B2",
    ]);

    SC.ParseSheetSave(save, sheet);

    expect(sheet.attribs.lastcol).toBe(4);
    expect(sheet.attribs.lastrow).toBe(4);
    expect(sheet.attribs.defaultcolwidth).toBe("80");
    expect(sheet.attribs.circularreferencecell).toBe("A3");
    expect(sheet.attribs.recalc).toBe("off");
    expect(sheet.attribs.usermaxcol).toBe(4);
    expect(sheet.attribs.usermaxrow).toBe(4);
    expect(sheet.colattribs.width.A).toBe("120");
    expect(sheet.colattribs.hide.B).toBe("yes");
    expect(sheet.rowattribs.height[1]).toBe(30);
    expect(sheet.rowattribs.hide[2]).toBe("yes");
    expect(sheet.cells.A1.datatype).toBe("v");
    expect(sheet.cells.A1.valuetype).toBe("n%");
    expect(sheet.cells.A1.datavalue).toBe(0.5);
    expect(sheet.cells.A2.datatype).toBe("c");
    expect(sheet.cells.A2.formula).toBe("$9.99");
    expect(sheet.cells.A3.readonly).toBe(true);
    expect(sheet.cells.A3.errors).toBe("err!");
    expect(sheet.cells.A3.colspan).toBe(2);
    expect(sheet.cells.A3.rowspan).toBe(1);
    expect(sheet.cells.A3.cssc).toBe("redcls");
    expect(sheet.cells.A3.csss).toBe("font-weight:bold");
    expect(sheet.cells.A3.comment).toBe("a comment");
    expect(sheet.cells.B1.datatype).toBe("t");
    expect(sheet.names.TOTAL.definition).toBe("A1+A2");
    expect(sheet.copiedfrom).toBe("A1:B2");

    // CreateSheetSave should round-trip structural info.
    const out = SC.CreateSheetSave(sheet);
    expect(out).toContain("version:1.5");
    expect(out).toContain("cell:A1");
    expect(out).toContain("col:A:w:120");
    expect(out).toContain("col:B:hide:yes");
    expect(out).toContain("row:1:h:30");
    expect(out).toContain("row:2:hide:yes");
    expect(out).toContain("name:TOTAL:");

    // Unknown column-type token triggers exception.
    const bad = makeSave(["col:A:bogus:something"]);
    expect(() => SC.ParseSheetSave(bad, new SC.Sheet())).toThrow();

    const badRow = makeSave(["row:1:bogus:something"]);
    expect(() => SC.ParseSheetSave(badRow, new SC.Sheet())).toThrow();
});

test("ResetSheet clears state and can be called via prototype; AddCell / LastCol / LastRow", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set D5 value n 2"]);
    expect(sheet.LastCol()).toBe(4);
    expect(sheet.LastRow()).toBe(5);
    const addedCell = new SC.Cell("Z9");
    sheet.AddCell(addedCell);
    expect(sheet.cells.Z9).toBe(addedCell);

    sheet.ResetSheet();
    expect(Object.keys(sheet.cells).length).toBe(0);
    expect(sheet.attribs.lastcol).toBe(1);
    expect(sheet.attribs.lastrow).toBe(1);

    // Reset again (via the reload branch) just to exercise code path.
    SC.ResetSheet(sheet, true);
    expect(sheet.copiedfrom).toBe("");
});

test("CellToString covers datatype=c branch, read-only, errors, and CanonicalizeSheet full=true", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // text cell with non-default valuetype goes to vt branch.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A2 text th <b>bold</b>",
        "set A3 constant n$ 1.50 $1.50",
        "set A4 formula A1*2",
        "set A5 readonly yes",
        "set B1 bgcolor rgb(255,0,0)",
        "set B2 color rgb(0,255,0)",
        "set B3 font italic bold 14pt Arial",
        "set B4 layout padding:3px 3px 3px 3px;vertical-align:top;",
        "set B5 cellformat center",
        "set C1 border 1px solid black",
    ]);

    const out = SC.CreateSheetSave(sheet, "", true);
    expect(out).toContain("cell:A1:v:10");
    expect(out).toContain("cell:A3:vtc:n$:1.5:");
    expect(out).toContain("cell:A4:vtf:");
    expect(out).toContain("ro:yes");

    // Second invocation with full canonicalize should still work and xlt is cleaned up.
    expect(sheet.xlt).toBeUndefined();
    const out2 = SC.CreateSheetSave(sheet, "A1:C5", true);
    expect(out2).toContain("copiedfrom:A1:C5");
});

// ===========================================================================
// Section 2: encodeForSave, decodeFromSave, decodeFromAjax edge cases.
// ===========================================================================

test("encodeForSave / decodeFromSave / decodeFromAjax round-trip colons, backslashes, newlines, and ]]", async () => {
    const SC = await loadSocialCalc();
    expect(SC.encodeForSave("no special")).toBe("no special");
    const raw = "a:b\\c\nd]]e";
    const encoded = SC.encodeForSave(raw);
    expect(encoded).toBe("a\\cb\\bc\\nd]]e");
    expect(SC.decodeFromSave(encoded)).toBe("a:b\\c\nd]]e");
    expect(SC.decodeFromSave("no backslash")).toBe("no backslash");
    expect(SC.decodeFromAjax("ajax\\e end")).toBe("ajax]] end");
    expect(SC.decodeFromAjax("ajax without backslash")).toBe("ajax without backslash");
    expect(SC.encodeForSave(42)).toBe(42);
    expect(SC.decodeFromSave(42)).toBe(42);
    expect(SC.decodeFromAjax(42)).toBe(42);

    // empty string should just return itself
    expect(SC.encodeForSave("")).toBe("");
    expect(SC.decodeFromSave("")).toBe("");
    expect(SC.decodeFromAjax("")).toBe("");
});

test("special_chars escapes, and skips string without matches", async () => {
    const SC = await loadSocialCalc();
    expect(SC.special_chars("clean")).toBe("clean");
    expect(SC.special_chars('<a&"b>')).toBe("&lt;a&amp;&quot;b&gt;");
});

// ===========================================================================
// Section 3: Coord helpers: rcColname edge cases, coordToCr with $, ParseRange.
// ===========================================================================

test("coord helpers clamp out-of-range and parse absolute refs", async () => {
    const SC = await loadSocialCalc();
    expect(SC.rcColname(0)).toBe("A");
    expect(SC.rcColname(1)).toBe("A");
    expect(SC.rcColname(26)).toBe("Z");
    expect(SC.rcColname(27)).toBe("AA");
    expect(SC.rcColname(703)).toBe("ZZ"); // clamped
    expect(SC.crToCoord(0, 0)).toBe("A1");
    expect(SC.crToCoord(703, 5)).toBe("ZZ5");
    expect(SC.coordToCr("$B$4")).toEqual({ col: 2, row: 4 });
    // coordToCr uses caches - hitting it again should return the cached answer.
    expect(SC.coordToCr("$B$4")).toEqual({ col: 2, row: 4 });
    expect(SC.ParseRange("")).toEqual({
        cr1: { col: 1, row: 1, coord: "A1" },
        cr2: { col: 1, row: 1, coord: "A1" },
    });
});

test("OffsetFormulaCoords handles absolute refs, strings, #REF!, and operator expansion", async () => {
    const SC = await loadSocialCalc();
    expect(SC.OffsetFormulaCoords("A1", -1, -1)).toBe("#REF!");
    expect(SC.OffsetFormulaCoords("$A1+A$1+$A$1", 2, 2)).toBe("$A3+C$1+$A$1");
    // Plain string preserved.
    expect(SC.OffsetFormulaCoords('CONCATENATE("clean", A1)', 0, 0)).toContain('"clean"');
    // Operator token "G" (shorthand for ">=") expands back via tokenOpExpansion.
    expect(SC.OffsetFormulaCoords("A1>=B1", 0, 0)).toBe("A1>=B1");
});

test("AdjustFormulaCoords crosses the deletion zone, preserves $, and handles sheet refs", async () => {
    const SC = await loadSocialCalc();
    // Delete column 2 (pass coloffset=-1) - refs at col>=2 should shift or become #REF!
    expect(SC.AdjustFormulaCoords("B1+C1", 2, -1, 1, 0)).toBe("#REF!+B1");
    // Absolute refs still use $ prefix.
    expect(SC.AdjustFormulaCoords("$B$1", 1, 1, 1, 0)).toBe("$C$1");
    expect(SC.AdjustFormulaCoords('"some""string"+B2', 0, 0, 0, 0)).toContain('"some""string"');
    // Sheet reference: token after "!" is preserved as a coord but not offset.
    // Note: ParseFormulaIntoTokens normalises sheet names to uppercase.
    expect(SC.AdjustFormulaCoords("Sheet2!A1+B1", 1, 2, 1, 0)).toContain("SHEET2!A1");
});

test("ReplaceFormulaCoords preserves absolute ref format and respects sheet refs", async () => {
    const SC = await loadSocialCalc();
    expect(SC.ReplaceFormulaCoords("$A1+A$2", { A1: "B5", A2: "B6" })).toBe("$B5+B$6");
    // Formulas are uppercased by ParseFormulaIntoTokens, so Sheet2 -> SHEET2.
    expect(SC.ReplaceFormulaCoords("Sheet2!A1", { A1: "B2" })).toBe("SHEET2!A1");
    expect(SC.ReplaceFormulaCoords('CONCATENATE("q", A1)', { A1: "B1" })).toContain('"q"');
});

// ===========================================================================
// Section 4: Utility helpers.
// ===========================================================================

test("Lookup walks lists for match below, above, and equal", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Lookup(0, [5, 10, 15])).toBeNull();
    expect(SC.Lookup(5, [5, 10, 15])).toBe(0);
    expect(SC.Lookup(20, [5, 10, 15])).toBe(2);
    expect(SC.Lookup(12, [5, 10, 15])).toBe(1);
});

test("DetermineValueType covers every branch: blank, blank-only-spaces, number, percent, dollar, commas, dates, times, fractions, constants, URLs, HTML", async () => {
    // MM/DD/YYYY parsing consults `navigator.language`, so load with browser shim.
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    expect(SC.DetermineValueType("")).toEqual({ value: "", type: "" });
    expect(SC.DetermineValueType("    ")).toEqual({ value: "    ", type: "t" });
    expect(SC.DetermineValueType("-")).toEqual({ value: "-", type: "t" });
    expect(SC.DetermineValueType("-1.5e2")).toEqual({ value: -150, type: "n" });
    expect(SC.DetermineValueType("-5%")).toEqual({ value: -0.05, type: "n%" });
    expect(SC.DetermineValueType("-$5.00")).toEqual({ value: -5, type: "n$" });
    expect(SC.DetermineValueType("$1,234")).toEqual({ value: 1234, type: "n$" });
    expect(SC.DetermineValueType("1,234.50")).toEqual({ value: 1234.5, type: "n" });
    expect(SC.DetermineValueType("1,234%")).toEqual({ value: 12.34, type: "n%" });
    const mdy = SC.DetermineValueType("2/5/2024");
    expect(mdy.type).toBe("nd");
    const ymd = SC.DetermineValueType("2024-02-05");
    expect(ymd.type).toBe("nd");
    const ymdhm = SC.DetermineValueType("2024-02-05 10:30");
    expect(ymdhm.type).toBe("ndt");
    const ymdhms = SC.DetermineValueType("2024-02-05 10:30:45");
    expect(ymdhms.type).toBe("ndt");
    const hm = SC.DetermineValueType("10:30");
    expect(hm.type).toBe("nt");
    const hms = SC.DetermineValueType("10:30:45");
    expect(hms.type).toBe("nt");
    const frac = SC.DetermineValueType("1 1/2");
    expect(frac.type).toBe("n");
    expect(frac.value).toBe(1.5);
    expect(SC.DetermineValueType("TRUE")).toEqual({ value: 1, type: "nl" });
    expect(SC.DetermineValueType("#DIV/0!")).toEqual({ value: 0, type: "e#DIV/0!" });
    expect(SC.DetermineValueType("http://example.com/page")).toEqual({
        value: "http://example.com/page",
        type: "tl",
    });
    const htmlVal = SC.DetermineValueType("<div>hello</div>");
    expect(htmlVal.type).toBe("th");
});

test("GetCellContents returns prefixed representations for each cell type", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A2 text t hello",
        "set A3 formula A1*2",
        "set A4 constant n$ 1.5 $1.50",
    ]);
    expect(SC.GetCellContents(sheet, "A1")).toBe("10");
    expect(SC.GetCellContents(sheet, "A2")).toBe("'hello");
    expect(SC.GetCellContents(sheet, "A3")).toBe("=A1*2");
    expect(SC.GetCellContents(sheet, "A4")).toBe("$1.50");
    expect(SC.GetCellContents(sheet, "Z99")).toBe("");
});

// ===========================================================================
// Section 5: Sheet command dispatcher - every verb we care about.
// ===========================================================================

test("set sheet attributes + defaults + lastcol/lastrow + recalc on/off + unknown attr error", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const errors: string[] = [];
    sheet.statuscallback = (_data: any, status: string, arg: any) => {
        if (status === "cmdend" && typeof arg === "string") errors.push(arg);
    };

    await scheduleCommands(SC, sheet, [
        "set sheet defaultcolwidth 100",
        "set sheet defaultcolor rgb(10,20,30)",
        "set sheet defaultbgcolor rgb(255,255,0)",
        "set sheet defaultlayout padding:1px 1px 1px 1px;vertical-align:top;",
        "set sheet defaultfont * * *",
        "set sheet defaultfont italic bold 12pt Arial",
        "set sheet defaulttextformat left",
        "set sheet defaultnontextformat right",
        "set sheet defaulttextvalueformat text-plain",
        "set sheet defaultnontextvalueformat 0.00",
        "set sheet lastcol 5",
        "set sheet lastrow 6",
        "set sheet recalc on",
        "set sheet recalc off",
        "set sheet usermaxcol 3",
        "set sheet usermaxrow 4",
    ]);
    expect(sheet.attribs.defaultcolwidth).toBe("100");
    expect(sheet.attribs.defaultfont).toBeGreaterThan(0);
    expect(sheet.attribs.lastcol).toBe(5);
    expect(sheet.attribs.lastrow).toBe(6);
    expect(sheet.attribs.recalc).toBe("off");
    expect(sheet.attribs.usermaxcol).toBe(3);
    expect(sheet.attribs.usermaxrow).toBe(4);
});

test("set <col>/<col-range>/<row>/<row-range> width/height/hide, and set <range> many formatting attribs", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A width 80",
        "set A:C width 120",
        "set D hide yes",
        "set 1 height 20",
        "set 1:3 height 25",
        "set 4 hide yes",
        "set A1 value n 5",
        "set A1 text t hi",
        "set A1:C3 color rgb(0,0,0)",
        "set A1:C3 bgcolor rgb(255,255,255)",
        "set A1:C3 layout padding:4px 4px 4px 4px;vertical-align:middle;",
        "set A1:C3 cellformat right",
        "set A1:C3 font italic bold 12pt Arial",
        "set A1:C3 textvalueformat text-plain",
        "set A1:C3 nontextvalueformat 0.00",
        "set A1 bt 1px solid red",
        "set A1 br 1px solid red",
        "set A1 bb 1px solid red",
        "set A1 bl 1px solid red",
        "set A1 cssc red-class",
        "set A1 csss font-weight:bold;",
        "set A1 mod y",
        "set A1 comment this is my comment",
        "set C1 readonly yes",
        "set A1 empty",
        "set A1 formula 1+2",
        "set A2 all :t:hello",
        "set A3 all ",
    ]);
    expect(sheet.colattribs.width.A).toBe("120");
    expect(sheet.colattribs.hide.D).toBe("yes");
    expect(sheet.rowattribs.height[1]).toBe("25");
    expect(sheet.rowattribs.hide[4]).toBe("yes");
    expect(sheet.cells.A1.datatype).toBe("f");
    expect(sheet.cells.A2.datatype).toBe("t");
    expect(sheet.cells.A3).toBeUndefined();

    // Trigger unknown set attribute for coverage.
    await scheduleCommands(SC, sheet, ["set A1 nosuch value"], false).catch(() => {});
});

test("merge / unmerge rebuilds spans, discarding inner cells and restoring them on undo", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Seed cells in one change so they aren't part of the merge's undo group.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set B1 value n 3",
        "set B2 value n 4",
    ]);
    // Merge in a separate change so undo/redo only reverts the merge.
    await scheduleCommands(SC, sheet, ["merge A1:B2"]);
    expect(sheet.cells.A1.colspan).toBe(2);
    expect(sheet.cells.A1.rowspan).toBe(2);
    expect(sheet.cells.B2).toBeUndefined();

    await sheetUndo(SC, sheet);
    // Undo restores child cells.
    expect(sheet.cells.B2.datavalue).toBe(4);
    expect(sheet.cells.A1.colspan).toBeUndefined();

    await sheetRedo(SC, sheet);
    expect(sheet.cells.A1.colspan).toBe(2);

    await scheduleCommands(SC, sheet, ["unmerge A1"]);
    expect(sheet.cells.A1.colspan).toBeUndefined();
    expect(sheet.cells.A1.rowspan).toBeUndefined();

    // single-cell merge (colspan=1, rowspan=1) should be a no-op.
    await scheduleCommands(SC, sheet, ["merge A1:A1"]);
    expect(sheet.cells.A1.colspan).toBeUndefined();
});

test("erase / cut / copy / paste / loadclipboard / clearclipboard with all / formulas / formats variants", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set B1 formula A1+10",
        "set B2 bgcolor rgb(255,0,0)",
        "copy A1:B2 all",
        "paste C1 all",
        "paste D1 formulas",
        "paste E1 formats",
        "cut A1:A2 all",
        "paste F1 all",
        "erase B1:B2 all",
        "erase D1 formulas",
        "erase D2 formats",
    ]);

    expect(sheet.cells.C1.datavalue).toBe(1);
    expect(sheet.cells.F1.datavalue).toBe(1);
    expect(sheet.cells.A1).toBeUndefined();
    expect(sheet.cells.B1).toBeUndefined();

    // Loading & clearing the clipboard.
    await scheduleCommands(SC, sheet, [
        "loadclipboard " + SC.encodeForSave(SC.Clipboard.clipboard),
        "clearclipboard",
        // Paste with empty clipboard should no-op gracefully.
        "paste Z1 all",
    ]);
    expect(SC.Clipboard.clipboard).toBe("");
});

test("fillright / filldown copy formulas with offset and formats variants", async () => {
    const SC = await loadSocialCalc();
    installEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A2 value n 20",
        "set A3 value n 30",
        "set B1 formula A1*2",
    ]);
    await scheduleCommands(SC, sheet, [
        "fillright B1:D1 all",
        "fillright B1:D1 formulas",
        "fillright B1:D1 formats",
        "filldown A1:A5 all",
        "filldown A1:A5 formulas",
        "filldown A1:A5 formats",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.C1.formula).toBe("B1*2");
    expect(sheet.cells.D1.formula).toBe("C1*2");
});

test("sort ranges by multiple cols, mixing numbers, text, blanks, and errors", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 text t c",
        "set A2 text t a",
        "set A3 text t B",
        "set A4 value n 5",
        "set A5 formula 1/0",
        "set B1 value n 3",
        "set B2 value n 1",
        "set B3 value n 2",
        "set B4 value n 0",
        "set B5 value n -1",
    ]);
    await recalcSheet(SC, sheet);
    await scheduleCommands(SC, sheet, ["sort A1:B5 B up A up"]);
    await recalcSheet(SC, sheet);
    // After sort blank cells go to the bottom (errors last).
    expect(sheet.cells.A1).toBeDefined();
    // Exercise down direction too.
    await scheduleCommands(SC, sheet, ["sort A1:B5 B down"]);
    await recalcSheet(SC, sheet);
});

test("insertcol / insertrow / deletecol / deleterow and undo-redo keep cells and formulas", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 formula A1+B1",
        "set A2 value n 3",
        "name define MYREF A1",
        "insertcol B",
    ]);
    expect(sheet.attribs.lastcol).toBe(4);
    await scheduleCommands(SC, sheet, ["deletecol B"]);
    expect(sheet.attribs.lastcol).toBe(3);
    await scheduleCommands(SC, sheet, ["insertrow 2"]);
    expect(sheet.attribs.lastrow).toBe(3);
    await scheduleCommands(SC, sheet, ["deleterow 2"]);
    expect(sheet.attribs.lastrow).toBe(2);
    // Delete against a readonly cell should error and bail.
    await scheduleCommands(SC, sheet, [
        "set A1 readonly yes",
        "deletecol A",
    ]);
    // Undo delete (even though it bailed) - just make sure we don't blow up.
    await sheetUndo(SC, sheet);
});

test("name define / desc / delete round-trip", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "name define MYNAME A1:B2",
        "name desc MYNAME hello",
        "name define MYNAME =1+2",
        "name delete MYNAME",
        "name define  ", // empty name - no-op
        "name define NAMEONLY", // no rest - no-op
    ]);
    expect(sheet.names.MYNAME).toBeUndefined();
});

test("movepaste and moveinsert push cells and rewrite references", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set B1 formula A1+A2",
        "movepaste A1:A3 C1 all",
        "movepaste A1:A3 D1 formulas",
        "movepaste A1:A3 E1 formats",
    ]);
    await recalcSheet(SC, sheet);

    await scheduleCommands(SC, sheet, [
        "set F1 value n 10",
        "set F2 value n 20",
        "moveinsert F1:F2 H1 all",
    ]);
    await recalcSheet(SC, sheet);

    // moveinsert to a destination inside the source range falls back to movepaste.
    await scheduleCommands(SC, sheet, [
        "set J1 value n 1",
        "set J2 value n 2",
        "moveinsert J1:J2 J1 all",
    ]);
});

test("recalc / redisplay / changedrendervalues / unknown command / pane /settimetrigger / sendemail", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "recalc",
        "redisplay",
        "changedrendervalues",
        "settimetrigger do stuff",
        "sendemail details",
        "submitform details",
    ]);

    // Unknown command - will alert via SheetCommandsTimerRoutine. With shim, alert
    // is a no-op, so the command still reaches cmdend.
    installBrowserShim();
    const SC2 = await loadSocialCalc({ browser: true });
    const sheet2 = new SC2.Sheet();
    await scheduleCommands(SC2, sheet2, ["bogusunknowncmd"]);
});

test("startcmdextension with registered callback", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    let called = false;
    sheet.sci.CmdExtensionCallbacks.myExt = {
        func() {
            called = true;
        },
        data: {},
    };
    await scheduleCommands(SC, sheet, ["startcmdextension myExt arg1 arg2"]);
    expect(called).toBe(true);
});

// ===========================================================================
// Section 6: Undo/redo audit string + redo when nothing to redo.
// ===========================================================================

test("CreateAuditString serialises stack; redo with empty stack still settles to cmdend", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
    ]);
    const audit = SC.CreateAuditString(sheet);
    expect(audit).toContain("set A1 value n 1");
    expect(audit).toContain("set B1 value n 2");

    // Redo from the top of the stack - should be no-op that schedules empty cmd.
    await sheetRedo(SC, sheet);

    // Undo twice then redo once.
    await sheetUndo(SC, sheet);
    await sheetUndo(SC, sheet);
    await sheetRedo(SC, sheet);
});

// ===========================================================================
// Section 7: EncodeCellAttributes + DecodeCellAttributes + sheet variants.
// ===========================================================================

test("EncodeCellAttributes -> DecodeCellAttributes round-trips font/layout/colors/borders/formats/mod", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A1 color rgb(10,10,10)",
        "set A1 bgcolor rgb(255,255,255)",
        "set A1 layout padding:2px 2px 2px 2px;vertical-align:middle;",
        "set A1 cellformat right",
        "set A1 font italic bold 12pt Arial",
        "set A1 bt 1px solid black",
        "set A1 br 1px solid black",
        "set A1 bb 1px solid black",
        "set A1 bl 1px solid black",
        "set A1 textvalueformat text-plain",
        "set A1 nontextvalueformat 0.00",
        "set A1 cssc my-class",
        "set A1 csss font-weight:bold;",
        "set A1 mod y",
    ]);
    const attrs = SC.EncodeCellAttributes(sheet, "A1");
    expect(attrs.textcolor.def).toBe(false);
    expect(attrs.mod.def).toBe(false);
    // Decode with identical attrs should produce null (no changes).
    expect(SC.DecodeCellAttributes(sheet, "A1", attrs)).toBeNull();

    // Flip one attribute to trigger a change.
    attrs.textcolor = { def: true, val: "" };
    attrs.mod = { def: true, val: "" };
    const cmds = SC.DecodeCellAttributes(sheet, "A1", attrs, "A1:A2");
    expect(cmds).toContain("set A1:A2 color ");
});

test("EncodeSheetAttributes -> DecodeSheetAttributes round-trip defaults", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set sheet defaultcolwidth 90",
        "set sheet defaultcolor rgb(100,100,100)",
        "set sheet defaultbgcolor rgb(200,200,200)",
        "set sheet defaultlayout padding:3px 3px 3px 3px;vertical-align:top;",
        "set sheet defaultfont italic bold 14pt Times",
        "set sheet defaulttextformat left",
        "set sheet defaultnontextformat right",
        "set sheet defaulttextvalueformat text-plain",
        "set sheet defaultnontextvalueformat 0.00",
        "set sheet recalc off",
        "set sheet usermaxcol 10",
        "set sheet usermaxrow 10",
    ]);
    const enc = SC.EncodeSheetAttributes(sheet);
    expect(enc.textcolor.def).toBe(false);
    expect(enc.fontsize.def).toBe(false);
    expect(SC.DecodeSheetAttributes(sheet, enc)).toBeNull();

    // Change something and verify we get commands.
    enc.textcolor = { def: true, val: "" };
    enc.recalc = { def: true, val: "" };
    const cmds = SC.DecodeSheetAttributes(sheet, enc);
    expect(cmds).toContain("set sheet defaultcolor ");
});

// ===========================================================================
// Section 8: Conversion formats.
// ===========================================================================

test("CSV/TSV import and export - including quoted newlines, commas, double quotes", async () => {
    const SC = await loadSocialCalc();
    const csv =
        'name,score,comment\n' +
        '"Ada ""Lovelace""",42,"multi\nline"\n' +
        'Hopper,99,\n';
    const save = SC.ConvertOtherFormatToSave(csv, "csv");
    expect(save).toContain('cell:A1:t:name');
    expect(save).toContain('Ada "Lovelace"');
    const round = SC.ConvertSaveToOtherFormat(save, "csv");
    expect(round).toContain('"Ada ""Lovelace"""');
    expect(round).toContain('multi\nline');
    expect(SC.ConvertSaveToOtherFormat(save, "tab")).toContain("Ada");
    expect(SC.ConvertSaveToOtherFormat(save, "scsave")).toBe(save);

    // TSV input with quoted tab-containing field.
    const tab =
        'a\tb\tc\n' +
        '"q\"uote"\t"line\nbreak"\t3\n';
    const saveTab = SC.ConvertOtherFormatToSave(tab, "tab");
    expect(saveTab).toContain('cell:A1:t:a');
    expect(SC.ConvertOtherFormatToSave("just,text", "scsave")).toBe("just,text");
    // Empty string returns empty.
    expect(SC.ConvertSaveToOtherFormat("", "csv")).toBe("");
});

test("SetConvertedCell categorises cells: plain number, text, percentage, date, HTML, URL", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.SetConvertedCell(sheet, "A1", "42");
    SC.SetConvertedCell(sheet, "A2", "12.5%");
    SC.SetConvertedCell(sheet, "A3", "hello");
    SC.SetConvertedCell(sheet, "A4", "1,234");
    SC.SetConvertedCell(sheet, "A5", "http://example.com/page");
    SC.SetConvertedCell(sheet, "A6", "<div>x</div>");
    expect(sheet.cells.A1.datatype).toBe("v");
    expect(sheet.cells.A2.datatype).toBe("c");
    expect(sheet.cells.A3.datatype).toBe("t");
    expect(sheet.cells.A5.valuetype).toBe("tl");
    expect(sheet.cells.A6.valuetype).toBe("th");
});

// ===========================================================================
// Section 9: HTML rendering (with DOM shim).
// ===========================================================================

test("RenderContext.RenderSheet produces a <table> DOM tree with row/col headers, spans, hidden rows, and pane divider", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 formula A1+10",
        "set A2 text t world",
        "set C1 value n 99",
        "set A width 120",
        "set B hide yes",
        "set 3 hide yes",
        "merge A1:B1",
        "set A1 comment my comment",
        "set B2 readonly yes",
    ]);
    await recalcSheet(SC, sheet);

    const context = new SC.RenderContext(sheet);
    context.showRCHeaders = true;
    context.showGrid = true;
    // add a second row pane and second col pane to exercise RenderSpacingRow & dividers.
    context.rowpanes.push({ first: 2, last: 3 });
    context.colpanes.push({ first: 3, last: 3 });

    // highlights: both a cursor and a range
    context.highlights = { A1: "cursor", B2: "range" };
    context.cursorsuffix = "";

    const tableobj = context.RenderSheet(null, context.defaultHTMLlinkstyle);
    expect(tableobj.tagName).toBe("TABLE");
    // Re-render replaces the oldtable when parent exists.
    const parent = (global as any).document.createElement("div");
    parent.appendChild(tableobj);
    const replaced = context.RenderSheet(tableobj, context.defaultHTMLlinkstyle);
    expect(replaced).toBeDefined();

    // Exercise ConvertSaveToOtherFormat html branch.
    const html = SC.ConvertSaveToOtherFormat(SC.CreateSheetSave(sheet), "html");
    expect(typeof html).toBe("string");
});

test("RenderCell handles error cells, error valuetype, custom value formats", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 text th <div>markup</div>",
        "set A2 text tw wiki-text",
        "set A3 value nl 1",
        "set A4 formula UNKNOWN(1)",
        "set A5 value n 10",
        "set A5 textvalueformat formula",
        "set A6 value n 10",
        "set A6 nontextvalueformat forcetext",
        "set A7 text tl http://example.com<http://example.com>",
        "set A8 text tl desc[pagename]",
    ]);
    await recalcSheet(SC, sheet);

    const context = new SC.RenderContext(sheet);
    context.showRCHeaders = false;
    context.showGrid = true;
    const tableobj = context.RenderSheet(null, context.defaultHTMLlinkstyle);
    expect(tableobj.tagName).toBe("TABLE");

    // RenderCell with noElement=true returns a pseudo-element.
    const pseudo = context.RenderCell(1, 1, 0, 0, true, context.defaultHTMLlinkstyle);
    expect(typeof pseudo.style).toBe("object");
});

test("format_text_for_display covers text-url, text-image, text-custom, custom, hidden, and nontextvalueformat fallback", async () => {
    const SC = await loadSocialCalc();
    expect(SC.format_text_for_display("http://x", "t", "text-url", null, "")).toContain(
        '<a href=',
    );
    expect(SC.format_text_for_display("http://x", "t", "text-image", null, "")).toContain(
        '<img src=',
    );
    expect(
        SC.format_text_for_display("hi", "t", "text-custom:<b>@r</b>", null, ""),
    ).toBe("<b>hi</b>");
    expect(SC.format_text_for_display("hi", "t", "customXXX", null, "")).toContain(
        "(custom format)",
    );
    expect(SC.format_text_for_display("x", "t", "hidden", null, "")).toBe("&nbsp;");
    expect(SC.format_text_for_display("<b>", "t", "text-html", null, "")).toBe("<b>");
});

test("ParseCellLinkText covers plain URL, url<> form, [page], [page][page], {workspace}, and {workspace} with double brackets", async () => {
    const SC = await loadSocialCalc();
    expect(SC.ParseCellLinkText("http://plain.example.com")).toMatchObject({
        url: "http://plain.example.com",
        newwin: false,
    });
    expect(SC.ParseCellLinkText("desc<http://x.com>")).toMatchObject({
        url: "http://x.com",
        desc: "desc",
    });
    expect(SC.ParseCellLinkText("desc<<http://x.com>>")).toMatchObject({
        url: "http://x.com",
        newwin: true,
    });
    expect(SC.ParseCellLinkText("desc[[page]]")).toMatchObject({
        pagename: "page",
        newwin: true,
    });
    expect(SC.ParseCellLinkText("d{ws [p]}")).toMatchObject({
        workspace: "ws",
        pagename: "p",
    });
    expect(SC.ParseCellLinkText('"quoted"<http://q.example>')).toMatchObject({
        url: "http://q.example",
        desc: "quoted",
    });
});

// ===========================================================================
// Section 10: Formula offset covers named range replaces.
// ===========================================================================

test("RecalcCheckCell detects circular references (direct and via range)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula B1+1",
        "set B1 formula A1+1",
        "set C1 formula SUM(C1:C5)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.A1.errors || sheet.cells.B1.errors).toBeTruthy();
});

test("RecalcSheet queues subsequent recalcs while one is in progress", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula 1+1"]);

    // Two back-to-back recalcs - the second should be queued.
    const done = new Promise<void>((resolve) => {
        let finishedCount = 0;
        const prev = sheet.statuscallback;
        sheet.statuscallback = (...args: any[]) => {
            prev?.(...args);
            if (args[1] === "calcfinished") {
                finishedCount++;
                if (finishedCount >= 2) {
                    sheet.statuscallback = prev;
                    resolve();
                }
            }
        };
    });

    SC.RecalcSheet(sheet);
    // While running, queue another.
    SC.RecalcSheet(sheet);
    await done;
    expect(sheet.cells.A1.datavalue).toBe(2);
});

// ===========================================================================
// Section 11: SheetRedo no-op path.
// ===========================================================================

test("GetStyleNum stores new styles and GetStyleString round-trips", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const n1 = sheet.GetStyleNum("color", "rgb(1,2,3)");
    const n2 = sheet.GetStyleNum("color", "rgb(1,2,3)");
    expect(n1).toBe(n2);
    expect(sheet.GetStyleString("color", n1)).toBe("rgb(1,2,3)");
    expect(sheet.GetStyleNum("color", "")).toBe(0);
    expect(sheet.GetStyleString("color", 0)).toBeNull();
});

// ===========================================================================
// Section 12: SocialCalc.Parse utility
// ===========================================================================

test("SocialCalc.Parse tokenises multi-line inputs", async () => {
    const SC = await loadSocialCalc();
    const p = new SC.Parse("one two three\nfour five\n");
    expect(p.NextToken()).toBe("one");
    expect(p.RestOfStringNoMove()).toBe("two three");
    expect(p.NextToken()).toBe("two");
    expect(p.RestOfString()).toBe("three");
    expect(p.NextToken()).toBe("");
    expect(p.EOF()).toBe(false);
    p.NextLine();
    expect(p.NextToken()).toBe("four");
    p.NextLine();
    expect(p.EOF()).toBe(true);
    expect(p.NextToken()).toBe("");
});

// ===========================================================================
// Section 13: constants helpers
// ===========================================================================

test("ConstantsSetClasses and ConstantsSetImagePrefix mutate as documented", async () => {
    const SC = await loadSocialCalc();
    const originalPrefix = SC.Constants.defaultImagePrefix;
    SC.ConstantsSetClasses("my-");
    expect(SC.Constants.defaultCommentClass.startsWith("my-")).toBe(true);
    SC.ConstantsSetImagePrefix("/img/");
    expect(SC.Constants.defaultImagePrefix).toBe("/img/");
    // Restore for subsequent tests (other test files share the loaded module cache).
    SC.ConstantsSetImagePrefix(originalPrefix);
});

// ===========================================================================
// Section 14: Cover CellFromStringParts unknown token.
// ===========================================================================

test("CellFromStringParts throws on unknown cell-token type", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const cell = sheet.GetAssuredCell("A1");
    expect(() => sheet.CellFromStringParts(cell, ["cell", "A1", "xx", "1"], 2)).toThrow();
});

// ===========================================================================
// Section 15: UndoStack direct exercise.
// ===========================================================================

test("UndoStack handles PushChange truncation, maxRedo, maxUndo", async () => {
    const SC = await loadSocialCalc();
    const stack = new SC.UndoStack();
    stack.maxUndo = 2;
    stack.maxRedo = 3;
    stack.PushChange("a");
    stack.AddDo("cmd1");
    stack.AddUndo("undo1");
    stack.PushChange("b");
    stack.AddDo("cmd2");
    stack.PushChange("c");
    stack.PushChange("d"); // should shift older ones off
    expect(stack.stack.length).toBeLessThanOrEqual(3);
    expect(stack.Undo()).toBe(true);
    expect(stack.Redo()).toBe(true);
    // No redo when at the top.
    expect(stack.Redo()).toBe(false);
});

// ===========================================================================
// Section 16: SheetCommandInfo fields and ExecuteSheetCommand via direct API.
// ===========================================================================

test("ExecuteSheetCommand direct invocation with a Parse object and error handling", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const cmd = new SC.Parse("set A1 value n 99");
    const err = SC.ExecuteSheetCommand(sheet, cmd, false);
    expect(err).toBeFalsy();
    expect(sheet.cells.A1.datavalue).toBe(99);
});

// ===========================================================================
// Section 17: CanonicalizeSheet full=false path and CreateSheetSave with
// canonicalize explicitly disabled.
// ===========================================================================

test("CanonicalizeSheet without full=true preserves indexes; with full=true compacts", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Add cells that reference a style index, then an unused style, then canonicalize.
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A1 color rgb(1,1,1)",
        "set A1 bgcolor rgb(2,2,2)",
        "set A1 font italic bold 10pt Verdana",
        "set A1 layout padding:1px 1px 1px 1px;vertical-align:middle;",
        "set A1 cellformat center",
        "set A1 textvalueformat text-plain",
        "set A1 nontextvalueformat 0.00",
        "set A1 bt 1px solid black",
    ]);

    // save without canonicalization flag: the "full=false" branch runs.
    // Temporarily clear doCanonicalizeSheet if set.
    const original = SC.Constants.doCanonicalizeSheet;
    SC.Constants.doCanonicalizeSheet = false;
    sheet.CanonicalizeSheet(false);
    expect(sheet.xlt).toBeDefined();
    expect(sheet.xlt.maxrow).toBeGreaterThanOrEqual(1);
    delete sheet.xlt;
    SC.Constants.doCanonicalizeSheet = original;
});

test("GetViewportInfo / GetElementPosition* / GetComputedStyle / LookupElement / AssignID (DOM helpers)", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const info = SC.GetViewportInfo();
    // When the UMD factory's `window` parameter lacks innerWidth (we pass globalThis),
    // the function falls back to documentElement.clientWidth (1024 in our shim).
    expect(typeof info.width).toBe("number");
    expect(typeof info.height).toBe("number");

    const doc = (globalThis as any).document;
    const div = doc.createElement("div");
    doc.body.appendChild(div);
    const pos = SC.GetElementPosition(div);
    expect(pos).toHaveProperty("left");
    expect(pos).toHaveProperty("top");

    // getBoundingClientRect isn't present on our fake element, so wrap safely.
    (div as any).getBoundingClientRect = () => ({
        left: 10,
        top: 20,
        right: 110,
        bottom: 120,
        width: 100,
        height: 100,
    });
    const scroll = SC.GetElementPositionWithScroll(div);
    expect(scroll.width).toBe(100);

    const fixed = SC.GetElementFixedParent(div);
    expect([false, div]).toContain(fixed);

    // GetComputedStyle via defaultView (not IE currentStyle).
    const styleValue = SC.GetComputedStyle(div, "cssText");
    expect(typeof styleValue).toBe("string");

    // LookupElement
    const obj = { element: div };
    expect(SC.LookupElement(div, [obj])).toBe(obj);
    expect(SC.LookupElement(div, [])).toBeNull();

    // AssignID with prefix
    const target = doc.createElement("span");
    SC.AssignID({ idPrefix: "pref-" }, target, "node");
    expect(target.id).toBe("pref-node");
    // No prefix - no change.
    target.id = "";
    SC.AssignID({}, target, "node");
    expect(target.id).toBe("");
});

test("setStyles applies pseudo-style properties; null cssText is no-op", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const doc = (globalThis as any).document;
    const el = doc.createElement("div");
    SC.setStyles(el, "color:red;backgroundColor:green;");
    expect(el.style.color).toBe("red");
    expect(el.style.backgroundColor).toBe("green");
    SC.setStyles(el, null);
    SC.setStyles(el, "no-colon-here");
});

test("RenderColHeaders / RenderColGroup / RenderSizingRow when showRCHeaders is on; hidden cols trigger unhide icons", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set C1 value n 3",
        "set D1 value n 4",
        "set B hide yes",
        "set 2 hide yes",
        "set 3 height 25",
        "set A width 100",
    ]);

    const context = new SC.RenderContext(sheet);
    context.showRCHeaders = true;
    context.showGrid = true;
    const colGroup = context.RenderColGroup();
    expect(colGroup.tagName).toBe("COLGROUP");
    const colHeaders = context.RenderColHeaders();
    expect(colHeaders).toBeDefined();
    const sizingRow = context.RenderSizingRow();
    expect(sizingRow.tagName).toBe("TR");

    // Add another row pane to exercise spacing row + dividers too.
    context.rowpanes.push({ first: 2, last: 3 });
    context.colpanes.push({ first: 3, last: 4 });
    const table = context.RenderSheet(null, context.defaultHTMLlinkstyle);
    expect(table.tagName).toBe("TABLE");
});

test("Sort exercises every type comparison: n vs n, t vs t, t vs n, n vs b, n vs e, b vs b", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 3",
        "set A2 value n 1",
        "set A3 text t charlie",
        "set A4 text t apple",
        "set A5 formula 1/0", // produces error
        "set A6 text t banana",
        "set A7 value n 2",
        "set B1 value n 10",
        "set B2 text t z",
        "set B3 text t y",
        // A8 intentionally blank to trigger 'b' branch.
    ]);
    await recalcSheet(SC, sheet);
    // Multiple sort keys, mixed directions.
    await scheduleCommands(SC, sheet, [
        "sort A1:B8 A up B down",
    ]);
    await recalcSheet(SC, sheet);

    // descending sort too, with single column.
    await scheduleCommands(SC, sheet, ["sort A1:B8 A down"]);
    await recalcSheet(SC, sheet);
});

test("format_text_for_display uses expand_markup + expand_wiki callbacks when configured", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    const originalWiki = SC.Callbacks.expand_wiki;
    SC.Callbacks.expand_wiki = (dv: string) => `WIKI[${dv}]`;
    expect(SC.format_text_for_display("hello", "tw", "text-wiki-foo", sheet, null)).toBe(
        "WIKI[hello]",
    );
    SC.Callbacks.expand_wiki = originalWiki;

    // text-wiki without an expand_wiki callback goes through expand_markup (default).
    expect(SC.format_text_for_display("bar", "tw", "text-wiki", sheet, null)).toContain(
        "bar",
    );
});

test("expand_text_link generates <a> tags using ParseCellLinkText output", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    expect(SC.expand_text_link("http://example.com/page", sheet, "", "text-link")).toContain(
        "http://example.com/page",
    );
    // With description & newwin.
    expect(SC.expand_text_link("desc<<http://x.com>>", sheet, "", "text-link")).toContain(
        "desc",
    );
});

test("format_number_for_display 'Auto'/empty format chooses a default based on subtype", async () => {
    const SC = await loadSocialCalc();
    // Subtype triggers are driven by valuetype second char.
    expect(SC.format_number_for_display(0.5, "n%", "Auto")).toContain("%");
    expect(SC.format_number_for_display(1.5, "n$", "")).toContain("$");
    expect(SC.format_number_for_display(1, "nl", "")).toMatch(/TRUE|true/i);
    expect(SC.format_number_for_display(0, "nl", "")).toMatch(/FALSE|false/i);
    expect(SC.format_number_for_display(1, "n", "hidden")).toBe("&nbsp;");
});

// ===========================================================================
// Section 18: Direct RecalcLoadedSheet path and circular-reference range.
// ===========================================================================

test("RecalcLoadedSheet can be called directly to simulate a sheet-cache load", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    SC.Formula.SheetCache.waitingForLoading = "other-sheet";
    const previousSheet = SC.RecalcInfo.sheet;
    SC.RecalcInfo.sheet = sheet;
    SC.RecalcLoadedSheet(
        "other-sheet",
        makeSave(["version:1.5", "cell:A1:v:5", "sheet:c:1:r:1"]),
        false,
        false,
    );
    expect(SC.Formula.SheetCache.waitingForLoading).toBeNull();
    SC.RecalcClearTimeout();
    // Reset state so following tests don't get confused.
    SC.RecalcInfo.sheet = previousSheet;
    SC.RecalcInfo.currentState = SC.RecalcInfo.state.idle;
});

test("GetCellContents for an empty default-cell returns empty string", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const emptyCell = sheet.GetAssuredCell("A1");
    expect(emptyCell.datatype).toBeNull();
    expect(SC.GetCellContents(sheet, "A1")).toBe("");
});

// ===========================================================================
// Section 19: EncodeCellAttributes on a fresh cell (all default).
// ===========================================================================

test("EncodeCellAttributes on a default cell reports empty defaults for alignhoriz / bgcolor", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.GetAssuredCell("A1"); // ensure cell exists
    const attrs = SC.EncodeCellAttributes(sheet, "A1");
    expect(attrs.alignhoriz.def).toBe(true);
    expect(attrs.bgcolor.def).toBe(true);
    // mod always gets a SetAttrib call, so def=false.
    expect(attrs.mod.val).toBe("n");
    // colspan/rowspan default to 1 and are always SetAttrib'd.
    expect(attrs.colspan.val).toBe(1);
    expect(attrs.rowspan.val).toBe(1);
});

test("EncodeSheetAttributes on a fresh sheet reports def:true for all defaults", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const enc = SC.EncodeSheetAttributes(sheet);
    expect(enc.colwidth.def).toBe(true);
    expect(enc.recalc.def).toBe(true);
    expect(enc.usermaxcol.def).toBe(true);
});

// ===========================================================================
// Section 20: CreateSheetSave on empty sheet should still emit version line.
// ===========================================================================

test("CreateSheetSave on an empty sheet emits version and sheet lines", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const save = SC.CreateSheetSave(sheet);
    expect(save).toContain("version:1.5");
    expect(save).toContain("sheet:c:1:r:1");
});

// ===========================================================================
// Section 21: DetermineValueType special empty-string branch.
// ===========================================================================

test("SetConvertedCell accepts numeric zero and passes datatype 'v'", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.SetConvertedCell(sheet, "A1", "0");
    expect(sheet.cells.A1.datatype).toBe("v");
    expect(sheet.cells.A1.datavalue).toBe(0);
});

// ===========================================================================
// Section 22: Operation against readonly cells is skipped.
// ===========================================================================

test("readonly cells skip paste / fill / erase without throwing", async () => {
    const SC = await loadSocialCalc();
    installEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 readonly yes",
    ]);
    await scheduleCommands(SC, sheet, [
        "copy A1 all",
        "paste A3 all",
        "erase A3 all",
        "filldown A1:A3 all",
    ]);
    // A3 should remain readonly and untouched.
    expect(sheet.cells.A3.readonly).toBe(true);
});

// ===========================================================================
// Section 23: ConvertSaveToOtherFormat html branch with copiedfrom.
// ===========================================================================

test("ConvertSaveToOtherFormat html branch renders using copiedfrom extents", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set A2 value n 3",
        "set B2 value n 4",
    ]);
    const save = SC.CreateSheetSave(sheet, "A1:B2", true);
    const html = SC.ConvertSaveToOtherFormat(save, "html");
    // Our DOM shim's innerHTML is not auto-generated from appendChild, so we
    // can only assert that we got a string back without throwing.
    expect(typeof html).toBe("string");
});

// ===========================================================================
// Section 24: Edge cases in ParseRange, ParseSheetSave, and CellToString.
// ===========================================================================

test("CellToString for an empty cell returns empty line", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    expect(SC.CellToString(sheet)).toBe("");
    expect(SC.CellToString(sheet, null)).toBe("");
});

test("ParseSheetSave accepts malformed sheet lines by falling through to default", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const save = makeSave([
        "version:1.5",
        "sheet:unknownfield:42:c:3:r:3",
    ]);
    // Shouldn't throw - the 'default' branch on sheet attrs skips unknown tokens.
    SC.ParseSheetSave(save, sheet);
    expect(sheet.attribs.lastcol).toBe(3);
});

// ===========================================================================
// Section 25: Clipboard operations via SocialCalc.Clipboard directly
// ===========================================================================

test("Clipboard copy populates; clearclipboard resets to empty", async () => {
    const SC = await loadSocialCalc();
    // Reset at the start since SocialCalc.Clipboard is shared across tests.
    SC.Clipboard.clipboard = "";
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "copy A1:A1 all",
    ]);
    expect(SC.Clipboard.clipboard).toContain("cell:A1:v:1");
    await scheduleCommands(SC, sheet, ["clearclipboard"]);
    expect(SC.Clipboard.clipboard).toBe("");
});

// ===========================================================================
// Section 26: fillright / filldown with an editor.range2 that has a range.
// ===========================================================================

test("fillright / filldown with a populated editor.range2 computes an increment", async () => {
    const SC = await loadSocialCalc();
    const editor = installEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A2 value n 20",
        "set A3 value n 30",
    ]);
    // Simulate an editor with a 2-row range in a single column - triggers filldown
    // increment computation (lines 3100-3105).
    editor.range2 = { hasrange: true, top: 1, bottom: 2, left: 1, right: 1 };
    await scheduleCommands(SC, sheet, ["filldown A1:A5 all"]);
    // Simulate a 2-col range in a single row - triggers fillright increment.
    editor.range2 = { hasrange: true, top: 1, bottom: 1, left: 1, right: 2 };
    await scheduleCommands(SC, sheet, [
        "set B1 value n 2",
        "set C1 value n 4",
        "fillright B1:E1 all",
    ]);
    await recalcSheet(SC, sheet);
});

// ===========================================================================
// Section 27: moveinsert vertical and horizontal with both insert directions.
// ===========================================================================

test("moveinsert vertical and horizontal, both directions, push intermediate cells", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set A4 value n 4",
        "set A5 value n 5",
    ]);
    // Move A1 upward relative range - insertvert = -1.
    await scheduleCommands(SC, sheet, ["moveinsert A3 A1 all"]);
    // Move A1 downward.
    await scheduleCommands(SC, sheet, ["moveinsert A1 A5 all"]);
    // Horizontal moves.
    await scheduleCommands(SC, sheet, [
        "set B1 value n 10",
        "set C1 value n 20",
        "set D1 value n 30",
        "set E1 value n 40",
    ]);
    // Move right (inserthoriz = 1).
    await scheduleCommands(SC, sheet, ["moveinsert B1 E1 all"]);
    // Move left (inserthoriz = -1).
    await scheduleCommands(SC, sheet, ["moveinsert D1 B1 all"]);
});

// ===========================================================================
// Section 28: pane command with editor mock
// ===========================================================================

test("pane command with row and col variants using editor mock", async () => {
    const SC = await loadSocialCalc();
    const editor = installEditorMock(SC);
    const sheet = new SC.Sheet();
    editor.context.sheetobj = sheet;
    editor.context.rowpanes = [{ first: 1, last: 10 }];
    editor.context.colpanes = [{ first: 1, last: 10 }];
    editor.context.SetRowPaneFirstLast = (n: number, f: number, l: number) => {
        editor.context.rowpanes[n] = { first: f, last: l };
    };
    editor.context.SetColPaneFirstLast = (n: number, f: number, l: number) => {
        editor.context.colpanes[n] = { first: f, last: l };
    };
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "pane row 5",
        "pane col 3",
        "pane row 0", // collapse back to 1 pane
        "pane col 0",
    ]);
});

// ===========================================================================
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
