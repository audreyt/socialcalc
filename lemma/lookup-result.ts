/**
 * LemmaScript facade: pure LookupResultType string-table algorithm.
 * Non-shipping mirror of js/formula-parse.ts FormulaParseMut.LookupResultType.
 *
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 *
 * Layers:
 * 1. resolveToken — //@ verify (1/2/literal token resolution)
 * 2. chooseLookupResult — //@ verify (exact-before-wildcard-before-miss precedence)
 * 3. findExact / hasExact — runtime-locked linear scan (not verified)
 * 4. Entry scan / pipe-string parse / Record select — runtime-locked bridge to shipping
 * 1. select row: table[type1] else table[type1.charAt(0)+'*'] else missing-internal
 * 2. find exact "|type2:" entry in pipe-table row
 * 3. else find "|type2.charAt(0)*:" wildcard entry
 * 4. token "1" → type1, "2" → type2, else literal token
 * 5. no match → e#VALUE!
 */

/** One type2→token mapping (parsed from a pipe-table row). */
export type TableEntry = {
  key: string;
  val: string;
};

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
 * Leading type character ("" when type is empty).
 * Runtime helper — not verified (charAt unsupported on Lean).
 */
export function typeChar0(type: string): string {
  if (type.length === 0) return "";
  return type.charAt(0);
}

/**
 * Wildcard key used for type-family rows/entries: char0 + "*".
 * Runtime helper — not verified (depends on typeChar0).
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
 * Linear search for an exact key in an entry list.
 * Returns the value, or "" if not found (shipping tokens are never empty).
 * Runtime-locked scan — not verified (loop termination trivial).
 */
export function findExact(entries: TableEntry[], needle: string): string {
  let i = 0;
  while (i < entries.length) {
    const e = entries[i]!;
    if (e.key === needle) {
      return e.val;
    }
    i = i + 1;
  }
  return "";
}

/**
 * Whether an exact key is present (avoids ""-value ambiguity for ensures).
 * Runtime-locked scan — not verified (loop termination trivial).
 */
export function hasExact(entries: TableEntry[], needle: string): boolean {
  let i = 0;
  while (i < entries.length) {
    if (entries[i]!.key === needle) {
      return true;
    }
    i = i + 1;
  }
  return false;
}

/**
 * Exact-before-wildcard precedence as a pure choice code.
 * 0 = use exact, 1 = use family wildcard, 2 = miss → e#VALUE!.
 */
export function preferExact(hasExactKey: boolean, hasWildKey: boolean): number {
  //@ verify
  //@ ensures hasExactKey === true ==> \result === 0
  //@ ensures hasExactKey === false && hasWildKey === true ==> \result === 1
  //@ ensures hasExactKey === false && hasWildKey === false ==> \result === 2
  if (hasExactKey === true) return 0;
  if (hasWildKey === true) return 1;
  return 2;
}

/**
 * Pure precedence chooser: given pre-computed exact/wildcard presence and
 * their resolved tokens, return the shipping LookupResultType result.
 * Loop-free so lsc emits a Dafny *function* (callable in ensures).
 *
 * VCs lock the exact-before-wildcard-before-miss policy:
 * - exact hit  → resolveToken(type1, type2, exactToken)
 * - no exact, wild hit → resolveToken(type1, type2, wildToken)
 * - neither → "e#VALUE!"
 */
export function chooseLookupResult(
  type1: string,
  type2: string,
  hasExactKey: boolean,
  exactToken: string,
  hasWildKey: boolean,
  wildToken: string,
): string {
  //@ verify
  //@ ensures hasExactKey === true ==> \result === resolveToken(type1, type2, exactToken)
  //@ ensures hasExactKey === false && hasWildKey === true ==> \result === resolveToken(type1, type2, wildToken)
  //@ ensures hasExactKey === false && hasWildKey === false ==> \result === "e#VALUE!"
  if (hasExactKey === true) {
    return resolveToken(type1, type2, exactToken);
  }
  if (hasWildKey === true) {
    return resolveToken(type1, type2, wildToken);
  }
  return "e#VALUE!";
}

/**
 * Lookup type2 in an entry list with shipping precedence:
 * exact key first, then family wildcard (char0 + "*"), else e#VALUE!.
 * Scan correctness is runtime-locked; the precedence *choice* is verified via
 * chooseLookupResult (exact-wins / wildcard / miss VCs).
 */
export function lookupInEntries(type1: string, type2: string, entries: TableEntry[]): string {
  const hasE = hasExact(entries, type2);
  const wild = wildcardKey(type2);
  const hasW = hasExact(entries, wild);
  return chooseLookupResult(
    type1,
    type2,
    hasE,
    findExact(entries, type2),
    hasW,
    findExact(entries, wild),
  );
}

/**
 * Select the pipe-table row for type1 from a TypeLookupTable sub-map.
 * Exact key first, then type-family wildcard key, else null.
 * (Record index — runtime / shipping bridge; not verified.)
 */
export function selectRow(type1: string, table: Record<string, string>): string | null {
  const exact = table[type1];
  if (exact !== undefined) return exact;
  const wild = table[wildcardKey(type1)];
  if (wild !== undefined) return wild;
  return null;
}

/**
 * Parse a shipping pipe-table row into TableEntry[].
 * Format: "|key:val|key2:val2|..." (leading | required for first entry).
 * Malformed segments are skipped; runtime-locked (string scan).
 */
export function parsePipeRow(row: string): TableEntry[] {
  const entries: TableEntry[] = [];
  let i = 0;
  while (i < row.length) {
    if (row.charAt(i) !== "|") {
      i = i + 1;
      continue;
    }
    const start = i + 1;
    const end = row.indexOf("|", start);
    if (end < 0) {
      break;
    }
    const seg = row.substring(start, end);
    const colon = seg.indexOf(":");
    if (colon >= 0) {
      entries.push({
        key: seg.substring(0, colon),
        val: seg.substring(colon + 1),
      });
    }
    i = end;
  }
  return entries;
}

/**
 * Scan one pipe-table row for type2 (exact then family wildcard).
 * Parses then uses chooseLookupResult for the precedence choice.
 */
export function lookupInRow(type1: string, type2: string, row: string): string {
  const exactNeedle = "|" + type2 + ":";
  const posExact = row.indexOf(exactNeedle);
  if (posExact >= 0) {
    const pos2 = row.indexOf("|", posExact + 1);
    if (pos2 < 0) return incorrectRowError(row);
  } else {
    const wildNeedle = "|" + typeChar0(type2) + "*:";
    const posWild = row.indexOf(wildNeedle);
    if (posWild >= 0) {
      const pos2 = row.indexOf("|", posWild + 1);
      if (pos2 < 0) return incorrectRowError(row);
    }
  }
  return lookupInEntries(type1, type2, parsePipeRow(row));
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
  if (row === null) {
    return missingRowError(type1);
  }
  return lookupInRow(type1, type2, row);
}

/**
 * Entry-list form of full lookup when the caller already selected a row.
 * Runtime-facing test entry point; precedence choice is verified via chooseLookupResult.
 */
export function lookupResultInEntries(type1: string, type2: string, entries: TableEntry[]): string {
  return lookupInEntries(type1, type2, entries);
}
