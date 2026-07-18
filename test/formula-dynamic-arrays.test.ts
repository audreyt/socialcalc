import { expect, test } from "vite-plus/test";
import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

test("spill policy helpers match the published numeric contract", async () => {
  const SC = await loadSocialCalc();
  const F = SC.Formula;
  expect(F.PlanSpillStatus(1, 1, 2, 3, F.SPILL_MAX_COL, F.SPILL_MAX_ROW, F.SPILL_MAX_CELLS)).toBe(
    0,
  );
  expect(F.PlanSpillStatus(1, 1, 0, 3, 702, 65536, 100)).toBe(1);
  expect(F.PlanSpillStatus(702, 1, 1, 2, 702, 65536, 100)).toBe(2);
  expect(F.PlanSpillStatus(1, 1, 100, 1001, 2000, 65536, 100000)).toBe(3);
  expect(F.ClassifySpillClaim(false, true, false, false, false, false)).toBe(1);
  expect(F.ClassifySpillClaim(false, true, false, true, false, false)).toBe(2);
  expect(F.ClassifyResizeMembership(true, true)).toBe(0);
  expect(F.ClassifyResizeMembership(false, true)).toBe(1);
  expect(F.KeepUniqueItem(0, 0, 2, false)).toBe(true);
  expect(F.KeepUniqueItem(0, 0, 2, true)).toBe(false);
  expect(F.StableTieCompare(0, 1, 2)).toBe(-1);
});

test("SORT and UNIQUE are registered", async () => {
  const SC = await loadSocialCalc();
  expect(SC.Formula.FunctionList.SORT[0]).toBe(SC.Formula.DynamicArrayFunctions);
  expect(SC.Formula.FunctionList.UNIQUE[0]).toBe(SC.Formula.DynamicArrayFunctions);
  expect(SC.Formula.SpecialConstants["#SPILL!"]).toBe("0,e#SPILL!");
});

test("SORT and UNIQUE expose exact argument help strings", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.FillFunctionInfo();
  expect(SC.Formula.FunctionArgString("SORT")).toBe(
    "range, sort_column, is_ascending, [sort_column2, is_ascending2, ...]",
  );
  expect(SC.Formula.FunctionArgString("UNIQUE")).toBe("range, [by_column], [exactly_once]");
});

test("evaluator materializes SORT and UNIQUE arrays", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 value n 2",
      "set B1 text t x",
      "set A2 value n 1",
      "set B2 text t x",
      "set A3 value n 1",
      "set B3 text t y",
    ],
    true,
    4000,
  );
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const sorted = evaluate("SORT(A1:B3,1,1)");
  expect(sorted.type).toBe("array");
  expect(sorted.value.cells.map((row: any[]) => row[0].value)).toEqual([1, 1, 2]);
  const unique = evaluate("UNIQUE(SORT(A1:B3,1,1))");
  expect(unique.type).toBe("array");
  expect(unique.value.rows).toBe(3);
  expect(evaluate("SORT(A1:B3,4,1)").type).toBe("e#VALUE!");
  expect(evaluate("SORT(A1:B3,1)").type).toBe("e#VALUE!");
});

test("SORT direction, multi-key stability, deterministic types, and validation", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 value n 2",
      "set B1 text t b",
      "set A2 value n 1",
      "set B2 text t A",
      "set A3 value n 1",
      "set B3 text t a",
      "set A4 text t 10",
      "set B4 value n 0",
      "set A5 formula 1/0",
      "set B5 text t z",
      "set A6 formula 1/0",
      "set A7 formula 2/0",
      "set A8 text t z",
      "set A9 text t a",
      "set A10 value n 1",
      "set A12 value n 1",
      "name define DATA A1:B3",
    ],
    true,
    4000,
  );
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const rows = (formula: string) => {
    const r: any = evaluate(formula);
    expect(r.type).toBe("array");
    return r.value.cells;
  };
  expect(rows("SORT(A1:B3,1,0)").map((r: any[]) => r[0].value)).toEqual([2, 1, 1]);
  expect(rows("SORT(A1:B3,1,1,2,1)").map((r: any[]) => r[1].value)).toEqual(["A", "a", "b"]);
  expect(rows("SORT(A1:B3,1,1)").map((r: any[]) => r[1].value)).toEqual(["A", "a", "b"]);
  expect(rows("SORT(A1:B5,1,1)").map((r: any[]) => r[0].type)).toEqual([
    "n",
    "n",
    "n",
    "t",
    "e#N/A",
  ]);
  expect(rows("SORT(DATA,1,1)")).toHaveLength(3);
  expect(rows("SORT(A6:A7,1,1)").map((r: any[]) => r[0].type)).toEqual(["e#N/A", "e#N/A"]);
  expect(rows("SORT(A8:A10,1,1)").map((r: any[]) => r[0].value)).toEqual([1, "a", "z"]);
  expect(rows("SORT(A11:A12,1,1)").map((r: any[]) => r[0].value)).toEqual([0, 1]);
  expect(evaluate("SORT(A1:B3,1,1)+1").type).toBe("e#VALUE!");
  for (const f of [
    "SORT(A1:B3,0,1)",
    "SORT(A1:B3,1.5,1)",
    "SORT(A1:B3,3,1)",
    'SORT(A1:B3,1,"up")',
    "SORT(A1:B3,1)",
    "SORT(A1:B3,1,1,2)",
  ])
    expect(evaluate(f).type).toBe("e#VALUE!");
});

