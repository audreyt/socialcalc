// Pure formula operand-stack helpers.
// Shipping source extracted from formula1 for full typecheck + LemmaScript.
// Concatenated after formula-parse (token helpers) and before formula-ref.
// Fully typechecked — no @ts-nocheck.
//
/*
// SocialCalc Formula Operand Helpers
// Part of the SocialCalc package.
// (c) Copyright 2008 Socialtext, Inc.
// Artistic License 2.0: http://socialcalc.org/licenses/al-20/
//
*/

// Methods assign onto SocialCalc.Formula created in formula1.ts.
type FormulaOperandMutable = Pick<
  typeof SocialCalc.Formula,
  | "TopOfStackValueAndType"
  | "OperandAsNumber"
  | "OperandAsText"
  | "OperandValueAndType"
  | "OperandAsCoord"
  | "OperandAsRange"
  | "OperandAsType"
  | "OperandsAsCoordOnSheet"
  | "OperandsAsRangeOnSheet"
  | "OperandAsSheetName"
>;
const FormulaOperandMut = SocialCalc.Formula as FormulaOperandMutable;

//@ verify
// LemmaScript: pure top-of-stack value/type peek (may resolve sheet coords).
FormulaOperandMut.TopOfStackValueAndType = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  var scf = SocialCalc.Formula;

  var result: SocialCalc.FormulaValueResult = { type: "", value: "" };

  var stacklen = operand.length;

  if (!stacklen) {
    // make sure something is there
    result.error = SocialCalc.Constants.s_InternalError + "no operand on stack";
    return result;
  }

  result.value = operand[stacklen - 1]!.value; // get top of stack
  result.type = operand[stacklen - 1]!.type;
  operand.pop(); // we have data - pop stack

  if (result.type == "name") {
    result = scf.LookupName(sheet, result.value as string);
  }

  return result;
};

//@ verify
// LemmaScript: coerce top operand to number (pure w.r.t. formula stack).
FormulaOperandMut.OperandAsNumber = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  var t, valueinfo;
  var operandinfo = SocialCalc.Formula.OperandValueAndType(sheet, operand);

  t = operandinfo.type.charAt(0);

  if (t == "n") {
    operandinfo.value = (operandinfo.value as number) - 0;
  } else if (t == "b") {
    // blank cell
    operandinfo.type = "n";
    operandinfo.value = 0;
  } else if (t == "e") {
    // error
    operandinfo.value = 0;
  } else {
    valueinfo = SocialCalc.DetermineValueType
      ? SocialCalc.DetermineValueType(operandinfo.value)
      : { value: (operandinfo.value as number) - 0, type: "n" }; // if without rest of SocialCalc
    if (valueinfo.type.charAt(0) == "n") {
      operandinfo.value = (valueinfo.value as number) - 0;
      operandinfo.type = valueinfo.type;
    } else {
      // Non-numeric text (including "") must not leave type "" — LookupResultType
      // has no "" key and would surface as an internal error type.
      operandinfo.value = 0;
      operandinfo.type = valueinfo.type.charAt(0) == "e" ? valueinfo.type : "e#VALUE!";
    }
  }

  return operandinfo;
};

//@ verify
// LemmaScript: coerce top operand to text.
FormulaOperandMut.OperandAsText = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  var t;
  var operandinfo = SocialCalc.Formula.OperandValueAndType(sheet, operand);

  t = operandinfo.type.charAt(0);

  if (t == "t") {
    // any flavor of text returns as is
  } else if (t == "n") {
    operandinfo.value = SocialCalc.format_number_for_display
      ? SocialCalc.format_number_for_display(operandinfo.value, operandinfo.type, "")
      : (operandinfo.value = operandinfo.value + "");
    operandinfo.type = "t";
  } else if (t == "b") {
    // blank
    operandinfo.value = "";
    operandinfo.type = "t";
  } else if (t == "e") {
    // error
    operandinfo.value = "";
  } else {
    operandinfo.value = operandinfo.value + "";
    operandinfo.type = "t";
  }

  return operandinfo;
};

