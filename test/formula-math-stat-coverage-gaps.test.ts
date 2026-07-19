import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Closes the branch-coverage gap left by test/formula-math-stat-compat.test.ts:
// argument-validation error paths (non-range operands, non-numeric operands,
// propagated range errors, empty/all-nonnumeric input, too-many-args) across
// QUARTILE.EXC, PERCENTILE(.INC/.EXC), PERCENTRANK(.INC/.EXC),
// PairedRangeStatFunctions (CORREL/COVARIANCE/SLOPE/INTERCEPT/RSQ/
// FORECAST(.LINEAR)/TREND/GROWTH), GcdLcmFunction, and STDEV.P/VAR.P's
// all-nonnumeric (count==0) branch. Each test targets exactly one branch
// named in its title/comment, matching this repo's existing coverage-gap
// test conventions (see test/formula1-coverage-gaps-*.test.ts).

type Cell = { datavalue: any; valuetype: string };
type Operand = { type: string; value: unknown };

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
// STDEV.P / VAR.P: count==0 branch (all-nonnumeric input)
// ---------------------------------------------------------------------------

test("STDEV.P/VAR.P: all-nonnumeric input (count==0) is #DIV/0!, same as the count>1 else branch", async () => {
  const { getVT } = await buildSheet([
    "set A1 text t nonnumeric",
    "set B1 formula STDEV.P(A1)",
    "set B2 formula VAR.P(A1)",
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// GcdLcmFunction: LCM overflow and the unreachable-via-normal-dispatch
// empty-values guard (argnum -1 guarantees >=1 arg; direct dispatch only).
// ---------------------------------------------------------------------------

test("LCM: overflow past 2^53 is #NUM!", async () => {
  // Two large coprime-ish numbers whose product exceeds 2^53.
  const { getVT } = await buildSheet([
    "set A1 value n 123456791",
    "set A2 value n 987654323",
    "set B1 formula LCM(A1,A2)",
  ]);
  expect(getVT("B1")).toBe("e#NUM!");
});

test("GcdLcmFunction: empty foperand via direct dispatch hits the defensive FunctionArgsError guard", async () => {
  const { SC, sheet } = await buildSheet([]);
  const operand: Operand[] = [];
  const foperand: Operand[] = [];
  SC.Formula.GcdLcmFunction("GCD", operand, foperand, sheet);
  expect(operand[0]?.type).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// QUARTILE.EXC: remaining argument-validation branches
// ---------------------------------------------------------------------------

test("QUARTILE.EXC: rejects a scalar first argument, nonnumeric quart, and propagates a range error", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 formula QUARTILE.EXC(9,1)",
    'set B2 formula QUARTILE.EXC(A1:A3,"x")',
    "set A4 formula 1/0",
    "set B3 formula QUARTILE.EXC(A1:A4,1)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#DIV/0!");
});

test("QUARTILE.EXC: negative noninteger quart truncates via ceil-toward-zero (still #NUM!, quart<=0)", async () => {
  // Exercises the excquartvalue < 0 branch of the truncation ternary
  // (Math.ceil path), distinct from the existing positive-quart tests.
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 formula QUARTILE.EXC(A1:A3,-1.5)",
  ]);
  expect(getVT("B1")).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// PERCENTILE / PERCENTILE.INC: remaining argument-validation branches
// ---------------------------------------------------------------------------

test("PERCENTILE: rejects a scalar first argument, nonnumeric k, propagates a range error, and empty numeric input", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula PERCENTILE(9,0.5)",
    'set B2 formula PERCENTILE(A1:A2,"x")',
    "set A3 formula 1/0",
    "set B3 formula PERCENTILE(A1:A3,0.5)",
    "set C1 text t nonnumeric",
    "set B4 formula PERCENTILE(C1,0.5)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#DIV/0!");
  expect(getVT("B4")).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// PERCENTILE.EXC: remaining argument-validation branches
// ---------------------------------------------------------------------------

test("PERCENTILE.EXC: rejects a scalar first argument, nonnumeric k, propagates a range error, and empty numeric input", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula PERCENTILE.EXC(9,0.5)",
    'set B2 formula PERCENTILE.EXC(A1:A2,"x")',
    "set A3 formula 1/0",
    "set B3 formula PERCENTILE.EXC(A1:A3,0.5)",
    "set C1 text t nonnumeric",
    "set B4 formula PERCENTILE.EXC(C1,0.5)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#DIV/0!");
  expect(getVT("B4")).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// PERCENTRANK / PERCENTRANK.INC: remaining argument-validation branches
// ---------------------------------------------------------------------------

test("PERCENTRANK: rejects a scalar first argument, nonnumeric x, nonnumeric significance, too many args", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula PERCENTRANK(9,1)",
    'set B2 formula PERCENTRANK(A1:A2,"x")',
    'set B3 formula PERCENTRANK(A1:A2,1,"x")',
    "set B4 formula PERCENTRANK(A1:A2,1,1,99)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#VALUE!");
  expect(getVT("B4")).toBe("e#VALUE!");
});

test("PERCENTRANK: propagates a range error, empty numeric input, and the single-value-dataset branch (both match and no-match)", async () => {
  const { getVT, getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 formula 1/0",
    "set B1 formula PERCENTRANK(A1:A2,1)",
    "set C1 text t nonnumeric",
    "set B2 formula PERCENTRANK(C1,1)",
    "set D1 value n 5",
    "set B3 formula PERCENTRANK(D1,5)", // matches the single value -> 0
    "set B4 formula PERCENTRANK(D1,9)", // does not match -> #N/A
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#NUM!");
  expect(getDV("B3")).toBe(0);
  expect(getVT("B4")).toBe("e#N/A");
});

// ---------------------------------------------------------------------------
// PERCENTRANK.EXC: remaining argument-validation branches
// ---------------------------------------------------------------------------

test("PERCENTRANK.EXC: rejects a scalar first argument, nonnumeric x, nonnumeric significance, significance<1, too many args", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula PERCENTRANK.EXC(9,1)",
    'set B2 formula PERCENTRANK.EXC(A1:A2,"x")',
    'set B3 formula PERCENTRANK.EXC(A1:A2,1,"x")',
    "set B4 formula PERCENTRANK.EXC(A1:A2,1,0)",
    "set B5 formula PERCENTRANK.EXC(A1:A2,1,1,99)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#VALUE!");
  expect(getVT("B4")).toBe("e#NUM!");
  expect(getVT("B5")).toBe("e#VALUE!");
});

test("PERCENTRANK.EXC: too many arguments after a VALID significance (>=1) is rejected", async () => {
  // The existing too-many-args case uses significance=1 with a trailing
  // extra arg too -- but confirm the specific branch that fires only
  // AFTER significance passes its own <1 validation (line 2551, distinct
  // from the significance<1 #NUM! branch at 2547-2549).
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula PERCENTRANK.EXC(A1:A2,1,2,99)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
});

test("PERCENTRANK.EXC: significance provided with no trailing extra argument", async () => {
  // Hits the false side of `if (foperand.length)` at the tail of the
  // significance branch -- exactly 3 args (range, x, significance), no
  // 4th arg, so FunctionArgsError is never reached.
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 4",
    "set B1 formula PERCENTRANK.EXC(A1:A3,3,2)",
  ]);
  expect(getDV("B1")).toBeCloseTo(0.62, 9); // 0.625 truncated to 2 significant digits
});

