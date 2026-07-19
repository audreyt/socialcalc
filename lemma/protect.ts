/**
 * LemmaScript facade: pure sheet/cell protection editability policy.
 * Non-shipping mirror of SocialCalc.IsCellEditable / SocialCalc.IsSheetProtected
 * in js/socialcalc-3.ts.
 *
 * Policy (fixed 2026-07-19):
 *   A cell is editable iff it is not individually read-only AND (the sheet is
 *   not protected OR the cell is explicitly marked unlocked). The legacy
 *   per-cell `readonly` flag always wins, independent of protection state,
 *   so protection is strictly additive over pre-existing readonly behavior.
 *
 * Protection is a UI/data-integrity guard against accidental edits, not an
 * access-control or security boundary (no passwords, no cryptographic
 * enforcement — mirrors Excel's unprotected default-locked-cell model).
 *
 * Vite+ tests cross-check against shipping SocialCalc.IsCellEditable and
 * SocialCalc.IsSheetProtected.
 */

/**
 * Whether a sheet is currently in protected mode. Trivial identity mirror of
 * the shipping `sheet.attribs.protected === "yes"` boolean coercion, kept as
 * a named policy function so callers (and proofs) never inline the check.
 */
export function isSheetProtected(protectedAttrib: boolean): boolean {
  return protectedAttrib;
}

/**
 * Whether one cell may be mutated, given sheet protection state and the
 * cell's own readonly/unlocked flags.
 *
 * Truth table (sheetProtected, cellReadonly, cellUnlocked -> editable):
 *   F F F -> T    F F T -> T    F T F -> F    F T T -> F
 *   T F F -> F    T F T -> T    T T F -> F    T T T -> F
 *
 * readonly always blocks (rows 3,4,7,8). When unprotected, readonly is the
 * only gate (rows 1,2 editable; 3,4 blocked) — byte-identical to legacy
 * cell.readonly behavior. When protected, a non-readonly cell is editable
 * only if explicitly unlocked (row 6 editable; row 5 blocked).
 */
export function isCellEditable(
  sheetProtected: boolean,
  cellReadonly: boolean,
  cellUnlocked: boolean,
): boolean {
  if (cellReadonly) return false;
  if (!sheetProtected) return true;
  return cellUnlocked;
}
