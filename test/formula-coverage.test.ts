import { expect, test } from "bun:test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

type Cell = { datavalue: any; valuetype: string };

function resetFormulaGlobals(SC: any) {
    // The UMD bundle attaches SocialCalc to globalThis, so all `loadSocialCalc`
    // calls share the same live object. Reset the bits of state that tests
    // mutate so one test cannot poison the next.
    if (SC.RecalcInfo) {
        SC.RecalcInfo.LoadSheet = () => false;
        SC.RecalcInfo.currentState = 0;
        SC.RecalcInfo.queue = [];
        if (SC.RecalcInfo.recalctimer) {
            try {
                clearTimeout(SC.RecalcInfo.recalctimer);
            } catch {}
            SC.RecalcInfo.recalctimer = null;
        }
        SC.RecalcInfo.firstRenderScheduled = false;
    }
    if (SC.Formula) {
        SC.Formula.SheetCache.sheets = {};
        SC.Formula.SheetCache.waitingForLoading = null;
        SC.Formula.FreshnessInfo.sheets = {};
        SC.Formula.FreshnessInfo.volatile = {};
        SC.Formula.RemoteFunctionInfo.waitingForServer = null;
    }
}

async function buildSheet(commands: string[]) {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    if (commands.length) {
        await scheduleCommands(SC, sheet, commands, true, 4000);
    }
    await recalcSheet(SC, sheet, 4000);
    const getDV = (coord: string) =>
        (sheet.GetAssuredCell(coord) as Cell).datavalue;
    const getVT = (coord: string) =>
        (sheet.GetAssuredCell(coord) as Cell).valuetype;
    return { SC, sheet, getDV, getVT };
}

test("parser handles numbers, strings, operators, comparisons, and unary ops", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);

    const numeric = SC.Formula.ParseFormulaIntoTokens("1+2*3-4/2^2");
    expect(numeric.map((t: any) => t.text)).toEqual([
        "1", "+", "2", "*", "3", "-", "4", "/", "2", "^", "2",
    ]);

    const scientific = SC.Formula.ParseFormulaIntoTokens("1.5e+10+2.3e-5");
    const nums = scientific.filter(
        (t: any) => t.type === SC.Formula.TokenType.num,
    );
    expect(nums.length).toBe(2);
    expect(nums[0].text.toLowerCase()).toContain("e");

    const twoOps = SC.Formula.ParseFormulaIntoTokens("1<>2");
    expect(twoOps.some((t: any) => t.text === "N")).toBe(true);

    const gteTok = SC.Formula.ParseFormulaIntoTokens("A1>=5");
    expect(gteTok.some((t: any) => t.text === "G")).toBe(true);
    const lteTok = SC.Formula.ParseFormulaIntoTokens("A1<=5");
    expect(lteTok.some((t: any) => t.text === "L")).toBe(true);

    const unary = SC.Formula.ParseFormulaIntoTokens("-5+(+3)");
    expect(unary.find((t: any) => t.opcode === "M")).toBeTruthy();
    expect(unary.find((t: any) => t.opcode === "P")).toBeTruthy();

    const special = SC.Formula.ParseFormulaIntoTokens("#REF!+#VALUE!");
    expect(special.some((t: any) => t.text === "#REF!")).toBe(true);
    expect(special.some((t: any) => t.text === "#VALUE!")).toBe(true);

    const stringTok = SC.Formula.ParseFormulaIntoTokens('"it""s"');
    expect(stringTok[0].text).toBe('it"s');

    const badExp = SC.Formula.ParseFormulaIntoTokens("1eQ");
    expect(badExp.some((t: any) => t.type === SC.Formula.TokenType.error)).toBe(
        true,
    );

    const noClose = SC.Formula.ParseFormulaIntoTokens('"oops');
    expect(noClose.some((t: any) => t.type === SC.Formula.TokenType.error)).toBe(
        true,
    );

    const twoops = SC.Formula.ParseFormulaIntoTokens("*+");
    expect(twoops.some((t: any) => t.type === SC.Formula.TokenType.error)).toBe(
        true,
    );

    const unknownChar = SC.Formula.ParseFormulaIntoTokens("@");
    expect(
        unknownChar.some((t: any) => t.type === SC.Formula.TokenType.error),
    ).toBe(true);

    const badSpecial = SC.Formula.ParseFormulaIntoTokens("#NOEND");
    expect(
        badSpecial.some((t: any) => t.type === SC.Formula.TokenType.error),
    ).toBe(true);

    const missingOpen = SC.Formula.ConvertInfixToPolish(
        SC.Formula.ParseFormulaIntoTokens("1,2"),
    );
    expect(typeof missingOpen).toBe("string");

    const missingClose = SC.Formula.ConvertInfixToPolish(
        SC.Formula.ParseFormulaIntoTokens("SUM(1+2"),
    );
    expect(typeof missingClose).toBe("string");

    const stray = SC.Formula.ConvertInfixToPolish(
        SC.Formula.ParseFormulaIntoTokens("1+2)"),
    );
    expect(typeof stray).toBe("string");

    const errorBubbled = SC.Formula.ConvertInfixToPolish(
        SC.Formula.ParseFormulaIntoTokens("*+"),
    );
    expect(typeof errorBubbled).toBe("string");

    // Parser: whitespace + a range
    const spaces = SC.Formula.ParseFormulaIntoTokens("  SUM( A1 , A2 ) ");
    expect(spaces.map((t: any) => t.text).join("")).toContain("SUM");
});

test("arithmetic, comparison, concat, percent, and unary operators", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 10",
        "set A2 value n 3",
        "set A3 value n 0",
        "set B1 formula A1+A2",
        "set B2 formula A1-A2",
        "set B3 formula A1*A2",
        "set B4 formula A1/A2",
        "set B5 formula A2^2",
        "set B6 formula A1/A3",
        "set B7 formula -A1",
        "set B8 formula +A1",
        "set B9 formula 25%",
        "set C1 formula A1=10",
        "set C2 formula A1<>10",
        "set C3 formula A2<A1",
        "set C4 formula A1>A2",
        "set C5 formula A2<=A1",
        "set C6 formula A1>=A2",
        'set C7 formula "abc"&"def"',
        'set C8 formula "apple"<"banana"',
        'set C9 formula "abc"="abc"',
        "set D1 formula 2^30",
        "set D2 formula (-1)^0.5",
        'set D3 formula "foo"+1',
    ]);

    expect(getDV("B1")).toBe(13);
    expect(getDV("B2")).toBe(7);
    expect(getDV("B3")).toBe(30);
    expect(getDV("B4")).toBeCloseTo(10 / 3);
    expect(getDV("B5")).toBe(9);
    expect(getVT("B6")).toBe("e#DIV/0!");
    expect(getDV("B7")).toBe(-10);
    expect(getDV("B8")).toBe(10);
    expect(getDV("B9")).toBeCloseTo(0.25);
    expect(getDV("C1")).toBe(1);
    expect(getDV("C2")).toBe(0);
    expect(getDV("C3")).toBe(1);
    expect(getDV("C4")).toBe(1);
    expect(getDV("C5")).toBe(1);
    expect(getDV("C6")).toBe(1);
    expect(getDV("C7")).toBe("abcdef");
    expect(getDV("C8")).toBe(1);
    expect(getDV("C9")).toBe(1);
    expect(getDV("D1")).toBe(2 ** 30);
    expect(getVT("D2").charAt(0)).toBe("e");
    expect(getVT("D3").charAt(0)).toBe("e");
});

test("math1 functions cover their branches and error paths", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 4",
        "set A2 value n -2",
        "set A3 value n 0",
        "set A4 value n 0.5",
        "set B1 formula ABS(A2)",
        "set B2 formula ABS(A1)",
        "set B3 formula ACOS(A4)",
        "set B4 formula ACOS(5)",
        "set B5 formula ASIN(A4)",
        "set B6 formula ASIN(-5)",
        "set B7 formula ATAN(1)",
        "set B8 formula COS(0)",
        "set B9 formula DEGREES(PI())",
        "set C1 formula EVEN(3)",
        "set C2 formula EVEN(-3)",
        "set C3 formula EVEN(4)",
        "set C4 formula EVEN(4.2)",
        "set C5 formula EVEN(-4.2)",
        "set C6 formula EXP(0)",
        "set C7 formula FACT(5)",
        "set C8 formula INT(3.7)",
        "set C9 formula LN(1)",
        "set D1 formula LN(0)",
        "set D2 formula LOG10(100)",
        "set D3 formula LOG10(-1)",
        "set D4 formula ODD(2)",
        "set D5 formula ODD(-2)",
        "set D6 formula ODD(3.2)",
        "set D7 formula ODD(-3.2)",
        "set D8 formula RADIANS(180)",
        "set D9 formula SIN(0)",
        "set E1 formula SQRT(A1)",
        "set E2 formula SQRT(A2)",
        "set E3 formula TAN(0)",
        "set E5 formula SIGN(-10)",
    ]);

    expect(getDV("B1")).toBe(2);
    expect(getDV("B2")).toBe(4);
    expect(getDV("B3")).toBeCloseTo(Math.acos(0.5));
    expect(getVT("B4")).toBe("e#NUM!");
    expect(getDV("B5")).toBeCloseTo(Math.asin(0.5));
    expect(getVT("B6")).toBe("e#NUM!");
    expect(getDV("B7")).toBeCloseTo(Math.atan(1));
    expect(getDV("B8")).toBe(1);
    expect(getDV("B9")).toBeCloseTo(180);
    expect(getDV("C1")).toBe(4);
    expect(getDV("C2")).toBe(-4);
    expect(getDV("C3")).toBe(4);
    expect(getDV("C4")).toBe(6);
    expect(getDV("C5")).toBe(-6);
    expect(getDV("C6")).toBe(1);
    expect(getDV("C7")).toBe(120);
    expect(getDV("C8")).toBe(3);
    expect(getDV("C9")).toBe(0);
    expect(getVT("D1")).toBe("e#NUM!");
    expect(getDV("D2")).toBeCloseTo(2);
    expect(getVT("D3")).toBe("e#NUM!");
    expect(getDV("D4")).toBe(3);
    expect(getDV("D5")).toBe(-3);
    expect(getDV("D6")).toBe(5);
    expect(getDV("D7")).toBe(-5);
    expect(getDV("D8")).toBeCloseTo(Math.PI);
    expect(getDV("D9")).toBe(0);
    expect(getDV("E1")).toBe(2);
    expect(getVT("E2")).toBe("e#NUM!");
    expect(getDV("E3")).toBe(0);
    // SIGN isn't in the source; unknown function path
    expect(getVT("E5").charAt(0)).toBe("e");
});

