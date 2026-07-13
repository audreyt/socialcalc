// Branch/function-coverage hardening for the formula core: js/formula1.ts,
// js/formula-parse.ts, js/formula-operand.ts, js/formula-ref.ts, and
// js/formatnumber2.ts. Every assertion below pins an exact, independently
// reasoned observable value (parser token shape, evaluator result, or a real
// sheet cell's datavalue/valuetype/error after recalc) verified against the
// source semantics — never a value merely echoed back from the function
// under test. Scenarios were selected from lcov branch/function gaps
// (SOCIALCALC_COVERAGE=1 vp build && vp test --coverage) on 5fc380c.
import { expect, test } from "vite-plus/test";

import type { SheetInstance, SocialCalcRuntime } from "./helpers/socialcalc-runtime-types";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Ambient declarations in dist/SocialCalc.d.ts (via the referenced
// js/socialcalcconstants.d.ts / js/socialcalc-3.d.ts / js/formula1.d.ts)
// define SC.Constants, SC.TriggerIoAction, and SC.format_number_for_display
// with full types, but the shared SocialCalcRuntime helper interface is
// deliberately narrow and only surfaces the symbols the differential corpus
// exercised. Widening the runtime type with these three named, ambient-typed
// extras (rather than inline `(x as T).prop` accesses) is the named-const
// cast-with-reasoning the ts-no-inline-cast rule explicitly permits.
import type AmbientSC from "../dist/SocialCalc.js";

type FullRuntime = SocialCalcRuntime & {
  Constants: typeof AmbientSC.Constants;
  TriggerIoAction: typeof AmbientSC.TriggerIoAction;
  format_number_for_display: typeof AmbientSC.format_number_for_display;
};

type Cell = { datavalue: string | number; valuetype: string };

function resetFormulaGlobals(SC: FullRuntime): void {
  // Mirrors formula-coverage.test.ts: the UMD bundle attaches SocialCalc to
  // globalThis, so every loadSocialCalc() call shares the same live object.
  const recalcInfo = SC.RecalcInfo as { currentState: number; queue: unknown[] } | undefined;
  if (recalcInfo) {
    recalcInfo.currentState = 0;
    recalcInfo.queue = [];
  }
  SC.Formula.SheetCache.sheets = {};
  SC.Formula.SheetCache.waitingForLoading = null;
  SC.Formula.FreshnessInfo.sheets = {};
  SC.Formula.FreshnessInfo.volatile = {};
  SC.Formula.RemoteFunctionInfo.waitingForServer = null;
}

async function buildSheet(commands: string[]) {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  if (commands.length) {
    await scheduleCommands(SC, sheet, commands, true, 4000);
  }
  await recalcSheet(SC, sheet, 4000);
  const getDV = (coord: string) => (sheet.GetAssuredCell(coord) as unknown as Cell).datavalue;
  const getVT = (coord: string) => (sheet.GetAssuredCell(coord) as unknown as Cell).valuetype;
  return { SC, sheet, getDV, getVT };
}

/** Direct-evaluate a formula string (no leading "=") against a fresh sheet. */
function evalDirect(SC: FullRuntime, sheet: SheetInstance, formula: string, coord: string) {
  const parseinfo = SC.Formula.ParseFormulaIntoTokens(formula);
  // EvaluatePolish reads an ad-hoc `.coord` property off parseinfo for
  // functions needing the calling cell (IoFunctions, StoreIoEventFormula);
  // the ambient FormulaParseToken[] type doesn't declare it since it's
  // attached by callers, not produced by the parser itself.
  const parseinfoWithCoord = parseinfo as typeof parseinfo & { coord: string };
  parseinfoWithCoord.coord = coord;
  const revpolish = SC.Formula.ConvertInfixToPolish(parseinfoWithCoord);
  return SC.Formula.EvaluatePolish(parseinfoWithCoord, revpolish, sheet, false);
}

function freshSheet(SC: FullRuntime, lastrow = 20, lastcol = 20): SheetInstance {
  const sheet = new SC.Sheet();
  sheet.attribs.lastrow = lastrow;
  sheet.attribs.lastcol = lastcol;
  return sheet;
}

function setCell(
  sheet: SheetInstance,
  coord: string,
  datavalue: string | number,
  valuetype: string,
): void {
  const cell = sheet.GetAssuredCell(coord) as unknown as Cell & { datatype: string };
  cell.datavalue = datavalue;
  cell.valuetype = valuetype;
  // CreateSheetSave only serializes cells that carry a datatype ("v" for a
  // value/number, "t" for text) — set alongside datavalue/valuetype so
  // scenarios that round-trip through AddSheetToCache/CreateSheetSave work.
  cell.datatype = valuetype.charAt(0) === "n" ? "v" : "t";
}

// ===========================================================================
// formula-ref.ts: A1 coordinate algebra + formula reference rewrites
// ===========================================================================

test("rcColname clamps below A and above ZZ, and covers the AA/AZ/ZY/ZZ boundaries", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.rcColname(0)).toBe("A"); // clamps low
  expect(SC.rcColname(-5)).toBe("A"); // clamps low, negative
  expect(SC.rcColname(1)).toBe("A");
  expect(SC.rcColname(26)).toBe("Z"); // colhigh falsy branch
  expect(SC.rcColname(27)).toBe("AA"); // colhigh truthy branch begins
  expect(SC.rcColname(701)).toBe("ZY");
  expect(SC.rcColname(702)).toBe("ZZ"); // exact max
  expect(SC.rcColname(703)).toBe("ZZ"); // clamps high, one over
  expect(SC.rcColname(5000)).toBe("ZZ"); // clamps high, way over
});

test("crToCoord clamps col/row to valid ranges and covers single/double-letter columns", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.crToCoord(0, 0)).toBe("A1"); // both clamp low
  expect(SC.crToCoord(1, 1)).toBe("A1");
  expect(SC.crToCoord(26, 5)).toBe("Z5");
  expect(SC.crToCoord(27, 5)).toBe("AA5"); // colhigh branch
  expect(SC.crToCoord(703, 999999)).toBe("ZZ999999"); // clamps col high
  expect(SC.crToCoord(-1, -1)).toBe("A1"); // clamps both low, negative
});

