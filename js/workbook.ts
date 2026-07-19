// Optional in-core multi-sheet workbook container.
// Shipping source (not a parallel oracle). Concatenated after socialcalc-3.js
// (needs SocialCalc.Sheet/UndoStack), formula1.js/formula-operand.js (needs
// SocialCalc.Formula.NormalizeSheetName/SheetCache), and formula-ref.js
// (needs SocialCalc.RewriteSheetNameInFormula). Pure addition: no existing
// single-sheet API, save format, or byte output is touched by this file.
//
// A SocialCalc.Workbook is an ordered collection of uniquely-named
// SocialCalc.Sheet instances plus workbook-level metadata (active sheet,
// visibility, per-sheet editor-settings blob, workbook-level undo/redo).
// Using SocialCalc.Workbook is entirely opt-in: SocialCalc.Sheet,
// SocialCalc.SpreadsheetControl's single-sheet constructor, and every
// existing save/load byte format are unaffected by this module's presence.
//
// (c) Copyright 2026 SocialCalc contributors.
// Artistic License 2.0: http://socialcalc.org/licenses/al-20/.

// Runtime root is created by module-wrapper-top.js. Ambient declare namespace is
// types-only; progressive assignment of these members uses a named mutable view
// so we never redeclare `var SocialCalc` (which collapses the namespace in tsc).
// Follows socialcalcviewer.ts's WorkbookConstructor-as-interface pattern:
// implementation assigns a classic `function(...) { this... }`.
type WorkbookMutableRoot = {
  Workbook: SocialCalc.WorkbookConstructor;
  ResetWorkbook: (workbook: SocialCalc.Workbook) => void;
  WorkbookNameValidation: SocialCalc.WorkbookNameValidationCodes;
  WorkbookMaxSheetNameLength: number;
  WorkbookForbiddenSheetNameChars: string[];
  WorkbookNormalizeSheetName: (name: string) => string;
  WorkbookValidateSheetName: (
    workbook: SocialCalc.Workbook,
    name: string,
    excludeKey?: string | null,
  ) => number;
  WorkbookCanHideAnotherSheet: (visibleCount: number) => boolean;
  WorkbookCanDeleteAnotherSheet: (totalCount: number) => boolean;
  ExecuteWorkbookCommand: (workbook: SocialCalc.Workbook, cmd: string, saveundo: boolean) => void;
  CreateWorkbookSave: (workbook: SocialCalc.Workbook) => string;
  DecodeWorkbookSave: (str: string) => SocialCalc.WorkbookSaveManifest | null;
  LoadWorkbookSave: (workbook: SocialCalc.Workbook, str: string) => void;
};
const WorkbookRoot = SocialCalc as unknown as WorkbookMutableRoot;

// *************************************
//
// Name validation (mirrors lemma/workbook.ts's verified precedence exactly;
// see test/lemma-workbook-facade.test.ts for the cross-check oracle).
//
// *************************************

WorkbookRoot.WorkbookNameValidation = {
  OK: 0,
  EMPTY: 1,
  TOO_LONG: 2,
  INVALID_CHARS: 3,
  DUPLICATE: 4,
};

WorkbookRoot.WorkbookMaxSheetNameLength = 255;

// Forbidden because each character has meaning in the sheet save format
// and/or formula syntax (":" line-type separator, "!" sheet-qualifier,
// quote/bracket characters used for quoted sheet-name tokens).
WorkbookRoot.WorkbookForbiddenSheetNameChars = [":", "!", "'", '"', "[", "]", "\\", "/", "?", "*"];

/**
 * Case/whitespace-insensitive key used for uniqueness comparisons and for
 * SocialCalc.Formula.SheetCache registration. Delegates to
 * SocialCalc.Formula.NormalizeSheetName (host-overridable via
 * SocialCalc.Callbacks.NormalizeSheetName) so a workbook sheet name and a
 * `SheetName!A1` formula reference to it always resolve to the same key.
 */
WorkbookRoot.WorkbookNormalizeSheetName = function (name: string): string {
  return SocialCalc.Formula.NormalizeSheetName(name.trim());
};

/**
 * Fixed-precedence sheet-name validation: empty, then too-long, then
 * invalid-chars, then duplicate, else OK. excludeKey lets rename validate a
 * name against every OTHER sheet (a no-op rename to the same name is valid).
 */
WorkbookRoot.WorkbookValidateSheetName = function (
  workbook: SocialCalc.Workbook,
  name: string,
  excludeKey?: string | null,
): number {
  const wv = WorkbookRoot.WorkbookNameValidation;
  const trimmed = name.trim();
  if (trimmed.length === 0) return wv.EMPTY;
  if (name.length > WorkbookRoot.WorkbookMaxSheetNameLength) return wv.TOO_LONG;
  const forbidden = WorkbookRoot.WorkbookForbiddenSheetNameChars;
  for (let i = 0; i < name.length; i++) {
    if (forbidden.indexOf(name.charAt(i)) !== -1) return wv.INVALID_CHARS;
  }
  const key = WorkbookRoot.WorkbookNormalizeSheetName(trimmed);
  const existing = workbook.sheets[key];
  if (existing && key !== excludeKey) return wv.DUPLICATE;
  return wv.OK;
};

