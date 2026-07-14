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
type MouseInfo = typeof SocialCalc.EditorMouseInfo;
type AutoRepeatInfo = typeof SocialCalc.AutoRepeatInfo;
type MouseInfoSnapshot = {
  registeredElements: SocialCalc.MouseInfoRegisteredElement[];
  editor: Editor | null;
  element: HTMLElement | null;
  ignore: boolean;
  mousedowncoord: string;
  mouselastcoord: string;
  mouseresizecol: string;
  mouseresizedisplay: HTMLElement | null;
  mousecoltounhide: unknown;
  mouseresizecolnum: unknown;
  mousedownclientx: unknown;
  mouserowtounhide: unknown;
  mouseresizerownum: unknown;
  mousedownclienty: unknown;
};
type AutoRepeatSnapshot = {
  timer: number | null;
  mouseinfo: Record<string, unknown> | null;
  repeatinterval: number;
  editor: Editor | null;
  repeatcallback: ((coord: string, direction: string) => void) | null;
};
type SyntheticMouseEvent = {
  type: string;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
  srcElement: EventTarget | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  which: number;
  keyCode: number;
  charCode: number;
  preventDefault: () => void;
  stopPropagation: () => void;
};
type MutableDocumentEvents = Document & {
  addEventListener?: typeof document.addEventListener;
  removeEventListener?: typeof document.removeEventListener;
};
type EditorMethodOverrides = {
  EditorScheduleSheetCommands: (cmd: string, saveundo?: boolean, ignorebusy?: boolean) => void;
  EditorSaveEdit: () => void;
  MoveECellWithKey: (ch: string) => string | null;
  MoveECell: (coord: string) => string;
  RangeAnchor: (coord?: string) => void;
  RangeExtend: (coord?: string) => void;
  RangeRemove: () => void;
  EditorMouseRange: (coord: string) => void;
};

async function loadSocialCalc(): Promise<SC> {
  const mod = await _loadSocialCalc({ browser: true });
  installUiShim();
  installWindowTimerTracking();
  return mod as unknown as SC;
}

async function newControl(SC: SC, containerId: string) {
  const container = document.createElement("div");
  container.id = containerId;
  window.document.body.appendChild(container);
  const control = new SC.SpreadsheetControl() as unknown as Control;
  control.InitializeSpreadsheetControl(container, 400, 600, 20);
  return { control, container };
}

function ensureDocumentEvents(): void {
  const docEvents = window.document as MutableDocumentEvents;
  if (typeof docEvents.addEventListener !== "function") {
    docEvents.addEventListener = (() => {}) as typeof document.addEventListener;
  }
  if (typeof docEvents.removeEventListener !== "function") {
    docEvents.removeEventListener = (() => {}) as typeof document.removeEventListener;
  }
}

function syntheticEvent(extras: Partial<SyntheticMouseEvent> = {}): SyntheticMouseEvent {
  const target = extras.target ?? null;
  return {
    type: "mousedown",
    clientX: 10,
    clientY: 10,
    target,
    srcElement: target,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    which: 0,
    keyCode: 0,
    charCode: 0,
    preventDefault() {},
    stopPropagation() {},
    ...extras,
  };
}

function primeGridLayout(editor: Editor): void {
  editor.CalculateEditorPositions();
  editor.gridposition = { left: 0, top: 0 };
  editor.headposition = { left: 30, top: 30 };
  editor.tablewidth = 400;
  editor.tableheight = 400;
  editor.colpositions = [0, 0, 80, 160, 240, 320, 400, 480];
  editor.rowpositions = [0, 0, 50, 70, 90, 110, 130, 150];
  editor.colwidth = [0, 30, 80, 80, 80, 80, 80, 80];
  editor.rowheight = [0, 30, 20, 20, 20, 20, 20, 20];
  editor.firstscrollingrow = 1;
  editor.firstscrollingcol = 1;
  editor.lastnonscrollingrow = 0;
  editor.lastnonscrollingcol = 0;
  editor.lastvisiblerow = 7;
  editor.lastvisiblecol = 7;
  editor.firstscrollingrowtop = 30;
  editor.firstscrollingcolleft = 30;
  editor.griddiv = editor.griddiv || document.createElement("div");
  if (editor.verticaltablecontrol) editor.verticaltablecontrol.controlborder = 500;
  if (editor.horizontaltablecontrol) editor.horizontaltablecontrol.controlborder = 500;
}

