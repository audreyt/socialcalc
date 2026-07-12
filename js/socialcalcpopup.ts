// Opt this module into TypeScript strict checking via the r2scout config.
// In-place TypeScript conversion of socialcalcpopup.js (SocialCalc global script).
// Ambient API types live in socialcalcpopup.d.ts.
// Typechecked global-script module (no @ts-nocheck).
/*
// The module of the SocialCalc package for the optional popup menus in socialcalcspreadsheetcontrol.js
//
// (c) Copyright 2009 Socialtext, Inc.
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
//
*/

// Module-load guards removed — in the concatenated UMD bundle, SocialCalc
// is always defined by the time this file runs.

// Implementation-only mutable view for progressive Popup bag init.
type PopupMutable = {
  Types: Record<string, SocialCalc.Popup.PopupTypeHandler>;
  Controls: Record<string, SocialCalc.Popup.PopupControl>;
  Current: SocialCalc.Popup.PopupCurrent;
  imagePrefix: string;
  HexDigits: string;
  LocalizeString: (str: string) => string;
  Create: (type: string, id: string, attribs?: SocialCalc.Popup.PopupAttribs) => void;
  SetValue: (id: string, value: SocialCalc.Popup.PopupControlValue) => void;
  SetDisabled: (id: string, disabled: boolean) => void;
  GetValue: (id: string) => unknown;
  Initialize: (id: string, data: { [k: string]: any }) => void;
  Reset: (type: string) => void;
  CClick: (id: string) => void;
  Close: () => void;
  Cancel: () => void;
  CreatePopupDiv: (id: string, attribs: SocialCalc.Popup.PopupAttribs) => HTMLElement;
  EnsurePosition: (id: string, container: HTMLElement) => void;
  DestroyPopupDiv: (ele: HTMLElement | null, dragregistered: HTMLElement | null) => void;
  makeRGB: (r: number, g: number, b: number) => string;
  splitRGB: (rgb: string) => SocialCalc.Popup.RGBParts;
  [key: string]: unknown;
};
(SocialCalc as unknown as { Popup: PopupMutable }).Popup = {} as PopupMutable;
const PopupMut: PopupMutable = (SocialCalc as unknown as { Popup: PopupMutable }).Popup;

// Routines and values for each type of control, indexed by type name
// The value for each is an object constructed as follows:
//
//    Create = function(type, id, attribs)
//    Initialize = function(type, id, data)
//    SetValue = function(type, id, value)
//    GetValue = function(type, id) returns value
//    SetDisabled = function(type, id, t/f)
//    Show = function(type, id)
//    Hide = function(type, id)
//    Cancel = function(type, id)
//    Reset = function(type)
//
//    data = object to hold type-specific data
//

PopupMut.Types = {};

// Definitions for each individual control, indexed by id
// The value for each is an object constructed as follows:
//
//    type: type name of the control
//    value: current value of the control (usually a string, but can depend on type)
//    data: object with type-specific items
//

PopupMut.Controls = {};

// System-wide values of currently active control
//
//    id: id of current control or null
//

PopupMut.Current = {} as SocialCalc.Popup.PopupCurrent;

// Override this for localization

/**
 * @param {string} str
 * @returns {string}
 */
SocialCalc.Popup.LocalizeString = function (str: string) {
  return str;
};

// * * * * * * * * * * * * * * * *
//
// GENERAL ROUTINES
//
// * * * * * * * * * * * * * * * *

//
// SocialCalc.Popup.Create(type, id, attribs)
//
// Creates a control of type "type" as the children of document element "id" using "attribs"
//

/**
 * @param {string} type
 * @param {string} id
 * @param {any} [attribs]
 */
PopupMut.Create = function (
  type: string,
  id: string,
  attribs?: SocialCalc.Popup.PopupAttribs,
): void {
  var pt = SocialCalc.Popup.Types[type];
  if (pt && pt.Create) {
    pt.Create!(type, id, attribs);
  }

  PopupMut.imagePrefix = SocialCalc.Constants.defaultImagePrefix; // image prefix
};

//
// SocialCalc.Popup.SetValue(id, value)
//
// Sets the value of control.
//

/**
 * @param {string} id
 * @param {any} value
 */
PopupMut.SetValue = function (id: string, value: SocialCalc.Popup.PopupControlValue): void {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (!spc[id]) {
    alert("Unknown control " + id);
    return;
  }

  var type = spc[id].type;
  var pt = spt[type];
  var spcdata = spc[id]!.data;

  if (pt && pt.Create) {
    pt.SetValue!(type, id, value);
    if (spcdata.attribs && spcdata.attribs.changedcallback) {
      spcdata.attribs.changedcallback!(spcdata.attribs, id, value);
    }
  }
};

//
// SocialCalc.Popup.SetDisabled(id, disabled)
//
// Sets whether the control is disabled (true) or not (false).
//

/**
 * @param {string} id
 * @param {boolean} disabled
 */
PopupMut.SetDisabled = function (id: string, disabled: boolean): void {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (!spc[id]) {
    alert("Unknown control " + id);
    return;
  }

  var type = spc[id].type;

  var pt = spt[type];
  if (pt && pt.Create) {
    if (sp.Current.id && id == sp.Current.id) {
      pt.Hide!(type, sp.Current.id);
      sp.Current.id = null;
    }
    pt.SetDisabled!(type, id, disabled);
  }
};

//
// SocialCalc.Popup.GetValue(id)
//
// Returns the value of control.
//

/**
 * @param {string} id
 * @returns {any}
 */
PopupMut.GetValue = function (id: string): unknown {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (!spc[id]) {
    alert("Unknown control " + id);
    return;
  }

  var type = spc[id].type;

  var pt = spt[type];
  if (pt && pt.Create) {
    return pt.GetValue!(type, id);
  }

  return null;
};

//
// SocialCalc.Popup.Initialize(id, data)
//
// Gives "data" to the appropriate initialization code.
//

/**
 * @param {string} id
 * @param {any} data
 */
PopupMut.Initialize = function (id: string, data: { [k: string]: any }): void {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (!spc[id]) {
    alert("Unknown control " + id);
    return;
  }

  var type = spc[id].type;

  var pt = spt[type];
  if (pt && pt.Initialize) {
    pt.Initialize!(type, id, data);
  }
};

//
// SocialCalc.Popup.Reset(type)
//
// Resets Popup, such as when turning to page.
//

/**
 * @param {string} type
 */