/** Whether hiding one more sheet keeps at least one sheet visible. */
WorkbookRoot.WorkbookCanHideAnotherSheet = function (visibleCount: number): boolean {
  return visibleCount > 1;
};

/** Whether a workbook may delete one more sheet (must always keep >= 1). */
WorkbookRoot.WorkbookCanDeleteAnotherSheet = function (totalCount: number): boolean {
  return totalCount > 1;
};

// *************************************
//
// Class SocialCalc.Workbook
//
// Usage: var wb = new SocialCalc.Workbook();
//
// *************************************

WorkbookRoot.Workbook = function (this: SocialCalc.Workbook) {
  SocialCalc.ResetWorkbook(this);
} as unknown as SocialCalc.WorkbookConstructor;

WorkbookRoot.ResetWorkbook = function (workbook: SocialCalc.Workbook): void {
  workbook.sheetOrder = []; // array of canonical (display-casing) sheet names, in tab order
  workbook.sheets = {}; // key (normalized name) -> WorkbookSheetEntry
  workbook.activeSheetName = null; // canonical name of the active sheet, or null if empty
  workbook.changes = new SocialCalc.UndoStack(); // workbook-level command audit/undo (separate from each sheet's own)
  workbook.statuscallback = null; // workbook.statuscallback(workbook, status, arg, params)
  workbook.statuscallbackparams = null;
};

function wbEntry(
  workbook: SocialCalc.Workbook,
  key: string,
): SocialCalc.WorkbookSheetEntry | undefined {
  return workbook.sheets[key];
}

function wbStatus(workbook: SocialCalc.Workbook, status: string, arg: unknown): void {
  if (workbook.statuscallback) {
    workbook.statuscallback(workbook, status, arg, workbook.statuscallbackparams);
  }
}

/**
 * Registers/re-registers a sheet directly into the shared, process-wide
 * SocialCalc.Formula.SheetCache so cross-sheet formula references
 * (`SheetName!A1`) resolve synchronously with no async LoadSheet round trip
 * — every workbook sheet is already resident in memory. Because SheetCache
 * is a single shared global (matching the rest of this library's existing
 * singleton RecalcInfo/Formula design), only one workbook's sheets should be
 * "live" registrants for a given name at a time; AddSheet/RenameSheet/
 * DeleteSheet keep the cache in sync with this workbook's current registry.
 */
function wbCacheRegister(key: string, sheet: SocialCalc.Sheet): void {
  const sfsc = SocialCalc.Formula.SheetCache;
  sfsc.sheets[key] = { sheet: sheet, recalcstate: sfsc.constants.asloaded, name: key };
}

function wbCacheUnregister(key: string): void {
  delete SocialCalc.Formula.SheetCache.sheets[key];
}

// *************************************
//
// Sheet-name rewrite across the whole workbook (rename/delete).
//
// *************************************

function wbRewriteSheetFormulas(
  sheet: SocialCalc.Sheet,
  oldName: string,
  newName: string | null,
): void {
  const normalize = WorkbookRoot.WorkbookNormalizeSheetName;
  for (const coord in sheet.cells) {
    const cell = sheet.cells[coord];
    if (!cell || cell.datatype !== "f") continue;
    const oldformula = cell.formula;
    const newformula = SocialCalc.RewriteSheetNameInFormula(
      oldformula,
      oldName,
      newName,
      normalize,
    );
    if (newformula !== oldformula) {
      cell.formula = newformula;
      delete cell.parseinfo;
    }
  }
  for (const name in sheet.names) {
    const def = sheet.names[name].definition;
    let prefix = "";
    let body = def;
    if (body.charAt(0) === "=") {
      prefix = "=";
      body = body.substring(1);
    }
    const newbody = SocialCalc.RewriteSheetNameInFormula(body, oldName, newName, normalize);
    if (newbody !== body) {
      sheet.names[name].definition = prefix + newbody;
    }
  }
}

/** Snapshots every formula cell's current text ("" bodies excluded) for undo-diffing. */
function wbSnapshotFormulas(sheet: SocialCalc.Sheet): { [coord: string]: string } {
  const before: { [coord: string]: string } = {};
  for (const coord in sheet.cells) {
    const cell = sheet.cells[coord];
    if (cell && cell.datatype === "f") before[coord] = cell.formula;
  }
  return before;
}

/** Emits "workbook restoreformula" undo lines for every formula that changed vs. `before`. */
function wbDiffFormulasIntoUndo(
  workbook: SocialCalc.Workbook,
  sheetName: string,
  sheet: SocialCalc.Sheet,
  before: { [coord: string]: string },
): void {
  for (const coord in before) {
    const cell = sheet.cells[coord];
    if (cell.formula !== before[coord]) {
      workbook.changes.AddUndo(
        "workbook restoreformula " +
          SocialCalc.encodeForSave(sheetName) +
          " " +
          coord +
          " " +
          SocialCalc.encodeForSave(before[coord]),
      );
    }
  }
}

// *************************************
//
// Registry operations. Each mutating operation pushes exactly one workbook-
// level undo/redo transaction (workbook.changes.PushChange), mirroring the
// sheet-level command pattern (SC.ExecuteSheetCommand + SC.UndoStack).
//
// *************************************

/**
 * Adds a new sheet named `name` to the workbook (or wraps an existing
 * SocialCalc.Sheet instance, if `sheet` is supplied) at the end of the tab
 * order, becomes active if this is the first sheet. Returns the validation
 * code (WorkbookNameValidation.OK on success).
 */
