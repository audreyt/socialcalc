// Real-browser (Chromium/Firefox/WebKit) coverage of ARIA grid semantics,
// keyboard-driven selection/activedescendant tracking, aria-live status/error
// announcements, focus-visible styling, and print CSS/@page emission against
// the built `dist/SocialCalc.js` UMD bundle. Fake-DOM Vitest coverage
// (test/aria-grid.test.ts, test/print-setup.test.ts) exercises the same
// production functions in isolation; this file is the real-DOM/real-layout/
// real-keyboard evidence AGENTS.md requires for DOM/focus/keyboard contracts.

import {
  cellLocator,
  clickCell,
  createControl,
  expect,
  gotoBundle,
  scheduleCommand,
  test,
  waitFor,
} from "./fixtures/editor";

test.describe("ARIA grid roles and accessible structure", () => {
  test("the rendered grid exposes role=grid with row/col counts, and gridcell/columnheader/rowheader roles", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set C5 value n 1");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.C5?.datavalue === 1,
      "SocialCalc-",
    );

    const grid = page.locator(
      "#containerDiv table[role='grid']:not(#te_formData table[role='grid'])",
    );
    await expect(grid).toHaveCount(1);
    await expect(grid).toHaveAttribute("aria-rowcount", /^\d+$/);
    await expect(grid).toHaveAttribute("aria-colcount", /^\d+$/);

    const a1 = cellLocator(page, "A1");
    await expect(a1).toHaveAttribute("role", "gridcell");
    await expect(a1).toHaveAttribute("aria-rowindex", "1");
    await expect(a1).toHaveAttribute("aria-colindex", "1");

    // Column-letter header for column A.
    const colHeaderA = page
      .locator("#containerDiv td[role='columnheader']")
      .filter({ hasText: /^A$/ })
      .first();
    await expect(colHeaderA).toHaveAttribute("aria-colindex", "1");
    await expect(colHeaderA).toHaveAttribute("aria-label", "Column A");

    // Row-number header for row 1.
    const rowHeader1 = page
      .locator("#containerDiv td[role='rowheader']")
      .filter({ hasText: /^1$/ })
      .first();
    await expect(rowHeader1).toHaveAttribute("aria-label", "Row 1");
  });

  test("a cell's accessible name reflects its plain-text value, never HTML-escaped markup", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    // Cell text containing markup-like characters must appear verbatim in
    // aria-label as data, not be interpreted -- proves the label is built
    // from the plain value, not by concatenating rendered/escaped HTML.
    await scheduleCommand(page, "set A1 text t <b>not bold</b>");
    await waitFor(
      page,
      () => document.querySelector("#containerDiv #cell_A1")?.getAttribute("aria-label") != null,
      "SocialCalc-",
    );

    await expect(cellLocator(page, "A1")).toHaveAttribute("aria-label", "A1: <b>not bold</b>");
  });

  test("a readonly cell reports aria-readonly=true; a normal cell reports aria-readonly=false", async ({
    page,
  }) => {
    // Pre-existing, unrelated repo issue: defaultReadonlyStyle in
    // js/socialcalcconstants.ts references "images/sc-lockbg.gif" (hyphen)
    // but the tracked asset is "sc_lockbg.gif" (underscore), a 404 on every
    // readonly cell render regardless of this change. Route around it here
    // rather than "fixing" unrelated legacy behavior in this task's scope.
    await page.route("**/images/sc-lockbg.gif", (route) =>
      route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.alloc(0) }),
    );
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set A1 readonly yes");
    await waitFor(
      page,
      () =>
        document.querySelector("#containerDiv #cell_A1")?.getAttribute("aria-readonly") === "true",
      "SocialCalc-",
    );

    await expect(cellLocator(page, "A1")).toHaveAttribute("aria-readonly", "true");
    await expect(cellLocator(page, "B1")).toHaveAttribute("aria-readonly", "false");
  });

  test("a cell with a formula error reports aria-invalid=true", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set A1 formula 1/0");
    await waitFor(
      page,
      (idPrefix) => Boolean(window.__scControls[idPrefix].sheet.cells.A1?.errors),
      "SocialCalc-",
    );

    await expect(cellLocator(page, "A1")).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("keyboard navigation keeps ARIA selection state live", () => {
  test("arrow-key navigation moves aria-selected and the grid's aria-activedescendant to the new cursor cell", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await clickCell(page, "A1");

    const grid = page.locator(
      "#containerDiv table[role='grid']:not(#te_formData table[role='grid'])",
    );
    await expect(cellLocator(page, "A1")).toHaveAttribute("aria-selected", "true");
    await expect(grid).toHaveAttribute("aria-activedescendant", "cell_A1");

    await page.keyboard.press("ArrowRight");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].editor.ecell.coord === "B1",
      "SocialCalc-",
    );

    // The cursor moved with a real DOM re-paint (UpdateCellCSS), not just
    // internal state: the previous cell is no longer selected and the new
    // one, and the grid's activedescendant, are.
    await expect(cellLocator(page, "A1")).toHaveAttribute("aria-selected", "false");
    await expect(cellLocator(page, "B1")).toHaveAttribute("aria-selected", "true");
    await expect(grid).toHaveAttribute("aria-activedescendant", "cell_B1");

    await page.keyboard.press("ArrowDown");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].editor.ecell.coord === "B2",
      "SocialCalc-",
    );
    await expect(cellLocator(page, "B1")).toHaveAttribute("aria-selected", "false");
    await expect(cellLocator(page, "B2")).toHaveAttribute("aria-selected", "true");
    await expect(grid).toHaveAttribute("aria-activedescendant", "cell_B2");
  });

  test("the grid is keyboard-focusable via tabindex and reachable without a mouse", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await clickCell(page, "A1"); // triggers the initial full render (see createControl note)

    const grid = page.locator(
      "#containerDiv table[role='grid']:not(#te_formData table[role='grid'])",
    );
    await expect(grid).toHaveAttribute("tabindex", "0");
  });
});

