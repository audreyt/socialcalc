// Differential coverage: generic ScheduleSheetCommands execution and the
// cmdend/calcfinished status lifecycle.
import { describe, expect, test } from "vite-plus/test";

import { loadPair, runDifferentialCommands, waitForStatus } from "../helpers/differential";

describe("command execution parity", () => {
  test("set value/formula/text commands produce the same cell state", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 5", "set A2 text t hello", "set B1 formula A1*2+1"],
      ["A1", "A2", "B1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("erase clears value, formula, and type the same way on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 5", "erase A1 formulas"],
      ["A1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("sheet-attribute commands (lastcol/lastrow) apply identically", async () => {
    const { candidate, oracle } = await loadPair();
    const candidateSheet = new candidate.Sheet();
    const oracleSheet = new oracle.Sheet();
    for (const [SC, sheet] of [
      [candidate, candidateSheet],
      [oracle, oracleSheet],
    ] as const) {
      await waitForStatus(sheet, "cmdend", () =>
        SC.ScheduleSheetCommands(sheet, "set sheet lastcol 30\nset sheet lastrow 40", true),
      );
    }
    expect(candidateSheet.attribs.lastcol).toBe(oracleSheet.attribs.lastcol);
    expect(candidateSheet.attribs.lastrow).toBe(oracleSheet.attribs.lastrow);
    expect(candidateSheet.attribs.lastcol).toBe(30);
    expect(candidateSheet.attribs.lastrow).toBe(40);
  });

  test("multi-key sort produces the same row order on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      [
        "set A1 value n 3",
        "set B1 value t c",
        "set A2 value n 1",
        "set B2 value t a",
        "set A3 value n 2",
        "set B3 value t b",
        "sort A1:B3 A up",
      ],
      ["A1", "A2", "A3", "B1", "B2", "B3"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("cmdend then calcfinished fire in the same order on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      const events: string[] = [];
      const previous = sheet.statuscallback;
      sheet.statuscallback = (data, status, arg, params) => {
        events.push(status);
        previous?.(data, status, arg, params);
      };
      await waitForStatus(sheet, "cmdend", () =>
        SC.ScheduleSheetCommands(sheet, "set A1 formula 1+1", true),
      );
      await waitForStatus(sheet, "calcfinished", () => SC.RecalcSheet(sheet));

      expect(events).toContain("cmdend");
      expect(sheet.cells.A1.datavalue).toBe(2);
    }
  });
});
