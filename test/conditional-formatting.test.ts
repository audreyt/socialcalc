import { expect, test } from "vite-plus/test";
import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

async function setup(commands: string[] = []) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands);
  await recalcSheet(SC, sheet);
  return { SC, sheet };
}

// condfmt add <id> <range>\t<type>\t<op>\t<value1>\t<value2>\t<formula>\t<stopIfTrue>\t<font>\t<color>\t<bgcolor>\t<bt>\t<br>\t<bb>\t<bl>
function addRuleCommand(
  id: number,
  range: string,
  type: string,
  opts: Partial<{
    op: string;
    value1: string;
    value2: string;
    formula: string;
    stopIfTrue: boolean;
    color: number;
    bgcolor: number;
    font: number;
    bt: number;
    br: number;
    bb: number;
    bl: number;
  }> = {},
) {
  const fields = [
    range,
    type,
    opts.op ?? "",
    opts.value1 ?? "",
    opts.value2 ?? "",
    opts.formula ?? "",
    opts.stopIfTrue ? "1" : "0",
    String(opts.font ?? 0),
    String(opts.color ?? 0),
    String(opts.bgcolor ?? 0),
    String(opts.bt ?? 0),
    String(opts.br ?? 0),
    String(opts.bb ?? 0),
    String(opts.bl ?? 0),
  ];
  return `condfmt add ${id} ${fields.join("\t")}`;
}

async function definePaletteColor(SC: any, sheet: any, rgb: string): Promise<number> {
  return sheet.GetStyleNum("color", rgb);
}

