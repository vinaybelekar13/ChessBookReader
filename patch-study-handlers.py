from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")
original = s

def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"STOP: {label}: expected one match, found {n}; file not written.")
    s = s.replace(old, new, 1)
    print("Updated:", label)

# Scope the replacements to the complete handler blocks.
start = s.index("  function completePromotion(")
end = s.index("  function handleSquareClick(", start)
block = s[start:end]

old_guard = 'if (!promotionRequest || !session) return;'
if block.count(old_guard) != 1:
    raise SystemExit("STOP: promotion guard not unique.")
block = block.replace(old_guard, 'if (!promotionRequest || !boardSession) return;', 1)

old_fen = 'const currentGame = new Chess(session.currentFen);'
if block.count(old_fen) != 2:
    raise SystemExit("STOP: expected two handler position constructors.")
block = block.replace(old_fen, 'const currentGame = new Chess(boardSession.currentFen);')

old_moves = 'const nextMoves = [...session.moves.slice(0, session.moveIndex), result.san];'
if block.count(old_moves) != 2:
    raise SystemExit("STOP: expected two move list updates.")
block = block.replace(old_moves, 'const nextMoves = [...boardSession.moves.slice(0, boardSession.moveIndex), result.san];')

old_patch = '''patchSession({
        currentFen: currentGame.fen(),
        moves: nextMoves,
        moveIndex: nextMoves.length,
      });'''
if block.count(old_patch) != 2:
    raise SystemExit("STOP: expected two session updates.")
block = block.replace(old_patch, '''patchBoardSession({
        currentFen: currentGame.fen(),
        moves: nextMoves,
        moveIndex: nextMoves.length,
      });''')

s = s[:start] + block + s[end:]

start = s.index("  function jumpToMove(")
end = s.index("  async function copyText(", start)
block = s[start:end]
for old, new, label in [
    ("if (!session) return;", "if (!boardSession) return;", "navigation guard"),
    ("makePosition(session.lineBaseFen, session.moves, index)", "makePosition(boardSession.lineBaseFen, boardSession.moves, index)", "navigation position"),
    ("patchSession({ moveIndex: index, currentFen: next.fen() });", "patchBoardSession({ moveIndex: index, currentFen: next.fen() });", "navigation update"),
]:
    if block.count(old) != 1:
        raise SystemExit(f"STOP: navigation {label} not unique.")
    block = block.replace(old, new, 1)
s = s[:start] + block + s[end:]

if s == original:
    raise SystemExit("STOP: no changes prepared.")

p.write_text(s, encoding="utf-8", newline="")
print("Saved handler changes to", p)
