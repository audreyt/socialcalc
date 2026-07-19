declare namespace SocialCalc {
  /**
   * Optional workbook-mode state attached to a SpreadsheetControl once
   * EnableWorkbookMode has been called. Absent (undefined) on every control
   * that never opts in — the single-sheet constructor/host integration is
   * unchanged for every existing caller.
   */
  interface SpreadsheetControlWorkbookState {
    workbook: Workbook;
    tabBarDiv: HTMLElement | null;
    /** Sheet name currently rendered as the DOM tab strip's active tab. */
    renderedActiveName: string | null;
  }

  interface SpreadsheetControl {
    /** Present only after EnableWorkbookMode; undefined for single-sheet hosts. */
    workbookState?: SpreadsheetControlWorkbookState;

    /**
     * Opts this control into multi-sheet workbook mode: attaches `workbook`
     * (creating one with a single default sheet if omitted), renders an
     * accessible sheet-tab strip above the grid, and swaps the control's
     * active sheet/editor context when the user switches tabs. Safe to call
     * only once per control; the existing single-sheet constructor and
     * every other SpreadsheetControl method are unaffected until this is
     * called.
     */
    EnableWorkbookMode(workbook?: Workbook): void;
    /** True once EnableWorkbookMode has been called on this control. */
    IsWorkbookMode(): boolean;
    /** Switches the control's rendered/edited sheet to `name` (must be visible). */
    SwitchToSheet(name: string): void;
    /** Re-renders the sheet-tab strip from the current workbook state. */
    RenderSheetTabs(): void;
  }

  function SpreadsheetControlEnableWorkbookMode(
    spreadsheet: SpreadsheetControl,
    workbook?: Workbook,
  ): void;
  function SpreadsheetControlSwitchToSheet(spreadsheet: SpreadsheetControl, name: string): void;
  function SpreadsheetControlRenderSheetTabs(spreadsheet: SpreadsheetControl): void;

  /**
   * Optional host override for the sheet-tab right-click/context-menu
   * action. Default (unset) is a native confirm()-driven delete. Assign a
   * function here to replace it with a richer popup before calling
   * EnableWorkbookMode.
   */
  var WorkbookUiContextMenuHandler:
    | ((spreadsheet: SpreadsheetControl, name: string) => void)
    | null;
}
