import { expect, test } from "bun:test";

import {
    loadSocialCalc,
    recalcSheet,
    scheduleCommands,
    sheetUndo,
} from "./helpers/socialcalc";

const MAX_COL = 702;

interface BoundaryEditorHost {
    CurrentSpreadsheetControlObject?: {
        editor: {
            range2: { hasrange: boolean };
            Range2Remove(): void;
        };
    };
}

function installHeadlessEditorMock(SC: BoundaryEditorHost) {
    SC.CurrentSpreadsheetControlObject = {
        editor: {
            range2: { hasrange: false },
            Range2Remove() {
                this.range2.hasrange = false;
            },
        },
    };
}

test("fillright at ZZ maps a relative ref shifted past max column to REF", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        `set sheet lastcol ${MAX_COL}`,
        "set ZY1 formula ZZ1",
        "set ZZ1 value n 0",
    ]);

    await scheduleCommands(SC, sheet, ["fillright ZY1:ZZ1 formulas"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.ZZ1?.formula).toBe("#REF!");
    expect(sheet.cells.ZZ1?.valuetype).toBe("e#REF!");
});

test("paste at ZZ maps a relative ref shifted past max column to REF", async () => {
    const SC = await loadSocialCalc();
    SC.Clipboard.clipboard = "";
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        `set sheet lastcol ${MAX_COL}`,
        "set ZY1 formula ZZ1",
        "set ZZ1 value n 0",
    ]);

    await scheduleCommands(SC, sheet, ["copy ZY1 formulas", "paste ZZ1 formulas"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.ZZ1?.formula).toBe("#REF!");
    expect(sheet.cells.ZZ1?.valuetype).toBe("e#REF!");
});

test("insertcol ZZ at max column preserves ZZ cell and keeps lastcol at max", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        `set sheet lastcol ${MAX_COL}`,
        "set ZZ1 text t boundary-marker",
        "set ZZ1 comment edge",
    ]);

    await scheduleCommands(SC, sheet, ["insertcol ZZ"]);

    expect(sheet.attribs.lastcol).toBe(MAX_COL);
    expect(sheet.cells.ZZ1?.datavalue).toBe("boundary-marker");
    expect(sheet.cells.ZZ1?.comment).toBe("edge");
});

test("insertcol before ZZ at max column leaves the sheet unchanged", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        `set sheet lastcol ${MAX_COL}`,
        "set ZX1 formula ZY1+ZZ1",
        "set ZY1 value n 1",
        "set ZZ1 value n 2",
    ]);

    await scheduleCommands(SC, sheet, ["insertcol ZY"]);

    expect(sheet.attribs.lastcol).toBe(MAX_COL);
    expect(sheet.cells.ZX1?.formula).toBe("ZY1+ZZ1");
    expect(sheet.cells.ZY1?.datavalue).toBe(1);
    expect(sheet.cells.ZZ1?.datavalue).toBe(2);
});

test("deletecol undo restores formulas in cells before the deleted column", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula B1+C1",
        "set B1 value n 2",
        "set C1 value n 3",
    ]);

    await scheduleCommands(SC, sheet, ["deletecol B"]);
    expect(sheet.cells.A1?.formula).toBe("#REF!+B1");

    await sheetUndo(SC, sheet);
    expect(sheet.cells.A1?.formula).toBe("B1+C1");
    expect(sheet.cells.B1?.datavalue).toBe(2);
    expect(sheet.cells.C1?.datavalue).toBe(3);
});

test("deleterow undo restores formulas in cells before the deleted row", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula A2+A3",
        "set A2 value n 2",
        "set A3 value n 3",
    ]);

    await scheduleCommands(SC, sheet, ["deleterow 2"]);
    expect(sheet.cells.A1?.formula).toBe("#REF!+A2");

    await sheetUndo(SC, sheet);
    expect(sheet.cells.A1?.formula).toBe("A2+A3");
    expect(sheet.cells.A2?.datavalue).toBe(2);
    expect(sheet.cells.A3?.datavalue).toBe(3);
});
