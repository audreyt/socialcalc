use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

const TOKEN_NUM: u8 = 1;
const TOKEN_COORD: u8 = 2;
const TOKEN_OP: u8 = 3;
const TOKEN_NAME: u8 = 4;
const TOKEN_STRING: u8 = 6;

#[derive(Clone, Debug)]
struct Token {
    kind: u8,
    text: String,
}

static RESULT: LazyLock<Mutex<Vec<u8>>> = LazyLock::new(|| Mutex::new(Vec::new()));

fn set_result(bytes: &[u8]) {
    let mut guard = RESULT.lock().expect("result mutex poisoned");
    guard.clear();
    guard.extend_from_slice(bytes);
}

fn expand_op(text: &str) -> &str {
    match text {
        "G" => ">=",
        "L" => "<=",
        "M" => "-",
        "N" => "<>",
        "P" => "+",
        other => other,
    }
}

fn char_class(ch: char) -> u8 {
    match ch {
        '0'..='9' => 1,
        '.' => 2,
        '!' | '%' | '&' | '(' | ')' | '*' | '+' | ',' | '-' | '/' | ':' | '<' | '=' | '>' | '^' => 3,
        '$' => 6,
        '"' | '\'' => 8,
        ' ' | '\t' | '\r' | '\n' => 9,
        '#' => 10,
        'A'..='Z' | 'a'..='z' | '_' => 5,
        _ => 7,
    }
}

fn is_coord_shape(s: &str) -> bool {
    let upper = s.to_ascii_uppercase();
    let mut chars = upper.chars().peekable();
    if chars.peek() == Some(&'$') {
        chars.next();
    }
    let mut col_len = 0u8;
    while col_len < 2 {
        match chars.peek() {
            Some(c) if c.is_ascii_alphabetic() => {
                chars.next();
                col_len += 1;
            }
            _ => break,
        }
    }
    if col_len == 0 {
        return false;
    }
    if chars.peek() == Some(&'$') {
        chars.next();
    }
    match chars.next() {
        Some(c) if ('1'..='9').contains(&c) => {}
        _ => return false,
    }
    while matches!(chars.peek(), Some(c) if c.is_ascii_digit()) {
        chars.next();
    }
    chars.peek().is_none()
}

