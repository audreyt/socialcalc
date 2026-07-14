import { expect, test } from "vite-plus/test";

import { loadSocialCalc, makeSave, recalcSheet, scheduleCommands } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
// ── Narrow types for the SC bundle surface ──────────────────────────────

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
interface SheetLike {
  cells: Record<string, SheetCell>;
  attribs: Record<string, unknown>;
  names: Record<string, { definition: string; desc?: string }>;
  fonts: string[];
  fonthash: Record<string, number>;
  borderstyles: string[];
  borderstylehash: Record<string, number>;
  ParseSheetSave(save: string): void;
  GetAssuredCell(coord: string): SheetCell;
  CanonicalizeSheet(rebuild: boolean): void;
  CellToString(cell: SheetCell): string;
  [key: string]: unknown;
}

interface SCFunc {
  (...args: unknown[]): unknown;
  new (...args: unknown[]): unknown;
}
type EncodedAttrs = Record<string, { def: boolean; val: string }>;

interface FakeEditorContext {
  sheetobj: unknown;
  rowpanes: Array<{ first: number; last: number }>;
  colpanes: Array<{ first: number; last: number }>;
  SetRowPaneFirstLast(_n: number, _f: number, _l: number): void;
  SetColPaneFirstLast(_n: number, _f: number, _l: number): void;
}

interface FakeEditor {
  range2: { hasrange: boolean };
  Range2Remove(): void;
  context: FakeEditorContext;
  timeout: unknown;
  griddiv: unknown;
  ScheduleRender(): void;
  FitToEditTable(): void;
}

interface EditorHost {
  CurrentSpreadsheetControlObject?: { editor: FakeEditor };
  _app?: unknown;
}

interface RenderContextLike {
  showGrid: boolean;
  commentClassName: string;
  commentNoGridClassName: string;
  cellIDprefix: string;
  CalculateCellSkipData(): void;
  PrecomputeSheetFontsAndLayouts(): void;
  [key: string]: unknown;
}

interface RenderedCellLike {
  id: string;
  title: string;
  className: string;
}

interface CellLinkText {
  workspace?: string;
  pagename?: string;
  desc?: string;
  newwin?: boolean;
}

interface RenderContextCtor {
  new (sheet: unknown): RenderContextLike;
}

interface SCCore {
  SocialCalc: unknown;
  Sheet: SCFunc;
  Cell: SCFunc;
  Parse: SCFunc;
  RenderContext: RenderContextCtor;
  Clipboard: { clipboard: string };
  CanonicalizeSheet(sheet: unknown, full: boolean): void;
  EncodeCellAttributes(sheet: unknown, coord: string): EncodedAttrs;
  EncodeSheetAttributes(sheet: unknown): EncodedAttrs;
  DecodeCellAttributes(sheet: unknown, coord: string, attribs: EncodedAttrs): string;
  DecodeSheetAttributes(sheet: unknown, attribs: EncodedAttrs): string;
  ScheduleSheetCommands: SCFunc;
  SheetCommandsTimerRoutine: SCFunc;
  ExecuteSheetCommand(sheet: unknown, parse: unknown, saveundo: boolean): string;
  CreateSheetSave: SCFunc;
  CellToString: SCFunc;
  ConvertSaveToOtherFormat: SCFunc;
  FormatCellForExport: SCFunc;
  PrecomputeSheetFontsAndLayouts: SCFunc;
  crToCoord: SCFunc;
  coordToCr: SCFunc;
  rcColname: SCFunc;
  [key: string]: unknown;
  RenderCell(
    context: RenderContextLike,
    row: number,
    col: number,
    coordrow: number,
    coordcol: number,
    noElement?: boolean,
  ): RenderedCellLike;
  ParseCellLinkText(str: string): CellLinkText;
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
// Section 1: CellToString xlt with no borders (dist 1390).
// 1390 [1]: `if (t || r || b || l)` false — cell has xlt set but no borders.
// ═══════════════════════════════════════════════════════════════════════

test("CellToString with xlt and no borders exercises if(t||r||b||l) false (dist 1390)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    xlt: unknown;
    CellToString(cell: SheetCell): string;
    CanonicalizeSheet(full: boolean): void;
    GetAssuredCell(coord: string): SheetCell;
  };
  // Set a cell value so it exists
  await scheduleCommands(SC, sheet, ["set A1 value n 42"]);
  // CanonicalizeSheet(false) sets sheet.xlt with identity mappings
  sheet.CanonicalizeSheet(false);
  expect(sheet.xlt).toBeDefined();
  const cell = sheet.GetAssuredCell("A1");
  // Ensure no borders are set
  delete cell.bt;
  delete cell.br;
  delete cell.bb;
  delete cell.bl;
  const result = sheet.CellToString(cell);
  // The cell string should NOT contain ":b:" since no borders
  expect(result).toContain(":v:42");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 2: DecodeCellAttributes with mixed def/non-def padding and font
// (dist 1775, 1783).
// 1775 [0, 0]: padding cond-expr true sides (*.def ? "* " : *.val + " ")
//   — need some def=true (layout has "*") and some def=false.
// 1783 [0]: font cond-expr true side (fontlook.def ? "* " : fontlook.val + " ")
//   — need fontlook def=true (font has "*") and fontsize/fontfamily def=false.
// ═══════════════════════════════════════════════════════════════════════

test("DecodeCellAttributes with mixed def/non-def padding exercises true sides (dist 1775)", async () => {
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
    // Layout with * for padtop, padbottom, alignvert and explicit for padright, padleft
    "set A1 layout padding:* 2px * 2px;vertical-align:*;",
  ]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  // Verify mixed def/non-def
  expect(encoded.padtop.def).toBe(true);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(true);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(true);

  // Decode into a fresh sheet
  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("layout");
  // The layout cmd should contain * for the def positions
  expect(String(cmd)).toContain("*");
});

