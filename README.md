# SocialCalc

SocialCalc is an in-browser spreadsheet engine and editor with formula evaluation,
formatting, sheet commands, save/load support, and the UI used by
[EtherCalc](https://github.com/audreyt/ethercalc). This repository publishes the
`socialcalc` npm package.

See it in action at [ethercalc.net](https://ethercalc.net/).

## Install and requirements

```bash
npm install socialcalc jquery
```

- Browser rendering requires jQuery supplied by the host application.
- Node.js consumers require Node **22 or newer**. CI exercises packed release
  tarballs under Node 22 and 24; older releases are best-effort only.
- The package is CommonJS. Native ESM consumers use its default export.

## Usage

### CommonJS

```js
const SocialCalc = require("socialcalc");

const control = new SocialCalc.SpreadsheetControl();
control.InitializeSpreadsheetControl(element /*, height, width, spacebelow */);
```

### Native ESM

```js
import SocialCalc from "socialcalc";

const control = new SocialCalc.SpreadsheetControl();
```

The supported ESM surface is the **default import**. Do not depend on native
named imports: the UMD bundle assigns `module.exports` dynamically, so Node's
static CommonJS named-export detection cannot discover those names reliably.

### Browser global

```html
<script src="node_modules/jquery/dist/jquery.min.js"></script>
<script src="node_modules/socialcalc/dist/SocialCalc.js"></script>
<script>
  const control = new SocialCalc.SpreadsheetControl();
</script>
```

For production browser delivery, `socialcalc/dist/SocialCalc.min.js` exposes the
same `SocialCalc` global and CommonJS value.

The formula, command, and save/load APIs also work without a DOM in Node.js.
`InitializeSpreadsheetControl` is only needed for rendering the editor.

## Trust boundary and host security

SocialCalc has two rendering modes. The legacy mode preserves historical output
for trusted workbooks; the opt-in mode applies a security policy to content from
untrusted or third-party sheets.

### Legacy mode: trusted workbooks only

`SocialCalc.Callbacks.untrustedContent` defaults to `false`. In this mode,
SocialCalc preserves pre-3.1.0 rendering behavior:

- `text-html` and the `@r` custom-format placeholder can emit raw HTML.
- `Callbacks.expand_wiki` / `Callbacks.expand_markup` output and text-custom
  format templates can emit markup.
- `text-url`, `text-image`, `text-link`, and the `@u` custom placeholder can
  create links or images without scheme validation.

Treat workbook cells and save strings as hostile input unless the host has
already established their trust. Legacy mode is not safe for arbitrary uploads,
shared documents, or API-provided sheets.

### Opt-in untrusted-content mode

Enable the policy before rendering an untrusted workbook:

```js
SocialCalc.Callbacks.untrustedContent = true;
```

With the policy enabled:

- Raw-HTML sinks are escaped by default.
- A host-supplied `sanitizeHtml` callback may return safe rich HTML.
- Non-`data:` link and image URLs are checked against
  `allowedUrlSchemes`, whose default is `['http:', 'https:', 'mailto:']`.
- `data:` URLs are checked separately and only against
  `allowedDataMimeTypes`, whose default is `[]`; therefore all `data:` URLs
  are rejected until the host explicitly allows MIME types.
- The formula-widget `cell_html` path is disabled because its sheet-authored,
  event-capable markup cannot be safely escaped field by field.

Example host policy:

```js
SocialCalc.Callbacks.untrustedContent = true;
SocialCalc.Callbacks.securityPolicy = {
  allowedUrlSchemes: ["http:", "https:", "mailto:"],
  allowedDataMimeTypes: ["image/png", "image/jpeg"],
  sanitizeHtml(html) {
    return DOMPurify.sanitize(html);
  },
};
```

The sanitizer contract is `(html: string) => string`. SocialCalc does not bundle
or validate a sanitizer; the host owns its correctness. The sanitizer is used
only for raw-HTML sinks while untrusted-content mode is active. URL validation
remains separate.

`SocialCalc.SafeUrlForRender(rawurl, policy?)` and
`SocialCalc.EscapeUntrustedHtml(html, policy?)` are exported for host-created
markup. `SafeUrlForRender` returns an **HTML-attribute-escaped** string: for
example, `&` becomes `&amp;`. Use that result only inside markup that an HTML
parser will parse. Do not persist it in a sheet or assign it directly to
`Element.href` / `Element.src`, where the entity would remain literal.

The complete sink inventory and policy disposition live in
[`docs/security-sink-inventory.md`](docs/security-sink-inventory.md). Regardless
of mode, the host must still apply an appropriate Content Security Policy and
sanitize any content rendered outside SocialCalc's enumerated sinks.

## Package and distribution contract

`package.json` declares `"type": "commonjs"`, with:

- `main`: `dist/SocialCalc.js`
- `types`: `dist/SocialCalc.d.ts`
- normal and minified UMD bundles
- the generated stylesheet and source stylesheet
- public declaration files
- license and README files

`prepack` always runs `vp build --minify`; a package archive never relies on a
stale local minified bundle. `dist/SocialCalc.min.js` is generated and
Git-ignored. The tracked `dist/SocialCalc.js` and `dist/socialcalc.css` are also
generated artifacts: change their `js/` or `css/` inputs, then regenerate them
rather than editing generated output by hand.

`vp run test:package-contract` packs a fresh tarball and checks the pinned
17-member allowlist, package-size ceilings, declaration consumption, and
behavior/API-shape parity across:

1. root CommonJS `require("socialcalc")`;
2. deep minified CommonJS loading;
3. native ESM default import;
4. normal browser-global execution; and
5. minified browser-global execution.

The release workflow packs twice and requires byte-identical archives before it
retains one candidate artifact.

## Development

### Prerequisites

- [`vp` (Vite+)](https://viteplus.dev/) for dependency management, builds,
  Vitest, formatting, linting, and the managed Node/Bun toolchain.
- Install the lockfile with `vp install --frozen-lockfile` for release-equivalent
  work, or `vp install` during ordinary local development.
- Bun 1.3.14 is pinned through `devEngines`; use `vp install`, `vp add`,
  `vp remove`, and `vp update` instead of direct `bun` package commands.
- Dafny on `PATH` for Dafny checks; CI uses Dafny 4.9.0.
- Full Lean builds additionally need Lean 4.24.0 and sibling checkouts at
  `../velvet`, `../loom`, and `../LemmaScript`. Lake pins Z3 4.15.4 and cvc5
  1.3.1.

### Common commands

| Command                             | Contract                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `vp build`                          | Build the ordered UMD bundle and CSS.                                                        |
| `vp build --minify`                 | Build normal and minified UMD bundles.                                                       |
| `vp run typecheck`                  | Run the ordinary `tsc --noEmit` project check.                                               |
| `vp run typecheck:strict`           | Check the narrower strict build configuration.                                               |
| `vp lint`                           | Run warning-free, type-aware lint plus typechecking.                                         |
| `vp test`                           | Build a fresh instrumented UMD, run Vitest, and enforce 100/100/100/100 Istanbul coverage.   |
| `vp run test`                       | Build the plain shipping bundle first, then run the default Istanbul test gate.              |
| `bun run test:bun`                  | Run the same corpus in isolated native Bun workers; no authoritative coverage aggregate.     |
| `vp run check:test-credibility`     | Reject tautologies and unexplained code-free catches in tracked Vitest and Playwright tests. |
| `vp run check:coverage-attribution` | Prove source-map attribution remains monotonic and does not duplicate the bundle.            |
| `vp run test:coverage`              | Run the explicit source-attributed V8 diagnostic with shared release floors.                 |
| `vp run test:coverage:merged`       | Merge unit V8 coverage with real Chromium V8 coverage and enforce the merged floors.         |
| `vp run test:browser`               | Run Playwright against Chromium, Firefox, and WebKit.                                        |
| `vp run test:package-contract`      | Pack and exercise the exact npm consumer contract.                                           |
| `vp run test:ethercalc-canary`      | Networked release-only canary against the pinned EtherCalc checkout.                         |
| `vp pm pack --out <file.tgz>`       | Run `prepack` and create the candidate npm archive.                                          |

### Source and build model

The shipping implementation under `js/` is **global-script TypeScript**, not an
ES-module graph. All files share the factory-local `SocialCalc` namespace.
`build.ts` exports the Vite plugin configured by `vite.config.ts`, owns the
ordered source list, prefers `.ts` implementations, strips types with Oxc,
preserves license preambles, and wraps the result as UMD. Its wrapper strings
are inline because they are not standalone source modules.

Default `vp test` global setup builds `dist/SocialCalc.instrumented.js` from
the current source tree before workers start. The shared loader executes that
UMD through `vm.Script`; Istanbul collects its source counters and enforces
**100 / 100 / 100 / 100** statements, branches, functions, and lines across
all eleven shipping modules and the three LemmaScript facades.

`vp run test:coverage` remains the explicit V8 diagnostic. Its build appends a
source-map reference to the generated UMD so V8 ranges can be attributed back
to `js/*.ts`; plain builds remove stale coverage maps and instrumented bundles.
The V8 and merged-browser thresholds live in `coverage-thresholds.mjs`:

- unit V8 global floors: **98 / 80 / 98 / 98**;
- merged unit + Chromium floors: **98 / 84 / 98 / 98**;
- per-file floors for the seven critical shipping sources listed there.

Bun runs the complete corpus through `bun run test:bun`, but Bun's native
coverage does not collect the `vm.Script` UMD and has no statement or branch
metrics. It is an execution-compatibility check, not the release coverage gate.

### Test architecture

Vitest files import from `vite-plus/test`. `test/helpers/socialcalc.ts` compiles
the generated UMD bundle once per isolated test worker and shares one SocialCalc
instance within that file. Default runs load the fresh instrumented UMD; explicit
`SOCIALCALC_COVERAGE=1` V8 runs load the plain UMD plus its sourcemap. Tests must
install and restore mutable state in their own hooks. Do not restore
cache-busting dynamic imports: Vite transforms each query as another copy of the
roughly 720 KB bundle and can exhaust worker memory.

Use the narrowest layer that proves the behavior:

- Pure helpers: direct unit tests.
- Sheet commands and undo/redo: `ScheduleSheetCommands` / `loadSocialCalc()`
  scenarios with observable cells, formulas, names, and status transitions.
- DOM behavior that the fake DOM models faithfully: Vitest UI helpers.
- Layout, native browser parsing, active-content safety, keyboard/mouse
  interaction, and normal/minified parity: Playwright.
- Cross-version compatibility: the pinned, offline
  `test/fixtures/oracle-3.0.8` fixture. Tests never fetch the oracle at runtime.
- Package delivery: the tarball-first package contract and EtherCalc canary.

The credibility guard scans tracked `test/**/*.test.ts` and
e2e `e2e/**/*.spec.ts`. A cleanup-only catch may contain comments only when the
comment gives a real explanation; a placeholder annotation is not an escape
hatch.

## Formula-reference compatibility

`js/formula-ref.ts` is the shipping implementation for
`OffsetFormulaCoords`, `AdjustFormulaCoords`, `ReplaceFormulaCoords`, and A1
coordinate algebra. Unless a command-level spreadsheet scenario proves a bug,
current SocialCalc behavior is the compatibility oracle.

Required matrix for formula-reference changes:

```bash
vp build
vp test run test/formula-rewrite-cases.test.ts test/formula-rewrite-regressions.test.ts
vp run typecheck
vp lint
```

Compatibility rules:

- `$` markers lock copy/fill movement, not structural insert/delete.
- Sheet-qualified ranges intentionally keep `sheetref` sticky through `:`.
- The supported maximum column is `ZZ` (702); shifts past it become `#REF!`.
- Rectangular fills increment independently per row or column.
- Interactive fills must capture `range2` before clearing it.
- Delete undo restores changed named-reference definitions as well as formulas.
- Command behavior requires command-level tests; helper-only assertions are not
  sufficient evidence.

The primary fixtures and regressions are:

- `test/fixtures/formula-rewrite-cases.json`
- `test/formula-rewrite-cases.test.ts`
- `test/formula-rewrite-regressions.test.ts`
- `test/command-boundary-regressions.test.ts`
- `test/filldown-persistence.test.ts`
- `test/sheet-coverage-b.test.ts`

## LemmaScript verification

Shipping global scripts cannot be extracted directly by LemmaScript. The
exported `lemma/*.ts` facades mirror selected pure behavior, Dafny/Lean reason
about those facades, and Vitest compares them with the shipping bundle. This is
a formal boundary around the named policies, not a proof of the full DOM or
command system.

| Facade                   | Verified surface                                                   | Dafny VCs |
| ------------------------ | ------------------------------------------------------------------ | --------: |
| `lemma/a1.ts`            | A1 clamp/coordinate algebra, absolute references, overflow `#REF!` |        26 |
| `lemma/eval-ops.ts`      | `/` and `&` type/error propagation                                 |         4 |
| `lemma/lookup-result.ts` | exact-before-wildcard-before-miss lookup precedence                |         3 |

Total: **33 Dafny verification conditions**. The complete lookup table row scan
remains runtime-tested.

| Command                     | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `vp run verify:dafny:gen`   | Generate `.dfy.gen` models.                                         |
| `vp run verify:dafny:regen` | Three-way merge regenerated models into proof-bearing `.dfy` files. |
| `vp run verify:dafny`       | Check all manifest facades with Dafny.                              |
| `vp run verify:lean`        | Generate Lean artifacts and assert the required set is non-empty.   |
| `vp run verify:lean:build`  | Run `lake build`; requires sibling repositories and solvers.        |
| `vp run verify:both`        | Dafny check plus Lean generation smoke; not a full Lake build.      |

Hand-maintained artifacts are `lemma/*.ts`, `lemma/*.dfy`,
`lemma/*.proof.lean`, and `lemma/a1.spec.lean`. Files ending in `.dfy.gen`,
`.types.lean`, and `.def.lean` are generated. Do not copy generated Dafny files
over proof-bearing models; use the regeneration command so proof bodies survive.

## Mutation testing

Stryker mutates all eleven shipping modules with no mutator exclusions.
String, regex, CSS, and format-table mutations remain observable behavior and
are scored rather than filtered.

Modes:

- `MUTATE_SCOPE=critical vp run mutate`: PR gate for `formula-parse.ts`,
  `formula-operand.ts`, and `formula-ref.ts` against a deterministic test set.
- `MUTATE_TARGET=js/<module>.ts vp run mutate`: one module with its owned tests.
- `vp run mutate:all`: all eleven modules sequentially.
- `vp run mutate:file js/<module>.ts [start-end]`: sandboxed local iteration.
- `vp run mutate:release-gate`: validate fresh reports and measured baselines
  for every module.

Measured baselines from 2026-07-13:

| Module                            |  Score | Floor |
| --------------------------------- | -----: | ----: |
| `formula-parse.ts`                | 97.80% |    97 |
| `formula-ref.ts`                  | 97.22% |    97 |
| `formula1.ts`                     | 95.64% |    95 |
| `formula-operand.ts`              | 94.36% |    94 |
| `formatnumber2.ts`                | 92.95% |    92 |
| `socialcalcconstants.ts`          | 77.91% |    77 |
| `socialcalcviewer.ts`             | 71.88% |    71 |
| `socialcalcpopup.ts`              | 60.68% |    60 |
| `socialcalc-3.ts`                 | 57.82% |    57 |
| `socialcalcspreadsheetcontrol.ts` | 54.47% |    54 |
| `socialcalctableeditor.ts`        | 45.98% |    45 |

Floors are the integer floor of a real isolated measurement. They are honest
ratchets, not claims that low UI scores are desirable. Reports live under
`reports/mutation/<scope>/`. Equivalent critical mutants require explicit,
source-specific proofs in `stryker-mutation-disposition.json`; the registry is
not an exclusion list.

## Release process

A `v*` tag starts five independent gates in `.github/workflows/release.yml`:

1. core typecheck/lint/build/test/credibility/formal/audit checks;
2. merged coverage;
3. full eleven-module mutation testing;
4. Chromium/Firefox/WebKit Playwright tests; and
5. the pinned EtherCalc candidate-tarball canary.

Packaging waits for all five, reruns the package contract, packs twice, rejects
non-deterministic archives, and records SHA-256 plus npm integrity for one exact
artifact. A tag push **does not publish**.

Publishing is a separate manual dispatch against the real tag with confirmation
`PUBLISH`, protected by the `npm-publish` GitHub Environment. It uses npm Trusted
Publishing/OIDC without a stored token, stages and checksum-verifies a draft
GitHub Release before the irreversible npm publish, verifies release
immutability afterward, and finally installs the registry version for a real
command/formula/save-load smoke test. The workflow header documents the required
npm trusted-publisher, environment-reviewer, and GitHub release-immutability
settings.

The blocking audit rejects high/critical findings. Two accepted moderate,
development-only findings are documented with owners and expiry conditions in
`docs/security-disposition.json`; no advisory package is included in the npm
tarball.

## Licensing

The aggregate package license is
`(CPAL-1.0 AND Artistic-2.0 AND MPL-2.0)`. File headers remain authoritative.

### Common Public Attribution License 1.0

- `socialcalcspreadsheetcontrol.ts`
- `socialcalctableeditor.ts`
- `socialcalcviewer.ts`

### Artistic License 2.0

- `formatnumber2.ts`
- `formula-parse.ts`
- `formula-operand.ts`
- `formula-ref.ts`
- `formula1.ts`
- `socialcalc-3.ts`
- `socialcalcconstants.ts`
- `socialcalcpopup.ts`

### Mozilla Public License 2.0

- `images/sc_*.png`
