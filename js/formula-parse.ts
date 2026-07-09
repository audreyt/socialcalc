// Pure formula parse / token / type helpers.
// Shipping source extracted from formula1 for full typecheck + LemmaScript.
// Concatenated after formula1 (Formula bag + token tables) and before formula-ref.
// Fully typechecked — no @ts-nocheck.
//
/*
// SocialCalc Formula Parse Helpers
// Part of the SocialCalc package.
// (c) Copyright 2008 Socialtext, Inc.
// Artistic License 2.0: http://socialcalc.org/licenses/al-20/
//
*/

// Formula object and token tables are created in formula1.ts. Assign pure
// methods onto the same bag via a named mutable view typed against the ambient API.
type FormulaParseMutable = Pick<
    typeof SocialCalc.Formula,
    | "ParsePushToken"
    | "ParseFormulaIntoTokens"
    | "ConvertInfixToPolish"
    | "LookupResultType"
    | "ArrayValuesEqual"
    | "PushOperand"
    | "CopyFunctionArgs"
>;
const FormulaParseMut = SocialCalc.Formula as FormulaParseMutable;

//@ verify
// LemmaScript: pure token push onto parseinfo array.
FormulaParseMut.ParsePushToken = function (
   parseinfo: SocialCalc.FormulaParseToken[],
   ttext: string,
   ttype: SocialCalc.FormulaTokenTypeCode,
   topcode: SocialCalc.FormulaOpcode,
): void {

   parseinfo.push({text: ttext, type: ttype, opcode: topcode});

   }


