// In-place TypeScript conversion of socialcalc-3.js (SocialCalc global script).
// Ambient API types live in socialcalc-3.d.ts (referenced by dist/SocialCalc.d.ts).
// Vite+ strips types with Oxc before UMD concat — no runtime tax.
// Typechecked core after removing @ts-nocheck.

// The main SocialCalc code module of the SocialCalc package
//
/*
// (c) Copyright 2010 Socialtext, Inc.
// All Rights Reserved.
//
// The contents of this file are subject to the Artistic License 2.0; you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at http://socialcalc.org/licenses/al-20/.
//
// Some of the other files in the SocialCalc package are licensed under
// different licenses. Please note the licenses of the modules you use.
//
// Code History:
//
// Initially coded by Dan Bricklin of Software Garden, Inc., for Socialtext, Inc.
// Based in part on the SocialCalc 1.1.0 code written in Perl.
// The SocialCalc 1.1.0 code was:
//    Portions (c) Copyright 2005, 2006, 2007 Software Garden, Inc.
//    All Rights Reserved.
//    Portions (c) Copyright 2007 Socialtext, Inc.
//    All Rights Reserved.
// The Perl SocialCalc started as modifications to the wikiCalc(R) program, version 1.0.
// wikiCalc 1.0 was written by Software Garden, Inc.
// Unless otherwise specified, referring to "SocialCalc" in comments refers to this
// JavaScript version of the code, not the SocialCalc Perl code.
//
*/

// Mutable progressive-init bridges for ambient nested namespaces.

/*

**** Overview ****

This is the beginning of a library of routines for displaying and editing spreadsheet
data in a browser. The HTML that includes this does not need to have anything
specific to the spreadsheet or editor already present -- everything is dynamically
added to the DOM by this code, including the rendered sheet and any editing controls.

The library has a few parts. This is the main SocialCalc code module.
Other parts are the Table Editor module, the Formula module, and the Format Number module.
Note: The Table Editor module is licensed under a different license than this module.

The class/object style is derived from O'Reilly's JavaScript by Flanagan, 5th Edition,
section 9.3, page 157.

All of the data, object definitions, functions, etc., are stored as properties of the SocialCalc
object so as not to clutter up the global variables nor conflict with other names.

A design goal (not tested yet for success) is to make it possible to have more than one
spreadsheet active on a page, perhaps even open for editing. It is assumed, though, that
there is only one mouse and one keyboard (a good assumption on most PCs today but not in the
new "touch and surface world" Apple and Microsoft are working towards).

The testing has been on Windows Firefox (2 and 3),
Internet Explorer (6 and 7), Opera (9.23 and mainly later), Mac Safari (3.1), and Mac Firefox (2.0.0.6).
There are small issues with Firefox before 2.0 (cosmetic with drag handles) and larger ones
with Opera before 9.5 (the Delete key isn't recognized in some cases -- the 9.5 version was still
in beta and this bug affects other products like GMail, I believe).

The data is stored in a SocialCalc.Sheet object. The data is organized in a form similar to that
used by SocialCalc 1.1.0. There is a function for converting a normal SocialCalc spreadsheet
save data string (the spreadsheet part of a SocialCalc data file) into this internal form.

The SocialCalc.RenderContext class provides methods for rendering a table into the DOM representing
part of the spreadsheet. It is assumed that the spreadsheet could possibly be very large
and that rendering the whole thing at once could be too time consuming. It is also set up so
that it might be possible to have some of the sheet data only be loaded on demand (such as by Ajax).
The rendering can render cells to the right and below the already active area of the spreadsheet
so that you can scroll to that "clean" area without explicitly doing "add row/column". The class also
does simple operations such as "scrolling" within that table. The table may optionally include
row and column headers and may be split into panes. Most of the code assumes any number of panes,
but only the rightmost pane has scrolling code. In normal operation there would be one or two
panes horizontally and vertically. The panes may start on any row/column, though a given row/column
should only appear in one pane at a time (not all code enforces this, yet).

The RenderContext is designed to be rendered as part of a SocialCalc.TableEditor. The TableEditor
includes the spreadsheet grid as well as scrollbars, pane sliders, and (eventually) editing controls.
The layout is dynamic and may be recomputed on the fly, such as in response to resizing the browser
window.

The scrollbars and pane sliders are created using SocialCalc.TableControl objects. These in turn
make use of Dragging, ToolTip, Button, and MouseWheel functions.

The keyboard input is handled by keyboard code.

There are also some helper routines.

More comments yet to come...

*/

// SocialCalc is always defined by socialcalcconstants.js (which concatenates
// before this file in the UMD bundle). Redundant `if (!SocialCalc)` guard
// removed.
const SC = SocialCalc as any;

// *************************************
//
// Shared values
//
// These are "global" values shared by the classes, including default settings
//
// *************************************

// Callbacks

// Opt-in policy for rendering untrusted/third-party sheets. Default output
// (used when SocialCalc.Callbacks.untrustedContent is false, the default)
// is unaffected by this policy and matches the original, legacy behavior
// exactly: raw HTML passes through untouched and link/image URLs are not
// scheme-checked. Host applications that display sheets they did not author
// should set untrustedContent to true (and may override fields below)
// before rendering.
const defaultSecurityPolicy: SocialCalc.RenderSecurityPolicy = {
  sanitizeHtml: null,
  allowedUrlSchemes: ["http:", "https:", "mailto:"],
  allowedDataMimeTypes: [],
};

SC.Callbacks = {
  // The next two are used by SocialCalc.format_text_for_display

  // The function to expand wiki text - should be set if you want wikitext expansion
  // The form is: expand_wiki(displayvalue, sheetobj, linkstyle, valueformat)
  //    valueformat is text-wiki followed by optional sub-formats, e.g., text-wikipagelink

  expand_wiki: null,

  expand_markup /** @param {any} displayvalue @param {any} sheetobj @param {any} linkstyle */:
    function (displayvalue: any, sheetobj: any, linkstyle: any) {
      // the old function to expand wiki text - may be replaced
      return SocialCalc.default_expand_markup(displayvalue, sheetobj, linkstyle);
    },

  // MakePageLink is used to create the href for a link to another "page"
  // The form is: MakePageLink(pagename, workspacename, linktyle, valueformat), returns string

  MakePageLink: null,

  // NormalizeSheetName is used to make different variations of sheetnames use the same cache slot

  NormalizeSheetName: null, // use default - lowercase

  // Opt-in: see defaultSecurityPolicy above and SocialCalc.SafeUrlForRender
  // / SocialCalc.EscapeUntrustedHtml.
  untrustedContent: false,
  securityPolicy: defaultSecurityPolicy,
};

// Shared flags

// none at present

// *************************************
//
// Cell class:
//
// *************************************

//
// Class SocialCalc.Cell
//
// Usage: var s = new SocialCalc.Cell(coord);
//
// Cell attributes include:
//
//    coord: the column/row as a string, e.g., "A1"
//    datavalue: the value to be used for computation and formatting for display,
//               string or numeric (tolerant of numbers stored as strings)
//    datatype: if present, v=numeric value, t=text value, f=formula,
//              or c=constant that is not a simple number (like "$1.20")
//    formula: if present, the formula (without leading "=") for computation or the constant
//    valuetype: first char is main type, the following are sub-types.
//               Main types are b=blank cell, n=numeric, t=text, e=error
//               Examples of using sub-types would be "nt" for a numeric time value, "n$" for currency, "nl" for logical
//    readonly: if present, whether the current cell is read-only of writable
//    displayvalue: if present, rendered version of datavalue with formatting attributes applied
//    parseinfo: if present, cached parsed version of formula
//
//    The following optional values, if present, are mainly used in rendering, overriding defaults:
//
//    bt, br, bb, bl: number of border's definition
//    layout: layout (vertical alignment, padding) definition number
//    font: font definition number
//    color: text color definition number
//    bgcolor: background color definition number
//    cellformat: cell format (horizontal alignment) definition number
//    nontextvalueformat: custom format definition number for non-text values, e.g., numbers
//    textvalueformat: custom format definition number for text values
//    colspan, rowspan: number of cells to span for merged cells (only on main cell)
//    cssc: custom css classname for cell, as text (no special chars)
//    csss: custom css style definition
//    mod: modification allowed flag "y" if present
//    unlocked: if present ("y"), cell stays editable when the sheet is protected
//    comment: cell comment string
//

// Eddy - SocialCalc.Cell

/** @param {any} coord */
SC.Cell = function (coord: any) {
  this.coord = coord;
  this.datavalue = "";
  this.datatype = null;
  this.formula = "";
  this.valuetype = "b";
  this.readonly = false;
  this.unlocked = false;
  // Spill metadata is attached only when a formula actually spills.
};

// The types of cell properties
//
// Type 1: Base, Type 2: Attribute, Type 3: Special (e.g., displaystring, parseinfo)

SC.CellProperties = {
  coord: 1,
  datavalue: 1,
  datatype: 1,
  formula: 1,
  valuetype: 1,
  errors: 1,
  comment: 1,
  validation: 1,
  readonly: 1,
  bt: 2,
  br: 2,
  bb: 2,
  bl: 2,
  layout: 2,
  font: 2,
  color: 2,
  bgcolor: 2,
  cellformat: 2,
  nontextvalueformat: 2,
  textvalueformat: 2,
  colspan: 2,
  rowspan: 2,
  cssc: 2,
  csss: 2,
  unlocked: 2,
  spillrows: 1,
  spillcols: 1,
  spillowner: 1,
  spillrow: 1,
  spillcol: 1,
  mod: 2,
  displaystring: 3, // used to cache rendered HTML of cell contents
  parseinfo: 3, // used to cache parsed formulas
  hcolspan: 3,
  hrowspan: 3, // spans taking hidden cols/rows into account (!!! NOT YET !!!)
};

SC.CellPropertiesTable = {
  bt: "borderstyle",
  br: "borderstyle",
  bb: "borderstyle",
  bl: "borderstyle",
  layout: "layout",
  font: "font",
  color: "color",
  bgcolor: "color",
  cellformat: "cellformat",
  nontextvalueformat: "valueformat",
  textvalueformat: "valueformat",
};

SC.ClearSpill = function (sheet: any, anchor: any) {
  var removed = false;
  var rows = anchor.spillrows || 0,
    cols = anchor.spillcols || 0;
  var cr = SocialCalc.coordToCr(anchor.coord);
  for (var r = 0; r < rows; r++)
    for (var c = 0; c < cols; c++) {
      if (!r && !c) continue;
      var coord = SocialCalc.crToCoord(cr.col + c, cr.row + r);
      var cell = sheet.cells[coord];
      if (cell && cell.spillowner === anchor.coord) {
        delete sheet.cells[coord];
        removed = true;
      }
    }
  delete anchor.spillrows;
  delete anchor.spillcols;
  if (removed) {
    sheet.renderneeded = true;
    sheet.changedrendervalues = true;
    sheet.spillTopologyChanged = true;
    sheet.reRenderCellList = sheet.reRenderCellList || [];
    if (sheet.reRenderCellList.indexOf(anchor.coord) < 0) sheet.reRenderCellList.push(anchor.coord);
  }
  return removed;
};
SC.ClearAllDerivedSpills = function (sheet: any) {
  var changed = false;
  for (var key in sheet.cells) {
    var cell = sheet.cells[key];
    if (!cell) continue;
    if (cell.spillowner) {
      delete sheet.cells[key];
      changed = true;
    } else if (cell.spillrows || cell.spillcols) {
      delete cell.spillrows;
      delete cell.spillcols;
      changed = true;
    }
  }
  if (changed) {
    sheet.renderneeded = true;
    sheet.changedrendervalues = true;
    sheet.spillTopologyChanged = true;
  }
};
SC.SanitizeSpills = function (sheet: any) {
  var valid: any = {};
  for (var key in sheet.cells) {
    var cell = sheet.cells[key],
      ok = false,
      cr;
    if (!cell || cell.spillowner || (cell.spillrows == null && cell.spillcols == null)) continue;
    try {
      cr = SocialCalc.coordToCr(key);
      ok =
        Number.isInteger(cell.spillrows) &&
        Number.isInteger(cell.spillcols) &&
        cell.spillrows > 0 &&
        cell.spillcols > 0 &&
        cell.datatype === "f" &&
        !!cell.formula &&
        SocialCalc.Formula.PlanSpillStatus(
          cr.col,
          cr.row,
          cell.spillrows,
          cell.spillcols,
          SocialCalc.Formula.SPILL_MAX_COL,
          SocialCalc.Formula.SPILL_MAX_ROW,
          SocialCalc.Formula.SPILL_MAX_CELLS,
        ) === 0;
    } catch {}
    if (ok) valid[key] = true;
    else {
      delete cell.spillrows;
      delete cell.spillcols;
    }
  }
  for (var childkey in sheet.cells) {
    var child = sheet.cells[childkey],
      owner = child && sheet.cells[child.spillowner],
      good = false;
    if (!child || !child.spillowner) continue;
    if (owner && valid[child.spillowner])
      try {
        var a = SocialCalc.coordToCr(child.spillowner),
          c = SocialCalc.coordToCr(childkey);
        good =
          Number.isInteger(child.spillrow) &&
          Number.isInteger(child.spillcol) &&
          child.spillrow >= 0 &&
          child.spillcol >= 0 &&
          (child.spillrow || child.spillcol) &&
          child.spillrow < owner.spillrows &&
          child.spillcol < owner.spillcols &&
          c.col === a.col + child.spillcol &&
          c.row === a.row + child.spillrow;
      } catch {}
    if (!good) delete sheet.cells[childkey];
    else {
      child.datatype = null;
      child.formula = "";
    }
  }
  sheet.renderneeded = true;
};

//
// AutoFilter / structured tables
//
// AutoFilter state (sheet.autofilters[id] = {id, range, criteria}) drives a
// derived, independently-owned hidden-row axis (sheet.rowattribs.filterhide)
// that is composed with the pre-existing manual axis (sheet.rowattribs.hide)
// via RowEffectivelyHidden -- see lemma/visibility.ts for the proved
// composition/clear-isolation/idempotence policies this mirrors.
//
// Structured tables (sheet.tables[name] = {name, range, hasHeader, style,
// filterId}) are a thin named-registry layer over a range plus an optional
// integrated AutoFilter; they do not introduce structured-reference formula
// syntax.
//

/** @param {any} sheet @param {any} row */
SC.RowEffectivelyHidden = function (sheet: any, row: number): boolean {
  return sheet.rowattribs.hide[row] == "yes" || sheet.rowattribs.filterhide[row] == "yes";
};

/**
 * Whether cell cr fails the AutoFilter's criterion. A criterion with no
 * present sub-parts (values/op/op2) never fails a cell.
 */
SC.AutoFilterCellFailsCriterion = function (sheet: any, criterion: any, cr: string): boolean {
  var cell = sheet.cells[cr];
  var datavalue = cell ? cell.datavalue : "";
  var valuetype = (cell && cell.valuetype) || "b";
  // SocialCalc.format_number_for_display is unconditionally assigned by
  // this same shipping module (no plausible "without rest of SocialCalc"
  // partial-load path exists at this call site), so no defensive fallback
  // is needed here.
  var displaytext =
    datavalue == null
      ? ""
      : valuetype.charAt(0) == "n"
        ? SocialCalc.format_number_for_display(datavalue, valuetype, "")
        : "" + datavalue;

  if (criterion.values) {
    var found = false;
    for (var i = 0; i < criterion.values.length; i++) {
      if (criterion.values[i] === displaytext) {
        found = true;
        break;
      }
    }
    if (!found) return true;
  }
  if (criterion.op && !SocialCalc.Formula.TestCriteria(datavalue, valuetype, criterion.op)) {
    return true;
  }
  if (criterion.op2 && !SocialCalc.Formula.TestCriteria(datavalue, valuetype, criterion.op2)) {
    return true;
  }
  return false;
};

/**
 * Recompute one AutoFilter's contribution to sheet.rowattribs.filterhide.
 * Pure function of current cell data and the filter's own criteria --
 * idempotent by construction (lemma/visibility.ts recomputeIsIdempotent):
 * re-running never depends on the prior filterhide bit. Only rows inside
 * this filter's data band (below the header, within the range) are ever
 * touched; a filterhide flag set by this filter for a row it no longer
 * covers is cleared.
 */
SC.RecomputeAutoFilter = function (sheet: any, filterId: string) {
  var def = sheet.autofilters[filterId];
  if (!def) return;
  // ParseRange never throws (see FindAutoFilterForHeaderCell's comment).
  var prange: any = SocialCalc.ParseRange(def.range);
  var cr1 = prange.cr1,
    cr2 = prange.cr2;
  var headerRow = cr1.row;
  var lastRow = cr2.row;
  var ownedRows = def.ownedRows || {};
  var newOwnedRows: { [row: number]: boolean } = {};

  for (var row = headerRow + 1; row <= lastRow; row++) {
    var failsAny = false;
    for (var offsetKey in def.criteria) {
      var offset = Number(offsetKey);
      var col = cr1.col + offset;
      if (col > cr2.col) continue;
      var cr = SocialCalc.crToCoord(col, row);
      if (SocialCalc.AutoFilterCellFailsCriterion(sheet, def.criteria[offsetKey], cr)) {
        failsAny = true;
        break;
      }
    }
    newOwnedRows[row] = true;
    if (failsAny) {
      sheet.rowattribs.filterhide[row] = "yes";
    } else if (sheet.rowattribs.filterhide[row] == "yes") {
      delete sheet.rowattribs.filterhide[row];
    }
  }
  // Rows previously owned by this filter but no longer in its band (range
  // shrank via structural edit) lose this filter's hide contribution.
  for (var ownedRowKey in ownedRows) {
    var ownedRow = Number(ownedRowKey);
    if (!newOwnedRows[ownedRow] && sheet.rowattribs.filterhide[ownedRow] == "yes") {
      delete sheet.rowattribs.filterhide[ownedRow];
    }
  }
  def.ownedRows = newOwnedRows;
};

/** Recompute every AutoFilter's filterhide contribution. Safe to call repeatedly (idempotent). */
SC.RecomputeAutoFilters = function (sheet: any) {
  for (var id in sheet.autofilters) {
    SocialCalc.RecomputeAutoFilter(sheet, id);
  }
};

/** Collect the distinct display values present in one AutoFilter column, for dropdown population. */
SC.CollectAutoFilterColumnValues = function (
  sheet: any,
  filterId: string,
  colOffset: number,
): string[] {
  var def = sheet.autofilters[filterId];
  if (!def) return [];
  var prange: any = SocialCalc.ParseRange(def.range);
  var cr1 = prange.cr1,
    cr2 = prange.cr2;
  var col = cr1.col + colOffset;
  if (col > cr2.col) return [];
  var seen: { [v: string]: boolean } = {};
  var result: string[] = [];
  for (var row = cr1.row + 1; row <= cr2.row; row++) {
    var cr = SocialCalc.crToCoord(col, row);
    var cell = sheet.cells[cr];
    var valuetype = (cell && cell.valuetype) || "b";
    var datavalue = cell ? cell.datavalue : "";
    var displaytext =
      datavalue == null
        ? ""
        : valuetype.charAt(0) == "n"
          ? SocialCalc.format_number_for_display(datavalue, valuetype, "")
          : "" + datavalue;
    if (!seen[displaytext]) {
      seen[displaytext] = true;
      result.push(displaytext);
    }
  }
  result.sort();
  return result;
};

/**
 * Shift/invalidate every AutoFilter and table range on a structural insert
 * (positive coloffset/rowoffset) or delete (negative). Mirrors the endpoint
 * policy AdjustFormulaCoords applies to formulas/names: a range whose start
 * or end lands entirely inside a deleted band collapses (filter/table
 * removed); otherwise both endpoints shift independently via
 * AdjustFormulaCoords on synthetic single-cell references.
 */
SC.AdjustAutoFilterRangesForStructuralEdit = function (
  sheet: any,
  startCol: number,
  coloffset: number,
  startRow: number,
  rowoffset: number,
) {
  var adjustEndpoint = function (coord: string): string | null {
    var adjusted = SocialCalc.AdjustFormulaCoords(coord, startCol, coloffset, startRow, rowoffset);
    if (adjusted.indexOf("#REF!") != -1) return null;
    return adjusted;
  };

  var adjustRange = function (range: string): string | null {
    var pos = range.indexOf(":");
    var c1 = pos >= 0 ? range.substring(0, pos) : range;
    var c2 = pos >= 0 ? range.substring(pos + 1) : range;
    var a1 = adjustEndpoint(c1);
    var a2 = adjustEndpoint(c2);
    if (a1 == null || a2 == null) return null;
    return pos >= 0 ? a1 + ":" + a2 : a1;
  };

  var filterId: string;
  for (filterId in sheet.autofilters) {
    var def = sheet.autofilters[filterId];
    var adjusted = adjustRange(def.range);
    if (adjusted == null) {
      // Header or full range destroyed by the structural edit: drop the filter
      // and release every row it was holding hidden.
      var ownedRows = def.ownedRows || {};
      for (var ownedRowKey in ownedRows) {
        var ownedRow = Number(ownedRowKey);
        if (sheet.rowattribs.filterhide[ownedRow] == "yes") {
          delete sheet.rowattribs.filterhide[ownedRow];
        }
      }
      delete sheet.autofilters[filterId];
      for (var tname in sheet.tables) {
        if (sheet.tables[tname].filterId == filterId) sheet.tables[tname].filterId = null;
      }
    } else {
      def.range = adjusted;
    }
  }

  var tableName: string;
  for (tableName in sheet.tables) {
    var tdef = sheet.tables[tableName];
    var tadjusted = adjustRange(tdef.range);
    if (tadjusted == null) {
      delete sheet.tables[tableName];
    } else {
      tdef.range = tadjusted;
    }
  }

  SocialCalc.RecomputeAutoFilters(sheet);
};

/** Uppercase, strip to [A-Z0-9_.] -- identical policy to name sanitization (ExecuteSheetCommand "name"). */
SC.SanitizeTableName = function (name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9_.]/g, "");
};

/**
 * Whether SUBTOTAL must exclude this row from its aggregate: filter-hidden
 * rows are always excluded; manually-hidden rows are excluded only for the
 * 101-111 function-code family (includeManualHidden=true).
 */
SC.SubtotalExcludesRow = function (sheet: any, row: number, includeManualHidden: boolean): boolean {
  if (sheet.rowattribs.filterhide[row] == "yes") return true;
  if (includeManualHidden && sheet.rowattribs.hide[row] == "yes") return true;
  return false;
};
//
// SocialCalc.IsSheetProtected(sheet)
// SocialCalc.IsCellEditable(sheet, coord)
//
// Centralized whole-sheet protection policy. Protection is a UI/data-
// integrity guard against accidental edits, not access control: there are
// no passwords and no cryptographic enforcement. Every mutation path (set,
// erase, fill, paste, merge, sort, move, insert, delete, editor commit, and
// programmatic sheet commands) MUST route through SC.IsCellEditable rather
// than testing cell.readonly or sheet.attribs.protected directly, so the
// policy — mirrored in lemma/protect.ts and proved in lemma/protect.dfy —
// stays the single source of truth.
//
// A cell's pre-existing readonly flag always blocks editing, independent of
// protection state (preserves legacy cell.readonly behavior byte-for-byte
// on unprotected sheets). When the sheet is protected, a non-readonly cell
// is editable only if explicitly marked unlocked (Excel-style default-
// locked-cell model).
//

/** @param {any} sheet */
SC.IsSheetProtected = function (sheet: any) {
  return sheet.attribs.protected == "yes";
};

/** @param {any} sheet @param {any} coord */
SC.IsCellEditable = function (sheet: any, coord: any) {
  var cell = sheet.cells[coord];
  if (cell && cell.readonly) return false;
  if (!SocialCalc.IsSheetProtected(sheet)) return true;
  return !!(cell && cell.unlocked);
};

SC.SpillOwnerForCoord = function (sheet: any, coord: any) {
  var cell = sheet.cells[coord];
  return cell && cell.spillowner ? cell.spillowner : coord;
};
SC.SpillCommandError = "Cannot change part of a spilled array.";
SC.PrepareSpillMutation = function (sheet: any, ranges: any, blockAnchors: any) {
  var anchors: any = {},
    parsed: any[] = [],
    i: any,
    range: any,
    coord: any,
    cell: any,
    cr: any,
    covered: any;
  for (i = 0; i < ranges.length; i++) {
    range = typeof ranges[i] === "string" ? SocialCalc.ParseRange(ranges[i]) : ranges[i];
    parsed.push(range);
  }
  for (coord in sheet.cells) {
    cell = sheet.cells[coord];
    if (!cell || cell.readonly) continue;
    cr = SocialCalc.coordToCr(coord);
    covered = false;
    for (i = 0; i < parsed.length; i++) {
      range = parsed[i];
      if (
        cr.col >= range.cr1.col &&
        cr.col <= range.cr2.col &&
        cr.row >= range.cr1.row &&
        cr.row <= range.cr2.row
      ) {
        covered = true;
        break;
      }
    }
    if (!covered) continue;
    if (cell.spillowner) return SC.SpillCommandError;
    if (cell.spillrows || cell.spillcols) {
      if (blockAnchors) return SC.SpillCommandError;
      anchors[coord] = cell;
    }
  }
  for (coord in anchors) SocialCalc.ClearSpill(sheet, anchors[coord]);
  return "";
};
SC.MaterializeSpill = function (sheet: any, coord: any, eresult: any) {
  var av = eresult && eresult.value,
    cr = SocialCalc.coordToCr(coord),
    anchor = sheet.GetAssuredCell(coord);
  var valid =
    eresult &&
    eresult.type === "array" &&
    av &&
    Number.isInteger(av.rows) &&
    Number.isInteger(av.cols) &&
    av.rows > 0 &&
    av.cols > 0 &&
    Array.isArray(av.cells) &&
    av.cells.length === av.rows &&
    av.cells.every(function (row: any) {
      return (
        Array.isArray(row) &&
        row.length === av.cols &&
        row.every(function (v: any) {
          return v && typeof v.type === "string" && "value" in v;
        })
      );
    });
  if (
    !valid ||
    SocialCalc.Formula.PlanSpillStatus(
      cr.col,
      cr.row,
      av && av.rows,
      av && av.cols,
      SocialCalc.Formula.SPILL_MAX_COL,
      SocialCalc.Formula.SPILL_MAX_ROW,
      SocialCalc.Formula.SPILL_MAX_CELLS,
    ) !== 0 ||
    ((av.rows > 1 || av.cols > 1) && (anchor.colspan || anchor.rowspan))
  ) {
    SC.ClearSpill(sheet, anchor);
    return null;
  }
  var oldrows = anchor.spillrows || 0,
    oldcols = anchor.spillcols || 0;
  var collision = false;
  for (var key in sheet.cells) {
    var old = sheet.cells[key];
    if (!old || key === coord || old.spillowner === coord) continue;
    var a = SocialCalc.coordToCr(key);
    var inrect =
      a.col >= cr.col && a.col < cr.col + av.cols && a.row >= cr.row && a.row < cr.row + av.rows;
    var merged = old.colspan > 1 || old.rowspan > 1;
    var intersects =
      merged &&
      a.col < cr.col + av.cols &&
      a.col + (old.colspan || 1) > cr.col &&
      a.row < cr.row + av.rows &&
      a.row + (old.rowspan || 1) > cr.row;
    if (inrect || intersects) {
      collision = true;
      break;
    }
  }
  if (collision) {
    SC.ClearSpill(sheet, anchor);
    return null;
  }
  var topologyChanged = oldrows !== av.rows || oldcols !== av.cols;
  for (var r = 0; r < oldrows; r++)
    for (var c = 0; c < oldcols; c++) {
      if (r < av.rows && c < av.cols) continue;
      var stale = sheet.cells[SocialCalc.crToCoord(cr.col + c, cr.row + r)];
      if (stale && stale.spillowner === coord) {
        delete sheet.cells[stale.coord];
        topologyChanged = true;
      }
    }
  anchor.spillrows = av.rows;
  anchor.spillcols = av.cols;
  for (var rr = 0; rr < av.rows; rr++)
    for (var cc = 0; cc < av.cols; cc++)
      if (rr || cc) {
        var value = av.cells[rr][cc],
          childcoord = SocialCalc.crToCoord(cr.col + cc, cr.row + rr);
        var child = sheet.cells[childcoord];
        if (!child || child.spillowner !== coord) {
          child = new SocialCalc.Cell(childcoord);
          topologyChanged = true;
        }
        child.datavalue = value.value;
        child.valuetype = value.type;
        child.spillowner = coord;
        child.spillrow = rr;
        child.spillcol = cc;
        delete child.displaystring;
        sheet.cells[childcoord] = child;
      }
  sheet.attribs.lastrow = Math.max(sheet.attribs.lastrow, cr.row + av.rows - 1);
  sheet.attribs.lastcol = Math.max(sheet.attribs.lastcol, cr.col + av.cols - 1);
  sheet.renderneeded = true;
  sheet.changedrendervalues = true;
  if (topologyChanged) sheet.spillTopologyChanged = true;
  return av.cells[0][0];
};

// *************************************
//
// Sheet class:
//
// *************************************

//
// Class SocialCalc.Sheet
//
// Usage: var s = new SocialCalc.Sheet();
//

SC.Sheet = function () {
  SocialCalc.ResetSheet(this);

  // Set other values:
  //
  // sheet.statuscallback(data, status, arg, this.statuscallbackparams) is called
  // during recalc and commands.
  //
  // During recalc, data is the current recalcdata.
  // The values for status and the corresponding arg are:
  //
  //    calcorder, {coord: coord, total: celllist length, count: count} [0 or more times per recalc]
  //    calccheckdone, calclist length [once per recalc]
  //    calcstep, {coord: coord, total: calclist length, count: count} [0 or more times per recalc]
  //    calcloading, {sheetname: name-of-sheet}
  //    calcserverfunc, {funcname: name-of-function, coord: coord, total: calclist length, count: count}
  //    calcfinished, time in milliseconds [once per recalc]
  //
  // During commands, data is SocialCalc.SheetCommandInfo.
  // These values for status and arg are:
  //
  //    cmdstart, cmdstr
  //    cmdend
  //

  this.statuscallback = null; // routine called with cmdstart, calcstart, etc., status and args:
  // sheet.statuscallback(data, status, arg, params)
  this.statuscallbackparams = null; // parameters passed to that routine
};

//
// SocialCalc.ResetSheet(sheet)
//
// Resets (and/or initializes) sheet data values.
//

/** @param {any} sheet @param {any} _reload */
SC.ResetSheet = function (sheet: any, _reload: any) {
  // properties:

  sheet.cells = {}; // at least one for each non-blank cell: coord: cell-object
  sheet.attribs =
    // sheet attributes
    {
      lastcol: 1,
      lastrow: 1,
      defaultlayout: 0,
      usermaxcol: 0,
      usermaxrow: 0,
    };
  sheet.rowattribs = {
    hide: {}, // access by row number -- MANUAL hide only, never written by AutoFilter recompute
    height: {},
    filterhide: {}, // access by row number -- AutoFilter-derived hide, recomputed by SocialCalc.RecomputeAutoFilters
  };
  sheet.colattribs = {
    width: {}, // access by col name
    hide: {},
  };
  sheet.names = {}; // Each is: {desc: "optional description", definition: "B5, A1:B7, or =formula"}
  sheet.autofilters = {}; // Each is: {id, range, criteria: {colOffset: {values?, op?, op2?}}}
  sheet.tables = {}; // Each is: {name, range, hasHeader, style, filterId}
  sheet.condfmtRules = []; // ordered (index 0 = highest priority) CondFmtRule[]; see SC.CondFmtRule
  sheet.condfmtNextId = 1; // monotonic id counter, stable across reorders/deletes
  sheet.condfmtRulesVersion = 0; // bumped whenever a rule/range/formula changes (invalidates range index)
  sheet.condfmtValueVersion = 0; // bumped whenever a cell value could have changed (invalidates duplicate/unique counts)
  sheet.charts = {}; // chart id -> SocialCalc.ChartObject; never overwrites cell data (js/chart.ts)
  sheet.layouts = [];
  sheet.layouthash = {};
  sheet.fonts = [];
  sheet.fonthash = {};
  sheet.colors = [];
  sheet.colorhash = {};
  sheet.borderstyles = [];
  sheet.borderstylehash = {};
  sheet.cellformats = [];
  sheet.cellformathash = {};
  sheet.valueformats = [];
  sheet.valueformathash = {};
  sheet.matched_cells = [];
  sheet.selected_search_cell = undefined;

  sheet.copiedfrom = ""; // if a range, then this was loaded from a saved range as clipboard content

  sheet.changes = new SocialCalc.UndoStack();

  sheet.renderneeded = false;

  sheet.changedrendervalues = true; // if true, spans and/or fonts have changed (set by ExecuteSheetCommand & GetStyle)

  sheet.recalcchangedavalue = false; // true if a recalc resulted in a change to a cell's calculated value

  sheet.hiddencolrow = ""; // "col" or "row" if it was hidden

  sheet.sci = new SocialCalc.SheetCommandInfo(sheet);

  sheet.ioEventTree = {};
  sheet.ioParameterList = {};
};

// Methods:

SC.Sheet.prototype.ResetSheet = function () {
  SocialCalc.ResetSheet(this);
};
/** @param {any} newcell */
SC.Sheet.prototype.AddCell = function (newcell: any) {
  return (this.cells[newcell.coord] = newcell);
};
SC.Sheet.prototype.LastCol = function () {
  var last_col = 1;
  for (var cell_id in this.cells) {
    var cr = SocialCalc.coordToCr(cell_id);
    if (cr.col > last_col) {
      last_col = cr.col;
    }
  }
  return last_col;
};
SC.Sheet.prototype.LastRow = function () {
  var last_row = 1;
  for (var cell_id in this.cells) {
    var cr = SocialCalc.coordToCr(cell_id);
    if (cr.row > last_row) {
      last_row = cr.row;
    }
  }
  return last_row;
};
/** @param {any} coord */
SC.Sheet.prototype.GetAssuredCell = function (coord: any) {
  return this.cells[coord] || this.AddCell(new SocialCalc.Cell(coord));
};
/** @param {any} savedsheet */
SC.Sheet.prototype.ParseSheetSave = function (savedsheet: any) {
  SocialCalc.ParseSheetSave(savedsheet, this);
};
/** @param {any} cell @param {any} parts @param {any} j */
SC.Sheet.prototype.CellFromStringParts = function (cell: any, parts: any, j: any) {
  return SocialCalc.CellFromStringParts(this, cell, parts, j);
};
/** @param {any} range @param {any} canonicalize */
SC.Sheet.prototype.CreateSheetSave = function (range: any, canonicalize: any) {
  return SocialCalc.CreateSheetSave(this, range, canonicalize);
};
/** @param {any} cell */
SC.Sheet.prototype.CellToString = function (cell: any) {
  return SocialCalc.CellToString(this, cell);
};
/** @param {any} full */
SC.Sheet.prototype.CanonicalizeSheet = function (full: any) {
  return SocialCalc.CanonicalizeSheet(this, full);
};
/** @param {any} coord */
SC.Sheet.prototype.EncodeCellAttributes = function (coord: any) {
  return SocialCalc.EncodeCellAttributes(this, coord);
};
SC.Sheet.prototype.EncodeSheetAttributes = function () {
  return SocialCalc.EncodeSheetAttributes(this);
};
/** @param {any} coord @param {any} attribs @param {any} range */
SC.Sheet.prototype.DecodeCellAttributes = function (coord: any, attribs: any, range: any) {
  return SocialCalc.DecodeCellAttributes(this, coord, attribs, range);
};
/** @param {any} attribs */
SC.Sheet.prototype.DecodeSheetAttributes = function (attribs: any) {
  return SocialCalc.DecodeSheetAttributes(this, attribs);
};

/** @param {any} cmd @param {any} saveundo */
SC.Sheet.prototype.ScheduleSheetCommands = function (cmd: any, saveundo: any) {
  return SocialCalc.ScheduleSheetCommands(this, cmd, saveundo);
};
SC.Sheet.prototype.SheetUndo = function () {
  return SocialCalc.SheetUndo(this);
};
SC.Sheet.prototype.SheetRedo = function () {
  return SocialCalc.SheetRedo(this);
};
SC.Sheet.prototype.CreateAuditString = function () {
  return SocialCalc.CreateAuditString(this);
};
/** @param {any} atype @param {any} style */
SC.Sheet.prototype.GetStyleNum = function (atype: any, style: any) {
  return SocialCalc.GetStyleNum(this, atype, style);
};
/** @param {any} atype @param {any} num */
SC.Sheet.prototype.GetStyleString = function (atype: any, num: any) {
  return SocialCalc.GetStyleString(this, atype, num);
};
SC.Sheet.prototype.RecalcSheet = function () {
  return SocialCalc.RecalcSheet(this);
};

// --- Data validation convenience API (js/socialcalcdatavalidation.ts) ---
//
// SetCellValidation/ClearCellValidation issue "set <range> validation ..."/
// "set <range> clearvalidation" commands through ExecuteSheetCommand (so
// they're undoable/redoable and enforce the same reject-on-existing-invalid-
// data rules as any other set command). GetCellValidation is a pure read
// with no undo implications.

/** @param {any} range @param {any} rule @param {any} saveundo */
SC.Sheet.prototype.SetCellValidation = function (range: any, rule: any, saveundo: any) {
  var encoded = SocialCalc.encodeForSave(SocialCalc.DataValidation.EncodeRule(rule));
  return this.ScheduleSheetCommands("set " + range + " validation " + encoded, saveundo !== false);
};
/** @param {any} range @param {any} saveundo */
SC.Sheet.prototype.ClearCellValidation = function (range: any, saveundo: any) {
  return this.ScheduleSheetCommands("set " + range + " clearvalidation", saveundo !== false);
};
/** @param {any} coord */
SC.Sheet.prototype.GetCellValidation = function (coord: any) {
  var cell = this.cells[coord];
  return cell ? SocialCalc.DataValidation.DecodeRule(cell.validation) : null;
};

//
// Sheet save format:
//
// linetype:param1:param2:...
//
// Linetypes are:
//
//    version:versionname - version of this format. Currently 1.5.
//
//    cell:coord:type:value...:type:value... - Types are as follows:
//
//       v:value - straight numeric value
//       t:value - straight text/wiki-text in cell, encoded to handle \, :, newlines
//       vt:fulltype:value - value with value type/subtype
//       vtf:fulltype:value:formulatext - formula resulting in value with value type/subtype, value and text encoded
//       vtc:fulltype:value:valuetext - formatted text constant resulting in value with value type/subtype, value and text encoded
//       vf:fvalue:formulatext - formula resulting in value, value and text encoded (obsolete: only pre format version 1.1)
//          fvalue - first char is "N" for numeric value, "T" for text value, "H" for HTML value, rest is the value
//       e:errortext - Error text. Non-blank means formula parsing/calculation results in error.
//       b:topborder#:rightborder#:bottomborder#:leftborder# - border# in sheet border list or blank if none
//       l:layout# - number in cell layout list
//       f:font# - number in sheet fonts list
//       c:color# - sheet color list index for text
//       bg:color# - sheet color list index for background color
//       cf:format# - sheet cell format number for explicit format (align:left, etc.)
//       cvf:valueformat# - sheet cell value format number (obsolete: only pre format v1.2)
//       tvf:valueformat# - sheet cell text value format number
//       ntvf:valueformat# - sheet cell non-text value format number
//       colspan:numcols - number of columns spanned in merged cell
//       rowspan:numrows - number of rows spanned in merged cell
//       cssc:classname - name of CSS class to be used for cell when published instead of one calculated here
//       csss:styletext - explicit CSS style information, encoded to handle :, etc.
//       mod:allow - if "y" allow modification of cell for live "view" recalc
//       comment:value - encoded text of comment for this cell (added in v1.5)
//
//    col:
//       w:widthval - number, "auto" (no width in <col> tag), number%, or blank (use default)
//       hide: - yes/no, no is assumed if missing
//    row:
//       hide - yes/no, no is assumed if missing
//
//    sheet:
//       c:lastcol - number
//       r:lastrow - number
//       w:defaultcolwidth - number, "auto", number%, or blank (default->80)
//       h:defaultrowheight - not used
//       tf:format# - cell format number for sheet default for text values
//       ntf:format# - cell format number for sheet default for non-text values (i.e., numbers)
//       layout:layout# - default cell layout number in cell layout list
//       font:font# - default font number in sheet font list
//       vf:valueformat# - default number value format number in sheet valueformat list (obsolete: only pre format version 1.2)
//       ntvf:valueformat# - default non-text (number) value format number in sheet valueformat list
//       tvf:valueformat# - default text value format number in sheet valueformat list
//       color:color# - default number for text color in sheet color list
//       bgcolor:color# - default number for background color in sheet color list
//       circularreferencecell:coord - cell coord with a circular reference
//       recalc:value - on/off (on is default). If not "off", appropriate changes to the sheet cause a recalc
//       needsrecalc:value - yes/no (no is default). If "yes", formula values are not up to date
//       usermaxcol:value - maximum column to display, 0 for unlimited (default=0)
//       usermaxrow:value - maximum row to display, 0 for unlimited (default=0)
//
//    name:name:description:value - name definition, name in uppercase, with value being "B5", "A1:B7", or "=formula";
//                                  description and value are encoded.
//    chart:id:type:anchorcoord:widthpx:heightpx:seriesinrows:hastitle:title:haslegend:legendposition:xaxislabel:yaxislabel:sourceranges
//                              - chart object (see js/chart.ts); type is a numeric SocialCalc.Chart.TYPE_* code,
//                                sourceranges is one or more A1 range strings joined by "|"; id/title/
//                                legendposition/xaxislabel/yaxislabel/each sourcerange are encoded (added in v1.5+chart)
//    font:fontnum:value - text of font definition (style weight size family) for font fontnum
//                         "*" for "style weight", size, or family, means use default (first look to sheet, then builtin)
//    color:colornum:rgbvalue - text of color definition (e.g., rgb(255,255,255)) for color colornum
//    border:bordernum:value - text of border definition (thickness style color) for border bordernum
//    layout:layoutnum:value - text of vertical alignment and padding style for cell layout layoutnum (* for default):
//                             vertical-alignment:vavalue;padding:topval rightval bottomval leftval;
//    cellformat:cformatnum:value - text of cell alignment (left/center/right) for cellformat cformatnum
//    valueformat:vformatnum:value - text of number format (see FormatValueForDisplay) for valueformat vformatnum (changed in v1.2)
//    clipboardrange:upperleftcoord:bottomrightcoord - ignored -- from wikiCalc
//    clipboard:coord:type:value:... - ignored -- from wikiCalc
//
// If this is clipboard contents, then there is also information to facilitate pasting:
//
//    copiedfrom:upperleftcoord:bottomrightcoord - range from which this was copied
//

// Functions:

/** @param {any} savedsheet @param {any} sheetobj */
SC.ParseSheetSave = function (savedsheet: any, sheetobj: any) {
  var lines = savedsheet.split(/\r\n|\n/);
  var parts: any = [];
  var line: any;
  var i: any;
  var j: any;
  var t: any;
  var v: any;
  var coord: any;
  var cell: any;
  var attribs: any;
  var name: any;
  var scc = SocialCalc.Constants;

  for (i = 0; i < lines.length; i++) {
    line = lines[i];
    parts = line.split(":");
    switch (parts[0]) {
      case "cell":
        cell = sheetobj.GetAssuredCell(parts[1]);
        j = 2;
        sheetobj.CellFromStringParts(cell, parts, j);
        break;

      case "col":
        coord = parts[1];
        j = 2;
        while ((t = parts[j++])) {
          switch (t) {
            case "w":
              sheetobj.colattribs.width[coord] = parts[j++]; // must be text - could be auto or %, etc.
              break;
            case "hide":
              sheetobj.colattribs.hide[coord] = parts[j++];
              break;
            default:
              throw scc.s_pssUnknownColType + " '" + t + "'";
          }
        }
        break;

      case "row":
        coord = parts[1] - 0;
        j = 2;
        while ((t = parts[j++])) {
          switch (t) {
            case "h":
              sheetobj.rowattribs.height[coord] = parts[j++] - 0;
              break;
            case "hide":
              sheetobj.rowattribs.hide[coord] = parts[j++];
              break;
            default:
              throw scc.s_pssUnknownRowType + " '" + t + "'";
          }
        }
        break;

      case "sheet":
        attribs = sheetobj.attribs;
        j = 1;
        while ((t = parts[j++])) {
          switch (t) {
            case "c":
              attribs.lastcol = parts[j++] - 0;
              break;
            case "r":
              attribs.lastrow = parts[j++] - 0;
              break;
            case "w":
              attribs.defaultcolwidth = parts[j++] + "";
              break;
            case "h":
              attribs.defaultrowheight = parts[j++] - 0;
              break;
            case "tf":
              attribs.defaulttextformat = parts[j++] - 0;
              break;
            case "ntf":
              attribs.defaultnontextformat = parts[j++] - 0;
              break;
            case "layout":
              attribs.defaultlayout = parts[j++] - 0;
              break;
            case "font":
              attribs.defaultfont = parts[j++] - 0;
              break;
            case "tvf":
              attribs.defaulttextvalueformat = parts[j++] - 0;
              break;
            case "ntvf":
              attribs.defaultnontextvalueformat = parts[j++] - 0;
              break;
            case "color":
              attribs.defaultcolor = parts[j++] - 0;
              break;
            case "bgcolor":
              attribs.defaultbgcolor = parts[j++] - 0;
              break;
            case "circularreferencecell":
              attribs.circularreferencecell = parts[j++];
              break;
            case "recalc":
              attribs.recalc = parts[j++];
              break;
            case "needsrecalc":
              attribs.needsrecalc = parts[j++];
              break;
            case "protected":
              attribs.protected = parts[j++];
              break;
            case "usermaxcol":
              attribs.usermaxcol = parts[j++] - 0;
              break;
            case "usermaxrow":
              attribs.usermaxrow = parts[j++] - 0;
              break;
            case "printarea":
              attribs.printarea = SocialCalc.decodeFromSave(parts[j++]);
              break;
            case "printrepeatcols":
              attribs.printrepeatcols = SocialCalc.decodeFromSave(parts[j++]);
              break;
            case "printrepeatrows":
              attribs.printrepeatrows = SocialCalc.decodeFromSave(parts[j++]);
              break;
            case "printorientation":
              attribs.printorientation = parts[j++];
              break;
            case "printscale":
              attribs.printscale = parts[j++] - 0;
              break;
            case "printmargins":
              attribs.printmargins = SocialCalc.decodeFromSave(parts[j++]);
              break;
            default:
              j += 1;
              break;
          }
        }
        break;

      case "name":
        name = SocialCalc.decodeFromSave(parts[1]).toUpperCase();
        sheetobj.names[name] = { desc: SocialCalc.decodeFromSave(parts[2]) };
        sheetobj.names[name].definition = SocialCalc.decodeFromSave(parts[3]);
        break;

      case "autofilter":
        sheetobj.autofilters[SocialCalc.decodeFromSave(parts[1])] = {
          id: SocialCalc.decodeFromSave(parts[1]),
          range: SocialCalc.decodeFromSave(parts[2]),
          criteria: {},
        };
        break;

      case "autofiltercol":
        if (sheetobj.autofilters[SocialCalc.decodeFromSave(parts[1])]) {
          sheetobj.autofilters[SocialCalc.decodeFromSave(parts[1])].criteria[parts[2] - 0] =
            JSON.parse(SocialCalc.decodeFromSave(parts[3]));
        }
        break;

      case "table":
        sheetobj.tables[SocialCalc.decodeFromSave(parts[1])] = {
          name: SocialCalc.decodeFromSave(parts[1]),
          range: SocialCalc.decodeFromSave(parts[2]),
          hasHeader: parts[3] == "1",
          style: SocialCalc.decodeFromSave(parts[4]),
          filterId: SocialCalc.decodeFromSave(parts[5]) || null,
        };
        break;

      case "condfmt":
        // condfmt:id:range:type:op:value1:value2:formula:stopIfTrue:font:color:bgcolor:bt:br:bb:bl
        sheetobj.condfmtRules.push({
          id: parts[1] - 0,
          range: SocialCalc.decodeFromSave(parts[2]),
          type: SocialCalc.decodeFromSave(parts[3]),
          op: SocialCalc.decodeFromSave(parts[4]),
          value1: SocialCalc.decodeFromSave(parts[5]),
          value2: SocialCalc.decodeFromSave(parts[6]),
          formula: SocialCalc.decodeFromSave(parts[7]),
          stopIfTrue: parts[8] == "1",
          style: {
            font: parts[9] - 0,
            color: parts[10] - 0,
            bgcolor: parts[11] - 0,
            bt: parts[12] - 0,
            br: parts[13] - 0,
            bb: parts[14] - 0,
            bl: parts[15] - 0,
          },
        });
        if (parts[1] - 0 >= sheetobj.condfmtNextId) {
          sheetobj.condfmtNextId = parts[1] - 0 + 1;
        }
        break;
      case "chart":
        var chart = SocialCalc.Chart.ChartFromSaveParts(parts);
        sheetobj.charts[chart.id] = chart;
        break;
      case "layout":
        parts = lines[i].match(/^layout:(\d+):(.+)$/); // layouts can have ":" in them
        sheetobj.layouts[parts[1] - 0] = parts[2];
        sheetobj.layouthash[parts[2]] = parts[1] - 0;
        break;

      case "font":
        sheetobj.fonts[parts[1] - 0] = parts[2];
        sheetobj.fonthash[parts[2]] = parts[1] - 0;
        break;

      case "color":
        sheetobj.colors[parts[1] - 0] = parts[2];
        sheetobj.colorhash[parts[2]] = parts[1] - 0;
        break;

      case "border":
        sheetobj.borderstyles[parts[1] - 0] = parts[2];
        sheetobj.borderstylehash[parts[2]] = parts[1] - 0;
        break;

      case "cellformat":
        v = SocialCalc.decodeFromSave(parts[2]);
        sheetobj.cellformats[parts[1] - 0] = v;
        sheetobj.cellformathash[v] = parts[1] - 0;
        break;

      case "valueformat":
        v = SocialCalc.decodeFromSave(parts[2]);
        sheetobj.valueformats[parts[1] - 0] = v;
        sheetobj.valueformathash[v] = parts[1] - 0;
        break;

      case "version":
        break;

      case "copiedfrom":
        sheetobj.copiedfrom = parts[1] + ":" + parts[2];
        break;

      case "clipboardrange": // in save versions up to 1.3. Ignored.
      case "clipboard":
        break;

      case "":
        break;

      default:
        alert(scc.s_pssUnknownLineType + " '" + parts[0] + "'");
        throw scc.s_pssUnknownLineType + " '" + parts[0] + "'";
    }
    parts = null;
  }
  SocialCalc.SanitizeSpills(sheetobj);
  SocialCalc.RecomputeAutoFilters(sheetobj);
};

//
// SocialCalc.CellFromStringParts(sheet, cell, parts, j)
//
// Takes string that has been split by ":" in parts, starting at item j,
// and fills in cell assuming save format.
//

/** @param {any} sheet @param {any} cell @param {any} parts @param {any} j */
SC.CellFromStringParts = function (sheet: any, cell: any, parts: any, j: any) {
  var t, v, ro;

  while ((t = parts[j++])) {
    switch (t) {
      case "v":
        cell.datavalue = +SocialCalc.decodeFromSave(parts[j++]);
        cell.datatype = "v";
        cell.valuetype = "n";
        break;
      case "t":
        cell.datavalue = SocialCalc.decodeFromSave(parts[j++]);
        cell.datatype = "t";
        cell.valuetype = SocialCalc.Constants.textdatadefaulttype;
        break;
      case "vt":
        v = parts[j++];
        cell.valuetype = v;
        if (v.charAt(0) == "n") {
          cell.datatype = "v";
          cell.datavalue = +SocialCalc.decodeFromSave(parts[j++]);
        } else {
          cell.datatype = "t";
          cell.datavalue = SocialCalc.decodeFromSave(parts[j++]);
        }
        break;
      case "vtf":
        v = parts[j++];
        cell.valuetype = v;
        if (v.charAt(0) == "n") {
          cell.datavalue = +SocialCalc.decodeFromSave(parts[j++]);
        } else {
          cell.datavalue = SocialCalc.decodeFromSave(parts[j++]);
        }
        cell.formula = SocialCalc.decodeFromSave(parts[j++]);
        cell.datatype = "f";
        break;
      case "vtc":
        v = parts[j++];
        cell.valuetype = v;
        if (v.charAt(0) == "n") {
          cell.datavalue = +SocialCalc.decodeFromSave(parts[j++]);
        } else {
          cell.datavalue = SocialCalc.decodeFromSave(parts[j++]);
        }
        cell.formula = SocialCalc.decodeFromSave(parts[j++]);
        cell.datatype = "c";
        break;
      case "ro":
        ro = SocialCalc.decodeFromSave(parts[j++]);
        cell.readonly = ro.toLowerCase() == "yes";
        break;
      case "e":
        cell.errors = SocialCalc.decodeFromSave(parts[j++]);
        break;
      case "b":
        cell.bt = parts[j++] - 0;
        cell.br = parts[j++] - 0;
        cell.bb = parts[j++] - 0;
        cell.bl = parts[j++] - 0;
        break;
      case "l":
        cell.layout = parts[j++] - 0;
        break;
      case "f":
        cell.font = parts[j++] - 0;
        break;
      case "c":
        cell.color = parts[j++] - 0;
        break;
      case "bg":
        cell.bgcolor = parts[j++] - 0;
        break;
      case "cf":
        cell.cellformat = parts[j++] - 0;
        break;
      case "ntvf":
        cell.nontextvalueformat = parts[j++] - 0;
        break;
      case "tvf":
        cell.textvalueformat = parts[j++] - 0;
        break;
      case "colspan":
        cell.colspan = parts[j++] - 0;
        break;
      case "rowspan":
        cell.rowspan = parts[j++] - 0;
        break;
      case "cssc":
        cell.cssc = parts[j++];
        break;
      case "csss":
        cell.csss = SocialCalc.decodeFromSave(parts[j++]);
        break;
      case "mod":
        j += 1;
        break;
      case "unlocked":
        cell.unlocked = parts[j++].toLowerCase() == "y";
        break;
      case "comment":
        cell.comment = SocialCalc.decodeFromSave(parts[j++]);
        break;
      case "validation":
        cell.validation = SocialCalc.decodeFromSave(parts[j++]);
        break;
      case "spillrows":
        cell.spillrows = parts[j++] - 0;
        break;
      case "spillcols":
        cell.spillcols = parts[j++] - 0;
        break;
      case "spillowner":
        cell.spillowner = SocialCalc.decodeFromSave(parts[j++]);
        break;
      case "spillrow":
        cell.spillrow = parts[j++] - 0;
        break;
      case "spillcol":
        cell.spillcol = parts[j++] - 0;
        break;
      default:
        throw SocialCalc.Constants.s_cfspUnknownCellType + " '" + t + "'";
    }
  }
};

SC.sheetfields = [
  "defaultrowheight",
  "defaultcolwidth",
  "circularreferencecell",
  "recalc",
  "needsrecalc",
  "protected",
  "usermaxcol",
  "usermaxrow",
  "printarea",
  "printrepeatcols",
  "printrepeatrows",
  "printorientation",
  "printscale",
  "printmargins",
];
SC.sheetfieldsshort = [
  "h",
  "w",
  "circularreferencecell",
  "recalc",
  "needsrecalc",
  "protected",
  "usermaxcol",
  "usermaxrow",
  "printarea",
  "printrepeatcols",
  "printrepeatrows",
  "printorientation",
  "printscale",
  "printmargins",
];

SC.sheetfieldsxlat = [
  "defaulttextformat",
  "defaultnontextformat",
  "defaulttextvalueformat",
  "defaultnontextvalueformat",
  "defaultcolor",
  "defaultbgcolor",
  "defaultfont",
  "defaultlayout",
];
SC.sheetfieldsxlatshort = ["tf", "ntf", "tvf", "ntvf", "color", "bgcolor", "font", "layout"];
SC.sheetfieldsxlatxlt = [
  "cellformat",
  "cellformat",
  "valueformat",
  "valueformat",
  "color",
  "color",
  "font",
  "layout",
];

//
// sheetstr = SocialCalc.CreateSheetSave(sheetobj, range, canonicalize)
//
// Creates a text representation of the sheetobj data.
// If the range is present then only those cells are saved
// (as clipboard data with "copiedfrom" set).
//

/** @param {any} sheetobj @param {any} range @param {any} canonicalize */
SC.CreateSheetSave = function (sheetobj: any, range: any, canonicalize: any) {
  var cell, cr1, cr2, row, col, coord, line, value, i, name;
  var result = [];

  var prange;

  sheetobj.CanonicalizeSheet(canonicalize || SocialCalc.Constants.doCanonicalizeSheet);
  var xlt = sheetobj.xlt;

  if (range) {
    prange = SocialCalc.ParseRange(range);
  } else {
    prange = { cr1: { row: 1, col: 1 }, cr2: { row: xlt.maxrow, col: xlt.maxcol } };
  }
  cr1 = prange.cr1;
  cr2 = prange.cr2;

  result.push("version:1.5");

  for (row = cr1.row; row <= cr2.row; row++) {
    for (col = cr1.col; col <= cr2.col; col++) {
      coord = SocialCalc.crToCoord(col, row);
      cell = sheetobj.cells[coord];
      if (!cell) continue;
      if (range && (cell.spillowner || cell.spillrows != null || cell.spillcols != null)) {
        cell = Object.assign({}, cell);
        delete cell.spillrows;
        delete cell.spillcols;
        delete cell.spillowner;
        delete cell.spillrow;
        delete cell.spillcol;
        if (sheetobj.cells[coord].spillowner)
          cell.datatype = cell.valuetype && cell.valuetype.charAt(0) === "n" ? "v" : "t";
      }
      line = sheetobj.CellToString(cell);
      if (line.length == 0) continue; // ignore completely empty cells
      line = "cell:" + coord + line;
      result.push(line);
    }
  }

  for (col = 1; col <= xlt.maxcol; col++) {
    coord = SocialCalc.rcColname(col);
    if (sheetobj.colattribs.width[coord])
      result.push("col:" + coord + ":w:" + sheetobj.colattribs.width[coord]);
    if (sheetobj.colattribs.hide[coord])
      result.push("col:" + coord + ":hide:" + sheetobj.colattribs.hide[coord]);
  }

  for (row = 1; row <= xlt.maxrow; row++) {
    if (sheetobj.rowattribs.height[row])
      result.push("row:" + row + ":h:" + sheetobj.rowattribs.height[row]);
    if (sheetobj.rowattribs.hide[row])
      result.push("row:" + row + ":hide:" + sheetobj.rowattribs.hide[row]);
  }

  line = "sheet:c:" + xlt.maxcol + ":r:" + xlt.maxrow;

  for (i = 0; i < SocialCalc.sheetfields.length; i++) {
    // non-xlated values
    value = SocialCalc.encodeForSave(sheetobj.attribs[SocialCalc.sheetfields[i]]);
    if (value) line += ":" + SocialCalc.sheetfieldsshort[i] + ":" + value;
  }
  for (i = 0; i < SocialCalc.sheetfieldsxlat.length; i++) {
    // xlated values
    value = sheetobj.attribs[SocialCalc.sheetfieldsxlat[i]];
    if (value)
      line +=
        ":" +
        SocialCalc.sheetfieldsxlatshort[i] +
        ":" +
        xlt[SocialCalc.sheetfieldsxlatxlt[i] + "sxlat"][value];
  }

  result.push(line);

  for (i = 1; i < xlt.newborderstyles.length; i++) {
    result.push("border:" + i + ":" + xlt.newborderstyles[i]);
  }

  for (i = 1; i < xlt.newcellformats.length; i++) {
    result.push("cellformat:" + i + ":" + SocialCalc.encodeForSave(xlt.newcellformats[i]));
  }

  for (i = 1; i < xlt.newcolors.length; i++) {
    result.push("color:" + i + ":" + xlt.newcolors[i]);
  }

  for (i = 1; i < xlt.newfonts.length; i++) {
    result.push("font:" + i + ":" + xlt.newfonts[i]);
  }

  for (i = 1; i < xlt.newlayouts.length; i++) {
    result.push("layout:" + i + ":" + xlt.newlayouts[i]);
  }

  for (i = 1; i < xlt.newvalueformats.length; i++) {
    result.push("valueformat:" + i + ":" + SocialCalc.encodeForSave(xlt.newvalueformats[i]));
  }

  for (i = 0; i < xlt.namesorder.length; i++) {
    name = xlt.namesorder[i];
    result.push(
      "name:" +
        SocialCalc.encodeForSave(name).toUpperCase() +
        ":" +
        SocialCalc.encodeForSave(sheetobj.names[name].desc) +
        ":" +
        SocialCalc.encodeForSave(sheetobj.names[name].definition),
    );
  }

  var afSaveIds: string[] = [];
  for (var afSaveId in sheetobj.autofilters) afSaveIds.push(afSaveId);
  afSaveIds.sort();
  for (i = 0; i < afSaveIds.length; i++) {
    var afSaveDef = sheetobj.autofilters[afSaveIds[i]];
    result.push(
      "autofilter:" +
        SocialCalc.encodeForSave(afSaveDef.id) +
        ":" +
        SocialCalc.encodeForSave(afSaveDef.range),
    );
    var afCriteriaOffsets: string[] = [];
    for (var afCriteriaOffset in afSaveDef.criteria) afCriteriaOffsets.push(afCriteriaOffset);
    afCriteriaOffsets.sort(function (a: string, b: string) {
      return (a as any) - (b as any);
    });
    for (var afci = 0; afci < afCriteriaOffsets.length; afci++) {
      result.push(
        "autofiltercol:" +
          SocialCalc.encodeForSave(afSaveDef.id) +
          ":" +
          afCriteriaOffsets[afci] +
          ":" +
          SocialCalc.encodeForSave(JSON.stringify(afSaveDef.criteria[afCriteriaOffsets[afci]])),
      );
    }
  }

  var tblSaveNames: string[] = [];
  for (var tblSaveName in sheetobj.tables) tblSaveNames.push(tblSaveName);
  tblSaveNames.sort();
  for (i = 0; i < tblSaveNames.length; i++) {
    var tblSaveDef = sheetobj.tables[tblSaveNames[i]];
    result.push(
      "table:" +
        SocialCalc.encodeForSave(tblSaveDef.name) +
        ":" +
        SocialCalc.encodeForSave(tblSaveDef.range) +
        ":" +
        (tblSaveDef.hasHeader ? "1" : "0") +
        ":" +
        SocialCalc.encodeForSave(tblSaveDef.style) +
        ":" +
        SocialCalc.encodeForSave(tblSaveDef.filterId || ""),
    );
  }

  for (i = 0; i < sheetobj.condfmtRules.length; i++) {
    var rule = sheetobj.condfmtRules[i];
    var rstyle = rule.style;
    result.push(
      "condfmt:" +
        rule.id +
        ":" +
        SocialCalc.encodeForSave(rule.range) +
        ":" +
        SocialCalc.encodeForSave(rule.type) +
        ":" +
        SocialCalc.encodeForSave(rule.op) +
        ":" +
        SocialCalc.encodeForSave(rule.value1) +
        ":" +
        SocialCalc.encodeForSave(rule.value2) +
        ":" +
        SocialCalc.encodeForSave(rule.formula) +
        ":" +
        (rule.stopIfTrue ? "1" : "0") +
        ":" +
        (rstyle.font ? xlt.fontsxlat[rstyle.font] : 0) +
        ":" +
        (rstyle.color ? xlt.colorsxlat[rstyle.color] : 0) +
        ":" +
        (rstyle.bgcolor ? xlt.colorsxlat[rstyle.bgcolor] : 0) +
        ":" +
        (rstyle.bt ? xlt.borderstylesxlat[rstyle.bt] : 0) +
        ":" +
        (rstyle.br ? xlt.borderstylesxlat[rstyle.br] : 0) +
        ":" +
        (rstyle.bb ? xlt.borderstylesxlat[rstyle.bb] : 0) +
        ":" +
        (rstyle.bl ? xlt.borderstylesxlat[rstyle.bl] : 0),
    );
  }

  if (!range) {
    // Charts are anchored sheet objects, not cell content: omit them from
    // range/clipboard saves (like sheet-wide attributes are omitted there),
    // include them only in full-sheet saves. Sorted by id for determinism.
    var chartIds = Object.keys(sheetobj.charts).sort();
    for (i = 0; i < chartIds.length; i++) {
      result.push(SocialCalc.Chart.ChartToSaveLine(sheetobj.charts[chartIds[i]]));
    }
  }
  if (range) {
    result.push(
      "copiedfrom:" +
        SocialCalc.crToCoord(cr1.col, cr1.row) +
        ":" +
        SocialCalc.crToCoord(cr2.col, cr2.row),
    );
  }

  result.push(""); // one extra to get extra \n

  delete sheetobj.xlt; // clean up

  return result.join("\n");
};

//
// line = SocialCalc.CellToString(sheet, cell)
//

/** @param {any} sheet @param {any} cell */
SC.CellToString = function (sheet: any, cell: any) {
  var line, value, formula, t, r, b, l, xlt;

  line = "";

  if (!cell) return line;

  value = SocialCalc.encodeForSave(cell.datavalue);
  if (cell.datatype == "v") {
    if (cell.valuetype == "n") line += ":v:" + value;
    else line += ":vt:" + cell.valuetype + ":" + value;
  } else if (cell.datatype == "t") {
    if (cell.valuetype == SocialCalc.Constants.textdatadefaulttype) line += ":t:" + value;
    else line += ":vt:" + cell.valuetype + ":" + value;
  } else if (cell.datatype == null && cell.spillowner) {
    line += ":vt:" + cell.valuetype + ":" + value;
  } else {
    formula = SocialCalc.encodeForSave(cell.formula);
    if (cell.datatype == "f") {
      line += ":vtf:" + cell.valuetype + ":" + value + ":" + formula;
    } else if (cell.datatype == "c") {
      line += ":vtc:" + cell.valuetype + ":" + value + ":" + formula;
    }
  }
  if (cell.readonly) {
    line += ":ro:yes";
  }
  if (cell.unlocked) {
    line += ":unlocked:y";
  }
  if (cell.errors) {
    line += ":e:" + SocialCalc.encodeForSave(cell.errors);
  }
  t = cell.bt || "";
  r = cell.br || "";
  b = cell.bb || "";
  l = cell.bl || "";

  if (sheet.xlt) {
    // if have canonical save info
    xlt = sheet.xlt;
    if (t || r || b || l)
      line +=
        ":b:" +
        xlt.borderstylesxlat[t || 0] +
        ":" +
        xlt.borderstylesxlat[r || 0] +
        ":" +
        xlt.borderstylesxlat[b || 0] +
        ":" +
        xlt.borderstylesxlat[l || 0];
    if (cell.layout) line += ":l:" + xlt.layoutsxlat[cell.layout];
    if (cell.font) line += ":f:" + xlt.fontsxlat[cell.font];
    if (cell.color) line += ":c:" + xlt.colorsxlat[cell.color];
    if (cell.bgcolor) line += ":bg:" + xlt.colorsxlat[cell.bgcolor];
    if (cell.cellformat) line += ":cf:" + xlt.cellformatsxlat[cell.cellformat];
    if (cell.textvalueformat) line += ":tvf:" + xlt.valueformatsxlat[cell.textvalueformat];
    if (cell.nontextvalueformat) line += ":ntvf:" + xlt.valueformatsxlat[cell.nontextvalueformat];
  } else {
    if (t || r || b || l) line += ":b:" + t + ":" + r + ":" + b + ":" + l;
    if (cell.layout) line += ":l:" + cell.layout;
    if (cell.font) line += ":f:" + cell.font;
    if (cell.color) line += ":c:" + cell.color;
    if (cell.bgcolor) line += ":bg:" + cell.bgcolor;
    if (cell.cellformat) line += ":cf:" + cell.cellformat;
    if (cell.textvalueformat) line += ":tvf:" + cell.textvalueformat;
    if (cell.nontextvalueformat) line += ":ntvf:" + cell.nontextvalueformat;
  }
  if (cell.colspan) line += ":colspan:" + cell.colspan;
  if (cell.rowspan) line += ":rowspan:" + cell.rowspan;
  if (cell.cssc) line += ":cssc:" + cell.cssc;
  if (cell.csss) line += ":csss:" + SocialCalc.encodeForSave(cell.csss);
  if (cell.mod) line += ":mod:" + cell.mod;
  if (cell.comment) line += ":comment:" + SocialCalc.encodeForSave(cell.comment);
  if (cell.validation) line += ":validation:" + SocialCalc.encodeForSave(cell.validation);

  // Spill tags are compact optional fields; absent tags preserve legacy saves.
  if (cell.spillrows != null) line += ":spillrows:" + cell.spillrows;
  if (cell.spillcols != null) line += ":spillcols:" + cell.spillcols;
  if (cell.spillowner) line += ":spillowner:" + SocialCalc.encodeForSave(cell.spillowner);
  if (cell.spillrow != null) line += ":spillrow:" + cell.spillrow;
  if (cell.spillcol != null) line += ":spillcol:" + cell.spillcol;
  return line;
};

//
// SocialCalc.CanonicalizeSheet(sheetobj, full)
//
// Goes through the sheet and fills in sheetobj.xlt with the following:
//
//   .maxrow, .maxcol - lastrow and lastcol are as small as possible
//   .newlayouts - new version of sheetobj.layouts without unused ones and all in ascending order
//   .layoutsxlat - maps old layouts index to new one
//   same ".new" and ".xlat" for fonts, colors, borderstyles, cell and value formats
//   .namesorder - array with names sorted
//
// If full or SocialCalc.Constants.doCanonicalizeSheet are not true, then the values will leave things unchanged (to save time, etc.)
//
// sheetobj.xlt should be deleted when you are finished using it
//

/** @param {any} sheetobj @param {any} full */
SC.CanonicalizeSheet = function (sheetobj: any, full: any) {
  var l: any;
  var coord: any;
  var cr: any;
  var cell: any;
  var filled: any;
  var an: any;
  var a: any;
  var newa: any;
  var newxlat: any;
  var used: any;
  var ahash: any;
  var i: any;
  var v: any;
  var maxrow = 0;
  var maxcol = 0;
  var alist = ["borderstyle", "cellformat", "color", "font", "layout", "valueformat"];

  var xlt: any = {};

  xlt.namesorder = []; // always return a sorted list
  for (a in sheetobj.names) {
    xlt.namesorder.push(a);
  }
  xlt.namesorder.sort();

  if (!SocialCalc.Constants.doCanonicalizeSheet || !full) {
    // return make-no-changes values if not wanted
    for (an = 0; an < alist.length; an++) {
      a = alist[an];
      xlt["new" + a + "s"] = sheetobj[a + "s"];
      l = sheetobj[a + "s"].length;
      newxlat = Array.from({ length: l });
      newxlat[0] = "";
      for (i = 1; i < l; i++) {
        newxlat[i] = i;
      }
      xlt[a + "sxlat"] = newxlat;
    }

    xlt.maxrow = sheetobj.attribs.lastrow;
    xlt.maxcol = sheetobj.attribs.lastcol;

    sheetobj.xlt = xlt;

    return;
  }

  for (an = 0; an < alist.length; an++) {
    a = alist[an];
    xlt[a + "sUsed"] = {};
  }

  var colorsUsed = xlt.colorsUsed;
  var borderstylesUsed = xlt.borderstylesUsed;
  var fontsUsed = xlt.fontsUsed;
  var layoutsUsed = xlt.layoutsUsed;
  var cellformatsUsed = xlt.cellformatsUsed;
  var valueformatsUsed = xlt.valueformatsUsed;

  for (coord in sheetobj.cells) {
    // check all cells to see which values are used
    cr = SocialCalc.coordToCr(coord);
    cell = sheetobj.cells[coord];
    filled = false;

    if (cell.valuetype && cell.valuetype != "b") filled = true;

    if (cell.color) {
      colorsUsed[cell.color] = 1;
      filled = true;
    }

    if (cell.bgcolor) {
      colorsUsed[cell.bgcolor] = 1;
      filled = true;
    }

    if (cell.bt) {
      borderstylesUsed[cell.bt] = 1;
      filled = true;
    }
    if (cell.br) {
      borderstylesUsed[cell.br] = 1;
      filled = true;
    }
    if (cell.bb) {
      borderstylesUsed[cell.bb] = 1;
      filled = true;
    }
    if (cell.bl) {
      borderstylesUsed[cell.bl] = 1;
      filled = true;
    }

    if (cell.layout) {
      layoutsUsed[cell.layout] = 1;
      filled = true;
    }

    if (cell.font) {
      fontsUsed[cell.font] = 1;
      filled = true;
    }

    if (cell.cellformat) {
      cellformatsUsed[cell.cellformat] = 1;
      filled = true;
    }

    if (cell.textvalueformat) {
      valueformatsUsed[cell.textvalueformat] = 1;
      filled = true;
    }

    if (cell.nontextvalueformat) {
      valueformatsUsed[cell.nontextvalueformat] = 1;
      filled = true;
    }

    if (filled) {
      if (cr.row > maxrow) maxrow = cr.row;
      if (cr.col > maxcol) maxcol = cr.col;
    }
  }

  for (i = 0; i < sheetobj.condfmtRules.length; i++) {
    var cfstyle = sheetobj.condfmtRules[i].style;
    if (cfstyle.font) fontsUsed[cfstyle.font] = 1;
    if (cfstyle.color) colorsUsed[cfstyle.color] = 1;
    if (cfstyle.bgcolor) colorsUsed[cfstyle.bgcolor] = 1;
    if (cfstyle.bt) borderstylesUsed[cfstyle.bt] = 1;
    if (cfstyle.br) borderstylesUsed[cfstyle.br] = 1;
    if (cfstyle.bb) borderstylesUsed[cfstyle.bb] = 1;
    if (cfstyle.bl) borderstylesUsed[cfstyle.bl] = 1;
  }

  for (i = 0; i < SocialCalc.sheetfieldsxlat.length; i++) {
    // do sheet values, too
    v = sheetobj.attribs[SocialCalc.sheetfieldsxlat[i]];
    if (v) {
      xlt[SocialCalc.sheetfieldsxlatxlt[i] + "sUsed"][v] = 1;
    }
  }

  a = { height: 1, hide: 1 }; // look at explicit row settings
  for (v in a) {
    for (cr in sheetobj.rowattribs[v]) {
      if (cr - 0 > maxrow) maxrow = cr - 0;
    }
  }
  a = { hide: 1, width: 1 }; // look at explicit col settings
  for (v in a) {
    for (coord in sheetobj.colattribs[v]) {
      cr = SocialCalc.coordToCr(coord + "1");
      if (cr.col > maxcol) maxcol = cr.col;
    }
  }

  for (an = 0; an < alist.length; an++) {
    // go through the attribs we want
    a = alist[an];

    newa = [];
    used = xlt[a + "sUsed"];
    for (v in used) {
      newa.push(sheetobj[a + "s"][v]);
    }
    newa.sort();
    newa.unshift("");

    newxlat = [""];
    ahash = sheetobj[a + "hash"];

    for (i = 1; i < newa.length; i++) {
      newxlat[ahash[newa[i]]] = i;
    }

    xlt[a + "sxlat"] = newxlat;
    xlt["new" + a + "s"] = newa;
  }

  xlt.maxrow = maxrow || 1;
  xlt.maxcol = maxcol || 1;

  sheetobj.xlt = xlt; // leave for use by caller
};

//
// result = SocialCalc.EncodeCellAttributes(sheet, coord)
//
// Returns the cell's attributes in an object, each in the following form:
//
//    attribname: {def: true/false, val: full-value}
//

/** @param {any} sheet @param {any} coord */
SC.EncodeCellAttributes = function (sheet: any, coord: any) {
  var i, b, bb, parts;
  var result: any = {};

  /** @param {any} name */
  var InitAttrib = function (name: any) {
    result[name] = { def: true, val: "" };
  };

  /** @param {any} namelist */
  var InitAttribs = function (namelist: any) {
    for (var i = 0; i < namelist.length; i++) {
      InitAttrib(namelist[i]);
    }
  };

  /** @param {any} name @param {any} v */
  var SetAttrib = function (name: any, v: any) {
    result[name].def = false;
    result[name].val = v || "";
  };

  /** @param {any} name @param {any} v */
  var SetAttribStar = function (name: any, v: any) {
    if (v == "*") return;
    result[name].def = false;
    result[name].val = v;
  };

  var cell = sheet.GetAssuredCell(coord);

  // cellformat: alignhoriz

  InitAttrib("alignhoriz");
  if (cell.cellformat) {
    SetAttrib("alignhoriz", sheet.cellformats[cell.cellformat]);
  }

  // layout: alignvert, padtop, padright, padbottom, padleft

  InitAttribs(["alignvert", "padtop", "padright", "padbottom", "padleft"]);
  if (cell.layout) {
    parts = sheet.layouts[cell.layout].match(
      /^padding:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+);vertical-align:\s*(\S+);/,
    );
    SetAttribStar("padtop", parts[1]);
    SetAttribStar("padright", parts[2]);
    SetAttribStar("padbottom", parts[3]);
    SetAttribStar("padleft", parts[4]);
    SetAttribStar("alignvert", parts[5]);
  }

  // font: fontfamily, fontlook, fontsize

  InitAttribs(["fontfamily", "fontlook", "fontsize"]);
  if (cell.font) {
    parts = sheet.fonts[cell.font].match(/^(\*|\S+? \S+?) (\S+?) (\S.*)$/);
    SetAttribStar("fontfamily", parts[3]);
    SetAttribStar("fontsize", parts[2]);
    SetAttribStar("fontlook", parts[1]);
  }

  // color: textcolor

  InitAttrib("textcolor");
  if (cell.color) {
    SetAttrib("textcolor", sheet.colors[cell.color]);
  }

  // bgcolor: bgcolor

  InitAttrib("bgcolor");
  if (cell.bgcolor) {
    SetAttrib("bgcolor", sheet.colors[cell.bgcolor]);
  }

  // formatting: numberformat, textformat

  InitAttribs(["numberformat", "textformat"]);
  if (cell.nontextvalueformat) {
    SetAttrib("numberformat", sheet.valueformats[cell.nontextvalueformat]);
  }
  if (cell.textvalueformat) {
    SetAttrib("textformat", sheet.valueformats[cell.textvalueformat]);
  }

  // merges: colspan, rowspan

  InitAttribs(["colspan", "rowspan"]);
  SetAttrib("colspan", cell.colspan || 1);
  SetAttrib("rowspan", cell.rowspan || 1);

  // borders: bXthickness, bXstyle, bXcolor for X = t, r, b, and l

  for (i = 0; i < 4; i++) {
    b = "trbl".charAt(i);
    bb = "b" + b;
    InitAttrib(bb);
    SetAttrib(bb, cell[bb] ? sheet.borderstyles[cell[bb]] : "");
    InitAttrib(bb + "thickness");
    InitAttrib(bb + "style");
    InitAttrib(bb + "color");
    if (cell[bb]) {
      parts = sheet.borderstyles[cell[bb]].match(/(\S+)\s+(\S+)\s+(\S.+)/);
      SetAttrib(bb + "thickness", parts[1]);
      SetAttrib(bb + "style", parts[2]);
      SetAttrib(bb + "color", parts[3]);
    }
  }

  // misc: cssc, csss, mod, unlocked

  InitAttribs(["cssc", "csss", "mod", "unlocked"]);
  SetAttrib("cssc", cell.cssc || "");
  SetAttrib("csss", cell.csss || "");
  SetAttrib("mod", cell.mod || "n");
  SetAttrib("unlocked", cell.unlocked ? "y" : "n");

  return result;
};

//
// result = SocialCalc.EncodeSheetAttributes(sheet)
//
// Returns the sheet's attributes in an object, each in the following form:
//
//    attribname: {def: true/false, val: full-value}
//

/** @param {any} sheet */
SC.EncodeSheetAttributes = function (sheet: any) {
  var value: any = undefined;
  var parts: any;
  var attribs = sheet.attribs;
  var result: any = {};

  /** @param {any} name */
  var InitAttrib = function (name: any) {
    result[name] = { def: true, val: "" };
  };

  /** @param {any} namelist */
  var InitAttribs = function (namelist: any) {
    for (var i = 0; i < namelist.length; i++) {
      InitAttrib(namelist[i]);
    }
  };

  /** @param {any} name @param {any} v */
  var SetAttrib = function (name: any, v: any) {
    result[name].def = false;
    result[name].val = v || value;
  };

  /** @param {any} name @param {any} v */
  var SetAttribStar = function (name: any, v: any) {
    if (v == "*") return;
    result[name].def = false;
    result[name].val = v;
  };

  // sizes: colwidth, rowheight

  InitAttrib("colwidth");
  if (attribs.defaultcolwidth) {
    SetAttrib("colwidth", attribs.defaultcolwidth);
  }

  InitAttrib("rowheight");

  // cellformat: textalignhoriz, numberalignhoriz

  InitAttrib("textalignhoriz");
  if (attribs.defaulttextformat) {
    SetAttrib("textalignhoriz", sheet.cellformats[attribs.defaulttextformat]);
  }

  InitAttrib("numberalignhoriz");
  if (attribs.defaultnontextformat) {
    SetAttrib("numberalignhoriz", sheet.cellformats[attribs.defaultnontextformat]);
  }

  // layout: alignvert, padtop, padright, padbottom, padleft

  InitAttribs(["alignvert", "padtop", "padright", "padbottom", "padleft"]);
  if (attribs.defaultlayout) {
    parts = sheet.layouts[attribs.defaultlayout].match(
      /^padding:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+);vertical-align:\s*(\S+);/,
    );
    SetAttribStar("padtop", parts[1]);
    SetAttribStar("padright", parts[2]);
    SetAttribStar("padbottom", parts[3]);
    SetAttribStar("padleft", parts[4]);
    SetAttribStar("alignvert", parts[5]);
  }

  // font: fontfamily, fontlook, fontsize

  InitAttribs(["fontfamily", "fontlook", "fontsize"]);
  if (attribs.defaultfont) {
    parts = sheet.fonts[attribs.defaultfont].match(/^(\*|\S+? \S+?) (\S+?) (\S.*)$/);
    SetAttribStar("fontfamily", parts[3]);
    SetAttribStar("fontsize", parts[2]);
    SetAttribStar("fontlook", parts[1]);
  }

  // color: textcolor

  InitAttrib("textcolor");
  if (attribs.defaultcolor) {
    SetAttrib("textcolor", sheet.colors[attribs.defaultcolor]);
  }

  // bgcolor: bgcolor

  InitAttrib("bgcolor");
  if (attribs.defaultbgcolor) {
    SetAttrib("bgcolor", sheet.colors[attribs.defaultbgcolor]);
  }

  // formatting: numberformat, textformat

  InitAttribs(["numberformat", "textformat"]);
  if (attribs.defaultnontextvalueformat) {
    SetAttrib("numberformat", sheet.valueformats[attribs.defaultnontextvalueformat]);
  }
  if (attribs.defaulttextvalueformat) {
    SetAttrib("textformat", sheet.valueformats[attribs.defaulttextvalueformat]);
  }

  // recalc: recalc

  InitAttrib("recalc");
  if (attribs.recalc) {
    SetAttrib("recalc", attribs.recalc);
  }

  // protected: protected

  InitAttrib("protected");
  if (attribs.protected) {
    SetAttrib("protected", attribs.protected);
  }

  // usermaxcol, usermaxrow
  InitAttrib("usermaxcol");
  if (attribs.usermaxcol) {
    SetAttrib("usermaxcol", attribs.usermaxcol);
  }
  InitAttrib("usermaxrow");
  if (attribs.usermaxrow) {
    SetAttrib("usermaxrow", attribs.usermaxrow);
  }

  // print: printarea, printrepeatcols, printrepeatrows, printorientation, printscale, printmargins

  InitAttrib("printarea");
  if (attribs.printarea) {
    SetAttrib("printarea", attribs.printarea);
  }
  InitAttrib("printrepeatcols");
  if (attribs.printrepeatcols) {
    SetAttrib("printrepeatcols", attribs.printrepeatcols);
  }
  InitAttrib("printrepeatrows");
  if (attribs.printrepeatrows) {
    SetAttrib("printrepeatrows", attribs.printrepeatrows);
  }
  InitAttrib("printorientation");
  if (attribs.printorientation) {
    SetAttrib("printorientation", attribs.printorientation);
  }
  InitAttrib("printscale");
  if (attribs.printscale) {
    SetAttrib("printscale", attribs.printscale);
  }
  InitAttrib("printmargins");
  if (attribs.printmargins) {
    SetAttrib("printmargins", attribs.printmargins);
  }

  return result;
};

//
// cmdstr = SocialCalc.DecodeCellAttributes(sheet, coord, attribs, range)
//
// Takes cell attributes in an object, each in the following form:
//
//    attribname: {def: true/false, val: full-value}
//
// and returns the sheet commands to make the actual attributes correspond.
// Returns a non-null string if any commands are to be executed, null otherwise.
//
// If range is provided, the commands are executed on the whole range.
//

/** @param {any} sheet @param {any} coord @param {any} newattribs @param {any} range */
SC.DecodeCellAttributes = function (sheet: any, coord: any, newattribs: any, range: any) {
  var value, b, bb, i;

  var cell = sheet.GetAssuredCell(coord);

  var changed = false;

  /** @param {any} attribname @param {any} oldval @param {any} cmdname */
  var CheckChanges = function (attribname: any, oldval: any, cmdname: any) {
    var val;
    if (newattribs[attribname]) {
      if (newattribs[attribname].def) {
        val = "";
      } else {
        val = newattribs[attribname].val;
      }
      if (val != (oldval || "")) {
        DoCmd(cmdname + " " + val);
      }
    }
  };

  var cmdstr = "";

  /** @param {any} str */
  var DoCmd = function (str: any) {
    if (cmdstr) cmdstr += "\n";
    cmdstr += "set " + (range || coord) + " " + str;
    changed = true;
  };

  // cellformat: alignhoriz

  CheckChanges("alignhoriz", sheet.cellformats[cell.cellformat], "cellformat");

  // layout: alignvert, padtop, padright, padbottom, padleft

  if (
    !newattribs.alignvert.def ||
    !newattribs.padtop.def ||
    !newattribs.padright.def ||
    !newattribs.padbottom.def ||
    !newattribs.padleft.def
  ) {
    value =
      "padding:" +
      (newattribs.padtop.def ? "* " : newattribs.padtop.val + " ") +
      (newattribs.padright.def ? "* " : newattribs.padright.val + " ") +
      (newattribs.padbottom.def ? "* " : newattribs.padbottom.val + " ") +
      (newattribs.padleft.def ? "*" : newattribs.padleft.val) +
      ";vertical-align:" +
      (newattribs.alignvert.def ? "*;" : newattribs.alignvert.val + ";");
  } else {
    value = "";
  }

  if (value != (sheet.layouts[cell.layout] || "")) {
    DoCmd("layout " + value);
  }

  // font: fontfamily, fontlook, fontsize

  if (!newattribs.fontlook.def || !newattribs.fontsize.def || !newattribs.fontfamily.def) {
    value =
      (newattribs.fontlook.def ? "* " : newattribs.fontlook.val + " ") +
      (newattribs.fontsize.def ? "* " : newattribs.fontsize.val + " ") +
      (newattribs.fontfamily.def ? "*" : newattribs.fontfamily.val);
  } else {
    value = "";
  }

  if (value != (sheet.fonts[cell.font] || "")) {
    DoCmd("font " + value);
  }

  // color: textcolor

  CheckChanges("textcolor", sheet.colors[cell.color], "color");

  // bgcolor: bgcolor

  CheckChanges("bgcolor", sheet.colors[cell.bgcolor], "bgcolor");

  // formatting: numberformat, textformat

  CheckChanges("numberformat", sheet.valueformats[cell.nontextvalueformat], "nontextvalueformat");

  CheckChanges("textformat", sheet.valueformats[cell.textvalueformat], "textvalueformat");

  // merges: colspan, rowspan - NOT HANDLED: IGNORED!

  // borders: bX for X = t, r, b, and l; bXthickness, bXstyle, bXcolor ignored

  for (i = 0; i < 4; i++) {
    b = "trbl".charAt(i);
    bb = "b" + b;
    CheckChanges(bb, sheet.borderstyles[cell[bb]], bb);
  }

  // misc: cssc, csss, mod, unlocked

  CheckChanges("cssc", cell.cssc, "cssc");

  CheckChanges("csss", cell.csss, "csss");

  if (newattribs.mod) {
    if (newattribs.mod.def) {
      value = "n";
    } else {
      value = newattribs.mod.val;
    }
    if (value != (cell.mod || "n")) {
      if (value == "n") value = ""; // restrict to "y" and "" normally
      DoCmd("mod " + value);
    }
  }

  if (newattribs.unlocked) {
    value = newattribs.unlocked.def ? "n" : newattribs.unlocked.val;
    if (value != (cell.unlocked ? "y" : "n")) {
      DoCmd("unlocked " + (value == "y" ? "yes" : "no"));
    }
  }

  // if any changes return command(s)

  if (changed) {
    return cmdstr;
  } else {
    return null;
  }
};

//
// changed = SocialCalc.DecodeSheetAttributes(sheet, newattribs)
//
// Takes sheet attributes in an object, each in the following form:
//
//    attribname: {def: true/false, val: full-value}
//
// and returns the sheet commands to make the actual attributes correspond.
// Returns a non-null string if any commands were executed, null otherwise.
//

/** @param {any} sheet @param {any} newattribs */
SC.DecodeSheetAttributes = function (sheet: any, newattribs: any) {
  var value;
  var attribs = sheet.attribs;
  var changed = false;

  /** @param {any} attribname @param {any} oldval @param {any} cmdname */
  var CheckChanges = function (attribname: any, oldval: any, cmdname: any) {
    var val;
    if (newattribs[attribname]) {
      if (newattribs[attribname].def) {
        val = "";
      } else {
        val = newattribs[attribname].val;
      }
      if (val != (oldval || "")) {
        DoCmd(cmdname + " " + val);
      }
    }
  };

  var cmdstr = "";

  /** @param {any} str */
  var DoCmd = function (str: any) {
    if (cmdstr) cmdstr += "\n";
    cmdstr += "set sheet " + str;
    changed = true;
  };

  // sizes: colwidth, rowheight

  CheckChanges("colwidth", attribs.defaultcolwidth, "defaultcolwidth");

  CheckChanges("rowheight", attribs.defaultrowheight, "defaultrowheight");

  // cellformat: textalignhoriz, numberalignhoriz

  CheckChanges("textalignhoriz", sheet.cellformats[attribs.defaulttextformat], "defaulttextformat");

  CheckChanges(
    "numberalignhoriz",
    sheet.cellformats[attribs.defaultnontextformat],
    "defaultnontextformat",
  );

  // layout: alignvert, padtop, padright, padbottom, padleft

  if (
    !newattribs.alignvert.def ||
    !newattribs.padtop.def ||
    !newattribs.padright.def ||
    !newattribs.padbottom.def ||
    !newattribs.padleft.def
  ) {
    value =
      "padding:" +
      (newattribs.padtop.def ? "* " : newattribs.padtop.val + " ") +
      (newattribs.padright.def ? "* " : newattribs.padright.val + " ") +
      (newattribs.padbottom.def ? "* " : newattribs.padbottom.val + " ") +
      (newattribs.padleft.def ? "*" : newattribs.padleft.val) +
      ";vertical-align:" +
      (newattribs.alignvert.def ? "*;" : newattribs.alignvert.val + ";");
  } else {
    value = "";
  }

  if (value != (sheet.layouts[attribs.defaultlayout] || "")) {
    DoCmd("defaultlayout " + value);
  }

  // font: fontfamily, fontlook, fontsize

  if (!newattribs.fontlook.def || !newattribs.fontsize.def || !newattribs.fontfamily.def) {
    value =
      (newattribs.fontlook.def ? "* " : newattribs.fontlook.val + " ") +
      (newattribs.fontsize.def ? "* " : newattribs.fontsize.val + " ") +
      (newattribs.fontfamily.def ? "*" : newattribs.fontfamily.val);
  } else {
    value = "";
  }

  if (value != (sheet.fonts[attribs.defaultfont] || "")) {
    DoCmd("defaultfont " + value);
  }

  // color: textcolor

  CheckChanges("textcolor", sheet.colors[attribs.defaultcolor], "defaultcolor");

  // bgcolor: bgcolor

  CheckChanges("bgcolor", sheet.colors[attribs.defaultbgcolor], "defaultbgcolor");

  // formatting: numberformat, textformat

  CheckChanges(
    "numberformat",
    sheet.valueformats[attribs.defaultnontextvalueformat],
    "defaultnontextvalueformat",
  );

  CheckChanges(
    "textformat",
    sheet.valueformats[attribs.defaulttextvalueformat],
    "defaulttextvalueformat",
  );

  // recalc: recalc

  CheckChanges("recalc", sheet.attribs.recalc, "recalc");

  // protected: protected

  CheckChanges("protected", sheet.attribs.protected, "protected");

  // usermaxcol, usermaxrow

  CheckChanges("usermaxcol", sheet.attribs.usermaxcol, "usermaxcol");
  CheckChanges("usermaxrow", sheet.attribs.usermaxrow, "usermaxrow");

  // print: printarea, printrepeatcols, printrepeatrows, printorientation, printscale, printmargins

  CheckChanges("printarea", sheet.attribs.printarea, "printarea");
  CheckChanges("printrepeatcols", sheet.attribs.printrepeatcols, "printrepeatcols");
  CheckChanges("printrepeatrows", sheet.attribs.printrepeatrows, "printrepeatrows");
  CheckChanges("printorientation", sheet.attribs.printorientation, "printorientation");
  CheckChanges("printscale", sheet.attribs.printscale, "printscale");
  CheckChanges("printmargins", sheet.attribs.printmargins, "printmargins");

  // if any changes return command(s)

  if (changed) {
    return cmdstr;
  } else {
    return null;
  }
};

// *************************************
//
// Sheet command routines
//
// *************************************

//
// SocialCalc.SheetCommandInfo - object with information used during command execution
//

/** @param {any} sheetobj */
SC.SheetCommandInfo = function (sheetobj: any) {
  this.sheetobj = sheetobj; // sheet being operated on
  this.timerobj = null; // used for timeslicing
  this.firsttimerdelay = 50; // wait before starting cmds (for Chrome - to give time to update)
  this.timerdelay = 1; // wait between slices
  this.maxtimeslice = 100; // do another slice after this many milliseconds
  this.saveundo = false; // arg for ExecuteSheetCommand

  this.CmdExtensionCallbacks = {}; // for startcmdextension, in form: cmdname, {func:function(cmdname, data, sheet, SocialCalc.Parse object, saveundo), data:whatever}

  //   statuscallback: null, // called during execution - obsolete: use sheet obj's
  //   statuscallbackparams: null
};

//
// SocialCalc.ScheduleSheetCommands
//
// statuscallback is called at the beginning (cmdstart) and end (cmdend).
//

/** @param {any} sheet @param {any} cmdstr @param {any} saveundo */
SC.ScheduleSheetCommands = function (sheet: any, cmdstr: any, saveundo: any) {
  var sci = sheet.sci;

  var parseobj = new SocialCalc.Parse(cmdstr);

  if (sci.sheetobj.statuscallback) {
    // notify others if requested
    sheet.statuscallback(sci, "cmdstart", "", sci.sheetobj.statuscallbackparams);
  }

  if (saveundo) {
    sci.sheetobj.changes.PushChange(""); // add a step to undo stack
  }

  sci.timerobj = window.setTimeout(function () {
    SocialCalc.SheetCommandsTimerRoutine(sci, parseobj, saveundo);
  }, sci.firsttimerdelay);
};

/** @param {any} sci @param {any} parseobj @param {any} saveundo */
SC.SheetCommandsTimerRoutine = function (sci: any, parseobj: any, saveundo: any) {
  var errortext;
  var starttime = new Date();
  sci.timerobj = null;

  while (!parseobj.EOF()) {
    // go through all commands (separated by newlines)
    try {
      errortext = SocialCalc.ExecuteSheetCommand(sci.sheetobj, parseobj, saveundo);
    } catch (err) {
      errortext = err instanceof Error ? err.message : String(err);
    }

    // Error - Use  log on server   OR  alert on client
    if (errortext) {
      sci.sheetobj.lastcommanderror = errortext; // surfaced to aria-live error announcements
      if (typeof alert == "function") {
        alert(errortext);
      } else {
        console.log(errortext);
      }
    }

    parseobj.NextLine();

    if (Date.now() - starttime.getTime() >= sci.maxtimeslice) {
      // if taking too long, give up CPU for a while
      sci.timerobj = window.setTimeout(function () {
        SocialCalc.SheetCommandsTimerRoutine(sci, parseobj, saveundo);
      }, sci.timerdelay);
      return;
    }
  }

  if (sci.sheetobj.statuscallback) {
    // notify others if requested
    sci.sheetobj.statuscallback(sci, "cmdend", "", sci.sheetobj.statuscallbackparams);
  }
};

//
// errortext = SocialCalc.ExecuteSheetCommand(sheet, cmd, saveundo)
//
// cmd is a SocialCalc.Parse object.
//
// Executes commands that modify the sheet data.
// Sets sheet "needsrecalc" as needed.
// Sets sheet "changedrendervalues" as needed.
//
// The cmd string may be multiple commands, separated by newlines. In that case
// only one "step" is put on the undo stack representing all the commands.
// Note that because of this, in "set A1 text ..." and "set A1 comment ..." text is
// treated as encoded (newline => \n, \ => \b, : => \c).
//
// The commands are in the forms:
//
//    set sheet attributename value (plus lastcol and lastrow)
//    set 22 attributename value
//    set B attributename value
//    set A1 attributename value1 value2... (see each attribute in code for details)
//       - set A1 validation encoded-JSON-rule (js/socialcalcdatavalidation.ts DataValidationRule)
//       - set A1 clearvalidation (removes any rule; ignores its rest-of-string arg)
//    set A1:B5 attributename value1 value2...
//    erase/copy/cut/paste/fillright/filldown A1:B5 all/formulas/format
//    loadclipboard save-encoded-clipboard-data
//    clearclipboard
//    merge C3:F3
//    unmerge C3
//    insertcol/insertrow C5
//    deletecol/deleterow C5:E7
//    movepaste/moveinsert A1:B5 A8 all/formulas/format (if insert, destination must be in same rows or columns or else paste done)
//    sort cr1:cr2 col1 up/down col2 up/down col3 up/down
//    name define NAME definition
//    name desc NAME description
//    name delete NAME
//    autofilter attach ID range
//    autofilter criteria ID colOffset json-criterion-or-empty
//    autofilter clearcol ID colOffset
//    autofilter clearall ID
//    autofilter detach ID
//    table create NAME range hasHeader:0/1 style withFilter:0/1
//    table delete NAME
//    table style NAME style
//    table range NAME range
//    recalc
//    redisplay
//    changedrendervalues
//    startcmdextension extension rest-of-command
//    sendemail ??? eddy ???
//
// If saveundo is true, then undo information is saved in sheet.changes.
//

/** @param {any} sheet @param {any} cmd @param {any} saveundo */
SC.ExecuteSheetCommand = function (sheet: any, cmd: any, saveundo: any) {
  var cmdstr: any;
  var cmd1: any;
  var rest: any;
  var what: any;
  var attrib: any;
  var num: any;
  var pos: any;
  var pos2: any;
  var errortext: any;
  var undostart: any;
  var val: any;
  var cr1: any;
  var cr2: any;
  var col: any;
  var row: any;
  var cr: any;
  var cell: any;
  var newcell: any;
  var fillright: any;
  var rowstart: any;
  var colstart: any;
  var crbase: any;
  var rowoffset: any;
  var coloffset: any;
  var basecell: any;
  var clipsheet: any;
  var cliprange: any;
  var numcols: any;
  var numrows: any;
  var attribtable: any;
  var colend: any;
  var rowend: any;
  var newcolstart: any;
  var newrowstart: any;
  var newcolend: any;
  var newrowend: any;
  var rownext: any;
  var colnext: any;
  var colthis: any;
  var lastrow: any;
  var lastcol: any;
  var rowbefore: any;
  var colbefore: any;
  var oldformula: any;
  var oldcr: any;
  var olddefinition: any;
  var cols: any;
  var dirs: any;
  var lastsortcol: any;
  var i: any;
  var sortlist: any;
  var sortcells: any;
  var sortvalues: any;
  var sorttypes: any;
  var sortfunction: any;
  var valtype: any;
  var originalrow: any;
  var sortedcr: any;
  var name: any;
  var v1: any;
  var v2: any;
  var cmdextension: any;
  var editor: any;
  var undoNum: any;
  var trackLine: any;
  // Declared here so assignments in the paste/quash/sort branches below
  // don't become implicit globals in strict-mode runtimes (workerd et al).
  var sourceColname, colWidth, colHide, sourceRow, rowHide;
  var quashedCellCoord, quashedCell;
  var slast, tb;
  var value;
  var inc;

  var attribs = sheet.attribs;
  var changes = sheet.changes;
  var cellProperties = SocialCalc.CellProperties;
  var scc = SocialCalc.Constants;
  var cellChanged = false;

  var ParseRange = function () {
    var prange = SocialCalc.ParseRange(what);
    cr1 = prange.cr1;
    cr2 = prange.cr2;
    if (cr2.col > attribs.lastcol) attribs.lastcol = cr2.col;
    if (cr2.row > attribs.lastrow) attribs.lastrow = cr2.row;
  };

  errortext = "";

  cmdstr = cmd.RestOfStringNoMove();
  if (saveundo) {
    sheet.changes.AddDo(cmdstr);
  }

  sheet.condfmtValueVersion++; // invalidate duplicate/unique count cache (cheap; correctness over micro-perf)
  cmd1 = cmd.NextToken();
  switch (cmd1) {
    case "set":
      what = cmd.NextToken();
      attrib = cmd.NextToken();
      rest = cmd.RestOfString();
      undostart = "set " + what + " " + attrib;

      if (what == "sheet") {
        sheet.renderneeded = true;
        switch (attrib) {
          case "defaultcolwidth":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib]);
            attribs[attrib] = rest;
            break;
          case "defaultcolor":
          case "defaultbgcolor":
            if (saveundo)
              changes.AddUndo(undostart, sheet.GetStyleString("color", attribs[attrib]));
            attribs[attrib] = sheet.GetStyleNum("color", rest);
            break;
          case "defaultlayout":
            if (saveundo)
              changes.AddUndo(undostart, sheet.GetStyleString("layout", attribs[attrib]));
            attribs[attrib] = sheet.GetStyleNum("layout", rest);
            break;
          case "defaultfont":
            if (saveundo) changes.AddUndo(undostart, sheet.GetStyleString("font", attribs[attrib]));
            if (rest == "* * *") rest = ""; // all default
            attribs[attrib] = sheet.GetStyleNum("font", rest);
            break;
          case "defaulttextformat":
          case "defaultnontextformat":
            if (saveundo)
              changes.AddUndo(undostart, sheet.GetStyleString("cellformat", attribs[attrib]));
            attribs[attrib] = sheet.GetStyleNum("cellformat", rest);
            break;
          case "defaulttextvalueformat":
          case "defaultnontextvalueformat":
            if (saveundo)
              changes.AddUndo(undostart, sheet.GetStyleString("valueformat", attribs[attrib]));
            attribs[attrib] = sheet.GetStyleNum("valueformat", rest);
            for (cr in sheet.cells) {
              // forget all cached display strings
              delete sheet.cells[cr].displaystring;
            }
            break;
          case "lastcol":
          case "lastrow":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib] - 0);
            num = rest - 0;
            attribs[attrib] = num > 0 ? num : 1;
            break;
          case "recalc":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib]);
            if (rest == "off") {
              attribs.recalc = rest; // manual recalc, not auto
            } else {
              // all values other than "off" mean "on"
              delete attribs.recalc;
            }
            break;
          case "protected":
            if (saveundo) changes.AddUndo(undostart, attribs.protected || "");
            if (rest == "yes") {
              attribs.protected = "yes";
            } else {
              delete attribs.protected;
            }
            break;
          case "usermaxcol":
          case "usermaxrow":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib] - 0);
            num = rest - 0;
            attribs[attrib] = num > 0 ? num : 0;
            break;
          case "printarea":
          case "printrepeatcols":
          case "printrepeatrows":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib]);
            if (rest.length > 0) {
              attribs[attrib] = rest;
            } else {
              delete attribs[attrib];
            }
            break;
          case "printorientation":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib]);
            if (rest == "landscape") {
              attribs.printorientation = rest;
            } else {
              delete attribs.printorientation; // default is portrait
            }
            break;
          case "printscale":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib] - 0);
            num = rest - 0;
            if (num > 0 && num != 100) {
              attribs.printscale = num;
            } else {
              delete attribs.printscale;
            }
            break;
          case "printmargins":
            if (saveundo) changes.AddUndo(undostart, attribs[attrib]);
            if (rest.length > 0) {
              attribs.printmargins = rest;
            } else {
              delete attribs.printmargins;
            }
            break;
          default:
            errortext = scc.s_escUnknownSheetCmd + cmdstr;
            break;
        }
      } else if (/^[a-z]{1,2}(:[a-z]{1,2})?$/i.test(what)) {
        // col attributes
        sheet.renderneeded = true;

        what = what.toUpperCase();
        pos = what.indexOf(":");
        if (pos >= 0) {
          cr1 = SocialCalc.coordToCr(what.substring(0, pos) + "1");
          cr2 = SocialCalc.coordToCr(what.substring(pos + 1) + "1");
        } else {
          cr1 = SocialCalc.coordToCr(what + "1");
          cr2 = cr1;
        }
        for (col = cr1.col; col <= cr2.col; col++) {
          if (attrib == "width") {
            cr = SocialCalc.rcColname(col);
            if (saveundo) changes.AddUndo("set " + cr + " width", sheet.colattribs.width[cr]);
            if (rest.length > 0) {
              sheet.colattribs.width[cr] = rest;
            } else {
              delete sheet.colattribs.width[cr];
            }
          } else if (attrib == "hide") {
            sheet.hiddencolrow = "col";
            cr = SocialCalc.rcColname(col);
            if (saveundo) changes.AddUndo("set " + cr + " hide", sheet.colattribs.hide[cr]);
            if (rest.length > 0) {
              sheet.colattribs.hide[cr] = rest;
            } else {
              delete sheet.colattribs.hide[cr];
            }
          }
        }
      } else if (/^\d+(:\d+)?$/i.test(what)) {
        // row attributes
        sheet.renderneeded = true;
        what = what.toUpperCase();
        pos = what.indexOf(":");
        if (pos >= 0) {
          cr1 = SocialCalc.coordToCr("A" + what.substring(0, pos));
          cr2 = SocialCalc.coordToCr("A" + what.substring(pos + 1));
        } else {
          cr1 = SocialCalc.coordToCr("A" + what);
          cr2 = cr1;
        }
        for (row = cr1.row; row <= cr2.row; row++) {
          if (attrib == "height") {
            if (saveundo) changes.AddUndo("set " + row + " height", sheet.rowattribs.height[row]);
            if (rest.length > 0) {
              sheet.rowattribs.height[row] = rest;
            } else {
              delete sheet.rowattribs.height[row];
            }
          } else if (attrib == "hide") {
            sheet.hiddencolrow = "row";
            if (saveundo) changes.AddUndo("set " + row + " hide", sheet.rowattribs.hide[row]);
            if (rest.length > 0) {
              sheet.rowattribs.hide[row] = rest;
            } else {
              delete sheet.rowattribs.hide[row];
            }
          }
        }
      } else if (/^[a-z]{1,2}\d+(:[a-z]{1,2}\d+)?$/i.test(what)) {
        // cell attributes
        cellChanged = true;
        ParseRange();
        if (
          attrib == "value" ||
          attrib == "text" ||
          attrib == "formula" ||
          attrib == "constant" ||
          attrib == "empty" ||
          attrib == "all"
        ) {
          errortext = SocialCalc.PrepareSpillMutation(sheet, [{ cr1: cr1, cr2: cr2 }], false);
          if (errortext) break;
        }
        if (
          cr1.row != cr2.row ||
          cr1.col != cr2.col ||
          sheet.celldisplayneeded ||
          sheet.renderneeded
        ) {
          // not one cell
          sheet.renderneeded = true;
          sheet.celldisplayneeded = "";
        } else {
          sheet.celldisplayneeded = SocialCalc.crToCoord(cr1.col, cr1.row);
        }
        for (row = cr1.row; row <= cr2.row; row++) {
          for (col = cr1.col; col <= cr2.col; col++) {
            cr = SocialCalc.crToCoord(col, row);
            cell = sheet.GetAssuredCell(cr);
            if (
              !SocialCalc.IsCellEditable(sheet, cr) &&
              attrib != "readonly" &&
              attrib != "unlocked"
            )
              continue;
            // Data-validation enforcement: reject mode blocks manual/programmatic
            // "value"/"text"/"constant" commits outright. Warn mode is enforced
            // interactively in EditorSaveEdit (confirm dialog) before the command
            // is ever scheduled; a warn-mode command that reaches here always
            // commits. The "all" attrib (used exclusively by undo/redo replay,
            // load-from-save's CellFromStringParts, and copy/paste/fill, all of
            // which write already-validated or trusted historical data) never
            // enters this branch, so restoration is never blocked. See
            // js/socialcalcdatavalidation.ts for the rule engine.
            if (attrib == "value" || attrib == "text" || attrib == "constant") {
              var dvRule = SocialCalc.DataValidation.DecodeRule(cell.validation);
              if (dvRule) {
                var dvPos = rest.indexOf(" ");
                var dvRaw = "";
                if (attrib == "value") {
                  dvRaw = rest.substring(dvPos + 1);
                } else if (attrib == "text") {
                  dvRaw = SocialCalc.decodeFromSave(rest.substring(dvPos + 1));
                } else {
                  var dvPos2 = rest.substring(dvPos + 1).indexOf(" ");
                  dvRaw = rest.substring(dvPos + dvPos2 + 2);
                }
                var dvOutcome = SocialCalc.DataValidation.EvaluateRule(sheet, dvRule, dvRaw);
                if (dvOutcome == "reject") {
                  errortext = SocialCalc.DataValidation.DefaultErrorMessage(dvRule);
                  continue;
                }
              }
            }
            if (saveundo) changes.AddUndo("set " + cr + " all", sheet.CellToString(cell));
            if (attrib == "value") {
              // set coord value type numeric-value
              pos = rest.indexOf(" ");
              var vtype = rest.substring(0, pos);
              var vrest = rest.substring(pos + 1);
              delete cell.errors;
              delete cell.displaystring;
              delete cell.parseinfo;
              if (vtype == "n") {
                cell.datavalue = vrest - 0;
                cell.datatype = "v";
                cell.valuetype = "n";
              } else {
                value = SocialCalc.DetermineValueType(vrest);
                cell.datavalue = value.value;
                cell.valuetype = value.type;
                if (value.type.charAt(0) == "t") {
                  cell.datatype = "t";
                } else {
                  cell.datatype = "c";
                  cell.formula = vrest;
                }
              }
              attribs.needsrecalc = "yes";
            } else if (attrib == "text") {
              // set coord text type text-value
              pos = rest.indexOf(" ");
              cell.datavalue = SocialCalc.decodeFromSave(rest.substring(pos + 1));
              delete cell.errors;
              cell.datatype = "t";
              cell.valuetype = rest.substring(0, pos);
              delete cell.displaystring;
              delete cell.parseinfo;
              attribs.needsrecalc = "yes";
            } else if (attrib == "formula") {
              // set coord formula formula-body-less-initial-=
              cell.datavalue = 0; // until recalc
              delete cell.errors;
              cell.datatype = "f";
              if (SocialCalc._app && cell.valuetype != "e#N/A") cell.prevvaluetype = cell.valuetype; // repaint when widgets added/removed
              cell.valuetype = "e#N/A"; // until recalc
              cell.formula = rest;
              delete cell.displaystring;
              delete cell.parseinfo;
              attribs.needsrecalc = "yes";
            } else if (attrib == "constant") {
              // set coord constant type numeric-value source-text
              pos = rest.indexOf(" ");
              pos2 = rest.substring(pos + 1).indexOf(" ");
              cell.datavalue = rest.substring(pos + 1, pos + 1 + pos2) - 0;
              cell.valuetype = rest.substring(0, pos);
              if (cell.valuetype.charAt(0) == "e") {
                // error
                cell.errors = cell.valuetype.substring(1);
              } else {
                delete cell.errors;
              }
              cell.datatype = "c";
              cell.formula = rest.substring(pos + pos2 + 2);
              delete cell.displaystring;
              delete cell.parseinfo;
              attribs.needsrecalc = "yes";
            } else if (attrib == "empty") {
              // erase value
              cell.datavalue = "";
              delete cell.errors;
              cell.datatype = null;
              cell.formula = "";
              cell.valuetype = "b";
              delete cell.displaystring;
              delete cell.parseinfo;
              attribs.needsrecalc = "yes";
            } else if (attrib == "all") {
              // set coord all :this:val1:that:val2...
              if (rest.length > 0) {
                cell = new SocialCalc.Cell(cr);
                sheet.CellFromStringParts(cell, rest.split(":"), 1);
                sheet.cells[cr] = cell;
              } else {
                delete sheet.cells[cr];
              }
              attribs.needsrecalc = "yes";
            } else if (/^b[trbl]$/.test(attrib)) {
              // set coord bt 1px solid black
              cell[attrib] = sheet.GetStyleNum("borderstyle", rest);
              sheet.renderneeded = true; // affects more than just one cell
            } else if (attrib == "color" || attrib == "bgcolor") {
              cell[attrib] = sheet.GetStyleNum("color", rest);
            } else if (attrib == "layout" || attrib == "cellformat") {
              cell[attrib] = sheet.GetStyleNum(attrib, rest);
            } else if (attrib == "font") {
              // set coord font style weight size family
              if (rest == "* * *") rest = "";
              cell[attrib] = sheet.GetStyleNum("font", rest);
            } else if (attrib == "textvalueformat" || attrib == "nontextvalueformat") {
              cell[attrib] = sheet.GetStyleNum("valueformat", rest);
              delete cell.displaystring;
            } else if (attrib == "cssc") {
              rest = rest.replace(/[^a-zA-Z0-9-]/g, "");
              cell.cssc = rest;
            } else if (attrib == "csss") {
              rest = rest.replace(/\n/g, "");
              cell.csss = rest;
            } else if (attrib == "mod") {
              rest = rest.replace(/[^yY]/g, "").toLowerCase();
              cell.mod = rest;
            } else if (attrib == "comment") {
              cell.comment = SocialCalc.decodeFromSave(rest);
            } else if (attrib == "readonly") {
              cell.readonly = rest.toLowerCase() == "yes";
            } else if (attrib == "unlocked") {
              cell.unlocked = rest.toLowerCase() == "yes" || rest.toLowerCase() == "y";
            } else if (attrib == "validation") {
              cell.validation = SocialCalc.decodeFromSave(rest);
            } else if (attrib == "clearvalidation") {
              delete cell.validation;
            } else {
              errortext = scc.s_escUnknownSetCoordCmd + cmdstr;
            }
          }
        }
      }
      break;

    case "merge":
      sheet.renderneeded = true;
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      ParseRange();
      errortext = SocialCalc.PrepareSpillMutation(sheet, [{ cr1: cr1, cr2: cr2 }], true);
      if (errortext) break;
      cell = sheet.GetAssuredCell(cr1.coord);
      if (!SocialCalc.IsCellEditable(sheet, cr1.coord)) break;

      // check whether merged cells other than cr1 contain data and clear them
      for (row = cr1.row; row <= cr2.row; row++) {
        for (col = cr1.col; col <= cr2.col; col++) {
          if (!(row == cr1.row && col == cr1.col)) {
            // skip top left cell
            quashedCellCoord = SocialCalc.crToCoord(col, row);
            quashedCell = sheet.GetAssuredCell(quashedCellCoord);
            // save quashed cell value for undo
            if (saveundo)
              changes.AddUndo("set " + quashedCellCoord + " all", sheet.CellToString(quashedCell));
            delete sheet.cells[quashedCellCoord]; // delete cell
          }
        }
      }

      if (saveundo) changes.AddUndo("unmerge " + cr1.coord);

      if (cr2.col > cr1.col) cell.colspan = cr2.col - cr1.col + 1;
      else delete cell.colspan;
      if (cr2.row > cr1.row) cell.rowspan = cr2.row - cr1.row + 1;
      else delete cell.rowspan;

      sheet.changedrendervalues = true;

      break;

    case "unmerge":
      sheet.renderneeded = true;
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      ParseRange();
      cell = sheet.GetAssuredCell(cr1.coord);
      if (!SocialCalc.IsCellEditable(sheet, cr1.coord)) break;
      if (saveundo)
        changes.AddUndo(
          "merge " +
            cr1.coord +
            ":" +
            SocialCalc.crToCoord(
              cr1.col + (cell.colspan || 1) - 1,
              cr1.row + (cell.rowspan || 1) - 1,
            ),
        );

      delete cell.colspan;
      delete cell.rowspan;

      sheet.changedrendervalues = true;

      break;

    case "erase":
    case "cut":
      sheet.renderneeded = true;
      sheet.changedrendervalues = true;
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      ParseRange();
      errortext = SocialCalc.PrepareSpillMutation(sheet, [{ cr1: cr1, cr2: cr2 }], false);
      if (errortext) break;

      if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans
      if (cmd1 == "cut") {
        // save copy of whole thing before erasing
        if (saveundo)
          changes.AddUndo(
            "loadclipboard",
            SocialCalc.encodeForSave(SocialCalc.Clipboard.clipboard),
          );
        SocialCalc.Clipboard.clipboard = SocialCalc.CreateSheetSave(sheet, what);
      }

      for (row = cr1.row; row <= cr2.row; row++) {
        for (col = cr1.col; col <= cr2.col; col++) {
          cr = SocialCalc.crToCoord(col, row);
          cell = sheet.GetAssuredCell(cr);
          if (!SocialCalc.IsCellEditable(sheet, cr)) continue;
          if (saveundo) changes.AddUndo("set " + cr + " all", sheet.CellToString(cell));
          if (rest == "all") {
            delete sheet.cells[cr];
          } else if (rest == "formulas") {
            cell.datavalue = "";
            cell.datatype = null;
            cell.formula = "";
            cell.valuetype = "b";
            delete cell.errors;
            delete cell.displaystring;
            delete cell.parseinfo;
            if (cell.comment) {
              // comments are considered content for erasing
              delete cell.comment;
            }
          } else if (rest == "formats") {
            newcell = new SocialCalc.Cell(cr); // create a new cell without attributes
            newcell.datavalue = cell.datavalue; // copy existing values
            newcell.datatype = cell.datatype;
            newcell.formula = cell.formula;
            newcell.valuetype = cell.valuetype;
            if (cell.comment) {
              newcell.comment = cell.comment;
            }
            sheet.cells[cr] = newcell; // replace
          }
        }
      }
      attribs.needsrecalc = "yes";
      break;

    case "fillright":
    case "filldown":
      sheet.renderneeded = true;
      sheet.changedrendervalues = true;
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      ParseRange();
      errortext = SocialCalc.PrepareSpillMutation(sheet, [{ cr1: cr1, cr2: cr2 }], false);
      if (errortext) break;
      if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans
      /** @param {boolean} down @param {number} seriescol @param {number} seriesrow */
      function increment_amount(down: any, seriescol: any, seriesrow: any) {
        /** @param {string | null | undefined} type */
        function valid_datatype(type: any) {
          return type == "v" || type == "c";
        }
        /** @param {any} startcell @param {any} endcell */
        function increment_from_cells(startcell: any, endcell: any) {
          if (valid_datatype(startcell.datatype) && valid_datatype(endcell.datatype)) {
            return endcell.datavalue - startcell.datavalue;
          }
          return undefined;
        }
        var csco = SocialCalc.GetSpreadsheetControlObject();
        var editor = csco && csco.editor;
        var range = editor && editor.range2;
        var returnval = undefined;
        var startcell, endcell;
        if (range && range.hasrange) {
          if (
            down &&
            range.bottom - range.top == 1 &&
            seriescol >= range.left &&
            seriescol <= range.right
          ) {
            startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(seriescol, range.top));
            endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(seriescol, range.bottom));
            returnval = increment_from_cells(startcell, endcell);
          } else if (
            !down &&
            range.right - range.left == 1 &&
            seriesrow >= range.top &&
            seriesrow <= range.bottom
          ) {
            startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(range.left, seriesrow));
            endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(range.right, seriesrow));
            returnval = increment_from_cells(startcell, endcell);
          }
        }
        if (returnval === undefined) {
          // Fall back to the command range so filldown/fillright replay on the
          // server (no editor.range2) still compute increments from the first
          // two source cells in the fill direction. For rectangular fills,
          // compute a separate increment per column (filldown) or row
          // (fillright), matching spreadsheet series behavior.
          if (down && cr2.row > cr1.row) {
            startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(seriescol, cr1.row));
            endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(seriescol, cr1.row + 1));
            returnval = increment_from_cells(startcell, endcell);
          } else if (!down && cr2.col > cr1.col) {
            startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(cr1.col, seriesrow));
            endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(cr1.col + 1, seriesrow));
            returnval = increment_from_cells(startcell, endcell);
          }
        }
        return returnval;
      }
      if (cmd1 == "fillright") {
        fillright = true;
        rowstart = cr1.row;
        colstart = cr1.col + 1;
      } else {
        fillright = false;
        rowstart = cr1.row + 1;
        colstart = cr1.col;
      }
      var increments: Record<number, number | undefined> = {};
      if (fillright) {
        for (row = rowstart; row <= cr2.row; row++) {
          increments[row] = increment_amount(false, cr1.col, row);
        }
      } else {
        for (col = colstart; col <= cr2.col; col++) {
          increments[col] = increment_amount(true, col, cr1.row);
        }
      }
      var csco = SocialCalc.GetSpreadsheetControlObject();
      var editor = csco && csco.editor;
      if (editor) editor.Range2Remove();
      for (row = rowstart; row <= cr2.row; row++) {
        for (col = colstart; col <= cr2.col; col++) {
          cr = SocialCalc.crToCoord(col, row);
          cell = sheet.GetAssuredCell(cr);
          if (!SocialCalc.IsCellEditable(sheet, cr)) continue;
          if (saveundo) changes.AddUndo("set " + cr + " all", sheet.CellToString(cell));
          if (fillright) {
            crbase = SocialCalc.crToCoord(cr1.col, row);
            coloffset = col - colstart + 1;
            rowoffset = 0;
          } else {
            crbase = SocialCalc.crToCoord(col, cr1.row);
            coloffset = 0;
            rowoffset = row - rowstart + 1;
          }
          basecell = sheet.GetAssuredCell(crbase);
          inc = increments[fillright ? row : col];
          if (rest == "all" || rest == "formats") {
            for (attrib in cellProperties) {
              if (cellProperties[attrib] == 1) continue; // copy only format attributes
              if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
                delete cell[attrib];
              } else {
                cell[attrib] = basecell[attrib];
              }
            }
          }
          if (rest == "all" || rest == "formulas") {
            if (inc !== undefined) {
              cell.datavalue = basecell.datavalue + (fillright ? coloffset : rowoffset) * inc;
            } else {
              cell.datavalue = basecell.datavalue;
            }
            cell.datatype = basecell.datatype;
            cell.valuetype = basecell.valuetype;
            if (cell.datatype == "f") {
              // offset relative coords, even in sheet references
              cell.formula = SocialCalc.OffsetFormulaCoords(basecell.formula, coloffset, rowoffset);
            } else {
              cell.formula = basecell.formula;
            }
            delete cell.parseinfo;
            if (basecell.validation) {
              var fillDvRule = SocialCalc.DataValidation.DecodeRule(basecell.validation);
              cell.validation = fillDvRule
                ? SocialCalc.DataValidation.EncodeRule(
                    SocialCalc.DataValidation.OffsetRuleCoords(fillDvRule, coloffset, rowoffset),
                  )
                : basecell.validation;
            } else {
              delete cell.validation;
            }
            cell.errors = basecell.errors;
          }
          delete cell.displaystring;
        }
      }

      attribs.needsrecalc = "yes";
      break;

    case "copy":
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      if (saveundo)
        changes.AddUndo("loadclipboard", SocialCalc.encodeForSave(SocialCalc.Clipboard.clipboard));
      SocialCalc.Clipboard.clipboard = SocialCalc.CreateSheetSave(sheet, what);
      break;

    case "loadclipboard":
      rest = cmd.RestOfString();
      if (saveundo)
        changes.AddUndo("loadclipboard", SocialCalc.encodeForSave(SocialCalc.Clipboard.clipboard));
      SocialCalc.Clipboard.clipboard = SocialCalc.decodeFromSave(rest);
      break;

    case "clearclipboard":
      if (saveundo)
        changes.AddUndo("loadclipboard", SocialCalc.encodeForSave(SocialCalc.Clipboard.clipboard));
      SocialCalc.Clipboard.clipboard = "";
      break;

    case "paste":
      sheet.renderneeded = true;
      sheet.changedrendervalues = true;
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      ParseRange();
      if (!SocialCalc.Clipboard.clipboard) {
        break;
      }
      clipsheet = new SocialCalc.Sheet(); // load clipboard contents as another sheet
      clipsheet.ParseSheetSave(SocialCalc.Clipboard.clipboard);
      cliprange = SocialCalc.ParseRange(clipsheet.copiedfrom);
      numcols = Math.max(cr2.col - cr1.col + 1, cliprange.cr2.col - cliprange.cr1.col + 1);
      numrows = Math.max(cr2.row - cr1.row + 1, cliprange.cr2.row - cliprange.cr1.row + 1);

      errortext = SocialCalc.PrepareSpillMutation(
        sheet,
        [
          {
            cr1: cr1,
            cr2: { col: cr1.col + numcols - 1, row: cr1.row + numrows - 1 },
          },
        ],
        false,
      );
      if (errortext) break;
      if (cr1.col + numcols - 1 > attribs.lastcol) attribs.lastcol = cr1.col + numcols - 1;
      if (cr1.row + numrows - 1 > attribs.lastrow) attribs.lastrow = cr1.row + numrows - 1;
      if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans
      for (row = cr1.row; row < cr1.row + numrows; row++) {
        for (col = cr1.col; col < cr1.col + numcols; col++) {
          cr = SocialCalc.crToCoord(col, row);
          cell = sheet.GetAssuredCell(cr);
          if (!SocialCalc.IsCellEditable(sheet, cr)) continue;
          if (saveundo) changes.AddUndo("set " + cr + " all", sheet.CellToString(cell));
          var currentClipCol =
            cliprange.cr1.col + ((col - cr1.col) % (cliprange.cr2.col - cliprange.cr1.col + 1));
          var currentClipRow =
            cliprange.cr1.row + ((row - cr1.row) % (cliprange.cr2.row - cliprange.cr1.row + 1));
          crbase = SocialCalc.crToCoord(currentClipCol, currentClipRow);
          basecell = clipsheet.GetAssuredCell(crbase);
          if (rest == "all" || rest == "formats") {
            // get source width and hidden attribute
            // and copy to sheet
            if (row == cr1.row) {
              // only need 1st row of cols
              // col attributes
              sourceColname = SocialCalc.rcColname(
                cliprange.cr1.col + ((col - cr1.col) % (cliprange.cr2.col - cliprange.cr1.col + 1)),
              );
              colWidth = clipsheet.colattribs.width[sourceColname];
              colHide = clipsheet.colattribs.hide[sourceColname];
              if (colWidth != null) {
                // if source col width exists
                // set dest col width
                sheet.colattribs.width[SocialCalc.rcColname(col)] = colWidth;
              }
              if (colHide != null) {
                // if source col is hidden
                // set dest col hidden
                sheet.colattribs.hide[SocialCalc.rcColname(col)] = colHide;
              }
            }
            if (col == cr1.col) {
              // only need 1st col or rows
              // row attributes
              sourceRow =
                cliprange.cr1.row + ((row - cr1.row) % (cliprange.cr2.row - cliprange.cr1.row + 1));
              rowHide = clipsheet.rowattribs.hide[sourceRow];
              if (rowHide != null) {
                // if source row is hidden
                // set dest row hidden
                sheet.rowattribs.hide[row] = rowHide;
              }
            }

            for (attrib in cellProperties) {
              if (cellProperties[attrib] == 1) continue; // copy only format attributes
              if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
                delete cell[attrib];
              } else {
                attribtable = SocialCalc.CellPropertiesTable[attrib];
                if (attribtable && basecell[attrib]) {
                  // table indexes to expand to strings since other sheet may have diff indexes
                  cell[attrib] = sheet.GetStyleNum(
                    attribtable,
                    clipsheet.GetStyleString(attribtable, basecell[attrib]),
                  );
                } else {
                  // these are not table indexes
                  cell[attrib] = basecell[attrib];
                }
              }
            }
          }
          if (rest == "all" || rest == "formulas") {
            cell.datavalue = basecell.datavalue;
            cell.datatype = basecell.datatype;
            cell.valuetype = basecell.valuetype;
            if (cell.datatype == "f") {
              // offset relative coords, even in sheet references
              cell.formula = SocialCalc.OffsetFormulaCoords(
                basecell.formula,
                col - currentClipCol,
                row - currentClipRow,
              );
            } else {
              cell.formula = basecell.formula;
            }
            delete cell.parseinfo;
            cell.errors = basecell.errors;
            if (basecell.comment) {
              // comments are pasted as part of content, though not filled, etc.
              cell.comment = basecell.comment;
            } else if (cell.comment) {
              delete cell.comment;
            }
            if (basecell.validation) {
              // validation rules are pasted as content, with source-range/
              // formula-bound refs offset just like formulas (see fillright).
              var pasteDvRule = SocialCalc.DataValidation.DecodeRule(basecell.validation);
              cell.validation = pasteDvRule
                ? SocialCalc.DataValidation.EncodeRule(
                    SocialCalc.DataValidation.OffsetRuleCoords(
                      pasteDvRule,
                      col - currentClipCol,
                      row - currentClipRow,
                    ),
                  )
                : basecell.validation;
            } else if (cell.validation) {
              delete cell.validation;
            }
          }
          delete cell.displaystring;
        }
      }

      attribs.needsrecalc = "yes";
      break;

    case "sort": // sort cr1:cr2 col1 up/down col2 up/down col3 up/down
      sheet.renderneeded = true;
      sheet.changedrendervalues = true;
      what = cmd.NextToken();
      ParseRange();
      if (SocialCalc.IsSheetProtected(sheet)) {
        for (row = cr1.row; row <= cr2.row; row++) {
          for (col = cr1.col; col <= cr2.col; col++) {
            cr = SocialCalc.crToCoord(col, row);
            if (!SocialCalc.IsCellEditable(sheet, cr)) {
              return "Unable to sort, because cell " + cr + " is locked.";
            }
          }
        }
      }
      errortext = SocialCalc.PrepareSpillMutation(sheet, [{ cr1: cr1, cr2: cr2 }], true);
      if (errortext) break;
      for (row = cr1.row; row <= cr2.row; row++) {
        for (col = cr1.col; col <= cr2.col; col++) {
          cr = SocialCalc.crToCoord(col, row);
          cell = sheet.cells[cr];
          if (cell && (cell.colspan > 1 || cell.rowspan > 1)) {
            errortext = "Unable to sort, because cell " + cr + " is part of a merged area";
            break;
          }
        }
        if (errortext) break;
      }
      if (errortext) break;
      if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans
      cols = []; // get columns and sort directions (or "")
      dirs = [];
      lastsortcol = 0;
      for (i = 0; i <= 3; i++) {
        cols[i] = cmd.NextToken();
        dirs[i] = cmd.NextToken();
        if (cols[i]) lastsortcol = i;
      }

      sortcells = {}; // a copy of the data which will replace the original, but in the new order
      sortlist = []; // an array of 0, 1, ..., nrows-1 needed for sorting
      sortvalues = []; // values to be sorted corresponding to sortlist
      sorttypes = []; // basic types of the values

      for (row = cr1.row; row <= cr2.row; row++) {
        // fill in the sort info
        for (col = cr1.col; col <= cr2.col; col++) {
          cr = SocialCalc.crToCoord(col, row);
          cell = sheet.cells[cr];
          if (cell) {
            // only copy non-empty cells
            sortcells[cr] = sheet.CellToString(cell);
            if (saveundo) changes.AddUndo("set " + cr + " all", sortcells[cr]);
          } else {
            if (saveundo) changes.AddUndo("set " + cr + " all");
          }
        }
        sortlist.push(sortlist.length);
        sortvalues.push([]);
        sorttypes.push([]);
        slast = sorttypes.length - 1;
        for (i = 0; i <= lastsortcol; i++) {
          cr = cols[i] + row; // get cr on this row in sort col
          cell = sheet.GetAssuredCell(cr);
          val = cell.datavalue;
          valtype = cell.valuetype.charAt(0) || "b";
          if (valtype == "t") val = val.toLowerCase();
          sortvalues[slast].push(val);
          sorttypes[slast].push(valtype);
        }
      }

      /** @param {any} a @param {any} b */
      sortfunction = function (a: any, b: any) {
        // a comparison function that can handle all the type variations
        var i, a1, b1, ta, cresult;
        for (i = 0; i <= lastsortcol; i++) {
          if (dirs[i] == "up") {
            // handle sort direction
            a1 = a;
            b1 = b;
          } else {
            a1 = b;
            b1 = a;
          }
          ta = sorttypes[a1][i];
          tb = sorttypes[b1][i];
          if (ta == "t") {
            // numbers < text < errors, blank always last no matter what dir
            if (tb == "t") {
              a1 = sortvalues[a1][i];
              b1 = sortvalues[b1][i];
              cresult = a1 > b1 ? 1 : a1 < b1 ? -1 : 0;
            } else if (tb == "n") {
              cresult = 1;
            } else if (tb == "b") {
              cresult = dirs[i] == "up" ? -1 : 1;
            } else if (tb == "e") {
              cresult = -1;
            }
          } else if (ta == "n") {
            if (tb == "t") {
              cresult = -1;
            } else if (tb == "n") {
              a1 = sortvalues[a1][i] - 0; // force to numeric, just in case
              b1 = sortvalues[b1][i] - 0;
              cresult = a1 > b1 ? 1 : a1 < b1 ? -1 : 0;
            } else if (tb == "b") {
              cresult = dirs[i] == "up" ? -1 : 1;
            } else if (tb == "e") {
              cresult = -1;
            }
          } else if (ta == "e") {
            if (tb == "e") {
              a1 = sortvalues[a1][i];
              b1 = sortvalues[b1][i];
              cresult = a1 > b1 ? 1 : a1 < b1 ? -1 : 0;
            } else if (tb == "b") {
              cresult = dirs[i] == "up" ? -1 : 1;
            } else {
              cresult = 1;
            }
          } else if (ta == "b") {
            if (tb == "b") {
              cresult = 0;
            } else {
              cresult = dirs[i] == "up" ? 1 : -1;
            }
          }
          if (cresult) {
            // return if tested not equal, otherwise do next column
            return cresult;
          }
        }
        cresult = a > b ? 1 : a < b ? -1 : 0; // equal - return position in original to maintain it
        return cresult;
      };

      sortlist.sort(sortfunction);

      for (row = cr1.row; row <= cr2.row; row++) {
        // copy original rows into sorted positions
        originalrow = sortlist[row - cr1.row]; // relative position where it was in original
        for (col = cr1.col; col <= cr2.col; col++) {
          cr = SocialCalc.crToCoord(col, row);
          sortedcr = SocialCalc.crToCoord(col, originalrow + cr1.row); // original cell to be put in new place
          if (sortcells[sortedcr]) {
            cell = new SocialCalc.Cell(cr);
            sheet.CellFromStringParts(cell, sortcells[sortedcr].split(":"), 1);
            if (cell.datatype == "f") {
              // offset coord refs inside the sort band only
              cell.formula = SocialCalc.OffsetFormulaCoords(
                cell.formula,
                0,
                row - cr1.row - originalrow,
                {
                  startCol: cr1.col,
                  endCol: cr2.col,
                  startRow: cr1.row,
                  endRow: cr2.row,
                },
              );
            }
            sheet.cells[cr] = cell;
          } else {
            delete sheet.cells[cr];
          }
        }
      }

      attribs.needsrecalc = "yes";
      break;

    case "insertcol":
    case "insertrow":
      sheet.renderneeded = true;
      sheet.changedrendervalues = true;
      sheet.widgetsClean = false; //  force widgets to repaint - update cell reference in widget HTML
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      ParseRange();
      if (SocialCalc.IsSheetProtected(sheet)) {
        return (
          "Unable to insert " + (cmd1 == "insertcol" ? "column" : "row") + ": sheet is protected."
        );
      }
      lastcol = attribs.lastcol;
      lastrow = attribs.lastrow;

      if (cmd1 == "insertcol") {
        coloffset = 1;
        colend = cr1.col;
        rowoffset = 0;
        rowend = 1;
        newcolstart = cr1.col;
        newcolend = cr1.col;
        newrowstart = 1;
        newrowend = attribs.lastrow;
        if (attribs.lastcol >= 702) {
          break;
        }
        if (saveundo) changes.AddUndo("deletecol " + cr1.coord);
      } else {
        coloffset = 0;
        colend = 1;
        rowoffset = 1;
        rowend = cr1.row;
        newcolstart = 1;
        newcolend = attribs.lastcol;
        newrowstart = cr1.row;
        newrowend = cr1.row;
        if (saveundo) changes.AddUndo("deleterow " + cr1.coord);
      }
      SocialCalc.ClearAllDerivedSpills(sheet);

      for (row = lastrow; row >= rowend; row--) {
        // copy the cells forward
        for (col = lastcol; col >= colend; col--) {
          crbase = SocialCalc.crToCoord(col, row);
          cr = SocialCalc.crToCoord(col + coloffset, row + rowoffset);
          if (!sheet.cells[crbase]) {
            // copying empty cell
            delete sheet.cells[cr]; // delete anything that may have been there
          } else {
            // overwrite existing cell with moved contents
            sheet.cells[cr] = sheet.cells[crbase];
          }
        }
      }

      for (row = newrowstart; row <= newrowend; row++) {
        // fill the "new" empty cells
        for (col = newcolstart; col <= newcolend; col++) {
          cr = SocialCalc.crToCoord(col, row);
          cell = new SocialCalc.Cell(cr);
          sheet.cells[cr] = cell;
          crbase = SocialCalc.crToCoord(col - coloffset, row - rowoffset); // copy attribs of the one before (0 gives you A or 1)
          basecell = sheet.GetAssuredCell(crbase);
          for (attrib in cellProperties) {
            if (cellProperties[attrib] == 2) {
              // copy only format attributes
              if (attrib == "colspan" || attrib == "rowspan") continue; // do not copy span
              cell[attrib] = basecell[attrib];
            }
          }
        }
      }

      for (cr in sheet.cells) {
        // update cell references to moved cells in calculated formulas
        cell = sheet.cells[cr];
        if (cell && cell.datatype == "f") {
          cell.formula = SocialCalc.AdjustFormulaCoords(
            cell.formula,
            cr1.col,
            coloffset,
            cr1.row,
            rowoffset,
          );
        }
        if (cell) {
          delete cell.parseinfo;
          if (cell.validation) {
            var insDvRule = SocialCalc.DataValidation.DecodeRule(cell.validation);
            if (insDvRule) {
              cell.validation = SocialCalc.DataValidation.EncodeRule(
                SocialCalc.DataValidation.AdjustRuleCoords(
                  insDvRule,
                  cr1.col,
                  coloffset,
                  cr1.row,
                  rowoffset,
                ),
              );
            }
          }
        }
      }

      for (name in sheet.names) {
        // update cell references to moved cells in names
        if (sheet.names[name]) {
          // works with "A1", "A1:A20", and "=formula" forms
          v1 = sheet.names[name].definition;
          v2 = "";
          if (v1.charAt(0) == "=") {
            v2 = "=";
            v1 = v1.substring(1);
          }
          sheet.names[name].definition =
            v2 + SocialCalc.AdjustFormulaCoords(v1, cr1.col, coloffset, cr1.row, rowoffset);
        }
      }

      for (i = 0; i < sheet.condfmtRules.length; i++) {
        var icfrule = sheet.condfmtRules[i];
        // No undo emitted here: the top-level insertcol/insertrow command
        // already schedules a deletecol/deleterow inverse, and that handler's
        // own condfmt fixup loop restores the pre-insert range/formula. An
        // explicit undo here would double-adjust (see deletecol/deleterow
        // case's dcfrule loop, which mirrors this one and does own the undo).
        icfrule.range = SocialCalc.AdjustFormulaCoords(
          icfrule.range,
          cr1.col,
          coloffset,
          cr1.row,
          rowoffset,
        );
        if (icfrule.formula) {
          icfrule.formula = SocialCalc.AdjustFormulaCoords(
            icfrule.formula,
            cr1.col,
            coloffset,
            cr1.row,
            rowoffset,
          );
        }
      }

      for (name in sheet.charts) {
        // update chart anchor/source ranges for the inserted row/col
        SocialCalc.Chart.AdjustChartForStructuralChange(
          sheet.charts[name],
          cr1.col,
          coloffset,
          cr1.row,
          rowoffset,
        );
      }

      for (row = attribs.lastrow; row >= rowend && cmd1 == "insertrow"; row--) {
        // copy the row attributes forward
        rownext = row + rowoffset;
        for (attrib in sheet.rowattribs) {
          val = sheet.rowattribs[attrib][row];
          if (sheet.rowattribs[attrib][rownext] != val) {
            // make assignment only if different
            if (val) {
              sheet.rowattribs[attrib][rownext] = val;
            } else {
              delete sheet.rowattribs[attrib][rownext];
            }
          }
        }
      }

      for (col = lastcol; col >= colend && cmd1 == "insertcol"; col--) {
        // copy the column attributes forward
        colthis = SocialCalc.rcColname(col);
        colnext = SocialCalc.rcColname(col + coloffset);
        for (attrib in sheet.colattribs) {
          val = sheet.colattribs[attrib][colthis];
          if (sheet.colattribs[attrib][colnext] != val) {
            // make assignment only if different
            if (val) {
              sheet.colattribs[attrib][colnext] = val;
            } else {
              delete sheet.colattribs[attrib][colnext];
            }
          }
        }
      }

      // Expand merged cells if the new row/col is in between

      var tempRenderContext = new SocialCalc.RenderContext(sheet);
      tempRenderContext.CalculateCellSkipData();

      var cellsToExpand: Record<string, boolean> = {}; // Keep track of all merge spans we've expanded
      // so we don't expand one twice
      for (var skipCell in tempRenderContext.cellskip) {
        var skipCellCR = SocialCalc.coordToCr(skipCell),
          mergerCellCoords = tempRenderContext.cellskip[skipCell];
        // for insertcol we check if the newly inserted col has
        // has any spans. This can only mean, that those cells
        // are part of a row span
        if (cmd1 === "insertcol" && skipCellCR.col === newcolstart) {
          if (!cellsToExpand[mergerCellCoords]) {
            sheet.GetAssuredCell(mergerCellCoords).colspan += coloffset;
          }
          cellsToExpand[mergerCellCoords] = true;
        }
        // for insertrow it's the same method
        if (cmd1 === "insertrow" && skipCellCR.row === newrowstart) {
          if (!cellsToExpand[mergerCellCoords]) {
            sheet.GetAssuredCell(mergerCellCoords).rowspan += rowoffset;
          }
          cellsToExpand[mergerCellCoords] = true;
        }
      }

      SocialCalc.AdjustAutoFilterRangesForStructuralEdit(
        sheet,
        cr1.col,
        coloffset,
        cr1.row,
        rowoffset,
      );
      attribs.lastcol = Math.min(702, attribs.lastcol + coloffset);
      attribs.lastrow += rowoffset;
      attribs.needsrecalc = "yes";
      break;

    case "deletecol":
    case "deleterow":
      sheet.renderneeded = true;
      sheet.changedrendervalues = true;
      sheet.widgetsClean = false; // update cell reference in widget HTML - force widgets to repaint
      what = cmd.NextToken();
      rest = cmd.RestOfString();
      lastcol = attribs.lastcol; // save old values since ParseRange sets...
      lastrow = attribs.lastrow;
      ParseRange();

      if (cmd1 == "deletecol") {
        coloffset = cr1.col - cr2.col - 1;
        rowoffset = 0;
        colstart = cr2.col + 1;
        rowstart = 1;
      } else {
        coloffset = 0;
        rowoffset = cr1.row - cr2.row - 1;
        colstart = 1;
        rowstart = cr2.row + 1;
      }

      for (row = rowstart; row <= lastrow - rowoffset; row++) {
        // check for readonly cells
        for (col = colstart; col <= lastcol - coloffset; col++) {
          cr = SocialCalc.crToCoord(col + coloffset, row + rowoffset);
          cell = sheet.cells[cr];
          if (cell && !SocialCalc.IsCellEditable(sheet, cr)) {
            errortext =
              "Unable to remove " +
              (cmd1 == "deletecol" ? "column" : "row") +
              ", because cell " +
              cell.coord +
              " is locked";
            return errortext;
          }
        }
      }
      SocialCalc.ClearAllDerivedSpills(sheet);

      for (row = rowstart; row <= lastrow - rowoffset; row++) {
        // copy the cells backwards - extra so no dup of last set
        for (col = colstart; col <= lastcol - coloffset; col++) {
          cr = SocialCalc.crToCoord(col + coloffset, row + rowoffset);
          if (saveundo && (row < rowstart - rowoffset || col < colstart - coloffset)) {
            // save cells that are overwritten as undo info
            cell = sheet.cells[cr];
            if (!cell) {
              // empty cell
              changes.AddUndo("erase " + cr + " all");
            } else {
              changes.AddUndo("set " + cr + " all", sheet.CellToString(cell));
            }
          }
          crbase = SocialCalc.crToCoord(col, row);
          cell = sheet.cells[crbase];
          if (!cell) {
            // copying empty cell
            delete sheet.cells[cr]; // delete anything that may have been there
          } else {
            // overwrite existing cell with moved contents
            sheet.cells[cr] = cell;
          }
        }
      }

      //!!! multiple deletes isn't setting #REF!; need to fix up #REF!'s on undo but only those!

      for (cr in sheet.cells) {
        // update cell references to moved cells in calculated formulas
        cell = sheet.cells[cr];
        if (cell) {
          if (cell.datatype == "f") {
            oldformula = cell.formula;
            cell.formula = SocialCalc.AdjustFormulaCoords(
              oldformula,
              cr1.col,
              coloffset,
              cr1.row,
              rowoffset,
            );
            if (cell.formula != oldformula) {
              delete cell.parseinfo;
              if (saveundo && cell.formula.indexOf("#REF!") != -1) {
                // save old version only if removed coord
                oldcr = SocialCalc.coordToCr(cr);
                if (cmd1 == "deletecol") {
                  crbase = SocialCalc.crToCoord(
                    oldcr.col < cr1.col ? oldcr.col : oldcr.col - coloffset,
                    oldcr.row,
                  );
                } else {
                  crbase = SocialCalc.crToCoord(
                    oldcr.col,
                    oldcr.row < cr1.row ? oldcr.row : oldcr.row - rowoffset,
                  );
                }
                changes.AddUndo("set " + crbase + " formula " + oldformula);
              }
            }
          } else {
            delete cell.parseinfo;
          }
          if (cell.validation) {
            var delDvRule = SocialCalc.DataValidation.DecodeRule(cell.validation);
            if (delDvRule) {
              cell.validation = SocialCalc.DataValidation.EncodeRule(
                SocialCalc.DataValidation.AdjustRuleCoords(
                  delDvRule,
                  cr1.col,
                  coloffset,
                  cr1.row,
                  rowoffset,
                ),
              );
            }
          }
        }
      }

      for (name in sheet.names) {
        // update cell references to moved cells in names
        if (sheet.names[name]) {
          // works with "A1", "A1:A20", and "=formula" forms
          olddefinition = sheet.names[name].definition;
          v1 = olddefinition;
          v2 = "";
          if (v1.charAt(0) == "=") {
            v2 = "=";
            v1 = v1.substring(1);
          }
          sheet.names[name].definition =
            v2 + SocialCalc.AdjustFormulaCoords(v1, cr1.col, coloffset, cr1.row, rowoffset);
          if (saveundo && sheet.names[name].definition != olddefinition) {
            changes.AddUndo("name define " + name + " " + olddefinition);
          }
        }
      }

      for (i = 0; i < sheet.condfmtRules.length; i++) {
        var dcfrule = sheet.condfmtRules[i];
        var dcfoldrange = dcfrule.range;
        var dcfoldformula = dcfrule.formula;
        dcfrule.range = SocialCalc.AdjustFormulaCoords(
          dcfrule.range,
          cr1.col,
          coloffset,
          cr1.row,
          rowoffset,
        );
        if (dcfrule.formula) {
          dcfrule.formula = SocialCalc.AdjustFormulaCoords(
            dcfrule.formula,
            cr1.col,
            coloffset,
            cr1.row,
            rowoffset,
          );
        }
        if (saveundo && (dcfrule.range != dcfoldrange || dcfrule.formula != dcfoldformula)) {
          changes.AddUndo(
            "condfmt update " +
              dcfrule.id +
              " " +
              [
                SocialCalc.encodeForSave(dcfoldrange),
                SocialCalc.encodeForSave(dcfrule.type),
                SocialCalc.encodeForSave(dcfrule.op),
                SocialCalc.encodeForSave(dcfrule.value1),
                SocialCalc.encodeForSave(dcfrule.value2),
                SocialCalc.encodeForSave(dcfoldformula),
                dcfrule.stopIfTrue ? "1" : "0",
                dcfrule.style.font,
                dcfrule.style.color,
                dcfrule.style.bgcolor,
                dcfrule.style.bt,
                dcfrule.style.br,
                dcfrule.style.bb,
                dcfrule.style.bl,
              ].join("\t"),
          );
        }
      }

      for (name in sheet.charts) {
        // update chart anchor/source ranges for the deleted row/col
        SocialCalc.Chart.AdjustChartForStructuralChange(
          sheet.charts[name],
          cr1.col,
          coloffset,
          cr1.row,
          rowoffset,
        );
      }

      for (row = rowstart; row <= lastrow - rowoffset && cmd1 == "deleterow"; row++) {
        // copy the row attributes backwards
        rowbefore = row + rowoffset;
        for (attrib in sheet.rowattribs) {
          val = sheet.rowattribs[attrib][row];
          if (sheet.rowattribs[attrib][rowbefore] != val) {
            // make assignment only if different
            if (saveundo)
              changes.AddUndo(
                "set " + rowbefore + " " + attrib,
                sheet.rowattribs[attrib][rowbefore],
              );
            if (val) {
              sheet.rowattribs[attrib][rowbefore] = val;
            } else {
              delete sheet.rowattribs[attrib][rowbefore];
            }
          }
        }
      }

      for (col = colstart; col <= lastcol - coloffset && cmd1 == "deletecol"; col++) {
        // copy the column attributes backwards
        colthis = SocialCalc.rcColname(col);
        colbefore = SocialCalc.rcColname(col + coloffset);
        for (attrib in sheet.colattribs) {
          val = sheet.colattribs[attrib][colthis];
          if (sheet.colattribs[attrib][colbefore] != val) {
            // make assignment only if different
            if (saveundo)
              changes.AddUndo(
                "set " + colbefore + " " + attrib,
                sheet.colattribs[attrib][colbefore],
              );
            if (val) {
              sheet.colattribs[attrib][colbefore] = val;
            } else {
              delete sheet.colattribs[attrib][colbefore];
            }
          }
        }
      }

      // Shrink merged cells if the new row/col was in between

      var tempRenderContext = new SocialCalc.RenderContext(sheet);
      tempRenderContext.CalculateCellSkipData();

      var cellsToShrink: Record<string, boolean> = {}; // Keep track of shrinked cells, so we don't do it twice
      for (var skipCell in tempRenderContext.cellskip) {
        var skipCellCR = SocialCalc.coordToCr(skipCell),
          mergerCellCoords = tempRenderContext.cellskip[skipCell],
          mergerCellCR = tempRenderContext.coordToCR[mergerCellCoords];
        // for deletecol we check if the removed col any spans that
        // are from younger cols and shrink those
        if (
          cmd1 === "deletecol" &&
          skipCellCR.col === colstart + coloffset &&
          mergerCellCR.col < skipCellCR.col
        ) {
          if (!cellsToShrink[mergerCellCoords]) {
            sheet.GetAssuredCell(mergerCellCoords).colspan += coloffset;
          }
          cellsToShrink[mergerCellCoords] = true;
        }
        // for insertrow it's the same method
        if (
          cmd1 === "deleterow" &&
          skipCellCR.row === rowstart + rowoffset &&
          mergerCellCR.row < skipCellCR.row
        ) {
          if (!cellsToShrink[mergerCellCoords]) {
            sheet.GetAssuredCell(mergerCellCoords).rowspan += rowoffset;
          }
          cellsToShrink[mergerCellCoords] = true;
        }
      }

      if (saveundo) {
        if (cmd1 == "deletecol") {
          for (col = cr1.col; col <= cr2.col; col++) {
            changes.AddUndo("insertcol " + SocialCalc.rcColname(cr1.col));
          }
        } else {
          for (row = cr1.row; row <= cr2.row; row++) {
            changes.AddUndo("insertrow " + cr1.row);
          }
        }
      }

      if (cmd1 == "deletecol") {
        if (cr1.col <= lastcol) {
          // shrink sheet unless deleted phantom cols off the end
          if (cr2.col <= lastcol) {
            attribs.lastcol += coloffset;
          } else {
            attribs.lastcol = cr1.col - 1;
          }
        }
      } else {
        if (cr1.row <= lastrow) {
          // shrink sheet unless deleted phantom rows off the end
          if (cr2.row <= lastrow) {
            attribs.lastrow += rowoffset;
          } else {
            attribs.lastrow = cr1.row - 1;
          }
        }
      }
      SocialCalc.AdjustAutoFilterRangesForStructuralEdit(
        sheet,
        cr1.col,
        coloffset,
        cr1.row,
        rowoffset,
      );
      attribs.needsrecalc = "yes";
      break;
    case "movepaste":
    case "moveinsert":
      var movingcells: any;
      var dest: any;
      var destcr: any;
      var inserthoriz: any;
      var insertvert: any;
      var pushamount: any;
      var movedto: any;

      sheet.renderneeded = true;
      sheet.changedrendervalues = true;
      what = cmd.NextToken();
      dest = cmd.NextToken();
      rest = cmd.RestOfString(); // rest is all/formulas/formats
      if (rest == "") rest = "all";

      ParseRange();

      destcr = SocialCalc.coordToCr(dest);

      coloffset = destcr.col - cr1.col;
      rowoffset = destcr.row - cr1.row;
      numcols = cr2.col - cr1.col + 1;
      numrows = cr2.row - cr1.row + 1;
      errortext = SocialCalc.PrepareSpillMutation(
        sheet,
        [
          { cr1: cr1, cr2: cr2 },
          { cr1: destcr, cr2: { col: destcr.col + numcols - 1, row: destcr.row + numrows - 1 } },
        ],
        true,
      );
      if (errortext) break;
      if (cmd1 == "moveinsert") {
        errortext = SocialCalc.PrepareSpillMutation(
          sheet,
          [
            {
              cr1: { col: 1, row: 1 },
              cr2: { col: attribs.lastcol, row: attribs.lastrow },
            },
          ],
          true,
        );
        if (errortext) break;
      }
      if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans

      // get a copy of moving cells and erase from where they were

      movingcells = {};

      for (row = cr1.row; row <= cr2.row; row++) {
        for (col = cr1.col; col <= cr2.col; col++) {
          cr = SocialCalc.crToCoord(col, row);
          cell = sheet.GetAssuredCell(cr);
          if (!SocialCalc.IsCellEditable(sheet, cr)) continue;
          if (saveundo) changes.AddUndo("set " + cr + " all", sheet.CellToString(cell));

          // if had nothing
          // don't save anything
          movingcells[cr] = new SocialCalc.Cell(cr); // create new cell to copy

          for (attrib in cellProperties) {
            // go through each property
            if (typeof cell[attrib] === "undefined") {
              // don't copy undefined things and no need to delete
              continue;
            } else {
              movingcells[cr][attrib] = cell[attrib]; // copy for potential moving
            }
            if (rest == "all") {
              delete cell[attrib];
            }
            if (rest == "formulas") {
              if (cellProperties[attrib] == 1 || cellProperties[attrib] == 3) {
                delete cell[attrib];
              }
            }
            if (rest == "formats") {
              if (cellProperties[attrib] == 2) {
                delete cell[attrib];
              }
            }
          }
          if (rest == "formulas") {
            // leave pristene deleted cell
            cell.datavalue = "";
            cell.datatype = null;
            cell.formula = "";
            cell.valuetype = "b";
          }
          if (rest == "all") {
            // leave nothing for move all
            delete sheet.cells[cr];
          }
        }
      }

      // if moveinsert, check destination OK, and calculate pushing parameters

      if (cmd1 == "moveinsert") {
        inserthoriz = false;
        insertvert = false;
        if (rowoffset == 0 && (destcr.col < cr1.col || destcr.col > cr2.col)) {
          if (destcr.col < cr1.col) {
            // moving left
            pushamount = cr1.col - destcr.col;
            inserthoriz = -1;
          } else {
            destcr.col -= 1;
            coloffset = destcr.col - cr2.col;
            pushamount = destcr.col - cr2.col;
            inserthoriz = 1;
          }
        } else if (coloffset == 0 && (destcr.row < cr1.row || destcr.row > cr2.row)) {
          if (destcr.row < cr1.row) {
            // moving up
            pushamount = cr1.row - destcr.row;
            insertvert = -1;
          } else {
            destcr.row -= 1;
            rowoffset = destcr.row - cr2.row;
            pushamount = destcr.row - cr2.row;
            insertvert = 1;
          }
        } else {
          cmd1 = "movepaste"; // not allowed right now - ignore
        }
      }

      // push any cells that need pushing

      movedto = {}; // remember what was moved where

      if (insertvert) {
        for (row = 0; row < pushamount; row++) {
          for (col = cr1.col; col <= cr2.col; col++) {
            if (insertvert < 0) {
              crbase = SocialCalc.crToCoord(col, destcr.row + pushamount - row - 1); // from cell
              cr = SocialCalc.crToCoord(col, cr2.row - row); // to cell
            } else {
              crbase = SocialCalc.crToCoord(col, destcr.row - pushamount + row + 1); // from cell
              cr = SocialCalc.crToCoord(col, cr1.row + row); // to cell
            }

            basecell = sheet.GetAssuredCell(crbase);
            if (saveundo) changes.AddUndo("set " + crbase + " all", sheet.CellToString(basecell));

            cell = sheet.GetAssuredCell(cr);
            if (rest == "all" || rest == "formats") {
              for (attrib in cellProperties) {
                if (cellProperties[attrib] == 1) continue; // copy only format attributes
                if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
                  delete cell[attrib];
                } else {
                  cell[attrib] = basecell[attrib];
                }
              }
            }
            if (rest == "all" || rest == "formulas") {
              cell.datavalue = basecell.datavalue;
              cell.datatype = basecell.datatype;
              cell.valuetype = basecell.valuetype;
              cell.formula = basecell.formula;
              delete cell.parseinfo;
              cell.errors = basecell.errors;
            }
            delete cell.displaystring;

            movedto[crbase] = cr; // old crbase is now at cr
          }
        }
      }
      if (inserthoriz) {
        for (col = 0; col < pushamount; col++) {
          for (row = cr1.row; row <= cr2.row; row++) {
            if (inserthoriz < 0) {
              crbase = SocialCalc.crToCoord(destcr.col + pushamount - col - 1, row);
              cr = SocialCalc.crToCoord(cr2.col - col, row);
            } else {
              crbase = SocialCalc.crToCoord(destcr.col - pushamount + col + 1, row);
              cr = SocialCalc.crToCoord(cr1.col + col, row);
            }

            basecell = sheet.GetAssuredCell(crbase);
            if (saveundo) changes.AddUndo("set " + crbase + " all", sheet.CellToString(basecell));

            cell = sheet.GetAssuredCell(cr);
            if (rest == "all" || rest == "formats") {
              for (attrib in cellProperties) {
                if (cellProperties[attrib] == 1) continue; // copy only format attributes
                if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
                  delete cell[attrib];
                } else {
                  cell[attrib] = basecell[attrib];
                }
              }
            }
            if (rest == "all" || rest == "formulas") {
              cell.datavalue = basecell.datavalue;
              cell.datatype = basecell.datatype;
              cell.valuetype = basecell.valuetype;
              cell.formula = basecell.formula;
              delete cell.parseinfo;
              cell.errors = basecell.errors;
            }
            delete cell.displaystring;

            movedto[crbase] = cr; // old crbase is now at cr
          }
        }
      }

      // paste moved cells into new place

      if (destcr.col + numcols - 1 > attribs.lastcol) attribs.lastcol = destcr.col + numcols - 1;
      if (destcr.row + numrows - 1 > attribs.lastrow) attribs.lastrow = destcr.row + numrows - 1;

      for (row = cr1.row; row < cr1.row + numrows; row++) {
        for (col = cr1.col; col < cr1.col + numcols; col++) {
          cr = SocialCalc.crToCoord(col + coloffset, row + rowoffset);
          cell = sheet.GetAssuredCell(cr);
          if (!SocialCalc.IsCellEditable(sheet, cr)) continue;
          if (saveundo) changes.AddUndo("set " + cr + " all", sheet.CellToString(cell));

          crbase = SocialCalc.crToCoord(col, row); // get old cell to move

          movedto[crbase] = cr; // old crbase (moved cell) will now be at cr (destination)

          if (rest == "all" && !movingcells[crbase]) {
            // moving an empty cell
            delete sheet.cells[cr]; // make the cell empty
            continue;
          }

          basecell = movingcells[crbase];
          if (!basecell) basecell = sheet.GetAssuredCell(crbase);

          if (rest == "all" || rest == "formats") {
            for (attrib in cellProperties) {
              if (cellProperties[attrib] == 1) continue; // copy only format attributes
              if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
                delete cell[attrib];
              } else {
                cell[attrib] = basecell[attrib];
              }
            }
          }
          if (rest == "all" || rest == "formulas") {
            cell.datavalue = basecell.datavalue;
            cell.datatype = basecell.datatype;
            cell.valuetype = basecell.valuetype;
            cell.formula = basecell.formula;
            delete cell.parseinfo;
            cell.errors = basecell.errors;
            if (basecell.comment) {
              // comments are pasted as part of content, though not filled, etc.
              cell.comment = basecell.comment;
            } else if (cell.comment) {
              delete cell.comment;
            }
            if (basecell.validation) {
              cell.validation = basecell.validation; // rewritten below in the movedto fixup pass
            } else if (cell.validation) {
              delete cell.validation;
            }
          }
          delete cell.displaystring;
        }
      }

      // do fixups

      for (cr in sheet.cells) {
        // update cell references to moved cells in calculated formulas
        cell = sheet.cells[cr];
        if (cell) {
          if (cell.datatype == "f") {
            oldformula = cell.formula;
            cell.formula = SocialCalc.ReplaceFormulaCoords(oldformula, movedto);
            if (cell.formula != oldformula) {
              delete cell.parseinfo;
              if (saveundo && !movedto[cr]) {
                // moved cells are already saved for undo
                changes.AddUndo("set " + cr + " formula " + oldformula);
              }
            }
          } else {
            delete cell.parseinfo;
          }
          if (cell.validation) {
            var moveDvRule = SocialCalc.DataValidation.DecodeRule(cell.validation);
            if (moveDvRule) {
              cell.validation = SocialCalc.DataValidation.EncodeRule(
                SocialCalc.DataValidation.ReplaceRuleCoords(moveDvRule, movedto),
              );
            }
          }
        }
      }

      for (name in sheet.names) {
        // update cell references to moved cells in names
        if (sheet.names[name]) {
          // works with "A1", "A1:A20", and "=formula" forms
          v1 = sheet.names[name].definition;
          oldformula = v1;
          v2 = "";
          if (v1.charAt(0) == "=") {
            v2 = "=";
            v1 = v1.substring(1);
          }
          sheet.names[name].definition = v2 + SocialCalc.ReplaceFormulaCoords(v1, movedto);
          if (saveundo && sheet.names[name].definition != oldformula) {
            // save changes
            changes.AddUndo("name define " + name + " " + oldformula);
          }
        }
      }

      for (i = 0; i < sheet.condfmtRules.length; i++) {
        var mcfrule = sheet.condfmtRules[i];
        var mcfoldrange = mcfrule.range;
        var mcfoldformula = mcfrule.formula;
        mcfrule.range = SocialCalc.ReplaceFormulaCoords(mcfrule.range, movedto);
        if (mcfrule.formula) {
          mcfrule.formula = SocialCalc.ReplaceFormulaCoords(mcfrule.formula, movedto);
        }
        if (saveundo && (mcfrule.range != mcfoldrange || mcfrule.formula != mcfoldformula)) {
          changes.AddUndo(
            "condfmt update " +
              mcfrule.id +
              " " +
              [
                SocialCalc.encodeForSave(mcfoldrange),
                SocialCalc.encodeForSave(mcfrule.type),
                SocialCalc.encodeForSave(mcfrule.op),
                SocialCalc.encodeForSave(mcfrule.value1),
                SocialCalc.encodeForSave(mcfrule.value2),
                SocialCalc.encodeForSave(mcfoldformula),
                mcfrule.stopIfTrue ? "1" : "0",
                mcfrule.style.font,
                mcfrule.style.color,
                mcfrule.style.bgcolor,
                mcfrule.style.bt,
                mcfrule.style.br,
                mcfrule.style.bb,
                mcfrule.style.bl,
              ].join("\t"),
          );
        }
      }

      for (name in sheet.charts) {
        // update chart anchor/source ranges for the moved rectangle
        SocialCalc.Chart.ReplaceChartCoords(sheet.charts[name], movedto);
      }

      attribs.needsrecalc = "yes";
      break;

    case "autofilter":
      // autofilter attach <id> <range>
      // autofilter criteria <id> <colOffset> <json-criterion-or-empty>
      // autofilter clearcol <id> <colOffset>
      // autofilter clearall <id>
      // autofilter detach <id>
      what = cmd.NextToken();
      name = cmd.NextToken(); // filter id

      if (what == "attach") {
        rest = cmd.RestOfString();
        pos = rest.indexOf(" ");
        var afRange = pos >= 0 ? rest.substring(0, pos) : rest;
        if (!afRange) break;
        if (saveundo) {
          if (sheet.autofilters[name]) {
            changes.AddUndo("autofilter attach " + name + " " + sheet.autofilters[name].range);
          } else {
            changes.AddUndo("autofilter detach " + name);
          }
        }
        sheet.autofilters[name] = { id: name, range: afRange.toUpperCase(), criteria: {} };
        SocialCalc.RecomputeAutoFilters(sheet);
        sheet.renderneeded = true;
      } else if (what == "criteria") {
        colnext = cmd.NextToken(); // colOffset
        rest = cmd.RestOfString();
        if (!sheet.autofilters[name]) break;
        var afOffset = colnext - 0;
        if (saveundo) {
          var afOldCriterion = sheet.autofilters[name].criteria[afOffset];
          if (afOldCriterion) {
            changes.AddUndo(
              "autofilter criteria " +
                name +
                " " +
                afOffset +
                " " +
                SocialCalc.encodeForSave(JSON.stringify(afOldCriterion)),
            );
          } else {
            changes.AddUndo("autofilter clearcol " + name + " " + afOffset);
          }
        }
        if (rest.length > 0) {
          try {
            sheet.autofilters[name].criteria[afOffset] = JSON.parse(
              SocialCalc.decodeFromSave(rest),
            );
          } catch {
            errortext = scc.s_escUnknownSheetCmd + cmdstr;
            break;
          }
        } else {
          delete sheet.autofilters[name].criteria[afOffset];
        }
        SocialCalc.RecomputeAutoFilters(sheet);
        sheet.renderneeded = true;
      } else if (what == "clearcol") {
        colnext = cmd.NextToken();
        if (!sheet.autofilters[name]) break;
        var afClearOffset = colnext - 0;
        if (saveundo) {
          var afClearOld = sheet.autofilters[name].criteria[afClearOffset];
          if (afClearOld) {
            changes.AddUndo(
              "autofilter criteria " +
                name +
                " " +
                afClearOffset +
                " " +
                SocialCalc.encodeForSave(JSON.stringify(afClearOld)),
            );
          }
        }
        delete sheet.autofilters[name].criteria[afClearOffset];
        SocialCalc.RecomputeAutoFilters(sheet);
        sheet.renderneeded = true;
      } else if (what == "clearall") {
        if (!sheet.autofilters[name]) break;
        if (saveundo) {
          for (var afRestoreOffset in sheet.autofilters[name].criteria) {
            changes.AddUndo(
              "autofilter criteria " +
                name +
                " " +
                afRestoreOffset +
                " " +
                SocialCalc.encodeForSave(
                  JSON.stringify(sheet.autofilters[name].criteria[afRestoreOffset]),
                ),
            );
          }
        }
        sheet.autofilters[name].criteria = {};
        SocialCalc.RecomputeAutoFilters(sheet);
        sheet.renderneeded = true;
      } else if (what == "detach") {
        if (!sheet.autofilters[name]) break;
        if (saveundo) {
          changes.AddUndo("autofilter attach " + name + " " + sheet.autofilters[name].range);
          for (var afDetachOffset in sheet.autofilters[name].criteria) {
            changes.AddUndo(
              "autofilter criteria " +
                name +
                " " +
                afDetachOffset +
                " " +
                SocialCalc.encodeForSave(
                  JSON.stringify(sheet.autofilters[name].criteria[afDetachOffset]),
                ),
            );
          }
        }
        var afOwnedRows = sheet.autofilters[name].ownedRows || {};
        for (var afOwnedRowKey in afOwnedRows) {
          var afOwnedRow = Number(afOwnedRowKey);
          if (sheet.rowattribs.filterhide[afOwnedRow] == "yes") {
            delete sheet.rowattribs.filterhide[afOwnedRow];
          }
        }
        delete sheet.autofilters[name];
        for (var afTname in sheet.tables) {
          if (sheet.tables[afTname].filterId == name) sheet.tables[afTname].filterId = null;
        }
        sheet.renderneeded = true;
      }
      break;

    case "table":
      // table create <name> <range> <hasHeader:0/1> <style> <withFilter:0/1>
      // table delete <name>
      // table style <name> <style>
      // table range <name> <range>
      what = cmd.NextToken();
      name = SocialCalc.SanitizeTableName(cmd.NextToken());
      rest = cmd.RestOfString();
      if (name == "") break;

      if (what == "create") {
        var tParts = rest.split(" ");
        var tRange = (tParts[0] || "").toUpperCase();
        var tHasHeader = tParts[1] == "1";
        var tStyle = tParts[2] || "none";
        var tWithFilter = tParts[3] == "1";
        if (!tRange) break;
        if (sheet.tables[name]) break; // names must be unique
        if (saveundo) changes.AddUndo("table delete " + name);
        var tFilterId: string | null = null;
        if (tHasHeader && tWithFilter) {
          tFilterId = "table:" + name;
          sheet.autofilters[tFilterId] = { id: tFilterId, range: tRange, criteria: {} };
        }
        sheet.tables[name] = {
          name: name,
          range: tRange,
          hasHeader: tHasHeader,
          style: tStyle,
          filterId: tFilterId,
        };
        SocialCalc.RecomputeAutoFilters(sheet);
        sheet.renderneeded = true;
      } else if (what == "delete") {
        if (!sheet.tables[name]) break;
        var tOld = sheet.tables[name];
        if (saveundo) {
          changes.AddUndo(
            "table create " +
              name +
              " " +
              tOld.range +
              " " +
              (tOld.hasHeader ? "1" : "0") +
              " " +
              tOld.style +
              " " +
              (tOld.filterId ? "1" : "0"),
          );
        }
        if (tOld.filterId && sheet.autofilters[tOld.filterId]) {
          var tOwnedRows = sheet.autofilters[tOld.filterId].ownedRows || {};
          for (var tOwnedRowKey in tOwnedRows) {
            var tOwnedRow = Number(tOwnedRowKey);
            if (sheet.rowattribs.filterhide[tOwnedRow] == "yes") {
              delete sheet.rowattribs.filterhide[tOwnedRow];
            }
          }
          delete sheet.autofilters[tOld.filterId];
        }
        delete sheet.tables[name];
        sheet.renderneeded = true;
      } else if (what == "style") {
        if (!sheet.tables[name]) break;
        if (saveundo) changes.AddUndo("table style " + name + " " + sheet.tables[name].style);
        sheet.tables[name].style = rest || "none";
        sheet.renderneeded = true;
      } else if (what == "range") {
        if (!sheet.tables[name]) break;
        var tNewRange = rest.toUpperCase();
        if (!tNewRange) break;
        if (saveundo) changes.AddUndo("table range " + name + " " + sheet.tables[name].range);
        sheet.tables[name].range = tNewRange;
        if (sheet.tables[name].filterId && sheet.autofilters[sheet.tables[name].filterId]) {
          if (saveundo) {
            changes.AddUndo(
              "autofilter attach " +
                sheet.tables[name].filterId +
                " " +
                sheet.autofilters[sheet.tables[name].filterId].range,
            );
          }
          sheet.autofilters[sheet.tables[name].filterId].range = tNewRange;
          SocialCalc.RecomputeAutoFilters(sheet);
        }
        sheet.renderneeded = true;
      }
      break;

    case "name":
      what = cmd.NextToken();
      name = cmd.NextToken();
      rest = cmd.RestOfString();

      name = name.toUpperCase().replace(/[^A-Z0-9_.]/g, "");
      if (name == "") break; // must have something

      if (what == "define") {
        if (rest == "") break; // must have something
        if (sheet.names[name]) {
          // already exists
          if (saveundo) changes.AddUndo("name define " + name + " " + sheet.names[name].definition);
          sheet.names[name].definition = rest;
        } else {
          // new
          if (saveundo) changes.AddUndo("name delete " + name);
          sheet.names[name] = { definition: rest, desc: "" };
        }
      } else if (what == "desc") {
        if (sheet.names[name]) {
          // must already exist
          if (saveundo) changes.AddUndo("name desc " + name + " " + sheet.names[name].desc);
          sheet.names[name].desc = rest;
        }
      } else if (what == "delete") {
        if (saveundo) {
          if (sheet.names[name].desc)
            changes.AddUndo("name desc " + name + " " + sheet.names[name].desc);
          changes.AddUndo("name define " + name + " " + sheet.names[name].definition);
        }
        delete sheet.names[name];
      }
      attribs.needsrecalc = "yes";

      break;
    case "protectsheet":
      sheet.renderneeded = true;
      if (saveundo) changes.AddUndo(attribs.protected == "yes" ? "protectsheet" : "unprotectsheet");
      attribs.protected = "yes";
      break;

    case "unprotectsheet":
      sheet.renderneeded = true;
      if (saveundo) changes.AddUndo(attribs.protected == "yes" ? "protectsheet" : "unprotectsheet");
      delete attribs.protected;
      break;

    case "condfmt":
      what = cmd.NextToken();
      sheet.renderneeded = true;
      sheet.changedrendervalues = true;

      if (what == "add") {
        var addId = cmd.NextToken() - 0;
        var addFields = cmd.RestOfString().split("\t");
        sheet.condfmtRules.push({
          id: addId,
          range: SocialCalc.decodeFromSave(addFields[0]),
          type: SocialCalc.decodeFromSave(addFields[1]),
          op: SocialCalc.decodeFromSave(addFields[2]),
          value1: SocialCalc.decodeFromSave(addFields[3]),
          value2: SocialCalc.decodeFromSave(addFields[4]),
          formula: SocialCalc.decodeFromSave(addFields[5]),
          stopIfTrue: addFields[6] == "1",
          style: {
            font: addFields[7] - 0,
            color: addFields[8] - 0,
            bgcolor: addFields[9] - 0,
            bt: addFields[10] - 0,
            br: addFields[11] - 0,
            bb: addFields[12] - 0,
            bl: addFields[13] - 0,
          },
        });
        if (addId >= sheet.condfmtNextId) sheet.condfmtNextId = addId + 1;
        if (saveundo) changes.AddUndo("condfmt delete " + addId);
      } else if (what == "update") {
        var updateId = cmd.NextToken() - 0;
        var updateFields = cmd.RestOfString().split("\t");
        for (i = 0; i < sheet.condfmtRules.length; i++) {
          if (sheet.condfmtRules[i].id == updateId) {
            var oldRule = sheet.condfmtRules[i];
            if (saveundo) {
              changes.AddUndo(
                "condfmt update " +
                  updateId +
                  " " +
                  [
                    SocialCalc.encodeForSave(oldRule.range),
                    SocialCalc.encodeForSave(oldRule.type),
                    SocialCalc.encodeForSave(oldRule.op),
                    SocialCalc.encodeForSave(oldRule.value1),
                    SocialCalc.encodeForSave(oldRule.value2),
                    SocialCalc.encodeForSave(oldRule.formula),
                    oldRule.stopIfTrue ? "1" : "0",
                    oldRule.style.font,
                    oldRule.style.color,
                    oldRule.style.bgcolor,
                    oldRule.style.bt,
                    oldRule.style.br,
                    oldRule.style.bb,
                    oldRule.style.bl,
                  ].join("\t"),
              );
            }
            sheet.condfmtRules[i] = {
              id: updateId,
              range: SocialCalc.decodeFromSave(updateFields[0]),
              type: SocialCalc.decodeFromSave(updateFields[1]),
              op: SocialCalc.decodeFromSave(updateFields[2]),
              value1: SocialCalc.decodeFromSave(updateFields[3]),
              value2: SocialCalc.decodeFromSave(updateFields[4]),
              formula: SocialCalc.decodeFromSave(updateFields[5]),
              stopIfTrue: updateFields[6] == "1",
              style: {
                font: updateFields[7] - 0,
                color: updateFields[8] - 0,
                bgcolor: updateFields[9] - 0,
                bt: updateFields[10] - 0,
                br: updateFields[11] - 0,
                bb: updateFields[12] - 0,
                bl: updateFields[13] - 0,
              },
            };
            break;
          }
        }
      } else if (what == "delete") {
        var deleteId = cmd.NextToken() - 0;
        for (i = 0; i < sheet.condfmtRules.length; i++) {
          if (sheet.condfmtRules[i].id == deleteId) {
            var deletedRule = sheet.condfmtRules[i];
            if (saveundo) {
              changes.AddUndo(
                "condfmt insertat " +
                  i +
                  " " +
                  deletedRule.id +
                  " " +
                  [
                    SocialCalc.encodeForSave(deletedRule.range),
                    SocialCalc.encodeForSave(deletedRule.type),
                    SocialCalc.encodeForSave(deletedRule.op),
                    SocialCalc.encodeForSave(deletedRule.value1),
                    SocialCalc.encodeForSave(deletedRule.value2),
                    SocialCalc.encodeForSave(deletedRule.formula),
                    deletedRule.stopIfTrue ? "1" : "0",
                    deletedRule.style.font,
                    deletedRule.style.color,
                    deletedRule.style.bgcolor,
                    deletedRule.style.bt,
                    deletedRule.style.br,
                    deletedRule.style.bb,
                    deletedRule.style.bl,
                  ].join("\t"),
              );
            }
            sheet.condfmtRules.splice(i, 1);
            break;
          }
        }
      } else if (what == "insertat") {
        var atIndex = cmd.NextToken() - 0;
        var insertId = cmd.NextToken() - 0;
        var insertFields = cmd.RestOfString().split("\t");
        sheet.condfmtRules.splice(atIndex, 0, {
          id: insertId,
          range: SocialCalc.decodeFromSave(insertFields[0]),
          type: SocialCalc.decodeFromSave(insertFields[1]),
          op: SocialCalc.decodeFromSave(insertFields[2]),
          value1: SocialCalc.decodeFromSave(insertFields[3]),
          value2: SocialCalc.decodeFromSave(insertFields[4]),
          formula: SocialCalc.decodeFromSave(insertFields[5]),
          stopIfTrue: insertFields[6] == "1",
          style: {
            font: insertFields[7] - 0,
            color: insertFields[8] - 0,
            bgcolor: insertFields[9] - 0,
            bt: insertFields[10] - 0,
            br: insertFields[11] - 0,
            bb: insertFields[12] - 0,
            bl: insertFields[13] - 0,
          },
        });
        if (insertId >= sheet.condfmtNextId) sheet.condfmtNextId = insertId + 1;
        if (saveundo) changes.AddUndo("condfmt delete " + insertId);
      } else if (what == "move") {
        var moveId = cmd.NextToken() - 0;
        var direction = cmd.NextToken();
        var moveIndex = -1;
        for (i = 0; i < sheet.condfmtRules.length; i++) {
          if (sheet.condfmtRules[i].id == moveId) {
            moveIndex = i;
            break;
          }
        }
        if (moveIndex >= 0) {
          var swapWith = direction == "up" ? moveIndex - 1 : moveIndex + 1;
          if (swapWith >= 0 && swapWith < sheet.condfmtRules.length) {
            var tmpRule = sheet.condfmtRules[moveIndex];
            sheet.condfmtRules[moveIndex] = sheet.condfmtRules[swapWith];
            sheet.condfmtRules[swapWith] = tmpRule;
            if (saveundo) {
              changes.AddUndo("condfmt move " + moveId + " " + (direction == "up" ? "down" : "up"));
            }
          }
        }
      }
      attribs.needsrecalc = "yes";
      break;

    // chart create id anchorcoord widthpx heightpx charttype seriesinrows sourceranges
    //   (sourceranges is one or more A1 ranges joined by "|", whole rest encoded)
    // chart delete id
    // chart move id anchorcoord
    // chart resize id widthpx heightpx
    // chart set id attrname value  (attrname: title/hastitle/haslegend/legendposition/
    //   xaxislabel/yaxislabel/charttype/seriesinrows/sourceranges; value encoded)
    case "chart":
      what = cmd.NextToken();
      name = cmd.NextToken(); // chart id
      sheet.renderneeded = true;

      if (what == "create") {
        var anchorTok = cmd.NextToken();
        var widthTok = cmd.NextToken();
        var heightTok = cmd.NextToken();
        var typeTok = cmd.NextToken();
        var seriesInRowsTok = cmd.NextToken();
        rest = cmd.RestOfString(); // sourceranges, "|"-joined A1 ranges
        var newChart = new SocialCalc.ChartObject(name);
        newChart.anchorcoord = anchorTok || "A1";
        newChart.widthpx = SocialCalc.Chart.ClampDimension(+widthTok || 480);
        newChart.heightpx = SocialCalc.Chart.ClampDimension(+heightTok || 320);
        newChart.charttype = SocialCalc.Chart.IsValidChartType(+typeTok)
          ? +typeTok
          : SocialCalc.Chart.TYPE_COLUMN;
        newChart.seriesinrows = seriesInRowsTok == "1";
        newChart.sourceranges = rest ? rest.split("|") : [];
        sheet.charts[name] = newChart;
        if (saveundo) changes.AddUndo("chart delete " + name);
      } else if (what == "delete") {
        cell = sheet.charts[name];
        if (cell) {
          if (saveundo) {
            changes.AddUndo(
              "chart set " + name + " yaxislabel " + SocialCalc.encodeForSave(cell.yaxislabel),
            );
            changes.AddUndo(
              "chart set " + name + " xaxislabel " + SocialCalc.encodeForSave(cell.xaxislabel),
            );
            changes.AddUndo(
              "chart set " +
                name +
                " legendposition " +
                SocialCalc.encodeForSave(cell.legendposition),
            );
            changes.AddUndo("chart set " + name + " haslegend " + (cell.haslegend ? "1" : "0"));
            changes.AddUndo("chart set " + name + " hastitle " + (cell.hastitle ? "1" : "0"));
            changes.AddUndo("chart set " + name + " title " + SocialCalc.encodeForSave(cell.title));
            changes.AddUndo(
              "chart create " +
                name +
                " " +
                cell.anchorcoord +
                " " +
                cell.widthpx +
                " " +
                cell.heightpx +
                " " +
                cell.charttype +
                " " +
                (cell.seriesinrows ? "1" : "0") +
                " " +
                cell.sourceranges.join("|"),
            );
          }
          delete sheet.charts[name];
        }
      } else if (what == "move") {
        rest = cmd.RestOfString();
        cell = sheet.charts[name];
        if (cell) {
          if (saveundo) changes.AddUndo("chart move " + name + " " + cell.anchorcoord);
          cell.anchorcoord = rest;
        }
      } else if (what == "resize") {
        rest = cmd.RestOfString();
        cell = sheet.charts[name];
        if (cell) {
          if (saveundo)
            changes.AddUndo("chart resize " + name + " " + cell.widthpx + " " + cell.heightpx);
          var sizeParts = rest.split(" ");
          cell.widthpx = SocialCalc.Chart.ClampDimension(+sizeParts[0] || cell.widthpx);
          cell.heightpx = SocialCalc.Chart.ClampDimension(+sizeParts[1] || cell.heightpx);
        }
      } else if (what == "set") {
        attrib = cmd.NextToken();
        val = SocialCalc.decodeFromSave(cmd.RestOfString());
        cell = sheet.charts[name];
        if (cell) {
          switch (attrib) {
            case "title":
              if (saveundo)
                changes.AddUndo(
                  "chart set " + name + " title " + SocialCalc.encodeForSave(cell.title),
                );
              cell.title = SocialCalc.Chart.SanitizeLabel(val, 120);
              break;
            case "hastitle":
              if (saveundo)
                changes.AddUndo("chart set " + name + " hastitle " + (cell.hastitle ? "1" : "0"));
              cell.hastitle = val == "1";
              break;
            case "haslegend":
              if (saveundo)
                changes.AddUndo("chart set " + name + " haslegend " + (cell.haslegend ? "1" : "0"));
              cell.haslegend = val == "1";
              break;
            case "legendposition":
              if (saveundo)
                changes.AddUndo(
                  "chart set " +
                    name +
                    " legendposition " +
                    SocialCalc.encodeForSave(cell.legendposition),
                );
              cell.legendposition = /^(right|bottom|none)$/.test(val) ? val : "right";
              break;
            case "xaxislabel":
              if (saveundo)
                changes.AddUndo(
                  "chart set " + name + " xaxislabel " + SocialCalc.encodeForSave(cell.xaxislabel),
                );
              cell.xaxislabel = SocialCalc.Chart.SanitizeLabel(val, 60);
              break;
            case "yaxislabel":
              if (saveundo)
                changes.AddUndo(
                  "chart set " + name + " yaxislabel " + SocialCalc.encodeForSave(cell.yaxislabel),
                );
              cell.yaxislabel = SocialCalc.Chart.SanitizeLabel(val, 60);
              break;
            case "charttype":
              if (saveundo) changes.AddUndo("chart set " + name + " charttype " + cell.charttype);
              if (SocialCalc.Chart.IsValidChartType(+val)) cell.charttype = +val;
              break;
            case "seriesinrows":
              if (saveundo)
                changes.AddUndo(
                  "chart set " + name + " seriesinrows " + (cell.seriesinrows ? "1" : "0"),
                );
              cell.seriesinrows = val == "1";
              break;
            case "sourceranges":
              if (saveundo)
                changes.AddUndo(
                  "chart set " +
                    name +
                    " sourceranges " +
                    SocialCalc.encodeForSave(cell.sourceranges.join("|")),
                );
              cell.sourceranges = val ? val.split("|") : [];
              break;
            default:
              errortext = scc.s_escUnknownSetCoordCmd + cmdstr;
          }
        }
      }
      break;

    case "recalc":
      attribs.needsrecalc = "yes"; // request recalc
      sheet.recalconce = true; // even if turned off
      break;

    case "redisplay":
      sheet.renderneeded = true;
      break;

    case "changedrendervalues": // needed for undo sometimes
      sheet.changedrendervalues = true;
      break;

    case "pane":
      name = cmd.NextToken().toUpperCase();
      undoNum = 1;
      editor = (SocialCalc.GetSpreadsheetControlObject() as any).editor;

      if (name.toUpperCase() === "ROW") {
        row = parseInt(cmd.NextToken(), 10);

        if (
          typeof editor.context.rowpanes[1] !== "undefined" &&
          typeof editor.context.rowpanes[1].first === "number"
        ) {
          undoNum = editor.context.rowpanes[1].first;
        }
        if (saveundo) changes.AddUndo("pane row " + undoNum);

        // Handle hidden row.
        while (SocialCalc.RowEffectivelyHidden(editor.context.sheetobj, row)) {
          row++;
        }

        if (
          (!row || row <= editor.context.rowpanes[0].first) &&
          editor.context.rowpanes.length > 1
        ) {
          // set to no panes, leaving first pane settings
          editor.context.rowpanes.length = 1;
        } else if (editor.context.rowpanes.length - 1 && !editor.timeout) {
          // has 2 already
          // not waiting for position calc (so positions could be wrong)
          editor.context.SetRowPaneFirstLast(0, editor.context.rowpanes[0].first, row - 1);
          editor.context.SetRowPaneFirstLast(1, row, row);
        } else {
          editor.context.SetRowPaneFirstLast(0, editor.context.rowpanes[0].first, row - 1);
          editor.context.SetRowPaneFirstLast(1, row, row);
        }

        // remove tracklingine
        if (editor.griddiv) {
          //trackingline-horizon
          trackLine = document.getElementById("trackingline-vertical");
          if (trackLine) {
            editor.griddiv.removeChild(trackLine);
            editor.FitToEditTable();
          }
        }
      } else {
        col = parseInt(cmd.NextToken(), 10);

        if (
          typeof editor.context.colpanes[1] !== "undefined" &&
          typeof editor.context.colpanes[1].first === "number"
        ) {
          undoNum = editor.context.colpanes[1].first;
        }
        if (saveundo) changes.AddUndo("pane col " + undoNum);

        // Handle hidden column.
        while (editor.context.sheetobj.colattribs.hide[SocialCalc.rcColname(col)] == "yes") {
          col++;
        }

        if (
          (!col || col <= editor.context.colpanes[0].first) &&
          editor.context.colpanes.length > 1
        ) {
          // set to no panes, leaving first pane settings
          editor.context.colpanes.length = 1;
        } else if (editor.context.colpanes.length - 1 && !editor.timeout) {
          // has 2 already
          // not waiting for position calc (so positions could be wrong)
          editor.context.SetColPaneFirstLast(0, editor.context.colpanes[0].first, col - 1);
          editor.context.SetColPaneFirstLast(1, col, col);
        } else {
          editor.context.SetColPaneFirstLast(0, editor.context.colpanes[0].first, col - 1);
          editor.context.SetColPaneFirstLast(1, col, col);
        }

        // remove tracklingine
        if (editor.griddiv) {
          trackLine = document.getElementById("trackingline-horizon");
          if (trackLine) {
            editor.griddiv.removeChild(trackLine);
            editor.FitToEditTable();
          }
        }
      }

      sheet.renderneeded = true;

      break;

    case "startcmdextension": // startcmdextension extension rest-of-command
      name = cmd.NextToken();
      cmdextension = sheet.sci.CmdExtensionCallbacks[name];
      if (cmdextension) {
        cmdextension.func(name, cmdextension.data, sheet, cmd, saveundo);
      }
      break;

    // eddy ExecuteSheetCommand {
    //      case "setemailparameters":
    //    	  break;

    case "settimetrigger":
    case "sendemail":
    case "submitform":
      // email/form/timetrigger handled by server, so ignore here
      break;
    // } eddy ExecuteSheetCommand

    default:
      errortext = scc.s_escUnknownCmd + cmdstr;
      break;
  }

  /* For Debugging:
var ustack="";
for (var i=0;i<sheet.changes.stack.length;i++) {
   ustack+=(i-0)+":"+sheet.changes.stack[i].command[0]+" of "+sheet.changes.stack[i].command.length+"/"+sheet.changes.stack[i].undo[0]+" of "+sheet.changes.stack[i].undo.length+",";
   }
alert(cmdstr+"|"+sheet.changes.stack.length+"--"+ustack);
*/
  if (SocialCalc._app) {
    // widgets need focus. In app mode, render widgets only when required. Rather than default of render everything
    if (cellChanged) {
      if (
        sheet.renderneeded == true &&
        attrib != "value" &&
        attrib != "text" &&
        attrib != "formula" &&
        attrib != "constant" &&
        attrib != "empty"
      )
        sheet.widgetsClean = false; // force widgets to render
      else if (attrib == "all") sheet.widgetsClean = false; // force widgets to render - because of undo
    } else {
      if (sheet.renderneeded == true) sheet.widgetsClean = false; // force widgets to render
    }
  }

  return errortext;
};

/** @param {any} sheet */
SC.SheetUndo = function (sheet: any) {
  var i;
  var tos = sheet.changes.TOS();
  var lastone = tos ? tos.undo.length - 1 : -1;
  var cmdstr = "";

  for (i = lastone; i >= 0; i--) {
    // do them backwards
    if (cmdstr) cmdstr += "\n"; // concatenate with separate lines
    cmdstr += tos.undo[i];
  }
  sheet.changes.Undo();
  sheet.ScheduleSheetCommands(cmdstr, false); // do undo operations
};

/** @param {any} sheet */
SC.SheetRedo = function (sheet: any) {
  var tos, i;
  var didredo = sheet.changes.Redo();
  if (!didredo) {
    sheet.ScheduleSheetCommands("", false); // schedule doing nothing
    return;
  }
  tos = sheet.changes.TOS();
  var cmdstr = "";

  for (i = 0; tos && i < tos.command.length; i++) {
    if (cmdstr) cmdstr += "\n"; // concatenate with separate lines
    cmdstr += tos.command[i];
  }
  sheet.ScheduleSheetCommands(cmdstr, false); // do undo operations
};

/** @param {any} sheet */
SC.CreateAuditString = function (sheet: any) {
  var i, j;
  var result = "";
  var stack = sheet.changes.stack;
  var tos = sheet.changes.tos;
  for (i = 0; i <= tos; i++) {
    for (j = 0; j < stack[i].command.length; j++) {
      result += stack[i].command[j] + "\n";
    }
  }

  return result;
};

/** @param {any} sheet @param {any} atype @param {any} style */
SC.GetStyleNum = function (sheet: any, atype: any, style: any) {
  var num;

  if (style.length == 0) return 0; // null means use zero, which means default or global default

  num = sheet[atype + "hash"][style];
  if (!num) {
    if (sheet[atype + "s"].length < 1) sheet[atype + "s"].push("");
    num = sheet[atype + "s"].push(style) - 1;
    sheet[atype + "hash"][style] = num;
    sheet.changedrendervalues = true;
  }
  return num;
};

/** @param {any} sheet @param {any} atype @param {any} num */
SC.GetStyleString = function (sheet: any, atype: any, num: any) {
  if (!num) return null; // zero, null, and undefined return null

  return sheet[atype + "s"][num];
};

// ************************
//
// Conditional formatting
//
// ************************
//
// sheet.condfmtRules: ordered array (index 0 = highest priority) of:
//   {id, range, type, op, value1, value2, formula, stopIfTrue, style}
// type: "cellis" | "textcontains" | "textbegins" | "textends" | "blank" |
//       "nonblank" | "duplicate" | "unique" | "formula"
// op (cellis only): "gt"|"ge"|"lt"|"le"|"eq"|"ne"|"between"
// style: {font,color,bgcolor,bt,br,bb,bl} - each a palette index (0 = unset)
//
// Evaluation order/precedence mirrors lemma/condfmt.ts exactly (rule 0 is
// highest priority; a matched stopIfTrue rule halts the scan; unset style
// fields fall through to later, lower-priority matching rules).

/** @param {string} range @param {any} col @param {any} row */
SC.CondFmtCoordInRange = function (range: any, col: any, row: any) {
  // ParseRange never throws (it clamps malformed input to degenerate
  // col=0/negative-row bounds), so a bad range naturally fails the bounds
  // check below rather than needing a try/catch.
  var parsed = SocialCalc.ParseRange(range);
  return (
    col >= parsed.cr1.col && col <= parsed.cr2.col && row >= parsed.cr1.row && row <= parsed.cr2.row
  );
};

// Cache of coord -> occurrence count, keyed by range text, rebuilt lazily
// whenever sheet.condfmtValueVersion or sheet.condfmtRulesVersion changes.
// Avoids re-scanning a range's cells for every candidate cell during a
// full-sheet render (duplicate/unique rule types would otherwise be O(n^2)
// over the range).
/** @param {any} sheet @param {string} range */
SC.CondFmtValueCounts = function (sheet: any, range: any) {
  sheet.condfmtCountsCache = sheet.condfmtCountsCache || {};
  if (sheet.condfmtCountsCache.key !== sheet.condfmtValueVersion) {
    sheet.condfmtCountsCache = { key: sheet.condfmtValueVersion, map: {} };
  }
  if (!sheet.condfmtCountsCache.map[range]) {
    // ParseRange never throws (it clamps malformed input to degenerate
    // col=0/negative-row bounds); an empty result for those ranges falls
    // naturally out of the loop below never executing, so no try/catch
    // is needed here.
    var parsed = SocialCalc.ParseRange(range);
    var counts = new Map();
    for (var r = parsed.cr1.row; r <= parsed.cr2.row; r++) {
      for (var c = parsed.cr1.col; c <= parsed.cr2.col; c++) {
        var rcoord = SocialCalc.crToCoord(c, r);
        var rcell = sheet.cells[rcoord];
        if (!rcell || !rcell.valuetype || rcell.valuetype.charAt(0) == "b") continue;
        var key = rcell.valuetype.charAt(0) + ":" + rcell.datavalue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    sheet.condfmtCountsCache.map[range] = counts;
  }
  return sheet.condfmtCountsCache.map[range];
};

// Three-way compare for cell-is comparisons: numeric compare when both sides
// parse as numbers, else lexical string compare (mirrors TestCriteria's
// numeric-vs-text handling in js/formula1.ts).
/** @param {any} value @param {any} operand */
SC.CondFmtCompare = function (value: any, operand: any) {
  var nv = SocialCalc.DetermineValueType(value);
  var no = SocialCalc.DetermineValueType(operand);
  if (nv.type.charAt(0) == "n" && no.type.charAt(0) == "n") {
    var a = (nv.value as any) - 0;
    var b = (no.value as any) - 0;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  var sa = "" + value;
  var sb = "" + operand;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
};

// Evaluates a single rule's match predicate against one cell. Returns
// boolean. Uses SocialCalc.Formula.TestCriteria's comparator conventions and
// SocialCalc.condfmt (lemma/condfmt.ts port) for the closed-form op decision.
/** @param {any} sheet @param {any} rule @param {any} cell @param {string} coord */
SC.CondFmtRuleMatches = function (sheet: any, rule: any, cell: any, coord: any) {
  var vt = (cell && cell.valuetype) || "b";
  var isBlank = vt.charAt(0) == "b";
  var dv = cell ? cell.datavalue : "";

  switch (rule.type) {
    case "blank":
      return isBlank;
    case "nonblank":
      return !isBlank;
    case "duplicate":
    case "unique": {
      if (isBlank) return false;
      var counts = SocialCalc.CondFmtValueCounts(sheet, rule.range);
      var key = vt.charAt(0) + ":" + dv;
      var count = counts.get(key) || 0;
      return rule.type == "duplicate" ? count > 1 : count === 1;
    }
    case "textcontains":
    case "textbegins":
    case "textends": {
      if (isBlank) return false;
      var text = "" + dv;
      var needle = "" + rule.value1;
      if (rule.type == "textcontains") return text.indexOf(needle) != -1;
      if (rule.type == "textbegins") return text.indexOf(needle) === 0;
      return needle.length <= text.length && text.slice(text.length - needle.length) == needle;
    }
    case "cellis": {
      if (isBlank) return false;
      if (rule.op == "between") {
        var cmpLow = SocialCalc.CondFmtCompare(dv, rule.value1);
        var cmpHigh = SocialCalc.CondFmtCompare(dv, rule.value2);
        return cmpLow >= 0 && cmpHigh <= 0;
      }
      var cmp = SocialCalc.CondFmtCompare(dv, rule.value1);
      var opCode =
        rule.op == "gt"
          ? 0
          : rule.op == "ge"
            ? 1
            : rule.op == "lt"
              ? 2
              : rule.op == "le"
                ? 3
                : rule.op == "eq"
                  ? 4
                  : rule.op == "ne"
                    ? 5
                    : -1;
      if (opCode === 0) return cmp > 0;
      if (opCode === 1) return cmp >= 0;
      if (opCode === 2) return cmp < 0;
      if (opCode === 3) return cmp <= 0;
      if (opCode === 4) return cmp === 0;
      if (opCode === 5) return cmp !== 0;
      return false;
    }
    case "formula": {
      if (!rule.formula) return false;
      try {
        var anchor = SocialCalc.ParseRange(rule.range).cr1;
        var target = SocialCalc.coordToCr(coord);
        var relFormula = SocialCalc.OffsetFormulaCoords(
          rule.formula,
          target.col - anchor.col,
          target.row - anchor.row,
        );
        var parseinfo = SocialCalc.Formula.ParseFormulaIntoTokens(relFormula);
        var eresult = SocialCalc.Formula.evaluate_parsed_formula(parseinfo, sheet, false);
        if (eresult.type && eresult.type.charAt(0) == "e") return false;
        return (
          eresult.value === true ||
          eresult.value === 1 ||
          eresult.value === "TRUE" ||
          eresult.value === "true"
        );
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
};

// Full evaluation of all applicable condfmt rules for one cell, folding in
// priority order per lemma/condfmt.ts (foldCondFmtRule): a matched
// stopIfTrue rule halts the scan; every applicable rule (reached and
// matched) contributes any style field a higher-priority applicable rule
// left unset. Returns {font,color,bgcolor,bt,br,bb,bl} with 0 meaning unset,
// or null when no rule applies at all (fast path for the common case).
/** @param {any} sheet @param {string} coord */
SC.EvaluateCondFmtForCell = function (sheet: any, coord: any) {
  var rules = sheet.condfmtRules;
  if (!rules || rules.length === 0) return null;

  var cr = SocialCalc.coordToCr(coord);
  var cell = sheet.cells[coord];

  var style: any = { font: 0, color: 0, bgcolor: 0, bt: 0, br: 0, bb: 0, bl: 0 };
  var any_applied = false;
  var stopped = false;

  for (var i = 0; i < rules.length; i++) {
    if (stopped) break;
    var rule = rules[i];
    if (!SocialCalc.CondFmtCoordInRange(rule.range, cr.col, cr.row)) continue;
    var matched = SocialCalc.CondFmtRuleMatches(sheet, rule, cell, coord);
    if (matched) {
      any_applied = true;
      var rstyle = rule.style;
      if (!style.font && rstyle.font) style.font = rstyle.font;
      if (!style.color && rstyle.color) style.color = rstyle.color;
      if (!style.bgcolor && rstyle.bgcolor) style.bgcolor = rstyle.bgcolor;
      if (!style.bt && rstyle.bt) style.bt = rstyle.bt;
      if (!style.br && rstyle.br) style.br = rstyle.br;
      if (!style.bb && rstyle.bb) style.bb = rstyle.bb;
      if (!style.bl && rstyle.bl) style.bl = rstyle.bl;
      if (rule.stopIfTrue) stopped = true;
    }
  }

  return any_applied ? style : null;
};

// Formula-reference rewrite helpers live in js/formula-ref.ts
// (concatenated after formula1; single shipping oracle).

// ************************
//
// Recalc Loop Code
//
// ************************

//
// How recalc works:
//
// !!!!!!!!!!!!!!
//

// SocialCalc.RecalcInfo - object with global recalc info

SC.RecalcInfo = {
  sheet: null, // which sheet is being recalced

  currentState: 0, // current state
  state: { idle: 0, start_calc: 1, order: 2, calc: 3, start_wait: 4, done_wait: 5 }, // allowed state values

  recalctimer: null, // value to cancel timer
  maxtimeslice: 100, // maximum milliseconds per slice of recalc time before a wait
  timeslicedelay: 1, // milliseconds to wait between recalc time slices
  starttime: 0, // when recalc started

  queue: [], // queue of sheet waiting to be recalced

  // LoadSheet: a function that returns true if started a load or false if not.
  //

  /** @param {any} _sheetname */
  LoadSheet: function (_sheetname: any) {
    return false;
  }, // default returns not found
};

// SocialCalc.RecalcData - object with recalc info while determining recalc order and afterward

SC.RecalcData = function () {
  // initialize a RecalcData object

  this.inrecalc = true; // if true, doing a recalc
  this.celllist = []; // list with all potential cells to calculate
  this.celllistitem = 0; // cell to check next when ordering
  this.calclist = null; // object which is the chained list of cells to calculate
  // each in the form of "coord: nextcoord"
  // e.g., if B8 is calculated right after A8, then calclist.A8=="B8"
  // if null, need to create the list
  this.calclistlength = 0; // number of items in calclist

  this.firstcalc = null; // start of the calc list - a string or null
  this.lastcalc = null; // last one on chain (used to add more to the end)

  this.nextcalc = null; // used to keep track during background recalc to make it restartable
  this.count = 0; // number calculated

  // checkinfo is used when determining calc order:

  this.checkinfo = {}; // attributes are coords; if no attrib for a coord, it wasn't checked or doesn't need it
  // values are RecalcCheckInfo objects while checking or TRUE when complete
};

// SocialCalc.RecalcCheckInfo - object that stores checking info while determining recalc order

SC.RecalcCheckInfo = function () {
  // initialize a RecalcCheckInfo object

  this.oldcoord = null; // chain back up of cells referring to cells
  this.parsepos = 0; // which token we are up to

  // range info

  this.inrange = false; // if true, in the process of checking a range of coords
  this.inrangestart = false; // if true, have not yet filled in range loop values
  this.cr1 = null; // range first coord as a cr object
  this.cr2 = null; // range second coord as a cr object
  this.c1 = null; // range extents
  this.c2 = null;
  this.r1 = null;
  this.r2 = null;
  this.c = null; // looping values
  this.r = null;
};

// Recalc the entire sheet

/** @param {any} sheet */
SC.RecalcSheet = function (sheet: any) {
  var scri = SocialCalc.RecalcInfo;

  if (scri.currentState != scri.state.idle) {
    scri.queue.push(sheet);
    return;
  }

  delete sheet.attribs.circularreferencecell; // reset recalc-wide things
  SocialCalc.Formula.FreshnessInfoReset();

  SocialCalc.RecalcClearTimeout();

  scri.sheet = sheet; // set values needed by background recalc
  scri.currentState = scri.state.start_calc;

  scri.starttime = new Date();

  if (sheet.statuscallback) {
    sheet.statuscallback(scri, "calcstart", null, sheet.statuscallbackparams);
  }

  SocialCalc.RecalcSetTimeout();
};

//
// SocialCalc.RecalcSetTimeout - set a timer for next recalc step
//

SC.RecalcSetTimeout = function () {
  var scri = SocialCalc.RecalcInfo;

  scri.recalctimer = window.setTimeout(SocialCalc.RecalcTimerRoutine, scri.timeslicedelay) as any;
};

//
// SocialCalc.RecalcClearTimeout - cancel any timeouts
//

SC.RecalcClearTimeout = function () {
  var scri = SocialCalc.RecalcInfo;

  if (scri.recalctimer) {
    window.clearTimeout(scri.recalctimer);
    scri.recalctimer = null;
  }
};

//
// SocialCalc.RecalcLoadedSheet(sheetname, str, recalcneeded, live)
//
// Called when a sheet finishes loading with name, string, and t/f whether it should be recalced.
// If loaded sheet has sheet.attribs.recalc=="off", then no recalc done.
// If sheetname is null, then the sheetname waiting for will be used.
//

/** @param {any} sheetname @param {any} str @param {any} recalcneeded @param {any} live */
SC.RecalcLoadedSheet = function (sheetname: any, str: any, recalcneeded: any, live: any) {
  var sheet;
  var scri = SocialCalc.RecalcInfo;
  var scf = SocialCalc.Formula;

  // sheetname (or the cached waitingForLoading name) may legitimately be
  // absent - e.g. a start_wait tick firing with no host LoadSheet callback
  // and nothing actually queued. Do not coerce a missing name into "" and
  // hand it to NormalizeSheetName/AddSheetToCache (that would either throw
  // on null or silently cache a bogus ""-named sheet); just skip loading.
  var effectiveSheetName = sheetname || scf.SheetCache.waitingForLoading;

  if (effectiveSheetName) {
    sheet = SocialCalc.Formula.AddSheetToCache(effectiveSheetName, str, live);

    if (recalcneeded && sheet && sheet.attribs.recalc != "off") {
      // if recalcneeded, and not manual sheet, chain in this new sheet to recalc loop
      sheet.previousrecalcsheet = scri.sheet;
      scri.sheet = sheet;
      scri.currentState = scri.state.start_calc;
    }
  }
  scf.SheetCache.waitingForLoading = null;

  SocialCalc.RecalcSetTimeout();
};

//
// SocialCalc.RecalcTimerRoutine - handles the actual order determination and cell-by-cell recalculation in the background
//

SC.RecalcTimerRoutine = function () {
  var eresult, cell, coord, status;
  var starttime = new Date();
  var count = 0;
  var scf = SocialCalc.Formula;
  // !scf defensive guard removed — always present in the bundled build.
  var scri = SocialCalc.RecalcInfo;
  var sheet = scri.sheet as any;
  if (!sheet) {
    return;
  }
  var recalcdata = sheet.recalcdata || (sheet.recalcdata = {});

  /** @param {any} status @param {any} arg */
  var do_statuscallback = function (status: any, arg: any) {
    // routine to do callback if required
    if (sheet.statuscallback) {
      sheet.statuscallback(recalcdata, status, arg, sheet.statuscallbackparams);
    }
  };

  SocialCalc.RecalcClearTimeout();

  if (scri.currentState == scri.state.start_calc) {
    recalcdata = new SocialCalc.RecalcData();
    sheet.recalcdata = recalcdata;
    sheet.hasDynamicRef = false; // INDIRECT/OFFSET set this true while evaluating

    for (coord in sheet.cells) {
      // get list of cells to check for order
      if (!coord) continue;
      recalcdata.celllist.push(coord);
    }

    recalcdata.calclist = {}; // start with empty list
    scri.currentState = scri.state.order; // drop through to determining recalc order
  }

  if (scri.currentState == scri.state.order) {
    while (recalcdata.celllistitem < recalcdata.celllist.length) {
      // check all the cells to see if they should be on the list
      coord = recalcdata.celllist[recalcdata.celllistitem++];
      SocialCalc.RecalcCheckCell(sheet, coord);
      if (Date.now() - starttime.getTime() >= scri.maxtimeslice) {
        // if taking too long, give up CPU for a while
        do_statuscallback("calcorder", {
          coord: coord,
          total: recalcdata.celllist.length,
          count: recalcdata.celllistitem,
        });
        SocialCalc.RecalcSetTimeout();
        return;
      }
    }

    do_statuscallback("calccheckdone", recalcdata.calclistlength);

    recalcdata.nextcalc = recalcdata.firstcalc; // start at the beginning of the recalc chain
    scri.currentState = scri.state.calc; // loop through cells on next timer call
    SocialCalc.RecalcSetTimeout();
    return;
  }

  if (scri.currentState == scri.state.start_wait) {
    // starting to wait for something
    scri.currentState = scri.state.done_wait; // finished on next timer call
    if (scri.LoadSheet) {
      status = scri.LoadSheet(scf.SheetCache.waitingForLoading as any);
      if (status) {
        // started a load operation
        return;
      }
    }
    SocialCalc.RecalcLoadedSheet(null, "", false);
    return;
  }

  if (scri.currentState == scri.state.done_wait) {
    scri.currentState = scri.state.calc; // loop through cells on next timer call
    SocialCalc.RecalcSetTimeout();
    return;
  }
  // otherwise should be scri.state.calc
  coord = sheet.recalcdata.nextcalc;
  while (coord) {
    cell = sheet.cells[coord] as any;
    cell.parseinfo.coord = coord;
    eresult = scf.evaluate_parsed_formula(cell.parseinfo, sheet, false);
    if (eresult.type === "lambda") {
      // A LAMBDA that reached the end of evaluation without being invoked
      // (e.g. bare `=LAMBDA(x,x+1)` in a cell, as opposed to a name
      // definition consumed only via LookupName/InvokeLambda) is not a
      // valid cell value.
      eresult = { value: 0, type: "e#VALUE!", error: "" };
    }
    if (eresult.type === "array") {
      var spillvalue = SocialCalc.MaterializeSpill(sheet, coord, eresult);
      eresult =
        spillvalue == null
          ? { value: "#SPILL!", type: "e", error: "#SPILL!" }
          : { value: spillvalue.value, type: spillvalue.type };
    } else {
      SocialCalc.ClearSpill(sheet, cell);
    }
    if (eresult.error) cell.errors = eresult.error;
    else delete cell.errors;
    if (scf.SheetCache.waitingForLoading) {
      // wait until restarted
      // schedule render to run while waiting for dependent sheet to load - schedules first render of sheet
      if (scri.firstRenderScheduled != true) {
        var editor = (SocialCalc.GetSpreadsheetControlObject() as any).editor;
        editor.ScheduleRender(false);
        scri.firstRenderScheduled = true; // stop more renders because done first render of sheet
      }
      recalcdata.nextcalc = coord; // start with this cell again
      recalcdata.count += count;
      do_statuscallback("calcloading", { sheetname: scf.SheetCache.waitingForLoading });
      scri.currentState = scri.state.start_wait; // start load on next timer call
      SocialCalc.RecalcSetTimeout();
      return;
    }

    if (scf.RemoteFunctionInfo.waitingForServer) {
      // wait until restarted
      recalcdata.nextcalc = coord; // start with this cell again
      recalcdata.count += count;
      do_statuscallback("calcserverfunc", {
        funcname: scf.RemoteFunctionInfo.waitingForServer,
        coord: coord,
        total: recalcdata.calclistlength,
        count: recalcdata.count,
      });
      scri.currentState = scri.state.done_wait; // start load on next timer call
      return; // return and wait for next recalc timer event
    }
    if (cell.datavalue != eresult.value || cell.valuetype != eresult.type) {
      cell.datavalue = eresult.value;
      cell.valuetype = eresult.type;
      delete cell.displaystring;
      sheet.recalcchangedavalue = true;
      sheet.condfmtValueVersion++; // invalidate duplicate/unique count cache
    }
    count++;
    coord = sheet.recalcdata.calclist[coord];
    if (Date.now() - starttime.getTime() >= scri.maxtimeslice) {
      recalcdata.nextcalc = coord;
      recalcdata.count += count;
      do_statuscallback("calcstep", {
        coord: coord,
        total: recalcdata.calclistlength,
        count: recalcdata.count,
      });
      SocialCalc.RecalcSetTimeout();
      return;
    }
  }
  if (sheet.spillTopologyChanged && !sheet.spillTopologyRetried) {
    sheet.spillTopologyRetried = true;
    sheet.spillTopologyChanged = false;
    delete sheet.recalcdata;
    scri.currentState = scri.state.start_calc;
    SocialCalc.RecalcSetTimeout();
    return;
  }
  sheet.spillTopologyChanged = false;
  sheet.spillTopologyRetried = false;

  // Conservative dynamic-reference dependency policy: INDIRECT/OFFSET
  // targets are not visible to RecalcCheckCell's static token walk (the
  // target coord/range is only known after evaluation), so a formula that
  // reads a cell touched earlier in this same pass by one of those
  // functions could observe a value from before that cell's own recalc.
  // Re-run the whole calc chain exactly once more whenever any INDIRECT/
  // OFFSET call fired during the pass that just finished; by the second
  // pass every statically-dependent cell already holds its final value,
  // so the retry itself cannot introduce further staleness. Bounded to one
  // retry (mirrors the spill-topology retry above) — sheets without
  // INDIRECT/OFFSET never take this branch.
  if (sheet.hasDynamicRef && !sheet.dynamicRefRetried) {
    sheet.dynamicRefRetried = true;
    sheet.hasDynamicRef = false;
    delete sheet.recalcdata;
    scri.currentState = scri.state.start_calc;
    SocialCalc.RecalcSetTimeout();
    return;
  }
  sheet.dynamicRefRetried = false;

  recalcdata.inrecalc = false;

  sheet.reRenderCellList = sheet.recalcdata.celllist; // GUI widgets need focus - if app then only re-render non-widget cells
  delete sheet.recalcdata; // save memory and clear out for name lookup formula evaluation

  delete sheet.attribs.needsrecalc; // remember recalc done

  // Recompute AutoFilter-hidden rows now that formulas/values are settled --
  // covers every path that ends in a recalc (value edits, fill, paste, sort,
  // structural edits). Idempotent (lemma/visibility.ts), so repeated calls
  // across chained/queued recalcs never drift.
  SocialCalc.RecomputeAutoFilters(sheet);

  scri.sheet = sheet.previousrecalcsheet || null; // chain back if doing recalc of loaded sheets
  if (scri.sheet) {
    scri.currentState = scri.state.calc; // start where we left off
    SocialCalc.RecalcSetTimeout();
    return;
  }

  scf.FreshnessInfo.recalc_completed = true; // say freshness info is complete
  scri.currentState = scri.state.idle; // we are idle

  do_statuscallback("calcfinished", Date.now() - (scri.starttime as Date).getTime());

  // Check queue for more sheets.
  if (scri.queue.length > 0) {
    sheet = scri.queue.shift();
    sheet.RecalcSheet();
  }
  return;
};

//
// circref = SocialCalc.RecalcCheckCell(sheet, coord)
//
// Checks cell to put on calclist, looking at parsed tokens.
// Also checks cells this cell is dependent upon
// if it contains a formula with cell references.
// If circular reference, returns non-null.
//

/** @param {any} sheet @param {any} startcoord */
SC.RecalcCheckCell = function (sheet: any, startcoord: any) {
  var parseinfo, ttext, ttype, i, rangecoord, value, pos, pos2, cell, coordvals;
  var scf = SocialCalc.Formula;
  // The !scf defensive guard was removed — formula1.js is always
  // concatenated into the bundle, so SocialCalc.Formula is guaranteed.
  var tokentype = scf.TokenType;
  var token_op = tokentype.op;
  var token_name = tokentype.name;
  var token_coord = tokentype.coord;

  var recalcdata = sheet.recalcdata;
  var checkinfo = recalcdata.checkinfo;

  var sheetref = false; // if true, a sheet reference is in effect, so don't check that
  var oldcoord = null; // coord of formula that referred to this one when checking down the tree
  var coord = startcoord; // the coord of the cell we are checking

  // Start with requested cell, and then continue down or up the dependency tree
  // oldcoord (and checkinfo[coord].oldcoord) maintains the reference stack during the tree walk
  // checkinfo[coord] maintains the stack of checking looping values, e.g., token number being checked

  mainloop: while (coord) {
    cell = sheet.cells[coord];
    coordvals = checkinfo[coord];

    if (
      !cell ||
      cell.datatype != "f" || // Don't calculate if not a formula
      (coordvals && typeof coordvals != "object")
    ) {
      // Don't calc if already calculated
      coord = oldcoord; // go back up dependency tree to coord that referred to us
      if (checkinfo[coord]) oldcoord = checkinfo[coord].oldcoord;
      continue;
    }

    if (!coordvals) {
      // do we have checking information about this cell?
      coordvals = new SocialCalc.RecalcCheckInfo(); // no - make a place to hold it
      checkinfo[coord] = coordvals;
    }

    if (cell.errors) {
      // delete errors from previous recalcs
      delete cell.errors;
    }

    if (!cell.parseinfo) {
      // cache parsed formula
      cell.parseinfo = scf.ParseFormulaIntoTokens(cell.formula);
    }
    parseinfo = cell.parseinfo;

    for (i = coordvals.parsepos; i < parseinfo.length; i++) {
      // go through each token in formula

      if (coordvals.inrange) {
        // processing a range of coords
        if (coordvals.inrangestart) {
          // first time - fill in other values
          if (coordvals.cr1.col > coordvals.cr2.col) {
            coordvals.c1 = coordvals.cr2.col;
            coordvals.c2 = coordvals.cr1.col;
          } else {
            coordvals.c1 = coordvals.cr1.col;
            coordvals.c2 = coordvals.cr2.col;
          }
          coordvals.c = coordvals.c1 - 1; // start one before

          if (coordvals.cr1.row > coordvals.cr2.row) {
            coordvals.r1 = coordvals.cr2.row;
            coordvals.r2 = coordvals.cr1.row;
          } else {
            coordvals.r1 = coordvals.cr1.row;
            coordvals.r2 = coordvals.cr2.row;
          }
          coordvals.r = coordvals.r1; // start on this row
          coordvals.inrangestart = false;
        } else {
          // not first time
        }
        coordvals.c += 1; // increment column
        if (coordvals.c > coordvals.c2) {
          // finished the columns of this row
          coordvals.r += 1; // increment row
          if (coordvals.r > coordvals.r2) {
            // finished checking the entire range
            coordvals.inrange = false;
            continue;
          }
          coordvals.c = coordvals.c1; // start at the beginning of next row
        }
        rangecoord = SocialCalc.crToCoord(coordvals.c, coordvals.r);
        rangecoord = SocialCalc.SpillOwnerForCoord(sheet, rangecoord);

        // now check that one

        coordvals.parsepos = i; // remember our position
        coordvals.oldcoord = oldcoord; // remember back up chain
        oldcoord = coord; // come back to us
        coord = rangecoord;
        if (checkinfo[coord] && typeof checkinfo[coord] == "object") {
          // Circular reference
          cell.errors = SocialCalc.Constants.s_caccCircRef + startcoord; // set on original cell making the ref
          checkinfo[startcoord] = true; // this one should be calculated once at this point
          if (!recalcdata.firstcalc) recalcdata.firstcalc = startcoord;
          else recalcdata.calclist[recalcdata.lastcalc] = startcoord;
          recalcdata.lastcalc = startcoord;
          recalcdata.calclistlength++; // count number on list
          sheet.attribs.circularreferencecell = coord + "|" + oldcoord; // remember at least one circ ref
          return cell.errors;
        }
        continue mainloop;
      }

      ttype = parseinfo[i].type; // get token details
      ttext = parseinfo[i].text;
      if (ttype == token_op) {
        // references with sheet specifier are not checked
        if (ttext == "!") {
          sheetref = true; // found a sheet reference
        } else if (ttext != ":") {
          // for everything but a range, reset
          sheetref = false;
        }
      }

      if (ttype == token_name) {
        // look for named range
        value = scf.LookupName(sheet, ttext);
        if (value.type == "range") {
          // range name is always "UL|LR|"
          pos = value.value.indexOf("|");
          coordvals.cr1 = SocialCalc.coordToCr(value.value.substring(0, pos));
          pos2 = value.value.indexOf("|", pos + 1);
          coordvals.cr2 = SocialCalc.coordToCr(value.value.substring(pos + 1, pos2));
          coordvals.inrange = true;
          coordvals.inrangestart = true;
          i = i - 1; // back up so will start up again here
          continue;
        } else if (value.type == "coord") {
          // just a coord
          ttype = token_coord; // treat as a coord inline
          ttext = value.value; // and then drop through to next test which should succeed
        }
      }

      if (ttype == token_coord) {
        // token is a coord

        if (
          i >= 2 && // look for a range
          parseinfo[i - 1].type == token_op &&
          parseinfo[i - 1].text == ":" &&
          parseinfo[i - 2].type == token_coord &&
          !sheetref
        ) {
          // Range -- check each cell
          coordvals.cr1 = SocialCalc.coordToCr(parseinfo[i - 2].text); // remember range extents
          coordvals.cr2 = SocialCalc.coordToCr(ttext);
          coordvals.inrange = true; // next time use the range looping code
          coordvals.inrangestart = true;
          i = i - 1; // back up so will start up again here
          continue;
        } else if (!sheetref) {
          // Single cell reference
          if (ttext.indexOf("$") != -1) ttext = ttext.replace(/\$/g, ""); // remove any $'s
          coordvals.parsepos = i + 1; // remember our position - come back on next token
          coordvals.oldcoord = oldcoord; // remember back up chain
          oldcoord = coord; // come back to us
          coord = SocialCalc.SpillOwnerForCoord(sheet, ttext);
          if (checkinfo[coord] && typeof checkinfo[coord] == "object") {
            // Circular reference
            cell.errors = SocialCalc.Constants.s_caccCircRef + startcoord; // set on original cell making the ref
            checkinfo[startcoord] = true; // this one should be calculated once at this point
            if (!recalcdata.firstcalc) {
              // add to calclist
              recalcdata.firstcalc = startcoord;
            } else {
              recalcdata.calclist[recalcdata.lastcalc] = startcoord;
            }
            recalcdata.lastcalc = startcoord;
            recalcdata.calclistlength++; // count number on list
            sheet.attribs.circularreferencecell = coord + "|" + oldcoord; // remember at least one circ ref
            return cell.errors;
          }
          continue mainloop;
        }
      }
    }

    sheetref = false; // make sure off when bump back up

    checkinfo[coord] = true; // this one is finished
    if (!recalcdata.firstcalc) {
      // add to calclist
      recalcdata.firstcalc = coord;
    } else {
      recalcdata.calclist[recalcdata.lastcalc] = coord;
    }
    recalcdata.lastcalc = coord;
    recalcdata.calclistlength++; // count number on list

    coord = oldcoord; // go back to the formula that referred to us and continue
    oldcoord = checkinfo[coord] ? checkinfo[coord].oldcoord : null;
  }

  return "";
};

// *************************************
//
// Parse class:
//
// Used by ExecuteSheetCommand to get elements of commands to execute.
// The string it works with consists of one or more lines each
// made up of one or more tokens separated by a delimiter.
//
// *************************************

// Initialize: set string to work with

/** @param {any} str */
SC.Parse = function (str: any) {
  // properties:

  this.str = str;
  this.pos = 0;
  this.delimiter = " ";
  this.lineEnd = str.indexOf("\n");
  if (this.lineEnd < 0) {
    this.lineEnd = str.length;
  }
};

// Return next token as a string

SC.Parse.prototype.NextToken = function () {
  if (this.pos < 0) return "";
  var pos2 = this.str.indexOf(this.delimiter, this.pos);
  var pos1 = this.pos;
  if (pos2 > this.lineEnd) {
    // don't go past end of line
    pos2 = this.lineEnd;
  }
  if (pos2 >= 0) {
    this.pos = pos2 + 1;
    return this.str.substring(pos1, pos2);
  } else {
    this.pos = this.lineEnd;
    return this.str.substring(pos1, this.lineEnd);
  }
};

// Return everything from current point until end of line

SC.Parse.prototype.RestOfString = function () {
  var oldpos = this.pos;
  if (this.pos < 0 || this.pos >= this.lineEnd) return "";
  this.pos = this.lineEnd;
  return this.str.substring(oldpos, this.lineEnd);
};

SC.Parse.prototype.RestOfStringNoMove = function () {
  if (this.pos < 0 || this.pos >= this.lineEnd) return "";
  return this.str.substring(this.pos, this.lineEnd);
};

// Move current point to next line

SC.Parse.prototype.NextLine = function () {
  this.pos = this.lineEnd + 1;
  this.lineEnd = this.str.indexOf("\n", this.pos);
  if (this.lineEnd < 0) {
    this.lineEnd = this.str.length;
  }
};

// Check to see if at end of string with no more to process

SC.Parse.prototype.EOF = function () {
  if (this.pos < 0 || this.pos >= this.str.length) return true;
  return false;
};

// *************************************
//
// UndoStack class:
//
// Implements the behavior needed for a normal application's undo/redo stack.
// You add a new change sequence with PushChange.
// The type argument is a string that can be used to lookup some general string
// like "typing" or "setting attribute" for the menu prompts for undo/redo.
//
// You add the "do" steps with AddDo. The non-null, non-undefined arguments are
// joined together with " " to make a command string to be saved.
//
// You add the undo steps as commands for the most recent change with AddUndo.
// The non-null, non-undefined arguments are joined together with " " to make
// a command string to be saved.
//
// The Undo and Redo functions move the Top Of Stack pointer through the changes stack
// so you can undo and redo. Doing a new PushChange removes all undone items
// after TOS.
//
// You can push more things than you can undo if you want.
// There is a maximum to remember as the "did" stack for an audit trail (and as redo). This may be unlimited.
// There is a separate maximum to remember that can be undone. This may be smaller than maxRedo.
//
// *************************************

SC.UndoStack = function () {
  // properties:

  this.stack = []; // {command: [], type: type, undo: []} -- multiple dos and undos allowed
  this.tos = -1; // top of stack position, used for undo/redo
  this.maxRedo = 0; // Maximum size of redo stack (and audit trail which is this.stack[n].command) or zero if no limit
  this.maxUndo = 50; // Maximum number of steps kept for undo (usually the memory intensive part) or zero if no limit
};

/** @param {any} type */
SC.UndoStack.prototype.PushChange = function (type: any) {
  // adding a new thing to the stack
  while (this.stack.length > 0 && this.stack.length - 1 > this.tos) {
    // pop off things not redone
    this.stack.pop();
  }
  this.stack.push({ command: [], type: type, undo: [] });
  if (this.maxRedo && this.stack.length > this.maxRedo) {
    // limit number kept as audit trail
    this.stack.shift(); // remove the extra one
  }
  if (this.maxUndo && this.stack.length > this.maxUndo) {
    // need to trim excess undo info
    this.stack[this.stack.length - this.maxUndo - 1].undo = []; // only need to remove one
  }
  this.tos = this.stack.length - 1;
};

SC.UndoStack.prototype.AddDo = function () {
  if (!this.stack[this.stack.length - 1]) {
    return;
  }
  var args = [];
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] != null) args.push(arguments[i]); // ignore null or undefined
  }
  var cmd = args.join(" ");
  this.stack[this.stack.length - 1].command.push(cmd);
};

SC.UndoStack.prototype.AddUndo = function () {
  if (!this.stack[this.stack.length - 1]) {
    return;
  }
  var args = [];
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] != null) args.push(arguments[i]); // ignore null or undefined
  }
  var cmd = args.join(" ");
  this.stack[this.stack.length - 1].undo.push(cmd);
};

SC.UndoStack.prototype.TOS = function () {
  if (this.tos >= 0) return this.stack[this.tos];
  else return null;
};

SC.UndoStack.prototype.Undo = function () {
  if (this.tos >= 0 && (!this.maxUndo || this.tos > this.stack.length - this.maxUndo - 1)) {
    this.tos -= 1;
    return true;
  } else {
    return false;
  }
};

SC.UndoStack.prototype.Redo = function () {
  if (this.tos < this.stack.length - 1) {
    this.tos += 1;
    return true;
  } else {
    return false;
  }
};

// *************************************
//
// Clipboard Object:
//
// This is a single object.
// Stores the clipboard, which is shared by all active sheets.
// Like the undo stack, it does not persist from one editing session to another.
//
// *************************************

SC.Clipboard = {
  // properties:

  clipboard: "", // empty or string in save format with "copiedfrom:" set to a range
};

// *************************************
//
// RenderContext class:
//
// *************************************

/** @param {any} sheetobj */
SC.RenderContext = function (sheetobj: any) {
  var attribs = sheetobj.attribs;
  var scc = SocialCalc.Constants;

  // properties:

  this.sheetobj = sheetobj;
  this.hideRowsCols = false; // Rendering with panes only works with "false"
  // !!!! Note: not implemented yet in rendering, just saved as an attribute
  this.showGrid = false;
  this.showRCHeaders = false;
  this.rownamewidth = scc.defaultRowNameWidth;
  this.pixelsPerRow = scc.defaultAssumedRowHeight;

  this.cellskip = {}; // if present, coord of cell covering this cell
  this.coordToCR = {}; // for cells starting spans, coordToCR[coord]={row:row, col:col}
  this.colwidth = []; // precomputed column widths, taking into account defaults
  this.rowheight = []; // precomputed row height, taking into account defaults
  this.totalwidth = 0; // precomputed total table width
  this.totalheight = 0; // precomputed total table height

  this.rowpanes = []; // for each pane, {first: firstrow, last: lastrow}
  this.colpanes = []; // for each pane, {first: firstrow, last: lastrow}
  this.colunhideleft = [];
  this.colunhideright = [];
  this.rowunhidetop = [];
  this.rowunhidebottom = [];
  this.maxcol = 0; // max col and row to display, adding long spans, etc.
  this.maxrow = 0;

  this.highlights = {}; // for each cell with special display: coord:highlightType (see this.highlightTypes)
  this.cursorsuffix = ""; // added to highlights[cr]=="cursor" to get type to lookup

  this.highlightTypes =
    // attributes to change when highlit
    {
      cursor: {
        style: scc.defaultHighlightTypeCursorStyle,
        className: scc.defaultHighlightTypeCursorClass,
      },
      range: {
        style: scc.defaultHighlightTypeRangeStyle,
        className: scc.defaultHighlightTypeRangeClass,
      },
      cursorinsertup: {
        style:
          "color:#FFF;backgroundColor:#A6A6A6;backgroundRepeat:repeat-x;backgroundPosition:top left;backgroundImage:url(" +
          scc.defaultImagePrefix +
          "cursorinsertup.gif);",
        className: scc.defaultHighlightTypeCursorClass,
      },
      cursorinsertleft: {
        style:
          "color:#FFF;backgroundColor:#A6A6A6;backgroundRepeat:repeat-y;backgroundPosition:top left;backgroundImage:url(" +
          scc.defaultImagePrefix +
          "cursorinsertleft.gif);",
        className: scc.defaultHighlightTypeCursorClass,
      },
      range2: {
        style:
          "color:#000;backgroundColor:#FFF;backgroundImage:url(" +
          scc.defaultImagePrefix +
          "range2.gif);",
        className: "",
      },
    };

  this.cellIDprefix = scc.defaultCellIDPrefix; // if non-null, each cell will render with an ID

  this.defaultlinkstyle = null; // default linkstyle object (allows you to pass values to link renderer)
  this.defaultHTMLlinkstyle = { type: "html" }; // default linkstyle for standalone HTML

  // constants:

  this.defaultfontstyle = scc.defaultCellFontStyle;
  this.defaultfontsize = scc.defaultCellFontSize;
  this.defaultfontfamily = scc.defaultCellFontFamily;

  this.defaultlayout = scc.defaultCellLayout;

  this.defaultpanedividerwidth = scc.defaultPaneDividerWidth;
  this.defaultpanedividerheight = scc.defaultPaneDividerHeight;

  this.gridCSS = scc.defaultGridCSS;

  this.commentClassName = scc.defaultCommentClass; // for cells with non-blank comments when this.showGrid is true
  this.commentCSS = scc.defaultCommentStyle; // any combination of classnames and styles may be used
  this.commentNoGridClassName = scc.defaultCommentNoGridClass; // for cells when this.showGrid is false
  this.commentNoGridCSS = scc.defaultCommentNoGridStyle; // any combination of classnames and styles may be used

  this.readonlyClassName = scc.defaultReadonlyClass; // for readonly cells with non-blank comments when this.showGrid is true
  this.readonlyCSS = scc.defaultReadonlyStyle; // any combination of classnames and styles may be used
  this.readonlyNoGridClassName = scc.defaultReadonlyNoGridClass; // for readonly cells when this.showGrid is false
  this.readonlyNoGridCSS = scc.defaultReadonlyNoGridStyle; // any combination of classnames and styles may be used
  this.readonlyComment = scc.defaultReadonlyComment;
  this.lockedComment = scc.defaultLockedComment;

  this.classnames =
    // any combination of classnames and explicitStyles can be used
    {
      colname: scc.defaultColnameClass,
      rowname: scc.defaultRownameClass,
      selectedcolname: scc.defaultSelectedColnameClass,
      selectedrowname: scc.defaultSelectedRownameClass,
      upperleft: scc.defaultUpperLeftClass,
      skippedcell: scc.defaultSkippedCellClass,
      panedivider: scc.defaultPaneDividerClass,
      unhideleft: scc.defaultUnhideLeftClass,
      unhideright: scc.defaultUnhideRightClass,
      unhidetop: scc.defaultUnhideTopClass,
      unhidebottom: scc.defaultUnhideBottomClass,
      colresizebar: scc.defaultColResizeBarClass,
      rowresizebar: scc.defaultRowResizeBarClass,
    };

  this.explicitStyles =
    // these may be used so you won't need a stylesheet with the classnames
    {
      colname: scc.defaultColnameStyle,
      rowname: scc.defaultRownameStyle,
      selectedcolname: scc.defaultSelectedColnameStyle,
      selectedrowname: scc.defaultSelectedRownameStyle,
      upperleft: scc.defaultUpperLeftStyle,
      skippedcell: scc.defaultSkippedCellStyle,
      panedivider: scc.defaultPaneDividerStyle,
      unhideleft: scc.defaultUnhideLeftStyle,
      unhideright: scc.defaultUnhideRightStyle,
      unhidetop: scc.defaultUnhideTopStyle,
      unhidebottom: scc.defaultUnhideBottomStyle,
    };

  // processed info about cell skipping

  this.cellskip = null;
  this.needcellskip = true;

  // precomputed values, filling in defaults indicated by "*"

  this.fonts = []; // for each fontnum, {style: fs, weight: fw, size: fs, family: ff}
  this.layouts = []; // for each layout, "padding:Tpx Rpx Bpx Lpx;vertical-align:va;"

  this.needprecompute = true; // need to call PrecomputeSheetFontsAndLayouts

  // if have a sheet object, initialize constants and precomputed values

  if (attribs) {
    this.rowpanes[0] = { first: 1, last: attribs.lastrow };
    this.colpanes[0] = { first: 1, last: attribs.lastcol };
    this.usermaxcol = attribs.usermaxcol;
    this.usermaxrow = attribs.usermaxrow;
  } else throw scc.s_rcMissingSheet;
};

// Methods:

SC.RenderContext.prototype.PrecomputeSheetFontsAndLayouts = function () {
  SocialCalc.PrecomputeSheetFontsAndLayouts(this);
};
SC.RenderContext.prototype.CalculateCellSkipData = function () {
  SocialCalc.CalculateCellSkipData(this);
};
SC.RenderContext.prototype.CalculateColWidthData = function () {
  SocialCalc.CalculateColWidthData(this);
};
SC.RenderContext.prototype.CalculateRowHeightData = function () {
  SocialCalc.CalculateRowHeightData(this);
};
/** @param {any} panenum @param {any} first @param {any} last */
SC.RenderContext.prototype.SetRowPaneFirstLast = function (panenum: any, first: any, last: any) {
  this.rowpanes[panenum] = { first: first, last: last };
};
/** @param {any} panenum @param {any} first @param {any} last */
SC.RenderContext.prototype.SetColPaneFirstLast = function (panenum: any, first: any, last: any) {
  this.colpanes[panenum] = { first: first, last: last };
};
/** @param {any} coord @param {any} rowpane @param {any} colpane */
SC.RenderContext.prototype.CoordInPane = function (coord: any, rowpane: any, colpane: any) {
  return SocialCalc.CoordInPane(this, coord, rowpane, colpane);
};
/** @param {any} row @param {any} col @param {any} rowpane @param {any} colpane */
SC.RenderContext.prototype.CellInPane = function (row: any, col: any, rowpane: any, colpane: any) {
  return SocialCalc.CellInPane(this, row, col, rowpane, colpane);
};
/** @param {any} tableobj */
SC.RenderContext.prototype.InitializeTable = function (tableobj: any) {
  SocialCalc.InitializeTable(this, tableobj);
};
/** @param {any} oldtable @param {any} linkstyle */
SC.RenderContext.prototype.RenderSheet = function (oldtable: any, linkstyle: any) {
  return SocialCalc.RenderSheet(this, oldtable, linkstyle);
};
SC.RenderContext.prototype.RenderColGroup = function () {
  return SocialCalc.RenderColGroup(this);
};
SC.RenderContext.prototype.RenderColHeaders = function () {
  return SocialCalc.RenderColHeaders(this);
};
SC.RenderContext.prototype.RenderSizingRow = function () {
  return SocialCalc.RenderSizingRow(this);
};
/** @param {any} rownum @param {any} rowpane @param {any} linkstyle */
SC.RenderContext.prototype.RenderRow = function (rownum: any, rowpane: any, linkstyle: any) {
  return SocialCalc.RenderRow(this, rownum, rowpane, linkstyle);
};
SC.RenderContext.prototype.RenderSpacingRow = function () {
  return SocialCalc.RenderSpacingRow(this);
};
/** @param {any} rownum @param {any} colnum @param {any} rowpane @param {any} colpane @param {any} noElement @param {any} linkstyle */
SC.RenderContext.prototype.RenderCell = function (
  rownum: any,
  colnum: any,
  rowpane: any,
  colpane: any,
  noElement: any,
  linkstyle: any,
) {
  return SocialCalc.RenderCell(this, rownum, colnum, rowpane, colpane, noElement, linkstyle);
};

// Functions:

/** @param {any} context */
SC.PrecomputeSheetFontsAndLayouts = function (context: any) {
  var defaultfont, parts, layoutre, dparts, sparts, num, s, i;
  var sheetobj = context.sheetobj;
  var attribs = sheetobj.attribs;

  if (attribs.defaultfont) {
    defaultfont = sheetobj.fonts[attribs.defaultfont];
    defaultfont = defaultfont.replace(/^\*/, SocialCalc.Constants.defaultCellFontStyle);
    defaultfont = defaultfont.replace(
      /(.+)\*(.+)/,
      "$1" + SocialCalc.Constants.defaultCellFontSize + "$2",
    );
    defaultfont = defaultfont.replace(/\*$/, SocialCalc.Constants.defaultCellFontFamily);
    parts = defaultfont.match(/^(\S+? \S+?) (\S+?) (\S.*)$/);
    context.defaultfontstyle = parts[1];
    context.defaultfontsize = parts[2];
    context.defaultfontfamily = parts[3];
  }

  for (num = 1; num < sheetobj.fonts.length; num++) {
    // precompute fonts by filling in the *'s
    s = sheetobj.fonts[num];
    s = s.replace(/^\*/, context.defaultfontstyle);
    s = s.replace(/(.+)\*(.+)/, "$1" + context.defaultfontsize + "$2");
    s = s.replace(/\*$/, context.defaultfontfamily);
    parts = s.match(/^(\S+?) (\S+?) (\S+?) (\S.*)$/);

    if (!parts) continue;

    context.fonts[num] = { style: parts[1], weight: parts[2], size: parts[3], family: parts[4] };
  }

  layoutre = /^padding:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+);vertical-align:\s*(\S+);/;
  dparts = SocialCalc.Constants.defaultCellLayout.match(layoutre); // get built-in defaults

  if (attribs.defaultlayout) {
    sparts = sheetobj.layouts[attribs.defaultlayout].match(layoutre); // get sheet defaults, if set
  } else {
    sparts = ["", "*", "*", "*", "*", "*"];
  }

  for (num = 1; num < sheetobj.layouts.length; num++) {
    // precompute layouts by filling in the *'s
    s = sheetobj.layouts[num];
    parts = s.match(layoutre);

    if (!parts) continue;

    for (i = 1; i <= 5; i++) {
      if (parts[i] == "*") {
        parts[i] = sparts[i] != "*" ? sparts[i] : (dparts as any)[i]; // if *, sheet default or built-in
      }
    }
    context.layouts[num] =
      "padding:" +
      parts[1] +
      " " +
      parts[2] +
      " " +
      parts[3] +
      " " +
      parts[4] +
      ";vertical-align:" +
      parts[5] +
      ";";
  }

  context.needprecompute = false;
};

/** @param {any} context */
SC.CalculateCellSkipData = function (context: any) {
  var row, col, coord, cell, colspan, rowspan, skiprow, skipcol, skipcoord;

  var sheetobj = context.sheetobj;
  context.maxrow = 0;
  context.maxcol = 0;
  context.cellskip = {}; // reset

  // Calculate cellskip data

  for (row = 1; row <= sheetobj.attribs.lastrow; row++) {
    for (col = 1; col <= sheetobj.attribs.lastcol; col++) {
      // look for spans and set cellskip for skipped cells
      coord = SocialCalc.crToCoord(col, row);
      cell = sheetobj.cells[coord];
      // don't look at undefined cells (they have no spans) or skipped cells
      if (cell === undefined || context.cellskip[coord]) continue;
      colspan = cell.colspan || 1;
      rowspan = cell.rowspan || 1;
      if (colspan > 1 || rowspan > 1) {
        for (skiprow = row; skiprow < row + rowspan; skiprow++) {
          for (skipcol = col; skipcol < col + colspan; skipcol++) {
            // do the setting on individual cells
            skipcoord = SocialCalc.crToCoord(skipcol, skiprow);
            if (skipcoord == coord) {
              // for coord, remember row and col
              context.coordToCR[coord] = { row: row, col: col };
            } else {
              // for other cells, flag with coord of here
              context.cellskip[skipcoord] = coord;
            }
            if (skiprow > context.maxrow) context.maxrow = skiprow;
            if (skipcol > context.maxcol) context.maxcol = skipcol;
          }
        }
      }
    }
  }

  context.needcellskip = false;
};

/** @param {any} context */
SC.CalculateColWidthData = function (context: any) {
  var colnum, colname, colwidth, totalwidth, colpane;

  var sheetobj = context.sheetobj;

  // Calculate column width data

  totalwidth = context.showRCHeaders ? context.rownamewidth - 0 : 0;
  for (colpane = 0; colpane < context.colpanes.length; colpane++) {
    for (
      colnum = context.colpanes[colpane].first;
      colnum <= context.colpanes[colpane].last;
      colnum++
    ) {
      colname = SocialCalc.rcColname(colnum);
      if (sheetobj.colattribs.hide[colname] == "yes") {
        context.colwidth[colnum] = 0;
      } else {
        colwidth =
          sheetobj.colattribs.width[colname] ||
          sheetobj.attribs.defaultcolwidth ||
          SocialCalc.Constants.defaultColWidth;
        if (colwidth == "blank" || colwidth == "auto") colwidth = "";
        context.colwidth[colnum] = colwidth + "";
        totalwidth += colwidth && colwidth - 0 > 0 ? colwidth - 0 : 10;
      }
    }
  }
  context.totalwidth = totalwidth;
};

/** @param {any} context */
SC.CalculateRowHeightData = function (context: any) {
  var rownum, rowheight, totalheight, rowpane;
  var sheetobj = context.sheetobj;

  // Calculate row height data
  totalheight = context.showRCHeaders ? context.pixelsPerRow : 0;
  for (rowpane = 0; rowpane < context.rowpanes.length; rowpane++) {
    for (
      rownum = context.rowpanes[rowpane].first;
      rownum <= context.rowpanes[rowpane].last;
      rownum++
    ) {
      if (SocialCalc.RowEffectivelyHidden(sheetobj, rownum)) {
        context.rowheight[rownum] = 0;
      } else {
        rowheight =
          sheetobj.rowattribs.height[rownum] ||
          sheetobj.attribs.defaultrowheight ||
          SocialCalc.Constants.defaultAssumedRowHeight;
        if (rowheight === "blank" || rowheight === "auto") rowheight = "";
        context.rowheight[rownum] = rowheight + "";
        totalheight += rowheight && rowheight - 0 > 0 ? rowheight - 0 : 10;
      }
    }
  }
  context.totalheight = totalheight;
};

/** @param {any} context @param {any} tableobj */
SC.InitializeTable = function (context: any, tableobj: any) {
  /*

Uses border-collapse so corners don't have holes
Note: IE and Firefox handle <col> differently (IE adds borders and padding)
under border-collapse and Safari has problems with <col> and wide text
Tablelayout "fixed" also leads to problems

*/

  /*

*** Discussion ***

The rendering assumes fixed column widths, even though SocialCalc allows "auto".
There may be issues with "auto" and it is hard to make it work cross-browser
with border-collapse, etc.

This and the RenderSheet routine are where in the code the specifics of
table attributes and column size definitions are set. As the browsers settle down
and when we decide if we don't need auto width, we may want to revisit the way the
code does this (e.g., use table-layout:fixed).

*/
  tableobj.style.borderCollapse = "collapse";
  tableobj.cellSpacing = "0";
  tableobj.cellPadding = "0";

  tableobj.style.width = context.totalwidth + "px";
};

//
// tableobj = SocialCalc.RenderSheet(context, oldtable, linkstyle)
//
// Renders a render context returning a DOM table object.
// If there is an oldtable object, it replaces it in the parent node.
// If oldtable is null, it just returns the new one.
// The linkstyle is "" or null for editing rendering
// and optionally an object passed on to formatting code.
//

/** @param {any} context @param {any} oldtable @param {any} linkstyle */
SC.RenderSheet = function (context: any, oldtable: any, linkstyle: any) {
  var newrow, rowpane, rownum;
  var tableobj, colgroupobj, tbodyobj, parentnode;

  // do precompute stuff if necessary

  if (context.sheetobj.changedrendervalues) {
    context.needcellskip = true;
    context.needprecompute = true;
    context.sheetobj.changedrendervalues = false;
  }
  if (context.needcellskip) {
    context.CalculateCellSkipData();
  }
  if (context.needprecompute) {
    context.PrecomputeSheetFontsAndLayouts();
  }

  context.CalculateColWidthData(); // always make sure col width values are up to date
  context.CalculateRowHeightData();

  // make the table element and fill it in

  tableobj = document.createElement("table");
  context.InitializeTable(tableobj);
  tableobj.setAttribute("role", "grid");
  tableobj.setAttribute("aria-rowcount", String(context.sheetobj.attribs.lastrow));
  tableobj.setAttribute("aria-colcount", String(context.sheetobj.attribs.lastcol));

  colgroupobj = context.RenderColGroup();
  tableobj.appendChild(colgroupobj);

  tbodyobj = document.createElement("tbody");

  tbodyobj.appendChild(context.RenderSizingRow());

  if (context.showRCHeaders) {
    newrow = context.RenderColHeaders();
    if (newrow) tbodyobj.appendChild(newrow);
  }

  for (rowpane = 0; rowpane < context.rowpanes.length; rowpane++) {
    for (
      rownum = context.rowpanes[rowpane].first;
      rownum <= context.rowpanes[rowpane].last;
      rownum++
    ) {
      newrow = context.RenderRow(rownum, rowpane, linkstyle);
      tbodyobj.appendChild(newrow);
    }
    if (rowpane < context.rowpanes.length - 1) {
      newrow = context.RenderSpacingRow();
      tbodyobj.appendChild(newrow);
    }
  }

  tableobj.appendChild(tbodyobj);

  if (oldtable) {
    parentnode = oldtable.parentNode;
    if (parentnode) parentnode.replaceChild(tableobj, oldtable);
  }

  return tableobj;
};

/** @param {any} context @param {any} rownum @param {any} rowpane @param {any} linkstyle */
SC.RenderRow = function (context: any, rownum: any, rowpane: any, linkstyle: any) {
  var sheetobj = context.sheetobj;

  var result = document.createElement("tr");
  result.setAttribute("role", "row");
  result.setAttribute("aria-rowindex", String(rownum));
  var colnum, newcol, colpane, newdiv;

  if (context.showRCHeaders) {
    newcol = document.createElement("td");
    if (context.classnames) newcol.className = context.classnames.rowname;
    if (context.explicitStyles) newcol.style.cssText = context.explicitStyles.rowname;
    newcol.width = context.rownamewidth;
    newcol.height = context.rowheight[rownum];
    newcol.style.verticalAlign = "top"; // to get around Safari making top of centered row number be
    // considered top of row (and can't get <row> position in Safari)
    newcol.setAttribute("role", "rowheader");
    newcol.setAttribute("scope", "row");
    newcol.setAttribute("aria-label", "Row " + rownum);
    newcol.innerHTML = rownum + "";

    // If neighbour is hidden, show an icon in this column.
    if (
      rownum < context.rowpanes[context.rowpanes.length - 1].last &&
      sheetobj.rowattribs.hide[rownum + 1] == "yes"
    ) {
      // HACK: Because we likely want the icon floating at the bottom of the cell, we create an enclosing div
      // with position relative and the icon's div will be placed inside it with position: absolute and bottom: 0.
      var container = document.createElement("div");
      container.style.position = "relative";
      var unhide = document.createElement("div");
      if (context.classnames) unhide.className = context.classnames.unhidetop;
      if (context.explicitStyles) unhide.style.cssText = context.explicitStyles.unhidetop;
      var fixPosition =
        context.rowheight[rownum] - 0 - SocialCalc.Constants.defaultAssumedRowHeight;
      fixPosition = fixPosition === 0 ? 4 : fixPosition;
      unhide.style.bottom = "-" + fixPosition + "px";
      context.rowunhidetop[rownum] = unhide;
      container.appendChild(unhide);
      newcol.appendChild(container);
    }
    if (rownum > 1 && sheetobj.rowattribs.hide[rownum - 1] == "yes") {
      var unhide = document.createElement("div");
      if (context.classnames) unhide.className = context.classnames.unhidebottom;
      if (context.explicitStyles) unhide.style.cssText = context.explicitStyles.unhidebottom;
      context.rowunhidebottom[rownum] = unhide;
      newcol.appendChild(unhide);
    }

    // add resize bar
    var resizeBar = document.createElement("div");
    resizeBar.className = context.classnames.rowresizebar;
    newcol.appendChild(resizeBar);

    result.appendChild(newcol);
  }

  for (colpane = 0; colpane < context.colpanes.length; colpane++) {
    for (
      colnum = context.colpanes[colpane].first;
      colnum <= context.colpanes[colpane].last;
      colnum++
    ) {
      newcol = context.RenderCell(rownum, colnum, rowpane, colpane, null, linkstyle);
      if (newcol) result.appendChild(newcol);
    }
    if (colpane < context.colpanes.length - 1) {
      newcol = document.createElement("td");
      newcol.width = context.defaultpanedividerwidth;
      if (context.classnames.panedivider) newcol.className = context.classnames.panedivider;
      if (context.explicitStyles.panedivider)
        newcol.style.cssText = context.explicitStyles.panedivider;
      newdiv = document.createElement("div"); // for Firefox to avoid squishing
      newdiv.style.width = context.defaultpanedividerwidth + "px";
      newdiv.style.overflow = "hidden";
      newcol.appendChild(newdiv);
      result.appendChild(newcol);
    }
  }

  // If hidden row, display: none.
  if (SocialCalc.RowEffectivelyHidden(sheetobj, rownum)) {
    result.style.cssText += ";display:none";
  }

  return result;
};

/** @param {any} context */
SC.RenderSpacingRow = function (context: any) {
  var colnum, newcol, colpane, w;

  var result = document.createElement("tr");

  if (context.showRCHeaders) {
    newcol = document.createElement("td");
    newcol.width = context.rownamewidth;
    newcol.height = context.defaultpanedividerheight;
    if (context.classnames.panedivider) newcol.className = context.classnames.panedivider;
    if (context.explicitStyles.panedivider)
      newcol.style.cssText = context.explicitStyles.panedivider;
    result.appendChild(newcol);
  }

  for (colpane = 0; colpane < context.colpanes.length; colpane++) {
    for (
      colnum = context.colpanes[colpane].first;
      colnum <= context.colpanes[colpane].last;
      colnum++
    ) {
      newcol = document.createElement("td");
      w = context.colwidth[colnum];
      if (w) newcol.width = w;
      newcol.height = context.defaultpanedividerheight;
      if (context.classnames.panedivider) newcol.className = context.classnames.panedivider;
      if (context.explicitStyles.panedivider)
        newcol.style.cssText = context.explicitStyles.panedivider;
      result.appendChild(newcol);
    }
    if (colpane < context.colpanes.length - 1) {
      newcol = document.createElement("td");
      newcol.width = context.defaultpanedividerwidth;
      newcol.height = context.defaultpanedividerheight;
      if (context.classnames.panedivider) newcol.className = context.classnames.panedivider;
      if (context.explicitStyles.panedivider)
        newcol.style.cssText = context.explicitStyles.panedivider;
      result.appendChild(newcol);
    }
  }
  return result;
};

/** @param {any} context */
SC.RenderColHeaders = function (context: any) {
  var sheetobj = context.sheetobj;

  var result = document.createElement("tr");
  result.setAttribute("role", "row");
  result.setAttribute("aria-rowindex", "0");
  var colnum, newcol, colpane;

  if (!context.showRCHeaders) return null;

  newcol = document.createElement("td");
  if (context.classnames) newcol.className = context.classnames.upperleft;
  if (context.explicitStyles) newcol.style.cssText = context.explicitStyles.upperleft;
  newcol.width = context.rownamewidth;
  result.appendChild(newcol);

  for (colpane = 0; colpane < context.colpanes.length; colpane++) {
    for (
      colnum = context.colpanes[colpane].first;
      colnum <= context.colpanes[colpane].last;
      colnum++
    ) {
      newcol = document.createElement("td");
      if (context.classnames) newcol.className = context.classnames.colname;
      if (context.explicitStyles) newcol.style.cssText = context.explicitStyles.colname;

      // If hidden column, display: none.
      if (sheetobj.colattribs.hide[SocialCalc.rcColname(colnum)] == "yes") {
        newcol.style.cssText += ";display:none";
      }

      newcol.setAttribute("role", "columnheader");
      newcol.setAttribute("scope", "col");
      newcol.setAttribute("aria-colindex", String(colnum));
      var colHeaderName = SocialCalc.rcColname(colnum);
      newcol.setAttribute("aria-label", "Column " + colHeaderName);
      newcol.innerHTML = colHeaderName;

      // If neighbour is hidden, show an icon in this column.
      if (
        colnum < context.colpanes[context.colpanes.length - 1].last &&
        sheetobj.colattribs.hide[SocialCalc.rcColname(colnum + 1)] == "yes"
      ) {
        var unhide = document.createElement("div");
        if (context.classnames) unhide.className = context.classnames.unhideleft;
        if (context.explicitStyles) unhide.style.cssText = context.explicitStyles.unhideleft;
        context.colunhideleft[colnum] = unhide;
        newcol.appendChild(unhide);
      }
      if (colnum > 1 && sheetobj.colattribs.hide[SocialCalc.rcColname(colnum - 1)] == "yes") {
        unhide = document.createElement("div");
        if (context.classnames) unhide.className = context.classnames.unhideright;
        if (context.explicitStyles) unhide.style.cssText = context.explicitStyles.unhideright;
        context.colunhideright[colnum] = unhide;
        newcol.appendChild(unhide);
      }

      // add resize bar
      var resizeBar = document.createElement("span");
      resizeBar.style.height = SocialCalc.Constants.defaultAssumedRowHeight + "px";
      resizeBar.className = context.classnames.colresizebar;
      newcol.appendChild(resizeBar);

      result.appendChild(newcol);
    }
    if (colpane < context.colpanes.length - 1) {
      newcol = document.createElement("td");
      newcol.width = context.defaultpanedividerwidth;
      if (context.classnames.panedivider) newcol.className = context.classnames.panedivider;
      if (context.explicitStyles.panedivider)
        newcol.style.cssText = context.explicitStyles.panedivider;
      result.appendChild(newcol);
    }
  }
  // eddy {
  //   if(context.formColNames != null) {
  //     for(var nodeIndex = 0;  nodeIndex < result.childNodes.length;  nodeIndex++ ) {
  //       var currentCol = result.childNodes[nodeIndex];
  //       if(context.formColNames[currentCol.innerText] != null) currentCol.innerText = context.formColNames[currentCol.innerText];
  //     }
  //   }
  // }
  return result;
};

/** @param {any} context */
SC.RenderColGroup = function (context: any) {
  var colpane, colnum, newcol, t;
  var sheetobj = context.sheetobj;

  var result = document.createElement("colgroup");

  if (context.showRCHeaders) {
    newcol = document.createElement("col");
    newcol.width = context.rownamewidth;
    result.appendChild(newcol);
  }

  for (colpane = 0; colpane < context.colpanes.length; colpane++) {
    for (
      colnum = context.colpanes[colpane].first;
      colnum <= context.colpanes[colpane].last;
      colnum++
    ) {
      newcol = document.createElement("col");
      if (sheetobj.colattribs.hide[SocialCalc.rcColname(colnum)] == "yes") {
        newcol.width = "1";
      } else {
        t = context.colwidth[colnum];
        if (t) newcol.width = t;
        result.appendChild(newcol);
      }
    }
    if (colpane < context.colpanes.length - 1) {
      newcol = document.createElement("col");
      newcol.width = context.defaultpanedividerwidth;
      result.appendChild(newcol);
    }
  }
  return result;
};

/** @param {any} context */
SC.RenderSizingRow = function (context: any) {
  var colpane, colnum, newcell, t;
  var sheetobj = context.sheetobj;

  var result = document.createElement("tr");

  if (context.showRCHeaders) {
    newcell = document.createElement("td");
    newcell.style.width = context.rownamewidth + "px";
    newcell.height = "1";
    result.appendChild(newcell);
  }

  for (colpane = 0; colpane < context.colpanes.length; colpane++) {
    for (
      colnum = context.colpanes[colpane].first;
      colnum <= context.colpanes[colpane].last;
      colnum++
    ) {
      newcell = document.createElement("td");
      if (sheetobj.colattribs.hide[SocialCalc.rcColname(colnum)] == "yes") {
        newcell.width = "1";
      } else {
        t = context.colwidth[colnum];
        if (t) newcell.width = t;
      }
      newcell.height = "1";
      result.appendChild(newcell);
    }
    if (colpane < context.colpanes.length - 1) {
      newcell = document.createElement("td");
      newcell.width = context.defaultpanedividerwidth;
      newcell.height = "1";
      result.appendChild(newcell);
    }
  }
  return result;
};

/** @param {any} context @param {any} rownum @param {any} colnum @param {any} rowpane @param {any} colpane @param {any} noElement @param {any} linkstyle */
SC.RenderCell = function (
  context: any,
  rownum: any,
  colnum: any,
  rowpane: any,
  colpane: any,
  noElement: any,
  linkstyle: any,
) {
  var sheetobj = context.sheetobj;

  var num, t, result, span, cell, endcell, sheetattribs;
  var stylestr = "";
  var scc;

  rownum = rownum - 0; // make sure a number
  colnum = colnum - 0;

  var coord = SocialCalc.crToCoord(colnum, rownum);

  if (context.cellskip[coord]) {
    // skip if within a span
    if (context.CoordInPane(context.cellskip[coord], rowpane, colpane)) {
      return null; // span starts in this pane -- so just skip
    }
    result = noElement ? SocialCalc.CreatePseudoElement() : document.createElement("td"); // span start is scrolled away, so make a special cell
    if (context.classnames.skippedcell) result.className = context.classnames.skippedcell;
    if (context.explicitStyles.skippedcell)
      result.style.cssText = context.explicitStyles.skippedcell;
    result.innerHTML = "&nbsp;"; // put something there so height is OK
    // !!! Really need to add borders in case there isn't anything else shown in the pane to get height
    return result;
  }

  result = noElement ? (SocialCalc.CreatePseudoElement() as any) : document.createElement("td");

  if (context.cellIDprefix) {
    result.id = context.cellIDprefix + coord;
  }

  if (!noElement) {
    result.setAttribute("role", "gridcell");
    result.setAttribute("aria-rowindex", String(rownum));
    result.setAttribute("aria-colindex", String(colnum));
  }

  cell = sheetobj.cells[coord];

  if (!cell) {
    cell = new SocialCalc.Cell(coord);
  }

  sheetattribs = sheetobj.attribs;
  scc = SocialCalc.Constants;

  // Conditional formatting: computed once per cell, never mutates `cell`.
  // Style-field precedence/merge follows lemma/condfmt.ts foldCondFmtRule.
  var condfmtStyle = SocialCalc.EvaluateCondFmtForCell(sheetobj, coord);

  if (cell.colspan > 1) {
    span = 1;
    for (num = 1; num < cell.colspan; num++) {
      if (
        sheetobj.colattribs.hide[SocialCalc.rcColname(colnum + num)] != "yes" &&
        context.CellInPane(rownum, colnum + num, rowpane, colpane)
      ) {
        span++;
      }
    }
    result.colSpan = span;
  }

  if (cell.rowspan > 1) {
    span = 1;
    for (num = 1; num < cell.rowspan; num++) {
      if (
        !SocialCalc.RowEffectivelyHidden(sheetobj, rownum + num) &&
        context.CellInPane(rownum + num, colnum, rowpane, colpane)
      )
        span++;
    }
    result.rowSpan = span;
  }

  if (cell.displaystring == undefined || sheetobj.widgetsClean == false) {
    // cache the display value
    cell.displaystring = SocialCalc.FormatValueForDisplay(
      sheetobj,
      cell.datavalue,
      coord,
      linkstyle || context.defaultlinkstyle,
    );
  }

  result.innerHTML = cell.displaystring;

  // AutoFilter header dropdown affordance: only for a real DOM element
  // (noElement builds a pseudo element for measurement, not display) and
  // only when this exact cell is the header row of an attached AutoFilter.
  if (!noElement) {
    var afHeader = SocialCalc.FindAutoFilterForHeaderCell(sheetobj, rownum, colnum);
    if (afHeader) {
      var afArrow = document.createElement("span");
      afArrow.className = "autofilter-dropdown-arrow";
      afArrow.style.cssText =
        "cursor:pointer;float:right;margin-left:2px;font-size:x-small;user-select:none;";
      afArrow.textContent = "\u25BC";
      afArrow.setAttribute("data-autofilter-id", afHeader.filterId);
      afArrow.setAttribute("data-autofilter-coloffset", String(afHeader.colOffset));
      afArrow.onclick = (function (filterId: string, colOffset: number, arrowEl: HTMLElement) {
        return function (ev: MouseEvent) {
          ev.stopPropagation();
          SocialCalc.ShowAutoFilterDropdown(sheetobj, filterId, colOffset, arrowEl);
        };
      })(afHeader.filterId, afHeader.colOffset, afArrow);
      (result as HTMLElement).appendChild(afArrow);
    }
  }

  num = cell.layout || sheetattribs.defaultlayout;
  if (num && typeof context.layouts[num] !== "undefined") {
    stylestr += context.layouts[num]; // use precomputed layout with "*"'s filled in
  } else {
    stylestr += scc.defaultCellLayout;
  }

  num = cell.font || sheetattribs.defaultfont;
  if (num && typeof context.fonts[num] !== "undefined") {
    // get expanded font strings in context
    t = context.fonts[num]; // do each - plain "font:" style sets all sorts of other values, too (Safari font-stretch problem on cssText)
    stylestr +=
      "font-style:" +
      t.style +
      ";font-weight:" +
      t.weight +
      ";font-size:" +
      t.size +
      ";font-family:" +
      t.family +
      ";";
  } else {
    if (scc.defaultCellFontSize) {
      stylestr += "font-size:" + scc.defaultCellFontSize + ";";
    }
    if (scc.defaultCellFontFamily) {
      stylestr += "font-family:" + scc.defaultCellFontFamily + ";";
    }
  }

  num = cell.color || sheetattribs.defaultcolor;
  if (num && typeof sheetobj.colors[num] !== "undefined")
    stylestr += "color:" + sheetobj.colors[num] + ";";

  num = cell.bgcolor || sheetattribs.defaultbgcolor;
  if (num && typeof sheetobj.colors[num] !== "undefined")
    stylestr += "background-color:" + sheetobj.colors[num] + ";";

  num = cell.cellformat;
  if (num && typeof sheetobj.cellformats[num] !== "undefined") {
    stylestr += "text-align:" + sheetobj.cellformats[num] + ";";
  } else {
    t = cell.valuetype.charAt(0);
    if (t == "t") {
      num = sheetattribs.defaulttextformat;
      if (num && typeof sheetobj.cellformats[num] !== "undefined")
        stylestr += "text-align:" + sheetobj.cellformats[num] + ";";
    } else if (t == "n") {
      num = sheetattribs.defaultnontextformat;
      if (num && typeof sheetobj.cellformats[num] !== "undefined") {
        stylestr += "text-align:" + sheetobj.cellformats[num] + ";";
      } else {
        stylestr += "text-align:right;";
      }
    } else stylestr += "text-align:left;";
  }

  // get the end cell for border styling
  if (cell.colspan > 1 || cell.rowspan > 1) {
    endcell =
      sheetobj.cells[
        SocialCalc.crToCoord(colnum + (cell.colspan || 1) - 1, rownum + (cell.rowspan || 1) - 1)
      ];
  }

  num = cell.bt;
  if (num && typeof sheetobj.borderstyles[num] !== "undefined")
    stylestr += "border-top:" + sheetobj.borderstyles[num] + ";";

  num = typeof endcell != "undefined" ? endcell.br : cell.br;
  if (num && typeof sheetobj.borderstyles[num] !== "undefined")
    stylestr += "border-right:" + sheetobj.borderstyles[num] + ";";
  else if (context.showGrid) {
    if (context.CellInPane(rownum, colnum + (cell.colspan || 1), rowpane, colpane))
      t = SocialCalc.crToCoord(colnum + (cell.colspan || 1), rownum);
    else t = "nomatch";
    if (context.cellskip[t]) t = context.cellskip[t];
    if (!sheetobj.cells[t] || !sheetobj.cells[t].bl) stylestr += "border-right:" + context.gridCSS;
  }

  num = typeof endcell != "undefined" ? endcell.bb : cell.bb;
  if (num && typeof sheetobj.borderstyles[num] !== "undefined")
    stylestr += "border-bottom:" + sheetobj.borderstyles[num] + ";";
  else if (context.showGrid) {
    if (context.CellInPane(rownum + (cell.rowspan || 1), colnum, rowpane, colpane))
      t = SocialCalc.crToCoord(colnum, rownum + (cell.rowspan || 1));
    else t = "nomatch";
    if (context.cellskip[t]) t = context.cellskip[t];
    if (!sheetobj.cells[t] || !sheetobj.cells[t].bt) stylestr += "border-bottom:" + context.gridCSS;
  }

  num = cell.bl;
  if (num && typeof sheetobj.borderstyles[num] !== "undefined")
    stylestr += "border-left:" + sheetobj.borderstyles[num] + ";";

  if (condfmtStyle) {
    // Conditional formatting overlay: appended last so it wins the cssText
    // cascade for any property it sets, without touching `cell` itself.
    if (condfmtStyle.font && typeof context.fonts[condfmtStyle.font] !== "undefined") {
      var cft = context.fonts[condfmtStyle.font];
      stylestr +=
        "font-style:" +
        cft.style +
        ";font-weight:" +
        cft.weight +
        ";font-size:" +
        cft.size +
        ";font-family:" +
        cft.family +
        ";";
    }
    if (condfmtStyle.color && typeof sheetobj.colors[condfmtStyle.color] !== "undefined") {
      stylestr += "color:" + sheetobj.colors[condfmtStyle.color] + ";";
    }
    if (condfmtStyle.bgcolor && typeof sheetobj.colors[condfmtStyle.bgcolor] !== "undefined") {
      stylestr += "background-color:" + sheetobj.colors[condfmtStyle.bgcolor] + ";";
    }
    if (condfmtStyle.bt && typeof sheetobj.borderstyles[condfmtStyle.bt] !== "undefined") {
      stylestr += "border-top:" + sheetobj.borderstyles[condfmtStyle.bt] + ";";
    }
    if (condfmtStyle.br && typeof sheetobj.borderstyles[condfmtStyle.br] !== "undefined") {
      stylestr += "border-right:" + sheetobj.borderstyles[condfmtStyle.br] + ";";
    }
    if (condfmtStyle.bb && typeof sheetobj.borderstyles[condfmtStyle.bb] !== "undefined") {
      stylestr += "border-bottom:" + sheetobj.borderstyles[condfmtStyle.bb] + ";";
    }
    if (condfmtStyle.bl && typeof sheetobj.borderstyles[condfmtStyle.bl] !== "undefined") {
      stylestr += "border-left:" + sheetobj.borderstyles[condfmtStyle.bl] + ";";
    }
  }

  if (cell.comment) {
    result.title = cell.comment;
    if (context.showGrid) {
      if (context.commentClassName) {
        result.className = context.commentClassName;
      }
      stylestr += context.commentCSS;
    } else {
      if (context.commentNoGridClassName) {
        result.className = context.commentNoGridClassName;
      }
      stylestr += context.commentNoGridCSS;
    }
  }

  if (!SocialCalc.IsCellEditable(sheetobj, coord)) {
    if (!cell.comment) {
      result.title = cell.readonly ? context.readonlyComment : context.lockedComment;
    }
    if (context.showGrid) {
      if (context.readonlyClassName) {
        result.className =
          (result.className ? result.className + " " : "") + context.readonlyClassName;
      }
      stylestr += context.readonlyCSS;
    } else {
      if (context.readonlyNoGridClassName) {
        result.className =
          (result.className ? result.className + " " : "") + context.readonlyNoGridClassName;
      }
      stylestr += context.readonlyNoGridCSS;
    }
  }

  if (!noElement) {
    result.setAttribute("aria-readonly", cell.readonly ? "true" : "false");
    if (cell.errors) {
      result.setAttribute("aria-invalid", "true");
    } else {
      result.removeAttribute("aria-invalid");
    }
    // Accessible name uses the plain-text value, never the formatted HTML,
    // so aria-label is never built by concatenating sheet-derived markup.
    result.setAttribute(
      "aria-label",
      coord + (cell.datavalue != null && cell.datavalue !== "" ? ": " + cell.datavalue : ""),
    );
  }

  result.style.cssText = stylestr;

  //!!!!!!!!!
  // NOTE: csss is not supported yet.
  // csss needs to be parsed into pieces to override just the attributes specified, not all with assignment to cssText.
  if (cell.cssc !== undefined) {
    if (noElement) {
      result.className = (result.className ? result.className + " " : "") + cell.cssc;
    } else {
      result.classList.add(cell.cssc);
    }
  }

  t = context.highlights[coord];
  if (t) {
    // this is a highlit cell: Override style appropriately
    if (!noElement) result.setAttribute("aria-selected", "true");
    if (t == "cursor") t += context.cursorsuffix; // cursor can take alternative forms
    if (context.highlightTypes[t].className) {
      result.className =
        (result.className ? result.className + " " : "") + context.highlightTypes[t].className;
    }
    SocialCalc.setStyles(result, context.highlightTypes[t].style);
  } else if (!noElement) {
    result.setAttribute("aria-selected", "false");
  }

  // If hidden column, display: none.
  if (sheetobj.colattribs.hide[SocialCalc.rcColname(colnum)] == "yes") {
    result.style.cssText += ";display:none";
  }

  // If hidden row, display: none.
  if (SocialCalc.RowEffectivelyHidden(sheetobj, rownum)) {
    result.style.cssText += ";display:none";
  }

  return result;
};

/** @param {any} context @param {any} coord @param {any} rowpane @param {any} colpane */
SC.CoordInPane = function (context: any, coord: any, rowpane: any, colpane: any) {
  var coordToCR = context.coordToCR[coord];
  if (!coordToCR || !coordToCR.row || !coordToCR.col) throw "Bad coordToCR for " + coord;
  return context.CellInPane(coordToCR.row, coordToCR.col, rowpane, colpane);
};

/** @param {any} context @param {any} row @param {any} col @param {any} rowpane @param {any} colpane */
SC.CellInPane = function (context: any, row: any, col: any, rowpane: any, colpane: any) {
  var panerowlimits = context.rowpanes[rowpane];
  var panecollimits = context.colpanes[colpane];
  if (!panerowlimits || !panecollimits)
    throw "CellInPane called with unknown panes " + rowpane + "/" + colpane;
  if (row < panerowlimits.first || row > panerowlimits.last) return false;
  if (col < panecollimits.first || col > panecollimits.last) return false;
  return true;
};

SC.CreatePseudoElement = function () {
  return { style: { cssText: "" }, innerHTML: "", className: "" };
};

// *************************************
//
// Misc. functions:
//
// *************************************

// A1 coord algebra + ParseRange live in js/formula-ref.ts
// (concatenated after formula1; single shipping oracle).

/** @param {any} s */
SC.decodeFromSave = function (s: any) {
  if (typeof s != "string") return s;
  if (s.indexOf("\\") == -1) return s; // for performace reasons: replace nothing takes up time
  var r = s.replace(/\\c/g, ":");
  r = r.replace(/\\n/g, "\n");
  return r.replace(/\\b/g, "\\");
};

/** @param {any} s */
SC.decodeFromAjax = function (s: any) {
  if (typeof s != "string") return s;
  if (s.indexOf("\\") == -1) return s; // for performace reasons: replace nothing takes up time
  var r = s.replace(/\\c/g, ":");
  r = r.replace(/\\n/g, "\n");
  r = r.replace(/\\e/g, "]]");
  return r.replace(/\\b/g, "\\");
};

/** @param {any} s */
SC.encodeForSave = function (s: any) {
  if (typeof s != "string") return s;
  if (s.indexOf("\\") != -1)
    // for performace reasons: replace nothing takes up time
    s = s.replace(/\\/g, "\\b");
  if (s.indexOf(":") != -1) s = s.replace(/:/g, "\\c");
  if (s.indexOf("\n") != -1) s = s.replace(/\n/g, "\\n");
  return s;
};

//
// Returns estring where &, <, >, " are HTML escaped
//
//
// result = SocialCalc.SafeUrlForRender(rawurl, policy)
//
// Non-"data:" URLs are validated against policy.allowedUrlSchemes; "data:"
// URLs are validated SOLELY against policy.allowedDataMimeTypes (never
// consulting allowedUrlSchemes at all - a "data:" URL with an allowed MIME
// type is accepted regardless of what allowedUrlSchemes contains).
//
// On success, returns a percent-encoded, HTML-ATTRIBUTE-escaped string
// (e.g. a literal "&" becomes "&amp;") meant ONLY for building an
// href="..."/src="..." attribute inside markup that will itself be parsed
// by an HTML parser (assignment via innerHTML, or SocialCalc's own cell
// rendering). Do NOT persist the return value (e.g. in a saved sheet) or
// assign it directly to a DOM URL property (Element.href/.src - property
// assignment is not HTML-parsed, so the literal "&amp;" would be sent as
// part of the URL instead of decoding back to "&"). Returns null if
// rawurl must not be rendered as an active link/image target at all.
//
// Only consulted by rendering code when SocialCalc.Callbacks.untrustedContent
// is true; see SocialCalc.Callbacks.securityPolicy for the default policy.
//
// Scheme/MIME membership is checked with a plain indexed loop and strict
// (case-normalized) string equality against the small, host-supplied
// policy arrays - never a property/bracket lookup keyed by the candidate
// string. Equality comparison has no notion of "own property" vs.
// "inherited from Object.prototype", so a value like "__proto__" or
// "constructor" is just an ordinary string that fails to equal any real
// allowlist entry; there is no lookup object to pollute or shadow.
//

SC.SafeUrlForRender = function (
  rawurl: string,
  policy: SocialCalc.RenderSecurityPolicy = SocialCalc.Callbacks.securityPolicy,
): string | null {
  // Mirror the browser URL parser: strip ASCII tab/newline/CR from anywhere,
  // then leading/trailing C0 controls and spaces, before looking for a
  // scheme. Closes bypasses like "java\tscript:alert(1)". Validation and
  // the returned value both operate on this normalized form, so they can
  // never diverge (e.g. a leading space stripped for scheme-sniffing but
  // left in an emitted href).
  const noTabsOrNewlines = rawurl.replace(/[\t\n\r]/g, "");
  let start = 0;
  let end = noTabsOrNewlines.length;
  while (start < end && noTabsOrNewlines.charCodeAt(start) <= 0x20) start++;
  while (end > start && noTabsOrNewlines.charCodeAt(end - 1) <= 0x20) end--;
  const stripped = noTabsOrNewlines.slice(start, end);

  let encoded: string;
  try {
    encoded = encodeURI(stripped);
  } catch {
    return null; // malformed encoding (e.g., an unpaired surrogate) - fail closed
  }

  // encodeURI deliberately leaves "&", "#", ";" (and other RFC 3986
  // reserved/mark characters) untouched - it only percent-encodes what
  // would otherwise be an invalid URI character, not what would be unsafe
  // inside an HTML attribute. Every caller of this function places the
  // result inside href="..."/src="...". If a literal "&" survives here, an
  // HTML entity reference such as "&#58;" (":"), "&#x61;" ("a"), or
  // "&quot;" ('"') looks like harmless non-scheme text to the checks
  // below, passes validation, and is then decoded by the BROWSER'S HTML
  // PARSER - independently of any URL parsing - into a live "javascript:"
  // scheme or a quote that breaks out of the attribute into a new one
  // (e.g. onmouseover=). HTML-escaping the already percent-encoded string must
  // be the LAST step, after scheme/mime validation (which still inspects
  // the un-escaped `stripped`/`afterScheme` values). A legitimate "&" in
  // e.g. a query string ("?a=1&b=2") becomes "&amp;", which the browser
  // decodes back to a literal "&" for the actual href/src - so real URL
  // semantics are unchanged - but an attacker's literal "&#58;" becomes
  // "&amp;#58;", which decodes to the inert text "&#58;" (entity decoding
  // is one pass, not recursive), never reinterpreted as a colon. Applied
  // once per accepted return path below (schemeless/relative, allowed
  // "data:" MIME, allowed scheme) - a rejected/malicious URL returns
  // `null` directly and never pays for this escape.

  const schemeMatch = stripped.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) {
    return SocialCalc.special_chars(encoded); // no scheme: relative/path-only URL, cannot invoke a scheme handler
  }

  const scheme = schemeMatch[1].toLowerCase() + ":";

  if (scheme === "data:") {
    const afterScheme = stripped.slice(schemeMatch[0].length);
    const mime = afterScheme.match(/^([^,;]*)/)![1].toLowerCase();
    if (!mime) return null;
    const allowedDataMimeTypes = policy.allowedDataMimeTypes;
    for (let i = 0; i < allowedDataMimeTypes.length; i++) {
      if (allowedDataMimeTypes[i].toLowerCase() === mime) return SocialCalc.special_chars(encoded);
    }
    return null;
  }

  const allowedUrlSchemes = policy.allowedUrlSchemes;
  for (let i = 0; i < allowedUrlSchemes.length; i++) {
    if (allowedUrlSchemes[i].toLowerCase() === scheme) return SocialCalc.special_chars(encoded);
  }
  return null;
};

//
// result = SocialCalc.EscapeUntrustedHtml(html, policy)
//
// Renders raw HTML safely under the untrusted-content policy: applies the
// host's sanitizeHtml callback if one is configured, otherwise HTML-escapes
// the value so it displays as inert text instead of being parsed as markup.
//

SC.EscapeUntrustedHtml = function (
  html: string,
  policy: SocialCalc.RenderSecurityPolicy = SocialCalc.Callbacks.securityPolicy,
): string {
  if (typeof policy.sanitizeHtml === "function") {
    return policy.sanitizeHtml(html);
  }
  return SocialCalc.special_chars(html);
};

/** @param {any} string */
SC.special_chars = function (string: any) {
  if (/[&<>"]/.test(string)) {
    // only do "slow" replaces if something to replace
    string = string.replace(/&/g, "&amp;");
    string = string.replace(/</g, "&lt;");
    string = string.replace(/>/g, "&gt;");
    string = string.replace(/"/g, "&quot;");
  }
  return string;
};

/** @param {any} value @param {any} list */
SC.Lookup = function (value: any, list: any) {
  for (var i = 0; i < list.length; i++) {
    if (list[i] > value) {
      if (i > 0) return i - 1;
      else return null;
    }
  }
  return list.length - 1; // if all smaller, matches last
};

//
// setStyles(element, cssText)
//
// Takes a pseudo style string (e.g., text-align must be textAlign) and sets
// the element's style value for each style name listed (leaving others unchanged).
// OK to call with null cssText.
//

/** @param {any} element @param {any} cssText */
SC.setStyles = function (element: any, cssText: any) {
  var parts, part, pos, name, value;

  if (!cssText) return;

  parts = cssText.split(";");
  for (part = 0; part < parts.length; part++) {
    pos = parts[part].indexOf(":"); // find first colon (could be one in url)
    if (pos != -1) {
      name = parts[part].substring(0, pos);
      value = parts[part].substring(pos + 1);
      if (name && value) {
        // if non-null name and value, set style
        element.style[name] = value;
      }
    }
    //      namevalue = parts[part].split(":");
    //      if (namevalue[0]) element.style[namevalue[0]] = namevalue[1];
  }
};

//
// GetViewportInfo() - returns object with viewport width and height, and scroll offsets
//
// Flanagan, JavaScript, 5th Edition, page 276
//

SC.GetViewportInfo = function () {
  var result: any = {};

  if (window.innerWidth) {
    // all but IE
    result.width = window.innerWidth;
    result.height = window.innerHeight;
    result.horizontalScroll = window.pageXOffset;
    result.verticalScroll = window.pageYOffset;
  } else {
    if (document.documentElement && document.documentElement.clientWidth) {
      result.width = document.documentElement.clientWidth;
      result.height = document.documentElement.clientHeight;
      result.horizontalScroll = document.documentElement.scrollLeft;
      result.verticalScroll = document.documentElement.scrollTop;
    } else if (document.body.clientWidth) {
      result.width = document.body.clientWidth;
      result.height = document.body.clientHeight;
      result.horizontalScroll = document.body.scrollLeft;
      result.verticalScroll = document.body.scrollTop;
    }
  }

  return result;
};

//
// GetElementPosition(element) - returns object with left and top position of the element in the document
//
// Goodman's JavaScript & DHTML Cookbook, 2nd Edition, page 415
//

/** @param {any} element */
SC.GetElementPosition = function (element: any) {
  var offsetLeft = 0;
  var offsetTop = 0;
  while (element) {
    if (SocialCalc.GetComputedStyle(element, "position") == "relative") break;
    offsetLeft += element.offsetLeft;
    offsetTop += element.offsetTop;
    element = element.offsetParent;
  }
  return { left: offsetLeft, top: offsetTop };
};

//
// GetElementPositionWithScroll(element) - returns object with left and top position of the element in the document
//

/** @param {any} element */
SC.GetElementPositionWithScroll = function (element: any) {
  var rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width ? rect.width : rect.right - rect.left,
    height: rect.height ? rect.height : rect.bottom - rect.top,
  };
};

//
// GetElementFixedParent(element) - checks whether element has a parent with position:fixed
//

/** @param {any} element */
SC.GetElementFixedParent = function (element: any) {
  while (element) {
    if (element.tagName == "HTML") break;
    if (SocialCalc.GetComputedStyle(element, "position") == "fixed") return element;
    element = element.parentNode;
  }
  return false;
};

//
// GetComputedStyle(element, style) - returns computed style value
//
// http://blog.stchur.com/2006/06/21/css-computed-style/
//

/** @param {any} element @param {any} style */
SC.GetComputedStyle = function (element: any, style: any) {
  var computedStyle: any;
  if (document.defaultView) {
    computedStyle = document.defaultView.getComputedStyle(element, null);
  } else {
    return "";
  }
  return computedStyle[style];
};

//
// LookupElement(element, array) - returns array element which is an object with "element" of element
//

/** @param {any} element @param {any} array */
SC.LookupElement = function (element: any, array: any) {
  var i;
  for (i = 0; i < array.length; i++) {
    if (array[i].element == element) return array[i];
  }
  return null;
};

//
// AssignID(obj, element, id) - Optionally assigns an ID with a prefix to the element
//

/** @param {any} obj @param {any} element @param {any} id */
SC.AssignID = function (obj: any, element: any, id: any) {
  if (obj.idPrefix) {
    // Object must have a non-empty idPrefix attribute
    element.id = obj.idPrefix + id;
  }
};

//
// SocialCalc.GetCellContents(sheetobj, coord)
//
// Returns the contents (value, formula, constant, etc.) of a cell
// with appropriate prefix ("'", "=", etc.)
//

/** @param {any} sheetobj @param {any} coord */
SC.GetCellContents = function (sheetobj: any, coord: any) {
  var result = "";
  var cellobj = sheetobj.cells[coord];
  if (cellobj) {
    switch (cellobj.datatype) {
      case "v":
        result = cellobj.datavalue + "";
        break;
      case "t":
        result = "'" + cellobj.datavalue;
        break;
      case "f":
        result = "=" + cellobj.formula;
        break;
      case "c":
        result = cellobj.formula;
        break;
      default:
        break;
    }
  }

  return result;
};

//
// Routines translated from the SocialCalc 1.1.0 Perl code:
//
// (Makes use of the FormatNumber JavaScript code translated from the Perl.)
//

//
// displayvalue = FormatValueForDisplay(sheetobj, value, cr, linkstyle)
//
// Returns a string, in HTML, for the contents of a cell.
//
// The value is a either numeric or text, the cr is the coord of the cell
// (its cell properties are used to determine formatting), and linkstyle
// is a value passed to wiki-text expansion routines specifying the
// purpose of the rendering so, for example, links can be rendered differently
// during edit than with plain HTML.
//

// text = FormatCellForExport(sheet, cell, cr)
//
// Plain-text export for csv/tab (no HTML). Applies number/date formats.
//

/** @param {any} sheet @param {any} cell @param {any} _cr */
SC.FormatCellForExport = function (sheet: any, cell: any, _cr: any) {
  var valuetype, valueformat, sheetattribs;

  if (!cell) {
    return "";
  }

  sheetattribs = sheet.attribs;
  valuetype = cell.valuetype || "n";
  if (valuetype.charAt(0) == "t") {
    return cell.datavalue + "";
  }

  valueformat = cell.nontextvalueformat;
  if (valueformat == null || valueformat == "") {
    valueformat = sheetattribs.defaultnontextvalueformat;
  }
  valueformat = sheet.valueformats[valueformat - 0];
  if (valueformat == null || valueformat == "none") {
    valueformat = "";
  }

  return SocialCalc.format_number_for_display(cell.datavalue, valuetype, valueformat);
};

//
// AutoFilter header dropdown UI
//
// A safe, escaped popup reusing the same HTML-building convention as
// SocialCalc.Popup.Types.List.MakeList (js/socialcalcpopup.ts) -- every
// column-value label is run through SocialCalc.special_chars before it is
// concatenated into innerHTML, so sheet-derived cell content can never
// execute as markup inside the dropdown.
//

/** Ids of any currently open AutoFilter dropdown, for AutoFilterDropdownClose/ItemClick. */
SC.AutoFilterDropdownState = {
  popupele: null,
  sheet: null,
  filterId: "",
  colOffset: 0,
  checked: {},
};

/**
 * Build the escaped inner HTML for one AutoFilter column's dropdown: a
 * "(Select All)" toggle plus one checkbox row per distinct display value,
 * each derived via SocialCalc.CollectAutoFilterColumnValues and escaped with
 * SocialCalc.special_chars before entering the markup.
 */
SC.BuildAutoFilterDropdownHtml = function (
  sheet: any,
  filterId: string,
  colOffset: number,
): string {
  var values = SocialCalc.CollectAutoFilterColumnValues(sheet, filterId, colOffset);
  var def = sheet.autofilters[filterId];
  var existing = (def && def.criteria[colOffset] && def.criteria[colOffset].values) || null;
  var checked: { [v: string]: boolean } = {};
  for (var vi = 0; vi < values.length; vi++) {
    checked[values[vi]] = existing ? existing.indexOf(values[vi]) != -1 : true;
  }
  SocialCalc.AutoFilterDropdownState.checked = checked;

  var allChecked = values.every(function (v) {
    return checked[v];
  });

  var html =
    '<div style="cursor:default;padding:4px;font-size:x-small;max-height:200px;overflow:auto;">';
  html +=
    '<div style="white-space:nowrap;"><label><input type="checkbox" onclick="SocialCalc.AutoFilterDropdownToggleAll(this.checked)"' +
    (allChecked ? " checked" : "") +
    "> (Select All)</label></div><hr>";
  for (var i = 0; i < values.length; i++) {
    var escaped = SocialCalc.special_chars(values[i]);
    html +=
      '<div style="white-space:nowrap;"><label><input type="checkbox" data-autofilter-value="' +
      escaped +
      '" onclick="SocialCalc.AutoFilterDropdownToggleValue(this)"' +
      (checked[values[i]] ? " checked" : "") +
      "> " +
      (escaped === "" ? "(Blanks)" : escaped) +
      "</label></div>";
  }
  html +=
    '<hr><div style="white-space:nowrap;text-align:right;">' +
    '<input type="button" value="Clear Filter" onclick="SocialCalc.AutoFilterDropdownClear();">' +
    '<input type="button" value="OK" onclick="SocialCalc.AutoFilterDropdownApply();">' +
    '<input type="button" value="Cancel" onclick="SocialCalc.AutoFilterDropdownCancel();">' +
    "</div></div>";
  return html;
};

/**
 * Open the escaped dropdown popup for one AutoFilter column, anchored under
 * the header cell. Builds a standalone positioned div directly (does not
 * register through SocialCalc.Popup.Controls/CreatePopupDiv, which require
 * a pre-existing control id bound to a DOM element the List/ColorChooser
 * flow owns) -- content is assembled purely via BuildAutoFilterDropdownHtml,
 * whose only sheet-derived text (column display values) is HTML-escaped
 * with SocialCalc.special_chars before it enters innerHTML.
 */
SC.ShowAutoFilterDropdown = function (
  sheet: any,
  filterId: string,
  colOffset: number,
  anchorElement: HTMLElement,
) {
  SocialCalc.AutoFilterDropdownClose();

  var popupele = document.createElement("div");
  popupele.innerHTML = SocialCalc.BuildAutoFilterDropdownHtml(sheet, filterId, colOffset);

  var pos = SocialCalc.GetElementPositionWithScroll(anchorElement);
  popupele.style.position = "absolute";
  popupele.style.left = pos.left + "px";
  popupele.style.top = pos.bottom + "px";
  popupele.style.backgroundColor = "#FFF";
  popupele.style.border = "1px solid #888";
  popupele.style.zIndex = "1000";

  document.body.appendChild(popupele);

  SocialCalc.AutoFilterDropdownState.popupele = popupele;
  SocialCalc.AutoFilterDropdownState.sheet = sheet;
  SocialCalc.AutoFilterDropdownState.filterId = filterId;
  SocialCalc.AutoFilterDropdownState.colOffset = colOffset;
};

/**
 * Toggle every value checkbox to match the "(Select All)" checkbox.
 * querySelectorAll("input[data-autofilter-value]") only ever returns
 * elements that already have that attribute, so getAttribute cannot
 * return null here.
 */
SC.AutoFilterDropdownToggleAll = function (checkedState: boolean) {
  var state: any = SocialCalc.AutoFilterDropdownState;
  if (!state.popupele) return;
  var boxes = state.popupele.querySelectorAll("input[data-autofilter-value]");
  for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i] as HTMLInputElement;
    box.checked = checkedState;
    state.checked[box.getAttribute("data-autofilter-value") as string] = checkedState;
  }
};

/** Record one value checkbox's toggled state. */
SC.AutoFilterDropdownToggleValue = function (box: HTMLInputElement) {
  var state: any = SocialCalc.AutoFilterDropdownState;
  state.checked[box.getAttribute("data-autofilter-value") || ""] = box.checked;
};

/** Apply the checked-value set as an exact-match criterion and close. */
SC.AutoFilterDropdownApply = function () {
  var state: any = SocialCalc.AutoFilterDropdownState;
  if (!state.sheet) return;
  var selected: string[] = [];
  for (var v in state.checked) {
    if (state.checked[v]) selected.push(v);
  }
  var cmd =
    "autofilter criteria " +
    state.filterId +
    " " +
    state.colOffset +
    " " +
    SocialCalc.encodeForSave(JSON.stringify({ values: selected }));
  SocialCalc.ScheduleSheetCommands(state.sheet, cmd, true);
  SocialCalc.AutoFilterDropdownClose();
};

/** Remove this column's criterion entirely (show every value) and close. */
SC.AutoFilterDropdownClear = function () {
  var state: any = SocialCalc.AutoFilterDropdownState;
  if (!state.sheet) return;
  SocialCalc.ScheduleSheetCommands(
    state.sheet,
    "autofilter clearcol " + state.filterId + " " + state.colOffset,
    true,
  );
  SocialCalc.AutoFilterDropdownClose();
};

/** Discard changes and close without applying. */
SC.AutoFilterDropdownCancel = function () {
  SocialCalc.AutoFilterDropdownClose();
};

/** Tear down any open AutoFilter dropdown popup. */
SC.AutoFilterDropdownClose = function () {
  var state: any = SocialCalc.AutoFilterDropdownState;
  if (state.popupele && state.popupele.parentNode) {
    state.popupele.parentNode.removeChild(state.popupele);
  }
  state.popupele = null;
  state.sheet = null;
  state.filterId = "";
  state.colOffset = 0;
  state.checked = {};
};

/**
 * Find the AutoFilter (if any) whose header row is exactly `rownum` and
 * whose range covers `colnum`, returning {filterId, colOffset} or null.
 * Used by RenderCell to decide whether a data cell is an AutoFilter header
 * cell that needs a dropdown affordance.
 */
SC.FindAutoFilterForHeaderCell = function (sheetobj: any, rownum: number, colnum: number) {
  // SocialCalc.ParseRange never throws (worst case, an empty/malformed
  // range string falls back to "A1:A1" internally), so no try/catch is
  // needed here -- unlike AdjustAutoFilterRangesForStructuralEdit, which
  // guards AdjustFormulaCoords' #REF! *return value*, not an exception.
  for (var filterId in sheetobj.autofilters) {
    var def = sheetobj.autofilters[filterId];
    var prange: any = SocialCalc.ParseRange(def.range);
    if (prange.cr1.row !== rownum) continue;
    if (colnum < prange.cr1.col || colnum > prange.cr2.col) continue;
    return { filterId: filterId, colOffset: colnum - prange.cr1.col };
  }
  return null;
};

/** @param {any} sheetobj @param {any} value @param {any} cr @param {any} [linkstyle] */
SC.FormatValueForDisplay = function (sheetobj: any, value: any, cr: any, linkstyle: any) {
  var valueformat, valuetype, valuesubtype;
  var displayvalue, valueinputwidget;
  var untrusted = Boolean(SocialCalc.Callbacks.untrustedContent);

  var sheetattribs = sheetobj.attribs;

  var cell = sheetobj.cells[cr];

  if (!cell) {
    // get an empty cell if not there
    cell = new SocialCalc.Cell(cr);
  }

  displayvalue = value;

  valuetype = cell.valuetype || ""; // get type of value to determine formatting
  valuesubtype = valuetype.substring(1);

  // eddy setup display cell {
  valueinputwidget = valuetype.charAt(1);
  var formula_name = valuetype.substring(2);
  var html_display_value: any = null;
  var html_formated_value: any = null;
  // }

  valuetype = valuetype.charAt(0);

  if (cell.errors || valuetype == "e") {
    displayvalue = cell.errors || valuesubtype || "Error in cell";
    return displayvalue;
  }

  if (valuetype == "t") {
    valueformat =
      sheetobj.valueformats[cell.textvalueformat - 0] ||
      sheetobj.valueformats[sheetattribs.defaulttextvalueformat - 0] ||
      "";
    if (valueformat == "formula") {
      if (cell.datatype == "f") {
        displayvalue = SocialCalc.special_chars("=" + cell.formula) || "&nbsp;";
      } else if (cell.datatype == "c") {
        displayvalue = SocialCalc.special_chars("'" + cell.formula) || "&nbsp;";
      } else {
        displayvalue = SocialCalc.special_chars("'" + displayvalue) || "&nbsp;";
      }
      return displayvalue;
    }
    html_display_value = displayvalue; // eddy
    displayvalue = SocialCalc.format_text_for_display(
      displayvalue,
      cell.valuetype,
      valueformat,
      sheetobj,
      linkstyle,
      cell.nontextvalueformat,
    );
    html_formated_value = displayvalue; // eddy
  } else if (valuetype == "n") {
    valueformat = cell.nontextvalueformat;
    if (valueformat == null || valueformat == "") {
      //
      valueformat = sheetattribs.defaultnontextvalueformat;
    }
    valueformat = sheetobj.valueformats[valueformat - 0];
    if (valueformat == null || valueformat == "none") {
      valueformat = "";
    }

    if (valueformat == "formula") {
      if (cell.datatype == "f") {
        displayvalue = SocialCalc.special_chars("=" + cell.formula) || "&nbsp;";
      } else if (cell.datatype == "c") {
        displayvalue = SocialCalc.special_chars("'" + cell.formula) || "&nbsp;";
      } else {
        displayvalue = SocialCalc.special_chars("'" + displayvalue) || "&nbsp;";
      }
      return displayvalue;
    } else if (valueformat == "forcetext") {
      if (cell.datatype == "f") {
        displayvalue = SocialCalc.special_chars("=" + cell.formula) || "&nbsp;";
      } else if (cell.datatype == "c") {
        displayvalue = SocialCalc.special_chars(cell.formula) || "&nbsp;";
      } else {
        displayvalue = SocialCalc.special_chars(displayvalue) || "&nbsp;";
      }
      return displayvalue;
    }

    html_display_value = displayvalue; // eddy
    displayvalue = SocialCalc.format_number_for_display(displayvalue, cell.valuetype, valueformat);
    html_formated_value = displayvalue; // eddy
  } else {
    // unknown type - probably blank
    displayvalue = "&nbsp;";
  }

  // eddy display cell HTML {
  if (
    !untrusted &&
    valueinputwidget == "i" &&
    html_display_value != null &&
    html_formated_value != null
  ) {
    var parameters = sheetobj.ioParameterList[cr];

    var formula_details = SocialCalc.Formula.FunctionList[formula_name];
    //	 var ecell = SocialCalc.GetSpreadsheetControlObject().editor.ecell; // check if widget has focus
    //	 SocialCalc.GetSpreadsheetControlObject().debug.push({formula_name:formula_name});
    if (formula_details) {
      var cell_html = formula_details[5] as any;
      // var cell_html = "<button type='button' onclick=\"SocialCalc.TriggerIoAction('<%=cell_reference%>');\"><%=display_value%></button>";

      var checkedValue = html_display_value == 0 ? "" : "checked"; // for checkbox
      cell_html = cell_html.replace(/<%=checked%>/g, checkedValue);
      cell_html = cell_html.replace(/<%=formated_value%>/g, html_formated_value);
      cell_html = cell_html.replace(/<%=display_value%>/g, html_display_value);
      // replace widget HTML with parameter
      // FOR each parameter
      var parameterValue; // set to value of param for if coord, value of cell
      if (parameters) {
        // add forumla parameters to widget html
        for (var index = 0; index < parameters.length; index++) {
          // IF coord THEN replace with cell value
          if (parameters[index].type == "coord") {
            parameterValue = sheetobj.GetAssuredCell(parameters[index].value).datavalue;
          } else {
            // ELSE with param value
            parameterValue = parameters[index].value;
          }
          var paramRegExp = new RegExp("<%=parameter" + index + "_value%>", "g");
          cell_html = cell_html.replace(paramRegExp, parameterValue);
        }
        if (parameters.html) {
          // add html created in formula1.js to widget
          for (var htmlIndex = 0; htmlIndex < parameters.html.length; htmlIndex++) {
            var paramRegExp = new RegExp("<%=html" + htmlIndex + "_value%>", "g");
            cell_html = cell_html.replace(paramRegExp, parameters.html[htmlIndex]);
          }
        }
        if (parameters.css) {
          // add style(css) formula css value, if any - e.g. =textbox("")+style("margin: 8px 0;")
          // * RegEx Unit Test **  https://regex101.com/r/oV7wU5/2
          cell_html = cell_html.replace(/^(<\w+)(\W)/, "$1 style='" + parameters.css + "'$2");
        }
      }

      return cell_html.replace(/<%=cell_reference%>/g, cr);
    }
    return "error:Widget HTML missing";
  }
  // }

  return displayvalue;
};

//
// displayvalue = format_text_for_display(rawvalue, valuetype, valueformat, sheetobj, linkstyle, nontextvalueformat)
//

/** @param {any} rawvalue @param {any} valuetype @param {any} valueformat @param {any} sheetobj @param {any} linkstyle @param {any} nontextvalueformat */
SC.format_text_for_display = function (
  rawvalue: any,
  valuetype: any,
  valueformat: any,
  sheetobj: any,
  linkstyle: any,
  nontextvalueformat: any,
) {
  var valuesubtype, dvsc, dvue;
  var textval: any;
  var displayvalue;
  var untrusted = Boolean(SocialCalc.Callbacks.untrustedContent);

  valuesubtype = valuetype.substring(1);

  displayvalue = rawvalue;

  if (valueformat == "none" || valueformat == null) valueformat = "";
  if (!/^(text-|custom|hidden)/.test(valueformat)) valueformat = "";
  if (valueformat == "" || valueformat == "General") {
    // determine format from type
    if (valuesubtype == "h") valueformat = "text-html";
    if (valuesubtype == "w" || valuesubtype == "r") valueformat = "text-wiki";
    if (valuesubtype == "l") valueformat = "text-link";
    if (valuesubtype == "m") valueformat = "text-image";
    if (!valuesubtype) valueformat = "text-plain";
  }
  if (valueformat == "text-html") {
    // HTML - output as is (legacy trusted mode); escaped or sanitized when
    // rendering untrusted content (SocialCalc.Callbacks.untrustedContent).
    if (untrusted) {
      displayvalue = SocialCalc.EscapeUntrustedHtml(displayvalue);
    }
  } else if (SocialCalc.Callbacks.expand_wiki && valueformat.startsWith("text-wiki")) {
    // do general wiki markup
    displayvalue = SocialCalc.Callbacks.expand_wiki(displayvalue, sheetobj, linkstyle, valueformat);
    if (untrusted) {
      // The host's expand_wiki is not assumed to be XSS-safe by default;
      // neutralize its output the same way raw text-html is neutralized.
      displayvalue = SocialCalc.EscapeUntrustedHtml(displayvalue);
    }
  } else if (valueformat == "text-wiki") {
    // wiki text
    displayvalue =
      (SocialCalc.Callbacks.expand_markup &&
        SocialCalc.Callbacks.expand_markup(displayvalue, sheetobj, linkstyle)) || // do old wiki markup
      SocialCalc.special_chars("wiki-text:" + displayvalue);
    if (untrusted) {
      // Same rationale as expand_wiki above: an overridden expand_markup
      // callback is not assumed to be XSS-safe by default.
      displayvalue = SocialCalc.EscapeUntrustedHtml(displayvalue);
    }
  } else if (valueformat == "text-url") {
    // text is a URL for a link
    dvsc = SocialCalc.special_chars(displayvalue);
    if (untrusted) {
      dvue = SocialCalc.SafeUrlForRender(displayvalue);
      displayvalue = dvue == null ? dvsc : '<a href="' + dvue + '">' + dvsc + "</a>";
    } else {
      dvue = encodeURI(displayvalue);
      displayvalue = '<a href="' + dvue + '">' + dvsc + "</a>";
    }
  } else if (valueformat == "text-link") {
    // more extensive link capabilities for regular web links
    displayvalue = SocialCalc.expand_text_link(displayvalue, sheetobj, linkstyle, valueformat);
  } else if (valueformat == "text-image") {
    // text is a URL for an image
    if (untrusted) {
      dvue = SocialCalc.SafeUrlForRender(displayvalue);
      displayvalue =
        dvue == null ? SocialCalc.special_chars(displayvalue) : '<img src="' + dvue + '">';
    } else {
      dvue = encodeURI(displayvalue);
      displayvalue = '<img src="' + dvue + '">';
    }
  } else if (valueformat.substring(0, 12) == "text-custom:") {
    // construct a custom text format: @r = text raw, @s = special chars,
    // @u = url encoded. The template itself (valueformat) is sheet-authored
    // data too - a "valueformat:" entry parsed from the save file - so in
    // untrusted mode its literal markup cannot be trusted any more than the
    // cell's raw value can.
    dvsc = SocialCalc.special_chars(displayvalue); // do special chars
    dvsc = dvsc.replace(/  /g, "&nbsp; "); // keep multiple spaces
    dvsc = dvsc.replace(/\n/g, "<br>"); // keep line breaks
    var customTemplate = valueformat.substring(12); // remove "text-custom:"
    /** @type {any} */
    textval = {};
    if (untrusted && typeof SocialCalc.Callbacks.securityPolicy.sanitizeHtml === "function") {
      // Host has an explicit sanitizer: expand with the template author's
      // intended (trusted-mode) semantics, then sanitize the fully
      // expanded HTML - template markup and substituted values together -
      // in one pass.
      textval.r = displayvalue;
      textval.u = encodeURI(displayvalue);
      textval.s = dvsc;
      displayvalue = SocialCalc.EscapeUntrustedHtml(
        customTemplate.replace(
          /@(r|s|u)/g,
          /** @param {any} a @param {any} c */ function (a: any, c: any) {
            return textval[c];
          },
        ),
      );
    } else if (untrusted) {
      // No sanitizer configured: the template's own literal markup is just
      // as unverified as raw cell HTML, so it is escaped segment by
      // segment. Only the @r/@s/@u placeholder values keep their
      // established untrusted-mode substitution (raw text escaped/
      // sanitized, url scheme-checked).
      textval.r = SocialCalc.EscapeUntrustedHtml(displayvalue);
      textval.u = SocialCalc.SafeUrlForRender(displayvalue) || "";
      textval.s = dvsc;
      displayvalue = customTemplate
        .split(/(@[rsu])/g)
        .map(function (part: string) {
          return part === "@r" || part === "@s" || part === "@u"
            ? textval[part.charAt(1)]
            : SocialCalc.special_chars(part);
        })
        .join("");
    } else {
      textval.r = displayvalue;
      textval.u = encodeURI(displayvalue);
      textval.s = dvsc;
      displayvalue = customTemplate.replace(
        /@(r|s|u)/g,
        /** @param {any} a @param {any} c */ function (a: any, c: any) {
          return textval[c];
        },
      ); // replace placeholders
    }
  } else if (valueformat.substring(0, 6) == "custom") {
    // custom
    displayvalue = SocialCalc.special_chars(displayvalue); // do special chars
    displayvalue = displayvalue.replace(/  /g, "&nbsp; "); // keep multiple spaces
    displayvalue = displayvalue.replace(/\n/g, "<br>"); // keep line breaks
    displayvalue += " (custom format)";
  } else if (valueformat == "hidden") {
    displayvalue = "&nbsp;";
  } else if (
    nontextvalueformat != null &&
    nontextvalueformat != "" &&
    sheetobj.valueformats[nontextvalueformat - 0] != "none" &&
    sheetobj.valueformats[nontextvalueformat - 0] != ""
  ) {
    valueformat = sheetobj.valueformats[nontextvalueformat];
    displayvalue = SocialCalc.format_number_for_display(rawvalue, valuetype, valueformat);
  } else {
    // plain text
    displayvalue = SocialCalc.special_chars(displayvalue); // do special chars
    displayvalue = displayvalue.replace(/  /g, "&nbsp; "); // keep multiple spaces
    displayvalue = displayvalue.replace(/\n/g, "<br>"); // keep line breaks
  }

  return displayvalue;
};

//
// displayvalue = format_number_for_display(rawvalue, valuetype, valueformat)
//

/** @param {any} rawvalue @param {any} valuetype @param {any} valueformat */
SC.format_number_for_display = function (rawvalue: any, valuetype: any, valueformat: any) {
  var value, valuesubtype;
  var scc = SocialCalc.Constants;

  value = rawvalue - 0;

  valuesubtype = valuetype.substring(1);

  if (valueformat == "Auto" || valueformat == "") {
    // cases with default format
    if (valuesubtype == "%") {
      // will display a % character
      valueformat = scc.defaultFormatp;
    } else if (valuesubtype == "$") {
      valueformat = scc.defaultFormatc;
    } else if (valuesubtype == "dt") {
      valueformat = scc.defaultFormatdt;
    } else if (valuesubtype == "d") {
      valueformat = scc.defaultFormatd;
    } else if (valuesubtype == "t") {
      valueformat = scc.defaultFormatt;
    } else if (valuesubtype == "l") {
      valueformat = "logical";
    } else {
      valueformat = "General";
    }
  }

  if (valueformat == "logical") {
    // do logical format
    return value ? scc.defaultDisplayTRUE : scc.defaultDisplayFALSE;
  }

  if (valueformat == "hidden") {
    // do hidden format
    return "&nbsp;";
  }

  // Use format

  return SocialCalc.FormatNumber.formatNumberWithFormat(rawvalue, valueformat, "");
};

//
// valueinfo = DetermineValueType(rawvalue)
//
// Takes a value and looks for special formatting like $, %, numbers, etc.
// Returns the value as a number or string and the type as {value: value, type: type}.
// Tries to follow the spec for spreadsheet function VALUE(v).
//

/** @param {any} rawvalue */
SC.DetermineValueType = function (rawvalue: any) {
  var value: any = rawvalue + "";
  var type = "t";
  var tvalue: any;
  var matches: any;
  var year: any;
  var hour: any;
  var minute: any;
  var second: any;
  var denom: any;
  var num: any;
  var intgr: any;
  var constr: any;

  tvalue = value.replace(/^\s+/, ""); // remove leading and trailing blanks
  tvalue = tvalue.replace(/\s+$/, "");

  if (value.length == 0) {
    type = "";
  } else if (value.match(/^\s+$/)) {
    // just blanks
    // leave type "t"
  } else if (tvalue.match(/^[-+]?\d*(?:\.)?\d*(?:[eE][-+]?\d+)?$/)) {
    // general number, including E
    value = tvalue - 0; // try converting to number
    if (isNaN(value)) {
      // leave alone - catches things like plain "-"
      value = rawvalue + "";
    } else {
      type = "n";
    }
  } else if (tvalue.match(/^[-+]?\d*(?:\.)?\d*\s*%$/)) {
    // percent form: 15.1%
    value = (tvalue.slice(0, -1) - 0) / 100; // convert and scale
    type = "n%";
  } else if (tvalue.match(/^[-+]?\$\s*\d*(?:\.)?\d*\s*$/) && tvalue.match(/\d/)) {
    // $ format: $1.49
    value = tvalue.replace(/\$/, "") - 0;
    type = "n$";
  } else if (tvalue.match(/^[-+]?(\d*,\d*)+(?:\.)?\d*$/)) {
    // number format ignoring commas: 1,234.49
    value = tvalue.replace(/,/g, "") - 0;
    type = "n";
  } else if (tvalue.match(/^[-+]?(\d*,\d*)+(?:\.)?\d*\s*%$/)) {
    // % with commas: 1,234.49%
    value = (tvalue.replace(/[%,]/g, "") - 0) / 100;
    type = "n%";
  } else if (tvalue.match(/^[-+]?\$\s*(\d*,\d*)+(?:\.)?\d*$/) && tvalue.match(/\d/)) {
    // $ and commas: $1,234.49
    value = tvalue.replace(/[$,]/g, "") - 0;
    type = "n$";
  } else if ((matches = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{1,4})\s*$/))) {
    // MM-DD-YYYY, MM/DD/YYYY
    year = matches[3] - 0;
    year = year < 1000 ? year + 2000 : year;
    value =
      navigator.language.indexOf("fr") === 0
        ? SocialCalc.FormatNumber.convert_date_gregorian_to_julian(
            year,
            matches[2] - 0,
            matches[1] - 0,
          ) - 2415019
        : SocialCalc.FormatNumber.convert_date_gregorian_to_julian(
            year,
            matches[1] - 0,
            matches[2] - 0,
          ) - 2415019;
    type = "nd";
  } else if ((matches = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s*$/))) {
    // YYYY-MM-DD, YYYY/MM/DD
    year = matches[1] - 0;
    year = year < 1000 ? year + 2000 : year;
    value =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(
        year,
        matches[2] - 0,
        matches[3] - 0,
      ) - 2415019;
    type = "nd";
  } else if (
    (matches = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2}) (\d{1,2}):(\d{1,2})\s*$/))
  ) {
    // YYYY-MM-DD, YYYY/MM/DD HH:MM
    // eddy added YYYY-MM-DD, YYYY/MM/DD HH:MM
    year = matches[1] - 0;
    year = year < 1000 ? year + 2000 : year;
    hour = matches[4] - 0;
    minute = matches[5] - 0;
    value =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(
        year,
        matches[2] - 0,
        matches[3] - 0,
      ) - 2415019;
    type = "nd";
    if (hour < 24 && minute < 60) {
      value += hour / 24 + minute / (24 * 60);
      type = "ndt";
    }
  } else if (
    (matches = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})\s*$/))
  ) {
    // YYYY-MM-DD, YYYY/MM/DD HH:MM:SS
    // eddy added YYYY-MM-DD, YYYY/MM/DD HH:MM:SS
    year = matches[1] - 0;
    year = year < 1000 ? year + 2000 : year;
    hour = matches[4] - 0;
    minute = matches[5] - 0;
    second = matches[6] - 0;
    value =
      SocialCalc.FormatNumber.convert_date_gregorian_to_julian(
        year,
        matches[2] - 0,
        matches[3] - 0,
      ) - 2415019;
    type = "nd";
    if (hour < 24 && minute < 60 && second < 60) {
      value += hour / 24 + minute / (24 * 60) + second / (24 * 60 * 60);
      type = "ndt";
    }
  } else if ((matches = value.match(/^(\d{1,2}):(\d{1,2})\s*$/))) {
    // HH:MM
    hour = matches[1] - 0;
    minute = matches[2] - 0;
    if (hour < 24 && minute < 60) {
      value = hour / 24 + minute / (24 * 60);
      type = "nt";
    }
  } else if ((matches = value.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})\s*$/))) {
    // HH:MM:SS
    hour = matches[1] - 0;
    minute = matches[2] - 0;
    second = matches[3] - 0;
    if (hour < 24 && minute < 60 && second < 60) {
      value = hour / 24 + minute / (24 * 60) + second / (24 * 60 * 60);
      type = "nt";
    }
  } else if ((matches = value.match(/^\s*([-+]?\d+) (\d+)\/(\d+)\s*$/))) {
    // 1 1/2
    intgr = matches[1] - 0;
    num = matches[2] - 0;
    denom = matches[3] - 0;
    if (denom && denom > 0) {
      value = intgr + (intgr < 0 ? -num / denom : num / denom);
      type = "n";
    }
  } else if ((constr = SocialCalc.InputConstants[value.toUpperCase()])) {
    // special constants, like "false" and #N/A
    num = constr.indexOf(",");
    value = constr.substring(0, num) - 0;
    type = constr.substring(num + 1);
  } else if (tvalue.length > 8 && tvalue.substring(0, 8).toLowerCase() == "https://") {
    // URL
    value = tvalue;
    type = "tl";
  } else if (tvalue.length > 7 && tvalue.substring(0, 7).toLowerCase() == "http://") {
    // URL
    value = tvalue;
    type = "tl";
  } else if (tvalue.match(/<([A-Z][A-Z0-9]*)\b[^>]*>[\s\S]*?<\/\1>/i)) {
    // HTML
    value = tvalue;
    type = "th";
  }

  return { value: value, type: type };
};

SC.InputConstants = {
  // strings that turn into constants for SocialCalc.DetermineValueType
  TRUE: "1,nl",
  FALSE: "0,nl",
  "#N/A": "0,e#N/A",
  "#NULL!": "0,e#NULL!",
  "#NUM!": "0,e#NUM!",
  "#DIV/0!": "0,e#DIV/0!",
  "#VALUE!": "0,e#VALUE!",
  "#REF!": "0,e#REF!",
  "#NAME?": "0,e#NAME?",
};

//
// result = default_expand_markup(displayvalue, sheetobj, linkstyle)
//
// Processes wiki-text -- this is a placeholder.
// Reference to here in SocialCalc.expand_markup should be replaced by application-specific routine.
//

/** @param {any} displayvalue @param {any} _sheetobj @param {any} _linkstyle */
SC.default_expand_markup = function (displayvalue: any, _sheetobj: any, _linkstyle: any) {
  var result = displayvalue;

  result = SocialCalc.special_chars(result); // do special chars
  result = result.replace(/  /g, "&nbsp; "); // keep multiple spaces
  result = result.replace(/\n/g, "<br>"); // keep line breaks

  return result; // do very little by default
};

//
// result = SocialCalc.expand_text_link(displayvalue, sheetobj, linkstyle, valueformat)
//
// Parses link text (URL, descriptions, pagenames, workspace names) and returns HTML
//

/** @param {any} displayvalue @param {any} sheetobj @param {any} linkstyle @param {any} valueformat */
SC.expand_text_link = function (
  displayvalue: any,
  sheetobj: any,
  linkstyle: any,
  valueformat: any,
) {
  var desc, tb, str;

  var scc = SocialCalc.Constants;

  var url = "";
  var parts = SocialCalc.ParseCellLinkText(displayvalue + "");

  if (parts.desc) {
    desc = SocialCalc.special_chars(parts.desc);
  } else {
    desc = parts.pagename ? scc.defaultPageLinkFormatString : scc.defaultLinkFormatString;
  }

  if (
    displayvalue.length > 7 &&
    displayvalue.substring(0, 7).toLowerCase() == "http://" &&
    displayvalue.charAt(displayvalue.length - 1) != ">"
  ) {
    desc = desc.substring(7); // remove http:// unless explicit
  }

  tb = parts.newwin || !linkstyle ? ' target="_blank"' : "";

  if (parts.pagename) {
    if (SocialCalc.Callbacks.MakePageLink) {
      url = SocialCalc.Callbacks.MakePageLink(
        parts.pagename,
        (parts as any).workspacename,
        linkstyle,
        valueformat,
      );
      if (SocialCalc.Callbacks.untrustedContent) {
        // parts.pagename/workspacename are sheet-authored (parsed from the
        // cell's [pagename]/{workspace [pagename]} link syntax);
        // MakePageLink is a host callback and is not assumed to return an
        // XSS-safe URL by default, so its result is validated the same
        // way any other untrusted URL is.
        var safePageUrl = SocialCalc.SafeUrlForRender(url);
        if (safePageUrl == null) {
          return desc; // unsafe scheme/encoding: no active link, show text only
        }
        url = safePageUrl;
      }
    }
    //      else if (parts.workspace) {
    //         url = "/" + encodeURI(parts.workspace) + "/" + encodeURI(parts.pagename);
    //         }
    //      else {
    //         url = parts.pagename;
    //         }
  } else if (SocialCalc.Callbacks.untrustedContent) {
    var safeUrl = SocialCalc.SafeUrlForRender(parts.url);
    if (safeUrl == null) {
      return desc; // unsafe scheme/encoding: no active link, show text only
    }
    url = safeUrl;
  } else {
    url = encodeURI(parts.url);
  }
  str = '<a href="' + url + '"' + tb + ">" + desc + "</a>";

  return str;
};

//
// result = SocialCalc.ParseCellLinkText(str)
//
// Given: url = http://www.someurl.com/more, desc = Some descriptive text
//
// Takes the following:
//
//    url
//    <url>
//    desc<url>
//    "desc"<url>
//    <<>> instead of <> => target="_blank" (new window)
//
//    [page name]
//    "desc"[page name]
//    desc[page name]
//    {workspace name [page name]}
//    "desc"{workspace name [page name]}
//    [[]] instead of [] => target="_blank" (new window)
//
//
// Returns: {url: url, desc: desc, newwin: t/f, pagename: pagename, workspace: workspace}
//

/** @param {any} str */
SC.ParseCellLinkText = function (str: any) {
  var result = { url: "", desc: "", newwin: false, pagename: "", workspace: "" };

  var pageform = false;
  var urlend = str.length - 1;
  var descstart = 0;
  var lastlt = str.lastIndexOf("<");
  var lastbrkt = str.lastIndexOf("[");
  var lastbrace = str.lastIndexOf("{");
  var descend = -1;
  var wsend = 0;

  if (
    (str.charAt(urlend) != ">" || lastlt == -1) &&
    (str.charAt(urlend) != "]" || lastbrkt == -1) &&
    (str.charAt(urlend) != "}" ||
      str.charAt(urlend - 1) != "]" ||
      lastbrace == -1 ||
      lastbrkt == -1 ||
      lastbrkt < lastbrace)
  ) {
    // plain url
    urlend++;
    descend = urlend;
  } else {
    // some markup
    if (str.charAt(urlend) == ">") {
      // url form
      descend = lastlt - 1;
      if (lastlt > 0 && str.charAt(descend) == "<" && str.charAt(urlend - 1) == ">") {
        descend--;
        urlend--;
        result.newwin = true;
      }
    } else if (str.charAt(urlend) == "]") {
      // plain page form
      descend = lastbrkt - 1;
      pageform = true;
      if (lastbrkt > 0 && str.charAt(descend) == "[" && str.charAt(urlend - 1) == "]") {
        descend--;
        urlend--;
        result.newwin = true;
      }
    } else {
      // page and workspace form
      descend = lastbrace - 1;
      pageform = true;
      wsend = lastbrkt;
      urlend--;
      if (lastbrkt > 0 && str.charAt(lastbrkt - 1) == "[" && str.charAt(urlend - 1) == "]") {
        wsend = lastbrkt - 1;
        urlend--;
        result.newwin = true;
      }
      if (str.charAt(wsend - 1) == " ") {
        // trim trailing space in workspace name
        wsend--;
      }
      result.workspace = str.substring(lastbrace + 1, wsend) || "";
    }

    if (str.charAt(descend) == " ") {
      // trim trailing space on desc
      descend--;
    }

    if (str.charAt(descstart) == '"' && str.charAt(descend) == '"') {
      descstart++;
      descend--;
    }
  }

  if (pageform) {
    result.pagename = str.substring(lastbrkt + 1, urlend) || "";
  } else {
    result.url = str.substring(lastlt + 1, urlend) || "";
  }

  if (descend >= descstart) {
    result.desc = str.substring(descstart, descend + 1);
  }

  return result;
};

// *************************************
//
// Interoperability helpers: BOM handling, locale-numeric parsing, and
// quote-aware unquoted-character substitution shared by the CSV/TSV
// locale-import variants, the normalized-workbook ingestion seam, and the
// FODS exporter below. Pure mirrors are verified in lemma/number-parse.ts;
// test/lemma-number-parse-facade.test.ts cross-checks these shipping
// functions against that facade so both stay in lock-step.
//
// *************************************

// result = SocialCalc.HasUtf8Bom(s)
//
// True iff s begins with a literal U+FEFF byte-order-mark code unit (the
// character a UTF-8-with-BOM file decodes to at offset 0). Pure/no I/O:
// callers are responsible for decoding file bytes to a JS string first.

/** @param {string} s */
SC.HasUtf8Bom = function (s: any): boolean {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff;
};

// result = SocialCalc.StripUtf8Bom(s)
//
// Strips a single leading U+FEFF BOM if present; returns s unchanged
// otherwise. Never strips more than one code unit, so an actual leading
// U+FEFF cell value beyond position 0 is untouched.

/** @param {string} s */
SC.StripUtf8Bom = function (s: any): string {
  return SocialCalc.HasUtf8Bom(s) ? s.slice(1) : s;
};

// result = SocialCalc.GroupingCharFor(decimalChar)
//
// Explicit-locale decimal-point classifier -- NOT an autodetecting tie-
// break. The caller declares the locale's decimal character up front
// (decimalChar is exactly "," or "."); the OTHER character is therefore
// ALWAYS the thousands-grouping separator in that locale, regardless of
// which one occurs later in the string. A "rightmost separator wins"
// heuristic was considered and rejected: under a fixed EU locale it would
// misclassify a pure-grouping token like "1.234" (dot only, no comma) as
// dot-decimal 1.234 instead of the intended grouped integer 1234, silently
// corrupting the value. Fixed-locale mode must never guess.
// Returns the grouping character to strip unconditionally, or "" if
// decimalChar is neither "," nor ".".
// Pure mirror verified as lemma/number-parse.ts#groupingCharFor.

/** @param {string} decimalChar */
SC.GroupingCharFor = function (decimalChar: any): string {
  if (decimalChar === ".") return ",";
  if (decimalChar === ",") return ".";
  return "";
};

// result = SocialCalc.ParseLocaleNumericToken(tvalue, decimalChar)
//
// Classifies a numeric-shaped token under an explicit fixed locale:
// decimalChar (must be "," or ".") is always the decimal point;
// GroupingCharFor(decimalChar) is always the thousands-grouping character
// and every occurrence of it is stripped unconditionally (never guessed
// from position). Returns {ok:true, value:number} on a recognized numeric
// token (optionally %-suffixed, in which case value is already divided by
// 100 and percent is true), or {ok:false} if the token is not
// numeric-shaped, has more than one decimal point, or decimalChar is
// invalid.

/** @param {string} tvalue @param {string} decimalChar */
SC.ParseLocaleNumericToken = function (
  tvalue: any,
  decimalChar: any,
): { ok: boolean; value: number; percent: boolean } {
  var groupChar = SocialCalc.GroupingCharFor(decimalChar);
  if (groupChar === "") return { ok: false, value: 0, percent: false };
  var raw = tvalue;
  var percent = false;
  if (raw.length > 0 && raw.charAt(raw.length - 1) === "%") {
    percent = true;
    raw = raw.slice(0, -1);
  }
  var allowed = decimalChar === "." ? /^[-+]?[0-9.,]+$/ : /^[-+]?[0-9,.]+$/;
  if (!allowed.test(raw) || !/[0-9]/.test(raw)) {
    return { ok: false, value: 0, percent: false };
  }
  // strip every grouping-character occurrence unconditionally (fixed locale, no guessing)
  var groupSplit = raw.split(groupChar);
  var stripped = groupSplit.join("");
  // exactly zero or one decimalChar remains after grouping strip
  var decimalParts = stripped.split(decimalChar);
  if (decimalParts.length > 2) return { ok: false, value: 0, percent: false };
  // After the regex check (must contain at least one digit) and the
  // decimalParts length check (at most one decimal separator), the
  // normalized string is always a sequence of digits with at most one
  // decimal point -- always parseable as a number, never NaN.
  // The `isNaN` guard that was here was provably unreachable and removed.
  var normalized = decimalChar === "." ? stripped : decimalParts.join(".");
  var num = normalized - 0;
  return { ok: true, value: percent ? num / 100 : num, percent: percent };
};

// result = SocialCalc.ReplaceUnquotedFormulaChar(text, from, to)
//
// Quote-aware single-character substitution matching SocialCalc's formula
// lexer's quote model exactly (both ' and " open/close the same quote
// class; a doubled quote char while inside a quoted run is a literal
// escaped quote). Used only by the explicit opt-in ingestion-time formula
// separator normalization below -- never by the parser itself.
// Pure mirror verified as lemma/number-parse.ts#replaceUnquotedChar.

/** @param {string} text @param {string} from @param {string} to */
SC.ReplaceUnquotedFormulaChar = function (text: any, from: any, to: any): string {
  var result = "";
  var inQuote = false;
  var i = 0;
  while (i < text.length) {
    var ch = text.charAt(i);
    if (ch === "'" || ch === '"') {
      if (inQuote && i + 1 < text.length && text.charAt(i + 1) === ch) {
        result += ch + ch;
        i += 2;
        continue;
      }
      inQuote = !inQuote;
      result += ch;
      i += 1;
      continue;
    }
    if (!inQuote && ch === from) {
      result += to;
    } else {
      result += ch;
    }
    i += 1;
  }
  return result;
};

// result = SocialCalc.NormalizeNamedRangeName(raw)
//
// Upper-cases and strips every character outside [A-Z0-9_.] -- pure mirror
// of the shipping "name" command's normalization
// (name.toUpperCase().replace(/[^A-Z0-9_.]/g, "")).

/** @param {string} raw */
SC.NormalizeNamedRangeName = function (raw: any): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_.]/g, "");
};

// result = SocialCalc.IsValidNamedRangeName(raw)
//
// True iff raw is non-empty and already in normalized form (round-trips
// through NormalizeNamedRangeName unchanged).

/** @param {string} raw */
SC.IsValidNamedRangeName = function (raw: any): boolean {
  return raw.length > 0 && SocialCalc.NormalizeNamedRangeName(raw) === raw;
};

// result = SocialCalc.IsValidNormalizedCellCoord(key)
//
// True iff key is a syntactically valid, unqualified, uppercase A1 cell
// coordinate (1-2 letters A-Z, no leading-zero digits) -- lexical shape
// only; column ZZ/row-1 band bounds are the caller's job (coordToCr).

/** @param {string} key */
SC.IsValidNormalizedCellCoord = function (key: any): boolean {
  var i = 0;
  var letters = 0;
  while (i < key.length && key.charAt(i) >= "A" && key.charAt(i) <= "Z") {
    letters++;
    i++;
    if (letters > 2) return false;
  }
  if (letters === 0) return false;
  if (i >= key.length) return false;
  if (key.charAt(i) === "0") return false;
  var digits = 0;
  while (i < key.length) {
    if (key.charAt(i) < "0" || key.charAt(i) > "9") return false;
    digits++;
    i++;
  }
  return digits > 0;
};

//
// result = SocialCalc.ConvertSaveToOtherFormat(savestr, outputformat, dorecalc)
//
// Returns a string in the specificed format: "scsave", "html", "csv", "tab" (tab delimited)
// If dorecalc is true, performs a recalc after loading (NO: obsolete!).
//

/** @param {any} savestr @param {any} outputformat @param {any} dorecalc */
SC.ConvertSaveToOtherFormat = function (savestr: any, outputformat: any, dorecalc: any) {
  var sheet, context, clipextents, div, ele, row, col, cr, cell, str;

  var result = "";

  if (outputformat == "scsave") {
    return savestr;
  }

  if (savestr == "") {
    return "";
  }

  sheet = new SocialCalc.Sheet();
  sheet.ParseSheetSave(savestr);

  if (dorecalc) {
    // no longer supported as of 9/10/08
    // Recalc is now async, so can't do it this way
    throw "SocialCalc.ConvertSaveToOtherFormat: Not doing recalc.";
  }

  if (sheet.copiedfrom) {
    clipextents = SocialCalc.ParseRange(sheet.copiedfrom);
  } else {
    clipextents = {
      cr1: { row: 1, col: 1 },
      cr2: { row: sheet.attribs.lastrow, col: sheet.attribs.lastcol },
    };
  }

  if (outputformat == "html") {
    context = new SocialCalc.RenderContext(sheet);
    if (sheet.copiedfrom) {
      context.rowpanes[0] = { first: clipextents.cr1.row, last: clipextents.cr2.row };
      context.colpanes[0] = { first: clipextents.cr1.col, last: clipextents.cr2.col };
    }
    div = document.createElement("div");
    ele = context.RenderSheet(null, context.defaultHTMLlinkstyle);
    div.appendChild(ele);
    result = div.innerHTML;
    return result;
  }

  // "csv-excel"/"tab-excel" are opt-in Windows/Excel-friendly variants:
  // a leading UTF-8 BOM (so Excel auto-detects UTF-8 instead of guessing
  // the system codepage) and CRLF row terminators (RFC 4180 line ending).
  // The legacy "csv"/"tab" outputs below are completely unaffected -- same
  // code path, same LF terminator, same lack of BOM -- so every existing
  // caller/test/fixture byte-for-byte matches prior behavior.
  var isExcelVariant = outputformat == "csv-excel" || outputformat == "tab-excel";
  var effectiveOutputFormat =
    outputformat == "csv-excel" ? "csv" : outputformat == "tab-excel" ? "tab" : outputformat;
  var rowTerminator = isExcelVariant ? "\r\n" : "\n";

  // Legacy behavior for any OTHER outputformat (including entirely unknown
  // values) is preserved exactly: fall through to the loop below and emit
  // unformatted values with no separator at all (neither the "csv" nor
  // "tab" branch inside the loop matches, so `str` is appended as-is).

  for (row = clipextents.cr1.row; row <= clipextents.cr2.row; row++) {
    for (col = clipextents.cr1.col; col <= clipextents.cr2.col; col++) {
      cr = SocialCalc.crToCoord(col, row);
      cell = sheet.GetAssuredCell(cr);

      if (cell.errors) {
        str = cell.errors;
      } else {
        str = (SocialCalc as any).FormatCellForExport(sheet, cell, cr);
      }

      if (effectiveOutputFormat == "csv") {
        if (str.indexOf('"') != -1) {
          str = str.replace(/"/g, '""'); // double quotes
        }
        if (/[, \n"]/.test(str)) {
          str = '"' + str + '"'; // add quotes
        }
        if (col > clipextents.cr1.col) {
          str = "," + str; // add commas
        }
      } else if (effectiveOutputFormat == "tab") {
        if (str.indexOf("\n") != -1) {
          // if multiple lines
          if (str.indexOf('"') != -1) {
            str = str.replace(/"/g, '""'); // double quotes
          }
          str = '"' + str + '"'; // add quotes
        }
        if (col > clipextents.cr1.col) {
          str = "\t" + str; // add tabs
        }
      }
      result += str;
    }
    result += rowTerminator;
  }

  if (isExcelVariant) {
    result = "\ufeff" + result;
  }

  return result;
};

//
// result = SocialCalc.ConvertOtherFormatToSave(inputstr, inputformat)
//
// Returns a string converted from the specified format: "scsave", "csv", "tab" (tab delimited)
//

/** @param {any} inputstr @param {any} inputformat */
SC.ConvertOtherFormatToSave = function (inputstr: any, inputformat: any) {
  var sheet: any;
  var lines: any;
  var i: any;
  var line: any;
  var value: any;
  var inquote: any;
  var j: any;
  var ch: any;
  var row: any;
  var col: any;
  var cr: any;
  var maxc: any;

  var result = "";

  var AddCell = function () {
    col++;
    if (col > maxc) maxc = col;
    cr = SocialCalc.crToCoord(col, row);
    SocialCalc.SetConvertedCell(sheet, cr, value, decimalChar);
    value = "";
  };

  if (inputformat == "scsave") {
    return inputstr;
  }

  // Locale CSV variant: "csv-eu" uses ";" as the field delimiter and ","
  // as the decimal point (comma-decimal European convention), matching the
  // delimiter Excel/LibreOffice write when the OS locale's list separator
  // is a comma (so "," can't double as both delimiter and decimal). The
  // legacy "csv"/"tab" formats are BYTE-IDENTICAL to their pre-existing
  // behavior except for the new leading-BOM strip below, which is safe by
  // construction: a leading U+FEFF was never valid CSV/TSV content.
  var delimiter = inputformat == "csv-eu" ? ";" : inputformat == "csv" ? "," : "\t";
  var decimalChar = inputformat == "csv-eu" ? "," : ".";
  var effectiveFormat = inputformat == "csv-eu" ? "csv-eu" : inputformat == "csv" ? "csv" : "tab";

  if (inputformat != "csv" && inputformat != "tab" && inputformat != "csv-eu") {
    return result;
  }

  inputstr = SocialCalc.StripUtf8Bom(inputstr);

  sheet = new SocialCalc.Sheet();

  lines = inputstr.split(/\r\n|\n/);

  maxc = 0;
  if (effectiveFormat == "csv" || effectiveFormat == "csv-eu") {
    row = 0;
    inquote = false;
    for (i = 0; i < lines.length; i++) {
      if (i == lines.length - 1 && lines[i] == "") break; // extra null line - ignore
      if (inquote) {
        // if inquote, just continue from where left off
        value += "\n";
      } else {
        // otherwise next row
        value = "";
        row++;
        col = 0;
      }
      line = lines[i];
      for (j = 0; j < line.length; j++) {
        ch = line.charAt(j);
        if (ch == '"') {
          if (inquote) {
            if (j < line.length - 1 && line.charAt(j + 1) == '"') {
              // double quotes
              j++; // skip the second one
              value += '"'; // add one quote
            } else {
              inquote = false;
              if (j == line.length - 1) {
                // at end of line
                AddCell();
              }
            }
          } else {
            inquote = true;
          }
          continue;
        }
        if (ch == delimiter && !inquote) {
          AddCell();
        } else {
          value += ch;
        }
        if (j == line.length - 1 && !inquote) {
          AddCell();
        }
      }
    }
    if (maxc > 0) {
      sheet.attribs.lastrow = row;
      sheet.attribs.lastcol = maxc;
      result = sheet.CreateSheetSave("A1:" + SocialCalc.crToCoord(maxc, row));
    }
  }

  if (effectiveFormat == "tab") {
    row = 0;
    inquote = false;
    for (i = 0; i < lines.length; i++) {
      if (i == lines.length - 1 && lines[i] == "") break; // extra null line - ignore
      if (inquote) {
        // if inquote, just continue from where left off
        value += "\n";
      } else {
        // otherwise next row
        value = "";
        row++;
        col = 0;
      }
      line = lines[i];
      for (j = 0; j < line.length; j++) {
        ch = line.charAt(j);
        if (ch == '"') {
          if (inquote) {
            if (j < line.length - 1) {
              if (line.charAt(j + 1) == '"') {
                // double quotes
                j++; // skip the second one
                value += '"'; // add one quote
              } else if (line.charAt(j + 1) == "\t") {
                // end of quoted item
                j++;
                inquote = false;
                AddCell();
              }
            } else {
              // at end of line
              inquote = false;
              AddCell();
            }
            continue;
          }
          if (value == "") {
            // quote at start of item
            inquote = true;
            continue;
          }
        }
        if (ch == "\t" && !inquote) {
          AddCell();
        } else {
          value += ch;
        }
        if (j == line.length - 1 && !inquote) {
          AddCell();
        }
      }
    }
    if (maxc > 0) {
      sheet.attribs.lastrow = row;
      sheet.attribs.lastcol = maxc;
      result = sheet.CreateSheetSave("A1:" + SocialCalc.crToCoord(maxc, row));
    }
  }

  return result;
};

//
// SocialCalc.SetConvertedCell(sheet, cr, rawvalue)
//
// Sets the cell cr with a value and type determined from rawvalue
//

// The optional decimalChar parameter enables locale-aware numeric parsing
// ("," for the "csv-eu" input variant); when omitted or ".", behavior is
// BYTE-IDENTICAL to the pre-existing single-argument SetConvertedCell
// (DetermineValueType alone, no locale branch taken).

/** @param {any} sheet @param {any} cr @param {any} rawvalue @param {any} [decimalChar] */
SC.SetConvertedCell = function (sheet: any, cr: any, rawvalue: any, decimalChar: any): void {
  var cell, value;

  cell = sheet.GetAssuredCell(cr);

  if (typeof rawvalue == "string" && rawvalue.charAt(0) == "=") {
    cell.datatype = "f";
    cell.formula = rawvalue.substring(1);
    cell.datavalue = 0;
    cell.valuetype = "e#N/A";
    delete cell.errors;
    delete cell.displaystring;
    delete cell.parseinfo;
    return;
  }

  if (decimalChar === "," && typeof rawvalue == "string") {
    var locale = SocialCalc.ParseLocaleNumericToken(rawvalue, ",");
    if (locale.ok) {
      if (locale.percent) {
        // Mirror the legacy DetermineValueType "special number types" branch
        // (datatype "c" + preserved original text) so a locale percent
        // literal round-trips identically to a non-locale one: re-editing
        // the cell shows the original "15,1%" text, not a bare "0.151".
        cell.datatype = "c";
        cell.valuetype = "n%";
        cell.datavalue = locale.value;
        cell.formula = rawvalue;
      } else {
        cell.datatype = "v";
        cell.valuetype = "n";
        cell.datavalue = locale.value;
      }
      return;
    }
    if (rawvalue.indexOf(",") !== -1) {
      // A comma-bearing token that FAILED explicit EU-locale numeric
      // parsing must not fall through to DetermineValueType's US-locale
      // comma-thousands regex: that regex would silently reinterpret a
      // malformed EU-locale token under the OPPOSITE locale's rules (e.g.
      // "1,2,3" -- malformed under EU comma-decimal parsing -- would
      // otherwise be reparsed as the US-locale grouped integer 123, a
      // surprising cross-locale reinterpretation, not an honest "not a
      // number"). Under an explicit fixed locale, a token containing the
      // locale's decimal character that fails that locale's parse is text,
      // full stop -- never silently retried under a different locale.
      cell.datatype = "t";
      cell.valuetype = "t";
      cell.datavalue = rawvalue;
      return;
    }
  }

  value = SocialCalc.DetermineValueType(rawvalue);

  if (value.type == "n" && value.value == rawvalue) {
    // check that we don't need "constant" to remember original value
    cell.datatype = "v";
    cell.valuetype = "n";
    cell.datavalue = value.value;
  } else if (value.type.charAt(0) == "t") {
    // text of some sort but left unchanged
    cell.datatype = "t";
    cell.valuetype = value.type;
    cell.datavalue = value.value;
  } else {
    // special number types
    cell.datatype = "c";
    cell.valuetype = value.type;
    cell.datavalue = value.value;
    cell.formula = rawvalue;
  }
};

// *************************************
//
// Normalized-workbook ingestion seam
//
// A dependency-free bridge from a plain, already-parsed, TRUSTED structured
// JSON object (produced by a HOST-SUPPLIED external parser -- e.g. an XLSX
// or ODS reader -- outside this package) into one or more SocialCalc-native
// scsave strings. This module does NOT parse any binary/zip/XML format
// itself; it only maps an already-normalized in-memory shape onto the
// existing Sheet/cell/style primitives (SetConvertedCell, GetStyleNum,
// ExecuteSheetCommand's "name define"). Untrusted input handling (schema
// validation, size limits, hostile-content sanitization before this point)
// is the CALLER's responsibility -- same trust boundary the rest of the
// save/load path assumes (see README.md's "Trust boundary" section).
//
// *************************************

// result = SocialCalc.CreateSheetSaveFromNormalizedSheet(normalizedSheet)
//
// result = SocialCalc.CreateSheetSaveFromNormalizedSheet(normalizedSheet, skipped)
//
// normalizedSheet: {
//   name?: string,                     // informational only, not embedded in scsave
//   formulaSeparator?: ";" | ",",      // opt-in: ";" rewrites formula text to
//                                      // native "," syntax before parsing (quote-aware)
//   cells: { [coord: string]: {        // coord: uppercase A1, e.g. "B7"
//     value?: string | number,         // plain value (no locale ambiguity: numbers are JS numbers)
//     formula?: string,                // formula text WITHOUT leading "="; overrides value if present
//     bold?: boolean,
//     italic?: boolean,
//     align?: "left" | "center" | "right",
//     comment?: string,
//   } },
//   names?: { [name: string]: string },  // named-range definitions, e.g. {"TOTAL": "B1:B10"}
// }
//
// Returns a full scsave string (SocialCalc.CreateSheetSave output). A
// malformed coord/name key is SKIPPED (never aborts the whole sheet) --
// coord keys must pass IsValidNormalizedCellCoord and land in the [1,702]
// column / >=1 row band; name keys must pass IsValidNamedRangeName. This is
// a "trusted input" ingestion seam (the host's external parser is assumed
// to have already validated/sanitized the source document per README.md's
// trust-boundary section), so a skip is a HOST-ADAPTER BUG SIGNAL, not
// expected steady-state input -- pass an optional `skipped` array to
// collect every skipped key (as "cell:B7" / "name:1BAD") instead of
// silently dropping it, so a caller can log/assert on it during
// integration rather than losing the signal.
// Font style/weight strings are interned via GetStyleNum, so two cells
// sharing {bold:true} share one font-table slot in the emitted scsave
// (same dedup GetStyleNum already gives every "set coord font ..." command).

/** @param {any} normalizedSheet @param {string[]} [skipped] */
SC.CreateSheetSaveFromNormalizedSheet = function (normalizedSheet: any, skipped: any): string {
  var sheet = new SocialCalc.Sheet();
  var maxcol = 0;
  var maxrow = 0;
  var coord: any;
  var ndata: any;
  var cr: any;

  var cells = (normalizedSheet && normalizedSheet.cells) || {};
  for (coord in cells) {
    if (!SocialCalc.IsValidNormalizedCellCoord(coord)) {
      if (skipped) skipped.push("cell:" + coord);
      continue;
    }
    ndata = cells[coord];
    if (!ndata || typeof ndata != "object") {
      if (skipped) skipped.push("cell:" + coord);
      continue;
    }

    // No further column/row band check is needed here: coord already
    // passed IsValidNormalizedCellCoord above, which by construction (1-2
    // uppercase A-Z letters => col in [1,702]; no-leading-zero digit run
    // => row >= 1) already guarantees cr lands in SocialCalc's supported
    // band. Exhaustively verified: no string accepted by
    // IsValidNormalizedCellCoord ever produces col>702 or row<1.
    cr = SocialCalc.coordToCr(coord);

    if (typeof ndata.formula == "string" && ndata.formula.length > 0) {
      // Opt-in per-sheet formula separator normalization: when the caller
      // marks normalizedSheet.formulaSeparator === ";" (semicolon-authored
      // formula text, as some non-US-locale spreadsheet exports emit), the
      // formula is rewritten to SocialCalc's native comma-separated syntax
      // BEFORE parsing -- normalized once at ingestion, never inside the
      // shared formula tokenizer/parser (which stays locale-agnostic; see
      // js/formula-parse.ts).
      //
      // REQUIRED PRECONDITION -- formulaSeparator:";" is a PURE separator
      // swap, not a locale-numeric translator: ndata.formula MUST already
      // use "." as its decimal point (e.g. "SUM(1.5;2.5)", never
      // "SUM(1,5;2,5)"). A comma-decimal formula under this flag is
      // UNDETECTABLE-BY-DESIGN from an argument-separator comma once both
      // become ",": "SUM(1,5;2,5)" -> "SUM(1,5,2,5)" silently reparses as
      // FOUR arguments (1, 5, 2, 5), not two decimals (1.5, 2.5). There is
      // no purely lexical way to disambiguate a decimal comma from an
      // argument-separator comma after the rewrite -- this is a REAL,
      // documented, non-recoverable ambiguity, not an oversight. The host
      // adapter (the same layer that decided formulaSeparator===";" from
      // its source format) MUST normalize decimal commas to dots in
      // formula text BEFORE calling this seam; this function does not and
      // cannot detect a violation.
      //
      // ReplaceUnquotedFormulaChar is quote-aware, so a literal ";" inside
      // a string-literal argument is left untouched. Every other formula
      // in the sheet (formulaSeparator omitted/"," ) is completely
      // unaffected -- same code path, no rewrite performed.
      var formulaText = ndata.formula;
      if (normalizedSheet && normalizedSheet.formulaSeparator === ";") {
        formulaText = SocialCalc.ReplaceUnquotedFormulaChar(formulaText, ";", ",");
      }
      SocialCalc.SetConvertedCell(sheet, coord, "=" + formulaText);
    } else if (ndata.value !== undefined && ndata.value !== null) {
      SocialCalc.SetConvertedCell(sheet, coord, ndata.value);
    } else {
      if (skipped) skipped.push("cell:" + coord);
      continue; // no content: skip creating the cell entirely
    }

    // SetConvertedCell always creates the cell via GetAssuredCell, so
    // sheet.cells[coord] is always truthy here -- no null guard needed.
    var cell = sheet.cells[coord];

    if (cr.col > maxcol) maxcol = cr.col;
    if (cr.row > maxrow) maxrow = cr.row;

    if (ndata.bold || ndata.italic) {
      var fontstyle = ndata.italic ? "italic" : "normal";
      var fontweight = ndata.bold ? "bold" : "normal";
      cell.font = sheet.GetStyleNum("font", fontstyle + " " + fontweight + " * *");
    }
    if (ndata.align == "left" || ndata.align == "center" || ndata.align == "right") {
      cell.cellformat = sheet.GetStyleNum("cellformat", ndata.align);
    }
    if (typeof ndata.comment == "string" && ndata.comment.length > 0) {
      cell.comment = ndata.comment;
    }
  }

  sheet.attribs.lastcol = maxcol;
  sheet.attribs.lastrow = maxrow;

  var names = (normalizedSheet && normalizedSheet.names) || {};
  var name: any;
  for (name in names) {
    if (!SocialCalc.IsValidNamedRangeName(name)) {
      if (skipped) skipped.push("name:" + name);
      continue;
    }
    if (typeof names[name] != "string" || names[name].length == 0) {
      if (skipped) skipped.push("name:" + name);
      continue;
    }
    sheet.names[name] = { desc: "", definition: names[name] };
  }

  return sheet.CreateSheetSave();
};

// result = SocialCalc.CreateSpreadsheetSaveFromNormalizedWorkbook(normalizedWorkbook)
//
// normalizedWorkbook: { sheets: normalizedSheet[] } (see
// CreateSheetSaveFromNormalizedSheet above for the per-sheet shape).
//
// Returns an object { sheetNames: string[], sheetSaves: { [name: string]:
// string } } -- one scsave string per input sheet, keyed by a de-duplicated
// display name (informational; SocialCalc itself has no native concept of
// a bundled multi-sheet document -- see AGENTS.md's cross-sheet formula
// ("'Sheet1'!A1") LoadSheet-callback model). A host embedding multiple
// sheets in one page/document assigns each returned save string to its own
// SocialCalc.Sheet / SpreadsheetControl instance and wires cross-sheet
// formula resolution through SocialCalc.Formula.SheetCache /
// RecalcInfo.LoadSheet, keyed by these same sheetNames.
// Empty/missing sheets array returns { sheetNames: [], sheetSaves: {} }.

/** @param {any} normalizedWorkbook */
SC.CreateSpreadsheetSaveFromNormalizedWorkbook = function (normalizedWorkbook: any): {
  sheetNames: string[];
  sheetSaves: { [name: string]: string };
} {
  var sheets = (normalizedWorkbook && normalizedWorkbook.sheets) || [];
  var sheetNames: string[] = [];
  var sheetSaves: { [name: string]: string } = {};
  var used: { [name: string]: boolean } = {};

  for (var i = 0; i < sheets.length; i++) {
    var ns = sheets[i];
    var baseName =
      ns && typeof ns.name == "string" && ns.name.length > 0 ? ns.name : "Sheet" + (i + 1);
    var name = baseName;
    var suffix = 2;
    while (used[name]) {
      name = baseName + " (" + suffix + ")";
      suffix++;
    }
    used[name] = true;
    sheetNames.push(name);
    sheetSaves[name] = SocialCalc.CreateSheetSaveFromNormalizedSheet(ns);
  }

  return { sheetNames: sheetNames, sheetSaves: sheetSaves };
};

// *************************************
//
// FODS (OpenDocument Flat XML Spreadsheet) export
//
// Standards-valid single-file OpenDocument Spreadsheet XML per the OASIS
// ODF spreadsheet schema's flat form (ODF 1.2 permits either a zipped
// package OR a single flat XML document -- no ZIP/deflate dependency is
// needed for the flat form; see the LOC digital-formats registry entry for
// ODS: https://www.loc.gov/preservation/digital/formats/fdd/fdd000439.shtml).
// Formula translation targets the OpenFormula "of:" canonical form (cell
// references as "[.A1]"/"[.A1:.B2]", ";" as the argument separator).
//
// *************************************

// result = SocialCalc.XmlEscape(text)
//
// XML 1.0 text/attribute-content escaping: &, <, >, and ' and " (special_chars
// only covers &<>" -- FODS also emits single-quoted formula/style attributes
// in some contexts, so ' is escaped too for defense in depth even though the
// current emitter only uses double-quoted attributes).

/** @param {string} text */
SC.XmlEscape = function (text: any): string {
  var s = SocialCalc.special_chars(text + "");
  return s.replace(/'/g, "&apos;");
};

// result = SocialCalc.TranslateFormulaToOpenFormula(formula)
//
// Best-effort translation of a SocialCalc formula body (no leading "=")
// into the OpenFormula canonical form used by ODF's table:formula
// attribute (prefixed "of:=" by the caller). Walks the shared formula
// tokenizer's token stream (js/formula-parse.ts's ParseFormulaIntoTokens --
// same lexer the evaluator uses, so this never diverges from what
// SocialCalc itself parses) and re-emits:
//   - a coord immediately followed by ":" then another coord -> combined
//     into ONE bracketed range reference "[.A1:.B2]" (OpenFormula ranges
//     are a single reference, not two references joined by ":");
//   - a lone coord -> "[.A1]";
//   - the "," argument separator -> ";" (OpenFormula's canonical
//     separator; SocialCalc's own "," stays internal-only, never emitted);
//   - string literals -> re-quoted with " and internal " doubled (same
//     literal escaping both formats already use);
//   - everything else (function names, numbers, other operators) passed
//     through unchanged -- SocialCalc's function names already match their
//     ODF/OpenFormula counterparts for the common set (SUM, IF, VLOOKUP,
//     COUNT, AVERAGE, etc).
// Sheet-qualified references (formulas containing "!") are NOT translated
// (returned as an untranslated marker) -- OpenFormula's cross-sheet syntax
// ("[$SheetName.A1]") differs enough from a token-substitution pass that a
// wrong translation would be worse than an honest failure; the caller
// falls back to exporting the cell's last-computed value only.

/**
 * @param {string} formula
 * Intentional JS-boundary guard: TypeScript's `formula: string` signature
 * is not enforced at runtime for host/EtherCalc callers invoking this
 * public export directly from plain JavaScript. A non-string `formula`
 * (null/undefined/object/etc.) throws inside ParseFormulaIntoTokens; that
 * is caught here and reported as {ok:false} -- an honest translation
 * failure -- rather than an uncaught exception propagating out of an
 * export/import code path. Every STRING input, however malformed
 * (unterminated quotes/parens, control characters, empty string, oversized
 * exponents), is handled by the tokenizer without throwing.
 */
SC.TranslateFormulaToOpenFormula = function (formula: any): { ok: boolean; text: string } {
  var scf = SocialCalc.Formula;
  var tokentype = scf.TokenType;
  var parseinfo: any;
  try {
    parseinfo = scf.ParseFormulaIntoTokens(formula);
  } catch {
    return { ok: false, text: "" };
  }

  var out = "";
  var i: number;
  for (i = 0; i < parseinfo.length; i++) {
    var ttype = parseinfo[i].type;
    var ttext = parseinfo[i].text;

    if (ttype === tokentype.op && ttext === "!") {
      return { ok: false, text: "" }; // sheet-qualified: not translated
    }

    if (ttype === tokentype.coord) {
      var isRangeStart =
        i + 2 < parseinfo.length &&
        parseinfo[i + 1].type === tokentype.op &&
        parseinfo[i + 1].text === ":" &&
        parseinfo[i + 2].type === tokentype.coord;
      var isRangeEnd =
        i >= 2 &&
        parseinfo[i - 1].type === tokentype.op &&
        parseinfo[i - 1].text === ":" &&
        parseinfo[i - 2].type === tokentype.coord;
      if (isRangeStart) {
        out += "[." + ttext + ":." + parseinfo[i + 2].text + "]";
      } else if (isRangeEnd) {
        // already emitted as part of the range-start branch above; skip
      } else {
        out += "[." + ttext + "]";
      }
      continue;
    }

    if (ttype === tokentype.op && ttext === ":") {
      var prevIsCoord = i > 0 && parseinfo[i - 1].type === tokentype.coord;
      var nextIsCoord = i + 1 < parseinfo.length && parseinfo[i + 1].type === tokentype.coord;
      if (prevIsCoord && nextIsCoord) continue; // consumed by the range-start branch
      out += ttext;
      continue;
    }

    if (ttype === tokentype.op && ttext === ",") {
      out += ";";
      continue;
    }

    if (ttype === tokentype.string) {
      out += '"' + ttext.replace(/"/g, '""') + '"';
      continue;
    }

    out += ttext;
  }

  return { ok: true, text: out };
};

// result = SocialCalc.CreateFodsFromNormalizedWorkbook(normalizedWorkbook)
//
// Returns a complete, standards-valid ODF 1.2 flat-XML spreadsheet
// document (application/vnd.oasis.opendocument.spreadsheet, flat form) as
// a single string -- pure XML text assembly, no ZIP/deflate step. Encodes,
// per input sheet: cell values (numbers, text, dates-as-numbers with a
// generic numeric style), formulas (translated via
// TranslateFormulaToOpenFormula when possible, else exported as a plain
// value with no table:formula attribute -- a formula that cannot be
// losslessly translated degrades to its last value rather than emitting
// a broken formula string), bold/italic/alignment cell styles (deduped:
// identical {bold,italic,align} combinations share one
// <style:style> definition), and named ranges (as
// <table:named-range> elements, one per NormalizedSheet.names entry,
// base-cell-address/cell-range-address qualified against that sheet's own
// name -- matching each normalized sheet's own local `names` map).

/** @param {any} normalizedWorkbook */
SC.CreateFodsFromNormalizedWorkbook = function (normalizedWorkbook: any): string {
  var sheets = (normalizedWorkbook && normalizedWorkbook.sheets) || [];
  var esc = SocialCalc.XmlEscape;

  // Style table: dedup identical {bold,italic,align} combinations into one
  // <style:style name="ceN"> definition, referenced by table:style-name.
  var styleKeyToName: { [key: string]: string } = {};
  var styleDefs: string[] = [];
  var nextStyleId = 1;

  /** @param {boolean} bold @param {boolean} italic @param {string} align */
  function styleNameFor(bold: any, italic: any, align: any): string | null {
    if (!bold && !italic && !align) return null;
    var boldKey = bold ? "b" : "";
    var italicKey = italic ? "i" : "";
    var alignKey = align || "";
    var key = boldKey + italicKey + alignKey;
    if (styleKeyToName[key]) return styleKeyToName[key];
    var name = "ce" + nextStyleId++;
    styleKeyToName[key] = name;
    var textProps = "";
    if (bold || italic) {
      var fontWeight = bold ? "bold" : "normal";
      var fontStyle = italic ? "italic" : "normal";
      textProps =
        '<style:text-properties fo:font-weight="' +
        fontWeight +
        '" style:font-style="' +
        fontStyle +
        '"/>';
    }
    var cellProps = "";
    if (align) {
      cellProps = '<style:paragraph-properties fo:text-align="' + align + '"/>';
    }
    styleDefs.push(
      '<style:style style:name="' +
        name +
        '" style:family="table-cell">' +
        cellProps +
        textProps +
        "</style:style>",
    );
    return name;
  }

  var sheetXml: string[] = [];
  var namedRangeXml: string[] = [];

  for (var s = 0; s < sheets.length; s++) {
    var ns = sheets[s];
    var sheetName =
      ns && typeof ns.name == "string" && ns.name.length > 0 ? ns.name : "Sheet" + (s + 1);

    var cells = (ns && ns.cells) || {};
    var coords: string[] = [];
    for (var coord in cells) {
      if (SocialCalc.IsValidNormalizedCellCoord(coord)) coords.push(coord);
    }
    coords.sort(function (a: string, b: string) {
      var ca = SocialCalc.coordToCr(a);
      var cb = SocialCalc.coordToCr(b);
      return ca.row - cb.row || ca.col - cb.col;
    });

    var maxrow = 0;
    var maxcol = 0;
    var byRow: { [row: number]: { [col: number]: string } } = {};
    for (var ci = 0; ci < coords.length; ci++) {
      var cr = SocialCalc.coordToCr(coords[ci]);
      if (cr.row > maxrow) maxrow = cr.row;
      if (cr.col > maxcol) maxcol = cr.col;
      if (!byRow[cr.row]) byRow[cr.row] = {};
      byRow[cr.row][cr.col] = coords[ci];
    }

    var rowsXml = "";
    for (var r = 1; r <= maxrow; r++) {
      var rowCells = byRow[r];
      if (!rowCells) rowCells = {};
      var rowXml = "";
      for (var c = 1; c <= maxcol; c++) {
        var cellCoord = rowCells[c];
        if (!cellCoord) {
          rowXml += "<table:table-cell/>";
          continue;
        }
        var ndata = cells[cellCoord];
        var styleName = styleNameFor(ndata.bold, ndata.italic, ndata.align);
        var styleAttr = styleName ? ' table:style-name="' + styleName + '"' : "";

        if (typeof ndata.formula == "string" && ndata.formula.length > 0) {
          // Formula cells cache their last-computed result the same way
          // every real .fods writer does: office:value/office:value-type
          // reflect the CACHED VALUE, not a live recalculation (ODF
          // consumers use the cached value until they choose to recalc).
          // ndata.value, when the caller supplies it alongside ndata.formula,
          // is that cached result. Without a translatable formula AND
          // without a supplied value there is nothing safe to cache, so the
          // cell falls back to a string cell holding the raw formula text
          // (prefixed "=") rather than silently dropping the cell's content.
          var translated = SocialCalc.TranslateFormulaToOpenFormula(ndata.formula);
          var hasCachedValue = typeof ndata.value == "number";
          if (translated.ok) {
            var formulaAttr = ' table:formula="of:=' + esc(translated.text) + '"';
            if (hasCachedValue) {
              rowXml +=
                "<table:table-cell" +
                formulaAttr +
                ' office:value-type="float" office:value="' +
                ndata.value +
                '"' +
                styleAttr +
                "><text:p>" +
                esc(ndata.value + "") +
                "</text:p></table:table-cell>";
            } else {
              rowXml +=
                "<table:table-cell" +
                formulaAttr +
                styleAttr +
                "><text:p></text:p></table:table-cell>";
            }
          } else if (hasCachedValue) {
            // untranslatable formula (e.g. sheet-qualified) but a cached
            // value was supplied: export the value, no table:formula.
            rowXml +=
              '<table:table-cell office:value-type="float" office:value="' +
              ndata.value +
              '"' +
              styleAttr +
              "><text:p>" +
              esc(ndata.value + "") +
              "</text:p></table:table-cell>";
          } else {
            // nothing translatable and nothing cached: preserve content as
            // the raw formula text rather than dropping the cell.
            rowXml +=
              '<table:table-cell office:value-type="string"' +
              styleAttr +
              "><text:p>" +
              esc("=" + ndata.formula) +
              "</text:p></table:table-cell>";
          }
        } else if (typeof ndata.value == "number") {
          rowXml +=
            '<table:table-cell office:value-type="float" office:value="' +
            ndata.value +
            '"' +
            styleAttr +
            ">" +
            (typeof ndata.comment == "string" && ndata.comment.length > 0
              ? "<office:annotation><text:p>" + esc(ndata.comment) + "</text:p></office:annotation>"
              : "") +
            "<text:p>" +
            esc(ndata.value + "") +
            "</text:p></table:table-cell>";
        } else {
          var textValue = ndata.value == null ? "" : ndata.value + "";
          rowXml +=
            '<table:table-cell office:value-type="string"' +
            styleAttr +
            ">" +
            (typeof ndata.comment == "string" && ndata.comment.length > 0
              ? "<office:annotation><text:p>" + esc(ndata.comment) + "</text:p></office:annotation>"
              : "") +
            "<text:p>" +
            esc(textValue) +
            "</text:p></table:table-cell>";
        }
      }
      rowsXml += "<table:table-row>" + rowXml + "</table:table-row>";
    }

    sheetXml.push('<table:table table:name="' + esc(sheetName) + '">' + rowsXml + "</table:table>");

    var names = (ns && ns.names) || {};
    for (var name in names) {
      if (!SocialCalc.IsValidNamedRangeName(name)) continue;
      if (typeof names[name] != "string" || names[name].length == 0) continue;
      var def = names[name];
      var defParts = def.split(":");
      // Every def part must be a valid, unqualified A1 coordinate
      // (IsValidNormalizedCellCoord) -- a malformed definition (e.g. the
      // empty-endpoint shape ":") must NOT emit a named range at all,
      // rather than silently degrading into a malformed
      // table:cell-range-address like "$Sheet.$:$Sheet.$" (empty column/row
      // component -- not valid ODF, and inconsistent with
      // table:base-cell-address's own "A1" fallback for the same input).
      if (defParts.length > 2) continue;
      var defPartsValid = true;
      for (var dp = 0; dp < defParts.length; dp++) {
        if (!SocialCalc.IsValidNormalizedCellCoord(defParts[dp])) defPartsValid = false;
      }
      if (!defPartsValid) continue;
      // table:base-cell-address / table:cell-range-address use the ODF
      // CellAddress/CellRangeAddress attribute-value grammar --
      // "$SheetName.$Column$Row" (single) or
      // "$SheetName.$Column$Row:$SheetName.$Column$Row" (range, sheet
      // qualifier repeated on EACH endpoint) -- a DIFFERENT syntax from
      // table:formula's bracketed OpenFormula reference ("[.A1:.B2]",
      // single sheet qualifier). An earlier version used the bracketed
      // form here (and, before that, a single non-repeated sheet
      // qualifier); both confirmed wrong by round-tripping through real
      // LibreOffice (26.2.4.2): the bracketed form was unparseable and
      // silently degraded to the sentinel "$A$0" (row 0, an otherwise-
      // impossible ODF address).
      // Sheet names that are not a bare [A-Za-z_][A-Za-z0-9_]* identifier
      // (e.g. containing a space) must be single-quoted per ODF's
      // QuotedSheetName production, with an embedded "'" doubled.
      // dollarize splits a coord that already passed
      // IsValidNormalizedCellCoord above on the letter/digit boundary
      // (the first digit index is always present for such a coord) and
      // inserts "$" before the column-letter run and again before the
      // digit run. No regex-match null check is needed: every input here
      // is 1-2 uppercase A-Z letters followed by a no-leading-zero digit
      // run, so the boundary scan always finds a digit, and there is no
      // fallback branch.
      /** @param {string} a1 */
      function dollarize(a1: string): string {
        var firstDigit = 0;
        while (firstDigit < a1.length && a1.charCodeAt(firstDigit) < 48) firstDigit++;
        while (firstDigit < a1.length && a1.charCodeAt(firstDigit) > 57) firstDigit++;
        return "$" + a1.slice(0, firstDigit) + "$" + a1.slice(firstDigit);
      }
      var needsQuoting = !/^[A-Za-z_][A-Za-z0-9_]*$/.test(sheetName);
      var quotedSheetName = needsQuoting
        ? "'" + esc(sheetName).replace(/'/g, "''") + "'"
        : esc(sheetName);
      var sheetPrefix = "$" + quotedSheetName + ".";
      var baseCell = sheetPrefix + dollarize(defParts[0]);
      var rangeAddress =
        defParts.length === 2
          ? sheetPrefix + dollarize(defParts[0]) + ":" + sheetPrefix + dollarize(defParts[1])
          : baseCell;
      namedRangeXml.push(
        '<table:named-range table:name="' +
          esc(name) +
          '" table:base-cell-address="' +
          baseCell +
          '" table:cell-range-address="' +
          rangeAddress +
          '"/>',
      );
    }
  }

  // ODF 1.2 office:spreadsheet content model places table:named-expressions
  // (if present) AFTER every table:table element, alongside
  // database-ranges/data-pilot-tables -- confirmed empirically against real
  // LibreOffice (26.2.4.2): a document with named-expressions BEFORE its
  // tables round-tripped through `soffice --headless --convert-to fods`
  // re-emits it AFTER the tables, matching this order. Every
  // table:named-range must be wrapped inside exactly one
  // table:named-expressions container -- a bare table:named-range at the
  // office:spreadsheet level is well-formed XML but schema-invalid ODF.
  var namedExpressionsXml =
    namedRangeXml.length > 0
      ? "<table:named-expressions>" + namedRangeXml.join("") + "</table:named-expressions>"
      : "";

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
    'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
    'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
    'xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" ' +
    'office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">' +
    "<office:automatic-styles>" +
    styleDefs.join("") +
    "</office:automatic-styles>" +
    "<office:body><office:spreadsheet>" +
    sheetXml.join("") +
    namedExpressionsXml +
    "</office:spreadsheet></office:body>" +
    "</office:document>"
  );
};
