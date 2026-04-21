// UI test helper: extends the FakeDocument / FakeElement shim in socialcalc.ts
// with a minimal HTML-to-DOM parser on innerHTML set, a getBoundingClientRect
// implementation, a no-op blur/focus, and a jQuery-like `$` stub sufficient
// for SpreadsheetControl initialization.
//
// Do NOT modify test/helpers/socialcalc.ts; this helper augments globals after
// installBrowserShim() has been called.

type AnyRec = Record<string, unknown>;

function tokenize(html: string): Array<{ type: "open" | "close" | "void" | "text"; tag?: string; attrs?: Record<string, string>; text?: string; selfClose?: boolean }> {
    const out: Array<{ type: "open" | "close" | "void" | "text"; tag?: string; attrs?: Record<string, string>; text?: string; selfClose?: boolean }> = [];
    const voidEls = new Set(["br", "hr", "img", "input", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);
    let i = 0;
    while (i < html.length) {
        const lt = html.indexOf("<", i);
        if (lt === -1) {
            const text = html.slice(i);
            if (text.length) out.push({ type: "text", text });
            break;
        }
        if (lt > i) {
            out.push({ type: "text", text: html.slice(i, lt) });
        }
        const gt = html.indexOf(">", lt + 1);
        const raw = html.slice(lt + 1, gt).trim();
        if (raw.startsWith("/")) {
            out.push({ type: "close", tag: raw.slice(1).trim().toLowerCase() });
            i = gt + 1;
            continue;
        }
        // opening or self-closing
        const selfClose = raw.endsWith("/");
        const body = selfClose ? raw.slice(0, -1).trim() : raw;
        const spaceIdx = body.search(/\s/);
        const tag = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
        const attrs: Record<string, string> = {};
        if (spaceIdx !== -1) {
            const attrStr = body.slice(spaceIdx + 1);
            // parse attrs: name="val" or name='val' or name=val or name
            const re = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(attrStr)) !== null) {
                const name = m[1];
                const value = m[2] ?? m[3] ?? m[4] ?? "";
                attrs[name] = value;
            }
        }
        const isVoid = voidEls.has(tag) || selfClose;
        out.push({ type: isVoid ? "void" : "open", tag, attrs, selfClose });
        i = gt + 1;
    }
    return out;
}

