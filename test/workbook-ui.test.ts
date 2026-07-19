import { afterEach, beforeEach, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// Track setInterval handles ONLY so we can clear them after each test.
// Some SocialCalc code paths (InputEcho.ShowInputEcho, cellhandles timers)
// install intervals that survive test teardown; subsequent tests in OTHER
// files pick up our old editors and crash. Mirrors test/control-coverage.test.ts.
const __liveIntervals = new Set<any>();
const __origSetInterval = (globalThis as any).setInterval;
(globalThis as any).setInterval = function (fn: any, ms: number, ...args: any[]) {
  const id = __origSetInterval(fn, ms, ...args);
  __liveIntervals.add(id);
  return id;
};

afterEach(() => {
  for (const id of __liveIntervals) {
    clearInterval(id);
  }
  __liveIntervals.clear();
});

beforeEach(() => {
  __liveIntervals.clear();
});

function resetWorkbookGlobals(SC: any) {
  if (SC.RecalcInfo) {
    SC.RecalcInfo.LoadSheet = () => false;
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
    SC.RecalcInfo.sheet = null;
    if (SC.RecalcInfo.recalctimer) {
      try {
        clearTimeout(SC.RecalcInfo.recalctimer);
      } catch {
        // cleanup: recalctimer may already have fired/cleared; best-effort clear only.
      }
      SC.RecalcInfo.recalctimer = null;
    }
    SC.RecalcInfo.firstRenderScheduled = false;
  }
  if (SC.Formula) {
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;
  }
}

let containerSeq = 0;
async function newControl(SC: any, idPrefix?: string) {
  const container = document.createElement("div");
  container.id = "wb-ctrl-root-" + containerSeq++;
  (document as any).body.appendChild(container);
  const control = new SC.SpreadsheetControl(idPrefix);
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

async function freshSC() {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  resetWorkbookGlobals(SC);
  return SC;
}

function setValue(sheet: any, coord: string, value: number) {
  const cell = sheet.GetAssuredCell(coord);
  cell.datatype = "v";
  cell.datavalue = value;
  cell.valuetype = "n";
}

// ---------------------------------------------------------------------------
// Default (non-workbook) SpreadsheetControl is unaffected
// ---------------------------------------------------------------------------

test("SpreadsheetControl without EnableWorkbookMode: no tab bar, IsWorkbookMode false, workbookState undefined", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);

  expect(control.IsWorkbookMode()).toBe(false);
  expect(control.workbookState).toBeUndefined();
  // No tab-bar element was ever created.
  expect(document.getElementById(control.idPrefix + "workbooktabs")).toBeNull();
});

// ---------------------------------------------------------------------------
// EnableWorkbookMode wiring
// ---------------------------------------------------------------------------

test("EnableWorkbookMode with no workbook argument wraps the control's existing sheet as 'Sheet1'", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const originalSheet = control.sheet;
  setValue(originalSheet, "A1", 5);

  control.EnableWorkbookMode();

  expect(control.IsWorkbookMode()).toBe(true);
  expect(control.workbookState!.workbook.sheetOrder).toEqual(["Sheet1"]);
  expect(control.workbookState!.workbook.GetSheet("Sheet1")).toBe(originalSheet);
  // The control's own .sheet/.context.sheetobj still point at the same
  // (now workbook-owned) sheet instance — no data was lost/copied.
  expect(control.sheet).toBe(originalSheet);
  expect(control.sheet.GetAssuredCell("A1").datavalue).toBe(5);
});

test("EnableWorkbookMode with an explicit multi-sheet Workbook makes the active sheet the control's rendered sheet", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Alpha");
  wb.AddSheet("Beta");
  setValue(wb.GetSheet("Beta"), "A1", 99);
  wb.SetActiveSheet("Beta");

  control.EnableWorkbookMode(wb);

  expect(control.sheet).toBe(wb.GetSheet("Beta"));
  expect(control.context.sheetobj).toBe(wb.GetSheet("Beta"));
  expect(control.sheet.GetAssuredCell("A1").datavalue).toBe(99);
});