test("cellis comparisons: gt, ge, lt, le, eq, ne, between all match correctly", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5", "set A2 value n 5", "set A3 value n 3"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A3", "cellis", { op: "gt", value1: "4", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toEqual(expect.objectContaining({ color: red }));
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 1",
    addRuleCommand(2, "A1:A3", "cellis", { op: "between", value1: "3", value2: "4", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 2",
    addRuleCommand(3, "A1:A3", "cellis", { op: "ne", value1: "5", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("cellis lt/le operators and an unrecognized op deny by default", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "lt", value1: "6", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 1",
    addRuleCommand(2, "A1:A1", "cellis", { op: "le", value1: "5", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();

  // An unrecognized comparator string denies by default (never silently
  // matches), same fail-closed policy as lemma/condfmt.ts's matchesCellIs.
  await scheduleCommands(SC, sheet, [
    "condfmt delete 2",
    "condfmt add 3 A1:A1\tcellis\tbogus\t5\t\t\t0\t0\t" + red + "\t0\t0\t0\t0\t0",
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("text contains/begins/ends match substrings correctly", async () => {
  const { SC, sheet } = await setup(["set A1 text t hello world", "set A2 text t goodbye"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A2", "textcontains", { value1: "world", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 1",
    addRuleCommand(2, "A1:A2", "textbegins", { value1: "hello", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 2",
    addRuleCommand(3, "A1:A2", "textends", { value1: "world", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull();
});

test("blank cells never match text-based rule types", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "textcontains", { value1: "x", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("blank cells never match cellis rules", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "eq", value1: "0", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("blank cells never match duplicate/unique rule types", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [addRuleCommand(1, "A1:A2", "duplicate", { color: red })]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull(); // A2 is blank
});

test("duplicate/unique counting skips genuinely empty (never-set) cells in the range", async () => {
  // A2 is never set at all (sheet.cells has no entry), distinct from a
  // cell explicitly written blank; exercises the !rcell continue branch.
  const { SC, sheet } = await setup(["set A1 value n 1", "set A3 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [addRuleCommand(1, "A1:A3", "duplicate", { color: red })]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).not.toBeNull();
});

test("a formula rule with an empty formula field never matches", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    "condfmt add 1 A1:A1\tformula\t\t\t\t\t0\t0\t" + red + "\t0\t0\t0\t0\t0",
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("cellis on non-numeric text values falls back to lexical comparison", async () => {
  const { SC, sheet } = await setup(["set A1 text t apple", "set A2 text t banana"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A2", "cellis", { op: "lt", value1: "banana", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull(); // "apple" < "banana"
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull(); // "banana" < "banana" is false

  await scheduleCommands(SC, sheet, [
    "condfmt delete 1",
    addRuleCommand(2, "A1:A2", "cellis", { op: "eq", value1: "banana", color: red }),
  ]);
  // Exact-equal lexical strings exercise CondFmtCompare's zero-result branch.
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 2",
    addRuleCommand(3, "A1:A2", "cellis", { op: "gt", value1: "apple", color: red }),
  ]);
  // "banana" > "apple" exercises CondFmtCompare's positive lexical branch.
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("CondFmtRuleMatches: duplicate/unique count falls back to zero when the cell's key was never counted", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5"]);
  // Call CondFmtRuleMatches directly with a range that excludes A1's own
  // value from the range being counted, but a cell value that would never
  // key-match anything in that range — proves the `|| 0` fallback in the
  // duplicate/unique count branch, not just the normal within-range path.
  const rule = {
    type: "duplicate",
    range: "B1:B1", // B1 is blank; the counts map for this range is empty
    value1: "",
    value2: "",
    formula: "",
    op: "",
  };
  const matched = SC.CondFmtRuleMatches(sheet, rule, sheet.cells.A1, "A1");
  expect(matched).toBe(false);
});

test("an unrecognized rule type never matches (default branch)", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    "condfmt add 1 A1:A1\tnosuchtype\t\t\t\t\t0\t0\t" + red + "\t0\t0\t0\t0\t0",
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("blank and nonblank rule types", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [addRuleCommand(1, "A1:A2", "blank", { color: red })]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).not.toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 1",
    addRuleCommand(2, "A1:A2", "nonblank", { color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull();
});

test("duplicate and unique detection across a range", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set A2 value n 2", "set A3 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [addRuleCommand(1, "A1:A3", "duplicate", { color: red })]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).not.toBeNull();

  await scheduleCommands(SC, sheet, [
    "condfmt delete 1",
    addRuleCommand(2, "A1:A3", "unique", { color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).toBeNull();
});

test("duplicate detection recognizes value+type change after recalc invalidates cache", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set A2 value n 2"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [addRuleCommand(1, "A1:A2", "duplicate", { color: red })]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
  await scheduleCommands(SC, sheet, ["set A2 value n 1"]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).not.toBeNull();
});

test("custom formula rule with relative A1 adjustment differs per row", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 5",
    "set B1 value n 3",
    "set A2 value n 1",
    "set B2 value n 9",
    "set A3 value n 7",
    "set B3 value n 2",
  ]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A3", "formula", { formula: "A1>B1", color: red }),
  ]);
  // Row 1: A1(5) > B1(3) true. Row 2: A2(1) > B2(9) false. Row 3: A3(7) > B3(2) true.
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).not.toBeNull();
});

test("custom formula rule errors are treated as no-match, not thrown", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "formula", { formula: "1/0", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
});

test("custom formula rule swallows a genuine evaluator exception as no-match", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "formula", { formula: "A1", color: red }),
  ]);
  // Force a real exception inside the try block (e.g. a formula engine
  // internal failure) to prove the catch path fails closed to no-match
  // rather than propagating and breaking the whole render pass.
  const original = SC.Formula.ParseFormulaIntoTokens;
  SC.Formula.ParseFormulaIntoTokens = () => {
    throw new Error("simulated evaluator failure");
  };
  try {
    expect(() => SC.EvaluateCondFmtForCell(sheet, "A1")).not.toThrow();
    expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull();
  } finally {
    SC.Formula.ParseFormulaIntoTokens = original;
  }
});

test("ordered priority: earlier rule with stopIfTrue halts lower-priority rules", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  const blue = await definePaletteColor(SC, sheet, "rgb(0,0,255)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red, stopIfTrue: true }),
    addRuleCommand(2, "A1:A1", "cellis", { op: "gt", value1: "1", color: blue }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toEqual(expect.objectContaining({ color: red }));
});

test("stopIfTrue=false lets a later rule fill in an unset style field", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  const yellowBg = await definePaletteColor(SC, sheet, "rgb(255,255,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red, stopIfTrue: false }),
    addRuleCommand(2, "A1:A1", "cellis", { op: "gt", value1: "1", bgcolor: yellowBg }),
  ]);
  const style = SC.EvaluateCondFmtForCell(sheet, "A1");
  expect(style.color).toBe(red);
  expect(style.bgcolor).toBe(yellowBg);
});

test("overlapping ranges: only rules whose range contains the coord apply", async () => {
  const { SC, sheet } = await setup(["set A1 value n 5", "set B1 value n 5"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "eq", value1: "5", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "B1")).toBeNull();
});

test("rendering applies style without mutating the base cell object", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 10"]);
  await recalcSheet(SC, sheet);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red }),
  ]);
  const cellColorBefore = sheet.cells.A1.color;
  const context = new SC.RenderContext(sheet);
  context.RenderSheet(null);
  const el = context.RenderCell(1, 1, 0, 0, true);
  expect(el.style.cssText).toContain(sheet.colors[red]);
  expect(sheet.cells.A1.color).toBe(cellColorBefore); // base cell style untouched
});

test("rendering applies the full style overlay: font, bgcolor, and all four borders", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 10"]);
  await recalcSheet(SC, sheet);
  const bold = sheet.GetStyleNum("font", "normal bold * *");
  const yellowBg = sheet.GetStyleNum("color", "rgb(255,255,0)");
  const border = sheet.GetStyleNum("borderstyle", "1px solid rgb(0,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", {
      op: "gt",
      value1: "5",
      font: bold,
      bgcolor: yellowBg,
      bt: border,
      br: border,
      bb: border,
      bl: border,
    }),
  ]);
  const context = new SC.RenderContext(sheet);
  context.RenderSheet(null);
  const el = context.RenderCell(1, 1, 0, 0, true);
  expect(el.style.cssText).toContain("font-weight:bold");
  expect(el.style.cssText).toContain("background-color:" + sheet.colors[yellowBg]);
  expect(el.style.cssText).toContain("border-top:" + sheet.borderstyles[border]);
  expect(el.style.cssText).toContain("border-right:" + sheet.borderstyles[border]);
  expect(el.style.cssText).toContain("border-bottom:" + sheet.borderstyles[border]);
  expect(el.style.cssText).toContain("border-left:" + sheet.borderstyles[border]);
  // Base cell attributes remain untouched by the overlay.
  expect(sheet.cells.A1.font).toBeUndefined();
  expect(sheet.cells.A1.bgcolor).toBeUndefined();
  expect(sheet.cells.A1.bt).toBeUndefined();
});

test("re-evaluates on recalc when a formula result changes", async () => {
  const { SC, sheet } = await setup(["set A1 value n 1", "set B1 formula A1*10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "B1:B1", "cellis", { op: "gt", value1: "5", color: red }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "B1")).not.toBeNull();
  await scheduleCommands(SC, sheet, ["set A1 value n 0"]);
  await recalcSheet(SC, sheet);
  expect(SC.EvaluateCondFmtForCell(sheet, "B1")).toBeNull();
});

test("range priority: multiple rules matching same cell fold per foldCondFmtRule ordering", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  const green = await definePaletteColor(SC, sheet, "rgb(0,255,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "20", color: red }), // does not match
    addRuleCommand(2, "A1:A1", "cellis", { op: "gt", value1: "5", color: green }), // matches
  ]);
  const style = SC.EvaluateCondFmtForCell(sheet, "A1");
  expect(style.color).toBe(green);
});

test("insert row above a rule's range shifts the rule range and formula anchor", async () => {
  const { SC, sheet } = await setup(["set A2 value n 10", "set B2 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A2:A2", "formula", { formula: "A2>B2", color: red, stopIfTrue: true }),
  ]);
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).not.toBeNull();
  await scheduleCommands(SC, sheet, ["insertrow A1"]);
  // A2 shifted down to A3; rule should now target A3
  expect(sheet.condfmtRules[0].range).toBe("A3:A3");
  expect(SC.EvaluateCondFmtForCell(sheet, "A3")).not.toBeNull();
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).toBeNull();
});

test("delete row above a rule's range shifts the rule range up", async () => {
  const { SC, sheet } = await setup(["set A3 value n 10", "set B3 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A3:A3", "formula", { formula: "A3>B3", color: red, stopIfTrue: true }),
  ]);
  await scheduleCommands(SC, sheet, ["deleterow A1"]);
  expect(sheet.condfmtRules[0].range).toBe("A2:A2");
  expect(SC.EvaluateCondFmtForCell(sheet, "A2")).not.toBeNull();
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules[0].range).toBe("A3:A3");
  expect(sheet.condfmtRules[0].formula).toBe("A3>B3");
});

test("update with a nonexistent rule id is a no-op", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
  ]);
  await scheduleCommands(SC, sheet, [
    "condfmt update 999 A1:A1\tcellis\tgt\t0\t\t\t0\t0\t" + red + "\t0\t0\t0\t0\t0",
  ]);
  expect(sheet.condfmtRules).toHaveLength(1);
  expect(sheet.condfmtRules[0].id).toBe(1);
});

