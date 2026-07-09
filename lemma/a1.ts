/**
 * LemmaScript facade: pure A1 column/coord algebra + rewrite overflow policy.
 * Non-shipping mirror of pure cores in js/formula-ref.ts.
 *
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 *
 * Design notes for LemmaScript:
 * - Prefer letter-table indexing over String.fromCharCode (Lean-friendly).
 * - Prefer integer -1 sentinel over string unions for #REF! on offset helpers.
 * - Avoid charCodeAt string parsing on the Lean path for now.
 */

const LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;

/** SocialCalc max column ZZ = 702. */
export const MAX_COL = 702;

/**
 * Column index 1..702 → A..ZZ. Out-of-range clamps (shipping rcColname).
 */
export function rcColname(c: number): string {
  //@ verify
  //@ ensures \result.length >= 1
  //@ ensures \result.length <= 2
  let col = c;
  if (col > 702) col = 702;
  if (col < 1) col = 1;
  const collow = (col - 1) % 26;
  const colhigh = Math.floor((col - 1) / 26);
  if (colhigh > 0) {
    return LETTERS[colhigh - 1]! + LETTERS[collow]!;
  }
  return LETTERS[collow]!;
}

/**
 * (col,row) → A1 string; col clamped 1..702, row >= 1 (shipping crToCoord).
 */
export function crToCoord(c: number, r: number): string {
  //@ verify
  //@ ensures \result.length >= 2
  let col = c;
  let row = r;
  if (col < 1) col = 1;
  if (col > 702) col = 702;
  if (row < 1) row = 1;
  const collow = (col - 1) % 26;
  const colhigh = Math.floor((col - 1) / 26);
  if (colhigh > 0) {
    return LETTERS[colhigh - 1]! + LETTERS[collow]! + row;
  }
  return LETTERS[collow]! + row;
}

/** Clamp helper for builders that clamp rather than #REF!. */
export function clampCol(c: number): number {
  //@ verify
  //@ ensures \result >= 1
  //@ ensures \result <= 702
  //@ ensures c >= 1 && c <= 702 ==> \result === c
  if (c < 1) return 1;
  if (c > 702) return 702;
  return c;
}

export function clampRow(r: number): number {
  //@ verify
  //@ ensures \result >= 1
  //@ ensures r >= 1 ==> \result === r
  if (r < 1) return 1;
  return r;
}

/**
 * Whether a column is inside SocialCalc's supported band [1, 702].
 * Shipping Offset/Adjust use this policy (not clamp) for #REF!.
 */
export function isColInBounds(c: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> c >= 1 && c <= 702
  return c >= 1 && c <= 702;
}

export function isRowInBounds(r: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> r >= 1
  return r >= 1;
}

/**
 * Relative column shift used by OffsetFormulaCoords for non-absolute cols.
 * Returns -1 when the result would be #REF! (col < 1 or col > 702).
 */
export function offsetCol(col: number, coloffset: number): number {
  //@ verify
  //@ ensures \result === -1 || (\result >= 1 && \result <= 702)
  //@ ensures \result !== -1 ==> \result === col + coloffset
  //@ ensures coloffset === 0 && col >= 1 && col <= 702 ==> \result === col
  //@ ensures col + coloffset < 1 || col + coloffset > 702 ==> \result === -1
  const c = col + coloffset;
  if (c < 1 || c > 702) return -1;
  return c;
}

/**
 * Relative row shift used by OffsetFormulaCoords for non-absolute rows.
 * Returns -1 when the result would be #REF! (row < 1).
 */
export function offsetRow(row: number, rowoffset: number): number {
  //@ verify
  //@ ensures \result === -1 || \result >= 1
  //@ ensures \result !== -1 ==> \result === row + rowoffset
  //@ ensures rowoffset === 0 && row >= 1 ==> \result === row
  //@ ensures row + rowoffset < 1 ==> \result === -1
  const r = row + rowoffset;
  if (r < 1) return -1;
  return r;
}

/**
 * Apply absolute-marker policy for one axis:
 * - abs === true → keep original (no offset)
 * - abs === false → offset; -1 means #REF!
 */
export function applyAxisOffset(
  value: number,
  offset: number,
  abs: boolean,
  isCol: boolean,
): number {
  //@ verify
  //@ ensures abs === true ==> \result === value
  //@ ensures abs === false && isCol === true ==> \result === offsetCol(value, offset)
  //@ ensures abs === false && isCol === false ==> \result === offsetRow(value, offset)
  if (abs) return value;
  if (isCol) return offsetCol(value, offset);
  return offsetRow(value, offset);
}

/**
 * Compose two offsets when no intermediate #REF! (OFFSET_COMPOSITION).
 * Pure integer algebra used by rewrite analysis; not a formula parser.
 */
export function composeOffsets(a: number, b: number): number {
  //@ verify
  //@ ensures \result === a + b
  return a + b;
}

/**
 * Whether a relative single-cell offset would become #REF!.
 * Separated from string emission so Dafny/Lean can prove the policy without
 * string equality on "#REF!".
 */
