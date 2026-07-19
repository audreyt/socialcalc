/**
 * LemmaScript facade: pure policies underlying rich-HTML-table clipboard
 * paste normalization (`SocialCalc.HtmlTable.*` / `SocialCalc.NormalizeHtmlTableGrid`
 * in js/socialcalc-3.ts). Dafny/Lean apply to this facade; `test/lemma-html-table-facade.test.ts`
 * cross-checks every function against its shipping counterpart exhaustively
 * and at boundary cases.
 *
 * Three policy groups:
 *
 *   1. Rectangle placement  - anchor + rowSpan/colSpan -> occupied extent.
 *   2. Span collision       - whether a candidate rectangle may be placed
 *                             given which of its cells are already occupied
 *                             by an earlier row/colspan (the HTML table
 *                             "downward-growing cell" anchoring rule: an
 *                             earlier span always wins, a later cell that
 *                             would overlap it is never allowed to
 *                             overwrite it).
 *   3. Bounds policy        - whether a rectangle fits the sheet's maximum
 *                             column/row extent, and how an out-of-bounds
 *                             span is clamped so paste never silently drops
 *                             the anchor cell itself.
 *
 * Coordinates are 1-indexed sheet columns/rows, matching lemma/spill.ts and
 * lemma/a1.ts (SocialCalc's own A1 addressing is 1-indexed).
 */

/** SocialCalc max column ZZ = 702 (mirrors lemma/a1.ts / lemma/spill.ts MAX_COL). */
export const TABLE_MAX_COL = 702;
/** Established spreadsheet row boundary (mirrors lemma/spill.ts SPILL_MAX_ROW). */
export const TABLE_MAX_ROW = 65536;

// --- 1. Rectangle placement -------------------------------------------------

/**
 * Whether a proposed rowSpan/colSpan pair is structurally valid (positive
 * extent). Mirrors lemma/spill.ts's isValidShape exactly. The runtime
 * caller normalizes raw HTML `rowspan`/`colspan` attribute text via
 * `parseInt` first (always integer-or-NaN, and `NaN > 0` is false), so no
 * separate integer check is needed here for this predicate to be sound
 * against real attribute input.
 */
export function isValidSpan(rowSpan: number, colSpan: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> rowSpan > 0 && colSpan > 0
  return rowSpan > 0 && colSpan > 0;
}

/** Last (rightmost) 1-indexed column of a rectangle anchored at anchorCol spanning colSpan columns. */
export function endCol(anchorCol: number, colSpan: number): number {
  //@ verify
  //@ ensures \result === anchorCol + colSpan - 1
  return anchorCol + colSpan - 1;
}

/** Last (bottommost) 1-indexed row of a rectangle anchored at anchorRow spanning rowSpan rows. */
export function endRow(anchorRow: number, rowSpan: number): number {
  //@ verify
  //@ ensures \result === anchorRow + rowSpan - 1
  return anchorRow + rowSpan - 1;
}

/** Whether (col, row) lies inside a rectangle anchored at (anchorCol, anchorRow) with the given span. */
export function inRect(
  col: number,
  row: number,
  anchorCol: number,
  anchorRow: number,
  rowSpan: number,
  colSpan: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> col >= anchorCol && col <= endCol(anchorCol, colSpan) && row >= anchorRow && row <= endRow(anchorRow, rowSpan)
  return (
    col >= anchorCol &&
    col <= endCol(anchorCol, colSpan) &&
    row >= anchorRow &&
    row <= endRow(anchorRow, rowSpan)
  );
}

/** Total cell count of a rowSpan x colSpan rectangle. */
export function rectCellCount(rowSpan: number, colSpan: number): number {
  //@ verify
  //@ ensures \result === rowSpan * colSpan
  return rowSpan * colSpan;
}

// --- 2. Span collision -------------------------------------------------------

/** Every cell of the candidate rectangle is free. */
export const PLACEMENT_OPEN = 0;
/** At least one target cell is already claimed by an earlier row/colspan. */
export const PLACEMENT_COLLISION = 1;

/**
 * Classify a single candidate slot for rectangle placement: given whether
 * this exact (col, row) cell is already occupied by a prior placement,
 * decide whether it blocks the rectangle it belongs to.
 */