function mutableEditor(editor: Editor): Editor & Partial<EditorMethodOverrides> {
  return editor as Editor & Partial<EditorMethodOverrides>;
}

function requiredElement<T extends HTMLElement>(value: T | null, label: string): T {
  if (!value) throw new Error(`${label} was not initialized`);
  return value;
}

function saveMouseInfo(mouseInfo: MouseInfo): MouseInfoSnapshot {
  return {
    registeredElements: [...mouseInfo.registeredElements],
    editor: mouseInfo.editor,
    element: mouseInfo.element,
    ignore: mouseInfo.ignore,
    mousedowncoord: mouseInfo.mousedowncoord,
    mouselastcoord: mouseInfo.mouselastcoord,
    mouseresizecol: mouseInfo.mouseresizecol,
    mouseresizedisplay: mouseInfo.mouseresizedisplay,
    mousecoltounhide: mouseInfo.mousecoltounhide,
    mouseresizecolnum: mouseInfo.mouseresizecolnum,
    mousedownclientx: mouseInfo.mousedownclientx,
    mouserowtounhide: mouseInfo.mouserowtounhide,
    mouseresizerownum: mouseInfo.mouseresizerownum,
    mousedownclienty: mouseInfo.mousedownclienty,
  };
}

function restoreMouseInfo(mouseInfo: MouseInfo, snapshot: MouseInfoSnapshot): void {
  mouseInfo.registeredElements = snapshot.registeredElements;
  mouseInfo.editor = snapshot.editor;
  mouseInfo.element = snapshot.element;
  mouseInfo.ignore = snapshot.ignore;
  mouseInfo.mousedowncoord = snapshot.mousedowncoord;
  mouseInfo.mouselastcoord = snapshot.mouselastcoord;
  mouseInfo.mouseresizecol = snapshot.mouseresizecol;
  mouseInfo.mouseresizedisplay = snapshot.mouseresizedisplay;
  mouseInfo.mousecoltounhide = snapshot.mousecoltounhide;
  mouseInfo.mouseresizecolnum = snapshot.mouseresizecolnum;
  mouseInfo.mousedownclientx = snapshot.mousedownclientx;
  mouseInfo.mouserowtounhide = snapshot.mouserowtounhide;
  mouseInfo.mouseresizerownum = snapshot.mouseresizerownum;
  mouseInfo.mousedownclienty = snapshot.mousedownclienty;
}

function saveAutoRepeat(repeatInfo: AutoRepeatInfo): AutoRepeatSnapshot {
  return {
    timer: repeatInfo.timer,
    mouseinfo: repeatInfo.mouseinfo,
    repeatinterval: repeatInfo.repeatinterval,
    editor: repeatInfo.editor,
    repeatcallback: repeatInfo.repeatcallback,
  };
}

function restoreAutoRepeat(repeatInfo: AutoRepeatInfo, snapshot: AutoRepeatSnapshot): void {
  if (repeatInfo.timer) clearTimeout(repeatInfo.timer);
  repeatInfo.timer = snapshot.timer;
  repeatInfo.mouseinfo = snapshot.mouseinfo;
  repeatInfo.repeatinterval = snapshot.repeatinterval;
  repeatInfo.editor = snapshot.editor;
  repeatInfo.repeatcallback = snapshot.repeatcallback;
}