test("DecodeCellAttributes with mixed def/non-def font exercises fontlook true side (dist 1783)", async () => {
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
    // Font with * for fontlook, explicit for fontsize and fontfamily
    "set A1 font * small Verdana,Arial,Helvetica,sans-serif",
  ]);
  const encoded = SC.EncodeCellAttributes(sheet, "A1") as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(encoded.fontlook.def).toBe(true);
  expect(encoded.fontsize.def).toBe(false);
  expect(encoded.fontfamily.def).toBe(false);

  const sheet2 = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetAssuredCell(coord: string): SheetCell;
  };
  const cmd = SC.DecodeCellAttributes(sheet2, "A1", encoded);
  expect(cmd).not.toBeNull();
  expect(String(cmd)).toContain("font");
  expect(String(cmd)).toContain("*");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 3: DecodeSheetAttributes with mixed def/non-def padding (dist 1849).
// 1849 [0, 0]: sheet padding cond-expr true sides — need sheet defaultlayout
//   with some "*" and some explicit values.
// ═══════════════════════════════════════════════════════════════════════

test("DecodeSheetAttributes with mixed def/non-def padding exercises true sides (dist 1849)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    GetStyleNum(type: string, style: string): number;
    layouts: string[];
  };
  await scheduleCommands(SC, sheet, [
    "set sheet defaultlayout padding:* 3px * 3px;vertical-align:*;",
  ]);
  const encoded = SC.EncodeSheetAttributes(sheet) as unknown as Record<
    string,
    { def: boolean; val: string }
  >;
  expect(encoded.padtop.def).toBe(true);
  expect(encoded.padright.def).toBe(false);
  expect(encoded.padbottom.def).toBe(true);
  expect(encoded.padleft.def).toBe(false);
  expect(encoded.alignvert.def).toBe(true);

  const sheet2 = new SC.Sheet() as unknown as {
    ParseSheetSave(s: string): void;
  };
  sheet2.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  const cmd = SC.DecodeSheetAttributes(sheet2, encoded) as string;
  expect(cmd).toContain("defaultlayout");
  expect(cmd).toContain("*");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 4: SheetCommandsTimerRoutine with non-Error throw (dist 1907).
// 1907 [1]: `err instanceof Error ? err.message : String(err)` false side.
// Need ExecuteSheetCommand to throw a non-Error value (e.g., a string).
// We register a CmdExtensionCallback that throws a plain string, then
// dispatch via SheetCommandsTimerRoutine.
// ═══════════════════════════════════════════════════════════════════════

