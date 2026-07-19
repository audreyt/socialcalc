import { describe, expect, test } from "vite-plus/test";

import {
  MODE_REJECT,
  MODE_WARN,
  OP_BETWEEN,
  OP_EQ,
  OP_GE,
  OP_GT,
  OP_LE,
  OP_LT,
  OP_NE,
  OP_NOT_BETWEEN,
  OUTCOME_PASS,
  OUTCOME_REJECT,
  OUTCOME_WARN,
  RULE_CUSTOM,
  RULE_DATE,
  RULE_LIST,
  RULE_NUMBER,
  RULE_TEXT_LENGTH,
  type CustomRule,
  type DateRule,
  type ListRule,
  type NumberRule,
  type TextLengthRule,
  type ValidationContext,
  compareOk,
  computeOutcome,
  evaluateValidation,
  isBlank,
  listContainsCI,
  ruleCheckPassed,
} from "../lemma/validation";

/** Minimal context builder; only the fields a given rule kind reads matter. */
function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    raw: "",
    numericValue: 0,
    numericValid: true,
    customPass: false,
    ...overrides,
  };
}

describe("lemma/validation core predicates (Dafny/Lean surface)", () => {
  test("isBlank: exact empty string only", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank(" ")).toBe(false);
    expect(isBlank("0")).toBe(false);
    expect(isBlank("a")).toBe(false);
  });

  test("compareOk: between is inclusive on both bounds", () => {
    expect(compareOk(OP_BETWEEN, 5, 1, 10)).toBe(true);
    expect(compareOk(OP_BETWEEN, 1, 1, 10)).toBe(true);
    expect(compareOk(OP_BETWEEN, 10, 1, 10)).toBe(true);
    expect(compareOk(OP_BETWEEN, 0, 1, 10)).toBe(false);
    expect(compareOk(OP_BETWEEN, 11, 1, 10)).toBe(false);
  });

  test("compareOk: notBetween is the strict complement of between", () => {
    expect(compareOk(OP_NOT_BETWEEN, 0, 1, 10)).toBe(true);
    expect(compareOk(OP_NOT_BETWEEN, 11, 1, 10)).toBe(true);
    expect(compareOk(OP_NOT_BETWEEN, 1, 1, 10)).toBe(false);
    expect(compareOk(OP_NOT_BETWEEN, 10, 1, 10)).toBe(false);
    expect(compareOk(OP_NOT_BETWEEN, 5, 1, 10)).toBe(false);
  });

  test("compareOk: eq/ne", () => {
    expect(compareOk(OP_EQ, 5, 5, 0)).toBe(true);
    expect(compareOk(OP_EQ, 5, 6, 0)).toBe(false);
    expect(compareOk(OP_NE, 5, 6, 0)).toBe(true);
    expect(compareOk(OP_NE, 5, 5, 0)).toBe(false);
  });

  test("compareOk: gt/lt strict boundary behavior", () => {
    expect(compareOk(OP_GT, 5, 5, 0)).toBe(false);
    expect(compareOk(OP_GT, 6, 5, 0)).toBe(true);
    expect(compareOk(OP_LT, 5, 5, 0)).toBe(false);
    expect(compareOk(OP_LT, 4, 5, 0)).toBe(true);
  });

  test("compareOk: ge/le inclusive boundary behavior", () => {
    expect(compareOk(OP_GE, 5, 5, 0)).toBe(true);
    expect(compareOk(OP_GE, 4, 5, 0)).toBe(false);
    expect(compareOk(OP_LE, 5, 5, 0)).toBe(true);
    expect(compareOk(OP_LE, 6, 5, 0)).toBe(false);
  });

  test("compareOk: negative-number bounds", () => {
    expect(compareOk(OP_BETWEEN, -5, -10, -1)).toBe(true);
    expect(compareOk(OP_LT, -5, -1, 0)).toBe(true);
    expect(compareOk(OP_GT, -5, -1, 0)).toBe(false);
  });

  test("compareOk: unrecognized op is denied by default, never allowed", () => {
    expect(compareOk("bogus", 5, 5, 5)).toBe(false);
    expect(compareOk("", 0, 0, 0)).toBe(false);
  });

  test("computeOutcome: allowBlank short-circuits before any check result", () => {
    // Even a failing check is irrelevant once allowBlank+blank short-circuits.
    expect(computeOutcome(true, true, false, MODE_REJECT)).toBe(OUTCOME_PASS);
    expect(computeOutcome(true, true, false, MODE_WARN)).toBe(OUTCOME_PASS);
  });

  test("computeOutcome: allowBlank does not short-circuit a non-blank value", () => {
    expect(computeOutcome(true, false, false, MODE_REJECT)).toBe(OUTCOME_REJECT);
    expect(computeOutcome(true, false, true, MODE_REJECT)).toBe(OUTCOME_PASS);
  });

  test("computeOutcome: passing check always yields pass regardless of mode", () => {
    expect(computeOutcome(false, false, true, MODE_REJECT)).toBe(OUTCOME_PASS);
    expect(computeOutcome(false, false, true, MODE_WARN)).toBe(OUTCOME_PASS);
  });

  test("computeOutcome: failing check yields warn or reject per mode", () => {
    expect(computeOutcome(false, false, false, MODE_WARN)).toBe(OUTCOME_WARN);
    expect(computeOutcome(false, false, false, MODE_REJECT)).toBe(OUTCOME_REJECT);
  });

  test("listContainsCI: case-insensitive membership", () => {
    expect(listContainsCI(["Yes", "No"], "yes")).toBe(true);
    expect(listContainsCI(["Yes", "No"], "YES")).toBe(true);
    expect(listContainsCI(["Yes", "No"], "Yes")).toBe(true);
    expect(listContainsCI(["Yes", "No"], "maybe")).toBe(false);
  });

  test("listContainsCI: empty list matches nothing", () => {
    expect(listContainsCI([], "anything")).toBe(false);
    expect(listContainsCI([], "")).toBe(false);
  });
});

