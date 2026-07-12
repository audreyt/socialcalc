/-
  Hand-written Lean proofs for lemma/eval-ops.ts (LemmaScript Lean backend).
  Generated: eval-ops.types.lean, eval-ops.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/eval-ops.ts
-/
import «eval-ops.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct isErrorType by
  unfold Pure.isErrorType; loom_solve

prove_correct arithType by
  unfold Pure.arithType Pure.isErrorType; loom_solve

prove_correct divType by
  unfold Pure.divType Pure.arithType Pure.isErrorType; loom_solve

prove_correct concatType by
  unfold Pure.concatType Pure.isErrorType; loom_solve
