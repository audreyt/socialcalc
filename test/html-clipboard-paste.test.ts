// Behavior-contract coverage for SC.HtmlTable (js/socialcalc-3.ts) and its
// ctrl-v / navigator.clipboard integration in js/socialcalctableeditor.ts
// and js/socialcalcspreadsheetcontrol.ts.
//
// DOMParser is not a Vitest/Bun global (confirmed: `typeof DOMParser ===
// "undefined"` under `vp test`), so every table-shaped test here installs
// test/helpers/dom-parser-shim.ts to exercise the real `new
// DOMParser().parseFromString` branch, not just its "unavailable" fallback.
// The shim only implements the read surface SC.HtmlTable actually consumes
// (nodeType/tagName/childNodes/getAttribute/text content) -- no script
// execution, no selectors. Real-browser DOMParser paste is covered
// separately by e2e/html-table-paste.spec.ts (Playwright/Chromium).

import { afterEach, describe, expect, test } from "vite-plus/test";

import { installDOMParserShim } from "./helpers/dom-parser-shim";
import {
  loadSocialCalc as _loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetUndo,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// The built bundle is loaded at runtime; the SocialCalc namespace is
// declared ambiently (js/socialcalc-3.d.ts et al, aggregated into
// dist/SocialCalc.d.ts), so we cast the returned module to that type once at
// the VM-loading boundary -- same convention as
// test/hardening-tableeditor-commands.test.ts.
type SC = typeof SocialCalc;
type Editor = SocialCalc.TableEditor;
type Control = SocialCalc.SpreadsheetControl;
type Sheet = SocialCalc.Sheet;

async function loadSocialCalc(options: { browser?: boolean } = {}): Promise<SC> {
  const mod = await _loadSocialCalc(options);
  if (options.browser) installUiShim();
  return mod as unknown as SC;
}

let containerSeq = 0;
function newControl(SC: SC): { control: Control; editor: Editor; sheet: Sheet } {
  const container = document.createElement("div");
  container.id = "html-paste-root-" + containerSeq++;
  document.body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, editor: control.editor, sheet: control.editor.context.sheetobj };
}

let restoreDOMParser: (() => void) | null = null;
afterEach(() => {
  restoreDOMParser?.();
  restoreDOMParser = null;
});

function withDOMParser(): void {
  restoreDOMParser = installDOMParserShim();
}

