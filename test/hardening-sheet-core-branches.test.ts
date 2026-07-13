// Branch/behavior hardening for the sheet-core surfaces in
// js/socialcalc-3.ts and js/socialcalcconstants.ts.
//
// Each test below pins a specific behavioral contract that was previously
// exercised only partially or not at all by the sibling sheet-coverage-*
// test files. The intent is locked-down *behavior* (round-trip, command
// emission, render-class assembly, recalc state transitions, malformed-save
// recovery) — not statement-counting. Coverage attribution for directly
// called functions is known broken on this harness; this file is sized to
// the genuine gaps that remain regardless of the tooling fix.

import { expect, test } from "vite-plus/test";

import {
  installBrowserShim,
  loadSocialCalc,
  recalcSheet,
  scheduleCommands,
  sheetUndo,
} from "./helpers/socialcalc";

// ===========================================================================
// Section 1: ConstantsSetClasses falsy-prefix and object-default entries
// (js/socialcalcconstants.ts L997, L1005 partial branches).
//
// The existing sibling test passes a truthy prefix ("my-"); the falsy side
// of `prefix = prefix || ""` and the object-typed default branch in
// ConstantsDefaultClasses are walked but never asserted.
// ===========================================================================

test("ConstantsSetClasses with no prefix applies the bare default class names (prefix || '' falsy branch)", async () => {
  const SC = await loadSocialCalc();
  // Snapshot the classes that come from a string-typed default so we can
  // prove a no-arg call leaves them set to the bare item name (no prefix).
  SC.ConstantsSetClasses("zz-"); // establish a non-baseline state first
  expect(SC.Constants.defaultCommentClass).toBe("zz-defaultComment");

  SC.ConstantsSetClasses(); // undefined prefix -> "" via the || "" branch
  // String-typed default: classname becomes prefix + (defaults[item] || item).
  // defaults.defaultComment is "" so the fallback to the item name fires.
  expect(SC.Constants.defaultCommentClass).toBe("defaultComment");
  // The matching *Style slot is cleared for string-typed defaults.
  expect(SC.Constants.defaultCommentStyle).toBe("");

  // Object-typed default (defaultInputEcho) populates BOTH Class and Style,
  // using the supplied `classname` field (here "" — falsy, so falls back to
  // the item name "defaultInputEcho") and `style` field.
  expect(SC.Constants.defaultInputEchoClass).toBe("defaultInputEcho");
  expect(SC.Constants.defaultInputEchoStyle).toBe(
    "filter:alpha(opacity=90);opacity:.9;",
  );
});

test("ConstantsSetClasses with explicit '' prefix uses item-name fallback identically to undefined", async () => {
  const SC = await loadSocialCalc();
  SC.ConstantsSetClasses("qq-");
  expect(SC.Constants.defaultCommentClass).toBe("qq-defaultComment");

  SC.ConstantsSetClasses(""); // empty string is also falsy -> same fallback
  expect(SC.Constants.defaultCommentClass).toBe("defaultComment");
});

// ===========================================================================
// Section 2: ConstantsSetImagePrefix non-underscore new-prefix branch
// (js/socialcalcconstants.ts L1022/L1023/L1028/L1031 partial branches).
//
// The existing sibling test rewrites "images/sc_" -> "/img/xx_" (both end
// in "_"), so the *hyphen-rewrite* path on the new prefix is mirrored, but
// the non-underscore new-prefix branch (`imagePrefix.endsWith("_")` false)
// is never taken. We also exercise the empty-old-prefix guard.
// ===========================================================================

test("ConstantsSetImagePrefix accepts a new prefix that does NOT end in underscore (hyphen-form derives from the literal tail)", async () => {
  const SC = await loadSocialCalc();
  const originalPrefix = SC.Constants.defaultImagePrefix;
  const originalUnhide = SC.Constants.defaultUnhideLeftStyle;
  try {
    // Default prefix is "images/sc_"; rewrite to a path with no trailing "_"
    // so the else branch of `imagePrefix.endsWith("_")` is taken and the
    // newHyphen becomes the prefix unchanged (no hyphen appended).
    SC.ConstantsSetImagePrefix("/assets/sc");
    expect(SC.Constants.defaultImagePrefix).toBe("/assets/sc");
    // oldHyphen="images/sc-" is replaced with newHyphen="/assets/sc" (plain,
    // no trailing hyphen since the prefix has no underscore). So the
    // "images/sc-unhideleft.gif" URL becomes "/assets/scunhideleft.gif".
    expect(SC.Constants.defaultUnhideLeftStyle).toContain(
      "/assets/scunhideleft.gif",
    );
    expect(SC.Constants.defaultUnhideLeftStyle).not.toContain("images/sc-");
    expect(SC.Constants.defaultUnhideLeftStyle).not.toContain("images/sc_");
  } finally {
    // Restore for subsequent tests; the loaded module is shared per worker.
    SC.ConstantsSetImagePrefix(originalPrefix);
    if (originalUnhide) SC.Constants.defaultUnhideLeftStyle = originalUnhide;
  }
});

test("ConstantsSetImagePrefix with empty old prefix only updates defaultImagePrefix (skips rewrite loops)", async () => {
  const SC = await loadSocialCalc();
  const originalPrefix = SC.Constants.defaultImagePrefix;
  const originalUnhide = SC.Constants.defaultUnhideLeftStyle;
  try {
    // Force the "if (oldPrefix)" branch false: temporarily clear the
    // current prefix, then call SetImagePrefix. No string field should be
    // rewritten (the split/join is skipped), only defaultImagePrefix moves.
    SC.Constants.defaultImagePrefix = "";
    SC.ConstantsSetImagePrefix("/fresh/sc_");
    expect(SC.Constants.defaultImagePrefix).toBe("/fresh/sc_");
    // Nothing else was rewritten because oldPrefix was empty. Spot-check
    // that the unhide style (unrelated to the empty old prefix) is unchanged.
    expect(SC.Constants.defaultUnhideLeftStyle).toBe(
      originalUnhide ?? SC.Constants.defaultUnhideLeftStyle,
    );
  } finally {
    SC.Constants.defaultImagePrefix = originalPrefix;
    if (originalUnhide) SC.Constants.defaultUnhideLeftStyle = originalUnhide;
    // Re-run the normal rewrite path so the shared module is fully reset.
    SC.ConstantsSetImagePrefix(originalPrefix);
    if (originalUnhide) SC.Constants.defaultUnhideLeftStyle = originalUnhide;
  }
});

