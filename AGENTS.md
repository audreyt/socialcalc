# Agent notes

## Source and quality-gate operations

SocialCalc's shipping implementation is assembled from global-script TypeScript,
not ES modules. `build.ts` exports the Vite plugin configured by
`vite.config.ts`; it owns the ordered source list, prefers sibling `.ts`
implementations, strips types with Oxc, and emits `dist/SocialCalc.js` plus
`dist/socialcalc.css`; `vp build --minify` additionally emits
`dist/SocialCalc.min.js`. Its UMD wrappers are inline strings because they are
not standalone modules. Edit `js/` and `css/` sources, never generated `dist/`.

Normal source-only changes use this matrix:

| Change                                | Required checks                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Ordinary `js/` or build-source change | `vp build`, `vp run typecheck`, `vp lint`, then the focused Vite+ tests            |
| Formula-reference rewrite             | The matrix below, plus the focused command tests                                   |
| LemmaScript facade                    | The facade matrix below; optional full Lean build when sibling repos are available |

`vp run typecheck` is the ordinary `tsc --noEmit` compiler check from
`tsconfig.json`. `vp run typecheck:strict` is a separate narrower check:
`tsconfig.strict.json` includes only `build.ts` and disallows JavaScript input.

Use `vp install`, `vp add`, `vp remove`, and `vp update` as the package-management
surface. Vite+ delegates to the Bun version pinned in `devEngines`; direct
`bun install`/`bun add` commands are not the project workflow.

The package ships both normal and minified UMD bundles. `prepack` always runs
`vp build --minify`; `dist/SocialCalc.min.js` is gitignored and must never be
hand-maintained. Before a package release, run `vp pm pack --out <temporary.tgz>`
and verify the archive contains `package/dist/SocialCalc.min.js`.

`vp lint` is the Vite+ lint/type-aware gate. `vite.config.ts` enables
`typeAware`, `typeCheck`, and `denyWarnings`, so the bare command performs full
type-aware linting, typechecks, and fails on warnings. It ignores `dist/**`
because generated artifacts must be corrected in their `js/` source.
Do not add `oxlint-disable`, `@ts-ignore`, or other suppressions to hide a
source diagnostic.

`vp test` is the test gate; test files import APIs from `vite-plus/test`.
`test/helpers/socialcalc.ts` compiles the generated UMD bundle once with
`vm.Script` and shares one SocialCalc instance within each isolated Vitest file
worker. Install per-file state in that file's hooks. Do not restore
cache-busting dynamic imports: Vite transforms each query as a separate copy of
the 760 KB bundle and exhausts worker memory.

## LemmaScript operations

Shipping `js/*.ts` files are global scripts and cannot be extracted directly by
LemmaScript. The exported facades in `lemma/` mirror selected pure shipping
behavior. Dafny and Lean proofs apply to those facades; Vite+ tests cross-check
facade outputs against shipping oracles. This is a formal boundary around the
named pure policies, not a proof of the complete global-script or DOM system.
`LemmaScript-files.txt` is the manifest of the three facade inputs:

- `lemma/a1.ts`: A1 clamp/coordinate algebra, absolute-reference helpers, and
  overflow `#REF!` policy — 26 Dafny VCs.
- `lemma/eval-ops.ts`: `/` and `&` type/error-propagation lattice — 4 VCs.
- `lemma/lookup-result.ts`: token resolution and exact-before-wildcard-before-
  miss precedence — 3 VCs. The full pipe-table row scan remains runtime-tested.

The verified count is **33 VCs (26 + 4 + 3)**. The proof-bearing `.dfy` files
are checked by Dafny; direct reproduction is:
`dafny verify lemma/a1.dfy lemma/eval-ops.dfy lemma/lookup-result.dfy`.

### Artifact ownership

| Files                                                       | Ownership                                   |
| ----------------------------------------------------------- | ------------------------------------------- |
| `lemma/*.ts`, `LemmaScript-files.txt`                       | Hand-maintained facade sources and manifest |
| `lemma/*.dfy`                                               | Hand-maintained proof-bearing Dafny models  |
| `lemma/*.proof.lean`, `lemma/a1.spec.lean`                  | Hand-maintained Lean proof/support files    |
| `lemma/*.dfy.gen`, `lemma/*.types.lean`, `lemma/*.def.lean` | Generated from facades                      |

