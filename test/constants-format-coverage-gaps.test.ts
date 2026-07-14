import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

// loadSocialCalc returns `any` (the UMD bag). Narrow to the concrete slice we
// use here so no `any` leaks into this test file.
type SocialCalcLike = {
  format_number_for_display: (
    rawvalue: number | string,
    valuetype: string,
    valueformat: string,
  ) => string;
  Constants: Record<string, unknown> & {
    FormatNumber_defaultCurrency: string;
    defaultImagePrefix: string;
  };
  ConstantsDefaultClasses: Record<string, unknown>;
  ConstantsSetClasses: (prefix?: string) => void;
  ConstantsSetImagePrefix: (imagePrefix: string) => void;
  FormatNumber: {
    formatNumberWithFormat: (
      rawvalue: number | string,
      format_string: string,
      currency_char?: string,
    ) => string;
    parse_format_bracket: (bracketstr: string) => {
      operator: number;
      operand: string;
    };
    format_definitions: Record<string, unknown>;
  };
};

async function loadSC(): Promise<SocialCalcLike> {
  // loadSocialCalc returns the UMD `any` bag; cast through unknown to our
  // local concrete type so the test stays `any`-free.
  return (await loadSocialCalc({ browser: true })) as unknown as SocialCalcLike;
}

// ---------------------------------------------------------------------------
// SocialCalc Constants: ConstantsSetClasses + ConstantsSetImagePrefix
// ---------------------------------------------------------------------------

describe("ConstantsSetClasses covers all default-class entry types", () => {
  test("calling with no prefix uses empty string (falsy-prefix branch)", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // Falsy prefix: exercises prefix = prefix || "" -> "" arm.
    // With no prefix, defaultComment (entry "") defaults to item name
    // "defaultComment", so classname becomes "defaultComment".
    SC.ConstantsSetClasses();

    expect(scc.defaultCommentClass).toBe("defaultComment");
  });

  test("string entries with non-empty style get style cleared", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // Provide a value so the string branch's style-clear path runs.
    scc.defaultCommentStyle = "color:red;";
    SC.ConstantsSetClasses("px-");
    expect(scc.defaultCommentClass).toBe("px-defaultComment");
    expect(scc.defaultCommentStyle).toBe("");
  });

  test("object entries populate classname and style", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    SC.ConstantsSetClasses("px-");
    // defaultInputEcho is the sole object-type entry in
    // ConstantsDefaultClasses: {classname:"", style:"filter:..."}.
    // With an empty classname it falls back to the item name.
    expect(scc.defaultInputEchoClass).toBe("px-defaultInputEcho");
    expect(typeof scc.defaultInputEchoStyle).toBe("string");
    expect(scc.defaultInputEchoStyle).toContain("opacity");
  });

  test("neither-string-nor-object entries are skipped", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // Add a number entry to ConstantsDefaultClasses (public mutable
    // bag) to exercise the else-if object check's false arm — the
    // "neither string nor object" no-op path. Using a number since
    // typeof null === "object" in JS, so a number (typeof === "number")
    // is cleanly neither string nor object.
    SC.ConstantsDefaultClasses.customNullEntry = 0;
    scc.customNullEntryClass = "should-not-change";
    scc.customNullEntryStyle = "should-not-change";

    SC.ConstantsSetClasses("px-");

    expect(scc.customNullEntryClass).toBe("should-not-change");
    expect(scc.customNullEntryStyle).toBe("should-not-change");

    // Cleanup: restore the bag to its pre-populated state.
    delete SC.ConstantsDefaultClasses.customNullEntry;
  });
});

