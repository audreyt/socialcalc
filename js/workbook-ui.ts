// Optional SpreadsheetControl workbook-mode UI: accessible sheet tabs plus
// add/rename/delete/reorder context actions, layered on top of the existing
// single-sheet SpreadsheetControl. Concatenated after workbook.js (needs
// SocialCalc.Workbook) and socialcalcspreadsheetcontrol.js (needs
// SocialCalc.SpreadsheetControl/AssignID/GetSpreadsheetControlObject).
//
// Calling EnableWorkbookMode is the ONLY way any of this code runs: a
// SpreadsheetControl that never calls it behaves exactly as before —
// constructor, InitializeSpreadsheetControl, and every existing method are
// untouched. This module only ADDS spreadsheet.workbookState and four new
// methods to the SpreadsheetControl prototype.
//
// (c) Copyright 2026 SocialCalc contributors.
// Artistic License 2.0: http://socialcalc.org/licenses/al-20/.

type WorkbookUiMutableRoot = {
  SpreadsheetControlEnableWorkbookMode: (
    spreadsheet: SocialCalc.SpreadsheetControl,
    workbook?: SocialCalc.Workbook,
  ) => void;
  SpreadsheetControlSwitchToSheet: (
    spreadsheet: SocialCalc.SpreadsheetControl,
    name: string,
  ) => void;
  SpreadsheetControlRenderSheetTabs: (spreadsheet: SocialCalc.SpreadsheetControl) => void;
};
const WorkbookUiRoot = SocialCalc as unknown as WorkbookUiMutableRoot;

/**
 * Persists the currently-displayed sheet's editor settings (pane/ecell/
 * range) back into the workbook entry before switching away, mirroring how
 * SpreadsheetControlCreateSpreadsheetSave persists editor.SaveEditorSettings
 * for the single-sheet case.
 */
function wbUiPersistCurrentEditorSettings(spreadsheet: SocialCalc.SpreadsheetControl): void {
  const state = spreadsheet.workbookState;
  if (!state || state.renderedActiveName == null) return;
  state.workbook.SetSheetEditorSettings(
    state.renderedActiveName,
    spreadsheet.editor.SaveEditorSettings(),
  );
}

/**
 * Opts `spreadsheet` into multi-sheet workbook mode. Attaches `workbook`
 * (or a fresh one seeded with the control's current single sheet, renamed
 * "Sheet1", if omitted) and renders the accessible sheet-tab strip above
 * the grid. The control's `sheet`/`context.sheetobj` become an alias for
 * the workbook's active sheet.
 */
WorkbookUiRoot.SpreadsheetControlEnableWorkbookMode = function (
  spreadsheet: SocialCalc.SpreadsheetControl,
  workbook?: SocialCalc.Workbook,
): void {
  let wb = workbook;
  if (!wb) {
    wb = new SocialCalc.Workbook();
    wb.AddSheet("Sheet1", spreadsheet.sheet, false);
  }
  if (wb.activeSheetName == null) {
    // Defensive: a caller-supplied empty Workbook still needs >= 1 sheet.
    wb.AddSheet("Sheet1", null, false);
  }

  spreadsheet.workbookState = {
    workbook: wb,
    tabBarDiv: null,
    renderedActiveName: null,
  };

  const activeSheet = wb.GetActiveSheet()!;
  spreadsheet.sheet = activeSheet;
  spreadsheet.context.sheetobj = activeSheet;
  activeSheet.statuscallback = spreadsheet.editor.context.sheetobj.statuscallback;
  activeSheet.statuscallbackparams = spreadsheet.editor;

  // Build the tab-bar DOM strip, inserted just above the editor grid.
  const tabBar = document.createElement("div");
  tabBar.setAttribute("role", "tablist");
  tabBar.setAttribute("aria-label", "Sheets");
  SocialCalc.AssignID(spreadsheet, tabBar, "workbooktabs");
  wbUiInsertTabBar(spreadsheet, tabBar);
  spreadsheet.workbookState.tabBarDiv = tabBar;

  SocialCalc.SpreadsheetControlRenderSheetTabs(spreadsheet);
  SocialCalc.SpreadsheetControlSwitchToSheet(spreadsheet, wb.activeSheetName!);
};

/** Inserts the tab bar as the first child of the editor's top-level element. */
function wbUiInsertTabBar(spreadsheet: SocialCalc.SpreadsheetControl, tabBar: HTMLElement): void {
  const editorDiv = spreadsheet.editorDiv;
  if (editorDiv && editorDiv.parentNode) {
    editorDiv.parentNode.insertBefore(tabBar, editorDiv);
  } else if (spreadsheet.spreadsheetDiv) {
    spreadsheet.spreadsheetDiv.insertBefore(tabBar, spreadsheet.spreadsheetDiv.firstChild);
  }
}

