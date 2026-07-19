// SocialCalc.Pivot — pivot-table engine.
//
// A pivot table is a named, ownership-tracked output region (mirrors the
// dynamic-array "spill" runtime in socialcalc-3.ts: SC.MaterializeSpill /
// SC.ClearSpill / SC.SanitizeSpills / SC.PrepareSpillMutation) computed from
// a rectangular source range with a header row. Definitions live in
// `sheet.pivots[anchorCoord]`; materialized output cells are ordinary
// SocialCalc.Cell objects tagged `pivotowner`/`pivotrow`/`pivotcol` (the
// anchor cell itself additionally carries `pivotrows`/`pivotcols`), exactly
// paralleling `spillowner`/`spillrow`/`spillcol`/`spillrows`/`spillcols`.
// Output cells are read-only to direct edits (see PrepareSpillMutation's
// pivot-ownership checks in socialcalc-3.ts and the editor input guards in
// socialcalctableeditor.ts) and are only ever rewritten by
// SC.Pivot.RefreshPivot / RefreshAllPivots.
//
// Pure decision cores (typed group-key ordering, aggregate contribution/
// error classification, output-shape/collision policy) are mirrored,
// verified, and cross-checked in lemma/pivot.ts /
// test/lemma-pivot-facade.test.ts — see that file for the Dafny/Lean-backed
// specification these functions must match bit-for-bit.

// SocialCalc is defined by socialcalcconstants.js, and `SC` is the `const SC
// = SocialCalc as any` alias declared once at top-level scope by
// socialcalc-3.ts (which concatenates before this file in the UMD bundle,
// and shares this file's global script scope — no module boundary, so the
// declaration is visible here without a re-import).

SC.Pivot = {};

// --- Bounds (mirror SC.Formula.SPILL_MAX_* / lemma/pivot.ts) ---------------

SC.Pivot.MAX_COL = 702;
SC.Pivot.MAX_ROW = 65536;
SC.Pivot.MAX_CELLS = 100000;

// --- Aggregate function codes -----------------------------------------------

SC.Pivot.AGG_SUM = 0;
SC.Pivot.AGG_COUNT = 1;
SC.Pivot.AGG_COUNTA = 2;
SC.Pivot.AGG_AVERAGE = 3;
SC.Pivot.AGG_MIN = 4;
SC.Pivot.AGG_MAX = 5;

SC.Pivot.AggCode = {
  sum: SC.Pivot.AGG_SUM,
  count: SC.Pivot.AGG_COUNT,
  counta: SC.Pivot.AGG_COUNTA,
  average: SC.Pivot.AGG_AVERAGE,
  min: SC.Pivot.AGG_MIN,
  max: SC.Pivot.AGG_MAX,
};
SC.Pivot.AggLabel = {
  sum: "Sum",
  count: "Count",
  counta: "CountA",
  average: "Average",
  min: "Min",
  max: "Max",
};

SC.Pivot.CommandError =
  "Cannot change part of a pivot table output. Delete or refresh the pivot table instead.";

// =============================================================================
// 1. Pure policy cores (mirror lemma/pivot.ts exactly — see
//    test/lemma-pivot-facade.test.ts for the exhaustive/boundary cross-check).
// =============================================================================

/** @param {string} typeChar */
SC.Pivot.TypeRank = function (typeChar: string): number {
  if (typeChar === "n") return 0;
  if (typeChar === "t") return 1;
  if (typeChar === "e") return 2;
  return 3;
};

/** @param {number} rankA @param {number} rankB @param {number} sameTypeCompare @param {number} indexA @param {number} indexB */
SC.Pivot.CompareGroupKey = function (
  rankA: number,
  rankB: number,
  sameTypeCompare: number,
  indexA: number,
  indexB: number,
): number {
  if (rankA !== rankB) return rankA < rankB ? -1 : 1;
  if (sameTypeCompare !== 0) return sameTypeCompare;
  if (indexA < indexB) return -1;
  if (indexA > indexB) return 1;
  return 0;
};

/** @param {string} typeChar */
SC.Pivot.IsNumericType = function (typeChar: string): boolean {
  return typeChar === "n";
};

/** @param {string} typeChar */
SC.Pivot.IsBlankType = function (typeChar: string): boolean {
  return typeChar === "b";
};

/** @param {string} typeChar */
SC.Pivot.AggregateContributesNumeric = function (typeChar: string): boolean {
  return SC.Pivot.IsNumericType(typeChar);
};

