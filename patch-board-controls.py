from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

replacements = {
    "    if (!session) return;\n    if (annotationMode) {":
        "    if (!boardSession) return;\n    if (annotationMode) {",

    "Boolean(session?.flipped)":
        "Boolean(boardSession?.flipped)",

    'className={`chessboard ${session?.flipped ? "flipped" : ""} ${annotationMode ? "annotation-mode" : ""}`}':
        'className={`chessboard ${boardSession?.flipped ? "flipped" : ""} ${annotationMode ? "annotation-mode" : ""}`}',

    "session?.flipped ? 7 - visibleCol : visibleCol":
        "boardSession?.flipped ? 7 - visibleCol : visibleCol",

    "session?.flipped ? visibleRow : 7 - visibleRow":
        "boardSession?.flipped ? visibleRow : 7 - visibleRow",

    "session?.coordinates &&":
        "boardSession?.coordinates &&",

    'onClick={() => patchSession({ flipped: !session?.flipped })}':
        'onClick={() => patchBoardSession({ flipped: !boardSession?.flipped })}',

    "session?.moveIndex === row * 2 + 1":
        "boardSession?.moveIndex === row * 2 + 1",

    "session?.moveIndex === row * 2 + 2":
        "boardSession?.moveIndex === row * 2 + 2",
}

for old, new in replacements.items():
    count = s.count(old)
    if count == 0:
        print(f"NOT FOUND (left unchanged): {old}")
        continue
    s = s.replace(old, new)
    print(f"Updated {count} occurrence(s): {old[:75]}")

p.write_text(s, encoding="utf-8", newline="")
print("Board-controls patch written.")
