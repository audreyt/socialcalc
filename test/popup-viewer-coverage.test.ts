import { afterEach, expect, test } from "bun:test";

import {
    loadSocialCalc as _loadSocialCalc,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// Track timers set by viewer code paths. This is important because
// ScheduleRender queues 1ms timers that try to read `document.body.style`
// at fire time — which crashes if a later test file loads SC without the
// browser shim. We wrap setTimeout/clearTimeout on globalThis+window so
// any timer scheduled during a test is force-cancelled in afterEach.
const liveTimers = new Set<ReturnType<typeof setTimeout>>();
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
function wrapTimerGlobals() {
    const wrappedSetTimeout = function (
        handler: any,
        timeout?: number,
        ...args: any[]
    ) {
        const id = originalSetTimeout(handler, timeout, ...args);
        liveTimers.add(id);
        return id;
    };
    const wrappedClearTimeout = function (id: any) {
        if (id) liveTimers.delete(id);
        return originalClearTimeout(id);
    };
    (globalThis as any).setTimeout = wrappedSetTimeout;
    (globalThis as any).clearTimeout = wrappedClearTimeout;
    const win = (globalThis as any).window;
    if (win) {
        win.setTimeout = wrappedSetTimeout;
        win.clearTimeout = wrappedClearTimeout;
    }
}

afterEach(() => {
    // Cancel any timers left over from the just-finished test.
    for (const id of liveTimers) {
        originalClearTimeout(id);
    }
    liveTimers.clear();
    // Restore original setTimeout so it doesn't leak into later files.
    (globalThis as any).setTimeout = originalSetTimeout;
    (globalThis as any).clearTimeout = originalClearTimeout;
    const win = (globalThis as any).window;
    if (win) {
        win.setTimeout = originalSetTimeout;
        win.clearTimeout = originalClearTimeout;
    }
});

// Load the bundle with the browser DOM shim + UI helpers installed.
async function fresh() {
    const SC = await _loadSocialCalc({ browser: true });
    installUiShim();
    wrapTimerGlobals();
    return SC;
}

// Build a minimal host element for a popup under a container on body.
function mountHost(hostId: string, tag: "div" | "span" = "div") {
    const container = document.createElement("div");
    container.id = `${hostId}-container`;
    (document as any).body.appendChild(container);
    const mount = document.createElement(tag);
    mount.id = hostId;
    container.appendChild(mount);
    // Provide non-zero dimensions so EnsurePosition / CreatePopupDiv have
    // something to work with.
    (mount as any).offsetHeight = 20;
    (mount as any).offsetWidth = 100;
    (container as any).offsetHeight = 400;
    (container as any).offsetWidth = 400;
    return { container, mount };
}

// -----------------------------------------------------------------------------
// Popup color utility helpers (every branch)
// -----------------------------------------------------------------------------

test("Popup color helpers: RGBToHex empty / valid / invalid", async () => {
    const SC = await fresh();
    // Empty input defaults to black.
    expect(SC.Popup.RGBToHex("")).toBe("000000");
    // Lowercase rgb still matches the digit regex.
    expect(SC.Popup.RGBToHex("rgb(10, 20, 30)")).toBe("0A141E");
    // Uppercase spaces and spaces around numbers still work.
    expect(SC.Popup.RGBToHex("RGB( 255 , 0 , 128 )")).toBe("FF0080");
    // Regex miss (no digits) returns "000000".
    expect(SC.Popup.RGBToHex("bogus")).toBe("000000");
});

test("Popup color helpers: ToHex / FromHex round-trip", async () => {
    const SC = await fresh();
    expect(SC.Popup.ToHex(0)).toBe("00");
    expect(SC.Popup.ToHex(15)).toBe("0F");
    expect(SC.Popup.ToHex(16)).toBe("10");
    expect(SC.Popup.ToHex(255)).toBe("FF");
    // Lowercase hex chars are upper-cased via charAt().toUpperCase().
    expect(SC.Popup.FromHex("ff")).toBe(255);
    expect(SC.Popup.FromHex("A0")).toBe(160);
    // Bad chars → -1 → coerced to 0.
    expect(SC.Popup.FromHex("ZZ")).toBe(0);
    // Single char → second char is empty → indexOf("") returns 0 for
    // non-HexDigits lookups; nibble decodes to 0.
    expect(SC.Popup.FromHex("F")).toBe(240);
});

test("Popup color helpers: HexToRGB handles full # hex", async () => {
    const SC = await fresh();
    // "#RRGGBB" parses to rgb(...).
    expect(SC.Popup.HexToRGB("#FFFFFF")).toBe("rgb(255,255,255)");
    expect(SC.Popup.HexToRGB("#000000")).toBe("rgb(0,0,0)");
    expect(SC.Popup.HexToRGB("#ff0080")).toBe("rgb(255,0,128)");
});

test("Popup color helpers: makeRGB and splitRGB", async () => {
    const SC = await fresh();
    // makeRGB clamps negatives to 0.
    expect(SC.Popup.makeRGB(10, 20, 30)).toBe("rgb(10,20,30)");
    expect(SC.Popup.makeRGB(-5, 20, 30)).toBe("rgb(0,20,30)");
    expect(SC.Popup.makeRGB(10, -5, 30)).toBe("rgb(10,0,30)");
    expect(SC.Popup.makeRGB(10, 20, -5)).toBe("rgb(10,20,0)");
    // splitRGB: must end with a non-digit after b (trailing comma/paren).
    expect(SC.Popup.splitRGB("rgb(1,2,3)")).toEqual({ r: 1, g: 2, b: 3 });
    expect(SC.Popup.splitRGB("junk")).toEqual({ r: 0, g: 0, b: 0 });
    expect(SC.Popup.splitRGB("")).toEqual({ r: 0, g: 0, b: 0 });
});

// -----------------------------------------------------------------------------
// Popup error paths + dispatch branches
// -----------------------------------------------------------------------------

test("Popup top-level: SetValue/GetValue/SetDisabled/Initialize error branches", async () => {
    const SC = await fresh();
    // Unknown control → alert(), return undefined. Using a string id that
    // isn't registered — should not throw.
    expect(() => SC.Popup.SetValue("no-such-id", "x")).not.toThrow();
    expect(() => SC.Popup.GetValue("no-such-id")).not.toThrow();
    expect(() => SC.Popup.SetDisabled("no-such-id", true)).not.toThrow();
    expect(() => SC.Popup.Initialize("no-such-id", {})).not.toThrow();
    expect(() => SC.Popup.CClick("no-such-id")).not.toThrow();
    // Close / Cancel with no current id are early-return no-ops.
    SC.Popup.Close();
    SC.Popup.Cancel();
});

test("Popup SetValue fires changedcallback", async () => {
    const SC = await fresh();
    const { mount } = mountHost("cb-popup", "span");
    let captured: any = null;
    SC.Popup.Create("List", "cb-popup", {
        title: "t",
        changedcallback: (attribs: any, id: string, newvalue: any) => {
            captured = { id, newvalue };
        },
    });
    SC.Popup.Initialize("cb-popup", {
        attribs: {},
        value: "",
        options: [{ o: "A", v: "a" }, { o: "B", v: "b" }],
    });
    SC.Popup.SetValue("cb-popup", "a");
    expect(captured).toEqual({ id: "cb-popup", newvalue: "a" });
    void mount;
});

test("Popup SetDisabled hides current open popup", async () => {
    const SC = await fresh();
    mountHost("sd-popup", "span");
    SC.Popup.Create("List", "sd-popup", { title: "t" });
    SC.Popup.Initialize("sd-popup", {
        attribs: {},
        value: "",
        options: [{ o: "A", v: "a" }],
    });
    SC.Popup.CClick("sd-popup"); // open
    expect(SC.Popup.Current.id).toBe("sd-popup");
    SC.Popup.SetDisabled("sd-popup", true);
    // After disable, Current.id is cleared.
    expect(SC.Popup.Current.id).toBeNull();
    // Re-enable — touches the SetDisabled false branch too.
    SC.Popup.SetDisabled("sd-popup", false);
});

test("Popup.Reset hits Hide branch when open", async () => {
    const SC = await fresh();
    mountHost("rs-popup", "span");
    SC.Popup.Create("List", "rs-popup", { title: "t" });
    SC.Popup.Initialize("rs-popup", {
        attribs: {},
        value: "",
        options: [{ o: "X", v: "x" }],
    });
    SC.Popup.CClick("rs-popup");
    expect(SC.Popup.Current.id).toBe("rs-popup");
    // Reset type "List" — hides and nullifies.
    SC.Popup.Reset("List");
    expect(SC.Popup.Current.id).toBeNull();
    // Reset with no-open branch is a no-op.
    SC.Popup.Reset("List");
});

test("Popup CClick with current-id and different id swaps popups", async () => {
    const SC = await fresh();
    mountHost("a-popup", "span");
    mountHost("b-popup", "span");
    SC.Popup.Create("List", "a-popup", { title: "a" });
    SC.Popup.Initialize("a-popup", { attribs: {}, value: "", options: [{ o: "X", v: "x" }] });
    SC.Popup.Create("List", "b-popup", { title: "b" });
    SC.Popup.Initialize("b-popup", { attribs: {}, value: "", options: [{ o: "Y", v: "y" }] });
    SC.Popup.CClick("a-popup");
    expect(SC.Popup.Current.id).toBe("a-popup");
    // Clicking a different popup closes a then opens b.
    SC.Popup.CClick("b-popup");
    expect(SC.Popup.Current.id).toBe("b-popup");
    // Clicking same open id again closes.
    SC.Popup.CClick("b-popup");
    expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup List
// -----------------------------------------------------------------------------

test("Popup List: SetValue with no-match defaults to Custom", async () => {
    const SC = await fresh();
    mountHost("nomatch-list", "span");
    SC.Popup.Create("List", "nomatch-list", { title: "t" });
    SC.Popup.Initialize("nomatch-list", {
        attribs: {},
        value: "",
        options: [
            { o: "A", v: "a" },
            { o: "skip-section", a: { skip: true } },
            { o: "custom", a: { custom: true } },
            { o: "cancel", a: { cancel: true } },
        ],
    });
    SC.Popup.SetValue("nomatch-list", "nonexistent");
    expect(SC.Popup.GetValue("nomatch-list")).toBe("nonexistent");
    // After no-match, display is "Custom" and `custom` flag set.
    const data = SC.Popup.Controls["nomatch-list"].data;
    expect(data.display).toBe("Custom");
    expect(data.custom).toBe(true);
});

test("Popup List: Show with custom=true opens custom form", async () => {
    const SC = await fresh();
    mountHost("custfirst-list", "span");
    SC.Popup.Create("List", "custfirst-list", { title: "t" });
    SC.Popup.Initialize("custfirst-list", {
        attribs: {},
        value: "",
        options: [
            { o: "A", v: "a" },
            { o: "custom", a: { custom: true } },
        ],
    });
    // Force custom flag: pick a value not in options list.
    SC.Popup.SetValue("custfirst-list", "not-in-options");
    expect(SC.Popup.Controls["custfirst-list"].data.custom).toBe(true);
    // Now Show → should invoke MakeCustom branch instead of MakeList.
    SC.Popup.CClick("custfirst-list");
    expect(SC.Popup.Controls["custfirst-list"].data.customele).toBeDefined();
    SC.Popup.Close();
});

test("Popup List: MakeList with value-highlighted option", async () => {
    const SC = await fresh();
    mountHost("match-list", "span");
    SC.Popup.Create("List", "match-list", { title: "t" });
    SC.Popup.Initialize("match-list", {
        attribs: {},
        value: "a",
        options: [
            { o: "A", v: "a" },
            { o: "B", v: "b" },
            { o: "-newcol", a: { newcol: true } },
            { o: "C", v: "c" },
        ],
    });
    // value="a" — MakeList should highlight entry a with background color.
    SC.Popup.CClick("match-list");
    const html = SC.Popup.Controls["match-list"].data.listdiv?.innerHTML || "";
    // Just ensure the data is populated without asserting on exact HTML.
    expect(SC.Popup.Controls["match-list"].data.ncols).toBeGreaterThanOrEqual(1);
    SC.Popup.Close();
    void html;
});

test("Popup List: CustomToList round-trip with ensureWithin", async () => {
    const SC = await fresh();
    const { container } = mountHost("ctl-list", "span");
    SC.Popup.Create("List", "ctl-list", { title: "t", ensureWithin: container });
    SC.Popup.Initialize("ctl-list", {
        attribs: {},
        value: "",
        options: [
            { o: "A", v: "a" },
            { o: "cust", v: "", a: { custom: true } },
        ],
    });
    SC.Popup.CClick("ctl-list");
    SC.Popup.Types.List.ItemClicked("ctl-list", 1); // swap to custom
    SC.Popup.Types.List.CustomToList("ctl-list"); // swap back
    SC.Popup.Close();
});

test("Popup List: ItemClicked cancel/custom/value and CustomOK", async () => {
    const SC = await fresh();
    mountHost("ic-list", "span");
    SC.Popup.Create("List", "ic-list", { title: "t", ensureWithin: document.body });
    SC.Popup.Initialize("ic-list", {
        attribs: {},
        value: "",
        options: [
            { o: "A", v: "a" },
            { o: "C", v: "", a: { custom: true } },
            { o: "X", v: "", a: { cancel: true } },
        ],
    });
    // Open, then click cancel entry → Popup.Close.
    SC.Popup.CClick("ic-list");
    SC.Popup.Types.List.ItemClicked("ic-list", 2);
    expect(SC.Popup.Current.id).toBeNull();
    // Open, then click custom entry → swap to custom form.
    SC.Popup.CClick("ic-list");
    SC.Popup.Types.List.ItemClicked("ic-list", 1);
    const data = SC.Popup.Controls["ic-list"].data;
    expect(data.customele).toBeDefined();
    // Fill and press OK.
    (data.customele as any).value = "custom-val";
    SC.Popup.Types.List.CustomOK("ic-list");
    expect(SC.Popup.GetValue("ic-list")).toBe("custom-val");
    // Reopen; click regular item → sets value and closes.
    SC.Popup.CClick("ic-list");
    SC.Popup.Types.List.ItemClicked("ic-list", 0);
    expect(SC.Popup.GetValue("ic-list")).toBe("a");
});

test("Popup List: MouseMove highlights cell; no-listdiv early return", async () => {
    const SC = await fresh();
    mountHost("mm-list", "span");
    SC.Popup.Create("List", "mm-list", { title: "t" });
    SC.Popup.Initialize("mm-list", {
        attribs: {},
        value: "",
        options: [{ o: "A", v: "a" }, { o: "B", v: "b" }],
    });
    SC.Popup.CClick("mm-list");
    const data = SC.Popup.Controls["mm-list"].data;
    // listdiv.firstChild is the inner <div>, whose firstChild is the table.
    // Invoke MouseMove with a synthetic child div so the highlight code runs.
    const dummy = document.createElement("div");
    expect(() => SC.Popup.Types.List.MouseMove("mm-list", dummy)).not.toThrow();
    SC.Popup.Close();

    // No listdiv → early return.
    const data2 = SC.Popup.Controls["mm-list"].data;
    data2.listdiv = null;
    expect(() => SC.Popup.Types.List.MouseMove("mm-list", dummy)).not.toThrow();
    void data;
});

// -----------------------------------------------------------------------------
// Popup ColorChooser
// -----------------------------------------------------------------------------

test("ColorChooser: SetColors default-value branch via empty", async () => {
    const SC = await fresh();
    mountHost("ccsc-pop", "div");
    SC.Popup.Create("ColorChooser", "ccsc-pop", {});
    SC.Popup.Initialize("ccsc-pop", { attribs: {}, value: "" });
    SC.Popup.CClick("ccsc-pop"); // Show → CreateGrid → SetColors default path
    expect(SC.Popup.Current.id).toBe("ccsc-pop");
    SC.Popup.Close();
});

test("ColorChooser Show with ensureWithin calls EnsurePosition", async () => {
    const SC = await fresh();
    const { container } = mountHost("ccew-pop", "div");
    SC.Popup.Create("ColorChooser", "ccew-pop", { ensureWithin: container });
    SC.Popup.Initialize("ccew-pop", { attribs: {}, value: "rgb(11,22,33)" });
    SC.Popup.CClick("ccew-pop");
    expect(SC.Popup.Current.id).toBe("ccew-pop");
    SC.Popup.Close();
});

test("ColorChooser SetValue default (empty) branch with backgroundImageDefault", async () => {
    const SC = await fresh();
    mountHost("ccbg-pop", "div");
    SC.Popup.Create("ColorChooser", "ccbg-pop", {
        title: "c",
        backgroundImage: "bg.gif",
        backgroundImageDefault: "bgdef.gif",
    });
    // SetValue with empty string → default branch.
    SC.Popup.SetValue("ccbg-pop", "");
    expect(SC.Popup.GetValue("ccbg-pop")).toBe("");
    // And without backgroundImageDefault option (no attribute): create a
    // second instance.
    mountHost("ccbg2-pop", "div");
    SC.Popup.Create("ColorChooser", "ccbg2-pop", {});
    SC.Popup.SetValue("ccbg2-pop", "");
    expect(SC.Popup.GetValue("ccbg2-pop")).toBe("");
});

test("ColorChooser SetDisabled with backgroundImageDisabled", async () => {
    const SC = await fresh();
    mountHost("ccdis-pop", "div");
    SC.Popup.Create("ColorChooser", "ccdis-pop", {
        backgroundImageDisabled: "disabled.gif",
    });
    SC.Popup.Initialize("ccdis-pop", { attribs: {}, value: "rgb(10,20,30)" });
    SC.Popup.SetDisabled("ccdis-pop", true);
    SC.Popup.SetDisabled("ccdis-pop", false);

    // Without backgroundImageDisabled (default branch).
    mountHost("ccdis2-pop", "div");
    SC.Popup.Create("ColorChooser", "ccdis2-pop", {});
    SC.Popup.Initialize("ccdis2-pop", { attribs: {}, value: "rgb(5,6,7)" });
    SC.Popup.SetDisabled("ccdis2-pop", true);
    SC.Popup.SetDisabled("ccdis2-pop", false);
});

test("ColorChooser Show with custom=true opens custom form", async () => {
    const SC = await fresh();
    mountHost("cccustfirst", "div");
    SC.Popup.Create("ColorChooser", "cccustfirst", { title: "c" });
    // Force custom=true via data.
    const data = SC.Popup.Controls["cccustfirst"].data;
    data.custom = true;
    data.value = "rgb(100,200,50)";
    SC.Popup.CClick("cccustfirst");
    expect(SC.Popup.Current.id).toBe("cccustfirst");
    expect(SC.Popup.Controls["cccustfirst"].data.customele).toBeDefined();
    SC.Popup.Close();
});

test("ColorChooser.Reset closes currently-open instance", async () => {
    const SC = await fresh();
    mountHost("ccreset-pop", "div");
    SC.Popup.Create("ColorChooser", "ccreset-pop", { title: "c" });
    SC.Popup.Initialize("ccreset-pop", { attribs: {}, value: "rgb(50,60,70)" });
    SC.Popup.CClick("ccreset-pop");
    expect(SC.Popup.Current.id).toBe("ccreset-pop");
    SC.Popup.Reset("ColorChooser");
    expect(SC.Popup.Current.id).toBeNull();
});

test("ColorChooser ItemClicked stub just closes", async () => {
    const SC = await fresh();
    mountHost("ccic-pop", "div");
    SC.Popup.Create("ColorChooser", "ccic-pop", {});
    SC.Popup.Initialize("ccic-pop", { attribs: {}, value: "rgb(1,2,3)" });
    SC.Popup.CClick("ccic-pop");
    SC.Popup.Types.ColorChooser.ItemClicked("ccic-pop", 0);
    expect(SC.Popup.Current.id).toBeNull();
});

test("ColorChooser CustomToList is a no-op stub", async () => {
    const SC = await fresh();
    mountHost("cccs-pop", "div");
    SC.Popup.Create("ColorChooser", "cccs-pop", {});
    expect(() => SC.Popup.Types.ColorChooser.CustomToList("cccs-pop")).not.toThrow();
});

test("ColorChooser ControlClicked opens or CloseOK if active", async () => {
    const SC = await fresh();
    mountHost("ccctl-pop", "div");
    SC.Popup.Create("ColorChooser", "ccctl-pop", {});
    SC.Popup.Initialize("ccctl-pop", { attribs: {}, value: "rgb(20,30,40)" });
    // Not active: calls CClick (opens).
    SC.Popup.Types.ColorChooser.ControlClicked("ccctl-pop");
    expect(SC.Popup.Current.id).toBe("ccctl-pop");
    // Active & same id: calls CloseOK → Close().
    SC.Popup.Types.ColorChooser.ControlClicked("ccctl-pop");
    expect(SC.Popup.Current.id).toBeNull();
});

test("ColorChooser DefaultClicked / CustomClicked / CloseOK guard clauses", async () => {
    const SC = await fresh();
    // With no current id, these should early-return without throwing.
    SC.Popup.Current.id = null;
    SC.Popup.Types.ColorChooser.DefaultClicked({});
    SC.Popup.Types.ColorChooser.CustomClicked({});
    SC.Popup.Types.ColorChooser.CloseOK({});
    SC.Popup.Types.ColorChooser.GridMouseDown({ type: "mousedown" });
});

test("ColorChooser GridMouseDown: mousemove without mousedown returns early", async () => {
    const SC = await fresh();
    mountHost("ccgmm-pop", "div");
    SC.Popup.Create("ColorChooser", "ccgmm-pop", {});
    SC.Popup.Initialize("ccgmm-pop", { attribs: {}, value: "rgb(30,40,50)" });
    SC.Popup.CClick("ccgmm-pop");
    // mousemove w/o prior mousedown → return; does not change value.
    const before = SC.Popup.GetValue("ccgmm-pop");
    SC.Popup.Types.ColorChooser.GridMouseDown({ type: "mousemove", clientX: 0, clientY: 0 });
    expect(SC.Popup.GetValue("ccgmm-pop")).toBe(before);

    // Trigger mousedown then mousemove then mouseup; covers all three cases.
    SC.Popup.Types.ColorChooser.GridMouseDown({ type: "mousedown", clientX: 10, clientY: 10 });
    SC.Popup.Types.ColorChooser.GridMouseDown({ type: "mousemove", clientX: 50, clientY: 50 });
    SC.Popup.Types.ColorChooser.GridMouseDown({ type: "mouseup", clientX: 60, clientY: 50 });
    SC.Popup.Close();
});

test("ColorChooser GridMouseDown covers all column cases (0..4)", async () => {
    const SC = await fresh();
    mountHost("ccgcol-pop", "div");
    SC.Popup.Create("ColorChooser", "ccgcol-pop", {});
    SC.Popup.Initialize("ccgcol-pop", { attribs: {}, value: "rgb(40,50,60)" });
    SC.Popup.CClick("ccgcol-pop");
    // Hit each col=0..4 by varying clientX. col = Math.floor((clientX-gpos.left)/20).
    for (const x of [5, 25, 45, 65, 85, 200, -50]) {
        SC.Popup.Types.ColorChooser.GridMouseDown({
            type: "mousedown",
            clientX: x,
            clientY: 50,
        });
    }
    // Include rows below 0 and above 15.
    SC.Popup.Types.ColorChooser.GridMouseDown({
        type: "mousedown",
        clientX: 45,
        clientY: -100,
    });
    SC.Popup.Types.ColorChooser.GridMouseDown({
        type: "mousedown",
        clientX: 45,
        clientY: 10000,
    });
    SC.Popup.Close();
});

test("ColorChooser Custom flow open → CustomOK sets hidden input value", async () => {
    const SC = await fresh();
    mountHost("cccust-pop", "div");
    SC.Popup.Create("ColorChooser", "cccust-pop", {});
    SC.Popup.Initialize("cccust-pop", { attribs: {}, value: "rgb(1,2,3)" });
    SC.Popup.CClick("cccust-pop");
    // Click "#" (custom) → switch to hex input form.
    SC.Popup.Types.ColorChooser.CustomClicked({});
    const data = SC.Popup.Controls["cccust-pop"].data;
    (data.customele as any).value = "AABBCC";
    SC.Popup.Types.ColorChooser.CustomOK("cccust-pop");
    expect(SC.Popup.GetValue("cccust-pop")).toBe("rgb(170,187,204)");
});

test("ColorChooser CustomClicked and CustomToGrid with ensureWithin", async () => {
    const SC = await fresh();
    const { container } = mountHost("ccewcc-pop", "div");
    SC.Popup.Create("ColorChooser", "ccewcc-pop", { ensureWithin: container });
    SC.Popup.Initialize("ccewcc-pop", { attribs: {}, value: "rgb(1,2,3)" });
    SC.Popup.CClick("ccewcc-pop");
    SC.Popup.Types.ColorChooser.CustomClicked({});
    const data = SC.Popup.Controls["ccewcc-pop"].data;
    (data.customele as any).value = "112233";
    SC.Popup.Types.ColorChooser.CustomToGrid("ccewcc-pop");
    expect(SC.Popup.GetValue("ccewcc-pop")).toBe("rgb(17,34,51)");
    SC.Popup.Close();
});

test("ColorChooser DestroyPopupDiv with drag-registered moveable popup", async () => {
    const SC = await fresh();
    mountHost("ccmove-pop", "div");
    SC.Popup.Create("ColorChooser", "ccmove-pop", {
        title: "Movable",
        moveable: true,
    });
    SC.Popup.Initialize("ccmove-pop", { attribs: {}, value: "rgb(5,6,7)" });
    // Monkey-patch DragRegister so we have a dragregistered target that
    // DragUnregister later can accept; also track the call.
    let dragRegistered = false;
    const origRegister = SC.DragRegister;
    const origUnregister = SC.DragUnregister;
    SC.DragRegister = function (...args: any[]) {
        dragRegistered = true;
        return (origRegister as any).apply(this, args);
    };
    SC.DragUnregister = function (...args: any[]) {
        return (origUnregister as any).apply(this, args);
    };
    SC.Popup.CClick("ccmove-pop");
    SC.Popup.Close();
    expect(dragRegistered).toBe(true);
    SC.DragRegister = origRegister;
    SC.DragUnregister = origUnregister;
});

// -----------------------------------------------------------------------------
// Popup: Create with type not registered — no-op
// -----------------------------------------------------------------------------

test("Popup Create with unknown type is a safe no-op", async () => {
    const SC = await fresh();
    expect(() => SC.Popup.Create("NoSuchType", "xyz", {})).not.toThrow();
});

test("Popup GetValue returns null when type dispatch misses", async () => {
    const SC = await fresh();
    mountHost("orphan-pop", "span");
    // Register a control with an unknown type manually so spc[id] exists
    // but spt[type].Create does not.
    SC.Popup.Controls["orphan-pop"] = { type: "MissingType", data: {} };
    expect(SC.Popup.GetValue("orphan-pop")).toBeNull();
});

// -----------------------------------------------------------------------------
// Viewer
// -----------------------------------------------------------------------------

test("Viewer constructor sets default properties", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer("viewer-prefix-");
    expect(viewer.idPrefix).toBe("viewer-prefix-");
    expect(viewer.hasStatusLine).toBe(true);
    expect(viewer.statuslineFull).toBe(true);
    expect(viewer.noRecalc).toBe(true);
    expect(viewer.repeatingMacroTimer).toBeNull();
    expect(viewer.repeatingMacroInterval).toBe(60);
    expect(viewer.repeatingMacroCommands).toBe("");
    // Default idPrefix fallback.
    const viewer2 = new SC.SpreadsheetViewer();
    expect(viewer2.idPrefix).toBe("SocialCalc-");
});

test("Viewer: InitializeSpreadsheetViewer with missing parent alerts & returns", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    // Pass a node id that doesn't exist → alert path.
    expect(() => viewer.InitializeSpreadsheetViewer("nonexistent-id")).not.toThrow();
});

test("Viewer: DoOnResize no-change early-returns", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "resize-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    // Second DoOnResize with same requestedHeight/width → SizeSSDiv returns
    // false → early return branch.
    viewer.DoOnResize();
    // Now trigger resize by changing requested dims.
    viewer.requestedHeight = 250;
    viewer.requestedWidth = 350;
    // Seed views so the for loop has iterations.
    viewer.views = {
        v1: { element: document.createElement("div") },
    };
    viewer.DoOnResize();
});

