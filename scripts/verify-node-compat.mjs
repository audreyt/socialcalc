#!/usr/bin/env node
// Node.js runtime compatibility smoke test: proves the built SocialCalc
// package actually loads and works correctly under a REAL Node.js
// interpreter — not the Bun-based `vp` dev toolchain used to build/pack it
// — matching package.json's declared `engines.node` floor (">=22"). CJS
// root require, the deep minified require, and native ESM default import
// are each exercised with a real set-value/formula/recalc/save/load
// round-trip via scripts/lib/sheet-smoke.mjs, not just a typeof/key-
// presence check.
//
// Invoked only by .github/workflows/ci.yml's `node-compat` matrix job
// (Node 22 and 24 — the two versions this project actively CI-tests and
// maintains support for), against a scratch node_modules/socialcalc
// layout extracted from a freshly packed tarball. That job packs under
// the Bun-based `vp` toolchain first, then swaps the matrixed Node.js
// version onto PATH before invoking this script — so everything this
// script does runs under the real interpreter version under test, with
// no `vp`/Bun involvement.
//
// Usage: node scripts/verify-node-compat.mjs <consumer-dir>
//   <consumer-dir>  A directory containing node_modules/socialcalc/ (the
//                    extracted tarball's "package/" contents).

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exerciseCommandFormulaSaveLoad } from "./lib/sheet-smoke.mjs";

const consumerDir = process.argv[2];
if (!consumerDir) {
  console.error("usage: node scripts/verify-node-compat.mjs <consumer-dir>");
  process.exit(1);
}

const sheetSmokePath = fileURLToPath(new URL("./lib/sheet-smoke.mjs", import.meta.url));

async function main() {
  console.log(`Node.js runtime under test: ${process.version} (package.json engines.node requires >=22)`);

  const requireFromConsumer = createRequire(path.join(consumerDir, "noop.cjs"));

  console.log('Checking CJS root require("socialcalc") ...');
  const cjsRoot = requireFromConsumer("socialcalc");
  console.log(`  ok - ${await exerciseCommandFormulaSaveLoad(cjsRoot, `Node ${process.version} CJS root`)}`);

  console.log('Checking deep require("socialcalc/dist/SocialCalc.min.js") ...');
  const cjsMinDeep = requireFromConsumer("socialcalc/dist/SocialCalc.min.js");
  console.log(`  ok - ${await exerciseCommandFormulaSaveLoad(cjsMinDeep, `Node ${process.version} min deep`)}`);

  console.log("Checking native ESM default import ...");
  const esmCheckPath = path.join(consumerDir, "esm-check.mjs");
  writeFileSync(
    esmCheckPath,
    [
      'import SocialCalc from "socialcalc";',
      `import { exerciseCommandFormulaSaveLoad } from ${JSON.stringify(sheetSmokePath)};`,
      "",
      `const result = await exerciseCommandFormulaSaveLoad(SocialCalc, "Node ${process.version} ESM default");`,
      "console.log(result);",
      "",
    ].join("\n"),
  );
  const esmResult = spawnSync(process.execPath, [esmCheckPath], { cwd: consumerDir, encoding: "utf8" });
  if (esmResult.status !== 0) {
    throw new Error(
      `native ESM default import compat check failed (exit ${esmResult.status}):\n${esmResult.stdout}\n${esmResult.stderr}`,
    );
  }
  console.log(`  ok - ${esmResult.stdout.trim()}`);

  console.log(`PASS: socialcalc is installable and functionally correct under Node.js ${process.version}.`);
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exit(1);
});
