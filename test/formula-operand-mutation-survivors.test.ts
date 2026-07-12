// Mutation-testing kill tests for js/formula-operand.ts survivors.
//
// Each test below targets one or more Stryker survivors from the critical
// mutation run against js/formula-operand.ts (the pure operand-stack
// coercion helpers). Tests call the helpers directly via SC.Formula.<name>
// with hand-built operand stacks, following the convention in
// test/formula-coverage.test.ts. No shipping source is edited.

import { expect, test } from "vite-plus/test";

import type SCBundle from "../dist/SocialCalc.js";
import { loadSocialCalc } from "./helpers/socialcalc";

// The UMD bundle attaches SocialCalc to globalThis, so all loadSocialCalc
// calls share the same live object. Reset the bits of state that tests
// mutate so one test cannot poison the next.
function resetFormulaGlobals(SC: typeof SCBundle): void {
  if (SC.Formula) {
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;
    SC.Formula.FreshnessInfo.sheets = {};
    SC.Formula.FreshnessInfo.volatile = {};
  }
}

async function fresh(): Promise<{ SC: typeof SCBundle; sheet: SCBundle.Sheet }> {
  const SC = (await loadSocialCalc()) as typeof SCBundle;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  return { SC, sheet };
}

// ---------------------------------------------------------------------------
// OperandAsNumber (js/formula-operand.ts L61-L95)
// ---------------------------------------------------------------------------

test("id36/id37: falsy-DetermineValueType fallback coerces text '5' to n 5, not 50", async () => {
  const { SC, sheet } = await fresh();
  // The .d.ts declares DetermineValueType as a non-optional function, but
  // the runtime bundle exposes it as a mutable own property. Reflect.set
  // lets us temporarily undefine it to exercise the falsy ternary branch
  // at L82 without an unchecked cast in test code.
  const orig = SC.DetermineValueType;
  try {
    Reflect.set(SC, "DetermineValueType", undefined);
    const op: SocialCalc.FormulaOperand[] = [{ type: "t", value: "5" }];
    const r = SC.Formula.OperandAsNumber(sheet, op);
    // Original: { value: ("5" as number) - 0, type: "n" } => value 5.
    // id36 (ObjectLiteral -> {}) throws on valueinfo.type.charAt; id37
    // (-> +0) yields "50" - 0 = 50.
    expect(r.type).toBe("n");
    expect(r.value).toBe(5);
    expect(r.value).not.toBe(50);
  } finally {
    Reflect.set(SC, "DetermineValueType", orig);
  }
  expect(typeof SC.DetermineValueType).toBe("function");
});

test("id45: OperandAsNumber preserves negative zero from text '-0' (not +0)", async () => {
  const { SC, sheet } = await fresh();
  // DetermineValueType("-0") => { value: -0, type: "n" }; L84 then does
  // (valueinfo.value as number) - 0 = -0. id45 (-> +0) yields +0.
  const op: SocialCalc.FormulaOperand[] = [{ type: "t", value: "-0" }];
  const r = SC.Formula.OperandAsNumber(sheet, op);
  expect(r.type).toBe("n");
  expect(Object.is(r.value, -0)).toBe(true);
  expect(Object.is(r.value, 0)).toBe(false);
});

