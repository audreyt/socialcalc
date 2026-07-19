import { describe, expect, test } from "vite-plus/test";

import {
  loadSocialCalc,
  makeSave,
  recalcSheet,
  scheduleCommands,
  sheetRedo,
  sheetUndo,
} from "./helpers/socialcalc";

function encodeRule(SC: any, rule: unknown) {
  return SC.encodeForSave(SC.DataValidation.EncodeRule(rule));
}

describe("data validation: set/clear commands", () => {
  test("set validation stores a decodable rule on the cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "between",
      bound1: 1,
      bound2: 10,
      allowBlank: true,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    const decoded = SC.DataValidation.DecodeRule(sheet.cells.A1.validation);
    expect(decoded).toEqual(rule);
  });

  test("clearvalidation removes the rule", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "list", values: ["a", "b"], allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, [
      `set A1 validation ${encodeRule(SC, rule)}`,
      "set A1 clearvalidation",
    ]);
    expect(sheet.cells.A1.validation).toBeUndefined();
  });

  test("Sheet.SetCellValidation/ClearCellValidation/GetCellValidation API round-trips", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "textLength",
      op: "le",
      bound1: 5,
      bound2: 0,
      allowBlank: true,
      mode: "warn",
    };
    await new Promise<void>((resolve) => {
      sheet.statuscallback = (_s: any, status: string) => {
        if (status === "cmdend") resolve();
      };
      sheet.SetCellValidation("B2", rule);
    });
    expect(sheet.GetCellValidation("B2")).toEqual(rule);

    await new Promise<void>((resolve) => {
      sheet.statuscallback = (_s: any, status: string) => {
        if (status === "cmdend") resolve();
      };
      sheet.ClearCellValidation("B2");
    });
    expect(sheet.GetCellValidation("B2")).toBeNull();
  });

  test("GetCellValidation returns null for a coordinate whose cell was never created", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    expect(sheet.cells.Z99).toBeUndefined();
    expect(sheet.GetCellValidation("Z99")).toBeNull();
  });

  test("set validation on a range applies the rule to every cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: 0,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1:A3 validation ${encodeRule(SC, rule)}`);
    expect(SC.DataValidation.DecodeRule(sheet.cells.A1.validation)).toEqual(rule);
    expect(SC.DataValidation.DecodeRule(sheet.cells.A2.validation)).toEqual(rule);
    expect(SC.DataValidation.DecodeRule(sheet.cells.A3.validation)).toEqual(rule);
  });
});

describe("data validation: enforcement (reject) in ExecuteSheetCommand", () => {
  test("reject mode blocks 'set value' commits that fail the rule", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "between",
      bound1: 1,
      bound2: 10,
      allowBlank: true,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    await scheduleCommands(SC, sheet, "set A1 value n 50");
    // rejected: cell stays blank
    expect(sheet.cells.A1.datavalue).toBe("");
  });

  test("reject mode blocks 'set text' commits", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "list",
      values: ["red", "green", "blue"],
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("purple")}`);
    expect(sheet.cells.A1.datavalue).toBe("");
    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("green")}`);
    expect(sheet.cells.A1.datavalue).toBe("green");
  });

  test("reject mode blocks 'set constant' commits", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "le",
      bound1: 100,
      bound2: 0,
      allowBlank: true,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    await scheduleCommands(SC, sheet, "set A1 constant n 500 500");
    expect(sheet.cells.A1.datavalue).toBe("");
  });

  test("allowBlank passes an empty commit even under reject mode", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: 0,
      bound2: 0,
      allowBlank: true,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, [
      `set A1 validation ${encodeRule(SC, rule)}`,
      "set A1 value n 5",
      "set A1 empty",
    ]);
    expect(sheet.cells.A1.datavalue).toBe("");
  });

  test("formula commits are never validation-gated (value unknown until recalc)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "eq",
      bound1: 1,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, [
      `set A1 validation ${encodeRule(SC, rule)}`,
      "set A1 formula 2+2",
    ]);
    expect(sheet.cells.A1.formula).toBe("2+2");
  });
});