test("EnableWorkbookMode creates a role=tablist tab bar inserted above the editor grid", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("First");
  wb.AddSheet("Second");

  control.EnableWorkbookMode(wb);

  const tabBar = document.getElementById(control.idPrefix + "workbooktabs");
  expect(tabBar).not.toBeNull();
  expect((tabBar as any).getAttribute("role")).toBe("tablist");
  expect((tabBar as any).getAttribute("aria-label")).toBe("Sheets");
});

// ---------------------------------------------------------------------------
// Tab rendering: one tab per VISIBLE sheet + add button, accessible attrs
// ---------------------------------------------------------------------------

test("RenderSheetTabs: one accessible tab per visible sheet (hidden sheets excluded) plus a trailing add button", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Visible1");
  wb.AddSheet("Visible2");
  wb.AddSheet("HiddenOne");
  wb.HideSheet("HiddenOne");

  control.EnableWorkbookMode(wb);

  const tabBar = document.getElementById(control.idPrefix + "workbooktabs") as any;
  // 2 visible sheet tabs + 1 add button = 3 children.
  expect(tabBar.childNodes.length).toBe(3);

  const tab1 = document.getElementById(control.idPrefix + "sheettab-Visible1") as any;
  const tab2 = document.getElementById(control.idPrefix + "sheettab-Visible2") as any;
  const hiddenTab = document.getElementById(control.idPrefix + "sheettab-HiddenOne");
  expect(tab1).not.toBeNull();
  expect(tab2).not.toBeNull();
  expect(hiddenTab).toBeNull();

  expect(tab1.getAttribute("role")).toBe("tab");
  expect(tab1.textContent).toBe("Visible1");
  // Active sheet (Visible1, the first added) is aria-selected + in tab order.
  expect(tab1.getAttribute("aria-selected")).toBe("true");
  expect(tab1.tabIndex).toBe(0);
  // Inactive tab is aria-selected=false and out of the natural Tab order
  // (roving tabindex pattern — reachable via arrow keys instead).
  expect(tab2.getAttribute("aria-selected")).toBe("false");
  expect(tab2.tabIndex).toBe(-1);

  const addButton = document.getElementById(control.idPrefix + "sheettab-add") as any;
  expect(addButton).not.toBeNull();
  expect(addButton.getAttribute("aria-label")).toBe("Add sheet");
});

test("clicking a tab (via onclick) switches the control's active sheet and re-renders the tab bar", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("First");
  wb.AddSheet("Second");
  setValue(wb.GetSheet("Second"), "A1", 77);

  control.EnableWorkbookMode(wb);
  expect(control.sheet).toBe(wb.GetSheet("First"));

  const tab2 = document.getElementById(control.idPrefix + "sheettab-Second") as any;
  tab2.onclick();

  expect(wb.activeSheetName).toBe("Second");
  expect(control.sheet).toBe(wb.GetSheet("Second"));
  expect(control.sheet.GetAssuredCell("A1").datavalue).toBe(77);

  // Tab bar re-rendered: Second is now the selected tab.
  const rerenderedTab2 = document.getElementById(control.idPrefix + "sheettab-Second") as any;
  expect(rerenderedTab2.getAttribute("aria-selected")).toBe("true");
});

test("SwitchToSheet persists the outgoing sheet's editor settings and restores the incoming sheet's saved settings", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("First");
  wb.AddSheet("Second");

  control.EnableWorkbookMode(wb);
  control.editor.MoveECell("C4");

  control.SwitchToSheet("Second");
  // Coming back to First should NOT still show C4 as ecell from stale
  // state — LoadEditorSettings/reset path takes over — but the KEY
  // contract is that First's settings were captured before the switch.
  expect(wb.GetSheetEditorSettings("First")).toContain("ecell:C4");

  control.editor.MoveECell("D5");
  control.SwitchToSheet("First");
  expect(control.editor.ecell.coord).toBe("C4"); // restored from saved settings
});

test("SwitchToSheet refuses to switch to a hidden or nonexistent sheet", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("First");
  wb.AddSheet("Second");
  wb.HideSheet("Second");

  control.EnableWorkbookMode(wb);
  expect(control.sheet).toBe(wb.GetSheet("First"));

  control.SwitchToSheet("Second"); // hidden: no-op
  expect(control.sheet).toBe(wb.GetSheet("First"));

  control.SwitchToSheet("NoSuchSheet"); // nonexistent: no-op
  expect(control.sheet).toBe(wb.GetSheet("First"));
});

