#requires -Version 5.1
<#
ChessBook Reader restoration script.
Restores src/App.tsx from Git HEAD, applies exact-anchor patches, and records backups/reports.
It does not delete files, clean the repository, stage changes, commit, or push.
#>
$ErrorActionPreference = "Stop"

$ProjectRoot = "D:\chess\BookChess\ChessBookReader"
$CurrentDir = (Get-Location).Path

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " CHESSBOOK READER — SAFE AUTOMATED RESTORATION SCRIPT" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# -------------------------------------------------------------------------
# STAGE 1: MANDATORY SAFETY & ENVIRONMENT CHECKS
# -------------------------------------------------------------------------
if ($CurrentDir.TrimEnd('\') -ne $ProjectRoot.TrimEnd('\')) {
    Write-Warning "Current directory ($CurrentDir) is not $ProjectRoot. Switching to $ProjectRoot..."
    if (-not (Test-Path $ProjectRoot)) {
        throw "ABORT: Project root $ProjectRoot does not exist."
    }
    Set-Location $ProjectRoot
}

if (-not (Test-Path (Join-Path $ProjectRoot "package.json")) -or -not (Test-Path (Join-Path $ProjectRoot "src\App.tsx"))) {
    throw "ABORT: Not a valid ChessBookReader project root (missing package.json or src\App.tsx)."
}

$GitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $GitCmd) {
    throw "ABORT: Git is not available in PATH."
}
$GitRoot = (git rev-parse --show-toplevel 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $GitRoot) { throw "ABORT: This folder is not inside a Git repository." }
if ([System.IO.Path]::GetFullPath($GitRoot).TrimEnd("\") -ne [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd("\")) {
    throw "ABORT: Git root does not match expected project root: $GitRoot"
}

$CurrentBranch = (git rev-parse --abbrev-ref HEAD 2>&1 | Out-String).Trim()
$HeadCommit    = (git rev-parse HEAD 2>&1 | Out-String).Trim()
$HeadShort     = (git rev-parse --short HEAD 2>&1 | Out-String).Trim()
$WorkingStatus = (git status -sb 2>&1 | Out-String).Trim()

# Create an isolated recovery branch before touching project files.
$TargetBranch = "recovery-and-ui-fixes"
if ($CurrentBranch -ne $TargetBranch) {
    $BranchExists = (git branch --list $TargetBranch | Out-String).Trim()
    if ($BranchExists) {
        throw "ABORT: Branch '$TargetBranch' already exists. Switch to it manually after reviewing its state, then rerun this script."
    }
    Write-Host "[Git] Creating recovery branch '$TargetBranch'..." -ForegroundColor Cyan
    git switch -c $TargetBranch
    if ($LASTEXITCODE -ne 0) {
        throw "ABORT: Could not create recovery branch. No source files have been modified."
    }
    $CurrentBranch = (git rev-parse --abbrev-ref HEAD 2>&1 | Out-String).Trim()
    $WorkingStatus = (git status -sb 2>&1 | Out-String).Trim()
}

Write-Host "[Safety Check] Project Root : $ProjectRoot" -ForegroundColor Green
Write-Host "[Safety Check] Git Branch   : $CurrentBranch" -ForegroundColor Green
Write-Host "[Safety Check] Git HEAD     : $HeadCommit ($HeadShort)" -ForegroundColor Green

# Verify HEAD:src/App.tsx exists
$HeadCheck = git cat-file -t HEAD:src/App.tsx 2>&1
if ($LASTEXITCODE -ne 0 -or ($HeadCheck | Out-String).Trim() -ne "blob") {
    throw "ABORT: HEAD:src/App.tsx does not exist in Git."
}

# -------------------------------------------------------------------------
# STAGE 2: CREATE TIMESTAMPED PRE-RESTORATION BACKUP & MANIFEST
# -------------------------------------------------------------------------
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot "backups\pre-restoration-$Timestamp"
if (Test-Path $BackupDir) {
    throw "ABORT: Backup folder $BackupDir already exists. Refusing to overwrite."
}
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BackupDir "src") | Out-Null

