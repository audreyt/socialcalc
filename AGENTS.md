# SocialCalc maintainer guide

This file is the operational map for future maintainers and coding agents. Read
it before changing source, tests, build logic, package metadata, formal facades,
or release workflows.

## Non-negotiable invariants

1. **Shipping code is ordered global-script TypeScript, not ES modules.** The
   files under `js/` share one factory-local `SocialCalc` namespace. Preserve
   source order and global bindings.
2. **Edit sources, never generated output by hand.** `build.ts` owns the bundle.
   Change `js/*.ts` or `css/socialcalc.css`, run the build, and commit any
   changed tracked `dist/SocialCalc.js` / `dist/socialcalc.css` output.
3. **Use Vite+ as the project interface.** Package operations use `vp install`,
   `vp add`, `vp remove`, and `vp update`; commands use `vp run` / `vp exec`.
   Do not introduce direct `bun install`, `bun add`, `npm install`, or `bunx`
   workflows. Bun 1.3.14 is pinned by `bun.lock` and managed by Vite+; `devEngines.packageManager` keeps `name: "bun"` with `onFail: "ignore"` so npm publish does not reject it under `EBADDEVENGINES` (npm only supports `onFail` values `warn`, `error`, `ignore`; the previous `download` was unsupported and treated as `error`).
4. **Tests assert behavior.** No tautologies, swallowed errors, source-text
   checks for runtime behavior, arbitrary sleeps, or mocks that merely replay
   the implementation. Use the credibility guard.
5. **Default rendering compatibility is intentional.** The untrusted-content
   policy is opt-in and off by default. Security fixes must preserve the legacy
   path unless the change explicitly revises that public contract.
6. **Formatting, lint, and types are one gate.** `vp check` runs Oxfmt in
   check mode plus warning-denying, type-aware lint and typechecking. Use
   `vp check --fix` before committing; do not add `oxlint-disable`,
   `@ts-ignore`, blanket `eslint-disable`, or equivalent debt markers.
7. **Release evidence must be real.** Coverage and mutation floors come from
   measured runs. Missing reports, unmeasured baselines, skipped scripts, and
   placeholder values are failures, not acceptable fallbacks.
8. **Do not tag or publish casually.** A tag only builds a candidate. npm
   publishing is a separate, manual, environment-gated workflow dispatch.

## Repository map and ownership

| Path                                                        | Ownership and role                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `js/*.ts`                                                   | Hand-maintained shipping implementation; global scripts in build order.                               |
| `js/*.d.ts`                                                 | Hand-maintained public/ambient declarations. Keep runtime and declarations aligned.                   |
| `css/socialcalc.css`                                        | Hand-maintained stylesheet source.                                                                    |
| `build.ts`                                                  | Vite plugin, ordered source list, Oxc transforms, sourcemaps, UMD wrappers, CSS/minification outputs. |
| `vite.config.ts`                                            | Build plugin wiring, Vitest discovery, lint policy, unit coverage floors.                             |
| `coverage-thresholds.mjs` / `.d.ts`                         | Single coverage contract shared by Vitest and browser-coverage merge.                                 |
| `dist/SocialCalc.js`                                        | Tracked generated normal UMD bundle. Regenerate; never hand-edit.                                     |
| `dist/socialcalc.css`                                       | Tracked generated CSS. Regenerate; never hand-edit.                                                   |
| `dist/SocialCalc.d.ts`                                      | Tracked declaration aggregator referencing public `js/*.d.ts`. Do not delete it.                      |
| `dist/SocialCalc.min.js`                                    | Generated, Git-ignored release artifact. `prepack` recreates it.                                      |
| `dist/SocialCalc.js.map`                                    | Coverage-only, Git-ignored sourcemap. Plain builds remove stale copies.                               |
| `test/`                                                     | Vitest behavior, regression, differential, adversarial, performance, package, and gate tests.         |
| `test/helpers/socialcalc.ts`                                | Shared UMD loader and fake-DOM foundation. Changes have suite-wide blast radius.                      |
| `test/fixtures/oracle-3.0.8/`                               | Pinned, offline compatibility oracle. Never fetch or rewrite it during tests.                         |
| `e2e/`                                                      | Real-browser Playwright fixtures and tests for DOM, layout, interaction, security, and bundle parity. |
| `scripts/`                                                  | Standalone package, coverage, mutation, credibility, canary, registry, and workflow guards.           |
| `lemma/*.ts`                                                | Hand-maintained exported facades mirroring selected pure shipping policies.                           |
| `lemma/*.dfy`                                               | Hand-maintained proof-bearing Dafny models.                                                           |
| `lemma/*.proof.lean`, `lemma/a1.spec.lean`                  | Hand-maintained Lean proof/support files.                                                             |
| `lemma/*.dfy.gen`, `lemma/*.types.lean`, `lemma/*.def.lean` | Generated formal artifacts.                                                                           |
| `stryker-mutation-baseline.json`                            | Measured per-module mutation floors; never invent values.                                             |
| `stryker-mutation-disposition.json`                         | Source-specific critical-mutant proofs, not an exclusion list.                                        |
| `docs/security-sink-inventory.md`                           | Enumerated sheet-derived rendering sinks and policy coverage.                                         |
| `docs/security-disposition.json`                            | Accepted dependency advisories, owners, reachability, and expiry conditions.                          |
| `.github/workflows/release.yml`                             | Tag candidate DAG and separately gated manual publish path.                                           |

