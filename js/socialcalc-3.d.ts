declare namespace SocialCalc {

   // Shape of {def, val} used by EncodeCellAttributes / DecodeCellAttributes etc.
   interface AttribValue {
      def: boolean;
      val: string;
   }
   type AttribSet = { [name: string]: AttribValue };

   const Callbacks: {
      expand_wiki: ((displayvalue: string, sheetobj: Sheet, linkstyle: unknown, valueformat: string) => string) | null;
      expand_markup: (displayvalue: string, sheetobj: Sheet, linkstyle: unknown) => string;
      MakePageLink: ((pagename: string, workspacename: string, linkstyle: unknown, valueformat: string) => string) | null;
      NormalizeSheetName: ((name: string) => string) | null;
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

      errors: string;
      comment: string;
      displayvalue: string;
      parseinfo: any;

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
      };
      colattribs: {
         width: { [col: string]: string };
         hide: { [col: string]: string };
      };
      names: { [name: string]: { desc: string; definition: string } };
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
   const sheetfieldsxlatshort: string[];
   const sheetfieldsxlatxlt: string[];

   function CreateSheetSave(sheetobj: Sheet, range?: string, canonicalize?: boolean): string;
   function CellToString(sheet: Sheet, cell: Cell): string;
   function CanonicalizeSheet(sheetobj: Sheet, full?: boolean): void;
   function EncodeCellAttributes(sheet: Sheet, coord: string): AttribSet;
   function EncodeSheetAttributes(sheet: Sheet): AttribSet;
   function DecodeCellAttributes(sheet: Sheet, coord: string, newattribs: AttribSet, range?: string): string | null;
   function DecodeSheetAttributes(sheet: Sheet, newattribs: AttribSet): string | null;

   class SheetCommandInfo {
      constructor(sheetobj: Sheet);

      sheetobj: Sheet;
      timerobj: ReturnType<typeof setTimeout> | null;
      firsttimerdelay: number;
      timerdelay: number;
      maxtimeslice: number;
      saveundo: boolean;
      CmdExtensionCallbacks: { [name: string]: { func: (cmdname: string, data: any, sheet: Sheet, parseobj: Parse, saveundo: boolean) => void; data: any } };

      [key: string]: any;
   }

   function ScheduleSheetCommands(sheet: Sheet, cmdstr: string, saveundo?: boolean): void;
   function SheetCommandsTimerRoutine(sci: SheetCommandInfo, parseobj: Parse, saveundo?: boolean): void;
   function ExecuteSheetCommand(sheet: Sheet, cmd: Parse, saveundo?: boolean): string;

   function SheetUndo(sheet: Sheet): void;
   function SheetRedo(sheet: Sheet): void;
   function CreateAuditString(sheet: Sheet): string;
   function GetStyleNum(sheet: Sheet, atype: string, style: string): number;
   function GetStyleString(sheet: Sheet, atype: string, num: number): string | null;
   function OffsetFormulaCoords(formula: string, coloffset: number, rowoffset: number): string;
   function AdjustFormulaCoords(formula: string, col: number, coloffset: number, row: number, rowoffset: number): string;
   function ReplaceFormulaCoords(formula: string, movedto: { [coord: string]: string }): string;

   const RecalcInfo: {
      sheet: Sheet | null;
      currentState: number;
      state: { idle: number; start_calc: number; order: number; calc: number; start_wait: number; done_wait: number };
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
   function RecalcLoadedSheet(sheetname: string | null, str: string, recalcneeded: boolean, live?: boolean): void;
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
      RenderCell(rownum: number, colnum: number, rowpane: number, colpane: number, noElement?: boolean, linkstyle?: unknown): HTMLElement | PseudoElement | null;

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
   function RenderSheet(context: RenderContext, oldtable: HTMLTableElement | null, linkstyle?: unknown): HTMLTableElement;
   function RenderRow(context: RenderContext, rownum: number, rowpane: number, linkstyle?: unknown): HTMLElement;
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
      linkstyle?: unknown
   ): HTMLElement | PseudoElement | null;

   function CoordInPane(context: RenderContext, coord: string, rowpane: number, colpane: number): boolean;
   function CellInPane(context: RenderContext, row: number, col: number, rowpane: number, colpane: number): boolean;
   function CreatePseudoElement(): PseudoElement;

   function rcColname(c: number): string;
   const letters: string[];
   function crToCoord(c: number, r: number): string;
   const coordToCol: { [coord: string]: number };
   const coordToRow: { [coord: string]: number };
   function coordToCr(cr: string): { row: number; col: number };
   function ParseRange(range: string): { cr1: { row: number; col: number; coord: string }; cr2: { row: number; col: number; coord: string } };

   function decodeFromSave(s: string): string;
   function decodeFromAjax(s: string): string;
   function encodeForSave(s: string): string;
   function special_chars(string: string): string;

   function Lookup(value: number, list: number[]): number | null;
   function setStyles(element: HTMLElement, cssText: string): void;

   function GetViewportInfo(): { width: number; height: number; horizontalScroll: number; verticalScroll: number };
   function GetElementPosition(element: HTMLElement): { left: number; top: number };
   function GetElementPositionWithScroll(element: HTMLElement): { left: number; right: number; top: number; bottom: number; width: number; height: number };
   function GetElementFixedParent(element: HTMLElement): HTMLElement | false;
   function GetComputedStyle(element: HTMLElement, style: string): string;
   function LookupElement<T extends { element: unknown }>(element: unknown, array: T[]): T | null;
   function AssignID(obj: { idPrefix?: string }, element: HTMLElement, id: string): void;

   function GetCellContents(sheetobj: Sheet, coord: string): string;
   function FormatValueForDisplay(sheetobj: Sheet, value: string | number, cr: string, linkstyle?: unknown): string;
   function format_text_for_display(
      rawvalue: string | number,
      valuetype: string,
      valueformat: string,
      sheetobj: Sheet,
      linkstyle?: unknown,
      nontextvalueformat?: number | string
   ): string;
   function format_number_for_display(rawvalue: string | number, valuetype: string, valueformat: string): string;
   function DetermineValueType(rawvalue: string | number): { value: string | number; type: string };

   const InputConstants: { [key: string]: string };

   function default_expand_markup(displayvalue: string, sheetobj: Sheet, linkstyle?: unknown): string;
   function expand_text_link(displayvalue: string, sheetobj: Sheet, linkstyle: unknown, valueformat: string): string;
   function ParseCellLinkText(str: string): { url: string; desc: string; newwin: boolean; pagename: string; workspace: string };

   function ConvertSaveToOtherFormat(savestr: string, outputformat: string, dorecalc?: boolean): string;
   function ConvertOtherFormatToSave(inputstr: string, inputformat: string): string;
   function SetConvertedCell(sheet: Sheet, cr: string, rawvalue: string | number): void;

}
