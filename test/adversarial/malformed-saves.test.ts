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
      // Sheet must remain usable after the malformed parse.
      expect(sheet.GetAssuredCell("A1").coord).toBe("A1");
    }
  });

  test("a cell line truncated mid-record does not corrupt the sheet on either runtime", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = parseIntoFreshSheet(SC, "version:1.5\ncell:A1:v");
      expect(sheet.GetAssuredCell("B1").coord).toBe("B1");
    }
  });

  test("a non-standard negative-looking coordinate does not throw or hang", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = parseIntoFreshSheet(SC, "version:1.5\ncell:A-1:v:5\n");
      expect(sheet.GetAssuredCell("A1").coord).toBe("A1");
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
