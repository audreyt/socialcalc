# SocialCalc

This is the npm package for SocialCalc, an in-browser spreadsheet editor with support for real-time collaboration.
This version is based on the version used in [EtherCalc](https://github.com/audreyt/ethercalc).

See it in action at [ethercalc.net](http://ethercalc.net)!

## Requirements

- jQuery (only on the client-side)

## Usage

You can `require('socialcalc')` or include `node_modules/socialcalc/dist/SocialCalc.js` on your web page using a script tag.

In order to create an editor instance use:

```js
var socialCalcControl = new SocialCalc.SpreadsheetControl();
socialCalcControl.InitializeSpreadsheetControl(el /*, height, width, spacebelow*/);
```

This package also works in Node.js. You do not need to call `InitializeSpreadsheetControl` there; that method only initializes rendering.

## Build and quality gates

### Prerequisites

- [Bun](https://bun.sh) for the bundle build. Vite+ resolves the pinned Bun `1.3.14` package manager from `devEngines`.
- The repository's development dependencies, installed with `vp install`. `bun.lock` currently resolves TypeScript `7.0.2`; LemmaScript is the exact `0.5.13` package version.
- [`vp` (Vite+)](https://viteplus.dev/) for dependency management, Vitest, and the lint/type-aware gate. The local `vite-plus` package supplies the checked-in config and test APIs.
- Dafny on `PATH` for Dafny verification (CI uses Dafny `4.9.0`).
- A full Lean proof build additionally needs Lean `4.24.0`, sibling checkouts `../velvet`, `../loom` (their `lemma` branches), and `../LemmaScript`. Lake downloads the pinned Z3 `4.15.4` and cvc5 `1.3.1` solver binaries when needed.

### Commands

| Command                             | Purpose and outputs                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vp install`                        | Install the locked dependencies with the Bun version declared in `devEngines`.                                                                                                                         |
| `bun run build`                     | Run `build.ts`; concatenate the ordered global-script sources into `dist/SocialCalc.js` and concatenate CSS into `dist/socialcalc.css`.                                                                |
| `bun run build:min`                 | Build the normal bundle and additionally emit `dist/SocialCalc.min.js`.                                                                                                                                |
| `bun run typecheck`                 | Run `tsc --noEmit` with `tsconfig.json`; this is the ordinary compiler check.                                                                                                                          |
| `bun run typecheck:strict`          | Run `tsc --noEmit -p tsconfig.strict.json`; this narrower strict check includes only `build.ts` and excludes JavaScript sources.                                                                       |
| `vp lint --type-check --type-aware` | Run the Vite+ lint/type-aware gate. It reads `vite.config.ts`, where `denyWarnings: true` makes warnings failures and `dist/**` is ignored because generated artifacts must be fixed in `js/` sources. |
| `vp test`                           | Run all `test/**/*.test.ts` files once with Vitest through Vite+.                                                                                                                                      |
| `bun run test`                      | Build first, then run `vp test`.                                                                                                                                                                       |
| `bun run test:coverage`             | Build, run `vp test --coverage`, and write text/LCOV reports under the ignored `coverage/` directory.                                                                                                  |

The bundle is a browser-ready UMD artifact: `build.ts` inlines the wrapper, exports
the browser global `SocialCalc` and CommonJS `module.exports`, and deliberately
does not provide an AMD branch. Build output is generated; edit the ordered
sources and `css/socialcalc.css`, not `dist/`.

### TypeScript sources (global scripts)

Core implementation files under `js/` are global-script TypeScript. They share
the factory-local `SocialCalc` namespace and are stripped to JavaScript by
`Bun.Transpiler` during the build; they are not ES-module entry points. The
ordered source list and `.ts`-over-`.js` sibling preference live in `build.ts`;
declaration files coexist under `js/`, but that list determines implementation
ownership. LemmaScript `//@ verify` marks apply to selected pure helpers (see
the verification section and `AGENTS.md`).

## Formula-reference rewrite coverage

`OffsetFormulaCoords`, `AdjustFormulaCoords`, and `ReplaceFormulaCoords` live in
shipping TypeScript (`js/formula-ref.ts`) with LemmaScript `//@ verify` marks.
The former Leanstral-assisted Rust/WASM parity spike was removed after its
fixtures and invariants moved onto the TS/LemmaScript and Vite+ test layer.

When changing formula-reference rewrites:

```bash
bun run build.ts
vp test run test/formula-rewrite-cases.test.ts test/formula-rewrite-regressions.test.ts
bun run typecheck
vp lint --type-check --type-aware
```

Lessons from the Leanstral/oracle pass:

- Treat current SocialCalc JavaScript as the compatibility oracle unless a command-level spreadsheet scenario proves a bug.
- Promote model suggestions only when they become concrete fixtures or regression tests with exact inputs and expected outputs.
- `$` markers lock copy/fill movement, not structural insert/delete; structural rewrites still move the underlying coordinate.
- `sheetref` stickiness is intentional around sheet-qualified ranges and `:`; do not “simplify” it without a regression case.
- References shifted beyond the supported `ZZ` column become `#REF!`; do not rely on `crToCoord`/`rcColname` high-side clamping.
- Command bugs belong in command-level tests, not only direct formula-helper tests.

Relevant tests include:

- `test/fixtures/formula-rewrite-cases.json` — data-driven direct + command cases.
- `test/formula-rewrite-cases.test.ts` — runs fixtures against the shipping bundle.
- `test/formula-rewrite-regressions.test.ts` — direct helper edge cases.
- `test/command-boundary-regressions.test.ts` — command-level max-column behavior.
- `test/filldown-persistence.test.ts` — fill persistence/increment behavior.
- `test/sheet-coverage-b.test.ts` — command undo/name-reference coverage.

## LemmaScript verification (Dafny + Lean)

### Trust boundary and verified surfaces

Shipping `js/*.ts` files are global scripts, not exported modules, so LemmaScript
cannot extract them directly. The exported files under `lemma/` are deliberately
small facades that mirror pure shipping behavior. Formal Dafny/Lean proofs apply
to those facades; Vite+ tests then cross-check the facade results against the
shipping bundle's runtime oracles. This is parity evidence for the named pure
policies, not a formal proof of the entire global-script or DOM implementation.

The three manifest entries in `LemmaScript-files.txt` are:

- `lemma/a1.ts` — A1 clamp/coordinate algebra, absolute-reference helpers, and
  overflow `#REF!` policy: 26 Dafny verification conditions (VCs).
- `lemma/eval-ops.ts` — `/` and `&` type/error-propagation lattice: 4 VCs.
- `lemma/lookup-result.ts` — `LookupResultType` token resolution and
  exact-before-wildcard-before-miss precedence: 3 VCs. The full pipe-table
  row scan remains runtime-tested; only the pure precedence policy is formalized.

That is **33 directly verified Dafny VCs (26 + 4 + 3)**. The checked-in
`*.dfy` files are proof-bearing; the count is also reproducible with:

```bash
dafny verify lemma/a1.dfy lemma/eval-ops.dfy lemma/lookup-result.dfy
```

### Commands and artifact ownership

| Command                      | Purpose                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run verify:dafny:gen`   | Generate `.dfy.gen` models from all manifest facades.                                                                                        |
| `bun run verify:dafny:regen` | Regenerate each model and merge it into the proof-bearing `.dfy` files.                                                                      |
| `bun run verify:dafny`       | Run `lsc check --backend=dafny` over `LemmaScript-files.txt`.                                                                                |
| `bun run verify:lean:gen`    | Generate Lean `*.types.lean` and `*.def.lean` inputs from the facades; hand-maintained `*.proof.lean` files consume those generated modules. |
| `bun run verify:lean`        | Generate Lean artifacts and assert the required Lean artifact set (including proof modules) is non-empty.                                    |
| `bun run verify:lean:build`  | Run `lake build`; requires the sibling repositories and solver downloads.                                                                    |
| `bun run verify:both`        | Dafny check, then Lean generation/artifact smoke; it is not a full `lake build`.                                                             |

| Artifact                                                    | Ownership                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `lemma/*.ts`                                                | Hand-maintained exported facades; listed by `LemmaScript-files.txt`. |
| `lemma/*.dfy`                                               | Hand-maintained, proof-bearing Dafny models.                         |
| `lemma/*.proof.lean`, `lemma/a1.spec.lean`                  | Hand-maintained Lean proof/support files.                            |
| `lemma/*.dfy.gen`, `lemma/*.types.lean`, `lemma/*.def.lean` | Generated; regenerate from the facade.                               |

After changing a facade, run its focused Vite+ oracle test, then
`bun run verify:dafny:regen` followed by `bun run verify:dafny`; run
`bun run verify:lean` as the Lean-generation smoke and `bun run
verify:lean:build` when the sibling checkouts are available. Plain
`verify:dafny:gen` does **not** update checked proof-bearing `.dfy` files.
Never routinely copy a `.dfy.gen` file over its `.dfy` counterpart: regeneration
is a three-way merge so hand-written proof bodies are preserved.

CI splits this work intentionally. `.github/workflows/lemmascript.yml` installs
Dafny 4.9.0 and LemmaScript 0.5.13, runs the Dafny check, and separately runs
Lean generation plus non-empty assertions. It does not run the sibling-dependent
full Lake build. The manifest is `LemmaScript-files.txt`.

## Mutation testing

Line coverage is a floor, not a ceiling. We use [Stryker](https://stryker-mutator.io)
to check that the tests meaningfully pin behaviour — every mutant that
survives is a behavior the tests do not actually exercise.

`stryker.config.mjs` drives Stryker through a generic `command` runner
(`bun run build.ts && vp test`) so no runner-specific Stryker plugin is needed.
Two modes:

- **Fast per-file iteration** — `bun run mutate:file js/<source>.js|.ts [startLine-endLine]`
  flips Stryker to in-place mode and filters the test command to only the
  test files that exercise that module (see the mapping in
  `stryker-file.mjs`). Also available: `bun run mutate:format`,
  `bun run mutate:sheet`, `bun run mutate:formula`.
- **Full sandbox run** — `bun run mutate` copies the project into parallel
  sandboxes and mutates every source in the `mutate` list. Slower but
  useful before tagging a release.

Reports are emitted to `reports/mutation/index.html` (Stryker's interactive
viewer) and `reports/mutation/mutation.json` (the raw data). Incremental
mode is enabled, so iterating after adding killing tests only re-checks the
previously-surviving mutants.

Current mutation scores:

| Module                                       | Score  | Status                                                  |
| -------------------------------------------- | ------ | ------------------------------------------------------- |
| `formatnumber2.ts`                           | 95.20% | Remaining 54 survivors classified as equivalent mutants |
| `formula1.ts`                                | —      | Typechecked; mutation not measured                      |
| `socialcalc-3.ts`                            | —      | Typechecked; mutation not measured                      |
| `socialcalcspreadsheetcontrol.ts`            | —      | Typechecked; mutation not measured                      |
| `socialcalctableeditor.ts`                   | —      | Typechecked; mutation not measured                      |
| `socialcalcviewer.ts` / `socialcalcpopup.ts` | —      | Typechecked; mutation not measured                      |

## Licensing

### Common Public Attribution License (Socialtext Inc.)

- socialcalcspreadsheetcontrol.ts
- socialcalctableeditor.ts

### Artistic License 2.0 (Socialtext Inc.)

- formatnumber2.ts
- formula1.ts
- socialcalc-3.ts
- socialcalcconstants.ts
- socialcalcpopup.ts

### Mozilla Public License 2.0

- images/sc\_\*.png
