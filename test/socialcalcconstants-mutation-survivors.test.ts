// Kills Stryker survivors in js/socialcalcconstants.ts: default-value literals inside
// SC.Constants / SC.ConstantsDefaultClasses (including the cellDataType dispatch table
// and the doCanonicalizeSheet boolean, proven both directly and via its one real
// consumer, SC.CanonicalizeSheet), and the two mutating helpers
// SC.ConstantsSetClasses / SC.ConstantsSetImagePrefix.
//
// `loadSocialCalc()` returns a process-wide singleton (see test/helpers/socialcalc.ts);
// test files are isolated from each other by Vitest (each gets its own module graph /
// worker), so the destructive Constants mutations below only ever affect this file. We
// still read the untouched defaults as the very first thing in each relevant test so an
// earlier test *within this file* can never leak into a later assertion.
//
// Bulk StringLiteral survivors across the rest of the ~940-line Constants data table
// (s_loc_*, s_fdef_*/s_farg_*, SCFormat*, day/month name arrays, etc.) are covered
// separately in test/socialcalcconstants-oracle-parity.test.ts via whole-object
// comparison against the pinned, independently-vendored oracle 3.0.8 bundle — that
// file needs a pristine, never-mutated Constants object, which this file's destructive
// ConstantsSetImagePrefix tests (whose rewrite pass touches every string field on
// SC.Constants) would otherwise corrupt if combined here.

import { expect, test } from "vite-plus/test";

import { loadSocialCalc, scheduleCommands } from "./helpers/socialcalc";

// ===========================================================================
// Section 1: Untouched default-value literals inside SC.Constants (booleans /
// numbers / nested lookup objects that no other test in the deterministic
// subset ever reads).
// ===========================================================================

test("AllowCtrlS defaults to true (Ctrl-S trapdoor enabled out of the box)", async () => {
  const SC = await loadSocialCalc();
  expect(SC.Constants.AllowCtrlS).toBe(true);
});

test("cellDataType maps every SocialCalc cell datatype code to its dispatch word, including the v/n synonym", async () => {
  const SC = await loadSocialCalc();
  // formula1.ts's CopyValueToRange only ever exercises the "v" entry directly
  // (see hardening-formula-branches.test.ts); the other 4 entries — including the
  // "n" -> "value" synonym for cell.datatype "n" (numeric-without-formula) — are
  // otherwise untested StringLiteral survivors. Pin the whole dispatch table.
  expect(SC.Constants.cellDataType).toEqual({
    v: "value",
    n: "value",
    t: "text",
    f: "formula",
    c: "constant",
  });
});

test("s_CHindicatorOperationLookup maps every CellHandles drag operation to its label", async () => {
  const SC = await loadSocialCalc();
  const lookup = SC.Constants.s_CHindicatorOperationLookup;
  expect(Object.keys(lookup).sort()).toEqual(
    ["Fill", "FillC", "Move", "MoveC", "MoveI", "MoveIC"].sort(),
  );
  expect(lookup.Fill).toBe("Fill");
  expect(lookup.FillC).toBe("Fill Contents");
  expect(lookup.Move).toBe("Move");
  expect(lookup.MoveI).toBe("Slide");
  expect(lookup.MoveC).toBe("Move Contents");
  expect(lookup.MoveIC).toBe("Slide Contents");
});

test("s_CHindicatorDirectionLookup maps every drag direction to its label suffix", async () => {
  const SC = await loadSocialCalc();
  const lookup = SC.Constants.s_CHindicatorDirectionLookup;
  expect(Object.keys(lookup).sort()).toEqual(
    ["Down", "Horizontal", "Right", "Vertical"].sort(),
  );
  expect(lookup.Down).toBe(" Down");
  expect(lookup.Right).toBe(" Right");
  expect(lookup.Horizontal).toBe(" Horizontal");
  expect(lookup.Vertical).toBe(" Vertical");
});

test("TCTDFSleftOffsetv and TCTDFStopOffseth default to their documented negative pixel offsets", async () => {
  const SC = await loadSocialCalc();
  // Both are unary-negated numeric literals; a UnaryOperator mutant flips the sign.
  expect(SC.Constants.TCTDFSleftOffsetv).toBe(-80);
  expect(SC.Constants.TCTDFStopOffseth).toBe(-30);
});

