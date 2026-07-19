import { describe, expect, test } from "vite-plus/test";

import {
  CLAIM_ALLOWED,
  CLAIM_COLLISION,
  CLAIM_RECLAIMABLE,
  FILTER_DROP,
  FILTER_ERROR,
  FILTER_KEEP,
  FILTER_RESULT_CALC_ERROR,
  FILTER_RESULT_IF_EMPTY,
  FILTER_RESULT_KEPT,
  RESIZE_ACTION_CLAIM,
  RESIZE_ACTION_CLEAR,
  RESIZE_ACTION_NONE,
  RESIZE_GROWN,
  RESIZE_OUTSIDE,
  RESIZE_RETAINED,
  RESIZE_STALE,
  SPILL_BOUNDS_OVERFLOW,
  SPILL_INVALID_SHAPE,
  SPILL_MAX_COL,
  SPILL_MAX_ROW,
  SPILL_OK,
  SPILL_RESOURCE_LIMIT,
  classifyFilterMask,
  classifyFilterResult,
  classifyResizeMembership,
  classifySpillClaim,
  endCol,
  endRow,
  inSpillRect,
  isFirstOccurrenceAt,
  isValidShape,
  isWithinBounds,
  isWithinBudget,
  keepUniqueRow,
  occursExactlyOnce,
  planSpillRectangle,
  planSpillStatus,
  resizeAction,
  spillCellCount,
  stableCompare,
} from "../lemma/spill";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("lemma/spill rectangle planning (Dafny/Lean surface)", () => {
  test("isValidShape rejects non-positive rows/cols", () => {
    expect(isValidShape(1, 1)).toBe(true);
    expect(isValidShape(0, 5)).toBe(false);
    expect(isValidShape(5, 0)).toBe(false);
    expect(isValidShape(-1, 5)).toBe(false);
  });

  test("endCol/endRow and isWithinBounds", () => {
    expect(endCol(1, 3)).toBe(3);
    expect(endRow(1, 3)).toBe(3);
    expect(isWithinBounds(1, 1, 3, 3, SPILL_MAX_COL, SPILL_MAX_ROW)).toBe(true);
    // anchor at the last usable column: cols=1 still fits, cols=2 overflows.
    expect(isWithinBounds(SPILL_MAX_COL, 1, 1, 1, SPILL_MAX_COL, SPILL_MAX_ROW)).toBe(true);
    expect(isWithinBounds(SPILL_MAX_COL, 1, 1, 2, SPILL_MAX_COL, SPILL_MAX_ROW)).toBe(false);
    expect(isWithinBounds(1, SPILL_MAX_ROW, 2, 1, SPILL_MAX_COL, SPILL_MAX_ROW)).toBe(false);
    expect(isWithinBounds(0, 1, 1, 1, SPILL_MAX_COL, SPILL_MAX_ROW)).toBe(false);
    expect(isWithinBounds(1, 0, 1, 1, SPILL_MAX_COL, SPILL_MAX_ROW)).toBe(false);
  });

  test("spillCellCount and isWithinBudget", () => {
    expect(spillCellCount(4, 5)).toBe(20);
    expect(isWithinBudget(4, 5, 20)).toBe(true);
    expect(isWithinBudget(4, 5, 19)).toBe(false);
  });

  test("planSpillStatus precedence: shape before bounds before budget", () => {
    // invalid shape wins even when also out of bounds
    expect(planSpillStatus(1, 1, 0, -1, SPILL_MAX_COL, SPILL_MAX_ROW, 10)).toBe(
      SPILL_INVALID_SHAPE,
    );
    // valid shape, out of bounds
    expect(planSpillStatus(SPILL_MAX_COL, 1, 1, 2, SPILL_MAX_COL, SPILL_MAX_ROW, 1000)).toBe(
      SPILL_BOUNDS_OVERFLOW,
    );
    expect(planSpillStatus(1, SPILL_MAX_ROW, 2, 1, SPILL_MAX_COL, SPILL_MAX_ROW, 1000)).toBe(
      SPILL_BOUNDS_OVERFLOW,
    );
    // in bounds, over budget
    expect(planSpillStatus(1, 1, 10, 10, SPILL_MAX_COL, SPILL_MAX_ROW, 99)).toBe(
      SPILL_RESOURCE_LIMIT,
    );
    // success
    expect(planSpillStatus(1, 1, 10, 10, SPILL_MAX_COL, SPILL_MAX_ROW, 100)).toBe(SPILL_OK);
  });

  test("planSpillRectangle: successful plan has positive size, contains anchor, ends within bounds, count = rows*cols", () => {
    const plan = planSpillRectangle(5, 5, 3, 4, SPILL_MAX_COL, SPILL_MAX_ROW, 100);
    expect(plan.status).toBe(SPILL_OK);
    expect(plan.rows).toBeGreaterThan(0);
    expect(plan.cols).toBeGreaterThan(0);
    // contains anchor: anchor (5,5) is within [5, 5+4-1] x [5, 5+3-1]
    expect(inSpillRect(5, 5, 5, 5, plan.rows, plan.cols)).toBe(true);
    expect(endCol(5, plan.cols)).toBeLessThanOrEqual(SPILL_MAX_COL);
    expect(endRow(5, plan.rows)).toBeLessThanOrEqual(SPILL_MAX_ROW);
    expect(plan.count).toBe(plan.rows * plan.cols);
  });

  test("planSpillRectangle: failed plan reports zero count and no valid rectangle", () => {
    const shapeFail = planSpillRectangle(1, 1, 0, 5, SPILL_MAX_COL, SPILL_MAX_ROW, 100);
    expect(shapeFail.status).toBe(SPILL_INVALID_SHAPE);
    expect(shapeFail.count).toBe(0);

    const boundsFail = planSpillRectangle(
      SPILL_MAX_COL,
      1,
      1,
      2,
      SPILL_MAX_COL,
      SPILL_MAX_ROW,
      100,
    );
    expect(boundsFail.status).toBe(SPILL_BOUNDS_OVERFLOW);
    expect(boundsFail.count).toBe(0);

    const budgetFail = planSpillRectangle(1, 1, 50, 50, SPILL_MAX_COL, SPILL_MAX_ROW, 100);
    expect(budgetFail.status).toBe(SPILL_RESOURCE_LIMIT);
    expect(budgetFail.count).toBe(0);
  });

  test("policy table: explicit status matrix across shape/bounds/budget combinations", () => {
    const cases: Array<
      [
        anchorCol: number,
        anchorRow: number,
        rows: number,
        cols: number,
        maxCells: number,
        expected: number,
      ]
    > = [
      [1, 1, 1, 1, 1, SPILL_OK],
      [1, 1, 1, 1, 0, SPILL_RESOURCE_LIMIT],
      [1, 1, -3, 2, 100, SPILL_INVALID_SHAPE],
      [1, 1, 2, -3, 100, SPILL_INVALID_SHAPE],
      [702, 1, 1, 2, 100, SPILL_BOUNDS_OVERFLOW],
      [1, 65536, 2, 1, 100, SPILL_BOUNDS_OVERFLOW],
      [0, 1, 1, 1, 100, SPILL_BOUNDS_OVERFLOW],
      [1, 0, 1, 1, 100, SPILL_BOUNDS_OVERFLOW],
      [1, 1, 256, 256, 65535, SPILL_RESOURCE_LIMIT],
      [1, 1, 256, 256, 65536, SPILL_OK],
    ];
    for (const [anchorCol, anchorRow, rows, cols, maxCells, expected] of cases) {
      expect(
        planSpillStatus(anchorCol, anchorRow, rows, cols, SPILL_MAX_COL, SPILL_MAX_ROW, maxCells),
      ).toBe(expected);
    }
  });
});

