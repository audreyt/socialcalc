/**
 * LemmaScript facade: pure policies underlying the dynamic-array spill runtime.
 * Non-shipping mirror of pure decision cores identified by the spill-runtime
 * design (rectangle planning, claim/collision classification, resize
 * membership, UNIQUE keep policy, and SORT tie-break stability).
 *
 * The shipping runtime for SORT()/UNIQUE()/spill now exposes matching pure
 * helpers on `SocialCalc.Formula`: `PlanSpillStatus`, `ClassifySpillClaim`,
 * `ClassifyResizeMembership`, `KeepUniqueItem`, `StableTieCompare`, and the
 * `SPILL_MAX_COL`/`SPILL_MAX_ROW`/`SPILL_MAX_CELLS` constants. This file was
 * authored before those existed, so it is deliberately built from named,
 * caller-supplied pure predicates (not raw sheet scanning) — that shape
 * turned out to match the shipping helpers exactly (see
 * `test/lemma-spill-facade.test.ts`'s "vs shipping SC.Formula spill helpers"
 * oracle suite, which cross-checks every function exhaustively/at boundary
 * cases with zero mismatches). Bounds constants below
 * (`SPILL_MAX_COL`/`SPILL_MAX_ROW`) mirror the shipping constants; the
 * verified planners themselves take every bound as a parameter rather than
 * reading a module global, so the facade produces byte-identical decisions
 * to the shipping helper when fed the same bounds/flags.
 *
 * Policy groups (mirrors AGENTS.md "Facade oracle mapping" style):
 * 1. spill rectangle planning — shape/bounds/resource-limit precedence.
 * 2. transactional claim classification — reclaimable vs collision.
 * 3. resize membership classification — retained/grown/stale/outside.
 * 4. stable UNIQUE keep policy — first-occurrence / exactly-once.
 * 5. stable SORT tie policy — nonzero comparator wins, ties keep index order.
 */

/** SocialCalc max column ZZ = 702 (mirrors lemma/a1.ts MAX_COL). */
export const SPILL_MAX_COL = 702;
/** Established spreadsheet row boundary exercised by max-row-column-boundary-regressions.test.ts. */
export const SPILL_MAX_ROW = 65536;

// --- 1. Spill rectangle planning -------------------------------------------

/** Successful plan. */
export const SPILL_OK = 0;
/** rows <= 0 or cols <= 0. */
export const SPILL_INVALID_SHAPE = 1;
/** Anchor or rectangle end falls outside [1, maxCol] x [1, maxRow]. */
export const SPILL_BOUNDS_OVERFLOW = 2;
/** Rectangle fits in bounds but exceeds the caller-supplied cell budget. */
export const SPILL_RESOURCE_LIMIT = 3;

/**
 * Whether a proposed rectangle shape is structurally valid (positive extent).
 */
export function isValidShape(rows: number, cols: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> rows > 0 && cols > 0
  return rows > 0 && cols > 0;
}

/** Last (rightmost) column of a rectangle starting at anchorCol with width cols. */
export function endCol(anchorCol: number, cols: number): number {
  //@ verify
  //@ ensures \result === anchorCol + cols - 1
  return anchorCol + cols - 1;
}

/** Last (bottommost) row of a rectangle starting at anchorRow with height rows. */
export function endRow(anchorRow: number, rows: number): number {
  //@ verify
  //@ ensures \result === anchorRow + rows - 1
  return anchorRow + rows - 1;
}

/**
 * Whether the rectangle anchored at (anchorCol, anchorRow) with the given
 * shape fits entirely inside [1, maxCol] x [1, maxRow].
 */
export function isWithinBounds(
  anchorCol: number,
  anchorRow: number,
  rows: number,
  cols: number,
  maxCol: number,
  maxRow: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> anchorCol >= 1 && anchorRow >= 1 && endCol(anchorCol, cols) <= maxCol && endRow(anchorRow, rows) <= maxRow
  return (
    anchorCol >= 1 &&
    anchorRow >= 1 &&
    endCol(anchorCol, cols) <= maxCol &&
    endRow(anchorRow, rows) <= maxRow
  );
}

/** Total cell count of a rows x cols rectangle. */
export function spillCellCount(rows: number, cols: number): number {
  //@ verify
  //@ ensures \result === rows * cols
  return rows * cols;
}

/**
 * Whether a rows x cols rectangle fits within a caller-supplied cell budget.
 * No canonical budget is shipped by this facade (the runtime cap does not
 * exist yet); callers always supply maxCells explicitly.
 */
export function isWithinBudget(rows: number, cols: number, maxCells: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> spillCellCount(rows, cols) <= maxCells
  return spillCellCount(rows, cols) <= maxCells;
}

