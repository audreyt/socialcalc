// In-place TypeScript conversion of socialcalcviewer.js (SocialCalc global script).
// Ambient API types live in socialcalcviewer.d.ts (referenced by dist/SocialCalc.d.ts).
// Build strips types via Bun.Transpiler before UMD concat — no runtime tax.
// Typechecked global-script module (no @ts-nocheck).
//
// SocialCalcViewer
//
/*
// The code module of the SocialCalc package that lets you embed a spreadsheet viewer
// with an optional simple toolbar into a web page.
//
// (c) Copyright 2008, 2009, 2010 Socialtext, Inc.
// All Rights Reserved.
//
*/


// Mutable progressive-init bridges for ambient nested namespaces.
(SocialCalc as unknown as { LocalizeStringList: { [key: string]: unknown } }).LocalizeStringList = {} as { [key: string]: unknown };
const LocalizeStringListMut = (SocialCalc as unknown as { LocalizeStringList: { [key: string]: unknown } }).LocalizeStringList;

/*

LEGAL NOTICES REQUIRED BY THE COMMON PUBLIC ATTRIBUTION LICENSE:

EXHIBIT A. Common Public Attribution License Version 1.0.

The contents of this file are subject to the Common Public Attribution License Version 1.0 (the 
"License"); you may not use this file except in compliance with the License. You may obtain a copy 
of the License at http://socialcalc.org. The License is based on the Mozilla Public License Version 1.1 but 
Sections 14 and 15 have been added to cover use of software over a computer network and provide for 
limited attribution for the Original Developer. In addition, Exhibit A has been modified to be 
consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY 
KIND, either express or implied. See the License for the specific language governing rights and 
limitations under the License.

The Original Code is SocialCalc JavaScript SpreadsheetViewer.

The Original Developer is the Initial Developer.

The Initial Developer of the Original Code is Socialtext, Inc. All portions of the code written by 
Socialtext, Inc., are Copyright (c) Socialtext, Inc. All Rights Reserved.

Contributor: Dan Bricklin.


EXHIBIT B. Attribution Information

When the SpreadsheetViewer is producing and/or controlling the display the Graphic Image must be
displayed on the screen visible to the user in a manner comparable to that in the 
Original Code. The Attribution Phrase must be displayed as a "tooltip" or "hover-text" for
that image. The image must be linked to the Attribution URL so as to access that page
when clicked. If the user interface includes a prominent "about" display which includes
factual prominent attribution in a form similar to that in the "about" display included
with the Original Code, including Socialtext copyright notices and URLs, then the image
need not be linked to the Attribution URL but the "tool-tip" is still required.

Attribution Copyright Notice:

 Copyright (C) 2010 Socialtext, Inc.
 All Rights Reserved.

Attribution Phrase (not exceeding 10 words): SocialCalc

Attribution URL: http://www.socialcalc.org/

Graphic Image: The contents of the sc-logo.gif file in the Original Code or
a suitable replacement from http://www.socialcalc.org/licenses specified as
being for SocialCalc.

Display of Attribution Information is required in Larger Works which are defined 
in the CPAL as a work which combines Covered Code or portions thereof with code 
not governed by the terms of the CPAL.

*/

//
// Some of the other files in the SocialCalc package are licensed under
// different licenses. Please note the licenses of the modules you use.
//
// Code History:
//
// Initially coded by Dan Bricklin of Software Garden, Inc., for Socialtext, Inc.
// Unless otherwise specified, referring to "SocialCalc" in comments refers to this
// JavaScript version of the code, not the SocialCalc Perl code.
//

/*

See the comments in the main SocialCalc code module file of the SocialCalc package.

*/

   // Module-load guards removed — in the concatenated UMD bundle, SocialCalc
   // and SocialCalc.TableEditor are always defined by the time this file
   // runs (socialcalc-3.js and socialcalctableeditor.js precede it).

// *************************************
//
// SpreadsheetViewer class:
//
// *************************************

// Global constants:

   SocialCalc.CurrentSpreadsheetViewerObject = null; // right now there can only be one active at a time


// Constructor:

