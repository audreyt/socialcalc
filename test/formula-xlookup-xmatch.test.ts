// Direct-evaluator and command-level coverage for XMATCH/XLOOKUP: exact
// default, wildcard mode, exact-or-next-smaller/larger, forward/reverse
// linear, ascending/descending binary modes, numeric/text/error typing,
// blank handling, row/column 1-D arrays, cross-sheet/named ranges, XLOOKUP
// scalar and same-shaped 1-D/2-D spill, invalid mode/shape rejection, and
// if_not_found (value + error) fallback.
import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

async function setup(commands: string[]) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands, true, 4000);
  await recalcSheet(SC, sheet, 4000);
  return { SC, sheet };
}

function evaluate(SC: any, sheet: any, formula: string) {
  return SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens(formula),
    sheet,
    true,
  );
}

// ---------------------------------------------------------------------
// Registration / help metadata
// ---------------------------------------------------------------------

test("XMATCH and XLOOKUP are registered with lookup class and help strings", async () => {
  const SC = await loadSocialCalc();
  expect(SC.Formula.FunctionList.XMATCH[0]).toBe(SC.Formula.XMatchFunction);
  expect(SC.Formula.FunctionList.XMATCH[4]).toBe("lookup");
  expect(SC.Formula.FunctionList.XLOOKUP[0]).toBe(SC.Formula.XLookupFunction);
  expect(SC.Formula.FunctionList.XLOOKUP[4]).toBe("lookup");
  SC.Formula.FillFunctionInfo();
  expect(SC.Formula.FunctionArgString("XMATCH")).toBe(
    "lookup_value, lookup_array, [match_mode], [search_mode]",
  );
  expect(SC.Formula.FunctionArgString("XLOOKUP")).toBe(
    "lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode]",
  );
});

// ---------------------------------------------------------------------
// XMATCH: exact default
// ---------------------------------------------------------------------

test("XMATCH exact default finds numeric and text positions (1-based)", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 5",
    "set A2 value n 4",
    "set A3 value n 3",
    "set A4 value n 2",
    "set A5 value n 1",
    "set B1 text t red",
    "set B2 text t green",
    "set B3 text t blue",
  ]);
  expect(evaluate(SC, sheet, "XMATCH(4,A1:A5)").value).toBe(2);
  expect(evaluate(SC, sheet, "XMATCH(1,A1:A5)").value).toBe(5);
  expect(evaluate(SC, sheet, 'XMATCH("Green",B1:B3)').value).toBe(2);
  expect(evaluate(SC, sheet, "XMATCH(9,A1:A5)").type).toBe("e#N/A");
});

test("XMATCH exact default via a named single-column range", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 5",
    "set A2 value n 4",
    "set A3 value n 3",
    "set A4 value n 2",
    "set A5 value n 1",
    "name define SERIES A1:A5",
  ]);
  expect(evaluate(SC, sheet, "XMATCH(4,SERIES)").value).toBe(2);
});

// ---------------------------------------------------------------------
// XMATCH: wildcard mode + escaping
// ---------------------------------------------------------------------

test("XMATCH wildcard mode matches * and ? patterns", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t apple",
    "set A2 text t banana",
    "set A3 text t apricot",
    "set A4 text t cherry",
  ]);
  expect(evaluate(SC, sheet, 'XMATCH("ap*",A1:A4,2)').value).toBe(1); // first-to-last: apple wins
  expect(evaluate(SC, sheet, 'XMATCH("ap*",A1:A4,2,-1)').value).toBe(3); // reverse: apricot wins
  expect(evaluate(SC, sheet, 'XMATCH("?anana",A1:A4,2)').value).toBe(2);
  expect(evaluate(SC, sheet, 'XMATCH("zz*",A1:A4,2)').type).toBe("e#N/A");
});

