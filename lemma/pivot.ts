/**
 * LemmaScript facade: pure policies underlying the pivot-table engine.
 * Non-shipping mirror of pure decision cores in js/pivot.ts (grouping,
 * aggregation, and output collision policy for the pivot materializer).
 *
 * Global-script shipping sources cannot be extracted directly by lsc (no
 * exports); this exported module is the verification surface for Dafny +
 * Lean. The shipping runtime `SocialCalc.Pivot` exposes matching pure
 * helpers (`TypeRank`, `CompareGroupKey`, `AggregateContributesCount`,
 * `AggregateContributesCountA`, `AggregateContributesNumeric`,
 * `AggregateStatus`, `PlanPivotStatus`, `ClassifyPivotClaim`) that are
 * cross-checked exhaustively against this facade in
 * `test/lemma-pivot-facade.test.ts`.
 *
 * Policy groups (mirrors AGENTS.md "Facade oracle mapping" style):
 * 1. typed group-key ordering — blank/number/text/error rank plus a stable,
 *    index-tie-broken 3-level comparator (rank, then caller-supplied
 *    same-type comparison, then original position).
 * 2. aggregate result/error classification — which cell types contribute to
 *    SUM/COUNT/COUNTA/AVERAGE/MIN/MAX, and the empty-input error policy
 *    (AVERAGE of zero numeric inputs is #DIV/0!; every other aggregate has
 *    a defined empty result).
 * 3. output-shape/collision policy — pivot output rectangle bounds/resource
 *    precedence (mirrors lemma/spill.ts's planSpillStatus shape) and a
 *    pivot-specific transactional claim classifier (reclaim same-pivot
 *    cells, collide on foreign spill/pivot owners, user content, or merged
 *    targets).
 */

// --- 1. Typed group-key ordering --------------------------------------------

/** Numeric value type rank (sorts first). */
export const RANK_NUMBER = 0;
/** Text value type rank. */
export const RANK_TEXT = 1;
/** Error value type rank. */
export const RANK_ERROR = 2;
/** Blank value type rank (always sorts last). */
export const RANK_BLANK = 3;

/**
 * Rank of a SocialCalc valuetype leading character ("n"/"t"/"e", else
 * treated as blank). Mirrors the shipping SORT command's typed "up"
 * direction ordering: numbers < text < errors < blank.
 */
export function typeRank(typeChar: string): number {
  //@ verify
  //@ ensures typeChar === "n" ==> \result === 0
  //@ ensures typeChar === "t" ==> \result === 1
  //@ ensures typeChar === "e" ==> \result === 2
  //@ ensures typeChar !== "n" && typeChar !== "t" && typeChar !== "e" ==> \result === 3
  if (typeChar === "n") return 0;
  if (typeChar === "t") return 1;
  if (typeChar === "e") return 2;
  return 3;
}

/**
 * Stable 3-level group-key comparator: rank difference decides first; a
 * rank tie falls back to the caller-supplied same-type comparison
 * (`sameTypeCompare`, e.g. numeric or locale text comparison of the
 * already-classified values); a further tie falls back to original
 * position (`indexA`/`indexB`), so equal keys always retain source order.
 */
export function compareGroupKey(
  rankA: number,
  rankB: number,
  sameTypeCompare: number,
  indexA: number,
  indexB: number,
): number {
  //@ verify
  //@ ensures rankA !== rankB && rankA < rankB ==> \result === -1
  //@ ensures rankA !== rankB && rankA > rankB ==> \result === 1
  //@ ensures rankA === rankB && sameTypeCompare !== 0 ==> \result === sameTypeCompare
  //@ ensures rankA === rankB && sameTypeCompare === 0 && indexA < indexB ==> \result === -1
  //@ ensures rankA === rankB && sameTypeCompare === 0 && indexA > indexB ==> \result === 1
  //@ ensures rankA === rankB && sameTypeCompare === 0 && indexA === indexB ==> \result === 0
  if (rankA !== rankB) return rankA < rankB ? -1 : 1;
  if (sameTypeCompare !== 0) return sameTypeCompare;
  if (indexA < indexB) return -1;
  if (indexA > indexB) return 1;
  return 0;
}

