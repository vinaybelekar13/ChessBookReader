from pathlib import Path
import re

ROOT = Path.cwd()

def patch(path, old, new, label):
    file = ROOT / path
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}. No replacement made in {path}.")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("PATCHED:", label)

# ------------------------------------------------------------
# 1. BACKEND: separate public Lichess Opening Explorer helper
# ------------------------------------------------------------

patch(
    "backend/app/lichess_oauth.py",
    "import os\n",
    "import os\nimport re\n",
    "Backend regex import",
)

backend_helper_anchor = '''    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Invalid response from Lichess Opening Explorer.")
    return data


@router.get("/status")'''

backend_helper = '''    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Invalid response from Lichess Opening Explorer.")
    return data


def _get_public_json(url: str) -> dict:
    """Fetch public Lichess Opening Explorer data without OAuth credentials."""
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Accept": "application/json",
            "User-Agent": "ChessBookReader/0.1",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read(2 * 1024 * 1024))
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise HTTPException(
                status_code=429,
                detail="Lichess rate limit reached. Try again shortly.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="Lichess Opening Explorer request failed.",
        ) from exc
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Lichess Opening Explorer is unavailable.",
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502,
            detail="Invalid response from Lichess Opening Explorer.",
        )
    return data


@router.get("/status")'''

patch(
    "backend/app/lichess_oauth.py",
    backend_helper_anchor,
    backend_helper,
    "Public Lichess HTTP helper",
)

backend_route_anchor = '''@router.get("/opening-explorer")
def opening_explorer(request: Request, variant: str = "standard",
                     moves: int = 8, play: str = ""):'''

backend_route = '''@router.get("/opening-explorer/public")
def public_opening_explorer(
    variant: str = "standard",
    moves: int = 8,
    play: str = "",
):
    """Public opening statistics for the Analysis Board; no OAuth session required."""
    if variant != "standard":
        raise HTTPException(status_code=400, detail="Only standard chess is supported.")
    if not 1 <= moves <= 15:
        raise HTTPException(status_code=400, detail="Moves must be between 1 and 15.")

    uci_moves = [move for move in play.split(",") if move]
    if len(uci_moves) > 200 or any(
        re.fullmatch(r"[a-h][1-8][a-h][1-8][qrbn]?", move) is None
        for move in uci_moves
    ):
        raise HTTPException(status_code=400, detail="Invalid move sequence.")

    query = urllib.parse.urlencode({
        "variant": variant,
        "moves": str(moves),
        "play": ",".join(uci_moves),
    })
    result = _get_public_json(LICHESS_EXPLORER + "?" + query)
    response = JSONResponse(result)
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/opening-explorer")
def opening_explorer(request: Request, variant: str = "standard",
                     moves: int = 8, play: str = ""):'''

patch(
    "backend/app/lichess_oauth.py",
    backend_route_anchor,
    backend_route,
    "Unauthenticated public statistics route",
)

# ------------------------------------------------------------
# 2. FRONTEND API: share parser, retain existing OAuth endpoint
# ------------------------------------------------------------

patch(
    "src/opening-explorer-api.ts",
    '''export async function fetchOpeningExplorerStats(
  uciMoves: string[],
  signal?: AbortSignal,
): Promise<OpeningExplorerStats> {
  const query = new URLSearchParams();''',
    '''async function fetchOpeningStatsFrom(
  endpoint: string,
  uciMoves: string[],
  signal?: AbortSignal,
): Promise<OpeningExplorerStats> {
  const query = new URLSearchParams();''',
    "Extract shared Opening Explorer fetcher",
)

patch(
    "src/opening-explorer-api.ts",
    '''    `/api/lichess/opening-explorer?${query.toString()}`,''',
    '''    `${endpoint}?${query.toString()}`,''',
    "Use supplied API endpoint",
)

api_anchor = '''  };
}

export type LichessConnectionStatus = {'''

api_replacement = '''  };
}

export function fetchOpeningExplorerStats(
  uciMoves: string[],
  signal?: AbortSignal,
): Promise<OpeningExplorerStats> {
  return fetchOpeningStatsFrom("/api/lichess/opening-explorer", uciMoves, signal);
}

export function fetchPublicOpeningExplorerStats(
  uciMoves: string[],
  signal?: AbortSignal,
): Promise<OpeningExplorerStats> {
  return fetchOpeningStatsFrom("/api/lichess/opening-explorer/public", uciMoves, signal);
}

export type LichessConnectionStatus = {'''

