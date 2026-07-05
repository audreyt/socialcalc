import { describe, expect, test } from "bun:test";

import { loadSocialCalc } from "./helpers/socialcalc";

describe("formula reference rewrite regressions (Leanstral oracle)", () => {
    test("OffsetFormulaCoords preserves doubled quotes while shifting coord refs", async () => {
        const SC = await loadSocialCalc();
        const inner = 'CONCATENATE("a""b""c",A1)';
        expect(SC.OffsetFormulaCoords(inner, 1, 0)).toBe('CONCATENATE("a""b""c",B1)');
    });

    test("AdjustFormulaCoords preserves doubled quotes while shifting coord refs", async () => {
        const SC = await loadSocialCalc();
        const inner = 'CONCATENATE("a""b""c",A1)';
        expect(SC.AdjustFormulaCoords(inner, 1, 1, 1, 0)).toBe('CONCATENATE("a""b""c",B1)');
    });

    test("whole-column name tokens N:N and T:T are not rewritten on offset", async () => {
        const SC = await loadSocialCalc();
        expect(SC.OffsetFormulaCoords("SUM(N:N)+SUM(T:T)", 1, 0)).toBe("SUM(N:N)+SUM(T:T)");
    });

    test("whole-column AA:AA stays a name while AA1 shifts on offset", async () => {
        const SC = await loadSocialCalc();
        expect(SC.OffsetFormulaCoords("SUM(AA:AA)+AA1", 1, 0)).toBe("SUM(AA:AA)+AB1");
    });

    test("AdjustFormulaCoords keeps whole-column names while shifting later coord refs", async () => {
        const SC = await loadSocialCalc();
        expect(SC.AdjustFormulaCoords("SUM(N:N)+SUM(T:T)+C1", 1, 1, 1, 0)).toBe(
            "SUM(N:N)+SUM(T:T)+D1",
        );
    });

    test("zero-offset OffsetFormulaCoords normalizes >= and <> via TokenOpExpansion", async () => {
        const SC = await loadSocialCalc();
        expect(SC.OffsetFormulaCoords("A1>=B1", 0, 0)).toBe("A1>=B1");
        expect(SC.OffsetFormulaCoords("A1<>B1", 0, 0)).toBe("A1<>B1");
        expect(SC.OffsetFormulaCoords("A1 >= B1", 0, 0)).toBe("A1>=B1");
    });

    test("zero-offset AdjustFormulaCoords normalizes >= and <> the same way", async () => {
        const SC = await loadSocialCalc();
        expect(SC.AdjustFormulaCoords("A1>=B1", 1, 0, 1, 0)).toBe("A1>=B1");
        expect(SC.AdjustFormulaCoords("A1<>B1", 1, 0, 1, 0)).toBe("A1<>B1");
        expect(SC.AdjustFormulaCoords("A1 >= B1", 1, 0, 1, 0)).toBe("A1>=B1");
    });

    test("OffsetFormulaCoords composition matches a single offset when intermediates stay valid", async () => {
        const SC = await loadSocialCalc();
        const formula = "A1+B1";
        const once = SC.OffsetFormulaCoords(formula, 1, 1);
        const composed = SC.OffsetFormulaCoords(once, 1, 1);
        const direct = SC.OffsetFormulaCoords(formula, 2, 2);
        expect(once).toBe("B2+C2");
        expect(composed).toBe(direct);
        expect(composed).toBe("C3+D3");
    });

    test("OffsetFormulaCoords stops safe composition once an intermediate step yields #REF!", async () => {
        const SC = await loadSocialCalc();
        const first = SC.OffsetFormulaCoords("A1", -1, 0);
        expect(first).toBe("#REF!");
        expect(SC.OffsetFormulaCoords(first, -1, 0)).toBe("#REF!");
    });

    test("AdjustFormulaCoords skips sheet-qualified coord while local deleted ref becomes #REF!", async () => {
        const SC = await loadSocialCalc();
        expect(SC.AdjustFormulaCoords("Sheet2!B1+B1", 2, -1, 1, 0)).toBe("SHEET2!B1+#REF!");
    });

    test("AdjustFormulaCoords skips sheet-qualified anchor on insert-style adjust", async () => {
        const SC = await loadSocialCalc();
        expect(SC.AdjustFormulaCoords("Sheet2!A1+B1", 1, 2, 1, 0)).toBe("SHEET2!A1+D1");
    });
});
