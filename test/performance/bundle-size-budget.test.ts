// Size budget for the shipping bundle. Fully deterministic (a byte count on
// disk, no wall-clock timing) — this belongs in the performance directory
// rather than a normal unit test file because it's a budget assertion, not
// a behavioral one, but it carries none of the flakiness risk wall-clock
// timing does.
//
// Baseline measured 2026-07-12 against this worktree's `vp build` output:
// dist/SocialCalc.js was 719,438 bytes (committed) / 716,908 bytes (freshly
// rebuilt — Oxc/Bun.Transpiler version drift between environments produces
// a few hundred bytes of difference; see AGENTS.md's build-determinism
// notes). The budget below uses a wide, conservative band around that
// measurement so ordinary source changes never trip it, while a genuine
// regression (an accidentally bundled dependency, a lost build step, a
// truncated build) would.
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

const MEASURED_BASELINE_BYTES = 719_438;
const MIN_BYTES = 400_000; // catches a truncated or empty build
const MAX_BYTES = 1_200_000; // catches accidental bloat (~1.7x baseline)

describe("shipping bundle size budget", () => {
  test("dist/SocialCalc.js stays within a conservative band around the measured baseline", () => {
    const bundlePath = fileURLToPath(new URL("../../dist/SocialCalc.js", import.meta.url));
    const { size } = statSync(bundlePath);

    expect(size, "dist/SocialCalc.js is empty or missing its build output").toBeGreaterThan(MIN_BYTES);
    expect(size, `dist/SocialCalc.js grew far past the ${MEASURED_BASELINE_BYTES}-byte baseline`).toBeLessThan(
      MAX_BYTES,
    );
  });

  test("dist/socialcalc.css exists and is non-trivial", () => {
    const cssPath = fileURLToPath(new URL("../../dist/socialcalc.css", import.meta.url));
    const { size } = statSync(cssPath);
    expect(size).toBeGreaterThan(500);
    expect(size).toBeLessThan(50_000);
  });
});
