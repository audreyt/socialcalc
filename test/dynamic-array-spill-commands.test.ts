import { expect, test } from "vite-plus/test";
import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

const ERROR = "Cannot change part of a spilled array.";
async function setup(commands: string[] = []) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands);
  await recalcSheet(SC, sheet);
  return { SC, sheet };
}
function execute(SC: any, sheet: any, command: string, saveundo = true) {
  return SC.ExecuteSheetCommand(sheet, new SC.Parse(command), saveundo);
}
async function spill(SC: any, sheet: any, source = "A1:A3") {
  await scheduleCommands(SC, sheet, [
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    `set C1 formula SORT(${source},1,1)`,
  ]);
  await recalcSheet(SC, sheet);
}
test("merged spill anchors reject the array without changing the merge", async () => {
  const { sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 value n 77",
    "set D1 value n 88",
    "merge C1:D1",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  expect(sheet.cells.C1.valuetype).toBe("e");
  expect(sheet.cells.C1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.C1.spillrows).toBeUndefined();
  expect(sheet.cells.C1.spillcols).toBeUndefined();
  expect(sheet.cells.C2).toBeUndefined();
  expect(sheet.cells.C1.colspan).toBe(2);
  expect(sheet.cells.D1).toBeUndefined();
  expect(sheet.cells.A1.datavalue).toBe(3);
});

test("merged cells intersecting a spill footprint reject without mutation", async () => {
  const { sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set B2 value n 77",
    "set C2 value n 88",
    "merge B2:C2",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  expect(sheet.cells.C1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.C1.valuetype).toBe("e");
  expect(sheet.cells.C2).toBeUndefined();
  expect(sheet.cells.B2.colspan).toBe(2);
  expect(sheet.cells.B2.datavalue).toBe(77);
});

test("set child rejects unchanged, readonly anchor survives, and anchor set clears", async () => {
  const { SC, sheet } = await setup();
  await spill(SC, sheet);
  expect(execute(SC, sheet, "set C2 value n 9")).toBe(ERROR);
  expect(sheet.cells.C2?.spillowner).toBe("C1");
  execute(SC, sheet, "set C1 readonly yes");
  expect(execute(SC, sheet, "set C1 value n 7")).toBeFalsy();
  expect(sheet.cells.C1?.spillrows).toBeDefined();
  execute(SC, sheet, "set C1 readonly no");
  expect(execute(SC, sheet, "set C1 value n 7")).toBeFalsy();
  expect(sheet.cells.C2).toBeUndefined();
});

test("erase multi-range is atomic and fill rejects child", async () => {
  const { SC, sheet } = await setup();
  await spill(SC, sheet);
  expect(execute(SC, sheet, "erase A1:C2 all")).toBe(ERROR);
  expect(sheet.cells.C1?.spillrows).toBe(3);
  expect(execute(SC, sheet, "filldown C1:C3")).toBe(ERROR);
});

test("rejected sort/filldown over a spill leave no phantom undo entry", async () => {
  const { SC, sheet } = await setup();
  await spill(SC, sheet);
  // Mirror ScheduleSheetCommands: one PushChange starts the undo step that
  // ExecuteSheetCommand's AddDo/AddUndo calls accumulate into.
  sheet.changes.PushChange("");
  expect(execute(SC, sheet, "sort C1:C3 1 up")).toBe(ERROR);
  expect(sheet.changes.TOS().undo).toEqual([]);

  sheet.changes.PushChange("");
  expect(execute(SC, sheet, "filldown C1:C3")).toBe(ERROR);
  expect(sheet.changes.TOS().undo).toEqual([]);
});

test("paste checks actual tiled footprint and sort/merge reject spills", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C2 formula SORT(A1:A3,1,1)",
  ]);
  await recalcSheet(SC, sheet);
  execute(SC, sheet, "copy A1:A3");
  const beforeLastRow = sheet.attribs.lastrow;
  expect(execute(SC, sheet, "paste C1")).toBe(ERROR);
  expect(sheet.attribs.lastrow).toBe(beforeLastRow);
  expect(sheet.cells.C2?.spillrows).toBe(3);
  expect(execute(SC, sheet, "sort C1:C3 1 up")).toBe(ERROR);
  expect(execute(SC, sheet, "merge C1:C2")).toBe(ERROR);
});

test("movepaste blocks spilled source and destination; moveinsert is conservative", async () => {
  const { SC, sheet } = await setup();
  await spill(SC, sheet);
  expect(execute(SC, sheet, "movepaste C1:C3 E1 all")).toBe(ERROR);
  expect(execute(SC, sheet, "movepaste A1:A3 C2 all")).toBe(ERROR);
  expect(execute(SC, sheet, "moveinsert A1:A3 E1 all")).toBe(ERROR);
});

test("ordinary commands and insert row preserve spill ownership and undo/redo", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  await recalcSheet(SC, sheet);
  await scheduleCommands(SC, sheet, ["set E1 value n 4", "insertrow 1"]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C2?.spillrows).toBe(3);
  expect(sheet.cells.C3?.spillowner).toBe("C2");
  await sheetUndo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1?.spillowner).toBeUndefined();
  await sheetRedo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C2?.spillrows).toBe(3);
});

test("invalid max-column insert does not clear spills", async () => {
  const { SC, sheet } = await setup();
  await spill(SC, sheet);
  sheet.attribs.lastcol = 702;
  expect(execute(SC, sheet, "insertcol A")).toBeFalsy();
  expect(sheet.cells.C1?.spillrows).toBe(3);
});

test("delete row rebuilds spill and undo restores the original anchor", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set C3 formula SORT(A1:A3,1,1)",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C3?.spillrows).toBe(3);
  await scheduleCommands(SC, sheet, "deleterow 2");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C2?.spillrows).toBe(2);
  expect(sheet.cells.C3?.spillowner).toBe("C2");
  await sheetUndo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C3?.spillrows).toBe(3);
  expect(sheet.cells.C4?.spillowner).toBe("C3");
});
