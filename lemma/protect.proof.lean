/-
  Hand-written Lean proofs for lemma/protect.ts (LemmaScript Lean backend).
  Generated: protect.types.lean, protect.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/protect.ts
-/
import «protect.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct isSheetProtected by
  unfold Pure.isSheetProtected; loom_solve

prove_correct isCellEditable by
  unfold Pure.isCellEditable; loom_solve
