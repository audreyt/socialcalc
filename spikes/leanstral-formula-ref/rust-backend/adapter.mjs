const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requireExport(exportsObject, name) {
    const fn = exportsObject[name];
    if (typeof fn !== "function") {
        throw new Error(`${name} export missing`);
    }
    return fn;
}

function movedToMap(movedto) {
    const keys = Object.keys(movedto).sort();
    return keys.map((k) => `${k}=${movedto[k]}`).join("\n");
}

/**
 * @param {WebAssembly.Exports | Record<string, unknown>} exportsObject
 */
export function createFormulaRefBackend(exportsObject) {
    const alloc = requireExport(exportsObject, "formula_ref_alloc");
    const dealloc = requireExport(exportsObject, "formula_ref_dealloc");
    const rewrite = requireExport(exportsObject, "formula_ref_rewrite");
    const resultPtr = requireExport(exportsObject, "formula_ref_result_ptr");
    const resultLen = requireExport(exportsObject, "formula_ref_result_len");
    const memory = exportsObject.memory;
    if (
        memory == null ||
        typeof memory !== "object" ||
        !("buffer" in memory) ||
        !(memory.buffer instanceof ArrayBuffer)
    ) {
        throw new Error("memory export missing");
    }

    function readResult() {
        const ptr = resultPtr();
        const len = resultLen();
        const view = new Uint8Array(memory.buffer, ptr, len);
        return decoder.decode(view);
    }

    function writeToWasm(bytes) {
        const ptr = alloc(bytes.length);
        if (ptr === 0 && bytes.length > 0) {
            throw new Error("formula_ref_alloc returned null");
        }
        try {
            const view = new Uint8Array(memory.buffer, ptr, bytes.length);
            view.set(bytes);
            return ptr;
        } catch (err) {
            dealloc(ptr, bytes.length);
            throw err;
        }
    }

    function invokeRewrite(mode, formula, a, b, c, d, mapText = "") {
        const formulaBytes = encoder.encode(formula);
        const mapBytes = encoder.encode(mapText);
        const formulaPtr = writeToWasm(formulaBytes);
        let mapPtr = 0;
        try {
            if (mapBytes.length > 0) {
                mapPtr = writeToWasm(mapBytes);
            }
            const status = rewrite(
                mode,
                formulaPtr,
                formulaBytes.length,
                a,
                b,
                c,
                d,
                mapPtr,
                mapBytes.length,
            );
            if (status !== 0) {
                const message = readResult();
                throw new Error(`formula_ref_rewrite failed (${status}): ${message}`);
            }
            return readResult();
        } finally {
            dealloc(formulaPtr, formulaBytes.length);
            if (mapPtr !== 0) {
                dealloc(mapPtr, mapBytes.length);
            }
        }
    }

    return {
        offsetFormulaCoords(formula, coloffset, rowoffset) {
            return invokeRewrite(1, formula, coloffset, rowoffset, 0, 0, "");
        },
        adjustFormulaCoords(formula, col, coloffset, row, rowoffset) {
            return invokeRewrite(2, formula, col, coloffset, row, rowoffset, "");
        },
        replaceFormulaCoords(formula, movedto) {
            const mapText = movedToMap(movedto);
            return invokeRewrite(3, formula, 0, 0, 0, 0, mapText);
        },
    };
}