import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
    loadSocialCalc,
    scheduleCommands,
    sheetRedo,
    sheetUndo,
} from "./helpers/socialcalc";

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
    timeout: null;
    griddiv: null;
    ScheduleRender(): void;
    FitToEditTable(): void;
}

interface SocialCalcHarness {
    CurrentSpreadsheetControlObject?: { editor: FakeEditor };
    Formula?: { SheetCache?: { waitingForLoading: string | null } };
    Sheet: new () => {
        cells: Record<string, { formula?: string; datavalue?: unknown }>;
        names: Record<string, { definition: string }>;
        attribs: { lastcol: number; lastrow: number };
    };
}

function installEditorMock(SC: SocialCalcHarness) {
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
    SC.CurrentSpreadsheetControlObject = { editor: fakeEditor };
}

beforeAll(async () => {
    const SC = (await loadSocialCalc()) as SocialCalcHarness;
    installEditorMock(SC);
});

afterAll(async () => {
    const SC = (await loadSocialCalc()) as SocialCalcHarness;
    if (SC.Formula?.SheetCache) {
        SC.Formula.SheetCache.waitingForLoading = null;
    }
});

describe("sheet-qualified command regressions (Leanstral SheetQualifiedCommands)", () => {
    test("insertcol rewrites only unqualified current-sheet refs, not sheet-qualified refs, including names", async () => {
        const SC = (await loadSocialCalc()) as SocialCalcHarness;
        installEditorMock(SC);
        const sheet = new SC.Sheet();
        await scheduleCommands(SC, sheet, [
            "set A1 value n 1",
            "set B1 value n 2",
            "set C1 formula Sheet2!B1+B1",
            "name define MIXED =Sheet2!B1+B1",
        ]);

        await scheduleCommands(SC, sheet, ["insertcol B"]);

        expect(sheet.cells.D1?.formula).toBe("SHEET2!B1+C1");
        expect(sheet.names.MIXED.definition).toBe("=SHEET2!B1+C1");
        expect(sheet.cells.C1?.datavalue).toBe(2);
        expect(sheet.attribs.lastcol).toBe(4);

        await sheetUndo(SC, sheet);
        expect(sheet.cells.C1?.formula).toBe("SHEET2!B1+B1");
        expect(sheet.names.MIXED.definition).toBe("=SHEET2!B1+B1");
        expect(sheet.attribs.lastcol).toBe(3);

        await sheetRedo(SC, sheet);
        expect(sheet.cells.D1?.formula).toBe("SHEET2!B1+C1");
        expect(sheet.names.MIXED.definition).toBe("=SHEET2!B1+C1");
        expect(sheet.attribs.lastcol).toBe(4);
    });

    test("deletecol turns deleted local refs into #REF! while preserving same coordinate on referenced sheet", async () => {
        const SC = (await loadSocialCalc()) as SocialCalcHarness;
        installEditorMock(SC);
        const sheet = new SC.Sheet();
        await scheduleCommands(SC, sheet, [
            "set A1 value n 1",
            "set B1 value n 2",
            "set C1 value n 3",
            "set D1 formula Sheet2!B1+B1+C1",
            "name define MIXED =Sheet2!B1+B1+C1",
        ]);

        await scheduleCommands(SC, sheet, ["deletecol B"]);

        expect(sheet.cells.B1?.datavalue).toBe(3);
        expect(sheet.cells.C1?.formula).toBe("SHEET2!B1+#REF!+B1");
        expect(sheet.names.MIXED.definition).toBe("=SHEET2!B1+#REF!+B1");
        expect(sheet.attribs.lastcol).toBe(3);

        await sheetUndo(SC, sheet);
        expect(sheet.cells.D1?.formula).toBe("Sheet2!B1+B1+C1");
        expect(sheet.names.MIXED.definition).toBe("=Sheet2!B1+B1+C1");
        expect(sheet.attribs.lastcol).toBe(4);

        await sheetRedo(SC, sheet);
        expect(sheet.cells.C1?.formula).toBe("SHEET2!B1+#REF!+B1");
        expect(sheet.names.MIXED.definition).toBe("=SHEET2!B1+#REF!+B1");
        expect(sheet.attribs.lastcol).toBe(3);
    });

    test("deleterow preserves sheet-qualified range endpoints while current-sheet range endpoints delete and shift", async () => {
        const SC = (await loadSocialCalc()) as SocialCalcHarness;
        installEditorMock(SC);
        const sheet = new SC.Sheet();
        await scheduleCommands(SC, sheet, [
            "set A1 value n 1",
            "set A2 value n 2",
            "set A3 value n 3",
            "set B4 formula SUM(Sheet2!A2:A3)+SUM(A2:A3)",
            "name define ROWMIX =SUM(Sheet2!A2:A3)+SUM(A2:A3)",
        ]);

        await scheduleCommands(SC, sheet, ["deleterow 2"]);

        expect(sheet.cells.A2?.datavalue).toBe(3);
        expect(sheet.cells.B3?.formula).toBe("SUM(SHEET2!A2:A3)+SUM(#REF!:A2)");
        expect(sheet.names.ROWMIX.definition).toBe("=SUM(SHEET2!A2:A3)+SUM(#REF!:A2)");
        expect(sheet.attribs.lastrow).toBe(3);

        await sheetUndo(SC, sheet);
        expect(sheet.cells.B4?.formula).toBe("SUM(Sheet2!A2:A3)+SUM(A2:A3)");
        expect(sheet.names.ROWMIX.definition).toBe("=SUM(Sheet2!A2:A3)+SUM(A2:A3)");
        expect(sheet.attribs.lastrow).toBe(4);

        await sheetRedo(SC, sheet);
        expect(sheet.cells.B3?.formula).toBe("SUM(SHEET2!A2:A3)+SUM(#REF!:A2)");
        expect(sheet.names.ROWMIX.definition).toBe("=SUM(SHEET2!A2:A3)+SUM(#REF!:A2)");
        expect(sheet.attribs.lastrow).toBe(3);
    });
});