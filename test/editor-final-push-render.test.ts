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
type Sheet = SocialCalc.Sheet;
type Pane = { first: number; last: number };
type MutableEditorMethods = {
  FitToEditTable: () => void;
  LimitLastPanes: () => void;
  ScheduleRender: () => void;
  ScrollRelativeBoth: (vamount: number, hamount: number) => void;
};
type HeaderContextFields = {
  classnames: Record<string, string> | null;
  explicitStyles: Record<string, string> | null;
};
type EnumerableStyle = Record<string, string> & { cssText: string };

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

function teardownEditor(SC: SC, editor: Editor) {
  if (editor.inputEcho?.interval !== null && editor.inputEcho?.interval !== undefined) {
    clearInterval(editor.inputEcho.interval);
    editor.inputEcho.interval = null;
  }
  if (SC.AutoRepeatInfo.timer !== null) {
    clearTimeout(SC.AutoRepeatInfo.timer);
    SC.AutoRepeatInfo.timer = null;
    SC.AutoRepeatInfo.mouseinfo = null;
  }
  if (SC.ButtonInfo.timer !== null) {
    clearTimeout(SC.ButtonInfo.timer);
    SC.ButtonInfo.timer = null;
  }
  SC.Keyboard.focusTable = null;
  SC.Keyboard.passThru = null;
  editor.state = "start";
  if (editor.timeout !== null) {
    clearTimeout(editor.timeout);
    editor.timeout = null;
  }
}

function primeGridLayout(editor: Editor) {
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
  if (editor.verticaltablecontrol) editor.verticaltablecontrol.controlborder = 500;
  if (editor.horizontaltablecontrol) editor.horizontaltablecontrol.controlborder = 500;
}

function createRow(cellCount: number) {
  const row = document.createElement("tr");
  for (let index = 0; index < cellCount; index++) {
    row.appendChild(document.createElement("td"));
  }
  return row;
}

function createTableWithBodyRows(rowCellCounts: number[]) {
  const table = document.createElement("table");
  table.appendChild(document.createElement("colgroup"));
  const body = document.createElement("tbody");
  for (const cellCount of rowCellCounts) {
    body.appendChild(createRow(cellCount));
  }
  table.appendChild(body);
  return { table, body };
}

function replaceEditorRenderSideEffects(editor: Editor) {
  const mutableEditor = editor as unknown as MutableEditorMethods;
  mutableEditor.FitToEditTable = () => {};
  mutableEditor.LimitLastPanes = () => {};
  mutableEditor.ScheduleRender = () => {};
  return mutableEditor;
}

function makeCell(SC: SC, coord: string, rowspan: number) {
  const cell = new SC.Cell(coord);
  cell.rowspan = rowspan;
  return cell;
}

test("CreateTableEditor leaves logo title unset when the generated logo cell has no nested image", async () => {
  const SC = await loadSocialCalc();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const savedCreateElement = document.createElement;

  document.createElement = (tagName: string) => {
    const element = savedCreateElement.call(document, tagName);
    if (tagName.toLowerCase() === "td") {
      Object.defineProperty(element, "innerHTML", {
        configurable: true,
        get() {
          return "";
        },
        set(_value: string) {},
      });
    }
    return element;
  };

  try {
    const { control } = await newControl(SC, "render-logo-falsy");
    const logo = control.editor.logo;
    expect(logo).not.toBeNull();
    expect(logo?.firstChild).toBeNull();
    expect(logo?.title).toBeUndefined();
    teardownEditor(SC, control.editor);
  } finally {
    document.createElement = savedCreateElement;
  }
});

test("GridMousePosition reports row-unhide-bottom only when the pointer is inside the bottom unhide control", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "render-row-unhide-bottom");
  const editor = control.editor;
  primeGridLayout(editor);

  const unhide = document.createElement("div");
  Object.defineProperty(unhide, "offsetWidth", { configurable: true, value: 20 });
  Object.defineProperty(unhide, "offsetHeight", { configurable: true, value: 10 });
  editor.context.rowunhidebottom[2] = unhide;

  const inside = SC.GridMousePosition(editor, 5, 51);
  expect(inside.rowheader).toBe(true);
  expect(inside.rowtounhide).toBe(1);

  const outside = SC.GridMousePosition(editor, 25, 51);
  expect(outside.rowheader).toBe(true);
  expect(outside.rowtounhide).toBeUndefined();

  teardownEditor(SC, editor);
});

