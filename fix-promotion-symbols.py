from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

start = '            <div className="promotion-choices">'
end = '            </div>'

pos = s.find(start)
if pos < 0:
    raise SystemExit("Promotion choices block not found; no changes made.")

close = s.find(end, pos)
if close < 0:
    raise SystemExit("Promotion choices closing tag not found; no changes made.")

close += len(end)
block = s[pos:close]

expected = [
    'completePromotion("q")',
    'completePromotion("r")',
    'completePromotion("b")',
    'completePromotion("n")',
]
if not all(item in block for item in expected):
    raise SystemExit("Unexpected promotion block; no changes made.")

backup = Path("backups") / ("promotion-symbol-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "App.tsx")

lines = block.splitlines()
symbols = {"q": "♕", "r": "♖", "b": "♗", "n": "♘"}

for i, line in enumerate(lines):
    for piece, symbol in symbols.items():
        if f'completePromotion("{piece}")' in line:
            before = line.split("<span>", 1)[0]
            after = line.split("</span>", 1)[1] if "</span>" in line else ""
            if not after:
                raise SystemExit(f"Could not safely parse {piece} promotion line.")
            lines[i] = before + f"<span>{symbol}</span>" + after
            print(f"Fixed {piece} promotion symbol.")

new_block = "\n".join(lines)
p.write_text(s[:pos] + new_block + s[close:], encoding="utf-8")
print("Backup:", backup / "App.tsx")
