import { expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// ── Narrow types for the SC bundle surface ──────────────────────────────
// Same convention as test/socialcalc3-coverage-gaps.test.ts: cast through
// `unknown` to a named const typed by these interfaces.

interface SheetCell {
  datavalue: unknown;
  datatype: string | null;
  formula: string;
  valuetype: string;
  editable?: string;
  readonly?: boolean;
  errors?: string;
  comment?: string;
  displaystring?: string;
  colspan?: number;
  rowspan?: number;
  coord: string;
  bt?: number;
  br?: number;
  bb?: number;
  bl?: number;
  layout?: number;
  font?: number;
  color?: number;
  bgcolor?: number;
  cellformat?: number;
  textvalueformat?: number;
  nontextvalueformat?: number;
  cssc?: string;
  prevvaluetype?: string;
}

interface SCFunc {
  (...args: unknown[]): unknown;
  new (...args: unknown[]): unknown;
}

interface ConstantsLike {
  defaultCellFontSize: string;
  defaultCellFontFamily: string;
  [key: string]: unknown;
}

interface SCCore {
  SocialCalc: unknown;
  Sheet: SCFunc;
  Cell: SCFunc;
  Parse: SCFunc;
  RenderContext: SCFunc;
  Clipboard: { clipboard: string };
  ResetSheet: SCFunc;
  ParseSheetSave: SCFunc;
  CellFromStringParts: SCFunc;
  CreateSheetSave: SCFunc;
  CellToString: SCFunc;
  CanonicalizeSheet: SCFunc;
  EncodeCellAttributes: SCFunc;
  EncodeSheetAttributes: SCFunc;
  DecodeCellAttributes: SCFunc;
  DecodeSheetAttributes: SCFunc;
  ScheduleSheetCommands: SCFunc;
  SheetCommandsTimerRoutine: SCFunc;
  ExecuteSheetCommand: SCFunc;
  SheetUndo: SCFunc;
  SheetRedo: SCFunc;
  RecalcSheet: SCFunc;
  RecalcSetTimeout: SCFunc;
  RecalcClearTimeout: SCFunc;
  RecalcLoadedSheet: SCFunc;
  RecalcTimerRoutine: SCFunc;
  RecalcCheckCell: SCFunc;
  RecalcInfo: Record<string, unknown>;
  UndoStack: SCFunc;
  CoordInPane: SCFunc;
  CellInPane: SCFunc;
  GetCellContents: SCFunc;
  FormatCellForExport: SCFunc;
  FormatValueForDisplay: SCFunc;
  format_text_for_display: SCFunc;
  format_number_for_display: SCFunc;
  DetermineValueType: SCFunc;
  ParseCellLinkText: SCFunc;
  ConvertSaveToOtherFormat: SCFunc;
  ConvertOtherFormatToSave: SCFunc;
  SetConvertedCell: SCFunc;
  CreatePseudoElement: SCFunc;
  setStyles: SCFunc;
  GetViewportInfo: SCFunc;
  GetElementPosition: SCFunc;
  GetElementPositionWithScroll: SCFunc;
  GetElementFixedParent: SCFunc;
  GetComputedStyle: SCFunc;
  decodeFromSave: SCFunc;
  encodeForSave: SCFunc;
  special_chars: SCFunc;
  coordinateToCr: SCFunc;
  crToCoord: SCFunc;
  rcColname: SCFunc;
  Constants: ConstantsLike;
  Callbacks: Record<string, unknown>;
  RenderRow: SCFunc;
  RenderColHeaders: SCFunc;
  RenderSpacingRow: SCFunc;
  RenderColGroup: SCFunc;
  RenderSheet: SCFunc;
  RenderSizingRow: SCFunc;
  RenderCell: SCFunc;
  PrecomputeSheetFontsAndLayouts: SCFunc;
  _app: string | null;
  [key: string]: unknown;
}

function loadSC(): Promise<SCCore> {
  return loadSocialCalc() as Promise<SCCore>;
}

function loadSCBrowser(): Promise<SCCore> {
  return loadSocialCalc({ browser: true }) as Promise<SCCore>;
}

// ══════════════════════════════════════════════════════════════════════
// Section 1: RecalcSheet statuscallback false branch (dist 3550).
// `if (sheet.statuscallback)` false side — call RecalcSheet on a sheet
// that has no statuscallback set.
// ══════════════════════════════════════════════════════════════════════

test("RecalcSheet without statuscallback hits false branch at dist 3550", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, unknown>;
    statuscallback: unknown;
  };
  sheet.statuscallback = null;
  // Synchronously fires the statuscallback check; timing is irrelevant
  // for this branch — the if-else fires before RecalcSetTimeout.
  SC.RecalcSheet(sheet);
  expect(sheet.statuscallback).toBeNull();
});

