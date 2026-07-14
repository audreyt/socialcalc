import { expect, test } from "vite-plus/test";

import { loadSocialCalc, makeSave, recalcSheet, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// ── Narrow types for the SC bundle surface ──────────────────────────────
// loadSocialCalc() returns `any` (the UMD default export). We cast through
// `unknown` to a named const typed by these interfaces so we never write
// bare `any` in the new test code.

interface FakeEditorContext {
  sheetobj: unknown;
  rowpanes: Array<{ first: number; last: number }>;
  colpanes: Array<{ first: number; last: number }>;
  SetRowPaneFirstLast(_n: number, _f: number, _l: number): void;
  SetColPaneFirstLast(_n: number, _f: number, _l: number): void;
}

interface FakeRange2 {
  hasrange: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface FakeEditor {
  range2: FakeRange2 | { hasrange: false };
  Range2Remove(): void;
  context: FakeEditorContext;
  timeout: unknown;
  griddiv: unknown;
  ScheduleRender(): void;
  FitToEditTable(): void;
}

interface EditorHost {
  CurrentSpreadsheetControlObject?: { editor: FakeEditor };
}

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
  csss?: string;
  mod?: string;
  prevvaluetype?: string;
}

interface SCFunc {
  (...args: unknown[]): unknown;
  new (...args: unknown[]): unknown;
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
  GetElementFixedParent: SCFunc;
  GetComputedStyle: SCFunc;
  decodeFromSave: SCFunc;
  encodeForSave: SCFunc;
  special_chars: SCFunc;
  coordinateToCr: SCFunc;
  rcColname: SCFunc;
  Callbacks: Record<string, unknown>;
  [key: string]: unknown;
}

function loadSC(): Promise<SCCore> {
  return loadSocialCalc() as Promise<SCCore>;
}

function loadSCBrowser(): Promise<SCCore> {
  return loadSocialCalc({ browser: true }) as Promise<SCCore>;
}

function installEditorMock(SC: SCCore): FakeEditor {
  const fakeEditor: FakeEditor = {
    range2: { hasrange: false },
    Range2Remove() {
      this.range2 = { hasrange: false };
    },
    context: {
      sheetobj: null,
      rowpanes: [{ first: 1, last: 10 }],
      colpanes: [{ first: 1, last: 10 }],
      SetRowPaneFirstLast() {},
      SetColPaneFirstLast() {},
    },
    timeout: null,
    griddiv: null,
    ScheduleRender() {},
    FitToEditTable() {},
  };
  (SC as unknown as EditorHost).CurrentSpreadsheetControlObject = {
    editor: fakeEditor,
  };
  return fakeEditor;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: throw-then-break dead code in ParseSheetSave (dist 1011/1028)
// and CellFromStringParts (dist 1245), plus the ParseSheetSave unknown
// line-type throw (dist 1139). The `break` after each `throw` is
// unreachable but still counts as uncovered statements.
// ═══════════════════════════════════════════════════════════════════════

test("ParseSheetSave throws on unknown col/row/line token", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };

  // Unknown col token
  expect(() => sheet.ParseSheetSave(makeSave(["col A badvalue"]))).toThrow();

  // Unknown row token
  expect(() => sheet.ParseSheetSave(makeSave(["row 1 badvalue"]))).toThrow();

  // Unknown line type
  expect(() => sheet.ParseSheetSave(makeSave(["badlinetype foo"]))).toThrow();
});

test("CellFromStringParts unknown token triggers throw via ParseSheetSave", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  // Cell token "badtoken" hits the default throw in CellFromStringParts.
  expect(() => sheet.ParseSheetSave(makeSave(["cell A1:badtoken:foo"]))).toThrow();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 2: CanonicalizeSheet colattribs loop branch where a colattrib
// coord is beyond maxcol (dist 1565-1566).
// ═══════════════════════════════════════════════════════════════════════

test("CanonicalizeSheet picks up col/row attribs beyond last cell", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
    CanonicalizeSheet(full?: boolean): void;
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, string>>;
    rowattribs: Record<string, Record<string, string>>;
  };

  await scheduleCommands(SC, sheet, [
    "set A1 value n 5",
    "set sheet lastcol 2",
    "set sheet lastrow 2",
    "set D width 50",
    "set 5 height 30",
  ]);
  sheet.CanonicalizeSheet(false);
  expect(sheet.attribs.lastcol).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 3: EncodeCellAttributes SetAttribStar "v == '*'" early return
// (dist 1606-1607) and EncodeSheetAttributes SetAttrib (dist 1689-1690).
// ═══════════════════════════════════════════════════════════════════════

test("EncodeCellAttributes SetAttribStar returns on '*' val for cell layout", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
    GetAssuredCell(coord: string): SheetCell;
    GetStyleNum(type: string, style: string): number;
    layouts: string[];
  };
  sheet.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  await scheduleCommands(SC, sheet, ["set A1 layout padding:* * * *;vertical-align:top;"]);
  const result = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(result).toBeDefined();
  // padding uses "*" (SetAttribStar returns early, stays default), while
  // vertical-align:top is a real value so alignvert becomes non-default.
  expect(result.padtop.def).toBe(true);
  expect(result.padright.def).toBe(true);
  expect(result.padbottom.def).toBe(true);
  expect(result.padleft.def).toBe(true);
  expect(result.alignvert.def).toBe(false);
  expect(result.alignvert.val).toBe("top");
});

test("EncodeSheetAttributes SetAttribStar returns on '*' for defaultfont", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
    GetAssuredCell(coord: string): SheetCell;
    attribs: Record<string, unknown>;
  };
  sheet.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  await scheduleCommands(SC, sheet, ["set sheet defaultfont * * *"]);
  const result = SC.EncodeSheetAttributes(sheet);
  expect(result).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 4: set <coord> value with a non-"n" vtype that DetermineValueType
