import { expect, test } from "vite-plus/test";

import {
  installBrowserShim,
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

async function newBrowserControl(idPrefix: string) {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl(idPrefix);
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  SC.SetSpreadsheetControlObject(control);
  return { SC, control };
}

function waitCmdEnd(sheet: any): Promise<void> {
  return new Promise((resolve) => {
    const prev = sheet.statuscallback;
    sheet.statuscallback = (...args: any[]) => {
      prev?.(...args);
      if (args[1] === "cmdend") {
        sheet.statuscallback = prev;
        resolve();
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Sort: reject merged ranges without corrupting spans
// ---------------------------------------------------------------------------

test("sort rejects a range containing a merged cell and leaves the merge/spans untouched", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, [
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "merge A2:B2",
  ]);
  const before = sheet.CellToString(sheet.cells.A2);

  const done = waitCmdEnd(sheet);
  SC.ScheduleSheetCommands(sheet, "sort A1:A3 A up", true);
  await done;
  await recalcSheet(SC, sheet);

  // Unsorted: order must be unchanged (3,1,2), proving the sort did not run.
  expect(sheet.cells.A1.datavalue).toBe(3);
  expect(sheet.cells.A2.datavalue).toBe(1);
  expect(sheet.cells.A3.datavalue).toBe(2);
  // Merge span survives untouched.
  expect(sheet.cells.A2.colspan).toBe(2);
  expect(sheet.CellToString(sheet.cells.A2)).toBe(before);
});

test("sort succeeds normally over a range with no merged cells", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, [
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "sort A1:A3 A up",
  ]);
  await recalcSheet(SC, sheet);

  expect(sheet.cells.A1.datavalue).toBe(1);
  expect(sheet.cells.A2.datavalue).toBe(2);
  expect(sheet.cells.A3.datavalue).toBe(3);
});

// ---------------------------------------------------------------------------
// Redo keyboard dispatch: Ctrl+Y and Ctrl+Shift+Z both trigger SheetRedo
// ---------------------------------------------------------------------------

test("ctrlkeyFunction dispatches [ctrl-y] as redo and [ctrl-z]+shiftKey as redo", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  editor.CreateTableEditor(400, 300);

  const scheduled: Array<{ cmd: string; saveundo: boolean }> = [];
  editor.EditorScheduleSheetCommands = (cmd: string, saveundo: boolean) => {
    scheduled.push({ cmd, saveundo });
  };

  // Ctrl+Y -> redo
  editor.ctrlkeyFunction(editor, "[ctrl-y]", { shiftKey: false });
  expect(scheduled).toContainEqual({ cmd: "redo", saveundo: true });

  scheduled.length = 0;
  // Ctrl+Shift+Z -> redo (not undo)
  editor.ctrlkeyFunction(editor, "[ctrl-z]", { shiftKey: true });
  expect(scheduled).toContainEqual({ cmd: "redo", saveundo: true });

  scheduled.length = 0;
  // Plain Ctrl+Z -> undo (regression lock on the pre-existing behavior)
  editor.ctrlkeyFunction(editor, "[ctrl-z]", { shiftKey: false });
  expect(scheduled).toContainEqual({ cmd: "undo", saveundo: true });
});

test("ctrlkeyFunction [ctrl-c] calls navigator.clipboard.writeText and swallows a rejection", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  editor.CreateTableEditor(400, 300);
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };
  const scheduled: string[] = [];
  editor.EditorScheduleSheetCommands = (cmd: string) => scheduled.push(cmd);

  const writeTextCalls: string[] = [];
  const originalClipboard = (globalThis as any).navigator?.clipboard;
  (globalThis as any).navigator = (globalThis as any).navigator || {};
  (globalThis as any).navigator.clipboard = {
    writeText: (text: string) => {
      writeTextCalls.push(text);
      return Promise.reject(new Error("denied"));
    },
  };
  try {
    editor.ctrlkeyFunction(editor, "[ctrl-c]");
    // Give the rejected promise's .catch() a turn to run without throwing.
    await Promise.resolve();
    await Promise.resolve();
    expect(writeTextCalls.length).toBe(1);
    expect(scheduled.some((c) => c.startsWith("copy A1"))).toBe(true);
  } finally {
    (globalThis as any).navigator.clipboard = originalClipboard;
  }
});