describe("ConstantsSetImagePrefix hyphen and empty-prefix edge cases", () => {
  test("oldPrefix not ending in underscore leaves hyphen equal to prefix", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // Set oldPrefix to one that does NOT end with "_" so the ternary
    // else arm keeps oldHyphen === oldPrefix (no hyphen rewrite needed).
    scc.defaultImagePrefix = "images/sc";
    SC.ConstantsSetImagePrefix("new-prefix");

    // The function should have updated the prefix.
    expect(scc.defaultImagePrefix).toBe("new-prefix");
  });

  test("empty oldPrefix skips both split replacements", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // oldPrefix = "" -> falsy: `if (oldPrefix)` false arm is taken.
    // oldHyphen = "" (no underscore), so `oldHyphen && ...` is false.
    // Both replacement blocks are skipped — strings are copied as-is.
    scc.defaultImagePrefix = "";
    const snapshot = String(scc.FormatNumber_defaultCurrency || "");
    SC.ConstantsSetImagePrefix("img/sc_");

    // Because oldPrefix was empty, no string should have been rewritten.
    expect(scc.defaultImagePrefix).toBe("img/sc_");
    // Currency string untouched (no image prefix to replace).
    if (snapshot) {
      expect(String(scc.FormatNumber_defaultCurrency)).toBe(snapshot);
    }
  });

  test("underscore-ending oldPrefix triggers hyphen rewrite", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // Default prefix "images/sc_" -> oldHyphen "images/sc-".
    scc.defaultImagePrefix = "images/sc_";
    // Inject a string field that uses the hyphen form so the hyphen
    // replacement path is exercised.
    scc.CustomTestStyle = "background: url(images/sc-icon.png);";
    SC.ConstantsSetImagePrefix("new/sc_");
    expect(scc.defaultImagePrefix).toBe("new/sc_");
    expect(String(scc.CustomTestStyle)).toContain("new/sc-icon.png");
    delete scc.CustomTestStyle;
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: General format value==0 branch
// ---------------------------------------------------------------------------

describe("General format with value 0 covers value!=0 false arm", () => {
  test("General 0 returns '0' and skips magnitude correction", async () => {
    const SC = await loadSC();
    // value != 0 is false -> the factor-correction block is skipped.
    // The integer path then emits "0" for an empty integervalue.
    expect(SC.format_number_for_display(0, "n", "General")).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: date placeholders that match no rendering branch
// ---------------------------------------------------------------------------

describe("unmatched date token falls through all date else-if checks", () => {
  test("hhh is a valid-but-unmatched date operand", async () => {
    const SC = await loadSC();
    // "hhh" parses as a date operand (3 h's) but matches neither "h",
    // "hh", nor "h]" in the rendering switch — covering the false arm
    // of the "ss]" check (last date else-if) and the trailing no-op.
    const result = SC.format_number_for_display(1.5, "nt", "hhh");
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: multi-section date formats -> section-boundary break in
// the forward and backward m-scans
// ---------------------------------------------------------------------------

describe("multi-section date formats hit section operator in m-scans", () => {
  test("forward scan breaks on section operator (date in first section)", async () => {
    const SC = await loadSC();
    // "h:mm;0" — section 0 has date, section 1 is "0".
    // Positive value selects section 0; forward scan reaches the
    // section operator between the two sections and breaks at the
    // `if (op == scfn.commands.section) break;` line.
    expect(SC.format_number_for_display(1.5, "nt", "h:mm;0")).toBe("12:00");
  });

  test("backward scan breaks on section operator (date in third section)", async () => {
    const SC = await loadSC();
    // "0;0;h:mm" — three sections. Zero value selects section 2
    // (h:mm); rawvalue 0 is not negative, so the bad-date guard is
    // skipped and the scans run. The backward scan reaches the
    // preceding section operators and breaks at the
    // `if (op == scfn.commands.section) break;` line.
    // Zero time renders hrs=0, mins=0 -> "0:00".
    expect(SC.format_number_for_display(0, "nt", "0;0;h:mm")).toBe("0:00");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: scaledvalue overflow to NaN via huge fraction digit count
// ---------------------------------------------------------------------------

describe("overflow of decimalscale produces NaN scaledvalue", () => {
  test("format with 310 fraction digits overflows value*decimalscale", async () => {
    const SC = await loadSC();
    // 310 fraction digits push decimalscale past Number.MAX_VALUE,
    // turning value * decimalscale into Infinity. Math.floor(Infinity)
    // / decimalscale => NaN, and !isFinite(NaN) returns "NaN".
    const fmt = "0." + "0".repeat(310);
    expect(SC.format_number_for_display(1e10, "n", fmt)).toBe("NaN");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: parse_format_bracket currency fallback to "$"
// ---------------------------------------------------------------------------

describe("parse_format_bracket currency else-branch reaches $ fallback", () => {
  test("[$] with empty defaultCurrency falls back to literal $", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // [$] -> bracketstr "$" -> regex doesn't match (no group content)
    // -> else branch: substring(1)="" falsy, FormatNumber_defaultCurrency=""
    // -> falls to "$" literal.
    const saved = scc.FormatNumber_defaultCurrency;
    scc.FormatNumber_defaultCurrency = "";

    // A format invoking [$] currency; the parsed operand becomes "$"
    // (the fallback) because both substring and defaultCurrency are empty.
    const result = SC.format_number_for_display(5, "n", "[$]0");

    expect(result).toContain("$");

    // Restore to avoid leaking state into other tests.
    scc.FormatNumber_defaultCurrency = saved;
    expect(SC.format_number_for_display(5, "n", "0")).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: parse_format_bracket comparison operator with no value
// ---------------------------------------------------------------------------

describe("parse_format_bracket comparison operator with no value", () => {
  test("[<] bracket yields operand equal to bracketstr (parts null)", async () => {
    const SC = await loadSC();

    // "[<]" -> bracketstr "<" passes the /^[<>=]/ check but the split
    // regex /^([<>=]+)(.+)$/ needs 2+ chars, so parts is null and
    // operand = bracketstr = "<". The comparison never matches (compop
    // "" matches none of </<=/=/<>/>=/>/<), so the format falls
    // through to "General".
    const result = SC.format_number_for_display(5, "n", "[<]0");
    expect(result).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: parse_format_bracket currency regex-match arm
// ---------------------------------------------------------------------------

describe("parse_format_bracket currency regex-match arm uses parts[1]", () => {
  test("[$-en-US] bracket matches the currency regex -> body content", async () => {
    const SC = await loadSC();

    // "[$-en-US]" -> bracketstr "$-en-US". The regex
    // /^\$(.+?)(-.+?){0,1}$/ matches; parts[1] = "-en-US" (the body
    // after "$" up to the first optional "-..." group). This hits the
    // regex-match arm (parts truthy) of parse_format_bracket.
    const result = SC.format_number_for_display(5, "n", "[$-en-US]0");
    expect(result).toContain("5");
  });
});
