/**
 * LemmaScript facade: pure policy core underlying XMATCH/XLOOKUP.
 * Non-shipping mirror of the mode-validation and exact/approximate/fallback
 * precedence decisions in js/formula1.ts's DecodeXLookupModes and the
 * winning-outcome selection wrapped by XMatchFunction/XLookupFunction.
 *
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 *
 * Kept separate from lemma/lookup-result.ts: that facade verifies the
 * unrelated pipe-table TypeLookupTable algorithm (LookupResultType's
 * exact-before-wildcard string-table resolution for binary operators). This
 * facade verifies XMATCH/XLOOKUP's match_mode/search_mode legality and its
 * exact/next-smaller/next-larger/miss outcome precedence -- a different
 * object space that only superficially resembles a "precedence chooser".
 *
 * Policy groups:
 * 1. matchModeValidity / searchModeValidity -- legal enumerations.
 * 2. binarySearchCompatibleWithMode -- binary search_mode (2/-2) never
 *    combines with wildcard match_mode (2).
 * 3. matchOutcomeToResult -- the core precedence chooser: exact wins if
 *    found; else next-smaller/next-larger per match_mode; else miss.
 * 4. resolveIfNotFound -- if_not_found fallback wrapper.
 *
 * Runtime-only (not proven here, exercised by test/formula-xlookup-xmatch.test.ts
 * and js/formula1.ts's DecodeLookupVector/CompareLookupCell/ScanLookupVector):
 * actual array/range scanning (linear or binary, per search_mode) to locate
 * the exact/next-smaller/next-larger index, and match_mode=2 wildcard string
 * comparison (reuses the shipping WildcardPatternToRegex helper shared with
 * TestCriteria/COUNTIF/SUMIF -- not reimplemented here).
 */

// --- 1. match_mode / search_mode legality -----------------------------------

/** Exact match (default). */
export const MATCH_EXACT = 0;
/** Exact match or the next smaller item. */
export const MATCH_NEXT_SMALLER = -1;
/** Exact match or the next larger item. */
export const MATCH_NEXT_LARGER = 1;
/** Wildcard match (*, ?, ~ have special meaning). */
export const MATCH_WILDCARD = 2;

/** Search first-to-last (default). */
export const SEARCH_FORWARD = 1;
/** Search last-to-first (reverse). */
export const SEARCH_REVERSE = -1;
/** Binary search assuming lookup_array is sorted ascending. */
export const SEARCH_BINARY_ASC = 2;
/** Binary search assuming lookup_array is sorted descending. */
export const SEARCH_BINARY_DESC = -2;

/**
 * Whether match_mode is one of the four legal XMATCH/XLOOKUP values
 * (-1, 0, 1, 2). Any other value (including non-integers, out-of-range
 * numbers) is illegal and must be rejected by the caller with #VALUE!.
 */
export function matchModeValidity(matchMode: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> matchMode === -1 || matchMode === 0 || matchMode === 1 || matchMode === 2
  return matchMode === -1 || matchMode === 0 || matchMode === 1 || matchMode === 2;
}

/**
 * Whether search_mode is one of the four legal XMATCH/XLOOKUP values
 * (1, -1, 2, -2). Any other value is illegal and must be rejected by the
 * caller with #VALUE!.
 */
export function searchModeValidity(searchMode: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> searchMode === 1 || searchMode === -1 || searchMode === 2 || searchMode === -2
  return searchMode === 1 || searchMode === -1 || searchMode === 2 || searchMode === -2;
}

/**
 * Whether a (match_mode, search_mode) pair is a legal combination: both
 * individually legal, and binary search (2/-2) never combined with wildcard
 * match_mode (2) -- binary search assumes a sorted comparison order, which
 * wildcard pattern matching does not provide.
 */
export function modeCombinationValidity(matchMode: number, searchMode: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true ==> matchModeValidity(matchMode) === true
  //@ ensures \result === true ==> searchModeValidity(searchMode) === true
  //@ ensures matchModeValidity(matchMode) === false ==> \result === false
  //@ ensures searchModeValidity(searchMode) === false ==> \result === false
  //@ ensures matchMode === MATCH_WILDCARD && (searchMode === SEARCH_BINARY_ASC || searchMode === SEARCH_BINARY_DESC) ==> \result === false
  //@ ensures matchModeValidity(matchMode) === true && searchModeValidity(searchMode) === true && !(matchMode === MATCH_WILDCARD && (searchMode === SEARCH_BINARY_ASC || searchMode === SEARCH_BINARY_DESC)) ==> \result === true
  if (matchModeValidity(matchMode) === false) return false;
  if (searchModeValidity(searchMode) === false) return false;
  if (
    matchMode === MATCH_WILDCARD &&
    (searchMode === SEARCH_BINARY_ASC || searchMode === SEARCH_BINARY_DESC)
  )
    return false;
  return true;
}

