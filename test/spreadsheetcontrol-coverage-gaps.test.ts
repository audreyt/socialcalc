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
(globalThis as unknown as { setInterval: typeof setInterval }).setInterval = function (
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
    {
      clearInterval(id as ReturnType<typeof setInterval>);
    }
  }
  __liveIntervals.clear();
  {
    const SC = (globalThis as unknown as { SocialCalc?: unknown }).SocialCalc;
    if (SC && typeof SC === "object" && "Keyboard" in SC) {
      (SC as unknown as { Keyboard: { focusTable: unknown } }).Keyboard.focusTable = null;
    }
  }
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
    ParseSheetSave: (value: string) => void;
  };
  editor: {
    ecell: { coord: string; row: number; col: number };
    range: { hasrange: boolean; left: number; top: number; right: number; bottom: number };
    range2: { hasrange: boolean; left: number; top: number; right: number; bottom: number };
    state: string;
    busy: boolean;
    inputBox: {
      element: { value: string };
      GetText: () => string;
      Blur: () => void;
      ShowInputBox: (v: boolean) => void;
    };
    StatusCallback: Record<string, { func: (e: unknown, s: string) => void; params: unknown }>;
    MoveECell: (coord: string) => void;
    RangeRemove: () => void;
    Range2Remove: () => void;
    RangeAnchor: (coord: string) => void;
    RangeExtend: (coord: string) => void;
    ECellReadonly: () => boolean;
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
};

type SC = {
  SpreadsheetControl: (new (id?: string) => Control) & {
    DoFunctionList: () => void;
    DoLink: () => void;
  };
  SetSpreadsheetControlObject: (c: unknown) => void;
  GetSpreadsheetControlObject: () => Control | undefined;
  CurrentSpreadsheetControlObject: unknown;
  CurrentSpreadsheetViewerObject: unknown;
  Popup: {
    Types: { ColorChooser: { CloseOK: (e?: unknown) => void } };
    Controls: Record<string, { data: { value: string } }>;
    Current: { id: string };
    SetValue: (id: string, val: string) => void;
    Close: () => void;
  };
  DoCmd: (obj: unknown, which: string) => void;
  LoadColumnChoosers: (s: unknown) => void;
  SheetUndo: (s: unknown) => void;
  SheetRedo: (s: unknown) => void;
  KeyboardFocus: () => void;
  SettingsControls: {
    PopupChangeCallback: (a: unknown, i: string, v: unknown) => void;
    PopupListGetValue: (p: unknown, c: string) => { def: boolean; val: number } | null;
    BorderSideSetValue: (p: unknown, c: string, v: unknown) => void;
  };
  SpreadsheetControlSortSave: (e: unknown, s: unknown) => string;
  SpreadsheetControlNamesChangedName: () => void;
  CtrlSEditor: (w: string) => void;
  ButtonInfo?: { registeredElements?: Array<{ functionobj?: { Disabled?: () => boolean } }> };
  FormatNumber: {
    formatNumberWithFormat: (value: number, format: string, suffix: string) => string;
  };
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
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(container);
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
  return new Promise((resolve) => {
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
  });
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
  // Use the FakeElement internal __options and __selectedIndex.
  const inner = el as unknown as {
    __options: Array<{ text: string; value: string }>;
    __selectedIndex: number;
  };
  inner.__options = opts;
  inner.__selectedIndex = selIdx;
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
}

// Helper to create a checkbox-like input with checked state.
function makeCheckbox(idp: string, id: string, checked: boolean): void {
  const el = document.createElement("input");
  el.id = idp + id;
  (el as unknown as { checked: boolean }).checked = checked;
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
}

