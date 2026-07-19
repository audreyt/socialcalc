/**
 * LemmaScript facade: pure conditional-formatting rule match and ordered
 * stop/precedence classification.
 * Non-shipping mirror of the condfmt policy in js/socialcalc-3.ts
 * (SC.CondFmtRuleMatches / SC.EvaluateCondFmtForCell).
 *
 * Rules are evaluated in a fixed priority order (array index 0 = highest
 * priority, mirroring sheet.condfmtRules). Scanning proceeds rule-by-rule;
 * a matched rule with stopIfTrue=true halts the scan for that cell (no
 * lower-priority rule is evaluated or contributes formatting), mirroring
 * Excel/Sheets "Stop if true". A matched rule with stopIfTrue=false still
 * contributes formatting and lets the scan continue, so a later rule can
 * fill in any style field the earlier rule left undefined.
 *
 * Runtime folds these scalar per-rule functions across sheet.condfmtRules
 * for one target cell; per-value-type predicate evaluation (numeric
 * comparison sign, text substring, blank test, duplicate/unique occurrence
 * count, custom formula truthiness) happens in the caller and is passed in
 * as precomputed facts, matching the "trust precomputed" convention used by
 * lemma/lookup-result.ts (chooseLookupResult) and lemma/spill.ts
 * (classifySpillClaim): full string scanning / formula evaluation stays
 * runtime-tested, only the closed-form decision is verified here.
 *
 * Vite+ tests cross-check against the shipping engine.
 */

// --- 1. Cell-is comparison operators -----------------------------------------

/** value > operand */
export const OP_GT = 0;
/** value >= operand */
export const OP_GE = 1;
/** value < operand */
export const OP_LT = 2;
/** value <= operand */
export const OP_LE = 3;
/** value = operand */
export const OP_EQ = 4;
/** value <> operand */
export const OP_NE = 5;
/** operand1 <= value <= operand2 */
export const OP_BETWEEN = 6;

/**
 * Whether an operator code is one of the seven supported cell-is comparators.
 */
export function isValidOp(op: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> (op === 0 || op === 1 || op === 2 || op === 3 || op === 4 || op === 5 || op === 6)
  return op === 0 || op === 1 || op === 2 || op === 3 || op === 4 || op === 5 || op === 6;
}

/**
 * Cell-is comparison decision. `cmp` is a caller-precomputed three-way
 * compare of (cellValue, operand1): negative, zero, or positive. `geLow`/
 * `leHigh` are caller-precomputed for the OP_BETWEEN case only
 * (cellValue >= operand1 and cellValue <= operand2 respectively); ignored
 * by every other operator. An unrecognized op is denied by default (never
 * silently matches), mirroring classifySpillClaim's collision-by-default
 * policy for unclassified inputs.
 */
export function matchesCellIs(op: number, cmp: number, geLow: boolean, leHigh: boolean): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures op === 0 ==> (\result === true <==> cmp > 0)
  //@ ensures op === 1 ==> (\result === true <==> cmp >= 0)
  //@ ensures op === 2 ==> (\result === true <==> cmp < 0)
  //@ ensures op === 3 ==> (\result === true <==> cmp <= 0)
  //@ ensures op === 4 ==> (\result === true <==> cmp === 0)
  //@ ensures op === 5 ==> (\result === true <==> cmp !== 0)
  //@ ensures op === 6 ==> (\result === true <==> (geLow === true && leHigh === true))
  //@ ensures (op !== 0 && op !== 1 && op !== 2 && op !== 3 && op !== 4 && op !== 5 && op !== 6) ==> \result === false
  if (op === 0) return cmp > 0;
  if (op === 1) return cmp >= 0;
  if (op === 2) return cmp < 0;
  if (op === 3) return cmp <= 0;
  if (op === 4) return cmp === 0;
  if (op === 5) return cmp !== 0;
  if (op === 6) return geLow === true && leHigh === true;
  return false;
}

// --- 2. Duplicate / unique occurrence classification -------------------------

/** Whether a value's occurrence count in its range marks it a duplicate (appears more than once). */
export function isDuplicateValue(count: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> count > 1
  return count > 1;
}

/** Whether a value's occurrence count in its range marks it unique (appears exactly once). */
export function isUniqueValue(count: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> count === 1
  return count === 1;
}

// --- 3. Ordered stop/precedence classification -------------------------------

/**
 * Whether the rule at the current scan position should be evaluated at all:
 * true iff no earlier matched stopIfTrue rule already halted the scan for
 * this cell.
 */
export function shouldEvaluate(stoppedBefore: boolean): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> stoppedBefore === false
  return stoppedBefore === false;
}

/**
 * Next `stoppedBefore` value after considering one rule: once stopped,
 * stays stopped; otherwise stops iff this rule matched and is stopIfTrue.
 */
export function nextStopped(
  stoppedBefore: boolean,
  matched: boolean,
  stopIfTrue: boolean,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures stoppedBefore === true ==> \result === true
  //@ ensures stoppedBefore === false ==> (\result === true <==> (matched === true && stopIfTrue === true))
  if (stoppedBefore === true) return true;
  return matched === true && stopIfTrue === true;
}

