// Real-browser coverage for the editor productivity features: Find/Replace,
// Freeze/Unfreeze Panes, Ctrl+Y / Ctrl+Shift+Z redo, and the modern
// navigator.clipboard copy/paste path with its legacy-textarea fallback.
// Runs against the normal bundle only (bundle-parity.spec.ts already
// re-exercises a subset of the base editor-core suite against the
// minified bundle; these are new features, not parity checks).

import {
  cellValue,
  clickCell,
  createControl,
  expect,
  gotoBundle,
  test,
  waitFor,
} from "./fixtures/editor";

test.describe("redo keyboard shortcuts", () => {
  test("Ctrl+Y redoes an undone edit", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "A1");
    await page.keyboard.type("42");
    await page.keyboard.press("Enter");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 42,
      "SocialCalc-",
    );

    await page.evaluate(
      (idPrefix) => window.__scControls[idPrefix].editor.SheetUndo(),
      "SocialCalc-",
    );
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue !== 42,
      "SocialCalc-",
    );

    await clickCell(page, "A1");
    await page.keyboard.press("Control+y");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 42,
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe(42);
  });

  test("Ctrl+Shift+Z redoes an undone edit (Ctrl+Z alone still undoes)", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "B1");
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue === 7,
      "SocialCalc-",
    );

    await clickCell(page, "B1");
    await page.keyboard.press("Control+z");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue !== 7,
      "SocialCalc-",
    );

    await clickCell(page, "B1");
    await page.keyboard.press("Control+Shift+z");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue === 7,
      "SocialCalc-",
    );
    expect(await cellValue(page, "B1")).toBe(7);
  });
});

test.describe("Freeze / Unfreeze Panes", () => {
  test("Freeze Panes button freezes at the active cell; Unfreeze collapses back to one pane", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "C3");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].editor.ecell.coord === "C3",
      "SocialCalc-",
    );

    await page.click("#SocialCalc-freezepanesbutton");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].editor.context.rowpanes.length === 2,
      "SocialCalc-",
    );
    const paneCounts = await page.evaluate((idPrefix) => {
      const ctx = window.__scControls[idPrefix].editor.context;
      return { rowpanes: ctx.rowpanes.length, colpanes: ctx.colpanes.length };
    }, "SocialCalc-");
    expect(paneCounts).toEqual({ rowpanes: 2, colpanes: 2 });

    await page.click("#SocialCalc-unfreezepanesbutton");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].editor.context.rowpanes.length === 1,
      "SocialCalc-",
    );
    const afterUnfreeze = await page.evaluate((idPrefix) => {
      const ctx = window.__scControls[idPrefix].editor.context;
      return { rowpanes: ctx.rowpanes.length, colpanes: ctx.colpanes.length };
    }, "SocialCalc-");
    expect(afterUnfreeze).toEqual({ rowpanes: 1, colpanes: 1 });
  });
});

test.describe("Find & Replace", () => {
  test("Replace All rewrites every matching cell via the toolbar inputs and buttons", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "A1");
    await page.keyboard.type("cat");
    await page.keyboard.press("Enter");
    await clickCell(page, "A2");
    await page.keyboard.type("category");
    await page.keyboard.press("Enter");
    await waitFor(
      page,
      (idPrefix) =>
        window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "cat" &&
        window.__scControls[idPrefix].sheet.cells.A2?.datavalue === "category",
      "SocialCalc-",
    );

    await page.fill("#searchbarinput", "cat");
    await page.fill("#replacebarinput", "dog");
    await page.click("#SocialCalc-replaceallbutton");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "dog",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("dog");
    expect(await cellValue(page, "A2")).toBe("dogegory");

    // Undo restores both replacements in the single transaction Replace-All
    // scheduled as one command batch.
    await page.evaluate(
      (idPrefix) => window.__scControls[idPrefix].editor.SheetUndo(),
      "SocialCalc-",
    );
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "cat",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A2")).toBe("category");
  });

  test("Replace (one) rewrites only the active cell, leaving other matches untouched", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "A1");
    await page.keyboard.type("foo");
    await page.keyboard.press("Enter");
    await clickCell(page, "A2");
    await page.keyboard.type("foo");
    await page.keyboard.press("Enter");
    await waitFor(
      page,
      (idPrefix) =>
        window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "foo" &&
        window.__scControls[idPrefix].sheet.cells.A2?.datavalue === "foo",
      "SocialCalc-",
    );

    await clickCell(page, "A1");
    await page.fill("#searchbarinput", "foo");
    await page.fill("#replacebarinput", "bar");
    await page.click("#SocialCalc-replaceonebutton");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "bar",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("bar");
    expect(await cellValue(page, "A2")).toBe("foo");
  });
});

test.describe("clipboard: modern navigator.clipboard path with legacy fallback", () => {
  // navigator.clipboard permission grants and reliable readText/writeText
  // behavior are Chromium-specific in Playwright; Firefox/WebKit still run
  // the rest of this suite (redo/freeze/replace above) but skip this one.
  test("Ctrl+C writes the copied cell text to the OS clipboard, and Ctrl+V elsewhere reads it back", async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== "chromium", "navigator.clipboard grants are Chromium-only here");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "A1");
    await page.keyboard.type("clipboard-value");
    await page.keyboard.press("Enter");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "clipboard-value",
      "SocialCalc-",
    );

    await clickCell(page, "A1");
    await page.keyboard.press("Control+c");
    // navigator.clipboard.writeText is fire-and-forget from the key handler;
    // give it a turn before reading the OS clipboard back.
    await page.waitForTimeout(150);
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("clipboard-value");

    await clickCell(page, "B1");
    await page.keyboard.press("Control+v");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue === "clipboard-value",
      "SocialCalc-",
      6000,
    );
    expect(await cellValue(page, "B1")).toBe("clipboard-value");
  });

  test("copy still populates SocialCalc's internal clipboard when navigator.clipboard.writeText is unavailable (legacy fallback path)", async ({
    page,
  }) => {
    // Headless Chromium's native execCommand-based textarea copy does not
    // reliably reach the automation-visible OS clipboard even with
    // clipboard-read/clipboard-write permissions granted, so this cannot
    // assert against navigator.clipboard.readText() the way the modern-path
    // test above does. What IS deterministically observable — and is
    // exactly the contract this fallback must preserve — is that the
    // pre-existing "copy" sheet-command dispatch (which populates
    // SocialCalc's own internal clipboard, independent of the OS
    // clipboard) still runs unconditionally when the modern API is
    // unavailable; the modern-path test above already proves the OS
    // clipboard side and the full paste round-trip when the API IS present.
    await gotoBundle(page, "normal");
    await createControl(page);

    // Remove navigator.clipboard.writeText only (matches how the source
    // checks `typeof navigator.clipboard.writeText === "function"`) so
    // ctrlkeyFunction's [ctrl-c] handler skips the modern attempt entirely
    // and falls through to its pre-existing focused-textarea path.
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: undefined,
        configurable: true,
      });
    });

    await clickCell(page, "A1");
    await page.keyboard.type("legacy-path");
    await page.keyboard.press("Enter");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "legacy-path",
      "SocialCalc-",
    );

    await clickCell(page, "A1");
    await page.keyboard.press("Control+c");
    await waitFor(
      page,
      () => window.SocialCalc.Clipboard.clipboard.includes("legacy-path"),
      "SocialCalc-",
    );
  });
});
