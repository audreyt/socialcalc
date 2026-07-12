import { afterEach, describe, expect, test } from "vite-plus/test";

import { installBrowserShim, loadSocialCalc } from "./helpers/socialcalc";

// SocialCalc.Callbacks is a shared, mutable singleton on the cached bundle
// instance (see test/helpers/socialcalc.ts). Every test that flips
// untrustedContent or overrides securityPolicy MUST restore the defaults
// afterward so it cannot leak into unrelated tests/files.
afterEach(async () => {
  const SC = await loadSocialCalc();
  SC.Callbacks.untrustedContent = false;
  SC.Callbacks.securityPolicy = {
    sanitizeHtml: null,
    allowedUrlSchemes: ["http:", "https:", "mailto:"],
    allowedDataMimeTypes: [],
  };
});

// ---------------------------------------------------------------------------
// Trusted/default (legacy) mode: untrustedContent is false unless a test
// explicitly opts in. Output must be byte-for-byte identical to the
// pre-existing behavior documented by test/format-coverage.test.ts.
// ---------------------------------------------------------------------------
describe("trusted (legacy) mode is unaffected by the opt-in policy", () => {
  test("untrustedContent defaults to false", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Callbacks.untrustedContent).toBe(false);
  });

  test("text-html still passes raw markup through unchanged", async () => {
    const SC = await loadSocialCalc();
    expect(
      SC.format_text_for_display(
        '<img src=x onerror="alert(1)">',
        "th",
        "text-html",
        null,
        "",
      ),
    ).toBe('<img src=x onerror="alert(1)">');
  });

  test("text-url still emits javascript: hrefs unescaped", async () => {
    const SC = await loadSocialCalc();
    expect(
      SC.format_text_for_display("javascript:alert(1)", "t", "text-url", null, ""),
    ).toBe('<a href="javascript:alert(1)">javascript:alert(1)</a>');
  });

  test("text-image still emits data: srcs unescaped", async () => {
    const SC = await loadSocialCalc();
    const out = SC.format_text_for_display(
      "data:image/svg+xml,<svg onload=alert(1)>",
      "t",
      "text-image",
      null,
      "",
    );
    expect(out).toBe(
      '<img src="data:image/svg+xml,%3Csvg%20onload=alert(1)%3E">',
    );
  });

  test("text-custom @r still substitutes raw, unescaped text", async () => {
    const SC = await loadSocialCalc();
    expect(
      SC.format_text_for_display("<b>hi</b>", "t", "text-custom:@r", null, ""),
    ).toBe("<b>hi</b>");
  });

  test("expand_text_link still emits javascript: hrefs unescaped", async () => {
    const SC = await loadSocialCalc();
    const html = SC.expand_text_link(
      "javascript:alert(1)",
      new SC.Sheet(),
      null,
      "text-link",
    );
    expect(html).toBe('<a href="javascript:alert(1)" target="_blank">javascript:alert(1)</a>');
  });
});

// ---------------------------------------------------------------------------
// Untrusted mode: raw HTML / @r
// ---------------------------------------------------------------------------
describe("untrusted mode: raw HTML and text-custom @r", () => {
  test("text-html is HTML-escaped by default (no sanitizeHtml configured)", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      '<img src=x onerror="alert(1)">',
      "th",
      "text-html",
      null,
      "",
    );
    expect(out).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(out).not.toContain("<img");
  });

  test("text-html defers to an explicit host sanitizeHtml callback when provided", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    SC.Callbacks.securityPolicy = {
      sanitizeHtml: (html: string) => `SANITIZED(${html.length})`,
      allowedUrlSchemes: ["http:", "https:"],
      allowedDataMimeTypes: [],
    };
    const out = SC.format_text_for_display("<b>hi</b>", "th", "text-html", null, "");
    expect(out).toBe("SANITIZED(9)");
  });

  test("text-custom @r is escaped in untrusted mode; @s stays escaped, unaffected", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "<script>alert(1)</script>",
      "t",
      "text-custom:[@r][@s]",
      null,
      "",
    );
    expect(out).toBe(
      "[&lt;script&gt;alert(1)&lt;/script&gt;][&lt;script&gt;alert(1)&lt;/script&gt;]",
    );
  });

  test("text-custom @r uses the host sanitizeHtml callback when configured", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    SC.Callbacks.securityPolicy = {
      sanitizeHtml: () => "<b>safe</b>",
      allowedUrlSchemes: ["http:", "https:"],
      allowedDataMimeTypes: [],
    };
    const out = SC.format_text_for_display(
      "<script>x</script>",
      "t",
      "text-custom:@r",
      null,
      "",
    );
    expect(out).toBe("<b>safe</b>");
  });
});

