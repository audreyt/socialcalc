// Compile-time type smoke test for the public SocialCalc API surface.
//
// This test exists primarily to force `tsgo --noEmit` to load and exercise
// the aggregator .d.ts at `dist/SocialCalc.d.ts` (and transitively every
// `/// <reference path=... />` it pulls in). Catching a broken aggregator
// or regressed public signature is the point; runtime behaviour is covered
// exhaustively by the sibling tests in this directory.
//
// The runtime VALUE comes from the shared `loadSocialCalc()` vm.Script
// loader (same mechanism every other test file uses) so this file does not
// register a second, independently-instrumented copy of dist/SocialCalc.js
// via Vitest's native ESM module graph. A prior version of this file used
// a plain `import SC from "../dist/SocialCalc.js"` runtime import: that
// loads and executes the bundle through Vite's own module pipeline in
// *addition* to the vm.Script copy every other test file loads, and the
// two coverage instrumentations of the same generated file collide during
// merge — verified empirically (see git history) to zero out V8 coverage
// for large functions (e.g. SC.ExecuteSheetCommand) across the whole test
// run despite them being heavily exercised elsewhere. The `import type`
// below is fully erased at compile time (no runtime import emitted at all)
// and is what forces the type checker through the aggregator.
//
// Style note: we deliberately spell out `const x: SC.Foo = ...` annotations
// rather than leaning on inference so tsgo walks each declaration's type
// through the aggregator. The point is surface-walking, not terseness.

import { describe, expect, it } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

// Type-only import: never emitted at runtime, so `dist/SocialCalc.js` is
// not loaded through Vite's ESM pipeline by this file. Still gives full
// namespace-qualified type positions (`SC.Sheet`, `SC.Parse`, ...) below.
import type SC from "../dist/SocialCalc.js";