test("UNIQUE modes, typed keys, nesting, and empty result", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 value n 1",
      "set A2 text t 1",
      "set A3 value n 1",
      "set B1 text t x",
      "set B2 text t x",
      "set B3 text t y",
      "set D1 value n 3",
      "set D2 value n 1",
      "set D3 value n 2",
      "name define COL D1:D3",
    ],
    true,
    4000,
  );
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const rows = (formula: string) => (evaluate(formula) as any).value.cells;
  expect(rows("UNIQUE(A1:B3)").map((r: any[]) => r[0].value)).toEqual([1, "1", 1]);
  expect(rows("UNIQUE(A1:A3,0,1)").map((r: any[]) => r[0].value)).toEqual(["1"]);
  expect((evaluate("UNIQUE(A1:B3,1)") as any).value.cols).toBe(2);
  expect(rows("UNIQUE(COL)").map((r: any[]) => r[0].value)).toEqual([3, 1, 2]);
  expect(rows("UNIQUE(SORT(COL,1,1))").map((r: any[]) => r[0].value)).toEqual([1, 2, 3]);
  expect(rows("SORT(UNIQUE(COL),1,0)").map((r: any[]) => r[0].value)).toEqual([3, 2, 1]);
  const empty: any = evaluate("UNIQUE(B1:B2,0,1)");
  expect(empty.type).toBe("array");
  expect(empty.value).toMatchObject({ rows: 1, cols: 1, cells: [[{ type: "e#N/A" }]] });
  for (const f of ['UNIQUE(A1:A2,"bad")', "UNIQUE(A1:A2,0,1,1)"])
    expect(evaluate(f).type).toBe("e#VALUE!");
});

test("SORT and UNIQUE materialize cross-sheet cached ranges", async () => {
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
  const sorted: any = evaluate("SORT(HELPER!A1:A3,1,1)");
  expect(sorted.type).toBe("array");
  expect(sorted.value.cells.map((row: Array<{ value: unknown }>) => row[0].value)).toEqual([
    1, 2, 2,
  ]);
  const unique: any = evaluate("UNIQUE(HELPER!A1:A3)");
  expect(unique.type).toBe("array");
  expect(unique.value.cells.map((row: Array<{ value: unknown }>) => row[0].value)).toEqual([2, 1]);
});
test("array operands reject every binary operator with observable errors", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"], true, 4000);
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  for (const op of ["M", "P", "%", "&", "<", "L", "=", "G", ">", "N", "+", "-", "*", "/", "^"]) {
    expect(evaluate(`SORT(A1:A2,1,1)${op}1`).type.charAt(0)).toBe("e");
    expect(evaluate(`1${op}SORT(A1:A2,1,1)`).type.charAt(0)).toBe("e");
  }
});
test("SORT comparator pins error, blank, numeric, and text ordering", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 formula 1/0",
      'set A2 formula 1+"x"',
      "set B1 value n 2",
      "set B2 text t a",
      "set B3 text t A",
      "set C2 value n 1",
    ],
    true,
    4000,
  );
  const evaluate = (formula: string) =>
    SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, true);
  const rows = (formula: string) => (evaluate(formula) as any).value.cells;
  expect(rows("SORT(A1:A2,1,1)").map((r: any[]) => r[0].type)).toEqual(["e#N/A", "e#N/A"]);
  expect(rows("SORT(B1:B3,1,1)").map((r: any[]) => r[0].value)).toEqual([2, "a", "A"]);
  expect(rows("SORT(C1:C3,1,1)").map((r: any[]) => r[0].value)).toEqual([0, 0, 1]);
});