// ===========================================================================
// Section 3: RenderCell comment/readonly/cssc rendering branches that were
// previously fully-uncovered Direction-1 hits
// (js/socialcalc-3.ts L5558, L5585, L5598).
//
// showGrid defaults to false in a fresh RenderContext; the sibling render
// tests render comment/readonly cells but never assert that the className
// is *appended* via the grid/no-grid conditionalClassName branches. The
// noElement + cssc path (pseudo-element className assembly) is also
// untouched by the existing CreatePseudoElement test which bypasses
// RenderCell entirely.
// ===========================================================================

test("RenderCell appends commentClassName when cell has a comment and context.showGrid is true", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 comment the-comment",
  ]);

  const context = new SC.RenderContext(sheet);
  // Force the grid-render path: showGrid true + a distinct commentClassName.
  context.showGrid = true;
  context.commentClassName = "has-comment";
  context.commentCSS = "border-left:2px solid blue;";
  // CalculateCellSkipData must be called before RenderCell so
  // context.cellskip is a non-null object (init is null at construction).
  context.CalculateCellSkipData();

  const cell = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);
  expect(cell).not.toBeNull();
  // The comment-derived className is appended to whatever default className
  // the renderer already set (which may be ""). Either way, "has-comment"
  // must be present.
  expect(cell.className).toContain("has-comment");
  // Comment CSS picked up into the assembled cssText.
  expect(cell.style.cssText).toContain("border-left:2px solid blue");
});

test("RenderCell appends readonlyNoGridClassName when cell is readonly and context.showGrid is false", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 readonly yes",
  ]);

  const context = new SC.RenderContext(sheet);
  // showGrid stays false (the default) — exercise the no-grid readonly branch.
  context.readonlyNoGridClassName = "locked-no-grid";
  context.readonlyNoGridCSS = "opacity:0.7;";
  context.CalculateCellSkipData();

  const cell = context.RenderCell(1, 1, 0, 0, false, context.defaultHTMLlinkstyle);
  expect(cell).not.toBeNull();
  expect(cell.className).toContain("locked-no-grid");
  expect(cell.style.cssText).toContain("opacity:0.7");
  // The title attribute is the default readonly comment, proving the
  // no-comment + readonly branch fires (cell has no comment so result.title
  // was set from context.readonlyComment, not from cell.comment).
  expect(cell.title).toBe(context.readonlyComment);
});

test("RenderCell with noElement=true assembles className from cell.cssc via the pseudo-element path", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 cssc my-css-class",
  ]);

  const context = new SC.RenderContext(sheet);
  context.CalculateCellSkipData();

  // noElement=true returns a pseudo-element object (CreatePseudoElement
  // shape) rather than a real <td>. cssc should still be appended to
  // result.className via the noElement branch of the cssc check.
  const pseudo = context.RenderCell(1, 1, 0, 0, true, context.defaultHTMLlinkstyle);
  expect(pseudo).not.toBeNull();
  expect(typeof pseudo).toBe("object");
  expect(pseudo.className).toContain("my-css-class");
});

// ===========================================================================
// Section 4: ConvertSaveToOtherFormat pass-through & empty-input contracts
// (js/socialcalc-3.ts L6806/L6810 partial branches).
//
// The handler has two early-return branches before any parsing/recalc:
// outputformat == "scsave" returns savestr untouched, and savestr == ""
// returns "" untouched. Neither is asserted in isolation by the sibling
// tests; locking them down guards against future refactors that would
// re-parse or throw on these inputs.
// ===========================================================================

test("ConvertSaveToOtherFormat('scsave') returns savestr byte-for-byte without parsing", async () => {
  const SC = await loadSocialCalc();
  const savestr = "version:1.5\ncell:A1:t:hi\nsheet:c:1:r:1\n";
  // The "scsave" path is a pure identity return — even malformed input must
  // pass through untouched (no Sheet construction, no ParseSheetSave).
  const out = SC.ConvertSaveToOtherFormat(savestr, "scsave");
  expect(out).toBe(savestr);
  // Empty-input contract: "" returns "" regardless of outputformat (other
  // than scsave, which already returned "").
  expect(SC.ConvertSaveToOtherFormat("", "csv")).toBe("");
  expect(SC.ConvertSaveToOtherFormat("", "html")).toBe("");
  expect(SC.ConvertSaveToOtherFormat("", "tab")).toBe("");
});

// ===========================================================================
// Section 5: RecalcSheet queueing when not idle
// (js/socialcalc-3.ts L3911 false branch).
//
// The sibling tests reset RecalcInfo.currentState back to idle before each
// recalc; the "queue and return" branch when a recalc is already in flight
// is therefore never exercised. We force currentState out of idle and
// assert that calling RecalcSheet pushes the sheet onto the queue and
// returns synchronously without starting a new timer slice.
// ===========================================================================

