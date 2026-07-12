// Loads the pinned, checked-in socialcalc@3.0.8 oracle bundle
// (test/fixtures/oracle-3.0.8/SocialCalc.js) into its own isolated vm
// context, entirely separate from the candidate bundle's realm
// (test/helpers/socialcalc.ts runs the candidate via `runInThisContext()`
// against the real globalThis). Isolation matters because both bundles are
// UMD scripts that assign `globalThis.SocialCalc = ...`; loading them into
// the same realm would make the second load stomp the first.
//
// No network access happens here or anywhere else in this file: the bundle
// bytes are read from disk. Regenerating the fixture is a manual, explicit
// step — see scripts/fetch-oracle-fixture.mjs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";

import type { SocialCalcRuntime } from "./socialcalc-runtime-types";

export const ORACLE_VERSION = "3.0.8";

const oracleBundlePath = fileURLToPath(
  new URL("../fixtures/oracle-3.0.8/SocialCalc.bundle.txt", import.meta.url),
);
const oracleSource = readFileSync(oracleBundlePath, "utf8");
const oracleScript = new Script(oracleSource, { filename: oracleBundlePath });

let oracleInstance: SocialCalcRuntime | undefined;

function isSocialCalcRuntime(value: unknown): value is SocialCalcRuntime {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.Sheet === "function" &&
    typeof record.ParseSheetSave === "function" &&
    typeof record.ScheduleSheetCommands === "function"
  );
}

/**
 * Compiles+runs the pinned 3.0.8 bundle in a brand-new, isolated vm
 * context every call — no caching. Reserved for callers (see
 * test/differential/known-intended-differences.test.ts) that deliberately
 * exercise a code path known to read an undeclared variable and rely on
 * that specific call throwing: reusing the shared per-worker singleton
 * across repeated crash probes is unsafe under `NODE_V8_COVERAGE`/V8
 * precise-coverage instrumentation, which was empirically confirmed (via a
 * standalone Node repro, independent of Vitest) to make a *second* read of
 * the same still-undeclared identifier in the same vm sandbox silently
 * resolve instead of throwing — a V8-coverage/vm-context interaction, not
 * a change in the oracle's own source. A fresh sandbox per probe sidesteps
 * it entirely and is also the more correct test anyway: each probe should
 * prove a *virgin* oracle instance crashes on its specific malformed
 * input, not depend on what a previous probe in the same file already ran.
 */
export function createOracleSocialCalc(): SocialCalcRuntime {
  const sandbox: Record<string, unknown> = {
    clearInterval,
    clearTimeout,
    console,
    setInterval,
    setTimeout,
  };
  createContext(sandbox);
  oracleScript.runInContext(sandbox);

  const exported = sandbox.SocialCalc;
  if (!isSocialCalcRuntime(exported)) {
    throw new Error(
      `oracle SocialCalc@${ORACLE_VERSION} bundle did not initialize its global export`,
    );
  }
  return exported;
}

/**
 * Returns the singleton oracle SocialCalc instance for this Vitest worker,
 * compiling+running the pinned 3.0.8 bundle in an isolated vm context on
 * first use. Mirrors loadSocialCalc()'s per-worker singleton shape so the
 * two instances can be held side by side without re-running either bundle.
 * Safe for parity comparisons (the overwhelming majority of differential
 * tests), which never depend on the oracle's undeclared-variable-crash
 * behavior surviving more than one call — see createOracleSocialCalc()
 * above for the one case that does.
 */
export function loadOracleSocialCalc(): SocialCalcRuntime {
  if (oracleInstance) {
    return oracleInstance;
  }
  oracleInstance = createOracleSocialCalc();
  return oracleInstance;
}