// --- 2. Aggregate result/error classification -------------------------------

/** Sum of numeric contributions. */
export const AGG_SUM = 0;
/** Count of numeric contributions. */
export const AGG_COUNT = 1;
/** Count of non-blank contributions of any type. */
export const AGG_COUNTA = 2;
/** Mean of numeric contributions. */
export const AGG_AVERAGE = 3;
/** Minimum of numeric contributions. */
export const AGG_MIN = 4;
/** Maximum of numeric contributions. */
export const AGG_MAX = 5;

/** Successful aggregate (defined result for the given inputs). */
export const AGG_OK = 0;
/** AVERAGE with zero numeric contributions: #DIV/0!. */
export const AGG_DIV0 = 1;

/** Whether a cell's value-type character is the numeric type "n". */
export function isNumericType(typeChar: string): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> typeChar === "n"
  return typeChar === "n";
}

/** Whether a cell's value-type character is the blank type "b". */
export function isBlankType(typeChar: string): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> typeChar === "b"
  return typeChar === "b";
}

/**
 * Whether a cell contributes to COUNT (numeric-only) for any aggregate
 * function. SUM/AVERAGE/MIN/MAX share the same numeric-only contribution
 * rule as COUNT, so this single predicate backs all of them.
 */
export function aggregateContributesNumeric(typeChar: string): boolean {
  //@ verify
  //@ ensures \result === isNumericType(typeChar)
  return isNumericType(typeChar);
}

/** Whether a cell contributes to COUNTA (any non-blank type). */
export function aggregateContributesCountA(typeChar: string): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> isBlankType(typeChar) === false
  return isBlankType(typeChar) === false;
}

/**
 * Whether a cell contributes to the given aggregate function's running
 * total. COUNTA(2) alone counts every non-blank type; every other
 * aggregate function counts numeric-only inputs.
 */
export function aggregateContributes(aggFn: number, typeChar: string): boolean {
  //@ verify
  //@ ensures aggFn === 2 ==> \result === aggregateContributesCountA(typeChar)
  //@ ensures aggFn !== 2 ==> \result === aggregateContributesNumeric(typeChar)
  if (aggFn === 2) return aggregateContributesCountA(typeChar);
  return aggregateContributesNumeric(typeChar);
}

/**
 * Next running SUM given whether this cell contributes and its numeric
 * value (ignored when not contributing).
 */
export function nextSum(sum: number, contributes: boolean, value: number): number {
  //@ verify
  //@ ensures contributes === true ==> \result === sum + value
  //@ ensures contributes === false ==> \result === sum
  if (contributes === true) return sum + value;
  return sum;
}

/** Next running count given whether this cell contributes. */
export function nextCount(count: number, contributes: boolean): number {
  //@ verify
  //@ ensures contributes === true ==> \result === count + 1
  //@ ensures contributes === false ==> \result === count
  if (contributes === true) return count + 1;
  return count;
}

/**
 * Next running MIN given whether this cell contributes, whether a running
 * minimum already exists, the current minimum, and this cell's value. The
 * first contributing cell seeds the minimum unconditionally.
 */
export function nextMin(min: number, hasMin: boolean, contributes: boolean, value: number): number {
  //@ verify
  //@ ensures contributes === false ==> \result === min
  //@ ensures contributes === true && hasMin === false ==> \result === value
  //@ ensures contributes === true && hasMin === true && value < min ==> \result === value
  //@ ensures contributes === true && hasMin === true && value >= min ==> \result === min
  if (contributes === false) return min;
  if (hasMin === false) return value;
  if (value < min) return value;
  return min;
}