test("ConstantsDefaultClasses.defaultInputEcho carries its classname/style pair verbatim", async () => {
  const SC = await loadSocialCalc();
  // An ObjectLiteral mutant collapses this entry to {}, which would make both
  // fields undefined.
  expect(SC.ConstantsDefaultClasses.defaultInputEcho).toEqual({
    classname: "",
    style: "filter:alpha(opacity=90);opacity:.9;",
  });
});

test("ConstantsDefaultClasses carries every documented default verbatim, not just defaultInputEcho", async () => {
  const SC = await loadSocialCalc();
  // The single-entry test above only pins defaultInputEcho. The other 22 sibling
  // entries run through the exact same ConstantsSetClasses string/object dispatch
  // (proven by the Section 2 tests below) but their own literal content was never
  // pinned — a StringLiteral/ObjectLiteral mutant on any of them would survive.
  // One deep-equality snapshot closes all 22 gaps at once instead of 22 near-
  // duplicate one-liners.
  expect(SC.ConstantsDefaultClasses).toEqual({
    defaultComment: "",
    defaultCommentNoGrid: "",
    defaultHighlightTypeCursor: "",
    defaultHighlightTypeRange: "",
    defaultColname: "",
    defaultSelectedColname: "",
    defaultRowname: "",
    defaultSelectedRowname: "",
    defaultUpperLeft: "",
    defaultSkippedCell: "",
    defaultPaneDivider: "",
    cteGriddiv: "",
    defaultInputEcho: { classname: "", style: "filter:alpha(opacity=90);opacity:.9;" },
    TCmain: "",
    TCendcap: "",
    TCpaneslider: "",
    TClessbutton: "",
    TCmorebutton: "",
    TCscrollarea: "",
    TCthumb: "",
    TCPStrackingline: "",
    TCTDFSthumbstatus: "",
    TDpopupElement: "",
  });
});

// ===========================================================================
// Section 1b: SC.Constants.doCanonicalizeSheet — pinned directly, and proven
// load-bearing through its one real consumer, SC.CanonicalizeSheet, rather
// than treated as an inert metadata flag.
// ===========================================================================

test("doCanonicalizeSheet defaults to true and actually gates CanonicalizeSheet's compaction pass", async () => {
  const SC = await loadSocialCalc();
  expect(SC.Constants.doCanonicalizeSheet).toBe(true);

  const sheet = new SC.Sheet();
  // Two distinct font strings set on the same cell: the second "set A1 font"
  // reassigns A1 to a freshly-allocated table entry, leaving the first allocation
  // an orphaned, unreferenced entry in sheet.fonts (table entries are never
  // reclaimed outside of CanonicalizeSheet's compaction pass).
  await scheduleCommands(SC, sheet, [
    "set A1 font italic bold 10pt Verdana",
    "set A1 font normal bold 12pt Arial",
  ]);
  const rawFontCount = sheet.fonts.length; // "" placeholder + orphan + live entry
  expect(rawFontCount).toBe(3);

  // With the shipped default (true) and full=true, CanonicalizeSheet walks every
  // live cell and rebuilds xlt.newfonts from only the entries actually referenced
  // — dropping the orphan. A BooleanLiteral mutant flipping doCanonicalizeSheet to
  // false would make this branch behave identically to the no-op case proven below
  // instead of actually compacting.
  sheet.CanonicalizeSheet(true);
  expect(sheet.xlt.newfonts).not.toBe(sheet.fonts);
  expect(sheet.xlt.newfonts.length).toBe(2); // "" placeholder + the one still-live font
  delete sheet.xlt;

  // Flipping the constant off (restored in `finally`, no product policy change)
  // forces the early-return "make no changes" branch even though full=true is still
  // passed — xlt.newfonts becomes the *same* array reference as sheet.fonts,
  // orphan included. This is the behavioral proof that the constant — not `full`
  // alone — is what selects between the two branches.
  const original = SC.Constants.doCanonicalizeSheet;
  SC.Constants.doCanonicalizeSheet = false;
  try {
    sheet.CanonicalizeSheet(true);
    expect(sheet.xlt.newfonts).toBe(sheet.fonts);
    expect(sheet.xlt.newfonts.length).toBe(rawFontCount);
  } finally {
    SC.Constants.doCanonicalizeSheet = original;
    delete sheet.xlt;
  }
});

