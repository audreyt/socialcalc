import { beforeAll, describe, expect, test } from "bun:test";

import { installBrowserShim, loadSocialCalc } from "./helpers/socialcalc";

// DetermineValueType reads navigator.language, and some other code paths use
// navigator indirectly. Install the browser shim so those paths don't throw.
beforeAll(() => {
    installBrowserShim();
});

// ---------------------------------------------------------------------------
// Integer + decimal number formats
// ---------------------------------------------------------------------------
describe("integer and decimal number formats", () => {
    test("formats integer placeholder '0' rounding half-up", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234.567, "n", "0")).toBe("1235");
        expect(SC.format_number_for_display(0.4, "n", "0")).toBe("0");
        expect(SC.format_number_for_display(0.5, "n", "0")).toBe("1");
    });

    test("formats one- and two-decimal formats", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234.567, "n", "0.0")).toBe("1234.6");
        expect(SC.format_number_for_display(1234.567, "n", "0.00")).toBe("1234.57");
    });

    test("formats thousands separator with '#,##0' and '#,##0.00'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234567, "n", "#,##0")).toBe("1,234,567");
        expect(SC.format_number_for_display(1234567.89, "n", "#,##0.00")).toBe("1,234,567.89");
        expect(SC.format_number_for_display(1234567.89, "n", "#,###.##")).toBe("1,234,567.89");
    });

    test("formats zero, negatives, and small/large numbers", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0, "n", "0.00")).toBe("0.00");
        expect(SC.format_number_for_display(-42.5, "n", "0.00")).toBe("-42.50");
        // Very small value (< 1e-6) rounds down to zero under "0.00"
        expect(SC.format_number_for_display(1.5e-7, "n", "0.00")).toBe("0.00");
        expect(SC.format_number_for_display(1e-10, "n", "0.00")).toBe("0.00");
        expect(SC.format_number_for_display(12345678, "n", "#,##0")).toBe("12,345,678");
    });

    test("scientific notation sneak: very large number with '#,##0' returns raw", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // scaledvalue's string form contains "e" for 1e21, so function returns rawvalue+""
        expect(SC.format_number_for_display(1e21, "n", "#,##0")).toBe("1e+21");
    });

    test("non-finite inputs fall back to NaN", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(NaN, "n", "0.00")).toBe("NaN");
        expect(SC.format_number_for_display(Infinity, "n", "0.00")).toBe("NaN");
    });

    test("empty string value returns empty string", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display("", "n", "0.00")).toBe("");
    });
});

// ---------------------------------------------------------------------------
// Currency formats
// ---------------------------------------------------------------------------
describe("currency formats", () => {
    test("formats with leading currency '$#,##0.00'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234.5, "n", "$#,##0.00")).toBe("$1,234.50");
    });

    test("formats parens-for-negative two-section currency", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-42.5, "n", "$#,##0.00;($#,##0.00)")).toBe("($42.50)");
        expect(SC.format_number_for_display(42.5, "n", "$#,##0.00;($#,##0.00)")).toBe("$42.50");
    });

    test("formats with bracketed currency symbols via [$...]", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Bracketed currency: [$£], [$€-40C] (locale suffix), [$] (default), [?$] literal
        expect(SC.format_number_for_display(12, "n", "[$£]#,##0")).toBe("£12");
        expect(SC.format_number_for_display(12, "n", "[$€-40C]#,##0")).toBe("€12");
        expect(SC.format_number_for_display(12, "n", "[$]#,##0")).toBe("$12");
        expect(SC.format_number_for_display(12, "n", "[?$]#,##0")).toBe("[?$]12");
    });

    test("n$ type default currency format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234, "n$", "")).toBe("$1,234.00");
        expect(SC.format_number_for_display(-5, "n$", "Auto")).toBe("-$5.00");
    });
});

// ---------------------------------------------------------------------------
// Percent formats
// ---------------------------------------------------------------------------
describe("percent formats", () => {
    test("formats simple percent", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.125, "n", "0%")).toBe("13%");
        expect(SC.format_number_for_display(0.125, "n", "0.00%")).toBe("12.50%");
        expect(SC.format_number_for_display(-0.1234, "n", "0.00%")).toBe("-12.34%");
    });

    test("n% type default percent format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.125, "n%", "")).toBe("12.5%");
        expect(SC.format_number_for_display(0.25, "n%", "Auto")).toBe("25.0%");
    });
});

// ---------------------------------------------------------------------------
// Scientific notation
// ---------------------------------------------------------------------------
describe("scientific notation", () => {
    test("formats '0E+0', '0.00E+00', '##0.00E+00' (current implementation just scales)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // SocialCalc's scientific notation support is limited — it does not rewrite
        // the exponent, so we just pin down the current observable behavior.
        expect(SC.format_number_for_display(1234, "n", "0E+0")).toBe("123E+4");
        expect(SC.format_number_for_display(1234, "n", "0.00E+00")).toBe("1234.00E+00");
        expect(SC.format_number_for_display(1234, "n", "##0.00E+00")).toBe("1234.00E+00");
        expect(SC.format_number_for_display(0.0001234, "n", "0.00E+00")).toBe("0.00E+01");
    });
});

// ---------------------------------------------------------------------------
// Fractions
// ---------------------------------------------------------------------------
describe("fraction placeholders '?'", () => {
    test("renders fraction placeholders as non-breaking space padding", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // '?' placeholders produce nbsp (as SocialCalc does not compute fractions,
        // the numerator/denominator digits simply render as spaces for missing positions).
        expect(SC.format_number_for_display(0.5, "n", "# ?/?")).toBe(" &nbsp;/1");
        expect(SC.format_number_for_display(0.5, "n", "# ??/??")).toBe(" &nbsp;&nbsp;/&nbsp;1");
        expect(SC.format_number_for_display(1.5, "n", "# ?/?")).toBe(" &nbsp;/2");
    });
});

// ---------------------------------------------------------------------------
// Sectioned formats
// ---------------------------------------------------------------------------
describe("sectioned formats (pos;neg;zero;text)", () => {
    test("three-section format selects zero branch", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const fmt = "#,##0.00;(#,##0.00);\"zero\"";
        expect(SC.format_number_for_display(1234.5, "n", fmt)).toBe("1,234.50");
        expect(SC.format_number_for_display(-1234.5, "n", fmt)).toBe("(1,234.50)");
        expect(SC.format_number_for_display(0, "n", fmt)).toBe("zero");
    });

    test("four-section format includes text fall-through", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const fmt = "#,##0.00;(#,##0.00);\"zero\";@";
        expect(SC.format_number_for_display("hello", "n", fmt)).toBe("hello");
    });

    test("two-section format: negative reuses second section", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-5, "n", "0.00;0.00")).toBe("5.00");
    });

    test("comparison bracket selects matching section", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const fmt = '[>0]"pos";[<0]"neg";"zero"';
        expect(SC.format_number_for_display(5, "n", fmt)).toBe("pos");
        expect(SC.format_number_for_display(-5, "n", fmt)).toBe("neg");
        expect(SC.format_number_for_display(0, "n", fmt)).toBe("zero");
    });

    test("all comparison operators", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0, "n", '[=0]"zero";General')).toBe("zero");
        expect(SC.format_number_for_display(10, "n", '[>=5]"big";General')).toBe("big");
        expect(SC.format_number_for_display(10, "n", '[<>5]"not5";General')).toBe("not5");
        expect(SC.format_number_for_display(10, "n", '[<=10]"le10";General')).toBe("le10");
        expect(SC.format_number_for_display(5, "n", '[<10]"small";General')).toBe("small");
        expect(SC.format_number_for_display(20, "n", '[>10]"big";General')).toBe("big");
    });

    test("no-match comparison falls back to General", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // When no section matches and every section carries a comparison, the code
        // discards the format and renders with "General".
        expect(SC.format_number_for_display(5, "n", '[>100]"big"')).toBe("5");
    });
});