/**
 * Full spill-rectangle plan status: invalid shape, bounds overflow, resource
 * limit, or success — checked in that fixed precedence order. On success the
 * plan has positive size, contains the anchor, ends within bounds, and its
 * cell count is exactly rows*cols (no overflow: Dafny/Lean integers are
 * unbounded, and every caller-supplied bound is well within the JS safe
 * integer range, so the runtime mirror cannot silently truncate either).
 */
export function planSpillStatus(
  anchorCol: number,
  anchorRow: number,
  rows: number,
  cols: number,
  maxCol: number,
  maxRow: number,
  maxCells: number,
): number {
  //@ verify
  //@ ensures isValidShape(rows, cols) === false ==> \result === 1
  //@ ensures isValidShape(rows, cols) === true && isWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow) === false ==> \result === 2
  //@ ensures isValidShape(rows, cols) === true && isWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow) === true && isWithinBudget(rows, cols, maxCells) === false ==> \result === 3
  //@ ensures \result === 0 <==> isValidShape(rows, cols) === true && isWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow) === true && isWithinBudget(rows, cols, maxCells) === true
  //@ ensures \result === 0 ==> rows > 0 && cols > 0
  //@ ensures \result === 0 ==> anchorCol >= 1 && anchorRow >= 1
  //@ ensures \result === 0 ==> endCol(anchorCol, cols) <= maxCol && endRow(anchorRow, rows) <= maxRow
  //@ ensures \result === 0 ==> spillCellCount(rows, cols) > 0
  //@ ensures \result === 0 ==> spillCellCount(rows, cols) === rows * cols
  if (!isValidShape(rows, cols)) return 1;
  if (!isWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow)) return 2;
  if (!isWithinBudget(rows, cols, maxCells)) return 3;
  return 0;
}

/** Materialized plan shape returned by the runtime-bridge builder below. */
export type SpillPlan = {
  status: number;
  rows: number;
  cols: number;
  count: number;
};

/**
 * Runtime-bridge assembly of a SpillPlan record from planSpillStatus /
 * spillCellCount. Not independently verified (record construction only);
 * the decision logic it wraps is fully verified above, matching the
 * lemma/lookup-result.ts split between verified precedence and unverified
 * object assembly (e.g. lookupResultType wrapping chooseLookupResult).
 */
export function planSpillRectangle(
  anchorCol: number,
  anchorRow: number,
  rows: number,
  cols: number,
  maxCol: number,
  maxRow: number,
  maxCells: number,
): SpillPlan {
  const status = planSpillStatus(anchorCol, anchorRow, rows, cols, maxCol, maxRow, maxCells);
  return {
    status,
    rows,
    cols,
    count: status === SPILL_OK ? spillCellCount(rows, cols) : 0,
  };
}

// --- 2. Transactional claim classification ----------------------------------

/** Target is the anchor cell itself. */
export const CLAIM_ALLOWED = 0;
/** Blank target, or already owned by the same anchor (reclaim on recalc). */
export const CLAIM_RECLAIMABLE = 1;
/** Foreign spill owner, user content, or a merged-cell target. */
export const CLAIM_COLLISION = 2;

/**
 * Classify one spill target cell for a transactional claim.
 *
 * Inputs are caller-precomputed facts about the target (mirrors
 * lemma/lookup-result.ts's chooseLookupResult trusting precomputed
 * hasExactKey/hasWildKey rather than re-scanning). Total over every input
 * combination; an unclassified non-blank cell (none of the flags set) is
 * denied by default (collision), never silently allowed.
 */
export function classifySpillClaim(
  isAnchorCell: boolean,
  isBlank: boolean,
  isOwnedBySameAnchor: boolean,
  isForeignSpill: boolean,
  hasUserContent: boolean,
  isMergedTarget: boolean,
): number {
  //@ verify
  //@ ensures \result === 0 || \result === 1 || \result === 2
  //@ ensures isAnchorCell === true ==> \result === 0
  //@ ensures isAnchorCell === false && (isBlank === true || isOwnedBySameAnchor === true) && isForeignSpill === false && hasUserContent === false && isMergedTarget === false ==> \result === 1
  //@ ensures isAnchorCell === false && isForeignSpill === true ==> \result === 2
  //@ ensures isAnchorCell === false && hasUserContent === true ==> \result === 2
  //@ ensures isAnchorCell === false && isMergedTarget === true ==> \result === 2
  //@ ensures isAnchorCell === false && isForeignSpill === true ==> \result !== 0 && \result !== 1
  //@ ensures isAnchorCell === false && hasUserContent === true ==> \result !== 0 && \result !== 1
  //@ ensures isAnchorCell === false && isMergedTarget === true ==> \result !== 0 && \result !== 1
  if (isAnchorCell === true) return 0;
  if (isForeignSpill === true || hasUserContent === true || isMergedTarget === true) return 2;
  if (isBlank === true || isOwnedBySameAnchor === true) return 1;
  return 2;
}

// --- 3. Resize membership classification ------------------------------------

