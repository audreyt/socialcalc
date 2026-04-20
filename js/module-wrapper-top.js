// Opening half of a UMD IIFE. Only parses when concatenated with
// module-wrapper-bottom.js (see build.ts) — standalone it has an
// unclosed `function(window) {` block. Excluded from tsconfig.json's
// `include` for that reason; brace balance is correct after concat.
//
// Taken from https://github.com/umdjs/umd/blob/master/templates/returnExports.js
// (c) by The UMD contributors
// MIT License: https://github.com/umdjs/umd/blob/master/LICENSE.md
(function (root, factory) {
    "use strict";
    // Evaluate once and fan out to both deliveries:
    //   * browser / globalThis (root.SocialCalc) — always set
    //   * CommonJS / Node (module.exports) — when present
    // AMD was dropped from this wrapper: the npm package is its
    // canonical entry point today, and AMD loaders (RequireJS, Dojo
    // legacy) have been unmaintained for years. Anyone still wiring
    // AMD can wrap the CommonJS module themselves.
    var exported = factory.call(root, root);
    root.SocialCalc = exported;
    if (typeof module === 'object' && module && module.exports) {
        module.exports = exported;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (window) {
"use strict";
