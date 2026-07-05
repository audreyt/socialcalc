import { expect, test } from "bun:test";

import {
    loadSocialCalc,
    recalcSheet,
    scheduleCommands,
    sheetRedo,
    sheetUndo,
} from "./helpers/socialcalc";

const COPY_CLIPBOARD_SNAPSHOT =
    "version:1.5\n" +
    "cell:D4:vtf:e#N/A:0:C4+C3\n" +
    "sheet:c:4:r:4:needsrecalc:yes\n" +
    "copiedfrom:D4:D4\n";

test("copy clipboard stays anchored through insertrow/insertcol and tiles into a lower-left paste range", async () => {
    const SC = await loadSocialCalc();
    SC.Clipboard.clipboard = "";
    const sheet = new SC.Sheet();

    await scheduleCommands(SC, sheet, [
        "set C3 value n 30",
        "set C4 value n 40",
        "set D4 formula C4+C3",
        "copy D4 formulas",
    ]);
    await scheduleCommands(SC, sheet, [
        "insertcol A",
        "insertrow 1",
        "paste B2:C3 formulas",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2?.formula).toBe("A2+A1");
    expect(sheet.cells.C2?.formula).toBe("B2+B1");
    expect(sheet.cells.B3?.formula).toBe("A3+A2");
    expect(sheet.cells.C3?.formula).toBe("B3+B2");
    expect(sheet.cells.E5?.formula).toBe("D5+D4");
    expect(SC.Clipboard.clipboard).toBe(COPY_CLIPBOARD_SNAPSHOT);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B2?.formula).toBeUndefined();
    expect(sheet.cells.C3?.formula ?? "").toBe("");
    expect(SC.Clipboard.clipboard).toBe(COPY_CLIPBOARD_SNAPSHOT);

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B2?.formula).toBe("A2+A1");
    expect(sheet.cells.C3?.formula).toBe("B3+B2");
    expect(sheet.cells.E5?.formula).toBe("D5+D4");
});

test("cut clipboard survives source erasure and structural inserts before a negative paste", async () => {
    const SC = await loadSocialCalc();
    SC.Clipboard.clipboard = "";
    const sheet = new SC.Sheet();

    await scheduleCommands(SC, sheet, [
        "set C3 value n 30",
        "set C4 value n 40",
        "set D4 formula C4+C3",
        "cut D4 formulas",
    ]);
    await scheduleCommands(SC, sheet, [
        "insertcol A",
        "insertrow 1",
        "paste B2 formulas",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2?.formula).toBe("A2+A1");
    expect(sheet.cells.D4?.datavalue).toBe(30);
    expect(sheet.cells.D5?.datavalue).toBe(40);
    expect(sheet.cells.E5?.formula).toBe("");
    expect(sheet.cells.E5?.datatype ?? null).toBeNull();
    expect(SC.Clipboard.clipboard).toBe(COPY_CLIPBOARD_SNAPSHOT);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B2?.formula).toBeUndefined();
    expect(SC.Clipboard.clipboard).toBe(COPY_CLIPBOARD_SNAPSHOT);

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B2?.formula).toBe("A2+A1");
    expect(sheet.cells.E5?.formula).toBe("");
    expect(sheet.cells.E5?.datatype ?? null).toBeNull();
});

test("loadclipboard exact 2x2 scsave persists through structural inserts and lower-left paste", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    const clipSave =
        "version:1.5\n" +
        "cell:C3:vtf:e#N/A:0:B3+B2\n" +
        "cell:C4:vtf:e#N/A:0:B4+B3\n" +
        "cell:D3:vtf:e#N/A:0:C3+C2\n" +
        "cell:D4:vtf:e#N/A:0:C4+C3\n" +
        "sheet:c:4:r:4:needsrecalc:yes\n" +
        "copiedfrom:C3:D4\n";

    const LOAD_CLIPBOARD_AFTER =
        "version:1.5\n" +
        "cell:C3:vtf:e#N/A:0:B3+B2\n" +
        "cell:C4:vtf:e#N/A:0:B4+B3\n" +
        "cell:D3:vtf:e#N/A:0:C3+C2\n" +
        "cell:D4:vtf:e#N/A:0:C4+C3\n" +
        "sheet:c:4:r:4:needsrecalc:yes\n" +
        "copiedfrom:C3:D4\n";

    await scheduleCommands(SC, sheet, ["clearclipboard", "set F6 value n 99"]);
    await scheduleCommands(SC, sheet, [
        "insertcol A",
        "insertrow 1",
        "loadclipboard " + SC.encodeForSave(clipSave),
        "paste B2 formulas",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B2?.formula).toBe("A2+A1");
    expect(sheet.cells.B3?.formula).toBe("A3+A2");
    expect(sheet.cells.C2?.formula).toBe("B2+B1");
    expect(sheet.cells.C3?.formula).toBe("B3+B2");
    expect(sheet.cells.G7?.datavalue).toBe(99);
    expect(sheet.attribs.lastcol).toBe(7);
    expect(sheet.attribs.lastrow).toBe(7);
    expect(SC.Clipboard.clipboard).toBe(LOAD_CLIPBOARD_AFTER);

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.F6?.datavalue).toBe(99);
    expect(SC.Clipboard.clipboard).toBe("");
    expect(sheet.attribs.lastcol).toBe(6);
    expect(sheet.attribs.lastrow).toBe(6);

    await sheetRedo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.B2?.formula).toBe("A2+A1");
    expect(sheet.cells.C3?.formula).toBe("B3+B2");
    expect(sheet.cells.G7?.datavalue).toBe(99);
});