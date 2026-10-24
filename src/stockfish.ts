export type EngineStatus = "off" | "loading" | "ready" | "analyzing" | "error";
export type EngineScore = { kind: "cp" | "mate"; value: number; depth: number; bestMove?: string; pv?: string[] };

type UciRequest = { fen: string; depth: number };

export function parseUciInfo(line: string, sideToMove: "w" | "b"): Omit<EngineScore, "bestMove"> | null {
  if (!line.startsWith("info ")) return null;
  const depth = Number(line.match(/\bdepth (\d+)/)?.[1]);
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  if (!score || !Number.isFinite(depth)) return null;
  const value = Number(score[2]);
  const whiteValue = sideToMove === "w" ? value : -value;
  const kind = score[1] as "cp" | "mate";
  const orientedValue = kind === "mate" && value === 0
    ? (sideToMove === "w" ? -1 : 1)
    : whiteValue;
  const pv = line.match(/\bpv (.+)$/)?.[1]?.trim().split(/\s+/);
  return {
    kind,
    value: orientedValue,
    depth,
    ...(pv?.length ? { pv } : {}),
  };
}

export function formatEvaluation(score: EngineScore): string {
  if (score.kind === "mate") return `#${score.value > 0 ? "+" : ""}${score.value}`;
  const pawns = score.value / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

export function whiteScoreShare(score: EngineScore): number {
  if (score.kind === "mate") return score.value > 0 ? 0.96 : 0.04;
  const bounded = Math.max(-1000, Math.min(1000, score.value));
  return Math.max(0.04, Math.min(0.96, 1 / (1 + 10 ** (-bounded / 400))));
}

export class StockfishEngine {
  private readonly worker: Worker;
  private ready = false;
  private searching = false;
  private awaitingStop = false;
  private queued: UciRequest | null = null;
  private currentSide: "w" | "b" = "w";
  private latestScore: EngineScore | null = null;

  constructor(
    workerUrl: string,
    private readonly onStatus: (status: EngineStatus, message?: string) => void,
    private readonly onScore: (score: EngineScore | null) => void,
  ) {
    this.worker = new Worker(workerUrl);
    this.worker.onmessage = (event: MessageEvent<string>) => this.handleLine(String(event.data));
    this.worker.onerror = (event) => {
      this.onStatus("error", event.message || "The Stockfish worker failed to load.");
      this.dispose();
    };
    this.onStatus("loading");
    this.worker.postMessage("uci");
  }

  analyze(fen: string, depth: number): void {
    this.queued = { fen, depth: Math.max(1, Math.min(24, Math.floor(depth))) };
    this.latestScore = null;
    this.onScore(null);
    if (!this.ready) return;
    if (this.searching) {
      if (!this.awaitingStop) {
        this.awaitingStop = true;
        this.worker.postMessage("stop");
      }
      return;
    }
    this.startQueuedAnalysis();
  }

  dispose(): void {
    this.worker.terminate();
    this.ready = false;
    this.searching = false;
    this.queued = null;
  }

  private handleLine(line: string): void {
    if (/^Error:/i.test(line)) {
      this.onStatus("error", line);
      this.dispose();
      return;
    }
    if (line === "uciok") {
      this.worker.postMessage("isready");
      return;
    }
    if (line === "readyok") {
      this.ready = true;
      this.onStatus("ready");
      this.startQueuedAnalysis();
      return;
    }
    if (line.startsWith("info ")) {
      if (this.awaitingStop) return;
      const score = parseUciInfo(line, this.currentSide);
      if (score) {
        // Use the current principal variation's first move for a live arrow.
        // Stockfish's final "bestmove" will replace this provisional move.
        const provisionalMove = score.pv?.[0];
        this.latestScore = {
          ...score,
          ...(provisionalMove ? { bestMove: provisionalMove } : {}),
        };
        this.onScore(this.latestScore);
      }
      return;
    }
    const bestMove = line.match(/^bestmove (\S+)/)?.[1];
    if (!bestMove) return;
    this.searching = false;
    if (this.awaitingStop) {
      this.awaitingStop = false;
      this.startQueuedAnalysis();
      return;
    }
    if (this.latestScore) {
      this.latestScore = { ...this.latestScore, bestMove: bestMove === "(none)" ? undefined : bestMove };
      this.onScore(this.latestScore);
    }
    this.onStatus("ready");
  }

  private startQueuedAnalysis(): void {
    if (!this.ready || this.searching || !this.queued) return;
    const request = this.queued;
    this.queued = null;
    this.currentSide = request.fen.split(/\s+/)[1] === "b" ? "b" : "w";
    this.searching = true;
    this.latestScore = null;
    this.onStatus("analyzing");
    this.worker.postMessage(`position fen ${request.fen}`);
    this.worker.postMessage(`go depth ${request.depth}`);
  }
}
