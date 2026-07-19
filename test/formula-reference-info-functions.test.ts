import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Command-level tests for the reference/information/render formula gap
// closed in this change: ROW, COLUMN, ADDRESS, ISFORMULA, ISREF,
// ERROR.TYPE, TYPE, HYPERLINK, IMAGE, and TEXT.
// See js/formula1.ts (SocialCalc.Formula.RowColumnFunctions,
// AddressFunction, RefInfoFunctions, HyperlinkFunction, ImageFunction,
// TextFunction) and js/socialcalcconstants.ts (s_fdef_*/s_farg_* help
// registration) for the implementation.

// ---------------------------------------------------------------------------
// ROW / COLUMN
// ---------------------------------------------------------------------------

describe("ROW / COLUMN", () => {
  test("zero-arg form returns the current cell's coordinates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set C5 formula ROW()", "set D7 formula COLUMN()"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("C5").datavalue).toBe(5);
    expect(sheet.GetAssuredCell("C5").valuetype).toBe("n");
    expect(sheet.GetAssuredCell("D7").datavalue).toBe(4);
  });

  test("one-arg form returns the referenced cell's coordinates, not the current cell's", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ROW(E9)", "set A2 formula COLUMN(E9)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(9);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(5);
  });

  test("range argument returns the top-left corner's coordinates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula ROW(C3:F9)",
      "set A2 formula COLUMN(C3:F9)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(3);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(3);
  });

  test("cross-sheet reference is resolved by coordinate, not by following into the other sheet", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.Formula.AddSheetToCache("Other", "version:1.5\ncell:B4:v:1\nsheet:c:4:r:4\n");
    await scheduleCommands(SC, sheet, [
      "set A1 formula ROW(Other!B4)",
      "set A2 formula COLUMN(Other!B4)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(4);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(2);
  });

  test("a non-reference argument (literal number/text) is #VALUE!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ROW(5)", 'set A2 formula COLUMN("x")']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A2").valuetype).toBe("e#VALUE!");
  });

  test("too many arguments is rejected", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ROW(A1,A2)"]);
    await recalcSheet(SC, sheet);

    expect(String(sheet.GetAssuredCell("A1").datavalue)).toContain(
      "Incorrect arguments to function ROW",
    );
  });

  test("range on an unavailable cross-sheet reference is #REF!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // AddSheetToCache("NoSuchSheet", "") registers a resolvable-but-empty
    // cache entry (sheetdata is null) synchronously, exactly matching what
    // DecodeRangeParts sees for an unavailable sheet -- this avoids
    // RecalcSheet's async SheetCache.waitingForLoading callback path
    // (there is no load callback wired up in this unit-test sheet, so a
    // genuinely *missing* cache entry would hang recalc waiting for one).
    SC.Formula.AddSheetToCache("NoSuchSheet", "");
    const cell = sheet.GetAssuredCell("A1");
    cell.formula = "ROW(NoSuchSheet!A1:B2)";
    cell.datatype = "f";
    cell.parseinfo = SC.Formula.ParseFormulaIntoTokens(cell.formula);
    cell.parseinfo.coord = "A1";
    const result = SC.Formula.evaluate_parsed_formula(cell.parseinfo, sheet, false);

    expect(result.type).toBe("e#REF!");
  });

  test("zero-arg form inside a named-formula evaluation with no anchor cell is #REF!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // `name define` evaluates its formula body via evaluate_parsed_formula
    // without a coord (LookupName has no anchor cell to attribute the
    // named formula to), so a bare ROW()/COLUMN() nested inside a name
    // definition hits the "no current cell" branch, not a real anchor.
    const parseobj = new SC.Parse("name define NAMEDROW =ROW()\n");
    SC.ExecuteSheetCommand(sheet, parseobj, false);

    const cell = sheet.GetAssuredCell("A1");
    cell.formula = "NAMEDROW";
    cell.datatype = "f";
    cell.parseinfo = SC.Formula.ParseFormulaIntoTokens(cell.formula);
    cell.parseinfo.coord = "A1";
    const result = SC.Formula.evaluate_parsed_formula(cell.parseinfo, sheet, false);

    expect(result.type).toBe("e#REF!");
  });

  test("a range value that DecodeRangeParts cannot resolve is #REF!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // ZZZ exceeds the engine's ZZ (702) column maximum. The formula
    // tokenizer's coord regex ([A-Z]{1,2}) cannot produce ZZZ as a coord
    // token directly, but a `name define` range definition bypasses that
    // regex, so this is the only formula-reachable way to give ROW/COLUMN
    // a "range"-typed operand that DecodeRangeParts rejects as null.
    const parseobj = new SC.Parse("name define BADRANGE ZZZ1:ZZZ2\n");
    SC.ExecuteSheetCommand(sheet, parseobj, false);

    const cell = sheet.GetAssuredCell("A1");
    cell.formula = "ROW(BADRANGE)";
    cell.datatype = "f";
    cell.parseinfo = SC.Formula.ParseFormulaIntoTokens(cell.formula);
    cell.parseinfo.coord = "A1";
    const result = SC.Formula.evaluate_parsed_formula(cell.parseinfo, sheet, false);

    expect(result.type).toBe("e#REF!");
  });
});

