import { expect, test } from "vite-plus/test";

import {
  installBrowserShim,
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
} from "./helpers/socialcalc";

test("RenderSheet table carries role=grid and aria row/col counts", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set C5 value n 2"]);
  await recalcSheet(SC, sheet);

  const context = new SC.RenderContext(sheet);
  context.showRCHeaders = true;
  context.showGrid = true;
  const table = context.RenderSheet(null, context.defaultHTMLlinkstyle);

  expect(table.getAttribute("role")).toBe("grid");
  expect(table.getAttribute("aria-rowcount")).toBe(String(sheet.attribs.lastrow));
  expect(table.getAttribute("aria-colcount")).toBe(String(sheet.attribs.lastcol));
});

test("RenderRow marks the row and its row-header gridcell with row roles", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, sheet);

  const context = new SC.RenderContext(sheet);
  context.showRCHeaders = true;
  context.showGrid = true;
  context.CalculateCellSkipData();

  const row = context.RenderRow(1, 0, context.defaultHTMLlinkstyle);
  expect(row.getAttribute("role")).toBe("row");
  expect(row.getAttribute("aria-rowindex")).toBe("1");

  const rowHeaderCell = row.childNodes[0];
  expect(rowHeaderCell.getAttribute("role")).toBe("rowheader");
  expect(rowHeaderCell.getAttribute("scope")).toBe("row");
  expect(rowHeaderCell.getAttribute("aria-label")).toBe("Row 1");
});

test("RenderColHeaders marks columnheader roles with aria-colindex and a plain-text label", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, sheet);

  const context = new SC.RenderContext(sheet);
  context.showRCHeaders = true;
  context.showGrid = true;

  const headerRow = context.RenderColHeaders();
  expect(headerRow.getAttribute("role")).toBe("row");

  // childNodes[0] is the blank upper-left corner cell; [1] is column A's header.
  const colAHeader = headerRow.childNodes[1];
  expect(colAHeader.getAttribute("role")).toBe("columnheader");
  expect(colAHeader.getAttribute("scope")).toBe("col");
  expect(colAHeader.getAttribute("aria-colindex")).toBe("1");
  expect(colAHeader.getAttribute("aria-label")).toBe("Column A");
});

test("RenderCell sets gridcell role, indices, readonly/invalid state, and a plain-text accessible name", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 42",
    "set A1 readonly yes",
    "set B1 text t <script>evil</script>", // must never end up concatenated into aria-label markup
  ]);
  await recalcSheet(SC, sheet);

  const context = new SC.RenderContext(sheet);
  context.showRCHeaders = false;
  context.showGrid = true;
  context.CalculateCellSkipData();

  const a1 = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);
  expect(a1.getAttribute("role")).toBe("gridcell");
  expect(a1.getAttribute("aria-rowindex")).toBe("1");
  expect(a1.getAttribute("aria-colindex")).toBe("1");
  expect(a1.getAttribute("aria-readonly")).toBe("true");
  expect(a1.getAttribute("aria-label")).toBe("A1: 42");

  const b1 = context.RenderCell(1, 2, 0, 0, false, context.defaultHTMLlinkstyle);
  // The accessible name is built from the plain cell value, not by
  // concatenating rendered/escaped markup, so raw text (including markup
  // look-alikes) is carried through as data, not parsed as HTML in aria-label.
  expect(b1.getAttribute("aria-label")).toBe("B1: <script>evil</script>");
  expect(b1.getAttribute("aria-readonly")).toBe("false");
});

test("RenderCell reports aria-invalid for cells with recorded errors", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 formula 1/0"]);
  await recalcSheet(SC, sheet);

  const context = new SC.RenderContext(sheet);
  context.showRCHeaders = false;
  context.showGrid = true;
  context.CalculateCellSkipData();

  const a1 = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);
  expect(sheet.cells.A1.errors).toBeTruthy();
  expect(a1.getAttribute("aria-invalid")).toBe("true");
});

test("RenderCell reflects aria-selected for the highlighted cursor/range cell only", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1", "set B1 value n 2"]);
  await recalcSheet(SC, sheet);

  const context = new SC.RenderContext(sheet);
  context.showRCHeaders = false;
  context.showGrid = true;
  context.CalculateCellSkipData();
  context.highlights = { A1: "cursor" };
  context.cursorsuffix = "";

  const a1 = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);
  const b1 = context.RenderCell(1, 2, 0, 0, false, context.defaultHTMLlinkstyle);
  expect(a1.getAttribute("aria-selected")).toBe("true");
  expect(b1.getAttribute("aria-selected")).toBe("false");
});

test("RenderCell does not set ARIA attributes for pseudo-elements (noElement=true)", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  await recalcSheet(SC, sheet);

  const context = new SC.RenderContext(sheet);
  context.showRCHeaders = false;
  context.showGrid = true;
  context.CalculateCellSkipData();

  const pseudo = context.RenderCell(1, 1, 0, 0, true, context.defaultHTMLlinkstyle);
  // Pseudo-elements are plain objects with no setAttribute -- confirms the
  // ARIA-attribute code paths are guarded by `!noElement` and never throw.
  expect(typeof pseudo.setAttribute).toBe("undefined");
  expect(typeof pseudo.style).toBe("object");
});
