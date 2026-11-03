import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Search, Users, Crosshair, Bell } from "lucide-react";
import type {
  BoardArrowShape,
  BoardCircleShape,
  ChessVariant,
  EngineEvaluation,
  MoveNode,
  OpeningExplorerData,
  WikiBookArticle,
} from "./types";
import { WikiBookPanel } from "./WikiBookPanel";
import { ChessboardView } from "./ChessboardView";
import { EvaluationBar } from "./EvaluationBar";
import { EnginePanel } from "./EnginePanel";
import { MoveListPanel } from "./MoveListPanel";
import { OpeningExplorerModal } from "./OpeningExplorerModal";
import { BoardControlsBar } from "./BoardControlsBar";
import { ManualBoardEditor } from "../../ManualBoardEditor";
import { fetchLichessOpeningStats } from "./openingWikiData";
import { fetchWikibooksArticle } from "./wikibooksService";
import { identifyOpening } from "./openingDatabase";
import { formatLichessEval, LichessStockfishClient } from "./stockfishWorkerClient";
import "./lichess-analysis.css";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";


export interface LichessAnalysisBoardProps {
  showSiteHeader?: boolean;
  initialPgnMoves?: string[];
  stockfishWorkerPath?: string;
}

export const LichessAnalysisBoard: React.FC<LichessAnalysisBoardProps> = ({
  showSiteHeader = true,
  initialPgnMoves = [],
  stockfishWorkerPath = "/stockfish/stockfish-19-lite-single.js",
}) => {
  const [variant, setVariant] = useState<ChessVariant>("Standard");
  const [baseFen, setBaseFen] = useState<string>(START_FEN);
  const [moves, setMoves] = useState<MoveNode[]>(() => {
    const chess = new Chess(START_FEN);
    const list: MoveNode[] = [];
    initialPgnMoves.forEach((san, i) => {
      try {
        const res = chess.move(san);
        list.push({
          ply: i + 1,
          moveNumber: Math.floor(i / 2) + 1,
          color: res.color,
          san: res.san,
          uci: `${res.from}${res.to}${res.promotion ?? ""}`,
          from: res.from as Square,
          to: res.to as Square,
          fen: chess.fen(),
          evalFormatted: i === 0 ? "+0.2" : undefined,
          evalCp: i === 0 ? 20 : undefined,
        });
      } catch {
        // Ignore invalid initial move
      }
    });
    return list;
  });

  const [currentPly, setCurrentPly] = useState<number>(() => initialPgnMoves.length);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [engineEnabled, setEngineEnabled] = useState<boolean>(true);
  const [engineDepth, setEngineDepth] = useState<number>(70);
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const [evaluationFen, setEvaluationFen] = useState<string>("");
  const [showThreat, setShowThreat] = useState<boolean>(false);
  const [showEngineArrow, setShowEngineArrow] = useState<boolean>(true);

  const [userArrows, setUserArrows] = useState<BoardArrowShape[]>([]);
  const [userCircles, setUserCircles] = useState<BoardCircleShape[]>([]);

  const [wikiArticle, setWikiArticle] = useState<WikiBookArticle | null>(null);
  const [wikiLoading, setWikiLoading] = useState<boolean>(false);
  const [wikiError, setWikiError] = useState<string>("");
  const [explorerOpen, setExplorerOpen] = useState<boolean>(false);
  const [explorerData, setExplorerData] = useState<OpeningExplorerData | null>(null);
  const [explorerLoading, setExplorerLoading] = useState<boolean>(false);
  const [practiceMode, setPracticeMode] = useState<boolean>(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<boolean>(false);
  const [setupOpen, setSetupOpen] = useState<boolean>(false);

  const [fenDraft, setFenDraft] = useState<string>(START_FEN);
  const [pgnDraft, setPgnDraft] = useState<string>("");
  const [statusToast, setStatusToast] = useState<string>("");

  const engineClientRef = useRef<LichessStockfishClient | null>(null);

  const activeFen = useMemo(() => {
    if (currentPly === 0) return baseFen;
    return moves[currentPly - 1]?.fen ?? baseFen;
  }, [baseFen, moves, currentPly]);

  function handleAnalyzeManualPosition(fen: string) {
    try {
      const normalizedFen = new Chess(fen).fen();

      setBaseFen(normalizedFen);
      setMoves([]);
      setCurrentPly(0);

      setEvaluation(null);
      setEvaluationFen("");

      setUserArrows([]);
      setUserCircles([]);

      setExplorerOpen(false);
      setActionMenuOpen(false);
      setSetupOpen(false);

      setStatusToast("Custom position loaded. Stockfish analysis started.");
      window.setTimeout(() => setStatusToast(""), 2500);
    } catch {
      setStatusToast("Invalid chess position.");
      window.setTimeout(() => setStatusToast(""), 2500);
    }
  }

  const game = useMemo(() => {
    try {
      return new Chess(activeFen);
    } catch {
      return new Chess(START_FEN);
    }
  }, [activeFen]);

  const lastMove = useMemo(() => {
    if (currentPly === 0) return null;
    const node = moves[currentPly - 1];
    return node ? { from: node.from, to: node.to } : null;
  }, [moves, currentPly]);

  const activeSanHistory = useMemo(
    () => moves.slice(0, currentPly).map((m) => m.san),
    [moves, currentPly]
  );

  const selectedMoveEvaluation = currentPly > 0 ? moves[currentPly - 1] : null;

  const barEvaluation: EngineEvaluation | null = useMemo(() => {
    if (evaluationFen === activeFen && evaluation) return evaluation;

    if (selectedMoveEvaluation?.evalFormatted !== undefined) {
      return {
        cp: selectedMoveEvaluation.evalCp ?? null,
        mate: selectedMoveEvaluation.evalMate ?? null,
        depth: 0,
        maxDepth: 0,
        knodes: 0,
        bestMoveUci: "",
        pvUci: [],
        pvSan: [],
        isCloud: false,
      };
    }

    return null;
  }, [evaluationFen, activeFen, evaluation, selectedMoveEvaluation]);
  const activeHistoryKey = activeSanHistory.join("\u001f");

  useEffect(() => {
    const controller = new AbortController();
    const sanHistory = activeHistoryKey ? activeHistoryKey.split("\u001f") : [];

    setWikiError("");

    if (sanHistory.length === 0) {
      setWikiArticle(null);
      setWikiLoading(false);
      return () => controller.abort();
    }

    setWikiLoading(true);

    fetchWikibooksArticle(sanHistory, controller.signal)
      .then((article) => {
        if (!controller.signal.aborted) setWikiArticle(article);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setWikiError(
          error instanceof Error
            ? error.message
            : "Could not retrieve the Wikibooks article."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setWikiLoading(false);
      });

    return () => controller.abort();
  }, [activeHistoryKey]);
  const formattedPgnString = useMemo(() => {
    if (moves.length === 0) return "";
    const parts: string[] = [];
    moves.forEach((m, idx) => {
      if (m.color === "w") {
        parts.push(`${m.moveNumber}. ${m.san}`);
      } else if (idx === 0) {
        parts.push(`${m.moveNumber}... ${m.san}`);
      } else {
        parts.push(m.san);
      }
    });
    return parts.join(" ");
  }, [moves]);

  useEffect(() => {
    setFenDraft(activeFen);
  }, [activeFen]);

  useEffect(() => {
    setPgnDraft(formattedPgnString);
  }, [formattedPgnString]);

  // Initialize Stockfish client.
  // The active move evaluation is updated by the separate effect below.
  useEffect(() => {
    const client = new LichessStockfishClient(stockfishWorkerPath, (ev, fen) => {
      setEvaluation(ev);
      setEvaluationFen(fen);
    });
    engineClientRef.current = client;
    return () => client.dispose();
  }, [stockfishWorkerPath]);

  useEffect(() => {
    if (!engineEnabled) {
      engineClientRef.current?.stop();
      return;
    }
    setEvaluationFen(activeFen);
    engineClientRef.current?.analyze(activeFen, engineDepth);
  }, [engineEnabled, activeFen, engineDepth]);

  useEffect(() => {
    if (!engineEnabled || !evaluation || evaluationFen !== activeFen || currentPly === 0) return;
    const formatted = formatLichessEval(evaluation);

    setMoves((prev) => {
      const index = currentPly - 1;
      const node = prev[index];

      if (!node) return prev;
      if (
        node.evalFormatted === formatted &&
        node.evalCp === evaluation.cp &&
        node.evalMate === evaluation.mate
      ) {
        return prev;
      }

      const next = [...prev];
      next[index] = {
        ...node,
        evalFormatted: formatted,
        evalCp: evaluation.cp,
        evalMate: evaluation.mate,
      };
      return next;
    });
  }, [evaluation, evaluationFen, activeFen, engineEnabled, currentPly]);

  useEffect(() => {
    if (!explorerOpen) return;

    const controller = new AbortController();
    const sanHistory = activeHistoryKey ? activeHistoryKey.split("\u001f") : [];

    setExplorerLoading(true);

    fetchLichessOpeningStats(activeFen, sanHistory, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setExplorerData(res);
        setExplorerLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setExplorerLoading(false);
      });

    return () => controller.abort();
  }, [explorerOpen, activeFen, activeHistoryKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPly((p) => Math.min(moves.length, p + 1));
      } else if (e.key === "ArrowUp" || e.key === "Home") {
        e.preventDefault();
        setCurrentPly(0);
      } else if (e.key === "ArrowDown" || e.key === "End") {
        e.preventDefault();
        setCurrentPly(moves.length);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExplorerOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moves.length]);

  const handleMakeMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n"): boolean => {
    try {
      const nextGame = new Chess(activeFen);
      const res = nextGame.move({ from, to, ...(promotion ? { promotion } : {}) });
      const truncated = moves.slice(0, currentPly);
      const nextPly = truncated.length + 1;
      const moveNumber =
        res.color === "w"
          ? Math.floor(truncated.length / 2) + 1
          : truncated[truncated.length - 1]?.moveNumber ?? 1;

      const newNode: MoveNode = {
        ply: nextPly,
        moveNumber,
        color: res.color,
        san: res.san,
        uci: `${res.from}${res.to}${res.promotion ?? ""}`,
        from: res.from as Square,
        to: res.to as Square,
        fen: nextGame.fen(),
      };

      const updatedMoves = [...truncated, newNode];
      setMoves(updatedMoves);
      setCurrentPly(nextPly);
      setUserArrows([]);
      setUserCircles([]);

      if (practiceMode && !nextGame.isGameOver()) {
        window.setTimeout(() => {
          const replyGame = new Chess(nextGame.fen());
          const legal = replyGame.moves({ verbose: true });
          if (legal.length > 0) {
            const pick = legal[0];
            const replyRes = replyGame.move(pick);
            const replyPly = nextPly + 1;
            const replyMoveNumber =
              replyRes.color === "w" ? moveNumber + 1 : moveNumber;
            setMoves((curr) => [
              ...curr,
              {
                ply: replyPly,
                moveNumber: replyMoveNumber,
                color: replyRes.color,
                san: replyRes.san,
                uci: `${replyRes.from}${replyRes.to}${replyRes.promotion ?? ""}`,
                from: replyRes.from as Square,
                to: replyRes.to as Square,
                fen: replyGame.fen(),
              },
            ]);
            setCurrentPly(replyPly);
          }
        }, 350);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handlePlayUciMove = (uci: string) => {
    if (uci.length < 4) return;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promo = uci[4] as "q" | "r" | "b" | "n" | undefined;
    handleMakeMove(from, to, promo);
  };

  const handleApplyFen = (fenText: string) => {
    const trimmed = fenText.trim();
    try {
      const parsed = new Chess(trimmed);
      setBaseFen(parsed.fen());
      setMoves([]);
      setCurrentPly(0);
      setUserArrows([]);
      setUserCircles([]);
      setStatusToast("Loaded custom FEN position");
      window.setTimeout(() => setStatusToast(""), 2400);
    } catch {
      setStatusToast("Invalid FEN string");
      window.setTimeout(() => setStatusToast(""), 2400);
    }
  };

  const handleApplyPgn = (pgnText: string) => {
    const trimmed = pgnText.trim();
    if (!trimmed) {
      setBaseFen(START_FEN);
      setMoves([]);
      setCurrentPly(0);
      return;
    }
    try {
      const parser = new Chess();
      parser.loadPgn(trimmed);
      const history = parser.history({ verbose: true });
      const replay = new Chess(START_FEN);
      const built: MoveNode[] = [];
      history.forEach((h, i) => {
        replay.move(h);
        built.push({
          ply: i + 1,
          moveNumber: Math.floor(i / 2) + 1,
          color: h.color,
          san: h.san,
          uci: `${h.from}${h.to}${h.promotion ?? ""}`,
          from: h.from as Square,
          to: h.to as Square,
          fen: replay.fen(),
        });
      });
      setBaseFen(START_FEN);
      setMoves(built);
      setCurrentPly(built.length);
      setStatusToast(`Loaded PGN (${built.length} plies)`);
      window.setTimeout(() => setStatusToast(""), 2400);
    } catch {
      setStatusToast("Could not parse PGN");
      window.setTimeout(() => setStatusToast(""), 2400);
    }
  };
const identifiedOpening = useMemo(
    () => identifyOpening(activeSanHistory),
    [activeSanHistory]
  );

  return (
    <div className="li-analysis-root">
      {showSiteHeader && (
        <header className="li-site-header">
          <div className="li-site-header-left">
            <a href="#analysis" className="li-brand-logo" onClick={(e) => e.preventDefault()}>
              <svg viewBox="0 0 50 50" width="28" height="28" className="li-knight-logo">
                <circle cx="25" cy="25" r="22" fill="none" stroke="#bababa" strokeWidth="3.2" />
                <path
                  d="M18 36c1-8 9-10 8-19 0 0-5 4-8 2-2-1 2-6 5-8 3-2 9-1 12 4 3 5 3 13 2 21H18z"
                  fill="#bababa"
                />
              </svg>
              <span className="li-brand-text">
                lichess<span>.org</span>
              </span>
            </a>

            <nav className="li-site-nav" aria-label="Main navigation">
              <a href="#play" onClick={(e) => e.preventDefault()}>PLAY</a>
              <a href="#puzzles" onClick={(e) => e.preventDefault()}>PUZZLES</a>
              <a href="#learn" onClick={(e) => e.preventDefault()}>LEARN</a>
              <a href="#watch" onClick={(e) => e.preventDefault()}>WATCH</a>
              <a href="#community" onClick={(e) => e.preventDefault()}>COMMUNITY</a>
              <a href="#tools" className="active" onClick={(e) => e.preventDefault()}>TOOLS</a>
              <a href="#donate" className="li-donate-link" onClick={(e) => e.preventDefault()}>
                <span className="li-wing-icon">ðŸª½</span> DONATE
              </a>
            </nav>
          </div>

          <div className="li-site-header-right">
            <button type="button" className="li-header-icon-btn" aria-label="Search">
              <Search size={18} />
            </button>
            <button type="button" className="li-header-icon-btn" aria-label="Friends">
              <Users size={18} />
            </button>
            <button type="button" className="li-header-icon-btn" aria-label="Challenges">
              <Crosshair size={18} />
            </button>
            <button type="button" className="li-header-icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <span className="li-user-tag">Vinayayayay</span>
            <span className="li-user-avatar" aria-hidden="true">â—</span>
          </div>
        </header>
      )}

      <main className="li-analyse-grid">
        <WikiBookPanel
          variant={variant}
          onVariantChange={setVariant}
          wikiArticle={wikiArticle}
          wikiLoading={wikiLoading}
          wikiError={wikiError}
          identifiedOpening={identifiedOpening}
          hasPlayedMoves={activeSanHistory.length > 0}
          onSelectOpening={(opening) => handleApplyPgn(opening.pgn)}
        />

        <section className="li-center-column" aria-label="Chessboard and FEN/PGN">
          <ChessboardView
            game={game}
            flipped={flipped}
            lastMove={lastMove}
            engineBestMoveUci={engineEnabled ? evaluation?.bestMoveUci ?? null : null}
            threatMoveUci={engineEnabled ? evaluation?.threatMoveUci ?? null : null}
            showEngineArrow={engineEnabled && showEngineArrow}
            showThreatArrow={engineEnabled && showThreat}
            userArrows={userArrows}
            userCircles={userCircles}
            onMakeMove={handleMakeMove}
            onToggleUserArrow={(arrow) =>
              setUserArrows((prev) => {
                const exists = prev.some(
                  (a) => a.from === arrow.from && a.to === arrow.to && a.brush === arrow.brush
                );
                return exists
                  ? prev.filter(
                      (a) => !(a.from === arrow.from && a.to === arrow.to && a.brush === arrow.brush)
                    )
                  : [...prev, arrow];
              })
            }
            onToggleUserCircle={(circle) =>
              setUserCircles((prev) => {
                const exists = prev.some(
                  (c) => c.square === circle.square && c.brush === circle.brush
                );
                return exists
                  ? prev.filter((c) => !(c.square === circle.square && c.brush === circle.brush))
                  : [...prev, circle];
              })
            }
            onClearUserShapes={() => {
              setUserArrows([]);
              setUserCircles([]);
            }}
          />

          <div className="li-underboard">
            <div className="li-fen-pgn-row">
              <label htmlFor="li-fen-input" className="li-fen-pgn-label">
                FEN
              </label>
              <input
                id="li-fen-input"
                type="text"
                className="li-fen-input"
                value={fenDraft}
                onChange={(e) => setFenDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyFen(fenDraft);
                }}
                onBlur={() => {
                  if (fenDraft.trim() !== activeFen) handleApplyFen(fenDraft);
                }}
                spellCheck={false}
              />
            </div>

            <div className="li-fen-pgn-row li-pgn-row">
              <label htmlFor="li-pgn-input" className="li-fen-pgn-label">
                PGN
              </label>
              <textarea
                id="li-pgn-input"
                className="li-pgn-textarea"
                rows={2}
                value={pgnDraft}
                onChange={(e) => setPgnDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleApplyPgn(pgnDraft);
                  }
                }}
                onBlur={() => {
                  if (pgnDraft.trim() !== formattedPgnString) {
                    handleApplyPgn(pgnDraft);
                  }
                }}
                spellCheck={false}
              />
            </div>
          </div>
        </section>

        <EvaluationBar
          evaluation={barEvaluation}
          enabled={engineEnabled}
          flipped={flipped}
        />

        <aside className="li-right-column" aria-label="Engine evaluation and move tree">
          <div className="li-tools-card">
            <EnginePanel
              enabled={engineEnabled}
              onToggleEnabled={() => setEngineEnabled((e) => !e)}
              evaluation={evaluation}
              depth={engineDepth}
              onChangeDepth={setEngineDepth}
              showThreat={showThreat}
              onToggleThreat={() => setShowThreat((t) => !t)}
              currentTurn={game.turn()}
              currentMoveNumber={moves[currentPly - 1]?.moveNumber ?? 1}
              onPlayPvFirstMove={handlePlayUciMove}
            />



            <MoveListPanel
              moves={moves}
              currentPly={currentPly}
              onSelectPly={setCurrentPly}
            />
            {explorerOpen && (
              <OpeningExplorerModal
                data={explorerData}
                loading={explorerLoading}
                recognisedOpening={identifiedOpening}
                onPlayUciMove={handlePlayUciMove}
              />
            )}

            {actionMenuOpen && (
              <div className="li-action-menu-drawer">
                <button
                  type="button"
                  onClick={() => {
                    setFlipped((f) => !f);
                    setActionMenuOpen(false);
                  }}
                >
                  Flip board (f)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEngineArrow((a) => !a);
                    setActionMenuOpen(false);
                  }}
                >
                  {showEngineArrow ? "Hide best move arrow" : "Show best move arrow"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBaseFen(START_FEN);
                    setMoves([]);
                    setCurrentPly(0);
                    setActionMenuOpen(false);
                  }}
                >
                  Reset to starting position
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(activeFen);
                    setStatusToast("FEN copied to clipboard");
                    window.setTimeout(() => setStatusToast(""), 2000);
                    setActionMenuOpen(false);
                  }}
                >
                  Copy FEN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(formattedPgnString);
                    setStatusToast("PGN copied to clipboard");
                    window.setTimeout(() => setStatusToast(""), 2000);
                    setActionMenuOpen(false);
                  }}
                >
                  Copy PGN
                </button>
              </div>
            )}
          </div>

          <BoardControlsBar
            explorerOpen={explorerOpen}
            onToggleExplorer={() => setExplorerOpen((o) => !o)}
            practiceMode={practiceMode}
            onTogglePractice={() => setPracticeMode((p) => !p)}
            onSetupPosition={() => {
              setActionMenuOpen(false);
              setSetupOpen(true);
            }}
            canGoBack={currentPly > 0}
            canGoForward={currentPly < moves.length}
            onFirst={() => setCurrentPly(0)}
            onPrev={() => setCurrentPly((p) => Math.max(0, p - 1))}
            onNext={() => setCurrentPly((p) => Math.min(moves.length, p + 1))}
            onLast={() => setCurrentPly(moves.length)}
            menuOpen={actionMenuOpen}
            onToggleMenu={() => setActionMenuOpen((m) => !m)}
          />
        </aside>
      </main>

      {setupOpen && (
        <ManualBoardEditor
          initialFen={activeFen}
          currentAnalysisFen={activeFen}
          title="Set Up Position"
          subtitle="Create a custom chess position and analyze it with Stockfish."
          confirmLabel="Analyze Position"
          showPresets={true}
          onConfirm={handleAnalyzeManualPosition}
          onCancel={() => setSetupOpen(false)}
        />
      )}

      {statusToast && (
        <div className="li-toast" role="status">
          {statusToast}
        </div>
      )}
    </div>
  );
};

export default LichessAnalysisBoard;