fn parse_formula_into_tokens(line: &str) -> Vec<Token> {
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0usize;
    let mut tokens = Vec::new();
    let mut state = 0u8;
    let mut str_buf = String::new();
    let mut had_decimal = false;

    const ST_NUM: u8 = 1;
    const ST_ALPHA: u8 = 2;
    const ST_COORD: u8 = 3;
    const ST_STRING: u8 = 4;
    const ST_STRINGQUOTE: u8 = 5;
    const ST_NUMEXP1: u8 = 6;
    const ST_NUMEXP2: u8 = 7;
    const ST_ALPHANUMERIC: u8 = 8;
    const ST_SPECIAL: u8 = 9;

    let push_token =
        |tokens: &mut Vec<Token>, text: String, kind: u8| tokens.push(Token { kind, text });

    while i <= chars.len() {
        let (ch, cclass) = if i < chars.len() {
            let ch = chars[i];
            (ch, char_class(ch))
        } else {
            ('\0', 4)
        };

        if state == ST_NUM {
            if cclass == 1 {
                str_buf.push(ch);
                i += 1;
                continue;
            }
            if cclass == 2 && !had_decimal {
                had_decimal = true;
                str_buf.push(ch);
                i += 1;
                continue;
            }
            if ch == 'E' || ch == 'e' {
                str_buf.push(ch);
                had_decimal = false;
                state = ST_NUMEXP1;
                i += 1;
                continue;
            }
            push_token(&mut tokens, str_buf.clone(), TOKEN_NUM);
            str_buf.clear();
            had_decimal = false;
            state = 0;
        }

        if state == ST_NUMEXP1 {
            if cclass == 1 {
                state = ST_NUMEXP2;
                continue;
            }
            if (ch == '+' || ch == '-')
                && str_buf
                    .chars()
                    .last()
                    .map(|c| c.eq_ignore_ascii_case(&'e'))
                    .unwrap_or(false)
            {
                str_buf.push(ch);
                i += 1;
                continue;
            }
            push_token(&mut tokens, str_buf.clone(), TOKEN_NUM);
            str_buf.clear();
            state = 0;
            continue;
        }

        if state == ST_NUMEXP2 {
            if cclass == 1 {
                str_buf.push(ch);
                i += 1;
                continue;
            }
            push_token(&mut tokens, str_buf.clone(), TOKEN_NUM);
            str_buf.clear();
            state = 0;
            continue;
        }

        if state == ST_ALPHA {
            if cclass == 1 {
                state = ST_COORD;
            } else if cclass == 5 || ch == '.' {
                str_buf.push(ch);
                i += 1;
                continue;
            } else if cclass == 6 {
                state = ST_COORD;
            } else if cclass == 3 || cclass == 2 || cclass == 9 || cclass == 4 {
                push_token(
                    &mut tokens,
                    str_buf.to_ascii_uppercase(),
                    TOKEN_NAME,
                );
                str_buf.clear();
                state = 0;
                continue;
            } else {
                state = 0;
                continue;
            }
            if state != ST_COORD {
                continue;
            }
        }

        if state == ST_COORD {
            if cclass == 1 || cclass == 6 {
                str_buf.push(ch);
                i += 1;
                continue;
            }
            if cclass == 5 {
                state = ST_ALPHANUMERIC;
                continue;
            }
            if cclass == 3 || cclass == 2 || cclass == 4 || cclass == 9 {
                let upper = str_buf.to_ascii_uppercase();
                let kind = if is_coord_shape(&upper) {
                    TOKEN_COORD
                } else {
                    TOKEN_NAME
                };
                push_token(&mut tokens, upper, kind);
                str_buf.clear();
                state = 0;
                continue;
            }
            state = 0;
            continue;
        }

        if state == ST_ALPHANUMERIC {
            if cclass == 1 || cclass == 5 {
                str_buf.push(ch);
                i += 1;
                continue;
            }
            if cclass == 3 || cclass == 2 || cclass == 9 || cclass == 4 {
                push_token(
                    &mut tokens,
                    str_buf.to_ascii_uppercase(),
                    TOKEN_NAME,
                );
                str_buf.clear();
                state = 0;
                continue;
            }
            state = 0;
            continue;
        }

        if state == ST_STRING {
            if cclass == 8 {
                state = ST_STRINGQUOTE;
                i += 1;
                continue;
            }
            if cclass == 4 {
                state = 0;
                continue;
            }
            str_buf.push(ch);
            i += 1;
            continue;
        }

        if state == ST_STRINGQUOTE {
            if cclass == 8 {
                str_buf.push('"');
                state = ST_STRING;
                i += 1;
                continue;
            }
            push_token(&mut tokens, str_buf.clone(), TOKEN_STRING);
            str_buf.clear();
            state = 0;
            continue;
        }

        if state == ST_SPECIAL {
            if str_buf.ends_with('!') {
                push_token(&mut tokens, str_buf.clone(), TOKEN_NAME);
                str_buf.clear();
                state = 0;
                continue;
            }
            if cclass == 4 {
                state = 0;
                continue;
            }
            str_buf.push(ch);
            i += 1;
            continue;
        }

        if state == 0 {
            if cclass == 1 {
                str_buf.push(ch);
                state = ST_NUM;
                i += 1;
                continue;
            }
            if cclass == 2 {
                str_buf.push(ch);
                had_decimal = true;
                state = ST_NUM;
                i += 1;
                continue;
            }
            if cclass == 5 || cclass == 6 {
                str_buf.push(ch);
                state = ST_ALPHA;
                i += 1;
                continue;
            }
            if cclass == 10 {
                str_buf.push(ch);
                state = ST_SPECIAL;
                i += 1;
                continue;
            }
            if cclass == 3 {
                let mut op = String::from(ch);
                if !tokens.is_empty() {
                    let last = tokens.last().unwrap();
                    if last.kind == TOKEN_OP {
                        let pair = format!("{}{}", last.text, ch);
                        if pair == "<=" || pair == ">=" || pair == "<>" {
                            tokens.pop();
                            op = pair;
                        }
                    }
                }
                let mut emit = op.clone();
                if emit == ">=" {
                    emit = "G".to_string();
                } else if emit == "<=" {
                    emit = "L".to_string();
                } else if emit == "<>" {
                    emit = "N".to_string();
                }
                push_token(&mut tokens, emit, TOKEN_OP);
                i += 1;
                continue;
            }
            if cclass == 8 {
                str_buf.clear();
                state = ST_STRING;
                i += 1;
                continue;
            }
            if cclass == 9 || cclass == 4 {
                i += 1;
                continue;
            }
            i += 1;
        }
    }

    tokens
}