/** Captures the single pending window.setTimeout callback and restores the real one. */
function captureNextTimeout(): { run: () => void; restore: () => void } {
  const origST = globalThis.setTimeout;
  let captured: (() => void) | null = null;
  (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((fn: () => void) => {
    captured = fn;
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  return {
    run: () => {
      captured?.();
    },
    restore: () => {
      (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = origST;
    },
  };
}

describe("SC.HtmlTable.LooksLikeHtmlTable", () => {
  test("accepts a <table ...> tag and rejects non-table/absent input", async () => {
    const SC = await loadSocialCalc();
    expect(SC.HtmlTable.LooksLikeHtmlTable("<table><tr><td>1</td></tr></table>")).toBe(true);
    expect(SC.HtmlTable.LooksLikeHtmlTable("<TABLE><TR><TD>1</TD></TR></TABLE>")).toBe(true);
    expect(SC.HtmlTable.LooksLikeHtmlTable("plain text, no markup")).toBe(false);
    expect(SC.HtmlTable.LooksLikeHtmlTable("<div>not a table</div>")).toBe(false);
    expect(SC.HtmlTable.LooksLikeHtmlTable("")).toBe(false);
    expect(SC.HtmlTable.LooksLikeHtmlTable(undefined)).toBe(false);
    expect(SC.HtmlTable.LooksLikeHtmlTable(42)).toBe(false);
    // "tablet" must not match: the regex requires a boundary after "table".
    expect(SC.HtmlTable.LooksLikeHtmlTable("<tablet>not a table tag</tablet>")).toBe(false);
  });
});

describe("SC.HtmlTable.ExtractSafeStyle: allowlisted style subset", () => {
  test("recognizes bold/italic/alignment/color/background-color and ignores everything else", async () => {
    const SC = await loadSocialCalc();
    const style = SC.HtmlTable.ExtractSafeStyle(
      "font-weight:bold;font-style:italic;text-align:center;color:#ff0000;background-color:rgb(0,0,255);position:absolute;behavior:url(evil.htc)",
    );
    expect(style).toEqual({
      bold: true,
      italic: true,
      align: "center",
      color: "#ff0000",
      bgcolor: "rgb(0,0,255)",
    });
  });

  test("numeric font-weight >= 600 counts as bold; below 600 does not", async () => {
    const SC = await loadSocialCalc();
    expect(SC.HtmlTable.ExtractSafeStyle("font-weight:700").bold).toBe(true);
    expect(SC.HtmlTable.ExtractSafeStyle("font-weight:600").bold).toBe(true);
    expect(SC.HtmlTable.ExtractSafeStyle("font-weight:400").bold).toBe(false);
    expect(SC.HtmlTable.ExtractSafeStyle("font-weight:normal").bold).toBe(false);
  });

  test("text-align only accepts left/center/right, not justify or garbage", async () => {
    const SC = await loadSocialCalc();
    expect(SC.HtmlTable.ExtractSafeStyle("text-align:left").align).toBe("left");
    expect(SC.HtmlTable.ExtractSafeStyle("text-align:right").align).toBe("right");
    expect(SC.HtmlTable.ExtractSafeStyle("text-align:justify").align).toBe(null);
    expect(SC.HtmlTable.ExtractSafeStyle("text-align:nonsense").align).toBe(null);
  });

  test("rejects a url()-bearing background/color value (no background-image smuggling)", async () => {
    const SC = await loadSocialCalc();
    expect(SC.HtmlTable.ExtractSafeStyle("background-color:url(javascript:alert(1))").bgcolor).toBe(
      null,
    );
    expect(SC.HtmlTable.ExtractSafeStyle("background:url(x.png) red").bgcolor).toBe(null);
    expect(SC.HtmlTable.ExtractSafeStyle("color:expression(alert(1))").color).toBe(null);
  });

  test("handles empty/malformed/non-string input without throwing", async () => {
    const SC = await loadSocialCalc();
    const blank = { bold: false, italic: false, align: null, color: null, bgcolor: null };
    expect(SC.HtmlTable.ExtractSafeStyle(null)).toEqual(blank);
    expect(SC.HtmlTable.ExtractSafeStyle("")).toEqual(blank);
    expect(SC.HtmlTable.ExtractSafeStyle("garbage-no-colon")).toEqual(blank);
    expect(SC.HtmlTable.ExtractSafeStyle(":novalue;color:")).toEqual(blank);
  });
});

describe("SC.HtmlTable.BuildSheetSaveFromHtml: normalized table parsing", () => {
  test("returns '' when DOMParser is unavailable (the real unit-env default, no shim installed)", async () => {
    const SC = await loadSocialCalc();
    expect(typeof (globalThis as { DOMParser?: unknown }).DOMParser).toBe("undefined");
    expect(SC.HtmlTable.BuildSheetSaveFromHtml("<table><tr><td>1</td></tr></table>")).toBe("");
  });

  test("returns '' for non-table input without ever invoking DOMParser", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    expect(SC.HtmlTable.BuildSheetSaveFromHtml("just some text")).toBe("");
    expect(SC.HtmlTable.BuildSheetSaveFromHtml("<div>no table here</div>")).toBe("");
  });

  test("returns '' for a <table> with no rows", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    expect(SC.HtmlTable.BuildSheetSaveFromHtml("<table></table>")).toBe("");
  });

  test("parses a simple 2x2 table into a loadable .scsave with typed values", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = "<table><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    expect(save).not.toBe("");
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe(1);
    expect(sheet.cells.A1?.valuetype).toBe("n");
    expect(sheet.cells.B1?.datavalue).toBe(2);
    expect(sheet.cells.A2?.datavalue).toBe(3);
    expect(sheet.cells.B2?.datavalue).toBe(4);
  });

  test("recognizes Excel/Sheets-style number/date/formula strings via DetermineValueType", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table><tr><td>15.1%</td><td>$1,234.49</td><td>2024-03-15</td><td>=A1+B1</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.valuetype).toBe("n%");
    expect(sheet.cells.A1?.datavalue).toBeCloseTo(0.151);
    expect(sheet.cells.B1?.valuetype).toBe("n$");
    expect(sheet.cells.B1?.datavalue).toBeCloseTo(1234.49);
    expect(sheet.cells.C1?.valuetype).toBe("nd");
    expect(sheet.cells.D1?.datatype).toBe("f");
    expect(sheet.cells.D1?.formula).toBe("A1+B1");
  });

  test("th cells become bold-centered header text", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table><tr><th>Name</th><th>Score</th></tr><tr><td>Ann</td><td>5</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("Name");
    expect(sheet.cells.A1?.font).toBeTruthy();
    expect(sheet.fonts[sheet.cells.A1?.font as number]).toContain("bold");
    expect(sheet.cells.A1?.cellformat).toBeTruthy();
    expect(sheet.cellformats[sheet.cells.A1?.cellformat as number]).toBe("center");
  });

  test("maps bold/italic/align/color/bgcolor styles onto real sheet style indices", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      '<table><tr><td style="font-weight:bold;color:#ff0000;background-color:#00ff00;text-align:right">styled</td></tr></table>';
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    const cell = sheet.cells.A1;
    expect(sheet.fonts[cell?.font as number]).toContain("bold");
    expect(sheet.colors[cell?.color as number]).toBe("#ff0000");
    expect(sheet.colors[cell?.bgcolor as number]).toBe("#00ff00");
    expect(sheet.cellformats[cell?.cellformat as number]).toBe("right");
  });

  test("empty cells produce a blank cell (matching SetConvertedCell's existing CSV/tab-import precedent)", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = "<table><tr><td>1</td><td></td><td>3</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe(1);
    expect(sheet.cells.B1?.datavalue).toBe("");
    expect(sheet.cells.C1?.datavalue).toBe(3);
  });

  test("nested inline text and <br> line breaks join with newlines", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = "<table><tr><td>Line one<br>Line <b>two</b><br>Line three</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("Line one\nLine two\nLine three");
  });

  test("block-level children (div/p) are also newline-joined", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = "<table><tr><td><div>first</div><div>second</div></td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("first\nsecond");
  });

  test("honors <thead>/<tbody>/<tfoot> wrapping", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>B1</td></tr></tbody>" +
      "<tfoot><tr><td>F1</td></tr></tfoot></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("H");
    expect(sheet.cells.A2?.datavalue).toBe("B1");
    expect(sheet.cells.A3?.datavalue).toBe("F1");
  });

  test("parses only the first <table> when multiple top-level tables are present", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = "<table><tr><td>first</td></tr></table><table><tr><td>second</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("first");
    expect(Object.keys(sheet.cells)).toEqual(["A1"]);
  });

  test("a table nested inside a cell is ignored by CollectRows (not double-counted as sibling rows)", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table><tr><td>outer<table><tr><td>inner</td></tr></table></td><td>next</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(String(sheet.cells.A1?.datavalue)).toContain("outer");
    expect(sheet.cells.B1?.datavalue).toBe("next");
    expect(sheet.cells.C1).toBeUndefined();
    expect(sheet.cells.A2).toBeUndefined();
  });
});

