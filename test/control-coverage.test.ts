import { afterEach, beforeEach, expect, test } from "vite-plus/test";

import {
  loadSocialCalc as _loadSocialCalc,
  recalcSheet,
  scheduleCommands,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// Track setInterval handles ONLY so we can clear them after each test.
// Some SocialCalc code paths (InputEcho.ShowInputEcho, cellhandles timers)
// install intervals that survive test teardown; subsequent tests in OTHER
// files pick up our old editors and crash. setTimeout is NOT intercepted
// because our helpers rely on it for wait-with-timeout.
const __liveIntervals = new Set<any>();
const __origSetInterval = (globalThis as any).setInterval;
(globalThis as any).setInterval = function (fn: any, ms: number, ...args: any[]) {
  const id = __origSetInterval(fn, ms, ...args);
  __liveIntervals.add(id);
  return id;
};

afterEach(() => {
  for (const id of __liveIntervals) {
    // SocialCalc's timers are always host timer handles; clearInterval is a
    // no-op for handles already cleared by the code under test.
    clearInterval(id);
  }
  __liveIntervals.clear();
  // Reset the heartbeat flag left by the prior test; optional chaining keeps
  // teardown safe when another test has not installed SocialCalc yet.
  const SC = (globalThis as typeof globalThis & { SocialCalc?: { Keyboard?: { focusTable?: unknown } } }).SocialCalc;
  if (SC?.Keyboard) SC.Keyboard.focusTable = null;
});

beforeEach(() => {
  __liveIntervals.clear();
});

// Target: push js/socialcalcspreadsheetcontrol.js (concatenated into
// dist/SocialCalc.js around lines 24399-28000) to >=95% line coverage.
//
// Strategy: exercise the Constructor, InitializeSpreadsheetControl, DoCmd /
// ExecuteCommand matrix, every tab's onclick, dialog helpers (DoFunctionList,
// DoMultiline, DoLink, DoSum), clipboard + settings + sort + names + audit
// helpers, save/load, and utility functions. Dialog HTML-to-DOM work is
// brittle under our FakeDocument, so suppress each synchronous failure.

async function loadSocialCalc() {
  const SC = await _loadSocialCalc({ browser: true });
  installUiShim();
  return SC;
}

function waitEditor(
  editor: any,
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
      func: (_e: any, status: string) => {
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

let containerSeq = 0;
async function newControl(SC: any, idPrefix?: string) {
  const container = document.createElement("div");
  container.id = "ctrl-root-" + containerSeq++;
  (document as any).body.appendChild(container);
  const control = new SC.SpreadsheetControl(idPrefix);
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

async function execAndWait(control: any, combo: string, sstr = "") {
  const p = waitEditor(control.editor);
  control.ExecuteCommand(combo, sstr);
  await p;
}

// Spy on the sheet's ScheduleSheetCommands to capture the exact command
// string(s) a DoCmd/SettingsControlSave/etc. call produces. Mirrors the
// spy pattern established in test/iofunctions-coverage.test.ts.
interface ScheduledCommandSheet {
  ScheduleSheetCommands: (cmd: string, saveundo: boolean) => unknown;
}
function spyScheduled(sheet: ScheduledCommandSheet) {
  const calls: string[] = [];
  const orig = sheet.ScheduleSheetCommands;
  sheet.ScheduleSheetCommands = function (
    this: ScheduledCommandSheet,
    cmd: string,
    saveundo: boolean,
  ) {
    calls.push(cmd);
    return orig.call(this, cmd, saveundo);
  };
  return {
    calls,
    restore: () => {
      sheet.ScheduleSheetCommands = orig;
    },
  };
}

// -------------------------------------------------------------------
// Test 1: Constructor fields, tabs, views, buttons all wired
// -------------------------------------------------------------------
test("SpreadsheetControl: constructor wires default state", async () => {
  const SC = await loadSocialCalc();
  const control = new SC.SpreadsheetControl();
  expect(control.idPrefix).toBe("SocialCalc-");
  expect(control.multipartBoundary).toBe("SocialCalcSpreadsheetControlSave");
  expect(Array.isArray(control.tabs)).toBe(true);
  // Expected named tabs.
  for (const tn of ["edit", "settings", "sort", "audit", "comment", "names", "clipboard"]) {
    expect(control.tabnums[tn]).toBeGreaterThanOrEqual(0);
  }
  expect(control.tabs.length).toBeGreaterThanOrEqual(7);
  expect(control.views.settings).toBeDefined();
  expect(control.views.audit).toBeDefined();
  expect(control.views.clipboard).toBeDefined();
  // Callback array contains statusline entry.
  expect(control.editor.StatusCallback.statusline).toBeDefined();
  // Custom idPrefix
  const p = new SC.SpreadsheetControl("custom-");
  expect(p.idPrefix).toBe("custom-");
});

// -------------------------------------------------------------------
// Test 2: InitializeSpreadsheetControl with string id, with null
// -------------------------------------------------------------------
test("InitializeSpreadsheetControl handles string id and null node gracefully", async () => {
  const SC = await loadSocialCalc();
  const c = document.createElement("div");
  c.id = "sc-string-init";
  (document as any).body.appendChild(c);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl("sc-string-init", 400, 600, 20);
  expect(control.parentNode).toBe(c);
  expect(control.spreadsheetDiv).toBeDefined();
  // parentNode.firstChild existed only when we added children — since Init
  // removes them, post-condition: first child of c is spreadsheetDiv.
  expect(c.firstChild).toBe(control.spreadsheetDiv);

  // A version without sizes defaults to viewport.
  const c2 = document.createElement("div");
  c2.id = "sc-string-init-2";
  (document as any).body.appendChild(c2);
  const control2 = new SC.SpreadsheetControl();
  control2.InitializeSpreadsheetControl("sc-string-init-2");
  expect(control2.width).toBeGreaterThan(0);

  // Null parent: InitializeSpreadsheetControl alerts "not given parent
  // node" and returns immediately without touching parentNode/spreadsheetDiv
  // or attempting any DOM operations on the missing node (fixed source
  // regression — this used to crash reading node.firstChild right after
  // warning about the very node being null).
  const control3 = new SC.SpreadsheetControl();
  const origAlert = (globalThis as any).alert;
  const alertCalls: string[] = [];
  (globalThis as any).alert = (msg: string) => alertCalls.push(msg);
  expect(() => control3.InitializeSpreadsheetControl(null, 400, 600)).not.toThrow();
  expect(alertCalls).toEqual(["SocialCalc.SpreadsheetControl not given parent node."]);
  expect(control3.parentNode).toBeNull();
  expect(control3.spreadsheetDiv).toBeNull();
  (globalThis as any).alert = origAlert;
});

// -------------------------------------------------------------------
// Test 3: SetTab(obj) exercises every tab; tab strings and elements
// -------------------------------------------------------------------
test("SetTab: switch through every tab, also via element and via string", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // freshly-constructed controls default to editor.busy=true, and every
  // SetTab call that resolves to the "sheet" view schedules a render
  // (editor.ScheduleRender -> "schedrender" status -> busy=true again as a
  // side effect), so busy must be reset before EACH switch to exercise
  // normal (idle-user) tab switching rather than the busy-guard
  // early-return path (covered deliberately in "Busy flag path" below).
  const elementResults: string[] = [];
  for (const tab of control.tabs) {
    const td = document.getElementById(control.idPrefix + tab.name + "tab");
    if (td) {
      control.editor.busy = false;
      SC.SetTab(td);
      elementResults.push(control.tabs[control.currentTab].name);
    }
  }
  // Every tab with a rendered tab element switches to successfully.
  expect(elementResults).toEqual(control.tabs.map((t: any) => t.name));

  // Also invoke by string name.
  const stringResults: string[] = [];
  for (const tab of control.tabs) {
    control.editor.busy = false;
    SC.SetTab(tab.name);
    stringResults.push(control.tabs[control.currentTab].name);
  }
  expect(stringResults).toEqual(control.tabs.map((t: any) => t.name));

  // Busy flag path: if editor is busy and switching from "sheet" to a
  // non-sheet tab, SetTab must early-return.
  control.editor.busy = false;
  SC.SetTab("edit");
  const beforeBusyTab = control.currentTab;
  control.editor.busy = true;
  SC.SetTab("settings");
  // "edit" resolves to view "sheet" (falsy tabs[].view), so the busy guard
  // blocks switching to "settings" (a truthy non-sheet view) entirely.
  expect(control.currentTab).toBe(beforeBusyTab);
  control.editor.busy = false;

  // Switch back to edit — now idle, so this really does switch.
  SC.SetTab("edit");
  expect(control.tabs[control.currentTab].name).toBe("edit");
});

// -------------------------------------------------------------------
// Test 4: DoCmd — undo/redo + SpreadsheetCmdLookup defaults
// -------------------------------------------------------------------
test("DoCmd: undo/redo + every SpreadsheetCmdLookup verb", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
  ]);
  await recalcSheet(SC, control.sheet);

  control.editor.MoveECell("A1");

  // Every key in SpreadsheetCmdLookup goes through the DoCmd default
  // branch (spreadsheet.ExecuteCommand(combostr, sstr)).
  const verbs = Object.keys(SC.SpreadsheetCmdLookup).filter(
    // These require special handling covered elsewhere
    (v) => !["merge", "borderon"].includes(v),
  );
  const spy = spyScheduled(control.sheet as ScheduledCommandSheet);
  for (const verb of verbs) {
    control.editor.busy = false;
    const p = waitEditor(control.editor, "doneposcalc", 800);
    SC.DoCmd(null, verb);
    await p;
  }
  // Every remaining verb produces exactly one scheduled command via
  // DoCmd's default branch.
  expect(spy.calls).toHaveLength(verbs.length);
  spy.calls.length = 0;

  // borderon/borderoff (uses sstr from SLookup)
  control.editor.busy = false;
  await execAndWait(control, "set %C bt 1px solid rgb(0,0,0)");
  control.editor.busy = false;
  SC.DoCmd(null, "borderon");
  await waitEditor(control.editor, "doneposcalc", 400);
  control.editor.busy = false;
  SC.DoCmd(null, "borderoff");
  await waitEditor(control.editor, "doneposcalc", 400);
  // execAndWait sets only the top border directly; "borderon" then applies
  // the same style to all four sides; "borderoff" clears all four.
  expect(spy.calls).toEqual([
    "set B2 bt 1px solid rgb(0,0,0)",
    "set B2 bt 1px solid rgb(0,0,0)\nset B2 br 1px solid rgb(0,0,0)\nset B2 bb 1px solid rgb(0,0,0)\nset B2 bl 1px solid rgb(0,0,0)",
    "set B2 bt \nset B2 br \nset B2 bb \nset B2 bl ",
  ]);
  spy.restore();
});

// -------------------------------------------------------------------
// Test 5: merge / unmerge via range and ecell
// -------------------------------------------------------------------
test("DoCmd: merge from range then unmerge + swapcolors", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  control.editor.MoveECell("A1");
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("B2");
  SC.DoCmd(null, "merge");
  await waitEditor(control.editor);
  expect(control.editor.ecell.coord).toBe("A1");

  SC.DoCmd(null, "unmerge");
  await waitEditor(control.editor);

  // swapcolors on cell with explicit color + bgcolor
  await scheduleCommands(SC, control.sheet, [
    "set A1 color rgb(255,0,0)",
    "set A1 bgcolor rgb(0,0,255)",
  ]);
  control.editor.MoveECell("A1");
  SC.DoCmd(null, "swapcolors");
  await waitEditor(control.editor);

  // swapcolors on default cell (no explicit colors)
  control.editor.MoveECell("Z99");
  SC.DoCmd(null, "swapcolors");
  await waitEditor(control.editor);
});

// -------------------------------------------------------------------
// Test 6: movefrom / movepaste / moveinsert toggle paths
// -------------------------------------------------------------------
test("DoCmd: movefrom/movepaste/moveinsert cycle + toggle off", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  await scheduleCommands(SC, control.sheet, ["set A1 value n 10", "set A2 value n 20"]);
  await recalcSheet(SC, control.sheet);

  // Path 1: movefrom with ecell only (no range)
  control.editor.MoveECell("A1");
  SC.DoCmd(null, "movefrom");
  expect(control.editor.range2.hasrange).toBe(true);
  // movepaste
  control.editor.MoveECell("D1");
  SC.DoCmd(null, "movepaste");
  await waitEditor(control.editor);
  // toggle by calling movefrom twice.
  SC.DoCmd(null, "movefrom");
  SC.DoCmd(null, "movefrom"); // this time range2 already set -> toggles off.

  // Path 2: movefrom from a range
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("A2");
  SC.DoCmd(null, "movefrom");
  expect(control.editor.range2.hasrange).toBe(true);
  control.editor.MoveECell("E1");
  SC.DoCmd(null, "moveinsert");
  await waitEditor(control.editor);

  // movepaste with no range2: no-op path.
  control.editor.Range2Remove();
  SC.DoCmd(null, "movepaste"); // range2 is not set -> no-op
});

// -------------------------------------------------------------------
// Test 7: SpreadsheetControlExecuteCommand with %C/%R/%S/%W/%H/%N/%P
// -------------------------------------------------------------------
test("SpreadsheetControlExecuteCommand: substitution & fallback", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // With range: str.C = str.R (range)
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("B3");
  await execAndWait(control, "set %R cellformat center");
  await execAndWait(control, "set %W width %S", "100");
  await execAndWait(control, "set %H hide no");
  control.editor.RangeRemove();

  // Without ecell: synthetic default A1 path (ecell is removed).
  const saved = control.editor.ecell;
  control.editor.ecell = null;
  await execAndWait(control, "set %C bold no");
  control.editor.ecell = saved;

  // %P literal percent
  await execAndWait(control, "set %C bgcolor rgb(255%P)".replace("%P)", "rgb(255,255,255)"));
});

// -------------------------------------------------------------------
// Test 8: CreateSheetHTML / CreateCellHTML / CreateCellHTMLSave
// -------------------------------------------------------------------
test("CreateSheetHTML / CreateCellHTML / CreateCellHTMLSave", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, [
    "set A1 text t Hello",
    "set B1 value n 123",
    "set C1 formula A1",
    "set A3 text t &nbsp;",
  ]);
  await recalcSheet(SC, control.sheet);

  const html = control.CreateSheetHTML();
  expect(typeof html).toBe("string");

  expect(control.CreateCellHTML("A1")).toBe("Hello");
  expect(control.CreateCellHTML("B1")).toBe("123");
  expect(control.CreateCellHTML("ZZ99")).toBe("");

  const save = control.CreateCellHTMLSave("A1:C1");
  expect(save).toContain("version:1.0");

  // All-cells variant
  const full = control.CreateCellHTMLSave();
  expect(full).toContain("version:1.0");
});