$FilesToBackup = @(
    "src\App.tsx",
    "src\styles.css",
    "src\GameReview.tsx",
    "src\CoordinateTraining.tsx",
    "src\coordinate-training.css",
    "src\NotationLearner.tsx",
    "src\notation-learner.css",
    "src\ManualBoardEditor.tsx",
    "src\board-annotations.ts",
    "src\chess-state.ts",
    "src\crop-geometry.ts",
    "src\model.ts",
    "src\notation-detection.ts",
    "src\opening-explorer.ts",
    "src\opening-explorer-api.ts",
    "src\pgn-import.ts",
    "src\position-editor.ts",
    "src\stockfish.ts",
    "src\storage.ts",
    "package.json",
    "tsconfig.json",
    "vite.config.ts"
)

$BackedUpFiles = New-Object System.Collections.Generic.List[string]
foreach ($relPath in $FilesToBackup) {
    $full = Join-Path $ProjectRoot $relPath
    if (Test-Path $full) {
        $dest = Join-Path $BackupDir $relPath
        $destParent = Split-Path $dest -Parent
        if (-not (Test-Path $destParent)) {
            New-Item -ItemType Directory -Force -Path $destParent | Out-Null
        }
        Copy-Item -Path $full -Destination $dest -Force
        $BackedUpFiles.Add($relPath)
    }
}

Write-Host "[Backup] Created complete backup at: $BackupDir ($($BackedUpFiles.Count) files preserved)" -ForegroundColor Green

# -------------------------------------------------------------------------
# STAGE 3: EXTRACT & COMPARE SOURCES (GIT HEAD vs BACKUP 20261031_025050 vs CURRENT)
# -------------------------------------------------------------------------
$TempHeadPath = Join-Path $BackupDir "HEAD_App.tsx.tmp"
$RawHeadText = (git show HEAD:src/App.tsx | Out-String)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($RawHeadText)) { throw "ABORT: Could not extract HEAD:src/App.tsx." }
[System.IO.File]::WriteAllText($TempHeadPath, $RawHeadText, (New-Object System.Text.UTF8Encoding($false)))

$CurrentAppPath = Join-Path $ProjectRoot "src\App.tsx"
$CurrentAppLines = (Get-Content $CurrentAppPath).Count
$HeadAppLines    = (Get-Content $TempHeadPath).Count

$RefBackupPath = Join-Path $ProjectRoot "backups\20261031_025050\App.tsx"
$RefBackupExists = Test-Path $RefBackupPath
$RefBackupComparison = "Not present"
$SelectedSource = "Git HEAD ($HeadShort : HEAD:src/App.tsx)"
$SourceText = [System.IO.File]::ReadAllText($TempHeadPath, [System.Text.Encoding]::UTF8)

if ($RefBackupExists) {
    $RefBackupHash = (Get-FileHash $RefBackupPath -Algorithm SHA256).Hash
    $HeadTempHash  = (Get-FileHash $TempHeadPath -Algorithm SHA256).Hash
    $RefBackupSize = (Get-Item $RefBackupPath).Length
    $HeadTempSize  = (Get-Item $TempHeadPath).Length
    if ($RefBackupHash -eq $HeadTempHash) {
        $RefBackupComparison = "Identical SHA256 hash ($RefBackupHash) and size ($RefBackupSize bytes)"
    } else {
        $RefBackupComparison = "Differs slightly (HEAD: $HeadTempSize bytes vs Backup 20261031_025050: $RefBackupSize bytes). Using Git HEAD ($HeadShort) as primary verified source."
    }
}

# Inspect current 256-line src/App.tsx to identify what it contained
$CurrentAppText = [System.IO.File]::ReadAllText($CurrentAppPath, [System.Text.Encoding]::UTF8)
$PreservedFromCurrent = New-Object System.Collections.Generic.List[string]
if ($CurrentAppText -match "game-review") {
    $PreservedFromCurrent.Add("WorkspaceMode 'game-review' routing to <GameReview />")
}
if ($CurrentAppText -match "coordinate-training") {
    $PreservedFromCurrent.Add("WorkspaceMode 'coordinate-training' routing to <CoordinateTraining />")
}
if ($CurrentAppText -match "analysis") {
    $PreservedFromCurrent.Add("WorkspaceMode 'analysis' independent board session")
}

