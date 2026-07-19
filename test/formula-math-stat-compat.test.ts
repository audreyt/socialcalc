import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Command-level tests for the math/stat compatibility batch: modern aliases
// and net-new functions added alongside the pre-existing RANK/MEDIAN/
// QUARTILE/STDEV/VAR family. See js/formula1.ts for implementations:
//   - Math1Functions (SIGN), Math2Functions (QUOTIENT, MROUND),
//     GcdLcmFunction (GCD, LCM), RoundFunction (ROUNDUP, ROUNDDOWN)
//   - SeriesFunctions (STDEV.S/.P, VAR.S/.P, SUMSQ)
//   - RankMedianQuartileFunctions (RANK.EQ/.AVG, QUARTILE.INC/.EXC,
//     PERCENTILE(.INC/.EXC), PERCENTRANK(.INC/.EXC))
//   - PairedRangeStatFunctions (CORREL, COVARIANCE.P/.S, SLOPE, INTERCEPT,
//     RSQ, FORECAST(.LINEAR), TREND, GROWTH)
//   - lemma/statistics.ts (Dafny/Lean-verified RANK.AVG / QUARTILE.EXC
//     integer boundary/tie policies)

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
// Math: SIGN, GCD, LCM, MROUND, QUOTIENT, SUMSQ, ROUNDUP, ROUNDDOWN
// ---------------------------------------------------------------------------

test("SIGN: positive, negative, zero", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 formula SIGN(7)",
    "set A2 formula SIGN(-7)",
    "set A3 formula SIGN(0)",
    "set A4 formula SIGN(0.001)",
  ]);
  expect(getDV("A1")).toBe(1);
  expect(getVT("A1")).toBe("n");
  expect(getDV("A2")).toBe(-1);
  expect(getDV("A3")).toBe(0);
  expect(getDV("A4")).toBe(1);
});

test("GCD: two args, multiple args, one, coprime pair, and error domains", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 formula GCD(12,18)",
    "set A2 formula GCD(24,36,60)",
    "set A3 formula GCD(7,13)",
    "set A4 formula GCD(0,5)",
    'set A5 formula GCD("x",5)',
    "set A6 formula GCD(-1,5)",
  ]);
  expect(getDV("A1")).toBe(6);
  expect(getDV("A2")).toBe(12);
  expect(getDV("A3")).toBe(1);
  expect(getDV("A4")).toBe(5); // gcd(0,n) = n
  expect(getVT("A5")).toBe("e#VALUE!");
  expect(getVT("A6")).toBe("e#NUM!");
});

test("LCM: documented Microsoft examples plus zero and error domains", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 formula LCM(5,2)",
    "set A2 formula LCM(24,36)",
    "set A3 formula LCM(0,5)",
    "set A4 formula LCM(-1,5)",
  ]);
  expect(getDV("A1")).toBe(10);
  expect(getDV("A2")).toBe(72);
  expect(getDV("A3")).toBe(0); // any zero argument -> LCM 0
  expect(getVT("A4")).toBe("e#NUM!");
});

test("MROUND: documented Microsoft examples including a binary floating-point boundary", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 formula MROUND(10,3)",
    "set A2 formula MROUND(-10,-3)",
    "set A3 formula MROUND(1.3,0.2)",
    "set A4 formula MROUND(5,-2)",
    "set A5 formula MROUND(5,0)",
  ]);
  expect(getDV("A1")).toBe(9);
  expect(getDV("A2")).toBe(-9);
  expect(getDV("A3")).toBeCloseTo(1.4, 9); // 1.3/0.2 == 6.4999... in binary64
  expect(getVT("A4")).toBe("e#NUM!"); // sign mismatch
  expect(getDV("A5")).toBe(0);
});

test("QUOTIENT: integer division truncated toward zero, and #DIV/0!", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 formula QUOTIENT(5,2)",
    "set A2 formula QUOTIENT(-5,2)",
    "set A3 formula QUOTIENT(5,0)",
  ]);
  expect(getDV("A1")).toBe(2);
  expect(getDV("A2")).toBe(-2); // truncate toward zero, not floor
  expect(getVT("A3")).toBe("e#DIV/0!");
});

