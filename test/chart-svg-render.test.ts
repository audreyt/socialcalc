import { expect, test } from "vite-plus/test";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

async function setup() {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  return { SC, sheet };
}

test("renders a deterministic self-contained SVG string with no canvas/network refs", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Q1",
    "set A2 text t Q2",
    "set B1 value n 10",
    "set B2 value n 20",
    "chart create c1 D1 480 320 0 0 A1:B2",
  ]);
  // value-level proof this is a single-series (header-column-only) layout,
  // not a phantom-series misparse of the label column.
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  expect(data.categories).toEqual(["Q1", "Q2"]);
  expect(data.series).toEqual([[10, 20]]);
  const svg1 = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  const svg2 = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg1).toBe(svg2); // deterministic: identical state -> byte-identical output
  expect(svg1.startsWith("<svg")).toBe(true);
  expect(svg1.endsWith("</svg>")).toBe(true);
  expect(svg1).toContain('width="480"');
  expect(svg1).toContain('height="320"');
  expect(svg1).not.toContain("<canvas");
  // the SVG xmlns itself is the standard "http://www.w3.org/2000/svg" URI
  // (required, never fetched); assert no *other* network reference exists.
  expect(svg1.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toContain("http://");
  expect(svg1).not.toContain("https://");
  expect(svg1).not.toContain("<image");
  expect(svg1).not.toContain("<script");
});

test("degrades gracefully in non-DOM environments: RenderChartSVG never touches document/window", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 D1 480 320 0 0 A1:B1",
  ]);
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  try {
    // Not just unset -- throw if touched, proving the renderer is DOM-free.
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      get() {
        throw new Error("RenderChartSVG must not touch `window`");
      },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      get() {
        throw new Error("RenderChartSVG must not touch `document`");
      },
    });
    const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
    expect(typeof svg).toBe("string");
    expect(svg).toContain("<svg");
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
      writable: true,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
      writable: true,
    });
  }
});

test("chart with no source ranges renders a placeholder without throwing", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, "chart create c1 D1 480 320 0 0");
  expect(sheet.charts.c1.sourceranges).toEqual([]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).toContain("No data");
});

test("numeric, text, blank, and error cells are all handled without throwing", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Label",
    "set A2 value n 5",
    "set A3 formula 1/0",
    // A4 left blank deliberately
    "chart create c1 D1 480 320 0 0 A1:A4",
  ]);
  await recalcSheet(SC, sheet);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(typeof svg).toBe("string");
  expect(svg).toContain("<svg");
});

test("ExtractSourceData: an explicitly materialized blank cell (valuetype 'b') is treated as zero, not an error", async () => {
  const { SC, sheet } = await setup();
  sheet.GetAssuredCell("A2"); // materializes a real blank cell distinct from an absent one
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "chart create c1 D1 300 300 0 0 A1:A2"]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  expect(data.series).toEqual([[1, 0]]);
});

test("multiple series render with distinct closed-palette colors", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 5",
    "set A2 value n 2",
    "set B2 value n 6",
    "chart create c1 D1 480 320 0 1 A1:B2", // seriesinrows=1: each row is a series
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  const paletteHitCount = SC.Chart.PALETTE.filter((color: string) => svg.includes(color)).length;
  expect(paletteHitCount).toBeGreaterThanOrEqual(1);
});

test("pie chart renders wedge paths summing to a full circle for positive values", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set A2 value n 20",
    "set A3 value n 30",
    "chart create c1 D1 300 300 4 0 A1:A3",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  const pathCount = (svg.match(/<path /g) || []).length;
  expect(pathCount).toBe(3);
});

test("pie chart with all-zero/negative values renders an empty-ring placeholder, never NaN", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 0",
    "set A2 value n -5",
    "chart create c1 D1 300 300 4 0 A1:A2",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  expect(svg).toContain("#eeeeee");
});

test("scatter chart plots (x,y) circles with a non-degenerate x domain", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 value n 10",
    "set B2 value n 5",
    "set B3 value n 8",
    "chart create c1 D1 300 300 5 0 A1:B3", // scatter, seriesinrows=0: column A supplies x-values, column B is the y-series
  ]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  // the x-value row itself must be captured, not skipped as a phantom header
  expect(data.xValues).toEqual([1, 2, 3]);
  expect(data.series).toEqual([[10, 5, 8]]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  const circleCount = (svg.match(/<circle /g) || []).length;
  expect(circleCount).toBe(3);
});