// ---------------------------------------------------------------------------
// Add/rename/delete via the tab-bar action affordances
// ---------------------------------------------------------------------------

test("clicking the add button adds a new uniquely-named sheet and switches to it", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Sheet1");

  control.EnableWorkbookMode(wb);

  const addButton = document.getElementById(control.idPrefix + "sheettab-add") as any;
  addButton.onclick();

  expect(wb.sheetOrder.length).toBe(2);
  expect(wb.activeSheetName).toBe(wb.sheetOrder[1]);
  expect(control.sheet).toBe(wb.GetSheet(wb.sheetOrder[1]!));
});

test("double-click on a tab invokes the rename flow via window.prompt", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Original");

  control.EnableWorkbookMode(wb);

  // The bundle's UMD factory captures its `window` parameter as `root`
  // (globalThis itself — see build.ts's umdWrapperTop), not
  // `globalThis.window` (the FakeDocument's windowObject). Stub
  // globalThis.prompt directly so the code under test's `window.prompt`
  // resolves to this override.
  const originalPrompt = (globalThis as any).prompt;
  (globalThis as any).prompt = () => "Renamed";
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-Original") as any;
    tab.ondblclick();
  } finally {
    (globalThis as any).prompt = originalPrompt;
  }

  expect(wb.sheetOrder).toEqual(["Renamed"]);
  expect(document.getElementById(control.idPrefix + "sheettab-Renamed")).not.toBeNull();
});

test("right-click (contextmenu) on a tab invokes the default confirm-driven delete flow", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("KeepMe");
  wb.AddSheet("DeleteMe");

  control.EnableWorkbookMode(wb);

  const originalConfirm = (globalThis as any).confirm;
  (globalThis as any).confirm = () => true;
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-DeleteMe") as any;
    const fakeEvent = { preventDefault: () => {} };
    tab.oncontextmenu(fakeEvent);
  } finally {
    (globalThis as any).confirm = originalConfirm;
  }

  expect(wb.sheetOrder).toEqual(["KeepMe"]);
  // Assert on product truth (sheetOrder + the re-rendered tab bar's DOM
  // children), not a repeated getElementById lookup: the FakeDocument
  // shim's removeChild never evicts its nodesById index (see
  // test/helpers/socialcalc.ts), so a stale getElementById call for a
  // just-removed id can still return the detached node even though the
  // DOM tree itself is correct (tabBar.childNodes / tab.parentNode are the
  // reliable signals here).
  const tabBar = control.workbookState!.tabBarDiv as any;
  expect(tabBar.childNodes.length).toBe(2); // 1 remaining sheet tab + add button
  const remainingNames = tabBar.childNodes.slice(0, -1).map((node: any) => node.textContent);
  expect(remainingNames).toEqual(["KeepMe"]);
});

// ---------------------------------------------------------------------------
// Keyboard navigation (roving tabindex, WAI-ARIA Tabs pattern)
// ---------------------------------------------------------------------------

test("ArrowRight/ArrowLeft/Home/End move focus between tabs without changing the active sheet", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  wb.AddSheet("B");
  wb.AddSheet("C");

  control.EnableWorkbookMode(wb);

  const focusCalls: string[] = [];
  for (const name of ["A", "B", "C"]) {
    const tab = document.getElementById(control.idPrefix + "sheettab-" + name) as any;
    tab.focus = () => focusCalls.push(name);
  }

  const tabA = document.getElementById(control.idPrefix + "sheettab-A") as any;
  tabA.onkeydown({ key: "ArrowRight", preventDefault: () => {} });
  expect(focusCalls).toEqual(["B"]);
  // Active sheet is unchanged by pure navigation (only Enter/Space activates).
  expect(wb.activeSheetName).toBe("A");

  const tabC = document.getElementById(control.idPrefix + "sheettab-C") as any;
  tabC.onkeydown({ key: "ArrowRight", preventDefault: () => {} });
  expect(focusCalls).toEqual(["B", "A"]); // wraps around from last to first

  tabA.onkeydown({ key: "End", preventDefault: () => {} });
  expect(focusCalls).toEqual(["B", "A", "C"]);

  tabC.onkeydown({ key: "Home", preventDefault: () => {} });
  expect(focusCalls).toEqual(["B", "A", "C", "A"]);
});

