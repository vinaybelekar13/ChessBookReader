from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

# Fix only the completePromotion function.
start = s.index('  function completePromotion(')
end = s.index('  function makeMove(', start)
block = s[start:end]

block = block.replace(
    'if (!promotionRequest || !boardSession) return;',
    'if (!promotionRequest || !boardSession) return;\n    const activeBoard = boardSession;',
    1
)
block = block.replace(
    'new Chess(boardSession.currentFen)',
    'new Chess(activeBoard.currentFen)'
)
block = block.replace(
    'boardSession.moves.slice(0, boardSession.moveIndex)',
    'activeBoard.moves.slice(0, activeBoard.moveIndex)'
)

s = s[:start] + block + s[end:]

# Fix only the makeMove function.
start = s.index('  function makeMove(')
end = s.index('  function handleSquareClick(', start)
block = s[start:end]

block = block.replace(
    'if (!boardSession) return;',
    'if (!boardSession) return;\n    const activeBoard = boardSession;',
    1
)
block = block.replace('new Chess(boardSession.currentFen)', 'new Chess(activeBoard.currentFen)')
block = block.replace(
    'boardSession.moves.slice(0, boardSession.moveIndex)',
    'activeBoard.moves.slice(0, activeBoard.moveIndex)'
)

s = s[:start] + block + s[end:]
p.write_text(s, encoding="utf-8", newline="")
print("Applied handler-scoped null-safety fixes.")
