/**
 * LemmaScript facade: pure workbook container policies.
 * Non-shipping mirror of pure decision cores identified by the multi-sheet
 * workbook design (js/workbook.ts): sheet-name validation precedence,
 * visible/active-sheet invariants, and rename/delete result classification.
 *
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 *
 * Design notes for LemmaScript (mirrors lemma/spill.ts precedent):
 * - Verified functions take only numbers/booleans and caller-precomputed
 *   predicates (isEmpty, isDuplicate, hasInvalidChar, ...) rather than
 *   scanning strings/arrays themselves — string scanning stays in the
 *   runtime-locked bridge layer below, matching lemma/lookup-result.ts's
 *   split between verified precedence (chooseLookupResult) and unverified
 *   scan/parse bridges (findExact, parsePipeRow).
 * - Integer -1 sentinel for "no such index" (matches lemma/a1.ts #REF!
 *   sentinel convention) rather than a string union or exception.
 *
 * Policy groups:
 * 1. sheet-name validation precedence (empty / too long / invalid chars / duplicate).
 * 2. visible-sheet-count / at-least-one-visible invariant (hide/delete guards).
 * 3. active-sheet reselection after delete/hide (pure index arithmetic).
 * 4. reorder target-index clamping.
 * 5. rename/delete formula-reference rewrite result classification.
 */

// --- 1. Sheet-name validation precedence ------------------------------------

/** Name accepted. */
export const NAME_OK = 0;
/** Name is empty (after trim). */
export const NAME_EMPTY = 1;
/** Name exceeds the maximum length policy. */
export const NAME_TOO_LONG = 2;
/** Name contains a character forbidden in sheet names. */
export const NAME_INVALID_CHARS = 3;
/** Name collides (case-insensitively, after normalization) with an existing sheet. */
export const NAME_DUPLICATE = 4;

/** Policy maximum sheet-name length (generous; not an Excel-parity claim). */
export const MAX_SHEET_NAME_LENGTH = 255;

/**
 * Fixed-precedence sheet-name validation: empty, then too-long, then
 * invalid-chars, then duplicate, else OK. Every branch is caller-precomputed
 * (no string scanning here) so the policy itself is fully verified.
 */
export function validateSheetName(
  isEmpty: boolean,
  exceedsMaxLength: boolean,
  hasInvalidChar: boolean,
  isDuplicate: boolean,
): number {
  //@ verify
  //@ ensures isEmpty === true ==> \result === 1
  //@ ensures isEmpty === false && exceedsMaxLength === true ==> \result === 2
  //@ ensures isEmpty === false && exceedsMaxLength === false && hasInvalidChar === true ==> \result === 3
  //@ ensures isEmpty === false && exceedsMaxLength === false && hasInvalidChar === false && isDuplicate === true ==> \result === 4
  //@ ensures \result === 0 <==> isEmpty === false && exceedsMaxLength === false && hasInvalidChar === false && isDuplicate === false
  if (isEmpty) return NAME_EMPTY;
  if (exceedsMaxLength) return NAME_TOO_LONG;
  if (hasInvalidChar) return NAME_INVALID_CHARS;
  if (isDuplicate) return NAME_DUPLICATE;
  return NAME_OK;
}

/** Whether a validation code represents acceptance. */
export function isNameAccepted(code: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> code === 0
  return code === NAME_OK;
}

// --- 2. Visible-sheet-count invariant ---------------------------------------

/** Minimum number of visible sheets a workbook must always retain. */
export const MIN_VISIBLE_SHEETS = 1;

/**
 * Whether hiding one more sheet keeps at least MIN_VISIBLE_SHEETS visible.
 * visibleCount is the count BEFORE hiding the candidate sheet.
 */
export function canHideAnotherSheet(visibleCount: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> visibleCount > 1
  return visibleCount > MIN_VISIBLE_SHEETS;
}

/**
 * Whether a workbook with totalCount sheets may delete one (a workbook must
 * always contain at least one sheet, visible or not).
 */
export function canDeleteAnotherSheet(totalCount: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> totalCount > 1
  return totalCount > 1;
}

// --- 3. Active-sheet reselection after delete/hide --------------------------

/** Sentinel meaning "no valid index" (should be unreachable given invariant 2). */
export const NO_INDEX = -1;

/**
 * Clamp an index into [0, count-1], or NO_INDEX when count <= 0.
 */
