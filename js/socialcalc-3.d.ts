declare namespace SocialCalc {
  // Shape of {def, val} used by EncodeCellAttributes / DecodeCellAttributes etc.
  interface AttribValue {
    def: boolean;
    val: string;
  }
  type AttribSet = { [name: string]: AttribValue };

  // Palette-index style fields for one conditional-formatting rule; each is
  // 0 (unset) or an index into the owning Sheet's font/color/borderstyle
  // arrays, exactly like Cell.font/color/bgcolor/bt/br/bb/bl.
  interface CondFmtStyle {
    font: number;
    color: number;
    bgcolor: number;
    bt: number;
    br: number;
    bb: number;
    bl: number;
  }

  // One conditional-formatting rule. Rules live in Sheet.condfmtRules,
  // ordered array index 0 = highest priority (stop-if-true precedence).
  // type: "cellis" | "textcontains" | "textbegins" | "textends" | "blank" |
  //       "nonblank" | "duplicate" | "unique" | "formula"
  // op (cellis only): "gt" | "ge" | "lt" | "le" | "eq" | "ne" | "between"
  interface CondFmtRule {
    id: number;
    range: string;
    type: string;
    op: string;
    value1: string;
    value2: string;
    formula: string;
    stopIfTrue: boolean;
    style: CondFmtStyle;
  }

  // Opt-in policy consulted by rendering code only when
  // SocialCalc.Callbacks.untrustedContent is true. See socialcalc-3.ts
  // SafeUrlForRender / EscapeUntrustedHtml for how each field is used.
  interface RenderSecurityPolicy {
    // Sanitizer applied to raw HTML content (the "text-html" format and the
    // "@r" placeholder of "text-custom:" formats) instead of the default of
    // HTML-escaping it as inert text. Should return safe HTML.
    sanitizeHtml: ((html: string) => string) | null;
    // URL schemes (including the trailing ":") allowed for link/image
    // targets ("text-url", "text-image", "text-link", and the "@u"
    // placeholder). Compared case-insensitively.
    allowedUrlSchemes: string[];
    // "data:" URLs are rejected unless their MIME type (the part between
    // "data:" and the first "," or ";") is listed here, e.g. ["image/png"].
    allowedDataMimeTypes: string[];
  }

  // --- AutoFilter -----------------------------------------------------------
  //
  // A per-column criterion. "values" is an exact-match allowlist (checked
  // set semantics: cell text must be in the set to pass); "op"/"op2" encode
  // comparison/text/date criteria in the same vocabulary as
  // SocialCalc.Formula.TestCriteria ("<", "<=", ">", ">=", "<>", "=", or a
  // bare/quoted value meaning "="; wildcard * and ? are honored for text).
  // Both a values allowlist and comparison operators may be present; a row
  // passes the column only if it satisfies every present sub-criterion
  // (values allowlist AND op AND op2, each optional).
  interface AutoFilterCriterion {
    values?: string[]; // exact-match allowlist; absent/undefined = no allowlist restriction
    op?: string; // e.g. ">=", "<", "<>10", "*abc*" -- fed directly to TestCriteria
    op2?: string; // second comparison, ANDed with op (e.g. between: >=1 AND <=10)
  }
  interface AutoFilterDef {
    id: string; // stable id, also the autofilters dictionary key
    range: string; // "A1:D20" rectangular range, row 1 of range is the header
    criteria: { [colOffset: number]: AutoFilterCriterion }; // 0-based offset from range's first column
  }

  // --- Structured tables ------------------------------------------------------
  //
  // Closed built-in banded-style palette; not arbitrary CSS. "none" disables
  // banding. Table names share the same sanitization/uniqueness rules as
  // SocialCalc named ranges (see socialcalc-3.ts ExecuteSheetCommand "table").
  type TableStyle = "none" | "light1" | "light2" | "medium1" | "medium2" | "dark1";
  interface StructuredTableDef {
    name: string; // unique per-sheet identifier, also the tables dictionary key
    range: string; // "A1:D20" rectangular range
    hasHeader: boolean;
    style: TableStyle;
    filterId: string | null; // id into sheet.autofilters when hasHeader, else null
  }

  const Callbacks: {
    expand_wiki:
      | ((displayvalue: string, sheetobj: Sheet, linkstyle: unknown, valueformat: string) => string)
      | null;
    expand_markup: (displayvalue: string, sheetobj: Sheet, linkstyle: unknown) => string;
    MakePageLink:
      | ((
          pagename: string,
          workspacename: string,
          linkstyle: unknown,
          valueformat: string,
        ) => string)
      | null;
    NormalizeSheetName: ((name: string) => string) | null;
    // Opt-in: renders sheets in "untrusted" mode (raw HTML escaped, link/
    // image URL schemes allowlisted). Default false preserves legacy output.
    untrustedContent: boolean;
    // Consulted only when untrustedContent is true.
    securityPolicy: RenderSecurityPolicy;
    [key: string]: any;
  };

  const CellProperties: { [name: string]: number };
  const CellPropertiesTable: { [name: string]: string };

  class Cell {
    constructor(coord: string);

    coord: string;
    datavalue: string | number;
    datatype: "v" | "t" | "f" | "c" | null;
    formula: string;
    /**
     * First char is main type: b=blank, n=numeric, t=text, e=error.
     * Following chars are sub-types (e.g. "n$", "nl", "nt", "ndt", "th", "tl").
     */
    valuetype: string;
    readonly: boolean;
    unlocked: boolean;

    errors: string;
    comment: string;
    displayvalue: string;
    parseinfo: any;
    spillrows?: number;
    spillcols?: number;
    spillowner?: string;
    spillrow?: number;
    spillcol?: number;

    bt: number;
    br: number;
    bb: number;
    bl: number;
    layout: number;
    font: number;
    color: number;
    bgcolor: number;
    cellformat: number;
    nontextvalueformat: number;
    textvalueformat: number;
    colspan: number;
    rowspan: number;
    cssc: string;
    csss: string;
    mod: string;

    displaystring: string;
    hcolspan: number;
    hrowspan: number;

    [key: string]: any;
  }

  class Sheet {
    constructor();

    cells: { [coord: string]: Cell };
    attribs: {
      lastcol: number;
      lastrow: number;
      defaultlayout: number;
      usermaxcol: number;
      usermaxrow: number;
      defaultcolwidth: string;
      defaultrowheight: number;
      defaulttextformat: number;
      defaultnontextformat: number;
      defaultfont: number;
      defaulttextvalueformat: number;
      defaultnontextvalueformat: number;
      defaultcolor: number;
      defaultbgcolor: number;
      circularreferencecell: string;
      recalc: string;
      needsrecalc: string;
      [key: string]: any;
    };
    rowattribs: {
      hide: { [row: number]: string };
      height: { [row: number]: number };
      filterhide: { [row: number]: string };
    };
    colattribs: {
      width: { [col: string]: string };
      hide: { [col: string]: string };
    };
    names: { [name: string]: { desc: string; definition: string } };
    autofilters: { [id: string]: AutoFilterDef };
    tables: { [name: string]: StructuredTableDef };
    condfmtRules: CondFmtRule[];
    condfmtNextId: number;
    condfmtRulesVersion: number;
    condfmtValueVersion: number;
    layouts: string[];
    layouthash: { [key: string]: number };
    fonts: string[];
    fonthash: { [key: string]: number };
    colors: string[];
    colorhash: { [key: string]: number };
    borderstyles: string[];
    borderstylehash: { [key: string]: number };
    cellformats: string[];
    cellformathash: { [key: string]: number };
    valueformats: string[];
    valueformathash: { [key: string]: number };
    matched_cells: string[];
    selected_search_cell: string | undefined;
    copiedfrom: string;
    changes: UndoStack;
    renderneeded: boolean;
    changedrendervalues: boolean;
    recalcchangedavalue: boolean;
    hiddencolrow: string;
    sci: SheetCommandInfo;
    ioEventTree: { [key: string]: any };
    ioParameterList: { [key: string]: any };
    statuscallback: ((data: any, status: string, arg: any, params: any) => void) | null;
    statuscallbackparams: any;
    xlt: any;

    ResetSheet(): void;
    AddCell(newcell: Cell): Cell;
    LastCol(): number;
    LastRow(): number;
    GetAssuredCell(coord: string): Cell;
    ParseSheetSave(savedsheet: string): void;
    CellFromStringParts(cell: Cell, parts: string[], j: number): void;
    CreateSheetSave(range?: string, canonicalize?: boolean): string;
    CellToString(cell: Cell): string;
    CanonicalizeSheet(full?: boolean): void;
    EncodeCellAttributes(coord: string): AttribSet;
    EncodeSheetAttributes(): AttribSet;
    DecodeCellAttributes(coord: string, attribs: AttribSet, range?: string): string | null;
    DecodeSheetAttributes(attribs: AttribSet): string | null;
    ScheduleSheetCommands(cmd: string, saveundo?: boolean): void;
    SheetUndo(): void;
    SheetRedo(): void;
    CreateAuditString(): string;
    GetStyleNum(atype: string, style: string): number;
    GetStyleString(atype: string, num: number): string | null;
    RecalcSheet(): void;

    [key: string]: any;
  }

  function ResetSheet(sheet: Sheet, reload?: boolean): void;
  function ParseSheetSave(savedsheet: string, sheetobj: Sheet): void;
  function CellFromStringParts(sheet: Sheet, cell: Cell, parts: string[], j: number): void;

  const sheetfields: string[];
  const sheetfieldsshort: string[];
  const sheetfieldsxlat: string[];
  function ClearSpill(sheet: Sheet, anchor: Cell): boolean;
  function MaterializeSpill(
    sheet: Sheet,
    coord: string,
    result: {
      value: { rows: number; cols: number; cells: Array<Array<{ value: unknown; type: string }>> };
      type: string;
    },
  ): { value: unknown; type: string } | null;
  function SpillOwnerForCoord(sheet: Sheet, coord: string): string;
  const SpillCommandError: string;
  function PrepareSpillMutation(sheet: Sheet, ranges: any[], blockAnchors: boolean): string;
  function ClearAllDerivedSpills(sheet: Sheet): void;
  function SanitizeSpills(sheet: Sheet): void;

  // --- AutoFilter / structured table runtime -------------------------------
  function RowEffectivelyHidden(sheet: Sheet, row: number): boolean;
  function RecomputeAutoFilters(sheet: Sheet): void;
  function RecomputeAutoFilter(sheet: Sheet, filterId: string): void;
  function CollectAutoFilterColumnValues(
    sheet: Sheet,
    filterId: string,
    colOffset: number,
  ): string[];
  function AdjustAutoFilterRangesForStructuralEdit(
    sheet: Sheet,
    startCol: number,
    coloffset: number,
    startRow: number,
    rowoffset: number,
  ): void;
  function SanitizeTableName(name: string): string;
  function SubtotalExcludesRow(sheet: Sheet, row: number, includeManualHidden: boolean): boolean;
  function AutoFilterCellFailsCriterion(
    sheet: Sheet,
    criterion: AutoFilterCriterion,
    cr: string,
  ): boolean;
  function FindAutoFilterForHeaderCell(
    sheet: Sheet,
    rownum: number,
    colnum: number,
  ): { filterId: string; colOffset: number } | null;
  function BuildAutoFilterDropdownHtml(sheet: Sheet, filterId: string, colOffset: number): string;
  function ShowAutoFilterDropdown(
    sheet: Sheet,
    filterId: string,
    colOffset: number,
    anchorElement: HTMLElement,
  ): void;
  function AutoFilterDropdownToggleAll(checkedState: boolean): void;
  function AutoFilterDropdownToggleValue(box: HTMLInputElement): void;
  function AutoFilterDropdownApply(): void;
  function AutoFilterDropdownClear(): void;
  function AutoFilterDropdownCancel(): void;
  function AutoFilterDropdownClose(): void;
  const AutoFilterDropdownState: {
    popupele: HTMLElement | null;
    sheet: Sheet | null;
    filterId: string;
    colOffset: number;
    checked: { [value: string]: boolean };
  };
  const sheetfieldsxlatshort: string[];
  const sheetfieldsxlatxlt: string[];

  function CreateSheetSave(sheetobj: Sheet, range?: string, canonicalize?: boolean): string;
  function CellToString(sheet: Sheet, cell: Cell): string;
  function CanonicalizeSheet(sheetobj: Sheet, full?: boolean): void;
  function EncodeCellAttributes(sheet: Sheet, coord: string): AttribSet;
  function EncodeSheetAttributes(sheet: Sheet): AttribSet;
  function DecodeCellAttributes(
    sheet: Sheet,
    coord: string,
    newattribs: AttribSet,
    range?: string,
  ): string | null;
  function DecodeSheetAttributes(sheet: Sheet, newattribs: AttribSet): string | null;

  interface SheetCommandInfo {
    sheetobj: Sheet;
    timerobj: ReturnType<typeof setTimeout> | null;
    firsttimerdelay: number;
    timerdelay: number;
    maxtimeslice: number;
    saveundo: boolean;
    CmdExtensionCallbacks: {
      [name: string]: {
        func: (
          cmdname: string,
          data: any,
          sheet: Sheet,
          parseobj: Parse,
          saveundo: boolean,
        ) => void;
        data: any;
      };
    };
    [key: string]: any;
  }

  // Runtime also uses SocialCalc.SheetCommandInfo as a singleton command bag
  // (with CmdExtensionCallbacks), not only as a constructible class.
  interface SheetCommandInfoConstructor {
    new (sheetobj: Sheet): SheetCommandInfo;
    (sheetobj: Sheet): SheetCommandInfo;
    prototype: SheetCommandInfo;
    CmdExtensionCallbacks: SheetCommandInfo["CmdExtensionCallbacks"];
    [key: string]: any;
  }

  var SheetCommandInfo: SheetCommandInfoConstructor;

  function ScheduleSheetCommands(sheet: Sheet, cmdstr: string, saveundo?: boolean): void;
  function SheetCommandsTimerRoutine(
    sci: SheetCommandInfo,
    parseobj: Parse,
    saveundo?: boolean,
  ): void;
  function ExecuteSheetCommand(sheet: Sheet, cmd: Parse, saveundo?: boolean): string;
  function IsSheetProtected(sheet: Sheet): boolean;
  function IsCellEditable(sheet: Sheet, coord: string): boolean;

  function SheetUndo(sheet: Sheet): void;
  function SheetRedo(sheet: Sheet): void;
  function CreateAuditString(sheet: Sheet): string;
  function GetStyleNum(sheet: Sheet, atype: string, style: string): number;
  function GetStyleString(sheet: Sheet, atype: string, num: number): string | null;

  function CondFmtCoordInRange(range: string, col: number, row: number): boolean;
  function CondFmtValueCounts(sheet: Sheet, range: string): Map<string, number>;
  function CondFmtCompare(value: unknown, operand: unknown): number;
  function CondFmtRuleMatches(
    sheet: Sheet,
    rule: CondFmtRule,
    cell: Cell | undefined,
    coord: string,
  ): boolean;
  function EvaluateCondFmtForCell(sheet: Sheet, coord: string): CondFmtStyle | null;
  function OffsetFormulaCoords(
    formula: string,
    coloffset: number,
    rowoffset: number,
    band?: { startCol?: number; endCol?: number; startRow?: number; endRow?: number },
  ): string;
  function AdjustFormulaCoords(
    formula: string,
    col: number,
    coloffset: number,
    row: number,
    rowoffset: number,
  ): string;
  function ReplaceFormulaCoords(formula: string, movedto: { [coord: string]: string }): string;

  const RecalcInfo: {
    sheet: Sheet | null;
    currentState: number;
    state: {
      idle: number;
      start_calc: number;
      order: number;
      calc: number;
      start_wait: number;
      done_wait: number;
    };
    recalctimer: ReturnType<typeof setTimeout> | null;
    maxtimeslice: number;
    timeslicedelay: number;
    starttime: number | Date;
    queue: Sheet[];
    LoadSheet: (sheetname: string) => boolean;
    [key: string]: any;
  };

  class RecalcData {
    constructor();

    inrecalc: boolean;
    celllist: string[];
    celllistitem: number;
    calclist: { [coord: string]: string } | null;
    calclistlength: number;
    firstcalc: string | null;
    lastcalc: string | null;
    nextcalc: string | null;
    count: number;
    checkinfo: { [coord: string]: RecalcCheckInfo | true };

    [key: string]: any;
  }

  class RecalcCheckInfo {
    constructor();

    oldcoord: string | null;
    parsepos: number;
    inrange: boolean;
    inrangestart: boolean;
    cr1: { row: number; col: number } | null;
    cr2: { row: number; col: number } | null;
    c1: number | null;
    c2: number | null;
    r1: number | null;
    r2: number | null;
    c: number | null;
    r: number | null;

    [key: string]: any;
  }

  function RecalcSheet(sheet: Sheet): void;
  function RecalcSetTimeout(): void;
  function RecalcClearTimeout(): void;
  function RecalcLoadedSheet(
    sheetname: string | null,
    str: string,
    recalcneeded: boolean,
    live?: boolean,
  ): void;
  function RecalcTimerRoutine(): void;
  function RecalcCheckCell(sheet: Sheet, startcoord: string): string;

  class Parse {
    constructor(str: string);

    str: string;
    pos: number;
    delimiter: string;
    lineEnd: number;

    NextToken(): string;
    RestOfString(): string;
    RestOfStringNoMove(): string;
    NextLine(): void;
    EOF(): boolean;

    [key: string]: any;
  }

  class UndoStack {
    constructor();

    stack: Array<{ command: string[]; type: string; undo: string[] }>;
    tos: number;
    maxRedo: number;
    maxUndo: number;

    PushChange(type: string): void;
    AddDo(...args: Array<string | number | null | undefined>): void;
    AddUndo(...args: Array<string | number | null | undefined>): void;
    TOS(): { command: string[]; type: string; undo: string[] } | null;
    Undo(): boolean;
    Redo(): boolean;

    [key: string]: any;
  }

  const Clipboard: {
    clipboard: string;
    [key: string]: any;
  };

  class RenderContext {
    constructor(sheetobj: Sheet);

    sheetobj: Sheet;
    hideRowsCols: boolean;
    showGrid: boolean;
    showRCHeaders: boolean;
    rownamewidth: number | string;
    pixelsPerRow: number;

    cellskip: { [coord: string]: string } | null;
    coordToCR: { [coord: string]: { row: number; col: number } };
    colwidth: string[];
    rowheight: string[];
    totalwidth: number;
    totalheight: number;

    rowpanes: Array<{ first: number; last: number }>;
    colpanes: Array<{ first: number; last: number }>;
    colunhideleft: HTMLElement[];
    colunhideright: HTMLElement[];
    rowunhidetop: HTMLElement[];
    rowunhidebottom: HTMLElement[];
    maxcol: number;
    maxrow: number;

    highlights: { [coord: string]: string };
    cursorsuffix: string;
    highlightTypes: { [key: string]: { style: string; className: string } };

    cellIDprefix: string;
    defaultlinkstyle: unknown;
    defaultHTMLlinkstyle: { type: string };

    defaultfontstyle: string;
    defaultfontsize: string;
    defaultfontfamily: string;
    defaultlayout: string;
    defaultpanedividerwidth: number | string;
    defaultpanedividerheight: number | string;

    gridCSS: string;
    commentClassName: string;
    commentCSS: string;
    commentNoGridClassName: string;
    commentNoGridCSS: string;

    readonlyClassName: string;
    readonlyCSS: string;
    readonlyNoGridClassName: string;
    readonlyNoGridCSS: string;
    readonlyComment: string;
    lockedComment: string;

    classnames: { [key: string]: string };
    explicitStyles: { [key: string]: string };

    needcellskip: boolean;
    fonts: Array<{ style: string; weight: string; size: string; family: string }>;
    layouts: string[];
    needprecompute: boolean;

    usermaxcol: number;
    usermaxrow: number;

    PrecomputeSheetFontsAndLayouts(): void;
    CalculateCellSkipData(): void;
    CalculateColWidthData(): void;
    CalculateRowHeightData(): void;
    SetRowPaneFirstLast(panenum: number, first: number, last: number): void;
    SetColPaneFirstLast(panenum: number, first: number, last: number): void;
    CoordInPane(coord: string, rowpane: number, colpane: number): boolean;
    CellInPane(row: number, col: number, rowpane: number, colpane: number): boolean;
    InitializeTable(tableobj: HTMLTableElement): void;
    RenderSheet(oldtable: HTMLTableElement | null, linkstyle?: unknown): HTMLTableElement;
    RenderColGroup(): HTMLElement;
    RenderColHeaders(): HTMLElement | null;
    RenderSizingRow(): HTMLElement;
    RenderRow(rownum: number, rowpane: number, linkstyle?: unknown): HTMLElement;
    RenderSpacingRow(): HTMLElement;
    RenderCell(
      rownum: number,
      colnum: number,
      rowpane: number,
      colpane: number,
      noElement?: boolean,
      linkstyle?: unknown,
    ): HTMLElement | PseudoElement | null;

    [key: string]: any;
  }

  interface PseudoElement {
    style: { cssText: string };
    innerHTML: string;
    className: string;
  }

  function PrecomputeSheetFontsAndLayouts(context: RenderContext): void;
  function CalculateCellSkipData(context: RenderContext): void;
  function CalculateColWidthData(context: RenderContext): void;
  function CalculateRowHeightData(context: RenderContext): void;
  function InitializeTable(context: RenderContext, tableobj: HTMLTableElement): void;
  function RenderSheet(
    context: RenderContext,
    oldtable: HTMLTableElement | null,
    linkstyle?: unknown,
  ): HTMLTableElement;
  function RenderRow(
    context: RenderContext,
    rownum: number,
    rowpane: number,
    linkstyle?: unknown,
  ): HTMLElement;
  function RenderSpacingRow(context: RenderContext): HTMLElement;
  function RenderColHeaders(context: RenderContext): HTMLElement | null;
  function RenderColGroup(context: RenderContext): HTMLElement;
  function RenderSizingRow(context: RenderContext): HTMLElement;
  function RenderCell(
    context: RenderContext,
    rownum: number,
    colnum: number,
    rowpane: number,
    colpane: number,
    noElement?: boolean,
    linkstyle?: unknown,
  ): HTMLElement | PseudoElement | null;

  function CoordInPane(
    context: RenderContext,
    coord: string,
    rowpane: number,
    colpane: number,
  ): boolean;
  function CellInPane(
    context: RenderContext,
    row: number,
    col: number,
    rowpane: number,
    colpane: number,
  ): boolean;
  function CreatePseudoElement(): PseudoElement;

  function rcColname(c: number): string;
  const letters: string[];
  function crToCoord(c: number, r: number): string;
  const coordToCol: { [coord: string]: number };
  const coordToRow: { [coord: string]: number };
  function coordToCr(cr: string): { row: number; col: number };
  function ParseRange(range: string): {
    cr1: { row: number; col: number; coord: string };
    cr2: { row: number; col: number; coord: string };
  };
  function OffsetRectangle(
    anchorCol: number,
    anchorRow: number,
    refRows: number,
    refCols: number,
    rowoffset: number,
    coloffset: number,
    height?: number,
    width?: number,
  ): { ok: boolean; col1: number; row1: number; col2: number; row2: number };

  function decodeFromSave(s: string): string;
  function decodeFromAjax(s: string): string;
  function encodeForSave(s: string): string;
  function special_chars(string: string): string;

  // Non-"data:" URLs are validated against policy.allowedUrlSchemes;
  // "data:" URLs are validated SOLELY against policy.allowedDataMimeTypes
  // (never allowedUrlSchemes). Returns a percent-encoded, HTML-attribute-
  // escaped string suitable ONLY for building href="..."/src="..." markup
  // that will itself be HTML-parsed (e.g. via innerHTML) - never for
  // storage/saving or direct assignment to a DOM URL property
  // (Element.href/.src), which is not HTML-parsed and would send the
  // literal escaped text as part of the URL instead of decoding it back.
  function SafeUrlForRender(rawurl: string, policy?: RenderSecurityPolicy): string | null;
  // Renders raw HTML safely under the untrusted-content policy: applies
  // policy.sanitizeHtml if configured, otherwise HTML-escapes the value.
  function EscapeUntrustedHtml(html: string, policy?: RenderSecurityPolicy): string;

  function Lookup(value: number, list: number[]): number | null;
  function setStyles(element: HTMLElement, cssText: string): void;

  function GetViewportInfo(): {
    width: number;
    height: number;
    horizontalScroll: number;
    verticalScroll: number;
  };
  function GetElementPosition(element: HTMLElement): {
    left: number;
    top: number;
    right?: number;
    bottom?: number;
    width?: number;
    height?: number;
  };
  function GetElementPositionWithScroll(element: HTMLElement): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  function GetElementFixedParent(element: HTMLElement): HTMLElement | false;
  function GetComputedStyle(element: HTMLElement, style: string): string;
  function LookupElement<T extends { element: unknown }>(element: unknown, array: T[]): T | null;
  function AssignID(obj: { idPrefix?: string }, element: HTMLElement, id: string): void;

  function GetCellContents(sheetobj: Sheet, coord: string): string;
  function FormatValueForDisplay(
    sheetobj: Sheet,
    value: string | number,
    cr: string,
    linkstyle?: unknown,
  ): string;
  function format_text_for_display(
    rawvalue: string | number,
    valuetype: string,
    valueformat: string,
    sheetobj: Sheet,
    linkstyle?: unknown,
    nontextvalueformat?: number | string,
  ): string;
  function format_number_for_display(
    rawvalue: string | number,
    valuetype: string,
    valueformat: string,
  ): string;
  function DetermineValueType(rawvalue: string | number): { value: string | number; type: string };

  const InputConstants: { [key: string]: string };

  function default_expand_markup(
    displayvalue: string,
    sheetobj: Sheet,
    linkstyle?: unknown,
  ): string;
  function expand_text_link(
    displayvalue: string,
    sheetobj: Sheet,
    linkstyle: unknown,
    valueformat: string,
  ): string;
  function ParseCellLinkText(str: string): {
    url: string;
    desc: string;
    newwin: boolean;
    pagename: string;
    workspace: string;
  };

  function ConvertSaveToOtherFormat(
    savestr: string,
    outputformat: string,
    dorecalc?: boolean,
  ): string;
  function ConvertOtherFormatToSave(inputstr: string, inputformat: string): string;
  function SetConvertedCell(
    sheet: Sheet,
    cr: string,
    rawvalue: string | number,
    decimalChar?: string,
  ): void;

  // Interoperability helpers (BOM, locale-numeric, quote-aware substitution,
  // named-range/coord validation) shared by the CSV/TSV locale variants, the
  // normalized-workbook ingestion seam, and the FODS exporter.
  function HasUtf8Bom(s: string): boolean;
  function StripUtf8Bom(s: string): string;
  function GroupingCharFor(decimalChar: string): string;
  function ParseLocaleNumericToken(
    tvalue: string,
    decimalChar: string,
  ): { ok: boolean; value: number; percent: boolean };
  function ReplaceUnquotedFormulaChar(text: string, from: string, to: string): string;
  function NormalizeNamedRangeName(raw: string): string;
  function IsValidNamedRangeName(raw: string): boolean;
  function IsValidNormalizedCellCoord(key: string): boolean;

  // Normalized-workbook ingestion seam (see js/socialcalc-3.ts's
  // "Normalized-workbook ingestion seam" section for the full contract).
  interface NormalizedCellData {
    value?: string | number;
    formula?: string;
    bold?: boolean;
    italic?: boolean;
    align?: "left" | "center" | "right";
    comment?: string;
  }
  interface NormalizedSheet {
    name?: string;
    formulaSeparator?: ";" | ",";
    cells: { [coord: string]: NormalizedCellData };
    names?: { [name: string]: string };
  }
  interface NormalizedWorkbook {
    sheets: NormalizedSheet[];
  }
  function CreateSheetSaveFromNormalizedSheet(
    normalizedSheet: NormalizedSheet,
    skipped?: string[],
  ): string;
  function CreateSpreadsheetSaveFromNormalizedWorkbook(normalizedWorkbook: NormalizedWorkbook): {
    sheetNames: string[];
    sheetSaves: { [name: string]: string };
  };

  // FODS (OpenDocument Flat XML Spreadsheet) export.
  function XmlEscape(text: string): string;
  function TranslateFormulaToOpenFormula(formula: string): { ok: boolean; text: string };
  function CreateFodsFromNormalizedWorkbook(normalizedWorkbook: NormalizedWorkbook): string;
}
