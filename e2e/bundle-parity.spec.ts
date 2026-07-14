// Representative parity check between the normal and minified UMD bundles.
// `editor-core.spec.ts` already exercises the full behavior matrix once
// (against the normal bundle); this file re-runs a small representative
// slice — init, real click+keyboard edit, recalc, and a save/reload round
// trip — against both artifacts so a minification bug (e.g. a mangled
// property SocialCalc relies on by string) cannot slip through unnoticed,
// without duplicating the whole suite per bundle.

import {
  BUNDLE_PATHS,
  cellLocator,
  cellValue,
  clickCell,
  createControl,
  expect,
  gotoBundle,
  test,
  typeAndCommit,
  waitFor,
} from "./fixtures/editor";
import type { BundleName } from "./fixtures/editor";

for (const bundle of Object.keys(BUNDLE_PATHS) as BundleName[]) {
  test.describe(`${bundle} bundle`, () => {
    test(`initializes, edits a cell by real click+keyboard, and recalculates a formula`, async ({
      page,
    }) => {
      await gotoBundle(page, bundle);
      await createControl(page);
      await expect(cellLocator(page, "A1")).toBeVisible();

      await clickCell(page, "A1");
      await typeAndCommit(page, "9");
      await clickCell(page, "B1");
      await typeAndCommit(page, "=A1+1");

      await waitFor(
        page,
        (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue === 10,
        "SocialCalc-",
      );
      expect(await cellValue(page, "B1")).toBe(10);
    });

    test(`round-trips a save through CreateSheetSave/ParseSheetSave`, async ({ page }) => {
      await gotoBundle(page, bundle);
      await createControl(page);

      await page.evaluate(
        (idPrefix) =>
          window.__scControls[idPrefix].editor.EditorScheduleSheetCommands(
            "set A1 value n 123",
            true,
          ),
        "SocialCalc-",
      );
      await waitFor(
        page,
        (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 123,
        "SocialCalc-",
      );

      const save = await page.evaluate(
        (idPrefix) => window.__scControls[idPrefix].CreateSheetSave(),
        "SocialCalc-",
      );
      expect(save).toContain("cell:A1:v:123");

      const reloaded = await page.evaluate(
        ({ save, idPrefix }) => {
          const control = window.__scControls[idPrefix];
          control.ParseSheetSave(save);
          return control.sheet.cells.A1?.datavalue;
        },
        { save, idPrefix: "SocialCalc-" },
      );
      expect(reloaded).toBe(123);
    });
  });
}