test("coordToCr parses lowercase letters, ignores out-of-range punctuation chars, and fails closed past ZZ", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.coordToCr("a1")).toEqual({ row: 1, col: 1 }); // lowercase branch (ch>=97)
  expect(SC.coordToCr("A@1")).toEqual({ row: 1, col: 1 }); // '@' (charcode 64) matches no branch, ignored
  expect(SC.coordToCr("AAA1")).toEqual({ row: 1, col: 0 }); // col overflows 702 -> fails closed to 0
  expect(SC.coordToCr("A0")).toEqual({ row: 0, col: 1 }); // row 0 is a valid parse (not clamped here)
  expect(SC.coordToCr("$A$1")).toEqual({ row: 1, col: 1 }); // '$' (36) skipped
  // Second call for the same string must hit the cache-hit branch.
  expect(SC.coordToCr("a1")).toEqual({ row: 1, col: 1 });
});

test("ParseRange defaults empty input to A1:A1, duplicates a bare coord, and splits only on the first colon", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const empty = SC.ParseRange("");
  expect(empty.cr1.coord).toBe("A1");
  expect(empty.cr2.coord).toBe("A1");

  const bare = SC.ParseRange("a1");
  expect(bare.cr1).toEqual({ row: 1, col: 1, coord: "A1" });
  expect(bare.cr2).toEqual({ row: 1, col: 1, coord: "A1" });

  const range = SC.ParseRange("A1:B2");
  expect(range.cr1).toEqual({ row: 1, col: 1, coord: "A1" });
  expect(range.cr2).toEqual({ row: 2, col: 2, coord: "B2" });

  // Malformed right endpoint: 'BAD' overflows column algebra past 702 -> col 0,
  // no row digits -> row 0. Not an error path, just a degenerate coord.
  const malformed = SC.ParseRange("A1:BAD");
  expect(malformed.cr2).toEqual({ row: 0, col: 0, coord: "BAD" });

  // Only the FIRST colon splits; the remainder ("C3" prefixed by a stray ':')
  // is parsed as one coordToCr run over "B2:C3" — the second colon is
  // ignored (charcode 58 matches no digit/letter branch) and both halves'
  // digits/letters accumulate into a single composite col/row.
  const doubleColon = SC.ParseRange("A1:B2:C3");
  expect(doubleColon.cr1).toEqual({ row: 1, col: 1, coord: "A1" });
  expect(doubleColon.cr2).toEqual({ row: 23, col: 55, coord: "B2:C3" });
});

test("OffsetFormulaCoords shifts relative coords, freezes absolute legs, and turns overflow into #REF!", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.OffsetFormulaCoords("A1", 1, 2)).toBe("B3");
  expect(SC.OffsetFormulaCoords("$A$1", 9, 9)).toBe("$A$1"); // both legs absolute, frozen
  expect(SC.OffsetFormulaCoords("A1", -1, 0)).toBe("#REF!"); // col underflows to 0
  expect(SC.OffsetFormulaCoords("A1", 0, -1)).toBe("#REF!"); // row underflows to 0
  expect(SC.OffsetFormulaCoords("ZZ1", 1, 0)).toBe("#REF!"); // col overflows past 702
  // A quoted string operand must round-trip re-quoted while a sibling coord shifts.
  expect(SC.OffsetFormulaCoords('"a"+A1', 1, 1)).toBe('"a"+B2');
  // Sheet-qualified coord (no band) still shifts — Offset without a sort band
  // treats fill/paste identically regardless of '!' (see source comment at
  // js/formula-ref.ts:245-246). Sheet names round-trip uppercased (the
  // lexer uppercases name/op tokens on emission).
  expect(SC.OffsetFormulaCoords("Sheet1!A1", 1, 1)).toBe("SHEET1!B2");
});

test("OffsetFormulaCoords with a sort band only shifts relative legs inside the rectangle", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const band = { startCol: 1, endCol: 1, startRow: 2, endRow: 4 };
  // A1 (col 1, row 1) is outside the row band [2,4] -> stays fixed.
  // A2 (col 1, row 2) is inside the band -> shifts.
  // A5 (col 1, row 5) is outside the row band -> stays fixed.
  expect(SC.OffsetFormulaCoords("A1+A2+A5", 1, 1, band)).toBe("A1+B3+A5");
  // Under a band, a sheet-qualified coord freezes entirely (both legs),
  // unlike the no-band case above.
  expect(SC.OffsetFormulaCoords("Sheet1!A2", 1, 1, band)).toBe("SHEET1!A2");
});

test("AdjustFormulaCoords: insert at the exact reference shifts it; delete of the referenced band turns it into #REF!", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  // insertcol at col=1 offset=+1: A1 (col1) is >= col -> shifts to B1.
  expect(SC.AdjustFormulaCoords("A1", 1, 1, 999, 0)).toBe("B1");
  // deletecol col=2 offset=-1: B1 (col2) sits inside the deleted band [2,3) -> #REF!.
  expect(SC.AdjustFormulaCoords("B1", 2, -1, 999, 0)).toBe("#REF!");
  // A survives (col1 < deleted col2), B1 is deleted, C1 shifts left to B1.
  expect(SC.AdjustFormulaCoords("A1+B1+C1", 2, -1, 999, 0)).toBe("A1+#REF!+B1");
  // insertrow at row=999 offset=+1 shifts A1 -> A2; deleterow of row=2 turns A2 into #REF!.
  expect(SC.AdjustFormulaCoords("A1", 999, 0, 1, 1)).toBe("A2");
  expect(SC.AdjustFormulaCoords("A2", 999, 0, 2, -1)).toBe("#REF!");
});

test("AdjustFormulaCoords: structural insert/delete shifts the underlying coord even under $ markers — $ only survives cosmetically", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  // Unlike Offset (fill/copy), Adjust never checks the $ markers before
  // deciding whether to shift col/row — insertcol/insertrow/deletecol/
  // deleterow must move EVERY reference in the affected band, absolute or
  // not (Excel does the same: $A$1 still becomes $B$1 after inserting a
  // column before A). The $ markers are re-applied to the new coordinate
  // text, purely cosmetic.
  const result = SC.AdjustFormulaCoords("$A$1+A$1+$A1", 1, 1, 999, 0);
  expect(result).toBe("$B$1+B$1+$B1");
});

