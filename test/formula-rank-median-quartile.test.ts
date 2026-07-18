import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Focused command-level tests for RANK/MEDIAN/QUARTILE, added for EtherCalc
// upstream issues #712 (RANK) and #726 (MEDIAN/QUARTILE). See js/formula1.ts
// SocialCalc.Formula.RankMedianQuartileFunctions for the implementation and
// js/socialcalcconstants.ts for the picker/help text (s_fdef_RANK,
// s_fdef_MEDIAN, s_fdef_QUARTILE, s_farg_rank, s_farg_quartile).

type Cell = { datavalue: any; valuetype: string };

function resetFormulaGlobals(SC: any) {
  // Mirrors test/formula-coverage.test.ts: the UMD bundle attaches SocialCalc
  // to globalThis, so all loadSocialCalc() calls share the same live object.
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
// MEDIAN
// ---------------------------------------------------------------------------

test("MEDIAN: odd count, even count, unsorted data, scalar+range mix", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 5",
    "set A2 value n 1",
    "set A3 value n 3",
    "set A4 value n 9",
    // odd count, unsorted -> sorted [1,3,5] -> median 3
    "set B1 formula MEDIAN(A1:A3)",
    // even count, unsorted -> sorted [1,3,5,9] -> average middle pair (3+5)/2
    "set B2 formula MEDIAN(A1:A4)",
    // scalar args mixed with a range
    "set B3 formula MEDIAN(100,A1:A2)",
  ]);

  expect(getVT("B1")).toBe("n");
  expect(getDV("B1")).toBe(3);
  expect(getDV("B2")).toBe(4);
  expect(getDV("B3")).toBe(5); // sorted [1,5,100] -> middle 5
});

test("MEDIAN: ignores text and blank range members", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 2",
    "set A2 text t hello",
    "set A3 value n 4",
    // A4 left blank
    "set B1 formula MEDIAN(A1:A4)",
  ]);

  // numeric members are just [2,4] -> median (2+4)/2 = 3
  expect(getDV("B1")).toBe(3);
});

test("MEDIAN: propagates a referenced error", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 formula 1/0",
    "set A3 value n 3",
    "set B1 formula MEDIAN(A1:A3)",
  ]);

  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("MEDIAN: empty numeric input follows the AVERAGE #DIV/0! convention", async () => {
  const { getVT } = await buildSheet(["set A1 text t nonnumeric", "set B1 formula MEDIAN(A1)"]);

  expect(getVT("B1")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// QUARTILE
// ---------------------------------------------------------------------------

test("QUARTILE: quart 0..4 with linear interpolation over unsorted data", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 6",
    "set A2 value n 7",
    "set A3 value n 15",
    "set A4 value n 36",
    "set A5 value n 39",
    "set A6 value n 40",
    "set A7 value n 41",
    "set A8 value n 42",
    "set A9 value n 43",
    "set A10 value n 47",
    "set A11 value n 49",
    // sorted: [6,7,15,36,39,40,41,42,43,47,49], n=11
    "set B1 formula QUARTILE(A1:A11,0)",
    "set B2 formula QUARTILE(A1:A11,1)",
    "set B3 formula QUARTILE(A1:A11,2)",
    "set B4 formula QUARTILE(A1:A11,3)",
    "set B5 formula QUARTILE(A1:A11,4)",
  ]);

  // Excel QUARTILE.INC reference values for this well-known example (linear
  // interpolation: pos = p*(n-1) over sorted [6,7,15,36,39,40,41,42,43,47,49]).
  expect(getDV("B1")).toBe(6);
  expect(getDV("B2")).toBe(25.5);
  expect(getDV("B3")).toBe(40);
  expect(getDV("B4")).toBe(42.5);
  expect(getDV("B5")).toBe(49);
});

test("QUARTILE: truncates a noninteger quart toward zero before validating 0..4", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set A5 value n 5",
    // 1.9 truncates to 1 (Excel legacy QUARTILE/QUARTILE.INC documented behavior)
    "set B1 formula QUARTILE(A1:A5,1.9)",
    "set B2 formula QUARTILE(A1:A5,1)",
    // -0.1 truncates to 0 (ceil toward zero for negatives) -> valid, equals quart 0
    "set B3 formula QUARTILE(A1:A5,-0.1)",
    // 4.9 truncates to 4 -> valid, equals quart 4 (max)
    "set B4 formula QUARTILE(A1:A5,4.9)",
    // -1 truncates to -1 -> out of 0..4 domain -> #NUM!
    "set B5 formula QUARTILE(A1:A5,-1)",
    // 5 truncates to 5 -> out of 0..4 domain -> #NUM!
    "set B6 formula QUARTILE(A1:A5,5)",
  ]);

  expect(getDV("B1")).toBe(getDV("B2"));
  expect(getDV("B3")).toBe(1); // quart 0 = min
  expect(getDV("B4")).toBe(5); // quart 4 = max
  expect(getVT("B5")).toBe("e#NUM!");
  expect(getVT("B6")).toBe("e#NUM!");
});

