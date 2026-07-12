// Real-browser Playwright suite for the built SocialCalc UMD bundles. Kept
// entirely separate from `vp test` (Vitest, `test/**/*.test.ts`): this
// config only drives `e2e/**/*.spec.ts` against the static fixture server
// in `e2e/server.ts`, which serves `dist/`, `images/`, and `css/` as a real
// host page would. Run with `vp run test:browser`; see
// .github/workflows/browser.yml for the CI invocation (build, then test).

import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const port = 4173;

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
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `node e2e/server.ts`,
    url: `http://127.0.0.1:${port}/normal.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
