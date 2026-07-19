// In-place TypeScript conversion of formula1.js (SocialCalc global script).
// Ambient API types live in formula1.d.ts (referenced by dist/SocialCalc.d.ts).
// Intermediate: typechecked core after removing @ts-nocheck.
// Opts this module into strict TypeScript checking; sibling .d.ts provides types.
//
/*
// SocialCalc Spreadsheet Formula Library
//
// Part of the SocialCalc package
//
// (c) Copyright 2008 Socialtext, Inc.
// All Rights Reserved.
//
// The contents of this file are subject to the Artistic License 2.0; you may not
// use this file except in compliance with the License. You may obtain a copy of 
// the License at http://socialcalc.org/licenses/al-20/.
//
// Some of the other files in the SocialCalc package are licensed under
// different licenses. Please note the licenses of the modules you use.
//
// Code History:
//
// Initially coded by Dan Bricklin of Software Garden, Inc., for Socialtext, Inc.
// Based in part on the SocialCalc 1.1.0 code written in Perl.
// The SocialCalc 1.1.0 code was:
//    Portions (c) Copyright 2005, 2006, 2007 Software Garden, Inc.
//    All Rights Reserved.
//    Portions (c) Copyright 2007 Socialtext, Inc.
//    All Rights Reserved.
// The Perl SocialCalc started as modifications to the wikiCalc(R) program, version 1.0.
// wikiCalc 1.0 was written by Software Garden, Inc.
// Unless otherwise specified, referring to "SocialCalc" in comments refers to this
// JavaScript version of the code, not the SocialCalc Perl code.
//
*/

// Redundant `if (!SocialCalc)` guard removed — SocialCalc bag is created by
// module-wrapper-top.js inside the UMD factory.

// Implementation-only mutable views for progressive init of ambient Formula API.
// Reads still go through SocialCalc.Formula (typed ambient); writes use FormulaMut.
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type FormulaMutable = Mutable<typeof SocialCalc.Formula> & { [key: string]: any };
type TriggerIoMutable = Mutable<typeof SocialCalc.TriggerIoAction> & { [key: string]: any };

(SocialCalc as unknown as { Formula: FormulaMutable }).Formula = {} as FormulaMutable;
const FormulaMut: FormulaMutable = (SocialCalc as unknown as { Formula: FormulaMutable }).Formula;

(SocialCalc as unknown as { TriggerIoAction: TriggerIoMutable }).TriggerIoAction =
  {} as TriggerIoMutable;
const TriggerIoMut: TriggerIoMutable = (
  SocialCalc as unknown as { TriggerIoAction: TriggerIoMutable }
).TriggerIoAction;
// Formula constants for parsing:
//

FormulaMut.ParseState = {
  num: 1,
  alpha: 2,
  coord: 3,
  string: 4,
  stringquote: 5,
  numexp1: 6,
  numexp2: 7,
  alphanumeric: 8,
  specialvalue: 9,
};

FormulaMut.TokenType = { num: 1, coord: 2, op: 3, name: 4, error: 5, string: 6, space: 7 };

FormulaMut.CharClass = {
  num: 1,
  numstart: 2,
  op: 3,
  eof: 4,
  alpha: 5,
  incoord: 6,
  error: 7,
  quote: 8,
  space: 9,
  specialstart: 10,
};

FormulaMut.CharClassTable = {
  " ": 9,
  "!": 3,
  '"': 8,
  "'": 8,
  "#": 10,
  $: 6,
  "%": 3,
  "&": 3,
  "(": 3,
  ")": 3,
  "*": 3,
  "+": 3,
  ",": 3,
  "-": 3,
  ".": 2,
  "/": 3,
  "0": 1,
  "1": 1,
  "2": 1,
  "3": 1,
  "4": 1,
  "5": 1,
  "6": 1,
  "7": 1,
  "8": 1,
  "9": 1,
  ":": 3,
  "<": 3,
  "=": 3,
  ">": 3,
  A: 5,
  B: 5,
  C: 5,
  D: 5,
  E: 5,
  F: 5,
  G: 5,
  H: 5,
  I: 5,
  J: 5,
  K: 5,
  L: 5,
  M: 5,
  N: 5,
  O: 5,
  P: 5,
  Q: 5,
  R: 5,
  S: 5,
  T: 5,
  U: 5,
  V: 5,
  W: 5,
  X: 5,
  Y: 5,
  Z: 5,
  "^": 3,
  _: 5,
  a: 5,
  b: 5,
  c: 5,
  d: 5,
  e: 5,
  f: 5,
  g: 5,
  h: 5,
  i: 5,
  j: 5,
  k: 5,
  l: 5,
  m: 5,
  n: 5,
  o: 5,
  p: 5,
  q: 5,
  r: 5,
  s: 5,
  t: 5,
  u: 5,
  v: 5,
  w: 5,
  x: 5,
  y: 5,
  z: 5,
};

FormulaMut.UpperCaseTable = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G",
  h: "H",
  i: "I",
  j: "J",
  k: "K",
  l: "L",
  m: "M",
  n: "N",
  o: "O",
  p: "P",
  q: "Q",
  r: "R",
  s: "S",
  t: "T",
  u: "U",
  v: "V",
  w: "W",
  x: "X",
  y: "Y",
  z: "Z",
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  F: "F",
  G: "G",
  H: "H",
  I: "I",
  J: "J",
  K: "K",
  L: "L",
  M: "M",
  N: "N",
  O: "O",
  P: "P",
  Q: "Q",
  R: "R",
  S: "S",
  T: "T",
  U: "U",
  V: "V",
  W: "W",
  X: "X",
  Y: "Y",
  Z: "Z",
};

FormulaMut.SpecialConstants = {
  // names that turn into constants for name lookup
  "#NULL!": "0,e#NULL!",
  "#NUM!": "0,e#NUM!",
  "#DIV/0!": "0,e#DIV/0!",
  "#VALUE!": "0,e#VALUE!",
  "#REF!": "0,e#REF!",
  "#NAME?": "0,e#NAME?",
  "#N/A": "0,e#N/A",
  "#SPILL!": "0,e#SPILL!",
};
FormulaMut.SPILL_MAX_COL = 702;
FormulaMut.SPILL_MAX_ROW = 65536;
FormulaMut.SPILL_MAX_CELLS = 100000;
FormulaMut.PlanSpillStatus = function (anchorCol, anchorRow, rows, cols, maxCol, maxRow, maxCells) {
  if (!(rows > 0 && cols > 0)) return 1;
  if (
    !(
      anchorCol >= 1 &&
      anchorRow >= 1 &&
      anchorCol + cols - 1 <= maxCol &&
      anchorRow + rows - 1 <= maxRow
    )
  )
    return 2;
  if (rows * cols > maxCells) return 3;
  return 0;
};
FormulaMut.ClassifySpillClaim = function (anchor, blank, owned, foreign, user, merged) {
  if (anchor) return 0;
  if (foreign || user || merged) return 2;
  return blank || owned ? 1 : 2;
};
FormulaMut.ClassifyResizeMembership = function (oldValue, newValue) {
  return oldValue && newValue ? 0 : !oldValue && newValue ? 1 : oldValue ? 2 : 3;
};
FormulaMut.KeepUniqueItem = function (index, firstIndex, count, exactlyOnce) {
  return exactlyOnce ? count === 1 : index === firstIndex;
};
FormulaMut.StableTieCompare = function (result, indexA, indexB) {
  return result !== 0 ? result : indexA < indexB ? -1 : indexA > indexB ? 1 : 0;
};

// Statistics pure policies mirroring lemma/statistics.ts (Dafny/Lean-verified
// exact-integer core; see that file for why RANK.AVG's real-valued average
// and QUARTILE.EXC's real-valued interpolation position are deliberately
// NOT modeled directly — only their integer-exact boundary/tie predicates
// are proved, same split as the spill policies above).
FormulaMut.DoubledAverageRank = function (bestRank, tieCount) {
  return 2 * bestRank + tieCount - 1;
};
FormulaMut.QuartileExcScaledPosition = function (n, quart) {
  return quart * (n + 1);
};
FormulaMut.IsValidQuartileExcPosition = function (n, quart) {
  var scaled = quart * (n + 1);
  return scaled >= 4 && scaled <= 4 * n;
};

// Operator Precedence table
//
// 1- !, 2- : ,, 3- M P, 4- %, 5- ^, 6- * /, 7- + -, 8- &, 9- < > = G(>=) L(<=) N(<>),
// Negative value means Right Associative

FormulaMut.TokenPrecedence = {
  "!": 1,
  ":": 2,
  ",": 2,
  M: -3,
  P: -3,
  "%": 4,
  "^": 5,
  "*": 6,
  "/": 6,
  "+": 7,
  "-": 7,
  "&": 8,
  "<": 9,
  ">": 9,
  "=": 9,
  G: 9,
  L: 9,
  N: 9,
};

// Convert one-char token text to input text:

FormulaMut.TokenOpExpansion = { G: ">=", L: "<=", M: "-", N: "<>", P: "+" };

//
// Information about the resulting value types when doing operations on values (used by LookupResultType)
//
// Each object entry is an object with specific types with result type info as follows:
//
//    'type1a': '|type2a:resulta|type2b:resultb|...
//    Type of t* or n* matches any of those types not listed
//    Results may be a type or the numbers 1 or 2 specifying to return type1 or type2

FormulaMut.TypeLookupTable = {
  unaryminus: { "n*": "|n*:1|", "e*": "|e*:1|", "t*": "|t*:e#VALUE!|", b: "|b:n|" },
  unaryplus: { "n*": "|n*:1|", "e*": "|e*:1|", "t*": "|t*:e#VALUE!|", b: "|b:n|" },
  unarypercent: { "n*": "|n:n%|n*:n|", "e*": "|e*:1|", "t*": "|t*:e#VALUE!|", b: "|b:n|" },
  plus: {
    "n%": "|n%:n%|nd:n|nt:n|ndt:n|n$:n|n:n|n*:n|b:n|e*:2|t*:e#VALUE!|",
    nd: "|n%:n|nd:nd|nt:ndt|ndt:ndt|n$:n|n:nd|n*:n|b:n|e*:2|t*:e#VALUE!|",
    nt: "|n%:n|nd:ndt|nt:nt|ndt:ndt|n$:n|n:nt|n*:n|b:n|e*:2|t*:e#VALUE!|",
    ndt: "|n%:n|nd:ndt|nt:ndt|ndt:ndt|n$:n|n:ndt|n*:n|b:n|e*:2|t*:e#VALUE!|",
    n$: "|n%:n|nd:n|nt:n|ndt:n|n$:n$|n:n$|n*:n|b:n|e*:2|t*:e#VALUE!|",
    nl: "|n%:n|nd:n|nt:n|ndt:n|n$:n|n:n|n*:n|b:n|e*:2|t*:e#VALUE!|",
    n: "|n%:n|nd:nd|nt:nt|ndt:ndt|n$:n$|n:n|n*:n|b:n|e*:2|t*:e#VALUE!|",
    b: "|n%:n%|nd:nd|nt:nt|ndt:ndt|n$:n$|n:n|n*:n|b:n|e*:2|t*:e#VALUE!|",
    "t*": "|ni:1|n*:e#VALUE!|t*:e#VALUE!|b:e#VALUE!|e*:2|",
    "n*": "|ni:1|e*:2|",
    "e*": "|e*:1|n*:1|t*:1|b:1|",
  },
  concat: {
    t: "|t:t|th:th|tw:tw|tl:t|tr:tr|t*:2|e*:2|",
    th: "|t:th|th:th|tw:t|tl:th|tr:t|t*:t|e*:2|",
    tw: "|t:tw|th:t|tw:tw|tl:tw|tr:tw|t*:t|e*:2|",
    tl: "|t:tl|th:th|tw:tw|tl:tl|tr:tr|t*:t|e*:2|",
    "t*": "|t*:t|e*:2|",
    "e*": "|e*:1|n*:1|t*:1|",
  },
  oneargnumeric: { "n*": "|n*:n|", "e*": "|e*:1|", "t*": "|t*:e#VALUE!|", b: "|b:n|" },
  twoargnumeric: {
    "n*": "|n*:n|t*:e#VALUE!|e*:2|",
    "e*": "|e*:1|n*:1|t*:1|",
    "t*": "|t*:e#VALUE!|n*:e#VALUE!|e*:2|",
  },
  propagateerror: { "n*": "|n*:2|e*:2|", "e*": "|e*:2|", "t*": "|t*:2|e*:2|", b: "|b:2|e*:2|" },
};

/* *******************

 parseinfo = SocialCalc.Formula.ParseFormulaIntoTokens(line)

 Parses a text string as if it was a spreadsheet formula

 This uses a simple state machine run on each character in turn.
 States remember whether a number is being gathered, etc.
 The result is parseinfo which is an array with one entry for each token:
   parseinfo[i] = {
     text: "the characters making up the parsed token",
     type: the type of the token (a number),
     opcode: a single character version of an operator suitable for use in the
                  precedence table and distinguishing between unary and binary + and -.

************************* */

// ParseFormulaIntoTokens moved to js/formula-parse.ts (typechecked pure core).

// ParsePushToken moved to js/formula-parse.ts (typechecked pure core).

/* *******************

 result = SocialCalc.Formula.evaluate_parsed_formula(parseinfo, sheet, allowrangereturn)

 Does the calculation expressed in a parsed formula, returning a value, its type, and error info
 returns: {value: value, type: valuetype, error: errortext}.

 If allowrangereturn is present and true, can return a range (e.g., "A1:A10" - translated from "A1|A10|")

************************* */

/**
 * @param {any[]} parseinfo
 * @param {any} sheet
 * @param {boolean | number} [allowrangereturn]
 */
FormulaMut.evaluate_parsed_formula = function (parseinfo, sheet, allowrangereturn) {
  var result;

  var scf = SocialCalc.Formula;

  var revpolish;

  revpolish = scf.ConvertInfixToPolish(parseinfo); // result is either an array or a string with error text

  result = scf.EvaluatePolish(parseinfo, revpolish, sheet, allowrangereturn);

  return result;
};

//
// revpolish = SocialCalc.Formula.ConvertInfixToPolish(parseinfo)
//
// Convert infix to reverse polish notation
//
// Returns revpolish array with a sequence of references to tokens by number if successful.
// Errors return a string with the error.
//
// Based upon the algorithm shown in Wikipedia "Reverse Polish notation" article
// and then enhanced for additional spreadsheet things
//

// ConvertInfixToPolish moved to js/formula-parse.ts (typechecked pure core).

// DebugLog
// display logged objects in the audit tab of the spreadsheet control
if (typeof SocialCalc.debug_log === "undefined") SocialCalc.debug_log = [];

/** @param {any} _logObject */
SocialCalc.DebugLog = function (_logObject) {
  //	SocialCalc.debug_log.push(logObject);
};

//
// result = SocialCalc.Formula.EvaluatePolish(parseinfo, revpolish, sheet, allowrangereturn)
//
// Execute reverse polish representation of formula
//
// Operand values are objects in the operand array with a "type" and an optional "value".
// Type can have these values (many are type and sub-type as two or more letters):
//    "tw", "th", "t", "n", "nt", "coord", "range", "start", "eErrorType", "b" (blank)
// The value of a coord is in the form A57 or A57!sheetname
// The value of a range is coord|coord|number where number starts at 0 and is
// the offset of the next item to fetch if you are going through the range one by one
// The number starts as a null string ("A1|B3|")
//

/**
 * @param {any[]} parseinfo
 * @param {number[] | string} revpolish
 * @param {any} sheet
 * @param {boolean | number} [allowrangereturn]
 */
FormulaMut.EvaluatePolish = function (parseinfo, revpolish, sheet, allowrangereturn) {
  var scf = SocialCalc.Formula;
  var scc = SocialCalc.Constants;
  var tokentype = scf.TokenType;
  var lookup_result_type = scf.LookupResultType;
  var typelookup = scf.TypeLookupTable;
  var operand_as_number = scf.OperandAsNumber;
  var operand_as_text = scf.OperandAsText;
  var operand_value_and_type = scf.OperandValueAndType;
  var operands_as_coord_on_sheet = scf.OperandsAsCoordOnSheet;
  var format_number_for_display =
    SocialCalc.format_number_for_display ||
    function (v: any) {
      return v + "";
    };

  var errortext: any = "";
  var function_start = -1;
  var missingOperandError = { value: "", type: "e#VALUE!", error: scc.s_parseerrmissingoperand };

  var operand: any[] = [];
  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var i,
    rii,
    prii,
    ttype,
    ttext,
    value,
    value1,
    value2,
    tostype,
    tostype2,
    resulttype,
    valuetype,
    cond,
    vmatch,
    smatch;

  if (!parseinfo.length || !(revpolish instanceof Array)) {
    return { value: "", type: "e#VALUE!", error: typeof revpolish == "string" ? revpolish : "" };
  }

  // eddy EvaluatePolish {
  //    SocialCalc.DebugLog({ revpolish: revpolish});
  //    SocialCalc.DebugLog({ revpolish: revpolish});
  // }

  // eddy EvaluatePolish {

  // e.g parameterInfo: [ {'text':'E1','type':2,'opcode':0}, ... ]
  var parameterInfo = [];
  // }

  for (i = 0; i < revpolish.length; i++) {
    rii = revpolish[i];
    if (rii == function_start) {
      // Remember the start of a function argument list
      PushOperand("start", 0);
      continue;
    }

    prii = parseinfo[rii];
    ttype = prii.type;
    ttext = prii.text;
    // eddy EvaluatePolish {
    parameterInfo.push(prii);
    // }

    if (ttype == tokentype.num) {
      PushOperand("n", (ttext as any) - 0);
    } else if (ttype == tokentype.coord) {
      PushOperand("coord", ttext);
    } else if (ttype == tokentype.string) {
      PushOperand("t", ttext);
    } else if (ttype == tokentype.op) {
      if (operand.length <= 0) {
        // Nothing on the stack...
        return missingOperandError;
      }
      if (
        (operand[operand.length - 1].type == "array" ||
          (operand.length > 1 && operand[operand.length - 2].type == "array")) &&
        (ttext == "M" ||
          ttext == "P" ||
          ttext == "%" ||
          ttext == "&" ||
          ttext == "<" ||
          ttext == "L" ||
          ttext == "=" ||
          ttext == "G" ||
          ttext == ">" ||
          ttext == "N" ||
          ttext == "+" ||
          ttext == "-" ||
          ttext == "*" ||
          ttext == "/" ||
          ttext == "^")
      ) {
        return { value: 0, type: "e#VALUE!", error: "" };
      }

      // Unary minus

      if (ttext == "M") {
        value1 = operand_as_number(sheet, operand);
        resulttype = lookup_result_type(value1.type, value1.type, typelookup.unaryminus);
        PushOperand(resulttype, -value1.value);
      }

      // Unary plus
      else if (ttext == "P") {
        value1 = operand_as_number(sheet, operand);
        resulttype = lookup_result_type(value1.type, value1.type, typelookup.unaryplus);
        PushOperand(resulttype, value1.value);
      }

      // Unary % - percent, left associative
      else if (ttext == "%") {
        value1 = operand_as_number(sheet, operand);
        resulttype = lookup_result_type(value1.type, value1.type, typelookup.unarypercent);
        PushOperand(resulttype, 0.01 * value1.value);
      }

      // & - string concatenate
      else if (ttext == "&") {
        if (operand.length <= 1) {
          // Need at least two things on the stack...
          return missingOperandError;
        }
        value2 = operand_as_text(sheet, operand);
        value1 = operand_as_text(sheet, operand);
        // Must pass both types — lookup(value1, value1) swallows right-hand e*.
        resulttype = lookup_result_type(value1.type, value2.type, typelookup.concat);
        PushOperand(resulttype, value1.value + value2.value);
      }

      // : - Range constructor
      else if (ttext == ":") {
        if (operand.length <= 1) {
          // Need at least two things on the stack...
          return missingOperandError;
        }
        value1 = scf.OperandsAsRangeOnSheet(sheet, operand); // get coords even if use name on other sheet
        PushOperand(value1.type, value1.value); // push sheetname with range on that sheet
      }

      // ! - sheetname!coord
      else if (ttext == "!") {
        if (operand.length <= 1) {
          // Need at least two things on the stack...
          return missingOperandError;
        }
        value1 = operands_as_coord_on_sheet(sheet, operand); // get coord even if name on other sheet
        if (value1.error) {
          // not available
          errortext = errortext || value1.error;
        }
        PushOperand(value1.type, value1.value); // push sheetname with coord or range on that sheet
      }

      // Comparison operators: < L = G > N (< <= = >= > <>)
      else if (
        ttext == "<" ||
        ttext == "L" ||
        ttext == "=" ||
        ttext == "G" ||
        ttext == ">" ||
        ttext == "N"
      ) {
        if (operand.length <= 1) {
          // Need at least two things on the stack...
          errortext = scc.s_parseerrmissingoperand; // remember error
          break;
        }
        value2 = operand_value_and_type(sheet, operand);
        value1 = operand_value_and_type(sheet, operand);
        if (value1.type.charAt(0) == "n" && value2.type.charAt(0) == "n") {
          // compare two numbers
          cond = 0;
          if (ttext == "<") {
            cond = value1.value < value2.value ? 1 : 0;
          } else if (ttext == "L") {
            cond = value1.value <= value2.value ? 1 : 0;
          } else if (ttext == "=") {
            cond = value1.value == value2.value ? 1 : 0;
          } else if (ttext == "G") {
            cond = value1.value >= value2.value ? 1 : 0;
          } else if (ttext == ">") {
            cond = value1.value > value2.value ? 1 : 0;
          } else if (ttext == "N") {
            cond = value1.value != value2.value ? 1 : 0;
          }
          PushOperand("nl", cond);
        } else if (value1.type.charAt(0) == "e") {
          // error on left
          PushOperand(value1.type, 0);
        } else if (value2.type.charAt(0) == "e") {
          // error on right
          PushOperand(value2.type, 0);
        } else {
          // text maybe mixed with numbers or blank
          tostype = value1.type.charAt(0);
          tostype2 = value2.type.charAt(0);
          if (tostype == "n") {
            value1.value = format_number_for_display(value1.value, "n", "");
          } else if (tostype == "b") {
            value1.value = "";
          }
          if (tostype2 == "n") {
            value2.value = format_number_for_display(value2.value, "n", "");
          } else if (tostype2 == "b") {
            value2.value = "";
          }
          cond = 0;
          value1.value = (value1.value as any).toLowerCase(); // ignore case
          value2.value = (value2.value as any).toLowerCase();
          if (ttext == "<") {
            cond = value1.value < value2.value ? 1 : 0;
          } else if (ttext == "L") {
            cond = value1.value <= value2.value ? 1 : 0;
          } else if (ttext == "=") {
            cond = value1.value == value2.value ? 1 : 0;
          } else if (ttext == "G") {
            cond = value1.value >= value2.value ? 1 : 0;
          } else if (ttext == ">") {
            cond = value1.value > value2.value ? 1 : 0;
          } else if (ttext == "N") {
            cond = value1.value != value2.value ? 1 : 0;
          }
          PushOperand("nl", cond);
        }
      }

      // Normal infix arithmethic operators: +, -. *, /, ^
      else {
        // what's left are the normal infix arithmetic operators
        if (operand.length <= 1) {
          // Need at least two things on the stack...
          errortext = scc.s_parseerrmissingoperand; // remember error
          break;
        }
        if (ttext == "+") {
          value2 = operand_value_and_type(sheet, operand);
          value1 = operand_value_and_type(sheet, operand); // allow + to append style formula to widget
          resulttype = lookup_result_type(value1.type, value2.type, typelookup.plus);
          PushOperand(resulttype, value1.value + value2.value);
        } else {
          value2 = operand_as_number(sheet, operand);
          value1 = operand_as_number(sheet, operand);
        }

        if (ttext == "-") {
          resulttype = lookup_result_type(value1.type, value2.type, typelookup.plus);
          PushOperand(resulttype, value1.value - value2.value);
        } else if (ttext == "*") {
          resulttype = lookup_result_type(value1.type, value2.type, typelookup.plus);
          PushOperand(resulttype, value1.value * value2.value);
        } else if (ttext == "/") {
          // Error operands must win over zero-divisor. Coerced error
          // values are 0, so checking value2 first mislabels 1/#REF!
          // as #DIV/0!. LookupResultType propagates e* correctly.
          resulttype = lookup_result_type(value1.type, value2.type, typelookup.plus);
          if (resulttype.charAt(0) == "e") {
            PushOperand(resulttype, 0);
          } else if (value2.value != 0) {
            PushOperand(resulttype, value1.value / value2.value);
          } else {
            PushOperand("e#DIV/0!", 0);
          }
        } else if (ttext == "^") {
          // Error operands must win over Math.pow coercion (errors are 0).
          // 2^#REF! / #REF!^2 must stay #REF!, not 1 / #NUM!.
          resulttype = lookup_result_type(value1.type, value2.type, typelookup.plus);
          if (resulttype.charAt(0) == "e") {
            PushOperand(resulttype, 0);
          } else {
            value1.value = Math.pow(value1.value, value2.value);
            value1.type = "n"; // plain numeric result
            if (isNaN(value1.value)) {
              value1.value = 0;
              value1.type = "e#NUM!";
            }
            PushOperand(value1.type, value1.value);
          }
        }
      }
    }

    // function or name
    // function or name
    else if (ttype == tokentype.name) {
      // Names adjacent to ":" are treated as range endpoints, not function
      // names. This preserves full-column references like N:N and T:T
      // while keeping bare N() and T() as function-call errors.
      if (
        (rii > 0 && parseinfo[rii - 1]!.type == tokentype.op && parseinfo[rii - 1]!.text == ":") ||
        (rii + 1 < parseinfo.length &&
          parseinfo[rii + 1]!.type == tokentype.op &&
          parseinfo[rii + 1]!.text == ":")
      ) {
        if (operand.length && operand[operand.length - 1]!.type == "start") {
          operand.pop();
        }
        PushOperand("name", ttext);
      } else {
        // eddy CalculateFunction {
        errortext = scf.CalculateFunction(ttext, operand, sheet, (parseinfo as any).coord); // eddy also pass the cell id
        // }
        if (errortext) break;
      }
    } else {
      errortext = scc.s_InternalError + "Unknown token " + ttype + " (" + ttext + "). ";
      break;
    }
  }

  // look at final value and handle special cases

  value = operand[0] ? operand[0].value : "";
  tostype = operand[0] ? operand[0].type : "";

  if (tostype == "name") {
    // name - expand it
    value1 = SocialCalc.Formula.LookupName(sheet, value);
    value = value1.value;
    tostype = value1.type;
    errortext = errortext || value1.error;
  }

  if (tostype == "coord") {
    // the value is a coord reference, get its value and type
    value1 = operand_value_and_type(sheet, operand);
    value = value1.value;
    tostype = value1.type;
    if (tostype == "b") {
      tostype = "n";
      value = 0;
    }
  }

  if (operand.length > 1 && !errortext) {
    // something left - error
    errortext += scc.s_parseerrerrorinformula;
  }

  // set return type

  valuetype = tostype;

  if (tostype.charAt(0) == "e") {
    // error value
    errortext = errortext || tostype.substring(1) || scc.s_calcerrerrorvalueinformula;
  } else if (tostype == "range") {
    vmatch = value.match(/^(.*)\|(.*)\|/);
    smatch = vmatch[1].indexOf("!");
    if (smatch >= 0) {
      // swap sheetname
      vmatch[1] =
        vmatch[1].substring(smatch + 1) + "!" + vmatch[1].substring(0, smatch).toUpperCase();
    } else {
      vmatch[1] = vmatch[1].toUpperCase();
    }
    value = vmatch[1] + ":" + vmatch[2].toUpperCase();
    if (!allowrangereturn) {
      errortext = scc.s_formularangeresult + " " + value;
    }
  }

  if (errortext && valuetype.charAt(0) != "e") {
    value = errortext;
    valuetype = "e";
  }

  // look for overflow

  if (valuetype.charAt(0) == "n") {
    const numericIsNaN = isNaN(value);
    if (numericIsNaN || !isFinite(value)) {
      value = 0;
      valuetype = "e#NUM!";
      errortext = numericIsNaN ? scc.s_calcerrnumericnan : scc.s_calcerrnumericoverflow;
    }
  }

  return { value: value, type: valuetype, error: errortext };
};

/*
#
# resulttype = SocialCalc.Formula.LookupResultType(type1, type2, typelookup);
#
# typelookup has values of the following form:
#
#    typelookup{"typespec1"} = "|typespec2A:resultA|typespec2B:resultB|..."
#
# First type1 is looked up. If no match, then the first letter (major type) of type1 plus "*" is looked up
# resulttype is type1 if result is "1", type2 if result is "2", otherwise the value of result.
#
*/

// LookupResultType moved to js/formula-parse.ts (typechecked pure core).

/*
#
# operandinfo = SocialCalc.Formula.TopOfStackValueAndType(sheet, operand)
#
# Returns top of stack value and type and then pops the stack.
# The result is {value: value, type: type, error: "only if bad error"}
#
*/

// TopOfStackValueAndType moved to js/formula-operand.ts (typechecked pure core).

/*
#
# operandinfo = OperandAsNumber(sheet, operand)
#
# Uses operand_value_and_type to get top of stack and pops it.
# Returns numeric value and type.
# Text values are treated as 0 if they can't be converted somehow.
#
*/

// OperandAsNumber moved to js/formula-operand.ts (typechecked pure core).

/*
#
# operandinfo = OperandAsText(sheet, operand)
#
# Uses operand_value_and_type to get top of stack and pops it.
# Returns text value, preserving sub-type.
#
*/

// OperandAsText moved to js/formula-operand.ts (typechecked pure core).

/*
#
# result = SocialCalc.Formula.OperandValueAndType(sheet, operand)
#
# Pops the top of stack and returns it, following a coord reference if necessary.
# The result is {value: value, type: type, error: "only if bad error"}
# Ranges are returned as if they were pushed onto the stack first coord first
# Also sets type with "t", "n", "th", etc., as appropriate
#
*/

// OperandValueAndType moved to js/formula-operand.ts (typechecked pure core).

/*
#
# operandinfo = SocialCalc.Formula.OperandAsCoord(sheet, operand)
#
# Gets top of stack and pops it.
# Returns coord value. All others are treated as an error.
#
*/

// OperandAsCoord moved to js/formula-operand.ts (typechecked pure core).

/*
#
# operandinfo = SocialCalc.Formula.OperandAsRange(sheet, operand)
#
# Gets top of stack and pops it.
# Returns coord value. All others are treated as an error.
#
*/

// OperandAsRange moved to js/formula-operand.ts (typechecked pure core).

// OperandAsType moved to js/formula-operand.ts (typechecked pure core).

/*
#
# result = SocialCalc.Formula.OperandsAsCoordOnSheet(sheet, operand)
#
# Gets 2 at top of stack and pops them, treating them as sheetname!coord-or-name.
# Returns stack-style coord value (coord!sheetname, or coord!sheetname|coord|) with
# a type of coord or range. All others are treated as an error.
# If sheetname not available, sets result.error.
#
*/

// OperandsAsCoordOnSheet moved to js/formula-operand.ts (typechecked pure core).

/*
#
# result = SocialCalc.Formula.OperandsAsRangeOnSheet(sheet, operand)
#
# Gets 2 at top of stack and pops them, treating them as coord2-or-name:coord1.
# Name is evaluated on sheet of coord1.
# Returns result with "value" of stack-style range value (coord!sheetname|coord|) and
# "type" of "range". All others are treated as an error.
#
*/

// OperandsAsRangeOnSheet moved to js/formula-operand.ts (typechecked pure core).

/*
#
# result = SocialCalc.Formula.OperandAsSheetName(sheet, operand)
#
# Gets top of stack and pops it.
# Returns sheetname value. All others are treated as an error.
# Accepts text, cell reference, and named value which is one of those two.
#
*/

// OperandAsSheetName moved to js/formula-operand.ts (typechecked pure core).

//
// value = SocialCalc.Formula.LookupName(sheet, name)
//
// Returns value and type of a named value
// Names are case insensitive
// Names may have a definition which is a coord (A1), a range (A1:B7), or a formula (=OFFSET(A1,0,0,5,1))
// Note: The range must not have sheet names ("!") in them.
//

/**
 * @param {any} sheet
 * @param {string} name
 * @param {string | boolean} [isEnd]
 */
FormulaMut.LookupName = function (sheet, name, isEnd) {
  var pos, specialc, parseinfo;
  var names = sheet.names;
  var value: any = {};
  var startedwalk = false;

  if (names[name.toUpperCase()]) {
    // is name defined?

    value.value = names[name.toUpperCase()].definition; // yes

    if (value.value.charAt(0) == "=") {
      // formula
      if (!sheet.checknamecirc) {
        // are we possibly walking the name tree?
        sheet.checknamecirc = {}; // not yet
        startedwalk = true; // remember we are the reference that started it
      } else {
        if (sheet.checknamecirc[name]) {
          // circular reference
          value.type = "e#NAME?";
          value.error = SocialCalc.Constants.s_circularnameref + ' "' + name + '".';
          return value;
        }
      }
      sheet.checknamecirc[name] = true;

      parseinfo = SocialCalc.Formula.ParseFormulaIntoTokens(value.value.substring(1));
      value = SocialCalc.Formula.evaluate_parsed_formula(parseinfo, sheet, 1); // parse formula, allowing range return

      delete sheet.checknamecirc[name]; // done with us
      if (startedwalk) {
        delete sheet.checknamecirc; // done with walk
      }

      if (value.type != "range") return value;
    }

    pos = value.value.indexOf(":");
    if (pos != -1) {
      // range
      value.type = "range";
      value.value = value.value.substring(0, pos) + "|" + value.value.substring(pos + 1) + "|";
      value.value = value.value.toUpperCase();
    } else {
      value.type = "coord";
      value.value = value.value.toUpperCase();
    }
    return value;
  } else if ((specialc = SocialCalc.Formula.SpecialConstants[name.toUpperCase()])) {
    // special constant, like #REF!
    pos = specialc.indexOf(",");
    value.value = (specialc.substring(0, pos) as any) - 0;
    value.type = specialc.substring(pos + 1);
    return value;
  } else if (/^[a-zA-Z][a-zA-Z]?$/.test(name)) {
    value.type = "coord";
    value.value = name.toUpperCase() + (isEnd ? sheet.attribs.lastrow : 1);
    return value;
  } else {
    value.value = "";
    value.type = "e#NAME?";
    value.error = SocialCalc.Constants.s_calcerrunknownname + ' "' + name + '"';
    return value;
  }
};

/*
#
# coord = SocialCalc.Formula.StepThroughRangeDown(operand, rangevalue)
#
# Returns next coord in a range, keeping track on the operand stack
# Goes from upper left across and down to bottom right.
#
*/

/**
 * @param {any[]} operand
 * @param {string} rangevalue
 */
FormulaMut.StepThroughRangeDown = function (operand, rangevalue) {
  var value1, value2, sequence, pos1, pos2, sheet1, rp, c, r, count;
  var scf = SocialCalc.Formula;

  pos1 = rangevalue.indexOf("|");
  pos2 = rangevalue.indexOf("|", pos1 + 1);
  value1 = rangevalue.substring(0, pos1);
  value2 = rangevalue.substring(pos1 + 1, pos2);
  sequence = (rangevalue.substring(pos2 + 1) as any) - 0;

  pos1 = value1.indexOf("!");
  if (pos1 != -1) {
    sheet1 = value1.substring(pos1);
    value1 = value1.substring(0, pos1);
  } else {
    sheet1 = "";
  }
  // value2 (right-hand coord of a range) is stored without a sheet ref.

  rp = scf.OrderRangeParts(value1, value2);

  // Invalid band (col outside A..ZZ / row < 1) → #REF!, do not loop.
  if (rp.c1 < 1 || rp.c2 < 1 || rp.c1 > 702 || rp.c2 > 702 || rp.r1 < 1 || rp.r2 < 1) {
    return { value: 0, type: "e#REF!" };
  }

  count = 0;
  for (r = rp.r1; r <= rp.r2; r++) {
    for (c = rp.c1; c <= rp.c2; c++) {
      count++;
      if (count > sequence) {
        if (r != rp.r2 || c != rp.c2) {
          // keep on stack until done
          scf.PushOperand(operand, "range", value1 + sheet1 + "|" + value2 + "|" + count);
        }
        return { value: SocialCalc.crToCoord(c, r) + sheet1, type: "coord" };
      }
    }
  }
  return undefined;
};

/*
#
# result = SocialCalc.Formula.DecodeRangeParts(sheetdata, range)
#
# Returns sheetdata for the sheet where the range is, as well as
# the number of the first column in the range, the number of columns,
# and equivalent row information:
#
# {sheetdata: sheet, sheetname: name-or-"", col1num: n, ncols: n, row1num: n, nrows: n}
#
# If any errors, a null result is returned.
#
*/

/**
 * @param {any} sheetdata
 * @param {string} range
 */
// LemmaScript opportunity (needs precise TS types before //@ verify): pure formula helper (no DOM).
FormulaMut.DecodeRangeParts = function (sheetdata, range) {
  var value1, value2, pos1, pos2, sheet1, coordsheetdata, rp;

  var scf = SocialCalc.Formula;

  pos1 = range.indexOf("|");
  pos2 = range.indexOf("|", pos1 + 1);
  value1 = range.substring(0, pos1);
  value2 = range.substring(pos1 + 1, pos2);

  pos1 = value1.indexOf("!");
  if (pos1 != -1) {
    sheet1 = value1.substring(pos1 + 1);
    value1 = value1.substring(0, pos1);
  } else {
    sheet1 = "";
  }
  // value2 (right-hand coord of a range) is stored without a sheet ref.

  coordsheetdata = sheetdata;
  if (sheet1) {
    // sheet reference
    coordsheetdata = scf.FindInSheetCache(sheet1);
    if (coordsheetdata == null) {
      // unavailable
      return null;
    }
  }

  rp = scf.OrderRangeParts(value1, value2);

  // Invalid band (col outside A..ZZ / row < 1) → null so callers can #REF!
  // instead of looping huge/negative ranges (e.g. ZZZ1 → col 18278).
  if (rp.c1 < 1 || rp.c2 < 1 || rp.c1 > 702 || rp.c2 > 702 || rp.r1 < 1 || rp.r2 < 1) {
    return null;
  }

  return {
    sheetdata: coordsheetdata,
    sheetname: sheet1,
    col1num: rp.c1,
    ncols: rp.c2 - rp.c1 + 1,
    row1num: rp.r1,
    nrows: rp.r2 - rp.r1 + 1,
  };
};

//*********************
//
// Function Handling
//
//*********************

// List of functions -- Define after functions are defined
//
// SocialCalc.Formula.FunctionList["function_name"] = [function_subroutine, number_of_arguments, arg_def, func_def, func_class, cell_html, io_parameters]
//   function_subroutine takes arguments (fname, operand, foperand, sheet), returns
//      errortext or null, pushing result on operand stack.
//   number_of_arguments is:
//      0 = no arguments
//      >0 = exactly that many arguments
//      <0 = that many arguments (abs value) or more
//      100 = don't check
//
//   arg_def, if present, is the name of the element in SocialCalc.Formula.FunctionArgDefs.
//   func_def, if present, is a string explaining the function. If not, looked up in SocialCalc.Constants.
//   func_class, if present, is the comma-separated names of the elements in SocialCalc.Formula.FunctionClasses.
//   cell_html, if present, is the HTML to display in the cell. will find and replace these <%=cell_reference%>, <%=displayvalue%> see SocialCalc.FormatValueForDisplay
//   io_parameters, if present,
//        "ParameterList" is used with =CopyValue() etc, used to collect parameters of the formula, for use trigger/action formulas,
//        "EventTree" is used with =Button() etc, used to store trigger cell lookup table
//        "Input" store copy of value in formdata sheet -- for input style GUI widgets - textbox/radio buttons etc -
//        "TimeTrigger" like button, but triggers an action at a time,  rather than on click
//
// To add a function, just add it to this object.

if (!SocialCalc.Formula.FunctionList) {
  // make sure it is defined (could have been in another module)
  FormulaMut.FunctionList = {};
}

// FunctionClasses[classname] = {name: full-name-string, items: [sorted list of function names]};
// filled in by SocialCalc.Formula.FillFunctionInfo

FormulaMut.FunctionClasses = null; // start null to say needs filling in

// FunctionArgDef[argname] = explicit-string-for-arg-list;
// filled in by SocialCalc.Formula.FillFunctionInfo

FormulaMut.FunctionArgDefs = {};

/*
#
# SocialCalc.Formula.StoreIoEventFormula(function_name, coord, operand_reverse, sheet, io_parameters)
# 
# store forumla parameters of io event formulas
#
# enable lookup of ioForumalas when a trigger formula is activated 
# store formula details in sheet.ioEventTree  and sheet.ioParameterList 
#
*/
// eddy StoreIoEventFormula
/**
 * @param {string} function_name
 * @param {string} coord
 * @param {any[]} operand_reverse
 * @param {any} sheet
 * @param {string} io_parameters
 */
FormulaMut.StoreIoEventFormula = function (
  function_name,
  coord,
  operand_reverse,
  sheet,
  io_parameters,
) {
  var operand: any[] = [];
  SocialCalc.Formula.Clone(operand, operand_reverse);
  operand.reverse(); // normal parameter order
  if (operand.length == 0) return;

  if (typeof sheet.ioEventTree === "undefined") sheet.ioEventTree = {}; // action formulas - e.g. COPYVALUE, COPYFORMULA  - these action formulas are triggered by a trigger formula
  if (typeof sheet.ioParameterList === "undefined") sheet.ioParameterList = {}; // widget parameters - e.g. BUTTON, TEXTBOX - this is updated when the widget state changes
  if (typeof sheet.ioTimeTriggerList === "undefined") sheet.ioTimeTriggerList = {}; //
  if (typeof sheet.radioGroupList === "undefined") sheet.radioGroupList = {}; //

  // store parameters of each action formulas
  if (typeof sheet.ioParameterList[coord] === "undefined") sheet.ioParameterList[coord] = {};
  sheet.ioParameterList[coord] = operand;
  sheet.ioParameterList[coord].function_name = function_name;

  // add radio buttons to list - so radio group can be updated
  //  if(function_name == "RADIOBUTTON") {
  //
  //    if(operand.length > 1) {
  //      if (sheet.radioGroupList[]) {
  //        sheet.radioGroup.push()
  //      } else {
  //
  //      }
  //    }
  //  }

  // send trigger times to server if changed
  if (io_parameters == "TimeTrigger") {
    // timer trigger formula exists
    // function to push cell time into array
    var PushTriggerTime = function (list: any[], coordA1: string, sheetData: any) {
      var cell = sheetData.cells[coordA1];
      if (typeof cell !== "undefined" && cell.valuetype.charAt(0) == "n") {
        // if not blank and is number
        list.push(cell.datavalue);
      }
    };

    var triggerTimeCellId = SocialCalc.Formula.PlainCoord(operand[0].value); // strip dollar signs

    var currentTriggerTimeList: any[] = [];

    if (operand[0].type == "range") {
      let rangeinfo: any = SocialCalc.Formula.DecodeRangeParts(sheet, triggerTimeCellId);
      for (var i = 0; i < rangeinfo.ncols; i++) {
        for (var j = 0; j < rangeinfo.nrows; j++) {
          var cellCoord = SocialCalc.crToCoord(rangeinfo.col1num + i, rangeinfo.row1num + j);
          PushTriggerTime(currentTriggerTimeList, cellCoord, sheet);
        }
      }
    }

    if (operand[0].type == "coord") {
      PushTriggerTime(currentTriggerTimeList, triggerTimeCellId, sheet);
    }

    if (operand[0].type.charAt(0) == "n") {
      currentTriggerTimeList.push(operand[0].value);
    }

    // if time triggers changed then set changed times in ioTimeTrigger and schedule
    if (
      typeof sheet.ioTimeTriggerList[coord] === "undefined" ||
      SocialCalc.Formula.ArrayValuesEqual(sheet.ioTimeTriggerList[coord], currentTriggerTimeList) ==
        false
    ) {
      // set the time+cell in ioTimeTrigger
      sheet.ioTimeTriggerList[coord] = currentTriggerTimeList;
      // schedule the set Time Trigger // sheet.ScheduleSheetCommands('...
      var timeZoneOffsetMins = new Date().getTimezoneOffset();
      var start_1_1_1970 = 25569; // Day number of 1/1/1970 starting with 1/1/1900 as 1
      var triggerUTCTimeList = []; /// EPOCH in Mins - Mins since 1/1/1970 GMT
      for (var index = 0; index < currentTriggerTimeList.length; ++index)
        triggerUTCTimeList[index] = Math.floor(
          (currentTriggerTimeList[index] - start_1_1_1970) * 24 * 60 + timeZoneOffsetMins,
        );
      sheet.ScheduleSheetCommands("settimetrigger " + coord + " " + triggerUTCTimeList.toString());
    }
  }

  // store trigger lookup table
  if (io_parameters == "EventTree" && (operand[0].type == "coord" || operand[0].type == "range")) {
    // trigger cell exists
    // create a list of action formulas for each trigger cell
    var triggerCellId = operand[0].value.replace(/\$/g, ""); // strip dollar signs
    var PushTriggerCord = function (list: any, index: string, v: string) {
      if (typeof list[index] === "undefined") list[index] = {};
      list[index][v] = v;
    };

    if (operand[0].type == "range") {
      var rangeinfo: any = SocialCalc.Formula.DecodeRangeParts(sheet, triggerCellId);
      for (var i = 0; i < rangeinfo.ncols; i++) {
        for (var j = 0; j < rangeinfo.nrows; j++) {
          var cellcr = SocialCalc.crToCoord(rangeinfo.col1num + i, rangeinfo.row1num + j);
          PushTriggerCord(sheet.ioEventTree, cellcr, coord);
        }
      }
    }
    if (operand[0].type == "coord") {
      PushTriggerCord(sheet.ioEventTree, triggerCellId, coord);
    }
  }

  //IF GUI widget is "Input"
  if (io_parameters == "Input") {
    // Headless sheets have neither control nor viewer object — skip form-data
    // side effects without throwing so TEXTBOX recalc can finish.
    var formDataViewer = null;
    if (SocialCalc.CurrentSpreadsheetControlObject != null) {
      formDataViewer = SocialCalc.CurrentSpreadsheetControlObject.formDataViewer;
    } else if (SocialCalc.CurrentSpreadsheetViewerObject != null) {
      formDataViewer = SocialCalc.CurrentSpreadsheetViewerObject.formDataViewer;
    }
    if (formDataViewer == null) {
      return;
    }

    if (formDataViewer != null && formDataViewer.loaded == true) {
      // IF formFields  not loaded - load formFields
      if (formDataViewer.formFields == null) SocialCalc.Formula.LoadFormFields();
      //  get formFieldName
      var formFieldName = (function_name + coord).toLowerCase();
      //  if formFieldName not in formFields
      var sheetCmd = null;
      if (formDataViewer.formFields[formFieldName] == null) {
        //    store formFieldName of gui input widget
        //    add formFieldName  to formFields
        var col = (formDataViewer.formFields[formFieldName] =
          formDataViewer.formFieldsLength++ + 2);
        //    add formFieldName to next empty cell (starting with B1)
        var headerCoord = SocialCalc.crToCoord(col, 1);
        sheetCmd =
          "set " +
          headerCoord +
          " text t " +
          SocialCalc.encodeForSave(function_name.toLowerCase() + coord);
      }
      if (operand[0].type.charAt(0) == "t" || operand[0].type.charAt(0) == "n") {
        var valueCoord = SocialCalc.crToCoord(formDataViewer.formFields[formFieldName], 2);
        if (
          formDataViewer.sheet.cells[valueCoord] == null ||
          formDataViewer.sheet.cells[valueCoord].datavalue != operand[0].value
        ) {
          var sheetCmdTwo =
            "set " + valueCoord + " text t " + SocialCalc.encodeForSave(operand[0].value);
          if (sheetCmd != null) sheetCmd = sheetCmd + "\n" + sheetCmdTwo;
          else sheetCmd = sheetCmdTwo;
        }
      }
      if (sheetCmd != null) formDataViewer.sheet.ScheduleSheetCommands(sheetCmd, false);
    }
  }

  //SocialCalc.DebugLog({ ioEventTree: sheet.ioEventTree});
  //SocialCalc.DebugLog({ ioParameterList: sheet.ioParameterList});
};

// ArrayValuesEqual moved to js/formula-parse.ts (typechecked pure core).

/**
 * @param {any} destination
 * @param {any} source
 */
FormulaMut.Clone = function (destination, source) {
  for (var property in source) {
    if (
      typeof source[property] === "object" &&
      source[property] !== null &&
      destination[property]
    ) {
      SocialCalc.Formula.Clone(destination[property], source[property]);
    } else {
      destination[property] = source[property];
    }
  }
};

/**
 * LoadFormFields
 *
 * Load the fieldNames of the form
 *  Cell A1 contains "FieldName:" and cells B1 to n contain field names
 *  Cell A2 contains "Pending" - pending data row. The pending row is moved to row 3 by inseting a new row 2 onSubmit
 *  Put the fieldNames into an array for fast lookup and position information
 */

FormulaMut.LoadFormFields = function () {
  var formDataViewer =
    SocialCalc.CurrentSpreadsheetControlObject != null
      ? SocialCalc.CurrentSpreadsheetControlObject.formDataViewer
      : SocialCalc.CurrentSpreadsheetViewerObject!.formDataViewer;

  formDataViewer.formFields = {};

  //IF cell A1 is blank - Adds "FieldName:" to A1
  if (formDataViewer.sheet.cells.A1 == null) {
    formDataViewer.sheet.ScheduleSheetCommands(
      "set A1 text t " + SocialCalc.encodeForSave("FieldName:"),
      false,
    );
  }

  if (formDataViewer.sheet.cells.A2 == null) {
    formDataViewer.sheet.ScheduleSheetCommands(
      "set A2 text t " + SocialCalc.encodeForSave("Pending:"),
      false,
    );
  }

  //  For each cell in row 1, from B1 to 1st blank cell
  var col = 2;
  while (true) {
    var coord = SocialCalc.crToCoord(col, 1);
    var cell = formDataViewer.sheet.cells[coord];
    if (!cell) break;
    //    Put cell value into formFields
    formDataViewer.formFields[cell.datavalue.toLowerCase()] = col;
    col++;
  }
  formDataViewer.formFieldsLength = col - 2;
};

/*
#
# errortext = SocialCalc.Formula.CalculateFunction(fname, operand, sheet)
#
# Dispatches for function fname.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any} sheet
 * @param {string} [coord]
 */
FormulaMut.CalculateFunction = function (fname, operand, sheet, coord) {
  var fobj, ffunc, argnum, ttext;
  var foperand: any[];
  var scf = SocialCalc.Formula;
  var errortext: any = "";

  fobj = scf.FunctionList[fname];

  if (fobj) {
    foperand = [];
    ffunc = fobj[0];
    argnum = fobj[1];
    scf.CopyFunctionArgs(operand, foperand);

    // Bare name and empty-call share RPN (function_start + name), so N and N()
    // are indistinguishable here. Prefer a defined sheet name over FunctionList
    // when there are no arguments: `name define N =…` / `SUM =…` / `PI =…`.
    // Must run before IO StoreIoEventFormula so named BUTTON/EMAIL* do not register.
    if (foperand.length === 0 && sheet.names && sheet.names[fname.toUpperCase()]) {
      scf.PushOperand(operand, "name", fname);
      return "";
    }

    // eddy CalculateFunction {
    if (fobj[6] && fobj[6] != "") {
      SocialCalc.DebugLog("action:" + fname);
      scf.StoreIoEventFormula(fname, coord as string, foperand, sheet, fobj[6]);
    }
    // }
    if (argnum != 100) {
      if (argnum < 0) {
        if (foperand.length < -argnum) {
          errortext = scf.FunctionArgsError(fname, operand);
          return errortext;
        }
      } else {
        if (foperand.length != argnum) {
          errortext = scf.FunctionArgsError(fname, operand);
          return errortext;
        }
      }
    }

    errortext = ffunc(fname, operand, foperand, sheet, coord);
  } else {
    ttext = fname;

    if (operand.length && operand[operand.length - 1].type == "start") {
      // no arguments - name or zero arg function
      operand.pop();
      scf.PushOperand(operand, "name", ttext);
    } else {
      errortext = SocialCalc.Constants.s_sheetfuncunknownfunction + " " + ttext + ". ";
    }
  }

  return errortext;
};

//
// SocialCalc.Formula.PushOperand(operand, t, v)
//
// Pushes the type and value onto the operand stack
//

// PushOperand moved to js/formula-parse.ts (typechecked pure core).

//
// SocialCalc.Formula.CopyFunctionArgs(operand, foperand)
//
// Pops operands from operand and pushes on foperand up to function start
// reversing order in the process.
//

// CopyFunctionArgs moved to js/formula-parse.ts (typechecked pure core).

//
// errortext = SocialCalc.Formula.FunctionArgsError(fname, operand)
//
// Pushes appropriate error on operand stack and returns errortext, including fname
//

/**
 * @param {string} fname
 * @param {any[]} operand
 */
FormulaMut.FunctionArgsError = function (fname, operand) {
  var errortext: any = SocialCalc.Constants.s_calcerrincorrectargstofunction + " " + fname + ". ";
  SocialCalc.Formula.PushOperand(operand, "e#VALUE!", errortext);

  return errortext;
};

//
// errortext = SocialCalc.Formula.FunctionSpecificError(fname, operand, errortype, errortext)
//
// Pushes specified error and text on operand stack.
//

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any} errortype
 * @param {string} errortext
 */
FormulaMut.FunctionSpecificError = function (fname, operand, errortype, errortext) {
  SocialCalc.Formula.PushOperand(operand, errortype, errortext);

  return errortext;
};

//
// haserror = SocialCalc.Formula.CheckForErrorValue(operand, v)
//
// If v.type is an error, push it on operand stack and return true, otherwise return false.
//

/**
 * @param {any[]} operand
 * @param {any} v
 */
FormulaMut.CheckForErrorValue = function (operand, v) {
  if (v.type.charAt(0) == "e") {
    operand.push(v);
    return true;
  } else {
    return false;
  }
};

/////////////////////////
//
// FUNCTION INFORMATION ROUTINES
//

//
// SocialCalc.Formula.FillFunctionInfo()
//
// Goes through function definitions and fills out FunctionArgDefs and FunctionClasses.
// Execute this after any changes to SocialCalc.Constants but before UI is used.
//

FormulaMut.FillFunctionInfo = function () {
  var scf = SocialCalc.Formula;
  var scc = SocialCalc.Constants;

  var fname, f, classes, cname, i;

  if (scf.FunctionClasses) {
    // only do once
    return;
  }

  for (fname in scf.FunctionList) {
    f = scf.FunctionList[fname];
    if (f[2]) {
      // has an arg def
      scf.FunctionArgDefs[f[2]] = scc["s_farg_" + f[2]] || ""; // get it from constants
    }
    if (!f[3]) {
      // no text def, see if in constants
      if (scc["s_fdef_" + fname]) {
        scf.FunctionList[fname][3] = scc["s_fdef_" + fname];
      }
    }
  }

  scf.FunctionClasses = {};

  for (i = 0; i < scc.function_classlist.length; i++) {
    cname = scc.function_classlist[i];
    scf.FunctionClasses[cname] = { name: scc["s_fclass_" + cname], items: [] };
  }

  for (fname in scf.FunctionList) {
    f = scf.FunctionList[fname];
    classes = f[4] ? f[4].split(",") : []; // get classes
    classes.push("all");
    for (i = 0; i < classes.length; i++) {
      cname = classes[i];
      scf.FunctionClasses[cname].items.push(fname);
    }
  }
  for (cname in scf.FunctionClasses) {
    scf.FunctionClasses[cname].items.sort();
  }
};

//
// str = SocialCalc.Formula.FunctionArgString(fname)
//
// Returns a string representing the arguments to function fname.
//

/** @param {string} fname */
FormulaMut.FunctionArgString = function (fname) {
  var scf = SocialCalc.Formula;
  var fdata = scf.FunctionList[fname];
  var nargs, i, str;

  var adef = fdata[2];

  if (!adef) {
    nargs = fdata[1];
    if (nargs == 0) {
      adef = " ";
    } else if (nargs > 0) {
      str = "v1";
      for (i = 2; i <= nargs; i++) {
        str += ", v" + i;
      }
      return str;
    } else {
      // nargs < 0: variable-arg form
      str = "v1";
      for (i = 2; i < -nargs; i++) {
        str += ", v" + i;
      }
      return str + ", ...";
    }
  }

  str = scf.FunctionArgDefs[adef] || adef;

  return str;
};

/////////////////////////
//
// FUNCTION DEFINITIONS
//
// The standard function definitions follow.
//
// Note that some need SocialCalc.DetermineValueType to be defined.
//

/*
#
# AVERAGE(v1,c1:c2,...)
# CONCAT(value_or_range,...)
# CONCATENATE(value_or_range,...)
# COUNT(v1,c1:c2,...)
# COUNTA(v1,c1:c2,...)
# COUNTBLANK(v1,c1:c2,...)
# MAX(v1,c1:c2,...)
# MIN(v1,c1:c2,...)
# PRODUCT(v1,c1:c2,...)
# STDEV(v1,c1:c2,...)
# STDEVP(v1,c1:c2,...)
# SUM(v1,c1:c2,...)
# VAR(v1,c1:c2,...)
# VARP(v1,c1:c2,...)
#
# Calculate all of these and then return the desired one (overhead is in accessing not calculating)
# If this routine is changed, check the dseries_functions, too.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SeriesFunctions = function (fname, operand, foperand, sheet) {
  var value1, t, v1;

  var scf = SocialCalc.Formula;
  var operand_value_and_type = scf.OperandValueAndType;
  var lookup_result_type = scf.LookupResultType;
  var typelookupplus = scf.TypeLookupTable.plus;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var concat = "";
  var sum = 0;
  var resulttypesum = "";
  var count = 0;
  var counta = 0;
  var countblank = 0;
  var product = 1;
  var maxval;
  var minval;
  var mk = 0,
    sk = 0,
    mk1 = 0,
    sk1 = 0; // For variance, etc.: M sub k, k-1, and S sub k-1
  // as per Knuth "The Art of Computer Programming" Vol. 2 3rd edition, page 232
  var sumsq = 0; // SUMSQ(v1,c1:c2,...) — sum of squares of numeric operands.

  while (foperand.length > 0) {
    value1 = operand_value_and_type(sheet, foperand);
    t = value1.type.charAt(0);
    if (t == "n") count += 1;
    if (t != "b") counta += 1;
    if (t == "b") countblank += 1;
    if (t != "e" && t != "b") concat = concat + value1.value;

    if (t == "n") {
      v1 = value1.value - 0; // get it as a number
      sum += v1;
      sumsq += v1 * v1;
      product *= v1;
      maxval = maxval != undefined ? (v1 > maxval ? v1 : maxval) : v1;
      minval = minval != undefined ? (v1 < minval ? v1 : minval) : v1;
      if (count == 1) {
        // initialize with first values for variance used in STDEV, VAR, etc.
        mk1 = v1;
        sk1 = 0;
      } else {
        // Accumulate S sub 1 through n as per Knuth noted above
        mk = mk1 + (v1 - mk1) / count;
        sk = sk1 + (v1 - mk1) * (v1 - mk);
        sk1 = sk;
        mk1 = mk;
      }
      resulttypesum = lookup_result_type(value1.type, resulttypesum || value1.type, typelookupplus);
    } else if (t == "e" && resulttypesum.charAt(0) != "e") {
      resulttypesum = value1.type;
    }
  }

  resulttypesum = resulttypesum || "n";

  switch (fname) {
    case "CONCAT":
    case "CONCATENATE":
      PushOperand("t", concat);
      break;

    case "SUM":
      PushOperand(resulttypesum, sum);
      break;

    case "PRODUCT": // may handle cases with text differently than some other spreadsheets
      PushOperand(resulttypesum, product);
      break;

    case "MIN":
      PushOperand(resulttypesum, minval || 0);
      break;

    case "MAX":
      PushOperand(resulttypesum, maxval || 0);
      break;

    case "COUNT":
      PushOperand("n", count);
      break;

    case "COUNTA":
      PushOperand("n", counta);
      break;

    case "COUNTBLANK":
      PushOperand("n", countblank);
      break;

    case "AVERAGE":
      if (count > 0) {
        PushOperand(resulttypesum, sum / count);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "STDEV":
    case "STDEV.S":
      if (count > 1) {
        PushOperand(resulttypesum, Math.sqrt(sk / (count - 1))); // sk is never negative according to Knuth
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "STDEVP":
      if (count > 1) {
        PushOperand(resulttypesum, Math.sqrt(sk / count));
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "STDEV.P":
      // Population variance is well-defined for a single point (0), unlike
      // sample variance/STDEV — Excel/Sheets STDEV.P(x) == 0, not #DIV/0!.
      // Legacy STDEVP intentionally keeps its original count>1 requirement
      // above; this is exclusive to the modern name.
      if (count > 1) {
        PushOperand(resulttypesum, Math.sqrt(sk / count));
      } else if (count == 1) {
        PushOperand(resulttypesum, 0);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "VAR":
    case "VAR.S":
      if (count > 1) {
        PushOperand(resulttypesum, sk / (count - 1));
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "VARP":
      if (count > 1) {
        PushOperand(resulttypesum, sk / count);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "VAR.P":
      // Same population-variance-at-n=1 rationale as STDEV.P above.
      if (count > 1) {
        PushOperand(resulttypesum, sk / count);
      } else if (count == 1) {
        PushOperand(resulttypesum, 0);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "SUMSQ":
      PushOperand(resulttypesum, sumsq);
      break;
  }

  return null;
};

//*********************
//
// Docs see - Function Handling - ~line 1560
//
//*********************

// Add to function list
SocialCalc.Formula.FunctionList["AVERAGE"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["CONCAT"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "text",
];
SocialCalc.Formula.FunctionList["CONCATENATE"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "text",
];
SocialCalc.Formula.FunctionList["COUNT"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["COUNTA"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["COUNTBLANK"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["MAX"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["MIN"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["PRODUCT"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["STDEV"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["STDEVP"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["SUM"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["VAR"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["VARP"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["STDEV.S"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["STDEV.P"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["VAR.S"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["VAR.P"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["SUMSQ"] = [
  SocialCalc.Formula.SeriesFunctions,
  -1,
  "vn",
  null,
  "stat",
];

/*
#
# RANK(number,ref,[order])
# MEDIAN(v1,c1:c2,...)
# QUARTILE(range,quart)
#
# Order statistics: unlike SeriesFunctions, these need the full sorted list of
# numeric values, not just running accumulators, so they get their own
# subroutine. Extraction/skip/error-propagation conventions (numeric-only,
# blank/text ignored, first range error wins) mirror SeriesFunctions above.
#
*/

/**
 * Collect the numeric values from one or more scalar/range operands,
 * draining foperand via OperandValueAndType (so ranges/cross-sheet refs/
 * blanks/text are resolved exactly as SeriesFunctions resolves them).
 * Returns {values, errortype} where errortype is set to the first
 * non-numeric error type encountered (blank/text members are skipped, not
 * errors).
 */
FormulaMut.CollectNumericValues = function (
  sheet: SocialCalc.Sheet,
  foperand: SocialCalc.FormulaOperand[],
): { values: number[]; errortype: SocialCalc.FormulaOperandType | "" } {
  var scf = SocialCalc.Formula;
  var operand_value_and_type = scf.OperandValueAndType;
  var values: number[] = [];
  var errortype: SocialCalc.FormulaOperandType | "" = "";
  var value1: SocialCalc.FormulaValueResult, t: string;

  while (foperand.length > 0) {
    value1 = operand_value_and_type(sheet, foperand);
    t = value1.type.charAt(0);
    if (t == "n") {
      values.push((value1.value as number) - 0);
    } else if (t == "e" && !errortype) {
      errortype = value1.type; // preserve first encountered range error
    }
    // text/blank members are ignored, matching SeriesFunctions
  }

  return { values: values, errortype: errortype };
};

/**
 * Parallel-walk two equal-shaped range/coord operands (e.g. known_y's and
 * known_x's), collecting only the numeric pairs where BOTH sides resolve
 * to a number -- the paired-range analogue of CollectNumericValues, shared
 * by CORREL/COVARIANCE.P/COVARIANCE.S/SLOPE/INTERCEPT/RSQ/FORECAST.LINEAR.
 * Blank/text on EITHER side skips that pair entirely (a pairwise skip,
 * unlike CollectNumericValues' single-range skip, since the two series
 * must stay index-aligned). Logicals (type "nl") are numeric here
 * (charAt(0)=="n"), the existing SocialCalc-wide convention this facade
 * intentionally does not special-case away from — see the inline comment
 * below for the resulting, pre-existing divergence from Excel/Sheets'
 * documented "text, logical values ... ignored" rule
 * (support.microsoft.com/en-us/excel/functions/covariance-p-function).
 *
 * Shape mismatch (a genuinely different element count between the two
 * operands after both are materialized) is reported via `mismatched`, not
 * silently truncated to the shorter length -- callers push #N/A per the
 * documented "different number of data points ... #N/A" convention.
 */
FormulaMut.CollectPairedNumericValues = function (
  sheet: SocialCalc.Sheet,
  yOperand: SocialCalc.FormulaOperand,
  xOperand: SocialCalc.FormulaOperand,
): {
  ys: number[];
  xs: number[];
  errortype: SocialCalc.FormulaOperandType | "";
  mismatched: boolean;
} {
  var scf = SocialCalc.Formula;
  var yArray = scf.MaterializeArray(sheet, yOperand);
  var xArray = scf.MaterializeArray(sheet, xOperand);
  if (!yArray || !xArray) {
    return { ys: [], xs: [], errortype: "e#VALUE!", mismatched: false };
  }
  var yFlat = yArray.cells.reduce(function (acc, row) {
    return acc.concat(row);
  }, [] as SocialCalc.FormulaArrayCell[]);
  var xFlat = xArray.cells.reduce(function (acc, row) {
    return acc.concat(row);
  }, [] as SocialCalc.FormulaArrayCell[]);
  if (yFlat.length != xFlat.length) {
    return { ys: [], xs: [], errortype: "", mismatched: true };
  }
  var ys: number[] = [];
  var xs: number[] = [];
  var errortype: SocialCalc.FormulaOperandType | "" = "";
  for (var i = 0; i < yFlat.length; i++) {
    var yt = yFlat[i]!.type.charAt(0);
    var xt = xFlat[i]!.type.charAt(0);
    if (yt == "e" && !errortype) errortype = yFlat[i]!.type;
    if (xt == "e" && !errortype) errortype = xFlat[i]!.type;
    if (yt == "n" && xt == "n") {
      ys.push((yFlat[i]!.value as number) - 0);
      xs.push((xFlat[i]!.value as number) - 0);
    }
    // blank/text on either side: skip the pair (not an error). Logicals
    // (type "nl") have charAt(0)=="n" and are therefore treated as numeric
    // 1/0 here, matching CollectNumericValues/SeriesFunctions' existing
    // SocialCalc-wide convention -- Excel/Sheets instead ignore logicals
    // in these paired-range args, a known, pre-existing platform
    // divergence (same category as this codebase's other n*/logical
    // coercion choices), not something newly introduced by this function.
  }
  return { ys: ys, xs: xs, errortype: errortype, mismatched: false };
};

/**
 * RANK(number,ref,[order]), MEDIAN(v1,c1:c2,...), QUARTILE(range,quart).
 *
 * Order statistics: unlike SeriesFunctions, these need the full sorted list
 * of numeric values, not just running accumulators, so they get their own
 * subroutine. Extraction/skip/error-propagation conventions (numeric-only,
 * blank/text ignored, first range error wins) mirror SeriesFunctions above.
 */
FormulaMut.RankMedianQuartileFunctions = function (
  fname: string,
  operand: SocialCalc.FormulaOperand[],
  foperand: SocialCalc.FormulaOperand[],
  sheet: SocialCalc.Sheet,
) {
  var scf = SocialCalc.Formula;

  var PushOperand = function (t: SocialCalc.FormulaOperandType, v: unknown) {
    operand.push({ type: t, value: v });
  };

  if (fname == "RANK" || fname == "RANK.EQ" || fname == "RANK.AVG") {
    // RANK(number, ref, [order]) -- args arrive in foperand in call order.
    // RANK.EQ is an exact alias; RANK.AVG averages ranks across ties.
    var numberoperand = scf.OperandAsNumber(sheet, foperand);
    if (numberoperand.type.charAt(0) != "n") {
      // Excel: RANK requires number to resolve to a number; no established
      // equivalent error convention here beyond propagating an existing error.
      PushOperand(numberoperand.type, 0);
      return;
    }
    var number = (numberoperand.value as number) - 0;

    var refoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (refoperand.type != "range" && refoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var reflist: SocialCalc.FormulaOperand[] = [refoperand];
    var collected = scf.CollectNumericValues(sheet, reflist);
    if (collected.errortype) {
      PushOperand(collected.errortype, 0);
      return;
    }

    var order = 0;
    if (foperand.length) {
      var orderoperand = scf.OperandAsNumber(sheet, foperand);
      if (orderoperand.type.charAt(0) != "n") {
        PushOperand(orderoperand.type, 0);
        return;
      }
      order = (orderoperand.value as number) - 0;
      if (foperand.length) {
        // too many arguments: RANK accepts at most number, ref, order
        scf.FunctionArgsError(fname, operand);
        return;
      }
    }

    var rank = 0;
    var tieCount = 0;
    var found = false;
    var values = collected.values;
    for (var i = 0; i < values.length; i++) {
      if (values[i] === number) {
        found = true;
        tieCount++;
      } else if (order == 0) {
        if (values[i]! > number) rank++;
      } else {
        if (values[i]! < number) rank++;
      }
    }
    if (!found) {
      PushOperand("e#N/A", 0); // Excel RANK behavior: number absent from ref
      return;
    }
    var bestRank = rank + 1; // ties share the best (lowest) rank
    if (fname == "RANK.AVG") {
      // doubledAverageRank is the exact-integer Dafny-verified core
      // (lemma/statistics.ts); halving here is the unverified real-space
      // bridge — mirrors lemma/spill.ts's planSpillRectangle split.
      PushOperand("n", scf.DoubledAverageRank(bestRank, tieCount) / 2);
    } else {
      PushOperand("n", bestRank);
    }
    return;
  }

  if (fname == "QUARTILE" || fname == "QUARTILE.INC") {
    var rangeoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (rangeoperand.type != "range" && rangeoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var quartoperand = scf.OperandAsNumber(sheet, foperand);
    if (quartoperand.type.charAt(0) != "n") {
      PushOperand(quartoperand.type, 0);
      return;
    }
    // MS-documented legacy QUARTILE/QUARTILE.INC behavior: truncate a
    // noninteger quart toward zero before validating the 0..4 domain.
    var quartvalue = quartoperand.value as number;
    var quart = quartvalue < 0 ? Math.ceil(quartvalue) : Math.floor(quartvalue);
    if (quart < 0 || quart > 4) {
      PushOperand("e#NUM!", 0);
      return;
    }
    var rangelist: SocialCalc.FormulaOperand[] = [rangeoperand];
    var qcollected = scf.CollectNumericValues(sheet, rangelist);
    if (qcollected.errortype) {
      PushOperand(qcollected.errortype, 0);
      return;
    }
    if (!qcollected.values.length) {
      PushOperand("e#NUM!", 0); // empty numeric input
      return;
    }
    var qsorted = qcollected.values.sort(function (a: number, b: number) {
      return a - b;
    });
    var n = qsorted.length;
    if (n == 1) {
      PushOperand("n", qsorted[0]);
      return;
    }
    // Excel QUARTILE.INC linear interpolation, quart in 0..4 => p in 0..1.
    var p = quart / 4;
    var pos = p * (n - 1);
    var lo = Math.floor(pos);
    var hi = Math.ceil(pos);
    var frac = pos - lo;
    var result = qsorted[lo]! + frac * (qsorted[hi]! - qsorted[lo]!);
    PushOperand("n", result);
    return;
  }

  if (fname == "QUARTILE.EXC") {
    var excrangeoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (excrangeoperand.type != "range" && excrangeoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var excquartoperand = scf.OperandAsNumber(sheet, foperand);
    if (excquartoperand.type.charAt(0) != "n") {
      PushOperand(excquartoperand.type, 0);
      return;
    }
    // "If quart is not an integer, it is truncated" (docs.microsoft.com/
    // quartile-exc-function), same toward-zero truncation as QUARTILE.INC.
    var excquartvalue = excquartoperand.value as number;
    var excquart = excquartvalue < 0 ? Math.ceil(excquartvalue) : Math.floor(excquartvalue);
    if (excquart <= 0 || excquart >= 4) {
      // "If quart <= 0 or if quart >= 4 ... #NUM!" -- unlike QUARTILE.INC,
      // the exclusive method never accepts the 0/4 (min/max) endpoints.
      PushOperand("e#NUM!", 0);
      return;
    }
    var excrangelist: SocialCalc.FormulaOperand[] = [excrangeoperand];
    var exccollected = scf.CollectNumericValues(sheet, excrangelist);
    if (exccollected.errortype) {
      PushOperand(exccollected.errortype, 0);
      return;
    }
    if (!exccollected.values.length) {
      PushOperand("e#NUM!", 0); // "If array is empty ... #NUM!"
      return;
    }
    var excsorted = exccollected.values.sort(function (a: number, b: number) {
      return a - b;
    });
    var excn = excsorted.length;
    if (!scf.IsValidQuartileExcPosition(excn, excquart)) {
      // Position quart*(n+1)/4 falls outside [1,n] -- cannot interpolate.
      // Dafny-verified integer boundary check (lemma/statistics.ts); no
      // floating point involved since quart/n are both integers here.
      PushOperand("e#NUM!", 0);
      return;
    }
    var excscaled = scf.QuartileExcScaledPosition(excn, excquart); // = quart*(n+1)
    var excpos = excscaled / 4; // real 1-indexed position, unverified bridge
    var exclo = Math.floor(excpos);
    var exchi = Math.ceil(excpos);
    var excfrac = excpos - exclo;
    var excresult =
      excsorted[exclo - 1]! + excfrac * (excsorted[exchi - 1]! - excsorted[exclo - 1]!);
    PushOperand("n", excresult);
    return;
  }

  if (fname == "PERCENTILE" || fname == "PERCENTILE.INC") {
    var pirangeoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (pirangeoperand.type != "range" && pirangeoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var pikoperand = scf.OperandAsNumber(sheet, foperand);
    if (pikoperand.type.charAt(0) != "n") {
      PushOperand(pikoperand.type, 0);
      return;
    }
    var pik = pikoperand.value as number;
    if (pik < 0 || pik > 1) {
      PushOperand("e#NUM!", 0);
      return;
    }
    var pirangelist: SocialCalc.FormulaOperand[] = [pirangeoperand];
    var picollected = scf.CollectNumericValues(sheet, pirangelist);
    if (picollected.errortype) {
      PushOperand(picollected.errortype, 0);
      return;
    }
    if (!picollected.values.length) {
      PushOperand("e#NUM!", 0);
      return;
    }
    var pisorted = picollected.values.sort(function (a: number, b: number) {
      return a - b;
    });
    var pin = pisorted.length;
    if (pin == 1) {
      PushOperand("n", pisorted[0]);
      return;
    }
    var pipos = pik * (pin - 1);
    var pilo = Math.floor(pipos);
    var pihi = Math.ceil(pipos);
    var pifrac = pipos - pilo;
    var piresult = pisorted[pilo]! + pifrac * (pisorted[pihi]! - pisorted[pilo]!);
    PushOperand("n", piresult);
    return;
  }

  if (fname == "PERCENTILE.EXC") {
    var perangeoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (perangeoperand.type != "range" && perangeoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var pekoperand = scf.OperandAsNumber(sheet, foperand);
    if (pekoperand.type.charAt(0) != "n") {
      PushOperand(pekoperand.type, 0);
      return;
    }
    var pek = pekoperand.value as number;
    if (pek <= 0 || pek >= 1) {
      // "If k is <= 0 or if k >= 1, PERCENTILE.EXC returns #NUM!"
      PushOperand("e#NUM!", 0);
      return;
    }
    var perangelist: SocialCalc.FormulaOperand[] = [perangeoperand];
    var pecollected = scf.CollectNumericValues(sheet, perangelist);
    if (pecollected.errortype) {
      PushOperand(pecollected.errortype, 0);
      return;
    }
    if (!pecollected.values.length) {
      PushOperand("e#NUM!", 0);
      return;
    }
    var pesorted = pecollected.values.sort(function (a: number, b: number) {
      return a - b;
    });
    var pen = pesorted.length;
    // k is an arbitrary real (unlike QUARTILE.EXC's exact-rational quart/4),
    // so this domain check is plain floating point, not the Dafny-verified
    // integer facade -- deliberately not formalized (see lemma/statistics.ts
    // header). A small epsilon absorbs binary floating-point boundary error
    // at exact positions (e.g. k=1/(n+1) landing at pos=1 - 1e-16).
    var pepos = pek * (pen + 1);
    if (pepos < 1 - 1e-9 || pepos > pen + 1e-9) {
      PushOperand("e#NUM!", 0);
      return;
    }
    pepos = Math.min(Math.max(pepos, 1), pen);
    var pelo = Math.floor(pepos);
    var pehi = Math.ceil(pepos);
    var pefrac = pepos - pelo;
    var peresult = pesorted[pelo - 1]! + pefrac * (pesorted[pehi - 1]! - pesorted[pelo - 1]!);
    PushOperand("n", peresult);
    return;
  }

  if (fname == "PERCENTRANK" || fname == "PERCENTRANK.INC") {
    var prrangeoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (prrangeoperand.type != "range" && prrangeoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var prxoperand = scf.OperandAsNumber(sheet, foperand);
    if (prxoperand.type.charAt(0) != "n") {
      PushOperand(prxoperand.type, 0);
      return;
    }
    var prx = prxoperand.value as number;
    var prsignificance = 3;
    if (foperand.length) {
      var prsigoperand = scf.OperandAsNumber(sheet, foperand);
      if (prsigoperand.type.charAt(0) != "n") {
        PushOperand(prsigoperand.type, 0);
        return;
      }
      prsignificance = Math.floor(prsigoperand.value as number);
      if (prsignificance < 1) {
        // "If significance < 1, PERCENTRANK.INC returns the #NUM! error"
        PushOperand("e#NUM!", 0);
        return;
      }
      if (foperand.length) {
        scf.FunctionArgsError(fname, operand);
        return;
      }
    }
    var prrangelist: SocialCalc.FormulaOperand[] = [prrangeoperand];
    var prcollected = scf.CollectNumericValues(sheet, prrangelist);
    if (prcollected.errortype) {
      PushOperand(prcollected.errortype, 0);
      return;
    }
    if (!prcollected.values.length) {
      // "If array is empty, PERCENTRANK.INC returns the #NUM! error"
      PushOperand("e#NUM!", 0);
      return;
    }
    var prsorted = prcollected.values.sort(function (a: number, b: number) {
      return a - b;
    });
    var prn = prsorted.length;
    if (prn == 1) {
      // Degenerate single-point data set: rank is only defined for the
      // point itself (0, its own relative standing); any other x has no
      // established convention here, so it is treated the same way this
      // family treats "value absent from the reference" elsewhere (RANK).
      PushOperand(prx == prsorted[0] ? "n" : "e#N/A", prx == prsorted[0] ? 0 : 0);
      return;
    }
    if (prx < prsorted[0]! || prx > prsorted[prn - 1]!) {
      // Outside the data range: not a valid parameter (#NUM!) vs. a valid
      // parameter with no rank in this reference -- matches this codebase's
      // own established convention for RANK (number absent from ref).
      PushOperand("e#N/A", 0);
      return;
    }
    var prrank: number;
    var prexactidx = prsorted.indexOf(prx);
    if (prexactidx >= 0) {
      prrank = prexactidx / (prn - 1);
    } else {
      var prlo = 0;
      while (prlo < prn - 1 && prsorted[prlo + 1]! < prx) prlo++;
      var prfrac = (prx - prsorted[prlo]!) / (prsorted[prlo + 1]! - prsorted[prlo]!);
      prrank = (prlo + prfrac) / (prn - 1);
    }
    var prscale = Math.pow(10, prsignificance);
    // Truncate (not round) to `significance` digits, per documented
    // behavior; small epsilon avoids shorting an exact boundary due to
    // binary floating-point representation error.
    prrank = Math.floor(prrank * prscale + 1e-9) / prscale;
    PushOperand("n", prrank);
    return;
  }

  if (fname == "PERCENTRANK.EXC") {
    // Exclusive-method inverse of PERCENTILE.EXC: rank = position/(n+1)
    // where position is the (possibly interpolated) 1-indexed rank of x.
    var pxrangeoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (pxrangeoperand.type != "range" && pxrangeoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var pxxoperand = scf.OperandAsNumber(sheet, foperand);
    if (pxxoperand.type.charAt(0) != "n") {
      PushOperand(pxxoperand.type, 0);
      return;
    }
    var pxx = pxxoperand.value as number;
    var pxsignificance = 3;
    if (foperand.length) {
      var pxsigoperand = scf.OperandAsNumber(sheet, foperand);
      if (pxsigoperand.type.charAt(0) != "n") {
        PushOperand(pxsigoperand.type, 0);
        return;
      }
      pxsignificance = Math.floor(pxsigoperand.value as number);
      if (pxsignificance < 1) {
        PushOperand("e#NUM!", 0);
        return;
      }
      if (foperand.length) {
        scf.FunctionArgsError(fname, operand);
        return;
      }
    }
    var pxrangelist: SocialCalc.FormulaOperand[] = [pxrangeoperand];
    var pxcollected = scf.CollectNumericValues(sheet, pxrangelist);
    if (pxcollected.errortype) {
      PushOperand(pxcollected.errortype, 0);
      return;
    }
    if (!pxcollected.values.length) {
      PushOperand("e#NUM!", 0);
      return;
    }
    var pxsorted = pxcollected.values.sort(function (a: number, b: number) {
      return a - b;
    });
    var pxn = pxsorted.length;
    if (pxx < pxsorted[0]! || pxx > pxsorted[pxn - 1]!) {
      PushOperand("e#N/A", 0);
      return;
    }
    var pxrankpos: number; // 1-indexed exclusive-method position
    var pxexactidx = pxsorted.indexOf(pxx);
    if (pxexactidx >= 0) {
      pxrankpos = pxexactidx + 1;
    } else {
      var pxlo = 0;
      while (pxlo < pxn - 1 && pxsorted[pxlo + 1]! < pxx) pxlo++;
      var pxfrac = (pxx - pxsorted[pxlo]!) / (pxsorted[pxlo + 1]! - pxsorted[pxlo]!);
      pxrankpos = pxlo + 1 + pxfrac;
    }
    var pxrank = pxrankpos / (pxn + 1);
    var pxscale = Math.pow(10, pxsignificance);
    pxrank = Math.floor(pxrank * pxscale + 1e-9) / pxscale;
    PushOperand("n", pxrank);
    return;
  }

  // MEDIAN(v1, c1:c2, ...)
  var mcollected = scf.CollectNumericValues(sheet, foperand);
  if (mcollected.errortype) {
    PushOperand(mcollected.errortype, 0);
    return;
  }
  if (!mcollected.values.length) {
    // No established MEDIAN error convention upstream; follow the existing
    // AVERAGE convention for empty numeric input (js/formula1.ts SeriesFunctions).
    PushOperand("e#DIV/0!", 0);
    return;
  }
  var msorted = mcollected.values.sort(function (a: number, b: number) {
    return a - b;
  });
  var mn = msorted.length;
  var mid = Math.floor(mn / 2);
  var median = mn % 2 == 1 ? msorted[mid] : (msorted[mid - 1]! + msorted[mid]!) / 2;
  PushOperand("n", median);
  return;
};

SocialCalc.Formula.FunctionList["RANK"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  -2,
  "rank",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["MEDIAN"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  -1,
  "vn",
  null,
  "stat",
];
SocialCalc.Formula.FunctionList["QUARTILE"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  2,
  "quartile",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["RANK.EQ"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  -2,
  "rank",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["RANK.AVG"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  -2,
  "rank",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["QUARTILE.INC"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  2,
  "quartile",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["QUARTILE.EXC"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  2,
  "quartile",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["PERCENTILE"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  2,
  "percentile",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["PERCENTILE.INC"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  2,
  "percentile",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["PERCENTILE.EXC"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  2,
  "percentile",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["PERCENTRANK"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  -2,
  "percentrank",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["PERCENTRANK.INC"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  -2,
  "percentrank",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["PERCENTRANK.EXC"] = [
  SocialCalc.Formula.RankMedianQuartileFunctions,
  -2,
  "percentrank",
  "",
  "stat",
];

/*
#
# SUMPRODUCT(range1, range2, ...)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SumProductFunction = function (fname, operand, foperand, sheet) {
  var range,
    sum = 0;
  var products: any[] = [];
  var scf = SocialCalc.Formula;
  var ncols = 0,
    nrows = 0;
  var rangeinfo, i, j, k, cellcr, cell, value;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  while (foperand.length > 0) {
    range = scf.TopOfStackValueAndType(sheet, foperand);
    if (range.type != "range") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    rangeinfo = scf.DecodeRangeParts(sheet, range.value);
    if (!rangeinfo) {
      PushOperand("e#REF!", 0);
      return;
    }
    if (!ncols) ncols = rangeinfo.ncols;
    else if (ncols != rangeinfo.ncols) {
      PushOperand("e#VALUE!", 0);
      return;
    }
    if (!nrows) nrows = rangeinfo.nrows;
    else if (nrows != rangeinfo.nrows) {
      PushOperand("e#VALUE!", 0);
      return;
    }
    for (i = 0; i < rangeinfo.ncols; i++) {
      for (j = 0; j < rangeinfo.nrows; j++) {
        k = i * rangeinfo.nrows + j;
        cellcr = SocialCalc.crToCoord(rangeinfo.col1num + i, rangeinfo.row1num + j);
        cell = rangeinfo.sheetdata.GetAssuredCell(cellcr);
        value = cell.valuetype == "n" ? (cell.datavalue as any) : 0;
        products[k] = (typeof products[k] !== "undefined" ? products[k] : 1) * value;
      }
    }
  }
  for (i = 0; i < products.length; i++) {
    sum += products[i];
  }
  PushOperand("n", sum);

  return;
};

SocialCalc.Formula.FunctionList["SUMPRODUCT"] = [
  SocialCalc.Formula.SumProductFunction,
  -1,
  "rangen",
  "",
  "stat",
];

/*
#
# CORREL(known_y's, known_x's)
# COVARIANCE.P(array1, array2)
# COVARIANCE.S(array1, array2)
# SLOPE(known_y's, known_x's)
# INTERCEPT(known_y's, known_x's)
# RSQ(known_y's, known_x's)
# FORECAST(x, known_y's, known_x's)
# FORECAST.LINEAR(x, known_y's, known_x's)
# TREND(known_y's, [known_x's], [new_x's], [const])
# GROWTH(known_y's, [known_x's], [new_x's], [const])
#
# Least-squares single-variable linear (TREND/FORECAST) and exponential
# (GROWTH, via a log-space linear fit y'=ln(y)=ln(b)+x*ln(m)) regression.
# CORREL/COVARIANCE.P/COVARIANCE.S/SLOPE/INTERCEPT/RSQ share the same
# paired-range sums (Sx, Sy, Sxx, Syy, Sxy) and error-domain checks:
# both vendors document array1/array2 (or known_y's/known_x's) as pairwise
# non-numeric-skipped, mismatched-length -> #N/A. See
# CollectPairedNumericValues above for the exact pairing policy.
#
*/

/** Sx/Sy/Sxx/Syy/Sxy sums over paired numeric series -- shared by every
 * function in this dispatcher (CORREL/COVARIANCE/SLOPE/INTERCEPT/RSQ all
 * reduce to a closed-form expression over these five sums). */
FormulaMut.PairedSums = function (
  ys: number[],
  xs: number[],
): { n: number; sx: number; sy: number; sxx: number; syy: number; sxy: number } {
  var n = ys.length;
  var sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (var i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
    sxx += xs[i]! * xs[i]!;
    syy += ys[i]! * ys[i]!;
    sxy += xs[i]! * ys[i]!;
  }
  return { n: n, sx: sx, sy: sy, sxx: sxx, syy: syy, sxy: sxy };
};

/**
 * @param {string} fname
 * @param {SocialCalc.FormulaOperand[]} operand
 * @param {SocialCalc.FormulaOperand[]} foperand
 * @param {SocialCalc.Sheet} sheet
 */
FormulaMut.PairedRangeStatFunctions = function (
  fname: string,
  operand: SocialCalc.FormulaOperand[],
  foperand: SocialCalc.FormulaOperand[],
  sheet: SocialCalc.Sheet,
) {
  var scf = SocialCalc.Formula;
  var PushOperand = function (t: SocialCalc.FormulaOperandType, v: unknown) {
    operand.push({ type: t, value: v });
  };

  if (
    fname == "CORREL" ||
    fname == "COVARIANCE.P" ||
    fname == "COVARIANCE.S" ||
    fname == "SLOPE" ||
    fname == "INTERCEPT" ||
    fname == "RSQ" ||
    fname == "FORECAST" ||
    fname == "FORECAST.LINEAR"
  ) {
    // FORECAST/FORECAST.LINEAR take (x, known_y's, known_x's); the other
    // five take (known_y's/array1, known_x's/array2) -- pop x first only
    // for the FORECAST family.
    var xarg: SocialCalc.FormulaValueResult | null = null;
    if (fname == "FORECAST" || fname == "FORECAST.LINEAR") {
      xarg = scf.OperandAsNumber(sheet, foperand);
      if (xarg.type.charAt(0) != "n") {
        PushOperand(xarg.type, 0);
        return;
      }
    }
    var yoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (yoperand.type != "range" && yoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var xoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (xoperand.type != "range" && xoperand.type != "coord") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    var paired = scf.CollectPairedNumericValues(sheet, yoperand, xoperand);
    if (paired.mismatched) {
      // "If ... have a different number of data points ... #N/A" -- the
      // documented convention shared by every function in this family.
      PushOperand("e#N/A", 0);
      return;
    }
    if (paired.errortype) {
      PushOperand(paired.errortype, 0);
      return;
    }
    var sums = scf.PairedSums(paired.ys, paired.xs);
    var n = sums.n;

    if (fname == "COVARIANCE.P") {
      if (n == 0) {
        PushOperand("e#DIV/0!", 0); // "If either array is empty ... #DIV/0!"
        return;
      }
      // Population covariance: mean of products of deviations.
      var meanX = sums.sx / n,
        meanY = sums.sy / n;
      var covp = sums.sxy / n - meanX * meanY;
      PushOperand("n", covp);
      return;
    }
    if (fname == "COVARIANCE.S") {
      if (n < 2) {
        PushOperand("e#DIV/0!", 0); // "empty or ... only 1 data point ... #DIV/0!"
        return;
      }
      var smeanX = sums.sx / n,
        smeanY = sums.sy / n;
      var covs = (sums.sxy - n * smeanX * smeanY) / (n - 1);
      PushOperand("n", covs);
      return;
    }

    // CORREL/SLOPE/INTERCEPT/RSQ/FORECAST(.LINEAR) all share the same
    // "variance of x is zero -> #DIV/0!" domain check (documented for
    // FORECAST/FORECAST.LINEAR; CORREL/SLOPE/INTERCEPT/RSQ inherit the
    // identical denominator, n*Sxx - Sx^2, being zero).
    var denom = n * sums.sxx - sums.sx * sums.sx;
    if (n == 0 || denom == 0) {
      PushOperand("e#DIV/0!", 0);
      return;
    }
    var slope = (n * sums.sxy - sums.sx * sums.sy) / denom;
    var intercept = (sums.sy - slope * sums.sx) / n;

    if (fname == "SLOPE") {
      PushOperand("n", slope);
      return;
    }
    if (fname == "INTERCEPT") {
      PushOperand("n", intercept);
      return;
    }
    if (fname == "FORECAST" || fname == "FORECAST.LINEAR") {
      PushOperand("n", intercept + slope * (xarg!.value as number));
      return;
    }

    // CORREL / RSQ: r = (n*Sxy - Sx*Sy) / sqrt((n*Sxx - Sx^2)*(n*Syy - Sy^2))
    var denomY = n * sums.syy - sums.sy * sums.sy;
    if (denomY == 0) {
      PushOperand("e#DIV/0!", 0);
      return;
    }
    var r = (n * sums.sxy - sums.sx * sums.sy) / Math.sqrt(denom * denomY);
    PushOperand("n", fname == "RSQ" ? r * r : r);
    return;
  }

  // TREND(known_y's, [known_x's], [new_x's], [const])
  // GROWTH(known_y's, [known_x's], [new_x's], [const]) -- exponential fit
  // via a log-space linear regression on ln(known_y's). Arguments are
  // consumed strictly positionally (Excel's real arg model): unlike
  // CORREL/SLOPE/etc. above, known_x's and new_x's may themselves be
  // scalars (a single-point series/prediction), not just ranges -- so
  // this cannot type-sniff "is the next arg a range" to decide whether
  // it was omitted; a bare scalar in the known_x's position is a valid,
  // real single-point known_x's, not new_x's smuggled forward.
  var materializeFlat = function (
    opnd: SocialCalc.FormulaValueResult,
  ): SocialCalc.FormulaArrayValue | null {
    if (opnd.type == "array" || opnd.type == "coord" || opnd.type == "range") {
      return scf.MaterializeArray(sheet, opnd);
    }
    // Scalar (n/t/b/e...): wrap as a 1x1 array so a bare literal or
    // computed scalar is a valid single-point known_x's/new_x's, matching
    // Excel accepting e.g. TREND(known_ys, known_xs, 4) with a literal 4.
    return { rows: 1, cols: 1, cells: [[{ type: opnd.type, value: opnd.value }]] };
  };

  var tyoperand = scf.TopOfStackValueAndType(sheet, foperand);
  if (tyoperand.type != "range" && tyoperand.type != "coord") {
    PushOperand("e#VALUE!", 0);
    return;
  }
  var tyArray = scf.MaterializeArray(sheet, tyoperand);
  if (!tyArray) {
    PushOperand("e#VALUE!", 0);
    return;
  }
  var tyFlat = tyArray.cells.reduce(function (acc, row) {
    return acc.concat(row);
  }, [] as SocialCalc.FormulaArrayCell[]);

  // known_x's, defaulting to {1,2,...,count} (known_y's shape) when the
  // argument list has nothing left after known_y's.
  var txFlat: SocialCalc.FormulaArrayCell[];
  var txRows: number, txCols: number;
  if (foperand.length) {
    var txoperand = scf.TopOfStackValueAndType(sheet, foperand);
    var txArray = materializeFlat(txoperand);
    if (!txArray) {
      PushOperand("e#VALUE!", 0);
      return;
    }
    txFlat = txArray.cells.reduce(function (acc, row) {
      return acc.concat(row);
    }, [] as SocialCalc.FormulaArrayCell[]);
    txRows = txArray.rows;
    txCols = txArray.cols;
  } else {
    txFlat = tyFlat.map(function (_cell, idx) {
      return { type: "n", value: idx + 1 } as SocialCalc.FormulaArrayCell;
    });
    txRows = tyArray.rows;
    txCols = tyArray.cols;
  }
  if (txFlat.length != tyFlat.length) {
    PushOperand("e#N/A", 0);
    return;
  }

  // new_x's, defaulting to known_x's (same shape) when the argument list
  // has nothing left after known_x's.
  var newXFlat: SocialCalc.FormulaArrayCell[];
  var newRows: number, newCols: number;
  if (foperand.length) {
    var newXoperand = scf.TopOfStackValueAndType(sheet, foperand);
    var newXArray = materializeFlat(newXoperand);
    if (!newXArray) {
      PushOperand("e#VALUE!", 0);
      return;
    }
    newXFlat = newXArray.cells.reduce(function (acc, row) {
      return acc.concat(row);
    }, [] as SocialCalc.FormulaArrayCell[]);
    newRows = newXArray.rows;
    newCols = newXArray.cols;
  } else {
    newXFlat = txFlat;
    newRows = txRows;
    newCols = txCols;
  }

  // const: force intercept b to 0 (TREND) / 1 (GROWTH) when explicitly
  // FALSE; defaults to normal fit (true) when omitted.
  var forceConst = true;
  if (foperand.length) {
    var constoperand = scf.OperandAsNumber(sheet, foperand);
    if (constoperand.type.charAt(0) != "n") {
      PushOperand(constoperand.type, 0);
      return;
    }
    forceConst = constoperand.value != 0;
    if (foperand.length) {
      scf.FunctionArgsError(fname, operand);
      return;
    }
  }

  var fitYs: number[] = [];
  var fitXs: number[] = [];
  var fitError: SocialCalc.FormulaOperandType | "" = "";
  for (var ti = 0; ti < tyFlat.length; ti++) {
    var tyt = tyFlat[ti]!.type.charAt(0);
    var txt = txFlat[ti]!.type.charAt(0);
    if (tyt == "e" && !fitError) fitError = tyFlat[ti]!.type;
    if (txt == "e" && !fitError) fitError = txFlat[ti]!.type;
    if (tyt == "n" && txt == "n") {
      var yv = tyFlat[ti]!.value as number;
      if (fname == "GROWTH") {
        if (yv <= 0) {
          PushOperand("e#NUM!", 0); // "any ... known_y's is 0 or negative -> #NUM!"
          return;
        }
        fitYs.push(Math.log(yv));
      } else {
        fitYs.push(yv);
      }
      fitXs.push(txFlat[ti]!.value as number);
    }
  }
  if (fitError) {
    PushOperand(fitError, 0);
    return;
  }
  var fitSums = scf.PairedSums(fitYs, fitXs);
  var fn2 = fitSums.n;
  var fitSlope: number, fitIntercept: number;
  if (!forceConst) {
    // b forced to 0 (TREND) / 1 (GROWTH, i.e. ln(b)=0): fit y=mx through
    // the origin, m = Sxy / Sxx.
    if (fitSums.sxx == 0) {
      PushOperand("e#DIV/0!", 0);
      return;
    }
    fitSlope = fitSums.sxy / fitSums.sxx;
    fitIntercept = 0;
  } else {
    var fitDenom = fn2 * fitSums.sxx - fitSums.sx * fitSums.sx;
    if (fn2 == 0 || fitDenom == 0) {
      PushOperand("e#DIV/0!", 0);
      return;
    }
    fitSlope = (fn2 * fitSums.sxy - fitSums.sx * fitSums.sy) / fitDenom;
    fitIntercept = (fitSums.sy - fitSlope * fitSums.sx) / fn2;
  }

  var outCells: SocialCalc.FormulaArrayCell[][] = [];
  for (var r = 0; r < newRows; r++) {
    var rowCells: SocialCalc.FormulaArrayCell[] = [];
    for (var c = 0; c < newCols; c++) {
      var idx = r * newCols + c;
      var cell = newXFlat[idx];
      if (!cell || cell.type.charAt(0) != "n") {
        rowCells.push({ type: "e#VALUE!", value: 0 });
        continue;
      }
      var xv = cell.value as number;
      var predicted = fitIntercept + fitSlope * xv;
      rowCells.push({ type: "n", value: fname == "GROWTH" ? Math.exp(predicted) : predicted });
    }
    outCells.push(rowCells);
  }
  operand.push({
    type: "array",
    value: { rows: newRows, cols: newCols, cells: outCells },
  });
  return;
};

SocialCalc.Formula.FunctionList["CORREL"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  2,
  "pairedrange",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["COVARIANCE.P"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  2,
  "pairedrange",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["COVARIANCE.S"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  2,
  "pairedrange",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["SLOPE"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  2,
  "pairedrange",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["INTERCEPT"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  2,
  "pairedrange",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["RSQ"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  2,
  "pairedrange",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["FORECAST"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  3,
  "forecast",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["FORECAST.LINEAR"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  3,
  "forecast",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["TREND"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  -1,
  "trendgrowth",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["GROWTH"] = [
  SocialCalc.Formula.PairedRangeStatFunctions,
  -1,
  "trendgrowth",
  "",
  "stat",
];

/*
#
# DAVERAGE(databaserange, fieldname, criteriarange)
# DCOUNT(databaserange, fieldname, criteriarange)
# DCOUNTA(databaserange, fieldname, criteriarange)
# DGET(databaserange, fieldname, criteriarange)
# DMAX(databaserange, fieldname, criteriarange)
# DMIN(databaserange, fieldname, criteriarange)
# DPRODUCT(databaserange, fieldname, criteriarange)
# DSTDEV(databaserange, fieldname, criteriarange)
# DSTDEVP(databaserange, fieldname, criteriarange)
# DSUM(databaserange, fieldname, criteriarange)
# DVAR(databaserange, fieldname, criteriarange)
# DVARP(databaserange, fieldname, criteriarange)
#
# Calculate all of these and then return the desired one (overhead is in accessing not calculating)
# If this routine is changed, check the series_functions, too.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.DSeriesFunctions = function (fname, operand, foperand, sheet) {
  var cr, dbrange, fieldname, criteriarange;
  var fieldasnum, targetcol, i, j, k, cell, criteriafieldnums, criterianum;
  var testok, criteriacr, criteria, testcol, testcr;
  var t, v1;

  var scf = SocialCalc.Formula;
  var lookup_result_type = scf.LookupResultType;
  var typelookupplus = scf.TypeLookupTable.plus;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var value1: any = {};

  var sum = 0;
  var resulttypesum = "";
  var count = 0;
  var counta = 0;
  var countblank = 0;
  var countmatches = 0;
  var product = 1;
  var maxval;
  var minval;
  var mk = 0,
    sk = 0,
    mk1 = 0,
    sk1 = 0; // For variance, etc.: M sub k, k-1, and S sub k-1
  // as per Knuth "The Art of Computer Programming" Vol. 2 3rd edition, page 232

  dbrange = scf.TopOfStackValueAndType(sheet, foperand); // get a range
  fieldname = scf.OperandValueAndType(sheet, foperand); // get a value
  criteriarange = scf.TopOfStackValueAndType(sheet, foperand); // get a range
  var dbinfo: any, criteriainfo: any;

  if (dbrange.type != "range" || criteriarange.type != "range") {
    return scf.FunctionArgsError(fname, operand);
  }

  dbinfo = scf.DecodeRangeParts(sheet, dbrange.value);
  criteriainfo = scf.DecodeRangeParts(sheet, criteriarange.value);

  fieldasnum = scf.FieldToColnum(
    (dbinfo as any).sheetdata,
    (dbinfo as any).col1num,
    (dbinfo as any).ncols,
    (dbinfo as any).row1num,
    fieldname.value,
    fieldname.type,
  );
  if (fieldasnum <= 0) {
    PushOperand("e#VALUE!", 0);
    return;
  }

  targetcol = (dbinfo as any).col1num + fieldasnum - 1;
  criteriafieldnums = [];

  for (i = 0; i < (criteriainfo as any).ncols; i++) {
    // get criteria field colnums
    cell = (criteriainfo as any).sheetdata.GetAssuredCell(
      SocialCalc.crToCoord((criteriainfo as any).col1num + i, (criteriainfo as any).row1num),
    );
    criterianum = scf.FieldToColnum(
      (dbinfo as any).sheetdata,
      (dbinfo as any).col1num,
      (dbinfo as any).ncols,
      (dbinfo as any).row1num,
      cell.datavalue,
      cell.valuetype,
    );
    if (criterianum <= 0) {
      PushOperand("e#VALUE!", 0);
      return;
    }
    criteriafieldnums.push((dbinfo as any).col1num + criterianum - 1);
  }

  for (i = 1; i < (dbinfo as any).nrows; i++) {
    // go through each row of the database
    testok = false;
    CRITERIAROW: for (j = 1; j < (criteriainfo as any).nrows; j++) {
      // go through each criteria row
      for (k = 0; k < (criteriainfo as any).ncols; k++) {
        // look at each column
        criteriacr = SocialCalc.crToCoord(
          (criteriainfo as any).col1num + k,
          (criteriainfo as any).row1num + j,
        ); // where criteria is
        cell = (criteriainfo as any).sheetdata.GetAssuredCell(criteriacr);
        criteria = cell.datavalue;
        if (typeof criteria == "string" && criteria.length == 0) continue; // blank items are OK
        testcol = criteriafieldnums[k];
        testcr = SocialCalc.crToCoord(testcol, (dbinfo as any).row1num + i); // cell to check
        cell = (dbinfo as any).sheetdata.GetAssuredCell(testcr); // get cell to check from dbinfo sheet
        if (!scf.TestCriteria(cell.datavalue, cell.valuetype || "b", criteria)) {
          continue CRITERIAROW; // does not meet criteria - check next row
        }
      }
      testok = true; // met all the criteria
      break CRITERIAROW;
    }
    if (!testok) {
      continue;
    }

    cr = SocialCalc.crToCoord(targetcol, (dbinfo as any).row1num + i); // get cell of this row to do the function on
    cell = (dbinfo as any).sheetdata.GetAssuredCell(cr);

    value1.value = cell.datavalue;
    value1.type = cell.valuetype;
    t = value1.type.charAt(0);
    countmatches += 1;
    if (t == "n") count += 1;
    if (t != "b") counta += 1;
    if (t == "b") countblank += 1;

    if (t == "n") {
      v1 = value1.value - 0; // get it as a number
      sum += v1;
      product *= v1;
      maxval = maxval != undefined ? (v1 > maxval ? v1 : maxval) : v1;
      minval = minval != undefined ? (v1 < minval ? v1 : minval) : v1;
      if (count == 1) {
        // initialize with first values for variance used in STDEV, VAR, etc.
        mk1 = v1;
        sk1 = 0;
      } else {
        // Accumulate S sub 1 through n as per Knuth noted above
        mk = mk1 + (v1 - mk1) / count;
        sk = sk1 + (v1 - mk1) * (v1 - mk);
        sk1 = sk;
        mk1 = mk;
      }
      resulttypesum = lookup_result_type(value1.type, resulttypesum || value1.type, typelookupplus);
    } else if (t == "e" && resulttypesum.charAt(0) != "e") {
      resulttypesum = value1.type;
    }
  }

  resulttypesum = resulttypesum || "n";

  switch (fname) {
    case "DSUM":
      PushOperand(resulttypesum, sum);
      break;

    case "DPRODUCT": // may handle cases with text differently than some other spreadsheets
      // Zero matching numeric rows → 0 (not the multiplicative identity 1).
      PushOperand(resulttypesum, count == 0 ? 0 : product);
      break;

    case "DMIN":
      PushOperand(resulttypesum, minval || 0);
      break;

    case "DMAX":
      PushOperand(resulttypesum, maxval || 0);
      break;

    case "DCOUNT":
      PushOperand("n", count);
      break;

    case "DCOUNTA":
      PushOperand("n", counta);
      break;

    case "DAVERAGE":
      if (count > 0) {
        PushOperand(resulttypesum, sum / count);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "DSTDEV":
      if (count > 1) {
        PushOperand(resulttypesum, Math.sqrt(sk / (count - 1))); // sk is never negative according to Knuth
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "DSTDEVP":
      if (count > 1) {
        PushOperand(resulttypesum, Math.sqrt(sk / count));
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "DVAR":
      if (count > 1) {
        PushOperand(resulttypesum, sk / (count - 1));
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "DVARP":
      if (count > 1) {
        PushOperand(resulttypesum, sk / count);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;

    case "DGET":
      if (countmatches == 1) {
        PushOperand(value1.type, value1.value);
      } else if (countmatches == 0) {
        PushOperand("e#VALUE!", 0);
      } else {
        PushOperand("e#NUM!", 0);
      }
      break;
  }

  return;
};

//*********************
//
// Docs see - Function Handling - ~line 1560
//
//*********************

SocialCalc.Formula.FunctionList["DAVERAGE"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DCOUNT"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DCOUNTA"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DGET"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DMAX"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DMIN"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DPRODUCT"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DSTDEV"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DSTDEVP"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DSUM"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DVAR"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["DVARP"] = [
  SocialCalc.Formula.DSeriesFunctions,
  3,
  "dfunc",
  "",
  "stat",
];

/*
#
# colnum = SocialCalc.Formula.FieldToColnum(sheet, col1num, ncols, row1num, fieldname, fieldtype)
#
# If fieldname is a number, uses it, otherwise looks up string in cells in row to find field number
#
# If not found, returns 0.
#
*/

/**
 * @param {any} sheet
 * @param {number} col1num
 * @param {number} ncols
 * @param {number} row1num
 * @param {any} fieldname
 * @param {any} fieldtype
 */
FormulaMut.FieldToColnum = function (sheet, col1num, ncols, row1num, fieldname, fieldtype) {
  var colnum, cell, value;

  if (fieldtype.charAt(0) == "n") {
    // number - return it if legal
    colnum = fieldname - 0; // make sure a number
    if (colnum <= 0 || colnum > ncols) {
      return 0;
    }
    return Math.floor(colnum);
  }

  if (fieldtype.charAt(0) != "t") {
    // must be text otherwise
    return 0;
  }

  fieldname = fieldname ? fieldname.toLowerCase() : "";

  for (colnum = 0; colnum < ncols; colnum++) {
    // look through column headers for a match
    cell = sheet.GetAssuredCell(SocialCalc.crToCoord(col1num + colnum, row1num));
    value = cell.datavalue;
    value = (value + "").toLowerCase(); // ignore case
    if (value == fieldname) {
      // match
      return colnum + 1;
    }
  }
  return 0; // looked at all and no match
};

/*
#
# HLOOKUP(value, range, row, [rangelookup])
# VLOOKUP(value, range, col, [rangelookup])
# MATCH(value, range, [rangelookup])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.LookupFunctions = function (fname, operand, foperand, sheet) {
  var lookupvalue, range, rangelookup, rangeinfo;
  var offsetvalue: any = 0;
  var c: number = 0,
    r = 0,
    csave = 0,
    rsave = 0;
  var cincr, rincr;
  var previousOK, cell, value, valuetype, cr; // previousOK: if 1, previous test was <. If 2, also this one wasn't

  var scf = SocialCalc.Formula;
  var operand_value_and_type = scf.OperandValueAndType;
  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  lookupvalue = operand_value_and_type(sheet, foperand);
  if (lookupvalue.type.charAt(0) == "e") {
    // Error lookup keys must propagate (VLOOKUP(1/0,…) → #DIV/0!), not scan as #N/A.
    PushOperand(lookupvalue.type, 0);
    return;
  }
  if (typeof lookupvalue.value == "string") {
    lookupvalue.value = (lookupvalue.value as any).toLowerCase();
  }
  range = scf.TopOfStackValueAndType(sheet, foperand);

  rangelookup = 1; // default to true or 1
  if (fname == "MATCH") {
    if (foperand.length) {
      rangelookup = scf.OperandAsNumber(sheet, foperand);
      if (rangelookup.type.charAt(0) != "n") {
        PushOperand("e#VALUE!", 0);
        return;
      }
      if (foperand.length) {
        scf.FunctionArgsError(fname, operand);
        return 0;
      }
      rangelookup = rangelookup.value - 0;
    }
  } else {
    offsetvalue = scf.OperandAsNumber(sheet, foperand);
    if (offsetvalue.type.charAt(0) != "n") {
      PushOperand("e#VALUE!", 0);
      return;
    }
    offsetvalue = Math.floor(offsetvalue.value);
    if (foperand.length) {
      rangelookup = scf.OperandAsNumber(sheet, foperand);
      if (rangelookup.type.charAt(0) != "n") {
        PushOperand("e#VALUE!", 0);
        return;
      }
      if (foperand.length) {
        scf.FunctionArgsError(fname, operand);
        return 0;
      }
      rangelookup = rangelookup.value ? 1 : 0; // convert to 1 or 0
    }
  }
  lookupvalue.type = lookupvalue.type.charAt(0); // only deal with general type
  if (lookupvalue.type == "n") {
    // if number, make sure a number
    lookupvalue.value = lookupvalue.value - 0;
  }

  if (range.type != "range") {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  rangeinfo = scf.DecodeRangeParts(sheet, range.value, range.type);
  if (!rangeinfo) {
    PushOperand("e#REF!", 0);
    return;
  }

  c = 0;
  r = 0;
  cincr = 0;
  rincr = 0;
  if (fname == "HLOOKUP") {
    cincr = 1;
    if (offsetvalue > rangeinfo.nrows) {
      PushOperand("e#REF!", 0);
      return;
    }
  } else if (fname == "VLOOKUP") {
    rincr = 1;
    if (offsetvalue > rangeinfo.ncols) {
      PushOperand("e#REF!", 0);
      return;
    }
  } else {
    // MATCH (the only other fname routed here)
    if (rangeinfo.ncols > 1) {
      if (rangeinfo.nrows > 1) {
        PushOperand("e#N/A", 0);
        return;
      }
      cincr = 1;
    } else {
      rincr = 1;
    }
  }
  if (offsetvalue < 1 && fname != "MATCH") {
    PushOperand("e#VALUE!", 0);
    return 0;
  }

  for (;;) {
    cr = SocialCalc.crToCoord(rangeinfo.col1num + c, rangeinfo.row1num + r);
    cell = rangeinfo.sheetdata.GetAssuredCell(cr);
    value = cell.datavalue;
    valuetype = cell.valuetype ? cell.valuetype.charAt(0) : "b"; // only deal with general types
    if (valuetype == "n") {
      value = (value as any) - 0; // make sure number
    }
    if (rangelookup) {
      // rangelookup type 1 or -1: look for within brackets for matches
      if (lookupvalue.type == "n" && valuetype == "n") {
        if (lookupvalue.value == value) {
          // match
          break;
        }
        if (
          (rangelookup > 0 && lookupvalue.value > value) ||
          (rangelookup < 0 && lookupvalue.value < value)
        ) {
          // possible match: wait and see
          previousOK = 1;
          csave = c; // remember col and row of last OK
          rsave = r;
        } else if (previousOK) {
          // last one was OK, this one isn't
          previousOK = 2;
          break;
        }
      } else if (lookupvalue.type == "t" && valuetype == "t") {
        value = typeof value == "string" ? (value as any).toLowerCase() : "";
        if (lookupvalue.value == value) {
          // match
          break;
        }
        if (
          (rangelookup > 0 && lookupvalue.value > value) ||
          (rangelookup < 0 && lookupvalue.value < value)
        ) {
          // possible match: wait and see
          previousOK = 1;
          csave = c;
          rsave = r;
        } else if (previousOK) {
          // last one was OK, this one isn't
          previousOK = 2;
          break;
        }
      }
    } else {
      // exact value matches
      if (lookupvalue.type == "n" && valuetype == "n") {
        if (lookupvalue.value == value) {
          // match
          break;
        }
      } else if (lookupvalue.type == "t" && valuetype == "t") {
        value = typeof value == "string" ? (value as any).toLowerCase() : "";
        if (lookupvalue.value == value) {
          // match
          break;
        }
      }
    }

    r += rincr;
    c += cincr;
    if (r >= rangeinfo.nrows || c >= rangeinfo.ncols) {
      // end of range to check, no exact match
      if (previousOK) {
        // at least one could have been OK
        previousOK = 2;
        break;
      }
      PushOperand("e#N/A", 0);
      return;
    }
  }

  if (previousOK == 2) {
    // back to last OK
    r = rsave;
    c = csave;
  }

  if (fname == "MATCH") {
    value = c + r + 1; // only one may be <> 0
    valuetype = "n";
  } else {
    cr = SocialCalc.crToCoord(
      rangeinfo.col1num + c + (fname == "VLOOKUP" ? offsetvalue - 1 : 0),
      rangeinfo.row1num + r + (fname == "HLOOKUP" ? offsetvalue - 1 : 0),
    );
    cell = rangeinfo.sheetdata.GetAssuredCell(cr);
    value = cell.datavalue;
    valuetype = cell.valuetype;
  }
  PushOperand(valuetype, value);

  return;
};

SocialCalc.Formula.FunctionList["HLOOKUP"] = [
  SocialCalc.Formula.LookupFunctions,
  -3,
  "hlookup",
  "",
  "lookup",
];
SocialCalc.Formula.FunctionList["MATCH"] = [
  SocialCalc.Formula.LookupFunctions,
  -2,
  "match",
  "",
  "lookup",
];
SocialCalc.Formula.FunctionList["VLOOKUP"] = [
  SocialCalc.Formula.LookupFunctions,
  -3,
  "vlookup",
  "",
  "lookup",
];

/*
#
# XMATCH(lookup_value, lookup_array, [match_mode], [search_mode])
# XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
#
# Modern lookup pair, Excel/Google Sheets cross-compatible.
#
# match_mode: 0 exact (default), -1 exact-or-next-smaller, 1 exact-or-next-larger, 2 wildcard.
# search_mode: 1 first-to-last (default), -1 last-to-first, 2 binary ascending, -2 binary descending.
#
# Binary search_mode (2/-2) requires match_mode 0/-1/1 (never combined with
# wildcard match_mode 2); an incompatible or out-of-range mode combination
# is rejected with #VALUE! per FunctionArgsError, matching the established
# SocialCalc policy of #VALUE! for malformed function arguments (see
# LookupFunctions' rangelookup handling above). A genuine two-dimensional
# lookup_array (nrows>1 and ncols>1) and, for XLOOKUP, a return_array whose
# lookup-axis length does not match lookup_array's are both shape errors and
# also reported as #VALUE!, again matching FunctionArgsError precedent
# rather than inventing a new error family. Absence of a match yields #N/A
# (or the caller's if_not_found for XLOOKUP), consistent with MATCH/VLOOKUP.
#
*/

/**
 * Validate and normalize the [match_mode] / [search_mode] optional args
 * shared by XMATCH and XLOOKUP. Returns null and pushes #VALUE! on any
 * invalid/incompatible combination; otherwise returns the normalized pair.
 *
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.DecodeXLookupModes = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };
  var matchMode = 0,
    searchMode = 1;
  if (foperand.length) {
    var m = scf.OperandAsNumber(sheet, foperand);
    if (m.type.charAt(0) != "n") {
      PushOperand("e#VALUE!", 0);
      return null;
    }
    matchMode = Math.floor(Number(m.value));
    if (matchMode < -1 || matchMode > 2) {
      scf.FunctionArgsError(fname, operand);
      return null;
    }
  }
  if (foperand.length) {
    var s = scf.OperandAsNumber(sheet, foperand);
    if (s.type.charAt(0) != "n") {
      PushOperand("e#VALUE!", 0);
      return null;
    }
    searchMode = Math.floor(Number(s.value));
    if (searchMode !== 1 && searchMode !== -1 && searchMode !== 2 && searchMode !== -2) {
      scf.FunctionArgsError(fname, operand);
      return null;
    }
  }
  if ((searchMode === 2 || searchMode === -2) && matchMode === 2) {
    // Binary search assumes sorted order; wildcard scanning is not a sorted
    // comparison, so Excel/Sheets never combine the two.
    scf.FunctionArgsError(fname, operand);
    return null;
  }
  return { matchMode: matchMode, searchMode: searchMode };
};

/**
 * Decode a single 1-D lookup_array/return_array argument to a flat list of
 * {value, type} cells plus its length, reusing DecodeRangeParts/MaterializeArray
 * conventions. Returns null (2D shape) or the decoded vector.
 *
 * @param {any} sheet
 * @param {any} operandValue
 */
FormulaMut.DecodeLookupVector = function (sheet, operandValue) {
  var scf = SocialCalc.Formula;
  var array = scf.MaterializeArray(sheet, operandValue);
  if (!array) return null;
  if (array.rows > 1 && array.cols > 1) return null; // must be a single row or column
  var byColumn = array.cols == 1; // vertical vector (or 1x1): walk down rows
  var length = byColumn ? array.rows : array.cols;
  var cells: SocialCalc.FormulaArrayCell[] = [];
  for (var i = 0; i < length; i++) {
    cells.push(byColumn ? array.cells[i]![0]! : array.cells[0]![i]!);
  }
  return { cells: cells, length: length, byColumn: byColumn, array: array };
};

/**
 * Compare a lookup cell's typed value against lookupvalue using the
 * lowercased-text / numeric General type rules shared with LookupFunctions.
 * Returns -1/0/1 (only well-defined when both sides are the same general
 * type; NaN-equivalent "incomparable" is signalled by returning null).
 *
 * @param {any} lookupvalue normalized {type, value} (type is single-char; text already lowercased)
 * @param {any} cell {type, value}
 */
FormulaMut.CompareLookupCell = function (lookupvalue, cell) {
  var ctype = cell.type.charAt(0); // Cell always carries a valuetype ("b" default; never falsy)
  var cvalue = cell.value;
  if (ctype == "n") cvalue = (cvalue as any) - 0;
  if (lookupvalue.type != ctype) return null;
  if (ctype == "n") {
    var nv = lookupvalue.value as number;
    return (cvalue as number) < nv ? -1 : (cvalue as number) > nv ? 1 : 0;
  }
  if (ctype == "t") {
    var ctext = ((cvalue as any) + "").toLowerCase();
    var tv = lookupvalue.value as string;
    return ctext < tv ? -1 : ctext > tv ? 1 : 0;
  }
  return null; // errors/blanks never approximate-compare
};

/**
 * Scan a decoded lookup vector for XMATCH/XLOOKUP's chosen match_mode /
 * search_mode, returning the 0-based index of the winning cell or -1.
 *
 * @param {any} lookupvalue normalized {type, value}
 * @param {any} vector {cells, length}
 * @param {number} matchMode
 * @param {number} searchMode
 */
FormulaMut.ScanLookupVector = function (lookupvalue, vector, matchMode, searchMode) {
  var scf = SocialCalc.Formula;
  var cells = vector.cells,
    length = vector.length;

  if (matchMode == 2) {
    // Wildcard: only text lookup values can carry a pattern; scan first-to-last
    // or last-to-first (never binary -- rejected earlier by DecodeXLookupModes).
    if (lookupvalue.type != "t") {
      for (var w = 0; w < length; w++) {
        var idxw = searchMode == -1 ? length - 1 - w : w;
        var cw = cells[idxw]!;
        // Cells reaching here always carry a type from MaterializeArray's
        // Cell-constructor default ("b" for absent), never a falsy value.
        if (cw.type.charAt(0) == lookupvalue.type && cw.value == lookupvalue.value) return idxw;
      }
      return -1;
    }
    var pattern = new RegExp(scf.WildcardPatternToRegex(lookupvalue.value as string));
    for (var i = 0; i < length; i++) {
      var idx = searchMode == -1 ? length - 1 - i : i;
      var cell = cells[idx]!;
      if (cell.type.charAt(0) != "t") continue;
      var text = ((cell.value as any) + "").toLowerCase();
      if (pattern.test(text)) return idx;
    }
    return -1;
  }

  if (searchMode == 2 || searchMode == -2) {
    // Binary search: assumes lookup_array is sorted ascending (2) or
    // descending (-2). Standard binary search producing the exact index,
    // or (for approximate modes) the insertion boundary's neighbor.
    var lo = 0,
      hi = length - 1,
      exactIdx = -1,
      boundaryIdx = -1; // last-seen index on the "acceptable" side while narrowing
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var cmp = scf.CompareLookupCell(lookupvalue, cells[mid]);
      if (cmp === null) {
        // Incomparable (type mismatch/error/blank): treat as past the target
        // in ascending order, before it in descending, so it never masks a
        // real match; nudge the search away from it.
        if (searchMode == 2) hi = mid - 1;
        else lo = mid + 1;
        continue;
      }
      if (searchMode == -2) cmp = -cmp; // descending: invert comparison direction
      if (cmp === 0) {
        exactIdx = mid;
        break;
      } else if (cmp < 0) {
        // cells[mid] < lookupvalue in the effective ascending sense
        if (matchMode == -1) boundaryIdx = mid; // candidate "next smaller"
        lo = mid + 1;
      } else {
        if (matchMode == 1) boundaryIdx = mid; // candidate "next larger"
        hi = mid - 1;
      }
    }
    if (exactIdx >= 0) return exactIdx;
    if (matchMode == -1 || matchMode == 1) return boundaryIdx;
    return -1;
  }

  // Linear search_mode 1/-1, match_mode 0 (exact) or -1/1 (approximate).
  // Approximate modes scan the whole vector for the true closest
  // smaller/larger qualifying value (no sortedness assumed), mirroring
  // XMATCH's documented independence from legacy MATCH's sorted-bracket scan.
  // CompareLookupCell only reports sign, so "closest" candidates are
  // resolved by comparing each new qualifying cell against the current best
  // candidate directly (not by comparing signs against lookupvalue).
  var bestIdx = -1;
  for (var k = 0; k < length; k++) {
    var order = searchMode == -1 ? length - 1 - k : k;
    var c = scf.CompareLookupCell(lookupvalue, cells[order]);
    if (c === null) continue;
    if (c === 0) return order; // exact match always wins immediately
    if (matchMode == -1 && c < 0) {
      // cells[order] < lookupvalue: candidate "next smaller"; prefer the
      // largest such value seen (closest from below). bestIdx, once set,
      // always points at a cell of lookupvalue's own type (it was recorded
      // under this same c<0/c>0 guard), so re-comparing it against another
      // cell of that type can never be incomparable -- only `bestIdx < 0`
      // (no candidate yet) needs checking before comparing.
      if (
        bestIdx < 0 ||
        scf.CompareLookupCell(
          { type: lookupvalue.type, value: cells[bestIdx]!.value },
          cells[order],
        )! > 0
      ) {
        bestIdx = order;
      }
    } else if (matchMode == 1 && c > 0) {
      // cells[order] > lookupvalue: candidate "next larger"; prefer the
      // smallest such value seen (closest from above). Same bestIdx-type
      // invariant as the next-smaller branch above.
      if (
        bestIdx < 0 ||
        scf.CompareLookupCell(
          { type: lookupvalue.type, value: cells[bestIdx]!.value },
          cells[order],
        )! < 0
      ) {
        bestIdx = order;
      }
    }
  }
  return bestIdx;
};

/**
 * XMATCH(lookup_value, lookup_array, [match_mode], [search_mode])
 *
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.XMatchFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var lookupvalue = scf.OperandValueAndType(sheet, foperand);
  if (lookupvalue.type.charAt(0) == "e") {
    PushOperand(lookupvalue.type, 0);
    return;
  }
  lookupvalue = { type: lookupvalue.type.charAt(0), value: lookupvalue.value };
  if (lookupvalue.type == "n") lookupvalue.value = (lookupvalue.value as any) - 0;
  else if (lookupvalue.type == "t")
    lookupvalue.value = ((lookupvalue.value as any) + "").toLowerCase();

  var arrayOperand = scf.TopOfStackValueAndType(sheet, foperand);
  var modes = scf.DecodeXLookupModes(fname, operand, foperand, sheet);
  if (!modes) return;
  if (foperand.length) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  var vector = scf.DecodeLookupVector(sheet, arrayOperand);
  if (!vector) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  var idx = scf.ScanLookupVector(lookupvalue, vector, modes.matchMode, modes.searchMode);
  if (idx < 0) {
    PushOperand("e#N/A", 0);
    return;
  }
  PushOperand("n", idx + 1);
};

SocialCalc.Formula.FunctionList["XMATCH"] = [
  SocialCalc.Formula.XMatchFunction,
  -2,
  "xmatch",
  "",
  "lookup",
];

/**
 * XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
 *
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.XLookupFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var lookupvalue = scf.OperandValueAndType(sheet, foperand);
  if (lookupvalue.type.charAt(0) == "e") {
    PushOperand(lookupvalue.type, 0);
    return;
  }
  lookupvalue = { type: lookupvalue.type.charAt(0), value: lookupvalue.value };
  if (lookupvalue.type == "n") lookupvalue.value = (lookupvalue.value as any) - 0;
  else if (lookupvalue.type == "t")
    lookupvalue.value = ((lookupvalue.value as any) + "").toLowerCase();

  var lookupArrayOperand = scf.TopOfStackValueAndType(sheet, foperand);
  var returnArrayOperand = scf.TopOfStackValueAndType(sheet, foperand);

  var haveIfNotFound = false,
    ifNotFound: any = null;
  if (foperand.length) {
    // if_not_found is taken verbatim (any type, including errors/text/numbers);
    // it is only consumed on a no-match outcome, never evaluated otherwise.
    ifNotFound = scf.TopOfStackValueAndType(sheet, foperand);
    haveIfNotFound = true;
  }
  var modes = scf.DecodeXLookupModes(fname, operand, foperand, sheet);
  if (!modes) return;
  if (foperand.length) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  var lookupVector = scf.DecodeLookupVector(sheet, lookupArrayOperand);
  if (!lookupVector) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }
  var returnArray = scf.MaterializeArray(sheet, returnArrayOperand);
  if (!returnArray) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }
  // return_array's extent along the lookup axis must match lookup_array's
  // length; its cross-axis extent is free (spills a full row/column of
  // results), matching XLOOKUP's row-or-column result semantics.
  var returnAxisLength = lookupVector.byColumn ? returnArray.rows : returnArray.cols;
  if (returnAxisLength != lookupVector.length) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  var idx = scf.ScanLookupVector(lookupvalue, lookupVector, modes.matchMode, modes.searchMode);
  if (idx < 0) {
    if (haveIfNotFound) {
      PushOperand(ifNotFound.type, ifNotFound.value);
    } else {
      PushOperand("e#N/A", 0);
    }
    return;
  }

  var crossExtent = lookupVector.byColumn ? returnArray.cols : returnArray.rows;
  if (crossExtent == 1) {
    // Scalar return: the single cell at idx along the lookup axis.
    var scalar = lookupVector.byColumn ? returnArray.cells[idx]![0]! : returnArray.cells[0]![idx]!;
    PushOperand(scalar.type, scalar.value);
    return;
  }
  // 2-D return: the full cross-axis row/column at idx, spilling through the
  // existing dynamic-array pipeline (MaterializeArray/DynamicArrayFunctions
  // convention: push a typed {rows, cols, cells} array value).
  var outCells: SocialCalc.FormulaArrayCell[][] = lookupVector.byColumn
    ? [returnArray.cells[idx]!.slice()]
    : returnArray.cells.map(function (row) {
        return [row[idx]!];
      });
  operand.push({
    type: "array",
    value: {
      rows: lookupVector.byColumn ? 1 : returnArray.rows,
      cols: lookupVector.byColumn ? returnArray.cols : 1,
      cells: outCells,
    },
  });
};

SocialCalc.Formula.FunctionList["XLOOKUP"] = [
  SocialCalc.Formula.XLookupFunction,
  -3,
  "xlookup",
  "",
  "lookup",
];

/*
#
# INDEX(range, rownum, colnum)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.IndexFunction = function (fname, operand, foperand, sheet) {
  var range, sheetname, indexinfo: any, rowindex, colindex, result, resulttype;

  var scf = SocialCalc.Formula;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  range = scf.TopOfStackValueAndType(sheet, foperand); // get range
  if (range.type != "range") {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }
  indexinfo = scf.DecodeRangeParts(sheet, range.value, range.type);
  if (indexinfo.sheetname) {
    sheetname = "!" + indexinfo.sheetname;
  } else {
    sheetname = "";
  }

  rowindex = { value: 0 };
  colindex = { value: 0 };

  if (foperand.length) {
    // look for row number
    rowindex = scf.OperandAsNumber(sheet, foperand);
    if (rowindex.type.charAt(0) != "n" || rowindex.value < 0) {
      PushOperand("e#VALUE!", 0);
      return;
    }
    if (foperand.length) {
      // look for col number
      colindex = scf.OperandAsNumber(sheet, foperand);
      if (colindex.type.charAt(0) != "n" || colindex.value < 0) {
        PushOperand("e#VALUE!", 0);
        return;
      }
      if (foperand.length) {
        scf.FunctionArgsError(fname, operand);
        return 0;
      }
    } else {
      // col number missing
      if (indexinfo.nrows == 1) {
        // if only one row, then rowindex is really colindex
        colindex.value = rowindex.value;
        rowindex.value = 0;
      }
    }
  }

  if (rowindex.value > indexinfo.nrows || colindex.value > indexinfo.ncols) {
    PushOperand("e#REF!", 0);
    return;
  }

  if (rowindex.value == 0) {
    if (colindex.value == 0) {
      if (indexinfo.nrows == 1 && indexinfo.ncols == 1) {
        result = SocialCalc.crToCoord(indexinfo.col1num, indexinfo.row1num) + sheetname;
        resulttype = "coord";
      } else {
        result =
          SocialCalc.crToCoord(indexinfo.col1num, indexinfo.row1num) +
          sheetname +
          "|" +
          SocialCalc.crToCoord(
            indexinfo.col1num + indexinfo.ncols - 1,
            indexinfo.row1num + indexinfo.nrows - 1,
          ) +
          "|";
        resulttype = "range";
      }
    } else {
      if (indexinfo.nrows == 1) {
        result =
          SocialCalc.crToCoord(indexinfo.col1num + colindex.value - 1, indexinfo.row1num) +
          sheetname;
        resulttype = "coord";
      } else {
        result =
          SocialCalc.crToCoord(indexinfo.col1num + colindex.value - 1, indexinfo.row1num) +
          sheetname +
          "|" +
          SocialCalc.crToCoord(
            indexinfo.col1num + colindex.value - 1,
            indexinfo.row1num + indexinfo.nrows - 1,
          ) +
          "|";
        resulttype = "range";
      }
    }
  } else {
    if (colindex.value == 0) {
      if (indexinfo.ncols == 1) {
        result =
          SocialCalc.crToCoord(indexinfo.col1num, indexinfo.row1num + rowindex.value - 1) +
          sheetname;
        resulttype = "coord";
      } else {
        result =
          SocialCalc.crToCoord(indexinfo.col1num, indexinfo.row1num + rowindex.value - 1) +
          sheetname +
          "|" +
          SocialCalc.crToCoord(
            indexinfo.col1num + indexinfo.ncols - 1,
            indexinfo.row1num + rowindex.value - 1,
          ) +
          "|";
        resulttype = "range";
      }
    } else {
      result =
        SocialCalc.crToCoord(
          indexinfo.col1num + colindex.value - 1,
          indexinfo.row1num + rowindex.value - 1,
        ) + sheetname;
      resulttype = "coord";
    }
  }

  PushOperand(resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["INDEX"] = [
  SocialCalc.Formula.IndexFunction,
  -1,
  "index",
  "",
  "lookup",
];

/*
#
# COUNTIF(c1:c2,"criteria")
# SUMIF(c1:c2,"criteria",[range2])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.CountifSumifFunctions = function (fname, operand, foperand, sheet) {
  var range, criteria, sumrange, f2operand, value1, value2;
  var sum = 0;
  var resulttypesum = "";
  var count = 0;

  var scf = SocialCalc.Formula;
  var operand_value_and_type = scf.OperandValueAndType;
  var lookup_result_type = scf.LookupResultType;
  var typelookupplus = scf.TypeLookupTable.plus;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  range = scf.TopOfStackValueAndType(sheet, foperand); // get range or coord
  criteria = scf.OperandAsText(sheet, foperand); // get criteria
  if (fname == "SUMIF") {
    if (foperand.length == 1) {
      // three arg form of SUMIF
      sumrange = scf.TopOfStackValueAndType(sheet, foperand);
    } else if (foperand.length == 0) {
      // two arg form
      sumrange = { value: range.value, type: range.type };
    } else {
      scf.FunctionArgsError(fname, operand);
      return 0;
    }
  } else {
    sumrange = { value: range.value, type: range.type };
  }

  // OperandAsText already coerces numeric/blank to text and stamps type "t".
  // Errors keep their "e..." type with empty value; treat that as a null match.
  if (criteria.type.charAt(0) == "e") criteria.value = null;

  if (range.type != "coord" && range.type != "range") {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  if (fname == "SUMIF" && sumrange.type != "coord" && sumrange.type != "range") {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  foperand.push(range);
  f2operand = []; // to allow for 3 arg form
  f2operand.push(sumrange);

  while (foperand.length) {
    value1 = operand_value_and_type(sheet, foperand);
    value2 = operand_value_and_type(sheet, f2operand);
    if (!scf.TestCriteria(value1.value, value1.type, criteria.value)) {
      continue;
    }

    count += 1;

    if (value2.type.charAt(0) == "n") {
      sum += value2.value - 0;
      resulttypesum = lookup_result_type(value2.type, resulttypesum || value2.type, typelookupplus);
    } else if (value2.type.charAt(0) == "e" && resulttypesum.charAt(0) != "e") {
      resulttypesum = value2.type;
    }
  }

  resulttypesum = resulttypesum || "n";

  if (fname == "SUMIF") {
    PushOperand(resulttypesum, sum);
  } else if (fname == "COUNTIF") {
    PushOperand("n", count);
  }

  return;
};

SocialCalc.Formula.FunctionList["COUNTIF"] = [
  SocialCalc.Formula.CountifSumifFunctions,
  2,
  "rangec",
  "",
  "stat",
];
SocialCalc.Formula.FunctionList["SUMIF"] = [
  SocialCalc.Formula.CountifSumifFunctions,
  -2,
  "sumif",
  "",
  "stat",
];

/*
#
# SUMIFS(c1:c2, c3:c4,"criteria", [c5:c6,"criteria", ...])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SumifsFunction = function (fname, operand, foperand, sheet) {
  var range, criteria, sumrange, f2operand, value1, value2;
  var sum = 0;
  var resulttypesum = "";

  var scf = SocialCalc.Formula;
  var operand_value_and_type = scf.OperandValueAndType;
  var lookup_result_type = scf.LookupResultType;
  var typelookupplus = scf.TypeLookupTable.plus;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  sumrange = scf.TopOfStackValueAndType(sheet, foperand);
  if (sumrange.type != "coord" && sumrange.type != "range") {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }

  var ranges = [],
    criterias = [];
  while (foperand.length) {
    range = scf.TopOfStackValueAndType(sheet, foperand); // get range or coord
    criteria = scf.OperandAsText(sheet, foperand); // get criteria
    // OperandAsText coerces numeric/blank to text. Errors keep "e..." type.
    if (criteria.type.charAt(0) == "e") criteria.value = null;
    if (range.type != "coord" && range.type != "range") {
      scf.FunctionArgsError(fname, operand);
      return 0;
    }
    ranges.push([range]);
    criterias.push(criteria);
  }

  f2operand = [];
  f2operand.push(sumrange);

  while (f2operand.length) {
    value2 = operand_value_and_type(sheet, f2operand);

    var all_good = true;
    for (var i = 0; i < ranges.length; i++) {
      value1 = operand_value_and_type(sheet, ranges[i]); // get next condition - note this function increases the test range index
      if (!all_good) {
        continue;
      } // skip test, but move to next cell in test range
      if (!scf.TestCriteria(value1.value, value1.type, criterias[i].value)) {
        all_good = false;
      }
    }
    if (!all_good) {
      continue;
    }

    if (value2.type.charAt(0) == "n") {
      sum += value2.value - 0;
      resulttypesum = lookup_result_type(value2.type, resulttypesum || value2.type, typelookupplus);
    } else if (value2.type.charAt(0) == "e" && resulttypesum.charAt(0) != "e") {
      resulttypesum = value2.type;
    }
  }

  resulttypesum = resulttypesum || "n";
  PushOperand(resulttypesum, sum);
  return;
};

SocialCalc.Formula.FunctionList["SUMIFS"] = [
  SocialCalc.Formula.SumifsFunction,
  -3,
  "sum_range, criteria_range1, criteria1, [criteria_range2, criteria2, ... criteria_range_n, criteria_n]",
  "",
  "stat",
];

/*
#
# SUBTOTAL(function_code, ref1, [ref2,...])
#
# Aggregates only over rows the AutoFilter/manual-hide policy leaves visible
# to this function code, and always ignores nested SUBTOTAL() results so
# subtotals over subtotaled sub-ranges don't double count. See
# lemma/visibility.ts for the proved hide-composition/idempotence policy
# SocialCalc.SubtotalExcludesRow implements.
#
*/

/** function_code -> [aggregateKind, includeManualHidden]. 1-11 always exclude
 * filter-hidden rows only; 101-111 also exclude manually-hidden rows. */
FormulaMut.SubtotalFunctionCodes = {
  1: ["AVERAGE", false],
  2: ["COUNT", false],
  3: ["COUNTA", false],
  4: ["MAX", false],
  5: ["MIN", false],
  6: ["PRODUCT", false],
  7: ["STDEV", false],
  8: ["STDEVP", false],
  9: ["SUM", false],
  10: ["VAR", false],
  11: ["VARP", false],
  101: ["AVERAGE", true],
  102: ["COUNT", true],
  103: ["COUNTA", true],
  104: ["MAX", true],
  105: ["MIN", true],
  106: ["PRODUCT", true],
  107: ["STDEV", true],
  108: ["STDEVP", true],
  109: ["SUM", true],
  110: ["VAR", true],
  111: ["VARP", true],
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SubtotalFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  // Args arrive in call order in foperand; function_code is first.
  var codeoperand = scf.OperandAsNumber(sheet, foperand);
  if (codeoperand.type.charAt(0) != "n") {
    PushOperand("e#VALUE!", 0);
    return;
  }
  var code = Math.floor((codeoperand.value as number) - 0);
  var entry = (scf as any).SubtotalFunctionCodes[code];
  if (!entry) {
    PushOperand("e#VALUE!", 0);
    return;
  }
  var aggregateKind: string = entry[0];
  var includeManualHidden: boolean = entry[1];

  var concat = "";
  var sum = 0;
  var resulttypesum = "";
  var count = 0;
  var counta = 0;
  var product = 1;
  var maxval: number | undefined;
  var minval: number | undefined;
  var mk = 0,
    sk = 0,
    mk1 = 0,
    sk1 = 0;

  var visitCell = function (sheetdata: any, cr: string) {
    var crparts = SocialCalc.coordToCr(cr);
    if (SocialCalc.SubtotalExcludesRow(sheetdata, crparts.row, includeManualHidden)) return;
    var cell = sheetdata.cells[cr];
    if (!cell) return; // blank cell contributes nothing (matches SeriesFunctions blank skip)
    // Exclude nested SUBTOTAL() results so subtotals-of-subtotals don't double count.
    if (
      cell.datatype == "f" &&
      typeof cell.formula == "string" &&
      /^\s*SUBTOTAL\s*\(/i.test(cell.formula)
    ) {
      return;
    }
    var value1 = { value: cell.datavalue, type: cell.valuetype || "b" };
    var t = value1.type.charAt(0);
    if (t == "n") count += 1;
    if (t != "b") counta += 1;
    if (t != "e" && t != "b") concat = concat + value1.value;

    if (t == "n") {
      var v1 = (value1.value as number) - 0;
      sum += v1;
      product *= v1;
      maxval = maxval != undefined ? (v1 > maxval ? v1 : maxval) : v1;
      minval = minval != undefined ? (v1 < minval ? v1 : minval) : v1;
      if (count == 1) {
        mk1 = v1;
        sk1 = 0;
      } else {
        mk = mk1 + (v1 - mk1) / count;
        sk = sk1 + (v1 - mk1) * (v1 - mk);
        sk1 = sk;
        mk1 = mk;
      }
      resulttypesum = scf.LookupResultType(
        value1.type,
        resulttypesum || value1.type,
        scf.TypeLookupTable.plus,
      );
    } else if (t == "e" && resulttypesum.charAt(0) != "e") {
      resulttypesum = value1.type;
    }
  };

  while (foperand.length > 0) {
    var refoperand = scf.TopOfStackValueAndType(sheet, foperand);
    if (refoperand.type == "range") {
      // TopOfStackValueAndType/StepThroughRangeDown already resolve an
      // unavailable-sheet or malformed range to an "e#REF!" operand before
      // this branch is ever reached, so DecodeRangeParts here always
      // succeeds for a genuinely "range"-typed operand (see
      // FindAutoFilterForHeaderCell's analogous ParseRange comment).
      var rangeinfo = scf.DecodeRangeParts(sheet, refoperand.value as string) as any;
      var col1num = rangeinfo.col1num,
        ncols = rangeinfo.ncols,
        row1num = rangeinfo.row1num,
        nrows = rangeinfo.nrows;
      for (var ri = 0; ri < nrows; ri++) {
        for (var ci = 0; ci < ncols; ci++) {
          visitCell(rangeinfo.sheetdata, SocialCalc.crToCoord(col1num + ci, row1num + ri));
        }
      }
    } else if (refoperand.type == "coord") {
      // Same reasoning: an unavailable sheet-qualified coord resolves to
      // "e#REF!" before reaching here, so FindInSheetCache always succeeds
      // for a genuinely "coord"-typed operand.
      var coordtext = refoperand.value as string;
      var pos = coordtext.indexOf("!");
      var coordsheet = pos != -1 ? scf.FindInSheetCache(coordtext.substring(pos + 1)) : sheet;
      if (pos != -1) coordtext = coordtext.substring(0, pos);
      visitCell(coordsheet, scf.PlainCoord(coordtext));
    } else {
      // Scalar literal argument (TopOfStackValueAndType only ever resolves
      // a bare literal/expression here to "n", "t", or "e" -- never "b";
      // blank only reaches this function through visitCell's cell lookup
      // above -- so no blank special-case is needed on this arm).
      var t2 = refoperand.type.charAt(0);
      if (t2 == "n") count += 1;
      counta += 1;
      if (t2 != "e") concat = concat + refoperand.value;
      if (t2 == "n") {
        var v2 = (refoperand.value as number) - 0;
        sum += v2;
        product *= v2;
        maxval = maxval != undefined ? (v2 > maxval ? v2 : maxval) : v2;
        minval = minval != undefined ? (v2 < minval ? v2 : minval) : v2;
        if (count == 1) {
          mk1 = v2;
          sk1 = 0;
        } else {
          mk = mk1 + (v2 - mk1) / count;
          sk = sk1 + (v2 - mk1) * (v2 - mk);
          sk1 = sk;
          mk1 = mk;
        }
        resulttypesum = scf.LookupResultType(
          refoperand.type,
          resulttypesum || refoperand.type,
          scf.TypeLookupTable.plus,
        );
      } else if (t2 == "e" && resulttypesum.charAt(0) != "e") {
        resulttypesum = refoperand.type;
      }
    }
  }

  resulttypesum = resulttypesum || "n";

  switch (aggregateKind) {
    case "SUM":
      PushOperand(resulttypesum, sum);
      break;
    case "PRODUCT":
      PushOperand(resulttypesum, product);
      break;
    case "MIN":
      PushOperand(resulttypesum, minval || 0);
      break;
    case "MAX":
      PushOperand(resulttypesum, maxval || 0);
      break;
    case "COUNT":
      PushOperand("n", count);
      break;
    case "COUNTA":
      PushOperand("n", counta);
      break;
    case "AVERAGE":
      if (count > 0) {
        PushOperand(resulttypesum, sum / count);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;
    case "STDEV":
      if (count > 1) {
        PushOperand(resulttypesum, Math.sqrt(sk / (count - 1)));
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;
    case "STDEVP":
      if (count > 1) {
        PushOperand(resulttypesum, Math.sqrt(sk / count));
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;
    case "VAR":
      if (count > 1) {
        PushOperand(resulttypesum, sk / (count - 1));
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;
    case "VARP":
      if (count > 1) {
        PushOperand(resulttypesum, sk / count);
      } else {
        PushOperand("e#DIV/0!", 0);
      }
      break;
  }

  return null;
};

SocialCalc.Formula.FunctionList["SUBTOTAL"] = [
  SocialCalc.Formula.SubtotalFunction,
  -2,
  "function_code, ref1, [ref2, ...]",
  "",
  "stat",
];

/*
#
# IF(cond,truevalue,falsevalue)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.IfFunction = function (fname, operand, foperand, sheet) {
  var cond, t;

  var scf = SocialCalc.Formula;

  cond = SocialCalc.Formula.OperandValueAndType(sheet, foperand);
  t = cond.type.charAt(0);
  if (t == "e") {
    // Preserve condition error type (#DIV/0!, #REF!, #N/A, …), not collapse to #VALUE!.
    operand.push({ type: cond.type, value: 0 });
    return;
  }
  if (t != "n" && t != "b") {
    operand.push({ type: "e#VALUE!", value: 0 });
    return;
  }

  var op1, op2;

  op1 = foperand.pop() as any;
  if (foperand.length == 1) {
    op2 = foperand.pop() as any;
  } else if (foperand.length == 0) {
    op2 = { type: "n", value: 0 };
  } else {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  operand.push(cond.value ? op1 : op2);
};

// Add to function list
SocialCalc.Formula.FunctionList["IF"] = [SocialCalc.Formula.IfFunction, -2, "iffunc", "", "test"];

/*
#
# DATE(year,month,day)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.DateFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var result = 0;
  var year = scf.OperandAsNumber(sheet, foperand);
  var month = scf.OperandAsNumber(sheet, foperand);
  var day = scf.OperandAsNumber(sheet, foperand);
  var resulttype = scf.LookupResultType(year.type, month.type, scf.TypeLookupTable.twoargnumeric);
  resulttype = scf.LookupResultType(resulttype, day.type, scf.TypeLookupTable.twoargnumeric);
  if (resulttype.charAt(0) == "n") {
    result =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(
        Math.floor(year.value),
        Math.floor(month.value),
        Math.floor(day.value),
      ) - SocialCalc.FormatNumber.datevalues.julian_offset;
    resulttype = "nd";
  }
  scf.PushOperand(operand, resulttype, result);
  return;
};

SocialCalc.Formula.FunctionList["DATE"] = [
  SocialCalc.Formula.DateFunction,
  3,
  "date",
  "",
  "datetime",
];

/*
#
# TIME(hour,minute,second)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.TimeFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var result = 0;
  var hours = scf.OperandAsNumber(sheet, foperand);
  var minutes = scf.OperandAsNumber(sheet, foperand);
  var seconds = scf.OperandAsNumber(sheet, foperand);
  var resulttype = scf.LookupResultType(
    hours.type,
    minutes.type,
    scf.TypeLookupTable.twoargnumeric,
  );
  resulttype = scf.LookupResultType(resulttype, seconds.type, scf.TypeLookupTable.twoargnumeric);
  if (resulttype.charAt(0) == "n") {
    result = (hours.value * 60 * 60 + minutes.value * 60 + seconds.value) / (24 * 60 * 60);
    resulttype = "nt";
  }
  scf.PushOperand(operand, resulttype, result);
  return;
};

SocialCalc.Formula.FunctionList["TIME"] = [
  SocialCalc.Formula.TimeFunction,
  3,
  "hms",
  "",
  "datetime",
];

/*
#
# DAY(date)
# MONTH(date)
# YEAR(date)
# WEEKDAY(date, [type])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.DMYFunctions = function (fname, operand, foperand, sheet) {
  var ymd, dtype, doffset;
  var scf = SocialCalc.Formula;
  var result = 0;

  var datevalue = scf.OperandAsNumber(sheet, foperand);
  var resulttype = scf.LookupResultType(
    datevalue.type,
    datevalue.type,
    scf.TypeLookupTable.oneargnumeric,
  );

  if (resulttype.charAt(0) == "n") {
    ymd = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
      Math.floor(datevalue.value + SocialCalc.FormatNumber.datevalues.julian_offset),
    );
    switch (fname) {
      case "DAY":
        result = ymd.day;
        break;

      case "MONTH":
        result = ymd.month;
        break;

      case "YEAR":
        result = ymd.year;
        break;

      case "WEEKDAY":
        dtype = { value: 1 };
        if (foperand.length) {
          // get type if present
          dtype = scf.OperandAsNumber(sheet, foperand);
          if (dtype.type.charAt(0) != "n" || dtype.value < 1 || dtype.value > 3) {
            scf.PushOperand(operand, "e#VALUE!", 0);
            return;
          }
          if (foperand.length) {
            // extra args
            scf.FunctionArgsError(fname, operand);
            return;
          }
        }
        doffset = 6;
        if (dtype.value > 1) {
          doffset -= 1;
        }
        result = (Math.floor(datevalue.value + doffset) % 7) + (dtype.value < 3 ? 1 : 0);
        break;
    }
  }

  scf.PushOperand(operand, resulttype, result);
  return;
};

SocialCalc.Formula.FunctionList["DAY"] = [SocialCalc.Formula.DMYFunctions, 1, "v", "", "datetime"];
SocialCalc.Formula.FunctionList["MONTH"] = [
  SocialCalc.Formula.DMYFunctions,
  1,
  "v",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["YEAR"] = [SocialCalc.Formula.DMYFunctions, 1, "v", "", "datetime"];
SocialCalc.Formula.FunctionList["WEEKDAY"] = [
  SocialCalc.Formula.DMYFunctions,
  -1,
  "weekday",
  "",
  "datetime",
];

/*
#
# EDATE(start_date,months)
# EOMONTH(start_date,months)
#
# Excel/Sheets-compatible month arithmetic. Both walk the target date to a
# whole month count (year*12+month0) then re-derive year/month, so month
# overflow/underflow (e.g. months=-15) normalizes the same way DATE()'s
# month argument already does via convert_date_gregorian_to_julian. EDATE
# clips the day-of-month to the target month's last day (Jan 31 + 1 month =
# Feb 28/29, never rolls into March); EOMONTH always returns the last day of
# the target month regardless of start_date's day.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.EDateEoMonthFunctions = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var result = 0;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var startdate = scf.OperandAsNumber(sheet, foperand);
  var months = scf.OperandAsNumber(sheet, foperand);
  var resulttype = scf.LookupResultType(
    startdate.type,
    months.type,
    scf.TypeLookupTable.twoargnumeric,
  );

  if (resulttype.charAt(0) != "n") {
    PushOperand(resulttype, result);
    return;
  }

  var ymd = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
    Math.floor((startdate.value as number) + SocialCalc.FormatNumber.datevalues.julian_offset),
  );
  // Zero-based month count (year*12 + month0) lets month overflow/underflow
  // normalize via a single division, same trick DATE()'s month argument
  // relies on inside convert_date_gregorian_to_julian.
  var totalMonths = ymd.year * 12 + (ymd.month - 1) + Math.trunc(months.value as number);
  var targetYear = Math.floor(totalMonths / 12);
  var targetMonth = totalMonths - targetYear * 12 + 1; // 1..12

  if (fname == "EOMONTH") {
    // Last day of target month = one day before day 1 of the following month.
    var nextMonth1 =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(targetYear, targetMonth + 1, 1) -
      SocialCalc.FormatNumber.datevalues.julian_offset;
    result = nextMonth1 - 1;
  } else {
    // EDATE: clip start day to the target month's last day.
    var thisMonth1 =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(targetYear, targetMonth, 1) -
      SocialCalc.FormatNumber.datevalues.julian_offset;
    var nextMonth1b =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(targetYear, targetMonth + 1, 1) -
      SocialCalc.FormatNumber.datevalues.julian_offset;
    var daysInTargetMonth = nextMonth1b - thisMonth1;
    var clippedDay = Math.min(ymd.day, daysInTargetMonth);
    result = thisMonth1 + clippedDay - 1;
  }

  PushOperand("nd", result);
  return;
};

SocialCalc.Formula.FunctionList["EDATE"] = [
  SocialCalc.Formula.EDateEoMonthFunctions,
  2,
  "edate",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["EOMONTH"] = [
  SocialCalc.Formula.EDateEoMonthFunctions,
  2,
  "edate",
  "",
  "datetime",
];

/*
#
# DATEDIF(start_date,end_date,unit)
#
# Excel-compatible date-difference. unit is "Y","M","D","MD","YM","YD"
# (case-insensitive). start_date must not be after end_date (#NUM!).
# MD/YM/YD reuse the documented (bug-compatible) algorithm: MD borrows a
# month's worth of days from the day-before-end_date's month when
# end_date's day-of-month is earlier than start_date's, matching Excel's
# well-known MD edge-case behavior rather than a "corrected" day count.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.DateDifFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var startdate = scf.OperandAsNumber(sheet, foperand);
  var enddate = scf.OperandAsNumber(sheet, foperand);
  var unitop = scf.OperandAsText(sheet, foperand);

  var resulttype = scf.LookupResultType(
    startdate.type,
    enddate.type,
    scf.TypeLookupTable.twoargnumeric,
  );
  if (resulttype.charAt(0) != "n") {
    PushOperand(resulttype, 0);
    return;
  }
  if (unitop.type.charAt(0) == "e") {
    PushOperand(unitop.type, 0);
    return;
  }

  var startS = Math.floor(startdate.value as number);
  var endS = Math.floor(enddate.value as number);
  var unit = String(unitop.value).toUpperCase();

  if (startS > endS) {
    PushOperand("e#NUM!", 0);
    return;
  }

  var s = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
    startS + SocialCalc.FormatNumber.datevalues.julian_offset,
  );
  var e = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
    endS + SocialCalc.FormatNumber.datevalues.julian_offset,
  );

  var daysInMonth = function (year: number, month: number): number {
    var thisMonth1 =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(year, month, 1) -
      SocialCalc.FormatNumber.datevalues.julian_offset;
    var nextMonth1 =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(year, month + 1, 1) -
      SocialCalc.FormatNumber.datevalues.julian_offset;
    return nextMonth1 - thisMonth1;
  };

  var result: number;

  if (unit == "Y") {
    result = e.year - s.year;
    if (e.month < s.month || (e.month == s.month && e.day < s.day)) result--;
  } else if (unit == "M") {
    result = (e.year - s.year) * 12 + (e.month - s.month);
    if (e.day < s.day) result--;
  } else if (unit == "D") {
    result = endS - startS;
  } else if (unit == "MD") {
    if (e.day >= s.day) {
      result = e.day - s.day;
    } else {
      var pm = e.month - 1;
      var py = e.year;
      if (pm < 1) {
        pm = 12;
        py--;
      }
      result = daysInMonth(py, pm) + e.day - s.day;
    }
  } else if (unit == "YM") {
    var ym = e.month - s.month;
    if (e.day < s.day) ym--;
    result = ((ym % 12) + 12) % 12;
  } else if (unit == "YD") {
    var adjYear = e.year;
    var adjStart =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(adjYear, s.month, s.day) -
      SocialCalc.FormatNumber.datevalues.julian_offset;
    if (adjStart > endS) {
      adjYear--;
      adjStart =
        SocialCalc.FormatNumber.convert_date_gregorian_to_julian(adjYear, s.month, s.day) -
        SocialCalc.FormatNumber.datevalues.julian_offset;
    }
    result = endS - adjStart;
  } else {
    PushOperand("e#NUM!", 0);
    return;
  }

  PushOperand("n", result);
  return;
};

SocialCalc.Formula.FunctionList["DATEDIF"] = [
  SocialCalc.Formula.DateDifFunction,
  3,
  "datedif",
  "",
  "datetime",
];

/*
#
# WEEKNUM(serial_number,[return_type])
# ISOWEEKNUM(date)
#
# WEEKNUM's legacy (non-ISO) week systems number from the week containing
# January 1 (week 1), with week boundaries defined by return_type's
# week-start day. return_type 21 requests ISO week numbering and defers to
# the same ISOWEEKNUM algorithm (Monday-start weeks, week 1 = the week
# containing the year's first Thursday).
#
*/

/** Sunday-based day-of-week (0=Sunday..6=Saturday) for a serial date,
 * matching js/formula1.ts DMYFunctions' WEEKDAY type-1 formula. */
FormulaMut.SundayDowForSerial = function (serial: number): number {
  return (((Math.floor(serial) + 6) % 7) + 7) % 7;
};

/** ISO week number (1..53) for a serial date: Monday-start weeks, week 1 is
 * the week containing the year's first Thursday. */
FormulaMut.IsoWeekNumForSerial = function (serial: number): number {
  var scf = SocialCalc.Formula;
  var sundayDow = scf.SundayDowForSerial(serial);
  var isoDow = sundayDow == 0 ? 7 : sundayDow; // 1=Monday..7=Sunday
  var thursday = Math.floor(serial) - isoDow + 4;
  var thursdayYmd = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
    thursday + SocialCalc.FormatNumber.datevalues.julian_offset,
  );
  var jan1OfThursdayYear =
    SocialCalc.FormatNumber.convert_date_gregorian_to_julian(thursdayYmd.year, 1, 1) -
    SocialCalc.FormatNumber.datevalues.julian_offset;
  return Math.floor((thursday - jan1OfThursdayYear) / 7) + 1;
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.WeekNumFunctions = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var serialoperand = scf.OperandAsNumber(sheet, foperand);
  var returntype: SocialCalc.FormulaValueResult = { value: 1, type: "n" };
  if (fname == "WEEKNUM" && foperand.length) {
    returntype = scf.OperandAsNumber(sheet, foperand);
    if (returntype.type.charAt(0) != "n") {
      PushOperand(returntype.type, 0);
      return;
    }
    if (foperand.length) {
      // extra args
      scf.FunctionArgsError(fname, operand);
      return;
    }
  }

  var resulttype = scf.LookupResultType(
    serialoperand.type,
    serialoperand.type,
    scf.TypeLookupTable.oneargnumeric,
  );
  if (resulttype.charAt(0) != "n") {
    PushOperand(resulttype, 0);
    return;
  }

  var serial = serialoperand.value as number;

  if (fname == "ISOWEEKNUM") {
    PushOperand("n", scf.IsoWeekNumForSerial(serial));
    return;
  }

  // WEEKNUM: return_type 21 defers to ISO week numbering.
  if (returntype.value == 21) {
    PushOperand("n", scf.IsoWeekNumForSerial(serial));
    return;
  }

  // Legacy WEEKNUM: map return_type to the week-start day (0=Sunday..6=Saturday).
  var startDowByType: { [key: number]: number } = {
    1: 0,
    17: 0,
    2: 1,
    11: 1,
    12: 2,
    13: 3,
    14: 4,
    15: 5,
    16: 6,
  };
  var startDow = startDowByType[returntype.value];
  if (startDow === undefined) {
    PushOperand("e#NUM!", 0);
    return;
  }

  var ymd = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
    Math.floor(serial) + SocialCalc.FormatNumber.datevalues.julian_offset,
  );
  var jan1 =
    SocialCalc.FormatNumber.convert_date_gregorian_to_julian(ymd.year, 1, 1) -
    SocialCalc.FormatNumber.datevalues.julian_offset;
  var jan1Dow = scf.SundayDowForSerial(jan1);
  var daysFromWeekStart = ((jan1Dow - startDow + 7) % 7) as number;
  var weekStartOfJan1Week = jan1 - daysFromWeekStart;
  var weekNum = Math.floor((Math.floor(serial) - weekStartOfJan1Week) / 7) + 1;

  PushOperand("n", weekNum);
  return;
};

SocialCalc.Formula.FunctionList["WEEKNUM"] = [
  SocialCalc.Formula.WeekNumFunctions,
  -1,
  "weeknum",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["ISOWEEKNUM"] = [
  SocialCalc.Formula.WeekNumFunctions,
  1,
  "v",
  "",
  "datetime",
];

/*
#
# YEARFRAC(start_date,end_date,[basis])
#
# basis: 0=US(NASD) 30/360 (default), 1=actual/actual, 2=actual/360,
# 3=actual/365, 4=European 30/360. Reversed dates are swapped first (Excel's
# documented behavior: YEARFRAC treats the pair as unordered).
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.YearFracFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var startdate = scf.OperandAsNumber(sheet, foperand);
  var enddate = scf.OperandAsNumber(sheet, foperand);
  var basisoperand: SocialCalc.FormulaValueResult = { value: 0, type: "n" };
  if (foperand.length) {
    basisoperand = scf.OperandAsNumber(sheet, foperand);
    if (basisoperand.type.charAt(0) != "n") {
      PushOperand(basisoperand.type, 0);
      return;
    }
    if (foperand.length) {
      scf.FunctionArgsError(fname, operand);
      return;
    }
  }

  var resulttype = scf.LookupResultType(
    startdate.type,
    enddate.type,
    scf.TypeLookupTable.twoargnumeric,
  );
  if (resulttype.charAt(0) != "n") {
    PushOperand(resulttype, 0);
    return;
  }

  var basis = Math.trunc(basisoperand.value as number);
  if (basis < 0 || basis > 4) {
    PushOperand("e#NUM!", 0);
    return;
  }

  var startS = Math.floor(startdate.value as number);
  var endS = Math.floor(enddate.value as number);
  if (startS > endS) {
    var tmp = startS;
    startS = endS;
    endS = tmp;
  }

  if (startS == endS) {
    PushOperand("n", 0);
    return;
  }

  var s = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
    startS + SocialCalc.FormatNumber.datevalues.julian_offset,
  );
  var e = SocialCalc.FormatNumber.convert_date_julian_to_gregorian(
    endS + SocialCalc.FormatNumber.datevalues.julian_offset,
  );
  var isLeapYear = function (y: number): boolean {
    return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
  };

  var result: number;

  if (basis == 0 || basis == 4) {
    // NASD (0) / European (4) 30/360.
    var d1 = s.day;
    var d2 = e.day;
    if (basis == 0) {
      // Full NASD rule set (Excel-documented): if the start date is the
      // last day of February, treat it as day 30; if the end date is ALSO
      // the last day of February AND the start date was (tracked
      // independently of d1, since the day-31 rollback below can also make
      // d1 == 30 for an unrelated reason — e.g. Jan 31 — without the
      // end-of-February rule applying), treat the end date as day 30 too.
      // Then apply the day-31 rollback on whatever remains.
      var startLastDayOfMonth =
        SocialCalc.FormatNumber.convert_date_gregorian_to_julian(s.year, s.month + 1, 1) -
        SocialCalc.FormatNumber.convert_date_gregorian_to_julian(s.year, s.month, 1);
      var startIsLastFeb = s.month == 2 && s.day == startLastDayOfMonth;
      if (startIsLastFeb) d1 = 30;
      if (d1 == 31) d1 = 30;
      var endLastDayOfMonth =
        SocialCalc.FormatNumber.convert_date_gregorian_to_julian(e.year, e.month + 1, 1) -
        SocialCalc.FormatNumber.convert_date_gregorian_to_julian(e.year, e.month, 1);
      var endIsLastFeb = e.month == 2 && e.day == endLastDayOfMonth;
      if (endIsLastFeb && startIsLastFeb) d2 = 30;
      if (d2 == 31 && d1 == 30) d2 = 30;
    } else {
      d1 = Math.min(d1, 30);
      d2 = Math.min(d2, 30);
    }
    var days360 = (e.year - s.year) * 360 + (e.month - s.month) * 30 + (d2 - d1);
    result = days360 / 360;
  } else if (basis == 2) {
    result = (endS - startS) / 360;
  } else if (basis == 3) {
    result = (endS - startS) / 365;
  } else {
    // basis 1: actual/actual
    if (s.year == e.year) {
      result = (endS - startS) / (isLeapYear(s.year) ? 366 : 365);
    } else {
      var totalDays = 0;
      for (var y = s.year; y <= e.year; y++) {
        totalDays += isLeapYear(y) ? 366 : 365;
      }
      var avgYearDays = totalDays / (e.year - s.year + 1);
      result = (endS - startS) / avgYearDays;
    }
  }

  PushOperand("n", result);
  return;
};

SocialCalc.Formula.FunctionList["YEARFRAC"] = [
  SocialCalc.Formula.YearFracFunction,
  -2,
  "yearfrac",
  "",
  "datetime",
];

/*
#
# WORKDAY(start_date,days,[holidays])
# NETWORKDAYS(start_date,end_date,[holidays])
# WORKDAY.INTL(start_date,days,[weekend],[holidays])
# NETWORKDAYS.INTL(start_date,end_date,[weekend],[holidays])
#
# Shared weekend/holiday working-day policy. The plain (non-.INTL) forms
# use the default Saturday/Sunday weekend (equivalent to .INTL weekend
# code 1). weekend accepts either a numeric code (1-7 two-day pairs,
# 11-17 single day) or a 7-character "0"/"1" mask (position 1=Monday..
# position 7=Sunday, "1"=non-working); an all-"1" mask or any other
# illegal code/mask is #NUM!/#VALUE!. Holidays is an optional range/coord
# of serial dates; duplicate or blank holiday entries are harmless (a day
# is either a holiday or not — scanning them twice changes nothing).
# See lemma/weekday-policy.ts for the verified legality/decode/working-day
# predicates this mirrors (weekendCodeToMask, isLegalWeekendMask,
# isNonWorkingDay); the calendar/holiday-scan loops below stay
# runtime-tested only, matching that facade's documented split.
#
*/

/** Default weekend mask (Saturday+Sunday off) — .INTL weekend code 1. */
FormulaMut.DEFAULT_WEEKEND_MASK = 96; // pow2(5) + pow2(6): Saturday(5) + Sunday(6)

/**
 * Decode a WORKDAY.INTL/NETWORKDAYS.INTL weekend argument (numeric code or
 * 7-char mask string) to a Mon(day 0)..Sun(day 6) mask, with a non-empty
 * errortype ("e#NUM!"/"e#VALUE!") on any illegal code/mask/type.
 * Mirrors lemma/weekday-policy.ts's weekendCodeToMask/isLegalWeekendMask.
 */
FormulaMut.DecodeWeekendArgument = function (
  value: unknown,
  valuetype: string,
): { mask: number; errortype: string } {
  if (valuetype.charAt(0) == "e") {
    return { mask: 0, errortype: valuetype };
  }
  if (valuetype.charAt(0) == "n") {
    var code = Math.trunc(value as number);
    var mask: number;
    if (code >= 1 && code <= 7) {
      var first = (code + 4) % 7;
      var second = (first + 1) % 7;
      mask = Math.pow(2, first) + Math.pow(2, second);
    } else if (code >= 11 && code <= 17) {
      mask = Math.pow(2, (code + 2) % 7);
    } else {
      return { mask: 0, errortype: "e#NUM!" };
    }
    return { mask: mask, errortype: "" };
  }
  if (valuetype.charAt(0) == "t") {
    var str = String(value);
    if (str.length != 7) {
      return { mask: 0, errortype: "e#VALUE!" };
    }
    var strmask = 0;
    for (var i = 0; i < 7; i++) {
      var ch = str.charAt(i);
      if (ch != "0" && ch != "1") {
        return { mask: 0, errortype: "e#VALUE!" };
      }
      if (ch == "1") strmask += Math.pow(2, i);
    }
    if (strmask == 127) {
      // every day non-working: no working day to land on
      return { mask: 0, errortype: "e#VALUE!" };
    }
    return { mask: strmask, errortype: "" };
  }
  return { mask: 0, errortype: "e#VALUE!" };
};

/**
 * Collect holiday serial dates (floored) from a range/coord/scalar-number
 * operand into a lookup Set. A range/coord scans every cell (blank/text/
 * error cells ignored — not every holiday-range cell need be populated); a
 * bare scalar number (e.g. an inline DATE(...) or literal serial, matching
 * Excel/Sheets' documented single-holiday-date support) contributes its one
 * floored serial. Returns null only for a genuinely non-date operand (text/
 * error/blank), which callers surface as #VALUE!.
 */
FormulaMut.CollectHolidaySerials = function (
  sheet: SocialCalc.Sheet,
  holidayoperand: SocialCalc.FormulaOperand,
): Set<number> | null {
  var scf = SocialCalc.Formula;
  var holidays = new Set<number>();
  if (holidayoperand.type == "range" || holidayoperand.type == "coord") {
    var holidaylist: SocialCalc.FormulaOperand[] = [holidayoperand];
    while (holidaylist.length > 0) {
      var value = scf.OperandValueAndType(sheet, holidaylist);
      if (value.type.charAt(0) == "n") {
        holidays.add(Math.floor(value.value as number));
      }
    }
    return holidays;
  }
  if (holidayoperand.type.charAt(0) == "n") {
    holidays.add(Math.floor(holidayoperand.value as number));
    return holidays;
  }
  return null;
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.WorkdayNetworkdaysFunctions = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var isIntl = fname == "WORKDAY.INTL" || fname == "NETWORKDAYS.INTL";
  var isWorkday = fname == "WORKDAY" || fname == "WORKDAY.INTL";

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  var startdate = scf.OperandAsNumber(sheet, foperand);
  var secondarg = scf.OperandAsNumber(sheet, foperand); // "days" for WORKDAY, "end_date" for NETWORKDAYS
  var resulttype = scf.LookupResultType(
    startdate.type,
    secondarg.type,
    scf.TypeLookupTable.twoargnumeric,
  );
  if (resulttype.charAt(0) != "n") {
    PushOperand(resulttype, 0);
    return;
  }

  var mask = scf.DEFAULT_WEEKEND_MASK;
  if (isIntl && foperand.length) {
    // weekend is always positional argument 3 for the .INTL forms — never
    // reinterpreted as holidays, even when passed as a coord/range
    // reference (OperandValueAndType dereferences it to its scalar
    // value/type, matching how every other numeric/text argument in this
    // file resolves a cell reference).
    var weekendoperand = scf.OperandValueAndType(sheet, foperand);
    var decoded = scf.DecodeWeekendArgument(weekendoperand.value, weekendoperand.type);
    if (decoded.errortype) {
      PushOperand(decoded.errortype, 0);
      return;
    }
    mask = decoded.mask;
  }

  var holidays: Set<number> | null = null;
  if (foperand.length) {
    var holidayoperand = scf.TopOfStackValueAndType(sheet, foperand);
    holidays = scf.CollectHolidaySerials(sheet, holidayoperand);
    if (holidays === null) {
      PushOperand("e#VALUE!", 0);
      return;
    }
    if (foperand.length) {
      // too many arguments
      scf.FunctionArgsError(fname, operand);
      return;
    }
  }

  var dayIsWorking = function (serial: number): boolean {
    var sundayDow = (((Math.floor(serial) + 6) % 7) + 7) % 7; // 0=Sunday..6=Saturday
    var isoDow = (sundayDow + 6) % 7; // 0=Monday..6=Sunday
    var dayOff = Math.floor(mask / Math.pow(2, isoDow)) % 2 == 1;
    if (dayOff) return false;
    if (holidays && holidays.has(Math.floor(serial))) return false;
    return true;
  };

  if (isWorkday) {
    var days = Math.trunc(secondarg.value as number);
    var direction = days > 0 ? 1 : days < 0 ? -1 : 0;
    var remaining = Math.abs(days);
    var cur = Math.floor(startdate.value as number);
    while (remaining > 0) {
      cur += direction;
      if (dayIsWorking(cur)) remaining--;
    }
    PushOperand("nd", cur);
    return;
  }

  // NETWORKDAYS[.INTL]
  var startS = Math.floor(startdate.value as number);
  var endS = Math.floor(secondarg.value as number);
  var direction2 = startS <= endS ? 1 : -1;
  var lo = Math.min(startS, endS);
  var hi = Math.max(startS, endS);
  var count = 0;
  for (var d = lo; d <= hi; d++) {
    if (dayIsWorking(d)) count++;
  }
  PushOperand("n", direction2 * count);
  return;
};

SocialCalc.Formula.FunctionList["WORKDAY"] = [
  SocialCalc.Formula.WorkdayNetworkdaysFunctions,
  -2,
  "workday",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["NETWORKDAYS"] = [
  SocialCalc.Formula.WorkdayNetworkdaysFunctions,
  -2,
  "workday",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["WORKDAY.INTL"] = [
  SocialCalc.Formula.WorkdayNetworkdaysFunctions,
  -2,
  "workdayintl",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["NETWORKDAYS.INTL"] = [
  SocialCalc.Formula.WorkdayNetworkdaysFunctions,
  -2,
  "workdayintl",
  "",
  "datetime",
];

/*
#
# HOUR(datetime)
# MINUTE(datetime)
# SECOND(datetime)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.HMSFunctions = function (fname, operand, foperand, sheet) {
  var hours, minutes, seconds, fraction;
  var scf = SocialCalc.Formula;
  var result = 0;

  var datetime = scf.OperandAsNumber(sheet, foperand);
  var resulttype = scf.LookupResultType(
    datetime.type,
    datetime.type,
    scf.TypeLookupTable.oneargnumeric,
  );

  if (resulttype.charAt(0) == "n") {
    if (datetime.value < 0) {
      scf.PushOperand(operand, "e#NUM!", 0); // must be non-negative
      return;
    }
    fraction = datetime.value - Math.floor(datetime.value); // fraction of a day
    fraction *= 24;
    hours = Math.floor(fraction);
    fraction -= Math.floor(fraction);
    fraction *= 60;
    minutes = Math.floor(fraction);
    fraction -= Math.floor(fraction);
    fraction *= 60;
    seconds = Math.floor(fraction + (datetime.value >= 0 ? 0.5 : -0.5));
    if (fname == "HOUR") {
      result = hours;
    } else if (fname == "MINUTE") {
      result = minutes;
    } else if (fname == "SECOND") {
      result = seconds;
    }
  }

  scf.PushOperand(operand, resulttype, result);
  return;
};

SocialCalc.Formula.FunctionList["HOUR"] = [SocialCalc.Formula.HMSFunctions, 1, "v", "", "datetime"];
SocialCalc.Formula.FunctionList["MINUTE"] = [
  SocialCalc.Formula.HMSFunctions,
  1,
  "v",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["SECOND"] = [
  SocialCalc.Formula.HMSFunctions,
  1,
  "v",
  "",
  "datetime",
];

/*
#
# EXACT(v1,v2)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.ExactFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var result = 0;
  var resulttype = "nl";

  var value1 = scf.OperandValueAndType(sheet, foperand);
  var v1type = value1.type.charAt(0);
  var value2 = scf.OperandValueAndType(sheet, foperand);
  var v2type = value2.type.charAt(0);

  if (v1type == "t") {
    if (v2type == "t") {
      result = value1.value == value2.value ? 1 : 0;
    } else if (v2type == "b") {
      result = value1.value.length ? 0 : 1;
    } else if (v2type == "n") {
      result = value1.value == value2.value + "" ? 1 : 0;
    } else if (v2type == "e") {
      result = value2.value;
      resulttype = value2.type;
    }
  } else if (v1type == "n") {
    if (v2type == "n") {
      result = value1.value - 0 == value2.value - 0 ? 1 : 0;
    } else if (v2type == "b") {
      result = 0;
    } else if (v2type == "t") {
      result = value1.value + "" == value2.value ? 1 : 0;
    } else if (v2type == "e") {
      result = value2.value;
      resulttype = value2.type;
    }
  } else if (v1type == "b") {
    if (v2type == "t") {
      result = value2.value.length ? 0 : 1;
    } else if (v2type == "b") {
      result = 1;
    } else if (v2type == "n") {
      result = 0;
    } else if (v2type == "e") {
      result = value2.value;
      resulttype = value2.type;
    }
  } else if (v1type == "e") {
    result = value1.value;
    resulttype = value1.type;
  }

  scf.PushOperand(operand, resulttype, result);
  return;
};

SocialCalc.Formula.FunctionList["EXACT"] = [SocialCalc.Formula.ExactFunction, 2, "", "", "text"];

/*
#
# FIND(key,string,[start])
# LEFT(string,[length])
# LEN(string)
# LOWER(string)
# MID(string,start,length)
# PROPER(string)
# REPLACE(string,start,length,new)
# REPT(string,count)
# RIGHT(string,[length])
# SUBSTITUTE(string,old,new,[which])
# TRIM(string)
# HEXCODE(string)
# UPPER(string)
#
*/

// SocialCalc.Formula.ArgList has an array for each function, one entry for each possible arg (up to max).
// Min args are specified in SocialCalc.Formula.FunctionList.
// If array element is 1 then it's a text argument, if it's 0 then it's numeric, if -1 then just get whatever's there
// Text values are manipulated as UTF-8, converting from and back to byte strings

FormulaMut.ArgList = {
  FIND: [1, 1, 0],
  SEARCH: [1, 1, 0],
  LEFT: [1, 0],
  LEN: [1],
  LOWER: [1],
  MID: [1, 0, 0],
  PROPER: [1],
  REPLACE: [1, 0, 0, 1],
  REPT: [1, 0],
  RIGHT: [1, 0],
  SUBSTITUTE: [1, 1, 1, 0],
  TRIM: [1],
  HEXCODE: [1],
  UPPER: [1],
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.StringFunctions = function (fname, operand, foperand, sheet) {
  var i, value, offset, len, start, count;
  var fulltext, oldtext, newtext, which, oldpos, pos;
  var scf = SocialCalc.Formula;
  var result: any = 0;
  var resulttype = "e#VALUE!";

  var numargs = foperand.length;
  var argdef = scf.ArgList[fname];
  var operand_value = [];
  var operand_type = [];

  for (i = 1; i <= numargs; i++) {
    // go through each arg, get value and type, and check for errors
    if (i > argdef.length) {
      // too many args
      scf.FunctionArgsError(fname, operand);
      return;
    }
    // ArgList only ever uses 0 (number) or 1 (text).
    if (argdef[i - 1] == 0) value = scf.OperandAsNumber(sheet, foperand);
    else value = scf.OperandAsText(sheet, foperand);
    operand_value[i] = value.value;
    operand_type[i] = value.type;
    if (value.type.charAt(0) == "e") {
      scf.PushOperand(operand, value.type, result);
      return;
    }
  }

  switch (fname) {
    case "FIND":
      offset = operand_type[3] ? operand_value[3] - 1 : 0;
      if (offset < 0) {
        result = "Start is before string"; // !! not displayed, no need to translate
      } else {
        result = operand_value[2].indexOf(operand_value[1], offset); // (null string matches first char)
        if (result >= 0) {
          result += 1;
          resulttype = "n";
        } else {
          result = "Not found"; // !! not displayed, error is e#VALUE!
        }
      }
      break;

    case "SEARCH":
      // Case-insensitive FIND counterpart. No wildcard (?/*) support: this
      // engine's FIND is a literal indexOf, so SEARCH stays a literal
      // case-insensitive indexOf rather than diverging with wildcard syntax.
      offset = operand_type[3] ? operand_value[3] - 1 : 0;
      if (offset < 0) {
        result = "Start is before string"; // !! not displayed, no need to translate
      } else {
        result = (operand_value[2] as string)
          .toLowerCase()
          .indexOf((operand_value[1] as string).toLowerCase(), offset);
        if (result >= 0) {
          result += 1;
          resulttype = "n";
        } else {
          result = "Not found"; // !! not displayed, error is e#VALUE!
        }
      }
      break;

    case "LEFT":
      len = operand_type[2] ? operand_value[2] - 0 : 1;
      if (len < 0) {
        result = "Negative length";
      } else {
        result = operand_value[1].substring(0, len);
        resulttype = "t";
      }
      break;

    case "LEN":
      result = operand_value[1].length;
      resulttype = "n";
      break;

    case "LOWER":
      result = operand_value[1].toLowerCase();
      resulttype = "t";
      break;

    case "MID":
      start = operand_value[2] - 0;
      len = operand_value[3] - 0;
      if (len < 1 || start < 1) {
        result = "Bad arguments";
      } else {
        result = operand_value[1].substring(start - 1, start + len - 1);
        resulttype = "t";
      }
      break;

    case "PROPER":
      result = (operand_value[1] as any).replace(/\b\w+\b/g, function (word: string) {
        return word.substring(0, 1).toUpperCase() + word.substring(1);
      }); // uppercase first character of words (see JavaScript, Flanagan, 5th edition, page 704)
      resulttype = "t";
      break;

    case "REPLACE":
      start = operand_value[2] - 0;
      len = operand_value[3] - 0;
      if (len < 0 || start < 1) {
        result = "Bad arguments";
      } else {
        result =
          operand_value[1].substring(0, start - 1) +
          operand_value[4] +
          operand_value[1].substring(start - 1 + len);
        resulttype = "t";
      }
      break;

    case "REPT":
      count = operand_value[2] - 0;
      if (count < 0) {
        result = "Negative count";
      } else {
        result = "";
        for (; count > 0; count--) {
          result += operand_value[1];
        }
        resulttype = "t";
      }
      break;

    case "RIGHT":
      len = operand_type[2] ? operand_value[2] - 0 : 1;
      if (len < 0) {
        result = "Negative length";
      } else {
        result = operand_value[1].slice(-len);
        resulttype = "t";
      }
      break;

    case "SUBSTITUTE":
      fulltext = operand_value[1];
      oldtext = operand_value[2];
      newtext = operand_value[3];
      if (operand_value[4] != null) {
        which = operand_value[4] - 0;
        if (which <= 0) {
          result = "Non-positive instance number";
          break;
        }
      } else {
        which = 0;
      }
      count = 0;
      oldpos = 0;
      result = "";
      while (true) {
        pos = fulltext.indexOf(oldtext, oldpos);
        if (pos >= 0) {
          count++; //!!!!!! old test just in case: if (count>1000) {alert(pos); break;}
          result += fulltext.substring(oldpos, pos);
          if (which == 0) {
            result += newtext; // substitute
          } else if (which == count) {
            result += newtext + fulltext.substring(pos + oldtext.length);
            break;
          } else {
            result += oldtext; // leave as was
          }
          oldpos = pos + oldtext.length;
        } else {
          // no more
          result += fulltext.substring(oldpos);
          break;
        }
      }
      resulttype = "t";
      break;

    case "TRIM":
      result = operand_value[1];
      result = result.replace(/^ */, "");
      result = result.replace(/ *$/, "");
      result = result.replace(/ +/g, " ");
      resulttype = "t";
      break;

    case "HEXCODE":
      result = String(operand_value[1]);
      var code = result.charCodeAt(0);
      if (0xd800 <= code && code <= 0xdbff) {
        var next = result.charCodeAt(1);
        if (0xdc00 <= next && next <= 0xdfff) {
          code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        }
      }
      result = code.toString(16).toUpperCase();
      resulttype = "t";
      break;

    case "UPPER":
      result = operand_value[1].toUpperCase();
      resulttype = "t";
      break;
  }

  scf.PushOperand(operand, resulttype, result);
  return;
};

SocialCalc.Formula.FunctionList["FIND"] = [
  SocialCalc.Formula.StringFunctions,
  -2,
  "find",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["SEARCH"] = [
  SocialCalc.Formula.StringFunctions,
  -2,
  "find",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["LEFT"] = [
  SocialCalc.Formula.StringFunctions,
  -2,
  "tc",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["LEN"] = [SocialCalc.Formula.StringFunctions, 1, "txt", "", "text"];
SocialCalc.Formula.FunctionList["LOWER"] = [
  SocialCalc.Formula.StringFunctions,
  1,
  "txt",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["MID"] = [SocialCalc.Formula.StringFunctions, 3, "mid", "", "text"];
SocialCalc.Formula.FunctionList["PROPER"] = [
  SocialCalc.Formula.StringFunctions,
  1,
  "v",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["REPLACE"] = [
  SocialCalc.Formula.StringFunctions,
  4,
  "replace",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["REPT"] = [SocialCalc.Formula.StringFunctions, 2, "tc", "", "text"];
SocialCalc.Formula.FunctionList["RIGHT"] = [
  SocialCalc.Formula.StringFunctions,
  -1,
  "tc",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["SUBSTITUTE"] = [
  SocialCalc.Formula.StringFunctions,
  -3,
  "subs",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["TRIM"] = [SocialCalc.Formula.StringFunctions, 1, "v", "", "text"];
SocialCalc.Formula.FunctionList["HEXCODE"] = [
  SocialCalc.Formula.StringFunctions,
  1,
  "v",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["UPPER"] = [SocialCalc.Formula.StringFunctions, 1, "v", "", "text"];

/*
#
# is_functions:
#
# ISBLANK(value)
# ISERR(value)
# ISERROR(value)
# ISLOGICAL(value)
# ISNA(value)
# ISNONTEXT(value)
# ISNUMBER(value)
# ISTEXT(value)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.IsFunctions = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var result = 0;
  var resulttype = "nl";

  var value = scf.OperandValueAndType(sheet, foperand);
  var t = value.type.charAt(0);

  switch (fname) {
    case "ISBLANK":
      result = value.type == "b" ? 1 : 0;
      break;

    case "ISERR":
      result = t == "e" ? (value.type == "e#N/A" ? 0 : 1) : 0;
      break;

    case "ISERROR":
      result = t == "e" ? 1 : 0;
      break;

    case "ISLOGICAL":
      result = value.type == "nl" ? 1 : 0;
      break;

    case "ISNA":
      result = value.type == "e#N/A" ? 1 : 0;
      break;

    case "ISNONTEXT":
      result = t == "t" ? 0 : 1;
      break;

    case "ISNUMBER":
      result = t == "n" ? 1 : 0;
      break;

    case "ISTEXT":
      result = t == "t" ? 1 : 0;
      break;
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["ISBLANK"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];
SocialCalc.Formula.FunctionList["ISERR"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];
SocialCalc.Formula.FunctionList["ISERROR"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];
SocialCalc.Formula.FunctionList["ISLOGICAL"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];
SocialCalc.Formula.FunctionList["ISNA"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];
SocialCalc.Formula.FunctionList["ISNONTEXT"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];
SocialCalc.Formula.FunctionList["ISNUMBER"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];
SocialCalc.Formula.FunctionList["ISTEXT"] = [SocialCalc.Formula.IsFunctions, 1, "v", "", "test"];

/*
#
# ntv_functions:
#
# N(value)
# T(value)
# VALUE(value)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.NTVFunctions = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var result: any = 0;
  var resulttype = "e#VALUE!";

  var value = scf.OperandValueAndType(sheet, foperand);
  var t = value.type.charAt(0);

  switch (fname) {
    case "N":
      result = t == "n" ? value.value - 0 : 0;
      resulttype = "n";
      break;

    case "T":
      result = t == "t" ? value.value + "" : "";
      resulttype = "t";
      break;

    case "VALUE":
      if (t == "n" || t == "b") {
        result = value.value || 0;
        resulttype = "n";
      } else if (t == "t") {
        value = SocialCalc.DetermineValueType(value.value);
        if (value.type.charAt(0) != "n") {
          result = 0;
          resulttype = "e#VALUE!";
        } else {
          result = value.value - 0;
          resulttype = "n";
        }
      }
      break;
  }

  if (t == "e") {
    // error trumps
    resulttype = value.type;
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["N"] = [SocialCalc.Formula.NTVFunctions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["T"] = [SocialCalc.Formula.NTVFunctions, 1, "v", "", "text"];
SocialCalc.Formula.FunctionList["VALUE"] = [SocialCalc.Formula.NTVFunctions, 1, "v", "", "text"];

/*
#
# ref_info_functions:
#
# ISFORMULA(value/reference)
# ISREF(value)
# ERROR.TYPE(error_val)
# TYPE(value)
#
# ISFORMULA and ISREF inspect the operand's *typed* stack representation
# (coord/range/name) before it is coerced to the cell value it points at --
# this is the "preserve typed reference distinction before coercion"
# requirement: a plain literal (5, "x", TRUE) is never mistaken for a
# reference. ERROR.TYPE and TYPE instead resolve the operand to its actual
# value (matching Excel, where both functions describe what a reference
# *contains*, not the reference itself).
#
*/

/**
 * @param {SocialCalc.Sheet} sheet
 * @param {string} coordtext
 */
FormulaMut.IsFormulaCoordCell = function (
  sheet: SocialCalc.Sheet,
  coordtext: string,
): SocialCalc.Cell | null {
  var scf = SocialCalc.Formula;
  var coordsheet: SocialCalc.Sheet = sheet;
  var pos = coordtext.indexOf("!");
  if (pos != -1) {
    // OperandsAsCoordOnSheet (the "!" cross-sheet operator) already
    // resolves and validates the sheet before a "coord" value carrying an
    // embedded "!" can exist, so FindInSheetCache here is always a hit;
    // an unavailable sheet fails earlier as an e#REF! operand and never
    // reaches this function as a "coord" type.
    coordsheet = scf.FindInSheetCache(coordtext.substring(pos + 1))!;
    coordtext = coordtext.substring(0, pos);
  }
  return coordsheet.cells[scf.PlainCoord(coordtext)] || null;
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.RefInfoFunctions = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var result: number = 0;

  if (fname == "ISFORMULA" || fname == "ISREF") {
    var value1 = scf.TopOfStackValueAndType(sheet, foperand);

    if (fname == "ISREF") {
      result = value1.type == "coord" || value1.type == "range" ? 1 : 0;
      scf.PushOperand(operand, "nl", result);
      return;
    }

    // ISFORMULA
    if (value1.type == "coord") {
      var cell = scf.IsFormulaCoordCell(sheet, value1.value as string);
      // An unavailable cross-sheet reference or blank cell both resolve to
      // null here and are treated as "not a formula" (0), matching the
      // ROW/COLUMN #REF! convention's spirit without forcing a reference
      // to an unloaded sheet into an error.
      result = cell && cell.datatype == "f" ? 1 : 0;
    } else if (value1.type == "range") {
      // No standard single-cell reduction for a range in this engine;
      // use the top-left cell, matching the ROW/COLUMN/COLUMNS convention.
      var rangeinfo = scf.DecodeRangeParts(sheet, value1.value as string);
      if (!rangeinfo) {
        result = 0;
      } else {
        var topleft =
          rangeinfo.sheetdata.cells[SocialCalc.crToCoord(rangeinfo.col1num, rangeinfo.row1num)];
        result = topleft && topleft.datatype == "f" ? 1 : 0;
      }
    } else {
      // literal value, error, or unresolvable name -- not a formula reference
      result = 0;
    }

    scf.PushOperand(operand, "nl", result);
    return;
  }

  if (fname == "TYPE") {
    // Peek the typed operand before OperandValueAndType coerces a "range"
    // to its top-left cell's value (StepThroughRangeDown) -- TYPE must
    // report range/array as 64 for the reference itself, not the value it
    // resolves to.
    var typedvalue = scf.TopOfStackValueAndType(sheet, foperand);
    if (typedvalue.type == "range") {
      scf.PushOperand(operand, "n", 64);
      return;
    }
    var tt = typedvalue.type.charAt(0);
    if (tt == "e") {
      result = 16;
    } else if (typedvalue.type == "nl") {
      result = 4;
    } else if (tt == "t") {
      result = 2;
    } else if (typedvalue.type == "coord") {
      // resolve the reference to the cell's value/type, matching Excel's
      // TYPE(A1) behavior (reports the referenced value's type).
      var coordvalue = scf.OperandValueAndType(sheet, [typedvalue]);
      var ct = coordvalue.type.charAt(0);
      if (ct == "e") result = 16;
      else if (coordvalue.type == "nl") result = 4;
      else if (ct == "t") result = 2;
      else result = 1;
    } else {
      // "n" and its subtypes, and blank ("b" coerces to numeric 0)
      result = 1;
    }
    scf.PushOperand(operand, "n", result);
    return;
  }

  // ERROR.TYPE resolves to the actual value the operand refers to.
  var value = scf.OperandValueAndType(sheet, foperand);

  var errorcodes: { [key: string]: number } = {
    "e#NULL!": 1,
    "e#DIV/0!": 2,
    "e#VALUE!": 3,
    "e#REF!": 4,
    "e#NAME?": 5,
    "e#NUM!": 6,
    "e#N/A": 7,
    // Excel reserves 8 for #GETTING_DATA, a state this engine never
    // produces; #SPILL! has no official ERROR.TYPE code, so we extend
    // the table with the same slot Excel later assigned it (code 8 is
    // otherwise dead in a synchronous engine).
    "e#SPILL!": 8,
  };
  var code = errorcodes[value.type];
  if (code) {
    scf.PushOperand(operand, "n", code);
  } else {
    scf.PushOperand(operand, "e#N/A", 0); // argument is not an error value
  }
  return;
};

SocialCalc.Formula.FunctionList["ISFORMULA"] = [
  SocialCalc.Formula.RefInfoFunctions,
  1,
  "v",
  "",
  "test",
];
SocialCalc.Formula.FunctionList["ISREF"] = [
  SocialCalc.Formula.RefInfoFunctions,
  1,
  "v",
  "",
  "test",
];
SocialCalc.Formula.FunctionList["ERROR.TYPE"] = [
  SocialCalc.Formula.RefInfoFunctions,
  1,
  "v",
  "",
  "test",
];
SocialCalc.Formula.FunctionList["TYPE"] = [SocialCalc.Formula.RefInfoFunctions, 1, "v", "", "test"];

/*
#
# ABS(value)
# ACOS(value)
# ASIN(value)
# ATAN(value)
# COS(value)
# DEGREES(value)
# EVEN(value)
# EXP(value)
# FACT(value)
# INT(value)
# LN(value)
# LOG10(value)
# ODD(value)
# RADIANS(value)
# SIN(value)
# SQRT(value)
# TAN(value)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.Math1Functions = function (fname, operand, foperand, sheet) {
  var v1, value, f;
  var result: any = {};

  var scf = SocialCalc.Formula;

  v1 = scf.OperandAsNumber(sheet, foperand);
  value = v1.value;
  result.type = scf.LookupResultType(v1.type, v1.type, scf.TypeLookupTable.oneargnumeric);

  if (result.type == "n") {
    switch (fname) {
      case "ABS":
        value = Math.abs(value);
        break;

      case "ACOS":
        if (value >= -1 && value <= 1) {
          value = Math.acos(value);
        } else {
          result.type = "e#NUM!";
        }
        break;

      case "ASIN":
        if (value >= -1 && value <= 1) {
          value = Math.asin(value);
        } else {
          result.type = "e#NUM!";
        }
        break;

      case "ATAN":
        value = Math.atan(value);
        break;

      case "COS":
        value = Math.cos(value);
        break;

      case "DEGREES":
        value = (value * 180) / Math.PI;
        break;

      case "EVEN":
        value = value < 0 ? -value : value;
        if (value != Math.floor(value)) {
          value = Math.floor(value + 1) + (Math.floor(value + 1) % 2);
        } else {
          // integer
          value = value + (value % 2);
        }
        if (v1.value < 0) value = -value;
        break;

      case "EXP":
        value = Math.exp(value);
        break;

      case "FACT":
        f = 1;
        value = Math.floor(value);
        for (; value > 0; value--) {
          f *= value;
        }
        value = f;
        break;

      case "INT":
        value = Math.floor(value); // spreadsheet INT is floor(), not int()
        break;

      case "LN":
        if (value <= 0) {
          result.type = "e#NUM!";
          result.error = SocialCalc.Constants.s_sheetfunclnarg;
        }
        value = Math.log(value);
        break;

      case "LOG10":
        if (value <= 0) {
          result.type = "e#NUM!";
          result.error = SocialCalc.Constants.s_sheetfunclog10arg;
        }
        value = Math.log(value) / Math.log(10);
        break;

      case "ODD":
        value = value < 0 ? -value : value;
        if (value != Math.floor(value)) {
          value = Math.floor(value + 1) + (1 - (Math.floor(value + 1) % 2));
        } else {
          // integer
          value = value + (1 - (value % 2));
        }
        if (v1.value < 0) value = -value;
        break;

      case "RADIANS":
        value = (value * Math.PI) / 180;
        break;

      case "SIN":
        value = Math.sin(value);
        break;

      case "SIGN":
        value = value > 0 ? 1 : value < 0 ? -1 : 0;
        break;

      case "SQRT":
        if (value >= 0) {
          value = Math.sqrt(value);
        } else {
          result.type = "e#NUM!";
        }
        break;

      case "TAN":
        if (Math.cos(value) != 0) {
          value = Math.tan(value);
        } else {
          result.type = "e#NUM!";
        }
        break;
    }
  }

  result.value = value;
  operand.push(result);

  return null;
};

// Add to function list
SocialCalc.Formula.FunctionList["ABS"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["ACOS"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["ASIN"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["ATAN"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["COS"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["DEGREES"] = [
  SocialCalc.Formula.Math1Functions,
  1,
  "v",
  "",
  "math",
];
SocialCalc.Formula.FunctionList["EVEN"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["EXP"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["FACT"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["INT"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["LN"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["LOG10"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["ODD"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["RADIANS"] = [
  SocialCalc.Formula.Math1Functions,
  1,
  "v",
  "",
  "math",
];
SocialCalc.Formula.FunctionList["SIN"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["SQRT"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["TAN"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];
SocialCalc.Formula.FunctionList["SIGN"] = [SocialCalc.Formula.Math1Functions, 1, "v", "", "math"];

/*
#
# ATAN2(x, y)
# MOD(a, b)
# POWER(a, b)
# TRUNC(value, precision)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.Math2Functions = function (fname, operand, foperand, sheet) {
  var xval, yval, quotient, decimalscale, i;
  var result: any = {};

  var scf = SocialCalc.Formula;

  xval = scf.OperandAsNumber(sheet, foperand);
  yval = scf.OperandAsNumber(sheet, foperand);
  result.type = scf.LookupResultType(xval.type, yval.type, scf.TypeLookupTable.twoargnumeric);

  if (result.type == "n") {
    switch (fname) {
      case "ATAN2":
        if (xval.value == 0 && yval.value == 0) {
          result.type = "e#DIV/0!";
        } else {
          result.value = Math.atan2(yval.value, xval.value);
        }
        break;

      case "POWER":
        result.value = Math.pow(xval.value, yval.value);
        if (isNaN(result.value)) {
          result.value = 0;
          result.type = "e#NUM!";
        }
        break;

      case "MOD": // en.wikipedia.org/wiki/Modulo_operation, etc.
        if (yval.value == 0) {
          result.type = "e#DIV/0!";
        } else {
          quotient = xval.value / yval.value;
          quotient = Math.floor(quotient);
          result.value = xval.value - quotient * yval.value;
        }
        break;

      case "QUOTIENT":
        if (yval.value == 0) {
          result.type = "e#DIV/0!";
        } else {
          result.value = Math.trunc(xval.value / yval.value);
        }
        break;

      case "MROUND":
        if (yval.value == 0) {
          result.value = 0;
        } else if ((xval.value < 0 && yval.value > 0) || (xval.value > 0 && yval.value < 0)) {
          // Number and Multiple must share sign (docs.microsoft.com/mround-function).
          result.type = "e#NUM!";
        } else {
          // Round-half-away-from-zero with a small tolerance so a quotient
          // that is mathematically exactly .5 (e.g. 1.3/0.2) but lands just
          // under it in binary floating point (6.499999999999999) still
          // rounds up, matching MROUND(1.3,0.2)=1.4 from Microsoft's docs.
          // quotient = xval.value/yval.value is provably >= 0 here: the
          // sign-mismatch guard above already rejected every combination
          // where xval and yval have strictly opposite nonzero signs, so
          // same-sign (or zero-numerator) division can never yield a
          // negative quotient -- no separate negative-quotient branch
          // exists to keep, since it can never be taken.
          quotient = Math.floor(xval.value / yval.value + 0.5 + 1e-9);
          result.value = quotient * yval.value;
        }
        break;

      case "TRUNC":
        decimalscale = 1; // cut down to required number of decimal digits
        if (yval.value >= 0) {
          yval.value = Math.floor(yval.value);
          for (i = 0; i < yval.value; i++) {
            decimalscale *= 10;
          }
          result.value = Math.floor(Math.abs(xval.value) * decimalscale) / decimalscale;
        } else if (yval.value < 0) {
          yval.value = Math.floor(-yval.value);
          for (i = 0; i < yval.value; i++) {
            decimalscale *= 10;
          }
          result.value = Math.floor(Math.abs(xval.value) / decimalscale) * decimalscale;
        }
        if (xval.value < 0) {
          result.value = -result.value;
        }
    }
  }

  operand.push(result);

  return null;
};

// Add to function list
SocialCalc.Formula.FunctionList["ATAN2"] = [SocialCalc.Formula.Math2Functions, 2, "xy", "", "math"];
SocialCalc.Formula.FunctionList["MOD"] = [SocialCalc.Formula.Math2Functions, 2, "", "", "math"];
SocialCalc.Formula.FunctionList["POWER"] = [SocialCalc.Formula.Math2Functions, 2, "", "", "math"];
SocialCalc.Formula.FunctionList["TRUNC"] = [
  SocialCalc.Formula.Math2Functions,
  2,
  "valpre",
  "",
  "math",
];
SocialCalc.Formula.FunctionList["QUOTIENT"] = [
  SocialCalc.Formula.Math2Functions,
  2,
  "",
  "",
  "math",
];
SocialCalc.Formula.FunctionList["MROUND"] = [SocialCalc.Formula.Math2Functions, 2, "", "", "math"];

/*
#
# GCD(number1,[number2],...)
# LCM(number1,[number2],...)
#
# Both vendors: greatest common divisor / least common multiple of one or
# more non-negative integers (truncated if fractional). #VALUE! for
# non-numeric args, #NUM! for negative args or a magnitude >= 2^53
# (docs.microsoft.com/gcd-function, /lcm-function).
*/

/**
 * @param {string} fname
 * @param {SocialCalc.FormulaOperand[]} operand
 * @param {SocialCalc.FormulaOperand[]} foperand
 * @param {SocialCalc.Sheet} sheet
 */
FormulaMut.GcdLcmFunction = function (
  fname: string,
  operand: SocialCalc.FormulaOperand[],
  foperand: SocialCalc.FormulaOperand[],
  sheet: SocialCalc.Sheet,
) {
  var scf = SocialCalc.Formula;
  var PushOperand = function (t: SocialCalc.FormulaOperandType, v: unknown) {
    operand.push({ type: t, value: v });
  };

  var MAX_SAFE = 9007199254740992; // 2^53, per Microsoft docs' documented ceiling

  var gcdOf = function (a: number, b: number): number {
    while (b !== 0) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a;
  };

  var values: number[] = [];
  while (foperand.length > 0) {
    var v = scf.OperandAsNumber(sheet, foperand);
    if (v.type.charAt(0) != "n") {
      // Non-numeric coerces to e#VALUE! per OperandAsNumber; propagate that
      // exact error type rather than a generic one (matches CollectNumericValues
      // convention of preserving the first encountered error).
      PushOperand(v.type, 0);
      return;
    }
    var n = Math.trunc(v.value as number);
    if (n < 0 || Math.abs(n) >= MAX_SAFE) {
      PushOperand("e#NUM!", 0);
      return;
    }
    values.push(n);
  }
  if (!values.length) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  if (fname == "GCD") {
    var g = values[0]!;
    for (var i = 1; i < values.length; i++) g = gcdOf(g, values[i]!);
    PushOperand("n", g);
    return;
  }

  // LCM(a,b) = |a*b| / gcd(a,b); LCM with any 0 argument is 0 by convention.
  var l = values[0]!;
  for (var j = 1; j < values.length; j++) {
    var b2 = values[j]!;
    if (l == 0 || b2 == 0) {
      l = 0;
      continue;
    }
    var g2 = gcdOf(l, b2);
    l = (l / g2) * b2;
    if (l >= MAX_SAFE) {
      PushOperand("e#NUM!", 0);
      return;
    }
  }
  PushOperand("n", l);
  return;
};

SocialCalc.Formula.FunctionList["GCD"] = [SocialCalc.Formula.GcdLcmFunction, -1, "vn", "", "math"];
SocialCalc.Formula.FunctionList["LCM"] = [SocialCalc.Formula.GcdLcmFunction, -1, "vn", "", "math"];

/*
#
# LOG(value,[base])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.LogFunction = function (fname, operand, foperand, sheet) {
  var value, value2;
  var result: any = {};

  var scf = SocialCalc.Formula;

  result.value = 0;

  value = scf.OperandAsNumber(sheet, foperand);
  result.type = scf.LookupResultType(value.type, value.type, scf.TypeLookupTable.oneargnumeric);
  if (foperand.length == 1) {
    value2 = scf.OperandAsNumber(sheet, foperand);
    if (value2.type.charAt(0) != "n" || value2.value <= 0) {
      scf.FunctionSpecificError(
        fname,
        operand,
        "e#NUM!",
        SocialCalc.Constants.s_sheetfunclogsecondarg,
      );
      return 0;
    }
  } else if (foperand.length != 0) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  } else {
    value2 = { value: Math.E, type: "n" };
  }

  if (result.type == "n") {
    if (value.value <= 0) {
      scf.FunctionSpecificError(
        fname,
        operand,
        "e#NUM!",
        SocialCalc.Constants.s_sheetfunclogfirstarg,
      );
      return 0;
    }
    result.value = Math.log(value.value) / Math.log(value2.value);
  }

  operand.push(result);

  return;
};

SocialCalc.Formula.FunctionList["LOG"] = [SocialCalc.Formula.LogFunction, -1, "log", "", "math"];

/*
#
# ROUND(value,[precision])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.RoundFunction = function (fname, operand, foperand, sheet) {
  var value2, decimalscale, scaledvalue, i;

  var scf = SocialCalc.Formula;
  var result = 0;
  var resulttype = "e#VALUE!";

  var value = scf.OperandValueAndType(sheet, foperand);
  resulttype = scf.LookupResultType(value.type, value.type, scf.TypeLookupTable.oneargnumeric);

  if (foperand.length == 1) {
    value2 = scf.OperandValueAndType(sheet, foperand);
    if (value2.type.charAt(0) != "n") {
      scf.FunctionSpecificError(
        fname,
        operand,
        "e#NUM!",
        SocialCalc.Constants.s_sheetfuncroundsecondarg,
      );
      return 0;
    }
  } else if (foperand.length != 0) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  } else {
    value2 = { value: 0, type: "n" }; // if no second arg, assume 0 for simple round
  }

  if (resulttype == "n") {
    value2.value = value2.value - 0;
    if (fname == "ROUND") {
      // Unchanged from the original implementation, byte-for-byte: plain
      // Math.round (JS ties toward +Infinity, e.g. round(-0.5) === -0) and
      // the original divide-not-multiply-by-reciprocal arithmetic for the
      // negative-precision branch (avoids a differing float result from a
      // 1/decimalscale reciprocal multiply).
      if (value2.value == 0) {
        result = Math.round(value.value);
      } else if (value2.value > 0) {
        decimalscale = 1; // cut down to required number of decimal digits
        value2.value = Math.floor(value2.value);
        for (i = 0; i < value2.value; i++) {
          decimalscale *= 10;
        }
        scaledvalue = Math.round(value.value * decimalscale);
        result = scaledvalue / decimalscale;
      } else if (value2.value < 0) {
        decimalscale = 1; // cut down to required number of decimal digits
        value2.value = Math.floor(-value2.value);
        for (i = 0; i < value2.value; i++) {
          decimalscale *= 10;
        }
        scaledvalue = Math.round(value.value / decimalscale);
        result = scaledvalue * decimalscale;
      }
    } else {
      // ROUNDUP / ROUNDDOWN: same digit-count derivation as ROUND, always
      // multiplying the value up into the target scale (mirrors ROUND's
      // positive-precision branch arithmetic for both signs of precision,
      // since away-from-zero/toward-zero truncation is symmetric under a
      // sign flip of the scale exponent) then explicit sign-aware
      // ceil/floor with a small epsilon to survive binary floating-point
      // representation error at exact decimal boundaries (e.g.
      // ROUNDUP(2.5,0) must not fall short of 3 because 2.5*1 has no
      // error, but ROUNDUP(1.005,2) must not fall short of 1.01 because
      // 1.005*100 === 100.49999999999999 in IEEE 754 binary64).
      decimalscale = 1;
      if (value2.value > 0) {
        value2.value = Math.floor(value2.value);
        for (i = 0; i < value2.value; i++) decimalscale *= 10;
      } else if (value2.value < 0) {
        value2.value = Math.floor(-value2.value);
        for (i = 0; i < value2.value; i++) decimalscale *= 10;
        decimalscale = 1 / decimalscale;
      }
      var scaled = value.value * decimalscale;
      if (fname == "ROUNDUP") {
        scaledvalue = scaled >= 0 ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
      } else {
        // ROUNDDOWN: toward zero (truncate).
        scaledvalue = scaled >= 0 ? Math.floor(scaled + 1e-9) : Math.ceil(scaled - 1e-9);
      }
      result = scaledvalue / decimalscale;
    }
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["ROUND"] = [SocialCalc.Formula.RoundFunction, -1, "vp", "", "math"];
SocialCalc.Formula.FunctionList["ROUNDUP"] = [
  SocialCalc.Formula.RoundFunction,
  -1,
  "vp",
  "",
  "math",
];
SocialCalc.Formula.FunctionList["ROUNDDOWN"] = [
  SocialCalc.Formula.RoundFunction,
  -1,
  "vp",
  "",
  "math",
];

/*
#
# CEILING(value, [significance])
# FLOOR(value, [significance])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.CeilingFloorFunctions = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var val, sig, t;

  var PushOperand = function (t: any, v: any) {
    operand.push({ type: t, value: v });
  };

  val = scf.OperandValueAndType(sheet, foperand);
  t = val.type.charAt(0);
  if (t != "n") {
    PushOperand("e#VALUE!", 0);
    return;
  }
  if (val.value == 0) {
    PushOperand("n", 0);
    return;
  }

  if (foperand.length == 1) {
    sig = scf.OperandValueAndType(sheet, foperand);
    t = sig.type.charAt(0);
    if (t != "n") {
      PushOperand("e#VALUE!", 0);
      return;
    }
  } else if (foperand.length == 0) {
    sig = { type: "n", value: val.value > 0 ? 1 : -1 };
  } else {
    PushOperand("e#VALUE!", 0);
    return;
  }
  if (sig.value == 0) {
    PushOperand("n", 0);
    return;
  }
  if (sig.value * val.value < 0) {
    PushOperand("e#NUM!", 0);
    return;
  }

  switch (fname) {
    case "CEILING":
      PushOperand("n", Math.ceil(val.value / sig.value) * sig.value);
      break;
    case "FLOOR":
      PushOperand("n", Math.floor(val.value / sig.value) * sig.value);
      break;
  }

  return;
};

SocialCalc.Formula.FunctionList["CEILING"] = [
  SocialCalc.Formula.CeilingFloorFunctions,
  -1,
  "vsig",
  "",
  "math",
];
SocialCalc.Formula.FunctionList["FLOOR"] = [
  SocialCalc.Formula.CeilingFloorFunctions,
  -1,
  "vsig",
  "",
  "math",
];

/*
#
# AND(v1,c1:c2,...)
# OR(v1,c1:c2,...)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.AndOrFunctions = function (fname, operand, foperand, sheet) {
  var value1, result;

  var scf = SocialCalc.Formula;
  var resulttype = "";

  if (fname == "AND") {
    result = 1;
  } else if (fname == "OR") {
    result = 0;
  }

  while (foperand.length) {
    value1 = scf.OperandValueAndType(sheet, foperand);
    if (value1.type.charAt(0) == "n") {
      value1.value = value1.value - 0;
      if (fname == "AND") {
        result = value1.value != 0 ? result : 0;
      } else if (fname == "OR") {
        result = value1.value != 0 ? 1 : result;
      }
      resulttype = scf.LookupResultType(
        value1.type,
        resulttype || "nl",
        scf.TypeLookupTable.propagateerror,
      );
    } else if (value1.type.charAt(0) == "e" && resulttype.charAt(0) != "e") {
      resulttype = value1.type;
    }
  }
  if (resulttype.length < 1) {
    resulttype = "e#VALUE!";
    result = 0;
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["AND"] = [SocialCalc.Formula.AndOrFunctions, -1, "vn", "", "test"];
SocialCalc.Formula.FunctionList["OR"] = [SocialCalc.Formula.AndOrFunctions, -1, "vn", "", "test"];

/*
#
# NOT(value)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.NotFunction = function (fname, operand, foperand, sheet) {
  var result = 0;
  var scf = SocialCalc.Formula;
  var value = scf.OperandValueAndType(sheet, foperand);
  var resulttype = scf.LookupResultType(value.type, value.type, scf.TypeLookupTable.propagateerror);

  if (value.type.charAt(0) == "n" || value.type == "b") {
    result = value.value - 0 != 0 ? 0 : 1; // do the "not" operation
    resulttype = "nl";
  } else if (value.type.charAt(0) == "t") {
    resulttype = "e#VALUE!";
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["NOT"] = [SocialCalc.Formula.NotFunction, 1, "v", "", "test"];

/*
#
# CHOOSE(index,value1,value2,...)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.ChooseFunction = function (fname, operand, foperand, sheet) {
  var resulttype, count, value1;
  var result = 0;
  var scf = SocialCalc.Formula;

  var cindex = scf.OperandAsNumber(sheet, foperand);

  if (cindex.type.charAt(0) != "n") {
    cindex.value = 0;
  }
  cindex.value = Math.floor(cindex.value);

  count = 0;
  while (foperand.length) {
    value1 = scf.TopOfStackValueAndType(sheet, foperand);
    count += 1;
    if (cindex.value == count) {
      result = value1.value;
      resulttype = value1.type;
      break;
    }
  }
  if (resulttype) {
    // found something
    scf.PushOperand(operand, resulttype, result);
  } else {
    scf.PushOperand(operand, "e#VALUE!", 0);
  }

  return;
};

SocialCalc.Formula.FunctionList["CHOOSE"] = [
  SocialCalc.Formula.ChooseFunction,
  -2,
  "choose",
  "",
  "lookup",
];

/*
#
# COLUMNS(c1:c2)
# ROWS(c1:c2)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.ColumnsRowsFunctions = function (fname, operand, foperand, sheet) {
  var resulttype, rangeinfo;
  var result = 0;
  var scf = SocialCalc.Formula;

  var value1 = scf.TopOfStackValueAndType(sheet, foperand);

  if (value1.type == "coord") {
    result = 1;
    resulttype = "n";
  } else if (value1.type == "range") {
    rangeinfo = scf.DecodeRangeParts(sheet, value1.value);
    if (!rangeinfo) {
      result = 0;
      resulttype = "e#REF!";
    } else if (fname == "COLUMNS") {
      result = rangeinfo.ncols;
      resulttype = "n";
    } else if (fname == "ROWS") {
      result = rangeinfo.nrows;
      resulttype = "n";
    } else {
      result = 0;
      resulttype = "n";
    }
  } else {
    result = 0;
    resulttype = "e#VALUE!";
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["COLUMNS"] = [
  SocialCalc.Formula.ColumnsRowsFunctions,
  1,
  "range",
  "",
  "lookup",
];
SocialCalc.Formula.FunctionList["ROWS"] = [
  SocialCalc.Formula.ColumnsRowsFunctions,
  1,
  "range",
  "",
  "lookup",
];

/*
#
# INDIRECT(ref_text,[a1])
#
# Turns ref_text into an actual reference. a1 defaults to TRUE (A1-style).
# a1=FALSE would select R1C1-style references; the tokenizer/coord parser
# in this codebase has no R1C1 support (formula-parse.ts only recognizes
# /^\$?[A-Z]{1,2}\$?[1-9]\d*$/i coords), so a1=FALSE always yields #REF!.
# Accepts: A1, $A$1, A1:B2, Sheet1!A1, Sheet1!A1:B2, 'My Sheet'!A1, and
# defined names (coord/range/formula-defined) via LookupName. Invalid text,
# unknown sheets, and out-of-bounds columns/rows (>ZZ / >65536) yield #REF!.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.IndirectFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  sheet.hasDynamicRef = true; // conservative: force one extra recalc pass this cycle

  var reftext = scf.OperandAsText(sheet, foperand);
  if (reftext.type.charAt(0) == "e") {
    scf.PushOperand(operand, reftext.type, 0);
    return;
  }

  var a1style = true;
  if (foperand.length) {
    var a1operand = scf.OperandAsNumber(sheet, foperand);
    if (a1operand.type.charAt(0) == "e") {
      scf.PushOperand(operand, a1operand.type, 0);
      return;
    }
    a1style = a1operand.value !== 0;
  }

  if (!a1style) {
    // R1C1-style references are not supported by the parser/tokenizer.
    scf.PushOperand(operand, "e#REF!", 0);
    return;
  }

  var text = ("" + reftext.value).trim();
  if (!text) {
    scf.PushOperand(operand, "e#REF!", 0);
    return;
  }

  var sheetname = "";
  var body = text;
  var bangpos = text.lastIndexOf("!");
  if (bangpos != -1) {
    sheetname = text.substring(0, bangpos);
    if (
      sheetname.length >= 2 &&
      sheetname.charAt(0) == "'" &&
      sheetname.charAt(sheetname.length - 1) == "'"
    ) {
      sheetname = sheetname.substring(1, sheetname.length - 1).replace(/''/g, "'");
    }
    body = text.substring(bangpos + 1);
  }

  var targetsheet: typeof sheet | null = sheet;
  if (sheetname) {
    targetsheet = scf.FindInSheetCache(sheetname);
    if (targetsheet == null) {
      scf.PushOperand(operand, "e#REF!", SocialCalc.Constants.s_sheetunavailable + " " + sheetname);
      return;
    }
  }

  var coordregex = /^\$?[A-Z]{1,2}\$?[1-9]\d*$/i;
  var rangeparts = body.split(":");

  // coordregex (above) already guarantees col in [1,702] and row >= 1 for
  // anything reaching this point, so only the row-overflow edge is live.
  var pushCoordOrRange = function (c1: string, c2: string | null) {
    var cr1 = SocialCalc.coordToCr(c1.replace(/\$/g, ""));
    if (cr1.row > 65536) {
      scf.PushOperand(operand, "e#REF!", 0);
      return;
    }
    var suffix = sheetname ? "!" + sheetname : "";
    if (c2 == null) {
      scf.PushOperand(operand, "coord", c1.toUpperCase().replace(/\$/g, "") + suffix);
    } else {
      var cr2 = SocialCalc.coordToCr(c2.replace(/\$/g, ""));
      if (cr2.row > 65536) {
        scf.PushOperand(operand, "e#REF!", 0);
        return;
      }
      scf.PushOperand(
        operand,
        "range",
        c1.toUpperCase().replace(/\$/g, "") +
          suffix +
          "|" +
          c2.toUpperCase().replace(/\$/g, "") +
          "|",
      );
    }
  };

  if (
    rangeparts.length == 2 &&
    coordregex.test(rangeparts[0]!) &&
    coordregex.test(rangeparts[1]!)
  ) {
    pushCoordOrRange(rangeparts[0]!, rangeparts[1]!);
    return;
  }
  if (rangeparts.length == 1 && coordregex.test(body)) {
    pushCoordOrRange(body, null);
    return;
  }

  // Not a direct coord/range: try a defined name on the target sheet.
  var nvalue = scf.LookupName(targetsheet, body.toUpperCase());
  if (nvalue.type == "coord" || nvalue.type == "range") {
    if (sheetname && (nvalue.value as string).indexOf("!") == -1) {
      if (nvalue.type == "coord") {
        nvalue.value = (nvalue.value as string) + "!" + sheetname;
      } else {
        var rv = nvalue.value as string;
        var rpos = rv.indexOf("|");
        nvalue.value = rv.substring(0, rpos) + "!" + sheetname + "|" + rv.substring(rpos + 1);
      }
    }
    scf.PushOperand(operand, nvalue.type, nvalue.value);
    return;
  }

  scf.PushOperand(operand, "e#REF!", 0);
};

SocialCalc.Formula.FunctionList["INDIRECT"] = [
  SocialCalc.Formula.IndirectFunction,
  -1,
  "indirect",
  "",
  "lookup",
];

/*
#
# OFFSET(reference,rows,cols,[height],[width])
#
# Returns a reference offset from `reference` by rows/cols (may be negative),
# resized to height/width (omitted -> inherit reference's own extent;
# explicit 0 -> #REF!). Any edge landing outside col A..ZZ (1..702) or
# row 1..65536 is a #REF! overflow. Preserves the reference's own sheet
# qualifier, if any.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.OffsetFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  sheet.hasDynamicRef = true; // conservative: force one extra recalc pass this cycle

  var refoperand = scf.TopOfStackValueAndType(sheet, foperand);
  var sheetname = "";
  var refvalue = refoperand.value;
  var reftype = refoperand.type;

  if (reftype != "coord" && reftype != "range") {
    scf.PushOperand(operand, "e#REF!", 0);
    return;
  }

  var anchorCol: number, anchorRow: number, refRows: number, refCols: number;

  if (reftype == "coord") {
    var coordtext = refvalue as string;
    var bangpos = coordtext.indexOf("!");
    if (bangpos != -1) {
      sheetname = coordtext.substring(bangpos + 1);
      coordtext = coordtext.substring(0, bangpos);
    }
    var cr = SocialCalc.coordToCr(coordtext);
    anchorCol = cr.col;
    anchorRow = cr.row;
    refRows = 1;
    refCols = 1;
  } else {
    var rangeinfo = scf.DecodeRangeParts(sheet, refvalue as string);
    if (!rangeinfo) {
      scf.PushOperand(operand, "e#REF!", 0);
      return;
    }
    sheetname = rangeinfo.sheetname;
    anchorCol = rangeinfo.col1num;
    anchorRow = rangeinfo.row1num;
    refRows = rangeinfo.nrows;
    refCols = rangeinfo.ncols;
  }

  var rowsoperand = scf.OperandAsNumber(sheet, foperand);
  if (rowsoperand.type.charAt(0) == "e") {
    scf.PushOperand(operand, rowsoperand.type, 0);
    return;
  }
  var colsoperand = scf.OperandAsNumber(sheet, foperand);
  if (colsoperand.type.charAt(0) == "e") {
    scf.PushOperand(operand, colsoperand.type, 0);
    return;
  }

  var height: number | undefined;
  var width: number | undefined;

  if (foperand.length) {
    var heightoperand = scf.OperandAsNumber(sheet, foperand);
    if (heightoperand.type.charAt(0) == "e") {
      scf.PushOperand(operand, heightoperand.type, 0);
      return;
    }
    height = heightoperand.value as number;

    if (foperand.length) {
      var widthoperand = scf.OperandAsNumber(sheet, foperand);
      if (widthoperand.type.charAt(0) == "e") {
        scf.PushOperand(operand, widthoperand.type, 0);
        return;
      }
      width = widthoperand.value as number;
    }
  }

  var rect = SocialCalc.OffsetRectangle(
    anchorCol,
    anchorRow,
    refRows,
    refCols,
    rowsoperand.value as number,
    colsoperand.value as number,
    height,
    width,
  );

  if (!rect.ok) {
    scf.PushOperand(operand, "e#REF!", 0);
    return;
  }

  var suffix = sheetname ? "!" + sheetname : "";
  if (rect.col1 == rect.col2 && rect.row1 == rect.row2) {
    scf.PushOperand(operand, "coord", SocialCalc.crToCoord(rect.col1, rect.row1) + suffix);
  } else {
    scf.PushOperand(
      operand,
      "range",
      SocialCalc.crToCoord(rect.col1, rect.row1) +
        suffix +
        "|" +
        SocialCalc.crToCoord(rect.col2, rect.row2) +
        "|",
    );
  }
};

SocialCalc.Formula.FunctionList["OFFSET"] = [
  SocialCalc.Formula.OffsetFunction,
  -3,
  "offset",
  "",
  "lookup",
];

/*
#
# ROW([reference])
# COLUMN([reference])
#
# With no argument, returns the row/column of the cell containing the
# formula (the coord passed through CalculateFunction). With a reference
# argument (a bare coord or a range), returns the row/column of the
# top-left corner of that reference without resolving it to a cell value
# -- the typed "coord"/"range" operand is inspected directly via
# TopOfStackValueAndType, matching the "preserve typed reference before
# coercion" contract used by ROWS/COLUMNS above. A non-reference argument
# (number, text, etc.) is #VALUE!, matching Excel.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 * @param {string} [coord]
 */
FormulaMut.RowColumnFunctions = function (fname, operand, foperand, sheet, coord) {
  var scf = SocialCalc.Formula;
  var result = 0;
  var resulttype = "n";

  if (foperand.length > 1) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  if (foperand.length === 0) {
    if (!coord) {
      scf.PushOperand(operand, "e#REF!", 0);
      return;
    }
    var here = SocialCalc.coordToCr(SocialCalc.Formula.PlainCoord(coord));
    result = fname == "ROW" ? here.row : here.col;
    scf.PushOperand(operand, resulttype, result);
    return;
  }

  var value1 = scf.TopOfStackValueAndType(sheet, foperand);

  if (value1.type.charAt(0) == "e") {
    scf.PushOperand(operand, value1.type, 0);
    return;
  }

  if (value1.type == "coord") {
    var coordtext = value1.value as string;
    var bang = coordtext.indexOf("!");
    if (bang != -1) coordtext = coordtext.substring(0, bang);
    var cr = SocialCalc.coordToCr(SocialCalc.Formula.PlainCoord(coordtext));
    result = fname == "ROW" ? cr.row : cr.col;
  } else if (value1.type == "range") {
    var rangeinfo = scf.DecodeRangeParts(sheet, value1.value as string);
    if (!rangeinfo) {
      scf.PushOperand(operand, "e#REF!", 0);
      return;
    }
    result = fname == "ROW" ? rangeinfo.row1num : rangeinfo.col1num;
  } else {
    scf.PushOperand(operand, "e#VALUE!", 0);
    return;
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["ROW"] = [
  SocialCalc.Formula.RowColumnFunctions,
  100,
  "refopt",
  "",
  "lookup",
];
SocialCalc.Formula.FunctionList["COLUMN"] = [
  SocialCalc.Formula.RowColumnFunctions,
  100,
  "refopt",
  "",
  "lookup",
];

/*
#
# ADDRESS(row_num, column_num, [abs_num], [a1], [sheet_text])
#
# Builds an A1- or R1C1-style reference string. abs_num: 1 = absolute
# row+col (default), 2 = absolute row/relative col, 3 = relative
# row/absolute col, 4 = relative both. a1 (default TRUE): FALSE selects
# R1C1 notation. sheet_text, if present, is prefixed with "!", quoted with
# single quotes when it is not a bare identifier (matching the sheet-name
# quoting SocialCalc.OperandAsSheetName / formula-ref sheet-quoting use
# elsewhere). row_num/column_num are truncated toward zero (Excel
# behavior); this engine's max column is ZZ (702, see AGENTS.md formula-
# reference-compatibility policy) and max row is 65536 -- out-of-range or
# non-positive coordinates are #VALUE!, matching Excel's ADDRESS contract.
#
*/
/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.AddressFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var rownumv = scf.OperandAsNumber(sheet, foperand);
  var colnumv = scf.OperandAsNumber(sheet, foperand);
  if (rownumv.type.charAt(0) == "e") {
    scf.PushOperand(operand, rownumv.type, 0);
    return;
  }
  if (colnumv.type.charAt(0) == "e") {
    scf.PushOperand(operand, colnumv.type, 0);
    return;
  }

  var absnum = 1;
  if (foperand.length) {
    var absnumv = scf.OperandAsNumber(sheet, foperand);
    if (absnumv.type.charAt(0) == "e") {
      scf.PushOperand(operand, absnumv.type, 0);
      return;
    }
    absnum = Math.floor(absnumv.value as number);
    if (absnum < 1 || absnum > 4) {
      scf.PushOperand(operand, "e#VALUE!", 0);
      return;
    }
  }

  var a1style = true;
  if (foperand.length) {
    var a1v = scf.OperandValueAndType(sheet, foperand);
    if (a1v.type.charAt(0) == "e") {
      scf.PushOperand(operand, a1v.type, 0);
      return;
    }
    a1style = a1v.type == "b" ? true : Boolean(a1v.value);
  }

  var sheettext = "";
  if (foperand.length) {
    var sheetv = scf.OperandAsText(sheet, foperand);
    if (sheetv.type.charAt(0) == "e") {
      scf.PushOperand(operand, sheetv.type, 0);
      return;
    }
    sheettext = sheetv.value as string;
  }

  if (foperand.length) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  var rownum = Math.trunc(rownumv.value as number);
  var colnum = Math.trunc(colnumv.value as number);

  if (rownum < 1 || rownum > 65536 || colnum < 1 || colnum > 702) {
    scf.PushOperand(operand, "e#VALUE!", 0);
    return;
  }

  var colname = SocialCalc.rcColname(colnum);
  var absrow = absnum == 1 || absnum == 2;
  var abscol = absnum == 1 || absnum == 3;

  var result;
  if (a1style) {
    result = (abscol ? "$" : "") + colname + (absrow ? "$" : "") + rownum;
  } else {
    result = "R" + (absrow ? String(rownum) : "[" + rownum + "]");
    result += "C" + (abscol ? String(colnum) : "[" + colnum + "]");
  }

  if (sheettext) {
    var quoted = !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheettext)
      ? "'" + sheettext.replace(/'/g, "''") + "'"
      : sheettext;
    result = quoted + "!" + result;
  }

  scf.PushOperand(operand, "t", result);

  return;
};

SocialCalc.Formula.FunctionList["ADDRESS"] = [
  SocialCalc.Formula.AddressFunction,
  -2,
  "address",
  "",
  "lookup",
];

/*
#
# HYPERLINK(link_location, [friendly_name])
#
# Returns friendly_name (or link_location if omitted) as the displayed
# cell text, tagged with the "l" value-subtype so rendering routes
# through the already-audited SocialCalc.expand_text_link /
# SocialCalc.SafeUrlForRender text-link path (see docs/security-sink-
# inventory.md, "format_text_for_display 'text-link'" row) instead of a
# new HTML sink. Excel does not validate the scheme at formula-evaluation
# time -- it is the render-time SafeUrlForRender allowlist (consulted only
# when SocialCalc.Callbacks.untrustedContent is true) that rejects
# javascript:/unsafe schemes, exactly like a manually authored [desc]<url>
# cell link.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.HyperlinkFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var linklocv = scf.OperandAsText(sheet, foperand);
  if (linklocv.type.charAt(0) == "e") {
    scf.PushOperand(operand, linklocv.type, 0);
    return;
  }
  var linkloc = linklocv.value as string;

  var friendly = linkloc;
  if (foperand.length) {
    var friendlyv = scf.OperandAsText(sheet, foperand);
    if (friendlyv.type.charAt(0) == "e") {
      scf.PushOperand(operand, friendlyv.type, 0);
      return;
    }
    friendly = friendlyv.value as string;
  }

  if (foperand.length) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  // Reuse the manual cell-link text syntax (desc<url>) so the existing
  // ParseCellLinkText / expand_text_link pipeline renders it identically
  // to a hand-authored link.
  var linktext = friendly + "<" + linkloc + ">";

  scf.PushOperand(operand, "tl", linktext);

  return;
};

SocialCalc.Formula.FunctionList["HYPERLINK"] = [
  SocialCalc.Formula.HyperlinkFunction,
  -1,
  "hyperlink",
  "",
  "lookup",
];

/*
#
# IMAGE(url, [mode], [height], [width])
#
# Returns url tagged with the "m" value-subtype, which format_text_for_
# display maps to "text-image" -- the already-audited SocialCalc.
# SafeUrlForRender <img src> path (docs/security-sink-inventory.md,
# "format_text_for_display 'text-image'" row); never a new raw-HTML sink.
#
# The text-image renderer emits a bare <img src="..."> with no explicit
# width/height styling, which is Google Sheets IMAGE mode 3 (original
# size), not mode 1 (fit-to-cell) or mode 2 (stretch-to-fit) -- this
# renderer has no per-formula sizing hook to honestly deliver either of
# those. Mode 3 is therefore the only accepted mode (and the default when
# mode is omitted, deliberately diverging from Sheets' mode-1 default so
# omitting mode never silently claims a fit-to-cell contract that is not
# delivered); modes 1, 2, and 4 (custom height/width, which only has
# meaning under mode 4) are rejected with #VALUE! rather than silently
# ignored, per the "reject unsupported modes, no fake behavior" contract.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.ImageFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var urlv = scf.OperandAsText(sheet, foperand);
  if (urlv.type.charAt(0) == "e") {
    scf.PushOperand(operand, urlv.type, 0);
    return;
  }

  if (foperand.length) {
    var modev = scf.OperandAsNumber(sheet, foperand);
    if (modev.type.charAt(0) == "e") {
      scf.PushOperand(operand, modev.type, 0);
      return;
    }
    if (Math.floor(modev.value as number) != 3) {
      // modes 1 (fit cell), 2 (stretch), and 4 (custom height/width) all
      // require rendering behavior this renderer does not implement.
      scf.PushOperand(operand, "e#VALUE!", 0);
      return;
    }
  }

  if (foperand.length) {
    // height/width only have meaning with mode 4, which is rejected above.
    scf.PushOperand(operand, "e#VALUE!", 0);
    return;
  }

  scf.PushOperand(operand, "tm", urlv.value as string);

  return;
};

SocialCalc.Formula.FunctionList["IMAGE"] = [
  SocialCalc.Formula.ImageFunction,
  -1,
  "image",
  "",
  "lookup",
];

/*
#
# FALSE()
# NA()
# NOW()
# PI()
# TODAY()
# TRUE()
# RAND()
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} _foperand
 * @param {any} _sheet
 */
FormulaMut.ZeroArgFunctions = function (fname, operand, _foperand, _sheet) {
  var startval, tzoffset, start_1_1_1970, seconds_in_a_day, nowdays;
  var result: { type: string; value: any } = { value: 0, type: "" };

  switch (fname) {
    case "FALSE":
      result.type = "nl";
      result.value = 0;
      break;

    case "NA":
      result.type = "e#N/A";
      break;

    case "NOW":
      startval = new Date();
      tzoffset = startval.getTimezoneOffset();
      startval = startval.getTime() / 1000; // convert to seconds
      start_1_1_1970 = 25569; // Day number of 1/1/1970 starting with 1/1/1900 as 1
      seconds_in_a_day = 24 * 60 * 60;
      nowdays = start_1_1_1970 + startval / seconds_in_a_day - tzoffset / (24 * 60);
      result.value = nowdays;
      result.type = "ndt";
      SocialCalc.Formula.FreshnessInfo.volatile.NOW = true; // remember
      break;

    case "PI":
      result.type = "n";
      result.value = Math.PI;
      break;

    case "TODAY":
      startval = new Date();
      tzoffset = startval.getTimezoneOffset();
      startval = startval.getTime() / 1000; // convert to seconds
      start_1_1_1970 = 25569; // Day number of 1/1/1970 starting with 1/1/1900 as 1
      seconds_in_a_day = 24 * 60 * 60;
      nowdays = start_1_1_1970 + startval / seconds_in_a_day - tzoffset / (24 * 60);
      result.value = Math.floor(nowdays);
      result.type = "nd";
      SocialCalc.Formula.FreshnessInfo.volatile.TODAY = true; // remember
      break;

    case "TRUE":
      result.type = "nl";
      result.value = 1;
      break;

    case "RAND":
      result.type = "n";
      result.value = Math.random();
      SocialCalc.Formula.FreshnessInfo.volatile.RAND = true; // remember
      break;
  }

  operand.push(result);

  return null;
};

// Add to function list
SocialCalc.Formula.FunctionList["FALSE"] = [SocialCalc.Formula.ZeroArgFunctions, 0, "", "", "test"];
SocialCalc.Formula.FunctionList["NA"] = [SocialCalc.Formula.ZeroArgFunctions, 0, "", "", "test"];
SocialCalc.Formula.FunctionList["NOW"] = [
  SocialCalc.Formula.ZeroArgFunctions,
  0,
  "",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["RAND"] = [SocialCalc.Formula.ZeroArgFunctions, 0, "", "", "math"];
SocialCalc.Formula.FunctionList["PI"] = [SocialCalc.Formula.ZeroArgFunctions, 0, "", "", "math"];
SocialCalc.Formula.FunctionList["TODAY"] = [
  SocialCalc.Formula.ZeroArgFunctions,
  0,
  "",
  "",
  "datetime",
];
SocialCalc.Formula.FunctionList["TRUE"] = [SocialCalc.Formula.ZeroArgFunctions, 0, "", "", "test"];

/*
#
# TEXT(value, format_text)
#
# Formats value using format_text and returns the result as plain text.
# Reuses the existing SocialCalc.FormatNumber.formatNumberWithFormat /
# formatTextWithFormat engine (the same code format_number_for_display /
# format_text_for_display use for cell display) rather than a parallel
# format grammar -- this function only adapts that engine's HTML-flavored
# output (space runs as "&nbsp;", optional "<span style=...>" color/style
# wrapper) back to the plain data value TEXT must return.
#
# format_text == "" is treated as "General" (matches
# SocialCalc.format_number_for_display's own "" => General convention).
# A format containing an unmatched "[" (outside quotes) is rejected as
# malformed rather than silently swallowing the rest of the string, which
# is what SocialCalc.FormatNumber.parse_format_string would otherwise do.
# A numeric value with an unquoted "@" placeholder, or a text value with
# an unquoted numeric/date placeholder, is #VALUE! -- matching Excel,
# which treats TEXT's numeric and text format grammars as mutually
# exclusive per call.
#
*/

/**
 * @param {string} format
 * @param {string} ch
 */
FormulaMut.TextFormatHasUnquotedChar = function (format: string, ch: string): boolean {
  var inquote = false;
  var inbracket = false;
  for (var i = 0; i < format.length; i++) {
    var c = format.charAt(i);
    if (inquote) {
      if (c == '"') inquote = false;
      continue;
    }
    if (inbracket) {
      if (c == "]") inbracket = false;
      continue;
    }
    if (c == '"') {
      inquote = true;
      continue;
    }
    if (c == "[") {
      inbracket = true;
      continue;
    }
    if (c == ch) return true;
  }
  return false;
};

/** @param {string} format */
FormulaMut.TextFormatHasUnmatchedBracket = function (format: string): boolean {
  var inquote = false;
  var inbracket = false;
  for (var i = 0; i < format.length; i++) {
    var c = format.charAt(i);
    if (inquote) {
      if (c == '"') inquote = false;
      continue;
    }
    if (inbracket) {
      if (c == "]") inbracket = false;
      continue;
    }
    if (c == '"') {
      inquote = true;
    } else if (c == "[") {
      inbracket = true;
    }
  }
  return inbracket;
};

/** @param {string} html */
FormulaMut.TextFormatToPlainText = function (html: string): string {
  return html.replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, "");
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.TextFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var scfn = SocialCalc.FormatNumber;

  var value = scf.OperandValueAndType(sheet, foperand);
  if (value.type.charAt(0) == "e") {
    scf.PushOperand(operand, value.type, 0);
    return;
  }

  var formatv = scf.OperandAsText(sheet, foperand);
  if (formatv.type.charAt(0) == "e") {
    scf.PushOperand(operand, formatv.type, 0);
    return;
  }

  var format = (formatv.value as string) || "General";

  if (scf.TextFormatHasUnmatchedBracket(format)) {
    scf.PushOperand(operand, "e#VALUE!", 0);
    return;
  }

  var t = value.type.charAt(0);
  var isText = t == "t";
  var isBlank = t == "b";
  var isTextFormat = scf.TextFormatHasUnquotedChar(format, "@") && format != "General";

  if (isText || (isBlank && isTextFormat)) {
    if (!isTextFormat && !isBlank) {
      // a text value formatted with a numeric/date grammar is #VALUE!
      scfn.parse_format_string(scfn.format_definitions, format);
      var textformatdef = scfn.format_definitions[format];
      var hasNumericOp = textformatdef.operators.some(function (op: number) {
        return (
          op == scfn.commands.integer_placeholder ||
          op == scfn.commands.fraction_placeholder ||
          op == scfn.commands.decimal ||
          op == scfn.commands.currency ||
          op == scfn.commands.general ||
          op == scfn.commands.date
        );
      });
      if (hasNumericOp) {
        scf.PushOperand(operand, "e#VALUE!", 0);
        return;
      }
    }
    var textresult = scfn.formatTextWithFormat(isBlank ? "" : (value.value as string), format);
    scf.PushOperand(operand, "t", scf.TextFormatToPlainText(textresult));
    return;
  }

  if (scf.TextFormatHasUnquotedChar(format, "@")) {
    scf.PushOperand(operand, "e#VALUE!", 0);
    return;
  }

  var numresult = scfn.formatNumberWithFormat(isBlank ? 0 : (value.value as number), format, "");
  scf.PushOperand(operand, "t", scf.TextFormatToPlainText(numresult));

  return;
};

SocialCalc.Formula.FunctionList["TEXT"] = [SocialCalc.Formula.TextFunction, 2, "text", "", "text"];

//
// * * * * * FINANCIAL FUNCTIONS * * * * *
//

/*
#
# DDB(cost,salvage,lifetime,period,[method])
#
# Depreciation, method defaults to 2 for double-declining balance
# See: http://en.wikipedia.org/wiki/Depreciation
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.DDBFunction = function (fname, operand, foperand, sheet) {
  var method, depreciation, accumulateddepreciation, i;
  var scf = SocialCalc.Formula;

  var cost = scf.OperandAsNumber(sheet, foperand);
  var salvage = scf.OperandAsNumber(sheet, foperand);
  var lifetime = scf.OperandAsNumber(sheet, foperand);
  var period = scf.OperandAsNumber(sheet, foperand);

  if (scf.CheckForErrorValue(operand, cost)) return;
  if (scf.CheckForErrorValue(operand, salvage)) return;
  if (scf.CheckForErrorValue(operand, lifetime)) return;
  if (scf.CheckForErrorValue(operand, period)) return;

  if (lifetime.value < 1) {
    scf.FunctionSpecificError(fname, operand, "e#NUM!", SocialCalc.Constants.s_sheetfuncddblife);
    return 0;
  }

  method = { value: 2, type: "n" };
  if (foperand.length > 0) {
    method = scf.OperandAsNumber(sheet, foperand);
  }
  if (foperand.length != 0) {
    scf.FunctionArgsError(fname, operand);
    return 0;
  }
  if (scf.CheckForErrorValue(operand, method)) return;

  depreciation = 0; // calculated for each period
  accumulateddepreciation = 0; // accumulated by adding each period's

  for (i = 1; i <= period.value - 0 && i <= lifetime.value; i++) {
    // calculate for each period based on net from previous
    depreciation = (cost.value - accumulateddepreciation) * (method.value / lifetime.value);
    if (cost.value - accumulateddepreciation - depreciation < salvage.value) {
      // don't go lower than salvage value
      depreciation = cost.value - accumulateddepreciation - salvage.value;
    }
    accumulateddepreciation += depreciation;
  }

  scf.PushOperand(operand, "n$", depreciation);

  return;
};

SocialCalc.Formula.FunctionList["DDB"] = [
  SocialCalc.Formula.DDBFunction,
  -4,
  "ddb",
  "",
  "financial",
];

/*
#
# SLN(cost,salvage,lifetime)
#
# Depreciation for each period by straight-line method
# See: http://en.wikipedia.org/wiki/Depreciation
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SLNFunction = function (fname, operand, foperand, sheet) {
  var depreciation;
  var scf = SocialCalc.Formula;

  var cost = scf.OperandAsNumber(sheet, foperand);
  var salvage = scf.OperandAsNumber(sheet, foperand);
  var lifetime = scf.OperandAsNumber(sheet, foperand);

  if (scf.CheckForErrorValue(operand, cost)) return;
  if (scf.CheckForErrorValue(operand, salvage)) return;
  if (scf.CheckForErrorValue(operand, lifetime)) return;

  if (lifetime.value < 1) {
    scf.FunctionSpecificError(fname, operand, "e#NUM!", SocialCalc.Constants.s_sheetfuncslnlife);
    return 0;
  }

  depreciation = (cost.value - salvage.value) / lifetime.value;

  scf.PushOperand(operand, "n$", depreciation);

  return;
};

SocialCalc.Formula.FunctionList["SLN"] = [
  SocialCalc.Formula.SLNFunction,
  3,
  "csl",
  "",
  "financial",
];

/*
#
# SYD(cost,salvage,lifetime,period)
#
# Depreciation by Sum of Year's Digits method
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SYDFunction = function (fname, operand, foperand, sheet) {
  var depreciation, sumperiods;
  var scf = SocialCalc.Formula;

  var cost = scf.OperandAsNumber(sheet, foperand);
  var salvage = scf.OperandAsNumber(sheet, foperand);
  var lifetime = scf.OperandAsNumber(sheet, foperand);
  var period = scf.OperandAsNumber(sheet, foperand);

  if (scf.CheckForErrorValue(operand, cost)) return;
  if (scf.CheckForErrorValue(operand, salvage)) return;
  if (scf.CheckForErrorValue(operand, lifetime)) return;
  if (scf.CheckForErrorValue(operand, period)) return;

  if (lifetime.value < 1 || period.value <= 0) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return 0;
  }

  sumperiods = ((lifetime.value + 1) * lifetime.value) / 2; // add up 1 through lifetime
  depreciation = ((cost.value - salvage.value) * (lifetime.value - period.value + 1)) / sumperiods; // calc depreciation

  scf.PushOperand(operand, "n$", depreciation);

  return;
};

SocialCalc.Formula.FunctionList["SYD"] = [
  SocialCalc.Formula.SYDFunction,
  4,
  "cslp",
  "",
  "financial",
];

/*
#
# FV(rate, n, payment, [pv, [paytype]])
# NPER(rate, payment, pv, [fv, [paytype]])
# PMT(rate, n, pv, [fv, [paytype]])
# PV(rate, n, payment, [fv, [paytype]])
# RATE(n, payment, pv, [fv, [paytype, [guess]]])
#
# Following the Open Document Format formula specification:
#
#    PV = - Fv - (Payment * Nper) [if rate equals 0]
#    Pv*(1+Rate)^Nper + Payment * (1 + Rate*PaymentType) * ( (1+Rate)^nper -1)/Rate + Fv = 0
#
# For each function, the formulas are solved for the appropriate value (transformed using
# basic algebra).
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.InterestFunctions = function (fname, operand, foperand, sheet) {
  var resulttype, result, dval, eval_, fval;
  var pv, fv, rate, n, payment, paytype, guess, part1, part2, part3, part4, part5;
  var olddelta, maxloop, tries, delta, epsilon, oldrate, m;

  var scf = SocialCalc.Formula;

  var aval = scf.OperandAsNumber(sheet, foperand);
  var bval = scf.OperandAsNumber(sheet, foperand);
  var cval = scf.OperandAsNumber(sheet, foperand);

  resulttype = scf.LookupResultType(aval.type, bval.type, scf.TypeLookupTable.twoargnumeric);
  resulttype = scf.LookupResultType(resulttype, cval.type, scf.TypeLookupTable.twoargnumeric);
  if (foperand.length) {
    // optional arguments
    dval = scf.OperandAsNumber(sheet, foperand);
    resulttype = scf.LookupResultType(resulttype, dval.type, scf.TypeLookupTable.twoargnumeric);
    if (foperand.length) {
      // optional arguments
      eval_ = scf.OperandAsNumber(sheet, foperand);
      resulttype = scf.LookupResultType(resulttype, eval_.type, scf.TypeLookupTable.twoargnumeric);
      if (foperand.length) {
        // optional arguments
        if (fname != "RATE") {
          // only rate has 6 possible args
          scf.FunctionArgsError(fname, operand);
          return 0;
        }
        fval = scf.OperandAsNumber(sheet, foperand);
        resulttype = scf.LookupResultType(resulttype, fval.type, scf.TypeLookupTable.twoargnumeric);
      }
    }
  }

  if (resulttype == "n") {
    switch (fname) {
      case "FV": // FV(rate, n, payment, [pv, [paytype]])
        rate = aval.value;
        n = bval.value;
        payment = cval.value;
        pv = dval != null ? dval.value : 0; // get value if present, or use default
        paytype = eval_ != null ? (eval_.value ? 1 : 0) : 0;
        if (rate == 0) {
          // simple calculation if no interest
          fv = -pv - payment * n;
        } else {
          fv = -(
            pv * Math.pow(1 + rate, n) +
            (payment * (1 + rate * paytype) * (Math.pow(1 + rate, n) - 1)) / rate
          );
        }
        result = fv;
        resulttype = "n$";
        break;

      case "NPER": // NPER(rate, payment, pv, [fv, [paytype]])
        rate = aval.value;
        payment = bval.value;
        pv = cval.value;
        fv = dval != null ? dval.value : 0;
        paytype = eval_ != null ? (eval_.value ? 1 : 0) : 0;
        if (rate == 0) {
          // simple calculation if no interest
          if (payment == 0) {
            scf.PushOperand(operand, "e#NUM!", 0);
            return;
          }
          n = (pv + fv) / -payment;
        } else {
          part1 = (payment * (1 + rate * paytype)) / rate;
          part2 = pv + part1;
          if (part2 == 0 || rate <= -1) {
            scf.PushOperand(operand, "e#NUM!", 0);
            return;
          }
          part3 = (part1 - fv) / part2;
          if (part3 <= 0) {
            scf.PushOperand(operand, "e#NUM!", 0);
            return;
          }
          part4 = Math.log(part3);
          part5 = Math.log(1 + rate); // rate > -1
          n = part4 / part5;
        }
        result = n;
        resulttype = "n";
        break;

      case "PMT": // PMT(rate, n, pv, [fv, [paytype]])
        rate = aval.value;
        n = bval.value;
        pv = cval.value;
        fv = dval != null ? dval.value : 0;
        paytype = eval_ != null ? (eval_.value ? 1 : 0) : 0;
        if (n == 0) {
          scf.PushOperand(operand, "e#NUM!", 0);
          return;
        } else if (rate == 0) {
          // simple calculation if no interest
          payment = (fv - pv) / n;
        } else {
          payment =
            (0 - fv - pv * Math.pow(1 + rate, n)) /
            (((1 + rate * paytype) * (Math.pow(1 + rate, n) - 1)) / rate);
        }
        result = payment;
        resulttype = "n$";
        break;

      case "PV": // PV(rate, n, payment, [fv, [paytype]])
        rate = aval.value;
        n = bval.value;
        payment = cval.value;
        fv = dval != null ? dval.value : 0;
        paytype = eval_ != null ? (eval_.value ? 1 : 0) : 0;
        if (rate == -1) {
          scf.PushOperand(operand, "e#DIV/0!", 0);
          return;
        } else if (rate == 0) {
          // simple calculation if no interest
          pv = -fv - payment * n;
        } else {
          pv =
            (-fv - (payment * (1 + rate * paytype) * (Math.pow(1 + rate, n) - 1)) / rate) /
            Math.pow(1 + rate, n);
        }
        result = pv;
        resulttype = "n$";
        break;

      case "RATE": // RATE(n, payment, pv, [fv, [paytype, [guess]]])
        n = aval.value;
        payment = bval.value;
        pv = cval.value;
        fv = dval != null ? dval.value : 0;
        paytype = eval_ != null ? (eval_.value ? 1 : 0) : 0;
        guess = fval != null ? fval.value : 0.1;

        // rate is calculated by repeated approximations
        // The deltas are used to calculate new guesses

        maxloop = 100;
        tries = 0;
        delta = 1;
        epsilon = 0.0000001; // this is close enough
        rate = guess || 0.00000001; // zero is not allowed
        while ((delta >= 0 ? delta : -delta) > epsilon && rate != oldrate) {
          delta =
            fv +
            pv * Math.pow(1 + rate, n) +
            (payment * (1 + rate * paytype) * (Math.pow(1 + rate, n) - 1)) / rate;
          if (olddelta != null) {
            m = (delta - olddelta) / (rate - oldrate) || 0.001; // get slope (not zero)
            oldrate = rate;
            rate = rate - delta / m; // look for zero crossing
            olddelta = delta;
          } else {
            // first time - no old values
            oldrate = rate;
            rate = 1.1 * rate;
            olddelta = delta;
          }
          tries++;
          if (tries >= maxloop) {
            // didn't converge yet
            scf.PushOperand(operand, "e#NUM!", 0);
            return;
          }
        }
        result = rate;
        resulttype = "n%";
        break;
    }
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["FV"] = [
  SocialCalc.Formula.InterestFunctions,
  -3,
  "fv",
  "",
  "financial",
];
SocialCalc.Formula.FunctionList["NPER"] = [
  SocialCalc.Formula.InterestFunctions,
  -3,
  "nper",
  "",
  "financial",
];
SocialCalc.Formula.FunctionList["PMT"] = [
  SocialCalc.Formula.InterestFunctions,
  -3,
  "pmt",
  "",
  "financial",
];
SocialCalc.Formula.FunctionList["PV"] = [
  SocialCalc.Formula.InterestFunctions,
  -3,
  "pv",
  "",
  "financial",
];
SocialCalc.Formula.FunctionList["RATE"] = [
  SocialCalc.Formula.InterestFunctions,
  -3,
  "rate",
  "",
  "financial",
];

/*
#
# PPMT(rate, per, nper, pv, [fv, [paytype]])
# IPMT(rate, per, nper, pv, [fv, [paytype]])
#
# ODF/Excel/Sheets-compatible amortization split of PMT into principal and
# interest components for a given period. per is 1-based and must satisfy
# 1 <= per <= nper (Excel/Sheets #NUM! outside that domain). Reuses
# InterestFunctions' PMT/FV formulas (transformed the same way) instead of
# duplicating the annuity algebra: the interest portion of period `per` is
# the interest that accrues on the balance outstanding at the start of that
# period (FV of the annuity through per-1 payments), and the principal
# portion is PMT minus that interest.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.PPMTIPMTFunctions = function (fname, operand, foperand, sheet) {
  var resulttype, rate, per, nper, pv, fv, paytype, dval, eval_;
  var pmt, balance, interest, result;

  var scf = SocialCalc.Formula;

  var aval = scf.OperandAsNumber(sheet, foperand); // rate
  var bval = scf.OperandAsNumber(sheet, foperand); // per
  var cval = scf.OperandAsNumber(sheet, foperand); // nper
  var dval2 = scf.OperandAsNumber(sheet, foperand); // pv

  resulttype = scf.LookupResultType(aval.type, bval.type, scf.TypeLookupTable.twoargnumeric);
  resulttype = scf.LookupResultType(resulttype, cval.type, scf.TypeLookupTable.twoargnumeric);
  resulttype = scf.LookupResultType(resulttype, dval2.type, scf.TypeLookupTable.twoargnumeric);

  if (foperand.length) {
    dval = scf.OperandAsNumber(sheet, foperand); // fv
    resulttype = scf.LookupResultType(resulttype, dval.type, scf.TypeLookupTable.twoargnumeric);
    if (foperand.length) {
      eval_ = scf.OperandAsNumber(sheet, foperand); // paytype
      resulttype = scf.LookupResultType(resulttype, eval_.type, scf.TypeLookupTable.twoargnumeric);
      if (foperand.length) {
        scf.FunctionArgsError(fname, operand);
        return;
      }
    }
  }

  if (resulttype == "n") {
    rate = aval.value;
    per = bval.value;
    nper = cval.value;
    pv = dval2.value;
    fv = dval != null ? dval.value : 0;
    paytype = eval_ != null ? (eval_.value ? 1 : 0) : 0;

    if (nper <= 0 || per < 1 || per > nper || Math.floor(per) != per) {
      scf.PushOperand(operand, "e#NUM!", 0);
      return;
    }

    // PMT (same transformed formula as InterestFunctions' "PMT" case).
    if (rate == 0) {
      pmt = (fv - pv) / nper;
    } else {
      pmt =
        (0 - fv - pv * Math.pow(1 + rate, nper)) /
        (((1 + rate * paytype) * (Math.pow(1 + rate, nper) - 1)) / rate);
    }

    if (paytype == 1 && per == 1) {
      // Beginning-of-period annuity: the first payment happens before any
      // interest accrues, so no interest is owed yet.
      interest = 0;
    } else {
      // Balance outstanding at the start of `per` is the FV of the annuity
      // through per-1 payments (same transformed formula as InterestFunctions'
      // "FV" case, with n = per - 1).
      if (rate == 0) {
        balance = -pv - pmt * (per - 1);
      } else {
        balance = -(
          pv * Math.pow(1 + rate, per - 1) +
          (pmt * (1 + rate * paytype) * (Math.pow(1 + rate, per - 1) - 1)) / rate
        );
      }
      interest = balance * rate;
      if (paytype == 1) {
        interest = interest / (1 + rate);
      }
    }

    result = fname == "IPMT" ? interest : pmt - interest;
    resulttype = "n$";
  }

  scf.PushOperand(operand, resulttype, result);

  return;
};

SocialCalc.Formula.FunctionList["PPMT"] = [
  SocialCalc.Formula.PPMTIPMTFunctions,
  -4,
  "ppmt",
  "",
  "financial",
];
SocialCalc.Formula.FunctionList["IPMT"] = [
  SocialCalc.Formula.PPMTIPMTFunctions,
  -4,
  "ppmt",
  "",
  "financial",
];

/*
#
# MIRR(values, finance_rate, reinvest_rate)
#
# Modified IRR: negative cashflows are discounted at finance_rate (the cost
# of financing) back to period 0, positive cashflows are compounded at
# reinvest_rate forward to the final period, then a single rate is solved
# for algebraically -- no iteration needed. Requires at least one positive
# and one negative flow (Excel/Sheets #DIV/0!); requires at least two
# periods (Excel/Sheets #DIV/0! for a single-value range too).
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.MIRRFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;
  var rangeoperand: SocialCalc.FormulaOperand[] = [];
  var cashflows: number[] = [];
  var hasNumericCashflow = false;
  var value1, financerate, reinvestrate, n, i, negpv, posfv;

  rangeoperand.push(foperand.pop() as SocialCalc.FormulaOperand); // first operand is a range

  while (rangeoperand.length) {
    value1 = scf.OperandValueAndType(sheet, rangeoperand);
    if (value1.type.charAt(0) == "n") {
      cashflows.push(value1.value as number);
      hasNumericCashflow = true;
    } else if (value1.type.charAt(0) == "b" || value1.type.charAt(0) == "t") {
      cashflows.push(0);
    } else if (value1.type.charAt(0) == "e") {
      scf.PushOperand(operand, "e#VALUE!", 0);
      return;
    }
  }

  if (!cashflows.length || !hasNumericCashflow) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return;
  }

  financerate = scf.OperandAsNumber(sheet, foperand);
  if (scf.CheckForErrorValue(operand, financerate)) return;
  reinvestrate = scf.OperandAsNumber(sheet, foperand);
  if (scf.CheckForErrorValue(operand, reinvestrate)) return;

  n = cashflows.length;

  // n<2 is checked here to short-circuit the DIV/0! precisely (n===1 would
  // otherwise reach the same DIV/0! anyway via the negpv/posfv==0 check
  // below, since a single cashflow can never supply both a negative and a
  // positive value).
  if (n < 2 || financerate.value <= -1) {
    scf.PushOperand(operand, "e#DIV/0!", 0);
    return;
  }

  negpv = 0;
  posfv = 0;
  for (i = 0; i < n; i++) {
    if (cashflows[i] < 0) {
      // financerate.value > -1 is guaranteed above, so this base is always
      // strictly positive and the divisor below is never 0.
      negpv += cashflows[i] / Math.pow(1 + financerate.value, i);
    } else if (cashflows[i] > 0) {
      posfv += cashflows[i] * Math.pow(1 + reinvestrate.value, n - 1 - i);
    }
  }

  if (negpv == 0 || posfv == 0) {
    // needs at least one negative and one positive cashflow
    scf.PushOperand(operand, "e#DIV/0!", 0);
    return;
  }

  // negpv only accumulates negative-cashflow terms over a positive divisor
  // (so negpv < 0 here), and posfv only accumulates positive-cashflow terms
  // over a positive multiplier (so posfv > 0 here); -posfv/negpv is
  // therefore always > 0, so the fractional-power root below is always real.
  scf.PushOperand(operand, "n%", Math.pow(-posfv / negpv, 1 / (n - 1)) - 1);

  return;
};

SocialCalc.Formula.FunctionList["MIRR"] = [
  SocialCalc.Formula.MIRRFunction,
  3,
  "mirr",
  "",
  "financial",
];

/*
#
# NPV(rate,v1,v2,c1:c2,...)
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.NPVFunction = function (fname, operand, foperand, sheet) {
  var resulttypenpv, rate, sum, factor, value1;

  var scf = SocialCalc.Formula;

  rate = scf.OperandAsNumber(sheet, foperand);
  if (scf.CheckForErrorValue(operand, rate)) return;

  sum = 0;
  resulttypenpv = "n";
  factor = 1;

  while (foperand.length) {
    value1 = scf.OperandValueAndType(sheet, foperand);
    if (value1.type.charAt(0) == "e" && resulttypenpv.charAt(0) != "e") {
      resulttypenpv = value1.type;
      break;
    }
    // Numeric, blank, and text cashflows each occupy a discount period.
    // Non-numeric non-error values count as 0 so later periods do not shift
    // (was: text skipped → NPV(0.1,100,"x",200) == NPV(0.1,100,200)).
    if (
      value1.type.charAt(0) == "n" ||
      value1.type.charAt(0) == "b" ||
      value1.type.charAt(0) == "t"
    ) {
      factor *= 1 + rate.value;
      if (factor == 0) {
        scf.PushOperand(operand, "e#DIV/0!", 0);
        return;
      }
      var cash = value1.type.charAt(0) == "n" ? value1.value - 0 : 0;
      sum += cash / factor;
      if (value1.type.charAt(0) == "n") {
        resulttypenpv = scf.LookupResultType(
          value1.type,
          resulttypenpv || value1.type,
          scf.TypeLookupTable.plus,
        );
      }
    }
  }

  if (resulttypenpv.charAt(0) == "n") {
    resulttypenpv = "n$";
  }

  scf.PushOperand(operand, resulttypenpv, sum);

  return;
};

SocialCalc.Formula.FunctionList["NPV"] = [
  SocialCalc.Formula.NPVFunction,
  -2,
  "npv",
  "",
  "financial",
];

/*
#
# IRR(c1:c2,[guess])
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.IRRFunction = function (fname, operand, foperand, sheet) {
  var value1, guess, oldsum, maxloop, tries, epsilon, rate, oldrate, m, sum, factor, i;
  var rangeoperand: any[] = [];
  var cashflows = [];
  var hasNumericCashflow = false;

  var scf = SocialCalc.Formula;

  rangeoperand.push(foperand.pop() as any); // first operand is a range

  while (rangeoperand.length) {
    // get values from range so we can do iterative approximations
    value1 = scf.OperandValueAndType(sheet, rangeoperand);
    // Numeric, blank, and text cashflows each occupy a period (blank/text as 0),
    // matching NPV so a middle blank does not collapse later periods.
    if (value1.type.charAt(0) == "n") {
      cashflows.push(value1.value);
      hasNumericCashflow = true;
    } else if (value1.type.charAt(0) == "b" || value1.type.charAt(0) == "t") {
      cashflows.push(0);
    } else if (value1.type.charAt(0) == "e") {
      scf.PushOperand(operand, "e#VALUE!", 0);
      return;
    }
  }

  if (!cashflows.length || !hasNumericCashflow) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return;
  }

  guess = { value: 0 };

  if (foperand.length) {
    // guess is provided
    guess = scf.OperandAsNumber(sheet, foperand);
    if (guess.type.charAt(0) != "n" && guess.type.charAt(0) != "b") {
      scf.PushOperand(operand, "e#VALUE!", 0);
      return;
    }
    if (foperand.length) {
      // should be no more args
      scf.FunctionArgsError(fname, operand);
      return;
    }
  }

  guess.value = guess.value || 0.1;

  // rate is calculated by repeated approximations
  // The deltas are used to calculate new guesses

  maxloop = 20;
  tries = 0;
  epsilon = 0.0000001; // this is close enough
  rate = guess.value;
  sum = 1;

  while ((sum >= 0 ? sum : -sum) > epsilon && rate != oldrate) {
    sum = 0;
    factor = 1;
    for (i = 0; i < cashflows.length; i++) {
      factor *= 1 + rate;
      if (factor == 0) {
        scf.PushOperand(operand, "e#DIV/0!", 0);
        return;
      }
      sum += cashflows[i] / factor;
    }

    if (oldsum != null) {
      m = (sum - oldsum) / (rate - oldrate); // get slope
      oldrate = rate;
      rate = rate - sum / m; // look for zero crossing
      oldsum = sum;
    } else {
      // first time - no old values
      oldrate = rate;
      rate = 1.1 * rate;
      oldsum = sum;
    }
    tries++;
    if (tries >= maxloop) {
      // didn't converge yet
      scf.PushOperand(operand, "e#NUM!", 0);
      return;
    }
  }

  scf.PushOperand(operand, "n%", rate);

  return;
};

SocialCalc.Formula.FunctionList["IRR"] = [
  SocialCalc.Formula.IRRFunction,
  -1,
  "irr",
  "",
  "financial",
];

/*
#
# {avalues, bvalues, mismatched} = SocialCalc.Formula.CollectAlignedPairedRanges(sheet, aoperand, boperand)
#
# Drains two single-entry operand-stack arrays (each holding one range or
# scalar operand) in lockstep, resolving each element with
# OperandValueAndType exactly as CollectNumericValues/IRR/MIRR resolve a
# single range. Shared by XNPV and XIRR so neither duplicates the other's
# values/dates alignment loop. Returns the raw {type, value} pairs (not
# coerced to number) so callers can apply their own per-side validation
# (values tolerate blank/text as 0 like NPV; dates require numeric).
# `mismatched` is true when the two operands did not resolve to the same
# number of elements (Excel/Sheets #NUM!).
#
*/

/**
 * @param {any} sheet
 * @param {any[]} aoperand
 * @param {any[]} boperand
 */
FormulaMut.CollectAlignedPairedRanges = function (sheet, aoperand, boperand) {
  var scf = SocialCalc.Formula;
  var avalues: SocialCalc.FormulaValueResult[] = [];
  var bvalues: SocialCalc.FormulaValueResult[] = [];

  while (aoperand.length && boperand.length) {
    avalues.push(scf.OperandValueAndType(sheet, aoperand));
    bvalues.push(scf.OperandValueAndType(sheet, boperand));
  }

  return {
    avalues: avalues,
    bvalues: bvalues,
    mismatched: aoperand.length > 0 || boperand.length > 0,
  };
};

/*
#
# XNPV(rate, values, dates)
#
# Net present value of a cashflow schedule that is not necessarily
# periodic, discounted on an actual-day/365 basis from the first date in
# `dates` (the anchor, not necessarily the earliest -- matching Excel/
# Sheets, which key off dates[0]). values and dates must resolve to the
# same number of elements. Blank/text cashflow members count as 0 (same
# convention as NPV above); blank date members count as day 0 relative to
# themselves (harmless since their value already collapses to 0); text
# date members are #VALUE! (dates must be numeric serials, e.g. from
# DATE()). Any date before the anchor date is #NUM!, matching Excel's
# documented XIRR/XNPV domain restriction.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.XNPVFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var rate = scf.OperandAsNumber(sheet, foperand);
  if (scf.CheckForErrorValue(operand, rate)) return;

  var valuesop: SocialCalc.FormulaOperand[] = [foperand.pop() as SocialCalc.FormulaOperand];
  var datesop: SocialCalc.FormulaOperand[] = [foperand.pop() as SocialCalc.FormulaOperand];

  if (rate.value <= -1) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return;
  }

  var collected = scf.CollectAlignedPairedRanges(sheet, valuesop, datesop);
  if (collected.mismatched) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return;
  }

  var cashflows = scf.ResolveXCashflowSchedule(collected.avalues, collected.bvalues);
  if (cashflows.errortype) {
    scf.PushOperand(operand, cashflows.errortype, 0);
    return;
  }
  scf.PushOperand(
    operand,
    "n$",
    scf.ComputeXNPVValue(rate.value, cashflows.values, cashflows.dates),
  );

  return;
};

SocialCalc.Formula.FunctionList["XNPV"] = [
  SocialCalc.Formula.XNPVFunction,
  3,
  "xnpv",
  "",
  "financial",
];

/*
#
# XIRR(values, dates, [guess])
#
# Internal rate of return for a cashflow schedule that is not necessarily
# periodic (the rate at which XNPV == 0), discounted on an actual-day/365
# basis. Requires at least one positive and one negative cashflow
# (Excel/Sheets #NUM!). Solved with a safeguarded Newton's method that
# falls back to bisection whenever a Newton step would leave the current
# bracket or fails to shrink the residual fast enough (Numerical Recipes'
# rtsafe), so convergence is deterministic even for functions with poor
# local curvature near the root, unlike plain secant iteration.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.XIRRFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var valuesop: SocialCalc.FormulaOperand[] = [foperand.pop() as SocialCalc.FormulaOperand];
  var datesop: SocialCalc.FormulaOperand[] = [foperand.pop() as SocialCalc.FormulaOperand];

  var guess = { value: 0.1, type: "n" };
  if (foperand.length) {
    guess = scf.OperandAsNumber(sheet, foperand);
    if (guess.type.charAt(0) != "n" && guess.type.charAt(0) != "b") {
      scf.PushOperand(operand, "e#VALUE!", 0);
      return;
    }
    if (foperand.length) {
      scf.FunctionArgsError(fname, operand);
      return;
    }
    if (!guess.value) {
      guess.value = 0.1;
    }
  }

  var collected = scf.CollectAlignedPairedRanges(sheet, valuesop, datesop);
  if (collected.mismatched) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return;
  }

  var cashflows = scf.ResolveXCashflowSchedule(collected.avalues, collected.bvalues);
  if (cashflows.errortype) {
    scf.PushOperand(operand, cashflows.errortype, 0);
    return;
  }

  var hasPositive = false,
    hasNegative = false;
  for (var i = 0; i < cashflows.values.length; i++) {
    if (cashflows.values[i] > 0) hasPositive = true;
    else if (cashflows.values[i] < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return;
  }

  var solved = scf.SolveXIRRRate(cashflows.values, cashflows.dates, guess.value);
  if (solved == null) {
    scf.PushOperand(operand, "e#NUM!", 0);
    return;
  }

  scf.PushOperand(operand, "n%", solved);

  return;
};

SocialCalc.Formula.FunctionList["XIRR"] = [
  SocialCalc.Formula.XIRRFunction,
  -2,
  "xirr",
  "",
  "financial",
];

/**
 * Shared values/dates coercion for XNPV/XIRR: values follow NPV's
 * blank/text-as-0 convention; dates must be numeric (blank collapses to
 * day 0, which is harmless once its paired value is 0; text is #VALUE!).
 * Truncates each date to an integer serial per Excel/Sheets documented
 * behavior, then rejects any date earlier than the anchor (dates[0]) with
 * #NUM!, matching the documented XIRR/XNPV domain restriction. The first
 * error encountered on either side wins.
 * @param {any[]} avalues
 * @param {any[]} bvalues
 */
FormulaMut.ResolveXCashflowSchedule = function (avalues, bvalues) {
  var values: number[] = [];
  var dates: number[] = [];
  var i, at, bt, av, bv;

  for (i = 0; i < avalues.length; i++) {
    at = avalues[i].type.charAt(0);
    bt = bvalues[i].type.charAt(0);

    if (at == "e") return { values: [], dates: [], errortype: avalues[i].type };
    if (bt == "e") return { values: [], dates: [], errortype: bvalues[i].type };
    if (bt == "t") return { values: [], dates: [], errortype: "e#VALUE!" };

    av = at == "n" ? (avalues[i].value as number) - 0 : 0;
    bv = bt == "n" ? Math.floor((bvalues[i].value as number) - 0) : 0;

    if (i > 0 && bv < dates[0]!) {
      return { values: [], dates: [], errortype: "e#NUM!" };
    }

    values.push(av);
    dates.push(bv);
  }

  return { values: values, dates: dates, errortype: "" };
};

/**
 * XNPV(rate, values, dates) evaluated at a given rate: sum of
 * values[i] / (1+rate)^((dates[i]-dates[0])/365).
 * @param {number} rate
 * @param {number[]} values
 * @param {number[]} dates
 */
FormulaMut.ComputeXNPVValue = function (rate, values, dates) {
  var d0 = dates[0]!;
  var sum = 0;
  for (var i = 0; i < values.length; i++) {
    sum += values[i]! / Math.pow(1 + rate, (dates[i]! - d0) / 365);
  }
  return sum;
};

/**
 * Analytic d/dRate of ComputeXNPVValue, used by the safeguarded Newton
 * solver below instead of a finite-difference approximation.
 * @param {number} rate
 * @param {number[]} values
 * @param {number[]} dates
 */
FormulaMut.ComputeXNPVDerivative = function (rate, values, dates) {
  var d0 = dates[0]!;
  var sum = 0;
  for (var i = 0; i < values.length; i++) {
    var t = (dates[i]! - d0) / 365;
    if (t == 0) continue;
    sum += (-t * values[i]!) / Math.pow(1 + rate, t + 1);
  }
  return sum;
};

/**
 * Safeguarded Newton's method (Numerical Recipes' rtsafe) for XIRR: finds
 * rate such that ComputeXNPVValue(rate, values, dates) == 0. First
 * brackets a sign change starting from [-0.999999, max(guess, 0.1)],
 * expanding the upper bound geometrically. Every iteration takes a Newton
 * step only if it stays inside the current bracket and roughly halves the
 * residual; otherwise it bisects. This guarantees convergence whenever a
 * bracket is found, unlike the unguarded secant iteration RATE/IRR use.
 * Returns null (caller pushes #NUM!) if no bracket is found or the
 * iteration budget is exhausted.
 * @param {number[]} values
 * @param {number[]} dates
 * @param {number} guess
 */
FormulaMut.SolveXIRRRate = function (values, dates, guess) {
  var scf = SocialCalc.Formula;
  var maxLoop = 100;
  var epsilon = 0.0000001;

  var lo = -0.999999;
  var hi = guess > 0.1 ? guess : 0.1;
  var flo = scf.ComputeXNPVValue(lo, values, dates);
  var fhi = scf.ComputeXNPVValue(hi, values, dates);
  var expandTries = 0;
  while (flo * fhi > 0 && expandTries < 60) {
    hi = hi * 2;
    fhi = scf.ComputeXNPVValue(hi, values, dates);
    expandTries++;
  }
  if (!(flo * fhi <= 0) || !isFinite(flo) || !isFinite(fhi)) {
    return null;
  }

  var xlo = flo > 0 ? hi : lo;
  var xhi = flo > 0 ? lo : hi;
  var rts = (lo + hi) / 2;
  var dxold = Math.abs(hi - lo);
  var dx = dxold;
  var fval = scf.ComputeXNPVValue(rts, values, dates);
  var dfval = scf.ComputeXNPVDerivative(rts, values, dates);

  for (var i = 0; i < maxLoop; i++) {
    if (
      dfval == 0 ||
      ((rts - xhi) * dfval - fval) * ((rts - xlo) * dfval - fval) > 0 ||
      Math.abs(2 * fval) > Math.abs(dxold * dfval)
    ) {
      dxold = dx;
      dx = (xhi - xlo) / 2;
      rts = xlo + dx;
      if (xlo == rts) return rts;
    } else {
      dxold = dx;
      dx = fval / dfval;
      var temp = rts;
      rts -= dx;
      if (temp == rts) return rts;
    }
    if (Math.abs(dx) < epsilon) return rts;
    fval = scf.ComputeXNPVValue(rts, values, dates);
    dfval = scf.ComputeXNPVDerivative(rts, values, dates);
    if (fval < 0) {
      xlo = rts;
    } else {
      xhi = rts;
    }
  }

  return null;
};

// -----------------------------------------
// eddy  BUTTON COPYVALUE COPYFORMULA {
// -----------------------------------------

/*
#
# BUTTON(string) // 
# IMAGEBUTTON(string) 
# TEXTBOX(string) // 
# AUTOCOMPLETE(string, range)
# SELECT(string, range [,size [,multiple]])
# CHECKBOX(string) // 
# RADIOBUTTON(string,groupname)
# COPYVALUE(range, destinationCell, value_or_range) // 
# COPYFORMULA(range, destinationCell, formula_range)) // 
# INSERT(trigger_cell, destination_range [,formula_range,value_range,formula_range, ...])
# DELETEIF(trigger_cell, criteria , test_range) 
# COMMAND(trigger_cell, commands)
# COMMANDIF(trigger_cell, condition, commands) 
# PANEL(indices_or_csv, panel1_range [, panel2_range , ...])  
# SPLASH(splash_panel_range)  // shows splash screen (range) - shows while loading dependant sheets from server  
# STYLE(css)  
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 * @param {string} [coord]
 */
FormulaMut.IoFunctions = function (fname, operand, foperand, sheet, coord) {
  // ArgList has an array for each function, one entry for each possible arg (up to max).
  // Min args are specified in SocialCalc.Formula.FunctionList.
  // Minus values are repeated parameters
  //  -1 to -15  - repeated parameters
  //  -1 - [number, ...]  - e.g. [2,-1,-2]  means (text, [number, text, number, text, ... ] - repeated parameters
  //  1 - number
  //  2 - text
  //  3 - text | number
  //  4 - coord
  //  5 - coord | number
  //  6 - coord | text
  //  7 - coord | text | number
  //  8 - range
  //  9 - range | number
  //  10 - range | text 11 - range | text | number
  //  12 - range | coord
  //  13 - range | coord | number
  //  14 - range | coord | text
  //  15 - range | coord | text | number

  var argList: { [key: string]: number[] } = {
    BUTTON: [2],
    IMAGEBUTTON: [2],
    EMAIL: [14, 14, 14, 14],
    EMAILIF: [13, 14, 14, 14, 14],
    EMAILONEDIT: [14, 14, 14, 14, 14],
    EMAILAT: [13, 14, 14, 14, 14],
    EMAILONEDITIF: [14, 13, 14, 14, 14, 14],
    EMAILATIF: [13, 13, 14, 14, 14, 14],
    SUBMIT: [2],
    TEXTBOX: [2],
    AUTOCOMPLETE: [2, 14],
    SELECT: [2, 14, 1, 1], // # SELECT(string, range [,size [,multiple]])
    CHECKBOX: [3],
    RADIOBUTTON: [2, 2],
    COPYVALUE: [4, 12, 15],
    COPYFORMULA: [4, 12, 12],
    INSERT: [4, 8, -12, -15], // change code to allow unlimited
    DELETEIF: [4, 7, 8],
    COMMAND: [4, 14],
    COMMANDIF: [4, 13, 14],
    PANEL: [15, -12], // # PANEL(indices_or_csv, panel1_range [, panel2_range , ...])
    SPLASH: [12], // SPLASH(splash_panel_range)  // shows splash screen (range)
    STYLE: [6], // # STYLE(css)
  };

  var i: number;
  var parameter: any;
  var scf = SocialCalc.Formula;
  var result: any = 0;
  var resulttype = "e#VALUE!";

  var numargs = foperand.length;
  var argdef = argList[fname];
  var operand_value: any[] = [];
  var operand_type: any[] = [];

  var repeatCount = -1; // number of repeated parameters
  var repeatIndex = 0; // index of begining of repeated parameters
  var wantedType;

  for (i = 1; i <= numargs; i++) {
    // go through each arg, get value and type, and check for errors
    //   IF started repeat parameters section
    if (repeatCount != -1) {
      //     SET typeWanted = get type - adjust for repeted parameters
      wantedType = Math.abs(argdef[repeatIndex + ((i - 1 - repeatIndex) % repeatCount)]);
    } else {
      if (i > argdef.length) {
        // too many args
        scf.FunctionArgsError(fname, operand);
        return;
      }

      //     typeWanted = type wanted list [ parameterIndex ]
      wantedType = argdef[i - 1];

      //     IF typeWanted < 0 && repeatCount == -1
      if (wantedType < 0) {
        //       SET repeatCount = wanted list length - parameterIndex
        repeatCount = argdef.length - (i - 1);
        //       SET repeatIndex =  parameterIndex
        repeatIndex = i - 1;
        //       wantedType = Math.abs(wantedType )
        wantedType = Math.abs(wantedType);
      } //     END IF
    } //   END IF

    if (wantedType == 1) {
      // 1 - number
      parameter = scf.OperandAsNumber(sheet, foperand);
    } else if (wantedType == 2) {
      // 2 - text
      parameter = scf.OperandAsText(sheet, foperand);
    } else if (wantedType == 3) {
      // 3 - text | number
      parameter = scf.OperandValueAndType(sheet, foperand);
    } else {
      //  typeWanted > 3  && < 16  - else invalid
      //        SET parameterType = type
      var parameterType = foperand[foperand.length - 1].type; // param is end of stack

      //        SET validType = false
      var validParameterType = false;

      //        IF type = number && wanted type == number || type = text && wanted type == text THEN
      //                  1 - number   2 - text
      if (
        (parameterType.charAt(0) == "n" && (wantedType & 1) != 0) ||
        (parameterType.charAt(0) == "t" && (wantedType & 2) != 0)
      ) {
        //           valid
        validParameterType = true;
        //           get number type and value
        parameter = scf.OperandValueAndType(sheet, foperand);
      } //        END IF

      //        IF type = coord && wanted type == coord THEN
      if (parameterType == "coord" && (wantedType & 4) != 0) {
        //  4 - coord
        //          valid
        validParameterType = true;
        parameter = scf.OperandAsCoord(sheet, foperand);
        parameter.value = SocialCalc.Formula.PlainCoord(parameter.value); // remove absolute reference
      } //        END IF
      //        IF type = range && wanted type == range THEN
      if (parameterType == "range" && (wantedType & 8) != 0) {
        // 8 - range
        //           valid
        validParameterType = true;
        // get range
        parameter = scf.OperandAsRange(sheet, foperand);
        parameter.value = SocialCalc.Formula.PlainCoord(parameter.value); // remove absolute reference
      } //        END IF

      //        IF invalid param type
      if (validParameterType == false) {
        scf.FunctionArgsError(fname, operand);
        return;
      } //        END IF
    }

    // value or range, e.g. "C9|C11"
    operand_value[i] = parameter.value;
    // type e.g. "t", "range"
    operand_type[i] = parameter.type;
    if (parameter.type.charAt(0) == "e") {
      scf.PushOperand(operand, parameter.type, result);
      return;
    }
  }

  switch (fname) {
    case "STYLE":
      var parameters = sheet.ioParameterList[coord as string];
      if (parameters) {
        var css = SocialCalc.Formula.getStandardizedList(sheet, {
          value: operand_value[1],
          type: operand_type[1],
        });
        if (css.length > 0) {
          parameters.css = css[0];
          parameters.cssParameter =
            operand_type[1] == "t" ? '"' + operand_value[1] + '"' : operand_value[1];
        }
        result = ""; // ensure return value does not get changed by style - will add this empty string to number or string
        resulttype = "ni"; // important - allows widgets to keep type - use: TEXTBOX("")+STYLE(css)  - must add style to widget
      }
      break;
    case "SELECT": // # SELECT(string, range [,size [,multiple]])
      var parameters = sheet.ioParameterList[coord as string];
      var optionSource = SocialCalc.Formula.getStandardizedList(sheet, parameters[1]);

      parameters.html = [];
      parameters.html[0] = operand_value[4] == true ? "multiple" : "";
      parameters.html[1] = operand_value[3] ? "" + operand_value[3] : "1";
      if (optionSource.length > 0) {
        var options = "<option>" + optionSource.join("</option><option>") + "</option>";
        var optionRegExp = new RegExp("<option>" + operand_value[1], "");
        parameters.html[2] = options.replace(optionRegExp, "<option selected>" + operand_value[1]); // select default, if any
      }
      result = operand_value[1];
      resulttype = "ti" + fname;
      break;
    case "SUBMIT":
      result = "Submit";
      if (numargs > 0) result = operand_value[1];
      resulttype = "ti" + fname;
      break;
    case "BUTTON":
    case "IMAGEBUTTON":
    case "TEXTBOX":
    case "AUTOCOMPLETE":
      if (numargs > 0) result = operand_value[1];
      resulttype = "ti" + fname; // (t)ext value with (i)nterface (BUTTON,IMAGEBUTTON,TEXTBOX,AUTOCOMPLETE, SELECT)
      break;

    case "EMAIL":
    case "EMAILIF":
      resulttype = "ti" + fname; // (t)ext value with (i)nterface (,)
      result = "Send";
      break;
    case "EMAILONEDIT":
    case "EMAILONEDITIF":
    //    	  sheet.editEventCells === 'undefined') return;
    //    	  if(typeof sheet.ioParameterList === 'undefined') return;

    case "EMAILAT":
    case "EMAILATIF":
      resulttype = "ti" + fname; // (t)ext value with (i)nterface (,)
      result = "Send Now";
      break;

    case "CHECKBOX":
    case "RADIOBUTTON":
      if (operand_type[1].charAt(0) == "t") {
        result = operand_value[1].toUpperCase() == "TRUE" ? 1 : 0;
      } else {
        result = operand_value[1] == 0 ? 0 : 1;
      }
      //result = "true";
      resulttype = "ni" + fname; // (n)umber value with (i)nterface (CHECKBOX, RADIOBUTTON)

      break;

    case "COPYVALUE":
    case "COPYFORMULA":
    case "INSERT":
    case "DELETEIF":
    case "COMMAND":
    case "COMMANDIF":
      var cell = sheet.cells[operand_value[1]];
      if (typeof cell === "undefined") break; // invalid trigger cell, return error
      result = cell.datavalue; // get trigger cell value

      result = String(result).split("/"); // Clean up - if image button trigger then show only image name
      result = result[result.length - 1];
      resulttype = "t";
      break;
    case "PANEL":
    case "SPLASH":
      //  - code to show/hide panel
      //  --- get list of panels to show - "showindex_or_csv"
      //  --- get param details
      var showindices: any[] = [];
      var firstPanelIndex = 2;
      if (fname == "SPLASH") {
        result = "SPLASH:" + operand_value[1];
        resulttype = "t";
        if (sheet.splashdone == true) break; // show splash scree onload, then skip
        sheet.splashdone = true;
        firstPanelIndex = 1;
        showindices = [0]; // show panel at param 0 of splash formula
      } else {
        // panel formula
        showindices = SocialCalc.Formula.getStandardizedList(sheet, {
          value: operand_value[1],
          type: operand_type[1],
        });
        result = fname + ":" + showindices;
      }
      //  --- SET list of showrows TO empty
      //  --- SET list of showcols TO empty
      resulttype = "t";
      if (SocialCalc._app) {
        // panel only works in live app
        var showrows = [],
          showcols = [];
        //  --- FOR each panel to show
        for (
          var parameterIndex = firstPanelIndex;
          parameterIndex < operand_value.length;
          ++parameterIndex
        ) {
          // show panel if its index is in the showindices list
          var wanted = parameterIndex - 1;
          var showPanelFound = showindices.some(
            /** @param {any} v */ function (v) {
              return v == wanted;
            },
          );
          if (!showPanelFound) continue;

          //  ----- get panel range rows & cols only
          var panelCoordData = SocialCalc.Formula.getStandardizedCoords(sheet, {
            value: operand_value[parameterIndex],
            type: operand_type[parameterIndex],
          });
          //  ----- FOR each row/col -- create function to do the loop
          for (var i = 0; i < panelCoordData.ncols; i++) {
            //  ------- set showrows/col row/col to true
            showcols[panelCoordData.col1num + i] = true;
          } //  ----- END FOR
          for (var j = 0; j < panelCoordData.nrows; j++) {
            //  ------- set showrows/col row/col to true
            showrows[panelCoordData.row1num + j] = true;
          }
        } //  --- END FOR

        var spreadsheet = (window as any).spreadsheet;
        if (spreadsheet == null) spreadsheet = (window as any).ss;

        var forceRender = false;
        var lastShowDimension = 0;
        var showGridDimension = function (
          sheet: any,
          lastIndex: number,
          sheetHideList: any,
          showList: any,
          getIndexOf: (arg: number) => any,
        ) {
          //  --- hide all rows/col    up to sheet.attribs.lastrow/col
          //  --- FOR each row/col -- create function to do the loop
          for (var arrayIndex = 1; arrayIndex <= lastIndex; arrayIndex++) {
            // start at col/row 1
            //  ----- IF row hide/show state need updating
            var sheetHideIndex = getIndexOf(arrayIndex); // gets col name if col
            if (typeof sheetHideList[sheetHideIndex] == "undefined") {
              // row/col is visible
              if (showList[arrayIndex] !== true) {
                // if hide
                //  ------- SET the row state
                sheetHideList[sheetHideIndex] = "yes";
                //  ------- SET repaint flag
                forceRender = true;
              } else {
                lastShowDimension = arrayIndex;
              }
            } else {
              // row/col is hidden
              if (showList[arrayIndex] === true) {
                // if show
                //  ------- SET the row state
                delete sheetHideList[sheetHideIndex];
                //  ------- SET repaint flag
                forceRender = true;
                lastShowDimension = arrayIndex;
              }
            }
          }
        };

        var getRowIndex = function (row: any) {
          return row;
        };
        showGridDimension(
          sheet,
          sheet.attribs.lastrow,
          sheet.rowattribs.hide,
          showrows,
          getRowIndex,
        );
        lastShowDimension = 0;
        showGridDimension(
          sheet,
          sheet.attribs.lastcol,
          sheet.colattribs.hide,
          showcols,
          SocialCalc.rcColname,
        );
        // control width of html - for mobile app - as better to use native scroll rather than SocialCalc scroll bar - colpanes[length].last = usermaxcol - see FitToEditTable
        sheet.attribs.usermaxcol = lastShowDimension;

        if (forceRender) {
          sheet.renderneeded = true;
          sheet.widgetsClean = false; //  force widgets to repaint - update cell reference in widget HTML
          spreadsheet.editor.context.rowpanes[0].first = 1; // reset scroll bar to first row
          spreadsheet.editor.context.CalculateColWidthData();

          spreadsheet.width = spreadsheet.editor.context.totalwidth;
          spreadsheet.height = 2500;
          spreadsheet.editor.ResizeTableEditor(spreadsheet.editor.context.totalwidth, 2500); // 2500 is page height constant - fix issue with mobile device - Used constant because could not see an easy way to pre-calculate height
        }
      }
  }

  scf.PushOperand(operand, resulttype, result);
  return;
};

//*********************
//
// Docs see - Function Handling - ~line 1560
//
//*********************

SocialCalc.Formula.FunctionList["BUTTON"] = [
  SocialCalc.Formula.IoFunctions,
  1,
  "label",
  "",
  "gui",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Button('<%=cell_reference%>');\"><%=formated_value%></button>",
  "ParameterList",
];
SocialCalc.Formula.FunctionList["IMAGEBUTTON"] = [
  SocialCalc.Formula.IoFunctions,
  1,
  "imageurl",
  "",
  "gui",
  "<input type='image' src='<%=display_value%>' alt='Submit' onclick=\"SocialCalc.TriggerIoAction.Button('<%=cell_reference%>');\">",
  "ParameterList",
];
SocialCalc.Formula.FunctionList["EMAIL"] = [
  SocialCalc.Formula.IoFunctions,
  -3,
  "to_range subject_range, body_range",
  "",
  "action",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Email('<%=cell_reference%>');\"><%=formated_value%></button>",
  "ParameterList",
];
SocialCalc.Formula.FunctionList["EMAILIF"] = [
  SocialCalc.Formula.IoFunctions,
  -4,
  "condition_range, to_range subject_range, body_range",
  "",
  "action",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Email('<%=cell_reference%>');\"><%=formated_value%></button>",
  "ParameterList",
];
SocialCalc.Formula.FunctionList["EMAILONEDIT"] = [
  SocialCalc.Formula.IoFunctions,
  -4,
  "editRange, to_range subject_range, body_range",
  "",
  "action",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Email('<%=cell_reference%>');\"><%=formated_value%></button>",
  "EventTree",
];
SocialCalc.Formula.FunctionList["EMAILAT"] = [
  SocialCalc.Formula.IoFunctions,
  -4,
  "datetime_value, to_range subject_range, body_range",
  "",
  "action",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Email('<%=cell_reference%>');\"><%=formated_value%></button>",
  "TimeTrigger",
];
SocialCalc.Formula.FunctionList["EMAILONEDITIF"] = [
  SocialCalc.Formula.IoFunctions,
  -5,
  "editRange, condition, to_range subject_range, body_range",
  "",
  "action",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Email('<%=cell_reference%>');\"><%=formated_value%></button>",
  "EventTree",
];
SocialCalc.Formula.FunctionList["EMAILATIF"] = [
  SocialCalc.Formula.IoFunctions,
  -5,
  "datetime_value, condition, to_range subject_range, body_range",
  "",
  "action",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Email('<%=cell_reference%>');\"><%=formated_value%></button>",
  "TimeTrigger",
];
SocialCalc.Formula.FunctionList["SUBMIT"] = [
  SocialCalc.Formula.IoFunctions,
  100,
  "[label]",
  "",
  "action",
  "<button type='button' onclick=\"SocialCalc.TriggerIoAction.Submit('<%=cell_reference%>');\"><%=formated_value%></button>",
  "ParameterList",
];
SocialCalc.Formula.FunctionList["TEXTBOX"] = [
  SocialCalc.Formula.IoFunctions,
  1,
  "value",
  "",
  "gui",
  "<input type='text' id='TEXTBOX_<%=cell_reference%>' onblur='SocialCalc.CmdGotFocus(null);' oninput=\"SocialCalc.TriggerIoAction.TextBox('<%=cell_reference%>')\" value='<%=display_value%>' >",
  "Input",
];
SocialCalc.Formula.FunctionList["AUTOCOMPLETE"] = [
  SocialCalc.Formula.IoFunctions,
  2,
  "value, range or csv_text",
  "",
  "gui",
  "<input type='text' id='AUTOCOMPLETE_<%=cell_reference%>' onfocus=\"SocialCalc.TriggerIoAction.AddAutocomplete('<%=cell_reference%>');\" onblur='SocialCalc.CmdGotFocus(null);' value='<%=display_value%>' >",
  "Input",
];
SocialCalc.Formula.FunctionList["SELECT"] = [
  SocialCalc.Formula.IoFunctions,
  -2,
  "value, range or csv_text [,size]",
  "",
  "gui",
  "<select size='<%=html1_value%>' id='SELECT_<%=cell_reference%>' onchange=\"SocialCalc.TriggerIoAction.SelectList('<%=cell_reference%>')\" <%=html0_value%>><%=html2_value%></select>",
  "Input",
];
SocialCalc.Formula.FunctionList["CHECKBOX"] = [
  SocialCalc.Formula.IoFunctions,
  1,
  "value",
  "",
  "gui",
  "<input type='checkbox' id='CHECKBOX_<%=cell_reference%>' <%=checked%> onblur='SocialCalc.CmdGotFocus(null);' onchange=\"SocialCalc.TriggerIoAction.CheckBox('<%=cell_reference%>')\" >",
  "Input",
];
SocialCalc.Formula.FunctionList["RADIOBUTTON"] = [
  SocialCalc.Formula.IoFunctions,
  2,
  "value, groupname",
  "",
  "gui",
  "<input type='radio' value='<%=cell_reference%>' id='RADIOBUTTON_<%=cell_reference%>' <%=checked%> name='<%=parameter1_value%>' onblur=\"SocialCalc.CmdGotFocus(null);\" onclick=\"SocialCalc.TriggerIoAction.RadioButton('<%=parameter1_value%>');\" >",
  "Input",
];

SocialCalc.Formula.FunctionList["COPYVALUE"] = [
  SocialCalc.Formula.IoFunctions,
  3,
  "trigger_cell, destinationCell, value_or_range",
  "",
  "action",
  "",
  "EventTree",
];
SocialCalc.Formula.FunctionList["COPYFORMULA"] = [
  SocialCalc.Formula.IoFunctions,
  3,
  "trigger_cell, destinationCell, formula_range",
  "",
  "action",
  "",
  "EventTree",
];
SocialCalc.Formula.FunctionList["INSERT"] = [
  SocialCalc.Formula.IoFunctions,
  -2,
  "trigger_cell, destination_range [,formula_range,value_or_range,formula_range, ...]",
  "",
  "action",
  "",
  "EventTree",
];
SocialCalc.Formula.FunctionList["DELETEIF"] = [
  SocialCalc.Formula.IoFunctions,
  -1,
  "trigger_cell, criteria , test_range",
  "",
  "action",
  "",
  "EventTree",
];
SocialCalc.Formula.FunctionList["COMMAND"] = [
  SocialCalc.Formula.IoFunctions,
  -1,
  "trigger_cell, commands",
  "",
  "action",
  "",
  "EventTree",
];
SocialCalc.Formula.FunctionList["COMMANDIF"] = [
  SocialCalc.Formula.IoFunctions,
  -1,
  "trigger_cell, conditions, commands",
  "",
  "action",
  "",
  "EventTree",
];

SocialCalc.Formula.FunctionList["PANEL"] = [
  SocialCalc.Formula.IoFunctions,
  -1,
  "showindices_range_or_csv, panel1_range [, panel2_range , ...]",
  "",
  "gui",
  "",
];
SocialCalc.Formula.FunctionList["SPLASH"] = [
  SocialCalc.Formula.IoFunctions,
  -1,
  "splash_panel_range",
  "",
  "gui",
  "",
];

SocialCalc.Formula.FunctionList["STYLE"] = [
  SocialCalc.Formula.IoFunctions,
  -1,
  "css",
  "",
  "gui",
  "",
];

// on enter input box refresh the auto complete list
/** @param {string} triggerCellId */
TriggerIoMut.AddAutocomplete = function (triggerCellId) {
  var spreadsheet = (window as any).spreadsheet;
  if (spreadsheet == null) spreadsheet = (window as any).ss;
  var sheet = spreadsheet.sheet;

  var parameters = sheet.ioParameterList[triggerCellId];
  if (typeof parameters === "undefined") return;

  var autocompleteSource = SocialCalc.Formula.getStandardizedList(sheet, parameters[1]);

  //Overrides the default autocomplete filter function to search only from the beginning of the string
  $.ui.autocomplete.filter = function (array: any[], term: string) {
    // * RegEx Unit Test - https://regex101.com/r/kO6eC4/1
    var matcher = new RegExp("\\b" + $.ui.autocomplete.escapeRegex(term), "i");
    return $.grep(array, function (value: any) {
      return matcher.test(value.label || value.value || value);
    });
  };

  $("#AUTOCOMPLETE_" + triggerCellId).autocomplete({
    source: autocompleteSource,
    minLength: 1,
    autoFocus: true,
    select: function (event: any, ui: any) {
      $(this).val(ui.item.label);
      SocialCalc.TriggerIoAction.AutoComplete(triggerCellId);
    },
    change: function (event: any, ui: any) {
      if (ui.item === null) {
        $(this).val("");
      }
      SocialCalc.TriggerIoAction.AutoComplete(triggerCellId);
    },
  });
};
// Event triggered, e.g. button/imagebutton clicked. - call linked action formulas
// eddy TriggerIoAction {
/** @param {string} triggerCellId */
TriggerIoMut.Button = function (triggerCellId) {
  var spreadsheet = (window as any).spreadsheet;
  if (spreadsheet == null) spreadsheet = (window as any).ss;
  var sheet = spreadsheet.sheet;
  //spreadsheet.editor.EditorScheduleSheetCommands('set A2 value n 10',  true, false);

  //spreadsheet.editor.EditorScheduleSheetCommands('sendemail to eddy.nihon',  false, false);

  if (typeof sheet.ioEventTree === "undefined") return;
  if (typeof sheet.ioParameterList === "undefined") return;
  if (sheet.ioEventTree[triggerCellId] === "undefined") return;

  for (var actionCellId in sheet.ioEventTree[triggerCellId]) {
    var parameters = sheet.ioParameterList[actionCellId];
    var conditionsParameter = null;

    switch (parameters.function_name) {
      case "COPYVALUE":
        var parameterdata = SocialCalc.Formula.getStandardizedValues(sheet, parameters[2]);

        // get row and col of dest cell
        var destcr = SocialCalc.coordToCr(parameters[1].value);

        var sheetCommandList = SocialCalc.TriggerIoAction.CopyValueToRange(parameterdata, destcr);
        spreadsheet.editor.EditorScheduleSheetCommands(sheetCommandList, true, false);

        break;
      case "COPYFORMULA":
        var parameterdata = SocialCalc.Formula.getStandardizedValues(sheet, parameters[2]);

        // get row and col of dest cell
        var destcr = SocialCalc.coordToCr(parameters[1].value);

        sheetCommandList = SocialCalc.TriggerIoAction.CopyFormulaToRange(parameterdata, destcr);

        spreadsheet.editor.EditorScheduleSheetCommands(sheetCommandList, true, false);
        break;
      case "INSERT":
        //       # INSERT(trigger_cell, destination_range ,formula_range,value_range,formula_range, ...) //
        //       insertrow A1
        //       insertcol A1
        var parameterdata = SocialCalc.Formula.getStandardizedValues(sheet, parameters[1]); // destination_range
        if (parameterdata.type != "range") break; // invalid insert, requires range
        var insertCommand;
        var colOffset = 0,
          rowOffset = 0;
        if (parameterdata.ncols > 1) {
          // insert column
          colOffset = 1;
          rowOffset = 0;
          insertCommand = "insertcol";
        }
        if (parameterdata.nrows > 1) {
          // insert row
          colOffset = 0;
          rowOffset = 1;
          insertCommand = "insertrow";
        }
        var insertcellCoord = parameterdata.cellcoord![colOffset][rowOffset] as string;
        sheetCommandList = insertCommand + " " + insertcellCoord;
        var destcr = SocialCalc.coordToCr(insertcellCoord);
        var sourceDataIndex = 2;
        while (sourceDataIndex < parameters.length) {
          if (
            parameters[sourceDataIndex].type == "range" ||
            parameters[sourceDataIndex].type == "coord" ||
            sourceDataIndex % 2 == 1
          ) {
            var copyCellRange = SocialCalc.Formula.getStandardizedValues(
              sheet,
              parameters[sourceDataIndex],
            ); // formulas to insert

            if (sourceDataIndex % 2 == 0) {
              sheetCommandList =
                sheetCommandList +
                "\n" +
                SocialCalc.TriggerIoAction.CopyFormulaToRange(copyCellRange, destcr);
            } else {
              sheetCommandList =
                sheetCommandList +
                "\n" +
                SocialCalc.TriggerIoAction.CopyValueToRange(copyCellRange, destcr);
            }
            if (parameterdata.nrows > 1) destcr.col += copyCellRange.ncols;
            if (parameterdata.ncols > 1) destcr.row += copyCellRange.nrows;
          }
          sourceDataIndex++;
        }
        spreadsheet.editor.EditorScheduleSheetCommands(sheetCommandList, true, false);

        break;
      case "DELETEIF": //     # DELETEIF(trigger_cell, criteria , test_range) //
        var criteriaParameter = SocialCalc.Formula.getStandardizedValues(sheet, parameters[1]); // criteria
        var testRangeParameter = SocialCalc.Formula.getStandardizedValues(sheet, parameters[2]); // test_range - ignore first and last, as it would produce ref error

        // set command list to empty
        sheetCommandList = "";

        var colOffset = 0,
          rowOffset = 0,
          deleteCommand;
        if (testRangeParameter.ncols > 1 && testRangeParameter.nrows > 1) return; // error invalid range, only one cell wide/high
        if (testRangeParameter.ncols > 1) {
          // delete column
          colOffset = 1;
          rowOffset = 0;
          deleteCommand = "deletecol";
        }
        if (testRangeParameter.nrows > 1) {
          // delete row
          colOffset = 0;
          rowOffset = 1;
          deleteCommand = "deleterow";
        }

        var criteriaValue = criteriaParameter.celldata![0][0].datavalue;
        // FOR each source cell
        for (var i = testRangeParameter.ncols - colOffset - 1; i >= colOffset; i--) {
          // ignore first and last cell, as it would produce ref error
          for (var j = testRangeParameter.nrows - rowOffset - 1; j >= rowOffset; j--) {
            // IF after first source cell THEN  add new line to command list

            var cell = testRangeParameter.celldata![i][j];
            if (
              SocialCalc.Formula.TestCriteria(cell.datavalue, cell.valuetype, criteriaValue) == true
            ) {
              if (sheetCommandList != "") sheetCommandList = sheetCommandList + "\n";
              sheetCommandList = (sheetCommandList +
                deleteCommand +
                " " +
                testRangeParameter.cellcoord![i][j]) as string; // Note cell.coord becomes invalid when row/coll are inserted/deleted
            }
          }
        }

        if (sheetCommandList != "")
          spreadsheet.editor.EditorScheduleSheetCommands(sheetCommandList, true, false);

        break;
      // @ts-ignore COMMANDIF intentionally falls through to COMMAND after capturing condition.
      case "COMMANDIF": //    # COMMANDIF(trigger_cell, condition, commands)
        conditionsParameter = SocialCalc.Formula.getStandardizedValues(sheet, parameters[1]); // commands

      case "COMMAND": // COMMAND(trigger_cell, commands)
        var commandsParameter;
        // set command list to empty
        sheetCommandList = "";
        if (conditionsParameter != null) {
          commandsParameter = SocialCalc.Formula.getStandardizedValues(sheet, parameters[2]); // commands
          if (
            conditionsParameter.ncols != commandsParameter.ncols ||
            conditionsParameter.nrows != commandsParameter.nrows
          )
            break;
        } else {
          commandsParameter = SocialCalc.Formula.getStandardizedValues(sheet, parameters[1]); // commands
        }

        for (var i = 0; i < commandsParameter.ncols; i++) {
          for (var j = 0; j < commandsParameter.nrows; j++) {
            if (conditionsParameter != null) {
              var conditionCell = conditionsParameter.celldata![i][j];
              if ((conditionCell.datavalue as any) == false) continue;
            }
            if (sheetCommandList != "") sheetCommandList = sheetCommandList + "\n";
            var cellCommand = commandsParameter.celldata![i][j];
            sheetCommandList = sheetCommandList + cellCommand.datavalue.toString().trim();
          }
        }
        if (sheetCommandList != "")
          spreadsheet.editor.EditorScheduleSheetCommands(sheetCommandList, true, false);

        break;
    }
  }
};

/******************************
 * CopyFormulaToRange
 *   copy a range of cells to a destination. Copy the formulas, adjusting any cell references
 *
 * @destcr col and row - destcr = { col:n, row:n }
 * @sourceData  range data - datatype of param must match getStandardizedParameter() return type
 * @return commands to execute to do the copy.  - String of sheet commands, \n between each command -
 *
 ******************************/

/*
 * set B8 text t william              ... coord: "B8",  datavalue: "william",     datatype: "t", formula: "",          valuetype: "t"
 * set B10 constant nd 41307 2013/2/2 ... coord: "B10", datavalue: 41307,         datatype: "c", formula: "2013/2/2",  valuetype: "nd"
 * set B11 value n 1                  ... coord: "B11", datavalue: 1,             datatype: "v", formula: "",          valuetype: "n"
 *
 * set B7 formula "test"&B3   ... coord: "B7",  datavalue: "testwilliam", datatype: "f", formula: ""test"&B3", valuetype: "t"
 * set C8 formula B8       ... coord: "C8",  datavalue: "william",     datatype: "f", formula: "B8",        valuetype: "t"
 * set C10 formula B10     ... coord: "C10", datavalue: 41307,         datatype: "f", formula: "B10",       valuetype: "nd"
 * set C11 formula B11     ... coord: "C11", datavalue: 1,             datatype: "f", formula: "B11",       valuetype: "n"
 *  set B3  formula TEXTBOX("")             ... coord: "B3", datavalue: "william", datatype: "f", formula: "TEXTBOX("william")", valuetype: "tiTEXTBOX"
 */

/**
 * @param {any} formulaData
 * @param {{col: number, row: number, [key: string]: any}} destcr
 */
TriggerIoMut.CopyFormulaToRange = function (formulaData, destcr) {
  // set command list to empty
  var sheetCommandList = "";
  var sheetCommand;

  // FOR each source cell
  for (var i = 0; i < formulaData.ncols; i++) {
    for (var j = 0; j < formulaData.nrows; j++) {
      var cell = formulaData.celldata![i][j];
      // destination cell coord
      var destCellCoord = SocialCalc.crToCoord(destcr.col + i, destcr.row + j);

      // IF after first source cell THEN  add new line to command list
      if (i != 0 || j != 0) sheetCommandList = sheetCommandList + "\n";

      if (typeof cell !== "undefined" && cell.valuetype != "b") {
        // if not blank get cell data
        var cellDataType: string = cell.datatype as string;
        var cellValueType = cell.valuetype;
        var cellDataValue = cell.datavalue;
        var cellFormula = cell.formula;

        if (cellDataType == "f") {
          cellFormula = SocialCalc.OffsetFormulaCoords(
            cellFormula,
            destcr.col - formulaData.col1num,
            destcr.row - formulaData.row1num,
          );
          cellDataValue = "";
          cellValueType = "";
        } else {
          if (cellDataType != "c") cellFormula = ""; // clear text and number types   but not constant type like date/time
        }

        sheetCommand =
          "set " +
          destCellCoord +
          " " +
          SocialCalc.Constants.cellDataType[cellDataType] +
          " " +
          cellValueType +
          " " +
          SocialCalc.encodeForSave(cellDataValue as any) +
          " " +
          cellFormula;
      } else {
        sheetCommand = "set " + destCellCoord + " empty";
      }
      sheetCommandList += sheetCommand.trim();
    }
  }

  return sheetCommandList;
};

/******************************
 * CopyValueToRange
 *   copy a range of cells to a destination. Copy only the values
 *
 * @destcr col and row - destcr = { col:n, row:n }
 * @sourceData  range data - datatype of param must match getStandardizedParameter() return type
 * @return commands to execute to do the copy.  - String of sheet commands, \n between each command -
 *
 ******************************/
/**
 * @param {any} sourceData
 * @param {{col: number, row: number, [key: string]: any}} destcr
 */
TriggerIoMut.CopyValueToRange = function (sourceData, destcr) {
  //----------------------
  // set command list to empty
  var sheetCommandList = "";
  var sheetCommand;

  // FOR each source cell
  for (var i = 0; i < sourceData.ncols; i++) {
    for (var j = 0; j < sourceData.nrows; j++) {
      var cell = sourceData.celldata![i][j];
      // destination cell coord
      var destCellCoord = SocialCalc.crToCoord(destcr.col + i, destcr.row + j);

      // IF after first source cell THEN  add new line to command list
      if (i != 0 || j != 0) sheetCommandList = sheetCommandList + "\n";

      // copyvalue to set command
      // take the cell from copyvalue source and convert it to a set command to set the destination
      // e.g. set D3 text t push me
      // e.g. set D3 value v 10
      // e.g. set D5 constant n% 0.1 10%
      // e.g. set D6 constant nd 41922 10/10/2014
      if (typeof cell !== "undefined" && cell.valuetype != "b") {
        // if not blank get cell data
        var cellDataType: string = cell.datatype as string;
        var cellValueType = cell.valuetype;
        var cellDataValue = cell.datavalue;
        var cellFormula = cell.formula;

        if (cellDataType == "f") {
          cellFormula = "";
          cellDataType = cellValueType;
          if (cellValueType != "n" && cellValueType.charAt(0) != "t") {
            cellDataType = "c"; // for Date type etc
            cellFormula = cell.displaystring;
          }
          if (cellValueType.charAt(0) == "t") cellDataType = "t";
        } else {
          if (cellDataType != "c") cellFormula = ""; // clear text and number types   but not constant type like date/time
        }

        sheetCommand =
          "set " +
          destCellCoord +
          " " +
          SocialCalc.Constants.cellDataType[cellDataType] +
          " " +
          cellValueType +
          " " +
          SocialCalc.encodeForSave(cellDataValue as any) +
          " " +
          cellFormula;
      } else {
        sheetCommand = "set " + destCellCoord + " empty";
      }
      sheetCommandList += sheetCommand.trim();
    }
  }

  return sheetCommandList;
};
//----------------------

// optionalTriggerCellId - edited cell - used by EMAILONEDIT and EMAILONEDITIF
//onClick=EMAIL
/**
 * @param {string} emailFormulaCellId
 * @param {string | null} [optionalTriggerCellId]
 */
TriggerIoMut.Email = function (emailFormulaCellId, optionalTriggerCellId) {
  optionalTriggerCellId =
    typeof optionalTriggerCellId !== "undefined" ? optionalTriggerCellId : null;
  var scf = SocialCalc.Formula;
  var spreadsheet = (window as any).spreadsheet;
  if (spreadsheet == null) spreadsheet = (window as any).ss;

  var sheet = spreadsheet.sheet;
  var cell = sheet.cells[emailFormulaCellId];

  if (typeof sheet.ioParameterList === "undefined") return;

  var parameters = sheet.ioParameterList[emailFormulaCellId];
  if (typeof parameters === "undefined") return;
  //var debugLog = "debug TriggerIoAction.Email\n"; //eddy

  //spreadsheet.editor.EditorScheduleSheetCommands('sendemail to eddy.nihon',  false, false);
  // grab array for TO, SUBJECT and BODY
  var parameterValues: any[] = [];
  var parameterCellRefs: any[] = []; // OnEdit uses to workout what row/col was edited
  var maxRangeSize = 1;
  for (var index = 0; index < parameters.length; index++) {
    if (parameters[index].type.charAt(0) == "t") {
      parameterValues[index] = [String(parameters[index].value).replace(/ /g, "%20")];
    }
    if (parameters[index].type == "coord") {
      parameterValues[index] = [
        String(sheet.GetAssuredCell(parameters[index].value).datavalue).replace(/ /g, "%20"),
      ];
    }
    if (parameters[index].type == "range") {
      var rangeinfo: any = scf.DecodeRangeParts(sheet, parameters[index].value);
      parameterValues[index] = [];
      parameterCellRefs[index] = [];
      var rangeSizeCounter = 0;
      for (var i = 0; i < rangeinfo.ncols; i++) {
        for (var j = 0; j < rangeinfo.nrows; j++) {
          var cellcr = SocialCalc.crToCoord(rangeinfo.col1num + i, rangeinfo.row1num + j);
          var cell: any = rangeinfo.sheetdata.GetAssuredCell(cellcr);
          parameterValues[index].push(cell.datavalue.toString().replace(/ /g, "%20"));
          parameterCellRefs[index].push(cellcr);
          rangeSizeCounter++;
        }
      }
      if (rangeSizeCounter > maxRangeSize) maxRangeSize = rangeSizeCounter;
    }
  }

  var conditionIndex = -1; // check if email formula is conditional, -1 = not conditional
  var toAddressParamOffset = 0;
  switch (parameters.function_name) {
    case "EMAILIF":
      conditionIndex = 0;
      toAddressParamOffset = 1;
      break;
    case "EMAILAT":
    case "EMAILONEDIT":
      toAddressParamOffset = 1;
      break;
    case "EMAILONEDITIF":
    case "EMAILATIF":
      conditionIndex = 1;
      toAddressParamOffset = 2;
      break;

    case "EMAIL":
      break;
  }

  switch (parameters.function_name) {
    case "EMAILONEDIT":
    case "EMAILONEDITIF":
      if (
        optionalTriggerCellId &&
        parameters[0].type == "coord" &&
        parameters[0].value == optionalTriggerCellId
      )
        optionalTriggerCellId = null;
      break;
    default:
      optionalTriggerCellId = null;
  }

  var setStatusBarMessage = false;

  var emailContentsList = [];

  for (var rangeIndex = maxRangeSize - 1; rangeIndex > -1; rangeIndex--) {
    // if email formula is conditional && condition is false then skip
    if (conditionIndex != -1) {
      var conditionRangeIndex =
        rangeIndex >= parameterValues[conditionIndex].length ? 0 : rangeIndex;
      if (parameterValues[conditionIndex][conditionRangeIndex] == false) continue;
    }

    if (optionalTriggerCellId && optionalTriggerCellId != parameterCellRefs[0][rangeIndex])
      continue;
    // send: to, subject, body to server
    var toaddressRangeIndex =
      rangeIndex >= parameterValues[toAddressParamOffset].length ? 0 : rangeIndex;
    var subjectsRangeIndex =
      rangeIndex >= parameterValues[toAddressParamOffset + 1].length ? 0 : rangeIndex;
    var bodyRangeIndex =
      rangeIndex >= parameterValues[toAddressParamOffset + 2].length ? 0 : rangeIndex;

    var emailContents =
      parameterValues[toAddressParamOffset][toaddressRangeIndex] +
      " " +
      parameterValues[toAddressParamOffset + 1][subjectsRangeIndex] +
      " " +
      parameterValues[toAddressParamOffset + 2][bodyRangeIndex];
    setStatusBarMessage = true;
    sheet.ScheduleSheetCommands("sendemail " + emailContents, false);
    // cron job email - ignores ScheduleSheetCommands so send via return value
    emailContentsList.push([
      parameterValues[toAddressParamOffset][toaddressRangeIndex],
      parameterValues[toAddressParamOffset + 1][subjectsRangeIndex],
      parameterValues[toAddressParamOffset + 2][bodyRangeIndex],
    ]);
    //debugLog = debugLog + "emailContents "+emailContents+"\n"; //eddy
  }
  //console.log( "log formula1.js Email");
  // update status bar to indicate email is being sent
  if (setStatusBarMessage)
    SocialCalc.EditorSheetStatusCallback(null, "emailing", null, spreadsheet.editor);
  return emailContentsList; // cron job email
};

/*
 * creates command on form: submitform \rtimestamp\rB2value\rC2value ...
 */

/** @param {string} _triggerCellId */
TriggerIoMut.Submit = function (_triggerCellId) {
  var formDataViewer =
    SocialCalc.CurrentSpreadsheetControlObject != null
      ? SocialCalc.CurrentSpreadsheetControlObject.formDataViewer
      : SocialCalc.CurrentSpreadsheetViewerObject!.formDataViewer;

  if (formDataViewer != null && formDataViewer.loaded == true) {
    var spreadsheet = (window as any).spreadsheet;
    if (spreadsheet == null) spreadsheet = (window as any).ss;
    var sheet = spreadsheet.sheet;

    var date = new Date();
    var formDataValues =
      "" +
      date.getFullYear() +
      "-" +
      (date.getMonth() + 1) +
      "-" +
      date.getDate() +
      " " +
      date.getHours() +
      ":" +
      date.getMinutes() +
      ":" +
      date.getSeconds();

    for (var colIndex = 2; colIndex <= formDataViewer.formFieldsLength + 1; colIndex++) {
      var valueCoord = SocialCalc.crToCoord(colIndex, 2);
      formDataValues += "\r" + formDataViewer.sheet.cells[valueCoord].datavalue;
    }

    sheet.ScheduleSheetCommands("submitform \r" + formDataValues, false);
  }
};

//onChange=select tag (combobox)
/** @param {string} selectListCellId */
TriggerIoMut.SelectList = function (selectListCellId) {
  var getHTMLselectListCellValue = function (selectListWidget: any) {
    return selectListWidget.value;
  };
  var function_name = "SELECT";
  SocialCalc.TriggerIoAction.updateInputWidgetFormula(
    function_name,
    selectListCellId,
    getHTMLselectListCellValue,
  );
};

//onKeyUp=AutoComplete
/** @param {string} autoCompleteCellId */
TriggerIoMut.AutoComplete = function (autoCompleteCellId) {
  var getHTMLAutoCompleteCellValue = function (autoCompleteWidget: any) {
    return autoCompleteWidget.value;
  };
  var function_name = "AUTOCOMPLETE";
  SocialCalc.TriggerIoAction.updateInputWidgetFormula(
    function_name,
    autoCompleteCellId,
    getHTMLAutoCompleteCellValue,
  );
};

// onKeyUp=TextBox
/** @param {string} textBoxCellId */
TriggerIoMut.TextBox = function (textBoxCellId) {
  var getHTMLTextBoxCellValue = function (textBoxWidget: any) {
    return textBoxWidget.value;
  };
  var function_name = "TEXTBOX";
  SocialCalc.TriggerIoAction.updateInputWidgetFormula(
    function_name,
    textBoxCellId,
    getHTMLTextBoxCellValue,
  );
};

//onKeyUp=CheckBox
/** @param {string} checkBoxCellId */
TriggerIoMut.CheckBox = function (checkBoxCellId) {
  var getHTMLCheckBoxCellValue = function (checkBoxWidget: any) {
    return checkBoxWidget.checked ? "TRUE" : "FALSE";
  };
  var function_name = "CHECKBOX";
  SocialCalc.TriggerIoAction.updateInputWidgetFormula(
    function_name,
    checkBoxCellId,
    getHTMLCheckBoxCellValue,
  );
};

//Radio Button state changed
// onclick when selected
// update true/false in formula param
/** @param {string} radioButtonGroupName */
TriggerIoMut.RadioButton = function (radioButtonGroupName) {
  var getHTMLRadioButtonValue = function (radioButtonWidget: any) {
    return radioButtonWidget.checked ? "TRUE" : "FALSE";
  };
  var function_name = "RADIOBUTTON";
  // for each radio button in group
  $('input[name="' + radioButtonGroupName + '"]').each(function (this: any) {
    SocialCalc.TriggerIoAction.updateInputWidgetFormula(
      function_name,
      $(this)
        .attr("id")
        .replace(/RADIOBUTTON_/, ""),
      getHTMLRadioButtonValue,
    );
  });
};

/**
 * @param {string} function_name
 * @param {string} widgetCellId
 * @param {(widget: any) => string} getHTMLWidgetCellValue
 */
TriggerIoMut.updateInputWidgetFormula = function (
  function_name,
  widgetCellId,
  getHTMLWidgetCellValue,
) {
  var spreadsheet = (window as any).spreadsheet;
  if (spreadsheet == null) spreadsheet = (window as any).ss;
  var sheet = spreadsheet.sheet;
  var parameters = sheet.ioParameterList[widgetCellId];
  if (typeof parameters === "undefined") return;

  var cell_widget = document.getElementById(function_name + "_" + widgetCellId);
  var inputValue = getHTMLWidgetCellValue(cell_widget);
  inputValue = SocialCalc.encodeForSave(inputValue);

  var sheetCommand = "set " + widgetCellId + " formula " + function_name + '("' + inputValue + '"';
  for (var paramIndex = 1; paramIndex < parameters.length; paramIndex++) {
    if (parameters[paramIndex].type.charAt(0) == "n") {
      sheetCommand += "," + parameters[paramIndex].value;
    }
    if (parameters[paramIndex].type.charAt(0) == "t") {
      sheetCommand += ',"' + parameters[paramIndex].value + '"';
    }
    if (parameters[paramIndex].type == "range") {
      // convert:     E5!TO0DB4GSXZJ3|E8|   -> TO0DB4GSXZJ3!E5:E8
      // convert:     E5|E8|   -> E5:E8

      // * RegEx Unit Test **  https://regex101.com/r/zF1dA8/1
      sheetCommand +=
        "," +
        parameters[paramIndex].value
          .toString()
          .replace(/(\$?[A-Z]+\$?[0-9]+)([!]?)([^|]*)[|](\$?[A-Z]+\$?[0-9]+)[|]/i, "$3$2$1:$4");
    }
    if (parameters[paramIndex].type == "coord") {
      sheetCommand += "," + parameters[paramIndex].value;
    }
  }

  // for(var parseIndex = 3; parseIndex < cell.parseinfo.length -1; parseIndex++) {
  //   if(cell.parseinfo[parseIndex].type == 6)   sheetCommand += '"' + cell.parseinfo[parseIndex].text + '"';
  //   else sheetCommand +=  cell.parseinfo[parseIndex].text ;
  // }
  sheetCommand += ")";
  // add style formula if css has been added
  if (parameters.cssParameter) {
    sheetCommand += "+style(" + parameters.cssParameter + ")";
  }
  //SocialCalc.CmdGotFocus(cell_widget);

  spreadsheet.editor.EditorScheduleSheetCommands(sheetCommand, true, false);

  SocialCalc.TriggerIoAction.UpdateFormDataSheet(function_name, widgetCellId, inputValue);
};

// On edit of Form Input widget - Update form data sheet
/**
 * @param {string} function_name
 * @param {string} formCellId
 * @param {string} inputValue
 */
TriggerIoMut.UpdateFormDataSheet = function (function_name, formCellId, inputValue) {
  var formDataViewer =
    SocialCalc.CurrentSpreadsheetControlObject != null
      ? SocialCalc.CurrentSpreadsheetControlObject.formDataViewer
      : SocialCalc.CurrentSpreadsheetViewerObject!.formDataViewer;
  if (formDataViewer == null) return;

  var formFieldName = (function_name + formCellId).toLowerCase();
  if (formDataViewer.formFields[formFieldName] != null) {
    var valueCoord = SocialCalc.crToCoord(formDataViewer.formFields[formFieldName], 2);
    formDataViewer.sheet.ScheduleSheetCommands(
      "set " + valueCoord + " text t " + inputValue,
      false,
    );
  }
};

//getStandardizedValues(parameterData)
// gets cell data of range/coord OR param value as cell data - also get coord data as cell.coord is invalid when rows deleted
// CALL getProcessedParameter  with request for values
/**
 * @param {any} sheet
 * @param {any} parameterData
 */
FormulaMut.getStandardizedValues = function (sheet, parameterData) {
  return SocialCalc.Formula.getStandardizedParameter(sheet, parameterData, true, true);
};

// getStandardizedCoords(parameterData)  // gets coord(s) of range/coord
// CALL getProcessedParameter  with request for coord info
/**
 * @param {any} sheet
 * @param {any} parameterData
 */
FormulaMut.getStandardizedCoords = function (sheet, parameterData) {
  return SocialCalc.Formula.getStandardizedParameter(sheet, parameterData, true, false);
};

/***************
 * getStandardizedList
 * @sheet spreadsheet sheet
 * @listParameter csv or array or single value - convert into single array
 * @return array of values - one dimension
 ****************/
/**
 * @param {any} sheet
 * @param {any} listParameter
 */
FormulaMut.getStandardizedList = function (sheet, listParameter) {
  var listValues = [];
  var parameterdata = SocialCalc.Formula.getStandardizedValues(sheet, listParameter);

  if (parameterdata.ncols == 1 && parameterdata.nrows == 1) {
    listValues = String(parameterdata.celldata![0][0].datavalue).split(",");
  } else {
    for (var i = 0; i < parameterdata.ncols; i++) {
      for (var j = 0; j < parameterdata.nrows; j++) {
        var cell = parameterdata.celldata![i][j];
        listValues.push(cell.datavalue.toString());
      }
    }
  }
  return listValues;
};

/**************************
 * getStandardizedParameter(parameterData, includeCellCoord, includeCellData)
 *
 * Convert formula parameter to standard data structure and return it.
 * 
 * Formula parameters can be value/string/coord/range
 * value/string: convert to celldata:  [[coord:A1, datatype:t/c/v/f, valuetype:t/nd/n/b, datavalue:string/value , formula:"test"&B3]] 
 * coord/range: get celldata from cell
 * 
 *  return:
 ******  data structure returned
  { 
     value:A1:B2/A1/string/value,
     type:range/coord/t/n/b/eErrorType,
     celldata: [][] = {coord:invalid, datatype:t/c/v/f, valuetype:t/nd/n/b, datavalue:string/value , formula:"sum(A1)"},  // coord is invalid after insert/delete row/col
     cellcoord: [][] = A1,   // if requested
     ncols:n,
     nrows:n
     col1num:n
     row1num:n
   }

 *
 * ------------------- type ----------------- 
 * From docs for SocialCalc.Formula.EvaluatePolish  
 * type: can have these values (many are type and sub-type as two or more letters):
 *   "tw", "th", "t", "n", "nt", "coord", "range", "eErrorType", "b" (blank) - removed: "start"
 * valuetype: is set to type if the parameter is constant and not a cell reference
 * ------------------------------------------
 *
 *
 *******************************/
/**
 * @param {any} sheet
 * @param {any} parameterData
 * @param {boolean} [includeCellCoord]
 * @param {boolean} [includeCellData]
 */
FormulaMut.getStandardizedParameter = function (
  sheet,
  parameterData,
  includeCellCoord,
  includeCellData,
) {
  //SET result = {}
  //SET store param values in result (.value .type)
  var result: any = { type: parameterData.type, value: parameterData.value };
  if (includeCellData) result.celldata = [];

  //IF parameter is not a cell reference i.e.  type is: "tw", "th", "t", "n", "nt"  THEN
  if (parameterData.type != "coord" && parameterData.type != "range") {
    // Setup dummy cell reference information
    // SET rows and cols to 1 cell
    result.ncols = 1;
    result.nrows = 1;
    result.col1num = 1;
    result.row1num = 1;

    // IF requested: cell coord value THEN
    if (includeCellCoord) {
      // SET coord to default empty value -
      result.cellcoord = null;
    } // END IF

    // IF requested: cell data  THEN
    if (includeCellData) {
      // SET data values to dummy cell data using parameter
      // result.celldata = [[
      //   coord to default null value - as illegal request
      //   datatype  - t/v  - const can only have 2 value types
      //   valuetype (n/b/e/t)  - set to same as parameterData.type - check date/time types don't cause issue
      //   datavalue set to parameterData.type
      //   formula set to empty -  because not range/coord
      // ] ]
      result.celldata[0] = [];
      var constantDatatype =
        parameterData.type == "n" ? "v" : parameterData.type == "t" ? parameterData.type : "c";
      result.celldata[0][0] = {
        coord: null,
        datatype: constantDatatype,
        valuetype: parameterData.type,
        datavalue: parameterData.value,
      };
    } // END IF
  } else {
    // param type is "coord" or "range"

    var scf = SocialCalc.Formula;

    var sourcerangeinfo: any = null;
    if (parameterData.type == "coord") {
      var sourceCoord = SocialCalc.Formula.PlainCoord(parameterData.value);
      sourcerangeinfo = scf.DecodeRangeParts(sheet, sourceCoord + "|" + sourceCoord + "|");
    }

    if (parameterData.type == "range") {
      sourcerangeinfo = scf.DecodeRangeParts(sheet, parameterData.value);
    }

    // if coords requested,  init coord array
    if (includeCellCoord) result.cellcoord = [];

    for (var i = 0; i < sourcerangeinfo.ncols; i++) {
      for (var j = 0; j < sourcerangeinfo.nrows; j++) {
        var cellcoord = SocialCalc.crToCoord(
          sourcerangeinfo.col1num + i,
          sourcerangeinfo.row1num + j,
        );
        // IF requested: cell coord value THEN
        if (includeCellCoord) {
          // SET coord in array to coord of cell
          if (typeof result.cellcoord[i] === "undefined") result.cellcoord[i] = [];
          result.cellcoord[i][j] = cellcoord;
        } // END IF

        // IF requested: cell data  THEN
        if (includeCellData) {
          // SET get cell from sheet and store values
          if (typeof result.celldata[i] === "undefined") result.celldata[i] = [];
          var cell = sourcerangeinfo.sheetdata.GetAssuredCell(cellcoord);
          result.celldata[i][j] = cell;
        } // END IF
      }
    }
    // SET rows and cols to range - i.e. sourcerangeinfo -   ncols:n,       nrows:n       col1num:n      row1num:n
    result.ncols = sourcerangeinfo.ncols;
    result.nrows = sourcerangeinfo.nrows;
    result.col1num = sourcerangeinfo.col1num;
    result.row1num = sourcerangeinfo.row1num;
  } //END IF

  //RETURN
  return result;
};

// -----------------------------------------
// }
// -----------------------------------------

//
// SHEET CACHE
//

FormulaMut.SheetCache = {
  // Sheet data: Attributes are each sheet in the cache with values of an object with:
  //
  //    sheet: sheet-obj (or null, meaning not found)
  //    recalcstate: constants.asloaded = as loaded
  //                 constants.recalcing = being recalced now
  //                 constants.recalcdone = recalc done
  //    name: name of sheet (in case just have object and don't know name)
  //

  sheets: {},

  // Waiting for loading:
  // If sheet is not in cache, this is set to the sheetname being loaded
  // so it can be tested in the recalc loop to start load and then wait until restarted.
  // Reset to null before restarting.

  waitingForLoading: null,

  // Constants to use for setting sheets[*].recalcstate:

  constants: { asloaded: 0, recalcing: 1, recalcdone: 2 },

  loadsheet: null, // (deprecated - use SocialCalc.RecalcInfo.LoadSheet)
};

//
// othersheet = SocialCalc.Formula.FindInSheetCache(sheetname)
//
// Returns a SocialCalc.Sheet object corresponding to string sheetname
// or null if the sheet is not available or in error.
//
// Each sheet is loaded only once and then stored in a cache.
// Loading is handled elsewhere, e.g., in the recalc loop.
//

/** @param {string} sheetname */
FormulaMut.FindInSheetCache = function (sheetname) {
  var sfsc = SocialCalc.Formula.SheetCache;

  var nsheetname = SocialCalc.Formula.NormalizeSheetName(sheetname); // normalize different versions

  if (sfsc.sheets[nsheetname]) {
    // a sheet by that name is in the cache already
    return sfsc.sheets[nsheetname].sheet; // return it.
  }

  if (sfsc.waitingForLoading) {
    // waiting already - only queue up one
    return null; // return not found
  }

  if (sfsc.loadsheet) {
    // Deprecated old format synchronous callback
    alert("Using SocialCalc.Formula.SheetCache.loadsheet - deprecated");
    return SocialCalc.Formula.AddSheetToCache(nsheetname, sfsc.loadsheet(nsheetname));
  }

  sfsc.waitingForLoading = nsheetname; // let recalc loop know that we have a sheet to load

  return null; // return not found
};

//
// newsheet = SocialCalc.Formula.AddSheetToCache(sheetname, str, live)
//
// Adds a new sheet to the sheet cache.
// Returns the sheet object filled out with the str (a saved sheet).
//

/**
 * @param {string} sheetname
 * @param {string} str
 * @param {boolean} [live]
 */
FormulaMut.AddSheetToCache = function (sheetname, str, live) {
  var newsheet = null;
  var sfsc = SocialCalc.Formula.SheetCache;
  var sfscc = sfsc.constants;
  var newsheetname = SocialCalc.Formula.NormalizeSheetName(sheetname);

  if (str) {
    newsheet = new SocialCalc.Sheet();
    newsheet.ParseSheetSave(str);
  }

  sfsc.sheets[newsheetname] = { sheet: newsheet, recalcstate: sfscc.asloaded, name: newsheetname };

  SocialCalc.Formula.FreshnessInfo.sheets[newsheetname] =
    typeof live == "undefined" || live === false;

  return newsheet;
};

//
// nsheet = SocialCalc.Formula.NormalizeSheetName(sheetname)
//

/** @param {string} sheetname */
FormulaMut.NormalizeSheetName = function (sheetname) {
  if (SocialCalc.Callbacks.NormalizeSheetName) {
    return SocialCalc.Callbacks.NormalizeSheetName(sheetname);
  } else {
    return sheetname.toLowerCase();
  }
};

//
// REMOTE FUNCTION INFO
//

FormulaMut.RemoteFunctionInfo = {
  // Waiting for server:
  // If waiting for an XHR response from the server, this is set to some non-blank status text
  // so it can be tested in the recalc loop to start load and then wait until restarted.
  // Reset to null before restarting.

  waitingForServer: null,
};

//
// FRESHNESS INFO
//
// This information is generated during recalc.
// It may be used to help determine when the recalc data in a spreadsheet
// may be out of date.
// For example, it may be used to display a message like:
// "Dependent on sheet 'FOO' which was updated more recently than this printout"

FormulaMut.FreshnessInfo = {
  // For each external sheet referenced successfully an attribute of that name with value true to keep the sheet cached.
  // Value false means the sheet is reloaded at each recalc.

  sheets: {},

  // For each volatile function that is called an attribute of that name with value true.

  volatile: {},

  // Set to false when started and true when recalc completes

  recalc_completed: false,
};

FormulaMut.FreshnessInfoReset = function () {
  var scffi = SocialCalc.Formula.FreshnessInfo;
  var scfsc = SocialCalc.Formula.SheetCache;

  // Loop through sheets freshness, deleting cached sheets that should be reloaded.

  for (var sheet in scffi.sheets) {
    if (scffi.sheets[sheet] === false) {
      delete scfsc.sheets[sheet];
    }
  }

  // Reset freshness info.

  scffi.sheets = {};
  scffi.volatile = {};
  scffi.recalc_completed = false;
};

//
// MISC ROUTINES
//

//
// result = SocialCalc.Formula.PlainCoord(coord)
//
// Returns: coord without any $'s
//

/** @param {string} coord */
FormulaMut.PlainCoord = function (coord) {
  if (coord.indexOf("$") == -1) return coord;

  return coord.replace(/\$/g, ""); // remove any $'s
};

//
// result = SocialCalc.Formula.OrderRangeParts(coord1, coord2)
//
// Returns: {c1: col, r1: row, c2: col, r2 = row} with c1/r1 upper left
//

/**
 * @param {string} coord1
 * @param {string} coord2
 */
FormulaMut.OrderRangeParts = function (coord1: string, coord2: string) {
  var cr1, cr2;
  var result: any = {};

  cr1 = SocialCalc.coordToCr(coord1);
  cr2 = SocialCalc.coordToCr(coord2);
  if (cr1.col > cr2.col) {
    result.c1 = cr2.col;
    result.c2 = cr1.col;
  } else {
    result.c1 = cr1.col;
    result.c2 = cr2.col;
  }
  if (cr1.row > cr2.row) {
    result.r1 = cr2.row;
    result.r2 = cr1.row;
  } else {
    result.r1 = cr1.row;
    result.r2 = cr2.row;
  }

  return result as SocialCalc.FormulaRangeParts;
};

//
// cond = SocialCalc.Formula.TestCriteria(value, type, criteria)
//
// Determines whether a value/type meets the criteria.
// A criteria can be a numeric value, text beginning with <, <=, =, >=, >, <>, text by itself is start of text to match.
// Used by a variety of functions, including the "D" functions (DSUM, etc.).
//
// Returns true or false
//

//
// SocialCalc.Formula.WildcardPatternToRegex(pattern)
//
// Converts an Excel/Sheets-style wildcard criteria string to an anchored
// regex source string. * matches any sequence, ? matches one character,
// ~ escapes a literal following *, ?, or ~. Shared by TestCriteria
// (COUNTIF/SUMIF/D* criteria) and the XMATCH/XLOOKUP match_mode=2 scan.
//

/** @param {string} pattern */
FormulaMut.WildcardPatternToRegex = function (pattern) {
  if (pattern == "*") {
    // "*" means cell contains 'anything'
    return "^.+$";
  }
  // convert Excel syntax to regex syntax. * -> .*    ? -> .?    ~* -> \*    ~? -> \?
  // there are no negative lookbehinds in Javascript. Reverse the string and do negative lookaheads on ~? and ~*
  var basestring = pattern.split("").reverse().join("");
  basestring = basestring
    .replace(/\?(?=[^~])|\?$/g, "?.")
    .replace(/\?~/g, "?\\")
    .replace(/\*(?=[^~])|\*$/g, "*.")
    .replace(/\*~/, "*\\");
  basestring = basestring.split("").reverse().join("");
  return "^" + basestring + "$";
};

/**
 * @param {any} value
 * @param {any} type
 * @param {any} criteria
 */
FormulaMut.TestCriteria = function (value, type, criteria) {
  var comparitor, basestring, basevalue, cond, testvalue;

  if (criteria == null) {
    // undefined (e.g., error value) is always false
    return false;
  }

  criteria = criteria + "";
  // Two-char comparators first (>=, <=, <>); then single-char =/< />.
  // Peeling only the first char made ">=3" into ">" + "=3" (text), so COUNTIF/SUMIF/D*
  // silently matched nothing or everything.
  if (
    criteria.substring(0, 2) == ">=" ||
    criteria.substring(0, 2) == "<=" ||
    criteria.substring(0, 2) == "<>"
  ) {
    comparitor = criteria.substring(0, 2);
    basestring = criteria.substring(2);
  } else {
    comparitor = criteria.charAt(0); // look for comparitor
    if (comparitor == "=" || comparitor == "<" || comparitor == ">") {
      basestring = criteria.substring(1);
    } else {
      // check for '*' or '?' in search string - wildcard
      if (criteria.search(/([^~]\*|^\*)/) != -1 || criteria.search(/([^~]\?|^\?)/) != -1) {
        comparitor = "regex";
        basestring = SocialCalc.Formula.WildcardPatternToRegex(criteria);
      } else {
        comparitor = "none";
        basestring = criteria;
      }
    }
  }

  basevalue = SocialCalc.DetermineValueType(basestring); // get type of value being compared
  if (!basevalue.type) {
    // no criteria base value given
    if (comparitor == "none") {
      // blank criteria matches nothing
      return false;
    }
    if (type.charAt(0) == "b" && comparitor == "=") return true; // empty equals empty
    return false; // otherwise false
  }

  cond = false;

  if (basevalue.type.charAt(0) == "n" && type.charAt(0) == "t") {
    // criteria is number, but value is text
    testvalue = SocialCalc.DetermineValueType(value);
    if (testvalue.type.charAt(0) == "n") {
      // could be number - make it one
      value = testvalue.value;
      type = testvalue.type;
    }
  }

  if (type.charAt(0) == "n" && basevalue.type.charAt(0) == "n") {
    // compare two numbers
    value = (value as any) - 0; // make sure numbers
    basevalue.value = (basevalue.value as any) - 0;
    switch (comparitor) {
      case "<":
        cond = value < basevalue.value;
        break;

      case "<=":
        cond = value <= basevalue.value;
        break;

      case "=":
      case "none":
        cond = value == basevalue.value;
        break;

      case ">":
        cond = value > basevalue.value;
        break;

      case ">=":
        cond = value >= basevalue.value;
        break;

      case "<>":
        cond = value != basevalue.value;
        break;
    }
  } else if (type.charAt(0) == "e") {
    // error on left
    cond = false;
  } else if (basevalue.type.charAt(0) == "e") {
    // error on right
    cond = false;
  } else {
    // text, maybe mixed with number or blank
    if (type.charAt(0) == "n") {
      value = SocialCalc.format_number_for_display(value, "n", "");
    }
    if (basevalue.type.charAt(0) == "n") {
      return false; // if number and didn't match already, isn't a match
    }

    value = value ? (value as any).toLowerCase() : "";
    basevalue.value = basevalue.value ? (basevalue.value as any).toLowerCase() : "";

    switch (comparitor) {
      case "<":
        cond = value < basevalue.value;
        break;

      case "<=":
        cond = value <= basevalue.value;
        break;

      case "=":
        cond = value == basevalue.value;
        break;

      case "none":
        cond = (value as any).substring(0, (basevalue.value as any).length) == basevalue.value;
        break;

      case ">":
        cond = value > basevalue.value;
        break;

      case ">=":
        cond = value >= basevalue.value;
        break;

      case "<>":
        cond = value != basevalue.value;
        break;

      case "regex":
        try {
          cond = (value as any).search(new RegExp(basevalue.value as any)) != -1;
        } catch {
          cond = false; // regex invalid (e.g., error value) is always false
        }
        break;
    }
  }

  return cond;
};
// Dynamic-array functions.  These intentionally return a typed rectangular value;
// the spill layer consumes the rectangle without losing cell types.
FormulaMut.MaterializeArray = function (sheet, value) {
  if (value.type == "array") return value.value;
  var range = value;
  if (value.type == "coord")
    range = { type: "range", value: value.value + "|" + value.value + "|0" };
  if (range.type != "range") return null;
  var info = FormulaMut.DecodeRangeParts(sheet, range.value);
  if (!info) return null;
  var cells = [];
  for (var r = 0; r < info.nrows; r++) {
    var row = [];
    for (var c = 0; c < info.ncols; c++) {
      var cell = info.sheetdata.cells[SocialCalc.crToCoord(info.col1num + c, info.row1num + r)];
      row.push(cell ? { value: cell.datavalue, type: cell.valuetype } : { value: 0, type: "b" });
    }
    cells.push(row);
  }
  return { rows: info.nrows, cols: info.ncols, cells: cells };
};
FormulaMut.DynamicArrayFunctions = function (
  fname: string,
  operand: SocialCalc.FormulaOperand[],
  foperand: SocialCalc.FormulaOperand[],
  sheet: SocialCalc.Sheet,
): void {
  var scf = SocialCalc.Formula;
  var source = scf.TopOfStackValueAndType(sheet, foperand);
  var array = scf.MaterializeArray(sheet, source);
  if (!array) {
    operand.push({ type: "e#VALUE!", value: 0 });
    return;
  }
  var fail = function () {
    operand.push({ type: "e#VALUE!", value: 0 });
  };
  if (fname == "UNIQUE") {
    if (foperand.length > 2) {
      fail();
      return;
    }
    var byColumn = false,
      exactly = false;
    if (foperand.length) {
      var b = scf.OperandAsNumber(sheet, foperand);
      if (b.type.charAt(0) != "n") {
        fail();
        return;
      }
      byColumn = b.value != 0;
    }
    if (foperand.length) {
      var e = scf.OperandAsNumber(sheet, foperand);
      if (e.type.charAt(0) != "n") {
        fail();
        return;
      }
      exactly = e.value != 0;
    }
    var groups = byColumn ? array.cols : array.rows,
      width = byColumn ? array.rows : array.cols;
    var first = new Map<string, number>(),
      counts = new Map<string, number>(),
      keys: string[] = [];
    for (var i = 0; i < groups; i++) {
      var parts: string[] = [];
      for (var j = 0; j < width; j++) {
        var cell = byColumn ? array.cells[j]![i]! : array.cells[i]![j]!;
        var text = String(cell.value);
        parts.push(cell.type.length + ":" + cell.type + ":" + text.length + ":" + text);
      }
      var key = parts.join("|");
      keys.push(key);
      if (!first.has(key)) first.set(key, i);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    var keep: number[] = [];
    for (var k = 0; k < groups; k++)
      if (scf.KeepUniqueItem(k, first.get(keys[k])!, counts.get(keys[k])!, exactly)) keep.push(k);
    if (!keep.length) {
      operand.push({
        type: "array",
        value: { rows: 1, cols: 1, cells: [[{ type: "e#N/A", value: 0 }]] },
      });
      return;
    }
    var out: SocialCalc.FormulaArrayCell[][] = [];
    if (byColumn)
      for (var r = 0; r < array.rows; r++) {
        var rr: SocialCalc.FormulaArrayCell[] = [];
        for (var q = 0; q < keep.length; q++) rr.push(array.cells[r]![keep[q]]!);
        out.push(rr);
      }
    else for (var q = 0; q < keep.length; q++) out.push(array.cells[keep[q]]!.slice());
    operand.push({
      type: "array",
      value: {
        rows: byColumn ? array.rows : keep.length,
        cols: byColumn ? keep.length : array.cols,
        cells: out,
      },
    });
    return;
  }
  var sortKeys: { col: number; asc: boolean }[];
  if (foperand.length < 2) {
    // Zero or one post-source args: synthesize the default key (column 1,
    // ascending) instead of requiring an explicit column/direction pair.
    var soleColOperand = foperand.length ? scf.OperandAsNumber(sheet, foperand) : null;
    var soleColValue = soleColOperand ? Number(soleColOperand.value) : 1;
    if (
      (soleColOperand && soleColOperand.type.charAt(0) != "n") ||
      !Number.isFinite(soleColValue) ||
      Math.floor(soleColValue) != soleColValue ||
      soleColValue < 1 ||
      soleColValue > array.cols
    ) {
      fail();
      return;
    }
    sortKeys = [{ col: soleColValue - 1, asc: true }];
  } else {
    if (foperand.length % 2 != 0) {
      fail();
      return;
    }
    sortKeys = [];
    while (foperand.length) {
      var col = scf.OperandAsNumber(sheet, foperand),
        asc = scf.OperandAsNumber(sheet, foperand);
      if (
        col.type.charAt(0) != "n" ||
        asc.type.charAt(0) != "n" ||
        !Number.isFinite(Number(col.value)) ||
        Math.floor(Number(col.value)) != Number(col.value) ||
        Number(col.value) < 1 ||
        Number(col.value) > array.cols ||
        !Number.isFinite(Number(asc.value))
      ) {
        fail();
        return;
      }
      // Excel-style direction: positive ascends, zero/negative (including -1)
      // descends -- 0 keeps its historical false/descending meaning.
      sortKeys.push({ col: Number(col.value) - 1, asc: Number(asc.value) > 0 });
    }
  }
  var rows = array.cells.map(function (row, index) {
    return { row: row, index: index };
  });
  rows.sort(function (a, b) {
    for (var z = 0; z < sortKeys.length; z++) {
      var x = a.row[sortKeys[z]!.col]!,
        y = b.row[sortKeys[z]!.col]!,
        result = 0;
      if (x.type.charAt(0) == "e" || y.type.charAt(0) == "e") {
        if (x.type.charAt(0) == "e" && y.type.charAt(0) == "e")
          result = x.type < y.type ? -1 : x.type > y.type ? 1 : 0;
        else result = x.type.charAt(0) == "e" ? 1 : -1;
      } else if (x.type == "b" || y.type == "b")
        result = x.type == y.type ? 0 : x.type == "b" ? -1 : 1;
      else if (x.type.charAt(0) == "n" && y.type.charAt(0) == "n")
        result = Number(x.value) - Number(y.value);
      else if (x.type.charAt(0) == "n" || y.type.charAt(0) == "n")
        result = x.type.charAt(0) == "n" ? -1 : 1;
      else {
        var xt = String(x.value).toLowerCase(),
          yt = String(y.value).toLowerCase();
        result = xt < yt ? -1 : xt > yt ? 1 : 0;
      }
      if (result) return sortKeys[z]!.asc ? result : -result;
    }
    return scf.StableTieCompare(0, a.index, b.index);
  });
  operand.push({
    type: "array",
    value: {
      rows: array.rows,
      cols: array.cols,
      cells: rows.map(function (x) {
        return x.row;
      }),
    },
  });
};
FormulaMut.FunctionList["SORT"] = [FormulaMut.DynamicArrayFunctions, -1, "sort", null, "lookup"];
FormulaMut.FunctionList["UNIQUE"] = [
  FormulaMut.DynamicArrayFunctions,
  -1,
  "unique",
  null,
  "lookup",
];

/*
#
# IFERROR(value,value_if_error)
# IFNA(value,value_if_na)
#
# Both branches share a single "resolve value, catch a specific error class"
# shape: IFERROR catches any error type, IFNA catches only #N/A. Like IF
# (above), this evaluator is eager: value_if_error/value_if_na has already
# been fully evaluated by the time this function runs (RPN evaluates the
# argument sub-expression before the enclosing function token), even when
# value did not error. Vendor Excel/Sheets IFERROR/IFNA are short-circuit and
# never evaluate the unused branch. This only differs observably when the
# unused branch has a side effect this engine tracks: a volatile marker
# (NOW/TODAY/RAND) or an IO trigger (EMAILIF/BUTTON/etc. via
# StoreIoEventFormula) is recorded even for the branch that is discarded.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.IfErrorFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var valueResult = scf.OperandValueAndType(sheet, foperand);
  var fallback = foperand.pop() as SocialCalc.FormulaOperand;

  var caught = fname == "IFNA" ? valueResult.type == "e#N/A" : valueResult.type.charAt(0) == "e";

  if (caught) {
    operand.push(fallback);
  } else {
    operand.push({ type: valueResult.type, value: valueResult.value });
  }
};

SocialCalc.Formula.FunctionList["IFERROR"] = [
  SocialCalc.Formula.IfErrorFunction,
  2,
  "iferror",
  "",
  "test",
];
SocialCalc.Formula.FunctionList["IFNA"] = [
  SocialCalc.Formula.IfErrorFunction,
  2,
  "ifna",
  "",
  "test",
];

/*
#
# IFS(condition1,value1,[condition2,value2,...])
#
# Evaluates condition/value pairs left to right and returns the first value
# whose condition is true (nonzero numeric/logical). #N/A if none match, an
# odd argument count, or a non-numeric/non-logical condition raises
# #VALUE!/propagates the condition's own error. Same eager-evaluation caveat
# as IF/IFERROR: every condition and every paired value is fully evaluated
# before IFS picks a winner (see lemma/branch.ts firstTrueIndex for the pure
# "first true wins" policy this mirrors).
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.IfsFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  if (foperand.length % 2 != 0) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  while (foperand.length) {
    var cond = scf.OperandValueAndType(sheet, foperand);
    var val = foperand.pop() as SocialCalc.FormulaOperand;
    var t = cond.type.charAt(0);
    if (t == "e") {
      operand.push({ type: cond.type, value: 0 });
      return;
    }
    if (t != "n" && t != "b") {
      operand.push({ type: "e#VALUE!", value: 0 });
      return;
    }
    if (cond.value) {
      operand.push(val);
      return;
    }
  }

  operand.push({ type: "e#N/A", value: 0 });
};

SocialCalc.Formula.FunctionList["IFS"] = [SocialCalc.Formula.IfsFunction, -2, "ifs", "", "test"];

/*
#
# SWITCH(expression,case1,value1,[case2,value2,...],[default])
#
# Compares expression against each case using the same equality rule as the
# "=" operator (numeric-numeric direct compare; otherwise both sides are
# rendered to lowercase text, matching EvaluatePolish's comparison-operator
# branch above) and returns the first matching value. A trailing unpaired
# argument is the default, used when no case matches; with no default and no
# match, returns #N/A.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SwitchFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var valuesEqual = function (
    v1: SocialCalc.FormulaValueResult,
    v2: SocialCalc.FormulaValueResult,
  ): boolean {
    var t1 = v1.type.charAt(0),
      t2 = v2.type.charAt(0);
    if (t1 == "n" && t2 == "n") return v1.value == v2.value;
    // SocialCalc.format_number_for_display is a hard, always-loaded
    // dependency wherever the evaluator runs, so call it directly (mirrors
    // EvaluatePolish's comparison-operator branch); no defensive fallback.
    var s1: string = String(v1.value),
      s2: string = String(v2.value);
    if (t1 == "n") s1 = SocialCalc.format_number_for_display(v1.value, "n", "");
    else if (t1 == "b") s1 = "";
    if (t2 == "n") s2 = SocialCalc.format_number_for_display(v2.value, "n", "");
    else if (t2 == "b") s2 = "";
    return s1.toLowerCase() == s2.toLowerCase();
  };

  var expr = scf.OperandValueAndType(sheet, foperand);
  if (expr.type.charAt(0) == "e") {
    operand.push({ type: expr.type, value: 0 });
    return;
  }

  while (foperand.length >= 2) {
    var caseval = scf.OperandValueAndType(sheet, foperand);
    var val = foperand.pop() as SocialCalc.FormulaOperand;
    if (caseval.type.charAt(0) == "e") {
      operand.push({ type: caseval.type, value: 0 });
      return;
    }
    if (valuesEqual(expr, caseval)) {
      operand.push(val);
      return;
    }
  }

  if (foperand.length == 1) {
    operand.push(foperand.pop() as SocialCalc.FormulaOperand); // trailing default
    return;
  }

  operand.push({ type: "e#N/A", value: 0 });
};

SocialCalc.Formula.FunctionList["SWITCH"] = [
  SocialCalc.Formula.SwitchFunction,
  -3,
  "switch",
  "",
  "test",
];

/*
#
# TEXTJOIN(delimiter,ignore_empty,text1,[text2,...])
# JOIN(delimiter,value_or_array1,[value_or_array2,...])
#
# TextJoinCollect flattens each remaining argument via OperandAsText, which
# resolves ranges cell-by-cell through StepThroughRangeDown (row-major: outer
# row loop, inner column loop) and follows names/cross-sheet coords the same
# way every other range-consuming function does, so TEXTJOIN/JOIN automatically
# inherit range, cross-sheet, and named-range flattening for free. The first
# item that resolves to an error is returned immediately (error propagation);
# no artificial string-length cap is added beyond the engine's existing text
# handling. JOIN is the Sheets alias for TEXTJOIN with ignore_empty fixed to
# FALSE (see lemma/branch.ts keepJoinItem/emitDelimiterBefore for the pure
# keep/placement policy this mirrors).
#
*/

/**
 * @param {any} sheet
 * @param {any[]} foperand
 * @param {string} delim
 * @param {boolean} ignoreEmpty
 */
FormulaMut.TextJoinCollect = function (sheet, foperand, delim, ignoreEmpty) {
  var scf = SocialCalc.Formula;
  var parts: string[] = [];

  while (foperand.length) {
    var item = scf.OperandAsText(sheet, foperand);
    if (item.type.charAt(0) == "e") {
      return { type: item.type, value: 0 };
    }
    var text = item.value as string;
    if (!ignoreEmpty || text.length) parts.push(text);
  }

  return { type: "t", value: parts.join(delim) };
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.TextJoinFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var delim = scf.OperandAsText(sheet, foperand);
  if (delim.type.charAt(0) == "e") {
    operand.push({ type: delim.type, value: 0 });
    return;
  }
  var ignoreOp = scf.OperandAsNumber(sheet, foperand);
  if (ignoreOp.type.charAt(0) == "e") {
    operand.push({ type: ignoreOp.type, value: 0 });
    return;
  }

  operand.push(scf.TextJoinCollect(sheet, foperand, delim.value as string, ignoreOp.value != 0));
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.JoinFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var delim = scf.OperandAsText(sheet, foperand);
  if (delim.type.charAt(0) == "e") {
    operand.push({ type: delim.type, value: 0 });
    return;
  }

  operand.push(scf.TextJoinCollect(sheet, foperand, delim.value as string, false));
};

SocialCalc.Formula.FunctionList["TEXTJOIN"] = [
  SocialCalc.Formula.TextJoinFunction,
  -3,
  "textjoin",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["JOIN"] = [SocialCalc.Formula.JoinFunction, -2, "join", "", "text"];

/*
#
# TEXTBEFORE(text,delimiter,[instance_num],[match_mode],[match_end],[if_not_found])
# TEXTAFTER(text,delimiter,[instance_num],[match_mode],[match_end],[if_not_found])
#
# instance_num counts delimiter occurrences from the left when positive, from
# the right when negative (default 1); match_mode 0 = case-sensitive
# (default), nonzero = case-insensitive; match_end nonzero treats the string
# boundary in the counting direction as one additional virtual
# zero-length delimiter (so TEXTAFTER(text,delim,-1,0,1) with no real
# delimiter returns the whole string, and TEXTAFTER with match_end and an
# instance one past the last real delimiter returns ""), matching documented
# Excel TEXTBEFORE/TEXTAFTER match_end semantics. No array-of-delimiters
# support: this engine has no array-constant literal syntax, so delimiter is
# always a single scalar string. When the delimiter cannot be located,
# if_not_found (left unevaluated until picked, like IF's branches) is
# returned if supplied, else #N/A. Note: this engine's comma-argument parser
# has no notion of an elided middle argument (a bare "TEXTAFTER(a,b,,,1)"
# is a parse error, not "match_end=1 with match_mode defaulted") — to reach
# a later optional argument, every earlier optional must be supplied
# explicitly (e.g. TEXTAFTER(text,delim,-4,0,1)).
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.TextBeforeAfterFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  if (foperand.length > 6) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  var textOp = scf.OperandAsText(sheet, foperand);
  if (textOp.type.charAt(0) == "e") {
    operand.push({ type: textOp.type, value: 0 });
    return;
  }
  var delimOp = scf.OperandAsText(sheet, foperand);
  if (delimOp.type.charAt(0) == "e") {
    operand.push({ type: delimOp.type, value: 0 });
    return;
  }
  var text = textOp.value as string;
  var delim = delimOp.value as string;

  // Excel note: text must resolve to a non-empty string, else #VALUE!.
  if (text.length == 0) {
    operand.push({ type: "e#VALUE!", value: 0 });
    return;
  }

  var instanceNum = 1;
  if (foperand.length) {
    var io = scf.OperandAsNumber(sheet, foperand);
    if (io.type.charAt(0) == "e") {
      operand.push({ type: io.type, value: 0 });
      return;
    }
    instanceNum = Math.trunc(io.value as number);
    if (instanceNum == 0) {
      operand.push({ type: "e#VALUE!", value: 0 });
      return;
    }
  }

  var matchMode = 0;
  if (foperand.length) {
    var mo = scf.OperandAsNumber(sheet, foperand);
    if (mo.type.charAt(0) == "e") {
      operand.push({ type: mo.type, value: 0 });
      return;
    }
    matchMode = mo.value ? 1 : 0;
  }

  var matchEnd = 0;
  if (foperand.length) {
    var eo = scf.OperandAsNumber(sheet, foperand);
    if (eo.type.charAt(0) == "e") {
      operand.push({ type: eo.type, value: 0 });
      return;
    }
    matchEnd = eo.value ? 1 : 0;
  }

  var hasIfNotFound = false;
  var ifNotFound: SocialCalc.FormulaOperand = { type: "e#N/A", value: 0 };
  if (foperand.length) {
    hasIfNotFound = true;
    ifNotFound = foperand.pop() as SocialCalc.FormulaOperand;
  }

  var positions: number[] = [];
  if (delim.length > 0) {
    var hay = matchMode ? text.toLowerCase() : text;
    var needle = matchMode ? delim.toLowerCase() : delim;
    var searchPos = 0;
    while (true) {
      var idx = hay.indexOf(needle, searchPos);
      if (idx < 0) break;
      positions.push(idx);
      searchPos = idx + needle.length;
    }
  }

  var n = positions.length;
  var idx1based = instanceNum > 0 ? instanceNum : n + instanceNum + 1;
  var found = idx1based >= 1 && idx1based <= n;

  var pos = -1;
  var delimLen = 0;
  if (found) {
    pos = positions[idx1based - 1]!;
    delimLen = delim.length;
  } else if (matchEnd) {
    if (instanceNum > 0 && idx1based == n + 1) {
      pos = text.length; // virtual delimiter past the end
    }
    if (instanceNum < 0 && idx1based == 0) {
      pos = 0; // virtual delimiter before the start
    }
  }

  if (pos < 0) {
    if (hasIfNotFound) {
      operand.push(ifNotFound);
    } else {
      operand.push({ type: "e#N/A", value: 0 });
    }
    return;
  }

  var resultText = fname == "TEXTBEFORE" ? text.substring(0, pos) : text.substring(pos + delimLen);
  scf.PushOperand(operand, "t", resultText);
};

SocialCalc.Formula.FunctionList["TEXTBEFORE"] = [
  SocialCalc.Formula.TextBeforeAfterFunction,
  -2,
  "textbeforeafter",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["TEXTAFTER"] = [
  SocialCalc.Formula.TextBeforeAfterFunction,
  -2,
  "textbeforeafter",
  "",
  "text",
];

/*
#
# SPLIT(text,delimiter,[split_by_each],[remove_empty_text])
#
# Sheets SPLIT: split_by_each (default TRUE) treats every character in
# delimiter as its own separate delimiter (e.g. delimiter=",;" splits on a
# comma OR a semicolon, not the literal two-character string); FALSE treats
# delimiter as one literal multi-character separator. remove_empty_text
# (default TRUE) drops empty pieces produced by adjacent delimiters. Result
# spills across one row (typed "array", consumed by the existing spill layer
# the same way SORT/UNIQUE results are).
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.SplitFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  if (foperand.length > 4) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  var textOp = scf.OperandAsText(sheet, foperand);
  if (textOp.type.charAt(0) == "e") {
    operand.push({ type: textOp.type, value: 0 });
    return;
  }
  var delimOp = scf.OperandAsText(sheet, foperand);
  if (delimOp.type.charAt(0) == "e") {
    operand.push({ type: delimOp.type, value: 0 });
    return;
  }

  var splitByEach = true;
  if (foperand.length) {
    var sb = scf.OperandAsNumber(sheet, foperand);
    if (sb.type.charAt(0) == "e") {
      operand.push({ type: sb.type, value: 0 });
      return;
    }
    splitByEach = sb.value != 0;
  }

  var removeEmpty = true;
  if (foperand.length) {
    var rm = scf.OperandAsNumber(sheet, foperand);
    if (rm.type.charAt(0) == "e") {
      operand.push({ type: rm.type, value: 0 });
      return;
    }
    removeEmpty = rm.value != 0;
  }

  var text = textOp.value as string;
  var delim = delimOp.value as string;

  var pieces: string[];
  if (delim.length == 0) {
    pieces = [text];
  } else if (splitByEach) {
    var alternation = delim
      .split("")
      .map(function (ch) {
        return ch.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
      })
      .join("|");
    var charClass = "(?:" + alternation + ")";
    pieces = text.split(new RegExp(charClass));
  } else {
    pieces = text.split(delim);
  }
  if (removeEmpty)
    pieces = pieces.filter(function (p) {
      return p.length > 0;
    });
  if (!pieces.length) pieces = [""];

  var cells: SocialCalc.FormulaArrayCell[] = pieces.map(function (p) {
    return { type: "t", value: p };
  });
  operand.push({ type: "array", value: { rows: 1, cols: pieces.length, cells: [cells] } });
};

SocialCalc.Formula.FunctionList["SPLIT"] = [
  SocialCalc.Formula.SplitFunction,
  -2,
  "split",
  "",
  "text",
];

/*
#
# TEXTSPLIT(text,col_delimiter,[row_delimiter],[ignore_empty],[match_mode],[pad_with])
#
# col_delimiter/row_delimiter are single literal (possibly multi-character)
# separators, matched as one token (unlike SPLIT's per-character mode); no
# array-of-delimiters support (no array-constant syntax in this engine, same
# limitation as TEXTBEFORE/TEXTAFTER). ignore_empty (default FALSE) drops
# empty pieces from both axes. match_mode 0 = case-sensitive (default),
# nonzero = case-insensitive. pad_with (default #N/A, matching Excel) fills
# short rows so the result is a rectangular "array" for the spill layer.
#
*/

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.TextSplitFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  if (foperand.length > 6) {
    scf.FunctionArgsError(fname, operand);
    return;
  }

  var textOp = scf.OperandAsText(sheet, foperand);
  if (textOp.type.charAt(0) == "e") {
    operand.push({ type: textOp.type, value: 0 });
    return;
  }
  var colDelimOp = scf.OperandAsText(sheet, foperand);
  if (colDelimOp.type.charAt(0) == "e") {
    operand.push({ type: colDelimOp.type, value: 0 });
    return;
  }

  var rowDelim = "";
  if (foperand.length) {
    var rd = scf.OperandAsText(sheet, foperand);
    if (rd.type.charAt(0) == "e") {
      operand.push({ type: rd.type, value: 0 });
      return;
    }
    rowDelim = rd.value as string;
  }

  var ignoreEmpty = false;
  if (foperand.length) {
    var ie = scf.OperandAsNumber(sheet, foperand);
    if (ie.type.charAt(0) == "e") {
      operand.push({ type: ie.type, value: 0 });
      return;
    }
    ignoreEmpty = ie.value != 0;
  }

  var matchMode = 0;
  if (foperand.length) {
    var mm = scf.OperandAsNumber(sheet, foperand);
    if (mm.type.charAt(0) == "e") {
      operand.push({ type: mm.type, value: 0 });
      return;
    }
    matchMode = mm.value ? 1 : 0;
  }

  var padValue: SocialCalc.FormulaOperand = { type: "e#N/A", value: 0 };
  if (foperand.length) {
    var pv = scf.OperandValueAndType(sheet, foperand);
    if (pv.type.charAt(0) == "e") {
      operand.push({ type: pv.type, value: 0 });
      return;
    }
    padValue = { type: pv.type, value: pv.value };
  }

  var text = textOp.value as string;
  var colDelim = colDelimOp.value as string;

  var splitOnce = function (s: string, delim: string): string[] {
    if (delim.length == 0) return [s];
    var hay = matchMode ? s.toLowerCase() : s;
    var needle = matchMode ? delim.toLowerCase() : delim;
    var pieces: string[] = [];
    var pos = 0;
    while (true) {
      var idx = hay.indexOf(needle, pos);
      if (idx < 0) {
        pieces.push(s.substring(pos));
        break;
      }
      pieces.push(s.substring(pos, idx));
      pos = idx + delim.length;
    }
    return pieces;
  };

  var rowsRaw = rowDelim.length ? splitOnce(text, rowDelim) : [text];
  var grid: string[][] = rowsRaw.map(function (r) {
    return splitOnce(r, colDelim);
  });

  if (ignoreEmpty) {
    grid = grid
      .map(function (row) {
        return row.filter(function (c) {
          return c.length > 0;
        });
      })
      .filter(function (row) {
        return row.length > 0;
      });
    if (!grid.length) grid = [[""]];
  }

  var maxCols = 0;
  for (var ri = 0; ri < grid.length; ri++) maxCols = Math.max(maxCols, grid[ri]!.length);

  var cells: SocialCalc.FormulaArrayCell[][] = grid.map(function (row) {
    var out: SocialCalc.FormulaArrayCell[] = [];
    for (var c = 0; c < maxCols; c++) {
      out.push(
        c < row.length
          ? { type: "t", value: row[c] }
          : { type: padValue.type, value: padValue.value },
      );
    }
    return out;
  });

  operand.push({ type: "array", value: { rows: cells.length, cols: maxCols, cells: cells } });
};

SocialCalc.Formula.FunctionList["TEXTSPLIT"] = [
  SocialCalc.Formula.TextSplitFunction,
  -2,
  "textsplit",
  "",
  "text",
];

/*
#
# REGEXMATCH(text,regular_expression)
# REGEXEXTRACT(text,regular_expression)
# REGEXREPLACE(text,regular_expression,replacement)
#
# Uses JavaScript RegExp directly (this engine has no RE2 implementation);
# an invalid pattern (RegExp constructor throw) is a deterministic compile
# failure reported as #VALUE!, matching the task's "reject invalid patterns"
# requirement. REGEXMATCH does an unanchored substring test (RE2's default
# partial-match semantics, same as an unanchored JS RegExp.test). REGEXEXTRACT
# returns the first capturing group when the pattern has exactly one group,
# the whole match when it has none, or spills the groups across one row when
# it has two or more (mirrors Sheets' documented "extracts the first
# capturing group" rule for the single-group case, extended consistently via
# this engine's existing array-spill path for the multi-group case); no match
# is #N/A. REGEXREPLACE replaces every non-overlapping match (Sheets replaces
# all matches) and translates Sheets/RE2 `\1`.."\9"` backreferences in
# replacement into JS's `$1`.."$9"` (a literal `$` in replacement is escaped
# to `$$` so it is never misread as a JS replacement token, and `\\` is a
# literal backslash).
#
*/

/**
 * @param {string} pattern
 * @param {string} flags
 */
FormulaMut.CompileRegex = function (pattern, flags) {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
};

/** @param {string} repl */
FormulaMut.TranslateRegexReplacement = function (repl) {
  var out = "";
  for (var i = 0; i < repl.length; i++) {
    var ch = repl.charAt(i);
    if (ch == "$") {
      out += "$$";
      continue;
    }
    if (ch == "\\") {
      var next = repl.charAt(i + 1);
      if (next == "\\") {
        out += "\\";
        i++;
        continue;
      }
      if (next >= "1" && next <= "9") {
        out += "$" + next;
        i++;
        continue;
      }
      out += "\\"; // lone/unsupported escape: keep literal backslash
      continue;
    }
    out += ch;
  }
  return out;
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.RegexMatchFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var textOp = scf.OperandAsText(sheet, foperand);
  if (textOp.type.charAt(0) == "e") {
    operand.push({ type: textOp.type, value: 0 });
    return;
  }
  var patOp = scf.OperandAsText(sheet, foperand);
  if (patOp.type.charAt(0) == "e") {
    operand.push({ type: patOp.type, value: 0 });
    return;
  }

  var re = scf.CompileRegex(patOp.value as string, "");
  if (!re) {
    operand.push({ type: "e#VALUE!", value: 0 });
    return;
  }

  operand.push({ type: "nl", value: re.test(textOp.value as string) ? 1 : 0 });
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.RegexExtractFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var textOp = scf.OperandAsText(sheet, foperand);
  if (textOp.type.charAt(0) == "e") {
    operand.push({ type: textOp.type, value: 0 });
    return;
  }
  var patOp = scf.OperandAsText(sheet, foperand);
  if (patOp.type.charAt(0) == "e") {
    operand.push({ type: patOp.type, value: 0 });
    return;
  }

  var re = scf.CompileRegex(patOp.value as string, "");
  if (!re) {
    operand.push({ type: "e#VALUE!", value: 0 });
    return;
  }

  var m = re.exec(textOp.value as string);
  if (!m) {
    operand.push({ type: "e#N/A", value: 0 });
    return;
  }

  var groups = m.length - 1;
  if (groups <= 1) {
    var text = groups == 1 ? m[1] || "" : m[0];
    scf.PushOperand(operand, "t", text);
    return;
  }

  var cells: SocialCalc.FormulaArrayCell[] = [];
  for (var g = 1; g <= groups; g++) cells.push({ type: "t", value: m[g] || "" });
  operand.push({ type: "array", value: { rows: 1, cols: groups, cells: [cells] } });
};

/**
 * @param {string} fname
 * @param {any[]} operand
 * @param {any[]} foperand
 * @param {any} sheet
 */
FormulaMut.RegexReplaceFunction = function (fname, operand, foperand, sheet) {
  var scf = SocialCalc.Formula;

  var textOp = scf.OperandAsText(sheet, foperand);
  if (textOp.type.charAt(0) == "e") {
    operand.push({ type: textOp.type, value: 0 });
    return;
  }
  var patOp = scf.OperandAsText(sheet, foperand);
  if (patOp.type.charAt(0) == "e") {
    operand.push({ type: patOp.type, value: 0 });
    return;
  }
  var replOp = scf.OperandAsText(sheet, foperand);
  if (replOp.type.charAt(0) == "e") {
    operand.push({ type: replOp.type, value: 0 });
    return;
  }

  var re = scf.CompileRegex(patOp.value as string, "g");
  if (!re) {
    operand.push({ type: "e#VALUE!", value: 0 });
    return;
  }

  var jsReplacement = scf.TranslateRegexReplacement(replOp.value as string);
  var result = (textOp.value as string).replace(re, jsReplacement);
  scf.PushOperand(operand, "t", result);
};

SocialCalc.Formula.FunctionList["REGEXMATCH"] = [
  SocialCalc.Formula.RegexMatchFunction,
  2,
  "regexmatch",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["REGEXEXTRACT"] = [
  SocialCalc.Formula.RegexExtractFunction,
  2,
  "regexextract",
  "",
  "text",
];
SocialCalc.Formula.FunctionList["REGEXREPLACE"] = [
  SocialCalc.Formula.RegexReplaceFunction,
  3,
  "regexreplace",
  "",
  "text",
];
