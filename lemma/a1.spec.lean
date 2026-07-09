import Mathlib.Tactic.IntervalCases
import «a1.types»

/-
  Hand-written pure lemmas for the LemmaScript Lean backend.
  Imports «a1.types» so generated a1.def (`import «a1.spec»`) still sees Pure.*
  Must NOT import «a1.def» (that cycles with lsc gen).
  LETTERS-dependent lemmas live in a1.proof.lean (after «a1.def»).
-/

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

theorem toDigitsCore_len (fuel n : Nat) (ds : List Char) (hf : fuel > n) :
    (Nat.toDigitsCore 10 fuel n ds).length > ds.length := by
  induction fuel generalizing n ds with
  | zero => exfalso; omega
  | succ fuel ih =>
      simp [Nat.toDigitsCore]
      split_ifs with h
      · simp
      · have hf' : fuel > n / 10 := by
          have h1 : n / 10 < n := by
            apply Nat.div_lt_self
            · omega
            · decide
          omega
        specialize ih (n / 10) ((Nat.digitChar (n % 10)) :: ds) hf'
        simp at ih
        simp
        omega

theorem toDigits_nonempty (n : Nat) : (Nat.toDigits 10 n).length ≥ 1 := by
  have h := toDigitsCore_len (n + 1) n [] (by omega)
  simpa [Nat.toDigits] using h

@[simp]
theorem Nat.repr_len (n : Nat) : (Nat.repr n).length ≥ 1 := by
  unfold Nat.repr
  have := toDigits_nonempty n
  simpa [String.length_mk, List.asString] using this

@[simp]
theorem toString_Nat_len (n : Nat) : (toString n).length ≥ 1 := by
  change (Nat.repr n).length ≥ 1
  exact Nat.repr_len n

@[simp]
theorem Int.toString_len_of_nonneg {x : Int} (hx : 0 ≤ x) : (toString x).length ≥ 1 := by
  rcases x with (n | n)
  · exact toString_Nat_len n
  · exfalso; omega

@[simp]
theorem dollar_len : "$".length = 1 := by decide