describe("SC.HtmlTable.BuildSheetSaveFromHtml: rowspan/colspan handling", () => {
  test("colspan expands a header across multiple columns", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = "<table><tr><td colspan='2'>Merged</td></tr><tr><td>A</td><td>B</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("Merged");
    expect(sheet.cells.A1?.colspan).toBe(2);
    expect(sheet.cells.A2?.datavalue).toBe("A");
    expect(sheet.cells.B2?.datavalue).toBe("B");
  });

  test("rowspan expands a cell down; the next row's cell slides right of the occupied slot", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table><tr><td rowspan='2'>Tall</td><td>top-right</td></tr><tr><td>bottom-right</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("Tall");
    expect(sheet.cells.A1?.rowspan).toBe(2);
    expect(sheet.cells.B1?.datavalue).toBe("top-right");
    expect(sheet.cells.A2).toBeUndefined();
    expect(sheet.cells.B2?.datavalue).toBe("bottom-right");
  });

  test("combined rowspan+colspan rectangle blocks every covered cell from a later overlapping td", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table>" +
      "<tr><td rowspan='2' colspan='2'>Big</td><td>C1</td></tr>" +
      "<tr><td>C2</td></tr>" +
      "<tr><td>A3</td><td>B3</td><td>C3</td></tr>" +
      "</table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("Big");
    expect(sheet.cells.A1?.rowspan).toBe(2);
    expect(sheet.cells.A1?.colspan).toBe(2);
    expect(sheet.cells.C1?.datavalue).toBe("C1");
    expect(sheet.cells.A2).toBeUndefined();
    expect(sheet.cells.B2).toBeUndefined();
    expect(sheet.cells.C2?.datavalue).toBe("C2");
    expect(sheet.cells.A3?.datavalue).toBe("A3");
    expect(sheet.cells.B3?.datavalue).toBe("B3");
    expect(sheet.cells.C3?.datavalue).toBe("C3");
  });

  test("a rectangle that starts free but overlaps an occupied cell partway through slides forward instead of splitting", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    // Row 1: a plain cell at A1, then a rowspan=2 cell at B1 (covers B1:B2).
    // Row 2: a colspan=2 cell starting at A2 -- its first candidate slot
    // (A2) is free, but its second cell (B2) is already claimed by row 1's
    // rowspan, so the whole 1x2 candidate rectangle must be rejected and
    // the loop must slide forward (col++, c--) rather than splitting the
    // rectangle or overwriting the earlier span.
    const html =
      "<table>" +
      "<tr><td>A1</td><td rowspan='2'>Tall</td></tr>" +
      "<tr><td colspan='2'>slides</td></tr>" +
      "</table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("A1");
    expect(sheet.cells.B1?.datavalue).toBe("Tall");
    expect(sheet.cells.B1?.rowspan).toBe(2);
    // Row 2's colspan=2 <td> could not be placed at A2 (would overlap B2,
    // owned by B1's rowspan), so it slides to C2 instead of splitting.
    expect(sheet.cells.A2).toBeUndefined();
    expect(sheet.cells.B2).toBeUndefined();
    expect(sheet.cells.C2?.datavalue).toBe("slides");
    expect(sheet.cells.C2?.colspan).toBe(2);
  });

  test("malformed rowspan/colspan (non-numeric, zero, negative) degrades to a plain 1x1 cell", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table><tr>" +
      "<td rowspan='abc' colspan='xyz'>bad-nonnumeric</td>" +
      "<td rowspan='0'>bad-zero</td>" +
      "<td colspan='-3'>bad-negative</td>" +
      "</tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("bad-nonnumeric");
    expect(sheet.cells.A1?.colspan).toBeUndefined();
    expect(sheet.cells.A1?.rowspan).toBeUndefined();
    expect(sheet.cells.B1?.datavalue).toBe("bad-zero");
    expect(sheet.cells.B1?.rowspan).toBeUndefined();
    expect(sheet.cells.C1?.datavalue).toBe("bad-negative");
    expect(sheet.cells.C1?.colspan).toBeUndefined();
  });

  test("a span that would overflow the sheet's max column is clamped, never dropping the anchor cell", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const fillerCells = Array.from({ length: 700 }, (_unused, i) => `<td>f${i}</td>`).join("");
    const html = `<table><tr>${fillerCells}<td colspan='5'>edge</td></tr></table>`;
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    const anchorCoord = SC.crToCoord(701, 1);
    expect(sheet.cells[anchorCoord]?.datavalue).toBe("edge");
    // Clamped to 2 (cols 701..702), never silently dropped nor left
    // overflowing past TABLE_MAX_COL. (CanonicalizeSheet recomputes
    // lastcol from actual cell *anchors*, not spans -- a colspan=2 anchor
    // at 701 has no cell object at 702, so lastcol legitimately settles at
    // 701; the invariant under test is the clamp itself, asserted above.)
    expect(sheet.cells[anchorCoord]?.colspan).toBe(2);
  });
});

