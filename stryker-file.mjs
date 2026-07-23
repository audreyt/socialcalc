#!/usr/bin/env node
// Run Stryker against a single source file in an isolated sandbox.
//
// Usage: vp run mutate:file <path/to/source.ts> [startLine-endLine]
//
// Maps each source file to its relevant test subset so a mutant only has to
// run the tests that actually exercise that module, not the full suite.
//
// All shipping SocialCalc modules are plain TypeScript now (no parallel
// `.js` sources remain — see build.ts's `coreFiles` list) and are
// concatenated into a single global-script UMD bundle, so per-module
// "coverage" is a manual, evidence-based mapping rather than something
// derivable from imports (these files have none; they all assign onto the
// shared `SocialCalc` bag). Mappings below were verified against the test
// suite at HEAD by grepping each candidate test file for direct calls into
// the target module's functions/namespaces (e.g. `SC.ConstantsSetClasses`,
// `new SC.TableEditor`, `SC.Formula.*`, structural-edit regressions that
// exercise formula-ref.ts's Offset/Adjust/ReplaceFormulaCoords) — not just
// filename conventions. Keep this in sync with `stryker.config.mjs`, which
// imports `testsByFile` to build the deterministic PR-focused mutation
// scope; re-verify with the same grep approach whenever tests are added,
// renamed, or a source file changes what it actually exercises.

import { spawn } from "node:child_process";
import { resolve, relative, basename } from "node:path";
import { existsSync } from "node:fs";

// -- Shared test groups -------------------------------------------------

// Sheet-command regressions: insert/delete/move/copy/paste/sort/name/range
// edits. These exercise both socialcalc-3.ts's command engine (the code
// executing the edit) and formula-ref.ts's coordinate-rewrite helpers
// (Offset/Adjust/ReplaceFormulaCoords, invoked *by* those edits) — verified
// by grep for "formula" density (9-30 hits each) plus direct #REF!/sort/
// name-shadow assertions in each file.
const commandRegressionTests = [
  "test/absolute-reference-command-regressions.test.ts",
  "test/clipboard-command-regressions.test.ts",
  "test/command-boundary-regressions.test.ts",
  "test/max-row-column-boundary-regressions.test.ts",
  "test/move-command-regressions.test.ts",
  "test/name-function-shadow-regressions.test.ts",
  "test/name-undo-redo-regressions.test.ts",
  "test/range-endpoint-command-regressions.test.ts",
  "test/sheet-qualified-command-regressions.test.ts",
  "test/sort-formula-command-regressions.test.ts",
];

// Sheet/cell core behaviour + save/load round trips.
const sheetCoreTests = [
  "test/core.test.ts",
  "test/sheet-coverage-a.test.ts",
  "test/sheet-coverage-b.test.ts",
];