const SpreadsheetViewerCtor = function(this: SocialCalc.SpreadsheetViewer, idPrefix?: string) {

   var scc = SocialCalc.Constants;

   // Properties:

   this.parentNode = null;
   this.spreadsheetDiv = null;
   this.requestedHeight = 0;
   this.requestedWidth = 0;
   this.requestedSpaceBelow = 0;
   this.height = 0;
   this.width = 0;
   this.viewheight = 0; // calculated amount for views below toolbar, etc.

   // Dynamic properties (sheet/context/editor set below after construction pieces):

   this.spreadsheetDiv = null;
   this.editorDiv = null;

   this.sortrange = ""; // remembered range for sort tab

   // Constants:

   this.idPrefix = idPrefix || "SocialCalc-"; // prefix added to element ids used here, should end in "-"
   this.imagePrefix = scc.defaultImagePrefix; // prefix added to img src

   this.statuslineheight = scc.SVStatuslineheight; // in pixels
   this.statuslineCSS = scc.SVStatuslineCSS;

   // Callbacks:

   // Initialization Code:

   this.sheet = new SocialCalc.Sheet();
   this.context = new SocialCalc.RenderContext(this.sheet);
   // eddy SpreadsheetViewer {
   if(SocialCalc._app == true || SocialCalc._view == true) scc.defaultImagePrefix = this.imagePrefix = "../"+ this.imagePrefix;
   if(SocialCalc._app == true) {
     this.context.showGrid= false; 
     this.context.showRCHeaders= false;
     this.context.highlightTypes.range.style = ""; // no cell highlighting in app mode
     
     // Loading Message - add to cell A1 - shows when app is loading a large sheet or from a slow server
     this.context.sheetobj.cells["A1"] = new SocialCalc.Cell("A1");
     this.context.sheetobj.cells["A1"].displaystring = "Loading ... "; // will display until recalc issues a render request - auto reset by recalc on load
     
   } else {
     this.context.showGrid= true; 
     this.context.showRCHeaders= true;     
   }
   // } SpreadsheetViewer
   this.editor = new SocialCalc.TableEditor(this.context);
   this.editor.noEdit = true;
   this.editor.StatusCallback.statusline =
      {func: SocialCalc.SpreadsheetViewerStatuslineCallback,
       params: {}};
   this.hasStatusLine = true; // default
//   this.statuslineHTML = '<table cellspacing="0" cellpadding="0"><tr><td width="100%" style="overflow:hidden;">{status}</td><td><a href="">Will&nbsp;be&nbsp;link</a></td></tr></table>';
   this.statuslineHTML = '<table cellspacing="0" cellpadding="0"><tr><td width="100%" style="overflow:hidden;">{status}</td><td>&nbsp;</td></tr></table>';
   this.statuslineFull = true;
   this.noRecalc = true; // don't do a recalc when loaded, so no need for external sheet routines

   // Repeating macro info

   this.repeatingMacroTimer = null;
   this.repeatingMacroInterval = 60; // default to 60 seconds
   this.repeatingMacroCommands = ""; // what to execute


   SocialCalc.CurrentSpreadsheetViewerObject = this; // remember this for rendezvousing on events

   return;

   };

SocialCalc.SpreadsheetViewer = SpreadsheetViewerCtor as unknown as SocialCalc.SpreadsheetViewerConstructor;

// Methods:

SocialCalc.SpreadsheetViewer.prototype.InitializeSpreadsheetViewer =
   function(this: SocialCalc.SpreadsheetViewer, node: HTMLElement | string, height?: number, width?: number, spacebelow?: number) {
      return SocialCalc.InitializeSpreadsheetViewer(this, node, height, width, spacebelow);
   };

SocialCalc.SpreadsheetViewer.prototype.LoadSave =
   function(this: SocialCalc.SpreadsheetViewer, str: string) {
      return SocialCalc.SpreadsheetViewerLoadSave(this, str);
   };
SocialCalc.SpreadsheetViewer.prototype.DoOnResize =
   function(this: SocialCalc.SpreadsheetViewer) {
      return SocialCalc.DoOnResize(this);
   };
SocialCalc.SpreadsheetViewer.prototype.SizeSSDiv =
   function(this: SocialCalc.SpreadsheetViewer) {
      return SocialCalc.SizeSSDiv(this);
   };