## Toolchain and setup

- Node consumer floor: `>=22`; CI tests packed tarballs under Node 22 and 24.
- Bun package manager: 1.3.14, provisioned by Vite+.
- TypeScript: lockfile resolution, currently 7.0.2.
- LemmaScript/lsc: 0.5.13.
- Dafny in CI: 4.9.0.
- Lean: 4.24.0.
- Lake solvers: Z3 4.15.4 and cvc5 1.3.1.

Release-equivalent install:

```bash
vp install --frozen-lockfile
```

Ordinary local install after an intentional dependency change:

```bash
vp install
```

When changing dependencies, use the Vite+ package commands, inspect the lockfile
movement, run the appropriate audit, and update `docs/security-disposition.json`
if a documented dependency path or expiry condition changed.

## Build model

`build.ts` exports the plugin consumed by `vite.config.ts`. It:

- owns the exact ordered shipping source list;
- prefers sibling `.ts` implementations;
- strips types with Oxc without turning files into modules;
- preserves each source's license preamble;
- serializes inline UMD open/close wrappers;
- emits `dist/SocialCalc.js` in canonical Oxfmt form and `dist/socialcalc.css`;
- emits `dist/SocialCalc.min.js` when `--minify` is requested; and
- emits an unformatted, exactly mapped source bundle only when
  `SOCIALCALC_COVERAGE=1`.

The UMD exposes `root.SocialCalc` in a browser and `module.exports` in CommonJS.
There is deliberately no AMD branch. `package.json` is explicitly CommonJS;
native ESM uses the default import only.

Normal build:

```bash
vp build
```

Release/package build:

```bash
vp build --minify
```

`prepack` always runs the minifying build. Never assume an existing minified
file is current.

### Build verification traps

- A plausible-looking aggregate coverage report does not prove source-map
  correctness. `test/build-sourcemap.test.ts` round-trips unique generated
  anchors to exact source lines and columns.
- Coverage source-map generated lines must account for preserved license
  preambles. A per-file preamble offset can produce convincing but wrong
  attribution.
- Ordinary builds run `vp fmt --write dist/SocialCalc.js` from the build
  plugin. Coverage builds must not: post-mapping formatting would invalidate
  generated line/column mappings.
- The `dist/SocialCalc.js` formatter override preserves single quotes because
  EtherCalc's pinned headless adapter rewrites the legacy UMD `globalThis`
  expression verbatim. The EtherCalc canary is the behavioral guard.
