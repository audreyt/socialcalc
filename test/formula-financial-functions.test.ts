import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Focused command-level tests for PPMT/IPMT/MIRR/XNPV/XIRR. See
// js/formula1.ts SocialCalc.Formula.PPMTIPMTFunctions / MIRRFunction /
// XNPVFunction / XIRRFunction for the implementation and
// js/socialcalcconstants.ts for help/arg text (s_fdef_PPMT, s_fdef_IPMT,
// s_fdef_MIRR, s_fdef_XNPV, s_fdef_XIRR, s_farg_ppmt, s_farg_mirr,
// s_farg_xnpv, s_farg_xirr).

type Cell = { datavalue: any; valuetype: string };

function resetFormulaGlobals(SC: any) {
  // Mirrors test/formula-rank-median-quartile.test.ts.
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
// PPMT / IPMT
// ---------------------------------------------------------------------------

test("PPMT/IPMT: Excel documented example (10%/12 rate, 36 periods, pv 8000)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula IPMT(0.1/12,1,36,8000)",
    "set A2 formula PPMT(0.1/12,1,36,8000)",
    "set A3 formula IPMT(0.1/12,36,36,8000)",
    "set A4 formula PPMT(0.1/12,36,36,8000)",
  ]);
  expect(getDV("A1")).toBeCloseTo(-66.66666666666667, 9);
  expect(getDV("A2")).toBeCloseTo(-191.47083088403429, 9);
  expect(getDV("A3")).toBeCloseTo(-2.1333677483528994, 9);
  expect(getDV("A4")).toBeCloseTo(-256.0041298023481, 9);
});

test("PPMT/IPMT: sum across every period equals PMT for the same annuity", async () => {
  const { SC, sheet } = await buildSheet([]);
  const pmt = SC.Formula.InterestFunctions
    ? null // placeholder, computed via sheet below
    : null;
  void pmt;
  await scheduleCommands(SC, sheet, ["set Z1 formula PMT(0.08,10,-5000)"], true, 4000);
  await recalcSheet(SC, sheet, 4000);
  const expectedPmt = (sheet.GetAssuredCell("Z1") as Cell).datavalue;

  const rows: string[] = [];
  for (let per = 1; per <= 10; per++) {
    rows.push(`set A${per} formula IPMT(0.08,${per},10,-5000) + PPMT(0.08,${per},10,-5000)`);
  }
  await scheduleCommands(SC, sheet, rows, true, 4000);
  await recalcSheet(SC, sheet, 4000);
  for (let per = 1; per <= 10; per++) {
    expect((sheet.GetAssuredCell(`A${per}`) as Cell).datavalue).toBeCloseTo(expectedPmt, 9);
  }
});

test("PPMT/IPMT: first-period interest is 0 when paytype=1 (beginning of period)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula IPMT(0.1/12,1,36,8000,0,1)",
    "set A2 formula PPMT(0.1/12,1,36,8000,0,1)",
    "set A3 formula PMT(0.1/12,36,8000,0,1)",
  ]);
  expect(getDV("A1")).toBe(0);
  expect(getDV("A2")).toBeCloseTo(getDV("A3"), 9);
});

test("PPMT/IPMT: interior/last period with paytype=1 divides accrued interest by (1+rate)", async () => {
  // Beginning-of-period annuity: only the very first period's interest is 0
  // (tested above). Every later period still accrues interest on the
  // balance, adjusted by the (1+rate) discount that offsets the payment
  // having already been applied at the start of the prior period.
  const { getDV } = await buildSheet([
    "set A1 formula IPMT(0.1/12,2,36,8000,0,1)",
    "set A2 formula PPMT(0.1/12,2,36,8000,0,1)",
    "set A3 formula IPMT(0.1/12,36,36,8000,0,1)",
    "set A4 formula PPMT(0.1/12,36,36,8000,0,1)",
    "set A5 formula PMT(0.1/12,36,8000,0,1)",
  ]);
  expect(getDV("A1")).not.toBe(0);
  expect(getDV("A1") + getDV("A2")).toBeCloseTo(getDV("A5"), 9);
  expect(getDV("A3") + getDV("A4")).toBeCloseTo(getDV("A5"), 9);
});