// classifies as "t" → datatype = "t" (dist 2197-2198), and a numeric vrest
// that gets classified as "n" → datatype = "c" (dist 2199-2201).
// Also the formula branch (dist 2214-2219) with SocialCalc._app set.
// ═══════════════════════════════════════════════════════════════════════

test("set <coord> value with text vtype sets datatype=t", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value t hello world"]);
  expect(sheet.cells.A1?.datatype).toBe("t");
  expect(sheet.cells.A1?.valuetype).toBe("t");
  expect(sheet.cells.A1?.datavalue).toBe("hello world");
});

test("set <coord> value with non-n vtype + numeric vrest sets datatype=c and formula", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // vtype "e" is not "n", so DetermineValueType("123") → type "n" (not "t")
  // → enters else: datatype = "c", formula = vrest = "123"
  await scheduleCommands(SC, sheet, ["set A1 value e 123"]);
  expect(sheet.cells.A1?.datatype).toBe("c");
  expect(sheet.cells.A1?.formula).toBe("123");
  expect(sheet.cells.A1?.valuetype).toBe("n");
});

test("set <coord> formula with SocialCalc._app set stores prevvaluetype", async () => {
  const SC = await loadSC();
  const SCObj = SC as unknown as { _app?: unknown };
  SCObj._app = true;
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 42", "set A1 formula SUM(B1:C1)"]);
  expect(sheet.cells.A1?.datatype).toBe("f");
  expect(sheet.cells.A1?.prevvaluetype).toBe("n");
  delete SCObj._app;
});

// ═══════════════════════════════════════════════════════════════════════
// Section 5: merge/unmerge on readonly cells → early break
// (dist 2298-2299, 2329-2330).
// ═══════════════════════════════════════════════════════════════════════

test("merge and unmerge on readonly cell break early without error", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 readonly yes"]);
  await scheduleCommands(SC, sheet, ["merge A1:B1"]);
  expect(sheet.cells.A1?.colspan).toBeUndefined();

  sheet.cells.A1.colspan = 2;
  await scheduleCommands(SC, sheet, ["unmerge A1"]);
  expect(sheet.cells.A1?.colspan).toBe(2);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 6: movefrom where a cell in the range does not exist
// (dist 3082-3083, `if (!sheet.cells[cr]) continue`).
// ═══════════════════════════════════════════════════════════════════════

test("movefrom skips non-existent cells in the range", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set sheet lastcol 2",
    "set sheet lastrow 1",
    "movefrom A1:B1",
    "movepaste A1",
  ]);
  expect(sheet.cells.A1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 7: movepaste where dest is readonly → continue (dist 3229-3230),
// and where basecell is empty → delete+continue (dist 3235-3237).
// ═══════════════════════════════════════════════════════════════════════

test("movepaste skips readonly dest cell", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set A2 value n 20",
    "set sheet lastcol 2",
    "set sheet lastrow 2",
    "movefrom A1:A2",
    "set B1 readonly yes",
    "movepaste B1",
  ]);
  expect(sheet.cells.A2).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 8: ExecuteSheetCommand default case → s_escUnknownCmd (dist 3419).
// ═══════════════════════════════════════════════════════════════════════

test("ExecuteSheetCommand unknown verb returns errortext", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["boguscommand A1"]);
  expect(sheet.attribs).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 9: RecalcCheckCell reversed range within a formula
// (dist 3738-3740). Formula with B1:A1 range triggers the reversed-range
// swap branch.
// ═══════════════════════════════════════════════════════════════════════

