// Differential coverage: OffsetFormulaCoords / AdjustFormulaCoords /
// ReplaceFormulaCoords — the formula-reference rewrite helpers AGENTS.md
// calls the compatibility oracle for copy/fill (Offset), structural
// insert/delete (Adjust), and move (Replace).
import { describe, expect, test } from "vite-plus/test";

import { expectParity, loadPair } from "../helpers/differential";

describe("OffsetFormulaCoords parity (copy/fill)", () => {
  test.each([
    ["A1+B1", 1, 2, "B3+C3"],
    ['CONCATENATE("A1 should stay",A1)', 1, 2, 'CONCATENATE("A1 should stay",B3)'],
    ["$A1+A$1+$A$1", 2, 2, "$A3+C$1+$A$1"],
    ["Sheet2!A1+B1", 1, 0, "SHEET2!B1+C1"],
    ['CONCATENATE("a""b""c",A1)', 1, 1, 'CONCATENATE("a""b""c",B2)'],
  ] as const)("offset(%s, +%i, +%i)", async (formula, coloffset, rowoffset, expected) => {
    const { candidate, oracle } = await loadPair();
    const candidateResult = candidate.OffsetFormulaCoords(formula, coloffset, rowoffset);
    const oracleResult = oracle.OffsetFormulaCoords(formula, coloffset, rowoffset);
    expectParity(`offset(${formula})`, candidateResult, oracleResult);
    expect(candidateResult).toBe(expected);
  });

  test("offsetting a reference past column ZZ produces #REF! on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    expectParity("offset(ZZ1,+1,0)", candidate.OffsetFormulaCoords("ZZ1", 1, 0), oracle.OffsetFormulaCoords("ZZ1", 1, 0));
    expect(candidate.OffsetFormulaCoords("ZZ1", 1, 0)).toBe("#REF!");
  });
});

describe("AdjustFormulaCoords parity (structural insert/delete)", () => {
  test.each([
    ["Sheet2!A1+B1", 1, 2, 1, 0, "SHEET2!A1+D1"],
    ["B1+C1", 2, -1, 1, 0, "#REF!+B1"],
  ] as const)("adjust(%s)", async (formula, col, coloffset, row, rowoffset, expected) => {
    const { candidate, oracle } = await loadPair();
    const candidateResult = candidate.AdjustFormulaCoords(formula, col, coloffset, row, rowoffset);
    const oracleResult = oracle.AdjustFormulaCoords(formula, col, coloffset, row, rowoffset);
    expectParity(`adjust(${formula})`, candidateResult, oracleResult);
    expect(candidateResult).toBe(expected);
  });
});

describe("ReplaceFormulaCoords parity (move)", () => {
  test.each([
    ["Sheet2!A1+B1", { A1: "C3", B1: "D4" }, "SHEET2!A1+D4"],
    ["$A1+A$2", { A1: "B5", A2: "B6" }, "$B5+B$6"],
  ] as const)("replace(%s)", async (formula, movedto, expected) => {
    const { candidate, oracle } = await loadPair();
    const candidateResult = candidate.ReplaceFormulaCoords(formula, movedto);
    const oracleResult = oracle.ReplaceFormulaCoords(formula, movedto);
    expectParity(`replace(${formula})`, candidateResult, oracleResult);
    expect(candidateResult).toBe(expected);
  });
});

describe("A1 coordinate algebra parity", () => {
  test.each([1, 2, 26, 27, 28, 100, 701, 702] as const)("rcColname(%i) round-trips through crToCoord", async (col) => {
    const { candidate, oracle } = await loadPair();
    const candidateName = candidate.rcColname(col);
    const oracleName = oracle.rcColname(col);
    expectParity(`rcColname(${col})`, candidateName, oracleName);

    const coord = `${candidateName}1`;
    expectParity(`crToCoord(${col},1)`, candidate.crToCoord(col, 1), oracle.crToCoord(col, 1));
    expectParity(`coordToCr(${coord})`, candidate.coordToCr(coord), oracle.coordToCr(coord));
  });

  test("coordToCr rejects a column run past ZZ instead of hanging on a garbage range", async () => {
    const { candidate, oracle } = await loadPair();
    expectParity("coordToCr(invalid:bad)", candidate.coordToCr("invalid:bad"), oracle.coordToCr("invalid:bad"));
  });
});