#[derive(Clone, Copy, Debug, Default)]
struct Cr {
    col: i32,
    row: i32,
}

fn rc_colname(c: i32) -> String {
    let mut n = c;
    let mut s = String::new();
    while n > 0 {
        let rem = ((n - 1) % 26) as u8;
        s.insert(0, (b'A' + rem) as char);
        n = (n - 1) / 26;
    }
    s
}

fn coord_to_cr(cr: &str) -> Cr {
    let mut col = 0i32;
    let mut row = 0i32;
    for ch in cr.chars() {
        if ch == '$' {
            continue;
        }
        if ch.is_ascii_digit() {
            row = row * 10 + ch.to_digit(10).unwrap_or(0) as i32;
        } else if ch.is_ascii_alphabetic() {
            col = col * 26 + i32::from(ch.to_ascii_uppercase() as u8 - b'A' + 1);
        }
    }
    Cr { col, row }
}

fn cr_to_coord(col: i32, row: i32) -> String {
    format!("{}{}", rc_colname(col), row)
}

fn emit_string(text: &str) -> String {
    let escaped = text.replace('"', "\"\"");
    format!("\"{escaped}\"")
}

fn rewrite_offset(formula: &str, coloffset: i32, rowoffset: i32) -> String {
    let tokens = parse_formula_into_tokens(formula);
    let mut out = String::new();
    for tok in tokens {
        match tok.kind {
            TOKEN_COORD => {
                let mut cr = coord_to_cr(&tok.text);
                let abs_col = tok.text.starts_with('$');
                let abs_row = tok.text.contains('$') && tok.text.rfind('$').unwrap_or(0) > 0;
                let mut newcr = String::new();
                if abs_col {
                    newcr.push('$');
                }
                if !abs_col {
                    cr.col += coloffset;
                }
                newcr.push_str(&rc_colname(cr.col));
                if abs_row {
                    newcr.push('$');
                }
                if !abs_row {
                    cr.row += rowoffset;
                }
                newcr.push_str(&cr.row.to_string());
                if cr.row < 1 || cr.col < 1 || cr.col > 702 {
                    newcr = "#REF!".to_string();
                }
                out.push_str(&newcr);
            }
            TOKEN_STRING => out.push_str(&emit_string(&tok.text)),
            TOKEN_OP => out.push_str(expand_op(&tok.text)),
            _ => out.push_str(&tok.text),
        }
    }
    out
}

fn rewrite_adjust(
    formula: &str,
    col: i32,
    coloffset: i32,
    row: i32,
    rowoffset: i32,
) -> String {
    let tokens = parse_formula_into_tokens(formula);
    let mut out = String::new();
    let mut sheetref = false;
    for tok in tokens {
        let mut text = tok.text.clone();
        if tok.kind == TOKEN_OP {
            if text == "!" {
                sheetref = true;
            } else if text != ":" {
                sheetref = false;
            }
            text = expand_op(&text).to_string();
        }
        if tok.kind == TOKEN_COORD {
            let mut cr = coord_to_cr(&text);
            if (coloffset < 0 && cr.col >= col && cr.col < col - coloffset)
                || (rowoffset < 0 && cr.row >= row && cr.row < row - rowoffset)
            {
                if !sheetref {
                    cr.col = 0;
                    cr.row = 0;
                }
            }
            if !sheetref {
                if cr.col >= col {
                    cr.col += coloffset;
                }
                if cr.row >= row {
                    cr.row += rowoffset;
                }
            }
            let abs_col = text.starts_with('$');
            let abs_row = text.contains('$') && text.rfind('$').unwrap_or(0) > 0;
            let mut newcr = String::new();
            if abs_col {
                newcr.push('$');
            }
            newcr.push_str(&rc_colname(cr.col));
            if abs_row {
                newcr.push('$');
            }
            newcr.push_str(&cr.row.to_string());
            if cr.row < 1 || cr.col < 1 || cr.col > 702 {
                newcr = "#REF!".to_string();
            }
            text = newcr;
        } else if tok.kind == TOKEN_STRING {
            text = emit_string(&tok.text);
        }
        out.push_str(&text);
    }
    out
}