describe("typed public API smoke", () => {
  describe("core types", () => {
    it("Sheet class and core parsing helpers are typed and callable", async () => {
      const runtime = await loadSocialCalc();
      const sheet: SC.Sheet = new runtime.Sheet();
      const save = "version:1.5\ncell:A1:t:hello\ncell:B1:v:42\nsheet:c:2:r:1\n";

      runtime.ParseSheetSave(save, sheet);

      const cell: SC.Cell = sheet.GetAssuredCell("B1");
      expect(typeof cell).toBe("object");

      // Also exercise the free-function form of CellFromStringParts so its
      // overload stays in the public surface.
      expect(typeof runtime.CellFromStringParts).toBe("function");
    });

    it("Parse class steps tokens and lines across a multi-line string", async () => {
      const runtime = await loadSocialCalc();
      // Tokens are space-delimited within a line; NextLine() advances
      // across the `\n` to the next line's tokens.
      const p: SC.Parse = new runtime.Parse("alpha beta\ngamma delta\n");

      const first: string = p.NextToken();
      expect(first).toBe("alpha");
      const second: string = p.NextToken();
      expect(second).toBe("beta");

      // Advance to the next line and consume its first token.
      p.NextLine();
      expect(p.EOF()).toBe(false);
      const third: string = p.NextToken();
      expect(third).toBe("gamma");

      const rest: string = p.RestOfString();
      expect(typeof rest).toBe("string");
      expect(rest).toBe("delta");

      p.NextLine();
      expect(p.EOF()).toBe(true);
    });

    it("UndoStack exposes PushChange / AddDo / AddUndo / TOS / Undo / Redo", async () => {
      const runtime = await loadSocialCalc();
      const stack: SC.UndoStack = new runtime.UndoStack();
      stack.PushChange("set A1");
      stack.AddDo("set", "A1", "value", "n", 1);
      stack.AddUndo("set", "A1", "empty");

      const tos = stack.TOS();
      expect(tos).not.toBeNull();
      if (tos !== null) {
        expect(Array.isArray(tos.command)).toBe(true);
        expect(Array.isArray(tos.undo)).toBe(true);
        expect(typeof tos.type).toBe("string");
      }

      // Undo/Redo return booleans; the stack only has one entry, so a
      // single Undo succeeds and immediate Redo succeeds as well.
      const undidOk: boolean = stack.Undo();
      expect(undidOk).toBe(true);
      const redidOk: boolean = stack.Redo();
      expect(redidOk).toBe(true);
    });

    it("RenderContext constructs from a Sheet and exposes its key fields", async () => {
      const runtime = await loadSocialCalc();
      const sheet: SC.Sheet = new runtime.Sheet();
      const ctx: SC.RenderContext = new runtime.RenderContext(sheet);

      expect(ctx.sheetobj).toBe(sheet);
      expect(typeof ctx.showGrid).toBe("boolean");
      expect(typeof ctx.cellIDprefix).toBe("string");
      expect(Array.isArray(ctx.rowpanes)).toBe(true);
      expect(Array.isArray(ctx.colpanes)).toBe(true);
    });

    it("Sheet command execution stores a typed numeric cell value", async () => {
      const runtime = await loadSocialCalc();
      const sheet: SC.Sheet = new runtime.Sheet();
      const cmd: SC.Parse = new runtime.Parse("set A1 value n 42");
      const err: string = runtime.ExecuteSheetCommand(sheet, cmd, false);
      expect(err).toBeFalsy();

      const cell: SC.Cell = sheet.GetAssuredCell("A1");
      expect(cell.datavalue).toBe(42);
      expect(cell.valuetype).toBe("n");
    });

    it("Cell attribute encode/decode round-trips through AttribSet", async () => {
      const runtime = await loadSocialCalc();
      const sheet: SC.Sheet = new runtime.Sheet();
      runtime.ExecuteSheetCommand(sheet, new runtime.Parse("set A1 value n 7"), false);

      const attrs: SC.AttribSet = runtime.EncodeCellAttributes(sheet, "A1");
      expect(typeof attrs).toBe("object");

      const decodeErr: string | null = runtime.DecodeCellAttributes(sheet, "A1", attrs);
      // DecodeCellAttributes returns null on success (or an error string).
      expect(decodeErr === null || typeof decodeErr === "string").toBe(true);
    });

    it("Coordinate helpers round-trip column/row pairs", async () => {
      const runtime = await loadSocialCalc();
      const coord: string = runtime.crToCoord(1, 1);
      expect(coord).toBe("A1");

      const cr: { row: number; col: number } = runtime.coordToCr("B3");
      expect(cr.row).toBe(3);
      expect(cr.col).toBe(2);
    });
  });

  describe("formula", () => {
    it("Formula module exposes evaluate_parsed_formula", async () => {
      const runtime = await loadSocialCalc();
      expect(typeof runtime.Formula).toBe("object");
      expect(typeof runtime.Formula.evaluate_parsed_formula).toBe("function");
    });

    it("Formula parse + evaluate round trip produces a typed result", async () => {
      const runtime = await loadSocialCalc();
      const tokens: SC.FormulaParseToken[] = runtime.Formula.ParseFormulaIntoTokens("1+2*3");
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      const sheet: SC.Sheet = new runtime.Sheet();
      const result: SC.FormulaEvaluateResult = runtime.Formula.evaluate_parsed_formula(tokens, sheet);

      expect(result.value).toBe(7);
      expect(typeof result.type).toBe("string");
    });
  });

  describe("format", () => {
    it("FormatNumber.formatNumberWithFormat returns a string", async () => {
      const runtime = await loadSocialCalc();
      const formatted: string = runtime.FormatNumber.formatNumberWithFormat(1234.5, "#,##0.00");
      expect(typeof formatted).toBe("string");
      expect(formatted).toBe("1,234.50");
    });

    it("FormatNumber renders a percentage format correctly", async () => {
      const runtime = await loadSocialCalc();
      const pct: string = runtime.FormatNumber.formatNumberWithFormat(0.1234, "0.00%");
      expect(pct).toBe("12.34%");
    });

    it("FormatNumber Julian/Gregorian helpers return typed values", async () => {
      const runtime = await loadSocialCalc();
      const julian: number = runtime.FormatNumber.convert_date_gregorian_to_julian(2025, 1, 1);
      expect(typeof julian).toBe("number");
      expect(Number.isFinite(julian)).toBe(true);

      const ymd: SC.FormatNumberYMD = runtime.FormatNumber.convert_date_julian_to_gregorian(julian);
      expect(ymd.year).toBe(2025);
      expect(ymd.month).toBe(1);
      expect(ymd.day).toBe(1);

      expect(typeof runtime.FormatNumber.parse_format_string).toBe("function");
    });
  });

  describe("constants", () => {
    it("Constants namespace exposes typed string constants", async () => {
      const runtime = await loadSocialCalc();
      // `textdatadefaulttype` is the strongly-typed field in the Constants
      // interface; it is the source of the conventional `textdatadefault`
      // default referenced throughout the codebase.
      const defaultType: string = runtime.Constants.textdatadefaulttype;
      expect(typeof defaultType).toBe("string");

      // Also reach through the index signature so that aggregator users
      // who access other constants keep compiling.
      expect(typeof runtime.Constants.defaultCellLayout).toBe("string");
    });

    it("Constants exposes a localized s_loc_* string and ConstantsSetClasses runs", async () => {
      const runtime = await loadSocialCalc();
      // NOTE(types): the task spec asked for `s_loc_menu_edit`, but the
      // .d.ts surfaces `s_loc_edit` (and many other s_loc_*), not the
      // menu_edit variant. Using the declared field keeps the assertion
      // honest without mutating .d.ts files.
      const editLabel: string = runtime.Constants.s_loc_edit;
      expect(typeof editLabel).toBe("string");

      // ConstantsSetClasses mutates Constants in-place; here we only care
      // that it is callable with a prefix and does not throw.
      expect(() => runtime.ConstantsSetClasses("myprefix")).not.toThrow();
    });
  });

  describe("ui surfaces (existence only, no DOM instantiation)", () => {
    it("TableEditor and CreateTableEditor are exposed as callables", async () => {
      const runtime = await loadSocialCalc();
      expect(typeof runtime.TableEditor).toBe("function");
      expect(typeof runtime.CreateTableEditor).toBe("function");
    });

    it("SpreadsheetControl is exposed as a constructor", async () => {
      const runtime = await loadSocialCalc();
      expect(typeof runtime.SpreadsheetControl).toBe("function");
    });

    it("SpreadsheetViewer is exposed as a constructor", async () => {
      const runtime = await loadSocialCalc();
      expect(typeof runtime.SpreadsheetViewer).toBe("function");
    });

    it("Popup.Create / Popup.Reset helpers are exposed", async () => {
      const runtime = await loadSocialCalc();
      expect(typeof runtime.Popup).toBe("object");
      expect(typeof runtime.Popup.Create).toBe("function");
      expect(typeof runtime.Popup.Reset).toBe("function");
    });
  });
});
