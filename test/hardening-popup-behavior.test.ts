import { afterEach, expect, test, vi } from "vite-plus/test";
import type SC from "../dist/SocialCalc.js";

import { loadSocialCalc as _loadSocialCalc } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";

// -----------------------------------------------------------------------------
// Typed surface
//
// `loadSocialCalc` loads the UMD bundle dynamically via `vm.Script`, so its
// declared return type can't be statically inferred there — every consumer
// in this suite receives an untyped instance. Instead of spreading `any`
// through every test, `fresh()` below narrows once through the real ambient
// `SocialCalc` namespace types (js/socialcalcpopup.d.ts, aggregated into
// dist/SocialCalc.d.ts), so every call site in this file is fully typed.
// -----------------------------------------------------------------------------

type PopupNamespace = typeof SC.Popup;

interface PopupRuntime {
  Popup: PopupNamespace;
  Constants: typeof SC.Constants;
}

/**
 * The FakeElement test shim (test/helpers/socialcalc.ts) models a DOM node
 * loosely: layout metrics are writable there (the real `HTMLElement` type
 * marks them readonly) and any element can carry `.value`/`.disabled`,
 * mirroring the synthetic `<input>` markup List/ColorChooser controls
 * render. This narrows exactly the extra surface these tests touch, so the
 * `asFakeDom` cast stays meaningful instead of disabling checking wholesale.
 */
interface FakeDomNode extends HTMLElement {
  offsetHeight: number;
  offsetWidth: number;
  offsetTop: number;
  offsetLeft: number;
  value: string;
  disabled: boolean;
}

function asFakeDom(node: ChildNode | HTMLElement | null | undefined): FakeDomNode {
  if (!node) throw new Error("Expected a DOM node but found null/undefined");
  return node as unknown as FakeDomNode;
}

/**
 * Narrow view of `SC.Popup.Controls[id].data`. The ambient `PopupControl`
 * interface types `data` as an open index bag (`{ [k: string]: any }`)
 * because it is genuinely polymorphic per control type; this local shape
 * captures only the fields List/ColorChooser controls actually populate.
 */
interface PopupControlData {
  mainele?: HTMLElement;
  popupele?: (HTMLElement & { style: CSSStyleDeclaration }) | null;
  listdiv?: HTMLElement | null;
  customele?: HTMLElement | null;
  disabled?: boolean;
  value?: string;
  oldvalue?: string;
  custom?: boolean;
  grid?: PopupColorGrid;
}

interface PopupColorGridEntry {
  ele: HTMLElement;
  rgb?: string;
}

interface PopupColorGrid {
  msg: HTMLElement;
  [key: string]: unknown;
}

function controlData(runtime: PopupRuntime, id: string): PopupControlData {
  const control = runtime.Popup.Controls[id];
  if (!control) throw new Error(`No popup control registered for "${id}"`);
  return control.data as unknown as PopupControlData;
}

function gridEntry(
  runtime: PopupRuntime,
  grid: PopupColorGrid,
  row: number,
  col: number,
): PopupColorGridEntry {
  const raw = runtime.Popup.Types.ColorChooser.gridToG(grid, row, col);
  return raw as unknown as PopupColorGridEntry;
}

/**
 * Synthetic grid event — the popup's GridMouseDown only reads `type`,
 * `clientX`, and `clientY`, so a full MouseEvent is unnecessary. The cast
 * through `unknown` is a one-off, documented bridge to the ambient
 * `MouseEvent | Event` parameter: the object is behaviorally sufficient
 * for the popup code despite not satisfying the full DOM type.
 */
interface GridEventInit {
  type: "mousedown" | "mousemove" | "mouseup";
  clientX: number;
  clientY: number;
}
function gridEvent(init: GridEventInit): MouseEvent {
  return init as unknown as MouseEvent;
}

// -----------------------------------------------------------------------------
// Fixture plumbing (mirrors the sibling popup coverage suite's pattern)
// -----------------------------------------------------------------------------

// Use `any`-free casts via `as unknown as` on the timer functions: the
// Node and DOM `setTimeout` signatures differ structurally, but the
// assignment is intentionally bridging them, and a runtime check is
// meaningless for a host timer primitive.
const liveTimers = new Set<unknown>();
const originalSetTimeout = globalThis.setTimeout as unknown as (
  handler: TimerHandler,
  timeout?: number,
) => unknown;
const originalClearTimeout = globalThis.clearTimeout as unknown as (id?: unknown) => void;
function wrappedSetTimeout(handler: TimerHandler, timeout?: number): unknown {
  const id = originalSetTimeout(handler, timeout);
  liveTimers.add(id);
  return id;
}
function wrappedClearTimeout(id?: unknown): void {
  if (id) liveTimers.delete(id);
  originalClearTimeout(id);
}
function wrapTimerGlobals() {
  (globalThis as unknown as { setTimeout: unknown }).setTimeout = wrappedSetTimeout;
  (globalThis as unknown as { clearTimeout: unknown }).clearTimeout = wrappedClearTimeout;
  const win = globalThis.window as (Window & typeof globalThis) | undefined;
  if (win) {
    win.setTimeout = wrappedSetTimeout as typeof win.setTimeout;
    win.clearTimeout = wrappedClearTimeout as typeof win.clearTimeout;
  }
}

