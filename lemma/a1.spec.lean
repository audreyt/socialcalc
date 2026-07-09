import Mathlib.Tactic.IntervalCases
import «a1.def»

set_option loom.semantics.termination "total"
set_option loom.semantics.choice "demonic"

@[simp]
theorem letters_len {i : Nat} (hi : i < 26) : (LETTERS[i]!).length = 1 := by
  have h : i < 26 := hi
  interval_cases i <;> norm_num [LETTERS] <;> decide

@[simp]
theorem letters_tmod_len (c : Int) (hc1 : 1 ≤ c) (hc2 : c ≤ 702) :
    (LETTERS[((c - 1).tmod 26).toNat]!).length = 1 := by
  apply letters_len
  have h0 : c - 1 ≥ 0 := by omega
  have h1 : (c - 1).tmod 26 < 26 := Int.tmod_lt_of_pos (c - 1) (by decide)
  have h2 : (c - 1).tmod 26 ≥ 0 := Int.tmod_nonneg 26 h0
  have h3 : ((c - 1).tmod 26).toNat = (c - 1).tmod 26 := by
    rw [Int.toNat_of_nonneg h2]
  omega

@[simp]
theorem letters_colhigh_minus1_len (c : Int) (hc1 : 1 ≤ c) (hc2 : c ≤ 702) :
    (LETTERS[((c - 1) / 26 - 1).toNat]!).length = 1 := by
  apply letters_len
  have h0 : (c - 1) / 26 ≤ 26 := by
    rw [Int.ediv_le_iff_le_mul (by decide)]
    omega
  have h3 : (c - 1) / 26 - 1 < 26 := by omega
  have h4 : ((c - 1) / 26 - 1).toNat < 26 := by
    rw [Int.toNat_lt_of_ne_zero (by decide)]
    exact h3
  exact h4
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
