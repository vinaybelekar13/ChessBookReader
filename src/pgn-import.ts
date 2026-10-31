import { Chess } from "chess.js";
import { START_FEN } from "./model";

export type ImportedPgn = {
  headers: Record<string, string>;
  lineBaseFen: string;
  moves: string[];
  finalFen: string;
};

export function parsePgn(pgn: string): ImportedPgn {
  const source = pgn.trim();

  if (!source) {
    throw new Error("Paste or select a PGN game first.");
  }

  const parsed = new Chess();

  try {
    parsed.loadPgn(source);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Unknown PGN error";
    throw new Error(`Invalid PGN: ${detail}`);
  }

  const headers = parsed.getHeaders();
  const customFen = headers.FEN?.trim();
  const lineBaseFen = customFen || START_FEN;

  let replay: Chess;

  try {
    replay = new Chess(lineBaseFen);
  } catch {
    throw new Error("The PGN contains an invalid starting FEN.");
  }

  const moves = parsed.history();

  if (moves.length === 0) {
    throw new Error("The PGN contains no moves.");
  }

  try {
    for (const san of moves) {
      replay.move(san);
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Unknown move error";
    throw new Error(`Could not replay the imported game: ${detail}`);
  }

  if (replay.fen() !== parsed.fen()) {
    throw new Error("The imported PGN could not be reproduced from its starting position.");
  }

  return {
    headers,
    lineBaseFen,
    moves,
    finalFen: replay.fen(),
  };
}