const originalAlert = globalThis.alert;

afterEach(() => {
  for (const id of liveTimers) {
    originalClearTimeout(id);
  }
  liveTimers.clear();
  (globalThis as unknown as { setTimeout: unknown }).setTimeout = originalSetTimeout;
  (globalThis as unknown as { clearTimeout: unknown }).clearTimeout = originalClearTimeout;
  const win = globalThis.window as (Window & typeof globalThis) | undefined;
  if (win) {
    win.setTimeout = originalSetTimeout as typeof win.setTimeout;
    win.clearTimeout = originalClearTimeout as typeof win.clearTimeout;
  }
  // Never let an alert spy installed by one test leak into the next.
  globalThis.alert = originalAlert;
  const win2 = globalThis.window as (Window & typeof globalThis) | undefined;
  if (win2) win2.alert = originalAlert;
});

async function fresh(): Promise<PopupRuntime> {
  const instance = await _loadSocialCalc({ browser: true });
  installUiShim();
  wrapTimerGlobals();
  return instance as PopupRuntime;
}

function mountHost(hostId: string, tag: "div" | "span" = "div") {
  const container = document.createElement("div");
  container.id = `${hostId}-container`;
  document.body.appendChild(container);
  const mount = document.createElement(tag);
  mount.id = hostId;
  container.appendChild(mount);
  const mountNode = asFakeDom(mount);
  const containerNode = asFakeDom(container);
  mountNode.offsetHeight = 20;
  mountNode.offsetWidth = 100;
  containerNode.offsetHeight = 400;
  containerNode.offsetWidth = 400;
  return { container, mount };
}

// -----------------------------------------------------------------------------
// Registration & malformed-DOM boundaries
// -----------------------------------------------------------------------------

test("Popup.Create is a silent no-op for an unregistered type but still refreshes imagePrefix", async () => {
  const SC = await fresh();
  SC.Popup.imagePrefix = "definitely-not-the-real-prefix/";
  SC.Popup.Create("NoSuchType999", "ghost-id", {});
  // No control record gets created when the type isn't in the dispatch table.
  expect(SC.Popup.Controls["ghost-id"]).toBeUndefined();
  // The image-prefix refresh runs unconditionally, outside the type guard.
  expect(SC.Popup.imagePrefix).toBe(SC.Constants.defaultImagePrefix);
  expect(SC.Popup.imagePrefix).not.toBe("definitely-not-the-real-prefix/");
});

test("List.Create alerts and skips DOM wiring when the target element is missing", async () => {
  const SC = await fresh();
  const alertSpy = vi.fn();
  globalThis.alert = alertSpy;
  window.alert = alertSpy;
  SC.Popup.Create("List", "missing-host-list", { title: "t" });
  expect(alertSpy).toHaveBeenCalledWith("Missing element missing-host-list");
  // The control record is created before the DOM lookup, but mainele is
  // never assigned once the element can't be found.
  expect(controlData(SC, "missing-host-list").mainele).toBeUndefined();
});

test("ColorChooser.Create alerts and skips DOM wiring when the target element is missing", async () => {
  const SC = await fresh();
  const alertSpy = vi.fn();
  globalThis.alert = alertSpy;
  window.alert = alertSpy;
  SC.Popup.Create("ColorChooser", "missing-host-cc", {});
  expect(alertSpy).toHaveBeenCalledWith("Missing element missing-host-cc");
  expect(controlData(SC, "missing-host-cc").mainele).toBeUndefined();
});

// -----------------------------------------------------------------------------
// Dispatch branches for a type registered without full handler methods
// -----------------------------------------------------------------------------

