import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

function resetWorkbookGlobals(SC: any) {
  if (SC.RecalcInfo) {
    SC.RecalcInfo.LoadSheet = () => false;
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
    SC.RecalcInfo.sheet = null;
    if (SC.RecalcInfo.recalctimer) {
      try {
        clearTimeout(SC.RecalcInfo.recalctimer);
      } catch {
        // cleanup: recalctimer may already have fired/cleared; best-effort clear only.
      }
      SC.RecalcInfo.recalctimer = null;
    }
    SC.RecalcInfo.firstRenderScheduled = false;
  }
  if (SC.Formula) {
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;
    SC.Formula.FreshnessInfo.sheets = {};
    SC.Formula.FreshnessInfo.volatile = {};
    SC.Formula.RemoteFunctionInfo.waitingForServer = null;
  }
}

async function freshSC() {
  const SC = await loadSocialCalc();
  resetWorkbookGlobals(SC);
  return SC;
}

function setValue(sheet: any, coord: string, value: number) {
  const cell = sheet.GetAssuredCell(coord);
  cell.datatype = "v";
  cell.datavalue = value;
  cell.valuetype = "n";
}

function setText(sheet: any, coord: string, value: string) {
  const cell = sheet.GetAssuredCell(coord);
  cell.datatype = "t";
  cell.datavalue = value;
  cell.valuetype = "t";
}

function setFormula(sheet: any, coord: string, formula: string) {
  const cell = sheet.GetAssuredCell(coord);
  cell.datatype = "f";
  cell.formula = formula;
  delete cell.parseinfo;
}

// ---------------------------------------------------------------------------
// Envelope shape / versioning
// ---------------------------------------------------------------------------

describe("Workbook save envelope shape", () => {
  test("CreateWorkbookSave produces the versioned multipart header, distinct from the single-sheet envelope", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("S1");

    const saved = SC.CreateWorkbookSave(wb);
    expect(saved.startsWith("socialcalc:workbook:version:1.0\n")).toBe(true);
    expect(saved).toContain("MIME-Version: 1.0");
    expect(saved).toContain("Content-Type: multipart/mixed; boundary=");
    expect(saved).toContain("# SocialCalc Workbook Save");
    expect(saved).toContain("version:1.0");
    // Distinct boundary token from the SpreadsheetControl envelope, and no
    // accidental collision with the single-sheet "socialcalc:version:1.0" prefix.
    expect(saved.startsWith("socialcalc:version:1.0")).toBe(false);
  });

  test("manifest lists every sheet in tab order with visibility, and only editorsettings lines for sheets that have one", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("First");
    wb.AddSheet("Second");
    wb.AddSheet("Third");
    wb.HideSheet("Second");
    wb.SetSheetEditorSettings("Third", "version:1.0\necell:C3\n");

    const saved = SC.CreateWorkbookSave(wb);
    expect(saved).toContain("sheet:First:visible:yes");
    expect(saved).toContain("sheet:Second:visible:no");
    expect(saved).toContain("sheet:Third:visible:yes");
    expect(saved).toContain("editorsettings:Third:");
    expect(saved).not.toContain("editorsettings:First:");
    expect(saved).not.toContain("editorsettings:Second:");
  });

  test("each sheet's data part is byte-identical to that sheet's own CreateSheetSave() output", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("S1");
    setValue(wb.GetSheet("S1"), "A1", 42);
    setText(wb.GetSheet("S1"), "B1", "hello");

    const expectedSheetSave = wb.GetSheet("S1")!.CreateSheetSave();
    const saved = SC.CreateWorkbookSave(wb);
    expect(saved).toContain(expectedSheetSave);
  });
});

// ---------------------------------------------------------------------------
// Decode: malformed input
// ---------------------------------------------------------------------------

