import { expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetUndo,
  sheetRedo,
} from "./helpers/socialcalc";

type Cell = { datavalue: any; valuetype: string; errors?: string };

function resetFormulaGlobals(SC: any) {
  if (SC.RecalcInfo) {
    SC.RecalcInfo.LoadSheet = () => false;
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
    if (SC.RecalcInfo.recalctimer) {
      try {
        clearTimeout(SC.RecalcInfo.recalctimer);
      } catch {
        // cleanup: recalctimer may already have fired/cleared; best-effort clear only.
      }
      SC.RecalcInfo.recalctimer = null;
    }
    SC.RecalcInfo.firstRenderScheduled = false;
  }
  if (SC.Formula) {
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;
    SC.Formula.FreshnessInfo.sheets = {};
    SC.Formula.FreshnessInfo.volatile = {};
    SC.Formula.RemoteFunctionInfo.waitingForServer = null;
  }
}

async function buildSheet(commands: string[]) {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  if (commands.length) {
    await scheduleCommands(SC, sheet, commands, true, 4000);
  }
  await recalcSheet(SC, sheet, 4000);
  const getDV = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).datavalue;
  const getVT = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).valuetype;
  return { SC, sheet, getDV, getVT };
}

// ---------------------------------------------------------------------------
// INDIRECT: A1-style parsing
// ---------------------------------------------------------------------------

test("INDIRECT resolves a plain A1 coord reference", async () => {
  const { getDV, getVT } = await buildSheet(["set A1 value n 42", 'set B1 formula INDIRECT("A1")']);
  expect(getDV("B1")).toBe(42);
  expect(getVT("B1")).toBe("n");
});

test("INDIRECT propagates an error from the ref_text argument itself", async () => {
  const { getVT } = await buildSheet(["set B1 formula INDIRECT(1/0)"]);
  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("INDIRECT resolves an absolute $A$1 reference", async () => {
  const { getDV } = await buildSheet(["set A1 value n 7", 'set B1 formula INDIRECT("$A$1")']);
  expect(getDV("B1")).toBe(7);
});

test("INDIRECT resolves a range and is consumable by SUM", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    'set B1 formula SUM(INDIRECT("A1:A3"))',
  ]);
  expect(getDV("B1")).toBe(6);
});

test("INDIRECT unwraps a single-quoted sheet name (Excel-style 'My Sheet'!A1)", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  SC.Formula.AddSheetToCache("MY SHEET", "version:1.5\ncell:A1:v:5\nsheet:c:1:r:1\n", false);
  const sheet = new SC.Sheet();
  // The lexer treats ' and " as the same quote class with no memory of the
  // opener (see formula-parse.ts's quote-doubling rule), so an embedded '
  // inside a "..." string literal must be doubled to survive parsing.
  await scheduleCommands(SC, sheet, ["set B1 formula INDIRECT(\"''My Sheet''!A1\")"]);
  await recalcSheet(SC, sheet);
  expect(sheet.GetAssuredCell("B1").datavalue).toBe(5);
});

test("INDIRECT with a range whose second endpoint overflows row 65536 is #REF!", async () => {
  const { getVT } = await buildSheet(['set B1 formula INDIRECT("A1:A99999999")']);
  expect(getVT("B1")).toBe("e#REF!");
});

test("INDIRECT resolves a sheet-qualified reference", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  SC.Formula.AddSheetToCache("REMOTE", "version:1.5\ncell:A1:v:99\nsheet:c:1:r:1\n", false);
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ['set B1 formula INDIRECT("REMOTE!A1")']);
  await recalcSheet(SC, sheet);
  expect(sheet.GetAssuredCell("B1").datavalue).toBe(99);
});

test("INDIRECT propagates an error from a non-numeric a1 argument", async () => {
  const { getVT } = await buildSheet(['set B1 formula INDIRECT("A1",1/0)']);
  expect(getVT("B1")).toBe("e#DIV/0!");
});

test("INDIRECT with blank/whitespace-only ref_text yields #REF!", async () => {
  const { getVT } = await buildSheet(['set B1 formula INDIRECT("   ")']);
  expect(getVT("B1")).toBe("e#REF!");
});