describe("data validation: enforcement precedence and outcome policy", () => {
  test("warn mode allows the commit to proceed (no client-side confirm in headless command replay)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "lt",
      bound1: 10,
      bound2: 0,
      allowBlank: true,
      mode: "warn",
    };
    await scheduleCommands(SC, sheet, [
      `set A1 validation ${encodeRule(SC, rule)}`,
      "set A1 value n 999",
    ]);
    // ExecuteSheetCommand only enforces reject; warn confirmation is a UI-layer concern
    // (EditorSaveEdit), so a directly-scheduled command always commits under warn.
    expect(sheet.cells.A1.datavalue).toBe(999);
  });

  test("date rule rejects out-of-range numeric-date values", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "date",
      op: "ge",
      bound1: 40000,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    await scheduleCommands(SC, sheet, "set A1 value n 10");
    expect(sheet.cells.A1.datavalue).toBe("");
    await scheduleCommands(SC, sheet, "set A1 value n 41000");
    expect(sheet.cells.A1.datavalue).toBe(41000);
  });

  test("textLength between op rejects out-of-range lengths", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "textLength",
      op: "between",
      bound1: 2,
      bound2: 5,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("x")}`);
    expect(sheet.cells.A1.datavalue).toBe("");
    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("abcd")}`);
    expect(sheet.cells.A1.datavalue).toBe("abcd");
  });

  test("custom formula rule rejects when the referenced formula evaluates falsy", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Custom rules are opaque booleans at the engine level; the ExecuteSheetCommand
    // enforcement path resolves them the same as number/date (via ComputeCustomPass
    // over rule.formula against the live sheet) — here rule.formula always evaluates
    // to a constant, verifying the wiring end-to-end.
    const passRule = { kind: "custom", formula: "1=1", allowBlank: false, mode: "reject" };
    const failRule = { kind: "custom", formula: "1=2", allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, passRule)}`);
    await scheduleCommands(SC, sheet, "set A1 value n 5");
    expect(sheet.cells.A1.datavalue).toBe(5);

    await scheduleCommands(SC, sheet, `set A2 validation ${encodeRule(SC, failRule)}`);
    await scheduleCommands(SC, sheet, "set A2 value n 5");
    expect(sheet.cells.A2.datavalue).toBe("");
  });
});

describe("data validation: cross-sheet / named-range list sources", () => {
  test("list rule with sourceRange resolves live values from a named range", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      `set B1 text t ${SC.encodeForSave("apple")}`,
      `set B2 text t ${SC.encodeForSave("banana")}`,
      "name define FRUITS B1:B2",
    ]);
    const rule = { kind: "list", sourceRange: "FRUITS", allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);

    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("cherry")}`);
    expect(sheet.cells.A1.datavalue).toBe("");

    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("banana")}`);
    expect(sheet.cells.A1.datavalue).toBe("banana");
  });

  test("list rule picks up edits to the source range without caching stale values", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [`set B1 text t ${SC.encodeForSave("apple")}`]);
    const rule = { kind: "list", sourceRange: "B1:B1", allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);

    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("kiwi")}`);
    expect(sheet.cells.A1.datavalue).toBe(""); // "kiwi" not in ["apple"]

    // change the source range's contents — the rule must re-resolve live
    await scheduleCommands(SC, sheet, `set B1 text t ${SC.encodeForSave("kiwi")}`);
    await scheduleCommands(SC, sheet, `set A1 text t ${SC.encodeForSave("kiwi")}`);
    expect(sheet.cells.A1.datavalue).toBe("kiwi");
  });

  test("number rule with formula-driven bound re-evaluates against current sheet state", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set B1 value n 10"]);
    const rule = {
      kind: "number",
      op: "le",
      bound1: "=B1",
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);

    await scheduleCommands(SC, sheet, "set A1 value n 15");
    expect(sheet.cells.A1.datavalue).toBe(""); // 15 > 10

    await scheduleCommands(SC, sheet, "set B1 value n 100"); // raise the bound
    await scheduleCommands(SC, sheet, "set A1 value n 15");
    expect(sheet.cells.A1.datavalue).toBe(15); // now 15 <= 100
  });
});

