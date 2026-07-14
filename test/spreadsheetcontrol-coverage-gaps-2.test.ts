import { afterEach, beforeEach, expect, test } from "vite-plus/test";

import {
  loadSocialCalc as _loadSocialCalc,
  recalcSheet,
  scheduleCommands,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import { ensureTrackedTimers, cancelActiveTrackedTimers } from "./helpers/timer-tracking";

// Track setInterval handles so we can clear them after each test.
const __liveIntervals = new Set<unknown>();
const __origSetInterval = globalThis.setInterval;
const setIntervalHolder = globalThis as unknown as { setInterval: typeof setInterval };
setIntervalHolder.setInterval = function (
  fn: (...args: unknown[]) => void,
  ms: number,
  ...args: unknown[]
) {
  const id = __origSetInterval(fn as TimerHandler, ms, ...(args as unknown[]));
  __liveIntervals.add(id);
  return id;
} as typeof setInterval;

afterEach(() => {
  for (const id of __liveIntervals) {
    { clearInterval(id as ReturnType<typeof setInterval>); }
  }
  __liveIntervals.clear();
  { const SC = (globalThis as unknown as { SocialCalc?: unknown }).SocialCalc;
  if (SC && typeof SC === "object" && "Keyboard" in SC) {
    const kbd = SC as unknown as { Keyboard: { focusTable: unknown } };
    kbd.Keyboard.focusTable = null;
  } }
  cancelActiveTrackedTimers();
});

beforeEach(() => {
  __liveIntervals.clear();
});

ensureTrackedTimers();

// Type alias for the control object shape we use throughout.
type Control = {
  idPrefix: string;
  sheet: {
    cells: Record<string, unknown>;
    names: Record<string, unknown>;
    changes: { tos: number; stack: Array<{ command: string[] }> };
    attribs: { defaultcolor?: string; defaultbgcolor?: string };
    colors: Record<string, string>;
  };
  editor: {
    ecell: { coord: string; row: number; col: number };
    range: { hasrange: boolean; left: number; top: number; right: number; bottom: number };
    range2: { hasrange: boolean; left: number; top: number; right: number; bottom: number };
    state: string;
    busy: boolean;
    inputBox: {
      element: { value: string; disabled?: boolean };
      GetText: () => string;
      Blur: () => void;
      ShowInputBox: (v: boolean) => void;
      Focus: () => void;
      DisplayCellContents: (v: unknown) => void;
    };
    StatusCallback: Record<string, { func: (e: unknown, s: string) => void; params: unknown }>;
    workingvalues: Record<string, unknown>;
    MoveECell: (coord: string) => void;
    RangeRemove: () => void;
    Range2Remove: () => void;
    RangeAnchor: (coord: string) => void;
    RangeExtend: (coord: string) => void;
    ECellReadonly: () => boolean;
    EditorSaveEdit: (text: string) => void;
    EditorScheduleSheetCommands: (str: string, saveundo: boolean, b: boolean) => void;
    MoveECellCallback: Record<string, unknown>;
    UpdateCellCSS: (cell: unknown, row: number, col: number) => void;
    context: {
      sheetobj: unknown;
      showRCHeaders?: boolean;
      rowpanes: Array<{ first: number; last: number }>;
      colpanes: Array<{ first: number; last: number }>;
      cellskip: Record<string, string>;
      CoordInPane: (coord: string, rp: number, cp: number) => boolean;
    };
    griddiv: unknown;
  };
  tabs: Array<{
    name: string;
    text: string;
    html: string;
    view?: string;
    onclick?: (s: unknown, t: string) => void;
    onunclick?: (s: unknown, t: string) => void;
    oncreate?: (s: unknown, t: string) => void;
    onclickFocus?: unknown;
  }>;
  tabnums: Record<string, number>;
  views: Record<
    string,
    {
      name: string;
      element: HTMLElement;
      html?: string;
      divStyle?: string;
      replacements?: Record<string, { regex: RegExp; replacement: string }>;
      oncreate?: (s: unknown, v: unknown) => void;
      values?: Record<string, unknown>;
    }
  >;
  spreadsheetDiv: HTMLElement;
  formulabarDiv: HTMLElement;
  sortrange: string;
  ExecuteCommand: (combo: string, sstr: string) => void;
  ParseSheetSave: (str: string) => unknown;
  CreateSpreadsheetSave: (otherparts?: unknown) => string;
  DecodeSpreadsheetSave: (str: string) => Record<string, unknown>;
  InitializeSpreadsheetControl: (node: Node | string, h?: number, w?: number, s?: number) => void;
  Buttons: Record<string, { tooltip: string; command: string }>;
};

type SC = {
  SpreadsheetControl: (new (id?: string) => Control) & {
    DoFunctionList: () => void;
    DoLink: () => void;
    DoLinkPaste: () => void;
    HideLink: () => void;
    GetFunctionNamesStr: (cname?: string) => string;
    DoLinkClear: () => void;
  };
  SetSpreadsheetControlObject: (c: unknown) => void;
  GetSpreadsheetControlObject: () => Control | undefined;
  CurrentSpreadsheetControlObject: unknown;
  CurrentSpreadsheetViewerObject: unknown;
  debug_log?: unknown[];
  OtherSaveParts: Record<string, string>;
  Callbacks: { MakePageLink?: unknown };
  Keyboard: { focusTable: unknown; passThru?: boolean };
  Popup: {
    Types: { ColorChooser: { CloseOK: (e?: unknown) => void } };
    Controls: Record<string, { data: { value: string } }>;
    Current: { id: string };
    SetValue: (id: string, val: string) => void;
    GetValue: (id: string) => string | undefined;
    SetDisabled: (id: string, disabled: boolean) => void;
    Close: () => void;
    Create: (type: string, id: string, opts: unknown) => void;
    Initialize: (id: string, opts: unknown) => void;
    Reset: (type: string) => void;
  };
  DoCmd: (obj: unknown, which: string) => void;
  LoadColumnChoosers: (s: unknown) => void;
  SheetUndo: (s: unknown) => void;
  SheetRedo: (s: unknown) => void;
  KeyboardFocus: () => void;
  SettingsControls: {
    PopupChangeCallback: (a: unknown, i: string, v: unknown) => void;
    PopupListGetValue: (p: unknown, c: string) => { def: boolean; val: number } | null;
    PopupListInitialize: (p: unknown, c: string) => void;
    PopupListSetValue: (p: unknown, c: string, v: unknown) => void;
    BorderSideSetValue: (p: unknown, c: string, v: unknown) => void;
    BorderSideGetValue: (p: unknown, c: string) => { def: boolean; val: string } | undefined;
    Controls: Record<
      string,
      {
        SetValue: unknown;
        GetValue: unknown;
        Initialize: unknown;
        OnReset?: unknown;
        OnClick?: unknown;
        InitialData?: string;
        ChangedCallback: unknown;
      }
    >;
    CurrentPanel: unknown;
    idPrefix: string;
  };
  SpreadsheetControlSortSave: (e: unknown, s: unknown) => string;
  SpreadsheetControlNamesChangedName: () => void;
  CtrlSEditor: (w: string) => void;
  SpreadsheetControlExecuteCommand: (obj: unknown, command: string, value: string) => void;
  SpreadsheetControlCommentSet: () => void;
  ButtonInfo?: { registeredElements?: Array<{ functionobj?: { Disabled?: () => boolean } }> };
  Constants: { defaultCellLayout: string; defaultCellFontSize: string } & Record<string, unknown>;
  Formula: {
    FunctionClasses: Record<string, { items: string[]; name: string }>;
    FunctionList: Record<string, unknown[]>;
    FillFunctionInfo: () => void;
  };
  SpreadsheetCmdLookup: Record<string, string>;
  SpreadsheetCmdSLookup: Record<string, string>;
  GetCellContents: (sheetobj: unknown, coord: string) => string;
  ParseCellLinkText: (str: string) => {
    url: string;
    desc: string;
    newwin: boolean;
    pagename: string;
    workspace: string;
  };
  GetEditorCellElement: (
    editor: unknown,
    row: number,
    col: number,
  ) => { element: { title?: string }; rowpane: number; colpane: number } | null;
};

async function loadSocialCalc(): Promise<SC> {
  const SC = await _loadSocialCalc({ browser: true });
  installUiShim();
  return SC as unknown as SC;
}

let containerSeq = 0;
async function newControl(
  SC: SC,
  idPrefix?: string,
): Promise<{ control: Control; container: HTMLElement }> {
  const container = document.createElement("div");
  container.id = "ctrl-root-" + containerSeq++;
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(container);
  const control = new SC.SpreadsheetControl(idPrefix);
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

function waitEditor(
  editor: Control["editor"],
  wantStatus: string | ((s: string) => boolean) = "doneposcalc",
  timeoutMs = 3000,
): Promise<void> {
  const matches = typeof wantStatus === "function" ? wantStatus : (s: string) => s === wantStatus;
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  const key = "tmpc_" + Math.random().toString(36).slice(2);
  const timer = setTimeout(() => {
    delete editor.StatusCallback[key];
    resolve();
  }, timeoutMs);
  editor.StatusCallback[key] = {
    func: (_e: unknown, status: string) => {
      if (matches(status)) {
        clearTimeout(timer);
        delete editor.StatusCallback[key];
        resolve();
      }
    },
    params: null,
  };
  return promise;
}

// Helper to create a select element with options and selectedIndex.
function makeSelect(
  idp: string,
  id: string,
  opts: Array<{ text: string; value: string }>,
  selIdx: number,
): void {
  const el = document.createElement("select");
  el.id = idp + id;
  const inner = el as unknown as {
    __options: Array<{ text: string; value: string }>;
    __selectedIndex: number;
  };
  inner.__options = opts;
  inner.__selectedIndex = selIdx;
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(el);
}

// Helper to create a checkbox-like input with checked state.
function makeCheckbox(idp: string, id: string, checked: boolean): void {
  const el = document.createElement("input");
  el.id = idp + id;
  const inner = el as unknown as { checked: boolean };
  inner.checked = checked;
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(el);
}

// Helper to delete an element from the FakeDocument's nodesById map.
function deleteFromRegistry(id: string): void {
  const doc = document as unknown as { nodesById: Map<string, unknown> };
  doc.nodesById.delete(id);
}

// -------------------------------------------------------------------
// Test 1: Audit tab ObjToSource — non-object value (number/boolean)
// Covers lines 17330 false branch and 17351 false branch
// -------------------------------------------------------------------
test("Audit tab: ObjToSource with non-object debug_log entries", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // debug_log with a number entry: typeof number != "object" → skips both
  // the push (line 17330 false) and the pop (line 17351 false).
  SC.debug_log = [42, true];

  const auditTabIdx = control.tabnums.audit;
  const onclick = control.tabs[auditTabIdx].onclick;
  expect(onclick).toBeDefined();
  { onclick!(control, "audit"); }
});

// -------------------------------------------------------------------
// Test 2: Audit tab ObjToSource — nested objects (check array mismatch)
// Covers line 17334 false branch
// -------------------------------------------------------------------
test("Audit tab: ObjToSource with nested objects for check[i]==o false", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // An object with a nested object property: the recursive call will
  // check the inner object against the outer (already in check array),
  // find no match → line 17334 false branch.
  const outer = { a: { b: 1 } };
  SC.debug_log = [outer];

  const auditTabIdx = control.tabnums.audit;
  const onclick = control.tabs[auditTabIdx].onclick;
  expect(onclick).toBeDefined();
  { onclick!(control, "audit"); }
});