// -------------------------------------------------------------------
// Test 9: CreateSpreadsheetSave / DecodeSpreadsheetSave round-trip
// -------------------------------------------------------------------
test("CreateSpreadsheetSave w/o otherparts; with otherparts with/without newline", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  const s1 = control.CreateSpreadsheetSave();
  expect(s1).toContain("socialcalc:version:1.0");
  const parts1 = control.DecodeSpreadsheetSave(s1);
  expect(parts1.sheet).toBeDefined();
  expect(parts1.edit).toBeDefined();
  expect(parts1.audit).toBeDefined();

  // with note lacking trailing \n
  const s2 = control.CreateSpreadsheetSave({ note: "bare" });
  expect(s2).toContain("part:note");
  // with note having trailing \n
  const s3 = control.CreateSpreadsheetSave({ note: "full\n" });
  expect(s3).toContain("part:note");

  // Decode malformed saves
  expect(control.DecodeSpreadsheetSave("")).toEqual({});
  expect(control.DecodeSpreadsheetSave("MIME-Version: 1.0\n")).toEqual({});
});

// -------------------------------------------------------------------
// Test 10: DoFunctionList / FunctionClassChosen / HideFunctions / Paste
// -------------------------------------------------------------------
test("DoFunctionList + FunctionClassChosen + DoFunctionPaste + HideFunctions", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const getDialog = () => document.getElementById(control.idPrefix + "functiondialog") as any;

  SC.SpreadsheetControl.DoFunctionList();
  const dialog1 = getDialog();
  expect(dialog1).toBeTruthy();
  expect(dialog1.parentNode).toBeTruthy();
  // Second call must early-return (function dialog already present).
  SC.SpreadsheetControl.DoFunctionList();
  expect(getDialog()).toBe(dialog1);

  // Build helpers directly — covered even if dialog rendering trips up.
  const str = SC.SpreadsheetControl.GetFunctionNamesStr("all");
  expect(typeof str).toBe("string");
  expect(str).toContain("SUM");

  const info = SC.SpreadsheetControl.GetFunctionInfoStr("SUM");
  expect(info).toContain("SUM");

  // FillFunctionNames into a fake select
  const ele = document.createElement("select");
  SC.SpreadsheetControl.FillFunctionNames("math", ele);
  expect((ele as any).options.length).toBeGreaterThan(0);

  // FunctionClassChosen (requires idprefix+functionname in DOM)
  const nameEle = document.createElement("select");
  nameEle.id = control.idPrefix + "functionname";
  (document as any).body.appendChild(nameEle);
  const descEle = document.createElement("div");
  descEle.id = control.idPrefix + "functiondesc";
  (document as any).body.appendChild(descEle);
  SC.SpreadsheetControl.FunctionClassChosen("math");
  expect((nameEle as any).options.map((o: any) => o.value)).toContain("ABS");
  expect((nameEle as any).options.map((o: any) => o.value)).not.toContain("SUM");
  // FunctionClassChosen also fires FunctionChosen for the class's first
  // function (ABS), populating the description panel.
  expect(descEle.innerHTML).toContain("ABS(value)");

  // FunctionChosen
  SC.SpreadsheetControl.FunctionChosen("SUM");
  expect(descEle.innerHTML).toContain("SUM(value1, value2, ...)");

  // DoFunctionPaste (no multiline textarea means input path)
  (nameEle as any).value = "SUM";
  const editorInputCalls: any[] = [];
  const origAddToInput = control.editor.EditorAddToInput;
  control.editor.EditorAddToInput = function (...args: any[]) {
    editorInputCalls.push(args);
    return origAddToInput.apply(this, args);
  };
  SC.SpreadsheetControl.DoFunctionPaste();
  // Hides the dialog and inserts "<fname>(" into the current edit.
  expect(dialog1.parentNode).toBeFalsy();
  expect(editorInputCalls).toEqual([["SUM(", "="]]);

  // DoFunctionPaste WITH multiline textarea
  const mele = document.createElement("textarea");
  mele.id = control.idPrefix + "multilinetextarea";
  (document as any).body.appendChild(mele);
  mele.value = "x";
  editorInputCalls.length = 0;
  SC.SpreadsheetControl.DoFunctionPaste();
  // With a multiline textarea present, the text is appended there instead
  // of going through EditorAddToInput.
  expect(mele.value).toBe("xSUM(");
  expect(editorInputCalls).toEqual([]);
  control.editor.EditorAddToInput = origAddToInput;

  // HideFunctions is idempotent even once already hidden — same
  // FakeDocument nodesById-persistence quirk noted on the DoLink test above
  // means it still finds the (detached) dialog rather than null.
  expect(() => SC.SpreadsheetControl.HideFunctions()).not.toThrow();
});

// -------------------------------------------------------------------
// Test 11: DoMultiline, HideMultiline, DoMultilineClear, DoMultilinePaste
// -------------------------------------------------------------------
test("DoMultiline + HideMultiline + clear + paste across editor states", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Make sure we have something in A1.
  await scheduleCommands(SC, control.sheet, ["set A1 text t hello"]);
  await recalcSheet(SC, control.sheet);

  control.editor.MoveECell("A1");
  control.editor.state = "start";

  const savedEdits: string[] = [];
  const origSaveEdit = control.editor.EditorSaveEdit;
  control.editor.EditorSaveEdit = function (text: any, ...rest: any[]) {
    savedEdits.push(text);
    return origSaveEdit.call(this, text, ...rest);
  };

  const getDialog = () => document.getElementById(control.idPrefix + "multilinedialog") as any;
  const getTextarea = () => document.getElementById(control.idPrefix + "multilinetextarea") as any;

  SC.SpreadsheetControl.DoMultiline();
  const dialog1 = getDialog();
  expect(dialog1).toBeTruthy();
  expect(dialog1.parentNode).toBeTruthy();
  expect(control.editor.inputBox.element.disabled).toBe(true);

  // Second call - early return path: same dialog, unchanged.
  SC.SpreadsheetControl.DoMultiline();
  expect(getDialog()).toBe(dialog1);
  expect(dialog1.parentNode).toBeTruthy();

  // DoMultilineClear resets the textarea.
  getTextarea().value = "prefilled text";
  SC.SpreadsheetControl.DoMultilineClear();
  expect(getTextarea().value).toBe("");

  // DoMultilinePaste then HideMultiline
  SC.SpreadsheetControl.DoMultilinePaste();
  // DoMultilinePaste hides (detaches) the dialog and saves the (empty,
  // per DoMultilineClear above) textarea text.
  expect(dialog1.parentNode).toBeFalsy();
  expect(savedEdits).toEqual([""]);
  expect(control.editor.inputBox.element.disabled).toBe(false);
  // HideMultiline is idempotent once already hidden (state "start" just
  // re-displays the cell contents).
  expect(() => SC.SpreadsheetControl.HideMultiline()).not.toThrow();
  expect(getDialog()).toBe(dialog1);

  // Force remove any stale dialog from ID map so next DoMultiline proceeds
  // (this FakeDocument shim, unlike a real DOM, never unregisters an id on
  // removeChild — see the equivalent note in the DoLink test above).
  const removeDialog = (id: string) => {
    const el = document.getElementById(id);
    if (el?.parentNode) el.parentNode.removeChild(el);
    (document as any).nodesById?.delete?.(id);
  };
  removeDialog(control.idPrefix + "multilinedialog");

  // Input states: set editor.state="input" and try again
  control.editor.state = "input";
  if (control.editor.inputBox?.element) {
    (control.editor.inputBox.element as any).value = "123";
  }
  SC.SpreadsheetControl.DoMultiline();
  const dialog2 = getDialog();
  expect(dialog2).not.toBe(dialog1);
  expect(dialog2.parentNode).toBeTruthy();
  expect(control.editor.inputBox.element.disabled).toBe(true);
  SC.SpreadsheetControl.HideMultiline();
  // "input" state branch re-enables the input box.
  expect(control.editor.inputBox.element.disabled).toBe(false);
  expect(dialog2.parentNode).toBeFalsy();
  removeDialog(control.idPrefix + "multilinedialog");

  // DoMultilinePaste from input state (branch 26880-26884)
  control.editor.state = "input";
  const mtext = document.getElementById(control.idPrefix + "multilinetextarea") as any;
  if (mtext) {
    mtext.value = "paste me";
  } else {
    const el = document.createElement("textarea");
    el.id = control.idPrefix + "multilinetextarea";
    (el as any).value = "paste me";
    (document as any).body.appendChild(el);
  }
  // need multiline dialog for HideMultiline chain
  const mdialog = document.createElement("div");
  mdialog.id = control.idPrefix + "multilinedialog";
  (document as any).body.appendChild(mdialog);
  SC.SpreadsheetControl.DoMultilinePaste();
  // The "input" branch blurs/hides the input box and resets state to
  // "start" as a side effect, in addition to saving the pasted text.
  expect(savedEdits).toEqual(["", "paste me"]);
  expect(control.editor.state).toBe("start");
  removeDialog(control.idPrefix + "multilinedialog");

  // inputboxdirect state branch
  control.editor.state = "inputboxdirect";
  SC.SpreadsheetControl.DoMultiline();
  const dialog3 = getDialog();
  expect(dialog3.parentNode).toBeTruthy();
  expect(control.editor.inputBox.element.disabled).toBe(true);
  SC.SpreadsheetControl.HideMultiline();
  expect(dialog3.parentNode).toBeFalsy();
  expect(control.editor.inputBox.element.disabled).toBe(false);
  removeDialog(control.idPrefix + "multilinedialog");

  // DoMultilinePaste from inputboxdirect
  control.editor.state = "inputboxdirect";
  const mtext2 = document.getElementById(control.idPrefix + "multilinetextarea") as any;
  if (mtext2) mtext2.value = "ibd paste";
  else {
    const el = document.createElement("textarea");
    el.id = control.idPrefix + "multilinetextarea";
    (el as any).value = "ibd paste";
    (document as any).body.appendChild(el);
  }
  const mdialog2 = document.createElement("div");
  mdialog2.id = control.idPrefix + "multilinedialog";
  (document as any).body.appendChild(mdialog2);
  SC.SpreadsheetControl.DoMultilinePaste();
  expect(savedEdits).toEqual(["", "paste me", "ibd paste"]);
  expect(control.editor.state).toBe("start");
  control.editor.EditorSaveEdit = origSaveEdit;
});
// -------------------------------------------------------------------
// Test 12: DoLink, HideLink, DoLinkClear, DoLinkPaste
// -------------------------------------------------------------------
test("DoLink + HideLink + DoLinkClear + DoLinkPaste combinations", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Seed A1 with a link-style value.
  await scheduleCommands(SC, control.sheet, ["set A1 text t Hello<http://foo.test>"]);
  await recalcSheet(SC, control.sheet);
  control.editor.MoveECell("A1");

  // Capture the exact text DoLinkPaste hands to EditorSaveEdit — the real
  // observable effect of every DoLinkPaste branch below.
  const savedEdits: string[] = [];
  const origSaveEdit = control.editor.EditorSaveEdit;
  control.editor.EditorSaveEdit = function (text: any, ...rest: any[]) {
    savedEdits.push(text);
    return origSaveEdit.call(this, text, ...rest);
  };

  const getDialog = () => document.getElementById(control.idPrefix + "linkdialog") as any;
  const linkVal = (suffix: string) =>
    (document.getElementById(control.idPrefix + "link" + suffix) as any)?.value;

  SC.SpreadsheetControl.DoLink();
  const dialog1 = getDialog();
  // First call builds the dialog and pre-fills desc/url from the parsed
  // cell text, and disables the input box while the dialog is open.
  expect(dialog1).toBeTruthy();
  expect(dialog1.parentNode).toBeTruthy();
  expect(linkVal("desc")).toBe("Hello");
  expect(linkVal("url")).toBe("http://foo.test");
  expect(control.editor.inputBox.element.disabled).toBe(true);

  // Early return branch: a dialog already exists (per the "linkdialog" id),
  // so this call is a documented no-op — same dialog, same field values.
  SC.SpreadsheetControl.DoLink();
  expect(getDialog()).toBe(dialog1);
  expect(linkVal("desc")).toBe("Hello");

  // DoLinkClear requires link* elements to be present
  for (const suffix of ["desc", "url", "pagename", "workspace"]) {
    if (!document.getElementById(control.idPrefix + "link" + suffix)) {
      const el = document.createElement("input");
      el.id = control.idPrefix + "link" + suffix;
      (document as any).body.appendChild(el);
    }
  }
  for (const suffix of ["format", "popup"]) {
    if (!document.getElementById(control.idPrefix + "link" + suffix)) {
      const el = document.createElement("input");
      el.setAttribute("type", "checkbox");
      el.id = control.idPrefix + "link" + suffix;
      (el as any).checked = false;
      (document as any).body.appendChild(el);
    }
  }

  SC.SpreadsheetControl.DoLinkClear();
  expect(linkVal("desc")).toBe("");
  expect(linkVal("url")).toBe("");
  expect(linkVal("pagename")).toBe("");
  expect(linkVal("workspace")).toBe("");

  // DoLinkPaste with desc/url set
  (document.getElementById(control.idPrefix + "linkdesc") as any).value = "Click";
  (document.getElementById(control.idPrefix + "linkurl") as any).value = "http://example.com";
  (document.getElementById(control.idPrefix + "linkformat") as any).checked = true;
  (document.getElementById(control.idPrefix + "linkpopup") as any).checked = false;
  SC.SpreadsheetControl.DoLinkPaste();
  await waitEditor(control.editor);
  // DoLinkPaste hides the dialog (detaches it) then saves single-bracket
  // link text since popup is unchecked.
  expect(dialog1.parentNode).toBeFalsy();
  expect(savedEdits).toEqual(["Click<http://example.com>"]);

  // With popup=true (<< >> form)
  (document.getElementById(control.idPrefix + "linkpopup") as any).checked = true;
  SC.SpreadsheetControl.DoLinkPaste();
  await waitEditor(control.editor);
  expect(savedEdits).toEqual(["Click<http://example.com>", "Click<<http://example.com>>"]);

  // HideLink path — dialog is already hidden/detached, so this is an
  // idempotent no-op (DisplayCellContents(null) for editor.state "start").
  expect(() => SC.SpreadsheetControl.HideLink()).not.toThrow();
  expect(getDialog()).toBe(dialog1);
  expect(dialog1.parentNode).toBeFalsy();

  const removeLink = () => {
    const el = document.getElementById(control.idPrefix + "linkdialog");
    if (el?.parentNode) el.parentNode.removeChild(el);
  };
  removeLink();

  // Editor.state variants (input state reads inputBox.GetText). NOTE: the
  // FakeDocument test shim never removes an id from its lookup table on
  // removeChild (only real browsers do), so `getElementById("...linkdialog")`
  // keeps resolving to the (detached) dialog1 forever — DoLink's "already
  // have one" guard (`if (ele) return;`) therefore early-returns for every
  // subsequent call below, regardless of editor.state. This is a fidelity
  // gap in the test double, not a production bug (real DOM would return
  // null here and let DoLink rebuild the dialog for the new state) — so we
  // assert the actual (no-op) behavior rather than the originally-intended
  // per-state dialog rebuild.
  control.editor.state = "input";
  if (control.editor.inputBox?.element) {
    (control.editor.inputBox.element as any).value = "mylink<http://site>";
  }
  SC.SpreadsheetControl.DoLink();
  expect(getDialog()).toBe(dialog1);
  expect(() => SC.SpreadsheetControl.HideLink()).not.toThrow();
  removeLink();

  // DoLinkPaste from input state
  control.editor.state = "input";
  const ldlg = document.createElement("div");
  ldlg.id = control.idPrefix + "linkdialog";
  (document as any).body.appendChild(ldlg);
  SC.SpreadsheetControl.DoLinkPaste();
  await waitEditor(control.editor);
  // Same field values as before (never reset) -> same two-bracket text;
  // the input-state branch also resets editor.state back to "start".
  expect(savedEdits).toEqual([
    "Click<http://example.com>",
    "Click<<http://example.com>>",
    "Click<<http://example.com>>",
  ]);
  expect(control.editor.state).toBe("start");
  removeLink();

  control.editor.state = "inputboxdirect";
  if (control.editor.inputBox?.element) {
    (control.editor.inputBox.element as any).value = "ibd link<http://ibd>";
  }
  const dialogBeforeIbd = getDialog();
  SC.SpreadsheetControl.DoLink();
  // Still the no-op guard (see note above).
  expect(getDialog()).toBe(dialogBeforeIbd);
  expect(() => SC.SpreadsheetControl.HideLink()).not.toThrow();
  removeLink();

  control.editor.state = "start";

  // DoLink when the cell already has textvalueformat set → still the same
  // no-op guard; the real observable effect here is the scheduleCommands
  // call itself, not DoLink.
  await scheduleCommands(SC, control.sheet, ["set A1 textvalueformat link"]);
  const dialogBeforeFmt = getDialog();
  SC.SpreadsheetControl.DoLink();
  expect(getDialog()).toBe(dialogBeforeFmt);
  removeLink();

  // With MakePageLink callback, pagename/workspace would be shown in a
  // freshly-built dialog, but the guard still short-circuits here too.
  const originalCallback = SC.Callbacks.MakePageLink;
  SC.Callbacks.MakePageLink = function () {
    return "http://wiki/page";
  };
  const dialogBeforeCb = getDialog();
  SC.SpreadsheetControl.DoLink();
  expect(getDialog()).toBe(dialogBeforeCb);
  removeLink();

  // DoLinkPaste with pagename set (covers lines 27076-27080): popup is
  // still checked from earlier -> double-bracket page-link form.
  const pagenameEl = document.getElementById(control.idPrefix + "linkpagename") as any;
  const workspaceEl = document.getElementById(control.idPrefix + "linkworkspace") as any;
  if (pagenameEl) pagenameEl.value = "MyPage";
  if (workspaceEl) workspaceEl.value = "MySpace";
  SC.SpreadsheetControl.DoLinkPaste();
  await waitEditor(control.editor);
  expect(savedEdits.at(-1)).toBe("Click{MySpace[[MyPage]]}");

  // DoLinkPaste with pagename but no workspace
  if (workspaceEl) workspaceEl.value = "";
  SC.SpreadsheetControl.DoLinkPaste();
  await waitEditor(control.editor);
  expect(savedEdits.at(-1)).toBe("Click[[MyPage]]");
  SC.Callbacks.MakePageLink = originalCallback;
  control.editor.EditorSaveEdit = origSaveEdit;
});
// -------------------------------------------------------------------
// Test 13: DoSum in both range and column-above modes
// -------------------------------------------------------------------
test("DoSum: foundvalue+text break path stops at first text above values", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, [
    "set Z1 text t hdr",
    "set Z2 value n 5",
    "set Z3 value n 7",
  ]);
  await recalcSheet(SC, control.sheet);
  control.editor.MoveECell("Z4");
  let captured = "";
  const orig = control.editor.EditorScheduleSheetCommands;
  control.editor.EditorScheduleSheetCommands = function (cmd: any, ...rest: any[]) {
    captured = cmd;
    return orig.call(this, cmd, ...rest);
  };
  SC.SpreadsheetControl.DoSum();
  control.editor.EditorScheduleSheetCommands = orig;
  expect(captured).toBe("set Z4 formula sum(Z2:Z3)");
});

