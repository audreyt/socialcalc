import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

type Cell = { datavalue: unknown; valuetype: string; errors?: string };
type Operand = { type: string; value: unknown };

type FormulaSC = typeof globalThis.SocialCalc & {
  Formula: typeof globalThis.SocialCalc.Formula & Record<string, any>;
};

function resetFormulaGlobals(SC: typeof globalThis.SocialCalc) {
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

async function loadSC(): Promise<FormulaSC> {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  return SC;
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
  return { SC: SC as FormulaSC, sheet, getDV, getVT };
}

// ---------------------------------------------------------------------------
// 1. EvaluatePolish: <> (N operator) with numeric operands (L11377)
// ---------------------------------------------------------------------------

test("EvaluatePolish: <> numeric comparison produces 1 for different values (L11377)", async () => {
  const { getDV, getVT } = await buildSheet(["set A1 formula 1<>2"]);
  expect(getDV("A1")).toBe(1);
  expect(getVT("A1")).toBe("nl");
});

test("EvaluatePolish: <> numeric comparison produces 0 for equal values (L11377)", async () => {
  const { getDV, getVT } = await buildSheet(["set A1 formula 5<>5"]);
  expect(getDV("A1")).toBe(0);
  expect(getVT("A1")).toBe("nl");
});

// ---------------------------------------------------------------------------
// 2. EvaluatePolish: <> (N operator) with text operands (L11411)
// ---------------------------------------------------------------------------

test("EvaluatePolish: <> text comparison produces 1 for different strings (L11411)", async () => {
  const { getDV, getVT } = await buildSheet(['set A1 formula "a"<>"b"']);
  expect(getDV("A1")).toBe(1);
  expect(getVT("A1")).toBe("nl");
});

test("EvaluatePolish: <> text comparison produces 0 for equal strings (L11411)", async () => {
  const { getDV, getVT } = await buildSheet(['set A1 formula "x"<>"x"']);
  expect(getDV("A1")).toBe(0);
  expect(getVT("A1")).toBe("nl");
});

// ---------------------------------------------------------------------------
// 3. EvaluatePolish: name-colon path with non-start on operand stack (L11462 branch 1)
//    The parser always pushes function_start (-1) before name tokens, so the
//    "start" operand is always on top when a name is evaluated in colon context.
//    Branch 1 (false: operand empty or top != "start") is only reachable via
//    direct dispatch to EvaluatePolish with a hand-crafted revpolish that has
//    a name token adjacent to ":" WITHOUT a preceding function_start.
// ---------------------------------------------------------------------------

test("EvaluatePolish: name-colon without start on stack via direct dispatch (L11462 branch 1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  // Craft a parseinfo (tokens) and revpolish (indices) where:
  // [0] = coord A1 (type 2), [1] = name MYNAME (type 4), [2] = op ":" (type 3)
  // revpolish = [0, 1, 2] — no function_start (-1) before the name.
  // When MYNAME is evaluated, operand stack has [coord:A1] on top (not "start").
  const tokens = [
    { text: "A1", type: 2 as const, opcode: 0 },
    { text: "MYNAME", type: 4 as const, opcode: 0 },
    { text: ":", type: 3 as const, opcode: ":" as const },
  ] as any;
  const revpolish = [0, 1, 2];
  const result = SC.Formula.EvaluatePolish(tokens, revpolish, sheet, false);
  // The name-colon path fires but the name can't be resolved as a range
  // → error result. The important thing is that L11462 branch 1 was exercised.
  expect(result.type).toMatch(/^e#/);
});

// ---------------------------------------------------------------------------
// 4. EvaluatePolish: error type with empty substring fallback (L11498 branch 2)
//    `errortext = errortext || tostype.substring(1) || scc.s_calcerrerrorvalueinformula`
//    A coord operand preserves the referenced cell's valuetype verbatim
//    (formula-operand.ts operand_value_and_type: `result.type = cellvtype || "b"`).
//    EvaluatePolish itself can leave a cell's valuetype as the bare string
//    "e" (not "e#..."): when errortext is set but valuetype doesn't already
//    start with "e", it force-sets `valuetype = "e"` (formula1.ts ~578-581).
//    Referencing such a cell makes tostype = "e", so tostype.substring(1)
//    is "" (falsy) and errortext is also falsy (no error path fired for a
//    single coord token) → falls through to the generic fallback message.
// ---------------------------------------------------------------------------

test("EvaluatePolish: coord referencing a cell with bare 'e' valuetype hits generic fallback (L11498 branch 2)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const cellA1 = sheet.GetAssuredCell("A1");
  // Simulate the exact state formula1.ts:578-581 can leave a cell in:
  // valuetype is bare "e", not an "e#CODE!" string.
  cellA1.datatype = "v";
  cellA1.valuetype = "e";
  cellA1.datavalue = "";
  const parseinfo = SC.Formula.ParseFormulaIntoTokens("A1");
  const result = SC.Formula.evaluate_parsed_formula(parseinfo, sheet, false);
  expect(result.type).toBe("e");
  expect(result.error).toBe(SC.Constants.s_calcerrerrorvalueinformula);
});

