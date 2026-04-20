// Closing half of a UMD IIFE; see module-wrapper-top.js. Standalone it
// starts with a dangling `}))` and references `SocialCalc` without a
// local binding. Excluded from tsconfig.json's `include` for that
// reason; brace balance is correct after concat by build.ts.

if('undefined' === typeof document) {
    // We don't really need a DOM-based presentation layer on the server
    SocialCalc.GetEditorCellElement = function () {};
    SocialCalc.ReplaceCell = function () {};
    SocialCalc.EditorRenderSheet = function () {};
    SocialCalc.SpreadsheetControlSortSave = function () { return ""; };
    SocialCalc.SpreadsheetControlStatuslineCallback = function () {};
    SocialCalc.DoPositionCalculations = function (editor) {
        SocialCalc.EditorSheetStatusCallback(
            null, "doneposcalc", null, editor
        );
    };
}

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
