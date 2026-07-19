// SocialCalc data-validation engine (Excel/Sheets-style cell/range rules).
// Shipping source. Concatenated after socialcalc-3 (needs SC.Cell/Sheet,
// SC.DetermineValueType, SC.decodeFromSave/encodeForSave, SC.special_chars)
// and after formula1 + formula-ref (needs SocialCalc.Formula.ParseFormulaIntoTokens
// / evaluate_parsed_formula for formula-driven bounds/list sources/custom
// rules, and AdjustFormulaCoords/OffsetFormulaCoords/ReplaceFormulaCoords for
// structural-edit rewriting). Ambient declarations live in
// socialcalc-3.d.ts (same pattern as OffsetFormulaCoords etc., since a
// same-basename sibling .d.ts is silently shadowed by tsc when a .ts of the
// same name exists in the directory).
//
// Policy semantics mirror lemma/validation.ts (RULE_LIST/NUMBER/DATE/
// TEXT_LENGTH/CUSTOM, 8 comparison ops, allowBlank short-circuit, reject/warn
// mode) — this file is the native shipping oracle; the lemma facade test
// covers the pure decision core in isolation, matching eval-ops.ts's split
// between a standalone LemmaScript module and formula1.ts's native engine.
//
// Wire format: cell.validation is a JSON string (SocialCalc.encodeForSave'd
// for the ":" / "\n" save-format delimiters) so it round-trips through
// CellToString / CellFromStringParts exactly like any other opaque cell
// attribute (see "comment").

type DataValidationMutableRoot = {
  DataValidation: Partial<typeof SocialCalc.DataValidation>;
};

// Concatenated exactly once per bundle load (see build.ts's coreFiles list),
// so DataValidation is always undefined here -- no double-init guard needed.
const DVRoot = SocialCalc as unknown as DataValidationMutableRoot;
DVRoot.DataValidation = {};
const DV = DVRoot.DataValidation as typeof SocialCalc.DataValidation;

DV.RULE_LIST = "list";
DV.RULE_NUMBER = "number";
DV.RULE_DATE = "date";
DV.RULE_TEXT_LENGTH = "textLength";
DV.RULE_CUSTOM = "custom";
DV.MODE_REJECT = "reject";
DV.MODE_WARN = "warn";

// --- Encode / decode (opaque JSON payload inside the save-format grammar) ---

DV.EncodeRule = function (rule: SocialCalc.DataValidationRule): string {
  return JSON.stringify(rule);
};

DV.DecodeRule = function (
  encoded: string | undefined | null,
): SocialCalc.DataValidationRule | null {
  if (!encoded) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    return null; // corrupt/foreign payload: fail open, never throw during load/recalc
  }
  if (parsed && typeof parsed === "object" && "kind" in parsed && typeof parsed.kind === "string") {
    return parsed as SocialCalc.DataValidationRule;
  }
  return null;
};

// --- Verified-equivalent pure core (mirrors lemma/validation.ts exactly) ---

DV.IsBlank = function (raw: string): boolean {
  return raw === "";
};

DV.CompareOk = function (op: string, value: number, bound1: number, bound2: number): boolean {
  if (op === "between") return value >= bound1 && value <= bound2;
  if (op === "notBetween") return value < bound1 || value > bound2;
  if (op === "eq") return value === bound1;
  if (op === "ne") return value !== bound1;
  if (op === "gt") return value > bound1;
  if (op === "lt") return value < bound1;
  if (op === "ge") return value >= bound1;
  if (op === "le") return value <= bound1;
  return false;
};

DV.ComputeOutcome = function (
  allowBlank: boolean,
  isBlankValue: boolean,
  checkPassed: boolean,
  mode: string,
): SocialCalc.DVOutcome {
  if (allowBlank === true && isBlankValue === true) return "pass";
  if (checkPassed === true) return "pass";
  if (mode === "warn") return "warn";
  return "reject";
};

DV.ListContainsCI = function (values: string[], raw: string): boolean {
  const needle = raw.toLowerCase();
  for (let i = 0; i < values.length; i++) {
    if (values[i]!.toLowerCase() === needle) return true;
  }
  return false;
};

// --- Live sheet resolution (formula-driven bounds / list sources / custom) ---

