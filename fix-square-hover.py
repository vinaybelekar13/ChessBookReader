from pathlib import Path
from datetime import datetime
import shutil
import sys

p = Path("src/styles.css")
s = p.read_text(encoding="utf-8")

old = """.square:hover {
  filter: brightness(1.04);
}"""

if old not in s:
    print("Exact hover rule not found; no changes made.")
    # Show the nearby rule for safe follow-up.
    lines = s.splitlines()
    for i, line in enumerate(lines):
        if ".square:hover" in line:
            print("\n".join(f"{j+1}: {lines[j]}" for j in range(max(0, i-2), min(len(lines), i+5))))
    sys.exit(2)

backup = Path("backups") / ("square-hover-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "styles.css")

p.write_text(s.replace(old, "", 1), encoding="utf-8")
print("Removed square hover brightness filter.")
print("Backup:", backup / "styles.css")
