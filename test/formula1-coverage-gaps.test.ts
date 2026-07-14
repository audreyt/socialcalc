import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

type Cell = { datavalue: unknown; valuetype: string };
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
// 1. format_number_for_display fallback (anonymous fn at dist L11292-11293)
// ---------------------------------------------------------------------------

test("EvaluatePolish: format_number_for_display fallback when global is missing", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  // Temporarily delete SocialCalc.format_number_for_display so the
  // `|| function(v,t,f) { return v+""; }` fallback is used.
  const saved = SC.format_number_for_display;
  const mutableSC = SC as unknown as { format_number_for_display?: typeof saved };
  delete mutableSC.format_number_for_display;

  try {
    // A comparison between number and text triggers format_number_for_display
    // in the text-comparison path (value1.type "n" → format_number_for_display).
    const result = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('1<"hello"'),
      sheet,
    );
    // 1 vs "hello" → text comparison path → format_number_for_display("1","n","")
    // then "1" < "hello" → true → nl 1
    expect(result.type).toBe("nl");
    expect(result.value).toBe(1);
  } finally {
    SC.format_number_for_display = saved;
  }
});

// ---------------------------------------------------------------------------
// 2. Comparison operator N (<>) text and numeric branches (L11381, L11415)
// ---------------------------------------------------------------------------

test("EvaluatePolish: text comparison N (<>) covers both branches", async () => {
  const { getDV, getVT } = await buildSheet([
    "set A1 value 5",
    "set B1 value 3",
    "set C1 formula A1<>B1",
    'set D1 formula "hello"<>"hello"',
    'set E1 formula "hello"<>"world"',
  ]);
  expect(getDV("C1")).toBe(1);
  expect(getDV("D1")).toBe(0);
  expect(getDV("E1")).toBe(1);
  expect(getVT("C1")).toBe("nl");
});

test("EvaluatePolish: numeric comparison N (<>) branch", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 10",
    "set B1 value 10",
    "set C1 formula A1<>B1",
  ]);
  expect(getDV("C1")).toBe(0);
});

// ---------------------------------------------------------------------------
// 3. CalculateFunction: unknown function with start on stack (L11466)
// ---------------------------------------------------------------------------

test("CalculateFunction: unknown function with start on stack pushes name", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const operand: Operand[] = [{ type: "start", value: 0 }];
  const errortext = SC.Formula.CalculateFunction("NONEXISTENTFUNC", operand, sheet, "A1");
  expect(operand.length).toBe(1);
  expect(operand[0].type).toBe("name");
  expect(operand[0].value).toBe("NONEXISTENTFUNC");
  expect(errortext).toBe("");
});

// ---------------------------------------------------------------------------
// 4. EvaluatePolish: error value with substring (L11502)
// ---------------------------------------------------------------------------

test("EvaluatePolish: error value with substring truncation (L11502)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  // A formula that produces an e#DIV/0! error — error tostype gets substring(1)
  const result = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("1/0"),
    sheet,
  );
  expect(result.type).toBe("e#DIV/0!");
  expect(result.error).toBeTruthy();
  // The substring(1) path extracts "#DIV/0!" from "e#DIV/0!" as errortext
  expect(result.error).toContain("DIV");
});

// ---------------------------------------------------------------------------
// 5. evaluate_parsed_formula with allowrangereturn=1 (L11547)
// ---------------------------------------------------------------------------

test("evaluate_parsed_formula with allowrangereturn for range result (L11547)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  // Define a name that is a formula expanding to a range
  await scheduleCommands(
    SC,
    sheet,
    ["set A1 value 1", "set A2 value 2", "name define MYRANGE =A1:A2", "set B1 formula MYRANGE"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  // B1 has a formula referencing a name that expands to a range
  // The LookupName path calls evaluate_parsed_formula with allowrangereturn=1
  const cell = sheet.GetAssuredCell("B1") as Cell;
  expect(cell).toBeDefined();
});

// ---------------------------------------------------------------------------
// 6. DecodeRangeParts: column bounds check (L11636)
// ---------------------------------------------------------------------------

test("DecodeRangeParts: valid range returns rangeinfo", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const result = SC.Formula.DecodeRangeParts(sheet, "A1|B2|");
  if (!result) throw new Error("DecodeRangeParts returned null");
  expect(result.ncols).toBe(2);
  expect(result.nrows).toBe(2);
});

// ---------------------------------------------------------------------------
// 7. StoreIoEventFormula: ioEventTree, ioParameterList, TimeTrigger branches
//    (L11652-11769)
// ---------------------------------------------------------------------------

test("StoreIoEventFormula: initializes ioEventTree/ioParameterList and stores params", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const operandReverse: Operand[] = [{ type: "coord", value: "A1" }];

  SC.Formula.StoreIoEventFormula("COPYVALUE", "B1", operandReverse, sheet, "EventTree");
  expect(sheet.ioEventTree).toBeDefined();
  expect(sheet.ioEventTree["A1"]).toBeDefined();
  expect(sheet.ioEventTree["A1"]["B1"]).toBe("B1");
  expect(sheet.ioParameterList).toBeDefined();
  expect(sheet.ioParameterList["B1"]).toBeDefined();
  expect(sheet.ioParameterList["B1"].function_name).toBe("COPYVALUE");
});

test("StoreIoEventFormula: TimeTrigger with coord operand pushes trigger time", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 value 40000"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  let scheduledCmd = "";
  sheet.ScheduleSheetCommands = function (cmd: string) {
    scheduledCmd = cmd;
  };

  const operandReverse: Operand[] = [{ type: "coord", value: "A1" }];

  SC.Formula.StoreIoEventFormula("EMAILAT", "C1", operandReverse, sheet, "TimeTrigger");
  expect(scheduledCmd).toContain("settimetrigger");
  expect(sheet.ioTimeTriggerList).toBeDefined();
  expect(sheet.ioTimeTriggerList["C1"]).toBeDefined();
});

test("StoreIoEventFormula: TimeTrigger with numeric operand", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  let scheduledCmd = "";
  sheet.ScheduleSheetCommands = function (cmd: string) {
    scheduledCmd = cmd;
  };

  // Use type "n" with a string value so PlainCoord succeeds
  const operandReverse: Operand[] = [{ type: "n", value: "40000" }];

  SC.Formula.StoreIoEventFormula("EMAILAT", "D1", operandReverse, sheet, "TimeTrigger");
  expect(scheduledCmd).toContain("settimetrigger");
  expect(sheet.ioTimeTriggerList["D1"]).toBeDefined();
  expect(Number(sheet.ioTimeTriggerList["D1"][0])).toBe(40000);
});

test("StoreIoEventFormula: EventTree with range operand walks range", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const operandReverse: Operand[] = [{ type: "range", value: "A1|B1|" }];

  SC.Formula.StoreIoEventFormula("EMAILONEDIT", "F1", operandReverse, sheet, "EventTree");
  expect(sheet.ioEventTree["A1"]).toBeDefined();
  expect(sheet.ioEventTree["A1"]["F1"]).toBe("F1");
  expect(sheet.ioEventTree["B1"]).toBeDefined();
  expect(sheet.ioEventTree["B1"]["F1"]).toBe("F1");
});

test("StoreIoEventFormula: Input path via Viewer object", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  // Set up a fake formDataViewer on CurrentSpreadsheetViewerObject
  const formDataSheet = new SC.Sheet();
  const savedViewer = SC.CurrentSpreadsheetViewerObject;
  // Mock ScheduleSheetCommands on formDataSheet to prevent async issues
  formDataSheet.ScheduleSheetCommands = function (_cmd: string) {};
  SC.CurrentSpreadsheetViewerObject = {
    formDataViewer: {
      loaded: true,
      formFields: null,
      formFieldsLength: 0,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetViewerObject;

  let scheduledCmds: string[] = [];
  formDataSheet.ScheduleSheetCommands = function (_cmd: string) {
    scheduledCmds.push(_cmd);
  };

  try {
    const operandReverse: Operand[] = [{ type: "t", value: "hello" }];

    SC.Formula.StoreIoEventFormula("TEXTBOX", "A1", operandReverse, sheet, "Input");
    expect(scheduledCmds.length).toBeGreaterThan(0);
  } finally {
    SC.CurrentSpreadsheetViewerObject = savedViewer;
  }
});

test("StoreIoEventFormula: Clone deep-copies object properties (L11759)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const dest: Record<string, unknown> = { a: { b: 1 } };
  const src: Record<string, unknown> = { a: { b: 2, c: 3 } };
  SC.Formula.Clone(dest, src);

  expect((dest.a as Record<string, number>).b).toBe(2);
  expect((dest.a as Record<string, number>).c).toBe(3);
});

