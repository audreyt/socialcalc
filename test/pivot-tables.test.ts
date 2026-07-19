import { expect, test } from "vite-plus/test";
import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

const PIVOT_ERROR =
  "Cannot change part of a pivot table output. Delete or refresh the pivot table instead.";

async function setup(commands: string[] = []) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  if (commands.length) await scheduleCommands(SC, sheet, commands);
  await recalcSheet(SC, sheet);
  return { SC, sheet };
}

function execute(SC: any, sheet: any, command: string, saveundo = true) {
  return SC.ExecuteSheetCommand(sheet, new SC.Parse(command), saveundo);
}

function defineCmd(anchor: string, def: unknown, SC: any) {
  return `definepivot ${anchor} ${SC.encodeForSave(JSON.stringify(def))}`;
}

// Small source table used by most tests:
// Region | Rep   | Units | Amount
// East   | Ann   | 10    | 100
// East   | Bob   |  5    |  50
// West   | Ann   |  3    |  30
// West   |       |  7    |  70   (blank Rep)
const SOURCE_COMMANDS = [
  "set A1 text t Region",
  "set B1 text t Rep",
  "set C1 text t Units",
  "set D1 text t Amount",
  "set A2 text t East",
  "set B2 text t Ann",
  "set C2 value n 10",
  "set D2 value n 100",
  "set A3 text t East",
  "set B3 text t Bob",
  "set C3 value n 5",
  "set D3 value n 50",
  "set A4 text t West",
  "set B4 text t Ann",
  "set C4 value n 3",
  "set D4 value n 30",
  "set A5 text t West",
  "set C5 value n 7",
  "set D5 value n 70",
];

async function withSource(extra: string[] = []) {
  return setup([...SOURCE_COMMANDS, ...extra]);
}

// --- 1. Aggregations ---------------------------------------------------------

test("sum/count/counta/average/min/max aggregate the expected values", async () => {
  const { SC, sheet } = await withSource();
  const defs: Array<[string, string]> = [
    ["sum", "F1"],
    ["count", "F5"],
    ["counta", "F9"],
    ["average", "F13"],
    ["min", "F17"],
    ["max", "F21"],
  ];
  for (const [agg, anchor] of defs) {
    execute(
      SC,
      sheet,
      defineCmd(
        anchor,
        {
          source: "A1:D5",
          rowFields: [],
          colFields: [],
          valueFields: [{ field: "Units", agg }],
        },
        SC,
      ),
    );
  }
  expect(sheet.cells.G2.datavalue).toBe(25); // sum(10,5,3,7)
  expect(sheet.cells.G6.datavalue).toBe(4); // count of numeric Units
  expect(sheet.cells.G10.datavalue).toBe(4); // counta of Units
  expect(sheet.cells.G14.datavalue).toBe(6.25); // average
  expect(sheet.cells.G18.datavalue).toBe(3); // min
  expect(sheet.cells.G22.datavalue).toBe(10); // max
});

test("average of zero numeric contributions is #DIV/0!", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t Region",
    "set B1 text t Units",
    "set A2 text t East",
    "set B2 text t n/a", // text, not numeric
  ]);
  execute(
    SC,
    sheet,
    defineCmd(
      "D1",
      {
        source: "A1:B2",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Units", agg: "average" }],
      },
      SC,
    ),
  );
  expect(sheet.cells.E2.valuetype).toBe("e");
  expect(sheet.cells.E2.datavalue).toBe("#DIV/0!");
});

// --- 2. Multi row/col fields, blanks/text/errors, stable ordering ----------

test("multiple row and column fields group and order deterministically, blanks sort last", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region", "Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        showSubtotals: false,
      },
      SC,
    ),
  );
  // Row order: East group (Ann, Bob) sorted, then West group (Ann, then blank last).
  expect(sheet.cells.F1.datavalue).toBe("Region");
  expect(sheet.cells.G1.datavalue).toBe("Rep");
  expect(sheet.cells.F2.datavalue).toBe("East");
  expect(sheet.cells.G2.datavalue).toBe("Ann");
  expect(sheet.cells.H2.datavalue).toBe(100);
  expect(sheet.cells.F3.datavalue).toBe("East");
  expect(sheet.cells.G3.datavalue).toBe("Bob");
  expect(sheet.cells.H3.datavalue).toBe(50);
  expect(sheet.cells.F4.datavalue).toBe("West");
  expect(sheet.cells.G4.datavalue).toBe("Ann");
  expect(sheet.cells.H4.datavalue).toBe(30);
  expect(sheet.cells.F5.datavalue).toBe("West");
  expect(sheet.cells.G5.datavalue).toBe("(blank)");
  expect(sheet.cells.H5.datavalue).toBe(70);
});

