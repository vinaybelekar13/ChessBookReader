from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")
original = s

def replace_once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"STOP: {label}: expected one match, found {count}. No file written.")
    s = s.replace(old, new, 1)
    print("Prepared:", label)

replace_once(
    '  const [session, setSession] = useState<BookSession | null>(null);',
    '''  const [session, setSession] = useState<BookSession | null>(null);
  type StudyBoardState = Pick<BookSession, "lineBaseFen" | "currentFen" | "moves" | "moveIndex" | "flipped" | "coordinates">;
  const [studyMode, setStudyMode] = useState(false);
  const [studyBoard, setStudyBoard] = useState<StudyBoardState | null>(null);''',
    "independent study state"
)

replace_once(
'''  const game = useMemo(() => {
    if (!session) return new Chess();
    try {
      return makePosition(session.lineBaseFen, session.moves, session.moveIndex);
    } catch {
      try { return new Chess(session.currentFen); } catch { return new Chess(); }
    }
  }, [session]);''',
'''  const boardSession: StudyBoardState | null = studyMode ? studyBoard : session;
  const game = useMemo(() => {
    if (!boardSession) return new Chess();
    try {
      return makePosition(boardSession.lineBaseFen, boardSession.moves, boardSession.moveIndex);
    } catch {
      try { return new Chess(boardSession.currentFen); } catch { return new Chess(); }
    }
  }, [boardSession]);''',
    "active board position"
)

replace_once(
'''  const moveHistory = useMemo(() => {
    try { return makePosition(session?.lineBaseFen ?? START_FEN, session?.moves ?? [], session?.moveIndex ?? 0).history({ verbose: true }); }
    catch { return []; }
  }, [session]);''',
'''  const moveHistory = useMemo(() => {
    try { return makePosition(boardSession?.lineBaseFen ?? START_FEN, boardSession?.moves ?? [], boardSession?.moveIndex ?? 0).history({ verbose: true }); }
    catch { return []; }
  }, [boardSession]);''',
    "active board move history"
)

replace_once(
'''  function patchSession(change: Partial<BookSession> | ((current: BookSession) => BookSession)) {
    setSession((current) => {
      if (!current) return current;
      return typeof change === "function" ? change(current) : { ...current, ...change };
    });
  }''',
'''  function patchSession(change: Partial<BookSession> | ((current: BookSession) => BookSession)) {
    setSession((current) => {
      if (!current) return current;
      return typeof change === "function" ? change(current) : { ...current, ...change };
    });
  }

  function patchBoardSession(change: Partial<StudyBoardState>) {
    if (studyMode) setStudyBoard((current) => current ? { ...current, ...change } : current);
    else patchSession(change);
  }

  function toggleStudyMode() {
    if (!studyMode) {
      if (!session) {
        setError("Open a book before entering study mode.");
        return;
      }
      setStudyBoard({
        lineBaseFen: session.lineBaseFen,
        currentFen: session.currentFen,
        moves: [...session.moves],
        moveIndex: session.moveIndex,
        flipped: session.flipped,
        coordinates: session.coordinates,
      });
      setStudyMode(true);
    } else {
      setStudyMode(false);
    }
    setLastMove(null);
    setSelectedSquare(null);
    setPromotionRequest(null);
  }''',
    "separate board update helper"
)

if s == original:
    raise SystemExit("STOP: no changes prepared.")

backup = p.with_name("App.tsx.before-study-state.bak")
if backup.exists():
    from datetime import datetime
    backup = p.with_name("App.tsx.before-study-state-" + datetime.now().strftime("%Y%m%d-%H%M%S") + ".bak")
backup.write_text(original, encoding="utf-8")
p.write_text(s, encoding="utf-8", newline="")
print("Updated", p, "| backup:", backup)