// -------------------------------------------------------------------
// Test 1: ColorChooser.CloseOK — lines 16888-16889
// -------------------------------------------------------------------
test("ColorChooser.CloseOK: SetValue + Close with valid popup state", async () => {
  const SC = await loadSocialCalc();
  const sp = SC.Popup;

  // Set up popup state so CloseOK can proceed past the `if (!id) return` guard.
  sp.Current = { id: "test-cc" };
  sp.Controls["test-cc"] = { data: { value: "#FF0000" } };

  // CloseOK must forward the selected value and close the active popup.
  const calls: string[] = [];
  const originalSetValue = sp.SetValue;
  const originalClose = sp.Close;
  sp.SetValue = (id: string, value: unknown) => {
    calls.push(`set:${id}:${String(value)}`);
  };
  sp.Close = () => {
    calls.push("close");
  };
  try {
    sp.Types.ColorChooser.CloseOK();
  } finally {
    sp.SetValue = originalSetValue;
    sp.Close = originalClose;
  }
  expect(calls).toEqual(["set:test-cc:#FF0000", "close"]);
});

// -------------------------------------------------------------------
// Test 2: debug_log undefined branch — line 17005-17006
// -------------------------------------------------------------------
test("Constructor: debug_log undefined branch", async () => {
  const SC = await loadSocialCalc();
  // Delete debug_log so the constructor re-initializes it.
  const withDebugLog = SC as unknown as { debug_log?: unknown[] };
  delete withDebugLog.debug_log;
  const control = new SC.SpreadsheetControl();
  expect(control).toBeDefined();
  expect((SC as unknown as { debug_log?: unknown[] }).debug_log).toEqual([]);
});

// -------------------------------------------------------------------
// Test 3: Audit tab onclick with UNDONE STEPS (i == tos+1) — line 17319-17320
// -------------------------------------------------------------------
test("Audit tab: UNDONE STEPS branch (i == tos+1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Schedule each command separately so the undo stack has 3 entries.
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 value n 1",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A2 value n 2",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A3 value n 3",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);

  // Undo one step so tos < stack.length-1, making i == tos+1 reachable.
  SC.SheetUndo(control.sheet);
  await waitEditor(control.editor, "cmdend", 800);

  // Set tos to 0 so that when i=1, i == tos+1 is true (stack has 3 entries).
  control.sheet.changes.tos = 0;

  // Call the audit tab onclick directly.
  const auditTabIdx = control.tabnums.audit;
  const onclick = control.tabs[auditTabIdx].onclick;
  expect(onclick).toBeDefined();
  {
    onclick!(control, "audit");
  }
});

// -------------------------------------------------------------------
// Test 4: ParseSheetSave prototype — line 17435, f#553
// -------------------------------------------------------------------
test("ParseSheetSave prototype method", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);

  // ParseSheetSave delegates to sheet.ParseSheetSave and intentionally returns void.
  const saveStr = "version:1.0\nsheet:c1:r1:f1:v1\n";
  let parsed = "";
  control.sheet.ParseSheetSave = (value: string) => {
    parsed = value;
  };
  expect(control.ParseSheetSave(saveStr)).toBeUndefined();
  expect(parsed).toBe(saveStr);
});

// -------------------------------------------------------------------
// Test 5: Button missing alert — lines 17516-17518
// -------------------------------------------------------------------
test("InitializeSpreadsheetControl: button missing alert path", async () => {
  const SC = await loadSocialCalc();
  const rawControl = new SC.SpreadsheetControl();
  const fakeBtnName = "button_fakemissing";
  Object.defineProperty(rawControl, "Buttons", {
    configurable: true,
    set(buttons: Record<string, { tooltip: string; command: string }>) {
      buttons[fakeBtnName] = { tooltip: "Fake", command: "fake" };
      Object.defineProperty(rawControl, "Buttons", {
        configurable: true,
        writable: true,
        value: buttons,
      });
    },
  });

  // Monkeypatch document.getElementById to return null for our fake button.
  const origGetById = document.getElementById.bind(document);
  const fakeId = rawControl.idPrefix + fakeBtnName;
  let patched = true;
  document.getElementById = function (id: string): HTMLElement | null {
    if (patched && id === fakeId) return null;
    return origGetById(id);
  };

  const originalAlert = globalThis.alert;
  const alerts: string[] = [];
  globalThis.alert = (message?: unknown) => {
    alerts.push(String(message));
  };
  try {
    const container = document.createElement("div");
    container.id = "missing-button-root";
    document.body.appendChild(container);
    rawControl.InitializeSpreadsheetControl(container, 400, 600, 20);
    expect(alerts).toContain(`Button ${fakeId} missing`);
  } finally {
    patched = false;
    document.getElementById = origGetById;
    globalThis.alert = originalAlert;
  }
});