/**
 * Resolves a bound spec to a number. Strings starting with "=" are
 * evaluated as formulas against the live sheet (never cached — always
 * current as of this call, so recalculated sources are honored). Plain
 * strings are parsed the same way typed cell input is (SC.DetermineValueType),
 * so "2024-01-01" works as a date bound. Numbers pass through unchanged.
 */
DV.ResolveBound = function (
  sheet: SocialCalc.Sheet,
  spec: number | string | undefined,
): { value: number; valid: boolean } {
  if (spec === undefined || spec === null) return { value: 0, valid: false };
  if (typeof spec === "number") return { value: spec, valid: !isNaN(spec) };
  const text = spec + "";
  if (text.charAt(0) === "=") {
    try {
      const parseinfo = SocialCalc.Formula.ParseFormulaIntoTokens(text.substring(1));
      const result = SocialCalc.Formula.evaluate_parsed_formula(parseinfo, sheet, false);
      const num = Number(result.value);
      return { value: num, valid: !isNaN(num) && result.type.charAt(0) !== "e" };
    } catch {
      return { value: 0, valid: false };
    }
  }
  const determined = SocialCalc.DetermineValueType(text);
  const num = Number(determined.type.charAt(0) === "n" ? determined.value : text);
  return { value: num, valid: !isNaN(num) };
};

/**
 * Resolves the allowed values for a list rule. `values` (literal items) take
 * precedence if present; otherwise `sourceRange` (an A1 range or defined
 * name) is walked live against the current sheet contents — never cached
 * across recalculation, so edits to the source range are always reflected.
 */
DV.ResolveListValues = function (
  sheet: SocialCalc.Sheet,
  rule: SocialCalc.DataValidationRule,
): string[] {
  if (rule.values && rule.values.length > 0) return rule.values;
  if (!rule.sourceRange) return [];
  let rangeText =
    rule.sourceRange.charAt(0) === "=" ? rule.sourceRange.substring(1) : rule.sourceRange;
  const name = sheet.names && sheet.names[rangeText.toUpperCase()];
  if (name) {
    rangeText = name.definition.charAt(0) === "=" ? name.definition.substring(1) : name.definition;
  }
  // ParseRange never throws (it clamps garbage input to coordToCr's
  // fallback coords instead), so a malformed sourceRange is naturally
  // handled by the loop below yielding no cells, not by try/catch — see
  // the matching note in socialcalcspreadsheetcontrol.ts's condfmt range
  // validation.
  const prange = SocialCalc.ParseRange(rangeText);
  const values: string[] = [];
  for (let row = prange.cr1.row; row <= prange.cr2.row; row++) {
    for (let col = prange.cr1.col; col <= prange.cr2.col; col++) {
      const coord = SocialCalc.crToCoord(col, row);
      const cell = sheet.cells[coord];
      if (cell && cell.datavalue !== "" && cell.datavalue != null) {
        values.push(cell.datavalue + "");
      }
    }
  }
  return values;
};

/**
 * Evaluates a custom boolean formula (no leading "="), truthy iff the
 * result is a nonzero number or logical-true ("nl") value type.
 */
DV.ComputeCustomPass = function (
  sheet: SocialCalc.Sheet,
  rule: SocialCalc.DataValidationRule,
): boolean {
  if (!rule.formula) return true; // no formula ⇒ nothing to fail
  try {
    const parseinfo = SocialCalc.Formula.ParseFormulaIntoTokens(rule.formula);
    const result = SocialCalc.Formula.evaluate_parsed_formula(parseinfo, sheet, false);
    if (result.type.charAt(0) === "e") return false;
    return Number(result.value) !== 0;
  } catch {
    return false;
  }
};