test("RecalcSheet queues the sheet and returns when currentState is not idle", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);

  // Start a normal recalc to settle the async loop first, so the timer and
  // queue state are clean.
  await recalcSheet(SC, sheet);

  // Now simulate "a recalc is in flight" by forcing a non-idle state and
  // clearing the queue so we can observe the push unambiguously.
  SC.RecalcInfo.currentState = SC.RecalcInfo.state.order; // non-idle
  SC.RecalcInfo.queue = [];
  SC.RecalcSheet(sheet);
  // RecalcSheet saw non-idle, pushed sheet, and returned without cycling
  // currentState back to start_calc.
  expect(SC.RecalcInfo.queue).toContain(sheet);
  expect(SC.RecalcInfo.currentState).toBe(SC.RecalcInfo.state.order);
  // Cleanup: return to idle so subsequent tests in the worker start clean.
  SC.RecalcInfo.currentState = SC.RecalcInfo.state.idle;
  SC.RecalcInfo.queue = [];
  SC.RecalcClearTimeout();
});

// ===========================================================================
// Section 6: RecalcLoadedSheet no-op when both sheetname and
// waitingForLoading are absent
// (js/socialcalc-3.ts L3977 false branch).
//
// The guard added to fix a prior null-coercion regression skips loading
// entirely when effectiveSheetName is falsy. The sibling tests always
// supply a name; we exercise the skip path and prove AddSheetToCache is
// not called (no bogus ""-named sheet enters the cache).
// ===========================================================================

test("RecalcLoadedSheet with no sheetname and no waitingForLoading skips AddSheetToCache and just schedules the timer", async () => {
  installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const scf = SC.Formula;

  // Make sure waitingForLoading is null before the call.
  scf.SheetCache.waitingForLoading = null;
  const cacheSnapshot = { ...scf.SheetCache.sheets };

  // Call with sheetname=null and recalcneeded=true; the early-skip branch
  // must fire because effectiveSheetName is still null.
  SC.RecalcLoadedSheet(null, "version:1.5\ncell:A1:t:hi\nsheet:c:1:r:1\n", true, false);
  // No new ""-named (or any) sheet added to the cache.
  expect(scf.SheetCache.sheets[""]).toBeUndefined();
  expect(Object.keys(scf.SheetCache.sheets).length).toBe(
    Object.keys(cacheSnapshot).length,
  );
  // waitingForLoading was cleared (not set) by the routine.
  expect(scf.SheetCache.waitingForLoading).toBeNull();
  SC.RecalcClearTimeout();
});

// ===========================================================================
// Section 7: setStyles no-colon part and null name/value parts
// (js/socialcalc-3.ts L5813 / L5816 partial branches).
//
// setStyles splits "a:b;c:d;garbage;novalue:;:noconfigure" style strings
// and applies each name:value to element.style. Parts without a colon
// (pos === -1) are silently skipped; parts where name or value is empty
// are silently skipped. The sibling test only feeds well-formed strings,
// so the no-colon and empty-name/empty-value branches never fire.
// ===========================================================================

test("setStyles skips parts with no colon and parts with empty name or value", async () => {
  const { document } = installBrowserShim();
  const SC = await loadSocialCalc({ browser: true });
  const el = document.createElement("div");

  // Mixed input: one good rule, one no-colon chunk, one empty-name, one
  // empty-value, one good trailing rule. Use camelCase property names
  // (the raw name goes straight into element.style[name]).
  SC.setStyles(el, "color:red;garbage;fontWeight:;:hidden;fontWeight:bold");
  // Only the well-formed rules with non-empty name AND value were applied.
  expect(el.style.color).toBe("red");
  expect(el.style.fontWeight).toBe("bold");
  // Empty-name and empty-value parts must not stomp existing values: set
  // textAlign to something, then run a setStyles that includes an empty
  // textAlign segment and confirm it's preserved (the empty segment was
  // skipped rather than set to undefined).
  el.style.textAlign = "center";
  SC.setStyles(el, "textAlign:;fontStyle:italic");
  expect(el.style.textAlign).toBe("center"); // not cleared
  expect(el.style.fontStyle).toBe("italic");
  // Calling with null/undefined cssText is an early return: no throw, no
  // change to existing styles.
  SC.setStyles(el, null);
  SC.setStyles(el, undefined);
  expect(el.style.color).toBe("red");
  expect(el.style.fontStyle).toBe("italic");
});

// ===========================================================================
// Section 8: CellToString non-xlt path emits raw border indices
// (js/socialcalc-3.ts L1050/1067-1075 false-side of "if (sheet.xlt)").
//
// The sibling render tests always invoke CellToString through
// CreateSheetSave, where CanonicalizeSheet has populated sheetobj.xlt
// (taking the xlt path). The non-xlt branch (cell with borders but no
// canonicalize step) is genuine behavior for callers that use CellToString
// directly with a sheet that has never been canonicalized. Lock it down.
// ===========================================================================

test("CellToString without sheet.xlt emits raw border indices and font/layout/color numerics", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 bt 1px solid black",
    "set A1 br 1px solid black",
    "set A1 bb 1px solid black",
    "set A1 bl 1px solid black",
    "set A1 font italic bold 12pt Arial",
    "set A1 layout padding:2px 2px 2px 2px;vertical-align:top;",
    "set A1 color rgb(0,0,0)",
    "set A1 bgcolor rgb(255,255,255)",
    "set A1 cellformat left",
  ]);

  // Make sure no xlt is set on the sheet (the non-canonicalized path).
  expect(sheet.xlt).toBeUndefined();
  const cell = sheet.GetAssuredCell("A1");
  const line = SC.CellToString(sheet, cell);
  // Non-xlt path emits the raw field indexes. Verify the structural shape:
  // borders (:b:), font (:f:), layout (:l:), color (:c:), bgcolor (:bg:),
  // cellformat (:cf:) sections are all present.
  expect(line).toMatch(/:b:/);
  expect(line).toMatch(/:f:/);
  expect(line).toMatch(/:l:/);
  expect(line).toMatch(/:c:/);
  expect(line).toMatch(/:bg:/);
  expect(line).toMatch(/:cf:/);
  // Sanity: readonly is absent here.
  expect(line).not.toContain(":ro:");
  // Calling CellToString with null returns the empty string contract.
  expect(SC.CellToString(sheet, null)).toBe("");
});

