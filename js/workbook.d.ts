declare namespace SocialCalc {
  /** One tab-order entry's public metadata (see Workbook.ListSheets). */
  interface WorkbookSheetInfo {
    name: string;
    visible: boolean;
  }

  /** Internal per-sheet registry entry (exposed for host introspection). */
  interface WorkbookSheetEntry {
    /** Display/canonical casing, as supplied by the caller. */
    name: string;
    /** WorkbookNormalizeSheetName(name.trim()) — cache/lookup key. */
    key: string;
    sheet: Sheet;
    visible: boolean;
    /** Opaque LoadEditorSettings-format blob; "" if never set. */
    editorSettings: string;
  }

  /** Fixed-precedence sheet-name validation result codes. */
  interface WorkbookNameValidationCodes {
    OK: number;
    EMPTY: number;
    TOO_LONG: number;
    INVALID_CHARS: number;
    DUPLICATE: number;
  }

  /**
   * Optional in-core multi-sheet workbook container. Owns an ordered set of
   * uniquely-named Sheet instances, the active sheet, per-sheet visibility,
   * a per-sheet opaque editor-settings blob, and a workbook-level undo/redo
   * command log independent of each sheet's own SC.Sheet.changes stack.
   *
   * Entirely additive: constructing/using a Workbook does not alter
   * SocialCalc.Sheet, SocialCalc.SpreadsheetControl's existing single-sheet
   * constructor, or any existing save/load byte format.
   *
   * Declared as interface (not class), matching SpreadsheetViewer's
   * documented convention: implementation assigns a classic
   * `function(...) { this... }` without fighting construct signatures.
   */
  interface Workbook {
    sheetOrder: string[];
    sheets: { [normalizedName: string]: WorkbookSheetEntry };
    activeSheetName: string | null;
    changes: UndoStack;
    statuscallback:
      | ((workbook: Workbook, status: string, arg: unknown, params: unknown) => void)
      | null;
    statuscallbackparams: unknown;

    /** Adds a new (or wraps an existing) sheet; returns a WorkbookNameValidationCodes value. */
    AddSheet(name: string, sheet?: Sheet | null, saveundo?: boolean): number;
    /** Deletes a sheet by name; rewrites other sheets' references to it to #REF!. */
    DeleteSheet(name: string, saveundo?: boolean): boolean;
    /** Renames a sheet, rewriting sheet-qualified formula/name references everywhere. */
    RenameSheet(oldName: string, newName: string, saveundo?: boolean): number;
    /** Moves a sheet to a new zero-based tab position (clamped). */
    ReorderSheet(name: string, newIndex: number, saveundo?: boolean): boolean;
    /** Hides a sheet; refuses to hide the last visible sheet. */
    HideSheet(name: string, saveundo?: boolean): boolean;
    /** Unhides a previously hidden sheet. */
    UnhideSheet(name: string, saveundo?: boolean): boolean;
    /** Sets the active sheet; the sheet must exist and be visible. */
    SetActiveSheet(name: string, saveundo?: boolean): boolean;

    GetSheet(name: string): Sheet | null;
    GetActiveSheet(): Sheet | null;
    IsSheetVisible(name: string): boolean;
    SetSheetEditorSettings(name: string, settings: string): void;
    GetSheetEditorSettings(name: string): string;
    ListSheets(): WorkbookSheetInfo[];

    /** Undoes the most recent workbook-level operation (add/delete/rename/reorder/hide/unhide/active). */
    WorkbookUndo(): void;
    /** Redoes the most recently undone workbook-level operation. */
    WorkbookRedo(): void;

    /**
     * Recalculates every sheet, converging cross-sheet dependency chains
     * across up to sheetOrder.length rounds. Calls callback() once settled.
     */
    RecalcAll(callback?: () => void): void;
  }

  interface WorkbookConstructor {
    new (): Workbook;
    (): Workbook;
    prototype: Workbook;
  }

  var Workbook: WorkbookConstructor;

  function ResetWorkbook(workbook: Workbook): void;

  const WorkbookNameValidation: WorkbookNameValidationCodes;
  const WorkbookMaxSheetNameLength: number;
  const WorkbookForbiddenSheetNameChars: string[];
  function WorkbookNormalizeSheetName(name: string): string;
  function WorkbookValidateSheetName(
    workbook: Workbook,
    name: string,
    excludeKey?: string | null,
  ): number;
  function WorkbookCanHideAnotherSheet(visibleCount: number): boolean;
  function WorkbookCanDeleteAnotherSheet(totalCount: number): boolean;

  function ExecuteWorkbookCommand(workbook: Workbook, cmd: string, saveundo: boolean): void;

  /** Serializes a workbook to the versioned "socialcalc:workbook:version:1.0" envelope. */
  function CreateWorkbookSave(workbook: Workbook): string;

  interface WorkbookSaveManifestEntry {
    name: string;
    visible: boolean;
    editorSettings: string;
  }

  interface WorkbookSaveManifest {
    active: string | null;
    sheets: WorkbookSaveManifestEntry[];
    sheetTexts: string[];
  }

  /** Parses a workbook save string without mutating any workbook; null on malformed input. */
  function DecodeWorkbookSave(str: string): WorkbookSaveManifest | null;
  /** Replaces workbook's entire contents with the decoded save string; no-op if malformed. */
  function LoadWorkbookSave(workbook: Workbook, str: string): void;
}
