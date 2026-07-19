import { expect, test } from "vite-plus/test";
import { loadSocialCalc, scheduleCommands, sheetUndo } from "./helpers/socialcalc";

async function setup() {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "chart create c1 D5 480 320 0 0 A1:B3|C1:C3",
  ]);
  return { SC, sheet };
}

test("insertcol before the chart's source range shifts anchor and ranges right", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "insertcol A1");
  const chart = sheet.charts.c1;
  expect(chart.anchorcoord).toBe("E5"); // D5 -> E5
  expect(chart.sourceranges).toEqual(["B1:C3", "D1:D3"]);
});

test("insertrow above the chart's anchor shifts anchor row down", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "insertrow A1");
  expect(sheet.charts.c1.anchorcoord).toBe("D6"); // D5 -> D6
  expect(sheet.charts.c1.sourceranges).toEqual(["A2:B4", "C2:C4"]);
});

test("deletecol removes a source column and shifts remaining refs left", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "deletecol A1");
  const chart = sheet.charts.c1;
  expect(chart.anchorcoord).toBe("C5"); // D5 -> C5
  // A1:B3's left (deleted) endpoint collapses to #REF! (matches shipping
  // AdjustFormulaCoords range-endpoint-deletion semantics); the surviving
  // C1:C3 series shifts left to B1:B3.
  expect(chart.sourceranges).toEqual(["#REF!:A3", "B1:B3"]);
});

test("deleting the chart's entire source range collapses to #REF! but the anchor never disappears", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "deletecol A1:C1");
  const chart = sheet.charts.c1;
  // Anchor D5 is outside the deleted A:C band; it still shifts left normally.
  expect(chart.anchorcoord).toBe("A5");
  // Every source column was deleted -> AdjustFormulaCoords marks it #REF!;
  // AdjustChartForStructuralChange keeps the (unusable) #REF! range string
  // rather than silently dropping the series (host UI surfaces the error).
  expect(chart.sourceranges.join("|")).toContain("REF");
});

test("movepaste of a chart's source range updates the chart to track the moved cells", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "movepaste A1:B3 F1 all");
  expect(sheet.charts.c1.sourceranges[0]).toBe("F1:G3");
});

test("undo of insertcol/insertrow restores the chart's prior anchor and ranges", async () => {
  const { SC, sheet } = await setup();
  const before = { anchor: sheet.charts.c1.anchorcoord, ranges: [...sheet.charts.c1.sourceranges] };
  await scheduleCommands(SC, sheet, "insertcol A1");
  expect(sheet.charts.c1.anchorcoord).not.toBe(before.anchor);
  await sheetUndo(SC, sheet);
  expect(sheet.charts.c1.anchorcoord).toBe(before.anchor);
  expect(sheet.charts.c1.sourceranges).toEqual(before.ranges);
});

test("multiple charts each adjust independently under the same structural edit", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c2 A10 200 200 0 0 C1:C3");
  await scheduleCommands(SC, sheet, "insertcol A1");
  expect(sheet.charts.c1.sourceranges).toEqual(["B1:C3", "D1:D3"]);
  expect(sheet.charts.c2.sourceranges).toEqual(["D1:D3"]);
  expect(sheet.charts.c2.anchorcoord).toBe("B10");
});

test("deleting the anchor cell's own column keeps the anchor pinned rather than becoming #REF!", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c2 A1 480 320 0 0 D1:D3");
  expect(sheet.charts.c2.anchorcoord).toBe("A1");
  await scheduleCommands(SC, sheet, "deletecol A1");
  expect(sheet.charts.c2.anchorcoord).toBe("A1"); // never becomes the literal string "#REF!"
});
