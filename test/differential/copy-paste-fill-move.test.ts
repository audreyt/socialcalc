// Differential coverage: copy/paste/cut, filldown/fillright, and
// movepaste/moveinsert. Command syntax mirrors the existing candidate-only
// regressions (clipboard-command-regressions.test.ts, filldown-persistence
// .test.ts, sheet-coverage-a/b.test.ts) — this file re-runs the same shapes
// against the oracle to guard the copy semantics (Offset) vs move semantics
// (Replace) distinction AGENTS.md documents as compatibility-locked.
import { describe, expect, test } from "vite-plus/test";

import { loadPair, runCommands, runDifferentialCommands } from "../helpers/differential";

describe("copy/paste parity", () => {
  test("copy+paste tiles a relative formula across the destination range (Offset semantics)", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      [
        "set C3 value n 30",
        "set C4 value n 40",
        "set D4 formula C4+C3",
        "copy D4 formulas",
        "paste B2:C3 formulas",
      ],
      ["B2", "C2", "B3", "C3"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("cut is copy+erase: source clears and pasted formula keeps Offset semantics", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set C3 value n 30", "set C4 value n 40", "set D4 formula C4+C3", "cut D4 formulas", "paste B2 formulas"],
      ["B2", "D4"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("copy/paste preserves $ absolute and relative markers identically", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set D4 formula $A1+A$1+$A$1", "copy D4 formulas", "paste F6 formulas"],
      ["F6"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });
});

describe("fill parity", () => {
  test("filldown increments a rectangular numeric series without editor.range2", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 1", "set A2 value n 2", "set B1 value n 10", "set B2 value n 20", "filldown A1:B5 all"],
      ["A3", "A4", "A5", "B3", "B4", "B5"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("fillright increments a numeric series across columns", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 10", "set B1 value n 20", "fillright A1:D1 all"],
      ["C1", "D1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("filldown of a formula shifts relative references per row", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set B1 value n 5", "set A1 formula B1*2", "filldown A1:A4 formulas"],
      ["A2", "A3", "A4"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });
});

describe("move parity", () => {
  test("movepaste moves cells in place and rewrites references with Replace semantics", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 5", "set A2 value n 6", "set B1 formula A1+A2", "movepaste A1:A3 C1 all"],
      ["C1", "C2", "B1"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });

  test("movepaste rewrites a named range definition to the moved coordinate", async () => {
    const { candidate, oracle } = await loadPair();
    const commands = ["set A1 value n 5", "name define MYNAME A1", "movepaste A1:A1 C1 all"];
    const candidateSheet = await runCommands(candidate, commands);
    const oracleSheet = await runCommands(oracle, commands);

    expect(candidateSheet.names.MYNAME.definition).toBe(oracleSheet.names.MYNAME.definition);
    expect(candidateSheet.names.MYNAME.definition).toBe("C1");
  });

  test("moveinsert pushes intermediate cells and rewrites references the same way", async () => {
    const { candidate, oracle } = await loadPair();
    const result = await runDifferentialCommands(
      { candidate, oracle },
      ["set A1 value n 1", "set A2 value n 2", "set A3 value n 3", "moveinsert A3 A1 all"],
      ["A1", "A2", "A3"],
    );
    expect(result.candidate).toStrictEqual(result.oracle);
  });
});