describe("data validation: persistence round-trip", () => {
  test("validation rule survives CreateSheetSave -> ParseSheetSave", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "between",
      bound1: 1,
      bound2: 10,
      allowBlank: true,
      mode: "warn",
    };
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      `set A1 validation ${encodeRule(SC, rule)}`,
    ]);
    const saved = sheet.CreateSheetSave();

    const sheet2 = new SC.Sheet();
    sheet2.ParseSheetSave(saved);
    expect(SC.DataValidation.DecodeRule(sheet2.cells.A1.validation)).toEqual(rule);
    expect(sheet2.cells.A1.datavalue).toBe(5);
  });

  test("list rule with literal values survives save/load with special characters escaped", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "list",
      values: ["a:b", "c\nd", "e\\f"],
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    const saved = sheet.CreateSheetSave();

    const sheet2 = new SC.Sheet();
    sheet2.ParseSheetSave(saved);
    expect(SC.DataValidation.DecodeRule(sheet2.cells.A1.validation)).toEqual(rule);
  });

  test("sheet with no validation rules round-trips unaffected (legacy save compatibility)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 value n 42"]);
    const saved = sheet.CreateSheetSave();
    expect(saved).not.toContain(":validation:");

    const sheet2 = new SC.Sheet();
    sheet2.ParseSheetSave(saved);
    expect(sheet2.cells.A1.validation).toBeUndefined();
  });

  test("ParseSheetSave tolerates a corrupt validation payload (fails open, no throw)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    sheet.ParseSheetSave(
      makeSave(["version:1.5", "cell:A1:v:5:validation:" + SC.encodeForSave("not json")]),
    );
    expect(sheet.cells.A1.datavalue).toBe(5);
    expect(SC.DataValidation.DecodeRule(sheet.cells.A1.validation)).toBeNull();
  });
});

describe("data validation: copy/paste and fill propagation", () => {
  test("copy/paste propagates the validation rule to the destination cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: 0,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, [
      "set A1 value n 5",
      `set A1 validation ${encodeRule(SC, rule)}`,
      "copy A1 all",
      "paste B1 all",
    ]);
    expect(SC.DataValidation.DecodeRule(sheet.cells.B1.validation)).toEqual(rule);
  });

  test("paste clears validation on the destination when the source cell had none", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: 0,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, [
      `set B1 validation ${encodeRule(SC, rule)}`,
      "set A1 value n 5", // A1 has no validation
      "copy A1 all",
      "paste B1 all",
    ]);
    expect(sheet.cells.B1.validation).toBeUndefined();
  });

  test("paste copies a corrupt (undecodable) validation payload verbatim instead of dropping it", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 text t ok"]);
    // Directly corrupt the source cell's stored validation payload -- not
    // reachable via the normal "set ... validation" command -- to exercise
    // the paste logic's DecodeRule-fails fallback: it must copy the raw
    // string through unchanged rather than dropping/crashing.
    sheet.cells.A1.validation = "not-decodable-json";
    await scheduleCommands(SC, sheet, ["copy A1 all", "paste B1 all"]);
    expect(sheet.cells.B1.validation).toBe("not-decodable-json");
  });

  test("filldown propagates a validation rule with an offset source-range reference", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [`set D1 text t ${SC.encodeForSave("ok")}`]);
    const rule = { kind: "list", sourceRange: "=D1", allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, [
      `set A1 text t ${SC.encodeForSave("ok")}`,
      `set A1 validation ${encodeRule(SC, rule)}`,
      "filldown A1:A3 all",
    ]);
    const a2rule = SC.DataValidation.DecodeRule(sheet.cells.A2.validation);
    expect(a2rule.sourceRange).toBe("=D2"); // offset by +1 row like a formula would be
    const a3rule = SC.DataValidation.DecodeRule(sheet.cells.A3.validation);
    expect(a3rule.sourceRange).toBe("=D3");
  });

  test("fill copies a corrupt (undecodable) validation payload verbatim instead of dropping it", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 text t ok"]);
    // Directly corrupt the source cell's stored validation payload (not
    // reachable via the normal "set ... validation" command, which always
    // writes a decodable JSON payload) to exercise the fill logic's
    // DecodeRule-fails fallback: it must copy the raw string through
    // unchanged rather than dropping/crashing.
    sheet.cells.A1.validation = "not-decodable-json";
    await scheduleCommands(SC, sheet, ["filldown A1:A2 all"]);
    expect(sheet.cells.A2.validation).toBe("not-decodable-json");
  });
});

