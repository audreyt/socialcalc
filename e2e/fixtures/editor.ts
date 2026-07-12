// Shared Playwright fixtures and SpreadsheetControl helpers for the
// real-browser suite. Not part of `vp test` / Vitest; exercised only via
// Playwright against the built UMD bundles served by ../server.ts.
//
// `test` here auto-fails a spec on any uncaught page error (which also
// covers unhandled promise rejections — Chromium reports both through the
// same `pageerror` event), any `console.error` message, or any native
// dialog (`alert`/`confirm`/`prompt`) the page raises without an explicit
// expectation. Every spec file must import `test`/`expect` from this module
// instead of `@playwright/test` directly.

import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

export type BundleName = "normal" | "minified";

export const BUNDLE_PATHS: Record<BundleName, string> = {
  normal: "/normal.html",
  minified: "/minified.html",
};

interface PageIssues {
  consoleErrors: string[];
  dialogs: string[];
  pageErrors: string[];
}

export const test = base.extend<{ issues: PageIssues }>({
  // `auto: true` makes this fixture apply to every test that imports `test`
  // from this module — not something an individual spec can opt out of by
  // omitting `issues` from its parameter list.
  issues: [
    async ({ page }, use) => {
      const issues: PageIssues = { consoleErrors: [], dialogs: [], pageErrors: [] };

      page.on("pageerror", (error) => issues.pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") issues.consoleErrors.push(message.text());
      });
      page.on("dialog", (dialog) => {
        issues.dialogs.push(`${dialog.type()}: ${dialog.message()}`);
        void dialog.dismiss();
      });
      // Belt-and-suspenders: Playwright's `pageerror` is documented to cover
      // unhandled promise rejections too, but bridging `unhandledrejection`
      // into a `console.error` removes any cross-browser doubt (webkit/
      // firefox event-plumbing differences) instead of relying on that
      // documented behavior alone.
      await page.addInitScript(() => {
        window.addEventListener("unhandledrejection", (event) => {
          const reason = event.reason as unknown;
          const message = reason instanceof Error ? reason.message : String(reason);
          console.error(`unhandled promise rejection: ${message}`);
        });
      });

      await use(issues);

      expect(issues.pageErrors, "uncaught page errors").toEqual([]);
      expect(issues.consoleErrors, "console.error messages (includes unhandled promise rejections)").toEqual([]);
      expect(issues.dialogs, "unexpected native dialogs (alert/confirm/prompt)").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Navigate to the fixture page that loads the requested UMD bundle. */
export async function gotoBundle(page: Page, bundle: BundleName): Promise<void> {
  await page.goto(BUNDLE_PATHS[bundle]);
}

/**
 * Construct a real `SocialCalc.SpreadsheetControl` in `containerId` and
 * park it (plus its editor) on `window` under `idPrefix`-scoped names so
 * later `page.evaluate` calls can reach it. Schedules a no-op `recalc`
 * command as a warm-up: the very first render after
 * `InitializeSpreadsheetControl` leaves a duplicate, not-yet-positioned
 * scroll pane in the DOM, and real (non-synthetic-friendly) mouse clicks on
 * any cell outside the initial viewport silently no-op — `GridMousePosition`
 * resolves against stale pane geometry — until one command/edit cycle
 * renders the sheet again. This is a real, reproducible characteristic of
 * `InitializeSpreadsheetControl`, not a Playwright limitation; every test
 * that later clicks a cell relies on this warm-up having already run.
 */
export async function createControl(
  page: Page,
  options: { containerId?: string; idPrefix?: string } = {},
): Promise<string> {
  const { containerId = "containerDiv", idPrefix = "SocialCalc-" } = options;
  await page.evaluate(
    ({ containerId, idPrefix }) => {
      const control = new window.SocialCalc.SpreadsheetControl(idPrefix);
      const container = document.getElementById(containerId);
      if (!container) throw new Error(`missing container #${containerId}`);
      control.InitializeSpreadsheetControl(container, 400, 700, 0);
      window.SocialCalc.SetSpreadsheetControlObject(control);
      window.__scControls ??= {};
      window.__scControls[idPrefix] = control;
      window.__scControl = control;
      window.__scEditor = control.editor;
    },
    { containerId, idPrefix },
  );
  await page.evaluate(
    (idPrefix) => window.__scControls[idPrefix].editor.EditorScheduleSheetCommands("recalc", true),
    idPrefix,
  );
  await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.attribs.needsrecalc !== "yes", idPrefix);
  return idPrefix;
}

/** Poll `predicate` (evaluated in-page) until truthy or `timeoutMs` elapses. */
export async function waitFor(
  page: Page,
  predicate: (idPrefix: string) => unknown,
  idPrefix: string,
  timeoutMs = 4000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await page.evaluate(predicate, idPrefix)) return;
    if (Date.now() > deadline) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await page.waitForTimeout(25);
  }
}