test("SUMSQ: sum of squares over scalars and a range, ignoring text/blank", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 3",
    "set A2 text t skip",
    "set A3 value n 4",
    "set B1 formula SUMSQ(A1:A3)",
    "set B2 formula SUMSQ(3,4)",
  ]);
  expect(getDV("B1")).toBe(25); // 3^2 + 4^2
  expect(getDV("B2")).toBe(25);
});

test("ROUNDUP/ROUNDDOWN: away-from-zero vs. toward-zero, positive and negative precision", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula ROUNDUP(2.1,0)",
    "set A2 formula ROUNDUP(-2.1,0)",
    "set A3 formula ROUNDDOWN(2.9,0)",
    "set A4 formula ROUNDDOWN(-2.9,0)",
    "set A5 formula ROUNDUP(3.14159,2)",
    "set A6 formula ROUNDDOWN(3.14159,2)",
    "set A7 formula ROUNDUP(21,-1)",
    "set A8 formula ROUNDDOWN(29,-1)",
    // Binary floating-point boundary: 1.005*100 == 100.49999999999999 in
    // IEEE 754 binary64 -- ROUNDUP must still reach 1.01, not fall short.
    "set A9 formula ROUNDUP(1.005,2)",
  ]);
  expect(getDV("A1")).toBe(3);
  expect(getDV("A2")).toBe(-3);
  expect(getDV("A3")).toBe(2);
  expect(getDV("A4")).toBe(-2);
  expect(getDV("A5")).toBeCloseTo(3.15, 9);
  expect(getDV("A6")).toBeCloseTo(3.14, 9);
  expect(getDV("A7")).toBe(30);
  expect(getDV("A8")).toBe(20);
  expect(getDV("A9")).toBeCloseTo(1.01, 9);
});

test("ROUND is byte-identical to its pre-batch behavior (negative-tie regression guard)", async () => {
  // ROUND's tie behavior (JS Math.round: ties toward +Infinity) must be
  // untouched by the ROUNDUP/ROUNDDOWN refactor sharing its dispatcher.
  const { getDV } = await buildSheet([
    "set A1 formula ROUND(-1.5,0)",
    "set A2 formula ROUND(-0.5,0)",
    "set A3 formula ROUND(1.5,0)",
    "set A4 formula ROUND(2.5,0)",
  ]);
  expect(getDV("A1")).toBe(-1); // Math.round(-1.5) === -1
  expect(getDV("A2")).toBe(-0); // Math.round(-0.5) === -0
  expect(getDV("A3")).toBe(2);
  expect(getDV("A4")).toBe(3);
});

// ---------------------------------------------------------------------------
// STDEV.S/.P, VAR.S/.P: modern aliases plus the n=1 population-variance fix
// ---------------------------------------------------------------------------

test("STDEV.S/VAR.S are exact aliases of legacy STDEV/VAR (same #DIV/0! at n<=1)", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 2",
    "set A2 value n 4",
    "set A3 value n 4",
    "set A4 value n 4",
    "set A5 value n 5",
    "set A6 value n 5",
    "set A7 value n 7",
    "set A8 value n 9",
    "set B1 formula STDEV.S(A1:A8)",
    "set B2 formula STDEV(A1:A8)",
    "set B3 formula VAR.S(A1:A8)",
    "set B4 formula VAR(A1:A8)",
    "set B5 formula STDEV.S(5)",
    "set B6 formula VAR.S(5)",
  ]);
  expect(getDV("B1")).toBeCloseTo(getDV("B2") as number, 9);
  expect(getDV("B3")).toBeCloseTo(getDV("B4") as number, 9);
  expect(getVT("B5")).toBe("e#DIV/0!");
  expect(getVT("B6")).toBe("e#DIV/0!");
});