test("AdjustFormulaCoords: sheet-qualified refs are never adjusted, but the same coord unqualified still shifts", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const result = SC.AdjustFormulaCoords("Sheet1!A1:B1+A1", 1, 1, 999, 0);
  // Sheet1!A1:B1 is sheet-qualified via '!' and stays sticky through ':' (not reset) -> unchanged.
  // The trailing bare A1 is not sheet-qualified -> shifts to B1.
  expect(result).toBe("SHEET1!A1:B1+B1");
});

test("ReplaceFormulaCoords rewrites range endpoints independently and copies absolute markers onto the replacement", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.ReplaceFormulaCoords("SUM(A1:B2)", { A1: "C3" })).toBe("SUM(C3:B2)");
  // $A$1 -> B2 keeps both $ markers on the new coord.
  expect(SC.ReplaceFormulaCoords("$A$1", { A1: "B2" })).toBe("$B$2");
  // A coord absent from movedto is left untouched.
  expect(SC.ReplaceFormulaCoords("A1+Z9", { A1: "C3" })).toBe("C3+Z9");
});

test("ReplaceFormulaCoords never remaps sheet-qualified refs, and ':' does not reset sheetref", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const result = SC.ReplaceFormulaCoords("Sheet1!A1:B1+A1", { A1: "C3" });
  // Sheet1!A1:B1 is sheet-qualified through the colon -> untouched.
  // Trailing bare A1 -> remapped to C3.
  expect(result).toBe("SHEET1!A1:B1+C3");
});

// ===========================================================================
// formula-parse.ts: lexer state machine, shunting-yard, LookupResultType
// ===========================================================================

test("lexer: exponent forms — signed exponents, repeated E is tolerated, invalid exponent char errors", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const toks = (f: string) => SC.Formula.ParseFormulaIntoTokens(f).map((t) => t.text);
  expect(toks("1e2")).toEqual(["1e2"]);
  expect(toks("1e+2")).toEqual(["1e+2"]);
  expect(toks("1e-2")).toEqual(["1e-2"]);
  expect(toks("1eE2")).toEqual(["1e2"]); // repeated E tolerated, folded away
  expect(toks("1eQ")).toEqual([SC.Constants.s_parseerrexponent, "Q"]);
});

test("lexer: alpha/coord/alphanumeric state transitions and illegal-character errors", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const toks = (f: string) => SC.Formula.ParseFormulaIntoTokens(f).map((t) => t.text);
  expect(toks("FOO@")).toEqual([SC.Constants.s_parseerrchar, SC.Constants.s_parseerrchar]);
  expect(toks("A$1")).toEqual(["A$1"]); // alpha -> incoord -> coord
  expect(toks("A1@")).toEqual([SC.Constants.s_parseerrchar, SC.Constants.s_parseerrchar]);
  expect(toks("A1B")).toEqual(["A1B"]); // coord -> alpha -> alphanumeric -> name (not coord)
  expect(toks("AAA1")).toEqual(["AAA1"]); // still parses as a name token, regex rejects >2 letters
});

test("lexer: doubled quotes, unterminated string, and special-value literals", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const toks = (f: string) => SC.Formula.ParseFormulaIntoTokens(f);
  expect(toks('"a""b"').map((t) => t.text)).toEqual(['a"b']);
  expect(toks('"open').map((t) => t.type)).toEqual([SC.Formula.TokenType.error]);
  expect(toks("#REF!+1").map((t) => t.text)).toEqual(["#REF!", "+", "1"]);
  expect(toks("#N/A+1").map((t) => t.text)).toEqual(["#N/A", "+", "1"]);
  expect(toks("#BAD").map((t) => t.text)).toEqual([SC.Constants.s_parseerrspecialvalue]);
});

test("lexer: SUM() null arg list is not an error, and two consecutive binary ops are", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const toks = (f: string) => SC.Formula.ParseFormulaIntoTokens(f);
  expect(toks("SUM()").map((t) => t.type)).toEqual([
    SC.Formula.TokenType.name,
    SC.Formula.TokenType.op,
    SC.Formula.TokenType.op,
  ]);
  expect(toks("1**2").map((t) => t.type)).toEqual([
    SC.Formula.TokenType.num,
    SC.Formula.TokenType.op,
    SC.Formula.TokenType.error,
    SC.Formula.TokenType.num,
  ]);
  expect(toks("1><2").map((t) => t.type)).toEqual([
    SC.Formula.TokenType.num,
    SC.Formula.TokenType.op,
    SC.Formula.TokenType.error,
    SC.Formula.TokenType.num,
  ]);
});

test("ConvertInfixToPolish: ^ is LEFT-associative in this engine, but unary minus still binds tighter than ^", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const polish = (f: string) => SC.Formula.ConvertInfixToPolish(SC.Formula.ParseFormulaIntoTokens(f));
  // 2^3^2 evaluates as (2^3)^2=64, not 2^(3^2)=512 — verified against
  // TokenPrecedence directly, not by re-deriving the RPN by hand: ^ has no
  // negative (right-assoc) precedence entry in FormulaMut.TokenPrecedence,
  // so the shunting-yard loop pops equal-precedence '^' left-to-right.
  expect(polish("2^3^2")).toEqual([0, 2, 1, 4, 3]);

  const { getDV } = await buildSheet(["set A1 formula 2^3^2", "set A2 formula (2^(3^2))", "set A3 formula -2^2"]);
  expect(getDV("A1")).toBe(64); // left-assoc: (2^3)^2
  expect(getDV("A2")).toBe(512); // explicit parens force the other grouping
  // Excel-style convention: unary minus binds tighter than ^ for the leading
  // sign, so -2^2 evaluates to (-2)^2 = 4, not -(2^2) = -4.
  expect(getDV("A3")).toBe(4);
});

test("ConvertInfixToPolish: comma without an open paren, close without open, and an unmatched open all produce distinct error strings", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const polish = (f: string) => SC.Formula.ConvertInfixToPolish(SC.Formula.ParseFormulaIntoTokens(f));
  // Each failure mode has its own named constant in SocialCalc.Constants —
  // assert against those directly rather than merely checking the three
  // strings differ from each other.
  expect(polish("1,2")).toBe(SC.Constants.s_parseerrmissingopenparen);
  expect(polish("SUM(1+2")).toBe(SC.Constants.s_parseerrmissingcloseparen);
  expect(polish("1+2)")).toBe(SC.Constants.s_parseerrcloseparennoopen);
});

