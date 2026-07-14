// Coverage gaps for js/socialcalctableeditor.ts — controls/drag/button false-branch arms.
// Targets:
//   5046 b664 a1 — CellHandlesMouseMove Fill else-if X-delta false arm (both deltas ≤ 10)
//   5792 b744 a1 — TCPSDragFunctionStart: scc.TCPStrackinglineClass falsy → className NOT set
//   5950 b765 a1 — TCTDragFunctionStart: thumbstatus.rowmsgele falsy arm
//   5951 b766 a1 — TCTDragFunctionStart: thumbstatus.rowpreviewele falsy arm
//   6527 b839 a1 — ButtonMouseUp: buttonElement.downstyle falsy → setStyles NOT called

import { afterAll, afterEach, expect, test } from "vite-plus/test";

import { loadSocialCalc as _loadSocialCalc } from "./helpers/socialcalc";
import { installUiShim } from "./helpers/ui";
import {
  cancelActiveTrackedTimers,
  ensureTrackedTimers,
  installWindowTimerTracking,
  restoreOriginalTimers,
} from "./helpers/timer-tracking";

ensureTrackedTimers();

afterEach(() => {
  cancelActiveTrackedTimers();
});

afterAll(() => {
  restoreOriginalTimers();
});

type SC = typeof SocialCalc;
type Editor = SocialCalc.TableEditor;
type Control = SocialCalc.SpreadsheetControl;

async function loadSocialCalc(): Promise<SC> {
  const mod = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  const scMod = mod as unknown as SC;
  return scMod;
}

async function newControl(SC: SC, containerId = "efp-root") {
  const container = document.createElement("div");
  container.id = containerId;
  window.document.body.appendChild(container);
  const control = new SC.SpreadsheetControl() as unknown as Control;
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

/** Shim document.addEventListener/removeEventListener when the test-env's
 * document lacks them — SetMouseMoveUp/RemoveMouseMoveUp use them for the
 * capture phase and will throw without this stub. */
function ensureDocumentEvents() {
  const doc = window.document as unknown as Record<string, unknown>;
  if (typeof doc.addEventListener !== "function") {
    doc.addEventListener = () => {};
    doc.removeEventListener = () => {};
  }
}

function teardownEditor(SC: SC, editor: Editor) {
  {
    if (editor?.inputEcho?.interval) {
      clearInterval(editor.inputEcho.interval);
      editor.inputEcho.interval = null;
    }
  }
  {
    if (SC.AutoRepeatInfo?.timer) {
      clearTimeout(SC.AutoRepeatInfo.timer);
      SC.AutoRepeatInfo.timer = null;
      SC.AutoRepeatInfo.mouseinfo = null;
    }
  }
  {
    if (SC.ButtonInfo?.timer) {
      clearTimeout(SC.ButtonInfo.timer);
      SC.ButtonInfo.timer = null;
    }
  }
  {
    if (SC.Keyboard) {
      SC.Keyboard.focusTable = null;
      SC.Keyboard.passThru = null;
    }
  }
  {
    if (editor) {
      editor.state = "start";
      if (editor.timeout) {
        clearTimeout(editor.timeout);
        editor.timeout = null;
      }
    }
  }
}

type FakeEvent = {
  type: string;
  clientX: number;
  clientY: number;
  target: unknown;
  srcElement: unknown;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  wheelDelta: number;
  detail: number;
  which: number;
  keyCode: number;
  charCode: number;
  preventDefault: () => void;
  stopPropagation: () => void;
  [key: string]: unknown;
};

function fakeEvent(extras: Partial<FakeEvent> = {}): FakeEvent {
  const target = extras.target ?? null;
  const ev: FakeEvent = {
    type: "mousedown",
    clientX: 10,
    clientY: 10,
    target,
    srcElement: target,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    wheelDelta: 0,
    detail: 0,
    which: 0,
    keyCode: 0,
    charCode: 0,
    preventDefault() {},
    stopPropagation() {},
    ...extras,
  };
  return ev;
}

function primeGridLayout(editor: Editor) {
  {
    editor.CalculateEditorPositions();
  }
  editor.gridposition = editor.gridposition || { left: 0, top: 0 };
  editor.headposition = editor.headposition || { left: 30, top: 30 };
  editor.tablewidth = editor.tablewidth ?? 400;
  editor.tableheight = editor.tableheight ?? 400;
  editor.colpositions = [0, 0, 80, 160, 240, 320, 400, 480];
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.firstscrollingrow = editor.firstscrollingrow ?? 1;
  editor.firstscrollingcol = editor.firstscrollingcol ?? 1;
  editor.lastnonscrollingrow = editor.lastnonscrollingrow ?? 0;
  editor.lastnonscrollingcol = editor.lastnonscrollingcol ?? 0;
  editor.lastvisiblerow = editor.lastvisiblerow ?? 7;
  editor.lastvisiblecol = editor.lastvisiblecol ?? 7;
  editor.firstscrollingrowtop = editor.firstscrollingrowtop ?? 30;
  editor.firstscrollingcolleft = editor.firstscrollingcolleft ?? 30;
  editor.verticaltablecontrol =
    editor.verticaltablecontrol || ({ controlborder: 500 } as SocialCalc.TableControl);
  editor.horizontaltablecontrol =
    editor.horizontaltablecontrol || ({ controlborder: 500 } as SocialCalc.TableControl);
  const vtc = editor.verticaltablecontrol as SocialCalc.TableControl;
  vtc.controlborder = 500;
  const htc = editor.horizontaltablecontrol as SocialCalc.TableControl;
  htc.controlborder = 500;
  editor.griddiv = editor.griddiv || document.createElement("div");
  if (vtc.thumb) {
    vtc.thumb.style.top = "100px";
    vtc.thumb.style.left = "100px";
  }
  if (vtc.paneslider) {
    vtc.paneslider.style.top = "100px";
    vtc.paneslider.style.left = "100px";
  }
  if (htc.thumb) {
    htc.thumb.style.top = "100px";
    htc.thumb.style.left = "100px";
  }
  if (htc.paneslider) {
    htc.paneslider.style.top = "100px";
    htc.paneslider.style.left = "100px";
  }
}

// ============================================================================
// Test 1 (5046 b664 a1): CellHandlesMouseMove — Fill else-branch, X delta ≤ 10
//
// Line 5044-5048 else-block:
//   if (Math.abs(clientY - startingY) > 10) filltype = "Down"   ← not taken: deltaY=0
//   else if (Math.abs(clientX - startingX) > 10) filltype = "Right"  ← FALSE arm (deltaX=5)
// The false arm of the else-if means filltype stays null and crend is pinned to crstart.
// ============================================================================
test("CellHandlesMouseMove: Fill else-branch X-delta ≤ 10 → filltype stays null (5046 b664 a1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "efp-fill-xdelta");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const mouseInfoRec = SC.EditorMouseInfo as unknown as Record<string, unknown>;
  mouseInfoRec.editor = editor;

  // Prime editor.cellhandles with required state.
  const cellHandlesRec = editor.cellhandles as unknown as Record<string, unknown>;
  cellHandlesRec.startingcoord = "A1";
  cellHandlesRec.startingX = 10; // clientX = 13 → deltaX = 3 ≤ 10, so false arm
  cellHandlesRec.startingY = 10; // clientY = 10 → deltaY = 0 ≤ 10
  cellHandlesRec.dragtype = "Fill";
  cellHandlesRec.filltype = null; // ensures we enter the else block (not the filltype truthy branch)

  // result.coord differs from startingcoord so we enter the case body (not the coord==starting branch).
  // We use a coord that differs from "A1" so the outer if at 5029 is false, reaching the else block.
  const origGMP = SC.GridMousePosition;
  SC.GridMousePosition = () =>
    ({ coord: "B2", col: 2, row: 2 }) as SocialCalc.GridMousePositionResult;

  SC.CellHandlesMouseMove(fakeEvent({ clientX: 13, clientY: 10 }) as unknown as MouseEvent);

  // filltype should remain null: deltaY=0 ≤ 10, deltaX=3 ≤ 10 → neither branch sets it.
  expect(cellHandlesRec.filltype).toBeNull();

  SC.GridMousePosition = origGMP;
  teardownEditor(SC, editor);
});

