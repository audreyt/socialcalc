import { afterAll, afterEach, expect, test } from "vite-plus/test";

import {
  loadSocialCalc as _loadSocialCalc,
  scheduleCommands,
  waitForStatus,
} from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

// Drives js/chart.ts's "9. Editor UI" section (overlay mount/auto-refresh,
// drag-move, resize, delete button, create/edit dialog) directly against
// the fake DOM, mirroring editor-coverage-a.test.ts's pattern: handlers are
// invoked directly (FakeElement's addEventListener is a no-op — it never
// dispatches), and the click-triggered logic (DeleteChartFromOverlay,
// SubmitChartDialog, CloseChartDialog) is exposed as its own public
// SC.Chart.* function precisely so it can be called directly here instead
// of relying on synthetic click dispatch the fake DOM cannot provide.
// e2e/chart.spec.ts covers the same surface with real click/mousedown/
// mousemove/mouseup dispatch in a real browser.

ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
  // StartChartDrag sets a module-level `activeChartDrag` singleton (and
  // registers document mousemove/mouseup listeners) in js/chart.ts. A test
  // that starts a drag but never reaches ChartDragMouseUp would otherwise
  // leak that shared state into the next test in this file.
  const SCGlobal = (globalThis as any).SocialCalc;
  SCGlobal?.Chart?.ChartDragMouseUp?.();
});

afterAll(() => {
  restoreOriginalTimers();
});