test("LookupResultType: unknown left type, malformed table row, and missing pair all surface distinct internal errors", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  // type1 "x" is not in the table and its wildcard "x*" is also absent ->
  // the exact "missing from table" internal-error text, naming the wildcard key.
  const missing = SC.Formula.LookupResultType("x", "n", {});
  expect(missing).toBe("e#VALUE! (internal error, missing LookupResultType x*)");

  // type1 "n" IS in the table but its row string is malformed (no closing
  // "|" after the matched "|t:" prefix) -> the exact "incorrect" text,
  // echoing the malformed row verbatim for diagnosis.
  const malformedRow = SC.Formula.LookupResultType("n", "t", { n: "|t:1" });
  expect(malformedRow).toBe("e#VALUE! (internal error, incorrect LookupResultType |t:1)");

  // type1 "n" resolves via wildcard "n*", but type2 "z" matches neither the
  // exact "|z:" nor wildcard "|z*:" entries inside that row -> the generic
  // (non-internal) #VALUE! fallback.
  const noPairMatch = SC.Formula.LookupResultType("n", "z", { "n*": "|t:n|" });
  expect(noPairMatch).toBe("e#VALUE!");
});

test("ArrayValuesEqual: shallow strict equality, length mismatch, and no deep comparison of nested arrays", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.Formula.ArrayValuesEqual([1, 2], [1, 2])).toBe(true);
  expect(SC.Formula.ArrayValuesEqual([1, 2], [1, 3])).toBe(false);
  expect(SC.Formula.ArrayValuesEqual([1], [1, 2])).toBe(false); // length mismatch
  // Nested arrays are compared by reference (===), never element-by-element,
  // so two structurally-identical-but-distinct inner arrays are NOT equal.
  expect(SC.Formula.ArrayValuesEqual([[1]], [[1]])).toBe(false);
});

// ===========================================================================
// formula-operand.ts: operand stack coercion + sheet-qualified resolution
// ===========================================================================

test("OperandAsNumber: blank cell coerces to 0, error operand coerces to 0 while preserving its error type", async () => {
  const { getDV, getVT } = await buildSheet([
    "set B1 formula A1+1", // A1 never set -> blank -> 0
    "set B2 formula (1/0)+1", // left side is a #DIV/0! error operand
  ]);
  expect(getDV("B1")).toBe(1);
  expect(getVT("B2")).toBe("e#DIV/0!");
});

test("OperandAsText: numeric formats through display formatting, blank becomes empty text, error becomes empty text", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 5",
    'set B1 formula A1&"x"', // numeric -> text concat
    'set B2 formula C1&"x"', // C1 blank -> ""
    'set B3 formula (1/0)&"x"', // error -> "" but error type still wins
  ]);
  expect(getDV("B1")).toBe("5x");
  expect(getDV("B2")).toBe("x");
  expect(getVT("B3")).toBe("e#DIV/0!");
});

test("OperandValueAndType: sheet-qualified coord resolves through the cache; unavailable sheet is #REF!", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const other = freshSheet(SC);
  setCell(other, "A1", 99, "n");
  SC.Formula.AddSheetToCache("other", other.CreateSheetSave());

  const main = freshSheet(SC);
  const resolved = evalDirect(SC, main, "Other!A1+1", "X1");
  expect(resolved.value).toBe(100);

  const unresolved = evalDirect(SC, main, "Missing!A1", "X2");
  expect(unresolved.type).toBe("e#REF!");
  // Lexer uppercases the sheet name; OperandsAsCoordOnSheet concatenates
  // "<constant> <sheetname>" with a single space (formula-operand.ts:287).
  expect(unresolved.error).toBe(`${SC.Constants.s_sheetunavailable} MISSING`);
});

test("OperandAsCoord/OperandAsRange: real formulas that route through IoFunctions' coord/range argument coercion", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  setCell(sheet, "A2", "trigger-value", "t");
  setCell(sheet, "A1", 1, "n");
  setCell(sheet, "B1", 2, "n");
  // COPYVALUE's argdef is [4,12,15]: arg1 is coerced via OperandAsCoord
  // (wantedType&4), arg2 (a coord operand under a range|coord wanted type)
  // also routes through OperandAsCoord.
  const coordResult = evalDirect(SC, sheet, "COPYVALUE(A2,A3,5)", "C1");
  expect(coordResult.value).toBe("trigger-value");
  // COPYFORMULA's arg2 supplied as an actual range (B1:B2, type "range")
  // routes through OperandAsRange (wantedType&8) instead.
  const rangeResult = evalDirect(SC, sheet, "COPYFORMULA(A2,B1:B2,A1:A1)", "C2");
  expect(rangeResult.value).toBe("trigger-value");
});

test("OperandAsSheetName: numeric operand sets sheet-name-missing error but keeps the original type", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  const numeric = SC.Formula.OperandAsSheetName(sheet, [{ type: "n", value: 123 }]);
  expect(numeric.type).toBe("n"); // NOT rewritten to an error type
  expect(numeric.value).toBe("");
  expect(numeric.error).toBe(SC.Constants.s_calcerrsheetnamemissing);

  setCell(sheet, "B1", 5, "n");
  const coordToNumeric = SC.Formula.OperandAsSheetName(sheet, [{ type: "coord", value: "B1" }]);
  expect(coordToNumeric.type).toBe("n");
  expect(coordToNumeric.error).toBe(SC.Constants.s_calcerrsheetnamemissing);
});

test("OperandAsSheetName: coord resolving to text is a valid sheet-name source", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  setCell(sheet, "A1", "Other", "t");
  const resolved = SC.Formula.OperandAsSheetName(sheet, [{ type: "coord", value: "A1" }]);
  expect(resolved.type).toBe("t");
  expect(resolved.value).toBe("Other");
});

// ===========================================================================
// formula1.ts: evaluator, LookupName, ranges, database/lookup functions,
// I/O widget functions, sheet cache, TestCriteria
// ===========================================================================

test("LookupName: a circular self-referencing formula name resolves to a distinct #NAME? error, not infinite recursion", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  sheet.names.X = { desc: "", definition: "=X" };
  const result = evalDirect(SC, sheet, "X", "A1");
  expect(result.type).toBe("e#NAME?");
  // formula1.ts's circular-reference branch appends ' "<name>".' verbatim.
  expect(result.error).toBe(`${SC.Constants.s_circularnameref} "X".`);
});

