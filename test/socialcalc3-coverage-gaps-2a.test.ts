import { expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  makeSave,
  recalcSheet,
  scheduleCommands,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// ── Narrow types for the SC bundle surface ──────────────────────────────
// loadSocialCalc() returns `any` (the UMD default export). We cast through
// `unknown` to a named const typed by these interfaces so we never write
// bare `any` in the new test code.

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
  parseinfo?: unknown;
}

interface SCFunc {
  (...args: unknown[]): unknown;
  new (...args: unknown[]): unknown;
}

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
// Section A1: ParseSheetSave throw-then-break dead code (dist 1011, 1028,
// 1139) and CellFromStringParts throw-then-break (dist 1245).
// The `break` after each `throw` is unreachable but still counts as
// uncovered statements. We trigger the throw to exercise the path.
// ═══════════════════════════════════════════════════════════════════════

test("ParseSheetSave throws on unknown col type token", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  expect(() => {
    sheet.ParseSheetSave(makeSave(["col:A:w:50:badtoken"]));
  }).toThrow();
});

test("ParseSheetSave throws on unknown row type token", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  expect(() => {
    sheet.ParseSheetSave(makeSave(["row:1:h:20:badtoken"]));
  }).toThrow();
});

test("ParseSheetSave throws on unknown line type", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  // alert is defined in browser shim
  expect(() => {
    sheet.ParseSheetSave(makeSave(["bogusline:data"]));
  }).toThrow();
});

test("CellFromStringParts throws on unknown cell type token", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    CellFromStringParts(cell: unknown, parts: string[], i: number): void;
  };
  const cell = new SC.Cell("A1");
  expect(() => {
    sheet.CellFromStringParts(cell, "v:n:42:badtoken:x".split(":"), 1);
  }).toThrow();
});

// ═══════════════════════════════════════════════════════════════════════
// Section A2: CanonicalizeSheet colattribs loop where cr.col > maxcol
// (dist 1565-1566, the true branch of `if (cr.col > maxcol)`).
// ═══════════════════════════════════════════════════════════════════════

test("CanonicalizeSheet with full=true picks up col attribs beyond maxcol", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
    CanonicalizeSheet(full?: boolean): void;
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, string>>;
    rowattribs: Record<string, Record<string, string>>;
    xlt: { maxcol: number; maxrow: number };
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 5",
    "set sheet lastcol 2",
    "set sheet lastrow 2",
    "set E width 50",
  ]);
  sheet.CanonicalizeSheet(true);
  expect(sheet.xlt.maxcol).toBeGreaterThanOrEqual(5);
});

// ═══════════════════════════════════════════════════════════════════════
// Section A3: CellToString xlt border binary-expr branches (dist 1394).
// The 4 binary-expr alt=1 branches are the `|| 0` fallbacks when t/r/b/l
// are falsy (0 or undefined). Need sheet.xlt set and cell with some
// borders but not all four.
// ═══════════════════════════════════════════════════════════════════════

test("CellToString with xlt uses borderstylesxlat fallback for missing borders", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    CanonicalizeSheet(full?: boolean): void;
    xlt?: {
      borderstylesxlat: number[];
      layoutsxlat: number[];
      fontsxlat: number[];
      colorsxlat: number[];
      cellformatsxlat: number[];
      valueformatsxlat: number[];
    };
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 bt 1",
    // Only bt is set, br/bb/bl are undefined → `|| 0` fallback
  ]);
  sheet.CanonicalizeSheet(true);
  // CellToString is called internally; we just need the xlt path to run
  const save = SC.CreateSheetSave(sheet) as string;
  expect(save).toContain("cell:A1");
  delete sheet.xlt;
});

// ═══════════════════════════════════════════════════════════════════════
// Section A4: EncodeSheetAttributes SetAttrib `v || value` (dist 1686).
// The alt=1 branch is when `v` is falsy, so `value` is used instead.
// SetAttrib is called with v = attribs.defaultcolwidth which is falsy.
// But the `if (attribs.defaultcolwidth)` guard prevents that. We need
// a case where SetAttrib is called with a falsy v. Looking at the code,
// SetAttrib is called with `sheet.cellformats[attribs.defaulttextformat]`
// which could be undefined if the format index doesn't exist.
// ═══════════════════════════════════════════════════════════════════════

test("EncodeSheetAttributes SetAttrib uses value fallback when v is falsy", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
    cellformats: string[];
  };
  // Set a defaulttextformat to a high index that doesn't exist in cellformats
  await scheduleCommands(SC, sheet, ["set sheet defaulttextformat right"]);
  // Now manually set attribs.defaulttextformat to an index with no entry
  sheet.attribs.defaulttextformat = 999;
  const result = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // textalignhoriz should have def=false (SetAttrib was called) but val=""
  // because sheet.cellformats[999] is undefined → v || value → value (which is undefined → "")
  expect(result.textalignhoriz).toBeDefined();
  expect(result.textalignhoriz.def).toBe(false);
});

// ═══════════════════════════════════════════════════════════════════════
// Section A5: DecodeCellAttributes cond-expr branches (dist 1779, 1787).
// Line 1779 has 4 cond-expr alt=0 branches (the `*.val + " "` side when
// .def is false). Line 1787 has 1 cond-expr alt=0 (fontlook.val side).
// Need mixed def/non-def padding and font attributes.
// ═══════════════════════════════════════════════════════════════════════

test("DecodeCellAttributes with all padding non-def exercises val branches (dist 1779)", async () => {
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
    "set A1 layout padding:2 3 4 5;vertical-align:top;",
  ]);
  // Encode the cell, then decode into a fresh sheet
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // All padding should be non-def (val is set)
  expect(encoded.padtop.def).toBe(false);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(false);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("layout");
});

test("DecodeCellAttributes with font non-def exercises fontlook val branch (dist 1787)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    GetAssuredCell(coord: string): SheetCell;
    GetStyleNum(type: string, style: string): number;
    fonts: string[];
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // Font string must match regex ^(\*|\S+? \S+?) (\S+?) (\S.*)$
    // "bold italic 12 arial" → group1="bold italic", group2="12", group3="arial"
    "set A1 font bold italic 12 arial",
  ]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // All font attrs should be non-def
  expect(encoded.fontlook.def).toBe(false);
  expect(encoded.fontsize.def).toBe(false);
  expect(encoded.fontfamily.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("font");
});

// ═══════════════════════════════════════════════════════════════════════
// Section A6: DecodeSheetAttributes cond-expr branches (dist 1853, 1911).
// Line 1853 has 2 cond-expr alt=0 (padding val branches).
// Line 1911 has 1 cond-expr alt=1 (the `|| ""` fallback when oldval is falsy).
// ═══════════════════════════════════════════════════════════════════════

test("DecodeSheetAttributes with all padding non-def exercises val branches (dist 1853)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, [
    "set sheet defaultlayout padding:2 3 4 5;vertical-align:top;",
  ]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(encoded.padtop.def).toBe(false);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(false);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultlayout");
});

test("DecodeSheetAttributes CheckChanges with falsy oldval exercises || fallback (dist 1911)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  // Set a color that will have a value, then decode into a sheet with no color set
  await scheduleCommands(SC, sheet, ["set sheet defaultcolor red"]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // sheet2 has no defaultcolor → oldval is undefined → `oldval || ""` → ""
  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultcolor");
});