- Normal builds must not ship a coverage map/comment.
- `dist/**` is ignored by lint because diagnostics must be fixed at the source.
- If the ordered source list changes, verify browser-global and CommonJS bundle
  shape, package contents, minified parity, sourcemaps, and licenses.

## Required checks by change

Run focused behavior first. Run broader gates after the change works.

| Change                                    | Required checks                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentation only                        | `vp fmt --check <files>` plus every command/config fact referenced by the edit.                                                                              |
| Ordinary `js/` change                     | `vp build`, focused Vitest file(s), `vp check`.                                                                                                              |
| Public declaration change                 | `vp check`, `vp run test:package-contract`; add a packed-consumer type assertion when the public surface changes.                                            |
| `build.ts` / source ordering / UMD change | `vp run typecheck:strict`, `vp build`, `vp fmt dist/SocialCalc.js --check`, coverage attribution tests, bundle serialization/parity tests, package contract. |
| Formula-reference rewrite                 | The dedicated formula matrix below plus command-level scenarios.                                                                                             |
| Security policy or sink                   | Security unit tests, sink inventory review, Chromium active-content test, full browser suite if DOM behavior changed.                                        |
| Popup/editor UI behavior                  | Focused hardening test plus the relevant Playwright interaction.                                                                                             |
| Test helper/fake DOM                      | All directly dependent test files, credibility guard, then the full Vitest suite.                                                                            |
| Coverage config/merge                     | Unit coverage, mapping/guard tests, merged coverage, and a deliberate negative threshold/source-integrity probe.                                             |
| Mutation config/baseline/disposition      | Workflow verifier, disposition verifier/tests, targeted Stryker run when measurement changes, and release-gate validation.                                   |
| Lemma facade                              | Focused facade-oracle test, Dafny regeneration/check, Lean generation smoke.                                                                                 |
| Package manifest/dependency               | Frozen install, `vp check`, package contract, audit, deterministic pack if release-facing.                                                                   |
| Workflow                                  | `vp check`, `actionlint`, and the local workflow verifier/script that exercises the changed contract.                                                        |
| Release candidate                         | `vp check` plus full tag DAG: core, merged coverage, full mutation, three browsers, EtherCalc canary, package contract, deterministic pack.                  |

Do not run a full Stryker matrix as routine verification for an unrelated edit.
Do not skip a focused behavior check merely because `vp check` is green.

## Tests and credibility

`vp test` runs files importing from `vite-plus/test`. Its global setup builds a
fresh Istanbul-instrumented UMD before workers start and the full-suite command
enforces 100/100/100/100. The package script `vp run test` builds the plain
shipping bundle first, then runs that same gate. Focused file/name/shard runs
still build the current instrumented bundle but disable full-suite coverage
unless `--coverage` is explicit.

`test/helpers/socialcalc.ts` compiles the selected roughly 720 KB UMD once with
`vm.Script` per isolated Vitest worker and shares one SocialCalc instance within
that file. Default tests load `dist/SocialCalc.instrumented.js`; explicit
`SOCIALCALC_COVERAGE=1` V8 runs load `dist/SocialCalc.js`. Consequences:

- Install and restore mutable globals/callbacks in that file's hooks.
- Await editor/sheet status transitions; do not assume a scheduled command is
  synchronous when `editor.busy` may defer it.
- Do not add query-string cache busting or repeated dynamic bundle imports.
  Vite treats every query as another transformed bundle copy and can exhaust
  worker memory.
- A fake DOM is not evidence for browser HTML entity decoding, layout, native
  URL properties, focus, selection, keyboard/mouse dispatch, or image events.
  Use Playwright for those contracts.
- If a fake-DOM capability is broadly legitimate, add it to the shared shim and
  replace shim-crash expectations with real behavior. Do not encode missing
  shim methods as product behavior.

### Behavior-test standard

Every test must fail on a plausible bug and assert an observable contract:
return value, cell/formula/name state, emitted command, callback, DOM state,
status transition, error identity, package member, hash, or process result.

Avoid:

- `expect(true).toBe(true)` and equivalent tautologies;
- empty catches or catches that swallow an assertion;
- source-text assertions for runtime behavior;
- `not.toThrow()` when a stronger result/state assertion is available;
- arbitrary sleeps instead of status/selector polling;
- expected values copied from the same mutable constant/object under test; and
- tests whose only purpose is to execute lines without pinning behavior.

Run:

```bash
vp run check:test-credibility
```

The guard scans Git-tracked `test/**/*.test.ts` and `e2e/**/*.spec.ts`. A
code-free cleanup catch is allowed only when comments provide a substantive
explanation; placeholder `noop`/`TODO` comments are violations.

### Test layers

- **Vitest unit/integration:** pure helpers, sheet commands, save/load,
  fake-DOM-compatible UI state.
- **Native Bun compatibility:** `bun run test:bun` runs `test/` in isolated
  workers. Bun does not collect the `vm.Script` UMD and exposes no
  statement/branch metrics, so it is not a coverage or release gate.
- **Differential oracle:** candidate vs pinned `socialcalc@3.0.8` for formulas,
  formatting, commands, references, names, and serialization. Known intended
  differences must be explicit executable fixtures.
- **Adversarial/performance:** bounded deep/wide formulas, malformed saves,
  extreme ranges, cycles, prototype-like keys, idempotency, byte-size budgets,
  and deliberately loose wall-clock budgets.
- **Playwright:** Chromium/Firefox/WebKit, normal/minified bundles, real DOM and
  interaction. Retries are zero, workers are one, and page errors, unhandled
  rejections, console errors, and unexpected dialogs fail the spec.
- **Package contract:** fresh tarball in a real `node_modules/socialcalc`
  consumer layout across CJS, ESM-default, browser-global, declarations, and
  command/formula/save-load behavior.
- **EtherCalc canary:** networked, release-only, pinned EtherCalc commit and
  lockfile. Never add it to ordinary `vp test`.

## Coverage

### Default Istanbul gate

```bash
vp test
```

`test/global-setup.ts` calls `writeSocialCalcIstanbulBundle()` before workers
start. `build.ts` instruments each original `js/*.ts` source, assembles
`dist/SocialCalc.instrumented.js` under the normal UMD wrapper, and writes
counters to `globalThis.__VITEST_COVERAGE__`. The default gate includes the
eleven shipping modules plus the four LemmaScript facades and requires
100/100/100/100.

The instrumented bundle is gitignored and never shipped. Ordinary `vp build`
deletes stale instrumented output. Do not make tests depend on an artifact from
a previous command.

### Explicit V8/source-attributed mode

```bash
vp run test:coverage
```

This sets `SOCIALCALC_COVERAGE=1` for both build and test. The build emits
`dist/SocialCalc.js.map` plus a `sourceMappingURL` comment; Vitest/V8 coverage
from the `vm.Script` bundle is remapped to original `js/*.ts`. Plain builds
remove the stale map and comment.

The V8 configuration intentionally does **not** set `coverage.include`. Its
shipping set is established by loaded bundle sources plus the shared
exclusions. A wrong include glob can silently zero every source or reintroduce
non-shipping files.

### Merged unit + Chromium mode

```bash
vp run test:coverage:merged
```

This sequence builds coverage/minified artifacts, runs unit coverage, runs the
mapping and merger guards, collects Chromium V8 coverage, and merges both into
`coverage-merged/`.

The merger must fail when:

- browser coverage omits the exact source bytes;
- source bytes differ from the built bundle;
- converted coverage has zero usable ranges;
- malformed JSON appears;
- any merged file/metric is less than unit-only coverage; or
- a global/per-file floor is missed.

`coverage-thresholds.mjs` is the only threshold/filter source for V8 and merged
browser coverage. Do not duplicate those numbers in `vite.config.ts` or the
merger. Istanbul's separate exact-coverage contract is the explicit 100s in
`vite.config.ts`.

Current V8 floors:

- unit global: statements 98, branches 80, functions 98, lines 98;
- merged global: statements 98, branches 84, functions 98, lines 98;
- per-file: the seven entries in `thresholdContract.perFile`.

`check:coverage-attribution` protects against the generated bundle being counted
as a second source and against non-monotonic attribution. Preserve exact-line
round-trip tests when source line counts shift; tests locate unique anchors
rather than hard-coding current line numbers.

## Rendering security

The historical default is intentionally trusted-content mode:

```js
SocialCalc.Callbacks.untrustedContent === false;
```

When set to `true`:

- raw HTML sinks are escaped or passed through
  `securityPolicy.sanitizeHtml`;
- ordinary URLs use `allowedUrlSchemes`;
- `data:` URLs use only `allowedDataMimeTypes` and are rejected by default;
- formula-widget `cell_html` rendering is disabled; and
- rejected content becomes inert escaped text rather than throwing.

`SafeUrlForRender` returns HTML-attribute-escaped content. Its return value is
for markup parsed as HTML, not for persistence or direct assignment to
`Element.href` / `.src`. HTML entity decoding is a browser behavior; preserve
real Chromium tests for entity-encoded schemes and attribute injection.

Security work must update all three surfaces together:

1. `docs/security-sink-inventory.md`;
2. `test/render-security-policy.test.ts`; and
3. `e2e/active-content-security.spec.ts` when browser parsing matters.

Keep default-mode byte compatibility tests. Never market the opt-in policy as a
host-wide sanitizer: hosts still own CSP, callback outputs outside enumerated
sinks, sanitizer correctness, and trust decisions.

## Formula-reference compatibility

The pure helpers in `js/formula-ref.ts` are the shipping oracle for
`OffsetFormulaCoords`, `AdjustFormulaCoords`, `ReplaceFormulaCoords`, and A1
coordinate algebra unless a command-level spreadsheet scenario proves current
behavior wrong. Command handling lives in `js/socialcalc-3.ts`.

Required matrix:

```bash
vp build
vp test run test/formula-rewrite-cases.test.ts test/formula-rewrite-regressions.test.ts
vp check
```

Use `ScheduleSheetCommands` / `loadSocialCalc()` scenarios for copy, paste,
fill, move, insert, delete, sort, and undo. Direct helper tests alone are not
enough.

Primary evidence:

- `test/fixtures/formula-rewrite-cases.json`
- `test/formula-rewrite-cases.test.ts`
- `test/formula-rewrite-regressions.test.ts`
- `test/command-boundary-regressions.test.ts`
- `test/filldown-persistence.test.ts`
- `test/sheet-coverage-b.test.ts`

Compatibility rules:

- `$` markers lock copy/fill references, not structural insert/delete.
- Sheet-qualified ranges intentionally keep `sheetref` sticky through `:`.
- Maximum column is `ZZ` (702); shifts past it become `#REF!`.
- Rectangular fills increment independently per row/column.
- Interactive fills capture `range2` before clearing it.
- Delete undo restores changed named-reference definitions and formulas.
- Lowercase/parser normalization and no-op paste normalization are policy
  questions until a concrete spreadsheet behavior fails.

Promote model output only as exact fixtures or regressions with calls,
commands, and expected outputs. Prose is not evidence.

## LemmaScript operations

Shipping `js/*.ts` files are global scripts and cannot be extracted directly by
LemmaScript. The exported facades in `lemma/` mirror selected pure shipping
behavior. Dafny/Lean apply to the facades; Vitest cross-checks them against the
shipping bundle.

`LemmaScript-files.txt` contains:

- `lemma/a1.ts`: A1 coordinate/clamp algebra, absolute helpers, overflow
  `#REF!` policy — 26 Dafny VCs;
- `lemma/eval-ops.ts`: `/` and `&` error/type lattice — 4 VCs;
- `lemma/lookup-result.ts`: token resolution and exact-before-wildcard-before-
  miss precedence — 3 VCs. Full row scanning stays runtime-tested;