test("deeper row-field levels sort correctly even when the source presents them out of order", async () => {
  // Regression: the group comparator must apply EACH field level's typed
  // rank/same-type comparison in turn, only falling back to source-row
  // order once every level ties — not decide the whole ordering from the
  // first level's insertion position. Bob appears in the source before Ann
  // within the same East group; Ann must still sort first.
  const { SC, sheet } = await setup([
    "set A1 text t Region",
    "set B1 text t Rep",
    "set C1 text t Amount",
    "set A2 text t East",
    "set B2 text t Bob",
    "set C2 value n 1",
    "set A3 text t East",
    "set B3 text t Ann",
    "set C3 value n 2",
  ]);
  execute(
    SC,
    sheet,
    defineCmd(
      "E1",
      {
        source: "A1:C3",
        rowFields: ["Region", "Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        showSubtotals: false,
      },
      SC,
    ),
  );
  expect(sheet.cells.E2.datavalue).toBe("East");
  expect(sheet.cells.F2.datavalue).toBe("Ann");
  expect(sheet.cells.G2.datavalue).toBe(2);
  expect(sheet.cells.E3.datavalue).toBe("East");
  expect(sheet.cells.F3.datavalue).toBe("Bob");
  expect(sheet.cells.G3.datavalue).toBe(1);
});

test("column fields split aggregates into per-group columns", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: ["Rep"],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  // Column groups sorted: Ann, Bob, (blank).
  expect(sheet.cells.G1.datavalue).toBe("Ann");
  expect(sheet.cells.H1.datavalue).toBe("Bob");
  expect(sheet.cells.I1.datavalue).toBe("(blank)");
  expect(sheet.cells.F2.datavalue).toBe("East");
  expect(sheet.cells.G2.datavalue).toBe(100); // East/Ann
  expect(sheet.cells.H2.datavalue).toBe(50); // East/Bob
  expect(sheet.cells.I2.datavalue).toBe(0); // East/(blank) - none
  expect(sheet.cells.F3.datavalue).toBe("West");
  expect(sheet.cells.G3.datavalue).toBe(30); // West/Ann
  expect(sheet.cells.I3.datavalue).toBe(70); // West/(blank)
});

test("error-typed source cells classify as errors, excluded from numeric aggregates", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t Region",
    "set B1 text t Amount",
    "set A2 text t East",
    "set B2 formula 1/0",
    "set A3 text t East",
    "set B3 value n 5",
  ]);
  execute(
    SC,
    sheet,
    defineCmd(
      "D1",
      {
        source: "A1:B3",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(sheet.cells.D2.datavalue).toBe("East");
  expect(sheet.cells.E2.datavalue).toBe(5); // error cell excluded from SUM
});

// --- 3. Filters and totals --------------------------------------------------

test("exact-value filters restrict which source rows are grouped", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        filters: [{ field: "Region", values: ["East"] }],
      },
      SC,
    ),
  );
  expect(sheet.cells.F1.datavalue).toBe("Rep");
  expect(sheet.cells.F2.datavalue).toBe("Ann");
  expect(sheet.cells.G2.datavalue).toBe(100);
  expect(sheet.cells.F3.datavalue).toBe("Bob");
  expect(sheet.cells.G3.datavalue).toBe(50);
  expect(sheet.cells.F4).toBeUndefined(); // West rows filtered out entirely
});

test("subtotal and grand total rows/columns are emitted when requested", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region", "Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        showSubtotals: true,
        showColTotals: true,
        showRowTotals: true,
      },
      SC,
    ),
  );
  // East subtotal row after East/Ann, East/Bob.
  expect(sheet.cells.F4.datavalue).toBe("East Total");
  expect(sheet.cells.H4.datavalue).toBe(150);
  // West subtotal row after West/Ann, West/(blank).
  expect(sheet.cells.F7.datavalue).toBe("West Total");
  expect(sheet.cells.H7.datavalue).toBe(100);
  // Grand total row is last.
  const lastRow = sheet.pivots?.F1 ? sheet.cells.F1.pivotrows : 0;
  expect(lastRow).toBeGreaterThan(0);
  const grandRowCoord = SC.crToCoord(SC.coordToCr("F1").col, SC.coordToCr("F1").row + lastRow - 1);
  expect(sheet.cells[grandRowCoord].datavalue).toBe("Grand Total");
});

// --- 4. Collision / ownership / mutation guard ------------------------------

test("pivot output cells reject direct edits and block collisions", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(sheet.cells.G2?.pivotowner).toBe("F1");
  expect(execute(SC, sheet, "set G2 value n 999")).toBe(PIVOT_ERROR);
  expect(execute(SC, sheet, "erase F1:G3 all")).toBe(PIVOT_ERROR);

  // Defining a second pivot whose output collides with existing user content fails.
  execute(SC, sheet, "set K1 value n 1"); // pre-existing content in the non-anchor part of the output rectangle
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "J1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toContain("#PIVOT!"); // definepivot stores the definition but surfaces the materialization failure
  expect(sheet.cells.J1.valuetype).toBe("e");
  expect(sheet.cells.J1.datavalue).toBe("#PIVOT!");
});

// --- 5. Refresh on recalc / explicit command --------------------------------