DV.RuleCheckPassed = function (
  sheet: SocialCalc.Sheet,
  rule: SocialCalc.DataValidationRule,
  raw: string,
): boolean {
  if (rule.kind === DV.RULE_LIST) {
    return DV.ListContainsCI(DV.ResolveListValues(sheet, rule), raw);
  }
  if (rule.kind === DV.RULE_CUSTOM) {
    return DV.ComputeCustomPass(sheet, rule);
  }
  if (rule.kind === DV.RULE_TEXT_LENGTH) {
    const b1 = DV.ResolveBound(sheet, rule.bound1);
    const b2 = DV.ResolveBound(sheet, rule.bound2);
    if (!b1.valid) return false;
    return DV.CompareOk(rule.op || "eq", raw.length, b1.value, b2.value);
  }
  // "number" | "date": numeric comparison over a parsed value.
  const determined = SocialCalc.DetermineValueType(raw);
  if (determined.type.charAt(0) !== "n") return false;
  const value = Number(determined.value);
  if (isNaN(value)) return false;
  const b1 = DV.ResolveBound(sheet, rule.bound1);
  const b2 = DV.ResolveBound(sheet, rule.bound2);
  if (!b1.valid) return false;
  return DV.CompareOk(rule.op || "eq", value, b1.value, b2.value);
};

DV.EvaluateRule = function (
  sheet: SocialCalc.Sheet,
  rule: SocialCalc.DataValidationRule,
  raw: string,
): SocialCalc.DVOutcome {
  const blankValue = DV.IsBlank(raw);
  const passed = DV.RuleCheckPassed(sheet, rule, raw);
  return DV.ComputeOutcome(rule.allowBlank, blankValue, passed, rule.mode);
};

DV.EvaluateForCell = function (
  sheet: SocialCalc.Sheet,
  coord: string,
  raw: string,
): SocialCalc.DataValidationOutcomeInfo {
  const cell = sheet.cells[coord];
  const rule = cell ? DV.DecodeRule(cell.validation) : null;
  if (!rule) return { outcome: "pass", rule: null };
  return { outcome: DV.EvaluateRule(sheet, rule, raw), rule: rule };
};

DV.DefaultErrorMessage = function (rule: SocialCalc.DataValidationRule): string {
  if (rule.errorMessage) return rule.errorMessage;
  return (
    SocialCalc.Constants.s_dvDefaultError || "The value entered does not meet validation rules."
  );
};

// --- Structural-edit coordinate rewriting (mirrors AdjustFormulaCoords/
// OffsetFormulaCoords/ReplaceFormulaCoords call sites for cell.formula and
// sheet.names, applied to a rule's sourceRange/formula/bound1/bound2 when
// they carry a "=" formula prefix or (for sourceRange) a bare range). Three
// call sites (insert/delete, fill/paste, move) need lockstep rewrite-field
// logic across sourceRange/formula/bound1/bound2, hence the shared helper.

function dvRewriteAllFields(
  rule: SocialCalc.DataValidationRule,
  rewrite: (text: string) => string,
): SocialCalc.DataValidationRule {
  const next: SocialCalc.DataValidationRule = { ...rule };
  if (next.sourceRange) {
    next.sourceRange =
      next.sourceRange.charAt(0) === "="
        ? "=" + rewrite(next.sourceRange.substring(1))
        : rewrite(next.sourceRange);
  }
  if (next.formula) next.formula = rewrite(next.formula);
  if (typeof next.bound1 === "string" && next.bound1.charAt(0) === "=") {
    next.bound1 = "=" + rewrite(next.bound1.substring(1));
  }
  if (typeof next.bound2 === "string" && next.bound2.charAt(0) === "=") {
    next.bound2 = "=" + rewrite(next.bound2.substring(1));
  }
  return next;
}

DV.AdjustRuleCoords = function (
  rule: SocialCalc.DataValidationRule,
  col: number,
  coloffset: number,
  row: number,
  rowoffset: number,
): SocialCalc.DataValidationRule {
  return dvRewriteAllFields(rule, (text) =>
    SocialCalc.AdjustFormulaCoords(text, col, coloffset, row, rowoffset),
  );
};

DV.OffsetRuleCoords = function (
  rule: SocialCalc.DataValidationRule,
  coloffset: number,
  rowoffset: number,
): SocialCalc.DataValidationRule {
  return dvRewriteAllFields(rule, (text) =>
    SocialCalc.OffsetFormulaCoords(text, coloffset, rowoffset),
  );
};

DV.ReplaceRuleCoords = function (
  rule: SocialCalc.DataValidationRule,
  movedto: { [coord: string]: string },
): SocialCalc.DataValidationRule {
  return dvRewriteAllFields(rule, (text) => SocialCalc.ReplaceFormulaCoords(text, movedto));
};
