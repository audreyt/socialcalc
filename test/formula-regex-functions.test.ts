import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Command-level tests for REGEXMATCH/REGEXEXTRACT/REGEXREPLACE. See
// js/formula1.ts SocialCalc.Formula.RegexMatchFunction/RegexExtractFunction/
// RegexReplaceFunction and CompileRegex/TranslateRegexReplacement for the
// implementation.

async function setup(commands: string[]) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands);
  await recalcSheet(SC, sheet);
  const getDV = (coord: string) => sheet.GetAssuredCell(coord).datavalue;
  const getVT = (coord: string) => sheet.GetAssuredCell(coord).valuetype;
  return { SC, sheet, getDV, getVT };
}

// ---------------------------------------------------------------------------
// REGEXMATCH
// ---------------------------------------------------------------------------

test("REGEXMATCH: true on partial (unanchored) match", async () => {
  const { getDV, getVT } = await setup(['set A1 formula REGEXMATCH("hello world","wor")']);
  expect(getVT("A1")).toBe("nl");
  expect(getDV("A1")).toBe(1);
});

test("REGEXMATCH: false when no substring matches", async () => {
  const { getDV } = await setup(['set A1 formula REGEXMATCH("hello","xyz")']);
  expect(getDV("A1")).toBe(0);
});

test("REGEXMATCH: supports full regex syntax (anchors, character classes)", async () => {
  const { getDV } = await setup(['set A1 formula REGEXMATCH("12345","^[0-9]+$")']);
  expect(getDV("A1")).toBe(1);
});

test("REGEXMATCH: invalid pattern is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula REGEXMATCH("x","(unclosed")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("REGEXMATCH: propagates an upstream error in text", async () => {
  const { getVT } = await setup(['set A1 formula REGEXMATCH(1/0,"x")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("REGEXMATCH: propagates an upstream error in the pattern", async () => {
  const { getVT } = await setup(['set A1 formula REGEXMATCH("x",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("REGEXMATCH: wrong arg count is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula REGEXMATCH("x")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// REGEXEXTRACT
// ---------------------------------------------------------------------------

test("REGEXEXTRACT: no capturing group returns the whole match", async () => {
  const { getDV } = await setup(['set A1 formula REGEXEXTRACT("hello123world","[0-9]+")']);
  expect(getDV("A1")).toBe("123");
});

test("REGEXEXTRACT: exactly one capturing group returns just that group", async () => {
  const { getDV } = await setup(['set A1 formula REGEXEXTRACT("price: $42.50","\\$([0-9.]+)")']);
  expect(getDV("A1")).toBe("42.50");
});

test("REGEXEXTRACT: two or more groups spill across a row", async () => {
  const { sheet } = await setup([
    'set A1 formula REGEXEXTRACT("2026-07-19","([0-9]+)-([0-9]+)-([0-9]+)")',
  ]);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("2026");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("07");
  expect(sheet.GetAssuredCell("C1").datavalue).toBe("19");
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(3);
});

test("REGEXEXTRACT: no match is #N/A", async () => {
  const { getVT } = await setup(['set A1 formula REGEXEXTRACT("hello","[0-9]+")']);
  expect(getVT("A1")).toBe("e#N/A");
});

test("REGEXEXTRACT: propagates an upstream error in text", async () => {
  const { getVT } = await setup(['set A1 formula REGEXEXTRACT(1/0,"[0-9]+")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("REGEXEXTRACT: propagates an upstream error in the pattern", async () => {
  const { getVT } = await setup(['set A1 formula REGEXEXTRACT("x",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("REGEXEXTRACT: a single unmatched optional group extracts as empty text (single-group scalar path)", async () => {
  const { getDV } = await setup(['set A1 formula REGEXEXTRACT("ab","a(x)?b")']);
  expect(getDV("A1")).toBe("");
});

test("REGEXEXTRACT: invalid pattern is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula REGEXEXTRACT("x","[unterminated")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("REGEXEXTRACT: an unmatched optional group extracts as empty text", async () => {
  const { getDV } = await setup(['set A1 formula REGEXEXTRACT("abc","a(x)?(b)")']);
  expect(getDV("A1")).toBe("");
});

// ---------------------------------------------------------------------------
// REGEXREPLACE
// ---------------------------------------------------------------------------

test("REGEXREPLACE: replaces every non-overlapping match (global)", async () => {
  const { getDV } = await setup(['set A1 formula REGEXREPLACE("a1b2c3","[0-9]","#")']);
  expect(getDV("A1")).toBe("a#b#c#");
});

test("REGEXREPLACE: backreferences \\1..\\9 translate to captured groups", async () => {
  const { getDV } = await setup([
    'set A1 formula REGEXREPLACE("John Smith","(\\w+) (\\w+)","\\2 \\1")',
  ]);
  expect(getDV("A1")).toBe("Smith John");
});

test("REGEXREPLACE: a literal $ in replacement is not treated as a JS replacement token", async () => {
  const { getDV } = await setup(['set A1 formula REGEXREPLACE("42","[0-9]+","$1 dollars")']);
  expect(getDV("A1")).toBe("$1 dollars");
});

test("REGEXREPLACE: \\\\ in replacement is a literal backslash (escape translation)", async () => {
  const { getDV } = await setup(['set A1 formula REGEXREPLACE("a","a","\\\\")']);
  expect(getDV("A1")).toBe("\\");
});

test("REGEXREPLACE: an unsupported escape (\\z) keeps the literal backslash", async () => {
  const { getDV } = await setup(['set A1 formula REGEXREPLACE("a","a","\\z")']);
  expect(getDV("A1")).toBe("\\z");
});

test("REGEXREPLACE: a backreference above the number of groups is left as a literal $N (JS replace semantics)", async () => {
  // The pattern has no capturing groups, so the replacement "\\1X"
  // translates to "$1X"; JS String.replace then leaves an out-of-range $n
  // literal rather than expanding it to "".
  const { getDV } = await setup(['set A1 formula REGEXREPLACE("a","a","\\1X")']);
  expect(getDV("A1")).toBe("$1X");
});
test("REGEXREPLACE: no match leaves text unchanged", async () => {
  const { getDV } = await setup(['set A1 formula REGEXREPLACE("hello","[0-9]+","x")']);
  expect(getDV("A1")).toBe("hello");
});

test("REGEXREPLACE: invalid pattern is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula REGEXREPLACE("x","[bad","y")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("REGEXREPLACE: propagates an upstream error in replacement", async () => {
  const { getVT } = await setup(['set A1 formula REGEXREPLACE("x","x",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("REGEXREPLACE: propagates an upstream error in text", async () => {
  const { getVT } = await setup(['set A1 formula REGEXREPLACE(1/0,"x","y")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("REGEXREPLACE: propagates an upstream error in the pattern", async () => {
  const { getVT } = await setup(['set A1 formula REGEXREPLACE("x",1/0,"y")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("REGEXREPLACE: nesting inside IFERROR resolves normally when the pattern is valid", async () => {
  const { getDV } = await setup(['set A1 formula IFERROR(REGEXREPLACE("abc","b","X"),"fallback")']);
  expect(getDV("A1")).toBe("aXc");
});
