/-
  Hand-written Lean proofs for lemma/finance-policy.ts (LemmaScript Lean backend).
  Generated: finance-policy.types.lean, finance-policy.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/finance-policy.ts
-/
import «finance-policy.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct ClassifyPeriodDomain by
  unfold Pure.ClassifyPeriodDomain; loom_solve

prove_correct ClassifySignRequirement by
  unfold Pure.ClassifySignRequirement; loom_solve

prove_correct ClassifyDateAgainstAnchor by
  unfold Pure.ClassifyDateAgainstAnchor; loom_solve
