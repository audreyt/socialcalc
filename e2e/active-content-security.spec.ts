// Two characterization/regression suites for SocialCalc's documented trust
// boundary (README "Trust boundary and host security" and "Opt-in
// untrusted-content mode"):
//
// 1. Below, "active-content characterization" — the `text-html` cell format
//    renders raw HTML without escaping, and link/image formats can likewise
//    inject markup, under the LEGACY DEFAULT (`SocialCalc.Callbacks
//    .untrustedContent === false`). This records that CURRENT default
//    behavior for regression visibility and intentionally does NOT assert
//    hostile content is blocked or sanitized — README is explicit that the
//    legacy default "treats all of this as trusted and is not safe for
//    untrusted input" by design; sanitizing untrusted cell content under
//    the default mode remains the host application's responsibility. If
//    this test ever starts failing because markup got escaped under the
//    default, that is a behavior change to evaluate, not a regression to
//    "fix" back to the old assertions.
//
// 2. Further below, "opt-in untrusted-content policy" — with
//    `untrustedContent` explicitly set to `true`, SocialCalc DOES provide a
//    real, asserted security control (SafeUrlForRender/EscapeUntrustedHtml);
//    that section proves hostile payloads never reach a live, browser-
//    parsed active attribute. See that section's own header for detail.

import {
  cellLocator,
  createControl,
  expect,
  gotoBundle,
  scheduleCommand,
  setUntrustedContent,
  stubImageRequests,
  test,
  waitFor,
} from "./fixtures/editor";

test.describe("active-content characterization (legacy default, untrustedContent=false — not a security guarantee)", () => {
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
    await waitFor(
      page,
      () => document.querySelector("#containerDiv #cell_A1")?.innerHTML.includes("<img") === true,
      "SocialCalc-",
    );

    const cellHtml = await cellLocator(page, "A1").innerHTML();
    expect(cellHtml).toContain("<img");
    expect(cellHtml).toContain("onerror=");

    await waitFor(page, () => window.__xssCharacterization === true, "SocialCalc-");
  });
});

// ---------------------------------------------------------------------------
// Opt-in untrusted-content policy (SocialCalc.Callbacks.untrustedContent +
// SafeUrlForRender/EscapeUntrustedHtml). Unlike the characterization above,
// this section runs against a real security control and DOES assert the
// hostile payload never reaches a live, browser-parsed active attribute —
// checked via the actual resolved DOM property (`.href`/`.src`, or presence
// of a live attribute), not string matching, so the browser's own HTML
// parser is the one proving the negative. Payloads mirror
// test/render-security-policy.test.ts's entity-decoding-bypass fixtures
// (decimal/hex/named HTML character references smuggling a "javascript:"
// scheme or a quote-breakout past the scheme-sniffing regex) run once each
// at DOM level across the three URL-consuming sinks that regex covers.
// ---------------------------------------------------------------------------
test.describe("opt-in untrusted-content policy: entity-payload sinks stay inert in the real DOM", () => {
  test("text-url: a decimal-entity javascript&#58; payload never resolves to a live javascript: href", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await setUntrustedContent(page, true);

    await scheduleCommand(page, "set A1 text t javascript&#58;alert(1)");
    await scheduleCommand(page, "set A1 textvalueformat text-url");
    await waitFor(
      page,
      () => document.querySelector("#containerDiv #cell_A1 a") !== null,
      "SocialCalc-",
    );

    const href = await page.evaluate(
      () =>
        (document.querySelector("#containerDiv #cell_A1 a") as HTMLAnchorElement | null)?.href ??
        null,
    );
    expect(href).not.toBeNull();
    expect(href?.toLowerCase().startsWith("javascript:")).toBe(false);
  });

  test("text-image: a hex-entity jav&#x61;script: payload never resolves to a live javascript: src", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await stubImageRequests(page);
    await createControl(page);
    await setUntrustedContent(page, true);

    await scheduleCommand(page, "set B1 text t jav&#x61;script:alert(1)");
    await scheduleCommand(page, "set B1 textvalueformat text-image");
    await waitFor(
      page,
      () => document.querySelector("#containerDiv #cell_B1 img") !== null,
      "SocialCalc-",
    );

    const src = await page.evaluate(
      () =>
        (document.querySelector("#containerDiv #cell_B1 img") as HTMLImageElement | null)?.src ??
        null,
    );
    expect(src).not.toBeNull();
    expect(src?.toLowerCase().startsWith("javascript:")).toBe(false);
  });

  test("text-custom @u: a named-entity quote-breakout payload injects no live onmouseover attribute", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await setUntrustedContent(page, true);

    await scheduleCommand(page, "set C1 text t x&quot;onmouseover=&quot;alert(1)");
    await scheduleCommand(page, 'set C1 textvalueformat text-custom:<a href="@u">@s</a>');
    await waitFor(
      page,
      () => document.querySelector("#containerDiv #cell_C1")?.innerHTML.includes("&lt;a") === true,
      "SocialCalc-",
    );

    const result = await page.evaluate(() => {
      const cell = document.querySelector("#containerDiv #cell_C1");
      return {
        hasAnchor: cell?.querySelector("a") != null,
        hasOnMouseOver: cell?.querySelector("[onmouseover]") != null,
      };
    });
    // No sanitizeHtml configured (default policy): the whole @u template is
    // escaped, so there is no live anchor at all — doubly proving no
    // attribute-breakout could have executed.
    expect(result.hasAnchor).toBe(false);
    expect(result.hasOnMouseOver).toBe(false);
  });

  test("text-url: a safe query string (?a=1&b=2) round-trips byte-identical through the real DOM", async ({
    page,
  }) => {
    await gotoBundle(page, "normal");
    await createControl(page);
    await setUntrustedContent(page, true);

    await scheduleCommand(page, "set D1 text t http://example.com/?a=1&b=2");
    await scheduleCommand(page, "set D1 textvalueformat text-url");
    await waitFor(
      page,
      () => document.querySelector("#containerDiv #cell_D1 a") !== null,
      "SocialCalc-",
    );

    const href = await page.evaluate(
      () =>
        (document.querySelector("#containerDiv #cell_D1 a") as HTMLAnchorElement | null)?.href ??
        null,
    );
    // The DOM's resolved href — not the raw HTML-escaped attribute text —
    // must be byte-identical to the original URL: the browser's own parser
    // decoding "&amp;" back into "&" is the round-trip under test.
    expect(href).toBe("http://example.com/?a=1&b=2");
  });
});

declare global {
  interface Window {
    __markCharacterizationFired: () => void;
    __xssCharacterization: boolean;
  }
}