test("editing source cells refreshes the pivot on recalc", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  expect(sheet.cells.G2.datavalue).toBe(150); // East total

  await scheduleCommands(SC, sheet, ["set D2 value n 500"]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.G2.datavalue).toBe(550); // East total after edit
});

test("explicit refreshpivot recomputes without waiting for a broader recalc", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  sheet.cells.D2.datavalue = 999; // bypass command path directly
  expect(execute(SC, sheet, "refreshpivot F1")).toBe("");
  expect(sheet.cells.G2.datavalue).toBe(1049);
});

// --- 6. Stale cleanup on shrink / structural changes ------------------------

test("shrinking group count clears stale trailing output cells", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  const before = sheet.cells.F1.pivotrows;
  expect(before).toBeGreaterThanOrEqual(3); // Ann, Bob, (blank) header + rows

  // Collapse to one Rep group only ("Ann") by filtering.
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        filters: [{ field: "Rep", values: ["Ann"] }],
      },
      SC,
    ),
  );
  expect(sheet.cells.F1.pivotrows).toBe(2); // header + one Ann row
  expect(sheet.cells.F3).toBeUndefined(); // stale Bob/(blank) rows removed
  expect(sheet.cells.F4).toBeUndefined();
});

test("insertrow above the pivot output shifts the anchor and source range", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  await scheduleCommands(SC, sheet, ["insertrow 1"]);
  await recalcSheet(SC, sheet);
  expect(sheet.pivots.F1).toBeUndefined();
  expect(sheet.pivots.F2).toBeDefined();
  expect(sheet.pivots.F2.source).toBe("A2:D6");
  expect(sheet.cells.G3.datavalue).toBe(150); // shifted East total
});

test("deletecol through the pivot output clears the pivot cleanly", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  await scheduleCommands(SC, sheet, ["deletecol F"]);
  await recalcSheet(SC, sheet);
  // ClearAllDerivedPivots ran before the shift; pivot output cells are gone.
  expect(sheet.cells.F1?.pivotowner).toBeUndefined();
});

test("deleterow above the pivot output shifts (not clears) the surviving anchor and source", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t Filler",
    "set A2 text t Region",
    "set B2 text t Amount",
    "set A3 text t East",
    "set B3 value n 100",
    "set A4 text t West",
    "set B4 value n 30",
  ]);
  execute(
    SC,
    sheet,
    defineCmd(
      "F2",
      {
        source: "A2:B4",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  expect(sheet.cells.G3.datavalue).toBe(100);
  // Deleting the unrelated filler row 1 shifts every coordinate up by one;
  // the pivot's own anchor and source range are neither inside the deleted
  // row nor pushed off the sheet, so the pivot survives with adjusted
  // coordinates instead of being cleared as a #REF! casualty.
  await scheduleCommands(SC, sheet, ["deleterow 1"]);
  await recalcSheet(SC, sheet);
  expect(sheet.pivots.F2).toBeUndefined();
  expect(sheet.pivots.F1).toBeDefined();
  expect(sheet.pivots.F1.source).toBe("A1:B3");
  expect(sheet.cells.G2.datavalue).toBe(100);
});

// --- 7. Save/load persistence -----------------------------------------------

test("save/load round-trips the pivot definition and re-derives output on sanitize", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  const saved = sheet.CreateSheetSave();
  expect(saved).toContain("pivot:F1:");

  const sheet2 = new SC.Sheet();
  sheet2.ParseSheetSave(saved);
  expect(sheet2.pivots.F1).toBeDefined();
  expect(sheet2.pivots.F1.source).toBe("A1:D5");
  expect(sheet2.cells.G2?.pivotowner).toBe("F1");
  expect(sheet2.cells.G2?.datavalue).toBe(150);
});

test("range/clipboard save strips pivot ownership metadata from copied cells", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  const clip = sheet.CreateSheetSave("F1:H3", true);
  expect(clip).not.toContain("pivotowner");
  expect(clip).not.toContain("\npivot:");
});

test("SanitizePivots drops a structurally invalid stored definition and orphaned owned cells", async () => {
  const { SC, sheet } = await withSource();
  sheet.pivots = { F1: { source: "A1:D5", rowFields: [], colFields: [], valueFields: [] } }; // invalid: no valueFields
  sheet.cells.G1 = new SC.Cell("G1");
  sheet.cells.G1.pivotowner = "F1";
  sheet.cells.G1.pivotrow = 0;
  sheet.cells.G1.pivotcol = 1;
  SC.Pivot.SanitizePivots(sheet);
  expect(sheet.pivots.F1).toBeUndefined();
  expect(sheet.cells.G1.pivotowner).toBeUndefined();
});

// --- 8. Undo/redo ------------------------------------------------------------

test("deletepivot is undoable and redoable", async () => {
  const { SC, sheet } = await withSource();
  await scheduleCommands(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  expect(sheet.pivots.F1).toBeDefined();

  await scheduleCommands(SC, sheet, ["deletepivot F1"]);
  await recalcSheet(SC, sheet);
  expect(sheet.pivots.F1).toBeUndefined();
  expect(sheet.cells.G2?.pivotowner).toBeUndefined();

  await sheetUndo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.pivots.F1).toBeDefined();
  expect(sheet.cells.G2?.datavalue).toBe(150);

  await sheetRedo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.pivots.F1).toBeUndefined();
});

