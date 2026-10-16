import { afterEach, describe, expect, it, vi } from "vitest";
import { formatEvaluation, parseUciInfo, StockfishEngine, whiteScoreShare } from "./stockfish";

class FakeWorker {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  commands: string[] = [];
  terminated = false;
  postMessage(command: string) { this.commands.push(command); }
  terminate() { this.terminated = true; }
  send(data: string) { this.onmessage?.({ data } as MessageEvent<string>); }
}

afterEach(() => vi.unstubAllGlobals());

describe("Stockfish UCI evaluation", () => {
  it("converts side-to-move centipawns to the White perspective", () => {
    expect(parseUciInfo("info depth 12 score cp 74 pv e2e4 e7e5", "w"))
      .toEqual({ kind: "cp", value: 74, depth: 12, pv: ["e2e4", "e7e5"] });
    expect(parseUciInfo("info depth 15 score cp 74 pv e7e5", "b"))
      .toMatchObject({ kind: "cp", value: -74, depth: 15 });
  });

  it("orients mate scores and represents a checkmated side-to-move", () => {
    expect(parseUciInfo("info depth 20 score mate 3 pv e2e4", "w")?.value).toBe(3);
    expect(parseUciInfo("info depth 20 score mate 3 pv e7e5", "b")?.value).toBe(-3);
    expect(parseUciInfo("info depth 20 score mate 0", "w")?.value).toBe(-1);
    expect(formatEvaluation({ kind: "mate", value: -3, depth: 20 })).toBe("#-3");
  });

  it("keeps the evaluation bar bounded and consistent around equality", () => {
    const whiteAdvantage = { kind: "cp" as const, value: 250, depth: 12 };
    const blackAdvantage = { kind: "cp" as const, value: -250, depth: 12 };
    expect(formatEvaluation(whiteAdvantage)).toBe("+2.50");
    expect(whiteScoreShare(whiteAdvantage)).toBeGreaterThan(0.5);
    expect(whiteScoreShare(blackAdvantage)).toBeLessThan(0.5);
    expect(whiteScoreShare({ kind: "cp", value: 0, depth: 1 })).toBe(0.5);
    expect(whiteScoreShare({ kind: "cp", value: 9999, depth: 1 })).toBeLessThanOrEqual(0.96);
    expect(whiteScoreShare({ kind: "mate", value: -1, depth: 1 })).toBe(0.04);
  });

  it("initializes UCI, replaces stale analysis, and terminates the worker", () => {
    const worker = new FakeWorker();
    vi.stubGlobal("Worker", class {
      constructor() { return worker; }
    });
    const scores: (ReturnType<typeof parseUciInfo> | null)[] = [];
    const engine = new StockfishEngine("/stockfish.js", () => undefined, (score) => scores.push(score));
    worker.send("uciok");
    worker.send("readyok");
    expect(worker.commands).toEqual(["uci", "isready"]);

    engine.analyze("8/8/8/8/8/8/4k3/4K3 w - - 0 1", 12);
    engine.analyze("8/8/8/8/8/8/4k3/4K3 b - - 0 1", 16);
    expect(worker.commands.slice(-1)).toEqual(["stop"]);
    worker.send("info depth 11 score cp 80 pv e2e4");
    expect(scores.at(-1)).toBeNull();
    worker.send("bestmove e2e4");
    expect(worker.commands.slice(-2)).toEqual([
      "position fen 8/8/8/8/8/8/4k3/4K3 b - - 0 1",
      "go depth 16",
    ]);
    worker.send("info depth 16 score cp 35 pv e2e4");
    worker.send("bestmove e2e4");
    expect(scores.at(-1)).toMatchObject({ kind: "cp", value: -35, depth: 16, bestMove: "e2e4" });
    engine.dispose();
    expect(worker.terminated).toBe(true);
  });
});
