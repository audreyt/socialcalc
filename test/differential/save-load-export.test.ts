// Differential coverage: save/load round trips and export/import format
// conversion. Compares specific decoded fields, not whole save strings —
// the raw `.sc` text embeds a version marker and internal ordering that can
// legitimately differ without being a behavioral regression.
import { describe, expect, test } from "vite-plus/test";

import { expectParity, loadPair, runCommands, saveRoundTrip } from "../helpers/differential";

describe("save/load round-trip parity", () => {
  test("ParseSheetSave -> CreateSheetSave round trip preserves cell contents", async () => {
    const { candidate, oracle } = await loadPair();
    const save = "version:1.5\ncell:A1:t:hello\ncell:B1:v:42\nsheet:c:2:r:1\n";
    expectParity("save round trip", saveRoundTrip(candidate, save), saveRoundTrip(oracle, save));
  });

  test("a formula cell round-trips through save/load with the same computed value", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = await runCommands(SC, ["set A1 value n 2", "set B1 formula A1*3"]);
      const save = SC.CreateSheetSave(sheet);
      const reloaded = new SC.Sheet();
      SC.ParseSheetSave(save, reloaded);
      expect(reloaded.cells.B1.formula).toBe("A1*3");
      expect(reloaded.cells.B1.datavalue).toBe(6);
    }
  });

  test("encodeForSave/decodeFromSave round-trips text with newlines and colons", async () => {
    const { candidate, oracle } = await loadPair();
    const text = "line one\nline two: with a colon\nand a\ttab";
    for (const SC of [candidate, oracle]) {
      const encoded = SC.encodeForSave(text);
      expect(SC.decodeFromSave(encoded)).toBe(text);
    }
    expectParity("encodeForSave", candidate.encodeForSave(text), oracle.encodeForSave(text));
  });

  test("filldown persists a rectangular numeric series across a save/reload cycle", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = await runCommands(SC, [
        "set A1 value n 1",
        "set A2 value n 2",
        "filldown A1:A5 all",
      ]);
      const save = sheet.CreateSheetSave();
      const reloaded = new SC.Sheet();
      reloaded.ParseSheetSave(save);
      expect(reloaded.cells.A3.datavalue).toBe(3);
      expect(reloaded.cells.A4.datavalue).toBe(4);
      expect(reloaded.cells.A5.datavalue).toBe(5);
    }
  });
});

describe("export/import format parity", () => {
  test("ConvertSaveToOtherFormat(csv) renders numbers and text the same way", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = await runCommands(SC, ["set A1 value n 1", "set B1 formula A1*2"]);
      const csv = SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "csv").trim();
      expect(csv).toBe("1,2");
    }
  });

  test("ConvertSaveToOtherFormat(csv) formats a date cell as a date, not a serial number", async () => {
    const { candidate, oracle } = await loadPair();
    const csvOutputs: string[] = [];
    for (const SC of [candidate, oracle]) {
      const sheet = await runCommands(SC, ["set A1 value nd 40179 1/1/2010"]);
      const csv = SC.ConvertSaveToOtherFormat(sheet.CreateSheetSave(), "csv").trim();
      csvOutputs.push(csv);
      expect(csv).not.toBe("40179");
    }
    expect(csvOutputs[0]).toBe(csvOutputs[1]);
  });

  test("ConvertOtherFormatToSave(csv) parses a formula cell the same way on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      const save = SC.ConvertOtherFormatToSave("1,=A1*2\n", "csv");
      sheet.ParseSheetSave(save);
      const evaluated = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("A1*2"),
        sheet,
      );
      expect(sheet.cells.A1.datavalue).toBe(1);
      expect(evaluated.value).toBe(2);
    }
  });
});
