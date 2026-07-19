/**
 * LemmaScript facade: pure LET/LAMBDA binding/scope/shape policy.
 * Non-shipping mirror of js/formula-parse.ts FormulaParseMut.{ClassifyArity,
 * ResolveScopeIndex, RecursionStatus, ShapesMatch, IsValidRectShape}.
 *
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 *
 * Policy (fixed 2026-07-18, LAMBDA callable-lambda architecture):
 * 1. classifyArity — fixed-arity LAMBDA/named-lambda call-site argument
 *    count check: too few (1), too many (2), exact (0).
 * 2. resolveScopeIndex — Excel-compatible lexical shadowing: a bare name
 *    resolves to the innermost (last-pushed) LET/LAMBDA scope frame that
 *    binds it; -1 means unbound in every active frame (falls through to
 *    global named ranges / builtin FunctionList).
 * 3. recursionStatus — pure depth-vs-ceiling recursion guard shared by
 *    named-lambda self/mutual recursion and nested LET/LAMBDA/IF evaluation.
 * 4. shapesMatch / isValidRectShape — MAKEARRAY/MAP/BYROW/BYCOL output
 *    rectangle shape policy: every produced row must have the same column
 *    count as every other (and vice versa), and the overall rectangle must
 *    have strictly positive extent in both dimensions.
 *
 * Vite+ tests cross-check every function against the shipping
 * FormulaParseMut counterpart in js/formula-parse.ts.
 */

/** Arity OK — argument count equals parameter count. */
export const ARITY_OK = 0;
/** Too few arguments supplied for the parameter list. */
export const ARITY_TOO_FEW = 1;
/** Too many arguments supplied for the parameter list. */
export const ARITY_TOO_MANY = 2;

/**
 * Fixed-arity call classification: LAMBDA/named-lambda invocations require
 * exactly `paramCount` arguments (no optional/variadic parameters).
 */
export function classifyArity(paramCount: number, argCount: number): number {
  //@ verify
  //@ ensures argCount < paramCount ==> \result === 1
  //@ ensures argCount > paramCount ==> \result === 2
  //@ ensures argCount === paramCount ==> \result === 0
  if (argCount < paramCount) return 1;
  if (argCount > paramCount) return 2;
  return 0;
}

/**
 * Lexical-shadowing resolution over a stack of per-frame binding-match
 * flags (caller precomputes, for each active LET/LAMBDA scope frame outer
 * to inner, whether that frame binds the name being looked up). The
 * innermost (highest-index) matching frame wins; -1 means unbound in every
 * frame (fall through to global names / builtin functions).
 */
export function resolveScopeIndex(matches: boolean[]): number {
  //@ verify
  //@ ensures matches.length === 0 ==> \result === -1
  //@ ensures \result >= -1 && \result < matches.length
  //@ ensures \result >= 0 ==> matches[\result] === true
  //@ ensures \result >= 0 ==> forall(j, (\result < j && j < matches.length) ==> matches[j] === false)
  //@ ensures \result === -1 ==> forall(j, (0 <= j && j < matches.length) ==> matches[j] === false)
  for (let i = matches.length - 1; i >= 0; i--) {
    //@ invariant i >= -1 && i < matches.length
    //@ invariant forall(k, (i < k && k < matches.length) ==> matches[k] === false)
    //@ decreases i
    //@ done_with true
    if (matches[i]) return i;
  }
  return -1;
}

/** Recursion depth within the configured ceiling. */
export const RECURSION_OK = 0;
/** Recursion depth exceeds the configured ceiling. */
export const RECURSION_EXCEEDED = 1;

/**
 * Pure recursion-guard status shared by named-lambda self/mutual recursion
 * and nested LET/LAMBDA/(scoped)IF evaluation: 0 while depth stays within
 * maxDepth, 1 once it is exceeded.
 */
export function recursionStatus(depth: number, maxDepth: number): number {
  //@ verify
  //@ ensures depth > maxDepth ==> \result === 1
  //@ ensures depth <= maxDepth ==> \result === 0
  return depth > maxDepth ? 1 : 0;
}

/**
 * MAKEARRAY/MAP/BYROW/BYCOL output-rectangle shape agreement: two
 * candidate row/column extents match iff both dimensions are equal.
 */
export function shapesMatch(rows1: number, cols1: number, rows2: number, cols2: number): boolean {
  //@ verify
  //@ ensures \result === true <==> rows1 === rows2 && cols1 === cols2
  return rows1 === rows2 && cols1 === cols2;
}
/**
 * Rectangle-shape validity for a lambda-array function result: both
 * extents must be strictly positive integers (no empty/degenerate output
 * rectangles). Dimensions are always derived from integer counts
 * (materialized array row/col lengths), so no NaN/Infinity guard is
 * needed at this pure layer.
 */
export function isValidRectShape(rows: number, cols: number): boolean {
  //@ verify
  //@ ensures \result === true <==> rows > 0 && cols > 0
  return rows > 0 && cols > 0;
}