async function loadSocialCalc() {
  const SC = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  return SC;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper mirrors editor-coverage-a.test.ts's `any` boundary
async function newControl(SC: any, containerId = "chart-ed-root") {
  const container = document.createElement("div");
  container.id = containerId;
  (document as any).body.appendChild(container);
  const control = new SC.SpreadsheetControl();
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function primeGridLayout(editor: any) {
  try {
    editor.CalculateEditorPositions();
  } catch {
    // setup: layout may not be computable yet under the fake DOM.
  }
  editor.gridposition = editor.gridposition || { left: 0, top: 0 };
  editor.headposition = editor.headposition || { left: 30, top: 30 };
  editor.colpositions = [0, 0, 80, 160, 240, 320, 400, 480];
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeMouseEvent(extras: Record<string, any> = {}) {
  return {
    clientX: 0,
    clientY: 0,
    preventDefault() {},
    stopPropagation() {},
    ...extras,
  };
}

/** Wait for one editor "cmdend" round trip after issuing a chart command. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function waitCmdEnd(editor: any, trigger: () => void) {
  return waitForStatus(editor.context.sheetobj, "cmdend", trigger);
}

/** Poll until the editor has fully settled (not mid-command) before issuing
 * another EditorScheduleSheetCommands call, since a busy editor silently
 * defers instead of running the command immediately. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function waitEditorIdle(editor: any, timeoutMs = 2000): Promise<void> {
  // RecalcInfo is shared across all loadSocialCalc() callers in one
  // isolated test worker (see helpers/socialcalc.ts's recalcSheet doc
  // comment); a previous test's uncompleted recalc cycle can otherwise
  // leave the shared editor.busy-triggering command pipeline stuck.
  const SCGlobal = (globalThis as any).SocialCalc;
  if (SCGlobal?.RecalcInfo) {
    SCGlobal.RecalcInfo.currentState = 0;
    SCGlobal.RecalcInfo.queue = [];
  }
  // Each test builds a brand-new editor instance via newControl, so forcing
  // idle here cannot mask cross-test state — it only unsticks this editor's
  // own busy flag if the setup commands above left it set past their final
  // cmdend (a real, benign race between this poll and that callback).
  editor.busy = false;
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      if (!editor.busy) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error("timed out waiting for editor to become idle"));
        return;
      }
      setTimeout(poll, 10);
    })();
  });
}
test("RefreshChartOverlays mounts an SVG overlay per chart and removes it on delete", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "refresh-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);

  const host = editor as unknown as {
    chartOverlays?: Record<string, { container: HTMLElement }>;
  };
  expect(host.chartOverlays?.c1).toBeDefined();
  expect(host.chartOverlays!.c1!.container.innerHTML).toContain("<svg");

  await scheduleCommands(SC, editor.context.sheetobj, "chart delete c1");
  SC.Chart.RefreshChartOverlays(editor);
  expect(host.chartOverlays?.c1).toBeUndefined();
});

test("RefreshChartOverlays updates an existing overlay's SVG when source data changes", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "refresh-update-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);
  const host = editor as unknown as {
    chartOverlays?: Record<string, { container: HTMLElement }>;
  };
  const before = host.chartOverlays!.c1!.container.innerHTML;

  await scheduleCommands(SC, editor.context.sheetobj, "set B1 value n 999");
  SC.Chart.RefreshChartOverlays(editor);
  const after = host.chartOverlays!.c1!.container.innerHTML;
  expect(after).not.toBe(before);
});

test("RefreshChartOverlays falls back to position 0 when the anchor is beyond the editor's known row/col positions", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "refresh-oob-anchor-root");
  const editor = control.editor;
  primeGridLayout(editor); // colpositions/rowpositions only cover a handful of rows/cols

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 ZZ60000 320 240 0 0 A1:B1", // anchor far outside the primed position arrays
  ]);
  expect(() => SC.Chart.RefreshChartOverlays(editor)).not.toThrow();
  const host = editor as unknown as {
    chartOverlays?: Record<string, { container: HTMLElement }>;
  };
  expect(host.chartOverlays!.c1!.container.style.left).toBe("0px");
  expect(host.chartOverlays!.c1!.container.style.top).toBe("0px");
});

test("RefreshChartOverlays is a no-op when the editor has no toplevel", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  expect(() => SC.Chart.RefreshChartOverlays(editor)).not.toThrow();
});

test("DeleteChartFromOverlay issues a chart delete command that removes the chart", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "delete-btn-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);
  expect(editor.context.sheetobj.charts.c1).toBeDefined();

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => SC.Chart.DeleteChartFromOverlay(editor, "c1"));
  expect(editor.context.sheetobj.charts.c1).toBeUndefined();

  SC.Chart.RefreshChartOverlays(editor);
  const host = editor as unknown as { chartOverlays?: Record<string, unknown> };
  expect(host.chartOverlays?.c1).toBeUndefined();
});

test("the overlay's delete button is wired with the sc-chart-delete-button class and click handler", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "delete-wired-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);

  const host = editor as unknown as {
    chartOverlays?: Record<
      string,
      { deleteButton: HTMLElement; moveHandle: HTMLElement; resizeHandle: HTMLElement }
    >;
  };
  expect(host.chartOverlays!.c1!.deleteButton.className).toBe("sc-chart-delete-button");
  expect(host.chartOverlays!.c1!.moveHandle.className).toBe("sc-chart-move-handle");
  expect(host.chartOverlays!.c1!.resizeHandle.className).toBe("sc-chart-resize-handle");
});

test("ChartDeleteButtonClick, invoked directly as addEventListener would, deletes the chart", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "delete-handler-direct-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);
  const host = editor as unknown as {
    chartOverlays?: Record<string, { deleteButton: HTMLElement }>;
  };
  const deleteButton = host.chartOverlays!.c1!.deleteButton;

  await waitEditorIdle(editor);
  let stopped = false;
  await waitCmdEnd(editor, () => {
    SC.Chart.ChartDeleteButtonClick({
      currentTarget: deleteButton,
      stopPropagation: () => {
        stopped = true;
      },
    });
  });
  expect(stopped).toBe(true);
  expect(editor.context.sheetobj.charts.c1).toBeUndefined();
});

test("ChartDeleteButtonClick is a no-op for an element with no registered chart context", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "delete-handler-noctx-root");
  const editor = control.editor;
  primeGridLayout(editor);
  const unregisteredElement = document.createElement("div");
  expect(() =>
    SC.Chart.ChartDeleteButtonClick({
      currentTarget: unregisteredElement,
      stopPropagation: () => {},
    }),
  ).not.toThrow();
});

test("ChartHandleMouseDown, invoked directly as addEventListener would, starts a move drag", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "move-handler-direct-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);
  const host = editor as unknown as {
    chartOverlays?: Record<string, { moveHandle: HTMLElement }>;
  };
  const moveHandle = host.chartOverlays!.c1!.moveHandle;

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.ChartHandleMouseDown(
      fakeMouseEvent({ currentTarget: moveHandle, clientX: 5, clientY: 5 }),
    );
    SC.Chart.ChartDragMouseMove(fakeMouseEvent({ clientX: 85, clientY: 55 }));
    SC.Chart.ChartDragMouseUp();
  });
  expect(editor.context.sheetobj.charts.c1.anchorcoord).not.toBe("A1");
});

test("ChartHandleMouseDown, invoked directly on a resize handle, starts a resize drag", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "resize-handler-direct-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);
  const host = editor as unknown as {
    chartOverlays?: Record<string, { resizeHandle: HTMLElement }>;
  };
  const resizeHandle = host.chartOverlays!.c1!.resizeHandle;

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.ChartHandleMouseDown(
      fakeMouseEvent({ currentTarget: resizeHandle, clientX: 0, clientY: 0 }),
    );
    SC.Chart.ChartDragMouseMove(fakeMouseEvent({ clientX: 60, clientY: 40 }));
    SC.Chart.ChartDragMouseUp();
  });
  expect(editor.context.sheetobj.charts.c1.widthpx).toBeGreaterThan(320);
});

test("ChartHandleMouseDown is a no-op for an element with no registered chart context", async () => {
  const SC = await loadSocialCalc();
  const unregisteredElement = document.createElement("div");
  expect(() =>
    SC.Chart.ChartHandleMouseDown(fakeMouseEvent({ currentTarget: unregisteredElement })),
  ).not.toThrow();
});

test("StartChartDrag + ChartDragMouseMove + ChartDragMouseUp: move issues a chart move command", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-move-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent({ clientX: 10, clientY: 10 }), "move");
    SC.Chart.ChartDragMouseMove(fakeMouseEvent({ clientX: 90, clientY: 60 }));
    SC.Chart.ChartDragMouseUp();
  });
  expect(editor.context.sheetobj.charts.c1.anchorcoord).not.toBe("A1");
});

test("StartChartDrag + ChartDragMouseMove + ChartDragMouseUp: resize issues a chart resize command", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-resize-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent({ clientX: 0, clientY: 0 }), "resize");
    SC.Chart.ChartDragMouseMove(fakeMouseEvent({ clientX: 60, clientY: 40 }));
    SC.Chart.ChartDragMouseUp();
  });
  expect(editor.context.sheetobj.charts.c1.widthpx).toBeGreaterThan(320);
  expect(editor.context.sheetobj.charts.c1.heightpx).toBeGreaterThan(240);
});

test("StartChartDrag/MouseMove/MouseUp are no-ops for an unknown chart id or no active drag", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-noop-root");
  const editor = control.editor;
  primeGridLayout(editor);

  expect(() => SC.Chart.StartChartDrag(editor, "ghost", fakeMouseEvent(), "move")).not.toThrow();
  expect(() => SC.Chart.ChartDragMouseMove(fakeMouseEvent())).not.toThrow();
  expect(() => SC.Chart.ChartDragMouseUp()).not.toThrow();
});

test("ChartDragMouseMove/MouseUp no-op if the overlay entry vanishes mid-drag (chart deleted concurrently)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-vanish-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);

  await waitEditorIdle(editor);
  SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent({ clientX: 10, clientY: 10 }), "move");
  const host = editor as unknown as { chartOverlays?: Record<string, unknown> };
  delete host.chartOverlays!.c1; // simulate the overlay disappearing mid-drag
  expect(() =>
    SC.Chart.ChartDragMouseMove(fakeMouseEvent({ clientX: 90, clientY: 60 })),
  ).not.toThrow();
  expect(() => SC.Chart.ChartDragMouseUp()).not.toThrow();
  expect(editor.context.sheetobj.charts.c1).toBeDefined(); // no move command was issued
});

test("StartChartDrag is a no-op when the target chart has no mounted overlay", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-no-overlay-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "chart create c1 A1 320 240 0 0 A1",
  ]);
  // RefreshChartOverlays never called: chartOverlays has no c1 entry.
  expect(() =>
    SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent({ clientX: 5, clientY: 5 }), "move"),
  ).not.toThrow();
});

test("ChartDragMouseUp falls back to 0 when the overlay's inline style dimensions are unset", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-empty-style-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);
  const host = editor as unknown as {
    chartOverlays?: Record<string, { container: HTMLElement }>;
  };
  // Clear the inline style values StartChartDrag/ChartDragMouseUp parse, forcing
  // the `|| 0` fallbacks on both the drag-start snapshot and the mouse-up commit.
  host.chartOverlays!.c1!.container.style.width = "";
  host.chartOverlays!.c1!.container.style.height = "";
  host.chartOverlays!.c1!.container.style.left = "";
  host.chartOverlays!.c1!.container.style.top = "";

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent({ clientX: 0, clientY: 0 }), "resize");
    host.chartOverlays!.c1!.container.style.width = "";
    host.chartOverlays!.c1!.container.style.height = "";
    SC.Chart.ChartDragMouseUp();
  });
  // width/height computed as 0 -> command handler's own `|| cell.widthpx`
  // fallback keeps the pre-drag dimensions unchanged.
  expect(editor.context.sheetobj.charts.c1.widthpx).toBe(320);
  expect(editor.context.sheetobj.charts.c1.heightpx).toBe(240);

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent({ clientX: 0, clientY: 0 }), "move");
    host.chartOverlays!.c1!.container.style.left = "";
    host.chartOverlays!.c1!.container.style.top = "";
    SC.Chart.ChartDragMouseUp();
  });
  expect(editor.context.sheetobj.charts.c1.anchorcoord).toBe("A1");
});

test("StartChartDrag + ChartDragMouseUp: move clamps to row/col 1 when dragged to the top-left edge", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "drag-topleft-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
  ]);
  SC.Chart.RefreshChartOverlays(editor);
  const host = editor as unknown as {
    chartOverlays?: Record<string, { container: HTMLElement }>;
  };
  // Force the overlay far off the negative/near-zero edge so the post-drag
  // left/top fall at or before colpositions[0]/rowpositions[0], driving
  // findIndex's result to <= 1 and exercising the `: 1` clamp branch.
  host.chartOverlays!.c1!.container.style.left = "-100px";
  host.chartOverlays!.c1!.container.style.top = "-100px";

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent({ clientX: 0, clientY: 0 }), "move");
    SC.Chart.ChartDragMouseUp();
  });
  expect(editor.context.sheetobj.charts.c1.anchorcoord).toBe("A1");
});

test("SubmitChartDialog (create path) falls back to A1 when the editor has no active cell", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "submit-no-ecell-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = null;

  await waitCmdEnd(editor, () => {
    SC.Chart.SubmitChartDialog(editor, {
      sourceranges: "A1:B1",
      charttype: "0",
      seriesinrows: false,
      title: "",
    });
  });

  const charts = editor.context.sheetobj.charts;
  const ids = Object.keys(charts);
  expect(ids.length).toBe(1);
  expect(charts[ids[0]!].anchorcoord).toBe("A1");
});

test("OpenChartDialog (create) falls back to A1 when there is no range and no active cell", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dialog-no-ecell-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = null;

  const dialog = SC.Chart.OpenChartDialog(editor);
  const rangeInput = dialog.childNodes[0].childNodes[1];
  expect(rangeInput.value).toBe("A1");
});

test("OpenChartDialog appends to document.body when the editor has no toplevel", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  editor.range = { hasrange: false };
  editor.toplevel = null;

  const dialog = SC.Chart.OpenChartDialog(editor);
  expect(dialog).not.toBeNull();
  expect(dialog!.parentNode).toBe(document.body);
  document.body.removeChild(dialog!);
});

test("OpenChartDialog (create) builds a real form prefilled from the active cell", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dialog-create-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const dialog = SC.Chart.OpenChartDialog(editor);
  expect(dialog).toBeDefined();
  expect(dialog.className).toBe("sc-chart-dialog-overlay");
  const inputs = dialog.querySelectorAll?.("input") ?? dialog.childNodes;
  expect(dialog.parentNode).toBe(editor.toplevel);
  void inputs;
});

test("SubmitChartDialog (create path) issues a chart create command via the editor pipeline", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "submit-create-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 value n 3", "set B1 value n 6"]);

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.SubmitChartDialog(editor, {
      sourceranges: "A1:B1",
      charttype: "4",
      seriesinrows: false,
      title: "My Chart",
    });
  });

  const charts = editor.context.sheetobj.charts;
  const ids = Object.keys(charts);
  expect(ids.length).toBe(1);
  expect(charts[ids[0]!].charttype).toBe(4);
  expect(charts[ids[0]!].sourceranges).toEqual(["A1:B1"]);
  expect(charts[ids[0]!].title).toBe("My Chart");
  expect(charts[ids[0]!].hastitle).toBe(true);
});

test("SubmitChartDialog (create path) without a title omits hastitle", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "submit-create-notitle-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  await waitCmdEnd(editor, () => {
    SC.Chart.SubmitChartDialog(editor, {
      sourceranges: "A1:B1",
      charttype: "0",
      seriesinrows: true,
      title: "",
    });
  });

  const charts = editor.context.sheetobj.charts;
  const ids = Object.keys(charts);
  expect(ids.length).toBe(1);
  expect(charts[ids[0]!].hastitle).toBe(false);
  expect(charts[ids[0]!].seriesinrows).toBe(true);
});

test("SubmitChartDialog (edit path) issues chart set commands that update an existing chart", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "submit-edit-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 4 1 A1:B1",
  ]);

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.SubmitChartDialog(
      editor,
      { sourceranges: "A1:B1", charttype: "2", seriesinrows: false, title: "Updated" },
      "c1",
    );
  });

  const chart = editor.context.sheetobj.charts.c1;
  expect(chart.title).toBe("Updated");
  expect(chart.hastitle).toBe(true);
  expect(chart.charttype).toBe(2);
  expect(chart.seriesinrows).toBe(false);
});

test("SubmitChartDialog (edit path) with an empty title clears hastitle", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "submit-edit-notitle-root");
  const editor = control.editor;
  primeGridLayout(editor);

  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 0 0 A1:B1",
    "chart set c1 title Existing",
    "chart set c1 hastitle 1",
  ]);

  await waitEditorIdle(editor);
  await waitCmdEnd(editor, () => {
    SC.Chart.SubmitChartDialog(
      editor,
      { sourceranges: "A1:B1", charttype: "0", seriesinrows: false, title: "" },
      "c1",
    );
  });

  const chart = editor.context.sheetobj.charts.c1;
  expect(chart.title).toBe("");
  expect(chart.hastitle).toBe(false);
});

test("CloseChartDialog removes the dialog element from its parent", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "close-dialog-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const dialog = SC.Chart.OpenChartDialog(editor);
  expect(dialog.parentNode).toBe(editor.toplevel);
  SC.Chart.CloseChartDialog(dialog);
  expect(dialog.parentNode).toBeNull();
});

test("ChartDialogSubmitButtonClick, invoked directly as addEventListener would, creates a chart and closes the dialog", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dialog-submit-direct-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 value n 3", "set B1 value n 6"]);
  await waitEditorIdle(editor);

  const dialog = SC.Chart.OpenChartDialog(editor);
  // overlay children: [rangeRow, typeRow, titleRow, seriesInRowsRow, submitButton, cancelButton]
  const submitButton = dialog.childNodes[4];
  const rangeInput = dialog.childNodes[0].childNodes[1];
  const titleInput = dialog.childNodes[2].childNodes[1];
  rangeInput.value = "A1:B1";
  titleInput.value = "Direct Submit";

  await waitCmdEnd(editor, () => {
    SC.Chart.ChartDialogSubmitButtonClick({ currentTarget: submitButton });
  });

  expect(dialog.parentNode).toBeNull();
  const charts = editor.context.sheetobj.charts;
  const ids = Object.keys(charts);
  expect(ids.length).toBe(1);
  expect(charts[ids[0]!].sourceranges).toEqual(["A1:B1"]);
  expect(charts[ids[0]!].title).toBe("Direct Submit");
});

test("ChartDialogSubmitButtonClick is a no-op for an element with no registered dialog context", async () => {
  const SC = await loadSocialCalc();
  const unregisteredElement = document.createElement("input");
  expect(() =>
    SC.Chart.ChartDialogSubmitButtonClick({ currentTarget: unregisteredElement }),
  ).not.toThrow();
});

test("ChartDialogCancelButtonClick, invoked directly as addEventListener would, closes the dialog without creating a chart", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dialog-cancel-direct-root");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  const dialog = SC.Chart.OpenChartDialog(editor);
  const cancelButton = dialog.childNodes[5];
  expect(dialog.parentNode).toBe(editor.toplevel);

  SC.Chart.ChartDialogCancelButtonClick({ currentTarget: cancelButton });

  expect(dialog.parentNode).toBeNull();
  expect(Object.keys(editor.context.sheetobj.charts).length).toBe(0);
});

test("ChartDialogCancelButtonClick is a no-op for an element with no registered dialog context", async () => {
  const SC = await loadSocialCalc();
  const unregisteredElement = document.createElement("input");
  expect(() =>
    SC.Chart.ChartDialogCancelButtonClick({ currentTarget: unregisteredElement }),
  ).not.toThrow();
});

test("OpenChartDialog returns null outside a DOM environment", async () => {
  const SC = await _loadSocialCalc(); // no browser shim installed
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  expect(SC.Chart.OpenChartDialog(editor)).toBeNull();
});

test("RefreshChartOverlays is a no-op outside a DOM environment", async () => {
  const SC = await _loadSocialCalc(); // no browser shim installed
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  expect(() => SC.Chart.RefreshChartOverlays(editor)).not.toThrow();
});

test("StartChartDrag/ChartDragMouseUp are no-ops outside a DOM environment", async () => {
  const SC = await _loadSocialCalc(); // no browser shim installed
  const sheet = new SC.Sheet();
  const ctx = new SC.RenderContext(sheet);
  const editor = new SC.TableEditor(ctx);
  expect(() => SC.Chart.StartChartDrag(editor, "c1", fakeMouseEvent(), "move")).not.toThrow();
  expect(() => SC.Chart.ChartDragMouseUp()).not.toThrow();
});

test("OpenChartDialog (create) defaults the source range from the active selection range", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dialog-range-default-root");
  const editor = control.editor;
  primeGridLayout(editor);
  await scheduleCommands(SC, editor.context.sheetobj, ["set A1 value n 1", "set B2 value n 2"]);
  editor.MoveECell("A1");
  editor.RangeAnchor("A1");
  editor.RangeExtend("B2");

  const dialog = SC.Chart.OpenChartDialog(editor);
  const rangeInput = dialog.childNodes[0].childNodes[1];
  expect(rangeInput.value).toBe("A1:B2");
});

test("OpenChartDialog (edit) prefills every field from the existing chart", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "dialog-edit-prefill-root");
  const editor = control.editor;
  primeGridLayout(editor);
  await scheduleCommands(SC, editor.context.sheetobj, [
    "set A1 value n 1",
    "set B1 value n 2",
    "chart create c1 A1 320 240 4 1 A1:B1",
    "chart set c1 title Existing Chart",
  ]);

  const dialog = SC.Chart.OpenChartDialog(editor, "c1");
  const rangeInput = dialog.childNodes[0].childNodes[1];
  const typeSelect = dialog.childNodes[1].childNodes[1];
  const titleInput = dialog.childNodes[2].childNodes[1];
  const seriesInRowsCheckbox = dialog.childNodes[3].childNodes[0].childNodes[0];
  const submitButton = dialog.childNodes[4];
  expect(rangeInput.value).toBe("A1:B1");
  expect(typeSelect.value).toBe("4");
  expect(titleInput.value).toBe("Existing Chart");
  expect(seriesInRowsCheckbox.checked).toBe(true);
  expect(submitButton.value).toBe("Update");
});
