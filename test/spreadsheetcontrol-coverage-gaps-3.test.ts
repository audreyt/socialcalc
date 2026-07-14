import { afterEach, beforeEach, expect, test } from "vite-plus/test";

import {
  loadSocialCalc as _loadSocialCalc,
  recalcSheet,
  scheduleCommands,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import { ensureTrackedTimers, cancelActiveTrackedTimers } from "./helpers/timer-tracking";

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
    {
      clearInterval(id as ReturnType<typeof setInterval>);
    }
  }
  __liveIntervals.clear();
  {
    const SC = (globalThis as unknown as { SocialCalc?: unknown }).SocialCalc;
    if (SC && typeof SC === "object" && "Keyboard" in SC) {
      const kbd = SC as unknown as { Keyboard: { focusTable: unknown } };
      kbd.Keyboard.focusTable = null;
    }
  }
  cancelActiveTrackedTimers();
});

beforeEach(() => {
  __liveIntervals.clear();
});

ensureTrackedTimers();

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
    state: string;
    busy: boolean;
    ECellReadonly: () => boolean;
    UpdateCellCSS: (cell: unknown, row: number, col: number) => void;
    StatusCallback: Record<string, { func: (e: unknown, s: string) => void; params: unknown }>;
  };
  tabs: Array<{
    name: string;
    text: string;
    html: string;
    onclick?: (s: unknown, t: string) => void;
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
  sortrange: string;
  ExecuteCommand: (combo: string, sstr: string) => void;
  InitializeSpreadsheetControl: (node: Node | string, h?: number, w?: number, s?: number) => void;
};

type SC = {
  SpreadsheetControl: new (id?: string) => Control;
  SetSpreadsheetControlObject: (c: unknown) => void;
  GetSpreadsheetControlObject: () => Control | undefined;
  CurrentSpreadsheetControlObject: Control | undefined;
  Keyboard: { focusTable: unknown };
  LoadColumnChoosers: (s: unknown) => void;
  DoCmd: (obj: unknown, which: string) => void;
  GetEditorCellElement: (
    editor: unknown,
    row: number,
    col: number,
  ) => { element: { title?: string }; rowpane: number; colpane: number } | null;
  SpreadsheetControlCommentSet: () => void;
  KeyboardFocus: () => void;
  ScheduleSheetCommands: (s: unknown, cmd: string, saveundo: boolean) => void;
  Popup: {
    Controls: Record<string, { type: string; value: unknown; data: { value: unknown } }>;
    GetValue: (id: string) => unknown;
  };
  FormatNumber: {
    formatNumberWithFormat: (v: number, fmt: string, cur: string) => string;
  };
  SettingsControls: {
    PopupChangeCallback: (a: unknown, i: string, v: unknown) => void;
    PopupListInitialize: (p: unknown, c: string) => void;
    Controls: Record<string, { InitialData?: string }>;
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
  container.id = "ctrl3-root-" + containerSeq++;
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(container);
  const control = new SC.SpreadsheetControl(idPrefix);
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

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

function makeCheckbox(idp: string, id: string, checked: boolean): void {
  const el = document.createElement("input");
  el.id = idp + id;
  const inner = el as unknown as { checked: boolean };
  inner.checked = checked;
  const body = document as unknown as { body: { appendChild: (n: Node) => void } };
  body.body.appendChild(el);
}

// -------------------------------------------------------------------
// Test 1: InitializeSpreadsheetControl with view oncreate (L17621 branch 1)
// The settings view has an oncreate callback. When InitializeSpreadsheetControl
// iterates views, the audit/clipboard views (no oncreate) hit the false branch.
// -------------------------------------------------------------------

test("Init: view without oncreate hits false branch during iteration (L17621)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  // The init iterates over views. Audit and clipboard have no oncreate
  // → false branch (branch 1) is hit. Settings has oncreate → true branch.
  // Verify the control initialized properly.
  expect(control.tabs.length).toBeGreaterThan(0);
});

// -------------------------------------------------------------------
// Test 2: LoadColumnChoosers with named range sortrange (L17771 branch 1)
// When sortrange is a named range (no ":"), LookupName is called to resolve it.
// -------------------------------------------------------------------

test("LoadColumnChoosers: sortrange is named range resolves via LookupName (L17771)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Define a named range
  await scheduleCommands(
    SC as unknown as Parameters<typeof scheduleCommands>[0],
    control.sheet as unknown as Parameters<typeof scheduleCommands>[1],
    "name define MYSORT A1:A3",
  );
  await recalcSheet(
    SC as unknown as Parameters<typeof recalcSheet>[0],
    control.sheet as unknown as Parameters<typeof recalcSheet>[1],
  );

  // Set sortrange to the name (no ":")
  control.sortrange = "MYSORT";

  // Create the sort select elements
  const idp = control.idPrefix;
  makeSelect(idp, "majorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "minorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "lastsort", [{ text: "[None]", value: "" }], 0);

  SC.LoadColumnChoosers(control);

  // MYSORT = A1:A3 spans only column A, so majorsort/minorsort/lastsort
  // should each get exactly 2 options: "[None]" + column "A".
  const majorsort = document.getElementById(idp + "majorsort") as unknown as {
    options: Array<{ text: string; value: string }>;
  };
  expect(majorsort.options.length).toBe(2);
  expect(majorsort.options[1].value).toBe("A");
});