test("Viewer: CmdGotFocus sets passThru", async () => {
    const SC = await fresh();
    SC.CmdGotFocus(null);
    expect(SC.Keyboard.passThru).toBeNull();
    SC.CmdGotFocus(true);
    expect(SC.Keyboard.passThru).toBe(true);
    const ele = document.createElement("input");
    SC.CmdGotFocus(ele);
    expect(SC.Keyboard.passThru).toBe(ele);
});

test("Viewer: SpreadsheetViewerCreateSheetHTML returns HTML string", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "svhtml-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    // Seed synchronously via ParseSheetSave to avoid scheduled-recalc timers
    // that can outlive this test and crash unrelated suites.
    viewer.sheet.ParseSheetSave(
        "version:1.5\ncell:A1:t:Hello\ncell:B1:v:7\nsheet:c:2:r:1\n",
    );
    const html = SC.SpreadsheetViewerCreateSheetHTML(viewer);
    expect(typeof html).toBe("string");
});

test("Viewer: DoButtonCmd recalc + unknown + blur element", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "dbc-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    const btn = document.createElement("input");
    (btn as any).blur = () => {};
    SC.SpreadsheetViewerDoButtonCmd(
        { target: btn },
        null,
        { element: btn, functionobj: { command: "recalc" } },
    );
    SC.SpreadsheetViewerDoButtonCmd(
        { target: btn },
        null,
        { element: btn, functionobj: { command: "unknowncmd" } },
    );
    // Element without blur still runs through.
    SC.SpreadsheetViewerDoButtonCmd(
        { target: null },
        null,
        { element: null, functionobj: { command: "recalc" } },
    );
});

