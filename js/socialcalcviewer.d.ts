declare namespace SocialCalc {

   var CurrentSpreadsheetViewerObject: any;

   var LocalizeStringList: { [key: string]: any };

   class SpreadsheetViewer {
      constructor(idPrefix?: string);

      parentNode: any;
      spreadsheetDiv: any;
      requestedHeight: any;
      requestedWidth: any;
      requestedSpaceBelow: any;
      height: any;
      width: any;
      viewheight: any;

      sheet: any;
      context: any;
      editor: any;

      editorDiv: any;
      statuslineDiv: any;

      sortrange: any;

      idPrefix: string;
      imagePrefix: any;

      statuslineheight: any;
      statuslineCSS: any;

      hasStatusLine: any;
      statuslineHTML: any;
      statuslineFull: any;
      noRecalc: any;
      nonviewheight: any;

      repeatingMacroTimer: any;
      repeatingMacroInterval: any;
      repeatingMacroCommands: any;

      formDataViewer: any;

      InitializeSpreadsheetViewer(node: any, height?: any, width?: any, spacebelow?: any): any;
      LoadSave(str: any): any;
      DoOnResize(): any;
      SizeSSDiv(): any;
      DecodeSpreadsheetSave(str: any): any;
      ParseSheetSave(str: any): any;

      [key: string]: any;
   }

   function InitializeSpreadsheetViewer(spreadsheet: any, node: any, height?: any, width?: any, spacebelow?: any): any;
   function SpreadsheetViewerLoadSave(spreadsheet: any, savestr: any): any;
   function SpreadsheetViewerDoRepeatingMacro(): any;
   function SpreadsheetViewerRepeatMacroCommand(name: any, data: any, sheet: any, cmd: any, saveundo: any): any;
   function SpreadsheetViewerStopRepeatingMacro(): any;
   function SpreadsheetViewerDoButtonCmd(e: any, buttoninfo: any, bobj: any): any;
   function LocalizeString(str: any): any;
   function LocalizeSubstrings(str: any): any;
   function GetSpreadsheetViewerObject(): any;
   function DoOnResize(spreadsheet: any): any;
   function SizeSSDiv(spreadsheet: any): any;
   function SpreadsheetViewerStatuslineCallback(editor: any, status: any, arg: any, params: any): any;
   function CmdGotFocus(obj: any): any;
   function SpreadsheetViewerCreateSheetHTML(spreadsheet: any): any;
   function SpreadsheetViewerDecodeSpreadsheetSave(spreadsheet: any, str: any): any;
}