// ===========================================================================
// Section 2: SC.ConstantsSetClasses(prefix) — every branch of the string vs.
// object default dispatch, including the "no Style companion" documented edge
// case (cteGriddiv) and a synthetic non-string/non-object probe entry that
// proves the else-if's own typeof check is load-bearing.
// ===========================================================================

test("ConstantsSetClasses prefixes string, no-style, and object defaults per their documented rules", async () => {
  const SC = await loadSocialCalc();
  SC.ConstantsSetClasses("zz-");

  // Plain string default ("") with an existing *Style companion: class falls back to
  // the item name, and the companion style is cleared to "".
  expect(SC.Constants.defaultCommentClass).toBe("zz-defaultComment");
  expect(SC.Constants.defaultCommentStyle).toBe("");

  // cteGriddiv is documented as "this one has no Style version with it" — the class
  // must still be set, but no cteGriddivStyle property may be spuriously created.
  expect(SC.Constants.cteGriddivClass).toBe("zz-cteGriddiv");
  expect("cteGriddivStyle" in SC.Constants).toBe(false);

  // Object default {classname: "", style: "..."}: falsy classname falls back to the
  // item name (not the object itself, not dropped, not stringified); style is taken
  // verbatim from the defaults object, not cleared to "".
  expect(SC.Constants.defaultInputEchoClass).toBe("zz-defaultInputEcho");
  expect(SC.Constants.defaultInputEchoStyle).toBe("filter:alpha(opacity=90);opacity:.9;");
});

test("ConstantsSetClasses skips defaults that are neither string nor object typeof", async () => {
  const SC = await loadSocialCalc();
  const defaults = SC.ConstantsDefaultClasses as Record<string, unknown>;

  // Neither `typeof 42 == "string"` nor `typeof 42 == "object"` — the function must
  // leave this entry untouched. A ConditionalExpression mutant that forces the
  // else-if's own typeof check to `true` would wrongly fall into the object branch
  // for it (every real default is already either string or object, so that branch
  // is otherwise unreachable-with-a-different-outcome).
  defaults.__mutationProbe = 42;
  try {
    SC.ConstantsSetClasses("qq-");
    expect("__mutationProbeClass" in SC.Constants).toBe(false);
    expect("__mutationProbeStyle" in SC.Constants).toBe(false);
  } finally {
    delete defaults.__mutationProbe;
  }
});

test("ConstantsSetClasses with no argument falls back to an empty prefix instead of literal \"undefined\"", async () => {
  const SC = await loadSocialCalc();
  // prefix = prefix || ""  — called with zero arguments, `prefix` starts undefined.
  // A LogicalOperator mutant (|| -> &&) or an EqualsInitializer mutant that drops
  // the fallback would leave `prefix` undefined, and the subsequent string
  // concatenation `prefix + (defaults[item] || item)` would produce
  // "undefineddefaultComment" instead of the intended "defaultComment".
  SC.ConstantsSetClasses();
  expect(SC.Constants.defaultCommentClass).toBe("defaultComment");
  // Same fallback also has to apply on the object-default branch, not just the
  // string-default branch exercised above.
  expect(SC.Constants.defaultInputEchoClass).toBe("defaultInputEcho");
});

// ===========================================================================
// Section 3: SC.ConstantsSetImagePrefix(imagePrefix) — the direct-prefix
// rewrite pass and the separate hyphen-form rewrite pass, exercised in
// isolation from each other via crafted defaultImagePrefix chains.
// ===========================================================================

test("ConstantsSetImagePrefix leaves content untouched when the old prefix is empty", async () => {
  const SC = await loadSocialCalc();
  const before = SC.Constants.s_BrowserNotSupported;

  // Drive defaultImagePrefix to "" first: the direct-rewrite `if (oldPrefix)` guard
  // must then skip the split/join entirely. A ConditionalExpression mutant forcing
  // that guard to `true` would instead run `s.split("").join(imagePrefix)` on every
  // string field, splitting each into individual characters and corrupting it.
  SC.ConstantsSetImagePrefix("");
  expect(SC.Constants.defaultImagePrefix).toBe("");

  SC.ConstantsSetImagePrefix("XX");
  expect(SC.Constants.s_BrowserNotSupported).toBe(before);
  expect(SC.Constants.defaultImagePrefix).toBe("XX");
});