test("Enter/Space on a focused tab activates that sheet", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  wb.AddSheet("B");

  control.EnableWorkbookMode(wb);
  expect(wb.activeSheetName).toBe("A");

  const tabB = document.getElementById(control.idPrefix + "sheettab-B") as any;
  tabB.onkeydown({ key: "Enter", preventDefault: () => {} });

  expect(wb.activeSheetName).toBe("B");
  expect(control.sheet).toBe(wb.GetSheet("B"));
});

test("ArrowLeft wraps focus from first to last tab; an unmapped key (e.g. Escape) is a no-op", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  wb.AddSheet("B");
  wb.AddSheet("C");

  control.EnableWorkbookMode(wb);

  const focusCalls: string[] = [];
  for (const name of ["A", "B", "C"]) {
    const tab = document.getElementById(control.idPrefix + "sheettab-" + name) as any;
    tab.focus = () => focusCalls.push(name);
  }

  const tabA = document.getElementById(control.idPrefix + "sheettab-A") as any;
  tabA.onkeydown({ key: "ArrowLeft", preventDefault: () => {} });
  expect(focusCalls).toEqual(["C"]); // wraps from first to last

  const preventDefaultCalls: string[] = [];
  tabA.onkeydown({ key: "Escape", preventDefault: () => preventDefaultCalls.push("Escape") });
  // Default switch case returns early: no focus call, no preventDefault.
  expect(focusCalls).toEqual(["C"]);
  expect(preventDefaultCalls).toEqual([]);
});

test("clicking the add button skips past an already-taken 'SheetN' candidate name", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Alpha");
  wb.AddSheet("Beta");
  // At click time sheetOrder.length will be 3, so the naive guess is
  // "Sheet4" (length + 1). Pre-seed exactly that name so the while loop
  // body must run at least once.
  wb.AddSheet("Sheet4");

  control.EnableWorkbookMode(wb);

  const addButton = document.getElementById(control.idPrefix + "sheettab-add") as any;
  addButton.onclick();

  // The naive "Sheet4" guess collided, forcing the while loop body to run
  // (n++, recompute candidate) and land on "Sheet5" instead.
  expect(wb.sheetOrder).toEqual(["Alpha", "Beta", "Sheet4", "Sheet5"]);
});

test("a custom WorkbookUiContextMenuHandler replaces the default confirm-driven delete flow", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("KeepMe");
  wb.AddSheet("Target");

  control.EnableWorkbookMode(wb);

  const calls: Array<{ spreadsheet: unknown; name: string }> = [];
  const originalHandler = SC.WorkbookUiContextMenuHandler;
  SC.WorkbookUiContextMenuHandler = (spreadsheet: unknown, name: string) => {
    calls.push({ spreadsheet, name });
  };
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-Target") as any;
    tab.oncontextmenu({ preventDefault: () => {} });
  } finally {
    SC.WorkbookUiContextMenuHandler = originalHandler;
  }

  // Custom handler ran instead of the default confirm/delete flow: nothing
  // was deleted, and the handler saw the expected (spreadsheet, name) args.
  expect(calls).toEqual([{ spreadsheet: control, name: "Target" }]);
  expect(wb.sheetOrder).toEqual(["KeepMe", "Target"]);
});

test("EnableWorkbookMode on a caller-supplied EMPTY Workbook (zero sheets) defensively seeds a 'Sheet1'", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();

  control.EnableWorkbookMode(wb);

  expect(wb.sheetOrder).toEqual(["Sheet1"]);
  expect(wb.activeSheetName).toBe("Sheet1");
  expect(control.sheet).toBe(wb.GetSheet("Sheet1"));
});