WorkbookRoot.Workbook.prototype.AddSheet = function (
  this: SocialCalc.Workbook,
  name: string,
  sheet?: SocialCalc.Sheet | null,
  saveundo = true,
): number {
  const code = SocialCalc.WorkbookValidateSheetName(this, name);
  if (code !== SocialCalc.WorkbookNameValidation.OK) return code;

  const trimmed = name.trim();
  const key = SocialCalc.WorkbookNormalizeSheetName(trimmed);
  const newSheet = sheet || new SocialCalc.Sheet();
  const entry: SocialCalc.WorkbookSheetEntry = {
    name: trimmed,
    key: key,
    sheet: newSheet,
    visible: true,
    editorSettings: "",
  };
  this.sheets[key] = entry;
  this.sheetOrder.push(trimmed);
  wbCacheRegister(key, newSheet);

  if (this.activeSheetName == null) {
    this.activeSheetName = trimmed;
  }

  if (saveundo) {
    this.changes.PushChange("addsheet");
    this.changes.AddDo("workbook addsheet " + SocialCalc.encodeForSave(trimmed));
    this.changes.AddUndo("workbook deletesheet " + SocialCalc.encodeForSave(trimmed));
  }

  wbStatus(this, "addsheet", { name: trimmed });
  return SocialCalc.WorkbookNameValidation.OK;
};

/**
 * Deletes the sheet named `name`. Every remaining sheet's formulas/names
 * that referenced the deleted sheet are rewritten to #REF! (matches the
 * existing delete-band #REF! policy in AdjustFormulaCoords). Refuses to
 * delete the last remaining sheet OR the last remaining VISIBLE sheet
 * (invariants: a workbook always has >= 1 sheet, and its active sheet is
 * always visible — deleting the only visible sheet while others are hidden
 * would otherwise strand the active pointer on a hidden sheet). Returns
 * true on success.
 */
WorkbookRoot.Workbook.prototype.DeleteSheet = function (
  this: SocialCalc.Workbook,
  name: string,
  saveundo = true,
): boolean {
  const key = SocialCalc.WorkbookNormalizeSheetName(name);
  const entry = wbEntry(this, key);
  if (!entry) return false;
  if (!SocialCalc.WorkbookCanDeleteAnotherSheet(this.sheetOrder.length)) return false;
  if (entry.visible) {
    let visibleCount = 0;
    for (const n of this.sheetOrder) {
      if (this.sheets[SocialCalc.WorkbookNormalizeSheetName(n)].visible) visibleCount++;
    }
    if (!SocialCalc.WorkbookCanHideAnotherSheet(visibleCount)) return false;
  }

  const deletedIndex = this.sheetOrder.indexOf(entry.name);
  const wasActive = this.activeSheetName === entry.name;
  const savedSheetText = entry.sheet.CreateSheetSave();
  const savedVisible = entry.visible;
  const savedEditorSettings = entry.editorSettings;

  if (saveundo) this.changes.PushChange("deletesheet");

  // Rewrite references in every OTHER sheet to #REF!.
  for (const otherKey in this.sheets) {
    if (otherKey === key) continue;
    const other = this.sheets[otherKey];
    const before = saveundo ? wbSnapshotFormulas(other.sheet) : {};
    wbRewriteSheetFormulas(other.sheet, entry.name, null);
    if (saveundo) wbDiffFormulasIntoUndo(this, other.name, other.sheet, before);
  }

  delete this.sheets[key];
  this.sheetOrder.splice(deletedIndex, 1);
  wbCacheUnregister(key);

  if (wasActive) {
    // Select the nearest remaining VISIBLE sheet (next in tab order, else
    // previous), mirroring HideSheet's active-reselection policy — never
    // land the active pointer on a hidden sheet. The guards above ensure
    // at least one visible sheet still exists.
    let next: string | null = null;
    for (let i = deletedIndex; i < this.sheetOrder.length; i++) {
      const n = this.sheetOrder[i]!;
      if (this.sheets[SocialCalc.WorkbookNormalizeSheetName(n)].visible) {
        next = n;
        break;
      }
    }
    if (next == null) {
      for (let i = deletedIndex - 1; i >= 0; i--) {
        const n = this.sheetOrder[i]!;
        if (this.sheets[SocialCalc.WorkbookNormalizeSheetName(n)].visible) {
          next = n;
          break;
        }
      }
    }
    this.activeSheetName = next;
  }

  if (saveundo) {
    this.changes.AddDo("workbook deletesheet " + SocialCalc.encodeForSave(entry.name));
    // Undo replay order is LAST-added-first (see WorkbookUndo), mirroring
    // SheetUndo's reversed concatenation. "setactivesheet" is added BEFORE
    // "restoresheet" so restoresheet (added last) executes FIRST on undo —
    // otherwise SetActiveSheet would run against a not-yet-restored (still
    // absent) sheet and silently no-op.
    if (wasActive) {
      this.changes.AddUndo("workbook setactivesheet " + SocialCalc.encodeForSave(entry.name));
    }
    this.changes.AddUndo(
      "workbook restoresheet " +
        SocialCalc.encodeForSave(entry.name) +
        " " +
        deletedIndex +
        " " +
        (savedVisible ? "yes" : "no") +
        " " +
        SocialCalc.encodeForSave(savedEditorSettings) +
        " " +
        SocialCalc.encodeForSave(savedSheetText),
    );
  }

  wbStatus(this, "deletesheet", { name: entry.name });
  return true;
};

