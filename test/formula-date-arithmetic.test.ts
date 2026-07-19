import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Focused command-level tests for the date-arithmetic/workday compatibility
// batch: EDATE, EOMONTH, DATEDIF, WEEKNUM, ISOWEEKNUM, YEARFRAC, WORKDAY,
// NETWORKDAYS, WORKDAY.INTL, NETWORKDAYS.INTL. See js/formula1.ts
// SocialCalc.Formula.EDateEoMonthFunctions / DateDifFunction /
// WeekNumFunctions / YearFracFunction / WorkdayNetworkdaysFunctions for the
// implementation and js/socialcalcconstants.ts for picker/help text
// (s_fdef_EDATE etc.). lemma/weekday-policy.ts is the verified facade for
// the weekend-mask/working-day decision policy WORKDAY[.INTL]/
// NETWORKDAYS[.INTL] share.

type Cell = { datavalue: any; valuetype: string };

function resetFormulaGlobals(SC: any) {
  // Mirrors test/formula-rank-median-quartile.test.ts: the UMD bundle
  // attaches SocialCalc to globalThis, so all loadSocialCalc() calls share
  // the same live object.
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
// Serial 59/60/61 policy and century leap years.
//
// SocialCalc's DATE()/serial system (see s_fdef_DATE, js/formatnumber2.ts's
// Fliegel/van Flandern Julian-day conversion) is documented to diverge from
// Excel's classic Lotus-1-2-3-compatible serial numbering: it does NOT
// insert a fictitious February 29, 1900. Serial 60 is February 28, 1900;
// serial 61 is March 1, 1900 directly (there is no serial for a nonexistent
// Feb 29, 1900). These fixtures pin that exact policy through EOMONTH,
// DATEDIF, and WORKDAY so a future change to the underlying Julian-day
// helpers cannot silently reintroduce (or otherwise alter) the fake leap
// day without failing a date-arithmetic test, not just formatnumber2's own
// suite. Century-leap-year fixtures (1900 not a leap year even in true
// Gregorian terms, 2000 a leap year) exercise the same century-modulo rule
// the Julian-day helpers implement.
// ---------------------------------------------------------------------------

test("serial 59/60/61: round-trip through DATE/YEAR/MONTH/DAY with no fictitious Feb 29 1900", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(1900,2,27)", // expect serial 59
    "set A2 formula DATE(1900,2,28)", // expect serial 60 (last real day of Feb 1900)
    "set A3 formula DATE(1900,3,1)", // expect serial 61 (no Feb 29 1900 in between)
    "set B1 value n 59",
    "set B2 value n 60",
    "set B3 value n 61",
    "set C1 formula YEAR(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula DAY(B1)",
    "set C4 formula YEAR(B2)",
    "set C5 formula MONTH(B2)",
    "set C6 formula DAY(B2)",
    "set C7 formula YEAR(B3)",
    "set C8 formula MONTH(B3)",
    "set C9 formula DAY(B3)",
  ]);

  expect(getDV("A1")).toBe(59);
  expect(getDV("A2")).toBe(60);
  expect(getDV("A3")).toBe(61);
  // serial 59 -> Feb 27, 1900
  expect(getDV("C1")).toBe(1900);
  expect(getDV("C2")).toBe(2);
  expect(getDV("C3")).toBe(27);
  // serial 60 -> Feb 28, 1900 (last day of a non-leap Feb 1900)
  expect(getDV("C4")).toBe(1900);
  expect(getDV("C5")).toBe(2);
  expect(getDV("C6")).toBe(28);
  // serial 61 -> Mar 1, 1900 directly, confirming no fictitious Feb 29 1900
  expect(getDV("C7")).toBe(1900);
  expect(getDV("C8")).toBe(3);
  expect(getDV("C9")).toBe(1);
});

test("serial 59/60/61: EOMONTH(Feb 1900) lands on the 28th (non-leap), DATEDIF D-count across the boundary is exactly 1", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(1900,2,15)",
    "set B1 formula EOMONTH(A1,0)",
    "set C1 formula DAY(B1)",
    "set A2 value n 60", // Feb 28, 1900
    "set A3 value n 61", // Mar 1, 1900
    'set D1 formula DATEDIF(A2,A3,"D")',
  ]);

  expect(getDV("C1")).toBe(28);
  expect(getDV("D1")).toBe(1);
});

