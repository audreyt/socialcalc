import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("name vs FunctionList shadow (zero-arg RPN)", () => {
  // Bare name and empty call share RPN (function_start + name), so N and N()
  // are indistinguishable. Policy: defined sheet names win over FunctionList
  // when there are zero arguments.

  test("name define N/SUM/PI resolve as names; SUM(range) still builtin", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      "name define N =A1*2",
      "name define SUM =A1*2",
      "name define PI =A1*2",
      "name define TOTAL =A1*2",
      "set B1 formula N",
      "set B2 formula N()",
      "set B3 formula SUM",
      "set B4 formula SUM()",
      "set B5 formula PI",
      "set B6 formula PI()",
      "set B7 formula TOTAL",
      "set B8 formula SUM(A1:A1)",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.cells.B1.datavalue).toBe(10);
    expect(sheet.cells.B1.valuetype).toBe("n");
    expect(sheet.cells.B2.datavalue).toBe(10);
    expect(sheet.cells.B3.datavalue).toBe(10);
    expect(sheet.cells.B4.datavalue).toBe(10);
    expect(sheet.cells.B5.datavalue).toBe(10);
    expect(sheet.cells.B6.datavalue).toBe(10);
    expect(sheet.cells.B7.datavalue).toBe(10);
    // range call still uses FunctionList SUM
    expect(sheet.cells.B8.datavalue).toBe(5);
    expect(sheet.cells.B8.valuetype).toBe("n");
  });

  test("without sheet name, bare PI is builtin; bare N/SUM/AND() keep FunctionList arity rules", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set B1 formula N",
      "set B2 formula PI",
      "set B3 formula SUM",
      "set B4 formula SUM(1,2)",
      "set B5 formula AND()",
      "set B6 formula ABS()",
    ]);
    await recalcSheet(SC, sheet);

    // arity>0 FunctionList hit with zero args → FunctionArgsError (not column)
    expect(sheet.cells.B1.valuetype.charAt(0)).toBe("e");
    expect(String(sheet.cells.B1.errors || sheet.cells.B1.datavalue)).toMatch(
      /Incorrect arguments|N/,
    );
    // arity-0 PI still builtin when no sheet name
    expect(sheet.cells.B2.valuetype).toBe("n");
    expect(Number(sheet.cells.B2.datavalue)).toBeCloseTo(Math.PI, 10);
    // bare SUM without name → FunctionArgsError (needs ≥1 arg)
    expect(sheet.cells.B3.valuetype.charAt(0)).toBe("e");
    // SUM with args still works
    expect(sheet.cells.B4.datavalue).toBe(3);
    expect(sheet.cells.B5.valuetype.charAt(0)).toBe("e");
    expect(sheet.cells.B6.valuetype.charAt(0)).toBe("e");
  });
});
