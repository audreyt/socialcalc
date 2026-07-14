// Focused tooling test for the Chromium Playwright V8 coverage pipeline
// (scripts/merge-browser-coverage.mjs + e2e/fixtures/editor.ts's `coverage`
// auto-fixture). Proves end-to-end that a statement exercised in a real
// browser soundly maps through dist/SocialCalc.js's composed sourcemap to the
// correct js/socialcalctableeditor.ts source line, and that merging the
// browser result adds its hit count to the unit result.
//
// The chosen anchor is `TableEditorSC.TableEditor.prototype.FitToEditTable =
// function (...)` in js/socialcalctableeditor.ts. InitializeSpreadsheetControl's
// real-DOM render path calls this passthrough via CalculateEditorPositions,
// which reads getBoundingClientRect. The unit suite now also drives the
// passthrough with its deterministic fake-layout fixtures, so this test must
// not assume the unit hit count is zero. Instead, it proves that Chromium
// reports a hit at the exact mapped source line and that CoverageMap.merge
// raises the unit count by the browser count.
//
// This is NOT a "file exists in coverage map" check. The assertions use hit
// counts at an exact source line: browser-only hits >= 1, the bundle position
// resolves to that same TypeScript line, and merged hits are greater than the
// unit-only baseline.
//
// Skipped automatically when Chromium is unavailable (e.g. a unit-only CI
// runner without `playwright install chromium`): the gate that owns this
// pipeline (`test:coverage:merged`) installs Chromium before invoking, so a
// skip here is a real environment gap, not a silent hole.

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import process from "node:process";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { chromium } from "@playwright/test";
import { convert as v8ToIstanbul } from "ast-v8-to-istanbul";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { parse } from "@babel/parser";
import type { Browser, Page } from "@playwright/test";
// `istanbul-lib-coverage` ships runtime JS without declarations in this
// repository's dependency tree. Keep the tiny surface used by this focused
// test typed locally instead of weakening the project-wide compiler settings.
// @ts-expect-error -- package has no bundled declarations.
import istanbulCoverage from "istanbul-lib-coverage";
type FileCoverage = {
  statementMap: Record<string, { start: { line: number } }>;
  s: Record<string, number>;
};
type CoverageMap = {
  files(): string[];
  fileCoverageFor(path: string): FileCoverage;
  merge(other: unknown): void;
};
const coverageApi = istanbulCoverage as unknown as {
  createCoverageMap(data?: unknown): CoverageMap;
};
const createCoverageMap = (data?: unknown): CoverageMap => coverageApi.createCoverageMap(data);
type BrowserControl = {
  InitializeSpreadsheetControl(
    container: HTMLElement | string,
    width: number,
    height: number,
    flags: number,
  ): void;
  editor: {
    EditorScheduleSheetCommands(command: string, execute: boolean): void;
  };
  sheet: {
    attribs: { needsrecalc?: string };
    cells: Record<string, { datavalue?: unknown }>;
  };
};
type BrowserWindow = Window & {
  SocialCalc: {
    SpreadsheetControl: new (prefix: string) => BrowserControl;
    SetSpreadsheetControlObject(control: BrowserControl): void;
  };
  $: unknown;
  __scControl: BrowserControl;
};
const mappingTestEnabled = process.env.SOCIALCALC_BROWSER_COVERAGE_TEST === "1";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(repoRoot, "dist");
const bundlePath = join(distDir, "SocialCalc.js");
const mapPath = join(distDir, "SocialCalc.js.map");
const unitFinalPath = join(repoRoot, "coverage", "coverage-final.json");
const vpBin = join(repoRoot, "node_modules", ".bin", "vp");

// Anchor: a unique substring in js/socialcalctableeditor.ts whose on-disk
// source line we use as the statement-mapping target. Verified unique in both
// the bundle and the source via grep below; if a future edit duplicates the
// anchor or moves it, the test fails loudly rather than silently testing the
// wrong line.
const anchorSourceSubstring = "TableEditorSC.TableEditor.prototype.FitToEditTable = function";
const expectedSourceFileSuffix = "js/socialcalctableeditor.ts";

