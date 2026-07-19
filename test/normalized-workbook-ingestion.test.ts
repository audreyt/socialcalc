import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

describe("normalized-workbook ingestion seam: single sheet", () => {
  test("values, formulas, bold/align styles, comments, and named ranges round-trip", async () => {
    const SC = await loadSocialCalc();
    const normalizedSheet = {
      name: "Budget",
      cells: {
        A1: { value: "Item", bold: true },
        B1: { value: "Amount", bold: true, align: "right" as const },
        A2: { value: "Rent" },
        B2: { value: 1200 },
        A3: { value: "Total", comment: "sum of all rows" },
        B3: { formula: "SUM(B2:B2)" },
      },
      names: { TOTAL: "B3" },
    };

    const save = SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);

    // Named range resolves through the real formula engine.
    const lookup = SC.Formula.LookupName(sheet, "TOTAL");
    expect(lookup).toEqual({ value: "B3", type: "coord" });

    // Formula cell recalculates to the correct value.
    sheet.RecalcSheet();
    let iterations = 0;
    while (SC.RecalcInfo.currentState !== SC.RecalcInfo.state.idle && iterations < 1000) {
      SC.RecalcTimerRoutine();
      iterations++;
    }
    const b3 = sheet.GetAssuredCell("B3");
    expect(b3.datatype).toBe("f");
    expect(b3.datavalue).toBe(1200);

    // Styles survived with proper interning.
    const a1 = sheet.GetAssuredCell("A1");
    const b1 = sheet.GetAssuredCell("B1");
    expect(sheet.GetStyleString("font", a1.font)).toBe("normal bold * *");
    expect(sheet.GetStyleString("cellformat", b1.cellformat)).toBe("right");

    // Comment survived.
    expect(sheet.GetAssuredCell("A3").comment).toBe("sum of all rows");

    // Idempotent re-save/re-parse.
    const resave = sheet.CreateSheetSave();
    const sheet2 = new SC.Sheet();
    sheet2.ParseSheetSave(resave);
    expect(sheet2.GetAssuredCell("A1").datavalue).toBe("Item");
    expect(sheet2.names.TOTAL).toEqual({ desc: "", definition: "B3" });
  });

  test("shared bold+italic style combination is deduplicated to one font-table slot", async () => {
    const SC = await loadSocialCalc();
    const normalizedSheet = {
      cells: {
        A1: { value: "x", bold: true },
        B1: { value: "y", bold: true },
        C1: { value: "z", bold: true, italic: true },
      },
    };
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet));
    const a1 = sheet.GetAssuredCell("A1");
    const b1 = sheet.GetAssuredCell("B1");
    const c1 = sheet.GetAssuredCell("C1");
    expect(a1.font).toBe(b1.font); // deduped: identical {bold:true} shares one slot
    expect(c1.font).not.toBe(a1.font); // different combination gets its own slot
  });

  test("malformed coord/name keys are skipped, never abort the whole sheet, and are reported", async () => {
    const SC = await loadSocialCalc();
    const normalizedSheet = {
      cells: {
        A1: { value: "ok" },
        "bad coord": { value: "skip me" },
        AAA1: { value: "too many letters" },
      },
      names: {
        VALID: "A1",
        "invalid name!": "A1",
      },
    };
    const skipped: string[] = [];
    const save = SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet, skipped);
    expect(skipped.sort()).toEqual(["cell:AAA1", "cell:bad coord", "name:invalid name!"]);

    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.GetAssuredCell("A1").datavalue).toBe("ok");
    expect(sheet.names.VALID).toBeDefined();
    expect(sheet.names["INVALID NAME!"]).toBeUndefined();
  });

  test("a validly-formed name key with an empty-string definition is skipped and reported", async () => {
    const SC = await loadSocialCalc();
    const skipped: string[] = [];
    SC.CreateSheetSaveFromNormalizedSheet(
      { cells: { A1: { value: 1 } }, names: { EMPTY: "" } },
      skipped,
    );
    expect(skipped).toEqual(["name:EMPTY"]);
  });
  test("a null or non-object cell entry (host-adapter bug: coord key present, value is not a cell object) is skipped and reported", async () => {
    const SC = await loadSocialCalc();
    const skippedNull: string[] = [];
    SC.CreateSheetSaveFromNormalizedSheet(
      { cells: { A1: null as unknown as { value: number } } },
      skippedNull,
    );
    expect(skippedNull).toEqual(["cell:A1"]);

    const skippedString: string[] = [];
    SC.CreateSheetSaveFromNormalizedSheet(
      { cells: { A1: "not an object" as unknown as { value: number } } },
      skippedString,
    );
    expect(skippedString).toEqual(["cell:A1"]);
  });
  test("a cell with neither value nor formula is skipped and reported", async () => {
    const SC = await loadSocialCalc();
    const skipped: string[] = [];
    SC.CreateSheetSaveFromNormalizedSheet({ cells: { A1: {} } }, skipped);
    expect(skipped).toEqual(["cell:A1"]);
  });

  test("formulaSeparator ';' rewrites unquoted semicolons to commas before parsing", async () => {
    const SC = await loadSocialCalc();
    const normalizedSheet = {
      cells: { A1: { formula: "SUM(1;2;3)" } },
      formulaSeparator: ";" as const,
    };
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet));
    expect(sheet.GetAssuredCell("A1").formula).toBe("SUM(1,2,3)");
  });

  test("formulaSeparator ';' recalculates to the correct value (semicolons genuinely became argument separators)", async () => {
    const SC = await loadSocialCalc();
    const normalizedSheet = {
      cells: { A1: { formula: "SUM(1;2;3)" } },
      formulaSeparator: ";" as const,
    };
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet));
    sheet.RecalcSheet();
    let iterations = 0;
    while (SC.RecalcInfo.currentState !== SC.RecalcInfo.state.idle && iterations < 1000) {
      SC.RecalcTimerRoutine();
      iterations++;
    }
    expect(sheet.GetAssuredCell("A1").datavalue).toBe(6);
  });

  test("formulaSeparator ';' documented precondition: decimal-comma formulas are NOT supported and produce a demonstrably wrong result if violated", async () => {
    // This test exists to keep the documented precondition (js/socialcalc-3.ts's
    // "REQUIRED PRECONDITION" comment on the formulaSeparator branch) honest and
    // machine-checked, not just prose: a formula written with EU comma-decimals
    // ("SUM(1,5;2,5)", intending 1.5+2.5=4) under formulaSeparator:";" becomes
    // "SUM(1,5,2,5)" -- FOUR arguments (1,5,2,5), summing to 13, not 4. This is
    // the exact, non-recoverable ambiguity the precondition documents: decimal
    // commas MUST already be normalized to dots by the host adapter before
    // calling this seam with formulaSeparator:";".
    const SC = await loadSocialCalc();
    const inContract = {
      cells: { A1: { formula: "SUM(1.5;2.5)" } }, // decimals already "." -- respects the precondition
      formulaSeparator: ";" as const,
    };
    const outOfContract = {
      cells: { A1: { formula: "SUM(1,5;2,5)" } }, // decimals still "," -- VIOLATES the precondition
      formulaSeparator: ";" as const,
    };

    async function recalcA1(normalizedSheet: typeof inContract) {
      const sheet = new SC.Sheet();
      sheet.ParseSheetSave(SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet));
      sheet.RecalcSheet();
      let iterations = 0;
      while (SC.RecalcInfo.currentState !== SC.RecalcInfo.state.idle && iterations < 1000) {
        SC.RecalcTimerRoutine();
        iterations++;
      }
      return sheet.GetAssuredCell("A1").datavalue;
    }

    expect(await recalcA1(inContract)).toBe(4);
    // Demonstrably wrong under contract violation -- proves the precondition is
    // real and its failure mode is exactly as documented (silent 4-argument
    // reparse), not a hypothetical.
    expect(await recalcA1(outOfContract)).toBe(13);
  });

  test("formulaSeparator ';' leaves a quoted semicolon (string literal) untouched", async () => {
    const SC = await loadSocialCalc();
    const normalizedSheet = {
      cells: { A1: { formula: 'TEXTJOIN(";",TRUE,"a;b",C1)' } },
      formulaSeparator: ";" as const,
    };
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet));
    // Already-comma formulas with a quoted ";" argument are unaffected: the ";" separator
    // between top-level args in this example is already ",", so nothing outside quotes changes.
    expect(sheet.GetAssuredCell("A1").formula).toBe('TEXTJOIN(";",TRUE,"a;b",C1)');
  });

  test("formulaSeparator omitted (default) leaves every formula completely unaffected", async () => {
    const SC = await loadSocialCalc();
    const normalizedSheet = { cells: { A1: { formula: "SUM(A2,A3)" } } };
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.CreateSheetSaveFromNormalizedSheet(normalizedSheet));
    expect(sheet.GetAssuredCell("A1").formula).toBe("SUM(A2,A3)");
  });
});

