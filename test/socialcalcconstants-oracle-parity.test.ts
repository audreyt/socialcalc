// Bulk-closes the remaining StringLiteral survivors in js/socialcalcconstants.ts's
// ~940-line SC.Constants data table (s_loc_*, s_fdef_*/s_farg_*, SCFormat*, formula
// error messages, day/month name arrays) via whole-block comparison against the
// pinned, independently-vendored oracle 3.0.8 bundle (test/fixtures/oracle-3.0.8),
// instead of hand-transcribing hundreds of near-duplicate one-liners.
//
// This is NOT the SUT-derived-expected-value anti-pattern (reading an expected value
// off the very same live object under test, which mutates in lockstep with any
// mutant and can never fail): the oracle is a wholly separate, immutable, checked-in
// third-party bundle compiled from different source entirely, loaded into its own vm
// context (see test/helpers/oracle.ts). If Stryker mutates a string literal in the
// candidate's js/socialcalcconstants.ts, the candidate's rebuilt dist diverges from
// the oracle's frozen value and the comparison fails — exactly the same mechanism
// the existing test/differential/*.test.ts corpus already relies on for parity.
//
// Empirically confirmed (scripted diff, not assumed) that every string-valued
// data leaf asserted below is byte-identical between the current candidate and
// oracle: the Constants data table has not changed since 3.0.8, only some of the
// *functions* around it have (see socialcalcconstants-mutation-survivors.test.ts).
// Named prefix groups retain focused assertions for readable failures; a
// path-keyed recursive comparison covers the remaining nested/default strings
// without turning the check into an opaque whole-object snapshot.
//
// doCanonicalizeSheet, cellDataType, and ConstantsDefaultClasses are pinned directly
// (with behavioral proof for doCanonicalizeSheet) in
// socialcalcconstants-mutation-survivors.test.ts — not repeated here.
import { expect, test } from "vite-plus/test";

import { loadOracleSocialCalc } from "./helpers/oracle";
import { loadSocialCalc } from "./helpers/socialcalc";

function pickByPrefix(source: unknown, prefix: string): Record<string, unknown> {
  const record = source as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (key.startsWith(prefix)) {
      picked[key] = record[key];
    }
  }
  return picked;
}

const NAMED_STRING_PREFIXES = [
  "SCFormat",
  "s_parseerr",
  "s_calcerr",
  "s_FormatNumber_",
  "s_loc_",
  "s_fdef_",
  "s_farg_",
] as const;

function pickRemainingStringLeaves(source: unknown): Record<string, string> {
  const picked: Record<string, string> = {};

  function visit(value: unknown, path: string): void {
    if (typeof value === "string") {
      if (!NAMED_STRING_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        picked[path] = value;
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        visit(item, path ? `${path}.${key}` : key);
      }
    }
  }

  visit(source, "");
  return picked;
}

test("remaining Constants string data leaves match the oracle 3.0.8 baseline byte-for-byte", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidate = pickRemainingStringLeaves(SC.Constants);
  expect(Object.keys(candidate).length).toBe(188);
  expect(candidate).toEqual(pickRemainingStringLeaves(Oracle.Constants));
});

test("SCFormat* settings-dropdown data strings match the oracle 3.0.8 baseline byte-for-byte", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidate = pickByPrefix(SC.Constants, "SCFormat");
  // 13 keys feeding the live Format-tab dropdowns in socialcalcspreadsheetcontrol.ts
  // (SCFormatNumberFormats, SCFormatTextFormats, SCFormatPadsizes, SCFormatFontsizes,
  // SCFormatFontfamilies, SCFormatFontlook, SCFormatTextAlignhoriz,
  // SCFormatNumberAlignhoriz, SCFormatAlignVertical, SCFormatColwidth,
  // SCFormatRecalc, SCFormatUserMaxCol, SCFormatUserMaxRow).
  expect(Object.keys(candidate).length).toBe(13);
  expect(candidate).toEqual(pickByPrefix(Oracle.Constants, "SCFormat"));
});

test("s_parseerr*/s_calcerr* formula error messages match the oracle 3.0.8 baseline byte-for-byte", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidatePE = pickByPrefix(SC.Constants, "s_parseerr");
  const candidateCE = pickByPrefix(SC.Constants, "s_calcerr");
  // 11 s_parseerr* + 7 s_calcerr* = 18 keys thrown directly by the tokenizer/
  // evaluator in formula1.ts on malformed formulas and calculation errors.
  expect(Object.keys(candidatePE).length).toBe(11);
  expect(Object.keys(candidateCE).length).toBe(7);
  expect(candidatePE).toEqual(pickByPrefix(Oracle.Constants, "s_parseerr"));
  expect(candidateCE).toEqual(pickByPrefix(Oracle.Constants, "s_calcerr"));
});