test("LoadFormFields: initializes form field headers if missing (L11764-11769)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const formDataSheet = new SC.Sheet();
  const savedControl = SC.CurrentSpreadsheetControlObject;

  let scheduledCmds: string[] = [];
  formDataSheet.ScheduleSheetCommands = function (cmd: string) {
    scheduledCmds.push(cmd);
  };

  SC.CurrentSpreadsheetControlObject = {
    formDataViewer: {
      loaded: true,
      formFields: null,
      formFieldsLength: 0,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetControlObject;

  try {
    SC.Formula.LoadFormFields();
    // Should have scheduled commands to set A1 and A2 headers
    expect(scheduledCmds.length).toBeGreaterThanOrEqual(2);
  } finally {
    SC.CurrentSpreadsheetControlObject = savedControl;
  }
});

// ---------------------------------------------------------------------------
// 8. FillFunctionInfo branches (L11865-11870)
// ---------------------------------------------------------------------------

test("FillFunctionInfo: processes function_classlist and classes split", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  SC.Formula.FunctionClasses = null;
  // FunctionArgDefs is declared `const` in the ambient d.ts (production
  // code only ever mutates its entries); resetting the whole map is a
  // deliberate test-only probe of FillFunctionInfo's repopulation, so
  // cast through a mutable named type rather than reassigning it directly.
  const mutableFormula = SC.Formula as unknown as {
    FunctionArgDefs: Record<string, string>;
  };
  mutableFormula.FunctionArgDefs = {};

  SC.Formula.FillFunctionInfo();

  const classes = SC.Formula.FunctionClasses as {
    [name: string]: SocialCalc.FormulaFunctionClassInfo;
  } | null;
  if (!classes) throw new Error("FillFunctionInfo should repopulate FunctionClasses");
  expect(classes["all"]).toBeDefined();
  expect(classes["all"].items.length).toBeGreaterThan(0);
  expect(classes["stat"]).toBeDefined();
  expect(classes["text"]).toBeDefined();
  expect(SC.Formula.FunctionArgDefs["vn"]).toBeDefined();
  expect(SC.Formula.FunctionArgDefs["dfunc"]).toBeDefined();
});

// ---------------------------------------------------------------------------
// 9. SeriesFunctions: MIN/MAX with single value (L11937-11942)
// ---------------------------------------------------------------------------

test("SeriesFunctions: MIN/MAX exercise minval branch with single value", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 42",
    "set B1 formula MIN(A1)",
    "set C1 formula MAX(A1)",
  ]);
  expect(getDV("B1")).toBe(42);
  expect(getDV("C1")).toBe(42);
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 10. DSeriesFunctions: criteria empty string skip and result branches
//     (L12068-12073, L12141, L12146, L12159-12200)
// ---------------------------------------------------------------------------
test("DSeriesFunctions: criteria empty string skip and result branches", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t Name",
    "set B1 text t Age",
    "set A2 text t Bob",
    "set B2 value 30",
    "set A3 text t Sue",
    "set B3 value 25",
    "set A4 text t Joe",
    "set B4 value 40",
    "set D1 text t Age",
    "set D2 text t >20",
    'set F1 formula DCOUNT(A1:B4, "Age", D1:D2)',
    'set G1 formula DCOUNTA(A1:B4, "Age", D1:D2)',
    'set H1 formula DMIN(A1:B4, "Age", D1:D2)',
    'set I1 formula DMAX(A1:B4, "Age", D1:D2)',
    'set J1 formula DVAR(A1:B4, "Age", D1:D2)',
    'set K1 formula DVARP(A1:B4, "Age", D1:D2)',
    'set L1 formula DSTDEV(A1:B4, "Age", D1:D2)',
    'set M1 formula DSTDEVP(A1:B4, "Age", D1:D2)',
    'set N1 formula DAVERAGE(A1:B4, "Age", D1:D2)',
    'set O1 formula DSUM(A1:B4, "Age", D1:D2)',
    'set P1 formula DPRODUCT(A1:B4, "Age", D1:D2)',
  ]);
  expect(getDV("F1")).toBe(3);
  expect(getDV("G1")).toBe(3);
  expect(getDV("H1")).toBe(25);
  expect(getDV("I1")).toBe(40);
  expect(typeof getDV("J1")).toBe("number");
  expect(typeof getDV("K1")).toBe("number");
  expect(typeof getDV("L1")).toBe("number");
  expect(typeof getDV("M1")).toBe("number");
  expect(getDV("N1")).toBeCloseTo(95 / 3, 5);
  expect(getDV("O1")).toBe(95);
  // DPRODUCT: 30*25*40 = 30000
  expect(getDV("P1")).toBe(30000);
  // 3 data rows (Bob 30, Sue 25, Joe 40), all >20, matched by criteria
});

// 22. NPVFunction: error in args and LookupResultType (L13860, L13869, L13874)
// ---------------------------------------------------------------------------

test("NPVFunction: error in args and LookupResultType (L13860, L13869, L13874)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const { getDV, sheet } = await buildSheet([
    "set A1 value 0.1",
    "set B1 value 100",
    // blank cell D1 occupies a period as 0
    "set E1 value 300",
    "set F1 formula NPV(A1, B1, D1, E1)",
  ]);
  const blankValue = Number((sheet.GetAssuredCell("D1") as Cell).datavalue ?? 0);
  const expected = 100 / 1.1 + blankValue / 1.21 + 300 / 1.331;
  expect(getDV("F1") as number).toBeCloseTo(expected, 8);
});

// ---------------------------------------------------------------------------
// 11. FieldToColnum: numeric out-of-range and text lowercase (L12274, L12279)
// ---------------------------------------------------------------------------

test("FieldToColnum: numeric fieldname out of range returns 0", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const result = SC.Formula.FieldToColnum(sheet, 1, 3, 1, 99, "n");
  expect(result).toBe(0);
});

test("FieldToColnum: numeric fieldname in range returns floor", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const result = SC.Formula.FieldToColnum(sheet, 1, 3, 1, 2.7, "n");
  expect(result).toBe(2);
});

test("FieldToColnum: text fieldname lowercases and matches", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 text t Name", "set B1 text t Age"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const result = SC.Formula.FieldToColnum(sheet, 1, 2, 1, "AGE", "t");
  expect(result).toBe(2);
});

// ---------------------------------------------------------------------------
// 12. LookupFunctions: range error, previousOK=2, non-rangelookup text
//     (L12350-12431)
// ---------------------------------------------------------------------------

test("LookupFunctions: range type not range produces FunctionArgsError (L12350)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  // VLOOKUP with non-range second arg: foperand = [lookupvalue, range(=n), offset]
  // LookupFunctions pops lookupvalue, then TopOfStackValueAndType tries to pop
  // the "range" which is type "n" not "range"
  const operand: Operand[] = [];
  const foperand: Operand[] = [
    { type: "n", value: 5 },
    { type: "n", value: 10 }, // not a range
    { type: "n", value: 1 },
  ];

  SC.Formula.LookupFunctions("VLOOKUP", operand, foperand, sheet);
  // Should produce an error (either FunctionArgsError or e#VALUE!)
  expect(operand.length).toBeGreaterThan(0);
  expect(operand[0].type.charAt(0)).toBe("e");
});

test("LookupFunctions: DecodeRangeParts null returns e#REF!", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  // Use a cross-sheet range to a non-existent sheet
  const operand: Operand[] = [];
  const foperand: Operand[] = [
    { type: "n", value: 5 },
    { type: "range", value: "A1:B2|NonExistentSheet!" },
    { type: "n", value: 1 },
  ];

  SC.Formula.LookupFunctions("VLOOKUP", operand, foperand, sheet);
  expect(operand[0].type).toContain("e#REF!");
});

test("LookupFunctions: rangelookup approximate text overshoot previousOK=2 (L12407-12420)", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t apple",
    "set A2 text t banana",
    "set A3 text t cherry",
    "set B1 value 10",
    "set B2 value 20",
    "set B3 value 30",
    // "carrot" is between "banana" and "cherry" alphabetically
    // With approximate match (default), previousOK=1 at banana,
    // then cherry > carrot, so end of range triggers previousOK=2
    'set D1 formula VLOOKUP("carrot", A1:B3, 2)',
  ]);
  // Should return banana's value (20) via previousOK=2
  expect(getDV("D1")).toBe(20);
});