// -------------------------------------------------------------------
// Test 3: Button missing alert — lines 17516 (if true), 17517-17518 (stmts)
// -------------------------------------------------------------------
test("InitializeSpreadsheetControl: button missing during first init", async () => {
  const SC = await loadSocialCalc();

  // Monkeypatch document.getElementById to return null for one button.
  const origGetById = document.getElementById.bind(document);
  const blockedId = "ctrl-button_recalc";
  let patchActive = true;
  const patchedDoc = document as unknown as { getElementById: (id: string) => HTMLElement | null };
  patchedDoc.getElementById = function (id: string): HTMLElement | null {
    if (patchActive && id === blockedId) return null;
    return origGetById(id);
  };

  const container = document.createElement("div");
  container.id = "btn-missing-root";
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(container);

  // Create control with idPrefix that matches blockedId
  const control = new SC.SpreadsheetControl("ctrl-");
  { control.InitializeSpreadsheetControl(container, 400, 600, 20); }

  patchActive = false;
  patchedDoc.getElementById = origGetById;
});

// -------------------------------------------------------------------
// Test 4: View without oncreate — line 17625 false branch
// -------------------------------------------------------------------
test("InitializeSpreadsheetControl: view without oncreate callback", async () => {
  const SC = await loadSocialCalc();
  const control = new SC.SpreadsheetControl("noview-");

  // Add a custom view without oncreate before init.
  control.views["noview"] = {
    name: "noview",
    element: document.createElement("div"),
    html: "<div>test</div>",
  };

  const container = document.createElement("div");
  container.id = "noview-container";
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(container);

  { control.InitializeSpreadsheetControl(container, 400, 600, 20); }
});