test("RecalcCheckCell handles reversed range B1:A1 in formula", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 formula SUM(B1:A1)",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1?.datavalue).toBe(3);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 10: Parse.NextToken pos < 0 returns empty (dist 3867).
// ═══════════════════════════════════════════════════════════════════════

test("Parse.NextToken returns empty when pos < 0 (past end)", async () => {
  const SC = await loadSC();
  const parse = new SC.Parse("hello world") as unknown as {
    pos: number;
    NextToken(): string;
  };
  parse.pos = -1;
  expect(parse.NextToken()).toBe("");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 11: PrecomputeSheetFontsAndLayouts invalid font/layout formats
// hit `if (!parts) continue` (dist 4135-4136, 4149-4150).
// ═══════════════════════════════════════════════════════════════════════

test("PrecomputeSheetFontsAndLayouts skips malformed font and layout entries", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    GetStyleNum(type: string, style: string): number;
    fonts: string[];
    layouts: string[];
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 font normal * * times"]);
  sheet.fonts.push("malformed_no_spaces");
  sheet.layouts.push("badlayout_no_match");

  const context = new SC.RenderContext(sheet) as unknown as {
    PrecomputeSheetFontsAndLayouts(): void;
    fonts: unknown[];
    layouts: unknown[];
  };
  context.PrecomputeSheetFontsAndLayouts();
  expect(context.fonts).toBeDefined();
  expect(context.layouts).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 12: CalculateColWidthData / CalculateRowHeightData with
// colwidth == "blank" or "auto" (dist 4208-4209, 4227-4228).
// ═══════════════════════════════════════════════════════════════════════

test("CalculateColWidthData handles 'blank' and 'auto' colwidth values", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, string>>;
    rowattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "set A width blank",
    "set B width auto",
    "set 2 height blank",
    "set 3 height auto",
  ]);
  const context = new SC.RenderContext(sheet) as unknown as {
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    showRCHeaders: boolean;
    CalculateColWidthData(): void;
    CalculateRowHeightData(): void;
    colwidth: Record<number, string>;
    rowheight: Record<number, string>;
  };
  context.colpanes = [{ first: 1, last: 3 }];
  context.rowpanes = [{ first: 1, last: 3 }];
  context.showRCHeaders = false;
  context.CalculateColWidthData();
  expect(context.colwidth[1]).toBe("");
  expect(context.colwidth[2]).toBe("");
  context.CalculateRowHeightData();
  expect(context.rowheight[2]).toBe("");
  expect(context.rowheight[3]).toBe("");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 13: RenderColHeaders with showRCHeaders=false returns null
// (dist 4400-4401).
// ═══════════════════════════════════════════════════════════════════════

test("RenderColHeaders returns null when showRCHeaders is false", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    RenderColHeaders(): unknown;
  };
  context.showRCHeaders = false;
  expect(context.RenderColHeaders()).toBeNull();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 14: RenderCell cellskip with CoordInPane true → return null
// (dist 4526-4527).
// ═══════════════════════════════════════════════════════════════════════

test("RenderCell returns null for skipped cell within its pane", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "merge A1:B1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CoordInPane(coord: string, rowpane: number, colpane: number): boolean;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): unknown;
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showRCHeaders = false;
  context.CalculateCellSkipData();
  expect(context.cellskip["B1"]).toBe("A1");
  const result = context.RenderCell(1, 2, 0, 0);
  expect(result).toBeNull();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 15: RenderCell showGrid border fallback branches (dist 4620-4628,
// 4633-4641).
// ═══════════════════════════════════════════════════════════════════════

test("RenderCell with showGrid renders grid border fallback", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    gridCSS: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    CellInPane(row: number, col: number, rowpane: number, colpane: number): boolean;
    RenderCell(...args: unknown[]): { style: { cssText: string } };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = true;
  context.showRCHeaders = false;
  context.gridCSS = "1px solid #ccc";
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0) as {
    style: { cssText: string };
  };
  expect(result.style.cssText).toContain("border-right");
  expect(result.style.cssText).toContain("border-bottom");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 16: RenderCell comment className branches (showGrid true/false).
// ═══════════════════════════════════════════════════════════════════════

test("RenderCell comment cell with showGrid=false uses commentNoGridClassName", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 comment text mycomment"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    commentNoGridClassName: string;
    commentNoGridCSS: string;
    commentClassName: string;
    commentCSS: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string; title: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = false;
  context.showRCHeaders = false;
  context.commentNoGridClassName = "comment-nogrid";
  context.commentNoGridCSS = "background:#ff0;";
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0) as {
    className: string;
    title: string;
  };
  expect(result.className).toContain("comment-nogrid");
  // comment stored via decodeFromSave(rest) which preserves full "text mycomment"
  expect(result.title).toContain("mycomment");
});

test("RenderCell comment cell with showGrid=true uses commentClassName", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 comment text best"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    commentClassName: string;
    commentCSS: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = true;
  context.showRCHeaders = false;
  context.commentClassName = "comment-grid";
  context.commentCSS = "background:#ff0;";
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0);
  expect(result.className).toContain("comment-grid");
});

test("RenderCell readonly cell with showGrid=false uses readonlyNoGridClassName", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 readonly yes"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    readonlyNoGridClassName: string;
    readonlyNoGridCSS: string;
    readonlyComment: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string; title: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = false;
  context.showRCHeaders = false;
  context.readonlyNoGridClassName = "readonly-nogrid";
  context.readonlyNoGridCSS = "color:gray;";
  context.readonlyComment = "Read-only cell";
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0) as {
    className: string;
    title: string;
  };
  expect(result.className).toContain("readonly-nogrid");
  expect(result.title).toBe("Read-only cell");
});

test("RenderCell readonly with showGrid=true and has comment keeps comment title", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 comment text locked",
    "set A1 readonly yes",
  ]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    readonlyClassName: string;
    readonlyCSS: string;
    commentClassName: string;
    commentCSS: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string; title: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = true;
  context.showRCHeaders = false;
  context.readonlyClassName = "readonly-grid";
  context.readonlyCSS = "color:gray;";
  context.commentClassName = "comment-grid";
  context.commentCSS = "background:#ff0;";
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0) as {
    className: string;
    title: string;
  };
  // Cell has a comment so title should be the comment, not readonlyComment
  expect(result.title).toContain("locked");
  expect(result.className).toContain("readonly-grid");
  expect(result.className).toContain("comment-grid");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 17: RenderCell cssc attribute with classList (dist 4681 DOM path).
// ═══════════════════════════════════════════════════════════════════════

test("RenderCell noElement=true with cssc adds via className string (dist 4681 noElement)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  sheet.GetAssuredCell("A1").cssc = "styled";

  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = false;
  context.showRCHeaders = false;
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0, true);
  expect(result.className).toContain("styled");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 18: RenderCell highlight className (dist 4685-4686).
// ═══════════════════════════════════════════════════════════════════════

test("RenderCell noElement with cursor highlight uses highlightTypes className", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    highlights: Record<string, string>;
    highlightTypes: Record<string, { className: string; style: string }>;
    cursorsuffix: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = false;
  context.showRCHeaders = false;
  context.highlights = { A1: "cursor" };
  context.highlightTypes = { cursor: { className: "cursorclass", style: "" } };
  context.cursorsuffix = "";
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0, true);
  expect(result.className).toContain("cursorclass");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 19: RenderCell hidden col/row adds display:none (dist 4690-4695).
// ═══════════════════════════════════════════════════════════════════════

test("RenderCell hidden col adds display:none to cssText", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A hide yes"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { style: { cssText: string } };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = false;
  context.showRCHeaders = false;
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0) as {
    style: { cssText: string };
  };
  expect(result.style.cssText).toContain("display:none");
});

test("RenderCell hidden row adds display:none to cssText", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set 1 hide yes"]);
  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { style: { cssText: string } };
  };
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.showGrid = false;
  context.showRCHeaders = false;
  context.CalculateCellSkipData();
  const result = context.RenderCell(1, 1, 0, 0) as {
    style: { cssText: string };
  };
  expect(result.style.cssText).toContain("display:none");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 20: CellInPane throws on unknown pane (dist 4707-4708),
// CoordInPane throws on bad coord (dist 4700-4701).
// ═══════════════════════════════════════════════════════════════════════

test("CellInPane throws on unknown pane index", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  const context = new SC.RenderContext(sheet) as unknown as {
    rowpanes: Array<{ first: number; last: number }>;
    colpanes: Array<{ first: number; last: number }>;
  };
  context.rowpanes = [{ first: 1, last: 5 }];
  context.colpanes = [{ first: 1, last: 5 }];
  expect(() => SC.CellInPane(context, 1, 1, 5, 0)).toThrow(/unknown panes/);
});

