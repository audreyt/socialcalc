// Real-browser Playwright suite for the built SocialCalc UMD bundles. Kept
// entirely separate from `vp test` (Vitest, `test/**/*.test.ts`): this
// config only drives `e2e/**/*.spec.ts` against the static fixture server
// in `e2e/server.ts`, which serves `dist/`, `images/`, and `css/` as a real
// host page would. Run with `vp run test:browser`; see
// .github/workflows/browser.yml for the CI invocation (build, then test).
//
// `SOCIALCALC_BROWSER_COVERAGE=1` selects a Chromium-only coverage run: every
// page (via e2e/fixtures/editor.ts's `coverage` auto-fixture) starts Chromium
// JS coverage before the spec navigates, stops it after the spec, and writes
// its raw V8 `stopJSCoverage()` entries to `coverage-browser-v8/<test-id>.json`.
// Firefox/WebKit are skipped on a coverage run because the Playwright/V8
// coverage API is Chromium-only; the merged gate (scripts/merge-browser-coverage.mjs)
// reads those files and merges with Vitest's Istanbul coverage-final.json.
//
// Firefox/WebKit remain behavioral on plain `vp run test:browser` (env unset):
// the same spec files still run against all three engines, exactly as before.

import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const port = 4173;
const coverageMode = process.env.SOCIALCALC_BROWSER_COVERAGE === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retries: a real-browser CI signal must be deterministic, not
  // green-on-retry. `workers: 1` is deliberate for the same reason —
  // concurrent chromium/firefox/webkit processes on a resource-constrained
  // runner can starve a page's first render long enough for a click to
  // land before the control has finished rendering; every helper that
  // drives a click (`clickCell`) already polls/retries the click+verify
  // cycle itself against real observable state (`editor.ecell.coord`), so
  // serial execution removes the scheduling variable instead of masking it.
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
    timezoneId: "UTC",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Coverage-mode runs filter to Chromium only — Playwright/V8 JS coverage
  // is a Chromium-specific API. Naming the project `chromium-coverage`
  // (not just `chromium`) so a stray `-g chromium` filter from CI wouldn't
  // double-drive the same spec under both the behavioral and coverage
  // projects. The non-coverage path preserves the original three-project
  // behavioral suite exactly (chromium + firefox + webkit).
  projects: coverageMode
    ? [{ name: "chromium-coverage", use: { ...devices["Desktop Chrome"] } }]
    : [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
      ],
  webServer: {
    command: `node --experimental-strip-types e2e/server.ts`,
    url: `http://127.0.0.1:${port}/normal.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
