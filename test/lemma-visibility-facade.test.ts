import { describe, expect, test } from "vite-plus/test";

import {
  filterHiddenAfterManualClear,
  isEffectivelyHidden,
  isInFilterDataBand,
  manualHiddenAfterFilterClear,
  outOfBandNeverFilterHidden,
  recomputeFilterHidden,
  recomputeIsIdempotent,
} from "../lemma/visibility";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

describe("lemma/visibility hide-composition policy (Dafny/Lean surface)", () => {
  test("isEffectivelyHidden is the inclusive OR of manual and filter hide, exhaustive over both booleans", () => {
    expect(isEffectivelyHidden(false, false)).toBe(false);
    expect(isEffectivelyHidden(true, false)).toBe(true);
    expect(isEffectivelyHidden(false, true)).toBe(true);
    expect(isEffectivelyHidden(true, true)).toBe(true);
  });

  test("manualHiddenAfterFilterClear/filterHiddenAfterManualClear are identity (clear isolation)", () => {
    expect(manualHiddenAfterFilterClear(true)).toBe(true);
    expect(manualHiddenAfterFilterClear(false)).toBe(false);
    expect(filterHiddenAfterManualClear(true)).toBe(true);
    expect(filterHiddenAfterManualClear(false)).toBe(false);
  });

  test("recomputeFilterHidden mirrors failsAnyCriterion directly", () => {
    expect(recomputeFilterHidden(true)).toBe(true);
    expect(recomputeFilterHidden(false)).toBe(false);
  });

  test("recomputeIsIdempotent always holds (pure function of a single input)", () => {
    expect(recomputeIsIdempotent(true)).toBe(true);
    expect(recomputeIsIdempotent(false)).toBe(true);
  });

  test("isInFilterDataBand excludes the header row and rows past the range end", () => {
    expect(isInFilterDataBand(1, 1, 5)).toBe(false); // header row itself
    expect(isInFilterDataBand(2, 1, 5)).toBe(true);
    expect(isInFilterDataBand(5, 1, 5)).toBe(true);
    expect(isInFilterDataBand(6, 1, 5)).toBe(false); // past last row
  });

  test("outOfBandNeverFilterHidden requires both in-band and failing", () => {
    expect(outOfBandNeverFilterHidden(false, true)).toBe(false);
    expect(outOfBandNeverFilterHidden(true, false)).toBe(false);
    expect(outOfBandNeverFilterHidden(true, true)).toBe(true);
    expect(outOfBandNeverFilterHidden(false, false)).toBe(false);
  });
});

describe("lemma/visibility vs shipping SocialCalc.RowEffectivelyHidden oracle", () => {
  test("isEffectivelyHidden matches SC.RowEffectivelyHidden exhaustively over manual/filter hide combinations", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 text t H", "set A2 text t x", "set A3 text t y"]);

    const combos: Array<[boolean, boolean]> = [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ];
    for (const [manual, filterHidden] of combos) {
      if (manual) {
        await scheduleCommands(SC, sheet, "set 2 hide yes");
      } else {
        await scheduleCommands(SC, sheet, "set 2 hide");
      }
      if (filterHidden) {
        await scheduleCommands(SC, sheet, [
          "autofilter attach f1 A1:A3",
          `autofilter criteria f1 0 ${SC.encodeForSave(JSON.stringify({ values: ["nomatch"] }))}`,
        ]);
      } else {
        await scheduleCommands(SC, sheet, "autofilter detach f1");
      }
      expect(SC.RowEffectivelyHidden(sheet, 2)).toBe(isEffectivelyHidden(manual, filterHidden));
    }
  });

  test("recompute-on-recalc is idempotent in the shipping runtime, matching recomputeIsIdempotent", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 text t H",
      "set A2 text t Eng",
      "set A3 text t Sales",
      "autofilter attach f1 A1:A3",
      `autofilter criteria f1 0 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
    ]);
    const first = { ...sheet.rowattribs.filterhide };
    await recalcSheet(SC, sheet);
    await recalcSheet(SC, sheet);
    expect(sheet.rowattribs.filterhide).toEqual(first);
    expect(recomputeIsIdempotent(true)).toBe(true);
    expect(recomputeIsIdempotent(false)).toBe(true);
  });

  test("clearing an AutoFilter never disturbs manual hide, matching manualHiddenAfterFilterClear", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 text t H",
      "set A2 text t Eng",
      "set 2 hide yes",
      "autofilter attach f1 A1:A2",
      `autofilter criteria f1 0 ${SC.encodeForSave(JSON.stringify({ values: ["nomatch"] }))}`,
    ]);
    expect(sheet.rowattribs.hide[2]).toBe("yes");
    await scheduleCommands(SC, sheet, "autofilter clearall f1");
    expect(sheet.rowattribs.hide[2]).toBe("yes");
    expect(manualHiddenAfterFilterClear(true)).toBe(true);
  });
});
