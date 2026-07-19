import Mathlib.Tactic.Linarith
/-
  Hand-written Lean proofs for lemma/pivot.ts (LemmaScript Lean backend).
  Generated: pivot.types.lean, pivot.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/pivot.ts

  planPivotStatus's success branch entails `rows > 0 ∧ cols > 0` from
  isValidPivotShape, and aggregateStatus/nextSum/nextMin/nextMax carry
  integer arithmetic side conditions. The default loom_solver (grind) does
  not always close these; a local solver override adds nlinarith as a
  fallback, mirroring the same technique already used in spill.proof.lean
  (Velvet docs "Custom Solver (Advanced)"; CaseStudies/Cashmere uses the
  same pattern for its own arithmetic goals). Scoped to this file only.
-/
import «pivot.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

macro_rules
  | `(tactic|loom_solver) =>
    `(tactic|(
      try grind
      try nlinarith
      try aesop))

prove_correct typeRank by
  unfold Pure.typeRank; loom_solve

prove_correct compareGroupKey by
  unfold Pure.compareGroupKey; loom_solve

prove_correct isNumericType by
  unfold Pure.isNumericType; loom_solve

prove_correct isBlankType by
  unfold Pure.isBlankType; loom_solve

prove_correct aggregateContributesNumeric by
  unfold Pure.aggregateContributesNumeric Pure.isNumericType; loom_solve

prove_correct aggregateContributesCountA by
  unfold Pure.aggregateContributesCountA Pure.isBlankType; loom_solve

prove_correct aggregateContributes by
  unfold Pure.aggregateContributes Pure.aggregateContributesCountA
    Pure.aggregateContributesNumeric Pure.isBlankType Pure.isNumericType
  loom_solve

prove_correct nextSum by
  unfold Pure.nextSum; loom_solve

prove_correct nextCount by
  unfold Pure.nextCount; loom_solve

prove_correct nextMin by
  unfold Pure.nextMin; loom_solve

prove_correct nextMax by
  unfold Pure.nextMax; loom_solve

prove_correct aggregateStatus by
  unfold Pure.aggregateStatus; loom_solve

prove_correct isValidPivotShape by
  unfold Pure.isValidPivotShape; loom_solve

prove_correct pivotEndCol by
  unfold Pure.pivotEndCol; loom_solve

prove_correct pivotEndRow by
  unfold Pure.pivotEndRow; loom_solve

prove_correct isPivotWithinBounds by
  unfold Pure.isPivotWithinBounds Pure.pivotEndCol Pure.pivotEndRow; loom_solve

prove_correct pivotCellCount by
  unfold Pure.pivotCellCount; loom_solve

prove_correct isPivotWithinBudget by
  unfold Pure.isPivotWithinBudget Pure.pivotCellCount; loom_solve

prove_correct planPivotStatus by
  unfold Pure.planPivotStatus Pure.isValidPivotShape Pure.isPivotWithinBounds
    Pure.isPivotWithinBudget Pure.pivotEndCol Pure.pivotEndRow
  loom_solve

prove_correct classifyPivotClaim by
  unfold Pure.classifyPivotClaim; loom_solve