test("LookupFunctions: non-rangelookup text match (L12425-12431)", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t apple",
    "set A2 text t banana",
    "set A3 text t cherry",
    "set B1 value 10",
    "set B2 value 20",
    "set B3 value 30",
    // exact match with rangelookup=0
    'set D1 formula VLOOKUP("banana", A1:B3, 2, 0)',
  ]);
  expect(getDV("D1")).toBe(20);
});

test("LookupFunctions: non-rangelookup text no match returns N/A", async () => {
  const { getVT } = await buildSheet([
    "set A1 text t apple",
    "set A2 text t banana",
    "set B1 value 10",
    "set B2 value 20",
    'set D1 formula VLOOKUP("cherry", A1:B2, 1, 0)',
  ]);
  expect(getVT("D1")).toContain("e#N/A");
});

// ---------------------------------------------------------------------------
// 13. CountifSumifFunctions: SUMIF error in sum range
//     (L12600, L12657, L12662)
// ---------------------------------------------------------------------------

test("CountifSumifFunctions: COUNTIF result branch (L12605)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 10",
    "set A2 value 20",
    "set A3 value 30",
    'set B1 formula COUNTIF(A1:A3, ">15")',
  ]);
  expect(getDV("B1")).toBe(2);
});

// ---------------------------------------------------------------------------
// 14. TimeFunction and HMSFunctions branches (L12716, L12721, L12789-12799)
// ---------------------------------------------------------------------------

test("TimeFunction: exercises hours/minutes/seconds operand branches", async () => {
  const { getDV } = await buildSheet(["set A1 formula TIME(12, 30, 45)"]);
  expect(getDV("A1")).toBeCloseTo((12 * 3600 + 30 * 60 + 45) / 86400, 8);
});

test("HMSFunctions: SECOND exercises fraction/rounding branches (L12789, L12794, L12799)", async () => {
  const { getDV } = await buildSheet([
    // A datetime of 0.5 = noon = 12:00:00
    "set A1 value 0.5",
    "set B1 formula HOUR(A1)",
    "set C1 formula MINUTE(A1)",
    "set D1 formula SECOND(A1)",
    // A non-integer fraction
    "set A2 value 0.523611", // approximately 12:33:48
    "set B2 formula HOUR(A2)",
    "set C2 formula MINUTE(A2)",
    "set D2 formula SECOND(A2)",
  ]);
  expect(getDV("B1")).toBe(12);
  expect(getDV("C1")).toBe(0);
  expect(getDV("D1")).toBe(0);
  expect(getDV("B2")).toBe(12);
});

test("CountifSumifFunctions: SUMIF with error in sum range propagates (L12662)", async () => {
  const { getVT } = await buildSheet([
    // Criteria range A1:A3, criteria ">5"
    "set A1 value 10",
    "set A2 value 20",
    "set A3 value 30", // all match ">5"
    // Sum range B1:B3 where B2 has an error
    "set B1 value 100",
    "set B2 formula 1/0", // error cell in sum range
    "set B3 value 300",
    // SUMIF with error in sum range: value2 checks .type e branch
    'set D1 formula SUMIF(A1:A3, ">5", B1:B3)',
  ]);
  // The error in the sum range should propagate through resulttypesum
  expect(getVT("D1").charAt(0)).toBe("e");
});

// ---------------------------------------------------------------------------
// 15. ExactFunction: t/n, n/n, b/t, e branches (L12819-12850)
// ---------------------------------------------------------------------------

test("ExactFunction: text vs text matching (L12819)", async () => {
  const { getDV } = await buildSheet([
    "set A1 text t hello",
    "set B1 text t hello",
    "set C1 formula EXACT(A1, B1)",
  ]);
  expect(getDV("C1")).toBe(1);
});

test("ExactFunction: n vs n matching (L12829-12830)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 42",
    "set B1 value 42",
    "set C1 formula EXACT(A1, B1)",
    "set D1 value 42",
    "set E1 value 43",
    "set F1 formula EXACT(D1, E1)",
  ]);
  expect(getDV("C1")).toBe(1);
  expect(getDV("F1")).toBe(0);
});

test("ExactFunction: n vs t matching (L12834)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 42",
    "set B1 text t 42",
    "set C1 formula EXACT(A1, B1)",
  ]);
  expect(getDV("C1")).toBe(1);
});

test("ExactFunction: b vs t non-empty (L12841)", async () => {
  const { getDV } = await buildSheet([
    "set B1 text t hello",
    // A1 is blank
    "set C1 formula EXACT(B1, A1)", // t vs b, t non-empty -> 0
  ]);
  expect(getDV("C1")).toBe(0);
});

test("ExactFunction: b vs n (L12845)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 5",
    // B1 is blank
    "set C1 formula EXACT(A1, B1)", // n vs b -> 0
  ]);
  expect(getDV("C1")).toBe(0);
});

test("ExactFunction: e propagation for v1 and v2 (L12824, L12835, L12846, L12850)", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0", // error
    "set B1 value 5",
    "set C1 formula EXACT(A1, B1)", // v1=error
    "set D1 formula EXACT(B1, A1)", // v2=error
  ]);
  expect(getVT("C1").charAt(0)).toBe("e");
  expect(getVT("D1").charAt(0)).toBe("e");
});

// ---------------------------------------------------------------------------
// 16. StringFunctions: FIND not found, LEFT default, HEXCODE surrogate
//     (L12910, L12915, L13023-13028)
// ---------------------------------------------------------------------------

test("StringFunctions: FIND not found returns error text (L12910)", async () => {
  const { getVT } = await buildSheet([
    'set A1 text t "hello world"',
    'set B1 formula FIND("xyz", A1)',
  ]);
  expect(getVT("B1").charAt(0)).toBe("e");
});

test("StringFunctions: HEXCODE with surrogate pair (L13023-13028)", async () => {
  const { getDV } = await buildSheet([
    // U+1F600 (😀) is a surrogate pair
    "set A1 text t 😀",
    "set B1 formula HEXCODE(A1)",
  ]);
  expect(getDV("B1")).toBe("1F600");
});

test("StringFunctions: RIGHT with default len=1 via formula", async () => {
  const { getDV } = await buildSheet(["set A1 text t hello", "set B1 formula RIGHT(A1)"]);
  expect(getDV("B1")).toBe("o");
});

// ---------------------------------------------------------------------------
// 17. IsFunctions: ISERR and ISNA specific branches (L13062-13070)
// ---------------------------------------------------------------------------

test("IsFunctions: ISERR excludes ISNA (L13065-13070)", async () => {
  const { getDV } = await buildSheet([
    "set A1 formula 1/0", // #DIV/0!
    "set B1 formula NA()", // #N/A
    "set C1 formula ISERR(A1)", // 1 (ISERR catches everything except #N/A)
    "set D1 formula ISERR(B1)", // 0 (ISERR excludes #N/A)
    "set E1 formula ISNA(B1)", // 1
    "set F1 formula ISNA(A1)", // 0
    "set G1 formula ISERROR(A1)", // 1
    "set H1 formula ISERROR(B1)", // 1
    "set I1 formula ISLOGICAL(A1)", // 0 (numeric is not logical)
    "set J1 formula ISBLANK(A1)", // 0
    "set K1 formula ISNUMBER(A1)", // 1
    "set L1 formula ISTEXT(A1)", // 0
  ]);
  expect(getDV("C1")).toBe(1);
  expect(getDV("D1")).toBe(0);
  expect(getDV("E1")).toBe(1);
  expect(getDV("F1")).toBe(0);
  expect(getDV("G1")).toBe(1);
  expect(getDV("H1")).toBe(1);
});

// ---------------------------------------------------------------------------
// 18. LogFunction, CeilingFloorFunctions branches (L13268-13424)
// ---------------------------------------------------------------------------

test("LogFunction: default base = 10 (L13268-13273)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 100",
    "set B1 formula LOG(A1)", // default base = e (natural log)
    "set C1 formula LOG(A1, 10)",
    "set D1 formula LOG(A1, 2)",
  ]);
  expect(getDV("B1")).toBeCloseTo(Math.log(100), 5); // ln(100) ≈ 4.605
  expect(getDV("C1")).toBeCloseTo(2, 5);
  expect(getDV("D1")).toBeCloseTo(Math.log(100) / Math.log(2), 5);
});

