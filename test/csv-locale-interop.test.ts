import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

describe("UTF-8 BOM stripping on CSV/TSV import", () => {
  test("leading BOM is stripped from csv input, identical save to unprefixed input", async () => {
    const SC = await loadSocialCalc();
    const withBom = SC.ConvertOtherFormatToSave("\uFEFFname,score\nAda,42\n", "csv");
    const withoutBom = SC.ConvertOtherFormatToSave("name,score\nAda,42\n", "csv");
    expect(withBom).toBe(withoutBom);
  });

  test("leading BOM is stripped from tab input", async () => {
    const SC = await loadSocialCalc();
    const withBom = SC.ConvertOtherFormatToSave("\uFEFFa\tb\n1\t2\n", "tab");
    const withoutBom = SC.ConvertOtherFormatToSave("a\tb\n1\t2\n", "tab");
    expect(withBom).toBe(withoutBom);
  });

  test("BOM is stripped from csv-eu input too", async () => {
    const SC = await loadSocialCalc();
    const withBom = SC.ConvertOtherFormatToSave("\uFEFF1;2\n", "csv-eu");
    const withoutBom = SC.ConvertOtherFormatToSave("1;2\n", "csv-eu");
    expect(withBom).toBe(withoutBom);
  });

  test("a non-BOM leading character is left completely untouched (only U+FEFF strips)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("xhello,2\n", "csv"));
    expect(sheet.GetAssuredCell("A1").datavalue).toBe("xhello");
  });

  test("an unrecognized import format (not scsave/csv/tab/csv-eu) returns an empty string", async () => {
    const SC = await loadSocialCalc();
    expect(SC.ConvertOtherFormatToSave("1,2,3", "foo")).toBe("");
  });
});