// ---------------------------------------------------------------------------
// Untrusted mode: URL/image scheme allowlisting
// ---------------------------------------------------------------------------
describe("untrusted mode: URL and image scheme allowlist", () => {
  test("text-url allows http/https/mailto by default", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    expect(
      SC.format_text_for_display("https://example.com", "t", "text-url", null, ""),
    ).toBe('<a href="https://example.com">https://example.com</a>');
    expect(
      SC.format_text_for_display("mailto:a@example.com", "t", "text-url", null, ""),
    ).toBe('<a href="mailto:a@example.com">mailto:a@example.com</a>');
  });

  test("text-url rejects javascript: and falls back to inert escaped text", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display("javascript:alert(1)", "t", "text-url", null, "");
    expect(out).toBe("javascript:alert(1)");
    expect(out).not.toContain("<a ");
  });

  test("text-url rejects javascript: hidden behind tabs/newlines/case (browser-style scheme sniffing)", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const variants = [
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "  javascript:alert(1)",
    ];
    for (const variant of variants) {
      const out = SC.format_text_for_display(variant, "t", "text-url", null, "");
      expect(out).toBe(variant);
    }
  });

  test("text-url rejects data: by default", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "data:text/html,<script>alert(1)</script>",
      "t",
      "text-url",
      null,
      "",
    );
    expect(out).toBe("data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("text-image rejects javascript:/data: SVG payloads by default", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const jsOut = SC.format_text_for_display("javascript:alert(1)", "t", "text-image", null, "");
    expect(jsOut).toBe("javascript:alert(1)");

    const svgOut = SC.format_text_for_display(
      "data:image/svg+xml,<svg onload=alert(1)>",
      "t",
      "text-image",
      null,
      "",
    );
    expect(svgOut).toBe("data:image/svg+xml,&lt;svg onload=alert(1)&gt;");
  });

  test("text-image allows http(s) image URLs by default", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    expect(
      SC.format_text_for_display("http://example.com/pic.jpg", "t", "text-image", null, ""),
    ).toBe('<img src="http://example.com/pic.jpg">');
  });

  test("data: is allowed only for MIME types the host explicitly opts into", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    SC.Callbacks.securityPolicy = {
      sanitizeHtml: null,
      allowedUrlSchemes: ["http:", "https:"],
      allowedDataMimeTypes: ["image/png"],
    };
    expect(
      SC.format_text_for_display(
        "data:image/png;base64,AAAA",
        "t",
        "text-image",
        null,
        "",
      ),
    ).toBe('<img src="data:image/png;base64,AAAA">');
    // Still rejects mime types not on the explicit allowlist.
    const svgOut = SC.format_text_for_display(
      "data:image/svg+xml,<svg onload=alert(1)>",
      "t",
      "text-image",
      null,
      "",
    );
    expect(svgOut).toBe("data:image/svg+xml,&lt;svg onload=alert(1)&gt;");
  });

  test("text-custom template markup is escaped without a sanitizer, even though @u is rejected", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "javascript:alert(1)",
      "t",
      'text-custom:<a href="@u">@s</a>',
      null,
      "",
    );
    // The template's literal markup ('<a href="' etc.) is sheet-authored
    // data too (a valueformat: entry), so with no host sanitizer it is
    // escaped exactly like the rejected @u value - the whole thing is
    // rendered as inert text, not a live anchor with an empty href.
    expect(out).toBe(
      '&lt;a href=&quot;&quot;&gt;javascript:alert(1)&lt;/a&gt;',
    );
    expect(out).not.toContain("<a ");
  });

  test("text-custom template markup is escaped without a sanitizer, even though @u is allowed", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "https://example.com",
      "t",
      'text-custom:<a href="@u">@s</a>',
      null,
      "",
    );
    // Template markup is escaped without a sanitizer; only the
    // placeholder VALUES (@u, @s) keep their untrusted-mode semantics.
    expect(out).toBe(
      '&lt;a href=&quot;https://example.com&quot;&gt;https://example.com&lt;/a&gt;',
    );
    expect(out).not.toContain("<a ");
  });

  test("text-custom @u/template with an explicit sanitizeHtml callback: template preserved, values substituted first", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    SC.Callbacks.securityPolicy = {
      sanitizeHtml: (html: string) => html.replace(/javascript:/gi, ""),
      allowedUrlSchemes: ["http:", "https:"],
      allowedDataMimeTypes: [],
    };
    const out = SC.format_text_for_display(
      "javascript:alert(1)",
      "t",
      'text-custom:<a href="@u">@s</a>',
      null,
      "",
    );
    // Expanded first using trusted-style semantics (@u = encodeURI of the
    // raw value, not scheme-checked - the sanitizer is responsible for the
    // final cleanup), then the FULL result (template + values) is handed
    // to sanitizeHtml in one pass.
    expect(out).toBe('<a href="alert(1)">alert(1)</a>');
    expect(out).not.toContain("javascript:alert(1)\">");
  });

  test("expand_text_link rejects javascript: and returns inert text (no anchor)", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const html = SC.expand_text_link(
      "desc<javascript:alert(1)>",
      new SC.Sheet(),
      null,
      "text-link",
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("javascript:");
    expect(html).toBe("desc");
  });

  test("expand_text_link allows a plain http(s) link in untrusted mode", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const html = SC.expand_text_link(
      "desc<http://example.com>",
      new SC.Sheet(),
      null,
      "text-link",
    );
    expect(html).toBe('<a href="http://example.com" target="_blank">desc</a>');
  });
});