/**
 * Next running MAX given whether this cell contributes, whether a running
 * maximum already exists, the current maximum, and this cell's value. The
 * first contributing cell seeds the maximum unconditionally.
 */
export function nextMax(max: number, hasMax: boolean, contributes: boolean, value: number): number {
  //@ verify
  //@ ensures contributes === false ==> \result === max
  //@ ensures contributes === true && hasMax === false ==> \result === value
  //@ ensures contributes === true && hasMax === true && value > max ==> \result === value
  //@ ensures contributes === true && hasMax === true && value <= max ==> \result === max
  if (contributes === false) return max;
  if (hasMax === false) return value;
  if (value > max) return value;
  return max;
}

/**
 * Aggregate result status: AVERAGE with zero numeric contributions is
 * #DIV/0!; every other function/count combination is well-defined
 * (SUM/COUNT/COUNTA of nothing is 0; MIN/MAX of nothing is defined as 0 by
 * the shipping runtime, matching Excel/Sheets pivot table behavior).
 */
export function aggregateStatus(aggFn: number, numericCount: number): number {
  //@ verify
  //@ ensures aggFn === 3 && numericCount === 0 ==> \result === 1
  //@ ensures (aggFn !== 3 || numericCount !== 0) ==> \result === 0
  if (aggFn === 3 && numericCount === 0) return 1;
  return 0;
}

// --- 3. Output-shape/collision policy ---------------------------------------

/** Successful plan. */
export const PIVOT_OK = 0;
/** rows <= 0 or cols <= 0 (empty pivot: no observed row/column groups). */
export const PIVOT_INVALID_SHAPE = 1;
/** Anchor or rectangle end falls outside [1, maxCol] x [1, maxRow]. */
export const PIVOT_BOUNDS_OVERFLOW = 2;
/** Rectangle fits in bounds but exceeds the caller-supplied cell budget. */
export const PIVOT_RESOURCE_LIMIT = 3;

/** Whether a proposed pivot output rectangle shape is structurally valid. */
export function isValidPivotShape(rows: number, cols: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> rows > 0 && cols > 0
  return rows > 0 && cols > 0;
}

/** Last (rightmost) column of a rectangle starting at anchorCol with width cols. */
export function pivotEndCol(anchorCol: number, cols: number): number {
  //@ verify
  //@ ensures \result === anchorCol + cols - 1
  return anchorCol + cols - 1;
}

/** Last (bottommost) row of a rectangle starting at anchorRow with height rows. */
export function pivotEndRow(anchorRow: number, rows: number): number {
  //@ verify
  //@ ensures \result === anchorRow + rows - 1
  return anchorRow + rows - 1;
}

/**
 * Whether the pivot output rectangle anchored at (anchorCol, anchorRow)
 * fits entirely inside [1, maxCol] x [1, maxRow].
 */
export function isPivotWithinBounds(
  anchorCol: number,
  anchorRow: number,
  rows: number,
  cols: number,
  maxCol: number,
  maxRow: number,
): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> anchorCol >= 1 && anchorRow >= 1 && pivotEndCol(anchorCol, cols) <= maxCol && pivotEndRow(anchorRow, rows) <= maxRow
  return (
    anchorCol >= 1 &&
    anchorRow >= 1 &&
    pivotEndCol(anchorCol, cols) <= maxCol &&
    pivotEndRow(anchorRow, rows) <= maxRow
  );
}

/** Total cell count of a rows x cols pivot output rectangle. */
export function pivotCellCount(rows: number, cols: number): number {
  //@ verify
  //@ ensures \result === rows * cols
  return rows * cols;
}

/** Whether a rows x cols pivot output rectangle fits within a cell budget. */
export function isPivotWithinBudget(rows: number, cols: number, maxCells: number): boolean {
  //@ verify
  //@ ensures \result === true || \result === false
  //@ ensures \result === true <==> pivotCellCount(rows, cols) <= maxCells
  return pivotCellCount(rows, cols) <= maxCells;
}