/** @param {string} typeChar */
SC.Pivot.AggregateContributesCountA = function (typeChar: string): boolean {
  return !SC.Pivot.IsBlankType(typeChar);
};

/** @param {number} aggFn @param {string} typeChar */
SC.Pivot.AggregateContributes = function (aggFn: number, typeChar: string): boolean {
  if (aggFn === SC.Pivot.AGG_COUNTA) return SC.Pivot.AggregateContributesCountA(typeChar);
  return SC.Pivot.AggregateContributesNumeric(typeChar);
};

/** @param {number} sum @param {boolean} contributes @param {number} value */
SC.Pivot.NextSum = function (sum: number, contributes: boolean, value: number): number {
  return contributes ? sum + value : sum;
};

/** @param {number} count @param {boolean} contributes */
SC.Pivot.NextCount = function (count: number, contributes: boolean): number {
  return contributes ? count + 1 : count;
};

/** @param {number} min @param {boolean} hasMin @param {boolean} contributes @param {number} value */
SC.Pivot.NextMin = function (
  min: number,
  hasMin: boolean,
  contributes: boolean,
  value: number,
): number {
  if (!contributes) return min;
  if (!hasMin) return value;
  return value < min ? value : min;
};

/** @param {number} max @param {boolean} hasMax @param {boolean} contributes @param {number} value */
SC.Pivot.NextMax = function (
  max: number,
  hasMax: boolean,
  contributes: boolean,
  value: number,
): number {
  if (!contributes) return max;
  if (!hasMax) return value;
  return value > max ? value : max;
};

/** @param {number} aggFn @param {number} numericCount */
SC.Pivot.AggregateStatus = function (aggFn: number, numericCount: number): number {
  return aggFn === SC.Pivot.AGG_AVERAGE && numericCount === 0 ? 1 : 0;
};

/**
 * @param {number} anchorCol @param {number} anchorRow @param {number} rows @param {number} cols
 * @param {number} maxCol @param {number} maxRow @param {number} maxCells
 */
SC.Pivot.PlanPivotStatus = function (
  anchorCol: number,
  anchorRow: number,
  rows: number,
  cols: number,
  maxCol: number,
  maxRow: number,
  maxCells: number,
): number {
  if (!(rows > 0 && cols > 0)) return 1;
  if (
    !(
      anchorCol >= 1 &&
      anchorRow >= 1 &&
      anchorCol + cols - 1 <= maxCol &&
      anchorRow + rows - 1 <= maxRow
    )
  )
    return 2;
  if (rows * cols > maxCells) return 3;
  return 0;
};

/**
 * @param {boolean} isAnchorCell @param {boolean} isBlank @param {boolean} isOwnedBySamePivot
 * @param {boolean} isForeignOwned @param {boolean} hasUserContent @param {boolean} isMergedTarget
 */
SC.Pivot.ClassifyPivotClaim = function (
  isAnchorCell: boolean,
  isBlank: boolean,
  isOwnedBySamePivot: boolean,
  isForeignOwned: boolean,
  hasUserContent: boolean,
  isMergedTarget: boolean,
): number {
  if (isAnchorCell) return 0;
  if (isForeignOwned || hasUserContent || isMergedTarget) return 2;
  return isBlank || isOwnedBySamePivot ? 1 : 2;
};

// =============================================================================
// 2. Source reading / typed grouping
// =============================================================================

/**
 * Leading value-type character for a sheet cell ("b" for a missing cell,
 * mirroring formula-operand.ts's default-to-blank policy for absent cells).
 * @param {any} sheet @param {string} coord
 */
SC.Pivot.CellTypeChar = function (sheet: any, coord: string): string {
  var cell = sheet.cells[coord];
  if (!cell) return "b";
  // valuetype is either falsy (missing/blank) or a nonempty type-code
  // string, so a truthy valuetype's first character is never itself falsy.
  return cell.valuetype ? cell.valuetype.charAt(0) : "b";
};

/**
 * A typed, safely-labeled group key for one source cell: the SORT-style
 * rank (number < text < error < blank), a same-type comparison value, and a
 * display label. Numbers/text keep their native comparable value; blanks
 * key on "" with the fixed label "(blank)"; errors key on their error text.
 * @param {any} sheet @param {string} coord
 */