- `lemma/spill.ts`: dynamic-array spill runtime pure policies — rectangle
  planning (shape/bounds/resource-limit precedence), transactional claim
  classification (reclaimable vs. collision), resize membership
  (retained/grown/stale/outside), stable UNIQUE keep policy, and stable SORT
  tie-break policy — 15 Dafny VCs;
- `lemma/weekday-policy.ts`: WORKDAY/WORKDAY.INTL/NETWORKDAYS/
  NETWORKDAYS.INTL weekend-code/mask policy — numeric weekend-code legality
  and decode to a Mon..Sun mask, weekend-mask legality (rejects the
  all-non-working mask), per-day mask lookup, and the working-day/step-
  direction decision — 29 Dafny VCs. Calendar/holiday-scan loops stay
  runtime-tested.
- `lemma/statistics.ts`: RANK.AVG tie-averaging and QUARTILE.EXC
  interpolation-domain policies, restated as exact-integer arithmetic (the
  real-valued average/position are unverified one-line bridges around the
  proved integer core, same split as `spill.ts`'s `planSpillRectangle`) —
  3 Dafny VCs.

Total: **87 VCs (26 + 5 + 3 + 15 + 29 + 3 + 3 + 3)**.

After a facade edit:

1. run its focused `test/lemma-*-facade.test.ts` oracle test;
2. run `vp run verify:dafny:regen` (three-way merge);
3. run `vp run verify:dafny`;
4. run `vp run verify:lean`;
5. run `vp run verify:lean:build` only when sibling repositories exist.

`vp run verify:both` is Dafny plus Lean generation/non-empty smoke, not a Lake
build. Plain `verify:dafny:gen` does not update proof-bearing `.dfy` files.
Never routinely copy `.dfy.gen` over `.dfy`.

`verify:dafny:regen`, `verify:lean:gen`, and `verify:lean`'s non-empty-artifact
assertion are all driven by `scripts/lemmascript-manifest.mjs`, which reads
`LemmaScript-files.txt` once and loops over every listed facade — adding a
facade to that file is enough; no package.json script or
`.github/workflows/lemmascript.yml` step needs a matching hand-edit. `lsc`'s
own CLI already batches `gen`/`gen-check`/`check` over the manifest with no
file argument (used as-is by `verify:dafny`/`verify:dafny:gen`); the script
exists only for `regen` (which `lsc` cannot batch) and the non-empty-artifact
assertion (which `lsc` has no equivalent for).

Facade oracle mapping:

- A1: `rcColname`, `crToCoord`, `OffsetFormulaCoords`,
  `AdjustFormulaCoords`;
- eval ops: shipping `evaluate_parsed_formula`;
- lookup result: shipping `Formula.LookupResultType` plus complete row-scan
  runtime tests;
- spill: shipping `Formula.PlanSpillStatus`, `Formula.ClassifySpillClaim`,
  `Formula.ClassifyResizeMembership`, `Formula.KeepUniqueItem`,
  `Formula.StableTieCompare`, and the `Formula.SPILL_MAX_COL`/
  `SPILL_MAX_ROW`/`SPILL_MAX_CELLS` constants. `test/lemma-spill-facade.test.ts`
  cross-checks every function against its shipping counterpart exhaustively
  and at boundary cases, plus a live `SORT()`/`UNIQUE()` formula smoke test;
- weekday policy: shipping `Formula.DecodeWeekendArgument` (exhaustive over
  every legal numeric weekend code) plus a live `WORKDAY.INTL()` formula
  smoke test asserting the shipping evaluator never lands on a day the
  facade classifies as non-working for the same mask. See
  `test/lemma-weekday-policy-facade.test.ts`.
- statistics: shipping `Formula.DoubledAverageRank`,
  `Formula.QuartileExcScaledPosition`, `Formula.IsValidQuartileExcPosition`.
  `test/lemma-statistics-facade.test.ts` cross-checks every function against
  its shipping counterpart exhaustively over small inputs, plus live
  `RANK.AVG()`/`QUARTILE.EXC()` formula smoke tests. Not every new pure
  helper in the math/stat compatibility batch gets a facade — see
  `lemma/statistics.ts`'s header for the deliberate scope boundary (only
  genuinely integer-exact boundary/tie classification is proved; plain
  arithmetic folds and floating-point iterative solvers are not).

