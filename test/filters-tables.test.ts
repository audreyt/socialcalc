import { expect, test } from "vite-plus/test";

import {
  installBrowserShim,
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
  waitForStatus,
} from "./helpers/socialcalc";

async function setupSheet(SC: any) {
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Name",
    "set B1 text t Dept",
    "set C1 text t Amount",
    "set A2 text t Alice",
    "set B2 text t Eng",
    "set C2 value n 10",
    "set A3 text t Bob",
    "set B3 text t Sales",
    "set C3 value n 20",
    "set A4 text t Carol",
    "set B4 text t Eng",
    "set C4 value n 30",
    "set A5 text t Dave",
    "set B5 text t Sales",
    "set C5 value n 40",
  ]);
  return sheet;
}

// ===========================================================================
// AutoFilter core behavior
// ===========================================================================

test("autofilter attach + exact-value criteria hides non-matching rows, composed with manual hide", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);

  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");
  expect(sheet.autofilters.f1.range).toBe("A1:C5");
  // No criteria yet: nothing filter-hidden.
  expect(sheet.rowattribs.filterhide[2]).toBeUndefined();

  await scheduleCommands(SC, sheet, [
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  // Column offset 1 = Dept. Rows 2 (Eng), 4 (Eng) pass; 3, 5 (Sales) fail.
  expect(sheet.rowattribs.filterhide[2]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[3]).toBe("yes");
  expect(sheet.rowattribs.filterhide[4]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[5]).toBe("yes");
  // Header row is never touched by the filter.
  expect(sheet.rowattribs.filterhide[1]).toBeUndefined();

  // Manual hide is a distinct, independently-owned axis.
  await scheduleCommands(SC, sheet, "set 2 hide yes");
  expect(sheet.rowattribs.hide[2]).toBe("yes");
  expect(sheet.rowattribs.filterhide[2]).toBeUndefined();
  expect(SC.RowEffectivelyHidden(sheet, 2)).toBe(true); // manual
  expect(SC.RowEffectivelyHidden(sheet, 3)).toBe(true); // filter
  expect(SC.RowEffectivelyHidden(sheet, 4)).toBe(false); // neither

  // Clearing the filter criterion must not disturb manual hide (clear isolation).
  await scheduleCommands(SC, sheet, "autofilter clearcol f1 1");
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[5]).toBeUndefined();
  expect(sheet.rowattribs.hide[2]).toBe("yes"); // manual survives filter clear
});

test("autofilter comparison/text/date criteria (op/op2) restrict numeric column", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 2 ${SC.encodeForSave(JSON.stringify({ op: ">=15", op2: "<=35" }))}`,
  ]);
  // Amount column: 10 fails, 20/30 pass, 40 fails.
  expect(sheet.rowattribs.filterhide[2]).toBe("yes");
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[4]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[5]).toBe("yes");
});

test("autofilter clearall removes every criterion but keeps the filter attached", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
    `autofilter criteria f1 2 ${SC.encodeForSave(JSON.stringify({ op: ">15" }))}`,
  ]);
  expect(sheet.rowattribs.filterhide[2]).toBe("yes"); // Eng but amount 10 fails op
  await scheduleCommands(SC, sheet, "autofilter clearall f1");
  expect(sheet.autofilters.f1.criteria).toEqual({});
  expect(sheet.rowattribs.filterhide[2]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[5]).toBeUndefined();
});

test("autofilter detach releases every filter-hidden row it owned", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  expect(sheet.rowattribs.filterhide[3]).toBe("yes");
  await scheduleCommands(SC, sheet, "autofilter detach f1");
  expect(sheet.autofilters.f1).toBeUndefined();
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
});

test("CollectAutoFilterColumnValues returns sorted distinct display values for the header dropdown", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");
  const values = SC.CollectAutoFilterColumnValues(sheet, "f1", 1);
  expect(values).toEqual(["Eng", "Sales"]);
});

test("recompute is idempotent: repeated recalc/value-change recompute converges without drift", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  const before = { ...sheet.rowattribs.filterhide };
  // Repeated real recalcs (the actual production path, not a direct
  // RecomputeAutoFilters call) must converge without drift.
  await recalcSheet(SC, sheet);
  await recalcSheet(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.rowattribs.filterhide).toEqual(before);

  // Value change through an ordinary "set ... / recalc" flow must converge to
  // a fresh correct result via RecalcSheet's own RecomputeAutoFilters hook --
  // no explicit recompute call from the caller.
  await scheduleCommands(SC, sheet, "set B3 text t Eng"); // Bob moves to Eng
  await recalcSheet(SC, sheet);
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined(); // now passes
  expect(sheet.rowattribs.filterhide[5]).toBe("yes"); // still Sales
});

test("autofilter range adjusts on insertrow/deleterow and drops when destroyed", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  expect(sheet.rowattribs.filterhide[3]).toBe("yes"); // Bob/Sales

  // Insert a row above the data band: range should grow/shift and rows renumber.
  await scheduleCommands(SC, sheet, "insertrow A2");
  expect(sheet.autofilters.f1.range).toBe("A1:C6");
  // Bob was row 3, now row 4; still Sales, still filter-hidden.
  expect(sheet.rowattribs.filterhide[4]).toBe("yes");

  // Delete the header row entirely: filter must be dropped and hidden rows released.
  await scheduleCommands(SC, sheet, "deleterow A1");
  expect(sheet.autofilters.f1).toBeUndefined();
  expect(sheet.rowattribs.filterhide[4]).toBeUndefined();
});

test("autofilter attach/criteria/detach undo and redo restore prior state", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");
  await scheduleCommands(SC, sheet, [
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  expect(sheet.rowattribs.filterhide[3]).toBe("yes");

  await sheetUndo(SC, sheet); // undo criteria
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();

  await sheetUndo(SC, sheet); // undo attach
  expect(sheet.autofilters.f1).toBeUndefined();

  await sheetRedo(SC, sheet); // redo attach
  expect(sheet.autofilters.f1.range).toBe("A1:C5");

  await sheetRedo(SC, sheet); // redo criteria
  expect(sheet.rowattribs.filterhide[3]).toBe("yes");
});

test("autofilter and table definitions persist through CreateSheetSave/ParseSheetSave round-trip", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
    "set 2 hide yes", // manual hide, must also persist and survive independently
    "table create SalesTable A1:C5 1 light1 0",
  ]);
  expect(sheet.rowattribs.filterhide[3]).toBe("yes");

  const saved = SC.CreateSheetSave(sheet);
  // Range/style fields are encodeForSave-escaped (":" -> "\c") since they
  // ride in colon-delimited save lines alongside the id/name field.
  expect(saved).toContain(`autofilter:f1:${SC.encodeForSave("A1:C5")}`);
  expect(saved).toContain("autofiltercol:f1:1:");
  expect(saved).toContain(`table:SALESTABLE:${SC.encodeForSave("A1:C5")}:1:light1:`);
  expect(saved).toContain("row:2:hide:yes");
  // filterhide is derived state and must NOT be persisted directly -- only
  // recomputed from the loaded autofilter definition (else a manually-visible
  // row would stay hidden forever once the filter that produced it is gone).
  expect(saved).not.toContain("row:3:hide:");

  const loaded = new SC.Sheet();
  SC.ParseSheetSave(saved, loaded);

  expect(loaded.autofilters.f1.range).toBe("A1:C5");
  expect(loaded.autofilters.f1.criteria[1]).toEqual({ values: ["Eng"] });
  expect(loaded.tables.SALESTABLE.range).toBe("A1:C5");
  expect(loaded.tables.SALESTABLE.style).toBe("light1");
  // Manual hide round-trips as its own axis.
  expect(loaded.rowattribs.hide[2]).toBe("yes");
  // filterhide is rebuilt by ParseSheetSave's RecomputeAutoFilters call, not
  // read from the save text -- reload converges to the identical result.
  expect(loaded.rowattribs.filterhide[3]).toBe("yes");
  expect(loaded.rowattribs.filterhide[2]).toBeUndefined();

  // Save-then-load-then-clear-the-filter must un-hide rows that were only
  // filter-hidden, while the manually-hidden row stays hidden (composition +
  // clear isolation survive a full persistence round-trip).
  await scheduleCommands(SC, loaded, "autofilter clearall f1");
  expect(loaded.rowattribs.filterhide[3]).toBeUndefined();
  expect(SC.RowEffectivelyHidden(loaded, 3)).toBe(false);
  expect(SC.RowEffectivelyHidden(loaded, 2)).toBe(true); // manual hide untouched
});

test("autofilter recomputes on sort (filter-hidden bit follows sorted row content, not position)", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Sales"] }))}`,
  ]);
  // Sales rows are Bob(3)/Dave(5); Eng rows Alice(2)/Carol(4) are filter-hidden.
  expect(sheet.rowattribs.filterhide[2]).toBe("yes");
  expect(sheet.rowattribs.filterhide[4]).toBe("yes");

  await scheduleCommands(SC, sheet, "sort A2:C5 A up");
  await recalcSheet(SC, sheet); // production path: RecalcSheet's own hook recomputes, no manual call
  // After A-Z sort by name (Alice,Bob,Carol,Dave) rows 2..5 = Alice,Bob,Carol,Dave.
  // Recomputed against new content: Alice(Eng)=hidden, Bob(Sales)=visible,
  // Carol(Eng)=hidden, Dave(Sales)=visible.
  expect(sheet.rowattribs.filterhide[2]).toBe("yes");
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[4]).toBe("yes");
  expect(sheet.rowattribs.filterhide[5]).toBeUndefined();
});