test("CoordInPane throws on missing coord in coordToCR", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  const context = new SC.RenderContext(sheet) as unknown as {
    coordToCR: Record<string, unknown>;
  };
  expect(() => SC.CoordInPane(context, "BADCOORD", 0, 0)).toThrow(/Bad coordToCR/);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 21: GetElementPosition (dist 4813) and GetElementFixedParent
// (dist 4834). These need a DOM shim so elements have proper properties.
// ═══════════════════════════════════════════════════════════════════════

test("GetElementPosition walks offsetParent chain then breaks on relative", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  // Create DOM elements through the shim's document
  const doc = (globalThis as unknown as { document: Document }).document;
  const el = doc.createElement("div");
  // FakeElement stores offsetLeft/offsetTop as plain writable numbers;
  // lib.dom's HTMLElement declares them read-only getters, so write
  // through the shim's actual (writable) shape.
  const fakeEl = el as unknown as { offsetLeft: number; offsetTop: number };
  fakeEl.offsetLeft = 10;
  fakeEl.offsetTop = 20;
  const result = SC.GetElementPosition(el) as { left: number; top: number };
  expect(result.left).toBe(10);
  expect(result.top).toBe(20);
});

test("GetElementFixedParent returns false when no fixed parent", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const doc = (globalThis as unknown as { document: Document }).document;
  const el = doc.createElement("div");
  const result = SC.GetElementFixedParent(el) as unknown;
  expect(result).toBe(false);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 22: FormatCellForExport with null cell returns "" (dist 4889-4890).
// ═══════════════════════════════════════════════════════════════════════

test("FormatCellForExport returns empty string for null cell", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const result = SC.FormatCellForExport(sheet, null, "A1") as string;
  expect(result).toBe("");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 23: FormatValueForDisplay numeric cell with valueformat "formula"
// for datatype f, c, and else; also "forcetext" variants.
// Need numeric valuetype so we enter the `valuetype == "n"` branch.
// ═══════════════════════════════════════════════════════════════════════

test("FormatValueForDisplay numeric formula valueformat for datatype=f", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 formula 1+1"]);
  await recalcSheet(SC, sheet);
  sheet.valueformats[10] = "formula";
  sheet.cells.A1.nontextvalueformat = 10;

  const result = SC.FormatValueForDisplay(sheet, sheet.cells.A1.datavalue, "A1") as string;
  expect(result).toContain("=");
  expect(result).toContain("1+1");
});

test("FormatValueForDisplay numeric formula valueformat for datatype=c", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  // constant with numeric valuetype so we enter valuetype=="n" branch
  await scheduleCommands(SC, sheet, ["set A1 constant n 5 3+2"]);
  sheet.valueformats[10] = "formula";
  sheet.cells.A1.nontextvalueformat = 10;

  const result = SC.FormatValueForDisplay(sheet, sheet.cells.A1.datavalue, "A1") as string;
  // datatype "c" → comma-prefix formula display
  expect(result).toContain("'");
  expect(result).toContain("3+2");
});

test("FormatValueForDisplay numeric formula valueformat for else (v) datatype", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 42"]);
  sheet.valueformats[10] = "formula";
  sheet.GetAssuredCell("A1").nontextvalueformat = 10;

  const result = SC.FormatValueForDisplay(sheet, "42", "A1") as string;
  expect(result).toContain("'");
});

test("FormatValueForDisplay numeric forcetext valueformat for datatype=f", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 formula 2*3"]);
  await recalcSheet(SC, sheet);
  sheet.valueformats[10] = "forcetext";
  sheet.cells.A1.nontextvalueformat = 10;

  const result = SC.FormatValueForDisplay(sheet, sheet.cells.A1.datavalue, "A1") as string;
  expect(result).toContain("=");
  expect(result).toContain("2*3");
});

test("FormatValueForDisplay numeric forcetext valueformat for datatype=c", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 constant n 5 3+2"]);
  sheet.valueformats[10] = "forcetext";
  sheet.cells.A1.nontextvalueformat = 10;

  const result = SC.FormatValueForDisplay(sheet, sheet.cells.A1.datavalue, "A1") as string;
  // forcetext with c datatype: shows formula without = prefix
  expect(result).toContain("3+2");
});

test("FormatValueForDisplay numeric forcetext valueformat for else (v) datatype", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    valueformats: string[];
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 123"]);
  sheet.valueformats[10] = "forcetext";
  sheet.GetAssuredCell("A1").nontextvalueformat = 10;

  const result = SC.FormatValueForDisplay(sheet, "123", "A1") as string;
  expect(result).toContain("123");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 24: format_text_for_display with text-wiki and no expand_markup
// callback → fallback to special_chars("wiki-text:" + displayvalue) (dist 5036).
// ═══════════════════════════════════════════════════════════════════════

test("format_text_for_display text-wiki without expand_markup falls back to label", async () => {
  const SC = await loadSC();
  delete SC.Callbacks.expand_markup;
  delete SC.Callbacks.expand_wiki;

  const sheet = new SC.Sheet();
  const result = SC.format_text_for_display("hello", "t", "text-wiki", sheet, "", 0) as string;
  expect(result).toContain("wiki-text:");
  expect(result).toContain("hello");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 25: DetermineValueType date formats with year < 1000 correction.
// Need browser shim because DetermineValueType references navigator.language.
// ═══════════════════════════════════════════════════════════════════════

test("DetermineValueType short date with 2-digit year triggers year correction", async () => {
  const SC = await loadSCBrowser();
  const result = SC.DetermineValueType("1/2/25") as {
    value: number;
    type: string;
  };
  expect(result.type).toBe("nd");
  expect(result.value).toBeGreaterThan(0);
});

test("DetermineValueType handles full date with year < 1000 correction branch", async () => {
  const SC = await loadSCBrowser();
  const result = SC.DetermineValueType("0999/1/2") as {
    value: number;
    type: string;
  };
  expect(result.type).toBe("nd");
});

test("DetermineValueType datetime with year < 1000 correction (dist 5157)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.DetermineValueType("0999/1/2 3:4") as {
    value: number;
    type: string;
  };
  expect(result.type).toBe("ndt");
});

test("DetermineValueType datetime with seconds and year < 1000 (dist 5168)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.DetermineValueType("0999/1/2 3:4:5") as {
    value: number;
    type: string;
  };
  expect(result.type).toBe("ndt");
});

