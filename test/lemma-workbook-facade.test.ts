import { describe, expect, test } from "vite-plus/test";

import {
  MAX_SHEET_NAME_LENGTH,
  MIN_VISIBLE_SHEETS,
  NAME_DUPLICATE,
  NAME_EMPTY,
  NAME_INVALID_CHARS,
  NAME_OK,
  NAME_TOO_LONG,
  NO_INDEX,
  REF_BROKEN,
  REF_RENAMED,
  REF_UNCHANGED,
  activeIndexAfterDelete,
  activeIndexAfterHide,
  canDeleteAnotherSheet,
  canHideAnotherSheet,
  classifyReferenceRewrite,
  clampIndex,
  computeSheetNameValidation,
  isNameAccepted,
  reorderTargetIndex,
  validateSheetName,
} from "../lemma/workbook";

import { loadSocialCalc } from "./helpers/socialcalc";

describe("lemma/workbook name validation precedence (Dafny/Lean surface)", () => {
  test("validateSheetName: empty wins over every other violation", () => {
    expect(validateSheetName(true, true, true, true)).toBe(NAME_EMPTY);
  });

  test("validateSheetName: too-long wins over invalid-chars/duplicate", () => {
    expect(validateSheetName(false, true, true, true)).toBe(NAME_TOO_LONG);
  });

  test("validateSheetName: invalid-chars wins over duplicate", () => {
    expect(validateSheetName(false, false, true, true)).toBe(NAME_INVALID_CHARS);
  });

  test("validateSheetName: duplicate only fires when nothing else is wrong", () => {
    expect(validateSheetName(false, false, false, true)).toBe(NAME_DUPLICATE);
  });

  test("validateSheetName: OK iff every predicate is false", () => {
    expect(validateSheetName(false, false, false, false)).toBe(NAME_OK);
  });

  test("isNameAccepted matches OK code exactly", () => {
    expect(isNameAccepted(NAME_OK)).toBe(true);
    expect(isNameAccepted(NAME_EMPTY)).toBe(false);
    expect(isNameAccepted(NAME_DUPLICATE)).toBe(false);
  });

  test("computeSheetNameValidation bridge: case/whitespace-insensitive duplicate detection", () => {
    expect(computeSheetNameValidation("Sheet1", ["sheet1"])).toBe(NAME_DUPLICATE);
    expect(computeSheetNameValidation("  Sheet2  ", ["sheet1"])).toBe(NAME_OK);
    expect(computeSheetNameValidation("   ", [])).toBe(NAME_EMPTY);
    expect(computeSheetNameValidation("Bad:Name", [])).toBe(NAME_INVALID_CHARS);
    expect(computeSheetNameValidation("Sheet!1", [])).toBe(NAME_INVALID_CHARS);
    expect(computeSheetNameValidation("a".repeat(MAX_SHEET_NAME_LENGTH + 1), [])).toBe(
      NAME_TOO_LONG,
    );
    expect(computeSheetNameValidation("a".repeat(MAX_SHEET_NAME_LENGTH), [])).toBe(NAME_OK);
  });
});

describe("lemma/workbook visible-sheet-count invariant", () => {
  test("canHideAnotherSheet requires more than the minimum visible", () => {
    expect(canHideAnotherSheet(MIN_VISIBLE_SHEETS)).toBe(false);
    expect(canHideAnotherSheet(MIN_VISIBLE_SHEETS + 1)).toBe(true);
    expect(canHideAnotherSheet(0)).toBe(false);
  });

  test("canDeleteAnotherSheet requires more than one total sheet", () => {
    expect(canDeleteAnotherSheet(1)).toBe(false);
    expect(canDeleteAnotherSheet(2)).toBe(true);
  });
});

describe("lemma/workbook active-sheet reselection (pure index arithmetic)", () => {
  test("clampIndex handles empty, negative, and overflow", () => {
    expect(clampIndex(0, 0)).toBe(NO_INDEX);
    expect(clampIndex(-5, 3)).toBe(0);
    expect(clampIndex(99, 3)).toBe(2);
    expect(clampIndex(1, 3)).toBe(1);
  });

  test("activeIndexAfterDelete: deleting before active shifts it down", () => {
    // [A,B,C,D], active=C (index 2), delete B (index 1) -> C is now at index 1.
    expect(activeIndexAfterDelete(1, 2, 4)).toBe(1);
  });

  test("activeIndexAfterDelete: deleting after active leaves it in place", () => {
    // [A,B,C,D], active=B (index 1), delete D (index 3) -> B stays at index 1.
    expect(activeIndexAfterDelete(3, 1, 4)).toBe(1);
  });

  test("activeIndexAfterDelete: deleting the active sheet keeps the same slot (next sheet slides in)", () => {
    // [A,B,C], active=B (index 1), delete B -> new active slot is index 1 (was C).
    expect(activeIndexAfterDelete(1, 1, 3)).toBe(1);
    // Deleting the LAST sheet while it's active clamps into the new last index.
    expect(activeIndexAfterDelete(2, 2, 3)).toBe(1);
  });

  test("activeIndexAfterDelete: deleting the only sheet yields NO_INDEX", () => {
    expect(activeIndexAfterDelete(0, 0, 1)).toBe(NO_INDEX);
  });

  test("activeIndexAfterHide: prefers next visible, falls back to previous, else NO_INDEX", () => {
    expect(activeIndexAfterHide(3, 1)).toBe(3);
    expect(activeIndexAfterHide(-1, 1)).toBe(1);
    expect(activeIndexAfterHide(-1, -1)).toBe(NO_INDEX);
  });
});

