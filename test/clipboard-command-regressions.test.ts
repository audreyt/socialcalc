import { expect, test } from "vite-plus/test";

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
  await scheduleCommands(SC, sheet, ["insertcol A", "insertrow 1", "paste B2:C3 formulas"]);
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
  await scheduleCommands(SC, sheet, ["insertcol A", "insertrow 1", "paste B2 formulas"]);
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

test("bare loadclipboard command records its own undo entry, restoring prior clipboard", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 value n 5", "copy A1 formulas"]);
  const priorClipboard = SC.Clipboard.clipboard;
  expect(priorClipboard).not.toBe("");

  const newClip = "version:1.5\ncell:B1:v:9\nsheet:c:1:r:1\ncopiedfrom:B1:B1\n";
  await scheduleCommands(SC, sheet, ["loadclipboard " + SC.encodeForSave(newClip)]);
  expect(SC.Clipboard.clipboard).toBe(newClip);

  // Without the loadclipboard case recording its own AddUndo, this undo
  // step would be a no-op for the clipboard (leaving newClip in place)
  // since no undo entry was pushed for the bare loadclipboard command.
  await sheetUndo(SC, sheet);
  expect(SC.Clipboard.clipboard).toBe(priorClipboard);

  await sheetRedo(SC, sheet);
  expect(SC.Clipboard.clipboard).toBe(newClip);
});

// Policy lock-in (ClipboardScout tip 6856a2d): cut = CreateSheetSave + erase +
// paste via OffsetFormulaCoords (copy semantics). movepaste = in-sheet move via
// ReplaceFormulaCoords. Do NOT rewrite cut to Excel-style move.

test("cut multi-cell $ abs is copy+erase Offset: internal $ markers dangle at erased sources", async () => {
  const SC = await loadSocialCalc();
  SC.Clipboard.clipboard = "";
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set B1 value n 20",
    "set A2 formula $A$1+B1",
    "set B2 formula A1+$B$1",
    "cut A1:B2 all",
    "paste D1 all",
  ]);
  await recalcSheet(SC, sheet);

  // Relative coords offset with the paste; absolute markers stay pinned to
  // original A1/B1 which cut erased → dangling refs, values 20 and 10.
  expect(sheet.cells.D1?.datavalue).toBe(10);
  expect(sheet.cells.E1?.datavalue).toBe(20);
  expect(sheet.cells.D2?.formula).toBe("$A$1+E1");
  expect(sheet.cells.D2?.datavalue).toBe(20);
  expect(sheet.cells.E2?.formula).toBe("D1+$B$1");
  expect(sheet.cells.E2?.datavalue).toBe(10);
  expect(sheet.cells.A1).toBeUndefined();
  expect(sheet.cells.B1).toBeUndefined();
  expect(sheet.cells.A2).toBeUndefined();
  expect(sheet.cells.B2).toBeUndefined();
});

test("movepaste multi-cell $ abs is Replace: rewrites markers unlike cut copy+erase", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set B1 value n 20",
    "set A2 formula $A$1+B1",
    "set B2 formula A1+$B$1",
    "movepaste A1:B2 D1 all",
  ]);
  await recalcSheet(SC, sheet);

  // Contrast with cut+paste ($A$1+E1 / D1+$B$1, values 20/10): Replace rewrites
  // $ markers to the destination and values stay live at 30.
  expect(sheet.cells.D1?.datavalue).toBe(10);
  expect(sheet.cells.E1?.datavalue).toBe(20);
  expect(sheet.cells.D2?.formula).toBe("$D$1+E1");
  expect(sheet.cells.D2?.datavalue).toBe(30);
  expect(sheet.cells.E2?.formula).toBe("D1+$E$1");
  expect(sheet.cells.E2?.datavalue).toBe(30);
  expect(sheet.cells.A1).toBeUndefined();
  expect(sheet.cells.B2).toBeUndefined();

  // Explicit cut ≠ movepaste for abs-internal formulas.
  expect(sheet.cells.D2?.formula).not.toBe("$A$1+E1");
  expect(sheet.cells.E2?.formula).not.toBe("D1+$B$1");
});

test("cut leaves external $ observer and name dangling; movepaste Replace rewrites both", async () => {
  const SC = await loadSocialCalc();

  // cut = copy+erase: observers/names outside the cut range are not rewritten.
  SC.Clipboard.clipboard = "";
  const cutSheet = new SC.Sheet();
  await scheduleCommands(SC, cutSheet, [
    "set A1 value n 5",
    "set B1 formula $A$1",
    "name define ABSF =$A$1*2",
    "cut A1 all",
    "paste F1 all",
  ]);
  await recalcSheet(SC, cutSheet);

  expect(cutSheet.cells.F1?.datavalue).toBe(5);
  expect(cutSheet.cells.B1?.formula).toBe("$A$1");
  expect(cutSheet.names.ABSF.definition).toBe("=$A$1*2");
  expect(cutSheet.cells.A1).toBeUndefined();

  // movepaste = Replace: external $ observer and named formula follow the move.
  const moveSheet = new SC.Sheet();
  await scheduleCommands(SC, moveSheet, [
    "set A1 value n 5",
    "set B1 formula $A$1",
    "name define ABSF =$A$1*2",
    "movepaste A1 F1 all",
  ]);
  await recalcSheet(SC, moveSheet);

  expect(moveSheet.cells.F1?.datavalue).toBe(5);
  expect(moveSheet.cells.B1?.formula).toBe("$F$1");
  expect(moveSheet.names.ABSF.definition).toBe("=$F$1*2");
  expect(moveSheet.cells.A1).toBeUndefined();

  expect(cutSheet.cells.B1?.formula).not.toBe(moveSheet.cells.B1?.formula);
  expect(cutSheet.names.ABSF.definition).not.toBe(moveSheet.names.ABSF.definition);
});

test("cut paste Offsets sheet-qualified coords; movepaste Replace keeps sheetref sticky", async () => {
  const SC = await loadSocialCalc();

  // cut+paste uses OffsetFormulaCoords: Sheet2!A1 shifts with the paste delta.
  // Skip recalc: phantom Sheet2 would hang waitingForLoading without an editor.
  SC.Clipboard.clipboard = "";
  const cutSheet = new SC.Sheet();
  await scheduleCommands(SC, cutSheet, [
    "set A1 value n 2",
    "set B1 formula A1+Sheet2!A1",
    "cut A1:B1 all",
    "paste D3 all",
  ]);

  expect(cutSheet.cells.D3?.datavalue).toBe(2);
  expect(cutSheet.cells.E3?.formula).toBe("D3+SHEET2!D3");
  expect(cutSheet.cells.A1).toBeUndefined();
  expect(cutSheet.cells.B1).toBeUndefined();

  // movepaste uses ReplaceFormulaCoords: sheet-qualified A1 stays sticky.
  const moveSheet = new SC.Sheet();
  await scheduleCommands(SC, moveSheet, [
    "set A1 value n 2",
    "set B1 formula A1+Sheet2!A1",
    "movepaste A1:B1 D3 all",
  ]);

  expect(moveSheet.cells.D3?.datavalue).toBe(2);
  expect(moveSheet.cells.E3?.formula).toBe("D3+SHEET2!A1");
  expect(moveSheet.cells.A1).toBeUndefined();
  expect(moveSheet.cells.B1).toBeUndefined();

  expect(cutSheet.cells.E3?.formula).not.toBe(moveSheet.cells.E3?.formula);
});
