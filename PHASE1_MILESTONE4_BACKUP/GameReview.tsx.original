import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BarChart3, ChevronDown, ChevronRight,
  CircleAlert, Crown, FileUp, Lightbulb, Play, RotateCcw,
  Sparkles, Target, Trophy
} from "lucide-react";

type MoveTag = "Best" | "Excellent" | "Good" | "Inaccuracy" | "Mistake" | "Blunder";

type ReviewMove = {
  number: number;
  white: string;
  black: string;
  whiteTag: MoveTag;
  blackTag: MoveTag;
  whiteEval: string;
  blackEval: string;
};

const sampleMoves: ReviewMove[] = [
  { number: 1, white: "e4", black: "e5", whiteTag: "Best", blackTag: "Best", whiteEval: "+0.2", blackEval: "+0.2" },
  { number: 2, white: "Nf3", black: "Nc6", whiteTag: "Best", blackTag: "Excellent", whiteEval: "+0.3", blackEval: "+0.2" },
  { number: 3, white: "Bb5", black: "a6", whiteTag: "Excellent", blackTag: "Good", whiteEval: "+0.4", blackEval: "+0.3" },
  { number: 4, white: "Ba4", black: "Nf6", whiteTag: "Best", blackTag: "Best", whiteEval: "+0.3", blackEval: "+0.3" },
  { number: 5, white: "O-O", black: "Be7", whiteTag: "Best", blackTag: "Good", whiteEval: "+0.4", blackEval: "+0.4" },
  { number: 6, white: "Re1", black: "b5", whiteTag: "Good", blackTag: "Good", whiteEval: "+0.5", blackEval: "+0.5" },
  { number: 7, white: "Bb3", black: "d6", whiteTag: "Excellent", blackTag: "Good", whiteEval: "+0.5", blackEval: "+0.6" },
  { number: 8, white: "c3", black: "O-O", whiteTag: "Good", blackTag: "Best", whiteEval: "+0.6", blackEval: "+0.6" },
  { number: 9, white: "h3", black: "Na5", whiteTag: "Inaccuracy", blackTag: "Good", whiteEval: "+0.1", blackEval: "+0.2" },
  { number: 10, white: "Bc2", black: "c5", whiteTag: "Good", blackTag: "Excellent", whiteEval: "+0.2", blackEval: "+0.2" },
  { number: 11, white: "d4", black: "Qc7", whiteTag: "Best", blackTag: "Mistake", whiteEval: "+0.8", blackEval: "+1.5" },
  { number: 12, white: "Nbd2", black: "cxd4", whiteTag: "Excellent", blackTag: "Good", whiteEval: "+1.4", blackEval: "+1.4" },
  { number: 13, white: "cxd4", black: "Bd7", whiteTag: "Best", blackTag: "Inaccuracy", whiteEval: "+1.8", blackEval: "+2.4" },
  { number: 14, white: "Nf1", black: "Rac8", whiteTag: "Good", blackTag: "Good", whiteEval: "+2.1", blackEval: "+2.2" },
  { number: 15, white: "Ne3", black: "Nxd4", whiteTag: "Blunder", blackTag: "Best", whiteEval: "-0.4", blackEval: "-0.4" },
];

const startBoard = [
  ["♜","♞","♝","♛","♚","♝","♞","♜"],
  ["♟","♟","♟","","♟","♟","♟","♟"],
  ["","","","","","","",""],
  ["","♗","","♟","","","",""],
  ["","","","","♙","","","",""],
  ["","","","","","♘","",""],
  ["♙","♙","♙","♙","","♙","♙","♙"],
  ["♖","♘","♗","♕","♔","","","♖"],
];

const tagClass: Record<MoveTag, string> = {
  Best: "best", Excellent: "excellent", Good: "good",
  Inaccuracy: "inaccuracy", Mistake: "mistake", Blunder: "blunder"
};

