import { expect, test } from "bun:test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

test("recalculates a broad mix of numeric, logical, text, and date formulas", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const commands = [
        "set A1 value n 2",
        "set A2 value n 4",
        "set A3 value n 8",
        "set A4 text t hello",
        "set B1 formula SUM(A1:A3)",
        "set B2 formula PRODUCT(A1:A3)",
        "set B3 formula MAX(A1:A3)",
        "set B4 formula MIN(A1:A3)",
        "set B5 formula COUNT(A1:A3)",
        "set B6 formula COUNTA(A1:A4)",
        "set C1 formula IF(A1<3,10,20)",
        "set C2 formula AND(A1<3,A2=4)",
        "set C3 formula OR(A1=0,A3=8)",
        "set C4 formula NOT(A1=0)",
        "set C5 formula ABS(-5)",
        "set C6 formula MOD(10,3)",
        "set D1 formula ROUND(PI(),2)",
        "set D2 formula POWER(2,5)",
        "set D3 formula SQRT(81)",
        'set D4 formula LEFT("hello",2)',
        'set D5 formula RIGHT("hello",3)',
        'set D6 formula MID("hello",2,2)',
        'set E1 formula LEN("hello")',
        'set E2 formula FIND("ll","hello")',
        'set E3 formula LOWER("HeLLo")',
        'set E4 formula UPPER("HeLLo")',
        'set E5 formula PROPER("hello world")',
        'set E6 formula TRIM("  spaced   out  ")',
        'set F1 formula CONCATENATE("n=",A1)',
        'set F2 formula EXACT("A","a")',
        'set F3 formula CHOOSE(2,"red","blue","green")',
        "set F4 formula ISBLANK(G1)",
        "set F5 formula ISNUMBER(A1)",
        "set F6 formula ISTEXT(A4)",
        'set G1 formula COUNTIF(A1:A3,">3")',
        'set G2 formula SUMIF(A1:A3,">3",A1:A3)',
        "set G3 formula DATE(2024,1,15)",
        "set G4 formula YEAR(G3)",
        "set G5 formula MONTH(G3)",
        "set G6 formula DAY(G3)",
    ];

    await scheduleCommands(SC, sheet, commands, true, 3000);
    await recalcSheet(SC, sheet, 3000);

    const expectedValues = new Map([
        ["B1", 14],
        ["B2", 64],
        ["B3", 8],
        ["B4", 2],
        ["B5", 3],
        ["B6", 4],
        ["C1", 10],
        ["C2", 1],
        ["C3", 1],
        ["C4", 1],
        ["C5", 5],
        ["C6", 1],
        ["D1", 3.14],
        ["D2", 32],
        ["D3", 9],
        ["D4", "he"],
        ["D5", "llo"],
        ["D6", "el"],
        ["E1", 5],
        ["E2", 3],
        ["E3", "hello"],
        ["E4", "HELLO"],
        ["E5", "Hello World"],
        ["E6", "spaced out"],
        ["F1", "n=2"],
        ["F2", 0],
        ["F3", "blue"],
        ["F4", 0],
        ["F5", 1],
        ["F6", 1],
        ["G1", 2],
        ["G2", 12],
        ["G3", 45306],
        ["G4", 2024],
        ["G5", 1],
        ["G6", 15],
    ]);

    for (const [coord, value] of expectedValues) {
        expect(sheet.GetAssuredCell(coord).datavalue).toBe(value);
    }

    expect(sheet.GetAssuredCell("C2").valuetype).toBe("nl");
    expect(sheet.GetAssuredCell("F3").valuetype).toBe("t");
    expect(sheet.GetAssuredCell("G3").valuetype).toBe("nd");
});

test("parses formulas into tokens and can evaluate them directly", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    await scheduleCommands(
        SC,
        sheet,
        ["set A1 value n 2", "set A2 value n 4", "set B1 formula A1+A2"],
        true,
    );
    await recalcSheet(SC, sheet);

    const parseinfo = SC.Formula.ParseFormulaIntoTokens(
        'SUM(A1:B1)+IF(A2>0,"yes","no")',
    );
    expect(parseinfo.map((token: any) => token.text)).toEqual([
        "SUM",
        "(",
        "A1",
        ":",
        "B1",
        ")",
        "+",
        "IF",
        "(",
        "A2",
        ">",
        "0",
        ",",
        "yes",
        ",",
        "no",
        ")",
    ]);

    const polish = SC.Formula.ConvertInfixToPolish(parseinfo);
    expect(Array.isArray(polish)).toBe(true);
    expect(polish.length).toBeGreaterThan(5);

    const evaluated = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("SUM(A1:A2)+3"),
        sheet,
        false,
    );
    expect(evaluated).toEqual({ value: 9, type: "n", error: null });
});
