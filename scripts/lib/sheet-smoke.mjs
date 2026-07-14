// Shared headless sheet smoke exercise: set two values, a formula that
// depends on both, recalc, and round-trip through CreateSheetSave/
// ParseSheetSave — verifying the formula's evaluated result survives the
// save/load cycle. Used by both scripts/verify-package-contract.mjs
// (against the freshly packed tarball, before any publish) and
// scripts/verify-registry-smoke.mjs (against the real, just-published npm
// registry package, after publish). Takes a loaded `SocialCalc` namespace
// object (any delivery path — CJS require, native ESM default import, or a
// bare VM sandbox global) so the same real behavioral proof runs
// identically regardless of how the caller obtained it.

/**
 * @param {any} sheet
 * @param {string | ((status: string) => boolean)} match
 * @param {() => void} trigger
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export function waitForStatus(sheet, match, trigger, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const previous = sheet.statuscallback;
    const matches = typeof match === "function" ? match : (status) => status === match;
    const timer = setTimeout(() => {
      sheet.statuscallback = previous;
      reject(new Error(`timed out waiting for status ${String(match)}`));
    }, timeoutMs);
    sheet.statuscallback = (...args) => {
      previous?.(...args);
      const status = args[1];
      if (matches(status)) {
        clearTimeout(timer);
        sheet.statuscallback = previous;
        resolve();
      }
    };
    try {
      trigger();
    } catch (error) {
      clearTimeout(timer);
      sheet.statuscallback = previous;
      reject(error);
    }
  });
}

/**
 * @param {any} SC a loaded SocialCalc namespace (any delivery path)
 * @param {string} label used only in error messages, to identify which delivery path failed
 * @returns {Promise<string>}
 */
export async function exerciseCommandFormulaSaveLoad(SC, label) {
  const sheet = new SC.Sheet();
  await waitForStatus(sheet, "cmdend", () =>
    SC.ScheduleSheetCommands(
      sheet,
      "set A1 value n 2\nset A2 value n 3\nset A3 formula A1+A2",
      true,
    ),
  );
  if (SC.RecalcInfo) {
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
  }
  await waitForStatus(sheet, "calcfinished", () => SC.RecalcSheet(sheet));
  if (sheet.cells.A3?.datavalue !== 5) {
    throw new Error(
      `[${label}] expected A3 formula A1+A2 to evaluate to 5, got ${sheet.cells.A3?.datavalue}`,
    );
  }

  const saved = SC.CreateSheetSave(sheet);
  if (typeof saved !== "string" || saved.length === 0) {
    throw new Error(`[${label}] CreateSheetSave produced no output`);
  }

  const reloaded = new SC.Sheet();
  SC.ParseSheetSave(saved, reloaded);
  if (reloaded.cells.A3?.datavalue !== 5) {
    throw new Error(`[${label}] round-tripped save/load lost A3's evaluated value`);
  }
  return `A3=5 saved ${saved.length} chars, round-trip OK`;
}
