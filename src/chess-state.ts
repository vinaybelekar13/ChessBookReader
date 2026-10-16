import { Chess } from "chess.js";

export function makePosition(baseFen: string, moves: string[], moveIndex: number): Chess {
  const game = new Chess(baseFen);
  for (const san of moves.slice(0, moveIndex)) {
    const result = game.move(san);
    if (!result) throw new Error(`Saved move could not be replayed: ${san}`);
  }
  return game;
}

export function fenWithTurn(fen: string, turn: "w" | "b"): string {
  const fields = fen.split(/\s+/);
  if (fields.length !== 6) throw new Error("FEN must contain six fields.");
  fields[1] = turn;
  fields[3] = "-";
  fields[4] = "0";
  return fields.join(" ");
}
