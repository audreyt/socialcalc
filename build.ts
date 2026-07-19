// Vite+ plugin for SocialCalc's ordered global-script build.
// Concatenates SocialCalc sources (order matters — files share the
// factory-local `SocialCalc` bag) and emits the package artifacts to ./dist.
//
// UMD open/close wrappers live here as strings (not js/*.js files): the
// halves are intentionally not standalone-parseable, so they cannot be
// individual Vite module entries.
//
// Core entries may be `.js` or `.ts`. A listed `.js` path prefers a sibling
// `.ts` when present. Vite+'s Oxc transformer strips TypeScript before concat
// so dist/SocialCalc.js stays a browser-ready UMD bundle with no runtime tax.

import type { MinifyResult, Plugin } from "vite-plus";
import { minify, transformWithOxc } from "vite-plus";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, unlinkSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allMappings,
  GenMapping,
  maybeAddMapping,
  setSourceContent,
  toEncodedMap,
} from "@jridgewell/gen-mapping";
import { eachMapping, originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { SourceMapInput } from "@jridgewell/trace-mapping";
import { createInstrumenter } from "istanbul-lib-instrument";

const root = fileURLToPath(new URL(".", import.meta.url));
const requireFromBuild = createRequire(import.meta.url);
const jsDir = join(root, "js");
const cssDir = join(root, "css");
const distDir = join(root, "dist");
const bundlePath = join(distDir, "SocialCalc.js");
const bundleMapPath = join(distDir, "SocialCalc.js.map");
const bundleInstrumentedPath = join(distDir, "SocialCalc.instrumented.js");

// Coverage-only: set by `test:coverage` (`SOCIALCALC_COVERAGE=1 vp build`)
// so `vp test --coverage` can remap executed dist/SocialCalc.js ranges back
// to js/*.ts via ast-v8-to-istanbul's sourceMappingURL sniffing. A normal
// `vp build`/`prepack` (this flag unset) emits byte-clean SocialCalc.js —
// no map, no trailing comment — and deletes any stale map left on disk by
// an earlier coverage build, so npm consumers and plain local builds never
// see it. dist/SocialCalc.js.map is also never listed in package.json
// "files" and is gitignored, so it can't ship even if this flag leaks.
const coverageMode = process.env.SOCIALCALC_COVERAGE === "1";
// Explicit Istanbul build mode remains available for tools that need the
// artifact outside Vitest. The default `vp test` path calls
// `writeSocialCalcIstanbulBundle()` from its global setup instead, so tests
// never consume a stale ignored file. Either path instruments each core source
// into dist/SocialCalc.instrumented.js and writes counters to
// globalThis.__VITEST_COVERAGE__. The clean SocialCalc.js stays unchanged;
// normal builds delete stale instrumented output.
const istanbulMode = process.env.SOCIALCALC_COVERAGE_ISTANBUL === "1";

export const socialCalcBuildInput = "virtual:socialcalc-build";
const resolvedBuildInput = `\0${socialCalcBuildInput}`;

// UMD open (formerly js/module-wrapper-top.js). Creates factory-local bag.
const umdWrapperTop = `// Opening half of a UMD IIFE. Inlined in build.ts — not a standalone module.
//
// Taken from https://github.com/umdjs/umd/blob/master/templates/returnExports.js
// (c) by The UMD contributors
// MIT License: https://github.com/umdjs/umd/blob/master/LICENSE.md
(function (root, factory) {
    "use strict";
    // Evaluate once and fan out to both deliveries:
    //   * browser / globalThis (root.SocialCalc) — always set
    //   * CommonJS / Node (module.exports) — when present
    // AMD was dropped from this wrapper: the npm package is its
    // canonical entry point today, and AMD loaders (RequireJS, Dojo
    // legacy) have been unmaintained for years. Anyone still wiring
    // AMD can wrap the CommonJS module themselves.
    var exported = factory.call(root, root);
    root.SocialCalc = exported;
    if (typeof module === 'object' && module && module.exports) {
        module.exports = exported;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (window) {
"use strict";
// Factory-local bag. Formerly created in socialcalcconstants as
// \`var SocialCalc; if (!SocialCalc) SocialCalc = {}\`. Hoisted here so
// converted TypeScript sources can typecheck against the ambient
// \`declare namespace SocialCalc\` without a runtime \`var SocialCalc\`
// that would shadow/collapse the namespace during \`tsc\`.
var SocialCalc = {};
`;

// UMD close (formerly js/module-wrapper-bottom.js).
const umdWrapperBottom = `// Closing half of a UMD IIFE. Inlined in build.ts — not a standalone module.

// Leading \`;\` defuses an ASI trap: the preceding file may end with a
// function expression and no trailing semicolon, so a bare \`(\` would be
// parsed as a call applied to that function expression.
;(function () {
    // DOM-free safety net. Full implementations live in
    // socialcalctableeditor.ts / socialcalcspreadsheetcontrol.ts and touch
    // \`document\`. Each wrapper checks at call time so tests that install a
    // DOM shim *after* bundle load still reach the real methods — the old
    // load-time replacement permanently stomped them once the bundle had
    // been loaded in a non-DOM context.
    var fallbacks = {
        GetEditorCellElement: function () {},
        ReplaceCell: function () {},
        EditorRenderSheet: function () {},
        SpreadsheetControlSortSave: function () { return ""; },
        SpreadsheetControlStatuslineCallback: function () {},
        DoPositionCalculations: function (editor) {
            SocialCalc.EditorSheetStatusCallback(
                null, "doneposcalc", null, editor
            );
        }
    };
    for (var name in fallbacks) {
        if (!Object.prototype.hasOwnProperty.call(fallbacks, name)) continue;
        (function (name, fallback) {
            var real = SocialCalc[name];
            SocialCalc[name] = function () {
                var fn = typeof document !== 'undefined' && real ? real : fallback;
                return fn.apply(this, arguments);
            };
        }(name, fallbacks[name]));
    }
}());

    // Just return a value to define the module export.
    return SocialCalc;
}));
`;

// Core sources only (no UMD halves). Prefer sibling `.ts` when listed as `.js`.
const coreFiles = [
  "socialcalcconstants.js",
  "socialcalc-3.js",
  "socialcalctableeditor.js",
  "formatnumber2.js",
  "formula1.js",
  "formula-parse.ts",
  "formula-operand.ts",
  "formula-ref.ts",
  "workbook.ts",
  "socialcalcpopup.js",
  "socialcalcspreadsheetcontrol.js",
  "workbook-ui.ts",
  "socialcalcviewer.js",
];

const cssFiles = ["socialcalc.css"];

function splitLeadingCommentPreamble(source: string) {
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (source.startsWith("//", i)) {
      const eol = source.indexOf("\n", i);
      i = eol === -1 ? n : eol + 1;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    break;
  }
  return {
    body: source.slice(i),
    preamble: i === 0 ? "" : `${source.slice(0, i).replace(/\s+$/u, "")}\n\n`,
  };
}

function assertMinified(filename: string, result: MinifyResult) {
  if (result.errors.length > 0) {
    throw new Error(
      `Failed to process ${filename}:\n${result.errors.map((error) => error.message).join("\n")}`,
    );
  }
  return result.code;
}

function resolveJsSource(name: string): string {
  if (name.endsWith(".js")) {
    const tsName = `${name.slice(0, -3)}.ts`;
    if (existsSync(join(jsDir, tsName))) {
      return tsName;
    }
  }
  if (name.endsWith(".ts") && !existsSync(join(jsDir, name))) {
    const jsName = `${name.slice(0, -3)}.js`;
    if (existsSync(join(jsDir, jsName))) {
      return jsName;
    }
  }
  return name;
}

// One resolved mapping segment: where `generatedLine`/`generatedColumn` in
// this file's OWN emitted code (before bundle-level concatenation) traces
// back to `originalLine`/`originalColumn` in the real js/*.ts file on disk
// (already shifted past the preamble comment that was stripped pre-transform).
interface ComposedMapping {
  generatedLine: number;
  generatedColumn: number;
  originalLine: number;
  originalColumn: number;
  name: string | null;
}

// Per-file sourcemap info threaded through concatenation so v8 coverage
// (via ast-v8-to-istanbul's sourceMappingURL sniffing in
// @vitest/coverage-v8) can remap executed dist/SocialCalc.js ranges back
// to the js/*.ts line/column that produced them.
//
// `relativeSource` is resolved against dist/ (where the bundle + its
// .map ship side by side), matching how ast-v8-to-istanbul resolves a
// sourcemap's `sources` entries: `path.resolve(dirname(bundleFile), source)`.
interface CoreSourceMap {
  relativeSource: string;
  originalText: string;
  entries: readonly ComposedMapping[];
}

interface CoreSource {
  code: string;
  /** Istanbul-instrumented version of `code`; set when requested by `modes`. */
  instrumentedCode?: string;
  map?: CoreSourceMap;
}

interface BuildModes {
  coverageMode: boolean;
  istanbulMode: boolean;
}

async function readJsSource(name: string, modes: BuildModes): Promise<CoreSource> {
  const resolved = resolveJsSource(name);
  const sourcePath = join(jsDir, resolved);
  const text = await readFile(sourcePath, "utf8");
  if (!resolved.endsWith(".ts")) {
    // No `.ts` sibling exists for this entry: nothing to transform, and
    // (today, this branch is unreachable — every coreFiles entry resolves
    // to a `.ts` sibling) no sourcemap to attribute coverage back to.
    return { code: text };
  }

  const { body, preamble } = splitLeadingCommentPreamble(text);
  const needsSourcemap = modes.coverageMode || modes.istanbulMode;
  const transformed = await transformWithOxc(body, sourcePath, {
    target: "esnext",
    ...(needsSourcemap ? { sourcemap: true } : {}),
  });
  for (const warning of transformed.warnings) {
    console.warn(warning);
  }
  const normalized = await minify(sourcePath, transformed.code, {
    codegen: {
      legalComments: "none",
      removeWhitespace: false,
    },
    compress: false,
    mangle: false,
    ...(needsSourcemap ? { sourcemap: true } : {}),
  });
  const code = preamble + assertMinified(sourcePath, normalized);
  if (!modes.coverageMode && !modes.istanbulMode) {
    return { code };
  }
  if (!normalized.map || !transformed.map) {
    console.warn(
      `No source map produced for ${sourcePath}; coverage will not attribute to this file.`,
    );
    return { code };
  }

  // Istanbul-instrumented code: instrument a SEPARATE full-file transform
  // (see below) so istanbul's injected counters write coverage data to
  // `globalThis.__VITEST_COVERAGE__` — the same variable vitest's istanbul
  // provider's worker-side `takeCoverage()` reads from. Use
  // `coverageGlobalScope: "globalThis"` and `coverageGlobalScopeFunc: false`
  // to match how the provider instruments its own files, avoiding a `new
  // Function("return this")()` call that would break in strict contexts.
  let instrumentedCode: string | undefined;
  if (modes.istanbulMode) {
    // Istanbul's `instrumentSync` records line/column metadata straight from
    // its `inputSourceMap`. The plain path above feeds it `transformed`
    // (derived from `body` — the preamble-STRIPPED text), so every reported
    // line is shifted by this file's preamble length. To carry true on-disk
    // js/*.ts coordinates, re-transform the FULL original `text` and feed that
    // code+map to the instrumenter instead. The instrumented bundle is
    // coverage-only (gitignored, never shipped), so preamble byte-fidelity
    // there is irrelevant; the clean bundle and the v8 composed-map path
    // below are untouched and stay byte-identical to a non-coverage build.
    const fullTransformed = await transformWithOxc(text, sourcePath, {
      target: "esnext",
      sourcemap: true,
    });
    for (const warning of fullTransformed.warnings) {
      console.warn(warning);
    }
    const instrumenter = createInstrumenter({
      esModules: false,
      compact: false,
      coverageVariable: "__VITEST_COVERAGE__",
      coverageGlobalScope: "globalThis",
      coverageGlobalScopeFunc: false,
    });
    // No `preamble +` prefix here: the full-file transform already includes
    // the leading comment preamble, so prepending it would double-prepend.
    instrumentedCode = instrumenter.instrumentSync(
      fullTransformed.code,
      sourcePath,
      fullTransformed.map as unknown as object,
    );
  }

  // Original line where `body` starts, so mapped positions land on the
  // real line in js/*.ts rather than in the preamble-stripped `body`.
  const preambleLines = (text.slice(0, text.length - body.length).match(/\n/g) ?? []).length;

  // Two-hop composition: normalized.map traces final code -> transformed
  // (pre-minify) code; transformed.map traces that -> `body`. Compose them
  // by hand instead of rolldown's `MinifyOptions.inputMap` — that field's
  // declared type doesn't structurally match `transformWithOxc`'s own
  // `TransformResult["map"]` in this vite-plus release (a `toUrl`-bearing
  // Rollup-style SourceMap vs. the plain binding SourceMap data shape).
  const bodyTrace = new TraceMap(transformed.map as unknown as SourceMapInput);
  const intermediateTrace = new TraceMap(normalized.map as unknown as SourceMapInput);
  // `code` is `preamble + normalized.code`, but every mapping segment's
  // `generatedLine` is relative to `normalized.code` ALONE — offset each
  // entry by the reconstructed preamble's own line count so `generatedLine`
  // lands on the right line of `code` (what assembleBundle actually appends).
  const preambleTextLines = (preamble.match(/\n/g) ?? []).length;
  const entries: ComposedMapping[] = [];
  eachMapping(intermediateTrace, (segment) => {
    if (segment.source == null) return;
    const original = originalPositionFor(bodyTrace, {
      line: segment.originalLine,
      column: segment.originalColumn,
    });
    if (original.source == null) return;
    entries.push({
      generatedLine: segment.generatedLine + preambleTextLines,
      generatedColumn: segment.generatedColumn,
      originalLine: original.line + preambleLines,
      originalColumn: original.column,
      name: segment.name ?? original.name,
    });
  });
  if (entries.length === 0 && !modes.istanbulMode) {
    console.warn(
      `Composed source map for ${sourcePath} produced no mappings; coverage will not attribute to this file.`,
    );
    return { code };
  }

  return {
    code,
    instrumentedCode,
    map:
      entries.length > 0
        ? {
            relativeSource: relative(distDir, sourcePath).split("\\").join("/"),
            originalText: text,
            entries,
          }
        : undefined,
  };
}

async function concatCss(dir: string, files: readonly string[]): Promise<string> {
  const parts = await Promise.all(files.map((name) => readFile(join(dir, name), "utf8")));
  return parts.join("\n");
}

// Concatenates the UMD wrappers + core sources into the final bundle text
// (`${umdWrapperTop}\n${file0}\n${file1}\n...\n${fileN}\n${umdWrapperBottom}`).
// Coverage mode additionally composes a sourcemap from generated ranges back
// to js/*.ts. Istanbul mode additionally assembles a counter-instrumented UMD
// from each file's `instrumentedCode`.
async function assembleBundle(
  files: readonly string[],
  modes: BuildModes,
): Promise<{ js: string; map?: string; instrumentedJs?: string }> {
  const sources = await Promise.all(files.map((name) => readJsSource(name, modes)));
  const combined = new GenMapping({ file: "SocialCalc.js" });

  let js = umdWrapperTop;
  // 0-based count of newlines emitted so far == 1-based line number of the
  // last line currently in `js`, minus 1.
  let lineCursor = (umdWrapperTop.match(/\n/g) ?? []).length;

  const appendChunk = (chunk: string, mapping?: CoreSourceMap) => {
    js += "\n";
    lineCursor += 1;
    if (mapping) {
      setSourceContent(combined, mapping.relativeSource, mapping.originalText);
      for (const entry of mapping.entries) {
        const generated = { line: lineCursor + entry.generatedLine, column: entry.generatedColumn };
        const original = { line: entry.originalLine, column: entry.originalColumn };
        if (entry.name) {
          maybeAddMapping(combined, {
            generated,
            source: mapping.relativeSource,
            original,
            name: entry.name,
          });
        } else {
          maybeAddMapping(combined, { generated, source: mapping.relativeSource, original });
        }
      }
    }
    js += chunk;
    lineCursor += (chunk.match(/\n/g) ?? []).length;
  };

  for (const source of sources) {
    appendChunk(source.code, source.map);
  }
  appendChunk(umdWrapperBottom);

  // Concatenate the Istanbul-instrumented sources under the same UMD wrappers;
  // executing this bundle writes counters to globalThis.__VITEST_COVERAGE__.
  let instrumentedJs: string | undefined;
  if (modes.istanbulMode && sources.every((s) => s.instrumentedCode !== undefined)) {
    instrumentedJs = umdWrapperTop;
    for (const source of sources) {
      instrumentedJs += "\n";
      instrumentedJs += source.instrumentedCode!;
    }
    instrumentedJs += "\n";
    instrumentedJs += umdWrapperBottom;
  }

  if (!modes.coverageMode || allMappings(combined).length === 0) {
    return { js, instrumentedJs };
  }
  return { js, map: JSON.stringify(toEncodedMap(combined)), instrumentedJs };
}

/**
 * Builds the coverage-only UMD used by the default test runner. This bypasses
 * the shipping build mode deliberately: `vp test` must never depend on a stale
 * ignored artifact, while ordinary `vp build` must remain byte-clean.
 */
export async function writeSocialCalcIstanbulBundle(): Promise<void> {
  const assembled = await assembleBundle(coreFiles, {
    coverageMode: false,
    istanbulMode: true,
  });
  if (assembled.instrumentedJs === undefined) {
    throw new Error("Failed to assemble dist/SocialCalc.instrumented.js");
  }
  await mkdir(distDir, { recursive: true });
  await writeFile(bundleInstrumentedPath, assembled.instrumentedJs);
}

export function socialCalcBuildPlugin(): Plugin {
  let emitMinified = false;

  return {
    name: "socialcalc-build",
    apply: "build",
    configResolved(config) {
      emitMinified = config.build.minify !== false;
    },
    resolveId(source) {
      return source === socialCalcBuildInput ? resolvedBuildInput : null;
    },
    load(id) {
      return id === resolvedBuildInput ? "globalThis;" : null;
    },
    buildStart() {
      for (const name of coreFiles) {
        this.addWatchFile(join(jsDir, resolveJsSource(name)));
      }
      for (const name of cssFiles) {
        this.addWatchFile(join(cssDir, name));
      }
    },
    async generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        delete bundle[fileName];
      }

      const assembled = await assembleBundle(coreFiles, { coverageMode, istanbulMode });
      // The minified build is derived from the undecorated bundle text —
      // it never carries a sourceMappingURL comment or a map, whether or
      // not coverageMode is on.
      if (emitMinified) {
        const result = await minify("SocialCalc.min.js", assembled.js);
        this.emitFile({
          type: "asset",
          fileName: "SocialCalc.min.js",
          source: assertMinified("SocialCalc.min.js", result),
        });
      }

      const js = assembled.map
        ? `${assembled.js}//# sourceMappingURL=SocialCalc.js.map\n`
        : assembled.js;
      this.emitFile({
        type: "asset",
        fileName: "SocialCalc.js",
        source: js,
      });
      if (assembled.map) {
        this.emitFile({
          type: "asset",
          fileName: "SocialCalc.js.map",
          source: assembled.map,
        });
      } else if (existsSync(bundleMapPath)) {
        // A normal (non-coverage) build: delete any map left on disk by an
        // earlier `SOCIALCALC_COVERAGE=1` build so dist/ never carries a
        // stale, unreferenced .map next to a SocialCalc.js that no longer
        // points at it.
        unlinkSync(bundleMapPath);
      }

      if (assembled.instrumentedJs !== undefined) {
        this.emitFile({
          type: "asset",
          fileName: "SocialCalc.instrumented.js",
          source: assembled.instrumentedJs,
        });
      } else if (existsSync(bundleInstrumentedPath)) {
        // A non-istanbul build: delete any instrumented bundle left on disk by
        // an earlier `SOCIALCALC_COVERAGE_ISTANBUL=1` build so dist/ never
        // carries a stale bundle that doesn't match the current sources.
        unlinkSync(bundleInstrumentedPath);
      }

      this.emitFile({
        type: "asset",
        fileName: "socialcalc.css",
        source: await concatCss(cssDir, cssFiles),
      });
    },
    async closeBundle() {
      // The shipping bundle is generated, not hand-maintained, but it is still
      // tracked and checked by `vp check`. Run the same Vite+ formatter after
      // ordinary builds so a fresh checkout and a fresh build are canonical.
      // Coverage builds retain their pre-format text because the composed map
      // addresses those exact generated lines and columns.
      if (coverageMode) return;
      const vpPackageDir = dirname(requireFromBuild.resolve("vite-plus/package.json"));
      const vpBin = join(vpPackageDir, "bin/vp");
      execFileSync(process.execPath, [vpBin, "fmt", "dist/SocialCalc.js", "--write"], {
        cwd: root,
        stdio: "inherit",
      });
      // Oxfmt intentionally preserves whitespace inside license comments.
      // Remove line-end whitespace without changing any comment text.
      const formatted = await readFile(bundlePath, "utf8");
      await writeFile(bundlePath, formatted.replace(/[ \t]+$/gmu, ""));
    },
  };
}