// ---------------------------------------------------------------------------
// ADDRESS
// ---------------------------------------------------------------------------

describe("ADDRESS", () => {
  test("default abs_num (1) produces a fully absolute A1 reference", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1,1)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("$A$1");
    expect(sheet.GetAssuredCell("A1").valuetype).toBe("t");
  });

  test("all four abs_num modes produce the documented $ placement", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula ADDRESS(2,3,1)",
      "set A2 formula ADDRESS(2,3,2)",
      "set A3 formula ADDRESS(2,3,3)",
      "set A4 formula ADDRESS(2,3,4)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("$C$2");
    expect(sheet.GetAssuredCell("A2").datavalue).toBe("C$2");
    expect(sheet.GetAssuredCell("A3").datavalue).toBe("$C2");
    expect(sheet.GetAssuredCell("A4").datavalue).toBe("C2");
  });

  test("a1=FALSE produces R1C1-style references for every abs_num mode", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula ADDRESS(2,3,1,FALSE)",
      "set A2 formula ADDRESS(2,3,2,FALSE)",
      "set A3 formula ADDRESS(2,3,3,FALSE)",
      "set A4 formula ADDRESS(2,3,4,FALSE)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("R2C3");
    expect(sheet.GetAssuredCell("A2").datavalue).toBe("R2C[3]");
    expect(sheet.GetAssuredCell("A3").datavalue).toBe("R[2]C3");
    expect(sheet.GetAssuredCell("A4").datavalue).toBe("R[2]C[3]");
  });

  test("a blank a1 reference argument defaults to A1-style (matches the TRUE/omitted default)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Z1 is left blank: OperandValueAndType coerces it to type "b", which
    // AddressFunction treats identically to a1 omitted/TRUE, distinct from
    // the Boolean(value) coercion path exercised by a1=FALSE above.
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1,1,1,Z1)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("$A$1");
  });

  test("sheet_text is prefixed with '!' and quoted only when it needs quoting", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      'set A1 formula ADDRESS(1,1,1,TRUE,"Sheet1")',
      'set A2 formula ADDRESS(1,1,1,TRUE,"My Sheet")',
      // the formula-string lexer treats ' and " as the same quote class, so
      // an apostrophe literal cannot survive a quoted formula string
      // argument -- route it through a text cell instead (also exercises
      // ADDRESS's sheet_text argument as a coerced text reference).
      "set Z1 text t It's Mine",
      "set A3 formula ADDRESS(1,1,1,TRUE,Z1)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("Sheet1!$A$1");
    expect(sheet.GetAssuredCell("A2").datavalue).toBe("'My Sheet'!$A$1");
    // an embedded single quote is doubled inside the quoted sheet name
    expect(sheet.GetAssuredCell("A3").datavalue).toBe("'It''s Mine'!$A$1");
  });

  test("row/column bounds: non-positive or out-of-range (beyond ZZ/65536) is #VALUE!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula ADDRESS(0,1)",
      "set A2 formula ADDRESS(1,0)",
      "set A3 formula ADDRESS(1,703)", // ZZ is col 702, the engine's maximum
      "set A4 formula ADDRESS(65537,1)",
      "set A5 formula ADDRESS(65536,702)", // exactly at both maxima: valid
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A2").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A3").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A4").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A5").datavalue).toBe("$ZZ$65536");
  });

  test("an out-of-range abs_num is #VALUE!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula ADDRESS(1,1,5)",
      "set A2 formula ADDRESS(1,1,0)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A2").valuetype).toBe("e#VALUE!");
  });

  test("too few arguments is rejected", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1)"]);
    await recalcSheet(SC, sheet);

    expect(String(sheet.GetAssuredCell("A1").datavalue)).toContain(
      "Incorrect arguments to function ADDRESS",
    );
  });

  test("too many arguments is rejected", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula ADDRESS(1,1,1,TRUE,"Sheet1",1)']);
    await recalcSheet(SC, sheet);

    expect(String(sheet.GetAssuredCell("A1").datavalue)).toContain(
      "Incorrect arguments to function ADDRESS",
    );
  });

  test("an error operand in the column_num argument position propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1,1/0)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("an error operand propagates instead of being coerced", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1/0,1)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("an error operand in the abs_num argument position propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1,1,1/0)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("an error operand in the a1 argument position propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1,1,1,1/0)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("an error operand in the sheet_text argument position propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ADDRESS(1,1,1,TRUE,1/0)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });
});