// ---------------------------------------------------------------------------
// SafeUrlForRender must return an HTML-ATTRIBUTE-SAFE string, not merely a
// URI-safe one. encodeURI deliberately leaves "&", "#", ";" unescaped
// (they are valid URI characters), but every consumer of SafeUrlForRender
// places its result inside an href="..."/src="..." attribute. A literal
// "&" there lets an HTML character/entity reference (decimal "&#58;", hex
// "&#x61;", or named "&quot;") slip past the scheme-sniffing regex as
// harmless-looking text, survive validation, and then get decoded by the
// BROWSER'S HTML PARSER - independently of any URL-parsing logic - into a
// live "javascript:" scheme or a quote that breaks out of the attribute.
// The fix HTML-escapes the validated, percent-encoded string on every
// accepted return path (relative/schemeless, allowlisted scheme, and
// data:), so a legitimate "&" (e.g. in a query string) round-trips back to
// a literal "&" once the browser decodes the attribute, while an
// attacker's literal entity text is doubly inert.
// ---------------------------------------------------------------------------
describe("SafeUrlForRender: HTML entity-decoding bypass is closed", () => {
  test("a decimal numeric character reference hiding ':' is HTML-escaped, not left as live scheme text", async () => {
    const SC = await loadSocialCalc();
    const out = SC.SafeUrlForRender("javascript&#58;alert(1)");
    expect(out).not.toBeNull();
    expect(out).not.toContain("javascript:");
    expect(out).toBe("javascript&amp;#58;alert(1)");
  });

  test("a hex numeric character reference hiding a scheme letter is HTML-escaped", async () => {
    const SC = await loadSocialCalc();
    const out = SC.SafeUrlForRender("jav&#x61;script:alert(1)");
    expect(out).not.toBeNull();
    expect(out).not.toContain("javascript:");
    expect(out).toBe("jav&amp;#x61;script:alert(1)");
  });

  test("a named entity ('&quot;') used to smuggle a quote for attribute breakout is HTML-escaped", async () => {
    const SC = await loadSocialCalc();
    const out = SC.SafeUrlForRender('x&quot;onmouseover=&quot;alert(1)');
    expect(out).not.toBeNull();
    expect(out).not.toContain('"');
    expect(out).toBe("x&amp;quot;onmouseover=&amp;quot;alert(1)");
  });

  test("an allowlisted scheme carrying an entity-encoded payload after it is still HTML-escaped", async () => {
    const SC = await loadSocialCalc();
    // Scheme check passes (real "http:" scheme), but the path still
    // carries a decimal-entity javascript-scheme payload as harmless text
    // - it must never be able to decode into a second, nested live scheme.
    const out = SC.SafeUrlForRender("http://example.com/redirect?to=javascript&#58;alert(1)");
    expect(out).not.toBeNull();
    expect(out).toBe("http://example.com/redirect?to=javascript&amp;#58;alert(1)");
  });

  test("query-string '&' semantics are preserved: '&amp;' round-trips back to a literal '&'", async () => {
    const SC = await loadSocialCalc();
    const out = SC.SafeUrlForRender("http://example.com/?a=1&b=2");
    expect(out).toBe("http://example.com/?a=1&amp;b=2");
    // Round-trip check: HTML-unescaping the attribute value recovers the
    // exact original URL, proving no semantic change to the query string.
    const htmlUnescape = (s: string) =>
      s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    expect(htmlUnescape(out as string)).toBe("http://example.com/?a=1&b=2");
  });

  test("rejected schemes (e.g. javascript:) still return null regardless of entity-encoding", async () => {
    const SC = await loadSocialCalc();
    expect(SC.SafeUrlForRender("javascript:alert(1)")).toBeNull();
  });

  // -------------------------------------------------------------------
  // Same payloads propagated through every URL-consuming sink, proving
  // the fix is not just a unit-level property of SafeUrlForRender itself.
  // -------------------------------------------------------------------

  test("sink: text-url neutralizes a decimal-entity javascript: payload and preserves query '&'", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const malicious = SC.format_text_for_display(
      "javascript&#58;alert(1)",
      "t",
      "text-url",
      null,
      "",
    );
    expect(malicious).toBe(
      '<a href="javascript&amp;#58;alert(1)">javascript&amp;#58;alert(1)</a>',
    );

    const safeQuery = SC.format_text_for_display(
      "http://example.com/?a=1&b=2",
      "t",
      "text-url",
      null,
      "",
    );
    expect(safeQuery).toBe(
      '<a href="http://example.com/?a=1&amp;b=2">http://example.com/?a=1&amp;b=2</a>',
    );
  });

  test("sink: text-image neutralizes a hex-entity javascript: payload in an image src", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "jav&#x61;script:alert(1)",
      "t",
      "text-image",
      null,
      "",
    );
    expect(out).toBe('<img src="jav&amp;#x61;script:alert(1)">');
  });

  test("sink: text-custom @u neutralizes a named-entity quote-breakout payload", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      'x&quot;onmouseover=&quot;alert(1)',
      "t",
      'text-custom:<a href="@u">@s</a>',
      null,
      "",
    );
    // The template markup is escaped anyway (no sanitizer configured), so
    // this is doubly inert - but @u itself must also carry no live quote.
    expect(out).toBe(
      '&lt;a href=&quot;x&amp;quot;onmouseover=&amp;quot;alert(1)&quot;&gt;x&amp;quot;onmouseover=&amp;quot;alert(1)&lt;/a&gt;',
    );
  });

  test("sink: expand_text_link neutralizes a decimal-entity javascript: payload", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const html = SC.expand_text_link(
      "desc<javascript&#58;alert(1)>",
      new SC.Sheet(),
      null,
      "text-link",
    );
    expect(html).toBe('<a href="javascript&amp;#58;alert(1)" target="_blank">desc</a>');
  });

  test("sink: MakePageLink returning an entity-encoded payload is neutralized when untrusted", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.MakePageLink;
    SC.Callbacks.MakePageLink = (pagename: string) => `javascript&#58;${pagename}`;
    SC.Callbacks.untrustedContent = true;
    try {
      const html = SC.expand_text_link("[alert(1)]", new SC.Sheet(), null, "text-link");
      expect(html).toBe(
        '<a href="javascript&amp;#58;alert(1)" target="_blank"><span style="font-size:smaller;text-decoration:none !important;background-color:#66B;color:#FFF;">Page</span></a>',
      );
    } finally {
      SC.Callbacks.MakePageLink = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// Malformed encodings and prototype-key probing must fail closed, not throw
// and not produce active output.
// ---------------------------------------------------------------------------
describe("untrusted mode: malformed encodings and prototype-key names fail closed", () => {
  test("an unpaired surrogate does not throw and produces no active markup", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const lone = "\uD800";
    const out = SC.format_text_for_display(lone, "t", "text-url", null, "");
    expect(out).toBe(lone);

    const imgOut = SC.format_text_for_display(lone, "t", "text-image", null, "");
    expect(imgOut).toBe(lone);
  });

  test("SafeUrlForRender itself fails closed on malformed encoding", async () => {
    const SC = await loadSocialCalc();
    expect(SC.SafeUrlForRender("\uD800")).toBeNull();
  });

  test("scheme names shaped like prototype keys are rejected, not treated specially", async () => {
    const SC = await loadSocialCalc();
    // "constructor:" and "toString:" are syntactically valid URI schemes
    // (letters only) but are not on the allowlist, so they are rejected.
    for (const scheme of ["constructor:alert(1)", "toString:alert(1)"]) {
      expect(SC.SafeUrlForRender(scheme)).toBeNull();
    }
    // "__proto__:" contains "_", which is not a legal URI scheme character
    // (RFC 3986), so browsers (and this function) treat it as a schemeless
    // relative path rather than an invocable scheme - inert either way.
    // The only requirement is that resolving it never touches
    // Object.prototype.
    expect(SC.SafeUrlForRender("__proto__:alert(1)")).toBe("__proto__:alert(1)");
    expect(({} as Record<string, unknown>).alert).toBeUndefined();
  });

  test("data: MIME types shaped like prototype keys are rejected, not treated specially", async () => {
    const SC = await loadSocialCalc();
    const policy = {
      sanitizeHtml: null,
      allowedUrlSchemes: ["http:", "https:"],
      allowedDataMimeTypes: ["__proto__", "constructor"],
    };
    // Even when the host allowlists these literal (unusual) MIME strings,
    // the lookup must not corrupt or read through Object.prototype for
    // unrelated, non-allowlisted values.
    expect(SC.SafeUrlForRender("data:text/html,<script>", policy)).toBeNull();
    expect(SC.SafeUrlForRender("data:__proto__,x", policy)).toBe("data:__proto__,x");
    // Object.prototype itself must remain unpolluted after all of the above.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("custom-format placeholders restricted to @r/@s/@u ignore prototype-shaped tokens", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "hi",
      "t",
      "text-custom:@__proto__ @constructor @r",
      null,
      "",
    );
    // @__proto__ / @constructor are not recognized placeholders (only
    // @r|@s|@u are), so they pass through as literal template text.
    expect(out).toBe("@__proto__ @constructor hi");
  });
});

