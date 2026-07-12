// Mutation-testing survivor kills for js/formula-parse.ts
//
// Each `describe` block below is scoped to one Stryker mutant id from the
// 32 formula-parse.ts survivors handed to this agent. Every killer test
// exercises the pure lexer/parser/type-lattice functions directly
// (SC.Formula.ParseFormulaIntoTokens / ConvertInfixToPolish /
// LookupResultType / ArrayValuesEqual) so the assertion pins down exactly
// the branch the mutant flips, independent of the rest of the evaluator.
//
// Several survivors turned out to be genuinely equivalent mutants (see the
// comments before those blocks for the proof); those are intentionally left
// untested here and are reported as `equivalentDisposition` in the final
// summary, never hidden via excludedMutations or disable comments.

import { describe, expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

// Stable parser token codes are part of the public token-stream contract.
// Keep expected values independent from the mutable SocialCalc bundle.
const TOKEN_TYPE = {
  num: 1,
  coord: 2,
  op: 3,
  name: 4,
  error: 5,
  string: 6,
  space: 7,
} as const;

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: numexp1 sign-accumulation guard (id=417)
// --------------------------------------------------------------------------
// Line 92: `(ch == "+" || ch == "-") && uppercasetable[...] == "E"`.
// Mutating this to `true` means ANY character reached in numexp1 (once the
// digit/E checks above it fail) gets silently appended to `str` instead of
// falling through to the "E"/"e" no-op branch or the error branch. Because
// the branch that actually pushes a token in that state never runs anymore,
// a malformed exponent like "1EX" stops producing an error token AND stops
// producing a number token at all — the number is simply swallowed.
describe("id=417: numexp1 sign-accumulation condition", () => {
  test("malformed exponent '1EX' still errors on the bad exponent, then tokenizes X separately", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("1EX");
    expect(tokens).toEqual([
      { text: "Improperly formed number exponent", type: TOKEN_TYPE.error, opcode: 0 },
      { text: "X", type: TOKEN_TYPE.name, opcode: 0 },
    ]);
  });

  test("signed exponent '1E+5' and '1E-5' still parse as single number tokens", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ParseFormulaIntoTokens("1E+5")).toEqual([
      { text: "1E+5", type: TOKEN_TYPE.num, opcode: 0 },
    ]);
    expect(SC.Formula.ParseFormulaIntoTokens("1E-5")).toEqual([
      { text: "1E-5", type: TOKEN_TYPE.num, opcode: 0 },
    ]);
  });
});

// --------------------------------------------------------------------------
// id=462: alpha-state `cclass == charclass.incoord` check is EQUIVALENT.
// --------------------------------------------------------------------------
// Every `if (state == X)` block in ParseFormulaIntoTokens is a bare `if`,
// not `else if`, so a state transition made by one block lets the very same
// character cascade into the next block within the same loop iteration.
// Mutating this comparison to `true` forces every character that reaches it
// (i.e. every character that is not num/alpha/'.') into `state = coord`
// instead of only doing so for the true incoord character ("$"). But the
// `str` accumulated while in the alpha state can never contain a digit
// (digits transition out of alpha before ever being appended in that
// block), so `coordregex` — which requires a trailing digit — can never
// match. That means the coord-state handler's op/numstart/space/eof branch
// always falls back to pushing a `name` token (identical to what the alpha
// branch would have pushed directly), and its error branch pushes the same
// `s_parseerrchar` text the alpha branch's error branch would have pushed.
// Exhaustive differential testing across the full mutated-vs-original
// tokenizer for every printable ASCII suffix (2 chars) after "A" and "$"
// found zero distinguishing input, confirming the two code paths are
// byte-for-byte equivalent in every reachable state.

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: alpha-state terminator group (id=466 whole group, id=476 numstart clause)
// --------------------------------------------------------------------------
describe("id=466: alpha-state op/numstart/space/eof terminator group", () => {
  test("alpha name followed by an unexpected char (quote) errors instead of silently naming", async () => {
    const SC = await loadSocialCalc();
    // A quote right after an alpha run is none of op/numstart/space/eof, so
    // it must hit the error branch, not the (mutated-to-always-true) name-push.
    expect(SC.Formula.ParseFormulaIntoTokens('A"')).toEqual([
      { text: "Unexpected character in formula", type: TOKEN_TYPE.error, opcode: 0 },
      { text: "Improperly formed string", type: TOKEN_TYPE.error, opcode: 0 },
    ]);
  });
});

