$ErrorActionPreference = "Stop"
Set-Location "D:\chess\BookChess\ChessBookReader"

$appPath = "src\App.tsx"
$cssPath = "src\styles.css"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$appBackup = "$appPath.before-analysis-workspace-$stamp.bak"
$cssBackup = "$cssPath.before-analysis-workspace-$stamp.bak"

Copy-Item $appPath $appBackup
Copy-Item $cssPath $cssBackup
Write-Host "Backups created:`n  $appBackup`n  $cssBackup" -ForegroundColor Green

$app = [System.IO.File]::ReadAllText((Resolve-Path $appPath))
$css = [System.IO.File]::ReadAllText((Resolve-Path $cssPath))

function Replace-Once([string]$Text, [string]$Old, [string]$New, [string]$Label) {
  $count = ([regex]::Matches($Text, [regex]::Escape($Old))).Count
  if ($count -ne 1) { throw "Expected exactly one anchor for '$Label'; found $count. No changes have been written." }
  return $Text.Replace($Old, $New)
}

try {
  $app = Replace-Once $app 'type LibraryTab = "all" | "recent";' 'type LibraryTab = "all" | "recent";' "library tab type"

  $oldState = @'
  const [studyMode, setStudyMode] = useState(false);
  const [studyBoard, setStudyBoard] = useState<StudyBoardState | null>(null);
'@
  $newState = @'
  const [studyMode, setStudyMode] = useState(false);
  const [studyBoard, setStudyBoard] = useState<StudyBoardState | null>(null);
  type WorkspaceMode = "library" | "analysis";
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("library");
  const [analysisBoard, setAnalysisBoard] = useState<StudyBoardState>({
    lineBaseFen: START_FEN,
    currentFen: START_FEN,
    moves: [],
    moveIndex: 0,
    flipped: false,
    coordinates: true,
  });
  const [analysisSavedPositions, setAnalysisSavedPositions] = useState<Array<{ id: string; title: string; fen: string; savedAt: number }>>(() => {
    try {
      const raw = window.localStorage.getItem("chessbook.analysis.savedPositions");
      return raw ? JSON.parse(raw) as Array<{ id: string; title: string; fen: string; savedAt: number }> : [];
    } catch { return []; }
  });
'@
  $app = Replace-Once $app $oldState $newState "independent analysis state"

  $app = Replace-Once $app 'const boardSession: StudyBoardState | null = studyMode ? studyBoard : session;' 'const boardSession: StudyBoardState | null = studyMode ? studyBoard : workspaceMode === "analysis" ? analysisBoard : session;' "board session routing"

  $oldPatch = @'
  function patchBoardSession(change: Partial<StudyBoardState>) {
    if (studyMode) setStudyBoard((current) => current ? { ...current, ...change } : current);
    else patchSession(change);
  }
'@
  $newPatch = @'
  function patchBoardSession(change: Partial<StudyBoardState>) {
    if (studyMode) {
      setStudyBoard((current) => current ? { ...current, ...change } : current);
    } else if (workspaceMode === "analysis") {
      setAnalysisBoard((current) => ({ ...current, ...change }));
    } else {
      patchSession(change);
    }
  }
'@
  $app = Replace-Once $app $oldPatch $newPatch "board patch routing"

  $oldLoad = @'
  function moveToPosition(fen: string): boolean {
    const activeSession = session ?? newSession("analysis");
    try {
      const next = new Chess(fen);
      setSession({
        ...activeSession,
        originalFen: fen,
        lineBaseFen: fen,
        currentFen: next.fen(),
        moves: [],
        moveIndex: 0,
      });
      setLastMove(null);
      setSelectedSquare(null);
      setUserArrows([]);
      setNotice("Position loaded. Reset Board returns to this diagram position.");
      return true;
    } catch (cause) {
      setError(`Invalid chess position: ${messageOf(cause)}`);
      return false;
    }
  }
'@
  $newLoad = @'
  function moveToPosition(fen: string): boolean {
    try {
      const next = new Chess(fen);
      const normalizedFen = next.fen();
      if (workspaceMode === "analysis") {
        setAnalysisBoard((current) => ({
          ...current,
          lineBaseFen: normalizedFen,
          currentFen: normalizedFen,
          moves: [],
          moveIndex: 0,
        }));
      } else {
        const activeSession = session ?? newSession("analysis");
        setSession({
          ...activeSession,
          originalFen: normalizedFen,
          lineBaseFen: normalizedFen,
          currentFen: normalizedFen,
          moves: [],
          moveIndex: 0,
        });
      }
      setLastMove(null);
      setSelectedSquare(null);
      setUserArrows([]);
      setNotice("Position loaded. Reset Board returns to this position.");
      return true;
    } catch (cause) {
      setError(`Invalid chess position: ${messageOf(cause)}`);
      return false;
    }
  }
'@
  $app = Replace-Once $app $oldLoad $newLoad "position loading routing"

  $oldSave = @'
  function savePosition() {
    if (!session) return;
    const position = {
      id: crypto.randomUUID(),
      title: `Page ${session.page} position`,
      fen: session.currentFen,
      page: session.page,
      savedAt: Date.now(),
    };
    patchSession((current) => ({ ...current, positions: [...current.positions, position] }));
    setNotice("Position saved to this book.");
  }
'@
  $newSave = @'
  function savePosition() {
    if (workspaceMode === "analysis" && !studyMode) {
      const position = {
        id: crypto.randomUUID(),
        title: `Analysis position ${analysisSavedPositions.length + 1}`,
        fen: analysisBoard.currentFen,
        savedAt: Date.now(),
      };
      setAnalysisSavedPositions((current) => {
        const next = [...current, position];
        try { window.localStorage.setItem("chessbook.analysis.savedPositions", JSON.stringify(next)); } catch { /* Storage may be unavailable. */ }
        return next;
      });
      setNotice("Position saved to Analysis Board.");
      return;
    }
    if (!session) return;
    const position = {
      id: crypto.randomUUID(),
      title: `Page ${session.page} position`,
      fen: session.currentFen,
      page: session.page,
      savedAt: Date.now(),
    };
    patchSession((current) => ({ ...current, positions: [...current.positions, position] }));
    setNotice("Position saved to this book.");
  }
'@
  $app = Replace-Once $app $oldSave $newSave "save position routing"

  $oldReset = @'
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
'@
  $newReset = @'
    } else if (workspaceMode === "analysis") {
      const original = new Chess(analysisBoard.lineBaseFen);
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
'@
  $app = Replace-Once $app $oldReset $newReset "reset routing"

  $oldNav = @'
            <nav className="library-nav" aria-label="Library sections">
                            <LibraryNavItem active={libraryTab === "all"} icon={BookOpenText} label="All Books" onClick={() => setLibraryTab("all")} />
              <LibraryNavItem active={libraryTab === "recent"} icon={History} label="Recently Opened" onClick={() => setLibraryTab("recent")} />
            </nav>
'@
  $newNav = @'
            <nav className="library-nav" aria-label="Library sections">
              <LibraryNavItem active={workspaceMode === "library" && libraryTab === "all"} icon={BookOpenText} label="All Books" onClick={() => { setWorkspaceMode("library"); setLibraryTab("all"); setStudyMode(false); }} />
              <LibraryNavItem active={workspaceMode === "library" && libraryTab === "recent"} icon={History} label="Recently Opened" onClick={() => { setWorkspaceMode("library"); setLibraryTab("recent"); setStudyMode(false); }} />
              <LibraryNavItem active={workspaceMode === "analysis"} icon={LayoutDashboard} label="Analysis Board" onClick={() => { setWorkspaceMode("analysis"); setStudyMode(false); setLastMove(null); setSelectedSquare(null); setError(""); }} />
            </nav>
'@
  $app = Replace-Once $app $oldNav $newNav "sidebar navigation"

  $app = Replace-Once $app '<div className={`workspace ${libraryOpen ? "" : "library-collapsed"}'} '<div className={`workspace ${libraryOpen ? "" : "library-collapsed"} ${workspaceMode === "analysis" ? "analysis-workspace" : ""}'} "workspace class" 

  $app = Replace-Once $app '<div className="library-list-title"><span>{libraryTab === "recent" ? "RECENTLY OPENED" : "ALL BOOKS"}</span><span>{visibleBooks.length}</span></div>' '<div className="library-list-title"><span>{libraryTab === "recent" ? "RECENTLY OPENED" : "ALL BOOKS"}</span><span>{visibleBooks.length}</span></div>' "library title anchor"

  $oldReader = '<section className="reader-panel" aria-label="PDF book reader">'
  $newReader = '{workspaceMode === "library" && <section className="reader-panel" aria-label="PDF book reader">'
  $app = Replace-Once $app $oldReader $newReader "reader conditional start"
  $oldReaderEnd = @'
        </section>
      </div>