SocialCalc.SpreadsheetViewer.prototype.DecodeSpreadsheetSave =
   function(this: SocialCalc.SpreadsheetViewer, str: string) {
      return SocialCalc.SpreadsheetViewerDecodeSpreadsheetSave(this, str);
   };
SocialCalc.SpreadsheetViewer.prototype.ParseSheetSave =
   function(this: SocialCalc.SpreadsheetViewer, str: string) {
      return this.sheet.ParseSheetSave(str);
   };

SocialCalc.InitializeSpreadsheetViewer = function(
   spreadsheet: SocialCalc.SpreadsheetViewer,
   node: HTMLElement | string,
   height?: number,
   width?: number,
   spacebelow?: number
): void {

   var scc = SocialCalc.Constants;
   var SCLoc = SocialCalc.LocalizeString;
   var SCLocSS = SocialCalc.LocalizeSubstrings;

   var html, child, i, vname, v, style, button, bele;
   var tabs = spreadsheet.tabs;
   var views = spreadsheet.views;

   spreadsheet.requestedHeight = height || 0;
   spreadsheet.requestedWidth = width || 0;
   spreadsheet.requestedSpaceBelow = spacebelow || 0;

   /** @type {HTMLElement | null} */
   var nodeEl = typeof node == "string" ? document.getElementById(node) : node;

   if (nodeEl == null) {
      alert("SocialCalc.SpreadsheetControl not given parent node.");
      return; // nothing to attach to - bail rather than throwing in DOM calls below
      }

   spreadsheet.parentNode = nodeEl;

   // create node to hold spreadsheet view

   spreadsheet.spreadsheetDiv = document.createElement("div");

   spreadsheet.SizeSSDiv(); // calculate and fill in the size values

   for (child=nodeEl.firstChild; child!=null; child=nodeEl.firstChild) {
      nodeEl.removeChild(child);
      }

   nodeEl.appendChild(spreadsheet.spreadsheetDiv);

   // create sheet div

   spreadsheet.nonviewheight = spreadsheet.hasStatusLine ? spreadsheet.statuslineheight : 0;
   spreadsheet.viewheight = spreadsheet.height-spreadsheet.nonviewheight;
   spreadsheet.editorDiv=spreadsheet.editor.CreateTableEditor(spreadsheet.width, spreadsheet.viewheight);

   if (spreadsheet.spreadsheetDiv && spreadsheet.editorDiv) {
      spreadsheet.spreadsheetDiv.appendChild(spreadsheet.editorDiv);
      }

   // create statusline

   if (spreadsheet.hasStatusLine) {
      spreadsheet.statuslineDiv = document.createElement("div");
      spreadsheet.statuslineDiv.style.cssText = spreadsheet.statuslineCSS;
      spreadsheet.statuslineDiv.style.height = spreadsheet.statuslineheight -
         (Number(spreadsheet.statuslineDiv.style.paddingTop.slice(0,-2)) || 0) -
         (Number(spreadsheet.statuslineDiv.style.paddingBottom.slice(0,-2)) || 0) + "px";
      spreadsheet.statuslineDiv.id = spreadsheet.idPrefix+"statusline";
      spreadsheet.spreadsheetDiv.appendChild(spreadsheet.statuslineDiv);
      spreadsheet.editor.StatusCallback.statusline =
         {func: SocialCalc.SpreadsheetViewerStatuslineCallback,
          params: {spreadsheetobj:spreadsheet}};
      }

   // eddy InitializeSpreadsheetViewer {
   if(SocialCalc._app == true) {
     spreadsheet.formDataViewer = new SocialCalc.SpreadsheetViewer("te_FormData-");
     // remove callback to stop drawing of table.
     spreadsheet.formDataViewer.sheet.statuscallback = null;
     // setup app viewer object
     SocialCalc.CurrentSpreadsheetViewerObject = spreadsheet;
   }
   
   // done - refresh screen needed

   return;

   }

/**
 * @param {any} spreadsheet
 * @param {string} savestr
 */