test("serial 59/60/61: WORKDAY steps one working day from serial 60 lands on serial 61 (both weekdays)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 60", // Feb 28, 1900
    "set B1 formula WEEKDAY(A1,2)",
    "set B2 formula WORKDAY(A1,1)",
    "set B3 value n 61", // Mar 1, 1900
  ]);

  // Feb 28, 1900 and Mar 1, 1900 are both weekdays (Wed/Thu), so WORKDAY
  // steps exactly one calendar day, confirming serial 61 is the very next
  // day after serial 60 with nothing (fictitious or otherwise) between them.
  expect(getDV("B1")).toBeLessThanOrEqual(5); // Mon..Fri
  expect(getDV("B2")).toBe(getDV("B3"));
});

test("century leap years: 1900 is not a leap year, 2000 is (EOMONTH/EDATE Feb boundary)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(1900,1,31)",
    "set A2 formula DATE(2000,1,31)",
    "set B1 formula EDATE(A1,1)", // Jan 31 1900 + 1mo -> Feb 28 1900 (non-leap)
    "set B2 formula EDATE(A2,1)", // Jan 31 2000 + 1mo -> Feb 29 2000 (leap)
    "set C1 formula DAY(B1)",
    "set C2 formula DAY(B2)",
    "set D1 formula EOMONTH(A1,0)",
    "set D2 formula EOMONTH(A2,0)",
    "set E1 formula DAY(D1)",
    "set E2 formula DAY(D2)",
  ]);

  expect(getDV("C1")).toBe(28);
  expect(getDV("C2")).toBe(29);
  expect(getDV("E1")).toBe(31); // EOMONTH of Jan 1900 itself is Jan 31
  expect(getDV("E2")).toBe(31); // EOMONTH of Jan 2000 itself is Jan 31
});

test("century leap years: DATEDIF Y/D across the 1900 and 2000 February boundaries", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(1900,2,28)",
    "set A2 formula DATE(1900,3,1)",
    "set A3 formula DATE(2000,2,28)",
    "set A4 formula DATE(2000,3,1)",
    'set B1 formula DATEDIF(A1,A2,"D")', // 1 day: no Feb 29 1900
    'set B2 formula DATEDIF(A3,A4,"D")', // 2 days: Feb 29 2000 exists
  ]);

  expect(getDV("B1")).toBe(1);
  expect(getDV("B2")).toBe(2);
});

// ---------------------------------------------------------------------------
// EDATE / EOMONTH
// ---------------------------------------------------------------------------

test("EDATE: forward/backward months and MS-doc example", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2011,1,15)",
    "set B1 formula EDATE(A1,1)",
    "set B2 formula EDATE(A1,-1)",
    // reference cross-check via YEAR/MONTH/DAY
    "set C1 formula YEAR(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula DAY(B1)",
    "set C4 formula YEAR(B2)",
    "set C5 formula MONTH(B2)",
    "set C6 formula DAY(B2)",
  ]);

  expect(getDV("C1")).toBe(2011);
  expect(getDV("C2")).toBe(2);
  expect(getDV("C3")).toBe(15);
  expect(getDV("C4")).toBe(2010);
  expect(getDV("C5")).toBe(12);
  expect(getDV("C6")).toBe(15);
});

test("EDATE: month-end clipping (Jan 31 + 1 month lands on Feb 28/29)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2021,1,31)",
    "set A2 formula DATE(2020,1,31)", // 2020 is a leap year
    "set B1 formula EDATE(A1,1)",
    "set B2 formula EDATE(A2,1)",
    "set C1 formula DAY(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula DAY(B2)",
    "set C4 formula MONTH(B2)",
  ]);

  expect(getDV("C1")).toBe(28); // 2021 non-leap
  expect(getDV("C2")).toBe(2);
  expect(getDV("C3")).toBe(29); // 2020 leap
  expect(getDV("C4")).toBe(2);
});

test("EDATE: month overflow/underflow normalizes year", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2020,6,10)",
    "set B1 formula EDATE(A1,20)", // 20 months forward
    "set B2 formula EDATE(A1,-20)", // 20 months back
    "set C1 formula YEAR(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula YEAR(B2)",
    "set C4 formula MONTH(B2)",
  ]);

  expect(getDV("C1")).toBe(2022);
  expect(getDV("C2")).toBe(2);
  expect(getDV("C3")).toBe(2018);
  expect(getDV("C4")).toBe(10);
});