test("XMATCH wildcard mode honors ~ escaping for literal * and ?", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t a*b",
    "set A2 text t axxxb",
    "set A3 text t a?b",
  ]);
  // "a~*b" is the literal pattern "a*b" (escaped *), so only A1 matches,
  // never A2's wildcard-expanded "axxxb".
  expect(evaluate(SC, sheet, 'XMATCH("a~*b",A1:A3,2)').value).toBe(1);
  expect(evaluate(SC, sheet, 'XMATCH("a~?b",A1:A3,2)').value).toBe(3);
});

// ---------------------------------------------------------------------
// XMATCH: exact-or-next-smaller/larger, linear (unsorted, whole-array scan)
// ---------------------------------------------------------------------

test("XMATCH match_mode -1/1 finds true closest smaller/larger over unsorted linear data", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 10",
    "set A2 value n 30",
    "set A3 value n 20",
    "set A4 value n 40",
  ]);
  // No exact 25: next-smaller among {10,30,20,40} is 20 (index 3); next-larger is 30 (index 2).
  expect(evaluate(SC, sheet, "XMATCH(25,A1:A4,-1)").value).toBe(3);
  expect(evaluate(SC, sheet, "XMATCH(25,A1:A4,1)").value).toBe(2);
  // Exact match always wins over an approximate candidate.
  expect(evaluate(SC, sheet, "XMATCH(20,A1:A4,-1)").value).toBe(3);
  // No qualifying next-smaller/larger anywhere -> #N/A.
  expect(evaluate(SC, sheet, "XMATCH(5,A1:A4,-1)").type).toBe("e#N/A");
  expect(evaluate(SC, sheet, "XMATCH(50,A1:A4,1)").type).toBe("e#N/A");
});

// ---------------------------------------------------------------------
// XMATCH: binary ascending/descending
// ---------------------------------------------------------------------

test("XMATCH binary ascending search_mode=2 finds exact and approximate matches on sorted data", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 3",
    "set A3 value n 5",
    "set A4 value n 7",
    "set A5 value n 9",
  ]);
  expect(evaluate(SC, sheet, "XMATCH(5,A1:A5,0,2)").value).toBe(3);
  expect(evaluate(SC, sheet, "XMATCH(6,A1:A5,-1,2)").value).toBe(3); // next smaller: 5
  expect(evaluate(SC, sheet, "XMATCH(6,A1:A5,1,2)").value).toBe(4); // next larger: 7
  expect(evaluate(SC, sheet, "XMATCH(0,A1:A5,-1,2)").type).toBe("e#N/A");
  expect(evaluate(SC, sheet, "XMATCH(100,A1:A5,1,2)").type).toBe("e#N/A");
});

test("XMATCH binary descending search_mode=-2 finds exact and approximate matches on sorted data", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 9",
    "set A2 value n 7",
    "set A3 value n 5",
    "set A4 value n 3",
    "set A5 value n 1",
  ]);
  expect(evaluate(SC, sheet, "XMATCH(5,A1:A5,0,-2)").value).toBe(3);
  expect(evaluate(SC, sheet, "XMATCH(6,A1:A5,-1,-2)").value).toBe(2); // next smaller: 7 at index2 (descending array)
  expect(evaluate(SC, sheet, "XMATCH(6,A1:A5,1,-2)").value).toBe(3); // next larger: 5
});

// ---------------------------------------------------------------------
// XMATCH: duplicates / first-to-last vs last-to-first
// ---------------------------------------------------------------------

test("XMATCH duplicates: search_mode 1 (default) wins first, -1 wins last", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 7",
    "set A2 value n 3",
    "set A3 value n 7",
    "set A4 value n 3",
  ]);
  expect(evaluate(SC, sheet, "XMATCH(7,A1:A4)").value).toBe(1);
  expect(evaluate(SC, sheet, "XMATCH(7,A1:A4,0,-1)").value).toBe(3);
  expect(evaluate(SC, sheet, "XMATCH(3,A1:A4)").value).toBe(2);
  expect(evaluate(SC, sheet, "XMATCH(3,A1:A4,0,-1)").value).toBe(4);
});