export function clampIndex(index: number, count: number): number {
  //@ verify
  //@ ensures count <= 0 ==> \result === -1
  //@ ensures count > 0 && index < 0 ==> \result === 0
  //@ ensures count > 0 && index >= count ==> \result === count - 1
  //@ ensures count > 0 && index >= 0 && index < count ==> \result === index
  if (count <= 0) return NO_INDEX;
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

/**
 * Pure index-shift policy for the active-sheet pointer after a sheet at
 * deletedIndex is removed from an (old) ordered list of oldCount sheets.
 * - If the deleted sheet is not the active one: active shifts down by one
 *   when the deletion happened before it, otherwise stays put.
 * - If the deleted sheet IS the active one: the pointer stays at the same
 *   position (the next sheet slides into it), clamped to the new count.
 * Result is clamped into the surviving [0, oldCount-2] index space.
 */
export function activeIndexAfterDelete(
  deletedIndex: number,
  activeIndex: number,
  oldCount: number,
): number {
  //@ verify
  //@ ensures oldCount <= 1 ==> \result === -1
  //@ ensures oldCount > 1 && deletedIndex < activeIndex ==> \result === clampIndex(activeIndex - 1, oldCount - 1)
  //@ ensures oldCount > 1 && deletedIndex > activeIndex ==> \result === clampIndex(activeIndex, oldCount - 1)
  //@ ensures oldCount > 1 && deletedIndex === activeIndex ==> \result === clampIndex(activeIndex, oldCount - 1)
  if (oldCount <= 1) return NO_INDEX;
  const newCount = oldCount - 1;
  if (deletedIndex < activeIndex) {
    return clampIndex(activeIndex - 1, newCount);
  }
  return clampIndex(activeIndex, newCount);
}

/**
 * Pure policy for picking a new active index when the CURRENT active sheet
 * is hidden and is not itself visible: caller supplies the nearest visible
 * index in each direction (or -1 if none); prefer the following sheet, else
 * the preceding one, else NO_INDEX (unreachable given invariant 2).
 */
export function activeIndexAfterHide(nextVisibleIndex: number, prevVisibleIndex: number): number {
  //@ verify
  //@ ensures nextVisibleIndex >= 0 ==> \result === nextVisibleIndex
  //@ ensures nextVisibleIndex === -1 && prevVisibleIndex >= 0 ==> \result === prevVisibleIndex
  //@ ensures nextVisibleIndex === -1 && prevVisibleIndex === -1 ==> \result === -1
  if (nextVisibleIndex >= 0) return nextVisibleIndex;
  if (prevVisibleIndex >= 0) return prevVisibleIndex;
  return NO_INDEX;
}

// --- 4. Reorder target-index clamping ---------------------------------------

/**
 * Clamp a requested reorder destination into the valid post-removal
 * insertion range [0, count-1] (count = sheet count, unchanged by reorder).
 */
export function reorderTargetIndex(requestedIndex: number, count: number): number {
  //@ verify
  //@ ensures count <= 0 ==> \result === -1
  //@ ensures count > 0 ==> \result === clampIndex(requestedIndex, count)
  if (count <= 0) return NO_INDEX;
  return clampIndex(requestedIndex, count);
}

// --- 5. Rename/delete formula-reference rewrite classification -------------

/** Reference is unrelated to the renamed/deleted sheet; left untouched. */
export const REF_UNCHANGED = 0;
/** Reference was sheet-qualified to the renamed sheet; qualifier rewritten. */
export const REF_RENAMED = 1;
/** Reference was sheet-qualified to the deleted sheet; collapsed to #REF!. */
export const REF_BROKEN = 2;

/**
 * Classify how a single sheet-qualified formula reference must be rewritten
 * given whether it targets the affected sheet and whether the operation is a
 * rename (targetSheetName !== null in the caller) or a delete.
 */
export function classifyReferenceRewrite(
  referencesAffectedSheet: boolean,
  isDelete: boolean,
): number {
  //@ verify
  //@ ensures referencesAffectedSheet === false ==> \result === 0
  //@ ensures referencesAffectedSheet === true && isDelete === true ==> \result === 2
  //@ ensures referencesAffectedSheet === true && isDelete === false ==> \result === 1
  if (!referencesAffectedSheet) return REF_UNCHANGED;
  if (isDelete) return REF_BROKEN;
  return REF_RENAMED;
}

// --- Runtime-locked bridge layer (string scanning; not verified) -----------

/** Characters forbidden in a workbook sheet name: save-format/formula syntax. */
export const FORBIDDEN_SHEET_NAME_CHARS = [":", "!", "'", '"', "[", "]", "\\", "/", "?", "*"];

/**
 * Case/whitespace-insensitive normalization used for uniqueness comparisons.
 * Mirrors SocialCalc.Formula.NormalizeSheetName's default (lowercase);
 * additionally trims, since UI-entered names may carry incidental whitespace.
 * Runtime helper — not verified (string ops unsupported on the Lean path).
 */
export function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Whether name contains any character from FORBIDDEN_SHEET_NAME_CHARS.
 * Runtime-locked scan — not verified (loop termination trivial).
 */
export function hasInvalidSheetNameChar(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    if (FORBIDDEN_SHEET_NAME_CHARS.indexOf(name.charAt(i)) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * Whether normalizedName already appears in existingNormalizedNames.
 * Runtime-locked scan — not verified (loop termination trivial).
 */
export function isDuplicateName(
  normalizedName: string,
  existingNormalizedNames: string[],
): boolean {
  for (let i = 0; i < existingNormalizedNames.length; i++) {
    if (existingNormalizedNames[i] === normalizedName) {
      return true;
    }
  }
  return false;
}

/**
 * Full pure/bridge sheet-name validation entry point: normalizes, computes
 * the three predicates, and defers the precedence decision to the verified
 * validateSheetName. Mirrors lemma/lookup-result.ts's lookupResultType
 * (bridge assembly wrapping a fully verified chooser).
 */
export function computeSheetNameValidation(name: string, existingNames: string[]): number {
  const trimmed = name.trim();
  const normalized = normalizeSheetName(name);
  const existingNormalized = existingNames.map(normalizeSheetName);
  return validateSheetName(
    trimmed.length === 0,
    name.length > MAX_SHEET_NAME_LENGTH,
    hasInvalidSheetNameChar(name),
    isDuplicateName(normalized, existingNormalized),
  );
}