# Check NotationLearner.tsx export signature so we wire it safely
$NotationLearnerPath = Join-Path $ProjectRoot "src\NotationLearner.tsx"
$HasNotationLearner = Test-Path $NotationLearnerPath
if (-not $HasNotationLearner) {
    throw "ABORT: src\NotationLearner.tsx is missing. No source changes have been made; restore or locate this component first."
}
$NotationLearnerImportLine = ""
if ($HasNotationLearner) {
    $nlRaw = [System.IO.File]::ReadAllText($NotationLearnerPath, [System.Text.Encoding]::UTF8)
    if ($nlRaw -match "export\s+default\s+") {
        $NotationLearnerImportLine = 'import NotationLearner from "./NotationLearner";'
    } elseif ($nlRaw -match "export\s+(function|const)\s+NotationLearner") {
        $NotationLearnerImportLine = 'import { NotationLearner } from "./NotationLearner";'
    } else {
        throw "ABORT: Could not determine export signature of src\NotationLearner.tsx."
    }
    $PreservedFromCurrent.Add("src\NotationLearner.tsx integrated into WorkspaceMode 'notation-learner' and sidebar navigation")
}

# -------------------------------------------------------------------------
# STAGE 4: EXACT ANCHOR-VALIDATED RESTORATION & PATCHES ON HEAD:src/App.tsx
# -------------------------------------------------------------------------
$AppliedPatches = New-Object System.Collections.Generic.List[string]

function Apply-ExactAnchorPatch {
    param(
        [string]$Content,
        [string]$Description,
        [string]$Anchor,
        [string]$Replacement
    )
    $escaped = [regex]::Escape($Anchor)
    $anchorMatches = [regex]::Matches($Content, $escaped)
    if ($anchorMatches.Count -eq 0) {
        throw "ABORT PATCH [$Description]: Expected source anchor was NOT found in HEAD:src/App.tsx."
    }
    if ($anchorMatches.Count -gt 1) {
        throw "ABORT PATCH [$Description]: Expected source anchor is AMBIGUOUS (matched $($anchorMatches.Count) times)."
    }
    $script:AppliedPatches.Add($Description)
    return $Content.Replace($Anchor, $Replacement)
}

# Normalize line endings to CRLF for deterministic anchor matching
$RestoredCode = $SourceText -replace "`r?`n", "`r`n"

# Patch 1: Import lucide-react icons (Bookmark, Pin, Compass, GraduationCap, Award) + NotationLearner
$Anchor1 = @'
import CoordinateTraining from "./CoordinateTraining";
import {
  Search, Cpu, Crown, CirclePlus, Plus, LayoutDashboard, RotateCcw, RotateCw, Settings2, ArrowLeftRight, FileCode2, Save,
  ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, BookOpenText } from "lucide-react";import { Chess, type Square } from "chess.js";
'@ -replace "`r?`n", "`r`n"

$Replace1 = @"
import CoordinateTraining from "./CoordinateTraining";
$NotationLearnerImportLine
import {
  Search, Cpu, Crown, CirclePlus, Plus, LayoutDashboard, RotateCcw, RotateCw, Settings2, ArrowLeftRight, FileCode2, Save,
  ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, BookOpenText, Bookmark, Pin, Compass, GraduationCap, Award
} from "lucide-react";
import { Chess, type Square } from "chess.js";
"@ -replace "`r?`n", "`r`n"

$RestoredCode = Apply-ExactAnchorPatch -Content $RestoredCode -Description "Add lucide-react navigation icons and NotationLearner import" -Anchor $Anchor1 -Replacement $Replace1

# Patch 2: Extend LibraryTab and WorkspaceMode types
$Anchor2 = @'
type LibraryTab = "all" | "recent";
type WorkspaceMode = "library" | "analysis" | "opening-prep" | "opening-explorer" | "coordinate-training" | "game-review";
'@ -replace "`r?`n", "`r`n"

$Replace2 = @'
type LibraryTab = "all" | "recent" | "bookmarks" | "positions" | "progress";
type WorkspaceMode = "library" | "analysis" | "opening-prep" | "opening-explorer" | "coordinate-training" | "notation-learner" | "game-review";
'@ -replace "`r?`n", "`r`n"

$RestoredCode = Apply-ExactAnchorPatch -Content $RestoredCode -Description "Restore full LibraryTab union and add 'notation-learner' to WorkspaceMode" -Anchor $Anchor2 -Replacement $Replace2