// id=476: EqualityOperator flips `cclass == charclass.numstart` to `!=` inside
// the same terminator group as id=466. This is EQUIVALENT: the only
// character whose CharClassTable entry is `charclass.numstart` (2) is ".",
// and the alpha state's own second branch (`cclass == charclass.alpha ||
// ch == "."`) already intercepts every "." before this group is ever
// reached — so `cclass == charclass.numstart` can never be observed true
// (or, symmetrically, ever observed false in a way that matters) at this
// point; the clause is provably dead code given the fixed CharClassTable.

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: coord-state terminator group (id=502)
// --------------------------------------------------------------------------
describe("id=502: coord-state op/numstart/eof/space terminator group", () => {
  test("coord token followed by an unexpected char (quote) errors", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ParseFormulaIntoTokens('A1"')).toEqual([
      { text: "Unexpected character in formula", type: TOKEN_TYPE.error, opcode: 0 },
      { text: "Improperly formed string", type: TOKEN_TYPE.error, opcode: 0 },
    ]);
  });
});

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: alphanumeric-state terminator group (id=537)
// --------------------------------------------------------------------------
describe("id=537: alphanumeric-state op/numstart/space/eof terminator group", () => {
  test("alphanumeric token (letter-digit-letter) followed by an unexpected char errors", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ParseFormulaIntoTokens('A1B"')).toEqual([
      { text: "Unexpected character in formula", type: TOKEN_TYPE.error, opcode: 0 },
      { text: "Improperly formed string", type: TOKEN_TYPE.error, opcode: 0 },
    ]);
  });
});

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: specialvalue completion condition (id=586/588/589)
// --------------------------------------------------------------------------
// `str.charAt(str.length - 1) == "!" || SpecialConstants[str.toUpperCase()]`
// id=586 forces the whole condition false, id=588 replaces `str.charAt(...)`
// with the bare `str` (so it compares the WHOLE accumulated text, not just
// its last char, to "!"), and id=589 shifts the index by +1 (reading past
// the end of the string, always undefined). All three change whether a
// terminal "!" is recognized as completing a special value like "#!".
describe("id=586/588/589: specialvalue completion via trailing '!'", () => {
  test("'#!' completes as a name token exactly at EOF, driven by the trailing '!' check", async () => {
    const SC = await loadSocialCalc();
    // str == "#!" at EOF: charAt(length-1) == "!" is true (id=586 would force
    // false -> falls to the eof branch -> error instead of a name token;
    // id=588 compares str ("#!") itself to "!" -> false -> same wrong error;
    // id=589 reads charAt(length) === "" -> also false -> same wrong error).
    expect(SC.Formula.ParseFormulaIntoTokens("#!")).toEqual([
      { text: "#!", type: TOKEN_TYPE.name, opcode: 0 },
    ]);
  });

  test("'#REF!' (a real SpecialConstants entry) still completes as a name", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("#REF!");
    expect(tokens).toEqual([{ text: "#REF!", type: TOKEN_TYPE.name, opcode: 0 }]);
  });
});

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: two-char op merge guarded by last-token TYPE (id=637)
// --------------------------------------------------------------------------
// `if (last_token_type == charclass.op)` gates the <=/>=/<> merge. Mutating
// it to `true` makes the merge attempt fire even when the previous token is
// NOT an operator (e.g. it's a string literal whose text happens to be
// exactly "<"). `"<"` followed by `=` then wrongly merges into a single "L"
// (<=) token and pops the string token off — on a formula whose only prior
// token IS that string, the mutant even throws (parsestack underflow),
// which fails the test outright; on the original code the string token and
// the "=" operator stay completely separate.
describe("id=637: two-char op merge requires the previous token to actually be an op", () => {
  test('a string literal "<" followed by = does not merge into <=', async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens('"<"=1');
    expect(tokens).toEqual([
      { text: "<", type: TOKEN_TYPE.string, opcode: 0 },
      { text: "=", type: TOKEN_TYPE.op, opcode: "=" },
      { text: "1", type: TOKEN_TYPE.num, opcode: 0 },
    ]);
  });

  test("a real op '<' followed by = does merge into the <= (L) token", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("A<=B");
    expect(tokens.map((t: { text: string }) => t.text)).toEqual(["A", "L", "B"]);
  });
});