test("SetValue/SetDisabled/GetValue no-op for a type object lacking handler methods", async () => {
  const SC = await fresh();
  // A registered type object with no Create/SetValue/SetDisabled/GetValue —
  // distinct from an entirely unregistered type (SC.Popup.Types[type] is
  // truthy here, only `.Create` is missing, so the `pt && pt.Create` guard
  // is the branch that is taken).
  SC.Popup.Types.StubHandlerless = {};
  SC.Popup.Controls["stub-ctrl"] = {
    type: "StubHandlerless",
    value: "preserved-value",
    display: "preserved-display",
    data: { preservedDataKey: "preserved" },
  };
  SC.Popup.SetValue("stub-ctrl", "x");
  SC.Popup.SetDisabled("stub-ctrl", true);
  // No data mutation: nothing was written under data, and the control's
  // top-level value/display fields stay exactly as the test seeded them.
  expect(SC.Popup.Controls["stub-ctrl"].value).toBe("preserved-value");
  expect(SC.Popup.Controls["stub-ctrl"].display).toBe("preserved-display");
  expect(SC.Popup.Controls["stub-ctrl"].data).toEqual({ preservedDataKey: "preserved" });
  // GetValue returns null because the type object has no Create handler, so
  // the `if (pt && pt.Create)` branch (which calls the per-type GetValue
  // under it) is skipped and execution falls through to `return null`.
  expect(SC.Popup.GetValue("stub-ctrl")).toBeNull();
});

test("CClick still marks a handler-less type as current even though nothing renders", async () => {
  const SC = await fresh();
  SC.Popup.Types.StubOpen = {}; // no Show handler either
  SC.Popup.Controls["stub-open"] = { type: "StubOpen", value: "", display: "", data: {} };
  SC.Popup.CClick("stub-open");
  expect(SC.Popup.Current.id).toBe("stub-open");
  // Close()/Cancel() would call the (nonexistent) Hide/Cancel handler on
  // this stub type and throw, so reset the shared Current state directly
  // rather than leaking it into later tests.
  SC.Popup.Current.id = null;
});

test("Reset no-ops when the registered type object has no Reset handler — Current.id is left untouched", async () => {
  const SC = await fresh();
  SC.Popup.Types.StubReset = {};
  // Seed a Current.id so we can prove Reset("StubReset") (a type with no
  // Reset handler) doesn't close an unrelated popup the way a real
  // List/ColorChooser Reset("List") would. The branch we exercise is the
  // falsy `if (spt[type].Reset)` check on the unknown handler type.
  SC.Popup.Current.id = "stub-foreign";
  SC.Popup.Reset("StubReset");
  // Reset("StubReset") looked up a type with no Reset handler → no-op:
  // the foreign popup is still "open" and its control mapping is intact.
  expect(SC.Popup.Current.id).toBe("stub-foreign");
  SC.Popup.Current.id = null;
});

test("Reset no-ops for a never-registered type — Current.id is left untouched", async () => {
  const SC = await fresh();
  // Reset follows the same unknown-type no-op contract as
  // SetValue/GetValue/CClick. Seed Current.id to prove that an absent type
  // neither closes the unrelated popup nor mutates the current state.
  SC.Popup.Current.id = "stub-foreign";
  SC.Popup.Reset("TotallyUnknownType12345");
  expect(SC.Popup.Current.id).toBe("stub-foreign");
  SC.Popup.Current.id = null;
});

// -----------------------------------------------------------------------------
// CClick guard + CreatePopupDiv attribs
// -----------------------------------------------------------------------------

