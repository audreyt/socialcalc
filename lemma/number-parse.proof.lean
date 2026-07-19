/-
  Hand-written Lean proofs for lemma/number-parse.ts (LemmaScript Lean backend).
  Generated: number-parse.types.lean, number-parse.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/number-parse.ts
-/
import «number-parse.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct groupingCharFor by
  unfold Pure.groupingCharFor; loom_solve

prove_correct isAsciiDigit by
  unfold Pure.isAsciiDigit; loom_solve

prove_correct isNameChar by
  unfold Pure.isNameChar; loom_solve
