declare namespace SocialCalc {
  // ----------------------------------------------------------------------
  // String-literal unions used throughout the formula engine
  // ----------------------------------------------------------------------

  /**
   * Token types produced by ParseFormulaIntoTokens. The values are the
   * numeric constants defined in SocialCalc.Formula.TokenType:
   *   num=1, coord=2, op=3, name=4, error=5, string=6, space=7
   */
  type FormulaTokenTypeCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

  /**
   * Single-character opcodes as emitted by the parser and used in
   * SocialCalc.Formula.TokenPrecedence.
   * Most are the literal operator char; "M"/"P" are unary minus/plus,
   * "G"/"L"/"N" are >=, <=, <>.
   */
  type FormulaOpcode =
    | "!"
    | ":"
    | ","
    | "%"
    | "^"
    | "*"
    | "/"
    | "+"
    | "-"
    | "&"
    | "<"
    | ">"
    | "="
    | "G"
    | "L"
    | "N"
    | "M"
    | "P"
    | "("
    | ")"
    | number
    | (string & {});

  /**
   * Operand "type" strings appearing on the evaluator stack.
   * Plus error variants starting with "e".
   */
  type FormulaOperandType =
    | "n"
    | "nd"
    | "nt"
    | "ndt"
    | "n$"
    | "n%"
    | "nl"
    | "ni"
    | "n*"
    | "t"
    | "th"
    | "tw"
    | "tl"
    | "tr"
    | "t*"
    | "b"
    | "coord"
    | "range"
    | "name"
    | "start"
    | "array"
    | "e#NULL!"
    | "e#NUM!"
    | "e#DIV/0!"
    | "e#VALUE!"
    | "e#REF!"
    | "e#NAME?"
    | "e#N/A"
    | "e#SPILL!"
    | "e*"
    | (string & {});

  interface FormulaArrayCell {
    value: unknown;
    type: FormulaOperandType;
  }
  interface FormulaArrayValue {
    rows: number;
    cols: number;
    cells: FormulaArrayCell[][];
  }

  interface FormulaParseToken {
    /** The raw characters that make up this token. */
    text: string;
    /** Numeric token type from SocialCalc.Formula.TokenType. */
    type: FormulaTokenTypeCode;
    /** Single-char opcode for operators (e.g. "M" for unary minus). */
    opcode: FormulaOpcode;
    [key: string]: any;
  }

  interface FormulaOperand {
    type: FormulaOperandType;
    value: any;
    error?: string | number | null | undefined;
    [key: string]: any;
  }

  interface FormulaValueResult {
    value: any;
    type: FormulaOperandType;
    error?: string | number | null | undefined;
    [key: string]: any;
  }

  interface FormulaEvaluateResult {
    value: any;
    type: FormulaOperandType;
    error: string | number | null | undefined;
    [key: string]: any;
  }

  interface FormulaRangeParts {
    c1: number;
    r1: number;
    c2: number;
    r2: number;
    [key: string]: any;
  }

  interface FormulaDecodedRange {
    sheetdata: Sheet;
    sheetname: string;
    col1num: number;
    ncols: number;
    row1num: number;
    nrows: number;
    [key: string]: any;
  }

  interface FormulaStandardizedParameter {
    value: any;
    type: FormulaOperandType;
    /** Two-dim grid of Cell objects (col-major). Present when cell data was requested. */
    celldata?: Cell[][];
    /** Two-dim grid of A1-style coords (col-major), or null for non-ref parameters. */
    cellcoord?: (string | null)[][] | null;
    ncols: number;
    nrows: number;
    col1num: number;
    row1num: number;
    [key: string]: any;
  }

  /**
   * Signature for a FunctionList entry's callable. Implementations read
   * their arguments from `foperand` (in normal order), and push exactly
   * one result onto `operand`. Return non-null/non-undefined error text
   * to signal an error.
   */
  type FormulaFunctionImpl = (
    fname: string,
    operand: FormulaOperand[],
    foperand: FormulaOperand[],
    sheet: Sheet,
    coord?: string,
  ) => string | number | null | undefined | void;

