// Coverage for the shared *IFS-family criteria core: COUNTIFS, AVERAGEIF,
// AVERAGEIFS, MAXIFS, MINIFS (js/formula1.ts FormulaMut.CriteriaAggregateFunctions),
// plus a regression guard confirming COUNTIF/SUMIF/SUMIFS keep their
// pre-existing lockstep behavior untouched.
import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

type Cell = { datavalue: any; valuetype: string };

function resetFormulaGlobals(SC: any) {
  if (SC.RecalcInfo) {
    SC.RecalcInfo.LoadSheet = () => false;
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
    if (SC.RecalcInfo.recalctimer) {
      try {
        clearTimeout(SC.RecalcInfo.recalctimer);
      } catch {
        // cleanup: recalctimer may already have fired/cleared; best-effort clear only.
      }
      SC.RecalcInfo.recalctimer = null;
    }
    SC.RecalcInfo.firstRenderScheduled = false;
  }
  if (SC.Formula) {
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;
    SC.Formula.FreshnessInfo.sheets = {};
    SC.Formula.FreshnessInfo.volatile = {};
    SC.Formula.RemoteFunctionInfo.waitingForServer = null;
  }
}

async function buildSheet(commands: string[]) {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  if (commands.length) {
    await scheduleCommands(SC, sheet, commands, true, 4000);
  }
  await recalcSheet(SC, sheet, 4000);
  const getDV = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).datavalue;
  const getVT = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).valuetype;
  return { SC, sheet, getDV, getVT };
}

// ---------------------------------------------------------------------------
// COUNTIFS
// ---------------------------------------------------------------------------

test("COUNTIFS: single criteria pair", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    'set B1 formula COUNTIFS(A1:A3,">1")',
  ]);
  expect(getDV("B1")).toBe(2);
});

test("COUNTIFS: multiple criteria pairs (AND across pairs)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 text t apple",
    "set B2 text t banana",
    "set B3 text t apple",
    'set C1 formula COUNTIFS(A1:A3,">1",B1:B3,"apple")',
  ]);
  // Only A3=3 (>1) has B3="apple"; A2=2(>1) has B2="banana" (no match).
  expect(getDV("C1")).toBe(1);
});

test("COUNTIFS: no match returns 0", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    'set B1 formula COUNTIFS(A1:A2,">100")',
  ]);
  expect(getDV("B1")).toBe(0);
});

test("COUNTIFS: blank criteria (empty cell ref) matches nothing", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula COUNTIFS(A1:A2,Z99)",
  ]);
  expect(getDV("B1")).toBe(0);
});

test("COUNTIFS: wildcard criteria", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t cat",
    "set A2 text t dog",
    "set A3 text t cot",
    'set B1 formula COUNTIFS(A1:A3,"c?t")',
  ]);
  expect(getDV("B1")).toBe(2);
});

test("COUNTIFS: bare single-cell coord operands (not A1:A1 ranges) are treated as 1x1", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 5",
    "set B1 value n 1",
    'set C1 formula COUNTIFS(A1,">0",B1,1)',
  ]);
  expect(getDV("C1")).toBe(1);
});

test("COUNTIFS: an error-value criteria on a non-first pair matches nothing (coerced to null)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 1",
    "set B2 value n 1",
    // Second pair's criteria is an error (1/0); OperandAsText coerces it to
    // a null match, so no row can satisfy both pairs.
    'set C1 formula COUNTIFS(A1:A2,">0",B1:B2,1/0)',
  ]);
  expect(getDV("C1")).toBe(0);
});

test("COUNTIFS: shape mismatch across criteria ranges is #VALUE!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 1",
    'set C1 formula COUNTIFS(A1:A2,">0",B1:B1,">0")',
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
});

test("COUNTIFS: non-range/coord argument is #VALUE!", async () => {
  const { getVT } = await buildSheet(['set B1 formula COUNTIFS("bad",">0")']);
  expect(getVT("B1")).toBe("e#VALUE!");
});

test("COUNTIFS: too few arguments is an arity error", async () => {
  const { getVT } = await buildSheet(["set A1 value n 1", "set B1 formula COUNTIFS(A1:A1)"]);
  expect(getVT("B1")).toBe("e#VALUE!");
});

