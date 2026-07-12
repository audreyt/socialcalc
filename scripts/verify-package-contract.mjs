#!/usr/bin/env node
// Dedicated package-contract behavior gate. NOT part of the `vp test`
// suite: `vp pm pack` runs the `prepack` script (`vp build --minify`), and
// running that from inside a normal `vp test` worker would mean every plain
// `vp test` invocation pays for a pack + extract + external-tsc cycle, and
// risks a real recursive loop if `prepack`/`build`/`test` scripts are ever
// re-wired to depend on each other. Keeping this a standalone script that
// callers invoke explicitly (`vp run test:package-contract`) avoids both
// problems while still exercising the exact tarball a consumer would get
// from `npm install socialcalc`.
//
// Every check here is derived from the shipped artifacts at run time
// (package.json's own "files" field, the actual tar member list, the
// actual top-level key sets of each loaded entry point, ...). None of it
// hardcodes an incidental fact about the current build, such as its
// current top-level key count, as if it were a frozen public API.
//
// Deliberately NOT here: an are-the-types-wrong (ATTW) check. An earlier
// revision ran `bunx --bun @arethetypeswrong/cli <tarball>` as a
// best-effort, non-gating step. That made this durable CI gate
// non-deterministic (network-dependent, and this project prohibits
// invoking bun/bunx directly outside `vp`) — removed. The finding that
// prompted adding it in the first place is preserved as documentation,
// not as a live check: `import SC from "socialcalc"` (default import,
// the only ESM entry point this script verifies and the package
// promises) works under native Node ESM; `import { Sheet } from
// "socialcalc"` (named import) does not, because cjs-module-lexer
// cannot statically detect names inside the UMD IIFE's
// `module.exports = exported` reassignment. That is inherent to the
// CJS `export =` shape of the bundle, not a regression to watch for.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, cpSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const checks = [];
let failed = false;

function record(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail });
    console.log(`ok - ${name}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    failed = true;
    checks.push({ name, ok: false, detail: error.stack ?? String(error) });
    console.error(`FAIL - ${name}`);
    console.error(error.stack ?? String(error));
  }
}

async function recordAsync(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
    console.log(`ok - ${name}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    failed = true;
    checks.push({ name, ok: false, detail: error.stack ?? String(error) });
    console.error(`FAIL - ${name}`);
    console.error(error.stack ?? String(error));
  }
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

function expandFilesField(files, root) {
  // Supports literal paths and single "dir/*.ext"-shaped globs, which is
  // everything package.json's "files" array currently uses. Anything else
  // throws rather than silently under-checking the allowlist.
  const expected = new Set(["package.json"]);
  for (const pattern of files) {
    if (!pattern.includes("*")) {
      expected.add(pattern);
      continue;
    }
    const dir = path.posix.dirname(pattern);
    const base = path.posix.basename(pattern);
    const starCount = (base.match(/\*/g) ?? []).length;
    if (dir.includes("*") || starCount !== 1) {
      throw new Error(`unsupported "files" glob shape: ${pattern}`);
    }
    const [prefix, suffix] = base.split("*");
    for (const entry of readdirSync(path.join(root, dir))) {
      if (entry.startsWith(prefix) && entry.endsWith(suffix)) {
        expected.add(path.posix.join(dir, entry));
      }
    }
  }
  return expected;
}

function shapeOf(namespace) {
  const shape = {};
  for (const key of Object.keys(namespace)) shape[key] = typeof namespace[key];
  return shape;
}

function assertSameShape(aName, aShape, bName, bShape) {
  const keysA = new Set(Object.keys(aShape));
  const keysB = new Set(Object.keys(bShape));
  const onlyA = [...keysA].filter((k) => !keysB.has(k));
  const onlyB = [...keysB].filter((k) => !keysA.has(k));
  const typeMismatches = [...keysA]
    .filter((k) => keysB.has(k) && aShape[k] !== bShape[k])
    .map((k) => `${k}: ${aName}=${aShape[k]} ${bName}=${bShape[k]}`);
  if (onlyA.length || onlyB.length || typeMismatches.length) {
    throw new Error(
      `${aName} vs ${bName} top-level shape mismatch — ` +
        `onlyIn(${aName})=${JSON.stringify(onlyA)} ` +
        `onlyIn(${bName})=${JSON.stringify(onlyB)} ` +
        `typeMismatches=${JSON.stringify(typeMismatches)}`,
    );
  }
  return keysA.size;
}

