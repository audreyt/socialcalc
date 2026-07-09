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
points (browser global `SocialCalc` and CommonJS `module.exports`; AMD was
dropped from the wrapper) so downstream callers don't need to change.

### TypeScript sources (in-place)

All core modules under `js/` are global-script `.ts` (zero `js/*.js`). UMD
wrappers are inlined in `build.ts`. Fully typechecked today: `formatnumber2.ts`, `socialcalcconstants.ts`,
`formula-parse.ts`, `formula-operand.ts`, `formula-ref.ts`, `formula1.ts`,
`socialcalc-3.ts`, `socialcalcspreadsheetcontrol.ts`, `socialcalctableeditor.ts`, `socialcalcviewer.ts`,
`socialcalcpopup.ts`. LemmaScript `//@ verify` marks typed pure helpers
(see `AGENTS.md`).

## Formula-reference rewrite coverage

`OffsetFormulaCoords`, `AdjustFormulaCoords`, and `ReplaceFormulaCoords` live in
shipping TypeScript (`js/formula-ref.ts`) with LemmaScript `//@ verify` marks.
The former Leanstral-assisted Rust/WASM parity spike was removed after its
fixtures and invariants moved onto the TS/LemmaScript + Bun side.

When changing formula-reference rewrites:

```bash
bun run build.ts
bun test test/formula-rewrite-cases.test.ts test/formula-rewrite-regressions.test.ts
bun run typecheck
```

Lessons from the Leanstral/oracle pass:

- Treat current SocialCalc JavaScript as the compatibility oracle unless a command-level spreadsheet scenario proves a bug.
- Promote model suggestions only when they become concrete fixtures or Bun tests with exact inputs and expected outputs.
- `$` markers lock copy/fill movement, not structural insert/delete; structural rewrites still move the underlying coordinate.
- `sheetref` stickiness is intentional around sheet-qualified ranges and `:`; do not “simplify” it without a regression case.
- References shifted beyond the supported `ZZ` column become `#REF!`; do not rely on `crToCoord`/`rcColname` high-side clamping.
- Command bugs belong in command-level tests, not only direct formula-helper tests. The useful regressions found here covered rectangular fill series, undo for deleted named references, and max-column insert/rewrite boundaries.

Relevant tests:

- `test/fixtures/formula-rewrite-cases.json` — data-driven direct + command cases ported from the retired spike.
- `test/formula-rewrite-cases.test.ts` — runs every fixture case against the shipping bundle.
- `test/formula-rewrite-regressions.test.ts` — production coverage for formula-helper edge cases.
- `test/command-boundary-regressions.test.ts` — command-level max-column behavior.
- `test/filldown-persistence.test.ts` — headless and interactive fill persistence/increment behavior.
- `test/sheet-coverage-b.test.ts` — command undo/name-reference coverage.

## LemmaScript verification (Dafny + Lean)

Shipping pure helpers carry `//@ verify` comments, but SocialCalc `js/*.ts` are
global scripts, so LemmaScript cannot extract them. Exported facades under
`lemma/` are the verification surface:

- `lemma/a1.ts` — pure A1 clamp/coord algebra and overflow `#REF!` policy
- `lemma/eval-ops.ts` — pure `/` and `&` error-propagation lattice
- `lemma/lookup-result.ts` — pure LookupResultType string-table algorithm

**Dafny backend** (requires `dafny` on PATH) — generate + verify:

```bash
bun run verify:dafny:gen
bun run verify:dafny
# 26 VCs on lemma/a1.dfy + 4 VCs on lemma/eval-ops.dfy + 1 VC on lemma/lookup-result.dfy
```

**Lean backend** (requires `lemmascript` / `lsc`) — generate models:

```bash
bun run verify:lean:gen
bun run verify:lean          # gen + assert non-empty artifacts
```
Optional full Lean proof build (`bun run verify:lean:build` / `lake build`) needs
sibling checkouts at `../velvet`, `../loom` (`lemma` branches), and
`../LemmaScript`. Pure helpers prove with `loom_solve` (a1 + eval-ops +
lookup-result resolveToken; a1 string builders use `a1.spec.lean` length lemmas)
— no `sorry`. CI runs Dafny `lsc check` and Lean `lsc gen` smoke. File list:
`LemmaScript-files.txt`.

Both: `bun run verify:both`

## Mutation testing

Line coverage is a floor, not a ceiling. We use [Stryker](https://stryker-mutator.io)
to check that the tests meaningfully pin behaviour — every mutant that
survives is a behavior the tests do not actually exercise.

`stryker.config.mjs` drives Stryker through a generic `command` runner
(`bun run build.ts && bun test`) so we don't need a Bun-specific plugin.
Two modes:

- **Fast per-file iteration** — `bun run mutate:file js/<source>.js|.ts [startLine-endLine]`
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
| `formatnumber2.ts` | 95.20% | Remaining 54 survivors classified as equivalent mutants |
| `formula1.ts` | — | Typechecked; mutation not measured |
| `socialcalc-3.ts` | — | Typechecked; mutation not measured |
| `socialcalcspreadsheetcontrol.ts` | — | Typechecked; mutation not measured |
| `socialcalctableeditor.ts` | — | Typechecked; mutation not measured |
| `socialcalcviewer.ts` / `socialcalcpopup.ts` | — | Typechecked; mutation not measured |

## Licensing
### Common Public Attribution License (Socialtext Inc.)
* socialcalcspreadsheetcontrol.ts
* socialcalctableeditor.ts

### Artistic License 2.0 (Socialtext Inc.)
* formatnumber2.ts
* formula1.ts
* socialcalc-3.ts
* socialcalcconstants.ts
* socialcalcpopup.ts

### Mozilla Public License 2.0
* images/sc_*.png
