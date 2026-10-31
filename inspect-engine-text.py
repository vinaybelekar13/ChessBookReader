from pathlib import Path

lines = Path("src/App.tsx").read_text(encoding="utf-8").splitlines()

for n in range(1890, 1894):
    print(f"Line {n+1}: {lines[n]!r}")
    print("Unicode:", " ".join(f"U+{ord(c):04X}" for c in lines[n] if ord(c) > 127))