describe("lemma/spill transactional claim classification", () => {
  test("policy table: anchor always allowed, blank/self-owned reclaimable, foreign/user/merged always collide", () => {
    const cases: Array<
      [
        isAnchorCell: boolean,
        isBlank: boolean,
        isOwnedBySameAnchor: boolean,
        isForeignSpill: boolean,
        hasUserContent: boolean,
        isMergedTarget: boolean,
        expected: number,
      ]
    > = [
      [true, false, false, true, true, true, CLAIM_ALLOWED], // anchor wins regardless of other flags
      [false, true, false, false, false, false, CLAIM_RECLAIMABLE], // blank target
      [false, false, true, false, false, false, CLAIM_RECLAIMABLE], // same-anchor spill cell
      [false, false, false, true, false, false, CLAIM_COLLISION], // foreign spill
      [false, false, false, false, true, false, CLAIM_COLLISION], // user content
      [false, false, false, false, false, true, CLAIM_COLLISION], // merged target
      [false, false, false, false, false, false, CLAIM_COLLISION], // unclassified non-blank -> denied by default
      // collision flags dominate even when blank/self-owned is also (impossibly) true
      [false, true, false, true, false, false, CLAIM_COLLISION],
      [false, false, true, false, true, false, CLAIM_COLLISION],
    ];
    for (const [
      isAnchorCell,
      isBlank,
      isOwnedBySameAnchor,
      isForeignSpill,
      hasUserContent,
      isMergedTarget,
      expected,
    ] of cases) {
      expect(
        classifySpillClaim(
          isAnchorCell,
          isBlank,
          isOwnedBySameAnchor,
          isForeignSpill,
          hasUserContent,
          isMergedTarget,
        ),
      ).toBe(expected);
    }
  });

  test("collision policy can never authorize a foreign/user/merged overwrite", () => {
    // Exhaustively check every non-anchor combination where at least one
    // collision flag is set: result must never be ALLOWED or RECLAIMABLE.
    const bools = [false, true];
    for (const isBlank of bools) {
      for (const isOwnedBySameAnchor of bools) {
        for (const isForeignSpill of bools) {
          for (const hasUserContent of bools) {
            for (const isMergedTarget of bools) {
              if (!isForeignSpill && !hasUserContent && !isMergedTarget) continue;
              const result = classifySpillClaim(
                false,
                isBlank,
                isOwnedBySameAnchor,
                isForeignSpill,
                hasUserContent,
                isMergedTarget,
              );
              expect(result).toBe(CLAIM_COLLISION);
              expect(result).not.toBe(CLAIM_ALLOWED);
              expect(result).not.toBe(CLAIM_RECLAIMABLE);
            }
          }
        }
      }
    }
  });
});