// ---------------------------------------------------------------------------
// 5. EvaluatePolish: NaN vs overflow error message selection (L11519-ish)
//    BUG (fixed in this change): `value` was reset to 0 BEFORE the
//    `isNaN(value)` ternary that picks the error message, so every
//    NaN/Infinity overflow case reported s_calcerrnumericoverflow even when
//    the underlying computation was genuinely NaN (not Infinity). Fixed by
//    capturing `wasnan = isNaN(value)` before the reset. Cover both branches.
// ---------------------------------------------------------------------------

test("EvaluatePolish: genuine NaN (Infinity-Infinity) reports the NaN message, not overflow", async () => {
  const { getVT, sheet, SC } = await buildSheet(["set A1 formula (1e308*10)-(1e308*10)"]);
  expect(getVT("A1")).toBe("e#NUM!");
  const nanCell = sheet.GetAssuredCell("A1") as Cell;
  expect(nanCell.errors).toBe(SC.Constants.s_calcerrnumericnan);
});

test("EvaluatePolish: genuine overflow (no NaN) still reports the overflow message", async () => {
  const { getVT, sheet, SC } = await buildSheet(["set A1 formula 1e308*10"]);
  expect(getVT("A1")).toBe("e#NUM!");
  const overflowCell = sheet.GetAssuredCell("A1") as Cell;
  expect(overflowCell.errors).toBe(SC.Constants.s_calcerrnumericoverflow);
});

// ---------------------------------------------------------------------------
// 6. FunctionList init guard (L11637 branch 1)
//    UNREACHABLE: SocialCalc.Formula = {} is created at L11062 in the UMD
//    factory, so FunctionList is always undefined → alt0 always taken.
//    See analysis in formula1-coverage-gaps-2a.test.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 7. StoreIoEventFormula: Input path where value already matches (L11736 branch 1)
//    When the form data sheet already has the same value at the value coord,
//    no command is scheduled.
// ---------------------------------------------------------------------------

test("StoreIoEventFormula: Input with matching value skips scheduling (L11736 branch 1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const formDataSheet = new SC.Sheet();
  const savedControl = SC.CurrentSpreadsheetControlObject;

  // Pre-populate the form data sheet with the same value at C2
  // (formFields['textboxa1'] = 3 → col C, row 2 → C2)
  await scheduleCommands(SC, formDataSheet, ["set C2 text t hello"], true, 4000);

  SC.CurrentSpreadsheetControlObject = {
    formDataViewer: {
      loaded: true,
      formFields: { textboxa1: 3 },
      formFieldsLength: 1,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetControlObject;

  const scheduledCmds: string[] = [];
  formDataSheet.ScheduleSheetCommands = function (cmd: string) {
    scheduledCmds.push(cmd);
  } as unknown as typeof formDataSheet.ScheduleSheetCommands;

  const operandReverse: Operand[] = [{ type: "t", value: "hello" }];
  SC.Formula.StoreIoEventFormula("TEXTBOX", "A1", operandReverse, sheet, "Input");

  // Value matches → no command scheduled
  expect(scheduledCmds.length).toBe(0);

  SC.CurrentSpreadsheetControlObject = savedControl;
});

// ---------------------------------------------------------------------------
// 8. DBFunction: TestCriteria returns false → continue CRITERIAROW (L12142 branch 1)
//    When a row's cell value doesn't match the criteria, TestCriteria returns
//    false and the inner loop continues to the next criteria row.
// ---------------------------------------------------------------------------

test("DBFunction: row failing criteria triggers TestCriteria false (L12142)", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t Name",
    "set A2 text t Alice",
    "set A3 text t Bob",
    "set B1 text t Num",
    "set B2 value 10",
    "set B3 value 20",
    "set C1 text t Name",
    "set C2 text t Alice",
    'set D1 formula DSUM(A1:B3, "Num", C1:C2)',
  ]);
  // Only Alice's row matches → DSUM = 10
  expect(getDV("D1")).toBe(10);
});

