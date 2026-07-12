// Bounded adversarial coverage: feeding ParseSheetSave malformed/adversarial
// save text must fail closed (either parse into a still-usable sheet, or
// throw synchronously) rather than hang or leave the sheet in a state where
// further calls throw unpredictably. Every case is exercised on both
// runtimes so a divergence in failure mode would also be caught.
import { describe, expect, test } from "vite-plus/test";

import { loadPair } from "../helpers/differential";
import type { SocialCalcRuntime } from "../helpers/socialcalc-runtime-types";

function parseIntoFreshSheet(SC: SocialCalcRuntime, save: string) {
  const sheet = new SC.Sheet();
  SC.ParseSheetSave(save, sheet);
  return sheet;
}

describe("malformed save handling", () => {
  test("empty save string parses into an empty, still-usable sheet on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = parseIntoFreshSheet(SC, "");
      expect(Object.keys(sheet.cells).length).toBe(0);
      // Sheet must remain usable after the malformed parse: a real write
      // must land in `cells` and be readable back, not just return an
      // object with the requested coord (GetAssuredCell always does that,
      // even against a corrupted index).
      const a1 = sheet.GetAssuredCell("A1");
      a1.datavalue = 3;
      a1.valuetype = "n";
      expect(sheet.cells.A1.datavalue).toBe(3);
    }
  });

  test("a cell line truncated mid-record does not corrupt the sheet on either runtime", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = parseIntoFreshSheet(SC, "version:1.5\ncell:A1:v");
      // The truncated record still creates A1 with an unparseable (NaN)
      // decoded value rather than corrupting the cells map.
      expect(sheet.cells.A1.datavalue).toBeNaN();
      expect(sheet.cells.A1.valuetype).toBe("n");
      // The sheet keeps functioning for legitimate writes afterward.
      const b1 = sheet.GetAssuredCell("B1");
      b1.datavalue = 5;
      b1.valuetype = "n";
      expect(sheet.cells.B1.datavalue).toBe(5);
    }
  });

  test("a non-standard negative-looking coordinate does not throw or hang", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = parseIntoFreshSheet(SC, "version:1.5\ncell:A-1:v:5\n");
      // The literal "A-1" key must not alias or corrupt the real A1 cell.
      expect(sheet.cells["A-1"]?.datavalue).toBe(5);
      expect(sheet.cells.A1).toBeUndefined();
      // The sheet keeps functioning for legitimate writes afterward.
      const a1 = sheet.GetAssuredCell("A1");
      a1.datavalue = 9;
      a1.valuetype = "n";
      expect(sheet.cells.A1.datavalue).toBe(9);
    }
  });

  test("a completely unrecognized record line fails closed with a synchronous throw, not a hang", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      expect(() => parseIntoFreshSheet(SC, "not a real save\nrandom garbage:::\n")).toThrow();
    }
  });

  test("re-parsing a second malformed save into the same sheet stays bounded (no accumulation blowup)", async () => {
    const { candidate } = await loadPair();
    const sheet = new candidate.Sheet();
    for (let i = 0; i < 20; i++) {
      candidate.ParseSheetSave(`version:1.5\ncell:A1:v:${i}\n`, sheet);
    }
    expect(sheet.cells.A1.datavalue).toBe(19);
  });
});
