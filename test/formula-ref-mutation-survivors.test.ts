// Focused behavioral tests targeting Stryker mutation survivors in js/formula-ref.ts.
// Each test's `id=NNNN` comment cross-references the survivor list; see the disposition
// summary returned alongside this file for equivalence justifications on mutants that
// have no corresponding test here (rcColname/crToCoord clamp fixed-points, the
// charCodeAt-out-of-bounds loop no-op, and the AdjustFormulaCoords deleted-band
// range-emptiness argument).
import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

describe("coordToCr caching (id=1045, id=1046)", () => {
  test("a cached row/col pair short-circuits recomputation instead of re-parsing", async () => {
    const SC = await loadSocialCalc();
    // Prime the cache with a coordinate no other test in this file touches, then poison
    // it with values the real parser could never produce. If the cache-hit branch is
    // taken (as shipping code does), coordToCr must return the poisoned values verbatim
    // instead of recomputing "QW9" from scratch.
    expect(SC.coordToCr("QW9")).toEqual({ row: 9, col: 465 });
    SC.coordToRow["QW9"] = 12345;
    SC.coordToCol["QW9"] = 54321;
    expect(SC.coordToCr("QW9")).toEqual({ row: 12345, col: 54321 });
  });
});

describe("coordToCr character-class boundaries (id=1065, id=1066, id=1068, id=1069, id=1070, id=1071)", () => {
  test("a lowercase column letter contributes via the (ch-96) branch, not the uppercase (ch-64) branch", async () => {
    const SC = await loadSocialCalc();
    // 'a' is charCode 97: it must be consumed by the `ch >= 97` branch using `ch - 96`.
    // Any mutation that skips/empties that branch, or perturbs its arithmetic, routes
    // 'a' through the uppercase branch (ch - 64 = 33) or produces a wildly different
    // value (division, sign flip, wrong constant) instead of col 1.
    expect(SC.coordToCr("a1")).toEqual({ row: 1, col: 1 });
  });

  test("multi-character lowercase column letters accumulate the same way as uppercase", async () => {
    const SC = await loadSocialCalc();
    expect(SC.coordToCr("zz99")).toEqual({ row: 99, col: 702 });
  });
});

describe("coordToCr malformed input (id=1072)", () => {
  test("a character below 'A' that reaches the final else-if branch contributes nothing", async () => {
    const SC = await loadSocialCalc();
    // ':' is charCode 58: not '$', not <=57, not >=97, and not >=65 either (58<65), so
    // none of the branches match and it must be silently skipped, leaving col/row at 0.
    // Forcing the trailing `else if (ch >= 65)` to `true` would wrongly consume it via
    // `26*c + ch - 64`, producing a negative column instead of 0.
    expect(SC.coordToCr(":")).toEqual({ row: 0, col: 0 });
  });
});

describe("ParseRange colon-at-position-zero (id=1094)", () => {
  test("a range string that starts with ':' still splits into an empty first coord", async () => {
    const SC = await loadSocialCalc();
    // indexOf(":") returns 0 here, so the split must still happen (pos >= 0). Requiring
    // pos > 0 would treat ":A1" as a single (invalid) coordinate instead of splitting it.
    const parsed = SC.ParseRange(":A1");
    expect(parsed.cr1).toEqual({ row: 0, col: 0, coord: "" });
    expect(parsed.cr2).toEqual({ row: 1, col: 1, coord: "A1" });
  });
});

describe("quoteFormulaString re-emission via OffsetFormulaCoords (id=1111)", () => {
  test("a string literal whose payload starts with an apostrophe is still single-quote wrapped", async () => {
    const SC = await loadSocialCalc();
    // Token text "'foo" (apostrophe at index 0) must take the single-quote wrap branch
    // (indexOf >= 0). Requiring indexOf > 0 misses index-0 matches and falls through to
    // the double-quote branch, which for this payload reproduces the original input
    // byte-for-byte instead of re-emitting with single quotes.
    const formula = 'A1&"\'\'foo"';
    expect(SC.OffsetFormulaCoords(formula, 1, 0)).toBe("B1&'''foo'");
  });
});