// ---------------------------------------------------------------------------
// 9. LookupFunctions: blank cell valuetype → "b" fallback (L12390 branch 1)
//    When a cell in the lookup range has falsy valuetype, the ternary
//    `cell.valuetype ? cell.valuetype.charAt(0) : "b"` takes the false branch.
// ---------------------------------------------------------------------------

test("LookupFunctions: blank cell in range uses 'b' valuetype fallback (L12390)", async () => {
  const { getDV, getVT } = await buildSheet([
    // A1 is blank (no set command) → valuetype is "" (falsy) → "b"
    "set A2 text t hello",
    "set B2 value 1",
    'set D1 formula VLOOKUP("hello", A1:B2, 2, FALSE)',
  ]);
  // VLOOKUP scans A1 (blank, valuetype "" → "b"), then A2 ("hello" → match)
  expect(getDV("D1")).toBe(1);
  expect(getVT("D1")).toBe("n");
});

// ---------------------------------------------------------------------------
// 10. LookupFunctions: rangelookup text overshoot sets previousOK (L12412, L12416)
//     In rangelookup mode with text values, when lookupvalue > value,
//     previousOK is set to 1. When the next value exceeds lookupvalue,
//     previousOK becomes 2 and breaks.
// ---------------------------------------------------------------------------

test("LookupFunctions: text rangelookup overshoot with previousOK (L12412, L12416)", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t apple",
    "set A2 text t banana",
    "set A3 text t cherry",
    "set B1 value 1",
    "set B2 value 2",
    "set B3 value 3",
    'set D1 formula VLOOKUP("blueberry", A1:B3, 2, TRUE)',
  ]);
  // blueberry > apple (previousOK=1), > banana (previousOK=1),
  // < cherry → overshoot → previousOK=2 → returns banana row → B2 = 2
  expect(getDV("D1")).toBe(2);
});

// ---------------------------------------------------------------------------
// 11. LookupFunctions: non-rangelookup text comparison (L12427)
//     L12427: value = typeof value == "string" ? value.toLowerCase() : ""
//     Branch 1 (false: value is not a string) is UNREACHABLE in normal formula
//     evaluation because text cells always have string datavalues.
//     See analysis: all text-producing operations (T(), &, TEXT(), etc.)
//     produce string values, so cell.datavalue is always a string when
//     valuetype is "t".
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 12. HMSFunctions: positive datetime value (L12790 branch 1)
//     `seconds = Math.floor(fraction + (datetime.value >= 0 ? 0.5 : -0.5))`
//     The `datetime.value >= 0` true branch (adding +0.5) fires for positive values.
// ---------------------------------------------------------------------------

test("HMSFunctions: HOUR with positive datetime exercises >= 0 branch (L12790)", async () => {
  const { getDV, getVT } = await buildSheet(["set A1 formula HOUR(0.5)"]);
  // 0.5 days = 12:00:00 → HOUR = 12
  expect(getDV("A1")).toBe(12);
  expect(getVT("A1")).toBe("n");
});

test("HMSFunctions: SECOND with positive datetime exercises >= 0 branch (L12790)", async () => {
  const { getDV } = await buildSheet([
    // 0.0001 days ≈ 8.64 seconds → SECOND = 9 (with +0.5 rounding)
    "set A1 formula SECOND(0.0001)",
  ]);
  expect(getDV("A1")).toBe(9);
});

// ---------------------------------------------------------------------------
// 13. ExactFunction: error in second arg when first is text (L12820)
// ---------------------------------------------------------------------------