test("CClick returns early without opening a disabled control", async () => {
  const SC = await fresh();
  mountHost("disabled-cclick", "span");
  SC.Popup.Create("List", "disabled-cclick", { title: "t" });
  SC.Popup.Initialize("disabled-cclick", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.SetDisabled("disabled-cclick", true);
  expect(controlData(SC, "disabled-cclick").disabled).toBe(true);
  SC.Popup.CClick("disabled-cclick");
  expect(SC.Popup.Current.id).toBeNull();
  expect(controlData(SC, "disabled-cclick").popupele).toBeFalsy();
});

test("CreatePopupDiv positions from GetElementPosition + host height, and honors width/border", async () => {
  const SC = await fresh();
  mountHost("pos-list", "span");
  SC.Popup.Create("List", "pos-list", { title: "t", width: "250px" });
  SC.Popup.Initialize("pos-list", { attribs: {}, value: "", options: [{ o: "A", v: "a" }] });
  const mainele = asFakeDom(controlData(SC, "pos-list").mainele);
  mainele.offsetLeft = 63;
  mainele.offsetTop = 15;
  mainele.offsetHeight = 25;
  SC.Popup.CClick("pos-list");
  const popupele = controlData(SC, "pos-list").popupele;
  if (!popupele) throw new Error("expected popupele to be created");
  // top = pos.top + mainele.offsetHeight; left = pos.left (GetElementPosition
  // walks the offsetParent chain, which is empty here, so pos == the host's
  // own offsetTop/offsetLeft).
  expect(popupele.style.top).toBe("40px");
  expect(popupele.style.left).toBe("63px");
  expect(popupele.style.width).toBe("250px");
  expect(popupele.style.border).toBe("1px solid black");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// Close / Cancel behavioral contracts
// -----------------------------------------------------------------------------

test("List.Cancel discards without restoring — List tracks no oldvalue", async () => {
  const SC = await fresh();
  mountHost("cancel-list", "span");
  SC.Popup.Create("List", "cancel-list", { title: "t" });
  SC.Popup.Initialize("cancel-list", {
    attribs: {},
    value: "a",
    options: [
      { o: "A", v: "a" },
      { o: "B", v: "b" },
    ],
  });
  SC.Popup.CClick("cancel-list");
  SC.Popup.SetValue("cancel-list", "b"); // change while open
  expect(SC.Popup.GetValue("cancel-list")).toBe("b");
  SC.Popup.Cancel();
  expect(SC.Popup.Current.id).toBeNull();
  // List.Cancel only delegates to Hide — it never restores a prior value,
  // unlike ColorChooser.Cancel below.
  expect(SC.Popup.GetValue("cancel-list")).toBe("b");
});

test("ColorChooser.Cancel restores the pre-open value after a grid color pick", async () => {
  const SC = await fresh();
  mountHost("cancel-cc", "div");
  SC.Popup.Create("ColorChooser", "cancel-cc", {});
  SC.Popup.Initialize("cancel-cc", { attribs: {}, value: "rgb(10,20,30)" });
  SC.Popup.CClick("cancel-cc"); // captures oldvalue = rgb(10,20,30)
  SC.Popup.Types.ColorChooser.GridMouseDown(
    gridEvent({ type: "mousedown", clientX: 45, clientY: 50 }),
  );
  const pickedValue = SC.Popup.GetValue("cancel-cc");
  expect(pickedValue).not.toBe("rgb(10,20,30)");
  SC.Popup.Cancel();
  expect(SC.Popup.Current.id).toBeNull();
  expect(SC.Popup.GetValue("cancel-cc")).toBe("rgb(10,20,30)");
});

test("ColorChooser oldvalue snapshot is recaptured on each open; Close keeps, Cancel reverts only to the latest snapshot", async () => {
  const SC = await fresh();
  mountHost("cancel-cc-reopen", "div");
  SC.Popup.Create("ColorChooser", "cancel-cc-reopen", {});
  SC.Popup.Initialize("cancel-cc-reopen", { attribs: {}, value: "rgb(1,2,3)" });

  SC.Popup.CClick("cancel-cc-reopen");
  SC.Popup.Types.ColorChooser.GridMouseDown(
    gridEvent({ type: "mousedown", clientX: 45, clientY: 50 }),
  ); // red channel
  const afterFirstPick = SC.Popup.GetValue("cancel-cc-reopen");
  expect(afterFirstPick).not.toBe("rgb(1,2,3)");
  SC.Popup.Close(); // Close keeps the picked value — no restore.
  expect(SC.Popup.GetValue("cancel-cc-reopen")).toBe(afterFirstPick);

  SC.Popup.CClick("cancel-cc-reopen"); // oldvalue re-captured here
  SC.Popup.Types.ColorChooser.GridMouseDown(
    gridEvent({ type: "mousedown", clientX: 85, clientY: 120 }),
  ); // blue channel
  const afterSecondPick = SC.Popup.GetValue("cancel-cc-reopen");
  expect(afterSecondPick).not.toBe(afterFirstPick);
  SC.Popup.Cancel();
  expect(SC.Popup.Current.id).toBeNull();
  // Reverts to the value captured at the *second* open, not the original.
  expect(SC.Popup.GetValue("cancel-cc-reopen")).toBe(afterFirstPick);
});

// -----------------------------------------------------------------------------
// Keyboard/mouse selection — real DOM assertions, not just "does not throw"
// -----------------------------------------------------------------------------

test("List.MouseMove highlights the hovered option and clears sibling highlighting", async () => {
  const SC = await fresh();
  mountHost("mm-real-list", "span");
  SC.Popup.Create("List", "mm-real-list", { title: "t" });
  SC.Popup.Initialize("mm-real-list", {
    attribs: {},
    value: "",
    options: [
      { o: "A", v: "a" },
      { o: "B", v: "b" },
    ],
  });
  SC.Popup.CClick("mm-real-list");
  const listdiv = controlData(SC, "mm-real-list").listdiv;
  if (!listdiv) throw new Error("expected listdiv to be populated");
  const table = asFakeDom(listdiv.firstChild);
  const tbody = asFakeDom(table.firstChild);
  const rowele = asFakeDom(tbody.firstChild);
  const td = asFakeDom(rowele.firstChild);
  const divA = asFakeDom(td.childNodes[0]);
  const divB = asFakeDom(td.childNodes[1]);

  SC.Popup.Types.List.MouseMove("mm-real-list", divB);
  expect(divB.style.backgroundColor).toBe("#DDF");
  expect(divA.style.backgroundColor).toBe("#FFF");

  SC.Popup.Types.List.MouseMove("mm-real-list", divA);
  expect(divA.style.backgroundColor).toBe("#DDF");
  expect(divB.style.backgroundColor).toBe("#FFF");
  SC.Popup.Close();
});

test("List.ItemClicked updates the visible input's displayed value, not just the internal value", async () => {
  const SC = await fresh();
  mountHost("ic-visible-list", "span");
  SC.Popup.Create("List", "ic-visible-list", { title: "t" });
  SC.Popup.Initialize("ic-visible-list", {
    attribs: {},
    value: "",
    options: [
      { o: "Alpha", v: "a" },
      { o: "Beta", v: "b" },
    ],
  });
  SC.Popup.CClick("ic-visible-list");
  SC.Popup.Types.List.ItemClicked("ic-visible-list", 1);
  expect(SC.Popup.GetValue("ic-visible-list")).toBe("b");
  const input = asFakeDom(controlData(SC, "ic-visible-list").mainele?.firstChild);
  expect(input.value).toBe("Beta");
});

test("ColorChooser.GridMouseDown updates the arrow marker, message swatch, and flips text color across the light/dark threshold", async () => {
  const SC = await fresh();
  mountHost("grid-visual-pop", "div");
  SC.Popup.Create("ColorChooser", "grid-visual-pop", {});
  SC.Popup.Initialize("grid-visual-pop", { attribs: {}, value: "rgb(10,20,30)" }); // sum=60 < 220
  SC.Popup.CClick("grid-visual-pop");
  const data = controlData(SC, "grid-visual-pop");
  const grid = data.grid;
  if (!grid) throw new Error("expected grid to be populated");

  // Dark starting color renders white message text.
  expect(grid.msg.style.color).toBe("#FFF");

  const redSwatch = gridEntry(SC, grid, 4, 2); // row 4, red column
  expect(redSwatch.ele.style.backgroundImage).toBe("");

  SC.Popup.Types.ColorChooser.GridMouseDown(
    gridEvent({ type: "mousedown", clientX: 45, clientY: 50 }),
  );

  // The picked swatch grows an arrow marker...
  expect(redSwatch.ele.style.backgroundImage).toContain("chooserarrow.gif");
  // ...the message swatch mirrors the composed color and hex title...
  const newValue = SC.Popup.GetValue("grid-visual-pop");
  // Independently-derived expected value (not computed via RGBToHex/makeRGB,
  // the functions under test elsewhere): row 4 of the red column (col=2) is
  // red = 17*(15-4) = 187 = 0xBB; green/blue carry over unchanged from the
  // original rgb(10,20,30) seed -> g=20=0x14, b=30=0x1E.
  expect(newValue).toBe("rgb(187,20,30)");
  expect(grid.msg.style.backgroundColor).toBe("rgb(187,20,30)");
  expect(grid.msg.title).toBe("BB141E");
  // ...and since the new sum crosses 220, text color flips to black.
  expect(grid.msg.style.color).toBe("#000");
  SC.Popup.Close();
});

// -----------------------------------------------------------------------------
// SetDisabled — real DOM assertions
// -----------------------------------------------------------------------------

test("List.SetDisabled toggles the underlying input's disabled DOM attribute", async () => {
  const SC = await fresh();
  mountHost("dis-real-list", "span");
  SC.Popup.Create("List", "dis-real-list", { title: "t" });
  SC.Popup.Initialize("dis-real-list", { attribs: {}, value: "", options: [{ o: "A", v: "a" }] });
  const input = asFakeDom(controlData(SC, "dis-real-list").mainele?.firstChild);
  expect(input.disabled).toBeFalsy();
  SC.Popup.SetDisabled("dis-real-list", true);
  expect(input.disabled).toBe(true);
  SC.Popup.SetDisabled("dis-real-list", false);
  expect(input.disabled).toBe(false);
});

test("ColorChooser.SetDisabled toggles background styling directly on the DOM node", async () => {
  const SC = await fresh();
  mountHost("dis-real-cc", "div");
  SC.Popup.Create("ColorChooser", "dis-real-cc", {});
  SC.Popup.Initialize("dis-real-cc", { attribs: {}, value: "rgb(5,6,7)" });
  const swatch = asFakeDom(controlData(SC, "dis-real-cc").mainele?.firstChild);
  expect(swatch.style.backgroundColor).toBe("rgb(5,6,7)");
  SC.Popup.SetDisabled("dis-real-cc", true);
  expect(swatch.style.backgroundColor).toBe("#DDD");
  SC.Popup.SetDisabled("dis-real-cc", false);
  expect(swatch.style.backgroundColor).toBe("rgb(5,6,7)");
});

// -----------------------------------------------------------------------------
// Value mapping / malformed-input boundaries
// -----------------------------------------------------------------------------

test("List MakeCustom escapes unsafe characters in the custom value attribute", async () => {
  const SC = await fresh();
  mountHost("xss-real-list", "span");
  SC.Popup.Create("List", "xss-real-list", { title: "t" });
  SC.Popup.Initialize("xss-real-list", { attribs: {}, value: "", options: [{ o: "A", v: "a" }] });
  SC.Popup.SetValue("xss-real-list", '<script>alert(1)</script>&"quoted"');
  const html = SC.Popup.Types.List.MakeCustom("List", "xss-real-list");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&amp;");
  expect(html).toContain("&quot;quoted&quot;");
});

test("splitRGB clamps negative channels to 0 rather than parsing the trailing digits", async () => {
  const SC = await fresh();
  // The regex now captures the optional leading "-", so "rgb(-5,10,20)"
  // parses the channel as -5 and clamps to 0 — instead of the previous
  // behavior of skipping the minus sign and silently turning -5 into +5.
  expect(SC.Popup.splitRGB("rgb(-5,10,20)")).toEqual({ r: 0, g: 10, b: 20 });
  // Channels above 255 are clamped down to 255, not left as out-of-range
  // values that downstream consumers would then churn back into malformed
  // hex.
  expect(SC.Popup.splitRGB("rgb(300,10,20)")).toEqual({ r: 255, g: 10, b: 20 });
  // ToHex/RGBToHex downstream benefit from the same clamp policy: -5 maps
  // to 0 (hex "00"), 300 maps to 255 (hex "FF"), producing a full
  // six-character hex string in every case.
  expect(SC.Popup.RGBToHex("rgb(-5,10,20)")).toBe("000A14");
});

test("splitRGB falls back to {0,0,0} when a channel is missing entirely", async () => {
  const SC = await fresh();
  expect(SC.Popup.splitRGB("rgb(1,2)")).toEqual({ r: 0, g: 0, b: 0 });
});

test("ToHex clamps out-of-range channels to 0..255 so RGBToHex always emits six hex characters", async () => {
  const SC = await fresh();
  // ToHex no longer indexes past the end of HexDigits for out-of-range
  // inputs: 300 clamps to 255 → "FF", -5 clamps to 0 → "00". The result is
  // always a full two-character nibble pair.
  expect(SC.Popup.ToHex(300)).toBe("FF");
  expect(SC.Popup.ToHex(-5)).toBe("00");
  expect(SC.Popup.ToHex(0)).toBe("00");
  expect(SC.Popup.ToHex(255)).toBe("FF");
  // Non-finite inputs (NaN, Infinity) collapse to "00" rather than producing
  // garbage nibbles.
  expect(SC.Popup.ToHex(Number.NaN)).toBe("00");
  // RGBToHex composes ToHex three times, so an out-of-range channel yields
  // a canonical six-character hex string (was previously "C0000" — five
  // characters, because charAt(>15) silently returned "").
  expect(SC.Popup.RGBToHex("rgb(300,0,0)")).toBe("FF0000");
  expect(SC.Popup.RGBToHex("rgb(300,0,0)")).toHaveLength(6);
});

test("makeRGB shares the clamped integer policy with ToHex/splitRGB: no out-of-range rgb channels", async () => {
  const SC = await fresh();
  // The previously-buggy asymmetry: ToHex/splitRGB clamped but makeRGB
  // still printed raw "r > 0 ? r : 0", so makeRGB(300,-5,0) emitted the
  // out-of-range channel value verbatim ("rgb(300,0,0)"). After the hoist,
  // makeRGB routes through PopupClamp255 (the same file-private helper as
  // ToHex/splitRGB), so >255 channels map to 255 and <0 channels to 0.
  expect(SC.Popup.makeRGB(300, -5, 0)).toBe("rgb(255,0,0)");
  // Existing integer-input cases preserved unchanged.
  expect(SC.Popup.makeRGB(10, 20, 30)).toBe("rgb(10,20,30)");
  expect(SC.Popup.makeRGB(-5, 20, 30)).toBe("rgb(0,20,30)");
  expect(SC.Popup.makeRGB(10, -5, 30)).toBe("rgb(10,0,30)");
  expect(SC.Popup.makeRGB(10, 20, -5)).toBe("rgb(10,20,0)");
  // Explicit integer rounding (Math.trunc inside the shared clamp): a
  // non-integer channel is floored toward zero, not emitted as a decimal.
  expect(SC.Popup.makeRGB(12.5, 0, 0)).toBe("rgb(12,0,0)");
  // Non-finite channels collapse to 0 so the rgb string never contains
  // "NaN" or "Infinity".
  expect(SC.Popup.makeRGB(Number.NaN, Number.POSITIVE_INFINITY, 0)).toBe("rgb(0,0,0)");
});

// -----------------------------------------------------------------------------
// EnsurePosition — all eight layout branches with exact outcome assertions
// -----------------------------------------------------------------------------

/**
 * Drive EnsurePosition through a live popup (which sets up popupele via
 * CreatePopupDiv) then dial main, popup, and container offset geometry so
 * GetLayoutValues (offsetTop/Left/Width/Height) returns chosen values that
 * select a known branch. Each case asserts the exact pixel string assigned
 * to popup.style.top/left, not just "did not throw".
 */
function ensureCase(
  SC: PopupRuntime,
  id: string,
  dial: (main: FakeDomNode, popup: FakeDomNode, container: FakeDomNode) => void,
): FakeDomNode {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mount = document.createElement("span");
  mount.id = id;
  container.appendChild(mount);
  SC.Popup.Create("List", id, { title: "t", ensureWithin: container });
  SC.Popup.Initialize(id, {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick(id);
  const data = controlData(SC, id);
  if (!data.popupele || !data.mainele) throw new Error(`missing setup for ${id}`);
  const main = asFakeDom(data.mainele.firstChild);
  const popup = asFakeDom(data.popupele);
  const containerNode = asFakeDom(container);
  dial(main, popup, containerNode);
  SC.Popup.EnsurePosition(id, container);
  // Hide() nullifies controlData(...).popupele, so return the captured
  // node so callers assert on the live style values written by
  // EnsurePosition before Close tears the popup down.
  SC.Popup.Close();
  return popup;
}

test("EnsurePosition case 1 (room on bottom-right): top=main.bottom, left=main.left", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep1-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 500;
    container.offsetHeight = 500;
    main.offsetLeft = 100;
    main.offsetTop = 50;
    main.offsetWidth = 40;
    main.offsetHeight = 20;
    popup.offsetWidth = 80;
    popup.offsetHeight = 60;
  });
  // m.bottom=70, m.left=100, fits inside c (w=500,h=500) easily.
  expect(popup.style.top).toBe("70px");
  expect(popup.style.left).toBe("100px");
});

test("EnsurePosition case 2 (room on top-right): top=main.top-p.height, left=main.left", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep2-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 500;
    container.offsetHeight = 100;
    main.offsetLeft = 100;
    main.offsetTop = 80; // bottom = 100 = c.bottom → case 1 fails
    main.offsetWidth = 40;
    main.offsetHeight = 20;
    popup.offsetWidth = 80;
    popup.offsetHeight = 60; // top-60 = 20 > c.top(0)
  });
  expect(popup.style.top).toBe("20px");
  expect(popup.style.left).toBe("100px");
});

