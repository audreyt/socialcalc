// Differential coverage: number and date formatting.
//
// Locks SocialCalc.FormatNumber.formatNumberWithFormat and the Julian date
// conversion helpers against the pinned socialcalc@3.0.8 oracle. The one
// known intended difference in this area (a malformed AM/PM token crashing
// the oracle) is asserted explicitly in
// test/differential/known-intended-differences.test.ts, not here — every
// case below is a parity regression guard.
import { describe, test } from "vite-plus/test";

import { expectParity, loadPair } from "../helpers/differential";

describe("number format parity", () => {
  test.each([
    ["1234.5", "#,##0.00"],
    ["1234567", "#,##0"],
    ["0.5", "0%"],
    ["0.123456", "0.00%"],
    ["0.00012345", "0.00E+00"],
    ["-42", "0;(0)"],
    ["0", "General"],
    ["1234.5", "$#,##0.00"],
    ["1234.5", "[$€]#,##0.00"],
    ["1000000", "#,##0,"],
  ] as const)("formatNumberWithFormat(%s, %s)", async (value, format) => {
    const { candidate, oracle } = await loadPair();
    expectParity(
      `formatNumberWithFormat(${value}, ${format})`,
      candidate.FormatNumber.formatNumberWithFormat(value, format),
      oracle.FormatNumber.formatNumberWithFormat(value, format),
    );
  });
});

describe("date/time format parity", () => {
  test.each([
    ["40179", "yyyy-mm-dd"],
    ["40179.75", "yyyy-mm-dd h:mm AM/PM"],
    ["40179.75", "hh:mm:ss AM/PM"],
    ["40179", "m/d/yy"],
    ["40179", "dddd, mmmm d, yyyy"],
    ["0.5", "h:mm"],
  ] as const)("formatNumberWithFormat(%s, %s)", async (value, format) => {
    const { candidate, oracle } = await loadPair();
    expectParity(
      `formatNumberWithFormat(${value}, ${format})`,
      candidate.FormatNumber.formatNumberWithFormat(value, format),
      oracle.FormatNumber.formatNumberWithFormat(value, format),
    );
  });

  test("Gregorian <-> Julian round trip matches for a representative date range", async () => {
    const { candidate, oracle } = await loadPair();
    for (const [year, month, day] of [
      [2010, 1, 1],
      [1985, 10, 26],
      [2000, 2, 29],
      [1900, 3, 1],
      [2099, 12, 31],
    ] as const) {
      const candidateJulian = candidate.FormatNumber.convert_date_gregorian_to_julian(
        year,
        month,
        day,
      );
      const oracleJulian = oracle.FormatNumber.convert_date_gregorian_to_julian(year, month, day);
      expectParity(`gregorian_to_julian(${year},${month},${day})`, candidateJulian, oracleJulian);

      const candidateBack =
        candidate.FormatNumber.convert_date_julian_to_gregorian(candidateJulian);
      const oracleBack = oracle.FormatNumber.convert_date_julian_to_gregorian(oracleJulian);
      expectParity(`julian_to_gregorian(${candidateJulian})`, candidateBack, oracleBack);
    }
  });
});