test("ExactFunction: error in v2 when v1 is text (L12820)", async () => {
  const { getVT } = await buildSheet(['set A1 formula EXACT("a", 1/0)']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// 14. ExactFunction: error in second arg when first is numeric (L12831)
// ---------------------------------------------------------------------------

test("ExactFunction: error in v2 when v1 is numeric (L12831)", async () => {
  const { getVT } = await buildSheet(["set A1 formula EXACT(1, 1/0)"]);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// 15. ExactFunction: error in second arg when first is blank (L12842)
// ---------------------------------------------------------------------------

test("ExactFunction: error in v2 when v1 is blank (L12842)", async () => {
  const { getVT } = await buildSheet([
    // A2 is blank → v1type = "b"
    "set A1 formula EXACT(A2, 1/0)",
  ]);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// 16. ExactFunction: error in first arg (L12846)
// ---------------------------------------------------------------------------

test("ExactFunction: error in v1 (L12846)", async () => {
  const { getVT } = await buildSheet(['set A1 formula EXACT(1/0, "a")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// 17. IsFunctions: ISERR with non-#N/A error (L13063 branch 1)
//     `result = t == "e" ? value.type == "e#N/A" ? 0 : 1 : 0`
//     The inner branch 1 (value.type != "e#N/A" → 1) fires for errors like #DIV/0!.
// ---------------------------------------------------------------------------

test("IsFunctions: ISERR with #DIV/0! returns 1 (L13063)", async () => {
  const { getDV, getVT } = await buildSheet(["set A1 formula ISERR(1/0)"]);
  // 1/0 → e#DIV/0! which is not e#N/A → ISERR returns 1
  expect(getDV("A1")).toBe(1);
  expect(getVT("A1")).toBe("nl");
});

test("IsFunctions: ISERR with #VALUE! returns 1 (L13063)", async () => {
  const { getDV } = await buildSheet(['set A1 formula ISERR("a"+1)']);
  // "a"+1 → e#VALUE! which is not e#N/A → ISERR returns 1
  expect(getDV("A1")).toBe(1);
});

// ---------------------------------------------------------------------------
// 18. NPVFunction: numeric cashflow sets resulttype (L13870 branch 1)
//     `if (value1.type.charAt(0) == "n")` → true branch
//     When a cashflow value is numeric, resulttypenpv is updated via LookupResultType.
// ---------------------------------------------------------------------------

test("NPVFunction: numeric cashflow updates resulttype (L13870)", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value 0.1",
    "set A2 value 100",
    "set A3 value 200",
    "set B1 formula NPV(A1, A2, A3)",
  ]);
  // NPV with numeric cashflows → result type "n$" (currency)
  expect(getDV("B1")).toBeCloseTo(256.198, 1);
  expect(getVT("B1")).toBe("n$");
});

// ---------------------------------------------------------------------------
// 19. IRRFunction: error in cashflow range (L5066)
//     `else if (value1.type.charAt(0) == "e")` → pushes e#VALUE!
// ---------------------------------------------------------------------------

test("IRRFunction: error in cashflow range produces e#VALUE! (L5066)", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula IRR(B1:B3)",
    "set B1 value 1",
    "set B2 formula NA()",
    "set B3 value 3",
  ]);
  expect(getVT("A1")).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// 20. Comparison operators N (<>) numeric and text (L575, L612)
// ---------------------------------------------------------------------------

test("EvaluatePolish: numeric N (<>) comparison branch (L575)", async () => {
  const { getDV } = await buildSheet(["set A1 formula 5<>3", "set A2 formula 5<>5"]);
  expect(getDV("A1")).toBe(1);
  expect(getDV("A2")).toBe(0);
});

test("EvaluatePolish: text N (<>) comparison branch (L612)", async () => {
  const { getDV } = await buildSheet([
    'set A1 formula "hello"<>"world"',
    'set A2 formula "hello"<>"hello"',
  ]);
  expect(getDV("A1")).toBe(1);
  expect(getDV("A2")).toBe(0);
});

// ---------------------------------------------------------------------------
// 21. TestCriteria fail in D-function loop (L2108)
// ---------------------------------------------------------------------------

test("DSeriesFunctions: TestCriteria mismatch continue CRITERIAROW (L2108)", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t Name",
    "set A2 text t Alice",
    "set A3 text t Bob",
    "set B1 text t Num",
    "set B2 value 10",
    "set B3 value 20",
    "set C1 text t Name",
    "set C2 text t Alice",
    'set D1 formula DCOUNT(A1:B3, "Num", C1:C2)',
  ]);
  // Alice matches criteria, Bob fails criteria and hits L2108 (continue CRITERIAROW)
  expect(getDV("D1")).toBe(1);
});

// ---------------------------------------------------------------------------
// 22. MATCH/VLOOKUP approximate lookup overshoot & descending (L2536, L2543)
// ---------------------------------------------------------------------------

test("LookupFunctions: text rangelookup descending overshoot (L2536)", async () => {
  const { getDV } = await buildSheet([
    "set B1 text t C",
    "set B2 text t B",
    "set B3 text t A",
    'set A1 formula MATCH("B", B1:B3, -1)',
  ]);
  // Descending range {"C", "B", "A"}, looking for "B" with -1 (descending approximate)
  // "B" < "C" is true, enters L2536 descending branch
  expect(getDV("A1")).toBe(2);
});

test("LookupFunctions: text rangelookup previousOK=2 break and instant overshoot (L2543)", async () => {
  const { getDV } = await buildSheet([
    "set B1 text t A",
    "set B2 text t B",
    "set B3 text t D",
    'set A1 formula MATCH("C", B1:B3, 1)',
    "set C1 text t B",
    "set C2 text t C",
    "set C3 text t D",
    'set A2 formula MATCH("A", C1:C3, 1)',
  ]);
  // Ascending range {"A", "B", "D"}, looking for "C" with 1 (ascending approximate)
  // Matches "A" (OK), "B" (OK), then overshoots at "D" ("C" < "D"), previousOK becomes 2, breaks
  expect(getDV("A1")).toBe(2); // matches "B" (index 2)

  // Instant overshoot: looking for "A" in {"B", "C", "D"}. first cell is "B" and "A" < "B",
  // previousOK is falsy, hits L2543 false arm.
  expect(getDV("A2")).toBe(0); // returns e#N/A (0)
});

// ---------------------------------------------------------------------------
// 23. ExactFunction error arguments (L3280, L3291, L3302, L3306)
// ---------------------------------------------------------------------------

test("ExactFunction: propagates errors in arguments (L3280, L3291, L3302, L3306)", async () => {
  const { getVT } = await buildSheet([
    'set A1 formula EXACT(NA(), "hello")', // v1type == "e" (L3306)
    'set A2 formula EXACT("hello", NA())', // v1type == "t", v2type == "e" (L3280)
    "set A3 formula EXACT(5, NA())", // v1type == "n", v2type == "e" (L3291)
    "set A4 formula EXACT(C99, NA())", // v1type == "b", v2type == "e" (L3302) (C99 is blank)
  ]);
  expect(getVT("A1")).toBe("e#N/A");
  expect(getVT("A2")).toBe("e#N/A");
  expect(getVT("A3")).toBe("e#N/A");
  expect(getVT("A4")).toBe("e#N/A");
});

test("DSeriesFunctions: blank valuetype criteria cell uses b fallback in row test (L2108)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Name",
    "set B1 text t Num",
    "set A2 text t Alice",
    "set B2 value n 10",
    "set A3 text t Bob",
    "set B3 value n 20",
    "set C1 text t Name",
    "set C2 text t Alice",
  ]);
  const aliceCell = sheet.GetAssuredCell("A2") as Cell;
  aliceCell.valuetype = "";

  const operand: Operand[] = [];
  const foperand: Operand[] = [
    { type: "range", value: "C1|C2|" },
    { type: "t", value: "Num" },
    { type: "range", value: "A1|B3|" },
  ];
  SC.Formula.DSeriesFunctions("DSUM", operand, foperand, sheet);

  expect(operand[0]).toMatchObject({ type: "n", value: 10 });
});

test("LookupFunctions: mutated blank and text cells cover fallback comparisons", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t ignored",
    "set B1 value n 9",
    "set A2 text t hello",
    "set B2 value n 1",
    "set D1 text t ignored",
    "set E1 value n 8",
    "set D2 text t m",
    "set E2 value n 7",
  ]);

  const blankTypedCell = sheet.GetAssuredCell("A1") as Cell;
  blankTypedCell.valuetype = "";
  let parsed = SC.Formula.ParseFormulaIntoTokens('VLOOKUP("hello", A1:B2, 2, FALSE)');
  let result = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
  expect(result).toMatchObject({ type: "n", value: 1 });

  const exactNonString = sheet.GetAssuredCell("A1") as Cell;
  exactNonString.valuetype = "t";
  exactNonString.datavalue = 0;
  parsed = SC.Formula.ParseFormulaIntoTokens('VLOOKUP("hello", A1:B2, 2, FALSE)');
  result = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
  expect(result).toMatchObject({ type: "n", value: 1 });

  const rangeNonString = sheet.GetAssuredCell("D1") as Cell;
  rangeNonString.valuetype = "t";
  rangeNonString.datavalue = 0;
  parsed = SC.Formula.ParseFormulaIntoTokens('VLOOKUP("z", D1:E2, 2, TRUE)');
  result = SC.Formula.evaluate_parsed_formula(parsed, sheet, false);
  expect(result).toMatchObject({ type: "n", value: 7 });
});

