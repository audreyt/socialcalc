import { expect, test } from "bun:test";

import {
    loadSocialCalc,
    recalcSheet,
    scheduleCommands,
    sheetRedo,
    sheetUndo,
} from "./helpers/socialcalc";

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

test("copy/paste mixed absolute refs then insertcol shifts structural anchors and undo restores paste offset", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    SC.Clipboard.clipboard = "";
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set B2 formula $A1+A$1+$A$1+A1",
    ]);

    await scheduleCommands(SC, sheet, ["copy B2 formulas", "paste D4 formulas"]);
    await scheduleCommands(SC, sheet, ["insertcol A"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.C2?.formula).toBe("$B1+B$1+$B$1+B1");
    expect(sheet.cells.E4?.formula).toBe("$B3+D$1+$B$1+D3");
    expect(sheet.cells.D4).toBeUndefined();

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2?.formula).toBe("$A1+A$1+$A$1+A1");
    expect(sheet.cells.D4?.formula).toBe("$A3+C$1+$A$1+C3");
    expect(sheet.cells.E4).toBeUndefined();

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.C2?.formula).toBe("$B1+B$1+$B$1+B1");
    expect(sheet.cells.E4?.formula).toBe("$B3+D$1+$B$1+D3");
    expect(sheet.cells.B2).toBeUndefined();
    expect(sheet.cells.D4).toBeUndefined();
});

test("filldown mixed row absolutes then insertrow shifts absolute row anchors and preserves undo/redo", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set B2 formula $A1+A$1+$A$1+A1",
    ]);

    await scheduleCommands(SC, sheet, ["filldown B2:B4 formulas"]);
    await scheduleCommands(SC, sheet, ["insertrow 1"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2).toBeUndefined();
    expect(sheet.cells.B3?.formula).toBe("$A2+A$2+$A$2+A2");
    expect(sheet.cells.B4?.formula).toBe("$A3+A$2+$A$2+A3");
    expect(sheet.cells.B5?.formula).toBe("$A4+A$2+$A$2+A4");

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2?.formula).toBe("$A1+A$1+$A$1+A1");
    expect(sheet.cells.B3?.formula).toBe("$A2+A$1+$A$1+A2");
    expect(sheet.cells.B4?.formula).toBe("$A3+A$1+$A$1+A3");
    expect(sheet.cells.B5).toBeUndefined();

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2).toBeUndefined();
    expect(sheet.cells.B3?.formula).toBe("$A2+A$2+$A$2+A2");
    expect(sheet.cells.B4?.formula).toBe("$A3+A$2+$A$2+A3");
    expect(sheet.cells.B5?.formula).toBe("$A4+A$2+$A$2+A4");
});

test("fillright mixed absolute refs then deletecol A maps deleted absolute and relative column refs to REF with undo/redo", async () => {
    const SC = await loadSocialCalc();
    installHeadlessEditorMock(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set B1 value n 20",
        "set C1 value n 30",
        "set B2 formula $A1+A$1+$A$1+A1",
    ]);

    await scheduleCommands(SC, sheet, ["fillright B2:D2 formulas"]);
    await scheduleCommands(SC, sheet, ["deletecol A"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.A2?.formula).toBe("#REF!+#REF!+#REF!+#REF!");
    expect(sheet.cells.A2?.valuetype).toBe("e#REF!");
    expect(sheet.cells.B2?.formula).toBe("#REF!+A$1+#REF!+A1");
    expect(sheet.cells.B2?.valuetype).toBe("e#REF!");
    expect(sheet.cells.C2?.formula).toBe("#REF!+B$1+#REF!+B1");
    expect(sheet.cells.C2?.valuetype).toBe("e#REF!");
    expect(sheet.cells.D2).toBeUndefined();

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2?.formula).toBe("$A1+A$1+$A$1+A1");
    expect(sheet.cells.C2?.formula).toBe("$A1+B$1+$A$1+B1");
    expect(sheet.cells.D2?.formula).toBe("$A1+C$1+$A$1+C1");

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.A2?.formula).toBe("#REF!+#REF!+#REF!+#REF!");
    expect(sheet.cells.B2?.formula).toBe("#REF!+A$1+#REF!+A1");
    expect(sheet.cells.C2?.formula).toBe("#REF!+B$1+#REF!+B1");
    expect(sheet.cells.D2).toBeUndefined();
});