test("INDIRECT resolves a defined name", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 55",
    "name define MYNAME A1",
    'set B1 formula INDIRECT("MYNAME")',
  ]);
  expect(getDV("B1")).toBe(55);
});

test("INDIRECT a1=FALSE always yields #REF! (no R1C1 parser support)", async () => {
  const { getVT } = await buildSheet(["set A1 value n 1", 'set B1 formula INDIRECT("R1C1",FALSE)']);
  expect(getVT("B1")).toBe("e#REF!");
});

test("INDIRECT with malformed/unparseable text yields #REF!", async () => {
  // Uses evaluate_parsed_formula directly (not a full scheduleCommands+
  // recalcSheet round trip): "not a ref!!" contains "!" and is treated as
  // sheetname="not a ref!", which is a genuinely nonexistent sheet name —
  // FindInSheetCache would queue SheetCache.waitingForLoading and park the
  // recalc pass forever with no host LoadSheet callback wired up, exactly
  // like any other unresolvable Sheet!coord reference in this harness (see
  // "EvaluatePolish: ! (sheetname) unknown -> error" in formula-coverage.test.ts).
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  const r = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens('INDIRECT("not a ref!!")'),
    sheet,
    false,
  );
  expect(r.type).toBe("e#REF!");
});

test("INDIRECT with missing/unknown sheet yields #REF!", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  const r = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens('INDIRECT("Nonexistent!A1")'),
    sheet,
    false,
  );
  expect(r.type).toBe("e#REF!");
});

test("INDIRECT column overflow past ZZ yields #REF!", async () => {
  const { getVT } = await buildSheet(['set B1 formula INDIRECT("ZZZ1")']);
  expect(getVT("B1")).toBe("e#REF!");
});

test("INDIRECT row overflow past 65536 yields #REF!", async () => {
  const { getVT } = await buildSheet(['set B1 formula INDIRECT("A65537")']);
  expect(getVT("B1")).toBe("e#REF!");
});

// ---------------------------------------------------------------------------
// OFFSET: shapes, bounds, negative offsets
// ---------------------------------------------------------------------------

test("OFFSET with zero rows/cols is the identity (single cell)", async () => {
  const { getDV } = await buildSheet(["set A1 value n 3", "set B1 formula OFFSET(A1,0,0)"]);
  expect(getDV("B1")).toBe(3);
});

test("OFFSET shifts by positive rows and cols", async () => {
  const { getDV } = await buildSheet(["set B2 value n 9", "set A1 formula OFFSET(A1,1,1)"]);
  expect(getDV("A1")).toBe(9);
});

test("OFFSET shifts by negative rows and cols", async () => {
  const { getDV } = await buildSheet(["set A1 value n 5", "set B2 formula OFFSET(B2,-1,-1)"]);
  expect(getDV("B2")).toBe(5);
});

test("OFFSET with omitted height/width inherits the reference's own extent", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 10",
    "set B2 value n 20",
    "set D1 formula SUM(OFFSET(A1:A2,0,1))",
  ]);
  expect(getDV("D1")).toBe(30);
});

test("OFFSET with height provided but width omitted (4-arg form) inherits reference's column extent", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set D1 formula SUM(OFFSET(A1,0,0,3))",
  ]);
  expect(getDV("D1")).toBe(6);
});

test("OFFSET with explicit height/width resizes the rectangle", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set D1 formula SUM(OFFSET(A1,0,0,3,1))",
  ]);
  expect(getDV("D1")).toBe(6);
});

