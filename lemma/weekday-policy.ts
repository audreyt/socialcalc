/**
 * LemmaScript facade: pure weekend-code/mask legality and working-day/step
 * decision policy underlying WORKDAY, WORKDAY.INTL, NETWORKDAYS, and
 * NETWORKDAYS.INTL.
 * Non-shipping mirror of the weekend-decode and working-day predicates in
 * js/formula1.ts's SocialCalc.Formula.WorkdayFunctions /
 * NetworkdaysFunctions (see AGENTS.md's "lemma/*.ts" ownership note: shipping
 * global scripts cannot be extracted directly by LemmaScript, so this facade
 * duplicates only the pure decision predicates, not sheet/range/holiday-list
 * scanning).
 *
 * Vendor weekend representations (Excel/Google Sheets *.INTL argument):
 *   - numeric weekend code: 1-7 selects one of 7 consecutive two-day
 *     weekend pairs starting Saturday/Sunday (code 1) through
 *     Friday/Saturday (code 7); 11-17 selects a single weekend day, Sunday
 *     (11) through Saturday (17). Any other integer is illegal (#NUM!).
 *   - weekend string mask: exactly 7 characters, each "0" (working) or "1"
 *     (non-working), positions Monday..Sunday in order. All characters must
 *     be legal, and the mask must not mark every day non-working (an
 *     all-"1" mask leaves no working day to land on, so vendors reject it
 *     with #VALUE!).
 *
 * This facade normalizes both representations to a 7-day Mon(day 0)..Sun
 * (day 6) mask, encoded as an integer 0..127 via `pow2` (sum of powers of
 * two for each non-working day) rather than JS `<<`/`>>`/`&`: the
 * LemmaScript `//@ ensures`/`//@ requires` annotation grammar (see
 * node_modules/lemmascript/tools/dist/specparser.js's MULTI_OPS) tokenizes
 * only `< <= > >= == != === !== && ||`, so a shift/bitwise operator inside
 * an annotation throws at generation time — contracts here are stated with
 * `+ - * / %` and comparisons only, and function bodies mirror that same
 * arithmetic (no shift/bitwise operators anywhere in this file) so body and
 * contract stay syntactically, not just semantically, aligned.
 *
 * Calendar loops (walking serial dates to accumulate/step working days,
 * scanning caller-supplied holiday lists) stay runtime-tested only — see
 * test/formula-workday-networkdays.test.ts and
 * test/lemma-weekday-policy-facade.test.ts's shipping cross-check — mirroring
 * lemma/lookup-result.ts's proven-precedence / runtime-tested-scan split.
 *
 * Policy groups:
 * 1. weekend numeric-code legality and decode to mask.
 * 2. weekend string-mask legality and per-day lookup.
 * 3. working-day decision (weekend-or-holiday) and net step-direction sign.
 */

/** Full legal range for a decoded 7-day Mon..Sun mask. */
export const MASK_ALL_WORKING = 0;
/** Illegal: every day marked non-working — no day left to land on. */
export const MASK_ALL_OFF = 127;

/**
 * 2^n for n in 0..6 (the only domain callers use — one mask day per call).
 * Case-defined instead of `1 << n` so the LemmaScript annotation grammar
 * (no shift operators) can state exact-value ensures for every caller.
 */
export function pow2(n: number): number {
  //@ verify
  //@ requires n >= 0 && n <= 6
  //@ ensures n === 0 ==> \result === 1
  //@ ensures n === 1 ==> \result === 2
  //@ ensures n === 2 ==> \result === 4
  //@ ensures n === 3 ==> \result === 8
  //@ ensures n === 4 ==> \result === 16
  //@ ensures n === 5 ==> \result === 32
  //@ ensures n === 6 ==> \result === 64
  if (n === 0) return 1;
  if (n === 1) return 2;
  if (n === 2) return 4;
  if (n === 3) return 8;
  if (n === 4) return 16;
  if (n === 5) return 32;
  return 64;
}

// --- 1. Weekend numeric-code legality and decode ----------------------------

/**
 * Whether `code` is one of the vendor-documented WORKDAY.INTL/
 * NETWORKDAYS.INTL numeric weekend codes: 1..7 (two-day weekend pairs) or
 * 11..17 (single weekend day).
 */
export function isLegalWeekendCode(code: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> (code >= 1 && code <= 7) || (code >= 11 && code <= 17)
  return (code >= 1 && code <= 7) || (code >= 11 && code <= 17);
}

/**
 * First weekend day-of-week (0=Monday..6=Sunday) for a two-day-pair code
 * (1..7). Code 1 = Saturday(5),Sunday(6); code 2 = Sunday(6),Monday(0); ...;
 * code 7 = Friday(4),Saturday(5). Callers must check `code` is in 1..7.
 */
export function weekendPairFirstDay(code: number): number {
  //@ verify
  //@ requires code >= 1 && code <= 7
  //@ ensures \result >= 0 && \result <= 6
  //@ ensures \result === (code + 4) % 7
  return (code + 4) % 7;
}

/**
 * Single weekend day-of-week (0=Monday..6=Sunday) for a single-day code
 * (11..17). Code 11 = Sunday(6), code 12 = Monday(0), ..., code 17 =
 * Saturday(5). Callers must check `code` is in 11..17.
 */
