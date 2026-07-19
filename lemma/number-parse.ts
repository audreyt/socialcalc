/**
 * LemmaScript facade: pure fixed-locale numeric classification policy
 * and pure ingestion validation policy for the workbook-interoperability
 * seam (CSV/TSV locale variants, normalized-workbook ingestion, FODS
 * formula-separator translation).
 *
 * Non-shipping mirror of pure cores in js/socialcalc-3.ts
 * (SC.HasUtf8Bom / SC.StripUtf8Bom / SC.GroupingCharFor /
 * SC.ReplaceUnquotedFormulaChar / SC.IsValidNamedRangeName /
 * SC.NormalizeNamedRangeName / SC.IsValidNormalizedCellCoord).
 *
 * Global-script shipping sources cannot be extracted by lsc (no exports);
 * this exported module is the verification surface for Dafny + Lean.
 *
 * Design notes for LemmaScript:
 * - Prefer char-loop scanning over regex (Lean/Dafny-friendly), matching
 *   the existing lemma/a1.ts and lemma/lookup-result.ts conventions.
 * - Separate pure integer/boolean DECISION policy (verified) from string
 *   emission/scanning (documented as a runtime-locked helper, not
 *   verified) — same split as lemma/a1.ts's offsetCol vs. offsetA1.
 */

/**
 * Explicit-locale decimal-point classifier — NOT an autodetecting
 * tie-break. The CSV locale variant declares its decimal character up
 * front (decimalChar is exactly "," or "."); the OTHER character is
 * therefore ALWAYS the thousands-grouping separator in that locale,
 * regardless of which one occurs later in the string. (An earlier
 * "rightmost separator wins" heuristic was considered and rejected: under
 * a fixed EU locale it would misclassify a pure-grouping token like
 * "1.234" — dot only, no comma — as dot-decimal 1.234 instead of the
 * intended grouped integer 1234, silently corrupting the value. Fixed-
 * locale mode must never guess.)
 *
 * Returns the grouping character to strip unconditionally: "," when
 * decimalChar is ".", or "." when decimalChar is ",". decimalChar MUST be
 * exactly "," or "."; any other input returns "" (caller treats as
 * unrecognized/no grouping character, i.e. a no-op strip).
 */
export function groupingCharFor(decimalChar: string): string {
  //@ verify
  //@ ensures \result === "" || \result === "," || \result === "."
  //@ ensures decimalChar === "." ==> \result === ","
  //@ ensures decimalChar === "," ==> \result === "."
  //@ ensures decimalChar !== "." && decimalChar !== "," ==> \result === ""
  if (decimalChar === ".") return ",";
  if (decimalChar === ",") return ".";
  return "";
}

/** Whether a single character is a decimal-number digit 0-9. */
export function isAsciiDigit(ch: string): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> ch.length === 1 && ch >= "0" && ch <= "9"
  return ch.length === 1 && ch >= "0" && ch <= "9";
}

/**
 * Whether a single character is valid inside a SocialCalc defined-name
 * (shipping policy: name.toUpperCase().replace(/[^A-Z0-9_.]/g, "")).
 */
export function isNameChar(ch: string): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> ch.length === 1 && ((ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch === "_" || ch === ".")
  return (
    ch.length === 1 &&
    ((ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch === "_" || ch === ".")
  );
}

/**
 * Upper-cases and strips every character that fails isNameChar — pure
 * char-loop mirror of the shipping `name` command's normalization
 * (`name.toUpperCase().replace(/[^A-Z0-9_.]/g, "")`), Dafny/Lean-expressible
 * (no regex).
 */
export function normalizeNamedRangeName(raw: string): string {
  // Runtime-locked scan — not verified (charAt loop unsupported by the
  // Dafny backend, matching lemma/lookup-result.ts's typeChar0/parsePipeRow
  // precedent for charAt-based helpers).
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charAt(i).toUpperCase();
    if (isNameChar(ch)) out += ch;
  }
  return out;
}

/**
 * A normalized-workbook named-range name is valid iff non-empty and
 * already in normalized form (round-trips through normalizeNamedRangeName
 * unchanged) — i.e. the caller supplied a clean, already-uppercased,
 * already-restricted-charset name rather than relying on silent stripping.
 * Runtime-locked (depends on normalizeNamedRangeName) — not verified.
 */
export function isValidNamedRangeName(raw: string): boolean {
  if (raw.length === 0) return false;
  return normalizeNamedRangeName(raw) === raw;
}