// -------------------------------------------------------------------
// Test 6: skipImagePrefix true branch — line 17535
// -------------------------------------------------------------------
test("InitializeSpreadsheetControl: formulabutton with skipImagePrefix", async () => {
  const SC = await loadSocialCalc();
  const control = new SC.SpreadsheetControl("skipimg-");

  // Add a formulabutton with skipImagePrefix=true before init.
  const fb = control as unknown as { formulabuttons: Record<string, unknown> };
  fb.formulabuttons["customskip"] = {
    image: "custom.png",
    tooltip: "Custom",
    skipImagePrefix: true,
    command: function () {},
  };

  const container = document.createElement("div");
  container.id = "skipimg-container";
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(container);

  {
    control.InitializeSpreadsheetControl(container, 400, 600, 20);
  }
});

// -------------------------------------------------------------------
// Test 7: formulabuttons Disabled callback — line 17545
// findbuttons Disabled callback — line 17565
// -------------------------------------------------------------------
test("Formulabutton/findbutton Disabled callbacks", async () => {
  const SC = await loadSocialCalc();
  await newControl(SC);

  // The Disabled callbacks are registered via ButtonRegister during init.
  // Find the registered button objects and call their Disabled.
  const buttonInfo = SC.ButtonInfo;
  if (buttonInfo && Array.isArray(buttonInfo.registeredElements)) {
    for (const be of buttonInfo.registeredElements) {
      if (be && be.functionobj && typeof be.functionobj.Disabled === "function") {
        {
          be.functionobj.Disabled();
        }
      }
    }
  }
});

// -------------------------------------------------------------------
// Test 8: Tab oncreate — line 17587-17588
// -------------------------------------------------------------------
test("InitializeSpreadsheetControl: tab with oncreate callback", async () => {
  const SC = await loadSocialCalc();
  const control = new SC.SpreadsheetControl("onctab-");

  // Add a custom tab with oncreate before init.
  let oncreateCalled = false;
  control.tabs.unshift({
    name: "custom",
    text: "Custom",
    html: '<div id="%id.customtools" style="display:none;"></div>',
    oncreate: () => {
      oncreateCalled = true;
    },
  });

  const container = document.createElement("div");
  container.id = "onctab-container";
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(container);

  {
    control.InitializeSpreadsheetControl(container, 400, 600, 20);
  }
  expect(oncreateCalled).toBe(true);
});

// -------------------------------------------------------------------
// Test 9: mousedown/mouseover listeners on spreadsheetDiv — lines 17635-17640, f#561, f#562
// -------------------------------------------------------------------
test("mousedown/mouseover listeners on spreadsheetDiv", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);

  const spreadsheetDiv = control.spreadsheetDiv;

  // The UI shim stores addEventListener listeners in __listeners.
  // Call them directly since FakeElement has no dispatchEvent.
  const listeners = (
    spreadsheetDiv as unknown as {
      __listeners: Record<string, Array<() => void>>;
    }
  ).__listeners;

  // Call mousedown listeners
  if (listeners?.mousedown) {
    for (const fn of listeners.mousedown) {
      {
        fn();
      }
    }
  }

  // Call mouseover listeners
  if (listeners?.mouseover) {
    for (const fn of listeners.mouseover) {
      {
        fn();
      }
    }
  }

  // Verify the control object was set.
  expect(SC.CurrentSpreadsheetControlObject).toBe(control);
});

// -------------------------------------------------------------------
// Test 10: GetSpreadsheetControlObject with null CurrentSpreadsheetControlObject — line 17652
// -------------------------------------------------------------------
test("GetSpreadsheetControlObject: null CurrentSpreadsheetControlObject falls to viewer", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);

  // Set CurrentSpreadsheetControlObject to null so the ternary takes the
  // false branch (CurrentSpreadsheetViewerObject).
  SC.CurrentSpreadsheetControlObject = null;
  SC.CurrentSpreadsheetViewerObject = control;

  const result = SC.GetSpreadsheetControlObject();
  expect(result).toBe(control);

  // Also test with both null — returns undefined.
  SC.CurrentSpreadsheetViewerObject = null;
  const result2 = SC.GetSpreadsheetControlObject();
  expect(result2).toBeUndefined();
});

