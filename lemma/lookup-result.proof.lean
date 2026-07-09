/-
  Hand-written Lean proofs for lemma/lookup-result.ts (LemmaScript Lean backend).
  Generated: lookup-result.types.lean, lookup-result.def.lean — re-run:
    bunx lsc gen --backend=lean lemma/lookup-result.ts
-/
import «lookup-result.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct resolveToken by
  unfold Pure.resolveToken; loom_solve

prove_correct preferExact by
  unfold Pure.preferExact; loom_solve

prove_correct chooseLookupResult by
  unfold Pure.chooseLookupResult Pure.resolveToken; loom_solve