SC.Pivot.GroupKeyFor = function (sheet: any, coord: string): any {
  var cell = sheet.cells[coord];
  var t = SC.Pivot.CellTypeChar(sheet, coord);
  var rank = SC.Pivot.TypeRank(t);
  // CellTypeChar returns "b" whenever the cell is missing, so any other
  // branch below is only reached with `cell` already truthy.
  if (t === "n") {
    // Every engine write site that sets a valuetype starting with "n"
    // (parse, load, formula recalc, this module's own RenderGrid output)
    // always pairs it with a JS-number datavalue, so the historical
    // string-coercion fallback here was dead by construction.
    var nv = cell.datavalue;
    return { rank: rank, type: "n", key: "n:" + nv, sortValue: nv, label: "" + nv };
  }
  if (t === "e") {
    var ev = "" + (cell.errors || cell.datavalue || "#VALUE!");
    return { rank: rank, type: "e", key: "e:" + ev, sortValue: ev, label: ev };
  }
  if (t === "b") {
    return { rank: rank, type: "b", key: "b:", sortValue: "", label: "(blank)" };
  }
  // CellTypeChar already means a real cell exists here, and no code path
  // ever leaves datavalue null/undefined on an existing cell (the
  // constructor defaults it to "").
  var tv = "" + cell.datavalue;
  return { rank: rank, type: "t", key: "t:" + tv, sortValue: tv, label: tv };
};

/** Comparable ordering of two same-rank group keys (0 for cross-type/tie). */
SC.Pivot.SameTypeCompare = function (a: any, b: any): number {
  if (a.type !== b.type) return 0;
  if (a.sortValue === b.sortValue) return 0;
  return a.sortValue < b.sortValue ? -1 : 1;
};

/** Grid cell {value, type} for a typed group key, per SC.Pivot's labeling policy. */
SC.Pivot.HeaderCellFor = function (groupKey: any): any {
  if (groupKey.type === "b") return { value: "(blank)", type: "t" };
  if (groupKey.type === "e") return { value: groupKey.sortValue, type: "e" };
  return { value: groupKey.sortValue, type: groupKey.type };
};

// =============================================================================
// 3. Definition validation
// =============================================================================

SC.Pivot.VALID_AGG = { sum: 1, count: 1, counta: 1, average: 1, min: 1, max: 1 };

/** @param {any} definition */
SC.Pivot.ValidateDefinition = function (definition: any): string {
  if (!definition || typeof definition !== "object") return "Missing pivot table definition";
  if (typeof definition.source !== "string" || !definition.source)
    return "Missing pivot source range";
  // SocialCalc.ParseRange never throws for shipping inputs (a string is
  // always split/parsed into some {row,col} structure, however degenerate).
  var r = SocialCalc.ParseRange(definition.source);
  if (r.cr2.row <= r.cr1.row)
    return "Pivot source must include a header row and at least one data row";
  if (!Array.isArray(definition.rowFields)) return "rowFields must be an array";
  if (!Array.isArray(definition.colFields)) return "colFields must be an array";
  if (!Array.isArray(definition.valueFields) || definition.valueFields.length === 0)
    return "valueFields must be a non-empty array";
  var i: number;
  for (i = 0; i < definition.rowFields.length; i++)
    if (typeof definition.rowFields[i] !== "string") return "rowFields must contain field names";
  for (i = 0; i < definition.colFields.length; i++)
    if (typeof definition.colFields[i] !== "string") return "colFields must contain field names";
  for (i = 0; i < definition.valueFields.length; i++) {
    var vf = definition.valueFields[i];
    if (!vf || typeof vf.field !== "string" || !SC.Pivot.VALID_AGG[vf.agg])
      return "valueFields entries need a field and a valid aggregation (sum/count/counta/average/min/max)";
  }
  if (definition.filters) {
    if (!Array.isArray(definition.filters)) return "filters must be an array";
    for (i = 0; i < definition.filters.length; i++) {
      var f = definition.filters[i];
      if (!f || typeof f.field !== "string" || !Array.isArray(f.values))
        return "filters entries need a field and an array of allowed values";
    }
  }
  return "";
};

// =============================================================================
// 4. Table building (grouping + aggregation, pure w.r.t. sheet contents)
// =============================================================================

/** @param {any[]} a @param {any[]} b */
SC.Pivot.IntersectMembers = function (a: number[], b: number[]): number[] {
  var setB: { [k: number]: boolean } = {};
  var i: number;
  for (i = 0; i < b.length; i++) setB[b[i]] = true;
  var out: number[] = [];
  for (i = 0; i < a.length; i++) if (setB[a[i]]) out.push(a[i]);
  return out;
};

