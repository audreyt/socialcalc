# SocialCalc

This is the npm package for SocialCalc, an in-browser spreadsheet editor with support for real-time collaboration.
This version is based on the version used in [EtherCalc](https://github.com/audreyt/ethercalc).

See it in action at [ethercalc.net](http://ethercalc.net)!

## Requirements

- jQuery (only on the client-side)
- Node.js >= 22 (see `package.json`'s `engines.node`) when running in
  Node.js rather than a browser. CI tests every release against Node 22
  and 24 (see `.github/workflows/ci.yml`'s `node-compat` matrix job);
  those are the only versions this project actively maintains support
  for. Older Node.js releases may work but are best-effort only — not
  CI-tested, and a compatibility report against them will not be
  treated as a supported-version regression.

## Usage

CommonJS consumers can require the package:

```js
const SocialCalc = require("socialcalc");
const socialCalcControl = new SocialCalc.SpreadsheetControl();
socialCalcControl.InitializeSpreadsheetControl(el /*, height, width, spacebelow*/);
```

The package is also CommonJS-compatible when loaded through Node's native ESM
loader, which supports a default import:

```js
import SocialCalc from "socialcalc";
const socialCalcControl = new SocialCalc.SpreadsheetControl();
```

Do not rely on native named imports; the supported ESM form is the default
import above. In a browser, include `node_modules/socialcalc/dist/SocialCalc.js`
with a script tag and use the `SocialCalc` global.

This package also works in Node.js. You do not need to call
`InitializeSpreadsheetControl` there; that method only initializes rendering.

## Trust boundary and host security

SocialCalc renders some cell content as HTML: the `text-html` format, the
`@r` (raw text) custom format, wiki-callback output (`Callbacks.expand_wiki`/
`expand_markup`), and text-custom format templates can all inject markup.
URL/link formats (`text-url`, `text-image`, `text-link`, the `@u` custom
placeholder) can create links or embed images. **The legacy default (see
below) treats all of this as trusted and is not safe for untrusted input.**

### Default (legacy) mode is unsafe by default

`SocialCalc.Callbacks.untrustedContent` defaults to `false`. In this mode,
behavior is byte-for-byte identical to versions before 3.1.0: raw HTML passes
through untouched and link/image URLs are not scheme-checked. Treat workbook
cells and save strings as hostile input in this mode — they are **not safe by
default**.

### Opt-in untrusted-content mode

Set `SocialCalc.Callbacks.untrustedContent = true` before rendering a sheet
sourced from an untrusted party (a shared/collaborative document, an
uploaded file, an API response) to enable escaping/validation across every
sheet-derived HTML sink and host callback (see
`docs/security-sink-inventory.md` for the full, evidence-backed enumeration).
With it enabled:

- Raw HTML content (`text-html`, the `@r` placeholder, wiki-callback output,
  and text-custom format templates) is HTML-escaped by default.
- Non-`data:` link/image URLs are validated against
  `SocialCalc.Callbacks.securityPolicy.allowedUrlSchemes` (default
  `["http:", "https:", "mailto:"]`). `data:` URLs are validated separately
  and SOLELY against `securityPolicy.allowedDataMimeTypes` (default `[]`,
  i.e. all `data:` URLs rejected) — `allowedUrlSchemes` is never consulted
  for a `data:` URL, even if `"data:"` were listed there. Rejected URLs
  fall back to inert, escaped text rather than being dropped or throwing.
- The formula-widget `cell_html` rendering path is disabled entirely, since
  it interpolates sheet-authored parameters directly into live,
  event-handler-capable markup that cannot be safely escaped field-by-field.

### Host sanitizer contract

To allow rich (not merely escaped) HTML from a trusted-but-not-fully-vetted
source, set `SocialCalc.Callbacks.securityPolicy.sanitizeHtml` to a function
`(html: string) => string` that returns safe HTML (e.g. backed by DOMPurify
or an equivalent). It is consulted only when `untrustedContent` is `true`,
and only for the raw-HTML sinks listed above — it does not affect URL/scheme
validation. SocialCalc ships no sanitizer implementation itself and does not
attempt to detect or reject an unsafe one; the host is responsible for the
function's correctness. `SocialCalc.SafeUrlForRender(rawurl, policy?)` and
`SocialCalc.EscapeUntrustedHtml(html, policy?)` are also exported directly
for a host building its own `href="..."`/`src="..."` or raw-HTML markup
outside of normal cell rendering (e.g. a custom widget). `SafeUrlForRender`
returns an HTML-**attribute**-escaped string (a literal `&` becomes
`&amp;`) meant only to be embedded in markup that will itself be parsed by
an HTML parser (e.g. via `innerHTML`) — do not persist its return value
(such as in a saved sheet) or assign it directly to a DOM URL property
(`Element.href`/`.src`), since property assignment is not HTML-parsed and
would send the literal escaped text as part of the URL instead of
decoding it back.

Regardless of mode, the host application remains responsible for applying an
appropriate Content Security Policy (including image and link restrictions)
and for any sanitization needed outside SocialCalc's own rendering paths
(e.g. of values it receives back through host callbacks).

## Build and quality gates

### Prerequisites

- [`vp` (Vite+)](https://viteplus.dev/) for the build, dependency management,
  managed Node/Bun toolchain, Vitest, formatting, and lint/type-aware checks.
  The local `vite-plus` package supplies the checked-in config and APIs;
  `devEngines` pins Bun `1.3.14` as Vite+'s underlying package manager.
- Install the locked development dependencies with `vp install`. `bun.lock`
  currently resolves TypeScript `7.0.2`; LemmaScript is pinned to `0.5.13`.
- Dafny on `PATH` for Dafny verification (CI uses Dafny `4.9.0`).
- A full Lean proof build additionally needs Lean `4.24.0`, sibling checkouts `../velvet`, `../loom` (their `lemma` branches), and `../LemmaScript`. Lake downloads the pinned Z3 `4.15.4` and cvc5 `1.3.1` solver binaries when needed.

### Commands

| Command                   | Purpose and outputs                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `vp install`              | Install the locked dependencies with the Bun version declared in `devEngines`.      |
| `vp build`                | Run the SocialCalc Vite plugin; emit the ordered UMD bundle and CSS.                |
| `vp build --minify`       | Emit the normal bundle plus `dist/SocialCalc.min.js`.                               |
| `vp pm pack --out <file>` | Run `prepack`, regenerate both bundles, and create the publishable package archive. |
| `vp run typecheck`        | Run `tsc --noEmit` with `tsconfig.json`; this is the ordinary compiler check.       |
| `vp run typecheck:strict` | Run the narrower `tsconfig.strict.json` compiler check.                             |
| `vp lint`                 | Run the warning-free type-aware lint and full typecheck; `dist/**` is ignored.      |
| `vp test`                 | Run all `test/**/*.test.ts` files once with Vitest.                                 |
| `vp run test`             | Build first, then run `vp test`.                                                    |
| `vp run test:coverage`    | Build, test with coverage, and write text/LCOV reports under `coverage/`.           |

The bundle is a browser-ready UMD artifact: `build.ts` inlines the wrapper, exports
the browser global `SocialCalc` and CommonJS `module.exports`, and deliberately
does not provide an AMD branch. Build output is generated; edit the ordered
sources and `css/socialcalc.css`, not `dist/`.

The published package includes both `dist/SocialCalc.js` and
`dist/SocialCalc.min.js`. Direct-browser consumers can load the minified UMD as
`socialcalc/dist/SocialCalc.min.js`; it exposes the same `SocialCalc` global and
CommonJS value. The `prepack` lifecycle always runs `vp build --minify`, so the
archive never depends on a developer's existing `dist/` contents. The minified
file is generated and gitignored rather than checked in.

### TypeScript sources (global scripts)

Core implementation files under `js/` are global-script TypeScript. They share
the factory-local `SocialCalc` namespace and are stripped to JavaScript by
Vite+'s Oxc transformer; they are not ES-module entry points. `build.ts`
exports the Vite plugin and owns the ordered source list plus `.ts`-over-`.js`
sibling preference. Declaration files coexist under `js/`, but that list
determines implementation ownership. LemmaScript `//@ verify` marks apply to
selected pure helpers (see the verification section and `AGENTS.md`).

## Formula-reference rewrite coverage

`OffsetFormulaCoords`, `AdjustFormulaCoords`, and `ReplaceFormulaCoords` live in
shipping TypeScript (`js/formula-ref.ts`) with LemmaScript `//@ verify` marks.
The former Leanstral-assisted Rust/WASM parity spike was removed after its
fixtures and invariants moved onto the TS/LemmaScript and Vite+ test layer.

When changing formula-reference rewrites:

```bash
vp build
vp test run test/formula-rewrite-cases.test.ts test/formula-rewrite-regressions.test.ts
vp run typecheck
vp lint
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

| Command                     | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `vp run verify:dafny:gen`   | Generate `.dfy.gen` models from all manifest facades.                      |
| `vp run verify:dafny:regen` | Regenerate each model and merge it into the proof-bearing `.dfy` files.    |
| `vp run verify:dafny`       | Run `lsc check --backend=dafny` over `LemmaScript-files.txt`.              |
| `vp run verify:lean:gen`    | Generate Lean `*.types.lean` and `*.def.lean` inputs from the facades.     |
| `vp run verify:lean`        | Generate Lean artifacts and assert the required artifact set is non-empty. |
| `vp run verify:lean:build`  | Run `lake build`; requires the sibling repositories and solver downloads.  |
| `vp run verify:both`        | Dafny check, then Lean generation/artifact smoke; not a full `lake build`. |

| Artifact                                                    | Ownership                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `lemma/*.ts`                                                | Hand-maintained exported facades; listed by `LemmaScript-files.txt`. |
| `lemma/*.dfy`                                               | Hand-maintained, proof-bearing Dafny models.                         |
| `lemma/*.proof.lean`, `lemma/a1.spec.lean`                  | Hand-maintained Lean proof/support files.                            |
| `lemma/*.dfy.gen`, `lemma/*.types.lean`, `lemma/*.def.lean` | Generated; regenerate from the facade.                               |

After changing a facade, run its focused Vite+ oracle test, then
`vp run verify:dafny:regen` followed by `vp run verify:dafny`; run
`vp run verify:lean` as the Lean-generation smoke and `vp run
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
survives is a behavior the tests do not actually exercise. No mutator
exclusions: StringLiteral/Regex mutants are real, observable behaviour (a
default CSS class or format string silently going empty is exactly the kind
of regression this gate exists to catch), so nothing is filtered out of
scoring.

`stryker.config.mjs` drives Stryker through a generic `command` runner
(`vp build && vp test`) so no runner-specific Stryker plugin is needed.
Four modes (see the file's own header comment for the full rationale):

- **Critical PR gate** — `MUTATE_SCOPE=critical bun run mutate` mutates the
  4 release-critical modules (`formula-parse.ts`, `formula-operand.ts`,
  `formula-ref.ts`, `socialcalcconstants.ts`) against a deterministic
  31-file test subset. Small and fast enough to block a PR; `break: 70` is
  a real, measured floor (see below), not a guess.
- **Full per-module matrix** — `MUTATE_TARGET=js/<source>.ts bun run mutate`
  mutates exactly one of the 11 shipping modules against the full test
  subset `stryker-file.mjs`'s `testsByFile` maps to it. CI's `mutate-full`
  job runs this as a GitHub Actions matrix, one leg per module in parallel.
  Each module's break threshold comes from `stryker-mutation-baseline.json`:
  a module with no recorded, actually-measured baseline runs **report-only**
  (`break: null`) — Stryker still scores it, it just can't fail the build on
  a number nobody measured. `vp run mutate:all` walks the same 11 modules
  sequentially for local use, one Stryker process per module.
- **Fast per-file iteration** — `vp run mutate:file js/<source>.ts
  [startLine-endLine]` flips Stryker to in-place mode and filters the test
  command to only the test files that exercise that module. Also available:
  `vp run mutate:format`, `vp run mutate:sheet`, `vp run mutate:formula`.
- **Legacy full-sandbox run** — `vp exec stryker run` with no
  `MUTATE_SCOPE`/`MUTATE_TARGET` set mutates all 11 modules in one sandboxed
  process against the whole suite per mutant, report-only (an 11-module
  combined run can't honestly map to any single module's registered floor).
  Superseded by the matrix above for CI; kept for an occasional manual
  all-at-once run.

**Release gate.** `bun run mutate:release-gate`
(`scripts/mutate-release-gate.mjs`) refuses to pass unless *every* module in
`ALL_MUTATE_FILES` has both a fresh report from this run and a
`stryker-mutation-baseline.json` entry that is actually `measured: true`
with a passing score — an unmeasured module blocks a release exactly like a
regressed one. This workflow has no `push: tags: v*` trigger of its own —
it's a `workflow_call` reusable workflow (inputs: `scope`,
`enforce_release`), invoked by `release.yml` with `scope: full,
enforce_release: true` so mutation evidence and the release pipeline share
one run's DAG instead of racing as two independent workflows; `release.yml`
wires its earliest pack/draft/publish job's `needs:` onto that call (see
`.github/workflows/mutation.yml`'s header comment for the exact job block —
`release.yml` lives on a sibling branch and hasn't picked this up yet). CI's
`release-gate` job runs only when called with `enforce_release: true`, after
downloading all 11 of `mutate-full`'s per-module reports; the workflow's
`cancel-in-progress: false` concurrency setting keeps a run that a release
is waiting on from being silently cancelled. Today every registry entry is
`measured: false` (no module has an individual `MUTATE_TARGET` run backing
a number yet), so this gate correctly fails any enforce_release-true call
until each module gets a real run and the registry is ratcheted with its
honest floor — 80, or any other number, is never treated as evidence
without a fresh run behind it.

Reports are emitted per scope to `reports/mutation/<scope>/index.html`
(Stryker's interactive viewer) and `reports/mutation/<scope>/mutation.json`
(the raw data) — `<scope>` is `critical`, `full` (legacy mode), or the
target module's basename (e.g. `formula1`, `socialcalcconstants`).
Incremental mode is enabled per scope, so iterating after adding killing
tests only re-checks that scope's previously-surviving mutants.

Current mutation scores:

| Module                    | Scope    | Score  | Status                                                                              |
| -------------------------- | -------- | ------ | -------------------------------------------------------------------------------------- |
| `formula-parse.ts`         | critical | 97.33% | 17 survived: 9 documented equivalent, 8 undispositioned                                |
| `formula-operand.ts`       | critical | 91.99% | 27 survived: 7 documented equivalent, 20 undispositioned                               |
| `formula-ref.ts`           | critical | 94.22% | 27 survived: 10 documented equivalent, 17 undispositioned                              |
| `socialcalcconstants.ts`   | critical | 19.29% | 548 survived, all StringLiteral default-value literals — real, undispositioned gap     |
| `formatnumber2.ts`         | full     | —      | Not yet run under the per-module matrix (a prior 95.20% figure used a since-removed StringLiteral/Regex exclusion and is not comparable) |
| `formula1.ts`               | full     | —      | Not yet run under the per-module matrix                                                |
| `socialcalc-3.ts`           | full     | —      | Not yet run under the per-module matrix                                                |
| `socialcalcspreadsheetcontrol.ts` | full | —    | Not yet run under the per-module matrix                                                |
| `socialcalctableeditor.ts` | full     | —      | Not yet run under the per-module matrix                                                |
| `socialcalcviewer.ts` / `socialcalcpopup.ts` | full | — | Not yet run under the per-module matrix                                                |

Critical-scope break threshold: 70 (the measured integer floor of the
70.79% overall score above — `socialcalcconstants.ts`'s 548 undispositioned
survivors cap what's achievable until those get real value-assertion
tests). Full/per-module break thresholds are set individually per module in
`stryker-mutation-baseline.json` only once each has an actual measured run
backing it; see `stryker-mutation-disposition.json` for the critical
scope's full equivalent-mutant accounting.

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
