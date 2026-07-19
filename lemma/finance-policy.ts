/**
 * LemmaScript facade: pure domain/result classification for the financial
 * compatibility functions (PPMT/IPMT/MIRR/XNPV/XIRR) in js/formula1.ts.
 *
 * Deliberately narrow, mirroring lemma/eval-ops.ts's shape: this facade
 * verifies the *classification* boundaries (period domain, cashflow sign
 * requirement, date-vs-anchor domain) that gate PPMT/IPMT/MIRR/XNPV/XIRR
 * before any floating-point solving happens. It does NOT attempt to prove
 * anything about the annuity algebra, the closed-form MIRR ratio, or the
 * safeguarded Newton/bisection XIRR solver (SolveXIRRRate) -- those are
 * inherently floating-point numerical routines whose correctness is
 * established empirically (documented Excel/Sheets worked examples,
 * adversarial multi-sign-change schedules, and the XIRR-drives-XNPV-to-zero
 * property), not by a decidable formal proof. See
 * test/formula-financial-functions.test.ts for that evidence.
 *
 * What IS a decidable, boundary-rich pure kernel worth proving:
 *   - PPMT/IPMT's `1 <= per <= nper` integer-period domain check
 *     (js/formula1.ts PPMTIPMTFunctions, the `nper <= 0 || per < 1 ||
 *     per > nper || floor(per) != per` guard) -- four distinct rejection
 *     reasons collapsed into one #NUM!, worth naming precisely.
 *   - MIRR/XIRR's shared "needs at least one positive and one negative
 *     cashflow" requirement (js/formula1.ts MIRRFunction's `negpv==0 ||
 *     posfv==0` check and XIRRFunction's `!hasPositive || !hasNegative`
 *     check) -- same predicate, two independent implementations that must
 *     agree.
 *   - XNPV/XIRR's "every date must be >= the anchor date (dates[0])" domain
 *     restriction (js/formula1.ts ResolveXCashflowSchedule's `bv <
 *     dates[0]` check) -- the one hard date-ordering rule Excel documents
 *     ("If any number in dates precedes the starting date, XIRR returns the
 *     #NUM! error"), which is easy to get backwards (anchor vs minimum).
 *
 * Vite+ tests cross-check every classifier against the shipping
 * implementation. Does not replace the behavior tests on the real formulas.
 */

/** Period domain is valid: 1 <= per <= nper (per an integer), nper > 0. */
export const PERIOD_OK = 0;
/** nper <= 0: an annuity with no periods has no meaningful per-period split. */
export const PERIOD_NPER_INVALID = 1;
/** per < 1 or per > nper: period index outside the annuity's life. */
export const PERIOD_OUT_OF_RANGE = 2;
/** per is not an integer: periods are discrete, not fractional. */
export const PERIOD_NOT_INTEGER = 3;

/**
 * Classify a (nper, per, perIsInteger) triple for PPMT/IPMT's period-domain
 * check. Mirrors js/formula1.ts PPMTIPMTFunctions's `nper <= 0 || per < 1
 * || per > nper || Math.floor(per) != per` guard, but returns which of the
 * four distinct reasons applies (the shipping code only needs a single
 * boolean gate before pushing #NUM!, so this facade exists to pin the
 * precise reason precedence: nper-invalid is checked first, matching the
 * shipping `||` chain's short-circuit order).
 *
 * `perIsInteger` is supplied by the caller (`per === Math.floor(per)`)
 * rather than recomputed here: LemmaScript's Dafny/Lean backends model
 * numbers as unbounded integers, where `Math.floor(per) !== per` would be
 * vacuously false for every input and silently prove nothing about the
 * fractional-period rejection. Splitting the floating-point predicate out
 * to the caller keeps this facade's proof honest about what it covers
 * (branch precedence and reason selection) versus what it doesn't
 * (float-specific integrality, which is exercised empirically by
 * test/formula-financial-functions.test.ts's non-integer-per cases).
 */
export function ClassifyPeriodDomain(nper: number, per: number, perIsInteger: boolean): number {
  //@ verify
  //@ ensures nper <= 0 ==> \result === 1
  //@ ensures nper > 0 && (per < 1 || per > nper) ==> \result === 2
  //@ ensures nper > 0 && per >= 1 && per <= nper && perIsInteger === false ==> \result === 3
  //@ ensures nper > 0 && per >= 1 && per <= nper && perIsInteger === true ==> \result === 0
  if (nper <= 0) return PERIOD_NPER_INVALID;
  if (per < 1 || per > nper) return PERIOD_OUT_OF_RANGE;
  if (!perIsInteger) return PERIOD_NOT_INTEGER;
  return PERIOD_OK;
}

/** Cashflow schedule has at least one positive and one negative flow. */
export const SIGN_OK = 0;
/** Schedule has no positive flow (all zero/negative). */
export const SIGN_MISSING_POSITIVE = 1;
/** Schedule has no negative flow (all zero/positive). */
export const SIGN_MISSING_NEGATIVE = 2;
/** Schedule has neither a positive nor a negative flow (all zero). */
export const SIGN_MISSING_BOTH = 3;

/**
 * Classify a cashflow schedule's sign mix for MIRR/XIRR's shared "needs at
 * least one positive and one negative cashflow" requirement. Mirrors
 * js/formula1.ts MIRRFunction's `negpv==0 || posfv==0` check (negpv/posfv
 * are each nonzero exactly when a strictly-negative/strictly-positive flow
 * exists, since a zero-valued cashflow contributes to neither accumulator)
 * and XIRRFunction's `!hasPositive || !hasNegative` check -- both reduce to
 * this single predicate.
 */
export function ClassifySignRequirement(hasPositive: boolean, hasNegative: boolean): number {
  //@ verify
  //@ ensures hasPositive === true && hasNegative === true ==> \result === 0
  //@ ensures hasPositive === false && hasNegative === true ==> \result === 1
  //@ ensures hasPositive === true && hasNegative === false ==> \result === 2
  //@ ensures hasPositive === false && hasNegative === false ==> \result === 3
  if (hasPositive && hasNegative) return SIGN_OK;
  if (!hasPositive && !hasNegative) return SIGN_MISSING_BOTH;
  if (!hasPositive) return SIGN_MISSING_POSITIVE;
  return SIGN_MISSING_NEGATIVE;
}

/** Date is on or after the anchor date -- within XNPV/XIRR's domain. */
export const DATE_OK = 0;
/** Date precedes the anchor date -- outside XNPV/XIRR's documented domain. */
export const DATE_BEFORE_ANCHOR = 1;

/**
 * Classify a single payment date against the schedule's anchor date (the
 * first date in the range, dates[0] -- not necessarily the chronological
 * minimum of the whole schedule). Mirrors js/formula1.ts
 * ResolveXCashflowSchedule's `bv < dates[0]` check, applied once per
 * non-anchor date. The anchor itself is always DATE_OK by construction
 * (equal to itself), matching the shipping loop's `i > 0` guard that never
 * checks the anchor against itself.
 */
export function ClassifyDateAgainstAnchor(anchor: number, date: number): number {
  //@ verify
  //@ ensures date < anchor ==> \result === 1
  //@ ensures date >= anchor ==> \result === 0
  if (date < anchor) return DATE_BEFORE_ANCHOR;
  return DATE_OK;
}