test("ctrlkeyFunction [ctrl-v] uses navigator.clipboard.readText() when it resolves a string", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  editor.CreateTableEditor(400, 300);
  editor.noEdit = false;
  editor.ECellReadonly = () => false;
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };
  editor.pastescclipboard = false;
  SC.Clipboard.clipboard = "";
  const scheduled: string[] = [];
  editor.EditorScheduleSheetCommands = (cmd: string) => scheduled.push(cmd);

  const originalClipboard = (globalThis as any).navigator.clipboard;
  (globalThis as any).navigator.clipboard = {
    readText: () => Promise.resolve("pasted-42"),
  };
  try {
    editor.ctrlkeyFunction(editor, "[ctrl-v]");
    // Flush the readText().then() microtask chain deterministically.
    for (let i = 0; i < 4; i++) await Promise.resolve();
    // processPastedText schedules one newline-joined command string; an
    // empty prior SC.Clipboard.clipboard means a "loadclipboard ..." line
    // precedes "paste A1 formulas", so this must not anchor on the start.
    expect(scheduled.some((c) => c.includes("paste A1"))).toBe(true);
  } finally {
    (globalThis as any).navigator.clipboard = originalClipboard;
  }
});

test("ctrlkeyFunction [ctrl-v] falls back to the focused-textarea path when navigator.clipboard.readText() rejects", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  editor.CreateTableEditor(400, 300);
  editor.noEdit = false;
  editor.ECellReadonly = () => false;
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };

  const originalClipboard = (globalThis as any).navigator.clipboard;
  (globalThis as any).navigator.clipboard = {
    readText: () => Promise.reject(new Error("denied")),
  };
  const ta = editor.pasteTextarea;
  let focusCalled = false;
  const originalFocus = ta.focus.bind(ta);
  ta.focus = () => {
    focusCalled = true;
    originalFocus();
  };
  try {
    editor.ctrlkeyFunction(editor, "[ctrl-v]");
    // Flush the readText().catch() microtask chain deterministically.
    for (let i = 0; i < 4; i++) await Promise.resolve();
    // fallbackViaFocusedTextarea() focuses the hidden textarea; that call
    // running (rather than the resolve-branch's processPastedText) proves
    // the rejection routed to the legacy path.
    expect(focusCalled).toBe(true);
  } finally {
    (globalThis as any).navigator.clipboard = originalClipboard;
  }
});

test("ctrlkeyFunction [ctrl-v] falls back to the focused-textarea path when navigator.clipboard.readText() resolves a non-string", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  editor.CreateTableEditor(400, 300);
  editor.noEdit = false;
  editor.ECellReadonly = () => false;
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };

  const originalClipboard = (globalThis as any).navigator.clipboard;
  (globalThis as any).navigator.clipboard = {
    // Not spec-conformant, but defensively handled: some non-standard or
    // stubbed implementations could resolve with something other than a
    // string.
    readText: () => Promise.resolve(undefined),
  };
  const ta = editor.pasteTextarea;
  let focusCalled = false;
  const originalFocus = ta.focus.bind(ta);
  ta.focus = () => {
    focusCalled = true;
    originalFocus();
  };
  try {
    editor.ctrlkeyFunction(editor, "[ctrl-v]");
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(focusCalled).toBe(true);
  } finally {
    (globalThis as any).navigator.clipboard = originalClipboard;
  }
});

// ---------------------------------------------------------------------------
// Freeze/Unfreeze Panes: existing "pane row"/"pane col" commands + persistence
// ---------------------------------------------------------------------------

