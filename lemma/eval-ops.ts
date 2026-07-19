/**
 * LemmaScript facade: pure / and & error-propagation lattice.
 * Non-shipping mirror of EvaluatePolish operator policy in js/formula1.ts.
 *
 * Deliberately tiny — type/error codes only, not full TypeLookupTable values.
 *
 *   type codes:  N=0 number, T=1 text, B=2 blank
 *   error codes: OK=0, REF=10, DIV0=11, VALUE=12
 *   result type: same space; errors use 10/11/12 as "type"
 *
 * Policy (fixed 2026-07-09):
 *   div: error lattice first (left error wins, else right), then zero → DIV0
 *   concat: either-side error propagates; left wins if both
 *
 * Vite+ tests cross-check against shipping evaluate_parsed_formula.
 * Does not replace formula-coverage on the real evaluator.
 */

/** Number / numeric-compatible. */
export const TY_N = 0;
/** Text. */
export const TY_T = 1;
/** Blank. */
export const TY_B = 2;

/** No error (success type is TY_N / TY_T / TY_B). */
export const ERR_OK = 0;
/** #REF! */
export const ERR_REF = 10;
/** #DIV/0! */
export const ERR_DIV0 = 11;
/** #VALUE! */
export const ERR_VALUE = 12;
/** #N/A (distinguished from the general error lattice; used by IFNA policy). */
export const ERR_NA = 13;

/**
 * Whether a type code is specifically the #N/A error. Distinct from the
 * general isErrorType lattice check (which only covers REF/DIV0/VALUE, the
 * codes arithType/divType/concatType actually propagate) — IFNA needs to
 * tell #N/A apart from every other error, so it gets its own pure classifier.
 */
export function isNAType(t: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> t === 13
  return t === 13;
}

/**
 * Whether a type code is an error code (10+).
 */
export function isErrorType(t: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> t === 10 || t === 11 || t === 12
  return t === 10 || t === 11 || t === 12;
}

/**
 * Binary arithmetic result type (left-biased error lattice).
 * Left error wins; else right error; else text ⇒ VALUE; else N.
 */
export function arithType(a: number, b: number): number {
  //@ verify
  //@ ensures isErrorType(a) === true ==> \result === a
  //@ ensures isErrorType(a) === false && isErrorType(b) === true ==> \result === b
  //@ ensures isErrorType(a) === false && isErrorType(b) === false && (a === 1 || b === 1) ==> \result === 12
  //@ ensures isErrorType(a) === false && isErrorType(b) === false && a !== 1 && b !== 1 ==> \result === 0
  if (a === 10 || a === 11 || a === 12) return a;
  if (b === 10 || b === 11 || b === 12) return b;
  if (a === 1 || b === 1) return 12;
  return 0;
}

/**
 * Division result type.
 * Error lattice first; only then zero divisor → DIV0.
 * Mirrors fixed EvaluatePolish `/` (not value-before-type).
 */
export function divType(a: number, b: number, bNum: number): number {
  //@ verify
  //@ ensures isErrorType(a) === true ==> \result === a
  //@ ensures isErrorType(a) === false && isErrorType(b) === true ==> \result === b
  //@ ensures isErrorType(a) === false && isErrorType(b) === false && (a === 1 || b === 1) ==> \result === 12
  //@ ensures a === 0 && b === 0 && bNum === 0 ==> \result === 11
  //@ ensures a === 0 && b === 0 && bNum !== 0 ==> \result === 0
  const lattice = arithType(a, b);
  if (lattice === 10 || lattice === 11 || lattice === 12) return lattice;
  if (bNum === 0) return 11;
  return 0;
}

/**
 * Concat result type.
 * Either-side error propagates; left wins if both. Else text.
 */
export function concatType(a: number, b: number): number {
  //@ verify
  //@ ensures isErrorType(a) === true ==> \result === a
  //@ ensures isErrorType(a) === false && isErrorType(b) === true ==> \result === b
  //@ ensures isErrorType(a) === false && isErrorType(b) === false ==> \result === 1
  if (a === 10 || a === 11 || a === 12) return a;
  if (b === 10 || b === 11 || b === 12) return b;
  return 1;
}

/**
 * Map SocialCalc valuetype string to lattice type code (runtime cross-check only).
 */
export function fromValueType(vt: string): number {
  if (vt.charAt(0) === "e") {
    if (vt.indexOf("#REF!") >= 0) return 10;
    if (vt.indexOf("#DIV/0!") >= 0) return 11;
    if (vt.indexOf("#N/A") >= 0) return 13;
    if (vt.indexOf("#VALUE!") >= 0) return 12;
    return 12;
  }
  if (vt.charAt(0) === "t") return 1;
  if (vt === "b") return 2;
  return 0;
}

/**
 * Map lattice error/type code to SocialCalc valuetype string.
 */
export function toValueType(t: number): string {
  if (t === 10) return "e#REF!";
  if (t === 11) return "e#DIV/0!";
  if (t === 12) return "e#VALUE!";
  if (t === 13) return "e#N/A";
  if (t === 1) return "t";
  if (t === 2) return "b";
  return "n";
}
