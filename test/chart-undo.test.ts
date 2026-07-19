import { expect, test } from "vite-plus/test";
import { loadSocialCalc, scheduleCommands, sheetRedo, sheetUndo } from "./helpers/socialcalc";

async function setup() {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  return { SC, sheet };
}

test("undo/redo chart create", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  expect(sheet.charts.c1).toBeDefined();
  await sheetUndo(SC, sheet);
  expect(sheet.charts.c1).toBeUndefined();
  await sheetRedo(SC, sheet);
  expect(sheet.charts.c1).toBeDefined();
  expect(sheet.charts.c1.anchorcoord).toBe("A1");
});

test("undo delete fully restores anchor, size, type, series orientation, and ranges", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 C5 600 400 4 1 A1:B3|D1:D3");
  await scheduleCommands(SC, sheet, [
    "chart set c1 title Sales",
    "chart set c1 hastitle 1",
    "chart set c1 haslegend 0",
    "chart set c1 legendposition bottom",
    "chart set c1 xaxislabel X",
    "chart set c1 yaxislabel Y",
  ]);
  const before = { ...sheet.charts.c1 };

  await scheduleCommands(SC, sheet, "chart delete c1");
  expect(sheet.charts.c1).toBeUndefined();

  await sheetUndo(SC, sheet);
  const restored = sheet.charts.c1;
  expect(restored).toBeDefined();
  expect(restored.anchorcoord).toBe(before.anchorcoord);
  expect(restored.widthpx).toBe(before.widthpx);
  expect(restored.heightpx).toBe(before.heightpx);
  expect(restored.charttype).toBe(before.charttype);
  expect(restored.seriesinrows).toBe(before.seriesinrows);
  expect(restored.sourceranges).toEqual(before.sourceranges);
  expect(restored.title).toBe(before.title);
  expect(restored.hastitle).toBe(before.hastitle);
  expect(restored.haslegend).toBe(before.haslegend);
  expect(restored.legendposition).toBe(before.legendposition);
  expect(restored.xaxislabel).toBe(before.xaxislabel);
  expect(restored.yaxislabel).toBe(before.yaxislabel);
});

test("undo move/resize/set restores prior state", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart move c1 F9");
  await sheetUndo(SC, sheet);
  expect(sheet.charts.c1.anchorcoord).toBe("A1");

  await scheduleCommands(SC, sheet, "chart resize c1 700 500");
  await sheetUndo(SC, sheet);
  expect(sheet.charts.c1.widthpx).toBe(480);
  expect(sheet.charts.c1.heightpx).toBe(320);

  await scheduleCommands(SC, sheet, "chart set c1 title Hello");
  await sheetUndo(SC, sheet);
  expect(sheet.charts.c1.title).toBe("");
});

test("single undo step reverts multiple chained chart commands", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, [
    "chart move c1 B2",
    "chart resize c1 500 500",
    "chart set c1 title Combined",
  ]);
  expect(sheet.charts.c1.anchorcoord).toBe("B2");
  await sheetUndo(SC, sheet);
  expect(sheet.charts.c1.anchorcoord).toBe("A1");
  expect(sheet.charts.c1.widthpx).toBe(480);
  expect(sheet.charts.c1.title).toBe("");
});
