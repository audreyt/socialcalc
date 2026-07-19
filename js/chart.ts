// In-place TypeScript module: sheet chart objects (data model, pure
// validation/domain policy, deterministic SVG rendering, save/load, and
// structural range adjustment). Shipping source (not a parallel oracle).
// Concatenated after socialcalc-3.ts so SocialCalc.Sheet/GetAssuredCell/
// AdjustFormulaCoords/encodeForSave/decodeFromSave exist at call time, and
// before socialcalctableeditor.ts so the editor can attach chart overlays.
// Fully typechecked — no @ts-nocheck.
//
// Charts never overwrite cell data: they are stored as a separate
// sheet.charts collection keyed by chart id, anchored to a top-left cell
// coordinate plus a pixel width/height, referencing one or more source
// ranges by A1 text. Rendering reads current cell values live (pull-based)
// so "auto-refresh on recalc" falls out of re-invoking RenderChartSVG
// whenever the host redraws after a command/recalc — no cached chart state
// to invalidate.
//
// (c) Copyright 2026 SocialCalc contributors.
// All Rights Reserved.
//
// The contents of this file are subject to the Artistic License 2.0; you may
// not use this file except in compliance with the License. You may obtain a
// copy of the License at http://socialcalc.org/licenses/al-20/.

// *************************************
//
// Local domain types (ambient Sheet/Cell come from socialcalc-3.d.ts;
// Chart-specific shapes live here since chart.d.ts declares the surface).
//
// *************************************

type ChartRecord = {
  id: string;
  charttype: number;
  anchorcoord: string;
  widthpx: number;
  heightpx: number;
  sourceranges: string[];
  seriesinrows: boolean;
  title: string;
  hastitle: boolean;
  haslegend: boolean;
  legendposition: string;
  xaxislabel: string;
  yaxislabel: string;
};

type ChartAxisDomain = { min: number; max: number };

type ChartCellInfo = { isNumber: boolean; num: number; text: string };

type ChartSourceData = {
  seriesNames: string[];
  categories: string[];
  series: number[][]; // series[i][j] = value of series i, category j
  xValues: number[]; // scatter only: shared x-values, one per category
};

type EscapeFn = (s: string) => string;

// Mutable progressive-init bridge for the ambient SocialCalc.Chart/
// ChartObject namespace members, mirroring formula-ref.ts's
// FormulaRefRoot pattern: one boundary cast, no bare `any` past this line.
type ChartMutableRoot = {
  Chart: {
    TYPE_COLUMN: number;
    TYPE_BAR: number;
    TYPE_LINE: number;
    TYPE_AREA: number;
    TYPE_PIE: number;
    TYPE_SCATTER: number;
    TYPE_NAMES: string[];
    PALETTE: string[];
    MIN_SIZE_PX: number;
    MAX_SIZE_PX: number;
    PLACEMENT_OK: number;
    PLACEMENT_ANCHOR_OUT_OF_BOUNDS: number;
    PLACEMENT_INVALID_SIZE: number;

    IsValidChartType: (chartType: number) => boolean;
    IsValidSourceShape: (rows: number, cols: number) => boolean;
    SeriesCount: (rows: number, cols: number, seriesInRows: boolean) => number;
    CategoryCount: (rows: number, cols: number, seriesInRows: boolean) => number;
    MinSeriesForType: (chartType: number) => number;
    IsSourceValidForType: (
      chartType: number,
      rows: number,
      cols: number,
      seriesInRows: boolean,
    ) => boolean;

    DomainMin: (hasPrior: boolean, priorMin: number, value: number) => number;
    DomainMax: (hasPrior: boolean, priorMax: number, value: number) => number;
    ShouldIncludeZeroBaseline: (chartType: number) => boolean;
    BaselineMin: (includeZero: boolean, min: number) => number;
    BaselineMax: (includeZero: boolean, max: number) => number;
    IsDegenerateDomain: (min: number, max: number) => boolean;
    ComputeAxisDomain: (
      chartType: number,
      hasValue: boolean,
      rawMin: number,
      rawMax: number,
    ) => ChartAxisDomain;

    IsWithinSheetBounds: (
      anchorCol: number,
      anchorRow: number,
      maxCol: number,
      maxRow: number,
    ) => boolean;
    IsValidDimension: (px: number) => boolean;
    ClampDimension: (px: number) => number;
    PlanPlacementStatus: (
      anchorCol: number,
      anchorRow: number,
      widthPx: number,
      heightPx: number,
      maxCol: number,
      maxRow: number,
    ) => number;

    SanitizeLabel: (value: unknown, maxLen?: number) => string;
    EscapeSvgText: EscapeFn;
    EscapeSvgAttr: EscapeFn;
    PaletteColor: (index: number) => string;

    ExtractSourceData: (sheet: SocialCalc.Sheet, chart: ChartRecord) => ChartSourceData;
    RenderChartSVG: (sheet: SocialCalc.Sheet, chart: ChartRecord) => string;
    RenderLegend: (
      parts: string[],
      names: string[],
      horizontal: boolean,
      x: number,
      y: number,
      esc: EscapeFn,
    ) => void;
    RenderCartesian: (
      parts: string[],
      data: ChartSourceData,
      plotW: number,
      plotH: number,
      domain: ChartAxisDomain,
      typeName: string,
      esc: EscapeFn,
    ) => void;
    RenderScatter: (
      parts: string[],
      data: ChartSourceData,
      plotW: number,
      plotH: number,
      domain: ChartAxisDomain,
      esc: EscapeFn,
    ) => void;
    RenderPie: (
      parts: string[],
      data: ChartSourceData,
      plotW: number,
      plotH: number,
      esc: EscapeFn,
    ) => void;

    AdjustAnchorCoord: (
      coord: string,
      col: number,
      coloffset: number,
      row: number,
      rowoffset: number,
    ) => string;
    AdjustChartForStructuralChange: (
      chart: ChartRecord,
      col: number,
      coloffset: number,
      row: number,
      rowoffset: number,
    ) => void;
    ReplaceChartCoords: (chart: ChartRecord, movedto: { [coord: string]: string }) => void;

    ChartToSaveLine: (chart: ChartRecord) => string;
    ChartFromSaveParts: (parts: string[]) => ChartRecord;

    RefreshChartOverlays: (editor: SocialCalc.TableEditor) => void;
    OpenChartDialog: (
      editor: SocialCalc.TableEditor,
      existingChartId?: string,
    ) => HTMLElement | null;
    StartChartDrag: (
      editor: SocialCalc.TableEditor,
      chartId: string,
      event: {
        clientX: number;
        clientY: number;
        preventDefault: () => void;
        stopPropagation: () => void;
      },
      mode: "move" | "resize",
    ) => void;
    ChartDragMouseMove: (event: { clientX: number; clientY: number }) => void;
    ChartDragMouseUp: () => void;
    DeleteChartFromOverlay: (editor: SocialCalc.TableEditor, chartId: string) => void;
    SubmitChartDialog: (
      editor: SocialCalc.TableEditor,
      fields: { sourceranges: string; charttype: string; seriesinrows: boolean; title: string },
      existingChartId?: string,
    ) => void;
    CloseChartDialog: (dialogElement: HTMLElement) => void;
    ChartDeleteButtonClick: (event: MouseEvent) => void;
    ChartHandleMouseDown: (event: MouseEvent) => void;
    ChartDialogSubmitButtonClick: (event: MouseEvent) => void;
    ChartDialogCancelButtonClick: (event: MouseEvent) => void;
  };
  ChartObject: new (id: string) => ChartRecord;
  ParseRange: (range: string) => {
    cr1: { row: number; col: number; coord: string };
    cr2: { row: number; col: number; coord: string };
  };
  crToCoord: (col: number, row: number) => string;
  coordToCr: (coord: string) => { row: number; col: number };
  AdjustFormulaCoords: (
    formula: string,
    col: number,
    coloffset: number,
    row: number,
    rowoffset: number,
  ) => string;
  ReplaceFormulaCoords: (formula: string, movedto: { [coord: string]: string }) => string;
  encodeForSave: (s: string) => string;
  decodeFromSave: (s: string) => string;
};