## Mutation testing

Stryker covers all eleven shipping modules with no mutator exclusions.
`stryker-file.mjs` is the source of truth for target modules and owned test
subsets. `.github/workflows/mutation.yml` derives its full matrix from
`ALL_MUTATE_FILES`; do not hand-copy the module list into the workflow.

Stryker builds one all-mutant UMD after instrumenting each sandbox. The native
`@stryker-mutator/vitest-runner` keeps isolated workers alive and selects tests
with per-test mutation coverage. `formatnumber2.ts` and
`socialcalcconstants.ts` deliberately retain the command runner so every active
mutant re-evaluates their top-level tables/defaults in a fresh process. Never
rebuild the shared bundle per mutant: concurrent command runners race on the
same output and produce false kill results. Do not add other modules to the
command-runner set without evidence; rerunning the full owned subset per mutant
pushes large modules toward the release timeout. Since shipping sources are
concatenated into a `vm.Script` bundle, `vitest.related` must remain `false`;
`stryker.config.mjs` forwards the owned test list through
`SOCIALCALC_MUTATION_TESTS` for `vite.config.ts` to use as `test.include`.

Modes:

```bash
MUTATE_SCOPE=critical vp run mutate
MUTATE_TARGET=js/formula-ref.ts vp run mutate
vp run mutate:file js/formula-ref.ts 100-220
vp run mutate:all
vp run mutate:release-gate
```

Range-restricted `mutate:file` runs are exploratory only. They use
`reports/mutation/<module>-partial/`, an exact-range incremental cache, and no
break floor. Never copy or rename a partial report into a full-module path:
the release gate requires complete exact-module evidence.
`MUTATION_CACHE_SCHEMA` in `stryker-file.mjs` namespaces incremental results;
bump it whenever runner/build lifecycle changes are not represented by source
or test diffs.

- Critical PR scope: `formula-parse.ts`, `formula-operand.ts`,
  `formula-ref.ts`; measured break threshold 95.
- Full scope: one isolated matrix leg for each module, using that module's
  measured integer floor from `stryker-mutation-baseline.json`.
- Release enforcement: all eleven fresh reports must exist, identify the exact
  expected module, contain valid statuses, meet the measured floor, and contain
  at least that baseline's `minimumMutants` complete-module count.
- Scheduled/full runs upload every report with matrix `fail-fast: false`.
- In-place mutation is unsupported. Do not add it back.

Baseline policy: `break = Math.floor(actual measured score)`. Never hand-set a
floor without a fresh exact-module run. The current scores/floors are documented
in README and the registry.
`minimumMutants` is the mutant total from that same exact report; update it only
from a fresh full-module measurement, never a range-restricted experiment.

Disposition policy:

- A disposition key is the stable `(file, mutatorName, location, replacement)`
  tuple, never a Stryker run-local numeric ID alone.
- Justification must prove equivalence/unreachability against current source.
- Registry entries missing from a fresh report are stale and fail validation.
- A disposition still present as `Killed` is not stale; the proof remains valid
  and may document incidental killing by another test.
- Do not fabricate a tuple from prose or an unavailable report.

Reports live under `reports/mutation/<scope>/` and are generated evidence, not
shipping artifacts.

## TypeScript and declarations

All eleven core implementation modules are intended to typecheck:

- `formatnumber2.ts`
- `formula-parse.ts`
- `formula-operand.ts`
- `formula-ref.ts`
- `formula1.ts`
- `socialcalcconstants.ts`
- `socialcalc-3.ts`
- `socialcalcspreadsheetcontrol.ts`
- `socialcalctableeditor.ts`
- `socialcalcviewer.ts`
- `socialcalcpopup.ts`