// -------------------------------------------------------------------
// Test 5: SetSpreadsheetControlObject with falsy focusTable — line 17658 false branch
// -------------------------------------------------------------------
test("SetSpreadsheetControlObject: falsy focusTable branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);

  // Set focusTable to null (falsy) → condition is false
  SC.Keyboard.focusTable = null;
  SC.SetSpreadsheetControlObject(control);
  // No throw expected — the false branch just skips the assignment
});

// -------------------------------------------------------------------
// Test 6: Changed-rowcolstuff with empty slist — line 17845 false branch
// Requires mocked SpreadsheetCmdTable
// -------------------------------------------------------------------
test("DoCmd populates and executes both legacy command combo families", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  makeSelect(idp, "rowcolstufflist", [], 0);
  makeSelect(idp, "rowcolstuffslist", [], 0);
  makeSelect(idp, "textlist", [], 0);
  makeSelect(idp, "textslist", [], 0);

  const spreadsheetCmdTable = {
    rowcolstuff: [{ t: "Insert", s: "rowcol", c: "insert%S %C" }],
    text: [{ t: "Cell Color", s: "colors", c: "set %C color %S" }],
    slists: {
      rowcol: [{ t: "Rows", s: "row" }],
      colors: [{ t: "Red", s: "rgb(255,0,0)" }],
      empty: [],
    },
  };
  const commandTableHolder = SC as unknown as {
    SpreadsheetCmdTable?: typeof spreadsheetCmdTable;
  };
  const originalTable = commandTableHolder.SpreadsheetCmdTable;
  const originalExecute = SC.SpreadsheetControlExecuteCommand;
  const executed: Array<[string, string]> = [];
  commandTableHolder.SpreadsheetCmdTable = spreadsheetCmdTable;
  SC.SpreadsheetControlExecuteCommand = (_obj: unknown, command: string, value: string) => {
    executed.push([command, value]);
  };

  try {
    SC.DoCmd(null, "fill-rowcolstuff");
    SC.DoCmd(null, "fill-text");
    SC.DoCmd(null, "changed-rowcolstuff");
    SC.DoCmd(null, "changed-text");

    const rowCommands = document.getElementById(idp + "rowcolstufflist") as HTMLSelectElement;
    const rowValues = document.getElementById(idp + "rowcolstuffslist") as HTMLSelectElement;
    const textCommands = document.getElementById(idp + "textlist") as HTMLSelectElement;
    const textValues = document.getElementById(idp + "textslist") as HTMLSelectElement;
    expect(Array.from(rowCommands.options).map((option) => option.text)).toEqual(["Insert"]);
    expect(Array.from(rowValues.options).map((option) => option.value)).toEqual(["row"]);
    expect(Array.from(textCommands.options).map((option) => option.text)).toEqual(["Cell Color"]);
    expect(Array.from(textValues.options).map((option) => option.value)).toEqual(["rgb(255,0,0)"]);

    Object.assign(rowValues, { 0: rowValues.options[0] });
    Object.assign(textValues, { 0: textValues.options[0] });
    SC.DoCmd(null, "ok-rowcolstuff");
    SC.DoCmd(null, "ok-text");
    expect(executed).toEqual([
      ["insert%S %C", "row"],
      ["set %C color %S", "rgb(255,0,0)"],
    ]);

    spreadsheetCmdTable.rowcolstuff[0].s = "empty";
    SC.DoCmd(null, "changed-rowcolstuff");
    expect(rowValues.options).toHaveLength(0);
  } finally {
    SC.SpreadsheetControlExecuteCommand = originalExecute;
    if (originalTable === undefined) {
      delete commandTableHolder.SpreadsheetCmdTable;
    } else {
      commandTableHolder.SpreadsheetCmdTable = originalTable;
    }
  }
});

