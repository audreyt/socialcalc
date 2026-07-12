// Real-browser coverage of the built `dist/SocialCalc.js` UMD bundle:
// initialize/destroy, real click+keyboard cell editing, command/recalc,
// copy/paste/fill, insert/delete/undo, save/reload, and a popup + keyboard
// smoke test. Runs once against the normal bundle; `bundle-parity.spec.ts`
// re-runs a small subset against the minified bundle so both artifacts are
// exercised without duplicating this whole suite.

import {
  cellLocator,
  cellValue,
  clickCell,
  createControl,
  expect,
  gotoBundle,
  scheduleCommand,
  test,
  typeAndCommit,
  waitFor,
} from "./fixtures/editor";

test.describe("editor initialize / destroy", () => {
  test("InitializeSpreadsheetControl renders a working grid, and the container can be torn down and rebuilt", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await expect(cellLocator(page, "A1")).toBeVisible();
    await expect(page.locator("#SocialCalc-button_undo")).toBeVisible();

    // Destroy: SocialCalc exposes no explicit teardown API (grep-verified),
    // so the realistic host-app pattern is emptying the container.
    await page.evaluate(() => {
      const el = document.getElementById("containerDiv");
      if (el) el.innerHTML = "";
    });
    await expect(page.locator("#cell_A1")).toHaveCount(0);

    // Rebuild in a fresh container with a distinct idPrefix, proving the
    // bundle tolerates a destroy/recreate cycle on the same page.
    await page.evaluate(() => {
      const div = document.createElement("div");
      div.id = "containerDiv2";
      document.body.appendChild(div);
    });
    await createControl(page, { containerId: "containerDiv2", idPrefix: "SC2-" });
    await expect(cellLocator(page, "A1", "#containerDiv2")).toBeVisible();
  });
});

test.describe("cell edit / command / recalc", () => {
  test("real click + keyboard typing edits a cell and drives formula recalculation", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "A1");
    await typeAndCommit(page, "10");
    await clickCell(page, "B1");
    await typeAndCommit(page, "=A1*3");

    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue === 30, "SocialCalc-");
    expect(await cellValue(page, "A1")).toBe(10);
    expect(await cellValue(page, "B1")).toBe(30);
    await expect(cellLocator(page, "B1")).toHaveText("30");

    // Editing the precedent recalculates the dependent formula cell.
    await clickCell(page, "A1");
    await typeAndCommit(page, "20");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.B1?.datavalue === 60, "SocialCalc-");
    expect(await cellValue(page, "B1")).toBe(60);
  });

  test("EditorScheduleSheetCommands drives the same command pipeline the toolbar uses", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 7");
    await scheduleCommand(page, "set A2 formula A1*A1");
    await scheduleCommand(page, "recalc");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.A2?.datavalue === 49, "SocialCalc-");
    expect(await cellValue(page, "A2")).toBe(49);
  });
});

test.describe("copy / paste / fill", () => {
  test("copy then paste tiles a cell's value+formula into a new range", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 5");
    await scheduleCommand(page, "copy A1:A1");
    await scheduleCommand(page, "paste C3:C3 all");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.C3?.datavalue === 5, "SocialCalc-");
    expect(await cellValue(page, "C3")).toBe(5);
  });

  test("filldown extrapolates a numeric series down a column", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set B1 value n 1");
    await scheduleCommand(page, "set B2 value n 2");
    await scheduleCommand(page, "filldown B1:B5 all");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.B5?.datavalue === 5, "SocialCalc-");
    expect(await cellValue(page, "B3")).toBe(3);
    expect(await cellValue(page, "B5")).toBe(5);
  });
});

test.describe("insert / delete / undo", () => {
  test("insertrow shifts existing data down and SheetUndo/SheetRedo restore it", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 text t Original");
    await scheduleCommand(page, "insertrow 1");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.A2?.datavalue === "Original", "SocialCalc-");
    expect(await cellValue(page, "A1")).toBe("");
    expect(await cellValue(page, "A2")).toBe("Original");

    await page.evaluate((idPrefix) => window.__scControls[idPrefix].editor.SheetUndo(), "SocialCalc-");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "Original", "SocialCalc-");
    expect(await cellValue(page, "A2")).toBeUndefined();

    await page.evaluate((idPrefix) => window.__scControls[idPrefix].editor.SheetRedo(), "SocialCalc-");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.A2?.datavalue === "Original", "SocialCalc-");
    expect(await cellValue(page, "A1")).toBe("");
  });

  test("deletecol removes a column's contents and shifts the remainder left", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await scheduleCommand(page, "set A1 value n 1");
    await scheduleCommand(page, "set B1 value n 2");
    await scheduleCommand(page, "deletecol A");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 2, "SocialCalc-");
    expect(await cellValue(page, "A1")).toBe(2);
  });
});

test.describe("save / reload", () => {
  test("CreateSpreadsheetSave/DecodeSpreadsheetSave round-trips into a freshly initialized control", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page, { idPrefix: "SC1-" });

    await scheduleCommand(page, "set A1 value n 42", "SC1-");
    await scheduleCommand(page, "set A2 text t Saved", "SC1-");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 42 && window.__scControls[idPrefix].sheet.cells.A2?.datavalue === "Saved", "SC1-");

    const save = await page.evaluate((idPrefix) => window.__scControls[idPrefix].CreateSpreadsheetSave(), "SC1-");
    expect(save).toContain("socialcalc:version:1.0");

    // Simulate a page reload: tear down the old control, build a new one
    // (fresh container, fresh idPrefix), and load the saved sheet part.
    await page.evaluate(() => {
      const old = document.getElementById("containerDiv");
      if (old) old.innerHTML = "";
      const div = document.createElement("div");
      div.id = "containerDiv2";
      document.body.appendChild(div);
    });
    await createControl(page, { containerId: "containerDiv2", idPrefix: "SC2-" });

    const loaded = await page.evaluate(
      ({ save, idPrefix }) => {
        const control = window.__scControls[idPrefix];
        const parts = control.DecodeSpreadsheetSave(save);
        const sheetPart = parts.sheet;
        if (!sheetPart) throw new Error("save string had no sheet part");
        control.ParseSheetSave(save.substring(sheetPart.start, sheetPart.end));
        return { a1: control.sheet.cells.A1?.datavalue, a2: control.sheet.cells.A2?.datavalue };
      },
      { save, idPrefix: "SC2-" },
    );
    expect(loaded).toEqual({ a1: 42, a2: "Saved" });
  });
});

test.describe("popup / keyboard smoke", () => {
  test("multi-line input popup opens, accepts typed text, and commits to the selected cell", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await page.click("#SocialCalc-multilineinput");
    const dialog = page.locator("#SocialCalc-multilinedialog");
    await expect(dialog).toBeVisible();

    await page.fill("#SocialCalc-multilinetextarea", "line one\nline two");
    await page.click('input[value="Set Cell Contents"]');
    await expect(dialog).toHaveCount(0);

    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "line one\nline two", "SocialCalc-");
    expect(await cellValue(page, "A1")).toBe("line one\nline two");
  });

  test("arrow keys move the active cell after a real click sets keyboard focus", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await clickCell(page, "B2");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].editor.ecell.coord === "B2", "SocialCalc-", 8000);

    await page.keyboard.press("ArrowDown");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].editor.ecell.coord === "B3", "SocialCalc-");
    await page.keyboard.press("ArrowRight");
    await waitFor(page, (idPrefix) => window.__scControls[idPrefix].editor.ecell.coord === "C3", "SocialCalc-");
    expect(await page.evaluate(() => window.__scControl.editor.ecell.coord)).toBe("C3");
  });
});