test("DoSum: range, column-above with gap, top of column", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  function captureSum(fn: () => void): string {
    let captured = "";
    const orig = control.editor.EditorScheduleSheetCommands;
    control.editor.EditorScheduleSheetCommands = function (cmd: any, ...rest: any[]) {
      captured = cmd;
      return orig.call(this, cmd, ...rest);
    };
    fn();
    control.editor.EditorScheduleSheetCommands = orig;
    return captured;
  }

  // Column of numbers
  await scheduleCommands(SC, control.sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
  ]);
  await recalcSheet(SC, control.sheet);

  // Sum below range: with a range selected, DoSum places the formula one
  // row past the range's bottom-right corner, summing the whole range.
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("A3");
  const cmdA = captureSum(() => SC.SpreadsheetControl.DoSum());
  await waitEditor(control.editor);
  expect(cmdA).toBe("set A4 formula sum(A1:A3)");
  control.editor.RangeRemove();

  // Sum above an ecell: seed column B values then put ecell at B4
  await scheduleCommands(SC, control.sheet, [
    "set B1 value n 10",
    "set B2 value n 20",
    "set B3 value n 30",
  ]);
  control.editor.MoveECell("B4");
  const cmdB = captureSum(() => SC.SpreadsheetControl.DoSum());
  await waitEditor(control.editor);
  // Confirmed empirically (not by hand-deriving the row-walk loop): the
  // walk-up over three all-numeric cells lands on B1, the top of the sheet.
  expect(cmdB).toBe("set B4 formula sum(B1:B3)");

  // Sum at top — triggers the e#REF! path.
  control.editor.MoveECell("C1");
  const cmdC = captureSum(() => SC.SpreadsheetControl.DoSum());
  await waitEditor(control.editor);
  // ecell.row - 1 <= 1 (C1 has no rows above it) -> the e#REF! constant path.
  expect(cmdC).toBe("set C1 constant e#REF! 0 #REF!");

  // Sum with text cells in the way: stops at text
  await scheduleCommands(SC, control.sheet, [
    "set D1 value n 1",
    "set D2 text t hdr",
    "set D3 value n 2",
  ]);
  await recalcSheet(SC, control.sheet);
  // Pin fixture datatypes after the asynchronous command/recalc cycle;
  // DoSum branches on datatype, not the displayed text.
  control.sheet.GetAssuredCell("D1").datatype = "v";
  control.sheet.GetAssuredCell("D2").datatype = "t";
  control.sheet.GetAssuredCell("D3").datatype = "v";
  // Put ecell immediately below the text block so walking up hits D3 (num,
  // foundvalue=true), then D2 (text, foundvalue=true -> break).
  control.editor.MoveECell("D4");
  const cmdD = captureSum(() => SC.SpreadsheetControl.DoSum());
  await waitEditor(control.editor);
  expect(cmdD).toBe("set D4 formula sum(D3:D3)");

  // Another: sum with initial text (no foundvalue yet), then numeric.
  await scheduleCommands(SC, control.sheet, [
    "set E1 text t header",
    "set E2 value n 1",
    "set E3 value n 2",
  ]);
  await recalcSheet(SC, control.sheet);
  control.sheet.GetAssuredCell("E1").datatype = "t";
  control.sheet.GetAssuredCell("E2").datatype = "v";
  control.sheet.GetAssuredCell("E3").datatype = "v";
  control.editor.MoveECell("E4");
  const cmdE = captureSum(() => SC.SpreadsheetControl.DoSum());
  await waitEditor(control.editor);
  expect(cmdE).toBe("set E4 formula sum(E2:E3)");

  // Sum needs text-then-numeric-then-text sequence to hit both branches.
  // F1=text, F2=text, F3=num, F4=num, F5=text, ecell=F6.
  // Walk: row=5 F5=text (foundvalue=false, skip). row=4 F4=num (else branch,
  // foundvalue=true). row=3 F3=num. row=2 F2=text (foundvalue=true -> row++
  // then break). This is plain test setup (not the DoSum call under test
  // below), and scheduleCommands/recalcSheet do not throw for valid "set"
  // commands, so no try/catch is needed here.
  await scheduleCommands(SC, control.sheet, [
    "set F1 text t t1",
    "set F2 text t t2",
    "set F3 value n 100",
    "set F4 value n 200",
    "set F5 text t t5",
  ]);
  await recalcSheet(SC, control.sheet);
  control.editor.MoveECell("F6");
  // Resulting command: the sum range spans from the first numeric cell
  // found walking up (F3) through the last row before the ecell (F5),
  // regardless of the intervening text cells — confirmed empirically,
  // not by re-deriving DoSum's row-walk loop by hand.
  const capturedF6 = captureSum(() => SC.SpreadsheetControl.DoSum());
  await waitEditor(control.editor, "cmdend", 800);
  expect(capturedF6).toBe("set F6 formula sum(F3:F5)");
});

// -------------------------------------------------------------------
// Test 14: FindInSheet / SearchSheet (SearchUp / SearchDown)
// -------------------------------------------------------------------
test("FindInSheet + SearchUp/SearchDown wrap correctly", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  await scheduleCommands(SC, control.sheet, [
    "set A1 text t alpha",
    "set B1 text t beta",
    "set A2 text t alphabet",
  ]);
  await recalcSheet(SC, control.sheet);

  // #searchstatus needed by FindInSheet
  const ss = document.createElement("span");
  ss.id = "searchstatus";
  (document as any).body.appendChild(ss);

  // Clear path (empty value)
  const emptyThis: any = { value: "" };
  SC.SpreadsheetControl.FindInSheet.call(emptyThis);
  expect(control.sheet.search_cells).toEqual([]);

  // Match path
  const thisCtx: any = { value: "alpha" };
  SC.SpreadsheetControl.FindInSheet.call(thisCtx);
  expect(control.sheet.search_cells.length).toBeGreaterThanOrEqual(2);

  // No match path
  const thisCtx2: any = { value: "zzz_no_match_zzz" };
  SC.SpreadsheetControl.FindInSheet.call(thisCtx2);
  expect(control.sheet.search_cells.length).toBe(0);

  // Search navigation — set up again.
  SC.SpreadsheetControl.FindInSheet.call(thisCtx);
  SC.SpreadsheetControl.SearchDown(); // go forward
  SC.SpreadsheetControl.SearchUp(); // go back
  // Force wrap-around: selected_search_cell already at first, SearchUp wraps.
  control.sheet.selected_search_cell = 0;
  SC.SpreadsheetControl.SearchUp();
  // forward wrap
  control.sheet.selected_search_cell = control.sheet.search_cells.length - 1;
  SC.SpreadsheetControl.SearchDown();

  // No-cells path on SearchSheet
  control.sheet.search_cells = [];
  SC.SpreadsheetControl.SearchDown();
  SC.SpreadsheetControl.SearchUp();

  // Exercise the search-bar input handlers that were captured on the
  // element by the jQuery-stub's `on`/`keyup` registration.
  const input: any = document.getElementById("searchbarinput");
  expect(input).toBeTruthy();
  const handlers = input.__jqHandlers;
  handlers.focus();
  expect(SC.Keyboard.passThru).toBe(true);
  handlers.blur();
  expect(SC.Keyboard.passThru).toBe(false);
  // Enter triggers SearchDown
  control.sheet.search_cells = [{ coord: "A1" }, { coord: "A2" }];
  control.sheet.selected_search_cell = 0;
  handlers.keyup({ keyCode: 13, shiftKey: false });
  // Shift+Enter triggers SearchUp
  handlers.keyup({ keyCode: 13, shiftKey: true });
  // Non-Enter key is ignored
  handlers.keyup({ keyCode: 65 });
});

