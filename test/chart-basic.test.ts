import { expect, test } from "vite-plus/test";
import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

async function setup() {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  return { SC, sheet };
}

test("ChartObject constructs with sane defaults and never overwrites cell data", async () => {
  const { SC } = await setup();
  const chart = new SC.ChartObject("chart1");
  expect(chart.id).toBe("chart1");
  expect(chart.charttype).toBe(SC.Chart.TYPE_COLUMN);
  expect(chart.anchorcoord).toBe("A1");
  expect(chart.widthpx).toBeGreaterThanOrEqual(SC.Chart.MIN_SIZE_PX);
  expect(chart.heightpx).toBeGreaterThanOrEqual(SC.Chart.MIN_SIZE_PX);
  expect(chart.sourceranges).toEqual([]);
});

test("chart create command adds a chart without touching cell data", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
  await scheduleCommands(SC, sheet, "chart create c1 D1 480 320 0 0 A1:A2");
  expect(sheet.charts.c1).toBeDefined();
  expect(sheet.charts.c1.anchorcoord).toBe("D1");
  expect(sheet.charts.c1.sourceranges).toEqual(["A1:A2"]);
  // cell data untouched
  expect(sheet.cells.A1.datavalue).toBe(1);
  expect(sheet.cells.A2.datavalue).toBe(2);
  expect(sheet.cells.D1).toBeUndefined();
});

test("chart move/resize/delete commands", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart move c1 C3");
  expect(sheet.charts.c1.anchorcoord).toBe("C3");
  await scheduleCommands(SC, sheet, "chart resize c1 600 400");
  expect(sheet.charts.c1.widthpx).toBe(600);
  expect(sheet.charts.c1.heightpx).toBe(400);
  await scheduleCommands(SC, sheet, "chart delete c1");
  expect(sheet.charts.c1).toBeUndefined();
});

test("chart resize clamps to [MIN_SIZE_PX, MAX_SIZE_PX]", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart resize c1 1 999999");
  expect(sheet.charts.c1.widthpx).toBe(SC.Chart.MIN_SIZE_PX);
  expect(sheet.charts.c1.heightpx).toBe(SC.Chart.MAX_SIZE_PX);
});

test("chart set updates title/legend/axis labels and sanitizes them", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, [
    "chart set c1 title Revenue",
    "chart set c1 hastitle 1",
    "chart set c1 haslegend 0",
    "chart set c1 legendposition bottom",
    "chart set c1 xaxislabel Quarter",
    "chart set c1 yaxislabel Dollars",
  ]);
  const chart = sheet.charts.c1;
  expect(chart.title).toBe("Revenue");
  expect(chart.hastitle).toBe(true);
  expect(chart.haslegend).toBe(false);
  expect(chart.legendposition).toBe("bottom");
  expect(chart.xaxislabel).toBe("Quarter");
  expect(chart.yaxislabel).toBe("Dollars");
});

test("chart set legendposition rejects unknown values, falling back to right", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart set c1 legendposition javascript:alert(1)");
  expect(sheet.charts.c1.legendposition).toBe("right");
});

test("chart set charttype only accepts the six closed codes", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart set c1 charttype 4");
  expect(sheet.charts.c1.charttype).toBe(SC.Chart.TYPE_PIE);
  await scheduleCommands(SC, sheet, "chart set c1 charttype 99");
  expect(sheet.charts.c1.charttype).toBe(SC.Chart.TYPE_PIE); // unchanged: invalid code rejected
});

test("chart set sourceranges replaces the series ranges", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart set c1 sourceranges B1:B5|C1:C5");
  expect(sheet.charts.c1.sourceranges).toEqual(["B1:B5", "C1:C5"]);
});

test("commands targeting an unknown chart id are safely ignored", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart move ghost C3");
  await scheduleCommands(SC, sheet, "chart resize ghost 100 100");
  await scheduleCommands(SC, sheet, "chart delete ghost");
  await scheduleCommands(SC, sheet, "chart set ghost title x");
  expect(sheet.charts.ghost).toBeUndefined();
});

test("SC.Chart.CategoryCount picks the orthogonal axis to SeriesCount", async () => {
  const { SC } = await setup();
  expect(SC.Chart.CategoryCount(3, 5, true)).toBe(5);
  expect(SC.Chart.CategoryCount(3, 5, false)).toBe(3);
});

