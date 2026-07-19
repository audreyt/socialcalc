import { describe, expect, test } from "vite-plus/test";

import {
  PIVOT_BOUNDS_OVERFLOW,
  PIVOT_CLAIM_ALLOWED,
  PIVOT_CLAIM_COLLISION,
  PIVOT_CLAIM_RECLAIMABLE,
  PIVOT_INVALID_SHAPE,
  PIVOT_OK,
  PIVOT_RESOURCE_LIMIT,
  RANK_BLANK,
  RANK_ERROR,
  RANK_NUMBER,
  RANK_TEXT,
  AGG_AVERAGE,
  AGG_COUNT,
  AGG_COUNTA,
  AGG_MAX,
  AGG_MIN,
  AGG_SUM,
  AGG_DIV0,
  AGG_OK,
  aggregateContributes,
  aggregateContributesCountA,
  aggregateContributesNumeric,
  aggregateStatus,
  classifyPivotClaim,
  compareGroupKey,
  isBlankType,
  isNumericType,
  isPivotWithinBounds,
  isPivotWithinBudget,
  isValidPivotShape,
  nextCount,
  nextMax,
  nextMin,
  nextSum,
  pivotCellCount,
  pivotEndCol,
  pivotEndRow,
  planPivotStatus,
  typeRank,
} from "../lemma/pivot";

import { loadSocialCalc } from "./helpers/socialcalc";

// --- 1. Typed group-key ordering --------------------------------------------

describe("lemma/pivot typed group-key ordering (Dafny/Lean surface)", () => {
  test("typeRank orders numbers < text < errors < everything else (blank)", () => {
    expect(typeRank("n")).toBe(RANK_NUMBER);
    expect(typeRank("t")).toBe(RANK_TEXT);
    expect(typeRank("e")).toBe(RANK_ERROR);
    expect(typeRank("b")).toBe(RANK_BLANK);
    expect(typeRank("")).toBe(RANK_BLANK);
    expect(typeRank("anything-else")).toBe(RANK_BLANK);
  });

  test("compareGroupKey: rank difference wins outright", () => {
    expect(compareGroupKey(RANK_NUMBER, RANK_TEXT, 0, 5, 0)).toBe(-1);
    expect(compareGroupKey(RANK_ERROR, RANK_NUMBER, 0, 0, 5)).toBe(1);
  });

  test("compareGroupKey: same-rank tie falls back to sameTypeCompare", () => {
    expect(compareGroupKey(RANK_NUMBER, RANK_NUMBER, -1, 9, 0)).toBe(-1);
    expect(compareGroupKey(RANK_NUMBER, RANK_NUMBER, 1, 0, 9)).toBe(1);
  });

  test("compareGroupKey: full tie falls back to original index order (stable)", () => {
    expect(compareGroupKey(RANK_TEXT, RANK_TEXT, 0, 2, 5)).toBe(-1);
    expect(compareGroupKey(RANK_TEXT, RANK_TEXT, 0, 5, 2)).toBe(1);
    expect(compareGroupKey(RANK_TEXT, RANK_TEXT, 0, 3, 3)).toBe(0);
  });

  test("compareGroupKey is a total order over a small exhaustive matrix", () => {
    const ranks = [RANK_NUMBER, RANK_TEXT, RANK_ERROR, RANK_BLANK];
    for (const rankA of ranks) {
      for (const rankB of ranks) {
        for (const same of [-1, 0, 1]) {
          for (let indexA = 0; indexA <= 2; indexA++) {
            for (let indexB = 0; indexB <= 2; indexB++) {
              const result = compareGroupKey(rankA, rankB, same, indexA, indexB);
              expect([-1, 0, 1]).toContain(result);
              if (rankA !== rankB) {
                expect(result).toBe(rankA < rankB ? -1 : 1);
              } else if (same !== 0) {
                expect(result).toBe(same);
              } else {
                expect(result).toBe(indexA === indexB ? 0 : indexA < indexB ? -1 : 1);
              }
            }
          }
        }
      }
    }
  });
});

// --- 2. Aggregate result/error classification -------------------------------