test("ExactFunction: direct operands propagate error-typed branches", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const cases: Array<{ operands: Operand[]; expected: string }> = [
    {
      operands: [
        { type: "e#N/A", value: 0 },
        { type: "t", value: "hello" },
      ],
      expected: "e#N/A",
    },
    {
      operands: [
        { type: "e#DIV/0!", value: 0 },
        { type: "n", value: 5 },
      ],
      expected: "e#DIV/0!",
    },
    {
      operands: [
        { type: "e#VALUE!", value: 0 },
        { type: "b", value: 0 },
      ],
      expected: "e#VALUE!",
    },
    {
      operands: [
        { type: "t", value: "hello" },
        { type: "e#REF!", value: 0 },
      ],
      expected: "e#REF!",
    },
  ];

  for (const item of cases) {
    const operand: Operand[] = [];
    SC.Formula.ExactFunction("EXACT", operand, [...item.operands], sheet);
    expect(operand[0].type).toBe(item.expected);
  }
});

test("ExactFunction: unsupported direct operand types fall through as logical false", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const cases: Operand[][] = [
    [
      { type: "x", value: "ignored" },
      { type: "t", value: "hello" },
    ],
    [
      { type: "x", value: "ignored" },
      { type: "n", value: 5 },
    ],
    [
      { type: "x", value: "ignored" },
      { type: "b", value: 0 },
    ],
    [
      { type: "x", value: "ignored" },
      { type: "x", value: "also-ignored" },
    ],
  ];

  for (const operands of cases) {
    const operand: Operand[] = [];
    SC.Formula.ExactFunction("EXACT", operand, [...operands], sheet);
    expect(operand[0]).toMatchObject({ type: "nl", value: 0 });
  }
});