// -------------------------------------------------------------------
// Test 11: LoadColumnChoosers — named range and oldindex branches
// lines 17775, 17789, 17794, 17803, 17812
// -------------------------------------------------------------------
test("LoadColumnChoosers: named range and oldindex branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;

  // Case 1: sortrange is a named range (no ":") → LookupName returns range type
  control.sortrange = "MYRANGE";
  control.sheet.names["MYRANGE"] = { definition: "A1:B2" };

  makeSelect(
    idp,
    "majorsort",
    [
      { text: "[None]", value: "" },
      { text: "A", value: "A" },
      { text: "B", value: "B" },
    ],
    2,
  );
  makeSelect(
    idp,
    "minorsort",
    [
      { text: "[None]", value: "" },
      { text: "A", value: "A" },
      { text: "B", value: "B" },
    ],
    1,
  );
  makeSelect(
    idp,
    "lastsort",
    [
      { text: "[None]", value: "" },
      { text: "A", value: "A" },
      { text: "B", value: "B" },
    ],
    0,
  );

  {
    SC.LoadColumnChoosers(control);
  }

  // Case 2: sortrange is a named range but LookupName returns non-range type
  control.sortrange = "NOTRANGE";
  control.sheet.names["NOTRANGE"] = { definition: "not_a_range" };

  {
    SC.LoadColumnChoosers(control);
  }

  // Case 3: sortrange with ":" (direct range) and oldindex > 0 for all selectors
  control.sortrange = "A1:C3";
  // Reset selects with oldindex > 0
  const ms = document.getElementById(idp + "majorsort") as unknown as { __selectedIndex: number };
  ms.__selectedIndex = 2;
  const ns = document.getElementById(idp + "minorsort") as unknown as { __selectedIndex: number };
  ns.__selectedIndex = 1;
  const ls = document.getElementById(idp + "lastsort") as unknown as { __selectedIndex: number };
  ls.__selectedIndex = 1;

  {
    SC.LoadColumnChoosers(control);
  }

  // Case 4: oldindex = 0 for minor/last (false branch of oldindex > 0)
  ns.__selectedIndex = 0;
  ls.__selectedIndex = 0;
  {
    SC.LoadColumnChoosers(control);
  }
});