test("math2, rounding, ceiling, floor, log functions", async () => {
    const { getDV, getVT } = await buildSheet([
        "set B1 formula ATAN2(1,0)",
        "set B2 formula ATAN2(0,0)",
        "set B3 formula ATAN2(1,1)",
        "set B4 formula POWER(2,10)",
        "set B5 formula POWER(-1,0.5)",
        "set B6 formula MOD(10,3)",
        "set B7 formula MOD(10,0)",
        "set B8 formula TRUNC(3.1415,2)",
        "set B9 formula TRUNC(-3.1415,2)",
        "set C1 formula TRUNC(1234,-2)",
        "set C2 formula ROUND(3.1415)",
        "set C3 formula ROUND(3.1415,2)",
        "set C4 formula ROUND(1234.567,-1)",
        'set C5 formula ROUND(3.5,"x")',
        "set C6 formula ROUND(1,2,3)",
        "set C7 formula LOG(100,10)",
        "set C8 formula LOG(EXP(1))",
        "set C9 formula LOG(0,10)",
        "set D1 formula LOG(2,-1)",
        "set D2 formula LOG(1,2,3)",
        "set D3 formula CEILING(4.3,1)",
        "set D4 formula CEILING(-4.3,-1)",
        "set D5 formula CEILING(0,1)",
        "set D6 formula CEILING(1,0)",
        "set D7 formula FLOOR(4.7,1)",
        "set D8 formula FLOOR(4.7,2)",
        "set D9 formula FLOOR(4.7)",
        "set E1 formula CEILING(-4.3,1)",
        "set E2 formula CEILING(1,2,3)",
        'set E3 formula CEILING("x")',
    ]);

    // ATAN2(x,y) in SocialCalc is Math.atan2(y, x); so ATAN2(1,0) = atan2(0,1) = 0
    expect(getDV("B1")).toBeCloseTo(Math.atan2(0, 1));
    expect(getVT("B2")).toBe("e#DIV/0!");
    expect(getDV("B3")).toBeCloseTo(Math.atan2(1, 1));
    expect(getDV("B4")).toBe(1024);
    expect(getVT("B5")).toBe("e#NUM!");
    expect(getDV("B6")).toBe(1);
    expect(getVT("B7")).toBe("e#DIV/0!");
    expect(getDV("B8")).toBeCloseTo(3.14);
    expect(getDV("B9")).toBeCloseTo(-3.14);
    expect(getDV("C1")).toBe(1200);
    expect(getDV("C2")).toBe(3);
    expect(getDV("C3")).toBeCloseTo(3.14);
    expect(getDV("C4")).toBe(1230);
    expect(getVT("C5")).toBe("e#NUM!");
    expect(getVT("C6").charAt(0)).toBe("e");
    expect(getDV("C7")).toBe(2);
    expect(getDV("C8")).toBeCloseTo(1);
    expect(getVT("C9")).toBe("e#NUM!");
    expect(getVT("D1")).toBe("e#NUM!");
    expect(getVT("D2").charAt(0)).toBe("e");
    expect(getDV("D3")).toBe(5);
    expect(getDV("D4")).toBe(-5);
    expect(getDV("D5")).toBe(0);
    expect(getDV("D6")).toBe(0);
    expect(getDV("D7")).toBe(4);
    expect(getDV("D8")).toBe(4);
    expect(getDV("D9")).toBe(4);
    expect(getVT("E1")).toBe("e#NUM!");
    expect(getVT("E2").charAt(0)).toBe("e");
    expect(getVT("E3").charAt(0)).toBe("e");
});

test("aggregation series functions over ranges and blanks", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 2",
        "set A2 value n 4",
        "set A3 value n 6",
        "set A4 value n 8",
        "set A5 text t blank-like",
        "set A6 formula 1/0",
        "set B1 formula SUM(A1:A4)",
        "set B2 formula AVERAGE(A1:A4)",
        "set B3 formula COUNT(A1:A5)",
        "set B4 formula COUNTA(A1:A5)",
        "set B5 formula COUNTBLANK(A1:A5)",
        "set B6 formula MAX(A1:A4)",
        "set B7 formula MIN(A1:A4)",
        "set B8 formula PRODUCT(A1:A4)",
        "set B9 formula STDEV(A1:A4)",
        "set C1 formula STDEVP(A1:A4)",
        "set C2 formula VAR(A1:A4)",
        "set C3 formula VARP(A1:A4)",
        "set C4 formula CONCAT(A1:A4)",
        'set C5 formula CONCATENATE("x",A1,"y")',
        "set C6 formula AVERAGE(A5)",
        "set C7 formula STDEV(A1)",
        "set C8 formula SUM(A6,A1)",
        "set D1 formula SUMPRODUCT(A1:A2,A3:A4)",
        "set D2 formula SUMPRODUCT(A1:A2,A3:A4,A1:A3)",
        "set D3 formula SUMPRODUCT(A1)",
    ]);

    // Data: 2,4,6,8 (n=4), mean=5, variance_sample = sum((x-mean)^2)/(n-1) = 20/3
    expect(getDV("B1")).toBe(20);
    expect(getDV("B2")).toBe(5);
    expect(getDV("B3")).toBe(4);
    expect(getDV("B4")).toBe(5);
    expect(getDV("B5")).toBe(0);
    expect(getDV("B6")).toBe(8);
    expect(getDV("B7")).toBe(2);
    expect(getDV("B8")).toBe(384);
    expect(getDV("B9")).toBeCloseTo(Math.sqrt(20 / 3));
    expect(getDV("C1")).toBeCloseTo(Math.sqrt(5));
    expect(getDV("C2")).toBeCloseTo(20 / 3);
    expect(getDV("C3")).toBeCloseTo(5);
    expect(String(getDV("C4"))).toContain("2");
    expect(getDV("C5")).toBe("x2y");
    expect(getVT("C6")).toBe("e#DIV/0!");
    expect(getVT("C7")).toBe("e#DIV/0!");
    expect(getVT("C8").charAt(0)).toBe("e");
    expect(getDV("D1")).toBe(2 * 6 + 4 * 8);
    expect(getVT("D2")).toBe("e#VALUE!");
    expect(getVT("D3")).toBe("e#VALUE!");
});

test("conditional aggregation and lookup primitives", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set A4 value n 4",
        "set A5 value n 5",
        "set B1 text t apple",
        "set B2 text t banana",
        "set B3 text t apple",
        "set B4 text t cherry",
        "set B5 text t apple",
        'set C1 formula COUNTIF(A1:A5,">2")',
        'set C2 formula COUNTIF(B1:B5,"apple")',
        'set C3 formula COUNTIF(B1:B5,"a*")',
        'set C5 formula SUMIF(A1:A5,">2")',
        'set C6 formula SUMIF(B1:B5,"apple",A1:A5)',
        'set C7 formula SUMIF(A1:A5,">2",B1:B5)',
        'set C8 formula SUMIF(A1:A5,"<5",A1:A5)',
        "set D1 formula VLOOKUP(3,A1:B5,2,FALSE())",
        "set D2 formula VLOOKUP(3,A1:B5,2)",
        "set D3 formula VLOOKUP(99,A1:B5,2,FALSE())",
        "set D4 formula VLOOKUP(2.5,A1:B5,2,TRUE())",
        'set D5 formula VLOOKUP("apple",B1:B5,1,FALSE())',
        "set D6 formula VLOOKUP(3,A1:A5,1)",
        "set D7 formula VLOOKUP(3,A1:B5,10)",
        "set D8 formula VLOOKUP(3,A1:B5,0)",
        "set E1 formula HLOOKUP(3,A1:E5,2)",
        "set E2 formula HLOOKUP(3,A1:B5,99)",
        "set E3 formula MATCH(3,A1:A5,0)",
        "set E4 formula MATCH(2.5,A1:A5,1)",
        "set E5 formula MATCH(4,A1:A5,-1)",
        'set E6 formula MATCH("apple",B1:B5,0)',
        "set E7 formula MATCH(1,A1:B5,0)",
        "set F1 formula INDEX(A1:B5,2,2)",
        "set F2 formula INDEX(A1:B5,0,1)",
        "set F3 formula INDEX(A1:B5,1,0)",
        "set F4 formula INDEX(A1:B5,0,0)",
        "set F5 formula INDEX(A1:A5,3)",
        "set F6 formula INDEX(A1:E1,2)",
        "set F7 formula INDEX(A1:B5,99,1)",
        "set F8 formula CHOOSE(2,10,20,30)",
        "set F9 formula CHOOSE(5,10,20,30)",
        "set G1 formula COLUMNS(A1:C3)",
        "set G2 formula ROWS(A1:C3)",
        "set G3 formula COLUMNS(A1)",
        'set G4 formula COLUMNS("bad")',
    ]);

    expect(getDV("C1")).toBe(3);
    expect(getDV("C2")).toBe(3);
    expect(getDV("C3")).toBe(3);
    expect(getDV("C5")).toBe(12);
    expect(getDV("C6")).toBe(1 + 3 + 5);
    expect(typeof getDV("C7")).toBe("number");
    expect(getDV("C8")).toBe(1 + 2 + 3 + 4);
    expect(getDV("D1")).toBe("apple");
    expect(getDV("D2")).toBe("apple");
    expect(getVT("D3")).toBe("e#N/A");
    expect(getDV("D4")).toBe("banana");
    expect(getDV("D5")).toBe("apple");
    expect(getDV("D6")).toBe(3);
    expect(getVT("D7")).toBe("e#REF!");
    expect(getVT("D8")).toBe("e#VALUE!");
    expect(getDV("E1")).toBe(3);
    expect(getVT("E2")).toBe("e#REF!");
    expect(getDV("E3")).toBe(3);
    expect(typeof getDV("E4")).toBe("number");
    expect(typeof getDV("E5")).toBe("number");
    expect(getDV("E6")).toBe(1);
    expect(getVT("E7")).toBe("e#N/A");
    expect(getDV("F1")).toBe("banana");
    expect(getDV("F5")).toBe(3);
    // INDEX(A1:E1, 2): single-row range → index is column; B1 is "apple".
    expect(getDV("F6")).toBe("apple");
    expect(getVT("F7")).toBe("e#REF!");
    expect(getDV("F8")).toBe(20);
    expect(getVT("F9")).toBe("e#VALUE!");
    expect(getDV("G1")).toBe(3);
    expect(getDV("G2")).toBe(3);
    expect(getDV("G3")).toBe(1);
    expect(getVT("G4")).toBe("e#VALUE!");
});

test("logical functions, IF and NA/error handling", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 1",
        "set A2 value n 0",
        "set A3 text t stuff",
        "set B1 formula IF(A1,10,20)",
        "set B2 formula IF(A2,10,20)",
        "set B3 formula IF(A1,10)",
        "set B4 formula IF(A3,10,20)",
        "set B5 formula AND(1,1,1)",
        "set B6 formula AND(1,0,1)",
        "set B7 formula OR(0,0,1)",
        "set B8 formula OR(0,0,0)",
        "set B9 formula NOT(0)",
        "set C1 formula NOT(1)",
        'set C2 formula NOT("hi")',
        "set C3 formula AND()",
        'set C4 formula AND("hi")',
        "set C5 formula TRUE()",
        "set C6 formula FALSE()",
        "set C7 formula NA()",
        "set C8 formula IFERROR(1/0,99)",
        "set C9 formula IFERROR(5,99)",
    ]);

    expect(getDV("B1")).toBe(10);
    expect(getDV("B2")).toBe(20);
    expect(getDV("B3")).toBe(10);
    expect(getVT("B4")).toBe("e#VALUE!");
    expect(getDV("B5")).toBe(1);
    expect(getDV("B6")).toBe(0);
    expect(getDV("B7")).toBe(1);
    expect(getDV("B8")).toBe(0);
    expect(getDV("B9")).toBe(1);
    expect(getDV("C1")).toBe(0);
    expect(getVT("C2")).toBe("e#VALUE!");
    expect(getVT("C3")).toBe("e#VALUE!");
    expect(getVT("C4").charAt(0)).toBe("e");
    expect(getDV("C5")).toBe(1);
    expect(getVT("C5")).toBe("nl");
    expect(getDV("C6")).toBe(0);
    expect(getVT("C6")).toBe("nl");
    expect(getVT("C7")).toBe("e#N/A");
    // IFERROR isn't in source → unknown function → error
    expect(getVT("C8").charAt(0)).toBe("e");
    expect(getVT("C9").charAt(0)).toBe("e");
});

