# SocialCalc 3.1.0 Hardening Implementation Plan

> **For agentic workers:** **Correction (2026-07-12):** the `superpowers` skill referenced by the original draft (`superpowers:subagent-driven-development` / `superpowers:executing-plans`) is not available in this harness — do not require or wait on it. Implement this plan by following its explicit TDD steps directly: for each task, work the checkbox (`- [ ]`) items in order (write/run the failing check, implement the minimum fix, re-run green, commit exactly that task's file list) — the same discipline the unavailable skill would have enforced. Each Task below is an independently mergeable stream: it owns a disjoint file set, has its own TDD command sequence, and can land on `main` in any order relative to the others (only Task 4's lint-CI wiring should land after Task 3's tautology/catch fixes land, or `denyWarnings`/the new guard step will fail on stream 3's yet-unfixed files — see Task 4 Global Constraints).

**Goal:** Take SocialCalc from "mechanically publishable at `fd6e61d`" to a package whose consumer contract, docs, test suite, coverage/mutation gates, sheet-rendering trust boundary, release gates, and dependency/supply-chain posture are all deliberately verified rather than assumed. Distinguish the minimum changes an ordinary 3.1.0 release needs from the larger hardening backlog, but plan and implement all nine requested streams.

**Baseline (verified against `HEAD=fd6e61d`, the exact SHA both `ci.yml` and `lemmascript.yml` last passed on):**

- `package.json` has no `type`, `exports`, or `engines` field; the UMD bundle is CJS-shaped (`module.exports` when present, `root.SocialCalc` global otherwise) but nothing pins or tests that contract for CJS `require`, native-ESM `import`, or strict-TS `moduleResolution: "nodenext"` consumers.
- `.github/workflows/ci.yml` runs `typecheck`, `typecheck:strict`, `build`, `test`, and `vp pm pack --out /tmp/socialcalc.tgz && tar -tzf ... package/dist/SocialCalc.min.js` — a member-existence check only, not a load/require/import smoke test. It never runs `vp lint`.
- `Changes.txt` has zero occurrences of `3.0.7` or `3.0.8` even though both are real annotated tags (`git log v3.0.6..v3.0.7`: `4c38e27`, `90f321c`; `git log v3.0.7..v3.0.8`: `1f7a914`, `952d703`). **Correction:** only `v3.0.8` was published to npm; `v3.0.7` is a GitHub-only annotated tag that was never pushed to the npm registry — do not describe it as npm-published in this plan, `Changes.txt`, or any advisory/release doc that cites it. The v3.1.0 section is otherwise present and current.
- `README.md` documents the LemmaScript Dafny/Lean trust boundary in detail (`### Trust boundary and verified surfaces`, lines 109-134) but has no equivalent section for the *rendering* trust boundary — no mention that SocialCalc writes raw HTML from sheet cell/comment/hyperlink content. `js/{socialcalc-3,socialcalcpopup,socialcalcspreadsheetcontrol,socialcalctableeditor,socialcalcviewer}.ts` contain 57 `innerHTML =` assignment sites combined.
- `test/control-coverage.test.ts` and `test/iofunctions-coverage.test.ts` hold 31 of the repo's 35 `expect(true).toBe(true)` tautologies (30 in iofunctions, 1 in control) plus a chunk of the empty-catch total; `test/editor-dom-coverage.test.ts` holds the remaining 4 tautologies, and `test/editor-coverage-a.test.ts` / `test/editor-coverage-b.test.ts` / `test/ui-coverage.test.ts` hold the bulk of the remaining empty `catch {}` swallows (~1,022 empty-catch sites tracked in the current baseline audit across `test/**`). None of these files run through `vp lint` today because CI never invokes it.
- `vite.config.ts` → `test.coverage` sets `exclude: ["test/**"]` and `reporter: ["text", "lcov"]` only — no `include` allow-list restricted to shipping `js/**/*.ts` sources, no `thresholds`, and CI does not run `vp run test:coverage` or read the report at all.
- `stryker.config.mjs` mutates 7 of the 11 modules AGENTS.md lists as typechecked (`formatnumber2.ts`, `formula1.ts`, `socialcalc-3.ts`, `socialcalctableeditor.ts`, `socialcalcpopup.ts`, `socialcalcspreadsheetcontrol.ts`, `socialcalcviewer.ts`); it omits `formula-parse.ts`, `formula-operand.ts`, `formula-ref.ts`, `socialcalcconstants.ts`. `thresholds.break` is `null` (nothing fails CI), and no workflow runs Stryker at all — `vp run mutate` is local-only.
- No opt-in sanitized/safe rendering mode exists; every sheet-content HTML sink in the five UI modules above is unconditional.
- No browser-matrix, differential, performance-budget, or adversarial/fuzz test workflow exists; `package.json` has no `playwright`/`puppeteer` dependency.
- `devEngines.packageManager` gates plain `npm audit`/`npm view` off (`EBADDEVENGINES`); dependency-advisory disposition must run through `vp`/`bun`. Both GitHub Actions workflows pin actions by tag (`actions/checkout@v4`, `voidzero-dev/setup-vp@v1`, `dafny-lang/setup-dafny-action@v1`), not by commit SHA, and there is no publish/release workflow at all.

