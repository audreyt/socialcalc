// Unit + fixture-driven coverage for scripts/verify-mutation-disposition.mjs.
//
// Deliberately never touches the real reports/mutation/critical/mutation.json
// (gitignored, not guaranteed to exist, and this repo's rule against running
// Stryker means nothing here may regenerate it) — every case below builds its
// own synthetic Stryker-shaped report and disposition registry in an isolated
// temp directory, matching the script's own documented contract: match on
// stable (file, mutatorName, location, replacement) tuple identity, never on
// Stryker's per-run numeric mutant `id`.

import { describe, expect, test } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractSurvivors,
  findStaleEntries,
  findUndispositioned,
  normalizeFilePath,
  stableKey,
  validateDisposition,
  validateReport,
} from "../scripts/verify-mutation-disposition.mjs";

interface MutantLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

interface StrykerMutant {
  id: string;
  mutatorName: string;
  status: string;
  location: MutantLocation;
  replacement: string;
}

interface StrykerFileReport {
  mutants: StrykerMutant[];
}

interface StrykerReport {
  files: Record<string, StrykerFileReport>;
}

interface DispositionEntry {
  id?: number;
  file: string;
  mutatorName: string;
  location: MutantLocation;
  replacement: string;
  justification?: string;
}

interface DispositionRegistry {
  entries: DispositionEntry[];
}

function loc(line: number, startCol = 1, endCol = 10): MutantLocation {
  return { start: { line, column: startCol }, end: { line, column: endCol } };
}

function mutant(overrides: Partial<StrykerMutant> = {}): StrykerMutant {
  return {
    id: "1",
    mutatorName: "EqualityOperator",
    status: "Survived",
    location: loc(10),
    replacement: "true",
    ...overrides,
  };
}

function report(files: Record<string, StrykerMutant[]>): StrykerReport {
  const out: StrykerReport = { files: {} };
  for (const [file, mutants] of Object.entries(files)) out.files[file] = { mutants };
  return out;
}

function entry(overrides: Partial<DispositionEntry> = {}): DispositionEntry {
  return {
    file: "js/example.ts",
    mutatorName: "EqualityOperator",
    location: loc(10),
    replacement: "true",
    justification: "test fixture",
    ...overrides,
  };
}

function registry(entries: DispositionEntry[]): DispositionRegistry {
  return { entries };
}

const scriptPath = fileURLToPath(
  new URL("../scripts/verify-mutation-disposition.mjs", import.meta.url),
);

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("stableKey", () => {
  test("is identical for two mutants sharing (file, mutatorName, location, replacement) despite different id", () => {
    const a = {
      file: "js/x.ts",
      mutatorName: "EqualityOperator",
      location: loc(42, 3, 9),
      replacement: "true",
      id: "1",
    };
    const b = {
      file: "js/x.ts",
      mutatorName: "EqualityOperator",
      location: loc(42, 3, 9),
      replacement: "true",
      id: "999",
    };
    expect(stableKey(a)).toBe(stableKey(b));
  });
  test("normalizes redundant relative prefixes and Windows separators", () => {
    expect(normalizeFilePath("./js\\x.ts")).toBe("js/x.ts");
    expect(stableKey({ ...entry({ file: "./js\\x.ts" }), location: loc(42) })).toBe(
      stableKey({ ...entry({ file: "js/x.ts" }), location: loc(42) }),
    );
  });

  test("differs when mutatorName differs", () => {
    const a = entry({ mutatorName: "EqualityOperator" });
    const b = entry({ mutatorName: "ConditionalExpression" });
    expect(stableKey(a)).not.toBe(stableKey(b));
  });

  test("differs when location differs", () => {
    const a = entry({ location: loc(10) });
    const b = entry({ location: loc(11) });
    expect(stableKey(a)).not.toBe(stableKey(b));
  });

  test("differs when replacement differs", () => {
    const a = entry({ replacement: "true" });
    const b = entry({ replacement: "false" });
    expect(stableKey(a)).not.toBe(stableKey(b));
  });

  test("differs when file differs", () => {
    const a = entry({ file: "js/a.ts" });
    const b = entry({ file: "js/b.ts" });
    expect(stableKey(a)).not.toBe(stableKey(b));
  });
});