// Formula lexer/parser/operand-stack/rewrite tests, verified by name plus
// grep for ParseFormulaIntoTokens/ConvertInfixToPolish/OperandAs*/
// OffsetFormulaCoords/AdjustFormulaCoords/ReplaceFormulaCoords call sites.
// lemma-a1-facade.test.ts is INCLUDED: its pure-lemma block alone would not
// kill shipping mutants, but the "vs shipping SocialCalc oracle" block calls
// SC.OffsetRectangle/rcColname/crToCoord/OffsetFormulaCoords/AdjustFormulaCoords
// directly and is real killing power for formula-ref.ts. Other lemma-*-
// facade files that call shipping Formula.* helpers (weekday policy, lambda
// scope) are included on the same basis.
// Includes the 2026-07-12 mutation-survivor regression files added while closing the
// critical-scope Stryker gap (see stryker-mutation-disposition.json), the
// semantic-audit-hardened branch-coverage file (direct SC.Formula.* calls
// across EvaluatePolish/ConvertInfixToPolish/DecodeRangeParts/FreshnessInfo/
// FunctionClasses/etc.), and the NaN-vs-overflow numeric-error-message
// regression (drives EvaluatePolish via a full sheet recalc).
// Includes date/finance compatibility suites and dynamic-reference coverage:
// formula-date-arithmetic.test.ts covers date/workday functions;
// formula-financial-functions.test.ts covers PPMT/IPMT/MIRR/XNPV/XIRR; and
// formula-dynamic-reference.test.ts drives INDIRECT/OFFSET through
// evaluate_parsed_formula and full scheduleCommands/recalcSheet cycles,
// exercising formula-ref.ts OffsetRectangle and coordinate overflow paths.
// formula-dynamic-arrays.test.ts/formula-array-family2*.test.ts/
// lemma-spill-facade.test.ts/dynamic-array-spill-*.test.ts cover
// SORT/UNIQUE/FILTER/SEQUENCE/TRANSPOSE/SORTBY/CHOOSECOLS/CHOOSEROWS/TAKE/
// DROP/HSTACK/VSTACK/TOCOL/TOROW/WRAPROWS/WRAPCOLS/EXPAND and the shared
// spill layer (basic/commands/editor/persistence/family2 scenarios).
// workbook.test.ts owns RewriteSheetNameInFormula (rename/delete cross-sheet
// formula rewrite in formula-ref.ts) — without it those regions land as
// NoCoverage dilution on the formula-ref matrix leg.
// lambda-formulas.test.ts + lemma-lambda-scope-facade.test.ts own the
// LET/LAMBDA pure helpers in formula-parse.ts (ClassifyArity/ResolveScopeIndex/
// RecursionStatus/ShapesMatch/IsValidRectShape) and the formula-operand.ts
// lambda-type closed coercion paths in OperandAsNumber/OperandAsText.
// formula-ref-lexer-coverage-gaps.test.ts drives OperandsAsCoordOnSheet/
// OperandsAsRangeOnSheet sheet-qualified error branches and OperandAsNumber
// DetermineValueType fallbacks that the shared formula suite otherwise misses.
const formulaOnlyTests = [
  "test/formula-coverage.test.ts",
  "test/formula.test.ts",
  "test/formula-column-range.test.ts",
  "test/formula-functions-coverage.test.ts",
  "test/formula-financial-functions.test.ts",
  "test/formula-quote-escaping.test.ts",
  "test/formula-rewrite-cases.test.ts",
  "test/formula-rewrite-regressions.test.ts",
  "test/formula-parse-mutation-survivors.test.ts",
  "test/formula-operand-mutation-survivors.test.ts",
  "test/formula-ref-mutation-survivors.test.ts",
  "test/hardening-formula-branches.test.ts",
  "test/formula-numeric-error-classification-regressions.test.ts",
  "test/formula-date-arithmetic.test.ts",
  "test/lemma-weekday-policy-facade.test.ts",
  "test/formula-dynamic-reference.test.ts",
  "test/formula-dynamic-arrays.test.ts",
  "test/formula-array-family2.test.ts",
  "test/formula-array-family2-coverage.test.ts",
  "test/lemma-spill-facade.test.ts",
  "test/dynamic-array-spill-basic.test.ts",
  "test/dynamic-array-spill-commands.test.ts",
  "test/dynamic-array-spill-editor.test.ts",
  "test/dynamic-array-spill-persistence.test.ts",
  "test/dynamic-array-spill-family2.test.ts",
  "test/criteria-functions.test.ts",
  "test/workbook.test.ts",
  "test/lambda-formulas.test.ts",
  "test/lemma-lambda-scope-facade.test.ts",
  "test/formula-ref-lexer-coverage-gaps.test.ts",
  "test/lemma-a1-facade.test.ts",
];