// ---------------------------------------------------------------------------
// Color directives
// ---------------------------------------------------------------------------
describe("color directives", () => {
    test("wraps result in a span with the mapped color", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "n", "[red]0")).toBe(
            '<span style="color:#FF0000;">1</span>',
        );
        expect(SC.format_number_for_display(1, "n", "[blue]0")).toBe(
            '<span style="color:#0000FF;">1</span>',
        );
        expect(SC.format_number_for_display(1, "n", "[black]0")).toBe(
            '<span style="color:#000000;">1</span>',
        );
        expect(SC.format_number_for_display(1, "n", "[green]0")).toBe(
            '<span style="color:#00FF00;">1</span>',
        );
        expect(SC.format_number_for_display(1, "n", "[cyan]0")).toBe(
            '<span style="color:#00FFFF;">1</span>',
        );
        expect(SC.format_number_for_display(1, "n", "[magenta]0")).toBe(
            '<span style="color:#FF00FF;">1</span>',
        );
        expect(SC.format_number_for_display(1, "n", "[yellow]0")).toBe(
            '<span style="color:#FFFF00;">1</span>',
        );
    });

    test("style bracket applies raw style attribute", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12, "n", "[style=font-weight:bold]0")).toBe(
            '<span style="font-weight:bold;">12</span>',
        );
    });

    test("unknown bracket content is treated as a literal", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12, "n", "[unknown]0")).toBe("[unknown]12");
    });
});

// ---------------------------------------------------------------------------
// Date formats
// ---------------------------------------------------------------------------
describe("date formats", () => {
    // Serial 45291 is 2023-12-31 (Sunday).
    test("common date tokens render correctly for 2023-12-31", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(45291, "nd", "yyyy-mm-dd")).toBe("2023-12-31");
        expect(SC.format_number_for_display(45291, "nd", "m/d/yy")).toBe("12/31/23");
        expect(SC.format_number_for_display(45291, "nd", "d-mmm-yy")).toBe("31-Dec-23");
        expect(SC.format_number_for_display(45291, "nd", "mmmm d, yyyy")).toBe("December 31, 2023");
    });

    test("day-of-week tokens ddd and dddd", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(45291, "nd", "ddd")).toBe("Sun");
        expect(SC.format_number_for_display(45291, "nd", "dddd")).toBe("Sunday");
    });

    test("individual y/yy/d/dd/m/mm/mmm/mmmm/mmmmm tokens", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(45291, "nd", "y")).toBe("23");
        expect(SC.format_number_for_display(45291, "nd", "yy")).toBe("23");
        expect(SC.format_number_for_display(45291, "nd", "d")).toBe("31");
        expect(SC.format_number_for_display(45291, "nd", "dd")).toBe("31");
        expect(SC.format_number_for_display(45291, "nd", "m")).toBe("12");
        expect(SC.format_number_for_display(45291, "nd", "mm")).toBe("12");
        expect(SC.format_number_for_display(45291, "nd", "mmm")).toBe("Dec");
        expect(SC.format_number_for_display(45291, "nd", "mmmm")).toBe("December");
        expect(SC.format_number_for_display(45291, "nd", "mmmmm")).toBe("D");
    });

    test("negative serial produces bad-date placeholder", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-1, "nd", "yyyy-mm-dd")).toBe("??-???-??&nbsp;??:??:??");
    });

    test("nd type default format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(45291, "nd", "")).toBe("31-Dec-2023");
    });
});

// ---------------------------------------------------------------------------
// Time formats
// ---------------------------------------------------------------------------
describe("time formats", () => {
    test("h:mm:ss and hh:mm:ss AM/PM", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1.5, "nt", "h:mm:ss")).toBe("12:00:00");
        // 1.5 serial => noon; the implementation subtracts 12 when hrs>=12 which gives 00
        expect(SC.format_number_for_display(1.5, "nt", "hh:mm:ss AM/PM")).toBe("00:00:00 PM");
    });

    test("elapsed [h]:mm:ss, [mm]:ss, [ss]", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // [h] is handled; [hh] is not in alloweddates so is emitted as literal
        expect(SC.format_number_for_display(1.5, "nt", "[h]:mm:ss")).toBe("36:00:00");
        expect(SC.format_number_for_display(1.5, "nt", "[mm]:ss")).toBe("2160:00");
        expect(SC.format_number_for_display(1.5, "nt", "[ss]")).toBe("129600");
    });

    test("elapsed [m] maps to total minutes via alloweddates", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1.5, "nt", "[m]")).toBe("2160");
    });

    test("minute vs month disambiguation: m after h is minutes", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // For serial 45291.5, noon: 'h:mm' -> "12:00"
        expect(SC.format_number_for_display(45291.5, "nt", "h:mm")).toBe("12:00");
        // 'hh:m:ss' -> m becomes minutes because preceded by hh
        expect(SC.format_number_for_display(45291.5, "nt", "hh:m:ss")).toBe("12:0:00");
        // 'mm:ss' -> mm is minutes because followed by ss
        expect(SC.format_number_for_display(45291.5, "nt", "mm:ss")).toBe("00:00");
    });

    test("A/P short am/pm token", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.5, "nt", "h:m A/P")).toBe("0:0 P");
    });

    test("nt type default format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1.5, "nt", "")).toBe("36:00:00");
    });
});

// ---------------------------------------------------------------------------
// Datetime combos
// ---------------------------------------------------------------------------
describe("datetime combined formats", () => {
    test("yyyy-mm-dd hh:mm:ss", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(45291.75, "ndt", "yyyy-mm-dd hh:mm:ss")).toBe(
            "2023-12-31 18:00:00",
        );
        expect(SC.format_number_for_display(45291.99999, "ndt", "yyyy-mm-dd hh:mm:ss")).toBe(
            "2023-12-31 23:59:59",
        );
    });

    test("ndt default format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(45291.5, "ndt", "")).toBe("31-Dec-2023 12:00:00");
    });
});

// ---------------------------------------------------------------------------
// Logical values
// ---------------------------------------------------------------------------
describe("logical values (type nl)", () => {
    test("truthy renders as TRUE, zero as FALSE", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "nl", "")).toBe("TRUE");
        expect(SC.format_number_for_display(0.5, "nl", "")).toBe("TRUE");
        expect(SC.format_number_for_display(0, "nl", "")).toBe("FALSE");
    });

    test("'logical' format string works without Auto", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "n", "logical")).toBe("TRUE");
        expect(SC.format_number_for_display(0, "n", "logical")).toBe("FALSE");
    });
});

