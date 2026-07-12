import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

type Cell = { valuetype: string; errors?: string };

async function buildSheet(commands: string[]) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands, true, 4000);
  await recalcSheet(SC, sheet, 4000);
  const getVT = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).valuetype;
  const getErrors = (coord: string) => (sheet.GetAssuredCell(coord) as Cell).errors;
  return { SC, sheet, getVT, getErrors };
}

// ---------------------------------------------------------------------------
// EvaluatePolish previously reset `value` to 0 before the `isNaN(value)`
// ternary that selects the error message, so `isNaN(0)` was always false and
// every genuinely-NaN result (e.g. Infinity - Infinity) misreported the
// "Numeric overflow" message instead of the correct NaN message. Fixed by
// capturing `numericIsNaN = isNaN(value)` before the value is reset. Both
// branches must stay distinguishable.
// ---------------------------------------------------------------------------

test("EvaluatePolish reports the NaN message for a genuinely NaN result (Infinity - Infinity)", async () => {
  const { SC, getVT, getErrors } = await buildSheet(["set A1 formula (1e308*10)-(1e308*10)"]);
  expect(getVT("A1")).toBe("e#NUM!");
  expect(getErrors("A1")).toBe(SC.Constants.s_calcerrnumericnan);
});

test("EvaluatePolish reports the overflow message for a genuine overflow (no NaN)", async () => {
  const { SC, getVT, getErrors } = await buildSheet(["set A1 formula 1e308*10"]);
  expect(getVT("A1")).toBe("e#NUM!");
  expect(getErrors("A1")).toBe(SC.Constants.s_calcerrnumericoverflow);
});