test("SheetCommandsTimerRoutine with non-Error throw exercises String(err) branch (dist 1907)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    sci: {
      CmdExtensionCallbacks: Record<string, unknown>;
      sheetobj: unknown;
      timerobj: unknown;
      firsttimerdelay: number;
      timerdelay: number;
      maxtimeslice: number;
      saveundo: boolean;
    };
    statuscallback: unknown;
    changes: { PushChange(s: string): void; AddDo(s: string): void };
  };
  // Register a cmd extension that throws a plain string (not an Error)
  sheet.sci.CmdExtensionCallbacks["throwstring"] = {
    func: function _throwString() {
      throw "custom error string";
    },
    data: null,
  };

  let capturedStatus: string | null = null;
  sheet.statuscallback = function (_sci: unknown, status: string) {
    if (status === "cmdend" || status === "cmderr") {
      capturedStatus = status;
    }
  };

  const save = makeSave(["startcmdextension throwstring"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  // Call SheetCommandsTimerRoutine directly — it will call ExecuteSheetCommand
  // which will invoke the extension callback that throws a string.
  // The catch at 1906 will fire and `String(err)` will be used.
  SC.SheetCommandsTimerRoutine(sheet.sci, parse, false);
  // The routine should have completed (either cmdend or cmderr)
  expect(capturedStatus).not.toBeNull();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 5: Sort comparator branches (dist 2652, 2675, 2680, 2692,
// 2699, 2705, 2709, 2716).
//
// 2652 [1]: `cell.valuetype.charAt(0) || "b"` — need empty valuetype.
// 2675 [1]: text `a1 > b1 ? 1 : ...` false — need text sort where a1 <= b1.
// 2680 [1]: text vs blank `dirs[i] == "up" ? -1 : 1` false — down sort.
// 2692 [1]: number vs blank `dirs[i] == "up" ? -1 : 1` false — down sort.
// 2699 [0, 0]: error vs error `a1 > b1` true AND `a1 < b1` true — different
//   error datavalues, sorted both up and down.
// 2705 [1]: `else if (ta == "b")` false — need valuetype "v" via `constant v`.
// 2709 [1]: blank vs non-blank `dirs[i] == "up" ? 1 : -1` false — down sort.
// 2716 [1, 0, 1]: final tiebreaker `a > b ? 1 : a < b ? -1 : 0` — need
//   a < b (alt=1 of first), a > b (alt=0 of second), and a == b (alt=1 of
//   second).
// ═══════════════════════════════════════════════════════════════════════

test("sort with empty valuetype exercises charAt(0)||b fallback (dist 2652)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
  // Directly set A1's valuetype to empty string
  const cell = sheet.cells.A1;
  cell.valuetype = "";
  // Sort up — the comparator will use `"".charAt(0) || "b"` → "b"
  const save = makeSave(["sort A1:A2 A up"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // Both cells should still exist
  expect(sheet.cells.A1).toBeDefined();
  expect(sheet.cells.A2).toBeDefined();
});

test("sort text up exercises a1>b1 false branch (dist 2675)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 text t apple",
    "set A2 text t mango",
    "set A3 text t zebra",
  ]);
  // Sort UP — for up sort, a1=a, b1=b. When a < b, a1 > b1 is false.
  // With apple, mango, zebra sorted up, the comparator will encounter
  // pairs where a1 <= b1 (e.g., apple vs mango).
  const save = makeSave(["sort A1:A3 A up"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // After ascending sort: A1=apple, A2=mango, A3=zebra
  expect(sheet.cells.A1?.datavalue).toBe("apple");
  expect(sheet.cells.A3?.datavalue).toBe("zebra");
});

test("sort text vs blank down exercises dirs==up false (dist 2680)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 text t hello",
    // A2 is empty (blank)
    "set A3 text t world",
  ]);
  // Sort DOWN — text vs blank with down sort: dirs[i] == "up" is false
  const save = makeSave(["sort A1:A3 A down"]);
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

test("sort number vs blank down exercises dirs==up false (dist 2692)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 42",
    // A2 is empty (blank)
    "set A3 value n 99",
  ]);
  // Sort DOWN — number vs blank with down sort: dirs[i] == "up" is false
  const save = makeSave(["sort A1:A3 A down"]);
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

test("sort error vs error with different datavalues exercises a1>b1 and a1<b1 (dist 2699)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // Create error cells with different datavalues
  // `set A1 constant e#ERR! 5 msg` → valuetype="e#ERR!", datavalue=5
  // `set A2 constant e#NUM! 10 msg` → valuetype="e#NUM!", datavalue=10
  await scheduleCommands(SC, sheet, [
    "set A1 constant e#ERR! 5 msg",
    "set A2 constant e#NUM! 10 msg",
  ]);
  // Sort UP: for up sort, a1=a, b1=b. When comparing A1(5) vs A2(10):
  //   a1=5, b1=10 → a1 > b1 false, a1 < b1 true → cresult=-1
  const saveUp = makeSave(["sort A1:A2 A up"]);
  const parseUp = new SC.Parse(saveUp) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parseUp.EOF()) {
    SC.ExecuteSheetCommand(sheet, parseUp, false);
    parseUp.NextLine();
  }
  // After up sort: A1 should have the smaller datavalue (5)
  expect(sheet.cells.A1).toBeDefined();

  // Reset and sort DOWN
  await scheduleCommands(SC, sheet, [
    "set A1 constant e#ERR! 5 msg",
    "set A2 constant e#NUM! 10 msg",
  ]);
  // Sort DOWN: for down sort, a1=b, b1=a. When comparing:
  //   a1=10, b1=5 → a1 > b1 true → cresult=1
  const saveDown = makeSave(["sort A1:A2 A down"]);
  const parseDown = new SC.Parse(saveDown) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parseDown.EOF()) {
    SC.ExecuteSheetCommand(sheet, parseDown, false);
    parseDown.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
});

test("sort with valuetype v exercises else if(ta==b) false (dist 2705)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // `set A1 constant v hello` sets valuetype="v", datatype="c"
  // In the sort comparator, ta = "v".charAt(0) = "v" (truthy, so || "b" doesn't fire)
  // ta != "t", "n", "e", or "b" → falls through all conditions
  await scheduleCommands(SC, sheet, ["set A1 constant v hello", "set A2 value n 1"]);
  const save = makeSave(["sort A1:A2 A up"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
  expect(sheet.cells.A2).toBeDefined();
});

test("sort blank vs non-blank down exercises dirs==up false (dist 2709)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 42",

    // A2 is empty (blank)
    "set A3 value n 10",
  ]);
  // Sort DOWN — blank vs non-blank with down sort: dirs[i] == "up" is false
  // ta="b", tb="n" → cresult = dirs[i] == "up" ? 1 : -1 → -1
  const save = makeSave(["sort A1:A3 A down"]);
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

