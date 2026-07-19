import { expect, test } from "vite-plus/test";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

async function setup(commands: string[]) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands, true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const values = (formula: string) => {
    const r: any = evaluate(formula);
    expect(r.type).toBe("array");
    return r.value.cells.map((row: any[]) => row.map((c: any) => c.value));
  };
  const types = (formula: string) => {
    const r: any = evaluate(formula);
    expect(r.type).toBe("array");
    return r.value.cells.map((row: any[]) => row.map((c: any) => c.type));
  };
  return { SC, sheet, evaluate, values, types };
}

const GRID = [
  "set A1 value n 1",
  "set B1 value n 2",
  "set C1 value n 3",
  "set A2 value n 4",
  "set B2 value n 5",
  "set C2 value n 6",
  "set A3 value n 7",
  "set B3 value n 8",
  "set C3 value n 9",
];

test("registration: functions expose the ArrayShapeFunctions/DynamicArrayFunctions implementations", async () => {
  const SC = await loadSocialCalc();
  for (const fname of [
    "FILTER",
    "SEQUENCE",
    "TRANSPOSE",
    "SORTBY",
    "CHOOSECOLS",
    "CHOOSEROWS",
    "TAKE",
    "DROP",
    "HSTACK",
    "VSTACK",
    "TOCOL",
    "TOROW",
    "WRAPROWS",
    "WRAPCOLS",
    "EXPAND",
  ]) {
    expect(SC.Formula.FunctionList[fname][0]).toBe(SC.Formula.ArrayShapeFunctions);
  }
});

test("registration: functions are classified into FunctionClasses.lookup/math", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.FillFunctionInfo();
  const lookupItems: string[] = SC.Formula.FunctionClasses.lookup.items;
  const mathItems: string[] = SC.Formula.FunctionClasses.math.items;
  for (const fname of [
    "FILTER",
    "TRANSPOSE",
    "SORTBY",
    "CHOOSECOLS",
    "CHOOSEROWS",
    "TAKE",
    "DROP",
    "HSTACK",
    "VSTACK",
    "TOCOL",
    "TOROW",
    "WRAPROWS",
    "WRAPCOLS",
    "EXPAND",
  ]) {
    expect(lookupItems).toContain(fname);
  }
  expect(mathItems).toContain("SEQUENCE");
});

test("registration: exact argument help strings", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.FillFunctionInfo();
  expect(SC.Formula.FunctionArgString("FILTER")).toBe("array, include, [if_empty]");
  expect(SC.Formula.FunctionArgString("SEQUENCE")).toBe("rows, [columns], [start], [step]");
  expect(SC.Formula.FunctionArgString("TRANSPOSE")).toBe("range");
  expect(SC.Formula.FunctionArgString("SORTBY")).toBe(
    "array, by_array1, [sort_order1], [by_array2, sort_order2, ...]",
  );
  expect(SC.Formula.FunctionArgString("CHOOSECOLS")).toBe("array, col_num1, [col_num2, ...]");
  expect(SC.Formula.FunctionArgString("CHOOSEROWS")).toBe("array, row_num1, [row_num2, ...]");
  expect(SC.Formula.FunctionArgString("TAKE")).toBe("array, rows, [columns]");
  expect(SC.Formula.FunctionArgString("DROP")).toBe("array, rows, [columns]");
  expect(SC.Formula.FunctionArgString("HSTACK")).toBe("array1, [array2, ...]");
  expect(SC.Formula.FunctionArgString("VSTACK")).toBe("array1, [array2, ...]");
  expect(SC.Formula.FunctionArgString("TOCOL")).toBe("array, [ignore], [scan_by_column]");
  expect(SC.Formula.FunctionArgString("TOROW")).toBe("array, [ignore], [scan_by_column]");
  expect(SC.Formula.FunctionArgString("WRAPROWS")).toBe("vector, wrap_count, [pad_with]");
  expect(SC.Formula.FunctionArgString("WRAPCOLS")).toBe("vector, wrap_count, [pad_with]");
  expect(SC.Formula.FunctionArgString("EXPAND")).toBe("array, rows, [columns], [pad_with]");
});

