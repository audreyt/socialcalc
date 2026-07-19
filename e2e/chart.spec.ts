// Real-browser coverage of the chart editor UI (js/chart.ts's "9. Editor UI"
// section): overlay mount/auto-refresh on command/recalc, drag-move,
// resize handle, delete button, and the create/edit dialog form. Unit
// tests (test/chart-*.test.ts) cover the pure model/save/render/command
// contract in the fake DOM; this spec exercises only what a real browser
// provides that the fake DOM cannot: real click/mousedown/mousemove/mouseup
// dispatch, getBoundingClientRect-based positioning, and real DOM overlay
// attachment/removal.

import {
  createControl,
  expect,
  gotoBundle,
  scheduleCommand,
  test,
  waitFor,
} from "./fixtures/editor";

declare global {
  interface Window {
    __xssFired?: boolean;
  }
}

// Chart mode types are not part of fixtures/editor.ts's `declare global
// Window.SocialCalc` (that ambient shape is shared across every e2e spec).
// Rather than widen that shared global merge, every `page.evaluate`/
// `waitFor` callback below casts `window` to this file-local `ChartWindow`
// — same "well-known runtime shape the compiler can't unify with a shared
// ambient global" exception used by workbook-tabs.spec.ts.
interface ChartRecordLike {
  charttype: number;
  title?: string;
  hastitle?: boolean;
  sourceranges: string[];
  anchorcoord: string;
  widthpx: number;
  heightpx: number;
}

interface ChartWindow {
  SocialCalc: {
    Chart: {
      OpenChartDialog(editor: unknown, existingChartId?: string): void;
    };
    encodeForSave(text: string): string;
  };
  __scControls: Record<
    string,
    {
      editor: unknown;
      sheet: { charts: Record<string, ChartRecordLike | undefined> };
    }
  >;
}

test.describe("chart overlay mount / auto-refresh", () => {
  test("chart create renders an SVG overlay, and cell edits refresh it live", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 text t Q1");
    await scheduleCommand(page, "set A2 text t Q2");
    await scheduleCommand(page, "set B1 value n 10");
    await scheduleCommand(page, "set B2 value n 20");
    await scheduleCommand(page, "chart create c1 D1 320 240 0 0 A1:B2");

    const overlay = page.locator('.sc-chart-overlay[data-chart-id="c1"]');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator("svg")).toBeVisible();

    // Auto-refresh: editing a source cell must redraw the chart without any
    // explicit chart command.
    const before = await overlay.locator("svg").innerHTML();
    await scheduleCommand(page, "set B2 value n 99");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.B2?.datavalue === 99,
      "SocialCalc-",
    );
    await page.waitForFunction((beforeHtml) => {
      const el = document.querySelector('.sc-chart-overlay[data-chart-id="c1"] svg');
      return !!el && el.innerHTML !== beforeHtml;
    }, before);
    const after = await overlay.locator("svg").innerHTML();
    expect(after).not.toBe(before);
  });

  test("chart delete removes both the sheet.charts entry and the DOM overlay", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set B1 value n 2");
    await scheduleCommand(page, "chart create c1 D1 320 240 0 0 A1:B1");
    await expect(page.locator('.sc-chart-overlay[data-chart-id="c1"]')).toBeVisible();

    await scheduleCommand(page, "chart delete c1");
    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1 === undefined,
      "SocialCalc-",
    );
    await expect(page.locator('.sc-chart-overlay[data-chart-id="c1"]')).toHaveCount(0);
  });

  test("the delete (x) button on the overlay issues a chart delete command", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set B1 value n 2");
    await scheduleCommand(page, "chart create c1 D1 320 240 0 0 A1:B1");
    await expect(page.locator('.sc-chart-overlay[data-chart-id="c1"]')).toBeVisible();

    await page.locator('.sc-chart-overlay[data-chart-id="c1"] .sc-chart-delete-button').click();
    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1 === undefined,
      "SocialCalc-",
    );
    await expect(page.locator('.sc-chart-overlay[data-chart-id="c1"]')).toHaveCount(0);
  });
});