export function classifySlot(isOccupied: boolean): number {
  //@ verify
  //@ ensures \result === 0 || \result === 1
  //@ ensures isOccupied === true ==> \result === 1
  //@ ensures isOccupied === false ==> \result === 0
  return isOccupied ? PLACEMENT_COLLISION : PLACEMENT_OPEN;
}

/**
 * Combine a precomputed "any cell of the candidate rectangle already
 * occupied" fact into a placement decision. HTML's "downward-growing cell"
 * anchoring rule: the earlier row/colspan that first claimed a cell always
 * wins, so any occupied target cell blocks the whole candidate rectangle
 * (all-or-nothing placement, matching browsers' own table layout algorithm).
 */
export function canPlaceRect(anyOccupied: boolean): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> anyOccupied === false
  return !anyOccupied;
}

// --- 3. Bounds policy ---------------------------------------------------------

/** Successful plan: valid span, fits within [1, maxCol] x [1, maxRow]. */
export const TABLE_OK = 0;
/** rowSpan <= 0 or colSpan <= 0 (or non-integer). */
export const TABLE_INVALID_SPAN = 1;
/** Anchor or rectangle end falls outside [1, maxCol] x [1, maxRow]. */
export const TABLE_BOUNDS_OVERFLOW = 2;

/**
 * Whether the rectangle anchored at (anchorCol, anchorRow) with the given
 * span fits entirely inside [1, maxCol] x [1, maxRow].
 */
export function isWithinTableBounds(
  anchorCol: number,
  anchorRow: number,
  rowSpan: number,
  colSpan: number,
  maxCol: number,
  maxRow: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> anchorCol >= 1 && anchorRow >= 1 && endCol(anchorCol, colSpan) <= maxCol && endRow(anchorRow, rowSpan) <= maxRow
  return (
    anchorCol >= 1 &&
    anchorRow >= 1 &&
    endCol(anchorCol, colSpan) <= maxCol &&
    endRow(anchorRow, rowSpan) <= maxRow
  );
}

/**
 * Full placement status for one source cell's rectangle: invalid span
 * shape takes precedence over a bounds check (an invalid span cannot be
 * meaningfully bounds-checked), matching lemma/spill.ts's planSpillStatus
 * precedence order (shape validity before bounds before resource limit).
 */
export function planTableStatus(
  anchorCol: number,
  anchorRow: number,
  rowSpan: number,
  colSpan: number,
  maxCol: number,
  maxRow: number,
): number {
  //@ verify
  //@ ensures isValidSpan(rowSpan, colSpan) === false ==> \result === 1
  //@ ensures isValidSpan(rowSpan, colSpan) === true && isWithinTableBounds(anchorCol, anchorRow, rowSpan, colSpan, maxCol, maxRow) === false ==> \result === 2
  //@ ensures \result === 0 <==> isValidSpan(rowSpan, colSpan) === true && isWithinTableBounds(anchorCol, anchorRow, rowSpan, colSpan, maxCol, maxRow) === true
  if (!isValidSpan(rowSpan, colSpan)) return TABLE_INVALID_SPAN;
  if (!isWithinTableBounds(anchorCol, anchorRow, rowSpan, colSpan, maxCol, maxRow)) {
    return TABLE_BOUNDS_OVERFLOW;
  }
  return TABLE_OK;
}

/**
 * Clamp an out-of-bounds span down to the largest rectangle, anchored at
 * the same (anchorCol, anchorRow), that still fits [1, maxCol] x [1,
 * maxRow]. The anchor itself is assumed already within bounds (callers
 * stop admitting new source cells once the anchor itself overflows); this
 * only shrinks an oversized rowSpan/colSpan rather than dropping the cell,
 * so paste never silently loses the anchor's own content. Always returns
 * spans >= 1 when the anchor is within [1, maxCol] x [1, maxRow].
 * Runtime helper - not verified (Math.min/Math.max have no Dafny/Lean
 * counterpart in this facade's generated backend).
 */
export function clampSpanToBounds(
  anchorCol: number,
  anchorRow: number,
  rowSpan: number,
  colSpan: number,
  maxCol: number,
  maxRow: number,
): { rowSpan: number; colSpan: number } {
  const clampedCol = Math.min(colSpan, Math.max(1, maxCol - anchorCol + 1));
  const clampedRow = Math.min(rowSpan, Math.max(1, maxRow - anchorRow + 1));
  return { rowSpan: clampedRow, colSpan: clampedCol };
}
