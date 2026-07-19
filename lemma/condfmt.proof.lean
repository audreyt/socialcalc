/-
  Hand-written Lean proofs for lemma/condfmt.ts (LemmaScript Lean backend).
  Generated: condfmt.types.lean, condfmt.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/condfmt.ts
-/
import «condfmt.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct isValidOp by
  unfold Pure.isValidOp; loom_solve

prove_correct matchesCellIs by
  unfold Pure.matchesCellIs; loom_solve

prove_correct isDuplicateValue by
  unfold Pure.isDuplicateValue; loom_solve

prove_correct isUniqueValue by
  unfold Pure.isUniqueValue; loom_solve

prove_correct shouldEvaluate by
  unfold Pure.shouldEvaluate; loom_solve

prove_correct nextStopped by
  unfold Pure.nextStopped; loom_solve

prove_correct ruleApplies by
  unfold Pure.ruleApplies; loom_solve

prove_correct mergeStyleField by
  unfold Pure.mergeStyleField; loom_solve
