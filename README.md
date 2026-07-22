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

### Dynamic arrays

Dynamic arrays are a deliberate first-class spill substrate, not merely a set
of commands. The supported formulas are:

- `SORT(range_or_array, [sort_column], [is_ascending], [sort_column2, is_ascending2, ...])`
  Omitted column and direction default to the first column ascending; negative
  directions sort descending.
- `UNIQUE(range_or_array, [by_column], [exactly_once])`
- `FILTER(array, include, [if_empty])` `include`'s height or width must match
  `array`; a nonzero/error `include` element keeps/propagates, a zero or
  blank element drops. An empty result returns `if_empty`, or `#CALC!` if
  `if_empty` was omitted.
- `SEQUENCE(rows, [columns], [start], [step])` `columns`/`start`/`step`
  default to 1; `rows`/`columns` must be positive integers.
- `TRANSPOSE(array)`
- `SORTBY(array, by_array1, [sort_order1], [by_array2, sort_order2, ...])`
  Each `by_array` must match `array`'s row or column count (all key pairs
  share one orientation); omitted `sort_order` defaults to ascending (`1`),
  `-1` descends, and ties preserve source order.
- `CHOOSECOLS(array, col_num1, [col_num2, ...])` /
  `CHOOSEROWS(array, row_num1, [row_num2, ...])` Negative indices count from
  the end; `0` or an out-of-range index is `#VALUE!`.
- `TAKE(array, rows, [columns])` / `DROP(array, rows, [columns])` Negative
  counts operate from the end. `TAKE` clamps to the available extent; `DROP`
  returns `#CALC!` if it would remove every row/column on an axis.
- `HSTACK(array1, [array2, ...])` / `VSTACK(array1, [array2, ...])` Pads
  shorter columns/rows with `#N/A`; bare scalars are accepted alongside
  ranges.
- `TOCOL(array, [ignore], [scan_by_column])` /
  `TOROW(array, [ignore], [scan_by_column])` `ignore` is `0` (keep all),
  `1` (skip blanks), `2` (skip errors), or `3` (skip both); `scan_by_column`
  reads column-first when true.
- `WRAPROWS(vector, wrap_count, [pad_with])` /
  `WRAPCOLS(vector, wrap_count, [pad_with])` `vector` must be a single row
  or column; the final wrap is padded with `pad_with` (default `#N/A`).
- `EXPAND(array, rows, [columns], [pad_with])` `rows`/`columns` must each be
  at least `array`'s corresponding extent; new cells are padded with
  `pad_with` (default `#N/A`).

Each result spills from its anchor. A collision with a non-empty, merged, or
user-owned cell returns `#SPILL!` and preserves the blocking cells. Spills are
limited to the `ZZ` column, 65,536 rows, and 100,000 cells. Spill children can
be selected and rendered, but are formula-owned and not directly editable.
Set, paste, fill, sort, move, and merge operations protect spill ownership;
structural inserts and deletes rebuild spills. Full saves preserve spill state.
Copying a range copies an anchor and re-spills it, while copying a spill child
copies its scalar value. For `UNIQUE(..., ..., TRUE)`, no matching result
follows the existing `#N/A` policy.

### Conditional formatting

`sheet.condfmtRules` is an ordered array of rules (index 0 = highest
priority) attached to a range, evaluated in priority order for every
candidate cell. Supported rule types:

- `cellis` — numeric/lexical comparison against `value1` (or `value1`..`value2`
  for `op: "between"`) using operators `gt`, `ge`, `lt`, `le`, `eq`, `ne`,
  `between`.
- `textcontains`, `textbegins`, `textends` — substring match against `value1`.
- `blank`, `nonblank` — cell value-type test.
- `duplicate`, `unique` — occurrence count within the rule's own range.
- `formula` — a custom boolean formula, relative-adjusted per target cell the
  same way a copied/filled formula would be (via `OffsetFormulaCoords`), using
  the rule's range top-left as the anchor.

Each rule's `style` is `{font, color, bgcolor, bt, br, bb, bl}` — the same
palette-index fields as a cell's own `font`/`color`/`bgcolor`/border
attributes (`0` means unset), resolved only through `sheet.fonts`/
`sheet.colors`/`sheet.borderstyles`. Style values are never raw CSS text.