// Static fixture server. Minimal: only `/dist/SocialCalc.js` and
// `/vendor/jquery.js` (SpreadsheetControl's runtime dependency per README).
// No network at runtime — everything is a local file read.
const port = 4187;
const fixtureHtml = `<!doctype html><html><head><meta charset="utf-8"><script src="/vendor/jquery.js"></script><script src="/dist/SocialCalc.js"></script></head><body><div id="containerDiv"></div></body></html>`;
let server: Server;
let browser: Browser | undefined;
let bundleCode: string;
let bundleMap: { version: 3; file: string; names: string[]; sources: string[]; mappings: string };
let anchorSourceLine: number;
let anchorBundleLine: number;
let anchorBundleColumn: number;

async function tryLaunchChromium(): Promise<boolean> {
  try {
    browser = await chromium.launch({ headless: true });
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  // No-op unless the opt-in flag is set — this suite only has teeth as part
  // of `test:coverage:merged`'s sequenced run. Without this guard, merely
  // including this file in ANY `vp test` invocation (e.g. plain `vp test
  // run`) would unconditionally rebuild dist/SocialCalc.js in coverage mode
  // as a side effect, silently dirtying a git-tracked build artifact even
  // though every test below is skipped.
  if (!mappingTestEnabled) return;

  // Ensure a coverage-mode build of dist/SocialCalc.js + .sourcemap.map
  // exists. Same idempotent pattern as test/build-sourcemap.test.ts: only
  // rebuild when the ambient state isn't already coverage-mode (which it is
  // under `vp test --coverage`, the only path that runs this file with the
  // sourcemap present).
  const alreadyCoverageBuilt =
    existsSync(mapPath) && readFileSync(bundlePath, "utf8").includes("sourceMappingURL");
  if (!alreadyCoverageBuilt) {
    execFileSync(vpBin, ["build"], {
      cwd: repoRoot,
      env: { ...process.env, SOCIALCALC_COVERAGE: "1" },
      stdio: "pipe",
    });
  }
  bundleCode = readFileSync(bundlePath, "utf8");
  bundleMap = JSON.parse(readFileSync(mapPath, "utf8"));

  // Find the anchor in the real on-disk source — never a hardcoded line
  // number, so the test survives unrelated line-count shifts in the file.
  // Require uniqueness exactly as test/build-sourcemap.test.ts does.
  const sourcePath = join(repoRoot, expectedSourceFileSuffix);
  const sourceLines = readFileSync(sourcePath, "utf8").split("\n");
  const sourceMatches = sourceLines.filter((l) => l.includes(anchorSourceSubstring));
  expect(
    sourceMatches,
    `expected exactly one "${anchorSourceSubstring}" in ${expectedSourceFileSuffix}`,
  ).toHaveLength(1);
  anchorSourceLine = sourceLines.findIndex((l) => l.includes(anchorSourceSubstring)) + 1;

  // Find the same anchor in the bundle, independently, so we can map V8
  // coverage ranges to the exact (line, col) the sourcemap should resolve.
  const bundleLines = bundleCode.split("\n");
  const bundleMatches = bundleLines.filter((l) => l.includes(anchorSourceSubstring));
  expect(bundleMatches, `expected exactly one anchor occurrence in bundle`).toHaveLength(1);
  const anchorLineIdx = bundleLines.findIndex((l) => l.includes(anchorSourceSubstring));
  anchorBundleLine = anchorLineIdx + 1;
  anchorBundleColumn = bundleLines[anchorLineIdx]!.indexOf(anchorSourceSubstring);

  server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (u.pathname === "/" || u.pathname === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" }).end(fixtureHtml);
      return;
    }
    if (u.pathname === "/vendor/jquery.js") {
      res
        .writeHead(200, { "content-type": "text/javascript" })
        .end(readFileSync(join(repoRoot, "node_modules/jquery/dist/jquery.js")));
      return;
    }
    if (u.pathname === "/dist/SocialCalc.js") {
      res
        .writeHead(200, { "content-type": "text/javascript" })
        .end(readFileSync(bundlePath));
      return;
    }
    res.writeHead(404).end("not found");
  });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));

  const ok = await tryLaunchChromium();
  // Skip the entire suite when Chromium is unavailable — the merge-script
  // pipeline (`test:coverage:merged`) installs Chromium before invoking, so a
  // skip here is a real environment gap, not a silent hole. Vitest's
  // `test.skip` doesn't exist at suite-scope in this older version; we mark
  // every test below with a `chromiumAvailable` guard instead.
  if (!ok) {
    (globalThis as { __SC_BROWSER_COVERAGE_MAPPING_SKIP?: boolean }).__SC_BROWSER_COVERAGE_MAPPING_SKIP = true;
  }
}, 120_000);