// ===========================================================================
// Section 9: EncodeCellAttributes SetAttribStar "*" handling
// (js/socialcalc-3.ts L1314 / L1324 / L1331 / L1345 partial branches).
//
// SetAttribStar is called on the parsed layout/font parts; passing "*"
// for one of the padX/fontX subfields must NOT mark the attribute as
// non-default (it stays def:true). The sibling test only feeds explicit
// values; we force a "*" placeholder and assert that the corresponding
// attribute remains def:true with its initial "" value.
// ===========================================================================

test("EncodeCellAttributes leaves alignvert/padX as def:true when the layout uses '*' placeholders", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  // A layout with "*" placeholders for every padding slot and vertical-align.
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 layout padding:* * * *;vertical-align:*;",
  ]);

  const attrs = SC.EncodeCellAttributes(sheet, "A1");
  // Every padX/alignvert attribute was initialized to { def:true, val:"" }
  // and SetAttribStar("*") returned early without flipping def to false.
  for (const name of ["padtop", "padright", "padbottom", "padleft", "alignvert"]) {
    expect(attrs[name]).toBeDefined();
    expect(attrs[name].def).toBe(true);
    expect(attrs[name].val).toBe("");
  }
  // The font attributes follow the same rule: a font string like
  // "* * *" leaves the family/look/size as def:true.
  await scheduleCommands(SC, sheet, ["set A2 value n 2", "set A2 font * * *"]);
  const attrs2 = SC.EncodeCellAttributes(sheet, "A2");
  for (const name of ["fontfamily", "fontlook", "fontsize"]) {
    expect(attrs2[name].def).toBe(true);
    expect(attrs2[name].val).toBe("");
  }
});

// ===========================================================================
// Section 10: DecodeCellAttributes mod.def branch and "no-change" font
// (js/socialcalc-3.ts L1658 / L1624 partial branches).
//
// The existing sibling test asserts multi-attribute change commands but
// does not cover (a) the newattribs.mod.def=true path that emits
// `set <coord> mod` to CLEAR the cell's mod to "n", and (b) the path
// where the font string round-trips but is unchanged (no DoCmd emitted
// for that one attribute even when other attributes DO change).
// ===========================================================================

test("DecodeCellAttributes emits 'mod' clear when newattribs.mod.def is true and cell had mod='y'", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 mod y",
  ]);
  expect(sheet.GetAssuredCell("A1").mod).toBe("y");

  // Build newattribs by copying the current attributes then flagging mod
  // as def:true (i.e., "reset to default"). Round-trip through a fresh
  // EncodeCellAttributes would not exercise this because Encode always
  // sets a concrete mod value.
  const newattribs = SC.EncodeCellAttributes(sheet, "A1");
  // Force the mod attribute back to "default" so DecodeCellAttributes
  // computes value="n" and emits `set A1 mod` (clearing back to "").
  newattribs.mod = { def: true, val: "" };

  const cmds = SC.DecodeCellAttributes(sheet, "A1", newattribs);
  expect(typeof cmds).toBe("string");
  expect(cmds).toContain("mod");
  // The emitted command must NOT include a literal "y" (the cleared mod
  // collapses "n" to "" per the source's restrict-to-"y"-and-"" rule).
  expect(cmds).not.toMatch(/mod\s+y/);
});

test("DecodeCellAttributes with unchanged font emits no font command even when other attribs change", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 value n 1",
    "set A1 font italic bold 12pt Arial",
    "set A1 bgcolor rgb(255,0,0)",
  ]);

  const newattribs = SC.EncodeCellAttributes(sheet, "A1");
  // Change ONLY the textcolor; font and bgcolor remain identical to the
  // current cell state — those DoCmd calls must NOT fire.
  newattribs.textcolor = { def: false, val: "rgb(0,0,255)" };

  const cmds = SC.DecodeCellAttributes(sheet, "A1", newattribs);
  expect(typeof cmds).toBe("string");
  expect(cmds).toContain("color");
  expect(cmds).not.toContain("font");
  expect(cmds).not.toContain("bgcolor");
});

// ===========================================================================
// Section 11: SheetUndo multi-step concatenation
// (js/socialcalc-3.ts L3755 false branch).
//
// The sibling Section 6 test covers redo-on-empty; Section 55 covers
// multiple undos/redos but through the high-level helpers that obscure
// whether the cmdstr-concatenation loop fires. We issue three separate
// command batches (each producing its own undo frame), then undo one
// frame and assert the cell reverted exactly one step and the changes
// stack pointer moved down by exactly one.
// ===========================================================================

test("SheetUndo concatenates multi-step undo entries into a single command batch", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  // Three separate command batches: each creates its own undo frame.
  await scheduleCommands(SC, sheet, ["set A1 value n 1"]);
  await scheduleCommands(SC, sheet, ["set A1 value n 2"]);
  await scheduleCommands(SC, sheet, ["set A1 value n 3"]);
  expect(sheet.GetAssuredCell("A1").datavalue).toBe(3);

  const tosBefore = sheet.changes.tos;
  // SheetUndo walks tos.undo backwards, concatenates the entries into a
  // single cmdstr, and calls ScheduleSheetCommands. awaiting cmdend via
  // the sheetUndo helper proves the concatenation completed.
  await sheetUndo(SC, sheet);
  // After one undo, tos decreased by 1 (Undo pops one frame off the stack).
  expect(sheet.changes.tos).toBe(tosBefore - 1);
  // The cell value reverted from 3 to 2 (the last set was undone).
  expect(sheet.GetAssuredCell("A1").datavalue).toBe(2);
});

