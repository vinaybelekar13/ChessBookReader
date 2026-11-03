import { parseUciInfo, type EngineScore } from "./stockfish";

export type ReviewProgress = {
  completed: number;
  total: number;
  currentPly: number;
};

export type ReviewAnalysisOptions = {
  depth: number;
  onProgress?: (progress: ReviewProgress) => void;
};

type ReviewBatch = {
  fens: string[];
  depth: number;
  index: number;
  scores: EngineScore[];
  onProgress?: (progress: ReviewProgress) => void;
  resolve: (scores: EngineScore[]) => void;
  reject: (error: Error) => void;
};

export class ReviewEngine {
  private readonly worker: Worker;
  private ready = false;
  private disposed = false;
  private latestScore: EngineScore | null = null;
  private activeBatch: ReviewBatch | null = null;
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;

  private readonly readyPromise = new Promise<void>((resolve, reject) => {
    this.readyResolve = resolve;
    this.readyReject = reject;
  });

  constructor(workerUrl: string) {
    // Mark readiness rejection as handled even when no analysis is awaiting it.
    void this.readyPromise.catch(() => undefined);

    this.worker = new Worker(workerUrl);

    this.worker.onmessage = (event: MessageEvent<string>) => {
      this.handleLine(String(event.data));
    };

    this.worker.onerror = (event) => {
      this.fail(new Error(event.message || "Stockfish review worker failed."));
    };

    this.worker.postMessage("uci");
  }

  async analyzePositions(
    fens: string[],
    options: ReviewAnalysisOptions,
  ): Promise<EngineScore[]> {
    if (this.disposed) {
      throw new Error("The review engine has been disposed.");
    }

    if (this.activeBatch) {
      throw new Error("A review analysis is already running.");
    }

    if (fens.length === 0) {
      return [];
    }

    const depth = Math.max(1, Math.min(24, Math.floor(options.depth)));

    if (fens.some((fen) => !fen.trim())) {
      throw new Error("Every review position must contain a valid FEN.");
    }

    await this.readyPromise;

    if (this.disposed) {
      throw new Error("The review engine has been disposed.");
    }

    return new Promise<EngineScore[]>((resolve, reject) => {
      this.activeBatch = {
        fens: [...fens],
        depth,
        index: 0,
        scores: [],
        onProgress: options.onProgress,
        resolve,
        reject,
      };

      this.startPosition();
    });
  }

  cancel(): void {
    if (this.disposed) return;

    const batch = this.activeBatch;
    this.activeBatch = null;

    this.disposed = true;
    this.worker.terminate();

    const error = new Error("Review analysis was cancelled.");
    batch?.reject(error);
    this.readyReject(error);
  }

  dispose(): void {
    if (this.disposed) return;

    const batch = this.activeBatch;
    this.activeBatch = null;
    this.disposed = true;

    this.worker.terminate();

    const error = new Error("The review engine has been disposed.");
    batch?.reject(error);
    this.readyReject(error);
  }

  private handleLine(line: string): void {
    if (this.disposed) return;

    if (/^Error:/i.test(line)) {
      this.fail(new Error(line));
      return;
    }

    if (line === "uciok") {
      this.worker.postMessage("isready");
      return;
    }

    if (line === "readyok") {
      this.ready = true;
      this.readyResolve();
      return;
    }

    const batch = this.activeBatch;
    if (!batch) return;

    if (line.startsWith("info ")) {
      const sideToMove = batch.fens[batch.index].split(/\s+/)[1] === "b" ? "b" : "w";
      const parsed = parseUciInfo(line, sideToMove);

      if (parsed && (!this.latestScore || parsed.depth >= this.latestScore.depth)) {
        this.latestScore = parsed;
      }

      return;
    }

    if (!line.startsWith("bestmove ")) return;

    const bestMove = line.match(/^bestmove (\S+)/)?.[1];

    if (!this.latestScore) {
      this.fail(new Error(`Stockfish returned no evaluation for ply ${batch.index + 1}.`));
      return;
    }

    const score: EngineScore = {
      ...this.latestScore,
      ...(bestMove && bestMove !== "(none)" ? { bestMove } : {}),
    };

    batch.scores.push(score);
    batch.index += 1;

    batch.onProgress?.({
      completed: batch.index,
      total: batch.fens.length,
      currentPly: batch.index,
    });

    this.latestScore = null;

    if (batch.index >= batch.fens.length) {
      this.activeBatch = null;
      batch.resolve(batch.scores);
      return;
    }

    this.startPosition();
  }

  private startPosition(): void {
    const batch = this.activeBatch;
    if (!batch || this.disposed || !this.ready) return;

    this.latestScore = null;

    const fen = batch.fens[batch.index];
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${batch.depth}`);
  }

  private fail(error: Error): void {
    if (this.disposed) return;

    const batch = this.activeBatch;
    this.activeBatch = null;
    this.disposed = true;

    this.worker.terminate();
    batch?.reject(error);
    this.readyReject(error);
  }
}