test("definepivot redefinition is undoable back to the prior definition", async () => {
  const { SC, sheet } = await withSource();
  await scheduleCommands(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  expect(sheet.cells.G2.datavalue).toBe(150);

  await scheduleCommands(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  expect(sheet.cells.F2.datavalue).toBe("Ann");

  await sheetUndo(SC, sheet);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.F2.datavalue).toBe("East");
  expect(sheet.cells.G2.datavalue).toBe(150);
});

// --- 9. Validation / definition errors --------------------------------------

test("invalid pivot definitions are rejected with a descriptive error", async () => {
  const { SC, sheet } = await withSource();
  expect(
    execute(
      SC,
      sheet,
      defineCmd("F1", { source: "A1:A1", rowFields: [], colFields: [], valueFields: [] }, SC),
    ),
  ).toContain("header row");
  expect(
    execute(
      SC,
      sheet,
      defineCmd("F1", { source: "A1:D5", rowFields: [], colFields: [], valueFields: [] }, SC),
    ),
  ).toContain("valueFields");
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: ["NoSuchField"],
          colFields: [],
          valueFields: [{ field: "Amount", agg: "sum" }],
        },
        SC,
      ),
    ),
  ).toContain("Unknown pivot field");
});

test("definepivot rejects a structurally invalid anchor coordinate, a missing definition, and malformed JSON", async () => {
  const { SC, sheet } = await withSource();
  const badAnchor = execute(
    SC,
    sheet,
    defineCmd(
      "not-a-coord!!",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(badAnchor).toContain("Invalid pivot table anchor");
  expect(sheet.pivots["not-a-coord!!"]).toBeUndefined();

  expect(execute(SC, sheet, "definepivot F1")).toBe("Missing pivot table definition");
  expect(execute(SC, sheet, "definepivot F1 not-valid-json")).toBe(
    "Invalid pivot table definition JSON",
  );
});

test("output rectangle exceeding sheet bounds fails cleanly without partial writes", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t Region",
    "set B1 text t Amount",
    "set A2 text t East",
    "set B2 value n 1",
  ]);
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "ZZ65536",
      {
        source: "A1:B2",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toContain("#PIVOT!");
  expect(sheet.cells.ZZ65536.valuetype).toBe("e");
  expect(sheet.cells.ZZ65536.datavalue).toBe("#PIVOT!");
});

// --- 10. Coverage: cell-level type coercion, invalid ranges, multi-value labels, errors ---

test("numeric aggregation coerces a string-valued numeric datavalue via parseFloat", async () => {
  const { SC, sheet } = await setup();
  // Loaded cells (unlike command-set ones) can carry valuetype "n" with a
  // string datavalue, exercising the `typeof cell.datavalue === "number" ?
  // ... : parseFloat(...)` fallback in BuildTable's aggregate() closure.
  sheet.ParseSheetSave(
    [
      "version:1.5",
      "cell:A1:t:Region",
      "cell:B1:t:Amount",
      "cell:A2:t:East",
      "cell:B2:vt:n:7.5",
      "sheet:c:2:r:2",
      "",
    ].join("\n"),
  );
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "D1",
      {
        source: "A1:B2",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toBe("");
  expect(sheet.cells.E2.datavalue).toBe(7.5);
});

test("CellTypeChar falls back to blank when a loaded cell's valuetype is empty", async () => {
  const { SC, sheet } = await setup();
  sheet.ParseSheetSave(
    [
      "version:1.5",
      "cell:A1:t:Region",
      "cell:B1:t:Amount",
      "cell:A2:vt::hi", // empty valuetype token
      "cell:B2:v:5",
      "sheet:c:2:r:2",
      "",
    ].join("\n"),
  );
  expect(SC.Pivot.CellTypeChar(sheet, "A2")).toBe("b");
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "D1",
      {
        source: "A1:B2",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toBe("");
  expect(sheet.cells.D2.datavalue).toBe("(blank)");
});

test("numeric group key handles a falsy zero datavalue and error group key handles empty error text", async () => {
  const { SC, sheet } = await setup();
  sheet.ParseSheetSave(
    ["version:1.5", "cell:A1:v:0", "cell:A2:vt:e:", "sheet:c:1:r:2", ""].join("\n"),
  );
  expect(SC.Pivot.GroupKeyFor(sheet, "A1")).toMatchObject({ type: "n", sortValue: 0, label: "0" });
  expect(SC.Pivot.GroupKeyFor(sheet, "A2")).toMatchObject({ type: "e", sortValue: "#VALUE!" });
});

test("error-valued group key groups under the cell's error text, error contributes to COUNTA not COUNT", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t Region",
    "set B1 text t Amount",
    "set A2 formula 1/0", // -> errors: "#DIV/0!", becomes the row group key
    "set A3 text t East",
    "set B3 value n 5",
  ]);
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "D1",
      {
        source: "A1:B3",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "counta" }],
      },
      SC,
    ),
  );
  expect(err).toBe("");
  // Row groups sort East (rank text) before the #DIV/0! group (rank error).
  expect(sheet.cells.D2.datavalue).toBe("East");
  expect(sheet.cells.D3.datavalue).toBe("#DIV/0!");
  expect(sheet.cells.E3.datavalue).toBe(0); // no Amount in the error row -> counta 0
});