/**
 * Reads the source range and computes filtered data rows, distinct
 * (stably-sorted) row/column groups, and an aggregate() closure. Returns
 * `{error}` on any structural problem (bad range, unknown field name).
 * @param {any} sheet @param {any} definition
 */
SC.Pivot.BuildTable = function (sheet: any, definition: any): any {
  // See ValidateDefinition's identical note: ParseRange never throws for
  // shipping inputs.
  var range: any = SocialCalc.ParseRange(definition.source);
  var cr1 = range.cr1,
    cr2 = range.cr2;
  if (cr2.row <= cr1.row)
    return { error: "Pivot source must include a header row and at least one data row" };

  var headers: string[] = [];
  var headerCol: { [name: string]: number } = {};
  var usedNames: { [name: string]: boolean } = {};
  var col: number;
  for (col = cr1.col; col <= cr2.col; col++) {
    var hcoord = SocialCalc.crToCoord(col, cr1.row);
    var hcell = sheet.cells[hcoord];
    var name =
      hcell && hcell.datavalue != null && hcell.datavalue !== ""
        ? "" + hcell.datavalue
        : SocialCalc.rcColname(col);
    if (usedNames[name]) name = name + "_" + SocialCalc.rcColname(col);
    usedNames[name] = true;
    headers.push(name);
    headerCol[name] = col;
  }

  var checkField = function (f: string): boolean {
    return headerCol[f] !== undefined;
  };
  var i: number;
  for (i = 0; i < definition.rowFields.length; i++)
    if (!checkField(definition.rowFields[i]))
      return { error: "Unknown pivot field: " + definition.rowFields[i] };
  for (i = 0; i < definition.colFields.length; i++)
    if (!checkField(definition.colFields[i]))
      return { error: "Unknown pivot field: " + definition.colFields[i] };
  for (i = 0; i < definition.valueFields.length; i++)
    if (!checkField(definition.valueFields[i].field))
      return { error: "Unknown pivot field: " + definition.valueFields[i].field };
  var filters = definition.filters || [];
  for (i = 0; i < filters.length; i++)
    if (!checkField(filters[i].field)) return { error: "Unknown pivot field: " + filters[i].field };

  var dataRows: Array<{ row: number }> = [];
  var row: number;
  for (row = cr1.row + 1; row <= cr2.row; row++) {
    var included = true;
    for (i = 0; i < filters.length && included; i++) {
      var fc = SocialCalc.crToCoord(headerCol[filters[i].field], row);
      var gk = SC.Pivot.GroupKeyFor(sheet, fc);
      if (filters[i].values.indexOf(gk.label) < 0) included = false;
    }
    if (included) dataRows.push({ row: row });
  }

  var keysFor = function (fields: string[], rowObj: { row: number }): any[] {
    return fields.map(function (f: string) {
      return SC.Pivot.GroupKeyFor(sheet, SocialCalc.crToCoord(headerCol[f], rowObj.row));
    });
  };

  var distinctGroups = function (fields: string[]): any[] {
    var seen: { [sig: string]: any } = {};
    var groups: any[] = [];
    var di: number;
    for (di = 0; di < dataRows.length; di++) {
      var keys = keysFor(fields, dataRows[di]);
      var sig = keys
        .map(function (k: any) {
          return k.key;
        })
        .join("\u0001");
      if (!seen[sig]) {
        seen[sig] = { keys: keys, sig: sig, firstIndex: di, members: [] };
        groups.push(seen[sig]);
      }
      seen[sig].members.push(di);
    }
    // Per-level compare is pure rank+same-type (CompareGroupKey's index
    // args pinned equal so its tiebreak never fires mid-loop). Distinct
    // groups always differ in `sig` (their joined per-level keys), and
    // SameTypeCompare/CompareGroupKey never return 0 when two levels'
    // sortValues differ (unequal strings/numbers always compare nonzero,
    // including NaN, which the `<` fallback resolves to a nonzero verdict
    // even though it isn't a strict order) — so the loop always returns at
    // the first differing level. The trailing firstIndex tiebreak exists
    // only for defense if that invariant is ever violated.
    groups.sort(function (ga: any, gb: any) {
      var lvl: number;
      for (lvl = 0; lvl < fields.length; lvl++) {
        var a = ga.keys[lvl],
          b = gb.keys[lvl];
        var same = SC.Pivot.SameTypeCompare(a, b);
        var c = SC.Pivot.CompareGroupKey(a.rank, b.rank, same, 0, 0);
        if (c !== 0) return c;
      }
      /* istanbul ignore next -- unreachable, see comment above */
      return SC.Pivot.CompareGroupKey(0, 0, 0, ga.firstIndex, gb.firstIndex);
    });
    return groups;
  };

  var rowGroups = distinctGroups(definition.rowFields);
  var colGroups = distinctGroups(definition.colFields);
  if (colGroups.length === 0) colGroups = [{ keys: [], sig: "", firstIndex: 0, members: [] }];

  var aggregate = function (members: number[], valueField: any): any {
    var col2 = headerCol[valueField.field];
    var sum = 0,
      count = 0,
      counta = 0,
      hasMin = false,
      min = 0,
      hasMax = false,
      max = 0;
    var mi: number;
    for (mi = 0; mi < members.length; mi++) {
      var coord = SocialCalc.crToCoord(col2, dataRows[members[mi]].row);
      var t = SC.Pivot.CellTypeChar(sheet, coord);
      var contributesNumeric = SC.Pivot.AggregateContributesNumeric(t);
      var contributesA = SC.Pivot.AggregateContributesCountA(t);
      var val = 0;
      if (contributesNumeric) {
        // See GroupKeyFor's identical note: a numeric-typed cell's
        // datavalue is always a JS number by construction.
        val = sheet.cells[coord].datavalue;
      }
      sum = SC.Pivot.NextSum(sum, contributesNumeric, val);
      min = SC.Pivot.NextMin(min, hasMin, contributesNumeric, val);
      max = SC.Pivot.NextMax(max, hasMax, contributesNumeric, val);
      if (contributesNumeric) {
        hasMin = true;
        hasMax = true;
      }
      count = SC.Pivot.NextCount(count, contributesNumeric);
      counta = SC.Pivot.NextCount(counta, contributesA);
    }
    var aggFn = SC.Pivot.AggCode[valueField.agg];
    var status = SC.Pivot.AggregateStatus(aggFn, count);
    if (status === 1) return { value: "#DIV/0!", type: "e" };
    var result: number;
    if (valueField.agg === "sum") result = sum;
    else if (valueField.agg === "count") result = count;
    else if (valueField.agg === "counta") result = counta;
    // AggregateStatus already returned #DIV/0! above whenever agg is
    // "average" and count is 0, so count is always > 0 here.
    else if (valueField.agg === "average") result = sum / count;
    else if (valueField.agg === "min") result = min;
    else result = max;
    return { value: result, type: "n" };
  };

  return {
    headers: headers,
    headerCol: headerCol,
    dataRows: dataRows,
    rowGroups: rowGroups,
    colGroups: colGroups,
    aggregate: aggregate,
  };
};

