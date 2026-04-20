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