function loadInVm(bundlePath) {
  const code = readFileSync(bundlePath, "utf8");
  // Deliberately bare: no `window`/`document`/`module`/`require` globals.
  // This is the pure browser-global delivery path — the UMD wrapper must
  // assign `root.SocialCalc` without needing a CJS host present.
  const sandbox = { console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: bundlePath });
  if (typeof sandbox.module !== "undefined") {
    throw new Error("vm sandbox unexpectedly exposed a `module` global — not a clean browser-global run");
  }
  if (!sandbox.SocialCalc || typeof sandbox.SocialCalc !== "object") {
    throw new Error(`${bundlePath} did not assign a SocialCalc global in the VM sandbox`);
  }
  return sandbox.SocialCalc;
}

function waitForStatus(sheet, match, trigger, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const previous = sheet.statuscallback;
    const matches = typeof match === "function" ? match : (status) => status === match;
    const timer = setTimeout(() => {
      sheet.statuscallback = previous;
      reject(new Error(`timed out waiting for status ${String(match)}`));
    }, timeoutMs);
    sheet.statuscallback = (...args) => {
      previous?.(...args);
      const status = args[1];
      if (matches(status)) {
        clearTimeout(timer);
        sheet.statuscallback = previous;
        resolve();
      }
    };
    try {
      trigger();
    } catch (error) {
      clearTimeout(timer);
      sheet.statuscallback = previous;
      reject(error);
    }
  });
}

async function exerciseCommandFormulaSaveLoad(SC, label) {
  const sheet = new SC.Sheet();
  await waitForStatus(sheet, "cmdend", () =>
    SC.ScheduleSheetCommands(sheet, "set A1 value n 2\nset A2 value n 3\nset A3 formula A1+A2", true),
  );
  if (SC.RecalcInfo) {
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
  }
  await waitForStatus(sheet, "calcfinished", () => SC.RecalcSheet(sheet));
  if (sheet.cells.A3?.datavalue !== 5) {
    throw new Error(`[${label}] expected A3 formula A1+A2 to evaluate to 5, got ${sheet.cells.A3?.datavalue}`);
  }

  const saved = SC.CreateSheetSave(sheet);
  if (typeof saved !== "string" || saved.length === 0) {
    throw new Error(`[${label}] CreateSheetSave produced no output`);
  }

  const reloaded = new SC.Sheet();
  SC.ParseSheetSave(saved, reloaded);
  if (reloaded.cells.A3?.datavalue !== 5) {
    throw new Error(`[${label}] round-tripped save/load lost A3's evaluated value`);
  }
  return `A3=5 saved ${saved.length} chars, round-trip OK`;
}

