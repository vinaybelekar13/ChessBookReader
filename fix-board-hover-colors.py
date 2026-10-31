from pathlib import Path
from datetime import datetime
import shutil

p = Path("src/styles.css")
s = p.read_text(encoding="utf-8")

marker = "/* Keep chess square base colors stable on hover and focus. */"
if marker in s:
    print("Board color override already exists; no changes made.")
    raise SystemExit(0)

backup = Path("backups") / ("board-hover-override-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(p, backup / "styles.css")

addition = """

/* Keep chess square base colors stable on hover and focus. */
button.square.light-square:hover,
button.square.light-square:focus,
button.square.light-square:focus-visible {
  background: var(--board-light);
}

button.square.dark-square:hover,
button.square.dark-square:focus,
button.square.dark-square:focus-visible {
  background: var(--board-dark);
}
"""

p.write_text(s.rstrip() + addition + "\n", encoding="utf-8")
print("Added board square color override.")
print("Backup:", backup / "styles.css")
