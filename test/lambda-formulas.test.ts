// LET/LAMBDA/callable-lambda/MAP/REDUCE/SCAN/BYROW/BYCOL/MAKEARRAY behavior.
//
// Covers: sequential LET binding, lexical shadowing, closures over an
// enclosing LET, nested/self/mutual recursion + the bounded recursion
// guard, immediate lambda invocation `LAMBDA(...)(...)`, named-lambda
// callable syntax, array/row/col higher-order functions, error
// propagation, invalid names/arity, coord-shaped-param rejection, the
// global-name-scope-leak guard, and copy/fill formula-ref rewriting of
// LET/LAMBDA formulas (parameter-name safety).

import { describe, expect, test } from "vitest";
import { loadSocialCalc, scheduleCommands, recalcSheet } from "./helpers/socialcalc";

async function evalFormula(SC: any, sheet: any, formula: string) {
  return SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens(formula),
    sheet,
    false,
  );
}

describe("LET", () => {
  test("binds a single name and uses it in the calculation", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(x,5,x+1)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(6);
  });

  test("binds names sequentially -- each later value can reference earlier names", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(a,2,b,a*3,c,b+a,c)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(8); // a=2, b=6, c=8
  });

  test("a later name shadows an earlier one of the same name (lexical, innermost wins)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(x,1,x,x+10,x)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(11);
  });

  test("shadows a global named range without mutating it", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.names["FOO"] = { desc: "", definition: "=42" };
    const result = await evalFormula(SC, sheet, "LET(FOO,1,FOO+1)");
    expect(result.value).toBe(2);
    const globalResult = await evalFormula(SC, sheet, "FOO");
    expect(globalResult.value).toBe(42); // global untouched
  });

  test("a global name referenced inside a LET body resolves against the global scope, not a same-named local elsewhere", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.names["OTHER"] = { desc: "", definition: "=10" };
    sheet.names["MYGLOBAL"] = { desc: "", definition: "=OTHER+1" };
    // A LET binds a *different* local name (G); MYGLOBAL's own definition
    // must still see the real global OTHER, not any local scope leaking in.
    const result = await evalFormula(SC, sheet, "LET(G,5,MYGLOBAL)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(11);
  });

  test("nested LET: inner LET's name is invisible outside it", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(x,1,LET(y,2,x+y)+x)");
    expect(result.value).toBe(4); // (1+2) + 1
  });

  test("rejects a coord-shaped bound name (Excel-compatible; keeps ref-rewrite coord-only invariant)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(A1,1,A1+1)");
    expect(result.type.charAt(0)).toBe("e");
  });

  test("rejects wrong (even) argument count", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(x,1)");
    expect(result.type.charAt(0)).toBe("e");
  });

  test("propagates an error from a value expression without evaluating later values", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(x,1/0,y,x+1,y)");
    expect(result.type).toBe("e#DIV/0!");
  });

  test("unbalanced LET call (missing close paren) surfaces the normal parser error", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(x,1,x");
    expect(result.type).toBe("e#VALUE!");
    expect(result.error).toContain("Missing close parenthesis");
  });

  test("2-arg scoped IF with a false condition and no else falls through to 0 (blank)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(y,1,IF(FALSE,5))");
    expect(result.type).toBe("n");
    expect(result.value).toBe(0);
  });
});