/**
 * Whether one rule's style should be merged into the cell's applicable
 * ("winning") set: reached (scan not stopped before it) and matched.
 * A rule that is unreached never contributes, regardless of match.
 */
export function ruleApplies(stoppedBefore: boolean, matched: boolean): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> (stoppedBefore === false && matched === true)
  return stoppedBefore === false && matched === true;
}

// --- 4. Style-field precedence merge -----------------------------------------

/** Merge state for a single style field (e.g. color, font, bgcolor, one border side). */
export type FieldMerge = { defined: boolean; value: number };

/**
 * Fold one candidate rule's style field into the running merge state for a
 * single style property. First-applicable-rule-wins per field: once a
 * higher-priority applicable rule has defined the field, later rules never
 * override it — but a later applicable rule CAN fill in a field an earlier
 * applicable (non-stopping) rule left undefined. Mirrors Excel/Sheets
 * behavior where a stopIfTrue=false match still lets subsequent rules
 * supply properties it did not set.
 */
export function mergeStyleField(
  currentDefined: boolean,
  currentValue: number,
  candidateApplies: boolean,
  candidateDefined: boolean,
  candidateValue: number,
): FieldMerge {
  //@ verify
  //@ ensures currentDefined === true ==> (\result.defined === true && \result.value === currentValue)
  //@ ensures currentDefined === false && candidateApplies === true && candidateDefined === true ==> (\result.defined === true && \result.value === candidateValue)
  //@ ensures currentDefined === false && (candidateApplies === false || candidateDefined === false) ==> \result.defined === false
  if (currentDefined === true) {
    return { defined: true, value: currentValue };
  }
  if (candidateApplies === true && candidateDefined === true) {
    return { defined: true, value: candidateValue };
  }
  return { defined: false, value: currentValue };
}

// --- 5. Runtime-bridge fold (not independently verified: composes the above) -

/** One rule's precomputed style-field facts, keyed the same as CondFmtStyle in socialcalc-3.ts. */
export type CondFmtStyleFacts = {
  font: FieldMerge;
  color: FieldMerge;
  bgcolor: FieldMerge;
  bt: FieldMerge;
  br: FieldMerge;
  bb: FieldMerge;
  bl: FieldMerge;
};

/** Empty (all-undefined) style accumulator, the fold's initial state. */
export function emptyStyleFacts(): CondFmtStyleFacts {
  const empty: FieldMerge = { defined: false, value: 0 };
  return {
    font: empty,
    color: empty,
    bgcolor: empty,
    bt: empty,
    br: empty,
    bb: empty,
    bl: empty,
  };
}

/**
 * Fold one rule's precomputed match/stop facts and style fields into the
 * running (stoppedBefore, accumulated-style) state. Runtime-facing
 * composition of the verified scalar functions above; not independently
 * verified (record folding is a straightforward wiring, same convention as
 * lemma/spill.ts's planSpillRectangle bridging planSpillStatus).
 */
export function foldCondFmtRule(
  stoppedBefore: boolean,
  matched: boolean,
  stopIfTrue: boolean,
  acc: CondFmtStyleFacts,
  candidate: {
    font: { defined: boolean; value: number };
    color: { defined: boolean; value: number };
    bgcolor: { defined: boolean; value: number };
    bt: { defined: boolean; value: number };
    br: { defined: boolean; value: number };
    bb: { defined: boolean; value: number };
    bl: { defined: boolean; value: number };
  },
): { stopped: boolean; style: CondFmtStyleFacts } {
  const applies = ruleApplies(stoppedBefore, matched);
  const stopped = nextStopped(stoppedBefore, matched, stopIfTrue);
  const style: CondFmtStyleFacts = {
    font: mergeStyleField(
      acc.font.defined,
      acc.font.value,
      applies,
      candidate.font.defined,
      candidate.font.value,
    ),
    color: mergeStyleField(
      acc.color.defined,
      acc.color.value,
      applies,
      candidate.color.defined,
      candidate.color.value,
    ),
    bgcolor: mergeStyleField(
      acc.bgcolor.defined,
      acc.bgcolor.value,
      applies,
      candidate.bgcolor.defined,
      candidate.bgcolor.value,
    ),
    bt: mergeStyleField(
      acc.bt.defined,
      acc.bt.value,
      applies,
      candidate.bt.defined,
      candidate.bt.value,
    ),
    br: mergeStyleField(
      acc.br.defined,
      acc.br.value,
      applies,
      candidate.br.defined,
      candidate.br.value,
    ),
    bb: mergeStyleField(
      acc.bb.defined,
      acc.bb.value,
      applies,
      candidate.bb.defined,
      candidate.bb.value,
    ),
    bl: mergeStyleField(
      acc.bl.defined,
      acc.bl.value,
      applies,
      candidate.bl.defined,
      candidate.bl.value,
    ),
  };
  return { stopped, style };
}
