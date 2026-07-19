/-
  Hand-written Lean proofs for lemma/weekday-policy.ts (LemmaScript Lean backend).
  Generated: weekday-policy.types.lean, weekday-policy.def.lean — re-run:
    vp exec lsc gen --backend=lean lemma/weekday-policy.ts
-/
import «weekday-policy.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

prove_correct pow2 by
  unfold Pure.pow2; loom_solve

prove_correct isLegalWeekendCode by
  unfold Pure.isLegalWeekendCode; loom_solve

prove_correct weekendPairFirstDay by
  unfold Pure.weekendPairFirstDay; loom_solve

prove_correct weekendSingleDay by
  unfold Pure.weekendSingleDay; loom_solve

prove_correct weekendCodeToMask by
  unfold Pure.weekendCodeToMask Pure.isLegalWeekendCode Pure.weekendPairFirstDay Pure.weekendSingleDay
    Pure.pow2
  loom_solve

prove_correct isLegalWeekendMask by
  unfold Pure.isLegalWeekendMask; loom_solve

prove_correct isLegalMaskChar by
  unfold Pure.isLegalMaskChar; loom_solve

prove_correct maskDayOff by
  unfold Pure.maskDayOff; loom_solve

prove_correct sundayDowToIsoDow by
  unfold Pure.sundayDowToIsoDow; loom_solve

prove_correct isNonWorkingDay by
  unfold Pure.isNonWorkingDay Pure.maskDayOff; loom_solve

prove_correct isWorkingDay by
  unfold Pure.isWorkingDay Pure.isNonWorkingDay Pure.maskDayOff; loom_solve

prove_correct stepDirection by
  unfold Pure.stepDirection; loom_solve