Keep this statement honest. Tighten `any` bridges when a runtime/public surface
requires it; do not claim an ES-module rewrite or complete public typing that
does not exist. Public declaration edits require a packed external TypeScript
consumer check with `skipLibCheck=false`, which the package contract supplies.

If typechecking suddenly reports thousands of missing `SocialCalc` namespace
errors, first check that tracked `dist/SocialCalc.d.ts` still exists. It is the
aggregator that references every ambient `js/*.d.ts` file and is included by
both tsconfig files.

## Package and release operations

The package ships a pinned 17-member tarball contract. `package.json.files` and
`scripts/verify-package-contract.mjs` each hold deliberate expected manifests;
update both in the same reviewed change when the published file set changes.
Do not derive expected members from the manifest under test.

Run:

```bash
vp run test:package-contract
vp pm pack --out /tmp/socialcalc-candidate.tgz
```

The contract verifies:

- exact members and component/package size ceilings;
- explicit CommonJS type and Node floor;
- root CommonJS, deep minified CommonJS, native ESM default import;
- normal/minified browser globals and API-shape parity;
- strict external declarations;
- command, formula, recalc, save, and load behavior; and
- deterministic metadata/timestamps needed for pack-twice identity.

### Release workflow

A `v*` tag runs five independent required gates:

1. core: `vp check` (format, lint, types), strict typecheck, build, Vitest,
   credibility, Dafny, Lean generation, blocking high/critical audit;
2. merged source coverage;
3. full eleven-module mutation matrix and release-gate aggregation;
4. Chromium/Firefox/WebKit Playwright;
5. pinned EtherCalc candidate-tarball canary.

`package` needs all five. It reruns the package contract, packs twice, rejects
non-identical archives, retains one, records SHA-256 and npm integrity, archives
the moderate audit snapshot, and uploads one release artifact.
The pack step runs with `set -o pipefail`: materialize `tar -tzf` output before
`grep -q`. Piping `tar` directly into an early-exiting grep gives `tar` a broken
pipe and falsely reports an existing member as missing.

A tag push **never publishes**. Manual publish requires:

- dispatch against the real tag with input `PUBLISH`;
- npm Trusted Publisher registration for this repository and `release.yml`;
- protected `npm-publish` GitHub Environment reviewers; and
- GitHub Release immutability enabled.

The publish job re-verifies artifact filename/tag/commit/version/hash/integrity,
stages a draft GitHub Release, verifies the uploaded asset, publishes the exact
tarball with OIDC provenance, publishes and checks the immutable release, then
runs a fresh registry-install smoke across CJS root, minified CJS, and ESM
default delivery.

Do not replace this path with a local `npm publish`. Do not delete the GitHub
Release if a post-publish immutability check fails: npm publication is already
irreversible, and deleting the release would destroy evidence.

### Dependency audit

`vp pm audit --level high` is release-blocking. `vp pm audit --level low` is the
full review input. Two moderate dev-only findings are currently accepted in
`docs/security-disposition.json`; each has an owner and time/upstream-triggered
expiry. Re-audit whenever dependencies change or an expiry condition fires.
No advisory package is included in the npm tarball.

GitHub Actions must remain pinned to exact commit SHAs with version comments,
least-privilege permissions, explicit timeouts, and release concurrency that is
not cancelled. Run `actionlint` after workflow edits.

## Commit and worktree hygiene

- Treat unexpected modifications as concurrent user work. Never reset, clean,
  stash, or commit them without establishing ownership.
- Commit only the files/hunks required by the current task. Generated bundle
  changes can coexist with unrelated source work; stage deliberately.
- Do not use a dirty old branch as release truth. Fetch and compare with
  `origin/main`; perform release changes in a clean worktree based on the exact
  intended commit.
- Regenerate tracked distribution output from the exact source tree being
  committed. Do not smuggle unrelated generated drift into a focused commit.
- Keep `Changes.txt`, `README.md`, package version, tag, and release artifact
  version aligned.
- Before calling a release ready, verify the gates that the release workflow
  will actually execute. A local subset is not equivalent to the tag DAG.
