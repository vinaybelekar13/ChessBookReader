from pathlib import Path
from datetime import datetime

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")
original = s

def replace_block(start_marker, end_marker, transform, label):
    global s
    start = s.index(start_marker)
    end = s.index(end_marker, start)
    block = s[start:end]
    updated = transform(block)
    if updated == block:
        raise SystemExit(f"STOP: no changes made to {label}")
    s = s[:start] + updated + s[end:]
    print("Fixed:", label)

def fix_promotion(block):
    block = block.replace(
        '    const activeBoard = boardSession;\n',
        '',
        1
    )
    marker = '    if (!promotionRequest || !boardSession) return;'
    if marker not in block:
        raise SystemExit("Promotion guard not found.")
    block = block.replace(
        marker,
        marker + '\n    const activeBoard = boardSession;',
        1
    )
    return block

def fix_move(block):
    marker = '    if (!boardSession) return;'
    if marker not in block:
        raise SystemExit("Move guard not found.")
    block = block.replace(
        marker,
        marker + '\n    const activeBoard = boardSession;',
        1
    )
    return block

replace_block(
    '  function completePromotion(',
    '  function makeMove(',
    fix_promotion,
    "promotion handler"
)

replace_block(
    '  function makeMove(',
    '  function handleSquareClick(',
    fix_move,
    "normal move handler"
)

if s == original:
    raise SystemExit("STOP: source unchanged.")

backup = p.with_name("App.tsx.null-fix-" + datetime.now().strftime("%Y%m%d-%H%M%S") + ".bak")
backup.write_text(original, encoding="utf-8")
p.write_text(s, encoding="utf-8", newline="")
print("Backup:", backup)