// ---------------------------------------------------------------------
// XMATCH: numeric/text/error typing, blanks, invalid modes/shapes
// ---------------------------------------------------------------------

test("XMATCH: error lookup_value propagates, blank cells never approximate-match, invalid modes reject", async () => {
  const { SC, sheet } = await setup([
    "set A1 formula 1/0",
    "set A2 value n 5",
    "set A3 value n 10",
  ]);
  expect(evaluate(SC, sheet, "XMATCH(A1,A2:A3)").type).toBe("e#DIV/0!");
  expect(evaluate(SC, sheet, "XMATCH(7,A2:A3,3)").type).toBe("e#VALUE!"); // match_mode out of range
  expect(evaluate(SC, sheet, "XMATCH(7,A2:A3,0,0)").type).toBe("e#VALUE!"); // search_mode invalid
  expect(evaluate(SC, sheet, "XMATCH(7,A2:A3,2,2)").type).toBe("e#VALUE!"); // wildcard + binary incompatible
});

test("XMATCH: a genuine 2-D lookup_array is rejected", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
  ]);
  expect(evaluate(SC, sheet, "XMATCH(1,A1:B2)").type).toBe("e#VALUE!");
});

test("XMATCH: a blank cell among numeric data never matches an approximate scan", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5", "set A3 value n 10"]);
  // A2 is blank; approximate mode must skip it, not treat it as 0.
  expect(evaluate(SC, sheet, "XMATCH(1,A1:A3,-1)").type).toBe("e#N/A");
  expect(evaluate(SC, sheet, "XMATCH(20,A1:A3,1)").type).toBe("e#N/A");
});

// ---------------------------------------------------------------------
// XMATCH: row array (horizontal)
// ---------------------------------------------------------------------

test("XMATCH scans a horizontal (row) 1-D array", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set B1 value n 2", "set C1 value n 3"]);
  expect(evaluate(SC, sheet, "XMATCH(3,A1:C1)").value).toBe(3);
});

// ---------------------------------------------------------------------
// XMATCH: cross-sheet / named ranges
// ---------------------------------------------------------------------

test("XMATCH resolves a named range and a cross-sheet range", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.AddSheetToCache(
    "OTHERXM",
    "version:1.5\ncell:A1:v:10\ncell:A2:v:20\ncell:A3:v:30\nsheet:c:1:r:3\n",
    false,
  );
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "name define MYRANGE A1:A3",
  ]);
  await recalcSheet(SC, sheet);
  expect(evaluate(SC, sheet, "XMATCH(2,MYRANGE)").value).toBe(2);
  expect(evaluate(SC, sheet, "XMATCH(30,OTHERXM!A1:A3)").value).toBe(3);
});

// ---------------------------------------------------------------------
// XLOOKUP: scalar exact, if_not_found (value/error), duplicates
// ---------------------------------------------------------------------

test("XLOOKUP scalar exact lookup returns the matched return_array entry", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t apple",
    "set A2 text t banana",
    "set A3 text t cherry",
    "set B1 value n 1",
    "set B2 value n 2",
    "set B3 value n 3",
  ]);
  expect(evaluate(SC, sheet, 'XLOOKUP("banana",A1:A3,B1:B3)').value).toBe(2);
  expect(evaluate(SC, sheet, 'XLOOKUP("kiwi",A1:A3,B1:B3)').type).toBe("e#N/A");
});

test("XLOOKUP if_not_found returns a literal fallback value on no match", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 text t x",
    "set B2 text t y",
  ]);
  const r = evaluate(SC, sheet, 'XLOOKUP(9,A1:A2,B1:B2,"missing")');
  expect(r.type.charAt(0)).toBe("t");
  expect(r.value).toBe("missing");
});

