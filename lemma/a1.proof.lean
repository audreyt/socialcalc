/-
  Hand-written Lean proofs for lemma/a1.ts (LemmaScript Lean backend).
  Generated: a1.types.lean, a1.def.lean — re-run `bun run verify:lean:gen`.

  Pure helpers (Pure.* mirrors) are intended for loom_solve.
  Imperative Velvet methods stay open until verify:lean:build is green.
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

prove_correct rcColname by
  loom_goals_intro
  all_goals sorry

prove_correct crToCoord by
  loom_goals_intro
  all_goals sorry

prove_correct offsetRelativeA1 by
  loom_goals_intro
  all_goals sorry