test("multiple value fields label each output column with the aggregation and field name", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [
          { field: "Amount", agg: "sum" },
          { field: "Units", agg: "count" },
        ],
      },
      SC,
    ),
  );
  expect(sheet.cells.G1.datavalue).toBe("Sum of Amount");
  expect(sheet.cells.H1.datavalue).toBe("Count of Units");
});

test("multiple value fields with an explicit label use that label instead of the default", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [
          { field: "Amount", agg: "sum", label: "Total $" },
          { field: "Units", agg: "count" },
        ],
      },
      SC,
    ),
  );
  expect(sheet.cells.G1.datavalue).toBe("Total $");
});

test("column-grouped multi-value-field headers combine the group label and value label", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: ["Region"],
        valueFields: [
          { field: "Amount", agg: "sum" },
          { field: "Units", agg: "count" },
        ],
      },
      SC,
    ),
  );
  expect(sheet.cells.G1.datavalue).toBe("East | Sum of Amount");
  expect(sheet.cells.H1.datavalue).toBe("East | Count of Units");
  expect(sheet.cells.I1.datavalue).toBe("West | Sum of Amount");
});

test("row totals column labels a multi-value-field pivot with the 'Total | ...' prefix", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [
          { field: "Amount", agg: "sum" },
          { field: "Units", agg: "count" },
        ],
        showRowTotals: true,
      },
      SC,
    ),
  );
  expect(sheet.cells.I1.datavalue).toBe("Total | Sum of Amount");
  expect(sheet.cells.J1.datavalue).toBe("Total | Count of Units");
});

test("RefreshPivot reports a missing pivot table by anchor", async () => {
  const { SC, sheet } = await withSource();
  expect(SC.Pivot.RefreshPivot(sheet, "Z9")).toBe("No such pivot table: Z9");
});

test("a merged-cell target inside the output rectangle blocks materialization as a collision", async () => {
  const { SC, sheet } = await withSource();
  execute(SC, sheet, "set G2 value n 1");
  execute(SC, sheet, "set H2 value n 2");
  execute(SC, sheet, "merge G2:H2");
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toContain("#PIVOT! (output collides with existing content)");
});

test("BuildTable and ValidateDefinition reject an unparseable source range and a single-row range", async () => {
  const { SC, sheet } = await setup(["set A1 text t Region"]);
  // The command path (RefreshPivot calls ValidateDefinition, which runs
  // the same header-row check, before BuildTable) never reaches these
  // BuildTable-internal branches directly, so exercise them via a direct
  // call.
  const badRange = SC.Pivot.BuildTable(sheet, {
    source: "not a range!!",
    rowFields: [],
    colFields: [],
    valueFields: [{ field: "Region", agg: "count" }],
  });
  expect(badRange.error).toBeDefined();
  const singleRow = SC.Pivot.BuildTable(sheet, {
    source: "A1:A1",
    rowFields: [],
    colFields: [],
    valueFields: [{ field: "Region", agg: "count" }],
  });
  expect(singleRow.error).toContain("header row");
});

test("ValidateDefinition rejects malformed filters entries and non-array filters", async () => {
  const { SC, sheet } = await withSource();
  const badFilterField = execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        filters: [{ values: ["East"] }],
      },
      SC,
    ),
  );
  expect(badFilterField).toContain("filters entries need a field");

  const badFilterArray = execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        filters: "not-an-array",
      },
      SC,
    ),
  );
  expect(badFilterArray).toContain("filters must be an array");
});

test("ValidateDefinition rejects non-array/non-string rowFields and colFields entries", async () => {
  const { SC, sheet } = await withSource();
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: "not-an-array",
          colFields: [],
          valueFields: [{ field: "Amount", agg: "sum" }],
        },
        SC,
      ),
    ),
  ).toContain("rowFields must be an array");
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: [],
          colFields: "not-an-array",
          valueFields: [{ field: "Amount", agg: "sum" }],
        },
        SC,
      ),
    ),
  ).toContain("colFields must be an array");
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: [42],
          colFields: [],
          valueFields: [{ field: "Amount", agg: "sum" }],
        },
        SC,
      ),
    ),
  ).toContain("rowFields must contain field names");
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: [],
          colFields: [42],
          valueFields: [{ field: "Amount", agg: "sum" }],
        },
        SC,
      ),
    ),
  ).toContain("colFields must contain field names");
});