describe("lemma/spill resize membership classification", () => {
  test("inSpillRect membership at exact boundaries", () => {
    expect(inSpillRect(5, 5, 5, 5, 3, 4)).toBe(true); // anchor cell
    expect(inSpillRect(8, 7, 5, 5, 3, 4)).toBe(true); // far corner (col 5..8, row 5..7)
    expect(inSpillRect(9, 7, 5, 5, 3, 4)).toBe(false); // one past right edge
    expect(inSpillRect(8, 8, 5, 5, 3, 4)).toBe(false); // one past bottom edge
    expect(inSpillRect(4, 5, 5, 5, 3, 4)).toBe(false); // one before left edge
  });

  test("policy table: retained/grown/stale/outside are mutually exclusive and complete", () => {
    const cases: Array<[inOld: boolean, inNew: boolean, expected: number]> = [
      [true, true, RESIZE_RETAINED],
      [false, true, RESIZE_GROWN],
      [true, false, RESIZE_STALE],
      [false, false, RESIZE_OUTSIDE],
    ];
    const seen = new Set<number>();
    for (const [inOld, inNew, expected] of cases) {
      const result = classifyResizeMembership(inOld, inNew);
      expect(result).toBe(expected);
      expect(seen.has(result)).toBe(false); // exclusivity: no two input combos share a code
      seen.add(result);
    }
    expect(seen.size).toBe(4); // completeness: all four codes produced across all combos
  });

  test("resizeAction: stale cells clear, grown cells claim, retained/outside untouched", () => {
    expect(resizeAction(RESIZE_STALE)).toBe(RESIZE_ACTION_CLEAR);
    expect(resizeAction(RESIZE_GROWN)).toBe(RESIZE_ACTION_CLAIM);
    expect(resizeAction(RESIZE_RETAINED)).toBe(RESIZE_ACTION_NONE);
    expect(resizeAction(RESIZE_OUTSIDE)).toBe(RESIZE_ACTION_NONE);
  });

  test("end-to-end resize scenario: shrinking a 3x3 spill to 2x2 stales the freed L, grows nothing", () => {
    const anchorCol = 2;
    const anchorRow = 2;
    // old footprint 3x3 at (2,2): cols 2..4, rows 2..4
    // new footprint 2x2 at (2,2): cols 2..3, rows 2..3
    const targets: Array<[col: number, row: number]> = [
      [2, 2],
      [3, 2],
      [4, 2],
      [2, 3],
      [3, 3],
      [4, 3],
      [2, 4],
      [3, 4],
      [4, 4],
    ];
    const actions = targets.map(([col, row]) => {
      const inOld = inSpillRect(col, row, anchorCol, anchorRow, 3, 3);
      const inNew = inSpillRect(col, row, anchorCol, anchorRow, 2, 2);
      return resizeAction(classifyResizeMembership(inOld, inNew));
    });
    // retained 2x2 block (2,2)(3,2)(2,3)(3,3) -> NONE; the L-shaped freed
    // band (col4 all rows, row4 cols2-3) -> CLEAR; nothing GROWN on shrink.
    expect(actions).toEqual([
      RESIZE_ACTION_NONE, // (2,2) retained
      RESIZE_ACTION_NONE, // (3,2) retained
      RESIZE_ACTION_CLEAR, // (4,2) stale
      RESIZE_ACTION_NONE, // (2,3) retained
      RESIZE_ACTION_NONE, // (3,3) retained
      RESIZE_ACTION_CLEAR, // (4,3) stale
      RESIZE_ACTION_CLEAR, // (2,4) stale
      RESIZE_ACTION_CLEAR, // (3,4) stale
      RESIZE_ACTION_CLEAR, // (4,4) stale
    ]);
  });

  test("end-to-end resize scenario: growing a 2x2 spill to 3x3 claims the new L, clears nothing", () => {
    const anchorCol = 2;
    const anchorRow = 2;
    const targets: Array<[col: number, row: number]> = [
      [2, 2],
      [3, 2],
      [4, 2],
      [2, 3],
      [3, 3],
      [4, 3],
      [2, 4],
      [3, 4],
      [4, 4],
    ];
    const actions = targets.map(([col, row]) => {
      const inOld = inSpillRect(col, row, anchorCol, anchorRow, 2, 2);
      const inNew = inSpillRect(col, row, anchorCol, anchorRow, 3, 3);
      return resizeAction(classifyResizeMembership(inOld, inNew));
    });
    expect(actions).toEqual([
      RESIZE_ACTION_NONE, // (2,2) retained
      RESIZE_ACTION_NONE, // (3,2) retained
      RESIZE_ACTION_CLAIM, // (4,2) grown
      RESIZE_ACTION_NONE, // (2,3) retained
      RESIZE_ACTION_NONE, // (3,3) retained
      RESIZE_ACTION_CLAIM, // (4,3) grown
      RESIZE_ACTION_CLAIM, // (2,4) grown
      RESIZE_ACTION_CLAIM, // (3,4) grown
      RESIZE_ACTION_CLAIM, // (4,4) grown
    ]);
  });
});