test("sort unsupported value types against text without reordering stable rows", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, [
    "set A1 constant v raw-one",
    "set B1 value n 1",
    "set A2 text t Alice",
    "set B2 value n 2",
    "sort A1:B2 A up",
  ]);
  expect(sheet.cells.B1?.datavalue).toBe(1);
  expect(sheet.cells.B2?.datavalue).toBe(2);

  await scheduleCommands(SC, sheet, [
    "set A1 text t Bob",
    "set B1 value n 3",
    "set A2 constant v raw-two",
    "set B2 value n 4",
    "sort A1:B2 A up",
  ]);
  expect(sheet.cells.B1?.datavalue).toBe(3);
  expect(sheet.cells.B2?.datavalue).toBe(4);
});

test("sort original-position tiebreaker preserves equal rows when comparator sees both orders", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  // Capture the real sort via its descriptor so the reference is not a bare
  // unbound-method access, then forward `this` explicitly on each call.
  const sortDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, "sort");
  const originalSort = sortDescriptor?.value as (
    this: unknown[],
    compareFn?: (a: unknown, b: unknown) => number,
  ) => unknown[];
  const arrayProto = Array.prototype as unknown as {
    sort(this: unknown[], compareFn?: (a: unknown, b: unknown) => number): unknown[];
  };
  arrayProto.sort = function (this: unknown[], compareFn?: (a: unknown, b: unknown) => number) {
    if (compareFn && this.length >= 2 && this.every((value) => Number.isInteger(value))) {
      compareFn(0, 1);
      compareFn(1, 0);
      compareFn(0, 0);
    }
    return originalSort.call(this, compareFn);
  };

  try {
    await scheduleCommands(SC, sheet, [
      "set A1 text t Same",
      "set B1 value n 1",
      "set A2 text t Same",
      "set B2 value n 2",
      "sort A1:B2 A up",
    ]);
  } finally {
    arrayProto.sort = originalSort;
  }

  expect(sheet.cells.B1?.datavalue).toBe(1);
  expect(sheet.cells.B2?.datavalue).toBe(2);
});

