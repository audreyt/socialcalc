import { expect, test } from "vite-plus/test";

import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

// ---------------------------------------------------------------------------
// This file closes the final observable coverage gaps left by prior workers,
// all inside FormulaMut.DynamicArrayFunctions/MaterializeArray (formula1.ts,
// ~L7315-7391) and SC.ClearSpill/MaterializeSpill (socialcalc-3.ts, ~L271-405).
// Every assertion is on end-to-end formula/spill behavior, never source text.
// ---------------------------------------------------------------------------

type Operand = { type: string; value: unknown };
type ArrayCell = { type: string; value: unknown };
type ArrayResult = { type: string; value: { rows: number; cols: number; cells: ArrayCell[][] } };

async function buildSheet(commands: string[]) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands, true, 4000);
  const evaluate = (formula: string): ArrayResult =>
    SC.Formula.evaluate_parsed_formula(
      SC.Formula.ParseFormulaIntoTokens(formula),
      sheet,
      true,
    ) as unknown as ArrayResult;
  return { SC, sheet, evaluate };
}

// ---------------------------------------------------------------------------
// 1. MaterializeArray: coord source is wrapped into a 1x1 range (L7318).
//    A bare coord reference to SORT/UNIQUE's TopOfStackValueAndType result
//    exercises the `value.type == "coord"` branch that synthesizes a range.
// ---------------------------------------------------------------------------

test("SORT/UNIQUE materialize a bare coord source as a 1x1 array (L7318)", async () => {
  const { evaluate } = await buildSheet(["set A1 value n 7"]);
  const sorted = evaluate("SORT(A1,1,1)");
  expect(sorted.type).toBe("array");
  expect(sorted.value).toMatchObject({ rows: 1, cols: 1 });
  expect(sorted.value.cells[0]![0]!.value).toBe(7);

  const unique = evaluate("UNIQUE(A1)");
  expect(unique.type).toBe("array");
  expect(unique.value.cells[0]![0]!.value).toBe(7);
});

// ---------------------------------------------------------------------------
// 2. MaterializeArray: neither coord nor range -> null -> DynamicArrayFunctions
//    fail() (L7319, L7337 statement+branch). A number/text literal top of
//    stack takes this path directly.
// ---------------------------------------------------------------------------