test("save/load with a style-less rule and a lower trailing id (ParseSheetSave nextId false branch)", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  await scheduleCommands(SC, sheet, [
    "condfmt add 5 A1:A1\tblank\t\t\t\t\t0\t0\t0\t0\t0\t0\t0\t0",
    "condfmt add 3 A1:A1\tblank\t\t\t\t\t0\t0\t0\t0\t0\t0\t0\t0",
  ]);
  const saved = sheet.CreateSheetSave();
  const sheet2 = new SC.Sheet();
  sheet2.ParseSheetSave(saved);
  // Rule id 3 loads after id 5 already raised condfmtNextId to 6, so the
  // `parts[1] - 0 >= sheetobj.condfmtNextId` check must take its false
  // branch for id 3 without regressing nextId.
  expect(sheet2.condfmtRules.map((r: any) => r.id).sort((a: number, b: number) => a - b)).toEqual([
    3, 5,
  ]);
  expect(sheet2.condfmtNextId).toBe(6);
  // Style-less rule round-trips with every field at its unset (0) default.
  const styleless = sheet2.condfmtRules.find((r: any) => r.id === 3);
  expect(styleless.style).toEqual({ font: 0, color: 0, bgcolor: 0, bt: 0, br: 0, bb: 0, bl: 0 });
});