SocialCalc.SpreadsheetViewerLoadSave = function(
   spreadsheet: SocialCalc.SpreadsheetViewer,
   savestr: string
): void {

   var rmstr, pos, t, t2;

   var parts = spreadsheet.DecodeSpreadsheetSave(savestr);
   if (parts) {
      if (parts.sheet) {
         spreadsheet.sheet.ResetSheet();
         spreadsheet.sheet.ParseSheetSave(savestr.substring(parts.sheet.start, parts.sheet.end));
         }
      if (parts.edit) {
         spreadsheet.editor.LoadEditorSettings(savestr.substring(parts.edit.start, parts.edit.end));
         }
      if (parts.startupmacro) { // executed now
         spreadsheet.editor.EditorScheduleSheetCommands(savestr.substring(parts.startupmacro.start, parts.startupmacro.end), false, true);
         }
      if (parts.repeatingmacro) { // first line tells how many seconds before first execution. Last cmd must be "cmdextension repeatmacro delay" to continue repeating.
         rmstr = savestr.substring(parts.repeatingmacro.start, parts.repeatingmacro.end);
         rmstr = rmstr.replace("\r", ""); // make sure no CR, only LF
         pos = rmstr.indexOf("\n");
         if (pos > 0) {
            // @ts-ignore - intentional "string - 0" numeric coercion idiom; NaN handled by guard below
            t = rmstr.substring(0, pos)-0; // get number
            t2 = t;
//            if (!(t > 0)) t = 60; // handles NAN, too
            spreadsheet.repeatingMacroInterval = t;
            spreadsheet.repeatingMacroCommands = rmstr.substring(pos+1);
            if (t2 > 0) { // zero means don't start yet
               spreadsheet.repeatingMacroTimer = window.setTimeout(SocialCalc.SpreadsheetViewerDoRepeatingMacro, spreadsheet.repeatingMacroInterval * 1000);
               }	
            }
         }
      }
   if (spreadsheet.editor.context.sheetobj.attribs.recalc=="off" || spreadsheet.noRecalc) {
      spreadsheet.editor.ScheduleRender();
      }
   else {
      spreadsheet.editor.EditorScheduleSheetCommands("recalc");
      }
   }

//
// SocialCalc.SpreadsheetViewerDoRepeatingMacro
//
// Called by a timer. Executes repeatingMacroCommands once.
// Use the "startcmdextension repeatmacro delay" command last to schedule this again.
//

SocialCalc.SpreadsheetViewerDoRepeatingMacro = function(): void {

   var spreadsheet = SocialCalc.GetSpreadsheetViewerObject();
   var editor = spreadsheet.editor;

   spreadsheet.repeatingMacroTimer = null;

   SocialCalc.SheetCommandInfo.CmdExtensionCallbacks.repeatmacro = {func:SocialCalc.SpreadsheetViewerRepeatMacroCommand, data:null};

   editor.EditorScheduleSheetCommands(spreadsheet.repeatingMacroCommands);

}

/**
 * @param {string} name
 * @param {any} data
 * @param {any} sheet
 * @param {any} cmd
 * @param {any} saveundo
 */
SocialCalc.SpreadsheetViewerRepeatMacroCommand = function(name: string, data: unknown, sheet: SocialCalc.Sheet, cmd: SocialCalc.Parse, saveundo: boolean): void {

   var spreadsheet = SocialCalc.GetSpreadsheetViewerObject();

   var rest = cmd.RestOfString();
   var t = (rest as unknown as number) - 0; // get number (legacy coercion)
   if (!(t > 0)) t = spreadsheet.repeatingMacroInterval; // handles NAN, too, using last value
   spreadsheet.repeatingMacroInterval = t;

   spreadsheet.repeatingMacroTimer = window.setTimeout(SocialCalc.SpreadsheetViewerDoRepeatingMacro, spreadsheet.repeatingMacroInterval * 1000);

}

SocialCalc.SpreadsheetViewerStopRepeatingMacro = function(): void {

   var spreadsheet = SocialCalc.GetSpreadsheetViewerObject();

   if (spreadsheet.repeatingMacroTimer) {
      window.clearTimeout(spreadsheet.repeatingMacroTimer);
      spreadsheet.repeatingMacroTimer = null;
      }
}

//
// SocialCalc.SpreadsheetViewerDoButtonCmd(e, buttoninfo, bobj)
//
// xxx
//

/**
 * @param {Event} e
 * @param {any} buttoninfo
 * @param {{ element: HTMLElement; functionobj: { command: string; [k: string]: any }; [k: string]: any }} bobj
 */