describe("SC.HtmlTable.BuildSheetSaveFromHtml: untrusted-content safety", () => {
  test("script/style/noscript/template subtrees never contribute to cell text", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      "<table><tr><td>before<script>alert(1)</script>after" +
      "<style>.x{color:red}</style><noscript>hidden</noscript>" +
      "<template>tpl-content</template>end</td></tr></table>";
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    const text = String(sheet.cells.A1?.datavalue ?? "");
    expect(text).not.toContain("alert(1)");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("hidden");
    expect(text).not.toContain("tpl-content");
    expect(text).toContain("before");
    expect(text).toContain("after");
    expect(text).toContain("end");
  });

  test("no href/src/event-handler attribute from source markup ever reaches the sheet", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      '<table><tr><td><a href="javascript:alert(1)" onclick="alert(2)">link text</a>' +
      '<img src="x" onerror="alert(3)"></td></tr></table>';
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    expect(save).not.toContain("javascript:");
    expect(save).not.toContain("onclick");
    expect(save).not.toContain("onerror");
    expect(save).not.toContain("alert(");
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.datavalue).toBe("link text");
  });

  test("an unrecognized/dangerous CSS property (position, behavior, expression) never survives style extraction", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html =
      '<table><tr><td style="position:fixed;behavior:url(evil.htc);width:expression(alert(1))">x</td></tr></table>';
    const save = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    expect(save).not.toContain("expression");
    expect(save).not.toContain("behavior");
    expect(save).not.toContain(".htc");
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(save);
    expect(sheet.cells.A1?.font).toBeUndefined();
    expect(sheet.cells.A1?.color).toBeUndefined();
  });

  test("the source HTML string is never assigned to a live DOM sink -- only cell text/values reach the sheet", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = '<table><tr><td><img src=x onerror="window.__pwned = true"></td></tr></table>';
    const marker = globalThis as { __pwned?: boolean };
    marker.__pwned = false;
    SC.HtmlTable.BuildSheetSaveFromHtml(html);
    expect(marker.__pwned).toBe(false);
    delete marker.__pwned;
  });

  test("a malformed/unparseable payload fails closed to '' rather than throwing", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    // LooksLikeHtmlTable requires a <table> tag; anything without one never
    // reaches the parser at all and returns "" immediately.
    expect(SC.HtmlTable.BuildSheetSaveFromHtml("<table")).toBe("");
    expect(() => SC.HtmlTable.BuildSheetSaveFromHtml("<table")).not.toThrow();
  });

  test("a DOMParser that throws during parseFromString fails closed to '' rather than propagating", async () => {
    const SC = await loadSocialCalc();
    const originalGlobal = globalThis as { DOMParser?: unknown };
    const original = originalGlobal.DOMParser;
    class ThrowingDOMParser {
      parseFromString(): never {
        throw new Error("simulated parser failure");
      }
    }
    originalGlobal.DOMParser = ThrowingDOMParser;
    try {
      expect(SC.HtmlTable.BuildSheetSaveFromHtml("<table><tr><td>1</td></tr></table>")).toBe("");
    } finally {
      if (original === undefined) {
        delete originalGlobal.DOMParser;
      } else {
        originalGlobal.DOMParser = original;
      }
    }
  });
});