// ---------------------------------------------------------------------------
// Text formats
// ---------------------------------------------------------------------------
describe("format_text_for_display", () => {
    test("text-plain converts newlines and multiple spaces", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_text_for_display("line1\nline2", "t", "text-plain", null, "")).toBe(
            "line1<br>line2",
        );
        expect(SC.format_text_for_display("a  b  c", "t", "", null, "")).toBe("a&nbsp; b&nbsp; c");
    });

    test("text-html preserves markup unchanged", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_text_for_display("<b>html</b>", "th", "text-html", null, "")).toBe(
            "<b>html</b>",
        );
    });

    test("text-wiki routes through the default expand_markup callback", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // With no expand_wiki override, text-wiki runs default_expand_markup, which
        // returns the value after minimal special-chars/space/newline normalisation.
        expect(SC.format_text_for_display("wiki  stuff", "tw", "text-wiki", null, "")).toBe(
            "wiki&nbsp; stuff",
        );
    });

    test("text-wiki with a custom expand_wiki callback receives the value", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const prev = SC.Callbacks.expand_wiki;
        SC.Callbacks.expand_wiki = (v: string) => `[wiki]${v}`;
        try {
            expect(
                SC.format_text_for_display("thing", "tw", "text-wiki-inline", null, ""),
            ).toBe("[wiki]thing");
        } finally {
            SC.Callbacks.expand_wiki = prev;
        }
    });

    test("text-url wraps in anchor tag", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_text_for_display("https://example.com", "t", "text-url", null, "")).toBe(
            '<a href="https://example.com">https://example.com</a>',
        );
    });

    test("text-image wraps in img tag", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(
            SC.format_text_for_display("http://example.com/pic.jpg", "t", "text-image", null, ""),
        ).toBe('<img src="http://example.com/pic.jpg">');
    });

    test("text-link expands into anchor via ParseCellLinkText", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(
            SC.format_text_for_display("desc<http://example.com>", "tl", "text-link", null, ""),
        ).toBe('<a href="http://example.com" target="_blank">desc</a>');
    });

    test("text-link uses default format string when desc is empty", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const defaultLink = SC.Constants.defaultLinkFormatString;
        // "<http://x/>" has no description -> default link label
        const out = SC.format_text_for_display("<http://x/>", "tl", "text-link", null, "");
        expect(out).toContain(defaultLink);
        expect(out).toContain('href="http://x/"');
    });

    test("text-link strips http:// prefix when link is raw (no <>)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Long-enough raw URL without trailing '>' -> desc gets "http://" removed
        const out = SC.format_text_for_display("http://example.com/page", "tl", "text-link", null, "");
        expect(out).toContain(">example.com/page<");
    });

    test("text-link with pagename uses page-link label and MakePageLink callback", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const prev = SC.Callbacks.MakePageLink;
        SC.Callbacks.MakePageLink = (page: string, workspace: string) =>
            `/url/${workspace || "default"}/${page}`;
        try {
            const out = SC.format_text_for_display("{ws [p]}", "tl", "text-link", null, "");
            expect(out).toContain('href="/url/default/p"');
            expect(out).toContain(SC.Constants.defaultPageLinkFormatString);
        } finally {
            SC.Callbacks.MakePageLink = prev;
        }
    });

    test("text-link with linkstyle omits target=_blank", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const out = SC.format_text_for_display("desc<http://x/>", "tl", "text-link", null, "style");
        expect(out).not.toContain('target="_blank"');
    });

    test("text-custom template expands @r/@s/@u placeholders", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_text_for_display("ho", "t", "text-custom:@s-@u-@r", null, "")).toBe(
            "ho-ho-ho",
        );
    });

    test("custom format appends (custom format) marker", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_text_for_display("hi", "t", "custom", null, "")).toBe(
            "hi (custom format)",
        );
    });

    test("hidden format returns nbsp", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_text_for_display("secret", "t", "hidden", null, "")).toBe("&nbsp;");
    });

    test("nontextvalueformat path routes through format_number_for_display", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const sheetobj = { valueformats: { 1: "0.00" } };
        expect(SC.format_text_for_display(42.5, "t", "none", sheetobj, "", 1)).toBe("42.50");
    });

    test("General format string falls through to plain text handling", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_text_for_display("foo bar", "t", "General", null, "")).toBe("foo bar");
    });

    test("subtype derived from valuetype when no format provided", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // valuetype "tl" -> text-link path
        expect(SC.format_text_for_display("http://x/<http://x/>", "tl", "", null, "")).toContain(
            '<a href="http://x/"',
        );
    });
});

// ---------------------------------------------------------------------------
// Quoted literals, escapes, padding, asterisk
// ---------------------------------------------------------------------------
describe("literal and escape handling in format strings", () => {
    test("double-quoted literal is copied verbatim", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234, "n", '"total "#,##0')).toBe("total 1,234");
    });

    test("unclosed quote absorbs rest of format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Unterminated quoted string: nothing further is emitted for the trailing content
        expect(SC.format_number_for_display(12, "n", '0"')).toBe("12");
    });

    test("backslash escapes next character", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12, "n", "\\d0")).toBe("d12");
    });

    test("asterisk repeats following character five times", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12, "n", "*x0")).toBe("xxxxx12");
    });

    test("underscore emits a non-breaking space", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234, "n", "_(#,##0.00_)")).toBe("&nbsp;1,234.00&nbsp;");
    });

    test("explicit thousands separator [,] with General format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234567, "n", "[,]General")).toBe("1,234,567");
    });

    test("'@' placeholder in number format copies literal '@'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Number branch doesn't treat '@' specially — it is just a literal character.
        expect(SC.format_number_for_display(1234, "n", "@")).toBe("@");
    });

    test("empty format string yields General rendering", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234, "n", "")).toBe("1234");
        expect(SC.format_number_for_display(1234.56, "n", "General")).toBe("1234.56");
    });

    test("General path handles zero, very small, and large magnitudes", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0, "n", "General")).toBe("0");
        expect(SC.format_number_for_display(0.0000001, "n", "General")).toBe("1e-7");
        expect(SC.format_number_for_display(1.234e15, "n", "General")).toBe("1234000000000000");
    });
});

// ---------------------------------------------------------------------------
// formatTextWithFormat directly (text fall-through for non-numeric values)
// ---------------------------------------------------------------------------
describe("FormatNumber.formatTextWithFormat", () => {
    test("one-section with '@' places value", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatTextWithFormat("hello", "@")).toBe("hello");
    });

    test("quoted literals convert spaces to nbsp", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatTextWithFormat("abc", '"pre "@" suf"')).toBe(
            "pre&nbsp;abc&nbsp;suf",
        );
    });

    test("color bracket wraps text result in span", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatTextWithFormat("abc", "[red]@")).toBe(
            '<span style="color:#FF0000;">abc</span>',
        );
    });

    test("style bracket wraps text result", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatTextWithFormat("abc", "[style=foo]@")).toBe(
            '<span style="foo;">abc</span>',
        );
    });

    test("two-section text format falls through to passthrough", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // When section count is not 0 or 3 the function returns the value unchanged
        expect(SC.FormatNumber.formatTextWithFormat("hi", "0;@")).toBe("hi");
    });

    test("four-section format uses the last (text) section", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatTextWithFormat("hi", "0;0;0;@")).toBe("hi");
    });

    test("non-finite strings route here and respect the format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Non-numeric strings are routed through formatTextWithFormat by
        // formatNumberWithFormat when value is not finite.
        expect(SC.format_number_for_display("abc", "n", "@")).toBe("abc");
        // With no '@' in format, the fall-through yields empty
        expect(SC.format_number_for_display("abc", "n", "0.00")).toBe("");
    });
});

