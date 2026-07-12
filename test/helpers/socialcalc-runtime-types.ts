// Shared structural contract for "a loaded SocialCalc UMD bundle", used to
// annotate both the candidate instance (test/helpers/socialcalc.ts) and the
// pinned oracle instance (test/helpers/oracle.ts) so differential tests can
// compare the two without `any`. Deliberately narrow: only the surface the
// differential/adversarial/performance corpus actually calls. Extend by
// adding one more `typeof SC.Foo` line, never by adding an index signature.
//
// Pulled in as `import type` only — this never causes a runtime import of
// the 760 KB bundle (see AGENTS.md's cache-busting-import warning). The
// candidate types come from the real, maintained ambient declarations, so
// this stays in sync with the shipping API automatically.
import type SC from "../../dist/SocialCalc.js";

export type SheetInstance = SC.Sheet;
export type CellInstance = SC.Cell;
export type ParseInstance = SC.Parse;
export type RenderContextInstance = SC.RenderContext;

export interface SocialCalcRuntime {
  Sheet: new () => SC.Sheet;
  Parse: new (str: string) => SC.Parse;
  RenderContext: new (sheetobj: SC.Sheet) => SC.RenderContext;

  ResetSheet: typeof SC.ResetSheet;
  ParseSheetSave: typeof SC.ParseSheetSave;
  CreateSheetSave: typeof SC.CreateSheetSave;
  CanonicalizeSheet: typeof SC.CanonicalizeSheet;

  ScheduleSheetCommands: typeof SC.ScheduleSheetCommands;
  ExecuteSheetCommand: typeof SC.ExecuteSheetCommand;
  SheetUndo: typeof SC.SheetUndo;
  SheetRedo: typeof SC.SheetRedo;
  RecalcSheet: typeof SC.RecalcSheet;
  RecalcInfo: typeof SC.RecalcInfo;

  OffsetFormulaCoords: typeof SC.OffsetFormulaCoords;
  AdjustFormulaCoords: typeof SC.AdjustFormulaCoords;
  ReplaceFormulaCoords: typeof SC.ReplaceFormulaCoords;

  rcColname: typeof SC.rcColname;
  crToCoord: typeof SC.crToCoord;
  coordToCr: typeof SC.coordToCr;
  ParseRange: typeof SC.ParseRange;

  encodeForSave: typeof SC.encodeForSave;
  decodeFromSave: typeof SC.decodeFromSave;
  ConvertSaveToOtherFormat: typeof SC.ConvertSaveToOtherFormat;
  ConvertOtherFormatToSave: typeof SC.ConvertOtherFormatToSave;
  DetermineValueType: typeof SC.DetermineValueType;

  Formula: typeof SC.Formula;
  FormatNumber: typeof SC.FormatNumber;

  Clipboard: typeof SC.Clipboard;

  [key: string]: unknown;
}