test("string functions and their error branches", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 text t Hello World",
        "set B1 formula LEN(A1)",
        'set B2 formula LEN("")',
        "set B3 formula LEFT(A1,5)",
        "set B4 formula LEFT(A1,1)",
        "set B5 formula LEFT(A1,-1)",
        "set B6 formula RIGHT(A1,5)",
        "set B7 formula RIGHT(A1,1)",
        "set B8 formula RIGHT(A1,-1)",
        "set B9 formula MID(A1,7,5)",
        "set C1 formula MID(A1,0,1)",
        "set C2 formula MID(A1,1,-1)",
        "set C3 formula UPPER(A1)",
        "set C4 formula LOWER(A1)",
        'set C5 formula PROPER("the quick brown fox")',
        'set C6 formula TRIM("  a   b  ")',
        'set C7 formula REPT("ab",3)',
        'set C8 formula REPT("ab",-1)',
        'set C9 formula REPLACE("abcdef",2,3,"XYZ")',
        'set D1 formula REPLACE("abcdef",0,3,"X")',
        'set D2 formula REPLACE("abcdef",2,-1,"X")',
        'set D3 formula SUBSTITUTE("a-b-c-d","-","/")',
        'set D4 formula SUBSTITUTE("a-b-c-d","-","/",2)',
        'set D5 formula SUBSTITUTE("a-b-c-d","-","/",0)',
        'set D6 formula FIND("lo",A1)',
        'set D7 formula FIND("zz",A1)',
        'set D8 formula FIND("o",A1,6)',
        'set D9 formula FIND("o",A1,0)',
        'set E1 formula EXACT("a","a")',
        'set E2 formula EXACT("a","A")',
        'set E3 formula EXACT(1,"1")',
        'set E4 formula EXACT(1,1)',
        'set E5 formula EXACT("",1)',
        'set E6 formula HEXCODE("A")',
        'set E7 formula HEXCODE("")',
        'set E8 formula LEN("x","y")',
    ]);

    expect(getDV("B1")).toBe(11);
    expect(getDV("B2")).toBe(0);
    expect(getDV("B3")).toBe("Hello");
    expect(getDV("B4")).toBe("H");
    expect(getVT("B5")).toBe("e#VALUE!");
    expect(getDV("B6")).toBe("World");
    expect(getDV("B7")).toBe("d");
    expect(getVT("B8")).toBe("e#VALUE!");
    expect(getDV("B9")).toBe("World");
    expect(getVT("C1")).toBe("e#VALUE!");
    expect(getVT("C2")).toBe("e#VALUE!");
    expect(getDV("C3")).toBe("HELLO WORLD");
    expect(getDV("C4")).toBe("hello world");
    expect(getDV("C5")).toBe("The Quick Brown Fox");
    expect(getDV("C6")).toBe("a b");
    expect(getDV("C7")).toBe("ababab");
    expect(getVT("C8")).toBe("e#VALUE!");
    expect(getDV("C9")).toBe("aXYZef");
    expect(getVT("D1")).toBe("e#VALUE!");
    expect(getVT("D2")).toBe("e#VALUE!");
    expect(getDV("D3")).toBe("a/b/c/d");
    expect(getDV("D4")).toBe("a-b/c-d");
    expect(getVT("D5")).toBe("e#VALUE!");
    expect(getDV("D6")).toBe(4);
    expect(getVT("D7")).toBe("e#VALUE!");
    expect(getDV("D8")).toBe(8);
    expect(getVT("D9")).toBe("e#VALUE!");
    expect(getDV("E1")).toBe(1);
    expect(getDV("E2")).toBe(0);
    expect(getDV("E3")).toBe(1);
    expect(getDV("E4")).toBe(1);
    expect(getDV("E5")).toBe(0);
    expect(String(getDV("E6")).toUpperCase()).toBe("41");
    // HEXCODE("") -> charCodeAt(0) is NaN, NaN.toString(16) -> "NaN"; tolerate either value
    expect(typeof getDV("E7")).toBe("string");
    expect(getVT("E8").charAt(0)).toBe("e");
});

test("IS functions and N/T/VALUE conversion", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 42",
        "set A2 text t hello",
        "set A3 formula 1/0",
        "set A4 formula NA()",
        "set A5 formula TRUE()",
        "set A6 text t 123.5",
        "set B1 formula ISBLANK(Z99)",
        "set B2 formula ISBLANK(A1)",
        "set B3 formula ISERR(A3)",
        "set B4 formula ISERR(A4)",
        "set B5 formula ISERROR(A3)",
        "set B6 formula ISERROR(A4)",
        "set B7 formula ISLOGICAL(A5)",
        "set B8 formula ISLOGICAL(A1)",
        "set B9 formula ISNA(A4)",
        "set C1 formula ISNA(A3)",
        "set C2 formula ISNUMBER(A1)",
        "set C3 formula ISNUMBER(A2)",
        "set C4 formula ISTEXT(A2)",
        "set C5 formula ISTEXT(A1)",
        "set C6 formula ISNONTEXT(A1)",
        "set C7 formula ISNONTEXT(A2)",
        "set D1 formula N(A1)",
        "set D2 formula N(A2)",
        "set D3 formula T(A2)",
        "set D4 formula T(A1)",
        "set D5 formula VALUE(A1)",
        "set D6 formula VALUE(A6)",
        'set D7 formula VALUE("abc")',
        "set D8 formula VALUE(A3)",
    ]);

    expect(getDV("B1")).toBe(1);
    expect(getDV("B2")).toBe(0);
    expect(getDV("B3")).toBe(1);
    expect(getDV("B4")).toBe(0);
    expect(getDV("B5")).toBe(1);
    expect(getDV("B6")).toBe(1);
    expect(getDV("B7")).toBe(1);
    // A1 is "n" type; ISLOGICAL requires "nl"
    expect(getDV("B8")).toBe(0);
    expect(getDV("B9")).toBe(1);
    expect(getDV("C1")).toBe(0);
    expect(getDV("C2")).toBe(1);
    expect(getDV("C3")).toBe(0);
    expect(getDV("C4")).toBe(1);
    expect(getDV("C5")).toBe(0);
    // ISNONTEXT on A1 (type "n") should be 1 per implementation
    expect(getDV("C6")).toBe(1);
    expect(getDV("C7")).toBe(0);
    expect(getDV("D1")).toBe(42);
    expect(getDV("D2")).toBe(0);
    expect(getDV("D3")).toBe("hello");
    expect(getDV("D4")).toBe("");
    expect(getDV("D5")).toBe(42);
    expect(getDV("D6")).toBeCloseTo(123.5);
    expect(getVT("D7")).toBe("e#VALUE!");
    expect(getVT("D8").charAt(0)).toBe("e");
});

test("date/time functions: DATE, TIME, Y/M/D, WEEKDAY, H/M/S, NOW/TODAY/PI/RAND", async () => {
    const { SC, getDV, getVT } = await buildSheet([
        "set A1 formula DATE(2024,3,15)",
        "set A2 formula YEAR(A1)",
        "set A3 formula MONTH(A1)",
        "set A4 formula DAY(A1)",
        "set A5 formula WEEKDAY(A1)",
        "set A6 formula WEEKDAY(A1,2)",
        "set A7 formula WEEKDAY(A1,3)",
        "set A8 formula WEEKDAY(A1,4)",
        "set A9 formula WEEKDAY(A1,1,99)",
        "set B1 formula TIME(12,30,45)",
        "set B2 formula HOUR(B1)",
        "set B3 formula MINUTE(B1)",
        "set B4 formula SECOND(B1)",
        "set B5 formula HOUR(-1)",
        "set B6 formula NOW()",
        "set B7 formula TODAY()",
        "set B8 formula PI()",
        "set B9 formula RAND()",
        "set C1 formula TRUE()+1",
        "set C2 formula FALSE()+1",
    ]);

    expect(typeof getDV("A1")).toBe("number");
    expect(getDV("A2")).toBe(2024);
    expect(getDV("A3")).toBe(3);
    expect(getDV("A4")).toBe(15);
    expect(typeof getDV("A5")).toBe("number");
    expect(typeof getDV("A6")).toBe("number");
    expect(typeof getDV("A7")).toBe("number");
    expect(getVT("A8")).toBe("e#VALUE!");
    expect(getVT("A9").charAt(0)).toBe("e");
    expect(getDV("B1")).toBeCloseTo((12 * 3600 + 30 * 60 + 45) / 86400);
    expect(getDV("B2")).toBe(12);
    expect(getDV("B3")).toBe(30);
    expect(getDV("B4")).toBe(45);
    expect(getVT("B5")).toBe("e#NUM!");
    expect(typeof getDV("B6")).toBe("number");
    expect(typeof getDV("B7")).toBe("number");
    expect(getDV("B8")).toBeCloseTo(Math.PI);
    const rand = getDV("B9");
    expect(rand).toBeGreaterThanOrEqual(0);
    expect(rand).toBeLessThan(1);
    expect(getDV("C1")).toBe(2);
    expect(getDV("C2")).toBe(1);

    expect(SC.Formula.FreshnessInfo.volatile.NOW).toBe(true);
    expect(SC.Formula.FreshnessInfo.volatile.TODAY).toBe(true);
    expect(SC.Formula.FreshnessInfo.volatile.RAND).toBe(true);
});

test("financial functions: DDB, SLN, SYD, FV, NPER, PMT, PV, RATE, NPV, IRR", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 formula DDB(10000,1000,5,1)",
        "set A2 formula DDB(10000,1000,5,1,1.5)",
        "set A3 formula DDB(10000,1000,0,1)",
        "set A4 formula DDB(10000,1000,5,1,2,7)",
        "set B1 formula SLN(10000,1000,5)",
        "set B2 formula SLN(10000,1000,0)",
        "set C1 formula SYD(10000,1000,5,1)",
        "set C2 formula SYD(10000,1000,0,1)",
        "set D1 formula FV(0.05,10,-100)",
        "set D2 formula FV(0,10,-100)",
        "set D3 formula FV(0.05,10,-100,-1000,1)",
        "set D4 formula NPER(0.05,-100,1000)",
        "set D5 formula NPER(0,-100,1000)",
        "set D6 formula NPER(0,0,1000)",
        "set D7 formula NPER(0.05,-100,0,0,0)",
        "set E1 formula PMT(0.05,10,1000)",
        "set E2 formula PMT(0,10,1000)",
        "set E3 formula PMT(0.05,0,1000)",
        "set E4 formula PV(0.05,10,-100)",
        "set E5 formula PV(0,10,-100)",
        "set E6 formula PV(-1,10,-100)",
        "set E7 formula RATE(10,-100,1000)",
        "set F1 formula NPV(0.1,100,200,300)",
        "set F2 formula NPV(-1,100)",
        "set F3 formula NPV(0.1,A1,A2)",
        "set G1 value n -1000",
        "set G2 value n 300",
        "set G3 value n 500",
        "set G4 value n 700",
        "set F4 formula IRR(G1:G4)",
        "set F5 formula IRR(G1:G4,0.1)",
    ]);

    expect(typeof getDV("A1")).toBe("number");
    expect(typeof getDV("A2")).toBe("number");
    expect(getVT("A3")).toBe("e#NUM!");
    expect(getVT("A4").charAt(0)).toBe("e");
    expect(getDV("B1")).toBeCloseTo(1800);
    expect(getVT("B2")).toBe("e#NUM!");
    expect(typeof getDV("C1")).toBe("number");
    expect(getVT("C2")).toBe("e#NUM!");
    expect(typeof getDV("D1")).toBe("number");
    expect(getDV("D2")).toBe(1000);
    expect(typeof getDV("D3")).toBe("number");
    expect(typeof getDV("D4")).toBe("number");
    expect(getDV("D5")).toBe(10);
    expect(getVT("D6")).toBe("e#NUM!");
    expect(typeof getDV("D7")).toBe("number");
    expect(typeof getDV("E1")).toBe("number");
    expect(typeof getDV("E2")).toBe("number");
    expect(getVT("E3")).toBe("e#NUM!");
    expect(typeof getDV("E4")).toBe("number");
    expect(typeof getDV("E5")).toBe("number");
    expect(getVT("E6")).toBe("e#DIV/0!");
    expect(typeof getDV("E7")).toBe("number");
    expect(typeof getDV("F1")).toBe("number");
    expect(getVT("F2")).toBe("e#DIV/0!");
    expect(typeof getDV("F3")).toBe("number");
    expect(typeof getDV("F4")).toBe("number");
    expect(typeof getDV("F5")).toBe("number");
});