/**
 * Renames sheet `oldName` to `newName`, rewriting sheet-qualified formula
 * and named-range references to it (in every sheet, including itself) so
 * they keep pointing at the same sheet. Returns the validation code
 * (WorkbookNameValidation.OK on success).
 */
WorkbookRoot.Workbook.prototype.RenameSheet = function (
  this: SocialCalc.Workbook,
  oldName: string,
  newName: string,
  saveundo = true,
): number {
  const oldKey = SocialCalc.WorkbookNormalizeSheetName(oldName);
  const entry = wbEntry(this, oldKey);
  if (!entry) return SocialCalc.WorkbookNameValidation.EMPTY; // not found: treat like an invalid target

  const code = SocialCalc.WorkbookValidateSheetName(this, newName, oldKey);
  if (code !== SocialCalc.WorkbookNameValidation.OK) return code;

  const trimmedNew = newName.trim();
  const newKey = SocialCalc.WorkbookNormalizeSheetName(trimmedNew);
  const originalName = entry.name;

  if (saveundo) this.changes.PushChange("renamesheet");

  for (const anyKey in this.sheets) {
    const target = this.sheets[anyKey];
    const before = saveundo ? wbSnapshotFormulas(target.sheet) : {};
    wbRewriteSheetFormulas(target.sheet, originalName, trimmedNew);
    if (saveundo) wbDiffFormulasIntoUndo(this, target.name, target.sheet, before);
  }

  delete this.sheets[oldKey];
  wbCacheUnregister(oldKey);
  entry.name = trimmedNew;
  entry.key = newKey;
  this.sheets[newKey] = entry;
  wbCacheRegister(newKey, entry.sheet);

  // entry was found via wbEntry(oldKey) above, so its display name is
  // guaranteed present in sheetOrder under the same normalized key.
  const orderIdx = this.sheetOrder.findIndex(
    (n) => SocialCalc.WorkbookNormalizeSheetName(n) === oldKey,
  );
  this.sheetOrder[orderIdx] = trimmedNew;

  // activeSheetName is always non-null once any sheet exists (see
  // SetActiveSheet's `previous` invariant comment above).
  if (this.activeSheetName === originalName) {
    this.activeSheetName = trimmedNew;
  }

  if (saveundo) {
    this.changes.AddDo(
      "workbook renamesheet " +
        SocialCalc.encodeForSave(originalName) +
        " " +
        SocialCalc.encodeForSave(trimmedNew),
    );
    this.changes.AddUndo(
      "workbook renamesheet " +
        SocialCalc.encodeForSave(trimmedNew) +
        " " +
        SocialCalc.encodeForSave(originalName),
    );
  }

  wbStatus(this, "renamesheet", { oldName: originalName, newName: trimmedNew });
  return SocialCalc.WorkbookNameValidation.OK;
};

/**
 * Moves sheet `name` to zero-based position `newIndex` in the tab order
 * (clamped into [0, sheetOrder.length-1]).
 */
WorkbookRoot.Workbook.prototype.ReorderSheet = function (
  this: SocialCalc.Workbook,
  name: string,
  newIndex: number,
  saveundo = true,
): boolean {
  const key = SocialCalc.WorkbookNormalizeSheetName(name);
  const entry = wbEntry(this, key);
  if (!entry) return false;

  const oldIndex = this.sheetOrder.indexOf(entry.name);
  let clamped = newIndex;
  if (clamped < 0) clamped = 0;
  if (clamped > this.sheetOrder.length - 1) clamped = this.sheetOrder.length - 1;
  if (clamped === oldIndex) return true;

  this.sheetOrder.splice(oldIndex, 1);
  this.sheetOrder.splice(clamped, 0, entry.name);

  if (saveundo) {
    this.changes.PushChange("reordersheet");
    this.changes.AddDo(
      "workbook reordersheet " + SocialCalc.encodeForSave(entry.name) + " " + clamped,
    );
    this.changes.AddUndo(
      "workbook reordersheet " + SocialCalc.encodeForSave(entry.name) + " " + oldIndex,
    );
  }

  wbStatus(this, "reordersheet", { name: entry.name, index: clamped });
  return true;
};

/**
 * Hides sheet `name`. Refuses to hide the last visible sheet (invariant: a
 * workbook always has >= 1 visible sheet). If the hidden sheet was active,
 * the active pointer moves to the nearest visible sheet (next, else
 * previous, in tab order).
 */