// formula1.ts-only ownership (2026-07-22/23). Not part of the shared
// formulaOnlyTests base used by formula-parse/operand/ref (and therefore
// not part of MUTATE_SCOPE=critical's deterministic union). These suites
// target formula1 FunctionList implementations and NC-dense formula1
// internals: focused high-density suites (RANK/MEDIAN/QUARTILE,
// XLOOKUP/XMATCH, text/regex/math-stat/logical/reference, lemma shipping
// oracles, filters-tables SUBTOTAL) plus selected formula1-coverage-gaps*
// dumps justified by the measured NoCoverage collapse when they were
// added to the owned set. Keep this list formula1-only so the critical
// PR gate stays the three algorithmic modules' shared base.
const formula1OnlyTests = [
  "test/formula-rank-median-quartile.test.ts",
  "test/formula-xlookup-xmatch.test.ts",
  "test/lemma-xlookup-facade.test.ts",
  "test/lemma-statistics-facade.test.ts",
  "test/lemma-criteria-facade.test.ts",
  "test/lemma-eval-ops-facade.test.ts",
  "test/lemma-lookup-result-facade.test.ts",
  "test/lemma-finance-policy-facade.test.ts",
  "test/formula-text-compat-functions.test.ts",
  "test/formula-regex-functions.test.ts",
  "test/formula-math-stat-compat.test.ts",
  "test/formula-math-stat-coverage-gaps.test.ts",
  "test/formula-logical-error-functions.test.ts",
  "test/formula-reference-info-functions.test.ts",
  // SUBTOTAL lives in formula1.ts; its behavioral suite is filters-tables
  // (also owned by socialcalc-3 for AutoFilter commands).
  "test/filters-tables.test.ts",
  // lemma-branch shipping oracles hit IFS/SWITCH/TEXTJOIN (NC-heavy).
  "test/lemma-branch-facade.test.ts",
  // Selected coverage-gap dumps that hit NC-dense formula1 internals
  // (EvaluatePolish/HMS/NPV/TestCriteria/DFunctions/SUMIFS/TEXT/ROUND/STYLE).
  // formula1-final-push.test.ts is intentionally omitted: one of its
  // cases re-executes dist/SocialCalc.instrumented.js via vm.Script under
  // SOCIALCALC_COVERAGE_ISTANBUL=1 while globalSetup is skipped and the
  // Stryker sandbox only runs plain `vp build`, so the instrumented
  // artifact is missing and that single init-bag test fails the whole
  // file's dry run.
  "test/formula1-coverage-gaps.test.ts",
  "test/formula1-coverage-gaps-2a.test.ts",
  "test/formula1-coverage-gaps-2b.test.ts",
  "test/formula1-coverage-gaps-3.test.ts",
];

// Differential/adversarial corpus (test/differential/**, test/adversarial/**):
// every file constructs a real `new SC.Sheet()` and drives it through
// scheduleCommands/recalcSheet, so — like commandRegressionTests/
// sheetCoreTests above — each file exercises both the socialcalc-3.ts
// command/cache engine AND whichever formula machinery the commands under
// test invoke (parse/evaluate/rewrite). Verified by grep: every file
// constructs `new SC.Sheet`; save-load-export.test.ts and
// malformed-saves.test.ts additionally call SC.CreateSheetSave/
// SC.ParseSheetSave directly, and save-load-export.test.ts calls
// SC.Formula.ParseFormulaIntoTokens/evaluate_parsed_formula directly.
// Shared, not split by individual file, for the same reason
// commandRegressionTests isn't split: a corpus built to catch real
// behavioural drift against the socialcalc@3.0.8 oracle is exactly the
// kind of broad regression net a mutation gate should credit against
// every module it touches, not just the one its filename suggests.
const differentialTests = [
  "test/differential/command-execution.test.ts",
  "test/differential/copy-paste-fill-move.test.ts",
  "test/differential/formula-tokenization-evaluation.test.ts",
  "test/differential/headless-initialization.test.ts",
  "test/differential/insert-delete-undo-redo.test.ts",
  "test/differential/known-intended-differences.test.ts",
  "test/differential/named-ranges.test.ts",
  "test/differential/number-date-formatting.test.ts",
  "test/differential/reference-rewriting.test.ts",
  "test/differential/save-load-export.test.ts",
];
const adversarialTests = [
  "test/adversarial/circular-references.test.ts",
  "test/adversarial/deep-formulas.test.ts",
  "test/adversarial/extreme-ranges.test.ts",
  "test/adversarial/malformed-saves.test.ts",
  "test/adversarial/prototype-like-names.test.ts",
  "test/adversarial/save-load-recalc-invariants.test.ts",
];

// TableEditor/SpreadsheetControl UI surface. Every listed test constructs a
// real editor/control or calls a TableEditor entry point directly. Keep the
// focused coverage-gap, final-push, chart-dialog, validation-dropdown, and
// dynamic-array editor suites here: each drives production keyboard, mouse,
// layout, command, or edit behavior that originates in socialcalctableeditor.ts.
const editorTests = [
  "test/ui-coverage.test.ts",
  "test/control-coverage.test.ts",
  "test/editor-coverage-a.test.ts",
  "test/editor-coverage-b.test.ts",
  "test/editor-dom-coverage.test.ts",
  "test/editor-productivity.test.ts",
  "test/page-scroll.test.ts",
  "test/hardening-tableeditor-commands.test.ts",
  "test/sheet-protection.test.ts",
  "test/hardening-tableeditor-interactions.test.ts",
  "test/editor-coverage-gaps-a.test.ts",
  "test/editor-coverage-gaps-b.test.ts",
  "test/editor-coverage-gaps-c.test.ts",
  "test/editor-coverage-gaps-d.test.ts",
  "test/editor-coverage-gaps-e.test.ts",
  "test/editor-coverage-gaps-f.test.ts",
  "test/editor-final-push-controls.test.ts",
  "test/editor-final-push-mouse.test.ts",
  "test/editor-final-push-render.test.ts",
  "test/chart-editor-ui.test.ts",
  "test/data-validation-security-browser.test.ts",
  "test/dynamic-array-spill-editor.test.ts",
];