describe("OffsetFormulaCoords sheetref state (id=1121, id=1164)", () => {
  test("sheetref starts false: a plain (non sheet-qualified) coord still shifts under a matching band", async () => {
    const SC = await loadSocialCalc();
    // With sheetref initialized true, `band && sheetref` would be wrongly satisfied for
    // the very first coord token even though no '!' was ever seen, freezing a shift that
    // should have happened.
    expect(SC.OffsetFormulaCoords("A1", 1, 0, { startCol: 1, endCol: 5, startRow: 1, endRow: 5 })).toBe(
      "B1",
    );
  });

  test("band + sheet-qualified coord freezes the column shift, not just the row shift", async () => {
    const SC = await loadSocialCalc();
    // Once sheetref is true and a band is active, both shiftCol and shiftRow must be
    // frozen. Flipping shiftCol's assignment to `true` lets the column shift leak
    // through for sheet-qualified refs during a banded (sort) offset.
    expect(
      SC.OffsetFormulaCoords("Sheet1!A1", 1, 0, {
        startCol: 1,
        endCol: 5,
        startRow: 1,
        endRow: 5,
      }),
    ).toBe("SHEET1!A1");
  });
});

describe("OffsetFormulaCoords column band guard (id=1172, id=1174, id=1176, id=1180, id=1184, id=1187)", () => {
  test("a coord outside a fully-specified column band is frozen while one inside it shifts", async () => {
    const SC = await loadSocialCalc();
    // A1 (col 1) sits outside [3,5] and must freeze entirely (col AND row); C1 (col 3)
    // sits inside and must shift normally. This kills: the whole range-check forced to
    // `false` (id=1180, which would let A1 shift), and shiftCol flipped to `true` inside
    // the freeze body (id=1187, which would shift A1's column but not its row).
    expect(SC.OffsetFormulaCoords("A1+C1", 1, 1, { startCol: 3, endCol: 5 })).toBe("A1+D2");
  });

  test("a coord exactly at the band's endCol boundary still shifts (upper bound is exclusive of >)", async () => {
    const SC = await loadSocialCalc();
    // col 5 == endCol: `col > endCol` is false, so the coord is NOT frozen. Widening the
    // comparison to `>=` would wrongly freeze it at the boundary.
    expect(SC.OffsetFormulaCoords("E1", 1, 0, { startCol: 1, endCol: 5 })).toBe("F1");
  });

  test("a column band missing endCol never freezes a shift, however far the column reaches", async () => {
    const SC = await loadSocialCalc();
    // Only startCol is provided; `band.endCol != null` is false so the whole guard must
    // be skipped (short-circuit) regardless of where col 1 sits relative to startCol 3.
    // Forcing either/both `!= null` checks to `true` wrongly activates the guard.
    expect(SC.OffsetFormulaCoords("A1", 1, 0, { startCol: 3 })).toBe("B1");
  });

  test("a column band missing startCol never freezes a shift, however far the column reaches", async () => {
    const SC = await loadSocialCalc();
    // Only endCol is provided; `band.startCol != null` is false so the guard is skipped
    // even though col 10 is well past endCol 5. Forcing `startCol != null` to `true`
    // wrongly activates the guard and freezes column J.
    expect(SC.OffsetFormulaCoords("J1", 1, 0, { endCol: 5 })).toBe("K1");
  });
});

describe("OffsetFormulaCoords row band guard (id=1190, id=1192, id=1193, id=1194, id=1195, id=1196, id=1197, id=1199, id=1200, id=1203, id=1206, id=1207, id=1208)", () => {
  test("a row outside a fully-specified row band freezes col+row; a row inside it shifts both", async () => {
    const SC = await loadSocialCalc();
    // C1 (row 1) sits outside [3,5] and must freeze entirely; C4 (row 4) sits inside and
    // must shift both col and row. This single case distinguishes: the whole condition
    // forced false (id=1190), either `!= null` check flipped to `== null` (id=1195,
    // id=1197), `||` flipped to `&&` in the range check (id=1199), either range clause
    // forced false in a way that still leaves the other clause live (id=1200), the guard
    // body emptied (id=1206), and shiftCol/shiftRow individually flipped to `true`
    // inside the freeze body (id=1207, id=1208).
    expect(SC.OffsetFormulaCoords("C1+C4", 1, 1, { startRow: 3, endRow: 5 })).toBe("C1+D5");
  });

  test("a row strictly above endRow is frozen via the '> endRow' clause alone", async () => {
    const SC = await loadSocialCalc();
    // row 6 only fails the `row > endRow` clause (row < startRow is false), isolating
    // id=1203 (which forces that clause to `false` and would let row 6 shift).
    expect(SC.OffsetFormulaCoords("A6", 0, 1, { startRow: 3, endRow: 5 })).toBe("A6");
  });

  test("a row band missing endRow never freezes a shift, however far below startRow the row sits", async () => {
    const SC = await loadSocialCalc();
    // Only startRow is provided; `band.endRow != null` is false so the guard must be
    // skipped even though row 1 is below startRow 3. This kills forcing either/both
    // `!= null` checks to `true` (id=1192, id=1196) and swapping `&&` for `||` between
    // them (id=1193, since `true || false` would wrongly re-enable the guard).
    expect(SC.OffsetFormulaCoords("A1", 0, 1, { startRow: 3 })).toBe("A2");
  });

  test("a row band missing startRow never freezes a shift, however far above endRow the row sits", async () => {
    const SC = await loadSocialCalc();
    // Only endRow is provided; `band.startRow != null` is false so the guard is skipped
    // even though row 10 is above endRow 5. Isolates id=1194 (forcing `startRow != null`
    // to `true`).
    expect(SC.OffsetFormulaCoords("A10", 0, 1, { endRow: 5 })).toBe("A11");
  });
});