// ===========================================================================
// Structured tables
// ===========================================================================

test("table create registers a named range with optional integrated autofilter", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 1");
  expect(sheet.tables.SALESTABLE.range).toBe("A1:C5");
  expect(sheet.tables.SALESTABLE.hasHeader).toBe(true);
  expect(sheet.tables.SALESTABLE.style).toBe("light1");
  const filterId = sheet.tables.SALESTABLE.filterId;
  expect(filterId).toBeTruthy();
  expect(sheet.autofilters[filterId].range).toBe("A1:C5");
});

test("table names are sanitized and must be unique", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  // Command tokens split on the delimiter, so a stray "-" is the sanitization
  // probe here (uppercased, stripped to [A-Z0-9_.]) rather than a space.
  await scheduleCommands(SC, sheet, "table create Sales-Table A1:C5 1 none 0");
  expect(sheet.tables["SALESTABLE"]).toBeDefined();
  const before = { ...sheet.tables };
  await scheduleCommands(SC, sheet, "table create SalesTable D1:D5 0 none 0");
  // Second create with the same sanitized name is a no-op (uniqueness enforced).
  expect(sheet.tables.SALESTABLE.range).toBe(before.SALESTABLE.range);
});

test("table delete removes the table and any integrated filter's hidden rows", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, ["table create SalesTable A1:C5 1 light1 1"]);
  const filterId = sheet.tables.SALESTABLE.filterId;
  await scheduleCommands(SC, sheet, [
    `autofilter criteria ${filterId} 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  expect(sheet.rowattribs.filterhide[3]).toBe("yes");
  await scheduleCommands(SC, sheet, "table delete SalesTable");
  expect(sheet.tables.SALESTABLE).toBeUndefined();
  expect(sheet.autofilters[filterId]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
});

test("table style is restricted to the closed built-in palette (arbitrary values pass through as strings, not CSS injection)", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 0");
  await scheduleCommands(SC, sheet, "table style SalesTable dark1");
  expect(sheet.tables.SALESTABLE.style).toBe("dark1");
});

test("table range adjusts on insertcol and undo/redo restore table+filter state", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 1");
  const filterId = sheet.tables.SALESTABLE.filterId;

  await scheduleCommands(SC, sheet, "insertcol A1");
  expect(sheet.tables.SALESTABLE.range).toBe("B1:D5");
  expect(sheet.autofilters[filterId].range).toBe("B1:D5");

  await sheetUndo(SC, sheet); // undo insertcol
  expect(sheet.tables.SALESTABLE.range).toBe("A1:C5");

  await sheetUndo(SC, sheet); // undo table create
  expect(sheet.tables.SALESTABLE).toBeUndefined();

  await sheetRedo(SC, sheet); // redo create
  expect(sheet.tables.SALESTABLE.range).toBe("A1:C5");
});

// ===========================================================================
// SUBTOTAL
// ===========================================================================

test("SUBTOTAL code 9 (SUM) excludes AutoFilter-hidden rows but includes manually-hidden rows", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "set D1 formula SUBTOTAL(9,C2:C5)",
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  await recalcSheet(SC, sheet);
  // Eng rows: Alice(10) + Carol(30) = 40; Sales rows (Bob 20, Dave 40) filter-hidden.
  expect(sheet.cells.D1.datavalue).toBe(40);

  // Manually hiding an Eng row must NOT be excluded by code 9.
  await scheduleCommands(SC, sheet, "set 2 hide yes");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D1.datavalue).toBe(40); // unchanged: manual hide ignored by 1-11
});

test("SUBTOTAL code 109 (SUM, 101-111 family) excludes both filter-hidden and manually-hidden rows", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "set D1 formula SUBTOTAL(109,C2:C5)",
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D1.datavalue).toBe(40); // Alice 10 + Carol 30

  await scheduleCommands(SC, sheet, "set 2 hide yes"); // manually hide Alice
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D1.datavalue).toBe(30); // only Carol remains
});

test("SUBTOTAL excludes nested SUBTOTAL results to avoid double counting", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "set D2 formula SUBTOTAL(9,C2:C3)", // 10 + 20 = 30
    "set D6 formula SUBTOTAL(9,C2:C5,D2)", // must ignore D2 (nested SUBTOTAL)
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D2.datavalue).toBe(30);
  // If D2 were double counted this would be 100+30=130; correct is 100.
  expect(sheet.cells.D6.datavalue).toBe(100);
});

test("SUBTOTAL codes 1-11 cover AVERAGE/COUNT/COUNTA/MAX/MIN/PRODUCT/STDEV/STDEVP/SUM/VAR/VARP", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  const codes: Record<number, string> = {
    1: "AVERAGE",
    2: "COUNT",
    3: "COUNTA",
    4: "MAX",
    5: "MIN",
    6: "PRODUCT",
    9: "SUM",
  };
  const cmds: string[] = [];
  let col = 4; // E
  const colLetters: Record<number, string> = {};
  for (const code of Object.keys(codes)) {
    const letter = SC.rcColname(col);
    colLetters[Number(code)] = letter;
    cmds.push(`set ${letter}1 formula SUBTOTAL(${code},C2:C5)`);
    col++;
  }
  await scheduleCommands(SC, sheet, cmds);
  await recalcSheet(SC, sheet);

  expect(sheet.cells[colLetters[1] + "1"].datavalue).toBeCloseTo(25); // AVERAGE(10,20,30,40)
  expect(sheet.cells[colLetters[2] + "1"].datavalue).toBe(4); // COUNT
  expect(sheet.cells[colLetters[3] + "1"].datavalue).toBe(4); // COUNTA
  expect(sheet.cells[colLetters[4] + "1"].datavalue).toBe(40); // MAX
  expect(sheet.cells[colLetters[5] + "1"].datavalue).toBe(10); // MIN
  expect(sheet.cells[colLetters[6] + "1"].datavalue).toBe(240000); // PRODUCT
  expect(sheet.cells[colLetters[9] + "1"].datavalue).toBe(100); // SUM
});

test("SUBTOTAL STDEV.S/STDEV.P/VAR.S/VAR.P (codes 7/8/10/11) match SocialCalc STDEV/STDEVP/VAR/VARP", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "set E1 formula SUBTOTAL(7,C2:C5)",
    "set F1 formula STDEV(C2:C5)",
    "set E2 formula SUBTOTAL(8,C2:C5)",
    "set F2 formula STDEVP(C2:C5)",
    "set E3 formula SUBTOTAL(10,C2:C5)",
    "set F3 formula VAR(C2:C5)",
    "set E4 formula SUBTOTAL(11,C2:C5)",
    "set F4 formula VARP(C2:C5)",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.E1.datavalue).toBeCloseTo(sheet.cells.F1.datavalue as number);
  expect(sheet.cells.E2.datavalue).toBeCloseTo(sheet.cells.F2.datavalue as number);
  expect(sheet.cells.E3.datavalue).toBeCloseTo(sheet.cells.F3.datavalue as number);
  expect(sheet.cells.E4.datavalue).toBeCloseTo(sheet.cells.F4.datavalue as number);
});

test("SUBTOTAL rejects an unknown function_code with #VALUE!", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "set D1 formula SUBTOTAL(99,C2:C5)");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D1.valuetype.charAt(0)).toBe("e");
});

test("table range command relocates the table and its integrated filter's range", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 1");
  const filterId = sheet.tables.SALESTABLE.filterId;

  await scheduleCommands(SC, sheet, "table range SalesTable A1:C4");
  expect(sheet.tables.SALESTABLE.range).toBe("A1:C4");
  expect(sheet.autofilters[filterId].range).toBe("A1:C4");

  await sheetUndo(SC, sheet);
  expect(sheet.tables.SALESTABLE.range).toBe("A1:C5");
  expect(sheet.autofilters[filterId].range).toBe("A1:C5");

  // No-op guards: unknown table name, or empty range, must not throw or mutate.
  await scheduleCommands(SC, sheet, "table range NoSuchTable A1:B2");
  expect(sheet.tables.NOSUCHTABLE).toBeUndefined();
});

test("detaching a table's integrated autofilter clears the table's filterId link", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 1");
  const filterId = sheet.tables.SALESTABLE.filterId;
  await scheduleCommands(SC, sheet, `autofilter detach ${filterId}`);
  expect(sheet.autofilters[filterId]).toBeUndefined();
  expect(sheet.tables.SALESTABLE.filterId).toBeNull();
});

test("SUBTOTAL STDEV/VAR family (7/8/10/11 and 107/108/110/111) report #DIV/0! with fewer than two numeric values", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "set G1 formula SUBTOTAL(7,C2)",
    "set G2 formula SUBTOTAL(8,C2)",
    "set G3 formula SUBTOTAL(10,C2)",
    "set G4 formula SUBTOTAL(11,C2)",
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.G1.valuetype.charAt(0)).toBe("e");
  expect(sheet.cells.G2.valuetype.charAt(0)).toBe("e");
  expect(sheet.cells.G3.valuetype.charAt(0)).toBe("e");
  expect(sheet.cells.G4.valuetype.charAt(0)).toBe("e");
});

test("autofilter criteria command undo restores the prior criterion when re-set (not clearcol)", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  // Re-set the same column's criterion to a different value; undo must
  // restore the previous criterion object (not just clear the column).
  await scheduleCommands(SC, sheet, [
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Sales"] }))}`,
  ]);
  expect(sheet.autofilters.f1.criteria[1]).toEqual({ values: ["Sales"] });
  await sheetUndo(SC, sheet);
  expect(sheet.autofilters.f1.criteria[1]).toEqual({ values: ["Eng"] });
});

