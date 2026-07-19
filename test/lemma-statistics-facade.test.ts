import { describe, expect, test } from "vite-plus/test";

import {
  averageRank,
  doubledAverageRank,
  isValidQuartileExcPosition,
  quartileExcScaledPosition,
} from "../lemma/statistics";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("lemma/statistics RANK.AVG / QUARTILE.EXC policies (Dafny/Lean surface)", () => {
  test("doubledAverageRank: exact-integer core matches the documented formula", () => {
    expect(doubledAverageRank(4, 1)).toBe(8); // singleton: 2*4 + 1 - 1 = 8 (halves to 4)
    expect(doubledAverageRank(1, 2)).toBe(3); // two-way tie at rank 1: 2*1 + 2 - 1 = 3 (halves to 1.5)
    expect(doubledAverageRank(2, 4)).toBe(7); // four-way tie at rank 2: 2*2 + 4 - 1 = 7 (halves to 3.5)
  });

  test("averageRank: singleton tie reduces to bestRank, two/three-way ties average correctly", () => {
    expect(averageRank(4, 1)).toBe(4);
    expect(averageRank(1, 2)).toBe(1.5); // ranks {1,2} average to 1.5
    expect(averageRank(1, 3)).toBe(2); // ranks {1,2,3} average to 2
    expect(averageRank(2, 4)).toBe(3.5); // ranks {2,3,4,5} average to 3.5
  });

  test("quartileExcScaledPosition: matches quart*(n+1) exactly, exhaustively over small n/quart", () => {
    for (let n = 1; n <= 10; n++) {
      for (let quart = 1; quart <= 3; quart++) {
        expect(quartileExcScaledPosition(n, quart)).toBe(quart * (n + 1));
      }
    }
  });

  test("isValidQuartileExcPosition: documented boundary cases", () => {
    // n=11 (Microsoft's documented example): quart 1 and 3 both valid.
    expect(isValidQuartileExcPosition(11, 1)).toBe(true);
    expect(isValidQuartileExcPosition(11, 3)).toBe(true);
    // n=1: quart=1 -> position 1*2/4=0.5 < 1 -> invalid.
    expect(isValidQuartileExcPosition(1, 1)).toBe(false);
    // n=1: quart=2 -> position 2*2/4=1 -> exactly 1, valid.
    expect(isValidQuartileExcPosition(1, 2)).toBe(true);
    // n=2: quart=1 -> position 1*3/4=0.75 < 1 -> invalid.
    expect(isValidQuartileExcPosition(2, 1)).toBe(false);
    // n=3: quart=1 -> position 1*4/4=1 -> exactly 1, valid.
    expect(isValidQuartileExcPosition(3, 1)).toBe(true);
  });

  test("isValidQuartileExcPosition: exhaustive over n 1..20, quart 1..3", () => {
    for (let n = 1; n <= 20; n++) {
      for (let quart = 1; quart <= 3; quart++) {
        const scaled = quart * (n + 1);
        const expected = scaled >= 4 && scaled <= 4 * n;
        expect(isValidQuartileExcPosition(n, quart)).toBe(expected);
      }
    }
  });
});

describe("lemma/statistics vs shipping SocialCalc.Formula mirrors", () => {
  test("DoubledAverageRank: facade and shipping agree exhaustively over small bestRank/tieCount", async () => {
    const SC = await loadSocialCalc();
    for (let bestRank = 1; bestRank <= 10; bestRank++) {
      for (let tieCount = 1; tieCount <= 5; tieCount++) {
        expect(SC.Formula.DoubledAverageRank(bestRank, tieCount)).toBe(
          doubledAverageRank(bestRank, tieCount),
        );
      }
    }
  });

  test("QuartileExcScaledPosition: facade and shipping agree exhaustively over small n/quart", async () => {
    const SC = await loadSocialCalc();
    for (let n = 1; n <= 20; n++) {
      for (let quart = 0; quart <= 4; quart++) {
        expect(SC.Formula.QuartileExcScaledPosition(n, quart)).toBe(
          quartileExcScaledPosition(n, quart),
        );
      }
    }
  });

  test("IsValidQuartileExcPosition: facade and shipping agree exhaustively over small n/quart", async () => {
    const SC = await loadSocialCalc();
    for (let n = 1; n <= 20; n++) {
      for (let quart = 0; quart <= 4; quart++) {
        expect(SC.Formula.IsValidQuartileExcPosition(n, quart)).toBe(
          isValidQuartileExcPosition(n, quart),
        );
      }
    }
  });

  test("RANK.AVG live formula smoke test: shipping evaluator matches the facade's averageRank", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(
      SC,
      sheet,
      [
        "set A1 value n 10",
        "set A2 value n 10",
        "set A3 value n 8",
        "set A4 value n 6",
        "set B1 formula RANK.AVG(10,A1:A4)",
      ],
      true,
      4000,
    );
    await recalcSheet(SC, sheet, 4000);
    const cell = sheet.GetAssuredCell("B1") as { datavalue: unknown };
    // Two-way tie at best rank 1 (descending, [10,10,8,6]) -> averageRank(1,2) = 1.5.
    expect(cell.datavalue).toBe(averageRank(1, 2));
  });

  test("QUARTILE.EXC live formula smoke test: shipping evaluator matches the facade's domain check", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(
      SC,
      sheet,
      [
        "set A1 value n 42",
        // n=1, quart=1: facade says isValidQuartileExcPosition(1,1) === false -> #NUM!
        "set B1 formula QUARTILE.EXC(A1,1)",
      ],
      true,
      4000,
    );
    await recalcSheet(SC, sheet, 4000);
    const cell = sheet.GetAssuredCell("B1") as { valuetype: string };
    expect(isValidQuartileExcPosition(1, 1)).toBe(false);
    expect(cell.valuetype).toBe("e#NUM!");
  });
});
