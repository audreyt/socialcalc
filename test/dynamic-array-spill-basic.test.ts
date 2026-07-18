import { expect, test } from "vite-plus/test";
import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

async function setup(commands: string[]) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands);
  await recalcSheet(SC, sheet);
  return { SC, sheet };
}

test("ordinary formulas still recalculate", async () => {
  const { sheet } = await setup(["set A1 value n 3", "set B1 formula A1*2"]);
  expect(sheet.cells.B1.datavalue).toBe(6);
  expect(sheet.cells.B1.valuetype).toBe("n");
});

test("SORT spills values and types while retaining the anchor", async () => {
  const { sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  expect(sheet.cells.C1.datavalue).toBe(1);
  expect(sheet.cells.C1.valuetype).toBe("n");
  expect(sheet.cells.C1.spillrows).toBe(3);
  expect(sheet.cells.C1.spillcols).toBe(1);
  expect(sheet.cells.C2?.datavalue).toBe(2);
  expect(sheet.cells.C3?.datavalue).toBe(3);
  expect(sheet.cells.C2?.valuetype).toBe("n");
  expect(sheet.cells.C2?.spillowner).toBe("C1");
});

test("a non-empty spill target preserves the #SPILL! blocker", async () => {
  const { sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C2 value n 99",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  expect(sheet.cells.C1.valuetype).toBe("e");
  expect(sheet.cells.C1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.C2.datavalue).toBe(99);
  expect(sheet.cells.C2.spillowner).toBeUndefined();
});
test("overlapping spill formulas preserve the first spill and reject the second", async () => {
  const { sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set B1 value n 6",
    "set B2 value n 4",
    "set B3 value n 5",
    "set C2 formula SORT(B1:B3,1,1)",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  expect(sheet.cells.C2.datavalue).toBe(4);
  expect(sheet.cells.C3?.datavalue).toBe(5);
  expect(sheet.cells.C4?.datavalue).toBe(6);
  expect(sheet.cells.C2.spillowner).toBeUndefined();
  expect(sheet.cells.C3?.spillowner).toBe("C2");
  expect(sheet.cells.C4?.spillowner).toBe("C2");
  expect(sheet.cells.C1.datavalue).toBe("#SPILL!");
  expect(sheet.cells.C1.valuetype).toBe("e");
});

test("same-shape source updates refresh existing spill children", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  await scheduleCommands(SC, sheet, "set A1 value n 0");
  await recalcSheet(SC, sheet);
  expect([sheet.cells.C1.datavalue, sheet.cells.C2?.datavalue, sheet.cells.C3?.datavalue]).toEqual([
    0, 1, 2,
  ]);
  expect(sheet.cells.C2?.spillowner).toBe("C1");
});

test("downstream formulas follow a spill child reference", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 formula SORT(A1:A3,1,1)",
    "set D1 formula C2*10",
  ]);
  expect(sheet.cells.D1.datavalue).toBe(20);
  await scheduleCommands(SC, sheet, "set A2 value n 4");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C2?.datavalue).toBe(3);
  expect(sheet.cells.D1.datavalue).toBe(30);
});

test("single-cell child references order after a lexically later spill owner", async () => {
  const { sheet } = await setup([
    "set B1 value n 2",
    "set B2 value n 1",
    "set A1 formula Z2*10",
    "set Z1 formula SORT(B1:B2,1,1)",
  ]);
  expect(sheet.cells.Z2?.datavalue).toBe(2);
  expect(sheet.cells.A1.datavalue).toBe(20);
});

test("successive spill growth and shrink each complete an independent topology retry", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  const retainedChild = sheet.cells.C2;
  expect(retainedChild?.spillowner).toBe("C1");
  expect(retainedChild?.datavalue).toBe(2);
  expect(sheet.cells.C3?.spillowner).toBe("C1");
  expect(sheet.cells.C3?.datavalue).toBe(3);
  await scheduleCommands(SC, sheet, ["set A4 value n 4", "set C1 formula SORT(A1:A4,1,1)"]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBe(4);
  await scheduleCommands(SC, sheet, "set C1 formula SORT(A1:A2,1,1)");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C2?.spillowner).toBe("C1");
  expect(sheet.cells.C2?.datavalue).toBe(3);
  expect(sheet.cells.C3).toBeUndefined();
});

test("ClearSpill flags spill topology change when it frees child cells", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set A3 value n 2",
    "set C1 formula SORT(A1:A3,1,1)",
  ]);
  expect(sheet.cells.C2?.spillowner).toBe("C1");

  // ClearSpill drives the "one bounded topology retry per independent
  // shape change" invariant via sheet.spillTopologyChanged. If a formula
  // transitions from an array result to a non-array result in the same
  // recalc pass that frees a cell another formula wants to grow into, the
  // freed cell must trigger a retry — otherwise the grower stays stuck at
  // a stale #SPILL! until an unrelated later edit happens to retrigger one.
  sheet.spillTopologyChanged = false;
  const removed = SC.ClearSpill(sheet, sheet.cells.C1);
  expect(removed).toBe(true);
  expect(sheet.spillTopologyChanged).toBe(true);
});

