import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const spikeDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(spikeDir, "..", "..");
const distDir = join(spikeDir, "dist");
const wasmOut = join(distDir, "formula_ref_core.wasm");
const fallbackOut = join(distDir, "formula_ref_core.fallback.mjs");

function run(cmd, args, options = {}) {
    const result = spawnSync(cmd, args, {
        cwd: repoRoot,
        stdio: "inherit",
        ...options,
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function findWasm2js() {
    const candidates = [
        join(repoRoot, "node_modules", ".bin", "wasm2js"),
        join(repoRoot, "node_modules", ".bin", "wasm2js.cmd"),
    ];
    for (const p of candidates) {
        if (existsSync(p)) {
            return p;
        }
    }
    throw new Error("Binaryen wasm2js not found; run bun install");
}

run("cargo", ["test", "-p", "formula-ref-core"]);
run("cargo", [
    "build",
    "--release",
    "-p",
    "formula-ref-core",
    "--target",
    "wasm32-unknown-unknown",
]);

const wasmSrc = join(
    repoRoot,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "formula_ref_core.wasm",
);
mkdirSync(distDir, { recursive: true });
copyFileSync(wasmSrc, wasmOut);

const wasm2js = findWasm2js();
run(wasm2js, [wasmOut, "-o", fallbackOut]);

console.log("wrote spikes/leanstral-formula-ref/dist/formula_ref_core.wasm");
console.log(
    "wrote spikes/leanstral-formula-ref/dist/formula_ref_core.fallback.mjs",
);