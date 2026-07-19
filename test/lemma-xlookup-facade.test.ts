import { describe, expect, test } from "vite-plus/test";

import {
  FALLBACK_NOT_FOUND_ERROR,
  MATCH_EXACT,
  MATCH_NEXT_LARGER,
  MATCH_NEXT_SMALLER,
  MATCH_WILDCARD,
  OUTCOME_APPROXIMATE,
  OUTCOME_EXACT,
  OUTCOME_MISS,
  SEARCH_BINARY_ASC,
  SEARCH_BINARY_DESC,
  SEARCH_FORWARD,
  SEARCH_REVERSE,
  classifyLookupOutcome,
  matchModeAllowsApproximate,
  matchModeValidity,
  matchOutcomeToResult,
  modeCombinationValidity,
  resolveIfNotFound,
  searchModeValidity,
} from "../lemma/xlookup";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("lemma/xlookup pure core (Dafny/Lean surface)", () => {
  test("matchModeValidity accepts exactly -1/0/1/2", () => {
    expect(matchModeValidity(MATCH_NEXT_SMALLER)).toBe(true);
    expect(matchModeValidity(MATCH_EXACT)).toBe(true);
    expect(matchModeValidity(MATCH_NEXT_LARGER)).toBe(true);
    expect(matchModeValidity(MATCH_WILDCARD)).toBe(true);
    expect(matchModeValidity(3)).toBe(false);
    expect(matchModeValidity(-5)).toBe(false);
    expect(matchModeValidity(0.5)).toBe(false);
  });

  test("searchModeValidity accepts exactly 1/-1/2/-2", () => {
    expect(searchModeValidity(SEARCH_FORWARD)).toBe(true);
    expect(searchModeValidity(SEARCH_REVERSE)).toBe(true);
    expect(searchModeValidity(SEARCH_BINARY_ASC)).toBe(true);
    expect(searchModeValidity(SEARCH_BINARY_DESC)).toBe(true);
    expect(searchModeValidity(0)).toBe(false);
    expect(searchModeValidity(3)).toBe(false);
  });

  test("modeCombinationValidity rejects wildcard + binary search, accepts everything else legal", () => {
    expect(modeCombinationValidity(MATCH_WILDCARD, SEARCH_BINARY_ASC)).toBe(false);
    expect(modeCombinationValidity(MATCH_WILDCARD, SEARCH_BINARY_DESC)).toBe(false);
    expect(modeCombinationValidity(MATCH_WILDCARD, SEARCH_FORWARD)).toBe(true);
    expect(modeCombinationValidity(MATCH_WILDCARD, SEARCH_REVERSE)).toBe(true);
    expect(modeCombinationValidity(MATCH_NEXT_SMALLER, SEARCH_BINARY_ASC)).toBe(true);
    expect(modeCombinationValidity(MATCH_NEXT_LARGER, SEARCH_BINARY_DESC)).toBe(true);
    expect(modeCombinationValidity(3, SEARCH_FORWARD)).toBe(false);
    expect(modeCombinationValidity(MATCH_EXACT, 0)).toBe(false);
  });

  test("matchOutcomeToResult: exact always wins, then approximate, then miss", () => {
    expect(matchOutcomeToResult(true, true)).toBe(OUTCOME_EXACT);
    expect(matchOutcomeToResult(true, false)).toBe(OUTCOME_EXACT);
    expect(matchOutcomeToResult(false, true)).toBe(OUTCOME_APPROXIMATE);
    expect(matchOutcomeToResult(false, false)).toBe(OUTCOME_MISS);
  });

  test("matchModeAllowsApproximate only for -1/1", () => {
    expect(matchModeAllowsApproximate(MATCH_NEXT_SMALLER)).toBe(true);
    expect(matchModeAllowsApproximate(MATCH_NEXT_LARGER)).toBe(true);
    expect(matchModeAllowsApproximate(MATCH_EXACT)).toBe(false);
    expect(matchModeAllowsApproximate(MATCH_WILDCARD)).toBe(false);
  });

  test("classifyLookupOutcome downgrades an approximate candidate under an incompatible match_mode", () => {
    expect(classifyLookupOutcome(MATCH_NEXT_SMALLER, false, true)).toBe(OUTCOME_APPROXIMATE);
    expect(classifyLookupOutcome(MATCH_EXACT, false, true)).toBe(OUTCOME_MISS);
    expect(classifyLookupOutcome(MATCH_WILDCARD, false, true)).toBe(OUTCOME_MISS);
    expect(classifyLookupOutcome(MATCH_NEXT_LARGER, true, true)).toBe(OUTCOME_EXACT);
    expect(classifyLookupOutcome(MATCH_EXACT, false, false)).toBe(OUTCOME_MISS);
  });

  test("resolveIfNotFound: fallback only consulted on a miss", () => {
    expect(resolveIfNotFound(OUTCOME_EXACT, true, "fallback")).toBe("");
    expect(resolveIfNotFound(OUTCOME_APPROXIMATE, true, "fallback")).toBe("");
    expect(resolveIfNotFound(OUTCOME_MISS, true, "fallback")).toBe("fallback");
    expect(resolveIfNotFound(OUTCOME_MISS, false, "fallback")).toBe(FALLBACK_NOT_FOUND_ERROR);
    expect(resolveIfNotFound(OUTCOME_MISS, false, "")).toBe(FALLBACK_NOT_FOUND_ERROR);
  });
});

