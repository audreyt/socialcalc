import { describe, expect, test } from "vite-plus/test";

import { installBrowserShim, loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

async function loadBrowserSocialCalc() {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  return SC;
}

async function newControl(SC: any, containerId = "dv-root") {
  const container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

/** Populate colpositions/rowpositions so ShowCellHandles/ValidationDropdown visibility gates pass. */
function primeGridLayout(editor: any) {
  editor.CalculateEditorPositions();
  editor.gridposition = editor.gridposition ?? { left: 0, top: 0 };
  editor.headposition = editor.headposition ?? { left: 30, top: 30 };
  editor.colpositions = [0, 0, 80, 160, 240, 320, 400, 480];
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.firstscrollingrow = editor.firstscrollingrow ?? 1;
  editor.firstscrollingcol = editor.firstscrollingcol ?? 1;
  editor.lastnonscrollingrow = editor.lastnonscrollingrow ?? 0;
  editor.lastnonscrollingcol = editor.lastnonscrollingcol ?? 0;
  editor.lastvisiblerow = editor.lastvisiblerow ?? 7;
  editor.lastvisiblecol = editor.lastvisiblecol ?? 7;
  editor.verticaltablecontrol = editor.verticaltablecontrol ?? { controlborder: 1000 };
  editor.horizontaltablecontrol = editor.horizontaltablecontrol ?? { controlborder: 1000 };
}

// ---------------------------------------------------------------------------
// Security: hostile validation-list labels must never inject unescaped HTML
// into the popup dropdown. Popup.Types.List.MakeList interpolates {o: ...}
// verbatim into <div>...</div> markup (see socialcalcpopup.ts), so every
// option label handed to it MUST already be HTML-escaped via
// SocialCalc.special_chars — this is enforced in
// ValidationDropdownMouseDown (socialcalctableeditor.ts).
// ---------------------------------------------------------------------------
describe("data validation security: hostile list labels are escaped before reaching the popup", () => {
  test("SocialCalc.special_chars neutralizes a script-tag list label", async () => {
    const SC = await loadSocialCalc();
    const hostile = "<script>alert(1)</script>";
    const escaped = SC.special_chars(hostile);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("SocialCalc.special_chars neutralizes an event-handler-bearing img label", async () => {
    const SC = await loadSocialCalc();
    const hostile = '<img src=x onerror="alert(1)">';
    const escaped = SC.special_chars(hostile);
    expect(escaped).not.toContain("<img");
    expect(escaped).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("MakeList's rendered HTML for an escaped hostile option never contains a live tag", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const hostile = "<img src=x onerror=alert(1)>";
    const escaped = SC.special_chars(hostile);

    SC.Popup.Create("List", "dvtest", {});
    SC.Popup.Initialize("dvtest", {
      options: [{ o: escaped, v: "malicious" }],
      attribs: {},
    });
    const html = SC.Popup.Types.List.MakeList("List", "dvtest");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  test("end-to-end: a list rule whose values contain HTML metacharacters resolves and escapes at render time", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    const rule = {
      kind: "list",
      values: ["<script>alert(1)</script>", "safe-value"],
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    const decoded = SC.DataValidation.DecodeRule(sheet.cells.A1.validation);
    const resolved = SC.DataValidation.ResolveListValues(sheet, decoded);
    expect(resolved).toContain("<script>alert(1)</script>"); // stored raw

    const escapedOptions = resolved.map((v: string) => ({ o: SC.special_chars(v), v }));
    SC.Popup.Create("List", "dvtest2", {});
    SC.Popup.Initialize("dvtest2", { options: escapedOptions, attribs: {} });
    const html = SC.Popup.Types.List.MakeList("List", "dvtest2");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("a hostile validation error message is returned as-is (routed through alert/confirm, not innerHTML)", async () => {
    const SC = await loadSocialCalc();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: 0,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
      errorMessage: "<img src=x onerror=alert(1)>",
    };
    expect(SC.DataValidation.DefaultErrorMessage(rule)).toBe(rule.errorMessage);
  });

  test("ValidationDropdownMouseDown escapes every option label before handing them to Popup.Initialize", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = {
      kind: "list",
      values: ["<script>alert(1)</script>", "safe"],
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    primeGridLayout(editor);
    SC.KeyboardSetFocus(editor);
    editor.dvDropdown.Update();
    expect(editor.dvDropdown.coord).toBe("A1");

    // Capture exactly what ValidationDropdownMouseDown hands to Popup.Initialize
    // (the real production call, not a re-implementation) by intercepting it.
    let capturedOptions: Array<{ o: string; v: string }> | null = null;
    const originalInitialize = SC.Popup.Initialize;
    SC.Popup.Initialize = (id: string, data: any) => {
      capturedOptions = data.options;
      return originalInitialize(id, data);
    };
    try {
      SC.ValidationDropdownMouseDown({
        target: editor.dvDropdown.main,
        preventDefault() {},
        stopPropagation() {},
      });
    } finally {
      SC.Popup.Initialize = originalInitialize;
    }

    expect(capturedOptions).not.toBeNull();
    const scriptOption = capturedOptions!.find((o) => o.v === "<script>alert(1)</script>");
    expect(scriptOption).toBeDefined();
    expect(scriptOption!.o).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(scriptOption!.o).not.toContain("<script>");
  });

  test("ValidationDropdownMouseDown guards: no focused editor, no dvDropdown, no coord open", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC, "gd-root");
    const editor = control.editor;

    // No editor currently has keyboard focus. Also pass a falsy `e` (as a
    // caller might when re-dispatching synthetically) to exercise the
    // `e || window.event` fallback before the focusTable guard fires.
    SC.Keyboard.focusTable = null;
    expect(SC.ValidationDropdownMouseDown(null)).toBe(true);
    expect(SC.ValidationDropdownMouseDown({ target: null })).toBe(true);

    // Focused editor exists but has no dvDropdown (e.g. a noEdit viewer).
    SC.Keyboard.focusTable = { dvDropdown: null };
    expect(SC.ValidationDropdownMouseDown({ target: null })).toBe(true);

    // Focused editor's dropdown exists but is not currently open (no coord).
    SC.Keyboard.focusTable = editor;
    editor.dvDropdown.coord = null;
    expect(SC.ValidationDropdownMouseDown({ target: null })).toBe(true);
  });

  test("ValidationDropdownMouseDown no-ops when the target cell was cleared or its rule changed kind after the dropdown opened", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC, "gd2-root");
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = { kind: "list", values: ["red", "green"], allowBlank: false, mode: "reject" };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );
    editor.MoveECell("A1");
    primeGridLayout(editor);
    SC.KeyboardSetFocus(editor);
    editor.dvDropdown.Update();
    expect(editor.dvDropdown.coord).toBe("A1");

    // The cell itself was removed from the sheet after the dropdown was
    // shown (e.g. by a concurrent command) -- sheetobj.cells[coord] is
    // undefined, so `cell` is falsy and the ternary's null branch fires.
    const savedCell = sheet.cells.A1;
    delete sheet.cells.A1;
    try {
      expect(SC.ValidationDropdownMouseDown({ target: editor.dvDropdown.main })).toBe(true);
    } finally {
      sheet.cells.A1 = savedCell;
    }

    // The cell still exists but its validation rule is no longer a list
    // (e.g. changed to a number rule after the dropdown opened).
    const numberRule = {
      kind: "number",
      op: "between",
      bound1: 1,
      bound2: 10,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(numberRule))}`,
    );
    expect(SC.ValidationDropdownMouseDown({ target: editor.dvDropdown.main })).toBe(true);
  });

  test("ValidationDropdownMouseDown tolerates a synthetic event with no preventDefault/stopPropagation methods", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC, "gd3-root");
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = { kind: "list", values: ["red", "green"], allowBlank: false, mode: "reject" };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );
    editor.MoveECell("A1");
    primeGridLayout(editor);
    SC.KeyboardSetFocus(editor);
    editor.dvDropdown.Update();

    // A plain event object (no preventDefault/stopPropagation, as a native
    // browser MouseEvent always provides but a minimal synthetic one might
    // not) must not throw -- both calls are feature-detected.
    expect(() => SC.ValidationDropdownMouseDown({ target: editor.dvDropdown.main })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Browser/DOM: exercises the real ValidationDropdown UI end-to-end through a
// fully-initialized SpreadsheetControl (installUiShim + newControl, matching
// hardening-tableeditor-interactions.test.ts's convention), driving the
// actual EditorSaveEdit commit path — opening the dropdown, typing an
// invalid value under both reject/warn modes, and selecting a valid value.
// ---------------------------------------------------------------------------
describe("data validation browser: dropdown open / type-invalid / select-valid flow", () => {
  test("a list-validated cell's dropdown arrow is shown only while it is the current start-state ecell", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = {
      kind: "list",
      values: ["red", "green", "blue"],
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    primeGridLayout(editor);
    expect(editor.dvDropdown).toBeTruthy();
    editor.dvDropdown.Update();
    expect(editor.dvDropdown.main.style.display).toBe("block");
    expect(editor.dvDropdown.coord).toBe("A1");

    editor.MoveECell("B1");
    editor.dvDropdown.Update();
    expect(editor.dvDropdown.main.style.display).toBe("none");
    expect(editor.dvDropdown.coord).toBeNull();
  });

  test("dropdown Update hides itself when the editor has no current ecell yet", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const { editor } = control;
    primeGridLayout(editor);
    // editor.ecell defaults to A1 on construction; force it unset to
    // exercise the "!editor.ecell" guard branch directly.
    editor.ecell = null;
    editor.dvDropdown.main.style.display = "block"; // force a visible state to prove Update resets it
    editor.dvDropdown.Update();
    expect(editor.dvDropdown.main.style.display).toBe("none");
  });

  test("selecting a dropdown item commits the value through the normal EditorSaveEdit/ExecuteSheetCommand path", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = {
      kind: "list",
      values: ["red", "green", "blue"],
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    primeGridLayout(editor);
    SC.KeyboardSetFocus(editor);
    editor.dvDropdown.Update();
    expect(editor.dvDropdown.coord).toBe("A1");

    // Open the real dropdown via its production mousedown handler, then
    // select an item exactly as ItemClicked does (SetValue -> changedcallback).
    SC.ValidationDropdownMouseDown({
      target: editor.dvDropdown.main,
      preventDefault() {},
      stopPropagation() {},
    });

    await new Promise<void>((resolve) => {
      sheet.statuscallback = (_s: any, status: string) => {
        if (status === "cmdend") resolve();
      };
      SC.Popup.SetValue(editor.dvDropdown.anchor.id, "green");
      SC.Popup.Close();
    });
    expect(sheet.cells.A1.datavalue).toBe("green");
  });

  test("typing an invalid value under reject mode is blocked by EditorSaveEdit (cell stays blank)", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = {
      kind: "list",
      values: ["red", "green", "blue"],
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    editor.workingvalues.ecoord = "A1";

    const originalAlert = (globalThis as any).alert;
    let alerted = "";
    (globalThis as any).alert = (msg: string) => {
      alerted = msg;
    };
    try {
      editor.EditorSaveEdit("purple");
    } finally {
      (globalThis as any).alert = originalAlert;
    }
    expect(sheet.cells.A1.datavalue).toBe("");
    expect(alerted).toContain("does not meet validation rules");
  });

  test("typing a warn-mode invalid value prompts confirm(); declining leaves the cell unchanged", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = {
      kind: "list",
      values: ["red", "green", "blue"],
      allowBlank: false,
      mode: "warn",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    editor.workingvalues.ecoord = "A1";

    const originalConfirm = (globalThis as any).confirm;
    (globalThis as any).confirm = () => false;
    try {
      editor.EditorSaveEdit("purple");
    } finally {
      (globalThis as any).confirm = originalConfirm;
    }
    expect(sheet.cells.A1.datavalue).toBe("");
  });

  test("typing a warn-mode invalid value and confirming commits it anyway", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = {
      kind: "list",
      values: ["red", "green", "blue"],
      allowBlank: false,
      mode: "warn",
    };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    editor.workingvalues.ecoord = "A1";

    const originalConfirm = (globalThis as any).confirm;
    (globalThis as any).confirm = () => true;
    try {
      await new Promise<void>((resolve) => {
        sheet.statuscallback = (_s: any, status: string) => {
          if (status === "cmdend") resolve();
        };
        editor.EditorSaveEdit("purple");
      });
    } finally {
      (globalThis as any).confirm = originalConfirm;
    }
    expect(sheet.cells.A1.datavalue).toBe("purple");
  });

  test("reject mode with no global alert() function still blocks the edit silently", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = { kind: "list", values: ["red", "green"], allowBlank: false, mode: "reject" };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    editor.workingvalues.ecoord = "A1";

    const originalAlert = (globalThis as any).alert;
    delete (globalThis as any).alert;
    try {
      expect(() => editor.EditorSaveEdit("purple")).not.toThrow();
    } finally {
      (globalThis as any).alert = originalAlert;
    }
    expect(sheet.cells.A1.datavalue).toBe("");
  });

  test("warn mode with no global confirm() function proceeds as if confirmed", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    const rule = { kind: "list", values: ["red", "green"], allowBlank: false, mode: "warn" };
    await scheduleCommands(
      SC,
      sheet,
      `set A1 validation ${SC.encodeForSave(SC.DataValidation.EncodeRule(rule))}`,
    );

    editor.MoveECell("A1");
    editor.workingvalues.ecoord = "A1";

    const originalConfirm = (globalThis as any).confirm;
    delete (globalThis as any).confirm;
    try {
      await new Promise<void>((resolve) => {
        sheet.statuscallback = (_s: any, status: string) => {
          if (status === "cmdend") resolve();
        };
        editor.EditorSaveEdit("purple");
      });
    } finally {
      (globalThis as any).confirm = originalConfirm;
    }
    // No confirm() available -> dvProceed defaults true -> edit commits.
    expect(sheet.cells.A1.datavalue).toBe("purple");
  });

  test("a cell carrying an undecodable validation payload skips enforcement entirely (edit commits)", async () => {
    const SC = await loadBrowserSocialCalc();
    const { control } = await newControl(SC);
    const sheet = control.sheet;
    const editor = control.editor;

    // Set a cell directly with a validation string that DecodeRule cannot
    // parse (e.g. corrupted/truncated save data), bypassing the normal
    // EncodeRule path so DecodeRule genuinely returns null.
    await scheduleCommands(SC, sheet, "set A1 validation not-a-valid-rule-payload");

    editor.MoveECell("A1");
    editor.workingvalues.ecoord = "A1";

    await new Promise<void>((resolve) => {
      sheet.statuscallback = (_s: any, status: string) => {
        if (status === "cmdend") resolve();
      };
      editor.EditorSaveEdit("anything");
    });
    expect(sheet.cells.A1.datavalue).toBe("anything");
  });
});

describe("ValidationDropdown constructor", () => {
  test("returns immediately without building any DOM when the owning editor is noEdit", async () => {
    const SC = await loadBrowserSocialCalc();
    const sheet = new SC.Sheet();
    const ctx = new SC.RenderContext(sheet);
    const editor = new SC.TableEditor(ctx);
    editor.noEdit = true;
    const dropdown = new SC.ValidationDropdown(editor);
    // The noEdit guard returns before `this.editor`/`this.main` are set --
    // mirrors the production construction site in CreateTableEditor, which
    // only news this up inside an `if (!editor.noEdit)` block.
    expect(dropdown.editor).toBeUndefined();
    expect(dropdown.main).toBeUndefined();
  });
});