function decodeEntities(text: string): string {
    return text
        .replace(/&nbsp;/g, "\u00A0")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function applyAttrs(el: AnyRec, attrs: Record<string, string>) {
    const setAttribute = (el as any).setAttribute?.bind(el);
    for (const [name, value] of Object.entries(attrs)) {
        if (!setAttribute) continue;
        setAttribute(name, value);
        // Common ones we also mirror as properties so the SocialCalc code
        // reading element.src / element.title / element.value etc works.
        const lname = name.toLowerCase();
        if (lname === "id") {
            (el as any).id = value;
        } else if (lname === "class") {
            (el as any).className = value;
        } else if (lname === "src" || lname === "href" || lname === "title" || lname === "alt" || lname === "name" || lname === "type" || lname === "value" || lname === "placeholder") {
            (el as any)[lname] = value;
        } else if (lname === "cellspacing" || lname === "cellpadding") {
            (el as any)[lname === "cellspacing" ? "cellSpacing" : "cellPadding"] = value;
        } else if (lname === "style") {
            // split by ; and set style.prop = val
            const parts = value.split(";");
            for (const part of parts) {
                const colon = part.indexOf(":");
                if (colon === -1) continue;
                const k = part.slice(0, colon).trim();
                const v = part.slice(colon + 1).trim();
                if (!k) continue;
                // camelCase CSS property names for simplicity
                const camel = k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
                ((el as any).style as any)[camel] = v;
                ((el as any).style as any)[k] = v;
            }
            ((el as any).style as any).cssText = value;
        } else if (lname === "selected" || lname === "checked" || lname === "disabled") {
            (el as any)[lname] = true;
        }
    }
}

function buildFromTokens(ownerDoc: any, tokens: ReturnType<typeof tokenize>): any[] {
    // Build a flat list of top-level nodes
    const roots: any[] = [];
    const stack: any[] = [];
    const pushChild = (node: any) => {
        if (stack.length) {
            const parent = stack[stack.length - 1];
            parent.appendChild(node);
        } else {
            roots.push(node);
        }
    };
    const ensureTbody = () => {
        // If immediate parent is <table> and we're inserting a <tr>, insert
        // an implicit <tbody> wrapper, matching real browser behavior.
        if (stack.length === 0) return;
        const top = stack[stack.length - 1];
        if ((top.tagName || "").toLowerCase() === "table") {
            const tbody = ownerDoc.createElement("tbody");
            top.appendChild(tbody);
            stack.push(tbody);
        }
    };
    for (const t of tokens) {
        if (t.type === "text") {
            const text = decodeEntities(t.text ?? "");
            if (!text) continue;
            if (stack.length === 0 && /^\s*$/.test(text)) continue;
            const textNode = ownerDoc.createTextNode(text);
            pushChild(textNode);
        } else if (t.type === "open") {
            if (t.tag === "tr") ensureTbody();
            const el = ownerDoc.createElement(t.tag ?? "div");
            if (t.attrs) applyAttrs(el, t.attrs);
            pushChild(el);
            stack.push(el);
        } else if (t.type === "void") {
            const el = ownerDoc.createElement(t.tag ?? "br");
            if (t.attrs) applyAttrs(el, t.attrs);
            pushChild(el);
        } else if (t.type === "close") {
            // pop matching (and any implicit wrappers between)
            for (let i = stack.length - 1; i >= 0; i--) {
                if ((stack[i].tagName || "").toLowerCase() === t.tag) {
                    stack.length = i;
                    break;
                }
            }
        }
    }
    return roots;
}

/**
 * Install the extensions. Safe to call multiple times per bun-test run; we
 * reset state but don't re-wire descriptors if already wired on the same
 * FakeElement prototype.
 */
export function installUiShim(): void {
    const doc = (globalThis as any).document;
    const bodyProto = Object.getPrototypeOf(doc.body);

    // Always (re)patch createElement / style handling on the current
    // document. loadSocialCalc re-installs the browser shim between test
    // files, replacing doc + body; we must re-decorate each time.
    if (!(doc as any).__createElementPatched) {
        const enhanceElement = (el: any) => {
            delete el.innerHTML;
            // Wrap the .style object so `style.cssText = "..."` parses into
            // individual properties.
            const base = el.style;
            const expand = (k: string, v: string, target: Record<string, string>) => {
                const camel = k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
                target[k] = v;
                target[camel] = v;
                // Expand common shorthands so `style.paddingTop.slice(...)` works.
                if (k === "padding" || k === "margin") {
                    const tokens = v.trim().split(/\s+/);
                    let top = "0px",
                        right = "0px",
                        bottom = "0px",
                        left = "0px";
                    if (tokens.length === 1) {
                        top = right = bottom = left = tokens[0];
                    } else if (tokens.length === 2) {
                        top = bottom = tokens[0];
                        right = left = tokens[1];
                    } else if (tokens.length >= 4) {
                        top = tokens[0];
                        right = tokens[1];
                        bottom = tokens[2];
                        left = tokens[3];
                    }
                    target[`${k}Top`] = top;
                    target[`${k}Right`] = right;
                    target[`${k}Bottom`] = bottom;
                    target[`${k}Left`] = left;
                    target[`${k}-top`] = top;
                    target[`${k}-right`] = right;
                    target[`${k}-bottom`] = bottom;
                    target[`${k}-left`] = left;
                }
            };
            const styleProxy = new Proxy(base, {
                set(target, prop, value) {
                    if (prop === "cssText" && typeof value === "string") {
                        // Parse and set each declaration.
                        target.cssText = value;
                        const parts = value.split(";");
                        for (const p of parts) {
                            const colon = p.indexOf(":");
                            if (colon === -1) continue;
                            const k = p.slice(0, colon).trim();
                            const v = p.slice(colon + 1).trim();
                            if (!k) continue;
                            expand(k, v, target as Record<string, string>);
                        }
                        return true;
                    }
                    target[prop as any] = value;
                    // Mirror camel <-> kebab simple mappings so getters from either side work.
                    if (typeof prop === "string" && /[A-Z]/.test(prop)) {
                        const kebab = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
                        target[kebab] = value;
                    }
                    return true;
                },
                get(target, prop) {
                    const v = target[prop as any];
                    if (v !== undefined) return v;
                    // For padding/margin sub-properties, default to "0px" so
                    // code like `style.paddingTop.slice(0,-2)` doesn't crash.
                    if (
                        typeof prop === "string" &&
                        /^(padding|margin)(Top|Right|Bottom|Left)$/.test(prop)
                    ) {
                        return "0px";
                    }
                    return v;
                },
            });
            Object.defineProperty(el, "style", {
                value: styleProxy,
                configurable: true,
                writable: false,
            });
            return el;
        };
        const origCreate = doc.createElement.bind(doc);
        doc.createElement = function (tagName: string) {
            return enhanceElement(origCreate(tagName));
        };
        const origCreateText = doc.createTextNode.bind(doc);
        doc.createTextNode = function (text: string) {
            const el: any = origCreateText(text);
            // Text nodes still have innerHTML own property from base ctor.
            delete el.innerHTML;
            return el;
        };
        // Also enhance body/documentElement.
        enhanceElement(doc.body);
        enhanceElement(doc.documentElement);
        (doc as any).__createElementPatched = true;
    }

    if (!bodyProto.__uiShimInstalled) {
        const innerDesc = Object.getOwnPropertyDescriptor(bodyProto, "innerHTML");
        // The shim stores innerHTML directly as instance property.
        // We redefine the accessor on the prototype so sets parse HTML.
        Object.defineProperty(bodyProto, "innerHTML", {
            configurable: true,
            get(this: any) {
                return this.__html ?? "";
            },
            set(this: any, value: string) {
                this.__html = String(value);
                // Clear children.
                while (this.childNodes.length) {
                    this.removeChild(this.childNodes[this.childNodes.length - 1]);
                }
                // Parse and build.
                const tokens = tokenize(String(value));
                const roots = buildFromTokens(this.ownerDocument, tokens);
                for (const root of roots) this.appendChild(root);
            },
        });

        // Provide getBoundingClientRect for position calculations.
        bodyProto.getBoundingClientRect = function () {
            return {
                left: this.offsetLeft ?? 0,
                right: (this.offsetLeft ?? 0) + (this.offsetWidth ?? 0),
                top: this.offsetTop ?? 0,
                bottom: (this.offsetTop ?? 0) + (this.offsetHeight ?? 0),
                width: this.offsetWidth ?? 0,
                height: this.offsetHeight ?? 0,
            };
        };

        bodyProto.click = function () {};
        bodyProto.select = function () {};

        // Options shim for HTMLSelectElement-like behavior used by DoCmd
        // e.g. clele.options[i] = new Option(...); clele.length = 0;
        if (!bodyProto.__selectShim) {
            Object.defineProperty(bodyProto, "options", {
                configurable: true,
                get(this: any) {
                    return (this.__options ??= []);
                },
            });
            Object.defineProperty(bodyProto, "length", {
                configurable: true,
                set(this: any, val: number) {
                    (this.__options ??= []).length = val;
                },
            });
            Object.defineProperty(bodyProto, "selectedIndex", {
                configurable: true,
                get(this: any) {
                    return this.__selectedIndex ?? 0;
                },
                set(this: any, val: number) {
                    this.__selectedIndex = val;
                },
            });
            bodyProto.__selectShim = true;
        }

        bodyProto.__uiShimInstalled = true;
        // Ensure consistent listener tracking for synthetic events (optional).
        const origAdd = bodyProto.addEventListener;
        bodyProto.addEventListener = function (type: string, fn: any) {
            if (!this.__listeners) this.__listeners = {};
            if (!this.__listeners[type]) this.__listeners[type] = [];
            this.__listeners[type].push(fn);
            return origAdd?.call(this, type, fn);
        };
        // Suppress spurious argument by accepting them.
        void innerDesc;
    }

    const win: any = (globalThis as any).window;
    // Provide Option constructor used in SpreadsheetCmdTable fills.
    if (!(globalThis as any).Option) {
        (globalThis as any).Option = function (this: any, text: string, value?: string) {
            this.text = text;
            this.value = value ?? text;
            this.selected = false;
        };
    }
    // jQuery-like stub: supports $("<html>"), $("#id"), .append, .on, .keyup, .text, [0].
    if (!(globalThis as any).$) {
        (globalThis as any).$ = makeJqStub();
    }
    // The UMD wrapper binds its inner `window` to `globalThis`, but SocialCalc
    // expects that object to behave like a browser window. Copy a few members
    // from our shim windowObject onto globalThis so `window.focus()`,
    // `window.setTimeout`, `window.innerWidth` etc. do not crash.
    const mirror = [
        "focus",
        "blur",
        "scrollTo",
        "setTimeout",
        "clearTimeout",
        "getComputedStyle",
        "alert",
        "innerWidth",
        "innerHeight",
        "pageXOffset",
        "pageYOffset",
    ];
    for (const key of mirror) {
        if ((globalThis as any)[key] === undefined && win?.[key] !== undefined) {
            (globalThis as any)[key] = win[key];
        }
    }
}

function makeJqStub() {
    function q(selOrHtml: string) {
        const doc = (globalThis as any).document;
        const trimmed = selOrHtml.trim();
        if (trimmed.startsWith("<")) {
            // Create element from HTML string by parsing via a detached div.
            const div = doc.createElement("div");
            div.innerHTML = trimmed;
            return wrap([...div.childNodes]);
        }
        // #id selector
        const el = doc.getElementById(trimmed.slice(1));
        return wrap(el ? [el] : []);
    }
    function wrap(nodes: any[]) {
        const obj: any = Object.assign(Object.create(null), {
            0: nodes[0],
            length: nodes.length,
            append(child: any) {
                if (!nodes.length) return obj;
                const parent = nodes[0];
                if (typeof child === "string") {
                    const doc = (globalThis as any).document;
                    const div = doc.createElement("div");
                    div.innerHTML = child;
                    for (const n of [...div.childNodes]) parent.appendChild(n);
                } else {
                    for (let i = 0; i < child.length; i++) parent.appendChild(child[i]);
                }
                return obj;
            },
            on(event: string, fn: any) {
                if (nodes[0]) (nodes[0].__jqHandlers ??= {})[event] = fn;
                return obj;
            },
            keyup(fn: any) {
                if (nodes[0]) (nodes[0].__jqHandlers ??= {}).keyup = fn;
                return obj;
            },
            text(val: string) {
                for (const n of nodes) n.textContent = val;
                return obj;
            },
        });
        // iterable positions
        for (let i = 0; i < nodes.length; i++) obj[i] = nodes[i];
        return obj;
    }
    return q;
}