describe("data validation: structural rewrites (insert/delete/move)", () => {
  test("insertrow above a formula-bound rule shifts the bound reference down", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set B2 value n 10"]);
    const rule = {
      kind: "number",
      op: "le",
      bound1: "=B2",
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, [`set A2 validation ${encodeRule(SC, rule)}`, "insertrow 1"]);
    // A2's rule (now at A3) should reference B3, not B2, after inserting a row above.
    const moved = SC.DataValidation.DecodeRule(sheet.cells.A3.validation);
    expect(moved.bound1).toBe("=B3");
  });

  test("deletecol containing the bound source turns the reference into #REF!", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set B1 value n 10"]);
    const rule = {
      kind: "number",
      op: "le",
      bound1: "=B1",
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, [`set A1 validation ${encodeRule(SC, rule)}`, "deletecol B"]);
    const after = SC.DataValidation.DecodeRule(sheet.cells.A1.validation);
    expect(after.bound1).toBe("=#REF!");
  });

  test("movepaste rewrites a validation sourceRange that pointed at the moved cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [`set B1 text t ${SC.encodeForSave("ok")}`]);
    const rule = { kind: "list", sourceRange: "=B1", allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, [
      `set A1 validation ${encodeRule(SC, rule)}`,
      "movepaste B1:B1 C1 all",
    ]);
    const after = SC.DataValidation.DecodeRule(sheet.cells.A1.validation);
    expect(after.sourceRange).toBe("=C1");
  });

  test("movepaste all copies the moved source cell's validation rule onto the target cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "number", op: "gt", bound1: 0, allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, [
      `set B1 validation ${encodeRule(SC, rule)}`,
      "movepaste B1:B1 C1 all",
    ]);
    const after = SC.DataValidation.DecodeRule(sheet.cells.C1.validation);
    expect(after).toEqual(rule);
  });

  test("insertrow leaves a corrupt (undecodable) validation payload on an existing cell unchanged", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A2 text t ok"]);
    sheet.cells.A2.validation = "not-decodable-json";
    await scheduleCommands(SC, sheet, ["insertrow 1"]);
    // A2's content (and its now-undecodable validation string) shifted
    // down to A3; DecodeRule failing on the corrupt payload must leave it
    // as-is rather than dropping it or crashing the structural rewrite.
    expect(sheet.cells.A3.validation).toBe("not-decodable-json");
  });

  test("movepaste all clears a target cell's validation rule when the moved source cell has none", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "number", op: "gt", bound1: 0, allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, [
      `set C1 validation ${encodeRule(SC, rule)}`,
      "set B1 value n 5",
      "movepaste B1:B1 C1 all",
    ]);
    expect(sheet.cells.C1.validation).toBeUndefined();
  });
});

describe("data validation: undo/redo", () => {
  test("undo/redo of set validation restores and reapplies the rule", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: 0,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, "set A1 value n 1");
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    expect(sheet.cells.A1.validation).toBeDefined();

    await sheetUndo(SC, sheet);
    expect(sheet.cells.A1.validation).toBeUndefined();

    await sheetRedo(SC, sheet);
    expect(SC.DataValidation.DecodeRule(sheet.cells.A1.validation)).toEqual(rule);
  });

  test("undo/redo of clearvalidation restores and re-clears the rule", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "list", values: ["x", "y"], allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, [
      "set A1 value n 1",
      `set A1 validation ${encodeRule(SC, rule)}`,
    ]);
    await scheduleCommands(SC, sheet, "set A1 clearvalidation");
    expect(sheet.cells.A1.validation).toBeUndefined();

    await sheetUndo(SC, sheet);
    expect(SC.DataValidation.DecodeRule(sheet.cells.A1.validation)).toEqual(rule);

    await sheetRedo(SC, sheet);
    expect(sheet.cells.A1.validation).toBeUndefined();
  });

  test("undo restores a rejected-then-blocked cell without validation double-blocking replay", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: 0,
      bound2: 0,
      allowBlank: true,
      mode: "reject",
    };
    await scheduleCommands(SC, sheet, "set A1 value n 5"); // valid, pre-rule
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    expect(sheet.cells.A1.datavalue).toBe(5);

    // Undo the "set A1 validation" step: this replays "set A1 clearvalidation"
    // (an internal restoration write) which must NOT be blocked by the very
    // rule it's removing — trusted-restoration bypass via the "all"/non-value
    // attrib boundary (see js/socialcalc-3.ts comment on the set-cell branch).
    await sheetUndo(SC, sheet);
    expect(sheet.cells.A1.validation).toBeUndefined();
    expect(sheet.cells.A1.datavalue).toBe(5); // untouched
  });
});

