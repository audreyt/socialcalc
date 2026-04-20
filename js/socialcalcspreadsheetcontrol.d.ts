declare namespace SocialCalc {

   var CurrentSpreadsheetControlObject: SpreadsheetControl | null;

   var LocalizeStringList: { [key: string]: string };

   var OtherSaveParts: { [key: string]: string };

   var SpreadsheetCmdLookup: { [key: string]: any };

   var SpreadsheetCmdSLookup: { [key: string]: any };

   var SpreadsheetCmdTable: { [key: string]: any };

   var debug_log: any[];

   class SpreadsheetControl {
      constructor(idPrefix?: string);

      parentNode: HTMLElement | null;
      spreadsheetDiv: HTMLElement | null;
      requestedHeight: number;
      requestedWidth: number;
      requestedSpaceBelow: number;
      height: number;
      width: number;
      viewheight: number;

      tabs: any[];
      tabnums: { [key: string]: number };
      tabreplacements: { [key: string]: { regex: RegExp; replacement: string } };
      currentTab: number;

      views: { [key: string]: any };

      sheet: any;
      context: any;
      editor: any;

      editorDiv: HTMLElement | null;

      sortrange: string;
      moverange: string;

      idPrefix: string;
      multipartBoundary: string;
      imagePrefix: string;

      toolbarbackground: string;
      tabbackground: string;
      tabselectedCSS: string;
      tabplainCSS: string;
      toolbartext: string;

      formulabarheight: number;
      statuslineheight: number;
      statuslineCSS: string;

      ExportCallback: ((spreadsheet: SpreadsheetControl) => any) | null;

      formulabuttons: { [key: string]: { image: string; tooltip: string; command: (...args: any[]) => any; skipImagePrefix?: boolean } };
      findbuttons: { [key: string]: { image: string; tooltip: string; command: (...args: any[]) => any } };

      InitializeSpreadsheetControl(node: HTMLElement | string, height?: number, width?: number, spacebelow?: number): void;
      DoOnResize(): void;
      SizeSSDiv(): boolean;
      ExecuteCommand(combostr: string, sstr?: string): void;
      CreateSheetHTML(): string;
      CreateSpreadsheetSave(otherparts?: { [key: string]: string }): string;
      DecodeSpreadsheetSave(str: string): { [key: string]: { start: number; end: number } };
      CreateCellHTML(coord: string): string;
      CreateCellHTMLSave(range?: string): string;
      ParseSheetSave(str: string): any;
      CreateSheetSave(): string;

      [key: string]: any;
   }

   namespace SpreadsheetControl {
      function DoFunctionList(): void;
      function GetFunctionNamesStr(cname?: string): string;
      function FillFunctionNames(cname: string, ele: HTMLSelectElement): void;
      function GetFunctionInfoStr(fname: string): string;
      function FunctionClassChosen(cname: string): void;
      function FunctionChosen(fname: string): void;
      function HideFunctions(): void;
      function DoFunctionPaste(): void;
      function DoMultiline(): void;
      function HideMultiline(): void;
      function DoMultilineClear(): void;
      function DoMultilinePaste(): void;
      function DoLink(): void;
      function HideLink(): void;
      function DoLinkClear(): void;
      function DoLinkPaste(): void;
      function DoSum(): void;
      function FindInSheet(): void;
      function SearchSheet(direction: 0 | 1): void;
      function SearchUp(): void;
      function SearchDown(): void;
   }

   function InitializeSpreadsheetControl(spreadsheet: SpreadsheetControl, node: HTMLElement | string, height?: number, width?: number, spacebelow?: number): void;
   function CalculateSheetNonViewHeight(spreadsheet: SpreadsheetControl): number;
   function LocalizeString(str: string): string;
   function LocalizeSubstrings(str: string): string;
   function GetSpreadsheetControlObject(): SpreadsheetControl | undefined;
   function SetSpreadsheetControlObject(spreadsheet: SpreadsheetControl | null): void;
   function DoOnResize(spreadsheet: SpreadsheetControl): void;
   function SizeSSDiv(spreadsheet: SpreadsheetControl): boolean;
   function SetTab(obj: string | HTMLElement): void;
   function SpreadsheetControlStatuslineCallback(editor: any, status: string, arg: any, params: { statuslineid: string; recalcid1: string; recalcid2: string; [k: string]: any }): void;
   function UpdateSortRangeProposal(editor: any): void;
   function LoadColumnChoosers(spreadsheet: SpreadsheetControl): void;
   function CmdGotFocus(obj: HTMLElement | boolean | null): void;
   function DoButtonCmd(e: Event, buttoninfo: any, bobj: { element: HTMLElement; functionobj: { command: string; [k: string]: any }; [k: string]: any }): void;
   function DoCmd(obj: HTMLElement | null, which: string): void;
   function SpreadsheetControlExecuteCommand(obj: HTMLElement | null, combostr: string, sstr: string): void;
   function SpreadsheetControlCreateSheetHTML(spreadsheet: SpreadsheetControl): string;
   function SpreadsheetControlCreateCellHTML(spreadsheet: SpreadsheetControl, coord: string, linkstyle?: any): string;
   function SpreadsheetControlCreateCellHTMLSave(spreadsheet: SpreadsheetControl, range?: string, linkstyle?: any): string;

   function SpreadsheetControlSortOnclick(s: SpreadsheetControl, t: string): void;
   function SpreadsheetControlSortSave(editor: any, setting: any): string;
   function SpreadsheetControlSortLoad(editor: any, setting: any, line: string, flags: any): boolean;

   function SpreadsheetControlCommentOnclick(s: SpreadsheetControl, t: string): void;
   function SpreadsheetControlCommentDisplay(s: SpreadsheetControl, t: string): void;
   function SpreadsheetControlCommentMoveECell(editor: any): void;
   function SpreadsheetControlCommentSet(): void;
   function SpreadsheetControlCommentOnunclick(s: SpreadsheetControl, t: string): void;

   function SpreadsheetControlNamesOnclick(s: SpreadsheetControl, t: string): void;
   function SpreadsheetControlNamesFillNameList(): void;
   function SpreadsheetControlNamesChangedName(): void;
   function SpreadsheetControlNamesRangeChange(editor: any): void;
   function SpreadsheetControlNamesOnunclick(s: SpreadsheetControl, t: string): void;
   function SpreadsheetControlNamesSetValue(): void;
   function SpreadsheetControlNamesSave(): void;
   function SpreadsheetControlNamesDelete(): void;

   function SpreadsheetControlClipboardOnclick(s: SpreadsheetControl, t: string): void;
   function SpreadsheetControlClipboardFormat(which: string): void;
   function SpreadsheetControlClipboardLoad(): void;
   function SpreadsheetControlClipboardClear(): void;
   function SpreadsheetControlClipboardExport(): void;

   function SpreadsheetControlSettingsSwitch(target: "sheet" | "cell" | string): void;
   function SettingsControlSave(target: "sheet" | "cell" | "cancel" | string): void;
   function SpreadsheetControlCreateSpreadsheetSave(spreadsheet: SpreadsheetControl, otherparts?: { [key: string]: string }): string;
   function SpreadsheetControlDecodeSpreadsheetSave(spreadsheet: SpreadsheetControl, str: string): { [key: string]: { start: number; end: number } };

   function SettingsControlSetCurrentPanel(panelobj: any): void;
   function SettingsControlInitializePanel(panelobj: any): void;
   function SettingsControlLoadPanel(panelobj: any, attribs: { [key: string]: any }): void;
   function SettingsControlUnloadPanel(panelobj: any): { [key: string]: any };
   function SettingsControlOnchangeBorder(ele: HTMLElement): void;
   function SettingControlReset(): void;

   function CtrlSEditor(whichpart: string): void;
   function CtrlSEditorDone(idprefix: string, whichpart: string): void;

   var SettingsControls: {
      Controls: { [key: string]: any };
      CurrentPanel: any;
      idPrefix?: string;
      PopupChangeCallback(attribs: { panelobj?: any; [k: string]: any }, id: string, value: any): void;
      PopupListSetValue(panelobj: any, ctrlname: string, value: { def: boolean; val: any } | null): void;
      PopupListGetValue(panelobj: any, ctrlname: string): { def: boolean; val: any } | null;
      PopupListInitialize(panelobj: any, ctrlname: string): void;
      PopupListReset(ctrlname: string): void;
      ColorChooserSetValue(panelobj: any, ctrlname: string, value: { def: boolean; val: any } | null): void;
      ColorChooserGetValue(panelobj: any, ctrlname: string): { def: boolean; val: any };
      ColorChooserInitialize(panelobj: any, ctrlname: string): void;
      ColorChooserReset(ctrlname: string): void;
      BorderSideSetValue(panelobj: any, ctrlname: string, value: { def: boolean; val: any } | null): void;
      BorderSideGetValue(panelobj: any, ctrlname: string): { def: boolean; val: any } | undefined;
      BorderSideInitialize(panelobj: any, ctrlname: string): void;
      ColorComboOnClick?: (...args: any[]) => any;
      [key: string]: any;
   };

}
