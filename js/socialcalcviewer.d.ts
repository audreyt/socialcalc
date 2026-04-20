declare namespace SocialCalc {

   var CurrentSpreadsheetViewerObject: SpreadsheetViewer | null;

   var LocalizeStringList: { [key: string]: string };

   class SpreadsheetViewer {
      constructor(idPrefix?: string);

      parentNode: HTMLElement | null;
      spreadsheetDiv: HTMLElement | null;
      requestedHeight: number;
      requestedWidth: number;
      requestedSpaceBelow: number;
      height: number;
      width: number;
      viewheight: number;

      sheet: any;
      context: any;
      editor: any;

      editorDiv: HTMLElement | null;
      statuslineDiv: HTMLElement | null;

      sortrange: string;

      idPrefix: string;
      imagePrefix: string;

      statuslineheight: number;
      statuslineCSS: string;

      hasStatusLine: boolean;
      statuslineHTML: string;
      statuslineFull: boolean;
      noRecalc: boolean;
      nonviewheight: number;

      repeatingMacroTimer: number | null;
      repeatingMacroInterval: number;
      repeatingMacroCommands: string;

      formDataViewer: SpreadsheetViewer | null;

      InitializeSpreadsheetViewer(node: HTMLElement | string, height?: number, width?: number, spacebelow?: number): void;
      LoadSave(str: string): void;
      DoOnResize(): void;
      SizeSSDiv(): boolean;
      DecodeSpreadsheetSave(str: string): { [key: string]: { start: number; end: number } };
      ParseSheetSave(str: string): any;

      [key: string]: any;
   }

   function InitializeSpreadsheetViewer(spreadsheet: SpreadsheetViewer, node: HTMLElement | string, height?: number, width?: number, spacebelow?: number): void;
   function SpreadsheetViewerLoadSave(spreadsheet: SpreadsheetViewer, savestr: string): void;
   function SpreadsheetViewerDoRepeatingMacro(): void;
   function SpreadsheetViewerRepeatMacroCommand(name: string, data: any, sheet: any, cmd: any, saveundo: any): void;
   function SpreadsheetViewerStopRepeatingMacro(): void;
   function SpreadsheetViewerDoButtonCmd(e: Event, buttoninfo: any, bobj: { element: HTMLElement; functionobj: { command: string; [k: string]: any }; [k: string]: any }): void;
   function LocalizeString(str: string): string;
   function LocalizeSubstrings(str: string): string;
   function GetSpreadsheetViewerObject(): SpreadsheetViewer;
   function DoOnResize(spreadsheet: SpreadsheetViewer): void;
   function SizeSSDiv(spreadsheet: SpreadsheetViewer): boolean;
   function SpreadsheetViewerStatuslineCallback(editor: any, status: string, arg: any, params: { spreadsheetobj?: SpreadsheetViewer; [k: string]: any }): void;
   function CmdGotFocus(obj: HTMLElement | boolean | null): void;
   function SpreadsheetViewerCreateSheetHTML(spreadsheet: SpreadsheetViewer): string;
   function SpreadsheetViewerDecodeSpreadsheetSave(spreadsheet: SpreadsheetViewer, str: string): { [key: string]: { start: number; end: number } };
}