test("XLOOKUP if_not_found can itself be an error value, returned verbatim", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set B1 text t x"]);
  const r = evaluate(SC, sheet, "XLOOKUP(9,A1:A1,B1:B1,NA())");
  expect(r.type).toBe("e#N/A");
});

test("XLOOKUP duplicates: default search_mode wins first, -1 wins last", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 5",
    "set A2 value n 5",
    "set B1 text t first",
    "set B2 text t second",
  ]);
  expect(evaluate(SC, sheet, "XLOOKUP(5,A1:A2,B1:B2)").value).toBe("first");
  expect(evaluate(SC, sheet, 'XLOOKUP(5,A1:A2,B1:B2,"",0,-1)').value).toBe("second");
});

// ---------------------------------------------------------------------
// XLOOKUP: approximate + binary modes
// ---------------------------------------------------------------------

test("XLOOKUP approximate match_mode -1/1 on unsorted linear data", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 10",
    "set A2 value n 30",
    "set A3 value n 20",
    "set B1 text t low",
    "set B2 text t high",
    "set B3 text t mid",
  ]);
  expect(evaluate(SC, sheet, 'XLOOKUP(25,A1:A3,B1:B3,"",-1)').value).toBe("mid"); // next smaller: 20
  expect(evaluate(SC, sheet, 'XLOOKUP(25,A1:A3,B1:B3,"",1)').value).toBe("high"); // next larger: 30
});

test("XLOOKUP binary search_mode=2 on sorted ascending data", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 3",
    "set A3 value n 5",
    "set B1 text t a",
    "set B2 text t b",
    "set B3 text t c",
  ]);
  expect(evaluate(SC, sheet, 'XLOOKUP(3,A1:A3,B1:B3,"",0,2)').value).toBe("b");
  expect(evaluate(SC, sheet, 'XLOOKUP(4,A1:A3,B1:B3,"",-1,2)').value).toBe("b");
});

// ---------------------------------------------------------------------
// XLOOKUP: vertical/horizontal/2-D returns and shape mismatches
// ---------------------------------------------------------------------

test("XLOOKUP spills a full row when return_array is 2-D and lookup_array is a column", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t x",
    "set A2 text t y",
    "set B1 value n 1",
    "set C1 value n 2",
    "set B2 value n 3",
    "set C2 value n 4",
  ]);
  const r = evaluate(SC, sheet, 'XLOOKUP("y",A1:A2,B1:C2)');
  expect(r.type).toBe("array");
  expect(r.value.rows).toBe(1);
  expect(r.value.cols).toBe(2);
  expect(r.value.cells[0].map((c: any) => c.value)).toEqual([3, 4]);
});

test("XLOOKUP spills a full column when return_array is 2-D and lookup_array is a row", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t x",
    "set B1 text t y",
    "set A2 value n 1",
    "set A3 value n 2",
    "set B2 value n 3",
    "set B3 value n 4",
  ]);
  const r = evaluate(SC, sheet, 'XLOOKUP("y",A1:B1,A2:B3)');
  expect(r.type).toBe("array");
  expect(r.value.rows).toBe(2);
  expect(r.value.cols).toBe(1);
  expect(r.value.cells.map((row: any[]) => row[0].value)).toEqual([3, 4]);
});

test("XLOOKUP rejects mismatched lookup/return axis lengths", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set B1 text t a",
    "set B2 text t b",
  ]);
  expect(evaluate(SC, sheet, "XLOOKUP(2,A1:A3,B1:B2)").type).toBe("e#VALUE!");
});

test("XLOOKUP rejects a genuine 2-D lookup_array", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
    "set C1 text t a",
    "set C2 text t b",
  ]);
  expect(evaluate(SC, sheet, "XLOOKUP(1,A1:B2,C1:C2)").type).toBe("e#VALUE!");
});

test("XLOOKUP wildcard mode with escaping", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t report_2024",
    "set A2 text t report_2025",
    "set B1 value n 24",
    "set B2 value n 25",
  ]);
  expect(evaluate(SC, sheet, 'XLOOKUP("report_2025",A1:A2,B1:B2,"",2)').value).toBe(25);
});