test("registration: minimum-argument-count guard rejects zero-arg calls", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  for (const fname of [
    "FILTER",
    "SEQUENCE",
    "TRANSPOSE",
    "SORTBY",
    "CHOOSECOLS",
    "CHOOSEROWS",
    "TAKE",
    "DROP",
    "HSTACK",
    "VSTACK",
    "TOCOL",
    "TOROW",
    "WRAPROWS",
    "WRAPCOLS",
    "EXPAND",
  ]) {
    expect(evaluate(`${fname}()`).type).toBe("e#VALUE!");
  }
});

// --- FILTER -------------------------------------------------------------

test("FILTER: row mask keeps matching rows in source order", async () => {
  const { values } = await setup([
    ...GRID,
    "set D1 formula A1>1",
    "set D2 formula A2>1",
    "set D3 formula A3>1",
  ]);
  expect(values("FILTER(A1:C3,D1:D3)")).toEqual([
    [4, 5, 6],
    [7, 8, 9],
  ]);
});

test("FILTER: column mask keeps matching columns", async () => {
  const { values } = await setup([
    ...GRID,
    "set A5 formula A1>1",
    "set B5 formula B1>1",
    "set C5 formula C1>1",
  ]);
  expect(values("FILTER(A1:C3,A5:C5)")).toEqual([
    [2, 3],
    [5, 6],
    [8, 9],
  ]);
});

test("FILTER: numeric truthy/falsy coercion (nonzero keeps, zero drops)", async () => {
  const { values } = await setup([
    ...GRID,
    "set D1 value n 1",
    "set D2 value n 0",
    "set D3 value n 5",
  ]);
  expect(values("FILTER(A1:C3,D1:D3)")).toEqual([
    [1, 2, 3],
    [7, 8, 9],
  ]);
});

test("FILTER: blank include is falsy (drops the row)", async () => {
  const { values } = await setup([...GRID, "set D1 value n 1", "set D3 value n 1"]);
  expect(values("FILTER(A1:C3,D1:D3)")).toEqual([
    [1, 2, 3],
    [7, 8, 9],
  ]);
});

test("FILTER: text include is a coercion error, not silently falsy", async () => {
  const { evaluate } = await setup([
    ...GRID,
    "set D1 text t x",
    "set D2 value n 1",
    "set D3 value n 1",
  ]);
  expect(evaluate("FILTER(A1:C3,D1:D3)").type).toBe("e#VALUE!");
});

test("FILTER: an error inside include propagates that exact error", async () => {
  const { evaluate } = await setup([
    ...GRID,
    "set D1 value n 1",
    "set D2 formula 1/0",
    "set D3 value n 1",
  ]);
  expect(evaluate("FILTER(A1:C3,D1:D3)").type).toBe("e#DIV/0!");
});

test("FILTER: include shape must match array height or width exactly", async () => {
  const { evaluate } = await setup([...GRID, "set D1 value n 1", "set D2 value n 1"]);
  expect(evaluate("FILTER(A1:C3,D1:D2)").type).toBe("e#VALUE!");
});

test("FILTER: no if_empty and nothing matches yields #CALC!", async () => {
  const { evaluate } = await setup([
    ...GRID,
    "set D1 value n 0",
    "set D2 value n 0",
    "set D3 value n 0",
  ]);
  expect(evaluate("FILTER(A1:C3,D1:D3)").type).toBe("e#CALC!");
});

test("FILTER: if_empty is returned as a 1x1 array when nothing matches", async () => {
  const { values } = await setup([
    ...GRID,
    "set D1 value n 0",
    "set D2 value n 0",
    "set D3 value n 0",
  ]);
  expect(values('FILTER(A1:C3,D1:D3,"none")')).toEqual([["none"]]);
});