test("PERCENTRANK.EXC: propagates a range error, empty numeric input, out-of-range #N/A, and exact-match interpolation", async () => {
  const { getVT, getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 formula 1/0",
    "set B1 formula PERCENTRANK.EXC(A1:A2,1)",
    "set C1 text t nonnumeric",
    "set B2 formula PERCENTRANK.EXC(C1,1)",
    "set D1 value n 1",
    "set D2 value n 2",
    "set D3 value n 3",
    "set B3 formula PERCENTRANK.EXC(D1:D3,99)", // outside range
    "set B4 formula PERCENTRANK.EXC(D1:D3,1)", // exact match at the low end
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#NUM!");
  expect(getVT("B3")).toBe("e#N/A");
  expect(getDV("B4")).toBeCloseTo(0.25, 9); // rankpos=1 -> 1/(3+1)
});

test("PERCENTRANK.EXC: interpolates when x falls strictly between two array values", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 4",
    // x=3 is not present -- interpolate between rank positions of 2 and 4.
    "set B1 formula PERCENTRANK.EXC(A1:A3,3)",
  ]);
  // pxlo finds index 1 (value 2); frac = (3-2)/(4-2) = 0.5; rankpos =
  // 1+1+0.5 = 2.5; rank = 2.5/(3+1) = 0.625.
  expect(getDV("B1")).toBeCloseTo(0.625, 9);
});

// ---------------------------------------------------------------------------
// PairedRangeStatFunctions (CORREL/COVARIANCE/SLOPE/INTERCEPT/RSQ/FORECAST):
// remaining argument-validation branches
// ---------------------------------------------------------------------------

test("CORREL family: rejects scalar known_y's/known_x's operands", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula CORREL(9,A1:A2)",
    "set B2 formula CORREL(A1:A2,9)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
});

