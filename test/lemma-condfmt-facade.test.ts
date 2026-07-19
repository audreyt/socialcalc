import { describe, expect, test } from "vite-plus/test";

import {
  OP_BETWEEN,
  OP_EQ,
  OP_GE,
  OP_GT,
  OP_LE,
  OP_LT,
  OP_NE,
  emptyStyleFacts,
  foldCondFmtRule,
  isDuplicateValue,
  isUniqueValue,
  isValidOp,
  matchesCellIs,
  mergeStyleField,
  nextStopped,
  ruleApplies,
  shouldEvaluate,
} from "../lemma/condfmt";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("lemma/condfmt pure laws (Dafny/Lean surface)", () => {
  test("isValidOp accepts exactly the seven cell-is operator codes", () => {
    for (const op of [OP_GT, OP_GE, OP_LT, OP_LE, OP_EQ, OP_NE, OP_BETWEEN]) {
      expect(isValidOp(op)).toBe(true);
    }
    expect(isValidOp(7)).toBe(false);
    expect(isValidOp(-1)).toBe(false);
  });

  test("matchesCellIs implements gt/ge/lt/le/eq/ne correctly from the compare sign", () => {
    expect(matchesCellIs(OP_GT, 1, false, false)).toBe(true);
    expect(matchesCellIs(OP_GT, 0, false, false)).toBe(false);
    expect(matchesCellIs(OP_GE, 0, false, false)).toBe(true);
    expect(matchesCellIs(OP_GE, -1, false, false)).toBe(false);
    expect(matchesCellIs(OP_LT, -1, false, false)).toBe(true);
    expect(matchesCellIs(OP_LT, 0, false, false)).toBe(false);
    expect(matchesCellIs(OP_LE, 0, false, false)).toBe(true);
    expect(matchesCellIs(OP_LE, 1, false, false)).toBe(false);
    expect(matchesCellIs(OP_EQ, 0, false, false)).toBe(true);
    expect(matchesCellIs(OP_EQ, 1, false, false)).toBe(false);
    expect(matchesCellIs(OP_NE, 1, false, false)).toBe(true);
    expect(matchesCellIs(OP_NE, 0, false, false)).toBe(false);
  });

  test("matchesCellIs between requires both bounds precomputed true", () => {
    expect(matchesCellIs(OP_BETWEEN, 0, true, true)).toBe(true);
    expect(matchesCellIs(OP_BETWEEN, 0, true, false)).toBe(false);
    expect(matchesCellIs(OP_BETWEEN, 0, false, true)).toBe(false);
  });

  test("matchesCellIs denies unrecognized operator codes by default", () => {
    expect(matchesCellIs(99, 1, true, true)).toBe(false);
  });

  test("duplicate/unique classify by occurrence count", () => {
    expect(isDuplicateValue(0)).toBe(false);
    expect(isDuplicateValue(1)).toBe(false);
    expect(isDuplicateValue(2)).toBe(true);
    expect(isUniqueValue(0)).toBe(false);
    expect(isUniqueValue(1)).toBe(true);
    expect(isUniqueValue(2)).toBe(false);
  });

  test("shouldEvaluate/nextStopped/ruleApplies: ordered stop-if-true precedence", () => {
    expect(shouldEvaluate(false)).toBe(true);
    expect(shouldEvaluate(true)).toBe(false);

    // once stopped, always stopped regardless of subsequent match/stopIfTrue
    expect(nextStopped(true, false, false)).toBe(true);
    expect(nextStopped(true, true, false)).toBe(true);

    // not yet stopped: only a matched stopIfTrue rule stops the scan
    expect(nextStopped(false, true, true)).toBe(true);
    expect(nextStopped(false, true, false)).toBe(false);
    expect(nextStopped(false, false, true)).toBe(false);

    // a rule contributes style only if reached (not stopped before it) and matched
    expect(ruleApplies(false, true)).toBe(true);
    expect(ruleApplies(false, false)).toBe(false);
    expect(ruleApplies(true, true)).toBe(false);
  });

  test("mergeStyleField: first-applicable-rule-wins per field, later rules fill gaps", () => {
    // higher-priority rule already defined this field: later candidate never overrides
    expect(mergeStyleField(true, 5, true, true, 9)).toEqual({ defined: true, value: 5 });
    // undefined so far, an applicable rule with a defined value wins
    expect(mergeStyleField(false, 0, true, true, 9)).toEqual({ defined: true, value: 9 });
    // undefined so far, candidate doesn't apply (unreached/unmatched): stays undefined
    expect(mergeStyleField(false, 0, false, true, 9)).toEqual({ defined: false, value: 0 });
    // undefined so far, candidate applies but left this field unset: stays undefined
    expect(mergeStyleField(false, 0, true, false, 9)).toEqual({ defined: false, value: 0 });
  });

  test("foldCondFmtRule: stopIfTrue halts the fold; unset fields carry to next rule", () => {
    let acc = emptyStyleFacts();
    let stopped = false;

    // Rule 1: matches, stopIfTrue=false, sets color only.
    let step = foldCondFmtRule(stopped, true, false, acc, {
      font: { defined: false, value: 0 },
      color: { defined: true, value: 7 },
      bgcolor: { defined: false, value: 0 },
      bt: { defined: false, value: 0 },
      br: { defined: false, value: 0 },
      bb: { defined: false, value: 0 },
      bl: { defined: false, value: 0 },
    });
    stopped = step.stopped;
    acc = step.style;
    expect(stopped).toBe(false);
    expect(acc.color).toEqual({ defined: true, value: 7 });
    expect(acc.bgcolor.defined).toBe(false);

    // Rule 2: matches, stopIfTrue=true, sets bgcolor (fills gap) and tries to
    // override color (should NOT override — rule 1 already defined it).
    step = foldCondFmtRule(stopped, true, true, acc, {
      font: { defined: false, value: 0 },
      color: { defined: true, value: 42 },
      bgcolor: { defined: true, value: 3 },
      bt: { defined: false, value: 0 },
      br: { defined: false, value: 0 },
      bb: { defined: false, value: 0 },
      bl: { defined: false, value: 0 },
    });
    stopped = step.stopped;
    acc = step.style;
    expect(stopped).toBe(true); // stopIfTrue halted the scan
    expect(acc.color).toEqual({ defined: true, value: 7 }); // unchanged: first wins
    expect(acc.bgcolor).toEqual({ defined: true, value: 3 }); // filled the gap

    // Rule 3 would never be reached in the real fold once stopped=true; the
    // caller (SC.EvaluateCondFmtForCell) breaks its loop on `stopped`.
  });
});

