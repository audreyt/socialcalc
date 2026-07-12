# Untrusted-content rendering: sink inventory

Generated for the `harden/secure-rendering` opt-in security policy
(`SocialCalc.Callbacks.untrustedContent` / `SocialCalc.Callbacks.securityPolicy`).
This is a complete enumeration of every `innerHTML =` assignment and every
`href`/`src` attribute-value construction site across
`js/socialcalc-3.ts`, `js/socialcalcpopup.ts`,
`js/socialcalcspreadsheetcontrol.ts`, `js/socialcalctableeditor.ts`, and
`js/socialcalcviewer.ts`, classified by the origin of the data that reaches
the sink, with the applied mitigation (if any) and the test that exercises
it.

Origin categories:

- **static** — a literal string authored in the source, or built only from
  fixed literals / numeric row-col values / internal debug data. Never
  contains sheet, save-file, or cell content.
- **host-callback** — the return value of a `SocialCalc.Callbacks.*`
  function the host application supplies. May receive sheet-authored
  arguments, so its return value cannot be assumed safe.
- **sheet-derived** — built directly from cell/sheet/save-file content
  (cell value, cell comment, `valueformat:` template, formula text, sheet
  name, formula-widget parameters, etc.). Reachable by loading a hostile
  save file.

A sink needs protection only if it is `sheet-derived` or consumes a
`host-callback` return value that itself received sheet-authored input.
`static` sinks are listed for completeness and require no changes.

## Summary