describe("SC.ConvertOtherFormatToSave: html-table input branch", () => {
  test("routes 'html-table' format through SC.HtmlTable.BuildSheetSaveFromHtml", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const html = "<table><tr><td>7</td></tr></table>";
    const viaDirect = SC.HtmlTable.BuildSheetSaveFromHtml(html);
    const viaConvert = SC.ConvertOtherFormatToSave(html, "html-table");
    expect(viaConvert).toBe(viaDirect);
    expect(viaConvert).not.toBe("");
  });

  test("scsave/csv input formats are unaffected by the new branch", async () => {
    const SC = await loadSocialCalc();
    expect(SC.ConvertOtherFormatToSave("version:1.5\n", "scsave")).toBe("version:1.5\n");
    expect(SC.ConvertOtherFormatToSave("1,2\n3,4\n", "csv")).toContain("cell:A1");
  });
});

describe("Real clipboard/save command transaction integration (undo/spill/readonly guards)", () => {
  test("ctrl-v with an HTML table payload schedules loadclipboard+paste all as one transaction", async () => {
    withDOMParser();
    const SC = await loadSocialCalc({ browser: true });
    const { editor } = newControl(SC);
    editor.MoveECell("A1");

    const scheduled: string[] = [];
    editor.EditorScheduleSheetCommands = (cmd: string) => {
      scheduled.push(cmd);
    };

    const timeoutCtl = captureNextTimeout();
    editor.ctrlkeyFunction(editor, "[ctrl-v]");
    (editor as unknown as { pasteHtmlData: string }).pasteHtmlData =
      "<table><tr><td>hi</td><td>2</td></tr></table>";
    editor.pasteTextarea.value = "hi\t2\n";
    timeoutCtl.run();
    timeoutCtl.restore();

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("loadclipboard");
    expect(scheduled[0]).toContain("paste A1 all");
  });

  test("ctrl-v with plain-text-only clipboard (no HTML) still falls back to the tab-delimited path", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { editor } = newControl(SC);
    editor.MoveECell("A1");

    const scheduled: string[] = [];
    editor.EditorScheduleSheetCommands = (cmd: string) => {
      scheduled.push(cmd);
    };

    const timeoutCtl = captureNextTimeout();
    editor.ctrlkeyFunction(editor, "[ctrl-v]");
    (editor as unknown as { pasteHtmlData: string }).pasteHtmlData = "";
    editor.pasteTextarea.value = "plain\tvalue\n";
    timeoutCtl.run();
    timeoutCtl.restore();

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("loadclipboard");
    expect(scheduled[0]).toContain("paste A1 formulas");
  });

  test("HTML clipboard data that is not table-shaped falls back to the plain-text path", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { editor } = newControl(SC);
    editor.MoveECell("A1");

    const scheduled: string[] = [];
    editor.EditorScheduleSheetCommands = (cmd: string) => {
      scheduled.push(cmd);
    };

    const timeoutCtl = captureNextTimeout();
    editor.ctrlkeyFunction(editor, "[ctrl-v]");
    (editor as unknown as { pasteHtmlData: string }).pasteHtmlData = "<div>not a table</div>";
    editor.pasteTextarea.value = "fallback\n";
    timeoutCtl.run();
    timeoutCtl.restore();

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("paste A1 formulas");
  });

  test("a spilled-formula target is protected: pasted HTML never overwrites a live spill member", async () => {
    withDOMParser();
    const SC = await loadSocialCalc({ browser: true });
    const { editor, sheet } = newControl(SC);
    await scheduleCommands(SC, sheet, [
      "set A1 formula UNIQUE(C1:C2)",
      "set C1 value n 1",
      "set C2 value n 2",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.A2).toBeDefined();

    const scsave = SC.HtmlTable.BuildSheetSaveFromHtml("<table><tr><td>intrude</td></tr></table>");
    await scheduleCommands(SC, sheet, [
      "loadclipboard " + SC.encodeForSave(scsave),
      "paste A2 all",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.A2?.datavalue).not.toBe("intrude");
    void editor;
  });

  test("a readonly target cell is protected: the paste command's readonly guard skips it", async () => {
    withDOMParser();
    const SC = await loadSocialCalc({ browser: true });
    const { sheet } = newControl(SC);
    await scheduleCommands(SC, sheet, ["set A1 readonly yes"]);

    const scsave = SC.HtmlTable.BuildSheetSaveFromHtml("<table><tr><td>blocked</td></tr></table>");
    await scheduleCommands(SC, sheet, [
      "loadclipboard " + SC.encodeForSave(scsave),
      "paste A1 all",
    ]);
    expect(sheet.cells.A1?.datavalue).not.toBe("blocked");
  });

  test("undo restores the sheet to its exact pre-paste state after an HTML-table paste", async () => {
    withDOMParser();
    const SC = await loadSocialCalc({ browser: true });
    const { sheet } = newControl(SC);
    await scheduleCommands(SC, sheet, ["set A1 value n 99"]);

    const scsave = SC.HtmlTable.BuildSheetSaveFromHtml("<table><tr><td>new</td></tr></table>");
    await scheduleCommands(SC, sheet, [
      "loadclipboard " + SC.encodeForSave(scsave),
      "paste A1 all",
    ]);
    expect(sheet.cells.A1?.datavalue).toBe("new");

    await sheetUndo(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.cells.A1?.datavalue).toBe(99);
  });
});