SocialCalc.SpreadsheetViewerDoButtonCmd = function(
   e: Event,
   buttoninfo: unknown,
   bobj: { element: HTMLElement; functionobj: { command: string; [k: string]: unknown }; [k: string]: unknown }
): void {

   var obj = bobj.element;
   var which = bobj.functionobj.command;

   var spreadsheet = SocialCalc.GetSpreadsheetViewerObject();
   var editor = spreadsheet.editor;

   switch (which) {
      case "recalc":
         editor.EditorScheduleSheetCommands("recalc");
         break;

      default:
         break;
      }

   if (obj && obj.blur) obj.blur();
   SocialCalc.KeyboardFocus();   

   }


//
// outstr = SocialCalc.LocalizeString(str)
//
// SocialCalc function to make localization easier.
// If str is "Text to localize", it returns
// SocialCalc.Constants.s_loc_text_to_localize if
// it exists, or else with just "Text to localize".
// Note that spaces are replaced with "_" and other special
// chars with "X" in the name of the constant (e.g., "A & B"
// would look for SocialCalc.Constants.s_loc_a_X_b.
//

/** @param {string} str */
SocialCalc.LocalizeString = function(str: string): string {
   var cstr = SocialCalc.LocalizeStringList[str]; // found already this session?
   if (!cstr) { // no - look up
      cstr = SocialCalc.Constants["s_loc_"+str.toLowerCase().replace(/\s/g, "_").replace(/\W/g, "X")] || str;
      SocialCalc.LocalizeStringList[str] = cstr;
      }
   return cstr;
   }

// LocalizeStringList init via mutable bridge (see above)

//
// outstr = SocialCalc.LocalizeSubstrings(str)
//
// SocialCalc function to make localization easier using %loc and %scc.
//
// Replaces sections of str with:
//    %loc!Text to localize!
// with SocialCalc.Constants.s_loc_text_to_localize if
// it exists, or else with just "Text to localize".
// Note that spaces are replaced with "_" and other special
// chars with "X" in the name of the constant (e.g., %loc!A & B!
// would look for SocialCalc.Constants.s_loc_a_X_b.
// Uses SocialCalc.LocalizeString for this.
//
// Replaces sections of str with:
//    %ssc!constant-name!
// with SocialCalc.Constants.constant-name.
// If the constant doesn't exist, throws and alert.
//

/** @param {string} str */
SocialCalc.LocalizeSubstrings = function(str: string): string {

   var SCLoc = SocialCalc.LocalizeString;

   return str.replace(/%(loc|ssc)!(.*?)!/g,
      /**
       * @param {string} a
       * @param {string} t
       * @param {string} c
       */
      function(a, t, c) {
      if (t=="ssc") {
         return SocialCalc.Constants[c] || alert("Missing constant: "+c);
         }
      else {
         return SCLoc(c);
         }
      });

   }

//
// obj = GetSpreadsheetViewerObject()
//
// Returns the current spreadsheet view object
//

SocialCalc.GetSpreadsheetViewerObject = function(): SocialCalc.SpreadsheetViewer {

   var csvo = SocialCalc.CurrentSpreadsheetViewerObject;
   if (csvo) return csvo;

   throw ("No current SpreadsheetViewer object.");

   }


//
// SocialCalc.DoOnResize(spreadsheet)
//
// Processes an onResize event, setting the different views.
//

function SocialCalc_DoOnResize_Viewer(spreadsheet: SocialCalc.SpreadsheetViewer): void {

   var v: HTMLElement;
   var vname: string;
   var views = spreadsheet.views || {};

   var needresize = spreadsheet.SizeSSDiv();
   if (!needresize) return;

   for (vname in views) {
      v = views[vname]!.element;
      v.style.width = spreadsheet.width + "px";
      v.style.height = (spreadsheet.height-spreadsheet.nonviewheight) + "px";
      }

   if(SocialCalc._app) return; // app has no scroll bars and keep normal HTML style page scroll - for mobile
   spreadsheet.editor.ResizeTableEditor(spreadsheet.width, spreadsheet.height-spreadsheet.nonviewheight);

   }


//
// resized = SocialCalc.SizeSSDiv(spreadsheet)
//
// Figures out a reasonable size for the spreadsheet, given any requested values and viewport.
// Sets ssdiv to that.
// Return true if different than existing values.
//