// Tests that exercise each source module. Keep in sync with the coverage
// ownership rationale in the header comment above.
export const testsByFile = {
  "formatnumber2.ts": ["test/format-coverage.test.ts", "test/formatting.test.ts"],

  // Foundational data + two pure rewrite functions (ConstantsSetClasses,
  // ConstantsSetImagePrefix). Set = every test file that reads/writes
  // `SC.Constants` (grep -rl "Constants" test/*.test.ts); sheet-coverage-a
  // and types.smoke call the two functions directly. Includes the
  // 2026-07-12 mutation-survivor and oracle-parity regression files
  // (see stryker-mutation-disposition.json).
  "socialcalcconstants.ts": [
    "test/editor-coverage-a.test.ts",
    "test/editor-coverage-b.test.ts",
    "test/editor-dom-coverage.test.ts",
    "test/format-coverage.test.ts",
    "test/formula-coverage.test.ts",
    "test/iofunctions-coverage.test.ts",
    "test/popup-viewer-coverage.test.ts",
    "test/sheet-coverage-a.test.ts",
    "test/types.smoke.test.ts",
    "test/socialcalcconstants-mutation-survivors.test.ts",
    "test/socialcalcconstants-oracle-parity.test.ts",
  ],
  // formula1 owns the FunctionList implementations; parse/operand/ref share
  // the shared formulaOnlyTests base (critical PR gate) but not formula1OnlyTests.
  "formula1.ts": [
    ...formulaOnlyTests,
    ...formula1OnlyTests,
    ...commandRegressionTests,
    ...sheetCoreTests,
    ...differentialTests,
    ...adversarialTests,
  ],
  "formula-parse.ts": [
    ...formulaOnlyTests,
    ...commandRegressionTests,
    ...sheetCoreTests,
    ...differentialTests,
    ...adversarialTests,
  ],
  "formula-operand.ts": [
    ...formulaOnlyTests,
    ...commandRegressionTests,
    ...sheetCoreTests,
    ...differentialTests,
    ...adversarialTests,
  ],
  "formula-ref.ts": [
    ...formulaOnlyTests,
    ...commandRegressionTests,
    ...sheetCoreTests,
    ...differentialTests,
    ...adversarialTests,
  ],

  // socialcalc-3.ts owns Sheet/cache/recalc plumbing and the command engine
  // that backs filters/tables, validation, conditional formatting, chart,
  // pivot, print setup, and HTML-table clipboard import. Each mapped suite
  // calls that shipped surface directly (rather than only testing a facade):
  // filters-tables drives the AutoFilter/Table helpers and command cases;
  // data-validation-commands drives validation and structural rewrites;
  // print-setup drives print attributes and the Print tab; the chart/pivot
  // suites schedule their command cases; and the HTML-table suites call
  // SC.HtmlTable's parser, placement, and import helpers. The remaining
  // suites cover general Sheet behavior, security, cache/recalc, protection,
  // conditional formatting, spill behavior, and workbook adapters.
  "socialcalc-3.ts": [
    ...sheetCoreTests,
    ...commandRegressionTests,
    ...differentialTests,
    ...adversarialTests,
    "test/filldown-persistence.test.ts",
    "test/formula-quote-escaping.test.ts",
    "test/hardening-sheet-core-branches.test.ts",
    "test/render-security-policy.test.ts",
    "test/sheet-cache-load-regressions.test.ts",
    "test/formula-dynamic-reference.test.ts",
    "test/sheet-protection.test.ts",
    "test/lemma-protect-facade.test.ts",
    "test/conditional-formatting.test.ts",
    "test/lemma-condfmt-facade.test.ts",
    "test/filters-tables.test.ts",
    "test/data-validation-commands.test.ts",
    "test/data-validation-security-browser.test.ts",
    "test/print-setup.test.ts",
    "test/chart-basic.test.ts",
    "test/chart-editor-ui.test.ts",
    "test/chart-persistence.test.ts",
    "test/chart-structural-adjustment.test.ts",
    "test/chart-svg-render.test.ts",
    "test/chart-undo.test.ts",
    "test/lemma-chart-facade.test.ts",
    "test/pivot-tables.test.ts",
    "test/lemma-pivot-facade.test.ts",
    "test/html-clipboard-paste.test.ts",
    "test/lemma-html-table-facade.test.ts",
    "test/dynamic-array-spill-basic.test.ts",
    "test/dynamic-array-spill-commands.test.ts",
    "test/dynamic-array-spill-editor.test.ts",
    "test/dynamic-array-spill-persistence.test.ts",
    "test/dynamic-array-spill-family2.test.ts",
    "test/csv-locale-interop.test.ts",
    "test/fods-export.test.ts",
    "test/normalized-workbook-ingestion.test.ts",
    "test/workbook.test.ts",
    "test/workbook-save-load.test.ts",
    "test/workbook-ui.test.ts",
    "test/lemma-workbook-facade.test.ts",
    // Number-parse / named-range / BOM helpers and AutoFilter visibility
    // policy live in socialcalc-3.ts (not formula1); lemma facades oracle them.
    "test/lemma-number-parse-facade.test.ts",
    "test/lemma-visibility-facade.test.ts",
  ],

  // Pure pivot-table engine (grouping, aggregation, grid rendering,
  // materialization/clear/sanitize) plus its command-dispatch surface in
  // socialcalc-3.ts (definepivot/deletepivot/refreshpivot/refreshpivotall,
  // PrepareSpillMutation's pivotowner/pivotrows/pivotcols guards). Verified
  // by grep: pivot-tables.test.ts is the sole behavior suite calling
  // `SC.Pivot.*` directly and driving definepivot/refreshpivot/deletepivot
  // through `SC.ExecuteSheetCommand`; lemma-pivot-facade.test.ts
  // cross-checks every pure helper (TypeRank, CompareGroupKey,
  // AggregateContributes/NextSum/NextCount/NextMin/NextMax,
  // AggregateStatus, PlanPivotStatus, MAX_COL/MAX_ROW) against the
  // lemma/pivot.ts mirror. No other test file references `SC.Pivot` or a
  // `pivotowner`/`pivotrows`/`pivotcols` cell field.
  "pivot.ts": ["test/pivot-tables.test.ts", "test/lemma-pivot-facade.test.ts"],

  "socialcalctableeditor.ts": editorTests,

  // Pure model/save/render/command facade (js/chart.ts) plus its editor
  // overlay/drag/dialog UI section. socialcalc-3.ts's `chart` command
  // cases only get exercised through these files (grep -rl "SC.Chart\.\|
  // sheet.charts\|\"chart " test/*.test.ts), not through any of the
  // formula/sheet-core suites above.
  "chart.ts": [
    "test/chart-basic.test.ts",
    "test/chart-editor-ui.test.ts",
    "test/chart-persistence.test.ts",
    "test/chart-structural-adjustment.test.ts",
    "test/chart-svg-render.test.ts",
    "test/chart-undo.test.ts",
    "test/lemma-chart-facade.test.ts",
  ],
  "socialcalcpopup.ts": [
    "test/ui-coverage.test.ts",
    "test/popup-viewer-coverage.test.ts",
    "test/hardening-popup-behavior.test.ts",
  ],
  // This browser control owns Find/Replace, the sort/audit/comment tabs,
  // workbook-tab UI, and Print-tab fields. editor-productivity and
  // control-coverage exercise Find/Replace and sort; workbook-ui exercises
  // EnableWorkbookMode/rendered tab actions; print-setup exercises the
  // Print-tab field loading, application, and PreparePrintArea DOM logic.
  // The spreadsheetcontrol-coverage-gaps* suites drive DoCmd/audit/comment/
  // LoadColumnChoosers/InitializeSpreadsheetControl branches that the
  // older control matrix left as NoCoverage dilution.
  "socialcalcspreadsheetcontrol.ts": [
    ...editorTests,
    "test/hardening-control-viewer.test.ts",
    "test/workbook-ui.test.ts",
    "test/print-setup.test.ts",
    "test/spreadsheetcontrol-coverage-gaps.test.ts",
    "test/spreadsheetcontrol-coverage-gaps-2.test.ts",
    "test/spreadsheetcontrol-coverage-gaps-3.test.ts",
  ],
  // Viewer initialization, save/load, resize, status, localization, and
  // repeating-macro behavior lives here. The broader UI/control suites invoke
  // those shipped functions directly, so they belong to this owned subset.
  "socialcalcviewer.ts": [
    "test/popup-viewer-coverage.test.ts",
    "test/popup-viewer-coverage-gaps.test.ts",
    "test/ui-coverage.test.ts",
    "test/control-coverage.test.ts",
    "test/iofunctions-coverage.test.ts",
    "test/hardening-control-viewer.test.ts",
  ],
};