describe("LAMBDA", () => {
  test("immediate invocation: LAMBDA(x,x+1)(5)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LAMBDA(x,x+1)(5)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(6);
  });

  test("multi-parameter immediate invocation", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LAMBDA(x,y,x*y+1)(3,4)");
    expect(result.value).toBe(13);
  });

  test("a LAMBDA immediately followed by another call is not mistaken for invocation (LAMBDA(...)+SUM(...))", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 10", "set A2 value n 20"]);
    await recalcSheet(SC, sheet);
    // The LAMBDA itself is never invoked here -- it's just added to SUM(...)
    // as a bare closure, which must fail closed (#VALUE!), not silently
    // treat the following "(" of SUM's call as an invocation of the lambda.
    const result = await evalFormula(SC, sheet, "LAMBDA(x,x+1)(5)+SUM(A1:A2)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(36); // 6 + 30
  });

  test("bare (uninvoked) LAMBDA is an error when it is the whole cell value", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // The demotion happens at the cell-recalc write site (a bare LAMBDA is
    // a perfectly valid *intermediate* result -- e.g. LookupName resolving
    // a name defined as `=LAMBDA(...)` -- so evaluate_parsed_formula itself
    // must not collapse it; only "this is the final value written into a
    // cell" does).
    await scheduleCommands(SC, sheet, ["set A1 formula LAMBDA(x,x+1)"]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells["A1"].valuetype.charAt(0)).toBe("e");
  });

  test("closes over an enclosing LET binding", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(k,10,LAMBDA(x,x+k)(5))");
    expect(result.value).toBe(15);
  });

  test("calls a LET-bound lambda through its bound name", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(f,LAMBDA(x,x*x),f(4))");
    expect(result.value).toBe(16);
  });

  test("calls a LET-bound lambda through its bound name inside a larger expression", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(add,LAMBDA(a,b,a+b),add(2,3)+add(10,20))");
    expect(result.value).toBe(35);
  });

  test("rejects arity mismatch (too few / too many args)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const tooFew = await evalFormula(SC, sheet, "LAMBDA(x,y,x+y)(1)");
    expect(tooFew.type.charAt(0)).toBe("e");
    const tooMany = await evalFormula(SC, sheet, "LAMBDA(x,x+1)(1,2)");
    expect(tooMany.type.charAt(0)).toBe("e");
  });

  test("rejects a coord-shaped parameter name", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LAMBDA(A1,A1+1)(5)");
    expect(result.type.charAt(0)).toBe("e");
  });

  test("rejects a malformed parameter span with two bare tokens and no separator", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LAMBDA(x y,x)(1)");
    expect(result.type.charAt(0)).toBe("e");
  });

  test("rejects LAMBDA() with no arguments at all (missing body)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LAMBDA()");
    expect(result.type).toBe("e#VALUE!");
  });

  test("rejects LAMBDA(x,) -- a trailing comma is a tokenize-level error, not a resolveLambdaSpan case", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LAMBDA(x,)");
    expect(result.type).toBe("e#VALUE!");
  });

  test("rejects a scoped IF with the wrong argument count (recursive-body context)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const tooFew = await evalFormula(SC, sheet, "LET(y,1,IF(y))");
    expect(tooFew.type).toBe("e#VALUE!");
    const tooMany = await evalFormula(SC, sheet, "LET(y,1,IF(y,1,2,3))");
    expect(tooMany.type).toBe("e#VALUE!");
  });

  test("comparing/coercing a bare lambda value fails closed instead of throwing", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(f,LAMBDA(x,x),f=f)");
    expect(result.type.charAt(0)).toBe("e");
  });

  test("numeric coercion of a bare lambda value fails closed instead of NaN-ing the closure object", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "LET(f,LAMBDA(x,x),f%)");
    expect(result.type).toBe("e#VALUE!");
  });

  test("text coercion of a bare lambda value fails closed instead of stringifying the closure object", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, 'LET(f,LAMBDA(x,x),f&"a")');
    expect(result.type).toBe("e#VALUE!");
  });

  test("named lambda: callable via the Name Manager as MYFUNC(args)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.names["DOUBLE"] = { desc: "", definition: "=LAMBDA(x,x*2)" };
    const result = await evalFormula(SC, sheet, "DOUBLE(21)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(42);
  });

  test("named recursive lambda: factorial via self-reference by name", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.names["FACT"] = {
      desc: "",
      definition: "=LAMBDA(n,IF(n<=1,1,n*FACT(n-1)))",
    };
    const result = await evalFormula(SC, sheet, "FACT(6)");
    expect(result.type).toBe("n");
    expect(result.value).toBe(720);
  });

  test("mutual recursion between two named lambdas (even/odd)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.names["ISEVEN"] = {
      desc: "",
      definition: "=LAMBDA(n,IF(n=0,1,ISODD(n-1)))",
    };
    sheet.names["ISODD"] = {
      desc: "",
      definition: "=LAMBDA(n,IF(n=0,0,ISEVEN(n-1)))",
    };
    const result = await evalFormula(SC, sheet, "ISEVEN(10)");
    expect(result.value).toBe(1);
  });

  test("runaway recursion is caught by the bounded recursion guard, not a JS stack overflow", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.names["LOOP"] = { desc: "", definition: "=LAMBDA(n,LOOP(n+1))" };
    const result = await evalFormula(SC, sheet, "LOOP(0)");
    expect(result.type).toBe("e#NUM!");
  });

  test("calling an undefined name as a function is #VALUE!/incorrect-args, not #NAME?", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "NOSUCHFUNC(1)");
    expect(result.type.charAt(0)).toBe("e");
  });

  test("calling a non-lambda name as a function is an error", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.names["PLAINVAL"] = { desc: "", definition: "5" };
    const result = await evalFormula(SC, sheet, "PLAINVAL(1)");
    expect(result.type.charAt(0)).toBe("e");
  });
});