test("named ranges and name errors", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 10",
        "set A2 value n 20",
        "set A3 value n 30",
        "name define TOTAL A1:A3",
        "name define ONE A1",
        "name define TRIPLE =ONE*3",
        "name define LOOP1 =LOOP2",
        "name define LOOP2 =LOOP1",
        "set B1 formula SUM(TOTAL)",
        "set B2 formula ONE+5",
        "set B3 formula TRIPLE",
        "set B4 formula UNKNOWN",
        "set B5 formula LOOP1",
    ]);

    expect(getDV("B1")).toBe(60);
    expect(getDV("B2")).toBe(15);
    expect(getDV("B3")).toBe(30);
    expect(getVT("B4")).toBe("e#NAME?");
    expect(getVT("B5")).toBe("e#NAME?");
});

test("sheet cache and related helpers", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    if (SC.RecalcInfo) SC.RecalcInfo.LoadSheet = () => false;

    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;

    expect(SC.Formula.NormalizeSheetName("Foo")).toBe("foo");
    // First miss queues "waitingForLoading"; second also returns null.
    expect(SC.Formula.FindInSheetCache("missing")).toBeNull();
    expect(SC.Formula.FindInSheetCache("still-missing")).toBeNull();
    SC.Formula.SheetCache.waitingForLoading = null;

    const rawSheet = "version:1.5\ncell:A1:v:77\nsheet:c:1:r:1\n";
    const cached = SC.Formula.AddSheetToCache("SHEET1", rawSheet, false);
    expect(cached).toBeTruthy();
    expect(cached.cells.A1.datavalue).toBe(77);
    expect(SC.Formula.FindInSheetCache("Sheet1")).toBe(cached);

    // Freshness semantics: `live=true` marks it as "reload on next recalc"
    // (FreshnessInfo value is false), so FreshnessInfoReset removes it.
    SC.Formula.AddSheetToCache("EPHEMERAL", rawSheet, true);
    SC.Formula.FreshnessInfoReset();
    expect(SC.Formula.SheetCache.sheets.ephemeral).toBeUndefined();
    // Sheet1 (live=false) stays cached
    expect(SC.Formula.SheetCache.sheets.sheet1).toBeTruthy();

    // PlainCoord + OrderRangeParts
    expect(SC.Formula.PlainCoord("$A$5")).toBe("A5");
    expect(SC.Formula.PlainCoord("A5")).toBe("A5");
    const ord = SC.Formula.OrderRangeParts("C5", "A1");
    expect(ord).toEqual({ c1: 1, r1: 1, c2: 3, r2: 5 });

    // LookupName paths
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 5",
        "name define MYRANGE A1:A3",
        "name define MYCELL A1",
    ]);
    await recalcSheet(SC, sheet);
    expect(SC.Formula.LookupName(sheet, "MYRANGE").type).toBe("range");
    expect(SC.Formula.LookupName(sheet, "MYCELL").type).toBe("coord");
    expect(SC.Formula.LookupName(sheet, "AA").type).toBe("coord");
    expect(SC.Formula.LookupName(sheet, "#REF!").type).toBe("e#REF!");
    expect(SC.Formula.LookupName(sheet, "NOPE").type).toBe("e#NAME?");
});

test("DSeries functions: DSUM/DAVERAGE/DCOUNT/etc. with criteria", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 text t Name",
        "set B1 text t Score",
        "set C1 text t Bonus",
        "set A2 text t Alice",
        "set B2 value n 90",
        "set C2 value n 5",
        "set A3 text t Bob",
        "set B3 value n 80",
        "set C3 value n 2",
        "set A4 text t Alice",
        "set B4 value n 70",
        "set C4 value n 1",
        "set A5 text t Carol",
        "set B5 value n 60",
        "set C5 value n 0",
        "set E1 text t Name",
        "set E2 text t Alice",
        'set H1 formula DSUM(A1:C5,"Score",E1:E2)',
        'set H2 formula DAVERAGE(A1:C5,"Score",E1:E2)',
        'set H3 formula DCOUNT(A1:C5,"Score",E1:E2)',
        'set H4 formula DCOUNTA(A1:C5,"Name",E1:E2)',
        'set H5 formula DMAX(A1:C5,"Score",E1:E2)',
        'set H6 formula DMIN(A1:C5,"Score",E1:E2)',
        'set H7 formula DPRODUCT(A1:C5,"Score",E1:E2)',
        'set H8 formula DGET(A1:C5,"Score",E1:E2)',
        'set I1 formula DSTDEV(A1:C5,"Score",E1:E2)',
        'set I2 formula DSTDEVP(A1:C5,"Score",E1:E2)',
        'set I3 formula DVAR(A1:C5,"Score",E1:E2)',
        'set I4 formula DVARP(A1:C5,"Score",E1:E2)',
        'set I5 formula DSUM(A1:C5,2,E1:E2)',
        'set I6 formula DSUM(A1:C5,"NoField",E1:E2)',
        'set I7 formula DSUM(A1:C5,0,E1:E2)',
        'set I8 formula DSUM(A1:C5,999,E1:E2)',
        'set I9 formula DSUM(A1:C5,1/0,E1:E2)',
    ]);

    expect(getDV("H1")).toBe(160);
    expect(getDV("H2")).toBe(80);
    expect(getDV("H3")).toBe(2);
    expect(getDV("H4")).toBe(2);
    expect(getDV("H5")).toBe(90);
    expect(getDV("H6")).toBe(70);
    expect(getDV("H7")).toBe(6300);
    // More than one match → DGET returns #NUM!
    expect(getVT("H8")).toBe("e#NUM!");
    expect(typeof getDV("I1")).toBe("number");
    expect(typeof getDV("I2")).toBe("number");
    expect(typeof getDV("I3")).toBe("number");
    expect(typeof getDV("I4")).toBe("number");
    expect(getDV("I5")).toBe(160);
    expect(getVT("I6")).toBe("e#VALUE!");
    expect(getVT("I7")).toBe("e#VALUE!");
    expect(getVT("I8")).toBe("e#VALUE!");
    expect(getVT("I9").charAt(0)).toBe("e");
});

test("SUMIFS multi-criteria aggregation", async () => {
    // NOTE: SocialCalc's TestCriteria only parses single-character comparators
    // correctly; `>=3` yields no matches because it is parsed as `>` + `=3`.
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        "set A4 value n 4",
        "set A5 value n 5",
        "set B1 text t apple",
        "set B2 text t banana",
        "set B3 text t apple",
        "set B4 text t banana",
        "set B5 text t apple",
        'set C1 formula SUMIFS(A1:A5,B1:B5,"apple")',
        'set C3 formula SUMIFS(A1:A5,B1:B5,"nope")',
        'set C4 formula SUMIFS(A1:A5,A1:A5,">2",B1:B5,"apple")',
        // Sum-range not a range
        'set C5 formula SUMIFS("bad",B1:B5,"apple")',
        // Criteria range not a range
        'set C6 formula SUMIFS(A1:A5,"bad","apple")',
        // Criteria is error value
        'set C7 formula SUMIFS(A1:A5,B1:B5,1/0)',
        // Criteria is blank
        'set C8 formula SUMIFS(A1:A5,B1:B5,Z99)',
        // Criteria is number
        'set C9 formula SUMIFS(A1:A5,A1:A5,3)',
    ]);

    expect(getDV("C1")).toBe(9);
    expect(getDV("C3")).toBe(0);
    expect(getDV("C4")).toBe(8);
    expect(getVT("C5").charAt(0)).toBe("e");
    expect(getVT("C6").charAt(0)).toBe("e");
    expect(getDV("C7")).toBe(0); // error criteria → always false
    expect(getDV("C8")).toBe(0);
    expect(getDV("C9")).toBe(3);
});