test("scatter chart handles an explicit zero y-value without NaN", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 0",
    "set B2 value n 5",
    "chart create c1 D1 300 300 5 0 A1:B2",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  const circleCount = (svg.match(/<circle /g) || []).length;
  expect(circleCount).toBe(2); // one point per (x,y) pair: (1,0) and (2,5)
});

test("negative and zero-crossing domains render bars on both sides of the zero axis without NaN", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t a",
    "set A2 text t b",
    "set B1 value n -10",
    "set B2 value n 10",
    "chart create c1 D1 300 300 0 0 A1:B2",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
});

test("degenerate all-equal-value domain still renders (line chart) without NaN", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t a",
    "set A2 text t b",
    "set B1 value n 7",
    "set B2 value n 7",
    "chart create c1 D1 300 300 2 0 A1:B2",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
});

test("hostile category-label cell content is escaped, never live markup, in the rendered SVG", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t </text><script>alert(1)</script>",
    "set A2 text t normal",
    "set B1 value n 1",
    "set B2 value n 2",
    "chart create c1 D1 480 320 0 0 A1:B2",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  // the raw payload must never appear as live markup
  expect(svg).not.toContain("<script>");
  expect(svg).not.toContain("</text><script>");
  // it must appear escaped instead
  // category axis labels are sanitized to 16 chars before escaping:
  // "</text><script>alert(1)</script>" truncates to "</text><script>" then escapes.
  expect(svg).toContain("&lt;/text&gt;&lt;script&gt;");
});

test("hostile chart title with quote/attribute-breakout content is escaped in both the title text and aria-label attribute", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 D1 480 320 0 0 A1:B1",
    "chart set c1 hastitle 1",
    "chart set c1 title " + SC.encodeForSave('"><image href=x onerror=alert(1)>'),
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  // never a live <image> tag or an attribute-breakout quote/angle-bracket
  expect(svg).not.toContain("<image");
  expect(svg).not.toContain('"><image');
  // both the aria-label attribute and the visible <text> title are escaped
  expect(svg).toContain("&quot;&gt;&lt;image href=x onerror=alert(1)&gt;");
});

test("ampersand/quote/angle-bracket mix is fully escaped in series names", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t cat",
    "set B1 text t " + SC.encodeForSave('a&b<c>"d"'), // header row -> series name (seriesinrows=false)
    "set A2 text t x",
    "set B2 value n 5",
    "chart create c1 D1 480 320 0 0 A1:B2",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain('a&b<c>"d"');
  expect(svg).toContain("a&amp;b&lt;c&gt;");
});

test("SanitizeLabel strips control characters and collapses newlines/tabs before escaping", async () => {
  const { SC } = await setup();
  const dirty = "line1\nline2\ttab\u0000\u001fend";
  const clean = SC.Chart.SanitizeLabel(dirty, 200);
  expect(clean).not.toContain("\n");
  expect(clean).not.toContain("\t");
  expect(clean).not.toContain("\u0000");
  expect(clean).not.toContain("\u001f");
  expect(clean).toBe("line1 line2 tabend");
});

test("SanitizeLabel hard-truncates long sheet-derived text", async () => {
  const { SC } = await setup();
  const long = "x".repeat(500);
  expect(SC.Chart.SanitizeLabel(long, 10)).toBe("x".repeat(10));
  expect(SC.Chart.SanitizeLabel(long).length).toBeLessThanOrEqual(120); // default cap
});

test("area chart renders a filled polygon plus its outline polyline", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t a",
    "set A2 text t b",
    "set B1 value n 3",
    "set B2 value n 9",
    "chart create c1 D1 300 300 3 0 A1:B2", // TYPE_AREA
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).toContain("<polygon");
  expect(svg).toContain("<polyline");
  expect(svg).not.toContain("NaN");
});

test("bar chart (horizontal) renders one rect per series/category pair", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t a",
    "set A2 text t b",
    "set B1 value n 4",
    "set B2 value n -2",
    "chart create c1 D1 300 300 1 0 A1:B2", // TYPE_BAR
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  // two categories, one series each => at least two data rects beyond the axis lines
  const rectCount = (svg.match(/<rect /g) || []).length;
  expect(rectCount).toBeGreaterThanOrEqual(2);
});