PopupMut.Reset = function (type: string): void {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;

  // Other dispatchers (SetValue/GetValue/CClick) all guard with `pt && ...
  //`; Reset historically dereferenced `spt[type].Reset` directly, so a
  // typo or stale type name threw a TypeError. Treat an unknown type the
  // same way handler-less types are treated: as a silent no-op.
  if (spt[type] && spt[type].Reset) spt[type].Reset!(type);
};

//
// SocialCalc.Popup.CClick(id)
//
// Should be called when the user clicks on a control to do the popup
//

/**
 * @param {string} id
 */
PopupMut.CClick = function (id: string): void {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (!spc[id]) {
    alert("Unknown control " + id);
    return;
  }

  if (spc[id].data && spc[id].data.disabled) return;

  var type = spc[id].type;

  var pt = spt[type];

  if (sp.Current.id) {
    spt[spc[sp.Current.id].type].Hide!(type, sp.Current.id);
    if (id == sp.Current.id) {
      // same one - done
      sp.Current.id = null;
      return;
    }
  }

  if (pt && pt.Show) {
    pt.Show!(type, id);
  }

  sp.Current.id = id;
};

//
// SocialCalc.Popup.Close()
//
// Used to close any open popup.
//

PopupMut.Close = function (): void {
  var sp = SocialCalc.Popup;

  if (!sp.Current.id) return;

  sp.CClick(sp.Current.id);
};

//
// SocialCalc.Popup.Cancel()
//
// Closes Popup and restores old value
//

PopupMut.Cancel = function (): void {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (!sp.Current.id) return;

  var type = spc[sp.Current.id].type;

  var pt = spt[type];

  pt.Cancel!(type, sp.Current.id);

  sp.Current.id = null;
};

//
// ele = SocialCalc.Popup.CreatePopupDiv(id, attribs)
//
// Utility function to create the main popup div of width attribs.width.
// If attribs.title, create one with that text, and optionally attribs.moveable.
//

/**
 * @param {string} id
 * @param {any} attribs
 * @returns {HTMLElement}
 */
PopupMut.CreatePopupDiv = function (
  id: string,
  attribs: SocialCalc.Popup.PopupAttribs,
): HTMLElement {
  var pos;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  var main = document.createElement("div");
  main.style.position = "absolute";

  pos = SocialCalc.GetElementPosition(
    spcdata.mainele as HTMLElement,
  ) as SocialCalc.Popup.PopupLayoutValues;

  main.style.top = pos.top + spcdata.mainele.offsetHeight + "px";
  main.style.left = pos.left + "px";
  main.style.zIndex = String(/** @type {any} */ (100));
  main.style.backgroundColor = "#FFF";
  main.style.border = "1px solid black";

  if (attribs.width) {
    main.style.width = attribs.width;
  }

  spcdata.mainele.appendChild(main);

  if (attribs.title) {
    main.innerHTML =
      '<table cellspacing="0" cellpadding="0" style="border-bottom:1px solid black;"><tr>' +
      '<td style="font-size:10px;cursor:default;width:100%;background-color:#999;color:#FFF;">' +
      attribs.title +
      "</td>" +
      '<td style="font-size:10px;cursor:default;color:#666;" onclick="SocialCalc.Popup.Cancel();">&nbsp;X&nbsp;</td></tr></table>';

    if (attribs.moveable) {
      // The DOM tree we just assigned via innerHTML guarantees these nodes exist.
      var tableEle: HTMLElement = main.firstChild as HTMLElement;
      var tbodyEle: HTMLElement = tableEle.firstChild as HTMLElement;
      var trEle: HTMLElement = tbodyEle.firstChild as HTMLElement;
      var tdEle: HTMLElement = trEle.firstChild as HTMLElement;
      spcdata.dragregistered = tdEle;
      SocialCalc.DragRegister(
        spcdata.dragregistered,
        true,
        true,
        {
          MouseDown: SocialCalc.DragFunctionStart,
          MouseMove: SocialCalc.DragFunctionPosition,
          MouseUp: SocialCalc.DragFunctionPosition,
          Disabled: null,
          positionobj: main,
        },
        spcdata.mainele,
      );
    }
  }

  return main;
};

//
// SocialCalc.Popup.EnsurePosition(id, container as HTMLElement)
//
// Utility function to make sure popup is positioned completely within container (both element objects)
// and appropriate with respect to the main element controlling the popup.
//

/**
 * @param {string} id
 * @param {HTMLElement} container
 */
PopupMut.EnsurePosition = function (id: string, container: HTMLElement): void {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  var main = spcdata.mainele.firstChild as HTMLElement;
  if (!main) {
    alert("No main popup element firstChild.");
    return;
  }
  var popup = spcdata.popupele as HTMLElement;

  /**
   * @param {any} ele
   * @returns {{top: number, left: number, height: number, width: number, bottom: number, right: number}}
   */
  function GetLayoutValues(ele: HTMLElement) {
    var r = SocialCalc.GetElementPosition(ele) as SocialCalc.Popup.PopupLayoutValues;
    r.height = ele.offsetHeight;
    r.width = ele.offsetWidth;
    r.bottom = r.top + r.height;
    r.right = r.left + r.width;
    return r;
  }

  var p = GetLayoutValues(popup);
  var c = GetLayoutValues(container);
  var m = GetLayoutValues(main);
  //addmsg("popup t/r/b/l/h/w= "+p.top+"/"+p.right+"/"+p.bottom+"/"+p.left+"/"+p.height+"/"+p.width);
  //addmsg("container t/r/b/l/h/w= "+c.top+"/"+c.right+"/"+c.bottom+"/"+c.left+"/"+c.height+"/"+c.width);
  //addmsg("main t/r/b/l/h/w= "+m.top+"/"+m.right+"/"+m.bottom+"/"+m.left+"/"+m.height+"/"+m.width);

  // Check various layout cases in priority order

  if (m.bottom + p.height < c.bottom && m.left + p.width < c.right) {
    // normal case: room on bottom and right
    popup.style.top = m.bottom + "px";
    popup.style.left = m.left + "px";
  } else if (m.top - p.height > c.top && m.left + p.width < c.right) {
    // room on top and right
    popup.style.top = m.top - p.height + "px";
    popup.style.left = m.left + "px";
  } else if (m.bottom + p.height < c.bottom && m.right - p.width > c.left) {
    // room on bottom and left
    popup.style.top = m.bottom + "px";
    popup.style.left = m.right - p.width + "px";
  } else if (m.top - p.height > c.top && m.right - p.width > c.left) {
    // room on top and left
    popup.style.top = m.top - p.height + "px";
    popup.style.left = m.right - p.width + "px";
  } else if (m.bottom + p.height < c.bottom && p.width < c.width) {
    // room on bottom and middle
    popup.style.top = m.bottom + "px";
    popup.style.left = c.left + Math.floor((c.width - p.width) / 2) + "px";
  } else if (m.top - p.height > c.top && p.width < c.width) {
    // room on top and middle
    popup.style.top = m.top - p.height + "px";
    popup.style.left = c.left + Math.floor((c.width - p.width) / 2) + "px";
  } else if (p.height < c.height && m.right + p.width < c.right) {
    // room on middle and right
    popup.style.top = c.top + Math.floor((c.height - p.height) / 2) + "px";
    popup.style.left = m.right + "px";
  } else if (p.height < c.height && m.left - p.width > c.left) {
    // room on middle and left
    popup.style.top = c.top + Math.floor((c.height - p.height) / 2) + "px";
    popup.style.left = m.left - p.width + "px";
  } else {
    // nothing works, so leave as it is
  }
  //addmsg("Popup layout "+t);
};