// -------------------------------------------------------------------
// Test 7: ok-setsort "all" with cells where row/col checks take false branch
// Covers lines 17879 false, 17882 false
// -------------------------------------------------------------------
test("DoCmd: ok-setsort 'all' with multiple cells (max_row/col false branches)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  for (const id of ["sortbutton"]) {
    if (!document.getElementById(idp + id)) {
      const el = document.createElement("input");
      el.id = idp + id;
      const body = document as unknown as { body: { appendChild: (n: Node) => void } };
      body.body.appendChild(el);
    }
  }
  makeSelect(
    idp,
    "majorsort",
    [
      { text: "[None]", value: "" },
      { text: "A", value: "A" },
    ],
    1,
  );
  makeCheckbox(idp, "majorsortup", true);
  makeSelect(idp, "minorsort", [{ text: "[None]", value: "" }], 0);
  makeCheckbox(idp, "minorsortup", true);
  makeSelect(idp, "lastsort", [{ text: "[None]", value: "" }], 0);
  makeCheckbox(idp, "lastsortup", true);

  const sortlist = document.createElement("select");
  sortlist.id = idp + "sortlist";
  const slInner = sortlist as unknown as {
    __options: Array<{ text: string; value: string }>;
    __selectedIndex: number;
  };
  slInner.__options = [
    { text: "[select range]", value: "" },
    { text: "All", value: "all" },
  ];
  slInner.__selectedIndex = 1;
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(sortlist);

  // Put 2+ cells so min/max computation hits the ">" false branches
  // (when cr.row <= max_row and cr.col <= max_col after max is already set)
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 value n 1",
    "set B2 value n 2",
    "set A3 value n 3",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);

  { SC.DoCmd(null, "ok-setsort"); }
});