// ===========================================================================
// Section 12: ParseSheetSave unknown line-type throws via alert+throw path
// (js/socialcalc-3.ts L719-721 default branch — regression-guarding the
// MALFORMED SAVE recovery contract).
//
// The sibling Section 62 in sheet-coverage-b already covers this refusal,
// but only on a sheet created via `new SC.Sheet()`. We pin the same
// contract here against a malformed save that mixes valid and invalid
// line types in the middle of the input — the parser must fail fast on
// the FIRST unknown line-type and not silently swallow any of the
// preceding valid content (a regression here would mean the loader
// accepts truncated/malformed saves and clobbers part of the sheet).
// ===========================================================================

test("ParseSheetSave fails fast on the first unknown line-type mid-stream and does not silently swallow prior valid content", async () => {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  const good = "version:1.5\ncell:A1:t:hello\nsheet:c:1:r:1\n";
  const malformed = good + "boguslinetype:foo:bar\n";
  // The throw propagates up through ParseSheetSave.
  expect(() => SC.ParseSheetSave(malformed, sheet)).toThrow();
  // The well-formed leading lines were parsed first, so A1 did get loaded
  // before the throw fired — lock that behavior in too (parse order is
  // top-to-bottom, no lookahead).
  expect(sheet.GetAssuredCell("A1").datavalue).toBe("hello");
});

// ===========================================================================
// Section 13: encodeForSave / decodeFromSave non-string identity
// (js/socialcalc-3.ts L5661 / L5662 / L5680 / L5681 partial branches).
//
// The sibling Section 2 test asserts that encodeForSave(42) returns 42
// via typeof != "string". The ""-input branch of decodeFromSave is also
// covered. We lock the *non-string identity for objects* and the
// "non-string does NOT trigger the backslash indexOf optimization" path
// as a contract — encodeForSave must never toString-coerce a non-string
// (callers pass numeric datavalues legitimately).
// ===========================================================================

test("encodeForSave / decodeFromSave non-string inputs round-trip as identity, no coercion", async () => {
  const SC = await loadSocialCalc();
  // Numbers pass through untouched (datatype "v" stores datavalue as Number).
  expect(SC.encodeForSave(42)).toBe(42);
  expect(SC.encodeForSave(0)).toBe(0);
  expect(SC.encodeForSave(-0)).toBe(-0);
  expect(SC.encodeForSave(Number.NaN)).toBeNaN();
  expect(SC.decodeFromSave(42)).toBe(42);

  // Booleans pass through — and crucially do NOT become "true"/"false"
  // (which would then trip the backslash indexOf path if coerced).
  expect(SC.encodeForSave(true)).toBe(true);
  expect(SC.decodeFromSave(false)).toBe(false);

  // Objects pass through by reference identity, no string coercion.
  const obj = { a: 1 };
  expect(SC.encodeForSave(obj)).toBe(obj);
  expect(SC.decodeFromSave(obj)).toBe(obj);

  // null passes through both directions.
  expect(SC.encodeForSave(null)).toBeNull();
  expect(SC.decodeFromSave(null)).toBeNull();
});

// ===========================================================================
// Section 14: DetermineValueType branches for URL, HTML, fraction, and the
// "text length zero / only blanks" early outs — format-detection contract.
// (js/socialcalc-3.ts DetermineValueType — exercised via SetConvertedCell
// through ConvertOtherFormatToSave which is how a host sees imported
// content.)
// ===========================================================================

test("DetermineValueType classifies http(s) URLs, HTML fragments, dates, and fractions into their valuetype buckets", async () => {
  const SC = await loadSocialCalc();
  // URL types: "tl" link type
  expect(SC.DetermineValueType("https://example.test/path").type).toBe("tl");
  expect(SC.DetermineValueType("http://example.test/x").type).toBe("tl");
  // HTML fragment: "th"
  expect(SC.DetermineValueType("<B>bold text</B>").type).toBe("th");
  // Date variants: "nd"
  expect(SC.DetermineValueType("1/2/2020").type).toBe("nd");
  expect(SC.DetermineValueType("2020-12-31").type).toBe("nd");
  // Date+time: "ndt" only when clock parts are in range
  const dt = SC.DetermineValueType("2020-12-31 12:30");
  expect(dt.type).toBe("ndt");
  // Out-of-range clock falls back to "nd" (date only)
  expect(SC.DetermineValueType("2020-12-31 25:99").type).toBe("nd");
  // Fraction "1 1/2" -> n
  expect(SC.DetermineValueType("1 1/2").type).toBe("n");
  // Empty / blanks: type "" or "t"
  expect(SC.DetermineValueType("").type).toBe("");
  // Spaces only -> stays "t"
  expect(SC.DetermineValueType("   ").type).toBe("t");
  // Constant lookup: TRUE -> 1 with nl type
  expect(SC.DetermineValueType("TRUE")).toEqual({ value: 1, type: "nl" });
  expect(SC.DetermineValueType("false")).toEqual({ value: 0, type: "nl" });
  // Error constant
  expect(SC.DetermineValueType("#N/A").type).toBe("e#N/A");
  // Plain "-" is general-number-shaped but NaN — left as text
  expect(SC.DetermineValueType("-").type).toBe("t");
});

