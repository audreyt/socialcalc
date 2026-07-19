/**
 * LemmaScript facade: pure boundary/tie classification policies underlying
 * the modern RANK.AVG / QUARTILE.EXC statistics functions.
 *
 * Scope note: LemmaScript's Dafny backend maps TS `number` to Dafny `int`
 * (see lemma/a1.ts, lemma/spill.ts — every verified function here is
 * integer arithmetic/boundary logic, never a real-valued formula). Two
 * consequences shape this file:
 *
 * 1. RANK.AVG's averaged rank is a half-integer (bestRank + (tieCount-1)/2).
 *    Rather than model that as a Dafny `real` (which the generator cannot
 *    honestly produce from a TS `number` source — division truncates to
 *    int, silently proving a DIFFERENT, wrong function), the verified core
 *    below computes the exact-integer DOUBLED rank; the real average is an
 *    unverified one-line division bridge in plain TS, the same
 *    "verified integer core + unverified real-space bridge" split
 *    lemma/spill.ts already uses for planSpillRectangle (see that file's
 *    comment on why `count` assembly there is unverified).
 *
 * 2. PERCENTILE.EXC's domain check involves an arbitrary user-supplied
 *    percentile fraction k in the open interval (0,1) — a genuine
 *    real/rational value with no exact integer representation in general.
 *    That check is NOT formalized here: it is a straightforward two-sided
 *    inequality (0 < k < 1) tested directly by ordinary Vitest assertions,
 *    not a boundary-classification lattice with edge cases worth proving.
 *    QUARTILE.EXC is different and IS formalized below: its percentile is
 *    always the exact rational quart/4 for an INTEGER quart in {1,2,3}, so
 *    its interpolation-domain check (does position quart*(n+1)/4 fall in
 *    [1,n]?) can be restated as pure integer arithmetic by clearing the
 *    denominator — no real numbers required.
 *
 * Plain arithmetic folds (SUMSQ, GCD/LCM, TEXTJOIN-style joins) and
 * floating-point iterative solvers (RATE/IRR's existing Newton's-method
 * loops, reused by the new XIRR-family work) are deliberately NOT
 * formalized here either: no interesting edge-case lattice, and Dafny/Lean
 * cannot faithfully model floating-point convergence termination/precision.
 *
 * Kept as a separate small file from lemma/spill.ts (specifically the
 * dynamic-array spill runtime — rectangle planning, claim classification,
 * resize membership) rather than folded into it: order-statistics
 * tie/interpolation policy is an unrelated domain, and lemma/spill.ts's
 * own header already commits it to spill-runtime scope.
 */

// --- 1. RANK.AVG tie-averaging -----------------------------------------

/**
 * RANK.AVG's averaged rank, doubled to stay exact-integer. Documented
 * Excel/Sheets convention (support.microsoft.com/en-us/excel/functions/
 * rank-avg-function): when `tieCount` values share the same best
 * (RANK.EQ-style) rank `bestRank`, RANK.AVG returns the mean of the
 * `tieCount` consecutive integer ranks starting at `bestRank`, i.e.
 * bestRank + (tieCount - 1) / 2. Doubling clears the /2 so the whole
 * relation is provable over Dafny `int` without truncation:
 * doubledAverageRank = 2*bestRank + tieCount - 1.
 */
export function doubledAverageRank(bestRank: number, tieCount: number): number {
  //@ verify
  //@ ensures \result === 2 * bestRank + tieCount - 1
  //@ ensures tieCount === 1 ==> \result === 2 * bestRank
  return 2 * bestRank + tieCount - 1;
}

/**
 * RANK.AVG's real-valued averaged rank. Unverified real-space bridge
 * around the exact-integer `doubledAverageRank` core above — same split
 * lemma/spill.ts's planSpillRectangle uses for its `count` field.
 */
export function averageRank(bestRank: number, tieCount: number): number {
  return doubledAverageRank(bestRank, tieCount) / 2;
}

// --- 2. QUARTILE.EXC integer interpolation domain ------------------------

/**
 * QUARTILE.EXC's interpolation position, scaled by 4 to stay exact-integer.
 * The true (real-valued) position is quart*(n+1)/4; multiplying the two
 * boundary comparisons below through by 4 turns "is position in [1,n]"
 * into pure integer arithmetic with no denominator.
 */
export function quartileExcScaledPosition(n: number, quart: number): number {
  //@ verify
  //@ ensures \result === quart * (n + 1)
  return quart * (n + 1);
}

/**
 * Whether QUARTILE.EXC(array-of-size-n, quart) can interpolate rather than
 * returning #NUM!, for `quart` an integer in {1,2,3} (the only values
 * QUARTILE.EXC accepts per support.microsoft.com/en-us/excel/functions/
 * quartile-exc-function: "If quart ≤ 0 or if quart ≥ 4 ... #NUM!"). The
 * true (real-valued) position quart*(n+1)/4 must land in the closed
 * interval [1, n] (1-indexed, size-n data set) to interpolate — restated
 * without a denominator as 4 <= quart*(n+1) <= 4*n.
 */
export function isValidQuartileExcPosition(n: number, quart: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> quartileExcScaledPosition(n, quart) >= 4 && quartileExcScaledPosition(n, quart) <= 4 * n
  const scaled = quartileExcScaledPosition(n, quart);
  return scaled >= 4 && scaled <= 4 * n;
}