test("COUNTIFS: odd trailing range with no criteria is an arity error", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set B1 value n 1",
    'set C1 formula COUNTIFS(A1:A1,">0",B1:B1)',
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
});

test("COUNTIFS: cross-sheet criteria range", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  SC.Formula.AddSheetToCache(
    "OTHER",
    "version:1.5\ncell:A1:v:5\ncell:A2:v:10\nsheet:c:1:r:2\n",
    false,
  );
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set B1 value n 1", "set B2 value n 1"]);
  await recalcSheet(SC, sheet);
  const parsed = SC.Formula.ParseFormulaIntoTokens('COUNTIFS(OTHER!A1:A2,">0",B1:B2,1)');
  const result = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
  expect(result).toMatchObject({ value: 2, type: "n" });
});

test("COUNTIFS: named range as a criteria_range operand", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 5",
    "set A2 value n 10",
    "set B1 value n 1",
    "set B2 value n 1",
    "name define CRIT A1:A2",
    'set C1 formula COUNTIFS(CRIT,">0",B1:B2,1)',
  ]);
  expect(getDV("C1")).toBe(2);
});

// ---------------------------------------------------------------------------
// AVERAGEIF
// ---------------------------------------------------------------------------

test("AVERAGEIF: two-arg form averages the range itself", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 5",
    "set A2 value n 15",
    "set A3 value n 25",
    'set B1 formula AVERAGEIF(A1:A3,">10")',
  ]);
  expect(getDV("B1")).toBe(20); // (15+25)/2
});

test("AVERAGEIF: three-arg form averages the corresponding average_range cells", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t apple",
    "set A2 text t banana",
    "set A3 text t apple",
    "set B1 value n 10",
    "set B2 value n 20",
    "set B3 value n 30",
    'set C1 formula AVERAGEIF(A1:A3,"apple",B1:B3)',
  ]);
  expect(getDV("C1")).toBe(20); // (10+30)/2
});

test("AVERAGEIF: text/blank cells in average_range are ignored (numeric-only)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 5",
    "set A2 value n 5",
    "set A3 value n 5",
    "set B1 value n 10",
    // B2 intentionally blank
    "set B3 text t nope",
    "set C1 formula AVERAGEIF(A1:A3,5,B1:B3)",
  ]);
  expect(getDV("C1")).toBe(10); // only B1 is numeric among the 3 matched rows
});

test("AVERAGEIF: no numeric match is #DIV/0!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 5",
    'set B1 formula AVERAGEIF(A1:A1,">100")',
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("AVERAGEIF: an error-value criteria matches nothing (coerced to null)", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 5",
    "set A2 value n 10",
    "set B1 formula AVERAGEIF(A1:A2,1/0)",
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("AVERAGEIF: error in average_range propagates", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula 1/0",
    "set B2 value n 5",
    'set C1 formula AVERAGEIF(A1:A2,">0",B1:B2)',
  ]);
  expect(getVT("C1").charAt(0)).toBe("e");
});

// ---------------------------------------------------------------------------
// AVERAGEIFS
// ---------------------------------------------------------------------------

test("AVERAGEIFS: single criteria pair", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 10",
    "set A2 value n 20",
    "set A3 value n 30",
    "set B1 value n 1",
    "set B2 value n 2",
    "set B3 value n 1",
    "set C1 formula AVERAGEIFS(A1:A3,B1:B3,1)",
  ]);
  expect(getDV("C1")).toBe(20); // (10+30)/2
});

test("AVERAGEIFS: multiple criteria pairs", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 230000",
    "set A2 value n 197000",
    "set A3 value n 345678",
    "set B1 text t Issaquah",
    "set B2 text t Bellevue",
    "set B3 text t Bellevue",
    "set C1 value n 3",
    "set C2 value n 2",
    "set C3 value n 4",
    'set D1 formula AVERAGEIFS(A1:A3,B1:B3,"Bellevue",C1:C3,">2")',
  ]);
  expect(getDV("D1")).toBe(345678); // only row 3 matches both criteria
});

test("AVERAGEIFS: no match is #DIV/0!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 5",
    "set B1 value n 1",
    "set C1 formula AVERAGEIFS(A1:A1,B1:B1,999)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
});

