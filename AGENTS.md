# Agent notes

## TypeScript in-place rewrite (2026-07-09)

Sources under `js/` are global-script TypeScript (not ES modules). `build.ts`
prefers sibling `.ts` over listed `.js`, strips types with `Bun.Transpiler`, and
reattaches leading license comment preambles. UMD wrappers stay `.js`
(`module-wrapper-top.js` creates the factory-local `var SocialCalc = {}`).

**Type-safety status (honest):**

| File | Status |
|---|---|
| `formatnumber2.ts` | Fully typechecked (no `@ts-nocheck`) |
| `socialcalcconstants.ts` | Fully typechecked; LemmaScript `//@ verify` on pure class/image-prefix helpers |
| `formula1.ts` | **Interim `@ts-nocheck`** — mechanical TS + mutable Formula bridge |
| `socialcalc-3.ts` | **Interim `@ts-nocheck`** — formula-ref helpers marked as LemmaScript *opportunities* |
| viewer/popup/control/editor `.ts` | **Interim `@ts-nocheck`** — rename + build path only |

Do **not** claim a finished typed rewrite while `@ts-nocheck` remains. Next work:
remove nocheck file-by-file by typing against ambient `.d.ts`, using
implementation-only mutable bridges for progressive `const` init (see
`FormatNumberMut` / `ConstantsRoot` patterns). Public `*.d.ts` stay consumer
API skins unless a runtime binding is genuinely reassigned by callers.

**LemmaScript:** comments are insight hooks only until signatures are precise.
Ready-ish pure targets: `ConstantsSetClasses`, `ConstantsSetImagePrefix`,
`OffsetFormulaCoords` / `AdjustFormulaCoords` / `ReplaceFormulaCoords`,
`crToCoord` / `coordToCr` / `rcColname`, and formula pure helpers once typed.
Promote findings to Bun fixtures/tests; JS/dist behavior remains the oracle.
Keep the Rust/WASM spike as parity harness, not the insight path.

## SocialCalc formula-reference work

When changing formula-reference rewrite behavior, preserve compatibility first. The production helpers in `js/socialcalc-3.ts` (emitted into `dist/SocialCalc.js`) are the compatibility oracle unless a command-level spreadsheet scenario proves the current behavior is wrong.

Key files:

- `js/socialcalc-3.ts` — production command handling and formula-reference rewrite helpers.
- `test/formula-rewrite-regressions.test.ts` — production tests for direct rewrite helpers.
- `test/command-boundary-regressions.test.ts` — command-level boundary regressions.
- `test/filldown-persistence.test.ts` — fill/fillright/filldown persistence and increment regressions.
- `test/sheet-coverage-b.test.ts` — sheet command undo/name coverage.
- `spikes/leanstral-formula-ref/` — Rust/WASM parity spike and Leanstral handoff material.
- `spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json` — shared JS/Rust parity fixtures.

Required verification after formula-reference changes:

```bash
bun run build.ts
bun test test/formula-rewrite-regressions.test.ts spikes/leanstral-formula-ref/formula-ref-core.parity.test.ts
bun run typecheck
```

If `crates/formula-ref-core/src/lib.rs` changes, regenerate the Rust artifacts before parity testing:

```bash
cargo test -p formula-ref-core
bun spikes/leanstral-formula-ref/build-rust-backend.mjs
bun run build.ts
bun test spikes/leanstral-formula-ref/formula-ref-core.parity.test.ts
```

`bun run build.ts` rebuilds the JavaScript bundle only. It does not regenerate `spikes/leanstral-formula-ref/dist/formula_ref_core.wasm` or `formula_ref_core.fallback.mjs`.

Lessons from the 2026-07-05 Leanstral/oracle pass:

- Do not promote model output by prose alone. Convert it into a fixture or a Bun regression with exact calls, commands, and expected outputs.
- Direct helper tests are not enough for command bugs. Use `ScheduleSheetCommands`/`loadSocialCalc()` command-level tests for copy, paste, fill, insert, delete, and undo behavior.
- `$` markers lock copy/fill references, not structural insert/delete. Structural operations can still move the underlying coordinate.
- Sheet-qualified ranges intentionally keep `sheetref` sticky through `:`. `OffsetFormulaCoords`, `AdjustFormulaCoords`, and `ReplaceFormulaCoords` are not interchangeable here.
- SocialCalc's supported max column is `ZZ` (702). References shifted past `ZZ` should become `#REF!`; do not allow high-side `rcColname`/`crToCoord` clamping to silently turn overflow into `ZZ`.
- For filldown/fillright, rectangular numeric series need per-column/per-row increments. Interactive editor `range2` state must be captured before clearing it.
- For deletecol/deleterow, undo must restore changed named-reference definitions as well as cell formulas.
- Treat lowercase/parser-normalization and no-op paste normalization as policy questions unless there is a concrete failing spreadsheet behavior.
