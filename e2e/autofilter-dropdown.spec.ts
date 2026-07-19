// Real-browser coverage for the AutoFilter header dropdown UI:
// - a click on the dropdown arrow opens a popup listing every distinct
//   column value as an escaped, inert checkbox label (never live markup);
// - picking values and clicking OK applies an exact-value criterion and
//   hides the non-matching rows in the live DOM;
// - a hostile cell value used as a filter column's data never executes as
//   markup inside the dropdown (the security-critical contract).

import {
  createControl,
  expect,
  gotoBundle,
  scheduleCommand,
  test,
  waitFor,
} from "./fixtures/editor";

test.describe("AutoFilter header dropdown", () => {
  test("dropdown arrow opens a popup and applying a value criterion hides non-matching rows", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 text t Dept");
    await scheduleCommand(page, "set A2 text t Eng");
    await scheduleCommand(page, "set A3 text t Sales");
    await scheduleCommand(page, "autofilter attach f1 A1:A3");

    // The dropdown arrow renders inside the A1 header cell.
    const arrow = page.locator("#cell_A1 span.autofilter-dropdown-arrow");
    await expect(arrow).toBeVisible();

    await arrow.click();

    // Popup lists both distinct values as separate checkbox labels.
    const engBox = page.locator('input[data-autofilter-value="Eng"]');
    const salesBox = page.locator('input[data-autofilter-value="Sales"]');
    await expect(engBox).toBeVisible();
    await expect(salesBox).toBeVisible();
    await expect(engBox).toBeChecked();
    await expect(salesBox).toBeChecked();

    // Uncheck Sales, keep Eng, apply.
    await salesBox.uncheck();
    await page
      .locator('input[type="button"][value="OK"][onclick*="AutoFilterDropdownApply"]')
      .click();

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.rowattribs.filterhide[3] === "yes",
      "SocialCalc-",
    );
    const filterhide = await page.evaluate(
      () => window.__scControls["SocialCalc-"].sheet.rowattribs.filterhide,
    );
    expect(filterhide[2]).toBeUndefined(); // Eng row stays visible
    expect(filterhide[3]).toBe("yes"); // Sales row is filter-hidden
  });

  test("a hostile cell value used as a filter column never executes as markup in the dropdown", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await page.evaluate(() => {
      window.__autofilterXssFired = false;
      window.__markAutofilterXssFired = () => {
        window.__autofilterXssFired = true;
      };
    });

    await scheduleCommand(page, "set A1 text t Dept");
    // Hostile cell content: an <img> tag with an onerror handler, entered as
    // plain text (not text-html) so the only route it can reach markup
    // through is an unescaped popup builder.
    await scheduleCommand(
      page,
      "set A2 text t <img src=x onerror=window.__markAutofilterXssFired()>",
    );
    await scheduleCommand(page, "autofilter attach f1 A1:A2");

    const arrow = page.locator("#cell_A1 span.autofilter-dropdown-arrow");
    await expect(arrow).toBeVisible();
    await arrow.click();

    // The dropdown must render (proves the popup construction path ran)...
    await expect(page.locator('input[type="checkbox"][data-autofilter-value]')).toHaveCount(1);

    // ...but the hostile handler must never have fired: the cell text is
    // escaped before it becomes a checkbox label.
    const fired = await page.evaluate(() => window.__autofilterXssFired);
    expect(fired).toBe(false);

    // And the literal escaped text is what actually reached the DOM label,
    // not a live <img> element.
    const labelHtml = await page
      .locator('input[type="checkbox"][data-autofilter-value]')
      .locator("xpath=..")
      .innerHTML();
    expect(labelHtml).toContain("&lt;img");
    expect(labelHtml).not.toContain("<img ");
  });
});

declare global {
  interface Window {
    __autofilterXssFired: boolean;
    __markAutofilterXssFired: () => void;
  }
}