// ---------------------------------------------------------------------
// XLOOKUP: cross-sheet / named ranges
// ---------------------------------------------------------------------

test("XLOOKUP resolves named ranges and cross-sheet ranges", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.AddSheetToCache(
    "OTHERXL",
    "version:1.5\ncell:A1:v:10\ncell:A2:v:20\ncell:B1:v:100\ncell:B2:v:200\nsheet:c:2:r:2\n",
    false,
  );
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 text t one",
    "set B2 text t two",
    "name define KEYS A1:A2",
    "name define VALS B1:B2",
  ]);
  await recalcSheet(SC, sheet);
  expect(evaluate(SC, sheet, "XLOOKUP(2,KEYS,VALS)").value).toBe("two");
  expect(evaluate(SC, sheet, "XLOOKUP(20,OTHERXL!A1:A2,OTHERXL!B1:B2)").value).toBe(200);
});

// ---------------------------------------------------------------------
// XLOOKUP: nesting
// ---------------------------------------------------------------------

test("XLOOKUP nests inside XMATCH and vice versa", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t apple",
    "set A2 text t banana",
    "set B1 value n 1",
    "set B2 value n 2",
    "set C1 value n 10",
    "set C2 value n 20",
  ]);
  // XLOOKUP finds "banana" -> 2, feeds XMATCH(2, B1:B2) -> position 2.
  const r = evaluate(SC, sheet, 'XMATCH(XLOOKUP("banana",A1:A2,B1:B2),B1:B2)');
  expect(r.value).toBe(2);
  // XMATCH position feeds INDEX to fetch the corresponding C-column value.
  const r2 = evaluate(SC, sheet, 'INDEX(C1:C2,XMATCH("banana",A1:A2))');
  expect(r2.value).toBe(20);
});

// ---------------------------------------------------------------------
// XLOOKUP: ScheduleSheetCommands spill through the dynamic-array pipeline
// ---------------------------------------------------------------------

test("XLOOKUP 2-D spill through ScheduleSheetCommands lands in real sheet cells", async () => {
  const { sheet } = await setup([
    "set A1 text t x",
    "set A2 text t y",
    "set B1 value n 1",
    "set C1 value n 2",
    "set B2 value n 3",
    "set C2 value n 4",
    'set E1 formula XLOOKUP("y",A1:A2,B1:C2)',
  ]);
  expect(sheet.cells.E1.datavalue).toBe(3);
  expect(sheet.cells.E1.spillrows).toBe(1);
  expect(sheet.cells.E1.spillcols).toBe(2);
  expect(sheet.cells.F1?.datavalue).toBe(4);
  expect(sheet.cells.F1?.spillowner).toBe("E1");
});

test("XLOOKUP scalar result does not spill (ordinary single-cell formula)", async () => {
  const { sheet } = await setup([
    "set A1 text t x",
    "set A2 text t y",
    "set B1 value n 1",
    "set B2 value n 2",
    'set E1 formula XLOOKUP("y",A1:A2,B1:B2)',
  ]);
  expect(sheet.cells.E1.datavalue).toBe(2);
  expect(sheet.cells.E1.spillrows).toBeUndefined();
});

test("a blocked XLOOKUP spill target preserves #SPILL! like SORT/UNIQUE", async () => {
  const { sheet } = await setup([
    "set A1 text t x",
    "set A2 text t y",
    "set B1 value n 1",
    "set C1 value n 2",
    "set B2 value n 3",
    "set C2 value n 4",
    "set F1 value n 99",
    'set E1 formula XLOOKUP("y",A1:A2,B1:C2)',
  ]);
  expect(sheet.cells.E1.valuetype).toBe("e");
  expect(sheet.cells.E1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.F1.datavalue).toBe(99);
});