describe("lemma/validation ruleCheckPassed per rule kind", () => {
  test("list: case-insensitive membership against ctx.raw", () => {
    const rule: ListRule = {
      kind: RULE_LIST,
      values: ["Red", "Green", "Blue"],
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(ruleCheckPassed(rule, ctx({ raw: "red" }))).toBe(true);
    expect(ruleCheckPassed(rule, ctx({ raw: "RED" }))).toBe(true);
    expect(ruleCheckPassed(rule, ctx({ raw: "purple" }))).toBe(false);
  });

  test("list: empty allow-list rejects everything including empty string", () => {
    const rule: ListRule = { kind: RULE_LIST, values: [], allowBlank: false, mode: MODE_REJECT };
    expect(ruleCheckPassed(rule, ctx({ raw: "x" }))).toBe(false);
    expect(ruleCheckPassed(rule, ctx({ raw: "" }))).toBe(false);
  });

  test("number: valid parsed value drives compareOk", () => {
    const rule: NumberRule = {
      kind: RULE_NUMBER,
      op: OP_BETWEEN,
      bound1: 1,
      bound2: 10,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(ruleCheckPassed(rule, ctx({ numericValue: 5, numericValid: true }))).toBe(true);
    expect(ruleCheckPassed(rule, ctx({ numericValue: 11, numericValid: true }))).toBe(false);
  });

  test("number: unparseable raw value fails outright, never coerced to 0", () => {
    // bound would admit 0 under "between 0 10", proving the failure is from
    // numericValid gating, not from the comparison itself.
    const rule: NumberRule = {
      kind: RULE_NUMBER,
      op: OP_BETWEEN,
      bound1: 0,
      bound2: 10,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(ruleCheckPassed(rule, ctx({ numericValue: 0, numericValid: false }))).toBe(false);
  });

  test("number: whole and decimal bounds both work (plain numeric comparison)", () => {
    const rule: NumberRule = {
      kind: RULE_NUMBER,
      op: OP_LE,
      bound1: 3.5,
      bound2: 0,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(ruleCheckPassed(rule, ctx({ numericValue: 3.5, numericValid: true }))).toBe(true);
    expect(ruleCheckPassed(rule, ctx({ numericValue: 3.6, numericValid: true }))).toBe(false);
  });

  test("date: epoch-day numeric comparison, same gating as number", () => {
    const rule: DateRule = {
      kind: RULE_DATE,
      op: OP_GE,
      bound1: 46000,
      bound2: 0,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(ruleCheckPassed(rule, ctx({ numericValue: 46000, numericValid: true }))).toBe(true);
    expect(ruleCheckPassed(rule, ctx({ numericValue: 45999, numericValid: true }))).toBe(false);
    expect(ruleCheckPassed(rule, ctx({ numericValue: 46000, numericValid: false }))).toBe(false);
  });

  test("textLength: compares raw.length, not the numeric ctx fields", () => {
    const rule: TextLengthRule = {
      kind: RULE_TEXT_LENGTH,
      op: OP_LE,
      bound1: 5,
      bound2: 0,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(ruleCheckPassed(rule, ctx({ raw: "abc" }))).toBe(true);
    expect(ruleCheckPassed(rule, ctx({ raw: "abcdef" }))).toBe(false);
  });

  test("textLength: zero-length text against ge 0 always passes", () => {
    const rule: TextLengthRule = {
      kind: RULE_TEXT_LENGTH,
      op: OP_GE,
      bound1: 0,
      bound2: 0,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(ruleCheckPassed(rule, ctx({ raw: "" }))).toBe(true);
  });

  test("custom: opaque precomputed boolean passes through unchanged", () => {
    const rule: CustomRule = { kind: RULE_CUSTOM, allowBlank: false, mode: MODE_REJECT };
    expect(ruleCheckPassed(rule, ctx({ customPass: true }))).toBe(true);
    expect(ruleCheckPassed(rule, ctx({ customPass: false }))).toBe(false);
  });
});

describe("lemma/validation evaluateValidation precedence and full policy", () => {
  test("allowBlank short-circuits before the type-specific check runs", () => {
    // list would otherwise reject "" (not in values); allowBlank must win.
    const rule: ListRule = {
      kind: RULE_LIST,
      values: ["a", "b"],
      allowBlank: true,
      mode: MODE_REJECT,
    };
    expect(evaluateValidation(rule, ctx({ raw: "" }))).toBe(OUTCOME_PASS);
  });

  test("allowBlank=false does not short-circuit a blank value", () => {
    const rule: ListRule = {
      kind: RULE_LIST,
      values: ["a", "b"],
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(evaluateValidation(rule, ctx({ raw: "" }))).toBe(OUTCOME_REJECT);
  });

  test("allowBlank=true with a non-blank value still runs the real check", () => {
    const rule: ListRule = {
      kind: RULE_LIST,
      values: ["a", "b"],
      allowBlank: true,
      mode: MODE_REJECT,
    };
    expect(evaluateValidation(rule, ctx({ raw: "a" }))).toBe(OUTCOME_PASS);
    expect(evaluateValidation(rule, ctx({ raw: "z" }))).toBe(OUTCOME_REJECT);
  });

  test("mode=warn on a failing check never blocks (result is warn, not reject)", () => {
    const rule: NumberRule = {
      kind: RULE_NUMBER,
      op: OP_BETWEEN,
      bound1: 1,
      bound2: 10,
      allowBlank: false,
      mode: MODE_WARN,
    };
    expect(evaluateValidation(rule, ctx({ numericValue: 99, numericValid: true }))).toBe(
      OUTCOME_WARN,
    );
  });

  test("mode=reject on a failing check blocks", () => {
    const rule: NumberRule = {
      kind: RULE_NUMBER,
      op: OP_BETWEEN,
      bound1: 1,
      bound2: 10,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(evaluateValidation(rule, ctx({ numericValue: 99, numericValid: true }))).toBe(
      OUTCOME_REJECT,
    );
  });

  test("a passing check is always pass, independent of mode", () => {
    const warnRule: NumberRule = {
      kind: RULE_NUMBER,
      op: OP_EQ,
      bound1: 7,
      bound2: 0,
      allowBlank: false,
      mode: MODE_WARN,
    };
    const rejectRule: NumberRule = { ...warnRule, mode: MODE_REJECT };
    expect(evaluateValidation(warnRule, ctx({ numericValue: 7, numericValid: true }))).toBe(
      OUTCOME_PASS,
    );
    expect(evaluateValidation(rejectRule, ctx({ numericValue: 7, numericValid: true }))).toBe(
      OUTCOME_PASS,
    );
  });

  test("date rule end to end: reject outside range, pass on boundary", () => {
    const rule: DateRule = {
      kind: RULE_DATE,
      op: OP_BETWEEN,
      bound1: 45000,
      bound2: 46000,
      allowBlank: false,
      mode: MODE_REJECT,
    };
    expect(evaluateValidation(rule, ctx({ numericValue: 45000, numericValid: true }))).toBe(
      OUTCOME_PASS,
    );
    expect(evaluateValidation(rule, ctx({ numericValue: 46000, numericValid: true }))).toBe(
      OUTCOME_PASS,
    );
    expect(evaluateValidation(rule, ctx({ numericValue: 44999, numericValid: true }))).toBe(
      OUTCOME_REJECT,
    );
  });

  test("textLength rule end to end with warn mode", () => {
    const rule: TextLengthRule = {
      kind: RULE_TEXT_LENGTH,
      op: OP_LE,
      bound1: 10,
      bound2: 0,
      allowBlank: true,
      mode: MODE_WARN,
    };
    expect(evaluateValidation(rule, ctx({ raw: "" }))).toBe(OUTCOME_PASS); // allowBlank short-circuit
    expect(evaluateValidation(rule, ctx({ raw: "short" }))).toBe(OUTCOME_PASS);
    expect(evaluateValidation(rule, ctx({ raw: "this text is far too long" }))).toBe(OUTCOME_WARN);
  });

  test("custom rule end to end", () => {
    const rule: CustomRule = { kind: RULE_CUSTOM, allowBlank: false, mode: MODE_REJECT };
    expect(evaluateValidation(rule, ctx({ raw: "x", customPass: true }))).toBe(OUTCOME_PASS);
    expect(evaluateValidation(rule, ctx({ raw: "x", customPass: false }))).toBe(OUTCOME_REJECT);
  });
});
