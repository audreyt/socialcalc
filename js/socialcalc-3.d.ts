declare namespace SocialCalc {

   const Callbacks: {
      expand_wiki: any;
      expand_markup: (displayvalue: any, sheetobj: any, linkstyle: any) => any;
      MakePageLink: any;
      NormalizeSheetName: any;
      [key: string]: any;
   };

   const CellProperties: { [name: string]: number };
   const CellPropertiesTable: { [name: string]: string };

   class Cell {
      constructor(coord: string);

      coord: string;
      datavalue: any;
      datatype: string;
      formula: string;
      valuetype: string;
      readonly: boolean;

      errors: any;
      comment: string;
      displayvalue: any;
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
      matched_cells: any[];
      selected_search_cell: any;
      copiedfrom: string;
      changes: UndoStack;
      renderneeded: boolean;
      changedrendervalues: boolean;
      recalcchangedavalue: boolean;
      hiddencolrow: string;
      sci: SheetCommandInfo;
      ioEventTree: { [key: string]: any };
      ioParameterList: { [key: string]: any };
      statuscallback: any;
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
      EncodeCellAttributes(coord: string): any;
      EncodeSheetAttributes(): any;
      DecodeCellAttributes(coord: string, attribs: any, range?: string): string;
      DecodeSheetAttributes(attribs: any): string;
      ScheduleSheetCommands(cmd: string, saveundo?: boolean): void;
      SheetUndo(): void;
      SheetRedo(): void;
      CreateAuditString(): string;
      GetStyleNum(atype: string, style: string): number;
      GetStyleString(atype: string, num: number): string;
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
   function EncodeCellAttributes(sheet: Sheet, coord: string): any;
   function EncodeSheetAttributes(sheet: Sheet): any;
   function DecodeCellAttributes(sheet: Sheet, coord: string, newattribs: any, range?: string): string;
   function DecodeSheetAttributes(sheet: Sheet, newattribs: any): string;

   class SheetCommandInfo {
      constructor(sheetobj: Sheet);

      sheetobj: Sheet;
      timerobj: any;
      firsttimerdelay: number;
      timerdelay: number;
      maxtimeslice: number;
      saveundo: boolean;
      CmdExtensionCallbacks: { [name: string]: { func: any; data: any } };

      [key: string]: any;
   }

   function ScheduleSheetCommands(sheet: Sheet, cmdstr: string, saveundo?: boolean): void;
   function SheetCommandsTimerRoutine(sci: SheetCommandInfo, parseobj: Parse, saveundo?: boolean): void;
   function ExecuteSheetCommand(sheet: Sheet, cmd: Parse, saveundo?: boolean): string;

   function SheetUndo(sheet: Sheet): void;
   function SheetRedo(sheet: Sheet): void;
   function CreateAuditString(sheet: Sheet): string;
   function GetStyleNum(sheet: Sheet, atype: string, style: string): number;
   function GetStyleString(sheet: Sheet, atype: string, num: number): string;
   function OffsetFormulaCoords(formula: string, coloffset: number, rowoffset: number): string;
   function AdjustFormulaCoords(formula: string, col: number, coloffset: number, row: number, rowoffset: number): string;
   function ReplaceFormulaCoords(formula: string, movedto: any): string;

   const RecalcInfo: {
      sheet: Sheet;
      currentState: number;
      state: { idle: number; start_calc: number; order: number; calc: number; start_wait: number; done_wait: number };
      recalctimer: any;
      maxtimeslice: number;
      timeslicedelay: number;
      starttime: any;
      queue: Sheet[];
      LoadSheet: (sheetname: string) => boolean;
      [key: string]: any;
   };

   class RecalcData {
      constructor();

      inrecalc: boolean;
      celllist: string[];
      celllistitem: number;
      calclist: any;
      calclistlength: number;
      firstcalc: string;
      lastcalc: string;
      nextcalc: string;
      count: number;
      checkinfo: { [coord: string]: RecalcCheckInfo | true };

      [key: string]: any;
   }

   class RecalcCheckInfo {
      constructor();

      oldcoord: string;
      parsepos: number;
      inrange: boolean;
      inrangestart: boolean;
      cr1: any;
      cr2: any;
      c1: number;
      c2: number;
      r1: number;
      r2: number;
      c: number;
      r: number;

      [key: string]: any;
   }

   function RecalcSheet(sheet: Sheet): void;
   function RecalcSetTimeout(): void;
   function RecalcClearTimeout(): void;
   function RecalcLoadedSheet(sheetname: string, str: string, recalcneeded: boolean, live?: boolean): any;
   function RecalcTimerRoutine(): void;
   function RecalcCheckCell(sheet: Sheet, startcoord: string): any;

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
      AddDo(...args: any[]): void;
      AddUndo(...args: any[]): void;
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
      rownamewidth: any;
      pixelsPerRow: any;

      cellskip: any;
      coordToCR: { [coord: string]: { row: number; col: number } };
      colwidth: any[];
      rowheight: any[];
      totalwidth: number;
      totalheight: number;

      rowpanes: Array<{ first: number; last: number }>;
      colpanes: Array<{ first: number; last: number }>;
      colunhideleft: any[];
      colunhideright: any[];
      rowunhidetop: any[];
      rowunhidebottom: any[];
      maxcol: number;
      maxrow: number;

      highlights: { [coord: string]: string };
      cursorsuffix: string;
      highlightTypes: { [key: string]: { style: string; className: string } };

      cellIDprefix: string;
      defaultlinkstyle: any;
      defaultHTMLlinkstyle: { type: string };

      defaultfontstyle: string;
      defaultfontsize: string;
      defaultfontfamily: string;
      defaultlayout: string;
      defaultpanedividerwidth: any;
      defaultpanedividerheight: any;

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
      InitializeTable(tableobj: any): void;
      RenderSheet(oldtable: any, linkstyle?: any): any;
      RenderColGroup(): any;
      RenderColHeaders(): any;
      RenderSizingRow(): any;
      RenderRow(rownum: number, rowpane: number, linkstyle?: any): any;
      RenderSpacingRow(): any;
      RenderCell(rownum: number, colnum: number, rowpane: number, colpane: number, noElement?: boolean, linkstyle?: any): any;

      [key: string]: any;
   }

   function PrecomputeSheetFontsAndLayouts(context: RenderContext): void;
   function CalculateCellSkipData(context: RenderContext): void;
   function CalculateColWidthData(context: RenderContext): void;
   function CalculateRowHeightData(context: RenderContext): void;
   function InitializeTable(context: RenderContext, tableobj: any): void;
   function RenderSheet(context: RenderContext, oldtable: any, linkstyle?: any): any;
   function RenderRow(context: RenderContext, rownum: number, rowpane: number, linkstyle?: any): any;
   function RenderSpacingRow(context: RenderContext): any;
   function RenderColHeaders(context: RenderContext): any;
   function RenderColGroup(context: RenderContext): any;
   function RenderSizingRow(context: RenderContext): any;
   function RenderCell(
      context: RenderContext,
      rownum: number,
      colnum: number,
      rowpane: number,
      colpane: number,
      noElement?: boolean,
      linkstyle?: any
   ): any;

   function CoordInPane(context: RenderContext, coord: string, rowpane: number, colpane: number): boolean;
   function CellInPane(context: RenderContext, row: number, col: number, rowpane: number, colpane: number): boolean;
   function CreatePseudoElement(): { style: { cssText: string }; innerHTML: string; className: string };

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

   function Lookup(value: any, list: any[]): number;
   function setStyles(element: any, cssText: string): void;

   function GetViewportInfo(): { width: number; height: number; horizontalScroll: number; verticalScroll: number };
   function GetElementPosition(element: any): { left: number; top: number };
   function GetElementPositionWithScroll(element: any): { left: number; right: number; top: number; bottom: number; width: number; height: number };
   function GetElementFixedParent(element: any): any;
   function GetComputedStyle(element: any, style: string): any;
   function LookupElement(element: any, array: any[]): any;
   function AssignID(obj: any, element: any, id: string): void;

   function GetCellContents(sheetobj: Sheet, coord: string): string;
   function FormatValueForDisplay(sheetobj: Sheet, value: any, cr: string, linkstyle?: any): string;
   function format_text_for_display(
      rawvalue: any,
      valuetype: string,
      valueformat: string,
      sheetobj: Sheet,
      linkstyle?: any,
      nontextvalueformat?: any
   ): string;
   function format_number_for_display(rawvalue: any, valuetype: string, valueformat: string): string;
   function DetermineValueType(rawvalue: any): { value: any; type: string };

   const InputConstants: { [key: string]: string };

   function default_expand_markup(displayvalue: any, sheetobj: Sheet, linkstyle?: any): string;
   function expand_text_link(displayvalue: any, sheetobj: Sheet, linkstyle: any, valueformat: string): string;
   function ParseCellLinkText(str: string): { url: string; desc: string; newwin: boolean; pagename: string; workspace: string };

   function ConvertSaveToOtherFormat(savestr: string, outputformat: string, dorecalc?: boolean): string;
   function ConvertOtherFormatToSave(inputstr: string, inputformat: string): string;
   function SetConvertedCell(sheet: Sheet, cr: string, rawvalue: any): void;

}