test("chart set seriesinrows toggles the series orientation", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  expect(sheet.charts.c1.seriesinrows).toBe(false);
  await scheduleCommands(SC, sheet, "chart set c1 seriesinrows 1");
  expect(sheet.charts.c1.seriesinrows).toBe(true);
  await scheduleCommands(SC, sheet, "chart set c1 seriesinrows 0");
  expect(sheet.charts.c1.seriesinrows).toBe(false);
});

test("chart set with an unknown attribute reports an error and leaves the chart unchanged", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  const before = { ...sheet.charts.c1 };
  await scheduleCommands(SC, sheet, "chart set c1 bogusattrib xyz");
  expect(sheet.charts.c1.anchorcoord).toBe(before.anchorcoord);
  expect(sheet.charts.c1.widthpx).toBe(before.widthpx);
});

test("chart create with saveundo=false skips undo recording and default fallback tokens apply", async () => {
  const { SC, sheet } = await setup();
  // omit anchor/width/height/type tokens -> "" tokens trigger fallback branches
  await scheduleCommands(SC, sheet, "chart create c1     ", false);
  const chart = sheet.charts.c1;
  expect(chart.anchorcoord).toBe("A1"); // "" || "A1"
  expect(chart.widthpx).toBe(480); // +"" (NaN) || 480
  expect(chart.heightpx).toBe(320);
  expect(chart.charttype).toBe(SC.Chart.TYPE_COLUMN); // invalid/missing type falls back
  expect(sheet.changes.TOS()).toBeNull(); // no undo step recorded
});

test("chart create with an out-of-range type token falls back to TYPE_COLUMN", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 99 0 A1:A2");
  expect(sheet.charts.c1.charttype).toBe(SC.Chart.TYPE_COLUMN);
});

test("chart resize with a missing height token falls back to the current height", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart resize c1 600", false);
  expect(sheet.charts.c1.widthpx).toBe(600);
  expect(sheet.charts.c1.heightpx).toBe(320); // fallback: missing token keeps prior height
});

test("every chart set attribute with saveundo=false still applies its value without recording undo", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(
    SC,
    sheet,
    [
      "chart set c1 title T",
      "chart set c1 hastitle 1",
      "chart set c1 haslegend 0",
      "chart set c1 legendposition bottom",
      "chart set c1 xaxislabel X",
      "chart set c1 yaxislabel Y",
      "chart set c1 charttype 2",
      "chart set c1 seriesinrows 1",
      "chart set c1 sourceranges B1:B2",
    ],
    false,
  );
  const chart = sheet.charts.c1;
  expect(chart.title).toBe("T");
  expect(chart.hastitle).toBe(true);
  expect(chart.haslegend).toBe(false);
  expect(chart.legendposition).toBe("bottom");
  expect(chart.xaxislabel).toBe("X");
  expect(chart.yaxislabel).toBe("Y");
  expect(chart.charttype).toBe(2);
  expect(chart.seriesinrows).toBe(true);
  expect(chart.sourceranges).toEqual(["B1:B2"]);
});

test("chart delete with saveundo=false does not record undo", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart delete c1", false);
  expect(sheet.charts.c1).toBeUndefined();
});

test("chart move with saveundo=false does not record undo", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart move c1 B2", false);
  expect(sheet.charts.c1.anchorcoord).toBe("B2");
});

test("chart resize with a missing width token falls back to the current width", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart resize c1  400");
  expect(sheet.charts.c1.widthpx).toBe(480); // fallback: missing token keeps prior width
  expect(sheet.charts.c1.heightpx).toBe(400);
});

test("chart set haslegend/sourceranges undo records the false/empty side of each ternary", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  await scheduleCommands(SC, sheet, "chart set c1 haslegend 0"); // now false; undo recorded "1" (prior true)
  await scheduleCommands(SC, sheet, "chart set c1 haslegend 0"); // still false; undo now records "0"
  expect(sheet.charts.c1.haslegend).toBe(false);
  await scheduleCommands(SC, sheet, "chart set c1 sourceranges");
  expect(sheet.charts.c1.sourceranges).toEqual([]);
});

test("an unknown chart subcommand is silently ignored (no matching what branch)", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 A1 480 320 0 0 A1:A2");
  const before = { ...sheet.charts.c1 };
  await scheduleCommands(SC, sheet, "chart bogus c1 xyz");
  expect(sheet.charts.c1).toEqual(before);
});
