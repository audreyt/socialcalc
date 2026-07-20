// Real-browser coverage for the editor productivity features: pane sliders,
// Find/Replace, Ctrl+Y / Ctrl+Shift+Z redo, and the modern navigator.clipboard
// copy/paste path with its legacy-textarea fallback.
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
  scheduleCommand,
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

test.describe("tab tools and pane sliders", () => {
  test("initial Edit hides every other tool root, while Print toggles its controls", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    const initialVisibility: Array<{ name: string; display: string }> = await page.evaluate(
      (idPrefix) => {
        const spreadsheet = window.__scControls[idPrefix] as unknown as {
          tabs: Array<{ name: string }>;
        };
        return spreadsheet.tabs.map((tab: { name: string }) => ({
          name: tab.name,
          display: getComputedStyle(document.getElementById(idPrefix + tab.name + "tools")!)
            .display,
        }));
      },
      "SocialCalc-",
    );
    expect(initialVisibility.find((tool) => tool.name === "edit")?.display).not.toBe("none");
    expect(
      initialVisibility.filter((tool) => tool.name !== "edit").map((tool) => tool.display),
    ).toEqual(Array(initialVisibility.length - 1).fill("none"));

    await expect(page.locator("#SocialCalc-freezepanesbutton")).toHaveCount(0);
    await expect(page.locator("#SocialCalc-unfreezepanesbutton")).toHaveCount(0);

    await page.click("#SocialCalc-printtab");
    await expect(page.locator("#SocialCalc-print-area")).toBeVisible();

    await page.click("#SocialCalc-edittab");
    await expect(page.locator("#SocialCalc-print-area")).toBeHidden();
  });

  test("pane sliders freeze visible rows and columns, then unfreeze at their origins", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set sheet lastrow 100\nset sheet lastcol 30");
    await waitFor(
      page,
      (idPrefix) => {
        const sheet = window.__scControls[idPrefix].sheet as unknown as {
          attribs: { lastrow?: number; lastcol?: number };
        };
        return sheet.attribs.lastrow === 100 && sheet.attribs.lastcol === 30;
      },
      "SocialCalc-",
    );

    const sliderLocator = async (selector: string) => {
      const axis = selector.endsWith("h") ? "h" : "v";
      const slider = page.locator(`${selector}, #te_paneslider${axis}`);
      if (await slider.count()) return slider.first();
      throw new Error(`missing pane slider ${selector}`);
    };
    const dragSlider = async (selector: string, axis: "x" | "y", target: number) => {
      const slider = await (await sliderLocator(selector)).boundingBox();
      if (!slider) throw new Error(`missing pane slider ${selector}`);
      await page.mouse.move(slider.x + slider.width / 2, slider.y + slider.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        axis === "x" ? target : slider.x + slider.width / 2,
        axis === "y" ? target : slider.y + slider.height / 2,
      );
      await page.mouse.up();
    };
    const controlExtent = async (selector: string) => {
      const extent = await (
        await sliderLocator(selector)
      ).evaluate((element) => {
        const rect = element.parentElement?.getBoundingClientRect();
        return rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      if (!extent) throw new Error(`missing pane slider parent ${selector}`);
      return extent;
    };
    const horizontalControl = await controlExtent("#SocialCalc-panesliderh");
    const verticalControl = await controlExtent("#SocialCalc-panesliderv");

    await dragSlider(
      "#SocialCalc-panesliderh",
      "x",
      horizontalControl.x + horizontalControl.width - 40,
    );
    await waitFor(
      page,
      (idPrefix) => {
        const panes = window.__scControls[idPrefix].editor.context.colpanes as Array<{
          last: number;
        }>;
        return panes.length === 2 && panes[0].last >= 6;
      },
      "SocialCalc-",
    );

    await dragSlider(
      "#SocialCalc-panesliderv",
      "y",
      verticalControl.y + verticalControl.height - 40,
    );
    await waitFor(
      page,
      (idPrefix) => {
        const panes = window.__scControls[idPrefix].editor.context.rowpanes as Array<{
          last: number;
        }>;
        return panes.length === 2 && panes[0].last >= 3;
      },
      "SocialCalc-",
    );

    const frozen = await page.evaluate((idPrefix) => {
      const context = window.__scControls[idPrefix].editor.context as {
        rowpanes: Array<{ last: number }>;
        colpanes: Array<{ last: number }>;
      };
      return { row: context.rowpanes[0].last, col: context.colpanes[0].last };
    }, "SocialCalc-");
    expect(frozen.row).toBeGreaterThanOrEqual(3);
    expect(frozen.col).toBeGreaterThanOrEqual(6);

    const horizontalOrigin = await controlExtent("#SocialCalc-panesliderh");
    const verticalOrigin = await controlExtent("#SocialCalc-panesliderv");
    await dragSlider("#SocialCalc-panesliderh", "x", horizontalOrigin.x + 1);
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].editor.context.colpanes.length === 1,
      "SocialCalc-",
    );
    await dragSlider("#SocialCalc-panesliderv", "y", verticalOrigin.y + 1);
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].editor.context.rowpanes.length === 1,
      "SocialCalc-",
    );
  });
});

test.describe("Find & Replace", () => {
  test("Replace All rewrites every matching cell via the toolbar inputs and buttons", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await expect(page.getByRole("textbox", { name: "Find", exact: true })).toHaveAttribute(
      "id",
      "searchbarinput",
    );
    await expect(page.getByRole("textbox", { name: "Replace with", exact: true })).toHaveAttribute(
      "id",
      "replacebarinput",
    );
    const findReplaceOrder = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll(
          "#searchbar input, #searchbar img, #replacebar input, #replacebar button",
        ),
      ).map((element) => element.id);
      const visibleControls = Array.from(
        document.querySelectorAll(
          "#searchbar input, #searchbar img, #replacebar input, #replacebar button",
        ),
      )
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { id: element.id, x: rect.x, y: rect.y };
        })
        .sort((left, right) =>
          Math.abs(left.y - right.y) < 10 ? left.x - right.x : left.y - right.y,
        )
        .map((element) => element.id);
      const find = document.getElementById("searchbarinput")!.getBoundingClientRect();
      const replace = document.getElementById("replacebarinput")!.getBoundingClientRect();
      return {
        controls,
        visibleControls,
        find: { x: find.x, y: find.y },
        replace: { x: replace.x, y: replace.y },
      };
    });
    expect(findReplaceOrder.controls).toEqual([
      "searchbarinput",
      "SocialCalc-last",
      "SocialCalc-next",
      "replacebarinput",
      "replaceregexinput",
      "replaceformulasinput",
      "replacewholesheetinput",
      "SocialCalc-replaceonebutton",
      "SocialCalc-replaceallbutton",
    ]);
    expect(findReplaceOrder.visibleControls).toEqual(findReplaceOrder.controls);
    expect(findReplaceOrder.find.y).toBe(findReplaceOrder.replace.y);
    expect(findReplaceOrder.find.x).toBeLessThan(findReplaceOrder.replace.x);

    await page.locator("#searchbarinput").focus();
    const tabOrder: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      tabOrder.push(await page.evaluate(() => document.activeElement?.id ?? ""));
    }
    expect(tabOrder).toEqual([
      "replacebarinput",
      "replaceregexinput",
      "replaceformulasinput",
      "replacewholesheetinput",
      "SocialCalc-replaceonebutton",
      "SocialCalc-replaceallbutton",
    ]);

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
