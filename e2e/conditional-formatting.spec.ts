// Real-browser coverage of the Conditional Formatting toolbar tab: opening
// the tab, filling the rule editor form, saving a rule via the real DOM
// click pipeline (not a direct command string), and observing the
// resulting cell style actually change on the rendered grid.

import {
  cellLocator,
  clickCell,
  createControl,
  expect,
  gotoBundle,
  test,
  typeAndCommit,
} from "./fixtures/editor";

test.describe("conditional formatting toolbar tab", () => {
  test("saving a rule through the real UI form colors the matching cell without a manual command", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "A1");
    await typeAndCommit(page, "10");

    // Open the Conditional Formatting tab via a real click (mirrors how a
    // user reaches the Format/Names tabs).
    await page.click("#SocialCalc-condfmttab");
    await expect(page.locator("#SocialCalc-condfmtrange")).toBeVisible();

    await page.fill("#SocialCalc-condfmtrange", "A1:A1");
    await page.selectOption("#SocialCalc-condfmttype", "cellis");
    await page.selectOption("#SocialCalc-condfmtop", "gt");
    await page.fill("#SocialCalc-condfmtvalue1", "5");
    await page.fill("#SocialCalc-condfmtcolor", "rgb(255,0,0)");
    await page.click("#SocialCalc-condfmtlist"); // ensure focus settles before Save
    await page.click('#SocialCalc-condfmttools input[value="Save"]');

    await page.waitForFunction(() => window.__scControl.sheet.condfmtRules.length === 1);

    const ruleColor = await page.evaluate(() => {
      const rule = window.__scControl.sheet.condfmtRules[0];
      return window.__scControl.sheet.colors[rule.style.color];
    });
    expect(ruleColor).toBe("rgb(255,0,0)");

    // The real rendered <td> for A1 must carry the conditional color, and
    // the underlying cell object's own .color attribute must remain unset
    // (overlay-only rendering, never mutating the base cell style).
    await expect(cellLocator(page, "A1")).toHaveCSS("color", "rgb(255, 0, 0)");
    const baseCellColor = await page.evaluate(() => window.__scControl.sheet.cells.A1?.color);
    expect(baseCellColor ?? 0).toBe(0);
  });

  test("deleting a rule through the UI removes the applied style", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "A1");
    await typeAndCommit(page, "10");

    await page.click("#SocialCalc-condfmttab");
    await page.fill("#SocialCalc-condfmtrange", "A1:A1");
    await page.selectOption("#SocialCalc-condfmttype", "cellis");
    await page.selectOption("#SocialCalc-condfmtop", "gt");
    await page.fill("#SocialCalc-condfmtvalue1", "5");
    await page.fill("#SocialCalc-condfmtcolor", "rgb(0,128,0)");
    await page.click('#SocialCalc-condfmttools input[value="Save"]');
    await page.waitForFunction(() => window.__scControl.sheet.condfmtRules.length === 1);
    await expect(cellLocator(page, "A1")).toHaveCSS("color", "rgb(0, 128, 0)");

    await page.click("#SocialCalc-condfmttab");
    await page.selectOption("#SocialCalc-condfmtlist", { index: 1 });
    await page.click('#SocialCalc-condfmttools input[value="Delete"]');
    await page.waitForFunction(() => window.__scControl.sheet.condfmtRules.length === 0);

    await expect(cellLocator(page, "A1")).not.toHaveCSS("color", "rgb(0, 128, 0)");
  });
});
