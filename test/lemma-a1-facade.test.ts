import { describe, expect, test } from "vite-plus/test";

import {
  MAX_COL,
  adjustA1,
  adjustAxis,
  applyAxisOffset,
  clampCol,
  clampRow,
  colFromRcRanks,
  colToRcRanks,
  composeOffsets,
  crToCoord,
  formatA1Parts,
  isColInBounds,
  isRowInBounds,
  offsetA1,
  offsetA1Parts,
  offsetCol,
  offsetRelativeA1,
  offsetRow,
  rcColname,
  wouldAdjustRef,
  wouldOffsetA1Ref,
  wouldOffsetRef,
} from "../lemma/a1";
import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/a1 facade laws (Dafny/Lean surface)", () => {
  test("clampCol/clampRow bounds", () => {
    expect(clampCol(0)).toBe(1);
    expect(clampCol(-5)).toBe(1);
    expect(clampCol(1)).toBe(1);
    expect(clampCol(702)).toBe(702);
    expect(clampCol(703)).toBe(702);
    expect(clampCol(9999)).toBe(702);
    expect(clampRow(0)).toBe(1);
    expect(clampRow(-1)).toBe(1);
    expect(clampRow(50)).toBe(50);
  });

  test("isColInBounds / isRowInBounds match rewrite #REF! policy", () => {
    expect(isColInBounds(0)).toBe(false);
    expect(isColInBounds(1)).toBe(true);
    expect(isColInBounds(702)).toBe(true);
    expect(isColInBounds(703)).toBe(false);
    expect(isRowInBounds(0)).toBe(false);
    expect(isRowInBounds(1)).toBe(true);
  });

  test("offsetCol/offsetRow return -1 for #REF! band", () => {
    expect(offsetCol(1, -1)).toBe(-1);
    expect(offsetCol(702, 1)).toBe(-1);
    expect(offsetCol(1, 0)).toBe(1);
    expect(offsetCol(1, 1)).toBe(2);
    expect(offsetRow(1, -1)).toBe(-1);
    expect(offsetRow(5, 2)).toBe(7);
  });

  test("applyAxisOffset respects absolute lock", () => {
    expect(applyAxisOffset(1, 5, true, true)).toBe(1);
    expect(applyAxisOffset(1, 5, false, true)).toBe(6);
    expect(applyAxisOffset(702, 1, false, true)).toBe(-1);
    expect(applyAxisOffset(3, 2, true, false)).toBe(3);
    expect(applyAxisOffset(3, 2, false, false)).toBe(5);
  });

  test("OFFSET_COMPOSITION on pure offsets", () => {
    expect(composeOffsets(1, 1)).toBe(2);
    expect(composeOffsets(-3, 5)).toBe(2);
    const once = offsetCol(1, 1);
    expect(once).toBe(2);
    expect(offsetCol(once, 1)).toBe(offsetCol(1, composeOffsets(1, 1)));
  });

  test("rcColname/crToCoord alphabet edges", () => {
    expect(rcColname(1)).toBe("A");
    expect(rcColname(26)).toBe("Z");
    expect(rcColname(27)).toBe("AA");
    expect(rcColname(702)).toBe("ZZ");
    expect(rcColname(0)).toBe("A");
    expect(rcColname(703)).toBe("ZZ");
    expect(crToCoord(1, 1)).toBe("A1");
    expect(crToCoord(27, 2)).toBe("AA2");
    expect(crToCoord(702, 10)).toBe("ZZ10");
    expect(crToCoord(0, 0)).toBe("A1");
  });

  test("offsetRelativeA1 overflow becomes #REF!", () => {
    expect(offsetRelativeA1(1, 1, 0, 0)).toBe("A1");
    expect(offsetRelativeA1(1, 1, 1, 1)).toBe("B2");
    expect(offsetRelativeA1(1, 1, -1, 0)).toBe("#REF!");
    expect(offsetRelativeA1(MAX_COL, 1, 1, 0)).toBe("#REF!");
    expect(offsetRelativeA1(MAX_COL, 1, 0, 0)).toBe("ZZ1");
  });

  test("wouldOffsetRef iff offsetRelativeA1 is #REF!", () => {
    const matrix: Array<[number, number, number, number]> = [
      [1, 1, 0, 0],
      [1, 1, 1, 0],
      [1, 1, -1, 0],
      [MAX_COL, 1, 1, 0],
      [MAX_COL, 1, 0, 0],
      [5, 1, 0, -1],
      [1, 5, 0, -5],
      [26, 2, 1, 1],
    ];
    for (const [c, r, dc, dr] of matrix) {
      const ref = wouldOffsetRef(c, r, dc, dr);
      const out = offsetRelativeA1(c, r, dc, dr);
      expect(ref).toBe(out === "#REF!");
      if (!ref) {
        expect(out).toBe(crToCoord(c + dc, r + dr));
      }
    }
  });

  test("zero-offset identity on in-band cells", () => {
    for (const c of [1, 26, 27, 702]) {
      expect(offsetCol(c, 0)).toBe(c);
      expect(offsetRelativeA1(c, 3, 0, 0)).toBe(crToCoord(c, 3));
    }
    expect(offsetRow(10, 0)).toBe(10);
  });

  test("offsetA1Parts absolute locks", () => {
    // $A1 + (1,1) → $A2 (col locked)
    expect(offsetA1Parts(1, 1, true, false, 1, 1)).toEqual({ col: 1, row: 2 });
    // A$1 + (1,1) → B$1 (row locked)
    expect(offsetA1Parts(1, 1, false, true, 1, 1)).toEqual({ col: 2, row: 1 });
    // $A$1 + (1,1) → $A$1
    expect(offsetA1Parts(1, 1, true, true, 1, 1)).toEqual({ col: 1, row: 1 });
    // ZZ relative col +1 → REF
    expect(offsetA1Parts(702, 1, false, false, 1, 0)).toEqual({
      col: -1,
      row: -1,
    });
  });

  test("formatA1Parts markers and REF", () => {
    expect(formatA1Parts(1, 1, true, false)).toBe("$A1");
    expect(formatA1Parts(1, 1, false, true)).toBe("A$1");
    expect(formatA1Parts(1, 1, true, true)).toBe("$A$1");
    expect(formatA1Parts(0, 1, false, false)).toBe("#REF!");
  });

  test("adjustAxis delete band and insert shift", () => {
    // delete col 2 (delta -1): B→REF, C→B, A stays
    expect(adjustAxis(1, 2, -1, true)).toBe(1);
    expect(adjustAxis(2, 2, -1, true)).toBe(-1);
    expect(adjustAxis(3, 2, -1, true)).toBe(2);
    // insert 1 col at 2: B→C, A stays
    expect(adjustAxis(1, 2, 1, true)).toBe(1);
    expect(adjustAxis(2, 2, 1, true)).toBe(3);
    // wide delete cols 2..3 (start=2, delta=-2)
    expect(adjustAxis(1, 2, -2, true)).toBe(1);
    expect(adjustAxis(2, 2, -2, true)).toBe(-1);
    expect(adjustAxis(3, 2, -2, true)).toBe(-1);
    expect(adjustAxis(4, 2, -2, true)).toBe(2);
  });

  test("wouldAdjustRef iff adjustA1 is #REF!", () => {
    const matrix: Array<[number, number, number, number, number, number]> = [
      [1, 1, 2, -1, 1, 0], // A stays
      [2, 1, 2, -1, 1, 0], // B deleted
      [3, 1, 2, -1, 1, 0], // C → B
      [2, 1, 2, -2, 1, 0], // wide delete band
      [3, 1, 2, -2, 1, 0],
      [4, 1, 2, -2, 1, 0],
      [1, 2, 1, 0, 2, -1], // delete row 2
      [1, 3, 1, 0, 2, -1],
      [702, 1, 702, 1, 1, 0], // insert at ZZ shifts past band
      [1, 1, 1, 0, 1, 0], // zero deltas
    ];
    for (const [c, r, sc, dc, sr, dr] of matrix) {
      const ref = wouldAdjustRef(c, r, sc, dc, sr, dr);
      const out = adjustA1(c, r, false, false, sc, dc, sr, dr);
      expect(ref).toBe(out === "#REF!");
    }
  });

  test("adjustAxis left-of-start identity on in-band", () => {
    expect(adjustAxis(1, 5, -2, true)).toBe(1);
    expect(adjustAxis(4, 5, 3, true)).toBe(4);
    expect(adjustAxis(3, 5, -1, false)).toBe(3);
    // out-of-band left stays -1 after "no shift"
    expect(adjustAxis(0, 5, -1, true)).toBe(-1);
    expect(adjustAxis(0, 5, 1, false)).toBe(-1);
  });

  test("colFromRcRanks inverse of colToRcRanks", () => {
    for (const c of [1, 2, 26, 27, 28, 52, 53, 100, 701, 702]) {
      const { colhigh, collow } = colToRcRanks(c);
      expect(colFromRcRanks(colhigh, collow)).toBe(c);
      expect(rcColname(c)).toBe(
        colhigh === 0
          ? String.fromCharCode(65 + collow)
          : String.fromCharCode(64 + colhigh) + String.fromCharCode(65 + collow),
      );
    }
    expect(colFromRcRanks(0, 0)).toBe(1);
    expect(colFromRcRanks(0, 25)).toBe(26);
    expect(colFromRcRanks(1, 0)).toBe(27);
    expect(colFromRcRanks(26, 25)).toBe(702);
    expect(colFromRcRanks(-1, 0)).toBe(-1);
    expect(colFromRcRanks(0, 26)).toBe(-1);
    expect(colFromRcRanks(27, 0)).toBe(-1);
  });

  test("wouldOffsetA1Ref iff offsetA1 is #REF!", () => {
    const matrix: Array<[number, number, boolean, boolean, number, number]> = [
      [1, 1, false, false, 0, 0],
      [1, 1, true, false, 1, 1], // $A1 → $A2
      [1, 1, false, true, 1, 1], // A$1 → B$1
      [1, 1, true, true, 5, 5], // $A$1 locked
      [702, 1, false, false, 1, 0], // ZZ+1 REF
      [702, 1, true, false, 1, 0], // $ZZ1 col locked, stays
      [1, 1, false, false, -1, 0], // A-1 REF
      [0, 1, true, true, 0, 0], // out-of-band abs still REF
    ];
    for (const [c, r, ac, ar, dc, dr] of matrix) {
      const ref = wouldOffsetA1Ref(c, r, ac, ar, dc, dr);
      const parts = offsetA1Parts(c, r, ac, ar, dc, dr);
      expect(ref).toBe(parts.col === -1);
      expect(parts.col === -1).toBe(parts.row === -1);
      expect(ref).toBe(offsetA1(c, r, ac, ar, dc, dr) === "#REF!");
    }
  });

  test("colToRcRanks round-trips through clampCol", () => {
    for (const c of [-5, 0, 1, 26, 27, 702, 703, 9999]) {
      const ranks = colToRcRanks(c);
      expect(colFromRcRanks(ranks.colhigh, ranks.collow)).toBe(clampCol(c));
    }
  });

  test("rcColname length excludes #REF! token", () => {
    for (const c of [-1, 0, 1, 26, 27, 702, 800]) {
      const s = rcColname(c);
      expect(s.length).toBeGreaterThanOrEqual(1);
      expect(s.length).toBeLessThanOrEqual(2);
      expect(s).not.toBe("#REF!");
      expect(crToCoord(c, 1)).not.toBe("#REF!");
    }
  });
});

