from pathlib import Path

p = Path('js/formula1.ts')
text = p.read_text()

# DSeriesFunctions: add typed variable declarations for dbinfo/criteriainfo
# and fix any assignment
if 'dbinfo: any = scf.DecodeRangeParts' in text:
    text = text.replace('dbinfo: any = scf.DecodeRangeParts', 'dbinfo = scf.DecodeRangeParts')
if 'criteriainfo: any = scf.DecodeRangeParts' in text:
    text = text.replace('criteriainfo: any = scf.DecodeRangeParts', 'criteriainfo = scf.DecodeRangeParts')

# Find DSeriesFunctions block and add var dbinfo, criteriainfo before usage
if 'var dbinfo: any, criteriainfo: any' not in text:
    text = text.replace(
        'criteriarange = scf.TopOfStackValueAndType(sheet, foperand); // get a range',
        'criteriarange = scf.TopOfStackValueAndType(sheet, foperand); // get a range
   var dbinfo: any, criteriainfo: any;'
    )

# IndexFunction: type indexinfo as any in declaration
if 'var range, sheetname, indexinfo, rowindex, colindex, result, resulttype;' in text:
    text = text.replace(
        'var range, sheetname, indexinfo, rowindex, colindex, result, resulttype;',
        'var range, sheetname, indexinfo: any, rowindex, colindex, result, resulttype;'
    )
if 'indexinfo: any = scf.DecodeRangeParts' in text:
    text = text.replace('indexinfo: any = scf.DecodeRangeParts', 'indexinfo = scf.DecodeRangeParts')

p.write_text(text)
print('done')