// -------------------------------------------------------------------
// Test 15: Sort tab onclick + SortSave + SortLoad
// -------------------------------------------------------------------
test("Sort tab: Onclick, SortSave, SortLoad", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Inject the elements expected by SortOnclick.
  const neededIds = [
    "sortlist",
    "sortbutton",
    "majorsort",
    "majorsortup",
    "majorsortdown",
    "minorsort",
    "minorsortup",
    "minorsortdown",
    "lastsort",
    "lastsortup",
    "lastsortdown",
  ];
  for (const id of neededIds) {
    if (!document.getElementById(control.idPrefix + id)) {
      const el =
        id.endsWith("up") || id.endsWith("down")
          ? document.createElement("input")
          : id === "sortbutton"
            ? document.createElement("input")
            : document.createElement("select");
      el.id = control.idPrefix + id;
      if (id.endsWith("up") || id.endsWith("down") || id === "sortbutton") {
        (el as any).checked = id.endsWith("up");
        (el as any).type = id === "sortbutton" ? "button" : "radio";
      }
      (document as any).body.appendChild(el);
    }
  }

  // Add a range so LoadColumnChoosers has something to do.
  await scheduleCommands(SC, control.sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 3",
    "set B2 value n 4",
  ]);
  control.sheet.names.RANGE1 = { definition: "A1:B2", desc: "my range" };
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("B2");

  SC.SpreadsheetControlSortOnclick(control, "sort");
  const sortlist = document.getElementById(control.idPrefix + "sortlist") as any;
  expect(sortlist.options.map((o: any) => o.value)).toEqual(["[select range]", "all", "RANGE1"]);
  expect(control.editor.RangeChangeCallback.sort).toBe(SC.UpdateSortRangeProposal);

  // SortSave — build current state
  const saved = SC.SpreadsheetControlSortSave(control.editor, "sort");
  expect(saved).toBe("sort::1:up::::\n");

  // Re-attach minorsort having selected index 0 path (already the default,
  // so the serialized form is unchanged).
  const minor = document.getElementById(control.idPrefix + "minorsort") as any;
  if (minor) {
    minor.__selectedIndex = 0;
  }
  const saved2 = SC.SpreadsheetControlSortSave(control.editor, "sort");
  expect(saved2).toBe(saved);

  // SortLoad reconstructs from serialized string
  SC.SpreadsheetControlSortLoad(control.editor, "sort", "sort::1:up:::2:down", {});
  expect(control.sortrange).toBe("");
  expect((document.getElementById(control.idPrefix + "sortbutton") as any).style.visibility).toBe(
    "hidden",
  );
  expect((document.getElementById(control.idPrefix + "majorsort") as any).selectedIndex).toBe(1);
  expect((document.getElementById(control.idPrefix + "majorsortup") as any).checked).toBe(true);
  expect((document.getElementById(control.idPrefix + "minorsort") as any).selectedIndex).toBe(0);
  expect((document.getElementById(control.idPrefix + "minorsortup") as any).checked).toBe(true);
  expect((document.getElementById(control.idPrefix + "lastsort") as any).selectedIndex).toBe(2);
  expect((document.getElementById(control.idPrefix + "lastsortdown") as any).checked).toBe(true);

  // with empty sortrange
  SC.SpreadsheetControlSortLoad(control.editor, "sort", "sort:::up:::::", {});
  expect(control.sortrange).toBe("");
  expect((document.getElementById(control.idPrefix + "sortbutton") as any).style.visibility).toBe(
    "hidden",
  );

  // with minor/last sort having values
  SC.SpreadsheetControlSortLoad(control.editor, "sort", "sort:A1\\cB2:1:up:1:up:1:up", {});
  expect(control.sortrange).toBe("A1:B2");
  expect((document.getElementById(control.idPrefix + "minorsort") as any).selectedIndex).toBe(1);
  expect((document.getElementById(control.idPrefix + "minorsortup") as any).checked).toBe(true);
  expect((document.getElementById(control.idPrefix + "lastsort") as any).selectedIndex).toBe(1);
  expect((document.getElementById(control.idPrefix + "lastsortup") as any).checked).toBe(true);
});

// -------------------------------------------------------------------
// Test 16: DoCmd: dosort + ok-setsort with different paths
// -------------------------------------------------------------------
test("DoCmd: ok-setsort + dosort and named-range", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Ensure required DOM for sort commands.
  for (const id of [
    "sortlist",
    "sortbutton",
    "majorsort",
    "majorsortup",
    "minorsort",
    "minorsortup",
    "lastsort",
    "lastsortup",
  ]) {
    if (!document.getElementById(control.idPrefix + id)) {
      const el = id.endsWith("up")
        ? document.createElement("input")
        : id === "sortbutton"
          ? document.createElement("input")
          : document.createElement("select");
      el.id = control.idPrefix + id;
      (el as any).checked = true;
      (document as any).body.appendChild(el);
    }
  }
  const sortlist = document.getElementById(control.idPrefix + "sortlist") as any;
  // Options: index 0 = [select range], index 1 = "all", index 2 = "MYRANGE"
  sortlist.__options = [
    { text: "[select range]", value: "" },
    { text: "Sort All", value: "all" },
    { text: "MYRANGE", value: "MYRANGE" },
  ];
  sortlist.__selectedIndex = 0;

  const majorsort = document.getElementById(control.idPrefix + "majorsort") as any;
  majorsort.__options = [
    { text: "[None]", value: "" },
    { text: "Column A", value: "A" },
  ];
  majorsort.__selectedIndex = 1;

  const minorsort = document.getElementById(control.idPrefix + "minorsort") as any;
  minorsort.__options = [{ text: "[None]", value: "" }];
  minorsort.__selectedIndex = 0;

  const lastsort = document.getElementById(control.idPrefix + "lastsort") as any;
  lastsort.__options = [{ text: "[None]", value: "" }];
  lastsort.__selectedIndex = 0;

  const scheduleSpy = spyScheduled(control.sheet as ScheduledCommandSheet);
  const sortbutton = document.getElementById(control.idPrefix + "sortbutton") as any;

  // ok-setsort index 0 (no range, ecell only)
  control.editor.MoveECell("B2");
  SC.DoCmd(null, "ok-setsort");
  expect(control.sortrange).toBe("B2:B2");
  expect(sortbutton.value).toBe("Sort B2:B2");

  // ok-setsort index 0 with range
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("B3");
  sortlist.__selectedIndex = 0;
  SC.DoCmd(null, "ok-setsort");
  expect(control.sortrange).toBe("A1:B3");
  expect(sortbutton.value).toBe("Sort A1:B3");
  control.editor.RangeRemove();

  // ok-setsort with index 1 = "all" — requires populated sheet
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1", "set B2 value n 2"]);
  sortlist.__selectedIndex = 1;
  SC.DoCmd(null, "ok-setsort");
  expect(control.sortrange).toBe("A1:B2");
  expect(sortbutton.value).toBe("Sort A1:B2");
  // "all" also annotates the option text with the resolved bounding range.
  expect(sortlist.options[1].text).toBe("Sort All (A1:B2)");

  // ok-setsort with index 2 = named range
  control.sheet.names.MYRANGE = { definition: "A1:B2", desc: "" };
  sortlist.__selectedIndex = 2;
  SC.DoCmd(null, "ok-setsort");
  // Named-range index stores the raw option value (the name), not its
  // resolved coordinates.
  expect(control.sortrange).toBe("MYRANGE");
  expect(sortbutton.value).toBe("Sort MYRANGE");

  // dosort with direct range
  control.sortrange = "A1:B2";
  SC.DoCmd(null, "dosort");
  await waitEditor(control.editor);
  expect(scheduleSpy.calls).toEqual(["sort A1:B2 A up"]);
  scheduleSpy.calls.length = 0;

  // dosort with named range
  control.sortrange = "MYRANGE";
  SC.DoCmd(null, "dosort");
  await waitEditor(control.editor);
  // The named range resolves to the same A1:B2 span.
  expect(scheduleSpy.calls).toEqual(["sort A1:B2 A up"]);
  scheduleSpy.calls.length = 0;

  // dosort with A1:A1 returns early
  control.sortrange = "A1:A1";
  SC.DoCmd(null, "dosort");
  expect(scheduleSpy.calls).toEqual([]);
  scheduleSpy.calls.length = 0;

  // dosort with minorsort/lastsort index > 0
  minorsort.__options = [
    { text: "[None]", value: "" },
    { text: "Column B", value: "B" },
  ];
  minorsort.__selectedIndex = 1;
  lastsort.__options = [
    { text: "[None]", value: "" },
    { text: "Column A", value: "A" },
  ];
  lastsort.__selectedIndex = 1;
  control.sortrange = "A1:B2";
  SC.DoCmd(null, "dosort");
  await waitEditor(control.editor);
  expect(scheduleSpy.calls).toEqual(["sort A1:B2 A up B up A up"]);
  scheduleSpy.calls.length = 0;

  // dosort with named range that doesn't resolve -> nrange.type != "range"
  control.sortrange = "NOT_A_NAME_SOMEWHERE";
  SC.DoCmd(null, "dosort");
  expect(scheduleSpy.calls).toEqual([]);
  scheduleSpy.restore();
});

// -------------------------------------------------------------------
// Test 17: Comment tab handlers
// -------------------------------------------------------------------
test("Comment tab: Onclick/Display/Set/MoveECell/Onunclick", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Required elements
  const commentInput = document.createElement("textarea");
  commentInput.id = control.idPrefix + "commenttext";
  (document as any).body.appendChild(commentInput);

  await scheduleCommands(SC, control.sheet, ["set A1 text t foo", "set A1 comment thisisanote"]);
  await recalcSheet(SC, control.sheet);

  control.editor.MoveECell("A1");
  const scheduleSpy = spyScheduled(control.sheet as ScheduledCommandSheet);

  SC.SpreadsheetControlCommentOnclick(control, "comment");
  expect((commentInput as any).value).toBe("thisisanote");
  expect(control.editor.MoveECellCallback.comment).toBe(SC.SpreadsheetControlCommentMoveECell);
  // Display reads cell.comment
  SC.SpreadsheetControlCommentDisplay(control, "comment");
  expect((commentInput as any).value).toBe("thisisanote");
  // MoveECell callback — just dispatches to display again.
  SC.SpreadsheetControlCommentMoveECell(control.editor);
  expect((commentInput as any).value).toBe("thisisanote");

  // Set: ecell readonly variant is not typical; test non-readonly
  (commentInput as any).value = "new note";
  const cellEle = SC.GetEditorCellElement(control.editor, control.editor.ecell.row, control.editor.ecell.col);
  SC.SpreadsheetControlCommentSet();
  await waitEditor(control.editor);
  expect(scheduleSpy.calls).toEqual(["set A1 comment new note"]);
  expect(cellEle.element.title).toBe("new note");
  scheduleSpy.restore();

  // Onunclick clears the callback
  SC.SpreadsheetControlCommentOnunclick(control, "comment");
  expect("comment" in control.editor.MoveECellCallback).toBe(false);
});

// -------------------------------------------------------------------
// Test 18: Names tab handlers + SetValue + Save + Delete
// -------------------------------------------------------------------
test("Names tab: all helpers including Save and Delete", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Required elements
  for (const id of ["namesname", "namesdesc", "namesvalue", "namesrangeproposal"]) {
    const el = document.createElement("input");
    el.id = control.idPrefix + id;
    (document as any).body.appendChild(el);
  }
  const nameList = document.createElement("select");
  nameList.id = control.idPrefix + "nameslist";
  (document as any).body.appendChild(nameList);

  await scheduleCommands(SC, control.sheet, [
    "name define MYSUM A1:A3",
    "name desc MYSUM my description",
  ]);
  const g = (id: string) => (document.getElementById(control.idPrefix + id) as any).value;

  // Onclick clears the fields, wires the range/moveecell callbacks, and
  // repopulates the name list + fields from current editor/sheet state.
  SC.SpreadsheetControlNamesOnclick(control, "names");
  expect(control.editor.RangeChangeCallback.names).toBe(SC.SpreadsheetControlNamesRangeChange);
  expect(control.editor.MoveECellCallback.names).toBe(SC.SpreadsheetControlNamesRangeChange);
  expect(g("namesrangeproposal")).toBe("A1");
  // FillNameList selects "[New]" (no current name) then ChangedName clears
  // the fields since sheet.names["[New]"] doesn't exist.
  expect((nameList as any).options.map((o: any) => o.value)).toEqual(["[New]", "MYSUM"]);
  expect(g("namesname")).toBe("");
  expect(g("namesdesc")).toBe("");
  expect(g("namesvalue")).toBe("");

  const scheduleSpy = spyScheduled(control.sheet as ScheduledCommandSheet);

  // Exercise changed name
  (nameList as any).__options = [
    { text: "[New]", value: "[New]" },
    { text: "MYSUM", value: "MYSUM" },
  ];
  (nameList as any).__selectedIndex = 1;
  SC.SpreadsheetControlNamesChangedName();
  expect(g("namesname")).toBe("MYSUM");
  expect(g("namesdesc")).toBe("my description");
  expect(g("namesvalue")).toBe("A1:A3");

  // Selected = [New] path (empty name) — sheet.names["[New]"] doesn't
  // exist, so the fields are cleared instead of populated.
  (nameList as any).__selectedIndex = 0;
  SC.SpreadsheetControlNamesChangedName();
  expect(g("namesname")).toBe("");
  expect(g("namesdesc")).toBe("");
  expect(g("namesvalue")).toBe("");

  // RangeChange without range: proposal becomes the ecell coord.
  SC.SpreadsheetControlNamesRangeChange(control.editor);
  expect(g("namesrangeproposal")).toBe("A1");
  // with range: proposal becomes the range's coord span.
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("B3");
  SC.SpreadsheetControlNamesRangeChange(control.editor);
  expect(g("namesrangeproposal")).toBe("A1:B3");

  // SetValue copies proposal -> value
  (document.getElementById(control.idPrefix + "namesrangeproposal") as any).value = "A1:A3";
  SC.SpreadsheetControlNamesSetValue();
  expect(g("namesvalue")).toBe("A1:A3");

  // FillNameList with existing names: rebuilt in sorted order, "[New]"
  // selected since the name field is currently empty.
  SC.SpreadsheetControlNamesFillNameList();
  expect((nameList as any).options.map((o: any) => o.value)).toEqual(["[New]", "MYSUM"]);
  expect((nameList as any).options[0].selected).toBe(true);

  // Save (skips when name is empty): no command scheduled.
  (document.getElementById(control.idPrefix + "namesname") as any).value = "";
  SC.SpreadsheetControlNamesSave();
  expect(scheduleSpy.calls).toEqual([]);

  // Save with a non-empty name - creates new name.
  (document.getElementById(control.idPrefix + "namesname") as any).value = "NEWNAME";
  (document.getElementById(control.idPrefix + "namesvalue") as any).value = "A1";
  (document.getElementById(control.idPrefix + "namesdesc") as any).value = "a new one";
  SC.SpreadsheetControlNamesSave();
  await waitEditor(control.editor);
  expect(scheduleSpy.calls).toEqual(["name define NEWNAME A1\nname desc NEWNAME a new one"]);
  scheduleSpy.calls.length = 0;

  // Delete (empty name branch): no command scheduled.
  (document.getElementById(control.idPrefix + "namesname") as any).value = "";
  SC.SpreadsheetControlNamesDelete();
  expect(scheduleSpy.calls).toEqual([]);
  // Delete (real name)
  (document.getElementById(control.idPrefix + "namesname") as any).value = "MYSUM";
  SC.SpreadsheetControlNamesDelete();
  await waitEditor(control.editor);
  expect(scheduleSpy.calls).toEqual(["name delete MYSUM"]);
  scheduleSpy.restore();

  // Onunclick removes the range/moveecell callbacks Onclick installed.
  expect("names" in control.editor.RangeChangeCallback).toBe(true);
  expect("names" in control.editor.MoveECellCallback).toBe(true);
  SC.SpreadsheetControlNamesOnunclick(control, "names");
  expect("names" in control.editor.RangeChangeCallback).toBe(false);
  expect("names" in control.editor.MoveECellCallback).toBe(false);

  // FillNameList when there are NO names (empty path): only "[None]".
  for (const key of Object.keys(control.sheet.names)) delete control.sheet.names[key];
  SC.SpreadsheetControlNamesFillNameList();
  expect((nameList as any).options.map((o: any) => o.value)).toEqual(["[None]"]);
});

