import { expect, test } from "bun:test";

import {
    loadSocialCalc,
    recalcSheet,
    scheduleCommands,
} from "./helpers/socialcalc";

// Headless replay has no editor.range2 (ethercalc worker / log replay path).
function installHeadlessEditorMock(SC: any) {
    SC.CurrentSpreadsheetControlObject = {
        editor: {
            range2: { hasrange: false },
            Range2Remove() {
                this.range2 = { hasrange: false };
            },
        },
    };
}

test("filldown without editor.range2 increments from command range and persists in snapshot", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
    ]);
    await scheduleCommands(SC, sheet, ["filldown A1:A5 all"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.A3.datavalue).toBe(3);
    expect(sheet.cells.A4.datavalue).toBe(4);
    expect(sheet.cells.A5.datavalue).toBe(5);

    const save = sheet.CreateSheetSave();
    const reloaded = new SC.Sheet();
    reloaded.ParseSheetSave(save);
    expect(reloaded.cells.A3.datavalue).toBe(3);
    expect(reloaded.cells.A4.datavalue).toBe(4);
    expect(reloaded.cells.A5.datavalue).toBe(5);
});

test("fillright without editor.range2 increments from command range", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set B1 value n 20",
    ]);
    await scheduleCommands(SC, sheet, ["fillright A1:D1 all"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.C1.datavalue).toBe(30);
    expect(sheet.cells.D1.datavalue).toBe(40);
});

test("filldown without editor.range2 increments each column numeric series independently", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set B1 value n 10",
        "set B2 value n 20",
    ]);
    await scheduleCommands(SC, sheet, ["filldown A1:B4 all"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.A3.datavalue).toBe(3);
    expect(sheet.cells.A4.datavalue).toBe(4);
    expect(sheet.cells.B3.datavalue).toBe(30);
    expect(sheet.cells.B4.datavalue).toBe(40);
});

test("fillright without editor.range2 increments each row numeric series independently", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set B1 value n 2",
        "set A2 value n 10",
        "set B2 value n 20",
    ]);
    await scheduleCommands(SC, sheet, ["fillright A1:C2 all"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.C1.datavalue).toBe(3);
    expect(sheet.cells.C2.datavalue).toBe(30);
});

test("filldown without editor.range2 increments date constants", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 constant nd 44927 2023/1/1",
        "set A2 constant nd 44928 2023/1/2",
    ]);
    await scheduleCommands(SC, sheet, ["filldown A1:A4 all"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.A3.datavalue).toBe(44929);
    expect(sheet.cells.A4.datavalue).toBe(44930);

    const save = sheet.CreateSheetSave();
    const reloaded = new SC.Sheet();
    reloaded.ParseSheetSave(save);
    expect(reloaded.cells.A3.datavalue).toBe(44929);
    expect(reloaded.cells.A4.datavalue).toBe(44930);
});