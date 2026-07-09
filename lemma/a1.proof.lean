/-
  Hand-written Lean proofs for lemma/a1.ts (LemmaScript Lean backend).
  Generated files: a1.types.lean, a1.def.lean — do not edit those; re-run
  `bun run verify:lean:gen`.
-/
import «a1.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

-- Pure clamp helpers: bodies are already Pure.clamp* mirrors.
prove_correct clampCol by
  unfold Pure.clampCol; loom_solve

prove_correct clampRow by
  unfold Pure.clampRow; loom_solve

-- Column/coord builders are Velvet methods (imperative). Scaffold goals so
-- `lake build` exercises the LemmaScript/Loom/Velvet stack; expand proofs as needed.
prove_correct rcColname by
  loom_goals_intro
  all_goals sorry

prove_correct crToCoord by
  loom_goals_intro
  all_goals sorry