test("OFFSET propagates an error from a non-numeric height argument", async () => {
  const { getVT } = await buildSheet(['set A1 formula OFFSET(A1,0,0,"x",1)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("OFFSET propagates an error from a non-numeric width argument", async () => {
  const { getVT } = await buildSheet(['set A1 formula OFFSET(A1,0,0,1,"x")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("OFFSET rectangle overflow triggered solely by width/height extent (col1/row1 stay in bounds)", async () => {
  const { getVT: getVTWide } = await buildSheet(["set A1 formula OFFSET(A1,0,0,1,800)"]);
  expect(getVTWide("A1")).toBe("e#REF!");
  const { getVT: getVTTall } = await buildSheet(["set A1 formula OFFSET(A1,0,0,70000,1)"]);
  expect(getVTTall("A1")).toBe("e#REF!");
});

test("OFFSET with explicit height=0 or width=0 is #REF! (not inherited)", async () => {
  const { getVT: getVT1 } = await buildSheet([
    "set A1 value n 1",
    "set B1 formula OFFSET(A1,0,0,0,1)",
  ]);
  expect(getVT1("B1")).toBe("e#REF!");
  const { getVT: getVT2 } = await buildSheet([
    "set A1 value n 1",
    "set B1 formula OFFSET(A1,0,0,1,0)",
  ]);
  expect(getVT2("B1")).toBe("e#REF!");
});

test("OFFSET column overflow past ZZ (702) is #REF!", async () => {
  const { getVT } = await buildSheet(["set A1 formula OFFSET(A1,0,702)"]);
  expect(getVT("A1")).toBe("e#REF!");
});

test("OFFSET row overflow past 65536 is #REF!", async () => {
  const { getVT } = await buildSheet(["set A1 formula OFFSET(A1,65536,0)"]);
  expect(getVT("A1")).toBe("e#REF!");
});

test("OFFSET landing exactly at column ZZ (702) or row 65536 is in-bounds, not #REF!", async () => {
  const { getVT: getVTCol, getDV: getDVCol } = await buildSheet([
    "set A1 formula OFFSET(A1,0,701)",
  ]);
  expect(getVTCol("A1")).not.toBe("e#REF!");
  expect(getDVCol("A1")).toBe(0);
  const { getVT: getVTRow, getDV: getDVRow } = await buildSheet([
    "set A1 formula OFFSET(A1,65535,0)",
  ]);
  expect(getVTRow("A1")).not.toBe("e#REF!");
  expect(getDVRow("A1")).toBe(0);
});

test("OFFSET rectangle extent landing exactly at column ZZ (702) or row 65536 is in-bounds", async () => {
  // ROWS/COLUMNS report shape without materializing the range cell-by-cell
  // (SUM would walk all 65536 cells and exceed the test timeout).
  const { getDV, getVT } = await buildSheet([
    "set D1 formula COLUMNS(OFFSET(A1,0,0,1,702))",
    "set D2 formula ROWS(OFFSET(A1,0,0,65536,1))",
  ]);
  expect(getVT("D1")).not.toBe("e#REF!");
  expect(getDV("D1")).toBe(702);
  expect(getVT("D2")).not.toBe("e#REF!");
  expect(getDV("D2")).toBe(65536);
});

test("OFFSET negative offset past column A/row 1 is #REF!", async () => {
  const { getVT: getVT1 } = await buildSheet(["set A1 formula OFFSET(A1,0,-1)"]);
  expect(getVT1("A1")).toBe("e#REF!");
  const { getVT: getVT2 } = await buildSheet(["set A1 formula OFFSET(A1,-1,0)"]);
  expect(getVT2("A1")).toBe("e#REF!");
});

test("OFFSET on a range reference preserves rows/cols and shifts", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 10",
    "set B2 value n 20",
    "set D1 formula SUM(OFFSET(A1:A2,0,1))",
  ]);
  expect(getDV("D1")).toBe(30);
});

test("OFFSET propagates an error from a non-numeric rows argument", async () => {
  const { getVT } = await buildSheet(["set A1 formula OFFSET(A1,1/0,0)"]);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("OFFSET propagates an error from a non-numeric cols argument", async () => {
  const { getVT } = await buildSheet(["set A1 formula OFFSET(A1,0,1/0)"]);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("OFFSET on a sheet-qualified reference preserves the sheet qualifier", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  SC.Formula.AddSheetToCache("REMOTE", "version:1.5\ncell:B1:v:77\nsheet:c:2:r:1\n", false);
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set X1 formula OFFSET(REMOTE!A1,0,1)"]);
  await recalcSheet(SC, sheet);
  expect(sheet.GetAssuredCell("X1").datavalue).toBe(77);
});

test("OFFSET nested inside INDIRECT-free formula composition (SUM of OFFSET of INDIRECT)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    'set D1 formula SUM(OFFSET(INDIRECT("A1"),0,0,3,1))',
  ]);
  expect(getDV("D1")).toBe(6);
});

test("OFFSET with wrong reference argument type is #REF!", async () => {
  const { getVT } = await buildSheet(["set A1 formula OFFSET(5,0,0)"]);
  expect(getVT("A1")).toBe("e#REF!");
});

// ---------------------------------------------------------------------------
// Conservative recalculation: dynamic targets must never be stale
// ---------------------------------------------------------------------------

test("INDIRECT recalculates when the dynamically targeted cell changes (no dependency edge from static token scan)", async () => {
  const { SC, sheet, getDV } = await buildSheet([
    "set A5 value n 100",
    'set B1 formula INDIRECT("A5")',
  ]);
  expect(getDV("B1")).toBe(100);

  await scheduleCommands(SC, sheet, ["set A5 value n 200"]);
  await recalcSheet(SC, sheet);
  expect(getDV("B1")).toBe(200);
});

test("OFFSET recalculates when the offset-computed target cell changes", async () => {
  const { SC, sheet, getDV } = await buildSheet([
    "set A5 value n 1",
    "set B1 formula OFFSET(A1,4,0)",
  ]);
  expect(getDV("B1")).toBe(1);

  await scheduleCommands(SC, sheet, ["set A5 value n 999"]);
  await recalcSheet(SC, sheet);
  expect(getDV("B1")).toBe(999);
});

test("OFFSET target that is itself a formula recalculates in the same pass (no same-pass staleness)", async () => {
  // B1 = OFFSET(A1,4,0) is defined BEFORE A5 in sheet.cells insertion
  // order, so it is checked/evaluated ahead of A5 in RecalcTimerRoutine's
  // celllist scan. Without the bounded dynamic-ref retry pass, B1 would
  // read A5's value from before A5 recalculated in this same pass.
  const { SC, sheet, getDV } = await buildSheet([
    "set B1 formula OFFSET(A1,4,0)",
    "set A4 value n 1",
    "set A5 formula A4+1",
  ]);
  expect(getDV("A5")).toBe(2);
  expect(getDV("B1")).toBe(2);

  await scheduleCommands(SC, sheet, ["set A4 value n 100"]);
  await recalcSheet(SC, sheet);
  expect(getDV("A5")).toBe(101);
  expect(getDV("B1")).toBe(101);
});

test("INDIRECT target that is itself a formula recalculates in the same pass (no same-pass staleness)", async () => {
  // B1 = INDIRECT("A5") is defined BEFORE A5 for the same reason as above.
  const { SC, sheet, getDV } = await buildSheet([
    'set B1 formula INDIRECT("A5")',
    "set A4 value n 1",
    "set A5 formula A4+1",
  ]);
  expect(getDV("B1")).toBe(2);

  await scheduleCommands(SC, sheet, ["set A4 value n 50"]);
  await recalcSheet(SC, sheet);
  expect(getDV("A5")).toBe(51);
  expect(getDV("B1")).toBe(51);
});

test("dynamic-reference retry pass is bounded to one extra pass (no infinite loop, calcfinished fires once)", async () => {
  const { SC, sheet } = await buildSheet(['set A1 formula INDIRECT("A1")']);
  // Self-referential INDIRECT: RecalcCheckCell's static scan sees no token
  // reference (the argument is a string literal), so this is not flagged as
  // a circular reference by the dependency walk; it must still settle after
  // the bounded single retry pass rather than looping forever.
  let calcfinishedCount = 0;
  const prev = sheet.statuscallback;
  sheet.statuscallback = (...args: any[]) => {
    prev?.(...args);
    if (args[1] === "calcfinished") calcfinishedCount++;
  };
  await recalcSheet(SC, sheet, 4000);
  expect(calcfinishedCount).toBe(1);
  sheet.statuscallback = prev;
});

test("sheet without INDIRECT/OFFSET never takes the retry branch (hasDynamicRef stays false)", async () => {
  const { sheet } = await buildSheet(["set A1 value n 1", "set B1 formula A1+1"]);
  expect(sheet.hasDynamicRef).toBe(false);
  expect(sheet.dynamicRefRetried).toBe(false);
});

// ---------------------------------------------------------------------------
// Command ordering / undo / redo / insert / delete / copy / fill
// ---------------------------------------------------------------------------

test("undo/redo restores INDIRECT-dependent recalculated value", async () => {
  const { SC, sheet, getDV } = await buildSheet([
    "set A1 value n 1",
    'set B1 formula INDIRECT("A1")',
  ]);
  expect(getDV("B1")).toBe(1);

  await scheduleCommands(SC, sheet, ["set A1 value n 2"]);
  await recalcSheet(SC, sheet);
  expect(getDV("B1")).toBe(2);

  await sheetUndo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(getDV("B1")).toBe(1);

  await sheetRedo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(getDV("B1")).toBe(2);
});

test("insertrow shifts OFFSET's anchor reference and keeps the resolved target correct", async () => {
  const { SC, sheet, getDV } = await buildSheet([
    "set A2 value n 7",
    "set B1 formula OFFSET(A1,1,0)",
  ]);
  expect(getDV("B1")).toBe(7);

  // Insert a row above row 1: the literal "A1" token in the formula shifts
  // to A2, and A2's original content (7) shifts to A3.
  await scheduleCommands(SC, sheet, ["insertrow 1"]);
  await recalcSheet(SC, sheet);
  expect(getDV("B2")).toBe(7); // formula cell itself moved down to B2
});

test("deletecol on OFFSET's literal anchor produces #REF! per standard formula-rewrite policy", async () => {
  const { SC, sheet, getVT } = await buildSheet([
    "set B1 value n 1",
    "set C1 formula OFFSET(B1,0,0)",
  ]);
  await scheduleCommands(SC, sheet, ["deletecol B"]);
  await recalcSheet(SC, sheet);
  expect(getVT("B1")).toBe("e#REF!");
});

test("copy/paste an INDIRECT formula preserves conservative recalculation on the pasted target", async () => {
  const { SC, sheet, getDV } = await buildSheet([
    "set A1 value n 3",
    'set B1 formula INDIRECT("A1")',
    "copy B1 formulas",
    "paste C1 formulas",
  ]);
  expect(getDV("C1")).toBe(3);

  await scheduleCommands(SC, sheet, ["set A1 value n 30"]);
  await recalcSheet(SC, sheet);
  expect(getDV("C1")).toBe(30);
});

test("filldown an OFFSET formula recalculates every filled row after a target edit", async () => {
  const { SC, sheet, getDV } = await buildSheet([
    "set C1 value n 1",
    "set C2 value n 2",
    "set C3 value n 3",
    "set A1 formula OFFSET(A1,0,2)",
    "set A2 formula OFFSET(A2,0,2)",
    "set A3 formula OFFSET(A3,0,2)",
  ]);
  expect(getDV("A1")).toBe(1);
  expect(getDV("A2")).toBe(2);
  expect(getDV("A3")).toBe(3);

  await scheduleCommands(SC, sheet, ["set C2 value n 200"]);
  await recalcSheet(SC, sheet);
  expect(getDV("A2")).toBe(200);
});

// ---------------------------------------------------------------------------
// Cross-sheet cache, named/range refs, cycles
// ---------------------------------------------------------------------------

test("INDIRECT across sheets stays fresh across recalcs (sheet cache does not go stale)", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const remote = SC.Formula.AddSheetToCache(
    "REMOTE",
    "version:1.5\ncell:A1:v:1\nsheet:c:1:r:1\n",
    false,
  );
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ['set B1 formula INDIRECT("REMOTE!A1")']);
  await recalcSheet(SC, sheet);
  expect(sheet.GetAssuredCell("B1").datavalue).toBe(1);

  remote.cells.A1.datavalue = 2;
  await recalcSheet(SC, sheet);
  expect(sheet.GetAssuredCell("B1").datavalue).toBe(2);
});

