import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

const TEST_TMP_DIR = join(tmpdir(), "socialcalc-fods-test");
mkdirSync(TEST_TMP_DIR, { recursive: true });

const xmllintAvailable = spawnSync("xmllint", ["--version"], { encoding: "utf8" }).status === 0;

describe("XmlEscape", () => {
  test("escapes &, <, >, \", and '", async () => {
    const SC = await loadSocialCalc();
    expect(SC.XmlEscape(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });

  test("leaves ordinary text untouched", async () => {
    const SC = await loadSocialCalc();
    expect(SC.XmlEscape("hello world")).toBe("hello world");
  });
});

describe("TranslateFormulaToOpenFormula", () => {
  test("single coord reference", async () => {
    const SC = await loadSocialCalc();
    expect(SC.TranslateFormulaToOpenFormula("A1+1")).toEqual({ ok: true, text: "[.A1]+1" });
  });

  test("range reference becomes one bracketed reference", async () => {
    const SC = await loadSocialCalc();
    expect(SC.TranslateFormulaToOpenFormula("SUM(A1:B2)")).toEqual({
      ok: true,
      text: "SUM([.A1:.B2])",
    });
  });

  test("comma argument separator becomes ';' (OpenFormula canonical separator)", async () => {
    const SC = await loadSocialCalc();
    expect(SC.TranslateFormulaToOpenFormula("IF(A1,B1,C1)")).toEqual({
      ok: true,
      text: "IF([.A1];[.B1];[.C1])",
    });
  });

  test("string literals are re-quoted with doubled internal quotes", async () => {
    const SC = await loadSocialCalc();
    expect(SC.TranslateFormulaToOpenFormula('CONCATENATE("a","b")')).toEqual({
      ok: true,
      text: 'CONCATENATE("a";"b")',
    });
  });

  test("sheet-qualified formulas are explicitly not translated", async () => {
    const SC = await loadSocialCalc();
    const result = SC.TranslateFormulaToOpenFormula("Sheet1!A1+1");
    expect(result.ok).toBe(false);
  });

  test("absolute markers are preserved on translated coords", async () => {
    const SC = await loadSocialCalc();
    expect(SC.TranslateFormulaToOpenFormula("$A$1+B2")).toEqual({
      ok: true,
      text: "[.$A$1]+[.B2]",
    });
  });

  test("a ':' operator not adjacent to two coords (full-column range name N:N) passes through unchanged", async () => {
    const SC = await loadSocialCalc();
    expect(SC.TranslateFormulaToOpenFormula("N:N")).toEqual({ ok: true, text: "N:N" });
  });

  test("a non-string formula that throws inside the tokenizer (null/undefined) reports ok:false instead of propagating", async () => {
    const SC = await loadSocialCalc();
    const untyped = SC.TranslateFormulaToOpenFormula as (formula: unknown) => {
      ok: boolean;
      text: string;
    };
    // null/undefined throw inside ParseFormulaIntoTokens (accessing .length
    // on a null `line` variable) -- caught and reported as ok:false.
    expect(untyped(null)).toEqual({ ok: false, text: "" });
    expect(untyped(undefined)).toEqual({ ok: false, text: "" });
  });
});

describe("CreateFodsFromNormalizedWorkbook: XML well-formedness and content", () => {
  // No DOMParser exists in this Node test environment (confirmed:
  // `new DOMParser()` throws ReferenceError here, it is not a stubbed
  // fake-DOM that would silently no-op) -- well-formedness is checked with
  // the real `xmllint --noout` binary (same tool used to hand-verify this
  // exporter's output during development, including a full LibreOffice
  // 26.2.4.2 `--convert-to fods` round-trip that confirmed the emitted
  // table:formula, office:value, office:annotation ordering, and
  // table:named-range/table:base-cell-address/table:cell-range-address
  // values are all genuinely valid, not just well-formed XML).
  function assertWellFormed(xml: string) {
    if (!xmllintAvailable) return; // environment lacks xmllint; content assertions still run
    const file = join(
      TEST_TMP_DIR,
      `socialcalc-fods-test-${process.pid}-${Math.random().toString(36).slice(2)}.fods`,
    );
    writeFileSync(file, xml);
    try {
      const result = spawnSync("xmllint", ["--noout", file], { encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
    } finally {
      rmSync(file, { force: true });
    }
  }

  test("produces well-formed XML with the ODF flat mimetype (xmllint-verified)", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "Sheet1", cells: { A1: { value: "hello" } } }],
    });
    expect(fods.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(fods).toContain('office:mimetype="application/vnd.oasis.opendocument.spreadsheet"');
    assertWellFormed(fods);
  });

  test("xmllint genuinely rejects malformed XML (sanity check for the assertWellFormed helper itself)", () => {
    const file = join(TEST_TMP_DIR, `socialcalc-fods-broken-${process.pid}.fods`);
    writeFileSync(file, "<a><b></a>"); // deliberately unbalanced
    try {
      const result = spawnSync("xmllint", ["--noout", file], { encoding: "utf8" });
      expect(result.status).not.toBe(0);
    } finally {
      rmSync(file, { force: true });
    }
  });

  test("emits numeric and text cell values with correct office:value-type", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: "text cell" }, A2: { value: 42.5 } } }],
    });
    expect(fods).toContain('office:value-type="string"');
    expect(fods).toContain('office:value-type="float" office:value="42.5"');
  });

  test("formula cells emit table:formula with the translated OpenFormula text and cached value", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [
        { name: "S1", cells: { B2: { value: 5 }, B3: { formula: "SUM(B2:B2)", value: 5 } } },
      ],
    });
    expect(fods).toContain('table:formula="of:=SUM([.B2:.B2])"');
    expect(fods).toContain('office:value="5"');
  });

  test("a formula with no cached value and no translatable form degrades to visible text, not silent loss", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { formula: "Sheet2!A1" } } }],
    });
    // Sheet-qualified formula is untranslatable and has no ndata.value cached ->
    // must NOT silently disappear; falls back to the raw formula text as a string cell.
    expect(fods).toContain("=Sheet2!A1");
    expect(fods).not.toContain("table:formula");
  });

  test("a translatable formula with NO cached value still emits table:formula, with empty cell content", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { formula: "SUM(B1:B2)" } } }],
    });
    expect(fods).toContain('table:formula="of:=SUM([.B1:.B2])"');
    // No office:value/office:value-type since no ndata.value was supplied.
    expect(fods).not.toContain('table:formula="of:=SUM([.B1:.B2])" office:value');
    expect(fods).toContain('table:formula="of:=SUM([.B1:.B2])"><text:p></text:p>');
  });

  test("an untranslatable formula WITH a cached value exports the value, no table:formula", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { formula: "Sheet2!A1", value: 99 } } }],
    });
    expect(fods).toContain('office:value-type="float" office:value="99"');
    expect(fods).not.toContain("table:formula");
    expect(fods).not.toContain("=Sheet2!A1"); // value takes priority, raw formula text not emitted
  });

  test("bold/italic/align cell styling is deduplicated into shared style definitions", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [
        {
          name: "S1",
          cells: {
            A1: { value: "a", bold: true },
            A2: { value: "b", bold: true },
            A3: { value: "c", align: "right" },
          },
        },
      ],
    });
    assertWellFormed(fods);
    const styleNames = [...fods.matchAll(/<style:style style:name="(ce\d+)"/g)].map((m) => m[1]);
    // Exactly 2 distinct auto styles: one for {bold:true}, one for {align:right}
    // (deduped -- A1 and A2 share the SAME style).
    expect(new Set(styleNames).size).toBe(2);
    // 3 cells each reference a style, but only 2 DISTINCT style names among
    // them -- A1 and A2 share the identical name (dedup proof, not just a
    // definition count).
    const cellStyleRefs = [...fods.matchAll(/table:style-name="(ce\d+)"/g)].map((m) => m[1]);
    expect(cellStyleRefs.length).toBe(3); // one style-name attribute per styled cell
    expect(new Set(cellStyleRefs).size).toBe(2); // only 2 distinct names among them
    expect(cellStyleRefs[0]).toBe(cellStyleRefs[1]); // A1 and A2 share the SAME name
    expect(cellStyleRefs[2]).not.toBe(cellStyleRefs[0]); // A3 has its own
  });

  test("italic-only cell style (no bold) produces a distinct style with font-style italic, font-weight normal", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [
        {
          name: "S1",
          cells: {
            A1: { value: "a", bold: true },
            A2: { value: "b", italic: true },
          },
        },
      ],
    });
    assertWellFormed(fods);
    // Two distinct styles: {bold:true} and {italic:true} -- different key, different style.
    const styleNames = [...fods.matchAll(/<style:style style:name="(ce\d+)"/g)].map((m) => m[1]);
    expect(new Set(styleNames).size).toBe(2);
    // The italic-only style has font-style="italic" and font-weight="normal"
    expect(fods).toContain('fo:font-weight="normal"');
    expect(fods).toContain('style:font-style="italic"');
  });
  test("a sheet with no cells property emits an empty table:table (covers || fallback branches)", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "Empty" }],
    });
    assertWellFormed(fods);
    expect(fods).toContain('<table:table table:name="Empty">');
    expect(fods).toContain("</table:table>");
  });

  test("cell comments emit office:annotation BEFORE the content text:p (ODF child-order requirement)", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: "x", comment: "a note" } } }],
    });
    const annotationIndex = fods.indexOf("<office:annotation>");
    const textPIndex = fods.indexOf("<text:p>x</text:p>");
    expect(annotationIndex).toBeGreaterThan(-1);
    expect(annotationIndex).toBeLessThan(textPIndex);
    expect(fods).toContain("a note");
  });

  test("a numeric cell with a comment emits office:annotation before the numeric text:p", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 42, comment: "num note" } } }],
    });
    const annotationIndex = fods.indexOf("<office:annotation>");
    const textPIndex = fods.indexOf("<text:p>42</text:p>");
    expect(annotationIndex).toBeGreaterThan(-1);
    expect(annotationIndex).toBeLessThan(textPIndex);
    expect(fods).toContain("num note");
  });

  test("XML-special characters in values/comments/sheet names are escaped", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [
        {
          name: "Sheet & <1>",
          cells: { A1: { value: 'Notes & <tags> "quoted"', comment: "it's <ok>" } },
        },
      ],
    });
    assertWellFormed(fods);
    expect(fods).toContain("Sheet &amp; &lt;1&gt;");
    expect(fods).not.toContain("<tags>"); // raw unescaped tag must never appear
  });

  test("named ranges emit table:named-expressions AFTER the tables, with both range endpoints sheet-qualified", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [
        {
          name: "Budget",
          cells: { B2: { value: 1 }, B3: { value: 2 } },
          names: { TOTAL: "B2:B3", SINGLE: "B2" },
        },
      ],
    });
    assertWellFormed(fods);

    const tableEndIndex = fods.indexOf("</table:table>");
    const namedExprIndex = fods.indexOf("<table:named-expressions>");
    expect(namedExprIndex).toBeGreaterThan(tableEndIndex);

    expect(fods).toContain('table:cell-range-address="$Budget.$B$2:$Budget.$B$3"');
    expect(fods).toContain('table:base-cell-address="$Budget.$B$2"');
    expect(fods).toContain(
      'table:name="SINGLE" table:base-cell-address="$Budget.$B$2" table:cell-range-address="$Budget.$B$2"',
    );
  });

  test("a sheet name requiring quoting (contains a space) is single-quoted per ODF QuotedSheetName", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "My Sheet", cells: { A1: { value: 1 } }, names: { X: "A1" } }],
    });
    assertWellFormed(fods);
    expect(fods).toContain("$'My Sheet'.$A$1");
  });

  test("no named ranges: table:named-expressions is omitted entirely", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 1 } } }],
    });
    expect(fods).not.toContain("table:named-expressions");
  });

  test("an invalid name key (fails IsValidNamedRangeName) is skipped entirely from the FODS output", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 1 } }, names: { "bad name!": "A1" } }],
    });
    expect(fods).not.toContain("bad name");
    expect(fods).not.toContain("table:named-expressions");
  });

  test("a name key with an empty-string definition is skipped entirely from the FODS output", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 1 } }, names: { EMPTY: "" } }],
    });
    expect(fods).not.toContain("EMPTY");
    expect(fods).not.toContain("table:named-expressions");
  });

  test("a definition with more than one colon (e.g. 'A1:B2:C3') is skipped entirely", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 1 } }, names: { TRIPLE: "A1:B2:C3" } }],
    });
    expect(fods).not.toContain("TRIPLE");
    expect(fods).not.toContain("table:named-expressions");
  });
  test('a sheet with no name property defaults to "Sheet{N}" (1-based)', async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ cells: { A1: { value: 1 } } }],
    });
    expect(fods).toContain('table:name="Sheet1"');
  });
  test("a cell with no value or formula field (empty cell object) emits a string cell with empty content", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: {} } }],
    });
    expect(fods).toContain('office:value-type="string"');
    expect(fods).toContain("<text:p></text:p>");
  });
  test('a malformed definition (e.g. ":" -- empty endpoints after split) is skipped entirely, not emitted as a broken table:cell-range-address', async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 1 } }, names: { RANGE: ":" } }],
    });
    // The def ":" splits to ["",""] -- neither endpoint is a valid coord, so
    // the named range is skipped entirely (no malformed
    // table:cell-range-address like "$S1.$:$S1.$" emitted).
    expect(fods).not.toContain("RANGE");
    expect(fods).not.toContain("table:named-range");
    expect(fods).not.toContain("table:named-expressions");
  });

  test("multiple sheets each get their own table:table element in order", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [
        { name: "First", cells: { A1: { value: 1 } } },
        { name: "Second", cells: { A1: { value: 2 } } },
      ],
    });
    assertWellFormed(fods);
    const tableNames = [...fods.matchAll(/<table:table table:name="([^"]+)">/g)].map((m) => m[1]);
    expect(tableNames).toEqual(["First", "Second"]);
  });

  test("empty workbook produces valid, empty-body XML", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({ sheets: [] });
    assertWellFormed(fods);
    expect(fods).toContain("<office:spreadsheet></office:spreadsheet>");
  });

  test("undefined workbook argument produces empty-body XML (sheets-falsy fallback)", async () => {
    const SC = await loadSocialCalc();
    const untyped = SC.CreateFodsFromNormalizedWorkbook as (wb: unknown) => string;
    const fods = untyped(undefined);
    assertWellFormed(fods);
    expect(fods).toContain("<office:spreadsheet></office:spreadsheet>");
  });

  test("two cells in the same row (A1+B1) exercise byRow truthy-reuse (existing row bucket)", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 1 }, B1: { value: 2 } } }],
    });
    assertWellFormed(fods);
    // Both cells land in row 1 -- byRow[1] is created for A1 then REUSED for B1.
    expect(fods).toContain("<text:p>1</text:p>");
    expect(fods).toContain("<text:p>2</text:p>");
  });

  test("cells with a row gap (A1+A3) exercise the empty-row fallback (byRow[2] falsy)", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { A1: { value: 1 }, A3: { value: 3 } } }],
    });
    assertWellFormed(fods);
    // Row 2 has no cells -> byRow[2] is falsy -> empty table:table-cell/ row.
    // Both row 1 and row 3 must be present; row 2 is an empty <table:table-row>.
    expect(fods).toContain("<text:p>1</text:p>");
    expect(fods).toContain("<text:p>3</text:p>");
    // The gap row emits an empty cell (<table:table-cell/>) -- present in the XML.
    expect(fods).toContain("<table:table-cell/>");
  });
  test("a workbook with null sheets array exercises the sheets-falsy fallback", async () => {
    const SC = await loadSocialCalc();
    const untyped = SC.CreateFodsFromNormalizedWorkbook as (wb: unknown) => string;
    const fods = untyped({ sheets: null });
    assertWellFormed(fods);
    expect(fods).toContain("<office:spreadsheet></office:spreadsheet>");
  });
  test("a falsy sheet entry in the sheets array (null) exercises the ns-falsy fallback", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [null as unknown as { name: string; cells: Record<string, { value: number }> }],
    });
    assertWellFormed(fods);
    // Null sheet -> defaults to "Sheet1" with no cells -> empty table:table.
    expect(fods).toContain('table:name="Sheet1"');
  });
  test("a cell coord key that fails IsValidNormalizedCellCoord is silently skipped in FODS coord collection", async () => {
    const SC = await loadSocialCalc();
    const fods = SC.CreateFodsFromNormalizedWorkbook({
      sheets: [{ name: "S1", cells: { "bad-coord!!": { value: 1 }, A1: { value: 2 } } }],
    });
    assertWellFormed(fods);
    // Only A1 is emitted; "bad-coord!!" is filtered out by IsValidNormalizedCellCoord.
    expect(fods).toContain("<text:p>2</text:p>");
    expect(fods).not.toContain("bad-coord");
  });
});