// -------------------------------------------------------------------
// Test 8: dosort with minorsort/lastsort selected AND checked=true
// Covers lines 17919 true (checked), 17924 true (checked)
// -------------------------------------------------------------------
test("DoCmd: dosort with minor/last sort selected and checked=true", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  makeSelect(
    idp,
    "majorsort",
    [
      { text: "[None]", value: "" },
      { text: "A", value: "A" },
    ],
    1,
  );
  makeCheckbox(idp, "majorsortup", true);
  makeSelect(
    idp,
    "minorsort",
    [
      { text: "[None]", value: "" },
      { text: "B", value: "B" },
    ],
    1,
  );
  makeCheckbox(idp, "minorsortup", true);
  makeSelect(
    idp,
    "lastsort",
    [
      { text: "[None]", value: "" },
      { text: "C", value: "C" },
    ],
    1,
  );
  makeCheckbox(idp, "lastsortup", true);

  control.sortrange = "A1:C3";

  { SC.DoCmd(null, "dosort");
  await waitEditor(control.editor); }
});

// -------------------------------------------------------------------
// Test 9: merge case with deleted SpreadsheetCmdLookup.merge — line 17929 false
// -------------------------------------------------------------------
test("DoCmd: merge with SpreadsheetCmdLookup.merge deleted (|| fallback)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Delete the "merge" entry from SpreadsheetCmdLookup so the || "" fallback fires
  const lookup = SC.SpreadsheetCmdLookup;
  const origMerge = lookup.merge;
  delete lookup.merge;

  { SC.DoCmd(null, "merge");
  await waitEditor(control.editor); }

  // Restore
  if (origMerge !== undefined) lookup.merge = origMerge;
});

// -------------------------------------------------------------------
// Test 10: swapcolors with defaultcolor AND defaultbgcolor set — lines 17984 true, 17985 true
// -------------------------------------------------------------------
test("DoCmd: swapcolors with defaultcolor and defaultbgcolor set", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Set both defaultcolor and defaultbgcolor to truthy values
  control.sheet.attribs.defaultcolor = "black";
  control.sheet.attribs.defaultbgcolor = "white";
  control.sheet.colors["black"] = "rgb(0,0,0)";
  control.sheet.colors["white"] = "rgb(255,255,255)";

  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 color rgb(255,255,255)",
    "set A1 bgcolor rgb(0,0,0)",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);

  control.editor.ecell.coord = "A1";
  control.editor.ecell.row = 1;
  control.editor.ecell.col = 1;

  { SC.DoCmd(null, "swapcolors");
  await waitEditor(control.editor); }
});

