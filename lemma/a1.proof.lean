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

-- Imperative string builders: open goals for later Leanstral / lake work.
prove_correct rcColname by
  loom_goals_intro
  all_goals sorry

prove_correct crToCoord by
  loom_goals_intro
  all_goals sorry

prove_correct offsetRelativeA1 by
  loom_goals_intro
  all_goals sorry

prove_correct formatA1Parts by
  loom_goals_intro
  all_goals sorry

prove_correct offsetA1 by
  loom_goals_intro
  all_goals sorry

prove_correct adjustA1 by
  loom_goals_intro
  all_goals sorry