test("autofilter criteria command rejects malformed JSON without mutating the filter", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");
  const before = { ...sheet.autofilters.f1.criteria };
  await scheduleCommands(SC, sheet, "autofilter criteria f1 1 not-json{", false);
  expect(sheet.autofilters.f1.criteria).toEqual(before);
});

test("SUBTOTAL accepts scalar literal arguments alongside ranges (no row to exclude)", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "set D1 formula SUBTOTAL(9,C2:C3,100)");
  await recalcSheet(SC, sheet);
  // Alice(10) + Bob(20) + literal 100 = 130.
  expect(sheet.cells.D1.datavalue).toBe(130);
});

test("SUBTOTAL AVERAGE/COUNT-dependent codes report #DIV/0! with zero visible numeric values", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "set D1 formula SUBTOTAL(1,C2:C5)", // AVERAGE
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["NoSuchDept"] }))}`,
  ]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D1.valuetype.charAt(0)).toBe("e");
});

test("SUBTOTAL scalar-literal-first argument initializes variance accumulators and propagates a scalar error", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  // Literal 5 arrives before any range: exercises the scalar count==1 init
  // branch directly (not the range-cell visitCell path).
  await scheduleCommands(SC, sheet, "set D1 formula SUBTOTAL(9,5,C2:C3)");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D1.datavalue).toBe(35); // 5 + Alice(10) + Bob(20)

  // A scalar error argument must propagate as the result type.
  await scheduleCommands(SC, sheet, "set D2 formula SUBTOTAL(9,1/0)");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.D2.valuetype.charAt(0)).toBe("e");
});

test("table range command with two-or-more autofilter criteria sorts undo restoration by numeric column offset", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 0 ${SC.encodeForSave(JSON.stringify({ values: ["Alice", "Bob", "Carol", "Dave"] }))}`,
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  const saved = SC.CreateSheetSave(sheet);
  // Two criteria columns (offsets 0 and 1) force the numeric-offset sort
  // comparator used when emitting autofiltercol lines in order.
  const idx0 = saved.indexOf("autofiltercol:f1:0:");
  const idx1 = saved.indexOf("autofiltercol:f1:1:");
  expect(idx0).toBeGreaterThan(-1);
  expect(idx1).toBeGreaterThan(idx0);
});