test("s_FormatNumber_ day/month name arrays and am/pm markers match the oracle 3.0.8 baseline byte-for-byte", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidate = pickByPrefix(SC.Constants, "s_FormatNumber_");
  // s_FormatNumber_daynames(3), s_FormatNumber_monthnames(3), am/am1/pm/pm1 = 8 keys
  // read by FormatNumber's ddd/dddd/mmm/mmmm/AM-PM display-format tokens.
  expect(Object.keys(candidate).length).toBe(8);
  expect(candidate).toEqual(pickByPrefix(Oracle.Constants, "s_FormatNumber_"));
  // The two array-valued entries specifically (an ArrayDeclaration mutant emptying
  // one, or an out-of-order element, would still pass a length-only check).
  expect(SC.Constants.s_FormatNumber_daynames).toEqual([
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]);
  expect(SC.Constants.s_FormatNumber_monthnames).toEqual([
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]);
});

test("s_loc_* localization strings (every key SC.LocalizeString/LocalizeSubstrings can look up) match the oracle 3.0.8 baseline byte-for-byte", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidate = pickByPrefix(SC.Constants, "s_loc_");
  // 133 keys read live by socialcalcspreadsheetcontrol.ts's LocalizeString/
  // LocalizeSubstrings for menu/toolbar/settings labels — by far the largest single
  // StringLiteral survivor cluster in the file. One deep-equality comparison against
  // an independently-vendored 133-key snapshot closes all of them at once.
  expect(Object.keys(candidate).length).toBe(133);
  expect(candidate).toEqual(pickByPrefix(Oracle.Constants, "s_loc_"));
});

test("s_fdef_*/s_farg_* formula help text (function definitions and argument hints) match the oracle 3.0.8 baseline byte-for-byte, plus post-3.0.8 additions", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidateFdef = pickByPrefix(SC.Constants, "s_fdef_");
  const candidateFarg = pickByPrefix(SC.Constants, "s_farg_");
  // 115 s_fdef_* + 38 s_farg_* = 153 keys read dynamically by formula1.ts via
  // scc["s_fdef_" + fname] / scc["s_farg_" + f[2]] for the formula-entry help popup
  // — the second-largest StringLiteral survivor cluster in the file.
  //
  // RANK/MEDIAN/QUARTILE (audreyt/ethercalc#712, #726) and SORT/UNIQUE (dynamic-array
  // spill support) were added after the 3.0.8 baseline was vendored, so the oracle
  // bundle can never contain their s_fdef_/s_farg_ keys — a byte-for-byte toEqual
  // against the full candidate object would fail permanently on these nine keys
  // alone, regardless of correctness. Carve out exactly this named, closed set
  // (5 s_fdef_ + 4 s_farg_) before the oracle comparison; every other key still
  // gets whole-object byte-for-byte parity, and the total counts (120/42) stay
  // pinned so a future undocumented addition or removal still fails loudly instead
  // of silently passing through this carve-out.
  const postOracleFdefKeys = [
    "s_fdef_RANK",
    "s_fdef_MEDIAN",
    "s_fdef_QUARTILE",
    "s_fdef_SORT",
    "s_fdef_UNIQUE",
  ];
  const postOracleFargKeys = ["s_farg_rank", "s_farg_quartile", "s_farg_sort", "s_farg_unique"];

  expect(Object.keys(candidateFdef).length).toBe(120);
  expect(Object.keys(candidateFarg).length).toBe(42);

  const legacyFdef = { ...candidateFdef };
  const legacyFarg = { ...candidateFarg };
  for (const key of postOracleFdefKeys) delete legacyFdef[key];
  for (const key of postOracleFargKeys) delete legacyFarg[key];

  expect(Object.keys(legacyFdef).length).toBe(115);
  expect(Object.keys(legacyFarg).length).toBe(38);
  expect(legacyFdef).toEqual(pickByPrefix(Oracle.Constants, "s_fdef_"));
  expect(legacyFarg).toEqual(pickByPrefix(Oracle.Constants, "s_farg_"));

  // The nine post-3.0.8 keys have no oracle counterpart to diff against. The
  // focused statistical-formula test (test/formula-rank-median-quartile.test.ts,
  // "RANK/MEDIAN/QUARTILE are registered in FunctionList with help text and arg
  // strings") covers FunctionList/picker plumbing for RANK/MEDIAN/QUARTILE, and
  // test/formula-dynamic-arrays.test.ts covers SORT/UNIQUE behavior; this test
  // only asserts every carved-out key has non-empty help text.
  for (const key of postOracleFdefKeys) {
    expect(candidateFdef[key]).toBeTruthy();
  }
  for (const key of postOracleFargKeys) {
    expect(candidateFarg[key]).toBeTruthy();
  }
});