  /**
   * FunctionList tuple:
   *   [0] implementation function
   *   [1] argcount (0, >0 exact, <0 at least, 100 unchecked)
   *   [2] arg-def name (key in FunctionArgDefs / Constants.s_farg_*)
   *   [3] function description
   *   [4] comma-separated class names (key in FunctionClasses)
   *   [5] cell HTML template for rendering (optional)
   *   [6] io-parameters: "ParameterList" | "EventTree" | "Input" | "TimeTrigger"
   */
  interface FormulaFunctionDefinition extends Array<any> {
    0: FormulaFunctionImpl;
    1: number;
    2?: string | null;
    3?: string | null;
    4?: string | null;
    5?: string | null;
    6?: string | null;
    [index: number]: any;
  }

  interface FormulaFunctionClassInfo {
    name: string;
    items: string[];
    [key: string]: any;
  }

  interface FormulaSheetCacheEntry {
    sheet: Sheet | null;
    recalcstate: number;
    name: string;
    [key: string]: any;
  }

  interface FormulaSheetCache {
    sheets: { [name: string]: FormulaSheetCacheEntry };
    waitingForLoading: string | null;
    constants: { asloaded: number; recalcing: number; recalcdone: number; [key: string]: any };
    /** Deprecated synchronous loader callback. */
    loadsheet: ((sheetname: string) => string) | null;
    [key: string]: any;
  }

  interface FormulaRemoteFunctionInfo {
    waitingForServer: string | null;
    [key: string]: any;
  }

  interface FormulaFreshnessInfo {
    sheets: { [name: string]: boolean };
    volatile: { [name: string]: boolean };
    recalc_completed: boolean;
    [key: string]: any;
  }

  namespace Formula {
    // --------------------------------------------------------------
    // Parse/state constants
    // --------------------------------------------------------------
    const ParseState: { [key: string]: number };
    const TokenType: { [key: string]: FormulaTokenTypeCode };
    const CharClass: { [key: string]: number };
    const CharClassTable: { [char: string]: number };
    const UpperCaseTable: { [char: string]: string };
    const SpecialConstants: { [key: string]: string };
    const TokenPrecedence: { [op: string]: number };
    const SPILL_MAX_COL: number;
    const SPILL_MAX_ROW: number;
    const SPILL_MAX_CELLS: number;
    function PlanSpillStatus(
      anchorCol: number,
      anchorRow: number,
      rows: number,
      cols: number,
      maxCol: number,
      maxRow: number,
      maxCells: number,
    ): number;
    function ClassifySpillClaim(
      isAnchorCell: boolean,
      isBlank: boolean,
      isOwnedBySameAnchor: boolean,
      isForeignSpill: boolean,
      hasUserContent: boolean,
      isMergedTarget: boolean,
    ): number;
    function ClassifyResizeMembership(inOld: boolean, inNew: boolean): number;
    function KeepUniqueItem(
      index: number,
      firstIndexOfValue: number,
      count: number,
      exactlyOnce: boolean,
    ): boolean;
    function StableTieCompare(comparatorResult: number, indexA: number, indexB: number): number;
    function DoubledAverageRank(bestRank: number, tieCount: number): number;
    function QuartileExcScaledPosition(n: number, quart: number): number;
    function IsValidQuartileExcPosition(n: number, quart: number): boolean;
    function MaterializeArray(sheet: Sheet, value: FormulaValueResult): FormulaArrayValue | null;
    function DynamicArrayFunctions(
      fname: string,
      operand: FormulaOperand[],
      foperand: FormulaOperand[],
      sheet: Sheet,
    ): void;
    const TokenOpExpansion: { [op: string]: string };
    const TypeLookupTable: { [key: string]: { [subtype: string]: string } };

    // --------------------------------------------------------------
    // Parser / evaluator
    // --------------------------------------------------------------
    function ParseFormulaIntoTokens(line: string): FormulaParseToken[];

    function ParsePushToken(
      parseinfo: FormulaParseToken[],
      ttext: string,
      ttype: FormulaTokenTypeCode,
      topcode: FormulaOpcode,
    ): void;

    function evaluate_parsed_formula(
      parseinfo: FormulaParseToken[],
      sheet: Sheet,
      allowrangereturn?: boolean | number,
    ): FormulaEvaluateResult;

    /**
     * Converts infix parseinfo to reverse-polish notation.
     * Returns an array of indexes into parseinfo on success, or an
     * error-text string on failure.
     */
    function ConvertInfixToPolish(parseinfo: FormulaParseToken[]): number[] | string;