describe("extractSurvivors", () => {
  test("keeps only Survived mutants, flattened across files, preserving id", () => {
    const r = report({
      "js/a.ts": [
        mutant({ id: "1", status: "Survived", location: loc(1) }),
        mutant({ id: "2", status: "Killed", location: loc(2) }),
        mutant({ id: "3", status: "Timeout", location: loc(3) }),
      ],
      "js/b.ts": [mutant({ id: "4", status: "Survived", location: loc(4) })],
    });
    const survivors = extractSurvivors(r);
    expect(survivors).toHaveLength(2);
    expect(survivors.map((s) => s.id).sort((a, b) => a.localeCompare(b))).toEqual(["1", "4"]);
    expect(survivors.every((s) => s.file === "js/a.ts" || s.file === "js/b.ts")).toBe(true);
  });

  test("returns an empty array for a report with no files", () => {
    expect(extractSurvivors(report({}))).toEqual([]);
  });
});
describe("schema validation", () => {
  test("fails closed on malformed report/disposition schemas", () => {
    expect(() => validateReport({ files: { "js/a.ts": {} } } as unknown as StrykerReport)).toThrow(
      /mutants array/,
    );
    expect(() => validateDisposition({} as unknown as DispositionRegistry)).toThrow(
      /entries array/,
    );
  });
});

describe("findUndispositioned", () => {
  test("is empty when every Survived mutant has a matching disposition entry", () => {
    const r = report({ "js/a.ts": [mutant({ id: "1", location: loc(5) })] });
    const d = registry([entry({ file: "js/a.ts", location: loc(5) })]);
    expect(findUndispositioned(r, d)).toEqual([]);
  });

  test("returns exactly the survivors with no matching tuple", () => {
    const r = report({
      "js/a.ts": [mutant({ id: "1", location: loc(5) }), mutant({ id: "2", location: loc(6) })],
    });
    const d = registry([entry({ file: "js/a.ts", location: loc(5) })]);
    const undispositioned = findUndispositioned(r, d);
    expect(undispositioned).toHaveLength(1);
    expect(undispositioned[0].id).toBe("2");
  });

  test("matches by stable tuple even when the disposition entry's id differs from the report's mutant id", () => {
    const r = report({ "js/a.ts": [mutant({ id: "42", location: loc(5) })] });
    const d = registry([entry({ file: "js/a.ts", location: loc(5), id: 7 })]);
    expect(findUndispositioned(r, d)).toEqual([]);
  });

  test("ignores Killed/Timeout mutants entirely, even with no disposition entry", () => {
    const r = report({
      "js/a.ts": [
        mutant({ id: "1", status: "Killed", location: loc(5) }),
        mutant({ id: "2", status: "Timeout", location: loc(6) }),
      ],
    });
    expect(findUndispositioned(r, registry([]))).toEqual([]);
  });
});
describe("findStaleEntries", () => {
  test("finds stale entries but retains entries for mutants now Killed", () => {
    const d = registry([
      entry({ file: "js/a.ts", location: loc(5) }),
      entry({ file: "js/a.ts", location: loc(6) }),
    ]);
    const r = report({
      "js/a.ts": [mutant({ id: "1", status: "Killed", location: loc(5) })],
    });
    expect(findStaleEntries(r, d).map((e: DispositionEntry) => e.location.start.line)).toEqual([6]);
    expect(findStaleEntries(r, registry([entry({ file: "js/a.ts", location: loc(5) })]))).toEqual(
      [],
    );
  });

  test("rejects duplicate disposition tuple keys", () => {
    const e = entry({ file: "js/a.ts", location: loc(5) });
    expect(() => validateDisposition(registry([e, { ...e, id: 2 }]))).toThrow(
      /duplicate disposition key/,
    );
  });
});