test("EOMONTH: MS-doc examples (forward, negative offset, same month)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2011,1,1)",
    "set B1 formula EOMONTH(A1,1)", // -> 2/28/2011
    "set B2 formula EOMONTH(A1,-3)", // -> 10/31/2010
    "set B3 formula EOMONTH(A1,0)", // -> 1/31/2011
    "set C1 formula YEAR(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula DAY(B1)",
    "set C4 formula YEAR(B2)",
    "set C5 formula MONTH(B2)",
    "set C6 formula DAY(B2)",
    "set C7 formula DAY(B3)",
  ]);

  expect(getDV("C1")).toBe(2011);
  expect(getDV("C2")).toBe(2);
  expect(getDV("C3")).toBe(28);
  expect(getDV("C4")).toBe(2010);
  expect(getDV("C5")).toBe(10);
  expect(getDV("C6")).toBe(31);
  expect(getDV("C7")).toBe(31);
});

test("EOMONTH: leap-year February", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2020,2,5)",
    "set B1 formula EOMONTH(A1,0)",
    "set C1 formula DAY(B1)",
  ]);

  expect(getDV("C1")).toBe(29);
});

test("EDATE/EOMONTH: propagate errors and reject wrong arity", async () => {
  const { getVT } = await buildSheet([
    'set A1 formula EDATE("bad",1)',
    "set B1 formula EDATE(1,2,3)",
    "set B2 formula EOMONTH(1)",
  ]);

  expect(getVT("A1").charAt(0)).toBe("e");
  expect(getVT("B1").charAt(0)).toBe("e");
  expect(getVT("B2").charAt(0)).toBe("e");
});

// ---------------------------------------------------------------------------
// DATEDIF
// ---------------------------------------------------------------------------

test("DATEDIF: Y/M/D/MD/YM/YD on the MS-documented 2001-01-01..2002-08-15 example", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,1)",
    "set A2 formula DATE(2002,8,15)",
    'set B1 formula DATEDIF(A1,A2,"Y")',
    'set B2 formula DATEDIF(A1,A2,"M")',
    'set B3 formula DATEDIF(A1,A2,"D")',
    'set B4 formula DATEDIF(A1,A2,"MD")',
    'set B5 formula DATEDIF(A1,A2,"YM")',
    'set B6 formula DATEDIF(A1,A2,"YD")',
  ]);

  expect(getDV("B1")).toBe(1);
  expect(getDV("B2")).toBe(19);
  expect(getDV("B3")).toBe(591);
  expect(getDV("B4")).toBe(14);
  expect(getDV("B5")).toBe(7);
  expect(getDV("B6")).toBe(226);
});

test("DATEDIF: unit is case-insensitive", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,1)",
    "set A2 formula DATE(2002,8,15)",
    'set B1 formula DATEDIF(A1,A2,"y")',
  ]);

  expect(getDV("B1")).toBe(1);
});

test("DATEDIF: YM decrements when end_date's day-of-month is earlier than start_date's", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,31)",
    "set A2 formula DATE(2001,3,1)",
    'set B1 formula DATEDIF(A1,A2,"YM")',
  ]);

  // Raw month difference is 2 (Jan->Mar), but end_date's day (1) is earlier
  // than start_date's (31), so YM decrements to 1.
  expect(getDV("B1")).toBe(1);
});

test("DATEDIF: M decrements when end_date's day-of-month is earlier than start_date's", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,31)",
    "set A2 formula DATE(2001,3,1)",
    'set B1 formula DATEDIF(A1,A2,"M")',
  ]);

  // Raw month difference is 2, but end_date's day (1) is earlier than
  // start_date's (31), so M decrements to 1 (not a complete month yet).
  expect(getDV("B1")).toBe(1);
});

test("DATEDIF: Y decrements when end_date is in the same month but an earlier day", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,31)",
    "set A2 formula DATE(2002,1,5)",
    'set B1 formula DATEDIF(A1,A2,"Y")',
  ]);

  // Same calendar month (January) but end_date's day (5) is earlier than
  // start_date's (31), so the year has not yet fully elapsed: Y decrements
  // from a raw 1 to 0.
  expect(getDV("B1")).toBe(0);
});