test("PPMT/IPMT: rate=0 splits payment evenly with zero interest every period", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula IPMT(0,1,10,1000)",
    "set A2 formula PPMT(0,1,10,1000)",
    "set A3 formula IPMT(0,10,10,1000)",
    "set A4 formula PPMT(0,10,10,1000)",
  ]);
  expect(getDV("A1")).toBeCloseTo(0, 12);
  expect(getDV("A2")).toBe(-100);
  expect(getDV("A3")).toBeCloseTo(0, 12);
  expect(getDV("A4")).toBe(-100);
});

test("PPMT/IPMT: fv provided without paytype (5-arg call) defaults paytype to 0", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula PPMT(0.1,1,10,1000,500)",
    "set A2 formula PPMT(0.1,1,10,1000,500,0)",
  ]);
  expect(getDV("A1")).toBeCloseTo(getDV("A2"), 12);
});

test("PPMT/IPMT: explicit paytype=0 (falsy but provided) matches the omitted-paytype default", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula PPMT(0.1,1,10,1000,0,0)",
    "set A2 formula PPMT(0.1,1,10,1000)",
  ]);
  expect(getDV("A1")).toBeCloseTo(getDV("A2"), 12);
});

test("PPMT/IPMT: per outside [1,nper] domain and non-integer per are #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula PPMT(0.1,0,10,1000)", // per < 1
    "set A2 formula PPMT(0.1,11,10,1000)", // per > nper
    "set A3 formula PPMT(0.1,-1,10,1000)", // negative per
    "set A4 formula PPMT(0.1,1.5,10,1000)", // non-integer per
    "set A5 formula PPMT(0.1,1,0,1000)", // nper <= 0
    "set B1 formula IPMT(0.1,0,10,1000)",
    "set B2 formula IPMT(0.1,11,10,1000)",
  ]);
  for (const c of ["A1", "A2", "A3", "A4", "A5", "B1", "B2"]) {
    expect(getVT(c)).toBe("e#NUM!");
  }
});

test("PPMT/IPMT: text/error argument propagation and arity", async () => {
  const { getVT } = await buildSheet([
    'set A1 formula PPMT("x",1,10,1000)',
    "set A2 formula PPMT(1/0,1,10,1000)",
    "set A3 formula PPMT(0.1,1,10)", // missing required pv
    "set A4 formula PPMT(0.1,1,10,1000,0,1,99)", // too many args
  ]);
  expect(getVT("A1")).toBe("e#VALUE!");
  expect(getVT("A2")).toBe("e#DIV/0!");
  expect(getVT("A3")).toBe("e#VALUE!");
  expect(getVT("A4")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// MIRR
// ---------------------------------------------------------------------------

test("MIRR: Excel documented example (12.61%)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -120000",
    "set A2 value n 39000",
    "set A3 value n 30000",
    "set A4 value n 21000",
    "set A5 value n 37000",
    "set A6 value n 46000",
    "set B1 formula MIRR(A1:A6,0.1,0.12)",
  ]);
  expect(getDV("B1")).toBeCloseTo(0.1260941303659051, 9);
});

test("MIRR: requires at least one positive and one negative flow", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 100",
    "set A2 value n 200",
    "set A3 value n 300",
    "set B1 formula MIRR(A1:A3,0.1,0.12)",
    "set A4 value n -100",
    "set A5 value n -200",
    "set B2 formula MIRR(A4:A5,0.1,0.12)",
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#DIV/0!");
});

test("MIRR: fewer than two periods is #DIV/0!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set B1 formula MIRR(A1:A1,0.1,0.12)",
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("MIRR: exactly two periods is valid (not rejected as fewer-than-two)", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 200",
    "set B1 formula MIRR(A1:A2,0.1,0.12)",
  ]);
  expect(getVT("B1")).not.toBe("e#DIV/0!");
  // Closed form for n=2: exponent is 1/(n-1)=1, so MIRR = posfv/-negpv - 1
  // with negpv=-100, posfv=200*(1.12)^0=200 -> 200/100 - 1 = 1.
  expect(getDV("B1")).toBeCloseTo(1, 12);
});

test("MIRR: exact value with the negative flow away from index 0 (pins financerate discounting and reinvestrate compounding independently)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 100",
    "set A2 value n -50",
    "set A3 value n 0",
    "set A4 value n 200",
    "set B1 formula MIRR(A1:A4,0.1,0.12)",
  ]);
  const negpv = -50 / Math.pow(1.1, 1);
  const posfv = 100 * Math.pow(1.12, 3) + 200 * Math.pow(1.12, 0);
  const expected = Math.pow(-posfv / negpv, 1 / 3) - 1;
  expect(getDV("B1")).toBeCloseTo(expected, 9);
});