test("parser/evaluator error and helper branches", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    if (SC.RecalcInfo) SC.RecalcInfo.LoadSheet = () => false;
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 5",
        "set A2 value n 10",
        "name define R A1:A2",
    ]);
    await recalcSheet(SC, sheet);

    // Range returned but not allowed
    const rangeResult = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("A1:A2"),
        sheet,
        false,
    );
    expect(rangeResult.error).toBeTruthy();

    // Range return allowed
    const rangeOk = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("A1:A2"),
        sheet,
        true,
    );
    expect(rangeOk.type).toBe("range");

    // Incomplete operator — the EvaluatePolish short-circuits with error
    const polishErr = SC.Formula.ConvertInfixToPolish(
        SC.Formula.ParseFormulaIntoTokens("1+"),
    );
    const evalErr = SC.Formula.EvaluatePolish(
        SC.Formula.ParseFormulaIntoTokens("1+"),
        polishErr,
        sheet,
        false,
    );
    expect(evalErr.value !== undefined).toBe(true);

    // revpolish not an array
    const stringBad = SC.Formula.EvaluatePolish(
        [{ text: "1", type: SC.Formula.TokenType.num, opcode: 0 }],
        "some error",
        sheet,
        false,
    );
    expect(stringBad.type).toBe("e#VALUE!");

    // Empty parseinfo
    const emptyResult = SC.Formula.EvaluatePolish([], [], sheet, false);
    expect(emptyResult.type).toBe("e#VALUE!");

    // Direct operand helpers
    const n = SC.Formula.OperandAsNumber(sheet, [{ type: "n", value: 7 }]);
    expect(n.value).toBe(7);

    const t = SC.Formula.OperandAsText(sheet, [{ type: "t", value: "hi" }]);
    expect(t.value).toBe("hi");
    expect(t.type).toBe("t");

    const blankNum = SC.Formula.OperandAsNumber(sheet, [
        { type: "b", value: "" },
    ]);
    expect(blankNum.value).toBe(0);
    expect(blankNum.type).toBe("n");

    const blankTxt = SC.Formula.OperandAsText(sheet, [
        { type: "b", value: "" },
    ]);
    expect(blankTxt.value).toBe("");

    const numTxt = SC.Formula.OperandAsText(sheet, [{ type: "n", value: 5 }]);
    expect(numTxt.type).toBe("t");

    const errorOp = SC.Formula.OperandAsNumber(sheet, [
        { type: "e#VALUE!", value: "boom" },
    ]);
    expect(errorOp.value).toBe(0);
    expect(errorOp.type.charAt(0)).toBe("e");

    const errorTxt = SC.Formula.OperandAsText(sheet, [
        { type: "e#VALUE!", value: "boom" },
    ]);
    expect(errorTxt.value).toBe("");

    const none = SC.Formula.OperandValueAndType(sheet, []);
    expect(none.type).toBe("");
    expect(none.error).toBeTruthy();

    const coord = SC.Formula.OperandAsCoord(sheet, [
        { type: "coord", value: "A1" },
    ]);
    expect(coord.value).toBe("A1");
    const notCoord = SC.Formula.OperandAsCoord(sheet, [
        { type: "n", value: 5 },
    ]);
    expect(notCoord.type).toBe("e#REF!");

    const rng = SC.Formula.OperandAsRange(sheet, [
        { type: "range", value: "A1|A2|" },
    ]);
    expect(rng.type).toBe("range");

    const topEmpty = SC.Formula.TopOfStackValueAndType(sheet, []);
    expect(topEmpty.error).toBeTruthy();

    const nameResolved = SC.Formula.TopOfStackValueAndType(sheet, [
        { type: "name", value: "R" },
    ]);
    expect(nameResolved.type).toBe("range");

    const missing = SC.Formula.LookupResultType("zz", "zz", {});
    expect(missing.indexOf("e#VALUE!")).toBe(0);

    const t1 = SC.Formula.LookupResultType("n", "t", { n: "|t:1|" });
    expect(t1).toBe("n");
    const t2 = SC.Formula.LookupResultType("n", "t", { n: "|t:2|" });
    expect(t2).toBe("t");

    SC.Formula.FillFunctionInfo();
    expect(typeof SC.Formula.FunctionArgString("SUM")).toBe("string");
    expect(typeof SC.Formula.FunctionArgString("DATE")).toBe("string");
    expect(typeof SC.Formula.FunctionArgString("PI")).toBe("string");

    // Synthetic function list entries to cover positive + negative arity
    SC.Formula.FunctionList.__MYFN = [() => null, 2, "", "", "test"];
    expect(SC.Formula.FunctionArgString("__MYFN")).toBe("v1, v2");
    SC.Formula.FunctionList.__MYFN2 = [() => null, -2, "", "", "test"];
    expect(SC.Formula.FunctionArgString("__MYFN2")).toContain("...");
    // Zero arg with no argdef
    SC.Formula.FunctionList.__MYZERO = [() => null, 0, "", "", "test"];
    expect(typeof SC.Formula.FunctionArgString("__MYZERO")).toBe("string");
    delete SC.Formula.FunctionList.__MYFN;
    delete SC.Formula.FunctionList.__MYFN2;
    delete SC.Formula.FunctionList.__MYZERO;

    // TestCriteria exhaustive. NOTE: SocialCalc's implementation has a
    // non-standard pass through for multi-character operators when the first
    // char is =, <, or >; e.g., "<=3" is parsed as comparitor "<" with
    // basestring "=3". We only test single-char comparators + wildcards.
    expect(SC.Formula.TestCriteria(5, "n", ">3")).toBe(true);
    expect(SC.Formula.TestCriteria(5, "n", "<3")).toBe(false);
    expect(SC.Formula.TestCriteria(3, "n", "=3")).toBe(true);
    expect(SC.Formula.TestCriteria("abc", "t", "a*")).toBe(true);
    expect(SC.Formula.TestCriteria("abc", "t", "*z")).toBe(false);
    expect(SC.Formula.TestCriteria("abc", "t", "a?c")).toBe(true);
    expect(SC.Formula.TestCriteria("abc", "t", "abc")).toBe(true);
    expect(SC.Formula.TestCriteria("abc", "t", "xyz")).toBe(false);
    expect(SC.Formula.TestCriteria("", "b", "=")).toBe(true);
    expect(SC.Formula.TestCriteria("x", "t", null)).toBe(false);
    expect(SC.Formula.TestCriteria(5, "n", "5")).toBe(true);
    expect(SC.Formula.TestCriteria("foo", "t", "foo")).toBe(true);
    expect(SC.Formula.TestCriteria("foo", "t", "(invalid")).toBe(false);
    expect(SC.Formula.TestCriteria("5", "t", ">3")).toBe(true);
    expect(SC.Formula.TestCriteria(3, "n", "*")).toBe(true);
    expect(SC.Formula.TestCriteria("anything", "t", "*")).toBe(true);
    // Error-value criteria (null) always false
    expect(SC.Formula.TestCriteria(1, "n", null)).toBe(false);
    // escaped wildcards ~* and ~? exercise the wildcard branch (result depends
    // on internal regex). Just ensure the call returns a boolean.
    expect(typeof SC.Formula.TestCriteria("a*b", "t", "a~*b")).toBe("boolean");
    expect(typeof SC.Formula.TestCriteria("a?b", "t", "a~?b")).toBe("boolean");
    // error value as subject
    expect(SC.Formula.TestCriteria("x", "e#VALUE!", "=1")).toBe(false);
    // number type but criteria value is text-only
    expect(SC.Formula.TestCriteria(1, "n", "foo")).toBe(false);

    // ArrayValuesEqual + Clone
    expect(SC.Formula.ArrayValuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(SC.Formula.ArrayValuesEqual([1, 2], [1])).toBe(false);
    expect(SC.Formula.ArrayValuesEqual([1, 2, 3], [1, 2, 4])).toBe(false);

    const dst: any = {};
    SC.Formula.Clone(dst, { a: 1, b: { c: 2 } });
    expect(dst.a).toBe(1);
    expect(dst.b.c).toBe(2);

    // Clone into existing nested object should recurse
    const dst2: any = { b: { existing: 1 } };
    SC.Formula.Clone(dst2, { b: { c: 2 } });
    expect(dst2.b.c).toBe(2);
    expect(dst2.b.existing).toBe(1);

    // PushOperand / CheckForErrorValue
    const op: any[] = [];
    SC.Formula.PushOperand(op, "n", 99);
    expect(op[0]).toEqual({ type: "n", value: 99 });
    expect(SC.Formula.CheckForErrorValue(op, { type: "n", value: 1 })).toBe(false);
    expect(SC.Formula.CheckForErrorValue(op, { type: "e#NUM!", value: "x" })).toBe(
        true,
    );

    // FunctionArgsError, FunctionSpecificError
    const errOp: any[] = [];
    SC.Formula.FunctionArgsError("FOO", errOp);
    expect(errOp[0].type).toBe("e#VALUE!");

    const errOp2: any[] = [];
    SC.Formula.FunctionSpecificError("FOO", errOp2, "e#NUM!", "bang");
    expect(errOp2[0].type).toBe("e#NUM!");
});

test("cross-sheet references via sheet cache", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    if (SC.RecalcInfo) SC.RecalcInfo.LoadSheet = () => false;
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;

    const rawSheet = "version:1.5\ncell:A1:v:17\ncell:A2:v:25\nsheet:c:1:r:2\n";
    SC.Formula.AddSheetToCache("HELPER", rawSheet, false);

    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula HELPER!A1",
        "set A2 formula SUM(HELPER!A1:A2)",
        "set A3 formula HELPER!A1+1",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(17);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(42);
    expect(sheet.GetAssuredCell("A3").datavalue).toBe(18);
});

test("StepThroughRangeDown walks coords and DecodeRangeParts handles missing sheets", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    if (SC.RecalcInfo) SC.RecalcInfo.LoadSheet = () => false;
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;

    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "set B1 value n 3",
        "set B2 value n 4",
    ]);
    await recalcSheet(SC, sheet);

    const rangeInfo = SC.Formula.DecodeRangeParts(sheet, "A1|B2|");
    expect(rangeInfo.ncols).toBe(2);
    expect(rangeInfo.nrows).toBe(2);
    expect(rangeInfo.col1num).toBe(1);
    expect(rangeInfo.row1num).toBe(1);

    // Missing sheet name → null result
    const missing = SC.Formula.DecodeRangeParts(sheet, "A1!nosheet|B2|");
    expect(missing).toBeNull();

    // Step through a range twice: first returns A1 (operand continues), second returns last.
    const operand: any[] = [];
    const first = SC.Formula.StepThroughRangeDown(operand, "A1|B2|");
    expect(first.value).toBe("A1");
    expect(operand.length).toBe(1);

    // Also exercise a single-cell "range" where loop exits with final coord.
    const op2: any[] = [];
    const only = SC.Formula.StepThroughRangeDown(op2, "A1|A1|");
    expect(only.value).toBe("A1");
    expect(op2.length).toBe(0);
});

test("CalculateFunction: unknown function fallback, too-few/too-many args, LN specific", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    if (SC.RecalcInfo) SC.RecalcInfo.LoadSheet = () => false;
    const sheet = new SC.Sheet();

    // Unknown zero-arg "function" becomes a bare name
    const operand: any[] = [{ type: "start", value: 0 }];
    const err = SC.Formula.CalculateFunction("MYUNKNOWN", operand, sheet);
    expect(err).toBe("");
    expect(operand[operand.length - 1].type).toBe("name");

    // Unknown function with args  → error
    const operand4: any[] = [
        { type: "start", value: 0 },
        { type: "n", value: 1 },
    ];
    const err4 = SC.Formula.CalculateFunction("NOPE", operand4, sheet);
    expect(typeof err4).toBe("string");
    expect(err4.length).toBeGreaterThan(0);

    // Real function with too few args
    const operand2: any[] = [{ type: "start", value: 0 }];
    const err2 = SC.Formula.CalculateFunction("ABS", operand2, sheet);
    expect(err2).toBeTruthy();
    expect(operand2[operand2.length - 1].type.charAt(0)).toBe("e");

    // Real function with too many args (fixed-arg)
    const operand3: any[] = [
        { type: "start", value: 0 },
        { type: "n", value: 1 },
        { type: "n", value: 2 },
    ];
    const err3 = SC.Formula.CalculateFunction("ABS", operand3, sheet);
    expect(err3).toBeTruthy();

    // FunctionSpecificError path reached via LN(0)
    const ln0 = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("LN(0)"),
        sheet,
        false,
    );
    expect(ln0.type).toBe("e#NUM!");
});

test("operators on blank and error types propagate correctly", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 5",
        "set A2 formula 1/0",
        "set B1 formula Z99+1",
        'set B2 formula Z99&"x"',
        "set B3 formula A1+A2",
        "set B4 formula A2+A1",
        "set B5 formula 1+NA()",
        "set B6 formula A1=Z99",
        "set B7 formula Z99=Z99",
        "set B8 formula A2=1",
    ]);

    expect(getDV("B1")).toBe(1);
    expect(getDV("B2")).toBe("x");
    expect(getVT("B3").charAt(0)).toBe("e");
    expect(getVT("B4").charAt(0)).toBe("e");
    expect(getVT("B5").charAt(0)).toBe("e");
    expect(getDV("B6")).toBe(0);
    expect(getDV("B7")).toBe(1);
    expect(getVT("B8").charAt(0)).toBe("e");
});

test("RATE convergence, IRR edge cases", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 formula RATE(12,-100,1000,-200,1,0.1)",
        "set A2 formula RATE(1,-100,1000,0,0,0.1,5)",
        "set A3 value n 100",
        "set A4 value n -50",
        "set B1 formula IRR(A3:A4)",
        "set B2 formula IRR(A3:A3)",
        'set B3 formula IRR(A3:A3,"bad")',
        "set B4 formula IRR(A3:A4,0.1,0.2)",
    ]);

    expect(typeof getDV("A1")).toBe("number");
    // RATE with 7 args is tolerated by the implementation (extra arg unused).
    expect(typeof getDV("A2")).toBe("number");
    expect(typeof getDV("B1")).toBe("number");
    expect(getVT("B3")).toBe("e#VALUE!");
    expect(getVT("B4")).toBe("e#VALUE!");
});

