/**
 * LemmaScript facade: pure policies underlying the sheet chart-object
 * runtime (js/chart.ts). Non-shipping mirror of source-shape/type
 * validation, series/category mapping, axis domain/zero-baseline placement,
 * and anchor/size placement bounds.
 *
 * Mirrors the lemma/spill.ts split: verified pure decision functions taking
 * named, caller-supplied scalars (not raw sheet scanning — full-sheet range
 * collection stays runtime-tested, matching lookup-result.ts's "full row
 * scanning stays runtime-tested" policy), plus a couple of intentionally
 * unverified runtime-bridge functions that assemble records from those
 * verified decisions (matching spill.ts's planSpillRectangle /
 * lookup-result.ts's lookupResultType wrapping chooseLookupResult).
 *
 * The shipping runtime (js/chart.ts) exposes matching pure helpers on
 * `SocialCalc.Chart`: `IsValidChartType`, `IsSourceValidForType`,
 * `SeriesCount`, `CategoryCount`, `ComputeAxisDomain`,
 * `PlanPlacementStatus`, and the `CHART_MIN_SIZE_PX`/`CHART_MAX_SIZE_PX`
 * constants. `test/lemma-chart-facade.test.ts` cross-checks every function
 * against its shipping counterpart exhaustively and at boundary cases.
 *
 * Policy groups (mirrors AGENTS.md "Facade oracle mapping" style):
 * 1. chart type / source-shape validation — closed type enum, positive shape.
 * 2. series/category mapping — series-in-rows vs series-in-columns, minimum
 *    series count per chart type (scatter needs an x column plus >=1 y).
 * 3. axis domain — running min/max accumulation, zero-baseline inclusion for
 *    column/bar/area, degenerate (flat) domain expansion.
 * 4. anchor/size placement bounds — anchor within sheet bounds, pixel size
 *    within a closed finite range, checked in fixed precedence order.
 */

// --- 1. Chart type / source-shape validation --------------------------------

/** Vertical bars, categories on the x-axis. */
export const CHART_TYPE_COLUMN = 0;
/** Horizontal bars, categories on the y-axis. */
export const CHART_TYPE_BAR = 1;
/** Connected point series. */
export const CHART_TYPE_LINE = 2;
/** Filled line series. */
export const CHART_TYPE_AREA = 3;
/** Single-series proportion ring. */
export const CHART_TYPE_PIE = 4;
/** Paired x/y point series, no implied category axis. */
export const CHART_TYPE_SCATTER = 5;

/** Whether a numeric code is one of the six closed chart types. */
export function isValidChartType(chartType: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> chartType === 0 || chartType === 1 || chartType === 2 || chartType === 3 || chartType === 4 || chartType === 5
  return (
    chartType === 0 ||
    chartType === 1 ||
    chartType === 2 ||
    chartType === 3 ||
    chartType === 4 ||
    chartType === 5
  );
}

/** Whether a proposed source range shape is structurally valid (positive extent). */
export function isValidSourceShape(rows: number, cols: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> rows > 0 && cols > 0
  return rows > 0 && cols > 0;
}

// --- 2. Series/category mapping ----------------------------------------------

/** Number of data series: rows if series run across rows, else columns. */
export function seriesCount(rows: number, cols: number, seriesInRows: boolean): number {
  //@ verify
  //@ ensures seriesInRows === true ==> \result === rows
  //@ ensures seriesInRows === false ==> \result === cols
  return seriesInRows ? rows : cols;
}

/** Number of categories per series: the dimension orthogonal to seriesCount. */
export function categoryCount(rows: number, cols: number, seriesInRows: boolean): number {
  //@ verify
  //@ ensures seriesInRows === true ==> \result === cols
  //@ ensures seriesInRows === false ==> \result === rows
  return seriesInRows ? cols : rows;
}

/** Minimum series a chart type needs: scatter needs an x column plus >=1 y column. */
export function minSeriesForType(chartType: number): number {
  //@ verify
  //@ ensures chartType === 5 ==> \result === 2
  //@ ensures chartType !== 5 ==> \result === 1
  return chartType === 5 ? 2 : 1;
}

/**
 * Full source-shape acceptance decision for a chart type: valid enum, valid
 * shape, and enough series for the type's minimum, checked in that order.
 */
export function isSourceValidForType(
  chartType: number,
  rows: number,
  cols: number,
  seriesInRows: boolean,
): boolean {
  //@ verify
  //@ ensures isValidChartType(chartType) === false ==> \result === false
  //@ ensures isValidChartType(chartType) === true && isValidSourceShape(rows, cols) === false ==> \result === false
  //@ ensures isValidChartType(chartType) === true && isValidSourceShape(rows, cols) === true && seriesCount(rows, cols, seriesInRows) < minSeriesForType(chartType) ==> \result === false
  //@ ensures \result === true <==> isValidChartType(chartType) === true && isValidSourceShape(rows, cols) === true && seriesCount(rows, cols, seriesInRows) >= minSeriesForType(chartType)
  if (!isValidChartType(chartType)) return false;
  if (!isValidSourceShape(rows, cols)) return false;
  return seriesCount(rows, cols, seriesInRows) >= minSeriesForType(chartType);
}

// --- 3. Axis domain / zero-baseline ------------------------------------------

/** Running minimum: first finite value seeds it, else keep the smaller of prior/value. */
export function domainMin(hasPrior: boolean, priorMin: number, value: number): number {
  //@ verify
  //@ ensures hasPrior === false ==> \result === value
  //@ ensures hasPrior === true && value < priorMin ==> \result === value
  //@ ensures hasPrior === true && value >= priorMin ==> \result === priorMin
  if (!hasPrior) return value;
  return value < priorMin ? value : priorMin;
}

