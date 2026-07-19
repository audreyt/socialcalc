/-
  Hand-written Lean proofs for lemma/branch.ts (LemmaScript Lean backend).
  Generated: branch.types.lean, branch.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/branch.ts
-/
import «branch.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct switchBranch by
  unfold Pure.switchBranch; loom_solve

prove_correct keepJoinItem by
  unfold Pure.keepJoinItem; loom_solve

prove_correct emitDelimiterBefore by
  unfold Pure.emitDelimiterBefore; loom_solve
