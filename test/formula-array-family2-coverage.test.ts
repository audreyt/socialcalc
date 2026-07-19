import { expect, test } from "vite-plus/test";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

test("VSTACK: exceeding the spill cell budget is #NUM!", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  // Two tall single-column arrays, each within SPILL_MAX_ROW but together
  // exceeding SPILL_MAX_CELLS, exercise HSTACK/VSTACK's own WithinSpillBudget
  // guard directly (a formula call can't reach it: DecodeRangeParts already
  // caps a single range at SPILL_MAX_ROW/SPILL_MAX_COL, so only a
  // multi-array VSTACK/HSTACK combination can accumulate past the shared
  // cell budget).
  const rows = Math.floor((SC.Formula.SPILL_MAX_CELLS as number) / 2) + 1;
  const tall = {
    rows,
    cols: 1,
    cells: Array.from({ length: rows }, () => [{ type: "n", value: 1 }]),
  };
  const rawOperand: any[] = [
    { type: "start", value: "" },
    { type: "array", value: tall },
    { type: "array", value: tall },
  ];
  const foperand: any[] = [];
  SC.Formula.CopyFunctionArgs(rawOperand, foperand);
  const result: any[] = [];
  SC.Formula.ArrayShapeFunctions("VSTACK", result, foperand, sheet);
  expect(result[0].type).toBe("e#NUM!");
});

test("ArrayShapeFunctions: an unregistered fname falls through to the defensive #VALUE! guard", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const array = { rows: 1, cols: 1, cells: [[{ type: "n", value: 1 }]] };
  const rawOperand: any[] = [
    { type: "start", value: "" },
    { type: "array", value: array },
  ];
  const foperand: any[] = [];
  SC.Formula.CopyFunctionArgs(rawOperand, foperand);
  const result: any[] = [];
  // ArrayShapeFunctions is only ever invoked via the registered FunctionList
  // entries, all of which are handled by name; this direct call exercises
  // the otherwise-unreachable final fallback kept for defense in depth.
  SC.Formula.ArrayShapeFunctions("NOTAREALFUNCTION", result, foperand, sheet);
  expect(result[0].type).toBe("e#VALUE!");
});

test("WRAPROWS: exceeding the spill cell budget is #NUM!", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const long = (SC.Formula.SPILL_MAX_CELLS as number) + 1;
  const vector = {
    rows: 1,
    cols: long,
    cells: [Array.from({ length: long }, () => ({ type: "n", value: 1 }))],
  };
  const rawOperand: any[] = [
    { type: "start", value: "" },
    { type: "array", value: vector },
    { type: "n", value: 1 },
  ];
  const foperand: any[] = [];
  SC.Formula.CopyFunctionArgs(rawOperand, foperand);
  const result: any[] = [];
  SC.Formula.ArrayShapeFunctions("WRAPROWS", result, foperand, sheet);
  expect(result[0].type).toBe("e#NUM!");
});

test("EXPAND: more than 3 arguments (array, rows, columns, pad_with) is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate('EXPAND(A1:A1,2,2,"x",1)').type).toBe("e#VALUE!");
});

test("WRAPROWS: too many arguments (vector, wrap_count, pad_with, extra) is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate('WRAPROWS(A1:B1,2,"x",1)').type).toBe("e#VALUE!");
});

test("WRAPROWS: a column-vector source reads top-to-bottom", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    ["set A1 value n 1", "set A2 value n 2", "set A3 value n 3"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const r: any = evaluate("WRAPROWS(A1:A3,2)");
  expect(r.type).toBe("array");
  expect(r.value.cells.map((row: any[]) => row.map((c: any) => c.value))).toEqual([
    [1, 2],
    [3, 0],
  ]);
});

test("TOCOL: more than 2 arguments (array, ignore, scan_by_column, extra) is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("TOCOL(A1:B1,0,1,1)").type).toBe("e#VALUE!");
});

test("TOCOL: non-numeric scan_by_column is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate('TOCOL(A1:B1,0,"x")').type).toBe("e#VALUE!");
});

test("TAKE: non-integer columns argument is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("TAKE(A1:B1,1,1.5)").type).toBe("e#VALUE!");
});

test("DROP: dropping every column (rows kept) is #CALC!", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("DROP(A1:B1,0,2)").type).toBe("e#CALC!");
});