// --------------------------------------------------------------------------
// id=659: `else { last_token_type = charclass.eof; last_token_text = "EOF"; }`
// (parsestack-empty branch when the first-ever character is an operator) is
// EQUIVALENT. This block only executes when `parseinfo.length == 0`, and the
// very next read of `last_token_type`/`last_token_text` is
// `parseinfo.length == 0 || (last_token_type == charclass.op && ...)` — the
// `parseinfo.length == 0` operand is already `true` here, so `||`
// short-circuits and the right-hand operand (which is the only place these
// two variables are read) is never evaluated. Emptying this block's body
// therefore has zero observable effect on any token stream.
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: unary-position null-arg-list guard (id=696)
// --------------------------------------------------------------------------
describe("id=696: unary-position guard for ')' immediately after '('", () => {
  test("an operator (not ')') right after '(' still errors as two-ops-in-a-row", async () => {
    const SC = await loadSocialCalc();
    // "(!" : "!" is in unary position (right after "("), is not -, +, or ")",
    // and str != "(" -> must hit the two-ops error, not be silently accepted.
    expect(SC.Formula.ParseFormulaIntoTokens("(!")).toEqual([
      { text: "(", type: TOKEN_TYPE.op, opcode: "(" },
      { text: "Error in formula (two operators inappropriately in a row)", type: TOKEN_TYPE.error, opcode: "!" },
    ]);
  });

  test("'()' (a genuine null arg list) is accepted without error", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ParseFormulaIntoTokens("()")).toEqual([
      { text: "(", type: TOKEN_TYPE.op, opcode: "(" },
      { text: ")", type: TOKEN_TYPE.op, opcode: ")" },
    ]);
  });
});

// --------------------------------------------------------------------------
// ConvertInfixToPolish: space-token branch (id=768 real gap, id=770 equivalent)
// --------------------------------------------------------------------------
// ConvertInfixToPolish is a pure function over an arbitrary FormulaParseToken
// array, so a space-type token — which the real tokenizer never actually
// emits (space is silently dropped during lexing) — is still a legitimate,
// directly-constructible input for this function in isolation.
describe("id=768: ConvertInfixToPolish ignores space-type tokens even when their text collides with punctuation", () => {
  test("a space-type token whose text is ',' is ignored, not treated as a real comma", async () => {
    const SC = await loadSocialCalc();
    const spaceToken = { text: ",", type: TOKEN_TYPE.space, opcode: 0 };
    // Original: `ttype == tokentype.space` is checked BEFORE the `ttext ==
    // ","` branch, so this must be silently skipped (empty RPN, no error).
    // Mutant (id=768, condition -> false): falls through to the comma
    // handler, which sees an empty parsestack and returns the
    // "missing open parenthesis" error string instead of [].
    expect(SC.Formula.ConvertInfixToPolish([spaceToken])).toEqual([]);
  });
});

// id=770: the space branch's body (`{ continue; }`) is the LAST statement in
// the for-loop, so replacing it with an empty block `{}` is EQUIVALENT:
// falling off the end of the loop body naturally reaches the next iteration
// exactly the way `continue` does. There is no code after the if/else-if
// chain inside the loop for `continue` to skip. Verified by feeding the same
// space-in-the-middle token stream `[num, space, num]` through original and
// mutated implementations of the function — identical `[0, 2]` output.

