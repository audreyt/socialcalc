import { describe, expect, test } from "vite-plus/test";

import { emitDelimiterBefore, firstTrueIndex, keepJoinItem, switchBranch } from "../lemma/branch";
import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/branch first-match / text-emission policies (Dafny/Lean surface)", () => {
  test("firstTrueIndex returns the first true index or -1", () => {
    expect(firstTrueIndex([false, false, true, true])).toBe(2);
    expect(firstTrueIndex([true, false])).toBe(0);
    expect(firstTrueIndex([false, false])).toBe(-1);
    expect(firstTrueIndex([])).toBe(-1);
  });

  test("switchBranch: a nonnegative hitIndex wins regardless of default", () => {
    expect(switchBranch(1, 3, false)).toBe(1);
    expect(switchBranch(0, 2, true)).toBe(0);
  });

  test("switchBranch: hitIndex=-1 with a default falls through to the default slot", () => {
    expect(switchBranch(-1, 2, true)).toBe(2);
  });

  test("switchBranch: hitIndex=-1 and no default is -1 (#N/A)", () => {
    expect(switchBranch(-1, 2, false)).toBe(-1);
  });

  test("switchBranch: zero cases with a default is slot 0", () => {
    expect(switchBranch(-1, 0, true)).toBe(0);
  });

  test("switchBranch: zero cases with no default is -1", () => {
    expect(switchBranch(-1, 0, false)).toBe(-1);
  });

  test("keepJoinItem: ignore_empty=false always keeps", () => {
    expect(keepJoinItem(false, true)).toBe(true);
    expect(keepJoinItem(false, false)).toBe(true);
  });

  test("keepJoinItem: ignore_empty=true keeps only non-empty text", () => {
    expect(keepJoinItem(true, true)).toBe(false);
    expect(keepJoinItem(true, false)).toBe(true);
  });

  test("emitDelimiterBefore: only after at least one kept item", () => {
    expect(emitDelimiterBefore(0)).toBe(false);
    expect(emitDelimiterBefore(1)).toBe(true);
    expect(emitDelimiterBefore(5)).toBe(true);
  });
});

describe("lemma/branch vs shipping IFS/SWITCH/TEXTJOIN", () => {
  test("firstTrueIndex/switchBranch selection matches shipping IFS/SWITCH", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    // IFS(FALSE,"a",TRUE,"b",TRUE,"c") -> conditions [false,true,true] ->
    // firstTrueIndex is 1 -> shipping picks the 2nd value ("b").
    const ifs = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('IFS(1=2,"a",1=1,"b",1=1,"c")'),
      sheet,
      false,
    );
    expect(firstTrueIndex([false, true, true])).toBe(1);
    expect(ifs.value).toBe("b");

    // SWITCH(2,1,"one",2,"two",3,"three") -> matches [false,true,false],
    // hitIndex=firstTrueIndex(matches)=1, hasDefault=false ->
    // switchBranch(1,3,false)=1 -> shipping picks "two".
    const sw = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('SWITCH(2,1,"one",2,"two",3,"three")'),
      sheet,
      false,
    );
    const swMatches = [false, true, false];
    expect(switchBranch(firstTrueIndex(swMatches), swMatches.length, false)).toBe(1);
    expect(sw.value).toBe("two");

    // SWITCH(9,1,"one",2,"two","fallback") -> matches [false,false],
    // hitIndex=-1, hasDefault=true -> switchBranch(-1,2,true)=2 (the
    // default slot).
    const swDefault = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('SWITCH(9,1,"one",2,"two","fallback")'),
      sheet,
      false,
    );
    const noMatches = [false, false];
    expect(switchBranch(firstTrueIndex(noMatches), noMatches.length, true)).toBe(2);
    expect(swDefault.value).toBe("fallback");
  });

  test("keepJoinItem/emitDelimiterBefore selection matches shipping TEXTJOIN", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();

    // TEXTJOIN(",",TRUE,"a","","b"): items ["a","","b"], ignore_empty=true.
    // keepJoinItem(true,isEmpty) keeps "a" and "b", skips "". Delimiters are
    // only emitted before a kept item once at least one item was already
    // kept (emitDelimiterBefore), so the result is "a,b" (one delimiter),
    // not "a,,b" or "a,b,".
    const r = SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens('TEXTJOIN(",",TRUE,"a","","b")'),
      sheet,
      false,
    );
    expect(keepJoinItem(true, "a".length === 0)).toBe(true);
    expect(keepJoinItem(true, "".length === 0)).toBe(false);
    expect(keepJoinItem(true, "b".length === 0)).toBe(true);
    expect(emitDelimiterBefore(0)).toBe(false); // before "a": nothing kept yet
    expect(emitDelimiterBefore(1)).toBe(true); // before "b": "a" already kept
    expect(r.value).toBe("a,b");
  });
});
