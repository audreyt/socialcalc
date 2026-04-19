declare namespace SocialCalc {

   var CurrentSpreadsheetControlObject: any;

   var LocalizeStringList: { [key: string]: any };

   var OtherSaveParts: { [key: string]: any };

   var SpreadsheetCmdLookup: { [key: string]: any };

   var SpreadsheetCmdSLookup: { [key: string]: any };

   var SpreadsheetCmdTable: { [key: string]: any };

   var debug_log: any[];

   class SpreadsheetControl {
      constructor(idPrefix?: string);

      parentNode: any;
      spreadsheetDiv: HTMLElement | null;
      requestedHeight: any;
      requestedWidth: any;
      requestedSpaceBelow: any;
      height: any;
      width: any;
      viewheight: any;

      tabs: any[];
      tabnums: { [key: string]: any };
      tabreplacements: { [key: string]: any };
      currentTab: number;

      views: { [key: string]: any };

      sheet: any;
      context: any;
      editor: any;

      editorDiv: HTMLElement | null;

      sortrange: any;
      moverange: any;

      idPrefix: string;
      multipartBoundary: string;
      imagePrefix: any;

      toolbarbackground: any;
      tabbackground: any;
      tabselectedCSS: any;
      tabplainCSS: any;
      toolbartext: any;

      formulabarheight: any;
      statuslineheight: any;
      statuslineCSS: any;

      ExportCallback: any;

      formulabuttons: { [key: string]: any };
      findbuttons: { [key: string]: any };

      InitializeSpreadsheetControl(node: any, height?: any, width?: any, spacebelow?: any): any;
      DoOnResize(): any;
      SizeSSDiv(): any;
      ExecuteCommand(combostr: any, sstr: any): any;
      CreateSheetHTML(): any;
      CreateSpreadsheetSave(otherparts?: any): any;
      DecodeSpreadsheetSave(str: any): any;
      CreateCellHTML(coord: any): any;
      CreateCellHTMLSave(range?: any): any;
      ParseSheetSave(str: any): any;
      CreateSheetSave(): any;

      [key: string]: any;
   }

   namespace SpreadsheetControl {
      function DoFunctionList(): any;
      function GetFunctionNamesStr(cname?: any): any;
      function FillFunctionNames(cname: any, ele: any): any;
      function GetFunctionInfoStr(fname: any): any;
      function FunctionClassChosen(cname: any): any;
      function FunctionChosen(fname: any): any;
      function HideFunctions(): any;
      function DoFunctionPaste(): any;
      function DoMultiline(): any;
      function HideMultiline(): any;
      function DoMultilineClear(): any;
      function DoMultilinePaste(): any;
      function DoLink(): any;
      function HideLink(): any;
      function DoLinkClear(): any;
      function DoLinkPaste(): any;
      function DoSum(): any;
      function FindInSheet(): any;
      function SearchSheet(direction: any): any;
      function SearchUp(): any;
      function SearchDown(): any;
   }

   function InitializeSpreadsheetControl(spreadsheet: any, node: any, height?: any, width?: any, spacebelow?: any): any;
   function CalculateSheetNonViewHeight(spreadsheet: any): any;
   function LocalizeString(str: any): any;
   function LocalizeSubstrings(str: any): any;
   function GetSpreadsheetControlObject(): any;
   function SetSpreadsheetControlObject(spreadsheet: any): any;
   function DoOnResize(spreadsheet: any): any;
   function SizeSSDiv(spreadsheet: any): any;
   function SetTab(obj: any): any;
   function SpreadsheetControlStatuslineCallback(editor: any, status: any, arg: any, params: any): any;
   function UpdateSortRangeProposal(editor: any): any;
   function LoadColumnChoosers(spreadsheet: any): any;
   function CmdGotFocus(obj: any): any;
   function DoButtonCmd(e: any, buttoninfo: any, bobj: any): any;
   function DoCmd(obj: any, which: any): any;
   function SpreadsheetControlExecuteCommand(obj: any, combostr: any, sstr: any): any;
   function SpreadsheetControlCreateSheetHTML(spreadsheet: any): any;
   function SpreadsheetControlCreateCellHTML(spreadsheet: any, coord: any, linkstyle?: any): any;
   function SpreadsheetControlCreateCellHTMLSave(spreadsheet: any, range?: any, linkstyle?: any): any;

   function SpreadsheetControlSortOnclick(s: any, t: any): any;
   function SpreadsheetControlSortSave(editor: any, setting: any): any;
   function SpreadsheetControlSortLoad(editor: any, setting: any, line: any, flags: any): any;

   function SpreadsheetControlCommentOnclick(s: any, t: any): any;
   function SpreadsheetControlCommentDisplay(s: any, t: any): any;
   function SpreadsheetControlCommentMoveECell(editor: any): any;
   function SpreadsheetControlCommentSet(): any;
   function SpreadsheetControlCommentOnunclick(s: any, t: any): any;

   function SpreadsheetControlNamesOnclick(s: any, t: any): any;
   function SpreadsheetControlNamesFillNameList(): any;
   function SpreadsheetControlNamesChangedName(): any;
   function SpreadsheetControlNamesRangeChange(editor: any): any;
   function SpreadsheetControlNamesOnunclick(s: any, t: any): any;
   function SpreadsheetControlNamesSetValue(): any;
   function SpreadsheetControlNamesSave(): any;
   function SpreadsheetControlNamesDelete(): any;

   function SpreadsheetControlClipboardOnclick(s: any, t: any): any;
   function SpreadsheetControlClipboardFormat(which: any): any;
   function SpreadsheetControlClipboardLoad(): any;
   function SpreadsheetControlClipboardClear(): any;
   function SpreadsheetControlClipboardExport(): any;

   function SpreadsheetControlSettingsSwitch(target: any): any;
   function SettingsControlSave(target: any): any;
   function SpreadsheetControlCreateSpreadsheetSave(spreadsheet: any, otherparts?: any): any;
   function SpreadsheetControlDecodeSpreadsheetSave(spreadsheet: any, str: any): any;

   function SettingsControlSetCurrentPanel(panelobj: any): any;
   function SettingsControlInitializePanel(panelobj: any): any;
   function SettingsControlLoadPanel(panelobj: any, attribs: any): any;
   function SettingsControlUnloadPanel(panelobj: any): any;
   function SettingsControlOnchangeBorder(ele: any): any;
   function SettingControlReset(): any;

   function CtrlSEditor(whichpart: any): any;
   function CtrlSEditorDone(idprefix: any, whichpart: any): any;

   var SettingsControls: {
      Controls: { [key: string]: any };
      CurrentPanel: any;
      idPrefix?: string;
      PopupChangeCallback(attribs: any, id: any, value: any): any;
      PopupListSetValue(panelobj: any, ctrlname: any, value: any): any;
      PopupListGetValue(panelobj: any, ctrlname: any): any;
      PopupListInitialize(panelobj: any, ctrlname: any): any;
      PopupListReset(ctrlname: any): any;
      ColorChooserSetValue(panelobj: any, ctrlname: any, value: any): any;
      ColorChooserGetValue(panelobj: any, ctrlname: any): any;
      ColorChooserInitialize(panelobj: any, ctrlname: any): any;
      ColorChooserReset(ctrlname: any): any;
      BorderSideSetValue(panelobj: any, ctrlname: any, value: any): any;
      BorderSideGetValue(panelobj: any, ctrlname: any): any;
      BorderSideInitialize(panelobj: any, ctrlname: any): any;
      ColorComboOnClick?: any;
      [key: string]: any;
   };

}
