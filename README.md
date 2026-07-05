# SocialCalc
This is the npm package for SocialCalc, an in-browser spreadsheet editor with support for real-time collaboration.
This version is based on the version used in [EtherCalc](https://github.com/audreyt/ethercalc).

See it in action at [ethercalc.net](http://ethercalc.net)!

## Requirements
* jQuery (only on the client-side)

## Usage
You can `require('socialcalc')` or include `node_modules/socialcalc/dist/SocialCalc.js` on your web page using a script tag.

In order to create an editor instance use:
```js
var socialCalcControl = new SocialCalc.SpreadsheetControl()
socialCalcControl.InitializeSpreadsheetControl(el /*, height, width, spacebelow*/)
```

This package also works in node.js. You don't need to callc `InitializeSpreadsheetControl` here, because that is just initializing the rendering.

## Build from sources

SocialCalc builds with [Bun](https://bun.sh) and type-checks with
[tsgo](https://github.com/microsoft/typescript-go) (the native TypeScript 7.0
compiler). Install the dependencies:
```bash
bun install
```
Build `dist/SocialCalc.js` and `dist/socialcalc.css`:
```bash
bun run build
```
Optional minified bundle (`dist/SocialCalc.min.js`):
```bash
bun run build:min
```
Type-check in strict mode:
```bash
bun run typecheck
```
Run the smoke tests (parse, recalc, formula coverage, strict-mode global-leak
guard):
```bash
bun run test
```

The bundle loads cleanly under `"use strict"` and keeps the existing UMD entry
points (browser global `SocialCalc`, AMD `define`, and CommonJS
`module.exports`) so downstream callers don't need to change.

## Formula-reference rewrite spike

This branch includes a narrow Leanstral-assisted Rust/WASM spike for SocialCalc's formula-reference rewrite helpers: `OffsetFormulaCoords`, `AdjustFormulaCoords`, and `ReplaceFormulaCoords`. The spike lives under `spikes/leanstral-formula-ref/`; it is a parity oracle and research harness, not a replacement for the full JavaScript formula engine.

Use it when changing formula-reference rewrites:

```bash
cargo test -p formula-ref-core
bun spikes/leanstral-formula-ref/build-rust-backend.mjs
bun run build.ts
bun test spikes/leanstral-formula-ref/formula-ref-core.parity.test.ts
```

`build-rust-backend.mjs` is required after any `crates/formula-ref-core/src/lib.rs` change. The parity test loads the generated `spikes/leanstral-formula-ref/dist/formula_ref_core.wasm` and `formula_ref_core.fallback.mjs`; `bun run build.ts` alone does not regenerate those artifacts.

Lessons from the Leanstral/oracle pass:

- Treat current SocialCalc JavaScript as the compatibility oracle unless a command-level spreadsheet scenario proves a bug.
- Promote model suggestions only when they become concrete fixtures or Bun tests with exact inputs and expected outputs.
- `$` markers lock copy/fill movement, not structural insert/delete; structural rewrites still move the underlying coordinate.
- `sheetref` stickiness is intentional around sheet-qualified ranges and `:`; do not “simplify” it without a regression case.
- References shifted beyond the supported `ZZ` column become `#REF!`; do not rely on `crToCoord`/`rcColname` high-side clamping.
- Command bugs belong in command-level tests, not only direct formula-helper tests. The useful regressions found here covered rectangular fill series, undo for deleted named references, and max-column insert/rewrite boundaries.

Relevant tests:

- `test/formula-rewrite-regressions.test.ts` — production coverage for formula-helper edge cases suggested by Leanstral/oracle review.
- `spikes/leanstral-formula-ref/formula-ref-core.parity.test.ts` — JS/WASM/fallback parity over fixture cases.
- `test/command-boundary-regressions.test.ts` — command-level max-column behavior.
- `test/filldown-persistence.test.ts` — headless and interactive fill persistence/increment behavior.
- `test/sheet-coverage-b.test.ts` — command undo/name-reference coverage.

## Mutation testing

Line coverage is a floor, not a ceiling. We use [Stryker](https://stryker-mutator.io)
to check that the tests meaningfully pin behaviour — every mutant that
survives is a behavior the tests do not actually exercise.

`stryker.config.mjs` drives Stryker through a generic `command` runner
(`bun run build.ts && bun test`) so we don't need a Bun-specific plugin.
Two modes:

- **Fast per-file iteration** — `bun run mutate:file js/<source>.js [startLine-endLine]`
  flips Stryker to in-place mode and filters the test command to only the
  test files that exercise that module (see the mapping in
  `stryker-file.mjs`). Also available: `bun run mutate:format`,
  `bun run mutate:sheet`, `bun run mutate:formula`.
- **Full sandbox run** — `bun run mutate` copies the project into parallel
  sandboxes and mutates every source in the `mutate` list. Slower but
  useful before tagging a release.

Reports are emitted to `reports/mutation/index.html` (Stryker's interactive
viewer) and `reports/mutation/mutation.json` (the raw data). Incremental
mode is enabled, so iterating after adding killing tests only re-checks the
previously-surviving mutants.

Current mutation scores:

| Module | Score | Status |
|---|---|---|
| `formatnumber2.js` | 95.20% | Remaining 54 survivors classified as equivalent mutants |
| `formula1.js` | — | Parser/evaluator run in progress |
| `socialcalc-3.js` | — | Not yet measured |
| UI modules | — | Not yet measured (heavily DOM-coupled) |

## Licensing
### Common Public Attribution License (Socialtext Inc.)
* socialcalcspreadsheetcontrol.js
* socialcalctableeditor.js

### Artistic License 2.0 (Socialtext Inc.)
* formatnumber2.js
* formula1.js
* socialcalc-3.js
* socialcalcconstants.js
* socialcalcpopup.js

### Mozilla Public License 2.0
* images/sc_*.png