function teardownEditor(SC: SC, editor: Editor): void {
  if (editor.inputEcho?.interval) {
    clearInterval(editor.inputEcho.interval);
    editor.inputEcho.interval = null;
  }
  if (SC.AutoRepeatInfo.timer) {
    clearTimeout(SC.AutoRepeatInfo.timer);
    SC.AutoRepeatInfo.timer = null;
  }
  SC.AutoRepeatInfo.mouseinfo = null;
  SC.AutoRepeatInfo.editor = null;
  SC.AutoRepeatInfo.repeatcallback = null;
  if (SC.ButtonInfo.timer) {
    clearTimeout(SC.ButtonInfo.timer);
    SC.ButtonInfo.timer = null;
  }
  SC.Keyboard.focusTable = null;
  SC.Keyboard.passThru = null;
  editor.state = "start";
  if (editor.timeout) {
    clearTimeout(editor.timeout);
    editor.timeout = null;
  }
}

function makeNextCreatedDivFirstChildNull(): () => void {
  const documentWithCreate = document as Document & {
    createElement: typeof document.createElement;
  };
  const originalCreateElement = document.createElement.bind(
    document,
  ) as typeof document.createElement;
  let patched = false;
  documentWithCreate.createElement = ((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (!patched && tagName.toLowerCase() === "div") {
      patched = true;
      Object.defineProperty(element, "firstChild", {
        configurable: true,
        get() {
          return null;
        },
      });
    }
    return element;
  }) as typeof document.createElement;
  return () => {
    documentWithCreate.createElement = originalCreateElement;
  };
}

test("ProcessEditorMouseDown uses srcElement when event.target is falsy", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-mouse-src");
  const editor = control.editor;
  primeGridLayout(editor);
  const grid = requiredElement(editor.fullgrid, "fullgrid");
  const mouseInfo = SC.EditorMouseInfo;
  const mouseSnapshot = saveMouseInfo(mouseInfo);
  const originalGetPosition = SC.GetElementPositionWithScroll;
  const originalGridMousePosition = SC.GridMousePosition;
  const originalKeyboardSetFocus = SC.KeyboardSetFocus;
  const originalSetMouseMoveUp = SC.SetMouseMoveUp;
  const editorOps = mutableEditor(editor);
  let capturedMouseEvent: Event | null = null;

  try {
    mouseInfo.registeredElements = [{ element: grid, editor }];
    mouseInfo.editor = null;
    mouseInfo.element = null;
    mouseInfo.ignore = false;
    SC.GetElementPositionWithScroll = (() => ({
      left: 0,
      top: 0,
    })) as unknown as typeof SC.GetElementPositionWithScroll;
    SC.GridMousePosition = (() => ({ row: 2, col: 2, coord: "B2" })) as typeof SC.GridMousePosition;
    editorOps.MoveECell = (coord: string) => coord;
    editorOps.EditorMouseRange = () => {};
    SC.KeyboardSetFocus = (() => {}) as typeof SC.KeyboardSetFocus;
    SC.SetMouseMoveUp = ((_move, _up, _element, event) => {
      capturedMouseEvent = event;
    }) as typeof SC.SetMouseMoveUp;

    const event = syntheticEvent({ target: null, srcElement: grid });
    SC.ProcessEditorMouseDown(event as unknown as MouseEvent);

    expect(mouseInfo.editor === editor).toBe(true);

    expect(mouseInfo.mousedowncoord).toBe("B2");
    expect(capturedMouseEvent === event).toBe(true);
  } finally {
    SC.GetElementPositionWithScroll = originalGetPosition;
    SC.GridMousePosition = originalGridMousePosition;
    SC.KeyboardSetFocus = originalKeyboardSetFocus;
    SC.SetMouseMoveUp = originalSetMouseMoveUp;
    restoreMouseInfo(mouseInfo, mouseSnapshot);
    teardownEditor(SC, editor);
  }
});