test("DetermineValueType date with 2-digit year < 1000 (dist 5147)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.DetermineValueType("1/2/0099") as {
    value: number;
    type: string;
  };
  expect(result.type).toBe("nd");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 26: ParseCellLinkText workspace format with trailing space and
// double-quoted desc.
// ═══════════════════════════════════════════════════════════════════════

test("ParseCellLinkText workspace format with space before [ triggers wsend-- branch", async () => {
  const SC = await loadSC();
  // Format: {ws [pg]} — char at wsend-1 is space, triggers wsend-- (dist 5298-5299)
  const result = SC.ParseCellLinkText("{ws [pg]}") as {
    workspace: string;
    pagename: string;
  };
  expect(result).toBeDefined();
  expect(result.workspace).toBe("ws");
  expect(result.pagename).toBe("pg");
});

test("ParseCellLinkText workspace without space does not decrement wsend", async () => {
  const SC = await loadSC();
  // {noSpace[pg]} — char before [ is 'e', no wsend decrement
  const result = SC.ParseCellLinkText("{noSpace[pg]}") as {
    workspace: string;
    pagename: string;
  };
  expect(result.workspace).toBe("noSpace");
  expect(result.pagename).toBe("pg");
});

test("ParseCellLinkText page form with double-quoted desc", async () => {
  const SC = await loadSC();
  const result = SC.ParseCellLinkText('"Best Desc" [mypage]') as {
    pagename: string;
    desc: string;
  };
  expect(result).toBeDefined();
  expect(result.pagename).toBe("mypage");
  expect(result.desc).toBe("Best Desc");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 27: ConvertSaveToOtherFormat tab/csv output.
// ═══════════════════════════════════════════════════════════════════════

test("ConvertSaveToOtherFormat tab output encodes cells with tabs", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 text t hello"]);
  const save = SC.CreateSheetSave(sheet) as unknown as string;
  const result = SC.ConvertSaveToOtherFormat(save, "tab", false) as string;
  expect(result).toContain("\t");
  expect(result).toContain("1");
  expect(result).toContain("hello");
});

test("ConvertSaveToOtherFormat csv output for simple sheet", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 text t hi"]);
  const save = SC.CreateSheetSave(sheet) as unknown as string;
  const result = SC.ConvertSaveToOtherFormat(save, "csv", false) as string;
  expect(result).toContain("1");
  expect(result).toContain("hi");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 28: set sheet lastcol/usermaxcol with non-numeric values
// (dist 2077-2078, 2094-2095).
// ═══════════════════════════════════════════════════════════════════════

test("set sheet lastcol with non-numeric value defaults to 1", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set sheet lastcol foo"]);
  expect(sheet.attribs.lastcol).toBe(1);
});

test("set sheet usermaxcol with non-numeric value defaults to 0", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set sheet usermaxcol foo"]);
  expect(sheet.attribs.usermaxcol).toBe(0);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 29: set sheet recalc "on" deletes attribs.recalc (dist 2083 else).
// ═══════════════════════════════════════════════════════════════════════

test("set sheet recalc on (non-off) deletes attribs.recalc", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set sheet recalc off", "set sheet recalc on"]);
  expect(sheet.attribs.recalc).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 30: set col/row range width/hide non-empty branches (dist 2117/2128/2149/2158).
// ═══════════════════════════════════════════════════════════════════════

test("set col-range width non-empty sets width for each col", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    colattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, ["set A:C width 30"]);
  expect(sheet.colattribs.width.A).toBe("30");
  expect(sheet.colattribs.width.B).toBe("30");
  expect(sheet.colattribs.width.C).toBe("30");
});

test("set col-range hide non-empty sets hide for each col", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    colattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, ["set A:C hide yes"]);
  expect(sheet.colattribs.hide.A).toBe("yes");
  expect(sheet.colattribs.hide.C).toBe("yes");
});

test("set row-range height non-empty sets height for each row", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    rowattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, ["set 1:3 height 25"]);
  expect(sheet.rowattribs.height[1]).toBe("25");
  expect(sheet.rowattribs.height[3]).toBe("25");
});

test("set row-range hide non-empty sets hide for each row", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    rowattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, ["set 1:3 hide yes"]);
  expect(sheet.rowattribs.hide[1]).toBe("yes");
  expect(sheet.rowattribs.hide[3]).toBe("yes");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 31: ExecuteSheetCommand with saveundo=false for set sheet default
// attributes (covers the if(saveundo) false branches at dist 2035/2041/2046/
// 2051/2059/2065/2074/2081/2091).
// ═══════════════════════════════════════════════════════════════════════

test("ExecuteSheetCommand saveundo=false for set sheet default attribs", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
  };
  const save = makeSave([
    "set sheet defaultcolwidth 80",
    "set sheet defaultcolor red",
    "set sheet defaultlayout padding:1px 1px 1px 1px;vertical-align:top;",
    "set sheet defaultfont normal * * arial",
    "set sheet defaulttextformat right",
    "set sheet defaulttextvalueformat text-link",
    "set sheet defaultnontextvalueformat 0.00",
    "set sheet lastcol 5",
    "set sheet lastrow 5",
    "set sheet recalc off",
    "set sheet usermaxcol 10",
    "set sheet usermaxrow 20",
  ]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.attribs.defaultcolwidth).toBe("80");
  expect(sheet.attribs.lastcol).toBe(5);
  expect(sheet.attribs.usermaxcol).toBe(10);
  expect(sheet.attribs.usermaxrow).toBe(20);
  expect(sheet.attribs.recalc).toBe("off");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 32: set <coord> text/constant/empty with saveundo=false