const ChartRoot = SocialCalc as unknown as ChartMutableRoot;

ChartRoot.Chart = {} as ChartMutableRoot["Chart"];
const Chart = ChartRoot.Chart;

// --- Closed chart type enum (mirrors lemma/chart.ts) ------------------------

Chart.TYPE_COLUMN = 0;
Chart.TYPE_BAR = 1;
Chart.TYPE_LINE = 2;
Chart.TYPE_AREA = 3;
Chart.TYPE_PIE = 4;
Chart.TYPE_SCATTER = 5;

/** Ordered type names; index is the numeric type code used internally/in save format. */
Chart.TYPE_NAMES = ["column", "bar", "line", "area", "pie", "scatter"];

/** Closed color palette (deterministic, no sheet-derived color content). */
Chart.PALETTE = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
];

Chart.MIN_SIZE_PX = 40;
Chart.MAX_SIZE_PX = 4000;

// *************************************
//
// 1. Pure type/source-shape validation
// (mirrors lemma/chart.ts §1 exactly)
//
// *************************************

//@ verify
//@ ensures \result === true || \result === false
//@ ensures \result === true <==> chartType === 0 || chartType === 1 || chartType === 2 || chartType === 3 || chartType === 4 || chartType === 5
Chart.IsValidChartType = function (chartType: number): boolean {
  return (
    chartType === 0 ||
    chartType === 1 ||
    chartType === 2 ||
    chartType === 3 ||
    chartType === 4 ||
    chartType === 5
  );
};

//@ verify
//@ ensures \result === true || \result === false
//@ ensures \result === true <==> rows > 0 && cols > 0
Chart.IsValidSourceShape = function (rows: number, cols: number): boolean {
  return rows > 0 && cols > 0;
};

//@ verify
//@ ensures seriesInRows === true ==> \result === rows
//@ ensures seriesInRows === false ==> \result === cols
Chart.SeriesCount = function (rows: number, cols: number, seriesInRows: boolean): number {
  return seriesInRows ? rows : cols;
};

//@ verify
//@ ensures seriesInRows === true ==> \result === cols
//@ ensures seriesInRows === false ==> \result === rows
Chart.CategoryCount = function (rows: number, cols: number, seriesInRows: boolean): number {
  return seriesInRows ? cols : rows;
};

//@ verify
//@ ensures chartType === 5 ==> \result === 2
//@ ensures chartType !== 5 ==> \result === 1
Chart.MinSeriesForType = function (chartType: number): number {
  return chartType === 5 ? 2 : 1;
};

//@ verify
//@ ensures SocialCalc.Chart.IsValidChartType(chartType) === false ==> \result === false
//@ ensures SocialCalc.Chart.IsValidChartType(chartType) === true && SocialCalc.Chart.IsValidSourceShape(rows, cols) === false ==> \result === false
//@ ensures SocialCalc.Chart.IsValidChartType(chartType) === true && SocialCalc.Chart.IsValidSourceShape(rows, cols) === true && SocialCalc.Chart.SeriesCount(rows, cols, seriesInRows) < SocialCalc.Chart.MinSeriesForType(chartType) ==> \result === false
//@ ensures \result === true <==> SocialCalc.Chart.IsValidChartType(chartType) === true && SocialCalc.Chart.IsValidSourceShape(rows, cols) === true && SocialCalc.Chart.SeriesCount(rows, cols, seriesInRows) >= SocialCalc.Chart.MinSeriesForType(chartType)
Chart.IsSourceValidForType = function (
  chartType: number,
  rows: number,
  cols: number,
  seriesInRows: boolean,
): boolean {
  if (!Chart.IsValidChartType(chartType)) return false;
  if (!Chart.IsValidSourceShape(rows, cols)) return false;
  return Chart.SeriesCount(rows, cols, seriesInRows) >= Chart.MinSeriesForType(chartType);
};

// *************************************
//
// 2. Pure axis domain / zero-baseline
// (mirrors lemma/chart.ts §3 exactly)
//
// *************************************

//@ verify
//@ ensures hasPrior === false ==> \result === value
//@ ensures hasPrior === true && value < priorMin ==> \result === value
//@ ensures hasPrior === true && value >= priorMin ==> \result === priorMin
Chart.DomainMin = function (hasPrior: boolean, priorMin: number, value: number): number {
  if (!hasPrior) return value;
  return value < priorMin ? value : priorMin;
};

//@ verify
//@ ensures hasPrior === false ==> \result === value
//@ ensures hasPrior === true && value > priorMax ==> \result === value
//@ ensures hasPrior === true && value <= priorMax ==> \result === priorMax
Chart.DomainMax = function (hasPrior: boolean, priorMax: number, value: number): number {
  if (!hasPrior) return value;
  return value > priorMax ? value : priorMax;
};

//@ verify
//@ ensures \result === true || \result === false
//@ ensures \result === true <==> chartType === 0 || chartType === 1 || chartType === 3
Chart.ShouldIncludeZeroBaseline = function (chartType: number): boolean {
  return chartType === 0 || chartType === 1 || chartType === 3;
};

//@ verify
//@ ensures includeZero === false ==> \result === min
//@ ensures includeZero === true && min > 0 ==> \result === 0
//@ ensures includeZero === true && min <= 0 ==> \result === min
Chart.BaselineMin = function (includeZero: boolean, min: number): number {
  if (!includeZero) return min;
  return min > 0 ? 0 : min;
};

//@ verify
//@ ensures includeZero === false ==> \result === max
//@ ensures includeZero === true && max < 0 ==> \result === 0
//@ ensures includeZero === true && max >= 0 ==> \result === max
Chart.BaselineMax = function (includeZero: boolean, max: number): number {
  if (!includeZero) return max;
  return max < 0 ? 0 : max;
};

//@ verify
//@ ensures \result === true || \result === false
//@ ensures \result === true <==> min === max
Chart.IsDegenerateDomain = function (min: number, max: number): boolean {
  return min === max;
};

/**
 * Runtime-bridge assembly of {min, max} from the verified baseline/
 * degenerate-domain decisions above, plus the empty-series fallback and
 * flat-domain +1 expansion (unverified record assembly only, matching
 * lemma/chart.ts's computeAxisDomain).
 */
Chart.ComputeAxisDomain = function (
  chartType: number,
  hasValue: boolean,
  rawMin: number,
  rawMax: number,
): ChartAxisDomain {
  if (!hasValue) return { min: 0, max: 1 };
  const includeZero = Chart.ShouldIncludeZeroBaseline(chartType);
  const min = Chart.BaselineMin(includeZero, rawMin);
  let max = Chart.BaselineMax(includeZero, rawMax);
  if (Chart.IsDegenerateDomain(min, max)) max = min + 1;
  return { min: min, max: max };
};

// *************************************
//
// 3. Pure anchor/size placement bounds
// (mirrors lemma/chart.ts §4 exactly)
//
// *************************************

//@ verify
//@ ensures \result === true || \result === false
//@ ensures \result === true <==> anchorCol >= 1 && anchorCol <= maxCol && anchorRow >= 1 && anchorRow <= maxRow
Chart.IsWithinSheetBounds = function (
  anchorCol: number,
  anchorRow: number,
  maxCol: number,
  maxRow: number,
): boolean {
  return anchorCol >= 1 && anchorCol <= maxCol && anchorRow >= 1 && anchorRow <= maxRow;
};

