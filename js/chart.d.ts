declare namespace SocialCalc {
  interface ChartAxisDomain {
    min: number;
    max: number;
  }

  interface ChartSourceData {
    seriesNames: string[];
    categories: string[];
    series: number[][];
    xValues: number[];
  }

  class ChartObject {
    constructor(id: string);

    id: string;
    /** One of SocialCalc.Chart.TYPE_* numeric codes. */
    charttype: number;
    /** Top-left A1 coordinate the chart is anchored to. */
    anchorcoord: string;
    widthpx: number;
    heightpx: number;
    /** One or more A1 range strings (e.g. ["A1:B5"]). */
    sourceranges: string[];
    /** true: each row of the source is a series; false: each column is a series. */
    seriesinrows: boolean;
    title: string;
    hastitle: boolean;
    haslegend: boolean;
    /** "right" | "bottom" | "none" */
    legendposition: string;
    xaxislabel: string;
    yaxislabel: string;
  }

  const Chart: {
    TYPE_COLUMN: number;
    TYPE_BAR: number;
    TYPE_LINE: number;
    TYPE_AREA: number;
    TYPE_PIE: number;
    TYPE_SCATTER: number;
    TYPE_NAMES: string[];
    PALETTE: string[];
    MIN_SIZE_PX: number;
    MAX_SIZE_PX: number;
    PLACEMENT_OK: number;
    PLACEMENT_ANCHOR_OUT_OF_BOUNDS: number;
    PLACEMENT_INVALID_SIZE: number;

    IsValidChartType: (chartType: number) => boolean;
    IsValidSourceShape: (rows: number, cols: number) => boolean;
    SeriesCount: (rows: number, cols: number, seriesInRows: boolean) => number;
    CategoryCount: (rows: number, cols: number, seriesInRows: boolean) => number;
    MinSeriesForType: (chartType: number) => number;
    IsSourceValidForType: (
      chartType: number,
      rows: number,
      cols: number,
      seriesInRows: boolean,
    ) => boolean;

    DomainMin: (hasPrior: boolean, priorMin: number, value: number) => number;
    DomainMax: (hasPrior: boolean, priorMax: number, value: number) => number;
    ShouldIncludeZeroBaseline: (chartType: number) => boolean;
    BaselineMin: (includeZero: boolean, min: number) => number;
    BaselineMax: (includeZero: boolean, max: number) => number;
    IsDegenerateDomain: (min: number, max: number) => boolean;
    ComputeAxisDomain: (
      chartType: number,
      hasValue: boolean,
      rawMin: number,
      rawMax: number,
    ) => ChartAxisDomain;

    IsWithinSheetBounds: (
      anchorCol: number,
      anchorRow: number,
      maxCol: number,
      maxRow: number,
    ) => boolean;
    IsValidDimension: (px: number) => boolean;
    ClampDimension: (px: number) => number;
    PlanPlacementStatus: (
      anchorCol: number,
      anchorRow: number,
      widthPx: number,
      heightPx: number,
      maxCol: number,
      maxRow: number,
    ) => number;

    SanitizeLabel: (value: unknown, maxLen?: number) => string;
    EscapeSvgText: (s: string) => string;
    EscapeSvgAttr: (s: string) => string;
    PaletteColor: (index: number) => string;

    ExtractSourceData: (sheet: Sheet, chart: ChartObject) => ChartSourceData;
    RenderChartSVG: (sheet: Sheet, chart: ChartObject) => string;

    AdjustAnchorCoord: (
      coord: string,
      col: number,
      coloffset: number,
      row: number,
      rowoffset: number,
    ) => string;
    AdjustChartForStructuralChange: (
      chart: ChartObject,
      col: number,
      coloffset: number,
      row: number,
      rowoffset: number,
    ) => void;
    ReplaceChartCoords: (chart: ChartObject, movedto: { [coord: string]: string }) => void;

    ChartToSaveLine: (chart: ChartObject) => string;
    ChartFromSaveParts: (parts: string[]) => ChartObject;

    /** Mounts/updates one DOM overlay per current sheet.charts entry and
     * removes overlays for deleted charts. Call after every command/
     * recalc (see socialcalctableeditor.ts's EditorSheetStatusCallback).
     * No-op outside a DOM environment. */
    RefreshChartOverlays: (editor: TableEditor) => void;
    /** Opens a minimal DOM chart creation/edit dialog anchored to the
     * editor. Pass an existing chart id to edit it in place. Returns null
     * outside a DOM environment. */
    OpenChartDialog: (editor: TableEditor, existingChartId?: string) => HTMLElement | null;
    /** Issues the `chart delete` command for the overlay's "x" button. */
    DeleteChartFromOverlay: (editor: TableEditor, chartId: string) => void;
    /** Starts a move/resize drag for one chart overlay from a mousedown. */
    StartChartDrag: (
      editor: TableEditor,
      chartId: string,
      event: {
        clientX: number;
        clientY: number;
        preventDefault: () => void;
        stopPropagation: () => void;
      },
      mode: "move" | "resize",
    ) => void;
    /** Document-level mousemove handler for an in-progress chart drag. */
    ChartDragMouseMove: (event: { clientX: number; clientY: number }) => void;
    /** Document-level mouseup handler that commits an in-progress chart drag. */
    ChartDragMouseUp: () => void;
    /** Issues create/set commands from collected chart dialog field values. */
    SubmitChartDialog: (
      editor: TableEditor,
      fields: { sourceranges: string; charttype: string; seriesinrows: boolean; title: string },
      existingChartId?: string,
    ) => void;
    /** Removes a chart dialog overlay element from the DOM. */
    CloseChartDialog: (dialogElement: HTMLElement) => void;
    /** Named click handler for a chart overlay's delete ("x") button. */
    ChartDeleteButtonClick: (event: MouseEvent) => void;
    /** Named mousedown handler for a chart overlay's move/resize handle. */
    ChartHandleMouseDown: (event: MouseEvent) => void;
    /** Named click handler for the dialog's Create/Update button. */
    ChartDialogSubmitButtonClick: (event: MouseEvent) => void;
    /** Named click handler for the dialog's Cancel button. */
    ChartDialogCancelButtonClick: (event: MouseEvent) => void;
  };
}
