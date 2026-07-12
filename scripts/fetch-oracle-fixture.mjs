#!/usr/bin/env node
// Regenerates the checked-in socialcalc@3.0.8 oracle fixture used by
// test/differential/**/*.test.ts from the published npm package.
//
// This script is NEVER invoked by `vp test` / `bun test` / CI. It exists so a
// human (or an explicit maintenance task) can re-pin the oracle deliberately,
// with an explicit review of the resulting diff. Normal test runs read only
// the checked-in files under test/fixtures/oracle-3.0.8/ and never touch the
// network.
//
// Usage: node scripts/fetch-oracle-fixture.mjs [version]
//   version defaults to "3.0.8" (the version documented in
//   test/fixtures/oracle-3.0.8/MANIFEST.json and test/differential/*).
//   Fetching any other version is for local investigation only — do not
//   commit the result under the 3.0.8 fixture directory.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2] ?? "3.0.8";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const fixtureDir = path.join(repoRoot, "test/fixtures", `oracle-${version}`);

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const metaRes = await fetch(`https://registry.npmjs.org/socialcalc/${version}`);
  if (!metaRes.ok) {
    throw new Error(`registry metadata fetch failed: ${metaRes.status} ${metaRes.statusText}`);
  }
  const meta = await metaRes.json();
  const tarballUrl = meta.dist.tarball;
  const expectedShasum = meta.dist.shasum;

  const tgzRes = await fetch(tarballUrl);
  if (!tgzRes.ok) {
    throw new Error(`tarball fetch failed: ${tgzRes.status} ${tgzRes.statusText}`);
  }
  const tgzBuf = Buffer.from(await tgzRes.arrayBuffer());
  const actualShasum = createHash("sha1").update(tgzBuf).digest("hex");
  if (actualShasum !== expectedShasum) {
    throw new Error(
      `tarball shasum mismatch: registry says ${expectedShasum}, downloaded bytes hash to ${actualShasum}`,
    );
  }

  const workDir = mkdtempSync(path.join(tmpdir(), "socialcalc-oracle-"));
  try {
    const tgzPath = path.join(workDir, "package.tgz");
    writeFileSync(tgzPath, tgzBuf);
    execFileSync("tar", ["xzf", tgzPath, "-C", workDir]);

    const bundleSrc = path.join(workDir, "package/dist/SocialCalc.js");
    const bundle = readFileSync(bundleSrc);

    mkdirSync(fixtureDir, { recursive: true });
    // Stored as .txt on purpose — vendored third-party code, not project
    // source; a .js extension would pull it into vp lint's/tsc's file
    // globs. See MANIFEST.json's $comment.
    writeFileSync(path.join(fixtureDir, "SocialCalc.bundle.txt"), bundle);

    const manifest = {
      $comment:
        "Immutable provenance record for the checked-in socialcalc oracle bundle. Regenerate only via scripts/fetch-oracle-fixture.mjs; never hand-edit SocialCalc.bundle.txt. Stored as .txt (not .js): it's vendored third-party code, not project source, and a .js extension pulls it into vp lint's/tsc's file globs.",
      package: "socialcalc",
      version,
      source: tarballUrl,
      npmGitHead: meta.gitHead ?? null,
      fetchedAt: new Date().toISOString().slice(0, 10),
      tarball: {
        shasum: expectedShasum,
        integrity: meta.dist.integrity ?? null,
      },
      files: {
        "SocialCalc.bundle.txt": {
          originalName: "dist/SocialCalc.js",
          bytes: bundle.length,
          sha256: sha256(bundle),
        },
      },
    };
    writeFileSync(path.join(fixtureDir, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`Wrote ${fixtureDir}`);
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