describe("data validation: load-from-save bypass (already-persisted invalid data)", () => {
  test("loading a save whose stored value violates its own validation rule does not erase it", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "le",
      bound1: 10,
      bound2: 0,
      allowBlank: false,
      mode: "reject",
    };
    // Directly construct a save where the persisted value (999) already
    // violates the persisted rule — simulating data from before the rule was
    // tightened. ParseSheetSave/CellFromStringParts must restore it verbatim;
    // only the interactive "set coord value/text/constant" commands enforce.
    const saved = makeSave([
      "version:1.5",
      "cell:A1:v:999:validation:" + SC.encodeForSave(SC.DataValidation.EncodeRule(rule)),
    ]);
    sheet.ParseSheetSave(saved);
    expect(sheet.cells.A1.datavalue).toBe(999);
    expect(SC.DataValidation.DecodeRule(sheet.cells.A1.validation)).toEqual(rule);
  });
});

describe("data validation: recalc integration", () => {
  test("custom-formula rule re-evaluates against fresh sheet state after a dependency recalcs", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set B1 value n 1"]);
    // custom rule checks B1=1 (opaque boolean formula, re-evaluated live — no caching)
    const rule = { kind: "custom", formula: "B1=1", allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);

    await scheduleCommands(SC, sheet, "set A1 value n 5");
    expect(sheet.cells.A1.datavalue).toBe(5); // B1=1 holds

    await scheduleCommands(SC, sheet, "set B1 value n 2");
    await recalcSheet(SC, sheet);
    await scheduleCommands(SC, sheet, "set A1 value n 6");
    expect(sheet.cells.A1.datavalue).toBe(5); // rejected: B1 no longer 1, prior 5 unchanged
  });
});

describe("data validation: DV.ComputeCustomPass / DV.EvaluateForCell direct API", () => {
  test("ComputeCustomPass fails closed (returns false) when the formula evaluator itself throws", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "custom", formula: "1=1", allowBlank: false, mode: "reject" };
    const original = SC.Formula.evaluate_parsed_formula;
    SC.Formula.evaluate_parsed_formula = () => {
      throw new Error("simulated evaluator failure");
    };
    try {
      expect(SC.DataValidation.ComputeCustomPass(sheet, rule)).toBe(false);
    } finally {
      SC.Formula.evaluate_parsed_formula = original;
    }
  });

  test("EvaluateForCell returns a pass outcome with no rule for an unvalidated cell", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, "set A1 value n 5");
    const info = SC.DataValidation.EvaluateForCell(sheet, "A1", "5");
    expect(info).toEqual({ outcome: "pass", rule: null });
  });

  test("EvaluateForCell evaluates a cell's own validation rule against a candidate raw value", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "number", op: "gt", bound1: 10, allowBlank: false, mode: "reject" };
    await scheduleCommands(SC, sheet, `set A1 validation ${encodeRule(SC, rule)}`);
    const passing = SC.DataValidation.EvaluateForCell(sheet, "A1", "20");
    expect(passing.outcome).toBe("pass");
    expect(passing.rule).toEqual(rule);
    const failing = SC.DataValidation.EvaluateForCell(sheet, "A1", "5");
    expect(failing.outcome).toBe("reject");
  });
});

describe("data validation: DV.DecodeRule payload-shape guards", () => {
  test("valid JSON that isn't an object (e.g. a bare number or string) decodes to null", async () => {
    const SC = await loadSocialCalc();
    expect(SC.DataValidation.DecodeRule("42")).toBeNull();
    expect(SC.DataValidation.DecodeRule('"just a string"')).toBeNull();
    expect(SC.DataValidation.DecodeRule("null")).toBeNull();
  });

  test("a JSON object with no 'kind' field, or a non-string 'kind', decodes to null", async () => {
    const SC = await loadSocialCalc();
    expect(SC.DataValidation.DecodeRule(JSON.stringify({ allowBlank: true }))).toBeNull();
    expect(SC.DataValidation.DecodeRule(JSON.stringify({ kind: 5 }))).toBeNull();
  });
});

