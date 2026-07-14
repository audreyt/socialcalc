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
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { exerciseCommandFormulaSaveLoad } from "./lib/sheet-smoke.mjs";

// --- Pinned package contract ---------------------------------------------
// Both lists are literal, hand-maintained pins — NOT derived from
// package.json's own "files" field or the tarball's own member list at
// run time. package.json metadata is an intentional, curated contract
// (unlike e.g. a bundle's runtime top-level key count, deliberately NOT
// pinned below): deriving "expected" from the very value under test would
// let an unreviewed addition to "files" bless itself. Update both,
// deliberately, whenever "files" or the shipped file set changes.
const EXPECTED_FILES_FIELD = [
  "dist/SocialCalc.js",
  "dist/SocialCalc.min.js",
  "dist/SocialCalc.d.ts",
  "dist/socialcalc.css",
  "js/*.d.ts",
  "css/socialcalc.css",
  "LICENSE.txt",
  "LEGAL.txt",
  "README.md",
];

const EXPECTED_TARBALL_MEMBERS = [
  "package.json",
  "README.md",
  "LICENSE.txt",
  "LEGAL.txt",
  "css/socialcalc.css",
  "dist/SocialCalc.js",
  "dist/SocialCalc.min.js",
  "dist/SocialCalc.d.ts",
  "dist/socialcalc.css",
  "js/formatnumber2.d.ts",
  "js/formula1.d.ts",
  "js/socialcalc-3.d.ts",
  "js/socialcalcconstants.d.ts",
  "js/socialcalcpopup.d.ts",
  "js/socialcalcspreadsheetcontrol.d.ts",
  "js/socialcalctableeditor.d.ts",
  "js/socialcalcviewer.d.ts",
];
// Component size ceilings are explicit package-contract values, not snapshots.
// Baselines measured 2026-07-14 after canonical formatting: normal 827,394
// raw / 138,391 gzip; minified 411,911 raw / 101,624 gzip; CSS 2,688 raw /
// 958 gzip; combined package members 1,407,601 raw; tarball 280,857. The
// normal raw ceiling was raised only for Oxfmt's deterministic whitespace;
// executable shape and minified size remain independently pinned. Combined
// release-package ceilings remain unchanged.
const MAX_NORMAL_RAW_BYTES = 850_000;
const MAX_MINIFIED_RAW_BYTES = 450_000;
const MAX_CSS_RAW_BYTES = 6_000;
const MAX_NORMAL_GZIP_BYTES = 152_000;
const MAX_MINIFIED_GZIP_BYTES = 117_000;
const MAX_CSS_GZIP_BYTES = 1_100;
const MAX_PACKAGE_RAW_BYTES = 1_600_000;
const MAX_PACKAGE_GZIP_BYTES = 300_000;

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
    throw new Error(
      "vm sandbox unexpectedly exposed a `module` global — not a clean browser-global run",
    );
  }
  if (!sandbox.SocialCalc || typeof sandbox.SocialCalc !== "object") {
    throw new Error(`${bundlePath} did not assign a SocialCalc global in the VM sandbox`);
  }
  return sandbox.SocialCalc;
}