// ---------------------------------------------------------------------------
// DetermineValueType
// ---------------------------------------------------------------------------
describe("DetermineValueType", () => {
    test("blank and whitespace", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("")).toEqual({ value: "", type: "" });
        expect(SC.DetermineValueType("   ")).toEqual({ value: "   ", type: "t" });
    });

    test("plain numbers including exponential", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("1234")).toEqual({ value: 1234, type: "n" });
        expect(SC.DetermineValueType("-1.5")).toEqual({ value: -1.5, type: "n" });
        expect(SC.DetermineValueType("1.5e3")).toEqual({ value: 1500, type: "n" });
        expect(SC.DetermineValueType("+42")).toEqual({ value: 42, type: "n" });
        expect(SC.DetermineValueType("0")).toEqual({ value: 0, type: "n" });
    });

    test("comma-separated number", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("1,234.5")).toEqual({ value: 1234.5, type: "n" });
    });

    test("currency formats", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("$12.49")).toEqual({ value: 12.49, type: "n$" });
        expect(SC.DetermineValueType("$1,234.56")).toEqual({ value: 1234.56, type: "n$" });
    });

    test("percent formats", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("15.1%")).toEqual({ value: 0.151, type: "n%" });
        expect(SC.DetermineValueType("1,234.56%")).toEqual({ value: 12.3456, type: "n%" });
    });

    test("ISO date", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("2023-12-31")).toEqual({ value: 45291, type: "nd" });
        expect(SC.DetermineValueType("2023/12/31")).toEqual({ value: 45291, type: "nd" });
    });

    test("MM/DD/YYYY US date", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("12/31/2023")).toEqual({ value: 45291, type: "nd" });
        expect(SC.DetermineValueType("12/31/23")).toEqual({ value: 45291, type: "nd" });
    });

    test("time values", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("13:45")).toEqual({
            value: 13 / 24 + 45 / (24 * 60),
            type: "nt",
        });
        expect(SC.DetermineValueType("13:45:00")).toEqual({
            value: 13 / 24 + 45 / (24 * 60),
            type: "nt",
        });
    });

    test("datetime combined", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const out = SC.DetermineValueType("2023-12-31 13:45");
        expect(out.type).toBe("ndt");
        expect(out.value).toBeCloseTo(45291 + 13 / 24 + 45 / (24 * 60), 10);
        const out2 = SC.DetermineValueType("2023-12-31 13:45:00");
        expect(out2.type).toBe("ndt");
    });

    test("invalid time components remain text", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("25:30")).toEqual({ value: "25:30", type: "t" });
        expect(SC.DetermineValueType("12:60:00")).toEqual({ value: "12:60:00", type: "t" });
    });

    test("logical constants are case-insensitive", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("TRUE")).toEqual({ value: 1, type: "nl" });
        expect(SC.DetermineValueType("true")).toEqual({ value: 1, type: "nl" });
        expect(SC.DetermineValueType("False")).toEqual({ value: 0, type: "nl" });
    });

    test("error constants", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("#DIV/0!")).toEqual({ value: 0, type: "e#DIV/0!" });
        expect(SC.DetermineValueType("#N/A")).toEqual({ value: 0, type: "e#N/A" });
        expect(SC.DetermineValueType("#REF!")).toEqual({ value: 0, type: "e#REF!" });
    });

    test("URL and HTML detection", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("http://example.com/foo")).toEqual({
            value: "http://example.com/foo",
            type: "tl",
        });
        expect(SC.DetermineValueType("<p>hello</p>")).toEqual({
            value: "<p>hello</p>",
            type: "th",
        });
    });

    test("fraction form", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("1 1/2")).toEqual({ value: 1.5, type: "n" });
        expect(SC.DetermineValueType("-1 1/2")).toEqual({ value: -1.5, type: "n" });
        // denominator 0 keeps as text
        expect(SC.DetermineValueType("+5 3/0")).toEqual({ value: "+5 3/0", type: "t" });
    });

    test("non-number garbage stays as text", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.DetermineValueType("plain text")).toEqual({ value: "plain text", type: "t" });
        expect(SC.DetermineValueType("-")).toEqual({ value: "-", type: "t" });
    });
});

// ---------------------------------------------------------------------------
// ParseCellLinkText
// ---------------------------------------------------------------------------
describe("ParseCellLinkText", () => {
    test("bare URL treated as url and desc", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText("http://example.com")).toEqual({
            url: "http://example.com",
            desc: "http://example.com",
            newwin: false,
            pagename: "",
            workspace: "",
        });
    });

    test("desc<url>", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText("desc<http://example.com>")).toEqual({
            url: "http://example.com",
            desc: "desc",
            newwin: false,
            pagename: "",
            workspace: "",
        });
    });

    test("quoted desc strips quotes", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText('"desc"<http://example.com>')).toEqual({
            url: "http://example.com",
            desc: "desc",
            newwin: false,
            pagename: "",
            workspace: "",
        });
    });

    test("desc<<url>> sets newwin", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText("desc<<http://example.com>>")).toEqual({
            url: "http://example.com",
            desc: "desc",
            newwin: true,
            pagename: "",
            workspace: "",
        });
    });

    test("[page] form", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText("[page]")).toEqual({
            url: "",
            desc: "",
            newwin: false,
            pagename: "page",
            workspace: "",
        });
        expect(SC.ParseCellLinkText("[[page]]")).toEqual({
            url: "",
            desc: "",
            newwin: true,
            pagename: "page",
            workspace: "",
        });
    });

    test("desc[page] and \"desc\"[page]", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText("desc[page]")).toEqual({
            url: "",
            desc: "desc",
            newwin: false,
            pagename: "page",
            workspace: "",
        });
        expect(SC.ParseCellLinkText('"desc"[page]')).toEqual({
            url: "",
            desc: "desc",
            newwin: false,
            pagename: "page",
            workspace: "",
        });
    });

    test("workspace {ws [page]} form", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText("{workspace [page]}")).toEqual({
            url: "",
            desc: "",
            newwin: false,
            pagename: "page",
            workspace: "workspace",
        });
        expect(SC.ParseCellLinkText("desc{workspace [page]}")).toEqual({
            url: "",
            desc: "desc",
            newwin: false,
            pagename: "page",
            workspace: "workspace",
        });
        expect(SC.ParseCellLinkText("{workspace [[page]]}")).toEqual({
            url: "",
            desc: "",
            newwin: true,
            pagename: "page",
            workspace: "workspace",
        });
    });

    test("empty input", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.ParseCellLinkText("")).toEqual({
            url: "",
            desc: "",
            newwin: false,
            pagename: "",
            workspace: "",
        });
    });
});