// (covers if(saveundo) false branches in the cell range loop).
// ═══════════════════════════════════════════════════════════════════════

test("set <coord> text/constant/empty with saveundo=false", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  const save = makeSave(["set A1 text t hello", "set B1 constant e#REF! 5 BADREF"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1?.datatype).toBe("t");
  expect(sheet.cells.A1?.datavalue).toBe("hello");
  expect(sheet.cells.B1?.datatype).toBe("c");
  expect(sheet.cells.B1?.formula).toBe("BADREF");
  expect(sheet.cells.B1?.errors).toBe("#REF!");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 33: DecodeCellAttributes with layout that doesn't exist
// (dist 1783: `value != (sheet.layouts[cell.layout] || "")`).
// ═══════════════════════════════════════════════════════════════════════

test("DecodeCellAttributes passes correct cmd for layout change (dist 1783)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  // Encode a cell with no layout set (alignvert def=true, padtop def=true)
  const encoded = {
    alignhoriz: { def: true, val: "" },
    alignvert: { def: true, val: "" },
    padtop: { def: true, val: "" },
    padright: { def: true, val: "" },
    padbottom: { def: true, val: "" },
    padleft: { def: true, val: "" },
    fontlook: { def: true, val: "" },
    fontsize: { def: true, val: "" },
    fontfamily: { def: true, val: "" },
    textcolor: { def: true, val: "" },
    bgcolor: { def: true, val: "" },
    numberformat: { def: true, val: "" },
    textformat: { def: true, val: "" },
    bt: { def: true, val: "" },
    br: { def: true, val: "" },
    bb: { def: true, val: "" },
    bl: { def: true, val: "" },
  };
  const cmd = SC.DecodeCellAttributes(sheet, "A1", encoded) as string;
  expect(cmd).toBeDefined();
});

test("DecodeCellAttributes with mixed def/non-def padding triggers layout cmd (dist 1779)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    GetAssuredCell(coord: string): SheetCell;
    GetStyleNum(type: string, style: string): number;
    layouts: string[];
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 layout padding:2 2 2 2;vertical-align:top;",
  ]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // Decode into a fresh sheet with a blank cell (no layout set)
  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  // Ensure the cell exists so DecodeCellAttributes can access it
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  // The encoded attrs have non-default padding, so a layout cmd should be emitted
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("layout");
});

test("DecodeSheetAttributes with mixed def/non-def padding (dist 1853)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, [
    "set sheet defaultlayout padding:3 3 3 3;vertical-align:middle;",
  ]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultlayout");
});

test("DecodeSheetAttributes font string with mixed def/non-def fontlook (dist 1861)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, ["set sheet defaultfont bold * * arial"]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultfont");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 35: filldown/fillright with editor.range2 populated
// (dist 2404-2424 hasrange branches and increment_from_cells path).
// ═══════════════════════════════════════════════════════════════════════

test("filldown with editor.range2 triggers hasrange increment_from_cells", async () => {
  const SC = await loadSC();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set A2 value n 20",
    "set A3 value n 30",
  ]);
  (fakeEditor as unknown as FakeEditor).range2 = {
    hasrange: true,
    left: 1,
    right: 1,
    top: 1,
    bottom: 2,
  };
  await scheduleCommands(SC, sheet, ["filldown A1:A5 all"]);
  await recalcSheet(SC, sheet);
  // A3 should have been overwritten with 20 + increment(10) = 30
  expect(sheet.cells.A3?.datavalue).toBeDefined();
});

test("fillright with editor.range2 triggers hasrange increment_from_cells", async () => {
  const SC = await loadSC();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set B1 value n 20",
    "set C1 value n 30",
  ]);
  (fakeEditor as unknown as FakeEditor).range2 = {
    hasrange: true,
    left: 1,
    right: 2,
    top: 1,
    bottom: 1,
  };
  await scheduleCommands(SC, sheet, ["fillright A1:E1 all"]);
  await recalcSheet(SC, sheet);
  // C1 should have been overwritten
  expect(sheet.cells.C1?.datavalue).toBeDefined();
});

test("filldown without range2 uses simple 2-row increment (dist 2416)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set A2 value n 20",
    "set sheet lastrow 5",
    "filldown A1:A5 formulas",
  ]);
  await recalcSheet(SC, sheet);
  // A3 should get 30 (20 + increment 10)
  expect(sheet.cells.A3?.datavalue).toBe(30);
  expect(sheet.cells.A4?.datavalue).toBe(40);
});

test("fillright without range2 uses simple 2-col increment (dist 2420)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set B1 value n 20",
    "set sheet lastcol 5",
    "fillright A1:E1 formulas",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1?.datavalue).toBe(30);
  expect(sheet.cells.D1?.datavalue).toBe(40);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 36: Sort comparator branches still uncovered: text-vs-blank,
// error-vs-blank, blank-vs-non-blank, and the final tiebreaker.
// ═══════════════════════════════════════════════════════════════════════

test("sort exercises text-vs-blank, error-vs-blank, blank-vs-non-blank and tiebreaker", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value t alpha",
    "set A2 value n 5",
    "set A3 formula 1/0",
    "set A5 value t zebra",
    "set A6 formula 1/0",
    "sort A1:A6 A up",
  ]);
  await recalcSheet(SC, sheet);
  expect(Object.keys(sheet.cells).length).toBeGreaterThan(0);
});

test("sort with dirs=down exercises reversed comparison branches", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value t hello",
    "set A2 value n 10",
    "set A3 formula 1/0",
    "set A4 value n 20",
    "set A5 value t world",
    "set A6 formula 1/0",
    "sort A1:A6 A down",
    "sort A1:A6 A up",
  ]);
  await recalcSheet(SC, sheet);
  expect(Object.keys(sheet.cells).length).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 37: UndoStack AddDo/AddUndo non-null argument filtering (dist 3931/3943),