test("LookupName: a name defined as a range expands through StepThroughRangeDown", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  setCell(sheet, "A1", 10, "n");
  setCell(sheet, "A2", 20, "n");
  sheet.names.RNG = { desc: "", definition: "A1:A2" };
  const result = evalDirect(SC, sheet, "SUM(RNG)", "B1");
  expect(result.value).toBe(30);
});

test("DecodeRangeParts: malformed input with no pipe delimiters, and an out-of-bounds column range, both return null", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  // No "|" delimiters at all: pos1=-1 means value1 spans the whole string
  // and value2 becomes "" — coordToCr("") -> col 0 -> out of bounds -> null.
  expect(SC.Formula.DecodeRangeParts(sheet, "A1")).toBeNull();
  // ZZZ1 overflows col to 0 (fails closed, per coordToCr's >702 guard).
  expect(SC.Formula.DecodeRangeParts(sheet, "ZZZ1|ZZZ2|0")).toBeNull();
});

test("StepThroughRangeDown: walks a 2x2 range in row-major order then returns undefined at exhaustion", async () => {
  const { getDV } = await buildSheet([
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
    "set C1 formula SUM(A1:B2)",
  ]);
  // SUM must visit all four cells (1+2+3+4=10), proving StepThroughRangeDown
  // walks the full rectangle rather than stopping early.
  expect(getDV("C1")).toBe(10);
});

test("TestCriteria: wildcard matching, ~-escaped literal wildcards mixed with real ones, and a null criteria always fails", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.Formula.TestCriteria("hello", "t", "*")).toBe(true); // bare "*" matches anything
  expect(SC.Formula.TestCriteria("hello", "t", "h*")).toBe(true);
  expect(SC.Formula.TestCriteria("world", "t", "h*")).toBe(false);
  // A criteria whose ONLY "*" is escaped ("~*") has no unescaped wildcard for
  // the detection regex to find, so it never enters wildcard mode at all —
  // it falls through to a literal startswith comparison against the raw
  // (still-tilde-containing) criteria text, which nothing matches here.
  expect(SC.Formula.TestCriteria("a*b", "t", "a~*b")).toBe(false);
  expect(SC.Formula.TestCriteria("axb", "t", "a~*b")).toBe(false);
  // With a genuine trailing bare "*" present too, wildcard mode DOES engage,
  // and the escaped "~*" becomes a literal '*' inside the resulting pattern:
  // "a~*b*c" requires literal "a*b", then anything, then literal "c".
  expect(SC.Formula.TestCriteria("a*bXc", "t", "a~*b*c")).toBe(true);
  expect(SC.Formula.TestCriteria("a*bc", "t", "a~*b*c")).toBe(true); // wildcard matches zero chars
  expect(SC.Formula.TestCriteria("aXbXc", "t", "a~*b*c")).toBe(false); // literal "a*b" required, "aXb" present
  expect(SC.Formula.TestCriteria(0, "n", null)).toBe(false); // null criteria (e.g. error operand) is always false
});

test("DGET returns #NUM! for multiple matches and #VALUE! for zero matches", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 text t Name",
    "set B1 text t Val",
    "set A2 text t x",
    "set B2 value n 1",
    "set A3 text t x",
    "set B3 value n 2",
    "set D1 text t Name",
    "set D2 text t x",
    'set E1 formula DGET(A1:B3,"Val",D1:D2)',
    "set F2 text t nomatch",
    'set F1 text t Name',
    'set G1 formula DGET(A1:B3,"Val",F1:F2)',
  ]);
  expect(getVT("E1")).toBe("e#NUM!"); // two rows match "x"
  expect(getVT("G1")).toBe("e#VALUE!"); // no rows match "nomatch"
  void getDV; // getDV unused in this scenario but kept for parity with buildSheet's contract
});

test("VLOOKUP: an exact-match miss is #N/A, an out-of-range result column is #REF!", async () => {
  const { getVT } = await buildSheet([
    "set A1 text t x",
    "set B1 value n 1",
    "set A2 text t y",
    "set B2 value n 2",
    'set C1 formula VLOOKUP("z",A1:B2,2,0)',
    'set C2 formula VLOOKUP("x",A1:B2,3,0)',
  ]);
  expect(getVT("C1")).toBe("e#N/A");
  expect(getVT("C2")).toBe("e#REF!");
});

test("INDEX with rownum 0 or colnum 0 returns the whole column/row as a range, not an error", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
    "set C1 formula SUM(INDEX(A1:B2,0,2))", // whole column 2 -> B1+B2
    "set C2 formula SUM(INDEX(A1:B2,2,0))", // whole row 2 -> A2+B2
  ]);
  expect(getDV("C1")).toBe(6);
  expect(getDV("C2")).toBe(7);
  void getVT;
});

test("sheet cache: FindInSheetCache is case-insensitive via NormalizeSheetName, and a miss sets waitingForLoading", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const other = freshSheet(SC);
  setCell(other, "A1", 7, "n");
  const added = SC.Formula.AddSheetToCache("Other", other.CreateSheetSave());
  // AddSheetToCache returns a parsed sheet object (with cells/attribs), not
  // merely a truthy sentinel. A mutation returning {} or a constant would
  // survive not.toBeNull() but fail this structural check.
  expect(added).not.toBeNull();
  expect("cells" in (added as object)).toBe(true);

  const found = SC.Formula.FindInSheetCache("OTHER");
  expect(found).toBe(added);

  const miss = SC.Formula.FindInSheetCache("DoesNotExist");
  expect(miss).toBeNull();
  // NormalizeSheetName has no registered Callbacks override in this test
  // environment, so it's a plain lowercase — assert the literal directly
  // rather than re-deriving it through the same helper FindInSheetCache calls.
  expect(SC.Formula.SheetCache.waitingForLoading).toBe("doesnotexist");
});

test("OrderRangeParts normalizes reversed corners into upper-left/lower-right order", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  const result = SC.Formula.OrderRangeParts("B2", "A1");
  expect(result).toEqual({ c1: 1, r1: 1, c2: 2, r2: 2 });
});