// -------------------------------------------------------------------
// Test 11: GetFunctionNamesStr with undefined cname — line 18179 false branch
// -------------------------------------------------------------------
test("GetFunctionNamesStr: called with undefined cname (|| 'all' fallback)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  SC.Formula.FillFunctionInfo();
  const result = SC.SpreadsheetControl.GetFunctionNamesStr(undefined);
  expect(typeof result).toBe("string");
  expect(result.length).toBeGreaterThan(0);
  expect(result).toContain('value="SUM"');
});

// -------------------------------------------------------------------
// Test 12: DoLink with editor.state="input" — line 18358 switch alt=1
// -------------------------------------------------------------------
test("DoLink: editor.state='input' switch case", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Set editor state to "input" and provide inputBox text
  control.editor.state = "input";
  control.editor.inputBox.element.value = "some text";

  { SC.SpreadsheetControl.DoLink(); }

  // Clean up the dialog
  const dlg = document.getElementById(control.idPrefix + "linkdialog");
  if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg);
});

// -------------------------------------------------------------------
// Test 13: DoLink with cell that has textvalueformat — line 18378 false branch
// -------------------------------------------------------------------
test("DoLink: cell with textvalueformat set (setformat = '')", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Set a cell with textvalueformat so setformat is "" (false branch of cond-expr)
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 textvalueformat text-link",
    "set A1 text t Hello",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);
  control.editor.ecell.coord = "A1";
  control.editor.state = "start";

  { SC.SpreadsheetControl.DoLink(); }

  const dlg = document.getElementById(control.idPrefix + "linkdialog");
  if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg);
});

// -------------------------------------------------------------------
// Test 14: DoLink with <<url>> text — line 18379 true branch (newwin)
// -------------------------------------------------------------------
test("DoLink: <<url>> format triggers newwin=true (popup checked)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Set cell content with <<url>> format → ParseCellLinkText returns newwin=true
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 text t <<http://example.com>>",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);
  control.editor.ecell.coord = "A1";
  control.editor.state = "start";

  { SC.SpreadsheetControl.DoLink(); }

  const dlg = document.getElementById(control.idPrefix + "linkdialog");
  if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg);
});

// -------------------------------------------------------------------
// Test 15: DoLinkPaste with formatele.checked=false — line 18488 false branch
// -------------------------------------------------------------------
test("DoLinkPaste: formatele.checked=false branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // First call DoLink to create the dialog elements
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 text t http://link.test",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);
  control.editor.ecell.coord = "A1";
  control.editor.state = "start";

  { SC.SpreadsheetControl.DoLink(); }

  // Now find the format checkbox and set checked=false
  const formatEl = document.getElementById(control.idPrefix + "linkformat") as unknown as {
    checked: boolean;
  } | null;
  if (formatEl) {
    formatEl.checked = false;
  }

  { SC.SpreadsheetControl.DoLinkPaste(); }

  // Clean up
  const dlg = document.getElementById(control.idPrefix + "linkdialog");
  if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg);
});

// -------------------------------------------------------------------
// Test 16: SpreadsheetControlCommentSet with ECellReadonly()=true — line 18696 false branch
// -------------------------------------------------------------------
test("SpreadsheetControlCommentSet: ECellReadonly()=true skips title assignment", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Monkeypatch ECellReadonly to return true
  const origECellReadonly = control.editor.ECellReadonly;
  control.editor.ECellReadonly = () => true;

  // Ensure commenttext element exists
  const idp = control.idPrefix;
  const commentEl = document.getElementById(idp + "commenttext");
  if (!commentEl) {
    const el = document.createElement("textarea");
    el.id = idp + "commenttext";
    const inner = el as unknown as { value: string };
    inner.value = "test comment";
    const body = document as unknown as { body: { appendChild: (n: Node) => void } };
    body.body.appendChild(el);
  } else {
    const inner = commentEl as unknown as { value: string };
    inner.value = "test comment";
  }

  const commands: string[] = [];
  control.ExecuteCommand = (command: string) => {
    commands.push(command);
  };
  { SC.SpreadsheetControlCommentSet(); }
  expect(commands).toEqual(["set %C comment test comment"]);

  control.editor.ECellReadonly = origECellReadonly;
});