/** Cell is within both the old and new footprint. */
export const RESIZE_RETAINED = 0;
/** Cell is newly covered: outside old footprint, inside new. */
export const RESIZE_GROWN = 1;
/** Cell was covered before but is no longer: inside old footprint, outside new. */
export const RESIZE_STALE = 2;
/** Cell is outside both footprints. */
export const RESIZE_OUTSIDE = 3;

/** Whether (col, row) lies inside a rectangle anchored at (anchorCol, anchorRow). */
export function inSpillRect(
  col: number,
  row: number,
  anchorCol: number,
  anchorRow: number,
  rows: number,
  cols: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> col >= anchorCol && col <= endCol(anchorCol, cols) && row >= anchorRow && row <= endRow(anchorRow, rows)
  return (
    col >= anchorCol &&
    col <= endCol(anchorCol, cols) &&
    row >= anchorRow &&
    row <= endRow(anchorRow, rows)
  );
}

/**
 * Classify one cell's resize membership given precomputed old/new footprint
 * membership. Mutually exclusive and complete: the four ensures branches
 * partition every (inOld, inNew) combination and \result is always exactly
 * one of the four codes.
 */
export function classifyResizeMembership(inOld: boolean, inNew: boolean): number {
  //@ verify
  //@ ensures \result === 0 || \result === 1 || \result === 2 || \result === 3
  //@ ensures inOld === true && inNew === true ==> \result === 0
  //@ ensures inOld === false && inNew === true ==> \result === 1
  //@ ensures inOld === true && inNew === false ==> \result === 2
  //@ ensures inOld === false && inNew === false ==> \result === 3
  if (inOld && inNew) return 0;
  if (!inOld && inNew) return 1;
  if (inOld && !inNew) return 2;
  return 3;
}

/** No action needed for the cell. */
export const RESIZE_ACTION_NONE = 0;
/** Stale cell must be cleared. */
export const RESIZE_ACTION_CLEAR = 1;
/** Grown cell must be claimed. */
export const RESIZE_ACTION_CLAIM = 2;

/**
 * Map a resize membership classification to its required action: stale
 * cells clear, grown cells claim, retained/outside cells are untouched.
 */
export function resizeAction(membership: number): number {
  //@ verify
  //@ ensures membership === 2 ==> \result === 1
  //@ ensures membership === 1 ==> \result === 2
  //@ ensures membership === 0 ==> \result === 0
  //@ ensures membership === 3 ==> \result === 0
  if (membership === 2) return 1;
  if (membership === 1) return 2;
  return 0;
}

// --- 4. Stable UNIQUE keep policy -------------------------------------------

/** Whether index is the first occurrence of its value (firstIndexOfValue). */
export function isFirstOccurrenceAt(index: number, firstIndexOfValue: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> index === firstIndexOfValue
  return index === firstIndexOfValue;
}

/** Whether a value's total occurrence count is exactly one. */
export function occursExactlyOnce(count: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> count === 1
  return count === 1;
}

/**
 * UNIQUE keep decision for one row at `index`, given the first index at
 * which its value occurs and its total occurrence count.
 *
 * - exactlyOnce === false: keep iff this is the first occurrence (stable —
 *   preserves the earliest position, so a later duplicate at the same value
 *   is never kept).
 * - exactlyOnce === true: keep iff the value occurs exactly once anywhere
 *   (so any duplicated value, first occurrence included, is excluded).
 */
export function keepUniqueRow(
  index: number,
  firstIndexOfValue: number,
  count: number,
  exactlyOnce: boolean,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures exactlyOnce === false ==> \result === isFirstOccurrenceAt(index, firstIndexOfValue)
  //@ ensures exactlyOnce === true ==> \result === occursExactlyOnce(count)
  //@ ensures exactlyOnce === false && index !== firstIndexOfValue ==> \result === false
  //@ ensures exactlyOnce === true && count !== 1 ==> \result === false
  if (exactlyOnce === true) return occursExactlyOnce(count);
  return isFirstOccurrenceAt(index, firstIndexOfValue);
}

// --- 5. Stable SORT tie policy -----------------------------------------------

/**
 * Stable ordering decision between two rows at original indices indexA/indexB
 * given their comparator result: a nonzero comparator result decides outright;
 * a tie (comparatorResult === 0) falls back to original index order, so tied
 * rows always retain source order (the lower original index sorts first).
 */
export function stableCompare(comparatorResult: number, indexA: number, indexB: number): number {
  //@ verify
  //@ ensures comparatorResult !== 0 ==> \result === comparatorResult
  //@ ensures comparatorResult === 0 && indexA < indexB ==> \result === -1
  //@ ensures comparatorResult === 0 && indexA > indexB ==> \result === 1
  //@ ensures comparatorResult === 0 && indexA === indexB ==> \result === 0
  if (comparatorResult !== 0) return comparatorResult;
  if (indexA < indexB) return -1;
  if (indexA > indexB) return 1;
  return 0;
}