// Fail at configuration load time if a source or mapped test was renamed or
// removed. A missing path must never silently turn a matrix leg into an
// empty/irrelevant test run.
for (const [file, tests] of Object.entries(testsByFile)) {
  const sourcePath = resolve("js", file);
  if (!existsSync(sourcePath))
    throw new Error(`mutation source mapping points to missing file: ${sourcePath}`);
  if (!Array.isArray(tests) || tests.length === 0) {
    throw new Error(`mutation source mapping has no tests: ${file}`);
  }
  for (const test of tests) {
    if (!existsSync(resolve(test)))
      throw new Error(`mutation test mapping points to missing file: ${test}`);
  }
}

// Every shipping module Stryker knows how to mutate — derived from
// testsByFile's own keys so the full/matrix scope (stryker.config.mjs's
// MUTATE_TARGET mode, .github/workflows/mutation.yml's mutate-discover
// job, and scripts/mutate-all.mjs's local orchestrator) can never drift
// from, or silently omit, an entry in the test-ownership map above.
export const ALL_MUTATE_FILES = Object.keys(testsByFile).map((f) => `js/${f}`);

// Release-matrix shards for modules whose full-module CI wall-clock exceeds
// GitHub-hosted runners' hard 6h job cap (timeout-minutes: 360 cannot be
// raised). Counts and split lines come from mutant *line* distributions
// (instrumenter / fresh mutation.json), not raw LOC, so each shard is
// roughly equal work. Contiguous, non-overlapping ranges cover 1..EOF.
//
// Evidence (release run 29856287808 on SHA 5293923):
//   formula1.ts: 13555/13768 tested at 5h58m (~45m remaining → ~6h43m full).
//     2 shards × ~6884 mutants ≈ 3.4h projected CI each (under 4h target).
//   socialcalc-3.ts: 11746/11789 at 5h58m (~9m remaining → ~6h07m full).
//     3 shards × ~3930 mutants ≈ 2.0h projected each — extra margin under
//     multi-leg CPU contention (spreadsheetcontrol finished 4303 in 4h40m).
//
// Shard-count or split-line changes require a fresh full-module baseline
// measurement; floors stay Math.floor of the measured full-module score and
// baselines remain keyed by module (not by shard).
export const MUTATION_SHARDS = {
  "js/formula1.ts": [
    // Current exact measurement (2026-07-23 owned-test map): 13,766 merged
    // mutants from shard reports 6,879 (1-7073) + 6,887 (7074-14064). Not the
    // older ~6884 balancing estimate / 13,768 candidate-run instrumenter count.
    { shard: 1, startLine: 1, endLine: 7073 },
    { shard: 2, startLine: 7074, endLine: 14064 },
  ],
  "js/socialcalc-3.ts": [
    // 11789 report mutants; splits 3858/7828 → 3933 + 3929 + 3927.
    { shard: 1, startLine: 1, endLine: 3858 },
    { shard: 2, startLine: 3859, endLine: 7828 },
    { shard: 3, startLine: 7829, endLine: 11084 },
  ],
};

