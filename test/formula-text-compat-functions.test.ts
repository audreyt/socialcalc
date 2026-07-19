import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Command-level tests for SEARCH, TEXTJOIN/JOIN, TEXTBEFORE/TEXTAFTER, and
// SPLIT/TEXTSPLIT. See js/formula1.ts SocialCalc.Formula.StringFunctions
// (SEARCH case), TextJoinFunction/JoinFunction, TextBeforeAfterFunction,
// SplitFunction, TextSplitFunction for the implementation, and
// lemma/branch.ts keepJoinItem/emitDelimiterBefore for the pure keep/
// delimiter policy TEXTJOIN/JOIN mirror.

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
// SEARCH
// ---------------------------------------------------------------------------

test("SEARCH: case-insensitive counterpart of FIND", async () => {
  const { getDV } = await setup(['set A1 formula SEARCH("WORLD","hello world")']);
  expect(getDV("A1")).toBe(7);
});

test("SEARCH: FIND is still case-sensitive (no match)", async () => {
  const { getVT } = await setup(['set A1 formula FIND("WORLD","hello world")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("SEARCH: honors an explicit start position", async () => {
  const { getDV } = await setup(['set A1 formula SEARCH("o","foo bar foo",5)']);
  expect(getDV("A1")).toBe(10);
});

test("SEARCH: not found is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula SEARCH("zzz","hello")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("SEARCH: a start_num before the string is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula SEARCH("o","foo",0)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// TEXTJOIN
// ---------------------------------------------------------------------------

test("TEXTJOIN: joins scalar text arguments with a delimiter", async () => {
  const { getDV } = await setup(['set A1 formula TEXTJOIN("-",TRUE,"a","b","c")']);
  expect(getDV("A1")).toBe("a-b-c");
});

test("TEXTJOIN: ignore_empty=TRUE skips empty items", async () => {
  const { getDV } = await setup(['set A1 formula TEXTJOIN(",",TRUE,"a","","b")']);
  expect(getDV("A1")).toBe("a,b");
});

test("TEXTJOIN: ignore_empty=FALSE keeps empty items", async () => {
  const { getDV } = await setup(['set A1 formula TEXTJOIN(",",FALSE,"a","","b")']);
  expect(getDV("A1")).toBe("a,,b");
});

test("TEXTJOIN: flattens a range row-major and skips blanks with ignore_empty", async () => {
  const { getDV } = await setup([
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 text t x",
    // B2 left blank
    'set C1 formula TEXTJOIN(",",TRUE,A1:B2)',
  ]);
  // Row-major flatten of A1:B2 = [A1,B1,A2,B2] = [1,2,"x",blank]
  expect(getDV("C1")).toBe("1,2,x");
});

test("TEXTJOIN: propagates an error from a joined item", async () => {
  const { getVT } = await setup(['set A1 formula TEXTJOIN(",",TRUE,"a",1/0,"b")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTJOIN: propagates an error found while flattening a range", async () => {
  const { getVT } = await setup([
    "set A1 value n 1",
    "set A2 formula 1/0",
    'set B1 formula TEXTJOIN(",",TRUE,A1:A2)',
  ]);
  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("TEXTJOIN: propagates an upstream error in the delimiter", async () => {
  const { getVT } = await setup(['set A1 formula TEXTJOIN(1/0,TRUE,"a","b")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTJOIN: propagates an upstream error in ignore_empty", async () => {
  const { getVT } = await setup(['set A1 formula TEXTJOIN(",",1/0,"a","b")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTJOIN: too few arguments is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula TEXTJOIN(",",TRUE)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("TEXTJOIN: cross-sheet range flattens correctly", async () => {
  const SC = await loadSocialCalc();
  const sheet1 = new SC.Sheet();
  const sheet2 = new SC.Sheet();
  SC.Formula.SheetCache.sheets.sheet1 = { sheet: sheet1, name: "sheet1", parsecount: 0 };
  SC.Formula.SheetCache.sheets.sheet2 = { sheet: sheet2, name: "sheet2", parsecount: 0 };
  try {
    await scheduleCommands(SC, sheet1, ["set A1 value n 10", "set A2 value n 20"]);
    await scheduleCommands(SC, sheet2, ['set A1 formula TEXTJOIN("-",TRUE,sheet1!A1:A2)']);
    await recalcSheet(SC, sheet2);
    expect(sheet2.GetAssuredCell("A1").datavalue).toBe("10-20");
  } finally {
    // SheetCache is shared across every loadSocialCalc() caller in this
    // worker; remove these ad-hoc sheets so later suites don't see stale
    // cross-sheet state (see test/sheet-coverage-b.test.ts afterAll for the
    // same pattern).
    delete SC.Formula.SheetCache.sheets.sheet1;
    delete SC.Formula.SheetCache.sheets.sheet2;
    SC.Formula.SheetCache.waitingForLoading = null;
  }
});

// ---------------------------------------------------------------------------
// JOIN (Sheets alias for TEXTJOIN with ignore_empty=false)
// ---------------------------------------------------------------------------

test("JOIN: joins values including empty items (ignore_empty is always false)", async () => {
  const { getDV } = await setup(['set A1 formula JOIN(",","a","","b")']);
  expect(getDV("A1")).toBe("a,,b");
});

test("JOIN: flattens a range row-major", async () => {
  const { getDV } = await setup([
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
    'set C1 formula JOIN("-",A1:B2)',
  ]);
  expect(getDV("C1")).toBe("1-2-3-4");
});

test("JOIN: too few arguments is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula JOIN(",")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("JOIN: propagates an upstream error in the delimiter", async () => {
  const { getVT } = await setup(['set A1 formula JOIN(1/0,"a","b")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// TEXTBEFORE / TEXTAFTER
// ---------------------------------------------------------------------------

test("TEXTBEFORE: basic single-character delimiter", async () => {
  const { getDV } = await setup(['set A1 formula TEXTBEFORE("Jones,Bob",",")']);
  expect(getDV("A1")).toBe("Jones");
});

test("TEXTAFTER: basic single-character delimiter", async () => {
  const { getDV } = await setup(['set A1 formula TEXTAFTER("Jones,Bob",",")']);
  expect(getDV("A1")).toBe("Bob");
});

test("TEXTAFTER: positive instance_num counts from the left", async () => {
  const { getDV } = await setup(['set A1 formula TEXTAFTER("ABX-112-Red-Y","-",2)']);
  expect(getDV("A1")).toBe("Red-Y");
});

test("TEXTAFTER: negative instance_num counts from the right", async () => {
  const { getDV } = await setup(['set A1 formula TEXTAFTER("ABX-112-Red-Y","-",-1)']);
  expect(getDV("A1")).toBe("Y");
});

test("TEXTBEFORE: negative instance_num counts from the right", async () => {
  const { getDV } = await setup(['set A1 formula TEXTBEFORE("ABX-112-Red-Y","-",-1)']);
  expect(getDV("A1")).toBe("ABX-112-Red");
});

test("TEXTAFTER: out-of-range instance_num is #N/A by default", async () => {
  const { getVT } = await setup(['set A1 formula TEXTAFTER("ABX-123-Red-XYZ","-",-4)']);
  expect(getVT("A1")).toBe("e#N/A");
});

test("TEXTAFTER: match_end=1 treats a not-found instance past the last delimiter as a virtual boundary", async () => {
  const { getDV } = await setup(['set A1 formula TEXTAFTER("ABX-123-Red-XYZ","-",-4,0,1)']);
  expect(getDV("A1")).toBe("ABX-123-Red-XYZ");
});

test("TEXTBEFORE: match_end=1 with instance one past the last delimiter returns whole string", async () => {
  // "A-B" has exactly 1 delimiter, so instance_num n+1=2 is the virtual
  // end-of-string boundary; match_end adds exactly one virtual boundary,
  // not an unbounded clamp for arbitrarily large instance numbers.
  const { getDV } = await setup(['set A1 formula TEXTBEFORE("A-B","-",2,0,1)']);
  expect(getDV("A1")).toBe("A-B");
});

test("TEXTAFTER: if_not_found overrides the default #N/A", async () => {
  const { getDV } = await setup([
    'set A1 formula TEXTAFTER("no delimiter here","-",1,0,0,"missing")',
  ]);
  expect(getDV("A1")).toBe("missing");
});

test("TEXTAFTER: match_mode=1 is case-insensitive", async () => {
  const { getDV } = await setup(['set A1 formula TEXTAFTER("12 FT x 20 ft"," x ",1,1)']);
  expect(getDV("A1")).toBe("20 ft");
});

test("TEXTBEFORE: match_mode=0 (default) is case-sensitive, so an uppercase delimiter misses", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("12 FT X 20 ft"," x ")']);
  expect(getVT("A1")).toBe("e#N/A");
});

test("TEXTBEFORE: empty text argument is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("",",")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("TEXTBEFORE: an empty delimiter is treated as not found (#N/A by default)", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("abc","")']);
  expect(getVT("A1")).toBe("e#N/A");
});

test("TEXTAFTER: match_end=1 with instance one past the last delimiter returns empty string", async () => {
  const { getDV } = await setup(['set A1 formula TEXTAFTER("A-B","-",2,0,1)']);
  expect(getDV("A1")).toBe("");
});

test("TEXTBEFORE: match_end=1 with negative instance one before the first delimiter returns empty string", async () => {
  const { getDV } = await setup(['set A1 formula TEXTBEFORE("A-B","-",-2,0,1)']);
  expect(getDV("A1")).toBe("");
});

test("TEXTBEFORE: instance_num of 0 is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("a,b",",",0)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("TEXTAFTER: multi-character delimiter", async () => {
  const { getDV } = await setup(['set A1 formula TEXTAFTER("12 ft x 20 ft"," x ")']);
  expect(getDV("A1")).toBe("20 ft");
});

test("TEXTBEFORE: nesting extracts a middle segment", async () => {
  const { getDV } = await setup([
    'set A1 formula TEXTAFTER(TEXTBEFORE("first middle last"," ",-1)," ",1,0,0,"")',
  ]);
  expect(getDV("A1")).toBe("middle");
});

test("TEXTBEFORE: propagates an upstream error in text", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE(1/0,",")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTBEFORE: propagates an upstream error in the delimiter", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("a,b",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTBEFORE: propagates an upstream error in instance_num", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("a,b",",",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTBEFORE: propagates an upstream error in match_mode", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("a,b",",",1,1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTBEFORE: propagates an upstream error in match_end", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("a,b",",",1,0,1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTBEFORE: too many arguments is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula TEXTBEFORE("a,b",",",1,0,0,"x",99)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// SPLIT (Sheets)
// ---------------------------------------------------------------------------

test("SPLIT: default split_by_each treats every character of delimiter separately", async () => {
  const { sheet } = await setup(['set A1 formula SPLIT("a,b;c",",;")']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("b");
  expect(sheet.GetAssuredCell("C1").datavalue).toBe("c");
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(3);
});

test("SPLIT: split_by_each=FALSE treats delimiter as one literal separator", async () => {
  const { sheet } = await setup(['set A1 formula SPLIT("a,;b,;c",",;",FALSE)']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("b");
  expect(sheet.GetAssuredCell("C1").datavalue).toBe("c");
});

test("SPLIT: remove_empty_text=FALSE keeps empty fragments from adjacent delimiters", async () => {
  const { sheet } = await setup(['set A1 formula SPLIT("a,,b",",",TRUE,FALSE)']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("");
  expect(sheet.GetAssuredCell("C1").datavalue).toBe("b");
});

test("SPLIT: an empty text with remove_empty collapses to a single empty cell", async () => {
  const { sheet } = await setup(['set A1 formula SPLIT("",",")']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("");
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(1);
});
test("SPLIT: an empty delimiter leaves the text whole in one cell", async () => {
  const { sheet } = await setup(['set A1 formula SPLIT("a,b","")']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a,b");
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(1);
});

test("SPLIT: a hyphen in a multi-character split_by_each delimiter is treated literally, not as a regex range", async () => {
  const { sheet } = await setup(['set A1 formula SPLIT("a-b,c",",-")']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("b");
  expect(sheet.GetAssuredCell("C1").datavalue).toBe("c");
});

test("SPLIT: propagates an error in text", async () => {
  const { getVT } = await setup(['set A1 formula SPLIT(1/0,",")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("SPLIT: propagates an upstream error in the delimiter", async () => {
  const { getVT } = await setup(['set A1 formula SPLIT("a,b",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("SPLIT: propagates an upstream error in split_by_each", async () => {
  const { getVT } = await setup(['set A1 formula SPLIT("a,b",",",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("SPLIT: propagates an upstream error in remove_empty_text", async () => {
  const { getVT } = await setup(['set A1 formula SPLIT("a,b",",",TRUE,1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("SPLIT: too many arguments is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula SPLIT("a,b",",",TRUE,FALSE,99)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// TEXTSPLIT (Excel)
// ---------------------------------------------------------------------------

test("TEXTSPLIT: column delimiter only spills across one row", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT("a,b,c",",")']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("b");
  expect(sheet.GetAssuredCell("C1").datavalue).toBe("c");
  expect(sheet.GetAssuredCell("A1").spillrows).toBe(1);
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(3);
});

test("TEXTSPLIT: row_delimiter splits into multiple rows", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT("a,b;c,d",",",";")']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("b");
  expect(sheet.GetAssuredCell("A2").datavalue).toBe("c");
  expect(sheet.GetAssuredCell("B2").datavalue).toBe("d");
  expect(sheet.GetAssuredCell("A1").spillrows).toBe(2);
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(2);
});

test("TEXTSPLIT: default pad_with is #N/A for ragged rows", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT("a,b;c",",",";")']);
  expect(sheet.GetAssuredCell("B2").valuetype).toBe("e#N/A");
});

test("TEXTSPLIT: explicit pad_with fills ragged rows", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT("a,b;c",",",";",0,0,"-")']);
  expect(sheet.GetAssuredCell("B2").datavalue).toBe("-");
  expect(sheet.GetAssuredCell("B2").valuetype).toBe("t");
});

test("TEXTSPLIT: an empty col_delimiter leaves each row whole in one cell", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT("a,b;c","",";")']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a,b");
  expect(sheet.GetAssuredCell("A2").datavalue).toBe("c");
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(1);
});

test("TEXTSPLIT: ignore_empty with empty col_delimiter and all-empty rows collapses to one empty cell", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT(",","",",",TRUE)']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("");
  expect(sheet.GetAssuredCell("A1").spillrows).toBe(1);
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(1);
});

test("TEXTSPLIT: ignore_empty drops empty fragments on both axes", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT("a,,b",",","",TRUE)']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("b");
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(2);
});

test("TEXTSPLIT: ignore_empty on an all-delimiter string collapses to a single empty cell", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT(",,",",","",TRUE)']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("");
  expect(sheet.GetAssuredCell("A1").spillrows).toBe(1);
  expect(sheet.GetAssuredCell("A1").spillcols).toBe(1);
});

test("TEXTSPLIT: match_mode=1 col_delimiter is case-insensitive", async () => {
  const { sheet } = await setup(['set A1 formula TEXTSPLIT("aXbxc","x","",0,1)']);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("a");
  expect(sheet.GetAssuredCell("B1").datavalue).toBe("b");
  expect(sheet.GetAssuredCell("C1").datavalue).toBe("c");
});

test("TEXTSPLIT: propagates an error in text", async () => {
  const { getVT } = await setup(['set A1 formula TEXTSPLIT(1/0,",")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTSPLIT: propagates an upstream error in col_delimiter", async () => {
  const { getVT } = await setup(['set A1 formula TEXTSPLIT("a,b",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTSPLIT: too many arguments is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula TEXTSPLIT("a,b",",","",0,0,"-",99)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("TEXTSPLIT: propagates an upstream error in match_mode", async () => {
  const { getVT } = await setup(['set A1 formula TEXTSPLIT("a,b",",","",0,1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTSPLIT: propagates an upstream error in pad_with", async () => {
  const { getVT } = await setup(['set A1 formula TEXTSPLIT("a,b;c",",",";",0,0,1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTSPLIT: propagates an upstream error in row_delimiter", async () => {
  const { getVT } = await setup(['set A1 formula TEXTSPLIT("a,b",",",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("TEXTSPLIT: propagates an upstream error in ignore_empty", async () => {
  const { getVT } = await setup(['set A1 formula TEXTSPLIT("a,b",",","",1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});