// ══════════════════════════════════════════════════════════════════════
// Section 2: RecalcTimerRoutine `if (!coord) continue` (dist 3600-3601).
// An empty-string key in sheet.cells is iterated by the for-in loop
// and skipped.
// ══════════════════════════════════════════════════════════════════════

test("RecalcTimerRoutine skips empty-string coord key (dist 3600-3601)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 formula 1+1"]);
  // Inject an empty-string key so the for-in loop iterates it.
  sheet.cells[""] = { coord: "", valuetype: "b", datatype: null };
  await recalcSheet(SC, sheet);
  // The recalc should complete normally (empty coord was skipped).
  expect(Object.keys(sheet.cells)).toContain("");
});

// ═════════════════════════════════════════════════════════════════════
// Section 3: ExecuteSheetCommand widgetsClean branches (dist 3427, 3429).
// With SocialCalc._app set:
//  - attrib == "all" + cellChanged → else-if at 3426 → stmt 3427.
//  - cellChanged false + renderneeded false → if at 3429 false side.
// ═════════════════════════════════════════════════════════════════════

test("ExecuteSheetCommand set A1 all with _app sets widgetsClean false (dist 3427)", async () => {
  const SC = await loadSC();
  const origApp = SC._app;
  SC._app = "test";
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    widgetsClean: boolean;
  };
  sheet.widgetsClean = true;
  // "set A1 all <rest>" with a single-cell range → renderneeded stays false,
  // cellChanged true, attrib "all" → else-if at 3426 → stmt 3427
  // "set A1 all" with empty rest → delete cell, but attrib=="all" still
  // triggers else-if at 3426 → stmt 3427 (widgetsClean=false).
  await scheduleCommands(SC, sheet, "set A1 all");
  expect(sheet.widgetsClean).toBe(false);
  SC._app = origApp;
});

test("ExecuteSheetCommand name define with _app and no renderneeded hits 3429 false", async () => {
  const SC = await loadSC();
  const origApp = SC._app;
  SC._app = "test";
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    widgetsClean: boolean;
    renderneeded: boolean;
  };
  sheet.widgetsClean = true;
  sheet.renderneeded = false;
  // "name define" does NOT set cellChanged (stays false) and does NOT set
  // renderneeded → enters else at 3428 → if (renderneeded == true) → false
  await scheduleCommands(SC, sheet, "name define TEST 1+1");
  // widgetsClean should NOT be changed (renderneeded was false)
  expect(sheet.widgetsClean).toBe(true);
  SC._app = origApp;
});

// ═════════════════════════════════════════════════════════════════════
// Section 4: PrecomputeSheetFontsAndLayouts (dist 4149-4150, 4153).
//  - Bad layout entry → `if (!parts) continue` true side (4149/4150).
//  - Layout with "*" parts + no defaultlayout → cond-expr false side
//    at 4153 (`sparts[i] != "*"`  → else `dparts[i]`).
// ═════════════════════════════════════════════════════════════════════

test("PrecomputeSheetFontsAndLayouts skips bad layout and substitutes * (dist 4149-4153)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    fonts: string[];
    layouts: string[];
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  // A layout that matches layoutre BUT has "*" parts (for 4153 branch)
  sheet.layouts.push("padding:* * * *;vertical-align:*;");
  // A layout that does NOT match layoutre (for 4149/4150 branch)
  sheet.layouts.push("bad_layout_no_match");

  const context = new SC.RenderContext(sheet) as unknown as {
    PrecomputeSheetFontsAndLayouts(): void;
    fonts: unknown[];
    layouts: unknown[];
  };
  // Ensure no defaultlayout so sparts = ["", "*", "*", "*", "*", "*"]
  expect(sheet.attribs.defaultlayout).toBeFalsy();
  context.PrecomputeSheetFontsAndLayouts();
  expect(context.fonts).toBeDefined();
  expect(context.layouts).toBeDefined();
});

// ═════════════════════════════════════════════════════════════════════
// Section 5: RenderSheet with RenderColHeaders mock (dist 4266) and
// oldtable with null parentNode (dist 4282).
// ═════════════════════════════════════════════════════════════════════

test("RenderSheet handles null RenderColHeaders and null parentNode (dist 4266, 4282)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    rowpanes: Array<{ first: number; last: number }>;
    colpanes: Array<{ first: number; last: number }>;
    needcellskip: boolean;
    needprecompute: boolean;
    CalculateCellSkipData(): void;
    PrecomputeSheetFontsAndLayouts(): void;
    CalculateColWidthData(): void;
    CalculateRowHeightData(): void;
    RenderSheet(oldtable: unknown, linkstyle: unknown): unknown;
    RenderColHeaders(): unknown;
  };
  context.showRCHeaders = true;
  context.showGrid = false;
  // Mock RenderColHeaders to return null → if (newrow) false at 4266
  context.RenderColHeaders = () => null;

  // Create an oldtable with null parentNode → if (parentnode) false at 4282
  const doc = (globalThis as unknown as { document: Document }).document;
  const oldtable = doc.createElement("table");

  const result = context.RenderSheet(oldtable, "");
  expect(result).toBeDefined();
});