test("column chart with a single category still renders without division-by-zero artifacts", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t only",
    "set B1 value n 5",
    "chart create c1 D1 300 300 0 0 A1:B1",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  expect(svg).not.toContain("Infinity");
});

test("line chart with a single category centers its one point without NaN", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t only",
    "set B1 value n 5",
    "chart create c1 D1 300 300 2 0 A1:B1",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
});

test("chart with two series renders a legend rect per series", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 3",
    "set B2 value n 4",
    "chart create c1 D1 300 300 0 1 A1:B2", // seriesinrows=1 -> 2 series (rows A, B)
  ]);
  expect(sheet.charts.c1.sourceranges).toEqual(["A1:B2"]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  // one 10x10 legend swatch rect per series, plus data rects
  const legendSwatches = (svg.match(/<rect x="[^"]+" y="[^"]+" width="10" height="10"/g) || [])
    .length;
  expect(legendSwatches).toBe(2);
});

test("legendposition none suppresses legend swatches even with haslegend true", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t a",
    "set B1 value n 1",
    "chart create c1 D1 300 300 0 0 A1:B1",
  ]);
  expect(sheet.charts.c1.haslegend).toBe(true); // default
  const svgWithLegend = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svgWithLegend).toMatch(/<rect x="[^"]+" y="[^"]+" width="10" height="10"/);

  await scheduleCommands(SC, sheet, "chart set c1 legendposition none");
  expect(sheet.charts.c1.haslegend).toBe(true); // still true; position alone must suppress
  const svgNoLegend = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svgNoLegend).not.toMatch(/<rect x="[^"]+" y="[^"]+" width="10" height="10"/);
});

test("a reversed/malformed source range is skipped rather than crashing the renderer", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 D1 300 300 0 0 A1:B1",
  ]);
  // directly corrupt sourceranges past what the command layer would allow,
  // to exercise ExtractSourceData's invalid-shape skip path.
  sheet.charts.c1.sourceranges = ["B3:A1"];
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).toContain("No data");
});

test("SanitizeLabel handles null/undefined sheet-derived values", async () => {
  const { SC } = await setup();
  expect(SC.Chart.SanitizeLabel(null)).toBe("");
  expect(SC.Chart.SanitizeLabel(undefined)).toBe("");
});

test("zero widthpx/heightpx fall back to the minimum size instead of rendering a 0x0 SVG", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 D1 480 320 0 0 A1:B1",
  ]);
  sheet.charts.c1.widthpx = 0;
  sheet.charts.c1.heightpx = 0;
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).toContain('width="' + SC.Chart.MIN_SIZE_PX + '"');
  expect(svg).toContain('height="' + SC.Chart.MIN_SIZE_PX + '"');
});

test("an out-of-range charttype value falls back to rendering as a column chart", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t a",
    "set B1 value n 5",
    "chart create c1 D1 300 300 0 0 A1:B1",
  ]);
  sheet.charts.c1.charttype = 99; // bypasses the command-layer validator directly
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  expect(SC.Chart.TYPE_NAMES[99]).toBeUndefined();
});

test("legendposition bottom shrinks the plot height and renders a horizontal legend row", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 3",
    "set B2 value n 4",
    "chart create c1 D1 300 300 0 1 A1:B2", // 2 series
    "chart set c1 legendposition bottom",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  const legendSwatches = svg.match(/<rect x="([^"]+)" y="([^"]+)" width="10" height="10"/g) || [];
  expect(legendSwatches.length).toBe(2);
  // horizontal layout: swatches differ in x, share the same y
  const ys = legendSwatches.map((m: string) => /y="([^"]+)"/.exec(m)![1]);
  expect(new Set(ys).size).toBe(1);
});

test("pie chart with legendposition bottom renders a horizontal category legend", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set A2 value n 20",
    "chart create c1 D1 300 300 4 0 A1:A2",
    "chart set c1 legendposition bottom",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  const legendSwatches = svg.match(/<rect x="([^"]+)" y="([^"]+)" width="10" height="10"/g) || [];
  expect(legendSwatches.length).toBe(2);
});

