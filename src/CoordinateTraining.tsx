import { useEffect, useMemo, useState } from "react";
import "./coordinate-training.css";

type Orientation = "white" | "black";
type Mode = "timed" | "untimed" | "streak";
type SessionResult = { date: string; score: number; accuracy: number; duration: number };

const FILES = "abcdefgh";
const RANKS = "12345678";
const randomSquare = (avoid?: string) => {
  let next = `${FILES[Math.floor(Math.random() * 8)]}${RANKS[Math.floor(Math.random() * 8)]}`;
  while (next === avoid) next = `${FILES[Math.floor(Math.random() * 8)]}${RANKS[Math.floor(Math.random() * 8)]}`;
  return next;
};
const STORAGE_KEY = "chessbook-coordinate-training-v1";

export default function CoordinateTraining() {
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [mode, setMode] = useState<Mode>("timed");
  const [duration, setDuration] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [target, setTarget] = useState(() => randomSquare());
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | "">("");
  const [sound, setSound] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [history, setHistory] = useState<SessionResult[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as SessionResult[]; } catch { return []; }
  });
  const finished = mode === "timed" && remaining <= 0;
  const attempts = correct + wrong;
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
  const squares = useMemo(() => {
    const files = orientation === "white" ? [...FILES] : [...FILES].reverse();
    const ranks = orientation === "white" ? [...RANKS].reverse() : [...RANKS];
    return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
  }, [orientation]);

  useEffect(() => {
    if (!startedAt || finished || mode !== "timed") return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, finished, mode]);

  useEffect(() => {
    if (finished && startedAt) {
      const result = { date: new Date().toISOString(), score, accuracy, duration: duration - remaining };
      setHistory((previous) => {
        const next = [result, ...previous].slice(0, 30);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
        return next;
      });
      setStartedAt(null);
    }
  }, [finished]);

  function restart(nextMode = mode, nextDuration = duration) {
    setMode(nextMode);
    setDuration(nextDuration);
    setRemaining(nextDuration);
    setTarget(randomSquare());
    setScore(0); setCorrect(0); setWrong(0); setStreak(0);
    setFeedback(""); setStartedAt(null);
  }

  function chooseSquare(square: string) {
    if (finished) return;
    if (!startedAt) setStartedAt(Date.now());
    if (square === target) {
      setCorrect((value) => value + 1);
      setScore((value) => value + 1);
      setStreak((value) => { const next = value + 1; setBestStreak((best) => Math.max(best, next)); return next; });
      setFeedback("correct");
    } else {
      setWrong((value) => value + 1);
      setStreak(0);
      setFeedback("wrong");
    }
    setTarget(randomSquare(target));
  }

  return <main className="coordinate-training-workspace">
    <header className="ct-header">
      <div><span className="ct-eyebrow">CHESSBOOK TRAINING</span><h1>Coordinate Training</h1><p>Build instant board vision. Find the square before the clock runs out.</p></div>
      <div className="ct-header-actions"><button onClick={() => restart()}>↻ Restart</button><button className="ct-primary" onClick={() => restart(mode, duration)}>New session</button></div>
    </header>
    <div className="ct-layout">
      <section className="ct-board-card">
        <div className="ct-board-top"><span>Find this square</span><strong className="ct-target">{finished ? "TIME!" : target}</strong><span className={`ct-feedback ${feedback}`}>{feedback === "correct" ? "Correct" : feedback === "wrong" ? "Try the next one" : "Select a square"}</span></div>
        <div className="ct-board" role="group" aria-label="Coordinate training chessboard">
          {squares.map((square) => {
            const file = FILES.indexOf(square[0]);
            const rank = Number(square[1]);
            const dark = (file + rank) % 2 === 0;
            return <button key={square} type="button" disabled={finished} onClick={() => chooseSquare(square)} className={`ct-square ${dark ? "dark" : "light"}`} aria-label={square}>
              {showCoordinates && ((orientation === "white" && file === 0) || (orientation === "black" && file === 7)) && <span className="ct-rank">{rank}</span>}
              {showCoordinates && ((orientation === "white" && rank === 1) || (orientation === "black" && rank === 8)) && <span className="ct-file">{square[0]}</span>}
            </button>;
          })}
        </div>
        <div className="ct-board-footer"><span>{orientation === "white" ? "White perspective" : "Black perspective"}</span><button onClick={() => setOrientation((value) => value === "white" ? "black" : "white")}>⇅ Flip board</button></div>
      </section>
      <aside className="ct-side">
        <section className="ct-card ct-stats"><div className="ct-card-heading">SESSION</div><div className="ct-timer">{mode === "untimed" ? "∞" : mode === "streak" ? "—" : `00:${String(remaining).padStart(2, "0")}`}</div><div className="ct-progress"><i style={{ width: `${mode === "timed" ? ((duration - remaining) / duration) * 100 : 0}%` }} /></div>
          <div className="ct-stat-grid"><div><strong>{score}</strong><span>Score</span></div><div><strong>{accuracy}%</strong><span>Accuracy</span></div><div><strong>{streak}</strong><span>Streak</span></div><div><strong>{bestStreak}</strong><span>Best streak</span></div></div>
          {!startedAt && <p className="ct-start-note">Your timer starts with your first answer.</p>}
          {finished && <div className="ct-finished">Session complete · {score} correct squares</div>}
        </section>
        <section className="ct-card"><div className="ct-card-heading">TRAINING SETTINGS</div><label>Mode<select value={mode} onChange={(e) => restart(e.target.value as Mode)}><option value="timed">Timed challenge</option><option value="untimed">Untimed practice</option><option value="streak">Streak challenge</option></select></label>
          <label>Duration<select value={duration} onChange={(e) => restart(mode, Number(e.target.value))}><option value={30}>30 seconds</option><option value={60}>60 seconds</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option></select></label>
          <label className="ct-toggle"><input type="checkbox" checked={showCoordinates} onChange={(e) => setShowCoordinates(e.target.checked)} /> Show board coordinates</label>
          <label className="ct-toggle"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Sound feedback (coming soon)</label>
          <button className="ct-primary ct-full" onClick={() => restart()}>Start / Restart training</button>
        </section>
        <section className="ct-card"><div className="ct-card-heading">RECENT SESSIONS</div>{history.length ? history.slice(0, 4).map((item, index) => <div className="ct-history-row" key={`${item.date}-${index}`}><span>{new Date(item.date).toLocaleDateString()}</span><strong>{item.score} correct</strong><em>{item.accuracy}%</em></div>) : <p className="ct-empty">Your completed timed sessions will appear here.</p>}</section>
      </aside>
    </div>
  </main>;
}
