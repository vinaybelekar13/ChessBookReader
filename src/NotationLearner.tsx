import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, RotateCw, BookOpen, GraduationCap } from "lucide-react";
import "./notation-learner.css";

const FILES = "abcdefgh";
const PIECES: Record<string, string> = {
  wk:"♔", wq:"♕", wr:"♖", wb:"♗", wn:"♘", wp:"♙",
  bk:"♚", bq:"♛", br:"♜", bb:"♝", bn:"♞", bp:"♟"
};

function parseLine(input: string) {
  const chess = new Chess();
  const cleaned = input
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*\[.*\]\s*$/gm, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter(Boolean)
    .filter((x) => !["1-0", "0-1", "1/2-1/2", "*"].includes(x));

  const moves: string[] = [];
  for (const token of tokens) {
    try {
      const move = chess.move(token);
      moves.push(move.san);
    } catch {
      throw new Error(`Invalid or illegal move: ${token}`);
    }
  }
  return moves;
}

export default function NotationLearner() {
  const [input, setInput] = useState("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6");
  const [moves, setMoves] = useState<string[]>(() => parseLine("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"));
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [training, setTraining] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);


  const positions = useMemo(() => {
    const game = new Chess();
    const result = [game.fen()];
    for (const san of moves) {
      game.move(san);
      result.push(game.fen());
    }
    return result;
  }, [moves]);

  const game = useMemo(() => new Chess(positions[index]), [positions, index]);
  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [];
    return game.moves({ square: selectedSquare, verbose: true }).map(move => move.to);
  }, [game, selectedSquare]);
  const history = useMemo(() => {
    const replay = new Chess();
    const result = [];
    for (const san of moves.slice(0, index)) result.push(replay.move(san));
    return result;
  }, [moves, index]);

  const lastMove = history.at(-1);
  const board = game.board();
  const squares = flipped
    ? [...Array(8)].flatMap((_, r) => [...Array(8)].map((__, f) => `${FILES[7-f]}${r+1}`))
    : [...Array(8)].flatMap((_, r) => [...Array(8)].map((__, f) => `${FILES[f]}${8-r}`));

  function loadLine() {
    try {
      const parsed = parseLine(input);
      setMoves(parsed);
      setIndex(0);
      setError("");
      setRevealed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const piece = lastMove?.piece
    ? ({ p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" } as Record<string,string>)[lastMove.piece]
    : "Starting position";

  return (
    <main className="notation-workspace">
      <header className="notation-header">
        <div>
          <span className="notation-eyebrow">CHESSBOOK TRAINING</span>
          <h1>Notation Learner</h1>
          <p>Connect every chess symbol to the position it creates.</p>
        </div>
        <div className="notation-header-actions">
          <button onClick={() => setTraining(v => !v)} className={training ? "nl-active" : ""}>
            <GraduationCap size={16}/> {training ? "Training ON" : "Training mode"}
          </button>
          <button onClick={() => setFlipped(v => !v)}><RotateCw size={16}/> Flip board</button>
        </div>
      </header>

      <section className="notation-input-panel">
        <label htmlFor="notation-input">Paste PGN moves or a SAN line</label>
        <textarea id="notation-input" value={input} onChange={e => setInput(e.target.value)} rows={3} spellCheck={false}/>
        <div className="nl-input-footer">
          <span>Example: 1. e4 e5 2. Nf3 Nc6</span>
          <button className="nl-primary" onClick={loadLine}><BookOpen size={15}/> Load notation</button>
        </div>
        {error && <p className="nl-error" role="alert">{error}</p>}
      </section>

      <div className="notation-layout">
        <section className="nl-board-card">
          <div className="nl-board-meta">
            <span>POSITION {index} / {moves.length}</span>
            <strong>{game.turn() === "w" ? "White to move" : "Black to move"}</strong>
          </div>
          <div className="nl-board" role="grid" aria-label="Interactive chess position">
            {squares.map(name => {
              const square = name as Square;
              const file = FILES.indexOf(name[0]);
              const rank = Number(name[1]);
              const item = board[8-rank][file];
              const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
              const dark = (file + rank) % 2 === 0;
              return (
                <div key={name} role="gridcell" aria-label={`${name}${item ? ` ${item.color === "w" ? "white" : "black"} ${item.type}` : ""}`}
                  className={`nl-square ${dark ? "dark" : "light"} ${isLast ? "last" : ""} ${selectedSquare === square ? "nl-selected" : ""} ${legalTargets.includes(square) ? "nl-legal-target" : ""}`}
                  onClick={() => setSelectedSquare(current => current === square ? null : square)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedSquare(current => current === square ? null : square);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={selectedSquare === square}
                  title={`${square}${item ? ` — ${item.color === "w" ? "White" : "Black"} ${item.type}` : ""}`}>
                  {item && <span className={`nl-piece ${item.color === "w" ? "white-piece" : "black-piece"}`}>{PIECES[item.color + item.type]}</span>}
                  {file === (flipped ? 7 : 0) && <small className="nl-rank">{rank}</small>}
                  {rank === (flipped ? 1 : 1) && <small className="nl-file">{name[0]}</small>}
                </div>
              );
            })}
          </div>
          {selectedSquare && (
            <div className="nl-square-inspector" aria-live="polite">
              <strong>{selectedSquare}</strong>
              <span>
                {game.get(selectedSquare)
                  ? `${game.get(selectedSquare)?.color === "w" ? "White" : "Black"} ${({
                      p: "Pawn", n: "Knight", b: "Bishop",
                      r: "Rook", q: "Queen", k: "King"
                    } as Record<string, string>)[game.get(selectedSquare)!.type]}`
                  : "Empty square"}
              </span>
              <span>
                {legalTargets.length
                  ? `${legalTargets.length} legal destination${legalTargets.length === 1 ? "" : "s"} highlighted`
                  : "No legal moves from this square"}
              </span>
            </div>
          )}
          <div className="nl-controls">
            <button aria-label="First move" onClick={() => {setIndex(0);setRevealed(false)}}><ChevronFirst/></button>
            <button aria-label="Previous move" onClick={() => {setIndex(v => Math.max(0,v-1));setRevealed(false)}}><ChevronLeft/></button>
            <span>{index === 0 ? "Starting position" : `${Math.ceil(index/2)}${index%2 ? "." : "..."}`}</span>
            <button aria-label="Next move" disabled={index >= moves.length || (training && !revealed)} onClick={() => {setIndex(v => Math.min(moves.length,v+1));setRevealed(false)}}><ChevronRight/></button>
            <button aria-label="Last move" disabled={training} onClick={() => setIndex(moves.length)}><ChevronLast/></button>
          </div>
        </section>

        <aside className="nl-notation-card">
          <div className="nl-card-title"><strong>GAME NOTATION</strong><span>{moves.length} plies</span></div>
          <div className="nl-move-list">
            {moves.length === 0 && <p className="nl-muted">Load a move sequence to begin.</p>}
            {Array.from({length: Math.ceil(moves.length/2)}, (_, row) => (
              <div className="nl-move-row" key={row}>
                <span>{row+1}.</span>
                {[0,1].map(side => {
                  const ply = row*2+side;
                  if (!moves[ply]) return <i key={side}/>;
                  const hidden = training && ply === index && !revealed;
                  return <button key={side} className={index === ply+1 ? "selected" : ""}
                    onClick={() => {setIndex(ply+1);setRevealed(false)}}
                    disabled={hidden}>
                    {hidden ? "?" : moves[ply]}
                  </button>;
                })}
              </div>
            ))}
          </div>
          <div className="nl-learning">
            <span className="notation-eyebrow">MOVE EXPLANATION</span>
            {index === 0
              ? <p>Start from the initial position. Select a move to see how the notation changes the board.</p>
              : <><strong>{piece}</strong><p>{lastMove?.color === "w" ? "White" : "Black"} moved from <b>{lastMove?.from}</b> to <b>{lastMove?.to}</b>.</p><p className="nl-san">{lastMove?.san}</p></>}
            {training && index < moves.length && !revealed && <button className="nl-primary" onClick={() => setRevealed(true)}>Reveal next move: {moves[index]}</button>}
          </div>
        </aside>
      </div>
      <p className="nl-fen"><strong>FEN</strong> {game.fen()}</p>
    </main>
  );
}