test("ProcessEditorMouseMove exits when a truthy grid result loses its coord", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-mouse-move-nocoord");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  const mouseInfo = SC.EditorMouseInfo;
  const mouseSnapshot = saveMouseInfo(mouseInfo);
  const originalGetPosition = SC.GetElementPositionWithScroll;
  const originalGridMousePosition = SC.GridMousePosition;
  const originalSetDragAutoRepeat = SC.SetDragAutoRepeat;
  let autoRepeatMouseInfo: unknown = "not-called";
  let coordReads = 0;
  const changingResult = {
    row: 2,
    col: 2,
    get coord() {
      coordReads += 1;
      return coordReads === 1 ? "B2" : undefined;
    },
  } as SocialCalc.GridMousePositionResult;

  try {
    mouseInfo.editor = editor;
    mouseInfo.ignore = false;
    mouseInfo.mousedowncoord = "A1";
    mouseInfo.mouselastcoord = "A1";
    editor.range.hasrange = false;
    SC.GetElementPositionWithScroll = (() => ({
      left: 0,
      top: 0,
    })) as unknown as typeof SC.GetElementPositionWithScroll;
    SC.GridMousePosition = (() => changingResult) as typeof SC.GridMousePosition;
    SC.SetDragAutoRepeat = ((_editor, result) => {
      autoRepeatMouseInfo = result;
    }) as typeof SC.SetDragAutoRepeat;

    const result = SC.ProcessEditorMouseMove(syntheticEvent() as unknown as MouseEvent);

    expect(result).toBeUndefined();
    expect(autoRepeatMouseInfo).toBe(null);
    expect(editor.ecell.coord).toBe("A1");
    expect(mouseInfo.mouselastcoord).toBe("A1");
  } finally {
    SC.GetElementPositionWithScroll = originalGetPosition;
    SC.GridMousePosition = originalGridMousePosition;
    SC.SetDragAutoRepeat = originalSetDragAutoRepeat;
    restoreMouseInfo(mouseInfo, mouseSnapshot);
    teardownEditor(SC, editor);
  }
});

test("ProcessEditorColsizeMouseDown and MouseUp handle missing size target and no-op resize", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-colsize-noop");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();
  const mouseInfo = SC.EditorMouseInfo;
  const mouseSnapshot = saveMouseInfo(mouseInfo);
  const originalGetPosition = SC.GetElementPositionWithScroll;
  const originalSetMouseMoveUp = SC.SetMouseMoveUp;
  const originalRemoveMouseMoveUp = SC.RemoveMouseMoveUp;
  const originalSetStyles = SC.setStyles;
  let restoreCreateElement = () => {};
  let styleCalls = 0;
  const scheduledCommands: string[] = [];
  const editorOps = mutableEditor(editor);

  try {
    mouseInfo.editor = editor;
    mouseInfo.ignore = false;
    editor.toplevel = document.createElement("div");
    editor.headposition = { left: 30, top: 30 };
    editor.colpositions = [0, 0, 80, 160, 240];
    editor.context.colwidth = [0, 30, 80, 80, 80];
    restoreCreateElement = makeNextCreatedDivFirstChildNull();
    SC.GetElementPositionWithScroll = (() => ({
      left: 0,
      top: 0,
    })) as unknown as typeof SC.GetElementPositionWithScroll;
    SC.SetMouseMoveUp = (() => {}) as typeof SC.SetMouseMoveUp;
    SC.RemoveMouseMoveUp = (() => {}) as typeof SC.RemoveMouseMoveUp;
    SC.setStyles = (() => {
      styleCalls += 1;
    }) as typeof SC.setStyles;
    editorOps.EditorScheduleSheetCommands = (cmd: string) => {
      scheduledCommands.push(cmd);
    };

    SC.ProcessEditorColsizeMouseDown(
      syntheticEvent({ clientX: 80 }) as unknown as MouseEvent,
      editor.toplevel,
      { row: 0, col: 2, coltoresize: 2, coltounhide: 0 } as SocialCalc.GridMousePositionResult,
    );
    expect(mouseInfo.mouseresizecolnum).toBe(2);
    expect(styleCalls).toBe(0);

    mouseInfo.mousecoltounhide = 0;
    mouseInfo.mouseresizecolnum = 0;
    const result = SC.ProcessEditorColsizeMouseUp(
      syntheticEvent({ clientX: 100 }) as unknown as MouseEvent,
    );

    expect(result).toBe(false);
    expect(scheduledCommands).toEqual([]);
  } finally {
    restoreCreateElement();
    SC.GetElementPositionWithScroll = originalGetPosition;
    SC.SetMouseMoveUp = originalSetMouseMoveUp;
    SC.RemoveMouseMoveUp = originalRemoveMouseMoveUp;
    SC.setStyles = originalSetStyles;
    restoreMouseInfo(mouseInfo, mouseSnapshot);
    teardownEditor(SC, editor);
  }
});

