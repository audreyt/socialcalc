import { describe, expect, test } from "vite-plus/test";

import {
  allMatched,
  DECIDE_AVERAGE,
  DECIDE_COUNT,
  DECIDE_DIV0,
  DECIDE_ERROR,
  DECIDE_MAX,
  DECIDE_MIN,
  DECIDE_ZERO,
  FN_AVERAGE,
  FN_COUNTIFS,
  FN_MAXIFS,
  FN_MINIFS,
  nextErrorState,
  nextMax,
  nextMin,
  resultDecision,
  shapesMatch,
} from "../lemma/criteria";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("lemma/criteria pure core (Dafny/Lean surface)", () => {
  test("allMatched: empty and all-true are matched; any false short-circuits", () => {
    expect(allMatched([])).toBe(true);
    expect(allMatched([true, true, true])).toBe(true);
    expect(allMatched([true, false, true])).toBe(false);
    expect(allMatched([false])).toBe(false);
  });

  test("nextErrorState: first-error-wins, sticky once captured", () => {
    expect(nextErrorState(false, false)).toBe(false);
    expect(nextErrorState(false, true)).toBe(true);
    expect(nextErrorState(true, false)).toBe(true); // sticky
    expect(nextErrorState(true, true)).toBe(true);
  });

  test("nextMax: seeds on first numeric cell, then running max", () => {
    expect(nextMax(false, 0, 5)).toBe(5); // no prior value — seed
    expect(nextMax(true, 10, 5)).toBe(10); // 5 <= 10, keep prev
    expect(nextMax(true, 10, 15)).toBe(15); // 15 > 10, update
    expect(nextMax(true, -3, -3)).toBe(-3); // tie keeps prev (== path)
  });

  test("nextMin: seeds on first numeric cell, then running min", () => {
    expect(nextMin(false, 0, 5)).toBe(5);
    expect(nextMin(true, 10, 15)).toBe(10); // 15 >= 10, keep prev
    expect(nextMin(true, 10, 3)).toBe(3); // 3 < 10, update
    expect(nextMin(true, -3, -3)).toBe(-3); // tie keeps prev
  });

  test("shapesMatch: equality of both dimensions, order-sensitive per axis", () => {
    expect(shapesMatch(2, 3, 2, 3)).toBe(true);
    expect(shapesMatch(2, 3, 3, 2)).toBe(false); // transposed shape is NOT a match
    expect(shapesMatch(2, 3, 2, 4)).toBe(false);
    expect(shapesMatch(1, 1, 1, 1)).toBe(true);
  });

  test("resultDecision: COUNTIFS always counts regardless of error/numeric state", () => {
    expect(resultDecision(FN_COUNTIFS, false, 0)).toBe(DECIDE_COUNT);
    expect(resultDecision(FN_COUNTIFS, true, 5)).toBe(DECIDE_COUNT);
  });

  test("resultDecision: a captured error outranks every numeric branch", () => {
    expect(resultDecision(FN_AVERAGE, true, 3)).toBe(DECIDE_ERROR);
    expect(resultDecision(FN_MAXIFS, true, 0)).toBe(DECIDE_ERROR);
    expect(resultDecision(FN_MINIFS, true, 7)).toBe(DECIDE_ERROR);
  });

  test("resultDecision: AVERAGE family empty-numeric-match is DIV0, not zero", () => {
    expect(resultDecision(FN_AVERAGE, false, 0)).toBe(DECIDE_DIV0);
    expect(resultDecision(FN_AVERAGE, false, 1)).toBe(DECIDE_AVERAGE);
  });

  test("resultDecision: MAXIFS/MINIFS empty-numeric-match is zero, not DIV0", () => {
    expect(resultDecision(FN_MAXIFS, false, 0)).toBe(DECIDE_ZERO);
    expect(resultDecision(FN_MAXIFS, false, 2)).toBe(DECIDE_MAX);
    expect(resultDecision(FN_MINIFS, false, 0)).toBe(DECIDE_ZERO);
    expect(resultDecision(FN_MINIFS, false, 2)).toBe(DECIDE_MIN);
  });
});

