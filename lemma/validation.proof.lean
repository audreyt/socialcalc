/-
  Hand-written Lean proofs for lemma/validation.ts (LemmaScript Lean backend).
  Generated: validation.types.lean, validation.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/validation.ts
-/
import «validation.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct isBlank by
  unfold Pure.isBlank; loom_solve

prove_correct compareOk by
  unfold Pure.compareOk; loom_solve

prove_correct computeOutcome by
  unfold Pure.computeOutcome; loom_solve