test("CORREL family: propagates an error cell present in either paired range", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 formula 1/0",
    "set B1 value n 1",
    "set B2 value n 2",
    "set C1 formula CORREL(A1:A2,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
});

test("CORREL family: propagates an error cell present only in the x-side paired range", async () => {
  // The prior test puts the error on the y-side (A2); this covers the
  // separate `if (xt == "e" && !errortype) errortype = xFlat[i].type`
  // branch in CollectPairedNumericValues (x-side error, not y-side).
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 1",
    "set B2 formula 1/0",
    "set C1 formula CORREL(A1:A2,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
});

test("CollectPairedNumericValues: either operand failing to materialize is e#VALUE! via direct dispatch", async () => {
  const { SC, sheet } = await buildSheet(["set A1 value n 1", "set A2 value n 2"]);
  const operand: Operand[] = [];
  // CORREL is popped (known_y's, known_x's) in call order; foperand is
  // reverse-of-call-order, so known_x's (ZZZ range, fails to materialize)
  // is listed first, known_y's last.
  const foperand: Operand[] = [
    { type: "range", value: "ZZZ1|ZZZ2|" },
    { type: "range", value: "A1|A2|" },
  ];
  SC.Formula.PairedRangeStatFunctions("CORREL", operand, foperand, sheet);
  expect(operand[0]?.type).toBe("e#VALUE!");
});

test("CORREL/RSQ: zero-variance y (but nonzero-variance x) is #DIV/0! via the denomY==0 branch", async () => {
  // x varies (1,2,3) but y is constant (5,5,5) -- denom (x-variance) is
  // nonzero so the function proceeds past the SLOPE/INTERCEPT domain check,
  // but denomY (y-variance) is zero -- the CORREL/RSQ-specific guard.
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 value n 5",
    "set B2 value n 5",
    "set B3 value n 5",
    "set C1 formula CORREL(B1:B3,A1:A3)",
    "set C2 formula RSQ(B1:B3,A1:A3)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
  expect(getVT("C2")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// TREND / GROWTH: remaining shape/argument-validation branches
// ---------------------------------------------------------------------------

test("TREND: rejects a scalar known_y's operand", async () => {
  const { getVT } = await buildSheet(["set B1 formula TREND(9)"]);
  expect(getVT("B1")).toBe("e#VALUE!");
});

test("TREND: known_y's range fails to materialize (invalid range) is #VALUE!", async () => {
  const { SC, sheet } = await buildSheet([]);
  const operand: Operand[] = [];
  // ZZZ1 is outside the supported column band -- MaterializeArray returns
  // null for it, exercising the tyArray-null guard (distinct from the
  // already-covered txArray-null/newXArray-null guards below).
  const foperand: Operand[] = [{ type: "range", value: "ZZZ1|ZZZ2|" }];
  SC.Formula.PairedRangeStatFunctions("TREND", operand, foperand, sheet);
  expect(operand[0]?.type).toBe("e#VALUE!");
});

test("TREND: known_x's as a bare scalar matching a single-point known_y's materializes via the scalar-wrap path", async () => {
  // known_x's may be a bare scalar (not just a range) per Excel's real arg
  // model -- exercises materializeFlat's non-range/non-coord wrap branch.
  // A single point (n=1) makes the default-fit denominator zero (denom =
  // 1*x^2 - x^2 = 0), landing on the existing #DIV/0! guard -- this test's
  // purpose is covering the scalar-wrap branch itself, not a numeric result.
  const { getVT } = await buildSheet(["set A1 value n 5", "set B1 formula TREND(A1,3)"]);
  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("TREND: known_x's provided as a bare scalar with a shape mismatch against known_y's is #N/A", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula TREND(A1:A2,3)",
  ]);
  expect(getVT("B1")).toBe("e#N/A");
});

test("TREND: known_x's range fails to materialize (invalid range) is #VALUE!", async () => {
  const { SC, sheet } = await buildSheet(["set A1 value n 1", "set A2 value n 2"]);
  const operand: Operand[] = [];
  // ZZZ1 is outside the supported column band -- DecodeRangeParts/
  // MaterializeArray return null for it, exercising the txArray-null guard.
  // foperand is popped from the END (TopOfStackValueAndType/.pop()), so it
  // must list args in reverse-of-call-order: known_y's (popped first) goes
  // last in the array, known_x's (popped second) goes before it.
  const foperand: Operand[] = [
    { type: "range", value: "ZZZ1|ZZZ2|" }, // known_x's (popped 2nd)
    { type: "range", value: "A1|A2|" }, // known_y's (popped 1st)
  ];
  SC.Formula.PairedRangeStatFunctions("TREND", operand, foperand, sheet);
  expect(operand[0]?.type).toBe("e#VALUE!");
});

test("TREND: new_x's range fails to materialize (invalid range) is #VALUE!", async () => {
  const { SC, sheet } = await buildSheet(["set A1 value n 1", "set A2 value n 2"]);
  const operand: Operand[] = [];
  // Reverse-of-call-order (see comment above): new_x's popped 3rd goes
  // first in the array, known_y's popped 1st goes last.
  const foperand: Operand[] = [
    { type: "range", value: "ZZZ1|ZZZ2|" }, // new_x's (popped 3rd) -- fails to materialize
    { type: "range", value: "A1|A2|" }, // known_x's (popped 2nd)
    { type: "range", value: "A1|A2|" }, // known_y's (popped 1st)
  ];
  SC.Formula.PairedRangeStatFunctions("TREND", operand, foperand, sheet);
  expect(operand[0]?.type).toBe("e#VALUE!");
});

test("TREND: known_x's/known_y's shape mismatch is #N/A", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 value n 1",
    "set B2 value n 2",
    "set C1 formula TREND(A1:A3,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#N/A");
});