describe("MAP/REDUCE/SCAN/BYROW/BYCOL/MAKEARRAY", () => {
  test("MAP applies a lambda element-wise over a range, preserving shape", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2", "set A3 value n 3"]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "MAP(A1:A3,LAMBDA(x,x*10))");
    expect(result.type).toBe("array");
    const cells = result.value.cells as Array<Array<{ value: unknown }>>;
    expect(cells.map((r) => r[0]!.value)).toEqual([10, 20, 30]);
  });

  test("MAP over two arrays passes corresponding elements as separate lambda params", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set A2 value n 2",
      "set B1 value n 10",
      "set B2 value n 20",
    ]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "MAP(A1:A2,B1:B2,LAMBDA(x,y,x+y))");
    const cells = result.value.cells as Array<Array<{ value: unknown }>>;
    expect(cells.map((r) => r[0]!.value)).toEqual([11, 22]);
  });

  test("REDUCE folds a lambda across a range starting from an initial value", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set A2 value n 2",
      "set A3 value n 3",
      "set A4 value n 4",
    ]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "REDUCE(0,A1:A4,LAMBDA(acc,x,acc+x))");
    expect(result.type).toBe("n");
    expect(result.value).toBe(10);
  });

  test("REDUCE rejects a lambda whose parameter count is not exactly 2", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "REDUCE(0,A1:A2,LAMBDA(x,x))");
    expect(result.type).toBe("e#VALUE!");
  });

  test("SCAN returns the running-accumulator array, same shape as the source", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2", "set A3 value n 3"]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "SCAN(0,A1:A3,LAMBDA(acc,x,acc+x))");
    const cells = result.value.cells as Array<Array<{ value: unknown }>>;
    expect(cells.map((r) => r[0]!.value)).toEqual([1, 3, 6]);
  });

  test("BYROW reduces each row to one value, producing a column vector", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set B1 value n 2",
      "set A2 value n 3",
      "set B2 value n 4",
    ]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "BYROW(A1:B2,LAMBDA(r,SUM(r)))");
    expect(result.value.rows).toBe(2);
    expect(result.value.cols).toBe(1);
    const cells = result.value.cells as Array<Array<{ value: unknown }>>;
    expect(cells.map((r) => r[0]!.value)).toEqual([3, 7]);
  });

  test("BYCOL reduces each column to one value, producing a row vector", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set B1 value n 2",
      "set A2 value n 3",
      "set B2 value n 4",
    ]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "BYCOL(A1:B2,LAMBDA(c,SUM(c)))");
    expect(result.value.rows).toBe(1);
    expect(result.value.cols).toBe(2);
    const cells = result.value.cells as Array<Array<{ value: unknown }>>;
    expect(cells[0]!.map((c) => c.value)).toEqual([4, 6]);
  });

  test("MAKEARRAY constructs a rows x cols array from a (row,col) lambda", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const result = await evalFormula(SC, sheet, "MAKEARRAY(2,3,LAMBDA(r,c,r*10+c))");
    expect(result.value.rows).toBe(2);
    expect(result.value.cols).toBe(3);
    const cells = result.value.cells as Array<Array<{ value: unknown }>>;
    expect(cells).toEqual([
      [
        { type: "n", value: 11 },
        { type: "n", value: 12 },
        { type: "n", value: 13 },
      ],
      [
        { type: "n", value: 21 },
        { type: "n", value: 22 },
        { type: "n", value: 23 },
      ],
    ]);
  });

  test("MAP propagates a per-element error instead of throwing", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 0"]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "MAP(A1:A2,LAMBDA(x,1/x))");
    const cells = result.value.cells as Array<Array<{ type: string; value: unknown }>>;
    expect(cells[0]![0]!.type).toBe("n");
    expect(cells[1]![0]!.type).toBe("e#DIV/0!");
  });

  test("MAP rejects a lambda whose parameter count does not match the array count", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "MAP(A1:A1,LAMBDA(x,y,x+y))");
    expect(result.type.charAt(0)).toBe("e");
  });

  test("REDUCE stops early and propagates an error from a mid-fold step", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 0", "set A3 value n 5"]);
    await recalcSheet(SC, sheet);
    const result = await evalFormula(SC, sheet, "REDUCE(0,A1:A3,LAMBDA(acc,x,acc+1/x))");
    expect(result.type).toBe("e#DIV/0!");
  });

  test("MAKEARRAY rejects a non-integer or non-positive row/col count", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const nonInteger = await evalFormula(SC, sheet, "MAKEARRAY(1.5,2,LAMBDA(r,c,r+c))");
    expect(nonInteger.type.charAt(0)).toBe("e");
    const nonPositive = await evalFormula(SC, sheet, "MAKEARRAY(0,2,LAMBDA(r,c,r+c))");
    expect(nonPositive.type.charAt(0)).toBe("e");
  });

  test("an unrecognized name dispatched through the lambda-array function family is an error, not a crash", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const operand: Array<{ type: string; value: unknown }> = [];
    SC.Formula.LambdaArrayFunctions("NOTAREALFUNCTION", operand, [], sheet);
    expect(operand[0]!.type.charAt(0)).toBe("e");
  });

  test("MAP result spills into the sheet through the existing spill pipeline", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      "set A2 value n 2",
      "set A3 value n 3",
      "set B1 formula MAP(A1:A3,LAMBDA(x,x*100))",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells["B1"].datavalue).toBe(100);
    expect(sheet.cells["B2"].datavalue).toBe(200);
    expect(sheet.cells["B3"].datavalue).toBe(300);
  });
});

