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
 * Returns the singleton oracle SocialCalc instance for this Vitest worker,
 * compiling+running the pinned 3.0.8 bundle in an isolated vm context on
 * first use. Mirrors loadSocialCalc()'s per-worker singleton shape so the
 * two instances can be held side by side without re-running either bundle.
 */
export function loadOracleSocialCalc(): SocialCalcRuntime {
  if (oracleInstance) {
    return oracleInstance;
  }

  // Minimal headless host surface — the same subset the candidate bundle
  // runs against in non-browser mode (see loadSocialCalc({ browser: false })
  // in test/helpers/socialcalc.ts, which every headless test already relies
  // on). No document/window: only Sheet/Formula/command-level behavior is
  // exercised through this loader.
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
  oracleInstance = exported;
  return oracleInstance;
}