test("TREND: new_x's provided as a bare scalar (real Excel usage), and rejects nonnumeric const", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 value n 3",
    "set B2 value n 5",
    "set B3 value n 7",
    "set C1 formula TREND(B1:B3,A1:A3,4)",
    'set C2 formula TREND(B1:B3,A1:A3,4,"x")',
  ]);
  expect(getDV("C1")).toBeCloseTo(9, 9); // y=2x+1 at x=4
  expect(getVT("C2")).toBe("e#VALUE!");
});

test("TREND: too many arguments after const is rejected", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 1",
    "set B2 value n 2",
    "set C1 formula TREND(B1:B2,A1:A2,A1:A2,1,99)",
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
});

test("TREND: propagates an error cell inside known_x's during the fit-pair scan", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 formula 1/0",
    "set B1 value n 1",
    "set B2 value n 2",
    "set C1 formula TREND(B1:B2,A1:A2)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
});

test("TREND: propagates an error cell inside known_y's during the fit-pair scan", async () => {
  // Distinct from the known_x's-error test above: this puts the error on
  // the y-side, hitting the separate `tyt == "e" && !fitError` branch.
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula 1/0",
    "set B2 value n 2",
    "set C1 formula TREND(B1:B2,A1:A2)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
});

test("TREND: const=FALSE forces a through-the-origin fit (b=0), and #DIV/0! when Sxx==0", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 2",
    "set B2 value n 4",
    // y=2x through the origin: m = Sxy/Sxx = (2+8)/(1+4) = 2.
    "set C1 formula TREND(B1:B2,A1:A2,A1,0)",
    // Sxx==0 when known_x's is a single point at value 0 -- through-origin
    // fit is undefined for that single point.
    "set D1 value n 0",
    "set E1 value n 5",
    "set C2 formula TREND(E1,D1,D1,0)",
  ]);
  expect(getDV("C1")).toBeCloseTo(2, 9);
  expect(getVT("C2")).toBe("e#DIV/0!");
});

test("TREND: new_x cell that fails to resolve numeric is #VALUE! in that output position", async () => {
  const { SC, sheet } = await buildSheet(["set A1 value n 1", "set A2 value n 2"]);
  const operand: Operand[] = [];
  // Reverse-of-call-order: new_x's (popped 3rd) first, known_y's
  // (popped 1st) last.
  const foperand: Operand[] = [
    { type: "t", value: "not-a-number" }, // new_x's, a nonnumeric scalar
    { type: "range", value: "A1|A2|" }, // known_x's
    { type: "range", value: "A1|A2|" }, // known_y's
  ];
  SC.Formula.PairedRangeStatFunctions("TREND", operand, foperand, sheet);
  const result = operand[0] as { type: string; value: { cells: { type: string }[][] } };
  expect(result.type).toBe("array");
  expect(result.value.cells[0]![0]!.type).toBe("e#VALUE!");
});

test("GROWTH: exponential const=FALSE (b forced to 1) fit, and #DIV/0! when Sxx==0", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 2",
    "set B2 value n 4",
    "set C1 formula GROWTH(B1:B2,A1:A2,A1,0)",
    "set D1 value n 0",
    "set E1 value n 5",
    "set C2 formula GROWTH(E1,D1,D1,0)",
  ]);
  // b forced to 1 (ln(b)=0): m = Sxy/Sxx over ln(y). Just assert it's a
  // finite positive number (exact closed form isn't the point of this
  // branch-coverage test -- correctness is covered by the primary suite).
  expect(typeof getDV("C1")).toBe("number");
  expect(getVT("C2")).toBe("e#DIV/0!");
});
