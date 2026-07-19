import { describe, expect, test } from "vite-plus/test";

import {
  groupingCharFor,
  hasBom,
  isAsciiDigit,
  isNameChar,
  isValidNamedRangeName,
  isValidNormalizedCellCoord,
  normalizeNamedRangeName,
  replaceUnquotedChar,
  stripBom,
} from "../lemma/number-parse";
import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/number-parse pure core (Dafny/Lean surface)", () => {
  test("groupingCharFor: explicit-locale decimal classifier, never a tie-break", () => {
    expect(groupingCharFor(".")).toBe(",");
    expect(groupingCharFor(",")).toBe(".");
    expect(groupingCharFor("x")).toBe("");
    expect(groupingCharFor("")).toBe("");
  });

  test("isAsciiDigit / isNameChar boundaries", () => {
    expect(isAsciiDigit("0")).toBe(true);
    expect(isAsciiDigit("9")).toBe(true);
    expect(isAsciiDigit("a")).toBe(false);
    expect(isAsciiDigit("")).toBe(false);
    expect(isAsciiDigit("10")).toBe(false);
    expect(isNameChar("A")).toBe(true);
    expect(isNameChar("Z")).toBe(true);
    expect(isNameChar("_")).toBe(true);
    expect(isNameChar(".")).toBe(true);
    expect(isNameChar("a")).toBe(false); // lowercase is not a name char (uppercase happens before this check)
    expect(isNameChar("-")).toBe(false);
    expect(isNameChar(" ")).toBe(false);
  });

  test("normalizeNamedRangeName strips disallowed chars and uppercases", () => {
    expect(normalizeNamedRangeName("total")).toBe("TOTAL");
    expect(normalizeNamedRangeName("My Range!")).toBe("MYRANGE");
    expect(normalizeNamedRangeName("A_1.B")).toBe("A_1.B");
    expect(normalizeNamedRangeName("")).toBe("");
  });

  test("isValidNamedRangeName requires non-empty round-trip through normalize", () => {
    expect(isValidNamedRangeName("TOTAL")).toBe(true);
    expect(isValidNamedRangeName("A_1.B")).toBe(true);
    expect(isValidNamedRangeName("total")).toBe(false); // not pre-normalized (lowercase)
    expect(isValidNamedRangeName("My Range!")).toBe(false); // has stripped chars
    expect(isValidNamedRangeName("")).toBe(false);
  });

  test("isValidNormalizedCellCoord: 1-2 uppercase letters + no-leading-zero digits", () => {
    expect(isValidNormalizedCellCoord("A1")).toBe(true);
    expect(isValidNormalizedCellCoord("ZZ702")).toBe(true);
    expect(isValidNormalizedCellCoord("AAA1")).toBe(false); // 3 letters
    expect(isValidNormalizedCellCoord("a1")).toBe(false); // lowercase
    expect(isValidNormalizedCellCoord("A01")).toBe(false); // leading zero
    expect(isValidNormalizedCellCoord("A0")).toBe(false); // row 0 invalid (leading zero digit char)
    expect(isValidNormalizedCellCoord("1A")).toBe(false); // digits before letters
    expect(isValidNormalizedCellCoord("A")).toBe(false); // no digits
    expect(isValidNormalizedCellCoord("A1X")).toBe(false); // non-digit trailing char after digits start
    expect(isValidNormalizedCellCoord("")).toBe(false);
  });

  test("replaceUnquotedChar: quote-aware substitution, doubled-quote literal preserved", () => {
    expect(replaceUnquotedChar("SUM(1;2;3)", ";", ",")).toBe("SUM(1,2,3)");
    // ';' inside a double-quoted string literal is untouched
    expect(replaceUnquotedChar('TEXTJOIN(";",A1;B1)', ";", ",")).toBe('TEXTJOIN(";",A1,B1)');
    // doubled quote (escaped quote) inside a quoted run stays literal, quote state unaffected
    expect(replaceUnquotedChar('"a""b";C1', ";", ",")).toBe('"a""b",C1');
    // single-quote strings behave identically (SocialCalc lexer treats ' and " as one quote class)
    expect(replaceUnquotedChar("'a;b';C1", ";", ",")).toBe("'a;b',C1");
    expect(replaceUnquotedChar("no-semicolons-here", ";", ",")).toBe("no-semicolons-here");
  });

  test("hasBom / stripBom", () => {
    expect(hasBom("\uFEFFhello")).toBe(true);
    expect(hasBom("hello")).toBe(false);
    expect(hasBom("")).toBe(false);
    expect(stripBom("\uFEFFhello")).toBe("hello");
    expect(stripBom("hello")).toBe("hello");
    expect(stripBom("\uFEFF")).toBe("");
  });
});

describe("lemma/number-parse vs shipping SocialCalc.* mirrors", () => {
  test("groupingCharFor matches SC.GroupingCharFor", async () => {
    const SC = await loadSocialCalc();
    for (const ch of [".", ",", "x", ""]) {
      expect(groupingCharFor(ch)).toBe(SC.GroupingCharFor(ch));
    }
  });

  test("hasBom/stripBom match SC.HasUtf8Bom/SC.StripUtf8Bom", async () => {
    const SC = await loadSocialCalc();
    for (const s of ["\uFEFFhello", "hello", "", "\uFEFF"]) {
      expect(hasBom(s)).toBe(SC.HasUtf8Bom(s));
      expect(stripBom(s)).toBe(SC.StripUtf8Bom(s));
    }
  });

  test("normalizeNamedRangeName/isValidNamedRangeName match shipping mirrors", async () => {
    const SC = await loadSocialCalc();
    for (const raw of ["total", "My Range!", "A_1.B", ""]) {
      expect(normalizeNamedRangeName(raw)).toBe(SC.NormalizeNamedRangeName(raw));
      expect(isValidNamedRangeName(raw)).toBe(SC.IsValidNamedRangeName(raw));
    }
  });

  test("isValidNormalizedCellCoord matches shipping mirror", async () => {
    const SC = await loadSocialCalc();
    for (const key of ["A1", "ZZ702", "AAA1", "a1", "A01", "1A", "A", "A1X", ""]) {
      expect(isValidNormalizedCellCoord(key)).toBe(SC.IsValidNormalizedCellCoord(key));
    }
  });

  test("replaceUnquotedChar matches SC.ReplaceUnquotedFormulaChar", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[string, string, string]> = [
      ["SUM(1;2;3)", ";", ","],
      ['TEXTJOIN(";",A1;B1)', ";", ","],
      ['"a""b";C1', ";", ","],
    ];
    for (const [text, from, to] of cases) {
      expect(replaceUnquotedChar(text, from, to)).toBe(
        SC.ReplaceUnquotedFormulaChar(text, from, to),
      );
    }
  });
});