test("IRRFunction: unsupported cashflow type falls through to e#NUM!", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const cell = sheet.GetAssuredCell("A1") as Cell;
  cell.valuetype = "x";
  cell.datavalue = "not-a-cashflow";

  const operand: Operand[] = [];
  SC.Formula.IRRFunction("IRR", operand, [{ type: "range", value: "A1|A1|" }], sheet);
  expect(operand[0]).toMatchObject({ type: "e#NUM!", value: 0 });
});

// ---------------------------------------------------------------------------
// 24. ISERR vs ISERROR family with #N/A vs other (L3650)
// ---------------------------------------------------------------------------

test("IsFunctions: ISERR handles NA vs other errors differently (L3650)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula ISERR(NA())", // ISERR(#N/A) -> false (0)
    "set A2 formula ISERR(1/0)", // ISERR(#DIV/0!) -> true (1)
    "set B1 formula ISERROR(NA())", // ISERROR(#N/A) -> true (1)
    "set B2 formula ISERR(5)", // ISERR(5) -> false (0) (L3650 non-error arm)
    'set B3 formula ISERR("hi")', // ISERR("hi") -> false (0)
  ]);
  expect(getDV("A1")).toBe(0);
  expect(getDV("A2")).toBe(1);
  expect(getDV("B1")).toBe(1);
  expect(getDV("B2")).toBe(0);
  expect(getDV("B3")).toBe(0);
});
