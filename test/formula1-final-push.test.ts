import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

import { expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

type FormulaOperand = SocialCalc.FormulaOperand;
type FormulaSC = typeof globalThis.SocialCalc;

function resetFormulaGlobals(SC: FormulaSC) {
  if (SC.RecalcInfo) {
    SC.RecalcInfo.LoadSheet = () => false;
    SC.RecalcInfo.currentState = 0;
    SC.RecalcInfo.queue = [];
    SC.RecalcInfo.firstRenderScheduled = false;
  }
  if (SC.Formula) {
    SC.Formula.SheetCache.sheets = {};
    SC.Formula.SheetCache.waitingForLoading = null;
    SC.Formula.FreshnessInfo.sheets = {};
    SC.Formula.FreshnessInfo.volatile = {};
    SC.Formula.RemoteFunctionInfo.waitingForServer = null;
  }
}

async function loadSC(): Promise<FormulaSC> {
  const SC = await loadSocialCalc();
  resetFormulaGlobals(SC);
  return SC;
}

function makeScriptedTokenText(responses: string[]): string {
  let index = 0;
  const scriptedText = {
    [Symbol.toPrimitive]() {
      const fallback = responses[responses.length - 1] ?? "";
      const response = responses[index] ?? fallback;
      index += 1;
      return response;
    },
  };
  return scriptedText as unknown as string;
}

test("EvaluatePolish: scripted numeric comparison reaches <> false continuation", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const scriptedNotEqual = makeScriptedTokenText([
    ...Array<string>(11).fill("not-an-operator"),
    "N",
    ...Array<string>(6).fill("not-an-operator"),
  ]);
  const tokens: SocialCalc.FormulaParseToken[] = [
    { text: "8", type: SC.Formula.TokenType.num, opcode: 0 },
    { text: "3", type: SC.Formula.TokenType.num, opcode: 0 },
    { text: scriptedNotEqual, type: SC.Formula.TokenType.op, opcode: "N" },
  ];

  const result = SC.Formula.EvaluatePolish(tokens, [0, 1, 2], sheet, false);

  expect(result).toMatchObject({ type: "nl", value: 0, error: "" });
});

test("EvaluatePolish: scripted text comparison reaches <> false continuation", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const scriptedNotEqual = makeScriptedTokenText([
    ...Array<string>(11).fill("not-an-operator"),
    "N",
    ...Array<string>(6).fill("not-an-operator"),
  ]);
  const tokens: SocialCalc.FormulaParseToken[] = [
    { text: "left", type: SC.Formula.TokenType.string, opcode: 0 },
    { text: "right", type: SC.Formula.TokenType.string, opcode: 0 },
    { text: scriptedNotEqual, type: SC.Formula.TokenType.op, opcode: "N" },
  ];

  const result = SC.Formula.EvaluatePolish(tokens, [0, 1, 2], sheet, false);

  expect(result).toMatchObject({ type: "nl", value: 0, error: "" });
});

test("HMSFunctions: direct SECOND can reach signed negative rounding with scripted number", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const savedOperandAsNumber = SC.Formula.OperandAsNumber;
  let coercionIndex = 0;
  const scriptedDateTime = {
    [Symbol.toPrimitive]() {
      const responses = [0, 0, 0.0001, -1];
      const response = responses[coercionIndex] ?? 0.0001;
      coercionIndex += 1;
      return response;
    },
  };
  const operand: FormulaOperand[] = [];
  const foperand: FormulaOperand[] = [{ type: "n", value: 0 }];

  try {
    SC.Formula.OperandAsNumber = () => ({ type: "n", value: scriptedDateTime });

    SC.Formula.HMSFunctions("SECOND", operand, foperand, sheet);

    expect(operand).toHaveLength(1);
    expect(operand[0]).toMatchObject({ type: "n", value: 8 });
  } finally {
    SC.Formula.OperandAsNumber = savedOperandAsNumber;
  }
});

test("NPVFunction: later numeric cashflow falls back after falsy intermediate result type", async () => {
  const SC = await loadSC();
  const sheet = new SC.Sheet();
  const savedLookupResultType = SC.Formula.LookupResultType;
  const operand: FormulaOperand[] = [];
  const foperand: FormulaOperand[] = [
    { type: "n", value: 121 },
    { type: "n", value: 110 },
    { type: "n", value: 0.1 },
  ];
  let lookupCount = 0;

  try {
    SC.Formula.LookupResultType = (type1, type2, typelookup) => {
      lookupCount += 1;
      if (lookupCount === 1) {
        return "";
      }
      return savedLookupResultType(type1, type2, typelookup);
    };

    SC.Formula.NPVFunction("NPV", operand, foperand, sheet);

    expect(operand).toHaveLength(1);
    expect(operand[0].type).toBe("n$");
    expect(operand[0].value).toBeCloseTo(200, 12);
  } finally {
    SC.Formula.LookupResultType = savedLookupResultType;
  }
});

test("TestCriteria: falsy textual criterion base normalizes to empty text", async () => {
  const SC = await loadSC();
  const savedDetermineValueType = SC.DetermineValueType;

  try {
    SC.DetermineValueType = (rawvalue: unknown) => {
      if (rawvalue === "ZEROBASE") {
        return { value: 0, type: "t" };
      }
      return savedDetermineValueType(rawvalue as string | number);
    };

    expect(SC.Formula.TestCriteria("", "t", "=ZEROBASE")).toBe(true);
    expect(SC.Formula.TestCriteria("nonempty", "t", "=ZEROBASE")).toBe(false);
  } finally {
    SC.DetermineValueType = savedDetermineValueType;
  }
});

test("Formula module init preserves preexisting debug log and function list bags", () => {
  const bundleFile =
    process.env.SOCIALCALC_COVERAGE_ISTANBUL === "1"
      ? "../dist/SocialCalc.instrumented.js"
      : "../dist/SocialCalc.js";
  const bundlePath = fileURLToPath(new URL(bundleFile, import.meta.url));
  const bundleSource = readFileSync(bundlePath, "utf8");
  const seededBundleSource = bundleSource.replace(
    "var SocialCalc = {};",
    `var SocialCalc = {};
Object.defineProperty(SocialCalc, "Formula", {
  configurable: true,
  get: function () {
    if (!this.__formulaForInit) {
      this.__formulaForInit = { FunctionList: { PREEXISTING: "kept" } };
    }
    return this.__formulaForInit;
  },
  set: function (value) {
    var current = this.Formula;
    for (var key in value) {
      current[key] = value[key];
    }
  }
});
SocialCalc.debug_log = ["preexisting-debug-log"];`,
  );
  if (seededBundleSource === bundleSource) {
    throw new Error("SocialCalc factory initializer was not found");
  }

  const savedSocialCalc = Object.getOwnPropertyDescriptor(globalThis, "SocialCalc");

  try {
    new Script(seededBundleSource, { filename: bundlePath + "#reexec" }).runInThisContext();
    const exported = Reflect.get(globalThis, "SocialCalc") as FormulaSC;

    expect(exported.debug_log).toEqual(["preexisting-debug-log"]);
    expect(exported.Formula.FunctionList.PREEXISTING).toBe("kept");
    expect(exported.Formula.FunctionList.SUM).toBeDefined();
  } finally {
    if (savedSocialCalc) {
      Object.defineProperty(globalThis, "SocialCalc", savedSocialCalc);
    } else {
      Reflect.deleteProperty(globalThis, "SocialCalc");
    }
  }
});