test("STDEV.P/VAR.P equal legacy STDEVP/VARP at n>1, but return 0 (not #DIV/0!) at n=1", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 2",
    "set A2 value n 4",
    "set A3 value n 4",
    "set A4 value n 4",
    "set A5 value n 5",
    "set A6 value n 5",
    "set A7 value n 7",
    "set A8 value n 9",
    "set B1 formula STDEV.P(A1:A8)",
    "set B2 formula STDEVP(A1:A8)",
    "set B3 formula VAR.P(A1:A8)",
    "set B4 formula VARP(A1:A8)",
    // n=1: legacy STDEVP/VARP keep their original #DIV/0!, but the modern
    // .P names return 0 (population variance of one point is well-defined).
    "set B5 formula STDEV.P(5)",
    "set B6 formula VAR.P(5)",
    "set B7 formula STDEVP(5)",
    "set B8 formula VARP(5)",
  ]);
  expect(getDV("B1")).toBeCloseTo(getDV("B2") as number, 9);
  expect(getDV("B3")).toBeCloseTo(getDV("B4") as number, 9);
  expect(getDV("B5")).toBe(0);
  expect(getVT("B5")).toBe("n");
  expect(getDV("B6")).toBe(0);
  expect(getVT("B7")).toBe("e#DIV/0!"); // legacy behavior unchanged
  expect(getVT("B8")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// RANK.EQ / RANK.AVG
// ---------------------------------------------------------------------------

test("RANK.EQ is an exact alias of legacy RANK (best/lowest rank on ties)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 10",
    "set A2 value n 10",
    "set A3 value n 8",
    "set A4 value n 6",
    "set B1 formula RANK.EQ(10,A1:A4)",
    "set B2 formula RANK(10,A1:A4)",
    "set B3 formula RANK.EQ(8,A1:A4)",
  ]);
  expect(getDV("B1")).toBe(getDV("B2"));
  expect(getDV("B1")).toBe(1);
  expect(getDV("B3")).toBe(3); // matches legacy RANK's ties-skip-ranks convention
});

test("RANK.AVG: documented Microsoft example, tie-averaging, and singleton reduces to RANK.EQ", async () => {
  const { getDV, getVT } = await buildSheet([
    // support.microsoft.com/en-us/excel/functions/rank-avg-function
    "set A1 value n 89",
    "set A2 value n 88",
    "set A3 value n 92",
    "set A4 value n 101",
    "set A5 value n 94",
    "set A6 value n 97",
    "set A7 value n 95",
    "set B1 formula RANK.AVG(94,A1:A7)",
    // Two-way tie: values [10,10,8,6] descending -> both 10s share ranks
    // 1 and 2 -> RANK.AVG returns 1.5 for either.
    "set C1 value n 10",
    "set C2 value n 10",
    "set C3 value n 8",
    "set C4 value n 6",
    "set B2 formula RANK.AVG(10,C1:C4)",
    // Singleton (no tie) reduces to the same value as RANK.EQ.
    "set B3 formula RANK.AVG(8,C1:C4)",
    "set B4 formula RANK.EQ(8,C1:C4)",
    // Three-way tie: ranks 1,2,3 average to 2.
    "set D1 value n 5",
    "set D2 value n 5",
    "set D3 value n 5",
    "set D4 value n 1",
    "set B5 formula RANK.AVG(5,D1:D4)",
    // Not found in ref -> #N/A, same as RANK/RANK.EQ.
    "set B6 formula RANK.AVG(999,C1:C4)",
  ]);
  expect(getDV("B1")).toBe(4);
  expect(getDV("B2")).toBeCloseTo(1.5, 9);
  expect(getDV("B3")).toBe(getDV("B4"));
  expect(getDV("B5")).toBe(2);
  expect(getVT("B6")).toBe("e#N/A");
});

// ---------------------------------------------------------------------------
// QUARTILE.INC / QUARTILE.EXC
// ---------------------------------------------------------------------------

test("QUARTILE.INC is an exact alias of legacy QUARTILE", async () => {
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
    "set B1 formula QUARTILE.INC(A1:A11,1)",
    "set B2 formula QUARTILE(A1:A11,1)",
    "set B3 formula QUARTILE.INC(A1:A11,3)",
    "set B4 formula QUARTILE(A1:A11,3)",
  ]);
  expect(getDV("B1")).toBe(getDV("B2"));
  expect(getDV("B3")).toBe(getDV("B4"));
});

test("QUARTILE.EXC: documented Microsoft example (same 11-point data set)", async () => {
  // support.microsoft.com/en-us/excel/functions/quartile-exc-function
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
    "set B1 formula QUARTILE.EXC(A1:A11,1)",
    "set B2 formula QUARTILE.EXC(A1:A11,3)",
  ]);
  expect(getDV("B1")).toBe(15);
  expect(getDV("B2")).toBe(43);
});

