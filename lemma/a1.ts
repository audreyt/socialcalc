/**
 * LemmaScript facade: pure A1 column/coord algebra.
 * Non-shipping mirror of the pure cores in js/formula-ref.ts.
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 */

const LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;

/**
 * Column index 1..702 → A..ZZ. Out-of-range clamps.
 * Mirrors SocialCalc.rcColname.
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
 * (col,row) → A1 string; col clamped 1..702, row >= 1.
 * Mirrors SocialCalc.crToCoord.
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

/**
 * Clamp helper used by rewrite overflow → #REF! policy.
 * Pure; documents col in [1,702] / row >= 1 after clamp for coord builders.
 */
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
