// Real-browser coverage of the optional SpreadsheetControl workbook mode:
// accessible sheet tabs, add/switch/rename/delete via the tab-bar
// affordances, keyboard navigation (WAI-ARIA Tabs pattern), and the
// invariant that a control never in workbook mode is completely unaffected.
//
// window.prompt (rename) and window.confirm (default delete) are stubbed via
// page.addInitScript BEFORE the bundle loads: the shared `issues` fixture in
// fixtures/editor.ts auto-fails any spec that raises a real native dialog,
// so exercising those flows here means intercepting them at the source
// rather than letting Playwright's default auto-dismiss trip that guard.
//
// Workbook mode types are not part of fixtures/editor.ts's `declare global
// Window.SocialCalc` (that ambient shape is shared across every e2e spec).
// Rather than widen that shared global merge, every `page.evaluate` callback
// below casts `window` to this file-local `WorkbookWindow` — the "well-known
// runtime shape the compiler can't unify with a shared ambient global"
// exception (AGENTS.md-adjacent project convention: unchecked cast, one-line
// reason, assigned to a named type, never for untrusted external input).

import { createControl, expect, gotoBundle, test, waitFor } from "./fixtures/editor";
import type { Page } from "@playwright/test";

interface WorkbookSheet {
  cells: Record<string, { datavalue: unknown } | undefined>;
  GetAssuredCell(coord: string): { datatype: string; datavalue: unknown; valuetype: string };
}

interface Workbook {
  sheetOrder: string[];
  activeSheetName: string | null;
  AddSheet(name: string): number;
  GetSheet(name: string): WorkbookSheet;
  HideSheet(name: string): boolean;
}

interface WorkbookSpreadsheetControl {
  IsWorkbookMode(): boolean;
  RenderSheetTabs(): void;
  EnableWorkbookMode(workbook: Workbook): void;
  workbookState?: { workbook: Workbook };
  sheet: WorkbookSheet;
}

interface WorkbookWindow {
  SocialCalc: { Workbook: new () => Workbook };
  __scControls: Record<string, WorkbookSpreadsheetControl>;
}

/** Stub window.prompt/confirm to return `promptValue`/`confirmValue` without ever opening a real dialog. */
async function stubDialogs(
  page: Page,
  promptValue: string | null,
  confirmValue: boolean,
): Promise<void> {
  await page.addInitScript(
    ({ promptValue, confirmValue }) => {
      window.prompt = () => promptValue;
      window.confirm = () => confirmValue;
    },
    { promptValue, confirmValue },
  );
}

async function createWorkbookControl(
  page: Page,
  sheetNames: string[],
  idPrefix = "SocialCalc-",
): Promise<void> {
  await createControl(page, { idPrefix });
  await page.evaluate(
    ({ sheetNames, idPrefix }) => {
      const win = window as unknown as WorkbookWindow;
      const control = win.__scControls[idPrefix]!;
      const wb = new win.SocialCalc.Workbook();
      for (const name of sheetNames) {
        wb.AddSheet(name);
      }
      control.EnableWorkbookMode(wb);
    },
    { sheetNames, idPrefix },
  );
}