test("Viewer: StatuslineCallback with and without statuslineDiv / statuslineFull", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "slcb-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    const params = { spreadsheetobj: viewer };
    // statuslineFull = true → uses GetStatuslineString.
    SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, params);
    // Every status branch including the default.
    for (const status of [
        "cmdendnorender",
        "calcfinished",
        "doneposcalc",
        "calcstart",
        "schedrender",
    ]) {
        SC.SpreadsheetViewerStatuslineCallback(viewer.editor, status, null, params);
    }
    // statuslineFull = false → coord branch.
    viewer.statuslineFull = false;
    SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, params);
    // No spreadsheetobj in params → skip inner block.
    SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, {});
    // spreadsheet has no statuslineDiv → skip inner.
    const viewer2 = new SC.SpreadsheetViewer();
    SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, {
        spreadsheetobj: viewer2,
    });
});

test("Viewer: LoadSave with sheet + edit + startupmacro + repeatingmacro parts", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "lsmp-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);

    const boundary = "SCLOAD";
    const parts = [
        "socialcalc:version:1.0",
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary=${boundary}`,
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "# Header",
        "version:1.0",
        "part:sheet",
        "part:edit",
        "part:audit",
        "part:startupmacro",
        "part:repeatingmacro",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "version:1.5",
        "cell:A1:t:world",
        "sheet:c:1:r:1",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "version:1.0",
        "rowpane:0:1:1",
        "colpane:0:1:1",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "one",
        "two",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "recalc",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "0",
        "recalc",
        `--${boundary}--`,
        "",
    ].join("\n");
    viewer.LoadSave(parts);
    // A1 should be "world".
    expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("world");
    // repeatingMacroCommands populated with "recalc" (may include trailing
    // content from the section following the newline).
    expect(viewer.repeatingMacroCommands.trim()).toBe("recalc");
    // interval 0 means "don't start yet" — timer should remain null.
    expect(viewer.repeatingMacroTimer).toBeNull();
});

test("Viewer: LoadSave with repeating macro interval > 0 schedules timer", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "lsrm-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    const boundary = "SCRM";
    const parts = [
        "socialcalc:version:1.0",
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary=${boundary}`,
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "version:1.0",
        "part:sheet",
        "part:repeatingmacro",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "version:1.5",
        "cell:A1:t:x",
        "sheet:c:1:r:1",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "99999", // large delay so timer fires well after the test ends
        "recalc",
        `--${boundary}--`,
        "",
    ].join("\n");
    viewer.LoadSave(parts);
    expect(viewer.repeatingMacroInterval).toBe(99999);
    expect(viewer.repeatingMacroTimer).toBeTruthy();
    SC.SpreadsheetViewerStopRepeatingMacro();
    expect(viewer.repeatingMacroTimer).toBeNull();
});

