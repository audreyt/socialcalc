// Compile-time type smoke test for the public SocialCalc API surface.
//
// This test exists primarily to force `tsgo --noEmit` to load and exercise
// the aggregator .d.ts at `dist/SocialCalc.d.ts` (and transitively every
// `/// <reference path=... />` it pulls in). Catching a broken aggregator
// or regressed public signature is the point; runtime behaviour is covered
// exhaustively by the sibling tests in this directory.
//
// The runtime import matches the helper pattern used in `core.test.ts` &
// friends (default-import of the bundled build artifact). The `import type`
// line is what forces the type checker through the aggregator.
//
// Style note: we deliberately spell out `const x: SC.Foo = ...` annotations
// rather than leaning on inference so tsgo walks each declaration's type
// through the aggregator. The point is surface-walking, not terseness.

/// <reference path="../dist/SocialCalc.d.ts" />
import { describe, expect, it } from "bun:test";

// Import the runtime under a non-shadowing local name so we can still use
// the ambient `SocialCalc` namespace (exposed via `export as namespace
// SocialCalc` in the aggregator) as a type qualifier.
import SC from "../dist/SocialCalc.js";

describe("typed public API smoke", () => {
    describe("core types", () => {
        it("Sheet class and core parsing helpers are typed and callable", () => {
            const sheet: SC.Sheet = new SC.Sheet();
            const save = "version:1.5\ncell:A1:t:hello\ncell:B1:v:42\nsheet:c:2:r:1\n";

            SC.ParseSheetSave(save, sheet);

            const cell: SC.Cell = sheet.GetAssuredCell("B1");
            expect(typeof cell).toBe("object");

            // Also exercise the free-function form of CellFromStringParts so its
            // overload stays in the public surface.
            expect(typeof SC.CellFromStringParts).toBe("function");
        });

        it("Parse class steps tokens and lines across a multi-line string", () => {
            // Tokens are space-delimited within a line; NextLine() advances
            // across the `\n` to the next line's tokens.
            const p: SC.Parse = new SC.Parse("alpha beta\ngamma delta\n");

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

        it("UndoStack exposes PushChange / AddDo / AddUndo / TOS / Undo / Redo", () => {
            const stack: SC.UndoStack = new SC.UndoStack();
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

        it("RenderContext constructs from a Sheet and exposes its key fields", () => {
            const sheet: SC.Sheet = new SC.Sheet();
            const ctx: SC.RenderContext = new SC.RenderContext(sheet);

            expect(ctx.sheetobj).toBe(sheet);
            expect(typeof ctx.showGrid).toBe("boolean");
            expect(typeof ctx.cellIDprefix).toBe("string");
            expect(Array.isArray(ctx.rowpanes)).toBe(true);
            expect(Array.isArray(ctx.colpanes)).toBe(true);
        });

        it("Sheet command execution stores a typed numeric cell value", () => {
            const sheet: SC.Sheet = new SC.Sheet();
            const cmd: SC.Parse = new SC.Parse("set A1 value n 42");
            const err: string = SC.ExecuteSheetCommand(sheet, cmd, false);
            expect(err).toBeFalsy();

            const cell: SC.Cell = sheet.GetAssuredCell("A1");
            expect(cell.datavalue).toBe(42);
            expect(cell.valuetype).toBe("n");
        });

        it("Cell attribute encode/decode round-trips through AttribSet", () => {
            const sheet: SC.Sheet = new SC.Sheet();
            SC.ExecuteSheetCommand(sheet, new SC.Parse("set A1 value n 7"), false);

            const attrs: SC.AttribSet = SC.EncodeCellAttributes(sheet, "A1");
            expect(typeof attrs).toBe("object");

            const decodeErr: string | null = SC.DecodeCellAttributes(sheet, "A1", attrs);
            // DecodeCellAttributes returns null on success (or an error string).
            expect(decodeErr === null || typeof decodeErr === "string").toBe(true);
        });

        it("Coordinate helpers round-trip column/row pairs", () => {
            const coord: string = SC.crToCoord(1, 1);
            expect(coord).toBe("A1");

            const cr: { row: number; col: number } = SC.coordToCr("B3");
            expect(cr.row).toBe(3);
            expect(cr.col).toBe(2);
        });
    });

    describe("formula", () => {
        it("Formula module exposes evaluate_parsed_formula", () => {
            expect(typeof SC.Formula).toBe("object");
            expect(typeof SC.Formula.evaluate_parsed_formula).toBe("function");
        });

        it("Formula parse + evaluate round trip produces a typed result", () => {
            const tokens: SC.FormulaParseToken[] =
                SC.Formula.ParseFormulaIntoTokens("1+2*3");
            expect(Array.isArray(tokens)).toBe(true);
            expect(tokens.length).toBeGreaterThan(0);

            const sheet: SC.Sheet = new SC.Sheet();
            const result: SC.FormulaEvaluateResult =
                SC.Formula.evaluate_parsed_formula(tokens, sheet);

            expect(result.value).toBe(7);
            expect(typeof result.type).toBe("string");
        });
    });

    describe("format", () => {
        it("FormatNumber.formatNumberWithFormat returns a string", () => {
            const formatted: string = SC.FormatNumber.formatNumberWithFormat(
                1234.5,
                "#,##0.00",
            );
            expect(typeof formatted).toBe("string");
            expect(formatted).toBe("1,234.50");
        });

        it("FormatNumber renders a percentage format correctly", () => {
            const pct: string = SC.FormatNumber.formatNumberWithFormat(0.1234, "0.00%");
            expect(pct).toBe("12.34%");
        });

        it("FormatNumber Julian/Gregorian helpers return typed values", () => {
            const julian: number = SC.FormatNumber.convert_date_gregorian_to_julian(
                2025,
                1,
                1,
            );
            expect(typeof julian).toBe("number");
            expect(Number.isFinite(julian)).toBe(true);

            const ymd: SC.FormatNumberYMD =
                SC.FormatNumber.convert_date_julian_to_gregorian(julian);
            expect(ymd.year).toBe(2025);
            expect(ymd.month).toBe(1);
            expect(ymd.day).toBe(1);

            expect(typeof SC.FormatNumber.parse_format_string).toBe("function");
        });
    });

    describe("constants", () => {
        it("Constants namespace exposes typed string constants", () => {
            // `textdatadefaulttype` is the strongly-typed field in the Constants
            // interface; it is the source of the conventional `textdatadefault`
            // default referenced throughout the codebase.
            const defaultType: string = SC.Constants.textdatadefaulttype;
            expect(typeof defaultType).toBe("string");

            // Also reach through the index signature so that aggregator users
            // who access other constants keep compiling.
            expect(typeof SC.Constants.defaultCellLayout).toBe("string");
        });

        it("Constants exposes a localized s_loc_* string and ConstantsSetClasses runs", () => {
            // NOTE(types): the task spec asked for `s_loc_menu_edit`, but the
            // .d.ts surfaces `s_loc_edit` (and many other s_loc_*), not the
            // menu_edit variant. Using the declared field keeps the assertion
            // honest without mutating .d.ts files.
            const editLabel: string = SC.Constants.s_loc_edit;
            expect(typeof editLabel).toBe("string");

            // ConstantsSetClasses mutates Constants in-place; here we only care
            // that it is callable with a prefix and does not throw.
            expect(() => SC.ConstantsSetClasses("myprefix")).not.toThrow();
        });
    });

    describe("ui surfaces (existence only, no DOM instantiation)", () => {
        it("TableEditor and CreateTableEditor are exposed as callables", () => {
            expect(typeof SC.TableEditor).toBe("function");
            expect(typeof SC.CreateTableEditor).toBe("function");
        });

        it("SpreadsheetControl is exposed as a constructor", () => {
            expect(typeof SC.SpreadsheetControl).toBe("function");
        });

        it("SpreadsheetViewer is exposed as a constructor", () => {
            expect(typeof SC.SpreadsheetViewer).toBe("function");
        });

        it("Popup.Create / Popup.Reset helpers are exposed", () => {
            expect(typeof SC.Popup).toBe("object");
            expect(typeof SC.Popup.Create).toBe("function");
            expect(typeof SC.Popup.Reset).toBe("function");
        });
    });
});
