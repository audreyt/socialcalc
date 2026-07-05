import { createFormulaRefBackend } from "./adapter.mjs";

export async function loadFormulaRefFallback(
    modulePath = new URL("../dist/formula_ref_core.fallback.mjs", import.meta.url),
) {
    const mod = await import(modulePath.href);
    return createFormulaRefBackend(mod);
}