export function wouldOffsetRef(
  col: number,
  row: number,
  coloffset: number,
  rowoffset: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> offsetCol(col, coloffset) === -1 || offsetRow(row, rowoffset) === -1
  const c = offsetCol(col, coloffset);
  const r = offsetRow(row, rowoffset);
  return c === -1 || r === -1;
}

/**
 * Single-cell relative offset to A1 text or "#REF!".
 * Mirrors OffsetFormulaCoords on a single relative (non-$) coord.
 */
export function offsetRelativeA1(
  col: number,
  row: number,
  coloffset: number,
  rowoffset: number,
): string {
  //@ verify
  //@ ensures \result.length >= 2
  //@ ensures wouldOffsetRef(col, row, coloffset, rowoffset) === true ==> \result === "#REF!"
  // Converse (!wouldOffsetRef ==> not "#REF!") is locked by Bun matrix;
  // Dafny cannot yet prove crToCoord never emits "#REF!".
  const c = offsetCol(col, coloffset);
  const r = offsetRow(row, rowoffset);
  if (c === -1 || r === -1) return "#REF!";
  return crToCoord(c, r);
}

/**
 * Offset one A1 coordinate with independent absolute locks on each axis.
 * Mirrors OffsetFormulaCoords token rewrite for $A1 / A$1 / $A$1 / A1.
 * Returns col=-1 or row=-1 when the result is #REF!.
 */
export function offsetA1Parts(
  col: number,
  row: number,
  absCol: boolean,
  absRow: boolean,
  coloffset: number,
  rowoffset: number,
): { col: number; row: number } {
  //@ verify
  //@ ensures absCol === true ==> \result.col === col || \result.col === -1 || \result.row === -1
  //@ ensures absRow === true ==> \result.row === row || \result.col === -1 || \result.row === -1
  const c = applyAxisOffset(col, coloffset, absCol, true);
  const r = applyAxisOffset(row, rowoffset, absRow, false);
  if (c === -1 || r === -1) {
    return { col: -1, row: -1 };
  }
  // Absolute axes keep original values but final cell must still be in-band.
  if (!isColInBounds(c) || !isRowInBounds(r)) {
    return { col: -1, row: -1 };
  }
  return { col: c, row: r };
}

/**
 * Format A1 with optional $ markers; invalid parts → "#REF!".
 */
export function formatA1Parts(
  col: number,
  row: number,
  absCol: boolean,
  absRow: boolean,
): string {
  //@ verify
  //@ ensures \result.length >= 2
  if (!isColInBounds(col) || !isRowInBounds(row)) return "#REF!";
  let s = "";
  if (absCol) s += "$";
  s += rcColname(col);
  if (absRow) s += "$";
  s += row;
  return s;
}

/**
 * Full single-token OffsetFormulaCoords for one coord with abs markers.
 */
export function offsetA1(
  col: number,
  row: number,
  absCol: boolean,
  absRow: boolean,
  coloffset: number,
  rowoffset: number,
): string {
  //@ verify
  //@ ensures \result.length >= 2
  const p = offsetA1Parts(col, row, absCol, absRow, coloffset, rowoffset);
  if (p.col === -1 || p.row === -1) return "#REF!";
  return formatA1Parts(p.col, p.row, absCol, absRow);
}

/**
 * Structural adjust on one axis (column or row), mirroring AdjustFormulaCoords
 * for a non-sheet-qualified coordinate.
 *
 * start = first deleted/inserted index (1-based).
 * delta = coloffset/rowoffset (negative for delete, positive for insert).
 * isCol = true for column axis (bounds [1,702]); false for row (bounds >=1).
 *
 * Delete band (delta < 0): values in [start, start - delta) become -1 (#REF!).
 * Then values >= start shift by delta. Final out-of-band → -1.
 */
export function adjustAxis(
  value: number,
  start: number,
  delta: number,
  isCol: boolean,
): number {
  //@ verify
  //@ ensures \result === -1 || (isCol === true && \result >= 1 && \result <= 702) || (isCol === false && \result >= 1)
  //@ ensures delta === 0 ==> (\result === value || \result === -1)
  let v = value;
  if (delta < 0 && v >= start && v < start - delta) {
    return -1;
  }
  if (v >= start) {
    v = v + delta;
  }
  if (isCol) {
    if (v < 1 || v > 702) return -1;
  } else {
    if (v < 1) return -1;
  }
  return v;
}

/**
 * Structural adjust of one A1 cell (non-sheet-qualified).
 * abs markers only affect emission, not whether the underlying coord moves.
 */
export function adjustA1(
  col: number,
  row: number,
  absCol: boolean,
  absRow: boolean,
  startCol: number,
  coloffset: number,
  startRow: number,
  rowoffset: number,
): string {
  //@ verify
  //@ ensures \result.length >= 2
  const c = adjustAxis(col, startCol, coloffset, true);
  const r = adjustAxis(row, startRow, rowoffset, false);
  if (c === -1 || r === -1) return "#REF!";
  return formatA1Parts(c, r, absCol, absRow);
}