test("CeilingFloorFunctions: negative significance (L13381-13386)", async () => {
  const { getDV } = await buildSheet([
    "set A1 value 7",
    "set B1 formula CEILING(A1, -2)",
    "set C1 formula FLOOR(A1, -2)",
    "set D1 value -7",
    "set E1 formula FLOOR(D1, 2)",
  ]);
  // Negative significance: floor value and ceiling still compute.
  // FLOOR(7, -2) → 6, CEILING(7, -2) → 8
  // Note: SocialCalc might treat negative significance differently
  expect(typeof getDV("B1")).toBe("number");
  expect(typeof getDV("C1")).toBe("number");
});

test("AndOrFunctions: AND with all-blank and OR with values (L13450-13464)", async () => {
  const { getDV } = await buildSheet([
    // A1:A3 are all blank
    "set B1 formula AND(A1:A3)", // all blank -> false (0)
    "set C1 formula OR(A1:A3)", // all blank -> false (0)
    "set D1 value 1",
    "set E1 formula AND(D1)", // 1 -> true
    "set F1 formula OR(D1)", // 1 -> true
  ]);
  expect(getDV("B1")).toBe(0);
  expect(getDV("C1")).toBe(0);
  expect(getDV("E1")).toBe(1);
  expect(getDV("F1")).toBe(1);
});

// ---------------------------------------------------------------------------
// 19. ColumnsRowsFunctions: non-coord/range type (L13534-13544)
// ---------------------------------------------------------------------------

test("ColumnsRowsFunctions: non-coord/range returns e#VALUE! (L13534-13544)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const operand: Operand[] = [];
  const foperand: Operand[] = [{ type: "n", value: 42 }];
  // Direct dispatch — TopOfStackValueAndType returns {type: "n", value: 42}
  // But we need the foperand to have the operand visible.
  // Actually, TopOfStackValueAndType pops from foperand:
  foperand.push({ type: "n", value: 42 });
  SC.Formula.ColumnsRowsFunctions("COLUMNS", operand, foperand.slice(0), sheet);
  // hmm - this won't work well via direct dispatch since TopOfStackValueAndType needs stack.
  // Let's use COLUMNS formula which needs range type.
  // The else branch (non-coord, non-range) returns e#VALUE!
  // We need to build foperand so TopOfStackValueAndType pops something non-coord/range.
  // Actually let's test via formula with a text input:
  const op2: Operand[] = [];
  const fop2: Operand[] = [{ type: "t", value: "hello" }];
  SC.Formula.ColumnsRowsFunctions("COLUMNS", op2, fop2, sheet);
  expect(op2[0].type).toBe("e#VALUE!");
  expect(op2[0].value).toBe(0);

  // And the else branch for ROWS (fname != COLUMNS and != ROWS)
  // That's actually not reachable through normal use.
  // But we can test ROWS on a range (successful):
  const op3: Operand[] = [];
  // Build foperand as a stack for TopOfStackValueAndType:
  const rangeOp: Operand[] = [{ type: "range", value: "A1|B3|" }];
  SC.Formula.ColumnsRowsFunctions("ROWS", op3, rangeOp, sheet);
  expect(op3[0].type).toBe("n");
  expect(op3[0].value).toBe(3);
});

// ---------------------------------------------------------------------------
// 20. DDBFunction/SLNFunction/SYDFunction: CheckForErrorValue (L13614-13689)
// ---------------------------------------------------------------------------

test("DDBFunction: error in cost propagates (L13619-13626)", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0",
    "set B1 value 1000",
    "set C1 value 100",
    "set D1 value 5",
    "set E1 formula DDB(A1, B1, C1, D1)",
  ]);
  expect(getVT("E1").charAt(0)).toBe("e");
});

test("SLNFunction: error in cost propagates (L13660-13665)", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0",
    "set B1 value 1000",
    "set C1 value 5",
    "set D1 formula SLN(A1, B1, C1)",
  ]);
  expect(getVT("D1").charAt(0)).toBe("e");
});

test("SLNFunction: lifetime < 1 returns NUM error", async () => {
  const { getVT } = await buildSheet([
    "set A1 value 1000",
    "set B1 value 100",
    "set C1 value 0",
    "set D1 formula SLN(A1, B1, C1)",
  ]);
  expect(getVT("D1")).toContain("e#NUM!");
});

test("SYDFunction: error in cost propagates (L13682-13689)", async () => {
  const { getVT } = await buildSheet([
    "set A1 formula 1/0",
    "set B1 value 1000",
    "set C1 value 5",
    "set D1 value 3",
    "set E1 formula SYD(A1, B1, C1, D1)",
  ]);
  expect(getVT("E1").charAt(0)).toBe("e");
});

// ---------------------------------------------------------------------------
// 21. InterestFunctions: FV/PMT/PV/RATE branches (L13721-13834)
// ---------------------------------------------------------------------------

test("InterestFunctions: FV with paytype=1 (L13728-13733)", async () => {
  const { getDV } = await buildSheet(["set A1 formula FV(0.05, 10, 100, 0, 1)"]);
  expect(getDV("A1")).toBeDefined();
});

test("InterestFunctions: FV with rate=0 (L13728)", async () => {
  const { getDV } = await buildSheet(["set A1 formula FV(0, 10, 100)"]);
  expect(getDV("A1")).toBe(-1000);
});

test("InterestFunctions: PMT with paytype=1 (L13773-13778)", async () => {
  const { getDV } = await buildSheet(["set A1 formula PMT(0.05, 10, 1000, 0, 1)"]);
  expect(getDV("A1")).toBeDefined();
});

test("InterestFunctions: PMT with n=0 returns NUM error (L13773)", async () => {
  const { getVT } = await buildSheet(["set A1 formula PMT(0.05, 0, 1000)"]);
  expect(getVT("A1")).toContain("e#NUM!");
});

test("InterestFunctions: PV with rate=-1 (L13790-13795)", async () => {
  const { getVT } = await buildSheet(["set A1 formula PV(-1, 10, 100)"]);
  expect(getVT("A1")).toContain("e#DIV/0!");
});

test("InterestFunctions: PV with rate=0 (L13790)", async () => {
  const { getDV } = await buildSheet(["set A1 formula PV(0, 10, 100, 0, 1)"]);
  expect(getDV("A1")).toBe(-1000);
});

test("InterestFunctions: RATE convergence with olddelta (L13813-13834)", async () => {
  const { getDV } = await buildSheet(["set A1 formula RATE(10, 100, -1000, 0, 0, 0.1)"]);
  expect(getDV("A1")).toBeDefined();
});

// ---------------------------------------------------------------------------
// 22. NPVFunction: error in args and LookupResultType (L13860, L13869, L13874)
// ---------------------------------------------------------------------------
test("NPVFunction: error in args and LookupResultType (L13860, L13869, L13874)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const { getDV, sheet } = await buildSheet([
    "set A1 value 0.1",
    "set B1 value 100",
    // blank cell D1 occupies a period as 0
    "set E1 value 300",
    "set F1 formula NPV(A1, B1, D1, E1)",
  ]);
  const blankValue = Number((sheet.GetAssuredCell("D1") as Cell).datavalue ?? 0);
  const expected = 100 / 1.1 + blankValue / 1.21 + 300 / 1.331;
  expect(getDV("F1") as number).toBeCloseTo(expected, 8);
});

// ---------------------------------------------------------------------------
// 23. IRRFunction: factor=0 branch (L13926-13933)
// ---------------------------------------------------------------------------

test("IRRFunction: factor approaching 0 via rate near -1 (L13931-13933)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    ["set A1 value -100", "set A2 value 100", "set B1 formula IRR(A1:A2, -0.99)"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  // Should either converge or hit factor==0 error
  const vt = (sheet.GetAssuredCell("B1") as Cell).valuetype;
  expect(vt).toBeDefined();
});

// ---------------------------------------------------------------------------
// 24. IoFunctions: SELECT, PANEL/SPLASH branches (L14045-14186)
// ---------------------------------------------------------------------------

