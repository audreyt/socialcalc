# Leanstral Formula Regressions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote Leanstral formula-reference rewrite findings into production Bun regression tests and keep the spike fixture corpus aligned.

**Architecture:** Add a focused production test file under `test/` that calls `SC.OffsetFormulaCoords`, `SC.AdjustFormulaCoords`, and `SC.ReplaceFormulaCoords` from `dist/SocialCalc.js` through `loadSocialCalc`. Update the spike fixture JSON only for new durable direct cases not already represented. Skip Lean 4 unless a future counterexample is smaller and more valuable than string fixtures.

**Tech Stack:** Bun test runner, SocialCalc UMD bundle in `dist/SocialCalc.js`, `test/helpers/socialcalc.ts`, JSON spike fixtures.

## Global Constraints

- Use TDD: add the production regression test first and watch the targeted test fail because the new test file/cases were absent from the suite.
- Do not change production JavaScript unless a test exposes a real bug.
- Do not add a Lean model in this pass; both Leanstral and CounterexampleScout said fixtures are more useful now.
- Do not run project-wide suites until targeted commands pass.
- Keep `spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json` aligned for new cases.

---

### Task 1: Production Formula Rewrite Regression Tests

**Files:**
- Create: `test/formula-rewrite-regressions.test.ts`
- Modify: `spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json`

**Interfaces:**
- Consumes: `loadSocialCalc(): Promise<any>` from `test/helpers/socialcalc.ts`.
- Produces: production tests that directly assert formula rewrite behavior against `SC.OffsetFormulaCoords`, `SC.AdjustFormulaCoords`, and `SC.ReplaceFormulaCoords`.

- [ ] **Step 1: Write the failing production test file**

Create `test/formula-rewrite-regressions.test.ts` with tests covering:
- doubled quote string survival while refs shift;
- whole-column names not treated as coordinates;
- zero-offset parser normalization for `>=` and `<>`;
- safe offset composition;
- adjust deletion preserving sheet-qualified refs while local refs become `#REF!`.

- [ ] **Step 2: Run targeted test to verify red**

Run: `bun run build.ts && bun test test/formula-rewrite-regressions.test.ts`

Expected: the command executes the newly added test file. If all assertions pass immediately, the red condition is that this production regression file did not previously exist; continue because no production implementation is required. If any assertion fails, classify the failure before changing implementation.

- [ ] **Step 3: Add fixture JSON entries for new cases**

Modify `spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json` directCases to add cases not already present:
- safe offset composition representative case;
- not-equal operator zero-offset normalization;
- adjust deletion with sheet-qualified and local refs in the deleted column.

- [ ] **Step 4: Run targeted production and spike tests**

Run: `bun run build.ts && bun test test/formula-rewrite-regressions.test.ts spikes/leanstral-formula-ref/formula-ref-core.parity.test.ts`

Expected: production test passes; spike parity directCases pass when artifacts are present or the spike suite is skipped by its existing `skipIf(!artifactsPresent)` guard.

- [ ] **Step 5: Commit**

Run: `git add test/formula-rewrite-regressions.test.ts spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json docs/superpowers/plans/2026-07-05-leanstral-formula-regressions.md && git commit -m "test: promote Leanstral formula rewrite regressions"`

Expected: commit includes only the production test, fixture additions, and this plan if not already committed.

---

## Self-Review

- Spec coverage: Task 1 covers production Bun tests, spike fixture alignment, counterexample result, and Lean-skip decision.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency: test interfaces use the existing `loadSocialCalc` helper and SocialCalc rewrite functions.