test.describe("workbook mode: tab bar rendering and accessibility", () => {
  test("EnableWorkbookMode renders an accessible role=tablist strip with one tab per visible sheet plus an add button", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["First", "Second", "Third"]);

    const tabBar = page.locator("#SocialCalc-workbooktabs");
    await expect(tabBar).toBeVisible();
    await expect(tabBar).toHaveAttribute("role", "tablist");
    await expect(tabBar).toHaveAttribute("aria-label", "Sheets");

    const tab1 = page.locator("#SocialCalc-sheettab-First");
    const tab2 = page.locator("#SocialCalc-sheettab-Second");
    const tab3 = page.locator("#SocialCalc-sheettab-Third");
    await expect(tab1).toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(tab1).toHaveAttribute("role", "tab");
    await expect(tab1).toHaveText("First");

    // First sheet is active by default: aria-selected + in the natural Tab
    // order (tabindex=0); the rest are aria-selected=false and out of the
    // Tab order (roving tabindex, WAI-ARIA Tabs pattern).
    await expect(tab1).toHaveAttribute("aria-selected", "true");
    await expect(tab1).toHaveAttribute("tabindex", "0");
    await expect(tab2).toHaveAttribute("aria-selected", "false");
    await expect(tab2).toHaveAttribute("tabindex", "-1");

    const addButton = page.locator("#SocialCalc-sheettab-add");
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveAttribute("aria-label", "Add sheet");
  });

  test("a hidden sheet has no rendered tab", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["Visible", "Hidden"]);

    await page.evaluate((idPrefix) => {
      const win = window as unknown as WorkbookWindow;
      const control = win.__scControls[idPrefix]!;
      control.workbookState!.workbook.HideSheet("Hidden");
      control.RenderSheetTabs();
    }, "SocialCalc-");

    await expect(page.locator("#SocialCalc-sheettab-Visible")).toBeVisible();
    await expect(page.locator("#SocialCalc-sheettab-Hidden")).toHaveCount(0);
  });

  test("a control never put into workbook mode never renders a tab bar", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await expect(page.locator("#SocialCalc-workbooktabs")).toHaveCount(0);
    const isWorkbookMode = await page.evaluate(
      (idPrefix) => (window as unknown as WorkbookWindow).__scControls[idPrefix]!.IsWorkbookMode(),
      "SocialCalc-",
    );
    expect(isWorkbookMode).toBe(false);
  });
});

test.describe("workbook mode: real click switches the active sheet", () => {
  test("clicking a tab switches the rendered sheet and updates the grid to that sheet's data", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["Alpha", "Beta"]);

    await page.evaluate((idPrefix) => {
      const win = window as unknown as WorkbookWindow;
      const wb = win.__scControls[idPrefix]!.workbookState!.workbook;
      const betaSheet = wb.GetSheet("Beta");
      const cell = betaSheet.GetAssuredCell("A1");
      cell.datatype = "v";
      cell.datavalue = 42;
      cell.valuetype = "n";
    }, "SocialCalc-");

    await page.locator("#SocialCalc-sheettab-Beta").click();

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 42,
      "SocialCalc-",
    );

    const activeSheetName = await page.evaluate(
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .activeSheetName,
      "SocialCalc-",
    );
    expect(activeSheetName).toBe("Beta");
    await expect(page.locator("#SocialCalc-sheettab-Beta")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("#SocialCalc-sheettab-Alpha")).toHaveAttribute(
      "aria-selected",
      "false",
    );

    // The grid itself now shows Beta's data (real DOM assertion, not just
    // internal state) — A1's rendered cell reflects the value we set on
    // the Beta sheet object above.
    await expect(page.locator("#cell_A1").first()).toHaveText("42");
  });

  test("switching sheets and typing edits the correct (currently active) sheet's data, not the previous one", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["SheetA", "SheetB"]);

    await page.locator("#SocialCalc-sheettab-SheetB").click();
    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .activeSheetName === "SheetB",
      "SocialCalc-",
    );

    await page.locator("#cell_A1").first().click();
    await page.keyboard.type("99");
    await page.keyboard.press("Enter");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 99,
      "SocialCalc-",
    );

    const sheetAValue = await page.evaluate((idPrefix) => {
      const win = window as unknown as WorkbookWindow;
      const wb = win.__scControls[idPrefix]!.workbookState!.workbook;
      return wb.GetSheet("SheetA").cells.A1?.datavalue;
    }, "SocialCalc-");
    // SheetA's A1 must remain untouched — the edit landed only on SheetB.
    expect(sheetAValue).toBeUndefined();
  });
});