test("MIRR: blank and text cashflow members count as 0 (matching NPV/IRR convention)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -1000",
    // A2 left blank
    "set A3 text t skip",
    "set A4 value n 1200",
    "set B1 formula MIRR(A1:A4,0.05,0.05)",
  ]);
  expect(typeof getDV("B1")).toBe("number");
});

test("MIRR: error in range propagates as e#VALUE!, and text/error finance rates propagate", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 formula 1/0",
    "set A3 value n 200",
    "set B1 formula MIRR(A1:A3,0.1,0.12)",
    "set A4 value n -100",
    "set A5 value n 200",
    'set B2 formula MIRR(A4:A5,"x",0.12)',
    "set B3 formula MIRR(A4:A5,1/0,0.12)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#DIV/0!");
});

test("MIRR: text/error reinvest_rate propagates its error type", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 200",
    'set B1 formula MIRR(A1:A2,0.1,"x")',
    "set B2 formula MIRR(A1:A2,0.1,1/0)",
  ]);
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#DIV/0!");
});

test("MIRR: a range with no numeric cashflow at all is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 text t skip",
    // A2 left blank
    "set A3 text t also-skip",
    "set B1 formula MIRR(A1:A3,0.1,0.12)",
  ]);
  expect(getVT("B1")).toBe("e#NUM!");
});

test("MIRRFunction: an unsupported cell valuetype (neither numeric/blank/text/error) is silently skipped", async () => {
  // Direct-invocation defensive-code test mirroring
  // formula1-coverage-gaps-3.test.ts's "IRRFunction: unsupported cashflow
  // type falls through to e#NUM!": MIRR's range-collection loop shares
  // IRR's numeric/blank-text/error trichotomy, so a cell whose valuetype is
  // none of those (not producible through normal formula evaluation, but a
  // defensive fallback all the same) is silently dropped from the schedule
  // rather than corrupting the period index. With every real cell skipped,
  // the schedule ends up empty and the surrounding hasNumericCashflow guard
  // (already covered by the all-text/blank test above) reports #NUM!.
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  const cell = sheet.GetAssuredCell("A1") as Cell;
  cell.valuetype = "x";
  cell.datavalue = "not-a-cashflow";

  const operand: { type: string; value: unknown }[] = [];
  SC.Formula.MIRRFunction(
    "MIRR",
    operand,
    [
      { type: "n", value: 0.12 },
      { type: "n", value: 0.1 },
      { type: "range", value: "A1|A1|" },
    ],
    sheet,
  );
  expect(operand[0]).toMatchObject({ type: "e#NUM!", value: 0 });
});

test("MIRR: finance_rate at -1 is #DIV/0!, and arity is enforced", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 200",
    "set B1 formula MIRR(A1:A2,-1,0.12)",
    "set B2 formula MIRR(A1:A2,0.1)",
    "set B3 formula MIRR(A1:A2,0.1,0.12,99)",
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// XNPV
// ---------------------------------------------------------------------------

test("XNPV: Excel documented example (2086.65 at 9%)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -10000",
    "set A2 value n 2750",
    "set A3 value n 4250",
    "set A4 value n 3250",
    "set A5 value n 2750",
    "set B1 formula DATE(2008,1,1)",
    "set B2 formula DATE(2008,3,1)",
    "set B3 formula DATE(2008,10,30)",
    "set B4 formula DATE(2009,2,15)",
    "set B5 formula DATE(2009,4,1)",
    "set C1 formula XNPV(0.09,A1:A5,B1:B5)",
  ]);
  expect(getDV("C1")).toBeCloseTo(2086.64760203123, 6);
});

test("XNPV: text/error rate argument propagates its error type", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 200",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    'set C1 formula XNPV("x",A1:A2,B1:B2)',
    "set C2 formula XNPV(1/0,A1:A2,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
  expect(getVT("C2")).toBe("e#DIV/0!");
});

test("XNPV: zero rate equals the plain undiscounted sum of cashflows", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -1000",
    "set A2 value n 400",
    "set A3 value n 700",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set B3 formula DATE(2021,1,1)",
    "set C1 formula XNPV(0,A1:A3,B1:B3)",
  ]);
  expect(getDV("C1")).toBeCloseTo(100, 9);
});

