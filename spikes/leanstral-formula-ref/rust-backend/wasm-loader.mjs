import { createFormulaRefBackend } from "./adapter.mjs";

export async function loadFormulaRefWasm(
    wasmPath = new URL("../dist/formula_ref_core.wasm", import.meta.url),
) {
    const bytes = await Bun.file(wasmPath).arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return createFormulaRefBackend(instance.exports);
}