test("DATEDIF: MD borrows from the prior month (documented Excel edge case)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,31)",
    "set A2 formula DATE(2001,3,1)",
    'set B1 formula DATEDIF(A1,A2,"MD")',
  ]);

  // Feb 2001 (non-leap) has 28 days: 28 + 1 - 31 = -2 (documented MD quirk).
  expect(getDV("B1")).toBe(-2);
});

test("DATEDIF: MD borrows across a December->January year boundary", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2020,12,15)",
    "set A2 formula DATE(2021,1,5)",
    'set B1 formula DATEDIF(A1,A2,"MD")',
  ]);

  // end month is January (1); borrow from December of the prior year
  // (31 days): 31 + 5 - 15 = 21.
  expect(getDV("B1")).toBe(21);
});

test("DATEDIF: YD rolls the anchor year back across a December->January span", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2020,12,1)",
    "set A2 formula DATE(2021,1,5)",
    'set B1 formula DATEDIF(A1,A2,"YD")',
  ]);

  // Anchoring start_date's month/day at end_date's year (2021,12,1) falls
  // after end_date, so YD rolls the anchor year back to 2020 and counts
  // Dec 1, 2020 -> Jan 5, 2021 = 35 days.
  expect(getDV("B1")).toBe(35);
});

test("DATEDIF: same-day input is zero (and a real numeric success, not an error) across every unit", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 formula DATE(2020,5,1)",
    'set B1 formula DATEDIF(A1,A1,"Y")',
    'set B2 formula DATEDIF(A1,A1,"M")',
    'set B3 formula DATEDIF(A1,A1,"D")',
    'set B4 formula DATEDIF(A1,A1,"MD")',
    'set B5 formula DATEDIF(A1,A1,"YM")',
    'set B6 formula DATEDIF(A1,A1,"YD")',
  ]);

  for (const c of ["B1", "B2", "B3", "B4", "B5", "B6"]) {
    expect(getDV(c)).toBe(0);
    // Same-day input (start_date == end_date) must succeed with "n", not
    // silently produce #NUM! that happens to carry a numeric value of 0.
    expect(getVT(c)).toBe("n");
  }
});

test("DATEDIF: reversed dates are #NUM!, unknown unit is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula DATE(2020,1,1)",
    "set A2 formula DATE(2019,1,1)",
    'set B1 formula DATEDIF(A1,A2,"Y")',
    'set B2 formula DATEDIF(A2,A1,"Q")',
  ]);

  expect(getVT("B1")).toBe("e#NUM!");
  expect(getVT("B2")).toBe("e#NUM!");
});

test("DATEDIF: propagates a referenced error from start_date/end_date or from unit", async () => {
  const { getVT } = await buildSheet([
    "set E1 formula 1/0",
    "set A2 formula DATE(2020,1,1)",
    'set B1 formula DATEDIF(E1,A2,"Y")',
    "set B2 formula DATEDIF(1,5,E1)",
  ]);

  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// WEEKNUM / ISOWEEKNUM
// ---------------------------------------------------------------------------

test("WEEKNUM: MS-doc example 3/9/2012 with type 1 (default) and type 2", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2012,3,9)",
    "set B1 formula WEEKNUM(A1)",
    "set B2 formula WEEKNUM(A1,1)",
    "set B3 formula WEEKNUM(A1,2)",
  ]);

  expect(getDV("B1")).toBe(10);
  expect(getDV("B2")).toBe(10);
  expect(getDV("B3")).toBe(11);
});

test("WEEKNUM: return_type 21 matches ISOWEEKNUM", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2012,3,9)",
    "set B1 formula WEEKNUM(A1,21)",
    "set B2 formula ISOWEEKNUM(A1)",
  ]);

  expect(getDV("B1")).toBe(getDV("B2"));
  expect(getDV("B2")).toBe(10);
});

test("WEEKNUM: illegal return_type is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula DATE(2012,3,9)",
    "set B1 formula WEEKNUM(A1,99)",
  ]);

  expect(getVT("B1")).toBe("e#NUM!");
});

test("WEEKNUM: non-numeric return_type propagates its error, extra args are rejected", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula DATE(2012,3,9)",
    'set B1 formula WEEKNUM(A1,"bad")',
    "set B2 formula WEEKNUM(A1,1,9)", // too many args (3 args)
  ]);

  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
});