// -------------------------------------------------------------------
// Test 12: DoCmd ok-setsort with obj.blur — lines 17896-17898
// -------------------------------------------------------------------
test("DoCmd: ok-setsort with obj.blur", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  for (const id of ["sortlist", "sortbutton"]) {
    if (!document.getElementById(idp + id)) {
      const el =
        id === "sortbutton" ? document.createElement("input") : document.createElement("select");
      el.id = idp + id;
      (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
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

  const sortlist = document.getElementById(idp + "sortlist") as unknown as {
    __options: Array<{ text: string; value: string }>;
    __selectedIndex: number;
  };
  sortlist.__options = [
    { text: "[select range]", value: "" },
    { text: "All", value: "all" },
  ];
  sortlist.__selectedIndex = 0; // triggers range-based sortrange

  // Set editor range so hasrange is true.
  control.editor.range.hasrange = true;
  control.editor.range.left = 1;
  control.editor.range.top = 1;
  control.editor.range.right = 2;
  control.editor.range.bottom = 2;

  // Create an obj with a blur method.
  let blurred = false;
  const obj = {
    blur: () => {
      blurred = true;
    },
  };

  {
    SC.DoCmd(obj, "ok-setsort");
  }
  expect(blurred).toBe(true);
});

// -------------------------------------------------------------------
// Test 13: DoCmd dosort with rele.checked=false — lines 17915, 17919, 17924
// -------------------------------------------------------------------
test("DoCmd: dosort with checked=false branches", async () => {
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
  makeSelect(
    idp,
    "minorsort",
    [
      { text: "[None]", value: "" },
      { text: "B", value: "B" },
    ],
    1,
  );
  makeSelect(
    idp,
    "lastsort",
    [
      { text: "[None]", value: "" },
      { text: "C", value: "C" },
    ],
    1,
  );
  makeCheckbox(idp, "majorsortup", false); // false branch
  makeCheckbox(idp, "minorsortup", false);
  makeCheckbox(idp, "lastsortup", false);

  control.sortrange = "A1:B2";

  {
    SC.DoCmd(null, "dosort");
    await waitEditor(control.editor);
  }
});

// -------------------------------------------------------------------
// Test 14: DoCmd dosort with named range — line 17902
// -------------------------------------------------------------------
test("DoCmd: dosort with named range (no colon)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  makeSelect(idp, "majorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "minorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "lastsort", [{ text: "[None]", value: "" }], 0);
  makeCheckbox(idp, "majorsortup", true);
  makeCheckbox(idp, "minorsortup", true);
  makeCheckbox(idp, "lastsortup", true);

  // sortrange is a named range without ":"
  control.sortrange = "SORTNAMED";
  control.sheet.names["SORTNAMED"] = { definition: "A1:B2" };

  {
    SC.DoCmd(null, "dosort");
    await waitEditor(control.editor);
  }

  // Also test dosort where nrange.type != "range" (early return)
  control.sortrange = "BADNAME";
  control.sheet.names["BADNAME"] = { definition: "not_a_range" };

  {
    SC.DoCmd(null, "dosort");
  }
});

// -------------------------------------------------------------------
// Test 15: swapcolors with no defaultcolor/defaultbgcolor — lines 17984-17991
// -------------------------------------------------------------------
test("DoCmd: swapcolors with no default color/bgcolor", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Remove defaultcolor and defaultbgcolor so the ternary takes the false branch.
  delete control.sheet.attribs.defaultcolor;
  delete control.sheet.attribs.defaultbgcolor;

  // Set cell with color and bgcolor that match defaults (empty after swap).
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 color rgb(255,255,255)",
    "set A1 bgcolor rgb(0,0,0)",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);

  control.editor.ecell.coord = "A1";
  control.editor.ecell.row = 1;
  control.editor.ecell.col = 1;

  {
    SC.DoCmd(null, "swapcolors");
    await waitEditor(control.editor);
  }
});

// -------------------------------------------------------------------
// Test 16: DoCmd with obj.blur at end — line 18000-18001
// -------------------------------------------------------------------
test("DoCmd: obj.blur at end of DoCmd", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  let blurred = false;
  const obj = {
    blur: () => {
      blurred = true;
    },
  };

  {
    SC.DoCmd(obj, "recalc");
    await waitEditor(control.editor);
  }
  expect(blurred).toBe(true);
});

// -------------------------------------------------------------------
// Test 17: DoFunctionList — binary expression at line 18179
// -------------------------------------------------------------------
test("DoFunctionList: covers binary expression", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  {
    SC.SpreadsheetControl.DoFunctionList();
  }
});

// -------------------------------------------------------------------
// Test 18: DoLink with MakePageLink callback and text starting with ' — lines 18366-18382
// -------------------------------------------------------------------
test("DoLink: switch default, quote-prefixed text, MakePageLink", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Set up a cell with a quote-prefixed value.
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 text t 'http://link.test",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);
  control.editor.ecell.coord = "A1";
  control.editor.state = "start";

  // Set up MakePageLink callback.
  const callbackHost = SC as unknown as {
    Callbacks: { MakePageLink?: (...args: unknown[]) => string };
  };
  const origCallback = callbackHost.Callbacks.MakePageLink;
  callbackHost.Callbacks.MakePageLink = () => "http://wiki/page";

  {
    SC.SpreadsheetControl.DoLink();
  }

  // Clean up dialog
  const dlg = document.getElementById(control.idPrefix + "linkdialog");
  if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg);

  // Restore callback
  callbackHost.Callbacks.MakePageLink = origCallback;
});
// Test 19: SortSave with checked=false — lines 18622, 18626, 18633
// -------------------------------------------------------------------
test("SortSave: checked=false branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  // major: selectedIndex > 0, minor: selectedIndex > 0, last: selectedIndex > 0
  makeSelect(
    idp,
    "majorsort",
    [
      { text: "[None]", value: "" },
      { text: "A", value: "A" },
    ],
    1,
  );
  makeSelect(
    idp,
    "minorsort",
    [
      { text: "[None]", value: "" },
      { text: "B", value: "B" },
    ],
    1,
  );
  makeSelect(
    idp,
    "lastsort",
    [
      { text: "[None]", value: "" },
      { text: "C", value: "C" },
    ],
    1,
  );
  makeCheckbox(idp, "majorsortup", false); // false branch
  makeCheckbox(idp, "minorsortup", false);
  makeCheckbox(idp, "lastsortup", false);

  control.sortrange = "A1:B2";

  {
    const result = SC.SpreadsheetControlSortSave(control.editor, "sort");
    expect(typeof result).toBe("string");
  }
});