describe("lemma/spill stable UNIQUE keep policy", () => {
  test("preserve-first-occurrence semantics", () => {
    expect(isFirstOccurrenceAt(0, 0)).toBe(true);
    expect(isFirstOccurrenceAt(3, 0)).toBe(false);
    expect(keepUniqueRow(0, 0, 2, false)).toBe(true); // first occurrence kept
    expect(keepUniqueRow(3, 0, 2, false)).toBe(false); // later duplicate never kept
  });

  test("exactly_once semantics", () => {
    expect(occursExactlyOnce(1)).toBe(true);
    expect(occursExactlyOnce(2)).toBe(false);
    expect(occursExactlyOnce(0)).toBe(false);
    // exactly-once keeps the singleton row regardless of its index
    expect(keepUniqueRow(5, 5, 1, true)).toBe(true);
    // exactly-once excludes every row of a duplicated value, including its
    // first occurrence
    expect(keepUniqueRow(0, 0, 3, true)).toBe(false);
    expect(keepUniqueRow(4, 0, 3, true)).toBe(false);
  });

  test("policy table over a simulated ['a','b','a','c','b','a'] column", () => {
    // values: index 0='a' 1='b' 2='a' 3='c' 4='b' 5='a'
    // firstIndex: a->0, b->1, c->3 ; counts: a=3, b=2, c=1
    const rows: Array<{ index: number; firstIndexOfValue: number; count: number }> = [
      { index: 0, firstIndexOfValue: 0, count: 3 }, // a (1st)
      { index: 1, firstIndexOfValue: 1, count: 2 }, // b (1st)
      { index: 2, firstIndexOfValue: 0, count: 3 }, // a (dup)
      { index: 3, firstIndexOfValue: 3, count: 1 }, // c (1st, only)
      { index: 4, firstIndexOfValue: 1, count: 2 }, // b (dup)
      { index: 5, firstIndexOfValue: 0, count: 3 }, // a (dup)
    ];
    const firstOccurrenceKeep = rows.map((r) =>
      keepUniqueRow(r.index, r.firstIndexOfValue, r.count, false),
    );
    expect(firstOccurrenceKeep).toEqual([true, true, false, true, false, false]);

    const exactlyOnceKeep = rows.map((r) =>
      keepUniqueRow(r.index, r.firstIndexOfValue, r.count, true),
    );
    // only 'c' (count 1) survives exactly-once; every duplicated value's
    // rows are excluded, including their first occurrence.
    expect(exactlyOnceKeep).toEqual([false, false, false, true, false, false]);
  });

  test("later duplicates are never kept under first-occurrence semantics, exhaustively", () => {
    for (let index = 1; index <= 10; index++) {
      for (let firstIndexOfValue = 0; firstIndexOfValue < index; firstIndexOfValue++) {
        // index !== firstIndexOfValue by construction (index > firstIndexOfValue)
        expect(keepUniqueRow(index, firstIndexOfValue, 2, false)).toBe(false);
      }
    }
  });

  test("exactly_once never keeps a duplicated value, exhaustively over count 2..5", () => {
    for (let count = 2; count <= 5; count++) {
      for (let index = 0; index < count; index++) {
        expect(keepUniqueRow(index, 0, count, true)).toBe(false);
      }
    }
  });
});

