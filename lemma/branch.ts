/**
 * LemmaScript facade: pure branch-selection and text-emission policies.
 * Non-shipping mirror of the control-flow/emission decisions shared by
 * IFS/SWITCH (first-match-wins, optional default) and TEXTJOIN (keep/skip
 * per item, delimiter-between-kept-items placement) in js/formula1.ts.
 *
 * Deliberately tiny — pure index/boolean arithmetic only. Following the
 * lemma/lookup-result.ts pattern: loop-based scans (firstTrueIndex) are
 * runtime-locked (not verified, since Dafny cannot resolve a caller-defined
 * loop function inside another function's body); the precedence *choice*
 * built on top of a precomputed scan result (switchBranch) is verified.
 */

/**
 * IFS(cond1,val1,cond2,val2,...): index of the first true condition among
 * `n` conditions, or -1 if none are true (IFS raises #N/A in that case;
 * this facade only decides *which* branch, not the error). Runtime-locked
 * linear scan — not verified (loop termination trivial), mirrors
 * lemma/lookup-result.ts findExact/hasExact.
 */
export function firstTrueIndex(conditions: boolean[]): number {
  let i = 0;
  while (i < conditions.length) {
    if (conditions[i] === true) return i;
    i = i + 1;
  }
  return -1;
}

/**
 * SWITCH(expr,case1,val1,...,[default]): given the precomputed index of the
 * first matching case (-1 if none, e.g. from firstTrueIndex over each
 * case's match boolean), the case count, and whether a trailing default
 * value is present, return the branch selection as a pure code:
 *   0..caseCount-1  = index of the first matching case's value
 *   caseCount       = no case matched, but a default is present -> use default
 *   -1              = no case matched and no default -> #N/A
 */
export function switchBranch(hitIndex: number, caseCount: number, hasDefault: boolean): number {
  //@ verify
  //@ ensures hitIndex >= 0 ==> \result === hitIndex
  //@ ensures hitIndex < 0 && hasDefault === true ==> \result === caseCount
  //@ ensures hitIndex < 0 && hasDefault === false ==> \result === -1
  if (hitIndex >= 0) return hitIndex;
  return hasDefault ? caseCount : -1;
}

/**
 * TEXTJOIN keep policy for one item: keep unless ignore_empty is requested
 * and the item's coerced text is empty.
 */
export function keepJoinItem(ignoreEmpty: boolean, isEmptyText: boolean): boolean {
  //@ verify
  //@ ensures \result === (ignoreEmpty === false || isEmptyText === false)
  if (ignoreEmpty === false) return true;
  return isEmptyText === false;
}

/**
 * TEXTJOIN delimiter placement: a delimiter is emitted before item `index`
 * iff at least one earlier kept item already exists (keptSoFar > 0). Pure
 * counter policy — the running "how many kept so far" state lives in the
 * caller; this only decides the boolean gate.
 */
export function emitDelimiterBefore(keptSoFar: number): boolean {
  //@ verify
  //@ ensures keptSoFar > 0 ==> \result === true
  //@ ensures keptSoFar <= 0 ==> \result === false
  return keptSoFar > 0;
}
