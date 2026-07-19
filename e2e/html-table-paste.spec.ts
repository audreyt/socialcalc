// Real-browser coverage of rich HTML table clipboard paste (SC.HtmlTable /
// SC.EditorPasteFromClipboardAsync): a real `ClipboardEvent` fired against
// the editor's `pasteTextarea` (the same event the "paste" listener wired in
// `CreateTableEditor` reacts to), rowspan/colspan normalization, safe style
// mapping, fallback to plain text on absent/invalid HTML, and one undo step.
// Runs across all three engines (chromium/firefox/webkit) via
// e2e/fixtures/editor.ts's shared `test`, since a synthetic ClipboardEvent
// with `clipboardData` set is a standard DOM API, not a Chromium-only
// permission-gated one (unlike `navigator.clipboard.read()`, exercised
// separately below with `test.skip` on non-Chromium engines).

import {
  cellLocator,
  cellValue,
  createControl,
  expect,
  gotoBundle,
  scheduleCommand,
  test,
  waitFor,
} from "./fixtures/editor";

/**
 * Dispatches a real `ClipboardEvent("paste", { clipboardData })` on the
 * editor's `pasteTextarea` -- the exact event
 * `js/socialcalctableeditor.ts`'s `CreateTableEditor` listens for to capture
 * `event.clipboardData.getData("text/html")` into `editor.pasteHtmlData`
 * (see that file's "paste" addEventListener). `DataTransfer` is a real
 * constructible browser API in all three engines, so this exercises the
 * genuine `ClipboardEvent`/`DataTransfer` machinery, not a hand-rolled stub.
 */
async function dispatchPasteEvent(
  page: Parameters<typeof cellLocator>[0],
  html: string,
  plainText: string,
  idPrefix = "SocialCalc-",
): Promise<void> {
  await page.evaluate(
    ({ html, plainText, idPrefix }) => {
      const editor = window.__scControls[idPrefix].editor as unknown as {
        pasteTextarea: HTMLTextAreaElement;
      };
      const ta = editor.pasteTextarea;
      const dataTransfer = new DataTransfer();
      if (html) dataTransfer.setData("text/html", html);
      if (plainText) dataTransfer.setData("text/plain", plainText);
      const event = new ClipboardEvent("paste", { clipboardData: dataTransfer, bubbles: true });
      ta.dispatchEvent(event);
      ta.value = plainText;
    },
    { html, plainText, idPrefix },
  );
}