test("EnsurePosition case 3 (room on bottom-left): top=main.bottom, left=main.right-p.width", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep3-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 500;
    container.offsetHeight = 500;
    main.offsetLeft = 450; // left+p.width(530) > c.right(500) → case 1,2 fail
    main.offsetTop = 50;
    main.offsetWidth = 40;
    main.offsetHeight = 20;
    popup.offsetWidth = 80;
    popup.offsetHeight = 60; // right-p.width=490 > c.left(0)
  });
  expect(popup.style.top).toBe("70px");
  expect(popup.style.left).toBe("410px");
});

test("EnsurePosition case 4 (room on top-left): top=main.top-p.height, left=main.right-p.width", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep4-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 500;
    container.offsetHeight = 80;
    main.offsetLeft = 450;
    main.offsetTop = 40; // bottom = 60, bottom+p.height = 120 > c.bottom(80)
    main.offsetWidth = 40;
    main.offsetHeight = 20;
    popup.offsetWidth = 50;
    popup.offsetHeight = 30; // top-30 = 10 > c.top(0); right-p.width=440 > c.left(0)
  });
  expect(popup.style.top).toBe("10px");
  expect(popup.style.left).toBe("440px");
});

test("EnsurePosition case 5 (room on bottom-middle): top=main.bottom, left=c.left+floor((c.width-p.width)/2)", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep5-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 400;
    container.offsetHeight = 600;
    // Main near the top, offset to the right of container's left edge so
    // case 1 fails via the horizontal partition (left+p.width >= c.right)
    // while bottom+p.height still fits (case 5's only constraint on height).
    // Popup is wider than the span from main.left to c.right, so cases 1,2
    // fail on the horizontal check, and p.width < c.width keeps case 5 valid.
    main.offsetLeft = 50; // left + p.width = 430 >= c.right(400) → cases 1,2 fail
    main.offsetTop = 5;
    main.offsetWidth = 40;
    main.offsetHeight = 20;
    popup.offsetWidth = 380; // p.width(380) < c.width(400) ✓
    popup.offsetHeight = 50;
  });
  // m.bottom = 25, c.center offset = floor((400-380)/2) = 10.
  expect(popup.style.top).toBe("25px");
  expect(popup.style.left).toBe("10px");
});

