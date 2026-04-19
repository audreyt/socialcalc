declare namespace SocialCalc {

    interface FormulaParseToken {
        text: string;
        type: number;
        opcode: number | string;
        [key: string]: any;
    }

    interface FormulaOperand {
        type: string;
        value: any;
        error?: string;
        [key: string]: any;
    }

    interface FormulaValueResult {
        value: any;
        type: string;
        error?: string;
        [key: string]: any;
    }

    interface FormulaEvaluateResult {
        value: any;
        type: string;
        error: string;
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
        sheetdata: any;
        sheetname: string;
        col1num: number;
        ncols: number;
        row1num: number;
        nrows: number;
        [key: string]: any;
    }

    interface FormulaStandardizedParameter {
        value: any;
        type: string;
        celldata?: any[][];
        cellcoord?: any[][] | null;
        ncols: number;
        nrows: number;
        col1num: number;
        row1num: number;
        [key: string]: any;
    }

    interface FormulaFunctionDefinition extends Array<any> {
        0: Function;
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
        sheet: any;
        recalcstate: number;
        name: string;
        [key: string]: any;
    }

    interface FormulaSheetCache {
        sheets: { [name: string]: FormulaSheetCacheEntry };
        waitingForLoading: string | null;
        constants: { asloaded: number; recalcing: number; recalcdone: number; [key: string]: any };
        loadsheet: any;
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

        // Parse/state constants
        const ParseState: { [key: string]: number };
        const TokenType: { [key: string]: number };
        const CharClass: { [key: string]: number };
        const CharClassTable: { [char: string]: number };
        const UpperCaseTable: { [char: string]: string };
        const SpecialConstants: { [key: string]: string };
        const TokenPrecedence: { [op: string]: number };
        const TokenOpExpansion: { [op: string]: string };
        const TypeLookupTable: { [key: string]: { [subtype: string]: string } };

        // Parser / evaluator
        function ParseFormulaIntoTokens(line: string): FormulaParseToken[];
        function ParsePushToken(
            parseinfo: FormulaParseToken[],
            ttext: string,
            ttype: number,
            topcode: number | string
        ): void;

        function evaluate_parsed_formula(
            parseinfo: FormulaParseToken[],
            sheet: any,
            allowrangereturn?: boolean | number
        ): FormulaEvaluateResult;

        function ConvertInfixToPolish(parseinfo: FormulaParseToken[]): number[] | string;

        function EvaluatePolish(
            parseinfo: FormulaParseToken[],
            revpolish: number[] | string,
            sheet: any,
            allowrangereturn?: boolean | number
        ): FormulaEvaluateResult;

        function LookupResultType(type1: string, type2: string, typelookup: any): string;

        // Operand helpers
        function TopOfStackValueAndType(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandAsNumber(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandAsText(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandValueAndType(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandAsCoord(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandAsRange(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandAsType(sheet: any, operand: FormulaOperand[], operandtype: string): FormulaValueResult;
        function OperandsAsCoordOnSheet(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandsAsRangeOnSheet(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function OperandAsSheetName(sheet: any, operand: FormulaOperand[]): FormulaValueResult;
        function LookupName(sheet: any, name: string, isEnd?: any): FormulaValueResult;

        function StepThroughRangeDown(
            operand: FormulaOperand[],
            rangevalue: string
        ): FormulaValueResult | undefined;

        function DecodeRangeParts(sheetdata: any, range: string): FormulaDecodedRange | null;

        // I/O event / form utilities (eddy extensions)
        function StoreIoEventFormula(
            function_name: string,
            coord: string,
            operand_reverse: FormulaOperand[],
            sheet: any,
            io_parameters: string
        ): void;

        function ArrayValuesEqual(a: any[], b: any[]): boolean;
        function Clone(destination: any, source: any): void;
        function LoadFormFields(): void;

        // Function-call plumbing
        function CalculateFunction(
            fname: string,
            operand: FormulaOperand[],
            sheet: any,
            coord?: string
        ): string;

        function PushOperand(operand: FormulaOperand[], t: string, v: any): void;
        function CopyFunctionArgs(operand: FormulaOperand[], foperand: FormulaOperand[]): void;
        function FunctionArgsError(fname: string, operand: FormulaOperand[]): string;
        function FunctionSpecificError(
            fname: string,
            operand: FormulaOperand[],
            errortype: string,
            errortext: string
        ): string;
        function CheckForErrorValue(operand: FormulaOperand[], v: FormulaValueResult): boolean;

        function FillFunctionInfo(): void;
        function FunctionArgString(fname: string): string;

        // Function registries (values are arrays of [func, argcount, argdef, fdef, class, html, ioparams])
        const FunctionList: { [name: string]: FormulaFunctionDefinition };
        let FunctionClasses: { [name: string]: FormulaFunctionClassInfo } | null;
        const FunctionArgDefs: { [name: string]: string };
        const ArgList: { [name: string]: number[] };

        // Built-in function implementations (all share the fname/operand/foperand/sheet signature)
        function SeriesFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function SumProductFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function DSeriesFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function FieldToColnum(
            sheet: any,
            col1num: number,
            ncols: number,
            row1num: number,
            fieldname: any,
            fieldtype: string
        ): number;
        function LookupFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function IndexFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function CountifSumifFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function SumifsFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function IfFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function DateFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function TimeFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function DMYFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function HMSFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function ExactFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function StringFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function IsFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function NTVFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function Math1Functions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function Math2Functions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function LogFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function RoundFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function CeilingFloorFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function AndOrFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function NotFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function ChooseFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function ColumnsRowsFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function ZeroArgFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;

        // Financial
        function DDBFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function SLNFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function SYDFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function InterestFunctions(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function NPVFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;
        function IRRFunction(fname: string, operand: FormulaOperand[], foperand: FormulaOperand[], sheet: any): string | null | undefined;

        // I/O widget functions (BUTTON, TEXTBOX, COPYVALUE, EMAIL, PANEL, STYLE, etc.)
        function IoFunctions(
            fname: string,
            operand: FormulaOperand[],
            foperand: FormulaOperand[],
            sheet: any,
            coord?: string
        ): string | null | undefined;

        // Parameter/range standardizers
        function getStandardizedValues(sheet: any, parameterData: any): FormulaStandardizedParameter;
        function getStandardizedCoords(sheet: any, parameterData: any): FormulaStandardizedParameter;
        function getStandardizedList(sheet: any, listParameter: any): string[];
        function getStandardizedParameter(
            sheet: any,
            parameterData: any,
            includeCellCoord?: boolean,
            includeCellData?: boolean
        ): FormulaStandardizedParameter;

        // Sheet cache / freshness
        const SheetCache: FormulaSheetCache;
        function FindInSheetCache(sheetname: string): any;
        function AddSheetToCache(sheetname: string, str: string, live?: boolean): any;
        function NormalizeSheetName(sheetname: string): string;

        const RemoteFunctionInfo: FormulaRemoteFunctionInfo;
        const FreshnessInfo: FormulaFreshnessInfo;
        function FreshnessInfoReset(): void;

        // Misc helpers
        function PlainCoord(coord: string): string;
        function OrderRangeParts(coord1: string, coord2: string): FormulaRangeParts;
        function TestCriteria(value: any, type: string, criteria: any): boolean;
    }

    namespace TriggerIoAction {
        function AddAutocomplete(triggerCellId: string): void;
        function Button(triggerCellId: string): void;
        function CopyFormulaToRange(formulaData: any, destcr: { col: number; row: number; [key: string]: any }): string;
        function CopyValueToRange(sourceData: any, destcr: { col: number; row: number; [key: string]: any }): string;
        function Email(emailFormulaCellId: string, optionalTriggerCellId?: string | null): any[];
        function Submit(triggerCellId: string): void;
        function SelectList(selectListCellId: string): void;
        function AutoComplete(autoCompleteCellId: string): void;
        function TextBox(textBoxCellId: string): void;
        function CheckBox(checkBoxCellId: string): void;
        function RadioButton(radioButtonGroupName: string): void;
        function updateInputWidgetFormula(
            function_name: string,
            widgetCellId: string,
            getHTMLWidgetCellValue: (widget: any) => string
        ): void;
        function UpdateFormDataSheet(function_name: string, formCellId: string, inputValue: string): void;
    }

    // Introduced by this file (in case other swarm files don't declare them)
    var debug_log: any[];
    function DebugLog(logObject: any): void;
}