// ===========================================================================
// Section 15: RecalcCheckCell behavioral coverage — Gap C
// (js/socialcalc-3.ts L4222-4359 BlockStatement survivors 4054/4069/4074/
//  4075/4081/4082/4103/4114/4119/4125/4130/4135/4177/4199/4206).
//
// RecalcCheckCell is the dependency-graph construction step called from
// the recalc scheduler.  The BlockStatement mutants below replace whole
// block bodies with `{}` — a no-op.  Observable contracts that each surviving
// block is actually doing real work:
//
// C-4054: prior error clearing — a formula cell that had cell.errors from a
//         previous recalc must have that error deleted before the new recalc
//         result overwrites the cell.
// C-4069/4074/4075/4081/4082: reversed-range normalisation — a range
//         specified in reverse order (B2:A1) must be traversed in the right
//         order (each cell registered exactly once, dependency detected).
// C-4103/4199: circular reference detection (range path and scalar path) —
//         both must tag the cell with the circular-ref error string.
// C-4114/4119/4125: sheet-qualified token skip — a cross-sheet "Sheet1!A1"
//         token must not be registered as a local dependency.
// C-4130/4135: named-range dependency — SUM(myRange) must register the
//         cells covered by the named range in the dependency graph, so
//         changing one triggers a dependent recalc.
// C-4177: range coord registration — SUM(A1:B2) must register A1, A2, B1, B2
//         as dependencies; changing any one triggers a downstream recalc.
// C-4206: calclist append (else branch) — a second dependency-registered
//         cell must be appended to the calclist (lastcalc pointer update),
//         producing a non-empty calclist with two elements.
// ===========================================================================

test("RecalcCheckCell C-4054: prior cell.errors is deleted before re-evaluation", async () => {
  // A1 = formula that produces a value. After recalcSheet runs,
  // manually set A1.errors to simulate a stale error, then recalc again.
  // The error must be gone after the second recalc.
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, ["set A1 value n 5", "set B1 formula A1+1"], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  expect(sheet.cells.B1.datavalue).toBe(6);

  // Manually plant a stale error to simulate a prior recalc error state.
  sheet.cells.B1.errors = "stale error from previous recalc";
  expect(sheet.cells.B1.errors).toBeDefined();

  // A fresh recalc must clear it (C-4054: delete cell.errors block fires).
  await recalcSheet(SC, sheet, 3000);
  expect(sheet.cells.B1.errors).toBeUndefined();
  expect(sheet.cells.B1.datavalue).toBe(6);
});

test("RecalcCheckCell C-4069/4074/4075/4081/4082: reversed range walks formula deps so intermediate formulas calculate first", async () => {
  // Dependency-order contract: C1 = SUM(B2:A1) (reversed 2×2) must force every
  // formula cell inside that range to be calculated BEFORE C1.  We plant an
  // intermediate formula B1 = A1*10 and create C1 FIRST so that without the
  // range-walk (if inrangestart/normalisation is a no-op) C1 would be added to
  // calclist before B1 and would see B1's pre-calc empty value.
  //
  // Creation order deliberately puts C1 in celllist ahead of B1:
  //   1. set C1 formula ...   → C1 created first
  //   2. set A1/A2/B2 values
  //   3. set B1 formula ...   → B1 created last
  // RecalcCheckCell must still walk B1 via the reversed range and schedule
  // B1 before C1.  Expected: B1=10*10=100; C1=10+20+100+40=170.
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    // C1 first — appears first in celllist
    "set C1 formula SUM(B2:A1)",
    "set A1 value n 10",
    "set A2 value n 20",
    "set B2 value n 40",
    // B1 last — intermediate formula inside the reversed range
    "set B1 formula A1*10",
  ], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  // B1 must have been calculated (A1*10 = 100) before C1 summed it.
  expect(sheet.cells.B1.datavalue).toBe(100);
  // C1 = 10 + 20 + 100 + 40 = 170.  If the reversed-range walk was a no-op,
  // C1 would have been calculated before B1 and would see B1 as empty → 70.
  expect(sheet.cells.C1.datavalue).toBe(170);
});

test("RecalcCheckCell C-4081: row-only reversed range (A2:B1) walks row-if branch for formula ordering", async () => {
  // Pure row-reversal (cols normal A<B, rows reversed 2>1) so only the
  // L4249 row-if body is required to set r1/r2.  C1 created first; B1 is a
  // formula inside the range created last.
  // Expected: B1=10*7=70; C1=10+20+70+40=140.
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set C1 formula SUM(A2:B1)",       // C1 first; range is row-reversed only
    "set A1 value n 10",
    "set A2 value n 20",
    "set B2 value n 40",
    "set B1 formula A1*7",             // B1 last — formula at row 1 inside range
  ], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  expect(sheet.cells.B1.datavalue).toBe(70);
  // If L4249 row-if body is emptied, r1/r2 stay unset and B1 is not walked
  // as a dep → C1 calculated before B1 → sees B1 empty → 10+20+0+40=70.
  expect(sheet.cells.C1.datavalue).toBe(140);
});

test("RecalcCheckCell C-4103: circular reference via range path sets circRef error on cell", async () => {
  // A1 = SUM(A1:A2) — A1 depends on itself through a range reference.
  // RecalcCheckCell must detect the cycle via the range path (coordvals.inrange
  // L4280 block), set cell.errors, set checkinfo[startcoord]=true (so the cell
  // is marked calculated), set circularreferencecell, and return early.
  // Without that block the walk re-enters A1 forever (test timeout) OR the
  // circularreferencecell / errors fields stay unset.
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A2 value n 5",
    "set A1 formula SUM(A1:A2)",
  ], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  // circularreferencecell is set ONLY by the RecalcCheckCell circular-ref
  // detectors (range path L4288 or scalar path L4362) — not by evaluation.
  expect(sheet.attribs.circularreferencecell).toBeTruthy();
  // errors field is set by the same detector (s_caccCircRef + startcoord).
  expect(sheet.cells.A1.errors).toBeTruthy();
  // And the valuetype should reflect an error after the aborted check.
  // (Some paths leave valuetype as prior value; errors+circularreferencecell
  // are the hard contracts.)
  expect(
    String(sheet.cells.A1.valuetype).startsWith("e") ||
      Boolean(sheet.cells.A1.errors),
  ).toBe(true);
});