// =============================================================================
// 5. Grid rendering (row/col headers, subtotals, grand totals)
// =============================================================================

/** @param {any[]} fields @param {any} definition */
SC.Pivot.ColumnHeaderLabel = function (colGroup: any, definition: any, valueField: any): string {
  var parts = colGroup.keys.map(function (k: any) {
    return k.type === "b" ? "(blank)" : "" + k.sortValue;
  });
  var base = parts.join(" / ");
  if (definition.valueFields.length > 1) {
    var vlabel = valueField.label || SC.Pivot.AggLabel[valueField.agg] + " of " + valueField.field;
    return base ? base + " | " + vlabel : vlabel;
  }
  return base;
};

/**
 * Renders a full pivot output grid (array of arrays of {value, type}) from a
 * built table. Layout: corner columns hold row-field names/labels; the
 * header row holds column-group (x value-field) labels, optionally with a
 * "Total" block per value field; data rows follow sorted row-group order
 * with an optional first-level subtotal row after each outer group, and an
 * optional trailing grand-total row.
 * @param {any} built @param {any} definition
 */
SC.Pivot.RenderGrid = function (built: any, definition: any): any {
  var rowFieldCount = definition.rowFields.length;
  var valueFields = definition.valueFields;
  var colGroups = built.colGroups;
  var showRowTotals = !!definition.showRowTotals;
  var showColTotals = !!definition.showColTotals;
  var showSubtotals = rowFieldCount > 1 && definition.showSubtotals !== false;

  var valueColBlocks =
    colGroups.length * valueFields.length + (showRowTotals ? valueFields.length : 0);
  var headerCols = Math.max(rowFieldCount, 1);
  var totalCols = headerCols + valueColBlocks;

  var grid: any[][] = [];

  // Header row.
  var headerRow: any[] = [];
  var i: number;
  if (rowFieldCount === 0) {
    headerRow.push({ value: "", type: "t" });
  } else {
    for (i = 0; i < rowFieldCount; i++)
      headerRow.push({ value: definition.rowFields[i], type: "t" });
  }
  var cg: number, vf: number;
  for (cg = 0; cg < colGroups.length; cg++) {
    for (vf = 0; vf < valueFields.length; vf++) {
      headerRow.push({
        value: SC.Pivot.ColumnHeaderLabel(colGroups[cg], definition, valueFields[vf]),
        type: "t",
      });
    }
  }
  if (showRowTotals) {
    for (vf = 0; vf < valueFields.length; vf++) {
      var vlabel =
        valueFields.length > 1
          ? "Total | " +
            (valueFields[vf].label ||
              SC.Pivot.AggLabel[valueFields[vf].agg] + " of " + valueFields[vf].field)
          : "Total";
      headerRow.push({ value: vlabel, type: "t" });
    }
  }
  grid.push(headerRow);

  var emitDataRow = function (labelCells: any[], members: number[]): void {
    var out: any[] = labelCells.slice();
    for (cg = 0; cg < colGroups.length; cg++) {
      var scoped = SC.Pivot.IntersectMembers(members, colGroups[cg].members);
      for (vf = 0; vf < valueFields.length; vf++)
        out.push(built.aggregate(scoped, valueFields[vf]));
    }
    if (showRowTotals) {
      for (vf = 0; vf < valueFields.length; vf++)
        out.push(built.aggregate(members, valueFields[vf]));
    }
    grid.push(out);
  };

  var blankLabelCells = function (n: number): any[] {
    var out: any[] = [];
    for (var k = 0; k < n; k++) out.push({ value: "", type: "b" });
    return out;
  };

  var outerSig: string | null = null;
  var outerLabel = "";
  var outerMembers: number[] = [];
  // Callers gate on `showSubtotals && outerSig !== null` before invoking
  // this closure, so it never needs to re-check that itself.
  var flushSubtotal = function (): void {
    var labelCells = blankLabelCells(headerCols);
    labelCells[0] = { value: outerLabel + " Total", type: "t" };
    emitDataRow(labelCells, outerMembers);
  };

  var rg: number;
  for (rg = 0; rg < built.rowGroups.length; rg++) {
    var group = built.rowGroups[rg];
    var sig0 = rowFieldCount > 0 ? group.keys[0].key : "";
    if (showSubtotals && outerSig !== null && sig0 !== outerSig) {
      flushSubtotal();
      outerMembers = [];
    }
    if (rowFieldCount > 0) {
      outerSig = sig0;
      outerLabel = group.keys[0].type === "b" ? "(blank)" : "" + group.keys[0].sortValue;
    }
    outerMembers = outerMembers.concat(group.members);

    var labelCells: any[];
    if (rowFieldCount === 0) {
      labelCells = [{ value: "Total", type: "t" }];
    } else {
      labelCells = group.keys.map(function (k: any) {
        return SC.Pivot.HeaderCellFor(k);
      });
    }
    emitDataRow(labelCells, group.members);
  }
  if (showSubtotals && outerSig !== null) flushSubtotal();

  if (showColTotals) {
    var allMembers: number[] = [];
    for (rg = 0; rg < built.dataRows.length; rg++) allMembers.push(rg);
    var grandLabel = blankLabelCells(headerCols);
    grandLabel[0] = { value: "Grand Total", type: "t" };
    emitDataRow(grandLabel, allMembers);
  }

  return { grid: grid, rows: grid.length, cols: totalCols };
};