/** Running maximum: first finite value seeds it, else keep the larger of prior/value. */
export function domainMax(hasPrior: boolean, priorMax: number, value: number): number {
  //@ verify
  //@ ensures hasPrior === false ==> \result === value
  //@ ensures hasPrior === true && value > priorMax ==> \result === value
  //@ ensures hasPrior === true && value <= priorMax ==> \result === priorMax
  if (!hasPrior) return value;
  return value > priorMax ? value : priorMax;
}

/** Column/bar/area charts anchor their value axis at zero; line/pie/scatter do not. */
export function shouldIncludeZeroBaseline(chartType: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> chartType === 0 || chartType === 1 || chartType === 3
  return chartType === 0 || chartType === 1 || chartType === 3;
}

/** Lower domain bound after applying zero-baseline policy: clamps a positive min down to 0. */
export function baselineMin(includeZero: boolean, min: number): number {
  //@ verify
  //@ ensures includeZero === false ==> \result === min
  //@ ensures includeZero === true && min > 0 ==> \result === 0
  //@ ensures includeZero === true && min <= 0 ==> \result === min
  if (!includeZero) return min;
  return min > 0 ? 0 : min;
}

/** Upper domain bound after applying zero-baseline policy: clamps a negative max up to 0. */
export function baselineMax(includeZero: boolean, max: number): number {
  //@ verify
  //@ ensures includeZero === false ==> \result === max
  //@ ensures includeZero === true && max < 0 ==> \result === 0
  //@ ensures includeZero === true && max >= 0 ==> \result === max
  if (!includeZero) return max;
  return max < 0 ? 0 : max;
}

/** Whether a domain has zero extent (would render as a single line). */
export function isDegenerateDomain(min: number, max: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> min === max
  return min === max;
}

/** Materialized axis domain, as returned by the runtime-bridge builder below. */
export type AxisDomain = { min: number; max: number };

/**
 * Runtime-bridge assembly of an AxisDomain from the verified baseline/
 * degenerate-domain decisions above. Not independently verified (record
 * construction plus the empty-series fallback and the flat-domain +1
 * expansion only); the decision logic it wraps is fully verified above,
 * matching lemma/spill.ts's planSpillRectangle bridge pattern.
 */
export function computeAxisDomain(
  chartType: number,
  hasValue: boolean,
  rawMin: number,
  rawMax: number,
): AxisDomain {
  if (!hasValue) return { min: 0, max: 1 };
  const includeZero = shouldIncludeZeroBaseline(chartType);
  const min = baselineMin(includeZero, rawMin);
  let max = baselineMax(includeZero, rawMax);
  if (isDegenerateDomain(min, max)) max = min + 1;
  return { min, max };
}

// --- 4. Anchor/size placement bounds -----------------------------------------

/** Smallest allowed chart pixel dimension (width or height). */
export const CHART_MIN_SIZE_PX = 40;
/** Largest allowed chart pixel dimension (width or height). */
export const CHART_MAX_SIZE_PX = 4000;

/** Whether an anchor cell coordinate falls within the sheet's current bounds. */
export function isWithinSheetBounds(
  anchorCol: number,
  anchorRow: number,
  maxCol: number,
  maxRow: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> anchorCol >= 1 && anchorCol <= maxCol && anchorRow >= 1 && anchorRow <= maxRow
  return anchorCol >= 1 && anchorCol <= maxCol && anchorRow >= 1 && anchorRow <= maxRow;
}

/** Whether a pixel dimension is within the closed finite [MIN, MAX] range. */
export function isValidDimension(px: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> px >= 40 && px <= 4000
  return px >= 40 && px <= 4000;
}

/** Clamps a pixel dimension into the closed finite [MIN, MAX] range. */
export function clampDimension(px: number): number {
  //@ verify
  //@ ensures \result >= 40 && \result <= 4000
  //@ ensures px < 40 ==> \result === 40
  //@ ensures px > 4000 ==> \result === 4000
  //@ ensures px >= 40 && px <= 4000 ==> \result === px
  if (px < 40) return 40;
  if (px > 4000) return 4000;
  return px;
}

/** Placement accepted: anchor in bounds and both dimensions valid. */
export const PLACEMENT_OK = 0;
/** Anchor cell falls outside [1, maxCol] x [1, maxRow]. */
export const PLACEMENT_ANCHOR_OUT_OF_BOUNDS = 1;
/** Anchor is fine but width and/or height is outside the finite size range. */
export const PLACEMENT_INVALID_SIZE = 2;

/**
 * Full placement plan status: anchor-bounds check first, then size check,
 * in that fixed precedence order (mirrors lemma/spill.ts's
 * planSpillStatus shape/bounds/budget precedence).
 */
export function planPlacementStatus(
  anchorCol: number,
  anchorRow: number,
  widthPx: number,
  heightPx: number,
  maxCol: number,
  maxRow: number,
): number {
  //@ verify
  //@ ensures isWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow) === false ==> \result === 1
  //@ ensures isWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow) === true && (isValidDimension(widthPx) === false || isValidDimension(heightPx) === false) ==> \result === 2
  //@ ensures \result === 0 <==> isWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow) === true && isValidDimension(widthPx) === true && isValidDimension(heightPx) === true
  if (!isWithinSheetBounds(anchorCol, anchorRow, maxCol, maxRow)) return 1;
  if (!isValidDimension(widthPx) || !isValidDimension(heightPx)) return 2;
  return 0;
}