test("ProcessEditorRowsizeMouseDown and MouseUp handle missing size target and no-op resize", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-rowsize-noop");
  const editor = control.editor;
  primeGridLayout(editor);
  ensureDocumentEvents();
  const mouseInfo = SC.EditorMouseInfo;
  const mouseSnapshot = saveMouseInfo(mouseInfo);
  const originalGetSpreadsheetControlObject = SC.GetSpreadsheetControlObject;
  const originalSetMouseMoveUp = SC.SetMouseMoveUp;
  const originalRemoveMouseMoveUp = SC.RemoveMouseMoveUp;
  const originalSetStyles = SC.setStyles;
  let restoreCreateElement = () => {};
  let styleCalls = 0;
  const scheduledCommands: string[] = [];
  const editorOps = mutableEditor(editor);
  const fakeControl = {
    spreadsheetDiv: { firstChild: { offsetHeight: 0 } },
  };

  try {
    mouseInfo.editor = editor;
    mouseInfo.ignore = false;
    editor.toplevel = document.createElement("div");
    editor.headposition = { left: 30, top: 30 };
    editor.rowpositions = [0, 0, 50, 70, 90];
    editor.context.rowheight = [0, 30, 20, 20, 20];
    editor.context.totalwidth = 400;
    restoreCreateElement = makeNextCreatedDivFirstChildNull();
    SC.GetSpreadsheetControlObject = (() =>
      fakeControl) as unknown as typeof SC.GetSpreadsheetControlObject;
    SC.SetMouseMoveUp = (() => {}) as typeof SC.SetMouseMoveUp;
    SC.RemoveMouseMoveUp = (() => {}) as typeof SC.RemoveMouseMoveUp;
    SC.setStyles = (() => {
      styleCalls += 1;
    }) as typeof SC.setStyles;
    editorOps.EditorScheduleSheetCommands = (cmd: string) => {
      scheduledCommands.push(cmd);
    };

    SC.ProcessEditorRowsizeMouseDown(
      syntheticEvent({ clientY: 50 }) as unknown as MouseEvent,
      editor.toplevel,
      { row: 2, col: 0, rowtoresize: 2, rowtounhide: 0 } as SocialCalc.GridMousePositionResult,
    );
    expect(mouseInfo.mouseresizerownum).toBe(2);
    expect(styleCalls).toBe(0);

    mouseInfo.mouserowtounhide = 0;
    mouseInfo.mouseresizerownum = 0;
    const result = SC.ProcessEditorRowsizeMouseUp(
      syntheticEvent({ clientY: 100 }) as unknown as MouseEvent,
    );

    expect(result).toBe(false);
    expect(scheduledCommands).toEqual([]);
  } finally {
    restoreCreateElement();
    SC.GetSpreadsheetControlObject = originalGetSpreadsheetControlObject;
    SC.SetMouseMoveUp = originalSetMouseMoveUp;
    SC.RemoveMouseMoveUp = originalRemoveMouseMoveUp;
    SC.setStyles = originalSetStyles;
    restoreMouseInfo(mouseInfo, mouseSnapshot);
    teardownEditor(SC, editor);
  }
});

