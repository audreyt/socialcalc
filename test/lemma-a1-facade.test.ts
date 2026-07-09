import { describe, expect, test } from "bun:test";

import {
  MAX_COL,
  applyAxisOffset,
  clampCol,
  clampRow,
  composeOffsets,
  crToCoord,
  isColInBounds,
  isRowInBounds,
  offsetCol,
  offsetRelativeA1,
  offsetRow,
  rcColname,
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
      // Leanstral pump edges (2026-07-09)
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

  test("shipping ZZ overflow fixture still holds", async () => {
    const SC = await loadSocialCalc();
    expect(SC.OffsetFormulaCoords("ZZ1", 1, 0)).toBe("#REF!");
    expect(offsetRelativeA1(702, 1, 1, 0)).toBe("#REF!");
  });
});