test("ISOWEEKNUM: year-boundary weeks (Jan 1 2005 is week 53 of 2004; Dec 31 2007 is week 1 of 2008)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2005,1,1)",
    "set A2 formula DATE(2007,12,31)",
    "set B1 formula ISOWEEKNUM(A1)",
    "set B2 formula ISOWEEKNUM(A2)",
  ]);

  expect(getDV("B1")).toBe(53);
  expect(getDV("B2")).toBe(1);
});

test("ISOWEEKNUM: a Sunday date maps to ISO weekday 7 (end of its ISO week)", async () => {
  const { getDV } = await buildSheet([
    // Sunday, 2024-03-10 (ISO week 10, per Google/Excel ISOWEEKNUM).
    "set A1 formula DATE(2024,3,10)",
    "set B1 formula ISOWEEKNUM(A1)",
  ]);

  expect(getDV("B1")).toBe(10);
});

test("WEEKNUM/ISOWEEKNUM: propagate a referenced error", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0",
    "set B1 formula WEEKNUM(A1)",
    "set B2 formula ISOWEEKNUM(A1)",
  ]);

  expect(getVT("B1")).toBe("e#DIV/0!");
  expect(getVT("B2")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// YEARFRAC
// ---------------------------------------------------------------------------

test("YEARFRAC: basis 0 (NASD 30/360) full end-of-February rule (start and end both the last day of Feb)", async () => {
  const { getDV } = await buildSheet([
    // Feb 29, 2020 (leap-year last day of Feb) to Feb 28, 2021 (non-leap
    // last day of Feb): the NASD rule treats both as day 30, giving a
    // clean 1.0 rather than 362/360 (naive day-31-only handling).
    "set A1 formula DATE(2020,2,29)",
    "set A2 formula DATE(2021,2,28)",
    "set B1 formula YEARFRAC(A1,A2,0)",
  ]);

  expect(getDV("B1")).toBeCloseTo(1, 10);
});

test("YEARFRAC: basis 0 D2-Feb-end rule applies only when start is ALSO the last day of Feb (Jan 31 -> Feb 28)", async () => {
  const { getDV } = await buildSheet([
    // Jan 31, 2021 (day-31 rollback makes d1=30, but start is NOT the last
    // day of February) to Feb 28, 2021 (the last day of a non-leap Feb).
    // The D2-Feb-end rule must NOT fire here: 28/360, not 30/360.
    "set A1 formula DATE(2021,1,31)",
    "set A2 formula DATE(2021,2,28)",
    "set B1 formula YEARFRAC(A1,A2,0)",
  ]);

  expect(getDV("B1")).toBeCloseTo(28 / 360, 10);
});

test("YEARFRAC: default basis 0 (US 30/360) for a half year", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,1)",
    "set A2 formula DATE(2001,7,1)",
    "set B1 formula YEARFRAC(A1,A2)",
  ]);

  expect(getDV("B1")).toBeCloseTo(0.5, 10);
});

test("YEARFRAC: rejects wrong arity and a non-numeric basis argument", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula DATE(2001,1,1)",
    "set A2 formula DATE(2001,7,1)",
    "set B1 formula YEARFRAC(A1,A2,0,9)", // too many args (4 args)
    'set B2 formula YEARFRAC(A1,A2,"bad")', // non-numeric basis
  ]);

  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
});

test("YEARFRAC: all five bases (0-4) for a half year", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,1)",
    "set A2 formula DATE(2001,7,1)",
    "set C1 formula YEARFRAC(A1,A2,0)",
    "set C2 formula YEARFRAC(A1,A2,1)",
    "set C3 formula YEARFRAC(A1,A2,2)",
    "set C4 formula YEARFRAC(A1,A2,3)",
    "set C5 formula YEARFRAC(A1,A2,4)",
  ]);

  expect(getDV("C1")).toBeCloseTo(0.5, 10);
  expect(getDV("C2")).toBeCloseTo(181 / 365, 10);
  expect(getDV("C3")).toBeCloseTo(181 / 360, 10);
  expect(getDV("C4")).toBeCloseTo(181 / 365, 10);
  expect(getDV("C5")).toBeCloseTo(0.5, 10);
});

test("YEARFRAC: reversed dates are swapped, not an error", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2001,1,1)",
    "set A2 formula DATE(2001,7,1)",
    "set B1 formula YEARFRAC(A2,A1,0)",
  ]);

  expect(getDV("B1")).toBeCloseTo(0.5, 10);
});