// -------------------------------------------------------------------
// Test 3: ok-setsort 'all' with cells in increasing rows (L17875 branch 1)
// When iterating cells, cr.row > max_row triggers the true branch.
// -------------------------------------------------------------------

test("DoCmd: ok-setsort 'all' with multiple rows (L17875 branch 1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  // sortbutton
  if (!document.getElementById(idp + "sortbutton")) {
    const el = document.createElement("input");
    el.id = idp + "sortbutton";
    (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
  }
  makeSelect(idp, "majorsort", [{ text: "[None]", value: "" }], 0);
  makeCheckbox(idp, "majorsortup", true);
  // LoadColumnChoosers (called at the end of ok-setsort) also touches
  // minorsort/lastsort — without these, document.getElementById returns
  // null and `.selectedIndex` throws before sortrange is ever asserted.
  makeSelect(idp, "minorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "lastsort", [{ text: "[None]", value: "" }], 0);

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
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(sortlist);

  // Put cells with increasing rows so cr.row > max_row is true
  await scheduleCommands(
    SC as unknown as Parameters<typeof scheduleCommands>[0],
    control.sheet as unknown as Parameters<typeof scheduleCommands>[1],
    ["set A1 value n 1", "set A2 value n 2", "set A5 value n 3"],
  );
  await recalcSheet(
    SC as unknown as Parameters<typeof recalcSheet>[0],
    control.sheet as unknown as Parameters<typeof recalcSheet>[1],
  );

  SC.DoCmd(null, "ok-setsort");

  // min_row=1 (A1), max_row=5 (A5), single column A → sortrange "A1:A5".
  expect(control.sortrange).toBe("A1:A5");
  const sortbutton = document.getElementById(idp + "sortbutton") as unknown as { value: string };
  expect(sortbutton.value).toBe("Sort A1:A5");
});

// -------------------------------------------------------------------
// Test 4: dosort with named range sortrange (L17898 branch 1)
// When sortrange is a named range (no ":"), LookupName resolves it to a range.
// -------------------------------------------------------------------

test("DoCmd: dosort with named range sortrange (L17898)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Define a named range
  await scheduleCommands(
    SC as unknown as Parameters<typeof scheduleCommands>[0],
    control.sheet as unknown as Parameters<typeof scheduleCommands>[1],
    "name define SORTAREA A1:B2",
  );
  await recalcSheet(
    SC as unknown as Parameters<typeof recalcSheet>[0],
    control.sheet as unknown as Parameters<typeof recalcSheet>[1],
  );

  // Set sortrange to the name (no ":")
  control.sortrange = "SORTAREA";

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
  makeCheckbox(idp, "majorsortup", false);
  // dosort also reads minorsort/lastsort selectedIndex directly (not via
  // getElementById-may-be-null guards) — without these elements existing,
  // `.selectedIndex` on a null lookup throws before ExecuteCommand runs.
  makeSelect(idp, "minorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "lastsort", [{ text: "[None]", value: "" }], 0);

  const executedCommands: string[] = [];
  control.ExecuteCommand = (combo: string) => {
    executedCommands.push(combo);
  };

  SC.DoCmd(null, "dosort");

  // SORTAREA resolves to A1:B2; majorsort selects column "A", majorsortup
  // unchecked → " down".
  expect(executedCommands).toEqual(["sort A1:B2 A down"]);
});

// -------------------------------------------------------------------
// Test 5: dosort with minorsort/lastsort checked=false (L17915, L17920 branch 1)
// The ternary `rele.checked ? " up" : " down"` — the "down" branch (checked=false).
// -------------------------------------------------------------------

test("DoCmd: dosort with minor/last sort checked=false produces 'down' (L17915, L17920)", async () => {
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
  makeCheckbox(idp, "majorsortup", false);
  makeSelect(
    idp,
    "minorsort",
    [
      { text: "[None]", value: "" },
      { text: "B", value: "B" },
    ],
    1,
  );
  // checked=false → " down" branch (branch 1)
  makeCheckbox(idp, "minorsortup", false);
  makeSelect(
    idp,
    "lastsort",
    [
      { text: "[None]", value: "" },
      { text: "C", value: "C" },
    ],
    1,
  );
  // checked=false → " down" branch (branch 1)
  makeCheckbox(idp, "lastsortup", false);

  control.sortrange = "A1:C3";

  const executedCommands: string[] = [];
  control.ExecuteCommand = (combo: string) => {
    executedCommands.push(combo);
  };

  SC.DoCmd(null, "dosort");

  expect(executedCommands).toEqual(["sort A1:C3 A down B down C down"]);
});

// -------------------------------------------------------------------
// Test 6: SpreadsheetControlCommentSet with non-readonly cell (L18692 branch 1)
// When ECellReadonly() returns falsy, the true branch fires (title set, CSS updated).
// -------------------------------------------------------------------

test("SpreadsheetControlCommentSet: non-readonly cell hits true branch (L18692)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Set ecell to A1
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };

  // Create commenttext input
  const commenttext = document.createElement("input");
  commenttext.id = control.idPrefix + "commenttext";
  (commenttext as unknown as { value: string }).value = "Test comment";
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(
    commenttext,
  );

  let cssUpdated = false;
  const origUpdateCellCSS = control.editor.UpdateCellCSS;
  control.editor.UpdateCellCSS = (cell: unknown, row: number, col: number) => {
    cssUpdated = true;
    origUpdateCellCSS.call(control.editor, cell, row, col);
  };

  try {
    SC.SpreadsheetControlCommentSet();

    const cell = SC.GetEditorCellElement(control.editor, 1, 1);
    expect(cell).not.toBe(null);
    expect(cell?.element.title).toBe("Test comment");
    expect(cssUpdated).toBe(true);
  } finally {
    control.editor.UpdateCellCSS = origUpdateCellCSS;
  }
});

