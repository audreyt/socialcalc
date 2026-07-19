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

test("remaining Constants string data leaves match the oracle 3.0.8 baseline byte-for-byte, plus post-3.0.8 additions", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidate = pickRemainingStringLeaves(SC.Constants);
  // 188 oracle-matched leaves + 2 post-3.0.8 additions with no oracle
  // counterpart, carved out before the whole-object comparison, same as
  // the s_fdef_/s_farg_ post-3.0.8 carve-out below:
  // - defaultLockedComment (sheet-protection lock hint)
  // - s_dvDefaultError (default data-validation rejection message)
  expect(Object.keys(candidate).length).toBe(190);
  const legacy = { ...candidate };
  delete legacy.defaultLockedComment;
  delete legacy.s_dvDefaultError;
  expect(Object.keys(legacy).length).toBe(188);
  expect(legacy).toEqual(pickRemainingStringLeaves(Oracle.Constants));
  expect(candidate.defaultLockedComment).toBe("Locked cell (sheet is protected)");
  expect(candidate.s_dvDefaultError).toBeTruthy();
});

test("SCFormat* settings-dropdown data strings match the oracle 3.0.8 baseline byte-for-byte", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidate = pickByPrefix(SC.Constants, "SCFormat");
  // 13 oracle-matched keys feeding the live Format-tab dropdowns, plus 2 new
  // sheet-protection dropdowns (SCFormatUnlocked, SCFormatProtected) that
  // have no oracle counterpart.
  expect(Object.keys(candidate).length).toBe(15);
  const oracleCandidate = pickByPrefix(Oracle.Constants, "SCFormat");
  expect(candidate.SCFormatUnlocked).toBe("[cancel]:|[break]:|%loc!Locked!:|%loc!Unlocked!:y|");
  expect(candidate.SCFormatProtected).toBe(
    "[cancel]:|[break]:|%loc!Unprotected!:|%loc!Protected!:yes|",
  );
  delete candidate.SCFormatUnlocked;
  delete candidate.SCFormatProtected;
  expect(candidate).toEqual(oracleCandidate);
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

test("s_loc_* localization strings (every key SC.LocalizeString/LocalizeSubstrings can look up) match the oracle 3.0.8 baseline byte-for-byte, plus post-3.0.8 additions", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidate = pickByPrefix(SC.Constants, "s_loc_");
  // 133 keys read live by socialcalcspreadsheetcontrol.ts's LocalizeString/
  // LocalizeSubstrings for menu/toolbar/settings labels — by far the largest single
  // StringLiteral survivor cluster in the file. One deep-equality comparison against
  // an independently-vendored 133-key snapshot closes all of them at once.
  //
  // Find/Replace, Freeze/Unfreeze Panes (editor productivity features added
  // after the 3.0.8 baseline was vendored) introduced 7 new s_loc_* keys with
  // no oracle counterpart — carve out exactly this named, closed set before
  // the oracle comparison, same pattern as the s_fdef_*/s_farg_* post-3.0.8
  // carve-out below.
  const postOracleLocKeys = [
    "s_loc_freeze_panes",
    "s_loc_include_formulas",
    "s_loc_regex",
    "s_loc_replace",
    "s_loc_replace_all",
    "s_loc_unfreeze_panes",
    "s_loc_whole_sheet",
  ];

  expect(Object.keys(candidate).length).toBe(140);

  const legacyLoc = { ...candidate };
  for (const key of postOracleLocKeys) delete legacyLoc[key];

  expect(Object.keys(legacyLoc).length).toBe(133);
  expect(legacyLoc).toEqual(pickByPrefix(Oracle.Constants, "s_loc_"));

  for (const key of postOracleLocKeys) {
    expect(candidate[key]).toBeTruthy();
  }
});

