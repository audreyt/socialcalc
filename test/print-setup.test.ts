import { expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  makeSave,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

test("set sheet print commands write and clear print attributes", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, [
    "set sheet printarea A1:C10",
    "set sheet printrepeatrows 1:2",
    "set sheet printrepeatcols A:A",
    "set sheet printorientation landscape",
    "set sheet printscale 75",
    "set sheet printmargins 0.5in",
  ]);

  expect(sheet.attribs.printarea).toBe("A1:C10");
  expect(sheet.attribs.printrepeatrows).toBe("1:2");
  expect(sheet.attribs.printrepeatcols).toBe("A:A");
  expect(sheet.attribs.printorientation).toBe("landscape");
  expect(sheet.attribs.printscale).toBe(75);
  expect(sheet.attribs.printmargins).toBe("0.5in");

  // A scale of 100 (the default) and a non-"landscape" orientation clear
  // the attribute rather than storing a redundant explicit default.
  await scheduleCommands(SC, sheet, [
    "set sheet printscale 100",
    "set sheet printorientation portrait",
  ]);
  expect(sheet.attribs.printscale).toBeUndefined();
  expect(sheet.attribs.printorientation).toBeUndefined();

  // Clearing with an empty value removes the attribute entirely.
  await scheduleCommands(SC, sheet, [
    "set sheet printarea ",
    "set sheet printrepeatrows ",
    "set sheet printrepeatcols ",
    "set sheet printmargins ",
  ]);
  expect(sheet.attribs.printarea).toBeUndefined();
  expect(sheet.attribs.printrepeatrows).toBeUndefined();
  expect(sheet.attribs.printrepeatcols).toBeUndefined();
  expect(sheet.attribs.printmargins).toBeUndefined();
});

test("print attributes undo and redo", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, ["set sheet printarea A1:B5", "set sheet printscale 50"], true);
  expect(sheet.attribs.printarea).toBe("A1:B5");
  expect(sheet.attribs.printscale).toBe(50);

  await sheetUndo(SC, sheet);
  expect(sheet.attribs.printscale).toBeUndefined();

  await sheetUndo(SC, sheet);
  expect(sheet.attribs.printarea).toBeUndefined();

  await sheetRedo(SC, sheet);
  await sheetRedo(SC, sheet);
  expect(sheet.attribs.printarea).toBe("A1:B5");
  expect(sheet.attribs.printscale).toBe(50);

  // printmargins also participates in undo: setting it records an undo
  // step that restores the prior (unset) value.
  await scheduleCommands(SC, sheet, ["set sheet printmargins 1in"], true);
  expect(sheet.attribs.printmargins).toBe("1in");
  await sheetUndo(SC, sheet);
  expect(sheet.attribs.printmargins).toBeUndefined();
  await sheetRedo(SC, sheet);
  expect(sheet.attribs.printmargins).toBe("1in");
});

test("print attributes round-trip through save/load (backward-compatible format)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, [
    "set sheet printarea A1:D20",
    "set sheet printrepeatrows 1:1",
    "set sheet printrepeatcols A:B",
    "set sheet printorientation landscape",
    "set sheet printscale 80",
    "set sheet printmargins 1in",
  ]);

  const save = SC.CreateSheetSave(sheet);
  expect(save).toContain("printarea:A1\\cD20");
  expect(save).toContain("printrepeatrows:1\\c1");

  const reloaded = new SC.Sheet();
  SC.ParseSheetSave(save, reloaded);
  await recalcSheet(SC, reloaded);

  expect(reloaded.attribs.printarea).toBe("A1:D20");
  expect(reloaded.attribs.printrepeatrows).toBe("1:1");
  expect(reloaded.attribs.printrepeatcols).toBe("A:B");
  expect(reloaded.attribs.printorientation).toBe("landscape");
  expect(reloaded.attribs.printscale).toBe(80);
  expect(reloaded.attribs.printmargins).toBe("1in");
});

test("sheets saved without print attributes stay byte-compatible (no spurious print tokens)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const save = makeSave(["version:1.5", "cell:A1:v:1", "sheet:c:1:r:1"]);

  SC.ParseSheetSave(save, sheet);
  await recalcSheet(SC, sheet);

  const roundTrip = SC.CreateSheetSave(sheet);
  expect(roundTrip).not.toContain("printarea");
  expect(roundTrip).not.toContain("printrepeatrows");
  expect(roundTrip).not.toContain("printrepeatcols");
  expect(roundTrip).not.toContain("printorientation");
  expect(roundTrip).not.toContain("printscale");
  expect(roundTrip).not.toContain("printmargins");
});