test("Viewer: DoRepeatingMacro + RepeatMacroCommand", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "drm-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    viewer.repeatingMacroCommands = "recalc";
    // Manually seed a timer for StopRepeatingMacro to cancel.
    viewer.repeatingMacroTimer = setTimeout(() => {}, 99999);
    expect(viewer.repeatingMacroTimer).toBeTruthy();
    SC.SpreadsheetViewerStopRepeatingMacro();
    expect(viewer.repeatingMacroTimer).toBeNull();
    // DoRepeatingMacro schedules via EditorScheduleSheetCommands; wrap the
    // inner call to avoid async fallout.
    // The source accesses SocialCalc.SheetCommandInfo.CmdExtensionCallbacks
    // as if SheetCommandInfo were an object — it is actually a constructor,
    // so we need to assign the bag manually.
    (SC.SheetCommandInfo as any).CmdExtensionCallbacks = {};
    const origSched = viewer.editor.EditorScheduleSheetCommands;
    viewer.editor.EditorScheduleSheetCommands = function () {};
    try {
        SC.SpreadsheetViewerDoRepeatingMacro();
    } finally {
        viewer.editor.EditorScheduleSheetCommands = origSched;
    }
    // RepeatMacroCommand: build a Parse-like object with RestOfString().
    const cmd1 = {
        RestOfString: () => "5",
    };
    // `window` in the UMD-factory scope is actually `globalThis`, so the
    // source's `window.setTimeout` resolves to globalThis.setTimeout.
    const origSetTimeout = (globalThis as any).setTimeout;
    let calls = 0;
    (globalThis as any).setTimeout = function () {
        calls++;
        return 42;
    };
    try {
        SC.SpreadsheetViewerRepeatMacroCommand(
            "repeatmacro",
            null,
            viewer.sheet,
            cmd1,
            false,
        );
        expect(viewer.repeatingMacroInterval).toBe(5);
        // NaN/zero path — keeps previous interval.
        const cmd2 = { RestOfString: () => "notanumber" };
        SC.SpreadsheetViewerRepeatMacroCommand("x", null, viewer.sheet, cmd2, false);
        expect(viewer.repeatingMacroInterval).toBe(5);
    } finally {
        (globalThis as any).setTimeout = origSetTimeout;
    }
    expect(calls).toBeGreaterThanOrEqual(1);
    // Cleanup.
    if (viewer.repeatingMacroTimer) {
        clearTimeout(viewer.repeatingMacroTimer);
        viewer.repeatingMacroTimer = null;
    }
});

