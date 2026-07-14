import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script, createContext } from "node:vm";

import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

const bundlePath = fileURLToPath(new URL("../dist/SocialCalc.js", import.meta.url));
const bundleSource = readFileSync(bundlePath, "utf8");
type BundleGlobal = {
  Sheet: unknown;
  GetEditorCellElement: (...args: unknown[]) => unknown;
  ReplaceCell: (...args: unknown[]) => unknown;
  EditorRenderSheet: (...args: unknown[]) => unknown;
  SpreadsheetControlSortSave: (...args: unknown[]) => string;
  SpreadsheetControlStatuslineCallback: (...args: unknown[]) => unknown;
  DoPositionCalculations: (...args: unknown[]) => unknown;
  EditorSheetStatusCallback: (...args: unknown[]) => void;
  GetSpreadsheetControlObject: () => { sortrange: string; idPrefix: string };
};

const mutableGlobalNames = ["SocialCalc", "module", "exports", "document"] as const;
type SavedGlobalDescriptor = {
  name: (typeof mutableGlobalNames)[number];
  descriptor: PropertyDescriptor | undefined;
};

function saveGlobalDescriptors(): SavedGlobalDescriptor[] {
  return mutableGlobalNames.map((name) => ({
    name,
    descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
  }));
}

function restoreGlobalDescriptors(saved: SavedGlobalDescriptor[]) {
  for (const { name, descriptor } of saved) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
}

function clearMutableGlobals() {
  for (const name of mutableGlobalNames) {
    Reflect.deleteProperty(globalThis, name);
  }
}

function requireLoadedSocialCalc(): BundleGlobal {
  const SC = Reflect.get(globalThis, "SocialCalc") as Partial<BundleGlobal> | undefined;
  expect(typeof SC?.Sheet).toBe("function");
  return SC as BundleGlobal;
}

function installSortDocument() {
  const sortControls: Record<string, { selectedIndex?: number; checked?: boolean }> = {
    "sort-majorsort": { selectedIndex: 2 },
    "sort-majorsortup": { checked: true },
    "sort-minorsort": { selectedIndex: 0 },
    "sort-lastsort": { selectedIndex: 3 },
    "sort-lastsortup": { checked: false },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    enumerable: true,
    value: { getElementById: (id: string) => sortControls[id] },
    writable: true,
  });
}

function loadBundleInContext(options: { document?: unknown } = {}) {
  const module = { exports: {} as unknown };
  const context = createContext({
    console,
    globalThis: {} as Record<string, unknown>,
    module,
    exports: module.exports,
    document: options.document,
  });
  const script = new Script(bundleSource, { filename: bundlePath });
  script.runInContext(context);
  const exported = module.exports as Record<string, unknown>;
  const globalExport = (context.globalThis as Record<string, unknown>).SocialCalc;
  return { exported, globalExport, context };
}