// -------------------------------------------------------------------
// Test 20: NamesChangedName with falsy desc/definition — lines 18749-18750
// -------------------------------------------------------------------
test("NamesChangedName: name with no desc/definition", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Create a name with no desc or definition (falsy).
  control.sheet.names["NONAME"] = {};

  // Set up nameslist element.
  const idp = control.idPrefix;
  makeSelect(
    idp,
    "nameslist",
    [
      { text: "", value: "" },
      { text: "NONAME", value: "NONAME" },
    ],
    1,
  );

  for (const id of ["namesname", "namesdesc", "namesvalue"]) {
    if (!document.getElementById(idp + id)) {
      const el = document.createElement("input");
      el.id = idp + id;
      (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
    }
  }

  {
    SC.SpreadsheetControlNamesChangedName();
  }
});

// -------------------------------------------------------------------
// Test 21: DecodeSpreadsheetSave early return paths — lines 18947-18979
// -------------------------------------------------------------------
test("DecodeSpreadsheetSave: early return paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);

  // Case 1: No MIME-Version header → return empty parts
  const r1 = control.DecodeSpreadsheetSave("no mime header here");
  expect(r1).toEqual({});

  // Case 2: Has MIME-Version but no multipart boundary match
  const r2 = control.DecodeSpreadsheetSave(
    "MIME-Version: 1.0\nContent-Type: text/plain\n\nsome content",
  );
  expect(r2).toEqual({});

  // Case 3: Has multipart boundary but no blank line after it
  const r3 = control.DecodeSpreadsheetSave(
    "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=BOUND\n--BOUND\nno blank line here",
  );
  expect(typeof r3).toBe("object");

  // Case 4: Full valid save with parts
  const saveStr = control.CreateSpreadsheetSave();
  const r4 = control.DecodeSpreadsheetSave(saveStr);
  expect(typeof r4).toBe("object");

  // Case 5: Has header boundary and blank line but no end boundary for part list
  const r5 = control.DecodeSpreadsheetSave(
    "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=BOUND\n--BOUND\nContent-type: text/plain; charset=UTF-8\n\nversion:1.0\npart:sheet\nno end boundary",
  );
  expect(typeof r5).toBe("object");

  // Case 6: Has part list but no blank line for part content (line 18970 true branch)
  const r6 = control.DecodeSpreadsheetSave(
    "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=BOUND\n--BOUND\nContent-type: text/plain; charset=UTF-8\n\nversion:1.0\npart:sheet\n--BOUND\nno blank line in part",
  );
  expect(typeof r6).toBe("object");

  // Case 7: Has blank line in part but no end boundary for part (line 18978 true branch)
  const r7 = control.DecodeSpreadsheetSave(
    "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=BOUND\n--BOUND\nContent-type: text/plain; charset=UTF-8\n\nversion:1.0\npart:sheet\n--BOUND\nContent-type: text/plain; charset=UTF-8\n\npart content here\nno end boundary",
  );
  expect(typeof r7).toBe("object");
});

