declare namespace SocialCalc {
  /** One value/aggregate column of a pivot table. */
  interface PivotValueField {
    field: string;
    agg: "sum" | "count" | "counta" | "average" | "min" | "max";
    label?: string;
  }

  /** Exact-value inclusion filter on one source field. */
  interface PivotFilter {
    field: string;
    values: string[];
  }

  /** A pivot table definition, keyed by its output anchor coordinate in `Sheet.pivots`. */
  interface PivotDefinition {
    /** A1 range of the rectangular source, including its header row. */
    source: string;
    /** Ordered row-grouping field names (source header cell text). */
    rowFields: string[];
    /** Ordered column-grouping field names. */
    colFields: string[];
    /** Ordered value/aggregate columns; at least one is required. */
    valueFields: PivotValueField[];
    /** Optional exact-value inclusion filters, evaluated before grouping. */
    filters?: PivotFilter[];
    /** Emit a "<field> Total" subtotal row after each outer row group (row-field count > 1). */
    showSubtotals?: boolean;
    /** Emit a trailing per-column-group total column per value field. */
    showRowTotals?: boolean;
    /** Emit a trailing "Grand Total" row. */
    showColTotals?: boolean;
  }

  interface PivotTypedGroupKey {
    rank: number;
    type: "n" | "t" | "e" | "b";
    key: string;
    sortValue: string | number;
    label: string;
  }

  interface PivotGroup {
    keys: PivotTypedGroupKey[];
    sig: string;
    firstIndex: number;
    members: number[];
  }

  interface PivotBuiltTable {
    error?: string;
    headers?: string[];
    headerCol?: { [name: string]: number };
    dataRows?: Array<{ row: number }>;
    rowGroups?: PivotGroup[];
    colGroups?: PivotGroup[];
    aggregate?: (
      members: number[],
      valueField: PivotValueField,
    ) => { value: string | number; type: string };
  }

  interface PivotRenderedGrid {
    grid: Array<Array<{ value: string | number; type: string }>>;
    rows: number;
    cols: number;
  }

  const Pivot: {
    MAX_COL: number;
    MAX_ROW: number;
    MAX_CELLS: number;
    AGG_SUM: number;
    AGG_COUNT: number;
    AGG_COUNTA: number;
    AGG_AVERAGE: number;
    AGG_MIN: number;
    AGG_MAX: number;
    AggCode: { [agg: string]: number };
    AggLabel: { [agg: string]: string };
    CommandError: string;

    TypeRank(typeChar: string): number;
    CompareGroupKey(
      rankA: number,
      rankB: number,
      sameTypeCompare: number,
      indexA: number,
      indexB: number,
    ): number;
    IsNumericType(typeChar: string): boolean;
    IsBlankType(typeChar: string): boolean;
    AggregateContributesNumeric(typeChar: string): boolean;
    AggregateContributesCountA(typeChar: string): boolean;
    AggregateContributes(aggFn: number, typeChar: string): boolean;
    NextSum(sum: number, contributes: boolean, value: number): number;
    NextCount(count: number, contributes: boolean): number;
    NextMin(min: number, hasMin: boolean, contributes: boolean, value: number): number;
    NextMax(max: number, hasMax: boolean, contributes: boolean, value: number): number;
    AggregateStatus(aggFn: number, numericCount: number): number;
    PlanPivotStatus(
      anchorCol: number,
      anchorRow: number,
      rows: number,
      cols: number,
      maxCol: number,
      maxRow: number,
      maxCells: number,
    ): number;
    ClassifyPivotClaim(
      isAnchorCell: boolean,
      isBlank: boolean,
      isOwnedBySamePivot: boolean,
      isForeignOwned: boolean,
      hasUserContent: boolean,
      isMergedTarget: boolean,
    ): number;

    CellTypeChar(sheet: Sheet, coord: string): string;
    GroupKeyFor(sheet: Sheet, coord: string): PivotTypedGroupKey;
    SameTypeCompare(a: PivotTypedGroupKey, b: PivotTypedGroupKey): number;
    HeaderCellFor(groupKey: PivotTypedGroupKey): { value: string | number; type: string };

    VALID_AGG: { [agg: string]: number };
    ValidateDefinition(definition: PivotDefinition | null | undefined): string;
    IntersectMembers(a: number[], b: number[]): number[];
    BuildTable(sheet: Sheet, definition: PivotDefinition): PivotBuiltTable;
    ColumnHeaderLabel(
      colGroup: PivotGroup,
      definition: PivotDefinition,
      valueField: PivotValueField,
    ): string;
    RenderGrid(built: PivotBuiltTable, definition: PivotDefinition): PivotRenderedGrid;

    RefreshPivot(sheet: Sheet, anchor: string): string;
    RefreshAllPivots(sheet: Sheet): void;
    ClearPivot(sheet: Sheet, anchor: string): boolean;
    ClearAllDerivedPivots(sheet: Sheet): void;
    PivotOwnerForCoord(sheet: Sheet, coord: string): string;
    SanitizePivots(sheet: Sheet): void;
  };

  interface Cell {
    pivotowner?: string;
    pivotrow?: number;
    pivotcol?: number;
    pivotrows?: number;
    pivotcols?: number;
  }

  interface Sheet {
    pivots: { [anchor: string]: PivotDefinition };
  }
}