test("YEARFRAC: same start/end date is zero", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2020,5,1)",
    "set B1 formula YEARFRAC(A1,A1,1)",
  ]);

  expect(getDV("B1")).toBe(0);
});

test("YEARFRAC: illegal basis is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula DATE(2020,1,1)",
    "set A2 formula DATE(2020,6,1)",
    "set B1 formula YEARFRAC(A1,A2,5)",
  ]);

  expect(getVT("B1")).toBe("e#NUM!");
});

test("YEARFRAC: propagates a referenced error from start_date", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0",
    "set A2 formula DATE(2020,1,1)",
    "set B1 formula YEARFRAC(A1,A2)",
  ]);

  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("YEARFRAC: actual/actual basis 1 spans a leap year correctly", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2019,1,1)",
    "set A2 formula DATE(2021,1,1)",
    "set B1 formula YEARFRAC(A1,A2,1)",
  ]);

  // 2019 (365) + 2020 (366) = 731 days over an average of (365+366+365)/3.
  const avg = (365 + 366 + 365) / 3;
  expect(getDV("B1")).toBeCloseTo(731 / avg, 10);
});

test("YEARFRAC: actual/actual basis 1 within a single non-leap year divides by 365", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2021,1,1)",
    "set A2 formula DATE(2021,7,1)",
    "set B1 formula YEARFRAC(A1,A2,1)",
  ]);

  expect(getDV("B1")).toBeCloseTo(181 / 365, 10);
});

test("YEARFRAC: actual/actual basis 1 within a single leap year divides by 366", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2020,1,1)",
    "set A2 formula DATE(2020,7,1)",
    "set B1 formula YEARFRAC(A1,A2,1)",
  ]);

  expect(getDV("B1")).toBeCloseTo(182 / 366, 10);
});

test("YEARFRAC: basis 0 leaves day 31 unrolled when d1 is not 30 (same-month Jan 15 -> Jan 31)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2021,1,15)",
    "set A2 formula DATE(2021,1,31)",
    "set B1 formula YEARFRAC(A1,A2,0)",
  ]);

  expect(getDV("B1")).toBeCloseTo(16 / 360, 10);
});

test("YEARFRAC: basis 0 day-31 rollback fires for a non-February pair (Jan 31 -> Mar 31)", async () => {
  const { getDV } = await buildSheet([
    // Neither date is the last day of February, but both are day 31: the
    // plain day-31 rollback (not the Feb-end rule) makes d1=30 then d2=30.
    "set A1 formula DATE(2021,1,31)",
    "set A2 formula DATE(2021,3,31)",
    "set B1 formula YEARFRAC(A1,A2,0)",
  ]);

  expect(getDV("B1")).toBeCloseTo(60 / 360, 10);
});

// ---------------------------------------------------------------------------
// WORKDAY / NETWORKDAYS
// ---------------------------------------------------------------------------

test("WORKDAY: MS-doc example with three holidays (10/1/2008 + 151 workdays)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2008,10,1)",
    "set H1 formula DATE(2008,11,26)",
    "set H2 formula DATE(2008,12,4)",
    "set H3 formula DATE(2009,1,21)",
    "set B1 formula WORKDAY(A1,151,H1:H3)",
    "set C1 formula YEAR(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula DAY(B1)",
  ]);

  expect(getDV("C1")).toBe(2009);
  expect(getDV("C2")).toBe(5);
  expect(getDV("C3")).toBe(5);
});

test("WORKDAY: a holiday range with a blank cell ignores the blank and does not count as a holiday", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2008,10,1)",
    "set H1 formula DATE(2008,11,26)",
    // H2 left blank
    "set H3 formula DATE(2009,1,21)",
    "set B1 formula WORKDAY(A1,151,H1:H3)",
    "set C1 formula YEAR(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula DAY(B1)",
  ]);

  // Only two real holidays contribute (blank H2 is ignored, not treated as
  // a holiday on Dec 31 1899/serial 0), so the result differs by one
  // working day from the three-holiday MS-doc example above.
  expect(getDV("C1")).toBe(2009);
  expect(getDV("C2")).toBe(5);
  expect(getDV("C3")).toBe(4);
});