test.describe("workbook mode: keyboard navigation (WAI-ARIA Tabs pattern)", () => {
  test("ArrowRight/ArrowLeft move focus between tabs without activating them; Enter activates the focused tab", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["One", "Two", "Three"]);

    const tab1 = page.locator("#SocialCalc-sheettab-One");
    await tab1.focus();
    await expect(tab1).toBeFocused();

    await page.keyboard.press("ArrowRight");
    const tab2 = page.locator("#SocialCalc-sheettab-Two");
    await expect(tab2).toBeFocused();

    // Focus moved but the active sheet has NOT changed yet (pure
    // navigation is non-destructive — matches the WAI-ARIA Tabs pattern).
    let activeSheetName = await page.evaluate(
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .activeSheetName,
      "SocialCalc-",
    );
    expect(activeSheetName).toBe("One");

    await page.keyboard.press("Enter");
    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .activeSheetName === "Two",
      "SocialCalc-",
    );
    activeSheetName = await page.evaluate(
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .activeSheetName,
      "SocialCalc-",
    );
    expect(activeSheetName).toBe("Two");
  });

  test("Home/End move focus to the first/last tab", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["One", "Two", "Three"]);

    const tab1 = page.locator("#SocialCalc-sheettab-One");
    await tab1.focus();

    await page.keyboard.press("End");
    await expect(page.locator("#SocialCalc-sheettab-Three")).toBeFocused();

    await page.keyboard.press("Home");
    await expect(page.locator("#SocialCalc-sheettab-One")).toBeFocused();
  });
});

test.describe("workbook mode: add/rename/delete via tab-bar affordances", () => {
  test("clicking the add button creates and switches to a new uniquely-named sheet", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["Sheet1"]);

    await page.locator("#SocialCalc-sheettab-add").click();

    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .sheetOrder.length === 2,
      "SocialCalc-",
    );

    const [names, activeSheetName] = await page.evaluate((idPrefix) => {
      const win = window as unknown as WorkbookWindow;
      const wb = win.__scControls[idPrefix]!.workbookState!.workbook;
      return [wb.sheetOrder, wb.activeSheetName] as const;
    }, "SocialCalc-");
    expect(names.length).toBe(2);
    expect(activeSheetName).toBe(names[1]);
    // The tab bar rendered a real DOM tab for the newly added sheet.
    await expect(page.locator(`#SocialCalc-sheettab-${names[1]}`)).toBeVisible();
  });

  test("double-clicking a tab renames it via the stubbed prompt, without raising a real dialog", async ({
    page,
  }) => {
    await stubDialogs(page, "Renamed", true);
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["Original"]);

    await page.locator("#SocialCalc-sheettab-Original").dblclick();

    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .sheetOrder[0] === "Renamed",
      "SocialCalc-",
    );
    await expect(page.locator("#SocialCalc-sheettab-Renamed")).toBeVisible();
    await expect(page.locator("#SocialCalc-sheettab-Original")).toHaveCount(0);
  });

  test("right-clicking a tab invokes the default confirm-driven delete, without raising a real dialog", async ({
    page,
  }) => {
    await stubDialogs(page, null, true);
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["KeepMe", "DeleteMe"]);

    await page.locator("#SocialCalc-sheettab-DeleteMe").click({ button: "right" });

    await waitFor(
      page,
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .sheetOrder.length === 1,
      "SocialCalc-",
    );
    const names = await page.evaluate(
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .sheetOrder,
      "SocialCalc-",
    );
    expect(names).toEqual(["KeepMe"]);
    await expect(page.locator("#SocialCalc-sheettab-DeleteMe")).toHaveCount(0);
  });

  test("declining the delete confirm leaves every sheet intact", async ({ page }) => {
    await stubDialogs(page, null, false);
    await gotoBundle(page, "normal");
    await createWorkbookControl(page, ["KeepMe", "AlsoKeepMe"]);

    await page.locator("#SocialCalc-sheettab-AlsoKeepMe").click({ button: "right" });

    // Give any (incorrect) delete a moment to have happened, then assert
    // nothing changed.
    await page.waitForTimeout(200);
    const names = await page.evaluate(
      (idPrefix) =>
        (window as unknown as WorkbookWindow).__scControls[idPrefix]!.workbookState!.workbook
          .sheetOrder,
      "SocialCalc-",
    );
    expect(names).toEqual(["KeepMe", "AlsoKeepMe"]);
  });
});
