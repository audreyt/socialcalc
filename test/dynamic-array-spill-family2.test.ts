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

// --- grow / shrink / collision (mirrors dynamic-array-spill-basic.test.ts) --

test("SEQUENCE spills values while retaining the anchor", async () => {
  const { sheet } = await setup(["set C1 formula SEQUENCE(2,3)"]);
  expect(sheet.cells.C1.datavalue).toBe(1);
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C1.spillcols).toBe(3);
  expect(sheet.cells.D1?.datavalue).toBe(2);
  expect(sheet.cells.D1?.spillowner).toBe("C1");
  expect(sheet.cells.C2?.datavalue).toBe(4);
});

test("TRANSPOSE spills and a non-empty target preserves the #SPILL! blocker", async () => {
  const { sheet } = await setup([
    "set A1 value n 1",
    "set B1 value n 2",
    "set C2 value n 99",
    "set C1 formula TRANSPOSE(A1:B1)",
  ]);
  expect(sheet.cells.C1.valuetype).toBe("e");
  expect(sheet.cells.C1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.C2.datavalue).toBe(99);
  expect(sheet.cells.C2.spillowner).toBeUndefined();
});

test("growth and shrink each complete an independent topology retry (SEQUENCE)", async () => {
  const { SC, sheet } = await setup(["set C1 formula SEQUENCE(2,1)"]);
  expect(sheet.cells.C2?.spillowner).toBe("C1");
  await scheduleCommands(SC, sheet, "set C1 formula SEQUENCE(4,1)");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBe(4);
  expect(sheet.cells.C4?.spillowner).toBe("C1");
  await scheduleCommands(SC, sheet, "set C1 formula SEQUENCE(1,1)");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBe(1); // single-cell array result still spills (spillrows=1)
  expect(sheet.cells.C2).toBeUndefined();
  expect(sheet.cells.C4).toBeUndefined();
});

test("overlapping spill formulas: the later-claimed cell wins and the earlier spill collides", async () => {
  const { sheet } = await setup([
    "set A1 value n 1",
    "set B1 formula EXPAND(A1:A1,3,1)",
    "set B2 formula SEQUENCE(2,1)",
  ]);
  // B2's own formula claims B2 as ordinary content before B1's spill can
  // reclaim it, so B1's 3-row spill collides and reports #SPILL!, while
  // B2's own 2-row SEQUENCE spill succeeds using B2/B3.
  expect(sheet.cells.B1.valuetype).toBe("e");
  expect(sheet.cells.B1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.B1.spillrows).toBeUndefined();
  expect(sheet.cells.B2.datavalue).toBe(1);
  expect(sheet.cells.B2.spillrows).toBe(2);
  expect(sheet.cells.B3?.spillowner).toBe("B2");
  expect(sheet.cells.B3?.datavalue).toBe(2);
});

// --- merged cells / collisions (mirrors dynamic-array-spill-commands.test.ts) --

test("merged spill anchors reject the array without changing the merge (HSTACK)", async () => {
  const { sheet } = await setup([
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 77",
    "set D1 value n 88",
    "merge C1:D1",
    "set C1 formula HSTACK(A1:A1,B1:B1)",
  ]);
  expect(sheet.cells.C1.valuetype).toBe("e");
  expect(sheet.cells.C1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.C1.colspan).toBe(2);
  expect(sheet.cells.D1).toBeUndefined();
});

test("set on a spill child is rejected; anchor set clears the spill (TRANSPOSE)", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set C1 formula TRANSPOSE(A1:A2)",
  ]);
  expect(sheet.cells.D1?.spillowner).toBe("C1");
  const setChildResult = execute(SC, sheet, "set D1 value n 5");
  expect(setChildResult).toBe(ERROR);
  expect(sheet.cells.D1?.datavalue).toBe(2);
  execute(SC, sheet, "set C1 value n 9");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBeUndefined();
  expect(sheet.cells.D1).toBeUndefined();
});