test("XNPV: first/last period discounting matches the actual-day/365 formula directly", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 50",
    "set A3 value n 80",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,4,1)", // 91 days later
    "set B3 formula DATE(2021,1,1)", // 366 days later (2020 is a leap year)
    "set C1 formula XNPV(0.08,A1:A3,B1:B3)",
  ]);
  const expected = -100 + 50 / Math.pow(1.08, 91 / 365) + 80 / Math.pow(1.08, 366 / 365);
  expect(getDV("C1")).toBeCloseTo(expected, 9);
});

test("XNPV: dates need not be strictly ascending, only >= the anchor date (dates[0])", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 30",
    "set A3 value n 80",
    "set B1 formula DATE(2020,1,1)", // anchor -- earliest chronologically
    "set B2 formula DATE(2020,9,1)", // later date first...
    "set B3 formula DATE(2020,4,1)", // ...then an earlier (but still >= anchor) date
    "set C1 formula XNPV(0.1,A1:A3,B1:B3)",
  ]);
  const d2 = Math.round((Date.UTC(2020, 8, 1) - Date.UTC(2020, 0, 1)) / 86400000);
  const d3 = Math.round((Date.UTC(2020, 3, 1) - Date.UTC(2020, 0, 1)) / 86400000);
  const expected = -100 + 30 / Math.pow(1.1, d2 / 365) + 80 / Math.pow(1.1, d3 / 365);
  expect(getDV("C1")).toBeCloseTo(expected, 6);
});

test("XNPV: duplicate dates are allowed (zero time difference contributes undiscounted)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -1000",
    "set A2 value n 1000",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,1,1)",
    "set C1 formula XNPV(0.1,A1:A2,B1:B2)",
  ]);
  expect(getDV("C1")).toBeCloseTo(0, 9);
});

test("XNPV: mismatched values/dates shape is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 100",
    "set A3 value n 50",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XNPV(0.1,A1:A3,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
});

test("XNPV: rate <= -1 is #NUM!, and a non-numeric date member is #VALUE!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 200",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XNPV(-1,A1:A2,B1:B2)",
    "set A3 value n -100",
    "set A4 value n 200",
    "set B3 formula DATE(2020,1,1)",
    'set B4 text t "not a date"',
    "set C2 formula XNPV(0.1,A3:A4,B3:B4)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
  expect(getVT("C2")).toBe("e#VALUE!");
});

test("XNPV: date before the anchor date is #NUM! (Excel/Sheets domain restriction)", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 50",
    "set A3 value n -50", // this date precedes the anchor B1
    "set B1 formula DATE(2020,6,1)",
    "set B2 formula DATE(2020,9,1)",
    "set B3 formula DATE(2020,1,1)",
    "set C1 formula XNPV(0.1,A1:A3,B1:B3)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
});

test("XNPV: error in a cashflow or date member propagates the first error", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 formula 1/0",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XNPV(0.1,A1:A2,B1:B2)",
    "set B3 formula DATE(2020,1,1)",
    "set B4 formula NA()",
    "set A3 value n -100",
    "set A4 value n 100",
    "set C2 formula XNPV(0.1,A3:A4,B3:B4)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
  expect(getVT("C2")).toBe("e#N/A");
});

test("XNPV: a blank cashflow value and a blank anchor date both collapse to 0", async () => {
  // A1 is left blank so the corresponding cashflow value takes the at=='n'
  // false branch (collapses to 0, same convention as NPV). B1 is left blank
  // so the anchor date takes the bt=='n' false branch (collapses to day 0);
  // being the anchor (i==0), the "date before anchor" check never applies
  // to it. Both members contribute 0/no-discount, so the whole expression
  // reduces to a plain single-period discount of A2 over B2's date value --
  // computed here from the engine's own DATE() serial (D1), not a
  // hand-derived epoch assumption.
  const { getDV } = await buildSheet([
    // A1 and B1 left blank
    "set A2 value n 50",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XNPV(0.1,A1:A2,B1:B2)",
    "set D1 formula 50/POWER(1.1,B2/365)",
  ]);
  expect(getDV("C1")).toBeCloseTo(getDV("D1"), 9);
});