test("SORT/UNIQUE on a non-coord/non-range operand fail with e#VALUE! (L7319, L7337)", async () => {
  const { evaluate } = await buildSheet([]);
  expect(evaluate("SORT(1,1,1)").type).toBe("e#VALUE!");
  expect(evaluate("UNIQUE(1)").type).toBe("e#VALUE!");
  expect(evaluate('SORT("x",1,1)').type).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// 3. MaterializeArray: DecodeRangeParts returns null for an unresolvable
//    sheet reference -> array stays null (L7321, L7337 branch true side).
// ---------------------------------------------------------------------------

test("SORT/UNIQUE on a range referencing an uncached sheet fail with e#VALUE! (L7321)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const operand: Operand[] = [];
  const foperand: Operand[] = [{ type: "range", value: "NOPE!A1|A2|" }];
  SC.Formula.DynamicArrayFunctions("SORT", operand, foperand, sheet);
  expect(operand[0]?.type).toBe("e#VALUE!");

  const operand2: Operand[] = [];
  const foperand2: Operand[] = [{ type: "coord", value: "NOPE!A1" }];
  SC.Formula.DynamicArrayFunctions("UNIQUE", operand2, foperand2, sheet);
  expect(operand2[0]?.type).toBe("e#VALUE!");
});

// ---------------------------------------------------------------------------
// 4. UNIQUE: both optional args present and each independently rejected when
//    non-numeric (L7342-7343 statements + branches: `foperand.length` true
//    side taken for by_column, then again for exactly_once).
// ---------------------------------------------------------------------------

test("UNIQUE rejects a non-numeric by_column argument when both optional args are given (L7342)", async () => {
  const { evaluate } = await buildSheet(["set A1 value n 1", "set A2 value n 1"]);
  expect(evaluate('UNIQUE(A1:A2,"bad",1)').type).toBe("e#VALUE!");
});

test("UNIQUE rejects a non-numeric exactly_once argument when both optional args are given (L7343)", async () => {
  const { evaluate } = await buildSheet(["set A1 value n 1", "set A2 value n 1"]);
  expect(evaluate('UNIQUE(A1:A2,1,"bad")').type).toBe("e#VALUE!");
});

test("UNIQUE accepts numeric by_column and exactly_once together", async () => {
  const { evaluate } = await buildSheet([
    "set A1 value n 1",
    "set B1 value n 1",
    "set A2 value n 1",
    "set B2 value n 2",
  ]);
  const result = evaluate("UNIQUE(A1:B2,1,0)");
  expect(result.type).toBe("array");
  expect(result.value.cols).toBe(2);
});

// ---------------------------------------------------------------------------
// 5. SORT comparator: both operands are distinct error types (L7373-7374).
//    Formula-produced errors collapse to e#N/A inside a materialized array
//    (see existing "SORT comparator pins ..." test), so a distinct pairing
//    of error valuetypes must be constructed directly via `constant e#...`
//    cells, whose valuetype is read verbatim by MaterializeArray.
// ---------------------------------------------------------------------------

test("SORT comparator orders two distinct error types by type string regardless of physical layout (L7373 both-error branch)", async () => {
  const { evaluate } = await buildSheet([
    "set A1 constant e#REF! 0 #REF!",
    "set A2 constant e#DIV/0! 0 #DIV/0!",
    "set C1 constant e#DIV/0! 0 #DIV/0!",
    "set C2 constant e#REF! 0 #REF!",
  ]);
  // "e#DIV/0!" < "e#REF!" lexicographically, so ascending sort puts the
  // DIV/0! error first no matter which row it started in physically.
  const asc = evaluate("SORT(A1:A2,1,1)");
  expect(asc.value.cells.map((r) => r[0]!.type)).toEqual(["e#DIV/0!", "e#REF!"]);
  const desc = evaluate("SORT(A1:A2,1,0)");
  expect(desc.value.cells.map((r) => r[0]!.type)).toEqual(["e#REF!", "e#DIV/0!"]);
  // Physically-increasing layout (DIV/0! then REF!) exercises the mirror
  // `x.type > y.type` half of the same both-error ternary.
  const ascReversed = evaluate("SORT(C1:C2,1,1)");
  expect(ascReversed.value.cells.map((r) => r[0]!.type)).toEqual(["e#DIV/0!", "e#REF!"]);
});

test("SORT comparator treats equal error types as a tie broken by original index (L7373 equal-error branch)", async () => {
  const { evaluate } = await buildSheet([
    "set A1 constant e#REF! 0 #REF!",
    "set A2 constant e#REF! 0 #REF!",
  ]);
  const result = evaluate("SORT(A1:A2,1,1)");
  expect(result.value.cells.map((r) => r[0]!.type)).toEqual(["e#REF!", "e#REF!"]);
});

test("SORT comparator treats a one-sided error as greater regardless of position (L7374)", async () => {
  const { evaluate } = await buildSheet([
    "set A1 constant e#REF! 0 #REF!",
    "set A2 value n 1",
    "set B1 value n 1",
    "set B2 constant e#REF! 0 #REF!",
  ]);
  // error in row1, numeric in row2 -> error sorts last ascending.
  const left = evaluate("SORT(A1:A2,1,1)");
  expect(left.value.cells.map((r) => r[0]!.type)).toEqual(["n", "e#REF!"]);
  // numeric in row1, error in row2 -> error still sorts last ascending.
  const right = evaluate("SORT(B1:B2,1,1)");
  expect(right.value.cells.map((r) => r[0]!.type)).toEqual(["n", "e#REF!"]);
});

// ---------------------------------------------------------------------------
// 6. SORT comparator: text ordering (both directions) and a case-insensitive
//    tie that falls through to the stable index tiebreak (L7381).
// ---------------------------------------------------------------------------

test("SORT comparator treats case-insensitive-equal text as a tie preserving original order (L7381)", async () => {
  const { evaluate } = await buildSheet([
    "set A1 text t Apple",
    "set A2 text t apple",
    "set A3 text t APPLE",
  ]);
  const asc = evaluate("SORT(A1:A3,1,1)");
  expect(asc.value.cells.map((r) => r[0]!.value)).toEqual(["Apple", "apple", "APPLE"]);
  const desc = evaluate("SORT(A1:A3,1,0)");
  // Descending negates a nonzero result but a tie (0) is unaffected by sign
  // flip, so original relative order among ties is preserved either way.
  expect(desc.value.cells.map((r) => r[0]!.value)).toEqual(["Apple", "apple", "APPLE"]);
});

test("SORT comparator orders distinct-case text less/greater case-insensitively regardless of physical layout (L7381)", async () => {
  const { evaluate } = await buildSheet([
    "set A1 text t banana",
    "set A2 text t Apple",
    "set C1 text t Apple",
    "set C2 text t banana",
  ]);
  const asc = evaluate("SORT(A1:A2,1,1)");
  expect(asc.value.cells.map((r) => r[0]!.value)).toEqual(["Apple", "banana"]);
  const desc = evaluate("SORT(A1:A2,1,0)");
  expect(desc.value.cells.map((r) => r[0]!.value)).toEqual(["banana", "Apple"]);
  // Physically-increasing layout (Apple then banana) exercises the mirror
  // `xt > yt` half of the same text-comparison ternary.
  const ascReversed = evaluate("SORT(C1:C2,1,1)");
  expect(ascReversed.value.cells.map((r) => r[0]!.value)).toEqual(["Apple", "banana"]);
});

// ---------------------------------------------------------------------------
// 7. ClearSpill: reRenderCellList already contains the anchor coord -> the
//    `indexOf(...) < 0` push guard's false side (L287) is exercised, and the
//    true side (push runs) is covered by a fresh list.
// ---------------------------------------------------------------------------

test("ClearSpill skips re-adding an anchor already queued for rerender (L287 false side)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.spillrows = 2;
  anchor.spillcols = 1;
  const child = new SC.Cell("C2");
  child.spillowner = "C1";
  sheet.cells.C2 = child;
  sheet.reRenderCellList = ["C1"];
  const removed = SC.ClearSpill(sheet, anchor);
  expect(removed).toBe(true);
  // The coord was already present, so the list is untouched (no duplicate).
  expect(sheet.reRenderCellList).toEqual(["C1"]);
});