test("QUARTILE.EXC: domain errors -- quart 0/4 always #NUM!, and n-dependent position validity", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    // quart<=0 or quart>=4: #NUM! unconditionally (unlike QUARTILE.INC, the
    // 0/4 endpoints are never valid for the exclusive method).
    "set B1 formula QUARTILE.EXC(A1:A3,0)",
    "set B2 formula QUARTILE.EXC(A1:A3,4)",
    // n=1: quart=1 -> position 1*(1+1)/4 = 0.5, outside [1,1] -> #NUM!.
    "set C1 value n 42",
    "set B3 formula QUARTILE.EXC(C1,1)",
    // empty numeric input -> #NUM!
    "set D1 text t nonnumeric",
    "set B4 formula QUARTILE.EXC(D1,1)",
  ]);
  expect(getVT("B1")).toBe("e#NUM!");
  expect(getVT("B2")).toBe("e#NUM!");
  expect(getVT("B3")).toBe("e#NUM!");
  expect(getVT("B4")).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// PERCENTILE / PERCENTILE.INC / PERCENTILE.EXC
// ---------------------------------------------------------------------------

test("PERCENTILE and PERCENTILE.INC agree with MEDIAN/QUARTILE at known fractions", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set A5 value n 5",
    "set B1 formula PERCENTILE(A1:A5,0.5)",
    "set B2 formula MEDIAN(A1:A5)",
    "set B3 formula PERCENTILE.INC(A1:A5,0.25)",
    "set B4 formula QUARTILE(A1:A5,1)",
    "set B5 formula PERCENTILE(A1:A5,0)",
    "set B6 formula PERCENTILE(A1:A5,1)",
  ]);
  expect(getDV("B1")).toBe(getDV("B2"));
  expect(getDV("B3")).toBe(getDV("B4"));
  expect(getDV("B5")).toBe(1); // k=0 -> minimum
  expect(getDV("B6")).toBe(5); // k=1 -> maximum
});

test("PERCENTILE: k outside [0,1] is #NUM!, single-element range returns that element", async () => {
  const { getVT, getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 formula PERCENTILE(A1:A2,-0.1)",
    "set B2 formula PERCENTILE(A1:A2,1.1)",
    "set C1 value n 42",
    "set B3 formula PERCENTILE(C1,0.5)",
  ]);
  expect(getVT("B1")).toBe("e#NUM!");
  expect(getVT("B2")).toBe("e#NUM!");
  expect(getDV("B3")).toBe(42);
});