test("ConstantsSetImagePrefix direct-prefix pass rewrites a matching old prefix in place", async () => {
  const SC = await loadSocialCalc();

  // Set a known old prefix and a marker field containing it as a substring directly
  // (rather than relying on the load-time default content, which earlier tests in this
  // file may have already rewritten): the direct-prefix
  // `if (oldPrefix) { s = s.split(oldPrefix).join(imagePrefix); }` block must fire.
  // A ConditionalExpression-false or BlockStatement-emptied mutant would silently
  // skip this rewrite, leaving the stale "sc-lockbg" substring in place.
  SC.Constants.defaultImagePrefix = "sc-lockbg";
  (SC.Constants as Record<string, unknown>).__testMarker = "url(sc-lockbg.gif)";
  try {
    SC.ConstantsSetImagePrefix("REPLACED");
    expect((SC.Constants as Record<string, unknown>).__testMarker).toBe("url(REPLACED.gif)");
  } finally {
    delete (SC.Constants as Record<string, unknown>).__testMarker;
  }
});

test("ConstantsSetImagePrefix hyphen-form pass only fires when the old prefix actually ended in an underscore", async () => {
  const SC = await loadSocialCalc();

  // With defaultImagePrefix = "ab" (no trailing "_"), oldHyphen is defined to be
  // exactly oldPrefix, so `oldHyphen !== oldPrefix` is always false and the hyphen
  // pass (`if (oldHyphen && oldHyphen !== oldPrefix) { ... }`) must never run — only
  // the direct-prefix pass does. If it wrongly ran anyway (ConditionalExpression
  // forced true, its LogicalOperator flipped to `||`, or just its right-hand
  // `oldHyphen !== oldPrefix` operand forced true), it would re-split the
  // *already-rewritten* string on the same substring and further corrupt it.
  SC.Constants.defaultImagePrefix = "ab";
  (SC.Constants as Record<string, unknown>).__testMarker = "Xab";
  try {
    SC.ConstantsSetImagePrefix("abab");
    expect((SC.Constants as Record<string, unknown>).__testMarker).toBe("Xabab");
  } finally {
    delete (SC.Constants as Record<string, unknown>).__testMarker;
  }
});

test("ConstantsSetImagePrefix hyphen-form pass fires and rewrites sc-*.gif backgrounds when both old and new prefixes end in an underscore", async () => {
  const SC = await loadSocialCalc();

  // Production-realistic underscore case: the shipped default is "images/sc_" and
  // a caller re-prefixing images typically supplies another "_"-suffixed prefix
  // (e.g. "images/xx_"). Both oldPrefix and imagePrefix here end in "_", so
  // oldHyphen = "sc_".slice(0, -1) + "-" = "sc-" and newHyphen = "xx_".slice(0, -1)
  // + "-" = "xx-", and `oldHyphen !== oldPrefix` is true — the hyphen pass must
  // fire and rewrite the hyphen-form "sc-*.gif" background URLs that the
  // direct-prefix pass alone (matching literal "sc_") never touches. Before this
  // test, no case in this file ever set *both* the old and new prefix to end in
  // "_", so the positive/fire branch of this guard was proven-never-tested.
  SC.Constants.defaultImagePrefix = "sc_";
  (SC.Constants as Record<string, unknown>).__testMarker = "url(sc-lockbg.gif) url(sc-commentbg.gif)";
  try {
    SC.ConstantsSetImagePrefix("xx_");
    expect((SC.Constants as Record<string, unknown>).__testMarker).toBe(
      "url(xx-lockbg.gif) url(xx-commentbg.gif)",
    );
    expect(SC.Constants.defaultImagePrefix).toBe("xx_");
  } finally {
    delete (SC.Constants as Record<string, unknown>).__testMarker;
  }
});

test("ConstantsSetImagePrefix hyphen-form pass fires for a synthetic non-default underscore prefix too", async () => {
  const SC = await loadSocialCalc();

  // Same guard, but with prefixes that are neither the shipped default nor a
  // realistic "images/..." path — proves the rewrite is driven purely by the
  // trailing "_", not by any special-casing of the literal default string.
  SC.Constants.defaultImagePrefix = "aa_";
  (SC.Constants as Record<string, unknown>).__testMarker = "aa-suffix";
  try {
    SC.ConstantsSetImagePrefix("bb_");
    expect((SC.Constants as Record<string, unknown>).__testMarker).toBe("bb-suffix");
  } finally {
    delete (SC.Constants as Record<string, unknown>).__testMarker;
  }
});