test("ClearSpill initializes a missing rerender list before pushing the anchor (L286 true side)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.spillrows = 2;
  anchor.spillcols = 1;
  const child = new SC.Cell("C2");
  child.spillowner = "C1";
  sheet.cells.C2 = child;
  expect(sheet.reRenderCellList).toBeUndefined();
  const removed = SC.ClearSpill(sheet, anchor);
  expect(removed).toBe(true);
  expect(sheet.reRenderCellList).toEqual(["C1"]);
});

test("ClearSpill appends the anchor to a rerender list that does not yet contain it (L287 true side)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.spillrows = 2;
  anchor.spillcols = 1;
  const child = new SC.Cell("C2");
  child.spillowner = "C1";
  sheet.cells.C2 = child;
  sheet.reRenderCellList = ["Z9"];
  const removed = SC.ClearSpill(sheet, anchor);
  expect(removed).toBe(true);
  expect(sheet.reRenderCellList).toEqual(["Z9", "C1"]);
});

// ---------------------------------------------------------------------------
// 8. MaterializeSpill validity: every malformed-shape short circuit and the
//    merged-rectangle intersection test on every coordinate axis.
// ---------------------------------------------------------------------------

test("MaterializeSpill rejects a non-array eresult and a null eresult (validity short-circuit)", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  expect(
    SC.MaterializeSpill(sheet, "C1", { type: "n", value: { rows: 1, cols: 1, cells: [] } }),
  ).toBeNull();
});

test("MaterializeSpill rejects non-integer, zero, and negative row/col counts", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const bad = (rows: number, cols: number, cells: ArrayCell[][]) =>
    SC.MaterializeSpill(sheet, "C1", { type: "array", value: { rows, cols, cells } });
  expect(bad(1.5, 1, [[{ type: "n", value: 1 }]])).toBeNull();
  expect(bad(1, 1.5, [[{ type: "n", value: 1 }]])).toBeNull();
  expect(bad(0, 1, [])).toBeNull();
  expect(bad(1, 0, [[]])).toBeNull();
  expect(bad(-1, 1, [])).toBeNull();
});

test("MaterializeSpill rejects a cells array whose length mismatches rows", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  expect(
    SC.MaterializeSpill(sheet, "C1", {
      type: "array",
      value: { rows: 2, cols: 1, cells: [[{ type: "n", value: 1 }]] },
    }),
  ).toBeNull();
});

test("MaterializeSpill rejects a row whose length mismatches cols, or a malformed cell entry", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  expect(
    SC.MaterializeSpill(sheet, "C1", {
      type: "array",
      value: { rows: 1, cols: 2, cells: [[{ type: "n", value: 1 }]] },
    }),
  ).toBeNull();
  expect(
    SC.MaterializeSpill(sheet, "C1", {
      // Malformed cell entry: not an object with a string `type`.
      type: "array",
      value: { rows: 1, cols: 1, cells: [[{ type: 5, value: 1 } as unknown as ArrayCell]] },
    }),
  ).toBeNull();
  expect(
    SC.MaterializeSpill(sheet, "C1", {
      // Cell object missing the `value` key entirely.
      type: "array",
      value: { rows: 1, cols: 1, cells: [[{ type: "n" } as unknown as ArrayCell]] },
    }),
  ).toBeNull();
});

