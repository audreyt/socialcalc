import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

type Cell = { datavalue: unknown; valuetype: string };

function resetFormulaGlobals(SC: typeof SocialCalc) {
  if (SC.RecalcInfo) {
    SC.RecalcInfo.LoadSheet = () => false;
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
    if (SC.RecalcInfo.recalctimer) {
      clearTimeout(SC.RecalcInfo.recalctimer);
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

// ---------------------------------------------------------------------------
// formula-parse.ts (dist 14919-15279)
// ---------------------------------------------------------------------------

describe("formula-parse.ts coverage gaps", () => {
  test("ConvertInfixToPolish: unary M after low-precedence op hits tstackprecedence>=0 and tprecedence>tstackprecedence", async () => {
    const SC = await loadSocialCalc();
    // Formula "Sheet1!-A1" produces tokens: SHEET1(name), !(op), M(op), A1(coord).
    // In ConvertInfixToPolish, when M is processed, the stack top is "!" (precedence 1).
    // tprecedence = -3 (M), tstackprecedence = 1 (!) → tstackprecedence < 0 is false,
    // then tprecedence(abs=3) > tstackprecedence(1) → doesn't break, pops "!".
    const tokens = SC.Formula.ParseFormulaIntoTokens("Sheet1!-A1");
    const result = SC.Formula.ConvertInfixToPolish(tokens);
    // Even if evaluation would error, ConvertInfixToPolish should return an array.
    expect(Array.isArray(result)).toBe(true);
  });

  test("ConvertInfixToPolish: space token continue branch (dead code — lexer never emits space tokens)", async () => {
    const SC = await loadSocialCalc();
    // The lexer has its space-token push commented out, so ParseFormulaIntoTokens
    // never produces a tokentype.space token. ConvertInfixToPolish handles it
    // (the `continue` branch) but it's unreachable via the normal pipeline.
    // Call ConvertInfixToPolish directly with a synthetic space token to cover
    // the branch — this is a public API that accepts a token array.
    const tokens = SC.Formula.ParseFormulaIntoTokens("1+2");
    // Insert a space token (type 7 = tokentype.space) between the operands.
    const spaceToken = { type: SC.Formula.TokenType.space, text: " ", opcode: 0 };
    const withSpace = [tokens[0], spaceToken, ...tokens.slice(1)];
    const result = SC.Formula.ConvertInfixToPolish(withSpace);
    expect(Array.isArray(result)).toBe(true);
    // The space token (index 1) should be skipped via `continue`, so it
    // should not appear in the RPN output indices.
    const rpn = result as number[];
    expect(rpn).not.toContain(1);
  });

  test("LookupResultType: pos2<0 on exact match (malformed table without closing pipe)", async () => {
    const SC = await loadSocialCalc();
    // Table has "|t:1" but no second "|" — pos2 = indexOf("|", 3) = -1.
    const result = SC.Formula.LookupResultType("n", "t", { n: "|t:1" });
    expect(result).toContain("incorrect LookupResultType");
  });

  test("LookupResultType: pos2<0 on wildcard match (malformed table without closing pipe)", async () => {
    const SC = await loadSocialCalc();
    // Table has "|t*:1" but no second "|" — pos2 = indexOf("|", 5) = -1.
    const result = SC.Formula.LookupResultType("n", "t", { n: "|t*:1" });
    expect(result).toContain("incorrect LookupResultType");
  });

  test("ConvertInfixToPolish: unknown token type falls through all branches to else of tokentype.error", async () => {
    const SC = await loadSocialCalc();
    // TokenType values: num=1, coord=2, op=3, name=4, error=5, string=6, space=7.
    // A token with type 0 (or any unrecognized type) falls through all
    // if/else-if checks in ConvertInfixToPolish, hitting the implicit else
    // of the final `else if (ttype == tokentype.error)` branch.
    const tokens = SC.Formula.ParseFormulaIntoTokens("1+2");
    const unknownToken = { type: 0, text: "?", opcode: 0 };
    const withUnknown = [...tokens, unknownToken];
    const result = SC.Formula.ConvertInfixToPolish(withUnknown);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formula-operand.ts (dist 15280-15555)
// ---------------------------------------------------------------------------

describe("formula-operand.ts coverage gaps", () => {
  test("OperandValueAndType: cell with falsy valuetype falls through to 'b'", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    // Create a cell with valuetype = "" (falsy) via the set command.
    // "set A1 value t " → vtype="t", vrest="" → DetermineValueType("") → type ""
    // → cell.valuetype = "" (falsy), cell.datatype = "c".
    await scheduleCommands(SC, sheet, ["set A1 value t "], true, 4000);
    const a1 = sheet.GetAssuredCell("A1") as Cell;
    expect(a1.valuetype).toBe("");
    // Now evaluate a formula that references A1 — OperandValueAndType
    // finds the cell, cellvtype = "" (falsy), result.type = cellvtype || "b" → "b".
    const parsed = SC.Formula.ParseFormulaIntoTokens("A1+1");
    const result = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
    // Blank cell + 1 = 1 (type n).
    expect(result.type).toBe("n");
    expect(result.value).toBe(1);
  });

  test("OperandsAsCoordOnSheet: sheetname with error but non-error type (number as sheet name)", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    // Formula "123!A1" → tokens: 123(num), !(op), A1(coord).
    // When "!" is evaluated, OperandsAsCoordOnSheet is called.
    // OperandAsSheetName pops 123 (type "n"), not name/e/coord/t → else branch:
    //   result.error = s_calcerrsheetnamemissing, type stays "n".
    // Back in OperandsAsCoordOnSheet: sheetname.type.charAt(0)=="e"? No ("n").
    //   sheetname.error truthy → enters outer if.
    //   Inner if false → else: result.type = "e#REF!", result.value = 0.
    //   Then sheetname.error truthy → result.error = sheetname.error.
    const parsed = SC.Formula.ParseFormulaIntoTokens("123!A1");
    const result = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
    expect(result.type.charAt(0)).toBe("e");
  });

  test("OperandsAsCoordOnSheet: sheetname with error type but no error field (SpecialConstant)", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    // Formula "#NULL!!A1" → tokens: #NULL!(name), !(op), A1(coord).
    // When "!" is evaluated, OperandsAsCoordOnSheet is called.
    // OperandAsSheetName pops #NULL! (type "name"), calls LookupName.
    // LookupName finds #NULL! in SpecialConstants → returns {value:0, type:"e#NULL!"}
    //   without error field. OperandAsSheetName returns {value:0, type:"e#NULL!"}.
    // Back in OperandsAsCoordOnSheet: sheetname.type.charAt(0)=="e" → true.
    //   sheetname.error is falsy → outer if entered via type=="e".
    //   Inner if true → result.type = "e#NULL!", result.value = 0.
    //   Then if (sheetname.error) → false → branch 3041[1] covered.
    const parsed = SC.Formula.ParseFormulaIntoTokens("#NULL!!A1");
    const result = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
    expect(result.type.charAt(0)).toBe("e");
  });

  test("OperandsAsRangeOnSheet: coord value with pipe after sheet ref hits pos2>=0 branch", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    // OperandsAsRangeOnSheet is called when evaluating a range (colon operator).
    // It pops the right operand, then calls OperandAsCoord for the left.
    // If the left coord value contains "|" after "!", pos2 = indexOf("|", pos1+1)
    // returns >= 0, hitting the else branch of `if (pos2 < 0)`.
    // Normal coords never contain "|" after "!", so call the function directly
    // with a synthetic operand stack.
    const operand = [
      { type: "coord", value: "Sheet1!A1|extra|", opcode: 0 },
      { type: "coord", value: "B1", opcode: 0 },
    ];
    const result = SC.Formula.OperandsAsRangeOnSheet(sheet, operand);
    // FindInSheetCache("A1|extra") → null → returns e#REF! error.
    expect(result.type.charAt(0)).toBe("e");
  });

  test("OperandAsNumber: falls back to plain Number() when SocialCalc.DetermineValueType is missing", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    const mutableSC = SC as unknown as { DetermineValueType?: unknown };
    const saved = mutableSC.DetermineValueType;
    delete mutableSC.DetermineValueType;
    try {
      const result = SC.Formula.OperandAsNumber(sheet, [{ type: "t", value: "hello" }]);
      // Fallback is `{ value: value-0, type: "n" }` — always type "n",
      // unlike the real DetermineValueType which would classify
      // "hello" as e#VALUE!.
      expect(result.type).toBe("n");
      expect(Number.isNaN(result.value as number)).toBe(true);
    } finally {
      mutableSC.DetermineValueType = saved;
    }
  });

  test("OperandAsText: falls back to string concatenation when SocialCalc.format_number_for_display is missing", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    const mutableSC = SC as unknown as { format_number_for_display?: unknown };
    const saved = mutableSC.format_number_for_display;
    delete mutableSC.format_number_for_display;
    try {
      const result = SC.Formula.OperandAsText(sheet, [{ type: "n", value: 42 }]);
      expect(result.type).toBe("t");
      expect(result.value).toBe("42");
    } finally {
      mutableSC.format_number_for_display = saved;
    }
  });

  test("OperandAsNumber: DetermineValueType classifies text as an error constant", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    // "#REF!" is a recognized SC.InputConstants entry that DetermineValueType
    // maps to type "e#REF!" — an error type, not "n" — so the else-branch's
    // nested ternary must pick `valueinfo.type` (not the "e#VALUE!" default).
    const result = SC.Formula.OperandAsNumber(sheet, [{ type: "t", value: "#REF!" }]);
    expect(result.type).toBe("e#REF!");
    expect(result.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formula-ref.ts (dist 15556-15864)
// ---------------------------------------------------------------------------

describe("formula-ref.ts coverage gaps", () => {
  test("coordToCr: lowercase letters hit ch>=97 branch", async () => {
    const SC = await loadSocialCalc();
    // The lexer uppercases all coords, so coordToCr normally receives
    // uppercase. Call directly with lowercase to hit the ch>=97 branch.
    const result = SC.coordToCr("a1");
    expect(result).toEqual({ col: 1, row: 1 });
    // Also test with $ markers and lowercase.
    const result2 = SC.coordToCr("$b$3");
    // $b$3 is uppercase-equivalent: B=2, row=3.
    expect(result2).toEqual({ col: 2, row: 3 });
  });

  test("coordToCr: character in 58-64 range hits ch>=65 false branch", async () => {
    const SC = await loadSocialCalc();
    // Characters with codepoints 58-64 (: ; < = > ? @) are not $, not digits,
    // not lowercase, not uppercase. They fall through all branches in the
    // for loop. Call coordToCr with a string containing such a character.
    // ":" is charCode 58. "A1:B2" — but coordToCr is for single coords.
    // Use a string like "A@1" where @ is charCode 64.
    const result = SC.coordToCr("A@1");
    // A → c=1, @ → ignored (no branch matches), 1 → r=1.
    expect(result).toEqual({ col: 1, row: 1 });
  });

  test("OffsetFormulaCoords: band with startRow/endRow excludes coords outside row band", async () => {
    const SC = await loadSocialCalc();
    // OffsetFormulaCoords with a band that has startRow/endRow.
    // A coord whose row is outside the band should not be shifted.
    // Formula "A1+A5" with band {startCol:1, endCol:1, startRow:2, endRow:4}.
    // A1 (row 1 < startRow 2) → shiftCol=false, shiftRow=false → stays A1.
    // A5 (row 5 > endRow 4) → shiftCol=false, shiftRow=false → stays A5.
    const result = SC.OffsetFormulaCoords("A1+A5", 1, 1, {
      startCol: 1,
      endCol: 1,
      startRow: 2,
      endRow: 4,
    });
    // A1 and A5 are outside the row band → not shifted.
    expect(result).toBe("A1+A5");
    // Verify a coord inside the band IS shifted.
    const result2 = SC.OffsetFormulaCoords("A2+A4", 1, 1, {
      startCol: 1,
      endCol: 1,
      startRow: 2,
      endRow: 4,
    });
    // A2 (row 2, in band) → shifted to B3. A4 (row 4, in band) → shifted to B5.
    expect(result2).toBe("B3+B5");
  });
});