function SocialCalc_SizeSSDiv_Viewer(spreadsheet: SocialCalc.SpreadsheetViewer): boolean {

   var sizes: ReturnType<typeof SocialCalc.GetViewportInfo>;
   var pos: { left: number; top: number; right: number; bottom: number };
   var resized: boolean, nodestyle: CSSStyleDeclaration, newval: number;
   var fudgefactorX = 10; // for IE
   var fudgefactorY = 10;

   resized = false;

   if (!spreadsheet.parentNode || !spreadsheet.spreadsheetDiv) {
      return false;
      }

   sizes = SocialCalc.GetViewportInfo();
   // GetElementPosition only returns left/top; extend with margin-derived right/bottom.
   const basePos = SocialCalc.GetElementPosition(spreadsheet.parentNode);
   pos = { left: basePos.left, top: basePos.top, right: 0, bottom: 0 };

   nodestyle = spreadsheet.parentNode.style;

   if (nodestyle.marginTop) {
      pos.top += Number(nodestyle.marginTop.slice(0,-2)) || 0;
      }
   if (nodestyle.marginBottom) {
      pos.bottom += Number(nodestyle.marginBottom.slice(0,-2)) || 0;
      }
   if (nodestyle.marginLeft) {
      pos.left += Number(nodestyle.marginLeft.slice(0,-2)) || 0;
      }
   if (nodestyle.marginRight) {
      pos.right += Number(nodestyle.marginRight.slice(0,-2)) || 0;
      }

   newval = spreadsheet.requestedHeight ||
            sizes.height - (pos.top + pos.bottom + fudgefactorY) -
               (spreadsheet.requestedSpaceBelow || 0);
   if (spreadsheet.height != newval) {
      spreadsheet.height = newval;
      spreadsheet.spreadsheetDiv.style.height = newval + "px";
      resized = true;
      }
   newval = spreadsheet.requestedWidth ||
            sizes.width - (pos.left + pos.right + fudgefactorX) || 700;
   if (spreadsheet.width != newval) {
      spreadsheet.width = newval;
      spreadsheet.spreadsheetDiv.style.width = newval + "px";
      resized = true;
      }

   spreadsheet.spreadsheetDiv.style.position = "relative";

   return resized;

   }

// Install viewer overloads onto shared free-function names (also used by SpreadsheetControl).
(SocialCalc as unknown as {
   DoOnResize: (spreadsheet: SocialCalc.SpreadsheetViewer) => void;
   SizeSSDiv: (spreadsheet: SocialCalc.SpreadsheetViewer) => boolean;
}).DoOnResize = SocialCalc_DoOnResize_Viewer;
(SocialCalc as unknown as {
   DoOnResize: (spreadsheet: SocialCalc.SpreadsheetViewer) => void;
   SizeSSDiv: (spreadsheet: SocialCalc.SpreadsheetViewer) => boolean;
}).SizeSSDiv = SocialCalc_SizeSSDiv_Viewer;


//
// SocialCalc.SpreadsheetViewerStatuslineCallback
//

/**
 * @param {any} editor
 * @param {string} status
 * @param {any} arg
 * @param {{ spreadsheetobj?: any; [k: string]: any }} params
 */
SocialCalc.SpreadsheetViewerStatuslineCallback = function(
   editor: SocialCalc.TableEditor,
   status: string,
   arg: unknown,
   params: { spreadsheetobj?: SocialCalc.SpreadsheetViewer; [k: string]: unknown }
): void {

   var spreadsheet = params.spreadsheetobj;
   var slstr = "";

   if (spreadsheet && spreadsheet.statuslineDiv) {
      if (spreadsheet.statuslineFull) {
         slstr = editor.GetStatuslineString(status, arg, params);
         }
      else {
         slstr = editor.ecell ? editor.ecell.coord : "";
         }
      slstr = spreadsheet.statuslineHTML.replace(/\{status\}/, slstr);
      spreadsheet.statuslineDiv.innerHTML = slstr;
      }

   switch (status) {
      case "cmdendnorender":
      case "calcfinished":
      case "doneposcalc":
         break; // not updating Recalc button since no toolbar

      default:
         break;
      }

   }


