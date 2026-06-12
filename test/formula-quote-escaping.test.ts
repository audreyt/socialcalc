import { expect, test } from "bun:test";

import {
    loadSocialCalc,
    recalcSheet,
    scheduleCommands,
} from "./helpers/socialcalc";

/** Formula from ethercalc #493 / #512 — VB-style "" quotes inside strings. */
const HTML_IF_FORMULA =
    '=IF(B4=TODAY(),"<span style=""background-color:rgb(81,184,72);color:rgb(81,184,72)"">_______</span>","")';

const EXPECTED_OFFSET =
    '=IF(B5=TODAY(),"<span style=""background-color:rgb(81,184,72);color:rgb(81,184,72)"">_______</span>","")';

test("OffsetFormulaCoords doubles every embedded quote in string literals (#493, #512)", async () => {
    const SC = await loadSocialCalc();
    const result = SC.OffsetFormulaCoords(HTML_IF_FORMULA.slice(1), 0, 1);
    expect(result).toBe(EXPECTED_OFFSET.slice(1));
});

test("AdjustFormulaCoords and ReplaceFormulaCoords preserve all doubled quotes", async () => {
    const SC = await loadSocialCalc();
    const inner = 'CONCATENATE("a""b""c",A1)';
    expect(SC.AdjustFormulaCoords(inner, 1, 0, 1, 0)).toBe('CONCATENATE("a""b""c",A1)');
    expect(SC.ReplaceFormulaCoords(inner, { A1: "B1" })).toBe('CONCATENATE("a""b""c",B1)');
});

test("filldown preserves HTML formula quotes across rows (#493)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        `set B4 formula TODAY()`,
        `set B5 formula TODAY()`,
        `set A4 formula ${HTML_IF_FORMULA.slice(1)}`,
    ]);
    await scheduleCommands(SC, sheet, ["filldown A4:A6 formulas"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.A5.formula).toBe(EXPECTED_OFFSET.slice(1));
    expect(sheet.cells.A6.formula).toBe(
        '=IF(B6=TODAY(),"<span style=""background-color:rgb(81,184,72);color:rgb(81,184,72)"">_______</span>","")'.slice(1),
    );
});

test("fillright preserves HTML formula quotes across columns (#493)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        `set B4 formula TODAY()`,
        `set C4 formula TODAY()`,
        `set D4 formula TODAY()`,
        `set A4 formula ${HTML_IF_FORMULA.slice(1)}`,
    ]);
    await scheduleCommands(SC, sheet, ["fillright A4:C4 formulas"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B4.formula).toBe(
        '=IF(C4=TODAY(),"<span style=""background-color:rgb(81,184,72);color:rgb(81,184,72)"">_______</span>","")'.slice(1),
    );
    expect(sheet.cells.C4.formula).toBe(
        '=IF(D4=TODAY(),"<span style=""background-color:rgb(81,184,72);color:rgb(81,184,72)"">_______</span>","")'.slice(1),
    );
});

test("paste offsets formula and keeps every string quote pair (#512)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        `set B4 formula TODAY()`,
        `set B6 formula TODAY()`,
        `set A4 formula ${HTML_IF_FORMULA.slice(1)}`,
    ]);
    await scheduleCommands(SC, sheet, ["copy A4", "paste A6 formulas"]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.A6.formula).toBe(
        '=IF(B6=TODAY(),"<span style=""background-color:rgb(81,184,72);color:rgb(81,184,72)"">_______</span>","")'.slice(1),
    );
});

test("https URLs with non-ASCII path segments render fully (#501)", async () => {
    const SC = await loadSocialCalc();
    const url = "https://www.linkedin.com/in/clémentine-delacroix";
    const typed = SC.DetermineValueType(url);
    expect(typed.type).toBe("tl");

    const html = SC.expand_text_link(url, new SC.Sheet(), null, "text-link");
    expect(html).toContain('href="https://www.linkedin.com/in/cl%C3%A9mentine-delacroix"');
    expect(html).toContain("clémentine-delacroix");
});