test("AVERAGEIFS: criteria_range shape mismatch vs average_range is #VALUE!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 1",
    "set C1 formula AVERAGEIFS(A1:A2,B1:B1,1)",
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
});

test('AVERAGEIFS: a criteria_range cell with falsy valuetype (set value t "") falls back to blank', async () => {
  // `set A1 value t ` (trailing empty text) makes DetermineValueType("")
  // return type "" — cell.valuetype ends up "" (falsy), not "b", exercising
  // the `cell.valuetype || "b"` fallback in the row-eligibility scan.
  const { getDV } = await buildSheet([
    "set A1 value t ",
    "set A2 value n 5",
    "set B1 value n 10",
    "set B2 value n 20",
    // "=" criteria matches blank (empty-equals-empty); A1's fallback-to-"b"
    // type makes it match, A2 (numeric 5) does not.
    'set C1 formula AVERAGEIFS(B1:B2,A1:A2,"=")',
  ]);
  expect(getDV("C1")).toBe(10);
});

test("AVERAGEIFS: a matched aggregate_range cell with falsy valuetype is treated as non-numeric", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 1",
    // B1's falsy valuetype ("" via trailing-empty text) is a matched but
    // non-numeric aggregate cell — exercises the aggregate-side
    // `aggcell.valuetype || "b"` fallback, distinct from the criteria-range
    // fallback covered above.
    "set B1 value t ",
    "set B2 value n 20",
    "set C1 formula AVERAGEIFS(B1:B2,A1:A2,1)",
  ]);
  // Only B2 is numeric among the two matched rows: (20)/1 = 20, type "n".
  expect(getVT("C1")).toBe("n");
});

// ---------------------------------------------------------------------------
// MAXIFS
// ---------------------------------------------------------------------------

test("MAXIFS: single criteria pair", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 91",
    "set A2 value n 50",
    "set A3 value n 88",
    "set B1 value n 1",
    "set B2 value n 0",
    "set B3 value n 1",
    "set C1 formula MAXIFS(A1:A3,B1:B3,1)",
  ]);
  expect(getDV("C1")).toBe(91);
});

test("MAXIFS: multiple criteria pairs", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 25",
    "set A2 value n 19",
    "set A3 value n 50",
    "set B1 text t b",
    "set B2 text t b",
    "set B3 text t b",
    "set C1 value n 100",
    "set C2 value n 100",
    "set C3 value n 400",
    'set D1 formula MAXIFS(A1:A3,B1:B3,"b",C1:C3,">100")',
  ]);
  expect(getDV("D1")).toBe(50);
});

test("MAXIFS: no cells match returns 0 (not #DIV/0!)", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 5",
    "set B1 value n 1",
    "set C1 formula MAXIFS(A1:A1,B1:B1,999)",
  ]);
  expect(getVT("C1")).toBe("n");
  expect(getDV("C1")).toBe(0);
});

test("MAXIFS: error in max_range on a matched row propagates", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0",
    "set A2 value n 5",
    "set B1 value n 1",
    "set B2 value n 1",
    "set C1 formula MAXIFS(A1:A2,B1:B2,1)",
  ]);
  expect(getVT("C1").charAt(0)).toBe("e");
});

test("MAXIFS: max_range shape mismatch is #VALUE!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set B1 value n 1",
    "set B2 value n 1",
    "set C1 formula MAXIFS(A1:A1,B1:B2,1)",
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// MINIFS
// ---------------------------------------------------------------------------

test("MINIFS: single criteria pair", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 91",
    "set A2 value n 50",
    "set A3 value n 88",
    "set B1 value n 1",
    "set B2 value n 0",
    "set B3 value n 1",
    "set C1 formula MINIFS(A1:A3,B1:B3,1)",
  ]);
  expect(getDV("C1")).toBe(88);
});

test("MINIFS: no cells match returns 0 (not #DIV/0!)", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 5",
    "set B1 value n 1",
    "set C1 formula MINIFS(A1:A1,B1:B1,999)",
  ]);
  expect(getVT("C1")).toBe("n");
  expect(getDV("C1")).toBe(0);
});

