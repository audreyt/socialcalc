import { describe, expect, test } from "vite-plus/test";

import {
  PLACEMENT_COLLISION,
  PLACEMENT_OPEN,
  TABLE_BOUNDS_OVERFLOW,
  TABLE_INVALID_SPAN,
  TABLE_MAX_COL,
  TABLE_MAX_ROW,
  TABLE_OK,
  canPlaceRect,
  clampSpanToBounds,
  classifySlot,
  endCol,
  endRow,
  inRect,
  isValidSpan,
  isWithinTableBounds,
  planTableStatus,
  rectCellCount,
} from "../lemma/html-table";

import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/html-table rectangle placement (Dafny/Lean surface)", () => {
  test("isValidSpan rejects non-positive rowSpan/colSpan", () => {
    expect(isValidSpan(1, 1)).toBe(true);
    expect(isValidSpan(0, 5)).toBe(false);
    expect(isValidSpan(5, 0)).toBe(false);
    expect(isValidSpan(-1, 5)).toBe(false);
  });

  test("endCol/endRow and isWithinTableBounds", () => {
    expect(endCol(1, 3)).toBe(3);
    expect(endRow(1, 3)).toBe(3);
    expect(isWithinTableBounds(1, 1, 3, 3, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(true);
    expect(isWithinTableBounds(TABLE_MAX_COL, 1, 1, 1, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(true);
    expect(isWithinTableBounds(TABLE_MAX_COL, 1, 1, 2, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(false);
    expect(isWithinTableBounds(1, TABLE_MAX_ROW, 2, 1, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(false);
    expect(isWithinTableBounds(0, 1, 1, 1, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(false);
    expect(isWithinTableBounds(1, 0, 1, 1, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(false);
  });

  test("inRect: interior/edge/exterior cases against a 3x2 rectangle", () => {
    // rowSpan=3, colSpan=2 anchored at (2,5) covers cols [2,3], rows [5,7]
    expect(inRect(2, 5, 2, 5, 3, 2)).toBe(true); // anchor itself
    expect(inRect(3, 7, 2, 5, 3, 2)).toBe(true); // far corner
    expect(inRect(3, 5, 2, 5, 3, 2)).toBe(true); // interior edge
    expect(inRect(1, 5, 2, 5, 3, 2)).toBe(false); // left of rect
    expect(inRect(4, 5, 2, 5, 3, 2)).toBe(false); // right of rect
    expect(inRect(2, 4, 2, 5, 3, 2)).toBe(false); // above rect
    expect(inRect(2, 8, 2, 5, 3, 2)).toBe(false); // below rect
  });

  test("rectCellCount multiplies rowSpan by colSpan", () => {
    expect(rectCellCount(4, 5)).toBe(20);
    expect(rectCellCount(1, 1)).toBe(1);
  });

  test("planTableStatus precedence: invalid span before bounds overflow before ok", () => {
    // invalid span wins even when also out of bounds
    expect(planTableStatus(1, 1, 0, -1, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(TABLE_INVALID_SPAN);
    // valid span, out of bounds
    expect(planTableStatus(TABLE_MAX_COL, 1, 1, 2, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(
      TABLE_BOUNDS_OVERFLOW,
    );
    expect(planTableStatus(1, TABLE_MAX_ROW, 2, 1, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(
      TABLE_BOUNDS_OVERFLOW,
    );
    // success
    expect(planTableStatus(1, 1, 3, 3, TABLE_MAX_COL, TABLE_MAX_ROW)).toBe(TABLE_OK);
  });

  test("policy table: explicit status matrix across span/bounds combinations", () => {
    const cases: Array<
      [anchorCol: number, anchorRow: number, rowSpan: number, colSpan: number, expected: number]
    > = [
      [1, 1, 1, 1, TABLE_OK],
      [1, 1, -3, 2, TABLE_INVALID_SPAN],
      [1, 1, 2, -3, TABLE_INVALID_SPAN],
      [1, 1, 0, 1, TABLE_INVALID_SPAN],
      [1, 1, 1, 0, TABLE_INVALID_SPAN],
      [TABLE_MAX_COL, 1, 1, 2, TABLE_BOUNDS_OVERFLOW],
      [1, TABLE_MAX_ROW, 2, 1, TABLE_BOUNDS_OVERFLOW],
      [0, 1, 1, 1, TABLE_BOUNDS_OVERFLOW],
      [1, 0, 1, 1, TABLE_BOUNDS_OVERFLOW],
      [1, 1, 256, 256, TABLE_OK],
      [TABLE_MAX_COL, TABLE_MAX_ROW, 1, 1, TABLE_OK],
    ];
    for (const [anchorCol, anchorRow, rowSpan, colSpan, expected] of cases) {
      expect(
        planTableStatus(anchorCol, anchorRow, rowSpan, colSpan, TABLE_MAX_COL, TABLE_MAX_ROW),
      ).toBe(expected);
    }
  });

  test("clampSpanToBounds keeps the anchor cell and never enlarges the span", () => {
    // colSpan 5 anchored 2 cols from the right edge -> clamps to fit exactly.
    const clamped = clampSpanToBounds(TABLE_MAX_COL - 1, 1, 1, 5, TABLE_MAX_COL, TABLE_MAX_ROW);
    expect(clamped.colSpan).toBe(2);
    expect(clamped.rowSpan).toBe(1);
    // in-bounds span is left unchanged.
    const untouched = clampSpanToBounds(1, 1, 3, 3, TABLE_MAX_COL, TABLE_MAX_ROW);
    expect(untouched).toEqual({ rowSpan: 3, colSpan: 3 });
    // clamp never drops below 1 (anchor cell always survives), even for an
    // anchor sitting exactly on the boundary.
    const atEdge = clampSpanToBounds(
      TABLE_MAX_COL,
      TABLE_MAX_ROW,
      10,
      10,
      TABLE_MAX_COL,
      TABLE_MAX_ROW,
    );
    expect(atEdge).toEqual({ rowSpan: 1, colSpan: 1 });
  });
});

describe("lemma/html-table span collision policy", () => {
  test("classifySlot maps occupancy to PLACEMENT_OPEN/PLACEMENT_COLLISION", () => {
    expect(classifySlot(false)).toBe(PLACEMENT_OPEN);
    expect(classifySlot(true)).toBe(PLACEMENT_COLLISION);
  });

  test("canPlaceRect is the negation of anyOccupied", () => {
    expect(canPlaceRect(false)).toBe(true);
    expect(canPlaceRect(true)).toBe(false);
  });
});

describe("lemma/html-table vs shipping SC.HtmlTable", () => {
  test("shipping TABLE_MAX_COL/ROW and status constants match the facade", async () => {
    const SC = await loadSocialCalc();
    expect(SC.HtmlTable.TABLE_MAX_COL).toBe(TABLE_MAX_COL);
    expect(SC.HtmlTable.TABLE_MAX_ROW).toBe(TABLE_MAX_ROW);
    expect(SC.HtmlTable.TABLE_OK).toBe(TABLE_OK);
    expect(SC.HtmlTable.TABLE_INVALID_SPAN).toBe(TABLE_INVALID_SPAN);
    expect(SC.HtmlTable.TABLE_BOUNDS_OVERFLOW).toBe(TABLE_BOUNDS_OVERFLOW);
  });

  test("IsValidSpan/EndCol/EndRow: facade and shipping agree over a boundary matrix", async () => {
    const SC = await loadSocialCalc();
    const spanCases: Array<[number, number]> = [
      [1, 1],
      [0, 5],
      [5, 0],
      [-1, 5],
      [256, 256],
    ];
    for (const [rowSpan, colSpan] of spanCases) {
      expect(isValidSpan(rowSpan, colSpan)).toBe(SC.HtmlTable.IsValidSpan(rowSpan, colSpan));
    }
    const endCases: Array<[number, number]> = [
      [1, 3],
      [5, 1],
      [TABLE_MAX_COL - 2, 3],
    ];
    for (const [anchor, span] of endCases) {
      expect(endCol(anchor, span)).toBe(SC.HtmlTable.EndCol(anchor, span));
      expect(endRow(anchor, span)).toBe(SC.HtmlTable.EndRow(anchor, span));
    }
  });

  test("PlanTableStatus: facade and shipping agree over a boundary/precedence matrix", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[number, number, number, number]> = [
      [1, 1, 1, 1],
      [1, 1, -3, 2],
      [1, 1, 2, -3],
      [TABLE_MAX_COL, 1, 1, 2],
      [1, TABLE_MAX_ROW, 2, 1],
      [0, 1, 1, 1],
      [1, 0, 1, 1],
      [1, 1, 256, 256],
      [TABLE_MAX_COL, TABLE_MAX_ROW, 1, 1],
    ];
    for (const [anchorCol, anchorRow, rowSpan, colSpan] of cases) {
      const facadeResult = planTableStatus(
        anchorCol,
        anchorRow,
        rowSpan,
        colSpan,
        TABLE_MAX_COL,
        TABLE_MAX_ROW,
      );
      const shippingResult = SC.HtmlTable.PlanTableStatus(
        anchorCol,
        anchorRow,
        rowSpan,
        colSpan,
        SC.HtmlTable.TABLE_MAX_COL,
        SC.HtmlTable.TABLE_MAX_ROW,
      );
      expect(facadeResult).toBe(shippingResult);
    }
  });

  test("PlanTableStatus: facade and shipping agree exhaustively over small shapes", async () => {
    const SC = await loadSocialCalc();
    for (let rowSpan = -1; rowSpan <= 3; rowSpan++) {
      for (let colSpan = -1; colSpan <= 3; colSpan++) {
        const facadeResult = planTableStatus(1, 1, rowSpan, colSpan, TABLE_MAX_COL, TABLE_MAX_ROW);
        const shippingResult = SC.HtmlTable.PlanTableStatus(
          1,
          1,
          rowSpan,
          colSpan,
          SC.HtmlTable.TABLE_MAX_COL,
          SC.HtmlTable.TABLE_MAX_ROW,
        );
        expect(facadeResult).toBe(shippingResult);
      }
    }
  });

  test("CanPlaceRect: facade and shipping agree over every boolean", async () => {
    const SC = await loadSocialCalc();
    for (const anyOccupied of [false, true]) {
      expect(canPlaceRect(anyOccupied)).toBe(SC.HtmlTable.CanPlaceRect(anyOccupied));
    }
  });

  test("ClampSpanToBounds: facade and shipping agree over an overflow matrix", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[number, number, number, number]> = [
      [TABLE_MAX_COL - 1, 1, 1, 5],
      [1, 1, 3, 3],
      [TABLE_MAX_COL, TABLE_MAX_ROW, 10, 10],
      [1, TABLE_MAX_ROW - 2, 8, 1],
    ];
    for (const [anchorCol, anchorRow, rowSpan, colSpan] of cases) {
      const facadeResult = clampSpanToBounds(
        anchorCol,
        anchorRow,
        rowSpan,
        colSpan,
        TABLE_MAX_COL,
        TABLE_MAX_ROW,
      );
      const shippingResult = SC.HtmlTable.ClampSpanToBounds(
        anchorCol,
        anchorRow,
        rowSpan,
        colSpan,
        SC.HtmlTable.TABLE_MAX_COL,
        SC.HtmlTable.TABLE_MAX_ROW,
      );
      expect(facadeResult).toEqual(shippingResult);
    }
  });
});