test("SetDragAutoRepeat covers unordered row direction and unchanged/non-header repeat inputs", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-autorepeat-set");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  const repeatInfo = SC.AutoRepeatInfo;
  const repeatSnapshot = saveAutoRepeat(repeatInfo);
  let callbackCount = 0;
  let callbackCoord: string | null = null;
  let callbackDirection: string | null = null;
  const callback = (coord: string, direction: string) => {
    callbackCount += 1;
    callbackCoord = coord;
    callbackDirection = direction;
  };

  try {
    repeatInfo.timer = null;
    repeatInfo.mouseinfo = { row: 2, col: 1 };
    SC.SetDragAutoRepeat(
      editor,
      { rowheader: true, row: Number.NaN, col: 1, distance: 5 },
      callback,
    );
    expect(callbackCoord).toBe("ANaN");
    expect(callbackDirection).toBe("");

    callbackCount = 0;
    repeatInfo.mouseinfo = { row: 1, col: 1 };
    SC.SetDragAutoRepeat(editor, { row: 1, col: 1, distance: 5 }, callback);
    expect(callbackCount).toBe(0);

    repeatInfo.mouseinfo = { row: 1, col: 3 };
    SC.SetDragAutoRepeat(editor, { colheader: true, row: 1, col: 3, distance: 5 }, callback);
    expect(callbackCount).toBe(0);
  } finally {
    restoreAutoRepeat(repeatInfo, repeatSnapshot);
    teardownEditor(SC, editor);
  }
});

test("DragAutoRepeat leaves direction undefined when the repeat point is not a sheet edge", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-autorepeat-drag");
  const editor = control.editor;
  primeGridLayout(editor);
  editor.ecell = { coord: "A1", row: 1, col: 1 };
  const repeatInfo = SC.AutoRepeatInfo;
  const repeatSnapshot = saveAutoRepeat(repeatInfo);
  let callbackCoord: string | null = null;
  let callbackDirection: unknown = "not-called";

  try {
    repeatInfo.timer = null;
    repeatInfo.editor = editor;
    repeatInfo.mouseinfo = { row: 1, col: 1, distance: 5 };
    repeatInfo.repeatinterval = 1000;
    repeatInfo.repeatcallback = (coord: string, direction: string) => {
      callbackCoord = coord;
      callbackDirection = direction;
    };

    SC.DragAutoRepeat();

    expect(callbackCoord).toBe("A1");
    expect(callbackDirection).toBeUndefined();
  } finally {
    restoreAutoRepeat(repeatInfo, repeatSnapshot);
    teardownEditor(SC, editor);
  }
});

test("EditorProcessKey input state leaves non-control keys in editing mode", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-key-input-noncontrol");
  const editor = control.editor;
  primeGridLayout(editor);

  try {
    editor.state = "input";
    editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1, partialexpr: "" };
    editor.ecell = { coord: "A1", row: 1, col: 1 };
    editor.range = { hasrange: false, left: 1, right: 1, top: 1, bottom: 1 };
    editor.inputBox = {
      element: document.createElement("input"),
      GetText: () => "editing",
      Blur: () => {},
      ShowInputBox: () => {},
      SetText: () => {},
      DisplayCellContents: () => {},
      Focus: () => {},
      Select: () => {},
      skipOne: false,
    } as unknown as Editor["inputBox"];
    editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;

    const result = SC.EditorProcessKey(
      editor,
      "x",
      syntheticEvent({ shiftKey: false }) as unknown as KeyboardEvent,
    );

    expect(result).toBe(true);
    expect(editor.state).toBe("input");
  } finally {
    teardownEditor(SC, editor);
  }
});