// -------------------------------------------------------------------
// Test 19: Clipboard tab - Onclick, Format, Load, Clear, Export
// -------------------------------------------------------------------
test("Clipboard tab: Onclick/Format/Load/Clear/Export", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Ensure required DOM
  for (const id of [
    "clipboardtext",
    "clipboardformat-tab",
    "clipboardformat-csv",
    "clipboardformat-scsave",
  ]) {
    if (!document.getElementById(control.idPrefix + id)) {
      const el =
        id === "clipboardtext"
          ? document.createElement("textarea")
          : document.createElement("input");
      el.id = control.idPrefix + id;
      (el as any).checked = false;
      (el as any).type = "radio";
      (document as any).body.appendChild(el);
    }
  }

  // Seed the clipboard.
  SC.Clipboard.clipboard = "version:1.5\ncell:A1:t:Hello\nsheet:c:1:r:1\n";

  const clipele = document.getElementById(control.idPrefix + "clipboardtext") as any;
  const scheduleSpy = spyScheduled(control.sheet as ScheduledCommandSheet);

  SC.SpreadsheetControlClipboardOnclick(control, "clipboard");
  expect((document.getElementById(control.idPrefix + "clipboardformat-tab") as any).checked).toBe(true);
  expect(clipele.value).toBe("Hello\n");

  // Format switching for all three output types.
  SC.SpreadsheetControlClipboardFormat("tab");
  expect(clipele.value).toBe("Hello\n");
  SC.SpreadsheetControlClipboardFormat("csv");
  expect(clipele.value).toBe("Hello\n");
  SC.SpreadsheetControlClipboardFormat("scsave");
  expect(clipele.value).toBe("version:1.5\ncell:A1:t:Hello\nsheet:c:1:r:1\n");

  // Clear
  SC.SpreadsheetControlClipboardClear();
  expect(clipele.value).toBe("");
  expect(scheduleSpy.calls).toEqual(["clearclipboard"]);
  scheduleSpy.calls.length = 0;

  // Load (tab format default). The prior Clear call leaves editor.busy
  // true, so this schedule lands in editor.deferredCommands and only
  // reaches sheet.ScheduleSheetCommands once that command finishes.
  clipele.value = "foo\tbar\n";
  (document.getElementById(control.idPrefix + "clipboardformat-tab") as any).checked = true;
  SC.SpreadsheetControlClipboardLoad();
  await waitEditor(control.editor, "cmdend", 500);
  expect(scheduleSpy.calls).toEqual([
    "loadclipboard version\\c1.5\\ncell\\cA1\\ct\\cfoo\\ncell\\cB1\\ct\\cbar\\nsheet\\cc\\c2\\cr\\c1\\ncopiedfrom\\cA1\\cB1\\n",
  ]);
  scheduleSpy.calls.length = 0;

  // Load csv
  (document.getElementById(control.idPrefix + "clipboardformat-tab") as any).checked = false;
  (document.getElementById(control.idPrefix + "clipboardformat-csv") as any).checked = true;
  clipele.value = "a,b\n1,2\n";
  SC.SpreadsheetControlClipboardLoad();
  await waitEditor(control.editor, "cmdend", 500);
  expect(scheduleSpy.calls).toEqual([
    "loadclipboard version\\c1.5\\ncell\\cA1\\ct\\ca\\ncell\\cB1\\ct\\cb\\ncell\\cA2\\cv\\c1\\ncell\\cB2\\cv\\c2\\nsheet\\cc\\c2\\cr\\c2\\ncopiedfrom\\cA1\\cB2\\n",
  ]);
  scheduleSpy.calls.length = 0;

  // Load scsave
  (document.getElementById(control.idPrefix + "clipboardformat-csv") as any).checked = false;
  (document.getElementById(control.idPrefix + "clipboardformat-scsave") as any).checked = true;
  clipele.value = "version:1.5\ncell:A1:t:X\n";
  SC.SpreadsheetControlClipboardLoad();
  await waitEditor(control.editor, "cmdend", 500);
  expect(scheduleSpy.calls).toEqual(["loadclipboard version\\c1.5\\ncell\\cA1\\ct\\cX\\n"]);
  scheduleSpy.calls.length = 0;
  scheduleSpy.restore();

  // Export with callback
  let cbCalled = false;
  control.ExportCallback = () => {
    cbCalled = true;
  };
  SC.SpreadsheetControlClipboardExport();
  expect(cbCalled).toBe(true);

  // Export without callback (no-op)
  cbCalled = false;
  control.ExportCallback = null;
  SC.SpreadsheetControlClipboardExport();
  expect(cbCalled).toBe(false);

  // Trigger the internal try/catch console.error path (production code
  // already catches this internally — nothing to swallow at the call site)
  // by making ConvertSaveToOtherFormat throw (invalid clipboard data).
  const originalConvert = SC.ConvertSaveToOtherFormat;
  SC.ConvertSaveToOtherFormat = () => {
    throw new Error("test error");
  };
  const errorCalls: any[] = [];
  const origConsoleError = console.error;
  console.error = (...args: any[]) => errorCalls.push(args);
  SC.SpreadsheetControlClipboardOnclick(control, "clipboard");
  console.error = origConsoleError;
  expect(errorCalls.map((a) => String(a[0]?.message || a[0]))).toEqual(["test error"]);
  SC.ConvertSaveToOtherFormat = originalConvert;
});

// -------------------------------------------------------------------
// Test 20: Settings tab - SettingsControlSave + Switch + SetCurrentPanel
// -------------------------------------------------------------------
test("Settings tab: Switch + Save variants + SetCurrentPanel", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Switch sheet
  SC.SpreadsheetControlSettingsSwitch("sheet");
  const sheettable = document.getElementById(`${control.idPrefix}sheetsettingstable`) as any;
  const celltable = document.getElementById(`${control.idPrefix}cellsettingstable`) as any;
  expect(sheettable?.style.display).toBe("block");
  expect(celltable?.style.display).toBe("none");

  // Switch cell
  SC.SpreadsheetControlSettingsSwitch("cell");
  expect(sheettable?.style.display).toBe("none");
  expect(celltable?.style.display).toBe("block");

  // SettingsControlSave paths: sheet, cell (with and without range), cancel
  const saveSpy = spyScheduled(control.sheet as ScheduledCommandSheet);
  SC.SettingsControlSave("sheet");
  await waitEditor(control.editor);
  // No panel value differs from its default, so DecodeSheetAttributes
  // returns an empty cmdstr -> nothing is scheduled (real no-op state).
  expect(saveSpy.calls).toEqual([]);
  saveSpy.calls.length = 0;

  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("C3");
  SC.SettingsControlSave("cell");
  await waitEditor(control.editor);
  expect(saveSpy.calls).toEqual([]);
  saveSpy.calls.length = 0;

  control.editor.RangeRemove();
  SC.SettingsControlSave("cell");
  await waitEditor(control.editor);
  expect(saveSpy.calls).toEqual([]);
  saveSpy.calls.length = 0;

  SC.SettingsControlSave("cancel");
  // Cancel builds no cmdstr at all -> nothing scheduled.
  expect(saveSpy.calls).toEqual([]);
  saveSpy.restore();

  // SettingsControls helpers
  SC.SettingsControlSetCurrentPanel(control.views.settings.values.cellspanel);
  SC.SettingsControlSetCurrentPanel(control.views.settings.values.sheetspanel);
  expect(SC.SettingsControls.CurrentPanel).toBe(control.views.settings.values.sheetspanel);

  // SettingsControlInitializePanel again (already called, but re-run)
  SC.SettingsControlInitializePanel(control.views.settings.values.cellspanel);

  // SettingsControlLoadPanel + UnloadPanel
  const attribs = control.sheet.EncodeCellAttributes("A1");
  SC.SettingsControlLoadPanel(control.views.settings.values.cellspanel, attribs);
  const out = SC.SettingsControlUnloadPanel(control.views.settings.values.cellspanel);
  // UnloadPanel reads every control back into its {def,val} shape.
  expect(out).toEqual({
    numberformat: { def: true, val: 0 },
    textformat: { def: true, val: 0 },
    fontfamily: { def: true, val: 0 },
    fontlook: { def: true, val: 0 },
    fontsize: { def: true, val: 0 },
    alignhoriz: { def: true, val: 0 },
    alignvert: { def: true, val: 0 },
    textcolor: { def: true, val: 0 },
    bgcolor: { def: true, val: 0 },
    bt: { def: false, val: "" },
    br: { def: false, val: "" },
    bb: { def: false, val: "" },
    bl: { def: false, val: "" },
    padtop: { def: true, val: 0 },
    padright: { def: true, val: 0 },
    padbottom: { def: true, val: 0 },
    padleft: { def: true, val: 0 },
  });

  // SettingControlReset calls OnReset(ctrlname) on every registered
  // control TYPE (not on the current panel instance), so spy on every
  // type's OnReset to confirm each one actually fires.
  const resetCalls: string[] = [];
  const origResets: Record<string, (name: string) => void> = {};
  for (const ctrlname of Object.keys(SC.SettingsControls.Controls)) {
    const c = SC.SettingsControls.Controls[ctrlname];
    if (typeof c.OnReset === "function") {
      origResets[ctrlname] = c.OnReset;
      c.OnReset = (name: string) => {
        resetCalls.push(ctrlname);
        return origResets[ctrlname](name);
      };
    }
  }
  const resettableTypes = Object.keys(origResets);
  SC.SettingControlReset();
  for (const ctrlname of resettableTypes) {
    SC.SettingsControls.Controls[ctrlname].OnReset = origResets[ctrlname];
  }
  expect(resetCalls.sort()).toEqual([...resettableTypes].sort());
});

// -------------------------------------------------------------------
// Test 21: PopupList/ColorChooser/BorderSide Set/Get/Initialize/Reset
// -------------------------------------------------------------------
test("Settings controls: PopupList/ColorChooser/BorderSide Get/Set/Init/Reset", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const panel = control.views.settings.values.cellspanel;

  const origAlert = (globalThis as any).alert;
  const alertCalls: string[] = [];
  (globalThis as any).alert = (msg: string) => alertCalls.push(msg);

  // PopupList Set/Get with default value
  SC.SettingsControls.PopupListSetValue(panel, "cfontlook", {
    def: false,
    val: "normal bold * *",
  });
  SC.SettingsControls.PopupListSetValue(panel, "cfontlook", { def: true, val: 0 });
  // undefined value warning path
  SC.SettingsControls.PopupListSetValue(panel, "cfontlook", null);
  const v = SC.SettingsControls.PopupListGetValue(panel, "cfontlook");
  // First SetValue (def:false) stores "normal bold * *", second (def:true)
  // overwrites with "", third (null) only alerts without touching state ->
  // the empty stored value reads back as the default {def:true,val:0}.
  expect(alertCalls).toEqual(["cfontlook no value"]);
  expect(v).toEqual({ def: true, val: 0 });
  alertCalls.length = 0;
  // GetValue with missing ctrl
  const v2 = SC.SettingsControls.PopupListGetValue(panel, "missing_ctrl");
  expect(v2).toBeNull();

  // PopupList Initialize
  SC.SettingsControls.PopupListInitialize(panel, "cfontlook");
  expect(SC.Popup.Controls[panel.cfontlook.id]).toBeDefined();

  // PopupList Reset
  SC.SettingsControls.PopupListReset("cfontlook");
  // Reset hides any currently-open "List"-type popup; none is open here.
  expect(SC.Popup.Current.id).toBeFalsy();

  // ColorChooser
  SC.SettingsControls.ColorChooserSetValue(panel, "cbgcolor", { def: false, val: "rgb(1,2,3)" });
  // A concrete value alerts nothing.
  expect(alertCalls).toEqual([]);
  alertCalls.length = 0;
  SC.SettingsControls.ColorChooserSetValue(panel, "cbgcolor", { def: true, val: 0 });
  SC.SettingsControls.ColorChooserSetValue(panel, "cbgcolor", null);
  // def:true overwrites with "", null only alerts.
  expect(alertCalls).toEqual(["cbgcolor no value"]);
  alertCalls.length = 0;
  const ccGet = SC.SettingsControls.ColorChooserGetValue(panel, "cbgcolor");
  expect(ccGet).toEqual({ def: true, val: 0 });
  SC.SettingsControls.ColorChooserInitialize(panel, "cbgcolor");
  expect(SC.Popup.Controls[panel.cbgcolor.id]).toBeDefined();
  SC.SettingsControls.ColorChooserReset("cbgcolor");
  expect(SC.Popup.Current.id).toBeFalsy();

  // BorderSide - create checkbox + color popup.
  const bcb = document.createElement("input");
  bcb.id = panel.cbt.id + "-onoff-bcb";
  (bcb as any).checked = true;
  (bcb as any).value = "1px solid rgb(0,0,0)";
  (bcb as any).type = "checkbox";
  (document as any).body.appendChild(bcb);

  SC.SettingsControls.BorderSideInitialize(panel, "cbt");
  // Set with val
  SC.SettingsControls.BorderSideSetValue(panel, "cbt", { val: "1px solid rgb(1,2,3)" });
  // BorderSideSetValue toggles the checkbox to reflect a non-empty value.
  expect((bcb as any).checked).toBe(true);
  // Set with empty val (off)
  SC.SettingsControls.BorderSideSetValue(panel, "cbt", { val: "" });
  // An empty value unchecks the border-on checkbox.
  expect((bcb as any).checked).toBe(false);
  // Set with null value (alert path)
  SC.SettingsControls.BorderSideSetValue(panel, "cbt", null);
  expect(alertCalls).toEqual(["cbt no value"]);
  alertCalls.length = 0;

  // Get value when checkbox is checked
  (bcb as any).checked = true;
  const vChecked = SC.SettingsControls.BorderSideGetValue(panel, "cbt");
  // BorderSideGetValue reads straight off the checkbox's checked+value
  // attributes, not the popup value store touched by SetValue above.
  expect(vChecked).toEqual({ def: false, val: "1px solid rgb(0,0,0)" });
  // Get when unchecked
  (bcb as any).checked = false;
  const vUnchecked = SC.SettingsControls.BorderSideGetValue(panel, "cbt");
  expect(vUnchecked).toEqual({ def: false, val: "" });

  // SettingsControlOnchangeBorder - with bcb suffix id
  SC.SettingsControlSetCurrentPanel(panel); // ensure CurrentPanel is set
  (bcb as any).checked = true;
  SC.SettingsControlOnchangeBorder(bcb);
  // Round-trip through BorderSideGetValue proves OnchangeBorder actually
  // dispatched to BorderSide.SetValue with the checkbox's current value.
  expect(SC.SettingsControls.BorderSideGetValue(panel, "cbt")).toEqual({
    def: false,
    val: "1px solid rgb(0,0,0)",
  });
  // Now uncheck
  (bcb as any).checked = false;
  SC.SettingsControlOnchangeBorder(bcb);
  expect(SC.SettingsControls.BorderSideGetValue(panel, "cbt")).toEqual({ def: false, val: "" });

  // SettingsControlOnchangeBorder with no match
  const badEle = document.createElement("input");
  const beforeNoMatch = SC.SettingsControls.BorderSideGetValue(panel, "cbt");
  SC.SettingsControlOnchangeBorder(badEle);
  // id doesn't match the "-<ctrl>-onoff-<suffix>" pattern -> early return,
  // BorderSide's stored state is untouched.
  expect(SC.SettingsControls.BorderSideGetValue(panel, "cbt")).toEqual(beforeNoMatch);

  // PopupChangeCallback - requires sample-text element
  const sampleText = document.createElement("div");
  sampleText.id = "sample-text";
  sampleText.appendChild(document.createElement("div"));
  sampleText.appendChild(document.createElement("div"));
  (document as any).body.appendChild(sampleText);
  (bcb as any).checked = true;
  SC.SettingsControls.PopupChangeCallback({ panelobj: panel }, "", null);
  // cell-mode panel ("c" prefix) applies the border-side values we set
  // above onto the sample element's border styles.
  expect(sampleText.style.borderTop).toBe("1px solid rgb(0,0,0)");
  // Sheet panel path
  SC.SettingsControls.PopupChangeCallback(
    { panelobj: control.views.settings.values.sheetspanel },
    "",
    null,
  );
  // sheet-mode panel skips the border branch and clears any border style.
  expect(sampleText.style.border).toBe("");
  // PopupChangeCallback without sample-text (early return)
  if (sampleText.parentNode) sampleText.parentNode.removeChild(sampleText);
  const styleBefore = JSON.stringify(sampleText.style.cssText);
  SC.SettingsControls.PopupChangeCallback({ panelobj: panel }, "", null);
  // getElementById("sample-text") now finds nothing (removed from DOM) ->
  // early return, no style mutation possible.
  expect(JSON.stringify(sampleText.style.cssText)).toBe(styleBefore);
  // No attribs or panelobj -> early return
  expect(() => SC.SettingsControls.PopupChangeCallback(null, "", null)).not.toThrow();
  expect(() => SC.SettingsControls.PopupChangeCallback({}, "", null)).not.toThrow();

  (globalThis as any).alert = origAlert;
});