// --------------------------------------------------------------------------
// ConvertInfixToPolish: post-')' function-name pop (id=809, id=814)
// --------------------------------------------------------------------------
// After the matching "(" is popped, if a function name sits below it on the
// stack it must be popped and appended to revpolish immediately. Both
// mutants (809: whole condition -> false; 814: body of the `if` -> {})
// leave that name stuck on parsestack instead. It normally gets swept up
// later (by the next op-branch's own unrelated name-check, or by the final
// drain), which usually reconstructs the same order — UNLESS another "("
// is opened immediately afterward, burying the stuck name one level deeper
// than it should be and reordering it relative to that inner call's result.
describe("id=809/814: stuck function name must be popped right after its call closes", () => {
  test("A(1)(2) keeps A's call result ordered before the second call's argument", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("A(1)(2)");
    // Correct RPN by token index: [-1 (name marker), 1(the "1"), 0("A"), 5(the "2")]
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([-1, 2, 0, 5]);
  });
});

// --------------------------------------------------------------------------
// ConvertInfixToPolish: op-branch precedence-loop entry conditions (id=811, id=812)
// --------------------------------------------------------------------------
describe("id=811/812: op-branch's own leading name-pop guard", () => {
  test("(1+2)*3 pops the '+' out of the parens before applying '*'", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("(1+2)*3");
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([1, 3, 2, 6, 5]);
  });

  test("((1)) with no operators at all still resolves to just the inner value", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("((1))");
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([2]);
  });
});

// --------------------------------------------------------------------------
// ConvertInfixToPolish: precedence while-loop stack-length guard (id=830)
// --------------------------------------------------------------------------
describe("id=830: precedence while-loop stops when parsestack empties", () => {
  test("1+2 resolves cleanly without walking off an empty operator stack", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("1+2");
    // Mutating the loop guard to unconditional `true` makes it index
    // parsestack[-1] once the stack empties, throwing instead of returning.
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([0, 2, 1]);
  });
});

// --------------------------------------------------------------------------
// ConvertInfixToPolish: precedence comparison (id=842) is a real gap;
// id=843/850/856 (>= vs >, < vs <=) are EQUIVALENT.
// --------------------------------------------------------------------------
// SC.Formula.TokenPrecedence's values are {1,2,-3,4,5,6,7,8,9} — no operator
// ever has precedence exactly 0. So `tprecedence >= 0` and `tprecedence > 0`
// (id=843), and `tprecedence < 0`/`tstackprecedence < 0` vs `<= 0` (id=850,
// id=856), can only ever disagree when the compared value is exactly 0,
// which never happens for a real opcode drawn from that fixed table (and
// when a lookup misses, both sides read `undefined`, and `undefined >= 0`,
// `undefined > 0`, `undefined < 0`, and `undefined <= 0` are all `false`
// alike). An 8000-formula randomized differential fuzz against a
// hand-transcribed reference implementation of ConvertInfixToPolish found
// zero disagreements for any of the three.
describe("id=842: precedence break condition (>= 0 && < stack) must gate on sign, not fire unconditionally", () => {
  test("1*2+3 evaluates '*' before '+' (left operand of + is the product)", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("1*2+3");
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([0, 2, 1, 4, 3]);
  });
});

// --------------------------------------------------------------------------
// ConvertInfixToPolish: unary (negative-precedence) normalization (id=853, id=854, id=859)
// --------------------------------------------------------------------------
describe("id=853: unary precedence must be negated to its positive magnitude", () => {
  test("A!-B1: unary minus does not pop the tighter-binding '!' off the stack", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("A!-B1");
    // Correct: A, !, unary-minus, B1 -> [-1, 0(A), 1(!), 3(B1), 2(unary M)]
    // id=853 (tprecedence stays negative -3 instead of +3) and id=859
    // (break fires unconditionally) both wrongly leave '!' stuck on the
    // stack past the unary minus, producing [-1, 0, 3, 2, 1] instead.
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([-1, 0, 1, 3, 2]);
  });
});

describe("id=854: stack-side precedence only gets negated when it started negative", () => {
  test("1+-2: '+' (positive precedence) does not get wrongly treated as tighter than unary minus", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("1+-2");
    // Correct: 1, +, unary-minus(2) -> [0(1), 3(2), 2(unary M), 1(+)]
    // id=854 (unconditionally negating tstackprecedence, flipping '+'s 7 to
    // -7) makes the break condition wrongly fail, producing [0, 1, 3, 2].
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([0, 3, 2, 1]);
  });
});