describe("lemma/spill stable SORT tie policy", () => {
  test("nonzero comparator decides regardless of index order", () => {
    expect(stableCompare(-1, 5, 2)).toBe(-1);
    expect(stableCompare(1, 0, 9)).toBe(1);
    expect(stableCompare(-7, 100, 0)).toBe(-7);
  });

  test("comparator tie preserves original index order", () => {
    expect(stableCompare(0, 2, 5)).toBe(-1); // lower original index sorts first
    expect(stableCompare(0, 5, 2)).toBe(1);
    expect(stableCompare(0, 3, 3)).toBe(0);
  });

  test("policy table: tied rows retain source order after a stable sort simulation", () => {
    // Three rows share the same sort key (comparator always ties on key);
    // stableCompare must reduce to plain index order.
    const rows = [
      { key: "x", originalIndex: 0 },
      { key: "x", originalIndex: 1 },
      { key: "x", originalIndex: 2 },
    ];
    const sorted = [...rows].sort((a, b) =>
      stableCompare(0 /* keys always tie */, a.originalIndex, b.originalIndex),
    );
    expect(sorted.map((r) => r.originalIndex)).toEqual([0, 1, 2]);
  });

  test("policy table: nonzero decisions are preserved through a full stable sort", () => {
    // comparatorResult mirrors descending numeric key comparison; ties (equal
    // key) must still resolve by original index.
    const rows = [
      { key: 3, originalIndex: 0 },
      { key: 1, originalIndex: 1 },
      { key: 3, originalIndex: 2 },
      { key: 2, originalIndex: 3 },
      { key: 1, originalIndex: 4 },
    ];
    const sorted = [...rows].sort((a, b) =>
      stableCompare(b.key - a.key, a.originalIndex, b.originalIndex),
    );
    expect(sorted.map((r) => r.originalIndex)).toEqual([0, 2, 3, 1, 4]);
  });
});