// =============================================================================
// 6. Materialization / clearing / sanitization (mirrors SC.MaterializeSpill /
//    SC.ClearSpill / SC.SanitizeSpills).
// =============================================================================

/**
 * Recomputes and writes a pivot table's output cells from its current
 * definition and current source data. Returns "" on success or an error
 * string (the definition remains stored either way; on error the anchor
 * cell is left holding a "#PIVOT!" error, matching the shipping "#SPILL!"
 * failure-conversion policy in socialcalc-3.ts's recalc loop).
 * @param {any} sheet @param {string} anchor
 */
SC.Pivot.RefreshPivot = function (sheet: any, anchor: string): string {
  var definition = sheet.pivots && sheet.pivots[anchor];
  if (!definition) return "No such pivot table: " + anchor;

  var fail = function (msg: string): string {
    SC.Pivot.ClearPivot(sheet, anchor);
    var ac = sheet.GetAssuredCell(anchor);
    ac.datavalue = "#PIVOT!";
    ac.valuetype = "e";
    ac.errors = msg;
    delete ac.displaystring;
    sheet.renderneeded = true;
    sheet.changedrendervalues = true;
    return msg;
  };

  var verr = SC.Pivot.ValidateDefinition(definition);
  if (verr) return fail(verr);

  var built = SC.Pivot.BuildTable(sheet, definition);
  if (built.error) return fail(built.error);

  var rendered = SC.Pivot.RenderGrid(built, definition);
  var grid = rendered.grid;
  var rows = rendered.rows,
    cols = rendered.cols;
  var cr = SocialCalc.coordToCr(anchor);

  var status = SC.Pivot.PlanPivotStatus(
    cr.col,
    cr.row,
    rows,
    cols,
    SC.Pivot.MAX_COL,
    SC.Pivot.MAX_ROW,
    SC.Pivot.MAX_CELLS,
  );
  if (status !== 0) return fail("#PIVOT! (output does not fit: " + rows + "x" + cols + ")");

  var anchorCellExisting = sheet.cells[anchor];
  var oldRows = (anchorCellExisting && anchorCellExisting.pivotrows) || 0;
  var oldCols = (anchorCellExisting && anchorCellExisting.pivotcols) || 0;

  // Collision detection: any cell in the target rectangle that is not
  // already owned by this same pivot (and is not the anchor) blocks the
  // refresh, mirroring SC.MaterializeSpill's collision scan (merged-cell
  // intersection included).
  var collision = false;
  var key: string;
  for (key in sheet.cells) {
    var existing = sheet.cells[key];
    if (!existing || key === anchor || existing.pivotowner === anchor) continue;
    var a = SocialCalc.coordToCr(key);
    var inRect =
      a.col >= cr.col && a.col < cr.col + cols && a.row >= cr.row && a.row < cr.row + rows;
    var merged = existing.colspan > 1 || existing.rowspan > 1;
    var intersects =
      merged &&
      a.col < cr.col + cols &&
      a.col + (existing.colspan || 1) > cr.col &&
      a.row < cr.row + rows &&
      a.row + (existing.rowspan || 1) > cr.row;
    if (inRect || intersects) {
      collision = true;
      break;
    }
  }
  if (collision) return fail("#PIVOT! (output collides with existing content)");

  // Clear stale children beyond the new footprint.
  var r: number, c: number;
  for (r = 0; r < oldRows; r++)
    for (c = 0; c < oldCols; c++) {
      if (r < rows && c < cols) continue;
      var stale = sheet.cells[SocialCalc.crToCoord(cr.col + c, cr.row + r)];
      if (stale && stale.pivotowner === anchor) delete sheet.cells[stale.coord];
    }

  var anchorCell = sheet.GetAssuredCell(anchor);
  delete anchorCell.errors;
  anchorCell.datavalue = grid[0][0].value;
  anchorCell.valuetype = grid[0][0].type;
  anchorCell.pivotrows = rows;
  anchorCell.pivotcols = cols;
  delete anchorCell.displaystring;

  for (r = 0; r < rows; r++)
    for (c = 0; c < cols; c++) {
      if (!r && !c) continue;
      var value = grid[r][c];
      var childcoord = SocialCalc.crToCoord(cr.col + c, cr.row + r);
      var child = sheet.cells[childcoord];
      if (!child || child.pivotowner !== anchor) child = new SocialCalc.Cell(childcoord);
      child.datavalue = value.value;
      child.valuetype = value.type;
      if (value.type === "e") child.errors = value.value;
      else delete child.errors;
      child.pivotowner = anchor;
      child.pivotrow = r;
      child.pivotcol = c;
      delete child.displaystring;
      sheet.cells[childcoord] = child;
    }

  sheet.attribs.lastrow = Math.max(sheet.attribs.lastrow, cr.row + rows - 1);
  sheet.attribs.lastcol = Math.max(sheet.attribs.lastcol, cr.col + cols - 1);
  sheet.renderneeded = true;
  sheet.changedrendervalues = true;
  return "";
};