test("condfmt update with saveundo=false does not record an undo entry", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
  ]);
  const undoDepthBefore = sheet.changes.tos;
  await scheduleCommands(
    SC,
    sheet,
    ["condfmt update 1 A1:A1\tcellis\tgt\t9\t\t\t0\t0\t" + red + "\t0\t0\t0\t0\t0"],
    false,
  );
  expect(sheet.condfmtRules[0].value1).toBe("9");
  expect(sheet.changes.tos).toBe(undoDepthBefore);
});

test("condfmt update with saveundo=true can be undone back to the prior field values", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red }),
  ]);
  await scheduleCommands(SC, sheet, [
    "condfmt update 1 A1:A1\tcellis\tgt\t9\t\t\t0\t0\t" + red + "\t0\t0\t0\t0\t0",
  ]);
  expect(sheet.condfmtRules[0].value1).toBe("9");
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules[0].value1).toBe("5");
});

test("move range: rule range follows moved cells via movepaste", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red }),
  ]);
  await scheduleCommands(SC, sheet, ["movepaste A1:A1 C1 all"]);
  expect(sheet.condfmtRules[0].range).toBe("C1:C1");
  expect(SC.EvaluateCondFmtForCell(sheet, "C1")).not.toBeNull();
});

test("condfmt command with an unrecognized subcommand is a silent no-op", async () => {
  const { SC, sheet } = await setup([]);
  await scheduleCommands(SC, sheet, ["condfmt bogus 1"]);
  expect(sheet.condfmtRules).toHaveLength(0);
});

test("movepaste with saveundo=false rewrites the rule range without recording undo", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red }),
  ]);
  const undoDepthBefore = sheet.changes.tos;
  await scheduleCommands(SC, sheet, ["movepaste A1:A1 C1 all"], false);
  expect(sheet.condfmtRules[0].range).toBe("C1:C1");
  expect(sheet.changes.tos).toBe(undoDepthBefore);
});

test("move range: formula-type rule's formula is rewritten via ReplaceFormulaCoords", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10", "set B1 value n 1"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "formula", { formula: "A1>B1", color: red, stopIfTrue: true }),
  ]);
  await scheduleCommands(SC, sheet, ["movepaste A1:A1 C1 all"]);
  expect(sheet.condfmtRules[0].range).toBe("C1:C1");
  expect(sheet.condfmtRules[0].formula).toBe("C1>B1");
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules[0].range).toBe("A1:A1");
  expect(sheet.condfmtRules[0].formula).toBe("A1>B1");
});

test("move with a nonexistent rule id is a no-op", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
  ]);
  await scheduleCommands(SC, sheet, ["condfmt move 999 up"]);
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([1]);
});

test("move: moving the first rule up (or last rule down) is a no-op at the boundary", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
    addRuleCommand(2, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
  ]);
  const undoDepthBefore = sheet.changes.tos;
  await scheduleCommands(SC, sheet, ["condfmt move 1 up"]); // already first: swapWith=-1
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([1, 2]);
  await scheduleCommands(SC, sheet, ["condfmt move 2 down"]); // already last: swapWith=length
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([1, 2]);
  // A no-op boundary move must not push any undo step: it schedules two
  // real commands (so tos advances by 2 for the ScheduleSheetCommands
  // calls themselves), but the move handler's own AddUndo is conditional
  // on the swap actually happening, so undo(x2) must land back exactly
  // where we started rather than reversing an untouched swap.
  expect(sheet.changes.tos).toBe(undoDepthBefore + 2);
  await sheetUndo(SC, sheet);
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([1, 2]);
});