/** @returns {Array<{shard: number, startLine: number, endLine: number}> | null} */
export function shardsForModule(file) {
  return MUTATION_SHARDS[file] ?? null;
}

/**
 * Matrix legs consumed by .github/workflows/mutation.yml's mutate-discover
 * job. Unsharded modules yield one leg; sharded modules yield one leg per
 * complementary line range. `slug` is the report/artifact directory name.
 */
export function mutationMatrixLegs() {
  /** @type {{ file: string, slug: string, shard: string, range: string }[]} */
  const legs = [];
  for (const file of ALL_MUTATE_FILES) {
    const base = basename(file, ".ts");
    const shards = MUTATION_SHARDS[file];
    if (!shards) {
      legs.push({ file, slug: base, shard: "", range: "" });
      continue;
    }
    for (const { shard, startLine, endLine } of shards) {
      legs.push({
        file,
        slug: `${base}-shard-${shard}`,
        shard: String(shard),
        range: `${startLine}-${endLine}`,
      });
    }
  }
  return legs;
}

/** Validate declared shard ranges: contiguous, non-overlapping, cover 1..eofLine. */
export function validateShardRanges(shards, eofLine) {
  if (!Array.isArray(shards) || shards.length === 0) {
    return { ok: false, detail: "shard list is empty" };
  }
  const sorted = [...shards].sort((a, b) => a.shard - b.shard);
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (!Number.isInteger(s.shard) || s.shard !== i + 1) {
      return { ok: false, detail: `expected shard id ${i + 1}, found ${s.shard}` };
    }
    if (
      !Number.isInteger(s.startLine) ||
      !Number.isInteger(s.endLine) ||
      s.startLine < 1 ||
      s.endLine < s.startLine
    ) {
      return {
        ok: false,
        detail: `shard ${s.shard} has invalid range ${s.startLine}-${s.endLine}`,
      };
    }
  }
  if (sorted[0].startLine !== 1) {
    return { ok: false, detail: `first shard must start at line 1, found ${sorted[0].startLine}` };
  }
  if (sorted[sorted.length - 1].endLine !== eofLine) {
    return {
      ok: false,
      detail: `last shard must end at file EOF line ${eofLine}, found ${sorted[sorted.length - 1].endLine}`,
    };
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startLine !== sorted[i - 1].endLine + 1) {
      return {
        ok: false,
        detail: `gap or overlap between shard ${sorted[i - 1].shard} (…${sorted[i - 1].endLine}) and shard ${sorted[i].shard} (${sorted[i].startLine}…)`,
      };
    }
  }
  return { ok: true, shards: sorted };
}