// ---------------------------------------------------------------------------
// FormatNumber helper functions
// ---------------------------------------------------------------------------
describe("FormatNumber helper functions and constants", () => {
    test("convert_date_gregorian_to_julian round-trips", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const j = SC.FormatNumber.convert_date_gregorian_to_julian(2023, 12, 31);
        expect(j).toBe(2460310);
        const ymd = SC.FormatNumber.convert_date_julian_to_gregorian(j);
        expect(ymd).toEqual({ year: 2023, month: 12, day: 31 });
    });

    test("convert_date handles pre-2000 and leap dates", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.convert_date_gregorian_to_julian(2000, 2, 29)).toBe(2451604);
        const ymd = SC.FormatNumber.convert_date_julian_to_gregorian(2451544);
        expect(ymd).toEqual({ year: 1999, month: 12, day: 31 });
        const ymd2 = SC.FormatNumber.convert_date_julian_to_gregorian(2451545);
        expect(ymd2).toEqual({ year: 2000, month: 1, day: 1 });
    });

    test("SocialCalc.intFunc truncates toward zero", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.intFunc(3.9)).toBe(3);
        expect(SC.intFunc(-3.1)).toBe(-3);
        expect(SC.intFunc(-3.9)).toBe(-3);
        expect(SC.intFunc(0)).toBe(0);
    });

    test("parse_format_string caches parsed results", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const defs = {} as Record<string, unknown>;
        SC.FormatNumber.parse_format_string(defs, "0.00");
        const parsed = defs["0.00"];
        // Second call should be a no-op (same object reference)
        SC.FormatNumber.parse_format_string(defs, "0.00");
        expect(defs["0.00"]).toBe(parsed);
    });

    test("parse_format_string handles 'Go' (G-prefix that is not 'General')", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const defs = {} as Record<string, unknown>;
        SC.FormatNumber.parse_format_string(defs, "Go");
        expect(defs["Go"]).toBeDefined();
    });

    test("parse_format_bracket direct access", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.parse_format_bracket("RED").operand).toBe("#FF0000");
        expect(SC.FormatNumber.parse_format_bracket("h").operand).toBe("h]");
        expect(SC.FormatNumber.parse_format_bracket(",").operator).toBe(
            SC.FormatNumber.commands.separator,
        );
        expect(SC.FormatNumber.parse_format_bracket("style=foo").operand).toBe("foo");
        expect(SC.FormatNumber.parse_format_bracket(">=5").operand).toBe(">=:5");
        // Unknown bracket falls through to literal-copy
        const unk = SC.FormatNumber.parse_format_bracket("whatever");
        expect(unk.operator).toBe(SC.FormatNumber.commands.copy);
        expect(unk.operand).toBe("[whatever]");
    });

    test("formatNumberWithFormat accepts currency_char for bracketed currency", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatNumberWithFormat(1234, "[$€]#,##0", "€")).toBe("€1,234");
    });

    test("InputConstants exposes all expected keys", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(Object.keys(SC.InputConstants).sort()).toEqual(
            [
                "#DIV/0!",
                "#N/A",
                "#NAME?",
                "#NULL!",
                "#NUM!",
                "#REF!",
                "#VALUE!",
                "FALSE",
                "TRUE",
            ].sort(),
        );
    });
});

// ---------------------------------------------------------------------------
// Rollover and scale edge cases
// ---------------------------------------------------------------------------
describe("number scaling and time rollover edge cases", () => {
    test("trailing commas scale by 1000s", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234567, "n", "#,##0,")).toBe("1,235");
        expect(SC.format_number_for_display(1234567890, "n", "#0,,")).toBe("1235");
    });

    test("seconds rollover bumps minutes, then hours, then day", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // 10:59:59.6 -> rounds seconds to 60 -> mins=60 -> hrs=11, mins=0, secs=0
        const minRoll = 45291 + (10 * 3600 + 59 * 60 + 59.6) / 86400;
        expect(SC.format_number_for_display(minRoll, "ndt", "yyyy-mm-dd hh:mm:ss")).toBe(
            "2023-12-31 11:00:00",
        );

        // 22:59:59.6 -> rolls mins then hrs up to 23, stays same day
        const hrRoll = 45291 + (22 * 3600 + 59 * 60 + 59.6) / 86400;
        expect(SC.format_number_for_display(hrRoll, "ndt", "yyyy-mm-dd hh:mm:ss")).toBe(
            "2023-12-31 23:00:00",
        );

        // 23:59:59.6 -> rolls all the way into next day
        const dayRoll = 45291 + (23 * 3600 + 59 * 60 + 59.6) / 86400;
        expect(SC.format_number_for_display(dayRoll, "ndt", "yyyy-mm-dd hh:mm:ss")).toBe(
            "2024-01-01 00:00:00",
        );
    });

    test("ss.0 fraction digits in date/time path", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Adds a half-second so fraction is preserved
        expect(SC.format_number_for_display(1.5 + 0.5 / 86400, "nt", "ss.0")).toBe("00.5");
    });

    test("A/P and AM/PM render PM branch and preserve case", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.9, "nt", "h A/P")).toBe("9 P");
        expect(SC.format_number_for_display(0.9, "nt", "h AM/PM")).toBe("9 PM");
        // Lowercase in the format yields lowercase in the output
        expect(SC.format_number_for_display(0.9, "nt", "h am/pm")).toBe("9 pm");
    });

    test("hh token and seconds 's' (no zero pad) token", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1.5 + 5 / 86400, "nt", "h:mm:s")).toBe("12:00:5");
    });

    test("'mm]' with emins<100 pads to two digits", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // 0.05 of a day = 72 minutes > 100? 0.005 of a day = 7.2 minutes < 100.
        expect(SC.format_number_for_display(0.005, "nt", "[mm]:ss")).toBe("07:12");
    });

    test("'ss]' with esecs<100 pads to two digits", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.0005, "nt", "[ss]")).toBe("43");
        expect(SC.format_number_for_display(0.00001, "nt", "[ss]")).toBe("01");
    });

    test("field wider than value pads with the placeholder character", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // 6 integer digits with thousands separator -> pad zeros and insert comma
        expect(SC.format_number_for_display(12, "n", "000,000")).toBe("000,012");
    });

    test("negative number with leading decimal format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-0.5, "n", ".00")).toBe("-.50");
    });

    test("negative number via General path", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-12.5, "n", "General")).toBe("-12.5");
    });

    test("non-copy non-date operator between h and m resets minute detection", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // '#' is a placeholder (integer_placeholder command), not a copy/date, so
        // the 'm' after it should be treated as months, not minutes.
        expect(SC.format_number_for_display(0.5, "nt", "h#m")).toBe("12112");
    });

    test("comparison-in-non-first-section still evaluates", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", "[red]0;[>0]0")).toContain("#FF0000");
    });

    test("partial AM/PM run that does not complete ('axz') is discarded", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // The tokens after 'a' never complete 'am/pm' or 'a/p', so they are not
        // emitted as date tokens. Only the 'h' digit survives.
        expect(SC.format_number_for_display(0.5, "nt", "h axz")).toBe("12 ");
    });
});

// ---------------------------------------------------------------------------
// Miscellaneous whitespace / hidden paths
// ---------------------------------------------------------------------------
describe("miscellaneous format behaviors", () => {
    test("'hidden' format from number branch returns nbsp", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12, "n", "hidden")).toBe("&nbsp;");
    });

    test("n type with 'Auto' format returns General", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12.5, "n", "Auto")).toBe("12.5");
    });

    test("positive two-section format uses first section", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", "0.00;0.00")).toBe("5.00");
    });
});

// ===========================================================================
// Mutation-kill tests for js/formatnumber2.js survivors.
// Each describe block calls out the target mutants (from reports/mutation/).
// ===========================================================================

// ---------------------------------------------------------------------------
// ArrayDeclaration survivors on the module-level name arrays (lines 50-54).
// The arrays are exposed on SocialCalc.FormatNumber but otherwise unused inside
// formatnumber2.js itself, so the only way to kill these is by directly
// asserting their contents after load.
// Kills: 5, 13, 21, 34.
// ---------------------------------------------------------------------------
describe("FormatNumber.daynames / monthnames arrays are populated", () => {
    test("daynames has 7 entries starting with Sunday", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.daynames).toEqual([
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ]);
    });

    test("daynames3 has 7 entries starting with Sun", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.daynames3).toEqual([
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
        ]);
    });

    test("monthnames3 has 12 entries starting with Jan", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.monthnames3).toEqual([
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ]);
    });

    test("monthnames has 12 entries starting with January", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.monthnames).toEqual([
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
});