test.describe("real ClipboardEvent HTML table paste", () => {
  test("an Excel-like table with headers, numbers, and a colspan pastes as typed, styled cells", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    const excelHtml =
      '<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">' +
      "<body><table><tr>" +
      '<td style="font-weight:700">Name</td><td style="font-weight:700">Score</td>' +
      "</tr><tr><td>Ann</td><td>85.5</td></tr><tr><td>Bob</td><td>92</td></tr></table></body></html>";

    await dispatchPasteEvent(page, excelHtml, "Name\tScore\nAnn\t85.5\nBob\t92\n");
    // Drive the real ctrl-v pipeline: press Ctrl+V on the focused editor so
    // the shipping ctrlkeyFunction handler (which reads editor.pasteHtmlData
    // set by the dispatched event above) runs end to end.
    await page.keyboard.press("Control+v");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "Name",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("Name");
    expect(await cellValue(page, "B1")).toBe("Score");
    expect(await cellValue(page, "A2")).toBe("Ann");
    expect(await cellValue(page, "B2")).toBe(85.5);
    expect(await cellValue(page, "A3")).toBe("Bob");
    expect(await cellValue(page, "B3")).toBe(92);

    // Bold header style landed as a real font/style on the rendered cell.
    const headerFontWeight = await page.evaluate(() => {
      const cell = document.querySelector("#containerDiv #cell_A1") as HTMLElement | null;
      return cell ? getComputedStyle(cell).fontWeight : null;
    });
    expect(["700", "bold"]).toContain(headerFontWeight);
  });

  test("a Google-Sheets-like table with a merged (colspan) title row normalizes rowspan/colspan into real cell spans", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    const sheetsHtml =
      '<google-sheets-html-origin><table><tbody><tr><td colspan="2" data-sheets-value="Merged Title">' +
      "Merged Title</td></tr><tr><td>1</td><td>2</td></tr></tbody></table></google-sheets-html-origin>";

    await dispatchPasteEvent(page, sheetsHtml, "Merged Title\t\n1\t2\n");
    await page.keyboard.press("Control+v");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "Merged Title",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("Merged Title");
    // A real rendered <td> at A1 carries colSpan=2 in the live DOM.
    const colSpan = await page.evaluate(
      () => (document.querySelector("#containerDiv #cell_A1") as HTMLTableCellElement).colSpan,
    );
    expect(colSpan).toBe(2);
    expect(await cellValue(page, "A2")).toBe(1);
    expect(await cellValue(page, "B2")).toBe(2);
  });

  test("pasting with no HTML on the clipboard falls back unchanged to the plain-text tab path", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await dispatchPasteEvent(page, "", "plainA\tplainB\n");
    await page.keyboard.press("Control+v");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "plainA",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("plainA");
    expect(await cellValue(page, "B1")).toBe("plainB");
  });

  test("pasting HTML that contains no <table> falls back unchanged to the plain-text tab path", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await dispatchPasteEvent(page, "<div>no table here</div>", "fallback-value\n");
    await page.keyboard.press("Control+v");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "fallback-value",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("fallback-value");
  });

  test("a single Ctrl+V of an HTML table is exactly one undo step", async ({ page }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await scheduleCommand(page, "set A1 value n 99");

    await dispatchPasteEvent(page, "<table><tr><td>new-value</td></tr></table>", "new-value\n");
    await page.keyboard.press("Control+v");
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "new-value",
      "SocialCalc-",
    );

    await page.evaluate(
      (idPrefix) => window.__scControls[idPrefix].editor.SheetUndo(),
      "SocialCalc-",
    );
    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === 99,
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe(99);
  });

  test("script/style tags and event-handler attributes in pasted HTML never execute or reach the sheet", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    await page.evaluate(() => {
      window.__htmlPasteXssFired = false;
      window.__markHtmlPasteXssFired = () => {
        window.__htmlPasteXssFired = true;
      };
    });

    const hostileHtml =
      "<table><tr><td>" +
      '<img src="x" onerror="window.__markHtmlPasteXssFired()">' +
      "<script>window.__markHtmlPasteXssFired()</script>" +
      "safe-text</td></tr></table>";

    await dispatchPasteEvent(page, hostileHtml, "safe-text\n");
    await page.keyboard.press("Control+v");

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "safe-text",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("safe-text");
    const fired = await page.evaluate(() => window.__htmlPasteXssFired);
    expect(fired).toBe(false);
    // The rendered cell HTML never carries the hostile markup either (cell
    // text is always escaped by RenderCell/FormatValueForDisplay, same as
    // any other cell value).
    const cellHtml = await cellLocator(page, "A1").innerHTML();
    expect(cellHtml).not.toContain("onerror");
    expect(cellHtml).not.toContain("<script");
  });
});

test.describe("navigator.clipboard toolbar paste path (Chromium only: clipboard-read permission)", () => {
  test("pasteclipboard reads a real OS-clipboard HTML table via navigator.clipboard.read()", async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(
      browserName !== "chromium",
      "navigator.clipboard.read()/ClipboardItem requires a Chromium-only granted permission",
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoBundle(page, "normal");
    await createControl(page);

    // Write directly to the real OS/browser clipboard via the Async
    // Clipboard API (not our own dispatchPasteEvent stub) so
    // SC.EditorPasteFromClipboardAsync's navigator.clipboard.read() path
    // reads genuine clipboard content.
    await page.evaluate(async () => {
      const html = "<table><tr><td>from-os-clipboard</td><td>7</td></tr></table>";
      const text = "from-os-clipboard\t7\n";
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
    });

    await page.evaluate(() => {
      (window.SocialCalc as unknown as { DoCmd: (obj: null, which: string) => void }).DoCmd(
        null,
        "pasteclipboard",
      );
    });

    await waitFor(
      page,
      (idPrefix) => window.__scControls[idPrefix].sheet.cells.A1?.datavalue === "from-os-clipboard",
      "SocialCalc-",
    );
    expect(await cellValue(page, "A1")).toBe("from-os-clipboard");
    expect(await cellValue(page, "B1")).toBe(7);
  });
});

declare global {
  interface Window {
    __htmlPasteXssFired?: boolean;
    __markHtmlPasteXssFired?: () => void;
  }
}