A rule with `stopIfTrue: true` halts evaluation for that cell once matched;
a rule with `stopIfTrue: false` still contributes any style field a
higher-priority matching rule left unset, and evaluation continues to the
next rule. Rendering overlays the resolved style onto the cell's computed
CSS without mutating the underlying cell object, so it never interferes with
the cell's own persisted formatting and re-evaluates automatically on every
recalc/value change and re-render.

Rules are managed with the `condfmt` sheet command:

- `condfmt add <id> <range>\t<type>\t<op>\t<value1>\t<value2>\t<formula>\t<stopIfTrue>\t<font>\t<color>\t<bgcolor>\t<bt>\t<br>\t<bb>\t<bl>`
- `condfmt update <id> <same tab-delimited fields>`
- `condfmt delete <id>`
- `condfmt move <id> up|down`

All four are full undo/redo-integrated commands, and a rule's `range` and
`formula` are rewritten automatically by copy/fill/insert/delete/move
operations, exactly like a cell's own formula. Rules persist through
save/load as `condfmt:` lines, with palette references translated through
the same compaction pass as cell/sheet style attributes. The bundled
`SpreadsheetControl`'s "Conditional Formatting" toolbar tab provides a rule
list plus an add/edit/delete/reorder editor form built entirely on this
command surface.

### LET, LAMBDA, and lambda-array functions

`LET` and `LAMBDA` add Excel-compatible local bindings and user-defined
functions on top of the existing formula engine, with real lexical scope,
closures, and callable named lambdas:

- `LET(name1, value1, [name2, value2, ...], calculation)` binds one or more
  names to values sequentially (each later value/the final `calculation` can
  reference every earlier name), evaluates each value exactly once, and
  returns `calculation`. A later name of the same spelling shadows the
  earlier one (innermost binding wins). Names may not be blank, a reserved
  builtin function name used as the sole occupant of a scope frame without a
  call, or shaped like a cell coordinate (`A1`, `$B$2`, ...) — the latter
  keeps every formula-reference rewrite (copy/fill/move/insert/delete)
  coord-only, so a bound name is never mistaken for a cell reference.
- `LAMBDA([param1, param2, ...], calculation)` defines a function value.
  Called immediately as `LAMBDA(...)(arg1, arg2, ...)`, bound to a name via
  `LET` and invoked through that name (`LET(f, LAMBDA(x,x*x), f(4))`), or
  stored in a workbook name (Name Manager / `sheet.names`) and called as
  `MYFUNC(arg1, ...)` from any formula. A `LAMBDA` closes over its defining
  `LET` scope, so nested/recursive/mutually-recursive definitions work
  (`=LAMBDA(n,IF(n<=1,1,n*FACT(n-1)))` bound to the name `FACT`). Calling
  with the wrong number of arguments is `#VALUE!`; a `LAMBDA` written as a
  cell's entire formula without ever being invoked is also `#VALUE!` (it
  isn't a plottable/storable scalar). Recursion depth is bounded (fails fast
  with `#NUM!` well before the host JS call stack) rather than unbounded.
- `MAP(array1, [array2, ...], lambda)` applies `lambda` element-wise across
  one or more same-shaped arrays/ranges, producing a result of the same
  shape.
- `REDUCE(initial_value, array, lambda)` accumulates `lambda(accumulator,
value)` left-to-right/top-to-bottom over `array`, starting from
  `initial_value`, and returns the final accumulator.
- `SCAN(initial_value, array, lambda)` is `REDUCE` but returns every
  intermediate accumulator as an array the same shape as `array`, instead of
  only the final value.
- `BYROW(array, lambda)` / `BYCOL(array, lambda)` apply `lambda` to each row
  (as a 1-row array) or column (as a 1-column array) of `array` and return a
  single column/row of per-row/per-column results.
- `MAKEARRAY(rows, cols, lambda)` builds a `rows` x `cols` array by calling
  `lambda(row, col)` (1-based) for every cell. `rows`/`cols` must be positive
  integers.

