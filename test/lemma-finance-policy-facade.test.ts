import { describe, expect, test } from "vite-plus/test";

import {
  DATE_BEFORE_ANCHOR,
  DATE_OK,
  PERIOD_NOT_INTEGER,
  PERIOD_NPER_INVALID,
  PERIOD_OK,
  PERIOD_OUT_OF_RANGE,
  SIGN_MISSING_BOTH,
  SIGN_MISSING_NEGATIVE,
  SIGN_MISSING_POSITIVE,
  SIGN_OK,
  ClassifyDateAgainstAnchor,
  ClassifyPeriodDomain,
  ClassifySignRequirement,
} from "../lemma/finance-policy";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

type Cell = { datavalue: unknown; valuetype: string };

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
  const getVT = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).valuetype;
  return { getVT };
}

describe("lemma/finance-policy classifiers (Dafny/Lean surface)", () => {
  test("ClassifyPeriodDomain: precedence and every boundary", () => {
    // nper-invalid wins even when per is also out of domain.
    expect(ClassifyPeriodDomain(0, 0, true)).toBe(PERIOD_NPER_INVALID);
    expect(ClassifyPeriodDomain(-1, 5, true)).toBe(PERIOD_NPER_INVALID);
    // per out of [1, nper].
    expect(ClassifyPeriodDomain(10, 0, true)).toBe(PERIOD_OUT_OF_RANGE);
    expect(ClassifyPeriodDomain(10, 11, true)).toBe(PERIOD_OUT_OF_RANGE);
    expect(ClassifyPeriodDomain(10, -1, true)).toBe(PERIOD_OUT_OF_RANGE);
    // per within range but not an integer.
    expect(ClassifyPeriodDomain(10, 5, false)).toBe(PERIOD_NOT_INTEGER);
    // fully valid, including both endpoints of the closed [1, nper] range.
    expect(ClassifyPeriodDomain(10, 1, true)).toBe(PERIOD_OK);
    expect(ClassifyPeriodDomain(10, 10, true)).toBe(PERIOD_OK);
    expect(ClassifyPeriodDomain(10, 5, true)).toBe(PERIOD_OK);
  });

  test("ClassifySignRequirement: every combination of hasPositive/hasNegative", () => {
    expect(ClassifySignRequirement(true, true)).toBe(SIGN_OK);
    expect(ClassifySignRequirement(false, true)).toBe(SIGN_MISSING_POSITIVE);
    expect(ClassifySignRequirement(true, false)).toBe(SIGN_MISSING_NEGATIVE);
    expect(ClassifySignRequirement(false, false)).toBe(SIGN_MISSING_BOTH);
  });

  test("ClassifyDateAgainstAnchor: before, equal, and after the anchor", () => {
    expect(ClassifyDateAgainstAnchor(100, 50)).toBe(DATE_BEFORE_ANCHOR);
    expect(ClassifyDateAgainstAnchor(100, 100)).toBe(DATE_OK);
    expect(ClassifyDateAgainstAnchor(100, 150)).toBe(DATE_OK);
  });
});

describe("lemma/finance-policy vs shipping PPMT/IPMT/MIRR/XIRR/XNPV", () => {
  test("ClassifyPeriodDomain matches PPMT/IPMT's #NUM! domain gate", async () => {
    const cases: Array<[nper: number, per: number, classification: number]> = [
      [0, 1, PERIOD_NPER_INVALID],
      [-1, 1, PERIOD_NPER_INVALID],
      [10, 0, PERIOD_OUT_OF_RANGE],
      [10, 11, PERIOD_OUT_OF_RANGE],
      [10, -1, PERIOD_OUT_OF_RANGE],
      [10, 5, PERIOD_OK],
      [10, 1, PERIOD_OK],
      [10, 10, PERIOD_OK],
    ];
    for (const [nper, per, classification] of cases) {
      const { getVT } = await buildSheet([`set A1 formula PPMT(0.1,${per},${nper},1000)`]);
      if (classification === PERIOD_OK) {
        expect(getVT("A1")).not.toBe("e#NUM!");
      } else {
        expect(getVT("A1")).toBe("e#NUM!");
      }
    }
    // Non-integer per: classification says PERIOD_NOT_INTEGER, so also #NUM!.
    expect(ClassifyPeriodDomain(10, 1.5, false)).toBe(PERIOD_NOT_INTEGER);
    const { getVT } = await buildSheet(["set A1 formula PPMT(0.1,1.5,10,1000)"]);
    expect(getVT("A1")).toBe("e#NUM!");
  });

  test("ClassifySignRequirement matches MIRR's #DIV/0! sign gate", async () => {
    const cases: Array<[cashflows: number[], classification: number]> = [
      [[100, 200], SIGN_MISSING_NEGATIVE],
      [[-100, -200], SIGN_MISSING_POSITIVE],
      [[-100, 200], SIGN_OK],
    ];
    for (const [cashflows, classification] of cases) {
      const commands = cashflows.map((v, i) => `set A${i + 1} value n ${v}`);
      commands.push(`set B1 formula MIRR(A1:A${cashflows.length},0.1,0.12)`);
      const { getVT } = await buildSheet(commands);
      if (classification === SIGN_OK) {
        expect(getVT("B1")).not.toBe("e#DIV/0!");
      } else {
        expect(getVT("B1")).toBe("e#DIV/0!");
      }
    }
  });

  test("ClassifySignRequirement matches XIRR's #NUM! sign gate", async () => {
    const cases: Array<[cashflows: number[], classification: number]> = [
      [[100, 200], SIGN_MISSING_NEGATIVE],
      [[-100, -200], SIGN_MISSING_POSITIVE],
      [[-100, 200], SIGN_OK],
    ];
    for (const [cashflows, classification] of cases) {
      const commands = cashflows.map((v, i) => [
        `set A${i + 1} value n ${v}`,
        `set B${i + 1} formula DATE(2020,${i + 1},1)`,
      ]);
      const flat = commands.flat();
      flat.push(`set C1 formula XIRR(A1:A${cashflows.length},B1:B${cashflows.length})`);
      const { getVT } = await buildSheet(flat);
      if (classification === SIGN_OK) {
        expect(getVT("C1")).not.toBe("e#NUM!");
      } else {
        expect(getVT("C1")).toBe("e#NUM!");
      }
    }
  });

  test("ClassifyDateAgainstAnchor matches XNPV's #NUM! date-domain gate", async () => {
    // Anchor is the first date; a later member date before the anchor is
    // rejected, one on/after it is accepted.
    const before = ClassifyDateAgainstAnchor(100, 50);
    const onOrAfter = ClassifyDateAgainstAnchor(100, 150);
    expect(before).toBe(DATE_BEFORE_ANCHOR);
    expect(onOrAfter).toBe(DATE_OK);

    const beforeCase = await buildSheet([
      "set A1 value n -100",
      "set A2 value n 50",
      "set B1 formula DATE(2020,6,1)", // anchor
      "set B2 formula DATE(2020,1,1)", // precedes anchor
      "set C1 formula XNPV(0.1,A1:A2,B1:B2)",
    ]);
    expect(beforeCase.getVT("C1")).toBe("e#NUM!");

    const okCase = await buildSheet([
      "set A1 value n -100",
      "set A2 value n 50",
      "set B1 formula DATE(2020,1,1)", // anchor
      "set B2 formula DATE(2020,6,1)", // on/after anchor
      "set C1 formula XNPV(0.1,A1:A2,B1:B2)",
    ]);
    expect(okCase.getVT("C1")).not.toBe("e#NUM!");
  });
});
