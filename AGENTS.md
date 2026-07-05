# Agent notes

## SocialCalc formula-reference work

When changing formula-reference rewrite behavior, preserve compatibility first. The legacy JavaScript in `js/socialcalc-3.js` is the compatibility oracle unless a command-level spreadsheet scenario proves the current behavior is wrong.

Key files:

- `js/socialcalc-3.js` — production command handling and formula-reference rewrite helpers.
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