describe("bundle loader and DOM-free fallback wrappers", () => {
  test("UMD CommonJS loader publishes the same object to module.exports and globalThis", () => {
    const { exported, globalExport } = loadBundleInContext();

    expect(exported).toBe(globalExport);
    expect(typeof exported.Sheet).toBe("function");
    expect(typeof exported.FormatNumber).toBe("object");
  });

  test("fallback-wrapped DOM helpers use DOM-free fallbacks before document exists", () => {
    const { exported } = loadBundleInContext();
    const SC = exported as unknown as BundleGlobal;
    const calls: Array<[unknown, string, unknown, unknown]> = [];
    SC.EditorSheetStatusCallback = (...args: unknown[]) => {
      calls.push(args as [unknown, string, unknown, unknown]);
    };

    expect(SC.GetEditorCellElement({} as never, 1, 1)).toBeUndefined();
    expect(SC.ReplaceCell({} as never, {} as never, 1, 1)).toBeUndefined();
    expect(SC.EditorRenderSheet({} as never)).toBeUndefined();
    expect(SC.SpreadsheetControlSortSave({} as never, "sort")).toBe("");
    expect(SC.SpreadsheetControlStatuslineCallback(null, "status", null, {})).toBeUndefined();

    const editor = { marker: "fallback" };
    expect(SC.DoPositionCalculations(editor as never)).toBeUndefined();
    expect(calls).toEqual([[null, "doneposcalc", null, editor]]);
  });

  test("V8-visible bundle import exercises fallback and real wrapper dispatch", async () => {
    const savedGlobals = saveGlobalDescriptors();
    clearMutableGlobals();
    try {
      // Dynamic import is intentional here: a static import would evaluate the
      // UMD bundle before this test can clear `document`/CommonJS globals, and
      // the query string forces a fresh Vite module evaluation that V8 coverage
      // attributes to dist/SocialCalc.js rather than to an untracked vm.Context.
      const bundleSpecifier = "../dist/SocialCalc.js?bundle-wrapper-coverage";
      await import(bundleSpecifier);
      const SC = requireLoadedSocialCalc();
      const calls: unknown[][] = [];
      SC.EditorSheetStatusCallback = ((...args: unknown[]) => {
        calls.push(args);
      }) as typeof SC.EditorSheetStatusCallback;

      const fallbackEditor = { marker: "fallback" };
      expect(SC.GetEditorCellElement({} as never, 1, 1)).toBeUndefined();
      expect(SC.ReplaceCell({} as never, {} as never, 1, 1)).toBeUndefined();
      expect(SC.EditorRenderSheet({} as never)).toBeUndefined();
      expect(SC.SpreadsheetControlSortSave({} as never, "sort")).toBe("");
      expect(SC.SpreadsheetControlStatuslineCallback(null, "status", null, {})).toBeUndefined();
      expect(SC.DoPositionCalculations(fallbackEditor as never)).toBeUndefined();
      expect(calls).toEqual([[null, "doneposcalc", null, fallbackEditor]]);

      SC.GetSpreadsheetControlObject = () => ({ sortrange: "A1", idPrefix: "sort-" });
      installSortDocument();
      expect(SC.SpreadsheetControlSortSave({} as never, "sort")).toBe(
        "sort:A1:2:up:::3:down\n",
      );
    } finally {
      restoreGlobalDescriptors(savedGlobals);
    }
  });
});