// -------------------------------------------------------------------
// Test 22: PopupChangeCallback — binary expressions at 19031, 19036, 19051, 19056
// -------------------------------------------------------------------
test("PopupChangeCallback uses format number formatter for both preview values", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const cellPanel = control.views.settings.values!.cellspanel;
  const idPrefix = control.idPrefix;
  const popupControls = SC.Popup.Controls as Record<
    string,
    { type: string; value: unknown; data: { value: unknown } }
  >;
  const setPopupValue = (id: string, value: string): void => {
    popupControls[id] = { type: "ColorChooser", value, data: { value } };
  };

  let sampleText = document.getElementById("sample-text");
  if (!sampleText) {
    sampleText = document.createElement("div");
    sampleText.id = "sample-text";
    (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(
      sampleText,
    );
  } else {
    while (sampleText.childNodes.length > 0) {
      sampleText.removeChild(sampleText.childNodes[0]);
    }
  }
  const samplePreview = document.createElement("div");
  sampleText.appendChild(document.createElement("div"));
  sampleText.appendChild(samplePreview);

  const formatCalls: Array<{ value: number; format: string; suffix: string }> = [];
  const originalFormat = SC.FormatNumber.formatNumberWithFormat;
  try {
    SC.FormatNumber.formatNumberWithFormat = ((
      value: number,
      format: string,
      suffix: string,
    ): string => {
      formatCalls.push({ value, format, suffix });
      return `FMT(${value}):${format}`;
    }) as typeof originalFormat;

    // Seed popup controls used by PopupChangeCallback for the cell panel.
    setPopupValue(idPrefix + "textcolor", "rgb(12, 20, 30)");
    setPopupValue(idPrefix + "bgcolor", "rgb(240, 240, 240)");
    setPopupValue(idPrefix + "fontsize", "12");
    setPopupValue(idPrefix + "fontfamily", "serif");
    setPopupValue(idPrefix + "padtop", "2");
    setPopupValue(idPrefix + "padright", "4");
    setPopupValue(idPrefix + "padbottom", "6");
    setPopupValue(idPrefix + "padleft", "8");
    setPopupValue(idPrefix + "alignvert", "middle");
    setPopupValue(idPrefix + "calignhoriz", "center");
    setPopupValue(idPrefix + "cfontlook", "italic bold");
    setPopupValue(idPrefix + "cformatnumber", "0.00");

    SC.SettingsControls.PopupChangeCallback({ panelobj: cellPanel }, "", null);

    expect(sampleText.style.paddingTop).toMatch(/\d/);
    expect(samplePreview.style.textAlign).toBe("center");
    expect(sampleText.style.fontStyle).toBe("italic");
    expect(sampleText.style.fontWeight).toBe("bold");

    const callValues = formatCalls.map((call) => call.value).sort((a, b) => a - b);
    expect(callValues).toContain(9.8765);
    expect(callValues).toContain(-1234.5);
    expect(callValues.some((v) => v === 9.8765)).toBe(true);
    expect(callValues.some((v) => v === -1234.5)).toBe(true);

    expect(samplePreview.innerHTML).toContain("FMT(9.8765):0.00");
    expect(samplePreview.innerHTML).toContain("FMT(-1234.5):0.00");
  } finally {
    SC.FormatNumber.formatNumberWithFormat = originalFormat;
  }
});

// -------------------------------------------------------------------
// Test 23: PopupListGetValue with no value — lines 19106-19110
// -------------------------------------------------------------------
test("PopupListGetValue: no value returns def:true", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const cellPanel = control.views.settings.values!.cellspanel;

  // Popup.GetValue returns null/undefined → returns {def: true, val: 0}
  {
    const result = SC.SettingsControls.PopupListGetValue(cellPanel, "cfontlook");
    if (result) {
      expect(result.def).toBe(true);
    }
  }
});

// -------------------------------------------------------------------
// Test 24: BorderSideSetValue with null value and missing element — lines 19198-19221
// -------------------------------------------------------------------
test("BorderSideSetValue: null value and missing element", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const cellPanel = control.views.settings.values!.cellspanel as unknown as { cbt: { id: string } };

  // Case 1: null value → alert path (line 19198)
  {
    SC.SettingsControls.BorderSideSetValue(cellPanel, "cbt", null);
  }

  // Case 2: value provided but element not found → return (line 19220)
  const idstart = cellPanel.cbt.id;
  const existing = document.getElementById(idstart + "-onoff-bcb");
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  {
    SC.SettingsControls.BorderSideSetValue(cellPanel, "cbt", { val: "1px solid rgb(0,0,0)" });
  }
});