test("ValidateDefinition rejects a falsy value-field entry", async () => {
  const { SC, sheet } = await withSource();
  expect(
    execute(
      SC,
      sheet,
      defineCmd("F1", { source: "A1:D5", rowFields: [], colFields: [], valueFields: [null] }, SC),
    ),
  ).toContain("valueFields entries need a field and a valid aggregation");
});

test("BuildTable reports an unknown value-field name distinctly from row/col field errors", async () => {
  const { SC, sheet } = await withSource();
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: [],
          colFields: [],
          valueFields: [{ field: "NoSuchField", agg: "sum" }],
        },
        SC,
      ),
    ),
  ).toBe("Unknown pivot field: NoSuchField");
});
test("grouping by a numeric row field uses the cell's numeric datavalue directly", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Units"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  // F1 is the "Units" header; data rows sort by numeric value: 3, 5, 7, 10.
  expect(sheet.cells.F2.datavalue).toBe(3);
  expect(sheet.cells.F3.datavalue).toBe(5);
  expect(sheet.cells.F4.datavalue).toBe(7);
  expect(sheet.cells.F5.datavalue).toBe(10);
});

test("SanitizePivots drops a pivot definition with a structurally invalid anchor coordinate", async () => {
  const { SC, sheet } = await withSource();
  sheet.pivots = {
    "not-a-real-coord!!": {
      source: "A1:D5",
      rowFields: [],
      colFields: [],
      valueFields: [{ field: "Amount", agg: "sum" }],
    },
  };
  SC.Pivot.SanitizePivots(sheet);
  expect(sheet.pivots["not-a-real-coord!!"]).toBeUndefined();
});

test("PivotOwnerForCoord returns the coord itself when unowned, and the owner when owned", async () => {
  const { SC, sheet } = await withSource();
  expect(SC.Pivot.PivotOwnerForCoord(sheet, "A1")).toBe("A1");
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(SC.Pivot.PivotOwnerForCoord(sheet, "G2")).toBe("F1");
});

test("ValidateDefinition distinguishes a non-object definition from a missing source", async () => {
  const { SC, sheet } = await withSource();
  expect(execute(SC, sheet, defineCmd("F1", null, SC))).toBe("Missing pivot table definition");
  expect(execute(SC, sheet, defineCmd("F1", "not-an-object", SC))).toBe(
    "Missing pivot table definition",
  );
  expect(execute(SC, sheet, defineCmd("F1", {}, SC))).toBe("Missing pivot source range");
  expect(execute(SC, sheet, defineCmd("F1", { source: "" }, SC))).toBe(
    "Missing pivot source range",
  );
});

test("BuildTable disambiguates duplicate header names with the column letter suffix", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t X",
    "set B1 text t X",
    "set A2 value n 1",
    "set B2 value n 2",
  ]);
  const built = SC.Pivot.BuildTable(sheet, {
    source: "A1:B2",
    rowFields: [],
    colFields: [],
    valueFields: [{ field: "X", agg: "sum" }],
  });
  expect(built.headers).toEqual(["X", "X_B"]);
  expect(built.headerCol.X).toBe(1);
  expect(built.headerCol.X_B).toBe(2);
});

test("BuildTable rejects an unknown colFields entry and an unknown filters entry", async () => {
  const { SC, sheet } = await withSource();
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: [],
          colFields: ["NoSuchField"],
          valueFields: [{ field: "Amount", agg: "sum" }],
        },
        SC,
      ),
    ),
  ).toBe("Unknown pivot field: NoSuchField");
  expect(
    execute(
      SC,
      sheet,
      defineCmd(
        "F1",
        {
          source: "A1:D5",
          rowFields: [],
          colFields: [],
          valueFields: [{ field: "Amount", agg: "sum" }],
          filters: [{ field: "NoSuchField", values: ["x"] }],
        },
        SC,
      ),
    ),
  ).toBe("Unknown pivot field: NoSuchField");
});

test("MAX aggregation seeds on first contribution and only grows", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "max" }],
      },
      SC,
    ),
  );
  expect(sheet.cells.G2.datavalue).toBe(100); // max(100,50,30,70)
});

test("RefreshPivot re-validates a stored definition and fails if it is now invalid", async () => {
  const { SC, sheet } = await withSource();
  sheet.pivots = {
    F1: { source: "A1:D5", rowFields: [], colFields: [], valueFields: [] }, // invalid: empty valueFields
  };
  expect(SC.Pivot.RefreshPivot(sheet, "F1")).toBe("valueFields must be a non-empty array");
});

test("RefreshAllPivots is a no-op on a sheet with no pivots", async () => {
  const { SC, sheet } = await withSource();
  expect(() => SC.Pivot.RefreshAllPivots(sheet)).not.toThrow();
});

test("ClearPivot preserves foreign content occupying a hole inside the pivot's own footprint", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  // Replace an owned child with unrelated user content directly (simulates
  // a save/load or external mutation leaving a footprint hole).
  sheet.cells.G2 = new SC.Cell("G2");
  sheet.cells.G2.datavalue = 999;
  expect(SC.Pivot.ClearPivot(sheet, "F1")).toBe(true);
  expect(sheet.cells.G2.datavalue).toBe(999);
  expect(sheet.cells.G2.pivotowner).toBeUndefined();
});