// -------------------------------------------------------------------
// Test 17: PopupChangeCallback with non-matching defaultCellLayout — line 19036 false
// -------------------------------------------------------------------
test("PopupChangeCallback: defaultCellLayout regex doesn't match (|| fallback)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Monkeypatch defaultCellLayout to a non-matching string
  const origLayout = SC.Constants.defaultCellLayout;
  SC.Constants.defaultCellLayout = "invalid";

  // Ensure sample-text element exists
  let sampleText = document.getElementById("sample-text");
  if (!sampleText) {
    sampleText = document.createElement("div");
    sampleText.id = "sample-text";
    sampleText.appendChild(document.createElement("div"));
    sampleText.appendChild(document.createElement("div"));
    const body = document as unknown as { body: { appendChild: (n: Node) => void } };
    body.body.appendChild(sampleText);
  }

  const cellPanel = control.views.settings.values!.cellspanel;

  { SC.SettingsControls.PopupChangeCallback({ panelobj: cellPanel }, "", null); }

  SC.Constants.defaultCellLayout = origLayout;
});

// -------------------------------------------------------------------
// Test 18: PopupChangeCallback border value with missing element — line 19056 false
// -------------------------------------------------------------------
test("PopupChangeCallback: BorderSideGetValue returns falsy (element missing)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Ensure sample-text element exists
  let sampleText = document.getElementById("sample-text");
  if (!sampleText) {
    sampleText = document.createElement("div");
    sampleText.id = "sample-text";
    sampleText.appendChild(document.createElement("div"));
    sampleText.appendChild(document.createElement("div"));
    const body = document as unknown as { body: { appendChild: (n: Node) => void } };
    body.body.appendChild(sampleText);
  }

  const cellPanel = control.views.settings.values!.cellspanel as unknown as { cbt: { id: string } };

  // Delete one of the border onoff-bcb elements from the registry
  deleteFromRegistry(cellPanel.cbt.id + "-onoff-bcb");

  { SC.SettingsControls.PopupChangeCallback({ panelobj: cellPanel }, "", null); }
});

// -------------------------------------------------------------------
// Test 19: PopupListInitialize with no initialdata and no InitialData — lines 19106, 19110
// -------------------------------------------------------------------
test("PopupListInitialize: no initialdata and no InitialData (|| fallbacks)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Create a mock panelobj with a control that has no initialdata and no InitialData
  const idp = control.idPrefix;
  const panelobj = {
    mockctrl: {
      type: "MockType",
      id: idp + "mockctrl",
    },
  };

  // Ensure the Controls entry for MockType has no InitialData
  SC.SettingsControls.Controls.MockType = {
    SetValue: () => {},
    GetValue: () => null,
    Initialize: () => {},
    ChangedCallback: null,
  };

  { SC.SettingsControls.PopupListInitialize(panelobj, "mockctrl"); }

  delete SC.SettingsControls.Controls.MockType;
});

// -------------------------------------------------------------------
// Test 20: BorderSideSetValue with element missing — line 19198 true + 19199 stmt
// -------------------------------------------------------------------
test("BorderSideSetValue: element missing (if(!ele) return)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const cellPanel = control.views.settings.values!.cellspanel as unknown as { cbt: { id: string } };

  // Provide a non-null value so we pass the first guard (!value)
  // but delete the onoff-bcb element so if(!ele) is true
  deleteFromRegistry(cellPanel.cbt.id + "-onoff-bcb");

  { SC.SettingsControls.BorderSideSetValue(cellPanel, "cbt", {
    def: false,
    val: "1px solid rgb(0,0,0)",
  }); }
});

// -------------------------------------------------------------------
// Test 21: BorderSideGetValue with element missing — line 19220 true + 19221 stmt
// -------------------------------------------------------------------
test("BorderSideGetValue: element missing (if(!ele) return)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const cellPanel = control.views.settings.values!.cellspanel as unknown as { cbt: { id: string } };

  // Delete the onoff-bcb element from registry so getElementById returns null
  deleteFromRegistry(cellPanel.cbt.id + "-onoff-bcb");

  { const result = SC.SettingsControls.BorderSideGetValue(cellPanel, "cbt");
  expect(result).toBeUndefined(); }
});
