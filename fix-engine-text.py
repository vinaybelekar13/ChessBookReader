from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")
old = "Evaluation Â· White"
new = "Evaluation · White"

if old not in s:
    print("Exact text not found. No changes made.")
    raise SystemExit(2)

backup = Path("backups") / ("engine-text-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "App.tsx")

p.write_text(s.replace(old, new), encoding="utf-8")
print("Fixed Evaluation separator.")
print("Backup:", backup / "App.tsx")
