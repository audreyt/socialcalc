import { join } from "node:path";
import { pathToFileURL } from "node:url";

const bundleUrl = pathToFileURL(
    join(import.meta.dir, "..", "..", "dist", "SocialCalc.js"),
).href;

let loadNonce = 0;

const browserGlobalNames = [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Node",
    "self",
    "alert",
] as const;

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

    focus() {}

    blur() {}

    addEventListener() {}

    removeEventListener() {}
}

class FakeDocument {
    nodesById = new Map<string, FakeElement>();
    body: FakeElement;
    documentElement: FakeElement;
    forms: FakeElement[] = [];
    defaultView: any;

    constructor() {
        this.documentElement = new FakeElement(this, "html");
        this.body = new FakeElement(this, "body");
        this.documentElement.appendChild(this.body);
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

}

function clearBrowserShim() {
    for (const name of browserGlobalNames) {
        Reflect.deleteProperty(globalThis, name);
    }
}

export function installBrowserShim() {
    const document = new FakeDocument();
    const windowObject: any = {
        document,
        navigator: { language: "en-US", userAgent: "bun-test" },
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
        location: { href: "https://example.test/" },
    };

    document.defaultView = windowObject;

    (globalThis as any).window = windowObject;
    (globalThis as any).document = document;
    (globalThis as any).navigator = windowObject.navigator;
    (globalThis as any).HTMLElement = FakeElement;
    (globalThis as any).Node = FakeElement;
    (globalThis as any).self = windowObject;
    (globalThis as any).alert = windowObject.alert;

    return { windowObject, document };
}

export async function loadSocialCalc(options: { browser?: boolean } = {}) {
    if (options.browser) {
        installBrowserShim();
    } else {
        clearBrowserShim();
    }
    const mod = await import(`${bundleUrl}?bun-suite=${loadNonce++}`);
    return (mod as any).default ?? mod;
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
        const matches =
            typeof match === "function" ? match : (status: string) => status === match;
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