test("XNPV: arity is enforced (exactly 3 args)", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 100",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XNPV(0.1,A1:A2)",
    "set C2 formula XNPV(0.1,A1:A2,B1:B2,99)",
  ]);
  expect(getVT("C1")).toBe("e#VALUE!");
  expect(getVT("C2")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// XIRR
// ---------------------------------------------------------------------------

test("XIRR: Excel documented example (37.34%)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -10000",
    "set A2 value n 2750",
    "set A3 value n 4250",
    "set A4 value n 3250",
    "set A5 value n 2750",
    "set B1 formula DATE(2008,1,1)",
    "set B2 formula DATE(2008,3,1)",
    "set B3 formula DATE(2008,10,30)",
    "set B4 formula DATE(2009,2,15)",
    "set B5 formula DATE(2009,4,1)",
    "set C1 formula XIRR(A1:A5,B1:B5,0.1)",
  ]);
  expect(getDV("C1")).toBeCloseTo(0.3733625335188315, 6);
});

test("XIRR -> XNPV: the solved rate drives XNPV to (near) zero", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -10000",
    "set A2 value n 2750",
    "set A3 value n 4250",
    "set A4 value n 3250",
    "set A5 value n 2750",
    "set B1 formula DATE(2008,1,1)",
    "set B2 formula DATE(2008,3,1)",
    "set B3 formula DATE(2008,10,30)",
    "set B4 formula DATE(2009,2,15)",
    "set B5 formula DATE(2009,4,1)",
    "set C1 formula XIRR(A1:A5,B1:B5)",
    "set C2 formula XNPV(C1,A1:A5,B1:B5)",
  ]);
  expect(Math.abs(getDV("C2"))).toBeLessThan(1e-4);
});

test("XIRR: default guess is used when omitted, matching an explicit 0.1 guess", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -10000",
    "set A2 value n 2750",
    "set A3 value n 4250",
    "set A4 value n 3250",
    "set A5 value n 2750",
    "set B1 formula DATE(2008,1,1)",
    "set B2 formula DATE(2008,3,1)",
    "set B3 formula DATE(2008,10,30)",
    "set B4 formula DATE(2009,2,15)",
    "set B5 formula DATE(2009,4,1)",
    "set C1 formula XIRR(A1:A5,B1:B5)",
    "set C2 formula XIRR(A1:A5,B1:B5,0.1)",
  ]);
  expect(getDV("C1")).toBeCloseTo(getDV("C2"), 9);
});

test("XIRR: an explicit guess of exactly 0 falls back to the default 0.1", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -10000",
    "set A2 value n 2750",
    "set A3 value n 4250",
    "set A4 value n 3250",
    "set A5 value n 2750",
    "set B1 formula DATE(2008,1,1)",
    "set B2 formula DATE(2008,3,1)",
    "set B3 formula DATE(2008,10,30)",
    "set B4 formula DATE(2009,2,15)",
    "set B5 formula DATE(2009,4,1)",
    "set C1 formula XIRR(A1:A5,B1:B5,0)",
    "set C2 formula XIRR(A1:A5,B1:B5,0.1)",
  ]);
  expect(getDV("C1")).toBeCloseTo(getDV("C2"), 9);
});

test("XIRR: requires at least one positive and one negative cashflow", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n 100",
    "set A2 value n 200",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XIRR(A1:A2,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
});

test("XIRR: a zero-valued cashflow member is neither positive nor negative but does not block solving", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 0",
    "set A3 value n 120",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set B3 formula DATE(2021,1,1)",
    "set C1 formula XIRR(A1:A3,B1:B3)",
  ]);
  expect(getDV("C1")).toBeGreaterThan(0);
});

test("XIRR: an explicit guess greater than 0.1 is used as the initial bracket bound", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -10000",
    "set A2 value n 2750",
    "set A3 value n 4250",
    "set A4 value n 3250",
    "set A5 value n 2750",
    "set B1 formula DATE(2008,1,1)",
    "set B2 formula DATE(2008,3,1)",
    "set B3 formula DATE(2008,10,30)",
    "set B4 formula DATE(2009,2,15)",
    "set B5 formula DATE(2009,4,1)",
    "set C1 formula XIRR(A1:A5,B1:B5,0.5)",
    "set C2 formula XIRR(A1:A5,B1:B5,0.1)",
  ]);
  expect(getDV("C1")).toBeCloseTo(getDV("C2"), 6);
});