test("s_fdef_*/s_farg_* formula help text (function definitions and argument hints) match the oracle 3.0.8 baseline byte-for-byte, plus post-3.0.8 additions", async () => {
  const SC = await loadSocialCalc();
  const Oracle = loadOracleSocialCalc();
  const candidateFdef = pickByPrefix(SC.Constants, "s_fdef_");
  const candidateFarg = pickByPrefix(SC.Constants, "s_farg_");
  // 164 s_fdef_* + 79 s_farg_* keys read dynamically by formula1.ts via
  // scc["s_fdef_" + fname] / scc["s_farg_" + f[2]] for the formula-entry help
  // popup — the second-largest StringLiteral survivor cluster in the file.
  //
  // RANK/MEDIAN/QUARTILE (audreyt/ethercalc#712, #726), SORT/UNIQUE (dynamic-
  // array spill), FILTER/SEQUENCE/TRANSPOSE/SORTBY/CHOOSECOLS/CHOOSEROWS/
  // TAKE/DROP/HSTACK/VSTACK/TOCOL/TOROW/WRAPROWS/WRAPCOLS/EXPAND (dynamic-
  // array function family 2), date arithmetic, financial, logical/error,
  // text, regex, math/statistics, SUBTOTAL, lookup, INDIRECT/OFFSET
  // (dynamic references), and ROW/COLUMN/ADDRESS/ISFORMULA/ISREF/
  // ERROR.TYPE/TYPE/HYPERLINK/IMAGE/TEXT (reference/information/render
  // functions) were all added after the 3.0.8 baseline was vendored, so the
  // oracle bundle can never contain their s_fdef_/s_farg_ keys — a
  // byte-for-byte toEqual against the full candidate object would fail
  // permanently on these keys alone, regardless of correctness. Carve out
  // exactly this named, closed set (64 s_fdef_ + 55 s_farg_) before the
  // oracle comparison; every other key still gets whole-object byte-for-byte
  // parity, and the total counts (115/38) stay pinned so a future
  // undocumented addition or removal still fails loudly instead of silently
  // passing through this carve-out. SEARCH reuses FIND's s_farg_find
  // definition.
  const postOracleFdefKeys = [
    "s_fdef_RANK",
    "s_fdef_MEDIAN",
    "s_fdef_QUARTILE",
    "s_fdef_SORT",
    "s_fdef_UNIQUE",
    "s_fdef_EDATE",
    "s_fdef_EOMONTH",
    "s_fdef_DATEDIF",
    "s_fdef_WEEKNUM",
    "s_fdef_ISOWEEKNUM",
    "s_fdef_YEARFRAC",
    "s_fdef_WORKDAY",
    "s_fdef_NETWORKDAYS",
    "s_fdef_WORKDAY.INTL",
    "s_fdef_NETWORKDAYS.INTL",
    "s_fdef_PPMT",
    "s_fdef_IPMT",
    "s_fdef_MIRR",
    "s_fdef_XNPV",
    "s_fdef_XIRR",
    "s_fdef_SEARCH",
    "s_fdef_IFERROR",
    "s_fdef_IFNA",
    "s_fdef_IFS",
    "s_fdef_SPLIT",
    "s_fdef_SWITCH",
    "s_fdef_TEXTJOIN",
    "s_fdef_JOIN",
    "s_fdef_TEXTBEFORE",
    "s_fdef_TEXTAFTER",
    "s_fdef_TEXTSPLIT",
    "s_fdef_REGEXMATCH",
    "s_fdef_REGEXEXTRACT",
    "s_fdef_REGEXREPLACE",
    "s_fdef_SUBTOTAL",
    "s_fdef_XMATCH",
    "s_fdef_XLOOKUP",
    "s_fdef_INDIRECT",
    "s_fdef_OFFSET",
    "s_fdef_ADDRESS",
    "s_fdef_COLUMN",
    "s_fdef_ERROR.TYPE",
    "s_fdef_HYPERLINK",
    "s_fdef_IMAGE",
    "s_fdef_ISFORMULA",
    "s_fdef_ISREF",
    "s_fdef_ROW",
    "s_fdef_TEXT",
    "s_fdef_TYPE",
    "s_fdef_FILTER",
    "s_fdef_SEQUENCE",
    "s_fdef_TRANSPOSE",
    "s_fdef_SORTBY",
    "s_fdef_CHOOSECOLS",
    "s_fdef_CHOOSEROWS",
    "s_fdef_TAKE",
    "s_fdef_DROP",
    "s_fdef_HSTACK",
    "s_fdef_VSTACK",
    "s_fdef_TOCOL",
    "s_fdef_TOROW",
    "s_fdef_WRAPROWS",
    "s_fdef_WRAPCOLS",
    "s_fdef_EXPAND",
  ];
  const postOracleFargKeys = [
    "s_farg_rank",
    "s_farg_quartile",
    "s_farg_sort",
    "s_farg_unique",
    "s_farg_edate",
    "s_farg_datedif",
    "s_farg_weeknum",
    "s_farg_yearfrac",
    "s_farg_workday",
    "s_farg_workdayintl",
    "s_farg_ppmt",
    "s_farg_mirr",
    "s_farg_xnpv",
    "s_farg_xirr",
    "s_farg_iferror",
    "s_farg_ifna",
    "s_farg_ifs",
    "s_farg_switch",
    "s_farg_textjoin",
    "s_farg_join",
    "s_farg_textbeforeafter",
    "s_farg_split",
    "s_farg_textsplit",
    "s_farg_regexmatch",
    "s_farg_regexextract",
    "s_farg_regexreplace",
    "s_farg_percentile",
    "s_farg_percentrank",
    "s_farg_pairedrange",
    "s_farg_forecast",
    "s_farg_trendgrowth",
    "s_farg_function_code",
    "s_farg_xmatch",
    "s_farg_xlookup",
    "s_farg_indirect",
    "s_farg_offset",
    "s_farg_address",
    "s_farg_hyperlink",
    "s_farg_image",
    "s_farg_refopt",
    "s_farg_text",
    "s_farg_filter",
    "s_farg_sequence",
    "s_farg_sortby",
    "s_farg_choosecols",
    "s_farg_chooserows",
    "s_farg_take",
    "s_farg_drop",
    "s_farg_hstack",
    "s_farg_vstack",
    "s_farg_tocol",
    "s_farg_torow",
    "s_farg_wraprows",
    "s_farg_wrapcols",
    "s_farg_expand",
  ];

  expect(Object.keys(candidateFdef).length).toBe(179);
  expect(Object.keys(candidateFarg).length).toBe(93);

  const legacyFdef = { ...candidateFdef };
  const legacyFarg = { ...candidateFarg };
  for (const key of postOracleFdefKeys) delete legacyFdef[key];
  for (const key of postOracleFargKeys) delete legacyFarg[key];

  expect(Object.keys(legacyFdef).length).toBe(115);
  expect(Object.keys(legacyFarg).length).toBe(38);
  expect(legacyFdef).toEqual(pickByPrefix(Oracle.Constants, "s_fdef_"));
  expect(legacyFarg).toEqual(pickByPrefix(Oracle.Constants, "s_farg_"));

  // The post-3.0.8 keys have no oracle counterpart to diff against. Focused
  // compatibility suites cover FunctionList, picker plumbing, and behavior:
  // test/formula-rank-median-quartile.test.ts (RANK/MEDIAN/QUARTILE),
  // test/formula-dynamic-arrays.test.ts (SORT/UNIQUE), date/financial/
  // logical/text/regex/math-stat/SUBTOTAL/lookup focused suites, and
  // test/formula-reference-info-functions.test.ts covers INDIRECT/OFFSET
  // registration plus the reference/information/render functions added in
  // this carve-out; this test only asserts every carved-out key has
  // non-empty help text.
  for (const key of postOracleFdefKeys) {
    expect(candidateFdef[key]).toBeTruthy();
  }
  for (const key of postOracleFargKeys) {
    expect(candidateFarg[key]).toBeTruthy();
  }
});