// ---------------------------------------------------------------------------
// ISFORMULA / ISREF
// ---------------------------------------------------------------------------

describe("ISFORMULA / ISREF", () => {
  test("ISFORMULA is true only for a reference to a formula cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      "set A2 formula A1*2",
      "set B1 formula ISFORMULA(A1)",
      "set B2 formula ISFORMULA(A2)",
      "set B3 formula ISFORMULA(A3)", // blank cell
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe(0);
    expect(sheet.GetAssuredCell("B2").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B3").datavalue).toBe(0);
  });

  test("ISFORMULA distinguishes a typed reference from a plain literal value (no coercion)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula 1+1", // A1 evaluates to the number 2, but is a formula cell
      "set B1 formula ISFORMULA(A1)", // reference -> inspects the cell itself: true
      "set B2 formula ISFORMULA(2)", // literal value equal to A1's result: false
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B2").datavalue).toBe(0);
  });

  test("ISFORMULA on a range reports the top-left cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula 1+1",
      "set A2 value n 3",
      "set B1 formula ISFORMULA(A1:A2)",
      "set B2 formula ISFORMULA(A2:A1)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B2").datavalue).toBe(1); // normalized to A1:A2, top-left is A1
  });

  test("ISFORMULA on an out-of-band range that DecodeRangeParts cannot resolve is false, not an error", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // ZZZ exceeds the engine's ZZ (702) column maximum, so DecodeRangeParts
    // returns null for this named range's endpoints -- ISFORMULA treats an
    // undecodeable range as "no formula" (false) rather than propagating a
    // parse error, matching the ROW/COLUMN #REF! convention's spirit
    // without forcing every non-reference-shaped input into an error.
    const parseobj = new SC.Parse("name define BADRANGE ZZZ1:ZZZ2\n");
    SC.ExecuteSheetCommand(sheet, parseobj, false);

    const cell = sheet.GetAssuredCell("A1");
    cell.formula = "ISFORMULA(BADRANGE)";
    cell.datatype = "f";
    cell.parseinfo = SC.Formula.ParseFormulaIntoTokens(cell.formula);
    cell.parseinfo.coord = "A1";
    const result = SC.Formula.evaluate_parsed_formula(cell.parseinfo, sheet, false);

    expect(result.value).toBe(0);
    expect(result.type).toBe("nl");
  });

  test("ISFORMULA follows a cross-sheet reference", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.Formula.AddSheetToCache("Other", "version:1.5\ncell:B2:vtf:n:2:1+1\nsheet:c:2:r:2\n");
    await scheduleCommands(SC, sheet, ["set A1 formula ISFORMULA(Other!B2)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(1);
  });

  test("ISFORMULA on a coord referencing an unavailable cross-sheet is false, not an error", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // AddSheetToCache("Ghost", "") registers a resolvable-but-empty cache
    // entry synchronously (sheetdata null), so FindInSheetCache("Ghost")
    // returns null inside IsFormulaCoordCell -- the unavailable-sheet
    // branch, distinct from the cross-sheet-success case above.
    SC.Formula.AddSheetToCache("Ghost", "");
    const cell = sheet.GetAssuredCell("A1");
    cell.formula = "ISFORMULA(Ghost!B2)";
    cell.datatype = "f";
    cell.parseinfo = SC.Formula.ParseFormulaIntoTokens(cell.formula);
    cell.parseinfo.coord = "A1";
    const result = SC.Formula.evaluate_parsed_formula(cell.parseinfo, sheet, false);

    expect(result.value).toBe(0);
    expect(result.type).toBe("nl");
  });

  test("ISFORMULA on a decodeable range whose top-left cell is blank is false", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set B1 formula ISFORMULA(C1:C2)"]);
    await recalcSheet(SC, sheet);

    // C1:C2 is fully blank -- a valid, in-band range whose top-left cell
    // simply has no formula, distinct from the DecodeRangeParts-null case.
    expect(sheet.GetAssuredCell("B1").datavalue).toBe(0);
  });

  test("ISREF is true for a cell or range reference, false for a literal value", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      "set B1 formula ISREF(A1)",
      "set B2 formula ISREF(A1:A2)",
      "set B3 formula ISREF(5)",
      'set B4 formula ISREF("text")',
      "set B5 formula ISREF(TRUE)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B2").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B3").datavalue).toBe(0);
    expect(sheet.GetAssuredCell("B4").datavalue).toBe(0);
    expect(sheet.GetAssuredCell("B5").datavalue).toBe(0);
  });

  test("ISREF(errorformula) still reports true: reference-ness is checked before the error propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula 1/0",
      "set B1 formula ISREF(A1)",
      "set B2 formula ISREF(1/0)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe(1); // A1 is a coord reference
    expect(sheet.GetAssuredCell("B2").datavalue).toBe(0); // 1/0 is not a reference at all
  });
});