Every lambda-array function's result is a dynamic array and flows through
the same spill pipeline as `SORT`/`UNIQUE` above (anchor cell, `#SPILL!` on
collision, formula-owned spill children, save/copy/move semantics).

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
21-member allowlist, package-size ceilings, declaration consumption, and
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
- Bun 1.3.14 is pinned by `bun.lock` and managed by Vite+; use `vp install`,
  `vp add`, `vp remove`, and `vp update` instead of direct `bun` package commands.
- Dafny on `PATH` for Dafny checks; CI uses Dafny 4.9.0.
- Full Lean builds additionally need Lean 4.24.0 and sibling checkouts at
  `../velvet`, `../loom`, and `../LemmaScript`. Lake pins Z3 4.15.4 and cvc5
  1.3.1.

### Common commands

| Command                             | Contract                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp build`                          | Build the ordered UMD bundle and CSS; canonicalize tracked `dist/SocialCalc.js`.                                                                                                   |
| `vp build --minify`                 | Build normal and minified UMD bundles.                                                                                                                                             |
| `vp check --fix`                    | Apply repository formatting and safe lint fixes, then typecheck.                                                                                                                   |
| `vp check`                          | Check formatting, warning-free type-aware lint, and types without modifying files.                                                                                                 |
| `vp dev`                            | Open the local browser workbench at the repository root. It uses tracked `dist/SocialCalc.js`, so run `vp build` after changing JavaScript source before refreshing the workbench. |
| `vp run typecheck:strict`           | Check the narrower strict build configuration.                                                                                                                                     |
| `vp test`                           | Build a fresh instrumented UMD, run Vitest, and enforce 100/100/100/100 Istanbul coverage.                                                                                         |
| `vp run test`                       | Build the plain shipping bundle first, then run the default Istanbul test gate.                                                                                                    |
| `bun run test:bun`                  | Run the same corpus in isolated native Bun workers; no authoritative coverage aggregate.                                                                                           |
| `vp run check:test-credibility`     | Reject tautologies and unexplained code-free catches in tracked Vitest and Playwright tests.                                                                                       |
| `vp run check:coverage-attribution` | Prove source-map attribution remains monotonic and does not duplicate the bundle.                                                                                                  |
| `vp run test:coverage`              | Run the explicit source-attributed V8 diagnostic with shared release floors.                                                                                                       |
| `vp run test:coverage:merged`       | Merge unit V8 coverage with real Chromium V8 coverage and enforce the merged floors.                                                                                               |
| `vp run test:browser`               | Run Playwright against Chromium, Firefox, and WebKit.                                                                                                                              |
| `vp run test:package-contract`      | Pack and exercise the exact npm consumer contract.                                                                                                                                 |
| `vp run test:ethercalc-canary`      | Networked release-only canary against the pinned EtherCalc checkout.                                                                                                               |
| `vp pm pack --out <file.tgz>`       | Run `prepack` and create the candidate npm archive.                                                                                                                                |

For the local workbench, run `vp build` and then `vp dev`. The root page opens
the editable spreadsheet workbench and loads the tracked `dist/SocialCalc.js`;
rebuild with `vp build` after JavaScript source changes before using `vp dev`
again.

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
all thirteen shipping modules and the four LemmaScript facades.

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
vp check
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

| Facade                   | Verified surface                                                         | Dafny VCs |
| ------------------------ | ------------------------------------------------------------------------ | --------: |
| `lemma/a1.ts`            | A1 clamp/coordinate algebra, absolute references, overflow `#REF!`       |        26 |
| `lemma/eval-ops.ts`      | `/` and `&` type/error propagation                                       |         4 |
| `lemma/lookup-result.ts` | exact-before-wildcard-before-miss lookup precedence                      |         3 |
| `lemma/spill.ts`         | dynamic-array spill rectangle/claim/resize/UNIQUE/SORT policies          |        15 |
| `lemma/protect.ts`       | sheet/cell protection editability policy (readonly, protected, unlocked) |         2 |