//@ verify
// LemmaScript: pop operand and resolve value/type.
FormulaOperandMut.OperandValueAndType = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  var cellvtype, cell, pos, coordsheet;
  var scf = SocialCalc.Formula;

  var result: SocialCalc.FormulaValueResult = { type: "", value: "" };

  var stacklen = operand.length;

  if (!stacklen) {
    // make sure something is there
    result.error = SocialCalc.Constants.s_InternalError + "no operand on stack";
    return result;
  }

  result.value = operand[stacklen - 1]!.value; // get top of stack
  result.type = operand[stacklen - 1]!.type;
  operand.pop(); // we have data - pop stack

  if (result.type == "name") {
    result = scf.LookupName(sheet, result.value as string);
  }

  if (result.type == "range") {
    // Ambient return includes undefined; legacy path assigns directly when type is range.
    result = scf.StepThroughRangeDown(operand, result.value as string)!;
  }

  if (result.type == "coord") {
    // value is a coord reference
    coordsheet = sheet;
    const coordText = result.value as string;
    pos = coordText.indexOf("!");
    if (pos != -1) {
      // sheet reference
      coordsheet = scf.FindInSheetCache(coordText.substring(pos + 1)); // get other sheet
      if (coordsheet == null) {
        // unavailable
        result.type = "e#REF!";
        result.error = SocialCalc.Constants.s_sheetunavailable + " " + coordText.substring(pos + 1);
        result.value = 0;
        return result;
      }
      result.value = coordText.substring(0, pos); // get coord part
    }

    cell = coordsheet.cells[SocialCalc.Formula.PlainCoord(result.value as string)];
    if (cell) {
      cellvtype = cell.valuetype; // get type of value in the cell it points to
      result.value = cell.datavalue;
    } else {
      cellvtype = "b";
    }
    result.type = cellvtype || "b";
    if (result.type == "b") {
      // blank
      result.value = 0;
    }
  }

  return result;
};

//@ verify
// LemmaScript: require top operand to be a coord.
FormulaOperandMut.OperandAsCoord = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  return SocialCalc.Formula.OperandAsType(sheet, operand, "coord");
};

//@ verify
// LemmaScript: require top operand to be a range.
FormulaOperandMut.OperandAsRange = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  return SocialCalc.Formula.OperandAsType(sheet, operand, "range");
};

//@ verify
// LemmaScript: require top operand type match.
FormulaOperandMut.OperandAsType = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
  operandtype: string,
): SocialCalc.FormulaValueResult {
  var result: SocialCalc.FormulaValueResult = { type: "", value: "" };

  var stacklen = operand.length;

  if (!stacklen) {
    // make sure something is there
    result.type = "e#REF!";
    result.value = 0;
    result.error = SocialCalc.Constants.s_InternalError + "no operand on stack";
    return result;
  }

  result.value = operand[stacklen - 1]!.value; // get top of stack
  result.type = operand[stacklen - 1]!.type;
  operand.pop(); // we have data - pop stack
  if (result.type == "name") {
    result = SocialCalc.Formula.LookupName(sheet, result.value);
  }
  if (result.type == operandtype) {
    // value is a coord reference
    return result;
  } else {
    result.value = SocialCalc.Constants.s_calcerrcellrefmissing;
    result.type = "e#REF!";
    return result;
  }
};

//@ verify
// LemmaScript: pop sheet-qualified coord operands.
FormulaOperandMut.OperandsAsCoordOnSheet = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  var sheetname, othersheet, pos1, pos2;
  var value1: SocialCalc.FormulaValueResult = { type: "", value: "" };
  var result: SocialCalc.FormulaValueResult = { type: "", value: "" };
  var scf = SocialCalc.Formula;

  var stacklen = operand.length;
  value1.value = operand[stacklen - 1]!.value; // get top of stack - coord or name
  value1.type = operand[stacklen - 1]!.type;
  operand.pop(); // we have data - pop stack

  sheetname = scf.OperandAsSheetName(sheet, operand); // get sheetname as text
  if (sheetname.type.charAt(0) == "e" || sheetname.error) {
    // Preserve LookupName errors (#DIV/0!) and sheetnamemissing; do not
    // rewrite them as "Sheet unavailable: …".
    if (sheetname.type.charAt(0) == "e") {
      result.type = sheetname.type;
      result.value = sheetname.value;
    } else {
      result.type = "e#REF!";
      result.value = 0;
    }
    if (sheetname.error) {
      result.error = sheetname.error;
    }
    return result;
  }
  othersheet = scf.FindInSheetCache(sheetname.value as string);
  if (othersheet == null) {
    // unavailable
    result.type = "e#REF!";
    result.value = 0;
    result.error = SocialCalc.Constants.s_sheetunavailable + " " + sheetname.value;
    return result;
  }

  if (value1.type == "name") {
    value1 = scf.LookupName(othersheet, value1.value as string);
  }
  result.type = value1.type;
  if (value1.type == "coord") {
    // value is a coord reference
    result.value = (value1.value as string) + "!" + sheetname.value; // return in the format as used on stack
  } else if (value1.type == "range") {
    // value is a range reference
    const rv = value1.value as string;
    pos1 = rv.indexOf("|");
    pos2 = rv.indexOf("|", pos1 + 1);
    result.value =
      rv.substring(0, pos1) + "!" + sheetname.value + "|" + rv.substring(pos1 + 1, pos2) + "|";
  } else if (value1.type.charAt(0) == "e") {
    result.value = value1.value;
  } else {
    result.error = SocialCalc.Constants.s_calcerrcellrefmissing;
    result.type = "e#REF!";
    result.value = 0;
  }
  return result;
};