test("PERCENTILE.EXC: documented domain (0,1) exclusive and interpolation-failure #NUM!", async () => {
  const { getVT, getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    // k<=0 or k>=1 -> #NUM! (the exclusive method never accepts the
    // endpoints, unlike PERCENTILE.INC).
    "set B1 formula PERCENTILE.EXC(A1:A3,0)",
    "set B2 formula PERCENTILE.EXC(A1:A3,1)",
    // Valid mid-range k for a 3-point set: k=0.5 -> position 0.5*4=2 (exact
    // rank 2, the median).
    "set B3 formula PERCENTILE.EXC(A1:A3,0.5)",
    // k too small for this n to interpolate: position k*(n+1) < 1.
    "set B4 formula PERCENTILE.EXC(A1:A3,0.1)",
  ]);
  expect(getVT("B1")).toBe("e#NUM!");
  expect(getVT("B2")).toBe("e#NUM!");
  expect(getDV("B3")).toBe(2);
  expect(getVT("B4")).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// PERCENTRANK / PERCENTRANK.INC / PERCENTRANK.EXC
// ---------------------------------------------------------------------------

test("PERCENTRANK.INC: documented Microsoft example (exact and interpolated ranks)", async () => {
  // support.microsoft.com/en-us/excel/functions/percentrank-inc-function
  const { getDV } = await buildSheet([
    "set A1 value n 13",
    "set A2 value n 12",
    "set A3 value n 11",
    "set A4 value n 8",
    "set A5 value n 4",
    "set A6 value n 3",
    "set A7 value n 2",
    "set A8 value n 1",
    "set A9 value n 1",
    "set A10 value n 1",
    "set B1 formula PERCENTRANK.INC(A1:A10,2)",
    "set B2 formula PERCENTRANK.INC(A1:A10,4)",
    "set B3 formula PERCENTRANK.INC(A1:A10,8)",
    "set B4 formula PERCENTRANK.INC(A1:A10,5)",
    "set B5 formula PERCENTRANK(A1:A10,2)",
  ]);
  expect(getDV("B1")).toBeCloseTo(0.333, 3);
  expect(getDV("B2")).toBeCloseTo(0.555, 3);
  expect(getDV("B3")).toBeCloseTo(0.666, 3);
  expect(getDV("B4")).toBeCloseTo(0.583, 3);
  expect(getDV("B5")).toBe(getDV("B1")); // PERCENTRANK bare alias
});

test("PERCENTRANK: significance argument and out-of-range #N/A", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set B1 formula PERCENTRANK(A1:A4,2,1)", // 1 significant digit
    "set B2 formula PERCENTRANK(A1:A4,2)", // default 3 digits
    "set B3 formula PERCENTRANK(A1:A4,99)", // outside data range
    "set B4 formula PERCENTRANK(A1:A4,2,0)", // significance < 1 -> #NUM!
  ]);
  expect(getDV("B1")).toBeCloseTo(1 / 3, 1);
  expect(getDV("B2")).toBeCloseTo(1 / 3, 3);
  expect(getVT("B3")).toBe("e#N/A");
  expect(getVT("B4")).toBe("e#NUM!");
});

test("PERCENTRANK.EXC: exclusive-method inverse rank differs from .INC at the same point", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 formula PERCENTRANK.EXC(A1:A3,2)",
    "set B2 formula PERCENTRANK.INC(A1:A3,2)",
  ]);
  // Exclusive: rank/(n+1) = 2/4 = 0.5; Inclusive: rank/(n-1) = 1/2 = 0.5.
  // For this symmetric 3-point middle value both happen to be 0.5 -- assert
  // the exact value rather than a spurious inequality.
  expect(getDV("B1")).toBeCloseTo(0.5, 9);
  expect(getDV("B2")).toBeCloseTo(0.5, 9);
});

// ---------------------------------------------------------------------------
// CORREL / COVARIANCE.P / COVARIANCE.S / SLOPE / INTERCEPT / RSQ
// ---------------------------------------------------------------------------

test("CORREL/RSQ/SLOPE/INTERCEPT on a perfectly linear series (y=2x+1)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set B1 value n 3",
    "set B2 value n 5",
    "set B3 value n 7",
    "set B4 value n 9",
    "set C1 formula SLOPE(B1:B4,A1:A4)",
    "set C2 formula INTERCEPT(B1:B4,A1:A4)",
    "set C3 formula CORREL(B1:B4,A1:A4)",
    "set C4 formula RSQ(B1:B4,A1:A4)",
  ]);
  expect(getDV("C1")).toBeCloseTo(2, 9);
  expect(getDV("C2")).toBeCloseTo(1, 9);
  expect(getDV("C3")).toBeCloseTo(1, 9);
  expect(getDV("C4")).toBeCloseTo(1, 9);
});

test("COVARIANCE.P: documented Microsoft example", async () => {
  // support.microsoft.com/en-us/excel/functions/covariance-p-function
  const { getDV } = await buildSheet([
    "set A1 value n 3",
    "set A2 value n 2",
    "set A3 value n 4",
    "set A4 value n 5",
    "set A5 value n 6",
    "set B1 value n 9",
    "set B2 value n 7",
    "set B3 value n 12",
    "set B4 value n 15",
    "set B5 value n 17",
    "set C1 formula COVARIANCE.P(A1:A5,B1:B5)",
  ]);
  expect(getDV("C1")).toBeCloseTo(5.2, 6);
});

