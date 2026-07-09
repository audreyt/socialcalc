#!/usr/bin/env bun
// Bun-powered replacement for the original Gulpfile.
// Concatenates the legacy SocialCalc sources (order matters — the UMD wrapper
// bookends everything and the inner files reference each other via the shared
// `SocialCalc` namespace) and writes them to ./dist.
//
// Entries may be `.js` or `.ts`. A listed `.js` path prefers a sibling `.ts`
// when present (gradual in-place conversion). TypeScript sources are stripped
// to plain JS via Bun.Transpiler before concat so dist/SocialCalc.js stays a
// browser-ready UMD bundle with no runtime TS tax.

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const jsDir = join(root, "js");
const cssDir = join(root, "css");
const distDir = join(root, "dist");

// Logical concat order. Prefer sibling `.ts` when a listed `.js` has been
// converted in place (see resolveJsSource).
const jsFiles = [
    "module-wrapper-top.js",
    "socialcalcconstants.js",
    "socialcalc-3.js",
    "socialcalctableeditor.js",
    "formatnumber2.js",
    "formula1.js",
    "socialcalcpopup.js",
    "socialcalcspreadsheetcontrol.js",
    "socialcalcviewer.js",
    "module-wrapper-bottom.js",
];

const cssFiles = ["socialcalc.css"];

const tsTranspiler = new Bun.Transpiler({
    loader: "ts",
    target: "browser",
});

// Bun.Transpiler drops comments. Reattach the leading // and /* */ preamble
// (copyright / Artistic License / module banner) so dist keeps legal headers.
function leadingCommentPreamble(source: string): string {
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
    if (i === 0) return "";
    return `${source.slice(0, i).replace(/\s+$/u, "")}\n\n`;
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

async function readJsSource(name: string): Promise<string> {
    const resolved = resolveJsSource(name);
    const text = await readFile(join(jsDir, resolved), "utf8");
    if (resolved.endsWith(".ts")) {
        return leadingCommentPreamble(text) + tsTranspiler.transformSync(text);
    }
    return text;
}

async function concatJs(files: readonly string[]): Promise<string> {
    const parts = await Promise.all(files.map((name) => readJsSource(name)));
    return parts.join("\n");
}

async function concatCss(dir: string, files: readonly string[]): Promise<string> {
    const parts = await Promise.all(
        files.map((name) => readFile(join(dir, name), "utf8")),
    );
    return parts.join("\n");
}

await mkdir(distDir, { recursive: true });

const js = await concatJs(jsFiles);
await writeFile(join(distDir, "SocialCalc.js"), js);

const css = await concatCss(cssDir, cssFiles);
await writeFile(join(distDir, "socialcalc.css"), css);

// Optional minified variant — emitted only when `--minify` is passed so local
// development stays fast.
if (process.argv.includes("--minify")) {
    const out = await Bun.build({
        entrypoints: [join(distDir, "SocialCalc.js")],
        minify: true,
        target: "browser",
        format: "iife",
        outdir: distDir,
        naming: "SocialCalc.min.js",
    });
    if (!out.success) {
        console.error(out.logs);
        process.exit(1);
    }
}

console.log(`wrote ${join(distDir, "SocialCalc.js")} (${js.length} bytes)`);
console.log(`wrote ${join(distDir, "socialcalc.css")} (${css.length} bytes)`);