test("TAKE: more than 2 arguments (array, rows, columns, extra) is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("TAKE(A1:B1,1,1,1)").type).toBe("e#VALUE!");
});

test("TAKE: non-integer rows argument is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("TAKE(A1:B1,1.5)").type).toBe("e#VALUE!");
});

test("SORTBY: equal keys preserve source order via the stable tie-break", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 value n 1",
      "set A2 value n 2",
      "set A3 value n 3",
      "set E1 value n 5",
      "set E2 value n 5",
      "set E3 value n 5",
    ],
    true,
    4000,
  );
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const r: any = evaluate("SORTBY(A1:A3,E1:E3)");
  expect(r.type).toBe("array");
  expect(r.value.cells.map((row: any[]) => row[0].value)).toEqual([1, 2, 3]);
});

test("CHOOSECOLS: no column selectors after the array is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const rawOperand: any[] = [
    { type: "start", value: "" },
    { type: "array", value: { rows: 1, cols: 1, cells: [[{ type: "n", value: 1 }]] } },
  ];
  const foperand: any[] = [];
  SC.Formula.CopyFunctionArgs(rawOperand, foperand);
  const result: any[] = [];
  SC.Formula.ArrayShapeFunctions("CHOOSECOLS", result, foperand, sheet);
  expect(result[0].type).toBe("e#VALUE!");
});

test("SORTBY: no by_array after the array is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const rawOperand: any[] = [
    { type: "start", value: "" },
    { type: "array", value: { rows: 1, cols: 1, cells: [[{ type: "n", value: 1 }]] } },
  ];
  const foperand: any[] = [];
  SC.Formula.CopyFunctionArgs(rawOperand, foperand);
  const result: any[] = [];
  SC.Formula.ArrayShapeFunctions("SORTBY", result, foperand, sheet);
  expect(result[0].type).toBe("e#VALUE!");
});

test("SORTBY: a by_array operand that cannot materialize is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  // A scalar "n" operand is neither "array", "coord", nor "range", so
  // MaterializeArray returns null even though orderArg parses fine --
  // exercises the "materialize failed" branch distinctly from the
  // shape-mismatch branch below it.
  const rawOperand: any[] = [
    { type: "start", value: "" },
    { type: "array", value: { rows: 1, cols: 1, cells: [[{ type: "n", value: 1 }]] } },
    { type: "n", value: 5 },
  ];
  const foperand: any[] = [];
  SC.Formula.CopyFunctionArgs(rawOperand, foperand);
  const result: any[] = [];
  SC.Formula.ArrayShapeFunctions("SORTBY", result, foperand, sheet);
  expect(result[0].type).toBe("e#VALUE!");
});

test("TRANSPOSE: a non-materializable scalar source is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("TRANSPOSE(5)").type).toBe("e#VALUE!");
});

test("FILTER: a non-materializable scalar include is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"], true, 4000);
  await recalcSheet(SC, sheet);
  const rawOperand: any[] = [
    { type: "start", value: "" },
    { type: "range", value: "A1|A2|0" },
    { type: "n", value: 1 },
  ];
  const foperand: any[] = [];
  SC.Formula.CopyFunctionArgs(rawOperand, foperand);
  const result: any[] = [];
  SC.Formula.ArrayShapeFunctions("FILTER", result, foperand, sheet);
  expect(result[0].type).toBe("e#VALUE!");
});

test("SEQUENCE: non-numeric start is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate('SEQUENCE(2,1,"x")').type).toBe("e#VALUE!");
});

test("SEQUENCE: non-numeric step is an error", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate('SEQUENCE(2,1,1,"x")').type).toBe("e#VALUE!");
});

test("SEQUENCE: NaN rows is an error (readInt non-finite branch)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("SEQUENCE(NaN)").type).toBe("e#VALUE!");
});

test("TAKE: NaN rows is an error (readInt non-finite branch)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  expect(evaluate("TAKE(SEQUENCE(2,1),NaN)").type).toBe("e#VALUE!");
});

test("FILTER: if_empty as a cell reference resolves through MaterializeArray", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    ["set A1 value n 1", "set D1 value n 0", "set F1 text t fallback"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const r: any = evaluate("FILTER(A1:A1,D1:D1,F1)");
  expect(r.type).toBe("array");
  expect(r.value.cells[0][0].value).toBe("fallback");
});
