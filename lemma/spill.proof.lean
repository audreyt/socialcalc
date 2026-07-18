import Mathlib.Tactic.Linarith
/-
  Hand-written Lean proofs for lemma/spill.ts (LemmaScript Lean backend).
  Generated: spill.types.lean, spill.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/spill.ts

  planSpillStatus's success branch entails `spillCellCount(rows, cols) > 0`
  from `rows > 0 ∧ cols > 0`, a nonlinear fact (`rows*cols > 0`) the default
  loom_solver (grind) does not close. A local solver override adds nlinarith
  as a fallback, matching the documented custom-solver pattern (Velvet docs
  "Custom Solver (Advanced)"; CaseStudies/Cashmere/Syntax_Cashmere.lean uses
  the same technique for its own arithmetic goals). Scoped to this file only.
-/
import «spill.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

macro_rules
  | `(tactic|loom_solver) =>
    `(tactic|(
      try grind
      try nlinarith
      try aesop))

prove_correct isValidShape by
  unfold Pure.isValidShape; loom_solve

prove_correct endCol by
  unfold Pure.endCol; loom_solve

prove_correct endRow by
  unfold Pure.endRow; loom_solve

prove_correct isWithinBounds by
  unfold Pure.isWithinBounds Pure.endCol Pure.endRow; loom_solve

prove_correct spillCellCount by
  unfold Pure.spillCellCount; loom_solve

prove_correct isWithinBudget by
  unfold Pure.isWithinBudget Pure.spillCellCount; loom_solve

prove_correct planSpillStatus by
  unfold Pure.planSpillStatus Pure.isValidShape Pure.isWithinBounds Pure.isWithinBudget
    Pure.endCol Pure.endRow Pure.spillCellCount
  loom_solve

prove_correct classifySpillClaim by
  unfold Pure.classifySpillClaim; loom_solve

prove_correct inSpillRect by
  unfold Pure.inSpillRect Pure.endCol Pure.endRow; loom_solve

prove_correct classifyResizeMembership by
  unfold Pure.classifyResizeMembership; loom_solve

prove_correct resizeAction by
  unfold Pure.resizeAction; loom_solve

prove_correct isFirstOccurrenceAt by
  unfold Pure.isFirstOccurrenceAt; loom_solve

prove_correct occursExactlyOnce by
  unfold Pure.occursExactlyOnce; loom_solve

prove_correct keepUniqueRow by
  unfold Pure.keepUniqueRow Pure.isFirstOccurrenceAt Pure.occursExactlyOnce; loom_solve

prove_correct stableCompare by
  unfold Pure.stableCompare; loom_solve