// ---------------------------------------------------------------------
// Branch coverage: non-numeric mode args, incomparable binary-search
// cells, wildcard-no-match, too-many-args, and unmaterializable return
// arrays.
// ---------------------------------------------------------------------

test("XMATCH/XLOOKUP reject a non-numeric match_mode or search_mode", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set A2 value n 2"]);
  expect(evaluate(SC, sheet, 'XMATCH(1,A1:A2,"x")').type).toBe("e#VALUE!");
  expect(evaluate(SC, sheet, 'XMATCH(1,A1:A2,0,"x")').type).toBe("e#VALUE!");
});

test("XMATCH rejects too many arguments", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set A2 value n 2"]);
  expect(evaluate(SC, sheet, "XMATCH(1,A1:A2,0,1,99)").type).toBe("e#VALUE!");
});

test("XLOOKUP rejects too many arguments", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 text t x",
    "set B2 text t y",
  ]);
  expect(evaluate(SC, sheet, 'XLOOKUP(1,A1:A2,B1:B2,"",0,1,99)').type).toBe("e#VALUE!");
});

test("XLOOKUP propagates an error lookup_value", async () => {
  const { SC, sheet } = await setup(["set A1 formula 1/0", "set B1 value n 5", "set C1 text t x"]);
  expect(evaluate(SC, sheet, "XLOOKUP(A1,B1:B1,C1:C1)").type).toBe("e#DIV/0!");
});

test("XLOOKUP rejects a return_array that cannot be materialized (not a range/coord/array)", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set A2 value n 2"]);
  expect(evaluate(SC, sheet, "XLOOKUP(1,A1:A2,5)").type).toBe("e#VALUE!");
});

test("XMATCH wildcard mode with a non-text lookup_value scans literal equality and can miss", async () => {
  const { SC, sheet } = await setup(["set A1 text t apple", "set A2 text t banana"]);
  // lookup_value is numeric under wildcard match_mode: no text cell equals
  // the number 7 literally, so the full scan completes with no match (-1).
  expect(evaluate(SC, sheet, "XMATCH(7,A1:A2,2)").type).toBe("e#N/A");
});
test("XMATCH binary search skips an incomparable (blank) cell while narrowing (ascending)", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A4 value n 4",
    "set A5 value n 5",
  ]);
  // A3 is blank; the mid probe (index 2) lands on it during a binary
  // search for 1, exercising the ascending incomparable-narrow branch
  // (search_mode=2 -> hi=mid-1) before resolving to the real exact match.
  expect(evaluate(SC, sheet, "XMATCH(1,A1:A5,0,2)").value).toBe(1);
});

test("XMATCH binary search skips an incomparable (blank) cell while narrowing (descending)", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 5",
    "set A2 value n 4",
    "set A4 value n 2",
    "set A5 value n 1",
  ]);
  // A3 is blank; the mid probe lands on it during a descending binary
  // search for 1, exercising the non-ascending incomparable-narrow branch
  // (search_mode=-2 -> lo=mid+1) before resolving to the real exact match.
  expect(evaluate(SC, sheet, "XMATCH(1,A1:A5,0,-2)").value).toBe(5);
});

test("XMATCH binary search exact match_mode with no hit anywhere is #N/A", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set A2 value n 3", "set A3 value n 5"]);
  expect(evaluate(SC, sheet, "XMATCH(4,A1:A3,0,2)").type).toBe("e#N/A");
});

test("XMATCH linear approximate scan with a blank lookup_value against a blank cell (CompareLookupCell's non-n/t fallthrough)", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10", "set A3 value n 20"]);
  // A2 (blank) shares the same general type ("b") as the blank lookup_value
  // Z1, so CompareLookupCell's type-match guard passes for that pairing but
  // neither the "n" nor "t" branch applies -- it must return null (blanks
  // never approximate-compare) instead of misreporting an order. With no
  // qualifying next-smaller value anywhere (blank vs blank is never a
  // comparable pair, and A1/A3 are numeric, not blank), the result is #N/A.
  expect(evaluate(SC, sheet, "XMATCH(Z1,A1:A3,-1)").type).toBe("e#N/A");
});

