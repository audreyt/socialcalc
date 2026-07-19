/-
  Hand-written Lean proofs for lemma/statistics.ts (LemmaScript Lean backend).
  Generated: statistics.types.lean, statistics.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/statistics.ts
-/
import «statistics.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct doubledAverageRank by
  unfold Pure.doubledAverageRank; loom_solve

prove_correct quartileExcScaledPosition by
  unfold Pure.quartileExcScaledPosition; loom_solve

prove_correct isValidQuartileExcPosition by
  unfold Pure.isValidQuartileExcPosition Pure.quartileExcScaledPosition; loom_solve