test("spill child displaystring cache is invalidated on same-shape value change", async () => {
  const { SC, sheet } = await setup([
    "set A1 value n 3",
    "set A2 value n 1",
    "set C1 formula SORT(A1:A2,1,1)",
  ]);
  expect(sheet.cells.C2?.spillowner).toBe("C1");
  expect(sheet.cells.C2.datavalue).toBe(3);

  // Simulate the render path caching displaystring for the child, exactly
  // as the row-rendering code does when it fills in a <td>'s innerHTML.
  sheet.cells.C2.displaystring = SC.FormatValueForDisplay(
    sheet,
    sheet.cells.C2.datavalue,
    "C2",
    "",
  );
  expect(sheet.cells.C2.displaystring).toBe("3");

  // Same-shape reuse: A1 changes so the sorted result at C2 changes value
  // (3 -> 5) while the spill shape stays 2x1, so MaterializeSpill reuses
  // the existing C2 cell object instead of recreating it.
  await scheduleCommands(SC, sheet, "set A1 value n 5");
  await recalcSheet(SC, sheet);
  expect(sheet.cells.C2.datavalue).toBe(5);

  // The stale cached displaystring ("3") must be cleared so the renderer
  // recomputes it; otherwise the child cell shows a stale value forever.
  expect(sheet.cells.C2.displaystring).toBeUndefined();
});
test("MaterializeSpill shrinks directly while preserving anchor metadata and child ownership", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const first = {
    type: "array",
    value: {
      rows: 3,
      cols: 1,
      cells: [[{ type: "n", value: 1 }], [{ type: "n", value: 2 }], [{ type: "n", value: 3 }]],
    },
  };
  const second = {
    type: "array",
    value: { rows: 2, cols: 1, cells: [[{ type: "n", value: 7 }], [{ type: "n", value: 8 }]] },
  };
  expect(SC.MaterializeSpill(sheet, "C1", first)).not.toBeNull();
  const retained = sheet.cells.C2;
  expect(SC.MaterializeSpill(sheet, "C1", second)).not.toBeNull();
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C1.spillcols).toBe(1);
  expect(sheet.cells.C2).toBe(retained);
  expect(sheet.cells.C2?.spillowner).toBe("C1");
  expect(sheet.cells.C2?.datavalue).toBe(8);
  expect("C3" in sheet.cells).toBe(false);
});
test("MaterializeSpill shrink tolerates an already absent stale coordinate", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const first = {
    type: "array",
    value: {
      rows: 3,
      cols: 1,
      cells: [[{ type: "n", value: 1 }], [{ type: "n", value: 2 }], [{ type: "n", value: 3 }]],
    },
  };
  const second = {
    type: "array",
    value: { rows: 2, cols: 1, cells: [[{ type: "n", value: 4 }], [{ type: "n", value: 5 }]] },
  };
  SC.MaterializeSpill(sheet, "C1", first);
  delete sheet.cells.C3;
  expect(SC.MaterializeSpill(sheet, "C1", second)).not.toBeNull();
  expect(sheet.cells.C1.spillrows).toBe(2);
  expect(sheet.cells.C2.datavalue).toBe(5);
  expect("C3" in sheet.cells).toBe(false);
});
test("ClearSpill handles missing children and preserves a preexisting rerender entry", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.spillrows = 3;
  anchor.spillcols = 1;
  sheet.reRenderCellList = ["C1"];
  expect(SC.ClearSpill(sheet, anchor)).toBe(false);
  expect(sheet.reRenderCellList).toEqual(["C1"]);
  sheet.cells.C2 = new SC.Cell("C2");
  sheet.cells.C2.spillowner = "C1";
  sheet.cells.C3 = new SC.Cell("C3");
  sheet.cells.C3.spillowner = "C1";
  anchor.spillrows = 3;
  anchor.spillcols = 1;
  expect(SC.ClearSpill(sheet, anchor)).toBe(true);
  expect(sheet.cells.C2).toBeUndefined();
  expect(sheet.cells.C3).toBeUndefined();
  expect(sheet.reRenderCellList).toEqual(["C1"]);
});
test("spill public helpers validate metadata, ranges, and array shapes", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.datatype = "f";
  anchor.formula = "SORT(A1:A2,1,1)";
  anchor.spillrows = 2;
  anchor.spillcols = 1;
  const child = new SC.Cell("C2");
  child.spillowner = "C1";
  child.spillrow = 1;
  child.spillcol = 0;
  sheet.cells.C2 = child;
  SC.SanitizeSpills(sheet);
  expect(sheet.cells.C2?.spillowner).toBe("C1");
  child.spillrow = 9;
  SC.SanitizeSpills(sheet);
  expect(sheet.cells.C2).toBeUndefined();
  expect(SC.PrepareSpillMutation(sheet, ["C1:C2"], {})).toBe(SC.SpillCommandError);
  expect(
    SC.MaterializeSpill(sheet, "C1", {
      type: "array",
      value: { rows: 2, cols: 1, cells: [[{ type: "n", value: 1 }]] },
    }),
  ).toBeNull();
});
test("SanitizeSpills rejects zero, negative, and mismatched child offsets", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.datatype = "f";
  anchor.formula = "SORT(A1:A2,1,1)";
  anchor.spillrows = 2;
  anchor.spillcols = 1;
  for (const [coord, row, col] of [
    ["C2", 0, 0],
    ["D2", -1, 0],
    ["C3", 1, 0],
    ["D3", 1, 0],
  ] as const) {
    const child = new SC.Cell(coord);
    child.spillowner = "C1";
    child.spillrow = row;
    child.spillcol = col;
    sheet.cells[coord] = child;
  }
  SC.SanitizeSpills(sheet);
  expect(sheet.cells.C2).toBeUndefined();
  expect(sheet.cells.D2).toBeUndefined();
  expect(sheet.cells.C3).toBeUndefined();
  expect(sheet.cells.D3).toBeUndefined();
});