// ---------------------------------------------------------------------------
// ERROR.TYPE
// ---------------------------------------------------------------------------

describe("ERROR.TYPE", () => {
  test("maps every error class this engine can produce to its documented code", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula ERROR.TYPE(1/0)", // #DIV/0!
      'set A2 formula ERROR.TYPE("x"+1)', // #VALUE!
      "set A3 formula ERROR.TYPE(#REF!)",
      "set A4 formula ERROR.TYPE(UNKNOWNNAME)", // #NAME?
      "set A5 formula ERROR.TYPE(SQRT(-1))", // #NUM!
      "set A6 formula ERROR.TYPE(NA())", // #N/A
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(2);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(3);
    expect(sheet.GetAssuredCell("A3").datavalue).toBe(4);
    expect(sheet.GetAssuredCell("A4").datavalue).toBe(5);
    expect(sheet.GetAssuredCell("A5").datavalue).toBe(6);
    expect(sheet.GetAssuredCell("A6").datavalue).toBe(7);
  });

  test("a non-error argument returns #N/A", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula ERROR.TYPE(5)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#N/A");
  });
});

// ---------------------------------------------------------------------------
// TYPE
// ---------------------------------------------------------------------------

describe("TYPE", () => {
  test("returns the documented code for every data class", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula TYPE(5)", // number: 1
      'set A2 formula TYPE("x")', // text: 2
      "set A3 formula TYPE(TRUE)", // logical: 4
      "set A4 formula TYPE(1/0)", // error: 16
      "set A5 formula TYPE(A9:A10)", // range: 64 (A9:A10 is blank)
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(2);
    expect(sheet.GetAssuredCell("A3").datavalue).toBe(4);
    expect(sheet.GetAssuredCell("A4").datavalue).toBe(16);
    expect(sheet.GetAssuredCell("A5").datavalue).toBe(64);
  });

  test("TYPE(reference) reports the referenced cell's value type, not 'reference'", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      "set A2 text t hello",
      "set A3 formula 1/0",
      "set A4 formula 1=1",
      "set B1 formula TYPE(A1)",
      "set B2 formula TYPE(A2)",
      "set B3 formula TYPE(A3)",
      "set B4 formula TYPE(A4)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B2").datavalue).toBe(2);
    expect(sheet.GetAssuredCell("B3").datavalue).toBe(16); // referenced cell holds an error
    expect(sheet.GetAssuredCell("B4").datavalue).toBe(4); // referenced cell holds a logical
  });

  test("TYPE(blankcell) reports Number (1), matching plain-value coercion", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula TYPE(Z99)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TEXT
// ---------------------------------------------------------------------------

describe("TEXT", () => {
  test("formats numeric values with common numeric/currency/percent patterns", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      'set A1 formula TEXT(1234.5,"$#,##0.00")',
      'set A2 formula TEXT(0.4,"0.0%")',
      'set A3 formula TEXT(1234567,"#,##0")',
      'set A4 formula TEXT(3,"0.00")',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("$1,234.50");
    expect(sheet.GetAssuredCell("A1").valuetype).toBe("t");
    expect(sheet.GetAssuredCell("A2").datavalue).toBe("40.0%");
    expect(sheet.GetAssuredCell("A3").datavalue).toBe("1,234,567");
    expect(sheet.GetAssuredCell("A4").datavalue).toBe("3.00");
  });

  test("formats a date value with a date pattern", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 formula DATE(2006,2,1)",
      'set B1 formula TEXT(A1,"yyyy-mm-dd")',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe("2006-02-01");
  });

  test("format_text '' is treated as General", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula TEXT(1234.5,"")']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("1234.5");
  });

  test("output is plain text: no HTML entities or markup leak through from the shared formatting engine", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      // "?" integer placeholders pad with the shared engine's "&nbsp;" filler.
      'set A1 formula TEXT(5,"???0")',
      // [Red] triggers the shared engine's <span style="color:..."> wrapper.
      'set A2 formula TEXT(-5,"0;[Red]-0")',
    ]);
    await recalcSheet(SC, sheet);

    const a1 = String(sheet.GetAssuredCell("A1").datavalue);
    expect(a1).not.toContain("&nbsp;");
    expect(a1).not.toContain("<");
    expect(a1.trim()).toBe("5");

    const a2 = String(sheet.GetAssuredCell("A2").datavalue);
    expect(a2).not.toContain("<span");
    expect(a2).not.toContain("&nbsp;");
    expect(a2).toBe("-5");
  });

  test("a text value with '@' returns the value unchanged as plain text", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 text t hello",
      'set B1 formula TEXT(A1,"@")',
      'set B2 formula TEXT(A1,"[before] @ [after]")',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe("hello");
    expect(sheet.GetAssuredCell("B2").datavalue).toBe("[before] hello [after]");
  });

  test("a numeric value with an unquoted '@' text placeholder is #VALUE!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula TEXT(5,"@")']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#VALUE!");
  });

  test("a text value with a numeric/date format grammar is #VALUE!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 text t hello",
      'set B1 formula TEXT(A1,"0.00")',
      'set B2 formula TEXT(A1,"mm/dd/yyyy")',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("B2").valuetype).toBe("e#VALUE!");
  });

  test("a text value with a purely literal format (no numeric/date ops, no '@') keeps the format's literal text", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // "box" has no numeric/date placeholders (d/m/y/h/s/#/0/?/./$/%/G/A)
    // and no "@", so it hits the literal-copy branch for a text value
    // rather than the numeric-grammar #VALUE! rejection.
    await scheduleCommands(SC, sheet, ["set A1 text t hello", 'set B1 formula TEXT(A1,"box")']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("B1").valuetype).toBe("t");
    expect(sheet.GetAssuredCell("B1").datavalue).toBe("box");
  });

  test("a malformed format (unmatched bracket) is #VALUE!, not silently truncated", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula TEXT(5,"0.00[Red")']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#VALUE!");
  });

  test("a format with a quoted literal segment (containing a bracket-like char) is not treated as malformed", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Formula-string escaping: "" inside a quoted formula literal is one
    // literal '"'. This builds format_text = '"[ok]" 0.00' -- exercising
    // TextFormatHasUnmatchedBracket/TextFormatHasUnquotedChar's in-quote
    // state (a '[' inside a quoted segment must not count as an unmatched
    // bracket, and the closing '"' must correctly drop back out of quote
    // state).
    await scheduleCommands(SC, sheet, ['set A1 formula TEXT(5,"""[ok]"" 0.00")']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("[ok] 5.00");
  });

  test("an error operand propagates instead of being formatted", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula TEXT(1/0,"0.00")']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("an error operand in the format_text argument position also propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula TEXT(5,1/0)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("a blank reference formats as its coerced value (0 for numeric formats, empty for text formats)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      'set A1 formula TEXT(Z99,"0.00")',
      'set A2 formula TEXT(Z99,"@")',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe("0.00");
    expect(sheet.GetAssuredCell("A2").datavalue).toBe("");
  });
});