test("XIRR: near-zero root converges (small positive rate)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 100.001",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2021,1,1)",
    "set C1 formula XIRR(A1:A2,B1:B2)",
  ]);
  expect(getDV("C1")).toBeGreaterThan(0);
  expect(getDV("C1")).toBeLessThan(0.001);
});

test("XIRR: safeguarded solver converges on a many-sign-change schedule via bisection fallback (not plain Newton)", async () => {
  // Alternating-sign, irregularly-dated cashflows drive the Newton step out
  // of the current bracket on at least one iteration, forcing the rtsafe
  // solver's bisection fallback -- and forces a negative-residual bracket
  // update too. Exercises SolveXIRRRate's bisection branch and the
  // fval<0 -> xlo=rts branch, not just the well-conditioned documented
  // example above. The residual tolerance is tight (1e-8, not the looser
  // 1e-3 used elsewhere) specifically to catch a corrupted rtsafe
  // step-quality comparison (e.g. a `-fval` flipped to `+fval` in the
  // bracket-membership product) that would otherwise still land within a
  // looser tolerance of the true root.
  const { getDV, getVT } = await buildSheet([
    "set A1 value n -1",
    "set A2 value n 100",
    "set A3 value n -50",
    "set B1 formula DATE(2000,1,1)",
    "set B2 formula DATE(2000,1,2)",
    "set B3 formula DATE(2050,1,1)",
    "set C1 formula XIRR(A1:A3,B1:B3)",
    "set C2 formula XNPV(C1,A1:A3,B1:B3)",
  ]);
  expect(getVT("C1")).not.toContain("e#");
  expect(typeof getDV("C1")).toBe("number");
  expect(getDV("C1")).toBeCloseTo(-0.013560188117422541, 9);
  expect(Math.abs(getDV("C2"))).toBeLessThan(1e-8);
});