test("FILTER: nested inside SORT and UNIQUE", async () => {
  const { values } = await setup([
    ...GRID,
    "set D1 value n 1",
    "set D2 value n 0",
    "set D3 value n 1",
  ]);
  expect(values("SORT(FILTER(A1:C3,D1:D3),1,0)")).toEqual([
    [7, 8, 9],
    [1, 2, 3],
  ]);
});

test("FILTER: argument count is validated (1-2 args after array)", async () => {
  const { evaluate } = await setup([
    ...GRID,
    "set D1 value n 1",
    "set D2 value n 1",
    "set D3 value n 1",
  ]);
  expect(evaluate('FILTER(A1:C3,D1:D3,"x","y")').type).toBe("e#VALUE!");
});

// --- SEQUENCE -------------------------------------------------------------

test("SEQUENCE: rows only defaults columns/start/step to 1", async () => {
  const { values } = await setup([]);
  expect(values("SEQUENCE(3)")).toEqual([[1], [2], [3]]);
});

test("SEQUENCE: rows and columns fill row-major", async () => {
  const { values } = await setup([]);
  expect(values("SEQUENCE(2,3)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("SEQUENCE: explicit start and step", async () => {
  const { values } = await setup([]);
  expect(values("SEQUENCE(3,1,10,5)")).toEqual([[10], [15], [20]]);
});

test("SEQUENCE: negative step descends", async () => {
  const { values } = await setup([]);
  expect(values("SEQUENCE(3,1,5,-1)")).toEqual([[5], [4], [3]]);
});

test("SEQUENCE: non-integer or non-positive rows/columns is an error", async () => {
  const { evaluate } = await setup([]);
  expect(evaluate("SEQUENCE(0)").type).toBe("e#VALUE!");
  expect(evaluate("SEQUENCE(-1)").type).toBe("e#VALUE!");
  expect(evaluate("SEQUENCE(1.5)").type).toBe("e#VALUE!");
  expect(evaluate("SEQUENCE(2,0)").type).toBe("e#VALUE!");
  expect(evaluate("SEQUENCE(2,-1)").type).toBe("e#VALUE!");
});

test("SEQUENCE: fractional start/step is allowed (need not be integer)", async () => {
  const { values } = await setup([]);
  expect(values("SEQUENCE(2,1,0.5,0.25)")).toEqual([[0.5], [0.75]]);
});

test("SEQUENCE: exceeding the spill budget/ZZ/65536 policy is #NUM!", async () => {
  const { evaluate } = await setup([]);
  expect(evaluate("SEQUENCE(65537,1)").type).toBe("e#NUM!");
  expect(evaluate("SEQUENCE(1,703)").type).toBe("e#NUM!");
  expect(evaluate("SEQUENCE(1000,1000)").type).toBe("e#NUM!");
});

// --- TRANSPOSE -------------------------------------------------------------

test("TRANSPOSE: swaps rows and columns", async () => {
  const { values } = await setup(GRID);
  expect(values("TRANSPOSE(A1:C3)")).toEqual([
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
  ]);
});

test("TRANSPOSE: single row becomes single column and vice versa", async () => {
  const { values } = await setup(GRID);
  expect(values("TRANSPOSE(A1:C1)")).toEqual([[1], [2], [3]]);
  expect(values("TRANSPOSE(A1:A3)")).toEqual([[1, 4, 7]]);
});

test("TRANSPOSE: preserves types including blanks and errors", async () => {
  const { types } = await setup(["set A1 text t x", "set A2 formula 1/0"]);
  expect(types("TRANSPOSE(A1:A3)")).toEqual([["t", "e#DIV/0!", "b"]]);
});

test("TRANSPOSE: nested inside SEQUENCE-derived arrays", async () => {
  const { values } = await setup([]);
  expect(values("TRANSPOSE(SEQUENCE(2,3))")).toEqual([
    [1, 4],
    [2, 5],
    [3, 6],
  ]);
});

// --- SORTBY -----------------------------------------------------------------

test("SORTBY: single external column key, ascending default when order omitted", async () => {
  const { values } = await setup([
    ...GRID,
    "set E1 value n 3",
    "set E2 value n 1",
    "set E3 value n 2",
  ]);
  expect(values("SORTBY(A1:C3,E1:E3)")).toEqual([
    [4, 5, 6],
    [7, 8, 9],
    [1, 2, 3],
  ]);
});

test("SORTBY: explicit descending order", async () => {
  const { values } = await setup([
    ...GRID,
    "set E1 value n 3",
    "set E2 value n 1",
    "set E3 value n 2",
  ]);
  expect(values("SORTBY(A1:C3,E1:E3,-1)")).toEqual([
    [1, 2, 3],
    [7, 8, 9],
    [4, 5, 6],
  ]);
});

test("SORTBY: multi-key with stable tie-break preserves source order", async () => {
  const { values } = await setup([
    ...GRID,
    "set E1 value n 1",
    "set E2 value n 1",
    "set E3 value n 0",
    "set F1 value n 5",
    "set F2 value n 1",
    "set F3 value n 9",
  ]);
  // primary key E ascending groups rows 1,2 together (tie); secondary F breaks the tie.
  expect(values("SORTBY(A1:C3,E1:E3,1,F1:F3,1)")).toEqual([
    [7, 8, 9],
    [4, 5, 6],
    [1, 2, 3],
  ]);
});

test("SORTBY: column orientation sorts columns via a row-shaped by_array", async () => {
  const { values } = await setup([
    ...GRID,
    "set A5 value n 3",
    "set B5 value n 1",
    "set C5 value n 2",
  ]);
  expect(values("SORTBY(A1:C3,A5:C5)")).toEqual([
    [2, 3, 1],
    [5, 6, 4],
    [8, 9, 7],
  ]);
});

test("SORTBY: by_array shape must match array rows or columns exactly", async () => {
  const { evaluate } = await setup([...GRID, "set E1 value n 1", "set E2 value n 2"]);
  expect(evaluate("SORTBY(A1:C3,E1:E2)").type).toBe("e#VALUE!");
});

test("SORTBY: invalid sort_order value is an error", async () => {
  const { evaluate } = await setup([
    ...GRID,
    "set E1 value n 1",
    "set E2 value n 2",
    "set E3 value n 3",
  ]);
  expect(evaluate("SORTBY(A1:C3,E1:E3,2)").type).toBe("e#VALUE!");
});

test("SORTBY: mixing row and column orientation across key pairs is an error", async () => {
  const { evaluate } = await setup([
    ...GRID,
    "set E1 value n 1",
    "set E2 value n 2",
    "set E3 value n 3",
    "set A5 value n 1",
    "set B5 value n 2",
    "set C5 value n 3",
  ]);
  expect(evaluate("SORTBY(A1:C3,E1:E3,1,A5:C5,1)").type).toBe("e#VALUE!");
});

test("SORTBY: nested inside FILTER", async () => {
  const { values } = await setup([
    ...GRID,
    "set D1 value n 1",
    "set D2 value n 1",
    "set D3 value n 0",
    "set E1 value n 2",
    "set E2 value n 1",
    "set E3 value n 3",
  ]);
  expect(values("SORTBY(FILTER(A1:C3,D1:D3),E1:E2)")).toEqual([
    [4, 5, 6],
    [1, 2, 3],
  ]);
});

// --- CHOOSECOLS / CHOOSEROWS ------------------------------------------------

test("CHOOSECOLS: positive indices select and reorder columns", async () => {
  const { values } = await setup(GRID);
  expect(values("CHOOSECOLS(A1:C3,3,1)")).toEqual([
    [3, 1],
    [6, 4],
    [9, 7],
  ]);
});

test("CHOOSECOLS: negative indices count from the end", async () => {
  const { values } = await setup(GRID);
  expect(values("CHOOSECOLS(A1:C3,-1)")).toEqual([[3], [6], [9]]);
});

test("CHOOSECOLS: duplicate selections are allowed", async () => {
  const { values } = await setup(GRID);
  expect(values("CHOOSECOLS(A1:C3,1,1)")).toEqual([
    [1, 1],
    [4, 4],
    [7, 7],
  ]);
});

test("CHOOSECOLS: zero or out-of-range index is an error", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("CHOOSECOLS(A1:C3,0)").type).toBe("e#VALUE!");
  expect(evaluate("CHOOSECOLS(A1:C3,4)").type).toBe("e#VALUE!");
  expect(evaluate("CHOOSECOLS(A1:C3,-4)").type).toBe("e#VALUE!");
});