// ---------------------------------------------------------------------------
// HYPERLINK / IMAGE: command-level cells + rendering through the audited
// text-link / text-image sinks. See docs/security-sink-inventory.md.
// ---------------------------------------------------------------------------

describe("HYPERLINK", () => {
  test("returns friendly_name (or link_location when omitted) tagged as a link value", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      'set A1 formula HYPERLINK("http://example.com","Click here")',
      'set A2 formula HYPERLINK("http://example.com")',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("tl");
    expect(sheet.GetAssuredCell("A2").valuetype).toBe("tl");
    expect(sheet.GetAssuredCell("A1").datavalue).toBe("Click here<http://example.com>");
    expect(sheet.GetAssuredCell("A2").datavalue).toBe("http://example.com<http://example.com>");
  });

  test("renders through the audited text-link path (trusted mode)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const cell = sheet.GetAssuredCell("A1");
    cell.datatype = "f";
    cell.formula = 'HYPERLINK("http://example.com","Click here")';
    cell.datavalue = "Click here<http://example.com>";
    cell.valuetype = "tl";

    const out = SC.format_text_for_display(cell.datavalue, cell.valuetype, "", sheet, null);
    expect(out).toBe('<a href="http://example.com" target="_blank">Click here</a>');
  });

  test("in untrusted mode, a javascript: link_location is neutralized to inert text (no anchor)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.Callbacks.untrustedContent = true;
    try {
      const cell = sheet.GetAssuredCell("A1");
      cell.datatype = "f";
      cell.formula = 'HYPERLINK("javascript:alert(1)","Click")';
      cell.datavalue = "Click<javascript:alert(1)>";
      cell.valuetype = "tl";

      const out = SC.format_text_for_display(cell.datavalue, cell.valuetype, "", sheet, null);
      expect(out).not.toContain("<a ");
      expect(out).not.toContain("javascript:");
      expect(out).toBe("Click");
    } finally {
      SC.Callbacks.untrustedContent = false;
    }
  });

  test("in untrusted mode, an http(s) link still renders as a live link", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.Callbacks.untrustedContent = true;
    try {
      const cell = sheet.GetAssuredCell("A1");
      cell.datatype = "f";
      cell.formula = 'HYPERLINK("https://example.com","Go")';
      cell.datavalue = "Go<https://example.com>";
      cell.valuetype = "tl";

      const out = SC.format_text_for_display(cell.datavalue, cell.valuetype, "", sheet, null);
      expect(out).toBe('<a href="https://example.com" target="_blank">Go</a>');
    } finally {
      SC.Callbacks.untrustedContent = false;
    }
  });

  test("an error operand propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula HYPERLINK(1/0)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("an error operand in the friendly_name argument position propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula HYPERLINK("http://example.com",1/0)']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("too many arguments is rejected", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula HYPERLINK("http://example.com","a","b")']);
    await recalcSheet(SC, sheet);

    expect(String(sheet.GetAssuredCell("A1").datavalue)).toContain(
      "Incorrect arguments to function HYPERLINK",
    );
  });
});