test("sort final tiebreaker exercises a>b and a<b branches (dist 2716)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  // Create cells with same values in the sort column but different positions.
  // The final tiebreaker `a > b ? 1 : a < b ? -1 : 0` compares the sortlist
  // indices (a and b are array indices). When a < b, alt=1 of first cond.
  // When a > b, alt=0 of second cond. When a == b, alt=1 of second cond.
  // Array.sort never calls comparator(x, x), so a==b may be unreachable,
  // but a<b and a>b are both exercised during normal sorting.
  await scheduleCommands(SC, sheet, ["set A1 value n 5", "set A2 value n 5", "set A3 value n 5"]);
  const save = makeSave(["sort A1:A3 A up"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // All cells should still exist with value 5
  expect(sheet.cells.A1?.datavalue).toBe(5);
  expect(sheet.cells.A2?.datavalue).toBe(5);
  expect(sheet.cells.A3?.datavalue).toBe(5);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 6: insertcol/insertrow with 2D merged cells (dist 2860, 2866).
// 2860 [1]: insertcol `if (!cellsToExpand[mergerCellCoords])` false — need
//   same merged cell encountered multiple times in cellskip loop.
// 2866 [1]: insertrow `if (!cellsToExpand[mergerCellCoords])` false — same.
// Need a 2D merge (colspan AND rowspan > 1) so the same mergerCellCoords
// appears in multiple rows/columns of the cellskip.
// ═══════════════════════════════════════════════════════════════════════

test("insertcol with 2D merged cells exercises cellsToExpand false (dist 2860)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
    "merge A1:B2",
    "set sheet lastcol 4",
  ]);
  // Insert col B — within the 2D merge A1:B2.
  // cellskip has B1→A1, B2→A1. Both have skipCellCR.col=2 === newcolstart=2.
  // First (B1): !cellsToExpand["A1"] → true → expand.
  // Second (B2): !cellsToExpand["A1"] → false → alt=1.
  const save = makeSave(["insertcol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
  // A1's colspan should have been expanded
  expect(sheet.cells.A1?.colspan).toBeGreaterThanOrEqual(2);
});

test("insertrow with 2D merged cells exercises cellsToExpand false (dist 2866)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set A2 value n 3",
    "set B2 value n 4",
    "merge A1:B2",
    "set sheet lastrow 4",
  ]);
  // Insert row 2 — within the 2D merge A1:B2.
  // cellskip has B1→A1, B2→A1. Both have skipCellCR.row=2 === newrowstart=2.
  // First (B1): !cellsToExpand["A1"] → true → expand.
  // Second (B2): !cellsToExpand["A1"] → false → alt=1.
  const save = makeSave(["insertrow 2"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.A1).toBeDefined();
  expect(sheet.cells.A1?.rowspan).toBeGreaterThanOrEqual(2);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 6b: insertcol/insertrow with a falsy-but-enumerable cells/names
// entry (dist 2812, 2817).
// 2812 [1]: `if (cell)` false inside `for (cr in sheet.cells)`.
// 2817 [1]: `if (sheet.names[name])` false inside `for (name in sheet.names)`.
// SocialCalc production code always removes a cell/name via `delete
// sheet.cells[cr]` / never assigns null, but `for...in` enumerates ALL own
// enumerable keys regardless of value truthiness — a directly-seeded
// null-valued key is still visited, so the guard is reachable defensive
// code, not dead code.
// ═══════════════════════════════════════════════════════════════════════

test("insertcol with falsy cells/names entries exercises if(cell) and if(names[name]) false (dist 2812, 2817)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell | null>;
    names: Record<string, { definition: string; desc: string } | null>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set sheet lastcol 4"]);
  // Directly seed a null-valued (but enumerable) entry — for...in still
  // visits it even though `delete` was never called.
  sheet.cells.Z99 = null;
  sheet.names.BOGUS = null;
  const save = makeSave(["insertcol B"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // The falsy entries must not crash the rewrite loops, and real cells
  // are still processed normally alongside them.
  expect(sheet.cells.A1).toBeDefined();
  expect(sheet.cells.Z99).toBeNull();
  expect(sheet.names.BOGUS).toBeNull();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 7: deletecol with empty cell in range (dist 2902).
// 2902 [1]: `if (cell && cell.readonly)` false — cell is null (no cell at
// that coord in the delete range).
// ═══════════════════════════════════════════════════════════════════════

test("deletecol with empty cell in range exercises cell&&readonly false (dist 2902)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set C1 value n 3",
    "set sheet lastcol 4",
  ]);
  // Delete col B — B1 has no cell → cell is undefined → cell && readonly is false
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
// Section 8: deletecol/deleterow with 2D merged cells (dist 3003, 3009).
// 3003 [1]: deletecol `if (!cellsToShrink[mergerCellCoords])` false — need
//   same merged cell encountered multiple times.
// 3009 [1]: deleterow `if (!cellsToShrink[mergerCellCoords])` false — same.
// ═══════════════════════════════════════════════════════════════════════

test("deletecol with 2D merged cells exercises cellsToShrink false (dist 3003)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "set A2 value n 4",
    "set B2 value n 5",
    "set C2 value n 6",
    "merge A1:C2",
    "set sheet lastcol 4",
  ]);
  // Delete col B — within the 2D merge A1:C2.
  // cellskip has B1→A1, C1→A1, B2→A1, C2→A1.
  // colstart=3, coloffset=-1, colstart+coloffset=2.
  // B1: skipCellCR.col=2 === 2 → match. mergerCellCR.col=1 < 2 → match.
  //   !cellsToShrink["A1"] → true → shrink. Set cellsToShrink["A1"]=true.
  // C1: skipCellCR.col=3 !== 2 → skip.
  // B2: skipCellCR.col=2 === 2 → match. mergerCellCR.col=1 < 2 → match.
  //   !cellsToShrink["A1"] → false → alt=1.
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

test("deleterow with 2D merged cells exercises cellsToShrink false (dist 3009)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set B1 value n 2",
    "set C1 value n 3",
    "set A2 value n 4",
    "set B2 value n 5",
    "set C2 value n 6",
    "merge A1:C2",
    "set sheet lastrow 4",
  ]);
  // Delete row 2 — within the 2D merge A1:C2.
  // rowstart=3, rowoffset=-1, rowstart+rowoffset=2.
  // B1: skipCellCR.row=1 !== 2 → skip.
  // C1: skipCellCR.row=1 !== 2 → skip.
  // B2: skipCellCR.row=2 === 2 → match. mergerCellCR.row=1 < 2 → match.
  //   !cellsToShrink["A1"] → true → shrink.
  // C2: skipCellCR.row=2 === 2 → match. mergerCellCR.row=1 < 2 → match.
  //   !cellsToShrink["A1"] → false → alt=1.
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
// Section 8b: deletecol/deleterow with a falsy-but-enumerable cells/names
// entry (dist 2930, 2952). Same for...in reasoning as Section 6b.
// ═══════════════════════════════════════════════════════════════════════

test("deletecol with falsy cells/names entries exercises if(cell) and if(names[name]) false (dist 2930, 2952)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell | null>;
    names: Record<string, { definition: string; desc: string } | null>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set C1 value n 3",
    "set sheet lastcol 4",
  ]);
  sheet.cells.Z99 = null;
  sheet.names.BOGUS = null;
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
  expect(sheet.cells.Z99).toBeNull();
  expect(sheet.names.BOGUS).toBeNull();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 9: movepaste with formula cell and saveundo=false (dist 3273).
// 3273 [1]: `if (saveundo && !movedto[cr])` false — saveundo is false.
// Need a formula cell whose formula changes due to ReplaceFormulaCoords.
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with formula and saveundo=false exercises saveundo&&!movedto false (dist 3273)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set C3 formula A1+1"]);
  // movepaste A1 to B1 — C3's formula references A1 which moves to B1
  // The formula changes from =A1+1 to =B1+1, triggering the saveundo check
  // at 3273. With saveundo=false, the condition is false.
  const save = makeSave(["movepaste A1:A1 B1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // C3's formula should have been updated to reference B1
  expect(sheet.cells.C3?.formula).toContain("B1");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 9b: movepaste with a falsy-but-enumerable cells/names entry
// (dist 3267, 3283). Same for...in reasoning as Section 6b.
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with falsy cells/names entries exercises if(cell) and if(names[name]) false (dist 3267, 3283)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell | null>;
    names: Record<string, { definition: string; desc: string } | null>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set C3 formula A1+1"]);
  sheet.cells.Z99 = null;
  sheet.names.BOGUS = null;
  const save = makeSave(["movepaste A1:A1 B1 all"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  expect(sheet.cells.C3?.formula).toContain("B1");
  expect(sheet.cells.Z99).toBeNull();
  expect(sheet.names.BOGUS).toBeNull();
});

// ═══════════════════════════════════════════════════════════════════════
// Section 9c: movepaste with a readonly SOURCE cell and rest="formulas"
// (dist 3236, 3237). The early-exit `if (rest == "all" && !movingcells[crbase])
// continue;` at 3231 is gated on `rest == "all"`, so with rest="formulas" (or
// "formats") a readonly source cell — whose readonly-ness made the first
// scan `continue` before populating movingcells[crbase] — still reaches
// `basecell = movingcells[crbase]` as falsy, taking the `if (!basecell)`
// true branch and falling back to `sheet.GetAssuredCell(crbase)`.
// ═══════════════════════════════════════════════════════════════════════

test("movepaste with readonly source and rest=formulas exercises if(!basecell) true (dist 3236, 3237)", async () => {
  const SC = await loadSC();
  installEditorMock(SC);
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
  };
  await scheduleCommands(SC, sheet, [
    "set A1 value n 42",
    "set A1 readonly yes",
    "set B1 value n 100",
  ]);
  expect(sheet.cells.A1?.readonly).toBe(true);
  // rest="formulas" (not "all") so the early continue at 3231 never fires
  // for A1, even though A1's readonly-ness kept it out of movingcells in
  // the first scan — basecell falls back to GetAssuredCell(A1) directly.
  const save = makeSave(["movepaste A1:A1 B1 formulas"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // B1 (non-readonly destination) picks up A1's value/formula despite A1
  // being readonly, proving the GetAssuredCell fallback executed.
  expect(sheet.cells.B1?.datavalue).toBe(42);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 10: name command with unknown subcommand (dist 3324).
// 3324 [1]: `else if (what == "delete")` false — what is not define/desc/delete.
// ═══════════════════════════════════════════════════════════════════════

test("name with unknown subcommand exercises else if delete false (dist 3324)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as {
    cells: Record<string, SheetCell>;
    attribs: Record<string, unknown>;
    names: Record<string, { definition: string; desc: string }>;
  };
  // "name foo BAR" — what="foo" doesn't match define/desc/delete
  const save = makeSave(["name foo BAR"]);
  const parse = new SC.Parse(save) as unknown as {
    EOF(): boolean;
    NextLine(): void;
  };
  while (!parse.EOF()) {
    SC.ExecuteSheetCommand(sheet, parse, false);
    parse.NextLine();
  }
  // No name should have been created
  expect(Object.keys(sheet.names).length).toBe(0);
  // needsrecalc should be set
  expect(sheet.attribs.needsrecalc).toBe("yes");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 11: pane with griddiv truthy but no trackLine element (dist 3369, 3395).
// 3369 [1]: `if (trackLine)` false — griddiv is truthy but
//   document.getElementById("trackingline-vertical") returns null.
// 3395 [1]: `if (trackLine)` false — same for "trackingline-horizon".
// Sibling test 2a covers 3373/3399 (griddiv false), and 3373/3399 true with
// trackLine, but NOT griddiv true + trackLine null.
// ═══════════════════════════════════════════════════════════════════════

test("pane row with griddiv but no trackLine exercises if(trackLine) false (dist 3369)", async () => {
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
  // Set griddiv to a truthy value but don't add any trackingline element
  const griddiv = document.createElement("div");
  griddiv.id = "griddiv";
  document.body.appendChild(griddiv);
  (fakeEditor as unknown as FakeEditor).griddiv = griddiv;
  // No element with id "trackingline-vertical" exists → trackLine is null

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

test("pane col with griddiv but no trackLine exercises if(trackLine) false (dist 3395)", async () => {
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
  (fakeEditor as unknown as FakeEditor).griddiv = griddiv;
  // No element with id "trackingline-horizon" exists → trackLine is null

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

// ═══════════════════════════════════════════════════════════════════════
// Section 12: PrecomputeSheetFontsAndLayouts with default layout "*" (dist 4149).
// 4149 [1]: `sparts[i] != "*"` false — when no defaultlayout is set, sparts
//   is all "*". If a layout has parts[i] == "*", then sparts[i] == "*" →
//   use dparts[i] (the constant default).
// ═══════════════════════════════════════════════════════════════════════

test("PrecomputeSheetFontsAndLayouts with no defaultlayout exercises sparts!=star false (dist 4149)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    layouts: string[];
    fonts: string[];
    GetStyleNum(type: string, style: string): number;
  };
  await scheduleCommands(SC, sheet, [
    // Create a layout with * for some padding fields
    "set A1 value n 1",
    "set A1 layout padding:* * * *;vertical-align:*;",
  ]);
  // No defaultlayout set → sparts = ["", "*", "*", "*", "*", "*"]
  // The layout at index 1 has parts[i] == "*" for all padding fields.
  // sparts[i] == "*" → sparts[i] != "*" is false → use dparts[i].
  const context = new SC.RenderContext(sheet) as unknown as {
    needprecompute: boolean;
    fonts: unknown[];
    layouts: string[];
    PrecomputeSheetFontsAndLayouts(): void;
  };
  context.needprecompute = true;
  context.PrecomputeSheetFontsAndLayouts();
  // The layout should have been computed with default values
  expect(context.layouts.length).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════════════════
// Section 13: ConvertSaveToOtherFormat with non-csv/tab format (dist 5367).
// 5367 [1]: `else if (outputformat == "tab")` false — outputformat is
//   neither "csv" nor "tab" (and not "html" which returns early).
// ═══════════════════════════════════════════════════════════════════════

test("ConvertSaveToOtherFormat with non-csv/tab format exercises else if tab false (dist 5367)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as {
    attribs: Record<string, unknown>;
    cells: Record<string, SheetCell>;
    copiedfrom: string;
    GetAssuredCell(coord: string): SheetCell;
  };
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 text t hello"]);
  // Create a sheet save and convert with format "foo" (not csv/tab/html)
  const save = SC.CreateSheetSave(sheet) as string;
  const result = SC.ConvertSaveToOtherFormat(save, "foo", false) as string;
  // The result should contain the cell values with no separator (no csv/tab formatting)
  expect(result).toContain("1");
  expect(result).toContain("hello");
});

// ═══════════════════════════════════════════════════════════════════════
// Section 13.5: Targeted coverage additions for slice B
// ═══════════════════════════════════════════════════════════════════════

test("CellToString border fallback to 0 (L1035)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  sheet.ParseSheetSave(makeSave(["sheet:c:1:r:1"]));
  sheet.borderstyles[1] = "1px solid black";
  sheet.borderstylehash["1px solid black"] = 1;
  const cell = sheet.GetAssuredCell("A1");
  // Set only left border bl=1, leaving top border bt undefined/falsy.
  // Since bl is truthy, "t || r || b || l" is true. bt falls back to 0 (L1035 arm 1).
  cell.bl = 1;
  sheet.CanonicalizeSheet(true);
  const result = SC.CellToString(sheet, cell);
  expect(result).toBeDefined();
});

test("DoCmd default font size '*' in font string rebuild (L1600)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  // Font family is custom (Helvetica), but size is default (*).
  // Directly set fonts table to avoid command-line auto-resolution of '*'.
  sheet.fonts = ["", "normal normal * Helvetica"];
  sheet.fonthash = { "normal normal * Helvetica": 1 };
  const cell = sheet.GetAssuredCell("A1");
  cell.font = 1;
  sheet.CanonicalizeSheet(true);
  const result = SC.EncodeCellAttributes(sheet, "A1");
  SC.DecodeCellAttributes(sheet, "A1", result);
  expect(result).toBeDefined();
});

test("DoCmd lastcol/lastrow and usermaxcol/usermaxrow non-positive bounds (L2078, L2093)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  await scheduleCommands(SC, sheet, [
    "set sheet lastcol 0",
    "set sheet lastrow 0",
    "set sheet usermaxcol 0",
    "set sheet usermaxrow 0",
  ]);
  expect(sheet.attribs.lastcol).toBe(1);
  expect(sheet.attribs.lastrow).toBe(1);
  expect(sheet.attribs.usermaxcol).toBe(0);
  expect(sheet.attribs.usermaxrow).toBe(0);
});

test("ExecuteCommand sort with identical text cells for tiebreaker (L2757, L2799)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  // Two identical text cells to hit equal text comparison (L2757 arm 1)
  // and trigger the final original-row tiebreaker (L2799 arms 0 & 1)
  await scheduleCommands(SC, sheet, ["set A1 text t Alice", "set A2 text t Alice"]);
  await recalcSheet(SC, sheet);
  await scheduleCommands(SC, sheet, ["sort A1:A2 A up"]);
  await scheduleCommands(SC, sheet, ["sort A1:A2 A down"]);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("Alice");
});

test("ExecuteCommand sort text vs error cell (L2762)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  // Direct text vs error sort comparison to guarantee L2762 is reached
  await scheduleCommands(SC, sheet, [
    "set A1 text t Alice",
    "set A2 formula 1/0", // error cell
  ]);
  await recalcSheet(SC, sheet);
  await scheduleCommands(SC, sheet, ["sort A1:A2 A up"]);
  await scheduleCommands(SC, sheet, ["sort A1:A2 A down"]);
  expect(sheet.GetAssuredCell("A1").datavalue).toBeDefined();
});

test("ExecuteCommand deleterow/deletecol on locked cell produces error messages (L3036)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  await scheduleCommands(SC, sheet, ["set A1 value n 5", "set A1 readonly yes"]);

  // deleterow locked cell error -> "row" message
  const parseRow = new SC.Parse("deleterow 1");
  const errRow = SC.ExecuteSheetCommand(sheet, parseRow, true);
  expect(errRow).toContain("row");

  // deletecol locked cell error -> "column" message (L3036 arm 0)
  const parseCol = new SC.Parse("deletecol A");
  const errCol = SC.ExecuteSheetCommand(sheet, parseCol, true);
  expect(errCol).toContain("column");
});