// ---------------------------------------------------------------------------
// Render-level (Sheet + Cell) integration, not just the format_text_for_display
// unit-level helper — proves the policy propagates through the full cell
// rendering path exercised by the shipping bundle.
// ---------------------------------------------------------------------------
describe("render-level integration via FormatValueForDisplay", () => {
  test("untrusted mode escapes an html-subtype cell rendered through the sheet", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const sheet = new SC.Sheet();
    const cell = (sheet.cells.A1 = new SC.Cell("A1"));
    cell.valuetype = "th";
    cell.datavalue = '<img src=x onerror="alert(1)">';

    const out = SC.FormatValueForDisplay(sheet, cell.datavalue, "A1", "");
    expect(out).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("trusted (default) mode still renders the same cell as raw HTML", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const cell = (sheet.cells.A1 = new SC.Cell("A1"));
    cell.valuetype = "th";
    cell.datavalue = '<img src=x onerror="alert(1)">';

    const out = SC.FormatValueForDisplay(sheet, cell.datavalue, "A1", "");
    expect(out).toBe('<img src=x onerror="alert(1)">');
  });
});

// ---------------------------------------------------------------------------
// Untrusted mode: text-wiki output (both the expand_wiki callback and the
// legacy expand_markup callback) is neutralized the same way raw text-html
// is, since neither callback is assumed to be XSS-safe by default.
// ---------------------------------------------------------------------------
describe("untrusted mode: text-wiki via expand_wiki/expand_markup callbacks", () => {
  test("an unsafe expand_wiki callback's output is escaped when untrusted", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.expand_wiki;
    SC.Callbacks.expand_wiki = (v: string) => `<img src=x onerror="alert(1)">${v}`;
    SC.Callbacks.untrustedContent = true;
    try {
      const out = SC.format_text_for_display("hi", "tw", "text-wiki", null, "");
      expect(out).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;hi');
    } finally {
      SC.Callbacks.expand_wiki = prev;
    }
  });

  test("an unsafe expand_wiki callback's output stays raw in trusted (legacy) mode", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.expand_wiki;
    SC.Callbacks.expand_wiki = (v: string) => `<img src=x onerror="alert(1)">${v}`;
    try {
      const out = SC.format_text_for_display("hi", "tw", "text-wiki", null, "");
      expect(out).toBe('<img src=x onerror="alert(1)">hi');
    } finally {
      SC.Callbacks.expand_wiki = prev;
    }
  });

  test("an unsafe expand_markup callback's output is escaped when untrusted", async () => {
    const SC = await loadSocialCalc();
    const prevWiki = SC.Callbacks.expand_wiki;
    const prevMarkup = SC.Callbacks.expand_markup;
    // expand_wiki must be null so format_text_for_display falls through to
    // the plain "text-wiki" branch that consults expand_markup.
    SC.Callbacks.expand_wiki = null;
    SC.Callbacks.expand_markup = () => '<svg onload="alert(1)">';
    SC.Callbacks.untrustedContent = true;
    try {
      const out = SC.format_text_for_display("hi", "t", "text-wiki", null, "");
      expect(out).toBe('&lt;svg onload=&quot;alert(1)&quot;&gt;');
    } finally {
      SC.Callbacks.expand_wiki = prevWiki;
      SC.Callbacks.expand_markup = prevMarkup;
    }
  });

  test("an unsafe expand_markup callback's output stays raw in trusted (legacy) mode", async () => {
    const SC = await loadSocialCalc();
    const prevWiki = SC.Callbacks.expand_wiki;
    const prevMarkup = SC.Callbacks.expand_markup;
    SC.Callbacks.expand_wiki = null;
    SC.Callbacks.expand_markup = () => '<svg onload="alert(1)">';
    try {
      const out = SC.format_text_for_display("hi", "t", "text-wiki", null, "");
      expect(out).toBe('<svg onload="alert(1)">');
    } finally {
      SC.Callbacks.expand_wiki = prevWiki;
      SC.Callbacks.expand_markup = prevMarkup;
    }
  });

  test("a host sanitizeHtml callback still overrides the default escape for text-wiki", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.expand_wiki;
    SC.Callbacks.expand_wiki = () => "<b>markup</b>";
    SC.Callbacks.untrustedContent = true;
    SC.Callbacks.securityPolicy = {
      sanitizeHtml: (html: string) => `SAFE(${html})`,
      allowedUrlSchemes: ["http:", "https:"],
      allowedDataMimeTypes: [],
    };
    try {
      const out = SC.format_text_for_display("hi", "tw", "text-wiki", null, "");
      expect(out).toBe("SAFE(<b>markup</b>)");
    } finally {
      SC.Callbacks.expand_wiki = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// Untrusted mode: the formula-widget "cell_html" path (FormatValueForDisplay)
// interpolates sheet-authored formula parameters, HTML fragments, and CSS
// directly into live, event-handler-capable markup. It cannot be safely
// sanitized field-by-field without deep formula1.ts changes, so it is
// disabled entirely when untrusted; the cell falls back to its already-safe
// formatted display value.
// ---------------------------------------------------------------------------
describe("untrusted mode: formula-widget cell_html is disabled, not sanitized", () => {
  function installMaliciousWidget(SC: any) {
    const prev = SC.Formula.FunctionList["BUTTON"];
    const template =
      "<button data-p0='<%=parameter0_value%>'" +
      " data-h='<%=html0_value%>' onclick=\"alert(1)\">ok</button>";
    SC.Formula.FunctionList["BUTTON"] = [
      prev ? prev[0] : function () {},
      prev ? prev[1] : -1,
      prev ? prev[2] : "",
      prev ? prev[3] : "",
      prev ? prev[4] : "",
      template,
    ];
    return prev;
  }

  test("widget cell_html is not rendered when untrusted; formatted value is returned instead", async () => {
    const SC = await loadSocialCalc();
    const prevFL = installMaliciousWidget(SC);
    SC.Callbacks.untrustedContent = true;
    try {
      const sheet = new SC.Sheet();
      const cell = sheet.GetAssuredCell("A1");
      cell.valuetype = "niBUTTON";
      cell.datatype = "f";
      cell.formula = "BUTTON(\"'\"><script>alert(2)</script>\")";
      cell.datavalue = 0;
      sheet.ioParameterList = {
        A1: Object.assign([{ type: "value", value: '"><script>alert(2)</script>' }], {
          html: ["<img src=x onerror=alert(3)>"],
          css: "color:red' onmouseover='alert(4)",
        }),
      };

      const out = String(SC.FormatValueForDisplay(sheet, 0, "A1", ""));
      expect(out).toBe("0");
    } finally {
      SC.Formula.FunctionList["BUTTON"] = prevFL;
    }
  });

  test("trusted (default) mode still renders the widget cell_html with parameter substitution", async () => {
    const SC = await loadSocialCalc();
    const prevFL = installMaliciousWidget(SC);
    try {
      const sheet = new SC.Sheet();
      const cell = sheet.GetAssuredCell("A1");
      cell.valuetype = "niBUTTON";
      cell.datatype = "f";
      cell.formula = 'BUTTON("safe")';
      cell.datavalue = 0;
      sheet.ioParameterList = {
        A1: Object.assign([{ type: "value", value: "safe-param" }], {
          html: ["<em>h0</em>"],
        }),
      };

      const out = String(SC.FormatValueForDisplay(sheet, 0, "A1", ""));
      expect(out).toBe(
        "<button data-p0='safe-param' data-h='<em>h0</em>' onclick=\"alert(1)\">ok</button>",
      );
    } finally {
      SC.Formula.FunctionList["BUTTON"] = prevFL;
    }
  });
});

// ---------------------------------------------------------------------------
// SafeUrlForRender: validation and the returned value must never diverge -
// both operate on the same normalized (control-char/space-stripped) string.
// ---------------------------------------------------------------------------
describe("SafeUrlForRender: validated value and returned value cannot diverge", () => {
  test("leading/trailing whitespace is stripped from the returned URL, not just the scheme check", async () => {
    const SC = await loadSocialCalc();
    expect(SC.SafeUrlForRender("  http://example.com  ")).toBe("http://example.com");
  });

  test("embedded tabs/newlines around an allowed scheme are stripped from the returned URL", async () => {
    const SC = await loadSocialCalc();
    expect(SC.SafeUrlForRender("\thttps://example.com\n")).toBe("https://example.com");
  });

  test("rejects still fail closed after normalization (no partially-normalized leak)", async () => {
    const SC = await loadSocialCalc();
    expect(SC.SafeUrlForRender("  javascript:alert(1)  ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Untrusted mode: the statusline (EditorGetStatuslineString, consumed by
// both SpreadsheetControlStatuslineCallback and
// SpreadsheetViewerStatuslineCallback via innerHTML) surfaces the sheet
// name from an in-flight cross-sheet formula reference ('Sheet'!A1) via
// the "calcloading" status. That name is sheet-authored, hostile-formula
// reachable, and must not reach innerHTML unescaped when untrusted.
// ---------------------------------------------------------------------------
describe("untrusted mode: statusline escapes cross-sheet-formula sheet names", () => {
  function fakeEditor() {
    return {
      ecell: null,
      range: { hasrange: false },
      context: { sheetobj: { attribs: {} } },
    };
  }

  test("a malicious sheet name from calcloading is escaped when untrusted", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.EditorGetStatuslineString(
      fakeEditor(),
      "calcloading",
      { sheetname: '<img src=x onerror=alert(1)>' },
      {},
    );
    expect(out).toBe(
      "undefined &nbsp; Calculating... Loading Sheet...: &lt;img src=x onerror=alert(1)&gt;",
    );
  });

  test("a malicious sheet name from calcloading stays raw in trusted (legacy) mode", async () => {
    const SC = await loadSocialCalc();
    const out = SC.EditorGetStatuslineString(
      fakeEditor(),
      "calcloading",
      { sheetname: '<img src=x onerror=alert(1)>' },
      {},
    );
    expect(out).toBe(
      "undefined &nbsp; Calculating... Loading Sheet...: <img src=x onerror=alert(1)>",
    );
  });

  test("an ordinary sheet name renders unchanged in both modes", async () => {
    const SC = await loadSocialCalc();
    const trusted = SC.EditorGetStatuslineString(
      fakeEditor(),
      "calcloading",
      { sheetname: "OtherSheet" },
      {},
    );
    expect(trusted).toBe("undefined &nbsp; Calculating... Loading Sheet...: OtherSheet");

    SC.Callbacks.untrustedContent = true;
    const untrusted = SC.EditorGetStatuslineString(
      fakeEditor(),
      "calcloading",
      { sheetname: "OtherSheet" },
      {},
    );
    expect(untrusted).toBe("undefined &nbsp; Calculating... Loading Sheet...: OtherSheet");
  });
});

// ---------------------------------------------------------------------------
// Untrusted mode: the text-custom FORMAT TEMPLATE (valueformat, a
// "valueformat:" entry parsed from the save file) is sheet-authored data,
// just like the cell value. Sanitizing only the @r/@u placeholder values
// is not enough - literal event-handler/script markup embedded directly in
// the template must also be neutralized.
// ---------------------------------------------------------------------------
describe("untrusted mode: text-custom template markup itself (not just placeholder values)", () => {
  test("direct: an event-handler embedded in the template is escaped when untrusted, no sanitizer", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "hi",
      "t",
      'text-custom:<img src=x onerror="alert(1)">@s',
      null,
      "",
    );
    expect(out).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;hi');
  });

  test("direct: a <script> tag embedded in the template is escaped when untrusted, no sanitizer", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const out = SC.format_text_for_display(
      "hi",
      "t",
      "text-custom:<script>alert(1)</script>@s",
      null,
      "",
    );
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;hi');
  });

  test("direct: template markup is sanitized (not just placeholder values) when sanitizeHtml is configured", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    SC.Callbacks.securityPolicy = {
      sanitizeHtml: (html: string) => `SANITIZED(${html})`,
      allowedUrlSchemes: ["http:", "https:"],
      allowedDataMimeTypes: [],
    };
    const out = SC.format_text_for_display(
      "hi",
      "t",
      "text-custom:<img onerror=alert(1)>@s",
      null,
      "",
    );
    // Expanded first (template + raw @s substitution), then the whole
    // result is handed to sanitizeHtml in one pass.
    expect(out).toBe("SANITIZED(<img onerror=alert(1)>hi)");
  });

  test("direct: trusted (legacy) mode still renders template markup raw, including event handlers", async () => {
    const SC = await loadSocialCalc();
    const out = SC.format_text_for_display(
      "hi",
      "t",
      'text-custom:<img src=x onerror="alert(1)">@s',
      null,
      "",
    );
    expect(out).toBe('<img src=x onerror="alert(1)">hi');
  });

  test("render-level: a malicious text-custom valueformat template is neutralized when untrusted", async () => {
    const SC = await loadSocialCalc();
    SC.Callbacks.untrustedContent = true;
    const sheet = new SC.Sheet();
    sheet.valueformats[1] = "text-custom:<svg onload=alert(1)>@s";
    const cell = sheet.GetAssuredCell("A1");
    cell.valuetype = "t";
    cell.datatype = "v";
    cell.datavalue = "payload";
    cell.textvalueformat = 1;

    const out = String(SC.FormatValueForDisplay(sheet, "payload", "A1", ""));
    expect(out).toBe('&lt;svg onload=alert(1)&gt;payload');
  });

  test("render-level: trusted (default) mode still renders the same valueformat template raw", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.valueformats[1] = "text-custom:<svg onload=alert(1)>@s";
    const cell = sheet.GetAssuredCell("A1");
    cell.valuetype = "t";
    cell.datatype = "v";
    cell.datavalue = "payload";
    cell.textvalueformat = 1;

    const out = String(SC.FormatValueForDisplay(sheet, "payload", "A1", ""));
    expect(out).toBe("<svg onload=alert(1)>payload");
  });
});

// ---------------------------------------------------------------------------
// Untrusted mode: expand_text_link's pagename/{workspace [pagename]} branch
// passes sheet-authored parts.pagename/workspacename to the host's
// MakePageLink callback and previously trusted its return value blindly.
// MakePageLink is not assumed to return an XSS-safe URL (naive
// concatenation, missing escaping) any more than expand_wiki/expand_markup
// are assumed to return safe HTML.
// ---------------------------------------------------------------------------
describe("untrusted mode: expand_text_link validates MakePageLink's returned URL", () => {
  test("a MakePageLink callback returning a javascript: URL is rejected when untrusted", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.MakePageLink;
    SC.Callbacks.MakePageLink = (pagename: string) => `javascript:${pagename}`;
    SC.Callbacks.untrustedContent = true;
    try {
      const html = SC.expand_text_link("[alert(1)]", new SC.Sheet(), null, "text-link");
      expect(html).toBe(
        '<span style="font-size:smaller;text-decoration:none !important;background-color:#66B;color:#FFF;">Page</span>',
      );
    } finally {
      SC.Callbacks.MakePageLink = prev;
    }
  });

  test("a MakePageLink callback that naively concatenates pagename cannot break out of the href attribute when untrusted", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.MakePageLink;
    // Naive, non-escaping host implementation: sheet-authored pagename
    // text is concatenated directly into the URL.
    SC.Callbacks.MakePageLink = (pagename: string) => `/wiki/${pagename}`;
    SC.Callbacks.untrustedContent = true;
    try {
      const html = SC.expand_text_link(
        '[x" onmouseover="alert(1)]',
        new SC.Sheet(),
        null,
        "text-link",
      );
      // The embedded '"' that would have broken out of the href attribute
      // is percent-encoded by SafeUrlForRender's encodeURI pass, so the
      // attacker's literal `onmouseover="..."` attribute never forms.
      expect(html).toContain('href="/wiki/x%22%20onmouseover=%22alert(1)"');
      expect(html).not.toContain('onmouseover="alert');
    } finally {
      SC.Callbacks.MakePageLink = prev;
    }
  });

  test("a MakePageLink callback returning a safe URL still renders a live link when untrusted", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.MakePageLink;
    SC.Callbacks.MakePageLink = (pagename: string) => `https://wiki.example.com/${pagename}`;
    SC.Callbacks.untrustedContent = true;
    try {
      const html = SC.expand_text_link("[Home]", new SC.Sheet(), null, "text-link");
      expect(html).toBe(
        '<a href="https://wiki.example.com/Home" target="_blank"><span style="font-size:smaller;text-decoration:none !important;background-color:#66B;color:#FFF;">Page</span></a>',
      );
    } finally {
      SC.Callbacks.MakePageLink = prev;
    }
  });

  test("trusted (legacy) mode still trusts MakePageLink's return value unvalidated", async () => {
    const SC = await loadSocialCalc();
    const prev = SC.Callbacks.MakePageLink;
    SC.Callbacks.MakePageLink = (pagename: string) => `javascript:${pagename}`;
    try {
      const html = SC.expand_text_link("[alert(1)]", new SC.Sheet(), null, "text-link");
      expect(html).toBe(
        '<a href="javascript:alert(1)" target="_blank"><span style="font-size:smaller;text-decoration:none !important;background-color:#66B;color:#FFF;">Page</span></a>',
      );
    } finally {
      SC.Callbacks.MakePageLink = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// DOM-level: SocialCalc.RenderContext.RenderCell is the actual sink
// (`result.innerHTML = cell.displaystring`) that every fix above ultimately
// protects. This closes the loop from "the produced string is safe" to
// "the real DOM element's innerHTML is safe" for a genuinely malicious
// cell loaded via a real save-file parse.
// ---------------------------------------------------------------------------
describe("untrusted mode: DOM-level RenderCell sink (the actual innerHTML assignment)", () => {
  test("a malicious cell loaded from a save file cannot inject an active element into the rendered <td>", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    SC.Callbacks.untrustedContent = true;
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(
      [
        "version:1.5",
        `cell:A1:t:${SC.encodeForSave('<img src=x onerror="alert(1)">')}`,
        "sheet:c:1:r:1",
      ].join("\n") + "\n",
    );
    sheet.cells.A1.valuetype = "th";

    const context = new SC.RenderContext(sheet);
    // RenderSheet populates cellskip/precompute data that RenderCell needs
    // when called directly.
    context.RenderSheet(null);
    const td = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);

    expect(td.innerHTML).not.toContain("<img");
    expect(td.innerHTML).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("trusted (default) mode still renders the same save-loaded cell as live raw HTML in the <td>", async () => {
    installBrowserShim();
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(
      [
        "version:1.5",
        `cell:A1:t:${SC.encodeForSave('<img src=x onerror="alert(1)">')}`,
        "sheet:c:1:r:1",
      ].join("\n") + "\n",
    );
    sheet.cells.A1.valuetype = "th";

    const context = new SC.RenderContext(sheet);
    context.RenderSheet(null);
    const td = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);

    expect(td.innerHTML).toBe('<img src=x onerror="alert(1)">');
  });
});
