import { expect, test } from "vite-plus/test";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

async function setup() {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  await recalcSheet(SC, sheet);
  return { SC, sheet };
}

test("full save roundtrips materialized spill metadata and children", async () => {
  const { SC, sheet } = await setup();
  const save = sheet.CreateSheetSave();
  expect(save).toContain(":spillrows:3:spillcols:1");
  expect(save).toContain(":spillowner:C1:spillrow:1:spillcol:0");
  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  expect(copy.cells.C1.spillrows).toBe(3);
  expect(copy.cells.C2.spillowner).toBe("C1");
  expect(copy.cells.C2.datavalue).toBe(2);
});

test("sanitization removes malformed anchors and dangling or misplaced children", async () => {
  const { SC, sheet } = await setup();
  sheet.cells.C1.spillrows = 0;
  sheet.cells.C1.spillcols = 99;
  sheet.cells.Z9 = new SC.Cell("Z9");
  sheet.cells.Z9.spillowner = "C1";
  sheet.cells.Z9.spillrow = 1;
  sheet.cells.Z9.spillcol = 1;
  sheet.cells.Y9 = new SC.Cell("Y9");
  sheet.cells.Y9.spillowner = "NOPE";
  sheet.cells.Y9.spillrow = 1;
  sheet.cells.Y9.spillcol = 1;
  SC.SanitizeSpills(sheet);
  expect(sheet.cells.C1.spillrows).toBeUndefined();
  expect(sheet.cells.C2).toBeUndefined();
  expect(sheet.cells.Z9).toBeUndefined();
  expect(sheet.cells.Y9).toBeUndefined();
});

test("legacy saves remain byte-for-byte unchanged", async () => {
  const legacy = "version:1.5\ncell:A1:v:3\nsheet:c:1:r:1\n";
  const plain = new (await loadSocialCalc()).Sheet();
  plain.ParseSheetSave(legacy);
  expect(plain.CreateSheetSave()).not.toContain("spillrows");
});

test("range save strips anchor and child ownership while preserving values", async () => {
  const { sheet } = await setup();
  const anchor = sheet.CreateSheetSave("C1:C1");
  const child = sheet.CreateSheetSave("C2:C2");
  expect(anchor).toContain(":vtf:n:1:SORT");
  expect(anchor).not.toContain("spillrows");
  expect(anchor).not.toContain("spillowner");
  expect(child).toContain(":v:2");
  expect(child).not.toContain("spillowner");
  expect(child).not.toContain("spillrow");
});

test("pasting range creates formula anchor and ordinary scalar child", async () => {
  const { SC, sheet } = await setup();
  const save = sheet.CreateSheetSave("C1:C2");
  const dest = new SC.Sheet();
  dest.ParseSheetSave(save);
  expect(dest.cells.C1.datatype).toBe("f");
  expect(dest.cells.C1.spillrows).toBeUndefined();
  expect(dest.cells.C2.datatype).toBe("v");
  expect(dest.cells.C2.spillowner).toBeUndefined();
});

test("range save preserves text spill child datatype after stripping ownership", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t z",
    "set A2 text t a",
    "set C1 formula SORT(A1:A2,1,1)",
  ]);
  await recalcSheet(SC, sheet);
  const save = sheet.CreateSheetSave("C2:C2");
  expect(save).toContain("cell:C2:t:z");
  expect(save).not.toContain(":spillowner");
  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  expect(copy.cells.C2.datavalue).toBe("z");
  expect(copy.cells.C2.spillowner).toBeUndefined();
});