describe("lemma/pivot aggregate contribution and error classification", () => {
  test("isNumericType/isBlankType classify exactly the expected type chars", () => {
    expect(isNumericType("n")).toBe(true);
    expect(isNumericType("t")).toBe(false);
    expect(isBlankType("b")).toBe(true);
    expect(isBlankType("n")).toBe(false);
  });

  test("aggregateContributesNumeric is numeric-only", () => {
    for (const t of ["n", "t", "e", "b"]) {
      expect(aggregateContributesNumeric(t)).toBe(t === "n");
    }
  });

  test("aggregateContributesCountA is any non-blank", () => {
    for (const t of ["n", "t", "e", "b"]) {
      expect(aggregateContributesCountA(t)).toBe(t !== "b");
    }
  });

  test("aggregateContributes: COUNTA counts non-blank, every other function counts numeric-only", () => {
    const fns = [AGG_SUM, AGG_COUNT, AGG_COUNTA, AGG_AVERAGE, AGG_MIN, AGG_MAX];
    for (const fn of fns) {
      for (const t of ["n", "t", "e", "b"]) {
        const expected = fn === AGG_COUNTA ? t !== "b" : t === "n";
        expect(aggregateContributes(fn, t)).toBe(expected);
      }
    }
  });

  test("nextSum only accumulates when contributing", () => {
    expect(nextSum(10, true, 5)).toBe(15);
    expect(nextSum(10, false, 5)).toBe(10);
  });

  test("nextCount only increments when contributing", () => {
    expect(nextCount(3, true)).toBe(4);
    expect(nextCount(3, false)).toBe(3);
  });

  test("nextMin: first contribution seeds unconditionally, then only tightens", () => {
    expect(nextMin(0, false, true, 7)).toBe(7); // seed
    expect(nextMin(7, true, true, 3)).toBe(3); // new min
    expect(nextMin(7, true, true, 9)).toBe(7); // not smaller, unchanged
    expect(nextMin(7, true, false, 3)).toBe(7); // non-contributing, unchanged
  });

  test("nextMax: first contribution seeds unconditionally, then only grows", () => {
    expect(nextMax(0, false, true, 7)).toBe(7); // seed
    expect(nextMax(7, true, true, 9)).toBe(9); // new max
    expect(nextMax(7, true, true, 3)).toBe(7); // not larger, unchanged
    expect(nextMax(7, true, false, 9)).toBe(7); // non-contributing, unchanged
  });

  test("aggregateStatus: only AVERAGE with zero numeric contributions is #DIV/0!", () => {
    expect(aggregateStatus(AGG_AVERAGE, 0)).toBe(AGG_DIV0);
    expect(aggregateStatus(AGG_AVERAGE, 1)).toBe(AGG_OK);
    for (const fn of [AGG_SUM, AGG_COUNT, AGG_COUNTA, AGG_MIN, AGG_MAX]) {
      expect(aggregateStatus(fn, 0)).toBe(AGG_OK);
      expect(aggregateStatus(fn, 5)).toBe(AGG_OK);
    }
  });
});

// --- 3. Output-shape/collision policy ---------------------------------------