test("refreshpivotall command refreshes every registered pivot table", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  execute(SC, sheet, "set D2 value n 999"); // mutate source; pivot output is stale until refreshed
  execute(SC, sheet, "refreshpivotall");
  expect(sheet.cells.G2.datavalue).toBe(999 + 50); // East: Ann 999 + Bob 50
});

test("definepivot at an anchor already owned by another pivot's output cell is rejected", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region", "Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  // G2 is an owned child cell of the F1 pivot; defining a second pivot
  // anchored there must be rejected rather than silently stealing it.
  expect(sheet.cells.G2.pivotowner).toBe("F1");
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "G2",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toBe(PIVOT_ERROR);
});

test("a mutation range covering a pivot output child cell is rejected with the pivot command error", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  // G2 is an owned pivot child cell; a raw mutation range covering it must
  // be rejected up front (mirrors the equivalent spillowner guard).
  expect(SC.PrepareSpillMutation(sheet, ["G2:G2"], false)).toBe(SC.Pivot.CommandError);
  expect(sheet.cells.G2.pivotowner).toBe("F1"); // rejected before any mutation, so unchanged
});

test("a non-blocking mutation range covering a pivot anchor clears that pivot table first", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  // `set` uses blockAnchors=false: a mutation range covering the pivot's
  // own anchor cell clears the pivot definition and its output rather than
  // rejecting the command outright (mirrors the equivalent spill anchor
  // auto-clear behavior).
  expect(sheet.pivots.F1).toBeDefined();
  const err = execute(SC, sheet, "set F1 text t overwritten");
  expect(err).toBe("");
  expect(sheet.pivots.F1).toBeUndefined();
  expect(sheet.cells.G2).toBeUndefined(); // pivot output child fully removed by ClearPivot
  expect(sheet.cells.F1.datavalue).toBe("overwritten");
});

test("editor refuses to open or save edits on pivot output child cells", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(sheet.cells.G2?.pivotowner).toBe("F1");
  expect(sheet.cells.G2?.datavalue).toBe(150);

  const scheduled: string[] = [];
  const editor: any = {
    context: { sheetobj: sheet },
    ecell: { coord: "G2", row: 2, col: 7 },
    inputBox: {
      element: { disabled: false },
      ShowInputBox: () => undefined,
      GetText: () => "999",
      DisplayCellContents: () => undefined,
    },
    workingvalues: { ecoord: "G2" },
    cellhandles: { ShowCellHandles: () => undefined },
    EditorScheduleSheetCommands: (command: string) => scheduled.push(command),
  };

  expect(SC.EditorOpenCellEdit(editor)).toBe(true);
  SC.EditorSaveEdit(editor, "999");
  expect(scheduled).toEqual([]);
  expect(editor.state).toBe("start");
  expect(sheet.cells.G2.datavalue).toBe(150); // unchanged
});

test("insertrow and deletecol tolerate a sheet where sheet.pivots was never initialized", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  // `set ...` commands route through PrepareSpillMutation, and
  // ParseSheetSave routes through SanitizePivots -- both lazily init
  // `sheet.pivots = {}` as a side effect. Delete it immediately after load
  // so the structural-shift `if (sheet.pivots)` guards genuinely see the
  // uninitialized (never-touched-a-pivot-API) state this test targets.
  sheet.ParseSheetSave(
    ["version:1.5", "cell:A1:v:1", "cell:A2:v:2", "sheet:c:1:r:2", ""].join("\n"),
  );
  delete sheet.pivots;
  expect(sheet.pivots).toBeUndefined();
  await scheduleCommands(SC, sheet, ["insertrow 1"]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A3.datavalue).toBe(2);
  await scheduleCommands(SC, sheet, ["deletecol A"]);
  await recalcSheet(SC, sheet);
  expect(sheet.cells.A1).toBeUndefined();
});

test("definepivot initializes sheet.pivots on a sheet where it was never set", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  sheet.ParseSheetSave(
    [
      "version:1.5",
      "cell:A1:t:Region",
      "cell:B1:t:Amount",
      "cell:A2:t:East",
      "cell:B2:v:1",
      "sheet:c:2:r:2",
      "",
    ].join("\n"),
  );
  delete sheet.pivots; // never touched via any pivot API
  expect(sheet.pivots).toBeUndefined();
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "D1",
      {
        source: "A1:B2",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toBe("");
  expect(sheet.pivots.D1).toBeDefined();
});

test("deletepivot is a no-op on a sheet where sheet.pivots was never initialized", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  sheet.ParseSheetSave(["version:1.5", "cell:A1:v:1", "sheet:c:1:r:1", ""].join("\n"));
  delete sheet.pivots;
  expect(sheet.pivots).toBeUndefined();
  expect(execute(SC, sheet, "deletepivot D1")).toBe("");
});