test("IoFunctions: TEXTBOX/CHECKBOX/SUBMIT/BUTTON evaluate cleanly on a headless sheet and register ioParameterList", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);

  const textbox = evalDirect(SC, sheet, 'TEXTBOX("hi")', "A1");
  expect(textbox).toEqual({ value: "hi", type: "tiTEXTBOX" });

  const checkboxNumeric = evalDirect(SC, sheet, "CHECKBOX(1)", "A2");
  expect(checkboxNumeric).toEqual({ value: 1, type: "niCHECKBOX" });

  const checkboxText = evalDirect(SC, sheet, 'CHECKBOX("true")', "A3");
  expect(checkboxText).toEqual({ value: 1, type: "niCHECKBOX" });

  // SUBMIT() with genuinely zero arguments never populates ioParameterList:
  // StoreIoEventFormula clones `foperand` (already emptied by
  // CopyFunctionArgs) and early-returns on an empty operand array — so a
  // no-arg SUBMIT is evaluated but never registered as a widget.
  const submitBare = evalDirect(SC, sheet, "SUBMIT()", "A4");
  expect(submitBare).toEqual({ value: "Submit", type: "tiSUBMIT" });
  expect((sheet.ioParameterList as Record<string, unknown>).A4).toBeUndefined();
  // With an argument present, registration proceeds normally.
  const submitWithArg = evalDirect(SC, sheet, 'SUBMIT("go")', "A4b");
  expect(submitWithArg).toEqual({ value: "go", type: "tiSUBMIT" });

  const button = evalDirect(SC, sheet, 'BUTTON("Click")', "A5");
  expect(button).toEqual({ value: "Click", type: "tiBUTTON" });

  expect(Object.keys(sheet.ioParameterList as Record<string, unknown>).sort()).toEqual([
    "A1",
    "A2",
    "A3",
    "A4b",
    "A5",
  ]);
});

test("IoFunctions: STYLE on a coord with no prior registered widget falls back to e#VALUE!", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  // STYLE's own FunctionList entry has no io_parameters (index 6), so
  // StoreIoEventFormula never runs for it and sheet.ioParameterList["B1"]
  // is never populated by this call alone.
  const result = evalDirect(SC, sheet, 'STYLE("color:red")', "B1");
  expect(result.type).toBe("e#VALUE!");
});

test("IoFunctions: STYLE on a coord with a prior Input-class widget applies the css and returns a no-display type", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  evalDirect(SC, sheet, 'TEXTBOX("hi")', "B1"); // registers ioParameterList.B1 via StoreIoEventFormula
  const styled = evalDirect(SC, sheet, 'STYLE("color:red")', "B1");
  expect(styled.type).toBe("ni");
  expect(styled.value).toBe("");
  const parameters = (sheet.ioParameterList as Record<string, { css?: string }>).B1;
  expect(parameters?.css).toBe("color:red");
});

test("IoFunctions: COPYVALUE with an undefined trigger cell fails with FunctionArgsError, not a silent no-op", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  const result = evalDirect(SC, sheet, "COPYVALUE(NOPE,A3,5)", "A1");
  expect(result.type).toBe("e#VALUE!");
  // NOPE is an undefined name (type "name"), not a coord, so it fails
  // COPYVALUE's arg-1 coord-only type check and FunctionArgsError builds
  // this exact message (formula1.ts's s_calcerrincorrectargstofunction).
  expect(result.value).toBe(`${SC.Constants.s_calcerrincorrectargstofunction} COPYVALUE. `);
});

test("CopyValueToRange returns a 'set' command string encoding the source cell's value and type", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  setCell(sheet, "A1", 42, "n");
  const sourceData = SC.Formula.getStandardizedValues(sheet, { type: "coord", value: "A1" });
  const command = SC.TriggerIoAction.CopyValueToRange(sourceData, { col: 2, row: 1 });
  // cell.datatype "v" maps through Constants.cellDataType to the word "value".
  expect(command).toBe("set B1 value n 42");
});

test("IoFunctions: PANEL/SPLASH evaluate without a live app (SocialCalc._app is unset) and SPLASH is one-shot per sheet", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  const panel = evalDirect(SC, sheet, "PANEL(0,A1:A2)", "P1");
  expect(panel).toEqual({ value: "PANEL:0", type: "t" });

  const splashFirst = evalDirect(SC, sheet, "SPLASH(A1:A2)", "S1");
  expect(splashFirst.value).toBe("SPLASH:A1|A2|");
  expect(sheet.splashdone).toBe(true);

  // Second SPLASH call on the same sheet still returns its computed text
  // (the "show once" gate only affects the live-app rendering branch, which
  // requires SocialCalc._app — absent here).
  const splashSecond = evalDirect(SC, sheet, "SPLASH(A1:A2)", "S1");
  expect(splashSecond.value).toBe("SPLASH:A1|A2|");
});

test("FunctionSpecificError/CheckForErrorValue: a financial function short-circuits on the first error operand", async () => {
  const { getVT } = await buildSheet([
    // SLN(cost, salvage, life): passing a #DIV/0! error as cost must
    // propagate as that same error via CheckForErrorValue, not silently
    // continue and produce NaN or a different error type.
    "set A1 formula SLN(1/0,100,5)",
  ]);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("CalculateFunction: a name defined with no arguments takes precedence over a same-named built-in function", async () => {
  const { getDV } = await buildSheet([
    "set B1 value n 42",
    "name define SUM B1", // definition is a coord, not a formula
    "set A1 formula SUM",
    "set A2 formula SUM(1,2,3)", // parenthesized call is unaffected — still the builtin
  ]);
  // Bare "SUM" (zero args, no parens) resolves as the user-defined name
  // before FunctionList's SUM is even consulted.
  expect(getDV("A1")).toBe(42);
  expect(getDV("A2")).toBe(6);
});

test("FillFunctionInfo is idempotent and FunctionArgString reports fixed, variable, and named-defined arg shapes", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  SC.Formula.FunctionClasses = null;
  SC.Formula.FillFunctionInfo();
  const firstPass = SC.Formula.FunctionArgString("SUM");
  SC.Formula.FillFunctionInfo(); // second call must not throw or duplicate entries
  const secondPass = SC.Formula.FunctionArgString("SUM");
  expect(firstPass).toBe(secondPass);
  // NOW's FunctionList entry has nargs=0 and no arg_def, so the 0-arg
  // branch sets adef to a single space and FunctionArgDefs never gets an
  // entry for "" (NOW's falsy arg_def), leaving the space unresolved.
  expect(SC.Formula.FunctionArgString("NOW")).toBe(" ");
});

// ===========================================================================
// formatnumber2.ts: bracket format commands, date/elapsed-time rendering
// ===========================================================================

test("format: currency bracket with an explicit symbol, an empty bracket, and an unknown bracket copied literally", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display(12, "n", "[$£]#,##0")).toBe("£12");
  expect(SC.format_number_for_display(12, "n", "[$]#,##0")).toBe("$12");
  expect(SC.format_number_for_display(12, "n", "[foo]0")).toBe("[foo]12");
});