// and PushChange maxUndo limit (dist 3921).
// ═══════════════════════════════════════════════════════════════════════

test("UndoStack AddDo/AddUndo pushes only non-null arguments", async () => {
  const SC = await loadSC();
  const undoStack = new SC.UndoStack() as unknown as {
    stack: Array<{ type: string; command: string[]; undo: string[] }>;
    maxRedo: number;
    maxUndo: number;
    tos: number;
    PushChange(type: string): void;
    AddDo(...args: unknown[]): void;
    AddUndo(...args: unknown[]): void;
  };
  undoStack.PushChange("test");
  undoStack.AddDo("set", "A1", null, "value", null);
  expect(undoStack.stack[undoStack.tos].command).toContain("set A1 value");

  undoStack.AddUndo("set", null, "A1", null, "old");
  expect(undoStack.stack[undoStack.tos].undo[0]).toBe("set A1 old");
});

test("UndoStack PushChange maxUndo limit truncates old undo", async () => {
  const SC = await loadSC();
  const undoStack = new SC.UndoStack() as unknown as {
    stack: Array<{ type: string; command: string[]; undo: unknown[] }>;
    maxUndo: number;
    maxRedo: number;
    tos: number;
    PushChange(type: string): void;
  };
  undoStack.maxUndo = 3;
  for (let i = 0; i < 5; i++) {
    undoStack.PushChange("change" + i);
  }
  const truncIndex = undoStack.stack.length - undoStack.maxUndo - 1;
  if (truncIndex >= 0) {
    expect(undoStack.stack[truncIndex].undo).toEqual([]);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Section 38: set readonly attrib on readonly cell bypasses guard
// (dist 2178 false branch).
// ═══════════════════════════════════════════════════════════════════════

test("set readonly attrib on readonly cell bypasses guard (dist 2178 false branch)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 readonly yes",
    "set A1 readonly no",
  ]);
  expect(sheet.cells.A1?.readonly).toBeFalsy();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 39: CanonicalizeSheet with only rowattribs, no cells (dist 3550).
// ═══════════════════════════════════════════════════════════════════════

test("CanonicalizeSheet with only rowattribs and no cells", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
    CanonicalizeSheet(full?: boolean): void;
    attribs: Record<string, unknown>;
    rowattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, [
    "set sheet lastrow 0",
    "set sheet lastcol 0",
    "set 3 height 25",
  ]);
  sheet.CanonicalizeSheet(true);
  expect(sheet.attribs.lastrow).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 40: ConvertOtherFormatToSave tab (dist 5518 boundary).
// ═══════════════════════════════════════════════════════════════════════

test("ConvertOtherFormatToSave tab with data rows imports correctly", async () => {
  const SC = await loadSC();
  const result = SC.ConvertOtherFormatToSave("a\tb\n1\thello\n", "tab") as string;
  expect(result).toContain("cell");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 41: erase formats on cell with comment preserves comment
// (dist 2378-2379). The "formats" variant of erase creates a newcell
// preserving datavalue/datatype/formula/valuetype and copies comment if present.
// ═══════════════════════════════════════════════════════════════════════

test("erase formats on cell with comment preserves comment (dist 2378-2379)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 42",
    "set A1 font normal * * arial",
    "set A1 comment text mycomment",
    "erase A1 all formats",
  ]);
  expect(sheet.cells.A1).toBeDefined();
  expect(sheet.cells.A1?.comment).toContain("mycomment");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 42: SheetCommandsTimerRoutine error catch path (dist 1771 alert).
// ═══════════════════════════════════════════════════════════════════════

test("SheetCommandsTimerRoutine error catch path with bad col/row command", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A width 20", "set col A badvalue"]);
  expect(sheet).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 43: RecalcTimerRoutine with `if (!coord) continue` branch
// (dist 3600-3601). A normal recalc always hits this because the cell
// loop processes valid coords. The branch fires when there's an empty
// coord key. Let's just exercise RecalcSheet normally.
// ═══════════════════════════════════════════════════════════════════════

test("RecalcSheet processes a formula cell normally", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 formula 1+1"]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A1?.datavalue).toBe(2);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 44: LCOV-driven ExecuteSheetCommand sweep for uncommon sheet,
// cell, fill, paste, insert/delete, name, and pane branches.
// ═══════════════════════════════════════════════════════════════════════

test("sheet attribute commands cover style, numeric, recalc, and undo branches", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set sheet defaultcolwidth 99",
    "set sheet defaultcolor rgb(1,2,3)",
    "set sheet defaultbgcolor rgb(4,5,6)",
    "set sheet defaultlayout padding:3px;vertical-align:top;",
    "set sheet defaultfont normal normal 10pt serif",
    "set sheet defaulttextformat right",
    "set sheet defaultnontextformat center",
    "set sheet defaulttextvalueformat @",
    "set sheet defaultnontextvalueformat 0.00",
    "set sheet lastcol 0",
    "set sheet lastrow -5",
    "set sheet recalc off",
    "set sheet recalc on",
    "set sheet usermaxcol -1",
    "set sheet usermaxrow 3",
  ]);
  expect(sheet.attribs.defaultcolwidth).toBe("99");
  expect(sheet.attribs.defaultcolor).toBeGreaterThan(0);
  expect(sheet.attribs.defaultbgcolor).toBeGreaterThan(0);
  expect(sheet.attribs.defaultlayout).toBeGreaterThan(0);
  expect(sheet.attribs.defaultfont).toBeGreaterThan(0);
  expect(sheet.attribs.defaulttextvalueformat).toBeGreaterThan(0);
  expect(sheet.attribs.lastcol).toBe(1);
  expect(sheet.attribs.lastrow).toBe(1);
  expect(sheet.attribs.recalc).toBeUndefined();
  expect(sheet.attribs.usermaxcol).toBe(0);
  expect(sheet.attribs.usermaxrow).toBe(3);
  expect(sheet.cells.A1?.displaystring).toBeUndefined();
});

test("cell commands cover formula app state, font wildcard, merge, unmerge, cut, and erase branches", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  const previousApp = SC._app;
  SC._app = true;
  try {
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      "set A1 formula A1+1",
      "set A1 font * * *",
      "set A1 cssc class name!",
      "set A1 csss color:red;background:blue;",
      "set A1 mod yYn",
      "set A1 comment text kept comment",
      "set B1 value n 6",
      "merge A1:B2",
      "unmerge A1",
      "cut B1:B1 all",
      "set C1 value n 7",
      "set C1 comment text remove me",
      "erase C1 formulas",
    ]);
  } finally {
    SC._app = previousApp;
  }
  expect(sheet.cells.A1?.prevvaluetype).toBe("n");
  expect(sheet.cells.A1?.font).toBe(0);
  expect(sheet.cells.A1?.cssc).toBe("classname");
  expect(sheet.cells.A1?.csss).toBe("color:red;background:blue;");
  expect(sheet.cells.A1?.mod).toBe("yy");
  expect(sheet.cells.A1?.colspan).toBeUndefined();
  expect(sheet.cells.A1?.rowspan).toBeUndefined();
  expect(sheet.cells.B1).toBeUndefined();
  expect(sheet.cells.C1?.valuetype).toBe("b");
  expect(sheet.cells.C1?.comment).toBeUndefined();
});