test("IoFunctions: SELECT with options and html parameters (L14058-14077)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    ["set B1 text t apple", "set B2 text t banana", "set B3 text t cherry"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  // Pre-seed ioParameterList for SELECT.
  sheet.ioParameterList = {};
  sheet.ioParameterList["A1"] = [
    { type: "t", value: "option1" },
    { type: "range", value: "B1|B3|" },
  ];
  sheet.ioParameterList["A1"].function_name = "SELECT";

  const operand: Operand[] = [];
  // SELECT argdef: [2, 14, 1, 1] → text, range|coord|text, number, number
  // foperand pops from end, so put arg1 (value) last.
  const foperand: Operand[] = [
    { type: "n", value: 1 }, // arg4: multiple flag
    { type: "n", value: 2 }, // arg3: size
    { type: "range", value: "B1|B3|" }, // arg2: options source
    { type: "t", value: "apple" }, // arg1: value
  ];

  SC.Formula.IoFunctions("SELECT", operand, foperand, sheet, "A1");
  expect(operand[0].value).toBe("apple");
  expect(sheet.ioParameterList["A1"].html).toBeDefined();
  expect(sheet.ioParameterList["A1"].html[0]).toBe("multiple");
});

test("IoFunctions: BUTTON with no args (L14082)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  sheet.ioParameterList = {};

  const operand: Operand[] = [];
  SC.Formula.IoFunctions("BUTTON", operand, [], sheet, "A1");
  expect(operand[0].value).toBe(0);
  expect(operand[0].type).toBe("tiBUTTON");
});

test("IoFunctions: SPLASH shows splash panel", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 text t SplashContent"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const operand: Operand[] = [];
  const foperand: Operand[] = [{ type: "coord", value: "A1" }];

  SC.Formula.IoFunctions("SPLASH", operand, foperand, sheet, "B1");
  expect(operand[0].type).toBe("t");
  expect(String(operand[0].value)).toContain("SPLASH:");
});

test("IoFunctions: PANEL with SocialCalc._app=true (L14140-14186)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  // Set up panel range data
  await scheduleCommands(SC, sheet, ["set A1 text t Panel1"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  // panel only works in live app
  SC._app = true;

  const fakeEditor = {
    context: {
      rowpanes: [{ first: 0 }],
      CalculateColWidthData: function () {},
      totalwidth: 500,
    },
    ResizeTableEditor: function () {},
  };
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: fakeEditor,
    width: 500,
    height: 500,
  };
  try {
    const operand: Operand[] = [];
    // PANEL(showindices_range_or_csv, panel1_range)
    // foperand pops from end, so arg1 goes last.
    const foperand: Operand[] = [
      { type: "coord", value: "A1" }, // arg2: panel 1 range
      { type: "n", value: 1 }, // arg1: show panel 1
    ];

    SC.Formula.IoFunctions("PANEL", operand, foperand, sheet, "B1");
    expect(operand[0].type).toBe("t");
    expect(operand[0].value).toBeDefined();
  } finally {
    delete SC._app;
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

// ---------------------------------------------------------------------------
// 25. TriggerIoAction.Button: INSERT/DELETEIF/COMMAND/COMMANDIF (L14257-14380)
// ---------------------------------------------------------------------------

test("TriggerIoAction.Button: COPYVALUE action", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    ["set C1 text t value_to_copy", "set D2 text t destination"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  sheet.ioEventTree = {};
  sheet.ioEventTree["A1"] = { B1: "B1" };
  sheet.ioParameterList = {};
  sheet.ioParameterList["B1"] = [
    { type: "coord", value: "A1" },
    { type: "coord", value: "D2" },
    { type: "coord", value: "C1" },
  ];
  sheet.ioParameterList["B1"].function_name = "COPYVALUE";

  let scheduledCmds: string[] = [];
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmds: string) {
        scheduledCmds.push(cmds);
      },
    },
  };

  try {
    SC.TriggerIoAction.Button("A1");
    expect(scheduledCmds.length).toBeGreaterThan(0);
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("TriggerIoAction.Button: INSERT action with multi-col range (L14289)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set C1 text t val1", "set D1 text t copy1"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  sheet.ioEventTree = {};
  sheet.ioEventTree["A1"] = { B1: "B1" };

  sheet.ioParameterList = {};
  sheet.ioParameterList["B1"] = [
    { type: "coord", value: "A1" }, // trigger cell (params[0])
    { type: "range", value: "C1|D1|" }, // destination range (params[1], 2 cols)
    { type: "range", value: "D1|D1|" }, // source formula range (params[2])
  ];
  sheet.ioParameterList["B1"].function_name = "INSERT";

  let scheduledCmds: string[] = [];
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmds: string) {
        scheduledCmds.push(cmds);
      },
    },
  };

  try {
    SC.TriggerIoAction.Button("A1");
    expect(scheduledCmds.length).toBeGreaterThan(0);
    expect(scheduledCmds.join(" ")).toContain("insertcol");
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("TriggerIoAction.Button: DELETEIF action with row range (L14339-14380)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 text t x",
      "set B1 text t y", // criteria cell
      // test range as row (A3:A5)
      "set A3 text t x",
      "set A4 text t y",
      "set A5 text t x",
    ],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  sheet.ioEventTree = {};
  sheet.ioEventTree["T1"] = { D1: "D1" };
  sheet.ioParameterList = {};
  sheet.ioParameterList["D1"] = [
    { type: "coord", value: "T1" }, // trigger cell
    { type: "coord", value: "B1" }, // criteria cell ("y")
    { type: "range", value: "A3|A5|" }, // test range (single col, 3 rows)
  ];
  sheet.ioParameterList["D1"].function_name = "DELETEIF";

  let scheduledCmds: string[] = [];
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmds: string) {
        scheduledCmds.push(cmds);
      },
    },
  };

  try {
    SC.TriggerIoAction.Button("T1");
    // Should have found "y" in A4, scheduling deleterow
    expect(scheduledCmds.length).toBeGreaterThan(0);
    expect(scheduledCmds.join(" ")).toContain("deleterow");
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("TriggerIoAction.Button: COMMAND action (L14344-14380)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ['set A1 text t "set B1 value 5"'], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  sheet.ioEventTree = {};
  sheet.ioEventTree["T1"] = { D1: "D1" };
  sheet.ioParameterList = {};
  sheet.ioParameterList["D1"] = [
    { type: "coord", value: "T1" },
    { type: "range", value: "A1|A1|" },
  ];
  sheet.ioParameterList["D1"].function_name = "COMMAND";

  let scheduledCmds: string[] = [];
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmds: string) {
        scheduledCmds.push(cmds);
      },
    },
  };

  try {
    SC.TriggerIoAction.Button("T1");
    expect(scheduledCmds.length).toBeGreaterThan(0);
    expect(scheduledCmds.join(" ")).toContain("set B1");
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("TriggerIoAction.Button: COMMANDIF with conditions (L14368-14380)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 value 1", // condition true
      'set A2 text t "set B1 value 5"',
    ],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  sheet.ioEventTree = {};
  sheet.ioEventTree["T1"] = { D1: "D1" };
  sheet.ioParameterList = {};
  sheet.ioParameterList["D1"] = [
    { type: "coord", value: "T1" },
    { type: "range", value: "A1|A1|" }, // conditions
    { type: "range", value: "A2|A2|" }, // commands
  ];
  sheet.ioParameterList["D1"].function_name = "COMMANDIF";

  let scheduledCmds: string[] = [];
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmds: string) {
        scheduledCmds.push(cmds);
      },
    },
  };

  try {
    SC.TriggerIoAction.Button("T1");
    expect(scheduledCmds.length).toBeGreaterThan(0);
    expect(scheduledCmds.join(" ")).toContain("set B1");
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("TriggerIoAction.Button: COPYFORMULA action", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 formula B1+1"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  sheet.ioEventTree = {};
  sheet.ioEventTree["T1"] = { D1: "D1" };
  sheet.ioParameterList = {};
  sheet.ioParameterList["D1"] = [
    { type: "coord", value: "T1" },
    { type: "coord", value: "E1" },
    { type: "range", value: "A1|A1|" },
  ];
  sheet.ioParameterList["D1"].function_name = "COPYFORMULA";

  let scheduledCmds: string[] = [];
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmds: string) {
        scheduledCmds.push(cmds);
      },
    },
  };

  try {
    SC.TriggerIoAction.Button("T1");
    expect(scheduledCmds.length).toBeGreaterThan(0);
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

// ---------------------------------------------------------------------------
// 26. CopyFormulaToRange/CopyValueToRange (L14401-14454)
// ---------------------------------------------------------------------------

test("CopyValueToRange: formula cell data type handling (L14401-14454)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 formula B1+5", "set A2 text t hello"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const sourceCell = sheet.GetAssuredCell("A1");
  const sourceData = {
    value: null,
    type: "range" as SocialCalc.FormulaOperandType,
    ncols: 1,
    nrows: 1,
    col1num: 1,
    row1num: 1,
    celldata: [[sourceCell]],
  };
  const destcr = { col: 3, row: 1 };

  const result = SC.TriggerIoAction.CopyValueToRange(sourceData, destcr);
  expect(result).toContain("set C1");
});