async function main() {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));

  // --- Manifest-level contract -------------------------------------------------
  record("package.json declares an explicit CommonJS module type", () => {
    if (pkg.type !== "commonjs") {
      throw new Error(
        `expected package.json "type" to be the literal string "commonjs", got ${JSON.stringify(pkg.type)}`,
      );
    }
  });

  record(
    "package.json declares an explicit engines.node floor (resolves publint's missing-engines finding)",
    () => {
      if (pkg.engines?.node !== ">=22") {
        throw new Error(
          `expected package.json "engines.node" to be the literal string ">=22" (the maintained, CI-tested support policy — see the CI node-compat matrix job and README's Node compatibility note), got ${JSON.stringify(pkg.engines?.node)}`,
        );
      }
    },
  );

  record(
    'package.json "files" field matches the pinned intended manifest (no unreviewed drift)',
    () => {
      const actual = pkg.files;
      const expected = EXPECTED_FILES_FIELD;
      const extra = actual.filter((f) => !expected.includes(f));
      const missing = expected.filter((f) => !actual.includes(f));
      if (extra.length || missing.length) {
        throw new Error(
          `package.json "files" drifted from the pinned manifest — unexpected=${JSON.stringify(extra)} missing=${JSON.stringify(missing)}`,
        );
      }
    },
  );

  const workDir = mkdtempSync(path.join(tmpdir(), "socialcalc-package-contract-"));
  const tarballPath = path.join(workDir, "socialcalc-pack.tgz");
  const extractDir = path.join(workDir, "extracted");
  const packageDir = path.join(extractDir, "package");

  try {
    // --- Tarball-first: always pack fresh from source, never trust a stale dist/ ---
    record("vp pm pack produces a fresh tarball (runs prepack -> vp build --minify)", () => {
      const result = run("vp", ["pm", "pack", "--out", tarballPath], { cwd: repoRoot });
      if (result.status !== 0) {
        throw new Error(
          `vp pm pack failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
        );
      }
      return tarballPath;
    });

    record(
      "tarball contains exactly the pinned 17-member contract (no extra or missing member)",
      () => {
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
        const expected = new Set(EXPECTED_TARBALL_MEMBERS);
        const extra = [...actual].filter((f) => !expected.has(f));
        const missing = [...expected].filter((f) => !actual.has(f));
        if (extra.length || missing.length) {
          throw new Error(
            `tarball member set drifted from the pinned contract — unexpected=${JSON.stringify(extra)} missing=${JSON.stringify(missing)}`,
          );
        }
        // Cross-check: the dynamic glob expansion of the (already pinned-
        // verified) package.json "files" patterns against the real repo file
        // listing must independently agree with the same pinned set — proving
        // the patterns and the static pin are not coincidentally stale in the
        // same way at once.
        const dynamicallyExpanded = expandFilesField(pkg.files, repoRoot);
        const dynExtra = [...dynamicallyExpanded].filter((f) => !expected.has(f));
        const dynMissing = [...expected].filter((f) => !dynamicallyExpanded.has(f));
        if (dynExtra.length || dynMissing.length) {
          throw new Error(
            `"files" glob expansion disagrees with the pinned tarball contract — unexpected=${JSON.stringify(dynExtra)} missing=${JSON.stringify(dynMissing)}`,
          );
        }
        return `${actual.size} members, exactly the pinned contract`;
      },
    );

    const rootJsPath = path.join(packageDir, "dist", "SocialCalc.js");
    const minJsPath = path.join(packageDir, "dist", "SocialCalc.min.js");
    const cssPath = path.join(packageDir, "dist", "socialcalc.css");
    function sha256(filePath) {
      return createHash("sha256").update(readFileSync(filePath)).digest("hex");
    }

    record(
      "packed artifacts are nonempty and stay within explicit raw/gzip size budgets (sha256 reported, not pinned)",
      () => {
        const sizes = {
          tarball: statSync(tarballPath).size,
          rawPackage: EXPECTED_TARBALL_MEMBERS.reduce(
            (total, member) => total + statSync(path.join(packageDir, member)).size,
            0,
          ),
          normalRaw: statSync(rootJsPath).size,
          minifiedRaw: statSync(minJsPath).size,
          cssRaw: statSync(cssPath).size,
          normalGzip: gzipSync(readFileSync(rootJsPath)).length,
          minifiedGzip: gzipSync(readFileSync(minJsPath)).length,
          cssGzip: gzipSync(readFileSync(cssPath)).length,
        };
        for (const [name, size] of Object.entries(sizes)) {
          if (!(size > 0)) throw new Error(`${name} artifact is empty (${size} bytes)`);
        }
        const ceilings = {
          normalRaw: MAX_NORMAL_RAW_BYTES,
          minifiedRaw: MAX_MINIFIED_RAW_BYTES,
          cssRaw: MAX_CSS_RAW_BYTES,
          normalGzip: MAX_NORMAL_GZIP_BYTES,
          minifiedGzip: MAX_MINIFIED_GZIP_BYTES,
        };
        for (const [name, ceiling] of Object.entries(ceilings)) {
          if (sizes[name] > ceiling) {
            throw new Error(`${name} size ${sizes[name]}B exceeds the ${ceiling}B budget`);
          }
        }
        if (sizes.cssGzip > MAX_CSS_GZIP_BYTES) {
          throw new Error(
            `cssGzip size ${sizes.cssGzip}B exceeds the ${MAX_CSS_GZIP_BYTES}B budget`,
          );
        }
        if (sizes.rawPackage > MAX_PACKAGE_RAW_BYTES) {
          throw new Error(
            `raw package size ${sizes.rawPackage}B exceeds the ${MAX_PACKAGE_RAW_BYTES}B budget`,
          );
        }
        if (sizes.tarball > MAX_PACKAGE_GZIP_BYTES) {
          throw new Error(
            `packed tarball size ${sizes.tarball}B exceeds the ${MAX_PACKAGE_GZIP_BYTES}B budget`,
          );
        }
        if (!(sizes.minifiedRaw < sizes.normalRaw)) {
          throw new Error(
            `expected minified bundle smaller than normal — normal=${sizes.normalRaw} minified=${sizes.minifiedRaw}`,
          );
        }
        const hashes = {
          tarball: sha256(tarballPath),
          normal: sha256(rootJsPath),
          minified: sha256(minJsPath),
          css: sha256(cssPath),
        };
        return (
          `normal raw ${sizes.normalRaw}B gzip ${sizes.normalGzip}B | ` +
          `minified raw ${sizes.minifiedRaw}B gzip ${sizes.minifiedGzip}B | ` +
          `css raw ${sizes.cssRaw}B gzip ${sizes.cssGzip}B | ` +
          `raw package ${sizes.rawPackage}B | ` +
          `tarball raw ${sizes.tarball}B gzip ${sizes.tarball}B (already gzip; not recompressed) | ` +
          `sha256 tarball:${hashes.tarball} normal:${hashes.normal} ` +
          `minified:${hashes.minified} css:${hashes.css}`
        );
      },
    );

    // A real consumer resolves "socialcalc" (and its deep subpaths) through
    // node_modules by package specifier, not by requiring/importing dist/*.js
    // by absolute file path — and gets there via a real `npm install` of the
    // tarball, which applies npm's own extraction/normalization, not a
    // hand-rolled directory copy that would silently skip whatever a real
    // install does differently. This is an intentional, documented
    // exception to "no bare npm/bun outside vp": exercising the actual `npm
    // install <tarball>` behavior a consumer gets is exactly what this
    // check is for, and `vp`/bun cannot perform an npm-specific install.
    // `--offline`: socialcalc ships zero runtime "dependencies", so this
    // never needs the registry regardless, but the flag makes that a hard
    // guarantee rather than an accident of the current dependency graph.
    // `--ignore-scripts`/`--no-package-lock`: deterministic, no lifecycle
    // side effects, no lockfile churn for a throwaway scratch project.
    const consumerDir = path.join(workDir, "consumer");
    mkdirSync(consumerDir, { recursive: true });
    writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify(
        { name: "package-contract-consumer", private: true, version: "0.0.0" },
        null,
        2,
      ),
    );

    record(
      "npm install <tarball> into an empty consumer project (real install, not a directory copy)",
      () => {
        const result = run(
          "npm",
          ["install", "--ignore-scripts", "--no-package-lock", "--offline", tarballPath],
          { cwd: consumerDir },
        );
        if (result.status !== 0) {
          throw new Error(
            `npm install of the packed tarball failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
          );
        }
        return path.join(consumerDir, "node_modules", "socialcalc");
      },
    );

    const installedDir = path.join(consumerDir, "node_modules", "socialcalc");
    const installedRootJsPath = path.join(installedDir, "dist", "SocialCalc.js");
    const installedMinJsPath = path.join(installedDir, "dist", "SocialCalc.min.js");

    record(
      "npm-installed package bytes are byte-identical to the extracted tarball members",
      () => {
        const mismatches = [];
        for (const member of EXPECTED_TARBALL_MEMBERS) {
          const extractedHash = sha256(path.join(packageDir, member));
          const installedHash = sha256(path.join(installedDir, member));
          if (extractedHash !== installedHash) {
            mismatches.push(`${member}: extracted=${extractedHash} installed=${installedHash}`);
          }
        }
        if (mismatches.length) {
          throw new Error(
            `npm install altered file bytes vs the raw tar extraction — ${mismatches.join("; ")}`,
          );
        }
        return `${EXPECTED_TARBALL_MEMBERS.length} files byte-identical`;
      },
    );

    const requireFromConsumer = createRequire(path.join(consumerDir, "noop.cjs"));

    let cjsRoot, cjsMinDeep, esmDefaultShape, vmNormal, vmMinified;

    record('root require("socialcalc") resolves via node_modules (package specifier)', () => {
      cjsRoot = requireFromConsumer("socialcalc");
      if (typeof cjsRoot !== "object" || cjsRoot === null)
        throw new Error("require() did not return an object");
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

    record(
      'native static ESM `import SocialCalc from "socialcalc"` resolves via node_modules (package specifier)',
      () => {
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
      },
    );

    record("normal bundle runs as a pure browser global (VM sandbox, no CJS host)", () => {
      vmNormal = loadInVm(installedRootJsPath);
      return `${Object.keys(vmNormal).length} top-level keys`;
    });

    record("minified bundle runs as a pure browser global (VM sandbox, no CJS host)", () => {
      vmMinified = loadInVm(installedMinJsPath);
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

    await recordAsync(
      "representative command/formula/save-load behavior (root CJS bundle, package specifier)",
      () => exerciseCommandFormulaSaveLoad(cjsRoot, "CJS root"),
    );
    await recordAsync(
      "representative command/formula/save-load behavior (minified bundle, package specifier)",
      () => exerciseCommandFormulaSaveLoad(cjsMinDeep, "min deep"),
    );
    await recordAsync(
      "representative command/formula/save-load behavior (VM browser-global, normal bundle)",
      () => exerciseCommandFormulaSaveLoad(vmNormal, "VM normal"),
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
      const result = run(
        "vp",
        ["exec", "tsc", "-p", path.join(consumerDir, "tsconfig.json"), "--pretty", "false"],
        {
          cwd: repoRoot,
        },
      );
      if (result.status !== 0) {
        throw new Error(
          `external tsc compile failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
        );
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
  console.log(
    `${checks.filter((c) => c.ok).length}/${checks.length} package-contract checks passed`,
  );
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
});