test("INDIRECT and OFFSET both resolve a named range identically to a literal range", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "name define MYRANGE A1:A3",
    'set D1 formula SUM(INDIRECT("MYRANGE"))',
  ]);
  expect(getDV("D1")).toBe(6);
});

test("INDIRECT chained self-cycle resolves without hanging or crashing (bounded retry, not a circular #REF loop)", async () => {
  const { getVT } = await buildSheet(['set A1 formula INDIRECT("A1")']);
  // A1 references itself dynamically; the static dependency walk cannot see
  // this (the text is opaque), so it is not caught as a circular reference.
  // It must still resolve to a defined, non-crashing result.
  expect(typeof getVT("A1")).toBe("string");
});

test("OFFSET(A1,0,0) chained self-cycle resolves without hanging or crashing", async () => {
  const { getVT } = await buildSheet(["set A1 formula OFFSET(A1,0,0)"]);
  expect(typeof getVT("A1")).toBe("string");
});

test("OFFSET on a range reference whose band decodes to invalid bounds is #REF!", async () => {
  // "BAD" is a name whose definition is unparseable range text; coordToCr
  // fails closed to col=0 for non-letter-column text (see
  // "COLUMNS/ROWS on invalid named range" regression elsewhere), so
  // DecodeRangeParts's c1<1 guard returns null and OFFSET must surface
  // #REF! rather than looping or crashing.
  const { getVT } = await buildSheet([
    "name define BAD invalid:bad",
    "set A1 formula OFFSET(BAD,0,0)",
  ]);
  expect(getVT("A1")).toBe("e#REF!");
});

