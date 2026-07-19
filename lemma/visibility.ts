/**
 * LemmaScript facade: pure policies underlying AutoFilter row visibility.
 *
 * A spreadsheet row's effective visibility is composed from two independent
 * hidden-state axes that the shipping runtime keeps as separate maps
 * (`sheet.rowattribs.hide` for manual hide, `sheet.rowattribs.filterhide`
 * for AutoFilter-derived hide — see js/socialcalc-3.ts `RowEffectivelyHidden`
 * and `RecomputeAutoFilters`). This facade proves the composition, clear
 * isolation, and idempotent-recompute properties independent of the DOM/
 * sheet-object runtime.
 *
 * Policy groups:
 * 1. visibility union — a row is effectively hidden iff manually hidden or
 *    filter-hidden (inclusive OR, never additional silent causes).
 * 2. clear isolation — clearing filter-hidden state never touches manual
 *    hidden state, and clearing manual hidden state never touches
 *    filter-hidden state (the two axes are independently owned).
 * 3. idempotent recompute — applying the same filter-membership decision
 *    twice to the same row produces the same filter-hidden result as
 *    applying it once (recompute is a pure function of current row data,
 *    not an accumulating toggle).
 */

/** Effective hidden state is the inclusive OR of manual and filter hide. */
export function isEffectivelyHidden(manualHidden: boolean, filterHidden: boolean): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> manualHidden === true || filterHidden === true
  return manualHidden === true || filterHidden === true;
}

/**
 * Clearing filter-hidden state (e.g. "clear all filters") must not disturb
 * manual hidden state: the manual axis after the clear equals the manual
 * axis before it.
 */
export function manualHiddenAfterFilterClear(manualHiddenBefore: boolean): boolean {
  //@ verify
  //@ ensures \result === manualHiddenBefore
  return manualHiddenBefore;
}

/**
 * Clearing manual hidden state (e.g. unhide row) must not disturb
 * filter-hidden state: the filter axis after the clear equals the filter
 * axis before it.
 */
export function filterHiddenAfterManualClear(filterHiddenBefore: boolean): boolean {
  //@ verify
  //@ ensures \result === filterHiddenBefore
  return filterHiddenBefore;
}

/**
 * Recompute decision for one row's filter-hidden bit: hidden iff the row
 * fails at least one active column criterion (failsAnyCriterion), computed
 * fresh from current cell data every time (no dependency on the prior
 * filter-hidden bit) — this is what makes repeated recompute idempotent.
 */
export function recomputeFilterHidden(failsAnyCriterion: boolean): boolean {
  //@ verify
  //@ ensures \result === failsAnyCriterion
  return failsAnyCriterion;
}

/**
 * Idempotence: recomputing twice from the same `failsAnyCriterion` input
 * yields the same bit both times (trivial for a pure function of a single
 * input, but this is exactly the property RecomputeAutoFilters relies on to
 * be safely re-invoked after every value/recalc/structural-edit change
 * without drifting).
 */
export function recomputeIsIdempotent(failsAnyCriterion: boolean): boolean {
  //@ verify
  //@ ensures \result === true
  return recomputeFilterHidden(failsAnyCriterion) === recomputeFilterHidden(failsAnyCriterion);
}

/** Row index is inside the filter's data band (below header, at/above first data row, at/below last data row). */
export function isInFilterDataBand(row: number, headerRow: number, lastRow: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> row > headerRow && row <= lastRow
  return row > headerRow && row <= lastRow;
}

/**
 * A row outside the filter's data band is never filter-hidden by that
 * filter, regardless of criteria — the header row and any row below the
 * filter's range are structurally exempt.
 */
export function outOfBandNeverFilterHidden(inBand: boolean, failsAnyCriterion: boolean): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> inBand === true && failsAnyCriterion === true
  return inBand === true && failsAnyCriterion === true;
}