WorkbookRoot.Workbook.prototype.HideSheet = function (
  this: SocialCalc.Workbook,
  name: string,
  saveundo = true,
): boolean {
  const key = SocialCalc.WorkbookNormalizeSheetName(name);
  const entry = wbEntry(this, key);
  if (!entry || !entry.visible) return false;

  let visibleCount = 0;
  for (const n of this.sheetOrder) {
    if (this.sheets[SocialCalc.WorkbookNormalizeSheetName(n)].visible) visibleCount++;
  }
  if (!SocialCalc.WorkbookCanHideAnotherSheet(visibleCount)) return false;

  entry.visible = false;

  const wasActive = this.activeSheetName === entry.name;
  if (wasActive) {
    const idx = this.sheetOrder.indexOf(entry.name);
    let next: string | null = null;
    for (let i = idx + 1; i < this.sheetOrder.length; i++) {
      const n = this.sheetOrder[i];
      if (this.sheets[SocialCalc.WorkbookNormalizeSheetName(n)].visible) {
        next = n;
        break;
      }
    }
    if (next == null) {
      for (let i = idx - 1; i >= 0; i--) {
        const n = this.sheetOrder[i];
        if (this.sheets[SocialCalc.WorkbookNormalizeSheetName(n)].visible) {
          next = n;
          break;
        }
      }
    }
    this.activeSheetName = next;
  }

  if (saveundo) {
    this.changes.PushChange("hidesheet");
    this.changes.AddDo("workbook hidesheet " + SocialCalc.encodeForSave(entry.name));
    // Undo replay order is LAST-added-first (see WorkbookUndo). The sheet
    // must be unhidden (visible again) BEFORE SetActiveSheet can target it
    // (SetActiveSheet requires entry.visible) — so "setactivesheet" is
    // added BEFORE "unhidesheet" here, making unhidesheet (added last)
    // execute FIRST on undo.
    if (wasActive) {
      // wasActive === true means activeSheetName was entry.name (a
      // non-empty string) just before this reselection, so it is always
      // truthy here too.
      this.changes.AddUndo("workbook setactivesheet " + SocialCalc.encodeForSave(entry.name));
    }
    this.changes.AddUndo("workbook unhidesheet " + SocialCalc.encodeForSave(entry.name));
  }

  wbStatus(this, "hidesheet", { name: entry.name });
  return true;
};

WorkbookRoot.Workbook.prototype.UnhideSheet = function (
  this: SocialCalc.Workbook,
  name: string,
  saveundo = true,
): boolean {
  const key = SocialCalc.WorkbookNormalizeSheetName(name);
  const entry = wbEntry(this, key);
  if (!entry || entry.visible) return false;

  entry.visible = true;

  if (saveundo) {
    this.changes.PushChange("unhidesheet");
    this.changes.AddDo("workbook unhidesheet " + SocialCalc.encodeForSave(entry.name));
    this.changes.AddUndo("workbook hidesheet " + SocialCalc.encodeForSave(entry.name));
  }

  wbStatus(this, "unhidesheet", { name: entry.name });
  return true;
};

/** Sets the active sheet. The sheet must exist and be visible. */
WorkbookRoot.Workbook.prototype.SetActiveSheet = function (
  this: SocialCalc.Workbook,
  name: string,
  saveundo = true,
): boolean {
  const key = SocialCalc.WorkbookNormalizeSheetName(name);
  const entry = wbEntry(this, key);
  if (!entry || !entry.visible) return false;
  if (this.activeSheetName === entry.name) return true;

  // A sheet entry can only exist after AddSheet has run at least once,
  // which always sets activeSheetName (either as the first sheet, or it
  // was already non-null) — so `previous` is never null here.
  const previous = this.activeSheetName!;
  this.activeSheetName = entry.name;

  if (saveundo) {
    this.changes.PushChange("setactivesheet");
    this.changes.AddDo("workbook setactivesheet " + SocialCalc.encodeForSave(entry.name));
    this.changes.AddUndo("workbook setactivesheet " + SocialCalc.encodeForSave(previous));
  }

  wbStatus(this, "setactivesheet", { name: entry.name });
  return true;
};

WorkbookRoot.Workbook.prototype.GetSheet = function (
  this: SocialCalc.Workbook,
  name: string,
): SocialCalc.Sheet | null {
  const entry = wbEntry(this, SocialCalc.WorkbookNormalizeSheetName(name));
  return entry ? entry.sheet : null;
};

WorkbookRoot.Workbook.prototype.GetActiveSheet = function (
  this: SocialCalc.Workbook,
): SocialCalc.Sheet | null {
  if (this.activeSheetName == null) return null;
  return this.GetSheet(this.activeSheetName);
};

WorkbookRoot.Workbook.prototype.IsSheetVisible = function (
  this: SocialCalc.Workbook,
  name: string,
): boolean {
  const entry = wbEntry(this, SocialCalc.WorkbookNormalizeSheetName(name));
  return !!entry && entry.visible;
};

WorkbookRoot.Workbook.prototype.SetSheetEditorSettings = function (
  this: SocialCalc.Workbook,
  name: string,
  settings: string,
): void {
  const entry = wbEntry(this, SocialCalc.WorkbookNormalizeSheetName(name));
  if (entry) entry.editorSettings = settings;
};

WorkbookRoot.Workbook.prototype.GetSheetEditorSettings = function (
  this: SocialCalc.Workbook,
  name: string,
): string {
  const entry = wbEntry(this, SocialCalc.WorkbookNormalizeSheetName(name));
  return entry ? entry.editorSettings : "";
};

/** Ordered list of {name, visible} for every sheet (including hidden). */
WorkbookRoot.Workbook.prototype.ListSheets = function (
  this: SocialCalc.Workbook,
): SocialCalc.WorkbookSheetInfo[] {
  return this.sheetOrder.map((name) => {
    const entry = wbEntry(this, SocialCalc.WorkbookNormalizeSheetName(name))!;
    return { name: entry.name, visible: entry.visible };
  });
};

