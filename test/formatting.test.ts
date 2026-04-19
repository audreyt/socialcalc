import { expect, test } from "bun:test";

import { loadSocialCalc } from "./helpers/socialcalc";

test("formats numbers, logical values, and dates for display", async () => {
    const SC = await loadSocialCalc();

    const cases: Array<[number, string, string, string]> = [
        [1234.567, "n", "#,##0.00", "1,234.57"],
        [0.125, "n", "0.0%", "12.5%"],
        [-42, "n", "$#,##0.00;[red]-$#,##0.00", '<span style="color:#FF0000;">-$42.00</span>'],
        [0.5, "nl", "logical", "TRUE"],
        [45291, "nd", "yyyy-mm-dd", "2023-12-31"],
        [1.5, "nt", "h:mm:ss", "12:00:00"],
    ];

    for (const [value, type, format, expected] of cases) {
        expect(SC.format_number_for_display(value, type, format)).toBe(expected);
    }

    expect(SC.intFunc(3.9)).toBe(3);
    expect(SC.intFunc(-3.1)).toBe(-3);
    expect(SC.intFunc(-3.9)).toBe(-3);
});

test("escapes and parses text-oriented display helpers", async () => {
    const SC = await loadSocialCalc();

    expect(SC.format_text_for_display("line1\nline2", "t", "text-plain", null, "")).toBe(
        "line1<br>line2",
    );
    expect(
        SC.format_text_for_display("https://example.com", "t", "", null, ""),
    ).toBe("https://example.com");

    expect(SC.ParseCellLinkText("desc<http://example.com> and [page]")).toEqual({
        url: "",
        desc: "desc<http://example.com> and",
        newwin: false,
        pagename: "page",
        workspace: "",
    });
});