SocialCalc.SpreadsheetControl.prototype.EnableWorkbookMode = function (
  this: SocialCalc.SpreadsheetControl,
  workbook?: SocialCalc.Workbook,
): void {
  SocialCalc.SpreadsheetControlEnableWorkbookMode(this, workbook);
};

SocialCalc.SpreadsheetControl.prototype.IsWorkbookMode = function (
  this: SocialCalc.SpreadsheetControl,
): boolean {
  return !!this.workbookState;
};

/**
 * Renders (or re-renders) the sheet-tab strip from the workbook's current
 * ListSheets() (hidden sheets omitted), one `role="tab"` element per
 * visible sheet plus a trailing "add sheet" button. Fully keyboard-
 * navigable: Left/Right/Home/End move focus between tabs (roving tabindex,
 * WAI-ARIA Tabs pattern), Enter/Space activates the focused tab.
 */
WorkbookUiRoot.SpreadsheetControlRenderSheetTabs = function (
  spreadsheet: SocialCalc.SpreadsheetControl,
): void {
  const state = spreadsheet.workbookState;
  if (!state || !state.tabBarDiv) return;
  const wb = state.workbook;
  const tabBar = state.tabBarDiv;

  while (tabBar.firstChild) {
    tabBar.removeChild(tabBar.firstChild);
  }

  const visible = wb.ListSheets().filter((s) => s.visible);

  visible.forEach((info, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.textContent = info.name;
    const isActive = info.name === wb.activeSheetName;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    // Roving tabindex (WAI-ARIA Tabs pattern): only the active tab is in
    // the Tab order; arrow keys move focus between the rest.
    tab.tabIndex = isActive ? 0 : -1;
    SocialCalc.AssignID(spreadsheet, tab, "sheettab-" + info.name);

    tab.onclick = function () {
      SocialCalc.SpreadsheetControlSwitchToSheet(spreadsheet, info.name);
    };
    tab.ondblclick = function () {
      wbUiRenamePrompt(spreadsheet, info.name);
    };
    tab.oncontextmenu = function (e: Event) {
      e.preventDefault();
      wbUiShowContextMenu(spreadsheet, info.name);
      return false;
    };
    tab.onkeydown = function (e: KeyboardEvent) {
      wbUiHandleTabKeydown(spreadsheet, e, index, visible.length);
    };

    tabBar.appendChild(tab);
  });

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.textContent = "+";
  addButton.setAttribute("aria-label", "Add sheet");
  addButton.tabIndex = 0;
  SocialCalc.AssignID(spreadsheet, addButton, "sheettab-add");
  addButton.onclick = function () {
    wbUiAddSheetPrompt(spreadsheet);
  };
  tabBar.appendChild(addButton);
};

/** Arrow/Home/End keyboard navigation across the tab strip (roving tabindex). */
function wbUiHandleTabKeydown(
  spreadsheet: SocialCalc.SpreadsheetControl,
  e: KeyboardEvent,
  index: number,
  count: number,
): void {
  const state = spreadsheet.workbookState;
  if (!state || !state.tabBarDiv || count === 0) return;
  let targetIndex: number | null = null;
  switch (e.key) {
    case "ArrowLeft":
      targetIndex = (index - 1 + count) % count;
      break;
    case "ArrowRight":
      targetIndex = (index + 1) % count;
      break;
    case "Home":
      targetIndex = 0;
      break;
    case "End":
      targetIndex = count - 1;
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      SocialCalc.SpreadsheetControlSwitchToSheet(
        spreadsheet,
        state.workbook.ListSheets().filter((s) => s.visible)[index]!.name,
      );
      return;
    default:
      return;
  }
  e.preventDefault();
  const tabs = state.tabBarDiv.childNodes;
  const targetTab = tabs[targetIndex] as unknown as
    | { focus?: () => void; tabIndex?: number }
    | undefined;
  if (targetTab && typeof targetTab.focus === "function") {
    targetTab.focus();
  }
}

/** Prompts for a new sheet name and adds it (host may replace via a custom handler). */
function wbUiAddSheetPrompt(spreadsheet: SocialCalc.SpreadsheetControl): void {
  const state = spreadsheet.workbookState;
  if (!state) return;
  const wb = state.workbook;
  let n = wb.sheetOrder.length + 1;
  let candidate = "Sheet" + n;
  while (wb.GetSheet(candidate)) {
    n++;
    candidate = "Sheet" + n;
  }
  // The loop above guarantees `candidate` is a fresh, valid name (no
  // collision, length/char constraints trivially satisfied by the
  // "SheetN" pattern), so AddSheet always returns OK here.
  wb.AddSheet(candidate);
  SocialCalc.SpreadsheetControlRenderSheetTabs(spreadsheet);
  SocialCalc.SpreadsheetControlSwitchToSheet(spreadsheet, candidate);
}

