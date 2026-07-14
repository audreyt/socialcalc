import { expect, test } from "vite-plus/test";

import { loadSocialCalc, scheduleCommands, installBrowserShim } from "./helpers/socialcalc";

// ── Narrow interfaces ────────────────────────────────────────────────────────

interface SheetAttribs {
  lastcol: number;
  lastrow: number;
  usermaxcol: number;
  usermaxrow: number;
  [key: string]: unknown;
}

interface SheetLike {
  attribs: SheetAttribs;
  cells: Record<string, unknown>;
  [key: string]: unknown;
}

interface SCFunc {
  (...args: unknown[]): unknown;
  new (...args: unknown[]): unknown;
}

interface SCCore {
  Sheet: SCFunc;
  RenderContext: SCFunc;
  ParseCellLinkText: (s: string) => {
    url: string;
    desc: string;
    newwin: boolean;
    pagename: string;
    workspace: string;
  };
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// Section 1: set sheet lastcol / lastrow with 0 or negative values (2078 b188 a1).
//
// Source line 2078:
//   if (typeof num == "number") attribs[attrib] = num > 0 ? num : 1;
//
// The ternary false arm (num <= 0 → clamp to 1) is branch b188 a1.
// Send 0 and negative values to trigger the clamp-to-1 path.
// ═══════════════════════════════════════════════════════════════════════════

test("set sheet lastcol with 0 clamps to 1 (b188 a1 – num<=0 ternary arm)", async () => {
  const SC = (await loadSocialCalc()) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  // Establish a non-default lastcol first.
  await scheduleCommands(SC, sheet, ["set sheet lastcol 5"]);
  expect(sheet.attribs.lastcol).toBe(5);

  // Set lastcol to 0 — should clamp to 1 (num > 0 ternary false arm).
  await scheduleCommands(SC, sheet, ["set sheet lastcol 0"]);
  expect(sheet.attribs.lastcol).toBe(1);
});

test("set sheet lastrow with negative value clamps to 1 (b188 a1 – num<=0 ternary arm)", async () => {
  const SC = (await loadSocialCalc()) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, ["set sheet lastrow 3"]);
  expect(sheet.attribs.lastrow).toBe(3);

  // Set lastrow to -5 — should clamp to 1.
  await scheduleCommands(SC, sheet, ["set sheet lastrow -5"]);
  expect(sheet.attribs.lastrow).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 2: set sheet usermaxcol / usermaxrow with 0 or negative values
//            (2093 b193 a1).
//
// Source line 2093:
//   if (typeof num == "number") attribs[attrib] = num > 0 ? num : 0;
//
// The ternary false arm (num <= 0 → clamp to 0) is branch b193 a1.
// ═══════════════════════════════════════════════════════════════════════════

test("set sheet usermaxcol with 0 clamps to 0 (b193 a1 – num<=0 ternary arm)", async () => {
  const SC = (await loadSocialCalc()) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  // Establish a positive usermaxcol first.
  await scheduleCommands(SC, sheet, ["set sheet usermaxcol 10"]);
  expect(sheet.attribs.usermaxcol).toBe(10);

  // Set usermaxcol to 0 — unlike lastcol, clamps to 0 (not 1).
  await scheduleCommands(SC, sheet, ["set sheet usermaxcol 0"]);
  expect(sheet.attribs.usermaxcol).toBe(0);
});

test("set sheet usermaxrow with negative value clamps to 0 (b193 a1 – num<=0 ternary arm)", async () => {
  const SC = (await loadSocialCalc()) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, ["set sheet usermaxrow 8"]);
  expect(sheet.attribs.usermaxrow).toBe(8);

  // Set usermaxrow to -3 — should clamp to 0.
  await scheduleCommands(SC, sheet, ["set sheet usermaxrow -3"]);
  expect(sheet.attribs.usermaxrow).toBe(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 3: Verify lastcol/usermaxcol distinguish their clamp values.
//
// lastcol   (b188): clamped minimum = 1
// usermaxcol (b193): clamped minimum = 0
// ═══════════════════════════════════════════════════════════════════════════

test("lastcol clamps to 1 while usermaxcol clamps to 0 for same input of 0", async () => {
  const SC = (await loadSocialCalc()) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, [
    "set sheet lastcol 0",
    "set sheet usermaxcol 0",
  ]);
  expect(sheet.attribs.lastcol).toBe(1);
  expect(sheet.attribs.usermaxcol).toBe(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 4: movepaste over an empty cell region (3280 b433 a0 + DA 3282).
//
// Source lines 3280-3282 (movepaste loop):
//   cell = sheet.GetAssuredCell(cr);   // always creates sheet.cells[cr]
//   if (!sheet.cells[cr]) {            // 3280: always false → a0 unreachable
//     continue;                         // 3282: dead statement
//   }
//
// GetAssuredCell calls AddCell, which assigns the new Cell into
// sheet.cells[cr] unconditionally. So sheet.cells[cr] is always truthy at
// 3280 and the true-arm (a0) + its body (DA 3282) are structurally dead.
//
// The test exercises movepaste for completeness and confirms the observable
// outcome (cell moved) without being able to hit the dead branch.
// ═══════════════════════════════════════════════════════════════════════════

test("movepaste of a cell with value moves correctly (3280 b433 a0 dead; true arm unreachable)", async () => {
  const SC = (await loadSocialCalc()) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, ["set A1 value n 42"]);
  await scheduleCommands(SC, sheet, ["movepaste A1:A1 B1"]);

  const b1 = sheet.cells["B1"] as { datavalue?: unknown } | undefined;
  expect(b1?.datavalue).toBe(42);
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 5: RenderSpacingRow appends spacing td (5179 b685 a1 dead).
//
// Source line 5179:
//   if (newcol) result.appendChild(newcol);
//
// newcol is always set by document.createElement("td") immediately before
// this check. createElement always returns a truthy object (FakeElement or
// real HTMLElement), so the false arm (a1) is structurally dead.
//
// The test exercises RenderSpacingRow and confirms the true arm fires.
// ═══════════════════════════════════════════════════════════════════════════

test("RenderSpacingRow appends spacing tds (5179 true arm exercised; false arm is dead)", async () => {
  installBrowserShim();
  const SC = (await loadSocialCalc({ browser: true })) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);

  const context = new SC.RenderContext(sheet) as unknown as {
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    CalculateColWidthData(): void;
    RenderSpacingRow(): { childNodes: unknown[] };
  };

  context.showRCHeaders = false;
  context.colpanes = [{ first: 1, last: 3 }];
  context.CalculateColWidthData();

  const row = context.RenderSpacingRow();
  // At least one td was appended — the loop body ran and the `if (newcol)`
  // guard (5179) evaluated true (the only reachable arm).
  expect(row.childNodes.length).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 6: RenderCell comment className ternary (5537 b784 a0, 5543 b786 a0).
//
// Source lines 5537 / 5543:
//   result.className =
//     (result.className ? result.className + " " : "") + context.commentClassName;
//
// At the point this ternary executes for a non-skipped cell, result is the
// <td> element created by document.createElement("td") at the top of
// RenderCell. className on a freshly created element is "" (falsy). No code
// path sets className on result before the comment block for normal cells.
// The skipped-cell path sets className but returns early. Therefore the
// ternary true side (result.className + " ") can never fire — a0 is dead.
//
// The tests below verify the false arm fires (prefix is ""), confirming the
// exact class name is set without a leading space.
// ═══════════════════════════════════════════════════════════════════════════

test("RenderCell comment showGrid=true: className set to commentClassName exactly (5537 b784 a0 dead)", async () => {
  installBrowserShim();
  const SC = (await loadSocialCalc({ browser: true })) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 comment text hello",
  ]);

  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    commentClassName: string;
    commentCSS: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };

  context.showGrid = true;
  context.showRCHeaders = false;
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.commentClassName = "my-comment";
  context.commentCSS = "";
  context.CalculateCellSkipData();

  const result = context.RenderCell(1, 1, 0, 0);
  // The ternary false arm (empty string prefix) fires; no leading space.
  expect(result.className).toBe("my-comment");
});

test("RenderCell comment showGrid=false: className set to commentNoGridClassName exactly (5543 b786 a0 dead)", async () => {
  installBrowserShim();
  const SC = (await loadSocialCalc({ browser: true })) as unknown as SCCore;
  const sheet = new SC.Sheet() as unknown as SheetLike;

  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 comment text world",
  ]);

  const context = new SC.RenderContext(sheet) as unknown as {
    showGrid: boolean;
    showRCHeaders: boolean;
    colpanes: Array<{ first: number; last: number }>;
    rowpanes: Array<{ first: number; last: number }>;
    commentNoGridClassName: string;
    commentNoGridCSS: string;
    cellskip: Record<string, string>;
    CalculateCellSkipData(): void;
    RenderCell(...args: unknown[]): { className: string };
  };

  context.showGrid = false;
  context.showRCHeaders = false;
  context.colpanes = [{ first: 1, last: 5 }];
  context.rowpanes = [{ first: 1, last: 5 }];
  context.commentNoGridClassName = "my-nogrid-comment";
  context.commentNoGridCSS = "";
  context.CalculateCellSkipData();

  const result = context.RenderCell(1, 1, 0, 0);
  expect(result.className).toBe("my-nogrid-comment");
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 7: ParseCellLinkText "}" false arm (6559 b975 a1).
//
// Source line 6559:
//   } else if (str.charAt(urlend) == "}") {
//
// The false arm is unreachable because:
//   • We only reach 6559 when the outer condition (6528-6536) is false,
//     meaning the string is NOT a plain URL.
//   • The "}" sub-condition (6531-6535) is one of the three ways to make
//     the outer condition false. It requires: char at urlend == "}" AND
//     char at urlend-1 == "]" AND lastbrace/lastbrkt both found AND
//     lastbrkt > lastbrace.
//   • Inside the else block, the if at 6542 checks ">", else-if at 6550
//     checks "]". If neither matched, char at urlend is not ">" or "]".
//   • For the outer condition to be false without ">" or "]", the "}"
//     sub-condition must have failed — which requires char at urlend == "}".
//     So when we reach 6559, char at urlend is always "}", making the
//     false arm dead.
//
// The test exercises the "}" (true) arm, confirming the workspace path.
// ═══════════════════════════════════════════════════════════════════════════

test("ParseCellLinkText workspace form reaches 6559 true arm; false arm unreachable (b975 a1)", async () => {
  const SC = (await loadSocialCalc()) as unknown as SCCore;
  const parseFn = SC.ParseCellLinkText;

  // Workspace+page form ends with "}" — triggers the 6559 true arm.
  const result = parseFn("go here{myworkspace [mypage]}");
  expect(result.workspace).toBe("myworkspace");
  expect(result.pagename).toBe("mypage");
  expect(result.desc).toBe("go here");

  // A plain URL goes through the outer-if true arm, never reaching 6559.
  const plain = parseFn("https://example.com");
  expect(plain.url).toBe("https://example.com");
  expect(plain.workspace).toBe("");
});