test("EnsurePosition case 6 (room on top-middle): top=main.top-p.height, left=c.left+floor((c.width-p.width)/2)", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep6-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 400;
    container.offsetHeight = 100; // short: bottom+p.height > c.bottom
    // Main near the bottom so m.bottom+p.h fails cases 1,3,5, but m.top -
    // p.h succeeds as does p.width < c.width — selects case 6.
    main.offsetLeft = 50; // left+p.width(430) > c.right(400) → cases 2,4 fail on left
    main.offsetTop = 50; // top-p.height = 50-30 = 20 > c.top(0)
    main.offsetWidth = 40;
    main.offsetHeight = 20; // bottom = 70, bottom+p.h = 100 = c.bottom(100) → cases 1,3,5 fail
    popup.offsetWidth = 380; // p.width < c.width ✓
    popup.offsetHeight = 30;
  });
  // top = m.top - p.height = 50-30 = 20, left = floor((400-380)/2) = 10.
  expect(popup.style.top).toBe("20px");
  expect(popup.style.left).toBe("10px");
});

test("EnsurePosition case 7 (room on middle-right): popup placed to the right of main vertically centered", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep7-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 400;
    container.offsetHeight = 200;
    main.offsetLeft = 0;
    main.offsetTop = 0;
    main.offsetWidth = 190;
    main.offsetHeight = 190; // bottom+p.height=240>c.bottom(200) → cases 1,3,5 fail
    popup.offsetWidth = 100;
    popup.offsetHeight = 50; // m.right+p.width=290 < c.right(400) → case 7 matches
  });
  expect(popup.style.top).toBe("75px"); // floor((200-50)/2)=75
  expect(popup.style.left).toBe("190px");
});

