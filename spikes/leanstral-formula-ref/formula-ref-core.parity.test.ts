import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadSocialCalc, scheduleCommands } from "../../test/helpers/socialcalc.ts";
import { loadFormulaRefFallback } from "./rust-backend/fallback-loader.mjs";
import { loadFormulaRefWasm } from "./rust-backend/wasm-loader.mjs";

const spikeDir = import.meta.dir;
const wasmPath = join(spikeDir, "dist", "formula_ref_core.wasm");
const fallbackPath = join(spikeDir, "dist", "formula_ref_core.fallback.mjs");
const artifactsPresent =
    existsSync(wasmPath) && existsSync(fallbackPath);

const fixturesPath = new URL(
    "./fixtures/formula-rewrite-cases.json",
    import.meta.url,
);

function callRewrite(
    backend: {
        offsetFormulaCoords: (
            formula: string,
            coloffset: number,
            rowoffset: number,
        ) => string;
        adjustFormulaCoords: (
            formula: string,
            col: number,
            coloffset: number,
            row: number,
            rowoffset: number,
        ) => string;
        replaceFormulaCoords: (
            formula: string,
            movedto: Record<string, string>,
        ) => string;
    },
    method: string,
    formula: string,
    args: Record<string, unknown>,
) {
    switch (method) {
        case "offset":
            return backend.offsetFormulaCoords(
                formula,
                args.coloffset as number,
                args.rowoffset as number,
            );
        case "adjust":
            return backend.adjustFormulaCoords(
                formula,
                args.col as number,
                args.coloffset as number,
                args.row as number,
                args.rowoffset as number,
            );
        case "replace":
            return backend.replaceFormulaCoords(
                formula,
                args.movedto as Record<string, string>,
            );
        default:
            throw new Error(`unknown fixture method: ${method}`);
    }
}

describe.skipIf(!artifactsPresent)("formula-ref Rust/WASM spike parity", () => {
    test("directCases: legacy, wasm, and fallback agree", async () => {
        const fixtures = (await Bun.file(fixturesPath).json()) as {
            directCases: Array<{
                name: string;
                method: string;
                formula: string;
                args: Record<string, unknown>;
                expected: string;
            }>;
        };

        const SC = await loadSocialCalc();
        const legacyBackend = {
            offsetFormulaCoords: SC.OffsetFormulaCoords,
            adjustFormulaCoords: SC.AdjustFormulaCoords,
            replaceFormulaCoords: SC.ReplaceFormulaCoords,
        };
        const wasmBackend = await loadFormulaRefWasm(
            new URL("./dist/formula_ref_core.wasm", import.meta.url),
        );
        const fallbackBackend = await loadFormulaRefFallback(
            new URL("./dist/formula_ref_core.fallback.mjs", import.meta.url),
        );

        for (const c of fixtures.directCases) {
            const legacy = callRewrite(
                legacyBackend,
                c.method,
                c.formula,
                c.args,
            );
            const wasm = callRewrite(wasmBackend, c.method, c.formula, c.args);
            const fallback = callRewrite(
                fallbackBackend,
                c.method,
                c.formula,
                c.args,
            );
            expect(legacy).toBe(c.expected);
            expect(wasm).toBe(c.expected);
            expect(fallback).toBe(c.expected);
        }
    });

    test("commandCases: SocialCalc command execution matches fixtures", async () => {
        const fixtures = (await Bun.file(fixturesPath).json()) as {
            commandCases: Array<{
                name: string;
                setup: string[];
                commands: string[];
                expectedCells: Array<{
                    coord: string;
                    field: string;
                    expected: string;
                }>;
            }>;
        };

        const SC = await loadSocialCalc();

        for (const c of fixtures.commandCases) {
            const sheet = new SC.Sheet();
            if (c.setup.length) {
                await scheduleCommands(SC, sheet, c.setup);
            }
            await scheduleCommands(SC, sheet, c.commands);
            for (const cell of c.expectedCells) {
                const assured = sheet.GetAssuredCell(cell.coord);
                expect(assured[cell.field]).toBe(cell.expected);
            }
        }
    });
});