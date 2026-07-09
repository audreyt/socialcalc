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

**LemmaScript:** Shipping pure cores keep `//@ verify` marks in place, but
`lsc` cannot extract global-script `js/*.ts` (no exports). The verification
surface is the exported facade under `lemma/` (currently `lemma/a1.ts`: A1
clamp/coord + overflow `#REF!` policy helpers). Both backends are scaffolded:

```bash
bun run verify:both          # Dafny check + Lean gen smoke
bun run verify:dafny:gen     # → lemma/a1.dfy.gen
bun run verify:dafny:regen   # merge gen into proof-bearing a1.dfy
bun run verify:dafny         # lsc check --backend=dafny (LemmaScript-files.txt)
bun run verify:lean:gen      # → lemma/a1.types.lean + a1.def.lean
bun run verify:lean:build    # lake build (sibling ../velvet, ../loom, ../LemmaScript)
```

**Useful rewards now:** Dafny CI-locks pure A1/`#REF!` overflow algebra plus
absolute-axis offset, structural adjust (`wouldAdjustRef`), and rcColname rank
round-trips (25 VCs); Bun `test/lemma-a1-facade.test.ts` cross-checks facade vs
shipping `rcColname`/`crToCoord`/`OffsetFormulaCoords`/`AdjustFormulaCoords`.
Lean gen feeds Leanstral goal packs (`a1.proof.lean`). Grow `lemma/*.ts` only;
promote only to Bun fixtures.
Do not formalize command/DOM. After TS facade edits: `verify:dafny:regen` then
`verify:dafny` (`.dfy` is proof-bearing; plain `gen` alone can leave it stale).

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