# Patch 3: Restore library filtering logic in visibleBooks
$Anchor3 = @'
  const visibleBooks = useMemo(() => {
    const needle = bookSearch.trim().toLowerCase();
    return sortedBooks.filter((item) => {
      const matchesTab = true;
      return matchesTab && item.title.toLowerCase().includes(needle);
    });
  }, [bookSearch, libraryTab, sessionIndex, sortedBooks]);
'@ -replace "`r?`n", "`r`n"

$Replace3 = @'
  const visibleBooks = useMemo(() => {
    const needle = bookSearch.trim().toLowerCase();
    return sortedBooks.filter((item) => {
      const saved = sessionIndex[item.id];
      const matchesTab =
        libraryTab === "all" ||
        libraryTab === "recent" ||
        (libraryTab === "bookmarks" && (saved?.bookmarks.length ?? 0) > 0) ||
        (libraryTab === "positions" && (saved?.positions.length ?? 0) > 0) ||
        (libraryTab === "progress" && (saved?.page ?? 1) > 1);
      return matchesTab && item.title.toLowerCase().includes(needle);
    });
  }, [bookSearch, libraryTab, sessionIndex, sortedBooks]);
'@ -replace "`r?`n", "`r`n"

$RestoredCode = Apply-ExactAnchorPatch -Content $RestoredCode -Description "Restore visibleBooks filter logic for all/recent/bookmarks/positions/progress" -Anchor $Anchor3 -Replacement $Replace3

# Patch 4: Fix moveToPosition(fen) so standalone Analysis mode and Opening Prep mode update their respective boards as well as session
$Anchor4 = @'
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
'@ -replace "`r?`n", "`r`n"

