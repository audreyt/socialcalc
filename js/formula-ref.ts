// In-place TypeScript module: pure formula-reference rewrite + A1 coord algebra.
// Shipping source (not a parallel oracle). Concatenated after formula1.js so
// SocialCalc.Formula.ParseFormulaIntoTokens exists at call time.
// Fully typechecked — no @ts-nocheck.
// Ambient API surface remains in socialcalc-3.d.ts for consumers.
//
/*
// SocialCalc Formula Reference Rewrite Helpers
//
// Part of the SocialCalc package.
// Extracted from socialcalc-3 for typechecked pure-core work and LemmaScript.
//
// (c) Copyright 2008 Socialtext, Inc.
// All Rights Reserved.
//
// The contents of this file are subject to the Artistic License 2.0; you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at http://socialcalc.org/licenses/al-20/.
//
*/

// Runtime root is created by module-wrapper-top.js. Ambient declare namespace is
// types-only; progressive assignment of these members uses a named mutable view
// so we never redeclare `var SocialCalc` (which collapses the namespace in tsc).
type CoordCache = { [coord: string]: number };
type CrParts = { row: number; col: number };
type CrPartsWithCoord = CrParts & { coord: string };
type MovedToMap = { [coord: string]: string };

type FormulaRefMutableRoot = {
    letters: string[];
    coordToCol: CoordCache;
    coordToRow: CoordCache;
    rcColname: (c: number) => string;
    crToCoord: (c: number, r: number) => string;
    coordToCr: (cr: string) => CrParts;
    ParseRange: (range: string) => { cr1: CrPartsWithCoord; cr2: CrPartsWithCoord };
    OffsetFormulaCoords: (formula: string, coloffset: number, rowoffset: number) => string;
    AdjustFormulaCoords: (
        formula: string,
        col: number,
        coloffset: number,
        row: number,
        rowoffset: number,
    ) => string;
    ReplaceFormulaCoords: (formula: string, movedto: MovedToMap) => string;
};

// One boundary cast: ambient namespace value is progressively filled by concat order.
const FormulaRefRoot = SocialCalc as unknown as FormulaRefMutableRoot;

// *************************************
// A1 coordinate algebra (pure)
// *************************************

//@ verify
//@ ensures \result.length >= 1
//@ ensures \result.length <= 2
// LemmaScript: column index 1..702 maps to A..ZZ; out-of-range clamps.
FormulaRefRoot.rcColname = function (c: number): string {
    if (c > 702) c = 702; // maximum number of columns - ZZ
    if (c < 1) c = 1;
    const collow = ((c - 1) % 26) + 65;
    const colhigh = Math.floor((c - 1) / 26);
    if (colhigh) {
        return String.fromCharCode(colhigh + 64) + String.fromCharCode(collow);
    }
    return String.fromCharCode(collow);
};

FormulaRefRoot.letters = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

//@ verify
//@ ensures \result.length >= 2
// LemmaScript: (col,row) → A1 string; col clamped to 1..702, row to >=1.
FormulaRefRoot.crToCoord = function (c: number, r: number): string {
    if (c < 1) c = 1;
    if (c > 702) c = 702; // maximum number of columns - ZZ
    if (r < 1) r = 1;
    const collow = (c - 1) % 26;
    const colhigh = Math.floor((c - 1) / 26);
    if (colhigh) {
        return FormulaRefRoot.letters[colhigh - 1]! + FormulaRefRoot.letters[collow]! + r;
    }
    return FormulaRefRoot.letters[collow]! + r;
};

FormulaRefRoot.coordToCol = {};
FormulaRefRoot.coordToRow = {};

//@ verify
//@ ensures \result.col >= 0
//@ ensures \result.row >= 0
// LemmaScript: parse A1 / $A$1 into 1-based col/row; caches results.
FormulaRefRoot.coordToCr = function (cr: string): CrParts {
    const cachedRow = FormulaRefRoot.coordToRow[cr];
    if (cachedRow) {
        return { row: cachedRow, col: FormulaRefRoot.coordToCol[cr]! };
    }
    let c = 0;
    let r = 0;
    for (let i = 0; i < cr.length; i++) {
        // faster than regexes; assumes well-formed
        const ch = cr.charCodeAt(i);
        if (ch === 36) {
            /* skip $'s */
        } else if (ch <= 57) {
            r = 10 * r + ch - 48;
        } else if (ch >= 97) {
            c = 26 * c + ch - 96;
        } else if (ch >= 65) {
            c = 26 * c + ch - 64;
        }
    }
    FormulaRefRoot.coordToCol[cr] = c;
    FormulaRefRoot.coordToRow[cr] = r;
    return { row: r, col: c };
};

