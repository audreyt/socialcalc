import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";
type GlobalSocialCalc = typeof globalThis.SocialCalc;

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
  };
  ConstantsDefaultClasses: Record<string, unknown>;
  ConstantsSetClasses: (prefix?: string) => void;
  FormatNumber: {
    formatNumberWithFormat: (
      rawvalue: number | string,
      format_string: string,
      currency_char?: string,
    ) => string;
    formatTextWithFormat: (rawvalue: string, format_string: string) => string;
    parse_format_string: (format_defs: Record<string, unknown>, format_string: string) => void;
    parse_format_bracket: (bracketstr: string) => { operator: number; operand: string };
    format_definitions: Record<string, unknown>;
    commands: Record<string, number>;
  };
};

async function loadSC(): Promise<SocialCalcLike> {
  return (await loadSocialCalc({ browser: true })) as unknown as SocialCalcLike;
}
async function loadFreshBundleSocialCalc(query: string): Promise<GlobalSocialCalc> {
  const savedSocialCalc = Object.getOwnPropertyDescriptor(globalThis, "SocialCalc");
  Reflect.deleteProperty(globalThis, "SocialCalc");
  try {
    // Dynamic import is intentional: these tests need a fresh Vite module
    // evaluation of the generated UMD bundle so V8 coverage can attribute the
    // targeted dist/SocialCalc.js lines. The normal test helper runs the bundle
    // through vm.Script, which exercises behavior but misses these line spans.
    const bundleSpecifier = `../dist/SocialCalc.js?${query}`;
    await import(bundleSpecifier);
    return Reflect.get(globalThis, "SocialCalc") as GlobalSocialCalc;
  } finally {
    if (savedSocialCalc) {
      Object.defineProperty(globalThis, "SocialCalc", savedSocialCalc);
    } else {
      Reflect.deleteProperty(globalThis, "SocialCalc");
    }
  }
}

// ---------------------------------------------------------------------------
// SocialCalc Constants: ConstantsSetClasses with falsy prefix (L655)
// ---------------------------------------------------------------------------