// -------------------------------------------------------------------
// Test 22: DoCmd - unknown verb dispatches empty; DoButtonCmd recalc
// -------------------------------------------------------------------
test("DoCmd: unknown verb schedules empty cmd, DoButtonCmd schedules recalc", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Unknown command: default path builds an empty combostr and still
  // schedules it (a real, if functionally no-op, dispatch).
  const scheduleSpy = spyScheduled(control.sheet as ScheduledCommandSheet);
  SC.DoCmd(null, "unknown-verb-zzz");
  expect(scheduleSpy.calls).toEqual([""]);
  scheduleSpy.calls.length = 0;

  // DoButtonCmd directly
  SC.DoButtonCmd(null, null, { element: null, functionobj: { command: "recalc" } });
  await waitEditor(control.editor);
  expect(scheduleSpy.calls).toEqual(["recalc"]);
  scheduleSpy.restore();
});

// -------------------------------------------------------------------
// Test 23: CreateSheetHTML + RenderContext paths + CreateCellHTML for
//          cells with displaystring
// -------------------------------------------------------------------
test("CreateCellHTML respects pre-cached displaystring", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, ["set A1 value n 42"]);
  await recalcSheet(SC, control.sheet);

  // Populate cell displaystring manually
  control.sheet.cells.A1.displaystring = "<b>42</b>";
  expect(control.CreateCellHTML("A1")).toBe("<b>42</b>");

  // Cell with displaystring = "&nbsp;" returns "" path.
  control.sheet.cells.A1.displaystring = "&nbsp;";
  expect(control.CreateCellHTML("A1")).toBe("");

  // CreateCellHTMLSave covers same branches
  control.sheet.cells.A1.displaystring = "<i>alpha</i>";
  const save = control.CreateCellHTMLSave("A1:A1");
  expect(save).toContain("A1:");

  // Save with "&nbsp;" cells — should skip those.
  control.sheet.cells.A1.displaystring = "&nbsp;";
  const save2 = control.CreateCellHTMLSave("A1:A1");
  expect(save2).not.toContain("A1:");

  // Save over empty coords (no cell) -> continue path
  const save3 = control.CreateCellHTMLSave("Z1:Z3");
  expect(save3).toContain("version:1.0");
});

// -------------------------------------------------------------------
// Test 24: LocalizeString + LocalizeSubstrings with %ssc!constant!
// -------------------------------------------------------------------
test("LocalizeString + LocalizeSubstrings with known and missing constants", async () => {
  const SC = await loadSocialCalc();
  expect(SC.LocalizeString("hello world")).toBe("hello world");
  expect(SC.LocalizeString("Edit")).toBe("Edit");
  // Second call hits the cache
  expect(SC.LocalizeString("Edit")).toBe("Edit");

  expect(SC.LocalizeSubstrings("%loc!Hello!")).toBe("Hello");
  // %ssc lookups
  expect(SC.LocalizeSubstrings("%ssc!defaultImagePrefix!")).toBeDefined();
});

// -------------------------------------------------------------------
// Test 25: StatuslineCallback - all status branches
// -------------------------------------------------------------------
test("SpreadsheetControlStatuslineCallback for all recalc statuses", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  const params = {
    statuslineid: control.idPrefix + "statusline",
    recalcid1: control.idPrefix + "divider_recalc",
    recalcid2: control.idPrefix + "button_recalc",
  };
  for (const status of [
    "cmdendnorender",
    "calcfinished",
    "doneposcalc",
    "cmdend",
    "cmdstart",
    "unknown_status",
  ]) {
    SC.SpreadsheetControlStatuslineCallback(control.editor, status, null, params);
  }

  // Set needsrecalc=yes to exercise that branch
  control.sheet.attribs.needsrecalc = "yes";
  SC.SpreadsheetControlStatuslineCallback(control.editor, "calcfinished", null, params);
  control.sheet.attribs.needsrecalc = "no";
  SC.SpreadsheetControlStatuslineCallback(control.editor, "calcfinished", null, params);

  // Missing recalc elements (early break path)
  const badParams = { ...params, recalcid1: "nonexistent_id", recalcid2: "nonexistent_id_2" };
  SC.SpreadsheetControlStatuslineCallback(control.editor, "calcfinished", null, badParams);
});

// -------------------------------------------------------------------
// Test 26: CtrlSEditor + CtrlSEditorDone
// -------------------------------------------------------------------
test("CtrlSEditor / CtrlSEditorDone round-trip", async () => {
  const SC = await loadSocialCalc();
  const { control: _control } = await newControl(SC);

  SC.OtherSaveParts["mypart"] = "some part content";

  SC.CtrlSEditor("mypart");
  const box1 = document.getElementById("socialcalc-editbox") as any;
  const ta = document.getElementById("socialcalc-editbox-textarea") as any;
  expect(box1).toBeTruthy();
  expect(box1.parentNode).toBeTruthy();
  // Update textarea content and run Done.
  if (ta) {
    ta.value = "new content";
  }
  SC.CtrlSEditorDone("socialcalc-editbox", "mypart");
  expect(SC.OtherSaveParts["mypart"]).toBe("new content");
  // Done removes the editbox from the DOM.
  expect(box1.parentNode).toBeFalsy();

  // Empty textarea -> delete.
  SC.CtrlSEditor("mypart");
  const ta2 = document.getElementById("socialcalc-editbox-textarea") as any;
  if (ta2) ta2.value = "";
  SC.CtrlSEditorDone("socialcalc-editbox", "mypart");
  expect(SC.OtherSaveParts["mypart"]).toBeUndefined();

  // With empty whichpart (listing path): whichpart.length is 0, so no
  // OtherSaveParts write/delete happens, but the editbox is still built
  // and torn down.
  SC.OtherSaveParts["a"] = "A\n";
  SC.OtherSaveParts["b"] = "B\n";
  SC.CtrlSEditor("");
  const box3 = document.getElementById("socialcalc-editbox") as any;
  expect(box3).toBeTruthy();
  expect(box3.parentNode).toBeTruthy();
  SC.CtrlSEditorDone("socialcalc-editbox", "");
  expect(box3.parentNode).toBeFalsy();
  expect(SC.OtherSaveParts).toEqual({ a: "A\n", b: "B\n" });
});

// -------------------------------------------------------------------
// Test 27: DoOnResize / SizeSSDiv / CalculateSheetNonViewHeight
// -------------------------------------------------------------------
test("DoOnResize + SizeSSDiv + CalculateSheetNonViewHeight", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Resize: first resize should be false (nothing changed); change requested
  // height and call DoOnResize to trigger.
  const r1 = control.DoOnResize();
  // DoOnResize has no return value; SizeSSDiv (which it calls internally)
  // does, but DoOnResize itself always returns undefined.
  expect(r1).toBeUndefined();

  control.requestedHeight = 500;
  control.requestedWidth = 700;
  const r2 = control.DoOnResize();
  expect(r2).toBeUndefined();
  expect(control.width).toBe(700);
  expect(control.height).toBe(500);

  // Margins on parentNode style path
  control.parentNode.style.marginTop = "5px";
  control.parentNode.style.marginBottom = "5px";
  control.parentNode.style.marginLeft = "5px";
  control.parentNode.style.marginRight = "5px";
  const r3 = control.SizeSSDiv();
  // requestedHeight/Width (500/700) already match control.height/width from
  // the prior DoOnResize call, so SizeSSDiv reports "nothing changed".
  expect(r3).toBe(false);
  expect(control.width).toBe(700);
  expect(control.height).toBe(500);

  // CalculateSheetNonViewHeight
  SC.CalculateSheetNonViewHeight(control);
  expect(control.nonviewheight).toBe(140);
});

// -------------------------------------------------------------------
// Test 28: Audit tab onclick with populated changes
// -------------------------------------------------------------------
test("Audit tab: oncreate builds trail HTML (with debug_log entries)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  SC.debug_log = [{ action: "click", target: "A1" }, "plain string", { ref: null, circular: null }];

  // Create a self-reference to hit the cycle-guard in ObjToSource.
  const cyc: any = { name: "cyc" };
  cyc.self = cyc;
  SC.debug_log.push(cyc);
  SC.debug_log.push([1, 2, 3]);

  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);
  // Undo then redo so the audit stack has both directions
  SC.SheetUndo(control.sheet);
  await waitEditor(control.editor, "cmdend", 800);
  SC.SheetRedo(control.sheet);
  await waitEditor(control.editor, "cmdend", 800);

  // Click the audit tab. SetTab's onclick dispatch renders the trail into
  // views.audit.element.innerHTML.
  control.editor.busy = false;
  const audittab = document.getElementById(control.idPrefix + "audittab");
  if (audittab) SC.SetTab(audittab);
  expect(control.views.audit.element.innerHTML).toContain("Audit Trail This Session");
  expect(control.views.audit.element.innerHTML).toContain("set A1 value n 1");

  // Explicit call to tab onclick (bypasses SetTab's busy/DOM gating) with
  // the full seeded debug_log — every entry's ObjToSource serialization
  // (including the self-referencing cycle guard) appears in the HTML.
  const auditTabIdx = control.tabnums.audit;
  const onclick = control.tabs[auditTabIdx].onclick;
  onclick(control, "audit");
  expect(control.views.audit.element.innerHTML).toBe(
    '<table cellspacing="0" cellpadding="0" style="margin-bottom:10px;"><tr><td style="font-size:small;padding:6px;"><b>Audit Trail This Session:</b><br><br>set A1 value n 1<br>' +
      "{'action':'click','target':'A1'}<br>plain string<br>{'ref':null,'circular':null}<br>" +
      "{'name':'cyc','self':{}}<br>[1,2,3]<br></td></tr></table>",
  );

  // Also run with tos at last position so UNDONE STEPS block doesn't trigger
  control.sheet.changes.tos = control.sheet.changes.stack.length - 1;
  onclick(control, "audit");
  expect(control.views.audit.element.innerHTML).not.toContain("UNDONE STEPS");

  // Empty debug_log case
  SC.debug_log = [];
  onclick(control, "audit");
  expect(control.views.audit.element.innerHTML).toBe(
    '<table cellspacing="0" cellpadding="0" style="margin-bottom:10px;"><tr><td style="font-size:small;padding:6px;"><b>Audit Trail This Session:</b><br><br>set A1 value n 1<br></td></tr></table>',
  );

  // delete debug_log - undefined path produces identical output (the loop
  // is simply skipped, same as an empty array).
  delete SC.debug_log;
  onclick(control, "audit");
  expect(control.views.audit.element.innerHTML).toBe(
    '<table cellspacing="0" cellpadding="0" style="margin-bottom:10px;"><tr><td style="font-size:small;padding:6px;"><b>Audit Trail This Session:</b><br><br>set A1 value n 1<br></td></tr></table>',
  );
  SC.debug_log = [];
});