test("format: [Red] color bracket and [style=...] both wrap the rendered value in a styled span", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display(12, "n", "[Red]0")).toBe(
    '<span style="color:#FF0000;">12</span>',
  );
  expect(SC.format_number_for_display(12, "n", "[style=font-weight:bold]0")).toBe(
    '<span style="font-weight:bold;">12</span>',
  );
});

test("format: explicit [,] separator bracket and comparison-section selection", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display(1234, "n", "[,]0")).toBe("1,234");
  // Neither comparison section matches 5 -> falls back to General.
  expect(SC.format_number_for_display(5, "n", "[>10]0;[<0]0;0")).toBe("5");
  // -5 matches the second section's "<0" comparison -> quoted text "neg".
  expect(SC.format_number_for_display(-5, "n", '[>=0]"ok";[<0]"neg"')).toBe("neg");
});

test("format: elapsed-time brackets [H]/[m]/[ss] accumulate beyond a single day instead of wrapping", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  // 1.5 serial days = 36 elapsed hours / 2160 elapsed minutes / 129600 elapsed seconds.
  expect(SC.format_number_for_display(1.5, "nt", "[H]:mm:ss")).toBe("36:00:00");
  expect(SC.format_number_for_display(1.5, "nt", "[m]")).toBe("2160");
  expect(SC.format_number_for_display(1.5, "nt", "[ss]")).toBe("129600");
});

test("format: AM/PM token flips at noon and zero-pads minutes", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display(0.5, "nt", "h:mm AM/PM")).toBe("0:00 PM");
  expect(SC.format_number_for_display(0.25, "nt", "h:mm AM/PM")).toBe("6:00 AM");
});

test("format: sub-cent rounding suppresses a negative sign, but an explicit negative section still applies parentheses", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  // -0.004 rounds to 0.00 under two decimal places; the sign must not survive rounding to zero.
  expect(SC.format_number_for_display(-0.004, "n", "0.00")).toBe("0.00");
  expect(SC.format_number_for_display(-42.5, "n", "0.0;(0.0)")).toBe("(42.5)");
});

test("format: percent scaling rounds correctly, and a percent format on a huge value preserves scientific notation with the trailing %", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display(0.125, "n", "0.00%")).toBe("12.50%");
  expect(SC.format_number_for_display(1e19, "n", "0%")).toBe("1e+21%");
  expect(SC.format_number_for_display(-1e19, "n", "0%")).toBe("-1e+21%");
});

test("format: a literal 'E+00' scientific-looking format is NOT computed as an exponent — placeholders render literally", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display(12, "n", "0.00E+00")).toBe("12.00E+00");
});

test("format: a non-numeric text value under a numeric format renders as empty string, and '@' substitutes the original text", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display("abc", "n", "0.00")).toBe("");
  expect(SC.format_number_for_display("abc", "n", "@")).toBe("abc");
});

test("format: a three-section format routes zero to the third (text) section, distinct from positive/negative", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  expect(SC.format_number_for_display(0, "n", '0.00;0.00;"zero"')).toBe("zero");
  expect(SC.format_number_for_display(5, "n", '0.00;0.00;"zero"')).toBe("5.00");
  expect(SC.format_number_for_display(-5, "n", '0.00;0.00;"zero"')).toBe("5.00");
});

// ===========================================================================
// Gap A: CopyFormulaToRange / CopyValueToRange 2×2 source range
// Kills formula1.ts L6029 (destcr.col+i/-i) and L6098 (destcr.col+i/-i)
// ArithmeticOperator mutants 5374/5375 and 5431/5432.
//
// All existing tests only use a 1-column source so i is always 0, making
// +i and -i indistinguishable.  A 2×2 source (ncols=2, nrows=2) drives
// i∈{0,1} and j∈{0,1}, producing four distinct destination coords whose
// exact addresses verify the + direction is used (not -).
// ===========================================================================

test("CopyFormulaToRange: 2×2 source maps all four destination coords with correct +i/+j offsets", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  // Source range A1:B2  (col 1-2, row 1-2)
  // A1 = formula "C3"  (formula-type cell)
  // A2 = value 10      (value-type cell, datatype "v")
  // B1 = text "hello"  (text-type cell, datatype "t")
  // B2 = blank         (undefined/blank cell)
  const a1 = sheet.GetAssuredCell("A1") as unknown as {
    datatype: string; valuetype: string; datavalue: number | string; formula: string;
  };
  a1.datatype = "f"; a1.valuetype = "n"; a1.datavalue = 0; a1.formula = "C3";
  const a2 = sheet.GetAssuredCell("A2") as unknown as {
    datatype: string; valuetype: string; datavalue: number | string; formula: string;
  };
  a2.datatype = "v"; a2.valuetype = "n"; a2.datavalue = 10; a2.formula = "";
  const b1 = sheet.GetAssuredCell("B1") as unknown as {
    datatype: string; valuetype: string; datavalue: number | string; formula: string;
  };
  b1.datatype = "t"; b1.valuetype = "t"; b1.datavalue = "hello"; b1.formula = "";
  // B2 left blank/undefined

  // Build the formulaData by calling getStandardizedValues with a range parameter
  const formulaData = SC.Formula.getStandardizedValues(sheet, { type: "range", value: "A1|B2|" });
  // Destination upper-left: C1 (col=3, row=1)
  const destcr = { col: 3, row: 1 };

  const result = SC.TriggerIoAction.CopyFormulaToRange(formulaData, destcr);
  const lines = result.split("\n");

  // i=0,j=0 → dest col=3+0=3,row=1+0=1 → C1  (formula cell)
  // i=0,j=1 → dest col=3+0=3,row=1+1=2 → C2  (value cell)
  // i=1,j=0 → dest col=3+1=4,row=1+0=1 → D1  (text cell)
  // i=1,j=1 → dest col=3+1=4,row=1+1=2 → D2  (blank cell → "set D2 empty")
  // With +i: C1/C2/D1/D2. With -i: C1/C2/B1/B2 — would be wrong (B already occupied by source).
  expect(lines).toHaveLength(4);
  expect(lines[0]).toMatch(/^set C1 /);   // i=0,j=0
  expect(lines[1]).toMatch(/^set C2 /);   // i=0,j=1
  expect(lines[2]).toMatch(/^set D1 /);   // i=1,j=0  — proves +i (not -i → B1)
  expect(lines[3]).toMatch(/^set D2 /);   // i=1,j=1  — proves +i AND +j
  // C1 is a formula cell: command contains "formula" and the offset formula string
  expect(lines[0]).toMatch(/formula/);
  // C2 is a value cell: "set C2 value n 10"
  expect(lines[1]).toBe("set C2 value n 10");
  // D1 is a text cell: "set D1 text t hello"
  expect(lines[2]).toBe("set D1 text t hello");
  // D2 is blank: "set D2 empty"
  expect(lines[3]).toBe("set D2 empty");
});