test("undo restores a deleted rule; redo removes it again", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red }),
  ]);
  expect(sheet.condfmtRules.length).toBe(1);
  await scheduleCommands(SC, sheet, ["condfmt delete 1"]);
  expect(sheet.condfmtRules.length).toBe(0);
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules.length).toBe(1);
  expect(sheet.condfmtRules[0].id).toBe(1);
  await sheetRedo(SC, sheet);
  expect(sheet.condfmtRules.length).toBe(0);
});

test("save/load round trip preserves every style field (font/bt/br/bb/bl) and stopIfTrue=false", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  const yellowBg = await definePaletteColor(SC, sheet, "rgb(255,255,0)");
  const bold = sheet.GetStyleNum("font", "normal bold * *");
  const border = sheet.GetStyleNum("borderstyle", "1px solid rgb(0,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", {
      op: "gt",
      value1: "5",
      color: red,
      bgcolor: yellowBg,
      font: bold,
      bt: border,
      br: border,
      bb: border,
      bl: border,
      stopIfTrue: false,
    }),
  ]);
  const saved = sheet.CreateSheetSave();

  const sheet2 = new SC.Sheet();
  sheet2.ParseSheetSave(saved);
  const rule2 = sheet2.condfmtRules[0];
  expect(rule2.stopIfTrue).toBe(false);
  expect(sheet2.fonts[rule2.style.font]).toBe("normal bold * *");
  expect(sheet2.colors[rule2.style.color]).toBe("rgb(255,0,0)");
  expect(sheet2.colors[rule2.style.bgcolor]).toBe("rgb(255,255,0)");
  expect(sheet2.borderstyles[rule2.style.bt]).toBe("1px solid rgb(0,0,0)");
  expect(sheet2.borderstyles[rule2.style.br]).toBe("1px solid rgb(0,0,0)");
  expect(sheet2.borderstyles[rule2.style.bb]).toBe("1px solid rgb(0,0,0)");
  expect(sheet2.borderstyles[rule2.style.bl]).toBe("1px solid rgb(0,0,0)");
});

test("condfmt insertat issued directly with saveundo records its own undo (delete)", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    "condfmt insertat 0 5 A1:A1\tcellis\tgt\t0\t\t\t0\t0\t" + red + "\t0\t0\t0\t0\t0",
  ]);
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([5]);
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules.length).toBe(0);
});

test("undo restores a deleted rule without regressing condfmtNextId when a newer rule already exists", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
    addRuleCommand(2, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
  ]);
  const nextIdBefore = sheet.condfmtNextId;
  await scheduleCommands(SC, sheet, ["condfmt delete 1"]);
  await sheetUndo(SC, sheet); // re-inserts id 1 via insertat; 1 < nextIdBefore already
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([1, 2]);
  expect(sheet.condfmtNextId).toBe(nextIdBefore);
});

test("undo restores an added rule's prior absence; redo re-adds the same id", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(7, "A1:A1", "cellis", { op: "gt", value1: "5", color: red }),
  ]);
  expect(sheet.condfmtRules.length).toBe(1);
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules.length).toBe(0);
  await sheetRedo(SC, sheet);
  expect(sheet.condfmtRules.length).toBe(1);
  expect(sheet.condfmtRules[0].id).toBe(7);
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules.length).toBe(0);
});

test("move reorders rule priority; undo restores order", async () => {
  const { SC, sheet } = await setup([]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  const blue = await definePaletteColor(SC, sheet, "rgb(0,0,255)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "0", color: red }),
    addRuleCommand(2, "A1:A1", "cellis", { op: "gt", value1: "0", color: blue }),
  ]);
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([1, 2]);
  await scheduleCommands(SC, sheet, ["condfmt move 2 up"]);
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([2, 1]);
  await sheetUndo(SC, sheet);
  expect(sheet.condfmtRules.map((r: any) => r.id)).toEqual([1, 2]);
});