test("EncodeSheetAttributes/DecodeSheetAttributes round-trip print fields", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  await scheduleCommands(SC, sheet, [
    "set sheet printarea A1:B2",
    "set sheet printrepeatrows 1:1",
    "set sheet printrepeatcols A:A",
    "set sheet printorientation landscape",
    "set sheet printscale 60",
    "set sheet printmargins 0.25in",
  ]);

  const enc = SC.EncodeSheetAttributes(sheet);
  expect(enc.printarea.def).toBe(false);
  expect(enc.printarea.val).toBe("A1:B2");
  expect(enc.printrepeatrows.val).toBe("1:1");
  expect(enc.printrepeatcols.val).toBe("A:A");
  expect(enc.printorientation.val).toBe("landscape");
  expect(enc.printscale.val).toBe(60);
  expect(enc.printmargins.val).toBe("0.25in");
  expect(SC.DecodeSheetAttributes(sheet, enc)).toBeNull(); // no changes, no-op

  enc.printarea = { def: true, val: "" };
  enc.printrepeatrows = { def: true, val: "" };
  enc.printrepeatcols = { def: true, val: "" };
  enc.printmargins = { def: true, val: "" };
  const cmds = SC.DecodeSheetAttributes(sheet, enc);
  expect(cmds).toContain("set sheet printarea ");
  expect(cmds).toContain("set sheet printrepeatrows ");
  expect(cmds).toContain("set sheet printrepeatcols ");
  expect(cmds).toContain("set sheet printmargins ");
});

test("fresh sheet reports print attributes as unset (def:true)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const enc = SC.EncodeSheetAttributes(sheet);
  expect(enc.printarea.def).toBe(true);
  expect(enc.printrepeatrows.def).toBe(true);
  expect(enc.printrepeatcols.def).toBe(true);
  expect(enc.printorientation.def).toBe(true);
  expect(enc.printscale.def).toBe(true);
  expect(enc.printmargins.def).toBe(true);
});

async function newPrintControl() {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const uniqueId = "print-ctrl-root-" + Math.random().toString(36).slice(2);
  const container = document.createElement("div");
  container.id = uniqueId;
  (document as any).body.appendChild(container);
  // Each control gets its own idPrefix -- the default "SocialCalc-" would
  // make every test's print-* form fields share the same DOM ids in this
  // file's single shared document, so one test mutating/removing a field
  // (e.g. the "missing print-scale field" test) would silently corrupt
  // every other test that runs afterward.
  const control = new SC.SpreadsheetControl(uniqueId + "-");
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { SC, control };
}

function waitEditor(
  editor: any,
  wantStatus: string | ((s: string) => boolean) = "cmdend",
  timeoutMs = 3000,
): Promise<void> {
  const matches = typeof wantStatus === "function" ? wantStatus : (s: string) => s === wantStatus;
  return new Promise((resolve) => {
    const key = "print_" + Math.random().toString(36).slice(2);
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

test("Print tab exists and LoadPrintSetupFields populates fields from sheet attributes", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, [
    "set sheet printarea A1:B3",
    "set sheet printorientation landscape",
    "set sheet printscale 50",
  ]);

  SC.LoadPrintSetupFields(control);

  const areaEle = document.getElementById(control.idPrefix + "print-area") as any;
  const orientationEle = document.getElementById(control.idPrefix + "print-orientation") as any;
  const scaleEle = document.getElementById(control.idPrefix + "print-scale") as any;
  expect(areaEle.value).toBe("A1:B3");
  expect(orientationEle.value).toBe("landscape");
  expect(scaleEle.value).toBe("50");
});

test("LoadPrintSetupFields defaults orientation/scale on an unconfigured sheet", async () => {
  const { SC, control } = await newPrintControl();
  SC.LoadPrintSetupFields(control);
  const orientationEle = document.getElementById(control.idPrefix + "print-orientation") as any;
  const scaleEle = document.getElementById(control.idPrefix + "print-scale") as any;
  const areaEle = document.getElementById(control.idPrefix + "print-area") as any;
  expect(orientationEle.value).toBe("portrait");
  expect(scaleEle.value).toBe("100");
  expect(areaEle.value).toBe("");
});

test("LoadPrintSetupFields is a no-op for any field missing from the DOM", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, [
    "set sheet printarea A1:B3",
    "set sheet printorientation landscape",
    "set sheet printscale 50",
  ]);

  // A synthetic idPrefix that never had a Print tab built for it -- every
  // print-* field lookup misses, so all the guarded `if (ele) ...`
  // branches take the missing-element path without error.
  const fakeControl = { idPrefix: "no-such-prefix-", sheet: control.sheet };
  expect(() => SC.LoadPrintSetupFields(fakeControl)).not.toThrow();
});

