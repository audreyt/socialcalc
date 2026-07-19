/-
  Hand-written Lean proofs for lemma/chart.ts (LemmaScript Lean backend).
  Generated: chart.types.lean, chart.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/chart.ts
-/
import «chart.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct isValidChartType by
  unfold Pure.isValidChartType; loom_solve

prove_correct isValidSourceShape by
  unfold Pure.isValidSourceShape; loom_solve

prove_correct seriesCount by
  unfold Pure.seriesCount; loom_solve

prove_correct categoryCount by
  unfold Pure.categoryCount; loom_solve

prove_correct minSeriesForType by
  unfold Pure.minSeriesForType; loom_solve

prove_correct isSourceValidForType by
  unfold Pure.isSourceValidForType Pure.isValidChartType Pure.isValidSourceShape
    Pure.seriesCount Pure.minSeriesForType
  loom_solve

prove_correct domainMin by
  unfold Pure.domainMin; loom_solve

prove_correct domainMax by
  unfold Pure.domainMax; loom_solve

prove_correct shouldIncludeZeroBaseline by
  unfold Pure.shouldIncludeZeroBaseline; loom_solve

prove_correct baselineMin by
  unfold Pure.baselineMin; loom_solve

prove_correct baselineMax by
  unfold Pure.baselineMax; loom_solve

prove_correct isDegenerateDomain by
  unfold Pure.isDegenerateDomain; loom_solve

prove_correct isWithinSheetBounds by
  unfold Pure.isWithinSheetBounds; loom_solve

prove_correct isValidDimension by
  unfold Pure.isValidDimension; loom_solve

prove_correct clampDimension by
  unfold Pure.clampDimension; loom_solve

prove_correct planPlacementStatus by
  unfold Pure.planPlacementStatus Pure.isWithinSheetBounds Pure.isValidDimension
  loom_solve
