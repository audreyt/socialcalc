/-
  Hand-written Lean proofs for lemma/lambda-scope.ts (LemmaScript Lean backend).
  Generated: lambda-scope.types.lean, lambda-scope.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/lambda-scope.ts
-/
import «lambda-scope.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct classifyArity by
  unfold Pure.classifyArity; loom_solve

prove_correct resolveScopeIndex by
  loom_solve

prove_correct recursionStatus by
  unfold Pure.recursionStatus; loom_solve

prove_correct shapesMatch by
  unfold Pure.shapesMatch; loom_solve

prove_correct isValidRectShape by
  unfold Pure.isValidRectShape; loom_solve