describe("normalized-workbook ingestion seam: multiple sheets", () => {
  test("returns one save string per sheet keyed by de-duplicated names", async () => {
    const SC = await loadSocialCalc();
    const workbook = {
      sheets: [
        { name: "Budget", cells: { A1: { value: "first" } } },
        { name: "Budget", cells: { A1: { value: "second" } } },
        { cells: { A1: { value: "third, unnamed" } } },
      ],
    };
    const result = SC.CreateSpreadsheetSaveFromNormalizedWorkbook(workbook);
    expect(result.sheetNames).toEqual(["Budget", "Budget (2)", "Sheet3"]);
    expect(Object.keys(result.sheetSaves).sort()).toEqual(
      ["Budget", "Budget (2)", "Sheet3"].sort(),
    );

    const sheet1 = new SC.Sheet();
    sheet1.ParseSheetSave(result.sheetSaves.Budget);
    expect(sheet1.GetAssuredCell("A1").datavalue).toBe("first");

    const sheet2 = new SC.Sheet();
    sheet2.ParseSheetSave(result.sheetSaves["Budget (2)"]);
    expect(sheet2.GetAssuredCell("A1").datavalue).toBe("second");
  });

  test("empty/missing sheets array returns empty result", async () => {
    const SC = await loadSocialCalc();
    expect(SC.CreateSpreadsheetSaveFromNormalizedWorkbook({ sheets: [] })).toEqual({
      sheetNames: [],
      sheetSaves: {},
    });
  });

  test("workbook with no sheets property at all (|| fallback) returns empty result", async () => {
    const SC = await loadSocialCalc();
    const untyped = SC.CreateSpreadsheetSaveFromNormalizedWorkbook as (wb: unknown) => {
      sheetNames: string[];
      sheetSaves: { [name: string]: string };
    };
    expect(untyped({})).toEqual({ sheetNames: [], sheetSaves: {} });
  });
});

