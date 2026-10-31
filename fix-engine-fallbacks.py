from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

replacements = {
    "â€”": "—",
    "â€¦": "…",
}

updated = s
for old, new in replacements.items():
    count = updated.count(old)
    if count:
        updated = updated.replace(old, new)
        print(f"Replacing {old!r} -> {new!r} ({count} occurrences)")
    else:
        print(f"No occurrence of {old!r}")

if updated == s:
    print("No changes needed.")
    raise SystemExit(0)

backup = Path("backups") / ("engine-fallback-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "App.tsx")
p.write_text(updated, encoding="utf-8")

print("Updated src/App.tsx")
print("Backup:", backup / "App.tsx")