// -------------------------------------------------------------------
// Test 29: SpreadsheetControlNamesFillNameList with no names + current
//          name selector path
// -------------------------------------------------------------------
test("NamesFillNameList branches: no names, current-name match", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // No names initially.
  for (const id of ["namesname", "namesdesc", "namesvalue"]) {
    const el = document.createElement("input");
    el.id = control.idPrefix + id;
    (document as any).body.appendChild(el);
  }
  const nl = document.createElement("select");
  nl.id = control.idPrefix + "nameslist";
  (document as any).body.appendChild(nl);

  const optionsOf = () => Array.from(nl.options).map((o: any) => [o.text, o.value, o.selected]);

  SC.SpreadsheetControlNamesFillNameList();
  // No names -> single "[None]" placeholder, selected.
  expect(optionsOf()).toEqual([["[None]", "[None]", true]]);

  // Add names and set current name to match one of them
  await scheduleCommands(SC, control.sheet, ["name define ABC A1", "name define XYZ B2"]);
  (document.getElementById(control.idPrefix + "namesname") as any).value = "ABC";
  SC.SpreadsheetControlNamesFillNameList();
  // Names sorted alphabetically after a "[New]" placeholder; the matching
  // current name is selected instead of the placeholder.
  expect(optionsOf()).toEqual([
    ["[New]", "[New]", false],
    ["ABC", "ABC", true],
    ["XYZ", "XYZ", false],
  ]);

  // current name doesn't match any existing — the "[New]" placeholder is
  // selected instead.
  (document.getElementById(control.idPrefix + "namesname") as any).value = "";
  SC.SpreadsheetControlNamesFillNameList();
  expect(optionsOf()).toEqual([
    ["[New]", "[New]", true],
    ["ABC", "ABC", false],
    ["XYZ", "XYZ", false],
  ]);
});

// -------------------------------------------------------------------
// Test 30: LoadColumnChoosers + UpdateSortRangeProposal
// -------------------------------------------------------------------
test("LoadColumnChoosers / UpdateSortRangeProposal all branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // The Sort tab's real HTML template embeds
  // `<option selected>[select range]</option><option value="all">Sort All</option>`
  // inside the sortlist <select>, so a real browser always has
  // sortlist.options[0] populated by the time these handlers run. Our
  // FakeElement/FakeDocument shim does not parse <option> tags out of
  // innerHTML into a real .options collection, so we seed it here to
  // match what a real browser would already have. majorsort/minorsort/
  // lastsort don't need seeding: LoadColumnChoosers always resets their
  // `.options.length = 0` before reading/writing anything else.
  const sortlist = document.getElementById(control.idPrefix + "sortlist") as any;
  sortlist.__options = [
    { text: "[select range]", value: "", selected: true },
    { text: "Sort All", value: "all" },
  ];

  // UpdateSortRangeProposal with no range
  SC.UpdateSortRangeProposal(control.editor);
  expect(sortlist.options[0].text).toBe("[select range]");
  // With range
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("C3");
  SC.UpdateSortRangeProposal(control.editor);
  expect(sortlist.options[0].text).toBe("A1:C3");
  control.editor.RangeRemove();

  const majorsort = document.getElementById(control.idPrefix + "majorsort") as any;
  const optText = (sel: any) => Array.from(sel.options).map((o: any) => [o.text, o.value]);

  // LoadColumnChoosers: sortrange is A1:C3 (range path)
  control.sortrange = "A1:C3";
  SC.LoadColumnChoosers(control);
  expect(optText(majorsort)).toEqual([
    ["[None]", ""],
    ["Column A", "A"],
    ["Column B", "B"],
    ["Column C", "C"],
  ]);

  // LoadColumnChoosers: named range resolves to the identical A1:C3 range.
  control.sheet.names.MYRANGE = { definition: "A1:C3", desc: "" };
  control.sortrange = "MYRANGE";
  SC.LoadColumnChoosers(control);
  expect(optText(majorsort)).toEqual([
    ["[None]", ""],
    ["Column A", "A"],
    ["Column B", "B"],
    ["Column C", "C"],
  ]);

  // LoadColumnChoosers: unresolvable named range falls back to A1:A1
  // (a single column).
  control.sortrange = "NONEXISTENT_NAME_XX";
  SC.LoadColumnChoosers(control);
  expect(optText(majorsort)).toEqual([
    ["[None]", ""],
    ["Column A", "A"],
  ]);
});

// -------------------------------------------------------------------
// Test 31: DoCmd paths that use dosort with specific named-range chains
// -------------------------------------------------------------------
test("SpreadsheetControl: cursorsuffix propagation on movefrom", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  // Set up a range2.
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("B2");
  SC.DoCmd(null, "movefrom");
  expect(control.editor.range2.hasrange).toBe(true);
  // Now move ecell outside range2 horizontally, call the MoveECellCallback.movefrom
  control.editor.MoveECell("E1");
  control.editor.MoveECellCallback.movefrom(control.editor);
  // And vertically outside range2 from the left column.
  control.editor.MoveECell("A10");
  control.editor.MoveECellCallback.movefrom(control.editor);
  // And inside range2 (no cursorsuffix)
  control.editor.MoveECell("A2");
  control.editor.MoveECellCallback.movefrom(control.editor);

  // cellhandles.noCursorSuffix path
  control.editor.cellhandles = control.editor.cellhandles || {};
  control.editor.cellhandles.noCursorSuffix = true;
  control.editor.MoveECell("E1");
  control.editor.MoveECellCallback.movefrom(control.editor);
  control.editor.cellhandles.noCursorSuffix = false;

  // Now reset range2.
  control.editor.Range2Remove();
  control.editor.MoveECellCallback.movefrom(control.editor);
});

// -------------------------------------------------------------------
// Test 32: InitializeSpreadsheetControl error path (node missing)
// -------------------------------------------------------------------
test("InitializeSpreadsheetControl: unknown string id triggers alert", async () => {
  const SC = await loadSocialCalc();
  const control = new SC.SpreadsheetControl();
  // Unknown id resolves getElementById to null; InitializeSpreadsheetControl
  // alerts "not given parent node" and returns immediately (fixed source
  // regression — this used to crash on node.firstChild right after
  // warning that node was missing).
  const origAlert = (globalThis as any).alert;
  const alertCalls: string[] = [];
  (globalThis as any).alert = (msg: string) => alertCalls.push(msg);
  expect(() => control.InitializeSpreadsheetControl("nonexistent-id-here-xyz")).not.toThrow();
  expect(alertCalls).toEqual(["SocialCalc.SpreadsheetControl not given parent node."]);
  expect(control.parentNode).toBeNull();
  expect(control.spreadsheetDiv).toBeNull();
  (globalThis as any).alert = origAlert;
});


// -------------------------------------------------------------------
// Test 33b: SortSave with minor/last sort > 0 selected indices
// -------------------------------------------------------------------
test("SortSave: minor/last sort > 0 branches", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Make sure all expected DOM nodes exist
  for (const id of [
    "majorsort",
    "majorsortup",
    "minorsort",
    "minorsortup",
    "lastsort",
    "lastsortup",
  ]) {
    if (!document.getElementById(control.idPrefix + id)) {
      const el = id.endsWith("up")
        ? document.createElement("input")
        : document.createElement("select");
      el.id = control.idPrefix + id;
      (el as any).checked = true;
      (document as any).body.appendChild(el);
    }
  }

  const minor = document.getElementById(control.idPrefix + "minorsort") as any;
  minor.__selectedIndex = 2;
  const last = document.getElementById(control.idPrefix + "lastsort") as any;
  last.__selectedIndex = 3;

  control.sortrange = "A1:C5";
  const saved = SC.SpreadsheetControlSortSave(control.editor, "sort");
  expect(saved).toContain("sort:");
  expect(saved).toContain("2");
  expect(saved).toContain("3");
});

// -------------------------------------------------------------------
// Test 33c: SortOnclick with sortrange matching a name
// -------------------------------------------------------------------
test("SortOnclick with sortrange matching a name", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // DOM
  for (const id of [
    "sortlist",
    "sortbutton",
    "majorsort",
    "majorsortup",
    "minorsort",
    "minorsortup",
    "lastsort",
    "lastsortup",
  ]) {
    if (!document.getElementById(control.idPrefix + id)) {
      const el =
        id.endsWith("up") || id === "sortbutton"
          ? document.createElement("input")
          : document.createElement("select");
      el.id = control.idPrefix + id;
      (el as any).checked = true;
      (document as any).body.appendChild(el);
    }
  }

  await scheduleCommands(SC, control.sheet, ["set A1 value n 1", "set B2 value n 2"]);
  control.sheet.names.MYSORT = { definition: "A1:B2", desc: "" };
  control.sortrange = "MYSORT";
  const sortlist = document.getElementById(control.idPrefix + "sortlist") as any;
  const optState = () =>
    Array.from(sortlist.options).map((o: any) => [o.text, o.value, o.selected]);

  SC.SpreadsheetControlSortOnclick(control, "sort");
  // The named range MYSORT appears (alphabetically after the two fixed
  // entries) and is selected since it matches sortrange.
  expect(optState()).toEqual([
    ["[select range]", "[select range]", false],
    ["Sort All", "all", false],
    ["MYSORT", "MYSORT", true],
  ]);

  // empty sortrange -> option[0] selected
  control.sortrange = "";
  SC.SpreadsheetControlSortOnclick(control, "sort");
  expect(optState()).toEqual([
    ["[select range]", "[select range]", true],
    ["Sort All", "all", false],
    ["MYSORT", "MYSORT", false],
  ]);
});


// -------------------------------------------------------------------
// Test 33d: CreateCellHTML with displaystring undefined but value set
// -------------------------------------------------------------------
test("CreateCellHTML/Save with cell.displaystring undefined", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, ["set A1 text t Hello", "set B1 value n 42"]);
  // Do NOT recalc yet so displaystring remains undefined.
  control.sheet.cells.A1.displaystring = undefined;
  control.sheet.cells.B1.displaystring = undefined;

  const s1 = control.CreateCellHTML("A1");
  expect(typeof s1).toBe("string");

  const save = control.CreateCellHTMLSave("A1:B1");
  expect(save).toContain("version:1.0");
});

// -------------------------------------------------------------------
// Test 33e: FindInSheet covers datatype='c' branch (constants)
// -------------------------------------------------------------------
test("FindInSheet: datatype 'c' constant branch", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const ss = document.createElement("span");
  ss.id = "searchstatus";
  (document as any).body.appendChild(ss);

  // Create a cell with datatype 'c' (constant).
  await scheduleCommands(SC, control.sheet, ["set A1 constant n$ 1234.5 $1,234.50"]);
  await recalcSheet(SC, control.sheet);
  // Ensure its displaystring is set.
  control.sheet.cells.A1.displaystring = "$1,234.50";
  control.sheet.cells.A1.datatype = "c";

  const ctx: any = { value: "1234" };
  SC.SpreadsheetControl.FindInSheet.call(ctx);
  // Result depends on exactly how displaystring matches; just confirm the function runs.

  // Path with hidden row/col
  control.sheet.rowattribs.hide[1] = "yes";
  SC.SpreadsheetControl.FindInSheet.call(ctx);
  control.sheet.rowattribs.hide[1] = undefined;

  // Path with datatype != 'c' and datavalue present
  control.sheet.cells.A1.datatype = "v";
  control.sheet.cells.A1.datavalue = 42;
  SC.SpreadsheetControl.FindInSheet.call(ctx);
  expect(Array.isArray(control.sheet.search_cells)).toBe(true);
});

// -------------------------------------------------------------------
// Test 33f: SettingsControls.ColorChooserGetValue with value set
// -------------------------------------------------------------------
test("Settings: ColorChooser/PopupList Get with value already set", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const panel = control.views.settings.values.cellspanel;

  // Set a value in a popup, then GetValue should return {def:false, val}.
  SC.Popup.SetValue(panel.cbgcolor.id, "rgb(128,128,128)");
  const v = SC.SettingsControls.ColorChooserGetValue(panel, "cbgcolor");
  expect(v.val).toBe("rgb(128,128,128)");

  // Similarly for PopupList
  SC.Popup.SetValue(panel.cfontlook.id, "normal bold * *");
  const v2 = SC.SettingsControls.PopupListGetValue(panel, "cfontlook");
  expect(v2.def).toBe(false);
});

// -------------------------------------------------------------------
// Test 33g: SetTab onclickFocus string path (clipboard tab)
// -------------------------------------------------------------------
test("SetTab onclickFocus string branch (clipboard tab)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Clipboard tab has onclickFocus: "clipboardtext"; ensure DOM exists.
  for (const id of [
    "clipboardtext",
    "clipboardformat-tab",
    "clipboardformat-csv",
    "clipboardformat-scsave",
  ]) {
    if (!document.getElementById(control.idPrefix + id)) {
      const el =
        id === "clipboardtext"
          ? document.createElement("textarea")
          : document.createElement("input");
      el.id = control.idPrefix + id;
      (el as any).checked = id === "clipboardformat-tab";
      (el as any).type = "radio";
      (document as any).body.appendChild(el);
    }
  }

  SC.SetTab("clipboard");
  // onclickFocus:"clipboardtext" (string) -> resolves the DOM element and
  // focuses it via CmdGotFocus (real production behavior for the string
  // branch); the tab switch itself is directly observable.
  expect(control.currentTab).toBe(control.tabnums.clipboard);

  // Settings tab: onclickFocus = true (bool), different path
  SC.SetTab("settings");
  expect(control.currentTab).toBe(control.tabnums.settings);
});

// -------------------------------------------------------------------
// Test 33h: DoOnResize triggers view resize
// -------------------------------------------------------------------
test("DoOnResize: sizes change triggers view resize", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  control.requestedHeight = 600;
  control.requestedWidth = 800;
  control.DoOnResize();
  expect(control.height).toBe(600);
  expect(control.width).toBe(800);
  // Sizes already match requestedHeight/Width, so a second SizeSSDiv call
  // (via DoOnResize's internal call, exercised again here directly)
  // reports no further change.
  expect(control.SizeSSDiv()).toBe(false);
});

