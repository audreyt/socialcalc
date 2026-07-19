/-
  Hand-written Lean proofs for lemma/html-table.ts (LemmaScript Lean backend).
  Generated: html-table.types.lean, html-table.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/html-table.ts
-/
import «html-table.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct isValidSpan by
  unfold Pure.isValidSpan; loom_solve

prove_correct endCol by
  unfold Pure.endCol; loom_solve

prove_correct endRow by
  unfold Pure.endRow; loom_solve

prove_correct inRect by
  unfold Pure.inRect Pure.endCol Pure.endRow; loom_solve

prove_correct rectCellCount by
  unfold Pure.rectCellCount; loom_solve

prove_correct classifySlot by
  unfold Pure.classifySlot; loom_solve

prove_correct canPlaceRect by
  unfold Pure.canPlaceRect; loom_solve

prove_correct isWithinTableBounds by
  unfold Pure.isWithinTableBounds Pure.endCol Pure.endRow; loom_solve

prove_correct planTableStatus by
  unfold Pure.planTableStatus Pure.isValidSpan Pure.isWithinTableBounds
    Pure.endCol Pure.endRow
  loom_solve
