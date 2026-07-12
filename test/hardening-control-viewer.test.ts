import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import {
  loadSocialCalc as _loadSocialCalc,
  makeSave,
  recalcSheet,
  scheduleCommands,
  waitForStatus,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// ---------------------------------------------------------------------------
// Shared helpers (control- and viewer-prefixed to avoid collisions)
// ---------------------------------------------------------------------------

// Track timers scheduled by SocialCalc code paths so afterEach can cancel
// any that survive a test (ScheduleRender / repeating-macro / cellhandles
// timers). We wrap globalThis.setTimeout (the bundle's inner `window` is
// bound to globalThis, so `window.setTimeout` inside the source resolves
// here). Dynamic runtime collection of timer handles → Set is the correct
// choice over a static Record.
const liveTimers = new Set<NodeJS.Timeout>();
const origSetTimeout = globalThis.setTimeout;
const origClearTimeout = globalThis.clearTimeout;

function wrapTimerGlobals(): void {
  const wrappedSet = function (
    handler: (...args: unknown[]) => void,
    timeout?: number,
    ...args: unknown[]
  ): NodeJS.Timeout {
    const id = origSetTimeout(handler, timeout, ...args);
    liveTimers.add(id);
    return id;
  };
  const wrappedClear = function (id: NodeJS.Timeout): void {
    if (id) liveTimers.delete(id);
    origClearTimeout(id);
  };
  globalThis.setTimeout = wrappedSet as typeof globalThis.setTimeout;
  globalThis.clearTimeout = wrappedClear as typeof globalThis.clearTimeout;
}

afterEach(() => {
  for (const id of liveTimers) {
    origClearTimeout(id);
  }
  liveTimers.clear();
  globalThis.setTimeout = origSetTimeout;
  globalThis.clearTimeout = origClearTimeout;
  // Reset focusTable so lingering heartbeats turn into no-ops.
  const maybeSC = globalThis as unknown as { SocialCalc?: { Keyboard?: { focusTable: unknown } } };
  const sc = maybeSC.SocialCalc;
  if (sc && sc.Keyboard) sc.Keyboard.focusTable = null;
});

beforeEach(() => {
  liveTimers.clear();
});

async function fresh(): Promise<typeof SocialCalc> {
  const SC = await _loadSocialCalc({ browser: true });
  installUiShim();
  wrapTimerGlobals();
  return SC;
}

let hostSeq = 0;
function makeHost(hostId: string): HTMLElement {
  const container = document.createElement("div");
  container.id = `${hostId}-container-${hostSeq++}`;
  document.body.appendChild(container);
  const mount = document.createElement("div");
  mount.id = hostId;
  container.appendChild(mount);
  return mount;
}

// Build a valid multipart SocialCalc save string with the requested parts.
function buildSave(
  boundary: string,
  parts: { name: string; content: string }[],
  leadingComment?: string,
): string {
  const lines: string[] = [];
  if (leadingComment) lines.push(leadingComment);
  lines.push("socialcalc:version:1.0");
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary=${boundary}`);
  lines.push(`--${boundary}`);
  lines.push("Content-type: text/plain; charset=UTF-8");
  lines.push("");
  lines.push("version:1.0");
  for (const p of parts) lines.push(`part:${p.name}`);
  for (const p of parts) {
    lines.push(`--${boundary}`);
    lines.push("Content-type: text/plain; charset=UTF-8");
    lines.push("");
    lines.push(p.content);
  }
  lines.push(`--${boundary}--`);
  lines.push("");
  return makeSave(lines);
}

// DoButtonCmd's signature takes an Event but its body never reads `e`; a
// stand-in object is a safe unchecked cast (named helper, real reason).
function fakeEvent(target: HTMLElement | null): Event {
  return { target } as unknown as Event;
}


// ---------------------------------------------------------------------------
// Control helpers
// ---------------------------------------------------------------------------

let controlSeq = 0;
function newControl(SC: typeof SocialCalc, idPrefix?: string): {
  control: SocialCalc.SpreadsheetControl;
  container: HTMLElement;
} {
  const container = document.createElement("div");
  container.id = `ctrl-root-${controlSeq++}`;
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl(idPrefix);
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

function waitEditor(
  editor: SocialCalc.TableEditor,
  wantStatus: string | ((s: string) => boolean) = "doneposcalc",
  timeoutMs = 3000,
): Promise<void> {
  const matches = typeof wantStatus === "function" ? wantStatus : (s: string) => s === wantStatus;
  // Promise.withResolvers is available at runtime (Bun) but not in es2022
  // lib types; use a typed wrapper to bridge the gap.
  const PR = Promise as unknown as { withResolvers: <T>() => { promise: Promise<T>; resolve: (v: T) => void } };
  const { promise, resolve } = PR.withResolvers<void>();
  const key = `tmpc_${Math.random().toString(36).slice(2)}`;
  const cb = editor.StatusCallback as unknown as Record<string, { func: (e: unknown, s: string) => void; params: unknown }>;
  const timer = setTimeout(() => {
    delete cb[key];
    resolve();
  }, timeoutMs);
  cb[key] = {
    func: (_e: unknown, status: string) => {
      if (matches(status)) {
        clearTimeout(timer);
        delete cb[key];
        resolve();
      }
    },
    params: null,
  };
  return promise;
}

async function execAndWait(control: SocialCalc.SpreadsheetControl, combo: string, sstr = ""): Promise<void> {
  const p = waitEditor(control.editor);
  control.ExecuteCommand(combo, sstr);
  await p;
}

// Seed a <select> with real <option> children matching the given values,
// mirroring what the production HTML-to-DOM parser would produce.
function seedSelect(id: string, values: string[], selected = 0): HTMLSelectElement {
  const sel = document.createElement("select") as unknown as HTMLSelectElement;
  sel.id = id;
  // The fake DOM defines `options` as a getter returning `__options`,
  // so we must write to `__options` directly, not to `.options`.
  const selExt = sel as unknown as { __options: { text: string; value: string }[]; __selectedIndex: number };
  selExt.__options = [];
  selExt.__selectedIndex = selected;
  for (const v of values) {
    selExt.__options.push({ text: v, value: v });
  }
  document.body.appendChild(sel);
  return sel;
}

// ===========================================================================
// VIEWER TESTS — js/socialcalcviewer.ts
// ===========================================================================

// ---------------------------------------------------------------------------
// V1. Constructor + lifecycle
// ---------------------------------------------------------------------------

test("Viewer ctor: default properties and CurrentSpreadsheetViewerObject set", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-");
  expect(viewer.idPrefix).toBe("vp-");
  expect(viewer.parentNode).toBeNull();
  expect(viewer.spreadsheetDiv).toBeNull();
  expect(viewer.requestedHeight).toBe(0);
  expect(viewer.requestedWidth).toBe(0);
  expect(viewer.hasStatusLine).toBe(true);
  expect(viewer.statuslineFull).toBe(true);
  expect(viewer.noRecalc).toBe(true);
  expect(viewer.repeatingMacroTimer).toBeNull();
  expect(viewer.repeatingMacroInterval).toBe(60);
  expect(viewer.repeatingMacroCommands).toBe("");
  expect(viewer.sheet).toBeDefined();
  expect(viewer.context).toBeDefined();
  expect(viewer.editor).toBeDefined();
  expect(viewer.editor.noEdit).toBe(true);
  expect(SC.CurrentSpreadsheetViewerObject).toBe(viewer);
  const v2 = new SC.SpreadsheetViewer();
  expect(v2.idPrefix).toBe("SocialCalc-");
});

test("Viewer ctor: _app mode hides grid, seeds A1 loading message, builds formDataViewer on init", async () => {
  const SC = await fresh();
  SC._app = true;
  try {
    const viewer = new SC.SpreadsheetViewer("app-");
    expect(viewer.context.showGrid).toBe(false);
    expect(viewer.context.showRCHeaders).toBe(false);
    expect(viewer.context.sheetobj.cells["A1"].displaystring).toContain("Loading");
    const host = makeHost("vp-app-host");
    SC.InitializeSpreadsheetViewer(viewer, host, 200, 300, 20);
    expect(viewer.formDataViewer).not.toBeNull();
    const fdv = viewer.formDataViewer;
    if (fdv) {
      expect(fdv.idPrefix).toBe("te_FormData-");
      expect(fdv.sheet.statuscallback).toBeNull();
    }
    expect(SC.CurrentSpreadsheetViewerObject).toBe(viewer);
  } finally {
    SC._app = undefined;
  }
});

test("Viewer ctor: _view mode prefixes imagePrefix with ../", async () => {
  const SC = await fresh();
  const origPrefix = SC.Constants.defaultImagePrefix;
  SC._view = true;
  try {
    const viewer = new SC.SpreadsheetViewer();
    expect(viewer.imagePrefix).toBe("../" + origPrefix);
    expect(SC.Constants.defaultImagePrefix).toBe("../" + origPrefix);
  } finally {
    SC._view = undefined;
    SC.Constants.defaultImagePrefix = origPrefix;
  }
});

test("InitializeSpreadsheetViewer: element node attaches spreadsheetDiv and sets requested dims", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-el-");
  const host = makeHost("vp-el-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 250, 350, 15);
  expect(viewer.parentNode).toBe(host);
  expect(viewer.requestedHeight).toBe(250);
  expect(viewer.requestedWidth).toBe(350);
  expect(viewer.requestedSpaceBelow).toBe(15);
  expect(viewer.spreadsheetDiv).toBeDefined();
  expect(viewer.spreadsheetDiv!.firstChild).toBeDefined();
  expect(viewer.editorDiv).toBeDefined();
  expect(viewer.statuslineDiv).toBeDefined();
  expect(viewer.statuslineDiv!.id).toBe("vp-el-statusline");
  expect(viewer.editor.StatusCallback.statusline.params.spreadsheetobj).toBe(viewer);
});

test("InitializeSpreadsheetViewer: string node id resolves via getElementById", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-str-");
  const host = makeHost("vp-str-host");
  SC.InitializeSpreadsheetViewer(viewer, "vp-str-host", 200, 300, 10);
  expect(viewer.parentNode).toBe(host);
  expect(viewer.requestedHeight).toBe(200);
  expect(viewer.requestedWidth).toBe(300);
  expect(viewer.requestedSpaceBelow).toBe(10);
  expect(viewer.spreadsheetDiv).toBeDefined();
  expect(viewer.spreadsheetDiv!.firstChild).toBeDefined();
  expect(viewer.statuslineDiv!.id).toBe("vp-str-statusline");
});

test("InitializeSpreadsheetViewer: null node alerts and bails without attaching", async () => {
  const SC = await fresh();
  const calls: string[] = [];
  const origAlert = globalThis.alert;
  globalThis.alert = (msg: unknown) => {
    calls.push(typeof msg === "string" ? msg : String(msg));
  };
  try {
    const viewer = new SC.SpreadsheetViewer("vp-null-");
    SC.InitializeSpreadsheetViewer(viewer, "does-not-exist-id", 200, 300, 10);
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("parent node");
    expect(viewer.parentNode).toBeNull();
    expect(viewer.spreadsheetDiv).toBeNull();
  } finally {
    globalThis.alert = origAlert;
  }
});

test("InitializeSpreadsheetViewer: omitted height/width auto-sizes from viewport", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-auto-");
  const host = makeHost("vp-auto-host");
  SC.InitializeSpreadsheetViewer(viewer, host);
  // viewport 1280x720 (installBrowserShim defaults). fudge 10.
  expect(viewer.height).toBe(710);
  expect(viewer.width).toBe(1270);
  expect(viewer.spreadsheetDiv!.style.height).toBe("710px");
  expect(viewer.spreadsheetDiv!.style.width).toBe("1270px");
});

test("ParseSheetSave prototype wrapper delegates to sheet.ParseSheetSave", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-pss-");
  viewer.ParseSheetSave("version:1.5\ncell:A1:t:wrapper-value\nsheet:c:1:r:1\n");
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("wrapper-value");
});

// ---------------------------------------------------------------------------
// V2. SpreadsheetViewerLoadSave
// ---------------------------------------------------------------------------

test("LoadSave: sheet + edit parts mutate sheet cells and editor ecell synchronously", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-ls-");
  const host = makeHost("vp-ls-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  const save = buildSave("VPLS", [
    {
      name: "sheet",
      content: "version:1.5\ncell:A1:t:sheet-value\ncell:A2:v:42\nsheet:c:1:r:2",
    },
    { name: "edit", content: "version:1.0\necell:B2\n" },
  ]);
  viewer.LoadSave(save);
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("sheet-value");
  expect(viewer.sheet.GetAssuredCell("A2").datavalue).toBe(42);
  expect(viewer.editor.ecell).not.toBeNull();
  expect(viewer.editor.ecell!.coord).toBe("B2");
});

test("LoadSave: startupmacro part executes a real sheet command asynchronously", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-startup-");
  const host = makeHost("vp-startup-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  const save = buildSave("VPSTART", [
    { name: "sheet", content: "version:1.5\ncell:A1:t:pre\nsheet:c:1:r:1" },
    { name: "startupmacro", content: "set A1 text t started-by-macro" },
  ]);
  await waitForStatus(viewer.sheet, "cmdend", () => viewer.LoadSave(save), 3000);
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("started-by-macro");
});

test("LoadSave: recalc=off branch calls ScheduleRender, recalc-on branch schedules recalc", async () => {
  const SC = await fresh();
  const v1 = new SC.SpreadsheetViewer("vp-off-");
  const h1 = makeHost("vp-off-host");
  SC.InitializeSpreadsheetViewer(v1, h1, 300, 400, 20);
  v1.editor.context.sheetobj.attribs.recalc = "off";
  const save = buildSave("VPOFF", [
    { name: "sheet", content: "version:1.5\ncell:A1:t:off-val\nsheet:c:1:r:1" },
  ]);
  v1.LoadSave(save);
  expect(v1.sheet.GetAssuredCell("A1").datavalue).toBe("off-val");

  const v2 = new SC.SpreadsheetViewer("vp-rc-");
  const h2 = makeHost("vp-rc-host");
  SC.InitializeSpreadsheetViewer(v2, h2, 300, 400, 20);
  v2.noRecalc = false;
  v2.editor.context.sheetobj.attribs.recalc = "";
  await waitForStatus(v2.sheet, "cmdend", () => v2.LoadSave(save), 3000);
  expect(v2.sheet.GetAssuredCell("A1").datavalue).toBe("off-val");
});

test("LoadSave: non-multipart save string leaves sheet parts unchanged", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-np-");
  const host = makeHost("vp-np-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  viewer.sheet.ParseSheetSave("version:1.5\ncell:A1:t:pre-existing\nsheet:c:1:r:1");
  viewer.LoadSave("not a multipart save string");
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("pre-existing");
});

// ---------------------------------------------------------------------------
// V3. Repeating macro machinery
// ---------------------------------------------------------------------------

test("Repeating macro: DoRepeatingMacro executes the scheduled sheet command", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-rm-");
  const host = makeHost("vp-rm-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  viewer.sheet.ParseSheetSave("version:1.5\ncell:A1:t:before-tick\nsheet:c:1:r:1");
  viewer.repeatingMacroCommands = "set A1 text t ticked-by-macro";
  SC.SheetCommandInfo.CmdExtensionCallbacks = {};
  await waitForStatus(
    viewer.sheet,
    "cmdend",
    () => SC.SpreadsheetViewerDoRepeatingMacro(),
    3000,
  );
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("ticked-by-macro");
  expect(viewer.repeatingMacroTimer).toBeNull();
});

test("Repeating macro: LoadSave with interval > 0 schedules a timer; Stop cancels it", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-sched-");
  const host = makeHost("vp-sched-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  const save = buildSave("VPSCHED", [
    { name: "sheet", content: "version:1.5\ncell:A1:t:before-stop\nsheet:c:1:r:1" },
    {
      name: "repeatingmacro",
      content: "99999\nset A1 text t should-not-fire",
    },
  ]);
  viewer.LoadSave(save);
  expect(viewer.repeatingMacroInterval).toBe(99999);
  expect(viewer.repeatingMacroTimer).not.toBeNull();
  SC.SpreadsheetViewerStopRepeatingMacro();
  expect(viewer.repeatingMacroTimer).toBeNull();
});

test("Repeating macro: StopRepeatingMacro prevents the scheduled tick from firing (negative)", async () => {
  const SC = await fresh();
  vi.useFakeTimers();
  try {
    const viewer = new SC.SpreadsheetViewer("vp-stop-");
    const host = makeHost("vp-stop-host");
    SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
    const save = buildSave("VPSTOP", [
      { name: "sheet", content: "version:1.5\ncell:A1:t:initial\nsheet:c:1:r:1" },
      {
        name: "repeatingmacro",
        content: "50\nset A1 text t fired-after-stop",
      },
    ]);
    viewer.LoadSave(save);
    expect(viewer.repeatingMacroTimer).not.toBeNull();
    SC.SpreadsheetViewerStopRepeatingMacro();
    // Advance fake clock past the interval; the cancelled timer must not fire.
    vi.advanceTimersByTime(200);
    expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("initial");
  } finally {
    vi.useRealTimers();
  }
});

test("SpreadsheetViewerStopRepeatingMacro: no timer is a no-op", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-stopnoop-");
  viewer.repeatingMacroTimer = null;
  SC.SpreadsheetViewerStopRepeatingMacro();
  expect(viewer.repeatingMacroTimer).toBeNull();
});

test("SpreadsheetViewerRepeatMacroCommand: numeric interval reschedules; NaN/zero keeps last", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-rmc-");
  const host = makeHost("vp-rmc-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  viewer.repeatingMacroInterval = 60;
  const cmdNum = new SC.Parse("7");
  SC.SpreadsheetViewerRepeatMacroCommand("repeatmacro", null, viewer.sheet, cmdNum, false);
  expect(viewer.repeatingMacroInterval).toBe(7);
  expect(viewer.repeatingMacroTimer).not.toBeNull();
  SC.SpreadsheetViewerStopRepeatingMacro();
  const cmdBad = new SC.Parse("notanumber");
  SC.SpreadsheetViewerRepeatMacroCommand("repeatmacro", null, viewer.sheet, cmdBad, false);
  expect(viewer.repeatingMacroInterval).toBe(7);
  SC.SpreadsheetViewerStopRepeatingMacro();
});

// ---------------------------------------------------------------------------
// V4. SpreadsheetViewerDoButtonCmd
// ---------------------------------------------------------------------------

test("DoButtonCmd: recalc updates the viewer cell and blurs the button", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dbc-");
  const host = makeHost("vp-dbc-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  await scheduleCommands(SC, viewer.sheet, "set A1 formula 1+1");
  const btn = document.createElement("input");
  const btnExt = btn as unknown as { blur: () => void };
  let blurred = false;
  btnExt.blur = () => {
    blurred = true;
  };
  const pending = waitEditor(viewer.editor);
  SC.SpreadsheetViewerDoButtonCmd(fakeEvent(btn), null, {
    element: btn,
    functionobj: { command: "recalc" },
  });
  await pending;
  await recalcSheet(SC, viewer.sheet);
  expect(viewer.sheet.GetAssuredCell("A1").formula).toBe("1+1");
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe(2);
  expect(blurred).toBe(true);
});

// ---------------------------------------------------------------------------
// V5. LocalizeString / LocalizeSubstrings
// ---------------------------------------------------------------------------

test("LocalizeString: missing constant falls back to input and caches it", async () => {
  const SC = await fresh();
  const result = SC.LocalizeString("New");
  expect(result).toBe("New");
  expect(SC.LocalizeStringList["New"]).toBe("New");
  expect(SC.LocalizeString("New")).toBe(result);
});

test("LocalizeString: spaces become _ and special chars become X in constant name", async () => {
  const SC = await fresh();
  delete SC.LocalizeStringList["A & B"];
  SC.Constants.s_loc_a_X_b = "Localized A and B";
  try {
    expect(SC.LocalizeString("A & B")).toBe("Localized A and B");
  } finally {
    delete SC.Constants.s_loc_a_X_b;
    delete SC.LocalizeStringList["A & B"];
  }
});

test("LocalizeSubstrings: %loc! fallback and %ssc! resolve a real constant", async () => {
  const SC = await fresh();
  expect(SC.LocalizeSubstrings("Before %loc!Edit! After")).toBe("Before Edit After");
  expect(SC.LocalizeSubstrings("%ssc!defaultImagePrefix!")).toBe(SC.Constants.defaultImagePrefix);
  expect(SC.LocalizeSubstrings("plain text only")).toBe("plain text only");
});

test("LocalizeSubstrings: missing %ssc! constant calls alert and yields 'undefined'", async () => {
  const SC = await fresh();
  const calls: string[] = [];
  const origAlert = globalThis.alert;
  globalThis.alert = (msg: unknown) => {
    calls.push(typeof msg === "string" ? msg : String(msg));
  };
  try {
    const result = SC.LocalizeSubstrings("%ssc!no_such_constant_xyz! end");
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("no_such_constant_xyz");
    expect(result).toContain("undefined");
    expect(result).toContain(" end");
  } finally {
    globalThis.alert = origAlert;
  }
});

// ---------------------------------------------------------------------------
// V6. GetSpreadsheetViewerObject
// ---------------------------------------------------------------------------

test("GetSpreadsheetViewerObject: returns current viewer, throws when none", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-gsvo-");
  expect(SC.GetSpreadsheetViewerObject()).toBe(viewer);
  SC.CurrentSpreadsheetViewerObject = null;
  expect(() => SC.GetSpreadsheetViewerObject()).toThrow("No current SpreadsheetViewer");
  const viewer2 = new SC.SpreadsheetViewer("vp-gsvo-restore-");
  expect(SC.CurrentSpreadsheetViewerObject).toBe(viewer2);
  expect(SC.GetSpreadsheetViewerObject()).toBe(viewer2);
});

// ---------------------------------------------------------------------------
// V7. DoOnResize / SizeSSDiv branches
// ---------------------------------------------------------------------------

test("SizeSSDiv: requested height/width present uses them and returns true on change", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-ssd-");
  const host = makeHost("vp-ssd-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  viewer.requestedHeight = 250;
  viewer.requestedWidth = 350;
  const resized = SC.SizeSSDiv(viewer);
  expect(resized).toBe(true);
  expect(viewer.height).toBe(250);
  expect(viewer.width).toBe(350);
  expect(viewer.spreadsheetDiv!.style.height).toBe("250px");
  expect(viewer.spreadsheetDiv!.style.width).toBe("350px");
});

test("SizeSSDiv: unchanged values return false", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-ssd2-");
  const host = makeHost("vp-ssd2-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  expect(SC.SizeSSDiv(viewer)).toBe(false);
  expect(viewer.height).toBe(300);
  expect(viewer.width).toBe(400);
});

test("SizeSSDiv: auto-compute from viewport when requestedHeight/Width are 0", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-ssd3-");
  const host = makeHost("vp-ssd3-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 0, 0, 20);
  expect(viewer.height).toBe(690);
  expect(viewer.width).toBe(1270);
});

test("SizeSSDiv: parent margins adjust position and shrink computed size", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-ssd4-");
  const host = makeHost("vp-ssd4-host");
  host.style.marginTop = "5px";
  host.style.marginBottom = "3px";
  host.style.marginLeft = "2px";
  host.style.marginRight = "4px";
  SC.InitializeSpreadsheetViewer(viewer, host, 0, 0, 20);
  expect(viewer.height).toBe(682);
  expect(viewer.width).toBe(1264);
});

test("SizeSSDiv: requestedWidth 0 with viewport width <= fudge falls back to 700", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-ssd5-");
  const host = makeHost("vp-ssd5-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 200, 400, 20);
  const g = globalThis as unknown as { innerWidth: number };
  const origW = g.innerWidth;
  g.innerWidth = 10;
  try {
    viewer.requestedWidth = 0;
    const resized = SC.SizeSSDiv(viewer);
    expect(resized).toBe(true);
    expect(viewer.width).toBe(700);
    expect(viewer.spreadsheetDiv!.style.width).toBe("700px");
  } finally {
    g.innerWidth = origW;
  }
});

test("SizeSSDiv: returns false when parentNode is null (uninitialized viewer)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-ssd6-");
  expect(SC.SizeSSDiv(viewer)).toBe(false);
});

test("DoOnResize: needresize=true updates view elements and calls ResizeTableEditor", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dor-");
  const host = makeHost("vp-dor-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  const viewEl = document.createElement("div");
  const viewerExt = viewer as unknown as { views: Record<string, { element: HTMLElement }> };
  viewerExt.views = { v1: { element: viewEl } };
  let resizeCalls = 0;
  let lastW = 0;
  let lastH = 0;
  const origResize = viewer.editor.ResizeTableEditor.bind(viewer.editor);
  const editorExt = viewer.editor as unknown as { ResizeTableEditor: (width: number, height: number) => void };
  editorExt.ResizeTableEditor = (w: number, h: number) => {
    resizeCalls++;
    lastW = w;
    lastH = h;
  };
  try {
    viewer.requestedHeight = 500;
    viewer.requestedWidth = 600;
    SC.DoOnResize(viewer);
  } finally {
    editorExt.ResizeTableEditor = origResize;
  }
  expect(resizeCalls).toBe(1);
  expect(lastW).toBe(600);
  expect(lastH).toBe(500 - viewer.nonviewheight);
  expect(viewEl.style.width).toBe("600px");
  expect(viewEl.style.height).toBe(`${500 - viewer.nonviewheight}px`);
});

test("DoOnResize: no-change early-returns without resizing", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dor2-");
  const host = makeHost("vp-dor2-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  let resizeCalls = 0;
  const origResize = viewer.editor.ResizeTableEditor.bind(viewer.editor);
  const editorExt = viewer.editor as unknown as { ResizeTableEditor: (width: number, height: number) => void };
  editorExt.ResizeTableEditor = () => {
    resizeCalls++;
  };
  try {
    SC.DoOnResize(viewer);
  } finally {
    editorExt.ResizeTableEditor = origResize;
  }
  expect(resizeCalls).toBe(0);
});

test("DoOnResize: _app mode skips ResizeTableEditor (app-scroll branch)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dor3-");
  const host = makeHost("vp-dor3-host");
  SC._app = true;
  try {
    SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
    const viewEl = document.createElement("div");
    const viewerExt = viewer as unknown as { views: Record<string, { element: HTMLElement }> };
    viewerExt.views = { v1: { element: viewEl } };
    let resizeCalls = 0;
    const origResize = viewer.editor.ResizeTableEditor.bind(viewer.editor);
    const editorExt = viewer.editor as unknown as { ResizeTableEditor: (width: number, height: number) => void };
    editorExt.ResizeTableEditor = () => {
      resizeCalls++;
    };
    try {
      viewer.requestedHeight = 500;
      viewer.requestedWidth = 600;
      SC.DoOnResize(viewer);
    } finally {
      editorExt.ResizeTableEditor = origResize;
    }
    expect(resizeCalls).toBe(0);
    expect(viewEl.style.width).toBe("600px");
  } finally {
    SC._app = undefined;
  }
});

// ---------------------------------------------------------------------------
// V8. SpreadsheetViewerStatuslineCallback
// ---------------------------------------------------------------------------

test("StatuslineCallback: statuslineFull=true writes GetStatuslineString result", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-slc-");
  const host = makeHost("vp-slc-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  const params = { spreadsheetobj: viewer };
  SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, params);
  expect(viewer.statuslineDiv!.innerHTML).not.toBe("");
  for (const status of ["cmdendnorender", "calcfinished", "doneposcalc", "cmdend"]) {
    SC.SpreadsheetViewerStatuslineCallback(viewer.editor, status, null, params);
  }
  expect(viewer.statuslineDiv!.innerHTML).not.toBe("");
});

test("StatuslineCallback: statuslineFull=false writes the ecell coord", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-slc2-");
  const host = makeHost("vp-slc2-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  viewer.statuslineFull = false;
  viewer.editor.ecell = { coord: "C7", row: 7, col: 3 };
  const params = { spreadsheetobj: viewer };
  SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, params);
  expect(viewer.statuslineDiv!.innerHTML).toContain("C7");
});

test("StatuslineCallback: no spreadsheetobj in params skips inner block", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-slc3-");
  const host = makeHost("vp-slc3-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  const before = viewer.statuslineDiv!.innerHTML;
  SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, {});
  expect(viewer.statuslineDiv!.innerHTML).toBe(before);
});

test("StatuslineCallback: spreadsheet with no statuslineDiv skips inner block", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-slc4-");
  const host = makeHost("vp-slc4-host");
  SC.InitializeSpreadsheetViewer(viewer, host, 300, 400, 20);
  const viewerNoSl = new SC.SpreadsheetViewer("vp-slc4b-");
  viewerNoSl.statuslineDiv = null;
  const params = { spreadsheetobj: viewerNoSl };
  SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, params);
  expect(viewerNoSl.statuslineDiv).toBeNull();
});

// ---------------------------------------------------------------------------
// V9. CmdGotFocus
// ---------------------------------------------------------------------------

test("CmdGotFocus: sets Keyboard.passThru to the element, true, or null", async () => {
  const SC = await fresh();
  SC.CmdGotFocus(null);
  expect(SC.Keyboard.passThru).toBeNull();
  SC.CmdGotFocus(true);
  expect(SC.Keyboard.passThru).toBe(true);
  const ele = document.createElement("input");
  SC.CmdGotFocus(ele);
  expect(SC.Keyboard.passThru).toBe(ele);
});

// ---------------------------------------------------------------------------
// V10. SpreadsheetViewerCreateSheetHTML — Playwright-only (see note)
// ---------------------------------------------------------------------------

// Playwright-only: SpreadsheetViewerCreateSheetHTML's body is
// `div.appendChild(context.RenderSheet(...)); return div.innerHTML;`. The
// fake-DOM shim's innerHTML mini-parser handles the SET direction (HTML
// string → DOM) but does not serialize on the GET direction, so the
// returned string is always "" under the fake DOM and a substring
// assertion on real cell content would be vacuous. The function's
// invocation path is already code-covered by test/popup-viewer-coverage
// .test.ts. Asserting that the returned HTML reflects seeded cell content
// (RenderSheet → serialized <table> with the cell's text node) belongs in
// a real-browser Playwright integration test against the shipping bundle.

// ---------------------------------------------------------------------------
// V11. SpreadsheetViewerDecodeSpreadsheetSave
// ---------------------------------------------------------------------------

test("DecodeSpreadsheetSave: well-formed multi-part save yields correct start/end offsets", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec-");
  const save = buildSave("VPDEC", [
    { name: "sheet", content: "version:1.5\ncell:A1:t:dec\nsheet:c:1:r:1" },
    { name: "edit", content: "version:1.0\necell:A1\n" },
  ]);
  const parts = SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, save);
  expect(Object.keys(parts).sort()).toEqual(["edit", "sheet"]);
  const sheetSlice = save.substring(parts.sheet.start, parts.sheet.end);
  expect(sheetSlice).toContain("cell:A1:t:dec");
  expect(sheetSlice).not.toContain("ecell:A1");
  const editSlice = save.substring(parts.edit.start, parts.edit.end);
  expect(editSlice).toContain("ecell:A1");
  expect(editSlice).not.toContain("cell:A1:t:dec");
});

test("DecodeSpreadsheetSave: unrecognized header line is skipped (default switch case)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec2-");
  const boundary = "VPDEC2";
  const lines = [
    "socialcalc:version:1.0",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    `--${boundary}`,
    "Content-type: text/plain; charset=UTF-8",
    "",
    "version:1.0",
    "part:sheet",
    "comment:ignored-line",
    `--${boundary}`,
    "Content-type: text/plain; charset=UTF-8",
    "",
    "version:1.5",
    "cell:A1:t:dec2",
    "sheet:c:1:r:1",
    `--${boundary}--`,
    "",
  ];
  const save = makeSave(lines);
  const parts = SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, save);
  expect(Object.keys(parts)).toEqual(["sheet"]);
  expect(save.substring(parts.sheet.start, parts.sheet.end)).toContain("cell:A1:t:dec2");
});

test("DecodeSpreadsheetSave: empty string returns empty parts", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec3-");
  expect(SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, "")).toEqual({});
});

test("DecodeSpreadsheetSave: no MIME-Version header returns empty parts", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec4-");
  expect(SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, "not a save")).toEqual({});
});

test("DecodeSpreadsheetSave: MIME-Version present but no Content-Type boundary returns empty parts", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec5-");
  expect(SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, "MIME-Version: 1.0\nhello\n")).toEqual({});
});

test("DecodeSpreadsheetSave: boundary declared but no top boundary line returns empty parts", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec6-");
  const noTop = makeSave([
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=XX",
    "",
  ]);
  expect(SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, noTop)).toEqual({});
});

test("DecodeSpreadsheetSave: CR-only line endings exercise the normalize branch, then miss MIME-Version", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec7-");
  const withCR = "MIME-Version: 1.0\rnotamultipart\r";
  expect(SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, withCR)).toEqual({});
});

test("DecodeSpreadsheetSave: top boundary present but no blank line after it returns empty parts", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer("vp-dec8-");
  const noBlank = makeSave([
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=BB",
    "--BB",
    "Content-type: text/plain; charset=UTF-8",
    "version:1.0",
    "part:sheet",
    "--BB--",
    "",
  ]);
  expect(SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, noBlank)).toEqual({});
});

// Playwright-only note: DecodeSpreadsheetSave's deeper parse-failure branches
// (e.g. a part with no terminating boundary, or a multi-part save where the
// header declares `part:` but the matching part body's blank-line scan fails
// partway) require a real multipart body whose byte offsets exercise the
// mid-loop `if (!searchinfo) return parts` returns. The synthetic strings
// above reach the early-return branches; the mid-loop partial-parse returns
// are not exercised under the fake DOM because the formatter helper
// (buildSave) always emits well-formed terminators — driving a real partial
// body would belong in a Playwright integration test against the shipping
// bundle.


// ===========================================================================
// CONTROL TESTS — js/socialcalcspreadsheetcontrol.ts
// ===========================================================================

// ---------------------------------------------------------------------------
// C1. SpreadsheetControlDecodeSpreadsheetSave
// ---------------------------------------------------------------------------

test("Control DecodeSpreadsheetSave: well-formed multi-part save yields correct offsets", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-dec-");
  const save = buildSave("CTRLDEC", [
    { name: "sheet", content: "version:1.5\ncell:A1:t:ctrl-dec\nsheet:c:1:r:1" },
    { name: "edit", content: "version:1.0\necell:A1\n" },
  ]);
  const parts = SC.SpreadsheetControlDecodeSpreadsheetSave(control, save);
  expect(Object.keys(parts).sort()).toEqual(["edit", "sheet"]);
  const sheetSlice = save.substring(parts.sheet.start, parts.sheet.end);
  expect(sheetSlice).toContain("cell:A1:t:ctrl-dec");
  const editSlice = save.substring(parts.edit.start, parts.edit.end);
  expect(editSlice).toContain("ecell:A1");
});

test("Control DecodeSpreadsheetSave: empty string returns empty parts", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-dec2-");
  expect(SC.SpreadsheetControlDecodeSpreadsheetSave(control, "")).toEqual({});
});

test("Control DecodeSpreadsheetSave: no MIME-Version returns empty parts", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-dec3-");
  expect(SC.SpreadsheetControlDecodeSpreadsheetSave(control, "not a save")).toEqual({});
});

test("Control DecodeSpreadsheetSave: MIME-Version but no Content-Type boundary returns empty parts", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-dec4-");
  expect(SC.SpreadsheetControlDecodeSpreadsheetSave(control, "MIME-Version: 1.0\nhello\n")).toEqual({});
});

test("Control DecodeSpreadsheetSave: boundary declared but no top boundary line returns empty parts", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-dec5-");
  const noTop = makeSave([
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=XX",
    "",
  ]);
  expect(SC.SpreadsheetControlDecodeSpreadsheetSave(control, noTop)).toEqual({});
});

test("Control DecodeSpreadsheetSave: CR-only line endings exercise normalize branch", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-dec6-");
  const withCR = "MIME-Version: 1.0\rnotamultipart\r";
  expect(SC.SpreadsheetControlDecodeSpreadsheetSave(control, withCR)).toEqual({});
});

// ---------------------------------------------------------------------------
// C2. GetFunctionNamesStr / GetFunctionInfoStr
// ---------------------------------------------------------------------------

test("GetFunctionNamesStr: returns option HTML for 'all' category with first selected", async () => {
  const SC = await fresh();
  newControl(SC, "ctrl-fn-");
  SC.Formula.FillFunctionInfo();
  const functionClasses = SC.Formula.FunctionClasses;
  if (!functionClasses) throw new Error("function metadata unavailable");
  const all = functionClasses["all"];
  const html = SC.SpreadsheetControl.GetFunctionNamesStr("all");
  const optionCount = (html.match(/<option/g) || []).length;
  expect(optionCount).toBe(all.items.length);
  expect(html).toContain(
    '<option value="' + all.items[0] + '" selected>' + all.items[0] + "</option>",
  );
});

test("GetFunctionNamesStr: named category returns only that category's functions", async () => {
  const SC = await fresh();
  newControl(SC, "ctrl-fn2-");
  SC.Formula.FillFunctionInfo();
  const fcl = SC.Constants.function_classlist;
  const functionClasses = SC.Formula.FunctionClasses;
  if (!functionClasses) throw new Error("function metadata unavailable");
  // fcl[0] is "all"; use the first genuinely named (non-"all") category so
  // this test actually exercises category scoping instead of duplicating
  // the "all" case covered by the previous test.
  const namedCategory = fcl[1];
  const all = functionClasses["all"];
  const cls = functionClasses[namedCategory];
  const html = SC.SpreadsheetControl.GetFunctionNamesStr(namedCategory);
  const optionCount = (html.match(/<option/g) || []).length;
  expect(optionCount).toBe(cls.items.length);
  expect(html).toContain(
    '<option value="' + cls.items[0] + '" selected>' + cls.items[0] + "</option>",
  );
  // A function present in "all" but absent from this category proves the
  // list is genuinely scoped, not just non-empty.
  const excludedFn = all.items.find((fn: string) => !cls.items.includes(fn));
  if (!excludedFn) throw new Error("category unexpectedly covers every function");
  expect(html).not.toContain('value="' + excludedFn + '"');
});

test("GetFunctionInfoStr: returns bold function name with arg string and description", async () => {
  const SC = await fresh();
  SC.Formula.FillFunctionInfo();
  const fcl = SC.Constants.function_classlist;
  const functionClasses = SC.Formula.FunctionClasses;
  if (!fcl || !functionClasses) throw new Error("function metadata unavailable");
  const firstFn = functionClasses[fcl[0]].items[0];
  const argString = SC.Formula.FunctionArgString(firstFn);
  const description = SC.Formula.FunctionList[firstFn][3];
  const html = SC.SpreadsheetControl.GetFunctionInfoStr(firstFn);
  expect(html).toContain("<b>" + firstFn + "(" + argString + ")</b>");
  expect(html).toContain("<br>");
  expect(html).toContain(description);
});

// ---------------------------------------------------------------------------
// C3. DoSum
// ---------------------------------------------------------------------------

test("DoSum: with range produces sum formula for the range", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sum-");
  // Seed some numeric values
  await scheduleCommands(SC, control.sheet, ["set A1 value n 10", "set A2 value n 20", "set A3 value n 30"]);
  // Pin the source-cell types used by DoSum's row/range walk.
  for (const [coord, value] of [["A1", 10], ["A2", 20], ["A3", 30]] as const) {
    const cell = control.sheet.GetAssuredCell(coord);
    cell.datatype = "v";
    cell.valuetype = "n";
    cell.datavalue = value;
  }
  control.editor.busy = false;
  control.editor.range.hasrange = true;
  control.editor.range.left = 1;
  control.editor.range.right = 1;
  control.editor.range.top = 1;
  control.editor.range.bottom = 3;
  await waitForStatus(control.sheet, "cmdend", () => SC.SpreadsheetControl.DoSum(), 3000);
  await recalcSheet(SC, control.sheet);
  const a4 = control.sheet.GetAssuredCell("A4");
  expect(a4.datatype).toBe("f");
  expect(a4.valuetype).toBe("n");
  expect(a4.formula).toContain("sum(A1:A3)");
  expect(a4.datavalue).toBe(60);
});

test("DoSum: without range scans upward for contiguous numeric cells", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sum2-");
  await scheduleCommands(SC, control.sheet, ["set A1 value n 5", "set A2 value n 15"]);
  for (const [coord, value] of [["A1", 5], ["A2", 15]] as const) {
    const cell = control.sheet.GetAssuredCell(coord);
    cell.datatype = "v";
    cell.valuetype = "n";
    cell.datavalue = value;
  }
  control.editor.ecell = { coord: "A3", row: 3, col: 1 };
  control.editor.range.hasrange = false;
  control.editor.busy = false;
  await waitForStatus(control.sheet, "cmdend", () => SC.SpreadsheetControl.DoSum(), 3000);
  await recalcSheet(SC, control.sheet);
  const a3 = control.sheet.GetAssuredCell("A3");
  expect(a3.datatype).toBe("f");
  expect(a3.valuetype).toBe("n");
  expect(a3.formula).toContain("sum(A1:A2)");
  expect(a3.datavalue).toBe(20);
});

test("DoSum: row 1 with no range produces #REF! error", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sum3-");
  // ecell at A1, row=1 → the production command writes an error constant.
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  control.editor.range.hasrange = false;
  control.editor.busy = false;
  const p = waitEditor(control.editor);
  SC.SpreadsheetControl.DoSum();
  await p;
  const a1 = control.sheet.GetAssuredCell("A1");
  expect(a1.datatype).toBe("c");
  expect(a1.displaystring).toBe("#REF!");
  expect(a1.errors).toBe("#REF!");
});

// ---------------------------------------------------------------------------
// C4. SearchSheet / SearchUp / SearchDown
// ---------------------------------------------------------------------------

test("SearchSheet: empty search_cells returns early without error", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-search-");
  control.sheet.search_cells = [];
  control.sheet.selected_search_cell = undefined;
  SC.SpreadsheetControl.SearchSheet(0);
  SC.SpreadsheetControl.SearchSheet(1);
  expect(control.sheet.search_cells).toEqual([]);
  expect(control.sheet.selected_search_cell).toBeUndefined();
});

test("SearchSheet: direction=0 wraps from first to last; direction=1 wraps from last to first", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-search2-");
  // Seed three search cells
  control.sheet.search_cells = ["A1", "B2", "C3"];
  // Seed the DOM searchstatus element
  const ss = document.createElement("div");
  ss.id = "searchstatus";
  document.body.appendChild(ss);
  // At index 0, direction=0 (up) wraps to last
  control.sheet.selected_search_cell = 0;
  SC.SpreadsheetControl.SearchUp();
  expect(control.sheet.selected_search_cell).toBe(2);
  // At last, direction=1 (down) wraps to first
  control.sheet.selected_search_cell = 2;
  SC.SpreadsheetControl.SearchDown();
  expect(control.sheet.selected_search_cell).toBe(0);
  // Normal increment: 0 → 1
  control.sheet.selected_search_cell = 0;
  SC.SpreadsheetControl.SearchDown();
  expect(control.sheet.selected_search_cell).toBe(1);
  // Normal decrement: 1 → 0
  control.sheet.selected_search_cell = 1;
  SC.SpreadsheetControl.SearchUp();
  expect(control.sheet.selected_search_cell).toBe(0);
});

// ---------------------------------------------------------------------------
// C5. SortOnclick / UpdateSortRangeProposal
// ---------------------------------------------------------------------------

test("SortOnclick: populates sortlist with named ranges and calls LoadColumnChoosers", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sort-");
  // Define a named range so the namelist loop has content
  await execAndWait(control, "name define myrange A1:B3");
  // Seed the sortlist <select> element
  const sl = seedSelect(control.idPrefix + "sortlist", []);
  // Seed the majorsort/minorsort/lastsort selects for LoadColumnChoosers
  seedSelect(control.idPrefix + "majorsort", []);
  seedSelect(control.idPrefix + "minorsort", []);
  seedSelect(control.idPrefix + "lastsort", []);
  control.sortrange = "";
  SC.SpreadsheetControlSortOnclick(control, "sort");
  // sortlist should have [select range] and Sort All options
  expect(sl.options.length).toBeGreaterThanOrEqual(2);
});

test("UpdateSortRangeProposal: with range writes coord range to option[0].text", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sort2-");
  const sl = seedSelect(control.idPrefix + "sortlist", ["placeholder"]);
  control.editor.range.hasrange = true;
  control.editor.range.left = 1;
  control.editor.range.right = 2;
  control.editor.range.top = 1;
  control.editor.range.bottom = 3;
  SC.UpdateSortRangeProposal(control.editor);
  expect(sl.options[0].text).toBe("A1:B3");
});

test("UpdateSortRangeProposal: without range writes [select range] to option[0].text", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sort3-");
  const sl = seedSelect(control.idPrefix + "sortlist", ["placeholder"]);
  control.editor.range.hasrange = false;
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.UpdateSortRangeProposal(control.editor);
  expect(sl.options[0].text).toContain("select range");
});

// ---------------------------------------------------------------------------
// C6. LoadColumnChoosers
// ---------------------------------------------------------------------------

test("LoadColumnChoosers: populates major/minor/last sort selects with column names", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-lcc-");
  control.sortrange = "A1:C3";
  const major = seedSelect(control.idPrefix + "majorsort", []);
  const minor = seedSelect(control.idPrefix + "minorsort", []);
  const last = seedSelect(control.idPrefix + "lastsort", []);
  SC.LoadColumnChoosers(control);
  // Each select should have [None] + Column A, B, C (major) or A, B, C (minor/last)
  expect(major.options.length).toBe(4); // [None] + 3 columns
  expect(minor.options.length).toBe(4);
  expect(last.options.length).toBe(4);
});

test("LoadColumnChoosers: named range sortrange resolves to range", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-lcc2-");
  // Define a named range
  await execAndWait(control, "name define myrange A1:B2");
  control.sortrange = "myrange";
  const major = seedSelect(control.idPrefix + "majorsort", []);
  seedSelect(control.idPrefix + "minorsort", []);
  seedSelect(control.idPrefix + "lastsort", []);
  SC.LoadColumnChoosers(control);
  expect(major.options.length).toBe(3); // [None] + 2 columns (A, B)
});

// ---------------------------------------------------------------------------
// C7. Comment family
// ---------------------------------------------------------------------------

test("CommentDisplay: writes existing cell comment to commenttext element", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-cmt-");
  await execAndWait(control, "set A1 comment hello-comment");
  const ct = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  ct.id = control.idPrefix + "commenttext";
  (ct as unknown as { value: string }).value = "";
  document.body.appendChild(ct);
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.SpreadsheetControlCommentDisplay(control, "comment");
  expect((ct as unknown as { value: string }).value).toBe("hello-comment");
});

test("CommentDisplay: empty cell writes empty string to commenttext element", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-cmt2-");
  const ct = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  ct.id = control.idPrefix + "commenttext";
  (ct as unknown as { value: string }).value = "stale";
  document.body.appendChild(ct);
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.SpreadsheetControlCommentDisplay(control, "comment");
  expect((ct as unknown as { value: string }).value).toBe("");
});

test("CommentSet: executes set comment command with encoded value", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-cmt3-");
  const ct = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  ct.id = control.idPrefix + "commenttext";
  (ct as unknown as { value: string }).value = "new comment text";
  document.body.appendChild(ct);
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  const p = waitEditor(control.editor);
  SC.SpreadsheetControlCommentSet();
  await p;
  const cell = control.sheet.GetAssuredCell("A1");
  expect(cell.comment).toBe("new comment text");
});

test("CommentOnclick: sets MoveECellCallback and calls CommentDisplay", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-cmt4-");
  const ct = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  ct.id = control.idPrefix + "commenttext";
  (ct as unknown as { value: string }).value = "";
  document.body.appendChild(ct);
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.SpreadsheetControlCommentOnclick(control, "comment");
  expect(control.editor.MoveECellCallback.comment).toBeDefined();
  expect((ct as unknown as { value: string }).value).toBe(""); // no comment yet
  // Clean up callback
  SC.SpreadsheetControlCommentOnunclick(control, "comment");
  expect(control.editor.MoveECellCallback.comment).toBeUndefined();
});

// ---------------------------------------------------------------------------
// C8. Names family
// ---------------------------------------------------------------------------

test("NamesOnclick: clears name/desc/value and fills name list", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names-");
  await execAndWait(control, "name define myrange A1:B3");
  // Seed the DOM elements NamesOnclick touches
  const nn = document.createElement("input") as unknown as HTMLInputElement;
  nn.id = control.idPrefix + "namesname";
  (nn as unknown as { value: string }).value = "stale";
  document.body.appendChild(nn);
  const nd = document.createElement("input") as unknown as HTMLInputElement;
  nd.id = control.idPrefix + "namesdesc";
  (nd as unknown as { value: string }).value = "stale";
  document.body.appendChild(nd);
  const nv = document.createElement("input") as unknown as HTMLInputElement;
  nv.id = control.idPrefix + "namesvalue";
  (nv as unknown as { value: string }).value = "stale";
  document.body.appendChild(nv);
  const nl = seedSelect(control.idPrefix + "nameslist", []);
  const nrp = document.createElement("input") as unknown as HTMLInputElement;
  nrp.id = control.idPrefix + "namesrangeproposal";
  document.body.appendChild(nrp);
  SC.SpreadsheetControlNamesOnclick(control, "names");
  expect((nn as unknown as { value: string }).value).toBe("");
  expect((nd as unknown as { value: string }).value).toBe("");
  expect((nv as unknown as { value: string }).value).toBe("");
  // nameslist should have [New] + myrange
  expect(nl.options.length).toBe(2);
});

test("NamesChangedName: selecting existing name fills name/desc/value fields", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names2-");
  control.sheet.names.myrange = { definition: "A1:B3", desc: "my description" };
  const nn = document.createElement("input") as unknown as HTMLInputElement;
  nn.id = control.idPrefix + "namesname";
  (nn as unknown as { value: string }).value = "";
  document.body.appendChild(nn);
  const nd = document.createElement("input") as unknown as HTMLInputElement;
  nd.id = control.idPrefix + "namesdesc";
  (nd as unknown as { value: string }).value = "";
  document.body.appendChild(nd);
  const nv = document.createElement("input") as unknown as HTMLInputElement;
  nv.id = control.idPrefix + "namesvalue";
  (nv as unknown as { value: string }).value = "";
  document.body.appendChild(nv);
  seedSelect(control.idPrefix + "nameslist", ["[New]", "myrange"], 1);
  SC.SpreadsheetControlNamesChangedName();
  expect((nn as unknown as { value: string }).value).toBe("myrange");
  expect((nd as unknown as { value: string }).value).toBe("my description");
  expect((nv as unknown as { value: string }).value).toContain("A1:B3");
});

test("NamesChangedName: selecting [New] clears fields", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names3-");
  const nn = document.createElement("input") as unknown as HTMLInputElement;
  nn.id = control.idPrefix + "namesname";
  (nn as unknown as { value: string }).value = "stale";
  document.body.appendChild(nn);
  const nd = document.createElement("input") as unknown as HTMLInputElement;
  nd.id = control.idPrefix + "namesdesc";
  (nd as unknown as { value: string }).value = "stale";
  document.body.appendChild(nd);
  const nv = document.createElement("input") as unknown as HTMLInputElement;
  nv.id = control.idPrefix + "namesvalue";
  (nv as unknown as { value: string }).value = "stale";
  document.body.appendChild(nv);
  seedSelect(control.idPrefix + "nameslist", ["[New]"], 0);
  SC.SpreadsheetControlNamesChangedName();
  expect((nn as unknown as { value: string }).value).toBe("");
  expect((nd as unknown as { value: string }).value).toBe("");
  expect((nv as unknown as { value: string }).value).toBe("");
});

test("NamesSetValue: copies rangeproposal to value field", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names4-");
  const nv = document.createElement("input") as unknown as HTMLInputElement;
  nv.id = control.idPrefix + "namesvalue";
  (nv as unknown as { value: string }).value = "";
  document.body.appendChild(nv);
  const nrp = document.createElement("input") as unknown as HTMLInputElement;
  nrp.id = control.idPrefix + "namesrangeproposal";
  (nrp as unknown as { value: string }).value = "C3:D5";
  document.body.appendChild(nrp);
  SC.SpreadsheetControlNamesSetValue();
  expect((nv as unknown as { value: string }).value).toBe("C3:D5");
});

test("NamesSave: creates the named range and description for the consumer", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names5-");
  SC.SetSpreadsheetControlObject(control);
  const nn = document.createElement("input") as unknown as HTMLInputElement;
  nn.id = control.idPrefix + "namesname";
  (nn as unknown as { value: string }).value = "newrange";
  document.body.appendChild(nn);
  const nd = document.createElement("input") as unknown as HTMLInputElement;
  nd.id = control.idPrefix + "namesdesc";
  (nd as unknown as { value: string }).value = "test desc";
  document.body.appendChild(nd);
  const nv = document.createElement("input") as unknown as HTMLInputElement;
  nv.id = control.idPrefix + "namesvalue";
  (nv as unknown as { value: string }).value = "A1:B2";
  document.body.appendChild(nv);
  control.editor.busy = false;
  await waitForStatus(control.sheet, "cmdend", () => SC.SpreadsheetControlNamesSave(), 3000);
  expect(control.sheet.names.NEWRANGE.definition).toBe("A1:B2");
  expect(control.sheet.names.NEWRANGE.desc).toBe("test desc");
});

test("NamesDelete: removes the selected named range from the sheet", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names6-");
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, "name define todelete A1");
  const nn = document.createElement("input") as unknown as HTMLInputElement;
  nn.id = control.idPrefix + "namesname";
  (nn as unknown as { value: string }).value = "todelete";
  control.editor.busy = false;
  document.body.appendChild(nn);
  await waitForStatus(control.sheet, "cmdend", () => SC.SpreadsheetControlNamesDelete(), 3000);
  expect(control.sheet.names.TODELETE).toBeUndefined();
});

test("NamesRangeChange: with range writes range to rangeproposal element", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names7-");
  const nrp = document.createElement("input") as unknown as HTMLInputElement;
  nrp.id = control.idPrefix + "namesrangeproposal";
  (nrp as unknown as { value: string }).value = "";
  document.body.appendChild(nrp);
  control.editor.range.hasrange = true;
  control.editor.range.left = 1;
  control.editor.range.right = 3;
  control.editor.range.top = 1;
  control.editor.range.bottom = 5;
  SC.SpreadsheetControlNamesRangeChange(control.editor);
  expect((nrp as unknown as { value: string }).value).toBe("A1:C5");
});

test("NamesRangeChange: without range writes ecell coord to rangeproposal element", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-names8-");
  const nrp = document.createElement("input") as unknown as HTMLInputElement;
  nrp.id = control.idPrefix + "namesrangeproposal";
  (nrp as unknown as { value: string }).value = "";
  document.body.appendChild(nrp);
  control.editor.range.hasrange = false;
  control.editor.ecell = { coord: "B4", row: 4, col: 2 };
  SC.SpreadsheetControlNamesRangeChange(control.editor);
  expect((nrp as unknown as { value: string }).value).toBe("B4");
});

// ---------------------------------------------------------------------------
// C9. Clipboard family
// ---------------------------------------------------------------------------

test("ClipboardOnclick: sets tab format radio and fills clipboardtext from Clipboard", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-clip-");
  // Seed the clipboard data
  if (!SC.Clipboard) throw new Error("clipboard unavailable");
  SC.Clipboard.clipboard = "version:1.5\ncell:A1:t:clip\nsheet:c:1:r:1";
  const clipText = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  clipText.id = control.idPrefix + "clipboardtext";
  (clipText as unknown as { value: string }).value = "";
  document.body.appendChild(clipText);
  const formatRadio = document.createElement("input") as unknown as HTMLInputElement;
  formatRadio.id = control.idPrefix + "clipboardformat-tab";
  (formatRadio as unknown as { checked: boolean }).checked = false;
  document.body.appendChild(formatRadio);
  SC.SpreadsheetControlClipboardOnclick(control, "clipboard");
  expect((formatRadio as unknown as { checked: boolean }).checked).toBe(true);
  expect((clipText as unknown as { value: string }).value).toContain("clip");
});

test("ClipboardClear: clears text and schedules clearclipboard command", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-clip2-");
  const clipText = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  clipText.id = control.idPrefix + "clipboardtext";
  (clipText as unknown as { value: string }).value = "stale content";
  document.body.appendChild(clipText);
  const p = waitEditor(control.editor);
  SC.SpreadsheetControlClipboardClear();
  await p;
  expect((clipText as unknown as { value: string }).value).toBe("");
});

// ---------------------------------------------------------------------------
// C10. SettingsSwitch / SettingsControlSave
// ---------------------------------------------------------------------------

test("SettingsSwitch: 'sheet' target shows sheet table, hides cell table", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sw-");
  const sheetTable = document.createElement("div");
  sheetTable.id = control.idPrefix + "sheetsettingstable";
  sheetTable.style.display = "none";
  document.body.appendChild(sheetTable);
  const cellTable = document.createElement("div");
  cellTable.id = control.idPrefix + "cellsettingstable";
  cellTable.style.display = "block";
  document.body.appendChild(cellTable);
  const sheetToolbar = document.createElement("div");
  sheetToolbar.id = control.idPrefix + "sheetsettingstoolbar";
  sheetToolbar.style.display = "none";
  document.body.appendChild(sheetToolbar);
  const cellToolbar = document.createElement("div");
  cellToolbar.id = control.idPrefix + "cellsettingstoolbar";
  cellToolbar.style.display = "block";
  document.body.appendChild(cellToolbar);
  // Need views.settings for SettingsControlSetCurrentPanel
  const viewsExt = control as unknown as { views: Record<string, { values: Record<string, unknown> }> };
  viewsExt.views = viewsExt.views || {};
  viewsExt.views.settings = { values: { sheetspanel: {}, cellspanel: {} } };
  SC.SpreadsheetControlSettingsSwitch("sheet");
  expect(sheetTable.style.display).toBe("block");
  expect(cellTable.style.display).toBe("none");
  expect(sheetToolbar.style.display).toBe("block");
  expect(cellToolbar.style.display).toBe("none");
});

test("SettingsSwitch: 'cell' target shows cell table, hides sheet table", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sw2-");
  const sheetTable = document.createElement("div");
  sheetTable.id = control.idPrefix + "sheetsettingstable";
  sheetTable.style.display = "block";
  document.body.appendChild(sheetTable);
  const cellTable = document.createElement("div");
  cellTable.id = control.idPrefix + "cellsettingstable";
  cellTable.style.display = "none";
  document.body.appendChild(cellTable);
  const sheetToolbar = document.createElement("div");
  sheetToolbar.id = control.idPrefix + "sheetsettingstoolbar";
  sheetToolbar.style.display = "block";
  document.body.appendChild(sheetToolbar);
  const cellToolbar = document.createElement("div");
  cellToolbar.id = control.idPrefix + "cellsettingstoolbar";
  cellToolbar.style.display = "none";
  document.body.appendChild(cellToolbar);
  const viewsExt = control as unknown as { views: Record<string, { values: Record<string, unknown> }> };
  viewsExt.views = viewsExt.views || {};
  viewsExt.views.settings = { values: { sheetspanel: {}, cellspanel: {} } };
  SC.SpreadsheetControlSettingsSwitch("cell");
  expect(sheetTable.style.display).toBe("none");
  expect(cellTable.style.display).toBe("block");
  expect(sheetToolbar.style.display).toBe("none");
  expect(cellToolbar.style.display).toBe("block");
});

// ---------------------------------------------------------------------------
// C11. PopupListGetValue / PopupListSetValue
// ---------------------------------------------------------------------------

test("PopupListGetValue: returns {def:true, val:0} when Popup.GetValue returns falsy", async () => {
  const SC = await fresh();
  newControl(SC, "ctrl-pl-");
  // PopupListGetValue reads panelobj[ctrlname].id then calls Popup.GetValue
  // Without a real popup DOM, Popup.GetValue returns null/undefined → def:true
  const panelobj = {
    name: "test",
    mylist: { type: "PopupList", id: "test-list", setting: "testsetting" },
  };
  const result = SC.SettingsControls.PopupListGetValue(panelobj, "mylist");
  expect(result).toEqual({ def: true, val: 0 });
});

test("PopupListSetValue: writes and clears the popup value state", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-pl2-");
  const panelobj = control.views.settings.values.cellspanel;
  SC.SettingsControls.PopupListSetValue(panelobj, "cfontlook", {
    def: false,
    val: "normal bold * *",
  });
  expect(SC.SettingsControls.PopupListGetValue(panelobj, "cfontlook")).toEqual({
    def: false,
    val: "normal bold * *",
  });
  SC.SettingsControls.PopupListSetValue(panelobj, "cfontlook", { def: true, val: 0 });
  expect(SC.SettingsControls.PopupListGetValue(panelobj, "cfontlook")).toEqual({
    def: true,
    val: 0,
  });
});

test("BorderSideGetValue: returns empty value when checkbox is unchecked", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-bs-");
  const idstart = control.idPrefix + "bs";
  const cb = document.createElement("input") as unknown as HTMLInputElement;
  cb.id = idstart + "-onoff-bcb";
  (cb as unknown as { checked: boolean }).checked = false;
  document.body.appendChild(cb);
  const panelobj = {
    name: "test",
    bs: { type: "BorderSide", id: idstart, setting: "bsetting" },
  };
  const result = SC.SettingsControls.BorderSideGetValue(panelobj, "bs");
  expect(result).toEqual({ def: false, val: "" });
});

test("BorderSideGetValue: returns border value when checkbox checked", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-bs2-");
  const idstart = control.idPrefix + "bs2";
  const cb = document.createElement("input") as unknown as HTMLInputElement;
  cb.id = idstart + "-onoff-bcb";
  (cb as unknown as { checked: boolean }).checked = true;
  document.body.appendChild(cb);
  const panelobj = {
    name: "test",
    bs: { type: "BorderSide", id: idstart, setting: "bsetting" },
  };
  const result = SC.SettingsControls.BorderSideGetValue(panelobj, "bs");
  expect(result).toBeDefined();
  if (!result) throw new Error("border value unavailable");
  expect(result.def).toBe(false);
  expect(result.val).toContain("1px solid");
});

test("BorderSideSetValue: null value calls alert and returns", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-bs3-");
  const calls: string[] = [];
  const origAlert = globalThis.alert;
  globalThis.alert = (msg: unknown) => {
    calls.push(typeof msg === "string" ? msg : String(msg));
  };
  try {
    const idstart = control.idPrefix + "bs3";
    const panelobj = {
      name: "test",
      bs: { type: "BorderSide", id: idstart, setting: "bsetting" },
    };
    SC.SettingsControls.BorderSideSetValue(panelobj, "bs", null);
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("no value");
  } finally {
    globalThis.alert = origAlert;
  }
});

test("BorderSideSetValue: with val sets checkbox and color popup", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-bs4-");
  const idstart = control.idPrefix + "bs4";
  const cb = document.createElement("input") as unknown as HTMLInputElement;
  cb.id = idstart + "-onoff-bcb";
  (cb as unknown as { checked: boolean; value: string }).checked = false;
  (cb as unknown as { checked: boolean; value: string }).value = "";
  document.body.appendChild(cb);
  const panelobj = {
    name: "test",
    bs: { type: "BorderSide", id: idstart, setting: "bsetting" },
  };
  SC.SettingsControls.BorderSideSetValue(panelobj, "bs", { def: false, val: "2px solid red" });
  expect((cb as unknown as { checked: boolean }).checked).toBe(true);
  expect((cb as unknown as { value: string }).value).toBe("2px solid red");
});

test("BorderSideSetValue: with empty val unchecks and clears color", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-bs5-");
  const idstart = control.idPrefix + "bs5";
  const cb = document.createElement("input") as unknown as HTMLInputElement;
  cb.id = idstart + "-onoff-bcb";
  (cb as unknown as { checked: boolean; value: string }).checked = true;
  (cb as unknown as { checked: boolean; value: string }).value = "stale";
  document.body.appendChild(cb);
  const panelobj = {
    name: "test",
    bs: { type: "BorderSide", id: idstart, setting: "bsetting" },
  };
  SC.SettingsControls.BorderSideSetValue(panelobj, "bs", { def: false, val: "" });
  expect((cb as unknown as { checked: boolean }).checked).toBe(false);
  expect((cb as unknown as { value: string }).value).toBe("");
});

// ---------------------------------------------------------------------------
// C14. CtrlSEditor
// ---------------------------------------------------------------------------

test("CtrlSEditor: with part name shows that part's content in textarea", async () => {
  const SC = await fresh();
  newControl(SC, "ctrl-se-");
  SC.OtherSaveParts = SC.OtherSaveParts || {};
  SC.OtherSaveParts["mypart"] = "part content here";
  SC.CtrlSEditor("mypart");
  const ta = document.getElementById("socialcalc-editbox-textarea");
  expect(ta).not.toBeNull();
  expect(ta!.firstChild).not.toBeNull();
  expect(ta!.firstChild!.textContent).toContain("part content here");
  // Clean up
  const editbox = document.getElementById("socialcalc-editbox");
  if (editbox && editbox.parentNode) editbox.parentNode.removeChild(editbox);
  delete SC.OtherSaveParts["mypart"];
});

test("CtrlSEditor: with empty string shows listing of all parts", async () => {
  const SC = await fresh();
  newControl(SC, "ctrl-se2-");
  SC.OtherSaveParts = SC.OtherSaveParts || {};
  SC.OtherSaveParts["part1"] = "content1";
  SC.OtherSaveParts["part2"] = "content2";
  SC.CtrlSEditor("");
  const ta = document.getElementById("socialcalc-editbox-textarea");
  expect(ta).not.toBeNull();
  expect(ta!.firstChild).not.toBeNull();
  const listing = ta!.firstChild!.textContent ?? "";
  expect(listing).toContain("Part: part1");
  expect(listing).toContain("content1");
  expect(listing).toContain("Part: part2");
  expect(listing).toContain("content2");
  // Clean up
  const editbox = document.getElementById("socialcalc-editbox");
  if (editbox && editbox.parentNode) editbox.parentNode.removeChild(editbox);
  delete SC.OtherSaveParts["part1"];
  delete SC.OtherSaveParts["part2"];
});

test("CtrlSEditorDone: with text saves to OtherSaveParts; empty text deletes", async () => {
  const SC = await fresh();
  newControl(SC, "ctrl-se3-");
  SC.OtherSaveParts = SC.OtherSaveParts || {};
  SC.OtherSaveParts["editpart"] = "old";
  // Create the editbox and textarea
  SC.CtrlSEditor("editpart");
  const ta = document.getElementById("socialcalc-editbox-textarea") as unknown as HTMLTextAreaElement;
  (ta as unknown as { value: string }).value = "new content";
  SC.CtrlSEditorDone("socialcalc-editbox", "editpart");
  expect(SC.OtherSaveParts["editpart"]).toBe("new content");
  // Now delete it
  SC.CtrlSEditor("editpart");
  const ta2 = document.getElementById("socialcalc-editbox-textarea") as unknown as HTMLTextAreaElement;
  (ta2 as unknown as { value: string }).value = "";
  SC.CtrlSEditorDone("socialcalc-editbox", "editpart");
  expect(SC.OtherSaveParts["editpart"]).toBeUndefined();
});

// ---------------------------------------------------------------------------
// C15. SpreadsheetControlCreateSpreadsheetSave
// ---------------------------------------------------------------------------

test("CreateSpreadsheetSave: produces well-formed multipart save with sheet/edit/audit parts", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-save-");
  await execAndWait(control, "set A1 text t hello");
  const save = SC.SpreadsheetControlCreateSpreadsheetSave(control);
  expect(save).toContain("socialcalc:version:1.0");
  expect(save).toContain("MIME-Version: 1.0");
  expect(save).toContain("part:sheet");
  expect(save).toContain("part:edit");
  expect(save).toContain("part:audit");
  expect(save).toContain("cell:A1");
  expect(save).toContain("hello");
});

test("CreateSpreadsheetSave: with otherparts includes them in the save", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-save2-");
  const save = SC.SpreadsheetControlCreateSpreadsheetSave(control, {
    custom: "custom part content\n",
  });
  expect(save).toContain("part:custom");
  expect(save).toContain("custom part content");
});

test("CreateSpreadsheetSave: otherparts without trailing newline gets one added", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-save3-");
  const save = SC.SpreadsheetControlCreateSpreadsheetSave(control, {
    nonl: "no newline at end",
  });
  expect(save).toContain("no newline at end\n");
});

// ---------------------------------------------------------------------------
// C16. SettingsControlUnloadPanel / SettingsControlLoadPanel
// ---------------------------------------------------------------------------

test("SettingsControlUnloadPanel: iterates panel controls and returns attribs object", async () => {
  const SC = await fresh();
  newControl(SC, "ctrl-unl-");
  const panelobj = {
    name: "test",
    mylist: { type: "PopupList", id: "test-unl-list", setting: "mysetting" },
  };
  const attribs = SC.SettingsControlUnloadPanel(panelobj);
  // PopupListGetValue returns {def:true, val:0} → attribs.mysetting = {def:true, val:0}
  expect(attribs).toEqual({ mysetting: { def: true, val: 0 } });
});

test("SettingsControlLoadPanel: loads values that UnloadPanel exposes to the consumer", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-lp-");
  const panelobj = control.views.settings.values.cellspanel;
  const attribs = control.sheet.EncodeCellAttributes("A1");
  attribs.numberformat = { def: false, val: "0.00" };
  SC.SettingsControlLoadPanel(panelobj, attribs);
  const out = SC.SettingsControlUnloadPanel(panelobj);
  expect(out.numberformat).toEqual({ def: false, val: "0.00" });
});

// ---------------------------------------------------------------------------
// C17. SettingsControlOnchangeBorder
// ---------------------------------------------------------------------------

test("SettingsControlOnchangeBorder: checked checkbox updates border DOM state", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-ocb-");
  const idstart = control.idPrefix + "cbb";
  const cb = document.createElement("input") as unknown as HTMLInputElement;
  cb.id = idstart + "-onoff-bcb";
  const cbState = cb as unknown as { checked: boolean; value: string };
  cbState.checked = true;
  cbState.value = "1px solid blue";
  document.body.appendChild(cb);
  const panelobj = {
    name: "cell",
    cbb: { type: "BorderSide", id: idstart, setting: "bb" },
  };
  SC.SettingsControls.CurrentPanel = panelobj;
  SC.SettingsControlOnchangeBorder(cb);
  expect(cbState.checked).toBe(true);
  expect(cbState.value).toBe("1px solid blue");
});

test("SettingsControlOnchangeBorder: unchecked checkbox clears border DOM state", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-ocb2-");
  const idstart = control.idPrefix + "cbb";
  const cb = document.createElement("input") as unknown as HTMLInputElement;
  cb.id = idstart + "-onoff-bcb";
  const cbState = cb as unknown as { checked: boolean; value: string };
  cbState.checked = false;
  cbState.value = "1px solid blue";
  document.body.appendChild(cb);
  const panelobj = {
    name: "cell",
    cbb: { type: "BorderSide", id: idstart, setting: "bb" },
  };
  SC.SettingsControls.CurrentPanel = panelobj;
  SC.SettingsControlOnchangeBorder(cb);
  expect(cbState.checked).toBe(false);
  expect(cbState.value).toBe("");
});
// ---------------------------------------------------------------------------
// C18. SettingControlReset
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// C19. SpreadsheetControlStatuslineCallback
// ---------------------------------------------------------------------------

test("Control StatuslineCallback: writes statusline string to element with matching id", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-slc-");
  const sl = document.createElement("div");
  sl.id = control.idPrefix + "statusline";
  sl.innerHTML = "";
  document.body.appendChild(sl);
  const params = {
    statuslineid: control.idPrefix + "statusline",
    recalcid1: control.idPrefix + "unused-recalc1",
    recalcid2: control.idPrefix + "unused-recalc2",
  };
  SC.SpreadsheetControlStatuslineCallback(control.editor, "cmdend", null, params);
  expect(sl.innerHTML).not.toBe("");
});

test("Control StatuslineCallback: calcfinished shows recalc indicators when needsrecalc=yes", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-slc2-");
  const sl = document.createElement("div");
  sl.id = control.idPrefix + "statusline";
  document.body.appendChild(sl);
  const r1 = document.createElement("span");
  r1.id = control.idPrefix + "recalc1";
  r1.style.display = "none";
  document.body.appendChild(r1);
  const r2 = document.createElement("span");
  r2.id = control.idPrefix + "recalc2";
  r2.style.display = "none";
  document.body.appendChild(r2);
  control.editor.context.sheetobj.attribs.needsrecalc = "yes";
  const params = {
    statuslineid: control.idPrefix + "statusline",
    recalcid1: control.idPrefix + "recalc1",
    recalcid2: control.idPrefix + "recalc2",
  };
  SC.SpreadsheetControlStatuslineCallback(control.editor, "calcfinished", null, params);
  expect(r1.style.display).toBe("inline");
  expect(r2.style.display).toBe("inline");
});

test("Control StatuslineCallback: doneposcalc hides recalc indicators when needsrecalc!=yes", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-slc3-");
  const sl = document.createElement("div");
  sl.id = control.idPrefix + "statusline";
  document.body.appendChild(sl);
  const r1 = document.createElement("span");
  r1.id = control.idPrefix + "recalc1";
  r1.style.display = "inline";
  document.body.appendChild(r1);
  const r2 = document.createElement("span");
  r2.id = control.idPrefix + "recalc2";
  r2.style.display = "inline";
  document.body.appendChild(r2);
  control.editor.context.sheetobj.attribs.needsrecalc = "";
  const params = {
    statuslineid: control.idPrefix + "statusline",
    recalcid1: control.idPrefix + "recalc1",
    recalcid2: control.idPrefix + "recalc2",
  };
  SC.SpreadsheetControlStatuslineCallback(control.editor, "doneposcalc", null, params);
  expect(r1.style.display).toBe("none");
  expect(r2.style.display).toBe("none");
});

test("Control StatuslineCallback: missing recalc elements leave sheet state unchanged", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-slc4-");
  control.editor.context.sheetobj.attribs.needsrecalc = "yes";
  const params = {
    statuslineid: control.idPrefix + "missing-status",
    recalcid1: control.idPrefix + "missing1",
    recalcid2: control.idPrefix + "missing2",
  };
  SC.SpreadsheetControlStatuslineCallback(control.editor, "doneposcalc", null, params);
  expect(control.editor.context.sheetobj.attribs.needsrecalc).toBe("yes");
});

// ---------------------------------------------------------------------------
// C20. DoButtonCmd (control variant)
// ---------------------------------------------------------------------------

test("Control DoButtonCmd: recalc updates the selected cell", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-dbc-");
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, "set A1 formula 2+3");
  const btn = document.createElement("input");
  SC.DoButtonCmd(fakeEvent(btn), null, {
    element: btn,
    functionobj: { command: "recalc" },
  });
  await waitEditor(control.editor);
  await recalcSheet(SC, control.sheet);
  expect(control.sheet.GetAssuredCell("A1").formula).toBe("2+3");
  expect(control.sheet.GetAssuredCell("A1").datavalue).toBe(5);
});

// ---------------------------------------------------------------------------
// C21. ClipboardFormat / ClipboardLoad
// ---------------------------------------------------------------------------

test("ClipboardFormat: converts clipboard to requested format", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-cf-");
  if (!SC.Clipboard) throw new Error("clipboard unavailable");
  SC.Clipboard.clipboard = "version:1.5\ncell:A1:t:fmt\nsheet:c:1:r:1";
  const clipText = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  clipText.id = control.idPrefix + "clipboardtext";
  (clipText as unknown as { value: string }).value = "";
  document.body.appendChild(clipText);
  SC.SpreadsheetControlClipboardFormat("csv");
  expect((clipText as unknown as { value: string }).value).toBe("fmt\n");
});

test("ClipboardLoad: loads tab clipboard into the consumer clipboard state", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-cl-");
  SC.SetSpreadsheetControlObject(control);
  const clipText = document.createElement("textarea") as unknown as HTMLTextAreaElement;
  clipText.id = control.idPrefix + "clipboardtext";
  (clipText as unknown as { value: string }).value = "A1\tB1\nfoo\tbar";
  document.body.appendChild(clipText);
  const tabRadio = document.createElement("input") as unknown as HTMLInputElement;
  tabRadio.id = control.idPrefix + "clipboardformat-tab";
  (tabRadio as unknown as { checked: boolean }).checked = true;
  document.body.appendChild(tabRadio);
  const csvRadio = document.createElement("input") as unknown as HTMLInputElement;
  csvRadio.id = control.idPrefix + "clipboardformat-csv";
  (csvRadio as unknown as { checked: boolean }).checked = false;
  document.body.appendChild(csvRadio);
  const scsaveRadio = document.createElement("input") as unknown as HTMLInputElement;
  scsaveRadio.id = control.idPrefix + "clipboardformat-scsave";
  (scsaveRadio as unknown as { checked: boolean }).checked = false;
  document.body.appendChild(scsaveRadio);
  control.editor.busy = false;
  await waitForStatus(control.sheet, "cmdend", () => SC.SpreadsheetControlClipboardLoad(), 3000);
  expect(control.editor.pastescclipboard).toBe(true);
  expect(SC.Clipboard.clipboard).toContain("cell:A2:t:foo");
  expect(SC.Clipboard.clipboard).toContain("cell:B2:t:bar");
});

// ---------------------------------------------------------------------------
// C22. ClipboardExport
// ---------------------------------------------------------------------------

test("ClipboardExport: callback receives save payload and returns to edit tab", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-ce-");
  let exportedSave = "";
  control.ExportCallback = (payload) => {
    exportedSave = payload.CreateSpreadsheetSave();
  };
  SC.SpreadsheetControlClipboardExport();
  expect(exportedSave).toContain("socialcalc:version:1.0");
  expect(exportedSave).toContain(control.multipartBoundary);
  expect(control.currentTab).toBe(control.tabnums.edit);
});

test("SettingsControlSave: sheet/cell changes update encoded attributes; cancel returns to edit", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-scs-");
  SC.SetSpreadsheetControlObject(control);
  const sheetPanel = control.views.settings.values.sheetspanel;
  SC.SettingsControlSetCurrentPanel(sheetPanel);
  SC.SettingsControls.PopupListSetValue(sheetPanel, "formatnumber", {
    def: false,
    val: "#,##0",
  });
  control.editor.busy = false;
  await waitForStatus(control.sheet, "cmdend", () => SC.SettingsControlSave("sheet"), 3000);
  const sheetAttrs = control.sheet.EncodeSheetAttributes();
  expect(sheetAttrs.numberformat).toEqual({ def: false, val: "#,##0" });

  const cellPanel = control.views.settings.values.cellspanel;
  SC.SettingsControlSetCurrentPanel(cellPanel);
  control.editor.MoveECell("A1");
  SC.SettingsControls.PopupListSetValue(cellPanel, "cformatnumber", {
    def: false,
    val: "#,##0.00",
  });
  control.editor.busy = false;
  await waitForStatus(control.sheet, "cmdend", () => SC.SettingsControlSave("cell"), 3000);
  const cellAttrs = control.sheet.EncodeCellAttributes("A1");
  expect(cellAttrs.numberformat).toEqual({ def: false, val: "#,##0.00" });

  SC.SettingsControlSave("cancel");
  expect(control.currentTab).toBe(control.tabnums.edit);
});

// ---------------------------------------------------------------------------
// C24. SettingsControlSetCurrentPanel / SettingsControlInitializePanel
// ---------------------------------------------------------------------------

test("SettingsControlSetCurrentPanel: sets CurrentPanel and calls PopupChangeCallback", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-scp-");
  SC.SetSpreadsheetControlObject(control);
  // PopupChangeCallback only has an observable effect when a "sample-text"
  // preview element is present (see production code's early-return guard);
  // seed one with the two child nodes the non-cell branch writes through.
  const sampleText = document.createElement("div");
  sampleText.id = "sample-text";
  sampleText.appendChild(document.createElement("div"));
  sampleText.appendChild(document.createElement("div"));
  sampleText.style.border = "1px solid red";
  document.body.appendChild(sampleText);
  const panelobj = { name: "test" };
  SC.SettingsControlSetCurrentPanel(panelobj);
  expect(SC.SettingsControls.CurrentPanel).toBe(panelobj);
  // The stale border is cleared and default alignment applied only if
  // PopupChangeCallback actually ran, proving the delegation contract.
  expect(sampleText.style.border).toBe("");
  expect(sampleText.style.textAlign).toBe("left");
});

test("SettingsControlInitializePanel: initializes popup controls for the panel", async () => {
  const SC = await fresh();
  const { control } = newControl(SC, "ctrl-sip-");
  const panelobj = control.views.settings.values.cellspanel;
  SC.SettingsControlInitializePanel(panelobj);
  const fontlook = SC.Popup.Controls[panelobj.cfontlook.id];
  expect(fontlook.type).toBe("List");
  expect(fontlook.data.options.length).toBeGreaterThan(0);
  expect(fontlook.data.attribs.panelobj).toBe(panelobj);
  const formatnumber = SC.Popup.Controls[panelobj.cformatnumber.id];
  expect(formatnumber.type).toBe("List");
  expect(formatnumber.data.options.length).toBeGreaterThan(0);
  expect(formatnumber.data.attribs.panelobj).toBe(panelobj);
});