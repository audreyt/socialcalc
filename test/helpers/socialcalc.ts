import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const bundleFile =
  process.env.SOCIALCALC_COVERAGE === "1" || process.env.SOCIALCALC_MUTATION_RUN === "1"
    ? "../../dist/SocialCalc.js"
    : "../../dist/SocialCalc.instrumented.js";
const bundlePath = fileURLToPath(new URL(bundleFile, import.meta.url));
const bundleScript = new Script(readFileSync(bundlePath, "utf8"), { filename: bundlePath });

// Coverage tests intentionally reach internal UMD surfaces beyond the public declarations.
let socialCalcInstance = Reflect.get(Object.create(null), "SocialCalc");

const browserGlobalNames = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Node",
  "self",
  "alert",
] as const;

const originalBrowserGlobals = new Map(
  browserGlobalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);

class FakeElement {
  ownerDocument: FakeDocument;
  tagName: string;
  nodeName: string;
  nodeType: number;
  childNodes: FakeElement[];
  parentNode: FakeElement | null;
  style: Record<string, string>;
  attributes: Record<string, string>;
  dataset: Record<string, string>;
  className: string;
  id: string;
  innerHTML: string;
  textContent: string;
  value: string;
  checked: boolean;
  scrollTop: number;
  scrollLeft: number;
  clientWidth: number;
  clientHeight: number;
  offsetWidth: number;
  offsetHeight: number;
  offsetTop: number;
  offsetLeft: number;
  eventListeners: Record<string, Array<(event: Event) => void>>;