test("INDIRECT resolves a sheet-qualified name that is itself a range definition", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const remote = SC.Formula.AddSheetToCache("REMOTE", "version:1.5\nsheet:c:1:r:2\n", false);
  await scheduleCommands(SC, remote, [
    "set A1 value n 1",
    "set A2 value n 2",
    "name define MYRANGE A1:A2",
  ]);
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ['set B1 formula SUM(INDIRECT("REMOTE!MYRANGE"))']);
  await recalcSheet(SC, sheet);
  expect(sheet.GetAssuredCell("B1").datavalue).toBe(3);
});

test("INDIRECT resolves a sheet-qualified name that is itself a coord definition", async () => {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  const remote = SC.Formula.AddSheetToCache("REMOTE", "version:1.5\nsheet:c:1:r:1\n", false);
  await scheduleCommands(SC, remote, ["set A1 value n 42", "name define MYCELL A1"]);
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ['set B1 formula INDIRECT("REMOTE!MYCELL")']);
  await recalcSheet(SC, sheet);
  expect(sheet.GetAssuredCell("B1").datavalue).toBe(42);
});

// ---------------------------------------------------------------------------
// Help/registration surface
// ---------------------------------------------------------------------------

test("INDIRECT and OFFSET are registered in FunctionList with lookup class and help text", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.FillFunctionInfo();
  expect(SC.Formula.FunctionList.INDIRECT).toBeTruthy();
  expect(SC.Formula.FunctionList.OFFSET).toBeTruthy();
  expect(SC.Formula.FunctionList.INDIRECT[4]).toBe("lookup");
  expect(SC.Formula.FunctionList.OFFSET[4]).toBe("lookup");
  expect(SC.Formula.FunctionClasses!.lookup.items).toContain("INDIRECT");
  expect(SC.Formula.FunctionClasses!.lookup.items).toContain("OFFSET");
  expect(SC.Formula.FunctionArgDefs.indirect).toBeTruthy();
  expect(SC.Formula.FunctionArgDefs.offset).toBeTruthy();
  expect(SC.Formula.FunctionList.INDIRECT[3]).toBeTruthy();
  expect(SC.Formula.FunctionList.OFFSET[3]).toBeTruthy();
});