/**
 * Whether a string is a syntactically valid, unqualified normalized-
 * workbook cell coordinate key: 1-2 letters A-Z (uppercase only — the
 * ingestion seam requires pre-uppercased keys, matching how SocialCalc's
 * own save format always stores coordinates uppercase) followed by 1+
 * digits with no leading zero. Column-band (<=702 / "ZZ") and row (>=1)
 * bounds are the caller's job (see lemma/a1.ts's isColInBounds /
 * isRowInBounds) — this only checks lexical shape.
 * Runtime-locked scan — not verified. Deliberately STRICTER than the
 * shipping `coordregex` `/^\$?[A-Z]{1,2}\$?[1-9]\d*$/i`: this rejects the
 * `$` absolute markers and case-insensitivity that regex allows (the
 * ingestion seam's coord keys are always plain, pre-uppercased, unqualified
 * A1 text, never `$A$1` or `a1`), so it is a strict SUBSET check, not an
 * equivalence to that regex.
 */
export function isValidNormalizedCellCoord(key: string): boolean {
  let i = 0;
  let letters = 0;
  while (i < key.length && key.charAt(i) >= "A" && key.charAt(i) <= "Z") {
    letters++;
    i++;
    if (letters > 2) return false;
  }
  if (letters === 0) return false;
  if (i >= key.length) return false;
  if (key.charAt(i) === "0") return false; // no leading zero on the row digits
  let digits = 0;
  while (i < key.length) {
    if (!isAsciiDigit(key.charAt(i))) return false;
    digits++;
    i++;
  }
  return digits > 0;
}

/**
 * Quote-aware single-character replacement, matching SocialCalc's own
 * formula-lexer quote model exactly (js/formula-ref.ts's
 * quoteFormulaString doc comment): a quoted run may be opened by EITHER
 * `'` or `"`, closed by EITHER `'` or `"` (the lexer treats them as one
 * quote class and does not remember the opener), and a doubled quote
 * character while inside a quoted run is a literal escaped quote, not a
 * close. `from`/`to` MUST each be exactly one character and MUST NOT be
 * `'` or `"` (the caller's job — see SC.ReplaceUnquotedFormulaChar's
 * guard). Used ONLY for the explicit-opt-in ingestion-time formula
 * separator normalization (semicolon-authored formula text -> SocialCalc's
 * native comma-separated syntax): SocialCalc's tokenizer has no existing
 * use of a bare `;` (confirmed: no separator/argsep handling anywhere in
 * js/formula-parse.ts or js/formula1.ts) and ranges use `:`, not `,`/`;`,
 * so this substitution cannot collide with range or comma-argument syntax.
 */
export function replaceUnquotedChar(text: string, from: string, to: string): string {
  // Runtime-locked scan — not verified (charAt loop unsupported by the
  // Dafny backend; confirmed by `lsc regen` emitting
  // "Unsupported Dafny method call: .charAt() on string" and skipping this
  // declaration — same charAt limitation as normalizeNamedRangeName above
  // and lemma/lookup-result.ts's existing typeChar0/parsePipeRow).
  let result = "";
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === "'" || ch === '"') {
      if (inQuote && i + 1 < text.length && text.charAt(i + 1) === ch) {
        // doubled quote char while inside a quoted run: literal, stays quoted
        result += ch + ch;
        i += 2;
        continue;
      }
      inQuote = !inQuote;
      result += ch;
      i += 1;
      continue;
    }
    if (!inQuote && ch === from) {
      result += to;
    } else {
      result += ch;
    }
    i += 1;
  }
  return result;
}

/**
 * Whether the first UTF-16 code unit of a string is the U+FEFF BOM.
 * Runtime-locked (not verified): both the Dafny backend (rejects
 * `.charAt()`) and the Lean backend (rejects `.charCodeAt()` and the
 * `\uFEFF` escape in a `//@ ensures` spec string) reject some form this
 * needs, and embedding a raw BOM byte in source to dodge both is fragile
 * (editors/formatters/git can silently normalize it away without a
 * visible diff) — same charAt/charCodeAt limitation as
 * lemma/eval-ops.ts's fromValueType. Cross-checked against the shipping
 * mirror by test/lemma-number-parse-facade.test.ts.
 */
export function hasBom(s: string): boolean {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff;
}

/** Strips a single leading UTF-8 BOM (U+FEFF) if present; else returns s unchanged. */
export function stripBom(s: string): string {
  return hasBom(s) ? s.slice(1) : s;
}
