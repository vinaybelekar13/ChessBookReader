from pathlib import Path
import shutil
from datetime import datetime

file = Path("src/App.tsx")
source = file.read_text(encoding="utf-8")
backup_dir = Path("backups") / ("encoding-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(file, backup_dir / "App.tsx")

replacements = {
    "Ã‚Â·": "·",
    "Â·": "·",
    "Loading engine?": "Loading engine…",
    "Analyzing current position?": "Analyzing current position…",
    "Ready ? White-positive scores": "Ready · White-positive scores",
    '"&#9822;"': '"♔"',
    "Ãƒâ€šÃ‚Â½": "½",
}
updated = source
for old, new in replacements.items():
    if old in updated:
        updated = updated.replace(old, new)
        print("Replaced:", repr(old))

if updated == source:
    print("No matching text found; source unchanged.")
else:
    file.write_text(updated, encoding="utf-8")
    print("Saved:", file)
    print("Backup:", backup_dir / "App.tsx")