describe("lemma/xlookup vs shipping DecodeXLookupModes/ScanLookupVector", () => {
  test("modeCombinationValidity matches shipping DecodeXLookupModes acceptance for every mode pair", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set A2 value n 2"]);
    await recalcSheet(SC, sheet);
    const matchModes = [-2, -1, 0, 1, 2, 3];
    const searchModes = [-2, -1, 0, 1, 2, 3];
    for (const matchMode of matchModes) {
      for (const searchMode of searchModes) {
        const evalResult = SC.Formula.evaluate_parsed_formula(
          SC.Formula.ParseFormulaIntoTokens(`XMATCH(1,A1:A2,${matchMode},${searchMode})`),
          sheet,
          false,
        );
        const shippingAccepted = evalResult.type !== "e#VALUE!";
        expect(shippingAccepted).toBe(modeCombinationValidity(matchMode, searchMode));
      }
    }
  });

  test("classifyLookupOutcome matches shipping XMATCH exact-vs-approximate-vs-miss precedence", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 value n 10",
      "set A2 value n 30",
      "set A3 value n 20",
    ]);
    await recalcSheet(SC, sheet);
    const evaluate = (formula: string) =>
      SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, false);

    // Exact hit (20 is present exactly): outcome must be EXACT regardless of
    // match_mode, matching classifyLookupOutcome(mode, true, *) === EXACT.
    expect(evaluate("XMATCH(20,A1:A3,-1)").type.charAt(0)).toBe("n");
    expect(classifyLookupOutcome(MATCH_NEXT_SMALLER, true, true)).toBe(OUTCOME_EXACT);

    // No exact 25, but a qualifying next-smaller (20) exists: APPROXIMATE.
    expect(evaluate("XMATCH(25,A1:A3,-1)").type.charAt(0)).toBe("n");
    expect(classifyLookupOutcome(MATCH_NEXT_SMALLER, false, true)).toBe(OUTCOME_APPROXIMATE);

    // No exact 5 and no qualifying next-smaller anywhere: MISS -> #N/A.
    expect(evaluate("XMATCH(5,A1:A3,-1)").type).toBe("e#N/A");
    expect(classifyLookupOutcome(MATCH_NEXT_SMALLER, false, false)).toBe(OUTCOME_MISS);
  });

  test("resolveIfNotFound miss/fallback precedence matches shipping XLOOKUP", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 text t x"]);
    await recalcSheet(SC, sheet);
    const evaluate = (formula: string) =>
      SC.Formula.evaluate_parsed_formula(SC.Formula.ParseFormulaIntoTokens(formula), sheet, false);

    const withFallback = evaluate('XLOOKUP(9,A1:A1,B1:B1,"missing")');
    expect(withFallback.value).toBe("missing");
    expect(resolveIfNotFound(OUTCOME_MISS, true, "missing")).toBe("missing");

    const withoutFallback = evaluate("XLOOKUP(9,A1:A1,B1:B1)");
    expect(withoutFallback.type).toBe("e#N/A");
    expect(resolveIfNotFound(OUTCOME_MISS, false, "")).toBe(FALLBACK_NOT_FOUND_ERROR);

    const hitReturnsMatch = evaluate('XLOOKUP(1,A1:A1,B1:B1,"missing")');
    expect(hitReturnsMatch.value).toBe("x");
    expect(resolveIfNotFound(OUTCOME_EXACT, true, "missing")).toBe("");
  });
});
