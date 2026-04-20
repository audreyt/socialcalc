declare namespace SocialCalc {

   interface ECell {
      coord: string;
      row: number;
      col: number;
   }

   interface EditorRange {
      hasrange: boolean;
      anchorcoord?: string;
      anchorrow?: number;
      anchorcol?: number;
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
   }

   interface EditorRange2 {
      hasrange: boolean;
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
   }

   interface EditorPosition {
      left: number;
      top: number;
      right?: number;
      bottom?: number;
   }

   interface RenderedCellRef {
      element: HTMLElement;
      rowpane: number;
      colpane: number;
   }

   type EditorStatusCallbackFn = (editor: TableEditor, status: string, arg: any, params: any) => void;
   type EditorMoveECellCallbackFn = (editor: TableEditor) => void;
   type EditorRangeChangeCallbackFn = (editor: TableEditor) => void;

   interface EditorStatusCallbackEntry {
      func: EditorStatusCallbackFn;
      params: any;
      [key: string]: any;
   }

   class TableEditor {
      constructor(context: RenderContext);

      context: RenderContext;
      toplevel: HTMLElement | null;
      fullgrid: HTMLElement | null;

      noEdit: boolean;

      width: number | null;
      tablewidth: number | null;
      height: number | null;
      tableheight: number | null;

      inputBox: InputBox | null;
      inputEcho: InputEcho | null;
      verticaltablecontrol: TableControl | null;
      horizontaltablecontrol: TableControl | null;

      logo: HTMLElement | null;

      cellhandles: CellHandles | null;

      timeout: number | null;
      busy: boolean;
      ensureecell: boolean;
      deferredCommands: Array<{ cmdstr: string; saveundo: boolean }>;
      deferredEmailCommands: Array<{ cmdstr: string; saveundo: boolean }>;

      gridposition: EditorPosition | null;
      headposition: EditorPosition | null;
      firstscrollingrow: number | null;
      firstscrollingrowtop: number | null;
      lastnonscrollingrow: number | null;
      lastvisiblerow: number | null;
      firstscrollingcol: number | null;
      firstscrollingcolleft: number | null;
      lastnonscrollingcol: number | null;
      lastvisiblecol: number | null;

      rowpositions: number[];
      colpositions: number[];
      rowheight: number[];
      colwidth: number[];

      ecell: ECell | null;
      state: string;

      workingvalues: { [key: string]: any };

      imageprefix: string;
      idPrefix: string;
      pageUpDnAmount: number;

      recalcFunction: (editor: TableEditor) => any;
      ctrlkeyFunction: (editor: TableEditor, charname: string) => boolean;

      StatusCallback: { [name: string]: EditorStatusCallbackEntry };
      MoveECellCallback: { [name: string]: EditorMoveECellCallbackFn };
      RangeChangeCallback: { [name: string]: EditorRangeChangeCallbackFn };
      SettingsCallbacks: { [key: string]: any };

      range: EditorRange;
      range2: EditorRange2;

      griddiv: HTMLElement;
      layouttable: HTMLElement;
      pasteTextarea: HTMLTextAreaElement;

      CreateTableEditor(width: number, height: number): HTMLElement;
      ResizeTableEditor(width: number, height: number): void;

      SaveEditorSettings(): string;
      LoadEditorSettings(str: string, flags?: { [key: string]: any }): void;

      EditorRenderSheet(): void;
      EditorScheduleSheetCommands(cmdstr: string, saveundo: boolean, ignorebusy: boolean): void;
      ScheduleSheetCommands(cmdstr: string, saveundo: boolean): void;
      SheetUndo(): void;
      SheetRedo(): void;
      EditorStepSet(status: any, arg: any): void;
      GetStatuslineString(status: string, arg: any, params: any): string;

      EditorMouseRegister(): void;
      EditorMouseUnregister(): void;
      EditorMouseRange(coord: string): void;

      EditorProcessKey(ch: string, e: KeyboardEvent): boolean;
      EditorAddToInput(str: string, prefix?: string): void;
      DisplayCellContents(): void;
      EditorSaveEdit(text?: string): void;
      EditorApplySetCommandsToRange(cmdline: string, type?: string): void;

      MoveECellWithKey(ch: string): string | null;
      MoveECell(newcell: string): string;
      ReplaceCell(cell: RenderedCellRef | null, row: number, col: number): void;
      UpdateCellCSS(cell: RenderedCellRef | null, row: number, col: number): void;
      SetECellHeaders(selected: string): void;
      EnsureECellVisible(): void;
      ECellReadonly(coord?: string): boolean;
      RangeAnchor(coord?: string): void;
      RangeExtend(coord?: string): void;
      RangeRemove(): void;
      Range2Remove(): void;

      FitToEditTable(): void;
      CalculateEditorPositions(): void;
      ScheduleRender(renderwidgets?: boolean): void;
      DoRenderStep(): void;
      SchedulePositionCalculations(): void;
      DoPositionCalculations(): void;
      CalculateRowPositions(panenum: number, positions: number[], sizes: number[]): void;
      CalculateColPositions(panenum: number, positions: number[], sizes: number[]): void;

      ScrollRelative(vertical: boolean, amount: number): void;
      ScrollRelativeBoth(vamount: number, hamount: number): void;
      PageRelative(vertical: boolean, direction: number): void;
      LimitLastPanes(): void;

      ScrollTableUpOneRow(): any;
      ScrollTableDownOneRow(): any;
      ScrollTableLeftOneCol(): any;
      ScrollTableRightOneCol(): any;

      StopPropagation(): any;
      SetMouseMoveUp(): any;
      RemoveMouseMoveUp(): any;

      [key: string]: any;
   }

   class InputBox {
      constructor(element: HTMLElement, editor: TableEditor);

      element: HTMLElement;
      editor: TableEditor;
      inputEcho: InputEcho | null;

      DisplayCellContents(coord?: string): void;
      ShowInputBox(show: boolean): void;
      GetText(): string;
      SetText(newtext: string): void;
      Focus(): void;
      Blur(): void;
      Select(t: string): void;

      [key: string]: any;
   }

   class InputEcho {
      constructor(editor: TableEditor);

      editor: TableEditor;
      text: string;
      interval: number | null;

      container: HTMLElement;
      main: HTMLElement;
      prompt: HTMLElement;
      hint: HTMLElement;

      functionbox: HTMLElement | null;

      ShowInputEcho(show: boolean): void;
      SetText(str: string): void;

      [key: string]: any;
   }

   class CellHandles {
      constructor(editor: TableEditor);

      editor: TableEditor;
      noCursorSuffix: boolean;
      movedmouse: boolean;

      draghandle: HTMLElement;
      dragpalette: HTMLElement;
      dragtooltip: HTMLElement;
      fillinghandle: HTMLElement;

      mouseDown: boolean;
      dragtype: string;
      filltype: string | null;
      startingcoord: string;
      startingX: number;
      startingY: number;
      timer: number | null;

      ShowCellHandles(show: boolean, moveshow?: boolean): void;

      [key: string]: any;
   }

   class TableControl {
      constructor(editor: TableEditor, vertical: boolean, size: number);

      editor: TableEditor;
      vertical: boolean;
      size: number;

      main: HTMLElement | null;
      endcap: HTMLElement | null;
      paneslider: HTMLElement | null;
      lessbutton: HTMLElement | null;
      morebutton: HTMLElement | null;
      scrollarea: HTMLElement | null;
      thumb: HTMLElement | null;

      controlborder: number | null;
      endcapstart: number | null;
      panesliderstart: number | null;
      lessbuttonstart: number | null;
      morebuttonstart: number | null;
      scrollareastart: number | null;
      scrollareaend: number | null;
      scrollareasize: number | null;
      thumbpos: number | null;

      controlthickness: number;
      sliderthickness: number;
      buttonthickness: number;
      thumbthickness: number;
      minscrollingpanesize: number;

      CreateTableControl(): HTMLElement;
      PositionTableControlElements(): void;
      ComputeTableControlPositions(): void;

      [key: string]: any;
   }

   interface MouseInfoRegisteredElement {
      element: HTMLElement;
      editor: TableEditor;
      [key: string]: any;
   }

   const EditorMouseInfo: {
      registeredElements: MouseInfoRegisteredElement[];
      editor: TableEditor | null;
      element: HTMLElement | null;
      ignore: boolean;
      mousedowncoord: string;
      mouselastcoord: string;
      mouseresizecol: string;
      mouseresizeclientx: number | null;
      mouseresizedisplay: HTMLElement | null;
      [key: string]: any;
   };

   const AutoRepeatInfo: {
      timer: number | null;
      mouseinfo: { [key: string]: any } | null;
      repeatinterval: number;
      editor: TableEditor | null;
      repeatcallback: ((coord: string, direction: string) => void) | null;
      [key: string]: any;
   };

   interface DragRegisteredElement {
      element: HTMLElement;
      vertical: boolean;
      horizontal: boolean;
      functionobj: { [key: string]: any };
      parent: HTMLElement;
      [key: string]: any;
   }

   const DragInfo: {
      registeredElements: DragRegisteredElement[];
      draggingElement: DragRegisteredElement | null;
      startX: number;
      startY: number;
      startZ: number | string;
      clientX: number;
      clientY: number;
      offsetX: number;
      offsetY: number;
      relativeOffset: { left: number; top: number };
      [key: string]: any;
   };

   interface ButtonRegisteredElement {
      element: HTMLElement;
      editor: TableEditor;
      name?: string;
      normalstyle?: string;
      hoverstyle?: string;
      downstyle?: string;
      repeatwait?: number;
      repeatinterval?: number;
      functionobj: { [key: string]: any };
      [key: string]: any;
   }

   const ButtonInfo: {
      registeredElements: ButtonRegisteredElement[];
      buttonElement: ButtonRegisteredElement | null;
      doingHover: boolean;
      buttonDown: boolean;
      timer: number | null;
      relativeOffset: { left: number; top: number } | null;
      clientX: number;
      clientY: number;
      [key: string]: any;
   };

   interface MouseWheelRegisteredElement {
      element: HTMLElement;
      functionobj: { [key: string]: any };
      [key: string]: any;
   }

   const MouseWheelInfo: {
      registeredElements: MouseWheelRegisteredElement[];
      [key: string]: any;
   };

   const keyboardTables: {
      specialKeysCommon: { [key: number]: string };
      controlKeysIE: { [key: number]: string };
      specialKeysOpera: { [key: number]: string };
      controlKeysOpera: { [key: number]: string };
      specialKeysSafari: { [key: number]: string };
      controlKeysSafari: { [key: number]: string };
      ignoreKeysSafari: { [key: number]: string };
      specialKeysFirefox: { [key: number]: string };
      controlKeysFirefox: { [key: number]: string };
      didProcessKey?: boolean;
      statusFromProcessKey?: boolean;
      repeatingKeyPress?: boolean;
      chForProcessKey?: string;
      [key: string]: any;
   };

   const Keyboard: {
      areListener: boolean;
      focusTable: TableEditor | null;
      passThru: HTMLElement | boolean | null;
      didProcessKey: boolean;
      statusFromProcessKey: boolean;
      repeatingKeyPress: boolean;
      chForProcessKey: string;
      [key: string]: any;
   };

   type MouseEventHandler = (e: MouseEvent) => any;
   type DragFunctionHandler = (event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement) => void;

   interface DragFunctionObject {
      MouseDown?: DragFunctionHandler;
      MouseMove?: DragFunctionHandler;
      MouseUp?: DragFunctionHandler;
      Disabled?: (() => boolean) | null;
      [key: string]: any;
   }

   interface ButtonParamObject {
      name?: string;
      normalstyle?: string;
      hoverstyle?: string;
      downstyle?: string;
      repeatwait?: number;
      repeatinterval?: number;
      [key: string]: any;
   }

   interface ButtonFunctionObject {
      MouseDown?: (e: MouseEvent, buttoninfo: typeof ButtonInfo, bobj: ButtonRegisteredElement) => void;
      MouseUp?: (e: MouseEvent, buttoninfo: typeof ButtonInfo, bobj: ButtonRegisteredElement) => void;
      Repeat?: (e: MouseEvent, buttoninfo: typeof ButtonInfo, bobj: ButtonRegisteredElement) => void;
      Disabled?: (() => boolean) | null;
      [key: string]: any;
   }

   interface MouseWheelFunctionObject {
      WheelMove?: (event: Event, delta: number, mousewheelinfo: typeof MouseWheelInfo, wobj: MouseWheelRegisteredElement) => void;
      [key: string]: any;
   }

   interface GridMousePositionResult {
      row: number;
      col: number;
      coord?: string;
      rowheader?: boolean;
      colheader?: boolean;
      rowfooter?: boolean;
      colfooter?: boolean;
      coltoresize?: number;
      rowtoresize?: number;
      distance?: number;
      [key: string]: any;
   }

   function CreateTableEditor(editor: TableEditor, width: number, height: number): HTMLElement;
   function SafariPasteFunction(e: Event): void;
   function ResizeTableEditor(editor: TableEditor, width: number, height: number): void;
   function SaveEditorSettings(editor: TableEditor): string;
   function LoadEditorSettings(editor: TableEditor, str: string, flags?: { [key: string]: any }): void;
   function EditorRenderSheet(editor: TableEditor): void;
   function EditorScheduleSheetCommands(editor: TableEditor, cmdstr: string, saveundo: boolean, ignorebusy: boolean): void;
   function EditorSheetStatusCallback(recalcdata: any, status: string, arg: any, editor: TableEditor): void;
   function EditorGetStatuslineString(editor: TableEditor, status: string, arg: any, params: any): string;

   function EditorMouseRegister(editor: TableEditor): void;
   function EditorMouseUnregister(editor: TableEditor): void;
   function StopPropagation(event: Event): void;
   function SetMouseMoveUp(move: MouseEventHandler, up: MouseEventHandler, element: HTMLElement, event: Event): void;
   function RemoveMouseMoveUp(move: MouseEventHandler, up: MouseEventHandler, element: HTMLElement, event: Event): void;

   function ProcessEditorMouseDown(e: MouseEvent): void;
   function EditorMouseRange(editor: TableEditor, coord: string): void;
   function ProcessEditorMouseMove(e: MouseEvent): void;
   function ProcessEditorMouseUp(e: MouseEvent): any;

   function ProcessEditorColsizeMouseDown(e: MouseEvent, ele: HTMLElement, result: GridMousePositionResult): void;
   function ProcessEditorColsizeMouseMove(e: MouseEvent): void;
   function ProcessEditorColsizeMouseUp(e: MouseEvent): any;
   function FinishColRowSize(): void;

   function ProcessEditorRowselectMouseDown(e: MouseEvent, ele: HTMLElement, result: GridMousePositionResult): void;
   function ProcessEditorRowselectMouseMove(e: MouseEvent): void;
   function ProcessEditorRowselectMouseUp(e: MouseEvent): void;

   function ProcessEditorColselectMouseDown(e: MouseEvent, ele: HTMLElement, result: GridMousePositionResult): void;
   function ProcessEditorColselectMouseMove(e: MouseEvent): void;
   function ProcessEditorColselectMouseUp(e: MouseEvent): void;

   function ProcessEditorRowsizeMouseDown(e: MouseEvent, ele: HTMLElement, result: GridMousePositionResult): void;
   function ProcessEditorRowsizeMouseMove(e: MouseEvent): void;
   function ProcessEditorRowsizeMouseUp(e: MouseEvent): any;

   function SetDragAutoRepeat(editor: TableEditor, mouseinfo: { [key: string]: any } | null, callback?: ((coord: string, direction: string) => void) | null): void;
   function DragAutoRepeat(): void;

   function ProcessEditorDblClick(e: MouseEvent): void;
   function EditorOpenCellEdit(editor: TableEditor): boolean | void;
   function EditorProcessKey(editor: TableEditor, ch: string, e: KeyboardEvent): boolean;
   function EditorAddToInput(editor: TableEditor, str: string, prefix?: string): void;
   function EditorDisplayCellContents(editor: TableEditor): void;
   function EditorSaveEdit(editor: TableEditor, text?: string): void;
   function EditedTriggerCell(actionFormulaCells: { [key: string]: any }, editedCellRef: string, editor: TableEditor, sheet: Sheet): void;
   function EditorApplySetCommandsToRange(editor: TableEditor, cmd: string): void;
   function EditorProcessMouseWheel(event: Event, delta: number, mousewheelinfo: MouseWheelRegisteredElement, wobj: MouseWheelRegisteredElement): void;

   function GridMousePosition(editor: TableEditor, clientX: number, clientY: number): GridMousePositionResult;
   function GetEditorCellElement(editor: TableEditor, row: number, col: number): RenderedCellRef | null;

   function MoveECellWithKey(editor: TableEditor, ch: string): string | null;
   function MoveECell(editor: TableEditor, newcell: string): string;
   function EnsureECellVisible(editor: TableEditor): void;
   function ReplaceCell(editor: TableEditor, cell: RenderedCellRef | null, row: number, col: number): void;
   function UpdateCellCSS(editor: TableEditor, cell: RenderedCellRef | null, row: number, col: number): void;
   function SetECellHeaders(editor: TableEditor, selected: string): void;
   function ECellReadonly(editor: TableEditor, ecoord?: string): boolean;
   function RangeAnchor(editor: TableEditor, ecoord?: string): void;
   function RangeExtend(editor: TableEditor, ecoord?: string): void;
   function RangeRemove(editor: TableEditor): void;
   function Range2Remove(editor: TableEditor): void;

   function FitToEditTable(editor: TableEditor): void;
   function CalculateEditorPositions(editor: TableEditor): void;
   function ScheduleRender(editor: TableEditor): void;
   function DoRenderStep(editor: TableEditor): void;
   function SchedulePositionCalculations(editor: TableEditor): void;
   function DoPositionCalculations(editor: TableEditor): void;
   function CalculateRowPositions(editor: TableEditor, panenum: number, positions: number[], sizes: number[]): void;
   function CalculateColPositions(editor: TableEditor, panenum: number, positions: number[], sizes: number[]): void;

   function ScrollRelative(editor: TableEditor, vertical: boolean, amount: number): void;
   function ScrollRelativeBoth(editor: TableEditor, vamount: number, hamount: number): void;
   function PageRelative(editor: TableEditor, vertical: boolean, direction: number): void;
   function LimitLastPanes(editor: TableEditor): void;

   function ScrollTableUpOneRow(editor: TableEditor): any;
   function ScrollTableDownOneRow(editor: TableEditor): any;

   function InputBoxDisplayCellContents(inputbox: InputBox, coord?: string): void;
   function InputBoxFocus(inputbox: InputBox): void;
   function InputBoxOnMouseDown(e: MouseEvent): boolean | void;

   function ShowInputEcho(inputecho: InputEcho, show: boolean): void;
   function SetInputEchoText(inputecho: InputEcho, str: string): void;
   function InputEchoHeartbeat(): void;
   function InputEchoMouseDown(e: MouseEvent): boolean | void;

   function ShowCellHandles(cellhandles: CellHandles, show: boolean, moveshow?: boolean): void;
   function CellHandlesMouseMoveOnHandle(e: MouseEvent): void;
   function SegmentDivHit(segtable: Array<number | string | any[]>, divWithMouseHit: HTMLElement, x: number, y: number): number;
   function CellHandlesHoverTimeout(): void;
   function CellHandlesMouseDown(e: MouseEvent): boolean | void;
   function CellHandlesMouseMove(e: MouseEvent): boolean | void;
   function CellHandlesDragAutoRepeat(coord: string, direction: string): void;
   function CellHandlesMouseUp(e: MouseEvent): boolean | void;

   function CreateTableControl(control: TableControl): HTMLElement;
   function ScrollAreaClick(e: MouseEvent, buttoninfo: typeof ButtonInfo, bobj: ButtonRegisteredElement): void;
   function PositionTableControlElements(control: TableControl): void;
   function ComputeTableControlPositions(control: TableControl): void;

   function TCPSDragFunctionStart(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;
   function TCPSDragFunctionMove(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;
   function TCPSDragFunctionStop(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;

   function TCTDragFunctionStart(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;
   function TCTDragFunctionRowSetStatus(draginfo: typeof DragInfo, editor: TableEditor, row: number): void;
   function TCTDragFunctionMove(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;
   function TCTDragFunctionStop(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;

   function DragRegister(element: HTMLElement, vertical: boolean, horizontal: boolean, functionobj: DragFunctionObject | null, parent: HTMLElement): void;
   function DragUnregister(element: HTMLElement): void;
   function DragMouseDown(event: MouseEvent): any;
   function DragMouseMove(event: MouseEvent): any;
   function DragMouseUp(event: MouseEvent): any;
   function DragFunctionStart(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;
   function DragFunctionPosition(event: Event, draginfo: typeof DragInfo, dobj: DragRegisteredElement): void;

   function ButtonRegister(editor: TableEditor, element: HTMLElement, paramobj: ButtonParamObject | null, functionobj: ButtonFunctionObject | null): void;
   function ButtonMouseOver(event: MouseEvent): void;
   function ButtonMouseOut(event: MouseEvent): void;
   function ButtonMouseDown(event: MouseEvent): void;
   function ButtonMouseUp(event: MouseEvent): void;
   function ButtonRepeat(): void;

   function MouseWheelRegister(element: HTMLElement, functionobj: MouseWheelFunctionObject): void;
   function ProcessMouseWheel(e: Event): void;

   function KeyboardSetFocus(editor: TableEditor): void;
   function KeyboardFocus(): void;
   function ProcessKeyDown(e: KeyboardEvent): boolean;
   function ProcessKeyPress(e: KeyboardEvent): boolean;
   function ProcessKey(ch: string, e: KeyboardEvent): boolean;

}