describe("OffsetFormulaCoords overflow to #REF! (id=1232, id=1239)", () => {
  test("a coord whose row is offset below 1 becomes #REF!", async () => {
    const SC = await loadSocialCalc();
    // Dropping the `cr.row < 1` clause from the OR chain would let a negative row through
    // unflagged (column stays valid) while row alone should already force #REF!.
    expect(SC.OffsetFormulaCoords("A1", 0, -5)).toBe("#REF!");
  });

  test("the maximum valid column (ZZ, col 702) is not itself out of range", async () => {
    const SC = await loadSocialCalc();
    // col 702 == 702: `col > 702` is false, so it must NOT become #REF!. Widening the
    // comparison to `>=` would wrongly reject the maximum valid column.
    expect(SC.OffsetFormulaCoords("ZZ1", 0, 0)).toBe("ZZ1");
  });
});

// id=1364/id=1365/id=1368 (the `cr.row < 1 || cr.col < 1` pair at L370) are
// EQUIVALENT, not tested here — see stryker-mutation-disposition.json. Proof
// sketch: the only way this function ever drives `cr.row` or `cr.col` below 1
// is the deleted-band zeroing block a few lines above, which sets BOTH
// `cr.col = 0` AND `cr.row = 0` together in one unconditional pair whenever
// either axis's deletion-band condition matches; the row/col shift that
// follows can only add a (possibly negative) offset when `cr.>= col/row`,
// and algebraically any shift that would land below 1 already satisfies the
// SAME deletion-band condition (since col/row are always >= 1 in every
// caller), so it is always intercepted by the zeroing branch first. A
// sheet-qualified reference (`sheetref`) skips both the zeroing and the
// shift entirely, leaving a coord that a real lexer only ever tags `coord`
// when it matched `[A-Z]{1,2}[1-9]\d*`, i.e. row >= 1 and col in [1,702]
// already. So `cr.row < 1` and `cr.col < 1` are always equal in every
// reachable state: replacing `||` with `&&` (id=1364), or forcing either
// individual clause to `false` (id=1365, id=1368), can never change the
// truth value of the disjunction because the other clause is always in
// lockstep. The independent `cr.col > 702` disjunct (column overflow, not
// touched by any of these 3 mutants) is what the tests below exercise.
describe("AdjustFormulaCoords overflow to #REF!", () => {
  test("deleting the column a plain reference sits in still turns it into #REF!", async () => {
    const SC = await loadSocialCalc();
    // Baseline sanity check for the deleted-band detection this same overflow guard
    // ultimately surfaces through: deleting column B (col 2, coloffset -1) invalidates a
    // B1 reference.
    expect(SC.AdjustFormulaCoords("B1", 2, -1, 1, 0)).toBe("#REF!");
  });

  test("shifting a column past ZZ (702) turns it into #REF!", async () => {
    const SC = await loadSocialCalc();
    // Isolates the untouched `cr.col > 702` disjunct in isolation from the
    // row/col-underflow pair proven equivalent above.
    expect(SC.AdjustFormulaCoords("A1", 1, 750, 1, 0)).toBe("#REF!");
  });
});


// --------------------------------------------------------------------------
// Fresh no-exclusion survivors: every middle column letter (ids 1002-1015).
// --------------------------------------------------------------------------

describe("fresh formula-ref survivors", () => {
  test("fresh ids1002-1015: every A-Z column letter remains addressable", async () => {
    const SC = await loadSocialCalc();
    for (let col = 1; col <= 26; col++) {
      const letter = String.fromCharCode(64 + col);
      expect(SC.crToCoord(col, 1)).toBe(`${letter}1`);
    }
  });
});