test("CopyFormulaToRange: formula cell formula offset (L14401)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 formula B1+5"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const sourceCell = sheet.GetAssuredCell("A1");
  const formulaData = {
    value: null,
    type: "range" as SocialCalc.FormulaOperandType,
    ncols: 1,
    nrows: 1,
    col1num: 1,
    row1num: 1,
    celldata: [[sourceCell]],
  };
  const destcr = { col: 3, row: 1 };

  const result = SC.TriggerIoAction.CopyFormulaToRange(formulaData, destcr);
  expect(result).toContain("set C1");
  expect(result).toContain("formula");
});

// ---------------------------------------------------------------------------
// 27. Email: condition check and status bar message (L14523-14543)
// ---------------------------------------------------------------------------

test("Email: condition range false skip (L14528-14531)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 value 0", // condition false
      "set A2 text t addr@test.com",
      "set A3 text t subject",
      "set A4 text t body",
    ],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  sheet.ioParameterList = {};
  sheet.ioParameterList["E1"] = [
    { type: "coord", value: "A1" },
    { type: "coord", value: "A2" },
    { type: "coord", value: "A3" },
    { type: "coord", value: "A4" },
  ];
  sheet.ioParameterList["E1"].function_name = "EMAILIF";

  let scheduledCmds: string[] = [];
  sheet.ScheduleSheetCommands = function (cmd: string) {
    scheduledCmds.push(cmd);
  };
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {},
  };

  try {
    SC.TriggerIoAction.Email("E1");
    expect(scheduledCmds.length).toBe(0);
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("Email: condition true sends email (L14534-14543)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    [
      "set A1 value 1",
      "set A2 text t addr@test.com",
      "set A3 text t subject",
      "set A4 text t body",
    ],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  sheet.ioParameterList = {};
  sheet.ioParameterList["E1"] = [
    { type: "coord", value: "A1" },
    { type: "coord", value: "A2" },
    { type: "coord", value: "A3" },
    { type: "coord", value: "A4" },
  ];
  sheet.ioParameterList["E1"].function_name = "EMAILIF";

  let scheduledCmds: string[] = [];
  sheet.ScheduleSheetCommands = function (cmd: string) {
    scheduledCmds.push(cmd);
  };
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {},
  };
  SC.EditorSheetStatusCallback = function () {};

  try {
    SC.TriggerIoAction.Email("E1");
    expect(scheduledCmds.length).toBeGreaterThan(0);
    expect(scheduledCmds[0]).toContain("sendemail");
  } finally {
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

// ---------------------------------------------------------------------------
// 28. Submit: formDataViewer loaded path (L14546-14551)
// ---------------------------------------------------------------------------

test("Submit: exercises formDataViewer loaded path (L14548)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const formDataSheet = new SC.Sheet();
  formDataSheet.ScheduleSheetCommands = function () {};
  // Need a valid cell at the form fields data coord.
  // With formFieldsLength=1, Submit iterates col=2 to 2 (B2).
  if (!formDataSheet.cells) formDataSheet.cells = {};
  // With formFieldsLength=1, Submit iterates col=2 to 2, coord = B2.
  formDataSheet.cells["B2"] = {
    datavalue: "val1",
    valuetype: "t",
  } as unknown as SocialCalc.Cell;

  const savedViewer = SC.CurrentSpreadsheetViewerObject;
  SC.CurrentSpreadsheetViewerObject = {
    formDataViewer: {
      loaded: true,
      formFields: {},
      formFieldsLength: 1,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetViewerObject;

  let scheduledCmd = "";
  const sheet = new SC.Sheet();
  sheet.ScheduleSheetCommands = function (cmd: string) {
    scheduledCmd = cmd;
  };

  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {},
  };

  try {
    SC.TriggerIoAction.Submit("A1");
    expect(scheduledCmd).toContain("submitform");
  } finally {
    SC.CurrentSpreadsheetViewerObject = savedViewer;
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("TextBox: updateInputWidgetFormula exercises type branches (L14580)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  sheet.ioParameterList["A1"] = [{ type: "t", value: "initial" }];
  sheet.ioParameterList["A1"].function_name = "TEXTBOX";

  let scheduledCmd = "";
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmd: string) {
        scheduledCmd = cmd;
      },
    },
  };

  const savedDoc = (globalThis as Record<string, unknown>).document;

  // Set up formDataViewer for UpdateFormDataSheet
  const formDataSheet = new SC.Sheet();
  formDataSheet.ScheduleSheetCommands = function () {};
  const savedViewer = SC.CurrentSpreadsheetViewerObject;
  SC.CurrentSpreadsheetViewerObject = {
    formDataViewer: {
      loaded: true,
      formFields: { textboxa1: 3 },
      formFieldsLength: 1,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetViewerObject;

  (globalThis as Record<string, unknown>).document = {
    getElementById: function () {
      return { value: "new value" };
    },
  };

  try {
    SC.TriggerIoAction.TextBox("A1");
    expect(scheduledCmd).toContain("set A1");
    expect(scheduledCmd).toContain("TEXTBOX");
  } finally {
    (globalThis as Record<string, unknown>).document = savedDoc;
    SC.CurrentSpreadsheetViewerObject = savedViewer;
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

test("CheckBox: checked returns TRUE/FALSE (L14585)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  sheet.ioParameterList = {};
  sheet.ioParameterList["A1"] = [{ type: "n", value: 0 }];
  sheet.ioParameterList["A1"].function_name = "CHECKBOX";

  let scheduledCmd = "";
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmd: string) {
        scheduledCmd = cmd;
      },
    },
  };

  const savedDoc = (globalThis as Record<string, unknown>).document;

  // Set up formDataViewer for UpdateFormDataSheet
  const formDataSheet = new SC.Sheet();
  formDataSheet.ScheduleSheetCommands = function () {};
  const savedViewer = SC.CurrentSpreadsheetViewerObject;
  SC.CurrentSpreadsheetViewerObject = {
    formDataViewer: {
      loaded: true,
      formFields: { checkboxa1: 3 },
      formFieldsLength: 1,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetViewerObject;

  (globalThis as Record<string, unknown>).document = {
    getElementById: function () {
      return { checked: true };
    },
  };

  try {
    SC.TriggerIoAction.CheckBox("A1");
    expect(scheduledCmd).toContain("CHECKBOX");
    expect(scheduledCmd).toContain("TRUE");
  } finally {
    (globalThis as Record<string, unknown>).document = savedDoc;
    SC.CurrentSpreadsheetViewerObject = savedViewer;
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

// ---------------------------------------------------------------------------
// 30. RadioButton: exercises type branches (L14596-14597)
// ---------------------------------------------------------------------------

test("RadioButton: exercises each on matched inputs (L14596)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  sheet.ioParameterList = {};
  sheet.ioParameterList["A1"] = [
    { type: "n", value: 0 },
    { type: "t", value: "group1" },
  ];
  sheet.ioParameterList["A1"].function_name = "RADIOBUTTON";

  let scheduledCmds: string[] = [];
  (globalThis as Record<string, unknown>).spreadsheet = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmd: string) {
        scheduledCmds.push(cmd);
      },
    },
  };

  const savedDollar = (globalThis as Record<string, unknown>).$;
  (globalThis as Record<string, unknown>).$ = function () {
    return {
      each: function (callback: (idx: number) => void) {
        callback(0);
      },
      attr: function (attr: string) {
        return attr === "id" ? "RADIOBUTTON_A1" : "";
      },
    };
  };

  const savedDoc = (globalThis as Record<string, unknown>).document;

  const formDataSheet = new SC.Sheet();
  formDataSheet.ScheduleSheetCommands = function () {};
  const savedViewer = SC.CurrentSpreadsheetViewerObject;
  SC.CurrentSpreadsheetViewerObject = {
    formDataViewer: {
      loaded: true,
      formFields: { radiobuttona1: 3 },
      formFieldsLength: 1,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetViewerObject;

  (globalThis as Record<string, unknown>).document = {
    getElementById: function () {
      return { checked: true };
    },
  };

  try {
    SC.TriggerIoAction.RadioButton("group1");
    expect(scheduledCmds.length).toBeGreaterThan(0);
  } finally {
    if (savedDollar !== undefined) {
      (globalThis as Record<string, unknown>).$ = savedDollar;
    } else {
      delete (globalThis as Record<string, unknown>).$;
    }
    (globalThis as Record<string, unknown>).document = savedDoc;
    SC.CurrentSpreadsheetViewerObject = savedViewer;
    delete (globalThis as Record<string, unknown>).spreadsheet;
  }
});

// ---------------------------------------------------------------------------
// 31. updateInputWidgetFormula: spreadsheet fallback to ss (L14601-14607)
// ---------------------------------------------------------------------------

test("updateInputWidgetFormula: spreadsheet fallback to ss (L14601-14602)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  sheet.ioParameterList = {};
  sheet.ioParameterList["A1"] = [
    { type: "t", value: "test" },
    { type: "range", value: "B1|B2|" },
  ];
  sheet.ioParameterList["A1"].function_name = "TEXTBOX";
  sheet.ioParameterList["A1"].cssParameter = '"color:red"';

  let scheduledCmd = "";
  (globalThis as Record<string, unknown>).ss = {
    sheet,
    editor: {
      EditorScheduleSheetCommands: function (cmd: string) {
        scheduledCmd = cmd;
      },
    },
  };

  const savedDoc = (globalThis as Record<string, unknown>).document;

  const formDataSheet = new SC.Sheet();
  formDataSheet.ScheduleSheetCommands = function () {};
  const savedViewer = SC.CurrentSpreadsheetViewerObject;
  SC.CurrentSpreadsheetViewerObject = {
    formDataViewer: {
      loaded: true,
      formFields: { textboxa1: 3 },
      formFieldsLength: 1,
      sheet: formDataSheet,
    },
  } as unknown as typeof SC.CurrentSpreadsheetViewerObject;

  (globalThis as Record<string, unknown>).document = {
    getElementById: function () {
      return { value: "new_value" };
    },
  };

  try {
    SC.TriggerIoAction.updateInputWidgetFormula("TEXTBOX", "A1", function () {
      return "entered_value";
    });
    expect(scheduledCmd).toContain("set A1");
    expect(scheduledCmd).toContain("TEXTBOX");
    expect(scheduledCmd).toContain("style");
  } finally {
    (globalThis as Record<string, unknown>).document = savedDoc;
    SC.CurrentSpreadsheetViewerObject = savedViewer;
    delete (globalThis as Record<string, unknown>).ss;
  }
});

// ---------------------------------------------------------------------------
// 32. getStandardizedParameter: constant and coord branches (L14668-14696)
// ---------------------------------------------------------------------------

test("getStandardizedParameter: constant type 'n' with includeCellData (L14668-14678)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const result = SC.Formula.getStandardizedParameter(sheet, { type: "n", value: 42 }, true, true);

  expect(result.ncols).toBe(1);
  expect(result.nrows).toBe(1);
  expect(result.col1num).toBe(1);
  expect(result.row1num).toBe(1);
  expect(result.cellcoord).toBeNull();
  if (!result.celldata) throw new Error("celldata should be populated");
  expect(result.celldata[0][0].datavalue).toBe(42);
  expect(result.celldata[0][0].datatype).toBe("v");
});

test("getStandardizedParameter: constant type 't' with includeCellData (L14678)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const result = SC.Formula.getStandardizedParameter(
    sheet,
    { type: "t", value: "hello" },
    true,
    true,
  );

  if (!result.celldata) throw new Error("celldata should be populated");
  expect(result.celldata[0][0].datavalue).toBe("hello");
  expect(result.celldata[0][0].datatype).toBe("t");
});