test("MINIFS: wildcard criteria and cross-column pairs", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 10",
    "set A2 value n 20",
    "set A3 value n 30",
    "set B1 text t cat",
    "set B2 text t car",
    "set B3 text t dog",
    'set C1 formula MINIFS(A1:A3,B1:B3,"ca*")',
  ]);
  expect(getDV("C1")).toBe(10);
});

test("MINIFS: error in min_range on a matched row propagates", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0",
    "set A2 value n 5",
    "set B1 value n 1",
    "set B2 value n 1",
    "set C1 formula MINIFS(A1:A2,B1:B2,1)",
  ]);
  expect(getVT("C1").charAt(0)).toBe("e");
});

// ---------------------------------------------------------------------------
// Direct-dispatch coverage: paths unreachable through the parser/evaluator
// (an operand whose "range" value points at a sheet DecodeRangeParts cannot
// resolve at all, and a caller-invoked fname outside the five registered
// names), exercised the same way as the existing
// "CountifSumifFunctions: direct dispatch with unknown fname" test.
// ---------------------------------------------------------------------------

test("CriteriaAggregateFunctions: unresolvable cross-sheet range operand is #REF! (direct dispatch)", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set B1 value n 1"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const operand: { type: string; value: unknown }[] = [];
  // foperand is popped from the end (TopOfStackValueAndType/OperandAsText
  // both pop the last element), so list operands in reverse call order:
  // COUNTIFS(A1!MISSING_SHEET|A1|, ">0", B1|B1|, ">0").
  const foperand = [
    { type: "t", value: ">0" },
    { type: "range", value: "B1|B1|" },
    { type: "t", value: ">0" },
    { type: "range", value: "A1!MISSING_SHEET|A1|" },
  ];
  (SC.Formula as any).CriteriaAggregateFunctions("COUNTIFS", operand, foperand, sheet);
  expect(operand).toEqual([{ type: "e#REF!", value: 0 }]);
});

test("CriteriaAggregateFunctions: direct dispatch with an unregistered fname pushes nothing", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 5", "set B1 value n 1"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const operand: { type: string; value: unknown }[] = [];
  // aggrange pops first (last element), then one criteria_range/criteria
  // pair — 3 operands total, matching the -3 arity of the four registered
  // fnames that take an aggregate range (AVERAGEIFS/MAXIFS/MINIFS use this
  // shape; only AVERAGEIF and COUNTIFS differ, and neither is relevant to
  // this unregistered-fname trailing-return probe).
  const foperand = [
    { type: "t", value: ">0" },
    { type: "range", value: "A1|A1|" },
    { type: "range", value: "B1|B1|" },
  ];
  // FunctionList never routes any real formula name here; this exercises
  // the trailing `return;` after the switch falls through every case.
  (SC.Formula as any).CriteriaAggregateFunctions("XCOUNTIFS", operand, foperand, sheet);
  expect(operand.length).toBe(0);
});

// ---------------------------------------------------------------------------
// Regression: COUNTIF / SUMIF / SUMIFS keep their pre-existing behavior
// (lockstep operand-stack walk, no shape validation) — the shared *IFS core
// added above must not perturb these.
// ---------------------------------------------------------------------------

test("regression: COUNTIF/SUMIF/SUMIFS still evaluate as before", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 text t apple",
    "set B2 text t banana",
    "set B3 text t apple",
    'set C1 formula COUNTIF(A1:A3,">1")',
    'set C2 formula SUMIF(A1:A3,">1")',
    'set C3 formula SUMIFS(A1:A3,B1:B3,"apple")',
  ]);
  expect(getDV("C1")).toBe(2);
  expect(getDV("C2")).toBe(5);
  expect(getDV("C3")).toBe(4); // A1(1)+A3(3), both "apple"
});

test("regression: SUMIFS with mismatched dimensions still walks lockstep (no #VALUE!)", async () => {
  // SUMIFS/COUNTIF/SUMIF are intentionally NOT hardened with the *IFS shape
  // check: they keep the pre-existing StepThroughRangeDown lockstep walk so
  // the pinned oracle-3.0.8 differential stays byte-for-byte. A 3-row sum
  // range against a 2-row criteria range should still evaluate (not error).
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 value n 1",
    "set B2 value n 1",
    "set C1 formula SUMIFS(A1:A3,B1:B2,1)",
  ]);
  expect(getVT("C1")).not.toBe("e#VALUE!");
});