describe("pasteTextarea 'paste' ClipboardEvent listener (CreateTableEditor wiring)", () => {
  interface ListenerHost {
    __listeners?: Record<string, Array<(event: unknown) => void>>;
  }

  function firePaste(editor: Editor, event: unknown): void {
    const host = editor.pasteTextarea as unknown as ListenerHost;
    const handlers = host.__listeners?.paste;
    if (!handlers || handlers.length === 0) {
      throw new Error("no 'paste' listener registered on pasteTextarea");
    }
    for (const handler of handlers) handler(event);
  }

  test("captures event.clipboardData.getData('text/html') into editor.pasteHtmlData", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { editor } = newControl(SC);
    firePaste(editor, {
      clipboardData: { getData: (mime: string) => (mime === "text/html" ? "<table></table>" : "") },
    });
    expect((editor as unknown as { pasteHtmlData: string }).pasteHtmlData).toBe("<table></table>");
  });

  test("a getData('text/html') call that returns a falsy value (mime not present) falls back to empty string", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { editor } = newControl(SC);
    firePaste(editor, {
      // No text/html on the clipboard at all -- a real browser's getData()
      // returns "" (not undefined/null) for an absent format, exercising
      // the `|| ""` fallback distinctly from the no-clipboardData case below.
      clipboardData: { getData: () => "" },
    });
    expect((editor as unknown as { pasteHtmlData: string }).pasteHtmlData).toBe("");
  });

  test("a getData() call that throws is caught and leaves pasteHtmlData empty", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { editor } = newControl(SC);
    firePaste(editor, {
      clipboardData: {
        getData: () => {
          throw new Error("clipboardData access denied");
        },
      },
    });
    expect((editor as unknown as { pasteHtmlData: string }).pasteHtmlData).toBe("");
  });

  test("an event with no clipboardData leaves pasteHtmlData empty without throwing", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { editor } = newControl(SC);
    expect(() => firePaste(editor, {})).not.toThrow();
    expect((editor as unknown as { pasteHtmlData: string }).pasteHtmlData).toBe("");
  });
});