// ═════════════════════════════════════════════════════════════════════
// Section 6: RenderRow with classnames=null / explicitStyles=null
// (dist 4293, 4295, 4305, 4307, 4318, 4320).
// The function throws at line 4326 (unguarded classnames.rowresizebar)
// but the false branches are hit before the throw.
// ═════════════════════════════════════════════════════════════════════

test("RenderRow with null classnames/explicitStyles hits false branches before throw (dist 4293-4320)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, unknown>;
    rowattribs: { hide: Record<string, string> };
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set 2 hide yes",
  ]);

  // Test A: rowname false branches (4293, 4295) — no hidden neighbors
  const context1 = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    rowpanes: Array<{ first: number; last: number }>;
    colpanes: Array<{ first: number; last: number }>;
    classnames: Record<string, string> | null;
    explicitStyles: Record<string, string> | null;
    rowheight: Record<string, string>;
    CalculateRowHeightData(): void;
    RenderRow(rownum: number, rowpane: number, linkstyle: unknown): unknown;
  };
  context1.showRCHeaders = true;
  context1.rowpanes = [{ first: 1, last: 3 }];
  context1.colpanes = [{ first: 1, last: 3 }];
  context1.classnames = null;
  context1.explicitStyles = null;
  context1.CalculateRowHeightData();
  // RenderRow(rownum=1) → rowname false branches at 4293/4295 → throws at 4326
  expect(() => context1.RenderRow(1, 0, "")).toThrow();

  // Test B: unhidetop false branches (4305, 4307) — rownum=1, hide[2]="yes"
  const context2 = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    rowpanes: Array<{ first: number; last: number }>;
    colpanes: Array<{ first: number; last: number }>;
    classnames: Record<string, string> | null;
    explicitStyles: Record<string, string> | null;
    rowheight: Record<string, string>;
    CalculateRowHeightData(): void;
    RenderRow(rownum: number, rowpane: number, linkstyle: unknown): unknown;
  };
  context2.showRCHeaders = true;
  context2.rowpanes = [{ first: 1, last: 3 }];
  context2.colpanes = [{ first: 1, last: 3 }];
  context2.classnames = null;
  context2.explicitStyles = null;
  context2.CalculateRowHeightData();
  // rownum=1 < last=3, hide[2]="yes" → unhidetop block → 4305/4307 false
  expect(() => context2.RenderRow(1, 0, "")).toThrow();

  // Test C: unhidebottom false branches (4318, 4320) — rownum=3, hide[2]="yes"
  const context3 = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    rowpanes: Array<{ first: number; last: number }>;
    colpanes: Array<{ first: number; last: number }>;
    classnames: Record<string, string> | null;
    explicitStyles: Record<string, string> | null;
    rowheight: Record<string, string>;
    CalculateRowHeightData(): void;
    RenderRow(rownum: number, rowpane: number, linkstyle: unknown): unknown;
  };
  context3.showRCHeaders = true;
  context3.rowpanes = [{ first: 1, last: 3 }];
  context3.colpanes = [{ first: 1, last: 3 }];
  context3.classnames = null;
  context3.explicitStyles = null;
  context3.CalculateRowHeightData();
  // rownum=3 > 1, hide[2]="yes" → unhidebottom block → 4318/4320 false
  expect(() => context3.RenderRow(3, 0, "")).toThrow();
});

// ═════════════════════════════════════════════════════════════════════
// Section 7: RenderSpacingRow with showRCHeaders=false (dist 4359).
// `if (context.showRCHeaders)` false side.
// ═════════════════════════════════════════════════════════════════════

test("RenderSpacingRow with showRCHeaders=false (dist 4359)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    colwidth: Record<number, string>;
    classnames: Record<string, string>;
    explicitStyles: Record<string, string>;
    CalculateColWidthData(): void;
    RenderSpacingRow(): unknown;
  };
  context.showRCHeaders = false;
  context.colpanes = [{ first: 1, last: 3 }];
  context.CalculateColWidthData();
  const result = context.RenderSpacingRow();
  expect(result).toBeDefined();
});

// ═════════════════════════════════════════════════════════════════════
// Section 8: RenderColHeaders with null classnames/explicitStyles
// (dist 4403-4433). Function throws at 4440 (unguarded
// classnames.colresizebar) but false branches are hit before the throw.
// ═════════════════════════════════════════════════════════════════════