test("CopyValueToRange: 2×2 source maps all four destination coords with correct +i/+j offsets", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  resetFormulaGlobals(SC);
  const sheet = freshSheet(SC);
  // Source range A1:B2  (col 1-2, row 1-2)
  // A1 = value 1, A2 = value 2, B1 = value 3, B2 = blank
  const vals: [string, number][] = [["A1", 1], ["A2", 2], ["B1", 3]];
  for (const [coord, v] of vals) {
    const c = sheet.GetAssuredCell(coord) as unknown as {
      datatype: string; valuetype: string; datavalue: number; formula: string;
    };
    c.datatype = "v"; c.valuetype = "n"; c.datavalue = v; c.formula = "";
  }
  // B2 left blank

  const sourceData = SC.Formula.getStandardizedValues(sheet, { type: "range", value: "A1|B2|" });
  // Destination: C1 (col=3, row=1)
  const destcr = { col: 3, row: 1 };

  const result = SC.TriggerIoAction.CopyValueToRange(sourceData, destcr);
  const lines = result.split("\n");

  // i=0,j=0 → C1; i=0,j=1 → C2; i=1,j=0 → D1; i=1,j=1 → D2
  // With -i: would land at C1,C2,B1,B2 — overwriting source! +i → C1,C2,D1,D2.
  expect(lines).toHaveLength(4);
  expect(lines[0]).toMatch(/^set C1 /);
  expect(lines[1]).toMatch(/^set C2 /);
  expect(lines[2]).toMatch(/^set D1 /);   // proves +i
  expect(lines[3]).toMatch(/^set D2 /);   // proves +i AND +j
  expect(lines[0]).toBe("set C1 value n 1");
  expect(lines[1]).toBe("set C2 value n 2");
  expect(lines[2]).toBe("set D1 value n 3");
  expect(lines[3]).toBe("set D2 empty");
});

// ===========================================================================
// Gap B: TestCriteria L6960 — blank type + '=' comparator returns true
// Kills formula1.ts L6960 ConditionalExpression/LogicalOperator/MethodExpression
// mutants 6050/6052/6053/6055/6057.
//
// The existing TestCriteria test only covers wildcard matching and a null
// criteria, never blank type with '=' comparator.  Five distinct mutants
// at L6960 all leave this unobserved:
//   6050: whole condition → true (branch fires even for non-blank-non-= pairs)
//   6052: && → || (fires whenever type='b' OR comparitor='=' independently)
//   6053: type.charAt(0)=='b' → true (any comparitor would pass)
//   6055: type.charAt(0) → type (whole type string vs 'b', breaks multi-char types)
//   6057: comparitor=='=' → true (fires even with comparitor='<>')
// Control tests with wrong type or wrong comparitor must both return false.
// ===========================================================================

test("TestCriteria: blank type + '=' comparator returns true; controls prove the && (not ||)", async () => {
  const SC = (await loadSocialCalc()) as FullRuntime;
  // --- The target branch: blank cell compared with '=' criteria ---
  // type 'b' AND comparitor '=' → true (empty equals empty)
  expect(SC.Formula.TestCriteria("", "b", "=")).toBe(true);
  // --- Kill mutant 6052 (|| instead of &&): wrong type, correct comparitor → must be false ---
  // type 'n' (number), comparitor '=': base value is empty string → no criteria base value,
  // comparitor is '=', but type is not 'b' → must return false
  expect(SC.Formula.TestCriteria(0, "n", "=")).toBe(false);
  // --- Kill mutant 6053 (type.charAt(0)=='b' → true): correct type, wrong comparitor → false ---
  // type 'b', comparitor '<>' (not-equal): blank does NOT equal empty with '<>' → false
  expect(SC.Formula.TestCriteria("", "b", "<>")).toBe(false);
  // --- Kill mutant 6055 (type.charAt(0) → type): multi-char type starting with 'b' still matches ---
  // Original uses type.charAt(0)=='b', so type 'bx' still returns true.
  // Mutant compares whole type string: 'bx'=='b' is false → would return false.
  expect(SC.Formula.TestCriteria("", "bx", "=")).toBe(true);
  // Additional control: type starts with 'n' (number cell), comparitor '=', blank value → false
  expect(SC.Formula.TestCriteria("", "nt", "=")).toBe(false);
  // --- Kill mutant 6057 (comparitor=='=' → true): blank type with non-= comparitor → false ---
  expect(SC.Formula.TestCriteria("", "b", "<")).toBe(false);
  expect(SC.Formula.TestCriteria("", "b", ">")).toBe(false);
});

test("COUNTIF with '=' criteria counts exactly the blank cells in a range", async () => {
  // End-to-end kill of the blank-equals-empty branch via the full formula evaluator.
  // A1=10 (non-blank), A2=blank (never set), A3=blank (never set).
  // COUNTIF(A1:A3,"=") should return 2 (A2 and A3 are blank, matching criteria "=").
  const { getDV } = await buildSheet([
    "set A1 value n 10",
    // A2 and A3 intentionally left blank
    'set B1 formula COUNTIF(A1:A3,"=")',
  ]);
  expect(getDV("B1")).toBe(2);
});