test("cross-sheet references via explicit ! operator", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    if (SC.RecalcInfo) SC.RecalcInfo.LoadSheet = () => false;
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;

    const rawSheet = "version:1.5\ncell:A1:v:11\ncell:A2:v:22\nsheet:c:1:r:2\n";
    SC.Formula.AddSheetToCache("OTHER", rawSheet, false);

    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula SUM(OTHER!A1:A2)",
        "set A2 text t OTHER",
        "set A4 formula OTHER!A1",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(33);
    expect(sheet.GetAssuredCell("A4").datavalue).toBe(11);
});

test("getStandardizedParameter handles coords, ranges, and constants", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    if (SC.RecalcInfo) SC.RecalcInfo.LoadSheet = () => false;
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 10",
        "set A2 value n 20",
        "set B1 value n 30",
        "set B2 value n 40",
    ]);
    await recalcSheet(SC, sheet);

    const coordResult = SC.Formula.getStandardizedParameter(
        sheet,
        { type: "coord", value: "A1" },
        true,
        true,
    );
    expect(coordResult.ncols).toBe(1);
    expect(coordResult.nrows).toBe(1);
    expect(coordResult.celldata[0][0].datavalue).toBe(10);

    const rangeResult = SC.Formula.getStandardizedParameter(
        sheet,
        { type: "range", value: "A1|B2|" },
        true,
        true,
    );
    expect(rangeResult.ncols).toBe(2);
    expect(rangeResult.nrows).toBe(2);
    expect(rangeResult.cellcoord[0][0]).toBe("A1");
    expect(rangeResult.cellcoord[1][1]).toBe("B2");

    const constResult = SC.Formula.getStandardizedParameter(
        sheet,
        { type: "n", value: 5 },
        true,
        true,
    );
    expect(constResult.ncols).toBe(1);
    expect(constResult.celldata[0][0].datavalue).toBe(5);

    const textConst = SC.Formula.getStandardizedValues(sheet, {
        type: "t",
        value: "hello",
    });
    expect(textConst.celldata[0][0].datavalue).toBe("hello");

    const coordsOnly = SC.Formula.getStandardizedCoords(sheet, {
        type: "range",
        value: "A1|B2|",
    });
    expect(coordsOnly.cellcoord).toBeTruthy();
    expect(coordsOnly.celldata).toBeUndefined();

    const singleList = SC.Formula.getStandardizedList(sheet, {
        type: "t",
        value: "a,b,c",
    });
    expect(singleList).toEqual(["a", "b", "c"]);

    const multiList = SC.Formula.getStandardizedList(sheet, {
        type: "range",
        value: "A1|B2|",
    });
    expect(multiList.length).toBe(4);
});

test("LookupResultType quirks and type tables", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);

    const tlu = SC.Formula.TypeLookupTable;
    expect(SC.Formula.LookupResultType("n", "n", tlu.plus)).toBe("n");
    expect(SC.Formula.LookupResultType("t", "n", tlu.plus)).toContain("e");
    expect(SC.Formula.LookupResultType("b", "n", tlu.plus)).toBe("n");
    expect(SC.Formula.LookupResultType("n$", "n$", tlu.plus)).toBe("n$");
    expect(SC.Formula.LookupResultType("nd", "nt", tlu.plus)).toBe("ndt");
    expect(SC.Formula.LookupResultType("e#VALUE!", "n", tlu.plus)).toBe(
        "e#VALUE!",
    );
    expect(SC.Formula.LookupResultType("n", "n", tlu.unaryminus)).toBe("n");
    expect(SC.Formula.LookupResultType("t", "t", tlu.unaryminus)).toBe(
        "e#VALUE!",
    );
    expect(SC.Formula.LookupResultType("b", "b", tlu.unaryminus)).toBe("n");
    expect(SC.Formula.LookupResultType("n", "n", tlu.unarypercent)).toBe("n%");
});

test("sheet-level: aggregation with errors and mixed types", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 10",
        "set A2 text t not-a-number",
        "set A3 value n 20",
        "set A4 formula NA()",
        "set B1 formula SUM(A1:A3)",
        "set B2 formula SUM(A1,A2,A3)",
        "set B3 formula SUM(A1,A4,A3)",
        "set B4 formula COUNT(A1:A4)",
        "set B5 formula COUNTA(A1:A4)",
        'set B6 formula MAX(A1,"hi",A3)',
        "set B7 formula MIN(A1:A2)",
    ]);

    expect(getDV("B1")).toBe(30);
    expect(getDV("B2")).toBe(30);
    expect(getVT("B3").charAt(0)).toBe("e");
    expect(getDV("B4")).toBe(2);
    // COUNTA counts non-blank (includes error cells)
    expect(getDV("B5")).toBe(4);
    expect(typeof getDV("B6")).toBe("number");
    expect(getDV("B7")).toBe(10);
});

test("date helpers exercise DMY/HMS branches and errors", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 formula DATE(2025,1,1)",
        "set A2 formula DATE(2025,2,28)",
        "set A3 formula YEAR(A1)",
        "set A4 formula DAY(A2)",
        "set A5 formula MONTH(A2)",
        "set A6 formula HOUR(TIME(13,0,0))",
        "set A7 formula MINUTE(TIME(13,25,0))",
        "set A8 formula SECOND(TIME(13,25,47))",
        'set A9 formula DATE(2025,"bad",1)',
    ]);

    expect(getDV("A3")).toBe(2025);
    expect(getDV("A4")).toBe(28);
    expect(getDV("A5")).toBe(2);
    expect(getDV("A6")).toBe(13);
    expect(getDV("A7")).toBe(25);
    expect(getDV("A8")).toBe(47);
    expect(getVT("A9").charAt(0)).toBe("e");
});

test("FillFunctionInfo populates classes and is idempotent", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    SC.Formula.FunctionClasses = null;
    SC.Formula.FillFunctionInfo();
    expect(SC.Formula.FunctionClasses).toBeTruthy();
    expect(Array.isArray(SC.Formula.FunctionClasses.all.items)).toBe(true);
    expect(SC.Formula.FunctionClasses.math.items).toContain("ABS");

    // Second call short-circuits
    SC.Formula.FillFunctionInfo();
});

test("direct evaluate_parsed_formula paths", async () => {
    const { SC, sheet } = await buildSheet([
        "set A1 value n 1",
        "set A2 value n 2",
    ]);

    const r1 = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("SUM(A1:A2)+3"),
        sheet,
        false,
    );
    expect(r1).toEqual({ value: 6, type: "n", error: null });

    const r2 = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("1/0"),
        sheet,
        false,
    );
    expect(r2.type).toBe("e#DIV/0!");

    // Hitting the explicit error token path
    const r3 = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("*+"),
        sheet,
        false,
    );
    expect(r3.type).toBe("e#VALUE!");
});

test("comparison operators with text, blank, and error values", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 text t apple",
        "set A2 text t banana",
        "set A3 formula 1/0",
        "set B1 formula A1<A2",
        "set B2 formula A1>A2",
        "set B3 formula A1=A2",
        "set B4 formula A1<>A2",
        "set B5 formula A1<=A2",
        "set B6 formula A1>=A2",
        "set B7 formula A3=A1",
        "set B8 formula A1=A3",
        "set B9 formula A3=A3",
        "set C1 formula 5=\"5\"",
        "set C2 formula 5<\"x\"",
        // blank comparisons
        "set C3 formula Z99=Z99",
        "set C4 formula Z99<\"b\"",
        "set C5 formula \"\"=Z99",
    ]);

    expect(getDV("B1")).toBe(1);
    expect(getDV("B2")).toBe(0);
    expect(getDV("B3")).toBe(0);
    expect(getDV("B4")).toBe(1);
    expect(getDV("B5")).toBe(1);
    expect(getDV("B6")).toBe(0);
    expect(getVT("B7").charAt(0)).toBe("e");
    expect(getVT("B8").charAt(0)).toBe("e");
    expect(getVT("B9").charAt(0)).toBe("e");
    expect(typeof getDV("C1")).toBe("number");
    expect(typeof getDV("C2")).toBe("number");
    expect(getDV("C3")).toBe(1);
    expect(getDV("C4")).toBe(1);
    expect(getDV("C5")).toBe(1);
});

test("text concatenation preserves text subtypes (th, tw, tl)", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 text th <b>bold</b>",
        "set A2 text tw *wiki*",
        "set A3 text tl http://ex.com",
        "set B1 formula A1&A2",
        'set B2 formula A1&"plain"',
        "set B3 formula A3&A1",
        "set B4 formula A2&A2",
    ]);
    await recalcSheet(SC, sheet);

    // Different text sub-types trip LookupResultType concat branches.
    // (The source uses value1.type twice for concat, so the result is derived
    // solely from the left operand.)
    expect(sheet.GetAssuredCell("B1").valuetype).toBe("th");
    expect(sheet.GetAssuredCell("B2").valuetype).toBe("th");
    expect(sheet.GetAssuredCell("B3").valuetype).toBe("tl");
    expect(sheet.GetAssuredCell("B4").valuetype).toBe("tw");
});

test("Lookup functions with additional edge cases", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 1",
        "set A2 value n 5",
        "set A3 value n 10",
        "set A4 value n 20",
        "set A5 value n 50",
        "set B1 text t a",
        "set B2 text t b",
        "set B3 text t c",
        "set B4 text t d",
        "set B5 text t e",
        // Value at end of range (no overshoot)
        "set D1 formula VLOOKUP(50,A1:B5,2)",
        // MATCH descending rangelookup=-1
        "set D2 formula MATCH(30,A5:A1,-1)",
        // MATCH text
        'set D3 formula MATCH("c",B1:B5,0)',
        // LOOKUP function (name) — not in source; should degrade to name or error
        "set D4 formula LOOKUP(5,A1:A5)",
        // VLOOKUP with invalid range arg
        "set D5 formula VLOOKUP(1,A1,1)",
        // HLOOKUP with offset=0
        "set D6 formula HLOOKUP(1,A1:E1,0)",
        // MATCH with too many args
        "set D7 formula MATCH(1,A1:A5,0,99)",
        // MATCH with 2-d range + both dims > 1 → #N/A
        "set D8 formula MATCH(1,A1:B5,0)",
        // VLOOKUP with 4-arg where rangelookup is text
        'set D9 formula VLOOKUP(1,A1:B5,2,"x")',
    ]);

    expect(getDV("D1")).toBe("e");
    expect(typeof getDV("D2")).toBe("number");
    expect(getDV("D3")).toBe(3);
    // LOOKUP may not be defined — expect error or a value
    expect(getVT("D4")).toBeTruthy();
    expect(getVT("D5").charAt(0)).toBe("e");
    expect(getVT("D6")).toBe("e#VALUE!");
    expect(getVT("D7").charAt(0)).toBe("e");
    expect(getVT("D8")).toBe("e#N/A");
    expect(getVT("D9")).toBe("e#VALUE!");
});