test("XIRR: solver returns #NUM! when the safeguarded iteration budget is exhausted on a genuinely hard multi-sign-change schedule", async () => {
  // A schedule with several irregular sign flips across a wide date range
  // where the bracket keeps narrowing but the residual never settles
  // within 100 rtsafe iterations at double precision -- the deterministic
  // #NUM! fallback (not a hang or an exception) for a pathological input,
  // matching Excel's documented "#NUM! if it can't find a result after 100
  // tries" contract.
  const { getVT } = await buildSheet([
    "set A1 value n -1833.7183710344686",
    "set A2 value n 8606.686762816593",
    "set A3 value n -771.1205458134041",
    "set A4 value n 8361.093050968413",
    "set A5 value n 13132.192143766299",
    "set B1 formula DATE(2000,1,1)",
    "set B2 formula DATE(2000,1,20)",
    "set B3 formula DATE(2007,2,24)",
    "set B4 formula DATE(2011,10,14)",
    "set B5 formula DATE(2016,5,25)",
    "set C1 formula XIRR(A1:A5,B1:B5)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
});

test("XIRR: float-precision-degenerate bisection step (xlo collapses onto rts) still returns a finite rate, not a hang", async () => {
  // A specific irregular multi-sign-change schedule where the rtsafe
  // bracket narrows to a floating-point fixed point during bisection
  // before the epsilon/iteration-count exits fire. Exercises the
  // `if (xlo == rts) return rts;` early-exit inside SolveXIRRRate's
  // bisection branch.
  const { getDV, getVT } = await buildSheet([
    "set A1 value n -1973.2643100308553",
    "set A2 value n 6098.7161398393655",
    "set A3 value n 3359.6005483342337",
    "set A4 value n 3510.1475759922287",
    "set A5 value n 6983.601099338198",
    "set A6 value n 1627.8620993848247",
    "set B1 formula DATE(2000,1,1)",
    "set B2 formula DATE(2000,1,15)",
    "set B3 formula DATE(2009,7,18)",
    "set B4 formula DATE(2013,3,28)",
    "set B5 formula DATE(2016,12,12)",
    "set B6 formula DATE(2017,9,3)",
    "set C1 formula XIRR(A1:A6,B1:B6)",
  ]);
  expect(getVT("C1")).not.toContain("e#");
  expect(isFinite(getDV("C1"))).toBe(true);
});

test("XIRR: float-precision-degenerate Newton step (temp collapses onto rts) still returns a finite rate, not a hang", async () => {
  // A different irregular multi-sign-change schedule that instead hits the
  // Newton-step early exit `if (temp == rts) return rts;` when a step's
  // magnitude underflows below the representable precision at the current
  // rate scale.
  const { getDV, getVT } = await buildSheet([
    "set A1 value n -6224.853858456413",
    "set A2 value n 11098.744454373955",
    "set A3 value n 13445.178517813412",
    "set A4 value n 3196.5174717812415",
    "set A5 value n 11374.21751831389",
    "set A6 value n -4820.793628143516",
    "set A7 value n 7830.237395051046",
    "set B1 formula DATE(2000,1,1)",
    "set B2 formula DATE(2000,1,9)",
    "set B3 formula DATE(2003,7,5)",
    "set B4 formula DATE(2006,8,3)",
    "set B5 formula DATE(2009,9,25)",
    "set B6 formula DATE(2015,12,21)",
    "set B7 formula DATE(2019,11,3)",
    "set C1 formula XIRR(A1:A7,B1:B7)",
  ]);
  expect(getVT("C1")).not.toContain("e#");
  expect(isFinite(getDV("C1"))).toBe(true);
});

test("XIRR: mismatched values/dates shape is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 50",
    "set A3 value n 60",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XIRR(A1:A3,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
});

test("XIRR: date before the anchor date is #NUM!, non-numeric date is #VALUE!", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 50",
    "set A3 value n 60",
    "set B1 formula DATE(2020,6,1)",
    "set B2 formula DATE(2020,9,1)",
    "set B3 formula DATE(2020,1,1)", // precedes anchor B1
    "set C1 formula XIRR(A1:A3,B1:B3)",
    'set B4 text t "nope"',
    "set A4 value n -100",
    "set A5 value n 50",
    "set B5 formula DATE(2020,1,1)",
    "set C2 formula XIRR(A4:A5,B4:B5)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
  expect(getVT("C2")).toBe("e#VALUE!");
});

test("XIRR: duplicate dates and non-ascending later dates are accepted (no forced ascending order)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -1000",
    "set A2 value n 600",
    "set A3 value n 600",
    "set B1 formula DATE(2020,1,1)", // anchor -- earliest
    "set B2 formula DATE(2020,9,1)", // later date first...
    "set B3 formula DATE(2020,9,1)", // ...duplicated, and out of position vs a fully sorted schedule
    "set C1 formula XIRR(A1:A3,B1:B3)",
    "set D1 formula DATE(2020,1,1)",
    "set D2 formula DATE(2020,9,1)",
    "set E1 value n -1000",
    "set E2 value n 1200",
    "set C2 formula XIRR(E1:E2,D1:D2)",
  ]);
  // Collapsing the duplicate 600+600 into a single 1200 flow on the same date
  // must produce the identical rate -- proving the duplicate-date schedule
  // was actually solved (not silently rejected into a coincidental value).
  expect(getDV("C1")).toBeCloseTo(getDV("C2"), 9);
  expect(getDV("C1")).toBeGreaterThan(0);
});

test("XIRR: error in cashflow/date range propagates, guess type/arity errors surface", async () => {
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 formula 1/0",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set C1 formula XIRR(A1:A2,B1:B2)",
    "set A3 value n -100",
    "set A4 value n 200",
    "set B3 formula DATE(2020,1,1)",
    "set B4 formula DATE(2020,6,1)",
    'set C2 formula XIRR(A3:A4,B3:B4,"x")',
    "set C3 formula XIRR(A3:A4,B3:B4,0.1,99)",
  ]);
  expect(getVT("C1")).toBe("e#DIV/0!");
  expect(getVT("C2")).toBe("e#VALUE!");
  expect(getVT("C3")).toBe("e#VALUE!");
});

