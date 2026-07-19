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
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

/** SocialCalc max row = 65536 (js/formula1.ts SPILL_MAX_ROW / AddressFunction
 * bounds policy; also the OFFSET/INDIRECT rectangle row ceiling). */
export const MAX_ROW = 65536;

/** SocialCalc max column ZZ = 702. */
export const MAX_COL = 702;

/**
 * Column index 1..702 → A..ZZ. Out-of-range clamps (shipping rcColname).
 */
export function rcColname(c: number): string {
  //@ verify
  //@ ensures \result.length >= 1
  //@ ensures \result.length <= 2
  // length ≤ 2 already excludes the length-5 token "#REF!"; runtime tests lock alphabet.
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
  // Never emits "#REF!" (clamps); full string inequality not auto-proved by Dafny.
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
  // Converse locked by runtime tests (crToCoord is a method in Dafny, not usable in ensures).
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
  //@ ensures \result.col === -1 <==> \result.row === -1
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
 * Whether absolute-aware single-token offset would become #REF!.
 * Mirrors offsetA1Parts sentinel without string emission.
 */
export function wouldOffsetA1Ref(
  col: number,
  row: number,
  absCol: boolean,
  absRow: boolean,
  coloffset: number,
  rowoffset: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> offsetA1Parts(col, row, absCol, absRow, coloffset, rowoffset).col === -1
  const p = offsetA1Parts(col, row, absCol, absRow, coloffset, rowoffset);
  return p.col === -1;
}

/**
 * Format A1 with optional $ markers; invalid parts → "#REF!".
 */
export function formatA1Parts(col: number, row: number, absCol: boolean, absRow: boolean): string {
  //@ verify
  //@ ensures \result.length >= 2
  //@ ensures isColInBounds(col) === false || isRowInBounds(row) === false ==> \result === "#REF!"
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
  // wouldOffsetA1Ref ==> #REF! is runtime-locked; pure wouldOffsetA1Ref is Dafny/Lean-checked.
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
export function adjustAxis(value: number, start: number, delta: number, isCol: boolean): number {
  //@ verify
  //@ ensures \result === -1 || (isCol === true && \result >= 1 && \result <= 702) || (isCol === false && \result >= 1)
  //@ ensures delta === 0 ==> (\result === value || \result === -1)
  //@ ensures delta < 0 && value >= start && value < start - delta ==> \result === -1
  //@ ensures value < start && isCol === true && value >= 1 && value <= 702 ==> \result === value
  //@ ensures value < start && isCol === false && value >= 1 ==> \result === value
  if (delta < 0 && value >= start && value < start - delta) {
    return -1;
  }
  const shifted = value >= start ? value + delta : value;
  if (isCol) {
    if (shifted < 1 || shifted > 702) return -1;
    return shifted;
  }
  if (shifted < 1) return -1;
  return shifted;
}

/**
 * Whether a structural adjust of one cell would become #REF!.
 * Separated from string emission (same role as wouldOffsetRef).
 */
export function wouldAdjustRef(
  col: number,
  row: number,
  startCol: number,
  coloffset: number,
  startRow: number,
  rowoffset: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> adjustAxis(col, startCol, coloffset, true) === -1 || adjustAxis(row, startRow, rowoffset, false) === -1
  const c = adjustAxis(col, startCol, coloffset, true);
  const r = adjustAxis(row, startRow, rowoffset, false);
  return c === -1 || r === -1;
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
  //@ ensures wouldAdjustRef(col, row, startCol, coloffset, startRow, rowoffset) === true ==> \result === "#REF!"
  const c = adjustAxis(col, startCol, coloffset, true);
  const r = adjustAxis(row, startRow, rowoffset, false);
  if (c === -1 || r === -1) return "#REF!";
  return formatA1Parts(c, r, absCol, absRow);
}

/**
 * Rebuild a column index from the ranks rcColname uses.
 * collow: 0..25 (low letter A..Z).
 * colhigh: 0 = single letter A..Z; 1..26 = high letter A..Z of AA..ZZ.
 * Not a 0-based first-letter rank: AA is colhigh=1, not 0.
 */
export function colFromRcRanks(colhigh: number, collow: number): number {
  //@ verify
  //@ ensures \result === -1 || (\result >= 1 && \result <= 702)
  //@ ensures collow >= 0 && collow <= 25 && colhigh === 0 ==> \result === collow + 1
  //@ ensures collow >= 0 && collow <= 25 && colhigh >= 1 && colhigh <= 26 ==> \result === colhigh * 26 + collow + 1
  //@ ensures collow < 0 || collow > 25 || colhigh < 0 || colhigh > 26 ==> \result === -1
  if (collow < 0 || collow > 25) return -1;
  if (colhigh < 0 || colhigh > 26) return -1;
  if (colhigh === 0) return collow + 1;
  return colhigh * 26 + collow + 1;
}

/**
 * Split a clamped column into the ranks rcColname uses (floor/mod of col-1).
 * Out-of-band input is clamped first (matches shipping rcColname).
 * Round-trips with colFromRcRanks for every integer input.
 */
export function colToRcRanks(c: number): { colhigh: number; collow: number } {
  //@ verify
  //@ ensures \result.collow >= 0 && \result.collow <= 25
  //@ ensures \result.colhigh >= 0 && \result.colhigh <= 26
  // Round-trip with colFromRcRanks locked by runtime tests (Dafny pure algebra later).
  const col = clampCol(c);
  const collow = (col - 1) % 26;
  const colhigh = Math.floor((col - 1) / 26);
  return { colhigh, collow };
}

/**
 * OFFSET target-rectangle planner (mirrors js/formula-ref.ts
 * OffsetRectangle exactly, pure integer algebra over 1-based indices).
 *
 * anchorCol/anchorRow is the top-left of the source reference; rowoffset/
 * coloffset shift it (may be negative); height/width (use 0 as the "omitted"
 * sentinel — height=0/width=0 means "inherit refRows/refCols", matching the
 * runtime's `height == null` check since Dafny/Lean have no optional-number
 * concept here) size the resulting rectangle. Any edge landing outside
 * col [1, MAX_COL] or row [1, MAX_ROW] is a #REF! overflow: ok=false.
 *
 * MODELING GAP (documented, not a bug): the runtime distinguishes omitted
 * (JS `undefined`, inherits refRows/refCols) from an explicit literal 0
 * (always #REF! — see OffsetFunction/js/formula1.ts and the "explicit
 * height=0 or width=0" runtime test in formula-dynamic-reference.test.ts).
 * This pure-integer facade cannot express "argument omitted" without an
 * optional-number type Dafny/Lean don't need here, so it collapses both
 * to the 0-sentinel-means-inherit reading. The oracle cross-check test
 * (test/lemma-a1-facade.test.ts) therefore maps sentinel 0 -> `undefined`
 * before calling the shipping SC.OffsetRectangle, and the runtime's
 * explicit-zero #REF! policy is proven only at the runtime boundary, not
 * by this facade.
 *
 * OFFSET_ZERO_IDENTITY: rowoffset=0, coloffset=0, height=refRows,
 * width=refCols reproduces the original reference rectangle exactly.
 */
export function offsetRectangle(
  anchorCol: number,
  anchorRow: number,
  refRows: number,
  refCols: number,
  rowoffset: number,
  coloffset: number,
  height: number,
  width: number,
): { ok: boolean; col1: number; row1: number; col2: number; row2: number } {
  //@ verify
  //@ ensures \result.ok === true || \result.ok === false
  //@ ensures \result.ok === false ==> \result.col1 === 0 && \result.row1 === 0 && \result.col2 === 0 && \result.row2 === 0
  //@ ensures \result.ok === true ==> \result.col1 >= 1 && \result.col1 <= 702
  //@ ensures \result.ok === true ==> \result.row1 >= 1 && \result.row1 <= 65536
  //@ ensures \result.ok === true ==> \result.col2 >= \result.col1 && \result.col2 <= 702
  //@ ensures \result.ok === true ==> \result.row2 >= \result.row1 && \result.row2 <= 65536
  const h = height === 0 ? refRows : height;
  const w = width === 0 ? refCols : width;
  const col1 = anchorCol + coloffset;
  const row1 = anchorRow + rowoffset;
  if (h < 1 || w < 1 || col1 < 1 || row1 < 1 || col1 > MAX_COL || row1 > MAX_ROW) {
    return { ok: false, col1: 0, row1: 0, col2: 0, row2: 0 };
  }
  const col2 = col1 + w - 1;
  const row2 = row1 + h - 1;
  if (col2 > MAX_COL || row2 > MAX_ROW) {
    return { ok: false, col1: 0, row1: 0, col2: 0, row2: 0 };
  }
  return { ok: true, col1, row1, col2, row2 };
}

/**
 * Whether an OFFSET rectangle plan would overflow to #REF!.
 * Separated from the full result so Dafny/Lean can state the #REF! policy
 * (OFFSET bounds) without record equality (same role as wouldOffsetRef).
 */
export function wouldOffsetRectangleRef(
  anchorCol: number,
  anchorRow: number,
  refRows: number,
  refCols: number,
  rowoffset: number,
  coloffset: number,
  height: number,
  width: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  const plan = offsetRectangle(
    anchorCol,
    anchorRow,
    refRows,
    refCols,
    rowoffset,
    coloffset,
    height,
    width,
  );
  return plan.ok === false;
}

/**
 * ADDRESS row/column bounds policy (js/formula1.ts AddressFunction):
 * row in [1, MAX_ROW], col in [1, MAX_COL]. Unlike rcColname/crToCoord,
 * ADDRESS rejects out-of-band input with #VALUE! rather than clamping.
 */
export function isAddressRowInBounds(row: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> row >= 1 && row <= 65536
  return row >= 1 && row <= MAX_ROW;
}

export function isAddressColInBounds(col: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> col >= 1 && col <= 702
  return col >= 1 && col <= MAX_COL;
}

/**
 * ADDRESS abs_num policy: 1 = absolute row & col, 2 = absolute row/
 * relative col, 3 = relative row/absolute col, 4 = relative both.
 * Mirrors js/formula1.ts AddressFunction's absrow/abscol derivation.
 */
export function addressAbsRow(absNum: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> absNum === 1 || absNum === 2
  return absNum === 1 || absNum === 2;
}

export function addressAbsCol(absNum: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> absNum === 1 || absNum === 3
  return absNum === 1 || absNum === 3;
}

/**
 * Whether abs_num is one of the four documented modes.
 */
export function isValidAddressAbsNum(absNum: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> absNum >= 1 && absNum <= 4
  return absNum >= 1 && absNum <= 4;
}

/**
 * ADDRESS A1-style reference body (no sheet prefix). Requires bounds and
 * abs_num to already be validated by the caller (mirrors AddressFunction,
 * which returns #VALUE! for out-of-range/invalid input before reaching
 * this formatting step, rather than folding a sentinel string in here).
 */
export function formatAddressA1(row: number, col: number, absNum: number): string {
  //@ verify
  //@ ensures \result.length >= 2
  const absCol = addressAbsCol(absNum);
  const absRow = addressAbsRow(absNum);
  return (absCol ? "$" : "") + rcColname(col) + (absRow ? "$" : "") + row;
}

/**
 * ADDRESS R1C1-style reference body (a1=FALSE). Absolute axes emit a bare
 * row/column number; relative axes emit the offset-from-formula-cell form
 * SocialCalc's ADDRESS uses: R1C1's bracketed-offset semantics degenerate
 * to the plain row/col number here because ADDRESS has no anchor cell to
 * offset from (matches js/formula1.ts AddressFunction's R1C1 branch).
 */
export function formatAddressR1C1(row: number, col: number, absNum: number): string {
  //@ verify
  //@ ensures \result.length >= 4
  const absRow = addressAbsRow(absNum);
  const absCol = addressAbsCol(absNum);
  return "R" + (absRow ? "" + row : "[" + row + "]") + "C" + (absCol ? "" + col : "[" + col + "]");
}

/**
 * Whether a sheet name needs single-quote wrapping in ADDRESS's sheet_text
 * argument: anything that is not a bare identifier (letters/digits/'_'/'.',
 * not starting with a digit) must be quoted (mirrors js/formula1.ts
 * AddressFunction's sheet-name-quoting regex).
 */
// Not //@ verify: charCodeAt() is unsupported by the LemmaScript Lean
// backend's string emitter, so the annotation was dropped entirely
// (Dafny/Lean both skip this function -- extraction is per-annotation,
// not per-backend). Correctness here is pinned by the behavioral facade
// test (test/lemma-a1-facade.test.ts) instead of a discharged proof.
export function addressSheetNeedsQuoting(name: string): boolean {
  if (name.length === 0) return true;
  const first = name.charCodeAt(0);
  const firstOk = (first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 95; // A-Z a-z _
  let allOk = firstOk;
  for (let i = 1; i < name.length; i++) {
    const ch = name.charCodeAt(i);
    const ok =
      (ch >= 65 && ch <= 90) || // A-Z
      (ch >= 97 && ch <= 122) || // a-z
      (ch >= 48 && ch <= 57) || // 0-9
      ch === 95 || // _
      ch === 46; // .
    allOk = allOk && ok;
  }
  return !allOk;
}
