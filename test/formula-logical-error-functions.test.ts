import { expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "./helpers/socialcalc";

// Command-level tests for IFERROR/IFNA/IFS/SWITCH. See js/formula1.ts
// SocialCalc.Formula.IfErrorFunction/IfsFunction/SwitchFunction for the
// implementation and lemma/eval-ops.ts isNAType / lemma/branch.ts
// firstTrueIndex/switchBranch for the pure policies these mirror.

async function setup(commands: string[]) {
  const SC = await loadSocialCalc();
  const sheet = new SC.Sheet();
  await scheduleCommands(SC, sheet, commands);
  await recalcSheet(SC, sheet);
  const getDV = (coord: string) => sheet.GetAssuredCell(coord).datavalue;
  const getVT = (coord: string) => sheet.GetAssuredCell(coord).valuetype;
  return { SC, sheet, getDV, getVT };
}

// ---------------------------------------------------------------------------
// IFERROR
// ---------------------------------------------------------------------------

test("IFERROR: passes through a non-error value untouched", async () => {
  const { getDV, getVT } = await setup(["set A1 formula IFERROR(5,99)"]);
  expect(getDV("A1")).toBe(5);
  expect(getVT("A1")).toBe("n");
});

test("IFERROR: catches #DIV/0! and returns the fallback", async () => {
  const { getDV, getVT } = await setup(['set A1 formula IFERROR(1/0,"fallback")']);
  expect(getDV("A1")).toBe("fallback");
  expect(getVT("A1")).toBe("t");
});

test("IFERROR: catches #N/A too (broader than IFNA)", async () => {
  const { getDV } = await setup(['set A1 formula IFERROR(NA(),"caught")']);
  expect(getDV("A1")).toBe("caught");
});

test("IFERROR: wrong arg count is #VALUE!", async () => {
  const { getVT } = await setup(["set A1 formula IFERROR(1)"]);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("IFERROR: fallback branch itself an error propagates that error", async () => {
  const { getVT, getDV } = await setup(["set A1 formula IFERROR(1/0,1/0)"]);
  expect(getVT("A1")).toBe("e#DIV/0!");
  expect(getDV("A1")).toBe(0);
});

// ---------------------------------------------------------------------------
// IFNA
// ---------------------------------------------------------------------------

test("IFNA: passes through a non-error value untouched", async () => {
  const { getDV } = await setup(["set A1 formula IFNA(5,99)"]);
  expect(getDV("A1")).toBe(5);
});

test("IFNA: catches #N/A and returns the fallback", async () => {
  const { getDV } = await setup(['set A1 formula IFNA(NA(),"caught")']);
  expect(getDV("A1")).toBe("caught");
});

test("IFNA: does NOT catch other error types (#DIV/0! still propagates)", async () => {
  const { getVT, getDV } = await setup(['set A1 formula IFNA(1/0,"caught")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
  expect(getDV("A1")).toBe(0);
});

test("IFNA: an explicit #N/A range reference is caught", async () => {
  const { getDV } = await setup(["set A1 formula NA()", 'set B1 formula IFNA(A1,"n/a caught")']);
  expect(getDV("B1")).toBe("n/a caught");
});

// ---------------------------------------------------------------------------
// IFS
// ---------------------------------------------------------------------------

test("IFS: returns the value paired with the first true condition", async () => {
  const { getDV } = await setup([
    "set A1 value n 5",
    'set B1 formula IFS(A1<0,"neg",A1=0,"zero",A1>0,"pos")',
  ]);
  expect(getDV("B1")).toBe("pos");
});

test("IFS: first true wins even when a later condition is also true", async () => {
  const { getDV } = await setup(['set A1 formula IFS(1=1,"first",2=2,"second")']);
  expect(getDV("A1")).toBe("first");
});

test("IFS: no condition true raises #N/A", async () => {
  const { getVT } = await setup(['set A1 formula IFS(1=2,"a",3=4,"b")']);
  expect(getVT("A1")).toBe("e#N/A");
});

test("IFS: odd argument count is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula IFS(1=1,"a",1=1)']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("IFS: a non-logical/non-numeric condition is #VALUE!", async () => {
  const { getVT } = await setup(['set A1 formula IFS("x","a")']);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("IFS: an error condition propagates that error", async () => {
  const { getVT } = await setup(['set A1 formula IFS(1/0,"a",1=1,"b")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

// ---------------------------------------------------------------------------
// SWITCH
// ---------------------------------------------------------------------------

test("SWITCH: a numeric expression against a text case compares as formatted text (mixed types)", async () => {
  const { getDV } = await setup(['set A1 formula SWITCH(1,"x","a",1,"b")']);
  expect(getDV("A1")).toBe("b");
});

test("SWITCH: a blank-cell expression compares as empty text", async () => {
  // Z9 is never set, so it resolves to a genuine blank (type "b"), not
  // an empty text cell. valuesEqual then hits the t1=="b" → s1="" arm.
  const { getDV } = await setup(['set B1 formula SWITCH(Z9,"","blank","x","not")']);
  expect(getDV("B1")).toBe("blank");
});

test("SWITCH: a blank-cell case compares as empty text", async () => {
  // The expression "" is empty text; the case Z9 is an unset (blank, type
  // "b") cell, which valuesEqual renders as "" — so they match.
  const { getDV } = await setup(['set A1 formula SWITCH("",Z9,"blank")']);
  expect(getDV("A1")).toBe("blank");
});

test("SWITCH: a numeric case against a text expression compares as text (mixed types)", async () => {
  const { getDV } = await setup(['set A1 formula SWITCH("2",1,"one",2,"two")']);
  expect(getDV("A1")).toBe("two");
});

test("SWITCH: returns the value of the first matching case (numeric compare)", async () => {
  const { getDV } = await setup(['set A1 formula SWITCH(2,1,"one",2,"two",3,"three")']);
  expect(getDV("A1")).toBe("two");
});

test("SWITCH: text comparison is case-insensitive, matching the = operator", async () => {
  const { getDV } = await setup(['set A1 formula SWITCH("Bob","alice","A","bob","B")']);
  expect(getDV("A1")).toBe("B");
});

test("SWITCH: falls through to the trailing default when nothing matches", async () => {
  const { getDV } = await setup(['set A1 formula SWITCH(9,1,"one",2,"two","none")']);
  expect(getDV("A1")).toBe("none");
});

test("SWITCH: no match and no default raises #N/A", async () => {
  const { getVT } = await setup(['set A1 formula SWITCH(9,1,"one",2,"two")']);
  expect(getVT("A1")).toBe("e#N/A");
});

test("SWITCH: too few arguments is #VALUE!", async () => {
  const { getVT } = await setup(["set A1 formula SWITCH(1)"]);
  expect(getVT("A1")).toBe("e#VALUE!");
});

test("SWITCH: an error in the expression propagates immediately", async () => {
  const { getVT } = await setup(['set A1 formula SWITCH(1/0,1,"one","default")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("SWITCH: an error in a case value propagates once reached", async () => {
  const { getVT } = await setup(['set A1 formula SWITCH(1,1/0,"never","default")']);
  expect(getVT("A1")).toBe("e#DIV/0!");
});

test("SWITCH: nested inside IFERROR resolves the whole expression", async () => {
  const { getDV } = await setup(['set A1 formula IFERROR(SWITCH(1,2,"two",1/0),"fallback")']);
  expect(getDV("A1")).toBe("fallback");
});

// ---------------------------------------------------------------------------
// Eager-evaluation caveat (documented, not silently different behavior)
// ---------------------------------------------------------------------------

test("IF/IFERROR/IFS/SWITCH eagerly evaluate every branch: a volatile marker in a\n  discarded branch still registers", async () => {
  const { SC } = await setup(["set A1 formula IFERROR(1,NOW())"]);
  // NOW() sits in the unused fallback branch of IFERROR(1, NOW()); the eager
  // evaluator still runs it (see js/formula1.ts IfErrorFunction docblock),
  // so the volatile marker is set even though the branch is discarded. This
  // is the documented divergence from vendor Excel/Sheets short-circuiting.
  expect(SC.Formula.FreshnessInfo.volatile.NOW).toBe(true);
});
