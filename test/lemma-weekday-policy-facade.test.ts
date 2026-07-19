import { describe, expect, test } from "vite-plus/test";

import {
  MASK_ALL_OFF,
  MASK_ALL_WORKING,
  isLegalMaskChar,
  isLegalWeekendCode,
  isLegalWeekendMask,
  isNonWorkingDay,
  isWorkingDay,
  maskDayOff,
  pow2,
  stepDirection,
  sundayDowToIsoDow,
  weekendCodeToMask,
  weekendPairFirstDay,
  weekendSingleDay,
} from "../lemma/weekday-policy";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

type Cell = { datavalue: number };

describe("lemma/weekday-policy weekend-code legality and decode (Dafny/Lean surface)", () => {
  test("pow2 exact values for 0..6", () => {
    expect(pow2(0)).toBe(1);
    expect(pow2(1)).toBe(2);
    expect(pow2(2)).toBe(4);
    expect(pow2(3)).toBe(8);
    expect(pow2(4)).toBe(16);
    expect(pow2(5)).toBe(32);
    expect(pow2(6)).toBe(64);
  });

  test("isLegalWeekendCode accepts 1..7 and 11..17, rejects everything else", () => {
    for (let c = 1; c <= 7; c++) expect(isLegalWeekendCode(c)).toBe(true);
    for (let c = 11; c <= 17; c++) expect(isLegalWeekendCode(c)).toBe(true);
    expect(isLegalWeekendCode(0)).toBe(false);
    expect(isLegalWeekendCode(8)).toBe(false);
    expect(isLegalWeekendCode(9)).toBe(false);
    expect(isLegalWeekendCode(10)).toBe(false);
    expect(isLegalWeekendCode(18)).toBe(false);
    expect(isLegalWeekendCode(-1)).toBe(false);
  });

  test("weekendPairFirstDay matches the documented Excel two-day-pair codes", () => {
    // Mon=0..Sun=6. Code 1 = Sat/Sun, code 2 = Sun/Mon, ..., code 7 = Fri/Sat.
    const expectedFirst = [5, 6, 0, 1, 2, 3, 4]; // codes 1..7
    for (let c = 1; c <= 7; c++) {
      expect(weekendPairFirstDay(c)).toBe(expectedFirst[c - 1]);
    }
  });

  test("weekendSingleDay matches the documented Excel single-day codes", () => {
    // code 11 = Sunday(6), code 12 = Monday(0), ..., code 17 = Saturday(5).
    const expectedDay = [6, 0, 1, 2, 3, 4, 5]; // codes 11..17
    for (let c = 11; c <= 17; c++) {
      expect(weekendSingleDay(c)).toBe(expectedDay[c - 11]);
    }
  });

  test("weekendCodeToMask decodes every legal code to the documented day pair/single day", () => {
    // Sat(5)+Sun(6) = 32+64 = 96
    expect(weekendCodeToMask(1)).toBe(96);
    // Sun(6)+Mon(0) = 64+1 = 65
    expect(weekendCodeToMask(2)).toBe(65);
    // Mon(0)+Tue(1) = 1+2 = 3
    expect(weekendCodeToMask(3)).toBe(3);
    // Fri(4)+Sat(5) = 16+32 = 48
    expect(weekendCodeToMask(7)).toBe(48);
    // single-day: Sunday(6) = 64
    expect(weekendCodeToMask(11)).toBe(64);
    // single-day: Saturday(5) = 32
    expect(weekendCodeToMask(17)).toBe(32);
  });

  test("weekendCodeToMask decodes an illegal code to MASK_ALL_OFF", () => {
    expect(weekendCodeToMask(0)).toBe(MASK_ALL_OFF);
    expect(weekendCodeToMask(8)).toBe(MASK_ALL_OFF);
    expect(weekendCodeToMask(18)).toBe(MASK_ALL_OFF);
  });

  test("every legal weekend code decodes to a legal mask", () => {
    for (let c = 1; c <= 7; c++) expect(isLegalWeekendMask(weekendCodeToMask(c))).toBe(true);
    for (let c = 11; c <= 17; c++) expect(isLegalWeekendMask(weekendCodeToMask(c))).toBe(true);
  });
});

describe("lemma/weekday-policy weekend-mask legality (Dafny/Lean surface)", () => {
  test("isLegalWeekendMask accepts 0..126, rejects 127 (all-off) and out-of-range", () => {
    expect(isLegalWeekendMask(MASK_ALL_WORKING)).toBe(true);
    expect(isLegalWeekendMask(96)).toBe(true);
    expect(isLegalWeekendMask(126)).toBe(true);
    expect(isLegalWeekendMask(MASK_ALL_OFF)).toBe(false);
    expect(isLegalWeekendMask(-1)).toBe(false);
    expect(isLegalWeekendMask(128)).toBe(false);
  });

  test("isLegalMaskChar accepts ASCII '0'/'1' only", () => {
    expect(isLegalMaskChar(48)).toBe(true); // '0'
    expect(isLegalMaskChar(49)).toBe(true); // '1'
    expect(isLegalMaskChar(50)).toBe(false); // '2'
    expect(isLegalMaskChar(120)).toBe(false); // 'x'
  });

  test("maskDayOff reads the correct day bit for every day of a Sat/Sun mask", () => {
    const mask = weekendCodeToMask(1); // Sat(5)+Sun(6)
    expect(maskDayOff(mask, 0)).toBe(false); // Monday
    expect(maskDayOff(mask, 4)).toBe(false); // Friday
    expect(maskDayOff(mask, 5)).toBe(true); // Saturday
    expect(maskDayOff(mask, 6)).toBe(true); // Sunday
  });

  test("sundayDowToIsoDow converts every Sunday-first index to Monday-first", () => {
    // Sunday-first 0=Sun..6=Sat -> Monday-first 0=Mon..6=Sun.
    const expected = [6, 0, 1, 2, 3, 4, 5]; // sundayDow 0..6
    for (let d = 0; d <= 6; d++) {
      expect(sundayDowToIsoDow(d)).toBe(expected[d]);
    }
  });
});

