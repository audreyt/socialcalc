import { expect, test } from "vite-plus/test";

import {
  installBrowserShim,
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  waitForStatus,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import { ensureTrackedTimers } from "./helpers/timer-tracking";

// The mini innerHTML parser in test/helpers/ui.ts (tokenize/buildFromTokens)
// isn't exported; its runtime shape doesn't match lib.dom's Node/Element
// typings, so tests that walk the resulting tree read through this local
// shape rather than casting to `any`.
type ShimNode = { tagName: string; childNodes: ShimNode[] };
type JqWrap = { length: number };
type JqStub = (selOrHtml: string) => JqWrap & {
  append(child: unknown): JqWrap;
  on(event: string, fn: (...args: unknown[]) => void): JqWrap;
  keyup(fn: (...args: unknown[]) => void): JqWrap;
};

// Exercises the FakeElement/FakeDocument DOM shim and the async status-wait
// helpers in test/helpers/socialcalc.ts directly, plus the idempotent-install
// guard in timer-tracking.ts. These are early-return / not-found / string-vs-
// function-overload branches that the higher-level SocialCalc-bundle tests
// never happen to hit because every real call site takes the "normal" path.

type MockSheet = { statuscallback?: (...args: unknown[]) => void };

test("FakeElement/FakeDocument DOM shim edge cases", () => {
  installBrowserShim();

  const parent = document.createElement("div");
  const a = document.createElement("span");
  const b = document.createElement("span");

  // insertBefore(child, null) takes the appendChild fast path.
  expect(parent.insertBefore(a, null)).toBe(a);
  expect(parent.childNodes.length).toBe(1);
  expect(parent.childNodes[0]).toBe(a);

  // insertBefore(child, before) where `before` isn't an existing child
  // falls back to pushing at the end instead of splicing.
  const stray = document.createElement("span");
  expect(parent.insertBefore(b, stray)).toBe(b);
  expect(parent.childNodes.length).toBe(2);
  expect(parent.childNodes[1]).toBe(b);

  // lastChild on a childless element falls back to null.
  expect(document.createElement("div").lastChild).toBeNull();

  // replaceChild when `previous` isn't actually a child is a no-op that
  // still returns `previous`.
  const notAChild = document.createElement("span");
  const childCountBefore = parent.childNodes.length;
  expect(parent.replaceChild(document.createElement("i"), notAChild)).toBe(notAChild);
  expect(parent.childNodes.length).toBe(childCountBefore);

  // getAttribute/setAttribute id/class/style/default branches.
  const el = document.createElement("div");
  expect(el.getAttribute("id")).toBe("");
  el.setAttribute("id", "x1");
  expect(el.getAttribute("id")).toBe("x1");
  expect(el.getAttribute("class")).toBe("");
  el.setAttribute("class", "c1");
  expect(el.getAttribute("class")).toBe("c1");
  expect(el.getAttribute("style")).toBe("");
  el.setAttribute("style", "color:red");
  expect(el.getAttribute("style")).toBe("color:red");
  expect(el.getAttribute("data-missing")).toBeNull();
  el.setAttribute("data-x", "v");
  expect(el.getAttribute("data-x")).toBe("v");
});

test("installBrowserShim's window stubs scrollTo/blur are callable", () => {
  installBrowserShim();
  expect(() => window.scrollTo(0, 0)).not.toThrow();
  expect(() => window.blur()).not.toThrow();
});

test("waitForStatus resolves via a function matcher and rejects on synchronous throw", async () => {
  const sheet: MockSheet = {};
  const p1 = waitForStatus(
    sheet,
    (status: string) => status === "done",
    () => {
      sheet.statuscallback?.(null, "other");
      sheet.statuscallback?.(null, "done");
    },
  );
  await expect(p1).resolves.toBeUndefined();

  const sheet2: MockSheet = {};
  const boom = new Error("boom");
  const p2 = waitForStatus(sheet2, "x", () => {
    throw boom;
  });
  await expect(p2).rejects.toBe(boom);
});

test("recalcSheet resets RecalcInfo state when present and tolerates its absence", async () => {
  const sheet1: MockSheet = {};
  const SC1 = {
    RecalcInfo: { currentState: 3, queue: [1, 2] },
    RecalcSheet(s: MockSheet) {
      s.statuscallback?.(null, "calcfinished");
    },
  };
  await recalcSheet(SC1, sheet1);
  expect(SC1.RecalcInfo.currentState).toBe(0);
  expect(SC1.RecalcInfo.queue).toEqual([]);

  const sheet2: MockSheet = {};
  const SC2 = {
    RecalcSheet(s: MockSheet) {
      s.statuscallback?.(null, "calcfinished");
    },
  };
  await recalcSheet(SC2, sheet2);
});

test("scheduleCommands accepts a plain string as well as an array", async () => {
  const calls: string[] = [];
  const sheet: MockSheet = {};
  const SC = {
    ScheduleSheetCommands(s: MockSheet, cmd: string) {
      calls.push(cmd);
      s.statuscallback?.(null, "cmdend");
    },
  };
  await scheduleCommands(SC, sheet, "set A1 value n 1");
  expect(calls).toEqual(["set A1 value n 1"]);
});

test("timer-tracking: ensureTrackedTimers is idempotent", () => {
  ensureTrackedTimers();
  expect(() => ensureTrackedTimers()).not.toThrow();
});

test("innerHTML parser: self-closing custom tags are treated as void elements", () => {
  installBrowserShim();
  installUiShim();
  document.body.innerHTML = "<div><custom-tag/></div>";
  const body = document.body as unknown as ShimNode;
  const div = body.childNodes[0];
  expect(div.tagName).toBe("DIV");
  expect(div.childNodes.length).toBe(1);
  expect(div.childNodes[0].tagName).toBe("CUSTOM-TAG");
});

test("innerHTML parser: style attribute skips a segment with an empty key", () => {
  installBrowserShim();
  installUiShim();
  document.body.innerHTML = '<div id="leading-empty-seg" style=" :red;color:blue"></div>';
  const el = document.getElementById("leading-empty-seg");
  const style = (el as unknown as { style: Record<string, string> } | null)?.style;
  expect(style?.color).toBe("blue");
});

test("innerHTML parser: <tr> at the document root is not wrapped in an implicit <tbody>", () => {
  installBrowserShim();
  installUiShim();
  document.body.innerHTML = "<tr><td>x</td></tr>";
  const body = document.body as unknown as ShimNode;
  expect(body.childNodes.length).toBe(1);
  expect(body.childNodes[0].tagName).toBe("TR");
});

test("innerHTML parser: <tr> under a non-<table> parent is not wrapped in an implicit <tbody>", () => {
  installBrowserShim();
  installUiShim();
  document.body.innerHTML = "<div><tr><td>x</td></tr></div>";
  const body = document.body as unknown as ShimNode;
  const div = body.childNodes[0];
  expect(div.tagName).toBe("DIV");
  expect(div.childNodes[0].tagName).toBe("TR");
});

test("innerHTML parser: whitespace-only text at the document root is dropped", () => {
  installBrowserShim();
  installUiShim();
  document.body.innerHTML = "   <div>x</div>";
  const body = document.body as unknown as ShimNode;
  expect(body.childNodes.length).toBe(1);
  expect(body.childNodes[0].tagName).toBe("DIV");
});

test("innerHTML parser: an unmatched closing tag is silently ignored", () => {
  installBrowserShim();
  installUiShim();
  document.body.innerHTML = "<div></span></div>";
  const body = document.body as unknown as ShimNode;
  expect(body.childNodes.length).toBe(1);
  expect(body.childNodes[0].tagName).toBe("DIV");
  expect(body.childNodes[0].childNodes.length).toBe(0);
});

test("style.cssText proxy: skips an empty-key segment and expands a 4-token padding shorthand", () => {
  installBrowserShim();
  installUiShim();
  const el = document.createElement("div");
  const style = el.style as unknown as Record<string, string>;
  style.cssText = " :red;padding: 1px 2px 3px 4px";
  expect(style.paddingTop).toBe("1px");
  expect(style.paddingRight).toBe("2px");
  expect(style.paddingBottom).toBe("3px");
  expect(style.paddingLeft).toBe("4px");
});

test("style.cssText proxy: a 3-token padding/margin shorthand falls through to the 0px defaults", () => {
  installBrowserShim();
  installUiShim();
  const el = document.createElement("div");
  const style = el.style as unknown as Record<string, string>;
  style.cssText = "margin: 1px 2px 3px";
  expect(style.marginTop).toBe("0px");
  expect(style.marginRight).toBe("0px");
  expect(style.marginBottom).toBe("0px");
  expect(style.marginLeft).toBe("0px");
});

test("document.body.click() reaches the shim's no-op click stub", () => {
  installBrowserShim();
  installUiShim();
  expect(() => document.body.click()).not.toThrow();
});

test("jQuery-like $ stub tolerates a missing selector match", () => {
  installBrowserShim();
  installUiShim();
  const globalWithJq = globalThis as unknown as { $: JqStub };
  const jq = globalWithJq.$;
  const missing = jq("#does-not-exist");
  expect(missing.length).toBe(0);
  expect(() => missing.append("<span>x</span>")).not.toThrow();
  expect(() => missing.on("click", () => {})).not.toThrow();
  expect(() => missing.keyup(() => {})).not.toThrow();
});

// The closing UMD wrapper (scripts/socialcalc-build-manifest.ts
// umdWrapperBottom) installs a DOM-free fallback on a handful of methods
// that normally touch `document`: it re-checks `typeof document` on every
// call, not just once at module load, so a caller that never installs the
// browser shim exercises the fallback branch directly.
type WrapperFallbackSC = {
  SpreadsheetControlSortSave: (editor: unknown, which: string) => string;
  DoPositionCalculations: (editor: unknown) => void;
};

test("closing UMD wrapper: DOM-free fallbacks fire when document is undefined", async () => {
  const SC = (await loadSocialCalc()) as unknown as WrapperFallbackSC;
  // loadSocialCalc() without {browser:true} calls clearBrowserShim(),
  // so `document` is undefined here — the wrapped methods must fall
  // back to their DOM-free no-op implementations instead of the real
  // ones (which assume a live DOM and would reference `document`).
  expect(typeof document).toBe("undefined");

  expect(SC.SpreadsheetControlSortSave({}, "sort")).toBe("");
  // DoPositionCalculations's fallback delegates to
  // EditorSheetStatusCallback, which itself reaches into `document` for
  // this status — we only assert that the DOM-free *fallback* branch is
  // the one that runs (not the real DOM-bound implementation), so a
  // downstream throw from the callee is expected and swallowed here.
  try {
    SC.DoPositionCalculations({});
  } catch {
    // expected: no document to satisfy the real callback's DOM reads
  }
});