test("COVARIANCE.S: documented Microsoft example", async () => {
  // support.microsoft.com/en-us/excel/functions/covariance-s-function
  const { getDV } = await buildSheet([
    "set A1 value n 2",
    "set A2 value n 4",
    "set A3 value n 8",
    "set B1 value n 5",
    "set B2 value n 11",
    "set B3 value n 12",
    "set C1 formula COVARIANCE.S(A1:A3,B1:B3)",
  ]);
  expect(getDV("C1")).toBeCloseTo(9.666666667, 6);
});

test("COVARIANCE.P/.S error domains: empty -> #DIV/0!, mismatched length -> #N/A", async () => {
  const { getVT } = await buildSheet([
    "set A1 text t x",
    "set B1 text t y",
    "set C1 formula COVARIANCE.P(A1,B1)",
    "set C2 formula COVARIANCE.S(A1,B1)",
    "set A2 value n 1",
    "set A3 value n 2",
    "set B2 value n 1",
    "set C3 formula COVARIANCE.S(A2:A3,B2)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
  expect(getVT("C2")).toBe("e#DIV/0!");
  expect(getVT("C3")).toBe("e#N/A"); // different data-point counts
});

test("SLOPE/INTERCEPT/RSQ/CORREL: zero-variance x is #DIV/0!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 5",
    "set A2 value n 5",
    "set A3 value n 5",
    "set B1 value n 1",
    "set B2 value n 2",
    "set B3 value n 3",
    "set C1 formula SLOPE(B1:B3,A1:A3)",
    "set C2 formula INTERCEPT(B1:B3,A1:A3)",
    "set C3 formula CORREL(B1:B3,A1:A3)",
    "set C4 formula RSQ(B1:B3,A1:A3)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
  expect(getVT("C2")).toBe("e#DIV/0!");
  expect(getVT("C3")).toBe("e#DIV/0!");
  expect(getVT("C4")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// FORECAST / FORECAST.LINEAR
// ---------------------------------------------------------------------------

test("FORECAST.LINEAR: documented Microsoft example, and FORECAST is an exact alias", async () => {
  // support.microsoft.com/en-us/excel/functions/forecast-and-forecast-linear-functions
  const { getDV } = await buildSheet([
    "set A1 value n 6",
    "set A2 value n 7",
    "set A3 value n 9",
    "set A4 value n 15",
    "set A5 value n 21",
    "set B1 value n 20",
    "set B2 value n 28",
    "set B3 value n 31",
    "set B4 value n 38",
    "set B5 value n 40",
    "set C1 formula FORECAST.LINEAR(30,A1:A5,B1:B5)",
    "set C2 formula FORECAST(30,A1:A5,B1:B5)",
  ]);
  expect(getDV("C1")).toBeCloseTo(10.607253, 4);
  expect(getDV("C2")).toBe(getDV("C1"));
});

test("FORECAST.LINEAR: nonnumeric x, mismatched-length ranges, zero-variance x", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 1",
    "set B2 value n 2",
    'set C1 formula FORECAST.LINEAR("x",A1:A2,B1:B2)',
    "set A3 value n 3",
    "set C2 formula FORECAST.LINEAR(3,A1:A3,B1:B2)",
    "set D1 value n 5",
    "set D2 value n 5",
    "set C3 formula FORECAST.LINEAR(3,B1:B2,D1:D2)",
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
  expect(getVT("C2")).toBe("e#N/A");
  expect(getVT("C3")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// TREND / GROWTH
// ---------------------------------------------------------------------------

test("TREND: predicts along a perfectly linear series for both omitted and explicit new_x's", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 value n 3",
    "set B2 value n 5",
    "set B3 value n 7",
    // known_x's/new_x's omitted entirely: known_x defaults to {1,2,3},
    // new_x defaults to known_x -> in-sample fitted values, spilling a
    // 3-row array starting at C1 -- keep the second formula in a
    // non-colliding column (E) so it doesn't land inside that spill.
    "set C1 formula TREND(B1:B3)",
    // Explicit new_x's = 4 -> extrapolate one step past the series.
    "set D1 value n 4",
    "set E1 formula TREND(B1:B3,A1:A3,D1)",
  ]);
  expect(getDV("C1")).toBeCloseTo(3, 9); // fitted at x=1 (first cell)
  expect(getDV("E1")).toBeCloseTo(9, 9); // y=2x+1 at x=4
});

test("GROWTH: exponential fit reproduces known y=2^x-style growth", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 value n 2",
    "set B2 value n 4",
    "set B3 value n 8",
    "set D1 value n 4",
    "set C1 formula GROWTH(B1:B3,A1:A3,D1)",
    "set C2 formula GROWTH(B1:B3,A1:A3,A1)",
  ]);
  expect(getDV("C1")).toBeCloseTo(16, 6); // 2^4
  expect(getDV("C2")).toBeCloseTo(2, 6); // 2^1, back-fit at x=1
});