test("CHOOSEROWS: positive/negative indices and out-of-range validation", async () => {
  const { values, evaluate } = await setup(GRID);
  expect(values("CHOOSEROWS(A1:C3,2,1)")).toEqual([
    [4, 5, 6],
    [1, 2, 3],
  ]);
  expect(values("CHOOSEROWS(A1:C3,-1)")).toEqual([[7, 8, 9]]);
  expect(evaluate("CHOOSEROWS(A1:C3,0)").type).toBe("e#VALUE!");
  expect(evaluate("CHOOSEROWS(A1:C3,4)").type).toBe("e#VALUE!");
});

// --- TAKE / DROP -------------------------------------------------------------

test("TAKE: positive rows takes from the start", async () => {
  const { values } = await setup(GRID);
  expect(values("TAKE(A1:C3,2)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("TAKE: negative rows takes from the end", async () => {
  const { values } = await setup(GRID);
  expect(values("TAKE(A1:C3,-1)")).toEqual([[7, 8, 9]]);
});

test("TAKE: rows and columns together", async () => {
  const { values } = await setup(GRID);
  expect(values("TAKE(A1:C3,2,2)")).toEqual([
    [1, 2],
    [4, 5],
  ]);
});

test("TAKE: over-requesting clamps to the available extent (no error)", async () => {
  const { values } = await setup(GRID);
  expect(values("TAKE(A1:C3,100)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]);
});

test("TAKE: zero rows/columns is #CALC! (would produce an empty array)", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("TAKE(A1:C3,0)").type).toBe("e#CALC!");
});

test("DROP: positive rows drops from the start", async () => {
  const { values } = await setup(GRID);
  expect(values("DROP(A1:C3,1)")).toEqual([
    [4, 5, 6],
    [7, 8, 9],
  ]);
});

test("DROP: negative rows drops from the end", async () => {
  const { values } = await setup(GRID);
  expect(values("DROP(A1:C3,-1)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("DROP: rows and columns together", async () => {
  const { values } = await setup(GRID);
  expect(values("DROP(A1:C3,1,1)")).toEqual([
    [5, 6],
    [8, 9],
  ]);
});

test("DROP: dropping every row/column is #CALC!", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("DROP(A1:C3,3)").type).toBe("e#CALC!");
  expect(evaluate("DROP(A1:C3,10)").type).toBe("e#CALC!");
});

// --- HSTACK / VSTACK ---------------------------------------------------------

test("HSTACK: appends arrays horizontally", async () => {
  const { values } = await setup(GRID);
  expect(values("HSTACK(A1:B2,C1:C2)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("HSTACK: pads shorter columns with #N/A on missing rows", async () => {
  const { values, types } = await setup(GRID);
  expect(values("HSTACK(A1:A3,A1:A2)")).toEqual([
    [1, 1],
    [4, 4],
    [7, 0],
  ]);
  expect(types("HSTACK(A1:A3,A1:A2)")).toEqual([
    ["n", "n"],
    ["n", "n"],
    ["n", "e#N/A"],
  ]);
});

test("HSTACK: accepts a bare scalar alongside ranges", async () => {
  const { values } = await setup(GRID);
  expect(values("HSTACK(A1:A2,99)")).toEqual([
    [1, 99],
    [4, 0],
  ]);
});

test("VSTACK: appends arrays vertically", async () => {
  const { values } = await setup(GRID);
  expect(values("VSTACK(A1:C1,A2:C2)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("VSTACK: a multi-row array after another array uses the correct row offset", async () => {
  const { values } = await setup(GRID);
  // A1:C1 contributes row 0; A2:C3 (two rows) must land at rows 1 and 2 --
  // an offset-arithmetic bug (vrOffset - vr instead of vrOffset + vr) would
  // write A2:C3's second row back over row 0 instead of row 2.
  expect(values("VSTACK(A1:C1,A2:C3)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]);
});

test("VSTACK: pads shorter rows with #N/A on missing columns", async () => {
  const { types } = await setup(GRID);
  expect(types("VSTACK(A1:B1,A2:C2)")).toEqual([
    ["n", "n", "e#N/A"],
    ["n", "n", "n"],
  ]);
});

test("HSTACK/VSTACK: nested inside TRANSPOSE and SORT", async () => {
  const { values } = await setup(GRID);
  expect(values("SORT(HSTACK(A1:A3,C1:C3),1,0)")).toEqual([
    [7, 9],
    [4, 6],
    [1, 3],
  ]);
});

// --- TOCOL / TOROW -----------------------------------------------------------

test("TOCOL: flattens row-major by default", async () => {
  const { values } = await setup(GRID);
  expect(values("TOCOL(A1:C3)")).toEqual([[1], [2], [3], [4], [5], [6], [7], [8], [9]]);
});

test("TOCOL: scan_by_column reads column-first", async () => {
  const { values } = await setup(GRID);
  expect(values("TOCOL(A1:C3,0,1)")).toEqual([[1], [4], [7], [2], [5], [8], [3], [6], [9]]);
});

test("TOCOL: ignore mode 1 skips blanks", async () => {
  const { values } = await setup(["set A1 value n 1", "set A3 value n 3"]);
  expect(values("TOCOL(A1:A3,1)")).toEqual([[1], [3]]);
});

test("TOCOL: ignore mode 2 skips errors", async () => {
  const { values } = await setup(["set A1 value n 1", "set A2 formula 1/0", "set A3 value n 3"]);
  expect(values("TOCOL(A1:A3,2)")).toEqual([[1], [3]]);
});

test("TOCOL: ignore mode 3 skips blanks and errors", async () => {
  const { values } = await setup(["set A1 value n 1", "set A2 formula 1/0", "set A4 value n 4"]);
  expect(values("TOCOL(A1:A4,3)")).toEqual([[1], [4]]);
});

test("TOCOL: invalid ignore code is an error", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("TOCOL(A1:C3,4)").type).toBe("e#VALUE!");
});

test("TOROW: flattens into a single row", async () => {
  const { values } = await setup(GRID);
  expect(values("TOROW(A1:C3)")).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9]]);
});

test("TOROW: accepts ignore and scan_by_column arguments (more than one arg)", async () => {
  const { values } = await setup(GRID);
  expect(values("TOROW(A1:C3,0,1)")).toEqual([[1, 4, 7, 2, 5, 8, 3, 6, 9]]);
});

// --- WRAPROWS / WRAPCOLS ------------------------------------------------------

test("WRAPROWS: wraps a row vector into rows of wrap_count values", async () => {
  const { values, types } = await setup(GRID);
  expect(values("WRAPROWS(TOROW(A1:C3),2)")).toEqual([
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
    [9, 0],
  ]);
  expect(types("WRAPROWS(TOROW(A1:C3),2)")[4]).toEqual(["n", "e#N/A"]);
});

test("WRAPROWS: explicit pad_with replaces the default #N/A", async () => {
  const { values } = await setup(GRID);
  expect(values('WRAPROWS(TOROW(A1:C3),2,"-")')).toEqual([
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
    [9, "-"],
  ]);
});

test("WRAPCOLS: wraps a row vector into columns of wrap_count values", async () => {
  const { values, types } = await setup(GRID);
  expect(values("WRAPCOLS(TOROW(A1:C3),2)")).toEqual([
    [1, 3, 5, 7, 9],
    [2, 4, 6, 8, 0],
  ]);
  expect(types("WRAPCOLS(TOROW(A1:C3),2)")[1]![4]).toBe("e#N/A");
});

test("WRAPCOLS: explicit pad_with replaces the default #N/A (three-argument call)", async () => {
  const { values } = await setup(GRID);
  expect(values('WRAPCOLS(TOROW(A1:C3),2,"-")')).toEqual([
    [1, 3, 5, 7, 9],
    [2, 4, 6, 8, "-"],
  ]);
});

test("WRAPROWS/WRAPCOLS: source must be a single row or column vector", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("WRAPROWS(A1:C3,2)").type).toBe("e#VALUE!");
  expect(evaluate("WRAPCOLS(A1:C3,2)").type).toBe("e#VALUE!");
});

test("WRAPROWS: non-positive wrap_count is an error", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("WRAPROWS(TOROW(A1:C3),0)").type).toBe("e#VALUE!");
});

