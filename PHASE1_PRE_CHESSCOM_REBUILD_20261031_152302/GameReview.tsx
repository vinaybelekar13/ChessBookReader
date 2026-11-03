import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  ArrowLeft, ArrowRight, BarChart3, FileUp, LoaderCircle,
  Pause, Play, RotateCcw, Target, Trophy, X
} from "lucide-react";
import { reconstructReviewGame, getReviewFenAtPly, type ReviewGame } from "./review-pgn";
import { ReviewEngine, type ReviewProgress } from "./review-engine";
import { analyzeReviewPositions, type ReviewAnalysis, type ReviewedMove } from "./review-analysis";

type ReviewTab = "overview" | "moves";
type MoveFilter = "All" | "Best" | "Excellent" | "Good" | "Inaccuracy" | "Mistake" | "Blunder";

const FILTERS: MoveFilter[] = ["All", "Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Blunder"];

function evaluationText(score?: { kind: "cp" | "mate"; value: number }) {
  if (!score) return "—";
  if (score.kind === "mate") return `${score.value > 0 ? "+" : ""}#${Math.abs(score.value)}`;
  const value = score.value / 100;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function resultText(result?: string) {
  if (result === "1-0") return "White won";
  if (result === "0-1") return "Black won";
  if (result === "1/2-1/2") return "Draw";
  return "Result not recorded";
}

function metadata(value?: string) {
  return value && value !== "?" && value !== "*" ? value : "";
}

function classificationClass(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

export function GameReview() {
  const [pgnText, setPgnText] = useState("");
  const [review, setReview] = useState<ReviewGame | null>(null);
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [activePly, setActivePly] = useState(0);
  const [tab, setTab] = useState<ReviewTab>("overview");
  const [filter, setFilter] = useState<MoveFilter>("All");
  const [depth, setDepth] = useState(14);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [status, setStatus] = useState<"empty" | "ready" | "running" | "complete" | "error">("empty");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const engineRef = useRef<ReviewEngine | null>(null);
  const runToken = useRef(0);

  useEffect(() => {
    return () => {
      runToken.current += 1;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  function loadPgn(text: string) {
    try {
      const parsed = reconstructReviewGame(text);
      runToken.current += 1;
      engineRef.current?.dispose();
      engineRef.current = null;
      setPgnText(text);
      setReview(parsed);
      setAnalysis(null);
      setActivePly(0);
      setProgress(null);
      setError("");
      setStatus("ready");
      setTab("overview");
      setFilter("All");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read this PGN.");
      setStatus("error");
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      loadPgn(text);
    } catch {
      setError("Unable to read the selected PGN file.");
      setStatus("error");
    }
  }

  async function startAnalysis() {
    if (!review || status === "running") return;

    const token = ++runToken.current;
    engineRef.current?.dispose();
    engineRef.current = null;
    setAnalysis(null);
    setProgress({ completed: 0, total: review.positions.length + 1, currentPly: 0 });
    setError("");
    setStatus("running");

    try {
      const workerUrl = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`;
      const engine = new ReviewEngine(workerUrl);
      engineRef.current = engine;

      const result = await analyzeReviewPositions(review, engine, {
        depth,
        onProgress: value => {
          if (runToken.current === token) setProgress(value);
        }
      });

      if (runToken.current !== token) return;
      setAnalysis(result);
      setStatus("complete");
      setProgress(null);
      engine.dispose();
      engineRef.current = null;
    } catch (cause) {
      if (runToken.current !== token) return;
      engineRef.current = null;
      const message = cause instanceof Error ? cause.message : "Stockfish analysis failed.";
      if (/cancelled|disposed/i.test(message)) {
        setStatus("ready");
      } else {
        setStatus("error");
        setError(message);
      }
      setProgress(null);
    }
  }

  function cancelAnalysis() {
    runToken.current += 1;
    engineRef.current?.cancel();
    engineRef.current = null;
    setProgress(null);
    setStatus(review ? "ready" : "empty");
  }

  function resetReview() {
    cancelAnalysis();
    setReview(null);
    setAnalysis(null);
    setPgnText("");
    setActivePly(0);
    setError("");
    setStatus("empty");
  }

  const currentFen = review ? getReviewFenAtPly(review, activePly) : "";
  const board = currentFen ? new Chess(currentFen).board() : [];
  const currentMove = review?.positions[activePly - 1];
  const reviewedMove = analysis?.moves[activePly - 1];

  const filteredMoves = analysis?.moves.filter(move =>
    filter === "All" || move.classification === filter
  ) ?? [];

  const counts = analysis?.moves.reduce<Record<string, number>>((acc, move) => {
    acc[move.classification] = (acc[move.classification] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  const keyMoments = analysis?.moves.filter(move => move.evaluationLossCp > 80) ?? [];
  const whiteName = metadata(review?.headers.White) || "White";
  const blackName = metadata(review?.headers.Black) || "Black";
  const gameResult = metadata(review?.headers.Result) || "—";

  function goTo(ply: number) {
    if (!review) return;
    setActivePly(Math.max(0, Math.min(review.positions.length, ply)));
  }

  return (
    <main className="game-review-page gr-live">
      <header className="gr-live-header">
        <div>
          <div className="gr-live-eyebrow">CHESS ANALYSIS / GAME REVIEW</div>
          <h1>Game Review</h1>
          <p>Import a game, analyse every position and inspect your decisions.</p>
        </div>
        <div className="gr-live-actions">
          <button className="gr-live-button secondary" onClick={resetReview}>
            <RotateCcw size={15} /> New review
          </button>
          <button className="gr-live-button primary" onClick={() => fileInput.current?.click()}>
            <FileUp size={16} /> Import PGN
          </button>
          <input ref={fileInput} type="file" accept=".pgn,text/plain" hidden onChange={handleFile} />
        </div>
      </header>

      {!review && (
        <section className="gr-live-import">
          <div className="gr-live-import-icon"><FileUp size={26} /></div>
          <h2>Import a chess game</h2>
          <p>Choose a PGN file or paste the PGN notation below.</p>
          <textarea
            value={pgnText}
            onChange={event => setPgnText(event.target.value)}
            placeholder={'[Event "Casual Game"]\n[White "Player 1"]\n[Black "Player 2"]\n\n1. e4 e5 2. Nf3 Nc6 *'}
            rows={9}
            spellCheck={false}
          />
          <button className="gr-live-button primary" disabled={!pgnText.trim()} onClick={() => loadPgn(pgnText)}>
            Load PGN
          </button>
        </section>
      )}

      {error && (
        <div className="gr-live-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      {review && (
        <>
          <section className="gr-live-game-card">
            <div className="gr-live-player">
              <span className="gr-live-avatar white">W</span>
              <div><strong>{whiteName}</strong><span>White {metadata(review.headers.WhiteElo) && `· ${review.headers.WhiteElo}`}</span></div>
            </div>
            <strong className="gr-live-result">{gameResult}</strong>
            <div className="gr-live-player black">
              <span className="gr-live-avatar black">B</span>
              <div><strong>{blackName}</strong><span>Black {metadata(review.headers.BlackElo) && `· ${review.headers.BlackElo}`}</span></div>
            </div>
            <div className="gr-live-meta">
              {[metadata(review.headers.Event), metadata(review.headers.Site), metadata(review.headers.Date), metadata(review.headers.Round), metadata(review.headers.ECO), metadata(review.headers.Opening), metadata(review.headers.TimeControl)].filter(Boolean).join(" · ") || "PGN game"}
              <span>{review.positions.length} plies</span>
              <span>{resultText(review.headers.Result)}</span>
            </div>
          </section>

          <section className="gr-live-toolbar">
            <div className="gr-live-depth">
              <label htmlFor="gr-live-depth">Analysis depth</label>
              <select id="gr-live-depth" value={depth} disabled={status === "running"} onChange={event => setDepth(Number(event.target.value))}>
                {[10, 12, 14, 16, 18, 20, 22, 24].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            {status === "running" ? (
              <button className="gr-live-button danger" onClick={cancelAnalysis}><Pause size={15} /> Cancel analysis</button>
            ) : (
              <button className="gr-live-button primary" onClick={startAnalysis}>
                <BarChart3 size={16} /> {analysis ? "Analyse again" : "Start Stockfish analysis"}
              </button>
            )}
          </section>

          {status === "running" && progress && (
            <section className="gr-live-progress">
              <div><LoaderCircle className="gr-live-spinner" size={16} /> Analysing position {progress.completed} of {progress.total}</div>
              <div className="gr-live-progress-track"><i style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></div>
              <span>Stockfish depth {depth}. You can cancel at any time.</span>
            </section>
          )}

          {analysis && (
            <section className="gr-live-stats">
              <article><Target size={17} /><strong>{analysis.moves.length}</strong><span>Moves analysed</span></article>
              <article><Trophy size={17} /><strong>{counts.Best ?? 0}</strong><span>Best moves</span></article>
              <article><BarChart3 size={17} /><strong>{counts.Inaccuracy ?? 0}</strong><span>Inaccuracies</span></article>
              <article><Target size={17} /><strong>{counts.Mistake ?? 0 + (counts.Blunder ?? 0)}</strong><span>Mistakes and blunders</span></article>
            </section>
          )}

          <nav className="gr-live-tabs">
            <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
            <button className={tab === "moves" ? "active" : ""} onClick={() => setTab("moves")}>Move by move</button>
          </nav>

          {tab === "overview" ? (
            <div className="gr-live-layout">
              <section className="gr-live-panel">
                <div className="gr-live-panel-heading">
                  <div><h2>Board replay</h2><span>{activePly === 0 ? "Starting position" : `${currentMove?.moveNumber ?? ""}${currentMove?.color === "w" ? "." : "..."} ${currentMove?.san ?? ""}`}</span></div>
                  <span>{activePly} / {review.positions.length}</span>
                </div>
                <div className="gr-live-board-wrap">
                  <div className="gr-live-ranks">{[8,7,6,5,4,3,2,1].map(rank => <span key={rank}>{rank}</span>)}</div>
                  <div className="gr-live-board">
                    {board.flatMap((row, rowIndex) => row.map((piece, colIndex) => {
                      const square = `${"abcdefgh"[colIndex]}${8 - rowIndex}`;
                      const highlighted = currentMove && (currentMove.from === square || currentMove.to === square);
                      return (
                        <div key={square} className={`gr-live-square ${(rowIndex + colIndex) % 2 ? "dark" : "light"} ${highlighted ? "highlight" : ""}`}>
                          {piece && <img draggable={false} alt="" src={`${import.meta.env.BASE_URL}assets/pieces/standalone/${piece.color}${piece.type}.svg`} />}
                        </div>
                      );
                    }))}
                  </div>
                  <div className="gr-live-files">{["a","b","c","d","e","f","g","h"].map(file => <span key={file}>{file}</span>)}</div>
                </div>
                <div className="gr-live-controls">
                  <button onClick={() => goTo(0)} title="Start">|◀</button>
                  <button onClick={() => goTo(activePly - 1)} disabled={activePly === 0} title="Previous"><ArrowLeft size={17} /></button>
                  <button className="primary" onClick={() => goTo(activePly + 1)} disabled={activePly === review.positions.length} title="Next"><Play size={16} /></button>
                  <button onClick={() => goTo(activePly + 1)} disabled={activePly === review.positions.length} title="Next"><ArrowRight size={17} /></button>
                  <button onClick={() => goTo(review.positions.length)} title="End">▶|</button>
                </div>
                {reviewedMove && (
                  <div className="gr-live-current-eval">
                    <span>{reviewedMove.classification}</span>
                    <strong>{evaluationText(reviewedMove.after)}</strong>
                    <small>Evaluation after this move · {reviewedMove.evaluationLossCp} cp loss</small>
                  </div>
                )}
              </section>

              <section className="gr-live-panel">
                <div className="gr-live-panel-heading"><div><h2>Key moments</h2><span>Moves with the largest evaluation losses</span></div></div>
                {!analysis && <p className="gr-live-muted">Run Stockfish analysis to discover key moments in this game.</p>}
                {analysis && keyMoments.length === 0 && <p className="gr-live-muted">No moves crossed the current 80 cp key-moment threshold.</p>}
                {keyMoments.map(move => (
                  <button className="gr-live-moment" key={move.ply} onClick={() => goTo(move.ply)}>
                    <span className={`gr-live-tag ${classificationClass(move.classification)}`}>{move.classification}</span>
                    <strong>{move.moveNumber}{move.color === "w" ? "." : "..."} {move.san}</strong>
                    <span>{move.evaluationLossCp} cp loss</span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </section>

              <section className="gr-live-panel gr-live-timeline">
                <div className="gr-live-panel-heading"><div><h2>Move timeline</h2><span>Select a move to replay the position</span></div></div>
                <div className="gr-live-move-grid">
                  {review.positions.map((move, index) => {
                    const result = analysis?.moves[index];
                    return (
                      <button key={move.ply} className={activePly === move.ply ? "selected" : ""} onClick={() => goTo(move.ply)}>
                        <span>{move.moveNumber}{move.color === "w" ? "." : "..."}</span>
                        <strong>{move.san}</strong>
                        {result && <i className={`gr-live-dot ${classificationClass(result.classification)}`} />}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : (
            <section className="gr-live-panel">
              <div className="gr-live-panel-heading"><div><h2>Move-by-move analysis</h2><span>{analysis ? `${analysis.moves.length} moves analysed at depth ${analysis.depth}` : "Start analysis to see engine evaluations and classifications"}</span></div></div>
              <div className="gr-live-filters">
                {FILTERS.map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}{value !== "All" && analysis ? ` ${counts[value] ?? 0}` : ""}</button>)}
              </div>
              {!analysis && <p className="gr-live-muted">No engine analysis yet.</p>}
              {analysis && (
                <div className="gr-live-move-list">
                  {filteredMoves.map((move: ReviewedMove) => (
                    <button key={move.ply} className={`gr-live-move-row ${activePly === move.ply ? "selected" : ""}`} onClick={() => { goTo(move.ply); setTab("overview"); }}>
                      <span>{move.moveNumber}{move.color === "w" ? "." : "..."}</span>
                      <strong>{move.san}</strong>
                      <span className={`gr-live-tag ${classificationClass(move.classification)}`}>{move.classification}</span>
                      <span>{evaluationText(move.after)}</span>
                      <span>{move.evaluationLossCp} cp</span>
                    </button>
                  ))}
                  {filteredMoves.length === 0 && <p className="gr-live-muted">No moves match this filter.</p>}
                </div>
              )}
            </section>
          )}
          <footer className="gr-live-footer">
            Stockfish {analysis ? `· Depth ${analysis.depth} · ${analysis.positionsAnalyzed} positions analysed` : "· Ready for analysis"} · Classifications use provisional centipawn thresholds, not Chess.com proprietary ratings.
          </footer>
        </>
      )}
    </main>
  );
}