test.describe("aria-live announcements", () => {
  test("moving the cursor announces the new cell coordinate and value in the visually-hidden polite live region", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set B1 value n 42");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue === 42,
      "SocialCalc-",
    );

    await clickCell(page, "B1");

    const statusRegion = page.locator("#SocialCalc-ariastatus");
    await expect(statusRegion).toHaveAttribute("aria-live", "polite");
    await expect(statusRegion).toHaveText("B1: 42");

    const statusClass = await statusRegion.getAttribute("class");
    expect(statusClass).toContain("sr-only");

    // Visually hidden: zero on-screen footprint, but present in the DOM for
    // assistive technology (the .sr-only clip-rect pattern).
    const box = await statusRegion.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(1);
    expect(box?.height).toBeLessThanOrEqual(1);
  });

  test("a command error is announced in the assertive/alert live region", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    // "sett" is not a recognized command verb -> ExecuteSheetCommand's
    // default case returns an "Unknown command" errortext, which
    // SheetCommandsTimerRoutine both alert()s and stashes on
    // sheet.lastcommanderror for the aria-live path. The native alert() is
    // a pre-existing, separate error-reporting mechanism (not something
    // this change adds or removes); stub it here so this test isolates the
    // new aria-live announcement path from that dialog.
    await page.evaluate(() => {
      window.alert = () => {};
    });
    await page.evaluate(() => {
      window.__scControls["SocialCalc-"].editor.EditorScheduleSheetCommands(
        "sett A1 value n 1",
        true,
      );
    });
    await waitFor(
      page,
      () => document.getElementById("SocialCalc-ariaerror")?.textContent !== "",
      "SocialCalc-",
    );

    const errorRegion = page.locator("#SocialCalc-ariaerror");
    await expect(errorRegion).toHaveAttribute("role", "alert");
    await expect(errorRegion).toHaveAttribute("aria-live", "assertive");
    await expect(errorRegion).toHaveText("Unknown command: sett A1 value n 1");
  });
});

test.describe("focus-visible styling", () => {
  test("focusing the grid shows a visible outline matching the CSS contract", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await clickCell(page, "A1");

    // Reveal the Replace controls, then use a genuine Tab transition from
    // their final button into the live grid. This establishes :focus-visible
    // modality in every supported engine. The print/download clone under
    // #te_formData has the same role/id but is not interactive.
    await page.fill("#searchbarinput", "focus");
    await expect(page.locator("#replacebar")).toBeVisible();
    const grid = page.locator(
      "#containerDiv table[role='grid']:not(#te_formData table[role='grid'])",
    );
    await page.locator("#SocialCalc-replaceallbutton").focus();
    await page.keyboard.press("Tab");
    await expect(grid).toBeFocused();

    const result = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) throw new Error("grid did not receive keyboard focus");
      const style = getComputedStyle(el);
      return {
        focused: true,
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
      };
    });

    expect(result.focused).toBe(true);
    expect(result.outlineStyle).not.toBe("none");
    // Confirms the CSS rule actually fired (not just some other UA
    // default): the color matches the #1a73e8 defined in socialcalc.css.
    expect(result.outlineColor).toBe("rgb(26, 115, 232)");
  });
});