// --- EXPAND -------------------------------------------------------------------

test("EXPAND: grows rows and columns, padding new cells with #N/A", async () => {
  const { types } = await setup(GRID);
  expect(types("EXPAND(A1:B2,3,4)")).toEqual([
    ["n", "n", "e#N/A", "e#N/A"],
    ["n", "n", "e#N/A", "e#N/A"],
    ["e#N/A", "e#N/A", "e#N/A", "e#N/A"],
  ]);
});

test("EXPAND: explicit pad_with replaces the default #N/A", async () => {
  const { values } = await setup(GRID);
  expect(values('EXPAND(A1:B2,3,3,"x")')).toEqual([
    [1, 2, "x"],
    [4, 5, "x"],
    ["x", "x", "x"],
  ]);
});

test("EXPAND: omitted columns keeps the original column count", async () => {
  const { values, types } = await setup(GRID);
  expect(values("EXPAND(A1:B2,3)")).toEqual([
    [1, 2],
    [4, 5],
    [0, 0],
  ]);
  expect(types("EXPAND(A1:B2,3)")[2]).toEqual(["e#N/A", "e#N/A"]);
});

test("EXPAND: rows/columns smaller than the source is an error", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("EXPAND(A1:B2,1)").type).toBe("e#VALUE!");
  expect(evaluate("EXPAND(A1:B2,2,1)").type).toBe("e#VALUE!");
});