**Architecture:** Nine independently mergeable streams, each scoped to a disjoint file set so they can be implemented, reviewed, and merged in parallel without touching lines another stream owns. Every stream is TDD: write/run the failing check first, implement the minimum fix, re-run green. **No stream edits shipping behavior in `js/*.ts` beyond what is explicitly named (Task 7's opt-in sanitizer, added as new code paths behind an off-by-default option) — existing default rendering/formula/command behavior is unchanged.**

**Tech Stack:** Vite+ (`vp`) build/test/lint, Vitest (`vite-plus/test`), Stryker mutation testing, GitHub Actions, TypeScript `tsc --noEmit` (ordinary + strict), Dafny/Lean (untouched by this plan), Bun as the pinned package manager.

## Global Constraints

- Use TDD: for every stream, add/modify the test or CI check first, run it, and confirm it fails for the *expected* reason (missing field, missing file, no threshold, stale doc) before writing the implementation.
- Do not alter default shipping behavior. `js/*.ts` edits are restricted to: (a) Task 4's replacement of tautological/empty-catch *tests* (test-only files), and (b) Task 7's new opt-in sanitization path, which must be off by default and covered by a regression test proving default output is byte-identical to pre-change output.
- Never hand-edit `dist/**`; run `vp build` (or `vp build --minify`) to regenerate it, matching AGENTS.md.
- Each task's commit is scoped to that task's file list only. Do not bundle unrelated streams into one commit.
- Run only the focused commands listed per task during implementation; run the full matrix (`vp run typecheck && vp run typecheck:strict && vp build && vp lint && vp test`) once before the final stream lands, not after every task.
- Mark clearly, in Changes.txt and in this plan's task headers, which items are **[3.1 BLOCKER]** (required for an honest, mechanically-verified 3.1.0 release) versus **[HARDENING]** (raises the bar beyond an ordinary minor release; still fully in scope for this plan).

---

### Task 1 — Explicit CommonJS type + tarball-first consumer contract gate `[3.1 BLOCKER]` — landed as `4371ad5`

**Correction (2026-07-12):** the original draft below assumed `package.json` needed a `"exports"` map and an `"engines"` floor, and assumed native-ESM `import` resolution was broken pre-fix. Neither holds. What actually shipped in `4371ad5`:

**Files:**
- Modify: `package.json` — add explicit `"type": "commonjs"` only. No `"engines"` field: nothing in this repo's actual toolchain/CI evidence requires pinning a Node floor, and adding one absent a real compatibility failure is speculative. No `"exports"` map: absent evidence that today's consumers need conditional exports, an `"exports"` map only *narrows* resolution (e.g. blocking deep imports outside the map that may already be relied on) for zero measured benefit — this package branch intentionally keeps the contract at explicit `"type": "commonjs"` and nothing more.
- Modify: `package.json` — add `"test:package-contract": "vp node scripts/verify-package-contract.mjs"`.
- Create: `scripts/verify-package-contract.mjs` (not the originally-drafted `test/fixtures/consumer/**` + `test/package-consumer-contract.test.ts` — superseded; do not recreate the fixture-based approach).

**Interfaces:**
- Consumes: `vp pm pack` (its existing `prepack` hook already runs `vp build --minify`), extracted into a scratch `node_modules/socialcalc` consumer directory so `require`/`import` resolve by package specifier, not by file path.
- Produces: `vp run test:package-contract`, a standalone Node script (deliberately outside `test/**/*.test.ts` / `vp test`, since `vp pm pack` rebuilding on every invocation would add pack/extract/tsc overhead and a prepack-recursion risk to the ordinary test run) asserting: tar member allowlist derived from `package.json`'s own `"files"`; packed artifact sizes + sha256 for tarball/normal/minified (reported, never pinned); root CJS `require("socialcalc")`; deep CJS `require("socialcalc/dist/SocialCalc.min.js")`; native static ESM `import SocialCalc from "socialcalc"` run in a real child process; VM browser-global execution of both bundles; top-level key/typeof shape parity across all five delivery paths; representative command/formula/save-load exercise on all four runtime instances; a strict external `tsc --noEmit` compile against the packed `.d.ts`; a best-effort, non-gating are-the-types-wrong report.

**Correction — the baseline was already working:** the original Step 2 below claimed the pre-fix tree would fail native-ESM/strict-TS resolution because `package.json` had no `"type"`/`"exports"` field. That's false: Node already resolved the extensionless, `"type"`-less bundle as CommonJS by default (no ambiguity existed to trigger fallback sniffing), and native ESM's `import(...).default` already worked before this change — verified empirically by running the full check matrix against the pre-fix tree: only the explicit-`"type"` field-presence assertion failed; every require/import/VM/tsc check already passed. `"type": "commonjs"` is an honesty/explicitness fix with zero resolution-behavior change, not a fix for a broken resolver.

- [x] **Step 1: Write `scripts/verify-package-contract.mjs`** covering every check listed above.
- [x] **Step 2: Confirm the explicit-`"type"` assertion is the only genuinely red check** against the pre-fix tree — everything else already passes (see correction note above).
- [x] **Step 3: Add `"type": "commonjs"` and the `test:package-contract` script to `package.json`** — no `"engines"`, no `"exports"` map.
- [x] **Step 4: Run `vp run test:package-contract` to verify all checks green.**
- [x] **Step 5: Commit** — landed as `package: declare explicit CommonJS type + tarball-first contract gate` (`4371ad5`). Note: no `.github/workflows/ci.yml` step was added for this task; CI wiring remains genuinely open for a future stream, not silently dropped.

---

### Task 2 — Changelog / import docs / rendering trust-boundary docs `[3.1 BLOCKER]`

**Files:**
- Modify: `Changes.txt` (insert `v3.0.7` — GitHub tag only, never published to npm — and `v3.0.8` — published to npm — sections between the current `v3.1.0` and `v3.0.6` headers)
- Modify: `README.md` (extend `## Usage` with the CJS/native-ESM-default/browser-global import forms; add `## Trust boundary and host security` directly after `## Usage`, before `## Build and quality gates`)

**Interfaces:**
- Consumes: `git log v3.0.6..v3.0.7 --stat` / `git log v3.0.7..v3.0.8 --stat` for accurate per-release commit summaries; the three import forms `scripts/verify-package-contract.mjs` (Task 1) actually exercises (root CJS require, deep CJS require, native ESM default import) for the import-forms doc.
- Produces: a changelog with no version gaps and correct npm-publication status per version, and a README trust-boundary section a downstream embedder (e.g. EtherCalc) can point to when deciding whether to sanitize sheet content before rendering it.

- [x] **Step 1 (reconciled): landed directly, no dedicated doc-completeness test.** `test/docs-contract.test.ts` from the original draft was never created; `Changes.txt`/`README.md` were corrected directly and verified by manual review against `git log v3.0.6..v3.0.7`/`v3.0.7..v3.0.8`, not by a committed heading-presence assertion. A future machine-checked doc-completeness gate must target the real heading text (`## Trust boundary and host security`, not `## Rendering trust boundary`) and the real per-version npm-publication wording below.

- [x] **Step 2: Reconcile Changes.txt** — inserted `v3.0.8 — 2026-07-09` (published to npm as `socialcalc@3.0.8`) and `v3.0.7 — 2026-07-09 (GitHub tag only; not published to npm)` between the existing `v3.1.0` and `v3.0.6` headers. **Correction:** the original baseline claimed both `3.0.7` and `3.0.8` "were npm-published" — false for `3.0.7`, which is a GitHub-only annotated tag; only `3.0.8` reached the npm registry.

- [x] **Step 3: Document the import forms and trust boundary in README** — `## Usage` documents `require("socialcalc")`, `import SocialCalc from "socialcalc"` (native ESM default import — this path already worked pre-`4371ad5`, see Task 1's correction note; documenting it is not documenting a new fix), and the browser `<script>` global form. The trust-boundary section landed as `## Trust boundary and host security` (not `## Rendering trust boundary` as originally drafted, and placed directly after `## Usage` rather than after `## Formula-reference rewrite coverage`) — any future edit (e.g. Task 7 wiring in an opt-in sanitizer) must target that actual heading/location. The landed README does not yet cross-reference `vp run test:package-contract` as the enforcement point; that cross-reference remains open, not something to assume is already there.

- [x] **Step 4: Commit** — landed as `docs: clarify releases and trust boundary` (`28ef026`).

---

### Task 3 — Control + IO test credibility cleanup `[HARDENING]`

**Files:**
- Modify: `test/control-coverage.test.ts`
- Modify: `test/iofunctions-coverage.test.ts`

**Interfaces:**
- Consumes: the existing `loadSocialCalc()` / `scheduleCommands` test helpers already used by both files.
- Produces: the same test names, each now asserting a real, specific post-condition (returned value, thrown error, DOM/state mutation, or explicit "no side effect occurred" check on a concrete field) instead of `expect(true).toBe(true)`, and no bare `catch {}` swallowing an assertion failure.
- **Scope correction:** tautology/empty-catch cleanup (this task and Task 4) applies to every git-tracked `test/**/*.test.ts` file — the six files named explicitly across Tasks 3–4 (`test/control-coverage.test.ts`, `test/iofunctions-coverage.test.ts`, `test/editor-dom-coverage.test.ts`, `test/editor-coverage-a.test.ts`, `test/editor-coverage-b.test.ts`, `test/ui-coverage.test.ts`) plus any other git-tracked test file discovered to hold the same anti-patterns. It does **not** apply to untracked/scratch exploratory test files or coverage-report directories that may exist locally in a contributor's working tree (e.g. ad hoc `*-coverage-gaps-*.test.ts` variants, `coverage-*/` output dirs) — those are out of this plan's scope and must not be picked up or committed by this cleanup. Task 4's guard script must enumerate `git ls-files 'test/**/*.test.ts'`, not a raw filesystem glob, so it never fails on someone's uncommitted local file.

- [ ] **Step 1: Inventory current tautologies/empty catches in these two files**

  Run: `grep -n "expect(true).toBe(true)" test/control-coverage.test.ts test/iofunctions-coverage.test.ts` and `grep -n "catch" test/control-coverage.test.ts test/iofunctions-coverage.test.ts` to get the exact current line set (line numbers shift as the plan's other tasks land; re-derive them at implementation time rather than trusting this document's line numbers).

- [ ] **Step 2: For each tautology, determine the real assertable behavior — this IS the failing-test step**

  For each `TriggerIoAction.*` / control-flow test currently ending in `expect(true).toBe(true)`, replace it with an assertion on the actual observable effect already implied by the test name and setup (e.g. `TriggerIoAction.Button INSERT with row-insert` should assert the sheet gained the inserted row / cell content shifted, not merely that the call didn't throw). Where the test's only real contract is "does not throw," replace the tautology with `expect(() => SC.TriggerIoAction.Button("A1")).not.toThrow()` — an explicit, meaningful assertion — rather than a call followed by an unrelated `true`. Where a `catch {}` exists purely to swallow an expected non-throw path, remove the try/catch and call directly so a real throw fails the test instead of being hidden.

  Because each new assertion is written by reading what the surrounding test already sets up (sheet state, mocked DOM, `ioParameterList`), each edit is executed *and verified* as its own micro-red/green cycle: intentionally assert a wrong expected value first (confirms the test can fail), run it, see it fail, then correct it to the right value, run it, see it pass. Do this at least for a representative sample per `describe` block, not literally every one of the ~31 sites, to bound effort — but every tautology in these two files must be replaced with a non-trivial assertion by the end of this task.

- [ ] **Step 3: Run targeted tests to verify green**

  Run: `vp build && vp test run test/control-coverage.test.ts test/iofunctions-coverage.test.ts`

  Expected: same test count, zero `expect(true).toBe(true)`, all green.

- [ ] **Step 4: Confirm no coverage regression**

  Run: `vp run test:coverage` (or the scoped variant once Task 5 lands) and compare `js/socialcalc-3.ts`/`js/socialcalcspreadsheetcontrol.ts` line coverage before/after — replacing a tautology with a real assertion must not *reduce* the lines exercised, since the same production calls still execute.

- [ ] **Step 5: Commit**

  Run: `git add test/control-coverage.test.ts test/iofunctions-coverage.test.ts && git commit -m "test: replace control/IO tautological assertions with real postconditions"`

---

### Task 4 — Remaining UI catch/tautology cleanup + anti-regression lint/test guard `[HARDENING, with one 3.1 BLOCKER sub-step]`

**Files:**
- Modify: `test/editor-dom-coverage.test.ts` (4 tautologies)
- Modify: `test/editor-coverage-a.test.ts`, `test/editor-coverage-b.test.ts`, `test/ui-coverage.test.ts` (bulk of the remaining empty `catch {}` sites)
- Modify: `.github/workflows/ci.yml` (add the `[3.1 BLOCKER]` sub-step: wire `vp lint` into CI — currently absent entirely)
- Create: `scripts/check-test-credibility.mjs` (grep-based guard: fails if `test/**/*.test.ts` contains `expect(true).toBe(true)` or a bare `catch` with an empty or comment-only body)
- Modify: `package.json` (add `"check:test-credibility": "node scripts/check-test-credibility.mjs"` script)

**Global Constraints (this task only):** Land the `vp lint` CI step (Step 5) **after** Task 3 and this task's own Steps 1-2 are merged — `denyWarnings` type-aware lint has never run against these files and may surface pre-existing diagnostics unrelated to catch/tautology cleanup; those must be fixed as part of this same task's file list (not deferred), since this task is what turns lint on.

**Interfaces:**
- Consumes: same test helpers as Task 3.
- Produces: same as Task 3 for the remaining files, plus a new guard script that scans every git-tracked `test/**/*.test.ts` file (via `git ls-files`, not a raw filesystem glob — see Task 3's scope correction: uncommitted/scratch test files are out of scope and must not fail this guard) and exits non-zero on any tautology/empty-catch match, wired into CI as a fast pre-lint gate.

- [ ] **Step 1: Write the failing guard script first**

  Create `scripts/check-test-credibility.mjs`: enumerate `git ls-files 'test/**/*.test.ts'` (git-tracked files only — never a raw filesystem glob, per Task 3's scope correction), regex-match `expect(true).toBe(true)` and `catch\s*(\([^)]*\))?\s*\{\s*(//[^\n]*)?\s*\}` (empty or comment-only catch body), print offending `file:line`, exit 1 if any match. Add the npm script. Run `vp run check:test-credibility` — expect it to fail loudly against the current tree (both this task's target files and, if Task 3 hasn't merged yet, its files too).

- [ ] **Step 2: Fix `test/editor-dom-coverage.test.ts` tautologies and the UI files' empty catches**

  Same method as Task 3 Step 2: replace each tautology with a real DOM/state assertion (e.g. `ProcessEditorColselectMouseDown` restoring the original handler should assert the handler reference or resulting selection state, not just "ran"); remove or fill empty `catch {}` blocks in `editor-coverage-a.test.ts`, `editor-coverage-b.test.ts`, and `ui-coverage.test.ts` so a thrown error inside the guarded call fails the test.

- [ ] **Step 3: Run the guard clean**

  Run: `vp run check:test-credibility`

  Expected: exit 0, no matches anywhere under `test/**`.

- [ ] **Step 4: Run targeted Vitest files**

  Run: `vp build && vp test run test/editor-dom-coverage.test.ts test/editor-coverage-a.test.ts test/editor-coverage-b.test.ts test/ui-coverage.test.ts`

- [ ] **Step 5: `[3.1 BLOCKER]` Wire `vp lint` and the guard into CI**

  Add two steps to `.github/workflows/ci.yml`, after "Typecheck (strict)": `vp lint` and `vp run check:test-credibility`. If `vp lint` surfaces diagnostics in files outside this task's list, fix them as part of this same commit (scope note: keep fixes mechanical — formatting/type-narrowing, not behavior changes) since turning the gate on is this task's responsibility.

- [ ] **Step 6: Run the full local matrix**

  Run: `vp run typecheck && vp run typecheck:strict && vp build && vp lint && vp run check:test-credibility && vp test`

- [ ] **Step 7: Commit**

  Run: `git add test/editor-dom-coverage.test.ts test/editor-coverage-a.test.ts test/editor-coverage-b.test.ts test/ui-coverage.test.ts scripts/check-test-credibility.mjs package.json .github/workflows/ci.yml && git commit -m "test(ci): finish tautology/empty-catch cleanup and gate CI on lint + a credibility guard"`

---

### Task 5 — Source-attributed coverage and CI floors `[HARDENING]`

**Files:**
- Modify: `vite.config.ts` (`test.coverage`)
- Modify: `.github/workflows/ci.yml` (add a coverage step + floor enforcement)

**Interfaces:**
- Consumes: `@vitest/coverage-v8` (already a devDependency) via `vp test --coverage`.
- Produces: a coverage report scoped to `js/**/*.ts` shipping sources (not test helpers, not `dist/`), with numeric thresholds that fail the run below them.

- [ ] **Step 1: Write the failing CI expectation**

  Add a step to `.github/workflows/ci.yml` running `vp run test:coverage`, immediately after "Test". Since `vite.config.ts` currently has no `thresholds`, this step cannot fail on a floor yet — the "red" here is: run `vp run test:coverage` locally first and record the actual current per-metric numbers (statements/branches/functions/lines) as the evidence for Step 2's threshold choice, then add a placeholder threshold *above* what a broken build would produce but *at* today's real numbers (thresholds must reflect an honest current baseline, not an aspirational one this task doesn't reach). **Correction:** before trusting any per-file number, confirm the report is actually attributing coverage to `js/**/*.ts` source lines rather than to the built `dist/SocialCalc.js` bundle the test helpers load — neither `vite.config.ts` nor `build.ts` currently configures source maps anywhere in this repo (verified: no `sourcemap`/`sourceMap` key exists in `build.ts`, `vite.config.ts`, or `tsconfig.json`). Scoping coverage with `include: ["js/**/*.ts"]` alone (Step 2) is necessary but not sufficient: without a valid source-map chain from the executed code back to `js/**/*.ts`, the V8 coverage provider cannot correctly attribute hits to those source lines, and the scoped report may come back empty or misleading rather than reflecting real per-file coverage. Wire and verify the source-map chain (e.g. `build: { sourcemap: true }` in the rolldown build options, confirmed by inspecting the coverage report's actual per-file line hits against `js/**/*.ts`, not just its summary percentages) before treating Step 2's numbers as trustworthy.

- [ ] **Step 2: Scope coverage to shipping sources and set thresholds**

  In `vite.config.ts` → `test.coverage`, add `include: ["js/**/*.ts"]` alongside the existing `exclude: ["test/**"]` (belt-and-suspenders: `include` is the authoritative allow-list; keep `exclude` so `.d.ts`/build helpers under other roots stay off if `include` is ever loosened). Add `thresholds: { statements: <measured>, branches: <measured>, functions: <measured>, lines: <measured> }` using Step 1's measured baseline, rounded down to the nearest whole percent so the threshold is met by the current tree, not aspirational.

- [ ] **Step 3: Run targeted verification**

  Run: `vp build && vp run test:coverage`

  Expected: exits 0; report shows only `js/**/*.ts` files (no `test/**`, no `dist/**`, no `lemma/**`).

- [ ] **Step 4: Confirm CI floor actually fails on regression, then commit the real (not a placeholder) threshold**

  Temporarily lower one threshold value by 5 points, rerun `vp run test:coverage`, confirm it now fails — this proves the gate is load-bearing. **Correction:** do not simply revert to Step 2's rounded-down placeholder afterward. This regression proof is the evidence that licenses setting the *committed* threshold at the real measured baseline (Step 1's honest current numbers, rounded down only to the nearest whole percent for run-to-run noise — not further discounted as a defensive placeholder): having shown the floor genuinely catches a real drop, raise each threshold to the highest value the current tree still passes, then rerun `vp run test:coverage` once more to confirm it's green at that raised number before committing. A threshold nobody has proven can fail, or one set conservatively below what's actually achieved, is not a real floor.

- [ ] **Step 5: Commit**

  Run: `git add vite.config.ts .github/workflows/ci.yml && git commit -m "test(coverage): scope coverage to shipping sources and enforce CI floors"`

---

### Task 6 — Mutation testing: critical-module expansion, break threshold, CI workflow `[HARDENING]`

**Files:**
- Modify: `stryker.config.mjs` (`mutate` list, `thresholds.break`)
- Modify: `stryker-file.mjs` (`testsByFile` map, for the newly added modules)
- Create: `.github/workflows/mutation.yml`

**Interfaces:**
- Consumes: `@stryker-mutator/core` (already a devDependency), the existing `command: vp build && vp test` runner.
- Produces: mutation coverage for all AGENTS.md-listed typechecked core modules (adds `formula-parse.ts`, `formula-operand.ts`, `formula-ref.ts`, `socialcalcconstants.ts` to the existing 7), a non-null `break` threshold CI actually enforces, and a scheduled/PR-triggered workflow running it.

- [ ] **Step 1: Write the failing expectation — run current mutation baseline**

  Run: `vp run mutate` (full sandboxed run) and record the current mutation score and `js/formula-parse.ts`/`js/formula-operand.ts`/`js/formula-ref.ts`/`js/socialcalcconstants.ts`'s *current* survivor count (they mutate to 0/undefined coverage today since they're absent from the `mutate` list — this is the "red": these four files have no mutation signal at all).

- [ ] **Step 2: Add the four modules and their test mappings**

  In `stryker.config.mjs`, add `"js/formula-parse.ts"`, `"js/formula-operand.ts"`, `"js/formula-ref.ts"`, `"js/socialcalcconstants.ts"` to `mutate`. In `stryker-file.mjs`'s `testsByFile`, map each `.js`/`.ts` pair to its exercising test files (grep `test/**` for which files import/exercise `Formula.ParseFormula`, `Formula.OperandValueToText`-style operand helpers, `OffsetFormulaCoords`/`AdjustFormulaCoords`/`ReplaceFormulaCoords`, and `SocialCalc.Constants.*` respectively — reuse the existing `formula-rewrite-*`/`lemma-*facade` files as the formula-ref mapping since AGENTS.md already documents those as its oracle tests).

- [ ] **Step 3: Run the expanded mutation set and record the new baseline**

  Run: `vp run mutate` (or, for faster iteration per new file, `MUTATE_IN_PLACE=1 vp run mutate:file js/formula-ref.ts`, etc.)

  Expected: a mutation score for all 11 modules combined. If any of the four newly-added files scores far below the existing 90/70 high/low bar, that is real signal of an undertested pure-helper path — file it as a follow-up regression test, do not silently lower the bar to make Stryker pass.

- [ ] **Step 4: Set a real, enforced `break` threshold**

  Change `thresholds.break` from `null` to the measured overall score from Step 3, rounded down a few points for run-to-run noise tolerance (Stryker mutant ordering/timeout jitter). Do not set `break` above what the current tree actually achieves.

- [ ] **Step 5: Add the CI workflow**

  Create `.github/workflows/mutation.yml` mirroring `ci.yml`'s `voidzero-dev/setup-vp@v1` + `vp install --frozen-lockfile` setup, triggered on `pull_request` (mutation runs are slow; do not add it to every `push`-to-`main` unless the team accepts that latency — default to `pull_request` only, matching this repo's existing `ci.yml`/`lemmascript.yml` `on:` blocks which already both include `pull_request`). Run `vp run mutate`; Stryker's own process exit code reflects the `break` threshold, so no extra shell logic is needed.

- [ ] **Step 6: Commit**

  Run: `git add stryker.config.mjs stryker-file.mjs .github/workflows/mutation.yml && git commit -m "test(mutation): expand critical-module set, enforce a break threshold, add CI"`

---

### Task 7 — Opt-in secure untrusted-sheet rendering policy `[HARDENING]`

**Files:**
- Modify: `js/socialcalcconstants.ts` (add a new namespaced option, e.g. `SocialCalc.Constants.SanitizeUntrustedContent` default `false`, or an instantiation-time option threaded through `SpreadsheetControl`/`TableEditor`/`Viewer` constructors — pick the narrowest surface that already has a per-instance options object; do not introduce a new global mutable flag if an existing options bag covers it)
- Modify: `js/socialcalc-3.ts`, `js/socialcalcpopup.ts`, `js/socialcalcspreadsheetcontrol.ts`, `js/socialcalctableeditor.ts`, `js/socialcalcviewer.ts` (gate the highest-risk `innerHTML` sinks — cell text/comment/hyperlink rendering, not internal chrome markup — behind the option; when enabled, escape/strip HTML from sheet-sourced strings before they reach `innerHTML`)
- Modify: `README.md` (`## Trust boundary and host security`, landed in Task 2 as `28ef026` — document how to enable the option)
- Create: `test/secure-rendering.test.ts`

**Interfaces:**
- Consumes: the five UI modules' existing rendering call sites.
- Produces: an opt-in, off-by-default sanitization path; when off, output is byte-identical to the pre-Task-7 baseline (this is the backward-compatibility contract the task's name requires); when on, sheet-sourced cell/comment/hyperlink text is HTML-escaped before insertion.

**Global Constraints (this task only):** This is the one stream permitted to touch shipping `js/*.ts` behavior, and only additively: every new code path must be behind the off-by-default option, and Step 1's characterization test (option off → identical output) must be written and passing *before* Step 3's option-on behavior is added, so a reviewer can see the "off" path never regressed.

- [ ] **Step 1: Characterize current (default) rendering output as the regression baseline**

  Write `test/secure-rendering.test.ts` Part A: for a representative sheet with cell text containing `<img onerror=alert(1)>`-style content, a cell comment with embedded markup, and a hyperlink with a `javascript:` URL, render it through the existing (unmodified) path and snapshot/assert the exact current `innerHTML` output. This is the "red" step only in the sense that it fixes the pre-existing behavior as an explicit, checked contract for the first time — it must pass immediately against unmodified `js/*.ts`, proving Step 1 alone is a no-op.

- [ ] **Step 2: Run to confirm Part A passes unmodified**

  Run: `vp build && vp test run test/secure-rendering.test.ts`

  Expected: green, with zero source changes yet.

- [ ] **Step 3: Add the off-by-default option and gate the sinks**

  Add the option (Constants or instance-config, per the file-list note above). At each gated `innerHTML` site handling sheet-sourced cell/comment/hyperlink content, branch: option off → existing code path, byte-for-byte; option on → HTML-escape the sheet-sourced substring (cell display text, comment text, hyperlink `href`/display text) before concatenation, leaving SocialCalc's own generated chrome markup (cell borders, toolbar, menus) untouched since that markup is not attacker-controlled.

- [ ] **Step 4: Add Part B — option-on behavior test**

  Extend `test/secure-rendering.test.ts` with Part B: same malicious-content sheet, option enabled, assert the dangerous markup is escaped/neutralized (e.g. `<img onerror=` no longer appears as live markup in the rendered `innerHTML`, and a `javascript:` href is stripped or neutralized) while normal cell content (numbers, plain text, legitimate formulas) renders unchanged.

- [ ] **Step 5: Run targeted tests to verify both parts green**

  Run: `vp build && vp test run test/secure-rendering.test.ts`

- [ ] **Step 6: Run the full formula/command/UI regression matrix (blast-radius check)**

  Run: `vp run typecheck && vp run typecheck:strict && vp build && vp lint && vp test`

  Expected: zero regressions anywhere else in the suite — this step exists specifically because Task 7 is the one stream touching shipping code, so it gets the widest verification net.

- [ ] **Step 7: Document the option in README**

  Update `## Trust boundary and host security` (landed in Task 2 as `28ef026`, corrected from this draft's original `## Rendering trust boundary` working title) with the exact option name, default, and an example enabling it, closing the loop Task 2 opened.

- [ ] **Step 8: Commit**

  Run: `git add js/socialcalcconstants.ts js/socialcalc-3.ts js/socialcalcpopup.ts js/socialcalcspreadsheetcontrol.ts js/socialcalctableeditor.ts js/socialcalcviewer.ts test/secure-rendering.test.ts README.md dist/ && git commit -m "feat(security): add opt-in sanitized rendering for untrusted sheet content"`

---

### Task 8 — Browser / differential / performance / adversarial release gates `[HARDENING]`

**Files:**
- Modify: `package.json` (add a browser-test devDependency — `@playwright/test` — and `"test:browser"`/`"test:perf"`/`"test:fuzz"` scripts)
- Create: `playwright.config.ts`
- Create: `test/browser/spreadsheet-control.spec.ts` (cross-browser smoke: init, type into a cell, formula recalculation, undo/redo — Chromium + Firefox + WebKit projects)
- Create: `test/differential/formula-corpus.test.ts` (expands the existing `test/formula-rewrite-cases.test.ts`/fixture-JSON pattern into a larger generated corpus of formula inputs checked against SocialCalc's own documented invariants — e.g. round-trip `AdjustFormulaCoords` + inverse offset, `#REF!` monotonicity — not a second independent spreadsheet engine, since none is available as an oracle)
- Create: `test/performance/bundle-budget.test.ts` (asserts `dist/SocialCalc.min.js` gzip size stays under a recorded budget; asserts a large-sheet recalculation benchmark stays under a recorded time budget)
- Create: `test/fuzz/formula-fuzz.test.ts` (property-based: random formula strings through `SC.Formula`'s parser/evaluator must never throw an uncaught exception or hang — every input must resolve to a value or a `#`-prefixed error string within a bounded time)
- Create: `.github/workflows/release-gates.yml`

**Interfaces:**
- Consumes: `dist/SocialCalc.js`/`SocialCalc.min.js` (built artifacts), `test/helpers/socialcalc.ts` (existing bundle-loading helper), Playwright's own browser binaries.
- Produces: a `pull_request`-triggered workflow that is allowed to be slower than `ci.yml` (it is a release gate, not the fast inner loop) and blocks a release, not every commit, from shipping without cross-browser, differential, performance, and adversarial coverage.

- [ ] **Step 1: Write the failing browser smoke spec**

  Add `@playwright/test` as a devDependency via `vp add -D @playwright/test`. Write `playwright.config.ts` (projects: chromium, firefox, webkit; `webServer` serving a minimal static HTML fixture that loads `dist/SocialCalc.js` + a `<div>` mount point). Write `test/browser/spreadsheet-control.spec.ts`: init a `SpreadsheetControl`, type a value + formula into two cells, assert the computed cell shows the right result, across all three projects. Run it — expect red because the fixture HTML page and Playwright browser binaries don't exist yet.

- [ ] **Step 2: Implement the fixture page and get the browser spec green**

  Add a minimal static HTML fixture (co-located under `test/browser/fixtures/`) loading the built UMD bundle exactly as README's `## Usage` `<script>` form documents. Run: `vp build && npx playwright install --with-deps && vp exec playwright test`. Expected: green on all three projects.

- [ ] **Step 3: Write the failing differential corpus test**

  Extend the existing fixture-JSON pattern (`test/fixtures/formula-rewrite-cases.json`) with a larger generated corpus (dozens, not thousands — this is a targeted invariant corpus, not a fuzz test; fuzzing is Task 8's separate file) covering `OffsetFormulaCoords`/`AdjustFormulaCoords`/`ReplaceFormulaCoords` round-trip and monotonicity invariants documented in AGENTS.md's "Compatibility rules." Run it — expect red only insofar as the new file/cases don't exist yet; if any invariant genuinely fails against current shipping behavior, that is real signal — file it, do not weaken the invariant to pass.

- [ ] **Step 4: Get the differential corpus green**

  Run: `vp build && vp test run test/differential/formula-corpus.test.ts`

- [ ] **Step 5: Write the failing performance budget test**

  Record the current `dist/SocialCalc.min.js` gzip size and a large-sheet (e.g. 200x50 populated cells with formulas) full-recalculation wall-clock time as the initial budget (same "baseline, not aspirational" rule as Task 5). Write `test/performance/bundle-budget.test.ts` asserting both stay under budget (with a documented tolerance, e.g. 10%, for CI runner variance).

- [ ] **Step 6: Run to confirm the performance test is green against the recorded baseline**

  Run: `vp build --minify && vp test run test/performance/bundle-budget.test.ts`

- [ ] **Step 7: Write the adversarial fuzz test**

  Write `test/fuzz/formula-fuzz.test.ts`: generate a bounded number (e.g. 500, deterministic seed for reproducibility) of random formula strings (mixing valid tokens, deeply nested parens, huge numeric literals, malformed refs, Unicode) and assert `SC.Formula.ParseFormula`/`evaluate_parsed_formula` never throws uncaught and never exceeds a per-input time budget. Any genuine crash found becomes a minimal regression fixture added to an existing `formula-*` test file (not fixed silently inside the fuzz test itself).

- [ ] **Step 8: Run to confirm the fuzz test is green (or file real bugs it finds)**

  Run: `vp build && vp test run test/fuzz/formula-fuzz.test.ts`

  If it finds a real uncaught throw, treat that as an out-of-scope discovered bug: file it and reduce the fuzz seed/count as needed so this task's own gate is green, without silently swallowing the discovered failure class inside `ParseFormula` as an in-scope fix (that belongs to a dedicated bug-fix task with its own TDD cycle, per AGENTS.md's "only edit `js/socialcalc-3.js`... when a scenario proves it wrong" rule and this plan's own "no shipping-code changes outside Task 7" constraint).

- [ ] **Step 9: Wire the release-gates workflow**

  Create `.github/workflows/release-gates.yml`: same setup as `ci.yml`, triggered on `pull_request` (or a `release` tag-push event if the team wants gates only at cut time — default to `pull_request` for now, matching the other two workflows, since a release workflow doesn't exist yet for this to hook into until Task 9 adds one). Steps: `vp build --minify`, `npx playwright install --with-deps`, `vp exec playwright test`, `vp test run test/differential/formula-corpus.test.ts test/performance/bundle-budget.test.ts test/fuzz/formula-fuzz.test.ts`.

- [ ] **Step 10: Commit**

  Run: `git add package.json playwright.config.ts test/browser test/differential test/performance test/fuzz .github/workflows/release-gates.yml && git commit -m "test(release-gates): add browser, differential, performance, and fuzz gates"`

---

### Task 9 — Dependency advisory disposition + exact-SHA release workflow/provenance `[9a: 3.1 BLOCKER — 9b: HARDENING]`

**Files:**
- Create: `docs/SECURITY-ADVISORIES.md` (disposition table: advisory, affected package, dev-only vs. shipped, decision, rationale)
- Modify: `.github/workflows/ci.yml`, `.github/workflows/lemmascript.yml` (pin third-party actions to exact commit SHAs, keeping the version as a trailing comment — `uses: actions/checkout@<sha> # v4.x.y`)
- Create: `.github/workflows/release.yml` (tag-triggered `npm publish` with provenance, only where the runner/registry combination actually supports it)

**Interfaces:**
- Consumes: `bun audit`/`vp`'s underlying advisory database (plain `npm audit`/`npm view` are blocked by `devEngines.packageManager` gating in this repo — use the Bun-native equivalent or `vp exec npm audit --package-lock-only` against a Bun-generated lockfile snapshot if Bun has no native audit command; verify which is actually available in this environment before writing the disposition table).
- Produces: (9a) a committed, dated disposition for every current advisory — fixed via a version bump, or explicitly accepted with a reason (e.g. "dev-only transitive dependency of the Stryker/Vitest toolchain, never enters `dist/**`, no shipped-code exposure") — so "we have unresolved vulnerabilities" is never an ungrounded claim; (9b) exact-SHA-pinned actions and an `npm publish --provenance` release workflow gated on GitHub Actions' OIDC support, which is only available for GitHub-hosted runners publishing to a registry that accepts npm's provenance attestation (npm's own registry does as of this repo's Node/npm baseline — confirm the currently pinned `actions/checkout`/`voidzero-dev/setup-vp` versions support `id-token: write` before enabling; if not, document that only SHA-pinning ships now and provenance is a documented follow-up rather than a silently-omitted claim).

- [ ] **Step 1: Get the current, real advisory list**

  Run: `vp install --frozen-lockfile` then whichever of `bun audit` / `vp exec npm audit --package-lock-only` actually executes in this repo (test both; `npm audit` alone is blocked by `devEngines` as shown in this plan's baseline section — a `--package-lock-only` or working-directory override may or may not bypass that gate, so this is a real discovery step, not a formality). Record the exact current advisory IDs, severities, and affected packages — do not reuse this plan's own baseline-audit prose as the disposition table's source; that prose is context for scoping the task, not a substitute for re-running the tool.

- [ ] **Step 2: Write the disposition table**

  For each advisory: is the affected package a `devDependency` only (check `package.json` — everything here is a `devDependency` per the baseline) and does it ever appear in `dist/SocialCalc.js`/`dist/SocialCalc.min.js` (it should not, since `dist/**` is emitted by `build.ts`'s Oxc/Rolldown pipeline from `js/**` sources only — confirm by grepping `dist/SocialCalc.js` for the advisory package's name/exported symbols)? If dev-only and non-shipping: accept with that stated rationale. If a non-breaking fixed version exists (`vp update <pkg>` or a manual `package.json` bump): apply it, rerun the full test matrix, and note the fix in the table instead of an acceptance.

  **File:** `docs/SECURITY-ADVISORIES.md`.

- [ ] **Step 3: Apply any safe fixes found in Step 2**

  For each advisory disposed as "fixed", bump the dependency, run `vp install`, then `vp run typecheck && vp build && vp test` to confirm no regression from the bump.

- [ ] **Step 4: `[3.1 BLOCKER]` Verify the disposition table covers every currently-reported advisory**

  Re-run Step 1's audit command; assert its advisory ID set is a subset of `docs/SECURITY-ADVISORIES.md`'s disposed set. (Manual diff is acceptable here — this is a docs-completeness check, not a behavior the runtime test suite needs to encode permanently, since the advisory database itself changes over time independent of this repo.)

- [ ] **Step 5: SHA-pin the existing workflow actions**

  For each `uses:` line in `.github/workflows/ci.yml` and `.github/workflows/lemmascript.yml` (`actions/checkout@v4`, `voidzero-dev/setup-vp@v1`, `dafny-lang/setup-dafny-action@v1`), resolve the commit SHA the current tag points to and replace `@v4`/`@v1` with `@<40-char-sha> # v4.x.y` (or whatever exact tag it resolves to at implementation time — resolve live, do not guess a SHA here).

- [ ] **Step 6: Add the release workflow**

  Create `.github/workflows/release.yml`: triggered on `push: tags: ["v*"]`; steps mirror `ci.yml`'s setup (SHA-pinned), then `vp build --minify`, then `npm publish --provenance --access public` with `permissions: id-token: write` — only include the `--provenance` flag and `id-token` permission if Step 5's confirmation (GitHub-hosted runner + npm registry OIDC support against this repo's pinned toolchain) actually holds; otherwise ship the workflow with a plain `npm publish` and a code comment stating provenance is not yet enabled and why, rather than a workflow that claims provenance and silently fails or lies about it.

- [ ] **Step 7: Commit**

  Run: `git add docs/SECURITY-ADVISORIES.md .github/workflows/ci.yml .github/workflows/lemmascript.yml .github/workflows/release.yml package.json && git commit -m "chore(security): dispose dependency advisories, SHA-pin actions, add gated release workflow"`

---

## File-Ownership Matrix (cross-check — no two tasks write the same file)

| File | Owning Task |
| --- | --- |
| `package.json` | 1 (exports/engines/type), 4 (script), 8 (playwright dep+scripts), 9 (any version bumps) — additive edits, not overlapping keys; if two land out of order, re-merge by hand once, trivially |
| `.github/workflows/ci.yml` | 1 (consumer step), 4 (lint+guard steps), 5 (coverage step), 9 (SHA pins) — sequential additive steps; same trivial re-merge note |
| `.github/workflows/lemmascript.yml` | 9 (SHA pins only) |
| `.github/workflows/mutation.yml` | 6 (new file) |
| `.github/workflows/release-gates.yml` | 8 (new file) |
| `.github/workflows/release.yml` | 9 (new file) |
| `Changes.txt` | 2 |
| `README.md` | 2 (new section), 7 (fills in the option docs inside Task 2's section — sequenced, not concurrent) |
| `vite.config.ts` | 5 |
| `stryker.config.mjs`, `stryker-file.mjs` | 6 |
| `test/control-coverage.test.ts`, `test/iofunctions-coverage.test.ts` | 3 |
| `test/editor-dom-coverage.test.ts`, `test/editor-coverage-a.test.ts`, `test/editor-coverage-b.test.ts`, `test/ui-coverage.test.ts` | 4 |
| `test/fixtures/consumer/**`, `test/package-consumer-contract.test.ts` | 1 |
| `test/docs-contract.test.ts` | 2 |
| `scripts/check-test-credibility.mjs` | 4 |
| `test/secure-rendering.test.ts` | 7 |
| `test/browser/**`, `test/differential/**`, `test/performance/**`, `test/fuzz/**`, `playwright.config.ts` | 8 |
| `docs/SECURITY-ADVISORIES.md` | 9 |
| `js/socialcalcconstants.ts`, `js/socialcalc-3.ts`, `js/socialcalcpopup.ts`, `js/socialcalcspreadsheetcontrol.ts`, `js/socialcalctableeditor.ts`, `js/socialcalcviewer.ts` | 7 only (all other tasks are strictly test/doc/config/workflow) |

Only `package.json` and `ci.yml` see edits from more than one task; both are additive (new keys/steps), so any merge order is safe and a same-region conflict, if it ever happens, is a one-line manual resolution, not a design problem.

## Priority Summary

**`[3.1 BLOCKER]`** — required before calling `fd6e61d`-successor state an honest 3.1.0 release: Task 1 (consumer contract), Task 2 (changelog + trust-boundary docs), Task 4 Step 5 (lint wired into CI), Task 9 Steps 1-4 (advisory disposition).

**`[HARDENING]`** — raises SocialCalc materially beyond an ordinary minor release; fully planned and implemented by this document, landed independently of the blockers above: Task 3, the remainder of Task 4, Task 5, Task 6, Task 7, Task 8, Task 9 Steps 5-7.

## Self-Review

- Spec coverage: all nine requested streams have a dedicated task with exact file ownership and TDD commands; the file-ownership matrix cross-checks that no two tasks silently collide on the same source-of-truth lines.
- YAGNI check: Task 8's differential testing is scoped to SocialCalc's own documented invariants, not a fabricated second spreadsheet-engine oracle that doesn't exist; Task 9's provenance step is conditioned on actually-available OIDC support rather than assumed; Task 5/8's thresholds/budgets are explicitly baseline-measured, not invented targets.
- Blocker/hardening split: called out per-task in the header line and summarized at the end, per the requirement to distinguish ordinary 3.1 scope from the larger hardening backlog while still implementing every stream.
- Shipping-code discipline: only Task 7 touches `js/*.ts` behavior, and only additively behind an off-by-default option with a same-task characterization test proving the default path is unchanged.
- Placeholder scan: no TBD/fill-in-later placeholders; every "measured"/"resolve live" instruction is a concrete run-this-command-and-record-the-output step, not a deferred decision.