//@ verify
// LemmaScript: pop sheet-qualified range operands.
FormulaOperandMut.OperandsAsRangeOnSheet = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  var value1: SocialCalc.FormulaValueResult;
  var othersheet, pos1, pos2;
  var value2: SocialCalc.FormulaValueResult = { type: "", value: "" };
  var scf = SocialCalc.Formula;
  var scc = SocialCalc.Constants;

  var stacklen = operand.length;
  value2.value = operand[stacklen - 1]!.value; // get top of stack - coord or name for "right" side
  value2.type = operand[stacklen - 1]!.type;
  operand.pop(); // we have data - pop stack

  value1 = scf.OperandAsCoord(sheet, operand); // get "left" coord
  if (value1.type != "coord") {
    // not a coord, which it must be
    return { value: 0, type: "e#REF!" };
  }

  othersheet = sheet;
  const leftCoord = value1.value as string;
  pos1 = leftCoord.indexOf("!");
  if (pos1 != -1) {
    // sheet reference
    pos2 = leftCoord.indexOf("|", pos1 + 1);
    if (pos2 < 0) pos2 = leftCoord.length;
    othersheet = scf.FindInSheetCache(leftCoord.substring(pos1 + 1, pos2)); // get other sheet
    if (othersheet == null) {
      // unavailable
      return {
        value: 0,
        type: "e#REF!",
        error: scc.s_sheetunavailable + " " + leftCoord.substring(pos1 + 1, pos2),
      };
    }
  }

  if (value2.type == "name") {
    // coord:name is allowed, if name is just one cell
    value2 = scf.LookupName(othersheet, value2.value as string, "end");
  }

  if (value2.type == "coord") {
    // value is a coord reference, so return the combined range
    return {
      value: (value1.value as string) + "|" + (value2.value as string) + "|",
      type: "range",
    }; // return range in the format as used on stack
  } else {
    // bad form
    return { value: scc.s_calcerrcellrefmissing, type: "e#REF!" };
  }
};

//@ verify
// LemmaScript: pop sheet name operand.
FormulaOperandMut.OperandAsSheetName = function (
  sheet: SocialCalc.Sheet,
  operand: SocialCalc.FormulaOperand[],
): SocialCalc.FormulaValueResult {
  var nvalue, cell;

  var result: SocialCalc.FormulaValueResult = { type: "", value: "" };

  var stacklen = operand.length;

  result.value = operand[stacklen - 1]!.value; // get top of stack
  result.type = operand[stacklen - 1]!.type;
  operand.pop(); // we have data - pop stack
  if (result.type == "name") {
    nvalue = SocialCalc.Formula.LookupName(sheet, result.value);
    // Unknown name (e#NAME? with empty value): bare sheet name, e.g. Sheet1!A1.
    // Do not treat falsy values (0, "", #DIV/0!) as unknown — that loses real errors.
    if (nvalue.type == "e#NAME?" && nvalue.value === "") {
      return result;
    }
    result.value = nvalue.value;
    result.type = nvalue.type;
    if (nvalue.error) {
      result.error = nvalue.error;
    }
  }
  if (result.type.charAt(0) == "e") {
    // preserve LookupName / prior errors
    return result;
  }
  if (result.type == "coord") {
    // value is a coord reference, follow it to find sheet name
    cell = sheet.cells[SocialCalc.Formula.PlainCoord(result.value)];
    if (cell) {
      result.value = cell.datavalue;
      result.type = cell.valuetype;
    } else {
      result.value = "";
      result.type = "b";
    }
  }
  if (result.type.charAt(0) == "t") {
    // value is a string which could be a sheet name
    return result;
  } else {
    result.value = "";
    result.error = SocialCalc.Constants.s_calcerrsheetnamemissing;
    return result;
  }
};