//
// ele = SocialCalc.Popup.DestroyPopupDiv(ele, dragregistered)
//
// Utility function to get rid of the main popup div.
//

/**
 * @param {HTMLElement | null} ele
 * @param {any} dragregistered
 */
PopupMut.DestroyPopupDiv = function (
  ele: HTMLElement | null,
  dragregistered: HTMLElement | null,
): void {
  if (!ele) return;

  ele.innerHTML = "";

  SocialCalc.DragUnregister(dragregistered as HTMLElement); // OK to do this even if not registered

  if (ele.parentNode) {
    ele.parentNode.removeChild(ele);
  }
};

//
// Color Utility Functions
//

/**
 * File-private 8-bit channel clamp shared by ToHex, makeRGB, splitRGB, and
 * RGBToHex's parse layer so all four share one integer-rounding policy:
 *   - non-finite or <0  -> 0
 *   - >255               -> 255
 *   - otherwise          -> Math.trunc(v) (explicit integer rounding)
 * Hoisted out of per-call allocation so splitRGB/etc. don't recreate an
 * inner closure on each invocation. Not exported on SocialCalc.Popup —
 * this is a script-local color normalization helper, not part of the
 * public type surface.
 */
function PopupClamp255(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 255) return 255;
  return Math.trunc(v);
}

/**
 * @param {string} val
 * @returns {string}
 */
PopupMut.RGBToHex = function (val: string) {
  var sp = SocialCalc.Popup;

  if (val == "") {
    return "000000";
  }
  // Capture optional leading sign so "(−5, 0, 0)" no longer parses the
  // trailing digit "5" as "+5"; each channel is normalized through the
  // shared PopupClamp255 helper at the parse boundary before ToHex does
  // its own final clamp (cheap, explicit parity at every consumer).
  var rgbvals = val.match(/(-?\d+)\D+(-?\d+)\D+(-?\d+)/);
  if (rgbvals) {
    return (
      sp.ToHex(PopupClamp255(Number(rgbvals[1]))) +
      sp.ToHex(PopupClamp255(Number(rgbvals[2]))) +
      sp.ToHex(PopupClamp255(Number(rgbvals[3])))
    );
  } else {
    return "000000";
  }
};

PopupMut.HexDigits = "0123456789ABCDEF";

/**
 * @param {number} num
 * @returns {string}
 */
PopupMut.ToHex = function (num: number) {
  var sp = SocialCalc.Popup;
  // Reuses the file-private clamp so hex formatting, RGBToHex parsing, and
  // makeRGB all share one integer-rounding policy (Math.trunc inside the
  // clamp; Math.floor on the already-integral clamped value below for the
  // nibble split is intentionally preserved as hex's own combinatorial
  // rounding, not redundant channel rounding).
  var v = PopupClamp255(num);
  var first = Math.floor(v / 16);
  var second = v % 16;
  return sp.HexDigits.charAt(first) + sp.HexDigits.charAt(second);
};

/**
 * @param {string} str
 * @returns {number}
 */
PopupMut.FromHex = function (str: string) {
  var sp = SocialCalc.Popup;
  var first = sp.HexDigits.indexOf(str.charAt(0).toUpperCase());
  var second = sp.HexDigits.indexOf(str.charAt(1).toUpperCase());
  return (first >= 0 ? first : 0) * 16 + (second >= 0 ? second : 0);
};

/**
 * @param {string} val
 * @returns {string}
 */
PopupMut.HexToRGB = function (val: string) {
  var sp = SocialCalc.Popup;

  return (
    "rgb(" +
    sp.FromHex(val.substring(1, 3)) +
    "," +
    sp.FromHex(val.substring(3, 5)) +
    "," +
    sp.FromHex(val.substring(5, 7)) +
    ")"
  );
};

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
PopupMut.makeRGB = function (r: number, g: number, b: number): string {
  return "rgb(" + PopupClamp255(r) + "," + PopupClamp255(g) + "," + PopupClamp255(b) + ")";
};

/**
 * @param {string} rgb
 * @returns {{r: number, g: number, b: number}}
 */
PopupMut.splitRGB = function (rgb: string): SocialCalc.Popup.RGBParts {
  var parts = rgb.match(/(-?\d+)\D+(-?\d+)\D+(-?\d+)\D/);
  if (!parts) {
    return { r: 0, g: 0, b: 0 };
  }
  // Both the sign-aware regex above and the shared clamp at the parse
  // boundary replace the older inline-and-duplicated clampChannel that was
  // allocated on every call. Channels are integer-rounded via Math.trunc
  // inside PopupClamp255; non-finite / <0 -> 0; >255 -> 255.
  return {
    r: PopupClamp255(Number(parts[1])),
    g: PopupClamp255(Number(parts[2])),
    b: PopupClamp255(Number(parts[3])),
  };
};

// * * * * * * * * * * * * * * * *
//
// ROUTINES FOR EACH TYPE
//
// * * * * * * * * * * * * * * * *

//
// List
//
// type: List
// value: value of control,
// display: "value to display",
// custom: true if custom value,
// disabled: t/f,
// attribs: {
//    title: "popup title string",
//    moveable: t/f,
//    width: optional width, e.g., "100px",
//    ensureWithin: optional element object to ensure popup fits within if possible
//    changedcallback: optional function(attribs, id, newvalue),
//    ...
//    }
// data: {
//    ncols: calculated number of columns
//    options: [
//       {o: option-name, v: value-to-return,
//        a: {option attribs} // optional: {skip: true, custom: true, cancel: true, newcol: true}
//       },
//       ...]
//    }
//
// popupele: gets popup element object when created
// contentele: gets element created with all the content
// listdiv: gets div with list of items
// customele: gets input element with custom value
// dragregistered: gets element, if any, registered as draggable
//

