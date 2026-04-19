declare namespace SocialCalc {

   class TableEditor {
      constructor(context: any);

      context: any;
      toplevel: HTMLElement | null;
      fullgrid: any;

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

      timeout: any;
      busy: boolean;
      ensureecell: boolean;
      deferredCommands: any[];
      deferredEmailCommands: any[];

      gridposition: any;
      headposition: any;
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

      ecell: any;
      state: string;

      workingvalues: { [key: string]: any };

      imageprefix: string;
      idPrefix: string;
      pageUpDnAmount: number;

      recalcFunction: (editor: TableEditor) => any;
      ctrlkeyFunction: (editor: TableEditor, charname: string) => boolean;

      StatusCallback: { [key: string]: any };
      MoveECellCallback: { [key: string]: any };
      RangeChangeCallback: { [key: string]: any };
      SettingsCallbacks: { [key: string]: any };

      range: any;
      range2: any;

      griddiv: HTMLElement;
      layouttable: HTMLElement;
      pasteTextarea: HTMLTextAreaElement;

      CreateTableEditor(width: number, height: number): HTMLElement;
      ResizeTableEditor(width: number, height: number): void;

      SaveEditorSettings(): string;
      LoadEditorSettings(str: string, flags?: any): void;

      EditorRenderSheet(): void;
      EditorScheduleSheetCommands(cmdstr: string, saveundo: boolean, ignorebusy: boolean): void;
      ScheduleSheetCommands(cmdstr: string, saveundo: boolean): void;
      SheetUndo(): void;
      SheetRedo(): void;
      EditorStepSet(status: any, arg: any): void;
      GetStatuslineString(status: any, arg: any, params: any): string;

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
      ReplaceCell(cell: any, row: number, col: number): void;
      UpdateCellCSS(cell: any, row: number, col: number): void;
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
      interval: any;

      container: HTMLElement;
      main: HTMLElement;
      prompt: HTMLElement;
      hint: HTMLElement;

      functionbox: any;

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
      timer: any;

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

   const EditorMouseInfo: {
      registeredElements: any[];
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
      timer: any;
      mouseinfo: any;
      repeatinterval: number;
      editor: TableEditor | null;
      repeatcallback: any;
      [key: string]: any;
   };

   const DragInfo: {
      registeredElements: any[];
      draggingElement: any;
      startX: number;
      startY: number;
      startZ: any;
      clientX: number;
      clientY: number;
      offsetX: number;
      offsetY: number;
      relativeOffset: { left: number; top: number };
      [key: string]: any;
   };

   const ButtonInfo: {
      registeredElements: any[];
      buttonElement: any;
      doingHover: boolean;
      buttonDown: boolean;
      timer: any;
      relativeOffset: any;
      clientX: number;
      clientY: number;
      [key: string]: any;
   };

   const MouseWheelInfo: {
      registeredElements: any[];
      [key: string]: any;
   };

   const keyboardTables: {
      specialKeysCommon: { [key: number]: string };
      specialKeysIE: { [key: number]: string };
      controlKeysIE: { [key: number]: string };
      specialKeysOpera: { [key: number]: string };
      controlKeysOpera: { [key: number]: string };
      specialKeysSafari: { [key: number]: string };
      controlKeysSafari: { [key: number]: string };
      ignoreKeysSafari: { [key: number]: string };
      specialKeysFirefox: { [key: number]: string };
      controlKeysFirefox: { [key: number]: string };
      ignoreKeysFirefox: { [key: number]: string };
      didProcessKey?: boolean;
      statusFromProcessKey?: boolean;
      repeatingKeyPress?: boolean;
      chForProcessKey?: string;
      [key: string]: any;
   };

   const Keyboard: {
      areListener: boolean;
      focusTable: TableEditor | null;
      passThru: any;
      didProcessKey: boolean;
      statusFromProcessKey: boolean;
      repeatingKeyPress: boolean;
      chForProcessKey: string;
      [key: string]: any;
   };

   function CreateTableEditor(editor: TableEditor, width: number, height: number): HTMLElement;
   function SafariPasteFunction(e: Event): void;
   function ResizeTableEditor(editor: TableEditor, width: number, height: number): void;
   function SaveEditorSettings(editor: TableEditor): string;
   function LoadEditorSettings(editor: TableEditor, str: string, flags?: any): void;
   function EditorRenderSheet(editor: TableEditor): void;
   function EditorScheduleSheetCommands(editor: TableEditor, cmdstr: string, saveundo: boolean, ignorebusy: boolean): void;
   function EditorSheetStatusCallback(recalcdata: any, status: string, arg: any, editor: TableEditor): void;
   function EditorGetStatuslineString(editor: TableEditor, status: string, arg: any, params: any): string;

   function EditorMouseRegister(editor: TableEditor): void;
   function EditorMouseUnregister(editor: TableEditor): void;
   function StopPropagation(event: Event): void;
   function SetMouseMoveUp(move: any, up: any, element: HTMLElement, event: Event): void;
   function RemoveMouseMoveUp(move: any, up: any, element: HTMLElement, event: Event): void;

   function ProcessEditorMouseDown(e: MouseEvent): void;
   function EditorMouseRange(editor: TableEditor, coord: string): void;
   function ProcessEditorMouseMove(e: MouseEvent): void;
   function ProcessEditorMouseUp(e: MouseEvent): any;

   function ProcessEditorColsizeMouseDown(e: MouseEvent, ele: HTMLElement, result: any): void;
   function ProcessEditorColsizeMouseMove(e: MouseEvent): void;
   function ProcessEditorColsizeMouseUp(e: MouseEvent): any;
   function FinishColRowSize(): void;

   function ProcessEditorRowselectMouseDown(e: MouseEvent, ele: HTMLElement, result: any): void;
   function ProcessEditorRowselectMouseMove(e: MouseEvent): void;
   function ProcessEditorRowselectMouseUp(e: MouseEvent): void;

   function ProcessEditorColselectMouseDown(e: MouseEvent, ele: HTMLElement, result: any): void;
   function ProcessEditorColselectMouseMove(e: MouseEvent): void;
   function ProcessEditorColselectMouseUp(e: MouseEvent): void;

   function ProcessEditorRowsizeMouseDown(e: MouseEvent, ele: HTMLElement, result: any): void;
   function ProcessEditorRowsizeMouseMove(e: MouseEvent): void;
   function ProcessEditorRowsizeMouseUp(e: MouseEvent): any;

   function SetDragAutoRepeat(editor: TableEditor, mouseinfo: any, callback?: any): void;
   function DragAutoRepeat(): void;

   function ProcessEditorDblClick(e: MouseEvent): void;
   function EditorOpenCellEdit(editor: TableEditor): any;
   function EditorProcessKey(editor: TableEditor, ch: string, e: KeyboardEvent): boolean;
   function EditorAddToInput(editor: TableEditor, str: string, prefix?: string): void;
   function EditorDisplayCellContents(editor: TableEditor): void;
   function EditorSaveEdit(editor: TableEditor, text?: string): void;
   function EditedTriggerCell(actionFormulaCells: any, editedCellRef: string, editor: TableEditor, sheet: any): void;
   function EditorApplySetCommandsToRange(editor: TableEditor, cmd: string): void;
   function EditorProcessMouseWheel(event: Event, delta: number, mousewheelinfo: any, wobj: any): void;

   function GridMousePosition(editor: TableEditor, clientX: number, clientY: number): any;
   function GetEditorCellElement(editor: TableEditor, row: number, col: number): any;

   function MoveECellWithKey(editor: TableEditor, ch: string): string | null;
   function MoveECell(editor: TableEditor, newcell: string): string;
   function EnsureECellVisible(editor: TableEditor): void;
   function ReplaceCell(editor: TableEditor, cell: any, row: number, col: number): void;
   function UpdateCellCSS(editor: TableEditor, cell: any, row: number, col: number): void;
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
   function InputBoxOnMouseDown(e: MouseEvent): any;

   function ShowInputEcho(inputecho: InputEcho, show: boolean): void;
   function SetInputEchoText(inputecho: InputEcho, str: string): void;
   function InputEchoHeartbeat(): any;
   function InputEchoMouseDown(e: MouseEvent): any;

   function ShowCellHandles(cellhandles: CellHandles, show: boolean, moveshow?: boolean): void;
   function CellHandlesMouseMoveOnHandle(e: MouseEvent): any;
   function SegmentDivHit(segtable: any[], divWithMouseHit: HTMLElement, x: number, y: number): number;
   function CellHandlesHoverTimeout(): any;
   function CellHandlesMouseDown(e: MouseEvent): any;
   function CellHandlesMouseMove(e: MouseEvent): any;
   function CellHandlesDragAutoRepeat(coord: string, direction: string): void;
   function CellHandlesMouseUp(e: MouseEvent): any;

   function CreateTableControl(control: TableControl): HTMLElement;
   function ScrollAreaClick(e: MouseEvent, buttoninfo: any, bobj: any): void;
   function PositionTableControlElements(control: TableControl): void;
   function ComputeTableControlPositions(control: TableControl): void;

   function TCPSDragFunctionStart(event: Event, draginfo: any, dobj: any): void;
   function TCPSDragFunctionMove(event: Event, draginfo: any, dobj: any): void;
   function TCPSDragFunctionStop(event: Event, draginfo: any, dobj: any): void;

   function TCTDragFunctionStart(event: Event, draginfo: any, dobj: any): void;
   function TCTDragFunctionRowSetStatus(draginfo: any, editor: TableEditor, row: number): void;
   function TCTDragFunctionMove(event: Event, draginfo: any, dobj: any): void;
   function TCTDragFunctionStop(event: Event, draginfo: any, dobj: any): void;

   function DragRegister(element: HTMLElement, vertical: boolean, horizontal: boolean, functionobj: any, parent: HTMLElement): void;
   function DragUnregister(element: HTMLElement): void;
   function DragMouseDown(event: MouseEvent): any;
   function DragMouseMove(event: MouseEvent): any;
   function DragMouseUp(event: MouseEvent): any;
   function DragFunctionStart(event: Event, draginfo: any, dobj: any): void;
   function DragFunctionPosition(event: Event, draginfo: any, dobj: any): void;

   function ButtonRegister(editor: TableEditor, element: HTMLElement, paramobj: any, functionobj: any): void;
   function ButtonMouseOver(event: MouseEvent): void;
   function ButtonMouseOut(event: MouseEvent): void;
   function ButtonMouseDown(event: MouseEvent): void;
   function ButtonMouseUp(event: MouseEvent): void;
   function ButtonRepeat(): void;

   function MouseWheelRegister(element: HTMLElement, functionobj: any): void;
   function ProcessMouseWheel(e: Event): void;

   function KeyboardSetFocus(editor: TableEditor): void;
   function KeyboardFocus(): void;
   function ProcessKeyDown(e: KeyboardEvent): boolean;
   function ProcessKeyPress(e: KeyboardEvent): boolean;
   function ProcessKey(ch: string, e: KeyboardEvent): boolean;

}
