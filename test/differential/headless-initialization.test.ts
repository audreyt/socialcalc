// Differential coverage: headless bundle initialization.
//
// Both the candidate shipping bundle and the pinned socialcalc@3.0.8 oracle
// must expose the same core headless API surface (no DOM/window/document
// required — see AGENTS.md's "compiles the UMD bundle once per isolated
// test worker" note and loadSocialCalc({ browser: false })'s existing
// headless coverage in test/core.test.ts).
import { describe, expect, test } from "vite-plus/test";

import { evaluateFormula, expectParity, loadPair } from "../helpers/differential";

describe("headless initialization parity", () => {
  test("both runtimes export the same core headless API shape", async () => {
    const { candidate, oracle } = await loadPair();

    for (const name of [
      "Sheet",
      "Parse",
      "ParseSheetSave",
      "CreateSheetSave",
      "ScheduleSheetCommands",
      "RecalcSheet",
      "SheetUndo",
      "SheetRedo",
      "OffsetFormulaCoords",
      "AdjustFormulaCoords",
      "ReplaceFormulaCoords",
      "encodeForSave",
      "decodeFromSave",
      "ConvertSaveToOtherFormat",
      "ConvertOtherFormatToSave",
      "rcColname",
      "crToCoord",
      "coordToCr",
    ] as const) {
      expect(typeof candidate[name], `candidate.${name}`).toBe("function");
      expect(typeof oracle[name], `oracle.${name}`).toBe("function");
    }

    expect(typeof candidate.Formula, "candidate.Formula").toBe("object");
    expect(typeof oracle.Formula, "oracle.Formula").toBe("object");
    expect(typeof candidate.FormatNumber, "candidate.FormatNumber").toBe("object");
    expect(typeof oracle.FormatNumber, "oracle.FormatNumber").toBe("object");
  });

  test("a fresh headless Sheet starts with an identical empty shape on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    const candidateSheet = new candidate.Sheet();
    const oracleSheet = new oracle.Sheet();

    expectParity("fresh sheet cell count", Object.keys(candidateSheet.cells).length, Object.keys(oracleSheet.cells).length);
    expectParity("fresh sheet lastcol", candidateSheet.attribs.lastcol, oracleSheet.attribs.lastcol);
    expectParity("fresh sheet lastrow", candidateSheet.attribs.lastrow, oracleSheet.attribs.lastrow);
  });

  test("headless recalculation works without any DOM globals on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();

    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      SC.ParseSheetSave(`version:1.5\ncell:A1:v:2\ncell:B1:vtf:n:0:${SC.encodeForSave("A1*3")}\nsheet:c:2:r:1\n`, sheet);
      const evaluated = evaluateFormula(SC, "A1*3", sheet);
      expect(evaluated.value).toBe(6);
      expect(evaluated.type.startsWith("n")).toBe(true);
    }
  });
});