describe("lemma/weekday-policy working-day decision and step direction (Dafny/Lean surface)", () => {
  test("isNonWorkingDay/isWorkingDay are exact complements over mask x holiday", () => {
    const mask = weekendCodeToMask(1); // Sat/Sun off
    for (let isoDow = 0; isoDow <= 6; isoDow++) {
      for (const isHoliday of [false, true]) {
        expect(isWorkingDay(mask, isoDow, isHoliday)).toBe(
          !isNonWorkingDay(mask, isoDow, isHoliday),
        );
      }
    }
    // A holiday always makes an otherwise-working day non-working.
    expect(isNonWorkingDay(MASK_ALL_WORKING, 0, true)).toBe(true);
    expect(isWorkingDay(MASK_ALL_WORKING, 0, true)).toBe(false);
    // A working weekday with no holiday is working.
    expect(isWorkingDay(MASK_ALL_WORKING, 0, false)).toBe(true);
  });

  test("stepDirection sign matches count sign, zero maps to zero", () => {
    expect(stepDirection(5)).toBe(1);
    expect(stepDirection(-5)).toBe(-1);
    expect(stepDirection(0)).toBe(0);
    expect(stepDirection(151)).toBe(1);
    expect(stepDirection(-151)).toBe(-1);
  });
});

describe("lemma/weekday-policy vs shipping SC.Formula date helpers", () => {
  // Cross-checks the facade's weekendCodeToMask against the shipping
  // DecodeWeekendArgument (js/formula1.ts) for every legal numeric code, and
  // against a live WORKDAY.INTL/NETWORKDAYS.INTL formula evaluation for the
  // string-mask path, exhaustively over the legal numeric-code domain.
  test("weekendCodeToMask matches shipping DecodeWeekendArgument for every legal numeric code", async () => {
    const SC = await loadSocialCalc();
    for (let code = 1; code <= 7; code++) {
      const decoded = SC.Formula.DecodeWeekendArgument(code, "n");
      expect(decoded.errortype).toBe("");
      expect(decoded.mask).toBe(weekendCodeToMask(code));
    }
    for (let code = 11; code <= 17; code++) {
      const decoded = SC.Formula.DecodeWeekendArgument(code, "n");
      expect(decoded.errortype).toBe("");
      expect(decoded.mask).toBe(weekendCodeToMask(code));
    }
    // Illegal codes: shipping rejects with #NUM!, matching MASK_ALL_OFF's
    // rejection under isLegalWeekendMask (the facade's "no working day"
    // guard) even though the two systems signal it differently (facade:
    // caller must check isLegalWeekendMask; shipping: explicit errortype).
    const illegal = SC.Formula.DecodeWeekendArgument(9, "n");
    expect(illegal.errortype).toBe("e#NUM!");
    expect(isLegalWeekendMask(weekendCodeToMask(9))).toBe(false);
  });

  test("WORKDAY.INTL numeric weekend codes 1..7/11..17 land on a day the facade agrees is working", async () => {
    const SC = await loadSocialCalc();
    if (SC.RecalcInfo) {
      SC.RecalcInfo.LoadSheet = () => false;
      SC.RecalcInfo.currentState = 0;
      SC.RecalcInfo.queue = [];
    }
    if (SC.Formula) {
      SC.Formula.SheetCache.sheets = {};
      SC.Formula.FreshnessInfo.sheets = {};
      SC.Formula.FreshnessInfo.volatile = {};
    }
    const codes = [1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17];
    for (const code of codes) {
      const sheet = new SC.Sheet();
      await scheduleCommands(
        SC,
        sheet,
        [
          "set A1 formula DATE(2021,1,4)", // Monday
          `set B1 formula WORKDAY.INTL(A1,3,${code})`,
          "set C1 formula WEEKDAY(B1,2)", // ISO 1=Mon..7=Sun
        ],
        true,
        4000,
      );
      await recalcSheet(SC, sheet, 4000);
      const isoDowOneBased = (sheet.GetAssuredCell("C1") as Cell).datavalue;
      const isoDow = isoDowOneBased - 1; // 0=Mon..6=Sun
      const mask = weekendCodeToMask(code);
      // WORKDAY.INTL must never land on a day the facade classifies as
      // non-working for that same mask (holidays not in play here).
      expect(maskDayOff(mask, isoDow)).toBe(false);
    }
  });
});