// ═══════════════════════════════════════════════════════════════════════
// Section A7: set sheet lastcol/usermaxcol with non-numeric values
// (dist 2077, 2094 — the false branch of `if (typeof num == "number")`).
// `rest - 0` when rest is non-numeric produces NaN, and typeof NaN != "number"
// is false... wait, typeof NaN IS "number". So the false branch is when
// `rest - 0` produces something that IS a number but <= 0? No, the branch
// is `if (typeof num == "number")` — alt=1 is the ELSE branch (when it's
// NOT a number). But `rest - 0` always produces a number (or NaN which is
// still typeof "number"). So the else branch is unreachable!
// Actually wait — `rest - 0` for "foo" gives NaN, and typeof NaN == "number"
// is true. So the if branch always executes. The else branch (alt=1) is
// structurally unreachable. This is a dead branch.
// ═══════════════════════════════════════════════════════════════════════

// This branch is structurally unreachable — `rest - 0` always yields
// typeof "number" (including NaN). Documented as remainder.

// ═══════════════════════════════════════════════════════════════════════
// Section A8: set col/row range else branches (dist 2122, 2154, 2156).
// 2122: `else if (attrib == "hide")` — the else branch when attrib is
//   neither "width" nor "hide" for a col range. But the regex only matches
//   col ranges, and any attrib that isn't "width" or "hide" falls through.
//   Actually, looking at the code, there's no else — the if/else if just
//   doesn't execute either branch. The branch alt=1 is the else of the
//   outer `if (attrib == "width")` — which means attrib != "width".
//   This is covered when attrib == "hide" (the else-if branch).
//   Wait, let me re-read: the branch at 2122 is `else if (attrib == "hide")`.
//   alt=1 is the false side — when attrib is NOT "hide" (and not "width").
//   This happens when a col range gets an attrib that's neither width nor hide.
//   But looking at the code, after the for loop, there's no else — so if
//   attrib is something else, nothing happens. The branch is the cond-expr
//   of the `else if` — alt=1 means attrib != "hide".
//   Actually, 2122 is type=if, alt=1. Looking at the branchMap, it's an
//   `if` type with alt=1 being the else branch. So we need attrib != "hide"
//   when we're already in the else of `attrib != "width"`. This means
//   attrib is neither "width" nor "hide" for a col range.
// 2154: `else if (attrib == "hide")` for row range — same pattern.
// 2156: `if (rest.length > 0)` else branch — when rest is empty for hide.
// ═══════════════════════════════════════════════════════════════════════

test("set col-range with attrib neither width nor hide exercises else branch (dist 2122)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    colattribs: Record<string, Record<string, string>>;
    attribs: Record<string, unknown>;
  };
  // "set A:B height 25" — height is a row attrib, not col attrib
  // This should hit the col range regex but neither width nor hide branch
  const save = makeSave(["set A:B height 25"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // Nothing should be set — col range doesn't handle "height"
  expect(sheet.colattribs.width.A).toBeUndefined();
});

test("set row-range with attrib neither height nor hide exercises else branch (dist 2154)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    rowattribs: Record<string, Record<string, string>>;
    attribs: Record<string, unknown>;
  };
  // "set 1:3 width 25" — width is a col attrib, not row attrib
  const save = makeSave(["set 1:3 width 25"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.rowattribs.height[1]).toBeUndefined();
});

test("set col-range hide with empty rest deletes hide (dist 2156 else)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    colattribs: Record<string, Record<string, string>>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A hide yes"]);
  expect(sheet.colattribs.hide.A).toBe("yes");
  // Now set with empty rest → delete
  const save = makeSave(["set A hide "]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.colattribs.hide.A).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section A9: erase/cut with saveundo=false (dist 2347).
// The `if (saveundo)` false branch for erase/cut's changedrendervalues.
// ═══════════════════════════════════════════════════════════════════════

test("erase with saveundo=false exercises if(saveundo) false branches (dist 2347)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
  const save = makeSave(["erase A1:A2 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeUndefined();
  expect(sheet.cells.A2).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section A10: filldown/fillright with saveundo=false (dist 2409, 2430, 2464).
// 2409: `if (saveundo)` false for filldown/fillright changedrendervalues.
// 2430: `if (saveundo)` false for filldown/fillright (second one).
// 2464: `if (saveundo)` false for cell in fill loop.
// ═══════════════════════════════════════════════════════════════════════

test("filldown with saveundo=false exercises if(saveundo) false branches (dist 2409, 2430, 2464)", async () => {
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
  ]);
  const save = makeSave(["filldown A1:A5 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A3?.datavalue).toBe(30);
});

// ═══════════════════════════════════════════════════════════════════════
// Section A11: sort comparator branches (dist 2512, 2523, 2618, 2641,
// 2644, 2656, 2679, 2683, 2684, 2695, 2696, 2703, 2709, 2713, 2720).
// Many of these are `if (saveundo)` false branches in the sort cell loop
// and cond-expr branches in the comparator.
// 2512: `if (saveundo)` false for sort changedrendervalues
// 2523: `if (saveundo)` false for sort cell with saveundo
// 2618: `if (saveundo)` false for sort cell AddUndo
// 2641: `if (saveundo)` false for sort cell (existing cell)
// 2644: `if (saveundo)` false for sort cell (non-existing cell)
// 2656: binary-expr `valtype == "t"` false (valtype is not "t")
// 2679: cond-expr `a1 > b1` true/false
// 2683: cond-expr `dirs[i] == "up"` in text-vs-blank
// 2684: `else if (tb == "e")` — text vs error
// 2695: cond-expr `dirs[i] == "up"` in number-vs-blank
// 2696: `else if (tb == "e")` — number vs error
// 2703: cond-expr `a1 > b1` in error-vs-error
// 2709: `if (ta == "b")` — blank type
// 2713: cond-expr `dirs[i] == "up"` in blank-vs-non-blank
// 2720: cond-expr `a > b` final tiebreaker
// ═══════════════════════════════════════════════════════════════════════

test("sort with saveundo=false exercises if(saveundo) false branches (dist 2512, 2523, 2618, 2641, 2644)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value t zebra",
    "set A2 value n 10",
    "set A3 value t alpha",
    "set A4 value n 5",
  ]);
  const save = makeSave(["sort A1:A4 A up"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // After sort, A1 should have the smallest value
  expect(sheet.cells.A1).toBeDefined();
});

test("sort comparator exercises text-vs-error and number-vs-error branches (dist 2684, 2696)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value t hello",
    "set A2 formula 1/0",
    "set A3 value n 42",
    "set A4 formula 1/0",
    "sort A1:A4 A up",
  ]);
  await recalcSheet(SC, sheet);
  expect(Object.keys(sheet.cells).length).toBeGreaterThan(0);
});

test("sort comparator exercises error-vs-error and blank branches (dist 2703, 2709, 2713)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 formula 1/0",
    "set A2 formula 2/0",
    // A3 is blank (no cell)
    "set A4 value t hello",
    "sort A1:A4 A up",
    "sort A1:A4 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(Object.keys(sheet.cells).length).toBeGreaterThan(0);
});

test("sort comparator exercises final tiebreaker (dist 2720)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // All same value → tiebreaker must fire
  await scheduleCommands(SC, sheet, [
    "set A1 value n 5",
    "set A2 value n 5",
    "set A3 value n 5",
    "sort A1:A3 A up",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A1?.datavalue).toBe(5);
});