test("EnsureECellVisible shows handles instead of scrolling when the edited column is non-scrolling", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "render-ensure-visible-col-false");
  const editor = control.editor;
  primeGridLayout(editor);

  const mutableEditor = editor as unknown as MutableEditorMethods;
  let scrolled = false;
  mutableEditor.ScrollRelativeBoth = () => {
    scrolled = true;
  };
  let handlesShown = false;
  editor.cellhandles.ShowCellHandles = (show: boolean) => {
    handlesShown = show;
  };

  editor.lastnonscrollingrow = 5;
  editor.lastnonscrollingcol = 5;
  editor.ecell = { coord: "C3", row: 3, col: 3 };

  SC.EnsureECellVisible(editor);

  expect(scrolled).toBe(false);
  expect(handlesShown).toBe(true);
  teardownEditor(SC, editor);
});

test("ReplaceCell and UpdateCellCSS enumerate cssText and non-cssText style keys", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "render-style-enumeration");
  const editor = control.editor;
  const context = editor.context;

  const styleKeysRead: string[] = [];

  function makeReplacement(color: string) {
    const replacement = document.createElement("div");
    replacement.innerHTML = `<span>${color}</span>`;
    replacement.className = `class-${color}`;
    const backingStyle: EnumerableStyle = { cssText: "cssText", color };
    const replacementStyle = new Proxy(backingStyle, {
      ownKeys() {
        return ["cssText", "color"];
      },
      getOwnPropertyDescriptor(_target, key) {
        if (key === "cssText" || key === "color") {
          return { configurable: true, enumerable: true };
        }
        return undefined;
      },
      get(target, key) {
        if (typeof key === "string") styleKeysRead.push(`${color}:${key}`);
        return Reflect.get(target, key);
      },
    });
    Object.defineProperty(replacement, "style", { configurable: true, value: replacementStyle });
    return replacement;
  }

  const replacements = [makeReplacement("red"), makeReplacement("blue")];
  context.RenderCell = () => replacements.shift() ?? makeReplacement("green");

  const targetElement = document.createElement("td");
  targetElement.style.cssText = "background: yellow";
  targetElement.style.color = "black";
  const cell: SocialCalc.RenderedCellRef = { element: targetElement, rowpane: 0, colpane: 0 };

  SC.ReplaceCell(editor, cell, 1, 1);
  expect(targetElement.innerHTML).toBe("<span>red</span>");
  expect(targetElement.className).toBe("class-red");
  expect(targetElement.style.cssText).toBe("");
  expect(targetElement.style.color).toBe("red");
  expect(styleKeysRead).toContain("red:cssText");

  targetElement.style.cssText = "background: yellow";
  targetElement.style.color = "black";
  SC.UpdateCellCSS(editor, cell, 1, 1);
  expect(targetElement.innerHTML).toBe("<span>red</span>");
  expect(targetElement.className).toBe("class-blue");
  expect(targetElement.style.cssText).toBe("");
  expect(targetElement.style.color).toBe("blue");

  expect(styleKeysRead).toContain("blue:cssText");
  teardownEditor(SC, editor);
});

test("SetECellHeaders tolerates missing row and column header cells in the fullgrid body shape", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "render-headercell-falsy");
  const editor = control.editor;
  const context = editor.context;
  const { table, body } = createTableWithBodyRows([1, 1, 0]);
  const neighborCell = body.childNodes[1].childNodes[0] as HTMLElement;
  neighborCell.className = "neighbor-before";

  editor.fullgrid = table;
  context.rowpanes = [{ first: 1, last: 1 }];
  context.colpanes = [{ first: 1, last: 1 }];
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  SC.SetECellHeaders(editor, "selected");

  expect(neighborCell.className).toBe("neighbor-before");
  teardownEditor(SC, editor);
});

