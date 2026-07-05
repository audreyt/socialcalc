# Leanstral Formula Regression Promotion Design

## Goal

Turn Leanstral's formula-reference rewrite findings into shipped regression coverage for SocialCalc JavaScript, then use one bounded Leanstral/smol pass to decide whether any further counterexample search or Lean model is worth keeping.

## Scope

In scope:
- Promote Leanstral-suggested formula rewrite cases into durable tests that run against `dist/SocialCalc.js`.
- Keep spike fixtures under `spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json` aligned with the production test cases.
- Use subagents for independent test-design and counterexample analysis.
- Use Leanstral only where its output can become a concrete fixture, invariant, or counterexample.

Out of scope:
- No production JavaScript behavior changes unless a test exposes an actual bug.
- No broad Rust/WASM architecture work.
- No Lean 4 artifact unless the counterexample pass identifies a small, concrete invariant that is worth formalizing.

## Architecture

The production regression layer should live with the existing Bun tests under `test/`, because those tests already load `dist/SocialCalc.js` through the project helpers and guard shipped JavaScript behavior. The spike fixture file remains a discovery corpus for parity and handoff work, not the only protection.

The implementation should add focused tests for the high-value invariant cases:
- strings that contain doubled quotes remain intact while local refs shift;
- whole-column names such as `N:N`, `T:T`, and `AA:AA` are not coordinates;
- zero-offset rewrite preserves parser-normalized output;
- safe offset composition gives the same result as a combined offset.

## Data Flow

1. Fixture data starts in `spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json`.
2. Production tests call the existing SocialCalc formula rewrite APIs from `dist/SocialCalc.js`.
3. Assertions compare the current JavaScript outputs with the Leanstral-derived expected strings.
4. A separate counterexample dispatch may propose additional cases; only concrete, minimal cases get added.

## Error Handling

If a promoted case fails:
- First classify whether it is a wrong expected value, a spike/Rust mismatch, or a current JavaScript behavior that must be preserved.
- Do not paper over failures by weakening expectations.
- If the failure exposes a real JavaScript bug, add the failing test first, then make the minimal production change.

If Leanstral returns only prose or non-compiling Lean:
- Do not add a Lean artifact.
- Extract only concrete test cases with formula, method, args, and expected output.

## Testing

Use TDD for any new production regression test:
- Add one failing test case at a time.
- Run the targeted Bun test and verify the failure is for the expected missing case.
- Add fixture/test wiring or minimal implementation only after the red step.
- Re-run the targeted test to green.
- Run the relevant spike parity test if spike fixtures changed.

## Acceptance Criteria

- Production Bun tests cover the four Leanstral-recommended fixture categories.
- Spike fixture JSON includes any new cases added to production tests.
- Counterexample pass is documented in the final summary with either a concrete added case or a decision that no Lean model is useful.
- Final tree is clean or all changes are committed/pushed if requested.
- Verification commands and results are reported exactly.