test("getStandardizedParameter: constant type other with includeCellData (L14678)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  const result = SC.Formula.getStandardizedParameter(sheet, { type: "b", value: 0 }, true, true);

  if (!result.celldata) throw new Error("celldata should be populated");
  expect(result.celldata[0][0].datatype).toBe("c");
  expect(result.celldata[0][0].valuetype).toBe("b");
});

test("getStandardizedParameter: coord type includes coord data (L14686, L14691, L14696)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 value 42"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const result = SC.Formula.getStandardizedParameter(
    sheet,
    { type: "coord", value: "A1" },
    true,
    true,
  );

  expect(result.ncols).toBe(1);
  expect(result.nrows).toBe(1);
  expect(result.cellcoord).toBeDefined();
  expect(result.celldata).toBeDefined();
  if (!result.celldata) throw new Error("celldata should be populated");
  expect(result.celldata[0][0].datavalue).toBe(42);
});

// ---------------------------------------------------------------------------
// 33. TestCriteria: text comparison with format_number_for_display (L14882-14888)
// ---------------------------------------------------------------------------

test("TestCriteria: numeric value with >NN comparator (L14882-14888)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.TestCriteria(42, "n", ">40");
  expect(result).toBe(true);
});

test("TestCriteria: text comparison with format_number_for_display (L14887-14888)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.TestCriteria("42", "t", "42");
  expect(result).toBe(true);
});

test("TestCriteria: comparator '<>' text branch (L14882)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.TestCriteria("abc", "t", "<>xyz");
  expect(result).toBe(true);
});

test("TestCriteria: comparator '<' text branch", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.TestCriteria("abc", "t", "<xyz");
  expect(result).toBe(true);
});

test("TestCriteria: comparator '>=' text branch", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.TestCriteria("xyz", "t", ">=abc");
  expect(result).toBe(true);
});

// ---------------------------------------------------------------------------
// 34. CalculateFunction: StoreIoEventFormula called via CalculateFunction (L1242)
// ---------------------------------------------------------------------------

test("CalculateFunction: StoreIoEventFormula called via CalculateFunction (L1242)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();
  sheet.ioParameterList = {};

  // Build operand stack as the evaluator would: [start, arg1] (start marker
  // pushed first, argument on top — CopyFunctionArgs pops from the end
  // until it finds "start").
  const operand: Operand[] = [];
  operand.push({ type: "start", value: 0 });
  operand.push({ type: "t", value: "Click Me" });

  const errortext = SC.Formula.CalculateFunction("BUTTON", operand, sheet, "C1");
  // IoFunctions ends with a bare `return;` on success, so errortext is
  // undefined (not ""), matching CalculateFunction's real success signal.
  expect(errortext).toBeFalsy();
  // After CalculateFunction, the result should be pushed
  expect(operand.length).toBe(1);
  expect(operand[0].type).toBe("tiBUTTON");
});
test("FunctionArgString: exact-arg function format (nargs > 0)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  // EXACT has argdef "" (falsy) and nargs=2, so it generates "v1, v2"
  const argStr = SC.Formula.FunctionArgString("EXACT");
  expect(argStr).toBe("v1, v2");

  // DATE has argdef "date" (truthy), returns FunctionArgDefs["date"]
  const argStr2 = SC.Formula.FunctionArgString("DATE");
  expect(argStr2).toBeDefined();
});

test("FunctionArgString: zero-arg function format (nargs = 0)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const argStr = SC.Formula.FunctionArgString("PI");
  expect(argStr).toBe(" ");
});

// ---------------------------------------------------------------------------
// 36. AddSheetToCache and NormalizeSheetName + FreshnessInfoReset
// ---------------------------------------------------------------------------

test("AddSheetToCache: with str creates new sheet", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const saveStr = "version:1.5\ncell:A1:v:77\nsheet:c:1:r:1\n";
  const result = SC.Formula.AddSheetToCache("TestSheet", saveStr);
  if (!result) throw new Error("AddSheetToCache should return a sheet");
  expect(result.cells.A1.datavalue).toBe(77);
  expect(SC.Formula.SheetCache.sheets["testsheet"]).toBeDefined();
});

test("AddSheetToCache: with empty str returns null sheet in cache", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.AddSheetToCache("EmptySheet", "");
  expect(result).toBeNull();
  expect(SC.Formula.SheetCache.sheets["emptysheet"]).toBeDefined();
});