//@ verify
//@ ensures result_length_ge_0
// LemmaScript: pure formula lexer → token list (no sheet/DOM).
FormulaParseMut.ParseFormulaIntoTokens = function (
   line: string,
): SocialCalc.FormulaParseToken[] {

   var i, ch, cclass, last_token, last_token_type, last_token_text, t;

   var scf = SocialCalc.Formula;
   var scc = SocialCalc.Constants;
   var parsestate = scf.ParseState;
   var tokentype = scf.TokenType;
   var charclass = scf.CharClass;
   var charclasstable = scf.CharClassTable;
   var uppercasetable = scf.UpperCaseTable; // much faster than toUpperCase function
   var pushtoken = scf.ParsePushToken;
   var coordregex = /^\$?[A-Z]{1,2}\$?[1-9]\d*$/i;

   /** @type {any[]} */
   var parseinfo: SocialCalc.FormulaParseToken[] = [];
   var str = "";
   var state = 0;
   var haddecimal = false;
   var twochrop = "";
   
  for (i=0; i<=line.length; i++) {
      if (i<line.length) {
         ch = line.charAt(i);
         cclass = charclasstable[ch];
         }
      else {
         ch = "";
         cclass = charclass.eof;
         }

      if (state == parsestate.num) {
         if (cclass == charclass.num) {
            str += ch;
            }
         else if (cclass == charclass.numstart && !haddecimal) {
            haddecimal = true;
            str += ch;
            }
         else if (ch == "E" || ch == "e") {
            str += ch;
            haddecimal = false;
            state = parsestate.numexp1;
            }
         else { // end of number - save it
            pushtoken(parseinfo, str, tokentype.num, 0);
            haddecimal = false;
            state = 0;
            }
         }

      if (state == parsestate.numexp1) {
         if (cclass == parsestate.num) {
            state = parsestate.numexp2;
            }
         else if ((ch == '+' || ch == '-') && (uppercasetable[str.charAt(str.length-1)] == 'E')) {
            str += ch;
            }
         else if (ch == 'E' || ch == 'e') {
            ;
            }
         else {
            pushtoken(parseinfo, scc.s_parseerrexponent, tokentype.error, 0);
            state = 0;
            }
         }

      if (state == parsestate.numexp2) {
         if (cclass == charclass.num) {
            str += ch;
            }
         else { // end of number - save it
            pushtoken(parseinfo, str, tokentype.num, 0);
            state = 0;
            }
         }

      if (state == parsestate.alpha) {
         if (cclass == charclass.num) {
            state = parsestate.coord;
            }
         else if (cclass == charclass.alpha || ch == ".") { // alpha may be letters, numbers, "_", or "."
            str += ch;
            }
         else if (cclass == charclass.incoord) {
            state = parsestate.coord;
            }
         else if (cclass == charclass.op || cclass == charclass.numstart
                || cclass == charclass.space || cclass == charclass.eof) {
            pushtoken(parseinfo, str.toUpperCase(), tokentype.name, 0);
            state = 0;
            }
         else {
            pushtoken(parseinfo, scc.s_parseerrchar, tokentype.error, 0);
            state = 0;
            }
         }

      if (state == parsestate.coord) {
         if (cclass == charclass.num) {
            str += ch;
            }
         else if (cclass == charclass.incoord) {
            str += ch;
            }
         else if (cclass == charclass.alpha) {
            state = parsestate.alphanumeric;
            }
         else if (cclass == charclass.op || cclass == charclass.numstart ||
                  cclass == charclass.eof || cclass == charclass.space) {
            if (coordregex.test(str)) {
               t = tokentype.coord;
               }
            else {
               t = tokentype.name;
               }
            pushtoken(parseinfo, str.toUpperCase(), t, 0);
            state = 0;
            }
         else {
            pushtoken(parseinfo, scc.s_parseerrchar, tokentype.error, 0);
            state = 0;
           }
         }


      if (state == parsestate.alphanumeric) {
         if (cclass == charclass.num || cclass == charclass.alpha) {
            str += ch;
            }
         else if (cclass == charclass.op || cclass == charclass.numstart
                || cclass == charclass.space || cclass == charclass.eof) {
            pushtoken(parseinfo, str.toUpperCase(), tokentype.name, 0);
            state = 0;
            }
         else {
            pushtoken(parseinfo, scc.s_parseerrchar, tokentype.error, 0);
            state = 0;
            }
         }

      if (state == parsestate.string) {
         if (cclass == charclass.quote) {
            state = parsestate.stringquote; // got quote in string: is it doubled (quote in string) or by itself (end of string)?
            }
         else if (cclass == charclass.eof) {
            pushtoken(parseinfo, scc.s_parseerrstring, tokentype.error, 0);
            state = 0;
            }
         else {
            str += ch;
            }
         }
      else if (state == parsestate.stringquote) { // note else if here
         if (cclass == charclass.quote) {
            str += ch;
            state = parsestate.string; // double quote: add one then continue getting string
            }
         else { // something else -- end of string
            pushtoken(parseinfo, str, tokentype.string, 0);
            state = 0; // drop through to process
            }
         }

      else if (state == parsestate.specialvalue) { // special values like #REF!, #NAME?, #N/A
         // Complete when we already hold a finished special (ends with ! or known
         // SpecialConstants entry such as #NAME? / #N/A). Current char is the
         // delimiter and drops through after state→0, same as the ! path.
         if (str.charAt(str.length-1) == "!"
               || (scf.SpecialConstants && scf.SpecialConstants[str.toUpperCase()])) {
            pushtoken(parseinfo, str.toUpperCase(), tokentype.name, 0);
            state = 0; // drop through to process current char
            }
         else if (cclass == charclass.eof) {
            pushtoken(parseinfo, scc.s_parseerrspecialvalue, tokentype.error, 0);
            state = 0;
            }
         else {
            str += ch;
            }
         }

      if (state == 0) {
         if (cclass == charclass.num) {
            str = ch;
            state = parsestate.num;
            }
         else if (cclass == charclass.numstart) {
            str = ch;
            haddecimal = true;
            state = parsestate.num;
            }
         else if (cclass == charclass.alpha || cclass == charclass.incoord) {
            str = ch;
            state = parsestate.alpha;
            }
         else if (cclass == charclass.specialstart) {
            str = ch;
            state = parsestate.specialvalue;
            }
         else if (cclass == charclass.op) {
            str = ch;
            if (parseinfo.length>0) {
               last_token = parseinfo[parseinfo.length-1];
               last_token_type = last_token.type;
               last_token_text = last_token.text;
               if (last_token_type == charclass.op) {
                  twochrop = last_token_text + str;
                  if (twochrop == '<=' || twochrop == ">=" || twochrop == "<>") {
                     str = last_token_text + str;
                     parseinfo.pop();
                     // parseinfo.pop() came from `last_token_type == op`, which
                     // itself came from `parseinfo.length > 0`. The first op in a
                     // formula never gets stored as a plain op (unary rewrite to
                     // M/P or error), so parseinfo.length stays > 0 after pop.
                     last_token = parseinfo[parseinfo.length-1];
                     last_token_type = last_token.type;
                     last_token_text = last_token.text;
                     }
                  }
               }
            else {
               last_token_type = charclass.eof;
               last_token_text = "EOF";
               }
            t = tokentype.op;
            if ((parseinfo.length == 0)
                || (last_token_type == charclass.op && last_token_text != ')' && last_token_text != '%')) { // Unary operator
               if (str == '-') { // M is unary minus
                  str = "M";
                  ch = "M";
                  }
               else if (str == '+') { // P is unary plus
                  str = "P";
                  ch = "P";
                  }
               else if (str == ')' && last_token_text == '(') { // null arg list OK
                  ;
                  }
               else if (str != '(') { // binary-op open-paren OK, others no
                  t = tokentype.error;
                  str = scc.s_parseerrtwoops;
                  }
               }
            else if (str.length > 1) {
               // str is always one of >=, <=, <> here: the op-accumulator at
               // line 357 only folds those three pairs; every other two-op
               // sequence is emitted as two single-char tokens.
               if (str == '>=') { str = "G"; ch = "G"; }
               else if (str == '<=') { str = "L"; ch = "L"; }
               else { str = "N"; ch = "N"; } // str == '<>'
               }
            pushtoken(parseinfo, str, t, ch);
            state = 0;
            }
         else if (cclass == charclass.quote) { // starting a string
            str = "";
            state = parsestate.string;
            }
         else if (cclass == charclass.space) { // store so can reconstruct spacing
            //pushtoken(parseinfo, " ", tokentype.space, 0);
            }
         else if (cclass == charclass.eof) { // ignore -- needed to have extra loop to close out other things
            }
         else { // unknown class - such as unknown char
            pushtoken(parseinfo, scc.s_parseerrchar, tokentype.error, 0);
            }
         }
      }

   return parseinfo;

   }