describe("SC.EditorPasteFromClipboardAsync: navigator.clipboard UI path", () => {
  interface FakeClipboardItem {
    types: string[];
    getType: (mime: string) => Promise<{ text: () => Promise<string> }>;
  }
  interface FakeNavigator {
    clipboard?: {
      read?: () => Promise<FakeClipboardItem[]>;
      readText?: () => Promise<string>;
    };
  }

  function makeEditor(scheduled: string[]): SocialCalc.TableEditor {
    return {
      noEdit: false,
      ECellReadonly: () => false,
      range: { hasrange: false, left: 1, top: 1, right: 1, bottom: 1 },
      ecell: { coord: "B2" },
      EditorScheduleSheetCommands: (cmd: string) => {
        scheduled.push(cmd);
      },
    } as unknown as SocialCalc.TableEditor;
  }

  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
    }
  });

  function setNavigatorClipboard(clipboard: FakeNavigator["clipboard"]): void {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      enumerable: true,
      value: { clipboard },
    });
  }

  test("prefers a text/html table payload from navigator.clipboard.read() over plain text", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    setNavigatorClipboard({
      read: async () => [
        {
          types: ["text/plain", "text/html"],
          getType: async (mime: string) => {
            expect(mime).toBe("text/html");
            return { text: async () => "<table><tr><td>from-clipboard</td></tr></table>" };
          },
        },
      ],
      readText: async () => {
        throw new Error("readText should not be called when text/html table is present");
      },
    });
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("loadclipboard");
    expect(scheduled[0]).toContain("paste B2 all");
  });

  test("falls back to readText() plain text when no text/html item is present", async () => {
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    setNavigatorClipboard({
      read: async () => [
        { types: ["text/plain"], getType: async () => ({ text: async () => "" }) },
      ],
      readText: async () => "plain\tfallback\n",
    });
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("loadclipboard");
    expect(scheduled[0]).toContain("paste B2 formulas");
  });

  test("falls back to readText() when the html payload is not table-shaped", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    setNavigatorClipboard({
      read: async () => [
        {
          types: ["text/html"],
          getType: async () => ({ text: async () => "<div>no table</div>" }),
        },
      ],
      readText: async () => "fallback-text\n",
    });
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("paste B2 formulas");
  });

  test("falls back to readText() when navigator.clipboard.read() rejects (permission denied)", async () => {
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    setNavigatorClipboard({
      read: async () => {
        throw new Error("permission denied");
      },
      readText: async () => "denied-fallback\n",
    });
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toContain("paste B2 formulas");
  });

  test("is a no-op when the Clipboard API is entirely unavailable", async () => {
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    setNavigatorClipboard(undefined);
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(scheduled).toHaveLength(0);
  });

  test("empty readText() result schedules nothing", async () => {
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    setNavigatorClipboard({ readText: async () => "" });
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(scheduled).toHaveLength(0);
  });

  test("readText() rejection resolves without throwing and schedules nothing", async () => {
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    setNavigatorClipboard({
      readText: async () => {
        throw new Error("denied");
      },
    });
    await expect(SC.EditorPasteFromClipboardAsync(editor)).resolves.toBeUndefined();
    expect(scheduled).toHaveLength(0);
  });

  test("no-ops when the editor is readonly/noEdit, without touching navigator.clipboard", async () => {
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    (editor as unknown as { noEdit: boolean }).noEdit = true;
    let readCalled = false;
    setNavigatorClipboard({
      read: async () => {
        readCalled = true;
        return [];
      },
    });
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(readCalled).toBe(false);
    expect(scheduled).toHaveLength(0);
  });

  test("targets the full selected range (matching the %C toolbar substitution), not just its upper-left cell", async () => {
    withDOMParser();
    const SC = await loadSocialCalc();
    const scheduled: string[] = [];
    const editor = makeEditor(scheduled);
    (editor as unknown as { range: SocialCalc.TableEditor["range"] }).range = {
      hasrange: true,
      left: 2,
      top: 3,
      right: 4,
      bottom: 5,
    } as SocialCalc.TableEditor["range"];
    setNavigatorClipboard({
      read: async () => [
        {
          types: ["text/html"],
          getType: async () => ({ text: async () => "<table><tr><td>x</td></tr></table>" }),
        },
      ],
    });
    await SC.EditorPasteFromClipboardAsync(editor);
    expect(scheduled[0]).toContain("paste B3:D5 all");
  });
});

describe("SC.DoCmd 'pasteclipboard': toolbar entry point for the async clipboard path", () => {
  test("routes through SC.EditorPasteFromClipboardAsync exactly once", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const { control } = newControl(SC);
    SC.SetSpreadsheetControlObject(control);

    let calls = 0;
    const orig = SC.EditorPasteFromClipboardAsync;
    SC.EditorPasteFromClipboardAsync = async () => {
      calls++;
      return Promise.resolve();
    };
    try {
      SC.DoCmd(null, "pasteclipboard");
    } finally {
      SC.EditorPasteFromClipboardAsync = orig;
    }
    expect(calls).toBe(1);
  });
});
