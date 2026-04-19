/// <reference path="../js/socialcalcconstants.d.ts" />
/// <reference path="../js/socialcalc-3.d.ts" />
/// <reference path="../js/socialcalctableeditor.d.ts" />
/// <reference path="../js/formatnumber2.d.ts" />
/// <reference path="../js/formula1.d.ts" />
/// <reference path="../js/socialcalcpopup.d.ts" />
/// <reference path="../js/socialcalcspreadsheetcontrol.d.ts" />
/// <reference path="../js/socialcalcviewer.d.ts" />

// Bridge the ambient `declare namespace SocialCalc { ... }` blocks (in the
// referenced files above) into a module-shaped default export. A bare
// `export = SocialCalc` on its own leaves the aggregator looking for a
// local value `SocialCalc`, which under strict `noImplicitAny` resolves to
// `any` at the import site. Declaring a module-local alias via
// `import ... = ` pulls the ambient namespace into module scope so
// `export =` refers to it unambiguously, giving consumers a fully-typed
// default import (`import SC from "socialcalc"` => typed `SC.Sheet`,
// `SC.Formula`, `SC.FormatNumber`, `SC.Constants`, etc.).
import SocialCalcNS = SocialCalc;

export = SocialCalcNS;
export as namespace SocialCalc;