// -------------------------------------------------------------------
// Test 7: PopupListInitialize with non-empty initialdata (L19106)
// The for loop `for (i = 0; i < (optionvals.length || 0); i++)` runs with
// a populated optionvals array. This covers the statement.
// -------------------------------------------------------------------

test("PopupListInitialize: processes optionvals from initialdata (L19106)", async () => {
  const SC = await loadSocialCalc();

  // Create a panelobj with a PopupList control that has initialdata
  const idp = "popup3-";
  const listEl = document.createElement("select");
  listEl.id = idp + "mylist";
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(listEl);

  const panelobj = {
    mylist: {
      id: idp + "mylist",
      type: "PopupList",
      initialdata: "None:0|Low:1|High:2",
    },
  };

  // Ensure SettingsControls.Controls has PopupList entry
  const sc = (
    SC as unknown as { SettingsControls: { Controls: Record<string, { InitialData?: string }> } }
  ).SettingsControls;
  if (!sc.Controls.PopupList) {
    sc.Controls.PopupList = { InitialData: "" } as unknown as (typeof sc.Controls)[string];
  }

  // Spy on Popup.Initialize to capture the parsed options array — the
  // actual coverage target (the optionvals loop) feeds this call.
  const popup = (
    SC as unknown as {
      Popup: {
        Initialize: (id: string, attribs: { options: Array<{ o: string; v: string }> }) => void;
      };
    }
  ).Popup;
  let capturedOptions: Array<{ o: string; v: string }> | null = null;
  const origInitialize = popup.Initialize;
  popup.Initialize = (id: string, attribs: { options: Array<{ o: string; v: string }> }) => {
    capturedOptions = attribs.options;
    return origInitialize(id, attribs);
  };

  try {
    (
      SC as unknown as {
        SettingsControls: { PopupListInitialize: (p: unknown, c: string) => void };
      }
    ).SettingsControls.PopupListInitialize(panelobj, "mylist");
    expect(capturedOptions).toEqual([
      { o: "None", v: "0" },
      { o: "Low", v: "1" },
      { o: "High", v: "2" },
    ]);
  } finally {
    popup.Initialize = origInitialize;
  }
});

// -------------------------------------------------------------------
// Test 8: PopupListInitialize with empty initialdata (L19106 branch 1)
// When initialdata is "" → optionvals = [""] → length 1 (truthy) → || 0 not used.
// Branch 1 (|| 0) is UNREACHABLE because String.split always returns an array
// with length ≥ 1, so optionvals.length is always truthy.
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Test 9: PopupChangeCallback with date format → str2 is bad-date string (L4057 branch 1)
// When formatnumber is a date format like "yyyy-mm-dd", formatting -1234.5
// produces "??-???-??&nbsp;??:??:??" (bad date from negative number), so the
// `if (str2 != ...)` condition is false and the `<br>` append is skipped.
// -------------------------------------------------------------------