// ---------------------------------------------------------------------------
// String-to-number coercion at L96: `value = rawvalue - 0` (not `+ 0`).
// Passing a numeric string must coerce via subtraction; string concatenation
// would silently multiply the scaled value by 10.
// Kills: 77.
// ---------------------------------------------------------------------------
describe("formatNumberWithFormat coerces string rawvalue via subtraction", () => {
    test("numeric string '9' formats as 9.00 (not 9000.00)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatNumberWithFormat("9", "0.00", "")).toBe("9.00");
    });

    test("numeric string '1.5' formats as 1.50 (not 150.00)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatNumberWithFormat("1.5", "0.00", "")).toBe("1.50");
    });
});

// ---------------------------------------------------------------------------
// Comparison-bracket section selection (L147-152). The existing tests cover the
// positive case for each operator; we need the negative case so the mutation
// that collapses the condition to `true` is distinguishable.
// Kills: 163, 171, 178, 185, 186, 190.
// ---------------------------------------------------------------------------
describe("comparison-bracket operators only match when predicate holds", () => {
    test("[<10] does not match when value is 20 (falls to General)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(20, "n", '[<10]"small";General')).toBe("20");
    });

    test("[<=10] does not match when value is 20", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(20, "n", '[<=10]"le10";General')).toBe("20");
    });

    test("[=10] does not match when value is 20", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(20, "n", '[=10]"eq10";General')).toBe("20");
    });

    test("[<>10] does not match when value equals 10", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(10, "n", '[<>10]"ne10";General')).toBe("10");
    });

    test("[<>10] matches when value is 5 (< compval triggers the != side)", async () => {
        // Kills the EqualityOperator mutant at L150 that turns `!=` into `>`.
        // Under that mutant, 5 > 10 is false and the section would be skipped.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", '[<>10]"ne";General')).toBe("ne");
    });

    test("[>=10] matches when value equals 10 exactly", async () => {
        // Kills the EqualityOperator mutant at L151 that turns `>=` into `>`.
        // Under that mutant, 10 > 10 is false and the section would be skipped.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(10, "n", '[>=10]"ge";General')).toBe("ge");
    });

    test("[>=10] does not match when value is 5", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", '[>=10]"ge10";General')).toBe("5");
    });

    test("[>10] does not match when value is 5", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", '[>10]"gt10";General')).toBe("5");
    });
});

// ---------------------------------------------------------------------------
// Multi-section selection (L169). Existing tests only cover 3-section formats.
// Four-section (section === 3) and five-section (section === 4) cases exercise
// the `section == 2 || section == 3` branch directly.
// Kills: 210, 215, 216.
// ---------------------------------------------------------------------------
describe("multi-section dispatch for 4-section and 5-section formats", () => {
    test("4-section format: positive number uses section 0", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", '"pos";"neg";"zero";"text"')).toBe("pos");
    });

    test("4-section format: negative number uses section 1", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-5, "n", '"pos";"neg";"zero";"text"')).toBe("neg");
    });

    test("4-section format: zero uses section 2", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0, "n", '"pos";"neg";"zero";"text"')).toBe("zero");
    });

    test("5-section format: number skips section dispatch and uses the last section", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Five sections: section variable starts at 4 and stays 4 under the
        // real code (neither of the two inner branches match).
        expect(SC.format_number_for_display(5, "n", '"a";"b";"c";"d";"e"')).toBe("e");
        expect(SC.format_number_for_display(-5, "n", '"a";"b";"c";"d";"e"')).toBe("e");
        expect(SC.format_number_for_display(0, "n", '"a";"b";"c";"d";"e"')).toBe("e");
    });
});

// ---------------------------------------------------------------------------
// Zero-scaledvalue path at L211-213. The guard ensures negative zero is not
// rendered with a minus sign when there are placeholders, but must leave the
// sign untouched when neither integer nor fraction placeholders exist.
// Kills: 267, 271, 272, 273.
// ---------------------------------------------------------------------------
describe("negative scaled-to-zero handling", () => {
    test("-0.001 with '0.00' drops the sign (no '-0.00')", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-0.001, "n", "0.00")).toBe("0.00");
    });

    test("-0.4 with '0' drops the sign (no '-0')", async () => {
        // This also distinguishes the LogicalOperator `||` vs `&&` mutation at
        // L211 because integerdigits(=1) is truthy but fractiondigits(=0)
        // is falsy.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-0.4, "n", "0")).toBe("0");
    });

    test("-0.0001 with '.' (no placeholders) keeps the sign", async () => {
        // Neither fractiondigits nor integerdigits are set, so the L211 guard
        // must leave negativevalue alone and the decimal operator prepends '-'.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-0.0001, "n", ".")).toBe("-.");
    });
});

// ---------------------------------------------------------------------------
// integervalue normalisation at L222. When the regex extracts "0", the code
// resets it to "" so later integer-placeholder logic knows the field is empty.
// Dropping or flipping that reset causes an extra leading '0' to appear.
// Kills: 294, 295, 297.
// ---------------------------------------------------------------------------
describe("integervalue reset when regex yields '0'", () => {
    test("0.49 with '#' renders empty (no forced '0')", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.49, "n", "#")).toBe("");
    });
});

// ---------------------------------------------------------------------------
// Date/time boundaries.
// Kill: 310 (rawvalue < 0 vs <= 0 for bad-date detection).
// ---------------------------------------------------------------------------
describe("date boundary: serial 0 is the 1899-12-30 epoch date", () => {
    test("serial 0 renders as 1899-12-30 under a date format", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0, "nd", "yyyy-mm-dd")).toBe("1899-12-30");
    });
});

// ---------------------------------------------------------------------------
// esecs arithmetic at L244-245.  `[ss].0` forces decimalscale > 1 so that
// the multiplication and division are distinguishable from their swaps.
// Kills: 335, 336.
// ---------------------------------------------------------------------------
describe("elapsed seconds scaling uses multiply-then-divide", () => {
    test("[ss].0 preserves the half-second fraction for 1.5 + 0.5/86400", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const val = 1.5 + 0.5 / 86400;
        expect(SC.format_number_for_display(val, "nt", "[ss].0")).toBe("129600.5");
    });
});

// ---------------------------------------------------------------------------
// Second-to-minute / minute-to-hour rollover increments at L248, L251.
// Kills: 343 (emins++), 350 (ehrs++), 344 (inner mins>=60 guard).
// ---------------------------------------------------------------------------
describe("rollover of rounded seconds bumps the elapsed counters", () => {
    test("minute rollover at 10:59:59.6 gives [mm]:ss = elapsed minutes", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const rollVal = 45291 + (10 * 3600 + 59 * 60 + 59.6) / 86400;
        expect(SC.format_number_for_display(rollVal, "nt", "[mm]:ss")).toBe("65219700:00");
    });

    test("hour rollover at 23:59:59.6 gives [h]:mm:ss = elapsed hours", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const hrRoll = 45291 + (23 * 3600 + 59 * 60 + 59.6) / 86400;
        expect(SC.format_number_for_display(hrRoll, "nt", "[h]:mm:ss")).toBe("1087008:00:00");
    });

    test("partial-minute rollover: 10:30:59.6 becomes 10:31:00 without hour bump", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const v = 45291 + (10 * 3600 + 30 * 60 + 59.6) / 86400;
        expect(SC.format_number_for_display(v, "ndt", "yyyy-mm-dd hh:mm:ss")).toBe(
            "2023-12-31 10:31:00",
        );
    });
});