test("WORKDAY: negative days steps backward, zero days is a no-op", async () => {
  const { getDV } = await buildSheet([
    // Wednesday 2020-01-08
    "set A1 formula DATE(2020,1,8)",
    "set B1 formula WORKDAY(A1,-5)",
    "set B2 formula WORKDAY(A1,0)",
  ]);

  expect(getDV("B2")).toBe(getDV("A1"));
  expect(getDV("B1")).toBeLessThan(getDV("A1"));
});

test("WORKDAY: skips weekends with no holidays argument", async () => {
  const { getDV } = await buildSheet([
    // Friday 2021-01-01
    "set A1 formula DATE(2021,1,1)",
    "set B1 formula WORKDAY(A1,1)",
    "set C1 formula WEEKDAY(B1,2)", // Monday=1..Sunday=7
  ]);

  expect(getDV("C1")).toBe(1); // lands on Monday, skipping the weekend
});

test("NETWORKDAYS: MS-doc example (10/1/2008..12/1/2008 with one holiday) = 43", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2008,10,1)",
    "set A2 formula DATE(2008,12,1)",
    "set H1 formula DATE(2008,11,26)",
    "set B1 formula NETWORKDAYS(A1,A2,H1)",
  ]);

  expect(getDV("B1")).toBe(43);
});

test("NETWORKDAYS: start after end returns a negative count (reversed direction)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2008,10,1)",
    "set A2 formula DATE(2008,12,1)",
    "set H1 formula DATE(2008,11,26)",
    "set B1 formula NETWORKDAYS(A2,A1,H1)",
  ]);

  expect(getDV("B1")).toBe(-43);
});

test("NETWORKDAYS: same start/end on a working day counts one day; on a weekend counts zero", async () => {
  const { getDV } = await buildSheet([
    // Wednesday
    "set A1 formula DATE(2020,1,8)",
    // Saturday
    "set A2 formula DATE(2020,1,11)",
    "set B1 formula NETWORKDAYS(A1,A1)",
    "set B2 formula NETWORKDAYS(A2,A2)",
  ]);

  expect(getDV("B1")).toBe(1);
  expect(getDV("B2")).toBe(0);
});

test("WORKDAY/NETWORKDAYS: a bare scalar date is accepted as a single holiday", async () => {
  const { getDV } = await buildSheet([
    // Tuesday 2020-01-07
    "set A1 formula DATE(2020,1,7)",
    // Wednesday 2020-01-08 as an inline single-holiday scalar
    "set B1 formula WORKDAY(A1,1,DATE(2020,1,8))",
    "set C1 formula DAY(B1)",
    "set B2 formula NETWORKDAYS(A1,DATE(2020,1,9),DATE(2020,1,8))",
  ]);

  // Skips both the weekend-adjacent working day AND the scalar holiday,
  // landing on Thursday 2020-01-09.
  expect(getDV("C1")).toBe(9);
  // Jan 7 (Tue) .. Jan 9 (Thu) inclusive = 3 working days minus the Jan 8
  // holiday = 2.
  expect(getDV("B2")).toBe(2);
});

test("WORKDAY/NETWORKDAYS: a non-date holidays argument (text) is #VALUE!, extra arguments are rejected", async () => {
  const { getVT } = await buildSheet([
    'set A1 formula WORKDAY(1,1,"bad")',
    'set A2 formula NETWORKDAYS(1,5,"bad")',
    "set B1 formula WORKDAY(1,1,5,9)", // too many args (5 args)
    "set B2 formula WORKDAY.INTL(1,1,1,5,9)", // too many args (5 args)
  ]);

  expect(getVT("A1")).toBe("e#VALUE!");
  expect(getVT("A2")).toBe("e#VALUE!");
  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
});

test("WORKDAY/NETWORKDAYS: propagate errors and reject wrong arity", async () => {
  const { getVT } = await buildSheet([
    'set A1 formula WORKDAY("bad",1)',
    "set B1 formula WORKDAY(1)",
    "set B2 formula NETWORKDAYS(1)",
  ]);

  expect(getVT("A1").charAt(0)).toBe("e");
  expect(getVT("B1").charAt(0)).toBe("e");
  expect(getVT("B2").charAt(0)).toBe("e");
});

// ---------------------------------------------------------------------------
// WORKDAY.INTL / NETWORKDAYS.INTL
// ---------------------------------------------------------------------------

