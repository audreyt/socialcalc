/-
  Hand-written Lean proofs for lemma/xlookup.ts (LemmaScript Lean backend).
  Generated: xlookup.types.lean, xlookup.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/xlookup.ts
-/
import «xlookup.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct matchModeValidity by
  unfold Pure.matchModeValidity; loom_solve

prove_correct searchModeValidity by
  unfold Pure.searchModeValidity; loom_solve

prove_correct modeCombinationValidity by
  unfold Pure.modeCombinationValidity Pure.matchModeValidity Pure.searchModeValidity
  loom_solve

prove_correct matchOutcomeToResult by
  unfold Pure.matchOutcomeToResult; loom_solve

prove_correct matchModeAllowsApproximate by
  unfold Pure.matchModeAllowsApproximate; loom_solve

prove_correct classifyLookupOutcome by
  unfold Pure.classifyLookupOutcome Pure.matchModeAllowsApproximate; loom_solve

prove_correct resolveIfNotFound by
  unfold Pure.resolveIfNotFound; loom_solve
