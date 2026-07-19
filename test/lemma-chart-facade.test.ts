import { describe, expect, test } from "vite-plus/test";

import {
  CHART_MAX_SIZE_PX,
  CHART_MIN_SIZE_PX,
  CHART_TYPE_AREA,
  CHART_TYPE_BAR,
  CHART_TYPE_COLUMN,
  CHART_TYPE_LINE,
  CHART_TYPE_PIE,
  CHART_TYPE_SCATTER,
  PLACEMENT_ANCHOR_OUT_OF_BOUNDS,
  PLACEMENT_INVALID_SIZE,
  PLACEMENT_OK,
  baselineMax,
  baselineMin,
  categoryCount,
  clampDimension,
  computeAxisDomain,
  domainMax,
  domainMin,
  isDegenerateDomain,
  isSourceValidForType,
  isValidChartType,
  isValidDimension,
  isValidSourceShape,
  isWithinSheetBounds,
  minSeriesForType,
  planPlacementStatus,
  seriesCount,
  shouldIncludeZeroBaseline,
} from "../lemma/chart";

import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/chart type/source-shape validation (Dafny/Lean surface)", () => {
  test("isValidChartType accepts only the six closed codes", () => {
    for (const t of [0, 1, 2, 3, 4, 5]) expect(isValidChartType(t)).toBe(true);
    for (const t of [-1, 6, 100, 2.5]) expect(isValidChartType(t)).toBe(false);
  });

  test("isValidSourceShape requires positive extent", () => {
    expect(isValidSourceShape(1, 1)).toBe(true);
    expect(isValidSourceShape(0, 5)).toBe(false);
    expect(isValidSourceShape(5, 0)).toBe(false);
    expect(isValidSourceShape(-1, 5)).toBe(false);
  });

  test("seriesCount/categoryCount pick the axis by seriesInRows", () => {
    expect(seriesCount(3, 5, true)).toBe(3);
    expect(seriesCount(3, 5, false)).toBe(5);
    expect(categoryCount(3, 5, true)).toBe(5);
    expect(categoryCount(3, 5, false)).toBe(3);
  });

  test("minSeriesForType: scatter needs 2 (x plus 1 y), everything else needs 1", () => {
    expect(minSeriesForType(CHART_TYPE_SCATTER)).toBe(2);
    for (const t of [
      CHART_TYPE_COLUMN,
      CHART_TYPE_BAR,
      CHART_TYPE_LINE,
      CHART_TYPE_AREA,
      CHART_TYPE_PIE,
    ]) {
      expect(minSeriesForType(t)).toBe(1);
    }
  });

  test("isSourceValidForType precedence: type before shape before series count", () => {
    expect(isSourceValidForType(9, 3, 3, false)).toBe(false); // invalid type wins
    expect(isSourceValidForType(CHART_TYPE_COLUMN, 0, 3, false)).toBe(false); // invalid shape
    expect(isSourceValidForType(CHART_TYPE_SCATTER, 1, 1, false)).toBe(false); // 1 col < min 2
    expect(isSourceValidForType(CHART_TYPE_SCATTER, 1, 2, false)).toBe(true);
    expect(isSourceValidForType(CHART_TYPE_COLUMN, 3, 1, false)).toBe(true);
  });
});

