/**
 * LemmaScript facade: pure row-eligibility + aggregate/count/average result
 * policy shared by COUNTIFS / AVERAGEIF / AVERAGEIFS / MAXIFS / MINIFS.
 * Non-shipping mirror of FormulaMut.CriteriaAggregateFunctions in
 * js/formula1.ts (the shared *IFS-family core added alongside COUNTIF/
 * SUMIF/SUMIFS, which keep their own pre-existing lockstep walk untouched).
 *
 * Deliberately narrow — like lemma/eval-ops.ts, this models the *decision*
 * layer (which branch of the final switch fires, and how max/min/error
 * state accumulates one matched row at a time), not the full range-walking
 * loop or SocialCalc.Formula.TestCriteria's string/wildcard parsing.
 *
 * Policy locked (js/formula1.ts CriteriaAggregateFunctions, 2026-07-19):
 *   - A row counts only when EVERY paired criteria_range/criteria test
 *     matched (AND across pairs) — allMatched.
 *   - COUNTIFS ignores the aggregate range entirely: always pushes the
 *     matched row count, regardless of any error elsewhere.
 *   - AVERAGEIF/AVERAGEIFS/MAXIFS/MINIFS all skip non-numeric matched
 *     aggregate cells (blank/text ignored) but capture the FIRST error
 *     type seen among matched aggregate cells and propagate it ahead of
 *     any numeric result — nextErrorState/resultDecision.
 *   - AVERAGEIF/AVERAGEIFS: no numeric match (and no error) -> #DIV/0!.
 *   - MAXIFS/MINIFS: no numeric match (and no error) -> 0 (NOT #DIV/0!;
 *     this is the one place *IFS diverges from the AVERAGE family per
 *     Microsoft's documented "no cells match the criteria" example).
 *   - max/min accumulate via nextMax/nextMin, first-numeric-cell seeds.
 *
 * Vite+ tests cross-check against shipping CriteriaAggregateFunctions via
 * the full formula evaluator (test/lemma-criteria-facade.test.ts).
 */

/** Function selector: COUNTIFS. */
export const FN_COUNTIFS = 0;
/** Function selector: AVERAGEIF / AVERAGEIFS (identical result policy). */
export const FN_AVERAGE = 1;
/** Function selector: MAXIFS. */
export const FN_MAXIFS = 2;
/** Function selector: MINIFS. */
export const FN_MINIFS = 3;

/** Decision: push ("n", matchedRowCount). */
export const DECIDE_COUNT = 0;
/** Decision: push (firstErrorType, 0) — an error among matched aggregate cells wins. */
export const DECIDE_ERROR = 1;
/** Decision: push (resultNumericType, sum / numericCount). */
export const DECIDE_AVERAGE = 2;
/** Decision: push ("e#DIV/0!", 0) — AVERAGE family, no numeric match. */
export const DECIDE_DIV0 = 3;
/** Decision: push ("n", maxVal). */
export const DECIDE_MAX = 4;
/** Decision: push ("n", minVal). */
export const DECIDE_MIN = 5;
/** Decision: push ("n", 0) — MAXIFS/MINIFS, no numeric match. */
export const DECIDE_ZERO = 6;

/**
 * Row eligibility: a row is aggregated only when every paired
 * criteria_range/criteria test matched (AND across pairs). Conjunction is
 * order-independent; loop scan is runtime-locked (not verified — mirrors
 * lemma/lookup-result.ts findExact/hasExact).
 */
export function allMatched(flags: boolean[]): boolean {
  let i = 0;
  while (i < flags.length) {
    if (flags[i] === false) return false;
    i = i + 1;
  }
  return true;
}

/**
 * First-error-wins accumulation: once an error has been captured, later
 * matched aggregate cells (numeric or not) never overwrite it. Returns the
 * new "have we captured an error yet" state after observing one more cell.
 */
export function nextErrorState(hadError: boolean, cellIsError: boolean): boolean {
  //@ verify
  //@ ensures \result === (hadError === true || cellIsError === true)
  if (hadError === true) return true;
  return cellIsError;
}