After a facade edit, run its focused Vite+ oracle test, then
`vp run verify:dafny:regen` (three-way merge) and `vp run verify:dafny`.
Run `vp run verify:lean` for Lean generation/non-empty assertions; run
`vp run verify:lean:build` only when `../velvet`, `../loom`, and
`../LemmaScript` are present. `vp run verify:both` is Dafny check plus Lean
generation/non-empty smoke, not `lake build`. Plain `verify:dafny:gen` creates
`.dfy.gen` files but does not update checked proof-bearing `.dfy`; never
routinely copy `.dfy.gen` over `.dfy`.

Prerequisites and pins: package LemmaScript/lsc is `0.5.13`; CI installs Dafny
`4.9.0`; Lean is `4.24.0`; Lake pins Z3 `4.15.4` and cvc5 `1.3.1` and
downloads them as needed. Full Lake builds assume sibling checkouts at
`../velvet` (with `../loom` pulled through its lemma layout) and
`../LemmaScript`. CI intentionally splits Dafny verification from Lean
generation and does not run the sibling-dependent Lake build.

### Facade-to-shipping tests

- `test/lemma-a1-facade.test.ts` compares A1 helpers with `rcColname`,
  `crToCoord`, `OffsetFormulaCoords`, and `AdjustFormulaCoords`.
- `test/lemma-eval-ops-facade.test.ts` compares `/` and `&` policies with
  `evaluate_parsed_formula`.
- `test/lemma-lookup-result-facade.test.ts` compares facade table selection with
  `Formula.LookupResultType`; its complete row scans remain runtime coverage.

## TypeScript status

Core modules currently intended for typechecking include `formatnumber2.ts`,
`formula-parse.ts`, `formula-operand.ts`, `formula-ref.ts`, `formula1.ts`,
`socialcalcconstants.ts`, `socialcalc-3.ts`, `socialcalcspreadsheetcontrol.ts`,
`socialcalctableeditor.ts`, `socialcalcviewer.ts`, and `socialcalcpopup.ts`.
Keep this status honest: do not claim a finished typed rewrite when compiler or
lint diagnostics remain. Tighten remaining `any` bridges and public `*.d.ts`
coverage only when a runtime surface requires it.

## Formula-reference compatibility

The pure helpers in `js/formula-ref.ts` (emitted into `dist/SocialCalc.js`) are
the implementation oracle for `OffsetFormulaCoords`, `AdjustFormulaCoords`,
`ReplaceFormulaCoords`, and A1 coordinate algebra unless a command-level
spreadsheet scenario proves the current behavior wrong. `js/socialcalc-3.ts`
contains command handling and call sites.

Required formula-reference matrix:

```bash
vp build
vp test run test/formula-rewrite-cases.test.ts test/formula-rewrite-regressions.test.ts
vp run typecheck
vp lint
```

Use `ScheduleSheetCommands`/`loadSocialCalc()` command-level tests for copy,
paste, fill, insert, delete, and undo behavior; direct helper tests alone are
not enough. Relevant tests are:

- `test/fixtures/formula-rewrite-cases.json`
- `test/formula-rewrite-cases.test.ts`
- `test/formula-rewrite-regressions.test.ts`
- `test/command-boundary-regressions.test.ts`
- `test/filldown-persistence.test.ts`
- `test/sheet-coverage-b.test.ts`

Compatibility rules:

- `$` markers lock copy/fill references, not structural insert/delete.
- Sheet-qualified ranges intentionally keep `sheetref` sticky through `:`.
- SocialCalc's supported maximum column is `ZZ` (702); shifts past it become
  `#REF!`, rather than silently clamping to `ZZ`.
- Rectangular fill series need per-column/per-row increments, interactive
  `range2` state must be captured before clearing, and delete undo must restore
  changed named-reference definitions as well as formulas.
- Treat lowercase/parser-normalization and no-op paste normalization as policy
  questions until a concrete spreadsheet behavior fails.

Promote model output only as exact fixtures or regression tests with calls,
commands, and expected outputs; prose alone is not evidence.