describe("CLI: verify-mutation-disposition.mjs (fixture files, isolated temp dir)", () => {
  function withFixtures(
    r: StrykerReport,
    d: DispositionRegistry,
    run: (paths: { reportPath: string; dispositionPath: string }) => void,
  ) {
    const dir = mkdtempSync(join(tmpdir(), "verify-mutation-disposition-"));
    try {
      const reportPath = join(dir, "mutation.json");
      const dispositionPath = join(dir, "disposition.json");
      writeFileSync(reportPath, JSON.stringify(r));
      writeFileSync(dispositionPath, JSON.stringify(d));
      run({ reportPath, dispositionPath });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("exits 0 and reports OK when every survivor is dispositioned", () => {
    withFixtures(
      report({ "js/a.ts": [mutant({ id: "1", location: loc(5) })] }),
      registry([entry({ file: "js/a.ts", location: loc(5) })]),
      ({ reportPath, dispositionPath }) => {
        const result = runCli([`--report=${reportPath}`, `--disposition=${dispositionPath}`]);
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/OK — all 1 Survived mutant/);
      },
    );
  });

  test("exits 1 and lists the exact undispositioned mutant(s) and count", () => {
    withFixtures(
      report({
        "js/a.ts": [
          mutant({ id: "1", location: loc(5) }),
          mutant({ id: "2", mutatorName: "BlockStatement", location: loc(6) }),
        ],
      }),
      registry([entry({ file: "js/a.ts", location: loc(5) })]),
      ({ reportPath, dispositionPath }) => {
        const result = runCli([`--report=${reportPath}`, `--disposition=${dispositionPath}`]);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/FAILED — 1 of 2 Survived mutant/);
        expect(result.stderr).toMatch(
          /js\/a\.ts BlockStatement @ 6:1-6:10 -> true \(report id=2\)/,
        );
      },
    );
  });

  test("accepts an explicit report path as a bare positional argument", () => {
    withFixtures(
      report({ "js/a.ts": [mutant({ id: "1", location: loc(5) })] }),
      registry([entry({ file: "js/a.ts", location: loc(5) })]),
      ({ reportPath, dispositionPath }) => {
        const result = runCli([reportPath, `--disposition=${dispositionPath}`]);
        expect(result.status).toBe(0);
      },
    );
  });

  test("fails clearly (never silently passes) when the report path does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "verify-mutation-disposition-"));
    try {
      const dispositionPath = join(dir, "disposition.json");
      writeFileSync(dispositionPath, JSON.stringify(registry([])));
      const result = runCli([join(dir, "does-not-exist.json"), `--disposition=${dispositionPath}`]);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/no mutation report found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("fails clearly when the disposition registry path does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "verify-mutation-disposition-"));
    try {
      const reportPath = join(dir, "mutation.json");
      writeFileSync(reportPath, JSON.stringify(report({})));
      const result = runCli([reportPath, `--disposition=${join(dir, "missing-disposition.json")}`]);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/no disposition registry found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("combined multi-file critical report: all survivors dispositioned, Killed retained, absent stale fails", () => {
    // Mirrors the temporary merge of formula-parse/operand/ref per-file reports:
    // multiple files under one mutation.json, survivors fully accounted, a
    // previously-survived tuple now Killed is NOT stale, and a genuinely
    // absent registry tuple still fails closed.
    const combined = report({
      "js/formula-parse.ts": [
        mutant({
          id: "p1",
          status: "Survived",
          location: loc(10),
          mutatorName: "EqualityOperator",
          replacement: "a != b",
        }),
        mutant({
          id: "p2",
          status: "Killed",
          location: loc(121, 9, 37),
          mutatorName: "EqualityOperator",
          replacement: "cclass != charclass.numstart",
        }),
      ],
      "js/formula-operand.ts": [
        mutant({
          id: "o1",
          status: "Survived",
          location: loc(20),
          mutatorName: "StringLiteral",
          replacement: '""',
        }),
      ],
      "js/formula-ref.ts": [
        mutant({
          id: "r1",
          status: "Survived",
          location: loc(370),
          mutatorName: "LogicalOperator",
          replacement: "cr.row < 1 && cr.col < 1",
        }),
        mutant({ id: "r2", status: "Timeout", location: loc(99) }),
      ],
    });
    const fullRegistry = registry([
      entry({
        file: "js/formula-parse.ts",
        location: loc(10),
        mutatorName: "EqualityOperator",
        replacement: "a != b",
        id: 1,
      }),
      // Killed in the fresh combined report — retained proof, not stale.
      entry({
        file: "js/formula-parse.ts",
        location: loc(121, 9, 37),
        mutatorName: "EqualityOperator",
        replacement: "cclass != charclass.numstart",
        id: 476,
      }),
      entry({
        file: "js/formula-operand.ts",
        location: loc(20),
        mutatorName: "StringLiteral",
        replacement: '""',
        id: 2,
      }),
      entry({
        file: "js/formula-ref.ts",
        location: loc(370),
        mutatorName: "LogicalOperator",
        replacement: "cr.row < 1 && cr.col < 1",
        id: 3,
      }),
    ]);
    expect(extractSurvivors(combined)).toHaveLength(3);
    expect(findUndispositioned(combined, fullRegistry)).toEqual([]);
    expect(findStaleEntries(combined, fullRegistry)).toEqual([]);

    withFixtures(combined, fullRegistry, ({ reportPath, dispositionPath }) => {
      const result = runCli([`--report=${reportPath}`, `--disposition=${dispositionPath}`]);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/OK — all 3 Survived mutant/);
    });

    // A registry entry whose tuple is completely absent from the combined
    // report (not Survived, not Killed) must still fail — never weaken this.
    const withAbsent = registry([
      ...fullRegistry.entries,
      entry({
        file: "js/formula-parse.ts",
        location: loc(999),
        mutatorName: "BlockStatement",
        replacement: "{}",
        id: 999,
      }),
    ]);
    expect(findStaleEntries(combined, withAbsent).map((e: DispositionEntry) => e.id)).toEqual([
      999,
    ]);
    withFixtures(combined, withAbsent, ({ reportPath, dispositionPath }) => {
      const result = runCli([`--report=${reportPath}`, `--disposition=${dispositionPath}`]);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/FAILED — 1 disposition entr/);
      expect(result.stderr).toMatch(/stale/);
      expect(result.stderr).toMatch(/js\/formula-parse\.ts BlockStatement @ 999:/);
    });
  });
});
