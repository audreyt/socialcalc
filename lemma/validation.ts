/**
 * LemmaScript facade: pure Excel/Sheets-style data-validation rule/result policy.
 * Non-shipping mirror of the intended cell-level data-validation evaluator
 * (rule kind + comparison-operator + blank/mode precedence).
 *
 * Deliberately tiny — the pure decision core only. Formula evaluation for
 * `custom` rules, date parsing for `date` rules, and number parsing for
 * `number` rules all live outside this module: callers precompute those into
 * `ValidationContext` fields and this module only decides pass/warn/reject.
 *
 * Design notes:
 * - Rule/result tags follow eval-ops.ts's `as const` string-constant style
 *   (not TS `enum`) so Dafny/Lean can compare them as plain string literals,
 *   matching lookup-result.ts's resolveToken/chooseLookupResult.
 * - `list` case handling (fixed 2026-07-19): case-insensitive, mirroring
 *   Excel/Google Sheets list-validation UX ("Yes" matches list item "yes").
 * - Blank predicate: `raw === ""`, matching SocialCalc's `Cell.datavalue`
 *   default and the shipping "b" (blank) valuetype convention in
 *   js/socialcalc-3.ts / js/formula1.ts (ISBLANK, COUNTBLANK, etc.).
 * - `date` operands are epoch-day or epoch-ms numbers (caller's choice, kept
 *   consistent per rule); this module never parses date strings.
 * - `number`/`date` rules reuse one `numericValue`/`numericValid` ctx pair:
 *   a single evaluateValidation call only ever exercises one rule kind, so
 *   there's no ambiguity between the two uses.
 *
 * Precedence (fixed 2026-07-19):
 *   1. allowBlank === true && raw is blank ⇒ "pass" (short-circuit, nothing
 *      else is inspected).
 *   2. else the type-specific check runs; passing ⇒ "pass".
 *   3. else mode selects the failure outcome: "warn" or "reject".
 *
 * Vite+ tests exercise every rule kind, every comparison op, precedence, and
 * boundary cases directly against evaluateValidation (unit-level; no live
 * SocialCalc formula evaluator is wrapped here, unlike eval-ops.ts).
 */

// --- Rule kind tags ----------------------------------------------------------

/** Explicit allow-list of string values (case-insensitive match). */
export const RULE_LIST = "list" as const;
/** Numeric comparison (whole or decimal). */
export const RULE_NUMBER = "number" as const;
/** Numeric comparison over epoch-day/epoch-ms operands (caller parses dates). */
export const RULE_DATE = "date" as const;
/** Comparison against the raw value's character length. */
export const RULE_TEXT_LENGTH = "textLength" as const;
/** Opaque precomputed boolean (caller evaluates the validation formula). */
export const RULE_CUSTOM = "custom" as const;

export type RuleKind =
  | typeof RULE_LIST
  | typeof RULE_NUMBER
  | typeof RULE_DATE
  | typeof RULE_TEXT_LENGTH
  | typeof RULE_CUSTOM;

// --- Comparison operator tags -------------------------------------------------

/** bound1 <= value <= bound2 (inclusive). */
export const OP_BETWEEN = "between" as const;
/** value < bound1 || value > bound2 (strict complement of between). */
export const OP_NOT_BETWEEN = "notBetween" as const;
/** value === bound1. */
export const OP_EQ = "eq" as const;
/** value !== bound1. */
export const OP_NE = "ne" as const;
/** value > bound1. */
export const OP_GT = "gt" as const;
/** value < bound1. */
export const OP_LT = "lt" as const;
/** value >= bound1. */
export const OP_GE = "ge" as const;
/** value <= bound1. */
export const OP_LE = "le" as const;

/** ops other than between/notBetween ignore bound2. */
export type ComparisonOp =
  | typeof OP_BETWEEN
  | typeof OP_NOT_BETWEEN
  | typeof OP_EQ
  | typeof OP_NE
  | typeof OP_GT
  | typeof OP_LT
  | typeof OP_GE
  | typeof OP_LE;

