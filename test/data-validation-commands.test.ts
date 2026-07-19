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