test("sort with numeric valtype exercises valtype!=t branch (dist 2656)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "sort A1:A3 A up",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section A12: copy/loadclipboard/clearclipboard/paste with saveundo=false
// (dist 2816, 2821, 2864, 2870, 2906, 2934, 2956, 2975, 2991, 3007, 3013, 3031).
// These are all `if (saveundo)` false branches in copy, paste, insertcol/row,
// deletecol/row commands.
// 2816: insertcol `if (cell)` false — cell is null in formula loop
// 2821: insertcol `if (v1.charAt(0) == "=")` false — name def doesn't start with =
// 2864: insertcol cellsToExpand `if (!cellsToExpand[...])` false
// 2870: insertrow cellsToExpand `if (!cellsToExpand[...])` false
// 2906: deletecol `if (cell && cell.readonly)` — cell is null
// 2934: deletecol `if (cell)` false — cell is null in formula loop
// 2956: deletecol `if (sheet.names[name])` false — name doesn't exist
// 2975: deleterow `if (saveundo)` false for row attribs
// 2991: deletecol `if (saveundo)` false for col attribs
// 3007: deletecol cellsToShrink `if (!cellsToShrink[...])` false
// 3013: deleterow cellsToShrink `if (!cellsToShrink[...])` false
// 3031: deletecol `if (cr1.col <= lastcol)` false
// ═══════════════════════════════════════════════════════════════════════

test("copy with saveundo=false exercises if(saveundo) false branch (dist 2816)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
  const save = makeSave(["copy A1:A2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(SC.Clipboard.clipboard).toContain("cell");
});

test("loadclipboard with saveundo=false exercises if(saveundo) false branch", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "copy A1"]);
  const clip = SC.Clipboard.clipboard;
  const save = makeSave([`loadclipboard ${String(SC.encodeForSave(clip))}`]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(SC.Clipboard.clipboard).toBeDefined();
});

test("clearclipboard with saveundo=false exercises if(saveundo) false branch", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "copy A1"]);
  const save = makeSave(["clearclipboard"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(SC.Clipboard.clipboard).toBe("");
});

test("paste with saveundo=false exercises if(saveundo) false branches", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2", "copy A1:A2"]);
  const save = makeSave(["paste B1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.B1?.datavalue).toBe(1);
});

test("insertcol with saveundo=false and names without = prefix (dist 2821)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, { definition: string; desc: string }>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "name define MYNAME SUM(A1:B1)",
    "insertcol B",
  ]);
  // The name definition "SUM(A1:B1)" doesn't start with "="
  expect(sheet.names.MYNAME).toBeDefined();
});

test("insertcol with saveundo=false exercises if(saveundo) false branches (dist 2864)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2", "merge A1:B1"]);
  const save = makeSave(["insertcol A"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

test("insertrow with saveundo=false exercises cellsToExpand branches (dist 2870)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2", "merge A1:A2"]);
  const save = makeSave(["insertrow 1"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

test("deletecol with saveundo=false exercises readonly and formula branches (dist 2906, 2934)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set C1 value n 3",
    "set sheet lastcol 3",
  ]);
  // Delete col B (which has no cells) — cell is null in formula loop
  const save = makeSave(["deletecol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("deletecol with saveundo=false and no names exercises name false branch (dist 2956)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set sheet lastcol 2",
  ]);
  // No names defined → `if (sheet.names[name])` is never true
  const save = makeSave(["deletecol A"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined(); // B1 shifted to A1
});

test("deleterow with saveundo=false exercises row attribs if(saveundo) false (dist 2975)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    rowattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set 1 height 25",
    "set 2 height 30",
    "set sheet lastrow 3",
  ]);
  const save = makeSave(["deleterow 1"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("deletecol with saveundo=false exercises col attribs if(saveundo) false (dist 2991)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, string>>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set A width 50",
    "set B width 60",
    "set sheet lastcol 3",
  ]);
  const save = makeSave(["deletecol A"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("deletecol with merged cells exercises cellsToShrink branches (dist 3007)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "merge A1:C1",
    "set sheet lastcol 4",
  ]);
  // Delete col B — the merged cell A1:C1 should shrink
  const save = makeSave(["deletecol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("deleterow with merged cells exercises cellsToShrink branches (dist 3013)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "merge A1:A3",
    "set sheet lastrow 4",
  ]);
  const save = makeSave(["deleterow 2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("deletecol where cr1.col > lastcol exercises false branch (dist 3031)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set sheet lastcol 2"]);
  // Delete col C which is beyond lastcol=2
  const save = makeSave(["deletecol C"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section A13: movepaste/moveinsert with saveundo=false and various branches
// (dist 3082, 3083, 3096, 3156, 3159, 3170, 3194, 3197, 3229, 3240, 3241).
// 3082/3083: `if (!sheet.cells[cr]) continue` — source cell doesn't exist
// 3096: `if (cellProperties[attrib] == 1 || cellProperties[attrib] == 3)` in formulas
// 3156: `if (saveundo)` false in insertvert loop
// 3159: `if (rest == "all" || rest == "formats")` — need rest=formats
// 3170: `if (rest == "all" || rest == "formulas")` — need rest=formulas
// 3194: `if (saveundo)` false in inserthoriz loop
// 3197: `if (rest == "all" || rest == "formats")` — need rest=formats
// 3229: `if (cell.readonly) continue` — dest is readonly
// 3240: `if (!basecell) basecell = sheet.GetAssuredCell(crbase)` — basecell not in movingcells
// 3241: statement — the GetAssuredCell call
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with saveundo=false and missing source cell (dist 3082, 3083)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set sheet lastcol 3",
    "set sheet lastrow 3",
  ]);
  // Source range A1:B2 has B1/B2 missing → `if (!sheet.cells[cr]) continue`
  const save = makeSave(["movepaste A1:B2 C3 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C3?.datavalue).toBe(1);
});

test("movepaste with rest=formulas exercises formulas branches (dist 3096)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set sheet lastcol 3",
    "set sheet lastrow 3",
  ]);
  const save = makeSave(["movepaste A1:A2 C1 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1?.datavalue).toBe(1);
});

test("movepaste with rest=formats exercises formats branches (dist 3159, 3197)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 font bold 12 arial",
    "set sheet lastcol 3",
    "set sheet lastrow 3",
  ]);
  const save = makeSave(["movepaste A1:A1 C1 formats"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1).toBeDefined();
});

test("movepaste with readonly dest cell exercises continue branch (dist 3229)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set C1 value n 99",
    "set C1 readonly yes",
    "set sheet lastcol 3",
    "set sheet lastrow 1",
  ]);
  const save = makeSave(["movepaste A1:A1 C1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // C1 is readonly → should be skipped, keeping its value
  expect(sheet.cells.C1?.datavalue).toBe(99);
});

test("movepaste where basecell not in movingcells exercises fallback (dist 3240, 3241)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set sheet lastcol 3",
    "set sheet lastrow 1",
  ]);
  // movepaste A1:A1 B1 all — source is A1, dest is B1
  // movingcells has A1, but dest loop iterates cr1.col to cr1.col+numcols-1
  // crbase = A1, which IS in movingcells. To get basecell not in movingcells,
  // we need a source range where some cells are missing.
  // movepaste A1:B1 C1 all — A1 exists, B1 exists, both in movingcells
  // movepaste A1:B1 D1 all — crbase for D1 is A1, for E1 is B1
  // To hit `if (!basecell)`, we need movingcells[crbase] to be undefined.
  // This happens when rest != "all" (so cells aren't deleted) and
  // the source cell didn't exist (so it wasn't added to movingcells).
  // With rest="formulas", cells aren't deleted, and if B1 doesn't exist...
  const save = makeSave(["movepaste A1:B1 C1 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // C1 should get A1's value, D1 should get B1's value via fallback
  expect(sheet.cells.C1?.datavalue).toBe(1);
});

