from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/styles.css")
s = p.read_text(encoding="utf-8")

old_white = """.eval-white {
  width: 100%;
  background: #FFFFFF;
  transition: height 0.2s ease;
}"""

old_black = """.eval-black {
  width: 100%;
  background: #2B2824;
  transition: height 0.2s ease;
}"""

if old_white not in s or old_black not in s:
    print("Expected evaluation CSS was not found exactly. No changes made.")
    raise SystemExit(2)

backup = Path("backups") / ("eval-bar-smoothing-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "styles.css")

s = s.replace(old_white, old_white.replace("0.2s", "0.4s"), 1)
s = s.replace(old_black, old_black.replace("0.2s", "0.4s"), 1)
p.write_text(s, encoding="utf-8")

print("Evaluation bar transition changed from 200 ms to 400 ms.")
print("Backup:", backup / "styles.css")
