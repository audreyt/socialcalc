import { expect, test } from "vite-plus/test";

import { installUiShim } from "./helpers/ui";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

async function newAriaLiveControl() {
  const SC = await loadSocialCalc({ browser: true });
  installUiShim();
  const uniqueId = "aria-live-root-" + Math.random().toString(36).slice(2);
  const container = document.createElement("div");
  container.id = uniqueId;
  (document as any).body.appendChild(container);
  const control = new SC.SpreadsheetControl(uniqueId + "-");
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { SC, control };
}

test("SpreadsheetControlAriaLiveCallback is a no-op when the status region is missing from the DOM", async () => {
  const { SC, control } = await newAriaLiveControl();

  // A statusid that was never rendered into the document -- getElementById
  // misses, exercising the `!statusEle` guard without mutating the real
  // (shared-by-id-prefix-only) ariastatus element other tests may rely on.
  expect(() =>
    SC.SpreadsheetControlAriaLiveCallback(control.editor, "moveecell", "A1", {
      statusid: "no-such-status-id",
      errorid: control.idPrefix + "ariaerror",
    }),
  ).not.toThrow();
});

test("SpreadsheetControlAriaLiveCallback ignores moveecell when the editor has no ecell yet", async () => {
  const { SC, control } = await newAriaLiveControl();
  const statusRegion = document.getElementById(control.idPrefix + "ariastatus") as any;
  statusRegion.textContent = "unchanged";

  // Directly invoke the callback with a no-ecell editor stand-in -- proves
  // the `!editor.ecell` half of the guard leaves the region untouched,
  // distinct from the missing-element half covered above.
  SC.SpreadsheetControlAriaLiveCallback(
    { ecell: null, context: { sheetobj: { cells: {} } } },
    "moveecell",
    "A1",
    { statusid: control.idPrefix + "ariastatus", errorid: control.idPrefix + "ariaerror" },
  );

  expect(statusRegion.textContent).toBe("unchanged");
});

test("SpreadsheetControlAriaLiveCallback cmdend is a no-op when the error region is missing from the DOM", async () => {
  const { SC, control } = await newAriaLiveControl();
  await scheduleCommands(SC, control.sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, control.sheet);

  // An errorid that was never rendered into the document -- getElementById
  // misses, exercising the `!errorEle` guard without mutating the real
  // ariaerror element other tests may rely on.
  expect(() =>
    SC.SpreadsheetControlAriaLiveCallback({ context: { sheetobj: control.sheet } }, "cmdend", "", {
      statusid: control.idPrefix + "ariastatus",
      errorid: "no-such-error-id",
    }),
  ).not.toThrow();
});