// *************************************
//
// Workbook-level undo/redo command dispatch.
//
// *************************************

WorkbookRoot.ExecuteWorkbookCommand = function (
  workbook: SocialCalc.Workbook,
  cmd: string,
  saveundo: boolean,
): void {
  const parts = cmd.split(" ");
  const what = parts[1];
  switch (what) {
    case "addsheet":
      workbook.AddSheet(SocialCalc.decodeFromSave(parts.slice(2).join(" ")), null, saveundo);
      break;
    case "deletesheet":
      workbook.DeleteSheet(SocialCalc.decodeFromSave(parts.slice(2).join(" ")), saveundo);
      break;
    case "renamesheet": {
      const oldName = SocialCalc.decodeFromSave(parts[2]);
      const newName = SocialCalc.decodeFromSave(parts.slice(3).join(" "));
      workbook.RenameSheet(oldName, newName, saveundo);
      break;
    }
    case "reordersheet": {
      const name = SocialCalc.decodeFromSave(parts[2]);
      const index = Number(parts[3]);
      workbook.ReorderSheet(name, index, saveundo);
      break;
    }
    case "hidesheet":
      workbook.HideSheet(SocialCalc.decodeFromSave(parts.slice(2).join(" ")), saveundo);
      break;
    case "unhidesheet":
      workbook.UnhideSheet(SocialCalc.decodeFromSave(parts.slice(2).join(" ")), saveundo);
      break;
    case "setactivesheet":
      workbook.SetActiveSheet(SocialCalc.decodeFromSave(parts.slice(2).join(" ")), saveundo);
      break;
    case "restoreformula": {
      const sname = SocialCalc.decodeFromSave(parts[2]);
      const coord = parts[3];
      const formula = SocialCalc.decodeFromSave(parts.slice(4).join(" "));
      const sheet = workbook.GetSheet(sname);
      if (sheet) {
        const cell = sheet.GetAssuredCell(coord);
        cell.formula = formula;
        cell.datatype = "f";
        delete cell.parseinfo;
      }
      break;
    }
    case "restoresheet": {
      const name = SocialCalc.decodeFromSave(parts[2]);
      const index = Number(parts[3]);
      const visible = parts[4] === "yes";
      const editorSettings = SocialCalc.decodeFromSave(parts[5]);
      const savedText = SocialCalc.decodeFromSave(parts.slice(6).join(" "));
      const restored = new SocialCalc.Sheet();
      restored.ParseSheetSave(savedText);
      workbook.AddSheet(name, restored, false);
      workbook.ReorderSheet(name, index, false);
      const entry = wbEntry(workbook, SocialCalc.WorkbookNormalizeSheetName(name))!;
      entry.visible = visible;
      entry.editorSettings = editorSettings;
      break;
    }
    default:
      break;
  }
};

/** Undoes the most recent workbook-level operation. */
WorkbookRoot.Workbook.prototype.WorkbookUndo = function (this: SocialCalc.Workbook): void {
  const tos = this.changes.TOS();
  if (!tos) return;
  for (let i = tos.undo.length - 1; i >= 0; i--) {
    SocialCalc.ExecuteWorkbookCommand(this, tos.undo[i], false);
  }
  this.changes.Undo();
};

/** Redoes the most recently undone workbook-level operation. */
WorkbookRoot.Workbook.prototype.WorkbookRedo = function (this: SocialCalc.Workbook): void {
  if (!this.changes.Redo()) return;
  // Redo() returning true guarantees tos now points at a valid stack
  // index, so TOS() is never null here (UndoStack.Redo/TOS invariant).
  const tos = this.changes.TOS()!;
  for (let i = 0; i < tos.command.length; i++) {
    SocialCalc.ExecuteWorkbookCommand(this, tos.command[i], false);
  }
};

// *************************************
//
// Recalc across every sheet in the workbook, with cross-sheet dependency
// correctness: sheets are pre-registered directly into the shared
// SocialCalc.Formula.SheetCache (see wbCacheRegister), so cross-sheet
// formula references resolve synchronously with no async load. To converge
// values across cross-sheet dependency chains of unbounded depth, RecalcAll
// runs up to (sheetCount) rounds, stopping early once a full round leaves
// every sheet's calculated values unchanged. Each individual sheet recalc
// reuses the existing timer-driven SocialCalc.RecalcSheet/RecalcInfo.queue
// machinery unmodified — this file adds sequencing on top, not new recalc
// internals.
//
// *************************************

/**
 * Recalculates every sheet in `workbook`, converging cross-sheet
 * dependencies. Calls `callback()` (if given) once fully converged (or the
 * round budget is exhausted). Standalone function (not a prototype method
 * body) so it never needs a `this`-alias.
 */