test("id48/id50: OperandAsNumber preserves error subtype e#N/A (not e#VALUE!)", async () => {
  const { SC, sheet } = await fresh();
  // DetermineValueType("#N/A") => { value: 0, type: "e#N/A" } via
  // InputConstants. L90 ternary keeps the original error type.
  // id48 (-> false) and id50 (-> valueinfo.type) both force e#VALUE!.
  const op: SocialCalc.FormulaOperand[] = [{ type: "t", value: "#N/A" }];
  const r = SC.Formula.OperandAsNumber(sheet, op);
  expect(r.type).toBe("e#N/A");
  expect(r.type).not.toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// OperandAsText (js/formula-operand.ts L99-L128)
// ---------------------------------------------------------------------------

test("id60: OperandAsText formats n% via format_number_for_display (not bare concat)", async () => {
  const { SC, sheet } = await fresh();
  // t == "n" branch calls format_number_for_display(value, "n%", "").
  // id60 (ConditionalExpression -> false) skips to the final else, which
  // does value + "" => "0.5" instead of "50.0%".
  const op: SocialCalc.FormulaOperand[] = [{ type: "n%", value: 0.5 }];
  const r = SC.Formula.OperandAsText(sheet, op);
  expect(r.type).toBe("t");
  expect(r.value).toBe("50.0%");
  expect(r.value).not.toBe("0.5");
});

// ---------------------------------------------------------------------------
// OperandValueAndType (js/formula-operand.ts L132-L195)
// ---------------------------------------------------------------------------

test("id123/id124: coord unknown-sheet error uses substring(pos+1), not full coordText", async () => {
  const { SC, sheet } = await fresh();
  // L173 builds the error from coordText.substring(pos + 1) — the sheet
  // name only. id123 (-> coordText) includes the whole "A1!NOSUCHSHEET";
  // id124 (-> pos - 1) includes "1!NOSUCHSHEET".
  const op: SocialCalc.FormulaOperand[] = [{ type: "coord", value: "A1!NOSUCHSHEET" }];
  const r = SC.Formula.OperandValueAndType(sheet, op);
  expect(r.type).toBe("e#REF!");
  expect(r.error).toBe("Sheet unavailable:" + " NOSUCHSHEET");
  expect(r.error).not.toContain("A1!");
  expect(r.value).toBe(0);
});

// ---------------------------------------------------------------------------
// OperandsAsCoordOnSheet (js/formula-operand.ts L252-L313)
// ---------------------------------------------------------------------------

test("id178/id179/id181/id192: sheetname error without .error field preserved, no error prop set", async () => {
  const { SC, sheet } = await fresh();
  // A direct error-typed sheetname operand (type starts with 'e', no
  // .error) must enter the L267 branch and preserve value/type without
  // setting result.error. id178 (|| -> &&), id179 (-> false), id181
  // (-> sheetname.type) skip the branch; id192 (-> true) sets
  // result.error = undefined as an own property.
  const op: SocialCalc.FormulaOperand[] = [
    { type: "e#REF!", value: "boom" },
    { type: "coord", value: "A1" },
  ];
  const r = SC.Formula.OperandsAsCoordOnSheet(sheet, op);
  expect(r.type).toBe("e#REF!");
  expect(r.value).toBe("boom");
  expect(Object.prototype.hasOwnProperty.call(r, "error")).toBe(false);
});

test("id184/id190/id193/id194: sheetname with error+non-e type routes to e#REF! else branch", async () => {
  const { SC, sheet } = await fresh();
  // coord "Z99" resolves via OperandAsSheetName to a missing cell =>
  // { type: "b", value: "", error: s_calcerrsheetnamemissing }. L267
  // enters via sheetname.error; L270 inner if is false (type 'b'), so
  // the else block (L273-L276) sets type e#REF!, value 0. id184 (-> true)
  // copies sheetname.type/value instead; id190 (-> {}) leaves them empty;
  // L277 sets result.error. id193 (-> false) / id194 (-> {}) drop it.
  const op: SocialCalc.FormulaOperand[] = [
    { type: "coord", value: "Z99" },
    { type: "coord", value: "A1" },
  ];
  const r = SC.Formula.OperandsAsCoordOnSheet(sheet, op);
  expect(r.type).toBe("e#REF!");
  expect(r.value).toBe(0);
  expect(r.error).toBe("Sheet name missing when expected.");
});

// ---------------------------------------------------------------------------
// OperandsAsRangeOnSheet (js/formula-operand.ts L317-L371)
// ---------------------------------------------------------------------------

test("id254: indexOf('|', pos1+1) vs pos1-1 changes sheet-name substring", async () => {
  const { SC, sheet } = await fresh();
  // leftCoord "A|!X": pos1=2 (the '!'). Original indexOf('|', 3) = -1 =>
  // pos2 = length = 4 => substring(3, 4) = "X". id254 (-> pos1-1=1) finds
  // '|' at 1 => pos2=1 => substring(3, 1) = "" (othersheet lookup of "" is
  // non-null for the live sheet, so no error). Asserting the unavailable-
  // sheet error with " X" kills id254.
  const op: SocialCalc.FormulaOperand[] = [
    { type: "coord", value: "A|!X" },
    { type: "coord", value: "B2" },
  ];
  const r = SC.Formula.OperandsAsRangeOnSheet(sheet, op);
  expect(r.type).toBe("e#REF!");
  expect(r.error).toBe("Sheet unavailable:" + " X");
});

test("id255/id268/id269: '|' after sheet name keeps pos2, substring(pos1+1,pos2) is sheet only", async () => {
  const { SC, sheet } = await fresh();
  // leftCoord "A1!X|Y": pos1=2, pos2=4 (the '|'). Original keeps pos2=4
  // (if pos2<0 is false) and substring(3, 4) = "X". id255 (-> true) resets
  // pos2=length=6 => substring(3,6)="X|Y"; id268 (-> leftCoord) uses the
  // whole coord in the error; id269 (-> pos1-1) substring(1,4)="1!X".
  const op: SocialCalc.FormulaOperand[] = [
    { type: "coord", value: "A1!X|Y" },
    { type: "coord", value: "B2" },
  ];
  const r = SC.Formula.OperandsAsRangeOnSheet(sheet, op);
  expect(r.type).toBe("e#REF!");
  expect(r.error).toBe("Sheet unavailable:" + " X");
});

// ---------------------------------------------------------------------------
// OperandAsSheetName (js/formula-operand.ts L375-L424)
// ---------------------------------------------------------------------------

test("id305: name resolving to coord follows through to cell text (not bare name)", async () => {
  const { SC, sheet } = await fresh();
  // name "SN" -> LookupName -> coord "A1" -> cell text "NAMED".
  // id305 (ConditionalExpression -> true) forces the e#NAME? early return,
  // leaving result as the bare { type: "name", value: "SN" }.
  sheet.names = { SN: { definition: "A1", desc: "" } };
  SC.SetConvertedCell(sheet, "A1", "NAMED");
  const op: SocialCalc.FormulaOperand[] = [{ type: "name", value: "SN" }];
  const r = SC.Formula.OperandAsSheetName(sheet, op);
  expect(r.type).toBe("t");
  expect(r.value).toBe("NAMED");
  expect(r.type).not.toBe("name");
});

test("id309: name resolving to plain text has no own error property", async () => {
  const { SC, sheet } = await fresh();
  // name "PLAIN" -> coord "A1" -> text "hello", nvalue.error falsy.
  // id309 (-> true) sets result.error = undefined as an own property.
  sheet.names = { PLAIN: { definition: "A1", desc: "" } };
  SC.SetConvertedCell(sheet, "A1", "hello");
  const op: SocialCalc.FormulaOperand[] = [{ type: "name", value: "PLAIN" }];
  const r = SC.Formula.OperandAsSheetName(sheet, op);
  expect(r.type).toBe("t");
  expect(r.value).toBe("hello");
  expect(Object.prototype.hasOwnProperty.call(r, "error")).toBe(false);
});

test("id310/id311: name resolving to #DIV/0! carries error string through", async () => {
  const { SC, sheet } = await fresh();
  // name "ERR" -> LookupName -> { value: 0, type: "e#DIV/0!", error: "#DIV/0!" }.
  // L397 if (nvalue.error) copies the error. id310 (-> false) and id311
  // (-> {}) both drop result.error.
  sheet.names = { ERR: { definition: "=1/0", desc: "" } };
  const op: SocialCalc.FormulaOperand[] = [{ type: "name", value: "ERR" }];
  const r = SC.Formula.OperandAsSheetName(sheet, op);
  expect(r.type).toBe("e#DIV/0!");
  expect(r.error).toBe("#DIV/0!");
});

test("id326: coord to missing cell yields type 'b' before final else", async () => {
  const { SC, sheet } = await fresh();
  // coord "Z99" -> no cell -> L411 else sets type "b", value "". Then
  // L416 charAt(0)=='t' is false => final else sets error. id326 (-> {})
  // leaves result.type as "coord", which the final else does not overwrite.
  const op: SocialCalc.FormulaOperand[] = [{ type: "coord", value: "Z99" }];
  const r = SC.Formula.OperandAsSheetName(sheet, op);
  expect(r.type).toBe("b");
  expect(r.value).toBe("");
  expect(r.error).toBe("Sheet name missing when expected.");
});

test("id332: text subtype 'th' passes via charAt(0), not exact type match", async () => {
  const { SC, sheet } = await fresh();
  // L416 checks result.type.charAt(0) == "t". id332 (-> result.type) requires
  // exact "t", so "th" falls to the final else and gets wiped.
  const op: SocialCalc.FormulaOperand[] = [{ type: "th", value: "<b>hi</b>" }];
  const r = SC.Formula.OperandAsSheetName(sheet, op);
  expect(r.type).toBe("th");
  expect(r.value).toBe("<b>hi</b>");
  expect(r.error).toBeUndefined();
});

// ---------------------------------------------------------------------------
// OperandAsSheetName: e#NAME? with non-empty value (id=305)
// ---------------------------------------------------------------------------
// Line 392: `nvalue.type == "e#NAME?" && nvalue.value === ""`.
// Mutating the second conjunct to `true` returns the bare name whenever
// LookupName reports e#NAME?, even if value is non-empty (a real error like
// a circular reference). A circular name definition makes LookupName
// return { type: "e#NAME?", value: "=CIRC", error: "..." } — value is the
// formula string, not "". The original overwrites result with the error;
// the mutant returns the bare name without error.
test("id305: circular name reference returns e#NAME? error, not bare name", async () => {
  const { SC, sheet } = await fresh();
  sheet.names = { CIRC: { definition: "=CIRC", desc: "" } };
  const op: SocialCalc.FormulaOperand[] = [{ type: "name", value: "CIRC" }];
  const r = SC.Formula.OperandAsSheetName(sheet, op);
  expect(r.type).toBe("e#NAME?");
  expect(r.type).not.toBe("name");
  expect(r.error).toBe('Circular name reference to name "CIRC".');
});


// ---------------------------------------------------------------------------
// Fresh no-exclusion survivors: observable defaults, coercions, and errors.
// ---------------------------------------------------------------------------

test("fresh id3/id8: empty TopOfStackValueAndType preserves blank type/value and error text", async () => {
  const { SC, sheet } = await fresh();
  const r = SC.Formula.TopOfStackValueAndType(sheet, []);
  expect(r).toMatchObject({ type: "", value: "" });
  expect(r.error).toBe(`${"Internal SocialCalc error (probably an internal bug): "}no operand on stack`);
});

test("fresh id86/id91: empty OperandValueAndType preserves blank type/value and error text", async () => {
  const { SC, sheet } = await fresh();
  const r = SC.Formula.OperandValueAndType(sheet, []);
  expect(r).toMatchObject({ type: "", value: "" });
  expect(r.error).toBe(`${"Internal SocialCalc error (probably an internal bug): "}no operand on stack`);
});

test("fresh id65: numeric OperandAsText fallback stringifies when formatter is absent", async () => {
  const { SC, sheet } = await fresh();
  const original = SC.format_number_for_display;
  try {
    Reflect.set(SC, "format_number_for_display", undefined);
    const r = SC.Formula.OperandAsText(sheet, [{ type: "n", value: 12.5 }]);
    expect(r).toEqual({ type: "t", value: "12.5" });
  } finally {
    Reflect.set(SC, "format_number_for_display", original);
  }
});

test("fresh id81: unknown OperandAsText type still stringifies the operand", async () => {
  const { SC, sheet } = await fresh();
  const r = SC.Formula.OperandAsText(sheet, [{ type: "x", value: 12.5 }]);
  expect(r).toEqual({ type: "t", value: "12.5" });
});

test("missing coord resolves to blank type rather than an empty type", async () => {
  const { SC, sheet } = await fresh();
  const r = SC.Formula.OperandValueAndType(sheet, [{ type: "coord", value: "A1" }]);
  expect(r).toMatchObject({ type: "b", value: 0 });
});

test("fresh id134: a cell with an empty valuetype still falls back to blank type 'b'", async () => {
  const { SC, sheet } = await fresh();
  // A directly-poked cell with valuetype "" is falsy but truthy `cell`, so
  // L182's `cellvtype = cell.valuetype` yields "" (not the L185 "b" default,
  // which only fires when `cell` itself is absent). That makes L187's
  // `cellvtype || "b"` fallback the ONLY place "b" can still come from,
  // isolating id134 (StringLiteral "b" -> "") from the already-equivalent
  // id130 (StringLiteral "b" -> "" on L185, unreachable there since a
  // present-but-blank-valuetype cell never executes L185 at all).
  sheet.cells["A1"] = { datavalue: "leftover", valuetype: "" } as SCBundle.Cell;
  const r = SC.Formula.OperandValueAndType(sheet, [{ type: "coord", value: "A1" }]);
  expect(r.type).toBe("b");
  expect(r.value).toBe(0);
});

test("fresh id200: unavailable sheet error includes the sheet name separator", async () => {
  const { SC, sheet } = await fresh();
  const r = SC.Formula.OperandsAsCoordOnSheet(sheet, [
    { type: "t", value: "MISSING" },
    { type: "coord", value: "A1" },
  ]);
  expect(r.type).toBe("e#REF!");
  expect(r.error).toBe(`${"Sheet unavailable:"} MISSING`);
});
