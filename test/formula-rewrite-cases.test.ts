import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

type DirectMethod = "offset" | "adjust" | "replace";

type DirectCase = {
    name: string;
    method: DirectMethod;
    formula: string;
    args: {
        coloffset?: number;
        rowoffset?: number;
        col?: number;
        row?: number;
        movedto?: Record<string, string>;
    };
    expected: string;
    invariant: string;
};

type CommandExpectedCell = {
    coord: string;
    field: string;
    expected: string;
};

type CommandCase = {
    name: string;
    setup: string[];
    commands: string[];
    expectedCells: CommandExpectedCell[];
};

type FormulaRewriteFixtures = {
    directCases: DirectCase[];
    commandCases: CommandCase[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDirectMethod(value: unknown): value is DirectMethod {
    return value === "offset" || value === "adjust" || value === "replace";
}

function parseDirectCase(value: unknown, index: number): DirectCase {
    if (!isRecord(value)) {
        throw new Error(`directCases[${index}] must be an object`);
    }
    const {
        name,
        method,
        formula,
        args,
        expected,
        invariant,
    } = value;
    if (typeof name !== "string") {
        throw new Error(`directCases[${index}].name must be a string`);
    }
    if (!isDirectMethod(method)) {
        throw new Error(`directCases[${index}].method must be offset|adjust|replace`);
    }
    if (typeof formula !== "string") {
        throw new Error(`directCases[${index}].formula must be a string`);
    }
    if (!isRecord(args)) {
        throw new Error(`directCases[${index}].args must be an object`);
    }
    if (typeof expected !== "string") {
        throw new Error(`directCases[${index}].expected must be a string`);
    }
    if (typeof invariant !== "string") {
        throw new Error(`directCases[${index}].invariant must be a string`);
    }

    const parsedArgs: DirectCase["args"] = {};
    if ("coloffset" in args) {
        if (typeof args.coloffset !== "number") {
            throw new Error(`directCases[${index}].args.coloffset must be a number`);
        }
        parsedArgs.coloffset = args.coloffset;
    }
    if ("rowoffset" in args) {
        if (typeof args.rowoffset !== "number") {
            throw new Error(`directCases[${index}].args.rowoffset must be a number`);
        }
        parsedArgs.rowoffset = args.rowoffset;
    }
    if ("col" in args) {
        if (typeof args.col !== "number") {
            throw new Error(`directCases[${index}].args.col must be a number`);
        }
        parsedArgs.col = args.col;
    }
    if ("row" in args) {
        if (typeof args.row !== "number") {
            throw new Error(`directCases[${index}].args.row must be a number`);
        }
        parsedArgs.row = args.row;
    }
    if ("movedto" in args) {
        if (!isRecord(args.movedto)) {
            throw new Error(`directCases[${index}].args.movedto must be an object`);
        }
        const movedto: Record<string, string> = {};
        for (const [key, entry] of Object.entries(args.movedto)) {
            if (typeof entry !== "string") {
                throw new Error(
                    `directCases[${index}].args.movedto.${key} must be a string`,
                );
            }
            movedto[key] = entry;
        }
        parsedArgs.movedto = movedto;
    }

    return {
        name,
        method,
        formula,
        args: parsedArgs,
        expected,
        invariant,
    };
}

function parseCommandCase(value: unknown, index: number): CommandCase {
    if (!isRecord(value)) {
        throw new Error(`commandCases[${index}] must be an object`);
    }
    const { name, setup, commands, expectedCells } = value;
    if (typeof name !== "string") {
        throw new Error(`commandCases[${index}].name must be a string`);
    }
    if (!Array.isArray(setup) || !setup.every((line) => typeof line === "string")) {
        throw new Error(`commandCases[${index}].setup must be string[]`);
    }
    if (
        !Array.isArray(commands) ||
        !commands.every((line) => typeof line === "string")
    ) {
        throw new Error(`commandCases[${index}].commands must be string[]`);
    }
    if (!Array.isArray(expectedCells)) {
        throw new Error(`commandCases[${index}].expectedCells must be an array`);
    }

    const cells: CommandExpectedCell[] = expectedCells.map((cell, cellIndex) => {
        if (!isRecord(cell)) {
            throw new Error(
                `commandCases[${index}].expectedCells[${cellIndex}] must be an object`,
            );
        }
        const { coord, field, expected } = cell;
        if (typeof coord !== "string") {
            throw new Error(
                `commandCases[${index}].expectedCells[${cellIndex}].coord must be a string`,
            );
        }
        if (typeof field !== "string") {
            throw new Error(
                `commandCases[${index}].expectedCells[${cellIndex}].field must be a string`,
            );
        }
        if (typeof expected !== "string") {
            throw new Error(
                `commandCases[${index}].expectedCells[${cellIndex}].expected must be a string`,
            );
        }
        return { coord, field, expected };
    });

    return {
        name,
        setup,
        commands,
        expectedCells: cells,
    };
}

function loadFixtures(): FormulaRewriteFixtures {
    const path = join(import.meta.dir, "fixtures", "formula-rewrite-cases.json");
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(raw)) {
        throw new Error("formula-rewrite-cases.json root must be an object");
    }
    if (!Array.isArray(raw.directCases) || !Array.isArray(raw.commandCases)) {
        throw new Error("fixtures must include directCases and commandCases arrays");
    }
    return {
        directCases: raw.directCases.map(parseDirectCase),
        commandCases: raw.commandCases.map(parseCommandCase),
    };
}

function callDirect(
    SC: {
        OffsetFormulaCoords: (formula: string, coloffset: number, rowoffset: number) => string;
        AdjustFormulaCoords: (
            formula: string,
            col: number,
            coloffset: number,
            row: number,
            rowoffset: number,
        ) => string;
        ReplaceFormulaCoords: (
            formula: string,
            movedto: Record<string, string>,
        ) => string;
    },
    c: DirectCase,
): string {
    switch (c.method) {
        case "offset":
            return SC.OffsetFormulaCoords(
                c.formula,
                c.args.coloffset ?? 0,
                c.args.rowoffset ?? 0,
            );
        case "adjust":
            return SC.AdjustFormulaCoords(
                c.formula,
                c.args.col ?? 1,
                c.args.coloffset ?? 0,
                c.args.row ?? 1,
                c.args.rowoffset ?? 0,
            );
        case "replace":
            return SC.ReplaceFormulaCoords(c.formula, c.args.movedto ?? {});
    }
}

const fixtures = loadFixtures();

describe("formula-rewrite fixture cases (ported from Leanstral/Rust spike)", () => {
    for (const c of fixtures.directCases) {
        test(`direct: ${c.name}`, async () => {
            const SC = await loadSocialCalc();
            expect(callDirect(SC, c)).toBe(c.expected);
        });
    }

    for (const c of fixtures.commandCases) {
        test(`command: ${c.name}`, async () => {
            const SC = await loadSocialCalc();
            const sheet = new SC.Sheet();
            if (c.setup.length > 0) {
                await scheduleCommands(SC, sheet, c.setup);
            }
            if (c.commands.length > 0) {
                await scheduleCommands(SC, sheet, c.commands);
            }
            for (const cell of c.expectedCells) {
                const actual = sheet.cells[cell.coord];
                expect(actual).toBeDefined();
                expect(actual[cell.field]).toBe(cell.expected);
            }
        });
    }
});
