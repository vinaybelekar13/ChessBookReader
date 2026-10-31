from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

backup = Path("backups") / ("pre-git-whitespace-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "App.tsx")

lines = s.splitlines()
lines = [line.rstrip() for line in lines]
updated = "\n".join(lines).rstrip() + "\n"

if updated != s:
    p.write_text(updated, encoding="utf-8", newline="")
    print("Whitespace cleaned. Backup:", backup / "App.tsx")
else:
    print("No whitespace changes were needed.")