export function GameReview() {
  const [activePly, setActivePly] = useState(0);
  const [tab, setTab] = useState<"overview" | "moves">("overview");
  const [filter, setFilter] = useState<"All" | MoveTag>("All");
  const [showSampleNotice, setShowSampleNotice] = useState(true);

  const currentMove = Math.floor(activePly / 2);
  const currentSide = activePly % 2 === 0 ? "White" : "Black";

  const filteredMoves = useMemo(() => sampleMoves.flatMap((move, index) => {
    const white = { ply: index * 2 + 1, san: move.white, tag: move.whiteTag, side: "White" };
    const black = { ply: index * 2 + 2, san: move.black, tag: move.blackTag, side: "Black" };
    return [white, black].filter(item => filter === "All" || item.tag === filter);
  }), [filter]);

  function navigate(delta: number) {
    setActivePly(value => Math.max(0, Math.min(sampleMoves.length * 2, value + delta)));
  }

  return (
    <main className="game-review-page">
      <div className="gr-topline">
        <div>
          <div className="gr-eyebrow">CHESS ANALYSIS / GAME REVIEW</div>
          <h1>Game Review</h1>
          <p>Understand your decisions. Find the moments that changed the game.</p>
        </div>
        <div className="gr-top-actions">
          <button className="gr-button gr-button-secondary" onClick={() => setActivePly(0)}>
            <RotateCcw size={15} /> Reset
          </button>
          <button className="gr-button gr-button-primary" onClick={() => document.getElementById("gr-pgn-input")?.click()}>
            <FileUp size={16} /> Import PGN
          </button>
          <input id="gr-pgn-input" type="file" accept=".pgn,text/plain" hidden />
        </div>
      </div>

      {showSampleNotice && (
        <div className="gr-demo-notice">
          <Sparkles size={16} />
          <span><strong>Preview mode</strong> — this is sample review data. Engine analysis will be connected after the UI is approved.</span>
          <button onClick={() => setShowSampleNotice(false)} aria-label="Dismiss preview notice">×</button>
        </div>
      )}

      <section className="gr-game-card">
        <div className="gr-game-players">
          <div className="gr-player">
            <div className="gr-avatar gr-white-avatar">W</div>
            <div><strong>Magnus Carlsen</strong><span>White · 2847</span></div>
          </div>
          <div className="gr-result">1 – 0</div>
          <div className="gr-player gr-player-black">
            <div className="gr-avatar gr-black-avatar">B</div>
            <div><strong>Hikaru Nakamura</strong><span>Black · 2789</span></div>
          </div>
        </div>
        <div className="gr-game-meta">
          <span>Ruy Lopez</span><i /> <span>Blitz · 5+3</span><i /> <span>Sample game</span><i /> <span>30 moves</span>
        </div>
      </section>

      <section className="gr-stat-grid">
        <article className="gr-stat-card">
          <div className="gr-stat-label"><Target size={15} /> WHITE ACCURACY</div>
          <div className="gr-stat-value">91.4<span>%</span></div>
          <div className="gr-stat-foot"><span className="gr-dot gr-dot-green" /> Strong performance</div>
        </article>
        <article className="gr-stat-card">
          <div className="gr-stat-label"><Target size={15} /> BLACK ACCURACY</div>
          <div className="gr-stat-value">76.8<span>%</span></div>
          <div className="gr-stat-foot"><span className="gr-dot gr-dot-amber" /> Inconsistent play</div>
        </article>
        <article className="gr-stat-card">
          <div className="gr-stat-label"><BarChart3 size={15} /> MOVE QUALITY</div>
          <div className="gr-quality-row"><strong>18</strong><span>Good or better</span></div>
          <div className="gr-quality-bar"><i style={{ width: "72%" }} /></div>
          <div className="gr-stat-foot">25 moves reviewed</div>
        </article>
        <article className="gr-stat-card">
          <div className="gr-stat-label"><Trophy size={15} /> GAME RESULT</div>
          <div className="gr-stat-value gr-result-value">1 – 0</div>
          <div className="gr-stat-foot">White won · Sample result</div>
        </article>
      </section>

      <div className="gr-tabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
        <button className={tab === "moves" ? "active" : ""} onClick={() => setTab("moves")}>Move by move</button>
      </div>

      {tab === "overview" ? (
        <div className="gr-main-grid">
          <section className="gr-panel gr-board-panel">
            <div className="gr-panel-heading">
              <div><h2>Board replay</h2><span>Move {Math.ceil(activePly / 2)} · {currentSide} to play</span></div>
              <span className="gr-preview-tag">SAMPLE POSITION</span>
            </div>
            <div className="gr-board-wrap">
              <div className="gr-rank-labels">{[8,7,6,5,4,3,2,1].map(n => <span key={n}>{n}</span>)}</div>
              <div className="gr-board">
                {startBoard.flatMap((row, r) => row.map((piece, c) => (
                  <div key={`${r}-${c}`} className={`gr-square ${(r + c) % 2 === 0 ? "light" : "dark"}`}>
                    {piece && <span className={piece.charCodeAt(0) > 9817 ? "white-piece" : "black-piece"}>{piece}</span>}
                  </div>
                )))}
              </div>
              <div className="gr-file-labels">{["a","b","c","d","e","f","g","h"].map(f => <span key={f}>{f}</span>)}</div>
            </div>
            <div className="gr-board-controls">
              <button onClick={() => setActivePly(0)} title="Start"><span>↤</span></button>
              <button onClick={() => navigate(-1)} title="Previous move"><ArrowLeft size={17} /></button>
              <button className="gr-play-button" onClick={() => navigate(1)} title="Next move"><Play size={16} /></button>
              <button onClick={() => navigate(1)} title="Next move"><ArrowRight size={17} /></button>
              <button onClick={() => setActivePly(sampleMoves.length * 2)} title="End"><span>↦</span></button>
              <span className="gr-ply-counter">{activePly} / {sampleMoves.length * 2}</span>
            </div>
          </section>

          <section className="gr-panel gr-insights-panel">
            <div className="gr-panel-heading"><div><h2>Game insights</h2><span>Key moments from this game</span></div><Lightbulb size={19} /></div>
            <div className="gr-insight-item">
              <div className="gr-insight-icon gr-icon-amber"><CircleAlert size={17} /></div>
              <div><span className="gr-insight-label">INACCURACY · 9...Na5</span><strong>A questionable knight maneuver</strong><p>White's position becomes less comfortable after this decision.</p></div>
              <button onClick={() => { setActivePly(18); setTab("moves"); }}><ChevronRight size={17} /></button>
            </div>
            <div className="gr-insight-item">
              <div className="gr-insight-icon gr-icon-red"><CircleAlert size={17} /></div>
              <div><span className="gr-insight-label">MISTAKE · 11...Qc7</span><strong>Black gives up some control</strong><p>White gets a more promising position after the mistake.</p></div>
              <button onClick={() => { setActivePly(22); setTab("moves"); }}><ChevronRight size={17} /></button>
            </div>
            <div className="gr-insight-item">
              <div className="gr-insight-icon gr-icon-red"><Crown size={17} /></div>
              <div><span className="gr-insight-label">BLUNDER · 15.Ne3</span><strong>A critical turning point</strong><p>This move changes the evaluation dramatically in the sample review.</p></div>
              <button onClick={() => { setActivePly(29); setTab("moves"); }}><ChevronRight size={17} /></button>
            </div>
            <div className="gr-insight-footer">Insights shown here are illustrative, not engine-generated.</div>
          </section>

          <section className="gr-panel gr-move-preview">
            <div className="gr-panel-heading"><div><h2>Move timeline</h2><span>Browse the game's decisions</span></div><button className="gr-text-link" onClick={() => setTab("moves")}>View all moves <ChevronRight size={14} /></button></div>
            <div className="gr-timeline">
              {sampleMoves.slice(0, 8).map((move, index) => (
                <button key={move.number} className={currentMove === index ? "selected" : ""} onClick={() => setActivePly(index * 2 + 1)}>
                  <span className="gr-timeline-number">{move.number}.</span>
                  <span>{move.white}</span><i className={`gr-move-dot ${tagClass[move.whiteTag]}`} />
                  <span>{move.black}</span><i className={`gr-move-dot ${tagClass[move.blackTag]}`} />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="gr-panel gr-full-moves">
          <div className="gr-panel-heading"><div><h2>Move-by-move analysis</h2><span>Review every decision and its classification</span></div></div>
          <div className="gr-filter-row">
            {(["All","Best","Excellent","Good","Inaccuracy","Mistake","Blunder"] as const).map(value => (
              <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>
            ))}
          </div>
          <div className="gr-move-table">
            <div className="gr-move-table-head"><span>PLY</span><span>MOVE</span><span>SIDE</span><span>CLASSIFICATION</span><span>EVALUATION</span></div>
            {filteredMoves.map(item => (
              <button key={item.ply} className={`gr-move-table-row ${activePly === item.ply ? "selected" : ""}`} onClick={() => setActivePly(item.ply)}>
                <span>{item.ply}</span><strong>{item.san}</strong><span>{item.side}</span><span><i className={`gr-move-dot ${tagClass[item.tag]}`} />{item.tag}</span><span>{sampleMoves[Math.floor((item.ply - 1) / 2)][item.side === "White" ? "whiteEval" : "blackEval"]}</span>
              </button>
            ))}
          </div>
          {filteredMoves.length === 0 && <div className="gr-empty">No moves match this filter.</div>}
        </section>
      )}

      <div className="gr-bottom-note"><ChevronDown size={15} /> Sample review interface · Real PGN import and engine-powered analysis will be connected in the next stage.</div>
    </main>
  );
}
