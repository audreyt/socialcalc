#!/usr/bin/env node
// Post-publish registry smoke test: proves the JUST-PUBLISHED npm package
// version is actually installable and functionally correct from the real
// npm registry (not the local pack-twice tarball already verified by
// scripts/verify-package-contract.mjs before publish) — CJS root require,
// the deep minified require, and native ESM default import, each
// exercising a real set-value/formula/recalc/save/load round-trip via
// scripts/lib/sheet-smoke.mjs, not just top-level key presence.
//
// Invoked only by the manual `publish` job's "Registry smoke" step, after
// `npm publish` has already succeeded and the caller has polled the
// registry until it reports the published version.
//
// Usage: node scripts/verify-registry-smoke.mjs <version>

import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exerciseCommandFormulaSaveLoad } from "./lib/sheet-smoke.mjs";

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/verify-registry-smoke.mjs <version>");
  process.exit(1);
}

const sheetSmokePath = fileURLToPath(new URL("./lib/sheet-smoke.mjs", import.meta.url));

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

async function main() {
  const scratchDir = mkdtempSync(path.join(tmpdir(), "socialcalc-registry-smoke-"));
  try {
    writeFileSync(
      path.join(scratchDir, "package.json"),
      JSON.stringify({ name: "registry-smoke", private: true, version: "0.0.0" }, null, 2),
    );

    console.log(
      `Installing socialcalc@${version} from the real npm registry into ${scratchDir} ...`,
    );
    const install = run(
      "npm",
      ["install", `socialcalc@${version}`, "--no-save", "--no-audit", "--no-fund"],
      { cwd: scratchDir },
    );
    if (install.status !== 0) {
      throw new Error(
        `npm install socialcalc@${version} from the registry failed (exit ${install.status}):\n${install.stdout}\n${install.stderr}`,
      );
    }

    const requireFromScratch = createRequire(path.join(scratchDir, "noop.cjs"));

    console.log('Checking CJS root require("socialcalc") ...');
    const cjsRoot = requireFromScratch("socialcalc");
    console.log(
      `  ok - ${await exerciseCommandFormulaSaveLoad(cjsRoot, `registry CJS root (${version})`)}`,
    );

    console.log('Checking deep require("socialcalc/dist/SocialCalc.min.js") ...');
    const cjsMinDeep = requireFromScratch("socialcalc/dist/SocialCalc.min.js");
    console.log(
      `  ok - ${await exerciseCommandFormulaSaveLoad(cjsMinDeep, `registry min deep (${version})`)}`,
    );

    console.log("Checking native ESM default import ...");
    const esmCheckPath = path.join(scratchDir, "esm-check.mjs");
    writeFileSync(
      esmCheckPath,
      [
        'import SocialCalc from "socialcalc";',
        `import { exerciseCommandFormulaSaveLoad } from ${JSON.stringify(sheetSmokePath)};`,
        "",
        `const result = await exerciseCommandFormulaSaveLoad(SocialCalc, "registry ESM default (${version})");`,
        "console.log(result);",
        "",
      ].join("\n"),
    );
    const esmResult = run(process.execPath, [esmCheckPath], { cwd: scratchDir });
    if (esmResult.status !== 0) {
      throw new Error(
        `native ESM default import registry smoke failed (exit ${esmResult.status}):\n${esmResult.stdout}\n${esmResult.stderr}`,
      );
    }
    console.log(`  ok - ${esmResult.stdout.trim()}`);

    console.log(
      `PASS: socialcalc@${version} is installable from the real npm registry and functionally correct (CJS root, minified deep require, native ESM default import).`,
    );
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exit(1);
});
