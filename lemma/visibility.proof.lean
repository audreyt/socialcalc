/-
  Hand-written Lean proofs for lemma/visibility.ts (LemmaScript Lean backend).
  Generated: visibility.types.lean, visibility.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/visibility.ts

  All seven policies are decidable propositional/order facts over Bool/Int;
  the default loom_solver (grind) closes every goal directly, so no custom
  solver override is needed (contrast lemma/spill.proof.lean's nlinarith
  addition for a nonlinear multiplication fact).
-/
import «visibility.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct isEffectivelyHidden by
  unfold Pure.isEffectivelyHidden; loom_solve

prove_correct manualHiddenAfterFilterClear by
  unfold Pure.manualHiddenAfterFilterClear; loom_solve

prove_correct filterHiddenAfterManualClear by
  unfold Pure.filterHiddenAfterManualClear; loom_solve

prove_correct recomputeFilterHidden by
  unfold Pure.recomputeFilterHidden; loom_solve

prove_correct recomputeIsIdempotent by
  unfold Pure.recomputeIsIdempotent Pure.recomputeFilterHidden; loom_solve

prove_correct isInFilterDataBand by
  unfold Pure.isInFilterDataBand; loom_solve

prove_correct outOfBandNeverFilterHidden by
  unfold Pure.outOfBandNeverFilterHidden; loom_solve
