use formula_ref_core::{adjust_formula_coords, offset_formula_coords, replace_formula_coords};

#[test]
fn offset_preserves_strings_and_shifts_refs() {
    assert_eq!(
        offset_formula_coords("CONCATENATE(\"A1 should stay\",A1)", 1, 2),
        "CONCATENATE(\"A1 should stay\",B3)",
    );
}

#[test]
fn offset_matches_cross_sheet_current_behavior() {
    assert_eq!(offset_formula_coords("Sheet2!A1+B1", 1, 0), "SHEET2!B1+C1");
}

#[test]
fn adjust_skips_cross_sheet_refs_but_shifts_local_refs() {
    assert_eq!(adjust_formula_coords("Sheet2!A1+B1", 1, 2, 1, 0), "SHEET2!A1+D1");
}

#[test]
fn replace_skips_cross_sheet_refs_but_replaces_local_refs() {
    assert_eq!(
        replace_formula_coords(
            "Sheet2!A1+B1",
            &[("A1".to_string(), "C3".to_string()), ("B1".to_string(), "D4".to_string())],
        ),
        "SHEET2!A1+D4",
    );
}

#[test]
fn absolute_markers_and_deleted_refs_match_socialcalc() {
    assert_eq!(offset_formula_coords("$A1+A$1+$A$1", 2, 2), "$A3+C$1+$A$1");
    assert_eq!(adjust_formula_coords("B1+C1", 2, -1, 1, 0), "#REF!+B1");
    assert_eq!(
        replace_formula_coords(
            "$A1+A$2",
            &[("A1".to_string(), "B5".to_string()), ("A2".to_string(), "B6".to_string())],
        ),
        "$B5+B$6",
    );
}

#[test]
fn whole_column_names_are_not_rewritten() {
    assert_eq!(offset_formula_coords("SUM(N:N)+SUM(T:T)", 1, 0), "SUM(N:N)+SUM(T:T)");
    assert_eq!(offset_formula_coords("SUM(AA:AA)+AA1", 1, 0), "SUM(AA:AA)+AB1");
}

#[test]
fn doubled_quotes_are_preserved() {
    assert_eq!(
        offset_formula_coords("CONCATENATE(\"a\"\"b\"\"c\",A1)", 1, 0),
        "CONCATENATE(\"a\"\"b\"\"c\",B1)",
    );
}