function wbRecalcAll(workbook: SocialCalc.Workbook, callback?: () => void): void {
  const names: string[] = workbook.sheetOrder.slice();

  if (names.length === 0) {
    if (callback) callback();
    return;
  }

  const maxRounds = names.length;

  function runRound(roundsLeft: number): void {
    let idx = 0;
    let roundChanged = false;

    function attachOnce(sheet: SocialCalc.Sheet): void {
      const prevcb = sheet.statuscallback;
      const prevparams = sheet.statuscallbackparams;
      sheet.statuscallback = function (
        data: unknown,
        status: string,
        arg: unknown,
        _params: unknown,
      ): void {
        if (prevcb) prevcb(data, status, arg, prevparams);
        if (status === "calcfinished") {
          sheet.statuscallback = prevcb;
          sheet.statuscallbackparams = prevparams;
          if (sheet.recalcchangedavalue) roundChanged = true;
          onOneDone();
        }
      };
    }

    function startSheet(i: number): void {
      const sheet = workbook.GetSheet(names[i]);
      if (!sheet) {
        idx = i + 1;
        onOneDone();
        return;
      }
      sheet.recalcchangedavalue = false;
      attachOnce(sheet);
      sheet.RecalcSheet();
    }

    function onOneDone(): void {
      idx++;
      if (idx < names.length) {
        startSheet(idx);
      } else if (roundChanged && roundsLeft > 1) {
        runRound(roundsLeft - 1);
      } else {
        wbStatus(workbook, "recalcallfinished", null);
        if (callback) callback();
      }
    }

    startSheet(0);
  }

  runRound(maxRounds);
}

WorkbookRoot.Workbook.prototype.RecalcAll = function (
  this: SocialCalc.Workbook,
  callback?: () => void,
): void {
  wbRecalcAll(this, callback);
};

// *************************************
//
// Save/load envelope: versioned, additive, and independent of the existing
// single-sheet / SpreadsheetControl multipart formats — no existing byte
// output changes when this module is present but unused.
//
// Format ("socialcalc:workbook:version:1.0"):
//
//   socialcalc:workbook:version:1.0
//   MIME-Version: 1.0
//   Content-Type: multipart/mixed; boundary=<boundary>
//   --<boundary>
//   Content-type: text/plain; charset=UTF-8
//
//   # SocialCalc Workbook Save
//   version:1.0
//   active:<encoded active sheet name>
//   sheet:<encoded name>:visible:<yes|no>          (one per sheet, tab order)
//   editorsettings:<encoded name>:<encoded blob>   (only sheets with a blob)
//   --<boundary>
//   Content-type: text/plain; charset=UTF-8
//
//   <sheet 1's CreateSheetSave() output>
//   --<boundary>
//   ...
//   --<boundary>--
//
// The N `sheet:` manifest lines (in tab order) determine how many data
// parts follow and their sheet-name mapping; each data part is exactly one
// sheet's existing (unmodified) CreateSheetSave() text.
//
// *************************************

const WORKBOOK_SAVE_BOUNDARY = "SocialCalcWorkbookSave";

WorkbookRoot.CreateWorkbookSave = function (workbook: SocialCalc.Workbook): string {
  const enc = SocialCalc.encodeForSave;
  const lines: string[] = ["# SocialCalc Workbook Save", "version:1.0"];
  if (workbook.activeSheetName != null) {
    lines.push("active:" + enc(workbook.activeSheetName));
  }
  const names = workbook.sheetOrder;
  for (const name of names) {
    const entry = workbook.sheets[SocialCalc.WorkbookNormalizeSheetName(name)];
    lines.push("sheet:" + enc(entry.name) + ":visible:" + (entry.visible ? "yes" : "no"));
  }
  for (const name of names) {
    const entry = workbook.sheets[SocialCalc.WorkbookNormalizeSheetName(name)];
    if (entry.editorSettings) {
      lines.push("editorsettings:" + enc(entry.name) + ":" + enc(entry.editorSettings));
    }
  }
  lines.push("");

  let result =
    "socialcalc:workbook:version:1.0\n" +
    "MIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=" +
    WORKBOOK_SAVE_BOUNDARY +
    "\n" +
    "--" +
    WORKBOOK_SAVE_BOUNDARY +
    "\nContent-type: text/plain; charset=UTF-8\n\n" +
    lines.join("\n");

  for (const name of names) {
    const entry = workbook.sheets[SocialCalc.WorkbookNormalizeSheetName(name)];
    result +=
      "--" +
      WORKBOOK_SAVE_BOUNDARY +
      "\nContent-type: text/plain; charset=UTF-8\n\n" +
      entry.sheet.CreateSheetSave();
  }
  result += "--" + WORKBOOK_SAVE_BOUNDARY + "--\n";

  return result;
};

/**
 * Parses a workbook save string into a structured manifest without
 * mutating any workbook. Returns null on malformed/unrecognized input
 * (never throws — matches the existing multipart decoder's fail-soft
 * contract in SpreadsheetControlDecodeSpreadsheetSave).
 */
