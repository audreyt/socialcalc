/-
  Hand-written Lean proofs for lemma/criteria.ts (LemmaScript Lean backend).
  Generated: criteria.types.lean, criteria.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/criteria.ts
-/
import «criteria.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct nextErrorState by
  unfold Pure.nextErrorState; loom_solve

prove_correct nextMax by
  unfold Pure.nextMax; loom_solve

prove_correct nextMin by
  unfold Pure.nextMin; loom_solve

prove_correct shapesMatch by
  unfold Pure.shapesMatch; loom_solve

prove_correct resultDecision by
  unfold Pure.resultDecision; loom_solve