test.describe("print setup and @media print CSS", () => {
  test("the Print tab's fields save undo-able printarea/orientation/scale sheet attributes", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await page.evaluate(() => {
      const s = window.__scControls["SocialCalc-"];
      const areaEle = document.getElementById("SocialCalc-print-area") as HTMLInputElement;
      const scaleEle = document.getElementById("SocialCalc-print-scale") as HTMLInputElement;
      areaEle.value = "A1:C10";
      scaleEle.value = "75";
      window.SocialCalc.ApplyPrintSetup();
      void s;
    });

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.attribs.printarea === "A1:C10",
      "SocialCalc-",
    );
    expect(
      await page.evaluate(() => window.__scControls["SocialCalc-"].sheet.attribs.printscale),
    ).toBe(75);

    // Undo restores the prior (unset) print attributes through the normal
    // undo stack -- proves print setup didn't bypass undo/redo.
    await page.evaluate(() => window.__scControls["SocialCalc-"].editor.SheetUndo());
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.attribs.printscale === undefined,
      "SocialCalc-",
    );
  });

  test("Chromium's print media emulation applies @media print rules: editor chrome is hidden, the grid is visible", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "print-media visibility is a Chromium emulation contract",
    );
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set A1 value n 1");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 1,
      "SocialCalc-",
    );
    // Root cause (confirmed from CI trace, candidate-4 run 29841204430):
    // EditorRenderSheet (line 1114 of socialcalctableeditor.ts) wholesale-
    // overwrites fullgrid.className = "te_download" on every render, wiping
    // any sc-print-area stamp. ScheduleRender fires a 1ms setTimeout after
    // the data write, so the original test raced: PreparePrintArea stamped
    // sc-print-area, then DoRenderStep ran and reset the class to "te_download",
    // and every subsequent toHaveCSS poll saw a permanently-hidden grid.
    //
    // Fix: wait for editor.timeout===null && !editor.busy to confirm the render
    // pipeline is idle (no pending ScheduleRender timeouts) before calling
    // PreparePrintArea. Then call PreparePrintArea (once, outside any retry
    // loop) and emulateMedia("print") as separate steps — emulateMedia is a
    // CDP call, not part of the evaluate, so a render can still interleave;
    // Finally, poll both the structural precondition (sc-print-area class present
    // on the live grid node) and the cascade signal (@media print active, body
    // visibility hidden) before asserting the grid is visible — this makes any
    // future recurrence diagnosable at the poll rather than 5s later on CSS.
    //
    // Product-level note: any re-render fired after PreparePrintArea (e.g. from
    // a deferred command or user interaction) will silently destroy the print
    // area class — TriggerPrint itself is safe only because window.print() is
    // called synchronously in the same tick as PreparePrintArea.
    await waitFor(
      page,
      (idPrefix) => {
        const ed = window.__scControls[idPrefix]?.editor;
        if (!ed || !("timeout" in ed) || !("busy" in ed)) return false;
        return (
          (ed as { timeout: unknown; busy: unknown }).timeout === null &&
          !(ed as { timeout: unknown; busy: unknown }).busy
        );
      },
      "SocialCalc-",
    );

    // Apply PreparePrintArea, then switch to print media. emulateMedia is a
    // separate CDP call — a DoRenderStep setTimeout can still interleave and
    // reset fullgrid.className to "te_download" between them. The expect.poll
    // below is what actually catches that; it is the deterministic guard, not
    // this call sequence.
    await page.evaluate(() => {
      window.SocialCalc.PreparePrintArea(window.__scControls["SocialCalc-"]);
    });
    await page.emulateMedia({ media: "print" });

    // Poll both observable preconditions before asserting visibility:
    // (a) sc-print-area is on the live fullgrid node — confirms PreparePrintArea
    //     stuck and no render fired afterward to reset className; and
    // (b) @media print cascade is active — the undo button (a `body *` child
    //     outside .sc-print-area) has computed visibility "hidden", confirming
    //     the `body * { visibility: hidden }` print rule fired. Note: body itself
    //     has no visibility rule; only its children are hidden.
    // If either precondition is absent the poll retries, making the failure mode
    // ("class lost" vs "@media not active") directly visible in the assertion message.
    const grid = page.locator("#containerDiv table[role='grid']").first();
    await expect
      .poll(
        async () => {
          const [hasClass, printCascadeActive] = await page.evaluate(() => {
            const g = document.querySelector("#containerDiv table[role='grid']");
            const undoBtn = document.getElementById("SocialCalc-button_undo");
            // body * { visibility: hidden } under @media print — undo button is
            // outside .sc-print-area so it must be hidden when print is active.
            const undoVis = undoBtn ? getComputedStyle(undoBtn).visibility : "visible";
            return [g?.classList.contains("sc-print-area") ?? false, undoVis === "hidden"] as const;
          });
          return { hasClass, printCascadeActive };
        },
        {
          message:
            "sc-print-area class must persist on grid and @media print cascade must be active",
          timeout: 5000,
        },
      )
      .toEqual({ hasClass: true, printCascadeActive: true });

    // The print stylesheet deliberately restores visibility on the grid and
    // its descendants while their editor-layout ancestors remain hidden.
    // Assert the CSS contract directly: Playwright's actionability visibility
    // treats a hidden layout ancestor as hidden even though the printed grid
    // itself is explicitly visible.
    await expect(grid).toHaveCSS("visibility", "visible");
    await expect(cellLocator(page, "A1")).toHaveCSS("visibility", "visible");

    // Editor chrome (the Undo toolbar button) is outside .sc-print-area and
    // must be hidden by the `body * { visibility: hidden }` print rule.
    const undoButton = page.locator("#SocialCalc-button_undo");
    await expect(undoButton).toBeHidden();

    await page.emulateMedia({ media: "screen" });
  });

  test("a configured printarea hides out-of-range cells only under print media", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set D4 value n 2");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.D4?.datavalue === 2,
      "SocialCalc-",
    );
    await scheduleCommand(page, "set sheet printarea A1:B2");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.attribs.printarea === "A1:B2",
      "SocialCalc-",
    );
    await waitFor(
      page,
      () => document.querySelector("#containerDiv #cell_D4") != null,
      "SocialCalc-",
    );

    await page.evaluate(() => {
      window.SocialCalc.PreparePrintArea(window.__scControls["SocialCalc-"]);
    });

    await waitFor(
      page,
      () =>
        document.querySelector("#containerDiv #cell_D4")?.className.includes("sc-print-hide") ===
        true,
      "SocialCalc-",
    );

    const d4 = cellLocator(page, "D4");
    const d4Class = await d4.getAttribute("class");
    expect(d4Class).toContain("sc-print-hide");

    await page.emulateMedia({ media: "print" });
    await expect(d4).toBeHidden();

    const a1 = cellLocator(page, "A1");
    await expect(a1).toBeVisible();

    await page.emulateMedia({ media: "screen" });
  });

  test("TriggerPrint emits an @page rule reflecting orientation, margins, and scale", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set sheet printorientation landscape");
    await scheduleCommand(page, "set sheet printscale 50");
    await scheduleCommand(page, "set sheet printmargins 0.5in");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.attribs.printmargins === "0.5in",
      "SocialCalc-",
    );

    // window.print() itself is stubbed (Chromium has no real print dialog in
    // headless mode) -- but TriggerPrint's own DOM/CSS side effects
    // (PreparePrintArea + the injected @page rule) are real and asserted.
    await page.evaluate(() => {
      window.print = () => {
        window.__printInvoked = true;
      };
    });

    await page.evaluate(() => window.SocialCalc.TriggerPrint());

    expect(await page.evaluate(() => window.__printInvoked)).toBe(true);

    const pageStyleText = await page.locator("#sc-print-page-style").textContent();
    expect(pageStyleText).toContain("landscape");
    expect(pageStyleText).toContain("0.5in");
    expect(pageStyleText).toContain("zoom: 0.5");
  });

  test("TriggerPrint only calls window.print() from a real user click, never automatically on page load", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await page.evaluate(() => {
      window.__printInvoked = false;
      window.print = () => {
        window.__printInvoked = true;
      };
    });
    await createControl(page);
    await scheduleCommand(page, "set A1 value n 1");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 1,
      "SocialCalc-",
    );

    // No print trigger has been clicked yet -- confirms nothing in
    // initialization/render/recalc calls window.print() implicitly.
    expect(await page.evaluate(() => window.__printInvoked)).toBe(false);

    const printButton = page.locator("#SocialCalc-print-now");
    await page.click("#SocialCalc-printtab");
    await expect(printButton).toBeVisible();
    await printButton.click();
    await waitFor(page, () => window.__printInvoked === true, "SocialCalc-");
    expect(await page.evaluate(() => window.__printInvoked)).toBe(true);
  });
});

declare global {
  interface Window {
    __printInvoked?: boolean;
  }
}
