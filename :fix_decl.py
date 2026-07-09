:fix_decl.py
from pathlib import Path
import re

p = Path('js/formula1.ts')
text = p.read_text()

# 1. DSeriesFunctions: declare dbinfo and criteriainfo as any
# Insert after the existing var block or before dbinfo assignment
text = text.replace(
    'dbrange = scf.TopOfStackValueAndType(sheet, foperand); // get a range\n   fieldname = scf.OperandValueAndType(sheet, foperand); // get a value\n   criteriarange = scf.TopOfStackValueAndType(sheet, foperand); // get a range',
    'dbrange = scf.TopOfStackValueAndType(sheet, foperand); // get a range\n   fieldname = scf.OperandValueAndType(sheet, foperand); // get a value\n   criteriarange = scf.TopOfStackValueAndType(sheet, foperand); // get a range\n   var dbinfo: any, criteriainfo: any;'
)
# Remove invalid dbinfo: any
text = text.replace('dbinfo: any = scf.DecodeRangeParts(sheet, dbrange.value);', 'dbinfo = scf.DecodeRangeParts(sheet, dbrange.value);')

# 2. IndexFunction: declare indexinfo as any
# var range, sheetname, indexinfo, rowindex, colindex, result, resulttype;
text = text.replace(
    'var range, sheetname, indexinfo, rowindex, colindex, result, resulttype;',
    'var range, sheetname, indexinfo: any, rowindex, colindex, result, resulttype;'
)
text = text.replace('indexinfo: any = scf.DecodeRangeParts(sheet, range.value, range.type);', 'indexinfo = scf.DecodeRangeParts(sheet, range.value, range.type);')

# 3. InterestFunctions rate conflict: the second var rate is at line 4347?
# Search for `var rate = scf.OperandAsNumber` and `var rate = {value: 0};` in same function.
# Replace `var rate = {value: 0};` with `var rate2 = {value: 0};` and update references.
# But references may be many. Let's use `let` for the inner? Actually `var` can be replaced by `let` in a nested block? The conflict is in same function scope, so `let` won't help if at same level. We can rename the second to `rate2`.

# 4. IoFunctions parameter undefined: line 4661. Need inspect.

p.write_text(text)
print('done')
