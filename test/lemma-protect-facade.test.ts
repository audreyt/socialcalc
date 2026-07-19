import { describe, expect, test } from "vite-plus/test";

import { isCellEditable, isSheetProtected } from "../lemma/protect";
import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

describe("lemma/protect editability truth table (Dafny/Lean surface)", () => {
  test("isSheetProtected is identity on the boolean attribute", () => {
    expect(isSheetProtected(true)).toBe(true);
    expect(isSheetProtected(false)).toBe(false);
  });

  test("readonly always blocks, independent of protection or unlocked state", () => {
    expect(isCellEditable(false, true, false)).toBe(false);
    expect(isCellEditable(false, true, true)).toBe(false);
    expect(isCellEditable(true, true, false)).toBe(false);
    expect(isCellEditable(true, true, true)).toBe(false);
  });

  test("unprotected sheet: only readonly gates, unlocked flag is irrelevant", () => {
    expect(isCellEditable(false, false, false)).toBe(true);
    expect(isCellEditable(false, false, true)).toBe(true);
  });

  test("protected sheet: non-readonly cell editable only when explicitly unlocked", () => {
    expect(isCellEditable(true, false, false)).toBe(false);
    expect(isCellEditable(true, false, true)).toBe(true);
  });

  test("exhaustive 3-variable truth table matches the eight documented rows", () => {
    const rows: Array<[boolean, boolean, boolean, boolean]> = [
      [false, false, false, true],
      [false, false, true, true],
      [false, true, false, false],
      [false, true, true, false],
      [true, false, false, false],
      [true, false, true, true],
      [true, true, false, false],
      [true, true, true, false],
    ];
    for (const [sheetProtected, cellReadonly, cellUnlocked, expected] of rows) {
      expect(isCellEditable(sheetProtected, cellReadonly, cellUnlocked)).toBe(expected);
    }
  });
});

describe("lemma/protect vs shipping SocialCalc.IsCellEditable", () => {
  test("facade matches shipping IsCellEditable across sheet/readonly/unlocked combinations", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);

    const combos: Array<[boolean, boolean, boolean]> = [
      [false, false, false],
      [false, false, true],
      [false, true, false],
      [false, true, true],
      [true, false, false],
      [true, false, true],
      [true, true, false],
      [true, true, true],
    ];

    for (const [sheetProtected, cellReadonly, cellUnlocked] of combos) {
      sheet.attribs.protected = sheetProtected ? "yes" : undefined;
      const cell = sheet.GetAssuredCell("A1");
      cell.readonly = cellReadonly;
      cell.unlocked = cellUnlocked ? "y" : "";

      const expected = isCellEditable(sheetProtected, cellReadonly, cellUnlocked);
      expect(SC.IsCellEditable(sheet, "A1")).toBe(expected);
    }
  });

  test("shipping IsSheetProtected matches facade isSheetProtected for yes/no/absent attrib", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    expect(SC.IsSheetProtected(sheet)).toBe(isSheetProtected(false));
    sheet.attribs.protected = "yes";
    expect(SC.IsSheetProtected(sheet)).toBe(isSheetProtected(true));
    sheet.attribs.protected = "no";
    expect(SC.IsSheetProtected(sheet)).toBe(isSheetProtected(false));
  });
});
