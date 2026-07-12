import { expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

const EXCEL_MAX_ROW = 1048576;

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

test("filldown across Excel-style max row keeps shifting refs instead of REF", async () => {
  const SC = await loadSocialCalc();
  installHeadlessEditorMock(SC);
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    `set sheet lastrow ${EXCEL_MAX_ROW}`,
    "set A1048575 formula A1048576",
    "set A1048576 value n 0",
  ]);

  await scheduleCommands(SC, sheet, ["filldown A1048575:A1048577 formulas"]);
  await recalcSheet(SC, sheet);

  expect(sheet.attribs.lastrow).toBe(1048577);
  expect(sheet.cells.A1048576?.formula).toBe("A1048577");
  expect(sheet.cells.A1048576?.valuetype).toBe("n");
  expect(sheet.cells.A1048577?.formula).toBe("A1048578");
  expect(sheet.cells.A1048577?.valuetype).toBe("n");
});

test("paste onto the Excel-style max row keeps the pasted relative row ref", async () => {
  const SC = await loadSocialCalc();
  SC.Clipboard.clipboard = "";
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    `set sheet lastrow ${EXCEL_MAX_ROW}`,
    "set A1048575 formula A1048576",
    "set A1048576 value n 0",
  ]);

  await scheduleCommands(SC, sheet, ["copy A1048575 formulas", "paste A1048576 formulas"]);
  await recalcSheet(SC, sheet);

  expect(sheet.attribs.lastrow).toBe(EXCEL_MAX_ROW);
  expect(sheet.cells.A1048576?.formula).toBe("A1048577");
  expect(sheet.cells.A1048576?.valuetype).toBe("n");
});

test("insertrow at 65536 grows the sheet and rewrites formulas and names with undo/redo", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set sheet lastrow 65536",
    "set A1 formula A65536",
    "name define EDGE A65536",
    "set A65536 value n 9",
  ]);

  await scheduleCommands(SC, sheet, ["insertrow 65536"]);
  await recalcSheet(SC, sheet);

  expect(sheet.attribs.lastrow).toBe(65537);
  expect(sheet.cells.A1?.formula).toBe("A65537");
  expect(sheet.names.EDGE.definition).toBe("A65537");
  expect(sheet.cells.A65537?.datavalue).toBe(9);
  expect(sheet.cells.A65536?.valuetype).toBe("b");

  await sheetUndo(SC, sheet);
  expect(sheet.attribs.lastrow).toBe(65536);
  expect(sheet.cells.A1?.formula).toBe("A65536");
  expect(sheet.names.EDGE.definition).toBe("A65536");
  expect(sheet.cells.A65536?.datavalue).toBe(9);
  expect(sheet.cells.A65537).toBeUndefined();

  await sheetRedo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.attribs.lastrow).toBe(65537);
  expect(sheet.cells.A1?.formula).toBe("A65537");
  expect(sheet.names.EDGE.definition).toBe("A65537");
  expect(sheet.cells.A65537?.datavalue).toBe(9);
  expect(sheet.cells.A65536?.valuetype).toBe("b");
});