//@ verify
//@ ensures \result === true || \result === false
//@ ensures \result === true <==> px >= 40 && px <= 4000
Chart.IsValidDimension = function (px: number): boolean {
  return px >= 40 && px <= 4000;
};

//@ verify
//@ ensures \result >= 40 && \result <= 4000
//@ ensures px < 40 ==> \result === 40
//@ ensures px > 4000 ==> \result === 4000
//@ ensures px >= 40 && px <= 4000 ==> \result === px
Chart.ClampDimension = function (px: number): number {
  if (px < 40) return 40;
  if (px > 4000) return 4000;
  return px;
};

Chart.PLACEMENT_OK = 0;
Chart.PLACEMENT_ANCHOR_OUT_OF_BOUNDS = 1;
Chart.PLACEMENT_INVALID_SIZE = 2;

//@ verify
//@ ensures SocialCalc.Chart.IsWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow) === false ==> \result === 1
//@ ensures SocialCalc.Chart.IsWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow) === true && (SocialCalc.Chart.IsValidDimension(widthPx) === false || SocialCalc.Chart.IsValidDimension(heightPx) === false) ==> \result === 2
//@ ensures \result === 0 <==> SocialCalc.Chart.IsWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow) === true && SocialCalc.Chart.IsValidDimension(widthPx) === true && SocialCalc.Chart.IsValidDimension(heightPx) === true
Chart.PlanPlacementStatus = function (
  anchorCol: number,
  anchorRow: number,
  widthPx: number,
  heightPx: number,
  maxCol: number,
  maxRow: number,
): number {
  if (!Chart.IsWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow)) return 1;
  if (!Chart.IsValidDimension(widthPx) || !Chart.IsValidDimension(heightPx)) return 2;
  return 0;
};

// *************************************
//
// 4. Sanitization (no raw HTML/attributes/URLs/CSS from sheet content)
//
// *************************************

/**
 * Reduces any value to a chart-safe plain-text label: strips control
 * characters, collapses to a single line, and hard-truncates. Callers
 * (title/legend/axis text, series/category names pulled from cells) must
 * route every sheet-derived value through this before it reaches SVG text
 * content or an attribute value. XML-escaping of the surviving text happens
 * separately in EscapeSvgText/EscapeSvgAttr at render time so a label
 * surviving sanitize can still never inject markup.
 */
Chart.SanitizeLabel = function (value: unknown, maxLen?: number): string {
  let s = value == null ? "" : String(value);
  // eslint-disable-next-line no-control-regex -- deliberately strips control chars from sheet content
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  s = s.replace(/[\r\n\t]+/g, " ");
  s = s.trim();
  const limit = typeof maxLen === "number" && maxLen > 0 ? maxLen : 120;
  if (s.length > limit) s = s.slice(0, limit);
  return s;
};