test("WORKDAY.INTL: numeric weekend code 11 (Sunday-only weekend), MS-doc-style example", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2012,3,6)",
    "set B1 formula WORKDAY.INTL(A1,15,11)",
    "set C1 formula YEAR(B1)",
    "set C2 formula MONTH(B1)",
    "set C3 formula DAY(B1)",
  ]);

  expect(getDV("C1")).toBe(2012);
  expect(getDV("C2")).toBe(3);
  expect(getDV("C3")).toBe(23);
});

test("WORKDAY.INTL: default weekend code 1 (Sat/Sun) matches plain WORKDAY", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2008,10,1)",
    "set H1 formula DATE(2008,11,26)",
    "set H2 formula DATE(2008,12,4)",
    "set H3 formula DATE(2009,1,21)",
    "set B1 formula WORKDAY(A1,151,H1:H3)",
    "set B2 formula WORKDAY.INTL(A1,151,1,H1:H3)",
  ]);

  expect(getDV("B2")).toBe(getDV("B1"));
});

test("WORKDAY.INTL: string weekend mask (Friday+Saturday off)", async () => {
  const { getDV } = await buildSheet([
    // Wednesday 2021-01-06
    "set A1 formula DATE(2021,1,6)",
    // Mon..Sun, "1" = non-working: Friday(pos5)+Saturday(pos6) off
    'set B1 formula WORKDAY.INTL(A1,1,"0000110")',
    "set C1 formula WEEKDAY(B1,2)", // ISO Monday=1..Sunday=7
  ]);

  // Thursday 2021-01-07 is the next working day (Friday/Saturday are off).
  expect(getDV("C1")).toBe(4);
});

test("NETWORKDAYS.INTL: weekend code 11 over a month span", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula DATE(2012,3,6)",
    "set A2 formula DATE(2012,4,6)",
    "set B1 formula NETWORKDAYS.INTL(A1,A2,11)",
  ]);

  expect(getDV("B1")).toBe(28);
});

test("WORKDAY.INTL/NETWORKDAYS.INTL: illegal numeric weekend code is #NUM!", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula DATE(2020,1,1)",
    "set A2 formula DATE(2020,2,1)",
    "set B1 formula WORKDAY.INTL(A1,1,8)",
    "set B2 formula NETWORKDAYS.INTL(A1,A2,10)",
  ]);

  expect(getVT("B1")).toBe("e#NUM!");
  expect(getVT("B2")).toBe("e#NUM!");
});

test("WORKDAY.INTL/NETWORKDAYS.INTL: malformed mask string is #VALUE!", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula DATE(2020,1,1)",
    "set A2 formula DATE(2020,2,1)",
    'set B1 formula WORKDAY.INTL(A1,1,"00001")', // wrong length
    'set B2 formula WORKDAY.INTL(A1,1,"000001x")', // illegal character
    'set B3 formula NETWORKDAYS.INTL(A1,A2,"1111111")', // all-off mask
  ]);

  expect(getVT("B1")).toBe("e#VALUE!");
  expect(getVT("B2")).toBe("e#VALUE!");
  expect(getVT("B3")).toBe("e#VALUE!");
});

test("WORKDAY.INTL: weekend argument propagates a referenced error and coerces a blank to #VALUE!", async () => {
  const { getVT } = await buildSheet([
    "set E1 formula 1/0",
    "set A1 formula WORKDAY.INTL(1,1,E1)",
    "set A2 formula WORKDAY.INTL(1,1,Z99)", // Z99 is a blank cell reference
  ]);

  expect(getVT("A1")).toBe("e#DIV/0!");
  expect(getVT("A2")).toBe("e#VALUE!");
});

test("WORKDAY.INTL/NETWORKDAYS.INTL: weekend argument plus holidays together", async () => {
  const { getDV } = await buildSheet([
    // Tuesday 2012-03-06
    "set A1 formula DATE(2012,3,6)",
    "set A2 formula DATE(2012,4,6)",
    // Extra holiday inside the Sunday-only-weekend span
    "set H1 formula DATE(2012,3,20)",
    "set B1 formula NETWORKDAYS.INTL(A1,A2,11,H1)",
    "set B2 formula NETWORKDAYS.INTL(A1,A2,11)",
  ]);

  expect(getDV("B1")).toBe(getDV("B2") - 1);
});
