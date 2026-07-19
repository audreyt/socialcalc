import Mathlib.Tactic.IntervalCases
import «a1.spec»
/-
  Hand-written Lean proofs for lemma/a1.ts (LemmaScript Lean backend).
  Generated: a1.types.lean, a1.def.lean — re-run `vp run verify:lean:gen`.
  LETTERS lemmas live here (not a1.spec) so a1.def can import a1.spec
  without a build cycle after regen.
-/
import «a1.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

@[simp]
theorem letters_len {i : Nat} (hi : i < 26) : (LETTERS[i]!).length = 1 := by
  have h : i < 26 := hi
  interval_cases i <;> norm_num [LETTERS] <;> decide

@[simp]
theorem letters_tmod_len (c : Int) (hc1 : 1 ≤ c) (hc2 : c ≤ 702) :
    (LETTERS[((c - 1).tmod 26).toNat]!).length = 1 := by
  apply letters_len
  have h0 : c - 1 ≥ 0 := by omega
  have h1 : (c - 1).tmod 26 < 26 := Int.tmod_lt_of_pos (c - 1) (by decide)
  have h2 : (c - 1).tmod 26 ≥ 0 := Int.tmod_nonneg 26 h0
  have h3 : ((c - 1).tmod 26).toNat = (c - 1).tmod 26 := by
    rw [Int.toNat_of_nonneg h2]
  omega

@[simp]
theorem letters_colhigh_minus1_len (c : Int) (hc1 : 1 ≤ c) (hc2 : c ≤ 702) :
    (LETTERS[((c - 1) / 26 - 1).toNat]!).length = 1 := by
  apply letters_len
  have h0 : (c - 1) / 26 ≤ 26 := by
    rw [Int.ediv_le_iff_le_mul (by decide)]
    omega
  have h3 : (c - 1) / 26 - 1 < 26 := by omega
  have h4 : ((c - 1) / 26 - 1).toNat < 26 := by
    rw [Int.toNat_lt_of_ne_zero (by decide)]
    exact h3
  exact h4

prove_correct clampCol by
  unfold Pure.clampCol; loom_solve

prove_correct clampRow by
  unfold Pure.clampRow; loom_solve

prove_correct isColInBounds by
  unfold Pure.isColInBounds; loom_solve

prove_correct isRowInBounds by
  unfold Pure.isRowInBounds; loom_solve

prove_correct offsetCol by
  unfold Pure.offsetCol; loom_solve

prove_correct offsetRow by
  unfold Pure.offsetRow; loom_solve

prove_correct applyAxisOffset by
  unfold Pure.applyAxisOffset Pure.offsetCol Pure.offsetRow; loom_solve

prove_correct composeOffsets by
  unfold Pure.composeOffsets; loom_solve

prove_correct wouldOffsetRef by
  unfold Pure.wouldOffsetRef Pure.offsetCol Pure.offsetRow; loom_solve

prove_correct offsetA1Parts by
  unfold Pure.offsetA1Parts Pure.applyAxisOffset Pure.offsetCol Pure.offsetRow Pure.isColInBounds Pure.isRowInBounds
  loom_solve

prove_correct wouldOffsetA1Ref by
  unfold Pure.wouldOffsetA1Ref Pure.offsetA1Parts Pure.applyAxisOffset Pure.offsetCol Pure.offsetRow Pure.isColInBounds Pure.isRowInBounds
  loom_solve
prove_correct adjustAxis by
  unfold Pure.adjustAxis; loom_solve

prove_correct wouldAdjustRef by
  unfold Pure.wouldAdjustRef Pure.adjustAxis; loom_solve

prove_correct colFromRcRanks by
  unfold Pure.colFromRcRanks; loom_solve

prove_correct colToRcRanks by
  unfold Pure.colToRcRanks Pure.clampCol
  loom_solve
  all_goals (try {
    have h0 : ((if c < 1 then 1 else if c > 702 then 702 else c) - 1) ≥ 0 := by
      split_ifs <;> omega
    have hmod_nonneg : ((if c < 1 then 1 else if c > 702 then 702 else c) - 1).tmod 26 ≥ 0 :=
      Int.tmod_nonneg 26 h0
    have hmod_lt : ((if c < 1 then 1 else if c > 702 then 702 else c) - 1).tmod 26 < 26 :=
      Int.tmod_lt_of_pos _ (by decide)
    omega
  })

prove_correct rcColname by
  loom_solve
  all_goals (try rw [String.length_append])
  all_goals (try rw [letters_tmod_len])
  all_goals (try rw [letters_colhigh_minus1_len])
  all_goals (try { omega })

prove_correct crToCoord by
  loom_solve
  all_goals (try rw [String.length_append])
  all_goals (try rw [String.length_append])
  all_goals (try rw [letters_tmod_len])
  all_goals (try rw [letters_colhigh_minus1_len])
  all_goals (try { omega })
  all_goals (try {
    have hrow1 : (toString (1 : Int)).length ≥ 1 := by
      apply Int.toString_len_of_nonneg
      all_goals norm_num
    omega
  })
  all_goals (try {
    have hrow : (toString r).length ≥ 1 := by
      apply Int.toString_len_of_nonneg
      all_goals omega
    omega
  })

prove_correct offsetRelativeA1 by
  unfold offsetCol offsetRow crToCoord Pure.wouldOffsetRef
  loom_solve
  all_goals (try { native_decide })
  all_goals (try rw [String.length_append])
  all_goals (try rw [String.length_append])
  all_goals (try rw [letters_tmod_len])
  all_goals (try rw [letters_colhigh_minus1_len])
  all_goals (try { omega })
  all_goals (try {
    have hrow1 : (toString (1 : Int)).length ≥ 1 := by
      apply Int.toString_len_of_nonneg
      all_goals norm_num
    omega
  })
  all_goals (try {
    have hrow2 : (toString (Pure.offsetRow row rowoffset)).length ≥ 1 := by
      apply Int.toString_len_of_nonneg
      all_goals omega
    omega
  })

prove_correct formatA1Parts by
  unfold isColInBounds isRowInBounds rcColname Pure.isColInBounds Pure.isRowInBounds
  loom_solve
  all_goals (try { native_decide })
  all_goals (try rw [String.length_append])
  all_goals (try rw [String.length_append])
  all_goals (try rw [String.length_append])
  all_goals (try rw [String.length_append])
  all_goals (try rw [letters_tmod_len])
  all_goals (try rw [letters_colhigh_minus1_len])
  all_goals (try rw [dollar_len])
  all_goals (try {
    have hrow : (toString row).length ≥ 1 := by
      apply Int.toString_len_of_nonneg
      by_contra h
      have h2 : decide (row ≥ 1) = false := by
        rw [decide_eq_false_iff_not]
        omega
      simp [h2, Bool.not_false, Bool.or_true] at if_neg
    omega
  })

prove_correct offsetA1 by
  loom_solve
  all_goals (try { native_decide })

prove_correct adjustA1 by
  -- Keep formatA1Parts folded so its |res| ≥ 2 ensure discharges the goal.
  unfold adjustAxis Pure.wouldAdjustRef Pure.adjustAxis
  loom_solve
  all_goals (try { native_decide })

prove_correct offsetRectangle by
  unfold Pure.offsetRectangle; loom_solve

prove_correct wouldOffsetRectangleRef by
  unfold Pure.wouldOffsetRectangleRef Pure.offsetRectangle; loom_solve