describe("lemma/spill FILTER keep/error/fallback policy", () => {
  test("error always propagates regardless of truthiness", () => {
    expect(classifyFilterMask(true, true)).toBe(FILTER_ERROR);
    expect(classifyFilterMask(true, false)).toBe(FILTER_ERROR);
  });

  test("non-error truthy keeps, non-error falsy drops", () => {
    expect(classifyFilterMask(false, true)).toBe(FILTER_KEEP);
    expect(classifyFilterMask(false, false)).toBe(FILTER_DROP);
  });

  test("policy table: exhaustive isError/isTruthy matrix", () => {
    const bools = [false, true];
    for (const isError of bools) {
      for (const isTruthy of bools) {
        const result = classifyFilterMask(isError, isTruthy);
        if (isError) expect(result).toBe(FILTER_ERROR);
        else expect(result).toBe(isTruthy ? FILTER_KEEP : FILTER_DROP);
      }
    }
  });

  test("any kept item wins over the empty-result fallback", () => {
    expect(classifyFilterResult(1, false)).toBe(FILTER_RESULT_KEPT);
    expect(classifyFilterResult(5, true)).toBe(FILTER_RESULT_KEPT);
  });

  test("empty result defers to if_empty when supplied", () => {
    expect(classifyFilterResult(0, true)).toBe(FILTER_RESULT_IF_EMPTY);
  });

  test("empty result signals #CALC! precedence when if_empty is omitted", () => {
    expect(classifyFilterResult(0, false)).toBe(FILTER_RESULT_CALC_ERROR);
  });

  test("policy table: exhaustive keptCount boundary/hasIfEmpty matrix", () => {
    for (let keptCount = -1; keptCount <= 3; keptCount++) {
      for (const hasIfEmpty of [false, true]) {
        const result = classifyFilterResult(keptCount, hasIfEmpty);
        if (keptCount > 0) expect(result).toBe(FILTER_RESULT_KEPT);
        else expect(result).toBe(hasIfEmpty ? FILTER_RESULT_IF_EMPTY : FILTER_RESULT_CALC_ERROR);
      }
    }
  });
});