//@ verify
//@ ensures result_length_ge_0
// LemmaScript: pure shunting-yard infix → RPN token list.
FormulaParseMut.ConvertInfixToPolish = function (
   parseinfo: SocialCalc.FormulaParseToken[],
): number[] | string {
   // Returns RPN as indices into parseinfo, or an error string (legacy contract).

   var scf = SocialCalc.Formula;
   var scc = SocialCalc.Constants;
   var tokentype = scf.TokenType;
   var token_precedence = scf.TokenPrecedence;

   var revpolish: number[] = [];
   var parsestack: number[] = [];

   var errortext = "";

   var function_start = -1;

   var i, pii, ttype, ttext, tprecedence, tstackprecedence;

   for (i=0; i<parseinfo.length; i++) {
      pii = parseinfo[i]!;
      ttype = pii.type;
      ttext = pii.text;
      if (ttype == tokentype.num || ttype == tokentype.coord || ttype == tokentype.string) {
         revpolish.push(i);
         }
      else if (ttype == tokentype.name) {
         parsestack.push(i);
         revpolish.push(function_start);
         }
      else if (ttype == tokentype.space) { // ignore
         continue;
         }
      else if (ttext == ',') {
         while (parsestack.length && parseinfo[parsestack[parsestack.length-1]].text != "(") {
            revpolish.push(parsestack.pop()!);
            }
         if (parsestack.length == 0) { // no ( -- error
            errortext = scc.s_parseerrmissingopenparen;
            break;
            }
         }
      else if (ttext == '(') {
         parsestack.push(i);
         }
      else if (ttext == ')') {
         while (parsestack.length && parseinfo[parsestack[parsestack.length-1]].text != "(") {
            revpolish.push(parsestack.pop()!);
            }
         if (parsestack.length == 0) { // no ( -- error
            errortext = scc.s_parseerrcloseparennoopen;
            break;
            }
         parsestack.pop();
         if (parsestack.length && parseinfo[parsestack[parsestack.length-1]].type == tokentype.name) {
            revpolish.push(parsestack.pop()!);
            }
         }
      else if (ttype == tokentype.op) {
         if (parsestack.length && parseinfo[parsestack[parsestack.length-1]].type == tokentype.name) {
            revpolish.push(parsestack.pop()!);
            }
         while (parsestack.length && parseinfo[parsestack[parsestack.length-1]].type == tokentype.op
                && parseinfo[parsestack[parsestack.length-1]].text != '(') {
            tprecedence = token_precedence[pii.opcode];
            tstackprecedence = token_precedence[parseinfo[parsestack[parsestack.length-1]].opcode];
            if (tprecedence >= 0 && tprecedence < tstackprecedence) break;
            if (tprecedence < 0) {
               tprecedence = -tprecedence;
               if (tstackprecedence < 0) tstackprecedence = -tstackprecedence;
               if (tprecedence <= tstackprecedence) break;
               }
            revpolish.push(parsestack.pop()!);
            }
         parsestack.push(i);
         }
      else if (ttype == tokentype.error) {
         errortext = ttext;
         break;
         }
      }
   while (parsestack.length>0) {
      if (parseinfo[parsestack[parsestack.length-1]].text == '(') {
         errortext = scc.s_parseerrmissingcloseparen;
         break;
         }
      revpolish.push(parsestack.pop()!);
      }

   if (errortext) {
      return errortext;
      }

   return revpolish;

   }


