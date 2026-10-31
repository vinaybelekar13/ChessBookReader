from pathlib import Path
from datetime import datetime
import shutil
import sys

file = Path("src/App.tsx")
source = file.read_text(encoding="utf-8")

backup_dir = Path("backups") / ("symbols-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(file, backup_dir / "App.tsx")

replacements = {
    "ÃƒÂ¢Ã¢â€žÂ¢Ã¢â‚¬Â¢": "♕",
    "ÃƒÂ¢Ã¢â€žÂ¢Ã¢â‚¬â€œ": "♖",
    "ÃƒÂ¢Ã¢â€žÂ¢Ã¢â‚¬â€": "♗",
    "ÃƒÂ¢Ã¢â€žÂ¢Ã¢â‚¬Ëœ": "♘",
    "Ãƒâ€šÃ‚Â½": "½",
    "Ã‚Â½": "½",
}

updated = source
for old, new in replacements.items():
    if old in updated:
        updated = updated.replace(old, new)
        print(f"Fixed {old!r} -> {new}")

if updated == source:
    print("No exact symbol matches found. Nothing changed.")
    sys.exit(2)

file.write_text(updated, encoding="utf-8")
print(f"Backup saved: {backup_dir / 'App.tsx'}")
print("Symbol replacements saved.")