describe("lemma/spill vs shipping SC.Formula spill helpers", () => {
  test("shipping SPILL_MAX_COL/ROW/CELLS constants match the facade's documented bounds", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.SPILL_MAX_COL).toBe(SPILL_MAX_COL);
    expect(SC.Formula.SPILL_MAX_ROW).toBe(SPILL_MAX_ROW);
    // The facade takes maxCells as a caller parameter (no canonical facade
    // constant); the shipping cap is exercised directly below via
    // SC.Formula.SPILL_MAX_CELLS.
  });

  test("PlanSpillStatus: facade and shipping agree over a boundary/precedence matrix", async () => {
    const SC = await loadSocialCalc();
    const maxCells = SC.Formula.SPILL_MAX_CELLS as number;
    const cases: Array<[number, number, number, number, number]> = [
      [1, 1, 1, 1, maxCells],
      [1, 1, 1, 1, 0],
      [1, 1, -3, 2, maxCells],
      [1, 1, 2, -3, maxCells],
      [SPILL_MAX_COL, 1, 1, 2, maxCells],
      [1, SPILL_MAX_ROW, 2, 1, maxCells],
      [0, 1, 1, 1, maxCells],
      [1, 0, 1, 1, maxCells],
      [1, 1, 256, 256, maxCells - 1],
      [1, 1, 10, 10, maxCells],
      [SPILL_MAX_COL, SPILL_MAX_ROW, 1, 1, maxCells],
    ];
    for (const [anchorCol, anchorRow, rows, cols, cap] of cases) {
      const facadeResult = planSpillStatus(
        anchorCol,
        anchorRow,
        rows,
        cols,
        SPILL_MAX_COL,
        SPILL_MAX_ROW,
        cap,
      );
      const shippingResult = SC.Formula.PlanSpillStatus(
        anchorCol,
        anchorRow,
        rows,
        cols,
        SC.Formula.SPILL_MAX_COL,
        SC.Formula.SPILL_MAX_ROW,
        cap,
      );
      expect(facadeResult).toBe(shippingResult);
    }
  });

  test("PlanSpillStatus: facade and shipping agree exhaustively over small shapes/budgets", async () => {
    const SC = await loadSocialCalc();
    for (let rows = -1; rows <= 3; rows++) {
      for (let cols = -1; cols <= 3; cols++) {
        for (let cap = 0; cap <= 9; cap++) {
          const facadeResult = planSpillStatus(1, 1, rows, cols, SPILL_MAX_COL, SPILL_MAX_ROW, cap);
          const shippingResult = SC.Formula.PlanSpillStatus(
            1,
            1,
            rows,
            cols,
            SC.Formula.SPILL_MAX_COL,
            SC.Formula.SPILL_MAX_ROW,
            cap,
          );
          expect(facadeResult).toBe(shippingResult);
        }
      }
    }
  });

  test("ClassifySpillClaim: facade and shipping agree over every anchor/flag combination", async () => {
    const SC = await loadSocialCalc();
    const bools = [false, true];
    for (const isAnchorCell of bools) {
      for (const isBlank of bools) {
        for (const isOwnedBySameAnchor of bools) {
          for (const isForeignSpill of bools) {
            for (const hasUserContent of bools) {
              for (const isMergedTarget of bools) {
                const facadeResult = classifySpillClaim(
                  isAnchorCell,
                  isBlank,
                  isOwnedBySameAnchor,
                  isForeignSpill,
                  hasUserContent,
                  isMergedTarget,
                );
                const shippingResult = SC.Formula.ClassifySpillClaim(
                  isAnchorCell,
                  isBlank,
                  isOwnedBySameAnchor,
                  isForeignSpill,
                  hasUserContent,
                  isMergedTarget,
                );
                expect(facadeResult).toBe(shippingResult);
              }
            }
          }
        }
      }
    }
  });

  test("ClassifyResizeMembership: facade and shipping agree over every (inOld, inNew) pair", async () => {
    const SC = await loadSocialCalc();
    const bools = [false, true];
    for (const inOld of bools) {
      for (const inNew of bools) {
        expect(classifyResizeMembership(inOld, inNew)).toBe(
          SC.Formula.ClassifyResizeMembership(inOld, inNew),
        );
      }
    }
  });

  test("KeepUniqueItem: facade keepUniqueRow and shipping agree over a boundary matrix", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[number, number, number, boolean]> = [
      [0, 0, 1, false],
      [0, 0, 1, true],
      [3, 0, 3, false],
      [3, 0, 3, true],
      [5, 5, 1, true],
      [4, 0, 3, true],
    ];
    for (const [index, firstIndexOfValue, count, exactlyOnce] of cases) {
      expect(keepUniqueRow(index, firstIndexOfValue, count, exactlyOnce)).toBe(
        SC.Formula.KeepUniqueItem(index, firstIndexOfValue, count, exactlyOnce),
      );
    }
  });

  test("KeepUniqueItem: facade and shipping agree exhaustively over small index/count/exactlyOnce combinations", async () => {
    const SC = await loadSocialCalc();
    for (let count = 1; count <= 5; count++) {
      for (let index = 0; index < count; index++) {
        for (let firstIndexOfValue = 0; firstIndexOfValue < count; firstIndexOfValue++) {
          for (const exactlyOnce of [false, true]) {
            expect(keepUniqueRow(index, firstIndexOfValue, count, exactlyOnce)).toBe(
              SC.Formula.KeepUniqueItem(index, firstIndexOfValue, count, exactlyOnce),
            );
          }
        }
      }
    }
  });

  test("StableTieCompare: facade stableCompare and shipping agree over a boundary matrix", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[number, number, number]> = [
      [-1, 5, 2],
      [1, 0, 9],
      [-7, 100, 0],
      [0, 2, 5],
      [0, 5, 2],
      [0, 3, 3],
    ];
    for (const [comparatorResult, indexA, indexB] of cases) {
      expect(stableCompare(comparatorResult, indexA, indexB)).toBe(
        SC.Formula.StableTieCompare(comparatorResult, indexA, indexB),
      );
    }
  });

  test("StableTieCompare: facade and shipping agree exhaustively over small comparator/index combinations", async () => {
    const SC = await loadSocialCalc();
    for (let comparatorResult = -2; comparatorResult <= 2; comparatorResult++) {
      for (let indexA = 0; indexA <= 3; indexA++) {
        for (let indexB = 0; indexB <= 3; indexB++) {
          expect(stableCompare(comparatorResult, indexA, indexB)).toBe(
            SC.Formula.StableTieCompare(comparatorResult, indexA, indexB),
          );
        }
      }
    }
  });

  test("ClassifyFilterMask: facade and shipping agree over every isError/isTruthy combination", async () => {
    const SC = await loadSocialCalc();
    const bools = [false, true];
    for (const isError of bools) {
      for (const isTruthy of bools) {
        expect(classifyFilterMask(isError, isTruthy)).toBe(
          SC.Formula.ClassifyFilterMask(isError, isTruthy),
        );
      }
    }
  });

  test("ClassifyFilterResult: facade and shipping agree over a keptCount boundary/hasIfEmpty matrix", async () => {
    const SC = await loadSocialCalc();
    for (let keptCount = -1; keptCount <= 3; keptCount++) {
      for (const hasIfEmpty of [false, true]) {
        expect(classifyFilterResult(keptCount, hasIfEmpty)).toBe(
          SC.Formula.ClassifyFilterResult(keptCount, hasIfEmpty),
        );
      }
    }
  });

  test("live FILTER formula exercises ClassifyFilterMask and ClassifyFilterResult end to end", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set A2 value n 2",
      "set A3 value n 3",
      "set B1 formula A1>1",
      "set B2 formula A2>1",
      "set B3 formula A3>1",
    ]);
    await recalcSheet(SC, sheet);
    const filterResult = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens("FILTER(A1:A3,B1:B3)"),
      sheet,
      false,
    );
    expect(filterResult.type).toBe("array");
    const kept = (filterResult.value.cells as Array<Array<{ value: unknown }>>).map(
      (row) => row[0]!.value,
    );
    expect(kept).toEqual([2, 3]);
  });

  test("live SORT/UNIQUE formulas exercise KeepUniqueItem and StableTieCompare end to end", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 3",
      "set A2 value n 1",
      "set A3 value n 3",
      "set A4 value n 2",
    ]);
    await recalcSheet(SC, sheet);

    const sortResult = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens("SORT(A1:A4,1,1)"),
      sheet,
      false,
    );
    expect(sortResult.type).toBe("array");
    const sortedValues = (sortResult.value.cells as Array<Array<{ value: unknown }>>).map(
      (row) => row[0]!.value,
    );
    expect(sortedValues).toEqual([1, 2, 3, 3]);

    const uniqueResult = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens("UNIQUE(A1:A4)"),
      sheet,
      false,
    );
    expect(uniqueResult.type).toBe("array");
    const uniqueValues = (uniqueResult.value.cells as Array<Array<{ value: unknown }>>).map(
      (row) => row[0]!.value,
    );
    expect(uniqueValues.sort((a, b) => (a as number) - (b as number))).toEqual([1, 2, 3]);
  });
});