// Bump when the mutation runner/build lifecycle changes in a way Stryker's
// source/test diff cannot detect. This prevents reuse of incompatible results.
export const MUTATION_CACHE_SCHEMA = "build-once-v1";

export function mutationIncrementalFile(scope, range) {
  const rangeSuffix = range ? `-partial-${range.replaceAll(/[^0-9A-Za-z_-]/gu, "-")}` : "";
  return `.stryker-tmp/incremental-${scope}${rangeSuffix}-${MUTATION_CACHE_SCHEMA}.json`;
}

// Only run the CLI logic when this file is the process entrypoint
// (`node stryker-file.mjs <path>` / `vp run mutate:file <path>`) — not when
// stryker.config.mjs imports `testsByFile` above for the critical scope.
const isMain = import.meta.url === `file://${resolve(process.argv[1] ?? "")}`;

if (isMain) {
  const [, , rawTarget, range] = process.argv;

  if (!rawTarget) {
    console.error("usage: vp run mutate:file <path/to/source.ts> [startLine-endLine]");
    process.exit(2);
  }

  const absolute = resolve(rawTarget);
  if (!existsSync(absolute)) {
    console.error(`no such file: ${absolute}`);
    process.exit(2);
  }

  const tests = testsByFile[basename(absolute)];
  if (!tests) {
    console.error(`no test mapping for ${basename(absolute)}. Add one to stryker-file.mjs.`);
    process.exit(2);
  }

  const relativeTarget = relative(process.cwd(), absolute);
  const mutateSpec = range ? `${relativeTarget}:${range}` : relativeTarget;

  // Partial experiments must not overwrite a full-module cache or another
  // range's cache: ranges can contain different mutant sets while sharing the
  // same source bytes. The schema also isolates incompatible runner lifecycles.
  const incrementalFile = mutationIncrementalFile(basename(absolute, ".ts"), range);

  const child = spawn(
    "vp",
    ["exec", "stryker", "run", "--mutate", mutateSpec, "--incrementalFile", incrementalFile],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        MUTATE_TARGET: relativeTarget,
        MUTATE_PARTIAL_RANGE: range ?? "",
        MUTATE_TESTS: tests.join(" "),
      },
    },
  );

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}