  constructor(ownerDocument: FakeDocument, tagName: string, nodeType = 1) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = nodeType;
    this.childNodes = [];
    this.parentNode = null;
    this.style = { cssText: "" };
    this.attributes = {};
    this.dataset = {};
    this.className = "";
    this.id = "";
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientWidth = 1024;
    this.clientHeight = 768;
    this.offsetWidth = 100;
    this.offsetHeight = 20;
    this.offsetTop = 0;
    this.offsetLeft = 0;
    this.eventListeners = {};
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }

  appendChild(child: FakeElement) {
    child.parentNode = this;
    this.childNodes.push(child);
    this.ownerDocument.register(child);
    return child;
  }

  removeChild(child: FakeElement) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(child: FakeElement, before: FakeElement | null) {
    if (!before) {
      return this.appendChild(child);
    }
    const index = this.childNodes.indexOf(before);
    child.parentNode = this;
    if (index < 0) {
      this.childNodes.push(child);
    } else {
      this.childNodes.splice(index, 0, child);
    }
    this.ownerDocument.register(child);
    return child;
  }

  replaceChild(child: FakeElement, previous: FakeElement) {
    const index = this.childNodes.indexOf(previous);
    if (index >= 0) {
      child.parentNode = this;
      previous.parentNode = null;
      this.childNodes[index] = child;
      this.ownerDocument.register(child);
    }
    return previous;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
    if (name === "id") {
      this.id = value;
      this.ownerDocument.nodesById.set(value, this);
    } else if (name === "class") {
      this.className = value;
    } else if (name === "style") {
      this.style.cssText = value;
    }
  }

  getAttribute(name: string) {
    if (name === "id") return this.id;
    if (name === "class") return this.className;
    if (name === "style") return this.style.cssText || "";
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
    if (name === "class") this.className = "";
    if (name === "style") this.style.cssText = "";
  }

  // Minimal support for the one selector shape production code uses
  // against a rendered subtree: a leading "#id" match by exact id.
  querySelector(selector: string): FakeElement | null {
    if (!selector.startsWith("#")) return null;
    const id = selector.slice(1);
    const stack: FakeElement[] = [...this.childNodes];
    while (stack.length) {
      const node = stack.shift()!;
      if (node.id === id) return node;
      stack.push(...node.childNodes);
    }
    return null;
  }

  // Minimal support for role and attribute selector shapes used by callers;
  // this is intentionally not a general CSS engine.
  querySelectorAll(selector: string): FakeElement[] {
    const roleMatchers = selector
      .split(",")
      .map((part) => part.trim().match(/^\[role="([^"]+)"\]$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => match[1]);
    if (roleMatchers.length) {
      const results: FakeElement[] = [];
      const stack: FakeElement[] = [...this.childNodes];
      while (stack.length) {
        const node = stack.shift()!;
        if (roleMatchers.includes(node.attributes.role)) results.push(node);
        stack.push(...node.childNodes);
      }
      return results;
    }
    const match = /^([a-zA-Z0-9]*)\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector.trim());
    const results: FakeElement[] = [];
    if (!match) return results;
    const [, tag, attr, value] = match;
    const walk = (node: FakeElement) => {
      for (const child of node.childNodes) {
        const tagOk = !tag || child.tagName === tag.toUpperCase();
        const attrValue = child.getAttribute(attr);
        const attrOk = attrValue != null && (value === undefined || attrValue === value);
        if (tagOk && attrOk) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  focus() {}

  blur() {}

  addEventListener(type: string, listener: (event: Event) => void) {
    (this.eventListeners[type] ??= []).push(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.eventListeners[type];
    if (!listeners) return;
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  }

  dispatchEvent(event: Event) {
    for (const listener of this.eventListeners[event.type] ?? []) listener(event);
    return true;
  }
}

class FakeDocument {
  nodesById = new Map<string, FakeElement>();
  body: FakeElement;
  head: FakeElement;
  documentElement: FakeElement;
  forms: FakeElement[] = [];
  defaultView: any;

  constructor() {
    this.documentElement = new FakeElement(this, "html");
    this.head = new FakeElement(this, "head");
    this.body = new FakeElement(this, "body");
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  getElementsByTagName(tagName: string): FakeElement[] {
    if (tagName.toLowerCase() === "head") return [this.head];
    return [];
  }

  register(element: FakeElement) {
    if (element.id) {
      this.nodesById.set(element.id, element);
    }
    for (const child of element.childNodes) {
      this.register(child);
    }
  }

  createElement(tagName: string) {
    return new FakeElement(this, tagName);
  }

  createTextNode(text: string) {
    const node = new FakeElement(this, "#text", 3);
    node.textContent = text;
    node.nodeName = "#text";
    return node;
  }

  getElementById(id: string) {
    return this.nodesById.get(id) || null;
  }

  // Mirrors FakeElement's addEventListener/removeEventListener no-ops
  // above: document-level capture-phase listeners (SetMouseMoveUp/
  // RemoveMouseMoveUp, ProcessEditorMouseDown's resize/drag paths,
  // DragMouseDown, ...) call these directly on `document`, not on an
  // individual element, so FakeDocument needs the same supported surface.
  addEventListener() {}

  removeEventListener() {}
}

function clearBrowserShim() {
  for (const name of browserGlobalNames) {
    const descriptor = originalBrowserGlobals.get(name);
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
}

function setBrowserGlobal(name: (typeof browserGlobalNames)[number], value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function installBrowserShim() {
  const document = new FakeDocument();
  const windowObject: any = {
    document,
    navigator: { language: "en-US", userAgent: "vitest" },
    setTimeout,
    clearTimeout,
    getComputedStyle(element: FakeElement) {
      return element.style;
    },
    innerWidth: 1280,
    innerHeight: 720,
    pageXOffset: 0,
    pageYOffset: 0,
    scrollTo() {},
    focus() {},
    blur() {},
    alert() {},
    print() {},
    location: { href: "https://example.test/" },
  };

  document.defaultView = windowObject;

  setBrowserGlobal("window", windowObject);
  setBrowserGlobal("document", document);
  setBrowserGlobal("navigator", windowObject.navigator);
  setBrowserGlobal("HTMLElement", FakeElement);
  setBrowserGlobal("Node", FakeElement);
  setBrowserGlobal("self", windowObject);
  setBrowserGlobal("alert", windowObject.alert);

  return { windowObject, document };
}

export async function loadSocialCalc(options: { browser?: boolean } = {}) {
  if (options.browser) {
    installBrowserShim();
  } else {
    clearBrowserShim();
  }
  if (!socialCalcInstance) {
    bundleScript.runInThisContext();
    const initialized = Reflect.get(globalThis, "SocialCalc");
    if (!initialized || typeof initialized !== "object") {
      throw new Error("SocialCalc bundle did not initialize its global export");
    }
    socialCalcInstance = initialized;
  }
  return socialCalcInstance;
}

export function makeSave(lines: string[]) {
  return `${lines.join("\n")}\n`;
}

export function waitForStatus(
  sheet: any,
  match: string | ((status: string) => boolean),
  trigger: () => void,
  timeoutMs = 2000,
) {
  return new Promise<void>((resolve, reject) => {
    const previous = sheet.statuscallback;
    const matches = typeof match === "function" ? match : (status: string) => status === match;
    const timer = setTimeout(() => {
      sheet.statuscallback = previous;
      reject(new Error(`timed out waiting for ${String(match)}`));
    }, timeoutMs);

    sheet.statuscallback = (...args: any[]) => {
      previous?.(...args);
      const status = args[1];
      if (matches(status)) {
        clearTimeout(timer);
        sheet.statuscallback = previous;
        resolve();
      }
    };

    try {
      trigger();
    } catch (error) {
      clearTimeout(timer);
      sheet.statuscallback = previous;
      reject(error);
    }
  });
}

export async function recalcSheet(SC: any, sheet: any, timeoutMs = 2000) {
  // Reset recalc state before starting. RecalcInfo is shared across all
  // loadSocialCalc() callers in one isolated test worker, so a previous test
  // that scheduled a "recalc" command without awaiting calcfinished can
  // leave currentState != idle — RecalcSheet then just queues and never
  // fires, causing the subsequent test to time out.
  if (SC.RecalcInfo) {
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
  }
  await waitForStatus(sheet, "calcfinished", () => SC.RecalcSheet(sheet), timeoutMs);
}

export async function scheduleCommands(
  SC: any,
  sheet: any,
  commands: string | string[],
  saveundo = true,
  timeoutMs = 2000,
) {
  const commandString = Array.isArray(commands) ? commands.join("\n") : commands;
  await waitForStatus(
    sheet,
    "cmdend",
    () => SC.ScheduleSheetCommands(sheet, commandString, saveundo),
    timeoutMs,
  );
}

export async function sheetUndo(SC: any, sheet: any, timeoutMs = 2000) {
  await waitForStatus(sheet, "cmdend", () => SC.SheetUndo(sheet), timeoutMs);
}

export async function sheetRedo(SC: any, sheet: any, timeoutMs = 2000) {
  await waitForStatus(sheet, "cmdend", () => SC.SheetRedo(sheet), timeoutMs);
}