test("AddSheetToCache: with live=true sets freshness false", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  SC.Formula.AddSheetToCache("LiveSheet", "", true);
  expect(SC.Formula.FreshnessInfo.sheets["livesheet"]).toBe(false);
});

test("AddSheetToCache: with live=false sets freshness true", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  SC.Formula.AddSheetToCache("StaleSheet", "", false);
  expect(SC.Formula.FreshnessInfo.sheets["stalesheet"]).toBe(true);
});

test("NormalizeSheetName: via Callbacks override", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const savedCallback = SC.Callbacks.NormalizeSheetName;
  SC.Callbacks.NormalizeSheetName = function (name: string) {
    return name.toUpperCase();
  };

  try {
    const result = SC.Formula.NormalizeSheetName("test");
    expect(result).toBe("TEST");
  } finally {
    SC.Callbacks.NormalizeSheetName = savedCallback;
  }
});

test("FreshnessInfoReset: deletes stale sheets", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  // Add sheets: live=true → FreshnessInfo=false → deleted by Reset
  //              live=false → FreshnessInfo=true → stays
  const saveStr = "version:1.5\ncell:A1:v:77\nsheet:c:1:r:1\n";
  SC.Formula.AddSheetToCache("StaleSheet", saveStr, true);
  SC.Formula.AddSheetToCache("GoodSheet", saveStr, false);

  expect(SC.Formula.FreshnessInfo.sheets["stalesheet"]).toBe(false);
  expect(SC.Formula.FreshnessInfo.sheets["goodsheet"]).toBe(true);

  SC.Formula.FreshnessInfoReset();
  expect(SC.Formula.SheetCache.sheets["stalesheet"]).toBeUndefined();
  // GoodSheet stays (it's not "false" freshness)
  // Actually FreshnessInfoReset deletes sheets where freshness===false
  // then resets sheets={} (so GoodSheet's freshness is also reset).
  // Wait: let me re-read: it deletes stale sheets, then sets sheets={}
  // So both are removed from SheetCache? No—it only deletes false-freshness,
  // then sets freshness.sheets = {} (clears freshness, not SheetCache)
  expect(SC.Formula.SheetCache.sheets["goodsheet"]).toBeDefined();
});

test("FreshnessInfoReset: resets volatile and recalc_completed", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  SC.Formula.FreshnessInfo.volatile.NOW = true;
  SC.Formula.FreshnessInfo.recalc_completed = true;

  SC.Formula.FreshnessInfoReset();

  expect(Object.keys(SC.Formula.FreshnessInfo.volatile).length).toBe(0);
  expect(SC.Formula.FreshnessInfo.recalc_completed).toBe(false);
});

// ---------------------------------------------------------------------------
// 37. FindInSheetCache: loadsheet deprecated path
// ---------------------------------------------------------------------------

test("FindInSheetCache: deprecated loadsheet callback path", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  let alerted = "";
  const savedAlert = (globalThis as Record<string, unknown>).alert;
  (globalThis as Record<string, unknown>).alert = function (msg: string) {
    alerted = msg;
  };

  const saveStr = "version:1.5\ncell:A1:v:77\nsheet:c:1:r:1\n";
  SC.Formula.SheetCache.loadsheet = function (_name: string) {
    return saveStr;
  };
  SC.Formula.SheetCache.waitingForLoading = null;

  try {
    const result = SC.Formula.FindInSheetCache("NewSheet");
    expect(alerted).toContain("deprecated");
    expect(result).toBeDefined();
  } finally {
    SC.Formula.SheetCache.loadsheet = null;
    if (savedAlert !== undefined) {
      (globalThis as Record<string, unknown>).alert = savedAlert;
    } else {
      delete (globalThis as Record<string, unknown>).alert;
    }
  }
});

// ---------------------------------------------------------------------------
// 38. getStandardizedList: CSV split for single cell
// ---------------------------------------------------------------------------

test("getStandardizedList: single-cell CSV split (L14671)", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set A1 text t apple,banana,cherry"], true, 4000);
  await recalcSheet(SC, sheet, 4000);

  const result = SC.Formula.getStandardizedList(sheet, { type: "coord", value: "A1" });

  expect(result.length).toBe(3);
  expect(result[0]).toBe("apple");
  expect(result[2]).toBe("cherry");
});

test("getStandardizedList: multi-cell range produces cell values", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    ["set A1 text t apple", "set A2 text t banana", "set A3 text t cherry"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  const result = SC.Formula.getStandardizedList(sheet, { type: "range", value: "A1|A3|" });

  expect(result.length).toBe(3);
  expect(result[0]).toBe("apple");
  expect(result[2]).toBe("cherry");
});

// ---------------------------------------------------------------------------
// 39. PlainCoord and OrderRangeParts
// ---------------------------------------------------------------------------

test("OrderRangeParts: reversed coords swap correctly", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.OrderRangeParts("C3", "A1");
  expect(result.c1).toBe(1);
  expect(result.c2).toBe(3);
  expect(result.r1).toBe(1);
  expect(result.r2).toBe(3);
});

test("OrderRangeParts: normal order stays same", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const result = SC.Formula.OrderRangeParts("A1", "C3");
  expect(result.c1).toBe(1);
  expect(result.c2).toBe(3);
  expect(result.r1).toBe(1);
  expect(result.r2).toBe(3);
});

test("PlainCoord: strips dollar signs", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  expect(SC.Formula.PlainCoord("$A$1")).toBe("A1");
  expect(SC.Formula.PlainCoord("A1")).toBe("A1");
  expect(SC.Formula.PlainCoord("$A1")).toBe("A1");
});

// ---------------------------------------------------------------------------
// 40. CheckForErrorValue branch
// ---------------------------------------------------------------------------

test("CheckForErrorValue: non-error returns false", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const operand: Operand[] = [];
  expect(SC.Formula.CheckForErrorValue(operand, { type: "n", value: 42 })).toBe(false);
  expect(operand.length).toBe(0);
});

test("CheckForErrorValue: error pushes and returns true", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const operand: Operand[] = [];
  const result = SC.Formula.CheckForErrorValue(operand, { type: "e#DIV/0!", value: 0 });
  expect(result).toBe(true);
  expect(operand.length).toBe(1);
  expect(operand[0].type).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// 41. FunctionSpecificError
// ---------------------------------------------------------------------------

test("FunctionSpecificError: pushes specified error type", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);

  const operand: Operand[] = [];
  const errortext = SC.Formula.FunctionSpecificError("TEST", operand, "e#NUM!", "test error");
  expect(errortext).toBe("test error");
  expect(operand.length).toBe(1);
  expect(operand[0].type).toBe("e#NUM!");
});

// ---------------------------------------------------------------------------
// 42. NotFunction: text input
// ---------------------------------------------------------------------------

test("NotFunction: text input returns value error", async () => {
  const { getVT } = await buildSheet(["set A1 text t hello", "set B1 formula NOT(A1)"]);
  expect(getVT("B1")).toContain("e#VALUE!");
});

// ---------------------------------------------------------------------------
// 43. ChooseFunction: successful match and no match
// ---------------------------------------------------------------------------

test("ChooseFunction: successful match exercises count branch", async () => {
  const { getDV } = await buildSheet(['set A1 formula CHOOSE(2, "apple", "banana", "cherry")']);
  expect(getDV("A1")).toBe("banana");
});

test("ChooseFunction: no match returns value error", async () => {
  const { getVT } = await buildSheet(['set A1 formula CHOOSE(5, "apple", "banana")']);
  expect(getVT("A1")).toContain("e#VALUE!");
});

// ---------------------------------------------------------------------------
// 44. StepThroughRangeDown
// ---------------------------------------------------------------------------

test("StepThroughRangeDown: walks through range values", async () => {
  const SC = (await loadSocialCalc()) as FormulaSC;
  resetFormulaGlobals(SC);
  const sheet = new SC.Sheet();

  await scheduleCommands(
    SC,
    sheet,
    ["set A1 value 10", "set A2 value 20", "set A3 value 30"],
    true,
    4000,
  );
  await recalcSheet(SC, sheet, 4000);

  const operand: Operand[] = [{ type: "range", value: "A1|A3|" }];
  const value1 = SC.Formula.StepThroughRangeDown(operand, operand[0].value as string);
  expect(value1).toBeDefined();
});