// ============================================================================
// Test 2 (5792 b744 a1): TCPSDragFunctionStart — TCPStrackinglineClass falsy
//
// Line 5792: if (scc.TCPStrackinglineClass) draginfo.trackingline.className = scc.TCPStrackinglineClass;
// When TCPStrackinglineClass is "" (or empty), the className is NOT assigned.
// The test temporarily blanks the constant and restores it in finally.
// ============================================================================
test("TCPSDragFunctionStart: TCPStrackinglineClass falsy → className unchanged (5792 b744 a1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "efp-tcps-class");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const scc = SC.Constants;
  const origClass = scc.TCPStrackinglineClass;

  try {
    // Blank the constant to exercise the false branch.
    scc.TCPStrackinglineClass = "";

    const trackingLine = document.createElement("div");
    trackingLine.className = "initial-class"; // ensure it's truthy to detect if overwritten

    const draginfo = {
      clientY: 50,
      clientX: 50,
      trackingline: trackingLine,
    };

    const dobj = {
      vertical: false, // use horizontal path to avoid rowpositions Lookup complications
      element: document.createElement("div"),
      downstyle: "",
      functionobj: {
        control: {
          editor,
          sliderthickness: 5,
        },
      },
    };

    SC.TCPSDragFunctionStart(
      fakeEvent() as unknown as Event,
      draginfo as unknown as typeof SocialCalc.DragInfo,
      dobj as unknown as SocialCalc.DragRegisteredElement,
    );

    // The falsy-class branch skips className assignment → still "initial-class".
    expect(trackingLine.className).toBe("initial-class");
  } finally {
    scc.TCPStrackinglineClass = origClass;
  }

  teardownEditor(SC, editor);
});

