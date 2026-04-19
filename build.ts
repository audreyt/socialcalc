#!/usr/bin/env bun
// Bun-powered replacement for the original Gulpfile.
// Concatenates the legacy SocialCalc sources (order matters — the UMD wrapper
// bookends everything and the inner files reference each other via the shared
// `SocialCalc` namespace) and writes them to ./dist.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const jsDir = join(root, "js");
const cssDir = join(root, "css");
const distDir = join(root, "dist");

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

async function concat(dir: string, files: readonly string[]): Promise<string> {
    const parts = await Promise.all(
        files.map((name) => readFile(join(dir, name), "utf8")),
    );
    return parts.join("\n");
}

await mkdir(distDir, { recursive: true });

const js = await concat(jsDir, jsFiles);
await writeFile(join(distDir, "SocialCalc.js"), js);

const css = await concat(cssDir, cssFiles);
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