//@ verify
//@ ensures \result.cr1.coord.length >= 1
//@ ensures \result.cr2.coord.length >= 1
FormulaRefRoot.ParseRange = function (
    range: string,
): { cr1: CrPartsWithCoord; cr2: CrPartsWithCoord } {
    if (!range) range = "A1:A1"; // error return, hopefully benign
    range = range.toUpperCase();
    const pos = range.indexOf(":");
    if (pos >= 0) {
        const crA = range.substring(0, pos);
        const a = FormulaRefRoot.coordToCr(crA);
        const crB = range.substring(pos + 1);
        const b = FormulaRefRoot.coordToCr(crB);
        return {
            cr1: { row: a.row, col: a.col, coord: crA },
            cr2: { row: b.row, col: b.col, coord: crB },
        };
    }
    const p0 = FormulaRefRoot.coordToCr(range);
    return {
        cr1: { row: p0.row, col: p0.col, coord: range },
        cr2: { row: p0.row, col: p0.col, coord: range },
    };
};

// *************************************
// Formula reference rewrites (pure w.r.t. sheet state)
// *************************************

//@ verify
//@ ensures \result.length >= 0
// LemmaScript invariants (ported from Leanstral/Rust spike):
// - STRING_PRESERVATION: string payloads preserved (quotes re-escaped).
// - NAME_VS_COORD: whole-column names (N:N, AA:AA) are never coords.
// - OFFSET_ZERO_IDENTITY: offset(f,0,0) == parse-reconstruct(f)
//   (TokenOpExpansion + quote re-emission; whitespace may normalize).
// - OFFSET_COMPOSITION: offset(offset(f,c1,r1),c2,r2) == offset(f,c1+c2,r1+r2)
//   when no intermediate #REF!.
// - relative coords shift by offsets; absolute $ legs stay fixed;
//   overflow col>702 or row/col <1 → #REF!; strings/ops preserved.
// Re-emit a formula string/sheet-name token so the result re-parses.
// The lexer treats ' and " as the same quote class and does not remember the
// opener, so both characters must be doubled inside the payload. Outer form:
// apostrophe-bearing payloads use single quotes (Excel-style sheet names);
// everything else keeps the historical double-quote emission.
function quoteFormulaString(text: string): string {
    const escaped = text.replace(/'/g, "''").replace(/"/g, '""');
    if (text.indexOf("'") >= 0) {
        return "'" + escaped + "'";
    }
    return '"' + escaped + '"';
}

FormulaRefRoot.OffsetFormulaCoords = function (
    formula: string,
    coloffset: number,
    rowoffset: number,
): string {
    const scf = SocialCalc.Formula;
    const tokentype = scf.TokenType;
    const token_op = tokentype.op;
    const token_string = tokentype.string;
    const token_coord = tokentype.coord;
    const tokenOpExpansion = scf.TokenOpExpansion;

    const parseinfo = scf.ParseFormulaIntoTokens(formula);
    let updatedformula = "";

    for (let i = 0; i < parseinfo.length; i++) {
        const ttype = parseinfo[i]!.type;
        const ttext = parseinfo[i]!.text;
        if (ttype === token_coord) {
            let newcr = "";
            const cr = FormulaRefRoot.coordToCr(ttext);
            if (ttext.charAt(0) !== "$") {
                // add col offset unless absolute column
                cr.col += coloffset;
            } else {
                newcr += "$";
            }
            newcr += FormulaRefRoot.rcColname(cr.col);
            if (ttext.indexOf("$", 1) === -1) {
                // add row offset unless absolute row
                cr.row += rowoffset;
            } else {
                newcr += "$";
            }
            newcr += cr.row;
            if (cr.row < 1 || cr.col < 1 || cr.col > 702) {
                newcr = "#REF!";
            }
            updatedformula += newcr;
        } else if (ttype === token_string) {
            updatedformula += quoteFormulaString(ttext);
        } else if (ttype === token_op) {
            updatedformula += tokenOpExpansion[ttext] || ttext; // short tokens (e.g. "G") → ">="
        } else {
            // leave everything else alone
            updatedformula += ttext;
        }
    }

    return updatedformula;
};

//@ verify
//@ ensures \result.length >= 0
// LemmaScript invariants (ported from Leanstral/Rust spike):
// - SHEETREF_SKIP: sheetref set by '!' and NOT reset by ':'; sheet-qualified
//   range endpoints (Sheet1!A1:B1) stay sticky through ':'.
// - structural insert/delete adjust; deleted-band refs → #REF! when not
//   sheet-qualified; absolute markers reapplied after underlying coord moves.
FormulaRefRoot.AdjustFormulaCoords = function (
    formula: string,
    col: number,
    coloffset: number,
    row: number,
    rowoffset: number,
): string {
    const scf = SocialCalc.Formula;
    const tokentype = scf.TokenType;
    const token_op = tokentype.op;
    const token_string = tokentype.string;
    const token_coord = tokentype.coord;
    const tokenOpExpansion = scf.TokenOpExpansion;

    const parseinfo = scf.ParseFormulaIntoTokens(formula);
    let updatedformula = "";
    let sheetref = false;

    for (let i = 0; i < parseinfo.length; i++) {
        let ttype = parseinfo[i]!.type;
        let ttext = parseinfo[i]!.text;
        if (ttype === token_op) {
            // references with sheet specifier are not offset
            if (ttext === "!") {
                sheetref = true; // found a sheet reference
            } else if (ttext !== ":") {
                // for everything but a range, reset
                sheetref = false;
            }
            ttext = tokenOpExpansion[ttext] || ttext;
        }
        if (ttype === token_coord) {
            const cr = FormulaRefRoot.coordToCr(ttext);
            if (
                (coloffset < 0 && cr.col >= col && cr.col < col - coloffset) ||
                (rowoffset < 0 && cr.row >= row && cr.row < row - rowoffset)
            ) {
                // refs to deleted cells become invalid
                if (!sheetref) {
                    cr.col = 0;
                    cr.row = 0;
                }
            }
            if (!sheetref) {
                if (cr.col >= col) {
                    cr.col += coloffset;
                }
                if (cr.row >= row) {
                    cr.row += rowoffset;
                }
            }
            let newcr: string;
            if (ttext.charAt(0) === "$") {
                newcr = "$" + FormulaRefRoot.rcColname(cr.col);
            } else {
                newcr = FormulaRefRoot.rcColname(cr.col);
            }
            if (ttext.indexOf("$", 1) !== -1) {
                newcr += "$" + cr.row;
            } else {
                newcr += cr.row;
            }
            if (cr.row < 1 || cr.col < 1 || cr.col > 702) {
                newcr = "#REF!";
            }
            ttext = newcr;
        } else if (ttype === token_string) {
            ttext = quoteFormulaString(ttext);
        }
        updatedformula += ttext;
    }

    return updatedformula;
};

//@ verify
//@ ensures \result.length >= 0
// LemmaScript invariants (ported from Leanstral/Rust spike):
// - REPLACE_RANGE_INDEPENDENT: range endpoints rewritten independently via
//   movedto map (SUM(A1:B2) with only A1 mapped → SUM(C3:B2)).
// - SHEETREF_SKIP: sheet-qualified refs skip remap; ':' does not reset sheetref.
// - absolute markers from the original coord are copied onto replacements.
FormulaRefRoot.ReplaceFormulaCoords = function (
    formula: string,
    movedto: MovedToMap,
): string {
    const scf = SocialCalc.Formula;
    const tokentype = scf.TokenType;
    const token_op = tokentype.op;
    const token_string = tokentype.string;
    const token_coord = tokentype.coord;
    const tokenOpExpansion = scf.TokenOpExpansion;

    const parseinfo = scf.ParseFormulaIntoTokens(formula);
    let updatedformula = "";
    let sheetref = false;

    for (let i = 0; i < parseinfo.length; i++) {
        let ttype = parseinfo[i]!.type;
        let ttext = parseinfo[i]!.text;
        if (ttype === token_op) {
            // references with sheet specifier are not changed
            if (ttext === "!") {
                sheetref = true;
            } else if (ttext !== ":") {
                sheetref = false;
            }

            //!!!! HANDLE RANGE EXTENT MOVES

            ttext = tokenOpExpansion[ttext] || ttext;
        }
        if (ttype === token_coord) {
            const cr0 = FormulaRefRoot.coordToCr(ttext); // get parts
            const coord = FormulaRefRoot.crToCoord(cr0.col, cr0.row); // clean reference
            const moved = movedto[coord];
            if (moved && !sheetref) {
                // this is a reference to a moved cell
                const cr = FormulaRefRoot.coordToCr(moved); // get new row and col
                let newcr: string;
                if (ttext.charAt(0) === "$") {
                    newcr = "$" + FormulaRefRoot.rcColname(cr.col);
                } else {
                    newcr = FormulaRefRoot.rcColname(cr.col);
                }
                if (ttext.indexOf("$", 1) !== -1) {
                    newcr += "$" + cr.row;
                } else {
                    newcr += cr.row;
                }
                ttext = newcr;
            }
        } else if (ttype === token_string) {
            ttext = quoteFormulaString(ttext);
        }
        updatedformula += ttext;
    }

    return updatedformula;
};