// ============================================================================
// Test 3 (5950 b765 a1 + 5951 b766 a1):
//   TCTDragFunctionStart — pre-existing thumbstatus with both rowmsgele AND
//   rowpreviewele already null/falsy → their cleanup if-branches are skipped.
//
// Lines 5948-5953:
//   if (draginfo.thumbstatus) {
//     if (draginfo.thumbstatus.rowmsgele)    ← FALSE arm: rowmsgele is null   (5950)
//     if (draginfo.thumbstatus.rowpreviewele) ← FALSE arm: rowpreviewele is null (5951)
//     editor.toplevel.removeChild(draginfo.thumbstatus);
//     draginfo.thumbstatus = null;
//   }
//
// Prime draginfo.thumbstatus as a real div (no rowmsgele/rowpreviewele props)
// so the outer if is taken but the inner two ifs are not.
// ============================================================================
test("TCTDragFunctionStart: thumbstatus present but rowmsgele+rowpreviewele both null (5950+5951 false arms)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "efp-tct-noprops");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  // Build a thumbstatus div with rowmsgele and rowpreviewele explicitly null.
  const thumb = document.createElement("div");
  const thumbRec = thumb as unknown as Record<string, unknown>;
  thumbRec.rowmsgele = null; // falsy → 5950 false arm
  thumbRec.rowpreviewele = null; // falsy → 5951 false arm
  editor.toplevel.appendChild(thumb);

  const draginfoTCT = {
    clientY: 10,
    clientX: 10,
    thumbstatus: thumb,
  };

  const dobjTCT = {
    vertical: false, // use horizontal path to avoid TCTDragFunctionRowSetStatus → RenderSheet error
    element: document.createElement("div"),
    downstyle: "",
    functionobj: {
      control: {
        editor,
        controlborder: 10,
      },
    },
  };

  SC.TCTDragFunctionStart(
    fakeEvent() as unknown as Event,
    draginfoTCT as unknown as typeof SocialCalc.DragInfo,
    dobjTCT as unknown as SocialCalc.DragRegisteredElement,
  );

  // After the call, the cleanup block ran (outer if was true):
  // - The old thumb was removed from toplevel and a NEW thumbstatus was created.
  // - draginfoTCT.thumbstatus is the NEW div, not null (line 5956 reassigns it).
  expect(draginfoTCT.thumbstatus).not.toBe(thumb); // replaced with new div
  expect(draginfoTCT.thumbstatus).toBeTruthy(); // a new div was created

  // The false branches (5950/5951) didn't mutate the old thumb's null properties:
  // - rowmsgele remained null (the if-branch was skipped)
  // - rowpreviewele remained null (the if-branch was skipped)
  expect(thumbRec.rowmsgele).toBeNull();
  expect(thumbRec.rowpreviewele).toBeNull();

  // The old thumb was detached from toplevel (removeChild at line 5952 ran).
  expect(thumb.parentNode).toBeNull();

  teardownEditor(SC, editor);
});

// ============================================================================
// Test 4 (6527 b839 a1): ButtonMouseUp — buttonElement.downstyle falsy
//
// Line 6527: if (buttoninfo.buttonElement.downstyle) { … setStyles … }
// When the registered button has no downstyle, the setStyles call is skipped
// and buttonDown is set to false regardless.
//
// Pattern: register a button without downstyle, prime ButtonInfo.buttonElement
// and buttonDown=true, call ButtonMouseUp, confirm buttonDown→false and that
// the element style was NOT modified.
// ============================================================================
test("ButtonMouseUp: button without downstyle → setStyles skipped, buttonDown cleared (6527 b839 a1)", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "efp-btn-nodown");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();

  const btn = document.createElement("div");
  btn.style.color = "purple"; // sentinel: must not change after MouseUp
  editor.toplevel.appendChild(btn);

  // Register with no downstyle (omit it entirely from paramobj).
  SC.ButtonRegister(
    editor,
    btn,
    {
      name: "no-downstyle-btn",
      normalstyle: "color:orange",
      // downstyle intentionally absent
    },
    null,
  );

  const buttonInfoRec = SC.ButtonInfo as unknown as Record<string, unknown>;
  const registeredElements = buttonInfoRec.registeredElements as { element: unknown }[];
  const bobj = SC.LookupElement(btn, registeredElements);

  buttonInfoRec.buttonElement = bobj;
  buttonInfoRec.buttonDown = true;
  buttonInfoRec.doingHover = false;
  buttonInfoRec.timer = null;

  SC.ButtonMouseUp(fakeEvent({ target: btn }) as unknown as MouseEvent);

  // buttonDown is cleared regardless of downstyle.
  expect(buttonInfoRec.buttonDown).toBe(false);

  // The false arm of if(downstyle) was taken: setStyles was NOT called,
  // so the element color remains the sentinel value, not "orange".
  expect(btn.style.color).toBe("purple");

  teardownEditor(SC, editor);
});