test("ordinary commands preserve spill ownership and undo/redo (WRAPROWS)", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set C1 formula WRAPROWS(TRANSPOSE(A1:A4),2)",
  ]);
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C1.spillcols).toBe(2);
  expect(sheet.cells.D2?.spillowner).toBe("C1");
  execute(SC, sheet, "set F1 value n 42");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.D2?.spillowner).toBe("C1");
  await sheetUndo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.F1).toBeUndefined();
  await sheetRedo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.F1?.datavalue).toBe(42);
  expect(sheet.cells.C1.spillrows).toBe(2);
});

// --- save / load / recalc round-trip -----------------------------------------

test("full save roundtrips CHOOSECOLS spill metadata and children", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "set A2 value n 4",
    "set B2 value n 5",
    "set C2 value n 6",
    "set E1 formula CHOOSECOLS(A1:C2,3,1)",
  ]);
  const save = sheet.CreateSheetSave();
  expect(save).toContain(":spillrows:2:spillcols:2");
  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  expect(copy.cells.E1.spillrows).toBe(2);
  expect(copy.cells.F1.spillowner).toBe("E1");
  expect(copy.cells.F1.datavalue).toBe(1);
  expect(copy.cells.E2.datavalue).toBe(6);
});

test("recalc after load reproduces the same spill footprint (SEQUENCE)", async () => {
  const { SC, sheet } = await setup(["set C1 formula SEQUENCE(3,2)"]);
  const save = sheet.CreateSheetSave();
  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  await recalcSheet(SC, copy);
  expect(copy.cells.C1.spillrows).toBe(3);
  expect(copy.cells.C1.spillcols).toBe(2);
  expect(copy.cells.D3?.spillowner).toBe("C1");
  expect(copy.cells.D3?.datavalue).toBe(6);
});

test("legacy saves remain unaffected by the new array function family", async () => {
  const legacy = "version:1.5\ncell:A1:v:3\nsheet:c:1:r:1\n";
  const plain = new (await loadSocialCalc()).Sheet();
  plain.ParseSheetSave(legacy);
  expect(plain.CreateSheetSave()).not.toContain("spillrows");
});

test("range save strips anchor spill metadata while preserving the formula text (SORTBY)", async () => {
  const { sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set E1 value n 2",
    "set E2 value n 1",
    "set C1 formula SORTBY(A1:A2,E1:E2)",
  ]);
  const anchor = sheet.CreateSheetSave("C1:C1");
  expect(anchor).toContain("SORTBY");
  expect(anchor).not.toContain("spillrows");
  expect(anchor).not.toContain("spillowner");
});

test("recalc rebuilds the DROP spill after a dependency edit", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set C1 formula DROP(A1:A3,1)",
  ]);
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C1.datavalue).toBe(2);
  await scheduleCommands(SC, sheet, "set A2 value n 99");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.datavalue).toBe(99);
  expect(sheet.cells.C2?.datavalue).toBe(3);
});

test("FILTER spills and recalculates as its include mask changes", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set D1 value n 0",
    "set D2 value n 1",
    "set D3 value n 1",
    "set C1 formula FILTER(A1:A3,D1:D3)",
  ]);
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C1.datavalue).toBe(2);
  expect(sheet.cells.C2?.datavalue).toBe(3);
  await scheduleCommands(SC, sheet, "set D1 value n 1");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBe(3);
  expect(sheet.cells.C1.datavalue).toBe(1);
  expect(sheet.cells.C3?.datavalue).toBe(3);
  await scheduleCommands(SC, sheet, "set D3 value n 0");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C1.datavalue).toBe(1);
  expect(sheet.cells.C2?.datavalue).toBe(2);
  expect(sheet.cells.C3).toBeUndefined();
});

test("FILTER transitioning to #CALC! clears a previous spill footprint", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set D1 value n 1",
    "set D2 value n 0",
    "set C1 formula FILTER(A1:A2,D1:D2)",
  ]);
  expect(sheet.cells.C1.spillrows).toBe(1); // single-cell array result still spills (spillrows=1)
  expect(sheet.cells.C1.datavalue).toBe(1);
  await scheduleCommands(SC, sheet, "set D1 value n 0");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.valuetype).toBe("e#CALC!");
  expect(sheet.cells.C1.spillrows).toBeUndefined();
});