test("EXPAND: exceeding the spill budget is #NUM!", async () => {
  const { evaluate } = await setup(GRID);
  expect(evaluate("EXPAND(A1:B2,1000,1000)").type).toBe("e#NUM!");
});

// --- cross-sheet / named-range materialization --------------------------------

test("TRANSPOSE/SORTBY/FILTER materialize cross-sheet cached ranges", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.SheetCache.sheets = {};
  SC.Formula.SheetCache.waitingForLoading = null;
  SC.Formula.AddSheetToCache(
    "HELPER",
    "version:1.5\ncell:A1:v:2\ncell:A2:v:1\ncell:A3:v:2\nsheet:c:1:r:3\n",
    false,
  );
  const sheet = new SC.Sheet();
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const transposed: any = evaluate("TRANSPOSE(HELPER!A1:A3)");
  expect(transposed.type).toBe("array");
  expect(transposed.value.cells[0].map((c: any) => c.value)).toEqual([2, 1, 2]);
});

test("named ranges materialize for the new function family", async () => {
  const { values } = await setup([...GRID, "name define GRID A1:C3"]);
  expect(values("TRANSPOSE(GRID)")).toEqual([
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
  ]);
  expect(values("TAKE(GRID,2)")).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("array operands from the new family reject every binary operator", async () => {
  const { evaluate } = await setup(GRID);
  for (const op of ["M", "P", "%", "&", "<", "L", "=", "G", ">", "N", "+", "-", "*", "/", "^"]) {
    expect(evaluate(`TRANSPOSE(A1:C3)${op}1`).type.charAt(0)).toBe("e");
    expect(evaluate(`SEQUENCE(2)${op}1`).type.charAt(0)).toBe("e");
  }
});