describe("lemma/a1 facade vs shipping SocialCalc oracle", () => {
  test("rcColname/crToCoord match shipping for in-band values", async () => {
    const SC = await loadSocialCalc();
    for (const c of [1, 2, 26, 27, 28, 100, 701, 702]) {
      expect(rcColname(c)).toBe(SC.rcColname(c));
      expect(crToCoord(c, 1)).toBe(SC.crToCoord(c, 1));
      expect(crToCoord(c, 99)).toBe(SC.crToCoord(c, 99));
    }
    expect(rcColname(0)).toBe(SC.rcColname(0));
    expect(rcColname(800)).toBe(SC.rcColname(800));
  });

  test("offsetRelativeA1 matches OffsetFormulaCoords on single relative coords", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[string, number, number]> = [
      ["A1", 1, 0],
      ["A1", 0, 1],
      ["A1", 1, 1],
      ["A1", -1, 0],
      ["B2", 2, 3],
      ["ZZ1", 1, 0],
      ["ZY1", 1, 0],
      ["A1", 0, -1],
      ["ZZ1", 0, 0],
      ["A1", 701, 0],
      ["ZY1", 0, -1],
      ["AA1", -1, 0],
    ];
    for (const [coord, dCol, dRow] of cases) {
      const cr = SC.coordToCr(coord);
      expect(offsetRelativeA1(cr.col, cr.row, dCol, dRow)).toBe(
        SC.OffsetFormulaCoords(coord, dCol, dRow),
      );
    }
  });

  test("offsetA1 matches OffsetFormulaCoords with absolute markers", async () => {
    const SC = await loadSocialCalc();
    const cases: Array<[string, number, number]> = [
      ["$A1", 1, 1],
      ["A$1", 1, 1],
      ["$A$1", 2, 2],
      ["$A1", 0, 1],
      ["A$1", 1, 0],
      ["$ZZ1", 1, 0],
      ["ZZ$1", 1, 0],
      ["$A$1", -1, 0],
      ["B$2", 0, -1],
    ];
    for (const [coord, dCol, dRow] of cases) {
      const cr = SC.coordToCr(coord);
      const absCol = coord.charAt(0) === "$";
      const absRow = coord.indexOf("$", 1) !== -1;
      expect(offsetA1(cr.col, cr.row, absCol, absRow, dCol, dRow)).toBe(
        SC.OffsetFormulaCoords(coord, dCol, dRow),
      );
    }
  });

  test("adjustA1 matches AdjustFormulaCoords on single coords", async () => {
    const SC = await loadSocialCalc();
    // AdjustFormulaCoords(formula, col, coloffset, row, rowoffset)
    const cases: Array<[string, number, number, number, number]> = [
      ["B1", 2, -1, 1, 0], // delete col B → #REF!
      ["C1", 2, -1, 1, 0], // C → B
      ["A1", 2, -1, 1, 0], // A stays
      ["D1", 2, -2, 1, 0], // wide delete B:C → D becomes B
      ["B1", 2, -2, 1, 0], // in band → REF
      ["C1", 2, -2, 1, 0], // in band → REF
      ["A1+B1", 2, -1, 1, 0], // multi-token: only check single tokens below
      ["$B1", 2, -1, 1, 0],
      ["B$1", 2, -1, 1, 0],
      ["A2", 1, 0, 2, -1], // delete row 2
      ["A3", 1, 0, 2, -1], // A3 → A2
      ["A1", 1, 0, 2, -1], // stays
      ["B1", 2, 1, 1, 0], // insert col at B → C1
    ];
    for (const [coord, startCol, dCol, startRow, dRow] of cases) {
      if (coord.includes("+")) continue; // multi-token covered by formula fixtures
      const cr = SC.coordToCr(coord);
      const absCol = coord.charAt(0) === "$";
      const absRow = coord.indexOf("$", 1) !== -1;
      expect(adjustA1(cr.col, cr.row, absCol, absRow, startCol, dCol, startRow, dRow)).toBe(
        SC.AdjustFormulaCoords(coord, startCol, dCol, startRow, dRow),
      );
    }
  });

  test("shipping ZZ overflow fixture still holds", async () => {
    const SC = await loadSocialCalc();
    expect(SC.OffsetFormulaCoords("ZZ1", 1, 0)).toBe("#REF!");
    expect(offsetRelativeA1(702, 1, 1, 0)).toBe("#REF!");
  });
});