test("ApplyPrintSetup issues undo-able set sheet commands from the form fields", async () => {
  const { SC, control } = await newPrintControl();
  SC.SetSpreadsheetControlObject(control);

  const areaEle = document.getElementById(control.idPrefix + "print-area") as any;
  const repeatRowsEle = document.getElementById(control.idPrefix + "print-repeatrows") as any;
  const repeatColsEle = document.getElementById(control.idPrefix + "print-repeatcols") as any;
  const scaleEle = document.getElementById(control.idPrefix + "print-scale") as any;
  areaEle.value = "A1:C5";
  repeatRowsEle.value = "1:1";
  repeatColsEle.value = "A:A";
  scaleEle.value = "75";

  const done = waitEditor(control.editor);
  SC.ApplyPrintSetup();
  await done;

  expect(control.sheet.attribs.printarea).toBe("A1:C5");
  expect(control.sheet.attribs.printrepeatrows).toBe("1:1");
  expect(control.sheet.attribs.printrepeatcols).toBe("A:A");
  expect(control.sheet.attribs.printscale).toBe(75);

  await sheetUndo(SC, control.sheet);
  expect(control.sheet.attribs.printscale).toBeUndefined();
});

test("ApplyPrintSetup with unchanged fields issues no commands", async () => {
  const { SC, control } = await newPrintControl();
  SC.SetSpreadsheetControlObject(control);
  SC.LoadPrintSetupFields(control);

  const before = control.sheet.CreateAuditString();
  SC.ApplyPrintSetup();
  expect(control.sheet.CreateAuditString()).toBe(before);
});

test("ApplyPrintSetup falls back to defaults when every field is missing from the DOM", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, [
    "set sheet printarea A1:B2",
    "set sheet printrepeatrows 1:1",
    "set sheet printrepeatcols A:A",
    "set sheet printorientation landscape",
    "set sheet printscale 60",
  ]);

  // A synthetic idPrefix that never had a Print tab built for it, wrapping
  // the real sheet/editor -- every print-* field lookup misses, exercising
  // every guarded `ele ? ele.value : default` false branch at once.
  SC.SetSpreadsheetControlObject({
    idPrefix: "no-such-prefix-",
    sheet: control.sheet,
    editor: control.editor,
  });

  const done = waitEditor(control.editor);
  SC.ApplyPrintSetup();
  await done;

  // Every field missing -> every value falls back to its default
  // ("", "portrait", 100), all of which differ from the sheet's current
  // configured values, so every attribute clears back to unset.
  expect(control.sheet.attribs.printarea).toBeUndefined();
  expect(control.sheet.attribs.printrepeatrows).toBeUndefined();
  expect(control.sheet.attribs.printrepeatcols).toBeUndefined();
  expect(control.sheet.attribs.printorientation).toBeUndefined();
  expect(control.sheet.attribs.printscale).toBeUndefined();
});

test("PreparePrintArea masks cells outside printarea and marks repeat row/column headers", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, [
    "set A1 value n 1",
    "set C3 value n 2",
    "set sheet printarea A1:B2",
    "set sheet printrepeatrows 1:1",
    "set sheet printrepeatcols A:A",
  ]);
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();

  const preC3 = control.editor.fullgrid.querySelector(
    "#" + control.editor.context.cellIDprefix + "C3",
  );
  // Give the to-be-hidden cell a pre-existing class so the append path
  // (`className + " " + "sc-print-hide"`) is exercised, not just the
  // from-empty path.
  preC3.className = "existing-cell-class";

  SC.PreparePrintArea(control);

  const fullgrid = control.editor.fullgrid;
  expect(fullgrid.className).toContain("sc-print-area");

  const c3 = fullgrid.querySelector("#" + control.editor.context.cellIDprefix + "C3");
  expect(c3.className).toContain("sc-print-hide");

  const a1 = fullgrid.querySelector("#" + control.editor.context.cellIDprefix + "A1");
  expect(a1.className).not.toContain("sc-print-hide");

  const headerRows = fullgrid.querySelectorAll('[role="row"]');
  const repeatedHeaderRow = headerRows.find(
    (row: any) => row.getAttribute("aria-rowindex") === "1",
  );
  expect(repeatedHeaderRow.className).toContain("sc-print-repeat-row");

  const headerCells = fullgrid.querySelectorAll('[role="rowheader"],[role="columnheader"]');
  const colAHeader = headerCells.find((cell: any) => cell.getAttribute("aria-colindex") === "1");
  expect(colAHeader.className).toContain("sc-print-repeat-col");
  const colBHeader = headerCells.find((cell: any) => cell.getAttribute("aria-colindex") === "2");
  expect(colBHeader.className).not.toContain("sc-print-repeat-col");

  const pageStyleEle = document.getElementById("sc-print-page-style") as any;
  expect(pageStyleEle).toBeTruthy();
  expect(pageStyleEle.textContent).toContain("@page");
  expect(pageStyleEle.textContent).toContain("portrait");
});