//@ verify
// LemmaScript: pure type-lattice lookup for binary/unary ops.
FormulaParseMut.LookupResultType = function (
   type1: string,
   type2: string,
   typelookup: { [key: string]: string },
): string {

   var pos1, pos2, result;

   var table1 = typelookup[type1];

   if (!table1) {
      table1 = typelookup[type1.charAt(0)+'*'];
      if (!table1) {
         return "e#VALUE! (internal error, missing LookupResultType "+type1.charAt(0)+"*)"; // missing from table -- please add it
         }
      }
   pos1 = table1.indexOf("|"+type2+":");
   if (pos1 >= 0) {
      pos2 = table1.indexOf("|", pos1+1);
      if (pos2<0) return "e#VALUE! (internal error, incorrect LookupResultType "+table1+")";
      result = table1.substring(pos1+type2.length+2, pos2);
      if (result == "1") return type1;
      if (result == "2") return type2;
      return result;
      }
   pos1 = table1.indexOf("|"+type2.charAt(0)+"*:");
   if (pos1 >= 0) {
      pos2 = table1.indexOf("|", pos1+1);
      if (pos2<0) return "e#VALUE! (internal error, incorrect LookupResultType "+table1+")";
      result = table1.substring(pos1+4, pos2);
      if (result == "1") return type1;
      if (result == "2") return type2;
      return result;
      }
   return "e#VALUE!";

   }


//@ verify
//@ ensures true
// LemmaScript: pure deep-ish array equality for formula values.
FormulaParseMut.ArrayValuesEqual = function (
   a: unknown[],
   b: unknown[],
): boolean {
  var i = a.length;
  if (i != b.length) return false;
  while (i--) {
      if (a[i] !== b[i]) return false;
  }
  return true;
}
//@ verify
// LemmaScript: pure operand-stack push.
FormulaParseMut.PushOperand = function (
   operand: SocialCalc.FormulaOperand[],
   t: SocialCalc.FormulaOperandType,
   v: unknown,
): void {

   operand.push({type: t, value: v});

   }


//@ verify
// LemmaScript: pure reverse-copy of function args from operand stack.
FormulaParseMut.CopyFunctionArgs = function (
   operand: SocialCalc.FormulaOperand[],
   foperand: SocialCalc.FormulaOperand[],
): void {

   var fobj, ffunc, argnum;
   var scf = SocialCalc.Formula;
   var ok = 1;
   var errortext = null;

   while (operand.length>0 && operand[operand.length-1]!.type != "start") { // get each arg
      foperand.push(operand.pop()!); // copy it
      }
   operand.pop(); // get rid of "start"

   return;

   }