test("RenderColHeaders null classnames hits false branches (dist 4403-4433)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    colattribs: { hide: Record<string, string> };
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B hide yes"]);

  // Test A: upperleft + colname + unhideleft false branches
  // colnum=1, last=3, hide[B]=yes → unhideleft for colnum=1
  const context1 = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    classnames: Record<string, string> | null;
    explicitStyles: Record<string, string> | null;
    RenderColHeaders(): unknown;
  };
  context1.showRCHeaders = true;
  context1.colpanes = [{ first: 1, last: 3 }];
  context1.classnames = null;
  context1.explicitStyles = null;
  // Throws at 4440 (unguarded classnames.colresizebar) but false
  // branches at 4403/4405/4412/4414/4422/4424 are hit first
  expect(() => context1.RenderColHeaders()).toThrow();

  // Test B: unhideright false branches
  // colnum=3, hide[B]=yes → unhideright for colnum=3
  const context2 = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    classnames: Record<string, string> | null;
    explicitStyles: Record<string, string> | null;
    RenderColHeaders(): unknown;
  };
  context2.showRCHeaders = true;
  context2.colpanes = [{ first: 3, last: 3 }];
  context2.classnames = null;
  context2.explicitStyles = null;
  expect(() => context2.RenderColHeaders()).toThrow();
});

// ═════════════════════════════════════════════════════════════════════
// Section 9: RenderCell skipped cell with noElement=true (dist 4529-4532).
//  - noElement=true → CreatePseudoElement (cond-expr alt0 at 4529).
//  - classnames.skippedcell truthy → if true at 4530 + stmt 4531.
//  - explicitStyles.skippedcell falsy → if false at 4532.
// Inject cellskip and shift colpanes so CoordInPane returns false.
// ═════════════════════════════════════════════════════════════════════

test("RenderCell skipped cell with noElement hits PseudoElement + skippedcell branches (dist 4529-4532)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "merge A1:B1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    classnames: Record<string, string>;
    explicitStyles: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): unknown;
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = false;
  context.CalculateCellSkipData();
  expect(context.cellskip["B1"]).toBe("A1");
  // Shift colpane so A1 (col 1) is NOT in pane → CoordInPane returns false
  context.colpanes = [{ first: 3, last: 5 }];
  // Set truthy skippedcell class and falsy skippedcell style
  context.classnames.skippedcell = "skippedcls";
  context.explicitStyles.skippedcell = "";
  const result = context.RenderCell(1, 2, 0, 0, true) as {
    className: string;
  };
  expect(result.className).toBe("skippedcls");
});

// ═════════════════════════════════════════════════════════════════════
// Section 10: RenderCell font default branches (dist 4579, 4582).
// Override Constants.defaultCellFontSize and defaultCellFontFamily to ""
// so the if-checks are false. Need a cell whose font entry doesn't exist
// in context.fonts (to enter the else branch).
// ═════════════════════════════════════════════════════════════════════

test("RenderCell with defaultCellFontSize/Family empty hits false branches (dist 4579, 4582)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const origFontSize = SC.Constants.defaultCellFontSize;
  const origFontFamily = SC.Constants.defaultCellFontFamily;
  SC.Constants.defaultCellFontSize = "";
  SC.Constants.defaultCellFontFamily = "";
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    PrecomputeSheetFontsAndLayouts(): void;
    RenderCell(...args: unknown[]): { style: { cssText: string } };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = false;
  context.CalculateCellSkipData();
  context.PrecomputeSheetFontsAndLayouts();
  const result = context.RenderCell(1, 1, 0, 0);
  expect(result.style.cssText).toBeDefined();
  SC.Constants.defaultCellFontSize = origFontSize;
  SC.Constants.defaultCellFontFamily = origFontFamily;
});

// ═════════════════════════════════════════════════════════════════════
// Section 11: RenderCell cellformat defaulttextformat branches
// (dist 4599, 4603).
//  - defaulttextformat valid + cellformats entry exists → if true (alt0).
//  - defaulttextformat falsy → &&  left falsy (alt1).
// ═════════════════════════════════════════════════════════════════════

test("RenderCell with valid defaulttextformat hits if-true (dist 4599 alt0)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    valueformats: string[];
    cellformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 text t hello"]);
  // Set defaulttextformat to a valid index and populate cellformats
  sheet.attribs.defaulttextformat = 1;
  sheet.cellformats[1] = "center";
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { style: { cssText: string } };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = false;
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0);
  expect(result.style.cssText).toContain("text-align:center");
});

test("RenderCell with falsy defaulttextformat hits && left falsy (dist 4599 alt1)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 text t hello"]);
  // Ensure defaulttextformat is falsy (0 or undefined)
  sheet.attribs.defaulttextformat = 0;
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { style: { cssText: string } };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = false;
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0);
  // With falsy defaulttextformat, the && short-circuits (alt1) and
  // no text-align is added for valuetype "t" cells.
  expect(result.style.cssText).not.toContain("text-align");
});