PopupMut.Types.List = {};

/**
 * @param {string} type
 * @param {string} id
 * @param {any} [attribs]
 */
SocialCalc.Popup.Types.List.Create = function (type: string, id: string, attribs: unknown) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;

  /** @type {{type: string, value: string, display: string, data: {[k: string]: any}}} */
  var spcid: SocialCalc.Popup.PopupControl = { type: type, value: "", display: "", data: {} };
  //if (spc[id]) {alert("Already created "+id); return;}
  spc[id] = spcid;
  var spcdata = spcid.data;

  spcdata.attribs = attribs || {};

  var ele = document.getElementById(id) as HTMLElement;
  if (!ele) {
    alert("Missing element " + id);
    return;
  }

  spcdata.mainele = ele;

  ele.innerHTML =
    '<input style="cursor:pointer;width:100px;font-size:smaller;" onfocus="this.blur();" onclick="SocialCalc.Popup.CClick(\'' +
    id +
    '\');" value="">';

  spcdata.options = []; // set to nothing - use Initialize to fill
};

/**
 * @param {string} type
 * @param {string} id
 * @param {any} value
 */
SocialCalc.Popup.Types.List.SetValue = function (type: string, id: string, value: unknown) {
  var i, o;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  spcdata.value = value;
  spcdata.custom = false;

  for (i = 0; i < spcdata.options.length; i++) {
    o = spcdata.options[i];
    if (o.a) {
      if (o.a.skip || o.a.custom || o.a.cancel) {
        continue;
      }
    }
    if (o.v == spcdata.value) {
      // matches value
      spcdata.display = o.o;
      break;
    }
  }
  if (i == spcdata.options.length) {
    // none found
    spcdata.display = "Custom";
    spcdata.custom = true;
  }

  if (spcdata.mainele && spcdata.mainele.firstChild) {
    spcdata.mainele.firstChild.value = spcdata.display;
  }
};

/**
 * @param {string} type
 * @param {string} id
 * @param {boolean} disabled
 */
SocialCalc.Popup.Types.List.SetDisabled = function (type: string, id: string, disabled: boolean) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  spcdata.disabled = disabled;

  if (spcdata.mainele && spcdata.mainele.firstChild) {
    spcdata.mainele.firstChild.disabled = disabled;
  }
};

/**
 * @param {string} type
 * @param {string} id
 * @returns {any}
 */
SocialCalc.Popup.Types.List.GetValue = function (type: string, id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  return spcdata.value;
};

// data is: {value: initial value, attribs: {attribs stuff}, options: [{o: option-name, v: value-to-return, a: optional-attribs}, ...]}

/**
 * @param {string} type
 * @param {string} id
 * @param {any} data
 */
SocialCalc.Popup.Types.List.Initialize = function (
  type: string,
  id: string,
  data: { [k: string]: any },
) {
  var a;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  for (a in data.attribs) {
    spcdata.attribs[a] = data.attribs[a];
  }

  spcdata.options = data ? data.options : [];

  if (data.value) {
    // if has a value, set to it
    sp.SetValue(id, data.value);
  }
};

/**
 * @param {string} type
 */
SocialCalc.Popup.Types.List.Reset = function (type: string) {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (sp.Current.id && spc[sp.Current.id].type == type) {
    // we have a popup
    spt[type].Hide!(type, sp.Current.id);
    sp.Current.id = null;
  }
};

/**
 * @param {string} type
 * @param {string} id
 */
SocialCalc.Popup.Types.List.Show = function (type: string, id: string) {
  var ele;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id].data;

  var str = "";

  spcdata.popupele = sp.CreatePopupDiv(id, spcdata.attribs);

  if (spcdata.custom) {
    str = SocialCalc.Popup.Types.List.MakeCustom(type, id);

    ele = document.createElement("div");
    ele.innerHTML =
      '<div style="cursor:default;padding:4px;background-color:#CCC;">' + str + "</div>";

    // innerHTML above guarantees these chains of firstChild nodes exist.
    var outerDiv: HTMLElement = ele.firstChild as HTMLElement;
    var innerDiv: HTMLElement = outerDiv.firstChild as HTMLElement;
    spcdata.customele = innerDiv.childNodes[1];
    spcdata.listdiv = null;
    spcdata.contentele = ele;
  } else {
    str = SocialCalc.Popup.Types.List.MakeList(type, id);

    ele = document.createElement("div");
    ele.innerHTML = '<div style="cursor:default;padding:4px;">' + str + "</div>";

    spcdata.customele = null;
    spcdata.listdiv = ele.firstChild as HTMLElement;
    spcdata.contentele = ele;
  }

  if (spcdata.mainele && spcdata.mainele.firstChild) {
    spcdata.mainele.firstChild.disabled = true;
  }

  spcdata.popupele.appendChild(ele);

  if (spcdata.attribs.ensureWithin) {
    SocialCalc.Popup.EnsurePosition(id, spcdata.attribs.ensureWithin as HTMLElement);
  }
};

/**
 * @param {string} type
 * @param {string} id
 * @returns {string}
 */
SocialCalc.Popup.Types.List.MakeList = function (type: string, id: string) {
  var i, o, bg;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id].data;

  var str = '<table cellspacing="0" cellpadding="0"><tr>';
  var td = '<td style="vertical-align:top;">';

  str += td;

  spcdata.ncols = 1;

  for (i = 0; i < spcdata.options.length; i++) {
    o = spcdata.options[i];
    if (o.a) {
      if (o.a.newcol) {
        str += "</td>" + td + "&nbsp;&nbsp;&nbsp;&nbsp;" + "</td>" + td;
        spcdata.ncols += 1;
        continue;
      }
      if (o.a.skip) {
        str += '<div style="font-size:x-small;white-space:nowrap;">' + o.o + "</div>";
        continue;
      }
    }
    if (o.v == spcdata.value && !(o.a && (o.a.custom || o.a.cancel))) {
      // matches value
      bg = "background-color:#DDF;";
    } else {
      bg = "";
    }
    str +=
      '<div style="font-size:x-small;white-space:nowrap;' +
      bg +
      '" onclick="SocialCalc.Popup.Types.List.ItemClicked(\'' +
      id +
      "','" +
      i +
      "');\" onmousemove=\"SocialCalc.Popup.Types.List.MouseMove('" +
      id +
      "',this);\">" +
      o.o +
      "</div>";
  }

  str += "</td></tr></table>";

  return str;
};