describe("lemma/criteria vs shipping CriteriaAggregateFunctions", () => {
  async function evalFormula(formula: string, cells: Record<string, [number | string, string]>) {
    const SC = await loadSocialCalc();
    if (SC.Formula) {
      SC.Formula.SheetCache.sheets = {};
      SC.Formula.SheetCache.waitingForLoading = null;
    }
    const sheet = new SC.Sheet();
    const commands = Object.entries(cells).map(([coord, [value, kind]]) =>
      kind === "n" ? `set ${coord} value n ${value}` : `set ${coord} text t ${value}`,
    );
    await scheduleCommands(SC, sheet, commands, true, 4000);
    await recalcSheet(SC, sheet, 4000);
    const parsed = SC.Formula.ParseFormulaIntoTokens(formula);
    return SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
  }

  test("resultDecision(FN_COUNTIFS, ...) matches shipping COUNTIFS on a no-match case", async () => {
    const decision = resultDecision(FN_COUNTIFS, false, 0);
    expect(decision).toBe(DECIDE_COUNT);
    const shipped = await evalFormula('COUNTIFS(A1:A1,">100")', { A1: [5, "n"] });
    // DECIDE_COUNT means "push count regardless" — shipping pushes 0, type "n".
    expect(shipped).toMatchObject({ value: 0, type: "n" });
  });

  test("resultDecision(FN_AVERAGE, false, 0) matches shipping AVERAGEIFS no-match DIV0", async () => {
    const decision = resultDecision(FN_AVERAGE, false, 0);
    expect(decision).toBe(DECIDE_DIV0);
    const shipped = await evalFormula("AVERAGEIFS(A1:A1,B1:B1,999)", {
      A1: [5, "n"],
      B1: [1, "n"],
    });
    expect(shipped.type).toBe("e#DIV/0!");
  });

  test("resultDecision(FN_MAXIFS, false, 0) matches shipping MAXIFS no-match zero", async () => {
    const decision = resultDecision(FN_MAXIFS, false, 0);
    expect(decision).toBe(DECIDE_ZERO);
    const shipped = await evalFormula("MAXIFS(A1:A1,B1:B1,999)", {
      A1: [5, "n"],
      B1: [1, "n"],
    });
    expect(shipped).toMatchObject({ value: 0, type: "n" });
  });

  test("resultDecision(FN_MINIFS, false, 0) matches shipping MINIFS no-match zero", async () => {
    const decision = resultDecision(FN_MINIFS, false, 0);
    expect(decision).toBe(DECIDE_ZERO);
    const shipped = await evalFormula("MINIFS(A1:A1,B1:B1,999)", {
      A1: [5, "n"],
      B1: [1, "n"],
    });
    expect(shipped).toMatchObject({ value: 0, type: "n" });
  });

  test("resultDecision(..., true, ...) matches shipping error propagation ahead of a numeric result", async () => {
    const decision = resultDecision(FN_MAXIFS, true, 3);
    expect(decision).toBe(DECIDE_ERROR);

    const SC = await loadSocialCalc();
    if (SC.Formula) {
      SC.Formula.SheetCache.sheets = {};
      SC.Formula.SheetCache.waitingForLoading = null;
    }
    const sheet = new SC.Sheet();
    // A1 is an error (#DIV/0!), A2 is numeric; both rows match B:1. The
    // captured error from A1 must win over A2's numeric value — mirroring
    // resultDecision(FN_MAXIFS, true, ...) === DECIDE_ERROR regardless of
    // how many numeric matches also occurred.
    await scheduleCommands(
      SC,
      sheet,
      ["set A1 formula 1/0", "set A2 value n 5", "set B1 value n 1", "set B2 value n 1"],
      true,
      4000,
    );
    await recalcSheet(SC, sheet, 4000);
    const parsed = SC.Formula.ParseFormulaIntoTokens("MAXIFS(A1:A2,B1:B2,1)");
    const shipped = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
    expect(shipped.type).toBe("e#DIV/0!");
  });

  test("shapesMatch mirrors shipping *IFS dimension-congruence #VALUE! policy", async () => {
    expect(shapesMatch(1, 2, 1, 1)).toBe(false);
    const shipped = await evalFormula('COUNTIFS(A1:A2,">0",B1:B1,">0")', {
      A1: [1, "n"],
      A2: [2, "n"],
      B1: [1, "n"],
    });
    expect(shipped.type).toBe("e#VALUE!");
  });
});
