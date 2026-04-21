import { expect, test } from "bun:test";

import {
    loadSocialCalc,
    makeSave,
    recalcSheet,
    scheduleCommands,
    sheetRedo,
    sheetUndo,
    waitForStatus,
} from "./helpers/socialcalc";

test("loads the SocialCalc bundle through Bun's module loader", async () => {
    const SC = await loadSocialCalc();

    expect(typeof SC.Sheet).toBe("function");
    expect(typeof SC.Formula).toBe("object");
    expect(typeof SC.ParseSheetSave).toBe("function");
    expect(typeof SC.ScheduleSheetCommands).toBe("function");
    expect(typeof SC.RecalcSheet).toBe("function");
});

test("parses and round-trips encoded sheet saves", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const formula = "B1*2";
    const encodedText = SC.encodeForSave("hello\nworld");
    const save = makeSave([
        "version:1.5",
        `cell:A1:t:${encodedText}`,
        "cell:B1:v:42",
        `cell:C1:vtf:n:0:${SC.encodeForSave(formula)}`,
        "sheet:c:3:r:2",
    ]);

    SC.ParseSheetSave(save, sheet);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("hello\nworld");
    expect(sheet.GetAssuredCell("B1").datavalue).toBe(42);
    expect(sheet.GetAssuredCell("C1").datavalue).toBe(84);
    expect(sheet.GetAssuredCell("C1").formula).toBe(formula);
    expect(sheet.attribs.lastcol).toBe(3);
    expect(sheet.attribs.lastrow).toBe(2);

    const roundTrip = SC.CreateSheetSave(sheet);
    expect(roundTrip).toContain(`cell:A1:t:${encodedText}`);
    expect(roundTrip).toContain("cell:B1:v:42");
    expect(roundTrip).toContain(`cell:C1:vtf:n:84:${SC.encodeForSave(formula)}`);
    expect(roundTrip).toContain("sheet:c:3:r:1");
});

test("scheduled commands build audit history and support undo/redo", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const commands = [
        "set A width 120",
        "set 1 height 30",
        "set A1 value n 10",
        "set B1 formula A1*2",
        "set C1 text t hello",
        "name define TOTAL A1+B1",
        "name desc TOTAL first_total",
        "set D1 formula A1+B1",
    ];

    await scheduleCommands(SC, sheet, commands, true);
    await recalcSheet(SC, sheet);

    expect(sheet.colattribs.width.A).toBe("120");
    expect(sheet.rowattribs.height[1]).toBe("30");
    expect(sheet.GetAssuredCell("B1").datavalue).toBe(20);
    expect(sheet.GetAssuredCell("C1").datavalue).toBe("hello");
    expect(sheet.GetAssuredCell("D1").datavalue).toBe(30);
    expect(sheet.names.TOTAL.definition).toBe("A1+B1");
    expect(sheet.names.TOTAL.desc).toBe("first_total");

    const audit = SC.CreateAuditString(sheet);
    expect(audit).toContain("set A1 value n 10");
    expect(audit).toContain("name define TOTAL A1+B1");
    expect(audit).toContain("set D1 formula A1+B1");

    await sheetUndo(SC, sheet);
    expect(sheet.cells.A1).toBeUndefined();
    expect(sheet.cells.B1).toBeUndefined();
    expect(sheet.cells.C1).toBeUndefined();
    expect(sheet.names.TOTAL).toBeUndefined();

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.GetAssuredCell("B1").datavalue).toBe(20);
    expect(sheet.GetAssuredCell("D1").datavalue).toBe(30);
});

test("covers coordinate, escaping, and import-export helpers", async () => {
    const SC = await loadSocialCalc();

    expect(SC.rcColname(28)).toBe("AB");
    expect(SC.crToCoord(3, 5)).toBe("C5");
    expect(SC.coordToCr("AA12")).toEqual({ col: 27, row: 12 });
    expect(SC.ParseRange("B2:D4")).toEqual({
        cr1: { col: 2, row: 2, coord: "B2" },
        cr2: { col: 4, row: 4, coord: "D4" },
    });
    expect(SC.OffsetFormulaCoords("SUM(A1:B2)+$C$3", 1, 2)).toBe("SUM(B3:C4)+$C$3");
    expect(SC.AdjustFormulaCoords("SUM(A1:B2)+C3", 1, 1, 1, 2)).toBe("SUM(B3:C4)+D5");
    expect(SC.ReplaceFormulaCoords("A1+B2", { A1: "C3", B2: "D4" })).toBe("C3+D4");

    expect(SC.DetermineValueType("$1,234.50")).toEqual({ value: 1234.5, type: "n$" });
    expect(SC.DetermineValueType("12.5%")).toEqual({ value: 0.125, type: "n%" });

    expect(SC.special_chars('<a&"b>')).toBe("&lt;a&amp;&quot;b&gt;");
    expect(SC.Lookup("b", ["a", "b", "c"])).toBe(1);

    const csvSave = SC.ConvertOtherFormatToSave("name,score\nAda,42", "csv");
    expect(csvSave).toContain("cell:A1:t:name");
    expect(csvSave).toContain("cell:B2:v:42");
    expect(SC.ConvertSaveToOtherFormat(csvSave, "csv")).toBe("name,score\nAda,42\n");
    expect(SC.ConvertSaveToOtherFormat(csvSave, "tab")).toBe("name\tscore\nAda\t42\n");
});

test("waitForStatus rejects when the expected status never arrives", async () => {
    const fakeSheet: any = { statuscallback: null };
    await expect(
        waitForStatus(fakeSheet, "never-fires", () => {}, 5),
    ).rejects.toThrow(/timed out/);
    // The timeout handler restores the previous (null) callback.
    expect(fakeSheet.statuscallback).toBeNull();
});
