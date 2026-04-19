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

/// <reference path="../dist/SocialCalc.d.ts" />
import { describe, expect, it } from "bun:test";

// Import the runtime under a non-shadowing local name so we can still use
// the ambient `SocialCalc` namespace (exposed via `export as namespace
// SocialCalc` in the aggregator) as a type qualifier.
import SC from "../dist/SocialCalc.js";

describe("typed public API smoke", () => {
    it("Sheet class and core parsing helpers are typed and callable", () => {
        const sheet = new SC.Sheet();
        const save = "version:1.5\ncell:A1:t:hello\ncell:B1:v:42\nsheet:c:2:r:1\n";

        SC.ParseSheetSave(save, sheet);

        const cell = sheet.GetAssuredCell("B1");
        expect(typeof cell).toBe("object");

        // Also exercise the free-function form of CellFromStringParts so its
        // overload stays in the public surface.
        expect(typeof SC.CellFromStringParts).toBe("function");
    });

    it("Formula module exposes evaluate_parsed_formula", () => {
        expect(typeof SC.Formula).toBe("object");
        expect(typeof SC.Formula.evaluate_parsed_formula).toBe("function");
    });

    it("FormatNumber.formatNumberWithFormat returns a string", () => {
        const formatted: string = SC.FormatNumber.formatNumberWithFormat(
            1234.5,
            "#,##0.00",
        );
        expect(typeof formatted).toBe("string");
        expect(formatted).toBe("1,234.50");
    });

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
});