fn rewrite_replace(formula: &str, moved_to: &[(String, String)]) -> String {
    let map: HashMap<String, String> = moved_to
        .iter()
        .map(|(k, v)| (k.to_ascii_uppercase(), v.clone()))
        .collect();
    let tokens = parse_formula_into_tokens(formula);
    let mut out = String::new();
    let mut sheetref = false;
    for tok in tokens {
        let mut text = tok.text.clone();
        if tok.kind == TOKEN_OP {
            if text == "!" {
                sheetref = true;
            } else if text != ":" {
                sheetref = false;
            }
            text = expand_op(&text).to_string();
        }
        if tok.kind == TOKEN_COORD {
            let cr = coord_to_cr(&text);
            let coord = cr_to_coord(cr.col, cr.row);
            if !sheetref {
                if let Some(dest) = map.get(&coord) {
                    let dest_cr = coord_to_cr(dest);
                    let abs_col = text.starts_with('$');
                    let abs_row = text.contains('$') && text.rfind('$').unwrap_or(0) > 0;
                    let mut newcr = String::new();
                    if abs_col {
                        newcr.push('$');
                    }
                    newcr.push_str(&rc_colname(dest_cr.col));
                    if abs_row {
                        newcr.push('$');
                    }
                    newcr.push_str(&dest_cr.row.to_string());
                    text = newcr;
                }
            }
        } else if tok.kind == TOKEN_STRING {
            text = emit_string(&tok.text);
        }
        out.push_str(&text);
    }
    out
}

pub fn offset_formula_coords(formula: &str, coloffset: i32, rowoffset: i32) -> String {
    rewrite_offset(formula, coloffset, rowoffset)
}

pub fn adjust_formula_coords(
    formula: &str,
    col: i32,
    coloffset: i32,
    row: i32,
    rowoffset: i32,
) -> String {
    rewrite_adjust(formula, col, coloffset, row, rowoffset)
}

pub fn replace_formula_coords(formula: &str, moved_to: &[(String, String)]) -> String {
    rewrite_replace(formula, moved_to)
}

#[unsafe(no_mangle)]
pub extern "C" fn formula_ref_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(len);
    buf.resize(len, 0);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn formula_ref_dealloc(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 {
        drop(unsafe { Vec::from_raw_parts(ptr, len, len) });
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn formula_ref_rewrite(
    mode: i32,
    formula_ptr: *mut u8,
    formula_len: usize,
    a: i32,
    b: i32,
    c: i32,
    d: i32,
    map_ptr: *mut u8,
    map_len: usize,
) -> i32 {
    let formula_bytes = unsafe { std::slice::from_raw_parts(formula_ptr, formula_len) };
    let formula = match std::str::from_utf8(formula_bytes) {
        Ok(s) => s,
        Err(_) => {
            set_result(b"invalid utf-8 formula");
            return 1;
        }
    };

    let result = match mode {
        1 => offset_formula_coords(formula, a, b),
        2 => adjust_formula_coords(formula, a, b, c, d),
        3 => {
            let map_bytes = unsafe { std::slice::from_raw_parts(map_ptr, map_len) };
            let map_str = match std::str::from_utf8(map_bytes) {
                Ok(s) => s,
                Err(_) => {
                    set_result(b"invalid utf-8 map");
                    return 2;
                }
            };
            let mut pairs = Vec::new();
            for line in map_str.lines() {
                if line.is_empty() {
                    continue;
                }
                let Some((from, to)) = line.split_once('=') else {
                    continue;
                };
                pairs.push((from.trim().to_string(), to.trim().to_string()));
            }
            replace_formula_coords(formula, &pairs)
        }
        _ => {
            set_result(b"unknown rewrite mode");
            return 3;
        }
    };

    set_result(result.as_bytes());
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn formula_ref_result_ptr() -> *const u8 {
    let guard = RESULT.lock().expect("result mutex poisoned");
    guard.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn formula_ref_result_len() -> usize {
    let guard = RESULT.lock().expect("result mutex poisoned");
    guard.len()
}
