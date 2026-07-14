// Bounded adversarial coverage: extreme (but not unbounded — see file
// comment in test/differential/insert-delete-undo-redo.test.ts for the
// ZZ/702 max-column policy) row/column/reference values must resolve
// deterministically on both runtimes instead of throwing unexpectedly or
// hanging.
import { describe, test } from "vite-plus/test";

import { expectParity, loadPair } from "../helpers/differential";

const EXTREME_RANGE_TIMEOUT_MS = process.env.SOCIALCALC_MUTATION_RUN === "1" ? 30_000 : 8000;

describe("extreme column/row algebra", () => {
  test.each([0, -1, -100, 703, 1000, 10000] as const)(
    "rcColname(%i) is deterministic and does not throw on either runtime",
    async (col) => {
      const { candidate, oracle } = await loadPair();
      expectParity(`rcColname(${col})`, candidate.rcColname(col), oracle.rcColname(col));
    },
  );

  test.each(["ZZZZ1", "A99999999", "@#$%1", "", "1A", "A0"] as const)(
    "coordToCr(%s) is deterministic and does not throw on either runtime",
    async (coord) => {
      const { candidate, oracle } = await loadPair();
      expectParity(`coordToCr(${coord})`, candidate.coordToCr(coord), oracle.coordToCr(coord));
    },
  );

  test("a reference far past column ZZ evaluates to #REF! instead of hanging on either runtime", async () => {
    const { candidate, oracle } = await loadPair();
    const formula = "ZZZ100000";
    const candidateResult = candidate.Formula.evaluate_parsed_formula(
      candidate.Formula.ParseFormulaIntoTokens(formula),
      new candidate.Sheet(),
    );
    const oracleResult = oracle.Formula.evaluate_parsed_formula(
      oracle.Formula.ParseFormulaIntoTokens(formula),
      new oracle.Sheet(),
    );
    expectParity(formula, candidateResult.type, oracleResult.type);
  });

  test(
    "SUM over a bounded-but-large row range completes and is deterministic",
    async () => {
      const { candidate, oracle } = await loadPair();
      const formula = "SUM(A1:A5000)";
      const candidateResult = candidate.Formula.evaluate_parsed_formula(
        candidate.Formula.ParseFormulaIntoTokens(formula),
        new candidate.Sheet(),
      );
      const oracleResult = oracle.Formula.evaluate_parsed_formula(
        oracle.Formula.ParseFormulaIntoTokens(formula),
        new oracle.Sheet(),
      );
      expectParity(
        formula,
        { type: candidateResult.type, value: candidateResult.value },
        {
          type: oracleResult.type,
          value: oracleResult.value,
        },
      );
    },
    EXTREME_RANGE_TIMEOUT_MS,
  );
});