test("RecalcCheckCell C-4199: circular reference via scalar coord path sets circRef error", async () => {
  // A1 = B1, B1 = A1 — mutual scalar reference, not a range.
  // RecalcCheckCell must detect the cycle via the single-cell token path
  // (L4350 block) and set cell.errors + sheet.attribs.circularreferencecell.
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set A1 formula B1",
    "set B1 formula A1",
  ], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  // At least one of the two cells must carry an error valuetype, and the
  // sheet must record a circular reference cell attribute.
  const a1err = String(sheet.cells.A1?.valuetype ?? "");
  const b1err = String(sheet.cells.B1?.valuetype ?? "");
  expect(a1err.startsWith("e") || b1err.startsWith("e")).toBe(true);
  expect(sheet.attribs.circularreferencecell).toBeTruthy();
});

test("RecalcCheckCell C-4114/4119/4125: sheetref from '!' suppresses foreign coord; local formula after '+' is ordered correctly", async () => {
  // Pre-load a stub sheet into SheetCache so OtherSheet!A1 does not hang
  // the recalc scheduler waiting for a sheet that never arrives.
  //
  // Formula: C1 = OtherSheet!A1 + B1
  //   - '!' sets sheetref=true → OtherSheet!A1 is NOT registered as a local dep
  //   - '+' (not ':') resets sheetref=false → B1 IS registered as a local dep
  //
  // B1 is itself a formula (A1*5).  C1 is created first so that without the
  // sheetref-reset (C-4125) — or without the '!' handler that makes the
  // subsequent reset meaningful (C-4114/4119) — the local B1 dependency would
  // either be missed (B1 calculated after C1 → C1 sees 0) or the foreign
  // coord would be walked as local (no hang, but wrong calclist).
  // Expected with correct sheetref handling: B1=50, C1=0+50=50.
  const SC = await loadSocialCalc();
  const otherSave = "cell:A1:v:0\n";
  SC.Formula.AddSheetToCache("OtherSheet", otherSave, false);

  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set C1 formula OtherSheet!A1+B1",  // C1 first in celllist
    "set A1 value n 10",
    "set B1 formula A1*5",              // B1 last — local formula dep of C1
  ], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  expect(sheet.cells.B1.datavalue).toBe(50);
  // C1 = OtherSheet!A1(0) + B1(50) = 50.  If B1 was not registered as a local
  // dep (sheetref never reset), C1 would be calculated before B1 → 0.
  expect(sheet.cells.C1.datavalue).toBe(50);
});

test("RecalcCheckCell C-4130/4135: named-range expansion forces intermediate formula deps to calculate first", async () => {
  // Named range 'myRange' covers A1:A2 where A2 is a formula.
  // C1 = SUM(myRange) is created FIRST so that without the token_name
  // expansion (L4306/L4309), A2 is not walked as a dep of C1 and C1 would
  // be calculated before A2 (seeing A2 as empty).
  // Expected: A2=10*3=30; C1=10+30=40.
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set C1 formula SUM(myRange)",     // C1 first
    "set A1 value n 10",
    "name define myRange A1:A2",
    "set A2 formula A1*3",             // A2 last — formula inside named range
  ], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  expect(sheet.cells.A2.datavalue).toBe(30);
  // If named-range expansion was a no-op, C1 would not walk A2 and would
  // sum A1(10)+A2(empty=0)=10 instead of 40.
  expect(sheet.cells.C1.datavalue).toBe(40);
});

test("RecalcCheckCell C-4177/4206: range walk orders intermediate formula deps before the consumer", async () => {
  // C1 = SUM(A1:B2) created FIRST.  B2 is a formula (A1+A2) created LAST.
  // Without the range-registration block (L4335) C1 would not walk B2 as a
  // dep and would be calculated before B2.
  // C-4206 (calclist else-append): with two formula cells (B2 and C1) both
  // ending up on the calclist, the else branch of `if (!firstcalc)` fires
  // for the second one.  If that else is a no-op, the calclist chain breaks
  // and the second formula is never evaluated.
  // Expected: B2=1+2=3; C1=1+2+3+3=9  (A1=1,A2=2,B1=3,B2=3).
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, [
    "set C1 formula SUM(A1:B2)",       // C1 first
    "set A1 value n 1",
    "set A2 value n 2",
    "set B1 value n 3",
    "set B2 formula A1+A2",            // B2 last — formula inside the range
  ], true, 3000);
  await recalcSheet(SC, sheet, 3000);
  expect(sheet.cells.B2.datavalue).toBe(3);
  // C1 = 1+2+3+3 = 9.  If range walk or calclist-append is broken, C1 sees
  // B2 as empty → 1+2+3+0 = 6.
  expect(sheet.cells.C1.datavalue).toBe(9);
});

// ===========================================================================
// Section 16: UndoStack maxUndo eviction and Undo() boundary — Gap D
// (js/socialcalc-3.ts L4511-4514 / L4548 mutants 4315/4320/4321/4371/4375).
//
// The UndoStack with maxUndo=3 must evict the oldest undo data when more
// than 3 changes are pushed, and Undo() must refuse to cross the eviction
// boundary (returning false when tos would drop below the oldest entry
// that still has undo data).
//
// Mutant mapping:
//  4315: ConditionalExpression → false  (whole if skipped; no eviction ever)
//  4320: BlockStatement → {}            (eviction guard skipped; .undo never cleared)
//  4321: ArithmeticOperator -1 → +1    (clears wrong entry — one past boundary)
//  4371: ConditionalExpression → true   (Undo() always returns true → no boundary)
//  4375: EqualityOperator > → >=        (off-by-one: allows one extra undo past boundary)
// ===========================================================================