describe("lemma/pivot output-shape/collision policy", () => {
  test("isValidPivotShape rejects non-positive rows/cols", () => {
    expect(isValidPivotShape(1, 1)).toBe(true);
    expect(isValidPivotShape(0, 5)).toBe(false);
    expect(isValidPivotShape(5, 0)).toBe(false);
    expect(isValidPivotShape(-1, 5)).toBe(false);
  });

  test("pivotEndCol/pivotEndRow and isPivotWithinBounds", () => {
    expect(pivotEndCol(1, 3)).toBe(3);
    expect(pivotEndRow(1, 3)).toBe(3);
    expect(isPivotWithinBounds(1, 1, 3, 3, 702, 65536)).toBe(true);
    expect(isPivotWithinBounds(702, 1, 1, 1, 702, 65536)).toBe(true);
    expect(isPivotWithinBounds(702, 1, 1, 2, 702, 65536)).toBe(false);
    expect(isPivotWithinBounds(0, 1, 1, 1, 702, 65536)).toBe(false);
  });

  test("pivotCellCount and isPivotWithinBudget", () => {
    expect(pivotCellCount(4, 5)).toBe(20);
    expect(isPivotWithinBudget(4, 5, 20)).toBe(true);
    expect(isPivotWithinBudget(4, 5, 19)).toBe(false);
  });

  test("planPivotStatus checks shape, then bounds, then budget, in that precedence order", () => {
    expect(planPivotStatus(1, 1, 0, 5, 702, 65536, 100)).toBe(PIVOT_INVALID_SHAPE);
    expect(planPivotStatus(702, 1, 1, 2, 702, 65536, 100)).toBe(PIVOT_BOUNDS_OVERFLOW);
    expect(planPivotStatus(1, 1, 5, 5, 702, 65536, 10)).toBe(PIVOT_RESOURCE_LIMIT);
    expect(planPivotStatus(1, 1, 5, 5, 702, 65536, 25)).toBe(PIVOT_OK);
  });

  test("planPivotStatus agrees with a hand-computed exhaustive small-shape matrix", () => {
    for (let rows = -1; rows <= 3; rows++) {
      for (let cols = -1; cols <= 3; cols++) {
        for (let cap = 0; cap <= 9; cap++) {
          const result = planPivotStatus(1, 1, rows, cols, 702, 65536, cap);
          if (rows <= 0 || cols <= 0) expect(result).toBe(PIVOT_INVALID_SHAPE);
          else if (rows * cols > cap) expect(result).toBe(PIVOT_RESOURCE_LIMIT);
          else expect(result).toBe(PIVOT_OK);
        }
      }
    }
  });

  test("classifyPivotClaim: anchor always allowed", () => {
    expect(classifyPivotClaim(true, false, false, true, true, true)).toBe(PIVOT_CLAIM_ALLOWED);
  });

  test("classifyPivotClaim: foreign/user/merged always collide (even if also blank/owned)", () => {
    expect(classifyPivotClaim(false, true, true, true, false, false)).toBe(PIVOT_CLAIM_COLLISION);
    expect(classifyPivotClaim(false, true, true, false, true, false)).toBe(PIVOT_CLAIM_COLLISION);
    expect(classifyPivotClaim(false, true, true, false, false, true)).toBe(PIVOT_CLAIM_COLLISION);
  });

  test("classifyPivotClaim: blank or same-pivot-owned targets reclaim when nothing blocks", () => {
    expect(classifyPivotClaim(false, true, false, false, false, false)).toBe(
      PIVOT_CLAIM_RECLAIMABLE,
    );
    expect(classifyPivotClaim(false, false, true, false, false, false)).toBe(
      PIVOT_CLAIM_RECLAIMABLE,
    );
  });

  test("classifyPivotClaim: unclassified non-blank content defaults to collision, never silently allowed", () => {
    expect(classifyPivotClaim(false, false, false, false, false, false)).toBe(
      PIVOT_CLAIM_COLLISION,
    );
  });

  test("classifyPivotClaim covers every flag combination with a valid, deterministic code", () => {
    const bools = [false, true];
    for (const isAnchorCell of bools) {
      for (const isBlank of bools) {
        for (const isOwnedBySamePivot of bools) {
          for (const isForeignOwned of bools) {
            for (const hasUserContent of bools) {
              for (const isMergedTarget of bools) {
                const result = classifyPivotClaim(
                  isAnchorCell,
                  isBlank,
                  isOwnedBySamePivot,
                  isForeignOwned,
                  hasUserContent,
                  isMergedTarget,
                );
                expect([
                  PIVOT_CLAIM_ALLOWED,
                  PIVOT_CLAIM_RECLAIMABLE,
                  PIVOT_CLAIM_COLLISION,
                ]).toContain(result);
                if (isAnchorCell) expect(result).toBe(PIVOT_CLAIM_ALLOWED);
                else if (isForeignOwned || hasUserContent || isMergedTarget)
                  expect(result).toBe(PIVOT_CLAIM_COLLISION);
                else if (isBlank || isOwnedBySamePivot)
                  expect(result).toBe(PIVOT_CLAIM_RECLAIMABLE);
                else expect(result).toBe(PIVOT_CLAIM_COLLISION);
              }
            }
          }
        }
      }
    }
  });
});

// --- 4. Facade vs shipping SC.Pivot cross-check -----------------------------

