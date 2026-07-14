// Wall-clock performance budget for command execution + recalculation.
// Deliberately isolated from test/differential and test/adversarial (which
// must never assert on wall-clock time — see AGENTS.md) because a budget
// assertion's entire point is timing, but it uses a wide conservative
// margin over a measured baseline specifically so it does not flake on
// slower or more loaded CI hardware.
//
// Baseline measured 2026-07-12 on this worktree: setting up a 500-cell
// linear formula chain (A2=A1+1, A3=A2+1, ...) and recalculating it
// completed in ~53-56ms across three runs. The budget below is roughly a
// 35x margin over that measurement — generous enough to absorb hardware
// variance while still catching an algorithmic regression (e.g. an
// accidental O(n^2) recalculation pass) that would blow past it by a wide
// margin, not just a few percent.
import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc, recalcSheet, scheduleCommands } from "../helpers/socialcalc";

const CHAIN_LENGTH = 500;
const BUDGET_MS = 2000;

describe("recalculation performance budget", () => {
  test(
    `a ${CHAIN_LENGTH}-cell linear formula chain sets and recalculates within budget`,
    async () => {
      const SC = await loadSocialCalc();
      const sheet = new SC.Sheet();
      const commands = ["set A1 value n 1"];
      for (let row = 2; row <= CHAIN_LENGTH; row++) {
        commands.push(`set A${row} formula A${row - 1}+1`);
      }

      const start = performance.now();
      await scheduleCommands(SC, sheet, commands, true, BUDGET_MS);
      await recalcSheet(SC, sheet, BUDGET_MS);
      const elapsedMs = performance.now() - start;

      expect(sheet.cells[`A${CHAIN_LENGTH}`].datavalue).toBe(CHAIN_LENGTH);
      expect(
        elapsedMs,
        `${CHAIN_LENGTH}-cell chain took ${elapsedMs.toFixed(1)}ms, budget is ${BUDGET_MS}ms`,
      ).toBeLessThan(BUDGET_MS);
    },
    BUDGET_MS + 3000,
  );
});
