import { expect, test } from "bun:test";

import {
    loadSocialCalc,
    recalcSheet,
    scheduleCommands,
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