describe("lemma/pivot vs shipping SC.Pivot helpers", () => {
  test("shipping bounds match facade constants (mirrors SPILL_MAX_COL/ROW convention)", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Pivot.MAX_COL).toBe(702);
    expect(SC.Pivot.MAX_ROW).toBe(65536);
  });

  test("TypeRank: facade and shipping agree over every type char", async () => {
    const SC = await loadSocialCalc();
    for (const t of ["n", "t", "e", "b", "", "x"]) {
      expect(typeRank(t)).toBe(SC.Pivot.TypeRank(t));
    }
  });

  test("CompareGroupKey: facade and shipping agree over a boundary matrix", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[number, number, number, number, number]> = [
      [0, 1, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [0, 0, -1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 2, 5],
      [0, 0, 0, 5, 2],
      [0, 0, 0, 3, 3],
    ];
    for (const [rankA, rankB, same, indexA, indexB] of cases) {
      expect(compareGroupKey(rankA, rankB, same, indexA, indexB)).toBe(
        SC.Pivot.CompareGroupKey(rankA, rankB, same, indexA, indexB),
      );
    }
  });

  test("AggregateContributes/NextSum/NextCount/NextMin/NextMax: facade and shipping agree", async () => {
    const SC = await loadSocialCalc();
    for (const fn of [AGG_SUM, AGG_COUNT, AGG_COUNTA, AGG_AVERAGE, AGG_MIN, AGG_MAX]) {
      for (const t of ["n", "t", "e", "b"]) {
        expect(aggregateContributes(fn, t)).toBe(SC.Pivot.AggregateContributes(fn, t));
      }
    }
    expect(nextSum(1, true, 4)).toBe(SC.Pivot.NextSum(1, true, 4));
    expect(nextCount(1, true)).toBe(SC.Pivot.NextCount(1, true));
    expect(nextMin(0, false, true, 4)).toBe(SC.Pivot.NextMin(0, false, true, 4));
    expect(nextMax(0, false, true, 4)).toBe(SC.Pivot.NextMax(0, false, true, 4));
  });

  test("AggregateStatus: facade and shipping agree over every function/count combination", async () => {
    const SC = await loadSocialCalc();
    for (const fn of [AGG_SUM, AGG_COUNT, AGG_COUNTA, AGG_AVERAGE, AGG_MIN, AGG_MAX]) {
      for (let count = 0; count <= 3; count++) {
        expect(aggregateStatus(fn, count)).toBe(SC.Pivot.AggregateStatus(fn, count));
      }
    }
  });

  test("PlanPivotStatus: facade and shipping agree over a boundary/precedence matrix", async () => {
    const SC = await loadSocialCalc();
    const maxCells = SC.Pivot.MAX_CELLS as number;
    const cases: Array<[number, number, number, number, number]> = [
      [1, 1, 1, 1, maxCells],
      [1, 1, 1, 1, 0],
      [1, 1, -3, 2, maxCells],
      [1, 1, 2, -3, maxCells],
      [SC.Pivot.MAX_COL, 1, 1, 2, maxCells],
      [1, SC.Pivot.MAX_ROW, 2, 1, maxCells],
      [0, 1, 1, 1, maxCells],
      [1, 0, 1, 1, maxCells],
      [1, 1, 256, 256, maxCells - 1],
      [1, 1, 10, 10, maxCells],
      [SC.Pivot.MAX_COL, SC.Pivot.MAX_ROW, 1, 1, maxCells],
    ];
    for (const [anchorCol, anchorRow, rows, cols, cap] of cases) {
      expect(
        planPivotStatus(anchorCol, anchorRow, rows, cols, SC.Pivot.MAX_COL, SC.Pivot.MAX_ROW, cap),
      ).toBe(
        SC.Pivot.PlanPivotStatus(
          anchorCol,
          anchorRow,
          rows,
          cols,
          SC.Pivot.MAX_COL,
          SC.Pivot.MAX_ROW,
          cap,
        ),
      );
    }
  });

  test("ClassifyPivotClaim: facade and shipping agree over every flag combination", async () => {
    const SC = await loadSocialCalc();
    const bools = [false, true];
    for (const isAnchorCell of bools) {
      for (const isBlank of bools) {
        for (const isOwnedBySamePivot of bools) {
          for (const isForeignOwned of bools) {
            for (const hasUserContent of bools) {
              for (const isMergedTarget of bools) {
                expect(
                  classifyPivotClaim(
                    isAnchorCell,
                    isBlank,
                    isOwnedBySamePivot,
                    isForeignOwned,
                    hasUserContent,
                    isMergedTarget,
                  ),
                ).toBe(
                  SC.Pivot.ClassifyPivotClaim(
                    isAnchorCell,
                    isBlank,
                    isOwnedBySamePivot,
                    isForeignOwned,
                    hasUserContent,
                    isMergedTarget,
                  ),
                );
              }
            }
          }
        }
      }
    }
  });
});