describe("ParseLocaleNumericToken edge cases", () => {
  test("invalid decimalChar (not '.' or ',') returns ok:false immediately", async () => {
    const SC = await loadSocialCalc();
    expect(SC.ParseLocaleNumericToken("123", "x")).toEqual({ ok: false, value: 0, percent: false });
  });

  test("a token that passes the shape regex but yields NaN (e.g. '+') returns ok:false", async () => {
    const SC = await loadSocialCalc();
    // "+" matches /^[-+]?[0-9.,]+$/ but "-0" is 0 (not NaN), so test with ".":
    // "." matches the regex but split-then-join gives "." which is NaN.
    expect(SC.ParseLocaleNumericToken(".", ".").ok).toBe(false);
  });

  test("default-mode (decimalChar '.') correctly parses US-locale numbers", async () => {
    const SC = await loadSocialCalc();
    expect(SC.ParseLocaleNumericToken("1,234.56", ".")).toEqual({
      ok: true,
      value: 1234.56,
      percent: false,
    });
    expect(SC.ParseLocaleNumericToken("50%", ".")).toEqual({ ok: true, value: 0.5, percent: true });
  });
});

describe("CreateSheetSaveFromNormalizedSheet without skipped parameter (falsy guard branches)", () => {
  test("malformed coord key is silently skipped when skipped is not passed", async () => {
    const SC = await loadSocialCalc();
    // No skipped argument -> `if (skipped) skipped.push(...)` false side on invalid coord.
    const save = SC.CreateSheetSaveFromNormalizedSheet({
      cells: { "bad-coord": { value: 1 }, A1: { value: 2 } },
    });
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.GetAssuredCell("A1").datavalue).toBe(2);
  });

  test("cell with neither value nor formula is silently skipped when skipped is not passed", async () => {
    const SC = await loadSocialCalc();
    // No skipped argument -> `if (skipped) skipped.push(...)` false side on no-content cell.
    SC.CreateSheetSaveFromNormalizedSheet({ cells: { A1: {} } });
    // No assertion needed beyond not throwing -- the cell is skipped.
  });

  test("null/non-object cell entry is silently skipped when skipped is not passed (7805 branch)", async () => {
    const SC = await loadSocialCalc();
    // No skipped argument -> `if (skipped) skipped.push(...)` false side on null ndata.
    const save = SC.CreateSheetSaveFromNormalizedSheet({
      cells: { A1: null as unknown as { value: number }, B1: { value: 1 } },
    });
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.GetAssuredCell("B1").datavalue).toBe(1);
  });

  test("italic-only cell (no bold) exercises the bold-false ternary side", async () => {
    const SC = await loadSocialCalc();
    const save = SC.CreateSheetSaveFromNormalizedSheet({
      cells: { A1: { value: "italic", italic: true } },
    });
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    const fontStr = sheet.GetStyleString("font", sheet.GetAssuredCell("A1").font);
    expect(fontStr).toContain("italic");
    expect(fontStr).toContain("normal"); // font-weight is "normal" (bold=false)
  });

  test("normalizedSheet with no cells property exercises the || fallback (7797 branch)", async () => {
    const SC = await loadSocialCalc();
    const untyped = SC.CreateSheetSaveFromNormalizedSheet as (ns: unknown) => string;
    const save = untyped({}); // no .cells property -> || fallback to {}
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    // An empty sheet (no cells) still has default lastcol=1, lastrow=1
    // from CreateSheetSave's sheet:c:1:r:1 line.
    expect(sheet.attribs.lastcol).toBe(1);
    expect(sheet.attribs.lastrow).toBe(1);
  });

  test("invalid name key is silently skipped when skipped is not passed", async () => {
    const SC = await loadSocialCalc();
    // No skipped argument -> `if (skipped) skipped.push(...)` false side on invalid name.
    const save = SC.CreateSheetSaveFromNormalizedSheet({
      cells: { A1: { value: 1 } },
      names: { "bad name!": "A1" },
    });
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.names["BAD NAME"]).toBeUndefined();
  });

  test("empty-string name definition is silently skipped when skipped is not passed", async () => {
    const SC = await loadSocialCalc();
    // No skipped argument -> `if (skipped) skipped.push(...)` false side on empty name def.
    const save = SC.CreateSheetSaveFromNormalizedSheet({
      cells: { A1: { value: 1 } },
      names: { EMPTY: "" },
    });
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.names.EMPTY).toBeUndefined();
  });
});
