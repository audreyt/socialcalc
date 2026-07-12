#!/usr/bin/env node
// Run Stryker against a single source file in fast in-place mode.
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
const sheetCoreTests = ["test/core.test.ts", "test/sheet-coverage-a.test.ts", "test/sheet-coverage-b.test.ts"];

// Formula lexer/parser/operand-stack/rewrite tests, verified by name plus
// grep for ParseFormulaIntoTokens/ConvertInfixToPolish/OperandAs*/
// OffsetFormulaCoords/AdjustFormulaCoords/ReplaceFormulaCoords call sites.
// Excludes test/lemma-*-facade.test.ts on purpose: those exercise the
// non-shipping LemmaScript mirror in lemma/a1.ts (see its header comment),
// not the shipping js/formula-ref.ts this config mutates. Includes the
// 2026-07-12 mutation-survivor regression files added while closing the
// critical-scope Stryker gap (see stryker-mutation-disposition.json).
const formulaOnlyTests = [
  "test/formula-coverage.test.ts",
  "test/formula.test.ts",
  "test/formula-column-range.test.ts",
  "test/formula-functions-coverage.test.ts",
  "test/formula-quote-escaping.test.ts",
  "test/formula-rewrite-cases.test.ts",
  "test/formula-rewrite-regressions.test.ts",
  "test/formula-parse-mutation-survivors.test.ts",
  "test/formula-operand-mutation-survivors.test.ts",
  "test/formula-ref-mutation-survivors.test.ts",
];

// TableEditor/SpreadsheetControl UI surface, verified by grep for
// `new SC.TableEditor`, `control.editor.*`, and `SC.SpreadsheetControl.*`
// call sites (all six files construct or drive an editor/control instance).
const editorTests = [
  "test/ui-coverage.test.ts",
  "test/control-coverage.test.ts",
  "test/editor-coverage-a.test.ts",
  "test/editor-coverage-b.test.ts",
  "test/editor-dom-coverage.test.ts",
  "test/page-scroll.test.ts",
];

// Tests that exercise each source module. Keep in sync with the coverage
// ownership rationale in the header comment above.
export const testsByFile = {
  "formatnumber2.ts": ["test/format-coverage.test.ts", "test/formatting.test.ts"],

  // Foundational data + two pure rewrite functions (ConstantsSetClasses,
  // ConstantsSetImagePrefix). Set = every test file that reads/writes
  // `SC.Constants` (grep -rl "Constants" test/*.test.ts); sheet-coverage-a
  // and types.smoke call the two functions directly. Includes the
  // 2026-07-12 mutation-survivor regression file (see
  // stryker-mutation-disposition.json).
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
  ],

  // Concatenated into one logical "Formula" bag in build.ts's `coreFiles`
  // order (formula1.ts, then formula-parse.ts, formula-operand.ts,
  // formula-ref.ts) — a mutant in any of the four can only be killed by
  // tests that exercise the shared SocialCalc.Formula object, so all four
  // share the identical test set.
  "formula1.ts": [...formulaOnlyTests, ...commandRegressionTests, ...sheetCoreTests],
  "formula-parse.ts": [...formulaOnlyTests, ...commandRegressionTests, ...sheetCoreTests],
  "formula-operand.ts": [...formulaOnlyTests, ...commandRegressionTests, ...sheetCoreTests],
  "formula-ref.ts": [...formulaOnlyTests, ...commandRegressionTests, ...sheetCoreTests],

  "socialcalc-3.ts": [
    ...sheetCoreTests,
    ...commandRegressionTests,
    "test/filldown-persistence.test.ts",
    "test/formula-quote-escaping.test.ts",
  ],

  "socialcalctableeditor.ts": editorTests,
  "socialcalcpopup.ts": ["test/ui-coverage.test.ts", "test/popup-viewer-coverage.test.ts"],
  "socialcalcspreadsheetcontrol.ts": editorTests,
  "socialcalcviewer.ts": ["test/popup-viewer-coverage.test.ts"],
};

// Every shipping module Stryker knows how to mutate — derived from
// testsByFile's own keys so the full/matrix scope (stryker.config.mjs's
// MUTATE_TARGET mode, .github/workflows/mutation.yml's mutate-discover
// job, and scripts/mutate-all.mjs's local orchestrator) can never drift
// from, or silently omit, an entry in the test-ownership map above.
export const ALL_MUTATE_FILES = Object.keys(testsByFile).map((f) => `js/${f}`);

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

  // Incremental file keyed per target so iterating on one file does not
  // invalidate cached mutants for others.
  const incrementalFile = `.stryker-tmp/incremental-${basename(absolute)}.json`;

  const child = spawn(
    "vp",
    ["exec", "stryker", "run", "--mutate", mutateSpec, "--incrementalFile", incrementalFile],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        MUTATE_IN_PLACE: "1",
        MUTATE_TESTS: tests.join(" "),
      },
    },
  );

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}
