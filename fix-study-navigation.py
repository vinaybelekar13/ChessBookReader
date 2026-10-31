from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

replacements = {
    'Math.max(0, (session?.moveIndex ?? 0) - 1)':
        'Math.max(0, (boardSession?.moveIndex ?? 0) - 1)',

    'Math.min(session?.moves.length ?? 0, (session?.moveIndex ?? 0) + 1)':
        'Math.min(boardSession?.moves.length ?? 0, (boardSession?.moveIndex ?? 0) + 1)',

    'jumpToMove(session?.moves.length ?? 0)':
        'jumpToMove(boardSession?.moves.length ?? 0)',

    'patchSession({ lineBaseFen: fen, currentFen: fen, moves: [], moveIndex: 0 });':
        'patchBoardSession({ lineBaseFen: fen, currentFen: fen, moves: [], moveIndex: 0 });',

    '{session?.moveIndex ? `MOVE ${session.moveIndex}` : "BOOK POSITION"}':
        '{boardSession?.moveIndex ? `MOVE ${boardSession.moveIndex}` : studyMode ? "STUDY POSITION" : "BOOK POSITION"}',
}

for old, new in replacements.items():
    count = s.count(old)
    if count:
        s = s.replace(old, new)
        print(f"Updated {count} occurrence(s): {old}")
    else:
        print(f"NOT FOUND; left unchanged: {old}")

p.write_text(s, encoding="utf-8", newline="")
print("Navigation patch written.")
