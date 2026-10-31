from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/styles.css")
s = p.read_text(encoding="utf-8")

old = """.evaluation-bar {
  display: flex;
  flex: 0 0 14px;
  width: 14px;
  align-self: stretch;
  min-height: 0;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #201E1B;
  overflow: hidden;
  flex-direction: column;
}"""

new = old.replace("flex-direction: column;", "flex-direction: column-reverse;")

if old not in s:
    print("Exact evaluation-bar CSS block not found. No changes made.")
    raise SystemExit(2)

backup = Path("backups") / ("evaluation-orientation-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "styles.css")

p.write_text(s.replace(old, new, 1), encoding="utf-8")
print("Changed evaluation bar orientation: White at bottom, Black at top.")
print("Score calculation unchanged.")
print("Backup:", backup / "styles.css")
