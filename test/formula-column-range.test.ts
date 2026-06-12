import { expect, test } from "bun:test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

test("SUM over whole columns whose letters collide with N() and T()", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    await scheduleCommands(
        SC,
        sheet,
        [
            "set N1 value n 1",
            "set N2 value n 2",
            "set N3 value n 3",
            "set T1 value n 10",
            "set T2 value n 20",
            "set A1 formula SUM(N:N)",
            "set A2 formula SUM(T:T)",
            "set A3 formula SUM(B:B)",
        ],
        true,
        3000,
    );
    await recalcSheet(SC, sheet, 3000);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(6);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(30);
    expect(sheet.GetAssuredCell("A3").datavalue).toBe(0);
    expect(String(sheet.GetAssuredCell("A1").datavalue)).not.toContain("Incorrect");
});

test("N() with no arguments still errors", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    await scheduleCommands(SC, sheet, ["set A1 formula N()"], true, 3000);
    await recalcSheet(SC, sheet, 3000);

    const cell = sheet.GetAssuredCell("A1");
    expect(String(cell.datavalue)).toContain("Incorrect arguments to function N");
});

test("N(A1) still evaluates as the N() function", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    await scheduleCommands(
        SC,
        sheet,
        ['set A1 text t hello', "set B1 formula N(A1)"],
        true,
        3000,
    );
    await recalcSheet(SC, sheet, 3000);

    expect(sheet.GetAssuredCell("B1").datavalue).toBe(0);
    expect(sheet.GetAssuredCell("B1").valuetype).toBe("n");
});