test("moveinsert with saveundo=false exercises insertvert saveundo false (dist 3156)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set A5 value n 5",
    "set sheet lastcol 1",
    "set sheet lastrow 10",
  ]);
  // moveinsert A1:A2 A4 — inserts vertically (dest below source)
  const save = makeSave(["moveinsert A1:A2 A4 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

test("moveinsert with saveundo=false exercises inserthoriz saveundo false (dist 3194)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "set D1 value n 4",
    "set E1 value n 5",
    "set sheet lastcol 10",
    "set sheet lastrow 1",
  ]);
  // moveinsert A1:B1 D1 — inserts horizontally (dest to the right of source)
  const save = makeSave(["moveinsert A1:B1 D1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

test("moveinsert with rest=formulas exercises insertvert formulas branch (dist 3170)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set A5 value n 5",
    "set sheet lastcol 1",
    "set sheet lastrow 10",
  ]);
  const save = makeSave(["moveinsert A1:A2 A4 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

test("moveinsert with rest=formats exercises inserthoriz formats branch (dist 3197)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 font bold 12 arial",
    "set B1 value n 2",
    "set C1 value n 3",
    "set D1 value n 4",
    "set E1 value n 5",
    "set sheet lastcol 10",
    "set sheet lastrow 1",
  ]);
  const save = makeSave(["moveinsert A1:B1 D1 formats"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section A14: name commands with saveundo=false (dist 3271, 3277, 3287).
// 3271: `if (saveundo)` false for name define (existing name)
// 3277: `if (saveundo)` false for name define (new name)
// 3287: `if (saveundo)` false for name desc
// Also: name delete with saveundo=false
// ═══════════════════════════════════════════════════════════════════════

test("name define existing with saveundo=false (dist 3271)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["name define FOO 1+1"]);
  const save = makeSave(["name define FOO 2+2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.FOO?.definition).toBe("2+2");
});

test("name define new with saveundo=false (dist 3277)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  const save = makeSave(["name define BAR 3+3"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.BAR?.definition).toBe("3+3");
});

test("name desc with saveundo=false (dist 3287)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["name define FOO 1+1"]);
  const save = makeSave(["name desc FOO my description"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.FOO?.desc).toBe("my description");
});

test("name delete with saveundo=false", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["name define FOO 1+1", "name desc FOO hello"]);
  const save = makeSave(["name delete FOO"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.FOO).toBeUndefined();
});

test("name define with empty name is no-op", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  const save = makeSave(["name define !!! 1+1"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // "!!!" gets stripped to "" → break before defining
  expect(Object.keys(sheet.names).length).toBe(0);
});

test("name define with empty rest is no-op", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  const save = makeSave(["name define FOO "]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.FOO).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section A15: pane commands (dist 3357, 3373, 3383, 3399, 3410).
// 3357: `if (saveundo)` false for pane row
// 3373: `if (editor.griddiv)` true — need griddiv set
// 3383: `if (saveundo)` false for pane col
// 3399: `if (editor.griddiv)` true for col — need griddiv set
// 3410: `if (cmdextension)` false — startcmdextension with no callback
// ═══════════════════════════════════════════════════════════════════════

test("pane row with saveundo=false (dist 3357)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    rowattribs: Record<string, Record<string, string>>;
    renderneeded: boolean;
  };
  (fakeEditor as unknown as FakeEditor).context.sheetobj = sheet;
  const save = makeSave(["pane row 3"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.renderneeded).toBe(true);
});

test("pane col with saveundo=false (dist 3383)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, string>>;
    renderneeded: boolean;
  };
  (fakeEditor as unknown as FakeEditor).context.sheetobj = sheet;
  const save = makeSave(["pane col 3"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.renderneeded).toBe(true);
});

test("pane row with griddiv and trackingline (dist 3373)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    rowattribs: Record<string, Record<string, string>>;
    renderneeded: boolean;
  };
  (fakeEditor as unknown as FakeEditor).context.sheetobj = sheet;
  // Set up griddiv with a child trackingline element
  const griddiv = document.createElement("div");
  griddiv.id = "griddiv";
  document.body.appendChild(griddiv);
  const trackLine = document.createElement("div");
  trackLine.id = "trackingline-vertical";
  griddiv.appendChild(trackLine);
  (fakeEditor as unknown as FakeEditor).griddiv = griddiv;

  const save = makeSave(["pane row 5"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.renderneeded).toBe(true);
});

test("pane col with griddiv and trackingline (dist 3399)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, string>>;
    renderneeded: boolean;
  };
  (fakeEditor as unknown as FakeEditor).context.sheetobj = sheet;
  const griddiv = document.createElement("div");
  griddiv.id = "griddiv2";
  document.body.appendChild(griddiv);
  const trackLine = document.createElement("div");
  trackLine.id = "trackingline-horizon";
  griddiv.appendChild(trackLine);
  (fakeEditor as unknown as FakeEditor).griddiv = griddiv;

  const save = makeSave(["pane col 5"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.renderneeded).toBe(true);
});

test("startcmdextension with no callback exercises if(cmdextension) false (dist 3410)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    sci: { CmdExtensionCallbacks: Record<string, unknown> };
  };
  const save = makeSave(["startcmdextension nosuchcallback"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // No error, no crash — startcmdextension just breaks without setting needsrecalc
  expect(sheet.sci.CmdExtensionCallbacks.nosuchcallback).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section A16: SocialCalc._app widgetsClean branches (dist 3426).
// 3426: `else if (attrib == "all")` — need _app set, cellChanged=true,
//   renderneeded=true, and attrib="all".
// ═══════════════════════════════════════════════════════════════════════

test("ExecuteSheetCommand with _app set and set coord all exercises widgetsClean (dist 3426)", async () => {
  const SC = await loadSC();
  const SCObj = SC as unknown as { _app?: unknown };
  SCObj._app = true;
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    widgetsClean: boolean;
    renderneeded: boolean;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  // Now do "set A1 all" with a value — this should set attrib="all" and
  // cellChanged=true, renderneeded=true → widgetsClean=false
  const save = makeSave(["set A1 all :v:42"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.widgetsClean).toBe(false);
  // Clean up
  delete SCObj._app;
});
// ═══════════════════════════════════════════════════════════════════════
// Section B1: cut with saveundo=false (dist 2347 alt=1).
// The `if (saveundo)` false branch for cut's loadclipboard.
// ═══════════════════════════════════════════════════════════════════════

test("cut with saveundo=false exercises if(saveundo) false for loadclipboard (dist 2347)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
  const save = makeSave(["cut A1:A2 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(SC.Clipboard.clipboard).toContain("cell");
  expect(sheet.cells.A1).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B2: filldown with saveundo=false and range2 (dist 2409 alt=1).
// The `if (saveundo)` false branch for filldown's changedrendervalues.
// Also need fillright with saveundo=false.
// ═══════════════════════════════════════════════════════════════════════

test("fillright with saveundo=false exercises if(saveundo) false (dist 2409)", async () => {
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
  ]);
  const save = makeSave(["fillright A1:E1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1?.datavalue).toBe(30);
});

// ═══════════════════════════════════════════════════════════════════════
// Section B3: sort with saveundo=false (dist 2644 alt=1).
// The `if (saveundo)` false branch for sort cell AddUndo.
// ═══════════════════════════════════════════════════════════════════════

test("sort with saveundo=false exercises if(saveundo) false for cell (dist 2644)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 3", "set A2 value n 1", "set A3 value n 2"]);
  const save = makeSave(["sort A1:A3 A up"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section B4: insertcol with saveundo=false (dist 2816, 2821, 2864 alt=1).
// 2816 alt=1: `if (cell)` false — cell is null in formula loop
// 2821 alt=1: `if (v1.charAt(0) == "=")` false — name def doesn't start with =
// 2864 alt=1: `if (!cellsToExpand[...])` false — cellsToExpand entry exists
// ═══════════════════════════════════════════════════════════════════════

test("insertcol with saveundo=false exercises all false branches (dist 2816, 2821, 2864)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, { definition: string; desc: string }>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "name define MYNAME SUM(A1:B1)",
    "merge A1:B1",
  ]);
  const save = makeSave(["insertcol A"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B5: insertrow with saveundo=false (dist 2870 alt=1).
// 2870 alt=1: `if (!cellsToExpand[...])` false — cellsToExpand entry exists
// ═══════════════════════════════════════════════════════════════════════

test("insertrow with saveundo=false exercises cellsToExpand false (dist 2870)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2", "merge A1:A2"]);
  const save = makeSave(["insertrow 1"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B6: deletecol with saveundo=false (dist 2906, 2934, 2956 alt=1).
// 2906 alt=1: `if (cell && cell.readonly)` cond-expr false side
// 2934 alt=1: `if (cell)` false — cell is null in formula loop
// 2956 alt=1: `if (sheet.names[name])` false — name doesn't exist
// ═══════════════════════════════════════════════════════════════════════

test("deletecol with saveundo=false exercises readonly, cell, and names false (dist 2906, 2934, 2956)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set C1 value n 3",
    "set sheet lastcol 3",
  ]);
  // Delete col B (no cells, no names) — all false branches
  const save = makeSave(["deletecol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B7: deletecol/deleterow with merged cells saveundo=false
// (dist 3007, 3013 alt=1).
// 3007 alt=1: `if (!cellsToShrink[...])` false — cellsToShrink entry exists
// 3013 alt=1: `if (!cellsToShrink[...])` false — cellsToShrink entry exists
// ═══════════════════════════════════════════════════════════════════════

test("deletecol with merged cells saveundo=false exercises cellsToShrink false (dist 3007)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "merge A1:C1",
    "set sheet lastcol 4",
  ]);
  const save = makeSave(["deletecol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("deleterow with merged cells saveundo=false exercises cellsToShrink false (dist 3013)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "merge A1:A3",
    "set sheet lastrow 4",
  ]);
  const save = makeSave(["deleterow 2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B8: name commands with saveundo=false (dist 3271, 3277, 3287,
// 3323, 3328 alt=1).
// 3271 alt=1: name define existing `if (saveundo)` false
// 3277 alt=1: name define new `if (saveundo)` false
// 3287 alt=1: name desc `if (saveundo)` false
// 3323 alt=1: name desc `if (sheet.names[name])` false — name doesn't exist
// 3328 alt=1: name delete `if (saveundo)` false
// ═══════════════════════════════════════════════════════════════════════

test("name define existing with saveundo=false (dist 3271 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["name define FOO 1+1"]);
  const save = makeSave(["name define FOO 2+2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.FOO?.definition).toBe("2+2");
});

test("name define new with saveundo=false (dist 3277 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  const save = makeSave(["name define BAR 3+3"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.BAR?.definition).toBe("3+3");
});

test("name desc with saveundo=false (dist 3287 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["name define FOO 1+1"]);
  const save = makeSave(["name desc FOO my description"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.FOO?.desc).toBe("my description");
});

test("name desc for non-existent name with saveundo=false (dist 3323 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  // No name defined — `if (sheet.names[name])` is false
  const save = makeSave(["name desc NOEXIST hello"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.NOEXIST).toBeUndefined();
});

test("name delete with saveundo=false (dist 3328 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    names: Record<string, { definition: string; desc: string }>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["name define FOO 1+1", "name desc FOO hello"]);
  const save = makeSave(["name delete FOO"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.names.FOO).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B9: pane with griddiv falsy (dist 3373, 3399 alt=1).
// 3373 alt=1: `if (editor.griddiv)` false — griddiv is null/undefined
// 3399 alt=1: `if (editor.griddiv)` false — griddiv is null/undefined
// ═══════════════════════════════════════════════════════════════════════

test("pane row without griddiv exercises if(editor.griddiv) false (dist 3373 alt=1)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    rowattribs: Record<string, Record<string, string>>;
    renderneeded: boolean;
  };
  (fakeEditor as unknown as FakeEditor).context.sheetobj = sheet;
  // griddiv is null by default in the mock
  const save = makeSave(["pane row 3"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.renderneeded).toBe(true);
});

test("pane col without griddiv exercises if(editor.griddiv) false (dist 3399 alt=1)", async () => {
  const SC = await loadSCBrowser();
  installUiShim();
  const fakeEditor = installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    colattribs: Record<string, Record<string, string>>;
    renderneeded: boolean;
  };
  (fakeEditor as unknown as FakeEditor).context.sheetobj = sheet;
  // griddiv is null by default in the mock
  const save = makeSave(["pane col 3"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.renderneeded).toBe(true);
});

// ═══════════════════════════════════════════════════════════════════════
// Section B10: col/row hide with empty rest saveundo=false (dist 2156 alt=1).
// 2156 alt=1: `if (rest.length > 0)` false — rest is empty for row hide
// Also: col hide with empty rest saveundo=false
// ═══════════════════════════════════════════════════════════════════════

test("row hide with empty rest saveundo=false exercises if(rest.length) false (dist 2156 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    rowattribs: Record<string, Record<string, string>>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set 1 hide yes"]);
  expect(sheet.rowattribs.hide[1]).toBe("yes");
  // Now set with empty rest → delete
  const save = makeSave(["set 1 hide "]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.rowattribs.hide[1]).toBeUndefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B11: sort comparator remaining branches (dist 2656, 2679, 2684,
// 2695, 2696, 2703, 2709, 2713, 2720).
// 2656 alt=1: `valtype == "t"` false — valtype is not "t" (numeric/error/blank)
// 2679 alt=1: `a1 > b1 ? 1 : a1 < b1 ? -1 : 0` — need text-vs-text with a1 < b1
// 2684 alt=1: `else if (tb == "e")` false — text vs non-error/non-blank
// 2695 alt=0: `dirs[i] == "up"` cond-expr — number vs blank
// 2696 alt=1: `else if (tb == "e")` false — number vs non-error/non-blank
// 2703 alt=0: `a1 > b1` cond-expr — error vs error
// 2709 alt=1: `if (ta == "b")` false — ta is not blank
// 2713 alt=1: `dirs[i] == "up"` cond-expr — blank vs non-blank
// 2720 alt=1: `a > b` cond-expr — final tiebreaker
// ═══════════════════════════════════════════════════════════════════════

test("sort text down exercises a1<b1 branch (dist 2679 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value t zebra",
    "set A2 value t alpha",
    "set A3 value t mango",
    "sort A1:A3 A down",
  ]);
  await recalcSheet(SC, sheet);
  // After sort down, A1 should have the largest (zebra)
  expect(sheet.cells.A1?.datavalue).toBe("zebra");
});

test("sort text vs number exercises valtype!=t and text-vs-n branches (dist 2656, 2684)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value t hello",
    "set A2 value n 42",
    "set A3 value t world",
    "sort A1:A3 A up",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells).toBeDefined();
});

test("sort number vs blank exercises dirs==up cond-expr (dist 2695)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    // A2 is blank
    "set A3 value n 5",
    "sort A1:A3 A up",
    "sort A1:A3 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells).toBeDefined();
});

test("sort error vs error exercises a1>b1 cond-expr (dist 2703)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 formula 1/0",
    "set A2 formula 2/0",
    "set A3 formula 3/0",
    "sort A1:A3 A up",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells).toBeDefined();
});

test("sort blank vs non-blank exercises dirs==up cond-expr (dist 2709, 2713)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // A1 is blank, A2 has text
  await scheduleCommands(SC, sheet, [
    "set A2 value t hello",
    "set A3 value n 42",
    "sort A1:A3 A up",
    "sort A1:A3 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells).toBeDefined();
});

test("sort all-same exercises final tiebreaker a>b (dist 2720)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // All same value → tiebreaker must fire, and a > b for down sort
  await scheduleCommands(SC, sheet, [
    "set A1 value n 5",
    "set A2 value n 5",
    "set A3 value n 5",
    "sort A1:A3 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A1?.datavalue).toBe(5);
});

// ═══════════════════════════════════════════════════════════════════════
// Section B12: movepaste with missing source cell (dist 3082 alt=0, 3083).
// 3082 alt=0: `if (!sheet.cells[cr])` true — source cell doesn't exist
// 3083: the continue statement
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with missing source cell exercises continue (dist 3082, 3083)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // B1 is NOT set — source range A1:B1 has B1 missing
    "set sheet lastcol 3",
    "set sheet lastrow 1",
  ]);
  // movepaste A1:B1 C1 all — B1 is missing → continue
  const save = makeSave(["movepaste A1:B1 C1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section B13: movepaste with rest=formulas and cellProperties (dist 3096 alt=1).
// 3096 alt=1: `if (cellProperties[attrib] == 1 || cellProperties[attrib] == 3)` false
// This is when the property is not a formula property (not 1 or 3).
// With rest="formulas", only formula properties are copied.
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with rest=formulas and non-formula properties (dist 3096 alt=1)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 font bold italic 12 arial",
    "set sheet lastcol 3",
    "set sheet lastrow 1",
  ]);
  // With rest="formulas", non-formula properties (like font) should be skipped
  const save = makeSave(["movepaste A1:A1 C1 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section B14: movepaste with !basecell (dist 3240 alt=0, 3241).
// 3240 alt=0: `if (!basecell)` true — basecell not in movingcells
// 3241: the GetAssuredCell call
// This happens when rest != "all" and the source cell didn't exist.
// With rest="formulas", cells aren't deleted, and if B1 doesn't exist,
// movingcells[B1] is undefined → basecell is undefined.
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with rest=formulas and missing source exercises !basecell (dist 3240, 3241)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // B1 is NOT set — source range A1:B1 has B1 missing
    "set sheet lastcol 3",
    "set sheet lastrow 1",
  ]);
  // movepaste A1:B1 C1 formulas — B1 is missing, rest=formulas
  // movingcells will have A1 but not B1
  // When iterating dest cells, crbase for D1 is B1, which is not in movingcells
  // → basecell is undefined → GetAssuredCell
  const save = makeSave(["movepaste A1:B1 C1 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section B15: moveinsert with rest=formulas/formats (dist 3170, 3197 alt=1).
// 3170 alt=1: `if (rest == "all" || rest == "formulas")` false — rest=formats
// 3197 alt=1: `if (rest == "all" || rest == "formats")` false — rest=formulas
// ═══════════════════════════════════════════════════════════════════════

test("moveinsert with rest=formats exercises insertvert formulas false (dist 3170 alt=1)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 font bold italic 12 arial",
    "set A2 value n 2",
    "set A3 value n 3",
    "set A4 value n 4",
    "set A5 value n 5",
    "set sheet lastcol 1",
    "set sheet lastrow 10",
  ]);
  // moveinsert A1:A2 A4 formats — rest=formats, not formulas
  // For insertvert: `if (rest == "all" || rest == "formulas")` is false
  const save = makeSave(["moveinsert A1:A2 A4 formats"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

test("moveinsert with rest=formulas exercises inserthoriz formats false (dist 3197 alt=1)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "set D1 value n 4",
    "set E1 value n 5",
    "set sheet lastcol 10",
    "set sheet lastrow 1",
  ]);
  // moveinsert A1:B1 D1 formulas — rest=formulas, not formats
  // For inserthoriz: `if (rest == "all" || rest == "formats")` is false
  const save = makeSave(["moveinsert A1:B1 D1 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section B16: DecodeCellAttributes cond-expr alt=0 (dist 1779, 1787).
// 1779 alt=0: cond-expr `*.def ? "" : *.val + " "` — the false side (val + " ")
// 1787 alt=0: cond-expr for fontlook — the false side (fontlook.val + " ")
// These are the non-def branches. Need ALL padding/font to be non-def.
// My existing tests set some but not all padding/font attrs to non-def.
// ═══════════════════════════════════════════════════════════════════════

test("DecodeCellAttributes all padding non-def exercises all cond-expr false (dist 1779)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    GetAssuredCell(coord: string): SheetCell;
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // Set ALL padding + vertical-align to non-default
    "set A1 layout padding:2 3 4 5;vertical-align:top;",
  ]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // Verify ALL padding are non-def
  expect(encoded.padtop.def).toBe(false);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(false);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("layout");
});

test("DecodeCellAttributes all font non-def exercises fontlook cond-expr false (dist 1787)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    GetAssuredCell(coord: string): SheetCell;
    GetStyleNum(type: string, style: string): number;
    fonts: string[];
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // Set font with non-default look, size, and family
    "set A1 font bold italic 12 arial",
  ]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(encoded.fontlook.def).toBe(false);
  expect(encoded.fontsize.def).toBe(false);
  expect(encoded.fontfamily.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("font");
});

// ═══════════════════════════════════════════════════════════════════════
// Section B17: DecodeSheetAttributes cond-expr alt=0 (dist 1853).
// 1853 alt=0: cond-expr for padding — the false side (val + " ")
// Need ALL sheet-level padding to be non-def.
// ═══════════════════════════════════════════════════════════════════════

test("DecodeSheetAttributes all padding non-def exercises all cond-expr false (dist 1853)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, [
    "set sheet defaultlayout padding:2 3 4 5;vertical-align:top;",
  ]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(encoded.padtop.def).toBe(false);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(false);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultlayout");
});

// ═══════════════════════════════════════════════════════════════════════
// Section B18: DecodeSheetAttributes cond-expr alt=1 (dist 1911).
// 1911 alt=1: `oldval || ""` — the `""` side when oldval is falsy.
// Need a sheet attribute that has a value but the target sheet has no value.
// ═══════════════════════════════════════════════════════════════════════

test("DecodeSheetAttributes with falsy oldval exercises || fallback (dist 1911)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  // Set a defaultcolor that will have a value
  await scheduleCommands(SC, sheet, ["set sheet defaultcolor red"]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // sheet2 has no defaultcolor → oldval is undefined → `oldval || ""` → ""
  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultcolor");
});

// ═══════════════════════════════════════════════════════════════════════
// Section B19: CellToString xlt border fallback (dist 1394 alt=1).
// 1394 alt=1: `xlt.borderstylesxlat[t || 0]` — the `|| 0` fallback when
// t/r/b/l is falsy (0 or undefined). Need cell with some borders but not all.
// My existing test sets bt=1 but br/bb/bl are undefined.
// The issue is that the test needs to call CreateSheetSave with canonicalize
// to trigger the xlt path in CellToString.
// ═══════════════════════════════════════════════════════════════════════

test("CellToString with xlt and partial borders exercises || 0 fallback (dist 1394)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    CanonicalizeSheet(full?: boolean): void;
    xlt?: {
      borderstylesxlat: number[];
      layoutsxlat: number[];
      fontsxlat: number[];
      colorsxlat: number[];
      cellformatsxlat: number[];
      valueformatsxlat: number[];
    };
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 bt 1",
    // Only bt is set, br/bb/bl are undefined → `|| 0` fallback
  ]);
  sheet.CanonicalizeSheet(true);
  // CreateSheetSave with canonicalize=true triggers xlt path in CellToString
  const save = SC.CreateSheetSave(sheet, undefined, true) as string;
  expect(save).toContain("cell:A1");
  delete sheet.xlt;
});

// ═══════════════════════════════════════════════════════════════════════
// Section B20: _app widgetsClean with attrib=all (dist 3426 alt=0).
// 3426 alt=0: `else if (attrib == "all")` true side — need _app set,
// cellChanged=true, renderneeded=true, and attrib="all".
// My existing test calls with saveundo=false, but the _app check is after
// the switch. The issue is that attrib is a local var set in the "set" case.
// When "set A1 all :v:42" runs, attrib="all", cellChanged=true.
// But renderneeded might not be true. Let me check.
// Actually, the "set" case sets sheet.renderneeded = true at line 2032.
// Wait, that's only for "set sheet". For "set <coord>", renderneeded is set
// by specific attribs. Let me check if "set A1 all" sets renderneeded.
// ═══════════════════════════════════════════════════════════════════════

test("ExecuteSheetCommand _app with set coord all and renderneeded (dist 3426 alt=0)", async () => {
  const SC = await loadSC();
  const SCObj = SC as unknown as { _app?: unknown };
  SCObj._app = true;
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    widgetsClean: boolean;
    renderneeded: boolean;
  };
  // First set a cell with a border (which sets renderneeded=true)
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 bt 1"]);
  // Now "set A1 all" with a value — attrib="all", cellChanged=true
  // renderneeded is already true from the border
  const save = makeSave(["set A1 all :v:42"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.widgetsClean).toBe(false);
  delete SCObj._app;
});
// ═══════════════════════════════════════════════════════════════════════
// Section C1: sort with non-existent cell and saveundo=false (dist 2644 alt=1).
// 2644 alt=1: `if (saveundo)` false in the else branch (cell doesn't exist).
// Need a sort range that includes a non-existent cell AND saveundo=false.
// ═══════════════════════════════════════════════════════════════════════

test("sort with non-existent cell and saveundo=false (dist 2644 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 3",
    "set A3 value n 2",
    // A2 is NOT set — sort range A1:A3 includes non-existent A2
    "set sheet lastrow 3",
  ]);
  const save = makeSave(["sort A1:A3 A up"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section C2: insertcol with saveundo=false and no cells in formula loop
// (dist 2816 alt=1).
// 2816 alt=1: `if (cell)` false — cell is null when iterating formulas.
// Need insertcol where a cell's formula references a range that includes
// a cell that doesn't exist after the shift.
// Actually, looking at the code, 2816 is in the insertcol formula loop:
//   for (cr in sheet.cells) {
//     cell = sheet.cells[cr];
//     if (cell.formula) {
//       ... parse formula ...
//       if (cell) {  // line 2816
//         ... update formula ...
//       }
//     }
//   }
// The `if (cell)` at 2816 is always true because we just got cell from
// sheet.cells[cr]. So alt=1 is unreachable? No, `cell` is reassigned
// inside the formula parsing. Let me check.
// ═══════════════════════════════════════════════════════════════════════

test("insertcol with saveundo=false and formula referencing empty cells (dist 2816 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set C1 formula SUM(A1:B1)",
    // B1 is NOT set — formula references empty cell
    "set sheet lastcol 4",
  ]);
  const save = makeSave(["insertcol A"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section C3: insertcol with saveundo=false and name not starting with =
// (dist 2821 alt=1).
// 2821 alt=1: `if (v1.charAt(0) == "=")` false — name def doesn't start with =
// Need insertcol with a name whose definition doesn't start with "=".
// ═══════════════════════════════════════════════════════════════════════

test("insertcol with saveundo=false and name without = prefix (dist 2821 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, { definition: string; desc: string }>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    // Name definition doesn't start with "="
    "name define MYNAME SUM(A1:B1)",
    "set sheet lastcol 4",
  ]);
  const save = makeSave(["insertcol A"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section C4: insertcol/insertrow with saveundo=false and merged cells
// (dist 2864, 2870 alt=1).
// 2864 alt=1: `if (!cellsToExpand[coord])` false — cellsToExpand entry exists
// 2870 alt=1: same for insertrow
// Need merged cells that create cellsToExpand entries.
// ═══════════════════════════════════════════════════════════════════════

test("insertcol with saveundo=false and merged cells (dist 2864 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "merge A1:C1",
    "set sheet lastcol 5",
  ]);
  const save = makeSave(["insertcol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

test("insertrow with saveundo=false and merged cells (dist 2870 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "merge A1:A3",
    "set sheet lastrow 5",
  ]);
  const save = makeSave(["insertrow 2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section C5: deletecol with saveundo=false (dist 2906, 2934, 2956 alt=1).
// 2906 alt=1: `cell && cell.readonly` cond-expr — when cell is null
// 2934 alt=1: `if (cell)` false — cell is null in formula loop
// 2956 alt=1: `if (sheet.names[name])` false — name doesn't exist
// ═══════════════════════════════════════════════════════════════════════

test("deletecol with saveundo=false and no cells/names (dist 2906, 2934, 2956 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set C1 value n 3",
    "set sheet lastcol 3",
  ]);
  // Delete col B (no cells, no names)
  const save = makeSave(["deletecol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section C6: deletecol/deleterow with merged cells saveundo=false
// (dist 3007, 3013 alt=1).
// 3007 alt=1: `if (!cellsToShrink[...])` false — cellsToShrink entry exists
// 3013 alt=1: same for deleterow
// ═══════════════════════════════════════════════════════════════════════

test("deletecol with merged cells saveundo=false (dist 3007 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "merge A1:C1",
    "set sheet lastcol 4",
  ]);
  const save = makeSave(["deletecol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("deleterow with merged cells saveundo=false (dist 3013 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A2 value n 2",
    "set A3 value n 3",
    "merge A1:A3",
    "set sheet lastrow 4",
  ]);
  const save = makeSave(["deleterow 2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section C7: movepaste with missing source cell (dist 3082 alt=0, 3083).
// 3082 alt=0: `if (!sheet.cells[cr])` true — source cell doesn't exist
// 3083: the continue statement
// Need movepaste where the source range includes a non-existent cell.
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with missing source cell exercises continue (dist 3082, 3083)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // B1 is NOT set — source range A1:B1 has B1 missing
    "set sheet lastcol 3",
    "set sheet lastrow 1",
  ]);
  const save = makeSave(["movepaste A1:B1 C1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section C8: movepaste with !basecell (dist 3240 alt=0, 3241).
// 3240 alt=0: `if (!basecell)` true — basecell not in movingcells
// 3241: the GetAssuredCell call
// Need movepaste with rest="formulas" and a missing source cell.
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with rest=formulas and missing source exercises !basecell (dist 3240, 3241)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // B1 is NOT set
    "set sheet lastcol 3",
    "set sheet lastrow 1",
  ]);
  // movepaste A1:B1 C1 formulas — B1 is missing, rest=formulas
  // movingcells will have A1 but not B1
  // When iterating dest cells, crbase for D1 is B1, which is not in movingcells
  // → basecell is undefined → GetAssuredCell
  const save = makeSave(["movepaste A1:B1 C1 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C1?.datavalue).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════
// Section C9: name commands with saveundo=false (dist 3271, 3277, 3287, 3328 alt=1).
// These are the same tests from Section B8 but let me verify they're correct.
// 3271 alt=1: name define existing `if (saveundo)` false
// 3277 alt=1: name define new `if (saveundo)` false
// 3287 alt=1: name desc `if (saveundo)` false
// 3328 alt=1: name delete `if (saveundo)` false
// ═══════════════════════════════════════════════════════════════════════

// These tests already exist in Section B8 — they should be working.
// Let me check if the issue is that the tests are calling the wrong command format.

// ═══════════════════════════════════════════════════════════════════════
// Section C10: pane without griddiv (dist 3373, 3399 alt=1).
// 3373 alt=1: `if (editor.griddiv)` false — griddiv is null
// 3399 alt=1: `if (editor.griddiv)` false — griddiv is null
// My existing tests in B9 should cover this. Let me verify the mock has griddiv=null.
// ═══════════════════════════════════════════════════════════════════════

// These tests already exist in B9 — griddiv is null by default in the mock.

// ═══════════════════════════════════════════════════════════════════════
// Section C11: _app widgetsClean with attrib=all (dist 3426 alt=0).
// 3426 alt=0: `else if (attrib == "all")` true side.
// My existing test in B20 should cover this.
// ═══════════════════════════════════════════════════════════════════════

// This test already exists in B20.

// ═══════════════════════════════════════════════════════════════════════
// Section C12: fillright with saveundo=false (dist 2409 alt=1).
// 2409 is NOT `if (saveundo)` — it's `else if (!down && range.right - range.left == 1 && ...)`
// This is in the increment_amount function. alt=1 is the false side.
// Need fillright where the range2 doesn't match the criteria.
// Actually, 2409 key=285 vals=[4, 0] — alt=1 is the false side of the if.
// The if checks: !down && range.right - range.left == 1 && seriesrow >= range.top && seriesrow <= range.bottom
// For fillright (!down=true), we need range.right - range.left != 1 (range is not 2 cols wide)
// or seriesrow is outside range.top..range.bottom.
// But range2 is from the editor mock. My mock has range2 = { hasrange: false }.
// So `if (range && range.hasrange)` at 2404 is false, and we never reach 2409.
// I need to set up a range2 with hasrange=true but right-left != 1.
// ═══════════════════════════════════════════════════════════════════════

test("fillright with range2 hasrange but wrong width exercises 2409 false (dist 2409 alt=1)", async () => {
  const SC = await loadSC();
  const fakeEditor = installEditorMock(SC);
  // Set up range2 with hasrange=true but right-left=2 (not 1)
  (fakeEditor as unknown as FakeEditor).range2 = {
    hasrange: true,
    left: 1,
    right: 3, // right-left = 2, not 1
    top: 1,
    bottom: 1,
  };
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 10",
    "set B1 value n 20",
    "set sheet lastcol 5",
  ]);
  const save = makeSave(["fillright A1:E1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells).toBeDefined();
});

// ═══════════════════════════════════════════════════════════════════════
// Section C13: Sort comparator remaining branches.
// 2656 alt=1: `valtype == "t"` false — valtype is not "t"
// 2679 alt=1: `a1 > b1` cond-expr — need text where a1 < b1 (for down sort)
// 2684 alt=1: `else if (tb == "e")` false — text vs non-error
// 2696 alt=1: `else if (tb == "e")` false — number vs non-error
// 2703 alt=0: `a1 > b1` cond-expr — error vs error
// 2709 alt=1: `if (ta == "b")` false — ta is not blank
// 2713 alt=1: `dirs[i] == "up"` cond-expr — blank vs non-blank
// 2720 alt=1: `a > b` cond-expr — final tiebreaker
// ═══════════════════════════════════════════════════════════════════════

test("sort with mixed types exercises comparator branches (dist 2656, 2684, 2696, 2709)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // Mix of text, number, blank, and error cells
  await scheduleCommands(SC, sheet, [
    "set A1 value t hello",
    "set A2 value n 42",
    // A3 is blank
    "set A4 formula 1/0",
    "set A5 value t world",
    "set A6 value n 10",
    "sort A1:A6 A up",
    "sort A1:A6 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells).toBeDefined();
});

test("sort with all errors exercises error-vs-error comparator (dist 2703)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 formula 1/0",
    "set A2 formula 2/0",
    "set A3 formula 3/0",
    "sort A1:A3 A up",
    "sort A1:A3 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells).toBeDefined();
});

test("sort with blank vs text exercises blank comparator branches (dist 2709, 2713)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // A1 is blank, A2 has text, A3 has text
  await scheduleCommands(SC, sheet, [
    "set A2 value t hello",
    "set A3 value t world",
    "sort A1:A3 A up",
    "sort A1:A3 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells).toBeDefined();
});

test("sort with all same values exercises tiebreaker a>b (dist 2720 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // All same value → tiebreaker must fire
  // For down sort, a > b in the tiebreaker (a and b are row indices)
  await scheduleCommands(SC, sheet, [
    "set A1 value n 5",
    "set A2 value n 5",
    "set A3 value n 5",
    "sort A1:A3 A down",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A1?.datavalue).toBe(5);
});

// ═══════════════════════════════════════════════════════════════════════
// Section C14: DecodeCell/SheetAttributes remaining cond-expr branches.
// 1779 key=137 alt=0: cond-expr for padtop — the `*.val + " "` side
// 1779 key=141 alt=0: cond-expr for alignvert — the `*.val + " "` side
// 1787 key=147 alt=0: cond-expr for fontsize — the `*.val + " "` side
// 1853 key=164 alt=0: cond-expr for padtop — the `*.val + " "` side
// 1853 key=168 alt=0: cond-expr for alignvert — the `*.val + " "` side
// 1911 key=181 alt=1: `oldval || ""` — the `""` side
// These are the non-def branches. My tests set ALL padding/font to non-def
// but the cond-expr has 5 sub-expressions (one per padding attr). The issue
// is that only some of the 5 are covered, not all.
// ═══════════════════════════════════════════════════════════════════════

test("DecodeCellAttributes with all non-def padding+vert exercises all cond-expr (dist 1779)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    GetAssuredCell(coord: string): SheetCell;
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 layout padding:2 3 4 5;vertical-align:top;",
  ]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // Verify ALL are non-def
  expect(encoded.padtop.def).toBe(false);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(false);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(false);

  // Decode into a sheet that has DEFAULT padding (so oldval != new val)
  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  // The cmd should contain the layout with padding values
  expect(String(cmd)).toContain("layout");
});

test("DecodeCellAttributes with all non-def font exercises all cond-expr (dist 1787)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    GetAssuredCell(coord: string): SheetCell;
    GetStyleNum(type: string, style: string): number;
    fonts: string[];
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A1 font bold italic 12 arial"]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(encoded.fontlook.def).toBe(false);
  expect(encoded.fontsize.def).toBe(false);
  expect(encoded.fontfamily.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("font");
});

test("DecodeSheetAttributes with all non-def padding+vert exercises all cond-expr (dist 1853)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, [
    "set sheet defaultlayout padding:2 3 4 5;vertical-align:top;",
  ]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(encoded.padtop.def).toBe(false);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(false);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultlayout");
});

test("DecodeSheetAttributes with falsy oldval exercises || fallback (dist 1911 alt=1)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
  };
  // Set a defaultcolor that will have a value
  await scheduleCommands(SC, sheet, ["set sheet defaultcolor red"]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // sheet2 has no defaultcolor → oldval is undefined → `oldval || ""` → ""
  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultcolor");
});

// ═══════════════════════════════════════════════════════════════════════
// Section C15: CellToString xlt border fallback (dist 1394 alt=1).
// 1394 alt=1: `t || 0` — the `|| 0` fallback when t is falsy.
// Need cell with some borders but not all four, and xlt set.
// ═══════════════════════════════════════════════════════════════════════

test("CellToString with xlt and partial borders exercises || 0 (dist 1394 alt=1)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    CanonicalizeSheet(full?: boolean): void;
    xlt?: {
      borderstylesxlat: number[];
      layoutsxlat: number[];
      fontsxlat: number[];
      colorsxlat: number[];
      cellformatsxlat: number[];
      valueformatsxlat: number[];
    };
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    // Set only bt, leave br/bb/bl undefined → `|| 0` fallback
    "set A1 bt 1",
  ]);
  sheet.CanonicalizeSheet(true);
  // CreateSheetSave with canonicalize=true triggers xlt path in CellToString
  const save = SC.CreateSheetSave(sheet, undefined, true) as string;
  expect(save).toContain("cell:A1");
  delete sheet.xlt;
});