describe("lemma/condfmt vs shipping SC.CondFmtRuleMatches/EvaluateCondFmtForCell", () => {
  test("matchesCellIs matches shipping cellis evaluation for every operator", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 5"]);
    await recalcSheet(SC, sheet);
    const red = sheet.GetStyleNum("color", "rgb(255,0,0)");

    const cases: Array<{ op: string; value1: string; expectMatch: boolean }> = [
      { op: "gt", value1: "4", expectMatch: true },
      { op: "gt", value1: "5", expectMatch: false },
      { op: "ge", value1: "5", expectMatch: true },
      { op: "ge", value1: "6", expectMatch: false },
      { op: "lt", value1: "6", expectMatch: true },
      { op: "lt", value1: "5", expectMatch: false },
      { op: "le", value1: "5", expectMatch: true },
      { op: "le", value1: "4", expectMatch: false },
      { op: "eq", value1: "5", expectMatch: true },
      { op: "eq", value1: "4", expectMatch: false },
      { op: "ne", value1: "4", expectMatch: true },
      { op: "ne", value1: "5", expectMatch: false },
    ];

    for (const c of cases) {
      await scheduleCommands(SC, sheet, ["condfmt delete 1"], false).catch(() => {});
      await scheduleCommands(SC, sheet, [
        `condfmt add 1 A1:A1\tcellis\t${c.op}\t${c.value1}\t\t\t0\t0\t${red}\t0\t0\t0\t0\t0`,
      ]);
      const style = SC.EvaluateCondFmtForCell(sheet, "A1");
      // The pure lemma law and the shipping rule-match decision must agree:
      // rederive the same op-code + cmp used inside SC.CondFmtRuleMatches and
      // confirm matchesCellIs's verified decision equals shipping's match.
      const cmp = SC.CondFmtCompare(5, Number(c.value1));
      const opCode =
        c.op == "gt"
          ? 0
          : c.op == "ge"
            ? 1
            : c.op == "lt"
              ? 2
              : c.op == "le"
                ? 3
                : c.op == "eq"
                  ? 4
                  : 5;
      expect(matchesCellIs(opCode, cmp, false, false)).toBe(c.expectMatch);
      expect(style !== null).toBe(c.expectMatch);
    }
  });

  test("ordered stop-if-true precedence matches lemma/condfmt.ts foldCondFmtRule exactly", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 10"]);
    await recalcSheet(SC, sheet);
    const red = sheet.GetStyleNum("color", "rgb(255,0,0)");
    const blue = sheet.GetStyleNum("color", "rgb(0,0,255)");

    await scheduleCommands(SC, sheet, [
      `condfmt add 1 A1:A1\tcellis\tgt\t5\t\t\t1\t0\t${red}\t0\t0\t0\t0\t0`,
      `condfmt add 2 A1:A1\tcellis\tgt\t1\t\t\t0\t0\t${blue}\t0\t0\t0\t0\t0`,
    ]);

    // Reproduce the shipping fold with the verified pure functions and
    // confirm identical stopped/style outcome to SC.EvaluateCondFmtForCell.
    let stoppedBefore = false;
    let acc = emptyStyleFacts();
    const rule1Matched = true; // A1=10 > 5
    const step1 = foldCondFmtRule(stoppedBefore, rule1Matched, true, acc, {
      font: { defined: false, value: 0 },
      color: { defined: true, value: red },
      bgcolor: { defined: false, value: 0 },
      bt: { defined: false, value: 0 },
      br: { defined: false, value: 0 },
      bb: { defined: false, value: 0 },
      bl: { defined: false, value: 0 },
    });
    stoppedBefore = step1.stopped;
    acc = step1.style;
    expect(stoppedBefore).toBe(true);

    const shippingStyle = SC.EvaluateCondFmtForCell(sheet, "A1");
    expect(shippingStyle.color).toBe(acc.color.value);
    expect(shippingStyle.color).toBe(red); // rule 2 (blue) never applied: stopped before it
  });
});
