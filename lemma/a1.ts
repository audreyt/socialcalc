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
  if (c < 1) return 1;
  if (c > 702) return 702;
  return c;
}

export function clampRow(r: number): number {
  //@ verify
  //@ ensures \result >= 1
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
  return c >= 1 && c <= 702;
}

export function isRowInBounds(r: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  return r >= 1;
}

/**
 * Relative column shift used by OffsetFormulaCoords for non-absolute cols.
 * Returns -1 when the result would be #REF! (col < 1 or col > 702).
 */
export function offsetCol(col: number, coloffset: number): number {
  //@ verify
  //@ ensures \result === -1 || (\result >= 1 && \result <= 702)
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
  //@ ensures \result === -1 || (isCol === true && \result >= 1 && \result <= 702) || (isCol === false && \result >= 1) || abs === true
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
 * Single-cell relative offset to A1 text or "#REF!".
 * Mirrors OffsetFormulaCoords on a single relative (non-$) coord:
 * shift both axes; out-of-band → "#REF!"; else crToCoord (which clamps only
 * for display of in-band cells — we pre-check bounds so no silent ZZ clamp).
 */
export function offsetRelativeA1(
  col: number,
  row: number,
  coloffset: number,
  rowoffset: number,
): string {
  //@ verify
  //@ ensures \result.length >= 2
  const c = offsetCol(col, coloffset);
  const r = offsetRow(row, rowoffset);
  if (c === -1 || r === -1) return "#REF!";
  return crToCoord(c, r);
}