| Category                                            | Count |
| ---------------------------------------------------- | ----- |
| Total `innerHTML =` assignment sites (grep-verified: `socialcalc-3.ts` 4, `socialcalcpopup.ts` 12, `socialcalcspreadsheetcontrol.ts` 15, `socialcalctableeditor.ts` 19, `socialcalcviewer.ts` 1) | 51 |
| Direct `.src=`/`.href=` DOM property assignments (grep-verified) | 7 (all in `socialcalcspreadsheetcontrol.ts`, all static) |
| Dynamic (string-concatenated) `href="`/`src="` construction sites feeding an `innerHTML=` sink | 3 (`format_text_for_display` text-url, text-image; `expand_text_link`) — all in `js/socialcalc-3.ts`, all previously unprotected, all now protected |
| **static** (no action; literal/numeric/internal-debug/fixed-registry content only) | 39 |
| **sheet-derived or host-callback-of-sheet-input, already safe pre-existing** (unconditional `special_chars`, coordinate-shaped values, or copies of already-rendered content) | 6 |
| **sheet-derived, newly protected under `untrustedContent` this round** | 9 distinct code paths (text-html, text-url, text-image, text-custom `@r`/`@u` values, text-custom template markup, formula-widget `cell_html`, statusline `calcloading` sheetname, `expand_text_link` direct URL) |
| **host-callback receiving sheet input, newly protected under `untrustedContent`** | 3 (`expand_wiki`, `expand_markup`, `MakePageLink`) |
| **dead code / unreachable** (documented, not fixed) | 1 (`calcserverfunc`'s `RemoteFunctionInfo.waitingForServer`, never assigned anywhere in the shipped codebase) |

## `js/socialcalc-3.ts`

| Symbol | Sink | Origin | Mitigation | Test |
| --- | --- | --- | --- | --- |
| `RenderCell` (`newcol.innerHTML = rownum + ""`) | `innerHTML=` | static (row number) | n/a | — |
| `RenderCell` (`newcol.innerHTML = SocialCalc.rcColname(colnum)`) | `innerHTML=` | static (column name from fixed algorithm) | n/a | — |
| `RenderCell` (`result.innerHTML = "&nbsp;"`, skipped-cell placeholder) | `innerHTML=` | static literal | n/a | — |
| `RenderCell` (`result.innerHTML = cell.displaystring`) | `innerHTML=` | **sheet-derived** — `cell.displaystring` is `FormatValueForDisplay` output | protected transitively by every `format_text_for_display`/`FormatValueForDisplay` mitigation below | `render-security-policy.test.ts` → "DOM-level RenderCell sink" (2 tests: malicious `<img onerror>` cell via a real `ParseSheetSave`, both untrusted-escaped and trusted-raw) |
| `RenderCell` (`result.title = cell.comment`) | DOM property (not innerHTML) | sheet-derived (cell comment) | not an HTML sink — `.title` assignment never parses as markup | — |
| `format_text_for_display` "text-html" branch | `displayvalue` → feeds `RenderCell` sink | sheet-derived (cell value) | escaped/sanitized via `EscapeUntrustedHtml` when untrusted | "text-html is HTML-escaped by default…", "…defers to an explicit host sanitizeHtml callback…" |
| `format_text_for_display` "text-wiki" via `Callbacks.expand_wiki` | same | **host-callback** receiving sheet-authored cell value | callback output routed through `EscapeUntrustedHtml` when untrusted | "an unsafe expand_wiki callback's output is escaped when untrusted" (+trusted regression lock) |
| `format_text_for_display` "text-wiki" via `Callbacks.expand_markup` | same | **host-callback** receiving sheet-authored cell value | callback output routed through `EscapeUntrustedHtml` when untrusted | "an unsafe expand_markup callback's output is escaped when untrusted" (+trusted regression lock) |
| `format_text_for_display` "text-url" (`'<a href="'+dvue+'">'`) | `href=` construction | sheet-derived (cell value URL) | `SafeUrlForRender` scheme allowlist; reject → inert escaped text | "text-url rejects javascript:…", "…rejects data:…", tab/newline/case bypass variants |
| `format_text_for_display` "text-image" (`'<img src="'+dvue+'">'`) | `src=` construction | sheet-derived (cell value URL) | `SafeUrlForRender`; reject → inert escaped text | "text-image rejects javascript:/data: SVG payloads…", "…allows http(s)…", "data: is allowed only for MIME types…" |
| `format_text_for_display` "text-custom:" — `@r`/`@u` placeholder values | interpolated into template | sheet-derived (cell value) | `@r` → `EscapeUntrustedHtml`; `@u` → `SafeUrlForRender` \|\| "" | "text-custom @r is escaped…", "…@u is scheme-checked…" |
| `format_text_for_display` "text-custom:" — **template markup itself** (`valueformat`, everything outside `@r`/`@s`/`@u`) | interpolated into `displayvalue` | **sheet-derived** — `valueformat` is a `valueformat:N:text-custom:…` entry parsed from the save file, exactly as attacker-controlled as the cell value | no sanitizer configured → template split on `/(@[rsu])/g`, every non-placeholder segment run through `special_chars` (segment-by-segment escaping, placeholders keep their established substitution); sanitizer configured → template expanded with legacy semantics then the *whole* result passed through `EscapeUntrustedHtml` in one pass | "text-custom template markup is escaped without a sanitizer…" (×2: @u rejected / @u allowed), "…with an explicit sanitizeHtml callback: template preserved…", "direct: an event-handler embedded in the template is escaped…", "direct: a `<script>` tag embedded…", "direct: template markup is sanitized…", "direct: trusted (legacy) mode still renders template markup raw…", "render-level: a malicious text-custom valueformat template is neutralized…" (×2, untrusted/trusted) |
| `expand_text_link` (`'<a href="'+url+'"'+tb+'>'+desc+'</a>'`) — non-pagename branch | `href=` construction | sheet-derived (`parts.url` from cell link-text syntax) | `SafeUrlForRender`; reject → return `desc` only (no anchor) | "expand_text_link rejects javascript:…", "…allows a plain http(s) link…" |
| `expand_text_link` — pagename branch, `Callbacks.MakePageLink` return value | same | **host-callback** receiving sheet-authored `parts.pagename`/`parts.workspacename` | in untrusted mode, `MakePageLink`'s return value is validated via `SafeUrlForRender`; reject → return `desc` only | "a MakePageLink callback returning a javascript: URL is rejected…", "…that naively concatenates pagename cannot break out of the href attribute…" (attribute-injection via embedded `"`, closed by `SafeUrlForRender`'s `encodeURI` pass), "…returning a safe URL still renders a live link…", trusted-mode regression lock |
| `FormatValueForDisplay` — formula-widget `cell_html` (`<%=parameter*_value%>`, `<%=html*_value%>`, CSS `style=` injection, `<%=display_value%>`/`<%=formated_value%>`) | full HTML fragment, incl. live `onclick`/event-handler-capable markup | **sheet-derived** — formula arguments, `parameters.html`, `parameters.css` all originate from the cell's formula | entire widget-rendering branch disabled when untrusted (`!untrusted && valueinputwidget == "i" && …`); falls back to the already-safe formatted display value | "widget cell_html is not rendered when untrusted…" (malicious parameter/html/css injection attempt), trusted-mode regression lock |
| `SC.default_expand_markup` (internal `Callbacks.expand_markup` default) | feeds text-wiki branch above | sheet-derived, but *already* calls `SocialCalc.special_chars` unconditionally | inherently safe by construction; also now covered by the outer `EscapeUntrustedHtml` wrap for defense-in-depth | (covered by the expand_markup tests above) |
| `EditorGetStatuslineString` "calcloading" (`arg.sheetname`) — lives in `socialcalctableeditor.ts`, consumed via `innerHTML=` in both `SpreadsheetControlStatuslineCallback` (`socialcalcspreadsheetcontrol.ts`) and `SpreadsheetViewerStatuslineCallback` (`socialcalcviewer.ts`) | `innerHTML=` (downstream) | **sheet-derived** — sheet name surfaced from an in-flight cross-sheet formula reference (`'Sheet'!A1`), via `SocialCalc.Formula.SheetCache.waitingForLoading` | `arg.sheetname` escaped via `special_chars` when untrusted, before being concatenated into `progress`/`sstr` | `render-security-policy.test.ts` → "untrusted mode: statusline escapes cross-sheet-formula sheet names" (3 tests) |
| `EditorGetStatuslineString` "calcserverfunc" (`arg.funcname`, `arg.coord`) | same downstream sinks | would be sheet-derived (`SocialCalc.Formula.RemoteFunctionInfo.waitingForServer`), but that field is initialized `null` and **never assigned anywhere in the shipped codebase** (`grep -rn "waitingForServer\s*="` across `js/` finds only the initializer) | **dead code — confirmed unreachable, not fixed** | — |
| `EditorGetStatuslineString` `circularreferencecell` (`circ`) | same downstream sinks | sheet-derived in origin, but the value is always `coord + "|" + oldcoord` where both are algorithmically-generated `[A-Z]+[0-9]+` coordinate strings (`SocialCalc.RecalcCheckCell`), never free text | static-shaped; cannot carry markup | — |
| `ConvertSaveToOtherFormat` "html" branch (`result = div.innerHTML`) | reads `innerHTML` (not a write) after `RenderSheet` | sheet-derived, but flows entirely through the already-audited `RenderCell`/`format_text_for_display` pipeline | protected transitively | (covered by `RenderCell` tests above) |

