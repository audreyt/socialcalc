// Smoke test: ensure the concatenated bundle loads under strict mode, exposes
// the SocialCalc global shape, and can parse + recalc a trivial sheet.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const bundlePath = join(import.meta.dir, "dist", "SocialCalc.js");
const src = readFileSync(bundlePath, "utf8");

// Evaluate the CJS bundle into a local module object. The leading "use strict"
// matches what a modern bundler would do and proves we are strict-mode clean.
const fn = new Function("module", "exports", '"use strict";\n' + src);
const mod: { exports: any } = { exports: {} };
fn(mod, mod.exports);
const SC = mod.exports;

test("bundle exposes the SocialCalc namespace", () => {
    expect(typeof SC.Sheet).toBe("function");
    expect(typeof SC.Formula).toBe("object");
    expect(typeof SC.ParseSheetSave).toBe("function");
    expect(typeof SC.RecalcSheet).toBe("function");
});

test("parses and recalculates a trivial sheet under strict mode", async () => {
    const s = new SC.Sheet();
    SC.ParseSheetSave(
        "version:1.5\ncell:A1:v:42\ncell:A2:v:8\ncell:B1:vtf:n:0:A1+A2\n",
        s,
    );
    // Recalc runs on window.setTimeout slices. Await the "calcfinished" status.
    await new Promise<void>((resolve, reject) => {
        s.statuscallback = (_info: unknown, status: string) => {
            if (status === "calcfinished") resolve();
        };
        setTimeout(() => reject(new Error("recalc timed out")), 1000);
        SC.RecalcSheet(s);
    });
    expect(s.GetAssuredCell("A1").datavalue).toBe(42);
    expect(s.GetAssuredCell("A2").datavalue).toBe(8);
    expect(s.GetAssuredCell("B1").datavalue).toBe(50);
});

test("exercises a broader set of formula features under strict mode", async () => {
    const s = new SC.Sheet();
    SC.ParseSheetSave(
        [
            "version:1.5",
            "cell:A1:v:1",
            "cell:A2:v:2",
            "cell:A3:v:3",
            "cell:A4:v:4",
            // ":" inside a formula has to be escaped as "\c" per SocialCalc's
            // save-file format (see SocialCalc.encodeForSave in socialcalc-3.js).
            "cell:B1:vtf:n:0:SUM(A1\\cA4)",
            "cell:B2:vtf:n:0:AVERAGE(A1\\cA4)",
            "cell:B3:vtf:n:0:IF(A1>0,A2*A3,0)",
            "cell:B4:vtf:n:0:ROUND(B2*1.234,2)",
            'cell:C1:vtf:t:0:CONCATENATE("n=",A1)',
            "cell:C2:vtf:n:0:LEN(C1)",
            "",
        ].join("\n"),
        s,
    );
    await new Promise<void>((resolve, reject) => {
        s.statuscallback = (_info: unknown, status: string) => {
            if (status === "calcfinished") resolve();
        };
        setTimeout(() => reject(new Error("recalc timed out")), 2000);
        SC.RecalcSheet(s);
    });
    expect(s.GetAssuredCell("B1").datavalue).toBe(10);
    expect(s.GetAssuredCell("B2").datavalue).toBe(2.5);
    expect(s.GetAssuredCell("B3").datavalue).toBe(6);
    expect(s.GetAssuredCell("B4").datavalue).toBe(3.09);
    expect(s.GetAssuredCell("C1").datavalue).toBe("n=1");
    expect(s.GetAssuredCell("C2").datavalue).toBe(3);
});

test("no accidental globals leak under strict mode", () => {
    // Any implicit-global assignment during load would have landed on globalThis.
    for (const forbidden of [
        "value",
        "tostype",
        "operand",
        "sheet",
        "scf",
        "fname",
        "result",
    ]) {
        expect((globalThis as any)[forbidden]).toBeUndefined();
    }
});