test("structural edit that destroys a table's range without an integrated filter removes the table", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 0");
  expect(sheet.tables.SALESTABLE).toBeDefined();
  // Deleting every row of the table's range destroys both endpoints.
  await scheduleCommands(SC, sheet, "deleterow A1:A5");
  expect(sheet.tables.SALESTABLE).toBeUndefined();
});

test("SUBTOTAL resolves a cross-sheet coord/range reference and propagates the operand-stack #REF! an unavailable sheet already produces", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();

  const rawSheet2 = "version:1.5\ncell:A1:v:99\nsheet:c:1:r:1\n";
  SC.Formula.AddSheetToCache("SHEET2", rawSheet2, false);

  const ok = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(9,Sheet2!A1)"),
    sheet,
    false,
  );
  expect(ok.value).toBe(99);

  // TopOfStackValueAndType/StepThroughRangeDown already resolve an
  // unavailable-sheet coord/range to an "e#REF!" operand before SUBTOTAL's
  // range/coord branches run, so both forms surface the same #REF!.
  const missingCoord = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(9,NoSuchSheet!A1)"),
    sheet,
    false,
  );
  expect(missingCoord.type.charAt(0)).toBe("e");

  const missingRange = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(9,NoSuchSheet!A1:A2)"),
    sheet,
    false,
  );
  expect(missingRange.type.charAt(0)).toBe("e");
});

test("FindAutoFilterForHeaderCell locates the owning filter by exact header row and column band", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");

  expect(SC.FindAutoFilterForHeaderCell(sheet, 1, 1)).toEqual({ filterId: "f1", colOffset: 0 });
  expect(SC.FindAutoFilterForHeaderCell(sheet, 1, 2)).toEqual({ filterId: "f1", colOffset: 1 });
  // Not the header row.
  expect(SC.FindAutoFilterForHeaderCell(sheet, 2, 1)).toBeNull();
  // Outside the filter's column band.
  expect(SC.FindAutoFilterForHeaderCell(sheet, 1, 5)).toBeNull();
});

// ===========================================================================
// AutoFilter header dropdown UI (fake-DOM-compatible unit coverage; full
// real-browser interaction + XSS-resistance is e2e/autofilter-dropdown.spec.ts)
// ===========================================================================

test("BuildAutoFilterDropdownHtml escapes hostile column values and reflects current criterion checked-state", async () => {
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Dept",
    "set A2 text t <img src=x onerror=alert(1)>",
    "set A3 text t Sales",
    "autofilter attach f1 A1:A3",
    `autofilter criteria f1 0 ${SC.encodeForSave(JSON.stringify({ values: ["Sales"] }))}`,
  ]);

  const html = SC.BuildAutoFilterDropdownHtml(sheet, "f1", 0);
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img ");
  // Sales is checked (matches criterion); the hostile value is unchecked.
  expect(html).toMatch(/data-autofilter-value="Sales"[^>]*checked/);
  expect(html).not.toMatch(/data-autofilter-value="&lt;img[^>]*checked/);
});

test("ShowAutoFilterDropdown/Apply/Clear/Cancel/Close drive the full dropdown lifecycle against a fake DOM", async () => {
  // querySelectorAll (used only by the real-browser "Select All" checkbox
  // handler AutoFilterDropdownToggleAll) is not part of the shared fake-DOM
  // shim's contract -- that handler is exercised in real Chromium by
  // e2e/autofilter-dropdown.spec.ts. This test drives every other lifecycle
  // function (open/apply/clear/cancel/close), setting `state.checked`
  // directly the same way AutoFilterDropdownToggleValue would from a single
  // checkbox click, which the fake DOM does support.
  const SC = await loadSocialCalc({ browser: true });
  installBrowserShim();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Dept",
    "set A2 text t Eng",
    "set A3 text t Sales",
    "autofilter attach f1 A1:A3",
  ]);

  const anchor = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10 }) };
  SC.ShowAutoFilterDropdown(sheet, "f1", 0, anchor);
  expect(SC.AutoFilterDropdownState.popupele).toBeTruthy();
  expect(SC.AutoFilterDropdownState.filterId).toBe("f1");

  // Opening a second dropdown closes the first (no leaked popup).
  SC.ShowAutoFilterDropdown(sheet, "f1", 0, anchor);
  expect(SC.AutoFilterDropdownState.popupele).toBeTruthy();

  SC.AutoFilterDropdownCancel();
  expect(SC.AutoFilterDropdownState.popupele).toBeNull();

  SC.ShowAutoFilterDropdown(sheet, "f1", 0, anchor);
  SC.AutoFilterDropdownState.checked = { Eng: true, Sales: false };
  await waitForStatus(sheet, "cmdend", () => SC.AutoFilterDropdownApply());
  expect(sheet.autofilters.f1.criteria[0]).toEqual({ values: ["Eng"] });
  expect(SC.AutoFilterDropdownState.popupele).toBeNull();

  SC.ShowAutoFilterDropdown(sheet, "f1", 0, anchor);
  await waitForStatus(sheet, "cmdend", () => SC.AutoFilterDropdownClear());
  expect(sheet.autofilters.f1.criteria[0]).toBeUndefined();
  expect(SC.AutoFilterDropdownState.popupele).toBeNull();

  // Close with nothing open is a safe no-op.
  SC.AutoFilterDropdownClose();
  expect(SC.AutoFilterDropdownState.sheet).toBeNull();
});