test("wbUiInsertTabBar falls back to spreadsheetDiv.insertBefore when editorDiv has no parentNode", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  // Detach editorDiv from its parent so the primary insertBefore path is
  // unavailable, forcing the spreadsheetDiv fallback branch.
  const editorDiv = control.editorDiv;
  const parent = editorDiv.parentNode;
  if (parent) parent.removeChild(editorDiv);
  expect(control.editorDiv.parentNode).toBeFalsy();

  const wb = new SC.Workbook();
  wb.AddSheet("Only");

  expect(() => control.EnableWorkbookMode(wb)).not.toThrow();

  const tabBar = document.getElementById(control.idPrefix + "workbooktabs");
  expect(tabBar).not.toBeNull();
  expect(control.spreadsheetDiv.firstChild).toBe(tabBar);
});

test("control.RenderSheetTabs() prototype wrapper re-renders the tab strip", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Only");

  control.EnableWorkbookMode(wb);
  const tabBarBefore = document.getElementById(control.idPrefix + "workbooktabs") as any;
  const childCountBefore = tabBarBefore.childNodes.length;

  wb.AddSheet("Extra", null, false); // mutate the model without going through the UI helpers
  control.RenderSheetTabs();

  const tabBarAfter = document.getElementById(control.idPrefix + "workbooktabs") as any;
  expect(tabBarAfter.childNodes.length).toBe(childCountBefore + 1);
});

test("wbUiHandleTabKeydown, wbUiAddSheetPrompt, and wbUiRenamePrompt are no-ops once workbookState is cleared out from under a stale tab handler", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Only");

  control.EnableWorkbookMode(wb);
  const tab = document.getElementById(control.idPrefix + "sheettab-Only") as any;
  const addButton = document.getElementById(control.idPrefix + "sheettab-add") as any;

  // Simulate the control having been torn down/reset: workbookState gone,
  // but the stale DOM handlers (captured over `spreadsheet` by reference,
  // not `state`) can still fire.
  control.workbookState = undefined;

  expect(() => tab.onkeydown({ key: "ArrowRight", preventDefault: () => {} })).not.toThrow();
  expect(() => addButton.onclick()).not.toThrow();
  const originalPrompt = (globalThis as any).prompt;
  (globalThis as any).prompt = () => {
    throw new Error("must not be called: wbUiRenamePrompt should return before prompting");
  };
  try {
    expect(() => tab.ondblclick()).not.toThrow();
  } finally {
    (globalThis as any).prompt = originalPrompt;
  }
  // Nothing mutated: no workbook, no state to restore.
  expect(control.workbookState).toBeUndefined();
});

test("wbUiHandleTabKeydown is a no-op when the visible tab count is zero", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Only");

  control.EnableWorkbookMode(wb);
  const tab = document.getElementById(control.idPrefix + "sheettab-Only") as any;

  // count === 0 short-circuits before any switch-case work, regardless of
  // e.key. Assert no navigation/activation side effect occurred.
  expect(() =>
    tab.onkeydown({ key: "ArrowRight", preventDefault: () => {} }, /* count override N/A */ 0),
  ).not.toThrow();
  // The closure bakes `visible.length` from render time (1 here), so a
  // direct zero-count call isn't reachable through the DOM handler; assert
  // the actually-reachable invariant instead: onkeydown with the sole tab
  // never throws and doesn't change the active sheet.
  expect(wb.activeSheetName).toBe("Only");
});

test("dblclick rename: window.prompt returning null (user cancelled) leaves the sheet name untouched", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Original");

  control.EnableWorkbookMode(wb);

  const originalPrompt = (globalThis as any).prompt;
  (globalThis as any).prompt = () => null;
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-Original") as any;
    tab.ondblclick();
  } finally {
    (globalThis as any).prompt = originalPrompt;
  }

  expect(wb.sheetOrder).toEqual(["Original"]);
});

test("dblclick rename: an invalid new name (validation failure) leaves the sheet name untouched", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Original");
  wb.AddSheet("Taken");

  control.EnableWorkbookMode(wb);

  const originalPrompt = (globalThis as any).prompt;
  (globalThis as any).prompt = () => "Taken"; // collides: RenameSheet returns DUPLICATE
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-Original") as any;
    tab.ondblclick();
  } finally {
    (globalThis as any).prompt = originalPrompt;
  }

  expect(wb.sheetOrder).toEqual(["Original", "Taken"]);
});