    function EvaluatePolish(
      parseinfo: FormulaParseToken[],
      revpolish: number[] | string,
      sheet: Sheet,
      allowrangereturn?: boolean | number,
    ): FormulaEvaluateResult;

    function LookupResultType(
      type1: FormulaOperandType,
      type2: FormulaOperandType,
      typelookup: { [subtype: string]: string },
    ): FormulaOperandType;

    // --------------------------------------------------------------
    // Operand helpers — all pop one value from the operand stack and
    // return a typed result.
    // --------------------------------------------------------------
    function TopOfStackValueAndType(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandAsNumber(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandAsText(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandValueAndType(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandAsCoord(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandAsRange(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandAsType(
      sheet: Sheet,
      operand: FormulaOperand[],
      operandtype: FormulaOperandType,
    ): FormulaValueResult;
    function OperandsAsCoordOnSheet(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandsAsRangeOnSheet(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;
    function OperandAsSheetName(sheet: Sheet, operand: FormulaOperand[]): FormulaValueResult;

    function LookupName(sheet: Sheet, name: string, isEnd?: string | boolean): FormulaValueResult;

    function StepThroughRangeDown(
      operand: FormulaOperand[],
      rangevalue: string,
    ): FormulaValueResult | undefined;

    /**
     * @param range stack-style range value e.g. "A1|B3|" (optional !sheetname segment)
     */
    function DecodeRangeParts(
      sheetdata: Sheet,
      range: string,
      rangeType?: string,
    ): FormulaDecodedRange | null;

    // --------------------------------------------------------------
    // I/O event / form utilities (eddy extensions)
    // --------------------------------------------------------------
    function StoreIoEventFormula(
      function_name: string,
      coord: string,
      operand_reverse: FormulaOperand[],
      sheet: Sheet,
      io_parameters: string,
    ): void;

    function ArrayValuesEqual(a: any[], b: any[]): boolean;
    function Clone(destination: any, source: any): void;
    function LoadFormFields(): void;

    // --------------------------------------------------------------
    // Function-call plumbing
    // --------------------------------------------------------------
    function CalculateFunction(
      fname: string,
      operand: FormulaOperand[],
      sheet: Sheet,
      coord?: string,
    ): string | number | null | undefined;

    function PushOperand(operand: FormulaOperand[], t: FormulaOperandType, v: any): void;
    function CopyFunctionArgs(operand: FormulaOperand[], foperand: FormulaOperand[]): void;
    function FunctionArgsError(fname: string, operand: FormulaOperand[]): string;
    function FunctionSpecificError(
      fname: string,
      operand: FormulaOperand[],
      errortype: FormulaOperandType,
      errortext: string,
    ): string;
    function CheckForErrorValue(operand: FormulaOperand[], v: FormulaValueResult): boolean;

    function FillFunctionInfo(): void;
    function FunctionArgString(fname: string): string;

    // --------------------------------------------------------------
    // Function registries
    // --------------------------------------------------------------
    const FunctionList: { [name: string]: FormulaFunctionDefinition };
    let FunctionClasses: { [name: string]: FormulaFunctionClassInfo } | null;
    const FunctionArgDefs: { [name: string]: string };
    const ArgList: { [name: string]: number[] };

    // --------------------------------------------------------------
    // Built-in function implementations — all share the
    // (fname, operand, foperand, sheet) signature (IoFunctions takes
    // an extra `coord`).
    // --------------------------------------------------------------
    const SeriesFunctions: FormulaFunctionImpl;
    const SumProductFunction: FormulaFunctionImpl;
    const DSeriesFunctions: FormulaFunctionImpl;
    const RankMedianQuartileFunctions: FormulaFunctionImpl;
    const GcdLcmFunction: FormulaFunctionImpl;
    const PairedRangeStatFunctions: FormulaFunctionImpl;
    function PairedSums(
      ys: number[],
      xs: number[],
    ): { n: number; sx: number; sy: number; sxx: number; syy: number; sxy: number };
    function CollectNumericValues(
      sheet: Sheet,
      foperand: FormulaOperand[],
    ): { values: number[]; errortype: FormulaOperandType | "" };
    function CollectPairedNumericValues(
      sheet: Sheet,
      yOperand: FormulaOperand,
      xOperand: FormulaOperand,
    ): {
      ys: number[];
      xs: number[];
      errortype: FormulaOperandType | "";
      mismatched: boolean;
    };
    function FieldToColnum(
      sheet: Sheet,
      col1num: number,
      ncols: number,
      row1num: number,
      fieldname: any,
      fieldtype: FormulaOperandType,
    ): number;
    const LookupFunctions: FormulaFunctionImpl;
    const IndexFunction: FormulaFunctionImpl;
    const CountifSumifFunctions: FormulaFunctionImpl;
    const SumifsFunction: FormulaFunctionImpl;
    const IfFunction: FormulaFunctionImpl;
    const DateFunction: FormulaFunctionImpl;
    const TimeFunction: FormulaFunctionImpl;
    const DMYFunctions: FormulaFunctionImpl;
    const EDateEoMonthFunctions: FormulaFunctionImpl;
    const DateDifFunction: FormulaFunctionImpl;
    function SundayDowForSerial(serial: number): number;
    function IsoWeekNumForSerial(serial: number): number;
    const WeekNumFunctions: FormulaFunctionImpl;
    const YearFracFunction: FormulaFunctionImpl;
    const DEFAULT_WEEKEND_MASK: number;
    function DecodeWeekendArgument(
      value: unknown,
      valuetype: FormulaOperandType,
    ): { mask: number; errortype: string };
    function CollectHolidaySerials(
      sheet: Sheet,
      holidayoperand: FormulaOperand,
    ): Set<number> | null;
    const WorkdayNetworkdaysFunctions: FormulaFunctionImpl;
    const HMSFunctions: FormulaFunctionImpl;
    const ExactFunction: FormulaFunctionImpl;
    const StringFunctions: FormulaFunctionImpl;
    const IsFunctions: FormulaFunctionImpl;
    const NTVFunctions: FormulaFunctionImpl;
    const Math1Functions: FormulaFunctionImpl;
    const Math2Functions: FormulaFunctionImpl;
    const LogFunction: FormulaFunctionImpl;
    const RoundFunction: FormulaFunctionImpl;
    const CeilingFloorFunctions: FormulaFunctionImpl;
    const AndOrFunctions: FormulaFunctionImpl;
    const NotFunction: FormulaFunctionImpl;
    const ChooseFunction: FormulaFunctionImpl;
    const ColumnsRowsFunctions: FormulaFunctionImpl;
    const ZeroArgFunctions: FormulaFunctionImpl;

    // Financial
    const DDBFunction: FormulaFunctionImpl;
    const SLNFunction: FormulaFunctionImpl;
    const SYDFunction: FormulaFunctionImpl;
    const InterestFunctions: FormulaFunctionImpl;
    const PPMTIPMTFunctions: FormulaFunctionImpl;
    const NPVFunction: FormulaFunctionImpl;
    const IRRFunction: FormulaFunctionImpl;
    const MIRRFunction: FormulaFunctionImpl;
    const XNPVFunction: FormulaFunctionImpl;
    const XIRRFunction: FormulaFunctionImpl;
    function CollectAlignedPairedRanges(
      sheet: Sheet,
      aoperand: FormulaOperand[],
      boperand: FormulaOperand[],
    ): {
      avalues: FormulaValueResult[];
      bvalues: FormulaValueResult[];
      mismatched: boolean;
    };
    function ResolveXCashflowSchedule(
      avalues: FormulaValueResult[],
      bvalues: FormulaValueResult[],
    ): { values: number[]; dates: number[]; errortype: FormulaOperandType | "" };
    function ComputeXNPVValue(rate: number, values: number[], dates: number[]): number;
    function ComputeXNPVDerivative(rate: number, values: number[], dates: number[]): number;
    function SolveXIRRRate(values: number[], dates: number[], guess: number): number | null;

    // I/O widget functions (BUTTON, TEXTBOX, COPYVALUE, EMAIL, PANEL, STYLE, etc.)
    const IoFunctions: FormulaFunctionImpl;

    // Logical/error/text compatibility functions (IFERROR/IFNA/IFS/SWITCH,
    // TEXTJOIN/JOIN, TEXTBEFORE/TEXTAFTER, SPLIT/TEXTSPLIT, REGEXMATCH/
    // REGEXEXTRACT/REGEXREPLACE, SEARCH via StringFunctions).
    const IfErrorFunction: FormulaFunctionImpl;
    const IfsFunction: FormulaFunctionImpl;
    const SwitchFunction: FormulaFunctionImpl;
    function TextJoinCollect(
      sheet: Sheet,
      foperand: FormulaOperand[],
      delim: string,
      ignoreEmpty: boolean,
    ): FormulaValueResult;
    const TextJoinFunction: FormulaFunctionImpl;
    const JoinFunction: FormulaFunctionImpl;
    const TextBeforeAfterFunction: FormulaFunctionImpl;
    const SplitFunction: FormulaFunctionImpl;
    const TextSplitFunction: FormulaFunctionImpl;
    function CompileRegex(pattern: string, flags: string): RegExp | null;
    function TranslateRegexReplacement(repl: string): string;
    const RegexMatchFunction: FormulaFunctionImpl;
    const RegexExtractFunction: FormulaFunctionImpl;
    const RegexReplaceFunction: FormulaFunctionImpl;

    // --------------------------------------------------------------
    // Parameter/range standardizers
    // --------------------------------------------------------------
    function getStandardizedValues(
      sheet: Sheet,
      parameterData: FormulaOperand,
    ): FormulaStandardizedParameter;
    function getStandardizedCoords(
      sheet: Sheet,
      parameterData: FormulaOperand,
    ): FormulaStandardizedParameter;
    function getStandardizedList(sheet: Sheet, listParameter: FormulaOperand): string[];
    function getStandardizedParameter(
      sheet: Sheet,
      parameterData: FormulaOperand,
      includeCellCoord?: boolean,
      includeCellData?: boolean,
    ): FormulaStandardizedParameter;

    // --------------------------------------------------------------
    // Sheet cache / freshness
    // --------------------------------------------------------------
    const SheetCache: FormulaSheetCache;
    function FindInSheetCache(sheetname: string): Sheet | null;
    function AddSheetToCache(sheetname: string, str: string, live?: boolean): Sheet | null;
    function NormalizeSheetName(sheetname: string): string;

    const RemoteFunctionInfo: FormulaRemoteFunctionInfo;
    const FreshnessInfo: FormulaFreshnessInfo;
    function FreshnessInfoReset(): void;

    // --------------------------------------------------------------
    // Misc helpers
    // --------------------------------------------------------------
    /** Returns coord with any "$" stripped. */
    function PlainCoord(coord: string): string;
    /**
     * Returns {c1,r1,c2,r2} with the upper-left / lower-right col+row
     * numbers for two corner coords like "A1" and "B3".
     */
    function OrderRangeParts(coord1: string, coord2: string): FormulaRangeParts;
    function TestCriteria(value: any, type: FormulaOperandType, criteria: any): boolean;
  }

  namespace TriggerIoAction {
    function AddAutocomplete(triggerCellId: string): void;
    function Button(triggerCellId: string): void;
    function CopyFormulaToRange(
      formulaData: FormulaStandardizedParameter,
      destcr: { col: number; row: number; [key: string]: any },
    ): string;
    function CopyValueToRange(
      sourceData: FormulaStandardizedParameter,
      destcr: { col: number; row: number; [key: string]: any },
    ): string;
    function Email(
      emailFormulaCellId: string,
      optionalTriggerCellId?: string | null,
    ): any[] | undefined;
    function Submit(triggerCellId: string): void;
    function SelectList(selectListCellId: string): void;
    function AutoComplete(autoCompleteCellId: string): void;
    function TextBox(textBoxCellId: string): void;
    function CheckBox(checkBoxCellId: string): void;
    function RadioButton(radioButtonGroupName: string): void;
    function updateInputWidgetFormula(
      function_name: string,
      widgetCellId: string,
      getHTMLWidgetCellValue: (widget: any) => string,
    ): void;
    function UpdateFormDataSheet(
      function_name: string,
      formCellId: string,
      inputValue: string,
    ): void;
  }

  // Introduced by this file (in case other swarm files don't declare them)
  var debug_log: any[];
  function DebugLog(logObject: any): void;
}