describe("csv-eu locale variant: ';' delimiter + ',' decimal, no autodetection", () => {
  test("comma-decimal number parses correctly: '1234,56' -> 1234.56", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("1234,56", "csv-eu"));
    const cell = sheet.GetAssuredCell("A1");
    expect(cell.datavalue).toBe(1234.56);
    expect(cell.datatype).toBe("v");
    expect(cell.valuetype).toBe("n");
  });

  test("dot-grouping-only number is NOT misread as a decimal: '1.234' -> 1234, not 1.234", async () => {
    // This is the deliberately-rejected "rightmost separator wins" heuristic case:
    // under a fixed EU locale, a lone "." with no "," present is ALWAYS thousands
    // grouping, never a decimal point.
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("1.234", "csv-eu"));
    expect(sheet.GetAssuredCell("A1").datavalue).toBe(1234);
  });

  test("multi-group dot + comma decimal: '1.234.567,89' -> 1234567.89", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("1.234.567,89", "csv-eu"));
    expect(sheet.GetAssuredCell("A1").datavalue).toBe(1234567.89);
  });

  test("semicolon is the field delimiter, not comma", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("1;2;3", "csv-eu"));
    expect(sheet.GetAssuredCell("A1").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B1").datavalue).toBe(2);
    expect(sheet.GetAssuredCell("C1").datavalue).toBe(3);
  });

  test("comma-decimal percent preserves original locale text for re-editing (datatype 'c')", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("15,1%", "csv-eu"));
    const cell = sheet.GetAssuredCell("A1");
    expect(cell.datatype).toBe("c");
    expect(cell.valuetype).toBe("n%");
    expect(cell.datavalue).toBeCloseTo(0.151, 10);
    expect(cell.formula).toBe("15,1%");
    // display renders the same as a non-locale percent (valuetype+datavalue driven)
    expect(SC.FormatValueForDisplay(sheet, cell.datavalue, "A1")).toBe("15.1%");
  });

  test("a comma-bearing token that fails EU-locale parse becomes text, never silently reinterpreted under US-locale rules", async () => {
    const SC = await loadSocialCalc();
    // "1,2,3" is malformed under EU comma-decimal rules (two decimal points
    // after grouping-strip). It must NOT fall through to DetermineValueType's
    // US-locale comma-thousands regex (which would otherwise silently
    // reinterpret it as the grouped integer 123 -- a cross-locale
    // reinterpretation, not an honest rejection).
    const rejected = SC.ParseLocaleNumericToken("1,2,3", ",");
    expect(rejected.ok).toBe(false);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("1,2,3", "csv-eu"));
    const cell = sheet.GetAssuredCell("A1");
    expect(cell.datatype).toBe("t");
    expect(cell.datavalue).toBe("1,2,3");
  });

  test("a non-numeric-shaped token (letters) is unambiguously text end-to-end", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("abc,2", "csv-eu"));
    const cell = sheet.GetAssuredCell("A1");
    expect(cell.datatype).toBe("t");
    expect(cell.datavalue).toBe("abc,2");
  });

  test("comma-free tokens still fall through to DetermineValueType (dates, plain text unaffected)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // ISO date is locale-independent (no navigator.language branch, unlike
    // slash-form dates), so this assertion is stable across environments.
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("2024-12-31;abc", "csv-eu"));
    // "2024-12-31" has no comma -> the EU-locale guard does not intercept it,
    // it falls through to the ordinary DetermineValueType ISO-date branch.
    expect(sheet.GetAssuredCell("A1").valuetype).toBe("nd");
    expect(sheet.GetAssuredCell("A1").datavalue).toBeGreaterThan(0);
    // "abc" has no comma either -> falls through to DetermineValueType, plain text.
    const cellB = sheet.GetAssuredCell("B1");
    expect(cellB.datatype).toBe("t");
    expect(cellB.datavalue).toBe("abc");
  });

  test("legacy default 'csv' format is completely unaffected by the csv-eu addition", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // "1,234.50" under default csv: comma is the field delimiter (legacy DetermineValueType
    // ALSO recognizes comma-grouped numbers when the WHOLE unsplit field looks like
    // "1,234.50" -- but the CSV parser splits on "," first, so this becomes two cells).
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave("1,234.50", "csv"));
    expect(sheet.GetAssuredCell("A1").datavalue).toBe(1);
    expect(sheet.GetAssuredCell("B1").datavalue).toBe(234.5);
  });

  test("legacy 'csv' quoted-comma-decimal field is unaffected: quoting still protects commas", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(SC.ConvertOtherFormatToSave('"1,234.50"', "csv"));
    const cell = sheet.GetAssuredCell("A1");
    // DetermineValueType recognizes the whole quoted field as a comma-grouped number
    expect(cell.datavalue).toBe(1234.5);
  });
});

describe("csv-excel / tab-excel Windows/Excel-friendly export variant", () => {
  const FIXTURE_SAVE = "cell:A1:t:hello\ncell:B1:v:42\nsheet:c:2:r:1\n";

  test("csv-excel adds a leading BOM and uses CRLF row terminators", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(FIXTURE_SAVE);
    const exported = SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "csv-excel");
    expect(exported.charCodeAt(0)).toBe(0xfeff);
    expect(exported).toContain("\r\n");
    expect(exported.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")).toBe(
      SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "csv"),
    );
  });

  test("tab-excel adds a leading BOM and uses CRLF row terminators", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(FIXTURE_SAVE);
    const exported = SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "tab-excel");
    expect(exported.charCodeAt(0)).toBe(0xfeff);
    expect(exported).toContain("\r\n");
  });

  test("default 'csv' output byte-for-byte matches pre-existing behavior: no BOM, LF only", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(FIXTURE_SAVE);
    const save = sheet.CreateSheetSave();
    const exported = SC.ConvertSaveToOtherFormat(save, "csv");
    expect(exported.charCodeAt(0)).not.toBe(0xfeff);
    expect(exported).not.toContain("\r\n");
    expect(exported).toBe("hello,42\n");
  });

  test("default 'tab' output byte-for-byte matches pre-existing behavior: no BOM, LF only", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(FIXTURE_SAVE);
    const exported = SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "tab");
    expect(exported.charCodeAt(0)).not.toBe(0xfeff);
    expect(exported).not.toContain("\r\n");
    expect(exported).toBe("hello\t42\n");
  });
});