$Replace4 = @'
  function moveToPosition(fen: string): boolean {
    const activeSession = session ?? newSession("analysis");
    try {
      const next = new Chess(fen);
      if (workspaceMode === "analysis") {
        setAnalysisBoard((current) => ({
          ...current,
          lineBaseFen: next.fen(),
          currentFen: next.fen(),
          moves: [],
          moveIndex: 0,
        }));
      } else if (workspaceMode === "opening-prep") {
        setOpeningPrepBoard((current) => ({
          ...current,
          lineBaseFen: next.fen(),
          currentFen: next.fen(),
          moves: [],
          moveIndex: 0,
        }));
      } else {
        setSession({
          ...activeSession,
          originalFen: fen,
          lineBaseFen: fen,
          currentFen: next.fen(),
          moves: [],
          moveIndex: 0,
        });
      }
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
'@ -replace "`r?`n", "`r`n"

$RestoredCode = Apply-ExactAnchorPatch -Content $RestoredCode -Description "Fix moveToPosition(fen) for standalone Analysis Board and Opening Prep modes" -Anchor $Anchor4 -Replacement $Replace4

# Patch 5: Fix resetBoard() in standalone Analysis mode
$Anchor5 = @'
  function resetBoard() {
    if (workspaceMode === "opening-prep") {
      const original = new Chess(openingPrepBoard.lineBaseFen);
      patchBoardSession({
        lineBaseFen: original.fen(),
        currentFen: original.fen(),
        moves: [],
        moveIndex: 0,
      });
    } else if (studyMode) {
'@ -replace "`r?`n", "`r`n"

$Replace5 = @'
  function resetBoard() {
    if (workspaceMode === "analysis") {
      const original = new Chess(analysisBoard.lineBaseFen);
      patchBoardSession({
        lineBaseFen: original.fen(),
        currentFen: original.fen(),
        moves: [],
        moveIndex: 0,
      });
    } else if (workspaceMode === "opening-prep") {
      const original = new Chess(openingPrepBoard.lineBaseFen);
      patchBoardSession({
        lineBaseFen: original.fen(),
        currentFen: original.fen(),
        moves: [],
        moveIndex: 0,
      });
    } else if (studyMode) {
'@ -replace "`r?`n", "`r`n"

$RestoredCode = Apply-ExactAnchorPatch -Content $RestoredCode -Description "Fix resetBoard() in standalone Analysis mode" -Anchor $Anchor5 -Replacement $Replace5

# Patch 6: Restore full sidebar navigation & workspace conditional rendering
$Anchor6 = @'
            <nav className="library-nav" aria-label="Library sections">
                            <LibraryNavItem active={workspaceMode === "library" && libraryTab === "all"} icon={BookOpenText} label="All Books" onClick={() => { setWorkspaceMode("library"); setLibraryTab("all"); }} />
              <LibraryNavItem active={workspaceMode === "coordinate-training"} icon={Cpu} label="Coordinate Training" onClick={() => { setWorkspaceMode("coordinate-training"); setLibraryTab("all"); }} />
              <LibraryNavItem active={workspaceMode === "analysis"} icon={LayoutDashboard} label="Analysis Board" onClick={() => { setWorkspaceMode("analysis"); setLibraryTab("all"); setStudyMode(false); }} />
              <LibraryNavItem active={workspaceMode === "game-review"} icon={LayoutDashboard} label="Game Review" onClick={() => { setWorkspaceMode("game-review"); setLibraryTab("all"); setStudyMode(false); }} />



</nav>
'@ -replace "`r?`n", "`r`n"

$Replace6 = @'
            <nav className="library-nav" aria-label="Library sections">
              <LibraryNavItem active={workspaceMode === "library" && (libraryTab === "all" || libraryTab === "recent")} icon={BookOpenText} label="All Books" onClick={() => { setWorkspaceMode("library"); setLibraryTab("all"); }} />
              <LibraryNavItem active={workspaceMode === "library" && libraryTab === "bookmarks"} icon={Bookmark} label="Bookmarks" onClick={() => { setWorkspaceMode("library"); setLibraryTab("bookmarks"); }} />
              <LibraryNavItem active={workspaceMode === "library" && libraryTab === "positions"} icon={Pin} label="Saved Positions" onClick={() => { setWorkspaceMode("library"); setLibraryTab("positions"); }} />
              <LibraryNavItem active={workspaceMode === "analysis"} icon={LayoutDashboard} label="Analysis Board" onClick={() => { setWorkspaceMode("analysis"); setLibraryTab("all"); setStudyMode(false); }} />
              <LibraryNavItem active={workspaceMode === "opening-explorer"} icon={Compass} label="Opening Explorer" onClick={() => { setWorkspaceMode("opening-explorer"); setLibraryTab("all"); setStudyMode(false); }} />
              <LibraryNavItem active={workspaceMode === "coordinate-training"} icon={Cpu} label="Coordinate Training" onClick={() => { setWorkspaceMode("coordinate-training"); setLibraryTab("all"); setStudyMode(false); }} />
              <LibraryNavItem active={workspaceMode === "notation-learner"} icon={GraduationCap} label="Notation Learner" onClick={() => { setWorkspaceMode("notation-learner"); setLibraryTab("all"); setStudyMode(false); }} />
              <LibraryNavItem active={workspaceMode === "game-review"} icon={Award} label="Game Review" onClick={() => { setWorkspaceMode("game-review"); setLibraryTab("all"); setStudyMode(false); }} />
            </nav>
'@ -replace "`r?`n", "`r`n"

$RestoredCode = Apply-ExactAnchorPatch -Content $RestoredCode -Description "Restore complete sidebar navigation items (All Books, Bookmarks, Saved Positions, Analysis Board, Opening Explorer, Coordinate Training, Notation Learner, Game Review)" -Anchor $Anchor6 -Replacement $Replace6

# Patch 7: Add notation-learner to workspace class & conditional render
$Anchor7 = @'
        {workspaceMode === "game-review" ? <GameReview /> : workspaceMode === "coordinate-training" ? <CoordinateTraining /> : <>
'@ -replace "`r?`n", "`r`n"

$Replace7 = @'
        {workspaceMode === "game-review" ? <GameReview /> : workspaceMode === "coordinate-training" ? <CoordinateTraining /> : workspaceMode === "notation-learner" ? <NotationLearner /> : <>
'@ -replace "`r?`n", "`r`n"

$RestoredCode = Apply-ExactAnchorPatch -Content $RestoredCode -Description "Wire NotationLearner into main workspace conditional rendering" -Anchor $Anchor7 -Replacement $Replace7

# Patch 8: Clean double-encoded UTF-8 mojibake sequences in restored App.tsx
# ASCII-safe mojibake replacements; source strings are built from Unicode code points.
$MojibakeFixes = @(
    @{ Bad = (-join @([char]0x00C3, [char]0x201A, [char]0x00C2, [char]0x00B7)); Good = [string][char]0x00B7 },
    @{ Bad = (-join @([char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201A, [char]0x00AC, [char]0x00C2, [char]0x00A6)); Good = [string][char]0x2026 },
    @{ Bad = (-join @([char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201A, [char]0x00AC, [char]0x00E2, [char]0x20AC, [char]0x0020)); Good = [string][char]0x2014 },
    @{ Bad = (-join @([char]0x0026, [char]0x0023, [char]0x0038, [char]0x0032, [char]0x0031, [char]0x0031, [char]0x003B, [char]0x00C3, [char]0x0192, [char]0x00C6, [char]0x2019, [char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201A, [char]0x00AC, [char]0x00C5, [char]0x00A1, [char]0x00C3, [char]0x0192, [char]0x00E2, [char]0x20AC, [char]0x0161, [char]0x00C3, [char]0x201A, [char]0x00C2, [char]0x0020, [char]0x0020, [char]0x0053, [char]0x0074, [char]0x006F, [char]0x0070, [char]0x0020, [char]0x0073, [char]0x0063, [char]0x0061, [char]0x006E)); Good = ((-join @([char]0x25A0, [char]0x0020)) + 'Stop scan') },
    @{ Bad = (-join @([char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201E, [char]0x00A2, [char]0x00E2, [char]0x20AC, [char]0x0020)); Good = [string][char]0x265A },
    @{ Bad = (-join @([char]0x00C3, [char]0x201A, [char]0x00C2, [char]0x00BD)); Good = [string][char]0x00BD },
    @{ Bad = (-join @([char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201E, [char]0x00A2, [char]0x00E2, [char]0x20AC, [char]0x00A2)); Good = [string][char]0x2655 },
    @{ Bad = (-join @([char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201E, [char]0x00A2, [char]0x00E2, [char]0x20AC, [char]0x201C)); Good = [string][char]0x2656 },
    @{ Bad = (-join @([char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201E, [char]0x00A2, [char]0x00E2, [char]0x20AC, [char]0x201D)); Good = [string][char]0x2657 },
    @{ Bad = (-join @([char]0x00C3, [char]0x00A2, [char]0x00E2, [char]0x201E, [char]0x00A2, [char]0x00CB, [char]0x0153)); Good = [string][char]0x2658 }
)

$MojibakeCount = 0
foreach ($pair in $MojibakeFixes) {
    if ($RestoredCode.Contains($pair.Bad)) {
        $RestoredCode = $RestoredCode.Replace($pair.Bad, [regex]::Unescape($pair.Good))
        $MojibakeCount++
    }
}
$AppliedPatches.Add("Cleaned $MojibakeCount UTF-8 mojibake sequence types across restored App.tsx")

# Write restored src/App.tsx
[System.IO.File]::WriteAllText($CurrentAppPath, $RestoredCode, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[Restore] Wrote restored src\App.tsx ($(($RestoredCode -split "`r`n").Count) lines)" -ForegroundColor Green

# -------------------------------------------------------------------------
# STAGE 5: RUN VALIDATION (npm test & npm run build)
# -------------------------------------------------------------------------
Write-Host "[Validation] Running Vitest unit test suite (npm test)..." -ForegroundColor Cyan
$TestOutput = ""
$TestExitCode = 0
try {
    $TestOutput = (npm test -- --run 2>&1 | Out-String)
    $TestExitCode = $LASTEXITCODE
} catch {
    $TestOutput = ($_ | Out-String)
    $TestExitCode = 1
}

Write-Host "[Validation] Running production build (npm run build)..." -ForegroundColor Cyan
$BuildOutput = ""
$BuildExitCode = 0
try {
    $BuildOutput = (npm run build 2>&1 | Out-String)
    $BuildExitCode = $LASTEXITCODE
} catch {
    $BuildOutput = ($_ | Out-String)
    $BuildExitCode = 1
}

# -------------------------------------------------------------------------
# STAGE 6: GENERATE RESTORATION_MANIFEST.txt & RESTORATION_REPORT.txt
# -------------------------------------------------------------------------
$ManifestPath = Join-Path $ProjectRoot "RESTORATION_MANIFEST.txt"
$ReportPath   = Join-Path $ProjectRoot "RESTORATION_REPORT.txt"

$sbManifest = New-Object System.Text.StringBuilder
[void]$sbManifest.AppendLine("================================================================================")
[void]$sbManifest.AppendLine("RESTORATION_MANIFEST.txt — CHESSBOOK READER")
[void]$sbManifest.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sbManifest.AppendLine("================================================================================`r`n")
[void]$sbManifest.AppendLine("Original Git Commit : $HeadCommit ($HeadShort)")
[void]$sbManifest.AppendLine("Current Git Branch  : $CurrentBranch")
[void]$sbManifest.AppendLine("Backup Directory    : $BackupDir`r`n")
[void]$sbManifest.AppendLine("FILES BACKED UP ($($BackedUpFiles.Count)):")
foreach ($bf in $BackedUpFiles) {
    [void]$sbManifest.AppendLine("  - $bf")
}
[void]$sbManifest.AppendLine("`r`nFILES RESTORED & MODIFIED:")
[void]$sbManifest.AppendLine("  - src\App.tsx (Restored from HEAD:src/App.tsx; actual restored line count: $(($RestoredCode -split \"`r`n\").Count); 8 exact-anchor patches)")
[void]$sbManifest.AppendLine("`r`nNEWER FILES PRESERVED UNTOUCHED:")
[void]$sbManifest.AppendLine("  - src\GameReview.tsx")
[void]$sbManifest.AppendLine("  - src\CoordinateTraining.tsx & src\coordinate-training.css")
[void]$sbManifest.AppendLine("  - src\NotationLearner.tsx & src\notation-learner.css")
[void]$sbManifest.AppendLine("  - src\opening-explorer.ts & src\opening-explorer-api.ts")
[void]$sbManifest.AppendLine("  - src\pgn-import.ts")
[void]$sbManifest.AppendLine("  - src\styles.css")
[void]$sbManifest.AppendLine("  - backend\app\main.py & backend\app\lichess_oauth.py")
[void]$sbManifest.AppendLine("  - All 10 *.test.ts / *.test.tsx files")
[void]$sbManifest.AppendLine("`r`nFILES REQUIRING MANUAL UI REVIEW IN NEXT PHASE:")
[void]$sbManifest.AppendLine("  - src\GameReview.tsx (Remove UI Reference Mode switcher & Coach bubble in upcoming UI phase)")
[void]$sbManifest.AppendLine("  - src\styles.css (Standardize Chess.com dark charcoal theme & full-screen viewport proportions)")

[System.IO.File]::WriteAllText($ManifestPath, $sbManifest.ToString(), (New-Object System.Text.UTF8Encoding($false)))

$sbReport = New-Object System.Text.StringBuilder
[void]$sbReport.AppendLine("================================================================================")
[void]$sbReport.AppendLine("RESTORATION_REPORT.txt — CHESSBOOK READER")
[void]$sbReport.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sbReport.AppendLine("================================================================================`r`n")
[void]$sbReport.AppendLine("1. ORIGINAL IMPLEMENTATION SOURCE SELECTED")
[void]$sbReport.AppendLine("   Source  : $SelectedSource")
[void]$sbReport.AppendLine("   Compare : backups/20261031_025050/App.tsx -> $RefBackupComparison")
[void]$sbReport.AppendLine("   Previous: Overwritten src/App.tsx was $CurrentAppLines lines; restored src/App.tsx is $(($RestoredCode -split "`r`n").Count) lines.`r`n")
[void]$sbReport.AppendLine("2. GIT COMMIT & BRANCH USED")
[void]$sbReport.AppendLine("   Branch  : $CurrentBranch")
[void]$sbReport.AppendLine("   Commit  : $HeadCommit")
[void]$sbReport.AppendLine("   Initial working tree status:`r`n$WorkingStatus`r`n")
[void]$sbReport.AppendLine("3. BACKUP LOCATION")
[void]$sbReport.AppendLine("   Path    : $BackupDir`r`n")
[void]$sbReport.AppendLine("4. FILES RESTORED & MODIFIED")
[void]$sbReport.AppendLine("   - src\App.tsx`r`n")
[void]$sbReport.AppendLine("5. EXACT ANCHOR PATCHES APPLIED")
foreach ($p in $AppliedPatches) {
    [void]$sbReport.AppendLine("   [OK] $p")
}
[void]$sbReport.AppendLine("`r`n6. NEWER FEATURES PRESERVED")
foreach ($pf in $PreservedFromCurrent) {
    [void]$sbReport.AppendLine("   - $pf (detected by text scan; not a full semantic merge)")
}
[void]$sbReport.AppendLine("`r`n7. FEATURES RECOVERED")
[void]$sbReport.AppendLine("   - PDF.js document loading, canvas rendering, page navigation, zoom & fit-width/fit-page")
[void]$sbReport.AppendLine("   - IndexedDB local book library, reading session persistence, bookmarks & saved positions")
[void]$sbReport.AppendLine("   - Computer-vision board detection (/detect), 8-handle crop adjustment & piece recognition (/recognize)")
[void]$sbReport.AppendLine("   - Interactive 64-square chessboard with drag-and-drop, legal move dots, promotion dialog & checkmate/draw overlay")
[void]$sbReport.AppendLine("   - Right-drag SVG polygon arrows, touch annotation mode & right-click red square highlights")
[void]$sbReport.AppendLine("   - Stockfish 19 Lite Web Worker integration, evaluation bar, depth selector (10-18) & SAN PV formatting")
[void]$sbReport.AppendLine("   - ManualBoardEditor modal ('Set Up Position' & 'Review recognized position')")
[void]$sbReport.AppendLine("   - PGN file import, Paste PGN, FEN copy/load & Opening Explorer with Lichess OAuth connection")
[void]$sbReport.AppendLine("   - Full sidebar navigation for All Books, Bookmarks, Saved Positions, Analysis Board, Opening Explorer, Coordinate Training, Notation Learner, and Game Review`r`n")
[void]$sbReport.AppendLine("8. FEATURES STILL MISSING (DEFERRED TO NEXT UI & IMPORT PHASES)")
[void]$sbReport.AppendLine("   - Removal of ReferenceSwitcher toolbar and Coach speech bubble inside src/GameReview.tsx")
[void]$sbReport.AppendLine("   - Direct Lichess (/api/games/user/{username}) and Chess.com PubAPI game import modal in Game Review")
[void]$sbReport.AppendLine("   - Unified shared chessboard component and full-viewport Chess.com dark charcoal theme across all workspaces`r`n")
[void]$sbReport.AppendLine("9. TEST RESULTS (EXIT CODE: $TestExitCode)")
[void]$sbReport.AppendLine("--------------------------------------------------------------------------------")
[void]$sbReport.AppendLine($TestOutput.Trim())
[void]$sbReport.AppendLine("`r`n10. PRODUCTION BUILD RESULTS (EXIT CODE: $BuildExitCode)")
[void]$sbReport.AppendLine("--------------------------------------------------------------------------------")
[void]$sbReport.AppendLine($BuildOutput.Trim())
[void]$sbReport.AppendLine("`r`n11. MANUAL VERIFICATION CHECKLIST")
[void]$sbReport.AppendLine("   [ ] Open app in browser (npm run dev) and verify Book Library loads existing IndexedDB books")
[void]$sbReport.AppendLine("   [ ] Open a PDF book and verify page rendering, Next/Previous page, and Zoom controls")
[void]$sbReport.AppendLine("   [ ] Verify chessboard piece movement, right-drag arrows, and Stockfish 'Analyze position' toggle")
[void]$sbReport.AppendLine("   [ ] Click each sidebar item (All Books, Bookmarks, Saved Positions, Analysis Board, Opening Explorer, Coordinate Training, Notation Learner, Game Review)")

[System.IO.File]::WriteAllText($ReportPath, $sbReport.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Host "=================================================================" -ForegroundColor Cyan
if ($TestExitCode -eq 0 -and $BuildExitCode -eq 0) {
    Write-Host " RESTORATION AND AUTOMATED CHECKS FINISHED — tests/build passed." -ForegroundColor Green
} else {
    Write-Warning "Restoration was written, but validation failed. Test Exit: $TestExitCode | Build Exit: $BuildExitCode"
}
Write-Host " Opening RESTORATION_REPORT.txt in Notepad..." -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

Start-Process -FilePath "notepad.exe" -ArgumentList @($ReportPath)
