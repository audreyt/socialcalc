/-
  Hand-written Lean proofs for lemma/workbook.ts (LemmaScript Lean backend).
  Generated: workbook.types.lean, workbook.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/workbook.ts

  Every verified function here is pure integer/boolean arithmetic (no
  LETTERS-dependent string lemmas, unlike a1.ts), so no workbook.spec.lean
  is needed — this mirrors the spill.proof.lean / eval-ops.proof.lean /
  lookup-result.proof.lean precedent (import the generated def directly).
-/
import «workbook.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct validateSheetName by
  unfold Pure.validateSheetName; loom_solve

prove_correct isNameAccepted by
  unfold Pure.isNameAccepted; loom_solve

prove_correct canHideAnotherSheet by
  unfold Pure.canHideAnotherSheet; loom_solve

prove_correct canDeleteAnotherSheet by
  unfold Pure.canDeleteAnotherSheet; loom_solve

prove_correct clampIndex by
  unfold Pure.clampIndex; loom_solve

prove_correct activeIndexAfterDelete by
  unfold Pure.activeIndexAfterDelete Pure.clampIndex; loom_solve

prove_correct activeIndexAfterHide by
  unfold Pure.activeIndexAfterHide; loom_solve

prove_correct reorderTargetIndex by
  unfold Pure.reorderTargetIndex Pure.clampIndex; loom_solve

prove_correct classifyReferenceRewrite by
  unfold Pure.classifyReferenceRewrite; loom_solve
