// Minimal, dependency-free `DOMParser` shim for unit tests only. Bun/Node's
// Vitest environment has no global `DOMParser` (confirmed: `typeof
// DOMParser === "undefined"` under `vp test`), so
// `SC.HtmlTable.BuildSheetSaveFromHtml`'s `new DOMParser().parseFromString`
// branch is otherwise unreachable from a unit test -- this shim exists
// purely to exercise that real branch under the 100%-coverage unit gate.
// It implements only the surface SC.HtmlTable actually reads (nodeType,
// tagName, childNodes, getAttribute, text nodeValue/textContent): no
// selectors, no innerHTML, no event handling, no script execution. The
// *real* browser DOMParser is exercised separately by
// e2e/html-table-paste.spec.ts (Playwright/Chromium).
//
// Do NOT reuse test/helpers/ui.ts's tokenizer: that one is wired to
// FakeElement/FakeDocument (installBrowserShim's `document.createElement`),
// which is a different, heavier surface than a standalone parsed Document.

type ShimNode = ShimElement | ShimText;

class ShimText {
  readonly nodeType = 3;
  readonly nodeValue: string;
  readonly textContent: string;
  constructor(text: string) {
    this.nodeValue = text;
    this.textContent = text;
  }
}

class ShimElement {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly childNodes: ShimNode[] = [];
  private readonly attrs: Record<string, string>;

  constructor(tag: string, attrs: Record<string, string>) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
  }

  appendChild(node: ShimNode): ShimNode {
    this.childNodes.push(node);
    return node;
  }

  getAttribute(name: string): string | null {
    const key = name.toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
  }
}

const VOID_TAGS: Record<string, true> = {
  br: true,
  hr: true,
  img: true,
  input: true,
  meta: true,
  link: true,
  col: true,
  wbr: true,
};

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, "\u00A0")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseAttrs(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrText)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

/** Parses `html` into a tree of ShimElement/ShimText rooted at a synthetic <html> element. */
function parseFragment(html: string): ShimElement {
  const root = new ShimElement("html", {});
  const stack: ShimElement[] = [root];
  const top = () => stack[stack.length - 1];

  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      const text = html.slice(i);
      if (text.trim().length) top().appendChild(new ShimText(decodeEntities(text)));
      break;
    }
    if (lt > i) {
      const text = html.slice(i, lt);
      if (text.trim().length) top().appendChild(new ShimText(decodeEntities(text)));
    }
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt === -1) break;
    const raw = html.slice(lt + 1, gt).trim();
    if (raw.startsWith("/")) {
      const closeTag = raw.slice(1).trim().toLowerCase();
      for (let idx = stack.length - 1; idx >= 1; idx--) {
        if (stack[idx].tagName.toLowerCase() === closeTag) {
          stack.length = idx;
          break;
        }
      }
      i = gt + 1;
      continue;
    }
    const selfClose = raw.endsWith("/");
    const body = selfClose ? raw.slice(0, -1).trim() : raw;
    const spaceIdx = body.search(/\s/);
    const tag = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
    const attrs = spaceIdx === -1 ? {} : parseAttrs(body.slice(spaceIdx + 1));
    const el = new ShimElement(tag, attrs);
    top().appendChild(el);
    if (!VOID_TAGS[tag] && !selfClose) stack.push(el);
    i = gt + 1;
  }
  return root;
}

class DOMParserShim {
  parseFromString(html: string, _mimeType: string): { documentElement: ShimElement } {
    return { documentElement: parseFragment(html) };
  }
}

interface GlobalWithDOMParser {
  DOMParser?: unknown;
}

/** Installs the shim as `globalThis.DOMParser`. Returns a restore function. */
export function installDOMParserShim(): () => void {
  const target = globalThis as GlobalWithDOMParser;
  const previous = target.DOMParser;
  target.DOMParser = DOMParserShim;
  return () => {
    if (previous === undefined) {
      delete target.DOMParser;
    } else {
      target.DOMParser = previous;
    }
  };
}
