import { useEffect, useRef, useState } from "react";
import "./coordinate-training.css";

type Mode = "findSquare" | "nameSquare";
type Orientation = "white" | "black";
type Session = { date: string; score: number; mode: Mode; orientation: Orientation };

const FILES = "abcdefgh";
const RANKS = "12345678";
const KEY = "chessbook-coordinate-training-v2";
const PIECES = [
  ["br","bn","bb","bq","bk","bb","bn","br"],
  ["bp","bp","bp","bp","bp","bp","bp","bp"],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["wp","wp","wp","wp","wp","wp","wp","wp"],
  ["wr","wn","wb","wq","wk","wb","wn","wr"],
];

function nextSquare(previous: string, avoidLine = true) {
  let choices: string[] = [];
  for (const file of FILES) for (const rank of RANKS) {
    if (!avoidLine || (file !== previous[0] && rank !== previous[1])) choices.push(file + rank);
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

function readHistory(): Session[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export default function CoordinateTraining() {
  const [mode, setMode] = useState<Mode>("findSquare");
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [timed, setTimed] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [showPieces, setShowPieces] = useState(true);
  const [sound, setSound] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState(30);
  const [target, setTarget] = useState(() => nextSquare(""));
  const [nextTarget, setNextTarget] = useState(() => nextSquare(""));
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [history, setHistory] = useState<Session[]>(readHistory);
  const [answer, setAnswer] = useState("");
  const [started, setStarted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 100;
  const finished = timed && remaining <= 0;

  const playTone = (good: boolean) => {
    if (!sound) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioRef.current) audioRef.current = new AudioContextClass();
      const ctx = audioRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = good ? 660 : 180;
      gain.gain.value = 0.06;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.09);
    } catch { /* Audio is optional */ }
  };

  const saveSession = () => {
    if (!started) return;
    const entry: Session = { date: new Date().toISOString(), score, mode, orientation };
    setHistory(previous => {
      const next = [entry, ...previous].slice(0, 20);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Storage unavailable */ }
      return next;
    });
    setStarted(false);
  };

  const start = () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    setScore(0);
    setAttempts(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setRemaining(30);
    setWrong(false);
    setAnswer("");
    const first = nextSquare("");
    setTarget(first);
    setNextTarget(nextSquare(first));
    setStarted(true);
    setPlaying(true);
    if (mode === "nameSquare") setTimeout(() => inputRef.current?.focus(), 0);
  };

  const stop = () => {
    setPlaying(false);
    saveSession();
  };

  useEffect(() => {
    if (!playing || !timed) return;
    const startAt = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, 30 - Math.floor((Date.now() - startAt) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(timer);
        setPlaying(false);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, timed]);

  useEffect(() => {
    if (finished && started) saveSession();
  }, [finished]);

  useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    if (audioRef.current) void audioRef.current.close();
  }, []);

  const markWrong = () => {
    setAttempts(v => v + 1);
    setStreak(0);
    setWrong(true);
    playTone(false);
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    wrongTimer.current = setTimeout(() => setWrong(false), 500);
  };

  const markCorrect = () => {
    setAttempts(v => v + 1);
    setCorrect(v => v + 1);
    setScore(v => v + 1);
    setStreak(v => {
      const next = v + 1;
      setBestStreak(best => Math.max(best, next));
      return next;
    });
    setWrong(false);
    playTone(true);
    setTarget(nextTarget);
    setNextTarget(nextSquare(nextTarget));
    setAnswer("");
  };

  const chooseSquare = (square: string) => {
    if (!playing || mode !== "findSquare") return;
    if (square === target) markCorrect();
    else markWrong();
  };

  const submitAnswer = (value: string) => {
    if (!playing || mode !== "nameSquare") return;
    const normalized = value.toLowerCase().replace(/[^a-h1-8]/g, "").slice(0, 2);
    setAnswer(normalized);
    if (normalized.length === 2) {
      if (/^[a-h][1-8]$/.test(normalized) && normalized === target) markCorrect();
      else if (/^[a-h][1-8]$/.test(normalized)) {
        markWrong();
        setAnswer("");
      }
    }
  };

  const files = orientation === "white" ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === "white" ? [...RANKS].reverse() : [...RANKS];

  return (
    <main className="coordinate-training-workspace">
      <header className="ct-topbar">
        <div className="ct-brand">
          <span className="ct-brand-mark"><span className="ct-grass-icon" aria-hidden="true"><i></i><i></i><i></i></span></span>
          <div><strong>Coordinate Training</strong><small>Improve your board vision</small></div>
        </div>
        <div className="ct-top-actions">
          <button type="button" onClick={() => setOrientation(v => v === "white" ? "black" : "white")}>⇅ Flip board</button>
          {playing
            ? <button type="button" className="ct-start-button" onClick={stop}>Stop training</button>
            : <button type="button" className="ct-start-button" onClick={start}>Start training</button>}
        </div>
      </header>

      <div className="ct-main">
        <section className="ct-play-area">
          <div className="ct-mode-tabs">
            <button className={mode === "findSquare" ? "active" : ""} onClick={() => { setMode("findSquare"); setPlaying(false); setStarted(false); }}>Find the square</button>
            <button className={mode === "nameSquare" ? "active" : ""} onClick={() => { setMode("nameSquare"); setPlaying(false); setStarted(false); }}>Name the square</button>
          </div>

          <div className="ct-instruction">
            <span>{mode === "findSquare" ? "Find this square" : "Which square is highlighted?"}</span>
            <small className={wrong ? "ct-feedback-error" : ""}>
              {!playing ? (finished ? "Time is up!" : "Press Start training to begin") : wrong ? "Not quite — try again" : "Select the correct square"}
            </small>
          </div>

          <div className={`ct-board-frame ${wrong ? "is-wrong" : ""}`}>
            <div className="ct-board" role="group" aria-label="Coordinate training chessboard">
              {ranks.flatMap((rank, row) => files.map((file, col) => {
                const square = file + rank;
                const light = (FILES.indexOf(file) + Number(rank)) % 2 === 1;
                const isHighlighted = mode === "nameSquare" && playing && square === target;
                const piece = PIECES[8 - Number(rank)][FILES.indexOf(file)];
                const showRank = mode === "findSquare" && showCoordinates && (orientation === "white" ? col === 0 : col === 7);
                const showFile = mode === "findSquare" && showCoordinates && (orientation === "white" ? row === 7 : row === 0);
                return (
                  <button
                    key={square}
                    type="button"
                    aria-label={square}
                    disabled={!playing || mode !== "findSquare"}
                    onClick={() => chooseSquare(square)}
                    className={`ct-square ${light ? "light" : "dark"} ${isHighlighted ? "ct-highlight" : ""}`}
                  >
                    {showPieces && piece && <img draggable="false" alt="" src={`${import.meta.env.BASE_URL}assets/pieces/standalone/${piece}.svg`} />}
                    {showRank && <span className="ct-coordinate ct-rank">{rank}</span>}
                    {showFile && <span className="ct-coordinate ct-file">{file}</span>}
                  </button>
                );
              }))}
              {playing && mode === "findSquare" && (
                <div className="ct-board-targets" aria-hidden="true">
                  <span className="ct-board-current">{mode === "findSquare" ? target : target}</span>
                  <span className="ct-board-next">{nextTarget}</span>
                </div>
              )}
            </div>
          </div>

          {mode === "nameSquare" && (
            <form className="ct-answer-form" onSubmit={e => { e.preventDefault(); if (answer.length === 2) submitAnswer(answer); }}>
              <input
                ref={inputRef}
                value={answer}
                disabled={!playing}
                onChange={e => submitAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
                placeholder="Type square (e.g. e4)"
                maxLength={2}
                autoComplete="off"
                aria-label="Enter square coordinate"
              />
            </form>
          )}

          <div className="ct-board-footer">
            <span>{orientation === "white" ? "White perspective" : "Black perspective"}</span>
            <span>{playing ? "Training in progress" : "Ready when you are"}</span>
          </div>
        </section>

        <aside className="ct-sidebar">
          <section className="ct-panel ct-score-panel">
            <div className="ct-panel-title">YOUR SESSION</div>
            <div className="ct-clock">{timed ? `00:${String(remaining).padStart(2, "0")}` : "∞"}</div>
            <div className="ct-time-track"><span style={{ width: `${timed ? (remaining / 30) * 100 : 100}%` }} /></div>
            <div className="ct-score-grid">
              <div><strong>{score}</strong><small>Score</small></div>
              <div><strong>{accuracy}%</strong><small>Accuracy</small></div>
              <div><strong>{streak}</strong><small>Streak</small></div>
              <div><strong>{bestStreak}</strong><small>Best streak</small></div>
            </div>
            {!playing && !finished && <p className="ct-hint">Your challenge starts when you press Start training.</p>}
            {finished && <p className="ct-complete">Challenge complete · {score} correct</p>}
          </section>

          <section className="ct-panel">
            <div className="ct-panel-title">SETTINGS</div>
            <label className="ct-setting-row">
              <span>Time control</span>
              <select value={timed ? "timed" : "untimed"} onChange={e => { setTimed(e.target.value === "timed"); setPlaying(false); setStarted(false); setRemaining(30); }}>
                <option value="timed">30 seconds</option>
                <option value="untimed">Unlimited</option>
              </select>
            </label>
            <label className="ct-setting-toggle"><span>Show coordinates</span><input type="checkbox" checked={showCoordinates} onChange={e => setShowCoordinates(e.target.checked)} /></label>
            <label className="ct-setting-toggle"><span>Show pieces</span><input type="checkbox" checked={showPieces} onChange={e => setShowPieces(e.target.checked)} /></label>
            <label className="ct-setting-toggle"><span>Sound</span><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /></label>
            <button className="ct-start-button ct-wide-button" onClick={playing ? stop : start}>{playing ? "Stop training" : "Start training"}</button>
          </section>

          <section className="ct-panel ct-history-panel">
            <div className="ct-panel-title">RECENT SCORES</div>
            {history.length === 0
              ? <p className="ct-empty">Your completed 30-second sessions will appear here.</p>
              : history.slice(0, 5).map((item, index) => (
                <div className="ct-history-row" key={`${item.date}-${index}`}>
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                  <small>{item.mode === "findSquare" ? "Find square" : "Name square"} · {item.orientation}</small>
                  <strong>{item.score}</strong>
                </div>
              ))}
          </section>
        </aside>
      </div>
    </main>
  );
}