test("deletepivot for an anchor whose cell was never created leaves nothing to reset", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  // Drop the anchor cell entirely (simulates a stored definition whose
  // anchor coordinate has no materialized cell -- e.g. cleared/never
  // recalced) so `deletepivot`'s `if (cell)` reset guard sees `undefined`.
  delete sheet.cells.F1;
  expect(sheet.pivots.F1).toBeDefined();
  expect(execute(SC, sheet, "deletepivot F1")).toBe("");
  expect(sheet.pivots.F1).toBeUndefined();
  expect(sheet.cells.F1).toBeUndefined();
});

test("merge over a pivot anchor cell is rejected outright (blockAnchors=true does not auto-clear)", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: [],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(sheet.cells.F1.pivotrows).toBeGreaterThan(0);
  // `merge` passes blockAnchors=true, so touching a pivot ANCHOR cell (not
  // just an owned child) must be rejected rather than silently clearing
  // the pivot the way a plain `set`/blockAnchors=false mutation would.
  const err = execute(SC, sheet, "merge F1:G1");
  expect(err).toBe(PIVOT_ERROR);
  expect(sheet.pivots.F1).toBeDefined(); // pivot untouched
  expect(sheet.cells.F1.colspan).toBeUndefined(); // merge did not apply
});

test("RefreshPivot's stale-cleanup tolerates a trailing footprint cell that is already gone", async () => {
  const { SC, sheet } = await withSource();
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  await recalcSheet(SC, sheet);
  const before = sheet.cells.F1.pivotrows;
  expect(before).toBeGreaterThanOrEqual(3); // Ann, Bob, (blank) header + rows
  // Directly remove one trailing output cell (simulates it having already
  // been cleaned up by some other path -- e.g. a prior partial refresh) so
  // the stale-cleanup loop's `sheet.cells[coord]` lookup on the next
  // shrinking refresh returns undefined for that position instead of an
  // owned cell.
  delete sheet.cells.F3;
  execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
        filters: [{ field: "Rep", values: ["Ann"] }],
      },
      SC,
    ),
  );
  expect(sheet.cells.F1.pivotrows).toBe(2); // header + one Ann row
  expect(sheet.cells.F3).toBeUndefined();
  expect(sheet.cells.F4).toBeUndefined();
});

test("refreshpivotall is a no-op on a sheet where sheet.pivots was never initialized", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  sheet.ParseSheetSave(["version:1.5", "cell:A1:v:1", "sheet:c:1:r:1", ""].join("\n"));
  delete sheet.pivots;
  expect(sheet.pivots).toBeUndefined();
  expect(execute(SC, sheet, "refreshpivotall")).toBe("");
});

test("a blank or missing header cell falls back to the column's spreadsheet letter name", async () => {
  const { SC, sheet } = await setup([
    "set A1 text t Region",
    // B1 left entirely blank -- BuildTable must still produce a usable
    // field name for it instead of an empty/undefined key.
    "set A2 text t East",
    "set B2 value n 10",
  ]);
  const built = SC.Pivot.BuildTable(sheet, {
    source: "A1:B2",
    rowFields: [],
    colFields: [],
    valueFields: [{ field: "B", agg: "sum" }],
  });
  expect(built.error).toBeUndefined();
  expect(built.headers).toEqual(["Region", "B"]);
  expect(built.headerCol.B).toBe(2);
});

test("filtering out every source row still renders a Grand Total row through a synthetic empty group", async () => {
  const { SC, sheet } = await withSource();
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region"],
        colFields: ["Rep"],
        valueFields: [{ field: "Amount", agg: "sum" }],
        showColTotals: true,
        filters: [{ field: "Region", values: ["Nonexistent"] }],
      },
      SC,
    ),
  );
  expect(err).toBe("");
  // No source row matches the filter, so both rowGroups and colGroups
  // (grouped from the same empty dataRows) are empty; the per-row-group
  // loop never runs, but showColTotals always emits one "Grand Total"
  // row, and BuildTable's colGroups.length===0 fallback synthesizes a
  // single blank group so that row still has a value column to render
  // into instead of an empty grid.
  expect(sheet.cells.F1.pivotrows).toBe(2); // header + Grand Total row
  expect(sheet.cells.F2.datavalue).toBe("Grand Total");
  expect(sheet.cells.G2.datavalue).toBe(0);
});

test("a vertically-merged cell (rowspan only, no colspan) inside the output rectangle blocks materialization as a collision", async () => {
  const { SC, sheet } = await withSource();
  execute(SC, sheet, "set G2 value n 1");
  execute(SC, sheet, "set G3 value n 2");
  execute(SC, sheet, "merge G2:G3"); // vertical-only merge: rowspan=2, no colspan
  const err = execute(
    SC,
    sheet,
    defineCmd(
      "F1",
      {
        source: "A1:D5",
        rowFields: ["Region", "Rep"],
        colFields: [],
        valueFields: [{ field: "Amount", agg: "sum" }],
      },
      SC,
    ),
  );
  expect(err).toContain("#PIVOT! (output collides with existing content)");
});