Total: **50 Dafny verification conditions**. The complete lookup table row scan
remains runtime-tested.
| Facade | Verified surface | Dafny VCs |
| ------------------------ | ------------------------------------------------------------------ | --------: |
| `lemma/a1.ts` | A1 clamp/coordinate algebra, absolute references, overflow `#REF!` | 26 |
| `lemma/eval-ops.ts` | `/` and `&` type/error propagation | 4 |
| `lemma/lookup-result.ts` | exact-before-wildcard-before-miss lookup precedence | 3 |
| `lemma/spill.ts` | dynamic-array spill rectangle/claim/resize/UNIQUE/SORT policies | 15 |
| `lemma/condfmt.ts` | conditional-formatting rule match and ordered stop/precedence | 8 |

Total: **56 Dafny verification conditions**. The complete lookup table row
scan and rule-scanning/formula-evaluation runtime remain runtime-tested.

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

Stryker mutates all thirteen shipping modules with no mutator exclusions.
String, regex, CSS, and format-table mutations remain observable behavior and
are scored rather than filtered.

Stryker builds one all-mutant UMD in each sandbox. The native Vitest runner
keeps isolated workers alive and uses per-test coverage for runtime mutants.
`formatnumber2.ts` and `socialcalcconstants.ts` use isolated command runs so
each active mutant re-evaluates their top-level tables and defaults in a fresh
test process without rebuilding or racing on the bundle. Because shipping
sources are concatenated into a `vm.Script` bundle, source-to-test selection
comes from `stryker-file.mjs`, not Vitest's import graph.

Modes:

- `MUTATE_SCOPE=critical vp run mutate`: PR gate for `formula-parse.ts`,
  `formula-operand.ts`, and `formula-ref.ts` against a deterministic test set.
- `MUTATE_TARGET=js/<module>.ts vp run mutate`: one module with its owned tests.
- `vp run mutate:all`: all thirteen modules sequentially.
- `vp run mutate:file js/<module>.ts [start-end]`: sandboxed local iteration.
  A line-range run writes to `<module>-partial`, uses an exact-range cache,
  disables the full-module break floor, and cannot be release evidence.
- `vp run mutate:release-gate`: validate fresh reports and measured baselines
  for every module.

Current registered baselines (exact-module measurements on 2026-07-13,
2026-07-14, 2026-07-19, or 2026-07-22):

| Module                            |   Score | Floor | Mutants |
| --------------------------------- | ------: | ----: | ------: |
| `socialcalcconstants.ts`          | 100.00% |   100 |     679 |
| `formula-parse.ts`                |  97.80% |    97 |     636 |
| `formula-ref.ts`                  |  97.22% |    97 |     467 |
| `formula-operand.ts`              |  94.36% |    94 |     337 |
| `formatnumber2.ts`                |  93.78% |    93 |   1,399 |
| `pivot.ts`                        |  78.96% |    78 |   1,022 |
| `socialcalcviewer.ts`             |  73.33% |    73 |     375 |
| `socialcalcpopup.ts`              |  61.90% |    61 |     937 |
| `formula1.ts`                     |  61.44% |    61 |   6,213 |
| `socialcalc-3.ts`                 |  57.39% |    57 |   7,273 |
| `socialcalcspreadsheetcontrol.ts` |  53.80% |    53 |   2,987 |
| `socialcalctableeditor.ts`        |  45.28% |    45 |   5,711 |

The corrected build-once lifecycle invalidated the prior `formula1.ts` floor of
95: its fresh exact report scored 61.44%. Initializer-heavy survivors remain in
the report as an explicit backlog; they are not filtered or dispositioned away.

Floors are the integer floor of a real isolated measurement. `minimumMutants`
pins each report's complete-module denominator, so a narrowed report cannot
pass. These are honest ratchets, not claims that low scores are desirable.
Reports live under `reports/mutation/<scope>/`. Equivalent critical mutants
require explicit, source-specific proofs in `stryker-mutation-disposition.json`;
the registry is not an exclusion list.

## Release process

A `v*` tag starts five independent gates in `.github/workflows/release.yml`:

1. core typecheck/lint/build/test/credibility/formal/audit checks;
2. merged coverage;
3. full thirteen-module mutation testing;
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