// --- Mode / outcome tags -------------------------------------------------------

/** Failing the check blocks entry. */
export const MODE_REJECT = "reject" as const;
/** Failing the check only warns; entry is still allowed. */
export const MODE_WARN = "warn" as const;

export type ValidationMode = typeof MODE_REJECT | typeof MODE_WARN;

/** Check passed (including the allowBlank short-circuit). */
export const OUTCOME_PASS = "pass" as const;
/** Check failed under mode "warn". */
export const OUTCOME_WARN = "warn" as const;
/** Check failed under mode "reject". */
export const OUTCOME_REJECT = "reject" as const;

export type ValidationOutcome = typeof OUTCOME_PASS | typeof OUTCOME_WARN | typeof OUTCOME_REJECT;

// --- Rule shapes ---------------------------------------------------------------

export type ListRule = {
  kind: typeof RULE_LIST;
  /** Allowed values; case-insensitive match against ctx.raw. Empty ⇒ nothing matches. */
  values: string[];
  allowBlank: boolean;
  mode: ValidationMode;
};

export type NumberRule = {
  kind: typeof RULE_NUMBER;
  op: ComparisonOp;
  bound1: number;
  /** Only used by "between"/"notBetween". */
  bound2: number;
  allowBlank: boolean;
  mode: ValidationMode;
};

export type DateRule = {
  kind: typeof RULE_DATE;
  op: ComparisonOp;
  /** Epoch-day or epoch-ms, consistent with ctx.numericValue for this call. */
  bound1: number;
  bound2: number;
  allowBlank: boolean;
  mode: ValidationMode;
};

export type TextLengthRule = {
  kind: typeof RULE_TEXT_LENGTH;
  op: ComparisonOp;
  bound1: number;
  bound2: number;
  allowBlank: boolean;
  mode: ValidationMode;
};

export type CustomRule = {
  kind: typeof RULE_CUSTOM;
  allowBlank: boolean;
  mode: ValidationMode;
};

export type ValidationRule = ListRule | NumberRule | DateRule | TextLengthRule | CustomRule;

/**
 * Precomputed facts the caller supplies alongside a rule. Only the fields
 * relevant to the rule's kind are consulted; the rest are ignored.
 */
export type ValidationContext = {
  /** Raw cell text. Blank iff === "" (SocialCalc blank-cell convention). */
  raw: string;
  /** Parsed numeric value for "number"/"date" rules; ignored otherwise. */
  numericValue: number;
  /** Whether `raw` parsed to a valid number/date for "number"/"date" rules;
   *  false ⇒ the check fails outright (never coerced to 0). Ignored otherwise. */
  numericValid: boolean;
  /** Precomputed custom-formula result for "custom" rules; ignored otherwise. */
  customPass: boolean;
};

// --- Verified core -------------------------------------------------------------

/** Blank predicate: exact empty string only (SocialCalc's Cell.datavalue default). */
export function isBlank(raw: string): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> raw === ""
  return raw === "";
}

/**
 * Evaluate one comparison op against `value` and one or two bounds. `bound2`
 * only matters for between/notBetween. Total: an unrecognized op is denied
 * by default (false), never silently allowed.
 */
export function compareOk(op: string, value: number, bound1: number, bound2: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures op === "between" ==> (\result === true <==> value >= bound1 && value <= bound2)
  //@ ensures op === "notBetween" ==> (\result === true <==> (value < bound1 || value > bound2))
  //@ ensures op === "eq" ==> (\result === true <==> value === bound1)
  //@ ensures op === "ne" ==> (\result === true <==> value !== bound1)
  //@ ensures op === "gt" ==> (\result === true <==> value > bound1)
  //@ ensures op === "lt" ==> (\result === true <==> value < bound1)
  //@ ensures op === "ge" ==> (\result === true <==> value >= bound1)
  //@ ensures op === "le" ==> (\result === true <==> value <= bound1)
  //@ ensures op !== "between" && op !== "notBetween" && op !== "eq" && op !== "ne" && op !== "gt" && op !== "lt" && op !== "ge" && op !== "le" ==> \result === false
  if (op === "between") return value >= bound1 && value <= bound2;
  if (op === "notBetween") return value < bound1 || value > bound2;
  if (op === "eq") return value === bound1;
  if (op === "ne") return value !== bound1;
  if (op === "gt") return value > bound1;
  if (op === "lt") return value < bound1;
  if (op === "ge") return value >= bound1;
  if (op === "le") return value <= bound1;
  return false;
}