/**
 * @param {string} type
 * @param {string} id
 * @returns {string}
 */
SocialCalc.Popup.Types.List.MakeCustom = function (type: string, id: string) {
  var SPLoc = SocialCalc.Popup.LocalizeString;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  var style = 'style="font-size:smaller;"';

  var str = "";

  var val = spcdata.value;
  val = SocialCalc.special_chars(val);

  str =
    '<div style="white-space:nowrap;"><br>' +
    '<input id="customvalue" value="' +
    val +
    '"><br><br>' +
    "<input " +
    style +
    ' type="button" value="' +
    SPLoc("OK") +
    '" onclick="SocialCalc.Popup.Types.List.CustomOK(\'' +
    id +
    "');return false;\">" +
    "<input " +
    style +
    ' type="button" value="' +
    SPLoc("List") +
    '" onclick="SocialCalc.Popup.Types.List.CustomToList(\'' +
    id +
    "');\">" +
    "<input " +
    style +
    ' type="button" value="' +
    SPLoc("Cancel") +
    '" onclick="SocialCalc.Popup.Close();">' +
    "<br></div>";

  return str;
};

/**
 * @param {string} id
 * @param {number | string} num
 */
SocialCalc.Popup.Types.List.ItemClicked = function (id: string, num: number) {
  var oele, str, nele;
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  var a = spcdata.options[num].a;

  if (a && a.custom) {
    oele = spcdata.contentele;
    str = SocialCalc.Popup.Types.List.MakeCustom("List", id);
    nele = document.createElement("div");
    nele.innerHTML =
      '<div style="cursor:default;padding:4px;background-color:#CCC;">' + str + "</div>";
    // innerHTML above guarantees the nested firstChild DOM is present.
    var outerDivIC: HTMLElement = nele.firstChild as HTMLElement;
    var innerDivIC: HTMLElement = outerDivIC.firstChild as HTMLElement;
    spcdata.customele = innerDivIC.childNodes[1];
    spcdata.listdiv = null;
    spcdata.contentele = nele;
    spcdata.popupele.replaceChild(nele, oele);
    if (spcdata.attribs.ensureWithin) {
      SocialCalc.Popup.EnsurePosition(id, spcdata.attribs.ensureWithin as HTMLElement);
    }
    return;
  }

  if (a && a.cancel) {
    SocialCalc.Popup.Close();
    return;
  }

  SocialCalc.Popup.SetValue(id, spcdata.options[num].v);

  SocialCalc.Popup.Close();
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.List.CustomToList = function (id: string) {
  var oele, str, nele;
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  oele = spcdata.contentele;
  str = SocialCalc.Popup.Types.List.MakeList("List", id);
  nele = document.createElement("div");
  nele.innerHTML = '<div style="cursor:default;padding:4px;">' + str + "</div>";
  spcdata.customele = null;
  spcdata.listdiv = nele.firstChild as HTMLElement;
  spcdata.contentele = nele;
  spcdata.popupele.replaceChild(nele, oele);

  if (spcdata.attribs.ensureWithin) {
    SocialCalc.Popup.EnsurePosition(id, spcdata.attribs.ensureWithin as HTMLElement);
  }
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.List.CustomOK = function (id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  SocialCalc.Popup.SetValue(id, spcdata.customele.value);

  SocialCalc.Popup.Close();
};

/**
 * @param {string} id
 * @param {HTMLElement} ele
 */
SocialCalc.Popup.Types.List.MouseMove = function (id: string, ele: HTMLElement) {
  var col, i;
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  var list = spcdata.listdiv;

  if (!list) return;

  var rowele = list.firstChild.firstChild.firstChild as HTMLElement; // div.table.tbody.tr

  for (col = 0; col < spcdata.ncols; col++) {
    for (i = 0; i < rowele.childNodes[col * 2].childNodes.length; i++) {
      (rowele.childNodes[col * 2].childNodes[i] as HTMLElement).style.backgroundColor = "#FFF";
    }
  }

  ele.style.backgroundColor = "#DDF";
};

/**
 * @param {string} type
 * @param {string} id
 */
SocialCalc.Popup.Types.List.Hide = function (type: string, id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  sp.DestroyPopupDiv(spcdata.popupele, spcdata.dragregistered);
  spcdata.popupele = null;

  if (spcdata.mainele && spcdata.mainele.firstChild) {
    spcdata.mainele.firstChild.disabled = false;
  }
};

/**
 * @param {string} type
 * @param {string} id
 */
SocialCalc.Popup.Types.List.Cancel = function (type: string, id: string) {
  SocialCalc.Popup.Types.List.Hide!(type, id);
};

//
// ColorChooser
//
// type: ColorChooser
// value: value of control as "rgb(r,g,b)" or "" if default,
// oldvalue: starting value to reset to on close,
// display: "value to display" as hex color value,
// custom: true if custom value,
// disabled: t/f,
// attribs: {
//    title: "popup title string",
//    moveable: t/f,
//    width: optional width, e.g., "100px", of popup chooser
//    ensureWithin: optional element object to ensure popup fits within if possible
//    sampleWidth: optional width, e.g., "20px",
//    sampleHeight: optional height, e.g., "20px",
//    backgroundImage: optional background image for sample (transparent where want to show current color), e.g., "colorbg.gif"
//    backgroundImageDefault: optional background image for sample when default (transparent shows white)
//    backgroundImageDisabled: optional background image for sample when disabled (transparent shows gray)
//    changedcallback: optional function(attribs, id, newvalue),
//    ...
//    }
// data: {
//    }
//
// popupele: gets popup element object when created
// contentele: gets element created with all the content
// customele: gets input element with custom value
//

PopupMut.Types.ColorChooser = {};

/**
 * @param {string} type
 * @param {string} id
 * @param {any} [attribs]
 */
SocialCalc.Popup.Types.ColorChooser.Create = function (type: string, id: string, attribs: unknown) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;

  /** @type {{type: string, value: string, display: string, data: {[k: string]: any}}} */
  var spcid: SocialCalc.Popup.PopupControl = { type: type, value: "", display: "", data: {} };
  //if (spc[id]) {alert("Already created "+id); return;}
  spc[id] = spcid;
  var spcdata = spcid.data;

  spcdata.attribs = attribs || {};
  var spca = spcdata.attribs;

  spcdata.value = "";

  var ele = document.getElementById(id) as HTMLElement;
  if (!ele) {
    alert("Missing element " + id);
    return;
  }

  spcdata.mainele = ele;

  ele.innerHTML =
    '<div style="cursor:pointer;border:1px solid black;vertical-align:top;width:' +
    (spca.sampleWidth || "15px") +
    ";height:" +
    (spca.sampleHeight || "15px") +
    ';" onclick="SocialCalc.Popup.Types.ColorChooser.ControlClicked(\'' +
    id +
    "');\">&nbsp;</div>";
};

/**
 * @param {string} type
 * @param {string} id
 * @param {any} value
 */
SocialCalc.Popup.Types.ColorChooser.SetValue = function (type: string, id: string, value: unknown) {
  var img, pos;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;
  var spca = spcdata.attribs;

  spcdata.value = value;
  spcdata.custom = false;

  if (spcdata.mainele && spcdata.mainele.firstChild) {
    if (spcdata.value) {
      (spcdata.mainele.firstChild as HTMLElement).style.backgroundColor = spcdata.value;
      if (spca.backgroundImage) {
        img = "url(" + sp.imagePrefix + spca.backgroundImage + ")";
      } else {
        img = "";
      }
      pos = "center center";
    } else {
      (spcdata.mainele.firstChild as HTMLElement).style.backgroundColor = "#FFF";
      if (spca.backgroundImageDefault) {
        img = "url(" + sp.imagePrefix + spca.backgroundImageDefault + ")";
        pos = "center center";
      } else {
        img = "url(" + sp.imagePrefix + "defaultcolor.gif)";
        pos = "left top";
      }
    }
    (spcdata.mainele.firstChild as HTMLElement).style.backgroundPosition = pos;
    (spcdata.mainele.firstChild as HTMLElement).style.backgroundImage = img;
  }
};

/**
 * @param {string} type
 * @param {string} id
 * @param {boolean} disabled
 */
SocialCalc.Popup.Types.ColorChooser.SetDisabled = function (
  type: string,
  id: string,
  disabled: boolean,
) {
  var img, pos;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;
  var spca = spcdata.attribs;

  spcdata.disabled = disabled;

  if (spcdata.mainele && spcdata.mainele.firstChild) {
    if (disabled) {
      (spcdata.mainele.firstChild as HTMLElement).style.backgroundColor = "#DDD";
      if (spca.backgroundImageDisabled) {
        img = "url(" + sp.imagePrefix + spca.backgroundImageDisabled + ")";
        pos = "center center";
      } else {
        img = "url(" + sp.imagePrefix + "defaultcolor.gif)";
        pos = "left top";
      }
      (spcdata.mainele.firstChild as HTMLElement).style.backgroundPosition = pos;
      (spcdata.mainele.firstChild as HTMLElement).style.backgroundImage = img;
    } else {
      sp.SetValue(id, spcdata.value);
    }
  }
};

/**
 * @param {string} type
 * @param {string} id
 * @returns {any}
 */
SocialCalc.Popup.Types.ColorChooser.GetValue = function (type: string, id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  return spcdata.value;
};

/**
 * @param {string} type
 * @param {string} id
 * @param {any} data
 */
SocialCalc.Popup.Types.ColorChooser.Initialize = function (
  type: string,
  id: string,
  data: { [k: string]: any },
) {
  var a;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  for (a in data.attribs) {
    spcdata.attribs[a] = data.attribs[a];
  }

  if (data.value) {
    // if has a value, set to it
    sp.SetValue(id, data.value);
  }
};

/**
 * @param {string} type
 */
SocialCalc.Popup.Types.ColorChooser.Reset = function (type: string) {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;

  if (sp.Current.id && spc[sp.Current.id].type == type) {
    // we have a popup
    spt[type].Hide!(type, sp.Current.id);
    sp.Current.id = null;
  }
};

/**
 * @param {string} type
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.Show = function (type: string, id: string) {
  var ele, mainele;

  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id].data;

  var str = "";

  spcdata.oldvalue = spcdata.value; // remember starting value

  spcdata.popupele = sp.CreatePopupDiv(id, spcdata.attribs);

  if (spcdata.custom) {
    str = SocialCalc.Popup.Types.ColorChooser.MakeCustom(type, id);

    ele = document.createElement("div");
    ele.innerHTML =
      '<div style="cursor:default;padding:4px;background-color:#CCC;">' + str + "</div>";

    // innerHTML above guarantees the nested firstChild DOM is present.
    var ccOuter: HTMLElement = ele.firstChild as HTMLElement;
    var ccInner: HTMLElement = ccOuter.firstChild as HTMLElement;
    spcdata.customele = ccInner.childNodes[2];
    spcdata.contentele = ele;
  } else {
    mainele = SocialCalc.Popup.Types.ColorChooser.CreateGrid(type, id);

    ele = document.createElement("div");
    ele.style.padding = "3px";
    ele.style.backgroundColor = "#CCC";
    ele.appendChild(mainele);

    spcdata.customele = null;
    spcdata.contentele = ele;
  }

  spcdata.popupele.appendChild(ele);

  if (spcdata.attribs.ensureWithin) {
    SocialCalc.Popup.EnsurePosition(id, spcdata.attribs.ensureWithin as HTMLElement);
  }
};

/**
 * @param {string} type
 * @param {string} id
 * @returns {string}
 */
SocialCalc.Popup.Types.ColorChooser.MakeCustom = function (type: string, id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  var SPLoc = sp.LocalizeString;

  var style = 'style="font-size:smaller;"';

  var str = "";

  str =
    '<div style="white-space:nowrap;"><br>' +
    '#<input id="customvalue" style="width:75px;" value="' +
    spcdata.value +
    '"><br><br>' +
    "<input " +
    style +
    ' type="button" value="' +
    SPLoc("OK") +
    '" onclick="SocialCalc.Popup.Types.ColorChooser.CustomOK(\'' +
    id +
    "');return false;\">" +
    "<input " +
    style +
    ' type="button" value="' +
    SPLoc("Grid") +
    '" onclick="SocialCalc.Popup.Types.ColorChooser.CustomToGrid(\'' +
    id +
    "');\">" +
    "<br></div>";

  return str;
};

/**
 * @param {string} id
 * @param {number | string} num
 */
SocialCalc.Popup.Types.ColorChooser.ItemClicked = function (_id: string, _num: number) {
  SocialCalc.Popup.Close();
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.CustomToList = function (_id: string) {};

/**
 * @param {string} type
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.Hide = function (type: string, id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  sp.DestroyPopupDiv(spcdata.popupele, spcdata.dragregistered);
  spcdata.popupele = null;
};

/**
 * @param {string} type
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.Cancel = function (type: string, id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  sp.SetValue(id, spcdata.oldvalue); // reset to old value

  SocialCalc.Popup.Types.ColorChooser.Hide!(type, id);
};

/**
 * @param {string} type
 * @param {string} id
 * @returns {HTMLElement}
 */
SocialCalc.Popup.Types.ColorChooser.CreateGrid = function (type: string, id: string) {
  var ele, row, rowele, col, g;

  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var spc = sp.Controls;
  var SPLoc = sp.LocalizeString;
  var spcdata = spc[id]!.data;
  spcdata.grid = {};
  /** @type {any} */
  var grid = spcdata.grid;

  var mainele = document.createElement("div");

  /** @type {any} */
  var tele = document.createElement("table");
  tele.cellSpacing = "0";
  tele.cellPadding = "0";
  tele.style.width = "100px";
  grid.table = tele;

  ele = document.createElement("tbody");
  grid.table.appendChild(ele);
  grid.tbody = ele;

  for (row = 0; row < 16; row++) {
    rowele = document.createElement("tr");
    for (col = 0; col < 5; col++) {
      /** @type {any} */
      var gEntry: { ele?: HTMLElement; [k: string]: unknown } = {};
      g = gEntry;
      grid[row + "," + col] = g;
      ele = document.createElement("td");
      ele.style.fontSize = "1px";
      ele.innerHTML = "&nbsp;";
      ele.style.height = "10px";
      if (col <= 1) {
        ele.style.width = "17px";
        ele.style.borderRight = "3px solid white";
      } else {
        ele.style.width = "20px";
        ele.style.backgroundRepeat = "no-repeat";
      }
      rowele.appendChild(ele);
      g.ele = ele;
    }
    grid.tbody.appendChild(rowele);
  }
  mainele.appendChild(grid.table);

  ele = document.createElement("div");
  ele.style.marginTop = "3px";
  ele.innerHTML =
    '<table cellspacing="0" cellpadding="0"><tr>' +
    '<td style="width:17px;background-color:#FFF;background-image:url(' +
    sp.imagePrefix +
    'defaultcolor.gif);height:16px;font-size:10px;cursor:pointer;" title="' +
    SPLoc("Default") +
    '">&nbsp;</td>' +
    '<td style="width:23px;height:16px;font-size:10px;text-align:center;cursor:pointer;" title="' +
    SPLoc("Custom") +
    '">#</td>' +
    '<td style="width:60px;height:16px;font-size:10px;text-align:center;cursor:pointer;">' +
    SPLoc("OK") +
    "</td>" +
    "</tr></table>";
  // innerHTML above guarantees the nested firstChild DOM (table>tbody>tr with 3 td children) is present.
  var cgTable: HTMLElement = ele.firstChild as HTMLElement;
  var cgTbody: HTMLElement = cgTable.firstChild as HTMLElement;
  var cgTr: HTMLElement = cgTbody.firstChild as HTMLElement;
  grid.defaultbox = cgTr.childNodes[0];
  grid.defaultbox.onclick = (e: MouseEvent) => spt.ColorChooser.DefaultClicked(e);
  grid.custom = cgTr.childNodes[1];
  grid.custom.onclick = (e: MouseEvent) => spt.ColorChooser.CustomClicked(e);
  grid.msg = cgTr.childNodes[2];
  grid.msg.onclick = (e: MouseEvent) => spt.ColorChooser.CloseOK(e);
  mainele.appendChild(ele);

  grid.table.onmousedown = (e: MouseEvent) => spt.ColorChooser.GridMouseDown(e);

  spt.ColorChooser.DetermineColors(id);
  spt.ColorChooser.SetColors(id);

  return mainele;
};

/**
 * @param {any} grid
 * @param {number} row
 * @param {number} col
 * @returns {any}
 */
SocialCalc.Popup.Types.ColorChooser.gridToG = function (
  grid: { table?: HTMLElement; [k: string]: unknown },
  row: number,
  col: number,
) {
  return grid[row + "," + col];
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.DetermineColors = function (id: string) {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var sptc = spt.ColorChooser;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;
  var grid = spcdata.grid;

  var col, row;
  var rgb = sp.splitRGB(spcdata.value);

  col = 2;
  row = 16 - Math.floor((rgb.r + 16) / 16);
  grid["selectedrow" + col] = row;
  for (row = 0; row < 16; row++) {
    sptc.gridToG(grid, row, col).rgb = sp.makeRGB(17 * (15 - row), 0, 0);
  }

  col = 3;
  row = 16 - Math.floor((rgb.g + 16) / 16);
  grid["selectedrow" + col] = row;
  for (row = 0; row < 16; row++) {
    sptc.gridToG(grid, row, col).rgb = sp.makeRGB(0, 17 * (15 - row), 0);
  }

  col = 4;
  row = 16 - Math.floor((rgb.b + 16) / 16);
  grid["selectedrow" + col] = row;
  for (row = 0; row < 16; row++) {
    sptc.gridToG(grid, row, col).rgb = sp.makeRGB(0, 0, 17 * (15 - row));
  }

  col = 1;
  for (row = 0; row < 16; row++) {
    sptc.gridToG(grid, row, col).rgb = sp.makeRGB(
      17 * (15 - row),
      17 * (15 - row),
      17 * (15 - row),
    );
  }

  col = 0;
  var steps = [0, 68, 153, 204, 255];
  var commonrgb = [
    "400",
    "310",
    "420",
    "440",
    "442",
    "340",
    "040",
    "042",
    "032",
    "044",
    "024",
    "004",
    "204",
    "314",
    "402",
    "414",
  ];
  var x;
  for (row = 0; row < 16; row++) {
    x = commonrgb[row];
    sptc.gridToG(grid, row, col).rgb =
      "rgb(" +
      steps[Number(x.charAt(0))] +
      "," +
      steps[Number(x.charAt(1))] +
      "," +
      steps[Number(x.charAt(2))] +
      ")";
  }
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.SetColors = function (id: string) {
  var row, col, g, rgb;

  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var sptc = spt.ColorChooser;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;
  var grid = spcdata.grid;

  for (row = 0; row < 16; row++) {
    for (col = 0; col < 5; col++) {
      g = sptc.gridToG(grid, row, col);
      g.ele.style.backgroundColor = g.rgb;
      g.ele.title = sp.RGBToHex(g.rgb);
      if (grid["selectedrow" + col] == row) {
        g.ele.style.backgroundImage = "url(" + sp.imagePrefix + "chooserarrow.gif)";
      } else {
        g.ele.style.backgroundImage = "";
      }
    }
  }

  sp.SetValue(id, spcdata.value);

  grid.msg.style.backgroundColor = spcdata.value;
  rgb = sp.splitRGB(spcdata.value || "rgb(255,255,255)");
  if (rgb.r + rgb.g + rgb.b < 220) {
    grid.msg.style.color = "#FFF";
  } else {
    grid.msg.style.color = "#000";
  }
  if (!spcdata.value) {
    // default
    grid.msg.style.backgroundColor = "#FFF";
    grid.msg.style.backgroundImage = "url(" + sp.imagePrefix + "defaultcolor.gif)";
    grid.msg.title = "Default";
  } else {
    grid.msg.style.backgroundImage = "";
    grid.msg.title = sp.RGBToHex(spcdata.value);
  }
};

/**
 * @param {any} e
 */
SocialCalc.Popup.Types.ColorChooser.GridMouseDown = function (e: MouseEvent) {
  var event = e || window.event;

  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var sptc = spt.ColorChooser;
  var spc = sp.Controls;

  var id = sp.Current.id;
  if (!id) return;

  var spcdata = spc[id]!.data;
  var grid = spcdata.grid;

  switch (event.type) {
    case "mousedown":
      grid.mousedown = true;
      break;
    case "mouseup":
      grid.mousedown = false;
      break;
    case "mousemove":
      if (!grid.mousedown) {
        return;
      }
      break;
  }

  var pos = SocialCalc.GetElementPositionWithScroll(spcdata.mainele as HTMLElement);
  var clientX = event.clientX - pos.left;
  var clientY = event.clientY - pos.top;
  var gpos = SocialCalc.GetElementPositionWithScroll(grid.table);
  gpos.left -= pos.left;
  gpos.top -= pos.top;
  var row = Math.floor((clientY - gpos.top - 2) / 10); // -2 is to split the diff btw IE & FF
  row = row < 0 ? 0 : row;
  var col = Math.floor((clientX - gpos.left) / 20);
  row = row < 0 ? 0 : row > 15 ? 15 : row;
  col = col < 0 ? 0 : col > 4 ? 4 : col;
  var color = sptc.gridToG(grid, row, col).ele.style.backgroundColor;
  var newrgb = sp.splitRGB(color);
  var oldrgb = sp.splitRGB(spcdata.value);

  switch (col) {
    case 2:
      spcdata.value = sp.makeRGB(newrgb.r, oldrgb.g, oldrgb.b);
      break;
    case 3:
      spcdata.value = sp.makeRGB(oldrgb.r, newrgb.g, oldrgb.b);
      break;
    case 4:
      spcdata.value = sp.makeRGB(oldrgb.r, oldrgb.g, newrgb.b);
      break;
    case 0:
    case 1:
      spcdata.value = color;
  }

  sptc.DetermineColors(id);
  sptc.SetColors(id);
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.ControlClicked = function (id: string) {
  var sp = SocialCalc.Popup;
  var spt = sp.Types;
  var sptc = spt.ColorChooser;

  var cid = sp.Current.id;
  if (!cid || id != cid) {
    sp.CClick(id);
    return;
  }

  sptc.CloseOK();
};

/**
 * @param {any} [e]
 */
SocialCalc.Popup.Types.ColorChooser.DefaultClicked = function (_e: MouseEvent) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;

  var id = sp.Current.id;
  if (!id) return;

  var spcdata = spc[id]!.data;

  spcdata.value = "";
  SocialCalc.Popup.SetValue(id, spcdata.value);

  SocialCalc.Popup.Close();
};

/**
 * @param {any} [e]
 */
SocialCalc.Popup.Types.ColorChooser.CustomClicked = function (_e: MouseEvent) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;

  var id = sp.Current.id;
  if (!id) return;

  var spcdata = spc[id]!.data;

  var oele, str, nele;

  oele = spcdata.contentele;
  str = SocialCalc.Popup.Types.ColorChooser.MakeCustom("ColorChooser", id);
  nele = document.createElement("div");
  nele.innerHTML =
    '<div style="cursor:default;padding:4px;background-color:#CCC;">' + str + "</div>";
  // innerHTML above guarantees the nested firstChild DOM is present.
  var ccOuter2: HTMLElement = nele.firstChild as HTMLElement;
  var ccInner2: HTMLElement = ccOuter2.firstChild as HTMLElement;
  spcdata.customele = ccInner2.childNodes[2];
  spcdata.contentele = nele;
  spcdata.popupele.replaceChild(nele, oele);

  spcdata.customele.value = sp.RGBToHex(spcdata.value);

  if (spcdata.attribs.ensureWithin) {
    SocialCalc.Popup.EnsurePosition(id, spcdata.attribs.ensureWithin as HTMLElement);
  }
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.CustomToGrid = function (id: string) {
  var oele, nele;
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  SocialCalc.Popup.SetValue(id, sp.HexToRGB("#" + spcdata.customele.value));

  var oele, mainele, nele;

  oele = spcdata.contentele;
  mainele = SocialCalc.Popup.Types.ColorChooser.CreateGrid("ColorChooser", id);
  nele = document.createElement("div");
  nele.style.padding = "3px";
  nele.style.backgroundColor = "#CCC";
  nele.appendChild(mainele);
  spcdata.customele = null;
  spcdata.contentele = nele;
  spcdata.popupele.replaceChild(nele, oele);

  if (spcdata.attribs.ensureWithin) {
    SocialCalc.Popup.EnsurePosition(id, spcdata.attribs.ensureWithin as HTMLElement);
  }
};

/**
 * @param {string} id
 */
SocialCalc.Popup.Types.ColorChooser.CustomOK = function (id: string) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;
  var spcdata = spc[id]!.data;

  SocialCalc.Popup.SetValue(id, sp.HexToRGB("#" + spcdata.customele.value));

  SocialCalc.Popup.Close();
};

/**
 * @param {any} [e]
 */
SocialCalc.Popup.Types.ColorChooser.CloseOK = function (_e: MouseEvent) {
  var sp = SocialCalc.Popup;
  var spc = sp.Controls;

  var id = sp.Current.id;
  if (!id) return;

  var spcdata = spc[id]!.data;

  SocialCalc.Popup.SetValue(id, spcdata.value);

  SocialCalc.Popup.Close();
};