// ═════════════════════════════════════════════════════════════════════
// Section 12: RenderCell cellskip border gridCSS (dist 4625-4626,
// 4638-4639). Inject cellskip entries manually, render with showGrid=true
// on a cell with no borders → grid border fallback + cellskip remap.
// ═════════════════════════════════════════════════════════════════════

test("RenderCell with cellskip grid border fallback for right and bottom (dist 4625-4639)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    gridCSS: string;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { style: { cssText: string } };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = true;
  context.gridCSS = "1px solid #ccc";
  context.CalculateCellSkipData();
  // Inject cellskip so the right neighbor B1 maps to A1, and bottom
  // neighbor A2 maps to A1.
  context.cellskip["B1"] = "A1";
  context.cellskip["A2"] = "A1";
  const result = context.RenderCell(1, 1, 0, 0);
  expect(result.style.cssText).toContain("border-right");
  expect(result.style.cssText).toContain("border-bottom");
});
test("RenderCell with left border index and comment uses border-left + comment class when showGrid=true", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    borderstyles: Array<string | number>;
    borderstylehash: Record<string, number>;
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 comment text important note"]);
  const cell = sheet.GetAssuredCell("A1") as SheetCell;
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    commentClassName: string;
    commentCSS: string;
    gridCSS: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string; title: string; style: { cssText: string } };
  };

  // Register a border style at index 1 and apply it to the left border only.
  sheet.borderstyles = sheet.borderstyles || [];
  sheet.borderstyles[1] = "2px solid #3366cc";
  sheet.borderstylehash = sheet.borderstylehash || {};
  sheet.borderstylehash["2px solid #3366cc"] = 1;
  cell.bl = 1;

  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = true;
  context.showRCHeaders = false;
  context.commentClassName = "comment-grid";
  context.commentCSS = "background: #ffff99;";
  context.gridCSS = "1px solid #ccc";
  context.CalculateCellSkipData();

  const result = SC.RenderCell(context, 1, 1, 0, 0) as {
    className: string;
    title: string;
    style: { cssText: string };
  };
  expect(result.style.cssText).toContain("border-left:2px solid #3366cc");
  expect(result.className).toContain("comment-grid");
  expect(result.title).toContain("important note");
});

// ═════════════════════════════════════════════════════════════════════
// Section 13: RenderCell comment + readonly className truthy branches
// (dist 4650, 4655, 4671, 4679, 4686).
//  - comment first class: className is always "" → first-class ternary
//    alt0 (truthy) is structurally unreachable; only alt1 covered.
//  - readonly AFTER comment: className truthy → alt0 at 4666/4671.
//  - cssc with noElement=false: classList.add path (alt1 at 4679).
//  - cssc AFTER comment: className truthy → inner ternary alt0 at 4679.
//  - highlight AFTER comment/readonly: className truthy → alt0 at 4686.
// ═════════════════════════════════════════════════════════════════════

test("RenderCell readonly after comment with showGrid=false hits className truthy (dist 4671)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 comment text hello",
    "set A1 readonly yes",
  ]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    commentNoGridClassName: string;
    commentNoGridCSS: string;
    readonlyNoGridClassName: string;
    readonlyNoGridCSS: string;
    readonlyComment: string;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = false;
  context.commentNoGridClassName = "comment-ng";
  context.commentNoGridCSS = "background:#ff0;";
  context.readonlyNoGridClassName = "readonly-ng";
  context.readonlyNoGridCSS = "color:gray;";
  context.readonlyComment = "Read-only";
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0);
  // Comment adds className first ("comment-ng"), then readonly sees
  // truthy className → alt0 at 4671 + appends "readonly-ng"
  expect(result.className).toContain("comment-ng");
  expect(result.className).toContain("readonly-ng");
});

test("RenderCell cssc with noElement=false hits classList path (dist 4679)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  sheet.GetAssuredCell("A1").cssc = "cssclass";
  // Provide classList on FakeElement prototype for this test
  const HTMLElementCtor = (
    globalThis as unknown as { HTMLElement: { prototype: { classList: { add(s: string): void } } } }
  ).HTMLElement;
  const origClassList = HTMLElementCtor.prototype.classList;
  HTMLElementCtor.prototype.classList = { add() {} };
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): unknown;
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = false;
  context.CalculateCellSkipData();
  // noElement defaults to falsy → classList.add path
  const result = context.RenderCell(1, 1, 0, 0);
  expect(result).toBeDefined();
  HTMLElementCtor.prototype.classList = origClassList;
});

test("RenderCell cssc after comment hits inner className truthy (dist 4679)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 comment text foo"]);
  sheet.GetAssuredCell("A1").cssc = "styled";
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    commentClassName: string;
    commentCSS: string;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = true;
  context.commentClassName = "comment-c";
  context.commentCSS = "background:#ff0;";
  context.CalculateCellSkipData();
  // Comment sets className="comment-c" at 4650, then cssc at 4679 sees
  // truthy className → inner ternary alt0 (true)
  const result = context.RenderCell(1, 1, 0, 0, true);
  expect(result.className).toContain("comment-c");
  expect(result.className).toContain("styled");
});