test("MaterializeSpill rejects a shape rejected by PlanSpillStatus bounds", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  // 703 exceeds SPILL_MAX_COL (702), so PlanSpillStatus returns non-zero.
  const wideRow = Array.from({ length: 703 }, () => ({ type: "n", value: 0 }));
  expect(
    SC.MaterializeSpill(sheet, "A1", {
      type: "array",
      value: { rows: 1, cols: 703, cells: [wideRow] },
    }),
  ).toBeNull();
});

test("MaterializeSpill rejects a multi-cell result anchored on a merged cell", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.colspan = 2;
  expect(
    SC.MaterializeSpill(sheet, "C1", {
      type: "array",
      value: {
        rows: 1,
        cols: 2,
        cells: [
          [
            { type: "n", value: 1 },
            { type: "n", value: 2 },
          ],
        ],
      },
    }),
  ).toBeNull();
});

test("MaterializeSpill merged-rectangle collision fires when the merge straddles the left edge", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const array2x2 = {
    type: "array",
    value: {
      rows: 2,
      cols: 2,
      cells: [
        [
          { type: "n", value: 1 },
          { type: "n", value: 2 },
        ],
        [
          { type: "n", value: 3 },
          { type: "n", value: 4 },
        ],
      ],
    },
  };
  // B1 spans cols B..C (colspan 2); target rectangle is C1:D2, so B1's span
  // reaches into column C (a.col=2 < cr.col+cols=5, a.col+colspan=4 > cr.col=3).
  const bMerged = sheet.GetAssuredCell("B1");
  bMerged.colspan = 2;
  expect(SC.MaterializeSpill(sheet, "C1", array2x2)).toBeNull();
});

test("MaterializeSpill merged-rectangle collision fires when the merge straddles the top edge", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const array2x2 = {
    type: "array",
    value: {
      rows: 2,
      cols: 2,
      cells: [
        [
          { type: "n", value: 1 },
          { type: "n", value: 2 },
        ],
        [
          { type: "n", value: 3 },
          { type: "n", value: 4 },
        ],
      ],
    },
  };
  // C2 spans rows 2..3 (rowspan 2); target rectangle is C3:D4, so C2's span
  // reaches into row 3 (a.row=2 < cr.row+rows=5, a.row+rowspan=4 > cr.row=3).
  const rowMerged = sheet.GetAssuredCell("C2");
  rowMerged.rowspan = 2;
  expect(SC.MaterializeSpill(sheet, "C3", array2x2)).toBeNull();
});

test("MaterializeSpill does not collide with a merged cell entirely outside the rectangle", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const array2x2 = {
    type: "array",
    value: {
      rows: 2,
      cols: 2,
      cells: [
        [
          { type: "n", value: 1 },
          { type: "n", value: 2 },
        ],
        [
          { type: "n", value: 3 },
          { type: "n", value: 4 },
        ],
      ],
    },
  };
  const farMerged = sheet.GetAssuredCell("Z1");
  farMerged.colspan = 2;
  expect(SC.MaterializeSpill(sheet, "C1", array2x2)).not.toBeNull();
});

// ---------------------------------------------------------------------------
// 9. Sanitize offset variants and Prepare string/object ranges.
// ---------------------------------------------------------------------------

test("SanitizeSpills accepts an offset child at the maximum valid row and col", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const anchor = sheet.GetAssuredCell("C1");
  anchor.datatype = "f";
  anchor.formula = "SORT(A1:B2,1,1)";
  anchor.spillrows = 2;
  anchor.spillcols = 2;
  const child = new SC.Cell("D2");
  child.spillowner = "C1";
  child.spillrow = 1;
  child.spillcol = 1;
  sheet.cells.D2 = child;
  SC.SanitizeSpills(sheet);
  expect(sheet.cells.D2?.spillowner).toBe("C1");
});

test("PrepareSpillMutation accepts both string ranges and pre-parsed range objects", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  expect(SC.PrepareSpillMutation(sheet, ["A1:B2"], {})).toBe("");
  const parsed = SC.ParseRange("A1:B2");
  expect(SC.PrepareSpillMutation(sheet, [parsed], {})).toBe("");
});
