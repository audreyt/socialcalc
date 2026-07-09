:/tmp/fix_errortext.py
from pathlib import Path
p = Path('js/formula1.ts')
text = p.read_text()
text = text.replace(
    'var errortext: string | number | null | undefined = \\"\\";',
    'var errortext: string | number | null | undefined = "";',
)
p.write_text(text)
print('fixed')
