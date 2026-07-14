// Fixture-driven coverage for scripts/mutate-release-gate.mjs's evidence
// validation: synthetic scenarios build isolated Stryker-shaped reports and
// assert on returned behavior, never script source text. One contract test
// reads the real baseline registry so a schema change cannot make every release
// entry invalid; generated reports remain out of scope and are never required.
// ALL_MUTATE_FILES is imported for real, so "all 11 shipping modules" always
// means the current shipping set.

import { describe, expect, test } from "vite-plus/test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkBaselineRegistry,
  evaluateAllModules,
  evaluateFileReport,
  normalizeReportFileKey,
  reportPathFor,
  validMeasuredBaseline,
} from "../scripts/mutate-release-gate.mjs";
import { ALL_MUTATE_FILES } from "../stryker-file.mjs";

interface BaselineEntry {
  measured: boolean;
  minimumMutants: number;
  break: number;
  score: string;
}

const baselineRegistry = JSON.parse(
  readFileSync(new URL("../stryker-mutation-baseline.json", import.meta.url), "utf8"),
) as { modules: Record<string, BaselineEntry> };

interface Mutant {
  id: string;
  mutatorName: string;
  status: string;
  location: { start: { line: number; column: number }; end: { line: number; column: number } };
  replacement: string;
}

function mutant(overrides: Partial<Mutant> = {}): Mutant {
  return {
    id: "1",
    mutatorName: "EqualityOperator",
    status: "Killed",
    location: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
    replacement: "true",
    ...overrides,
  };
}

function reportFor(fileEntries: Record<string, Mutant[]>) {
  const files: Record<string, { language: string; mutants: Mutant[] }> = {};
  for (const [file, mutants] of Object.entries(fileEntries)) {
    files[file] = { language: "typescript", mutants };
  }
  return { schemaVersion: "2.0", thresholds: { high: 90, low: 70 }, files };
}

function killedReport(file: string, count: number) {
  return reportFor({ [file]: Array.from({ length: count }, (_, i) => mutant({ id: String(i) })) });
}

describe("validMeasuredBaseline", () => {
  test("accepts measured:true with a finite in-range break and measured mutant count", () => {
    expect(validMeasuredBaseline({ measured: true, break: 90, minimumMutants: 1 })).toBe(true);
    expect(validMeasuredBaseline({ measured: true, break: 0, minimumMutants: 2 })).toBe(true);
    expect(validMeasuredBaseline({ measured: true, break: 100, minimumMutants: 3 })).toBe(true);
  });

  test("rejects measured:false", () => {
    expect(validMeasuredBaseline({ measured: false, break: 90, minimumMutants: 1 })).toBe(false);
  });

  test("rejects a missing entry entirely", () => {
    expect(validMeasuredBaseline(undefined)).toBe(false);
  });

  test("rejects a non-numeric break", () => {
    expect(validMeasuredBaseline({ measured: true, break: "90", minimumMutants: 1 })).toBe(false);
  });

  test("rejects a non-finite break (NaN/Infinity)", () => {
    expect(validMeasuredBaseline({ measured: true, break: Number.NaN, minimumMutants: 1 })).toBe(
      false,
    );
    expect(
      validMeasuredBaseline({
        measured: true,
        break: Number.POSITIVE_INFINITY,
        minimumMutants: 1,
      }),
    ).toBe(false);
  });

  test("rejects a break outside 0..100", () => {
    expect(validMeasuredBaseline({ measured: true, break: -1, minimumMutants: 1 })).toBe(false);
    expect(validMeasuredBaseline({ measured: true, break: 101, minimumMutants: 1 })).toBe(false);
  });

  test("rejects a missing, zero, negative, or non-integer mutant count", () => {
    expect(validMeasuredBaseline({ measured: true, break: 90 })).toBe(false);
    expect(validMeasuredBaseline({ measured: true, break: 90, minimumMutants: 0 })).toBe(false);
    expect(validMeasuredBaseline({ measured: true, break: 90, minimumMutants: -1 })).toBe(false);
    expect(validMeasuredBaseline({ measured: true, break: 90, minimumMutants: 1.5 })).toBe(false);
  });
});

