/**
 * LemmaScript facade: pure LookupResultType string-table algorithm.
 * Non-shipping mirror of js/formula-parse.ts FormulaParseMut.LookupResultType.
 *
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 *
 * Algorithm (shipping oracle):
 * 1. select row: table[type1] else table[type1.charAt(0)+'*'] else missing-internal
 * 2. find exact "|type2:" entry in pipe-table row
 * 3. else find "|type2.charAt(0)*:" wildcard entry
 * 4. token "1" → type1, "2" → type2, else literal token
 * 5. no match → e#VALUE!
 *
 * Design notes for LemmaScript:
 * - resolveToken is the //@ verify pure core (strong ensures; no string scan).
 * - Full row-scan / map select uses indexOf/charAt; Dafny/Lean backends do not
 *   auto-prove those slices, so they stay Bun-locked against shipping.
 */

/**
 * Resolve a pipe-table result token against the two operand types.
 * Token "1" means type1, "2" means type2, otherwise the literal token.
 */
export function resolveToken(type1: string, type2: string, token: string): string {
  //@ verify
  //@ ensures token === "1" ==> \result === type1
  //@ ensures token === "2" ==> \result === type2
  //@ ensures token !== "1" && token !== "2" ==> \result === token
  if (token === "1") return type1;
  if (token === "2") return type2;
  return token;
}

/**
 * Leading type character ("" when type is empty). Mirrors String.charAt(0).
 */
export function typeChar0(type: string): string {
  if (type.length === 0) return "";
  return type.charAt(0);
}

/**
 * Wildcard key used for type-family rows/entries: char0 + "*".
 */
export function wildcardKey(type: string): string {
  return typeChar0(type) + "*";
}

/**
 * Missing-row internal error message (shipping LookupResultType).
 */
export function missingRowError(type1: string): string {
  return "e#VALUE! (internal error, missing LookupResultType " + typeChar0(type1) + "*)";
}

/**
 * Malformed pipe-table row (no closing "|") internal error.
 */
export function incorrectRowError(row: string): string {
  return "e#VALUE! (internal error, incorrect LookupResultType " + row + ")";
}

/**
 * Select the pipe-table row for type1 from a TypeLookupTable sub-map.
 * Exact key first, then type-family wildcard key, else null.
 */
export function selectRow(
  type1: string,
  table: Record<string, string>,
): string | null {
  const exact = table[type1];
  if (exact !== undefined) return exact;
  const wild = table[wildcardKey(type1)];
  if (wild !== undefined) return wild;
  return null;
}

/**
 * Scan one pipe-table row for type2 (exact then family wildcard).
 * Pure mirror of the indexOf/substring core in shipping LookupResultType.
 */
export function lookupInRow(type1: string, type2: string, row: string): string {
  const exactNeedle = "|" + type2 + ":";
  let pos1 = row.indexOf(exactNeedle);
  if (pos1 >= 0) {
    const pos2 = row.indexOf("|", pos1 + 1);
    if (pos2 < 0) return incorrectRowError(row);
    const token = row.substring(pos1 + type2.length + 2, pos2);
    return resolveToken(type1, type2, token);
  }
  const wildNeedle = "|" + typeChar0(type2) + "*:";
  pos1 = row.indexOf(wildNeedle);
  if (pos1 >= 0) {
    const pos2 = row.indexOf("|", pos1 + 1);
    if (pos2 < 0) return incorrectRowError(row);
    // "|X*:" is always 4 characters
    const token = row.substring(pos1 + 4, pos2);
    return resolveToken(type1, type2, token);
  }
  return "e#VALUE!";
}

/**
 * Full pure LookupResultType: select row then scan.
 * Mirrors FormulaParseMut.LookupResultType / SocialCalc.Formula.LookupResultType.
 */
export function lookupResultType(
  type1: string,
  type2: string,
  table: Record<string, string>,
): string {
  const row = selectRow(type1, table);
  if (row === null) return missingRowError(type1);
  return lookupInRow(type1, type2, row);
}