patch(
    "src/opening-explorer-api.ts",
    api_anchor,
    api_replacement,
    "Export authenticated and public fetch functions",
)

# ------------------------------------------------------------
# 3. APP: add separate Analysis Board statistics state
# ------------------------------------------------------------

patch(
    "src/App.tsx",
    '''import { fetchOpeningExplorerStats, getLichessConnectionStatus, disconnectLichess, type OpeningExplorerStats, type LichessConnectionStatus } from "./opening-explorer-api";''',
    '''import { fetchOpeningExplorerStats, fetchPublicOpeningExplorerStats, getLichessConnectionStatus, disconnectLichess, type OpeningExplorerStats, type LichessConnectionStatus } from "./opening-explorer-api";''',
    "Import public statistics function",
)

patch(
    "src/App.tsx",
    '''  const [openingStatsStatus, setOpeningStatsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [lichessStatus, setLichessStatus] = useState<LichessConnectionStatus | null>(null);''',
    '''  const [openingStatsStatus, setOpeningStatsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [analysisOpeningStats, setAnalysisOpeningStats] = useState<OpeningExplorerStats | null>(null);
  const [analysisOpeningStatsStatus, setAnalysisOpeningStatsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [lichessStatus, setLichessStatus] = useState<LichessConnectionStatus | null>(null);''',
    "Analysis Board statistics state",
)

# Derive UCI history from the Analysis Board's current move index.
analysis_effect_anchor = '''  }, [workspaceMode, openingPosition, openingExplorerPly, lichessStatus?.connected]);

  const boardSession: StudyBoardState | null ='''

analysis_effect_replacement = '''  }, [workspaceMode, openingPosition, openingExplorerPly, lichessStatus?.connected]);

  const analysisOpeningUciMoves = useMemo<string[] | null>(() => {
    if (analysisBoard.lineBaseFen !== START_FEN) return null;
    try {
      return makePosition(
        analysisBoard.lineBaseFen,
        analysisBoard.moves,
        analysisBoard.moveIndex,
      ).history({ verbose: true }).map((move) =>
        `${move.from}${move.to}${move.promotion ?? ""}`
      );
    } catch {
      return null;
    }
  }, [
    analysisBoard.lineBaseFen,
    analysisBoard.moves,
    analysisBoard.moveIndex,
  ]);

  useEffect(() => {
    if (workspaceMode !== "analysis") return;

    if (analysisOpeningUciMoves === null) {
      setAnalysisOpeningStats(null);
      setAnalysisOpeningStatsStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAnalysisOpeningStatsStatus("loading");
      fetchPublicOpeningExplorerStats(analysisOpeningUciMoves, controller.signal)
        .then((result) => {
          setAnalysisOpeningStats(result);
          setAnalysisOpeningStatsStatus("ready");
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setAnalysisOpeningStats(null);
            setAnalysisOpeningStatsStatus("error");
          }
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [workspaceMode, analysisOpeningUciMoves]);

  const boardSession: StudyBoardState | null ='''

patch(
    "src/App.tsx",
    analysis_effect_anchor,
    analysis_effect_replacement,
    "Automatic Analysis Board opening lookup",
)

# ------------------------------------------------------------
# 4. APP JSX: show opening statistics inside the Analysis Board
# ------------------------------------------------------------

jsx_anchor = '''          <div className="board-fen"><span>{game.fen()}</span><span>{boardSession?.moveIndex ? `MOVE ${boardSession.moveIndex}` : studyMode ? "STUDY POSITION" : "BOOK POSITION"}</span></div>
        </section>

        <section className="reader-panel" aria-label="PDF book reader">'''