## `js/socialcalcpopup.ts`

All 12 `innerHTML=` sites in this file are static UI chrome: popup title
(`main.innerHTML = … + attribs.title + …`, but every real call site passes
the fixed literal `"&nbsp;"` — confirmed via `grep -n 'title:'` across the
whole codebase, only 2 hits, both `"&nbsp;"`), List-popup dropdown-item
content templates (`Popup.Types.List.MakeList` interpolates `o.o`, but
every option label originates from
`SettingsControls.PopupListInitialize`'s `panelobj[ctrlname].initialdata ||
…InitialData` — fixed settings-panel dropdown definitions like
`InitialData: { thickness: "1 pixel:1px", … }`, never sheet content — and
is unconditionally run through `SocialCalc.special_chars` at line 4133 of
`socialcalcspreadsheetcontrol.ts` before being stored as `options[i].o`,
so even a hypothetical future sheet-derived option label would already be
escaped), color-chooser sample div, drag-handle/placeholder divs
(`"&nbsp;"`, empty-string resets). No sheet or save-file content reaches
any sink in this file. **No changes required.**

## `js/socialcalcspreadsheetcontrol.ts`

| Symbol | Sink | Origin | Mitigation | Test |
| --- | --- | --- | --- | --- |
| Toolbar/tab/dialog HTML templates (`InitializeSpreadsheetControl`, `DoFunctionList`, settings panels, etc.) | `innerHTML=` | static | n/a | — |
| Audit tab (`s.views.audit.element.innerHTML = str + …`) | `innerHTML=` | static — `str` built from `SocialCalc.debug_log` internal objects via `ObjToSource`, never sheet content | n/a | — |
| `CtrlSEditor` editbox (`editbox.innerHTML = whichpart + … + strtoedit + …`) | `innerHTML=` | `SocialCalc.OtherSaveParts` — a host-driven "other MIME parts" editor feature, **never populated by `ParseSheetSave`/save-loading code** (confirmed via `grep -rn OtherSaveParts js/`, only `socialcalcspreadsheetcontrol.ts` references it) | `strtoedit` is unconditionally `SocialCalc.special_chars`-escaped anyway (pre-existing, not gated by `untrustedContent`) | — |
| `DoMultiline` edit box (`text = SocialCalc.GetCellContents(...)`) | `innerHTML=` | **sheet-derived** (raw cell content) | already unconditionally `SocialCalc.special_chars`-escaped (pre-existing) | — |
| `DoFunctionList` dialog (`GetFunctionNamesStr`, `GetFunctionInfoStr`) | `innerHTML=` | static — function names/descriptions come from the fixed internal `SocialCalc.Formula.FunctionList`/`FunctionClasses` registry, never sheet content | n/a | — |
| Toolbar icon `.src=` sites (undo/redo/copy/cut/paste/move buttons) | `.src=` | static — `spreadsheet.imagePrefix + "<literal>.gif"` | n/a | — |
| `SpreadsheetControlStatuslineCallback` (`ele.innerHTML = editor.GetStatuslineString(...)`) | `innerHTML=` | **sheet-derived** (via `calcloading` sheetname, see `EditorGetStatuslineString` above) | protected at the shared `EditorGetStatuslineString` source | see statusline tests above |
| Popup `title:` attrib assignments (2 call sites, `SettingsControls`) | feeds `socialcalcpopup.ts`'s `CreatePopupDiv` | static — both are the literal `"&nbsp;"` | n/a | — |

The "Toolbar/tab/dialog HTML templates" row above groups 9 additional
`innerHTML=` sites (the tabbed UI shell, Comment/Names/Clipboard tab
bodies, multi-line-input-box chrome, function-list dialog chrome,
create/destroy resets) that are all static string-literal templates with
no cell/sheet/save-file interpolation of any kind — bringing this file's
total to the 15 sites counted in the summary table.

## `js/socialcalctableeditor.ts`

| Symbol | Sink | Origin | Mitigation | Test |
| --- | --- | --- | --- | --- |
| Resize/drag/cell-handle display divs | `innerHTML=` | static | n/a | — |
| `SetInputEchoText` (`inputecho.main.innerHTML = newstr`, `inputecho.prompt.innerHTML = fstr`) | `innerHTML=` | live-typed edit-box text (may originate from an existing sheet-derived cell being edited) | `newstr` is unconditionally `TableEditorSC.special_chars`-escaped; `fstr` is either `special_chars`-escaped or a function name matched by `/[A-Za-z][A-Za-z][\w.]*?/` (structurally cannot contain `&<>"`) | — |
| `cell.element.innerHTML = newelement.innerHTML` | `innerHTML=` (copy) | copies **already-rendered** content (itself produced by `RenderCell`, already protected) | protected transitively | — |
| `EditorGetStatuslineString` "calcloading" (`arg.sheetname`) | feeds `innerHTML=` downstream in both `socialcalcspreadsheetcontrol.ts` and `socialcalcviewer.ts` | **sheet-derived** | escaped via `special_chars` when `SocialCalc.Callbacks.untrustedContent` | "untrusted mode: statusline escapes cross-sheet-formula sheet names" (3 tests) |
| `td.innerHTML = "<div…><img src='"+editor.imageprefix+"1x1.gif'…"` (fill-handle placeholder) | `innerHTML=`/`src=` | static — `editor.imageprefix` + fixed literal filename | n/a | — |

The rows above cover every *distinct* code pattern in this file; the
"Resize/drag/cell-handle display divs" row groups 14 additional
`innerHTML=` sites (draghandle/dragpalette/dragtooltip/fillinghandle
creation and reset, column/row resize-preview boxes) that are all static
string literals (`"&nbsp;"`, fixed `<table>`/`<div>` chrome with only
numeric pixel-size interpolation) — bringing this file's total to the 19
sites counted in the summary table.

## `js/socialcalcviewer.ts`

| Symbol | Sink | Origin | Mitigation | Test |
| --- | --- | --- | --- | --- |
| `SpreadsheetViewerStatuslineCallback` (`spreadsheet.statuslineDiv.innerHTML = slstr`) | `innerHTML=` | **sheet-derived** (via `calcloading` sheetname, and `editor.ecell.coord` which is always a well-formed coordinate string) | protected at the shared `EditorGetStatuslineString` source | see statusline tests above |
| `this.statuslineHTML` template | `innerHTML=` (downstream) | static | n/a | — |

## Host-callback contract established by this policy

Every `SocialCalc.Callbacks.*` function that can receive sheet-authored
input and whose return value reaches an HTML sink is now validated/escaped
when `untrustedContent` is true — the callback itself is never assumed to
be XSS-aware:

- `expand_wiki(displayvalue, …)` → return value wrapped in `EscapeUntrustedHtml`
- `expand_markup(displayvalue, …)` → return value wrapped in `EscapeUntrustedHtml`
- `MakePageLink(pagename, workspacename, …)` → return value validated via `SafeUrlForRender`
- `NormalizeSheetName(name)` → **not** a rendering sink (its return value is only used as an internal cache-key string, never written to the DOM), out of scope

## Notes on methodology

- Enumeration performed via `grep -n '\.innerHTML\s*=[^=]'` and
  `grep -n '\.(href|src)\s*=[^=]'` / `grep -n 'href=|src=|<img |<a '` across
  all five files (see the harden/secure-rendering session transcript for
  the exact commands), then every match traced to its data source by
  reading the enclosing function.
- No brittle line-number or source-text assertions were added to the test
  suite; every test in this document asserts on rendered *behavior*
  (presence/absence of live markup, exact safe output, no-throw) so this
  inventory can be regenerated independently to confirm it still matches
  the source without the tests themselves depending on it.
