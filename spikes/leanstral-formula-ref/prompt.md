# Leanstral Formula Reference Rewrite Prompt

You are working in the SocialCalc repository. Do not edit production JavaScript yet. Use `spikes/leanstral-formula-ref/context.md` as the complete local context.

Task:
1. Inspect the current JavaScript semantics for formula reference rewriting and the Rust spike implementation.
2. Propose Lean 4 invariants for the small formula-reference rewrite model. Prioritize invariants that can generate useful Bun/Stryker fixtures for the shipped JavaScript implementation.
3. Start with these invariants:
   - string literal token payloads are preserved by offset/adjust/replace except for required quote re-emission;
   - name/function tokens are preserved and whole-column names such as `N:N`, `T:T`, and `AA:AA` are not treated as coordinates;
   - offset by `(0, 0)` is identity modulo SocialCalc parser normalization;
   - offset composition holds only while all intermediate coordinates remain valid and no `#REF!` is produced;
   - `AdjustFormulaCoords` and `ReplaceFormulaCoords` do not mutate coordinates while their sheet-reference flag is active;
   - `ReplaceFormulaCoords` intentionally rewrites mapped range endpoints independently, so `SUM(A1:B2)` with only `A1` mapped becomes `SUM(C3:B2)`.
4. If an invariant is false, return the smallest counterexample and explain whether it is a Rust spike bug, a JavaScript behavior to preserve, or a useful new SocialCalc fixture.
5. Produce Lean code only when it compiles without `sorry`/`admit`; otherwise produce the smallest concrete test case to add to `fixtures/formula-rewrite-cases.json`.

Stop after producing local Lean/test suggestions. Do not call external services.