//
// SocialCalc.CmdGotFocus(obj)
//
// Sets SocialCalc.Keyboard.passThru: obj should be element with focus or "true"
//

/** @param {HTMLElement|boolean|null} obj */
SocialCalc.CmdGotFocus = function(obj: HTMLElement | boolean | null): void {

   SocialCalc.Keyboard.passThru = obj;

   }


//
// result = SocialCalc.SpreadsheetViewerCreateSheetHTML(spreadsheet)
//
// Returns the HTML representation of the whole spreadsheet
//

/** @param {any} spreadsheet */
SocialCalc.SpreadsheetViewerCreateSheetHTML = function(spreadsheet: SocialCalc.SpreadsheetViewer): string {

   var context, div, ele;

   var result = "";

   context = new SocialCalc.RenderContext(spreadsheet.sheet);
   div = document.createElement("div");
   ele = context.RenderSheet(null, {type: "html"});
   div.appendChild(ele);
   result = div.innerHTML;
   return result;

   }


///////////////////////
//
// LOAD ROUTINE
//
///////////////////////

//
// parts = SocialCalc.SpreadsheetViewerDecodeSpreadsheetSave(spreadsheet, str)
//
// Separates the parts from a spreadsheet save string, returning an object with the sub-strings.
//
//    {type1: {start: startpos, end: endpos}, type2:...}
//

/**
 * @param {any} spreadsheet
 * @param {string} str
 */
SocialCalc.SpreadsheetViewerDecodeSpreadsheetSave = function(
   spreadsheet: SocialCalc.SpreadsheetViewer,
   str: string
): { [key: string]: { start: number; end: number } } {

   var pos1, mpregex, searchinfo, boundary, boundaryregex, blanklineregex, start, ending, lines, i, p, pnum, line;
   /** @type {{ [key: string]: { start: number; end: number } }} */
   var parts: { [key: string]: { start: number; end: number } } = {};
   var partlist: string[] = [];

var hasreturnonly = /[^\n]\r[^\n]/;
if (hasreturnonly.test(str)) {
str = str.replace(/([^\n])\r([^\n])/g, "$1\r\n$2");
}
   pos1 = str.search(/^MIME-Version:\s1\.0/mi);
   if (pos1 < 0) return parts;

   mpregex = /^Content-Type:\s*multipart\/mixed;\s*boundary=(\S+)/mig;
   mpregex.lastIndex = pos1;

   searchinfo = mpregex.exec(str);
   if (!searchinfo || mpregex.lastIndex <= 0) return parts;
   boundary = searchinfo[1];

   boundaryregex = new RegExp("^--"+boundary+"(?:\r\n|\n)", "mg");
   boundaryregex.lastIndex = mpregex.lastIndex;

   searchinfo = boundaryregex.exec(str); // find header top boundary
   blanklineregex = /(?:\r\n|\n)(?:\r\n|\n)/gm;
   blanklineregex.lastIndex = boundaryregex.lastIndex;
   searchinfo = blanklineregex.exec(str); // skip to after blank line
   if (!searchinfo) return parts;
   start = blanklineregex.lastIndex;
   boundaryregex.lastIndex = start;
   searchinfo = boundaryregex.exec(str); // find end of header
   if (!searchinfo) return parts;
   ending = searchinfo.index;

   lines = str.substring(start, ending).split(/\r\n|\n/); // get header as lines
   for (i=0;i<lines.length;i++) {
      line=lines[i];
      p = line.split(":");
      switch (p[0]) {
         case "version":
            break;
         case "part":
            partlist.push(p[1]);
            break;
         }
      }

   for (pnum=0; pnum<partlist.length; pnum++) { // get each part
      blanklineregex.lastIndex = ending;
      searchinfo = blanklineregex.exec(str); // find blank line ending mime-part header
      if (!searchinfo) return parts;
      start = blanklineregex.lastIndex;
      if (pnum==partlist.length-1) { // last one has different boundary
         boundaryregex = new RegExp("^--"+boundary+"--$", "mg");
         }
      boundaryregex.lastIndex = start;
      searchinfo = boundaryregex.exec(str); // find ending boundary
      if (!searchinfo) return parts;
      ending = searchinfo.index;
      parts[partlist[pnum]] = {start: start, end: ending}; // return position within full string
      }

   return parts;

   }


// END OF FILE