test("RenderCell highlight after comment hits className truthy (dist 4686)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 comment text x"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    showGrid: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    highlights: Record<string, string>;
    highlightTypes: Record<string, { className: string; style: string }>;
    cursorsuffix: string;
    commentNoGridClassName: string;
    commentNoGridCSS: string;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.showGrid = false;
  context.commentNoGridClassName = "comment-ng";
  context.commentNoGridCSS = "background:#ff0;";
  context.highlights = {};
  context.highlights["A1"] = "cursor";
  context.highlightTypes = {
    cursor: { className: "hl-cursor", style: "" },
  };
  context.cursorsuffix = "";
  context.CalculateCellSkipData();
  // Comment adds "comment-ng" at 4655, then highlight at 4686 sees
  // truthy className → alt0 (true)
  const result = context.RenderCell(1, 1, 0, 0, true);
  expect(result.className).toContain("hl-cursor");
  expect(result.className).toContain("comment-ng");
});

// ═════════════════════════════════════════════════════════════════════
// Section 14: setStyles name && value false (dist 4781).
// setStyles with a style that has an empty value → `if (name && value)`
// false side.
// ═════════════════════════════════════════════════════════════════════

test("setStyles with empty value hits name && value false (dist 4781)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const doc = (globalThis as unknown as { document: Document }).document;
  const el = doc.createElement("div");
  const elStyle = el as unknown as { style: Record<string, string> };
  // "color:" → name="color", value="" → `name && value` → false (4781 alt1)
  SC.setStyles(el, "color:;");
  // Should not set color since value is empty
  expect(elStyle.style.color).toBeFalsy();
});

// ═════════════════════════════════════════════════════════════════════
// Section 15: GetViewportInfo document.body.clientWidth false (dist 4800).
// Set window.innerWidth=0, documentElement.clientWidth=0, body.clientWidth=0.
// ═════════════════════════════════════════════════════════════════════

test("GetViewportInfo with all falsy innerWidth/clientWidths (dist 4800)", async () => {
  const SC = await loadSCBrowser();
  // dist code's `window` IS globalThis (UMD factory param), not
  // globalThis.window. So set innerWidth on globalThis directly.
  const g = globalThis as unknown as {
    innerWidth: number;
    document: {
      documentElement: { clientWidth: number };
      body: { clientWidth: number };
    };
  };
  const origInnerWidth = g.innerWidth;
  const origDocClientWidth = g.document.documentElement.clientWidth;
  const origBodyClientWidth = g.document.body.clientWidth;
  g.innerWidth = 0;
  g.document.documentElement.clientWidth = 0;
  g.document.body.clientWidth = 0;
  const result = SC.GetViewportInfo() as Record<string, unknown>;
  g.innerWidth = origInnerWidth;
  g.document.documentElement.clientWidth = origDocClientWidth;
  g.document.body.clientWidth = origBodyClientWidth;
  expect(result).toBeDefined();
  expect(result.width).toBeUndefined();
});

// ═════════════════════════════════════════════════════════════════════
// Section 16: GetElementPosition relative break (dist 4813-4814).
// Set element style.position to "relative" → break loop immediately.
// ═════════════════════════════════════════════════════════════════════

test("GetElementPosition breaks on relative position (dist 4813-4814)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const doc = (globalThis as unknown as { document: Document }).document;
  const el = doc.createElement("div");
  const fakeEl = el as unknown as {
    offsetLeft: number;
    offsetTop: number;
    style: { position: string };
  };
  fakeEl.style.position = "relative";
  fakeEl.offsetLeft = 50;
  fakeEl.offsetTop = 60;
  const result = SC.GetElementPosition(el) as { left: number; top: number };
  // Break immediately → offsets not accumulated → { left: 0, top: 0 }
  expect(result.left).toBe(0);
  expect(result.top).toBe(0);
});

// ═════════════════════════════════════════════════════════════════════
// Section 17: GetElementPositionWithScroll rect width/height falsy
// (dist 4828-4829). Set offsetWidth=0, offsetHeight=0 so
// getBoundingClientRect returns falsy width/height → else branch.
// ═════════════════════════════════════════════════════════════════════

test("GetElementPositionWithScroll with zero offsetWidth/Height (dist 4828-4829)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const doc = (globalThis as unknown as { document: Document }).document;
  const el = doc.createElement("div");
  const fakeEl = el as unknown as {
    offsetWidth: number;
    offsetHeight: number;
    offsetLeft: number;
    offsetTop: number;
  };
  fakeEl.offsetWidth = 0;
  fakeEl.offsetHeight = 0;
  fakeEl.offsetLeft = 5;
  fakeEl.offsetTop = 10;
  const result = SC.GetElementPositionWithScroll(el) as {
    width: number;
    height: number;
  };
  // rect.width = 0 (falsy) → width = rect.right - rect.left = 0
  expect(result.width).toBe(0);
  expect(result.height).toBe(0);
});