test("area chart with a single category centers its one point without NaN", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t only",
    "set B1 value n 5",
    "chart create c1 D1 300 300 3 0 A1:B1", // TYPE_AREA, one category
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  expect(svg).toContain("<polygon");
});

test("pie chart with a zero-value slice among positive slices renders only the nonzero wedges", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set A2 value n 0",
    "set A3 value n 20",
    "chart create c1 D1 300 300 4 0 A1:A3",
  ]);
  const svg = SC.Chart.RenderChartSVG(sheet, sheet.charts.c1);
  expect(svg).not.toContain("NaN");
  const pathCount = (svg.match(/<path /g) || []).length;
  expect(pathCount).toBe(2); // the zero-value slice contributes no path
});

test("ExtractSourceData: seriesInRows=true with a lead label column picks names/categories from the right cells", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Row1",
    "set A2 text t Row2",
    "set B1 value n 1",
    "set C1 value n 2",
    "set B2 value n 3",
    "set C2 value n 4",
    "chart create c1 D1 300 300 0 1 A1:C2", // seriesinrows=1, lead column A holds row labels
  ]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  expect(data.seriesNames).toEqual(["Row1", "Row2"]);
  expect(data.categories).toEqual(["1", "2"]);
  expect(data.series).toEqual([
    [1, 2],
    [3, 4],
  ]);
});

test("ExtractSourceData: seriesInRows=false with both a header row and header column resolves the ambiguous corner as a label", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Col1",
    "set B1 text t Col2",
    "set A2 text t CatX",
    "set A3 text t CatY",
    "set B2 value n 5",
    "set B3 value n 6",
    "chart create c1 D1 300 300 0 0 A1:B3", // seriesinrows=0, header row + header col
  ]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  // column A is entirely the label column; only column B carries real data.
  expect(data.seriesNames).toEqual(["Col2"]);
  expect(data.categories).toEqual(["CatX", "CatY"]);
  expect(data.series).toEqual([[5, 6]]);
});

test("ExtractSourceData: seriesInRows=false with a header column but no header row keeps every data column as a series", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Q1",
    "set A2 text t Q2",
    "set B1 value n 10",
    "set B2 value n 20",
    "chart create c1 D1 300 300 0 0 A1:B2", // header column only, no header row
  ]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  expect(data.seriesNames).toEqual(["Series 1"]);
  expect(data.categories).toEqual(["Q1", "Q2"]);
  expect(data.series).toEqual([[10, 20]]);
});

test("ExtractSourceData: a blank name cell within a labeled series axis falls back to the default series name", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    // A1 left blank; A2 has a label -> hasHeaderCol true, but row 0's name cell is blank
    "set A2 text t Row2",
    "set B1 value n 1",
    "set B2 value n 2",
    "chart create c1 D1 300 300 0 1 A1:B2", // seriesinrows=1
  ]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  expect(data.seriesNames).toEqual(["Series 1", "Row2"]);
});

test("ExtractSourceData: a blank category-label cell within a labeled category axis falls back to a numeric index", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    // A1 left blank; B1 has a label -> hasHeaderRow true, but column 0's label cell is blank
    "set B1 text t ColB",
    "set A2 value n 1",
    "set B2 value n 2",
    "chart create c1 D1 300 300 0 0 A1:B2", // seriesinrows=0
  ]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  expect(data.categories).toEqual(["1"]);
});

test("ExtractSourceData: seriesInRows=true pulls category labels from row 0, falling back to a numeric index for blank cells", async () => {
  const { SC, sheet } = await setup();
  await scheduleCommands(SC, sheet, [
    "set B1 text t CatB", // row0 has a header for column B only -> hasHeaderRow true
    "set A2 text t Row2", // column A has a header for row 2 -> hasHeaderCol true (series name)
    "set B2 value n 5",
    "set C2 value n 6", // column C's row-0 label cell (C1) is blank
    "chart create c1 D1 300 300 0 1 A1:C2", // seriesinrows=1
  ]);
  const data = SC.Chart.ExtractSourceData(sheet, sheet.charts.c1);
  expect(data.seriesNames).toEqual(["Row2"]);
  expect(data.categories).toEqual(["CatB", "3"]); // C1 blank -> falls back to index
  expect(data.series).toEqual([[5, 6]]);
});