test("XIRR: no-root case (all flows same sign after guard) already covered; genuinely unsolvable schedule still returns #NUM! not a runaway loop", async () => {
  // Two same-day opposite flows: XNPV is constant (independent of rate) at
  // values sum, so unless that sum is exactly 0 there is no root. With a
  // nonzero sum this must terminate in #NUM!, not hang or throw.
  const { getVT } = await buildSheet([
    "set A1 value n -100",
    "set A2 value n 50",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,1,1)",
    "set C1 formula XIRR(A1:A2,B1:B2)",
  ]);
  expect(getVT("C1")).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// Cross-sheet / named ranges
// ---------------------------------------------------------------------------

test("MIRR/XNPV/XIRR: cross-sheet ranges resolve via Sheet!range syntax", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  SC.Formula.AddSheetToCache(
    "REMOTE",
    "version:1.5\n" +
      "cell:A1:v:-1000\ncell:A2:v:400\ncell:A3:v:700\n" +
      "cell:B1:v:43831\ncell:B2:v:44013\ncell:B3:v:44197\n" + // 2020-01-01, 2020-06-01, 2020-12-31-ish serials (n/a precision, just monotonic)
      "sheet:c:2:r:3\n",
    false,
  );
  const sheet = new SC.Sheet();
  await scheduleCommands(
    SC,
    sheet,
    [
      "set C1 formula MIRR(REMOTE!A1:A3,0.05,0.05)",
      "set C2 formula XNPV(0.08,REMOTE!A1:A3,REMOTE!B1:B3)",
      "set C3 formula XIRR(REMOTE!A1:A3,REMOTE!B1:B3)",
    ],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);
  const getDV = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).datavalue;
  const getVT = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).valuetype;
  expect(getVT("C1")).toBe("n%");
  expect(typeof getDV("C1")).toBe("number");
  expect(getVT("C2")).toBe("n$");
  expect(typeof getDV("C2")).toBe("number");
  expect(getVT("C3")).toBe("n%");
  expect(typeof getDV("C3")).toBe("number");
});

test("PPMT/IPMT/MIRR/XNPV/XIRR: named ranges resolve the same as direct ranges", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n -1000",
    "set A2 value n 400",
    "set A3 value n 700",
    "set B1 formula DATE(2020,1,1)",
    "set B2 formula DATE(2020,6,1)",
    "set B3 formula DATE(2021,1,1)",
    "name define CASH A1:A3",
    "name define WHEN B1:B3",
    "set C1 formula MIRR(CASH,0.05,0.05)",
    "set C2 formula MIRR(A1:A3,0.05,0.05)",
    "set D1 formula XNPV(0.08,CASH,WHEN)",
    "set D2 formula XNPV(0.08,A1:A3,B1:B3)",
    "set E1 formula XIRR(CASH,WHEN)",
    "set E2 formula XIRR(A1:A3,B1:B3)",
  ]);
  expect(getDV("C1")).toBeCloseTo(getDV("C2"), 12);
  expect(getDV("D1")).toBeCloseTo(getDV("D2"), 12);
  expect(getDV("E1")).toBeCloseTo(getDV("E2"), 9);
});

// ---------------------------------------------------------------------------
// Function-list registration / help picker plumbing
// ---------------------------------------------------------------------------

test("PPMT/IPMT/MIRR/XNPV/XIRR are registered in FunctionList with help text and arg strings", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);

  for (const fname of ["PPMT", "IPMT", "MIRR", "XNPV", "XIRR"]) {
    const fobj = SC.Formula.FunctionList[fname];
    expect(fobj).toBeTruthy();
    expect(fobj[4]).toBe("financial");
  }

  SC.Formula.FillFunctionInfo();
  expect(SC.Formula.FunctionArgDefs["ppmt"]).toBe("rate, per, nper, pv, [fv, [paytype]]");
  expect(SC.Formula.FunctionArgDefs["mirr"]).toBe("range, finance_rate, reinvest_rate");
  expect(SC.Formula.FunctionArgDefs["xnpv"]).toBe("rate, values, dates");
  expect(SC.Formula.FunctionArgDefs["xirr"]).toBe("values, dates, [guess]");
  expect(SC.Formula.FunctionList["PPMT"][3]).toContain("principal");
  expect(SC.Formula.FunctionList["IPMT"][3]).toContain("interest");
  expect(SC.Formula.FunctionList["MIRR"][3]).toContain("modified internal rate");
  expect(SC.Formula.FunctionList["XNPV"][3]).toContain("net present value");
  expect(SC.Formula.FunctionList["XIRR"][3]).toContain("internal rate of return");
  expect(SC.Formula.FunctionClasses["financial"].items).toContain("PPMT");
  expect(SC.Formula.FunctionClasses["financial"].items).toContain("IPMT");
  expect(SC.Formula.FunctionClasses["financial"].items).toContain("MIRR");
  expect(SC.Formula.FunctionClasses["financial"].items).toContain("XNPV");
  expect(SC.Formula.FunctionClasses["financial"].items).toContain("XIRR");
});
