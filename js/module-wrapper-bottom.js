// Closing half of a UMD IIFE; see module-wrapper-top.js. Standalone it
// starts with a dangling `}))` and references `SocialCalc` without a
// local binding. Excluded from tsconfig.json's `include` for that
// reason; brace balance is correct after concat by build.ts.


// Leading `;` defuses an ASI trap: the preceding file ends with
// `SocialCalc.SpreadsheetViewerDecodeSpreadsheetSave = function(s,str){...}`
// and no trailing semicolon, so a bare `(` would be parsed as a call
// applied to that function expression.
;(function () {
    // DOM-free safety net. Full implementations live in
    // socialcalctableeditor.js / socialcalcspreadsheetcontrol.js and touch
    // `document`. Each wrapper checks at call time so tests that install a
    // DOM shim *after* bundle load still reach the real methods — the old
    // load-time replacement permanently stomped them once the bundle had
    // been loaded in a non-DOM context.
    var fallbacks = {
        GetEditorCellElement: function () {},
        ReplaceCell: function () {},
        EditorRenderSheet: function () {},
        SpreadsheetControlSortSave: function () { return ""; },
        SpreadsheetControlStatuslineCallback: function () {},
        DoPositionCalculations: function (editor) {
            SocialCalc.EditorSheetStatusCallback(
                null, "doneposcalc", null, editor
            );
        }
    };
    for (var name in fallbacks) {
        if (!Object.prototype.hasOwnProperty.call(fallbacks, name)) continue;
        (function (name, fallback) {
            var real = SocialCalc[name];
            SocialCalc[name] = function () {
                var fn = typeof document !== 'undefined' && real ? real : fallback;
                return fn.apply(this, arguments);
            };
        }(name, fallbacks[name]));
    }
}());

// Compatibility with webworker-threads
if (typeof self !== 'undefined' && self.thread) {
    window.setTimeout = function (cb, ms) {
        if (ms <= 1) { self.thread.nextTick(cb); }
    };
    window.clearTimeout = function () {};
}

    // Just return a value to define the module export.
    return SocialCalc;
}));