test("save/load round trip preserves rules including style palette indices", async () => {
  const { SC, sheet } = await setup(["set A1 value n 10"]);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [
    addRuleCommand(1, "A1:A1", "cellis", { op: "gt", value1: "5", color: red, stopIfTrue: true }),
  ]);
  const saved = sheet.CreateSheetSave();
  expect(saved).toContain("condfmt:1:A1\\cA1:cellis:gt:5:::1:0:1:0:0:0:0:0");

  const sheet2 = new SC.Sheet();
  sheet2.ParseSheetSave(saved);
  expect(sheet2.condfmtRules.length).toBe(1);
  expect(sheet2.condfmtRules[0].type).toBe("cellis");
  expect(sheet2.condfmtRules[0].op).toBe("gt");
  expect(sheet2.condfmtRules[0].value1).toBe("5");
  expect(sheet2.condfmtRules[0].stopIfTrue).toBe(true);
  const styleColorName = sheet2.colors[sheet2.condfmtRules[0].style.color];
  expect(styleColorName).toBe("rgb(255,0,0)");
});

test("security: hostile style/formula/range inputs never throw and never inject markup", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, sheet);
  await scheduleCommands(SC, sheet, [
    "condfmt add 1 A1:A1\tformula\t\t\t\t<script>alert(1)</script>\t0\t0\t0\t0\t0\t0\t0\t0",
  ]);
  expect(() => SC.EvaluateCondFmtForCell(sheet, "A1")).not.toThrow();
  expect(SC.EvaluateCondFmtForCell(sheet, "A1")).toBeNull(); // malformed formula never matches

  await scheduleCommands(SC, sheet, [
    "condfmt delete 1",
    "condfmt add 2 NOTAREAL_RANGE!!\tblank\t\t\t\t\t0\t0\t0\t0\t0\t0\t0\t0",
  ]);
  expect(() => SC.EvaluateCondFmtForCell(sheet, "A1")).not.toThrow();

  const context = new SC.RenderContext(sheet);
  context.RenderSheet(null);
  expect(() => context.RenderCell(1, 1, 0, 0, true)).not.toThrow();

  // Style fields are always palette-index numbers, never raw CSS text: the
  // sheet command layer only ever stores/consumes numeric indices into
  // sheet.colors/fonts/borderstyles (identical policy to cell.color/
  // cell.bgcolor/cell.font/cell.b[trbl]). A hostile non-numeric "index"
  // (e.g. attempted CSS injection) coerces to NaN via `- 0`, which is
  // falsy and is therefore treated as "unset" everywhere a style field is
  // read, and can never resolve to a real sheet.colors/borderstyles entry.
  await scheduleCommands(SC, sheet, [
    "condfmt delete 2",
    "condfmt add 3 A1:A1\tcellis\tgt\t0\t\t\t0\t0\tred;background:url(javascript:alert(1))\t0\t0\t0\t0\t0",
  ]);
  const hostileRule = sheet.condfmtRules[sheet.condfmtRules.length - 1];
  expect(Number.isNaN(hostileRule.style.color)).toBe(true);
  const hostileStyle = SC.EvaluateCondFmtForCell(sheet, "A1");
  // NaN is falsy, so EvaluateCondFmtForCell's `!style.color && rstyle.color`
  // overlay guard never assigns it; the rendered element gets no color rule
  // from this field at all.
  expect(hostileStyle === null || !hostileStyle.color).toBe(true);
  const hostileEl = context.RenderCell(1, 1, 0, 0, true);
  expect(hostileEl.style.cssText).not.toContain("javascript:");
  expect(hostileEl.style.cssText).not.toContain("url(");
});

test("performance: EvaluateCondFmtForCell does not rescan the range on every call (cached counts)", async () => {
  const commands: string[] = [];
  for (let i = 1; i <= 500; i++) {
    commands.push(`set A${i} value n ${i % 3}`);
  }
  const { SC, sheet } = await setup(commands);
  const red = await definePaletteColor(SC, sheet, "rgb(255,0,0)");
  await scheduleCommands(SC, sheet, [addRuleCommand(1, "A1:A500", "duplicate", { color: red })]);

  const start = performance.now();
  for (let i = 1; i <= 500; i++) {
    SC.EvaluateCondFmtForCell(sheet, `A${i}`);
  }
  const elapsed = performance.now() - start;
  // 500 cells x 500-row-range rescans would be catastrophically slow (250k+
  // comparisons via naive re-scan); the counts cache keeps this well under
  // a generous wall-clock budget even on a loaded CI box.
  expect(elapsed).toBeLessThan(500);
});