test("AutoFilterDropdownToggleAll walks matching checkboxes via querySelectorAll and flips their checked state", async () => {
  // The shared fake DOM's innerHTML setter (test/helpers/socialcalc.ts) is a
  // plain string store, not a parser -- it never materializes real child
  // elements, so a popup built via innerHTML has no queryable DOM children
  // here (this exact gap is why e2e/autofilter-dropdown.spec.ts drives the
  // real click-driven toggle-all flow in real Chromium). This test instead
  // builds the checkbox elements directly with appendChild (which the fake
  // DOM fully supports) to exercise AutoFilterDropdownToggleAll's real
  // querySelectorAll + checked-state-mirroring logic end to end.
  const SC = await loadSocialCalc({ browser: true });
  const { document } = installBrowserShim();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Dept",
    "set A2 text t Eng",
    "set A3 text t Sales",
    "autofilter attach f1 A1:A3",
  ]);

  const popupele = document.createElement("div");
  const engBox = document.createElement("input");
  engBox.setAttribute("data-autofilter-value", "Eng");
  engBox.checked = true;
  const salesBox = document.createElement("input");
  salesBox.setAttribute("data-autofilter-value", "Sales");
  salesBox.checked = true;
  popupele.appendChild(engBox);
  popupele.appendChild(salesBox);

  SC.AutoFilterDropdownState.popupele = popupele;
  SC.AutoFilterDropdownState.sheet = sheet;
  SC.AutoFilterDropdownState.filterId = "f1";
  SC.AutoFilterDropdownState.colOffset = 0;
  SC.AutoFilterDropdownState.checked = { Eng: true, Sales: true };

  SC.AutoFilterDropdownToggleAll(false);
  expect(engBox.checked).toBe(false);
  expect(salesBox.checked).toBe(false);
  expect(SC.AutoFilterDropdownState.checked.Eng).toBe(false);
  expect(SC.AutoFilterDropdownState.checked.Sales).toBe(false);

  SC.AutoFilterDropdownToggleAll(true);
  expect(engBox.checked).toBe(true);
  expect(salesBox.checked).toBe(true);
  expect(SC.AutoFilterDropdownState.checked.Eng).toBe(true);
  expect(SC.AutoFilterDropdownState.checked.Sales).toBe(true);

  SC.AutoFilterDropdownState.popupele = null;
});

test("AutoFilterDropdownToggleAll is a safe no-op when no dropdown is open", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installBrowserShim();
  SC.AutoFilterDropdownState.popupele = null;
  expect(() => SC.AutoFilterDropdownToggleAll(true)).not.toThrow();
});

test("AutoFilterDropdownToggleValue records one checkbox's state (drives the box.checked branch directly)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installBrowserShim();
  SC.AutoFilterDropdownState.checked = {};
  const box = {
    checked: true,
    getAttribute: (name: string) => (name === "data-autofilter-value" ? "Eng" : null),
  };
  SC.AutoFilterDropdownToggleValue(box);
  expect(SC.AutoFilterDropdownState.checked.Eng).toBe(true);
  box.checked = false;
  SC.AutoFilterDropdownToggleValue(box);
  expect(SC.AutoFilterDropdownState.checked.Eng).toBe(false);
});

test("RenderCell attaches a clickable dropdown arrow to an AutoFilter header cell (noElement=false path only)", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installBrowserShim();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Dept",
    "set A2 text t Eng",
    "autofilter attach f1 A1:A2",
  ]);

  const context = new SC.RenderContext(sheet);
  context.CalculateCellSkipData();
  const headerTd = SC.RenderCell(context, 1, 1, 0, 0, false, context.defaultHTMLlinkstyle);
  const arrow = headerTd.childNodes.find((c: any) => c.className === "autofilter-dropdown-arrow");
  expect(arrow).toBeTruthy();
  expect(arrow.getAttribute("data-autofilter-id")).toBe("f1");
  expect(arrow.getAttribute("data-autofilter-coloffset")).toBe("0");

  // Clicking the arrow opens the dropdown for this exact filter/column.
  arrow.getBoundingClientRect = () => ({ left: 0, top: 0, right: 10, bottom: 10 });
  arrow.onclick({ stopPropagation() {} });
  expect(SC.AutoFilterDropdownState.filterId).toBe("f1");
  expect(SC.AutoFilterDropdownState.colOffset).toBe(0);
  SC.AutoFilterDropdownClose();

  // A non-header data cell (row 2) gets no dropdown arrow.
  const dataTd = SC.RenderCell(context, 2, 1, 0, 0, false, context.defaultHTMLlinkstyle);
  const noArrow = dataTd.childNodes.find((c: any) => c.className === "autofilter-dropdown-arrow");
  expect(noArrow).toBeUndefined();

  // noElement=true (pseudo-element measurement path) never gets an arrow.
  const pseudo = SC.RenderCell(context, 1, 1, 0, 0, true, context.defaultHTMLlinkstyle);
  expect(pseudo.className || "").not.toContain("autofilter-dropdown-arrow");
});

test("recompute releases filterhide for a row a filter no longer owns after its range shrinks", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  expect(sheet.rowattribs.filterhide[3]).toBe("yes"); // Bob/Sales

  // Shrink the filter's range directly (bypassing the "autofilter attach"
  // undo-only re-attach path) so row 3 falls outside the new band while its
  // filterhide bit is still set, then recompute.
  sheet.autofilters.f1.range = "A1:C2";
  SC.RecomputeAutoFilters(sheet);
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
});