// ---------------------------------------------------------------------------
// fractionvalue construction at L258 uses secs - Math.floor(secs).
// Kills: 357.
// ---------------------------------------------------------------------------
describe("fractionvalue comes from the fractional part of secs", () => {
    test("5.5 seconds with 'ss.0' format renders '05.5'", async () => {
        // Under the `secs + Math.floor(secs)` mutation the fractionvalue
        // becomes "10.5".substring(2) == ".5", which renders wrong characters.
        const SC = await loadSocialCalc({ browser: true });
        const v = 1.5 + 5.5 / 86400;
        expect(SC.format_number_for_display(v, "nt", "ss.0")).toBe("05.5");
    });
});

// ---------------------------------------------------------------------------
// AM/PM rendering at L272-280. The code picks between "PM"/"P" or "AM"/"A"
// based on hrs >= 12 and operandstr.toLowerCase() == "a/p".
// Kills: 389, 400, 401, 402, 403, 404, 408.
// ---------------------------------------------------------------------------
describe("AM/PM branches for A/P vs AM/PM formats", () => {
    test("hrs<12 with 'h AM/PM' renders 'AM' (not 'A' or 'am')", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.1, "nt", "h AM/PM")).toBe("2 AM");
    });

    test("hrs<12 with 'h A/P' renders 'A'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.1, "nt", "h A/P")).toBe("2 A");
    });

    test("hrs>=12 with 'h AM/PM' renders 'PM'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.9, "nt", "h AM/PM")).toBe("9 PM");
    });

    test("hrs>=12 with 'h A/P' renders 'P'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.9, "nt", "h A/P")).toBe("9 P");
    });
});

// ---------------------------------------------------------------------------
// minute/month disambiguation via charAt(0)=="h" at L285 and the forward/
// backward scans at L282-315.
// Kills: 427 (MethodExpression), 430 (BlockStatement), 454 (m before ss),
//        469, 471 (non-date non-copy reset of minOK in backward scan).
// ---------------------------------------------------------------------------
describe("m-vs-month scanning disambiguates minutes based on neighbouring tokens", () => {
    test("'hh:m' treats m as minutes (charAt(0)=='h' matched)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // Ensure fresh parse so the operand-mutation side effects start clean.
        delete SC.FormatNumber.format_definitions["hh:m"];
        expect(SC.format_number_for_display(45291.5, "nt", "hh:m")).toBe("12:0");
    });

    test("'hym' resets minOK at a non-'h' date token so trailing m is month", async () => {
        const SC = await loadSocialCalc({ browser: true });
        delete SC.FormatNumber.format_definitions["hym"];
        // h -> minOK=1; y (non-'h' date) -> minOK=0; m -> treated as month.
        expect(SC.format_number_for_display(45291.5, "nt", "hym")).toBe("122312");
    });

    test("'m:ss' converts m to minutes via the backward-scan ss rule", async () => {
        const SC = await loadSocialCalc({ browser: true });
        delete SC.FormatNumber.format_definitions["m:ss"];
        expect(SC.format_number_for_display(45291.5, "nt", "m:ss")).toBe("0:00");
    });

    test("'m 0 ss' keeps m as month because a non-copy op resets minOK", async () => {
        const SC = await loadSocialCalc({ browser: true });
        delete SC.FormatNumber.format_definitions["m 0 ss"];
        // The "0" between m and ss is an integer_placeholder (not copy), so the
        // backward scan must set minOK=0 before it reaches the leading m.
        expect(SC.format_number_for_display(45291.5, "nt", "m 0 ss")).toBe("12 45292 00");
    });
});

// ---------------------------------------------------------------------------
// separatorchar / decimalchar replacement guards at L325, L327. The default
// constants contain no spaces, so we temporarily swap them to exercise the
// replace branch and then to check that the indexOf >= 0 boundary matters.
// Kills: 475, 476, 477 (separator), 481, 482, 483 (decimal).
// ---------------------------------------------------------------------------
describe("separator / decimal replace spaces with &nbsp;", () => {
    test("space-containing separator is rewritten to &nbsp;", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const orig = SC.Constants.FormatNumber_separatorchar;
        SC.Constants.FormatNumber_separatorchar = " ";
        try {
            expect(SC.format_number_for_display(1234, "n", "#,##0")).toBe("1&nbsp;234");
        } finally {
            SC.Constants.FormatNumber_separatorchar = orig;
        }
    });

    test("separator starting with a space is rewritten (indexOf==0 boundary)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const orig = SC.Constants.FormatNumber_separatorchar;
        SC.Constants.FormatNumber_separatorchar = " ,";
        try {
            expect(SC.format_number_for_display(1234, "n", "#,##0")).toBe("1&nbsp;,234");
        } finally {
            SC.Constants.FormatNumber_separatorchar = orig;
        }
    });

    test("space-containing decimal is rewritten to &nbsp;", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const orig = SC.Constants.FormatNumber_decimalchar;
        SC.Constants.FormatNumber_decimalchar = " ";
        try {
            expect(SC.format_number_for_display(1.25, "n", "0.00")).toBe("1&nbsp;25");
        } finally {
            SC.Constants.FormatNumber_decimalchar = orig;
        }
    });

    test("decimal starting with a space is rewritten (indexOf==0 boundary)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const orig = SC.Constants.FormatNumber_decimalchar;
        SC.Constants.FormatNumber_decimalchar = " .";
        try {
            expect(SC.format_number_for_display(1.25, "n", "0.00")).toBe("1&nbsp;.25");
        } finally {
            SC.Constants.FormatNumber_decimalchar = orig;
        }
    });
});

// ---------------------------------------------------------------------------
// Wider-than-field integer padding at L347-386. Format "0,000,000" with value
// 12 exercises the padding branch's thousands-separator logic at L370-373.
// Kills: 575 (subtract vs add), 579 (condition true), 590 (thousands check),
//        601 (fromend % 3 == 0 check in else-branch).
// ---------------------------------------------------------------------------
describe("thousands-separator placement when padding narrow values", () => {
    test("'0,000,000' pads 12 as '0,000,012'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12, "n", "0,000,000")).toBe("0,000,012");
    });

    test("'0' format with value 1234 emits no thousands separator", async () => {
        // Covers ID 590 at the small-width boundary (fromend never exceeds 2).
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234, "n", "0")).toBe("1234");
    });

    test("'0000' format with value 12345 still has no thousands separator", async () => {
        // Kills ID 590: with integerdigits=4 the else-branch iteration at
        // integerpos=1 sees fromend=3 and 3%3==0, so a mutation that forces
        // the `if (thousandssep)` branch to run inserts a comma despite the
        // format containing no ','.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12345, "n", "0000")).toBe("12345");
    });

    test("'#,##00' with 1234567 still groups at the right 3-digit boundary", async () => {
        // Kills ID 601: the normal-digit branch must only emit a separator
        // when fromend % 3 == 0 (not always).
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1234567, "n", "#,##00")).toBe("1,234,567");
    });

    test("wider-than-field integer '0' handles large value as expected", async () => {
        // Kills ID 547: under the `if (length < digits && ...) -> true` mutant,
        // the else-branch that appends the final digit is skipped; instead a
        // hard-coded "0" is appended, truncating the least-significant digit.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(12345, "n", "#")).toBe("12345");
        expect(SC.format_number_for_display(98765, "n", "##")).toBe("98765");
    });

    test("single-digit placeholder renders multi-digit value intact", async () => {
        // Kills ID 511 / 515 / 517 by exercising the first-iteration pre-loop
        // with values that span the length > digits boundary at multiple
        // positions. Under several mutants the last digit gets replaced with
        // either a hard-coded '0' or a '&nbsp;'.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(42, "n", "0")).toBe("42");
        expect(SC.format_number_for_display(7, "n", "0")).toBe("7");
        expect(SC.format_number_for_display(1000, "n", "#")).toBe("1000");
    });
});

