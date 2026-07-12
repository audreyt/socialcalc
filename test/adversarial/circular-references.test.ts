// Bounded adversarial coverage: circular formula references must resolve
// (with a circular-reference error or otherwise) within a bounded
// recalculation instead of hanging the recalc scheduler.
import { describe, test } from "vite-plus/test";

import { expectParity, loadPair, recalcSheet, scheduleCommands } from "../helpers/differential";

describe("circular reference handling", () => {
  test("A1 referencing itself resolves within a bounded recalc on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    const outcomes: Array<{ datavalue: unknown; valuetype: string }> = [];
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, "set A1 formula A1+1", true, 3000);
      await recalcSheet(SC, sheet, 3000);
      outcomes.push({ datavalue: sheet.cells.A1.datavalue, valuetype: sheet.cells.A1.valuetype });
    }
    expectParity("A1=A1+1 self-reference", outcomes[0], outcomes[1]);
  }, 8000);

  test("a two-cell circular chain (A1<->B1) resolves within a bounded recalc on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    const outcomes: Array<{ a1: unknown; a1type: string; b1: unknown; b1type: string }> = [];
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(SC, sheet, ["set A1 formula B1+1", "set B1 formula A1+1"], true, 3000);
      await recalcSheet(SC, sheet, 3000);
      outcomes.push({
        a1: sheet.cells.A1.datavalue,
        a1type: sheet.cells.A1.valuetype,
        b1: sheet.cells.B1.datavalue,
        b1type: sheet.cells.B1.valuetype,
      });
    }
    expectParity("A1<->B1 circular chain", outcomes[0], outcomes[1]);
  }, 8000);

  test("a longer circular chain (A1->B1->C1->A1) still resolves within a bounded recalc", async () => {
    const { candidate, oracle } = await loadPair();
    const outcomes: Array<{ a1type: string; b1type: string; c1type: string }> = [];
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      await scheduleCommands(
        SC,
        sheet,
        ["set A1 formula B1+1", "set B1 formula C1+1", "set C1 formula A1+1"],
        true,
        3000,
      );
      await recalcSheet(SC, sheet, 3000);
      outcomes.push({
        a1type: sheet.cells.A1.valuetype,
        b1type: sheet.cells.B1.valuetype,
        c1type: sheet.cells.C1.valuetype,
      });
    }
    expectParity("A1->B1->C1->A1 circular chain", outcomes[0], outcomes[1]);
  }, 8000);
});
