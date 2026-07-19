import { expect, test } from "vite-plus/test";
import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

async function setup() {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "chart create c1 D1 480 320 4 0 A1:B3",
    "chart set c1 title Revenue",
    "chart set c1 hastitle 1",
    "chart set c1 xaxislabel Quarter",
    "chart set c1 yaxislabel Dollars",
    "chart set c1 legendposition bottom",
  ]);
  return { SC, sheet };
}

test("full save round-trips chart id/type/anchor/size/labels/ranges", async () => {
  const { SC, sheet } = await setup();
  const save = sheet.CreateSheetSave();
  expect(save).toContain("chart:c1:4:D1:480:320:0:1:Revenue:1:bottom:Quarter:Dollars:A1\\cB3");

  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  const restored = copy.charts.c1;
  expect(restored).toBeDefined();
  expect(restored.charttype).toBe(4);
  expect(restored.anchorcoord).toBe("D1");
  expect(restored.widthpx).toBe(480);
  expect(restored.heightpx).toBe(320);
  expect(restored.title).toBe("Revenue");
  expect(restored.hastitle).toBe(true);
  expect(restored.xaxislabel).toBe("Quarter");
  expect(restored.yaxislabel).toBe("Dollars");
  expect(restored.legendposition).toBe("bottom");
  expect(restored.sourceranges).toEqual(["A1:B3"]);
});

test("multiple charts round-trip independently, sorted by id for determinism", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create a2 A5 200 200 0 0 C1:C2");
  const save1 = sheet.CreateSheetSave();
  const save2 = sheet.CreateSheetSave();
  expect(save1).toBe(save2); // deterministic across repeated calls

  const copy = new SC.Sheet();
  copy.ParseSheetSave(save1);
  expect(Object.keys(copy.charts).sort()).toEqual(["a2", "c1"]);
  expect(copy.charts.a2.anchorcoord).toBe("A5");
});

test("charts survive a save round trip without altering cell data", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, ["set A1 value n 10", "set B3 text t hello"]);
  const save = sheet.CreateSheetSave();
  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  expect(copy.cells.A1.datavalue).toBe(10);
  expect(copy.cells.B3.datavalue).toBe("hello");
  expect(copy.charts.c1).toBeDefined();
});

test("range/clipboard saves omit charts (anchored sheet objects, not cell content)", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "set A1 value n 1");
  const rangeSave = sheet.CreateSheetSave("A1:B3");
  expect(rangeSave).not.toContain("chart:");
});

test("title/labels containing save-format delimiters round-trip via encodeForSave", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "chart set c1 title " + SC.encodeForSave("Q1: Revenue (up)"),
    "chart set c1 xaxislabel " + SC.encodeForSave("a:b\\c"),
  ]);
  const save = sheet.CreateSheetSave();
  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  expect(copy.charts.c1.title).toBe("Q1: Revenue (up)");
  expect(copy.charts.c1.xaxislabel).toBe("a:b\\c");
});

test("legacy saves without any chart line remain unaffected", async () => {
  const legacy = "version:1.5\ncell:A1:v:3\nsheet:c:1:r:1\n";
  const plain = new (await loadSocialCalc()).Sheet();
  plain.ParseSheetSave(legacy);
  expect(Object.keys(plain.charts)).toEqual([]);
  expect(plain.CreateSheetSave()).not.toContain("chart:");
});

test("malformed chart save line does not throw and produces a defaulted chart object", async () => {
  const malformed = "version:1.5\nsheet:c:1:r:1\nchart:x1\n";
  const sheet = new (await loadSocialCalc()).Sheet();
  expect(() => sheet.ParseSheetSave(malformed)).not.toThrow();
  expect(sheet.charts.x1).toBeDefined();
  expect(sheet.charts.x1.anchorcoord).toBe("A1");
  expect(sheet.charts.x1.sourceranges).toEqual([]);
});

test("a chart save line truncated to just the linetype token defaults every field via ??", async () => {
  const malformed = "version:1.5\nsheet:c:1:r:1\nchart\n";
  const sheet = new (await loadSocialCalc()).Sheet();
  expect(() => sheet.ParseSheetSave(malformed)).not.toThrow();
  const chart = sheet.charts[""];
  expect(chart).toBeDefined();
  expect(chart.charttype).toBe(0);
  expect(chart.anchorcoord).toBe("A1");
  expect(chart.widthpx).toBe(480);
  expect(chart.heightpx).toBe(320);
  expect(chart.title).toBe("");
  expect(chart.legendposition).toBe("right");
  expect(chart.xaxislabel).toBe("");
  expect(chart.yaxislabel).toBe("");
  expect(chart.sourceranges).toEqual([]);
});

test("save round-trips seriesinrows=true and haslegend=false (both boolean-field branches)", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "chart create c2 F1 200 200 2 1 C1:D2",
    "chart set c2 haslegend 0",
  ]);
  expect(sheet.charts.c2.seriesinrows).toBe(true);
  expect(sheet.charts.c2.haslegend).toBe(false);
  const save = sheet.CreateSheetSave();
  const copy = new SC.Sheet();
  copy.ParseSheetSave(save);
  expect(copy.charts.c2.seriesinrows).toBe(true);
  expect(copy.charts.c2.haslegend).toBe(false);
});