/** Renames `name` via window.prompt (host may override by reassigning this function). */
function wbUiRenamePrompt(spreadsheet: SocialCalc.SpreadsheetControl, name: string): void {
  const state = spreadsheet.workbookState;
  if (!state || typeof window === "undefined" || typeof window.prompt !== "function") return;
  const proposed = window.prompt("Rename sheet", name);
  if (proposed == null) return;
  const code = state.workbook.RenameSheet(name, proposed);
  if (code === SocialCalc.WorkbookNameValidation.OK) {
    SocialCalc.SpreadsheetControlRenderSheetTabs(spreadsheet);
  }
}

/**
 * Minimal accessible context-menu bridge: a native `confirm`-driven delete
 * action. Hosts embedding a richer UI should reassign
 * `SocialCalc.WorkbookUiContextMenuHandler` to replace this with a real
 * popup; the default keeps the feature usable with zero extra host wiring.
 */
function wbUiShowContextMenu(spreadsheet: SocialCalc.SpreadsheetControl, name: string): void {
  const handler = SocialCalc.WorkbookUiContextMenuHandler;
  if (handler) {
    handler(spreadsheet, name);
    return;
  }
  const state = spreadsheet.workbookState;
  if (!state || typeof window === "undefined" || typeof window.confirm !== "function") return;
  if (window.confirm('Delete sheet "' + name + '"?')) {
    const deleted = state.workbook.DeleteSheet(name);
    if (deleted) {
      // A successful delete on a non-empty workbook always leaves
      // activeSheetName set (DeleteSheet's own guards guarantee >= 1
      // visible sheet remains, and the active pointer is only ever
      // cleared by this reselection when the deleted sheet was active —
      // which always finds a replacement).
      SocialCalc.SpreadsheetControlRenderSheetTabs(spreadsheet);
      SocialCalc.SpreadsheetControlSwitchToSheet(spreadsheet, state.workbook.activeSheetName!);
    }
  }
}

/**
 * Switches the control's rendered/edited sheet to `name`. Persists the
 * outgoing sheet's editor settings, swaps context.sheetobj/spreadsheet.sheet
 * to the target Sheet instance, restores its saved editor settings (or
 * resets to A1/no-range for a sheet that has never been visited), re-wires
 * the sheet's statuscallback, and reschedules a full render.
 */
WorkbookUiRoot.SpreadsheetControlSwitchToSheet = function (
  spreadsheet: SocialCalc.SpreadsheetControl,
  name: string,
): void {
  const state = spreadsheet.workbookState;
  if (!state) return;
  const wb = state.workbook;
  if (!wb.IsSheetVisible(name)) return;

  wbUiPersistCurrentEditorSettings(spreadsheet);
  wb.SetActiveSheet(name);

  const newSheet = wb.GetSheet(name)!;
  spreadsheet.sheet = newSheet;
  spreadsheet.context.sheetobj = newSheet;
  newSheet.statuscallback = SocialCalc.EditorSheetStatusCallback;
  newSheet.statuscallbackparams = spreadsheet.editor;

  // context.sheetobj now points at newSheet, but rowpanes/colpanes/
  // colwidth/rowheight/usermax bounds still reflect the PREVIOUS sheet's
  // dimensions (RenderSheet only recomputes col width/row height
  // unconditionally on every render, but the pane first/last bounds
  // themselves are geometry state FitToEditTable owns — the same call
  // ResizeTableEditor makes after any dimension change).
  const savedSettings = wb.GetSheetEditorSettings(name);
  if (savedSettings) {
    spreadsheet.editor.LoadEditorSettings(savedSettings);
  } else {
    spreadsheet.editor.context.rowpanes = [{ first: 1, last: 1 }];
    spreadsheet.editor.context.colpanes = [{ first: 1, last: 1 }];
    spreadsheet.editor.ecell = null;
    spreadsheet.editor.range = { hasrange: false };
    spreadsheet.editor.range2 = { hasrange: false };
    spreadsheet.editor.context.highlights = {};
    spreadsheet.editor.MoveECell("A1");
  }

  state.renderedActiveName = name;
  spreadsheet.context.needcellskip = true;
  spreadsheet.context.needprecompute = true;
  // Recompute column widths/row heights/pane last-row-or-col against the
  // NEW sheet's colattribs/rowattribs/usermaxcol/usermaxrow — without this,
  // a sheet with different column widths or fewer/more rows than the
  // previously-active sheet renders with stale geometry.
  spreadsheet.editor.FitToEditTable();
  spreadsheet.editor.EditorRenderSheet();
  spreadsheet.editor.SchedulePositionCalculations();

  SocialCalc.SpreadsheetControlRenderSheetTabs(spreadsheet);
};

SocialCalc.SpreadsheetControl.prototype.SwitchToSheet = function (
  this: SocialCalc.SpreadsheetControl,
  name: string,
): void {
  SocialCalc.SpreadsheetControlSwitchToSheet(this, name);
};

SocialCalc.SpreadsheetControl.prototype.RenderSheetTabs = function (
  this: SocialCalc.SpreadsheetControl,
): void {
  SocialCalc.SpreadsheetControlRenderSheetTabs(this);
};