jsx_replacement = '''          <div className="board-fen"><span>{game.fen()}</span><span>{boardSession?.moveIndex ? `MOVE ${boardSession.moveIndex}` : studyMode ? "STUDY POSITION" : "BOOK POSITION"}</span></div>

          {workspaceMode === "analysis" && (
            <section className="analysis-opening-stats opening-stats" aria-label="Analysis Board opening statistics" aria-live="polite">
              <div className="opening-stats-heading">
                <h4>Opening statistics</h4>
                <span>Source: <a href="https://lichess.org/analysis#explorer" target="_blank" rel="noreferrer">Lichess Opening Explorer</a></span>
              </div>

              {analysisOpeningUciMoves === null && (
                <p>Opening statistics are available for lines starting from the standard chess position. This board uses a custom starting position.</p>
              )}
              {analysisOpeningUciMoves !== null && analysisOpeningStatsStatus === "loading" && (
                <p>Loading game statistics…</p>
              )}
              {analysisOpeningUciMoves !== null && analysisOpeningStatsStatus === "error" && (
                <p role="status">Statistics are currently unavailable. The Analysis Board remains usable.</p>
              )}
              {analysisOpeningUciMoves !== null && analysisOpeningStatsStatus === "ready" && analysisOpeningStats && (
                <>
                  {analysisOpeningStats.opening && (
                    <p className="opening-stats-name">
                      {analysisOpeningStats.opening.eco ? `${analysisOpeningStats.opening.eco} · ` : ""}
                      {analysisOpeningStats.opening.name}
                    </p>
                  )}
                  <strong className="opening-stats-total">
                    {analysisOpeningStats.total.toLocaleString()} games in this dataset
                  </strong>
                  <div className="opening-result-bar" aria-label="White wins, draws and Black wins">
                    <span className="opening-result-white" style={{ width: `${analysisOpeningStats.total ? analysisOpeningStats.white / analysisOpeningStats.total * 100 : 0}%` }} />
                    <span className="opening-result-draw" style={{ width: `${analysisOpeningStats.total ? analysisOpeningStats.draws / analysisOpeningStats.total * 100 : 0}%` }} />
                    <span className="opening-result-black" style={{ width: `${analysisOpeningStats.total ? analysisOpeningStats.black / analysisOpeningStats.total * 100 : 0}%` }} />
                  </div>
                  <div className="opening-result-legend">
                    <span>White {analysisOpeningStats.white.toLocaleString()}</span>
                    <span>Draws {analysisOpeningStats.draws.toLocaleString()}</span>
                    <span>Black {analysisOpeningStats.black.toLocaleString()}</span>
                  </div>
                  <h5>Popular continuations</h5>
                  {analysisOpeningStats.moves.length ? (
                    <div className="opening-stat-moves">
                      {analysisOpeningStats.moves.slice(0, 8).map((move) => (
                        <div className="opening-stat-move" key={move.uci}>
                          <strong>{move.san}</strong>
                          <span>{(move.white + move.draws + move.black).toLocaleString()} games</span>
                          {move.opening && <small>{move.opening.name}</small>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No continuation data was returned for this position.</p>
                  )}
                  <p className="muted">Counts reflect Lichess's indexed dataset, not all chess games.</p>
                </>
              )}
            </section>
          )}
        </section>

        <section className="reader-panel" aria-label="PDF book reader">'''

patch(
    "src/App.tsx",
    jsx_anchor,
    jsx_replacement,
    "Analysis Board opening statistics panel",
)

# ------------------------------------------------------------
# 5. CSS: scoped styling only
# ------------------------------------------------------------

css_anchor = '''/* END CHESS.COM REVIEW WORKSPACE FOUNDATION */'''

css_replacement = '''/* END CHESS.COM REVIEW WORKSPACE FOUNDATION */

/* Analysis Board: compact Lichess opening statistics panel */
.workspace.analysis-board-active .analysis-opening-stats {
  width: 100%;
  box-sizing: border-box;
  margin: 14px 0 0;
  padding: 14px;
  color: var(--text, #eeeae2);
  background: var(--panel, #292a27);
  border: 1px solid var(--border, #484840);
  border-radius: 10px;
}

.workspace.analysis-board-active .analysis-opening-stats a {
  color: var(--green-primary, #a6d875);
}

.workspace.analysis-board-active .analysis-opening-stats .opening-stats-heading {
  align-items: center;
}

.workspace.analysis-board-active .analysis-opening-stats .opening-stat-move {
  background: var(--surface, #30312e);
}

.workspace.analysis-board-active .analysis-opening-stats .muted {
  color: var(--muted, #a4a69e);
}

@media (max-width: 700px) {
  .workspace.analysis-board-active .analysis-opening-stats {
    padding: 10px;
  }
}'''

patch(
    "src/styles.css",
    css_anchor,
    css_replacement,
    "Scoped Analysis Board statistics styling",
)

print("\\nAll source patches applied.")