/**
 * Full precedence policy given precomputed facts: allowBlank short-circuit
 * first, then the type-specific check, then mode selects the failure
 * outcome. Total over every (allowBlank, isBlankValue, checkPassed, mode)
 * combination; \result is always exactly one of "pass"/"warn"/"reject".
 */
export function computeOutcome(
  allowBlank: boolean,
  isBlankValue: boolean,
  checkPassed: boolean,
  mode: string,
): string {
  //@ verify
  //@ ensures \result === "pass" || \result === "warn" || \result === "reject"
  //@ ensures allowBlank === true && isBlankValue === true ==> \result === "pass"
  //@ ensures (allowBlank === false || isBlankValue === false) && checkPassed === true ==> \result === "pass"
  //@ ensures (allowBlank === false || isBlankValue === false) && checkPassed === false && mode === "warn" ==> \result === "warn"
  //@ ensures (allowBlank === false || isBlankValue === false) && checkPassed === false && mode !== "warn" ==> \result === "reject"
  if (allowBlank === true && isBlankValue === true) return "pass";
  if (checkPassed === true) return "pass";
  if (mode === "warn") return "warn";
  return "reject";
}

// --- Runtime-bridge composition (loop / object dispatch — not lsc-verified) ---

/**
 * Case-insensitive linear membership scan (fixed 2026-07-19 list-rule case
 * policy). Runtime-locked, like lookup-result.ts's findExact/hasExact — loop
 * termination is trivial, not a Dafny/Lean VC.
 */
export function listContainsCI(values: string[], raw: string): boolean {
  const needle = raw.toLowerCase();
  let i = 0;
  while (i < values.length) {
    if (values[i]!.toLowerCase() === needle) return true;
    i = i + 1;
  }
  return false;
}

/**
 * Kind-dispatch for the type-specific check, built from the verified pieces
 * above. Object/union dispatch (not itself a Dafny/Lean VC), mirroring
 * lookup-result.ts's lookupResultType wrapping the verified
 * chooseLookupResult, and spill.ts's planSpillRectangle wrapping
 * planSpillStatus.
 */
export function ruleCheckPassed(rule: ValidationRule, ctx: ValidationContext): boolean {
  if (rule.kind === RULE_LIST) {
    return listContainsCI(rule.values, ctx.raw);
  }
  if (rule.kind === RULE_CUSTOM) {
    return ctx.customPass;
  }
  if (rule.kind === RULE_TEXT_LENGTH) {
    return compareOk(rule.op, ctx.raw.length, rule.bound1, rule.bound2);
  }
  // "number" | "date": both are a plain numeric comparison over a
  // caller-parsed value; an unparseable raw value fails outright.
  if (!ctx.numericValid) return false;
  return compareOk(rule.op, ctx.numericValue, rule.bound1, rule.bound2);
}

/**
 * Full pure validation policy: allowBlank short-circuit, then the
 * kind-appropriate check, then mode selects the failure outcome.
 * Mirrors shipping cell-validation intent; not wired to any shipping module
 * yet (this is the pure decision core other slices build the command/UI
 * layer on top of).
 */
export function evaluateValidation(
  rule: ValidationRule,
  ctx: ValidationContext,
): ValidationOutcome {
  const blankValue = isBlank(ctx.raw);
  const passed = ruleCheckPassed(rule, ctx);
  return computeOutcome(rule.allowBlank, blankValue, passed, rule.mode) as ValidationOutcome;
}