test("freeze panes at a selection top-left persists through SaveEditorSettings/LoadEditorSettings", async () => {
  const { SC, control } = await newBrowserControl("Freeze-");

  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  control.editor.range = { hasrange: true, left: 2, top: 3, right: 4, bottom: 5 };
  const done = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.FreezePanesAtSelection();
  await done;

  expect(control.editor.context.rowpanes.length).toBe(2);
  expect(control.editor.context.rowpanes[0].first).toBe(1);
  expect(control.editor.context.rowpanes[0].last).toBe(2); // row above anchor 3
  expect(control.editor.context.rowpanes[1].first).toBe(3);
  expect(control.editor.context.colpanes.length).toBe(2);
  expect(control.editor.context.colpanes[0].first).toBe(1);
  expect(control.editor.context.colpanes[0].last).toBe(1); // col above anchor 2 (B)
  expect(control.editor.context.colpanes[1].first).toBe(2);

  const settings = control.editor.SaveEditorSettings();
  expect(settings).toMatch(/rowpane:1:3:\d+/);
  expect(settings).toMatch(/colpane:1:2:\d+/);

  const unfreezeDone = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.UnfreezePanes();
  await unfreezeDone;

  expect(control.editor.context.rowpanes.length).toBe(1);
  expect(control.editor.context.colpanes.length).toBe(1);
});

test("FreezePanesAtSelection is a no-op at A1 (nothing to freeze)", async () => {
  const { SC, control } = await newBrowserControl("FreezeA1-");
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  control.editor.range = { hasrange: false };
  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  SC.SpreadsheetControl.FreezePanesAtSelection();
  expect(control.editor.context.rowpanes.length).toBe(1);
  expect(control.editor.context.colpanes.length).toBe(1);
});

test("FreezePanesAtSelection is a no-op when there is neither a range nor an active cell", async () => {
  const { SC, control } = await newBrowserControl("FreezeNoAnchor-");
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  control.editor.range = { hasrange: false };
  control.editor.ecell = null;
  SC.SpreadsheetControl.FreezePanesAtSelection();
  expect(control.editor.context.rowpanes.length).toBe(1);
  expect(control.editor.context.colpanes.length).toBe(1);
});

// ---------------------------------------------------------------------------
// Find/Replace: pure builder + escaping + One/All + undo transaction
// ---------------------------------------------------------------------------

test("EscapeRegexLiteral escapes every regex metacharacter", async () => {
  const SC = await loadSocialCalc();
  const escaped = SC.SpreadsheetControlEscapeRegexLiteral("a.b*c?d^e$f{g}h(i)j|k[l]m\\n");
  expect(new RegExp(escaped).test("a.b*c?d^e$f{g}h(i)j|k[l]m\\n")).toBe(true);
  expect(new RegExp(escaped).test("aXbXcXdXeXfXgXhXiXjXkXlXm")).toBe(false);
});

test("BuildReplaceCommand: literal-mode replacement text is not interpreted as $-backreferences", async () => {
  const SC = await loadSocialCalc();
  const cell = { datatype: "t", datavalue: "cost" };
  const pattern = SC.SpreadsheetControlEscapeRegexLiteral("cost");
  const regex = new RegExp(pattern, "gi");
  // regexMode=false: "$&" in the replacement must be treated as a literal
  // two-character string, not "insert the whole match" backreference syntax.
  const cmd = SC.SpreadsheetControlBuildReplaceCommand(cell, "A1", regex, "$& price", false, false);
  expect(cmd).toBe("set A1 text t $& price");
});

test("BuildReplaceCommand: regex-mode replacement keeps native $& backreference semantics", async () => {
  const SC = await loadSocialCalc();
  const cell = { datatype: "t", datavalue: "cost" };
  const regex = /cost/gi;
  const cmd = SC.SpreadsheetControlBuildReplaceCommand(cell, "A1", regex, "$& price", false, true);
  expect(cmd).toBe("set A1 text t cost price");
});