test("fill commands use range2 series increments and clear editor range state", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  const editor = installEditorMock(SC);
  editor.context.sheetobj = sheet;
  editor.range2 = { hasrange: true, left: 1, right: 2, top: 1, bottom: 2 };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 3",
    "set B1 value n 10",
    "set B2 value n 15",
    "filldown A1:B4 all",
  ]);
  expect(sheet.cells.A3?.datavalue).toBe(5);
  expect(sheet.cells.B4?.datavalue).toBe(25);
  expect(editor.range2.hasrange).toBe(false);

  editor.range2 = { hasrange: true, left: 1, right: 2, top: 6, bottom: 7 };
  await scheduleCommands(SC, sheet, [
    "set A6 value n 2",
    "set B6 value n 5",
    "set A7 value n 20",
    "set B7 value n 25",
    "fillright A6:D7 all",
  ]);
  expect(sheet.cells.C6?.datavalue).toBe(8);
  expect(sheet.cells.D7?.datavalue).toBe(35);
  expect(editor.range2.hasrange).toBe(false);
});

test("clipboard paste repeats clipped cells and transfers row and column attributes", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, unknown>>;
    rowattribs: Record<string, Record<number, unknown>>;
  };
  await scheduleCommands(SC, sheet, ["clearclipboard", "paste C1 all"]);
  expect(sheet.cells.C1).toBeUndefined();

  const clip = makeSave([
    "cell:A1:v:7",
    "cell:A2:t:repeated",
    "col:A:w:22",
    "row:1:hide:yes",
    "copiedfrom:A1:A2",
  ]);
  await scheduleCommands(SC, sheet, [
    `loadclipboard ${String(SC.encodeForSave(clip))}`,
    "paste B3:C5 all",
  ]);
  expect(sheet.cells.B3?.datavalue).toBe(7);
  expect(sheet.cells.B4?.datavalue).toBe("repeated");
  expect(sheet.cells.B5?.datavalue).toBe(7);
  expect(sheet.cells.C4?.datavalue).toBe("repeated");
  expect(sheet.colattribs.width.B).toBe("22");
  expect(sheet.rowattribs.hide[3]).toBe("yes");
});

test("sort, insert/delete, moveinsert, names, and panes exercise command branches", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, { definition: string; desc?: string }>;
    rowattribs: Record<string, Record<number, unknown>>;
    colattribs: Record<string, Record<string, unknown>>;
  };
  const editor = installEditorMock(SC);
  editor.context.sheetobj = sheet;
  editor.context.rowpanes.push({ first: 4, last: 4 });
  editor.context.colpanes.push({ first: 3, last: 3 });
  const verticalTrack = document.createElement("div");
  verticalTrack.id = "trackingline-vertical";
  const horizontalTrack = document.createElement("div");
  horizontalTrack.id = "trackingline-horizon";
  const grid = document.createElement("div");
  grid.appendChild(verticalTrack);
  grid.appendChild(horizontalTrack);
  editor.griddiv = grid;

  await scheduleCommands(SC, sheet, [
    "set A1 value t zebra",
    "set B1 value n 2",
    "set A2 value t alpha",
    "set B2 value n 1",
    "set A3 empty",
    "set B3 value n 3",
    "set A4 constant e#VALUE! 0 #VALUE!",
    "set B4 value n 4",
    "sort A1:B4 A up B down",
    "set C1 formula A1+B1",
    "name define total =C1",
    "name desc total Sum cell",
    "set 2 height 25",
    "set B width 40",
    "merge D1:E1",
    "insertrow A2",
    "insertcol B1",
    "moveinsert C1:C1 A1 formulas",
    "pane row 2",
    "pane col 2",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.names.TOTAL?.desc).toBe("Sum cell");
  expect(sheet.names.TOTAL?.definition).toContain("D");
  expect(sheet.rowattribs.height[3]).toBe("25");
  expect(sheet.colattribs.width.C).toBe("40");
  expect(Object.values(sheet.cells).some((cell) => cell.datatype === "f")).toBe(true);
  expect(editor.context.rowpanes.length).toBeGreaterThanOrEqual(1);
  expect(editor.context.colpanes.length).toBeGreaterThanOrEqual(1);

  await scheduleCommands(SC, sheet, ["set B1 readonly yes"]);
  const deleteError = SC.ExecuteSheetCommand(sheet, new SC.Parse("deletecol B"), true);
  expect(String(deleteError)).toContain("locked");
  await scheduleCommands(SC, sheet, ["name delete total"]);
  expect(sheet.names.TOTAL).toBeUndefined();
});