'@
  $newReaderEnd = @'
        </section>}
      </div>
'@
  $app = Replace-Once $app $oldReaderEnd $newReaderEnd "reader conditional end"

  $oldHeader = '<div><strong className="analysis-title-text"><LayoutDashboard size={17} aria-hidden="true" />{session?.selectedDiagramId ? "Selected diagram" : "Analysis board"}</strong><span>{session?.selectedDiagramId ? `Page ${session.page} Â· ${session.selectedDiagramId.startsWith("manual-") ? "Manual region" : "Board candidate"}` : "Ready for a position"}</span></div>'
  $newHeader = '<div><strong className="analysis-title-text"><LayoutDashboard size={17} aria-hidden="true" />{workspaceMode === "analysis" ? "Analysis Board" : session?.selectedDiagramId ? "Selected diagram" : "Analysis board"}</strong><span>{workspaceMode === "analysis" ? "Independent analysis session" : session?.selectedDiagramId ? `Page ${session.page} · ${session.selectedDiagramId.startsWith("manual-") ? "Manual region" : "Board candidate"}` : "Ready for a position"}</span></div>'
  $app = Replace-Once $app $oldHeader $newHeader "board title"

  $app = Replace-Once $app '<button className="mini-button" onClick={() => void toggleStudyMode()} title="Toggle full-screen focus mode">{studyMode ? "Focus mode OFF" : "Focus mode ON"}</button>' '<button className="mini-button" disabled={workspaceMode === "analysis"} onClick={() => void toggleStudyMode()} title={workspaceMode === "analysis" ? "Focus mode is available in the book workspace" : "Toggle full-screen focus mode"}>{studyMode ? "Focus mode OFF" : "Focus mode ON"}</button>' "focus mode button"

  $cssAddition = @'