test("PreparePrintArea emits landscape orientation and scale in the injected @page rule", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, [
    "set A1 value n 1",
    "set sheet printorientation landscape",
    "set sheet printscale 50",
    "set sheet printmargins 0.5in",
  ]);
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();

  SC.PreparePrintArea(control);

  const pageStyleEle = document.getElementById("sc-print-page-style") as any;
  expect(pageStyleEle.textContent).toContain("landscape");
  expect(pageStyleEle.textContent).toContain("0.5in");
  expect(pageStyleEle.textContent).toContain("zoom: 0.5");

  // Re-running reuses (does not duplicate) the injected <style> element.
  SC.PreparePrintArea(control);
  expect(
    Array.from(document.head.childNodes).filter((n: any) => n.id === "sc-print-page-style").length,
  ).toBe(1);
});

test("PreparePrintArea with no printarea/repeat attributes hides nothing and marks no repeat headers", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1", "set C3 value n 2"]);
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();

  SC.PreparePrintArea(control);

  const fullgrid = control.editor.fullgrid;
  const c3 = fullgrid.querySelector("#" + control.editor.context.cellIDprefix + "C3");
  expect(c3.className).not.toContain("sc-print-hide");

  const headerRows = fullgrid.querySelectorAll('[role="row"]');
  for (const row of headerRows) {
    expect(row.className).not.toContain("sc-print-repeat-row");
  }
});

test("PreparePrintArea re-run appends sc-print-repeat-col onto a header cell that already has a class", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1", "set sheet printrepeatcols A"]);
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();

  const fullgrid = control.editor.fullgrid;
  const headerCells = fullgrid.querySelectorAll('[role="rowheader"],[role="columnheader"]');
  const colAHeader = headerCells.find((cell: any) => cell.getAttribute("aria-colindex") === "1");
  // Give the header a pre-existing class so the append path
  // (`className + " " + "sc-print-repeat-col"`) is exercised, not just the
  // from-empty path.
  colAHeader.className = "existing-class";

  SC.PreparePrintArea(control);

  expect(colAHeader.className).toBe("existing-class sc-print-repeat-col");
});

test("PreparePrintArea re-run appends sc-print-repeat-row onto a header row that already has a class", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1", "set sheet printrepeatrows 1"]);
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();

  const fullgrid = control.editor.fullgrid;
  const headerRow = fullgrid
    .querySelectorAll('[role="row"]')
    .find((row: any) => row.getAttribute("aria-rowindex") === "1");
  // Give the header row a pre-existing class so the append path
  // (`className + " " + "sc-print-repeat-row"`) is exercised, not just the
  // from-empty path.
  headerRow.className = "existing-row-class";

  SC.PreparePrintArea(control);

  expect(headerRow.className).toBe("existing-row-class sc-print-repeat-row");
});

test("PreparePrintArea returns without error when the editor has not rendered a grid yet", async () => {
  const { SC, control } = await newPrintControl();
  control.editor.fullgrid = null;
  expect(() => SC.PreparePrintArea(control)).not.toThrow();
});

test("PreparePrintArea builds the sc-print-area class from scratch when fullgrid has no prior className", async () => {
  const { SC, control } = await newPrintControl();
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();
  control.editor.fullgrid.className = "";

  SC.PreparePrintArea(control);

  expect(control.editor.fullgrid.className).toBe("sc-print-area");
});

test("TriggerPrint calls window.print() only from an explicit invocation, preparing the print area first", async () => {
  const { SC, control } = await newPrintControl();
  SC.SetSpreadsheetControlObject(control);
  const done = waitEditor(control.editor);
  control.editor.EditorScheduleSheetCommands(
    ["set A1 value n 1", "set sheet printarea A1:A1"].join("\n"),
    true,
    false,
  );
  await done;
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();

  let printCalls = 0;
  const originalPrint = (globalThis as any).print;
  (globalThis as any).print = () => {
    printCalls++;
  };

  SC.TriggerPrint();

  expect(printCalls).toBe(1);
  expect(control.editor.fullgrid.className).toContain("sc-print-area");

  (globalThis as any).print = originalPrint;
});

test("TriggerPrint is a no-op when no SpreadsheetControl is active", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  SC.SetSpreadsheetControlObject(null);
  SC.CurrentSpreadsheetViewerObject = null;
  expect(() => SC.TriggerPrint()).not.toThrow();
});

test("TriggerPrint does not throw when the host environment has no window.print", async () => {
  const { SC, control } = await newPrintControl();
  SC.SetSpreadsheetControlObject(control);
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);
  control.editor.EditorRenderSheet();

  const originalPrint = (globalThis as any).print;
  (globalThis as any).print = undefined;
  try {
    expect(() => SC.TriggerPrint()).not.toThrow();
    // PreparePrintArea still runs even though print() is unavailable.
    expect(control.editor.fullgrid.className).toContain("sc-print-area");
  } finally {
    (globalThis as any).print = originalPrint;
  }
});