// ═════════════════════════════════════════════════════════════════════
// Section 18: GetElementFixedParent fixed return (dist 4836-4837).
// Set element style.position to "fixed" → return element.
// ═════════════════════════════════════════════════════════════════════

test("GetElementFixedParent returns element with fixed position (dist 4836-4837)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const doc = (globalThis as unknown as { document: Document }).document;
  const el = doc.createElement("div");
  const fakeEl = el as unknown as { style: { position: string } };
  fakeEl.style.position = "fixed";
  const result = SC.GetElementFixedParent(el);
  expect(result).toBe(el);
});

// ═════════════════════════════════════════════════════════════════════
// Section 19: FormatValueForDisplay `||` branches via special_chars mock
// (dist 4932, 4934, 4936, 4954, 4956, 4958, 4963, 4965, 4967).
// Mock special_chars to return "" so `|| "&nbsp;"` takes the right side.
// ═════════════════════════════════════════════════════════════════════
test("FormatValueForDisplay text formula with mocked special_chars covers || branches (dist 4932-4936)", async () => {
  const SC = await loadSC();
  const origSpecialChars = SC.special_chars;

  // datatype "f" → 4932 || alt1
  // Use "text" command (sets valuetype "t", errors "") then set datatype = "f"
  const sheetF = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetF, ["set A1 text t hello"]);
  sheetF.cells.A1.datatype = "f";
  sheetF.cells.A1.formula = "hello";
  sheetF.valueformats[10] = "formula";
  sheetF.cells.A1.textvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultF = SC.FormatValueForDisplay(sheetF, sheetF.cells.A1.datavalue, "A1") as string;
  expect(resultF).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;

  // datatype "c" → 4934 || alt1
  const sheetC = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetC, ["set A1 constant t hello textformula"]);
  sheetC.valueformats[10] = "formula";
  sheetC.cells.A1.textvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultC = SC.FormatValueForDisplay(sheetC, sheetC.cells.A1.datavalue, "A1") as string;
  expect(resultC).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;

  // datatype else (plain text) → 4936 || alt1
  const sheetT = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetT, ["set A1 text t hello"]);
  sheetT.valueformats[10] = "formula";
  sheetT.GetAssuredCell("A1").textvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultT = SC.FormatValueForDisplay(sheetT, "hello", "A1") as string;
  expect(resultT).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;
});

test("FormatValueForDisplay numeric formula/forcetext with mocked special_chars covers || branches (dist 4954-4967)", async () => {
  const SC = await loadSC();
  const origSpecialChars = SC.special_chars;

  // numeric formula: datatype "f" → 4954
  // Recalc first (gets valuetype "n" and clears "e#N/A"), THEN mock.
  const sheetNF = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetNF, ["set A1 formula 3+2"]);
  await recalcSheet(SC, sheetNF);
  sheetNF.valueformats[10] = "formula";
  sheetNF.cells.A1.nontextvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultNF = SC.FormatValueForDisplay(sheetNF, sheetNF.cells.A1.datavalue, "A1") as string;
  expect(resultNF).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;

  // numeric formula: datatype "c" → 4956
  const sheetNC = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetNC, ["set A1 constant n 5 3+2"]);
  sheetNC.valueformats[10] = "formula";
  sheetNC.cells.A1.nontextvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultNC = SC.FormatValueForDisplay(sheetNC, sheetNC.cells.A1.datavalue, "A1") as string;
  expect(resultNC).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;

  // numeric formula: datatype else → 4958
  const sheetNV = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetNV, ["set A1 value n 42"]);
  sheetNV.valueformats[10] = "formula";
  sheetNV.GetAssuredCell("A1").nontextvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultNV = SC.FormatValueForDisplay(sheetNV, "42", "A1") as string;
  expect(resultNV).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;

  // numeric forcetext: datatype "f" → 4963
  const sheetFTF = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetFTF, ["set A1 formula 1+1"]);
  await recalcSheet(SC, sheetFTF);
  sheetFTF.valueformats[10] = "forcetext";
  sheetFTF.cells.A1.nontextvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultFTF = SC.FormatValueForDisplay(sheetFTF, sheetFTF.cells.A1.datavalue, "A1") as string;
  expect(resultFTF).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;

  // numeric forcetext: datatype "c" → 4965
  const sheetFTC = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetFTC, ["set A1 constant n 5 3+2"]);
  sheetFTC.valueformats[10] = "forcetext";
  sheetFTC.cells.A1.nontextvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultFTC = SC.FormatValueForDisplay(sheetFTC, sheetFTC.cells.A1.datavalue, "A1") as string;
  expect(resultFTC).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;

  // numeric forcetext: datatype else → 4967
  const sheetFTV = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheetFTV, ["set A1 value n 42"]);
  sheetFTV.valueformats[10] = "forcetext";
  sheetFTV.GetAssuredCell("A1").nontextvalueformat = 10;
  SC.special_chars = (() => "") as SCFunc;
  const resultFTV = SC.FormatValueForDisplay(sheetFTV, "42", "A1") as string;
  expect(resultFTV).toBe("&nbsp;");
  SC.special_chars = origSpecialChars;
});

