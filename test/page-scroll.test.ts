import { expect, test } from "bun:test";

import { installUiShim } from "./helpers/ui";
import { loadSocialCalc } from "./helpers/socialcalc";

async function newControl(SC: any, containerId = "pg-scroll-root") {
    const container = document.createElement("div");
    container.id = containerId;
    (document as any).body.appendChild(container);
    const control = new SC.SpreadsheetControl();
    control.InitializeSpreadsheetControl(container, 400, 600, 20);
    return { control, container };
}

test("page down/up fall back to pageUpDnAmount when scroll positions are unknown", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC, "pg-scroll-fallback");
    const editor = control.editor;

    editor.MoveECell("A20");
    editor.firstscrollingrow = null;
    editor.lastvisiblerow = null;
    editor.pageUpDnAmount = 15;

    editor.MoveECellWithKey("[pgdn]");
    expect(editor.ecell.row).toBe(35);

    editor.MoveECellWithKey("[pgup]");
    expect(editor.ecell.row).toBe(20);
});

test("page down/up use visible row count instead of fixed defaultPageUpDnAmount (#358)", async () => {
    const SC = await loadSocialCalc({ browser: true });
    installUiShim();
    const { control } = await newControl(SC);
    const editor = control.editor;

    editor.MoveECell("A5");
    editor.firstscrollingrow = 1;
    editor.lastvisiblerow = 20;
    editor.pageUpDnAmount = 15;

    editor.MoveECellWithKey("[pgdn]");
    expect(editor.ecell.row).toBe(25);

    editor.MoveECell("A25");
    editor.MoveECellWithKey("[pgup]");
    expect(editor.ecell.row).toBe(5);
});