/**
 * Real DOM click on the rendered `<td>` for `coord` (via `cellLocator`,
 * Playwright's own actionability-checked click), verified by polling
 * `editor.ecell.coord` and retrying if it hasn't moved.
 *
 * A click landing right after page load or right after a prior
 * `typeAndCommit`/command commit can silently no-op: the very first render
 * after `InitializeSpreadsheetControl` leaves a duplicate, not-yet-
 * positioned scroll pane in the DOM, and `GridMousePosition` can briefly
 * resolve against stale pane geometry. This is a real, reproducible
 * characteristic of the control's rendering pipeline, not a Playwright
 * limitation — retrying the whole click+verify cycle drives it like a real
 * user would, without asserting anything about *why* a given attempt
 * no-opped.
 */
export async function clickCell(page: Page, coord: string, idPrefix = "SocialCalc-"): Promise<void> {
  const locator = cellLocator(page, coord);
  const deadline = Date.now() + 8000;
  for (;;) {
    await locator.click({ timeout: 8000 });
    const moved = await page.evaluate(
      ({ coord, idPrefix }) => window.__scControls[idPrefix].editor.ecell.coord === coord,
      { coord, idPrefix },
    );
    if (moved) return;
    if (Date.now() > deadline) throw new Error(`click on ${coord} never moved the active cell there`);
    await page.waitForTimeout(25);
  }
}

/**
 * Locator for the rendered `<td>` for `coord`, scoped to `containerSelector`
 * and narrowed to the first match. `InitializeSpreadsheetControl` renders a
 * second, not-yet-visible scroll pane sharing the same unprefixed
 * `cell_<coord>` ids as the live one (real, reproducible characteristic of
 * the control, not a test artifact), so an unscoped `page.locator("#cell_A1")`
 * hits Playwright's strict-mode duplicate-match check.
 */
export function cellLocator(page: Page, coord: string, containerSelector = "#containerDiv") {
  return page.locator(containerSelector).locator(`#cell_${coord}`).first();
}

/** Type real keyboard input into the currently selected cell, then commit with Enter. */
export async function typeAndCommit(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

/** Schedule a sheet command string through the real editor command pipeline. */
export async function scheduleCommand(page: Page, cmd: string, idPrefix = "SocialCalc-"): Promise<void> {
  await page.evaluate(
    ({ cmd, idPrefix }) => window.__scControls[idPrefix].editor.EditorScheduleSheetCommands(cmd, true),
    { cmd, idPrefix },
  );
}

/** Read a cell's computed value after recalculation settles. */
export async function cellValue(page: Page, coord: string, idPrefix = "SocialCalc-"): Promise<unknown> {
  return page.evaluate(
    ({ coord, idPrefix }) => window.__scControls[idPrefix].sheet.cells[coord]?.datavalue,
    { coord, idPrefix },
  );
}

declare global {
  interface Window {
    SocialCalc: {
      coordToCr(coord: string): { col: number; row: number };
      GetEditorCellElement(
        editor: unknown,
        row: number,
        col: number,
      ): { element: HTMLElement } | null;
      SetSpreadsheetControlObject(control: unknown): void;
      SpreadsheetControl: new (idPrefix?: string) => {
        editor: {
          EditorScheduleSheetCommands(cmd: string, saveundo: boolean): void;
          ecell: { coord: string };
          SheetRedo(): void;
          SheetUndo(): void;
        };
        CreateSheetSave(): string;
        CreateSpreadsheetSave(): string;
        DecodeSpreadsheetSave(str: string): Record<string, { end: number; start: number }>;
        InitializeSpreadsheetControl(
          node: HTMLElement,
          height?: number,
          width?: number,
          spacebelow?: number,
        ): void;
        ParseSheetSave(str: string): void;
        sheet: {
          attribs: { needsrecalc: string };
          cells: Record<string, { datavalue: unknown; formula: string } | undefined>;
        };
      };
    };
    __scControl: InstanceType<Window["SocialCalc"]["SpreadsheetControl"]>;
    __scControls: Record<string, InstanceType<Window["SocialCalc"]["SpreadsheetControl"]>>;
    __scEditor: InstanceType<Window["SocialCalc"]["SpreadsheetControl"]>["editor"];
  }
}
