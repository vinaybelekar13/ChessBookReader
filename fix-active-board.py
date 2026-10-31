from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

old_click = """if (!session) return;
    if (annotationMode) {"""
new_click = """if (!boardSession) return;
    if (annotationMode) {"""

if s.count(old_click) != 1:
    raise SystemExit(
        f"STOP: expected exactly one handleSquareClick guard, found {s.count(old_click)}. No changes written."
    )

s = s.replace(old_click, new_click, 1)

start = s.index("  function resetBoard() {")
end = s.index("\n  }", start) + len("\n  }")

new_reset = """  function resetBoard() {
    if (studyMode) {
      if (!studyBoard) return;
      const original = new Chess(studyBoard.lineBaseFen);
      patchBoardSession({
        lineBaseFen: original.fen(),
        currentFen: original.fen(),
        moves: [],
        moveIndex: 0,
      });
    } else {
      if (!session) return;
      const original = new Chess(session.originalFen);
      patchSession({
        lineBaseFen: original.fen(),
        currentFen: original.fen(),
        moves: [],
        moveIndex: 0,
      });
    }
    setLastMove(null);
    setSelectedSquare(null);
    setPromotionRequest(null);
    setError("");
  }"""

s = s[:start] + new_reset + s[end:]

p.write_text(s, encoding="utf-8", newline="")
print("Updated handleSquareClick and resetBoard.")