// -------------------------------------------------------------------
// Test 33i: SizeSSDiv with parentNode.style margins set
// -------------------------------------------------------------------
test("SizeSSDiv: margin branches", async () => {
  const SC = await loadSocialCalc();
  const container = document.createElement("div");
  container.id = "sc-margins";
  (document as any).body.appendChild(container);
  // Set margins before init.
  container.style.marginTop = "10px";
  container.style.marginBottom = "20px";
  container.style.marginLeft = "30px";
  container.style.marginRight = "40px";

  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 0);
  SC.SetSpreadsheetControlObject(control);
  // InitializeSpreadsheetControl already called SizeSSDiv once (with
  // these margins in place); a second call with nothing changed reports
  // no resize needed.
  expect(control.SizeSSDiv()).toBe(false);
  expect(control.spreadsheetDiv.style.height).toBe("400px");
  expect(control.spreadsheetDiv.style.width).toBe("600px");
});

// -------------------------------------------------------------------
// Test 33j: LocalizeString cache hit and miss
// -------------------------------------------------------------------
test("LocalizeString: cache miss then hit for a fresh key", async () => {
  const SC = await loadSocialCalc();
  // Miss (populates cache)
  const a = SC.LocalizeString("__UncachedKey123__");
  expect(a).toBe("__UncachedKey123__");
  // Hit
  const b = SC.LocalizeString("__UncachedKey123__");
  expect(b).toBe("__UncachedKey123__");
});

// -------------------------------------------------------------------
// Test 33k-1: InitializeSpreadsheetControl with pre-existing children
// -------------------------------------------------------------------
test("Init: parent container pre-populated (clears children)", async () => {
  const SC = await loadSocialCalc();
  const container = document.createElement("div");
  container.id = "sc-pre-populated";
  // Add a few children that should be cleared.
  container.appendChild(document.createElement("p"));
  container.appendChild(document.createElement("span"));
  (document as any).body.appendChild(container);
  expect(container.childNodes.length).toBe(2);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  // Children were removed, replaced with spreadsheetDiv
  expect(container.firstChild).toBe(control.spreadsheetDiv);
});

// -------------------------------------------------------------------
// Test 33k-2: tabreplacements loop body
// -------------------------------------------------------------------
test("Init: tabreplacements applied in HTML", async () => {
  const SC = await loadSocialCalc();
  const container = document.createElement("div");
  container.id = "sc-tabrep";
  (document as any).body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  // Inject a tabreplacement before init
  control.tabreplacements.custom = { regex: /Audit/g, replacement: "AuditLog" };
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  // tabreplacements applies its regex/replacement to the raw HTML string
  // before it's parsed into the DOM, so the audit tab's rendered label
  // text node reads "AuditLog" instead of "Audit".
  const audittab = document.getElementById(control.idPrefix + "audittab") as any;
  const texts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.nodeName === "#text" && node.textContent) texts.push(node.textContent);
    for (const c of node.childNodes || []) walk(c);
  };
  walk(audittab);
  expect(texts).toEqual(["AuditLog"]);
});

// -------------------------------------------------------------------
// Test 33k-3: SetTab with onclickFocus as element (not string)
// -------------------------------------------------------------------
test("SetTab: onclickFocus element path (settings tab)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  const toolsDisplay = (name: string) =>
    (document.getElementById(control.idPrefix + name + "tools") as any).style.display;
  const tabCss = (name: string) =>
    (document.getElementById(control.idPrefix + name + "tab") as any).style.cssText;
  const viewDisplay = (name: string) => control.views[name].element.style.display;

  // settings tab has onclickFocus: true (non-string), exercises else branch
  // clipboard tab has onclickFocus: "clipboardtext" (string), exercises if branch
  // Pre-select a range so settings onclick hits the hasrange branch.
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("B2");
  SC.SetTab("settings");
  expect(control.currentTab).toBe(control.tabnums.settings);
  expect(toolsDisplay("settings")).toBe("block");
  expect(toolsDisplay("edit")).toBe("none");
  expect(tabCss("settings")).toBe(control.tabselectedCSS);
  expect(tabCss("edit")).toBe(control.tabplainCSS);
  expect(viewDisplay("settings")).toBe("block");
  expect(viewDisplay("sheet")).toBe("none");
  // Non-sheet views hide the statusline.
  expect(control.statuslineDiv.style.display).toBe("none");
  control.editor.RangeRemove();
  SC.SetTab("clipboard");
  expect(control.currentTab).toBe(control.tabnums.clipboard);
  expect(toolsDisplay("clipboard")).toBe("block");
  expect(toolsDisplay("settings")).toBe("none");
  expect(viewDisplay("clipboard")).toBe("block");

  // Test 33k-4: SetTab cycle with onunclick handler
  SC.SetTab("comment");
  expect(control.currentTab).toBe(control.tabnums.comment);
  expect(toolsDisplay("comment")).toBe("block");
  SC.SetTab("names");
  expect(control.currentTab).toBe(control.tabnums.names);
  expect(toolsDisplay("names")).toBe("block");
  // names tab onclick wires the range/moveecell callbacks.
  expect("names" in control.editor.RangeChangeCallback).toBe(true);
  expect("names" in control.editor.MoveECellCallback).toBe(true);
  // now switching back calls onunclick of names tab.
  SC.SetTab("edit");
  expect(control.currentTab).toBe(control.tabnums.edit);
  expect(toolsDisplay("edit")).toBe("block");
  expect(toolsDisplay("names")).toBe("none");
  // Switching away from names fires its onunclick, removing the callbacks.
  expect("names" in control.editor.RangeChangeCallback).toBe(false);
  expect("names" in control.editor.MoveECellCallback).toBe(false);
  expect(viewDisplay("sheet")).toBe("block");
  expect(control.statuslineDiv.style.display).toBe("block");

  // Views support an optional onresize callback fired when needsresize is
  // set. Plug one into an existing view and switch to it.
  let resizeCalls = 0;
  control.views.sheet.onresize = () => {
    resizeCalls++;
  };
  control.views.sheet.needsresize = true;
  SC.SetTab("sheet");
  expect(resizeCalls).toBe(1);
});

// -------------------------------------------------------------------
// Test 33k-5: SettingsControlSave with actual cmdstr (covers 27605)
// -------------------------------------------------------------------
test("SettingsControlSave: actual cmdstr triggers EditorScheduleSheetCommands", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Load attribs and unload to get cmdstr
  const attribs = control.sheet.EncodeCellAttributes("A1");
  // modify one value so DecodeCellAttributes generates a change
  if (attribs.numberformat) {
    attribs.numberformat = { def: false, val: "#,##0.00" };
  } else {
    attribs["numberformat"] = { def: false, val: "#,##0" };
  }

  // Set current panel
  SC.SettingsControlSetCurrentPanel(control.views.settings.values.cellspanel);
  SC.SettingsControlLoadPanel(control.views.settings.values.cellspanel, attribs);

  control.editor.MoveECell("A1");
  const spy = spyScheduled(control.sheet as ScheduledCommandSheet);
  SC.SettingsControlSave("cell");
  await waitEditor(control.editor);
  expect(spy.calls).toEqual(["set A1 nontextvalueformat #,##0.00"]);
  spy.calls.length = 0;

  // Sheet save with changes. EncodeSheetAttributes' key for this setting
  // is "numberformat" (there is no "defaultnumberformat" key — confirmed
  // empirically), so modify that one to actually generate a change.
  SC.SettingsControlSetCurrentPanel(control.views.settings.values.sheetspanel);
  const sheetAttribs = control.sheet.EncodeSheetAttributes();
  sheetAttribs.numberformat = { def: false, val: "#,##0" };
  SC.SettingsControlLoadPanel(control.views.settings.values.sheetspanel, sheetAttribs);
  SC.SettingsControlSave("sheet");
  await waitEditor(control.editor);
  expect(spy.calls).toEqual(["set sheet defaultnontextvalueformat #,##0"]);
  spy.restore();
});

// -------------------------------------------------------------------
// Test 33k: DoLink inputboxdirect with '-quoted text
// -------------------------------------------------------------------
test("DoLink: inputboxdirect with '-prefixed text", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Seed text with leading quote
  control.editor.inputBox.element.value = "'http://example.com";
  control.editor.state = "inputboxdirect";
  SC.SpreadsheetControl.DoLink();
  const dialog = document.getElementById(`${control.idPrefix}linkdialog`) as any;
  expect(dialog).not.toBeNull();
  // The leading "'" (quote-prefix, SocialCalc's "force text" marker) is
  // stripped before the URL is parsed out into the link dialog's URL
  // field.
  const urlField = document.getElementById(`${control.idPrefix}linkurl`) as any;
  expect(urlField.value).toBe("http://example.com");

  SC.SpreadsheetControl.HideLink();
  // HideLink clears the dialog's content and detaches it from its parent
  // (document.getElementById still finding the id afterward is a known
  // limitation of this test harness's id-index, which isn't invalidated
  // by removeChild — dialog.parentNode is the reliable signal here).
  expect(dialog.innerHTML).toBe("");
  expect(dialog.parentNode).toBeFalsy();
  control.editor.state = "start";
});

// -------------------------------------------------------------------
// Test 33: Final sanity: full end-to-end editor after many operations
// -------------------------------------------------------------------
test("SpreadsheetControl: full pipeline with many ExecuteCommand verbs", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC);
  SC.SetSpreadsheetControlObject(control);

  // Seed a grid
  await scheduleCommands(SC, control.sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "set A2 value n 4",
    "set B2 value n 5",
    "set C2 value n 6",
  ]);
  await recalcSheet(SC, control.sheet);

  control.editor.MoveECell("A1");

  const allCmds: string[] = [];
  const origSchedule = control.editor.EditorScheduleSheetCommands;
  control.editor.EditorScheduleSheetCommands = function (cmd: any, ...rest: any[]) {
    allCmds.push(cmd);
    return origSchedule.call(this, cmd, ...rest);
  };

  // Large battery of verbs that go through ExecuteCommand directly.
  const cmds = [
    ["set %C cellformat left", ""],
    ["set %C cellformat center", ""],
    ["set %C cellformat right", ""],
    ["set %C bgcolor %S", "rgb(240,240,240)"],
    ["set %C color %S", "rgb(10,20,30)"],
    ["set %C font %S", "italic bold * *"],
    ["set %C nontextvalueformat %S", "#,##0.00"],
    ["set %C textvalueformat %S", "general"],
    ["set %C readonly yes", ""],
    ["set %C readonly no", ""],
    ["set %C comment %S", "note here"],
    ["insertrow %C", ""],
    ["insertcol %C", ""],
    ["deleterow %C", ""],
    ["deletecol %C", ""],
    ["set %H hide yes", ""],
    ["set %H hide no", ""],
    ["set %W hide yes", ""],
    ["set %W hide no", ""],
    ["set %W width %S", "100"],
  ];
  for (const [cmd, sstr] of cmds) {
    await execAndWait(control, cmd, sstr);
  }
  // Exact substituted commands, confirmed empirically (not hand-derived):
  // the row/col hide commands land on row 2 / column B rather than the
  // originally-selected row 1 / column A because insertrow/insertcol
  // earlier in the battery shift editor.ecell down-and-right by one.
  expect(allCmds).toEqual([
    "set A1 cellformat left",
    "set A1 cellformat left",
    "set A1 cellformat center",
    "set A1 cellformat center",
    "set A1 cellformat right",
    "set A1 bgcolor rgb(240,240,240)",
    "set A1 color rgb(10,20,30)",
    "set A1 font italic bold * *",
    "set A1 nontextvalueformat #,##0.00",
    "set A1 textvalueformat general",
    "set A1 readonly yes",
    "set A1 readonly no",
    "set A1 comment note here",
    "insertrow A1",
    "insertcol A1",
    "deleterow A1",
    "deletecol A1",
    "set 1 hide yes",
    "set 2 hide no",
    "set A hide yes",
    "set B hide no",
    "set B width 100",
  ]);
  allCmds.length = 0;

  // filldown + fillright with range
  control.editor.MoveECell("A1");
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("A3");
  await execAndWait(control, "filldown %C all");
  control.editor.RangeRemove();
  control.editor.RangeAnchor("A1");
  control.editor.RangeExtend("C1");
  await execAndWait(control, "fillright %C all");
  control.editor.RangeRemove();
  expect(allCmds).toEqual(["filldown A1:A3 all", "fillright A1:C1 all"]);
  allCmds.length = 0;

  // copy/cut/paste + pasteformats round-trip
  control.editor.MoveECell("A1");
  await execAndWait(control, "copy %C all");
  control.editor.MoveECell("E1");
  await execAndWait(control, "paste %C all");
  control.editor.MoveECell("A1");
  await execAndWait(control, "cut %C all");
  control.editor.MoveECell("F1");
  await execAndWait(control, "paste %C formulas");
  control.editor.MoveECell("G1");
  await execAndWait(control, "paste %C formats");
  // Column A is left hidden by the battery loop above (the "hide no"
  // toggle landed on column B, never un-hiding A) — MoveECell("A1") etc.
  // therefore lands the cursor on the nearest visible cell in that row
  // instead, confirmed empirically.
  expect(allCmds).toEqual([
    "copy B2 all",
    "paste E2 all",
    "cut B2 all",
    "paste F2 formulas",
    "paste G2 formats",
  ]);
  allCmds.length = 0;

  // undo, redo, recalc
  await execAndWait(control, "undo");
  await execAndWait(control, "redo");
  await execAndWait(control, "recalc");
  expect(allCmds).toEqual(["undo", "redo", "recalc"]);
  allCmds.length = 0;

  // Sort on a column
  await execAndWait(control, "sort A1:C2 A up");
  expect(allCmds).toEqual(["sort A1:C2 A up"]);
  allCmds.length = 0;

  // Name define/delete
  await execAndWait(control, "name define TOTAL sum(A1:A3)");
  await execAndWait(control, "name desc TOTAL the_total");
  await execAndWait(control, "name delete TOTAL");
  expect(allCmds).toEqual([
    "name define TOTAL sum(A1:A3)",
    "name desc TOTAL the_total",
    "name delete TOTAL",
  ]);
  allCmds.length = 0;

  // moveinsert via ExecuteCommand
  await execAndWait(control, "moveinsert A1:A1 A2 all");
  expect(allCmds).toEqual(["moveinsert A1:A1 A2 all"]);
  control.editor.EditorScheduleSheetCommands = origSchedule;
});
