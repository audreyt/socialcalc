#!/usr/bin/env node
// Manifest-driven LemmaScript facade tooling. `LemmaScript-files.txt` is the
// single source of truth for which `lemma/*.ts` facades exist; this script
// reads it once and drives every per-facade step that lsc's own CLI cannot
// already batch, instead of a hand-maintained `&&`-chain in package.json (one
// clause per facade) or a hand-maintained `test -s` list in a workflow file.
//
// lsc's own CLI already batches `gen`/`gen-check`/`check` over
// LemmaScript-files.txt when no file argument is given (see
// node_modules/lemmascript/tools/dist/lsc.js `runBatch`), so
// `verify:dafny` / `verify:dafny:gen` stay as bare `lsc check|gen
// --backend=dafny` and are intentionally NOT routed through this script.
// `regen` has no batch mode in lsc (`runBatch` explicitly rejects it: "batch
// mode supports gen|gen-check|check (not regen)"), and lsc has no built-in
// non-empty-artifact assertion at all — those two gaps are what this script
// closes, plus giving `lean-gen` one manifest reader shared with `regen` and
// `assert-lean` instead of three independently hand-maintained call sites.
//
// Subcommands:
//   regen        lsc regen --backend=dafny <file>   for every manifest entry
//   lean-gen     lsc gen --backend=lean <file>       for every manifest entry
//   assert-lean  assert <file-base>.types.lean, .def.lean, .proof.lean are
//                each present and non-empty, for every manifest entry
//
// Usage: node scripts/lemmascript-manifest.mjs <regen|lean-gen|assert-lean>
//
// Safety: every manifest entry is validated against a strict allowlist
// (`lemma/<name>.ts`, no nested directories, no `..`, no absolute paths, no
// shell metacharacters) before it is used to build a filesystem path or a
// subprocess argv. Subprocesses are always invoked via `execFileSync` with an
// argv array — manifest content is never interpolated into a shell string, so
// shell injection is structurally impossible regardless of validation; the
// allowlist exists to fail loud on a malformed manifest rather than silently
// operate on (or skip) the wrong file.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const manifestPath = path.join(repoRoot, "LemmaScript-files.txt");

// `lemma/<name>.ts` only: single path segment under lemma/, word chars plus
// `-`/`_`, no `..`, no leading `/`, no nested subdirectories. Anything else is
// rejected rather than coerced or skipped.
const MANIFEST_PATH_RE = /^lemma\/[A-Za-z0-9_-]+\.ts$/;

/**
 * Parse LemmaScript-files.txt content into an ordered list of validated,
 * repo-relative facade paths (e.g. "lemma/a1.ts"). Blank lines are skipped.
 * Only the first whitespace-separated token on each line is the path; this
 * mirrors lsc's own `readEntries` batcher (node_modules/lemmascript/tools/
 * dist/lsc.js), which parses `file [timeout] [extra flags...]` per line for
 * its `check`-mode >60s-timeout handling. LemmaScript-files.txt is a shared
 * manifest — a future slow-facade entry like `lemma/foo.ts 120` must keep
 * `verify:dafny` (lsc's own batcher) AND this script's regen/lean-gen/
 * assert-lean green, so trailing fields are ignored here rather than
 * rejected. Only the path token itself is validated.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function parseManifestEntries(text) {
  const files = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [firstToken] = line.split(/\s+/);
    files.push(validateManifestPath(firstToken, i + 1));
  }
  return files;
}

/**
 * Validate one manifest entry against the `lemma/<name>.ts` allowlist and
 * confirm the resolved path stays inside `lemma/` (defense in depth on top of
 * the allowlist, which already forbids `..` and absolute paths). Throws with
 * the offending line number on any violation.
 *
 * @param {string} rawFile
 * @param {number} lineNo
 * @returns {string}
 */
export function validateManifestPath(rawFile, lineNo) {
  if (!MANIFEST_PATH_RE.test(rawFile)) {
    throw new Error(
      `LemmaScript-files.txt:${lineNo}: rejected path "${rawFile}" — must match ` +
        `${MANIFEST_PATH_RE} (lemma/<name>.ts: no nested directories, no "..", ` +
        `no absolute paths, no extra fields)`,
    );
  }
  const lemmaDir = path.resolve(repoRoot, "lemma");
  const resolved = path.resolve(repoRoot, rawFile);
  const rel = path.relative(lemmaDir, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`LemmaScript-files.txt:${lineNo}: path escapes lemma/: "${rawFile}"`);
  }
  return rawFile;
}

/**
 * Read and parse LemmaScript-files.txt from the repo root. Throws a clear
 * error (never returns an empty/undefined result) when the manifest itself
 * is missing.
 *
 * @returns {string[]}
 */
export function readManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`LemmaScript-files.txt not found at ${manifestPath}`);
  }
  return parseManifestEntries(readFileSync(manifestPath, "utf8"));
}

/**
 * The three generated Lean artifact paths lsc emits for one facade:
 * `<dir>/<base>.types.lean`, `<dir>/<base>.def.lean`, `<dir>/<base>.proof.lean`.
 * `.proof.lean` is always hand-written (never regenerated by lsc), but every
 * shipped facade has one, so it is asserted alongside the two generated files.
 *
 * @param {string} file repo-relative "lemma/<name>.ts"
 * @returns {string[]} repo-relative paths
 */
export function leanArtifactsFor(file) {
  const dir = path.dirname(file);
  const base = path.basename(file, ".ts");
  return [`${dir}/${base}.types.lean`, `${dir}/${base}.def.lean`, `${dir}/${base}.proof.lean`];
}

/**
 * Assert a repo-relative file exists and is non-empty (mirrors shell `test -s`).
 * Throws with the exact repo-relative path on failure — never silently skips.
 *
 * @param {string} relPath
 */
export function assertNonEmpty(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!existsSync(abs)) {
    throw new Error(`missing artifact: ${relPath}`);
  }
  if (statSync(abs).size === 0) {
    throw new Error(`empty artifact: ${relPath}`);
  }
}

function runLsc(args) {
  execFileSync("lsc", args, { cwd: repoRoot, stdio: "inherit" });
}

function regen() {
  for (const file of readManifest()) {
    console.log(`=== lsc regen --backend=dafny ${file} ===`);
    runLsc(["regen", "--backend=dafny", file]);
  }
}

function leanGen() {
  for (const file of readManifest()) {
    console.log(`=== lsc gen --backend=lean ${file} ===`);
    runLsc(["gen", "--backend=lean", file]);
  }
}

function assertLean() {
  const files = readManifest();
  const artifacts = files.flatMap(leanArtifactsFor);
  for (const artifact of artifacts) {
    assertNonEmpty(artifact);
  }
  console.log(
    `assert-lean: ${artifacts.length} artifact(s) present and non-empty across ` +
      `${files.length} facade(s) (${files.join(", ")})`,
  );
}

const COMMANDS = { regen, "lean-gen": leanGen, "assert-lean": assertLean };

function main() {
  const [cmd] = process.argv.slice(2);
  const fn = cmd ? COMMANDS[cmd] : undefined;
  if (!fn) {
    console.error(
      `Usage: node scripts/lemmascript-manifest.mjs <${Object.keys(COMMANDS).join("|")}>`,
    );
    process.exit(1);
  }
  fn();
}

// Only run as a CLI entrypoint; test/lemmascript-manifest.test.ts imports the
// exported functions directly without triggering process.exit().
if (import.meta.url === `file://${process.argv[1]}`) main();
