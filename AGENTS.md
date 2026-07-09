# Agent notes

## TypeScript in-place rewrite (2026-07-09)

Sources under `js/` are global-script TypeScript (not ES modules). `build.ts`
prefers sibling `.ts` over listed `.js`, strips types with `Bun.Transpiler`, and
reattaches leading license comment preambles. UMD open/close wrappers are
**inlined strings in `build.ts`** (not `js/*` files — they are not standalone-parseable).

**Type-safety status (honest):**

| File | Status |
|---|---|
| `formatnumber2.ts` | Fully typechecked (no `@ts-nocheck`) |
| `formula-ref.ts` | Fully typechecked pure formula-ref + A1 coord algebra (after formula-operand in build) |
| `formula-parse.ts` | Fully typechecked pure lexer/RPN/type helpers (after formula1 in build) |
| `formula-operand.ts` | Fully typechecked pure operand-stack helpers (after formula-parse in build) |
| `socialcalcconstants.ts` | Fully typechecked; LemmaScript `//@ verify` on pure class/image-prefix helpers |
| `formula1.ts` | Fully typechecked (evaluator + Formula surface) |
| `socialcalc-3.ts` | Fully typechecked (command/caller core) |
| `socialcalcviewer.ts` | Fully typechecked |
| `socialcalcpopup.ts` | Fully typechecked |
| `socialcalcspreadsheetcontrol.ts` | Fully typechecked (toolbar/tab/save UI) |
| `socialcalctableeditor.ts` | Fully typechecked (table editor / DOM) |


Do **not** claim a finished typed rewrite while `@ts-nocheck` remains. All core
`js/*.ts` modules are now fully typechecked. Next work: tighten remaining `any`
bridges and improve public `*.d.ts` coverage only when runtime surfaces a
missing API.

**LemmaScript:** `//@ verify` on typed pure helpers in `formula-ref.ts`,
`formula-parse.ts`, `formula-operand.ts`, and `socialcalcconstants.ts`. Remaining
formula1 evaluator helpers still need extraction/typing before prove. Promote
findings to Bun fixtures/tests; shipping `dist/SocialCalc.js` remains the
compatibility oracle. The former Rust/WASM formula-ref spike was removed once its
fixtures and Leanstral invariants lived on the TS/LemmaScript + Bun side.

## SocialCalc formula-reference work

When changing formula-reference rewrite behavior, preserve compatibility first.
The pure helpers in `js/formula-ref.ts` (emitted into `dist/SocialCalc.js`) are
the implementation oracle for `OffsetFormulaCoords` / `AdjustFormulaCoords` /
`ReplaceFormulaCoords` and A1 coord algebra unless a command-level spreadsheet
scenario proves the current behavior is wrong. `js/socialcalc-3.ts` is command
handling and call sites only.

Key files:

- `js/formula-ref.ts` — pure formula-reference rewrite helpers and A1 coord algebra (LemmaScript `//@ verify`).
- `js/socialcalc-3.ts` — production command handling (calls formula-ref helpers).
- `test/fixtures/formula-rewrite-cases.json` — data-driven direct + command rewrite cases (ported from the retired Leanstral/Rust spike).
- `test/formula-rewrite-cases.test.ts` — runs every fixture case against the shipping bundle.
- `test/formula-rewrite-regressions.test.ts` — production tests for direct rewrite helpers.
- `test/command-boundary-regressions.test.ts` — command-level boundary regressions.
- `test/filldown-persistence.test.ts` — fill/fillright/filldown persistence and increment regressions.
- `test/sheet-coverage-b.test.ts` — sheet command undo/name coverage.

Required verification after formula-reference changes:

```bash
bun run build.ts
bun test test/formula-rewrite-cases.test.ts test/formula-rewrite-regressions.test.ts
bun run typecheck
```

Lessons from the 2026-07-05 Leanstral/oracle pass (still apply after the Rust drop):

- Do not promote model output by prose alone. Convert it into a fixture or a Bun regression with exact calls, commands, and expected outputs.
- Direct helper tests are not enough for command bugs. Use `ScheduleSheetCommands`/`loadSocialCalc()` command-level tests for copy, paste, fill, insert, delete, and undo behavior.
- `$` markers lock copy/fill references, not structural insert/delete. Structural operations can still move the underlying coordinate.
- Sheet-qualified ranges intentionally keep `sheetref` sticky through `:`. `OffsetFormulaCoords`, `AdjustFormulaCoords`, and `ReplaceFormulaCoords` are not interchangeable here.
- SocialCalc's supported max column is `ZZ` (702). References shifted past `ZZ` should become `#REF!`; do not allow high-side `rcColname`/`crToCoord` clamping to silently turn overflow into `ZZ`.
- For filldown/fillright, rectangular numeric series need per-column/per-row increments. Interactive editor `range2` state must be captured before clearing it.
- For deletecol/deleterow, undo must restore changed named-reference definitions as well as cell formulas.
- Treat lowercase/parser-normalization and no-op paste normalization as policy questions unless there is a concrete failing spreadsheet behavior.