// ---------------------------------------------------------------------------
// fractionvalue padding at L388-398.
// Kills: 616 (if -> true), 622 (condition -> false), 623 (`==` vs `!=`),
//        627 (ternary condition -> true).
// ---------------------------------------------------------------------------
describe("fraction placeholder padding", () => {
    test("'0.00' with 1.5 renders '1.50'", async () => {
        // Under the `fractionpos >= length` -> true mutation, iteration 1
        // would pad with '0' instead of charAt(0).
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1.5, "n", "0.00")).toBe("1.50");
    });

    test("'0.00' with 1 pads to '1.00'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "n", "0.00")).toBe("1.00");
    });

    test("'0.?' with 1 emits '&nbsp;' for the missing fraction position", async () => {
        // The `?` placeholder produces nbsp under the ternary at L391.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "n", "0.?")).toBe("1.&nbsp;");
    });

    test("'#' in fraction position with missing digit emits nothing", async () => {
        // Kills ID 616 (outer condition -> true): under the mutation the
        // `operandstr == "0" || operandstr == "?"` guard is bypassed, so the
        // ternary emits "&nbsp;" even for '#'.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "n", "0.#")).toBe("1.");
    });
});

// ---------------------------------------------------------------------------
// General-path significant-digit correction at L420-424. Value 0.1 + 0.2 tests
// the normal correction; very small magnitudes test the isFinite guard and
// the LOG10E * log(value) sign.
// Kills: 660, 662, 663, 670.
// ---------------------------------------------------------------------------
describe("General format corrects floating-point artifacts", () => {
    test("0.1 + 0.2 renders as '0.3' under General", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(0.1 + 0.2, "n", "General")).toBe("0.3");
    });

    test("value === 1 renders as '1' under General (LOG10E / log would divide by 0)", async () => {
        // Kills ID 663: replacing `Math.LOG10E * Math.log(value)` with `/`
        // causes a division by 0 at value=1 and yields NaN.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "n", "General")).toBe("1");
    });

    test("extremely small value yields 'NaN' after the isFinite check", async () => {
        // Kills ID 670: the post-correction isFinite guard catches
        // Math.floor(Infinity * value + 0.5) / Infinity == NaN for values
        // smaller than about 1e-300.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1e-300, "n", "General")).toBe("NaN");
    });
});

// ---------------------------------------------------------------------------
// [mm] and [ss] elapsed formatting at L511-519 and L541-550.
// Kills: 868, 928, 935.
// ---------------------------------------------------------------------------
describe("[mm] / [ss] padding only applies below the 100-unit boundary", () => {
    test("[mm]:ss at exactly emins==100 renders as '100:00' (no zero-pad)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(100 / 1440, "nt", "[mm]:ss")).toBe("100:00");
    });

    test("[ss] at exactly esecs==100 renders as '100' (no zero-pad)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(100 / 86400, "nt", "[ss]")).toBe("100");
    });
});

// ---------------------------------------------------------------------------
// Color / style span wrapping at L565-570.
// Kills: 949, 952, 953.
// ---------------------------------------------------------------------------
describe("color and style brackets wrap output only when set", () => {
    test("plain format does not wrap in any span", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", "0")).toBe("5");
    });

    test("[red] wraps the formatted output in a color span", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", "[red]0")).toBe(
            '<span style="color:#FF0000;">5</span>',
        );
    });

    test("[style=...] wraps the formatted output in a style span", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(5, "n", "[style=font-weight:bold]0")).toBe(
            '<span style="font-weight:bold;">5</span>',
        );
    });
});

// ---------------------------------------------------------------------------
// formatTextWithFormat section dispatch at L600-609.
// Kills: 982 (3-section path), 985 (2-section passthrough).
// ---------------------------------------------------------------------------
describe("formatTextWithFormat honours 4-section text slot and passthrough for others", () => {
    test("4-section text format renders with section-3 prefix/suffix", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatTextWithFormat("hi", '0;0;0;"pre "@" suf"')).toBe(
            "pre&nbsp;hi&nbsp;suf",
        );
    });

    test("2-section text format returns the value unchanged", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.formatTextWithFormat("hi", '0;"pre "@" suf"')).toBe("hi");
    });
});

// ---------------------------------------------------------------------------
// parse_format_string loop bound at L699.
// Kills: 1030.
// ---------------------------------------------------------------------------
describe("parse_format_string loop stops exactly at format_string.length", () => {
    test("parsing '0' yields a single integer placeholder operator", async () => {
        const SC = await loadSocialCalc({ browser: true });
        const defs: Record<string, unknown> = {};
        SC.FormatNumber.parse_format_string(defs, "0");
        const parsed = defs["0"] as { operators: number[]; operands: string[] };
        expect(parsed.operators.length).toBe(1);
        expect(parsed.operands.length).toBe(1);
        expect(parsed.operands[0]).toBe("0");
    });
});

// ---------------------------------------------------------------------------
// "general" matcher at L750-760.
// Kills: 1085.
// ---------------------------------------------------------------------------
describe("partial 'general' prefix falls back to per-character copy", () => {
    test("'gx' (g-prefix that doesn't complete 'general') yields 'x'", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(1, "n", "gx")).toBe("x");
    });
});

// ---------------------------------------------------------------------------
// '$' bracket currency absorption: the `$` branch at L809.
// Kills: 1166.
// ---------------------------------------------------------------------------
describe("'$' token is parsed as currency command, not as literal copy", () => {
    test("format '$0' with negative value puts the sign before the '$'", async () => {
        // Currency command injects the '-' prefix before emitting the currency
        // symbol; a copy command would let the integer_placeholder emit '-'
        // after the '$'.
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-5, "n", "$0")).toBe("-$5");
    });
});

// ---------------------------------------------------------------------------
// '[?$]' literal currency bracket at L924.
// Kills: 1272.
// ---------------------------------------------------------------------------
describe("'[?$]' bracket registers as currency operator", () => {
    test("negative value with '[?$]0' places '-' before the literal bracket", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.format_number_for_display(-12, "n", "[?$]0")).toBe("-[?$]12");
    });
});

// ---------------------------------------------------------------------------
// convert_date_gregorian_to_julian arithmetic at L981.
// Kills: 1334, 1337.
// ---------------------------------------------------------------------------
describe("convert_date_gregorian_to_julian uses year+4900 and month-14", () => {
    test("matches a pre-1900 and a boundary year where sign/term matter", async () => {
        const SC = await loadSocialCalc({ browser: true });
        // 1900-01-01 differs under `year - 4900` AND under `month + 14`.
        expect(SC.FormatNumber.convert_date_gregorian_to_julian(1900, 1, 1)).toBe(2415021);
        // 2100-01-01 differs under `month + 14` due to the /100 rounding.
        expect(SC.FormatNumber.convert_date_gregorian_to_julian(2100, 1, 1)).toBe(2488070);
    });
});

// ---------------------------------------------------------------------------
// convert_date_julian_to_gregorian arithmetic at L1010.
// Kills: 1348.
// ---------------------------------------------------------------------------
describe("convert_date_julian_to_gregorian uses L+1 (not L-1)", () => {
    test("julian 2400105 corresponds to 1859-03-01 (a day after 1859-02-28)", async () => {
        const SC = await loadSocialCalc({ browser: true });
        expect(SC.FormatNumber.convert_date_julian_to_gregorian(2400105)).toEqual({
            year: 1859,
            month: 3,
            day: 1,
        });
    });
});
