import «a1.spec»
/-
  Hand-written Lean proofs for lemma/a1.ts (LemmaScript Lean backend).
  Generated: a1.types.lean, a1.def.lean — re-run `bun run verify:lean:gen`.
-/
import «a1.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

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