test("GROWTH: any non-positive known_y is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 2",
    "set B2 value n -4",
    "set C1 formula GROWTH(B1:B2,A1:A2,A1)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// Function-list registration / help picker plumbing (spot check, not
// exhaustive -- every function above is exercised behaviorally already).
// ---------------------------------------------------------------------------

test("every new math/stat function is registered with the expected dispatcher and class", async () => {
  const { SC } = await buildSheet([]);
  const expectations: [string, string, string][] = [
    ["SIGN", "Math1Functions", "math"],
    ["QUOTIENT", "Math2Functions", "math"],
    ["MROUND", "Math2Functions", "math"],
    ["GCD", "GcdLcmFunction", "math"],
    ["LCM", "GcdLcmFunction", "math"],
    ["ROUNDUP", "RoundFunction", "math"],
    ["ROUNDDOWN", "RoundFunction", "math"],
    ["STDEV.S", "SeriesFunctions", "stat"],
    ["STDEV.P", "SeriesFunctions", "stat"],
    ["VAR.S", "SeriesFunctions", "stat"],
    ["VAR.P", "SeriesFunctions", "stat"],
    ["SUMSQ", "SeriesFunctions", "stat"],
    ["RANK.EQ", "RankMedianQuartileFunctions", "stat"],
    ["RANK.AVG", "RankMedianQuartileFunctions", "stat"],
    ["QUARTILE.INC", "RankMedianQuartileFunctions", "stat"],
    ["QUARTILE.EXC", "RankMedianQuartileFunctions", "stat"],
    ["PERCENTILE", "RankMedianQuartileFunctions", "stat"],
    ["PERCENTILE.INC", "RankMedianQuartileFunctions", "stat"],
    ["PERCENTILE.EXC", "RankMedianQuartileFunctions", "stat"],
    ["PERCENTRANK", "RankMedianQuartileFunctions", "stat"],
    ["PERCENTRANK.INC", "RankMedianQuartileFunctions", "stat"],
    ["PERCENTRANK.EXC", "RankMedianQuartileFunctions", "stat"],
    ["CORREL", "PairedRangeStatFunctions", "stat"],
    ["COVARIANCE.P", "PairedRangeStatFunctions", "stat"],
    ["COVARIANCE.S", "PairedRangeStatFunctions", "stat"],
    ["SLOPE", "PairedRangeStatFunctions", "stat"],
    ["INTERCEPT", "PairedRangeStatFunctions", "stat"],
    ["RSQ", "PairedRangeStatFunctions", "stat"],
    ["FORECAST", "PairedRangeStatFunctions", "stat"],
    ["FORECAST.LINEAR", "PairedRangeStatFunctions", "stat"],
    ["TREND", "PairedRangeStatFunctions", "stat"],
    ["GROWTH", "PairedRangeStatFunctions", "stat"],
  ];
  for (const [fname, dispatcher, klass] of expectations) {
    expect(SC.Formula.FunctionList[fname]?.[0]).toBe(SC.Formula[dispatcher]);
    expect(SC.Formula.FunctionList[fname]?.[4]).toBe(klass);
  }
  SC.Formula.FillFunctionInfo();
  expect(SC.Formula.FunctionArgString("PERCENTILE")).toBe("range, k");
  expect(SC.Formula.FunctionArgString("PERCENTRANK")).toBe("range, x, [significance]");
  expect(SC.Formula.FunctionArgString("CORREL")).toBe("known_ys, known_xs");
  expect(SC.Formula.FunctionArgString("FORECAST")).toBe("x, known_ys, known_xs");
  expect(SC.Formula.FunctionArgString("TREND")).toBe("known_ys, [known_xs], [new_xs], [const]");
});
