import type { Square } from "chess.js";

export type BoardArrow = { from: Square; to: Square };

export function boardSquareAtPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  flipped = false,
): Square | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const column = Math.floor((x / rect.width) * 8);
  const row = Math.floor((y / rect.height) * 8);
  const file = flipped ? 7 - column : column;
  const rank = flipped ? row + 1 : 8 - row;
  return `${"abcdefgh"[file]}${rank}` as Square;
}

export function squareCenter(square: Square, flipped = false): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return {
    x: (flipped ? 7 - file : file) + 0.5,
    y: (flipped ? rank : 7 - rank) + 0.5,
  };
}

export function parseBestMove(move: string | undefined): BoardArrow | null {
  const match = move?.match(/^([a-h][1-8])([a-h][1-8])[qrbn]?$/);
  return match ? { from: match[1] as Square, to: match[2] as Square } : null;
}

export function toggleArrow(arrows: BoardArrow[], next: BoardArrow): BoardArrow[] {
  const existing = arrows.findIndex((arrow) => arrow.from === next.from && arrow.to === next.to);
  return existing < 0 ? [...arrows, next] : arrows.filter((_, index) => index !== existing);
}