describe("formula-ref rewriting safety for LET/LAMBDA parameter names", () => {
  test("copying a LET formula shifts real cell refs but never touches the bound parameter name", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      "set B1 formula LET(total,A1*2,total+1)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells["B1"].datavalue).toBe(11);

    await scheduleCommands(SC, sheet, ["copy B1 formulas", "paste C1 formulas"]);
    await recalcSheet(SC, sheet);
    // A1 -> B1 shifted by the copy; "total" stays a bound name, unaffected.
    expect(sheet.cells["C1"].formula).toBe("LET(TOTAL,B1*2,TOTAL+1)");
  });

  test("copying a LAMBDA-invocation formula offsets the referenced range, not the lambda parameter", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 3",
      "set B1 value n 4",
      "set A2 formula LAMBDA(x,x*x)(A1)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells["A2"].datavalue).toBe(9);

    // copy/paste offsets relative coord refs by the paste delta (A1->B1,
    // one column over). The lambda parameter x/X is never touched --
    // it never tokenizes as tokentype.coord (see formula1.ts's
    // isValidLambdaParamName coord-shaped-name rejection), so
    // OffsetFormulaCoords' coord-only rewrite can't reach it even though
    // it shares a formula string with a real coord reference.
    await scheduleCommands(SC, sheet, ["copy A2 formulas", "paste B2 formulas"]);
    await recalcSheet(SC, sheet);
    // Every identifier (including LAMBDA's own parameter name) is
    // uppercased on reparse -- established SocialCalc tokenizer behavior,
    // not LAMBDA-specific (matches how SUM/IF always normalize to
    // uppercase).
    expect(sheet.cells["B2"].formula).toBe("LAMBDA(X,X*X)(B1)");
    expect(sheet.cells["B2"].datavalue).toBe(16);
  });
});

describe("function help/declarations", () => {
  test("MAP/REDUCE/SCAN/BYROW/BYCOL/MAKEARRAY have argument-string and description help text", async () => {
    const SC = await loadSocialCalc();
    SC.Formula.FillFunctionInfo();
    const expectedArgs: Record<string, string> = {
      MAP: "array1, [array2, ...], lambda",
      REDUCE: "initial_value, array, lambda",
      SCAN: "initial_value, array, lambda",
      BYROW: "array, lambda",
      BYCOL: "array, lambda",
      MAKEARRAY: "rows, cols, lambda",
    };
    for (const [fname, expectedArgstr] of Object.entries(expectedArgs)) {
      expect(SC.Formula.FunctionArgString(fname)).toBe(expectedArgstr);
      const def: string = SC.Formula.FunctionList[fname][3];
      expect(typeof def).toBe("string");
      expect(def.length).toBeGreaterThan(0);
    }
  });
});