test("QUARTILE: single-element range returns that element for any valid quart", async () => {
  const { getDV } = await buildSheet(["set A1 value n 42", "set B1 formula QUARTILE(A1,2)"]);

  expect(getDV("B1")).toBe(42);
});

test("QUARTILE: empty numeric input is #NUM!", async () => {
  const { getVT } = await buildSheet(["set A1 text t nonnumeric", "set B1 formula QUARTILE(A1,2)"]);

  expect(getVT("B1")).toBe("e#NUM!");
});

test("QUARTILE: propagates a referenced error and rejects invalid arity", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 formula 1/0",
    "set A3 value n 3",
    "set B1 formula QUARTILE(A1:A3,2)",
    // wrong arg count (argnum is fixed at 2 for QUARTILE)
    "set B2 formula QUARTILE(A1:A3)",
  ]);

  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// RANK
// ---------------------------------------------------------------------------

test("RANK: descending (default/omitted order) and ascending (nonzero order)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 7",
    "set A2 value n 3",
    "set A3 value n 5",
    "set A4 value n 9",
    // descending (order omitted): largest = rank 1
    "set B1 formula RANK(9,A1:A4)",
    "set B2 formula RANK(3,A1:A4)",
    // descending explicit order=0
    "set B3 formula RANK(7,A1:A4,0)",
    // ascending: smallest = rank 1
    "set B4 formula RANK(3,A1:A4,1)",
    "set B5 formula RANK(9,A1:A4,1)",
  ]);

  expect(getDV("B1")).toBe(1);
  expect(getDV("B2")).toBe(4);
  expect(getDV("B3")).toBe(2);
  expect(getDV("B4")).toBe(1);
  expect(getDV("B5")).toBe(4);
});

test("RANK: ties share the best rank and skip subsequent numbers", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 10",
    "set A2 value n 10",
    "set A3 value n 8",
    "set A4 value n 6",
    // descending: two values tied at 10 both rank 1; 8 ranks 3 (not 2)
    "set B1 formula RANK(10,A1:A4)",
    "set B2 formula RANK(8,A1:A4)",
    "set B3 formula RANK(6,A1:A4)",
  ]);

  expect(getDV("B1")).toBe(1);
  expect(getDV("B2")).toBe(3);
  expect(getDV("B3")).toBe(4);
});

test("RANK: number not found in ref is #N/A", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 formula RANK(99,A1:A3)",
  ]);

  expect(getVT("B1")).toBe("e#N/A");
});

test("RANK: ignores nonnumeric ref members and propagates a referenced error", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 5",
    "set A2 text t skip-me",
    "set A3 value n 10",
    "set B1 formula RANK(5,A1:A3)",
    "set C1 value n 1",
    "set C2 formula 1/0",
    "set C3 value n 3",
    "set B2 formula RANK(1,C1:C3)",
  ]);

  expect(getDV("B1")).toBe(2); // [10,5] descending -> 5 is rank 2
  expect(getVT("B2")).toBe("e#DIV/0!");
});

test("RANK: invalid arity is rejected", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    // too few args (argnum -2 requires at least number+ref)
    "set B1 formula RANK(1)",
    // too many args (number, ref, order, + one extra)
    "set B2 formula RANK(1,A1:A2,0,99)",
  ]);

  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// Function-list registration / help picker plumbing
// ---------------------------------------------------------------------------

test("RANK/MEDIAN/QUARTILE are registered in FunctionList with help text and arg strings", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);

  for (const fname of ["RANK", "MEDIAN", "QUARTILE"]) {
    const fobj = SC.Formula.FunctionList[fname];
    expect(fobj).toBeTruthy();
    expect(fobj[4]).toBe("stat"); // function class
  }

  SC.Formula.FillFunctionInfo();
  expect(SC.Formula.FunctionArgDefs["rank"]).toBe("number, ref, [order]");
  expect(SC.Formula.FunctionArgDefs["vn"]).toBe("value1, value2, ...");
  expect(SC.Formula.FunctionArgDefs["quartile"]).toBe("range, quart");
  expect(SC.Formula.FunctionList["RANK"][3]).toContain("Returns the rank of number");
  expect(SC.Formula.FunctionList["MEDIAN"][3]).toContain("median");
  expect(SC.Formula.FunctionList["QUARTILE"][3]).toContain("quartile");
  expect(SC.Formula.FunctionClasses["stat"].items).toContain("RANK");
  expect(SC.Formula.FunctionClasses["stat"].items).toContain("MEDIAN");
  expect(SC.Formula.FunctionClasses["stat"].items).toContain("QUARTILE");
});