/** Refreshes every registered pivot table on a sheet, in definition order. */
SC.Pivot.RefreshAllPivots = function (sheet: any): void {
  if (!sheet.pivots) return;
  var anchor: string;
  for (anchor in sheet.pivots) SC.Pivot.RefreshPivot(sheet, anchor);
};

/** Removes a pivot table's owned output cells (definition, if any, is left untouched). */
SC.Pivot.ClearPivot = function (sheet: any, anchor: string): boolean {
  var removed = false;
  var anchorCell = sheet.cells[anchor];
  var rows = (anchorCell && anchorCell.pivotrows) || 0;
  var cols = (anchorCell && anchorCell.pivotcols) || 0;
  var cr: any;
  // SocialCalc.coordToCr never throws for shipping inputs (any string
  // parses to some {row,col}, however degenerate); defensive against a
  // future coordToCr revision, not reachable today.
  try {
    cr = SocialCalc.coordToCr(anchor);
  } catch {
    /* istanbul ignore next -- unreachable, see comment above */
    return false;
  }
  var r: number, c: number;
  for (r = 0; r < rows; r++)
    for (c = 0; c < cols; c++) {
      if (!r && !c) continue;
      var coord = SocialCalc.crToCoord(cr.col + c, cr.row + r);
      var cell = sheet.cells[coord];
      if (cell && cell.pivotowner === anchor) {
        delete sheet.cells[coord];
        removed = true;
      }
    }
  if (anchorCell) {
    delete anchorCell.pivotrows;
    delete anchorCell.pivotcols;
  }
  if (removed) {
    sheet.renderneeded = true;
    sheet.changedrendervalues = true;
  }
  return removed;
};