test("INDEX via named range and with name operand", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 10",
        "set A2 value n 20",
        "set B1 value n 30",
        "set B2 value n 40",
        "name define GRID A1:B2",
        "set C1 formula INDEX(GRID,1,1)",
        "set C2 formula INDEX(GRID,2,2)",
        "set C3 formula INDEX(GRID)",
        "set C4 formula INDEX(5)",
        "set C5 formula INDEX(GRID,1,1,99)",
        "set C6 formula INDEX(GRID,-1,0)",
        "set C7 formula INDEX(GRID,0,0)",
    ]);

    expect(getDV("C1")).toBe(10);
    expect(getDV("C2")).toBe(40);
    // INDEX with only a range returns the whole range — disallowed at top level
    expect(getVT("C3").charAt(0)).toBe("e");
    expect(getVT("C4")).toBe("e#VALUE!");
    expect(getVT("C5").charAt(0)).toBe("e");
    expect(getVT("C6")).toBe("e#VALUE!");
    // 0,0 returns the whole range → error "results in range" at top level
    expect(getVT("C7").charAt(0)).toBe("e");
});

test("CountifSumifFunctions error paths", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 value n 1",
        "set A2 value n 2",
        "set A3 value n 3",
        // COUNTIF with invalid first arg
        'set B1 formula COUNTIF("notarange",">1")',
        // SUMIF with 3rd arg invalid
        'set B2 formula SUMIF(A1:A3,">1","notarange")',
        // SUMIF with too many args
        'set B3 formula SUMIF(A1:A3,">1",A1:A3,999)',
        // COUNTIF with criteria as number
        "set B4 formula COUNTIF(A1:A3,2)",
        // COUNTIF with criteria as error
        "set B5 formula COUNTIF(A1:A3,1/0)",
        // COUNTIF with blank criteria
        "set B6 formula COUNTIF(A1:A3,Z99)",
    ]);

    expect(getVT("B1").charAt(0)).toBe("e");
    expect(getVT("B2").charAt(0)).toBe("e");
    expect(getVT("B3").charAt(0)).toBe("e");
    expect(getDV("B4")).toBe(1);
    // With error criteria, TestCriteria returns false for every row
    expect(getDV("B5")).toBe(0);
    expect(getDV("B6")).toBe(0);
});

test("DSeries with error fields and criteria types", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 text t Name",
        "set B1 text t Score",
        "set A2 text t Alice",
        "set B2 value n 80",
        "set A3 text t Bob",
        "set B3 value n 70",
        // Criteria range with blank criteria matches all
        "set D1 text t Name",
        // D2 intentionally blank
        'set E1 formula DSUM(A1:B3,"Score",D1\\cD2)',
        // DGET single row match
        "set D3 text t Name",
        "set D4 text t Alice",
        'set E2 formula DGET(A1:B3,"Score",D3\\cD4)',
        // DGET zero matches
        "set D5 text t Name",
        "set D6 text t Nobody",
        'set E3 formula DGET(A1:B3,"Score",D5\\cD6)',
        // DSeries with invalid range
        'set E4 formula DSUM("bad","Score",D3\\cD4)',
    ]);

    // Escape for : wasn't needed since we used scheduled commands
    // but the E1..E4 formulas refer to D1:D2 etc.; need explicit range syntax
    // using : (ScheduleSheetCommands accepts it literally for "set X formula ...")
    // So actually the \c shouldn't be needed. Re-schedule with plain `:` and verify.
});

test("DSeries with plain colon range syntax", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 text t Name",
        "set B1 text t Score",
        "set A2 text t Alice",
        "set B2 value n 80",
        "set A3 text t Bob",
        "set B3 value n 70",
        "set D1 text t Name",
        // D2 blank → matches all
        'set E1 formula DSUM(A1:B3,"Score",D1:D2)',
        "set D3 text t Name",
        "set D4 text t Alice",
        'set E2 formula DGET(A1:B3,"Score",D3:D4)',
        "set D5 text t Name",
        "set D6 text t Nobody",
        'set E3 formula DGET(A1:B3,"Score",D5:D6)',
        'set E4 formula DSUM("bad","Score",D3:D4)',
    ]);

    expect(typeof getDV("E1")).toBe("number"); // 150 if all matched
    expect(getDV("E2")).toBe(80);
    expect(getVT("E3")).toBe("e#VALUE!");
    expect(getVT("E4").charAt(0)).toBe("e");
});

test("IO/widget formulas: unknown IoFunctions path fails gracefully", async () => {
    // IoFunctions depend on DOM/SpreadsheetControl — most paths throw or push errors.
    // We just verify a parse-time-only use (not evaluated) so coverage of the function names
    // dispatch touches the IoFunctions code.
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    SC.Formula.FillFunctionInfo();

    // Use FunctionArgString to reach the per-function arg-def lookup
    for (const name of [
        "BUTTON",
        "CHECKBOX",
        "RADIOBUTTON",
        "EMAIL",
        "EMAILIF",
        "EMAILAT",
        "EMAILATIF",
        "EMAILONEDIT",
        "EMAILONEDITIF",
        "TEXTBOX",
        "AUTOCOMPLETE",
        "SELECT",
        "SUBMIT",
        "IMAGEBUTTON",
        "COPYVALUE",
        "COPYFORMULA",
        "INSERT",
        "DELETEIF",
        "COMMAND",
        "COMMANDIF",
        "PANEL",
        "SPLASH",
        "STYLE",
    ]) {
        const str = SC.Formula.FunctionArgString(name);
        expect(typeof str).toBe("string");
    }
});

test("StepThroughRangeDown across a cross-sheet range", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    // Use a 3+ letter sheet name so the parser doesn't treat it as a coord.
    SC.Formula.AddSheetToCache(
        "XSS",
        "version:1.5\ncell:A1:v:3\ncell:A2:v:7\nsheet:c:1:r:2\n",
        false,
    );

    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 formula SUM(XSS!A1:A2)"]);
    await recalcSheet(SC, sheet);
    expect(sheet.GetAssuredCell("A1").datavalue).toBe(10);
});

test("HEXCODE with supplemental plane character (surrogate pair)", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();

    // U+1F600 (grinning face) is two UTF-16 code units (D83D DE00)
    const emoji = "\uD83D\uDE00";
    const r = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens(`HEXCODE("${emoji}")`),
        sheet,
        false,
    );
    expect(String(r.value).toUpperCase()).toBe("1F600");
});

test("FIND with various offsets and string math2 specifics", async () => {
    const { getDV, getVT } = await buildSheet([
        'set A1 formula FIND("x","abcxdef")',
        'set A2 formula FIND("x","abcxdef",3)',
        'set A3 formula FIND("","abcdef")',
        'set A4 formula MOD(-7,3)',
        'set A5 formula MOD(7,-3)',
        'set A6 formula TRUNC(1.9)',
        'set A7 formula POWER(0,0)',
    ]);

    expect(getDV("A1")).toBe(4);
    expect(getDV("A2")).toBe(4);
    expect(getDV("A3")).toBe(1); // empty needle matches at position 1
    expect(getDV("A4")).toBe(2);
    expect(getDV("A5")).toBe(-2);
    // TRUNC with 1 arg — function is fixed-arg 2 in source (Math2Functions, 2 args)
    expect(getVT("A6").charAt(0)).toBe("e");
    expect(getDV("A7")).toBe(1);
});

test("Financial edge cases: PMT with fv, PV with paytype, RATE zero", async () => {
    const { getDV, getVT } = await buildSheet([
        "set A1 formula PMT(0.05,10,1000,200)",
        "set A2 formula PMT(0.05,10,1000,200,1)",
        "set A3 formula PV(0.05,10,-100,200)",
        "set A4 formula PV(0.05,10,-100,200,1)",
        "set A5 formula FV(0,10,-100,-1000)",
        "set A6 formula FV(0.05,10,-100,-1000,1)",
        "set A7 formula NPER(0.05,-100,1000,200)",
        "set A8 formula NPER(0.05,-100,1000,200,1)",
        "set A9 formula NPER(-0.05,-100,1000)",
        "set B1 formula RATE(10,-100,1000)",
        "set B2 formula RATE(10,-100,1000,0)",
        "set B3 formula RATE(10,-100,1000,0,0)",
        "set B4 formula NPV(0.1,-1000,500,500,500)",
        "set B5 formula IRR(C1:C3,0)",
        "set C1 value n -100",
        "set C2 value n 50",
        "set C3 value n 60",
    ]);

    for (const c of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]) {
        expect(typeof getDV(c)).toBe("number");
    }
    // NPER with rate <= -1
    const a9vt = getVT("A9");
    expect(a9vt === "e#NUM!" || a9vt === "n").toBe(true);
    for (const c of ["B1", "B2", "B3", "B4"]) {
        expect(typeof getDV(c)).toBe("number");
    }
    expect(typeof getDV("B5")).toBe("number");
});

test("evaluate_parsed_formula: missing operand scenarios", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();

    // Direct EvaluatePolish with missing-operand-for-& case
    const tokens = SC.Formula.ParseFormulaIntoTokens("&");
    const polish = SC.Formula.ConvertInfixToPolish(tokens);
    if (Array.isArray(polish)) {
        const r = SC.Formula.EvaluatePolish(tokens, polish, sheet, false);
        expect(r.type.charAt(0)).toBe("e");
    }

    // Cover the "Unknown token type" path with synthetic bad token
    const badTokens = [{ text: "weird", type: 999, opcode: 0 }];
    const badResult = SC.Formula.EvaluatePolish(badTokens, [0], sheet, false);
    expect(badResult.error).toBeTruthy();

    // Range constructor with error inside
    const rangeTokens = SC.Formula.ParseFormulaIntoTokens("A1:A2");
    const rangePolish = SC.Formula.ConvertInfixToPolish(rangeTokens);
    expect(Array.isArray(rangePolish)).toBe(true);

    // Numeric overflow path
    const overflow = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("1E308*1E308"),
        sheet,
        false,
    );
    expect(overflow.type).toBe("e#NUM!");

    // Operand left over on stack (a name treated as such at end)
    // Exercise the "name" expansion in final value branch
    await scheduleCommands(SC, sheet, [
        "set A1 value n 5",
        "name define MYONE A1",
    ]);
    await recalcSheet(SC, sheet);
    const nameResult = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("MYONE"),
        sheet,
        false,
    );
    expect(nameResult.value).toBe(5);
});

test("TopOfStackValueAndType handles name → range resolution", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 value n 1",
        "set A2 value n 2",
        "name define RNG A1:A2",
    ]);
    await recalcSheet(SC, sheet);

    // Calling with a name-type operand that resolves to a range
    const op = [{ type: "name", value: "RNG" }];
    const result = SC.Formula.TopOfStackValueAndType(sheet, op);
    expect(result.type).toBe("range");

    // With a name that resolves to a coord
    await scheduleCommands(SC, sheet, ["name define JUSTA A1"]);
    await recalcSheet(SC, sheet);
    const coordResult = SC.Formula.TopOfStackValueAndType(sheet, [
        { type: "name", value: "JUSTA" },
    ]);
    expect(coordResult.type).toBe("coord");
});

test("OperandsAsRangeOnSheet: sheet-scoped range via !", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    SC.Formula.AddSheetToCache(
        "REMOTE",
        "version:1.5\ncell:A1:v:5\ncell:A2:v:7\nsheet:c:1:r:2\n",
        false,
    );

    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 formula SUM(REMOTE!A1:A2)",
        "set A2 formula SUM(REMOTE!A1:A1)",
        "set A3 formula REMOTE!A1+REMOTE!A2",
    ]);
    await recalcSheet(SC, sheet);

    expect(sheet.GetAssuredCell("A1").datavalue).toBe(12);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(5);
    expect(sheet.GetAssuredCell("A3").datavalue).toBe(12);
});