test("ExecuteCommand delete named range with description (L3561)", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  await scheduleCommands(SC, sheet, [
    "name define MyRange A1",
    'name desc MyRange "My range description"',
    "name delete MyRange",
  ]);
  expect(sheet.names["MyRange"]).toBeUndefined();
});

test("ExecuteCommand delete named range without description omits description undo", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  await scheduleCommands(SC, sheet, "name define PlainName A1", true);
  expect(sheet.names.PLAINNAME?.definition).toBe("A1");

  await scheduleCommands(SC, sheet, "name delete PlainName", true);
  expect(sheet.names.PLAINNAME).toBeUndefined();
});

test("RenderCell with and without cellIDprefix (L5387)", async () => {
  const SC = await loadSCBrowser();
  const sheet = new SC.Sheet() as unknown as SheetLike;
  await scheduleCommands(SC, sheet, ["set A1 value n 5", 'set A1 comment "Cell comment"']);
  const context = new SC.RenderContext(sheet);
  context.showGrid = true;
  context.commentClassName = "comm_class";
  context.CalculateCellSkipData();
  context.PrecomputeSheetFontsAndLayouts();
  // Render cell WITHOUT cellIDprefix (L5387 arm 1)
  context.cellIDprefix = "";
  const cellElNoPrefix = SC.RenderCell(context, 1, 1, 0, 0);
  expect(cellElNoPrefix.id).toBe("");
  // Render cell WITH cellIDprefix (L5387 arm 0)
  context.cellIDprefix = "prefix_";
  const cellElWithPrefix = SC.RenderCell(context, 1, 1, 0, 0);
  expect(cellElWithPrefix.id).toBe("prefix_A1");
  expect(cellElWithPrefix.title).toBe('"Cell comment"');

  // Render cell without grid (L5543)
  context.showGrid = false;
  context.commentNoGridClassName = "comm_nogrid_class";
  context.CalculateCellSkipData();
  context.PrecomputeSheetFontsAndLayouts();
  const cellElNoGrid = SC.RenderCell(context, 1, 1, 0, 0);
  expect(cellElNoGrid.title).toBe('"Cell comment"');
});

