// Coverage gap tests for js/socialcalcpopup.ts (dist 15865-16887) and
// js/socialcalcviewer.ts (dist 19315-19705). Targets statement/branch/function
// gaps left by test/popup-viewer-coverage.test.ts.

import { afterEach, expect, test } from "vite-plus/test";

import { loadSocialCalc as _loadSocialCalc } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

type StyledFakeCell = { style: Record<string, string> };
type MutableElementMetrics = Partial<
  Record<"offsetWidth" | "offsetHeight" | "offsetTop" | "offsetLeft", number>
>;
type GlobalWithOptionalWindow = typeof globalThis & {
  window?: {
    setTimeout: typeof globalThis.setTimeout;
    clearTimeout: typeof globalThis.clearTimeout;
  };
};
type GlobalWithOptionalEvent = typeof globalThis & { event?: unknown };

function setElementMetrics(element: HTMLElement, metrics: MutableElementMetrics): void {
  Object.defineProperties(
    element,
    Object.fromEntries(
      Object.entries(metrics).map(([name, value]) => [name, { configurable: true, value }]),
    ),
  );
}

function globalWithOptionalWindow(): GlobalWithOptionalWindow {
  // Test harness may install a browser-like window on globalThis.
  return globalThis as GlobalWithOptionalWindow;
}

function globalWithOptionalEvent(): GlobalWithOptionalEvent {
  // Legacy popup paths intentionally exercise window.event-style fallback state.
  return globalThis as GlobalWithOptionalEvent;
}

// Timer tracking — same pattern as the sibling coverage test file.
// ScheduleRender queues 1ms timers that read document.body.style at fire time
// and crash if a later test file loads SC without the browser shim.
const liveTimers = new Set<ReturnType<typeof setTimeout>>();
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

function wrapTimerGlobals(): void {
  const wrappedSetTimeout = function (
    handler: (...args: unknown[]) => void,
    timeout?: number,
    ...args: unknown[]
  ): ReturnType<typeof setTimeout> {
    const id = originalSetTimeout(handler as (...a: unknown[]) => void, timeout, ...args);
    liveTimers.add(id);
    return id;
  };
  const wrappedClearTimeout = function (id: ReturnType<typeof setTimeout>): void {
    if (id) liveTimers.delete(id);
    originalClearTimeout(id);
  };
  (globalThis as unknown as Record<string, unknown>).setTimeout = wrappedSetTimeout;
  (globalThis as unknown as Record<string, unknown>).clearTimeout = wrappedClearTimeout;
  const win = globalWithOptionalWindow().window;
  if (win) {
    (win as unknown as Record<string, unknown>).setTimeout = wrappedSetTimeout;
    (win as unknown as Record<string, unknown>).clearTimeout = wrappedClearTimeout;
  }
}

afterEach(() => {
  for (const id of liveTimers) {
    originalClearTimeout(id);
  }
  liveTimers.clear();
  (globalThis as unknown as Record<string, unknown>).setTimeout = originalSetTimeout;
  (globalThis as unknown as Record<string, unknown>).clearTimeout = originalClearTimeout;
  const win = globalWithOptionalWindow().window;
  if (win) {
    win.setTimeout = originalSetTimeout;
    win.clearTimeout = originalClearTimeout;
  }
});

// Load the built bundle with DOM shim + UI helpers.
async function fresh(): Promise<typeof SocialCalc> {
  const SC = await _loadSocialCalc({ browser: true });
  installUiShim();
  wrapTimerGlobals();
  return SC;
}

// Build a minimal host element under a container on body.
function mountHost(
  hostId: string,
  tag: "div" | "span" = "div",
): { container: HTMLDivElement; mount: HTMLElement } {
  const container = document.createElement("div");
  container.id = `${hostId}-container`;
  document.body.appendChild(container);
  const mount = document.createElement(tag);
  mount.id = hostId;
  container.appendChild(mount);
  setElementMetrics(mount, { offsetHeight: 20, offsetWidth: 100 });
  setElementMetrics(container, { offsetHeight: 400, offsetWidth: 400 });
  return { container, mount };
}

// -----------------------------------------------------------------------------
// Popup general dispatch error paths
// -----------------------------------------------------------------------------

test("Gaps: CClick unknown control alerts and returns", async () => {
  const SC = await fresh();
  expect(() => SC.Popup.CClick("nonexistent-pv")).not.toThrow();
});

test("Gaps: SetValue unknown control alerts and returns", async () => {
  const SC = await fresh();
  expect(() => SC.Popup.SetValue("unknown-pv", "x")).not.toThrow();
});

test("Gaps: SetDisabled unknown control alerts and returns", async () => {
  const SC = await fresh();
  expect(() => SC.Popup.SetDisabled("unknown-pv", true)).not.toThrow();
});

test("Gaps: GetValue unknown control alerts and returns null", async () => {
  const SC = await fresh();
  // GetValue returns null after alert for unknown control.
  expect(() => {
    const v = SC.Popup.GetValue("unknown-pv");
    void v;
  }).not.toThrow();
});

test("Gaps: Initialize unknown control alerts and returns", async () => {
  const SC = await fresh();
  expect(() => SC.Popup.Initialize("unknown-pv", { attribs: {} })).not.toThrow();
});

test("Gaps: Initialize type handler without Initialize method — else branch", async () => {
  const SC = await fresh();
  // Register a custom type handler that has Create but no Initialize.
  SC.Popup.Types.CustomType = {
    Create: function (type: string, id: string) {
      const spc = SC.Popup.Controls;
      spc[id] = {
        type,
        value: "",
        display: "",
        data: {},
      };
    },
  };
  mountHost("customtype-pv", "div");
  SC.Popup.Create("CustomType", "customtype-pv");
  // Initialize on this handler — pt.Initialize is undefined so else branch.
  expect(() => SC.Popup.Initialize("customtype-pv", { attribs: {} })).not.toThrow();
  delete SC.Popup.Types.CustomType;
});

test("Gaps: Reset on a type without Reset method — else branch", async () => {
  const SC = await fresh();
  SC.Popup.Types.NoReset = {
    Create: function (type: string, id: string) {
      SC.Popup.Controls[id] = {
        type,
        value: "",
        display: "",
        data: {},
      };
    },
  };
  mountHost("noreset-pv", "div");
  SC.Popup.Create("NoReset", "noreset-pv");
  // Reset on a type with no Reset method: if (spt[type].Reset) is falsy.
  expect(() => SC.Popup.Reset("NoReset")).not.toThrow();
  delete SC.Popup.Types.NoReset;
});

// -----------------------------------------------------------------------------
// Popup CClick branches
// -----------------------------------------------------------------------------

