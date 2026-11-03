import { Chess } from "chess.js";
import { parsePgn } from "./pgn-import";

export type ReviewPosition = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  beforeFen: string;
  afterFen: string;
  from: string;
  to: string;
  promotion?: string;
  flags: string;
};

export type ReviewGame = {
  headers: Record<string, string>;
  startingFen: string;
  finalFen: string;
  positions: ReviewPosition[];
};

export function reconstructReviewGame(pgn: string): ReviewGame {
  const imported = parsePgn(pgn);
  const game = new Chess(imported.lineBaseFen);
  const positions: ReviewPosition[] = [];

  imported.moves.forEach((san, index) => {
    const beforeFen = game.fen();
    const move = game.move(san);

    positions.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      color: index % 2 === 0 ? "w" : "b",
      san: move.san,
      beforeFen,
      afterFen: game.fen(),
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
      flags: move.flags,
    });
  });

  if (game.fen() !== imported.finalFen) {
    throw new Error("Review reconstruction does not match the imported PGN.");
  }

  return {
    headers: imported.headers,
    startingFen: imported.lineBaseFen,
    finalFen: game.fen(),
    positions,
  };
}

export function getReviewFenAtPly(review: ReviewGame, ply: number): string {
  const safePly = Math.max(0, Math.min(review.positions.length, Math.floor(ply)));

  return safePly === 0
    ? review.startingFen
    : review.positions[safePly - 1].afterFen;
}