describe("data validation: DV.ResolveBound formula-evaluation guard", () => {
  test("a formula bound whose evaluator throws resolves to invalid (fails closed)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const original = SC.Formula.ParseFormulaIntoTokens;
    SC.Formula.ParseFormulaIntoTokens = () => {
      throw new Error("simulated parse failure");
    };
    try {
      const resolved = SC.DataValidation.ResolveBound(sheet, "=A1");
      expect(resolved).toEqual({ value: 0, valid: false });
    } finally {
      SC.Formula.ParseFormulaIntoTokens = original;
    }
  });
});

describe("data validation: DV.ResolveListValues source-range parse guard", () => {
  test("an unparseable sourceRange resolves to an empty list instead of throwing", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "list",
      sourceRange: "not a valid range!!",
      allowBlank: false,
      mode: "reject",
    };
    expect(SC.DataValidation.ResolveListValues(sheet, rule)).toEqual([]);
  });
});

describe("data validation: DV.CompareOk exhaustive operator coverage", () => {
  test("every comparison operator's true and false side", async () => {
    const SC = await loadSocialCalc();
    const CompareOk = SC.DataValidation.CompareOk;
    // between
    expect(CompareOk("between", 5, 1, 10)).toBe(true);
    expect(CompareOk("between", 0, 1, 10)).toBe(false);
    // notBetween
    expect(CompareOk("notBetween", 0, 1, 10)).toBe(true);
    expect(CompareOk("notBetween", 11, 1, 10)).toBe(true);
    expect(CompareOk("notBetween", 5, 1, 10)).toBe(false);
    // eq / ne
    expect(CompareOk("eq", 5, 5, 0)).toBe(true);
    expect(CompareOk("eq", 5, 6, 0)).toBe(false);
    expect(CompareOk("ne", 5, 6, 0)).toBe(true);
    expect(CompareOk("ne", 5, 5, 0)).toBe(false);
    // gt / lt
    expect(CompareOk("gt", 5, 1, 0)).toBe(true);
    expect(CompareOk("gt", 1, 5, 0)).toBe(false);
    expect(CompareOk("lt", 1, 5, 0)).toBe(true);
    expect(CompareOk("lt", 5, 1, 0)).toBe(false);
    // ge / le
    expect(CompareOk("ge", 5, 5, 0)).toBe(true);
    expect(CompareOk("ge", 4, 5, 0)).toBe(false);
    expect(CompareOk("le", 5, 5, 0)).toBe(true);
    expect(CompareOk("le", 6, 5, 0)).toBe(false);
    // Unknown op falls through to the default false.
    expect(CompareOk("bogus-op", 5, 5, 5)).toBe(false);
  });
});

describe("data validation: DV.ComputeOutcome truth table", () => {
  test("all allowBlank/isBlank/checkPassed/mode combinations", async () => {
    const SC = await loadSocialCalc();
    const ComputeOutcome = SC.DataValidation.ComputeOutcome;
    // allowBlank + blank short-circuits to pass regardless of checkPassed/mode.
    expect(ComputeOutcome(true, true, false, "reject")).toBe("pass");
    expect(ComputeOutcome(true, true, false, "warn")).toBe("pass");
    // Not blank (or blank without allowBlank): checkPassed wins next.
    expect(ComputeOutcome(true, false, true, "reject")).toBe("pass");
    expect(ComputeOutcome(false, true, true, "reject")).toBe("pass");
    // Neither blank-pass nor checkPassed: mode decides.
    expect(ComputeOutcome(false, false, false, "warn")).toBe("warn");
    expect(ComputeOutcome(false, false, false, "reject")).toBe("reject");
    expect(ComputeOutcome(true, false, false, "reject")).toBe("reject");
  });
});

