// Shared plumbing for the candidate-vs-oracle differential corpus
// (test/differential/**/*.test.ts). Keeps each category file to direct,
// named assertions instead of ad hoc setup, and keeps comparisons scoped to
// specific observable fields instead of whole-object/whole-save snapshots.
import { expect } from "vite-plus/test";

import { loadOracleSocialCalc, ORACLE_VERSION } from "./oracle";
import {
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
  waitForStatus,
} from "./socialcalc";
import type { CellInstance, SheetInstance, SocialCalcRuntime } from "./socialcalc-runtime-types";

export { ORACLE_VERSION, recalcSheet, scheduleCommands, sheetRedo, sheetUndo, waitForStatus };

export interface CandidateAndOracle {
  candidate: SocialCalcRuntime;
  oracle: SocialCalcRuntime;
}

/** Loads the per-worker candidate singleton alongside the isolated oracle singleton. */
export async function loadPair(): Promise<CandidateAndOracle> {
  const candidate: SocialCalcRuntime = await loadSocialCalc();
  const oracle: SocialCalcRuntime = loadOracleSocialCalc();
  return { candidate, oracle };
}

export interface FormulaEvalSnapshot {
  value: unknown;
  type: string;
  error: string | number | null | undefined;
}

/** Tokenizes+evaluates one formula against a fresh (or supplied) sheet. */
export function evaluateFormula(
  SC: SocialCalcRuntime,
  formula: string,
  sheet?: SheetInstance,
): FormulaEvalSnapshot {
  const targetSheet = sheet ?? new SC.Sheet();
  const tokens = SC.Formula.ParseFormulaIntoTokens(formula);
  const result = SC.Formula.evaluate_parsed_formula(tokens, targetSheet);
  return { error: result.error, type: result.type, value: result.value };
}

export interface CellSnapshot {
  formula: string;
  value: string | number;
  valuetype: string;
}

function toCellSnapshot(cell: CellInstance): CellSnapshot {
  return { formula: cell.formula, value: cell.datavalue, valuetype: cell.valuetype };
}

/** Reads {value, formula, valuetype} for each requested coord; missing cells are null. */
export function snapshotCells(
  sheet: SheetInstance,
  coords: readonly string[],
): Record<string, CellSnapshot | null> {
  const out: Record<string, CellSnapshot | null> = {};
  for (const coord of coords) {
    const cell = sheet.cells[coord];
    out[coord] = cell ? toCellSnapshot(cell) : null;
  }
  return out;
}

export interface RunCommandsOptions {
  recalc?: boolean;
  saveundo?: boolean;
  timeoutMs?: number;
}

/** Runs a command script against a fresh sheet on one runtime, optionally recalculating. */
export async function runCommands(
  SC: SocialCalcRuntime,
  commands: string | readonly string[],
  options: RunCommandsOptions = {},
): Promise<SheetInstance> {
  const sheet = new SC.Sheet();
  const commandString = Array.isArray(commands) ? commands.join("\n") : (commands as string);
  await scheduleCommands(
    SC,
    sheet,
    commandString,
    options.saveundo ?? true,
    options.timeoutMs ?? 2000,
  );
  if (options.recalc ?? true) {
    await recalcSheet(SC, sheet, options.timeoutMs ?? 2000);
  }
  return sheet;
}

export interface DifferentialSnapshotPair {
  candidate: Record<string, CellSnapshot | null>;
  oracle: Record<string, CellSnapshot | null>;
}

/** Runs identical commands against both runtimes and snapshots the same coords from each. */
export async function runDifferentialCommands(
  pair: CandidateAndOracle,
  commands: string | readonly string[],
  coords: readonly string[],
  options?: RunCommandsOptions,
): Promise<DifferentialSnapshotPair> {
  const candidateSheet = await runCommands(pair.candidate, commands, options);
  const oracleSheet = await runCommands(pair.oracle, commands, options);
  return {
    candidate: snapshotCells(candidateSheet, coords),
    oracle: snapshotCells(oracleSheet, coords),
  };
}

/** Full save -> parse -> save round trip on one runtime. */
export function saveRoundTrip(SC: SocialCalcRuntime, save: string): string {
  const sheet = new SC.Sheet();
  SC.ParseSheetSave(save, sheet);
  return SC.CreateSheetSave(sheet);
}

/**
 * Asserts candidate and oracle produced the same observable value, labeled
 * for a clear failure. Values are round-tripped through structuredClone
 * first: the oracle instance lives in its own vm context, so arrays/objects
 * it returns carry that context's Array/Object prototypes and fail
 * toStrictEqual's identity-sensitive comparison against same-shaped
 * candidate values even when every field matches.
 */
export function expectParity<T>(label: string, candidateValue: T, oracleValue: T): void {
  const message = `${label} (candidate vs oracle@${ORACLE_VERSION})`;
  expect(structuredClone(candidateValue), message).toStrictEqual(structuredClone(oracleValue));
}

/**
 * fillright/filldown consult `CurrentSpreadsheetControlObject.editor.range2`
 * to decide whether an interactive selection is active; headless command
 * replay (this corpus, log replay, server workers) has no editor, so
 * install the same minimal stub command-boundary-regressions.test.ts uses.
 */
export function installHeadlessEditorMock(SC: SocialCalcRuntime): void {
  SC.CurrentSpreadsheetControlObject = {
    editor: {
      range2: { hasrange: false },
      Range2Remove(this: { range2: { hasrange: boolean } }) {
        this.range2.hasrange = false;
      },
    },
  };
}