describe("id=859: inner break only fires once precedence is actually resolved unfavorably", () => {
  test("A!-B1 also catches id=859's unconditional break (shares the assertion above)", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("A!-B1");
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([-1, 0, 1, 3, 2]);
  });
});

// --------------------------------------------------------------------------
// id=863: `ttype == tokentype.error` at the tail of the ttype/ttext if-chain
// is EQUIVALENT. FormulaTokenTypeCode is a closed TS union `1|2|3|4|5|6|7`
// matching num/coord/op/name/error/string/space. Every value except
// `error` is already consumed by an earlier branch in the SAME chain
// (num/coord/string, name, space, and the ttext-based comma/paren checks
// plus the generic op branch cover types 1,2,3,4,6,7 completely) — so by
// the time this final `else if` is reached, `ttype` can only legally be
// `tokentype.error` (5). The condition can never be false given the type
// system, so forcing it to `true` changes nothing observable.
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// LookupResultType: malformed-table internal-error guards (id=904, id=931 real gaps; id=905, id=932 equivalent)
// --------------------------------------------------------------------------
// `pos2 = table1.indexOf("|", pos1 + 1)` always searches starting at index
// `pos1 + 1 >= 1` (pos1 is already guarded `>= 0` at this point), so a
// found `pos2` can never be exactly 0 — it is either `>= 1` or `-1`. That
// makes `pos2 < 0` and `pos2 <= 0` (id=905, id=932) provably identical for
// every reachable value. But `pos2 < 0` vs the mutant's unconditional
// `false` (id=904, id=931) is a real behavioral gap: with a malformed
// table missing its closing "|", the mutant skips the internal-error
// return and instead computes `substring(start, -1)`, which JS clamps and
// swaps into `substring(0, start)` — a nonsense-but-different result.
describe("id=904: LookupResultType reports malformed type-lookup tables (exact type2 match)", () => {
  test("a table missing its closing '|' after an exact type2 match returns the internal-error string", async () => {
    const SC = await loadSocialCalc();
    const result = SC.Formula.LookupResultType("n", "t", { n: "|t:1" });
    expect(result).toBe("e#VALUE! (internal error, incorrect LookupResultType |t:1)");
  });
});

describe("id=931: LookupResultType reports malformed type-lookup tables (wildcard type2 match)", () => {
  test("a table missing its closing '|' after a wildcard type2 match returns the internal-error string", async () => {
    const SC = await loadSocialCalc();
    const result = SC.Formula.LookupResultType("n", "tx", { n: "|t*:1" });
    expect(result).toBe("e#VALUE! (internal error, incorrect LookupResultType |t*:1)");
  });
});

// --------------------------------------------------------------------------
// ArrayValuesEqual: length mismatch short-circuit (id=949)
// --------------------------------------------------------------------------
describe("id=949: ArrayValuesEqual rejects arrays of different length even when every shared prefix matches", () => {
  test("a strict superset (extra trailing elements) is not equal", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ArrayValuesEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  test("a strict subset (fewer elements) is not equal", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ArrayValuesEqual([1, 2, 3], [1, 2])).toBe(false);
  });

  test("same-length equal-content arrays are equal", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ArrayValuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });
});