afterAll(async () => {
  if (browser) await browser.close();
  if (server) await new Promise<void>((r) => server.close(() => r()));
});

function chromiumAvailable(): boolean {
  return !(globalThis as { __SC_BROWSER_COVERAGE_MAPPING_SKIP?: boolean }).__SC_BROWSER_COVERAGE_MAPPING_SKIP;
}

// Helper: find the statement id whose start line matches `anchorSourceLine`
// in a given FileCoverage's statementMap. Returns the id, or throws if none.
function findStatementAtLine(fileCoverage: { statementMap: Record<string, { start: { line: number } }>; s: Record<string, number> }, line: number): { id: string; hits: number } {
  // exact line match preferred; fall back to "any statement whose start line
  // equals line" (the function-assignment statement is a single-line
  // declaration in socialcalctableeditor.ts).
  for (const [id, sm] of Object.entries(fileCoverage.statementMap)) {
    if (sm.start.line === line) {
      return { id, hits: fileCoverage.s[id] ?? 0 };
    }
  }
  throw new Error(`no statement found at line ${line} in ${expectedSourceFileSuffix}`);
}

const mappingDescribe = mappingTestEnabled ? describe : describe.skip;
mappingDescribe("Chromium Playwright V8 → Istanbul → js/*.ts mapping (focused tooling)", () => {
  test("FitToEditTable has a unit baseline for the browser merge delta", () => {
    if (!chromiumAvailable()) {
      test.skip("Chromium is unavailable");
      return;
    }
    if (!existsSync(unitFinalPath)) {
      throw new Error(
        `${unitFinalPath} missing — run \`SOCIALCALC_COVERAGE=1 vp test --coverage\` before the mapping test`,
      );
    }
    const unitMap: CoverageMap = createCoverageMap(JSON.parse(readFileSync(unitFinalPath, "utf8")));
    const teKey = unitMap.files().find((f) => f.endsWith(expectedSourceFileSuffix));
    expect(teKey, `${expectedSourceFileSuffix} present in unit coverage`).toBeDefined();
    const stmt = findStatementAtLine(unitMap.fileCoverageFor(teKey!), anchorSourceLine);
    expect(
      stmt.hits,
      `unit-only hits for FitToEditTable (line ${anchorSourceLine}) provide the baseline for the browser merge delta`,
    ).toBeGreaterThan(0);
  });

  test("real Chromium coverage soundly remaps to the correct TS source line and raises the merged hit count", async () => {
    if (!chromiumAvailable()) {
      test.skip("Chromium is unavailable");
      return;
    }
    const ctx = await browser!.newContext();
    const page: Page = await ctx.newPage();
    await page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false });
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => {
      const win = window as unknown as BrowserWindow;
      return !!(win.SocialCalc?.SpreadsheetControl && win.$ !== undefined);
    });

    // Drive the live-DOM layout path: InitializeSpreadsheetControl calls
    // CalculateEditorPositions → FitToEditTable, reading getBoundingClientRect
    await page.evaluate(() => {
      const win = window as unknown as BrowserWindow;
      const container = document.getElementById("containerDiv");
      if (!container) throw new Error("fixture container missing");
      const control = new win.SocialCalc.SpreadsheetControl("SocialCalc-");
      control.InitializeSpreadsheetControl(container, 400, 700, 0);
      win.SocialCalc.SetSpreadsheetControlObject(control);
      win.__scControl = control;
    });
    await page.evaluate(() => {
      const win = window as unknown as BrowserWindow;
      win.__scControl.editor.EditorScheduleSheetCommands("recalc", true);
    });
    await page.waitForFunction(() => {
      const win = window as unknown as BrowserWindow;
      return win.__scControl.sheet.attribs.needsrecalc !== "yes";
    });
    await page.evaluate(() => {
      const win = window as unknown as BrowserWindow;
      win.__scControl.editor.EditorScheduleSheetCommands("set A1 value n 42", true);
    });
    await page.waitForFunction(() => {
      const win = window as unknown as BrowserWindow;
      return win.__scControl.sheet.cells.A1?.datavalue === 42;
    });

    const entries = await page.coverage.stopJSCoverage();
    await ctx.close();

    const bundleEntry = entries.find((e) => e.url.endsWith("/dist/SocialCalc.js"));
    expect(bundleEntry, "Playwright reported coverage for the bundle URL").toBeDefined();

    // Convert V8 ranges through ast-v8-to-istanbul + the bundle's composed
    // sourcemap — exactly what scripts/merge-browser-coverage.mjs does per
    // spec. The ast cache is per-call; for this one entry, parse fresh.
    const ast = parse(bundleCode, { sourceType: "script", allowReturnOutsideFunction: true });
    const covData = await v8ToIstanbul({
      code: bundleCode,
      sourceMap: bundleMap,
      ast,
      coverage: { functions: bundleEntry!.functions, url: pathToFileURL(bundlePath).href },
      wrapperLength: 0,
    });

    // Normalize in-memory convert output (sentinel Infinity for missing end
    // columns) to the JSON-serialized form (Infinity → null under
    // JSON.stringify), matching what coverage-final.json already has. Same
    // fix the merge script applies, kept here so the local merged map below
    // uses identical statementMap keys as the unit-only side.
    const browserMap = createCoverageMap(JSON.parse(JSON.stringify(covData)));
    const teBrowserKey = browserMap
      .files()
      .find((f) => f.endsWith(expectedSourceFileSuffix));
    expect(teBrowserKey, `${expectedSourceFileSuffix} present in browser-converted coverage`).toBeDefined();
    const browserFc = browserMap.fileCoverageFor(teBrowserKey!);
    const browserStmt = findStatementAtLine(browserFc, anchorSourceLine);

    // (A) Maps to the correct TS source line: the converted browser coverage
    // has a hit at exactly the FitToEditTable assignment line in
    // js/socialcalctableeditor.ts. Not just "file in the map" — same line.
    expect(
      browserStmt.hits,
      `browser hits for FitToEditTable (line ${anchorSourceLine}) — expected >= 1, proving the V8 range maps through the sourcemap to this exact TS source line`,
    ).toBeGreaterThanOrEqual(1);

    // (B) Round-trip the bundle position through the sourcemap independently:
    // the bundle's (anchorBundleLine, anchorBundleColumn) MUST resolve to
    // js/socialcalctableeditor.ts line anchorSourceLine. This is the direct check that
    // the mapping, not just the convert() call, is sound at this anchor.
    const trace = new TraceMap(bundleMap);
    const orig = originalPositionFor(trace, {
      line: anchorBundleLine,
      column: anchorBundleColumn,
    });
    expect(orig.source, "sourcemap source root for the anchor").toContain(expectedSourceFileSuffix);
    expect(orig.line, "sourcemap-resolved line for the anchor").toBe(anchorSourceLine);

    // (C) Merging with unit coverage raises the count by adding a real
    // browser hit. Build the union with the SAME CoverageMap.merge the merge
    // script uses.
    let merged: CoverageMap;
    let unitHits = 0;
    if (existsSync(unitFinalPath)) {
      merged = createCoverageMap(JSON.parse(readFileSync(unitFinalPath, "utf8")));
      const teUnitKey = merged.files().find((f) => f.endsWith(expectedSourceFileSuffix));
      expect(teUnitKey, `${expectedSourceFileSuffix} present in unit coverage`).toBeDefined();
      unitHits = findStatementAtLine(merged.fileCoverageFor(teUnitKey!), anchorSourceLine).hits;
    } else {
      merged = createCoverageMap({});
    }
    merged.merge(JSON.parse(JSON.stringify(covData)));
    const teMergedKey = merged.files().find((f) => f.endsWith(expectedSourceFileSuffix));
    expect(teMergedKey, `${expectedSourceFileSuffix} present in merged coverage`).toBeDefined();
    const mergedFc = merged.fileCoverageFor(teMergedKey!);
    const mergedStmt = findStatementAtLine(mergedFc, anchorSourceLine);
    expect(
      mergedStmt.hits,
      `merged hits for FitToEditTable (line ${anchorSourceLine}) — expected the browser result to raise the unit-only count`,
    ).toBeGreaterThan(unitHits);
  }, 60_000);
});