test("EditorProcessKey input state covers guarded non-arrow save path", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-key-input-save-nonarrow");
  const editor = control.editor;
  primeGridLayout(editor);
  const editorOps = mutableEditor(editor);
  const movedKeys: string[] = [];
  let saveCount = 0;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalSubstr: (start: number, length?: number) => string = String.prototype.substr;

  try {
    editor.state = "input";
    editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1, partialexpr: "" };
    editor.ecell = { coord: "A1", row: 1, col: 1 };
    editor.range = { hasrange: false, left: 1, right: 1, top: 1, bottom: 1 };
    editor.inputBox = {
      element: document.createElement("input"),
      GetText: () => "done",
      Blur: () => {},
      ShowInputBox: () => {},
      SetText: () => {},
      DisplayCellContents: () => {},
      Focus: () => {},
      Select: () => {},
      skipOne: false,
    } as unknown as Editor["inputBox"];
    editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;
    editorOps.EditorSaveEdit = () => {
      saveCount += 1;
    };
    editorOps.MoveECellWithKey = (ch: string) => {
      movedKeys.push(ch);
      return "A1";
    };

    let substrCalls = 0;
    String.prototype.substr = function (start: number, length?: number) {
      substrCalls += 1;
      if (substrCalls === 1) return "[a";
      if (substrCalls === 2) return "zz";
      return originalSubstr.call(this, start, length);
    };
    SC.EditorProcessKey(editor, "[custom]", syntheticEvent() as unknown as KeyboardEvent);
    String.prototype.substr = originalSubstr;

    expect(saveCount).toBe(1);
    expect(movedKeys).toEqual([]);
    expect(editor.state).toBe("start");
  } finally {
    String.prototype.substr = originalSubstr;
    teardownEditor(SC, editor);
  }
});

test("EditorProcessKey inputboxdirect covers unshifted tab and f2 non-tab/non-arrow paths", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "final-key-direct-paths");
  const editor = control.editor;
  primeGridLayout(editor);
  const editorOps = mutableEditor(editor);
  let saveCount = 0;
  const movedKeys: string[] = [];
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalSubstr: (start: number, length?: number) => string = String.prototype.substr;

  editor.inputBox = {
    element: document.createElement("input"),
    GetText: () => "done",
    Blur: () => {},
    ShowInputBox: () => {},
    SetText: () => {},
    DisplayCellContents: () => {},
    Focus: () => {},
    Select: () => {},
    skipOne: false,
  } as unknown as Editor["inputBox"];
  editor.cellhandles = { ShowCellHandles: () => {} } as unknown as SocialCalc.CellHandles;
  editorOps.EditorSaveEdit = () => {
    saveCount += 1;
  };
  editorOps.MoveECellWithKey = (ch: string) => {
    movedKeys.push(ch);
    return "A1";
  };
  editorOps.MoveECell = (coord: string) => coord;

  try {
    editor.state = "inputboxdirect";
    editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1 };
    editor.ecell = { coord: "A1", row: 1, col: 1 };
    SC.EditorProcessKey(
      editor,
      "[tab]",
      syntheticEvent({ shiftKey: false }) as unknown as KeyboardEvent,
    );
    expect(movedKeys).toEqual(["[aright]"]);
    expect(saveCount).toBe(1);

    movedKeys.length = 0;
    editor.state = "inputboxdirect";
    editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1 };
    editor.ecell = { coord: "A1", row: 1, col: 1 };
    SC.EditorProcessKey(
      editor,
      "[tab]",
      syntheticEvent({ shiftKey: true }) as unknown as KeyboardEvent,
    );
    expect(movedKeys).toEqual(["[aleft]"]);

    movedKeys.length = 0;
    editor.state = "inputboxdirect";
    const f2Result = SC.EditorProcessKey(
      editor,
      "[f2]",
      syntheticEvent({ shiftKey: false }) as unknown as KeyboardEvent,
    );

    expect(f2Result).toBe(false);
    expect(movedKeys).toEqual([]);

    movedKeys.length = 0;
    editor.state = "inputboxdirect";
    editor.workingvalues = { ecoord: "A1", erow: 1, ecol: 1 };
    editor.ecell = { coord: "A1", row: 1, col: 1 };
    String.prototype.substr = function (start: number, length?: number) {
      if (String(this) === "[adown]" && start === 0 && length === 2) return "zz";
      return originalSubstr.call(this, start, length);
    };
    SC.EditorProcessKey(
      editor,
      "[enter]",
      syntheticEvent({ shiftKey: false }) as unknown as KeyboardEvent,
    );
    String.prototype.substr = originalSubstr;
    expect(saveCount).toBe(3);
    expect(movedKeys).toEqual([]);
    expect(editor.state).toBe("start");
  } finally {
    String.prototype.substr = originalSubstr;
    teardownEditor(SC, editor);
  }
});
