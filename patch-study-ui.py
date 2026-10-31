from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")
original = s

start = s.index('  function completePromotion(')
end = s.index('  function makeMove(', start)
block = s[start:end]

old = 'if (!promotionRequest || !boardSession) return;'
if block.count(old) != 1:
    raise SystemExit("STOP: promotion guard not found exactly once.")
block = block.replace(old, 'if (!promotionRequest || !boardSession) return;', 1)

# Keep a narrowed, non-null local reference for TypeScript.
old = '      const currentGame = new Chess(boardSession.currentFen);'
if block.count(old) != 1:
    raise SystemExit("STOP: promotion position constructor not found exactly once.")
block = block.replace(old, '      const activeBoard = boardSession;\n      const currentGame = new Chess(activeBoard.currentFen);', 1)
block = block.replace('boardSession.moves.slice(0, boardSession.moveIndex)', 'activeBoard.moves.slice(0, activeBoard.moveIndex)')

s = s[:start] + block + s[end:]

# Add the mode button next to the board flip control.
old = '<div className="board-header-actions">'
new = '<div className="board-header-actions">\n              <button className="mini-button" onClick={toggleStudyMode} title="Switch between book and study board">{studyMode ? "Book board" : "Study mode"}</button>'
if s.count(old) != 1:
    raise SystemExit("STOP: board header actions anchor is not unique.")
s = s.replace(old, new, 1)

if s == original:
    raise SystemExit("STOP: no changes prepared.")

p.write_text(s, encoding="utf-8", newline="")
print("Fixed promotion null narrowing and connected Study mode toggle.")