/**
 * Full pivot-output plan status: invalid shape, bounds overflow, resource
 * limit, or success — checked in that fixed precedence order (mirrors
 * lemma/spill.ts planSpillStatus).
 */
export function planPivotStatus(
  anchorCol: number,
  anchorRow: number,
  rows: number,
  cols: number,
  maxCol: number,
  maxRow: number,
  maxCells: number,
): number {
  //@ verify
  //@ ensures isValidPivotShape(rows, cols) === false ==> \result === 1
  //@ ensures isValidPivotShape(rows, cols) === true && isPivotWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow) === false ==> \result === 2
  //@ ensures isValidPivotShape(rows, cols) === true && isPivotWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow) === true && isPivotWithinBudget(rows, cols, maxCells) === false ==> \result === 3
  //@ ensures \result === 0 <==> isValidPivotShape(rows, cols) === true && isPivotWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow) === true && isPivotWithinBudget(rows, cols, maxCells) === true
  //@ ensures \result === 0 ==> rows > 0 && cols > 0
  //@ ensures \result === 0 ==> anchorCol >= 1 && anchorRow >= 1
  //@ ensures \result === 0 ==> pivotEndCol(anchorCol, cols) <= maxCol && pivotEndRow(anchorRow, rows) <= maxRow
  if (!isValidPivotShape(rows, cols)) return 1;
  if (!isPivotWithinBounds(anchorCol, anchorRow, rows, cols, maxCol, maxRow)) return 2;
  if (!isPivotWithinBudget(rows, cols, maxCells)) return 3;
  return 0;
}

/** Target is the pivot anchor cell itself. */
export const PIVOT_CLAIM_ALLOWED = 0;
/** Blank target, or already owned by the same pivot anchor (reclaim on refresh). */
export const PIVOT_CLAIM_RECLAIMABLE = 1;
/** Foreign spill/pivot owner, user content, or a merged-cell target. */
export const PIVOT_CLAIM_COLLISION = 2;

/**
 * Classify one pivot output target cell for a transactional claim. Inputs
 * are caller-precomputed facts about the target (mirrors
 * lemma/spill.ts's classifySpillClaim). `isForeignOwned` covers both a
 * foreign pivot anchor/child and a foreign dynamic-array spill
 * anchor/child: either is an unrelated generated region and must never be
 * silently overwritten.
 */
export function classifyPivotClaim(
  isAnchorCell: boolean,
  isBlank: boolean,
  isOwnedBySamePivot: boolean,
  isForeignOwned: boolean,
  hasUserContent: boolean,
  isMergedTarget: boolean,
): number {
  //@ verify
  //@ ensures \result === 0 || \result === 1 || \result === 2
  //@ ensures isAnchorCell === true ==> \result === 0
  //@ ensures isAnchorCell === false && (isBlank === true || isOwnedBySamePivot === true) && isForeignOwned === false && hasUserContent === false && isMergedTarget === false ==> \result === 1
  //@ ensures isAnchorCell === false && isForeignOwned === true ==> \result === 2
  //@ ensures isAnchorCell === false && hasUserContent === true ==> \result === 2
  //@ ensures isAnchorCell === false && isMergedTarget === true ==> \result === 2
  //@ ensures isAnchorCell === false && isForeignOwned === true ==> \result !== 0 && \result !== 1
  //@ ensures isAnchorCell === false && hasUserContent === true ==> \result !== 0 && \result !== 1
  //@ ensures isAnchorCell === false && isMergedTarget === true ==> \result !== 0 && \result !== 1
  if (isAnchorCell === true) return 0;
  if (isForeignOwned === true || hasUserContent === true || isMergedTarget === true) return 2;
  if (isBlank === true || isOwnedBySamePivot === true) return 1;
  return 2;
}