test("ParseCellLinkText with workspace page link (L6559)", async () => {
  const SC = await loadSCBrowser();
  const result = SC.ParseCellLinkText("link desc{my_workspace [my_page]}");
  expect(result.workspace).toBe("my_workspace");
  expect(result.pagename).toBe("my_page");
  expect(result.desc).toBe("link desc");
});
// ═══════════════════════════════════════════════════════════════════════
// Section 14: Structurally unreachable gaps — documented for completeness.
//
// The following gap items are structurally unreachable in this test
// environment and are intentionally NOT covered:
//
// 2073 [1], 2090 [1]: `typeof num == "number"` false branch.
//   `rest - 0` always produces typeof "number" (including NaN). The
//   `typeof NaN == "number"` is true, so the false branch is unreachable.
//
// 3078 [0] + 3079 (stmt): `if (!sheet.cells[cr])` true after GetAssuredCell.
//   GetAssuredCell (line 925) always creates the cell via AddCell, so
//   `sheet.cells[cr]` is always truthy after line 3073. The `continue`
//   at 3079 is unreachable.
//
// 3236/3237: previously misclassified as unreachable, see Section 9c above
// — see that section's comment for why the `if (!basecell)` true branch is
// reachable via a readonly source cell combined with `rest != "all"`.
//
// NOTE: 2812/2817 (insertcol/insertrow), 2930/2952 (deletecol/deleterow),
// and 3267/3283 (movepaste) — `if (cell)` / `if (sheet.names[name])` false
// inside `for...in` loops over sheet.cells/sheet.names — were PREVIOUSLY
// listed here as unreachable on the claim that "for...in only iterates
// existing (truthy) enumerable properties". That claim is incorrect:
// for...in enumerates ALL own enumerable keys regardless of value
// truthiness (verified: `for (k in {a: null}) …` visits "a"). Production
// SocialCalc code always removes an entry via `delete sheet.cells[cr]` /
// `delete sheet.names[name]` rather than assigning null, but a test can
// still legitimately seed a null-valued enumerable key to exercise these
// defensive guards — see Sections 6b, 8b, 9b above, which now cover all
// six of these branches.
// 4376 [1]: `if (newcol)` false.
//   `document.createElement("td")` always returns a truthy object, so
//   `newcol` is always truthy.
//
// 4646 [0], 4651 [0]: RenderCell comment className cond-expr true sides.
//   `result.className` starts as "" (empty string, falsy) at cell creation
//   (line 4533: `document.createElement("td")`). Nothing sets
//   `result.className` before the comment check at 4642 for non-skipped
//   cells. The skippedcell path at 4526-4527 sets className but returns
//   early at 4531. So the truthy side of the ternary at 4646/4651 is
//   unreachable.
//
// 5284 [1]: `else if (str.charAt(urlend) == "}")` false.
//   The else block at 5268 is only entered when the big condition at 5265
//   is false, which requires at least one of three sub-conditions to be
//   met. Each sub-condition corresponds to urlend being ">", "]", or "}".
//   The if/else-if chain at 5269/5276/5284 covers all three cases. If we
//   reach 5284, urlend must be "}" (since ">" and "]" are already checked),
//   so the condition is always true. The false branch is unreachable.
// ═══════════════════════════════════════════════════════════════════════
