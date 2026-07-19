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
// Excludes test/lemma-*-facade.test.ts on purpose: those exercise the
// non-shipping LemmaScript mirror in lemma/a1.ts (see its header comment),
// not the shipping js/formula-ref.ts this config mutates. Includes the
// 2026-07-12 mutation-survivor regression files added while closing the
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

// TableEditor/SpreadsheetControl UI surface, verified by grep for
// `new SC.TableEditor`, `control.editor.*`, and `SC.SpreadsheetControl.*`
// call sites (all six files construct or drive an editor/control instance).
// Includes the two hardening interaction/command-dispatch files (direct
// editor.EditorScheduleSheetCommands/CalculateEditorPositions/MoveECell/
// RangeAnchor/RangeExtend/ScrollRelative/EditorProcessKey/DoRenderStep
// call sites, incl. the setemailparameters busy/deferred-cycle fix
// regressions).
const editorTests = [
  "test/ui-coverage.test.ts",
  "test/control-coverage.test.ts",
  "test/editor-coverage-a.test.ts",
  "test/editor-coverage-b.test.ts",
  "test/editor-dom-coverage.test.ts",
  "test/page-scroll.test.ts",
  "test/hardening-tableeditor-commands.test.ts",
  "test/sheet-protection.test.ts",
  "test/hardening-tableeditor-interactions.test.ts",
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

  // Concatenated into one logical "Formula" bag in build.ts's `coreFiles`
  // order (formula1.ts, then formula-parse.ts, formula-operand.ts,
  // formula-ref.ts) — a mutant in any of the four can only be killed by
  // tests that exercise the shared SocialCalc.Formula object, so all four
  // share the identical test set.
  "formula1.ts": [
    ...formulaOnlyTests,
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

  // socialcalc-3.ts also owns SafeUrlForRender/EscapeUntrustedHtml (the
  // untrusted-content render-security policy, see socialcalc-3.d.ts) and
  // the Sheet class's cache/recalc plumbing — hardening-sheet-core-
  // branches.test.ts, render-security-policy.test.ts, and
  // sheet-cache-load-regressions.test.ts (direct SC.Formula.SheetCache /
  // `new SC.Sheet` call sites) all drive that surface directly.
  // formula-dynamic-reference.test.ts (2026-07-19) additionally owns the
  // bounded dynamic-reference retry pass in RecalcTimerRoutine
  // (`sheet.hasDynamicRef && !sheet.dynamicRefRetried`, set by INDIRECT/
  // OFFSET in js/formula1.ts): its same-pass-staleness tests construct
  // `new SC.Sheet()`, drive it through scheduleCommands/recalcSheet, and
  // were verified (by temporarily disabling the retry branch) to fail
  // without that exact mechanism.
  // socialcalc-3.ts also owns SafeUrlForRender/EscapeUntrustedHtml (the
  // untrusted-content render-security policy, see socialcalc-3.d.ts), the
  // Sheet class's cache/recalc plumbing, and the conditional-formatting
  // evaluation engine (CondFmtRuleMatches/CondFmtCompare/CondFmtValueCounts/
  // EvaluateCondFmtForCell plus the condfmt command/save-load/structural-
  // rewrite code) — hardening-sheet-core-branches.test.ts, render-security-
  // policy.test.ts, sheet-cache-load-regressions.test.ts, and
  // conditional-formatting.test.ts (direct SC.EvaluateCondFmtForCell/
  // SC.CondFmtRuleMatches/SC.CondFmtCompare call sites plus condfmt
  // command/save/structural-rewrite scenarios) all drive that surface
  // directly.
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
    "test/dynamic-array-spill-basic.test.ts",
    "test/dynamic-array-spill-commands.test.ts",
    "test/dynamic-array-spill-editor.test.ts",
    "test/dynamic-array-spill-persistence.test.ts",
    "test/dynamic-array-spill-family2.test.ts",
  ],

  "socialcalctableeditor.ts": editorTests,
  "socialcalcpopup.ts": [
    "test/ui-coverage.test.ts",
    "test/popup-viewer-coverage.test.ts",
    "test/hardening-popup-behavior.test.ts",
  ],
  "socialcalcspreadsheetcontrol.ts": [...editorTests, "test/hardening-control-viewer.test.ts"],
  "socialcalcviewer.ts": [
    "test/popup-viewer-coverage.test.ts",
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