test("PopupChangeCallback: date format on -1234.5 produces bad-date string (L4057 branch 1)", async () => {
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

  // Seed popup controls with a date format so -1234.5 produces the bad-date string.
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
  setPopupValue(idPrefix + "cformatnumber", "yyyy-mm-dd");

  try {
    SC.SettingsControls.PopupChangeCallback({ panelobj: cellPanel }, "", null);

    // str1 should be just the date-formatted 9.8765, WITHOUT the <br> + str2
    // because str2 == bad-date string → the if condition is false.
    expect(samplePreview.innerHTML).not.toContain("<br>");
    // str1 is the positive number formatted as a date.
    expect(samplePreview.innerHTML).toBeTruthy();
  } finally {
    if (sampleText.parentNode) sampleText.parentNode.removeChild(sampleText);
  }
});

// -------------------------------------------------------------------
// Test 10: SpreadsheetControlCommentSet with readonly cell (L3440 branch 1)
// When ECellReadonly() returns true, the if body (setting title) is skipped.
// -------------------------------------------------------------------

test("SpreadsheetControlCommentSet: readonly cell skips title update (L3440 branch 1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Set ecell to A1
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };

  // Make the cell readonly by setting readonly property on the cell.
  if (!control.sheet.cells["A1"]) {
    control.sheet.cells["A1"] = {
      readonly: true,
    } as unknown as (typeof control.sheet.cells)[string];
  } else {
    (control.sheet.cells["A1"] as unknown as { readonly: boolean }).readonly = true;
  }

  // Create commenttext input
  const commenttext = document.createElement("input");
  commenttext.id = control.idPrefix + "commenttext";
  (commenttext as unknown as { value: string }).value = "Should not be set";
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(
    commenttext,
  );

  let cssUpdated = false;
  control.editor.UpdateCellCSS = () => {
    cssUpdated = true;
  };

  try {
    SC.SpreadsheetControlCommentSet();

    // ECellReadonly returns true → if body skipped → title NOT set, CSS NOT updated.
    expect(cssUpdated).toBe(false);
    const cell = SC.GetEditorCellElement(control.editor, 1, 1);
    // Title should not be "Should not be set" (it was skipped).
    expect(cell?.element.title).not.toBe("Should not be set");
  } finally {
    // Cleanup readonly
    (control.sheet.cells["A1"] as unknown as { readonly: boolean }).readonly = false;
  }
});

// -------------------------------------------------------------------
// Test 11: DoCmd ok-setsort 'all' with cells in non-increasing rows (L1946 branch 1)
// When iterating cells in order A5, A1, A3, the first cell (A5) sets max_row=5.
// For A1 (row 1), max_row=5 and 1 > 5 is false → the `||` expression is false
// (branch 1). The sortrange ends up A1:A5 (min=1, max=5).
// -------------------------------------------------------------------

test("DoCmd: ok-setsort 'all' with non-increasing row order (L1946 branch 1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const idp = control.idPrefix;
  // sortbutton
  if (!document.getElementById(idp + "sortbutton")) {
    const el = document.createElement("input");
    el.id = idp + "sortbutton";
    (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(el);
  }
  makeSelect(idp, "majorsort", [{ text: "[None]", value: "" }], 0);
  makeCheckbox(idp, "majorsortup", true);
  makeSelect(idp, "minorsort", [{ text: "[None]", value: "" }], 0);
  makeSelect(idp, "lastsort", [{ text: "[None]", value: "" }], 0);

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
  (document as unknown as { body: { appendChild: (n: Node) => void } }).body.appendChild(sortlist);

  // Insert cells in DECREASING row order so that when iterating (A5 first),
  // the second cell (A1, row 1) has cr.row < max_row → `cr.row > max_row` is false.
  await scheduleCommands(
    SC as unknown as Parameters<typeof scheduleCommands>[0],
    control.sheet as unknown as Parameters<typeof scheduleCommands>[1],
    ["set A5 value n 5", "set A1 value n 1", "set A3 value n 3"],
  );
  await recalcSheet(
    SC as unknown as Parameters<typeof recalcSheet>[0],
    control.sheet as unknown as Parameters<typeof recalcSheet>[1],
  );

  SC.DoCmd(null, "ok-setsort");

  // min_row=1 (A1), max_row=5 (A5), single column A → sortrange "A1:A5".
  expect(control.sortrange).toBe("A1:A5");
});