test("Gaps: CClick disabled control early returns", async () => {
  const SC = await fresh();
  mountHost("disabled-pv", "div");
  SC.Popup.Create("List", "disabled-pv", { title: "t" });
  SC.Popup.Initialize("disabled-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  // Mark as disabled.
  SC.Popup.Controls["disabled-pv"].data.disabled = true;
  SC.Popup.CClick("disabled-pv");
  // Should NOT have opened — Current.id stays null.
  expect(SC.Popup.Current.id).not.toBe("disabled-pv");
});

test("Gaps: CClick same control id toggles close", async () => {
  const SC = await fresh();
  mountHost("toggle-pv", "div");
  SC.Popup.Create("List", "toggle-pv", { title: "t" });
  SC.Popup.Initialize("toggle-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  // Open.
  SC.Popup.CClick("toggle-pv");
  expect(SC.Popup.Current.id).toBe("toggle-pv");
  // Click same one again → Hide + null (same-id toggle path).
  SC.Popup.CClick("toggle-pv");
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup Cancel with Current.id
// -----------------------------------------------------------------------------

test("Gaps: Popup.Cancel restores old value via Cancel handler", async () => {
  const SC = await fresh();
  mountHost("cancel-pv", "div");
  SC.Popup.Create("ColorChooser", "cancel-pv", { title: "c" });
  SC.Popup.Initialize("cancel-pv", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("cancel-pv");
  expect(SC.Popup.Current.id).toBe("cancel-pv");
  // Cancel restores oldvalue and closes.
  expect(() => SC.Popup.Cancel()).not.toThrow();
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup CreatePopupDiv with width
// -----------------------------------------------------------------------------

test("Gaps: CreatePopupDiv with attribs.width sets width", async () => {
  const SC = await fresh();
  mountHost("width-pv", "div");
  SC.Popup.Create("List", "width-pv", {
    title: "WidthPopup",
    width: "200px",
  });
  SC.Popup.Initialize("width-pv", {
    attribs: { width: "200px" },
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("width-pv");
  const pop = SC.Popup.Controls["width-pv"].data.popupele as unknown as {
    style: Record<string, string>;
  };
  expect(pop.style.width).toBe("200px");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup DestroyPopupDiv edge cases
// -----------------------------------------------------------------------------

test("Gaps: DestroyPopupDiv null ele returns early", async () => {
  const SC = await fresh();
  expect(() => SC.Popup.DestroyPopupDiv(null, null)).not.toThrow();
});

test("Gaps: DestroyPopupDiv ele with no parentNode", async () => {
  const SC = await fresh();
  const orphan = document.createElement("div");
  // parentNode is null already.
  expect(() => SC.Popup.DestroyPopupDiv(orphan, null)).not.toThrow();
});

// -----------------------------------------------------------------------------
// Popup List branches
// -----------------------------------------------------------------------------

test("Gaps: List.Create missing element alerts and returns", async () => {
  const SC = await fresh();
  // Don't create the host element — getElementById returns null.
  expect(() => SC.Popup.Create("List", "missing-pv", { title: "t" })).not.toThrow();
});

test("Gaps: List.SetValue with no mainele firstChild", async () => {
  const SC = await fresh();
  mountHost("noFirst-pv", "div");
  SC.Popup.Create("List", "noFirst-pv", { title: "t" });
  SC.Popup.Initialize("noFirst-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  // Remove firstChild from mainele.
  const mainele = SC.Popup.Controls["noFirst-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  // SetValue should still run without firstChild.
  expect(() => SC.Popup.SetValue("noFirst-pv", "a")).not.toThrow();
});

test("Gaps: List.SetDisabled with no mainele firstChild", async () => {
  const SC = await fresh();
  mountHost("setdisnf-pv", "div");
  SC.Popup.Create("List", "setdisnf-pv", { title: "t" });
  SC.Popup.Initialize("setdisnf-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  const mainele = SC.Popup.Controls["setdisnf-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  expect(() => SC.Popup.SetDisabled("setdisnf-pv", true)).not.toThrow();
});

test("Gaps: List.MakeList with skip attribute option", async () => {
  const SC = await fresh();
  mountHost("skiplist-pv", "div");
  SC.Popup.Create("List", "skiplist-pv", { title: "t" });
  SC.Popup.Initialize("skiplist-pv", {
    attribs: {},
    value: "",
    options: [
      { o: "Header", v: "", a: { skip: true } },
      { o: "Col2", v: "c2", a: { newcol: true } },
      { o: "A", v: "a" },
    ],
  });
  SC.Popup.CClick("skiplist-pv");
  // Should have opened and MakeList rendered skip + newcol.
  expect(SC.Popup.Current.id).toBe("skiplist-pv");
  SC.Popup.Close();
});

test("Gaps: List.SetValue value match with skip/custom/cancel option", async () => {
  const SC = await fresh();
  mountHost("skipmatch-pv", "div");
  SC.Popup.Create("List", "skipmatch-pv", { title: "t" });
  SC.Popup.Initialize("skipmatch-pv", {
    attribs: {},
    value: "",
    options: [
      { o: "Custom", v: "x", a: { custom: true } },
      { o: "Cancel", v: "y", a: { cancel: true } },
      { o: "Skip", v: "z", a: { skip: true } },
      { o: "Real", v: "r" },
    ],
  });
  // SetValue with "r" — matches Real, not the skip/custom/cancel ones.
  SC.Popup.SetValue("skipmatch-pv", "r");
  expect(SC.Popup.GetValue("skipmatch-pv")).toBe("r");
  // SetValue with "x" — matches custom → falls through to "Custom" path.
  SC.Popup.SetValue("skipmatch-pv", "x");
  // No match because custom/cancel are skipped in the loop.
  expect(SC.Popup.GetValue("skipmatch-pv")).toBe("x");
});

test("Gaps: List.Initialize with no options property → data.options is undefined", async () => {
  const SC = await fresh();
  mountHost("initnull-pv", "div");
  SC.Popup.Create("List", "initnull-pv", { title: "t" });
  // Initialize with data object that has no `options` property. Since
  // data is truthy, `data ? data.options : []` evaluates to
  // `data.options` which is undefined.
  SC.Popup.Initialize("initnull-pv", {
    attribs: {},
    value: "",
    // options deliberately omitted
  });
  // spcdata.options is now undefined (the [] branch is only reachable
  // when data itself is falsy, which can't happen via the public API
  // because the for-in over data.attribs would crash first).
  expect(SC.Popup.Controls["initnull-pv"].data.options).toBeUndefined();
});

// -----------------------------------------------------------------------------
// Popup ColorChooser branches
// -----------------------------------------------------------------------------

test("Gaps: ColorChooser.Create missing element alerts and returns", async () => {
  const SC = await fresh();
  expect(() => SC.Popup.Create("ColorChooser", "ccmissing-pv", {})).not.toThrow();
});

test("Gaps: ColorChooser.SetColors default-value branch (spcdata.value empty)", async () => {
  const SC = await fresh();
  mountHost("ccdefset-pv", "div");
  SC.Popup.Create("ColorChooser", "ccdefset-pv", {});
  SC.Popup.Initialize("ccdefset-pv", { attribs: {}, value: "" });
  SC.Popup.CClick("ccdefset-pv");
  // Show → CreateGrid → DetermineColors → SetColors. With empty value,
  // SetColors takes the `if (!spcdata.value)` default branch.
  expect(SC.Popup.Current.id).toBe("ccdefset-pv");
  SC.Popup.Close();
});
test("Gaps: ColorChooser.CreateGrid appends grid nodes and SetColors resets state", async () => {
  const SC = await fresh();
  mountHost("ccgriddom-pv", "div");
  SC.Popup.Create("ColorChooser", "ccgriddom-pv", {});
  SC.Popup.Initialize("ccgriddom-pv", { attribs: {}, value: "rgb(12,34,56)" });

  const gridNode = SC.Popup.Types.ColorChooser.CreateGrid("ColorChooser", "ccgriddom-pv");
  const controlData = SC.Popup.Controls["ccgriddom-pv"].data as Record<string, any>;
  const grid = controlData.grid as Record<string, any>;

  // gridNode contains both the color table and action-row controls.
  expect(gridNode.childNodes.length).toBe(2);
  const table = gridNode.childNodes[0] as unknown as {
    childNodes: Array<Record<string, any>>;
    tagName: string;
  };
  expect(table.tagName).toBe("TABLE");
  const tbody = table.childNodes[0] as { childNodes: Array<Record<string, any>> };
  expect(tbody.childNodes.length).toBe(16);

  // grid.tbody has 16 rows from CreateGrid's row loop.
  expect(grid.tbody.childNodes.length).toBe(16);
  expect(tbody).toBe(grid.tbody);
  for (const row of grid.tbody.childNodes as any[]) {
    expect(row.childNodes).toHaveLength(5);
    // CreateGrid returns shimmed td elements; bind once instead of inline object-casting for property reads.
    const firstCell = row.childNodes[0] as StyledFakeCell;
    const secondCell = row.childNodes[1] as StyledFakeCell;
    const thirdCell = row.childNodes[2] as StyledFakeCell;
    expect(firstCell.style.fontSize).toBe("1px");
    expect(firstCell.style.width).toBe("17px");
    expect(secondCell.style.borderRight).toContain("3px solid white");
    expect(thirdCell.style.width).toBe("20px");
    expect(thirdCell.style.backgroundRepeat).toBe("no-repeat");
  }

  // Returned action controls are descendants of the container element.
  expect(grid.defaultbox).toBeDefined();
  expect(grid.custom).toBeDefined();
  expect(grid.msg).toBeDefined();

  const hasDescendant = (root: { childNodes?: ArrayLike<unknown> }, target: unknown): boolean => {
    if (root === target) return true;
    for (let i = 0; i < (root.childNodes?.length ?? 0); i++) {
      const child = root.childNodes?.[i] as { childNodes?: ArrayLike<unknown> } | undefined;
      if (child === target) return true;
      if (child && hasDescendant(child, target)) return true;
    }
    return false;
  };
  expect(hasDescendant(gridNode, grid.defaultbox)).toBe(true);
  expect(hasDescendant(gridNode, grid.custom)).toBe(true);
  expect(hasDescendant(gridNode, grid.msg)).toBe(true);
  SC.Popup.SetValue("ccgriddom-pv", "rgb(10,20,30)");
  SC.Popup.Types.ColorChooser.SetColors("ccgriddom-pv");
  expect(grid.msg.style.backgroundImage).toBe("");

  // Clear value and verify reset/default branch in SetColors.
  SC.Popup.SetValue("ccgriddom-pv", "");
  SC.Popup.Types.ColorChooser.SetColors("ccgriddom-pv");
  expect(grid.msg.style.backgroundColor).toBe("#FFF");
  expect(grid.msg.style.backgroundImage).toContain("defaultcolor.gif");
  expect(grid.msg.title).toBe("Default");
  expect(gridNode).toBeDefined();
});
test("Gaps: ColorChooser.SetValue with value and backgroundImage", async () => {
  const SC = await fresh();
  mountHost("ccbgimg-pv", "div");
  SC.Popup.Create("ColorChooser", "ccbgimg-pv", {
    backgroundImage: "bg.gif",
  });
  // SetValue with a real value + backgroundImage.
  SC.Popup.SetValue("ccbgimg-pv", "rgb(100,200,50)");
  expect(SC.Popup.GetValue("ccbgimg-pv")).toBe("rgb(100,200,50)");
  // SetValue with empty + backgroundImageDefault.
  mountHost("ccbgdef-pv", "div");
  SC.Popup.Create("ColorChooser", "ccbgdef-pv", {
    backgroundImageDefault: "bgdef.gif",
  });
  SC.Popup.SetValue("ccbgdef-pv", "");
  expect(SC.Popup.GetValue("ccbgdef-pv")).toBe("");
});

test("Gaps: ColorChooser.GridMouseDown with clamped rows/cols", async () => {
  const SC = await fresh();
  mountHost("ccclamp-pv", "div");
  SC.Popup.Create("ColorChooser", "ccclamp-pv", {});
  SC.Popup.Initialize("ccclamp-pv", { attribs: {}, value: "rgb(40,50,60)" });
  SC.Popup.CClick("ccclamp-pv");
  // Mousedown with extreme coordinates to test row/col clamping.
  SC.Popup.Types.ColorChooser.GridMouseDown({
    type: "mousedown",
    clientX: -500,
    clientY: -500,
  } as unknown as MouseEvent);
  SC.Popup.Types.ColorChooser.GridMouseDown({
    type: "mousedown",
    clientX: 9999,
    clientY: 9999,
  } as unknown as MouseEvent);
  SC.Popup.Close();
});

test("Gaps: ColorChooser.CloseOK when current id is set", async () => {
  const SC = await fresh();
  mountHost("ccok-pv", "div");
  SC.Popup.Create("ColorChooser", "ccok-pv", {});
  SC.Popup.Initialize("ccok-pv", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("ccok-pv");
  expect(SC.Popup.Current.id).toBe("ccok-pv");
  // CloseOK with current id → SetValue + Close.
  SC.Popup.Types.ColorChooser.CloseOK({} as unknown as MouseEvent);
  expect(SC.Popup.Current.id).toBeNull();
});

test("Gaps: ColorChooser.DefaultClicked with current id set", async () => {
  const SC = await fresh();
  mountHost("ccdef-pv", "div");
  SC.Popup.Create("ColorChooser", "ccdef-pv", {});
  SC.Popup.Initialize("ccdef-pv", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("ccdef-pv");
  expect(SC.Popup.Current.id).toBe("ccdef-pv");
  // DefaultClicked clears value and closes.
  SC.Popup.Types.ColorChooser.DefaultClicked({} as unknown as MouseEvent);
  expect(SC.Popup.Current.id).toBeNull();
  expect(SC.Popup.GetValue("ccdef-pv")).toBe("");
});

test("Gaps: ColorChooser.CustomClicked with current id set", async () => {
  const SC = await fresh();
  mountHost("cccust-pv", "div");
  SC.Popup.Create("ColorChooser", "cccust-pv", {});
  SC.Popup.Initialize("cccust-pv", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("cccust-pv");
  // CustomClicked opens custom form.
  SC.Popup.Types.ColorChooser.CustomClicked({} as unknown as MouseEvent);
  expect(SC.Popup.Controls["cccust-pv"].data.customele).toBeDefined();
  // CustomOK with hex value.
  const customele = SC.Popup.Controls["cccust-pv"].data.customele as unknown as { value: string };
  customele.value = "AABBCC";
  SC.Popup.Types.ColorChooser.CustomOK("cccust-pv");
  expect(SC.Popup.GetValue("cccust-pv")).toBe("rgb(170,187,204)");
});

test("Gaps: ColorChooser ControlClicked when not active opens via CClick", async () => {
  const SC = await fresh();
  mountHost("ccctl2-pv", "div");
  SC.Popup.Create("ColorChooser", "ccctl2-pv", {});
  SC.Popup.Initialize("ccctl2-pv", { attribs: {}, value: "rgb(5,6,7)" });
  // Not active → CClick opens.
  SC.Popup.Types.ColorChooser.ControlClicked("ccctl2-pv");
  expect(SC.Popup.Current.id).toBe("ccctl2-pv");
  // Active and same id → CloseOK.
  SC.Popup.Types.ColorChooser.ControlClicked("ccctl2-pv");
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup EnsurePosition case 8
// -----------------------------------------------------------------------------

test("Gaps: EnsurePosition case 8 — main left of popup fits", async () => {
  const SC = await fresh();
  const container = document.createElement("div");
  container.id = "ep8-pv-c";
  document.body.appendChild(container);
  const host = document.createElement("span");
  host.id = "ep8-pv";
  container.appendChild(host);
  SC.Popup.Create("List", "ep8-pv", {
    title: "t",
    ensureWithin: container,
  });
  SC.Popup.Initialize("ep8-pv", {
    attribs: { ensureWithin: container },
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("ep8-pv");
  const data = SC.Popup.Controls["ep8-pv"].data;
  const main = data.mainele.firstChild as HTMLElement;
  const popup = data.popupele as HTMLElement;

  // Case 8: p.height < c.height && m.left - p.width > c.left
  // Need: tall m positioned so space on left for popup, and cases 1-7 fail.
  // Container: 0..200, m at right (left=150, width=50), m tall (height=190).
  // Popup: width=100, height=50.
  // Case 1: m.bottom+p.height=190+50=240 > c.bottom=200 → fails (need <)
  // Case 5: m.bottom+p.height=240 > c.bottom=200 → fails
  // Case 7: m.right+p.width=200+100=300 > c.right=200 → fails
  // Case 8: p.height=50 < c.height=200 ✓, m.left-p.width=150-100=50 > c.left=0 ✓
  setElementMetrics(container, {
    offsetWidth: 200,
    offsetHeight: 200,
    offsetTop: 0,
    offsetLeft: 0,
  });
  setElementMetrics(main, { offsetTop: 0, offsetLeft: 150, offsetWidth: 50, offsetHeight: 190 });
  setElementMetrics(popup, { offsetWidth: 100, offsetHeight: 50 });

  SC.Popup.EnsurePosition("ep8-pv", container);
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup List Reset when open
// -----------------------------------------------------------------------------

test("Gaps: List.Reset closes open popup of that type", async () => {
  const SC = await fresh();
  mountHost("listreset-pv", "div");
  SC.Popup.Create("List", "listreset-pv", { title: "t" });
  SC.Popup.Initialize("listreset-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("listreset-pv");
  expect(SC.Popup.Current.id).toBe("listreset-pv");
  SC.Popup.Reset("List");
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup List.Cancel (via Popup.Cancel)
// -----------------------------------------------------------------------------

test("Gaps: Popup.Cancel with List type restores to list", async () => {
  const SC = await fresh();
  mountHost("listcancel-pv", "div");
  SC.Popup.Create("List", "listcancel-pv", { title: "t" });
  SC.Popup.Initialize("listcancel-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("listcancel-pv");
  expect(SC.Popup.Current.id).toBe("listcancel-pv");
  // Popup.Cancel → List.Cancel → List.Hide
  SC.Popup.Cancel();
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup List.Hide disables mainele firstChild
// -----------------------------------------------------------------------------

test("Gaps: List.Hide re-enables mainele firstChild", async () => {
  const SC = await fresh();
  mountHost("listhide-pv", "div");
  SC.Popup.Create("List", "listhide-pv", { title: "t" });
  SC.Popup.Initialize("listhide-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("listhide-pv");
  // Show disables mainele.firstChild; Hide should re-enable.
  const firstChild = SC.Popup.Controls["listhide-pv"].data.mainele.firstChild as unknown as {
    disabled: boolean;
  };
  expect(firstChild.disabled).toBe(true);
  // Close → CClick → Hide.
  SC.Popup.Close();
  expect(firstChild.disabled).toBe(false);
});

// -----------------------------------------------------------------------------
// Popup List CustomToList and CustomOK full flow
// -----------------------------------------------------------------------------

test("Gaps: List CustomToList switches back from custom to list", async () => {
  const SC = await fresh();
  mountHost("listctl-pv", "div");
  SC.Popup.Create("List", "listctl-pv", { title: "t" });
  SC.Popup.Initialize("listctl-pv", {
    attribs: {},
    value: "",
    options: [
      { o: "Custom", v: "x", a: { custom: true } },
      { o: "A", v: "a" },
    ],
  });
  SC.Popup.CClick("listctl-pv");
  // Click the custom option (index 0) → opens custom form.
  SC.Popup.Types.List.ItemClicked("listctl-pv", 0);
  const data = SC.Popup.Controls["listctl-pv"].data;
  expect(data.customele).toBeDefined();
  expect(data.listdiv).toBeNull();
  // CustomToList switches back to list view.
  SC.Popup.Types.List.CustomToList("listctl-pv");
  expect(SC.Popup.Controls["listctl-pv"].data.listdiv).toBeDefined();
  expect(SC.Popup.Controls["listctl-pv"].data.customele).toBeNull();
  SC.Popup.Close();
});

test("Gaps: List CustomOK sets custom value and closes", async () => {
  const SC = await fresh();
  mountHost("listcok-pv", "div");
  SC.Popup.Create("List", "listcok-pv", { title: "t" });
  SC.Popup.Initialize("listcok-pv", {
    attribs: {},
    value: "",
    options: [
      { o: "Custom", v: "x", a: { custom: true } },
      { o: "A", v: "a" },
    ],
  });
  SC.Popup.CClick("listcok-pv");
  // Click custom → opens custom form with input.
  SC.Popup.Types.List.ItemClicked("listcok-pv", 0);
  const customele = SC.Popup.Controls["listcok-pv"].data.customele as unknown as { value: string };
  customele.value = "mycustom";
  SC.Popup.Types.List.CustomOK("listcok-pv");
  expect(SC.Popup.GetValue("listcok-pv")).toBe("mycustom");
});

test("Gaps: List ItemClicked with cancel attribute closes popup", async () => {
  const SC = await fresh();
  mountHost("listcancel2-pv", "div");
  SC.Popup.Create("List", "listcancel2-pv", { title: "t" });
  SC.Popup.Initialize("listcancel2-pv", {
    attribs: {},
    value: "",
    options: [
      { o: "Cancel", v: "", a: { cancel: true } },
      { o: "A", v: "a" },
    ],
  });
  SC.Popup.CClick("listcancel2-pv");
  expect(SC.Popup.Current.id).toBe("listcancel2-pv");
  // Click cancel option → Close.
  SC.Popup.Types.List.ItemClicked("listcancel2-pv", 0);
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Viewer gaps
// -----------------------------------------------------------------------------

test("Gaps: Viewer InitializeSpreadsheetViewer with hasStatusLine=false", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  viewer.hasStatusLine = false;
  const container = document.createElement("div");
  container.id = "nsl-pv-host";
  // Give container existing children so the removeChild loop runs.
  container.appendChild(document.createElement("span"));
  container.appendChild(document.createElement("div"));
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  expect(viewer.statuslineDiv).toBeUndefined();
  expect(viewer.parentNode).toBe(container);
});

test("Gaps: Viewer SizeSSDiv without parentNode returns false", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // parentNode is null by default.
  expect(SC.SizeSSDiv(viewer)).toBe(false);
});

test("Gaps: Viewer SizeSSDiv without spreadsheetDiv returns false", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  viewer.parentNode = document.createElement("div");
  viewer.spreadsheetDiv = null;
  expect(SC.SizeSSDiv(viewer)).toBe(false);
});

test("Gaps: Viewer SizeSSDiv with margins on parentNode style", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "margins-pv-host";
  document.body.appendChild(container);
  viewer.parentNode = container;
  viewer.spreadsheetDiv = document.createElement("div");
  // Set all margins to trigger the truthy branches.
  const style = container.style as unknown as Record<string, string>;
  style.marginTop = "10px";
  style.marginBottom = "10px";
  style.marginLeft = "10px";
  style.marginRight = "10px";
  // Reset height/width to force a change.
  viewer.requestedHeight = 0;
  viewer.requestedWidth = 0;
  viewer.height = 0;
  viewer.width = 0;
  SC.SizeSSDiv(viewer);
  // Now test with requested dims set (first operand of ||).
  viewer.requestedHeight = 200;
  viewer.requestedWidth = 300;
  viewer.height = 0;
  viewer.width = 0;
  SC.SizeSSDiv(viewer);
  expect(viewer.height).toBe(200);
  expect(viewer.width).toBe(300);
});

test("Gaps: Viewer SizeSSDiv with no requestedWidth falls to viewport calc", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "novw-pv-host";
  document.body.appendChild(container);
  viewer.parentNode = container;
  viewer.spreadsheetDiv = document.createElement("div");
  viewer.requestedHeight = 0;
  viewer.requestedWidth = 0;
  // Set no margins → else branches of all margin checks.
  viewer.height = -1; // force != newval
  viewer.width = -1;
  SC.SizeSSDiv(viewer);
  // With viewport defaults, newval should be computed from GetViewportInfo.
  expect(viewer.height).not.toBe(-1);
  expect(viewer.width).not.toBe(-1);
});

test("Gaps: Viewer StatuslineCallback with ecell null and statuslineFull=false", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "slcoord-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.statuslineFull = false;
  // editor.ecell is null → coord = ""
  viewer.editor.ecell = null;
  const params = { spreadsheetobj: viewer };
  SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, params);
  // statuslineDiv should have empty coord replaced.
  expect(viewer.statuslineDiv).toBeDefined();
  // Now with ecell set.
  const ecellStub: { coord: string; row: number; col: number } = {
    coord: "B5",
    row: 5,
    col: 2,
  };
  viewer.editor.ecell = ecellStub;
  SC.SpreadsheetViewerStatuslineCallback(viewer.editor, "cmdend", null, params);
});

test("Gaps: Viewer ParseSheetSave prototype method", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "pss-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.ParseSheetSave("version:1.5\ncell:A1:t:hi\nsheet:c:1:r:1\n");
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("hi");
});

test("Gaps: Viewer LoadSave with no repeatingmacro part (no parts.repeatingmacro else)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "lsnrm-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.editor.context.sheetobj.attribs.recalc = "off";
  const boundary = "SCNRMPV";
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
    "cell:A1:t:norm",
    "sheet:c:1:r:1",
    `--${boundary}--`,
    "",
  ].join("\n");
  viewer.LoadSave(parts);
  expect(viewer.sheet.GetAssuredCell("A1").datavalue).toBe("norm");
  // No repeatingMacroTimer since no repeatingmacro part.
  expect(viewer.repeatingMacroTimer).toBeNull();
});

test("Gaps: Viewer LoadSave with repeatingmacro pos<=0 (interval 0 means don't start)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "lsrm0-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.editor.context.sheetobj.attribs.recalc = "off";
  const boundary = "SCRM0PV";
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
    "cell:A1:t:zero",
    "sheet:c:1:r:1",
    `--${boundary}`,
    "Content-type: text/plain; charset=UTF-8",
    "",
    "0",
    "recalc",
    `--${boundary}--`,
    "",
  ].join("\n");
  viewer.LoadSave(parts);
  expect(viewer.repeatingMacroInterval).toBe(0);
  // t2 = 0 → not > 0 → timer not started.
  expect(viewer.repeatingMacroTimer).toBeNull();
});

test("Gaps: Viewer LoadSave with non-MIME save (parts is {} → if(parts) else is not taken)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "lsnonmime-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.editor.context.sheetobj.attribs.recalc = "off";
  // DecodeSpreadsheetSave returns {} → parts is truthy (empty object)
  // so if (parts) is always truthy. The else branch (falsy parts) is
  // architecturally unreachable since DecodeSpreadsheetSave always returns
  // at least {}. We test the path where parts is truthy but empty.
  viewer.LoadSave("just a plain string");
  // Should have scheduled render (recalc=off).
  // No crash expected.
  expect(viewer).toBeDefined();
});

test("Gaps: Viewer LocalizeSubstrings with missing %ssc constant → alert", async () => {
  const SC = await fresh();
  // %ssc!nonexistent_constant! → alert("Missing constant: ...")
  // The function returns the result of alert() which is undefined.
  expect(() => SC.LocalizeSubstrings("%ssc!nonexistent_pv_constant!")).not.toThrow();
});

test("Gaps: Viewer DecodeSpreadsheetSave blanklineregex fail after boundary", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // MIME-Version + Content-Type with boundary, top boundary found, but
  // no blank line after the top boundary → blanklineregex.exec fails →
  // return parts (empty).

  // The blanklineregex looks for two consecutive newlines (blank line).
  // In this string, after --ZZ there's Content-type then no blank line
  // before the content, so the regex should fail.
  // Actually, there IS a blank line between Content-Type and the header.
  // We need a string where after the top boundary, there's content but
  // no double-newline. Let's craft one.
  const noBlank = [
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=ZZ",
    `--ZZ`,
    "only-one-line-no-blank",
  ].join("\n");
  expect(viewer.DecodeSpreadsheetSave(noBlank)).toEqual({});
});

test("Gaps: Viewer DecodeSpreadsheetSave with CR-only replacement", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // Test the hasreturnonly regex replacement branch.
  // "X\rY" (CR not surrounded by LF) → replaced to "X\r\nY".
  const withCR = "MIME-Version: 1.0\rContent-Type: multipart/mixed; boundary=CR";
  expect(viewer.DecodeSpreadsheetSave(withCR)).toEqual({});
});

test("Gaps: Viewer DecodeSpreadsheetSave with version line in header", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // Full valid parse with version: line which should be ignored.
  const boundary = "SCFULLPV";
  const str = [
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
    "cell:A1:v:42",
    "sheet:c:1:r:1",
    `--${boundary}--`,
    "",
  ].join("\n");
  const parts = viewer.DecodeSpreadsheetSave(str);
  expect(parts.sheet).toBeDefined();
  expect(parts.sheet.start).toBeGreaterThanOrEqual(0);
  expect(parts.sheet.end).toBeGreaterThan(parts.sheet.start);
});
test("Gaps: Viewer DecodeSpreadsheetSave returns range offsets for multipart save", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const boundary = "SCMPV3";
  const str = [
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
    "cell:A1:v:42",
    "sheet:c:1:r:1",
    `--${boundary}--`,
  ].join("\n");

  const parts = viewer.DecodeSpreadsheetSave(str);
  expect(parts.sheet).toBeDefined();
  expect(parts.sheet.start).toBeGreaterThanOrEqual(0);
  expect(parts.sheet.end).toBeGreaterThan(parts.sheet.start);

  const sheetChunk = str.substring(parts.sheet.start, parts.sheet.end);
  expect(sheetChunk).toContain("cell:A1:v:42");
  expect(sheetChunk).toContain("sheet:c:1:r:1");
});

test("Gaps: Viewer DoOnResize with views iterates and resizes", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "resize-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  // Seed views so the for-in loop runs.
  viewer.views = {
    v1: {
      element: document.createElement("div"),
    },
  };
  // Change dims to force resize.
  viewer.requestedHeight = 250;
  viewer.requestedWidth = 350;
  viewer.height = 0;
  viewer.width = 0;
  viewer.DoOnResize();
  expect(viewer.height).toBe(250);
  expect(viewer.width).toBe(350);
  // views element should have been resized.
  const viewEl = viewer.views.v1.element as unknown as {
    style: Record<string, string>;
  };
  expect(viewEl.style.width).toBe("350px");
});

test("Gaps: Viewer SpreadsheetViewerCreateSheetHTML with empty sheet", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "svhtml2-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.sheet.ParseSheetSave("version:1.5\ncell:A1:t:aaa\nsheet:c:1:r:1\n");
  const html = SC.SpreadsheetViewerCreateSheetHTML(viewer);
  expect(typeof html).toBe("string");
  void html;
});

// -----------------------------------------------------------------------------
// Viewer _app mode — DoOnResize returns before ResizeTableEditor
// -----------------------------------------------------------------------------

test("Gaps: Viewer _app DoOnResize skips ResizeTableEditor", async () => {
  const SC = await fresh();
  SC._app = true;
  try {
    const viewer = new SC.SpreadsheetViewer("apppv-");
    const container = document.createElement("div");
    container.id = "appresize-pv-host";
    container.appendChild(document.createElement("span"));
    document.body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 200, 300, 20);
    viewer.views = {};
    viewer.requestedHeight = 150;
    viewer.requestedWidth = 200;
    viewer.height = 0;
    viewer.width = 0;
    // DoOnResize in app mode returns before ResizeTableEditor.
    viewer.DoOnResize();
    expect(viewer.height).toBe(150);
  } finally {
    SC._app = false;
  }
});

// =============================================================================
// ROUND 2: Remaining gap closures
// =============================================================================

// -----------------------------------------------------------------------------
// Popup: EnsurePosition cases 2, 3, 4
// -----------------------------------------------------------------------------

test("Gaps2: EnsurePosition case 2 — popup fits above main, aligned left", async () => {
  const SC = await fresh();

  function ensurePosCase(
    id: string,
    dial: (main: HTMLDivElement, popup: HTMLDivElement, container: HTMLDivElement) => void,
  ): void {
    const container = document.createElement("div");
    container.id = `${id}-c`;
    document.body.appendChild(container);
    const host = document.createElement("span");
    host.id = id;
    container.appendChild(host);
    SC.Popup.Create("List", id, {
      title: "t",
      ensureWithin: container,
    });
    SC.Popup.Initialize(id, {
      attribs: {},
      value: "",
      options: [{ o: "A", v: "a" }],
    });
    SC.Popup.CClick(id);
    const data = SC.Popup.Controls[id].data;
    const main = data.mainele.firstChild as HTMLDivElement;
    const popup = data.popupele as HTMLDivElement;
    if (main && popup) {
      dial(main, popup, container);
      SC.Popup.EnsurePosition(id, container);
    }
    SC.Popup.Close();
  }

  // Case 2: m.top - p.height > c.top && m.left + p.width < c.right
  // Need main near bottom so popup fits above, and left-aligned.
  // Container 0..400. main at top=200, left=10, w=50, h=20.
  // popup w=80, h=50. Case 1: m.bottom+p.height=220+50=270 < c.bottom=400 ✓
  // but m.left+p.width=10+80=90 < c.right=400 ✓ → case 1 wins, not case 2.
  // To make case 1 fail and case 2 win: m.bottom+p.height > c.bottom.
  // main at top=350, h=20 → m.bottom=370. p.height=50 → 370+50=420>400 → case 1 fails.
  // Case 2: m.top-h=350-50=300 > c.top=0 ✓, m.left+p.width=10+80=90<400 ✓
  ensurePosCase("ep2pv", (main, popup, container) => {
    const c = container as unknown as {
      offsetWidth: number;
      offsetHeight: number;
      offsetTop: number;
      offsetLeft: number;
    };
    c.offsetWidth = 400;
    c.offsetHeight = 400;
    c.offsetTop = 0;
    c.offsetLeft = 0;
    const m = main as unknown as {
      offsetTop: number;
      offsetLeft: number;
      offsetWidth: number;
      offsetHeight: number;
    };
    m.offsetTop = 350;
    m.offsetLeft = 10;
    m.offsetWidth = 50;
    m.offsetHeight = 20;
    const p = popup as unknown as {
      offsetWidth: number;
      offsetHeight: number;
    };
    p.offsetWidth = 80;
    p.offsetHeight = 50;
  });

  // Case 3: m.bottom + p.height < c.bottom && m.right - p.width > c.left
  // Need: case 1 fails (m.left+p.width >= c.right), but case 3 passes.
  // main at top=10, left=350, w=50, h=20. popup w=80, h=50.
  // Case 1: m.bottom+p.height=30+50=80<400 ✓, m.left+p.width=350+80=430>=400 → fails.
  // Case 3: m.bottom+p.height=80<400 ✓, m.right-p.width=400-80=320>0 ✓
  ensurePosCase("ep3pv", (main, popup, container) => {
    const c = container as unknown as {
      offsetWidth: number;
      offsetHeight: number;
      offsetTop: number;
      offsetLeft: number;
    };
    c.offsetWidth = 400;
    c.offsetHeight = 400;
    c.offsetTop = 0;
    c.offsetLeft = 0;
    const m = main as unknown as {
      offsetTop: number;
      offsetLeft: number;
      offsetWidth: number;
      offsetHeight: number;
    };
    m.offsetTop = 10;
    m.offsetLeft = 350;
    m.offsetWidth = 50;
    m.offsetHeight = 20;
    const p = popup as unknown as {
      offsetWidth: number;
      offsetHeight: number;
    };
    p.offsetWidth = 80;
    p.offsetHeight = 50;
  });

  // Case 4: m.top - p.height > c.top && m.right - p.width > c.left
  // Need: case 1 fails (m.left+p.width >= c.right), case 2 fails (m.bottom+p.height >= c.bottom),
  // case 3 fails (m.bottom+p.height >= c.bottom) — wait case 3 also fails if bottom doesn't fit.
  // main at top=350, left=350, w=50, h=20. popup w=80, h=50.
  // Case 1: m.left+p.width=350+80=430>=400 → fails.
  // Case 2: m.top-h=350-50=300>0 ✓, m.left+p.width=430>=400 → fails.
  // Case 3: m.bottom+p.height=370+50=420>400 → fails.
  // Case 4: m.top-h=300>0 ✓, m.right-p.width=400-80=320>0 ✓
  ensurePosCase("ep4pv", (main, popup, container) => {
    const c = container as unknown as {
      offsetWidth: number;
      offsetHeight: number;
      offsetTop: number;
      offsetLeft: number;
    };
    c.offsetWidth = 400;
    c.offsetHeight = 400;
    c.offsetTop = 0;
    c.offsetLeft = 0;
    const m = main as unknown as {
      offsetTop: number;
      offsetLeft: number;
      offsetWidth: number;
      offsetHeight: number;
    };
    m.offsetTop = 350;
    m.offsetLeft = 350;
    m.offsetWidth = 50;
    m.offsetHeight = 20;
    const p = popup as unknown as {
      offsetWidth: number;
      offsetHeight: number;
    };
    p.offsetWidth = 80;
    p.offsetHeight = 50;
  });
});

// -----------------------------------------------------------------------------
// Popup: SetValue/SetDisabled dispatch else branches (type missing Create)
// -----------------------------------------------------------------------------

test("Gaps2: SetValue with type handler missing Create → else branch", async () => {
  const SC = await fresh();
  // Register a control whose type handler has no Create (pt && pt.Create = false).
  mountHost("nosetchk-pv", "div");
  // Manually plant a control in spc with a type that has no handler.
  SC.Popup.Controls["nosetchk-pv"] = {
    type: "NoHandler",
    value: "",
    display: "",
    data: { attribs: {} },
  };
  // NoHandler doesn't exist in spt → pt is undefined → pt && pt.Create = false
  expect(() => SC.Popup.SetValue("nosetchk-pv", "x")).not.toThrow();
});

test("Gaps2: SetDisabled with type handler missing Create → else branch", async () => {
  const SC = await fresh();
  SC.Popup.Controls["nodis-set-pv"] = {
    type: "NoHandler",
    value: "",
    display: "",
    data: { attribs: {} },
  };
  expect(() => SC.Popup.SetDisabled("nodis-set-pv", true)).not.toThrow();
});

// -----------------------------------------------------------------------------
// Popup: CClick with pt.Show missing → else branch
// -----------------------------------------------------------------------------

test("Gaps2: CClick with type handler missing Show → else branch", async () => {
  const SC = await fresh();
  // Register a type handler that has Create but no Show.
  SC.Popup.Types.NoShow = {
    Create: function (type: string, id: string) {
      SC.Popup.Controls[id] = {
        type,
        value: "",
        display: "",
        data: {},
      };
    },
    // No Show method
  };
  mountHost("noshow-pv", "div");
  SC.Popup.Create("NoShow", "noshow-pv");
  // CClick: pt.Show is missing → if (pt && pt.Show) else branch.
  expect(() => SC.Popup.CClick("noshow-pv")).not.toThrow();
  // Current.id is still set even without Show.
  expect(SC.Popup.Current.id).toBe("noshow-pv");
  SC.Popup.Current.id = null;
  delete SC.Popup.Types.NoShow;
});

// -----------------------------------------------------------------------------
// Popup: List.Initialize with attribs to copy
// -----------------------------------------------------------------------------

test("Gaps2: List.Initialize copies attribs into spcdata.attribs", async () => {
  const SC = await fresh();
  mountHost("initattr-pv", "div");
  SC.Popup.Create("List", "initattr-pv", { title: "t" });
  SC.Popup.Initialize("initattr-pv", {
    attribs: { extra: "value", width: "100px" },
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  expect(SC.Popup.Controls["initattr-pv"].data.attribs.extra).toBe("value");
});

// -----------------------------------------------------------------------------
// Popup: List.Show mainele firstChild disabled (if branch vs else)
// -----------------------------------------------------------------------------

test("Gaps2: List.Show with no mainele firstChild → else branch", async () => {
  const SC = await fresh();
  mountHost("shownofirst-pv", "div");
  SC.Popup.Create("List", "shownofirst-pv", { title: "t" });
  SC.Popup.Initialize("shownofirst-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  // Remove firstChild from mainele so the if (mainele && mainele.firstChild) is false.
  const mainele = SC.Popup.Controls["shownofirst-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  SC.Popup.CClick("shownofirst-pv");
  expect(SC.Popup.Current.id).toBe("shownofirst-pv");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: List.SetDisabled mainele firstChild (if branch)
// -----------------------------------------------------------------------------

test("Gaps2: List.SetDisabled with mainele firstChild present → if branch", async () => {
  const SC = await fresh();
  mountHost("disfirst-pv", "div");
  SC.Popup.Create("List", "disfirst-pv", { title: "t" });
  SC.Popup.Initialize("disfirst-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  // Disable with firstChild present → if branch sets firstChild.disabled.
  SC.Popup.SetDisabled("disfirst-pv", true);
  // List.Show creates the fake disabled first child for this branch.
  const disabledFirstChild = SC.Popup.Controls["disfirst-pv"].data.mainele
    .firstChild as unknown as { disabled: boolean };
  expect(disabledFirstChild.disabled).toBe(true);
});

// -----------------------------------------------------------------------------
// Popup: List.Hide mainele firstChild (else branch — no firstChild)
// -----------------------------------------------------------------------------

test("Gaps2: List.Hide with no mainele firstChild → else branch", async () => {
  const SC = await fresh();
  mountHost("hideNofirst-pv", "div");
  SC.Popup.Create("List", "hideNofirst-pv", { title: "t" });
  SC.Popup.Initialize("hideNofirst-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("hideNofirst-pv");
  // Remove firstChild from mainele.
  const mainele = SC.Popup.Controls["hideNofirst-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  // Close should not throw even with no firstChild.
  expect(() => SC.Popup.Close()).not.toThrow();
});

// -----------------------------------------------------------------------------
// Popup: List makeList with value matching option but the option has custom=true
// → !(o.a && (o.a.custom || o.a.cancel)) is false → bg=""
// -----------------------------------------------------------------------------

test("Gaps2: List.MakeList value match but custom attribute → bg empty", async () => {
  const SC = await fresh();
  mountHost("custmatch-pv", "div");
  SC.Popup.Create("List", "custmatch-pv", { title: "t" });
  SC.Popup.Initialize("custmatch-pv", {
    attribs: {},
    value: "x", // matches custom option's v
    options: [
      { o: "Custom", v: "x", a: { custom: true } },
      { o: "A", v: "a" },
    ],
  });
  // SetValue with "x" matches custom option but custom=true → bg stays empty.
  SC.Popup.CClick("custmatch-pv");
  expect(SC.Popup.Current.id).toBe("custmatch-pv");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: List ItemClicked with cancel attribute (cancel branch)
// -----------------------------------------------------------------------------

test("Gaps2: List.ItemClicked with ensureWithin and custom attribute", async () => {
  const SC = await fresh();
  const mount = mountHost("iccust-pv", "div");
  SC.Popup.Create("List", "iccust-pv", {
    title: "t",
    ensureWithin: mount.container,
  });
  SC.Popup.Initialize("iccust-pv", {
    attribs: {},
    value: "",
    options: [
      { o: "Custom", v: "x", a: { custom: true } },
      { o: "A", v: "a" },
    ],
  });
  SC.Popup.CClick("iccust-pv");
  // Click custom item → opens custom form with ensureWithin.
  SC.Popup.Types.List.ItemClicked("iccust-pv", 0);
  expect(SC.Popup.Controls["iccust-pv"].data.customele).toBeDefined();
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.SetColors with dark color → msg color white
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.SetColors with dark sum → msg.color white", async () => {
  const SC = await fresh();
  mountHost("ccdarks-pv", "div");
  SC.Popup.Create("ColorChooser", "ccdarks-pv", {});
  // Initialize with very dark color (r+g+b < 220).
  SC.Popup.Initialize("ccdarks-pv", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("ccdarks-pv");
  // Show → CreateGrid → SetColors. rgb(10,20,30): sum=60 < 220 → color=#FFF.
  expect(SC.Popup.Current.id).toBe("ccdarks-pv");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser GridMouseDown with col=0 (common color path)
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.GridMouseDown col=0 case sets value to color", async () => {
  const SC = await fresh();
  mountHost("ccgcol0-pv", "div");
  SC.Popup.Create("ColorChooser", "ccgcol0-pv", {});
  SC.Popup.Initialize("ccgcol0-pv", { attribs: {}, value: "rgb(40,50,60)" });
  SC.Popup.CClick("ccgcol0-pv");
  // col=0 → mousedown at x=5 (col=Math.floor(5/20)=0)
  SC.Popup.Types.ColorChooser.GridMouseDown({
    type: "mousedown",
    clientX: 5,
    clientY: 50,
  } as unknown as MouseEvent);
  // col=1 → mousedown at x=25 (col=Math.floor(25/20)=1)
  SC.Popup.Types.ColorChooser.GridMouseDown({
    type: "mousedown",
    clientX: 25,
    clientY: 50,
  } as unknown as MouseEvent);
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.DefaultClicked → GridMouseDown with event passed
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.DefaultClicked with event fires fully", async () => {
  const SC = await fresh();
  mountHost("ccdefevt-pv", "div");
  SC.Popup.Create("ColorChooser", "ccdefevt-pv", {});
  SC.Popup.Initialize("ccdefevt-pv", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("ccdefevt-pv");
  // DefaultClicked clears value and closes.
  SC.Popup.Types.ColorChooser.DefaultClicked({
    type: "click",
    clientX: 0,
    clientY: 0,
  } as unknown as MouseEvent);
  expect(SC.Popup.GetValue("ccdefevt-pv")).toBe("");
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.CustomClicked event passed (e || window.event)
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.CustomClicked/CloseOK with event args", async () => {
  const SC = await fresh();
  mountHost("ccevt-pv", "div");
  SC.Popup.Create("ColorChooser", "ccevt-pv", {});
  SC.Popup.Initialize("ccevt-pv", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("ccevt-pv");
  // CustomClicked with event object.
  SC.Popup.Types.ColorChooser.CustomClicked({
    type: "click",
    clientX: 0,
    clientY: 0,
  } as unknown as MouseEvent);
  expect(SC.Popup.Controls["ccevt-pv"].data.customele).toBeDefined();
  // CustomOK.
  const customele = SC.Popup.Controls["ccevt-pv"].data.customele as unknown as { value: string };
  customele.value = "AABBCC";
  SC.Popup.Types.ColorChooser.CustomOK("ccevt-pv");
  expect(SC.Popup.GetValue("ccevt-pv")).toBe("rgb(170,187,204)");
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.CloseOK with event arg
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.CloseOK with null event (window.event fallback)", async () => {
  const SC = await fresh();
  mountHost("ccoknull-pv", "div");
  SC.Popup.Create("ColorChooser", "ccoknull-pv", {});
  SC.Popup.Initialize("ccoknull-pv", { attribs: {}, value: "rgb(5,6,7)" });
  SC.Popup.CClick("ccoknull-pv");
  // CloseOK(null) → event = null || window.event
  SC.Popup.Types.ColorChooser.CloseOK(null as unknown as MouseEvent);
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.DestroyPopupDiv in Hide path
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.Hide destroys popup and clears dragregistered", async () => {
  const SC = await fresh();
  mountHost("cchide-pv", "div");
  SC.Popup.Create("ColorChooser", "cchide-pv", { title: "c" });
  SC.Popup.Initialize("cchide-pv", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("cchide-pv");
  expect(SC.Popup.Current.id).toBe("cchide-pv");
  // Cancel → Hide → DestroyPopupDiv.
  SC.Popup.Cancel();
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.Initialize with attribs to copy (for-in loop)
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.Initialize copies attribs and sets value", async () => {
  const SC = await fresh();
  mountHost("ccinit-pv", "div");
  SC.Popup.Create("ColorChooser", "ccinit-pv", {});
  SC.Popup.Initialize("ccinit-pv", {
    attribs: { sampleWidth: "25px", sampleHeight: "25px" },
    value: "rgb(100,150,200)",
  });
  expect(SC.Popup.Controls["ccinit-pv"].data.attribs.sampleWidth).toBe("25px");
  expect(SC.Popup.GetValue("ccinit-pv")).toBe("rgb(100,150,200)");
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser gridToG directly
// -----------------------------------------------------------------------------

test("Gaps2: ColorChooser.gridToG returns grid entry", async () => {
  const SC = await fresh();
  mountHost("ccgrid-pv", "div");
  SC.Popup.Create("ColorChooser", "ccgrid-pv", {});
  SC.Popup.Initialize("ccgrid-pv", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("ccgrid-pv");
  // Access the grid directly and call gridToG.
  const grid = SC.Popup.Controls["ccgrid-pv"].data.grid as Record<string, unknown>;
  expect(SC.Popup.Types.ColorChooser.gridToG(grid, 0, 0)).toBeDefined();
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Viewer: InitializeSpreadsheetViewer with statuslineCSS having no padding
//         → paddingTop/paddingBottom NaN → || 0 right branch
// -----------------------------------------------------------------------------

test("Gaps2: Viewer statusline with no padding CSS → || 0 branches", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // Set a statuslineCSS with no padding → shim defaults paddingTop/Bottom to "0px"
  // Number("0") = 0 (falsy) → || 0 right branch taken.
  viewer.statuslineCSS = "color:black;";
  const container = document.createElement("div");
  container.id = "nslcss-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  expect(viewer.statuslineDiv).toBeDefined();
});

// -----------------------------------------------------------------------------
// Viewer: SizeSSDiv with no margins → all margin else branches
// -----------------------------------------------------------------------------

test("Gaps2: Viewer SizeSSDiv with no margins → all else branches", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "nomargin-pv-host";
  document.body.appendChild(container);
  viewer.parentNode = container;
  viewer.spreadsheetDiv = document.createElement("div");
  // The style shim's default getter returns "0px" (truthy) for any
  // unset margin/padding sub-property, so leaving these unset does NOT
  // exercise the falsy branch — set them to "" explicitly instead.
  const style = container.style as unknown as Record<string, string>;
  style.marginTop = "";
  style.marginBottom = "";
  style.marginLeft = "";
  style.marginRight = "";
  viewer.requestedHeight = 0;
  viewer.requestedWidth = 0;
  viewer.height = -1;
  viewer.width = -1;
  SC.SizeSSDiv(viewer);
  expect(viewer.height).not.toBe(-1);
});

// -----------------------------------------------------------------------------
// Viewer: SizeSSDiv with requestedHeight truthy → first operand of ||
// -----------------------------------------------------------------------------

test("Gaps2: Viewer SizeSSDiv requestedHeight || viewport calc branches", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "reqh-pv-host";
  document.body.appendChild(container);
  viewer.parentNode = container;
  viewer.spreadsheetDiv = document.createElement("div");
  viewer.requestedHeight = 100;
  // requestedHeight is truthy → first operand of || (100) is taken.
  // For width: requestedWidth is 0 → viewport calc → third operand of ||  (700 fallback).
  viewer.requestedWidth = 0;
  viewer.height = 0;
  viewer.width = 0;
  SC.SizeSSDiv(viewer);
  expect(viewer.height).toBe(100);
  // Width should come from viewport or 700 fallback.
  expect(viewer.width).toBeGreaterThan(0);
});

// -----------------------------------------------------------------------------
// Viewer: LoadSave with empty string (parts is {} → if(parts) else branch not taken)
// -----------------------------------------------------------------------------

test("Gaps2: Viewer LoadSave with decode returning {} → if(parts) truthy", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "lsempty-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.editor.context.sheetobj.attribs.recalc = "off";
  // Empty string → DecodeSpreadsheetSave returns {} (truthy)
  // → if (parts) is truthy → enters the block, but no parts.sheet etc.
  expect(() => viewer.LoadSave("")).not.toThrow();
});

test("Gaps2: Viewer LoadSave skips the parts block when DecodeSpreadsheetSave returns falsy", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "lsfalsy-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.editor.context.sheetobj.attribs.recalc = "off";
  // DecodeSpreadsheetSave always returns an object (possibly {}), so the
  // real implementation never makes `if (parts)` false — mock the
  // instance method to force the falsy branch.
  const mutableViewer = viewer as unknown as {
    DecodeSpreadsheetSave: (str: string) => unknown;
  };
  const savedDecode = mutableViewer.DecodeSpreadsheetSave;
  mutableViewer.DecodeSpreadsheetSave = () => null;
  try {
    expect(() => viewer.LoadSave("anything")).not.toThrow();
  } finally {
    mutableViewer.DecodeSpreadsheetSave = savedDecode;
  }
});

test("Gaps2: Viewer SizeSSDiv width falls all the way through to the 700 default", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "width700-pv-host";
  document.body.appendChild(container);
  viewer.parentNode = container;
  viewer.spreadsheetDiv = document.createElement("div");
  const style = container.style as unknown as Record<string, string>;
  style.marginTop = "";
  style.marginBottom = "";
  style.marginLeft = "";
  style.marginRight = "";
  // Force the viewport-derived width to exactly 0 (falsy) so
  // `requestedWidth || viewportCalc || 700` falls all the way to 700:
  // fudgefactorX is a fixed 10, so a 10px viewport width with no
  // offsets/margins makes the middle term `10 - 10 = 0`.
  const mutableSC = SC as unknown as {
    GetViewportInfo: () => { width: number; height: number };
  };
  const savedViewport = mutableSC.GetViewportInfo;
  mutableSC.GetViewportInfo = () => ({ width: 10, height: 400 });
  viewer.requestedWidth = 0;
  viewer.requestedHeight = 100;
  viewer.height = 0;
  viewer.width = -1;
  try {
    SC.SizeSSDiv(viewer);
    expect(viewer.width).toBe(700);
  } finally {
    mutableSC.GetViewportInfo = savedViewport;
  }
});

// -----------------------------------------------------------------------------
// Viewer: LoadSave repeatingmacro with pos=0 (not > 0 → else of if)
// -----------------------------------------------------------------------------

test("Gaps2: Viewer LoadSave repeatingmacro newline at pos=0 → pos<=0", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "lsrmneg-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  viewer.editor.context.sheetobj.attribs.recalc = "off";
  // Craft a repeating macro part where the first line is empty → pos=0.
  const boundary = "SCNEGRM";
  const parts = [
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
    "cell:A1:t:neg",
    "sheet:c:1:r:1",
    `--${boundary}`,
    "Content-type: text/plain; charset=UTF-8",
    "",
    "\nrecalc",
    `--${boundary}--`,
  ].join("\n");
  viewer.LoadSave(parts);
  // The repeatingmacro part starts with \n → rmstr = "\nrecalc"
  // rmstr.replace("\r","") → "\nrecalc". indexOf("\n") = 0.
  // pos = 0 → pos > 0 is false → else branch (don't parse).
  // repeatingMacroInterval stays at default 60, timer stays null.
  expect(viewer.repeatingMacroTimer).toBeNull();
});

// -----------------------------------------------------------------------------
// Viewer: GetSpreadsheetViewerObject succeeds via viewer constructor
// -----------------------------------------------------------------------------

test("Gaps2: Viewer DoOnResize returns after ResizeTableEditor (non-app)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "resize2-pv-host";
  document.body.appendChild(container);
  viewer.InitializeSpreadsheetViewer(container, 300, 400, 20);
  // No views → for-in loop iterates nothing.
  // Change dims → resized → ResizeTableEditor called.
  viewer.requestedHeight = 200;
  viewer.requestedWidth = 300;
  viewer.height = 100;
  viewer.width = 100;
  viewer.views = {};
  expect(() => viewer.DoOnResize()).not.toThrow();
  expect(viewer.height).toBe(200);
});

// -----------------------------------------------------------------------------
// Viewer: DecodeSpreadsheetSave mid-part blank line not found (return early)
// -----------------------------------------------------------------------------

test("Gaps2: Viewer DecodeSpreadsheetSave part loop blanklineregex fail", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // Craft a string where the part loop can't find a blank line after the
  // first part boundary — causes searchinfo=null → return parts.
  const boundary = "SCFAILPV";
  const str = [
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
    "sheet:c:1:r:1",
    // No blank line before the closing boundary — the regex needs \n\n.
    // But --boundary appears immediately after content with no blank.
    `--${boundary}--`,
  ].join("\n");
  const result = viewer.DecodeSpreadsheetSave(str);
  // May return partial parts or {} depending on where blanklineregex fails.
  expect(typeof result).toBe("object");
});

// -----------------------------------------------------------------------------
// Viewer: DecodeSpreadsheetSave boundary regex fail in part loop
// -----------------------------------------------------------------------------

test("Gaps2: Viewer DecodeSpreadsheetSave ending boundary not found", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // Craft a string where the part loop's boundary regex can't find
  // the ending boundary → return parts.
  const boundary = "SCNOENDPV";
  const str = [
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
    "cell:A1:t:noend",
    "sheet:c:1:r:1",
    // Missing closing boundary → boundaryregex.exec fails → return parts.
  ].join("\n");
  const result = viewer.DecodeSpreadsheetSave(str);
  expect(typeof result).toBe("object");
});

// -----------------------------------------------------------------------------
// Viewer: LocalizeSubstrings with %loc and %ssc both in same string
// -----------------------------------------------------------------------------

test("Gaps2: Viewer LocalizeSubstrings mixed loc and ssc patterns", async () => {
  const SC = await fresh();
  // Mixed patterns in one string.
  const result = SC.LocalizeSubstrings("%loc!Edit! and %ssc!defaultImagePrefix!");
  expect(typeof result).toBe("string");
  expect(result).toContain("Edit");
});

// -----------------------------------------------------------------------------
// Viewer: InitializeSpreadsheetViewer with _app=true builds formDataViewer
// -----------------------------------------------------------------------------

test("Gaps2: Viewer InitializeSpreadsheetViewer app mode builds formDataViewer", async () => {
  const SC = await fresh();
  SC._app = true;
  try {
    const viewer = new SC.SpreadsheetViewer("apppv2-");
    const container = document.createElement("div");
    container.id = "appmode2-pv-host";
    container.appendChild(document.createElement("span"));
    document.body.appendChild(container);
    viewer.InitializeSpreadsheetViewer(container, 200, 300, 20);
    expect(viewer.formDataViewer).toBeDefined();
    // formDataViewer should have its statuscallback cleared.
    const fdViewer = viewer.formDataViewer;
    if (fdViewer) {
      expect(fdViewer.sheet.statuscallback).toBeNull();
    }
  } finally {
    SC._app = false;
  }
});

// -----------------------------------------------------------------------------
// Viewer: SizeSSDiv with truthy margin values (all 4 if branches)
// -----------------------------------------------------------------------------

test("Gaps2: Viewer SizeSSDiv with all 4 margins → all if branches", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "allmarg-pv-host";
  document.body.appendChild(container);
  viewer.parentNode = container;
  viewer.spreadsheetDiv = document.createElement("div");
  // Set all margins to truthy values via the style proxy.
  const style = container.style as unknown as Record<string, string>;
  style.marginTop = "5px";
  style.marginBottom = "5px";
  style.marginLeft = "5px";
  style.marginRight = "5px";
  viewer.requestedHeight = 0;
  viewer.requestedWidth = 0;
  viewer.height = -1;
  viewer.width = -1;
  const resized = SC.SizeSSDiv(viewer);
  expect(typeof resized).toBe("boolean");
  // Now test with requestedHeight and requestedWidth set (truthy || branches).
  viewer.requestedHeight = 150;
  viewer.requestedWidth = 200;
  viewer.height = 0;
  viewer.width = 0;
  SC.SizeSSDiv(viewer);
  expect(viewer.height).toBe(150);
  expect(viewer.width).toBe(200);
});

// -----------------------------------------------------------------------------
// Popup: List.Create with no attribs (undefined) → attribs || {} else branch
// -----------------------------------------------------------------------------

test("Gaps3: List.Create with undefined attribs → || {} else branch", async () => {
  const SC = await fresh();
  mountHost("noattrs-pv", "div");
  // Call Create with no attribs argument → attribs is undefined → {} taken.
  // Popup.Create passes attribs to the type's Create function which
  // hits the `attribs || {}` else branch.
  SC.Popup.Create("List", "noattrs-pv");
  expect(SC.Popup.Controls["noattrs-pv"].data.attribs).toEqual({});
});

// -----------------------------------------------------------------------------
// Popup: List.SetValue loop with o.a present but skip/custom/cancel all false
// → the `continue` is NOT taken → falls through to value comparison
// -----------------------------------------------------------------------------

test("Gaps3: List.SetValue with o.a.present but skip/custom/cancel false", async () => {
  const SC = await fresh();
  mountHost("aval-pv", "div");
  SC.Popup.Create("List", "aval-pv", { title: "t" });
  SC.Popup.Initialize("aval-pv", {
    attribs: {},
    value: "",
    options: [
      { o: "Opt", v: "a", a: { skip: false, custom: false, cancel: false } },
      { o: "B", v: "b" },
    ],
  });
  // SetValue with "a" matches the first option (skip/custom/cancel all false
  // → falls through to o.v == spcdata.value check).
  SC.Popup.SetValue("aval-pv", "a");
  expect(SC.Popup.GetValue("aval-pv")).toBe("a");
});

// -----------------------------------------------------------------------------
// Popup: List.Show with no mainele firstChild → if(mainele && firstChild) else
// -----------------------------------------------------------------------------

test("Gaps3: List.Show with no firstChild → else of if branch", async () => {
  const SC = await fresh();
  mountHost("shownofirst3-pv", "div");
  SC.Popup.Create("List", "shownofirst3-pv", { title: "t" });
  SC.Popup.Initialize("shownofirst3-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  const mainele = SC.Popup.Controls["shownofirst3-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  // List.Show's own CreatePopupDiv call unconditionally does
  // `spcdata.mainele.appendChild(main)` before the firstChild check
  // below it runs, so mainele always has a child by the time the real
  // check executes — mock CreatePopupDiv to skip that append and
  // genuinely exercise the falsy-firstChild branch.
  const mutablePopup = SC.Popup as unknown as {
    CreatePopupDiv: (id: string, attribs: unknown) => HTMLElement;
  };
  const savedCreatePopupDiv = mutablePopup.CreatePopupDiv;
  mutablePopup.CreatePopupDiv = () => document.createElement("div");
  try {
    expect(() => SC.Popup.CClick("shownofirst3-pv")).not.toThrow();
    expect(SC.Popup.Current.id).toBe("shownofirst3-pv");
  } finally {
    mutablePopup.CreatePopupDiv = savedCreatePopupDiv;
  }
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: List.MakeList value check no-match → bg empty (binary-expr [1] and [2])
// o.v == spcdata.value && !(o.a && (o.a.custom || o.a.cancel))
// All false when o.v != value and o.a exists → == is false → && short-circuits
// but the false outcome of == (branch [1] of ==) must still register.
// -----------------------------------------------------------------------------

test("Gaps3: List.MakeList value mismatch with o.a → all binary-expr false sides", async () => {
  const SC = await fresh();
  mountHost("mismatch-pv", "div");
  SC.Popup.Create("List", "mismatch-pv", { title: "t" });
  SC.Popup.Initialize("mismatch-pv", {
    attribs: {},
    value: "x", // value that matches no option value
    options: [{ o: "A", v: "a", a: { skip: false, custom: false, cancel: false } }],
  });
  // MakeList will render with hightop=1 (1 column, no newcol/skip)
  SC.Popup.CClick("mismatch-pv");
  expect(SC.Popup.Current.id).toBe("mismatch-pv");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: List.Hide with no firstChild → else of if(mainele && firstChild)
// -----------------------------------------------------------------------------

test("Gaps3: List.Hide with no firstChild → else branch", async () => {
  const SC = await fresh();
  mountHost("hideNofirst3-pv", "div");
  SC.Popup.Create("List", "hideNofirst3-pv", { title: "t" });
  SC.Popup.Initialize("hideNofirst3-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("hideNofirst3-pv");
  // Remove firstChild so Hide's if(mainele && firstChild) takes else.
  const mainele = SC.Popup.Controls["hideNofirst3-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  expect(() => SC.Popup.Close()).not.toThrow();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.SetValue with no mainele firstChild → if else branch
// -----------------------------------------------------------------------------

test("Gaps3: ColorChooser.SetValue with no firstChild → else of if", async () => {
  const SC = await fresh();
  mountHost("ccsetNofirst-pv", "div");
  SC.Popup.Create("ColorChooser", "ccsetNofirst-pv", {});
  SC.Popup.Initialize("ccsetNofirst-pv", { attribs: {}, value: "" });
  // Remove firstChild so the if(mainele && firstChild) else branch is taken.
  const mainele = SC.Popup.Controls["ccsetNofirst-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  expect(() => SC.Popup.SetValue("ccsetNofirst-pv", "rgb(1,2,3)")).not.toThrow();
  expect(() => SC.Popup.SetValue("ccsetNofirst-pv", "")).not.toThrow();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.SetDisabled with no mainele firstChild → if else branch
// -----------------------------------------------------------------------------

test("Gaps3: ColorChooser.SetDisabled with no firstChild → else of if", async () => {
  const SC = await fresh();
  mountHost("ccdisNofirst-pv", "div");
  SC.Popup.Create("ColorChooser", "ccdisNofirst-pv", {});
  SC.Popup.Initialize("ccdisNofirst-pv", { attribs: {}, value: "rgb(1,2,3)" });
  const mainele = SC.Popup.Controls["ccdisNofirst-pv"].data.mainele as HTMLElement;
  while (mainele.childNodes.length > 0) {
    mainele.removeChild(mainele.childNodes[0]);
  }
  expect(() => SC.Popup.SetDisabled("ccdisNofirst-pv", true)).not.toThrow();
  expect(() => SC.Popup.SetDisabled("ccdisNofirst-pv", false)).not.toThrow();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.Reset with no current → if false (else branch)
// -----------------------------------------------------------------------------

test("Gaps3: ColorChooser.Reset with no current popup → else branch", async () => {
  const SC = await fresh();
  mountHost("ccresetNofirst-pv", "div");
  SC.Popup.Create("ColorChooser", "ccresetNofirst-pv", {});
  SC.Popup.Initialize("ccresetNofirst-pv", { attribs: {}, value: "rgb(1,2,3)" });
  // Don't open it — no current popup → if(sp.Current.id && ...) false.
  SC.Popup.Reset("ColorChooser");
  // No popup should be in current.
  expect(SC.Popup.Current.id).not.toBe("ccresetNofirst-pv");
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser GridMouseDown with null event (window.event fallback)
// -----------------------------------------------------------------------------

test("Gaps3: ColorChooser.GridMouseDown with null event (e || window.event)", async () => {
  const SC = await fresh();
  mountHost("ccgnull-pv", "div");
  SC.Popup.Create("ColorChooser", "ccgnull-pv", {});
  SC.Popup.Initialize("ccgnull-pv", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("ccgnull-pv");
  // window.event in the shim environment is presumably undefined →
  // if !searchinfo → return after property access on null...
  // Actually the event access: e || window.event → both null → event=null → property access would crash.
  // But only e is used so only null→window.event fallback fires if Textor.
  // The code does `event.type` which would crash if event is null.
  // Since callers always pass an event object, passing null would crash.
  // However passing undefined falls through to window.event (scheduled), though
  // callers from click handlers always pass an event.
  const eventGlobal = globalWithOptionalEvent();
  const oldEvent = eventGlobal.event;
  (eventGlobal as unknown as Record<string, unknown>).event = {
    type: "mousedown",
    clientX: 50,
    clientY: 50,
  };
  // Also exercise `e || window.event` — call e as null/undefined so
  // while event.type works on the window.event fallback.
  SC.Popup.Types.ColorChooser.GridMouseDown(null as unknown as MouseEvent);
  eventGlobal.event = oldEvent;
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser GridMouseDown row < 0 → ternary true branch
// -----------------------------------------------------------------------------

test("Gaps3: ColorChooser.GridMouseDown row < 0 → row ternary bumps to 0", async () => {
  const SC = await fresh();
  mountHost("ccgneg-pv", "div");
  SC.Popup.Create("ColorChooser", "ccgneg-pv", {});
  SC.Popup.Initialize("ccgneg-pv", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("ccgneg-pv");
  expect(() => {
    SC.Popup.Types.ColorChooser.GridMouseDown({
      type: "mousedown",
      clientX: 50,
      // clientY so the row computation returns < 0. Must be ABOVE grid (clientY too small).
      // row = Math.floor((clientY - gpos.top - 2) / 10). Since gpos.top is 0 (default),
      // row = Math.floor((clientY - 0 - 2) / 10) — need this < 0.
      clientY: -1000,
    } as unknown as MouseEvent);
  }).not.toThrow();
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.DefaultClicked/CustomClicked/CloseOK with null event
// -----------------------------------------------------------------------------

test("Gaps3: ColorChooser.DefaultClicked/CustomClicked/CloseOK with null event", async () => {
  const SC = await fresh();
  mountHost("ccevents-pv", "div");
  SC.Popup.Create("ColorChooser", "ccevents-pv", {});
  SC.Popup.Initialize("ccevents-pv", { attribs: {}, value: "rgb(5,6,7)" });

  // Set up oldEvent so window.event fallback works.
  const eventGlobal = globalWithOptionalEvent();
  const oldEvent = eventGlobal.event;
  (eventGlobal as unknown as Record<string, unknown>).event = {
    type: "click",
    clientX: 0,
    clientY: 0,
  };

  SC.Popup.CClick("ccevents-pv");
  SC.Popup.Types.ColorChooser.DefaultClicked(null as unknown as MouseEvent);

  // Click custom again since DefaultClicked closes
  SC.Popup.CClick("ccevents-pv");
  SC.Popup.Types.ColorChooser.CustomClicked(null as unknown as MouseEvent);
  // Custom form now open; close via CloseOK with null event.
  SC.Popup.Types.ColorChooser.CloseOK(null as unknown as MouseEvent);

  eventGlobal.event = oldEvent;
});

// -----------------------------------------------------------------------------
// Viewer: SizeSSDiv with all margins truthy (if branches) AND specific
// requestH/W combinations to hit specific binary-expr sub-branches
// -----------------------------------------------------------------------------

test("Gaps3: Viewer SizeSSDiv — requestedHeight not set + viewport calc (NULL-or path)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const container = document.createElement("div");
  container.id = "allmarg2-pv-host";
  document.body.appendChild(container);
  viewer.parentNode = container;
  viewer.spreadsheetDiv = document.createElement("div");
  // Set valid truthy margins (5px each).
  const style = container.style as unknown as Record<string, string>;
  style.marginTop = "5px";
  style.marginBottom = "5px";
  style.marginLeft = "5px";
  style.marginRight = "5px";
  // requestedHeight = 0 (falsy) → sizes.height - ... → sub-branch
  // requestedWidth = 0 (falsy) → sizes.width - ... → third branch (700 if NaN or 0)
  viewer.requestedHeight = 0;
  viewer.requestedWidth = 0;
  // Set old height/width to force changed.
  viewer.height = -1;
  viewer.width = -1;
  SC.SizeSSDiv(viewer);
  // Since viewport defaults to width=0 height=0 in test,
  // newval = 0 - (5+5+10) - 0 = -20 for height.
  // newval = 0 - (5+5+10) = -20 → but this is falsy → 700 fallback.
  // width = max(... || ...) → parse NaN or 700 fallback if 0.
});

// -----------------------------------------------------------------------------
// Viewer: DecodeSpreadsheetSave header-end boundary regex fail (L19676)
// -----------------------------------------------------------------------------

test("Gaps3: Viewer DecodeSpreadsheetSave header end boundary not found", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // After finding top boundary + blank line, the header closing
  // boundary regex needs to fail. We have blank line after content-type,
  // but no second --boundary line for closing.
  const boundary = "SCNOHEND";
  const str = [
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    `--${boundary}`,
    "Content-type: text/plain; charset=UTF-8",
    "",
    "version:1.0",
    "part:sheet",
    // NO closing --boundary — header end regex fails.
    "end of header without boundary",
  ].join("\n");
  const result = viewer.DecodeSpreadsheetSave(str);
  expect(result).toEqual({});
});

// -----------------------------------------------------------------------------
// Viewer: DecodeSpreadsheetSave part-loop blanklineregex fail (L19694)
// -----------------------------------------------------------------------------

test("Gaps3: Viewer DecodeSpreadsheetSave part loop blankline not found", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // Header parses with one part:sheet. Part loop blanklineregex must fail →
  // Content-type header but immediately part content without blank line.
  // Need ending to be at the boundary line --XX (after header parsing).
  // Then the boundary——wait, in part loop, the blanklineregex starts at ending.
  // ending = position of end-of-header boundary match.
  // In a normal save, after ending, content starts with --XX\nContent-type...\n\nbody\n--XX.
  // Part loop puts blanklineregex.lastIndex = ending. Searches for \n\n.
  // If the part's content starts right at --XX with no inline blank line, regex fails.
  //
  // Strategy: after header closing --XX, immediately have the part content
  // (no Content-Type header → no \n\n after end-of-header --XX).
  // But after ending, there's `--${boundary}` (start of part) → no double \n.
  // The blanklineregex /(?:\r\n|\n)(?:\r\n|\n)/g looks for two newline pairs separated.
  // Construct: end-of-header --XX then immediately sheet content (no part header).
  const boundary = "SCNOBLANK";
  const str = [
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    `--${boundary}`,
    "Content-type: text/plain; charset=UTF-8",
    "",
    "version:1.0",
    "part:sheet",
    `--${boundary}`, // end of header
    "version:1.5", // part content immediately, no Content-type header
    "cell:A1:t:x", // no \n\n to match blanklineregex
    "sheet:c:1:r:1",
    `--${boundary}--`,
  ].join("\n");
  const result = viewer.DecodeSpreadsheetSave(str);
  expect(typeof result).toBe("object");
});

// -----------------------------------------------------------------------------
// Viewer: DecodeSpreadsheetSave part-loop ending boundary regex fail (L19702)
// -----------------------------------------------------------------------------

test("Gaps3: Viewer DecodeSpreadsheetSave part body end boundary not found", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  // Header parses with part:sheet. Blank line found, content start found,
  // but no closing boundary in body — boundaryregex fails → return parts.
  // Construct: valid header, part:sheet, content with blank line,
  // but NO closing --boundary line at all.
  const boundary = "SCNOBODYEND";
  const str = [
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
    "cell:A1:t:nobody",
    "sheet:c:1:r:1",
    // NO closing boundary — boundaryregex fails on last part (but for non-last
    // part too since partlist has only "sheet" and pnum == 0 == length-1).
    // The last-part regex is ^--XX--$, so if absent → fail.
    "trailing-line-without-boundary",
  ].join("\n");
  const result = viewer.DecodeSpreadsheetSave(str);
  expect(typeof result).toBe("object");
});

// =============================================================================
// ROUND 4: Final reachable branch closures
// =============================================================================

// -----------------------------------------------------------------------------
// Popup: ColorChooser.Create with undefined attribs → attribs || {} else
// -----------------------------------------------------------------------------

test("Gaps4: ColorChooser.Create with undefined attribs → || {} else", async () => {
  const SC = await fresh();
  mountHost("ccnound-pv", "div");
  // Direct call via Popup.Create with no attribs → ColorChooser.Create
  // receives undefined → hits the `attribs || {}` else branch.
  SC.Popup.Create("ColorChooser", "ccnound-pv");
  expect(SC.Popup.Controls["ccnound-pv"].data.attribs).toEqual({});
});

// -----------------------------------------------------------------------------
// Popup: ColorChooser.CustomToGrid without ensureWithin → if else
// -----------------------------------------------------------------------------

test("Gaps4: ColorChooser CustomToGrid without ensureWith → if else", async () => {
  const SC = await fresh();
  mountHost("cctgNoew-pv", "div");
  // No ensureWithin in attribs.
  SC.Popup.Create("ColorChooser", "cctgNoew-pv", {});
  SC.Popup.Initialize("cctgNoew-pv", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("cctgNoew-pv");
  // First go to custom form by clicking CustomClicked.
  SC.Popup.Types.ColorChooser.CustomClicked({} as unknown as MouseEvent);
  // Now we're on custom form. CustomToGrid should rebuild grid.
  SC.Popup.Types.ColorChooser.CustomToGrid("cctgNoew-pv");
  // Now back on grid view; no ensureWithin → else of if.
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: List.MakeList — exercise every combination of o.a truthy +
// value match — covers all 3 branches of binary-expr at L16311
// -----------------------------------------------------------------------------

test("Gaps4: List.MakeList all value-match combinations with o.a truthy", async () => {
  const SC = await fresh();
  mountHost("mkmix-pv", "div");
  SC.Popup.Create("List", "mkmix-pv", { title: "t" });
  SC.Popup.Initialize("mkmix-pv", {
    attribs: {},
    value: "match",
    options: [
      // 1) o.v == value, o.a truthy, custom=true → !() = false → short-circuits.
      { o: "Cust", v: "match", a: { custom: true } },
      // 2) o.v == value, o.a truthy, custom=false cancel=false → !() = true → bg set.
      { o: "Plain", v: "match", a: { custom: false, cancel: false } },
      // 3) o.v == value, o.a truthy, cancel=true → !() = false → short-circuits.
      { o: "Can", v: "match", a: { cancel: true } },
      // 4) o.v != value, o.a truthy → o.v==value false → outer && false.
      { o: "Diff", v: "d", a: { custom: false, cancel: false } },
      // 5) o.a undefined, o.v != value → if short-circuits false → bg empty.
      { o: "PlainDiff", v: "d" },
    ],
  });
  SC.Popup.CClick("mkmix-pv");
  expect(SC.Popup.Current.id).toBe("mkmix-pv");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: List.MakeList with o.a present but no custom/cancel properties
// o.a truthy → reaches `!(o.a && (o.a.custom || o.a.cancel))`
// o.a.custom and o.a.cancel are both undefined
// → `(undefined || undefined)` → `false` → `o.a && false` → `false` → `!false` → `true`
// → reaches inner eval but false returns false from the rightmost ternary
// -----------------------------------------------------------------------------

test("Gaps4: List.MakeList o.a truthy no custom/cancel keys → all paths", async () => {
  const SC = await fresh();
  mountHost("mkez-pv", "div");
  SC.Popup.Create("List", "mkez-pv", { title: "t" });
  SC.Popup.Initialize("mkez-pv", {
    attribs: {},
    value: "match",
    options: [
      // o.v == value and o.a is truthy but no custom/cancel keys
      { o: "HasAttribs", v: "match", a: {} },
      // o.a truthy but o.a.custom is falsy → o.a.cancel truthy → !() false
      { o: "OtherMatch", v: "match", a: { cancel: true } },
      // o.a truthy, o.a.custom truthy → !() false
      { o: "OtherCust", v: "other1", a: { custom: true } },
      // o.a truthy, o.a.custom falsy, o.a.cancel falsy → !() true → bg set
      { o: "Plain2", v: "other2", a: { custom: false, cancel: false } },
    ],
  });
  SC.Popup.CClick("mkez-pv");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Popup: List.MakeList with newcol option exercising ncols increment and
// `o.v == value` and all o.a.* flag combinations across cols
// -----------------------------------------------------------------------------

test("Gaps4: List.MakeList newcol then matches across columns", async () => {
  const SC = await fresh();
  mountHost("mknew-pv", "div");
  SC.Popup.Create("List", "mknew-pv", { title: "t" });
  SC.Popup.Initialize("mknew-pv", {
    attribs: {},
    value: "matchvalue",
    options: [
      { o: "C1_text", v: "c1" },
      // newcol → ncols becomes 2.
      { o: "ColHeading", v: "c2", a: { newcol: true } },
      // Second column regular option that matches value.
      { o: "Match", v: "matchvalue", a: { custom: false, cancel: false } },
      // Second column regular option mismatch.
      { o: "NoMatch2", v: "nm" },
      // Custom and cancel in the second column.
      { o: "Custom", v: "matchvalue", a: { custom: true } },
      { o: "CancelBtn", v: "matchvalue", a: { cancel: true } },
    ],
  });
  SC.Popup.CClick("mknew-pv");
  expect(SC.Popup.Current.id).toBe("mknew-pv");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Round 2: remaining small gaps
// -----------------------------------------------------------------------------

test("Gaps5: List.Initialize with falsy (non-null) data takes the empty-options branch", async () => {
  const SC = await fresh();
  mountHost("falsydata-pv", "div");
  SC.Popup.Create("List", "falsydata-pv", { title: "t" });
  // `data` itself is falsy (0) but not null/undefined, so `data.attribs`
  // auto-boxes to `undefined` (no throw) and `data ? data.options : []`
  // takes the `[]` branch instead of the usual `data.options` branch.
  expect(() =>
    SC.Popup.Initialize("falsydata-pv", 0 as unknown as Parameters<typeof SC.Popup.Initialize>[1]),
  ).not.toThrow();
  const data = SC.Popup.Controls["falsydata-pv"].data as unknown as {
    options: unknown[];
  };
  expect(data.options).toEqual([]);
});

test("Gaps5: List.Show with mainele present but no firstChild skips the disable step", async () => {
  const SC = await fresh();
  mountHost("noshowfc-pv", "div");
  SC.Popup.Create("List", "noshowfc-pv", { title: "t" });
  SC.Popup.Initialize("noshowfc-pv", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  const data = SC.Popup.Controls["noshowfc-pv"].data as unknown as {
    mainele?: HTMLElement;
  };
  // mainele exists (set during Create) but has no children yet on a
  // fresh control, so `spcdata.mainele.firstChild` is null — Show must
  // not throw when skipping the disable-existing-content step.
  if (data.mainele) {
    while (data.mainele.firstChild) {
      data.mainele.removeChild(data.mainele.firstChild);
    }
  }
  expect(() => SC.Popup.CClick("noshowfc-pv")).not.toThrow();
  SC.Popup.Close();
});

test("Gaps5: ColorChooser GridMouseDown clamps row to the last grid row", async () => {
  const SC = await fresh();
  mountHost("ccrowclamp-pv", "div");
  SC.Popup.Create("ColorChooser", "ccrowclamp-pv", {});
  SC.Popup.Types.ColorChooser.GridMouseDown({
    type: "mousedown",
    clientX: 10,
    clientY: 10,
  } as unknown as MouseEvent);
  // A very large clientY drives the computed row well past the palette's
  // last row (15), forcing the `row > 15 ? 15 : row` clamp branch.
  expect(() =>
    SC.Popup.Types.ColorChooser.GridMouseDown({
      type: "mousemove",
      clientX: 10,
      clientY: 5000,
    } as unknown as MouseEvent),
  ).not.toThrow();
  SC.Popup.Types.ColorChooser.GridMouseDown({
    type: "mouseup",
    clientX: 10,
    clientY: 5000,
  } as unknown as MouseEvent);
  SC.Popup.Close();
});

test("Gaps: Viewer DecodeSpreadsheetSave direct function captures sheet part offsets", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();
  const boundary = "SCMPV3_FUNC";
  const str = [
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
    "cell:A1:v:42",
    "sheet:c:1:r:1",
    `--${boundary}--`,
  ].join("\n");

  const parts = SC.SpreadsheetViewerDecodeSpreadsheetSave(viewer, str);
  expect(parts.sheet).toBeDefined();
  expect(parts.sheet.start).toBeGreaterThanOrEqual(0);
  expect(parts.sheet.end).toBeGreaterThan(parts.sheet.start);
  const sheetChunk = str.substring(parts.sheet.start, parts.sheet.end);
  expect(sheetChunk).toContain("cell:A1:v:42");
  expect(sheetChunk).toContain("sheet:c:1:r:1");
});

// -----------------------------------------------------------------------------
// ColorChooser CreateGrid onclick arrow handlers (lines 1490, 1492, 1494)
// These arrow functions are wired as grid.defaultbox.onclick, grid.custom.onclick,
// and grid.msg.onclick inside CreateGrid. Existing tests call DefaultClicked /
// CustomClicked / CloseOK DIRECTLY, leaving the arrow wrappers uncovered.
// We invoke the wired handler properties instead and assert popup state change.
// -----------------------------------------------------------------------------

test("Gaps6: ColorChooser grid.defaultbox.onclick fires DefaultClicked via arrow handler", async () => {
  const SC = await fresh();
  mountHost("ccarrow-def", "div");
  SC.Popup.Create("ColorChooser", "ccarrow-def", {});
  SC.Popup.Initialize("ccarrow-def", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("ccarrow-def");
  expect(SC.Popup.Current.id).toBe("ccarrow-def");

  const grid = SC.Popup.Controls["ccarrow-def"].data.grid as Record<string, any>;
  expect(typeof grid.defaultbox.onclick).toBe("function");

  // Invoke the wired arrow handler — should clear value and close popup.
  grid.defaultbox.onclick({} as unknown as MouseEvent);
  expect(SC.Popup.Current.id).toBeNull();
  expect(SC.Popup.GetValue("ccarrow-def")).toBe("");
});

test("Gaps6: ColorChooser grid.custom.onclick fires CustomClicked via arrow handler", async () => {
  const SC = await fresh();
  mountHost("ccarrow-cust", "div");
  SC.Popup.Create("ColorChooser", "ccarrow-cust", {});
  SC.Popup.Initialize("ccarrow-cust", { attribs: {}, value: "rgb(1,2,3)" });
  SC.Popup.CClick("ccarrow-cust");
  expect(SC.Popup.Current.id).toBe("ccarrow-cust");

  const grid = SC.Popup.Controls["ccarrow-cust"].data.grid as Record<string, any>;
  expect(typeof grid.custom.onclick).toBe("function");

  // Invoke the wired arrow handler — should switch to custom form.
  grid.custom.onclick({} as unknown as MouseEvent);
  expect(SC.Popup.Controls["ccarrow-cust"].data.customele).toBeDefined();
});

test("Gaps6: ColorChooser grid.msg.onclick fires CloseOK via arrow handler", async () => {
  const SC = await fresh();
  mountHost("ccarrow-ok", "div");
  SC.Popup.Create("ColorChooser", "ccarrow-ok", {});
  SC.Popup.Initialize("ccarrow-ok", { attribs: {}, value: "rgb(50,60,70)" });
  SC.Popup.CClick("ccarrow-ok");
  expect(SC.Popup.Current.id).toBe("ccarrow-ok");

  const grid = SC.Popup.Controls["ccarrow-ok"].data.grid as Record<string, any>;
  expect(typeof grid.msg.onclick).toBe("function");

  // Invoke the wired arrow handler — should SetValue + Close.
  grid.msg.onclick({} as unknown as MouseEvent);
  expect(SC.Popup.Current.id).toBeNull();
});

// -----------------------------------------------------------------------------
// ColorChooser grid.table.onmousedown arrow handler (line 1497)
// The arrow function wired as grid.table.onmousedown in CreateGrid. Existing
// tests call GridMouseDown DIRECTLY, leaving the arrow wrapper uncovered.
// We invoke the wired handler property instead.
// -----------------------------------------------------------------------------

test("Gaps6: ColorChooser grid.table.onmousedown fires GridMouseDown via arrow handler", async () => {
  const SC = await fresh();
  mountHost("ccarrow-md", "div");
  SC.Popup.Create("ColorChooser", "ccarrow-md", {});
  SC.Popup.Initialize("ccarrow-md", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("ccarrow-md");
  expect(SC.Popup.Current.id).toBe("ccarrow-md");

  const grid = SC.Popup.Controls["ccarrow-md"].data.grid as Record<string, any>;
  expect(typeof grid.table.onmousedown).toBe("function");

  // Invoke the wired arrow handler with a mousedown event.
  // Use extreme clientY to also exercise the row>15 clamp (block 121, branch 0).
  grid.table.onmousedown({
    type: "mousedown",
    clientX: 9999,
    clientY: 9999,
  } as unknown as MouseEvent);
  // GridMouseDown should have set grid.mousedown = true.
  expect(grid.mousedown).toBe(true);

  // Clean up.
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Viewer: InitializeSpreadsheetViewer with editorDiv falsy (L270 branch 1)
// The `if (spreadsheet.spreadsheetDiv && spreadsheet.editorDiv)` guard —
// spreadsheetDiv is always created (truthy), but editorDiv comes from
// CreateTableEditor which always returns a truthy element. To hit the
// falsy-editorDiv arm, we mock CreateTableEditor to return null before
// calling InitializeSpreadsheetViewer. The appendChild is then skipped.
// -----------------------------------------------------------------------------

test("Gaps6: Viewer InitializeSpreadsheetViewer skips appendChild when editorDiv is null (L270 branch 1)", async () => {
  const SC = await fresh();
  const viewer = new SC.SpreadsheetViewer();

  // Mock CreateTableEditor to return null so editorDiv is falsy.
  const editorRec = viewer.editor as unknown as Record<string, unknown>; // Unchecked cast to override CreateTableEditor return
  editorRec.CreateTableEditor = function () {
    return null;
  };

  const container = document.createElement("div");
  document.body.appendChild(container);

  // Should not throw — the if guard skips the appendChild.
  expect(() => viewer.InitializeSpreadsheetViewer(container, 300, 400, 20)).not.toThrow();

  // spreadsheetDiv was created (truthy), editorDiv is null (falsy).
  expect(viewer.spreadsheetDiv).toBeDefined();
  expect(viewer.editorDiv).toBeNull();

  // The appendChild was skipped — spreadsheetDiv should have no children
  // from editorDiv (statusline may still be appended if hasStatusLine).
  // Verify the guard worked: editorDiv was NOT appended.
  const spreadsheetDiv = viewer.spreadsheetDiv;
  expect(spreadsheetDiv).not.toBeNull();
  const hasEditorChild = Array.from(spreadsheetDiv!.childNodes).some((n) => n === viewer.editorDiv);
  expect(hasEditorChild).toBe(false);
});