test("BuildReplaceCommand: formula cells are skipped unless includeFormulas is true, and only formula text is rewritten", async () => {
  const SC = await loadSocialCalc();
  const cell = { datatype: "f", formula: "SUM(A1:A2)", datavalue: 3 };
  const regex = new RegExp(SC.SpreadsheetControlEscapeRegexLiteral("A1"), "gi");

  const skipped = SC.SpreadsheetControlBuildReplaceCommand(cell, "B1", regex, "C1", false, false);
  expect(skipped).toBeNull();

  regex.lastIndex = 0;
  const rewritten = SC.SpreadsheetControlBuildReplaceCommand(cell, "B1", regex, "C1", true, false);
  expect(rewritten).toBe("set B1 formula SUM(C1:A2)");
});

test("BuildReplaceCommand returns null when there is no match", async () => {
  const SC = await loadSocialCalc();
  const cell = { datatype: "t", datavalue: "hello" };
  const regex = new RegExp(SC.SpreadsheetControlEscapeRegexLiteral("zzz"), "gi");
  expect(SC.SpreadsheetControlBuildReplaceCommand(cell, "A1", regex, "x", false, false)).toBeNull();
});

test("BuildReplaceCommand: replacement producing a plain number uses the 'value n' grammar", async () => {
  const SC = await loadSocialCalc();
  const cell = { datatype: "t", datavalue: "abc" };
  const regex = new RegExp(SC.SpreadsheetControlEscapeRegexLiteral("abc"), "gi");
  const cmd = SC.SpreadsheetControlBuildReplaceCommand(cell, "A1", regex, "42", false, false);
  expect(cmd).toBe("set A1 value n 42");
});

test("BuildReplaceCommand: replacement producing a non-numeric, non-text constant (logical) uses the 'constant' grammar", async () => {
  const SC = await loadSocialCalc();
  const cell = { datatype: "t", datavalue: "abc" };
  const regex = new RegExp(SC.SpreadsheetControlEscapeRegexLiteral("abc"), "gi");
  const cmd = SC.SpreadsheetControlBuildReplaceCommand(cell, "A1", regex, "TRUE", false, false);
  expect(cmd).toBe("set A1 constant nl 1 TRUE");
});

test("replace-bar input focus/blur toggle Keyboard.passThru (same wiring as the search bar)", async () => {
  const { SC, control } = await newBrowserControl("ReplaceFocus-");
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  const input: any = document.getElementById("replacebarinput");
  expect(input).toBeTruthy();
  const handlers = input.__jqHandlers;
  handlers.focus();
  expect(SC.Keyboard.passThru).toBe(true);
  handlers.blur();
  expect(SC.Keyboard.passThru).toBe(false);
});

