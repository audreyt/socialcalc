// Bounded adversarial coverage: deeply nested formulas must evaluate
// correctly and must not hang. Depths were chosen from measurement (probed
// up to 50,000 nested parens locally with no failure) but are kept modest
// here so the suite stays fast; the timeout is a hang-guard, not a
// performance assertion — see test/performance/ for measured budgets.
import { describe, expect, test } from "vite-plus/test";

import { evaluateFormula, expectParity, loadPair } from "../helpers/differential";

function nestedArithmetic(depth: number): string {
  let formula = "A1";
  for (let i = 0; i < depth; i++) {
    formula = `(${formula}+1)`;
  }
  return formula;
}

function nestedIf(depth: number): string {
  let formula = "1";
  for (let i = 0; i < depth; i++) {
    formula = `IF(1,${formula},0)`;
  }
  return formula;
}

describe("deep formula bounds", () => {
  test("500 levels of parenthesized arithmetic evaluate to the exact expected sum", async () => {
    const { candidate, oracle } = await loadPair();
    const formula = nestedArithmetic(500);
    const sheet = new candidate.Sheet();
    sheet.GetAssuredCell("A1").datavalue = 1;
    sheet.GetAssuredCell("A1").valuetype = "n";
    const oracleSheet = new oracle.Sheet();
    oracleSheet.GetAssuredCell("A1").datavalue = 1;
    oracleSheet.GetAssuredCell("A1").valuetype = "n";

    const candidateResult = evaluateFormula(candidate, formula, sheet);
    const oracleResult = evaluateFormula(oracle, formula, oracleSheet);
    expectParity("500-deep nested arithmetic", candidateResult, oracleResult);
    expect(candidateResult.value).toBe(501);
  });

  test("5,000 levels of parenthesized arithmetic complete without hanging (hang-guard timeout)", async () => {
    const { candidate } = await loadPair();
    const formula = nestedArithmetic(5000);
    const sheet = new candidate.Sheet();
    sheet.GetAssuredCell("A1").datavalue = 1;
    sheet.GetAssuredCell("A1").valuetype = "n";
    const result = evaluateFormula(candidate, formula, sheet);
    expect(result.value).toBe(5001);
  }, 5000);

  test("100 levels of nested IF resolve to the innermost branch on both runtimes", async () => {
    const { candidate, oracle } = await loadPair();
    const formula = nestedIf(100);
    expectParity(
      "100-deep nested IF",
      evaluateFormula(candidate, formula),
      evaluateFormula(oracle, formula),
    );
  });

  test("a wide SUM over 500 cells evaluates to the exact expected total", async () => {
    const { candidate } = await loadPair();
    const sheet = new candidate.Sheet();
    let expected = 0;
    for (let row = 1; row <= 500; row++) {
      const cell = sheet.GetAssuredCell(`A${row}`);
      cell.datavalue = row;
      cell.valuetype = "n";
      expected += row;
    }
    const result = evaluateFormula(candidate, "SUM(A1:A500)", sheet);
    expect(result.value).toBe(expected);
  });
});