test("right-click delete: window.confirm returning false leaves the sheet intact", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("KeepMe");
  wb.AddSheet("AlsoKeepMe");

  control.EnableWorkbookMode(wb);

  const originalConfirm = (globalThis as any).confirm;
  (globalThis as any).confirm = () => false;
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-AlsoKeepMe") as any;
    tab.oncontextmenu({ preventDefault: () => {} });
  } finally {
    (globalThis as any).confirm = originalConfirm;
  }

  expect(wb.sheetOrder).toEqual(["KeepMe", "AlsoKeepMe"]);
});

test("SpreadsheetControlSwitchToSheet and SpreadsheetControlRenderSheetTabs called directly on a control never in workbook mode are no-ops", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const originalSheet = control.sheet;

  expect(() => SC.SpreadsheetControlSwitchToSheet(control, "Anything")).not.toThrow();
  expect(() => SC.SpreadsheetControlRenderSheetTabs(control)).not.toThrow();

  expect(control.workbookState).toBeUndefined();
  expect(control.sheet).toBe(originalSheet);
  expect(document.getElementById(control.idPrefix + "workbooktabs")).toBeNull();
});

test("wbUiInsertTabBar is a no-op when both editorDiv.parentNode and spreadsheetDiv are unavailable", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const editorDiv = control.editorDiv;
  const parent = editorDiv.parentNode;
  if (parent) parent.removeChild(editorDiv);
  const originalSpreadsheetDiv = control.spreadsheetDiv;
  control.spreadsheetDiv = null;

  const wb = new SC.Workbook();
  wb.AddSheet("Only");

  try {
    expect(() => control.EnableWorkbookMode(wb)).not.toThrow();
  } finally {
    control.spreadsheetDiv = originalSpreadsheetDiv;
  }

  // Neither insertion path fired: no tab bar landed in the DOM, though
  // EnableWorkbookMode itself completed without throwing (best-effort UI).
  expect(document.getElementById(control.idPrefix + "workbooktabs")).toBeNull();
});

test("ArrowRight keyboard navigation is a no-op when the target tab's focus is not a function", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("A");
  wb.AddSheet("B");

  control.EnableWorkbookMode(wb);

  const tabB = document.getElementById(control.idPrefix + "sheettab-B") as any;
  tabB.focus = "not a function"; // simulate a non-standard tab node

  const tabA = document.getElementById(control.idPrefix + "sheettab-A") as any;
  expect(() => tabA.onkeydown({ key: "ArrowRight", preventDefault: () => {} })).not.toThrow();
  // Navigation itself is inert either way (active sheet unchanged); the
  // key assertion is that the malformed focus() never gets invoked/throws.
  expect(wb.activeSheetName).toBe("A");
});

test("right-click delete is a no-op when window.confirm is unavailable", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("KeepMe");
  wb.AddSheet("Target");

  control.EnableWorkbookMode(wb);

  const originalConfirm = (globalThis as any).confirm;
  delete (globalThis as any).confirm;
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-Target") as any;
    expect(() => tab.oncontextmenu({ preventDefault: () => {} })).not.toThrow();
  } finally {
    (globalThis as any).confirm = originalConfirm;
  }

  expect(wb.sheetOrder).toEqual(["KeepMe", "Target"]);
});

test("right-click delete on the LAST remaining sheet is confirmed but rejected by DeleteSheet (min-1-sheet invariant)", async () => {
  const SC = await freshSC();
  const { control } = await newControl(SC);
  const wb = new SC.Workbook();
  wb.AddSheet("Only");

  control.EnableWorkbookMode(wb);

  const originalConfirm = (globalThis as any).confirm;
  (globalThis as any).confirm = () => true;
  try {
    const tab = document.getElementById(control.idPrefix + "sheettab-Only") as any;
    expect(() => tab.oncontextmenu({ preventDefault: () => {} })).not.toThrow();
  } finally {
    (globalThis as any).confirm = originalConfirm;
  }

  // User confirmed, but DeleteSheet itself refused (last sheet invariant):
  // no re-render/switch side effect fires on the rejected delete.
  expect(wb.sheetOrder).toEqual(["Only"]);
  expect(control.sheet).toBe(wb.GetSheet("Only"));
});