test("XLOOKUP scalar lookup with a horizontal (row) lookup_array/return_array pair", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t apple",
    "set B1 text t banana",
    "set C1 text t cherry",
    "set A2 value n 1",
    "set B2 value n 2",
    "set C2 value n 3",
  ]);
  // Row-oriented lookup_array/return_array: exercises ScanLookupVector's and
  // XLookupFunction's byColumn=false ternary branches (never hit by the
  // vertical/column fixtures above).
  expect(evaluate(SC, sheet, 'XLOOKUP("banana",A1:C1,A2:C2)').value).toBe(2);
});

test("XLOOKUP: a text lookup_value is lowercased before scanning (case-insensitive exact match)", async () => {
  const { SC, sheet } = await setup(["set A1 text t Banana", "set B1 value n 7"]);
  expect(evaluate(SC, sheet, 'XLOOKUP("BANANA",A1:A1,B1:B1)').value).toBe(7);
});

test("XLOOKUP rejects an out-of-range match_mode", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 text t x",
    "set B2 text t y",
  ]);
  expect(evaluate(SC, sheet, 'XLOOKUP(1,A1:A2,B1:B2,"",5)').type).toBe("e#VALUE!");
});

test("XMATCH next-smaller keeps the current best when a later candidate is not closer", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10", "set A2 value n 5", "set A3 value n 20"]);
  // Looking for next-smaller of 25: A1=10 becomes the first candidate; A2=5
  // is also < 25 but farther away, so the "keep current best" (do-not-
  // replace) arm must fire; A3=20 is the true closest and wins last.
  expect(evaluate(SC, sheet, "XMATCH(25,A1:A3,-1)").value).toBe(3);
});

test("XMATCH next-larger keeps the current best when a later candidate is not closer", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 40",
    "set A2 value n 50",
    "set A3 value n 30",
  ]);
  // Looking for next-larger of 25: A1=40 becomes the first candidate; A2=50
  // is also > 25 but farther away, so the "keep current best" (do-not-
  // replace) arm must fire; A3=30 is the true closest and wins last.
  expect(evaluate(SC, sheet, "XMATCH(25,A1:A3,1)").value).toBe(3);
});

test("XMATCH wildcard mode skips non-text cells while scanning", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5", "set A2 text t banana"]);
  // A1 is numeric: wildcard mode's cell.type.charAt(0) != "t" continue must
  // fire for it before reaching the real text match at A2.
  expect(evaluate(SC, sheet, 'XMATCH("ba*",A1:A2,2)').value).toBe(2);
});

test("XLOOKUP with a blank lookup_value (neither numeric nor text normalization applies)", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5", "set B1 text t x"]);
  // Z1 is a genuinely blank cell reference: lookupvalue.type is "b", so
  // XLOOKUP's normalize block's else-if("t") branch's false arm fires.
  expect(evaluate(SC, sheet, "XLOOKUP(Z1,A1:A1,B1:B1)").type).toBe("e#N/A");
});

test("XMATCH text approximate mode reaches CompareLookupCell's text comparison arm", async () => {
  const { SC, sheet } = await setup(["set A1 text t apple", "set A2 text t cherry"]);
  // No exact "banana": next-smaller among text values is "apple" (index 1).
  expect(evaluate(SC, sheet, 'XMATCH("banana",A1:A2,-1)').value).toBe(1);
  // next-larger is "cherry" (index 2).
  expect(evaluate(SC, sheet, 'XMATCH("banana",A1:A2,1)').value).toBe(2);
});

test("XMATCH rejects a lookup_array that cannot be materialized (not a range/coord/array)", async () => {
  const { SC, sheet } = await setup([]);
  expect(evaluate(SC, sheet, "XMATCH(1,5)").type).toBe("e#VALUE!");
});