describe("IMAGE", () => {
  test("returns the url tagged as an image value; mode omitted defaults to the honest original-size mode", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      'set A1 formula IMAGE("http://example.com/pic.jpg")',
      'set A2 formula IMAGE("http://example.com/pic.jpg",3)',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("tm");
    expect(sheet.GetAssuredCell("A1").datavalue).toBe("http://example.com/pic.jpg");
    expect(sheet.GetAssuredCell("A2").valuetype).toBe("tm");
    expect(sheet.GetAssuredCell("A2").datavalue).toBe("http://example.com/pic.jpg");
  });

  test("renders through the audited text-image path (trusted mode)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const cell = sheet.GetAssuredCell("A1");
    cell.datatype = "f";
    cell.formula = 'IMAGE("http://example.com/pic.jpg")';
    cell.datavalue = "http://example.com/pic.jpg";
    cell.valuetype = "tm";

    const out = SC.format_text_for_display(cell.datavalue, cell.valuetype, "", sheet, null);
    expect(out).toBe('<img src="http://example.com/pic.jpg">');
  });

  test("in untrusted mode, a javascript:/data: SVG payload is neutralized to inert escaped text", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.Callbacks.untrustedContent = true;
    try {
      const cell = sheet.GetAssuredCell("A1");
      cell.datatype = "f";
      cell.formula = 'IMAGE("javascript:alert(1)")';
      cell.datavalue = "javascript:alert(1)";
      cell.valuetype = "tm";

      const out = SC.format_text_for_display(cell.datavalue, cell.valuetype, "", sheet, null);
      expect(out).not.toContain("<img");
      expect(out).toBe("javascript:alert(1)");

      const svgCell = sheet.GetAssuredCell("A2");
      svgCell.datatype = "f";
      svgCell.formula = 'IMAGE("data:image/svg+xml,<svg onload=alert(1)>")';
      svgCell.datavalue = "data:image/svg+xml,<svg onload=alert(1)>";
      svgCell.valuetype = "tm";
      const svgOut = SC.format_text_for_display(
        svgCell.datavalue,
        svgCell.valuetype,
        "",
        sheet,
        null,
      );
      expect(svgOut).not.toContain("<img");
      expect(svgOut).toBe("data:image/svg+xml,&lt;svg onload=alert(1)&gt;");
    } finally {
      SC.Callbacks.untrustedContent = false;
    }
  });

  test("in untrusted mode, an http(s) image url still renders", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    SC.Callbacks.untrustedContent = true;
    try {
      const cell = sheet.GetAssuredCell("A1");
      cell.datatype = "f";
      cell.formula = 'IMAGE("http://example.com/pic.jpg")';
      cell.datavalue = "http://example.com/pic.jpg";
      cell.valuetype = "tm";

      const out = SC.format_text_for_display(cell.datavalue, cell.valuetype, "", sheet, null);
      expect(out).toBe('<img src="http://example.com/pic.jpg">');
    } finally {
      SC.Callbacks.untrustedContent = false;
    }
  });

  test("rejects unsupported modes (fit-to-cell, stretch, custom) rather than faking them", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      'set A1 formula IMAGE("http://example.com/pic.jpg",1)',
      'set A2 formula IMAGE("http://example.com/pic.jpg",2)',
      'set A3 formula IMAGE("http://example.com/pic.jpg",4)',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A2").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A3").valuetype).toBe("e#VALUE!");
  });

  test("rejects height/width arguments even with a valid mode (no per-formula sizing hook is honestly implemented)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      // mode 4 alone errors before height/width is even inspected; use the
      // one accepted mode (3) with a trailing height arg to reach the
      // dedicated height/width-argument rejection branch.
      'set A1 formula IMAGE("http://example.com/pic.jpg",4,100,200)',
      'set A2 formula IMAGE("http://example.com/pic.jpg",3,100)',
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#VALUE!");
    expect(sheet.GetAssuredCell("A2").valuetype).toBe("e#VALUE!");
  });

  test("an error operand in the mode argument position propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ['set A1 formula IMAGE("http://example.com/pic.jpg",1/0)']);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });

  test("an error operand propagates", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula IMAGE(1/0)"]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").valuetype).toBe("e#DIV/0!");
  });
});

// ---------------------------------------------------------------------------
// FunctionList / help-text registration plumbing
// ---------------------------------------------------------------------------

test("all ten reference/information/render functions are registered with help text and arg strings", async () => {
  const SC = await loadSocialCalc();
  SC.Formula.FunctionClasses = null; // force FillFunctionInfo to (re)run
  SC.Formula.FillFunctionInfo();

  for (const fname of [
    "ROW",
    "COLUMN",
    "ADDRESS",
    "ISFORMULA",
    "ISREF",
    "ERROR.TYPE",
    "TYPE",
    "HYPERLINK",
    "IMAGE",
    "TEXT",
  ]) {
    const entry = SC.Formula.FunctionList[fname];
    expect(entry, `${fname} missing from FunctionList`).toBeTruthy();
    expect(entry[3], `${fname} missing help text`).toBeTruthy();
    const argString = SC.Formula.FunctionArgString(fname);
    expect(argString, `${fname} missing arg string`).toBeTruthy();
  }
});
