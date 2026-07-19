// Real-browser coverage of the pivot table field-picker/settings UI panel:
// opening the "Pivot" tab, filling the form, creating a pivot via the real
// toolbar button click (not a scheduled command string), and observing the
// materialized output render in the live DOM grid.

import type { Page } from "@playwright/test";

import {
  cellLocator,
  cellValue,
  createControl,
  expect,
  gotoBundle,
  scheduleCommand,
  test,
  waitFor,
} from "./fixtures/editor";

async function loadSource(page: Page) {
  await scheduleCommand(
    page,
    [
      "set A1 text t Region",
      "set B1 text t Amount",
      "set A2 text t East",
      "set B2 value n 100",
      "set A3 text t West",
      "set B3 value n 30",
      "recalc",
    ].join("\n"),
  );
  await waitFor(
    page,
    (idPrefix) => window.__scControls[idPrefix].sheet.cells.B2?.datavalue === 100,
    "SocialCalc-",
  );
}

test.describe("pivot table settings UI", () => {
  test("Pivot tab creates a pivot table via real form fill + button click", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await loadSource(page);

    // Open the Pivot tab.
    await page.click("#SocialCalc-pivottab");
    await expect(page.locator("#SocialCalc-pivottools")).toBeVisible();

    await page.fill("#SocialCalc-pivotanchor", "D1");
    await page.fill("#SocialCalc-pivotsource", "A1:B3");
    await page.fill("#SocialCalc-pivotrowfields", "Region");
    await page.fill("#SocialCalc-pivotvaluefield", "Amount");
    await page.selectOption("#SocialCalc-pivotaggregation", "sum");

    await page.click('input[value="Create/Update"]');

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.E2?.datavalue === 100,
      "SocialCalc-",
    );
    expect(await cellValue(page, "D2")).toBe("East");
    expect(await cellValue(page, "E2")).toBe(100);
    expect(await cellValue(page, "D3")).toBe("West");
    expect(await cellValue(page, "E3")).toBe(30);
    await expect(cellLocator(page, "E2")).toHaveText("100");
  });

  test("pivot output cells reject a real keyboard edit attempt", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await loadSource(page);

    await page.click("#SocialCalc-pivottab");
    await page.fill("#SocialCalc-pivotanchor", "D1");
    await page.fill("#SocialCalc-pivotsource", "A1:B3");
    await page.fill("#SocialCalc-pivotrowfields", "Region");
    await page.fill("#SocialCalc-pivotvaluefield", "Amount");
    await page.click('input[value="Create/Update"]');
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.E2?.datavalue === 100,
      "SocialCalc-",
    );

    // Attempt a real click + type on an owned output cell: the editor's
    // pivotowner guard must suppress the edit and leave the value intact.
    await page.click("#cell_E2");
    await page.keyboard.type("999");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    expect(await cellValue(page, "E2")).toBe(100);
  });

  test("Refresh and Delete buttons drive refreshpivot/deletepivot end to end", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await loadSource(page);

    await page.click("#SocialCalc-pivottab");
    await page.fill("#SocialCalc-pivotanchor", "D1");
    await page.fill("#SocialCalc-pivotsource", "A1:B3");
    await page.fill("#SocialCalc-pivotrowfields", "Region");
    await page.fill("#SocialCalc-pivotvaluefield", "Amount");
    await page.click('input[value="Create/Update"]');
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.E2?.datavalue === 100,
      "SocialCalc-",
    );

    // Edit the source, then use Refresh to recompute without a broader recalc.
    await scheduleCommand(page, "set B2 value n 500");
    await page.click("#SocialCalc-pivottab");
    await page.fill("#SocialCalc-pivotanchor", "D1");
    await page.click('input[value="Refresh"]');
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.E2?.datavalue === 500,
      "SocialCalc-",
    );

    await page.click("#SocialCalc-pivottab");
    await page.fill("#SocialCalc-pivotanchor", "D1");
    await page.click('#SocialCalc-pivottools input[value="Delete"]');
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.E2?.pivotowner === undefined,
      "SocialCalc-",
    );
    expect(await cellValue(page, "E2")).toBeUndefined();
  });
});