async function main() {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));

  // --- Manifest-level contract -------------------------------------------------
  record("package.json declares an explicit CommonJS module type", () => {
    if (pkg.type !== "commonjs") {
      throw new Error(`expected package.json "type" to be the literal string "commonjs", got ${JSON.stringify(pkg.type)}`);
    }
  });

  const workDir = mkdtempSync(path.join(tmpdir(), "socialcalc-package-contract-"));
  const tarballPath = path.join(workDir, "socialcalc-pack.tgz");
  const extractDir = path.join(workDir, "extracted");
  const packageDir = path.join(extractDir, "package");

  try {
    // --- Tarball-first: always pack fresh from source, never trust a stale dist/ ---
    record("vp pm pack produces a fresh tarball (runs prepack -> vp build --minify)", () => {
      const result = run("vp", ["pm", "pack", "--out", tarballPath], { cwd: repoRoot });
      if (result.status !== 0) {
        throw new Error(`vp pm pack failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
      }
      return tarballPath;
    });

    record("tarball contains exactly the package.json \"files\" allowlist", () => {
      mkdirSync(extractDir, { recursive: true });
      const extractResult = run("tar", ["-xzf", tarballPath, "-C", extractDir]);
      if (extractResult.status !== 0) {
        throw new Error(`tar extract failed: ${extractResult.stderr}`);
      }
      const listResult = run("tar", ["-tzf", tarballPath]);
      const actual = new Set(
        listResult.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((entry) => entry.replace(/^package\//, "")),
      );
      const expected = expandFilesField(pkg.files, repoRoot);
      const extra = [...actual].filter((f) => !expected.has(f));
      const missing = [...expected].filter((f) => !actual.has(f));
      if (extra.length || missing.length) {
        throw new Error(
          `tarball allowlist mismatch — unexpected=${JSON.stringify(extra)} missing=${JSON.stringify(missing)}`,
        );
      }
      return `${actual.size} members, all within "files"`;
    });

    const rootJsPath = path.join(packageDir, "dist", "SocialCalc.js");
    const minJsPath = path.join(packageDir, "dist", "SocialCalc.min.js");

    function sha256(filePath) {
      return createHash("sha256").update(readFileSync(filePath)).digest("hex");
    }

    record("packed artifacts are nonempty and the minified bundle is smaller (sha256 reported, not pinned)", () => {
      const sizes = {
        tarball: statSync(tarballPath).size,
        normal: statSync(rootJsPath).size,
        minified: statSync(minJsPath).size,
      };
      for (const [name, size] of Object.entries(sizes)) {
        if (!(size > 0)) throw new Error(`${name} artifact is empty (${size} bytes)`);
      }
      if (!(sizes.minified < sizes.normal)) {
        throw new Error(`expected minified bundle smaller than normal — normal=${sizes.normal} minified=${sizes.minified}`);
      }
      const hashes = {
        tarball: sha256(tarballPath),
        normal: sha256(rootJsPath),
        minified: sha256(minJsPath),
      };
      return (
        `tarball ${sizes.tarball}B sha256:${hashes.tarball} | ` +
        `normal ${sizes.normal}B sha256:${hashes.normal} | ` +
        `minified ${sizes.minified}B sha256:${hashes.minified}`
      );
    });

    // A real consumer resolves "socialcalc" (and its deep subpaths) through
    // node_modules by package specifier, not by requiring/importing dist/*.js
    // by absolute file path. Build that exact layout once and reuse it for
    // every package-specifier check below, plus the external tsc compile
    // further down.
    const consumerDir = path.join(workDir, "consumer");
    mkdirSync(path.join(consumerDir, "node_modules"), { recursive: true });
    cpSync(packageDir, path.join(consumerDir, "node_modules", "socialcalc"), { recursive: true });
    const requireFromConsumer = createRequire(path.join(consumerDir, "noop.cjs"));

    let cjsRoot, cjsMinDeep, esmDefaultShape, vmNormal, vmMinified;

    record('root require("socialcalc") resolves via node_modules (package specifier)', () => {
      cjsRoot = requireFromConsumer("socialcalc");
      if (typeof cjsRoot !== "object" || cjsRoot === null) throw new Error("require() did not return an object");
      return `${Object.keys(cjsRoot).length} top-level keys`;
    });

    record(
      'deep require("socialcalc/dist/SocialCalc.min.js") resolves via node_modules (preserved deep file)',
      () => {
        cjsMinDeep = requireFromConsumer("socialcalc/dist/SocialCalc.min.js");
        if (typeof cjsMinDeep !== "object" || cjsMinDeep === null) {
          throw new Error("deep require() did not return an object");
        }
        return `${Object.keys(cjsMinDeep).length} top-level keys`;
      },
    );

    record('native static ESM `import SocialCalc from "socialcalc"` resolves via node_modules (package specifier)', () => {
      writeFileSync(
        path.join(consumerDir, "esm-default-check.mjs"),
        [
          'import SocialCalc from "socialcalc";',
          "const shape = {};",
          "for (const key of Object.keys(SocialCalc)) shape[key] = typeof SocialCalc[key];",
          "console.log(JSON.stringify(shape));",
          "",
        ].join("\n"),
      );
      const result = run(process.execPath, ["esm-default-check.mjs"], { cwd: consumerDir });
      if (result.status !== 0) {
        throw new Error(
          `native ESM default import failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
        );
      }
      esmDefaultShape = JSON.parse(result.stdout.trim());
      return `${Object.keys(esmDefaultShape).length} top-level keys`;
    });

    record("normal bundle runs as a pure browser global (VM sandbox, no CJS host)", () => {
      vmNormal = loadInVm(rootJsPath);
      return `${Object.keys(vmNormal).length} top-level keys`;
    });

    record("minified bundle runs as a pure browser global (VM sandbox, no CJS host)", () => {
      vmMinified = loadInVm(minJsPath);
      return `${Object.keys(vmMinified).length} top-level keys`;
    });

    record("top-level key set + typeof parity across every delivery path", () => {
      const shapes = {
        "CJS root require (package specifier)": shapeOf(cjsRoot),
        "CJS deep min require (package specifier)": shapeOf(cjsMinDeep),
        "native ESM default import (package specifier)": esmDefaultShape,
        "VM browser-global (normal)": shapeOf(vmNormal),
        "VM browser-global (minified)": shapeOf(vmMinified),
      };
      const [firstName, firstShape] = Object.entries(shapes)[0];
      let keyCount = 0;
      for (const [name, shape] of Object.entries(shapes).slice(1)) {
        keyCount = assertSameShape(firstName, firstShape, name, shape);
      }
      return `${keyCount} keys, identical shape across ${Object.keys(shapes).length} delivery paths`;
    });

    await recordAsync("representative command/formula/save-load behavior (root CJS bundle, package specifier)", () =>
      exerciseCommandFormulaSaveLoad(cjsRoot, "CJS root"),
    );
    await recordAsync(
      "representative command/formula/save-load behavior (minified bundle, package specifier)",
      () => exerciseCommandFormulaSaveLoad(cjsMinDeep, "min deep"),
    );
    await recordAsync("representative command/formula/save-load behavior (VM browser-global, normal bundle)", () =>
      exerciseCommandFormulaSaveLoad(vmNormal, "VM normal"),
    );
    await recordAsync(
      "representative command/formula/save-load behavior (VM browser-global, minified bundle)",
      () => exerciseCommandFormulaSaveLoad(vmMinified, "VM minified"),
    );

    record("strict external TS compile against the packed .d.ts (skipLibCheck=false)", () => {
      writeFileSync(
        path.join(consumerDir, "consumer.ts"),
        [
          'import SocialCalc from "socialcalc";',
          "",
          "const sheet = new SocialCalc.Sheet();",
          'SocialCalc.ScheduleSheetCommands(sheet, "set A1 value n 1", true);',
          "const saved: string = SocialCalc.CreateSheetSave(sheet);",
          "SocialCalc.ParseSheetSave(saved, sheet);",
          "const cell: SocialCalc.Cell | undefined = sheet.cells.A1;",
          "const fn: typeof SocialCalc.RecalcSheet = SocialCalc.RecalcSheet;",
          "void cell;",
          "void fn;",
          "",
        ].join("\n"),
      );
      writeFileSync(
        path.join(consumerDir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "es2022",
              module: "node16",
              moduleResolution: "node16",
              strict: true,
              skipLibCheck: false,
              esModuleInterop: true,
              noEmit: true,
              types: [],
            },
            include: ["consumer.ts"],
          },
          null,
          2,
        ),
      );
      const result = run("vp", ["exec", "tsc", "-p", path.join(consumerDir, "tsconfig.json"), "--pretty", "false"], {
        cwd: repoRoot,
      });
      if (result.status !== 0) {
        throw new Error(`external tsc compile failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
      }
    });

  } finally {
    if (!process.env.SC_KEEP_PACKAGE_CONTRACT_TMP) {
      rmSync(workDir, { recursive: true, force: true });
    } else {
      console.log(`kept scratch dir: ${workDir}`);
    }
  }

  console.log("");
  console.log(`${checks.filter((c) => c.ok).length}/${checks.length} package-contract checks passed`);
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
});