describe("repository mutation baseline", () => {
  test("tracks every shipping module with a release-eligible measured entry", () => {
    const { missingFromRegistry, staleInRegistry } = checkBaselineRegistry(
      ALL_MUTATE_FILES,
      baselineRegistry.modules,
    );
    expect(missingFromRegistry).toEqual([]);
    expect(staleInRegistry).toEqual([]);

    for (const file of ALL_MUTATE_FILES) {
      const entry = baselineRegistry.modules[file];
      expect(validMeasuredBaseline(entry)).toBe(true);
      const score = Number(entry.score);
      expect(Number.isFinite(score)).toBe(true);
      expect(entry.break).toBe(Math.floor(score));
    }
  });
});

describe("normalizeReportFileKey", () => {
  test("leaves a bare relative js/ path unchanged", () => {
    expect(normalizeReportFileKey("js/formula-parse.ts")).toBe("js/formula-parse.ts");
  });

  test("strips a leading ./ prefix", () => {
    expect(normalizeReportFileKey("./js/formula-parse.ts")).toBe("js/formula-parse.ts");
  });

  test("strips an absolute repo-root prefix down to the js/ suffix", () => {
    expect(normalizeReportFileKey("/Users/au/w/socialcalc/js/formula-parse.ts")).toBe(
      "js/formula-parse.ts",
    );
    expect(
      normalizeReportFileKey("/home/runner/work/socialcalc/socialcalc/js/formula-parse.ts"),
    ).toBe("js/formula-parse.ts");
  });

  test("resolves a file:// URL", () => {
    expect(normalizeReportFileKey("file:///Users/au/w/socialcalc/js/formula-parse.ts")).toBe(
      "js/formula-parse.ts",
    );
  });

  test("normalizes backslash-separated (Windows-style) paths", () => {
    expect(normalizeReportFileKey("C:\\Users\\au\\socialcalc\\js\\formula-parse.ts")).toBe(
      "js/formula-parse.ts",
    );
  });

  test("leaves a file outside any js/ directory unchanged (never spuriously matches)", () => {
    expect(normalizeReportFileKey("test/malicious.ts")).toBe("test/malicious.ts");
  });
});

describe("evaluateFileReport", () => {
  test("passes for a single well-formed file entry matching the expected module", () => {
    const result = evaluateFileReport(
      reportFor({
        "js/formula-parse.ts": [
          mutant({ status: "Killed" }),
          mutant({ id: "2", status: "Survived" }),
        ],
      }),
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.total).toBe(2);
      expect(result.score).toBe(50);
    }
  });

  test("rejects a report shaped as a non-object", () => {
    expect(evaluateFileReport(null, "js/formula-parse.ts").ok).toBe(false);
    expect(evaluateFileReport([1, 2, 3], "js/formula-parse.ts").ok).toBe(false);
  });

  test("rejects a report whose files is not an object", () => {
    const result = evaluateFileReport({ files: [] }, "js/formula-parse.ts");
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/invalid mutation report shape/);
  });

  test("rejects a WRONG MODULE report — the only file key belongs to a different module", () => {
    const result = evaluateFileReport(
      killedReport("js/formula-operand.ts", 3),
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(
      /does not contain the expected mutated file js\/formula-parse\.ts/,
    );
    expect(result.detail).toMatch(/js\/formula-operand\.ts/);
  });

  test("rejects an EXTRA FILE report — the expected module plus an unrelated mutated file", () => {
    const result = evaluateFileReport(
      reportFor({
        "js/formula-parse.ts": [mutant()],
        "js/formula-operand.ts": [mutant()],
      }),
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/not owned by this leg/);
    expect(result.detail).toMatch(/js\/formula-operand\.ts/);
  });

  test("rejects a file entry that is not an object", () => {
    const result = evaluateFileReport(
      { files: { "js/formula-parse.ts": null } },
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/is not an object/);
  });

  test("rejects a file entry whose mutants is not an array", () => {
    const result = evaluateFileReport(
      { files: { "js/formula-parse.ts": { mutants: "nope" } } },
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/has no mutants array/);
  });

  test("rejects a mutant with an unrecognized status", () => {
    const result = evaluateFileReport(
      reportFor({ "js/formula-parse.ts": [mutant({ status: "Bogus" })] }),
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/has unrecognized status/);
  });

  test("rejects a mutant missing mutatorName", () => {
    const badMutant = { ...mutant(), mutatorName: "" };
    const result = evaluateFileReport(
      reportFor({ "js/formula-parse.ts": [badMutant] }),
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/missing mutatorName/);
  });

  test("rejects an EMPTY report (module owns the file, but zero mutants)", () => {
    const result = evaluateFileReport(
      reportFor({ "js/formula-parse.ts": [] }),
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/contains no mutants/);
  });

  test("counts Timeout as killed-like alongside Killed, and no other status", () => {
    const result = evaluateFileReport(
      reportFor({
        "js/formula-parse.ts": [
          mutant({ status: "Killed" }),
          mutant({ id: "2", status: "Timeout" }),
          mutant({ id: "3", status: "NoCoverage" }),
          mutant({ id: "4", status: "Survived" }),
        ],
      }),
      "js/formula-parse.ts",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.total).toBe(4);
      expect(result.score).toBe(50);
    }
  });
});