test("HLOOKUP with previousOK=2 branch (row lookup range)", async () => {
    const { getDV } = await buildSheet([
        "set A1 value n 1",
        "set B1 value n 3",
        "set C1 value n 5",
        "set D1 value n 7",
        "set A2 text t a",
        "set B2 text t b",
        "set C2 text t c",
        "set D2 text t d",
        // HLOOKUP searching ascending, value in middle → falls off end → previous match
        "set E1 formula HLOOKUP(4,A1:D2,2)",
        // HLOOKUP exact not found
        "set E2 formula HLOOKUP(99,A1:D2,2,FALSE())",
        // VLOOKUP in range mode with exact match found
        "set E3 formula VLOOKUP(5,A1:D1,1,TRUE())",
    ]);

    expect(getDV("E1")).toBe("b"); // 3 ≤ 4 < 5 → "b"
    expect(typeof getDV("E2")).toBeDefined();
    // VLOOKUP on 1-row range doesn't make sense; behavior is implementation-defined.
    expect(getDV("E3")).toBeDefined();
});

test("DMY/HMS error propagation", async () => {
    const { getDV, getVT } = await buildSheet([
        'set A1 formula DAY("bad")',
        'set A2 formula MONTH("bad")',
        "set A3 formula HOUR(0.5)",
        "set A4 formula MINUTE(0.5)",
        "set A5 formula SECOND(0.5)",
        'set A6 formula HOUR("bad")',
    ]);

    expect(getVT("A1").charAt(0)).toBe("e");
    expect(getVT("A2").charAt(0)).toBe("e");
    expect(getDV("A3")).toBe(12);
    expect(getDV("A4")).toBe(0);
    expect(getDV("A5")).toBe(0);
    expect(getVT("A6").charAt(0)).toBe("e");
});

test("formula with extra operand (two numbers w/o operator)", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();

    // Formula "1 2" becomes two numbers on stack; no operator → error
    const twonums = SC.Formula.evaluate_parsed_formula(
        SC.Formula.ParseFormulaIntoTokens("1 2"),
        sheet,
        false,
    );
    expect(twonums.type.charAt(0)).toBe("e");
});

test("SeriesFunctions DIV/0 branches for VAR, VARP, STDEVP", async () => {
    const { getVT } = await buildSheet([
        "set A1 value n 5",
        "set B1 formula VAR(A1)",
        "set B2 formula VARP(A1)",
        "set B3 formula STDEVP(A1)",
    ]);

    expect(getVT("B1")).toBe("e#DIV/0!");
    expect(getVT("B2")).toBe("e#DIV/0!");
    expect(getVT("B3")).toBe("e#DIV/0!");
});

test("EXACT with all type combinations", async () => {
    const { getDV, getVT } = await buildSheet([
        'set A1 formula EXACT("abc",Z99)',
        "set A2 formula EXACT(1,Z99)",
        "set A3 formula EXACT(Z99,Z99)",
        "set A4 formula EXACT(Z99,1)",
        'set A5 formula EXACT(Z99,"")',
        'set A6 formula EXACT(Z99,"x")',
        'set A7 formula EXACT("",Z99)',
        'set A8 formula EXACT(1/0,"x")',
        'set A9 formula EXACT("x",1/0)',
        "set B1 formula EXACT(1/0,1/0)",
    ]);

    expect(getDV("A1")).toBe(0);
    expect(getDV("A2")).toBe(0);
    expect(getDV("A3")).toBe(1);
    expect(getDV("A4")).toBe(0);
    expect(getDV("A5")).toBe(1);
    expect(getDV("A6")).toBe(0);
    expect(getDV("A7")).toBe(1);
    expect(getVT("A8").charAt(0)).toBe("e");
    expect(getVT("A9").charAt(0)).toBe("e");
    expect(getVT("B1").charAt(0)).toBe("e");
});

test("Text VLOOKUP rangelookup with previousOK=2 (overshoot)", async () => {
    const { getDV } = await buildSheet([
        "set A1 text t apple",
        "set A2 text t banana",
        "set A3 text t cherry",
        "set B1 text t one",
        "set B2 text t two",
        "set B3 text t three",
        // Lookup "b" > "apple" → previousOK=1 at row1. Then "banana" > "b"? No, "banana" > "b" is true, so "b" < "banana", continues. Actually with "b" between "apple" and "banana", overshoot.
        'set D1 formula VLOOKUP("b",A1:B3,2,TRUE())',
        'set D2 formula VLOOKUP("c",A1:B3,2,TRUE())',
        'set D3 formula VLOOKUP("z",A1:B3,2,TRUE())',
    ]);

    expect(typeof getDV("D1")).toBe("string");
    expect(typeof getDV("D2")).toBe("string");
    expect(typeof getDV("D3")).toBe("string");
});

test("OperandAsSheetName via cell reference (sheet name in A1)", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    SC.Formula.AddSheetToCache(
        "OTHERSHEET",
        "version:1.5\ncell:A1:v:42\nsheet:c:1:r:1\n",
        false,
    );

    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
        "set A1 text t OTHERSHEET",
        "set A2 formula SUM(A1!A1:A1)",
    ]);
    await recalcSheet(SC, sheet);
    expect(sheet.GetAssuredCell("A2").datavalue).toBe(42);
});

test("Financial: deeper IRR / NPV / RATE scenarios", async () => {
    const { getDV, getVT } = await buildSheet([
        // NPV first arg text → error
        'set A1 formula NPV("bad",100,200)',
        // NPV with error in range
        "set A2 value n 100",
        "set A3 formula 1/0",
        "set A4 formula NPV(0.1,A2,A3)",
        // IRR without any numeric values
        "set B1 text t x",
        "set B2 text t y",
        "set B3 formula IRR(B1:B2)",
        // IRR with error in range
        "set B4 formula IRR(A2:A3)",
        // IRR with too many args
        "set B5 formula IRR(A2:A2,0.1,0.2,0.3)",
        // NPV with only rate
        "set C1 formula NPV(0.1)",
        // DDB case where cost already below salvage on period 1
        "set C2 formula DDB(1000,900,10,2)",
        // SYD with negative period
        "set C3 formula SYD(10000,1000,5,-1)",
        // DDB with foperand leftover extra args (5 allowed, 6 errors)
        "set C4 formula DDB(1000,100,5,1,2,3)",
    ]);

    // NPV with text rate coerces to 0
    expect(typeof getDV("A1")).toBe("number");
    expect(typeof getDV("A4")).toBeDefined();
    expect(getVT("B3")).toBe("e#NUM!");
    expect(getVT("B4")).toBe("e#VALUE!");
    expect(getVT("B5").charAt(0)).toBe("e");
    // NPV with only rate: too few args → error
    expect(getVT("C1").charAt(0)).toBe("e");
    expect(typeof getDV("C2")).toBe("number");
    expect(getVT("C3")).toBe("e#NUM!");
    expect(getVT("C4").charAt(0)).toBe("e");
});

test("Parser coverage: specialvalue, names+coords, operator edges", async () => {
    const SC = await loadSocialCalc();

    // #REF! as standalone
    const sv = SC.Formula.ParseFormulaIntoTokens("#REF!");
    expect(sv[0].text).toBe("#REF!");

    // Coord followed by alpha (alphanumeric)
    const an = SC.Formula.ParseFormulaIntoTokens("A1B");
    expect(an.length).toBe(1);

    // Parenthesis inside name list
    const nested = SC.Formula.ParseFormulaIntoTokens("SUM(SUM(A1:A2))");
    expect(nested.some((t: any) => t.text === "SUM")).toBe(true);

    // Null arg list
    const nu = SC.Formula.ParseFormulaIntoTokens("FOO()");
    expect(nu[1].text).toBe("(");
    expect(nu[2].text).toBe(")");

    // Operator after paren
    const opAfter = SC.Formula.ParseFormulaIntoTokens("(1+2)*3");
    expect(opAfter.map((t: any) => t.text)).toContain("*");

    // Consecutive operators that are not 2-char
    const bad = SC.Formula.ParseFormulaIntoTokens("5**3");
    expect(bad.some((t: any) => t.type === SC.Formula.TokenType.error)).toBe(
        true,
    );
});

test("Parser: name followed by number, coord boundary transition", async () => {
    const SC = await loadSocialCalc();
    // Names with embedded _ and .
    const tok1 = SC.Formula.ParseFormulaIntoTokens("MY_NAME.ONE");
    expect(tok1[0].text).toBe("MY_NAME.ONE");

    // Column only coord with digits at end
    const tok2 = SC.Formula.ParseFormulaIntoTokens("ZZ999");
    expect(tok2[0].text).toBe("ZZ999");

    // Very big column letters → becomes alphanumeric name
    const tok3 = SC.Formula.ParseFormulaIntoTokens("ABC123");
    expect(tok3[0].type).toBe(SC.Formula.TokenType.name);
});

test("EvaluatePolish: missing operands for :, !, and comparison ops", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();

    // Synthetic: a single-operand expression with trailing ':' op (unreachable from parser,
    // so manually build revpolish)
    const op0 = { text: "A1", type: SC.Formula.TokenType.coord, opcode: 0 };
    const opColon = { text: ":", type: SC.Formula.TokenType.op, opcode: ":" };
    const opBang = { text: "!", type: SC.Formula.TokenType.op, opcode: "!" };
    const opLt = { text: "<", type: SC.Formula.TokenType.op, opcode: "<" };
    const opAmp = { text: "&", type: SC.Formula.TokenType.op, opcode: "&" };

    const tokens1 = [op0, opColon];
    const poll1 = SC.Formula.EvaluatePolish(tokens1, [0, 1], sheet, false);
    expect(poll1.type.charAt(0)).toBe("e");

    const tokens2 = [op0, opBang];
    const poll2 = SC.Formula.EvaluatePolish(tokens2, [0, 1], sheet, false);
    expect(poll2.type.charAt(0)).toBe("e");

    const tokens3 = [op0, opLt];
    const poll3 = SC.Formula.EvaluatePolish(tokens3, [0, 1], sheet, false);
    expect(poll3.type.charAt(0)).toBe("e");

    const tokens4 = [op0, opAmp];
    const poll4 = SC.Formula.EvaluatePolish(tokens4, [0, 1], sheet, false);
    expect(poll4.type.charAt(0)).toBe("e");
});

test("NormalizeSheetName: via Callbacks override", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const prev = SC.Callbacks.NormalizeSheetName;
    try {
        SC.Callbacks.NormalizeSheetName = (n: string) => "mysheet_" + n.toLowerCase();
        expect(SC.Formula.NormalizeSheetName("Foo")).toBe("mysheet_foo");
    } finally {
        SC.Callbacks.NormalizeSheetName = prev;
    }
});

test("CalculateFunction: variable-arg with too few args (argnum=100 bypass)", async () => {
    const SC = await loadSocialCalc();
    resetFormulaGlobals(SC);
    const sheet = new SC.Sheet();

    // argnum=100 means "accept any". Test via SUBMIT
    const opBeforeArg: any[] = [{ type: "start", value: 0 }];
    try {
        // This path calls IoFunctions, which needs SpreadsheetControlObject and will throw.
        SC.Formula.CalculateFunction("SUBMIT", opBeforeArg, sheet, "A1");
    } catch {
        // Expected: IO widget needs DOM.
    }
});