export function weekendSingleDay(code: number): number {
  //@ verify
  //@ requires code >= 11 && code <= 17
  //@ ensures \result >= 0 && \result <= 6
  //@ ensures \result === (code + 2) % 7
  return (code + 2) % 7;
}

/**
 * Decode a legal weekend numeric code to a 7-day Mon..Sun mask (sum of
 * `pow2(day)` for each non-working day). Illegal codes decode to
 * MASK_ALL_OFF (127) — a value `isLegalWeekendMask` rejects, so callers get
 * a rejected mask rather than a silently-wrong accepted one.
 */
export function weekendCodeToMask(code: number): number {
  //@ verify
  //@ ensures isLegalWeekendCode(code) === false ==> \result === 127
  //@ ensures code >= 1 && code <= 7 ==> \result === pow2(weekendPairFirstDay(code)) + pow2((weekendPairFirstDay(code) + 1) % 7)
  //@ ensures code >= 11 && code <= 17 ==> \result === pow2(weekendSingleDay(code))
  if (code >= 1 && code <= 7) {
    const first = weekendPairFirstDay(code);
    const second = (first + 1) % 7;
    return pow2(first) + pow2(second);
  }
  if (code >= 11 && code <= 17) {
    return pow2(weekendSingleDay(code));
  }
  return 127;
}

// --- 2. Weekend string-mask legality and per-day lookup ---------------------

/**
 * Whether a decoded 7-day Mon..Sun mask is legal: in range 0..127 and not
 * all-off (127), which would leave zero working days to land on.
 */
export function isLegalWeekendMask(mask: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> mask >= 0 && mask <= 127 && mask !== 127
  return mask >= 0 && mask <= 127 && mask !== 127;
}

/**
 * Whether a single mask character ("0" or "1") is a legal weekend-mask
 * digit. Runtime string parsing loops over 7 characters and calls this per
 * character; the loop itself stays runtime-tested.
 */
export function isLegalMaskChar(charCode: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> charCode === 48 || charCode === 49
  return charCode === 48 || charCode === 49;
}

/**
 * Whether day-of-week `isoDow` (0=Monday..6=Sunday) is marked non-working in
 * `mask`. Callers must check `isoDow` is in 0..6 and `mask` is in 0..127.
 * `Math.floor(mask / pow2(isoDow)) % 2 === 1` is the standard nonnegative-
 * integer bit-test identity for a power-of-two divisor (equivalent to
 * `(mask >> isoDow) & 1` without using a shift operator anywhere).
 */
export function maskDayOff(mask: number, isoDow: number): boolean {
  //@ verify
  //@ requires isoDow >= 0 && isoDow <= 6
  //@ ensures \result === true || \result === false
  return Math.floor(mask / pow2(isoDow)) % 2 === 1;
}

/**
 * Convert the SocialCalc/Excel WEEKDAY type-1 day index (0=Sunday..6=
 * Saturday, i.e. `(serial + 6) % 7` matching js/formula1.ts DMYFunctions'
 * WEEKDAY case) to the Monday-first ISO day index (0=Monday..6=Sunday) used
 * by the weekend mask above.
 */
export function sundayDowToIsoDow(sundayDow: number): number {
  //@ verify
  //@ requires sundayDow >= 0 && sundayDow <= 6
  //@ ensures \result >= 0 && \result <= 6
  //@ ensures \result === (sundayDow + 6) % 7
  return (sundayDow + 6) % 7;
}

// --- 3. Working-day decision and net step-direction sign --------------------

/**
 * Whether a day is non-working: either its weekend-mask day is set, or the
 * caller has already determined (by scanning the holiday list — a runtime-
 * tested loop, not part of this facade) that it is a holiday.
 */
export function isNonWorkingDay(mask: number, isoDow: number, isHoliday: boolean): boolean {
  //@ verify
  //@ requires isoDow >= 0 && isoDow <= 6
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> maskDayOff(mask, isoDow) === true || isHoliday === true
  return maskDayOff(mask, isoDow) === true || isHoliday === true;
}

/** Whether a day is a working day: the negation of `isNonWorkingDay`. */
export function isWorkingDay(mask: number, isoDow: number, isHoliday: boolean): boolean {
  //@ verify
  //@ requires isoDow >= 0 && isoDow <= 6
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> isNonWorkingDay(mask, isoDow, isHoliday) === false
  return isNonWorkingDay(mask, isoDow, isHoliday) === false;
}

/** Net step direction: +1 forward for a positive count, -1 backward for a
 * negative count, 0 for exactly zero (WORKDAY(start,0) stays on start_date;
 * NETWORKDAYS(start,start) counts only start_date itself, no stepping). */
export function stepDirection(count: number): number {
  //@ verify
  //@ ensures \result === -1 || \result === 0 || \result === 1
  //@ ensures count > 0 ==> \result === 1
  //@ ensures count < 0 ==> \result === -1
  //@ ensures count === 0 ==> \result === 0
  if (count > 0) return 1;
  if (count < 0) return -1;
  return 0;
}
