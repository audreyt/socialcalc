import { expect, test } from "vite-plus/test";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

async function spilledSheet() {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set C1 formula SORT(A1:A2,1,1)",
  ]);
  await recalcSheet(SC, sheet);
  return { SC, sheet };
}

test("editor refuses spill children while display formatting keeps the scalar", async () => {
  const { SC, sheet } = await spilledSheet();
  expect(sheet.cells.C2?.spillowner).toBe("C1");
  expect(sheet.cells.C2?.datavalue).toBe(2);
  expect(SC.FormatValueForDisplay(sheet, sheet.cells.C2.datavalue, "C2", "")).toBe("2");

  const scheduled: string[] = [];
  const editor: any = {
    context: { sheetobj: sheet },
    ecell: { coord: "C2", row: 2, col: 3 },
    inputBox: {
      element: { disabled: false },
      ShowInputBox: () => undefined,
      GetText: () => "9",
      DisplayCellContents: () => undefined,
    },
    workingvalues: { ecoord: "C2" },
    cellhandles: { ShowCellHandles: () => undefined },
    EditorScheduleSheetCommands: (command: string) => scheduled.push(command),
  };

  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
  SC.EditorSaveEdit(editor, "9");
  expect(scheduled).toEqual([]);
  expect(editor.state).toBe("start");
});