describe("DecodeWorkbookSave: malformed input never throws, returns null", () => {
  test("empty string", async () => {
    const SC = await freshSC();
    expect(SC.DecodeWorkbookSave("")).toBeNull();
  });

  test("no MIME-Version header", async () => {
    const SC = await freshSC();
    expect(SC.DecodeWorkbookSave("not a save at all")).toBeNull();
  });

  test("MIME-Version present but no Content-Type boundary", async () => {
    const SC = await freshSC();
    expect(SC.DecodeWorkbookSave("MIME-Version: 1.0\nhello\n")).toBeNull();
  });

  test("boundary declared but no top boundary line present", async () => {
    const SC = await freshSC();
    const str = "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=XX\n";
    expect(SC.DecodeWorkbookSave(str)).toBeNull();
  });

  test("top boundary present but truncated before any blank line", async () => {
    const SC = await freshSC();
    const str =
      "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=XX\n--XX\nno blank line here";
    expect(SC.DecodeWorkbookSave(str)).toBeNull();
  });

  test("header declares a sheet part but the data section never arrives", async () => {
    const SC = await freshSC();
    const str = [
      "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=XX",
      "--XX",
      "Content-type: text/plain; charset=UTF-8",
      "",
      "# SocialCalc Workbook Save",
      "version:1.0",
      "sheet:S1:visible:yes",
      "--XX",
      "Content-type: text/plain; charset=UTF-8",
      "",
      "version:1.5",
      "cell:A1:v:1",
      "sheet:c:1:r:1",
      // Missing closing "--XX--" boundary.
    ].join("\n");
    expect(SC.DecodeWorkbookSave(str)).toBeNull();
  });

  test("arbitrary binary-ish garbage after a valid-looking header never throws", async () => {
    const SC = await freshSC();
    const str =
      "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=XX\n--XX\n\x00\x01\x02\xff garbage";
    expect(() => SC.DecodeWorkbookSave(str)).not.toThrow();
  });

  test("2+ sheets declared but the second data part's blank-line separator is missing", async () => {
    const SC = await freshSC();
    const boundary = "XX";
    const str = [
      "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=" + boundary,
      "--" + boundary,
      "Content-type: text/plain; charset=UTF-8",
      "",
      "# SocialCalc Workbook Save",
      "version:1.0",
      "sheet:S1:visible:yes",
      "sheet:S2:visible:yes",
      "--" + boundary,
      "Content-type: text/plain; charset=UTF-8",
      "",
      "version:1.5",
      "cell:A1:v:1",
      "sheet:c:1:r:1",
      "--" + boundary,
      // Missing the blank-line separator before the second part's body —
      // this immediately hits the closing boundary instead, so the
      // blank-line regex used for the SECOND sheet's part never matches.
      "--" + boundary + "--",
    ].join("\n");
    expect(SC.DecodeWorkbookSave(str)).toBeNull();
  });

  test("3+ sheets declared: a middle data part is missing its NEXT (non-final) boundary marker", async () => {
    const SC = await freshSC();
    const boundary = "XX";
    const str = [
      "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=" + boundary,
      "--" + boundary,
      "Content-type: text/plain; charset=UTF-8",
      "",
      "# SocialCalc Workbook Save",
      "version:1.0",
      "sheet:S1:visible:yes",
      "sheet:S2:visible:yes",
      "sheet:S3:visible:yes",
      "--" + boundary,
      "Content-type: text/plain; charset=UTF-8",
      "",
      "version:1.5",
      "cell:A1:v:1",
      "sheet:c:1:r:1",
      "--" + boundary,
      "Content-type: text/plain; charset=UTF-8",
      "",
      "version:1.5",
      "cell:A1:v:2",
      "sheet:c:1:r:1",
      // S2's part never hits another "--XX" boundary before EOF — the
      // non-final branch's `nextmatch` search comes up empty.
    ].join("\n");
    expect(SC.DecodeWorkbookSave(str)).toBeNull();
  });
});