WorkbookRoot.DecodeWorkbookSave = function (str: string): SocialCalc.WorkbookSaveManifest | null {
  const dec = SocialCalc.decodeFromSave;

  const pos1 = str.search(/^MIME-Version:\s1\.0/im);
  if (pos1 < 0) return null;

  const mpregex = /^Content-Type:\s*multipart\/mixed;\s*boundary=(\S+)/gim;
  mpregex.lastIndex = pos1;
  const mpmatch = mpregex.exec(str);
  if (!mpmatch || mpregex.lastIndex <= 0) return null;
  const boundary = mpmatch[1]!;

  const boundaryregex = new RegExp("^--" + boundary + "(?:\r\n|\n)", "mg");
  boundaryregex.lastIndex = mpregex.lastIndex;
  if (!boundaryregex.exec(str)) return null;

  const blanklineregex = /(?:\r\n|\n)(?:\r\n|\n)/gm;
  blanklineregex.lastIndex = boundaryregex.lastIndex;
  const blankmatch = blanklineregex.exec(str);
  if (!blankmatch) return null;
  let start = blanklineregex.lastIndex;

  boundaryregex.lastIndex = start;
  const headerEndMatch = boundaryregex.exec(str);
  if (!headerEndMatch) return null;
  let ending = headerEndMatch.index;

  const headerLines = str.substring(start, ending).split(/\r\n|\n/);
  let active: string | null = null;
  const sheets: SocialCalc.WorkbookSaveManifestEntry[] = [];
  const editorSettingsMap: { [name: string]: string } = {};

  for (const line of headerLines) {
    const parts = line.split(":");
    switch (parts[0]) {
      case "active":
        active = dec(parts.slice(1).join(":"));
        break;
      case "sheet":
        // "sheet:<name>:visible:<yes|no>" — name itself may contain "\c"
        // (colon-encoded), never a raw ":", so parts[1] is the whole name.
        sheets.push({ name: dec(parts[1]!), visible: parts[3] === "yes", editorSettings: "" });
        break;
      case "editorsettings":
        editorSettingsMap[dec(parts[1]!)] = dec(parts.slice(2).join(":"));
        break;
      default:
        break;
    }
  }
  for (const entry of sheets) {
    if (Object.prototype.hasOwnProperty.call(editorSettingsMap, entry.name)) {
      entry.editorSettings = editorSettingsMap[entry.name]!;
    }
  }

  const sheetTexts: string[] = [];
  for (let i = 0; i < sheets.length; i++) {
    blanklineregex.lastIndex = ending;
    const partBlank = blanklineregex.exec(str);
    if (!partBlank) return null;
    start = blanklineregex.lastIndex;
    if (i === sheets.length - 1) {
      const lastregex = new RegExp("^--" + boundary + "--$", "mg");
      lastregex.lastIndex = start;
      const lastmatch = lastregex.exec(str);
      if (!lastmatch) return null;
      ending = lastmatch.index;
    } else {
      boundaryregex.lastIndex = start;
      const nextmatch = boundaryregex.exec(str);
      if (!nextmatch) return null;
      ending = nextmatch.index;
    }
    sheetTexts.push(str.substring(start, ending));
  }

  return { active: active, sheets: sheets, sheetTexts: sheetTexts };
};

/**
 * Replaces `workbook`'s entire contents with the decoded save string.
 * No-op (workbook left COMPLETELY untouched) if the string is malformed,
 * decodes to zero sheets (a workbook must always have >= 1 sheet), or any
 * individual sheet entry fails to register (e.g. a corrupted/duplicate
 * name). The new registry is built into a scratch Workbook first and only
 * swapped in once every sheet has been validated — so a partially-bad
 * payload can never leave `workbook` half-wiped/half-loaded.
 */
WorkbookRoot.LoadWorkbookSave = function (workbook: SocialCalc.Workbook, str: string): void {
  const decoded = SocialCalc.DecodeWorkbookSave(str);
  if (!decoded || decoded.sheets.length === 0) return;

  // Stage into a throwaway workbook — never mutates `workbook`/the shared
  // SheetCache until every sheet is confirmed to load cleanly.
  const staged = new SocialCalc.Workbook();
  for (let i = 0; i < decoded.sheets.length; i++) {
    const meta = decoded.sheets[i]!;
    const sheet = new SocialCalc.Sheet();
    sheet.ParseSheetSave(decoded.sheetTexts[i]!);
    const code = staged.AddSheet(meta.name, sheet, false);
    if (code !== SocialCalc.WorkbookNameValidation.OK) {
      // Malformed/duplicate entry: unregister everything staged so far
      // from the shared SheetCache and abandon the whole load.
      for (const key in staged.sheets) wbCacheUnregister(key);
      return;
    }
    const entry = wbEntry(staged, SocialCalc.WorkbookNormalizeSheetName(meta.name))!;
    entry.visible = meta.visible;
    entry.editorSettings = meta.editorSettings;
  }

  if (
    decoded.active != null &&
    wbEntry(staged, SocialCalc.WorkbookNormalizeSheetName(decoded.active))
  ) {
    staged.activeSheetName = decoded.active;
  } else {
    // Fall back to the first VISIBLE sheet, matching the invariant that the
    // active sheet is always visible. decoded.sheets.length > 0 is
    // guaranteed here, but every sheet could theoretically be hidden if the
    // save was hand-crafted; fall back to the first sheet in that case
    // rather than leaving activeSheetName null on a non-empty workbook.
    const firstVisible = staged.sheetOrder.find((n) => staged.IsSheetVisible(n));
    staged.activeSheetName = firstVisible || staged.sheetOrder[0]!;
  }

  // Commit: unregister the OLD registry from the shared SheetCache now
  // that the new one is fully validated, then swap the staged state in.
  for (const key in workbook.sheets) wbCacheUnregister(key);
  for (const key in staged.sheets) wbCacheRegister(key, staged.sheets[key]!.sheet);
  workbook.sheetOrder = staged.sheetOrder;
  workbook.sheets = staged.sheets;
  workbook.activeSheetName = staged.activeSheetName;
  workbook.changes = new SocialCalc.UndoStack();
};