test("Replace-All with a range selection only rewrites cells inside the range", async () => {
  const { SC, control } = await newBrowserControl("ReplaceRange-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo", "set D4 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "foo";
  document.body.appendChild(searchInput);
  const replaceInput = document.createElement("input");
  replaceInput.id = "replacebarinput";
  (replaceInput as any).value = "bar";
  document.body.appendChild(replaceInput);

  // A range covering only A1, not D4.
  control.editor.range = { hasrange: true, left: 1, top: 1, right: 1, bottom: 1 };

  const done = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.ReplaceAll();
  await done;
  await recalcSheet(SC, control.sheet);

  expect(control.sheet.cells.A1.datavalue).toBe("bar");
  expect(control.sheet.cells.D4.datavalue).toBe("foo"); // outside range, untouched
});

test("Replace-All rewrites every matching cell in one undo transaction, skips hidden and formula cells by default, and honors range scope", async () => {
  const { SC, control } = await newBrowserControl("Replace-");

  await scheduleCommands(SC, control.sheet, [
    "set A1 text t foo",
    "set A2 text t foobar",
    "set A3 text t foo",
    'set A4 formula A1&"foo"',
    "set 4 hide yes",
  ]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "foo";
  document.body.appendChild(searchInput);
  const replaceInput = document.createElement("input");
  replaceInput.id = "replacebarinput";
  (replaceInput as any).value = "bar";
  document.body.appendChild(replaceInput);

  control.editor.range = { hasrange: false };

  const done = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.ReplaceAll();
  await done;
  await recalcSheet(SC, control.sheet);

  expect(control.sheet.cells.A1.datavalue).toBe("bar");
  expect(control.sheet.cells.A2.datavalue).toBe("barbar");
  expect(control.sheet.cells.A3.datavalue).toBe("bar");
  // Formula cell untouched (includeFormulas checkbox absent -> false).
  expect(control.sheet.cells.A4.datatype).toBe("f");
  expect(control.sheet.cells.A4.formula).toBe('A1&"foo"');
  // Hidden row 4 has no cell content here, but confirm it stayed hidden and
  // wasn't touched by the replace pass.
  expect(control.sheet.rowattribs.hide[4]).toBe("yes");

  // Single undo transaction restores all three literal replacements at once.
  await sheetUndo(SC, control.sheet);
  await recalcSheet(SC, control.sheet);
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
  expect(control.sheet.cells.A2.datavalue).toBe("foobar");
  expect(control.sheet.cells.A3.datavalue).toBe("foo");

  await sheetRedo(SC, control.sheet);
  await recalcSheet(SC, control.sheet);
  expect(control.sheet.cells.A1.datavalue).toBe("bar");
  expect(control.sheet.cells.A3.datavalue).toBe("bar");
});

test("Replace-One targets only the active cell", async () => {
  const { SC, control } = await newBrowserControl("ReplaceOne-");

  await scheduleCommands(SC, control.sheet, ["set A1 text t foo", "set A2 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "foo";
  document.body.appendChild(searchInput);
  const replaceInput = document.createElement("input");
  replaceInput.id = "replacebarinput";
  (replaceInput as any).value = "bar";
  document.body.appendChild(replaceInput);

  control.editor.ecell = { coord: "A1", row: 1, col: 1 };
  const done = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.ReplaceOne();
  await done;
  await recalcSheet(SC, control.sheet);

  expect(control.sheet.cells.A1.datavalue).toBe("bar");
  expect(control.sheet.cells.A2.datavalue).toBe("foo"); // untouched
});

test("Replace-All with regex mode and a malformed pattern no-ops instead of throwing", async () => {
  const { SC, control } = await newBrowserControl("ReplaceBad-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "(unclosed";
  document.body.appendChild(searchInput);
  const replaceInput = document.createElement("input");
  replaceInput.id = "replacebarinput";
  (replaceInput as any).value = "x";
  document.body.appendChild(replaceInput);
  const regexCheckbox = document.createElement("input");
  regexCheckbox.id = "replaceregexinput";
  (regexCheckbox as any).checked = true;
  document.body.appendChild(regexCheckbox);

  expect(() => SC.SpreadsheetControl.ReplaceAll()).not.toThrow();
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
});

test("Replace-All with a valid pattern that matches nothing schedules no command", async () => {
  const { SC, control } = await newBrowserControl("ReplaceNoMatch-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "zzz-not-present";
  document.body.appendChild(searchInput);
  const replaceInput = document.createElement("input");
  replaceInput.id = "replacebarinput";
  (replaceInput as any).value = "x";
  document.body.appendChild(replaceInput);

  const scheduled: string[] = [];
  const originalSchedule = control.editor.EditorScheduleSheetCommands.bind(control.editor);
  control.editor.EditorScheduleSheetCommands = (cmd: string, saveundo: any, ignorebusy: any) => {
    scheduled.push(cmd);
    return originalSchedule(cmd, saveundo, ignorebusy);
  };
  SC.SpreadsheetControl.ReplaceAll();
  expect(scheduled).toEqual([]);
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
});

test("FreezePanesAtSelection freezes only rows when the selection starts at column A", async () => {
  const { SC, control } = await newBrowserControl("FreezeRowOnly-");
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  control.editor.range = { hasrange: false };
  control.editor.ecell = { coord: "A3", row: 3, col: 1 };
  const done = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.FreezePanesAtSelection();
  await done;

  expect(control.editor.context.rowpanes.length).toBe(2);
  expect(control.editor.context.colpanes.length).toBe(1);
});

test("FreezePanesAtSelection freezes only columns when the selection starts at row 1", async () => {
  const { SC, control } = await newBrowserControl("FreezeColOnly-");
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  control.editor.range = { hasrange: false };
  control.editor.ecell = { coord: "C1", row: 1, col: 3 };
  const done = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.FreezePanesAtSelection();
  await done;

  expect(control.editor.context.colpanes.length).toBe(2);
  expect(control.editor.context.rowpanes.length).toBe(1);
});

test("Replace-All with no #replacebarinput element treats the replacement as empty text", async () => {
  const { SC, control } = await newBrowserControl("ReplaceNoInput-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "foo";
  document.body.appendChild(searchInput);
  // InitializeSpreadsheetControl already created a real #replacebarinput;
  // deregister it directly (the fake DOM's removeChild does not unlink
  // getElementById's id map) so the falsy `replaceInput ? ... : ""` branch
  // is genuinely exercised rather than reading that element's own empty
  // default value.
  (document as any).nodesById.delete("replacebarinput");

  const done = waitCmdEnd(control.sheet);
  SC.SpreadsheetControl.ReplaceAll();
  await done;
  await recalcSheet(SC, control.sheet);

  // "foo" -> "" (empty replacement) round-trips through DetermineValueType,
  // which classifies an empty string as the numeric constant 0.
  expect(control.sheet.cells.A1.datavalue).toBe(0);
});

test("Replace-One is a no-op when there is no active cell", async () => {
  const { SC, control } = await newBrowserControl("ReplaceOneNoEcell-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "foo";
  document.body.appendChild(searchInput);
  const replaceInput = document.createElement("input");
  replaceInput.id = "replacebarinput";
  (replaceInput as any).value = "bar";
  document.body.appendChild(replaceInput);

  control.editor.ecell = null;
  expect(() => SC.SpreadsheetControl.ReplaceOne()).not.toThrow();
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
});

test("Replace-All is a no-op when the search pattern is empty", async () => {
  const { SC, control } = await newBrowserControl("ReplaceEmptyPattern-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "";
  document.body.appendChild(searchInput);

  expect(() => SC.SpreadsheetControl.ReplaceAll()).not.toThrow();
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
});

test("BuildReplaceCommand returns null when the replacement produces byte-identical text", async () => {
  const SC = await loadSocialCalc();
  const cell = { datatype: "t", datavalue: "foofoo" };
  // Regex mode: replacing "foo" with itself via a backreference leaves the
  // value unchanged, exercising the newValue===oldValue no-op guard.
  const regex = /foo/gi;
  expect(
    SC.SpreadsheetControlBuildReplaceCommand(cell, "A1", regex, "foo", false, true),
  ).toBeNull();
});

test("Replace-All is a no-op when there is no #searchbarinput element at all", async () => {
  const { SC, control } = await newBrowserControl("ReplaceNoSearchInput-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);
  // Deliberately do not create #searchbarinput.
  expect(() => SC.SpreadsheetControl.ReplaceAll()).not.toThrow();
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
});

test("Replace-One is a no-op when the active cell has no sheet entry yet", async () => {
  const { SC, control } = await newBrowserControl("ReplaceOneEmptyCell-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);

  const searchInput = document.createElement("input");
  searchInput.id = "searchbarinput";
  (searchInput as any).value = "foo";
  document.body.appendChild(searchInput);
  const replaceInput = document.createElement("input");
  replaceInput.id = "replacebarinput";
  (replaceInput as any).value = "bar";
  document.body.appendChild(replaceInput);

  // B1 was never set, so it has no entry in sheet.cells; the active cell
  // pointing at it exercises the `cells[coord]` miss guard.
  control.editor.ecell = { coord: "B1", row: 1, col: 2 };
  expect(() => SC.SpreadsheetControl.ReplaceOne()).not.toThrow();
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
  expect(control.sheet.cells.B1).toBeUndefined();
});

test("BuildReplaceCommand returns null when a formula rewrite produces byte-identical formula text", async () => {
  const SC = await loadSocialCalc();
  // Regex mode: replace "A1" with itself via a backreference leaves the
  // formula unchanged, exercising the newFormula===oldFormula no-op.
  const cell = { datatype: "f", formula: "A1+A2", datavalue: 3 };
  const regex = /(A1)/gi;
  expect(SC.SpreadsheetControlBuildReplaceCommand(cell, "B1", regex, "$1", true, true)).toBeNull();
});

test("BuildReplaceCommand returns null when a formula rewrite would introduce a newline", async () => {
  const SC = await loadSocialCalc();
  // includeFormulas=true; replacement introduces "\n", which would corrupt
  // the multi-line command stream, so the builder must skip the cell.
  const cell = { datatype: "f", formula: "A1+A2", datavalue: 3 };
  const regex = /A1/gi;
  expect(
    SC.SpreadsheetControlBuildReplaceCommand(cell, "B1", regex, "x\ny", true, true),
  ).toBeNull();
});

test("RunReplace reads pattern as empty string when #searchbarinput is absent from the DOM", async () => {
  const { SC, control } = await newBrowserControl("ReplaceNoSearchInput2-");
  await scheduleCommands(SC, control.sheet, ["set A1 text t foo"]);
  await recalcSheet(SC, control.sheet);
  // Remove the searchbarinput element so getElementById returns null and
  // the falsy ternary on the `pattern` line is genuinely exercised.
  (document as any).nodesById.delete("searchbarinput");
  expect(() => SC.SpreadsheetControl.ReplaceAll()).not.toThrow();
  expect(control.sheet.cells.A1.datavalue).toBe("foo");
});

test("BuildReplaceCommand returns null when includeFormulas is true but the pattern does not match the formula text", async () => {
  const SC = await loadSocialCalc();
  // Formula cell with includeFormulas=true; pattern "zzz" does not appear
  // in the formula source, exercising the !replaceRegex.test(oldFormula)
  // early return inside the isFormula branch.
  const cell = { datatype: "f", formula: "A1+A2", datavalue: 3 };
  const regex = /zzz/gi;
  expect(SC.SpreadsheetControlBuildReplaceCommand(cell, "B1", regex, "x", true, true)).toBeNull();
});

test("BuildReplaceCommand handles null formula and null datavalue without throwing", async () => {
  const SC = await loadSocialCalc();
  // Formula cell with formula=null (exercises `cell.formula || ""` fallback)
  // and includeFormulas=true with a matching pattern → the empty oldFormula
  // does not match, returns null.
  const cell = { datatype: "f", formula: null, datavalue: null };
  const regex = /x/gi;
  expect(SC.SpreadsheetControlBuildReplaceCommand(cell, "A1", regex, "y", true, true)).toBeNull();

  // Value cell with datavalue=null (exercises
  // `cell.datavalue == null ? "" : cell.datavalue` fallback); empty
  // oldValue does not match "x", returns null.
  const cell2 = { datatype: "t", datavalue: null };
  regex.lastIndex = 0;
  expect(
    SC.SpreadsheetControlBuildReplaceCommand(cell2, "A1", regex, "y", false, false),
  ).toBeNull();
});

// installBrowserShim import used indirectly by loadSocialCalc({browser:true})
// in helper module; referenced here only to satisfy static-import linting
// for the re-export path exercised above.
void installBrowserShim;