test("structural edit that destroys a filter's range clears a linked table's filterId", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 1");
  const filterId = sheet.tables.SALESTABLE.filterId;
  expect(sheet.autofilters[filterId]).toBeDefined();

  // Deleting every row of the shared range destroys the filter (both
  // endpoints land in the deleted band) while the table survives as a
  // separate registry entry whose filterId must be cleared, not left dangling.
  await scheduleCommands(SC, sheet, "deleterow A1:A4");
  expect(sheet.autofilters[filterId]).toBeUndefined();
  if (sheet.tables.SALESTABLE) {
    expect(sheet.tables.SALESTABLE.filterId).toBeNull();
  }
});

test("autofilter criteria with empty payload for an existing column deletes just that criterion", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    `autofilter criteria f1 1 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  ]);
  expect(sheet.autofilters.f1.criteria[1]).toEqual({ values: ["Eng"] });
  // "autofilter criteria f1 1" with nothing after colOffset -> rest is empty,
  // hits the delete-branch (not JSON.parse).
  await scheduleCommands(SC, sheet, "autofilter criteria f1 1");
  expect(sheet.autofilters.f1.criteria[1]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
});

test("AutoFilterDropdownApply/Clear are safe no-ops when no dropdown is open", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installBrowserShim();
  SC.AutoFilterDropdownState.sheet = null;
  expect(() => SC.AutoFilterDropdownApply()).not.toThrow();
  expect(() => SC.AutoFilterDropdownClear()).not.toThrow();
});

test("AutoFilterDropdownToggleValue falls back to an empty key when the checkbox has no data-autofilter-value attribute", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installBrowserShim();
  SC.AutoFilterDropdownState.checked = {};
  const box = { checked: true, getAttribute: () => null };
  SC.AutoFilterDropdownToggleValue(box);
  expect(SC.AutoFilterDropdownState.checked[""]).toBe(true);
});

test("table range on a table with no integrated filter skips the filter-range sync branch", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 0"); // withFilter=0
  expect(sheet.tables.SALESTABLE.filterId).toBeNull();
  await scheduleCommands(SC, sheet, "table range SalesTable A1:C4");
  expect(sheet.tables.SALESTABLE.range).toBe("A1:C4");
  expect(Object.keys(sheet.autofilters)).toHaveLength(0);
});

test("BuildAutoFilterDropdownHtml labels a blank column value as (Blanks) and a non-blank value verbatim", async () => {
  const SC = await loadSocialCalc({ browser: true });
  installBrowserShim();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Dept",
    "set A2 text t Eng",
    "erase A3 all", // blank cell in the filter's data band
    "autofilter attach f1 A1:A3",
  ]);
  const html = SC.BuildAutoFilterDropdownHtml(sheet, "f1", 0);
  expect(html).toContain("(Blanks)");
  expect(html).toContain("Eng");
});

test("SUBTOTAL exercises text/blank/error member skipping and running MIN/MAX updates across multiple range values", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 5",
    "set A2 text t hello", // text member: counta+1, concat, but not numeric
    "erase A3 all", // blank member: skipped entirely (visitCell early return)
    "set A4 value n 20", // second numeric: updates running max
    "set A5 value n 1", // third numeric: updates running min
  ]);
  // A6 is set directly as an already-errored cell (bypassing recalc, which
  // this test doesn't otherwise need) purely to exercise SUBTOTAL's
  // error-member propagation branch.
  sheet.GetAssuredCell("A6").datatype = "v";
  sheet.GetAssuredCell("A6").valuetype = "e#DIV/0!";
  sheet.GetAssuredCell("A6").datavalue = 0;

  const min = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(5,A1:A5)"),
    sheet,
    false,
  );
  expect(min.value).toBe(1);

  const max = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(4,A1:A5)"),
    sheet,
    false,
  );
  expect(max.value).toBe(20);

  const counta = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(3,A1:A5)"),
    sheet,
    false,
  );
  expect(counta.value).toBe(4); // 5, hello, 20, 1 (blank A3 excluded)

  const errProp = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(9,A1:A6)"),
    sheet,
    false,
  );
  expect(errProp.type.charAt(0)).toBe("e");
});

test("SUBTOTAL scalar-argument path exercises counta/min/max running updates and error-type propagation", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const r = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens('SUBTOTAL(9,"text",5,20,1,1/0)'),
    sheet,
    false,
  );
  // "text" is a scalar non-numeric arg (counta path, t2 != "b"); 5,20,1
  // exercise the scalar min/max running-update branches; 1/0 exercises the
  // scalar error-type-propagation branch.
  expect(r.type.charAt(0)).toBe("e");

  const min = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(5,5,20,1)"),
    sheet,
    false,
  );
  expect(min.value).toBe(1);
  const max = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(4,5,20,1)"),
    sheet,
    false,
  );
  expect(max.value).toBe(20);

  // No numeric scalar member at all: minval/maxval accumulators stay
  // undefined, exercising the "|| 0" fallback.
  const maxAllText = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens('SUBTOTAL(4,"x")'),
    sheet,
    false,
  );
  expect(maxAllText.value).toBe(0);
  const minAllText = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens('SUBTOTAL(5,"x")'),
    sheet,
    false,
  );
  expect(minAllText.value).toBe(0);
});

test("AutoFilterCellFailsCriterion treats a cell with an explicit null datavalue as an empty display text", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const cell = sheet.GetAssuredCell("A1");
  cell.datavalue = null;
  const failsNonEmpty = SC.AutoFilterCellFailsCriterion(sheet, { values: ["x"] }, "A1");
  expect(failsNonEmpty).toBe(true);
  const passesEmpty = SC.AutoFilterCellFailsCriterion(sheet, { values: [""] }, "A1");
  expect(passesEmpty).toBe(false);
});

test("AutoFilterCellFailsCriterion handles a missing cell (blank) and a numeric cell needing display formatting", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set B2 value n 42"]);

  // No cell object at all at A1 (never set): cell is undefined, datavalue
  // falls back to "", valuetype falls back to "b".
  const blankFails = SC.AutoFilterCellFailsCriterion(sheet, { values: ["x"] }, "A1");
  expect(blankFails).toBe(true); // "" is not in the allowlist
  const blankPasses = SC.AutoFilterCellFailsCriterion(sheet, { values: [""] }, "A1");
  expect(blankPasses).toBe(false);

  // Numeric cell: exercises the valuetype.charAt(0) == "n" display branch.
  const numFails = SC.AutoFilterCellFailsCriterion(sheet, { values: ["99"] }, "B2");
  expect(numFails).toBe(true);
  const numPasses = SC.AutoFilterCellFailsCriterion(sheet, { values: ["42"] }, "B2");
  expect(numPasses).toBe(false);
});

test("CollectAutoFilterColumnValues stops at the filter's last column and formats numeric display values", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 text t Header",
    "set A2 value n 7",
    "erase A3 all",
    "autofilter attach f1 A1:A3",
  ]);
  const values = SC.CollectAutoFilterColumnValues(sheet, "f1", 0);
  expect(values).toEqual(["", "7"]);
  // colOffset past the filter's single-column band returns [] (col > cr2.col).
  expect(SC.CollectAutoFilterColumnValues(sheet, "f1", 5)).toEqual([]);
});

test("AdjustAutoFilterRangesForStructuralEdit handles a single-cell (no colon) filter/table range", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1"); // single cell, no ":"
  await scheduleCommands(SC, sheet, "table create SoloTable A1 0 none 0"); // single cell too
  expect(sheet.autofilters.f1.range).toBe("A1");
  expect(sheet.tables.SOLOTABLE.range).toBe("A1");

  // Insert a column before A: both single-cell ranges shift to B1, still no colon.
  await scheduleCommands(SC, sheet, "insertcol A1");
  expect(sheet.autofilters.f1.range).toBe("B1");
  expect(sheet.tables.SOLOTABLE.range).toBe("B1");
});

test("AdjustAutoFilterRangesForStructuralEdit leaves an unrelated table's filterId untouched when a different filter is dropped", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 D1:D1", // isolated column, destroyed by the delete below
    "table create SalesTable A1:C5 1 light1 1", // separate range, unrelated to f1
  ]);
  const salesFilterId = sheet.tables.SALESTABLE.filterId;
  expect(sheet.autofilters.f1).toBeDefined();

  // Delete column D entirely: destroys f1 (single-column range collapses),
  // but SalesTable's own filter/table survive since their range is A1:C5.
  await scheduleCommands(SC, sheet, "deletecol D1");
  expect(sheet.autofilters.f1).toBeUndefined();
  expect(sheet.tables.SALESTABLE.filterId).toBe(salesFilterId); // untouched
});

test("autofilter attach with trailing content after the range still parses range up to the first space", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  // Exercises the pos >= 0 (space found) branch of the attach range parse.
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5 ignored-trailer");
  expect(sheet.autofilters.f1.range).toBe("A1:C5");
});

test("autofilter criteria/clearcol for a never-attached filter id is a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(
    SC,
    sheet,
    `autofilter criteria neverattached 0 ${SC.encodeForSave(JSON.stringify({ values: ["x"] }))}`,
  );
  expect(sheet.autofilters.neverattached).toBeUndefined();
  await scheduleCommands(SC, sheet, "autofilter clearcol neverattached 0");
  expect(sheet.autofilters.neverattached).toBeUndefined();
});

test("table command with a name that sanitizes to empty is a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create --- A1:C5 1 none 0"); // sanitizes to ""
  expect(Object.keys(sheet.tables)).toHaveLength(0);
});

test("table create with hasHeader true but withFilter false creates no integrated autofilter", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 none 0");
  expect(sheet.tables.SALESTABLE.hasHeader).toBe(true);
  expect(sheet.tables.SALESTABLE.filterId).toBeNull();
  expect(Object.keys(sheet.autofilters)).toHaveLength(0);
});

test("SUBTOTAL rejects a non-numeric function_code with #VALUE! before checking the code table", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const r = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens('SUBTOTAL("x",5)'),
    sheet,
    false,
  );
  expect(r.type.charAt(0)).toBe("e");
});

test("ParseSheetSave ignores an autofiltercol line whose filter id was never attached", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const save = [
    "version:1.5",
    `autofiltercol:orphan:0:${SC.encodeForSave(JSON.stringify({ values: ["x"] }))}`,
    "",
  ].join("\n");
  SC.ParseSheetSave(save, sheet);
  expect(sheet.autofilters.orphan).toBeUndefined();
});

test("table without a header persists and round-trips with hasHeader false", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 0 none 0");
  expect(sheet.tables.SALESTABLE.hasHeader).toBe(false);
  const saved = SC.CreateSheetSave(sheet);
  expect(saved).toContain("table:SALESTABLE:");
  expect(saved).toMatch(/table:SALESTABLE:[^:]+:0:none:/);
  const loaded = new SC.Sheet();
  SC.ParseSheetSave(saved, loaded);
  expect(loaded.tables.SALESTABLE.hasHeader).toBe(false);
});

test("RecomputeAutoFilter on a nonexistent filter id is a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  expect(() => SC.RecomputeAutoFilter(sheet, "nonexistent")).not.toThrow();
});

test("RecomputeAutoFilter skips a criterion whose colOffset lands past the filter's last column", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:B5"); // only 2 columns
  // colOffset 5 lands past column B (cr2.col); the criterion is stored but
  // silently skipped during recompute rather than throwing or false-failing.
  await scheduleCommands(
    SC,
    sheet,
    `autofilter criteria f1 5 ${SC.encodeForSave(JSON.stringify({ values: ["never"] }))}`,
  );
  expect(sheet.rowattribs.filterhide[2]).toBeUndefined();
  expect(sheet.rowattribs.filterhide[3]).toBeUndefined();
});

test("CollectAutoFilterColumnValues on a nonexistent filter id returns an empty list", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  expect(SC.CollectAutoFilterColumnValues(sheet, "nonexistent", 0)).toEqual([]);
});

test("autofilter attach with an empty range is a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 ");
  expect(sheet.autofilters.f1).toBeUndefined();
});

test("autofilter clearall/detach on a nonexistent filter id are safe no-ops", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter clearall neverattached");
  expect(sheet.autofilters.neverattached).toBeUndefined();
  await scheduleCommands(SC, sheet, "autofilter detach neverattached");
  expect(sheet.autofilters.neverattached).toBeUndefined();
});

test("table delete/style/range on a nonexistent table name are safe no-ops", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table delete NoSuchTable");
  expect(sheet.tables.NOSUCHTABLE).toBeUndefined();
  await scheduleCommands(SC, sheet, "table style NoSuchTable dark1");
  expect(sheet.tables.NOSUCHTABLE).toBeUndefined();
  await scheduleCommands(SC, sheet, "table range NoSuchTable A1:B2");
  expect(sheet.tables.NOSUCHTABLE).toBeUndefined();
});

test("table range with an empty new range is a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 0");
  await scheduleCommands(SC, sheet, "table range SalesTable ");
  expect(sheet.tables.SALESTABLE.range).toBe("A1:C5");
});

test("table style with no explicit style falls back to none", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 0");
  await scheduleCommands(SC, sheet, "table style SalesTable ");
  expect(sheet.tables.SALESTABLE.style).toBe("none");
});

test("table delete on a table with no integrated filter skips the filter-release branch", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 0"); // no filter
  await scheduleCommands(SC, sheet, "table delete SalesTable");
  expect(sheet.tables.SALESTABLE).toBeUndefined();
});

test("table create with hasHeader false never creates an integrated filter regardless of withFilter", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 0 none 1"); // no header, withFilter=1
  expect(sheet.tables.SALESTABLE.hasHeader).toBe(false);
  expect(sheet.tables.SALESTABLE.filterId).toBeNull();
  expect(Object.keys(sheet.autofilters)).toHaveLength(0);
});

test("SUBTOTAL treats a cell with an empty/undefined valuetype as blank (counta false branch)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const cell = sheet.GetAssuredCell("A1");
  cell.datatype = "v";
  cell.datavalue = 0;
  cell.valuetype = ""; // falsy: exercises `cell.valuetype || "b"` and `t != "b"` false arm
  const r = SC.Formula.evaluate_parsed_formula(
    SC.Formula.ParseFormulaIntoTokens("SUBTOTAL(3,A1:A1)"),
    sheet,
    false,
  );
  expect(r.value).toBe(0); // COUNTA does not count the blank-typed cell
});

test("AdjustAutoFilterRangesForStructuralEdit destroys a filter that was never recomputed (no ownedRows yet)", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  // Bypass the "autofilter attach" command (which always recomputes first)
  // to construct a filter definition with no ownedRows property at all.
  sheet.autofilters.raw = { id: "raw", range: "A1:C5", criteria: {} };
  expect(sheet.autofilters.raw.ownedRows).toBeUndefined();
  await scheduleCommands(SC, sheet, "deleterow A1:A5"); // destroys the whole range
  expect(sheet.autofilters.raw).toBeUndefined();
});

test("autofilter clearcol on a column with no existing criterion skips the undo-restore branch", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");
  await scheduleCommands(SC, sheet, "autofilter clearcol f1 0"); // never had a criterion
  expect(sheet.autofilters.f1.criteria[0]).toBeUndefined();
});

test("autofilter clearall/detach with saveundo=false skip undo recording entirely", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");
  await scheduleCommands(
    SC,
    sheet,
    `autofilter criteria f1 0 ${SC.encodeForSave(JSON.stringify({ values: ["Eng"] }))}`,
  );
  await scheduleCommands(SC, sheet, "autofilter clearall f1", false);
  expect(sheet.autofilters.f1.criteria).toEqual({});

  await scheduleCommands(SC, sheet, "autofilter detach f1", false);
  expect(sheet.autofilters.f1).toBeUndefined();
});

test("autofilter detach on a filter never recomputed (no ownedRows) is a safe no-op release", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  sheet.autofilters.raw = { id: "raw", range: "A1:C5", criteria: {} };
  await scheduleCommands(SC, sheet, "autofilter detach raw");
  expect(sheet.autofilters.raw).toBeUndefined();
});

test("autofilter detach leaves an unrelated table's filterId untouched", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, [
    "autofilter attach f1 A1:C5",
    "table create SalesTable A1:C5 1 light1 1",
  ]);
  const salesFilterId = sheet.tables.SALESTABLE.filterId;
  await scheduleCommands(SC, sheet, "autofilter detach f1");
  expect(sheet.tables.SALESTABLE.filterId).toBe(salesFilterId);
});

test("table create with hasHeader false skips the header/withFilter check entirely", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 0 "); // no style/withFilter tokens -> "none" default
  expect(sheet.tables.SALESTABLE.hasHeader).toBe(false);
  expect(sheet.tables.SALESTABLE.style).toBe("none");
});

test("table create with an empty range is a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable ");
  expect(sheet.tables.SALESTABLE).toBeUndefined();
});

test("table delete/style with saveundo=false skip undo recording", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 0 light1 0");
  await scheduleCommands(SC, sheet, "table style SalesTable dark1", false);
  expect(sheet.tables.SALESTABLE.style).toBe("dark1");
  await scheduleCommands(SC, sheet, "table delete SalesTable", false);
  expect(sheet.tables.SALESTABLE).toBeUndefined();
});

test("table delete on a table whose filterId points at an already-removed filter skips the release branch", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 1");
  const filterId = sheet.tables.SALESTABLE.filterId;
  delete sheet.autofilters[filterId]; // simulate dangling reference
  await scheduleCommands(SC, sheet, "table delete SalesTable");
  expect(sheet.tables.SALESTABLE).toBeUndefined();
});

test("CollectAutoFilterColumnValues treats a cell with an explicit null datavalue as an empty display value", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 text t Header", "autofilter attach f1 A1:A2"]);
  const cell = sheet.GetAssuredCell("A2");
  cell.datavalue = null;
  expect(SC.CollectAutoFilterColumnValues(sheet, "f1", 0)).toEqual([""]);
});

test("autofilter clearall on a filter with zero criteria does nothing to iterate over", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter attach f1 A1:C5");
  await scheduleCommands(SC, sheet, "autofilter clearall f1");
  expect(sheet.autofilters.f1.criteria).toEqual({});
});

test("table delete records hasHeader:0 in its undo when the table had no header", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 0 none 0");
  await scheduleCommands(SC, sheet, "table delete SalesTable");
  await sheetUndo(SC, sheet);
  expect(sheet.tables.SALESTABLE.hasHeader).toBe(false);
});

test("table delete on a table with an integrated filter that was never recomputed (no ownedRows) still releases cleanly", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 1 light1 1");
  const filterId = sheet.tables.SALESTABLE.filterId;
  delete sheet.autofilters[filterId].ownedRows;
  await scheduleCommands(SC, sheet, "table delete SalesTable");
  expect(sheet.autofilters[filterId]).toBeUndefined();
});

test("table range command is reachable as the final else-if arm after create/delete/style", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table create SalesTable A1:C5 0 none 0");
  await scheduleCommands(SC, sheet, "table range SalesTable D1:F5");
  expect(sheet.tables.SALESTABLE.range).toBe("D1:F5");
});

test("autofilter with an unrecognized subcommand word falls through every arm as a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "autofilter bogus f1 A1:C5");
  expect(sheet.autofilters.f1).toBeUndefined();
});

test("table with an unrecognized subcommand word falls through every arm as a safe no-op", async () => {
  const SC = await loadSocialCalc();
  const sheet = await setupSheet(SC);
  await scheduleCommands(SC, sheet, "table bogus SalesTable A1:C5");
  expect(sheet.tables.SALESTABLE).toBeUndefined();
});