test("Viewer: StopRepeatingMacro when no timer is a no-op", async () => {
    const SC = await fresh();
    // Needs an active viewer to call GetSpreadsheetViewerObject.
    const viewer = new SC.SpreadsheetViewer();
    viewer.repeatingMacroTimer = null;
    SC.SpreadsheetViewerStopRepeatingMacro();
    expect(viewer.repeatingMacroTimer).toBeNull();
});

test("Viewer: GetSpreadsheetViewerObject throws when none set", async () => {
    const SC = await fresh();
    SC.CurrentSpreadsheetViewerObject = null;
    expect(() => SC.GetSpreadsheetViewerObject()).toThrow();
    // Re-set for subsequent tests.
    const v = new SC.SpreadsheetViewer();
    expect(SC.GetSpreadsheetViewerObject()).toBe(v);
});

test("Viewer: LocalizeString and LocalizeStringList", async () => {
    const SC = await fresh();
    const v = SC.LocalizeString("New");
    expect(typeof v).toBe("string");
    // Second call is cached in LocalizeStringList.
    expect(SC.LocalizeString("New")).toBe(v);
    expect(SC.LocalizeStringList).toBeDefined();
    expect(SC.LocalizeStringList["New"]).toBe(v);
});

test("Viewer: LocalizeSubstrings handles loc and ssc patterns", async () => {
    const SC = await fresh();
    // %loc! ... ! → SCLoc lookup.
    expect(SC.LocalizeSubstrings("A %loc!Edit! B")).toContain("Edit");
    // %ssc! name ! → SocialCalc.Constants[name] lookup; valid constant.
    expect(SC.LocalizeSubstrings("%ssc!defaultImagePrefix!")).toBe(
        SC.Constants.defaultImagePrefix,
    );
    // No substitutions — returned as-is.
    expect(SC.LocalizeSubstrings("plain text")).toBe("plain text");
});

