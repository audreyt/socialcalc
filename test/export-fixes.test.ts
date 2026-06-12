import { expect, test } from "bun:test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

test("CSV import preserves leading = as formulas (#304)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const save = SC.ConvertOtherFormatToSave("1,=A1*2\n", "csv");
    sheet.ParseSheetSave(save);
    await scheduleCommands(SC, sheet, ["recalc"], true, 3000);
    await recalcSheet(SC, sheet, 3000);
    const cell = sheet.GetAssuredCell("B1");
    expect(cell.datatype).toBe("f");
    expect(cell.formula).toBe("A1*2");
});

test("exportCSV applies number format rounding (#638)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(
        SC,
        sheet,
        [
            "set A1 value n 1.9859735",
            "set A1 nontextvalueformat #,##0",
            "recalc",
        ],
        true,
        3000,
    );
    await recalcSheet(SC, sheet, 3000);
    expect(SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "csv").trim()).toBe("2");
});

test("exportCSV formats date cells (#355)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(
        SC,
        sheet,
        [
            "set A1 value d 2010-01-01",
            "set A1 nontextvalueformat m/d/yyyy",
            "recalc",
        ],
        true,
        3000,
    );
    await recalcSheet(SC, sheet, 3000);
    const csv = SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "csv").trim();
    expect(csv).not.toBe("NaN");
    expect(csv).not.toContain("32874");
    expect(csv).toMatch(/1\/1\/2010|01\/01\/2010|2010/);
});

test("division preserves currency valuetype (#577)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(
        SC,
        sheet,
        [
            "set A1 constant n$ 142.234 $142.234",
            "set C1 formula A1/2",
            "recalc",
        ],
        true,
        3000,
    );
    await recalcSheet(SC, sheet, 3000);
    const cell = sheet.GetAssuredCell("C1");
    expect(cell.valuetype).toBe("n$");
    expect(SC.FormatCellForExport(sheet, cell, "C1")).toBe("$71.12");
});