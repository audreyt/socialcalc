import { describe, expect, test } from "vite-plus/test";

import {
  ARITY_OK,
  ARITY_TOO_FEW,
  ARITY_TOO_MANY,
  RECURSION_EXCEEDED,
  RECURSION_OK,
  classifyArity,
  isValidRectShape,
  recursionStatus,
  resolveScopeIndex,
  shapesMatch,
} from "../lemma/lambda-scope";
import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/lambda-scope binding/scope/shape laws (Dafny/Lean surface)", () => {
  test("classifyArity: too few, too many, exact", () => {
    expect(classifyArity(2, 1)).toBe(ARITY_TOO_FEW);
    expect(classifyArity(2, 3)).toBe(ARITY_TOO_MANY);
    expect(classifyArity(2, 2)).toBe(ARITY_OK);
    expect(classifyArity(0, 0)).toBe(ARITY_OK);
  });

  test("resolveScopeIndex: innermost-wins lexical shadowing", () => {
    expect(resolveScopeIndex([])).toBe(-1);
    expect(resolveScopeIndex([false, false, false])).toBe(-1);
    expect(resolveScopeIndex([true, false, false])).toBe(0);
    expect(resolveScopeIndex([true, true, false])).toBe(1);
    expect(resolveScopeIndex([true, true, true])).toBe(2);
    expect(resolveScopeIndex([false, true, false])).toBe(1);
  });

  test("recursionStatus: depth ceiling", () => {
    expect(recursionStatus(1, 200)).toBe(RECURSION_OK);
    expect(recursionStatus(200, 200)).toBe(RECURSION_OK);
    expect(recursionStatus(201, 200)).toBe(RECURSION_EXCEEDED);
  });

  test("shapesMatch: row/col rectangle agreement", () => {
    expect(shapesMatch(3, 4, 3, 4)).toBe(true);
    expect(shapesMatch(3, 4, 4, 3)).toBe(false);
    expect(shapesMatch(1, 1, 1, 2)).toBe(false);
  });

  test("isValidRectShape: strictly positive extents only", () => {
    expect(isValidRectShape(1, 1)).toBe(true);
    expect(isValidRectShape(0, 1)).toBe(false);
    expect(isValidRectShape(1, 0)).toBe(false);
    expect(isValidRectShape(-1, 1)).toBe(false);
  });
});

describe("lemma/lambda-scope vs shipping FormulaParseMut", () => {
  test("ClassifyArity matches shipping for LAMBDA/named-lambda call arity", async () => {
    const SC = await loadSocialCalc();
    const scf = SC.Formula as unknown as {
      ClassifyArity: (paramCount: number, argCount: number) => number;
    };
    for (const [p, a] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [3, 2],
      [3, 3],
      [3, 4],
    ] as const) {
      expect(scf.ClassifyArity(p, a)).toBe(classifyArity(p, a));
    }
  });

  test("ResolveScopeIndex matches shipping for lexical shadowing", async () => {
    const SC = await loadSocialCalc();
    const scf = SC.Formula as unknown as {
      ResolveScopeIndex: (matches: boolean[]) => number;
    };
    const cases: boolean[][] = [
      [],
      [false],
      [true],
      [true, false],
      [false, true],
      [true, true],
      [false, false, true],
      [true, false, true],
    ];
    for (const matches of cases) {
      expect(scf.ResolveScopeIndex(matches)).toBe(resolveScopeIndex(matches));
    }
  });

  test("RecursionStatus matches shipping recursion-guard ceiling", async () => {
    const SC = await loadSocialCalc();
    const scf = SC.Formula as unknown as {
      RecursionStatus: (depth: number, maxDepth: number) => number;
      LAMBDA_MAX_DEPTH: number;
    };
    expect(scf.LAMBDA_MAX_DEPTH).toBe(200);
    for (const depth of [0, 1, 199, 200, 201, 500]) {
      expect(scf.RecursionStatus(depth, scf.LAMBDA_MAX_DEPTH)).toBe(
        recursionStatus(depth, scf.LAMBDA_MAX_DEPTH),
      );
    }
  });

  test("ShapesMatch/IsValidRectShape match shipping MAKEARRAY/MAP output-shape policy", async () => {
    const SC = await loadSocialCalc();
    const scf = SC.Formula as unknown as {
      ShapesMatch: (rows1: number, cols1: number, rows2: number, cols2: number) => boolean;
      IsValidRectShape: (rows: number, cols: number) => boolean;
    };
    for (const [r1, c1, r2, c2] of [
      [2, 3, 2, 3],
      [2, 3, 3, 2],
      [1, 1, 1, 1],
    ] as const) {
      expect(scf.ShapesMatch(r1, c1, r2, c2)).toBe(shapesMatch(r1, c1, r2, c2));
    }
    for (const [rows, cols] of [
      [1, 1],
      [0, 1],
      [1, 0],
      [5, 5],
    ] as const) {
      expect(scf.IsValidRectShape(rows, cols)).toBe(isValidRectShape(rows, cols));
    }
  });

  test("live LET/LAMBDA/MAKEARRAY formulas exercise the same scope/shape policy", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    // Nested LET shadowing: innermost x wins (resolveScopeIndex policy).
    const shadow = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens("LET(x,1,LET(x,2,x))"),
      sheet,
      false,
    );
    expect(shadow.value).toBe(2);

    // LAMBDA arity mismatch -> error (classifyArity ARITY_TOO_FEW/TOO_MANY).
    const tooFew = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens("LAMBDA(a,b,a+b)(1)"),
      sheet,
      false,
    );
    expect(tooFew.type.charAt(0)).toBe("e");

    // MAKEARRAY output shape must be the requested rows x cols rectangle.
    const arr = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens("MAKEARRAY(2,2,LAMBDA(r,c,r+c))"),
      sheet,
      false,
    );
    expect(arr.type).toBe("array");
  });
});