describe("sheet serialization branch matrix", () => {
  test("CellToString serializes every sparse cell attribute without canonical xlat", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    const cell = sheet.GetAssuredCell("C3");

    cell.datatype = "c";
    cell.valuetype = "t";
    cell.datavalue = "display:value";
    cell.formula = "constant text";
    cell.readonly = true;
    cell.errors = "explicit:error";
    cell.bt = 1;
    cell.br = 2;
    cell.bb = 3;
    cell.bl = 4;
    cell.layout = 1;
    cell.font = 1;
    cell.color = 1;
    cell.bgcolor = 2;
    cell.cellformat = 1;
    cell.textvalueformat = 1;
    cell.nontextvalueformat = 2;
    cell.colspan = 3;
    cell.rowspan = 2;
    cell.cssc = "class-a";
    cell.csss = "color:red;background:blue";
    cell.mod = "y";
    cell.comment = "hello:comment";

    const line = sheet.CellToString(cell);

    expect(line).toContain(":vtc:t:display\\cvalue:constant text");
    expect(line).toContain(":ro:yes");
    expect(line).toContain(":e:explicit\\cerror");
    expect(line).toContain(":b:1:2:3:4");
    expect(line).toContain(":l:1");
    expect(line).toContain(":f:1");
    expect(line).toContain(":c:1");
    expect(line).toContain(":bg:2");
    expect(line).toContain(":cf:1");
    expect(line).toContain(":tvf:1");
    expect(line).toContain(":ntvf:2");
    expect(line).toContain(":colspan:3");
    expect(line).toContain(":rowspan:2");
    expect(line).toContain(":cssc:class-a");
    expect(line).toContain(":csss:color\\cred;background\\cblue");
    expect(line).toContain(":mod:y");
    expect(line).toContain(":comment:hello\\ccomment");
  });

  test("CanonicalizeSheet translates used sparse attributes into compact ids", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    sheet.colors[1] = "#ff0000";
    sheet.colorhash["#ff0000"] = 1;
    sheet.colors[2] = "#00ff00";
    sheet.colorhash["#00ff00"] = 2;
    sheet.borderstyles[1] = "1px solid #000";
    sheet.borderstylehash["1px solid #000"] = 1;
    sheet.layouts[1] = "padding:2px";
    sheet.layouthash["padding:2px"] = 1;
    sheet.fonts[1] = "italic bold 12px serif";
    sheet.fonthash["italic bold 12px serif"] = 1;
    sheet.cellformats[1] = "#,##0";
    sheet.cellformathash["#,##0"] = 1;
    sheet.valueformats[1] = "0.00";
    sheet.valueformathash["0.00"] = 1;
    sheet.valueformats[2] = "@";
    sheet.valueformathash["@"] = 2;

    sheet.attribs.defaultcolor = 1;
    sheet.rowattribs.height[7] = "24";
    sheet.colattribs.width.G = "99";

    const cell = sheet.GetAssuredCell("G7");
    cell.datatype = "v";
    cell.valuetype = "n";
    cell.datavalue = 42;
    cell.color = 1;
    cell.bgcolor = 2;
    cell.bt = 1;
    cell.br = 1;
    cell.bb = 1;
    cell.bl = 1;
    cell.layout = 1;
    cell.font = 1;
    cell.cellformat = 1;
    cell.textvalueformat = 2;
    cell.nontextvalueformat = 1;

    sheet.CanonicalizeSheet(true);
    expect(sheet.xlt.maxrow).toBe(7);
    expect(sheet.xlt.maxcol).toBe(7);
    expect(sheet.xlt.newcolors).toEqual(["", "#00ff00", "#ff0000"]);

    const canonical = sheet.CellToString(cell);
    expect(canonical).toContain(":b:1:1:1:1");
    expect(canonical).toContain(":l:1");
    expect(canonical).toContain(":f:1");
    expect(canonical).toContain(":c:2");
    expect(canonical).toContain(":bg:1");
    expect(canonical).toContain(":cf:1");
    expect(canonical).toContain(":tvf:2");
    expect(canonical).toContain(":ntvf:1");
  });

  test("CellToString also serializes sparse cells with optional attributes absent", async () => {
    const SC = await loadSocialCalc({ browser: true });

    const plainSheet = new SC.Sheet();
    const plain = plainSheet.GetAssuredCell("A1");
    plain.datatype = "v";
    plain.valuetype = "n";
    plain.datavalue = 7;
    expect(plainSheet.CellToString(plain)).toBe(":v:7");

    const xlatSheet = new SC.Sheet();
    xlatSheet.xlt = {
      borderstylesxlat: ["", 1],
      layoutsxlat: ["", 1],
      fontsxlat: ["", 1],
      colorsxlat: ["", 1],
      cellformatsxlat: ["", 1],
      valueformatsxlat: ["", 1],
    };
    const sparse = xlatSheet.GetAssuredCell("B2");
    sparse.datatype = "v";
    sparse.valuetype = "n";
    sparse.datavalue = 8;
    expect(xlatSheet.CellToString(sparse)).toBe(":v:8");
  });

  test("CanonicalizeSheet scans both styled and sparse filled cells", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    const first = sheet.GetAssuredCell("A1");
    first.datatype = "v";
    first.valuetype = "n";
    first.datavalue = 1;

    const second = sheet.GetAssuredCell("B1");
    second.datatype = "v";
    second.valuetype = "n";
    second.datavalue = 2;

    sheet.CanonicalizeSheet(true);
    expect(sheet.xlt.maxrow).toBe(1);
    expect(sheet.xlt.maxcol).toBe(2);
  });

  test("CellToString returns an empty line for a missing cell", async () => {
    const SC = await loadSocialCalc({ browser: true });
    const sheet = new SC.Sheet();
    expect(SC.CellToString(sheet, null)).toBe("");
  });
});
