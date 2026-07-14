// Differential coverage: formula tokenization and evaluation.
//
// Locks SocialCalc.Formula.ParseFormulaIntoTokens/evaluate_parsed_formula
// against the pinned socialcalc@3.0.8 oracle. These specific formulas were
// chosen because Changes.txt documents them as behavior fixed at some point
// in the 3.0.x line (error-operand propagation through `/`, `^`, `&`,
// comparison precedence, IF condition-error passthrough, VLOOKUP error
// lookup keys, special-constant lexing) — probing confirmed the published
// 3.0.8 tarball already contains all of them, so these are parity
// regression guards rather than intended differences.
import { describe, test } from "vite-plus/test";

import { evaluateFormula, expectParity, loadPair } from "../helpers/differential";

describe("formula tokenization parity", () => {
  test.each([
    "A1+B1",
    'CONCATENATE("a""b",A1)',
    "SUM(A1:A10)",
    'IF(A1>0,"pos","neg")',
    "$A1+A$1+$A$1",
    "Sheet2!A1+B1",
    "#REF!",
    "1.5e10",
  ])("ParseFormulaIntoTokens produces the same token shape for %s", async (formula) => {
    const { candidate, oracle } = await loadPair();
    const candidateTokens = candidate.Formula.ParseFormulaIntoTokens(formula);
    const oracleTokens = oracle.Formula.ParseFormulaIntoTokens(formula);
    const shape = (tokens: typeof candidateTokens) =>
      tokens.map((t) => ({ opcode: t.opcode, text: t.text, type: t.type }));
    expectParity(`tokens(${formula})`, shape(candidateTokens), shape(oracleTokens));
  });
});

describe("formula evaluation parity", () => {
  test.each([
    ["1/0", "division by zero stays #DIV/0!"],
    ['1/"x"', "text divisor becomes #VALUE!"],
    ["1/#REF!", "error divisor propagates #REF!"],
    ['"x"&#REF!', "concat propagates a right-hand error"],
    ["2^#REF!", "power propagates a left-side-safe error operand"],
    ["#REF!^2", "power propagates a base error operand"],
    ["1=2+3", "comparison binds looser than addition"],
    ["1<>2", "not-equal evaluates"],
    ["2>=1", "greater-or-equal evaluates"],
    ["1<=2", "less-or-equal evaluates"],
    ["IF(1/0,1,2)", "IF preserves a #DIV/0! condition error"],
    ["IF(NA(),1,2)", "IF preserves a #N/A condition error"],
    ["#NAME?", "#NAME? lexes as a special constant"],
    ["#N/A", "#N/A lexes as a special constant"],
    ["SUM(N:N)+SUM(T:T)", "whole-column references evaluate"],
  ] as const)("%s (%s)", async (formula, _description) => {
    const { candidate, oracle } = await loadPair();
    const candidateResult = evaluateFormula(candidate, formula);
    const oracleResult = evaluateFormula(oracle, formula);
    expectParity(`evaluate(${formula})`, candidateResult, oracleResult);
  });

  test("VLOOKUP propagates an error lookup key instead of scanning for it", async () => {
    const { candidate, oracle } = await loadPair();
    const formula = "VLOOKUP(1/0,A1:B2,2,0)";
    expectParity(formula, evaluateFormula(candidate, formula), evaluateFormula(oracle, formula));
  });

  test("COUNTIF matches a two-character >= criteria numerically", async () => {
    const { candidate, oracle } = await loadPair();
    for (const SC of [candidate, oracle]) {
      const sheet = new SC.Sheet();
      const a1 = sheet.GetAssuredCell("A1");
      a1.datavalue = 5;
      a1.valuetype = "n";
      const a2 = sheet.GetAssuredCell("A2");
      a2.datavalue = 10;
      a2.valuetype = "n";
    }
    const formula = 'COUNTIF(A1:A2,">=5")';
    expectParity(formula, evaluateFormula(candidate, formula), evaluateFormula(oracle, formula));
  });
});