describe("data validation: DV.ResolveBound plain-string parsing", () => {
  test("a plain numeric string resolves via DetermineValueType's numeric path", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    expect(SC.DataValidation.ResolveBound(sheet, "42")).toEqual({ value: 42, valid: true });
  });

  test("a non-numeric plain string resolves to an invalid NaN result", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const resolved = SC.DataValidation.ResolveBound(sheet, "not a number");
    expect(resolved.valid).toBe(false);
    expect(Number.isNaN(resolved.value)).toBe(true);
  });

  test("a formula bound whose result is itself an error type resolves to invalid", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // "=1/0" evaluates to an error type ("e#DIV/0!").
    const resolved = SC.DataValidation.ResolveBound(sheet, "=1/0");
    expect(resolved.valid).toBe(false);
  });
});

describe("data validation: DV.ResolveListValues named-range source", () => {
  test("a sourceRange naming a defined range resolves through sheet.names", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, [
      "set A1 text t alpha",
      "set A2 text t beta",
      "name define MYLIST A1:A2",
    ]);
    const rule = { kind: "list", sourceRange: "MYLIST", allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.ResolveListValues(sheet, rule)).toEqual(["alpha", "beta"]);
  });

  test("a formula-prefixed sourceRange ('=A1:A2') strips the leading '=' before parsing", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 text t one", "set A2 text t two"]);
    const rule = { kind: "list", sourceRange: "=A1:A2", allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.ResolveListValues(sheet, rule)).toEqual(["one", "two"]);
  });
});

describe("data validation: DV.RuleCheckPassed textLength/number/date branches", () => {
  test("textLength rule with an invalid (unresolvable) bound1 fails closed", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "textLength",
      op: "le",
      bound1: "not a number",
      allowBlank: false,
      mode: "reject",
    };
    expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "hello")).toBe(false);
  });

  test("textLength rule defaults op to 'eq' when omitted", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "textLength", bound1: 5, allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "hello")).toBe(true);
    expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "hi")).toBe(false);
  });

  test("number rule rejects non-numeric raw input before touching bounds", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "number", op: "gt", bound1: 0, allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "not a number")).toBe(false);
  });

  test("number rule with an invalid bound1 fails closed even for numeric raw input", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = {
      kind: "number",
      op: "gt",
      bound1: "not a number",
      allowBlank: false,
      mode: "reject",
    };
    expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "5")).toBe(false);
  });

  test("number rule defaults op to 'eq' when omitted", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "number", bound1: 10, allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "10")).toBe(true);
    expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "11")).toBe(false);
  });
});

describe("data validation: DV.DefaultErrorMessage", () => {
  test("uses the rule's own errorMessage when present", async () => {
    const SC = await loadSocialCalc();
    const rule = {
      kind: "number",
      bound1: 0,
      allowBlank: false,
      mode: "reject",
      errorMessage: "Custom!",
    };
    expect(SC.DataValidation.DefaultErrorMessage(rule)).toBe("Custom!");
  });

  test("falls back to the shipping default message when no errorMessage is set", async () => {
    const SC = await loadSocialCalc();
    const rule = { kind: "number", bound1: 0, allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.DefaultErrorMessage(rule)).toBe(
      SC.Constants.s_dvDefaultError || "The value entered does not meet validation rules.",
    );
  });
});

describe("data validation: dvRewriteAllFields bound2 formula rewrite", () => {
  test("AdjustRuleCoords rewrites a formula-prefixed bound2 alongside bound1", async () => {
    const SC = await loadSocialCalc();
    const rule = {
      kind: "number",
      op: "between",
      bound1: "=B1",
      bound2: "=B2",
      allowBlank: false,
      mode: "reject",
    };
    const adjusted = SC.DataValidation.AdjustRuleCoords(rule, 1, 0, 1, 1);
    expect(adjusted.bound1).toBe("=B2");
    expect(adjusted.bound2).toBe("=B3");
  });
});

describe("data validation: DV.ResolveListValues with neither values nor sourceRange", () => {
  test("a list rule with no literal values and no sourceRange resolves to an empty list", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "list", allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.ResolveListValues(sheet, rule)).toEqual([]);
  });
});

