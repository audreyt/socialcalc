import { expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

// Regression coverage for SocialCalc.RecalcLoadedSheet's null-sheetname
// handling.
//
// Bug: RecalcTimerRoutine's "start_wait" state falls through to
// RecalcLoadedSheet(null, "", false) whenever no host SocialCalc.RecalcInfo
// .LoadSheet callback is configured. RecalcLoadedSheet resolved the sheet
// name via `sheetname || SC.Formula.SheetCache.waitingForLoading`; if
// waitingForLoading was also null (nothing was ever actually queued -
// e.g. start_wait firing without a preceding cross-sheet formula reference,
// or double-firing after a prior load already reset it to null),
// AddSheetToCache(null, ...) called NormalizeSheetName(null), and the
// default NormalizeSheetName does `sheetname.toLowerCase()` - a
// deterministic TypeError. This was previously only exercised inside a
// try/catch that swallowed it (test/iofunctions-coverage.test.ts).
//
// Invariant this file locks: RecalcLoadedSheet never throws regardless of
// whether a sheet name is available from either source. When no name is
// available it is a pure no-op for the sheet cache (no AddSheetToCache
// call, so no bogus ""-keyed cache entry and no accidental string
// coercion of null) but still resets waitingForLoading to null and still
// reschedules the recalc timer so the loop cannot stall. When a name IS
// available (via either the explicit parameter or the cached
// waitingForLoading), behavior is unchanged from before the fix.

test("RecalcLoadedSheet(null, ...) does not throw and does not cache a bogus sheet when no name is available", async () => {
  const SC = await loadSocialCalc();
  const scf = SC.Formula;
  const prevWaiting = scf.SheetCache.waitingForLoading;
  const sheetCountBefore = Object.keys(scf.SheetCache.sheets).length;

  try {
    scf.SheetCache.waitingForLoading = null;

    expect(() => SC.RecalcLoadedSheet(null, "", false)).not.toThrow();

    // No accidental coercion of null into an empty-string cache key.
    expect(Object.prototype.hasOwnProperty.call(scf.SheetCache.sheets, "")).toBe(false);
    expect(Object.keys(scf.SheetCache.sheets).length).toBe(sheetCountBefore);

    // Still resets the wait flag so the recalc loop is not stuck forever.
    expect(scf.SheetCache.waitingForLoading).toBeNull();
  } finally {
    scf.SheetCache.waitingForLoading = prevWaiting;
  }
});

test("RecalcTimerRoutine's start_wait branch with no LoadSheet and nothing queued does not throw", async () => {
  const SC = await loadSocialCalc();
  const scri = SC.RecalcInfo;
  const scf = SC.Formula;

  const prevState = scri.currentState;
  const prevSheet = scri.sheet;
  const prevLoad = scri.LoadSheet;
  const prevWaiting = scf.SheetCache.waitingForLoading;

  try {
    // Reproduce the exact trigger: a real active sheet, start_wait state,
    // no host LoadSheet callback, and nothing actually queued to load -
    // i.e. the same conditions the previously-swallowed test hit.
    const sheet = new SC.Sheet();
    scri.sheet = sheet;
    scri.currentState = scri.state.start_wait;
    scri.LoadSheet = null;
    scf.SheetCache.waitingForLoading = null;

    expect(() => SC.RecalcTimerRoutine()).not.toThrow();

    // The timer routine still progresses the state machine forward
    // (start_wait -> done_wait) rather than getting stuck.
    expect(scri.currentState).toBe(scri.state.done_wait);
  } finally {
    if (scri.recalctimer) {
      SC.RecalcClearTimeout();
    }
    scri.currentState = prevState;
    scri.sheet = prevSheet;
    scri.LoadSheet = prevLoad;
    scf.SheetCache.waitingForLoading = prevWaiting;
  }
});

test("RecalcLoadedSheet still loads via the waitingForLoading fallback when a name is queued (unchanged behavior)", async () => {
  const SC = await loadSocialCalc();
  const scf = SC.Formula;
  const scri = SC.RecalcInfo;
  const prevWaiting = scf.SheetCache.waitingForLoading;

  try {
    scf.SheetCache.waitingForLoading = "regressionsheet";
    const saveStr = "version:1.5\nsheet:c:1:r:1\ncell:A1:v:99\n";

    // sheetname param is null - must still resolve via waitingForLoading,
    // exactly as before this fix.
    SC.RecalcLoadedSheet(null, saveStr, false, false);

    expect(scf.SheetCache.waitingForLoading).toBeNull();
    const cached = scf.SheetCache.sheets.regressionsheet;
    expect(cached).toBeDefined();
    expect(cached.sheet.cells.A1.datavalue).toBe(99);
  } finally {
    scf.SheetCache.waitingForLoading = prevWaiting;
    delete scf.SheetCache.sheets.regressionsheet;
    scri.queue = [];
  }
});