/** Clears every pivot table's owned output cells (used before structural row/col shifts). */
SC.Pivot.ClearAllDerivedPivots = function (sheet: any): void {
  var changed = false;
  var key: string;
  for (key in sheet.cells) {
    var cell = sheet.cells[key];
    if (!cell) continue;
    if (cell.pivotowner) {
      delete sheet.cells[key];
      changed = true;
    } else if (cell.pivotrows || cell.pivotcols) {
      delete cell.pivotrows;
      delete cell.pivotcols;
      changed = true;
    }
  }
  if (changed) {
    sheet.renderneeded = true;
    sheet.changedrendervalues = true;
  }
};

/**
 * Returns the pivot anchor a coordinate belongs to (itself if it is not a
 * pivot output cell), mirroring SC.SpillOwnerForCoord.
 */
SC.Pivot.PivotOwnerForCoord = function (sheet: any, coord: string): string {
  var cell = sheet.cells[coord];
  return cell && cell.pivotowner ? cell.pivotowner : coord;
};

/**
 * Validates `sheet.pivots` after a load: drops structurally invalid
 * definitions and any owned cell whose owner/offset bookkeeping does not
 * reconcile, mirroring SC.SanitizeSpills.
 */
SC.Pivot.SanitizePivots = function (sheet: any): void {
  sheet.pivots = sheet.pivots || {};
  var valid: { [anchor: string]: boolean } = {};
  var anchor: string;
  for (anchor in sheet.pivots) {
    var def = sheet.pivots[anchor];
    var err = SC.Pivot.ValidateDefinition(def);
    if (!err) {
      var acr = SocialCalc.coordToCr(anchor);
      if (!(acr.col >= 1 && acr.row >= 1)) err = "bad anchor";
    }
    if (err) {
      delete sheet.pivots[anchor];
      continue;
    }
    valid[anchor] = true;
  }
  var key: string;
  for (key in sheet.cells) {
    var cell = sheet.cells[key];
    if (!cell || !cell.pivotowner) continue;
    var owner = sheet.cells[cell.pivotowner];
    var good = false;
    if (owner && valid[cell.pivotowner]) {
      var a = SocialCalc.coordToCr(cell.pivotowner),
        c = SocialCalc.coordToCr(key);
      good =
        Number.isInteger(cell.pivotrow) &&
        Number.isInteger(cell.pivotcol) &&
        cell.pivotrow >= 0 &&
        cell.pivotcol >= 0 &&
        !!(cell.pivotrow || cell.pivotcol) &&
        !!owner.pivotrows &&
        !!owner.pivotcols &&
        cell.pivotrow < owner.pivotrows &&
        cell.pivotcol < owner.pivotcols &&
        c.col === a.col + cell.pivotcol &&
        c.row === a.row + cell.pivotrow;
    }
    if (!good) {
      delete cell.pivotowner;
      delete cell.pivotrow;
      delete cell.pivotcol;
    }
  }
  sheet.renderneeded = true;
};