describe("data validation: DV.ResolveListValues named range whose own definition is formula-prefixed", () => {
  test("a defined name with a '=' -prefixed definition is stripped before ParseRange", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    await scheduleCommands(SC, sheet, ["set A1 text t x", "set A2 text t y"]);
    // Defined names in SocialCalc store their definition with a leading "="
    // (formula-style), unlike a raw sourceRange string -- exercise that path
    // directly since `name define` always writes it that way.
    sheet.names["MYRANGE"] = { name: "MYRANGE", definition: "=A1:A2", desc: "" };
    const rule = { kind: "list", sourceRange: "MYRANGE", allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.ResolveListValues(sheet, rule)).toEqual(["x", "y"]);
  });
});

describe("data validation: DV.ComputeCustomPass direct API", () => {
  test("a custom rule with no formula passes trivially (nothing to fail)", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "custom", allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.ComputeCustomPass(sheet, rule)).toBe(true);
  });

  test("a custom formula that itself evaluates to an error type fails", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "custom", formula: "1/0", allowBlank: false, mode: "reject" };
    expect(SC.DataValidation.ComputeCustomPass(sheet, rule)).toBe(false);
  });
});

describe("data validation: DV.RuleCheckPassed NaN-after-DetermineValueType guard", () => {
  test("a raw value DetermineValueType calls numeric but Number() can't parse falls closed", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    const rule = { kind: "number", op: "gt", bound1: 0, allowBlank: false, mode: "reject" };
    const original = SC.DetermineValueType;
    SC.DetermineValueType = () => ({ type: "n", value: "not-actually-a-number" });
    try {
      expect(SC.DataValidation.RuleCheckPassed(sheet, rule, "whatever")).toBe(false);
    } finally {
      SC.DetermineValueType = original;
    }
  });
});

describe("data validation: DV.EvaluateForCell on a coordinate with no cell at all", () => {
  test("passes with no rule when the coordinate has never been touched", async () => {
    const SC = await loadSocialCalc();
    const sheet = new SC.Sheet();
    // Z99 was never set, so sheet.cells["Z99"] is undefined (distinct from
    // a cell that exists but carries no .validation).
    expect(sheet.cells.Z99).toBeUndefined();
    const info = SC.DataValidation.EvaluateForCell(sheet, "Z99", "anything");
    expect(info).toEqual({ outcome: "pass", rule: null });
  });
});

describe("data validation: DV.DefaultErrorMessage constant fallback", () => {
  test("falls back to the literal default string when s_dvDefaultError itself is unset", async () => {
    const SC = await loadSocialCalc();
    const rule = { kind: "number", bound1: 0, allowBlank: false, mode: "reject" };
    const original = SC.Constants.s_dvDefaultError;
    delete SC.Constants.s_dvDefaultError;
    try {
      expect(SC.DataValidation.DefaultErrorMessage(rule)).toBe(
        "The value entered does not meet validation rules.",
      );
    } finally {
      SC.Constants.s_dvDefaultError = original;
    }
  });
});

describe("data validation: dvRewriteAllFields sourceRange/formula rewrite branches", () => {
  test("AdjustRuleCoords rewrites a formula-prefixed sourceRange and a plain formula field together", async () => {
    const SC = await loadSocialCalc();
    const rule = {
      kind: "list",
      sourceRange: "=B1:B2",
      allowBlank: false,
      mode: "reject",
    };
    const adjusted = SC.DataValidation.AdjustRuleCoords(rule, 1, 0, 1, 1);
    expect(adjusted.sourceRange).toBe("=B2:B3");
  });

  test("AdjustRuleCoords rewrites a custom rule's formula field", async () => {
    const SC = await loadSocialCalc();
    const rule = { kind: "custom", formula: "B1=1", allowBlank: false, mode: "reject" };
    const adjusted = SC.DataValidation.AdjustRuleCoords(rule, 1, 0, 1, 1);
    expect(adjusted.formula).toBe("B2=1");
  });
});

describe("data validation: dvRewriteAllFields bare (non-formula-prefixed) sourceRange", () => {
  test("AdjustRuleCoords rewrites a bare sourceRange (no leading '=') without adding one", async () => {
    const SC = await loadSocialCalc();
    const rule = { kind: "list", sourceRange: "B1:B2", allowBlank: false, mode: "reject" };
    const adjusted = SC.DataValidation.AdjustRuleCoords(rule, 1, 0, 1, 1);
    expect(adjusted.sourceRange).toBe("B2:B3");
  });
});
