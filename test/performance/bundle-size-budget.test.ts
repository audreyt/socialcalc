// Size budget for the shipping bundle. Fully deterministic (a byte count on
// disk, no wall-clock timing) — this belongs in the performance directory
// rather than a normal unit test file because it's a budget assertion, not
// a behavioral one, but it carries none of the flakiness risk wall-clock
// timing does.
//
// Baseline re-measured 2026-07-19 against this worktree's `vp build` output
// on the `compat/integration` branch after workbook/charts/data-validation/
// lambda-formulas/pivot-tables/criteria-functions/html-clipboard-paste were
// all merged on top of the original 2026-07-12 719,438-byte single-feature
// baseline: dist/SocialCalc.js is 1,293,735 bytes. The budget below uses a
// wide, conservative band around that measurement so ordinary source
// changes never trip it, while a genuine regression (an accidentally
// bundled dependency, a lost build step, a truncated build) would.
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

const MEASURED_BASELINE_BYTES = 1_293_735;
const MIN_BYTES = 400_000; // catches a truncated or empty build
const MAX_BYTES = 1_700_000; // catches accidental bloat (~1.3x baseline)

describe("shipping bundle size budget", () => {
  test("dist/SocialCalc.js stays within a conservative band around the measured baseline", () => {
    const bundlePath = fileURLToPath(new URL("../../dist/SocialCalc.js", import.meta.url));
    const { size } = statSync(bundlePath);

    expect(size, "dist/SocialCalc.js is empty or missing its build output").toBeGreaterThan(
      MIN_BYTES,
    );
    expect(
      size,
      `dist/SocialCalc.js grew far past the ${MEASURED_BASELINE_BYTES}-byte baseline`,
    ).toBeLessThan(MAX_BYTES);
  });

  test("dist/socialcalc.css exists and is non-trivial", () => {
    const cssPath = fileURLToPath(new URL("../../dist/socialcalc.css", import.meta.url));
    const { size } = statSync(cssPath);
    expect(size).toBeGreaterThan(500);
    expect(size).toBeLessThan(50_000);
  });
});