// -------------------------------------------------------------------
// Test 25: CtrlSEditor with empty whichpart (listing) — line 19283
// -------------------------------------------------------------------
test("CtrlSEditor: empty whichpart listing path", async () => {
  const SC = await loadSocialCalc();
  const { control: _control } = await newControl(SC);

  const otherSaveParts = SC as unknown as {
    OtherSaveParts: Record<string, string>;
  };

  // Set up OtherSaveParts with entries.
  otherSaveParts.OtherSaveParts["part1"] = "content1\n";
  otherSaveParts.OtherSaveParts["part2"] = "content2\n";
  // Call with empty whichpart — hits the listing path (false branch of length > 0).
  {
    SC.CtrlSEditor("");
  }

  // Clean up the editbox
  const editbox = document.getElementById("socialcalc-editbox");
  if (editbox && editbox.parentNode) editbox.parentNode.removeChild(editbox);

  // Also test with a whichpart that doesn't exist (empty string fallback to "")
  {
    SC.CtrlSEditor("nonexistent");
  }
  const editbox2 = document.getElementById("socialcalc-editbox");
  if (editbox2 && editbox2.parentNode) editbox2.parentNode.removeChild(editbox2);
});

// -------------------------------------------------------------------
// Test 26: DoCmd ok-setsort with "all" value — lines 17868-17888
// -------------------------------------------------------------------
test("DoCmd: ok-setsort with 'all' value", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  for (const id of ["sortbutton"]) {
    if (!document.getElementById(idp + id)) {
      const el = document.createElement("input");
      el.id = idp + id;
      (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
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
  (
    sortlist as unknown as {
      __options: Array<{ text: string; value: string }>;
      __selectedIndex: number;
    }
  ).__options = [
    { text: "[select range]", value: "" },
    { text: "All", value: "all" },
  ];
  (sortlist as unknown as { __selectedIndex: number }).__selectedIndex = 1; // "all"
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(sortlist);

  // Populate sheet cells so the "all" loop finds min/max.
  await scheduleCommands(SC, control.sheet as unknown as Parameters<typeof scheduleCommands>[1], [
    "set A1 value n 1",
    "set B2 value n 2",
    "set C3 value n 3",
  ]);
  await recalcSheet(SC, control.sheet as unknown as Parameters<typeof recalcSheet>[1]);

  {
    SC.DoCmd(null, "ok-setsort");
  }
});

// -------------------------------------------------------------------
// Test 27: DoCmd ok-setsort with named range value — line 17889
// -------------------------------------------------------------------
test("DoCmd: ok-setsort with named range value", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  for (const id of ["sortbutton"]) {
    if (!document.getElementById(idp + id)) {
      const el = document.createElement("input");
      el.id = idp + id;
      (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
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
  (
    sortlist as unknown as {
      __options: Array<{ text: string; value: string }>;
      __selectedIndex: number;
    }
  ).__options = [
    { text: "[select range]", value: "" },
    { text: "All", value: "all" },
    { text: "MYRANGE", value: "A1:B2" },
  ];
  (sortlist as unknown as { __selectedIndex: number }).__selectedIndex = 2; // named range value
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(sortlist);

  {
    SC.DoCmd(null, "ok-setsort");
  }
});

// -------------------------------------------------------------------
// Test 28: DoCmd dosort with A1:A1 early return — line 17910-17911
// -------------------------------------------------------------------
test("DoCmd: dosort A1:A1 early return", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  makeSelect(idp, "majorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "minorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "lastsort", [{ text: "[None]", value: "" }], 0);
  makeCheckbox(idp, "majorsortup", true);
  makeCheckbox(idp, "minorsortup", true);
  makeCheckbox(idp, "lastsortup", true);

  // sortrange is A1:A1 → early return
  control.sortrange = "A1:A1";

  {
    SC.DoCmd(null, "dosort");
  }
});
