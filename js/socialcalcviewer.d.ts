declare namespace SocialCalc {
  // Optional product flags set by host apps (eddy extensions).
  var _app: boolean | undefined;
  var _view: boolean | undefined;

  var CurrentSpreadsheetViewerObject: SpreadsheetViewer | null;

  var LocalizeStringList: { [key: string]: string };

  /**
   * Instance shape for the legacy function-constructor SpreadsheetViewer.
   * Declared as interface (not class) so implementation can assign a
   * classic `function(...) { this... }` without fighting construct signatures.
   */
  interface SpreadsheetViewer {
    parentNode: HTMLElement | null;
    spreadsheetDiv: HTMLElement | null;
    requestedHeight: number;
    requestedWidth: number;
    requestedSpaceBelow: number;
    height: number;
    width: number;
    viewheight: number;

    sheet: Sheet;
    context: RenderContext;
    editor: TableEditor;

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

    InitializeSpreadsheetViewer(
      node: HTMLElement | string,
      height?: number,
      width?: number,
      spacebelow?: number,
    ): void;
    LoadSave(str: string): void;
    DoOnResize(): void;
    SizeSSDiv(): boolean;
    DecodeSpreadsheetSave(str: string): { [key: string]: { start: number; end: number } };
    ParseSheetSave(str: string): unknown;

    // Dynamic views/tabs bags used by control/viewer hosts.
    views?: { [name: string]: { element: HTMLElement; [k: string]: unknown } };
    tabs?: unknown;

    [key: string]: unknown;
  }

  interface SpreadsheetViewerConstructor {
    new (idPrefix?: string): SpreadsheetViewer;
    (idPrefix?: string): SpreadsheetViewer;
    prototype: SpreadsheetViewer;
  }

  var SpreadsheetViewer: SpreadsheetViewerConstructor;

  function InitializeSpreadsheetViewer(
    spreadsheet: SpreadsheetViewer,
    node: HTMLElement | string,
    height?: number,
    width?: number,
    spacebelow?: number,
  ): void;
  function SpreadsheetViewerLoadSave(spreadsheet: SpreadsheetViewer, savestr: string): void;
  function SpreadsheetViewerDoRepeatingMacro(): void;
  function SpreadsheetViewerRepeatMacroCommand(
    name: string,
    data: unknown,
    sheet: Sheet,
    cmd: Parse,
    saveundo: boolean,
  ): void;
  function SpreadsheetViewerStopRepeatingMacro(): void;
  function SpreadsheetViewerDoButtonCmd(
    e: Event,
    buttoninfo: unknown,
    bobj: {
      element: HTMLElement;
      functionobj: { command: string; [k: string]: unknown };
      [k: string]: unknown;
    },
  ): void;
  function LocalizeString(str: string): string;
  function LocalizeSubstrings(str: string): string;
  function GetSpreadsheetViewerObject(): SpreadsheetViewer;
  // Shared free functions also declared for SpreadsheetControl — use overloads via re-declare is fine in merged namespace.
  function DoOnResize(spreadsheet: SpreadsheetViewer): void;
  function SizeSSDiv(spreadsheet: SpreadsheetViewer): boolean;
  function UpdateSpreadsheetChromeLayout(spreadsheet: SpreadsheetViewer, force?: boolean): boolean;
  function SpreadsheetViewerStatuslineCallback(
    editor: TableEditor,
    status: string,
    arg: unknown,
    params: { spreadsheetobj?: SpreadsheetViewer; [k: string]: unknown },
  ): void;
  function CmdGotFocus(obj: HTMLElement | boolean | null): void;
  function SpreadsheetViewerCreateSheetHTML(spreadsheet: SpreadsheetViewer): string;
  function SpreadsheetViewerDecodeSpreadsheetSave(
    spreadsheet: SpreadsheetViewer,
    str: string,
  ): { [key: string]: { start: number; end: number } };
}
