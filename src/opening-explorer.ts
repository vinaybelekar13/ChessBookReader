import { Chess, type Square } from "chess.js";

export type OpeningLineResult = {
  fen: string;
  sanMoves: string[];
  uciMoves: string[];
  error: string | null;
};

export function parseOpeningLine(input: string): OpeningLineResult {
  const chess = new Chess();
  const sanMoves: string[] = [];
  const uciMoves: string[] = [];

  const tokens = input
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\$\d+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token));

  for (const token of tokens) {
    try {
      const uci = token.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
      const move = uci
        ? chess.move({
            from: uci[1].toLowerCase() as Square,
            to: uci[2].toLowerCase() as Square,
            promotion: uci[3]?.toLowerCase(),
          })
        : chess.move(token);

      sanMoves.push(move.san);
      uciMoves.push(`${move.from}${move.to}${move.promotion ?? ""}`);
    } catch {
      return {
        fen: chess.fen(),
        sanMoves,
        uciMoves,
        error: `Invalid or illegal move: ${token}`,
      };
    }
  }

  return { fen: chess.fen(), sanMoves, uciMoves, error: null };
}

export function openingPositionAt(input: string, ply: number): OpeningLineResult {
  const parsed = parseOpeningLine(input);
  if (parsed.error) return parsed;

  const limit = Math.max(0, Math.min(parsed.sanMoves.length, Math.floor(ply)));
  const chess = new Chess();
  const sanMoves: string[] = [];
  const uciMoves: string[] = [];

  for (let i = 0; i < limit; i++) {
    const move = chess.move(parsed.sanMoves[i]);
    sanMoves.push(move.san);
    uciMoves.push(`${move.from}${move.to}${move.promotion ?? ""}`);
  }

  return { fen: chess.fen(), sanMoves, uciMoves, error: null };
}