describe("lemma/chart axis domain / zero-baseline (Dafny/Lean surface)", () => {
  test("domainMin/domainMax seed from the first value, then track extremes", () => {
    expect(domainMin(false, 0, 7)).toBe(7);
    expect(domainMin(true, 3, 5)).toBe(3);
    expect(domainMin(true, 5, 3)).toBe(3);
    expect(domainMax(false, 0, -7)).toBe(-7);
    expect(domainMax(true, 5, 3)).toBe(5);
    expect(domainMax(true, 3, 5)).toBe(5);
  });

  test("shouldIncludeZeroBaseline: column/bar/area only", () => {
    expect(shouldIncludeZeroBaseline(CHART_TYPE_COLUMN)).toBe(true);
    expect(shouldIncludeZeroBaseline(CHART_TYPE_BAR)).toBe(true);
    expect(shouldIncludeZeroBaseline(CHART_TYPE_AREA)).toBe(true);
    expect(shouldIncludeZeroBaseline(CHART_TYPE_LINE)).toBe(false);
    expect(shouldIncludeZeroBaseline(CHART_TYPE_PIE)).toBe(false);
    expect(shouldIncludeZeroBaseline(CHART_TYPE_SCATTER)).toBe(false);
  });

  test("baselineMin/baselineMax clamp toward zero only when zero-baseline applies", () => {
    expect(baselineMin(true, 10)).toBe(0); // all-positive column chart clamps down to 0
    expect(baselineMin(true, -5)).toBe(-5); // already includes negative, unchanged
    expect(baselineMin(false, 10)).toBe(10); // line chart: untouched
    expect(baselineMax(true, -10)).toBe(0); // all-negative column chart clamps up to 0
    expect(baselineMax(true, 5)).toBe(5);
    expect(baselineMax(false, -10)).toBe(-10);
  });

  test("isDegenerateDomain flags a flat (single-value) domain", () => {
    expect(isDegenerateDomain(3, 3)).toBe(true);
    expect(isDegenerateDomain(3, 4)).toBe(false);
  });

  test("computeAxisDomain: empty series falls back to [0,1]", () => {
    expect(computeAxisDomain(CHART_TYPE_LINE, false, 0, 0)).toEqual({ min: 0, max: 1 });
  });

  test("computeAxisDomain: column chart with all-positive values includes zero baseline", () => {
    expect(computeAxisDomain(CHART_TYPE_COLUMN, true, 5, 20)).toEqual({ min: 0, max: 20 });
  });

  test("computeAxisDomain: column chart with all-negative values includes zero baseline", () => {
    expect(computeAxisDomain(CHART_TYPE_COLUMN, true, -20, -5)).toEqual({ min: -20, max: 0 });
  });

  test("computeAxisDomain: line chart keeps the raw (non-zero-anchored) domain", () => {
    expect(computeAxisDomain(CHART_TYPE_LINE, true, 95, 105)).toEqual({ min: 95, max: 105 });
  });

  test("computeAxisDomain: degenerate (flat) domain expands by 1", () => {
    expect(computeAxisDomain(CHART_TYPE_LINE, true, 42, 42)).toEqual({ min: 42, max: 43 });
    // column chart flat-at-zero: baseline clamp keeps min=max=0, still expands
    expect(computeAxisDomain(CHART_TYPE_COLUMN, true, 0, 0)).toEqual({ min: 0, max: 1 });
  });
});

describe("lemma/chart anchor/size placement bounds (Dafny/Lean surface)", () => {
  test("isWithinSheetBounds requires the anchor inside [1,maxCol] x [1,maxRow]", () => {
    expect(isWithinSheetBounds(1, 1, 702, 65536)).toBe(true);
    expect(isWithinSheetBounds(702, 65536, 702, 65536)).toBe(true);
    expect(isWithinSheetBounds(0, 1, 702, 65536)).toBe(false);
    expect(isWithinSheetBounds(1, 0, 702, 65536)).toBe(false);
    expect(isWithinSheetBounds(703, 1, 702, 65536)).toBe(false);
    expect(isWithinSheetBounds(1, 65537, 702, 65536)).toBe(false);
  });

  test("isValidDimension/clampDimension respect the closed finite pixel range", () => {
    expect(isValidDimension(CHART_MIN_SIZE_PX)).toBe(true);
    expect(isValidDimension(CHART_MAX_SIZE_PX)).toBe(true);
    expect(isValidDimension(CHART_MIN_SIZE_PX - 1)).toBe(false);
    expect(isValidDimension(CHART_MAX_SIZE_PX + 1)).toBe(false);
    expect(clampDimension(1)).toBe(CHART_MIN_SIZE_PX);
    expect(clampDimension(999999)).toBe(CHART_MAX_SIZE_PX);
    expect(clampDimension(480)).toBe(480);
  });

  test("planPlacementStatus precedence: anchor bounds before size", () => {
    expect(planPlacementStatus(0, 1, 480, 320, 702, 65536)).toBe(PLACEMENT_ANCHOR_OUT_OF_BOUNDS);
    // out-of-bounds anchor wins even when size is also invalid
    expect(planPlacementStatus(0, 1, 1, 1, 702, 65536)).toBe(PLACEMENT_ANCHOR_OUT_OF_BOUNDS);
    expect(planPlacementStatus(1, 1, 1, 320, 702, 65536)).toBe(PLACEMENT_INVALID_SIZE);
    expect(planPlacementStatus(1, 1, 320, 1, 702, 65536)).toBe(PLACEMENT_INVALID_SIZE);
    expect(planPlacementStatus(1, 1, 480, 320, 702, 65536)).toBe(PLACEMENT_OK);
  });
});