test("EnsurePosition case 8 (room on middle-left): popup placed to the left of main vertically centered", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep8-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 400;
    container.offsetHeight = 200;
    main.offsetLeft = 300;
    main.offsetTop = 0;
    main.offsetWidth = 50;
    main.offsetHeight = 190;
    popup.offsetWidth = 200;
    popup.offsetHeight = 50; // m.left-p.width=100 > c.left(0)
  });
  expect(popup.style.top).toBe("75px");
  expect(popup.style.left).toBe("100px");
});

test("EnsurePosition else-branch (nothing fits): popup style left unchanged", async () => {
  const SC = await fresh();
  const popup = ensureCase(SC, "ep-else-pop", (main, popup, container) => {
    container.offsetLeft = 0;
    container.offsetTop = 0;
    container.offsetWidth = 10;
    container.offsetHeight = 10;
    main.offsetLeft = 0;
    main.offsetTop = 0;
    main.offsetWidth = 5;
    main.offsetHeight = 5;
    popup.offsetWidth = 100;
    popup.offsetHeight = 100;
    popup.style.top = "999px";
    popup.style.left = "888px";
  });
  // Nothing fits in a 10x10 container with a 100x100 popup → else branch
  // leaves style exactly as previously set.
  expect(popup.style.top).toBe("999px");
  expect(popup.style.left).toBe("888px");
});

test("EnsurePosition no main firstChild → alerts and returns without touching style", async () => {
  const SC = await fresh();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mount = document.createElement("span");
  mount.id = "ep-null-main-pop";
  container.appendChild(mount);
  SC.Popup.Create("List", "ep-null-main-pop", { title: "t", ensureWithin: container });
  SC.Popup.Initialize("ep-null-main-pop", {
    attribs: {},
    value: "",
    options: [{ o: "A", v: "a" }],
  });
  SC.Popup.CClick("ep-null-main-pop");
  // Remove all children from the mount so firstChild becomes null.
  while (mount.childNodes.length > 0) mount.removeChild(mount.childNodes[0]!);
  const alertSpy = vi.fn();
  globalThis.alert = alertSpy;
  window.alert = alertSpy;
  const popup = asFakeDom(controlData(SC, "ep-null-main-pop").popupele);
  popup.style.top = "555px";
  SC.Popup.EnsurePosition("ep-null-main-pop", container);
  expect(alertSpy).toHaveBeenCalledWith("No main popup element firstChild.");
  expect(popup.style.top).toBe("555px");
  SC.Popup.Close();
});