describe("lemma/workbook reorder target clamping", () => {
  test("reorderTargetIndex clamps into [0,count-1]; empty workbook yields NO_INDEX", () => {
    expect(reorderTargetIndex(-3, 5)).toBe(0);
    expect(reorderTargetIndex(99, 5)).toBe(4);
    expect(reorderTargetIndex(2, 5)).toBe(2);
    expect(reorderTargetIndex(0, 0)).toBe(NO_INDEX);
  });
});

describe("lemma/workbook rename/delete reference-rewrite classification", () => {
  test("unrelated references are always unchanged regardless of operation kind", () => {
    expect(classifyReferenceRewrite(false, true)).toBe(REF_UNCHANGED);
    expect(classifyReferenceRewrite(false, false)).toBe(REF_UNCHANGED);
  });

  test("references to the affected sheet: rename rewrites, delete breaks", () => {
    expect(classifyReferenceRewrite(true, false)).toBe(REF_RENAMED);
    expect(classifyReferenceRewrite(true, true)).toBe(REF_BROKEN);
  });
});

describe("lemma/workbook vs shipping SC.Workbook helpers", () => {
  test("shipping WorkbookNameValidation codes match the facade's documented constants", async () => {
    const SC = await loadSocialCalc();
    expect(SC.WorkbookNameValidation.OK).toBe(NAME_OK);
    expect(SC.WorkbookNameValidation.EMPTY).toBe(NAME_EMPTY);
    expect(SC.WorkbookNameValidation.TOO_LONG).toBe(NAME_TOO_LONG);
    expect(SC.WorkbookNameValidation.INVALID_CHARS).toBe(NAME_INVALID_CHARS);
    expect(SC.WorkbookNameValidation.DUPLICATE).toBe(NAME_DUPLICATE);
    expect(SC.WorkbookMaxSheetNameLength).toBe(MAX_SHEET_NAME_LENGTH);
  });

  test("shipping WorkbookCanHideAnotherSheet/WorkbookCanDeleteAnotherSheet match the facade exhaustively", async () => {
    const SC = await loadSocialCalc();
    for (let count = 0; count <= 5; count++) {
      expect(SC.WorkbookCanHideAnotherSheet(count)).toBe(canHideAnotherSheet(count));
      expect(SC.WorkbookCanDeleteAnotherSheet(count)).toBe(canDeleteAnotherSheet(count));
    }
  });

  test("shipping WorkbookValidateSheetName agrees with computeSheetNameValidation across representative inputs", async () => {
    const SC = await loadSocialCalc();
    const wb = new SC.Workbook();
    wb.AddSheet("Sheet1");
    wb.AddSheet("Data");

    const existingNames = wb.sheetOrder;
    const candidates = [
      "Sheet1",
      "sheet1",
      "  Data  ",
      "NewSheet",
      "",
      "   ",
      "Bad:Name",
      "a".repeat(300),
    ];

    for (const candidate of candidates) {
      const shippingCode = SC.WorkbookValidateSheetName(wb, candidate);
      const facadeCode = computeSheetNameValidation(candidate, existingNames);
      expect(shippingCode).toBe(facadeCode);
    }
  });

  test("shipping WorkbookValidateSheetName excludeKey (rename to same name) matches facade duplicate-exclusion semantics", async () => {
    const SC = await loadSocialCalc();
    const wb = new SC.Workbook();
    wb.AddSheet("Sheet1");
    wb.AddSheet("Sheet2");

    const key = SC.WorkbookNormalizeSheetName("Sheet1");
    // Renaming Sheet1 to its own (trimmed/cased) name must be OK when excluded.
    expect(SC.WorkbookValidateSheetName(wb, "Sheet1", key)).toBe(SC.WorkbookNameValidation.OK);
    // Without the exclusion it is correctly flagged duplicate.
    expect(SC.WorkbookValidateSheetName(wb, "Sheet1")).toBe(SC.WorkbookNameValidation.DUPLICATE);
    // Renaming Sheet1 to Sheet2's name is still a duplicate even with Sheet1 excluded.
    expect(SC.WorkbookValidateSheetName(wb, "Sheet2", key)).toBe(
      SC.WorkbookNameValidation.DUPLICATE,
    );
  });
});
