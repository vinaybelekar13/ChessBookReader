from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/styles.css")
s = p.read_text(encoding="utf-8")

marker = "/* Prevent mouse-click focus outlines on chess squares. */"
if marker in s:
    print("Focus fix already exists; no changes made.")
    raise SystemExit(0)

backup = Path("backups") / ("square-focus-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "styles.css")

addition = """

/* Prevent mouse-click focus outlines on chess squares. */
button.square:focus:not(:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

button.square:active {
  transform: none !important;
}
"""

p.write_text(s.rstrip() + addition + "\n", encoding="utf-8")
print("Added square mouse-focus fix.")
print("Backup:", backup / "styles.css")
