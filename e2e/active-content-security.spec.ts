// Characterization test for SocialCalc's documented trust boundary
// (README "Trust boundary and host security"): the `text-html` cell format
// renders raw HTML without escaping, and link/image formats can likewise
// inject markup. This file records that CURRENT behavior for regression
// visibility. It intentionally does NOT assert that hostile content is
// blocked or sanitized — README is explicit that SocialCalc "does not
// provide a secure mode or a host-wide sanitizer" and sanitizing untrusted
// cell content is the host application's responsibility. If this test ever
// starts failing because markup got escaped, that is a behavior change to
// evaluate, not a regression to "fix" back to the old assertions.

import { cellLocator, createControl, expect, gotoBundle, scheduleCommand, test, waitFor } from "./fixtures/editor";

test.describe("active-content characterization (not a security guarantee)", () => {
  test("a text-html cell renders raw markup, including inline event-handler attributes, verbatim", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);

    // Track whether an inline event handler embedded in "hostile" cell
    // content actually executes. Uses a well-formed `data:` URI whose bytes
    // are not a decodable image (garbage payload, not invalid base64) so
    // the browser's own image decoder fires `onerror` purely client-side —
    // no network request, so no browser-level "Failed to load resource"
    // console noise to work around. This is the documented, expected
    // behavior of a hostile text-html cell, not a crash.
    await page.evaluate(() => {
      window.__xssCharacterization = false;
      window.__markCharacterizationFired = () => {
        window.__xssCharacterization = true;
      };
    });

    const hostileImageSrc = `data:image/png;base64,${btoa("not a real image, garbage bytes")}`;
    await scheduleCommand(
      page,
      `set A1 text t <img src="${hostileImageSrc}" onerror="window.__markCharacterizationFired()">`,
    );
    await scheduleCommand(page, "set A1 textvalueformat text-html");
    await waitFor(page, () => document.querySelector("#containerDiv #cell_A1")?.innerHTML.includes("<img") === true, "SocialCalc-");

    const cellHtml = await cellLocator(page, "A1").innerHTML();
    expect(cellHtml).toContain("<img");
    expect(cellHtml).toContain("onerror=");

    await waitFor(page, () => window.__xssCharacterization === true, "SocialCalc-");
  });
});

declare global {
  interface Window {
    __markCharacterizationFired: () => void;
    __xssCharacterization: boolean;
  }
}