describe("LoadWorkbookSave: malformed input is a strict no-op", () => {
  test("a malformed string leaves an existing workbook completely untouched", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Untouched");
    setValue(wb.GetSheet("Untouched"), "A1", 7);

    SC.LoadWorkbookSave(wb, "not a valid save string");

    expect(wb.sheetOrder).toEqual(["Untouched"]);
    expect(wb.GetSheet("Untouched")!.GetAssuredCell("A1").datavalue).toBe(7);
  });

  test("loading into a workbook with existing sheets replaces them entirely on success", async () => {
    const SC = await freshSC();
    const source = new SC.Workbook();
    source.AddSheet("FromSource");
    setValue(source.GetSheet("FromSource"), "A1", 100);
    const saved = SC.CreateWorkbookSave(source);

    const target = new SC.Workbook();
    target.AddSheet("Stale1");
    target.AddSheet("Stale2");

    SC.LoadWorkbookSave(target, saved);

    expect(target.sheetOrder).toEqual(["FromSource"]);
    expect(target.GetSheet("Stale1")).toBeNull();
    expect(target.GetSheet("FromSource")!.GetAssuredCell("A1").datavalue).toBe(100);
  });

  test("regression: an envelope that decodes cleanly but with zero sheet: entries is refused (workbook must always have >= 1 sheet)", async () => {
    const SC = await freshSC();
    // Extra intermediate boundary line (header part, then an empty data
    // section, then the closing boundary) makes DecodeWorkbookSave succeed
    // structurally with a real non-null manifest of {sheets: []} — this is
    // the case the `decoded.sheets.length === 0` guard in LoadWorkbookSave
    // exists to catch (a header-only envelope with NO intermediate
    // boundary, as CreateWorkbookSave emits for a truly empty workbook,
    // fails to decode at all — see the round-trip test below — so this
    // fixture is the only way to exercise the guard itself).
    const boundary = "SocialCalcWorkbookSave";
    const zeroSheetSave =
      "socialcalc:workbook:version:1.0\n" +
      "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=" +
      boundary +
      "\n--" +
      boundary +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      "# SocialCalc Workbook Save\nversion:1.0\n" +
      "--" +
      boundary +
      "\n" +
      "--" +
      boundary +
      "--\n";
    const decoded = SC.DecodeWorkbookSave(zeroSheetSave);
    expect(decoded).not.toBeNull();
    expect(decoded!.sheets).toEqual([]);

    const target = new SC.Workbook();
    target.AddSheet("Untouched");
    setValue(target.GetSheet("Untouched"), "A1", 42);

    SC.LoadWorkbookSave(target, zeroSheetSave);

    expect(target.sheetOrder).toEqual(["Untouched"]);
    expect(target.GetSheet("Untouched")!.GetAssuredCell("A1").datavalue).toBe(42);
  });

  test("regression: a duplicate sheet-name entry mid-manifest aborts the WHOLE load atomically, leaving the target untouched", async () => {
    const SC = await freshSC();
    const boundary = "SocialCalcWorkbookSave";
    // Two "sheet:" manifest lines with the same (case-insensitive) name —
    // the second AddSheet during staging must fail with DUPLICATE, and the
    // ENTIRE load must be aborted (not just that one sheet skipped).
    const badSave =
      "socialcalc:workbook:version:1.0\n" +
      "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=" +
      boundary +
      "\n--" +
      boundary +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      "# SocialCalc Workbook Save\nversion:1.0\n" +
      "sheet:Dup:visible:yes\n" +
      "sheet:dup:visible:yes\n" +
      "--" +
      boundary +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      "version:1.5\ncell:A1:v:1\nsheet:c:1:r:1\n" +
      "--" +
      boundary +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      "version:1.5\ncell:A1:v:2\nsheet:c:1:r:1\n" +
      "--" +
      boundary +
      "--\n";

    const target = new SC.Workbook();
    target.AddSheet("Original");
    setValue(target.GetSheet("Original"), "A1", 7);

    SC.LoadWorkbookSave(target, badSave);

    expect(target.sheetOrder).toEqual(["Original"]);
    expect(target.GetSheet("Original")!.GetAssuredCell("A1").datavalue).toBe(7);
    expect(target.GetSheet("Dup")).toBeNull();
    // No leaked SheetCache registration from the aborted staging attempt.
    expect(SC.Formula.SheetCache.sheets[SC.WorkbookNormalizeSheetName("Dup")]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Round trip fidelity
// ---------------------------------------------------------------------------

describe("Workbook save/load round trip", () => {
  test("preserves sheet order, active sheet, visibility, values, formulas, and editor settings", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Data");
    wb.AddSheet("Summary");
    wb.AddSheet("Hidden");
    setValue(wb.GetSheet("Data"), "A1", 10);
    setValue(wb.GetSheet("Data"), "A2", 20);
    setFormula(wb.GetSheet("Summary"), "A1", "SUM(Data!A1:A2)");
    wb.SetSheetEditorSettings("Summary", "version:1.0\necell:B2\n");
    wb.HideSheet("Hidden");
    wb.SetActiveSheet("Summary");

    const saved = SC.CreateWorkbookSave(wb);

    const loaded = new SC.Workbook();
    SC.LoadWorkbookSave(loaded, saved);

    expect(loaded.sheetOrder).toEqual(["Data", "Summary", "Hidden"]);
    expect(loaded.activeSheetName).toBe("Summary");
    expect(loaded.IsSheetVisible("Data")).toBe(true);
    expect(loaded.IsSheetVisible("Hidden")).toBe(false);
    expect(loaded.GetSheet("Data")!.GetAssuredCell("A1").datavalue).toBe(10);
    expect(loaded.GetSheet("Data")!.GetAssuredCell("A2").datavalue).toBe(20);
    expect(loaded.GetSheet("Summary")!.GetAssuredCell("A1").formula).toBe("SUM(Data!A1:A2)");
    expect(loaded.GetSheetEditorSettings("Summary")).toBe("version:1.0\necell:B2\n");
  });

  test("round trip preserves a sheet name containing a space and a cell with embedded newline text", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("My Sheet Name");
    setText(wb.GetSheet("My Sheet Name"), "A1", "line one\nline two");

    const saved = SC.CreateWorkbookSave(wb);
    const loaded = new SC.Workbook();
    SC.LoadWorkbookSave(loaded, saved);

    expect(loaded.sheetOrder).toEqual(["My Sheet Name"]);
    expect(loaded.GetSheet("My Sheet Name")!.GetAssuredCell("A1").datavalue).toBe(
      "line one\nline two",
    );
  });

  test("a workbook with no active sheet set explicitly falls back to the first visible sheet on load", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("First");
    wb.AddSheet("Second");
    wb.HideSheet("First");
    // activeSheetName auto-shifted to "Second" by HideSheet's own invariant
    // enforcement; save/load must still land on a VISIBLE sheet.
    const saved = SC.CreateWorkbookSave(wb);

    const loaded = new SC.Workbook();
    SC.LoadWorkbookSave(loaded, saved);

    expect(loaded.IsSheetVisible(loaded.activeSheetName!)).toBe(true);
    expect(loaded.activeSheetName).toBe("Second");
  });

  test("recalc after a round trip still resolves cross-sheet formulas correctly", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("Data");
    wb.AddSheet("Summary");
    setValue(wb.GetSheet("Data"), "A1", 5);
    setFormula(wb.GetSheet("Summary"), "A1", "Data!A1*3");

    const saved = SC.CreateWorkbookSave(wb);
    const loaded = new SC.Workbook();
    SC.LoadWorkbookSave(loaded, saved);

    await new Promise<void>((resolve) => loaded.RecalcAll(() => resolve()));
    expect(loaded.GetSheet("Summary")!.GetAssuredCell("A1").datavalue).toBe(15);
  });

  test("saving an empty workbook (edge case: never populated) produces a save that LoadWorkbookSave correctly refuses (0 sheets < min-1 invariant)", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    const saved = SC.CreateWorkbookSave(wb);
    expect(() => SC.LoadWorkbookSave(new SC.Workbook(), saved)).not.toThrow();

    const loaded = new SC.Workbook();
    loaded.AddSheet("Preexisting");
    SC.LoadWorkbookSave(loaded, saved);
    // The 0-sheet save is rejected outright (see the "zero sheet: lines"
    // regression test above); the preexisting sheet must survive.
    expect(loaded.sheetOrder).toEqual(["Preexisting"]);
  });

  test("regression: a hand-crafted save where every sheet is hidden and no valid active line exists falls back to sheetOrder[0] (never leaves activeSheetName unset on a non-empty workbook)", async () => {
    const SC = await freshSC();
    const boundary = "SocialCalcWorkbookSave";
    // Two sheets, BOTH visible:no, and no "active:" line at all -> the
    // `firstVisible` lookup finds nothing, exercising LoadWorkbookSave's
    // final `staged.sheetOrder[0]!` fallback rather than a visible match.
    const allHiddenSave =
      "socialcalc:workbook:version:1.0\n" +
      "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=" +
      boundary +
      "\n--" +
      boundary +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      "# SocialCalc Workbook Save\nversion:1.0\n" +
      "sheet:First:visible:no\n" +
      "sheet:Second:visible:no\n" +
      "--" +
      boundary +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      "version:1.5\ncell:A1:v:1\nsheet:c:1:r:1\n" +
      "--" +
      boundary +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      "version:1.5\ncell:A1:v:2\nsheet:c:1:r:1\n" +
      "--" +
      boundary +
      "--\n";

    const loaded = new SC.Workbook();
    SC.LoadWorkbookSave(loaded, allHiddenSave);

    expect(loaded.sheetOrder).toEqual(["First", "Second"]);
    expect(loaded.activeSheetName).toBe("First"); // sheetOrder[0] fallback
    expect(loaded.IsSheetVisible("First")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Canonicalization: CreateSheetSave's own canonicalize pass runs per-sheet
// ---------------------------------------------------------------------------

describe("Workbook save canonicalization", () => {
  test("each embedded sheet part canonicalizes through the same CanonicalizeSheet pass as a standalone save", async () => {
    const SC = await freshSC();
    const wb = new SC.Workbook();
    wb.AddSheet("S1");
    const sheet = wb.GetSheet("S1")!;
    // Repeated identical layout values should canonicalize to a shared
    // layout-list index rather than duplicating entries — exercise via the
    // sheet's own canonicalize/save path (used internally by
    // CreateWorkbookSave) and confirm the workbook save contains the exact
    // same canonicalized bytes.
    setValue(sheet, "A1", 1);
    setValue(sheet, "A2", 2);

    const direct = sheet.CreateSheetSave();
    const viaWorkbook = SC.CreateWorkbookSave(wb);
    expect(viaWorkbook).toContain(direct);
  });
});