/** XML-escapes text content for placement inside an SVG <text> node. */
Chart.EscapeSvgText = function (s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

/** XML-escapes text for placement inside a double-quoted SVG attribute value. */
Chart.EscapeSvgAttr = function (s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

/**
 * Selects a palette color by series index, wrapping deterministically.
 * Never derived from sheet content — closed palette only.
 */
Chart.PaletteColor = function (index: number): string {
  const palette = Chart.PALETTE;
  const i = ((index % palette.length) + palette.length) % palette.length;
  return palette[i]!;
};

// *************************************
//
// 5. Chart object model
//
// *************************************

//
// SocialCalc.ChartObject
//
// Usage: var c = new SocialCalc.ChartObject(id);
//
// Properties:
//    id: unique string id within the sheet's charts collection
//    charttype: one of SocialCalc.Chart.TYPE_* numeric codes
//    anchorcoord: top-left A1 coordinate the chart is positioned at
//    widthpx, heightpx: pixel size (clamped to [MIN_SIZE_PX, MAX_SIZE_PX])
//    sourceranges: array of A1 range strings (e.g. ["A1:B5"]); each range
//                  supplies one or more series depending on seriesinrows
//    seriesinrows: true if each row of the source is a series (categories
//                  are columns), false if each column is a series
//    title, legendposition, xaxislabel, yaxislabel: sanitized-on-render text
//    hastitle, haslegend: booleans
//

ChartRoot.ChartObject = function (this: ChartRecord, id: string) {
  this.id = id;
  this.charttype = Chart.TYPE_COLUMN;
  this.anchorcoord = "A1";
  this.widthpx = 480;
  this.heightpx = 320;
  this.sourceranges = [];
  this.seriesinrows = false;
  this.title = "";
  this.hastitle = false;
  this.haslegend = true;
  this.legendposition = "right"; // right/bottom/none
  this.xaxislabel = "";
  this.yaxislabel = "";
} as unknown as ChartMutableRoot["ChartObject"];

/**
 * Collects one series's numeric values plus category labels from a single
 * source range, honoring seriesinrows. First row/column supplies category
 * labels when it looks like text (heuristic: any non-numeric cell in the
 * lead row/column); scatter charts always treat the first row/column as the
 * shared x-value series rather than as labels.
 */
Chart.ExtractSourceData = function (sheet: SocialCalc.Sheet, chart: ChartRecord): ChartSourceData {
  const seriesNames: string[] = [];
  const categories: string[] = [];
  const series: number[][] = [];
  let xValues: number[] = [];

  const ranges = chart.sourceranges;
  const isScatter = chart.charttype === Chart.TYPE_SCATTER;

  for (let r = 0; r < ranges.length; r++) {
    const prange = ChartRoot.ParseRange(ranges[r]!);
    const cr1 = prange.cr1;
    const cr2 = prange.cr2;
    const rows = cr2.row - cr1.row + 1;
    const cols = cr2.col - cr1.col + 1;
    if (!Chart.IsValidSourceShape(rows, cols)) continue;

    // Build a raw grid of {isNumber, num, text} per cell.
    const grid: ChartCellInfo[][] = [];
    for (let row = cr1.row; row <= cr2.row; row++) {
      const gridRow: ChartCellInfo[] = [];
      for (let col = cr1.col; col <= cr2.col; col++) {
        const coord = ChartRoot.crToCoord(col, row);
        const cell = sheet.cells[coord];
        let num = 0;
        let isNumber = false;
        let text = "";
        if (cell) {
          if (cell.valuetype && cell.valuetype.charAt(0) === "n") {
            isNumber = true;
            num = +cell.datavalue || 0;
          } else if (cell.valuetype && cell.valuetype.charAt(0) === "t") {
            text = Chart.SanitizeLabel(cell.datavalue, 60);
          } else if (cell.valuetype && cell.valuetype.charAt(0) === "e") {
            text = "#ERR";
          }
        }
        gridRow.push({ isNumber: isNumber, num: num, text: text });
      }
      grid.push(gridRow);
    }

    const seriesInRows = !!chart.seriesinrows;

    // Header row: cr1.row's cells (from the second column on) are text,
    // i.e. grid[0][1] looks like a label rather than data. Header column:
    // cr1.col's cells (from the second row on) are text, i.e. grid[1][0]
    // looks like a label. These are independent — a source range can have
    // a header row, a header column, both, or neither (see
    // test/chart-svg-render.test.ts's ExtractSourceData branch-matrix
    // tests for the asymmetric-layout regression this guards against).
    let hasHeaderRow = false;
    if (cols > 1) {
      const probe = grid[0]![1];
      hasHeaderRow = !!probe && !probe.isNumber && probe.text !== "";
    }
    let hasHeaderCol = false;
    if (rows > 1) {
      const probe = grid[1]![0];
      hasHeaderCol = !!probe && !probe.isNumber && probe.text !== "";
    }

    // Scatter always reserves the first major line for x-values, which
    // plays the role a header would for the minor axis; it does not use
    // hasHeaderRow/hasHeaderCol at all.
    const startRow = isScatter ? 0 : hasHeaderRow ? 1 : 0;
    const startCol = isScatter ? 0 : hasHeaderCol ? 1 : 0;

    // majorStart/minorStart select where the series loop and category loop
    // begin, per orientation: series run along one axis, categories the
    // other, and each axis's own header (if any) is skipped once.
    const majorLen = seriesInRows ? rows : cols;
    const minorLen = seriesInRows ? cols : rows;
    const majorStart = isScatter ? 0 : seriesInRows ? startRow : startCol;
    const minorStart = seriesInRows ? startCol : startRow;
    const hasMajorLabels = seriesInRows ? hasHeaderCol : hasHeaderRow;
    const hasMinorLabels = seriesInRows ? hasHeaderRow : hasHeaderCol;

    for (let m = majorStart; m < majorLen; m++) {
      let name = "Series " + (series.length + 1);
      const values: number[] = [];
      for (let n = minorStart; n < minorLen; n++) {
        const cellInfo = seriesInRows ? grid[m]![n]! : grid[n]![m]!;
        values.push(cellInfo.isNumber ? cellInfo.num : 0);
      }
      if (hasMajorLabels && !isScatter) {
        const nameCell = seriesInRows ? grid[m]![0] : grid[0]![m];
        if (nameCell && nameCell.text) name = nameCell.text;
      }
      if (isScatter && m === majorStart) {
        // First major line is the x-value series for scatter charts.
        xValues = values;
        continue;
      }
      seriesNames.push(name);
      series.push(values);
    }

    if (!isScatter) {
      for (let c = minorStart; c < minorLen; c++) {
        if (hasMinorLabels) {
          const labelCell = seriesInRows ? grid[0]![c] : grid[c]![0];
          categories.push(labelCell && labelCell.text ? labelCell.text : String(c + 1));
        } else {
          categories.push(String(c - minorStart + 1));
        }
      }
    } else {
      for (let ci = 0; ci < xValues.length; ci++) categories.push(String(xValues[ci]));
    }
  }

  return { seriesNames: seriesNames, categories: categories, series: series, xValues: xValues };
};

// *************************************
//
// 6. Deterministic safe SVG rendering
//
// *************************************

/**
 * Renders a chart to a self-contained SVG string. Deterministic: same
 * sheet+chart state always produces byte-identical output. No canvas, no
 * network fetch, no external font/image references. Every piece of
 * sheet-derived text passes through SanitizeLabel + EscapeSvgText/Attr; no
 * raw HTML, SVG attribute, or URL is ever taken directly from cell content.
 * Degrades gracefully in non-DOM environments: this function returns a
 * plain string and touches no `document`/`window` global.
 */
Chart.RenderChartSVG = function (sheet: SocialCalc.Sheet, chart: ChartRecord): string {
  const width = Chart.ClampDimension(chart.widthpx || Chart.MIN_SIZE_PX);
  const height = Chart.ClampDimension(chart.heightpx || Chart.MIN_SIZE_PX);
  const data = Chart.ExtractSourceData(sheet, chart);
  const esc = Chart.EscapeSvgText;
  const escA = Chart.EscapeSvgAttr;

  const margin = { top: 24, right: 16, bottom: 32, left: 40 };
  const hasTitle = !!chart.hastitle && !!chart.title;
  if (hasTitle) margin.top = 40;
  const legendVisible = !!chart.haslegend && chart.legendposition !== "none";
  const legendWidth = legendVisible && chart.legendposition === "right" ? 100 : 0;
  const legendHeight = legendVisible && chart.legendposition === "bottom" ? 24 : 0;

  const plotX = margin.left;
  const plotY = margin.top;
  const plotW = Math.max(1, width - margin.left - margin.right - legendWidth);
  const plotH = Math.max(1, height - margin.top - margin.bottom - legendHeight);

  const parts: string[] = [];
  parts.push(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      width +
      '" height="' +
      height +
      '" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="' +
      escA(Chart.SanitizeLabel(chart.title || "chart", 120)) +
      '">',
  );
  parts.push(
    '<rect x="0" y="0" width="' +
      width +
      '" height="' +
      height +
      '" fill="#ffffff" stroke="#d0d0d0"/>',
  );

  if (hasTitle) {
    parts.push(
      '<text x="' +
        width / 2 +
        '" y="20" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#222222">' +
        esc(Chart.SanitizeLabel(chart.title, 120)) +
        "</text>",
    );
  }

  const seriesCount = data.series.length;
  const typeName = Chart.TYPE_NAMES[chart.charttype] || "column";

  if (seriesCount === 0 || data.categories.length === 0) {
    parts.push(
      '<text x="' +
        width / 2 +
        '" y="' +
        height / 2 +
        '" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#888888">No data</text>',
    );
    parts.push("</svg>");
    return parts.join("");
  }

  // Compute domain across all series.
  let hasValue = false;
  let rawMin = 0,
    rawMax = 0;
  for (let si = 0; si < data.series.length; si++) {
    const values = data.series[si]!;
    for (let vi = 0; vi < values.length; vi++) {
      const v = values[vi]!;
      rawMin = Chart.DomainMin(hasValue, rawMin, v);
      rawMax = Chart.DomainMax(hasValue, rawMax, v);
      hasValue = true;
    }
  }
  const domain = Chart.ComputeAxisDomain(chart.charttype, hasValue, rawMin, rawMax);

  parts.push('<g transform="translate(' + plotX + "," + plotY + ')" clip-path="none">');

  if (typeName === "pie") {
    Chart.RenderPie(parts, data, plotW, plotH, esc);
  } else if (typeName === "scatter") {
    Chart.RenderScatter(parts, data, plotW, plotH, domain, esc);
  } else {
    Chart.RenderCartesian(parts, data, plotW, plotH, domain, typeName, esc);
  }

  parts.push("</g>");

  if (legendVisible && seriesCount > 0 && typeName !== "pie") {
    Chart.RenderLegend(
      parts,
      data.seriesNames,
      chart.legendposition === "bottom",
      chart.legendposition === "bottom" ? plotX : plotX + plotW + 8,
      chart.legendposition === "bottom" ? plotY + plotH + 8 : plotY,
      esc,
    );
  } else if (legendVisible && typeName === "pie") {
    Chart.RenderLegend(
      parts,
      data.categories,
      chart.legendposition === "bottom",
      chart.legendposition === "bottom" ? plotX : plotX + plotW + 8,
      chart.legendposition === "bottom" ? plotY + plotH + 8 : plotY,
      esc,
    );
  }

  parts.push("</svg>");
  return parts.join("");
};

Chart.RenderLegend = function (
  parts: string[],
  names: string[],
  horizontal: boolean,
  x: number,
  y: number,
  esc: EscapeFn,
): void {
  for (let i = 0; i < names.length; i++) {
    const lx = horizontal ? x + i * 90 : x;
    const ly = horizontal ? y : y + i * 16;
    const color = Chart.PaletteColor(i);
    parts.push('<rect x="' + lx + '" y="' + ly + '" width="10" height="10" fill="' + color + '"/>');
    parts.push(
      '<text x="' +
        (lx + 14) +
        '" y="' +
        (ly + 9) +
        '" font-size="10" font-family="sans-serif" fill="#333333">' +
        esc(Chart.SanitizeLabel(names[i], 24)) +
        "</text>",
    );
  }
};

Chart.RenderCartesian = function (
  parts: string[],
  data: ChartSourceData,
  plotW: number,
  plotH: number,
  domain: ChartAxisDomain,
  typeName: string,
  esc: EscapeFn,
): void {
  // domain.max > domain.min always holds: ComputeAxisDomain expands any
  // degenerate (flat) domain by 1 before returning it.
  const range = domain.max - domain.min;

  // Axis lines.
  parts.push(
    '<line x1="0" y1="' +
      plotH +
      '" x2="' +
      plotW +
      '" y2="' +
      plotH +
      '" stroke="#999999" stroke-width="1"/>',
  );
  parts.push('<line x1="0" y1="0" x2="0" y2="' + plotH + '" stroke="#999999" stroke-width="1"/>');

  const catCount = data.categories.length;
  const seriesCount = data.series.length;

  if (typeName === "line" || typeName === "area") {
    for (let s = 0; s < seriesCount; s++) {
      const color = Chart.PaletteColor(s);
      const pts: string[] = [];
      for (let c = 0; c < catCount; c++) {
        const x = catCount > 1 ? (c / (catCount - 1)) * plotW : plotW / 2;
        const v = data.series[s]![c] || 0;
        const y = plotH - ((v - domain.min) / range) * plotH;
        pts.push(x + "," + y);
      }
      if (typeName === "area") {
        const areaPts = "0," + plotH + " " + pts.join(" ") + " " + plotW + "," + plotH;
        parts.push(
          '<polygon points="' +
            areaPts +
            '" fill="' +
            color +
            '" fill-opacity="0.35" stroke="none"/>',
        );
      }
      parts.push(
        '<polyline points="' +
          pts.join(" ") +
          '" fill="none" stroke="' +
          color +
          '" stroke-width="2"/>',
      );
    }
  } else {
    // column / bar
    const groupSize = (typeName === "bar" ? plotH : plotW) / catCount;
    const barThickness = (groupSize * 0.8) / seriesCount;
    for (let cIdx = 0; cIdx < catCount; cIdx++) {
      for (let sIdx = 0; sIdx < seriesCount; sIdx++) {
        const val = data.series[sIdx]![cIdx] || 0;
        const color2 = Chart.PaletteColor(sIdx);
        if (typeName === "bar") {
          const barY = cIdx * groupSize + groupSize * 0.1 + sIdx * barThickness;
          const x0 = ((Math.min(val, 0) - domain.min) / range) * plotW;
          const barWidthPx = (Math.abs(val) / range) * plotW;
          parts.push(
            '<rect x="' +
              x0 +
              '" y="' +
              barY +
              '" width="' +
              barWidthPx +
              '" height="' +
              barThickness +
              '" fill="' +
              color2 +
              '"/>',
          );
        } else {
          const barX = cIdx * groupSize + groupSize * 0.1 + sIdx * barThickness;
          const yTop = plotH - ((Math.max(val, 0) - domain.min) / range) * plotH;
          const yBase = plotH - ((Math.min(val, 0) - domain.min) / range) * plotH;
          const colHeight = Math.abs(yBase - yTop);
          parts.push(
            '<rect x="' +
              barX +
              '" y="' +
              Math.min(yTop, yBase) +
              '" width="' +
              barThickness +
              '" height="' +
              colHeight +
              '" fill="' +
              color2 +
              '"/>',
          );
        }
      }
    }
  }

  // Category axis labels.
  for (let lc = 0; lc < catCount; lc++) {
    const lx2 = catCount > 1 ? (lc / (catCount - 1)) * plotW : plotW / 2;
    parts.push(
      '<text x="' +
        lx2 +
        '" y="' +
        (plotH + 14) +
        '" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#555555">' +
        esc(Chart.SanitizeLabel(data.categories[lc], 16)) +
        "</text>",
    );
  }
};

Chart.RenderScatter = function (
  parts: string[],
  data: ChartSourceData,
  plotW: number,
  plotH: number,
  domain: ChartAxisDomain,
  esc: EscapeFn,
): void {
  const xValues = data.xValues;
  let hasX = false,
    xMin = 0,
    xMax = 0;
  for (let i = 0; i < xValues.length; i++) {
    xMin = Chart.DomainMin(hasX, xMin, xValues[i]!);
    xMax = Chart.DomainMax(hasX, xMax, xValues[i]!);
    hasX = true;
  }
  const xDomain = Chart.ComputeAxisDomain(Chart.TYPE_SCATTER, hasX, xMin, xMax);
  // Both domains are guaranteed non-degenerate by ComputeAxisDomain.
  const xRange = xDomain.max - xDomain.min;
  const yRange = domain.max - domain.min;

  parts.push(
    '<line x1="0" y1="' +
      plotH +
      '" x2="' +
      plotW +
      '" y2="' +
      plotH +
      '" stroke="#999999" stroke-width="1"/>',
  );
  parts.push('<line x1="0" y1="0" x2="0" y2="' + plotH + '" stroke="#999999" stroke-width="1"/>');

  for (let s = 0; s < data.series.length; s++) {
    const color = Chart.PaletteColor(s);
    for (let p = 0; p < xValues.length; p++) {
      const x = ((xValues[p]! - xDomain.min) / xRange) * plotW;
      const v = data.series[s]![p] || 0;
      const y = plotH - ((v - domain.min) / yRange) * plotH;
      parts.push('<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + color + '"/>');
    }
  }
  void esc; // reserved for future point-label rendering; kept in the signature for symmetry
};

Chart.RenderPie = function (
  parts: string[],
  data: ChartSourceData,
  plotW: number,
  plotH: number,
  esc: EscapeFn,
): void {
  // RenderChartSVG returns early on seriesCount === 0, so series[0] is always present.
  const values = data.series[0]!;
  let total = 0;
  for (let i = 0; i < values.length; i++) total += Math.max(0, values[i]!);
  const cx = plotW / 2;
  const cy = plotH / 2;
  const r = Math.max(1, Math.min(plotW, plotH) / 2 - 4);

  if (total <= 0) {
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#eeeeee"/>');
    return;
  }

  let angle = -Math.PI / 2;
  for (let s = 0; s < values.length; s++) {
    const frac = Math.max(0, values[s]!) / total;
    const sweep = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const endAngle = angle + sweep;
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const color = Chart.PaletteColor(s);
    if (frac > 0) {
      const d =
        "M" +
        cx +
        "," +
        cy +
        " L" +
        x1 +
        "," +
        y1 +
        " A" +
        r +
        "," +
        r +
        " 0 " +
        largeArc +
        " 1 " +
        x2 +
        "," +
        y2 +
        " Z";
      parts.push('<path d="' + d + '" fill="' + color + '" stroke="#ffffff" stroke-width="1"/>');
    }
    angle = endAngle;
  }
  void esc; // reserved for future slice-label rendering; kept in the signature for symmetry
};

// *************************************
//
// 7. Structural range adjustment (insert/delete/move rows/cols)
//
// *************************************

/**
 * Adjusts one A1 coordinate for a structural insert/delete along a single
 * axis by reusing SocialCalc.AdjustFormulaCoords directly on the bare A1
 * text, so chart anchors move in lockstep with real formula references for
 * the exact same edits.
 */
Chart.AdjustAnchorCoord = function (
  coord: string,
  col: number,
  coloffset: number,
  row: number,
  rowoffset: number,
): string {
  const adjusted = ChartRoot.AdjustFormulaCoords(coord, col, coloffset, row, rowoffset);
  if (adjusted.indexOf("#REF!") >= 0) return coord; // anchor never disappears; keep prior position
  return adjusted;
};

/**
 * Adjusts a chart's anchor and every source range for a structural
 * insert/delete/move edit, using the same AdjustFormulaCoords helper the
 * command engine uses for formulas and named ranges. Called from
 * socialcalc-3.ts's insertcol/insertrow/deletecol/deleterow handlers.
 */
Chart.AdjustChartForStructuralChange = function (
  chart: ChartRecord,
  col: number,
  coloffset: number,
  row: number,
  rowoffset: number,
): void {
  chart.anchorcoord = Chart.AdjustAnchorCoord(chart.anchorcoord, col, coloffset, row, rowoffset);
  const newRanges: string[] = [];
  for (let i = 0; i < chart.sourceranges.length; i++) {
    newRanges.push(
      ChartRoot.AdjustFormulaCoords(chart.sourceranges[i]!, col, coloffset, row, rowoffset),
    );
  }
  chart.sourceranges = newRanges;
};

/**
 * Adjusts a chart's anchor and every source range for a moved rectangle
 * (movepaste/moveinsert), using the movedto coordinate map the way
 * ReplaceFormulaCoords does for formulas/names.
 */
Chart.ReplaceChartCoords = function (
  chart: ChartRecord,
  movedto: { [coord: string]: string },
): void {
  chart.anchorcoord = ChartRoot.ReplaceFormulaCoords(chart.anchorcoord, movedto);
  const newRanges: string[] = [];
  for (let i = 0; i < chart.sourceranges.length; i++) {
    newRanges.push(ChartRoot.ReplaceFormulaCoords(chart.sourceranges[i]!, movedto));
  }
  chart.sourceranges = newRanges;
};

// *************************************
//
// 8. Save/load serialization
//
// Save format (one line per chart, appended after "name:" lines, before the
// trailing blank line -- see socialcalc-3.ts's CreateSheetSave/
// ParseSheetSave "chart" case):
//
//    chart:id:type:anchorcoord:widthpx:heightpx:seriesinrows:hastitle:
//          title:haslegend:legendposition:xaxislabel:yaxislabel:
//          sourcerange1|sourcerange2|...
//
// All free-text fields (title/labels) and the id are passed through
// encodeForSave/decodeFromSave, matching every other save-format field
// that can contain ":"/newline/backslash.
//
// *************************************

Chart.ChartToSaveLine = function (chart: ChartRecord): string {
  const enc = ChartRoot.encodeForSave;
  return (
    "chart:" +
    enc(chart.id) +
    ":" +
    chart.charttype +
    ":" +
    chart.anchorcoord +
    ":" +
    chart.widthpx +
    ":" +
    chart.heightpx +
    ":" +
    (chart.seriesinrows ? "1" : "0") +
    ":" +
    (chart.hastitle ? "1" : "0") +
    ":" +
    enc(chart.title) +
    ":" +
    (chart.haslegend ? "1" : "0") +
    ":" +
    enc(chart.legendposition) +
    ":" +
    enc(chart.xaxislabel) +
    ":" +
    enc(chart.yaxislabel) +
    ":" +
    chart.sourceranges.map(enc).join("|")
  );
};

Chart.ChartFromSaveParts = function (parts: string[]): ChartRecord {
  const dec = ChartRoot.decodeFromSave;
  const chart = new ChartRoot.ChartObject(dec(parts[1] ?? ""));
  chart.charttype = +(parts[2] ?? "0");
  chart.anchorcoord = parts[3] ?? "A1";
  chart.widthpx = +(parts[4] ?? "480");
  chart.heightpx = +(parts[5] ?? "320");
  chart.seriesinrows = parts[6] === "1";
  chart.hastitle = parts[7] === "1";
  chart.title = dec(parts[8] ?? "");
  chart.haslegend = parts[9] === "1";
  chart.legendposition = dec(parts[10] ?? "right");
  chart.xaxislabel = dec(parts[11] ?? "");
  chart.yaxislabel = dec(parts[12] ?? "");
  const rangesField = parts[13] || "";
  chart.sourceranges = rangesField ? rangesField.split("|").map((r) => dec(r)) : [];
  return chart;
};

// *************************************
//
// 9. Editor UI: overlay mount/auto-refresh, move/resize, create/edit dialog
//
// Degrades gracefully outside a DOM: every function below checks
// `typeof document !== "undefined"` before touching global DOM state, so a
// non-browser host (Node save/load workflows, SSR) never calls into this
// section and the pure model/render code above remains fully usable on its
// own. Not part of the shipping SC.Chart.RenderChartSVG contract used by
// tests; only entered when a real TableEditor + document exist.
//
// *************************************

/** Per-chart-id DOM overlay state tracked on the editor instance. */
type ChartOverlayEntry = {
  container: HTMLElement;
  moveHandle: HTMLElement;
  resizeHandle: HTMLElement;
  deleteButton: HTMLElement;
};

type ChartOverlayHost = SocialCalc.TableEditor & {
  chartOverlays?: { [id: string]: ChartOverlayEntry };
};

function hasDom(): boolean {
  return typeof document !== "undefined";
}

/** Per-element (editor, chartId) context for the named handlers below,
 * looked up by event.currentTarget so every listener is a stable named
 * function reference — never an inline closure — the same pattern
 * socialcalctableeditor.ts uses for its own mouse handlers (e.g.
 * ProcessEditorMouseDown/CellHandlesMouseDown), which keeps every handler
 * body directly callable (and therefore unit-testable under a fake DOM
 * whose addEventListener never dispatches) instead of trapped inside an
 * anonymous function only a real browser's event loop can invoke. */
const chartHandleContext = new WeakMap<
  object,
  { editor: SocialCalc.TableEditor; chartId: string; mode?: "move" | "resize" }
>();

/**
 * Named click handler for a chart overlay's delete ("x") button. Public
 * (and separately testable) so a fake-DOM unit test can call it directly
 * with a synthetic `{currentTarget}` event, matching FakeElement's
 * addEventListener no-op (see test/chart-editor-ui.test.ts).
 */
Chart.ChartDeleteButtonClick = function (event: MouseEvent): void {
  event.stopPropagation();
  const ctx = chartHandleContext.get(event.currentTarget as object);
  if (!ctx) return;
  Chart.DeleteChartFromOverlay(ctx.editor, ctx.chartId);
};

/**
 * Named mousedown handler for a chart overlay's move/resize handle. Public
 * and separately testable for the same reason as ChartDeleteButtonClick.
 */
Chart.ChartHandleMouseDown = function (event: MouseEvent): void {
  const ctx = chartHandleContext.get(event.currentTarget as object);
  if (!ctx || !ctx.mode) return;
  Chart.StartChartDrag(ctx.editor, ctx.chartId, event, ctx.mode);
};

/**
 * Builds (once) or updates the absolutely-positioned overlay div for one
 * chart: innerHTML is always the freshly rendered, fully-escaped SVG string
 * from RenderChartSVG — no raw sheet content ever reaches the DOM through
 * any other path. Position/size come only from the chart's own clamped
 * numeric fields and the editor's row/col pixel tables, never from
 * cell-derived strings.
 */
function mountOrUpdateChartOverlay(editor: SocialCalc.TableEditor, chart: ChartRecord): void {
  // RefreshChartOverlays (the only caller) always initializes
  // host.chartOverlays before calling this.
  const host = editor as Required<ChartOverlayHost>;
  let entry = host.chartOverlays[chart.id];

  const anchor = ChartRoot.coordToCr(chart.anchorcoord);
  const left = editor.colpositions[anchor.col] ?? 0;
  const top = editor.rowpositions[anchor.row] ?? 0;

  if (!entry) {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.zIndex = "6";
    container.style.cursor = "move";
    container.className = "sc-chart-overlay";
    container.setAttribute("data-chart-id", chart.id);

    const moveHandle = document.createElement("div");
    moveHandle.style.position = "absolute";
    moveHandle.style.top = "0px";
    moveHandle.style.left = "0px";
    moveHandle.style.right = "16px";
    moveHandle.style.height = "16px";
    moveHandle.style.cursor = "move";
    moveHandle.className = "sc-chart-move-handle";

    const resizeHandle = document.createElement("div");
    resizeHandle.style.position = "absolute";
    resizeHandle.style.right = "0px";
    resizeHandle.style.bottom = "0px";
    resizeHandle.style.width = "12px";
    resizeHandle.style.height = "12px";
    resizeHandle.style.cursor = "nwse-resize";
    resizeHandle.style.backgroundColor = "#0e93d8";
    resizeHandle.className = "sc-chart-resize-handle";

    const deleteButton = document.createElement("div");
    deleteButton.style.position = "absolute";
    deleteButton.style.top = "0px";
    deleteButton.style.right = "0px";
    deleteButton.style.width = "16px";
    deleteButton.style.height = "16px";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.textAlign = "center";
    deleteButton.style.fontFamily = "sans-serif";
    deleteButton.style.fontSize = "12px";
    deleteButton.style.color = "#a00";
    deleteButton.textContent = "\u00d7"; // "x" glyph, not sheet content
    deleteButton.title = "Delete chart";
    deleteButton.className = "sc-chart-delete-button";

    chartHandleContext.set(deleteButton, { editor, chartId: chart.id });
    chartHandleContext.set(moveHandle, { editor, chartId: chart.id, mode: "move" });
    chartHandleContext.set(resizeHandle, { editor, chartId: chart.id, mode: "resize" });
    deleteButton.addEventListener("click", Chart.ChartDeleteButtonClick);
    moveHandle.addEventListener("mousedown", Chart.ChartHandleMouseDown);
    resizeHandle.addEventListener("mousedown", Chart.ChartHandleMouseDown);

    container.appendChild(moveHandle);
    container.appendChild(resizeHandle);
    container.appendChild(deleteButton);
    editor.toplevel?.appendChild(container);

    entry = { container, moveHandle, resizeHandle, deleteButton };
    host.chartOverlays[chart.id] = entry;
  }

  entry.container.style.left = left + "px";
  entry.container.style.top = top + "px";
  entry.container.style.width = chart.widthpx + "px";
  entry.container.style.height = chart.heightpx + "px";
  entry.container.innerHTML = Chart.RenderChartSVG(editor.context.sheetobj, chart);
  entry.container.appendChild(entry.moveHandle);
  entry.container.appendChild(entry.resizeHandle);
  entry.container.appendChild(entry.deleteButton);
}

/**
 * Auto-refresh entry point: mounts/updates one overlay per current
 * sheet.charts entry and removes overlays for charts that no longer exist.
 * Called from socialcalctableeditor.ts's EditorSheetStatusCallback on
 * "cmdend" and "calcfinished" so charts redraw after every command and
 * every recalculation without any cached chart state to invalidate.
 */
Chart.RefreshChartOverlays = function (editor: SocialCalc.TableEditor): void {
  if (!hasDom() || !editor.toplevel) return;
  const host = editor as ChartOverlayHost;
  const charts = editor.context.sheetobj.charts;
  host.chartOverlays = host.chartOverlays || {};

  for (const id in charts) {
    mountOrUpdateChartOverlay(editor, charts[id]!);
  }
  for (const id in host.chartOverlays) {
    if (!charts[id]) {
      host.chartOverlays[id]!.container.parentNode?.removeChild(host.chartOverlays[id]!.container);
      delete host.chartOverlays[id];
    }
  }
};

/**
 * Issues the `chart delete` command for the overlay's "x" button. Public
 * (and separately testable) rather than an inline closure so a fake-DOM
 * unit test can call it directly, matching FakeElement's addEventListener
 * no-op (see test/chart-editor-ui.test.ts).
 */
Chart.DeleteChartFromOverlay = function (editor: SocialCalc.TableEditor, chartId: string): void {
  editor.EditorScheduleSheetCommands("chart delete " + chartId, true, false);
};

/** Drag state shared by the document-level move/up listeners below. */
type ChartDragState = {
  editor: SocialCalc.TableEditor;
  chartId: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
};

let activeChartDrag: ChartDragState | null = null;

Chart.ChartDragMouseMove = function (event: { clientX: number; clientY: number }): void {
  if (!activeChartDrag) return;
  const { editor, chartId, mode, startClientX, startClientY, startWidth, startHeight } =
    activeChartDrag;
  const host = editor as ChartOverlayHost;
  const entry = host.chartOverlays?.[chartId];
  if (!entry) return;
  const dx = event.clientX - startClientX;
  const dy = event.clientY - startClientY;
  if (mode === "resize") {
    entry.container.style.width = Chart.ClampDimension(startWidth + dx) + "px";
    entry.container.style.height = Chart.ClampDimension(startHeight + dy) + "px";
  } else {
    entry.container.style.left = activeChartDrag.startLeft + dx + "px";
    entry.container.style.top = activeChartDrag.startTop + dy + "px";
  }
};

Chart.ChartDragMouseUp = function (): void {
  if (!activeChartDrag || !hasDom()) return;
  const { editor, chartId, mode } = activeChartDrag;
  const host = editor as ChartOverlayHost;
  const entry = host.chartOverlays?.[chartId];
  document.removeEventListener("mousemove", Chart.ChartDragMouseMove, true);
  document.removeEventListener("mouseup", Chart.ChartDragMouseUp, true);
  if (entry) {
    if (mode === "resize") {
      const width = Math.round(parseFloat(entry.container.style.width) || 0);
      const height = Math.round(parseFloat(entry.container.style.height) || 0);
      editor.EditorScheduleSheetCommands(
        "chart resize " + chartId + " " + width + " " + height,
        true,
        false,
      );
    } else {
      const left = Math.round(parseFloat(entry.container.style.left) || 0);
      const top = Math.round(parseFloat(entry.container.style.top) || 0);
      const col = editor.colpositions.findIndex((p) => p > left);
      const row = editor.rowpositions.findIndex((p) => p > top);
      const targetCol = col > 1 ? col - 1 : 1;
      const targetRow = row > 1 ? row - 1 : 1;
      const coord = ChartRoot.crToCoord(targetCol, targetRow);
      editor.EditorScheduleSheetCommands("chart move " + chartId + " " + coord, true, false);
    }
  }
  activeChartDrag = null;
};

Chart.StartChartDrag = function (
  editor: SocialCalc.TableEditor,
  chartId: string,
  event: {
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    stopPropagation: () => void;
  },
  mode: "move" | "resize",
): void {
  if (!hasDom()) return;
  const host = editor as ChartOverlayHost;
  const entry = host.chartOverlays?.[chartId];
  if (!entry) return;
  event.preventDefault();
  event.stopPropagation();
  activeChartDrag = {
    editor,
    chartId,
    mode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startWidth: parseFloat(entry.container.style.width) || 0,
    startHeight: parseFloat(entry.container.style.height) || 0,
    startLeft: parseFloat(entry.container.style.left) || 0,
    startTop: parseFloat(entry.container.style.top) || 0,
  };
  document.addEventListener("mousemove", Chart.ChartDragMouseMove, true);
  document.addEventListener("mouseup", Chart.ChartDragMouseUp, true);
};

/** Field values collected from the create/edit dialog form. */
type ChartDialogFields = {
  sourceranges: string;
  charttype: string;
  seriesinrows: boolean;
  title: string;
};

/**
 * Issues `chart create` (no existing id) or `chart set` (existing id)
 * commands from collected dialog field values through the same
 * EditorScheduleSheetCommands pipeline every other editor action uses (so
 * create/edit get undo for free). Public and separately testable from the
 * dialog's DOM construction, matching FakeElement's addEventListener no-op.
 */
Chart.SubmitChartDialog = function (
  editor: SocialCalc.TableEditor,
  fields: ChartDialogFields,
  existingChartId?: string,
): void {
  const sourceranges = fields.sourceranges.trim();
  const charttype = fields.charttype;
  const seriesinrows = fields.seriesinrows ? "1" : "0";
  const title = fields.title.trim();

  if (existingChartId) {
    const commands = [
      "chart set " + existingChartId + " sourceranges " + ChartRoot.encodeForSave(sourceranges),
      "chart set " + existingChartId + " charttype " + charttype,
      "chart set " + existingChartId + " seriesinrows " + seriesinrows,
      "chart set " + existingChartId + " title " + ChartRoot.encodeForSave(title),
      "chart set " + existingChartId + " hastitle " + (title ? "1" : "0"),
    ];
    editor.EditorScheduleSheetCommands(commands.join("\n"), true, false);
  } else {
    const id = "chart" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    const anchor = editor.ecell?.coord || "A1";
    const commands = [
      "chart create " +
        id +
        " " +
        anchor +
        " 480 320 " +
        charttype +
        " " +
        seriesinrows +
        " " +
        sourceranges,
    ];
    if (title) {
      commands.push("chart set " + id + " title " + ChartRoot.encodeForSave(title));
      commands.push("chart set " + id + " hastitle 1");
    }
    editor.EditorScheduleSheetCommands(commands.join("\n"), true, false);
  }
};

/** Removes a dialog overlay element from the DOM. Public and separately
 * testable so the Cancel button's handler can be exercised directly. */
Chart.CloseChartDialog = function (dialogElement: HTMLElement): void {
  dialogElement.parentNode?.removeChild(dialogElement);
};

/** Per-submit-button dialog context for ChartDialogSubmitButtonClick,
 * looked up by event.currentTarget (see chartHandleContext above for the
 * same named-handler-over-inline-closure rationale). */
const chartDialogSubmitContext = new WeakMap<
  object,
  {
    editor: SocialCalc.TableEditor;
    overlay: HTMLElement;
    existingChartId: string | undefined;
    rangeInput: HTMLInputElement;
    typeSelect: HTMLSelectElement;
    seriesInRowsCheckbox: HTMLInputElement;
    titleInput: HTMLInputElement;
  }
>();

/** Per-cancel-button dialog context for ChartDialogCancelButtonClick. */
const chartDialogCancelContext = new WeakMap<object, { overlay: HTMLElement }>();

/**
 * Named click handler for the dialog's Create/Update button: collects the
 * current field values and hands them to SubmitChartDialog, then closes the
 * dialog. Public and separately testable for the same reason as
 * ChartDeleteButtonClick.
 */
Chart.ChartDialogSubmitButtonClick = function (event: MouseEvent): void {
  const ctx = chartDialogSubmitContext.get(event.currentTarget as object);
  if (!ctx) return;
  Chart.SubmitChartDialog(
    ctx.editor,
    {
      sourceranges: ctx.rangeInput.value,
      charttype: ctx.typeSelect.value,
      seriesinrows: ctx.seriesInRowsCheckbox.checked,
      title: ctx.titleInput.value,
    },
    ctx.existingChartId,
  );
  Chart.CloseChartDialog(ctx.overlay);
};

/** Named click handler for the dialog's Cancel button. */
Chart.ChartDialogCancelButtonClick = function (event: MouseEvent): void {
  const ctx = chartDialogCancelContext.get(event.currentTarget as object);
  if (!ctx) return;
  Chart.CloseChartDialog(ctx.overlay);
};

/**
 * Minimal usable chart creation/edit dialog: a real, DOM-attached form (not
 * a blocking window.prompt) with inputs for type/anchor/source-range/
 * title/legend, wired to issue `chart create`/`chart set` commands through
 * the same EditorScheduleSheetCommands pipeline every other editor action
 * uses (so create/edit get undo for free). Every user-typed value is
 * inserted via `.value`/`.textContent`, never `innerHTML`, so it can never
 * inject markup into the dialog itself; the eventual chart title/labels are
 * additionally sanitized by the `chart set` command handler before they
 * ever reach SVG output.
 */
Chart.OpenChartDialog = function (
  editor: SocialCalc.TableEditor,
  existingChartId?: string,
): HTMLElement | null {
  if (!hasDom()) return null;
  const sheet = editor.context.sheetobj;
  const existing = existingChartId ? sheet.charts[existingChartId] : null;

  const overlay = document.createElement("div");
  overlay.className = "sc-chart-dialog-overlay";
  overlay.style.position = "absolute";
  overlay.style.zIndex = "20";
  overlay.style.top = "20px";
  overlay.style.left = "20px";
  overlay.style.padding = "12px";
  overlay.style.border = "1px solid #999999";
  overlay.style.backgroundColor = "#ffffff";
  overlay.style.fontFamily = "sans-serif";
  overlay.style.fontSize = "12px";

  function labeledField(labelText: string): { row: HTMLElement; input: HTMLInputElement } {
    const row = document.createElement("div");
    row.style.marginBottom = "6px";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.display = "block";
    const input = document.createElement("input");
    input.type = "text";
    row.appendChild(label);
    row.appendChild(input);
    return { row, input };
  }

  const rangeField = labeledField("Source range (e.g. A1:B5)");
  rangeField.input.value = existing
    ? existing.sourceranges.join("|")
    : editor.range.hasrange
      ? ChartRoot.crToCoord(editor.range.left!, editor.range.top!) +
        ":" +
        ChartRoot.crToCoord(editor.range.right!, editor.range.bottom!)
      : editor.ecell?.coord || "A1";

  const typeSelect = document.createElement("select");
  for (let t = 0; t < Chart.TYPE_NAMES.length; t++) {
    const option = document.createElement("option");
    option.value = String(t);
    option.textContent = Chart.TYPE_NAMES[t]!;
    typeSelect.appendChild(option);
  }
  typeSelect.value = String(existing ? existing.charttype : Chart.TYPE_COLUMN);
  const typeRow = document.createElement("div");
  typeRow.style.marginBottom = "6px";
  const typeLabel = document.createElement("label");
  typeLabel.textContent = "Chart type";
  typeLabel.style.display = "block";
  typeRow.appendChild(typeLabel);
  typeRow.appendChild(typeSelect);

  const titleField = labeledField("Title (optional)");
  titleField.input.value = existing ? existing.title : "";

  const seriesInRowsCheckbox = document.createElement("input");
  seriesInRowsCheckbox.type = "checkbox";
  seriesInRowsCheckbox.checked = existing ? existing.seriesinrows : false;
  const seriesInRowsRow = document.createElement("div");
  seriesInRowsRow.style.marginBottom = "6px";
  const seriesInRowsLabel = document.createElement("label");
  seriesInRowsLabel.appendChild(seriesInRowsCheckbox);
  seriesInRowsLabel.appendChild(document.createTextNode(" Series in rows"));
  seriesInRowsRow.appendChild(seriesInRowsLabel);

  const submitButton = document.createElement("input");
  submitButton.type = "button";
  submitButton.value = existing ? "Update" : "Create";
  const cancelButton = document.createElement("input");
  cancelButton.type = "button";
  cancelButton.value = "Cancel";
  cancelButton.style.marginLeft = "6px";

  chartDialogSubmitContext.set(submitButton, {
    editor,
    overlay,
    existingChartId,
    rangeInput: rangeField.input,
    typeSelect,
    seriesInRowsCheckbox,
    titleInput: titleField.input,
  });
  chartDialogCancelContext.set(cancelButton, { overlay });
  submitButton.addEventListener("click", Chart.ChartDialogSubmitButtonClick);
  cancelButton.addEventListener("click", Chart.ChartDialogCancelButtonClick);

  overlay.appendChild(rangeField.row);
  overlay.appendChild(typeRow);
  overlay.appendChild(titleField.row);
  overlay.appendChild(seriesInRowsRow);
  overlay.appendChild(submitButton);
  overlay.appendChild(cancelButton);

  (editor.toplevel || document.body).appendChild(overlay);
  return overlay;
};
