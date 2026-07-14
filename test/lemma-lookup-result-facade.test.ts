import { describe, expect, test } from "vite-plus/test";

import {
  incorrectRowError,
  lookupInRow,
  lookupResultInEntries,
  lookupResultType,
  missingRowError,
  parsePipeRow,
  preferExact,
  resolveToken,
  selectRow,
  typeChar0,
  wildcardKey,
} from "../lemma/lookup-result";
import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/lookup-result pure core (Dafny/Lean surface)", () => {
  test("resolveToken 1/2/literal", () => {
    expect(resolveToken("n", "e#REF!", "1")).toBe("n");
    expect(resolveToken("n", "e#REF!", "2")).toBe("e#REF!");
    expect(resolveToken("n", "t", "e#VALUE!")).toBe("e#VALUE!");
    expect(resolveToken("b", "n", "n")).toBe("n");
  });

  test("typeChar0 / wildcardKey / missingRowError", () => {
    expect(typeChar0("n")).toBe("n");
    expect(typeChar0("e#REF!")).toBe("e");
    expect(typeChar0("")).toBe("");
    expect(wildcardKey("n%")).toBe("n*");
    expect(wildcardKey("")).toBe("*");
    expect(missingRowError("x")).toBe("e#VALUE! (internal error, missing LookupResultType x*)");
    expect(missingRowError("")).toBe("e#VALUE! (internal error, missing LookupResultType *)");
    expect(incorrectRowError("|n:1")).toContain("incorrect LookupResultType");
  });

  test("selectRow exact then wildcard", () => {
    const table = {
      n: "|n:n|e*:2|",
      "n*": "|n*:n|e*:2|",
      "e*": "|e*:1|",
    };
    expect(selectRow("n", table)).toBe("|n:n|e*:2|");
    expect(selectRow("n%", table)).toBe("|n*:n|e*:2|");
    expect(selectRow("e#REF!", table)).toBe("|e*:1|");
    expect(selectRow("x", table)).toBeNull();
  });

  test("lookupInRow exact then family wildcard", () => {
    const plusN = "|n%:n|nd:nd|nt:nt|ndt:ndt|n$:n$|n:n|n*:n|b:n|e*:2|t*:e#VALUE!|";
    expect(lookupInRow("n", "n", plusN)).toBe("n");
    expect(lookupInRow("n", "e#REF!", plusN)).toBe("e#REF!");
    expect(lookupInRow("n", "t", plusN)).toBe("e#VALUE!");
    expect(lookupInRow("n", "b", plusN)).toBe("n");
    // no match
    expect(lookupInRow("n", "x", "|n:n|")).toBe("e#VALUE!");
    // malformed (no closing pipe after match)
    expect(lookupInRow("n", "n", "|n:1")).toBe(incorrectRowError("|n:1"));
  });

  test("preferExact and entry-list lookup preserve exact-before-wildcard precedence", () => {
    expect(preferExact(true, true)).toBe(0);
    expect(preferExact(false, true)).toBe(1);
    expect(preferExact(false, false)).toBe(2);
    const entries = parsePipeRow("noise|n:n|malformed|e*:2|");
    expect(entries).toEqual([
      { key: "n", val: "n" },
      { key: "e*", val: "2" },
    ]);
    expect(lookupResultInEntries("n", "e#REF!", entries)).toBe("e#REF!");
  });

  test("wildcard match with a malformed row reports the row-level error", () => {
    expect(lookupInRow("n", "e#REF!", "|e*:2")).toBe(incorrectRowError("|e*:2"));
  });
});

describe("lemma/lookup-result vs shipping LookupResultType", () => {
  async function shippingLookup(
    type1: string,
    type2: string,
    tableName: "plus" | "concat" | "twoargnumeric" | "propagateerror" | "unaryminus",
  ): Promise<string> {
    const SC = await loadSocialCalc();
    const table = SC.Formula.TypeLookupTable[tableName];
    return SC.Formula.LookupResultType(type1, type2, table);
  }

  function facadeLookup(type1: string, type2: string, table: Record<string, string>): string {
    return lookupResultType(type1, type2, table);
  }

  test("plus matrix: n/e/t/b pairs", async () => {
    const SC = await loadSocialCalc();
    const plus = SC.Formula.TypeLookupTable.plus as Record<string, string>;
    const pairs: Array<[string, string]> = [
      ["n", "n"],
      ["n", "e#REF!"],
      ["e#REF!", "n"],
      ["t", "n"],
      ["n", "t"],
      ["b", "n"],
      ["n", "b"],
      ["e#DIV/0!", "e#REF!"],
      ["n%", "nd"],
      ["n*", "e#VALUE!"],
    ];
    for (const [a, b] of pairs) {
      expect(facadeLookup(a, b, plus)).toBe(await shippingLookup(a, b, "plus"));
    }
  });

  test("empty type1 missing-row path", async () => {
    const SC = await loadSocialCalc();
    const plus = SC.Formula.TypeLookupTable.plus as Record<string, string>;
    const want = await shippingLookup("", "n", "plus");
    expect(facadeLookup("", "n", plus)).toBe(want);
    expect(want).toBe(missingRowError(""));
  });

  test("concat t+e and family rows", async () => {
    const SC = await loadSocialCalc();
    const concat = SC.Formula.TypeLookupTable.concat as Record<string, string>;
    const pairs: Array<[string, string]> = [
      ["t", "t"],
      ["t", "e#REF!"],
      ["e#REF!", "t"],
      ["th", "tw"],
      ["t*", "e#DIV/0!"],
      ["n", "t"], // n falls to missing row on concat
    ];
    for (const [a, b] of pairs) {
      expect(facadeLookup(a, b, concat)).toBe(await shippingLookup(a, b, "concat"));
    }
  });

  test("twoargnumeric / propagateerror / unaryminus", async () => {
    const SC = await loadSocialCalc();
    const tables = {
      twoargnumeric: SC.Formula.TypeLookupTable.twoargnumeric as Record<string, string>,
      propagateerror: SC.Formula.TypeLookupTable.propagateerror as Record<string, string>,
      unaryminus: SC.Formula.TypeLookupTable.unaryminus as Record<string, string>,
    } as const;

    const cases: Array<{
      table: keyof typeof tables;
      a: string;
      b: string;
    }> = [
      { table: "twoargnumeric", a: "n", b: "n" },
      { table: "twoargnumeric", a: "n", b: "t" },
      { table: "twoargnumeric", a: "e#REF!", b: "n" },
      { table: "twoargnumeric", a: "t", b: "e#VALUE!" },
      { table: "propagateerror", a: "n", b: "e#REF!" },
      { table: "propagateerror", a: "e#DIV/0!", b: "n" },
      { table: "propagateerror", a: "t", b: "b" },
      // unary tables use type2 family; shipping still passes a type2
      { table: "unaryminus", a: "n", b: "n" },
      { table: "unaryminus", a: "t", b: "t" },
      { table: "unaryminus", a: "b", b: "b" },
      { table: "unaryminus", a: "e#REF!", b: "e#REF!" },
    ];

    for (const c of cases) {
      expect(facadeLookup(c.a, c.b, tables[c.table])).toBe(await shippingLookup(c.a, c.b, c.table));
    }
  });
});