/* Independent Analysis Board workspace */
.workspace.analysis-workspace {
  grid-template-columns: minmax(190px, 220px) minmax(0, 1fr);
}
.workspace.analysis-workspace .board-panel {
  grid-column: 2;
  min-width: 0;
}
.workspace.analysis-workspace .library-panel {
  grid-column: 1;
}
'@
  if ($css.Contains("/* Independent Analysis Board workspace */")) { throw "Analysis workspace CSS marker already exists; refusing to apply twice." }
  $css += $cssAddition

  [System.IO.File]::WriteAllText((Resolve-Path $appPath), $app, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText((Resolve-Path $cssPath), $css, [System.Text.UTF8Encoding]::new($false))

  Write-Host "`nPatch applied. Running build and tests..." -ForegroundColor Green
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }
  npm test
  if ($LASTEXITCODE -ne 0) { throw "npm test failed." }

  Write-Host "`nAnalysis Board patch and verification completed." -ForegroundColor Green
  Write-Host "If the UI looks wrong, restore these backups:`n  Copy-Item '$appBackup' '$appPath' -Force`n  Copy-Item '$cssBackup' '$cssPath' -Force"
}
catch {
  Write-Host "`nPatch failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Restoring backups..." -ForegroundColor Yellow
  Copy-Item $appBackup $appPath -Force
  Copy-Item $cssBackup $cssPath -Force
  Write-Host "Original files restored. No partial patch remains." -ForegroundColor Green
  throw
}