describe("lemma/chart vs shipping SC.Chart helpers", () => {
  test("shipping type/size constants match the facade's documented codes/bounds", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Chart.TYPE_COLUMN).toBe(CHART_TYPE_COLUMN);
    expect(SC.Chart.TYPE_BAR).toBe(CHART_TYPE_BAR);
    expect(SC.Chart.TYPE_LINE).toBe(CHART_TYPE_LINE);
    expect(SC.Chart.TYPE_AREA).toBe(CHART_TYPE_AREA);
    expect(SC.Chart.TYPE_PIE).toBe(CHART_TYPE_PIE);
    expect(SC.Chart.TYPE_SCATTER).toBe(CHART_TYPE_SCATTER);
    expect(SC.Chart.MIN_SIZE_PX).toBe(CHART_MIN_SIZE_PX);
    expect(SC.Chart.MAX_SIZE_PX).toBe(CHART_MAX_SIZE_PX);
  });

  test("IsSourceValidForType: facade and shipping agree over a boundary/precedence matrix", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[number, number, number, boolean]> = [
      [CHART_TYPE_COLUMN, 3, 3, false],
      [CHART_TYPE_SCATTER, 1, 1, false],
      [CHART_TYPE_SCATTER, 1, 2, false],
      [CHART_TYPE_SCATTER, 2, 1, true],
      [9, 3, 3, false],
      [CHART_TYPE_PIE, 0, 3, false],
      [CHART_TYPE_LINE, 3, 0, true],
    ];
    for (const [chartType, rows, cols, seriesInRows] of cases) {
      expect(SC.Chart.IsSourceValidForType(chartType, rows, cols, seriesInRows)).toBe(
        isSourceValidForType(chartType, rows, cols, seriesInRows),
      );
    }
  });

  test("ComputeAxisDomain: facade and shipping agree exhaustively over small value/type combinations", async () => {
    const SC = await loadSocialCalc();
    const types = [0, 1, 2, 3, 4, 5];
    const values = [-3, -1, 0, 1, 3];
    for (const chartType of types) {
      for (const rawMin of values) {
        for (const rawMax of values) {
          if (rawMax < rawMin) continue;
          const facadeResult = computeAxisDomain(chartType, true, rawMin, rawMax);
          const shippingResult = SC.Chart.ComputeAxisDomain(chartType, true, rawMin, rawMax);
          expect(shippingResult).toEqual(facadeResult);
        }
      }
    }
  });

  test("PlanPlacementStatus: facade and shipping agree over a boundary/precedence matrix", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[number, number, number, number, number, number]> = [
      [1, 1, 480, 320, 702, 65536],
      [0, 1, 480, 320, 702, 65536],
      [1, 0, 480, 320, 702, 65536],
      [703, 1, 480, 320, 702, 65536],
      [1, 65537, 480, 320, 702, 65536],
      [1, 1, 1, 320, 702, 65536],
      [1, 1, 480, 1, 702, 65536],
      [1, 1, 999999, 320, 702, 65536],
      [702, 65536, 40, 40, 702, 65536],
      [702, 65536, 4000, 4000, 702, 65536],
    ];
    for (const [anchorCol, anchorRow, widthPx, heightPx, maxCol, maxRow] of cases) {
      const facadeResult = planPlacementStatus(
        anchorCol,
        anchorRow,
        widthPx,
        heightPx,
        maxCol,
        maxRow,
      );
      const shippingResult = SC.Chart.PlanPlacementStatus(
        anchorCol,
        anchorRow,
        widthPx,
        heightPx,
        maxCol,
        maxRow,
      );
      expect(shippingResult).toBe(facadeResult);
    }
  });

  test("ClampDimension: facade and shipping agree exhaustively over a small pixel range", async () => {
    const SC = await loadSocialCalc();
    for (let px = -5; px <= 4010; px += 137) {
      expect(SC.Chart.ClampDimension(px)).toBe(clampDimension(px));
    }
    // exact boundary values
    for (const px of [39, 40, 41, 3999, 4000, 4001]) {
      expect(SC.Chart.ClampDimension(px)).toBe(clampDimension(px));
    }
  });
});

test("shipping SC.Chart.ComputeAxisDomain falls back to [0,1] when hasValue is false", async () => {
  const SC = await loadSocialCalc();
  expect(SC.Chart.ComputeAxisDomain(SC.Chart.TYPE_LINE, false, 5, 10)).toEqual({ min: 0, max: 1 });
});