test("UndoStack maxUndo=3: 4th push evicts oldest undo data and Undo() refuses to cross boundary", async () => {
  const SC = await loadSocialCalc();
  const undoStack = new SC.UndoStack();
  undoStack.maxUndo = 3;  // hold at most 3 undoable entries

  // Push 4 changes.  Each has a real undo command so we can assert eviction.
  for (let n = 1; n <= 4; n++) {
    undoStack.PushChange(`change${n}`);
    undoStack.AddDo(`do${n}`);
    undoStack.AddUndo(`undo${n}`);
  }

  // stack.length == 4, maxUndo == 3.
  // PushChange after the 4th push must have cleared stack[0].undo
  // (the entry one beyond the maxUndo boundary from the end).
  // stack[0] is change1, stack[3] is change4.
  // L4513: this.stack[this.stack.length - this.maxUndo - 1].undo = []
  //   → stack[4-3-1=0].undo = [] → change1's undo is evicted.
  expect(undoStack.stack.length).toBe(4);
  expect(undoStack.stack[0].undo).toEqual([]);         // evicted (kills 4315/4320)
  expect(undoStack.stack[1].undo).toEqual(["undo2"]);  // still present
  expect(undoStack.stack[2].undo).toEqual(["undo3"]);  // still present
  expect(undoStack.stack[3].undo).toEqual(["undo4"]);  // still present

  // Kills mutant 4321 (-1 → +1 would clear stack[4-3+1=2]=change3, not change1):
  // If +1 had been used, stack[2].undo would be [] and stack[0].undo would be ["undo1"].
  // Our assertions above prove the CORRECT entry (stack[0]) was cleared.

  // tos is at 3 (pointing to change4).
  expect(undoStack.tos).toBe(3);

  // Undo() 3 times must succeed: tos goes 3→2→1→... but stops when tos
  // would fall to 0, which is the evicted-undo boundary.
  // L4548: tos > stack.length - maxUndo - 1  →  tos > 4 - 3 - 1 = 0
  // so tos must be STRICTLY GREATER THAN 0 to allow another undo.
  expect(undoStack.Undo()).toBe(true);  // tos: 3→2 (kills 4371 — always-true mutant)
  expect(undoStack.tos).toBe(2);
  expect(undoStack.Undo()).toBe(true);  // tos: 2→1
  expect(undoStack.tos).toBe(1);
  // tos is now 1; the boundary is stack.length-maxUndo-1 = 0.
  // tos > 0 is true (1 > 0), so one more Undo is allowed.
  expect(undoStack.Undo()).toBe(true);  // tos: 1→0
  expect(undoStack.tos).toBe(0);
  // tos is now 0; 0 > 0 is false → Undo() must return false (boundary reached).
  // Kills mutant 4375 (>= instead of >): 0 >= 0 would be true, wrongly allowing one more.
  expect(undoStack.Undo()).toBe(false); // boundary hit
  expect(undoStack.tos).toBe(0);       // tos must not change after refusal

  // Redo still works from tos=0.
  expect(undoStack.Redo()).toBe(true);
  expect(undoStack.tos).toBe(1);
});

test("UndoStack maxUndo=3: pushing >maxUndo changes evicts ONLY the oldest entry per push", async () => {
  // Verify that each individual push beyond maxUndo evicts exactly one entry
  // (the one at position length-maxUndo-1 at that moment), not more.
  const SC = await loadSocialCalc();
  const undoStack = new SC.UndoStack();
  undoStack.maxUndo = 3;

  // Push 3 (stack fills to maxUndo; no eviction yet).
  for (let n = 1; n <= 3; n++) {
    undoStack.PushChange(`c${n}`);
    undoStack.AddUndo(`u${n}`);
  }
  // At maxUndo: no eviction yet (length == maxUndo, not > maxUndo).
  expect(undoStack.stack.length).toBe(3);
  expect(undoStack.stack[0].undo).toEqual(["u1"]); // still intact
  expect(undoStack.stack[1].undo).toEqual(["u2"]);
  expect(undoStack.stack[2].undo).toEqual(["u3"]);

  // Push 4th (length=4 > maxUndo=3 → evict stack[0]).
  undoStack.PushChange("c4");
  undoStack.AddUndo("u4");
  expect(undoStack.stack[0].undo).toEqual([]);    // evicted
  expect(undoStack.stack[1].undo).toEqual(["u2"]);
  expect(undoStack.stack[2].undo).toEqual(["u3"]);
  expect(undoStack.stack[3].undo).toEqual(["u4"]);

  // Push 5th (length=5 > maxUndo=3 → evict stack[1], which was u2).
  undoStack.PushChange("c5");
  undoStack.AddUndo("u5");
  expect(undoStack.stack[0].undo).toEqual([]);    // still evicted from before
  expect(undoStack.stack[1].undo).toEqual([]);    // newly evicted
  expect(undoStack.stack[2].undo).toEqual(["u3"]); // still intact
  expect(undoStack.stack[3].undo).toEqual(["u4"]);
  expect(undoStack.stack[4].undo).toEqual(["u5"]);

  // Undo sequence: tos=4; boundary = stack.length - maxUndo - 1 = 5-3-1 = 1.
  // L4548: tos > boundary (strictly greater) allows undo.
  // 4>1 → true (tos→3); 3>1 → true (tos→2); 2>1 → true (tos→1); 1>1 → false.
  // The third Undo() DOES succeed (tos 2→1); the fourth is refused at the boundary.
  // Mutant 4375 (>= instead of >): 1 >= 1 would wrongly allow one extra undo.
  expect(undoStack.Undo()).toBe(true);   // 4→3
  expect(undoStack.Undo()).toBe(true);   // 3→2
  expect(undoStack.Undo()).toBe(true);   // 2→1 (still > boundary)
  expect(undoStack.tos).toBe(1);
  expect(undoStack.Undo()).toBe(false);  // 1 is NOT > 1 → boundary hit (kills 4375)
  expect(undoStack.tos).toBe(1);         // tos must not change after refusal
});