test("SetECellHeaders leaves existing column header class and css text when class and style maps are absent", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "render-header-style-maps-falsy");
  const editor = control.editor;
  const context = editor.context;
  const headerFields = context as unknown as HeaderContextFields;
  const { table, body } = createTableWithBodyRows([1, 2, 1]);
  const rowHeader = body.childNodes[2].childNodes[0] as HTMLElement;
  const colHeader = body.childNodes[1].childNodes[1] as HTMLElement;
  rowHeader.className = "row-before";
  rowHeader.style.cssText = "color: purple";
  colHeader.className = "col-before";
  colHeader.style.cssText = "color: orange";

  editor.fullgrid = table;
  context.rowpanes = [{ first: 1, last: 1 }];
  context.colpanes = [{ first: 1, last: 1 }];
  headerFields.classnames = null;
  headerFields.explicitStyles = null;
  editor.ecell = { coord: "A1", row: 1, col: 1 };

  SC.SetECellHeaders(editor, "selected");

  expect(rowHeader.className).toBe("row-before");
  expect(rowHeader.style.cssText).toBe("color: purple");
  expect(rowHeader.style.verticalAlign).toBe("top");
  expect(colHeader.className).toBe("col-before");
  expect(colHeader.style.cssText).toBe("color: orange");
  teardownEditor(SC, editor);
});

test("PageRelative moves at least one row when a dynamic pane reports a current first not below the candidate", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "render-page-relative-minimum");
  const editor = control.editor;
  const context = editor.context;
  const mutableEditor = replaceEditorRenderSideEffects(editor);
  let firstReads = 0;
  let assignedFirst = 0;
  const pane: Pane = { first: 4, last: 4 };
  Object.defineProperty(pane, "first", {
    configurable: true,
    get() {
      firstReads += 1;
      return firstReads === 1 ? 4 : 3;
    },
    set(value: number) {
      assignedFirst = value;
    },
  });

  context.rowpanes = [pane];
  editor.tableheight = 0;
  editor.firstscrollingrowtop = 0;
  editor.gridposition = { left: 0, top: 0 };
  editor.lastvisiblerow = 1;
  editor.rowheight = [0, 20, 20, 20, 20];

  SC.PageRelative(editor, true, -1);

  expect(assignedFirst).toBe(2);
  expect(pane.last).toBe(3);
  mutableEditor.FitToEditTable();
  teardownEditor(SC, editor);
});

test("ScrollTableUpOneRow and ScrollTableDownOneRow skip refresh rows for rowspanned origins whose rowspan is not greater than one", async () => {
  const SC = await loadSocialCalc();
  const { control } = await newControl(SC, "render-rowspan-not-greater-than-one");
  const editor = control.editor;
  const context = editor.context;
  replaceEditorRenderSideEffects(editor);
  context.CalculateColWidthData = () => {};
  context.showRCHeaders = true;
  context.colpanes = [{ first: 1, last: 1 }];

  const upCalls: number[] = [];
  const upGrid = createTableWithBodyRows([1, 1, 1, 1, 1, 1]);
  editor.fullgrid = upGrid.table;
  context.rowpanes = [{ first: 2, last: 4 }];
  context.cellskip = { A5: "A3" };
  context.coordToCR = { A3: { row: 3, col: 1 } };
  const upSheet = context.sheetobj as Sheet;
  upSheet.cells.A3 = makeCell(SC, "A3", 1);
  context.RenderRow = (rownum: number) => {
    upCalls.push(rownum);
    return createRow(1);
  };

  SC.ScrollTableUpOneRow(editor);

  expect(upCalls).toEqual([5]);

  const downCalls: number[] = [];
  const downGrid = createTableWithBodyRows([1, 1, 1, 1, 1, 1]);
  editor.fullgrid = downGrid.table;
  context.rowpanes = [{ first: 3, last: 5 }];
  context.cellskip = { A4: "A3" };
  context.coordToCR = { A3: { row: 3, col: 1 } };
  const downSheet = context.sheetobj as Sheet;
  downSheet.cells.A3 = makeCell(SC, "A3", 1);
  downSheet.cells.A4 = makeCell(SC, "A4", 1);
  context.RenderRow = (rownum: number) => {
    downCalls.push(rownum);
    return createRow(1);
  };

  SC.ScrollTableDownOneRow(editor);

  expect(downCalls).toEqual([2]);
  teardownEditor(SC, editor);
});