describe("checkBaselineRegistry", () => {
  test("reports no drift when the module sets match exactly", () => {
    const { missingFromRegistry, staleInRegistry } = checkBaselineRegistry(["js/a.ts", "js/b.ts"], {
      "js/a.ts": {},
      "js/b.ts": {},
    });
    expect(missingFromRegistry).toEqual([]);
    expect(staleInRegistry).toEqual([]);
  });

  test("reports a module missing from the registry", () => {
    const { missingFromRegistry } = checkBaselineRegistry(["js/a.ts", "js/b.ts"], {
      "js/a.ts": {},
    });
    expect(missingFromRegistry).toEqual(["js/b.ts"]);
  });

  test("reports a stale registry entry for a module no longer mutated", () => {
    const { staleInRegistry } = checkBaselineRegistry(["js/a.ts"], {
      "js/a.ts": {},
      "js/gone.ts": {},
    });
    expect(staleInRegistry).toEqual(["js/gone.ts"]);
  });
});

describe("reportPathFor (real filesystem, isolated temp cwd)", () => {
  function withTempCwd(run: (cwd: string) => void) {
    const dir = mkdtempSync(join(tmpdir(), "mutate-release-gate-"));
    try {
      run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("returns the CI artifact path when it exists", () => {
    withTempCwd((cwd) => {
      const ciDir = join(cwd, "artifacts", "mutation-report-formula-parse");
      mkdirSync(ciDir, { recursive: true });
      writeFileSync(join(ciDir, "mutation.json"), "{}");
      const result = reportPathFor("formula-parse", { artifactsDir: "artifacts", isCI: true, cwd });
      expect(result).toBe(join(ciDir, "mutation.json"));
    });
  });

  test("CI NO-LOCAL-FALLBACK — a stale local report is ignored in CI even when no artifact exists", () => {
    withTempCwd((cwd) => {
      const localDir = join(cwd, "reports", "mutation", "formula-parse");
      mkdirSync(localDir, { recursive: true });
      writeFileSync(join(localDir, "mutation.json"), "{}");
      const result = reportPathFor("formula-parse", { artifactsDir: "artifacts", isCI: true, cwd });
      expect(result).toBeNull();
    });
  });

  test("outside CI, falls back to the local sequential-run report", () => {
    withTempCwd((cwd) => {
      const localDir = join(cwd, "reports", "mutation", "formula-parse");
      mkdirSync(localDir, { recursive: true });
      writeFileSync(join(localDir, "mutation.json"), "{}");
      const result = reportPathFor("formula-parse", {
        artifactsDir: "artifacts",
        isCI: false,
        cwd,
      });
      expect(result).toBe(join(localDir, "mutation.json"));
    });
  });

  test("returns null when neither location has a report", () => {
    withTempCwd((cwd) => {
      const result = reportPathFor("formula-parse", {
        artifactsDir: "artifacts",
        isCI: false,
        cwd,
      });
      expect(result).toBeNull();
    });
  });
});

describe("evaluateAllModules (composed loop, real filesystem, isolated temp cwd)", () => {
  function withTempCwd(run: (cwd: string) => void) {
    const dir = mkdtempSync(join(tmpdir(), "mutate-release-gate-all-"));
    try {
      run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  function plantReport(
    cwd: string,
    slug: string,
    json: unknown,
    { asText }: { asText?: string } = {},
  ) {
    const dir = join(cwd, "artifacts", `mutation-report-${slug}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "mutation.json"), asText ?? JSON.stringify(json));
  }

  function fullMeasuredBaseline(files: string[], breakScore = 90, minimumMutants = 10) {
    const modules: Record<string, { measured: boolean; break: number; minimumMutants: number }> =
      {};
    for (const f of files) {
      modules[f] = { measured: true, break: breakScore, minimumMutants };
    }
    return modules;
  }

  test("VALID ALL-11 — every real shipping module passes with a fresh, well-formed, above-floor report", () => {
    withTempCwd((cwd) => {
      for (const file of ALL_MUTATE_FILES) {
        const slug = file.replace(/^js\//, "").replace(/\.ts$/, "");
        plantReport(cwd, slug, killedReport(file, 10));
      }
      const { rows, failed } = evaluateAllModules(
        ALL_MUTATE_FILES,
        fullMeasuredBaseline(ALL_MUTATE_FILES, 90),
        {
          artifactsDir: "artifacts",
          isCI: true,
          cwd,
        },
      );
      expect(failed).toBe(false);
      expect(rows).toHaveLength(ALL_MUTATE_FILES.length);
      expect(rows.every((r) => r.status === "PASS")).toBe(true);
    });
  });

  test("PARTIAL REPORT — a smaller mutant set cannot satisfy full-module evidence", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(cwd, "formula-parse", killedReport("js/formula-parse.ts", 2));
      const { rows, failed } = evaluateAllModules(files, fullMeasuredBaseline(files, 90, 10), {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(true);
      expect(rows[0].status).toBe("FAIL");
      expect(rows[0].detail).toMatch(
        /has 2 mutants; complete measured baseline requires at least 10/,
      );
    });
  });

  test("SOURCE GROWTH — a larger mutant set may satisfy the measured minimum", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(cwd, "formula-parse", killedReport("js/formula-parse.ts", 12));
      const { rows, failed } = evaluateAllModules(files, fullMeasuredBaseline(files, 90, 10), {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(false);
      expect(rows[0].status).toBe("PASS");
      expect(rows[0].detail).toMatch(/12 mutants/);
    });
  });

  test("WRONG MODULE — one leg's uploaded report is actually evidence for a different module", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts", "js/formula-operand.ts"];
      plantReport(cwd, "formula-parse", killedReport("js/formula-operand.ts", 5)); // miswired
      plantReport(cwd, "formula-operand", killedReport("js/formula-operand.ts", 5));
      const { rows, failed } = evaluateAllModules(files, fullMeasuredBaseline(files, 90, 5), {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(true);
      const parseRow = rows.find((r) => r.file === "js/formula-parse.ts");
      expect(parseRow?.status).toBe("FAIL");
      expect(parseRow?.detail).toMatch(/does not contain the expected mutated file/);
      const operandRow = rows.find((r) => r.file === "js/formula-operand.ts");
      expect(operandRow?.status).toBe("PASS");
    });
  });

  test("EXTRA FILE — a leg's report bundles an additional, unowned mutated file", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(
        cwd,
        "formula-parse",
        reportFor({
          "js/formula-parse.ts": [mutant()],
          "js/socialcalc-3.ts": [mutant()],
        }),
      );
      const { rows, failed } = evaluateAllModules(files, fullMeasuredBaseline(files), {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(true);
      expect(rows[0].detail).toMatch(/not owned by this leg/);
    });
  });

  test("MISSING BASELINE — module has a report but no registry entry at all", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(cwd, "formula-parse", killedReport("js/formula-parse.ts", 5));
      const { rows, failed } = evaluateAllModules(
        files,
        {},
        { artifactsDir: "artifacts", isCI: true, cwd },
      );
      expect(failed).toBe(true);
      expect(rows[0].detail).toMatch(/missing or malformed measured baseline/);
    });
  });

  test("EMPTY BASELINE — module explicitly registered but measured:false", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(cwd, "formula-parse", killedReport("js/formula-parse.ts", 5));
      const { rows, failed } = evaluateAllModules(
        files,
        { "js/formula-parse.ts": { measured: false } },
        { artifactsDir: "artifacts", isCI: true, cwd },
      );
      expect(failed).toBe(true);
      expect(rows[0].detail).toMatch(/missing or malformed measured baseline/);
    });
  });

  test("MALFORMED BASELINE — measured:true but break is a non-finite/out-of-range value", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(cwd, "formula-parse", killedReport("js/formula-parse.ts", 5));
      const { rows, failed } = evaluateAllModules(
        files,
        {
          "js/formula-parse.ts": {
            measured: true,
            break: Number.NaN,
            minimumMutants: 5,
          },
        },
        { artifactsDir: "artifacts", isCI: true, cwd },
      );
      expect(failed).toBe(true);
      expect(rows[0].detail).toMatch(/missing or malformed measured baseline/);
    });
  });

  test("MALFORMED REPORT — the report file is not valid JSON", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(cwd, "formula-parse", null, { asText: "{ this is not json" });
      const { rows, failed } = evaluateAllModules(files, fullMeasuredBaseline(files), {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(true);
      expect(rows[0].detail).toMatch(/invalid mutation report JSON/);
    });
  });

  test("BELOW FLOOR — a well-formed, correctly-attributed report scores under its registered break", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      plantReport(
        cwd,
        "formula-parse",
        reportFor({
          "js/formula-parse.ts": [
            mutant({ status: "Killed" }),
            mutant({ id: "2", status: "Survived" }),
            mutant({ id: "3", status: "Survived" }),
          ],
        }),
      );
      const { rows, failed } = evaluateAllModules(files, fullMeasuredBaseline(files, 90, 3), {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(true);
      expect(rows[0].status).toBe("FAIL");
      expect(rows[0].detail).toMatch(/33\.33% \(floor 90%/);
    });
  });

  test("CI NO-LOCAL-FALLBACK at the composed-loop level — a stale local report never substitutes for a missing CI artifact", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts"];
      const localDir = join(cwd, "reports", "mutation", "formula-parse");
      mkdirSync(localDir, { recursive: true });
      writeFileSync(
        join(localDir, "mutation.json"),
        JSON.stringify(killedReport("js/formula-parse.ts", 5)),
      );
      const { rows, failed } = evaluateAllModules(files, fullMeasuredBaseline(files), {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(true);
      expect(rows[0].detail).toBe("no fresh report found for this run");
    });
  });

  test("never short-circuits: every module gets its own row even when earlier ones fail", () => {
    withTempCwd((cwd) => {
      const files = ["js/formula-parse.ts", "js/formula-operand.ts", "js/formula-ref.ts"];
      // formula-parse: no report at all.
      // formula-operand: passes.
      plantReport(cwd, "formula-operand", killedReport("js/formula-operand.ts", 5));
      // formula-ref: below floor.
      plantReport(
        cwd,
        "formula-ref",
        reportFor({ "js/formula-ref.ts": [mutant({ status: "Survived" })] }),
      );
      const baseline = fullMeasuredBaseline(files, 90, 1);
      baseline["js/formula-operand.ts"].minimumMutants = 5;
      const { rows, failed } = evaluateAllModules(files, baseline, {
        artifactsDir: "artifacts",
        isCI: true,
        cwd,
      });
      expect(failed).toBe(true);
      expect(rows).toHaveLength(3);
      expect(rows.find((r) => r.file === "js/formula-parse.ts")?.status).toBe("FAIL");
      expect(rows.find((r) => r.file === "js/formula-operand.ts")?.status).toBe("PASS");
      expect(rows.find((r) => r.file === "js/formula-ref.ts")?.status).toBe("FAIL");
    });
  });
});