test.describe("chart drag move / resize", () => {
  test("dragging the move handle issues a chart move command that updates the anchor", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set B1 value n 2");
    await scheduleCommand(page, "chart create c1 A1 320 240 0 0 A1:B1");
    const overlay = page.locator('.sc-chart-overlay[data-chart-id="c1"]');
    await expect(overlay).toBeVisible();
    const startAnchor = await page.evaluate(
      (idPrefix) =>
        (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1!.anchorcoord,
      "SocialCalc-",
    );

    const handle = overlay.locator(".sc-chart-move-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("move handle has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 150, { steps: 5 });
    await page.mouse.up();

    await page.waitForFunction((start) => {
      const win = window as unknown as ChartWindow;
      return win.__scControls["SocialCalc-"]?.sheet.charts.c1?.anchorcoord !== start;
    }, startAnchor);
    const endAnchor = await page.evaluate(
      (idPrefix) =>
        (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1!.anchorcoord,
      "SocialCalc-",
    );
    expect(endAnchor).not.toBe(startAnchor);
  });

  test("dragging the resize handle issues a chart resize command that grows the chart", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set B1 value n 2");
    await scheduleCommand(page, "chart create c1 A1 320 240 0 0 A1:B1");
    const overlay = page.locator('.sc-chart-overlay[data-chart-id="c1"]');
    await expect(overlay).toBeVisible();

    const handle = overlay.locator(".sc-chart-resize-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("resize handle has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 100, { steps: 5 });
    await page.mouse.up();

    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1!.widthpx > 320,
      "SocialCalc-",
      6000,
    );
    const size = await page.evaluate(
      (idPrefix) => ({
        w: (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1!.widthpx,
        h: (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1!.heightpx,
      }),
      "SocialCalc-",
    );
    expect(size.w).toBeGreaterThan(320);
    expect(size.h).toBeGreaterThan(240);
  });
});

test.describe("chart create/edit dialog", () => {
  test("OpenChartDialog builds a real form; submitting it creates a chart via the command pipeline", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 3");
    await scheduleCommand(page, "set B1 value n 6");

    await page.evaluate((idPrefix) => {
      const win = window as unknown as ChartWindow;
      const editor = win.__scControls[idPrefix].editor;
      win.SocialCalc.Chart.OpenChartDialog(editor);
    }, "SocialCalc-");

    const dialog = page.locator(".sc-chart-dialog-overlay");
    await expect(dialog).toBeVisible();

    await dialog.locator('input[type="text"]').first().fill("A1:B1");
    await dialog.locator("select").selectOption("4"); // pie
    await dialog.locator('input[type="button"][value="Create"]').click();

    await waitFor(
      page,
      (idPrefix) =>
        Object.keys((window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts).length >
        0,
      "SocialCalc-",
    );
    const created = await page.evaluate((idPrefix) => {
      const charts = (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts;
      const id = Object.keys(charts)[0]!;
      return charts[id]!;
    }, "SocialCalc-");
    expect(created.charttype).toBe(4);
    expect(created.sourceranges).toEqual(["A1:B1"]);

    // dialog closes itself on submit
    await expect(dialog).toHaveCount(0);
    // and a real overlay now renders the newly created chart
    await expect(page.locator(".sc-chart-overlay")).toBeVisible();
  });

  test("OpenChartDialog editing an existing chart updates it in place via chart set commands", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set B1 value n 2");
    await scheduleCommand(page, "chart create c1 A1 320 240 0 0 A1:B1");
    await expect(page.locator('.sc-chart-overlay[data-chart-id="c1"]')).toBeVisible();

    await page.evaluate((idPrefix) => {
      const win = window as unknown as ChartWindow;
      const editor = win.__scControls[idPrefix].editor;
      win.SocialCalc.Chart.OpenChartDialog(editor, "c1");
    }, "SocialCalc-");

    const dialog = page.locator(".sc-chart-dialog-overlay");
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="text"]').nth(1).fill("Revenue");
    await dialog.locator('input[type="button"][value="Update"]').click();

    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1?.title ===
        "Revenue",
      "SocialCalc-",
    );
    const updated = await page.evaluate(
      (idPrefix) => (window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts.c1!,
      "SocialCalc-",
    );
    expect(updated.title).toBe("Revenue");
    expect(updated.hastitle).toBe(true);
  });

  test("Cancel closes the dialog without creating a chart", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await page.evaluate((idPrefix) => {
      const win = window as unknown as ChartWindow;
      const editor = win.__scControls[idPrefix].editor;
      win.SocialCalc.Chart.OpenChartDialog(editor);
    }, "SocialCalc-");

    const dialog = page.locator(".sc-chart-dialog-overlay");
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="button"][value="Cancel"]').click();
    await expect(dialog).toHaveCount(0);

    const chartCount = await page.evaluate(
      (idPrefix) =>
        Object.keys((window as unknown as ChartWindow).__scControls[idPrefix].sheet.charts).length,
      "SocialCalc-",
    );
    expect(chartCount).toBe(0);
  });
});

test.describe("chart security in a real browser", () => {
  test("a hostile cell label never becomes live markup inside the rendered overlay SVG", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    const encodedLabel = await page.evaluate(() =>
      (window as unknown as ChartWindow).SocialCalc.encodeForSave(
        "</text><script>window.__xssFired = true;</script>",
      ),
    );
    await scheduleCommand(page, "set A1 text t " + encodedLabel);
    await scheduleCommand(page, "set A2 text t normal");
    await scheduleCommand(page, "set B1 value n 1");
    await scheduleCommand(page, "set B2 value n 2");
    await scheduleCommand(page, "chart create c1 D1 320 240 0 0 A1:B2");

    await expect(page.locator('.sc-chart-overlay[data-chart-id="c1"] svg')).toBeVisible();
    const fired = await page.evaluate(() => window.__xssFired);
    expect(fired).toBeUndefined();
    // any active-content assertion at the page level is also enforced by
    // the shared `test` fixture in ./fixtures/editor, which fails the spec
    // on any uncaught page error / console.error a live <script> would cause.
  });
});