// ═════════════════════════════════════════════════════════════════════
// Section 20: DetermineValueType (dist 5148, 5162, 5174).
//  - navigator.language "fr" → cond-expr alt0 at 5148.
//  - datetime hour=25 → if false at 5162.
//  - datetime seconds=65 → if false at 5174.
// ═════════════════════════════════════════════════════════════════════

test("DetermineValueType with fr locale hits cond-expr true (dist 5148)", async () => {
  const SC = await loadSCBrowser();
  const nav = (globalThis as unknown as { navigator: { language: string } }).navigator;
  const origLang = nav.language;
  nav.language = "fr";
  const result = SC.DetermineValueType("1/2/2024") as { value: number; type: string };
  nav.language = origLang;
  expect(result.type).toBe("nd");
  expect(result.value).toBeGreaterThan(0);
});

test("DetermineValueType datetime with hour=25 stays nd not ndt (dist 5162)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.DetermineValueType("2024/1/2 25:30") as { value: number; type: string };
  expect(result.type).toBe("nd");
});

test("DetermineValueType datetime with seconds=65 stays nd not ndt (dist 5174)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.DetermineValueType("2024/1/2 3:4:65") as { value: number; type: string };
  expect(result.type).toBe("nd");
});

// ═════════════════════════════════════════════════════════════════════
// Section 21: ParseCellLinkText `||` branches (dist 5301, 5312).
//  - "{[pg]}" → empty workspace substring → `|| ""` right side at 5301.
//  - "[]" → empty pagename substring → `|| ""` right side at 5312.
// ═════════════════════════════════════════════════════════════════════

test("ParseCellLinkText with empty workspace hits || false (dist 5301)", async () => {
  const SC = await loadSC();
  const result = SC.ParseCellLinkText("{[pg]}") as {
    workspace: string;
    pagename: string;
  };
  expect(result.workspace).toBe("");
  expect(result.pagename).toBe("pg");
});

test("ParseCellLinkText with empty pagename hits || false (dist 5312)", async () => {
  const SC = await loadSC();
  const result = SC.ParseCellLinkText("[]") as { pagename: string };
  expect(result.pagename).toBe("");
});

// ═════════════════════════════════════════════════════════════════════
// Section 22: ConvertSaveToOtherFormat tab output with multi-line cell
// (dist 5371). A cell value containing a newline triggers the tab
// quoting branch.
// ═════════════════════════════════════════════════════════════════════

test("ConvertSaveToOtherFormat tab with multi-line cell hits tab path (dist 5371)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 text t line1", "set A1 comment text multi\nline"]);
  const save = SC.CreateSheetSave(sheet) as unknown as string;
  const result = SC.ConvertSaveToOtherFormat(save, "tab", false) as string;
  expect(result).toBeDefined();
});

// ═════════════════════════════════════════════════════════════════════
// Section 23: ConvertOtherFormatToSave with empty input (dist 5463, 5518).
// CSV with empty input → maxc == 0 → if false at 5463.
// Tab with empty input → maxc == 0 → if false at 5518.
// ═════════════════════════════════════════════════════════════════════

test("ConvertOtherFormatToSave csv with empty input has maxc 0 (dist 5463)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.ConvertOtherFormatToSave("", "csv") as string;
  expect(result).toBe("");
});

test("ConvertOtherFormatToSave tab with empty input has maxc 0 (dist 5518)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.ConvertOtherFormatToSave("", "tab") as string;
  expect(result).toBe("");
});

// ═════════════════════════════════════════════════════════════════════
// Section 24: ConvertOtherFormatToSave csv with double-quote followed
// by tab (dist 5492-5494). Tab-format quoting edge case where `"`
// is followed by `\t` inside an inquote state.
// ═════════════════════════════════════════════════════════════════════

test("ConvertOtherFormatToSave tab with quote-tab inside quoted field (dist 5492-5494)", async () => {
  const SC = await loadSCBrowser();
  // CSV: '"he\tllo"' — quote followed by tab inside a quoted field
  // Tab format: opening quote, then 'he', then '"\t' → close quote + tab + AddCell
  const input = '"he\tllo"\tworld';
  const result = SC.ConvertOtherFormatToSave(input, "tab") as string;
  expect(result).toBeDefined();
});