test("Viewer: DecodeSpreadsheetSave early-returns on malformed inputs", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    // No MIME-Version header.
    expect(viewer.DecodeSpreadsheetSave("not a save")).toEqual({});
    // MIME-Version present but no Content-Type boundary.
    expect(
        viewer.DecodeSpreadsheetSave("MIME-Version: 1.0\nhello\n"),
    ).toEqual({});
    // Boundary present but no top boundary.
    const str1 = [
        "MIME-Version: 1.0",
        "Content-Type: multipart/mixed; boundary=XX",
        "",
    ].join("\n");
    expect(viewer.DecodeSpreadsheetSave(str1)).toEqual({});
    // With CR-only line endings so the replace branch runs.
    const withCR = "MIME-Version: 1.0\rnotamultipart\r";
    expect(viewer.DecodeSpreadsheetSave(withCR)).toEqual({});
});

test("Viewer: LoadSave with only sheet part and recalc=off", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "lsoff-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    // Toggle to recalc=off path to exercise ScheduleRender branch.
    viewer.editor.context.sheetobj.attribs.recalc = "off";
    const boundary = "SCOFF";
    const parts = [
        "socialcalc:version:1.0",
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary=${boundary}`,
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "version:1.0",
        "part:sheet",
        `--${boundary}`,
        "Content-type: text/plain; charset=UTF-8",
        "",
        "version:1.5",
        "cell:A1:t:off",
        "sheet:c:1:r:1",
        `--${boundary}--`,
        "",
    ].join("\n");
    viewer.LoadSave(parts);
    expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("off");

    // Now with noRecalc=false → else branch (EditorScheduleSheetCommands).
    const viewer2 = new SC.SpreadsheetViewer();
    const c2 = document.createElement("div");
    c2.id = "lsrecalc-host";
    (document as any).body.appendChild(c2);
    viewer2.InitializeSpreadsheetViewer(c2, 300, 400, 20);
    viewer2.noRecalc = false;
    viewer2.editor.context.sheetobj.attribs.recalc = "";
    const origSched = viewer2.editor.EditorScheduleSheetCommands;
    let scheduled: string | null = null;
    viewer2.editor.EditorScheduleSheetCommands = function (cmd: string) {
        scheduled = cmd;
    };
    viewer2.LoadSave(parts);
    expect(scheduled).toBe("recalc");
    viewer2.editor.EditorScheduleSheetCommands = origSched;
});

test("Viewer: LoadSave with non-multipart save returns without parsing", async () => {
    const SC = await fresh();
    const viewer = new SC.SpreadsheetViewer();
    const container = document.createElement("div");
    container.id = "lsnp-host";
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
    // Non-MIME string → DecodeSpreadsheetSave returns {} → no parts → just
    // recalc schedule path.
    expect(() => viewer.LoadSave("not a save string")).not.toThrow();
});

// -----------------------------------------------------------------------------
// Residual socialcalc-3 / formatnumber2 coverage nudges
// -----------------------------------------------------------------------------

test("RenderRow: hidden-row display:none and unhide icons on neighboring rows", async () => {
    const SC = await fresh();
    const sheet = new SC.Sheet();
    const ctx = new SC.RenderContext(sheet);
    // Hide row 2 → row 1 gets unhidetop icon, row 3 gets unhidebottom icon,
    // row 2 itself has display:none.
    sheet.rowattribs.hide[2] = "yes";
    // Pre-set a non-zero offsetHeight for the unhide elements path.
    ctx.rowunhidetop = {};
    ctx.rowunhidebottom = {};
    ctx.showRCHeaders = true;
    // First ensure rowpanes/colpanes are valid.
    ctx.rowpanes = [{ first: 1, last: 3 }];
    ctx.colpanes = [{ first: 1, last: 2 }];
    // Trigger full render.
    const result = ctx.RenderSheet(null, { type: "html" });
    expect(result).toBeDefined();
});

test("FormatValueForDisplay: widget valuetype 'i' branch", async () => {
    const SC = await fresh();
    const sheet = new SC.Sheet();
    // Create a cell with a widget valueinputwidget char, e.g., "ti" +
    // function-name.
    sheet.cells["A1"] = new SC.Cell("A1");
    sheet.cells["A1"].datavalue = "hello";
    sheet.cells["A1"].datatype = "f";
    sheet.cells["A1"].formula = 'TEXTBOX("hello")';
    sheet.cells["A1"].valuetype = "tiTEXTBOX";
    // ioParameterList must be an object so subscript doesn't throw.
    sheet.ioParameterList = { A1: {} };
    // Should not throw even though FunctionList may not define TEXTBOX in
    // this build — code path exits normally returning displayvalue.
    const out = SC.FormatValueForDisplay(sheet, "hello", "A1", "");
    expect(typeof out).toBe("string");
});

test("FormatValueForDisplay: forcetext and formula text-type branches", async () => {
    const SC = await fresh();
    const sheet = new SC.Sheet();
    const cell = (sheet.cells["B1"] = new SC.Cell("B1"));
    cell.datavalue = "text";
    cell.datatype = "t";
    cell.valuetype = "t";
    cell.nontextvalueformat = 0;
    // Register "formula" valueformat so the "formula" branch runs for text.
    sheet.valueformats = ["formula", "forcetext", "General"];
    cell.textvalueformat = 0; // index into valueformats → "formula"
    SC.FormatValueForDisplay(sheet, "text", "B1", "");
    // Now point at "forcetext" for the text branch (no explicit forcetext
    // for text types — fallback through format_text_for_display).
    cell.textvalueformat = 1;
    SC.FormatValueForDisplay(sheet, "text", "B1", "");

    // formula branch for number cell with formula datatype.
    const ncell = (sheet.cells["C1"] = new SC.Cell("C1"));
    ncell.datavalue = 42;
    ncell.datatype = "f";
    ncell.valuetype = "n";
    ncell.formula = "1+41";
    ncell.nontextvalueformat = 0; // "formula"
    SC.FormatValueForDisplay(sheet, 42, "C1", "");
    // forcetext branch for number cell.
    ncell.nontextvalueformat = 1; // "forcetext"
    ncell.datatype = "v";
    SC.FormatValueForDisplay(sheet, 42, "C1", "");
    // datatype "c" (constant) with forcetext.
    ncell.datatype = "c";
    ncell.formula = "x";
    SC.FormatValueForDisplay(sheet, 42, "C1", "");
    // datatype default branch (not f/c) with forcetext.
    ncell.datatype = "v";
    SC.FormatValueForDisplay(sheet, 42, "C1", "");

    // Unknown value type falls through to "&nbsp;".
    const dcell = (sheet.cells["D1"] = new SC.Cell("D1"));
    dcell.valuetype = "q"; // unknown
    dcell.datatype = "v";
    expect(SC.FormatValueForDisplay(sheet, "", "D1", "")).toBe("&nbsp;");
});

test("FormatValueForDisplay: cell with error returns the error message", async () => {
    const SC = await fresh();
    const sheet = new SC.Sheet();
    const cell = (sheet.cells["A1"] = new SC.Cell("A1"));
    cell.errors = "boom";
    cell.valuetype = "e";
    expect(SC.FormatValueForDisplay(sheet, "", "A1", "")).toBe("boom");
    // Error-type with no stored error uses the subtype.
    const c2 = (sheet.cells["A2"] = new SC.Cell("A2"));
    c2.valuetype = "edividebyzero";
    expect(SC.FormatValueForDisplay(sheet, "", "A2", "")).toBe("dividebyzero");
    // Error-type with empty subtype returns "Error in cell".
    const c3 = (sheet.cells["A3"] = new SC.Cell("A3"));
    c3.valuetype = "e";
    expect(SC.FormatValueForDisplay(sheet, "", "A3", "")).toBe("Error in cell");
});

test("FormatValueForDisplay: cell missing falls back to blank cell", async () => {
    const SC = await fresh();
    const sheet = new SC.Sheet();
    // Coord "Z99" not in sheet.cells — function creates an empty cell on
    // the fly.
    const out = SC.FormatValueForDisplay(sheet, "", "Z99", "");
    expect(typeof out).toBe("string");
});

test("Viewer: construct with _app true exercises app-mode branches", async () => {
    const SC = await fresh();
    SC._app = true;
    const viewer = new SC.SpreadsheetViewer("app-prefix-");
    expect(viewer.context.showGrid).toBe(false);
    expect(viewer.context.showRCHeaders).toBe(false);
    // App-mode init builds a formDataViewer when Initialize runs.
    const container = document.createElement("div");
    container.id = "appmode-host";
    // Give container a pre-existing firstChild so the removeChild loop runs.
    container.appendChild(document.createElement("span"));
    (document as any).body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 200, 300, 20);
    expect(viewer.formDataViewer).toBeDefined();
    // DoOnResize app branch skips ResizeTableEditor.
    viewer.DoOnResize();
    viewer.requestedHeight = 150;
    viewer.requestedWidth = 200;
    viewer.DoOnResize();
    // Clean up the flag.
    SC._app = false;
});

test("Viewer: construct with _view true exercises view-mode image prefix", async () => {
    const SC = await fresh();
    SC._view = true;
    const originalPrefix = SC.Constants.defaultImagePrefix;
    try {
        const viewer = new SC.SpreadsheetViewer();
        expect(viewer.imagePrefix).toContain("../");
    } finally {
        SC._view = false;
        SC.Constants.defaultImagePrefix = originalPrefix;
    }
});

test("Popup EnsurePosition: exercises multiple layout branches", async () => {
    const SC = await fresh();
    const container = document.createElement("div");
    container.id = "ep-container";
    (document as any).body.appendChild(container);
    (container as any).offsetHeight = 500;
    (container as any).offsetWidth = 500;
    (container as any).offsetTop = 0;
    (container as any).offsetLeft = 0;

    const mount = document.createElement("span");
    mount.id = "ep-pop";
    container.appendChild(mount);
    // Main element positioned near top-right of container.
    (mount as any).offsetHeight = 20;
    (mount as any).offsetWidth = 50;
    (mount as any).offsetTop = 10;
    (mount as any).offsetLeft = 400;

    SC.Popup.Create("List", "ep-pop", { title: "t", ensureWithin: container });
    SC.Popup.Initialize("ep-pop", {
        attribs: {},
        value: "",
        options: [
            { o: "A", v: "a" },
            { o: "B", v: "b" },
            { o: "C", v: "c" },
        ],
    });
    // Just exercise EnsurePosition under several sizes. Our fake DOM
    // reports layout values as 0 by default, but we can swing the popup
    // element's reported dimensions to drive different cases.
    SC.Popup.CClick("ep-pop");
    const data = SC.Popup.Controls["ep-pop"].data;
    const pop = data.popupele;
    if (pop) {
        (pop as any).offsetHeight = 100;
        (pop as any).offsetWidth = 100;
    }
    SC.Popup.EnsurePosition("ep-pop", container);
    // Swap main element to bottom of container; top is tight.
    (mount as any).offsetTop = 480;
    SC.Popup.EnsurePosition("ep-pop", container);
    // Tiny container → last-resort branch.
    (container as any).offsetHeight = 10;
    (container as any).offsetWidth = 10;
    SC.Popup.EnsurePosition("ep-pop", container);
    SC.Popup.Close();
});

test("Popup EnsurePosition: no main element firstChild → alert and return", async () => {
    const SC = await fresh();
    const container = document.createElement("div");
    container.id = "ep-null-c";
    (document as any).body.appendChild(container);
    const mount = document.createElement("span");
    mount.id = "ep-null-pop";
    container.appendChild(mount);
    SC.Popup.Create("List", "ep-null-pop", { title: "t" });
    SC.Popup.Initialize("ep-null-pop", {
        attribs: {},
        value: "",
        options: [{ o: "A", v: "a" }],
    });
    SC.Popup.CClick("ep-null-pop");
    // Clear mount firstChild so EnsurePosition hits the alert branch.
    while (mount.childNodes.length) {
        mount.removeChild(mount.childNodes[0]);
    }
    expect(() => SC.Popup.EnsurePosition("ep-null-pop", container)).not.toThrow();
});