// --- 2. exact/approximate/fallback outcome precedence -----------------------

/** No qualifying entry was found anywhere in the scan. */
export const OUTCOME_MISS = 0;
/** An exact match was found. */
export const OUTCOME_EXACT = 1;
/** No exact match, but a qualifying next-smaller/next-larger candidate was found. */
export const OUTCOME_APPROXIMATE = 2;

/**
 * Classify a completed lookup scan's outcome from precomputed exact/
 * approximate presence flags. Total over every input combination: an exact
 * hit always wins over an approximate candidate (mirrors ScanLookupVector's
 * `if (c === 0) return order;` short-circuit, which fires before any
 * approximate bookkeeping can be considered), and the absence of both is a
 * miss regardless of match_mode.
 */
export function matchOutcomeToResult(foundExact: boolean, foundApproximate: boolean): number {
  //@ verify
  //@ ensures \result === OUTCOME_MISS || \result === OUTCOME_EXACT || \result === OUTCOME_APPROXIMATE
  //@ ensures foundExact === true ==> \result === OUTCOME_EXACT
  //@ ensures foundExact === false && foundApproximate === true ==> \result === OUTCOME_APPROXIMATE
  //@ ensures foundExact === false && foundApproximate === false ==> \result === OUTCOME_MISS
  if (foundExact === true) return OUTCOME_EXACT;
  if (foundApproximate === true) return OUTCOME_APPROXIMATE;
  return OUTCOME_MISS;
}

/**
 * Whether match_mode legally permits an approximate (next-smaller/
 * next-larger) outcome at all. Exact-only (0) and wildcard (2) match_modes
 * never produce an approximate outcome; only -1/1 do.
 */
export function matchModeAllowsApproximate(matchMode: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> matchMode === MATCH_NEXT_SMALLER || matchMode === MATCH_NEXT_LARGER
  return matchMode === MATCH_NEXT_SMALLER || matchMode === MATCH_NEXT_LARGER;
}

/**
 * Full outcome classification honoring match_mode: an approximate
 * candidate is only ever consulted when match_mode legally allows it
 * (mirrors ScanLookupVector, which only records a boundary/bestIdx
 * candidate under match_mode -1/1 in the first place -- exact match_mode 0
 * and wildcard match_mode 2 never populate an approximate candidate, so a
 * caller passing foundApproximate=true with an incompatible match_mode is
 * a caller bug, not a legal state, and is defensively downgraded to a
 * miss rather than silently accepted).
 */
export function classifyLookupOutcome(
  matchMode: number,
  foundExact: boolean,
  foundApproximate: boolean,
): number {
  //@ verify
  //@ ensures \result === OUTCOME_MISS || \result === OUTCOME_EXACT || \result === OUTCOME_APPROXIMATE
  //@ ensures foundExact === true ==> \result === OUTCOME_EXACT
  //@ ensures foundExact === false && foundApproximate === true && matchModeAllowsApproximate(matchMode) === true ==> \result === OUTCOME_APPROXIMATE
  //@ ensures foundExact === false && matchModeAllowsApproximate(matchMode) === false ==> \result === OUTCOME_MISS
  //@ ensures foundExact === false && foundApproximate === false ==> \result === OUTCOME_MISS
  if (foundExact === true) return OUTCOME_EXACT;
  if (foundApproximate === true && matchModeAllowsApproximate(matchMode) === true)
    return OUTCOME_APPROXIMATE;
  return OUTCOME_MISS;
}

// --- 3. if_not_found fallback -------------------------------------------------

/** Caller did not supply if_not_found: a miss must surface as #N/A. */
export const FALLBACK_NOT_FOUND_ERROR = "#N/A";

/**
 * XLOOKUP's if_not_found resolution: on a miss (outcome === OUTCOME_MISS),
 * the caller-supplied fallback is returned verbatim when present, else the
 * canonical #N/A. On any non-miss outcome the fallback is never consulted.
 */
export function resolveIfNotFound(
  outcome: number,
  hasIfNotFound: boolean,
  ifNotFoundValue: string,
): string {
  //@ verify
  //@ ensures outcome !== OUTCOME_MISS ==> \result === ""
  //@ ensures outcome === OUTCOME_MISS && hasIfNotFound === true ==> \result === ifNotFoundValue
  //@ ensures outcome === OUTCOME_MISS && hasIfNotFound === false ==> \result === FALLBACK_NOT_FOUND_ERROR
  if (outcome !== OUTCOME_MISS) return "";
  if (hasIfNotFound === true) return ifNotFoundValue;
  return FALLBACK_NOT_FOUND_ERROR;
}
