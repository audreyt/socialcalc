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
bun test
```

The bundle loads cleanly under `"use strict"` and keeps the existing UMD entry
points (browser global `SocialCalc`, AMD `define`, and CommonJS
`module.exports`) so downstream callers don't need to change.

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