describe("ConstantsSetClasses falsy-prefix statement coverage", () => {
  test("calling with undefined prefix executes prefix = prefix || '' (L655)", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // Calling with no argument → prefix is undefined → L655 executes
    // `prefix = prefix || ""` → prefix becomes "".
    // With empty prefix, defaultComment (entry "") defaults to item name
    // "defaultComment", so classname becomes "defaultComment".
    SC.ConstantsSetClasses();

    expect(scc.defaultCommentClass).toBe("defaultComment");
  });

  test("calling with null prefix executes prefix = prefix || '' (L655)", async () => {
    const SC = await loadSC();
    const scc = SC.Constants;

    // null is also falsy → L655 executes
    SC.ConstantsSetClasses(null as unknown as string);

    expect(scc.defaultCommentClass).toBe("defaultComment");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: am/pm format without date section → ampmstr falsy (L10675 branch 1)
//    When a format contains "am/pm" but no other date codes, hasdate is not set
//    by parse_format_string, so the date processing loop (L10400-10490) doesn't run
//    and ampmstr stays undefined. In the output loop, `result += ampmstr || ""`
//    takes the false branch (|| "").
// ---------------------------------------------------------------------------

describe("FormatNumber am/pm without date section", () => {
  test("am/pm format with no other date codes produces empty ampmstr (L10675 branch 1)", async () => {
    const SC = await loadSC();

    // "am/pm" parses as a date command but does NOT set hasdate.
    // The date processing loop doesn't run → ampmstr stays undefined.
    // In the output loop: result += ampmstr || "" → "" (branch 1).
    const result = SC.format_number_for_display(0.5, "nt", "am/pm");
    expect(result).toBe("");
  });

  test("a/p format with no other date codes produces empty ampmstr (L10675 branch 1)", async () => {
    const SC = await loadSC();

    // Same as above but with "a/p" instead of "am/pm".
    const result = SC.format_number_for_display(0.5, "nt", "a/p");
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: formatNumberWithFormat throw "Format not parsed error!" (L10296/L10297)
//    UNREACHABLE: parse_format_string always stores a format definition for any
//    input string (line 6 of the function: `format_defs[format_string] = thisformat`),
//    so thisformat is never undefined after parsing. The throw is dead code.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FormatNumber: typeof scaledvalue != "number" (L10373/L10374)
//    UNREACHABLE: scaledvalue = Math.floor(value * decimalscale + 0.5) / decimalscale.
//    Math.floor always returns a number, and dividing a number by a number
//    always produces a number. The typeof check is dead code.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FormatNumber: strparts null check after number regex (L10392/L10393)
//    UNREACHABLE: strvalue = scaledvalue + "" (string representation of a number).
//    Scientific notation (containing "e") is caught earlier at L10381-10390.
//    Infinity/NaN are caught at L10281-10286. A finite number without "e" in
//    its string representation always matches /^\+{0,1}(\d*)(?:\.(\d*)){0,1}$/.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FormatNumber: General format strparts null check (L10588/L10589/L10590)
//    UNREACHABLE: Same regex as above. The General format handler at L10571-10618
//    checks isFinite(value) at L10576 and handles "e" notation at L10583-10585.
//    A finite number without "e" always matches the regex.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FormatNumber: "!! Parse error !!" for unknown operator (L10689/L10690)
//    UNREACHABLE: parse_format_string only pushes operators that are all handled
//    by the if-else chain (copy, color, style, integer_placeholder,
//    fraction_placeholder, decimal, currency, general, date, section, comparison).
//    The separator command (8) is consumed during parsing (converted to
//    sectioninfo.thousandssep) and never pushed to the operators array.
//    No unknown operator can appear in thisformat.operators.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FormatNumber: comparison operator continue branch (L10687 branch 1)
//    UNREACHABLE: Branch 1 (op is NOT comparison) falls through to the else
//    at L10689, which is itself unreachable (see above).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FormatNumber: formatTextWithFormat throw (L10714/L10715)
//    UNREACHABLE: Same as L10296/L10297 — parse_format_string always stores
//    a format definition, so thisformat is never undefined.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FormatNumber: parse_format_bracket currency || chain fallbacks (L10958 branch 1,2)
//    UNREACHABLE: The regex /^\$(.+?)(-.+?){0,1}$/ requires at least 1 character
//    in the first capture group (.+?), so parts[1] is always a non-empty string
//    (always truthy). The || scc.FormatNumber_defaultCurrency and || "$" fallbacks
//    never fire.
// ---------------------------------------------------------------------------

describe("FormatNumber.formatNumberWithFormat LCOV branch matrix", () => {
  test.each([
    { value: Number.POSITIVE_INFINITY, format: "General", currency: "$", expected: "NaN" },
    { value: "not-a-number", format: "@", currency: "$", expected: "not-a-number" },
    { value: -12.345, format: "0.00", currency: "$", expected: "-12.35" },
    { value: 0, format: "0.00", currency: "$", expected: "0.00" },
    { value: 1.25, format: "0.0", currency: "$", expected: "1.3" },
    { value: 42, format: "0$", currency: "€", expected: "42€" },
    { value: 1234567, format: "#,##0", currency: "$", expected: "1,234,567" },
    { value: 0.125, format: "0.0%", currency: "$", expected: "12.5%" },
    { value: 1e21, format: "0%", currency: "$", expected: "1e+23%" },
    { value: -42, format: "$0.00", currency: "€", expected: "-€42.00" },
    {
      value: 42,
      format: "[Blue]0",
      currency: "$",
      expected: '<span style="color:#0000FF;">42</span>',
    },
    {
      value: 42,
      format: "[style=color:red]0",
      currency: "$",
      expected: '<span style="color:red;">42</span>',
    },
    { value: 3, format: "[<5]0;[<10]0.0;0.00", currency: "$", expected: "3" },
    { value: 7, format: "[<5]0;[<10]0.0;0.00", currency: "$", expected: "7.0" },
    { value: 12, format: "[<5]0;[<10]0.0;0.00", currency: "$", expected: "12.00" },
  ])("formats $value with $format", async ({ value, format, currency, expected }) => {
    const SC = await loadSC();
    expect(SC.FormatNumber.formatNumberWithFormat(value, format, currency)).toBe(expected);
  });

  test.each([
    { value: -1, format: "yyyy-mm-dd hh:mm:ss", expected: "??-???-??&nbsp;??:??:??" },
    { value: 0.9999999, format: "hh:mm:ss.0", expected: "00:00:00.0" },
    { value: 0.5, format: "h:mm AM/PM", expected: "0:00 PM" },
    { value: 0.25, format: "h:mm A/P", expected: "6:00 A" },
    { value: 0.5, format: "hh:mm:ss", expected: "12:00:00" },
    { value: 0.5, format: "a", expected: "" },
    { value: 1.5, format: "[h]:mm:ss", expected: "36:00:00" },
    { value: 1.5, format: "[m]:ss", expected: "2160:00" },
    { value: 1.5, format: "[ss]", expected: "129600" },
    {
      value: 44561,
      format: "yyyy m mmm mmmm mmmmm d dd ddd dddd",
      expected: "2021 12 Dec December D 31 31 Fri Friday",
    },
  ])("formats date/time $value with $format", async ({ value, format, expected }) => {
    const SC = await loadSC();
    expect(SC.FormatNumber.formatNumberWithFormat(value, format, "$")).toBe(expected);
  });

  test.each([
    { value: 1.25, format: "0.0", currency: "$", expected: "1.3" },
    { value: 42, format: "0$", currency: "€", expected: "42€" },
    { value: 0.5, format: "hh:mm:ss", currency: "$", expected: "12:00:00" },
    { value: 0.5, format: "a", currency: "$", expected: "" },
  ])(
    "V8-visible bundle import formats $value with $format",
    async ({ value, format, currency, expected }) => {
      const SC = await loadFreshBundleSocialCalc(
        `formatnumber-${String(format).replace(/\W/g, "-")}-${String(value).replace(/\W/g, "-")}`,
      );
      expect(SC.FormatNumber.formatNumberWithFormat(value, format, currency)).toBe(expected);
    },
  );
});

// ---------------------------------------------------------------------------
// FormatNumber: throw "Format not parsed error!" via cache manipulation (L245)
//    parse_format_string always stores a definition, so thisformat is never
//    undefined in normal operation. However, the throw IS reachable if the
//    parsed-format cache (format_definitions) is corrupted between parse and
//    use — e.g. by replacing parse_format_string with a no-op so the cache
//    never gets populated. This is a defensive guard, not dead code.
// ---------------------------------------------------------------------------

describe("FormatNumber throw via cache corruption", () => {
  test("formatNumberWithFormat throws when parse_format_string is a no-op (L245)", async () => {
    const SC = await loadSC();
    const scfn = SC.FormatNumber;
    const origParse = scfn.parse_format_string;
    // Replace parse with no-op so format_definitions never gets the entry.
    scfn.parse_format_string = function () {};
    // Use a NOVEL format string so the cache miss is guaranteed.
    scfn.format_definitions["__cache_corrupt_throw_test__"] = undefined;
    try {
      expect(() => scfn.formatNumberWithFormat(42, "__cache_corrupt_throw_test__", "$")).toThrow(
        "Format not parsed error!",
      );
    } finally {
      scfn.parse_format_string = origParse;
      delete scfn.format_definitions["__cache_corrupt_throw_test__"];
    }
  });

  test("formatTextWithFormat throws when parse_format_string is a no-op (L745)", async () => {
    const SC = await loadSC();
    const scfn = SC.FormatNumber;
    const origParse = scfn.parse_format_string;
    scfn.parse_format_string = function () {};
    scfn.format_definitions["__cache_corrupt_text_throw__"] = undefined;
    try {
      expect(() => scfn.formatTextWithFormat("hello", "__cache_corrupt_text_throw__")).toThrow(
        "Format not parsed error!",
      );
    } finally {
      scfn.parse_format_string = origParse;
      delete scfn.format_definitions["__cache_corrupt_text_throw__"];
    }
  });
});

// ---------------------------------------------------------------------------
// FormatNumber: comparison continue (L706) and parse error statement (L708)
//    These paths are reached by injecting a synthetic parsed format into the
//    cache (scfn.format_definitions). The comparison operator continues the loop,
//    and a bogus operator falls through to line 708's "!! Parse error !!" statement.
// ---------------------------------------------------------------------------

describe("FormatNumber comparison and parse error operator coverage", () => {
  interface BogusFormat {
    sectioninfo: {
      commas: number;
      percent: number;
      fractiondigits: number;
      integerdigits: number;
      sectionstart: number;
      hasdate: boolean;
    }[];
    hascomparison: boolean;
    operators: number[];
    operands: string[];
  }

  test("comparison operator continue (L706) and parse error (L708) reached via synthetic format injection", async () => {
    const SC = await loadSC();
    const scfn = SC.FormatNumber;

    const bogus_format = {
      sectioninfo: [
        {
          commas: 0,
          percent: 0,
          fractiondigits: 0,
          integerdigits: 0,
          sectionstart: 0,
          hasdate: false,
        },
      ],
      hascomparison: false,
      operators: [
        scfn.commands.comparison, // 9 (comparison command)
        9999, // bogus operator code
      ],
      operands: [
        "<=:5", // operand for comparison
        "bogus", // operand for bogus operator
      ],
    } satisfies BogusFormat;

    // Inject directly into the format definitions cache.
    // The parse_format_string function has a cache guard 'if (format_defs[format_string]) return'
    // which skips parsing and lets us use our synthetic format definition directly.
    scfn.format_definitions["__test_bogus__"] = bogus_format as unknown;

    try {
      const result = scfn.formatNumberWithFormat(42, "__test_bogus__", "$");
      // The comparison operator (L706) executes 'continue' (verified by no throwing and loop advancement).
      // The bogus operator (L708) appends '!! Parse error !!' to result.
      expect(result).toBe("!! Parse error !!");
    } finally {
      delete scfn.format_definitions["__test_bogus__"];
    }
  });
});