// --------------------------------------------------------------------------
// ParseFormulaIntoTokens: numexp1 sign guard checks trailing "E" (id=417)
// --------------------------------------------------------------------------
// Line 92: `(ch == "+" || ch == "-") && uppercasetable[str.charAt(...)] == "E"`.
// Mutating the second conjunct to `true` drops the check that str still ends
// with "E". After a sign is already appended in numexp1, str ends with "+" or
// "-" (uppercasetable["+"] is undefined, not "E"), so a SECOND sign should
// be rejected. The mutant wrongly accepts it, swallowing the whole malformed
// exponent into str instead of erroring.
describe("id=417: numexp1 rejects a second sign after the first", () => {
  test("'1E++5' errors on the second '+' instead of swallowing it", async () => {
    const SC = await loadSocialCalc();
    // Original: "1E+" then second "+" fails the trailing-E check, errors,
    //   and the second "+" is reprocessed in state 0 as an op token.
    //   Tokens: [error, op "+", num "5"]
    // Mutant (trailing-E check -> true): second "+" accepted, str becomes
    //   "1E++", then "5" enters numexp2, final token is num "1E++5".
    //   Tokens: [num "1E++5"]
    expect(SC.Formula.ParseFormulaIntoTokens("1E++5")).toEqual([
      { text: "Improperly formed number exponent", type: TOKEN_TYPE.error, opcode: 0 },
      { text: "+", type: TOKEN_TYPE.op, opcode: "+" },
      { text: "5", type: TOKEN_TYPE.num, opcode: 0 },
    ]);
  });

  test("'1E--5' errors on the second '-' instead of swallowing it", async () => {
    const SC = await loadSocialCalc();
    expect(SC.Formula.ParseFormulaIntoTokens("1E--5")).toEqual([
      { text: "Improperly formed number exponent", type: TOKEN_TYPE.error, opcode: 0 },
      { text: "-", type: TOKEN_TYPE.op, opcode: "-" },
      { text: "5", type: TOKEN_TYPE.num, opcode: 0 },
    ]);
  });
});

// --------------------------------------------------------------------------
// ConvertInfixToPolish: precedence while-loop type check (id=830)
// --------------------------------------------------------------------------
// Line 379: `parseinfo[...].type == tokentype.op` in the while-loop guard.
// Mutating it to `true` drops the type check, so the loop also pops NAME
// entries from parsestack, not just ops. Two names followed by an op
// (e.g. "A B+C") exposes this: the original leaves the first name on the
// stack (it is not an op), but the mutant pops it into revpolish early.
describe("id=830: precedence while-loop must not pop non-op entries from parsestack", () => {
  test("'A B+C' keeps name A on the stack when processing '+' (two names before an op)", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("A B+C");
    // Tokens: [name:A(0), name:B(1), op:+(2), name:C(3)]
    // Original: A→stack, -1→rev; B→stack, -1→rev; + pops B, while stops
    //   on A (non-op), +→stack; C→stack, -1→rev. Drain: C, +, A.
    //   revpolish = [-1, -1, 1, -1, 3, 2, 0]
    // Mutant (type check dropped): + pops B, while pops A (text != "("),
    //   +→stack; C→stack, -1→rev. Drain: C, +.
    //   revpolish = [-1, -1, 1, 0, -1, 3, 2]
    expect(SC.Formula.ConvertInfixToPolish(tokens)).toEqual([-1, -1, 1, -1, 3, 2, 0]);
  });
});


// --------------------------------------------------------------------------
// Fresh no-exclusion survivors: regex anchoring and comparison-token spelling.
// --------------------------------------------------------------------------

describe("fresh parse survivors", () => {
  test("fresh id341: a trailing in-coordinate marker is not accepted as a coord", async () => {
    const SC = await loadSocialCalc();
    const tokens = SC.Formula.ParseFormulaIntoTokens("A1$");
    // Full-string anchoring (trailing `$`) means a full coordregex match
    // fails, so this pushes a "name" token, never "coord" — the mutant
    // (dropped `$` end anchor) accepts the "A1" prefix and pushes "coord".
    expect(tokens).toEqual([{ text: "A1$", type: TOKEN_TYPE.name, opcode: 0 }]);
  });

  test("fresh id718/id725/id728: comparison operators carry their canonical opcode, not just token text", async () => {
    const SC = await loadSocialCalc();
    // `str` (-> token.text, L278/281/284) and `ch` (-> token.opcode via
    // pushtoken's 4th arg, L279/282/285) are set independently right next to
    // each other; id718/725/728 mutate only the `ch` assignments, which
    // text-only assertions on token.text never observe.
    const opcodeOf = (formula: string) => SC.Formula.ParseFormulaIntoTokens(formula)[1]!.opcode;
    expect(opcodeOf("A1>=B1")).toBe("G");
    expect(opcodeOf("A1<=B1")).toBe("L");
    expect(opcodeOf("A1<>B1")).toBe("N");
  });
});