/**
 * Running maximum over matched numeric aggregate cells.
 * hasPrev distinguishes "no numeric cell seen yet" (seed with v) from
 * "compare against prevMax". Mirrors shipping:
 *   maxval = maxval != undefined ? (v > maxval ? v : maxval) : v;
 */
export function nextMax(hasPrev: boolean, prevMax: number, v: number): number {
  //@ verify
  //@ ensures hasPrev === false ==> \result === v
  //@ ensures hasPrev === true && v > prevMax ==> \result === v
  //@ ensures hasPrev === true && v <= prevMax ==> \result === prevMax
  if (hasPrev === false) return v;
  if (v > prevMax) return v;
  return prevMax;
}

/**
 * Running minimum over matched numeric aggregate cells.
 * Mirrors shipping: minval = minval != undefined ? (v < minval ? v : minval) : v;
 */
export function nextMin(hasPrev: boolean, prevMin: number, v: number): number {
  //@ verify
  //@ ensures hasPrev === false ==> \result === v
  //@ ensures hasPrev === true && v < prevMin ==> \result === v
  //@ ensures hasPrev === true && v >= prevMin ==> \result === prevMin
  if (hasPrev === false) return v;
  if (v < prevMin) return v;
  return prevMin;
}

/**
 * Criteria-range/aggregate-range dimension congruence policy: every operand
 * (criteria ranges, plus the aggregate range when the function has one)
 * must decode to the identical ncols/nrows rectangle, or the whole call is
 * #VALUE! (Excel/Sheets documented *IFS contract). Pure equality check —
 * DecodeIfsRangeOperand itself (coord/range/cross-sheet resolution) is the
 * runtime bridge, not modeled here (same split as lemma/a1.ts vs. the
 * shipping coord parser it mirrors).
 */
export function shapesMatch(
  ncolsA: number,
  nrowsA: number,
  ncolsB: number,
  nrowsB: number,
): boolean {
  //@ verify
  //@ ensures \result === true <==> (ncolsA === ncolsB && nrowsA === nrowsB)
  return ncolsA === ncolsB && nrowsA === nrowsB;
}

/**
 * The shared result-policy decision table: given which *IFS-family function
 * is running, whether an error was captured among matched aggregate cells,
 * and how many matched aggregate cells were numeric, decide which branch of
 * FormulaMut.CriteriaAggregateFunctions' final switch fires.
 *
 * numericCount > 0 is also the shipping "maxval/minval is defined" signal
 * (both are only ever assigned inside the isNumericType branch), so one
 * count parameter drives the AVERAGE/MAXIFS/MINIFS empty-match branches.
 *
 * VCs lock:
 *   - COUNTIFS always counts, independent of error/numeric state.
 *   - Every other function propagates a captured error ahead of any
 *     numeric result.
 *   - AVERAGE family empty-numeric-match -> DIV0 (not zero).
 *   - MAXIFS/MINIFS empty-numeric-match -> zero (not DIV0) — the
 *     documented Excel/Sheets divergence from AVERAGEIFS.
 */
export function resultDecision(fn: number, errorPresent: boolean, numericCount: number): number {
  //@ verify
  //@ ensures fn === 0 ==> \result === 0
  //@ ensures fn !== 0 && errorPresent === true ==> \result === 1
  //@ ensures fn === 1 && errorPresent === false && numericCount > 0 ==> \result === 2
  //@ ensures fn === 1 && errorPresent === false && numericCount <= 0 ==> \result === 3
  //@ ensures fn === 2 && errorPresent === false && numericCount > 0 ==> \result === 4
  //@ ensures fn === 2 && errorPresent === false && numericCount <= 0 ==> \result === 6
  //@ ensures fn === 3 && errorPresent === false && numericCount > 0 ==> \result === 5
  //@ ensures fn === 3 && errorPresent === false && numericCount <= 0 ==> \result === 6
  if (fn === 0) return 0;
  if (errorPresent === true) return 1;
  if (fn === 1) {
    if (numericCount > 0) return 2;
    return 3;
  }
  if (fn === 2) {
    if (numericCount > 0) return 4;
    return 6;
  }
  // fn === 3 (MINIFS)
  if (numericCount > 0) return 5;
  return 6;
}
