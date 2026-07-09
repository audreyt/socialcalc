import { describe, expect, test } from "bun:test";

import {
  ERR_DIV0,
  ERR_REF,
  ERR_VALUE,
  TY_N,
  TY_T,
  arithType,
  concatType,
  divType,
  fromValueType,
  isErrorType,
  toValueType,
} from "../lemma/eval-ops";
import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/eval-ops lattice laws (Dafny/Lean surface)", () => {
  test("isErrorType codes", () => {
    expect(isErrorType(TY_N)).toBe(false);
    expect(isErrorType(TY_T)).toBe(false);
    expect(isErrorType(ERR_REF)).toBe(true);
    expect(isErrorType(ERR_DIV0)).toBe(true);
    expect(isErrorType(ERR_VALUE)).toBe(true);
  });

  test("arithType left-biased error lattice", () => {
    expect(arithType(ERR_REF, ERR_DIV0)).toBe(ERR_REF);
    expect(arithType(TY_N, ERR_REF)).toBe(ERR_REF);
    expect(arithType(ERR_DIV0, TY_N)).toBe(ERR_DIV0);
    expect(arithType(TY_N, TY_N)).toBe(TY_N);
    expect(arithType(TY_N, TY_T)).toBe(ERR_VALUE);
    expect(arithType(TY_T, TY_N)).toBe(ERR_VALUE);
  });

  test("divType: error before zero (the fixed bug)", () => {
    // 1/#REF! → REF, not DIV0
    expect(divType(TY_N, ERR_REF, 0)).toBe(ERR_REF);
    // #REF!/0 → REF (left error wins)
    expect(divType(ERR_REF, TY_N, 0)).toBe(ERR_REF);
    // #REF!/#REF! → left REF
    expect(divType(ERR_REF, ERR_REF, 0)).toBe(ERR_REF);
    // plain 1/0 → DIV0
    expect(divType(TY_N, TY_N, 0)).toBe(ERR_DIV0);
    // 5/2 → N
    expect(divType(TY_N, TY_N, 2)).toBe(TY_N);
    // 1/"x" → VALUE
    expect(divType(TY_N, TY_T, 0)).toBe(ERR_VALUE);
  });

  test("concatType: either-side error", () => {
    expect(concatType(TY_T, ERR_REF)).toBe(ERR_REF);
    expect(concatType(ERR_REF, TY_T)).toBe(ERR_REF);
    expect(concatType(ERR_REF, ERR_DIV0)).toBe(ERR_REF);
    expect(concatType(TY_T, TY_T)).toBe(TY_T);
    expect(concatType(TY_N, TY_N)).toBe(TY_T);
  });
});

describe("lemma/eval-ops vs shipping EvaluatePolish", () => {
  test("divType matches evaluate_parsed_formula for / error cases", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const cases: Array<[string, number]> = [
      ["1/#REF!", ERR_REF],
      ["#REF!/0", ERR_REF],
      ["#REF!/#REF!", ERR_REF],
      ["1/0", ERR_DIV0],
      ['1/"x"', ERR_VALUE],
      ["5/2", TY_N],
      ["1+#REF!", ERR_REF],
    ];
    for (const [formula, expected] of cases) {
      const r = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens(formula),
        sheet,
        false,
      );
      // For pure lattice cases we only compare the error/type outcome.
      if (expected === TY_N) {
        expect(r.type.charAt(0)).toBe("n");
      } else {
        expect(fromValueType(r.type)).toBe(expected);
        expect(toValueType(expected)).toBe(
          expected === ERR_REF
            ? "e#REF!"
            : expected === ERR_DIV0
              ? "e#DIV/0!"
              : "e#VALUE!",
        );
      }
    }
  });

  test("concatType matches evaluate_parsed_formula for & error cases", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const right = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('"x"&#REF!'),
      sheet,
      false,
    );
    expect(fromValueType(right.type)).toBe(ERR_REF);

    const left = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('#REF!&"x"'),
      sheet,
      false,
    );
    expect(fromValueType(left.type)).toBe(ERR_REF);

    const ok = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('"a"&"b"'),
      sheet,
      false,
    );
    expect(ok.type.charAt(0)).toBe("t");
  });
});
