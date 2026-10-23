import type { Square } from "chess.js";

export type BoardArrow = {
  from: Square;
  to: Square;
  color?: string;
};

export type SquareHighlight = {
  square: Square;
  color?: string;
};

export const ANNOTATION_COLORS = {
  red: "#EF5350",
  yellow: "#FFB52E",
  blue: "#29B6E6",
  green: "#8BC34A",
  engine: "#f0a23b",
} as const;

export function getAnnotationColor(event: {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}): string {
  if (event.shiftKey) return ANNOTATION_COLORS.green;
  if (event.ctrlKey || event.metaKey) return ANNOTATION_COLORS.yellow;
  if (event.altKey) return ANNOTATION_COLORS.blue;
  return ANNOTATION_COLORS.red;
}

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
  return ("abcdefgh"[file] + rank) as Square;
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
  return match ? { from: match[1] as Square, to: match[2] as Square, color: ANNOTATION_COLORS.engine } : null;
}

export function toggleArrow(arrows: BoardArrow[], next: BoardArrow): BoardArrow[] {
  const existing = arrows.findIndex((arrow) => arrow.from === next.from && arrow.to === next.to);
  if (existing < 0) return [...arrows, next];
  if (next.color && arrows[existing].color !== next.color) {
    return arrows.map((arrow, index) => (index === existing ? next : arrow));
  }
  return arrows.filter((_, index) => index !== existing);
}

export function toggleSquareHighlight(
  highlights: SquareHighlight[],
  square: Square,
  color: string = ANNOTATION_COLORS.red,
): SquareHighlight[] {
  const existing = highlights.findIndex((h) => h.square === square);
  if (existing < 0) return [...highlights, { square, color }];
  if (highlights[existing].color !== color) {
    return highlights.map((h, index) => (index === existing ? { square, color } : h));
  }
  return highlights.filter((_, index) => index !== existing);
}

export function getArrowPath(
  fromSquare: Square,
  toSquare: Square,
  flipped = false,
  shaftWidth = 0.22,
  headLength = 0.36,
  headWidth = 0.50,
): string {
  const from = squareCenter(fromSquare, flipped);
  const to = squareCenter(toSquare, flipped);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.2) return "";

  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const actualHeadLen = len < 0.7 ? len * 0.48 : headLength;
  const actualHeadWidth = len < 0.7 ? len * 0.65 : headWidth;
  const actualShaftWidth = len < 0.7 ? len * 0.28 : shaftWidth;

  const hs = actualShaftWidth / 2;
  const hw = actualHeadWidth / 2;

  const bx = to.x - actualHeadLen * ux;
  const by = to.y - actualHeadLen * uy;

  const tipX = to.x;
  const tipY = to.y;

  const headLeftX = bx + hw * nx;
  const headLeftY = by + hw * ny;
  const headRightX = bx - hw * nx;
  const headRightY = by - hw * ny;

  const shaftEndLeftX = bx + hs * nx;
  const shaftEndLeftY = by + hs * ny;
  const shaftEndRightX = bx - hs * nx;
  const shaftEndRightY = by - hs * ny;

  const shaftStartLeftX = from.x + hs * nx;
  const shaftStartLeftY = from.y + hs * ny;
  const shaftStartRightX = from.x - hs * nx;
  const shaftStartRightY = from.y - hs * ny;

  return [
    "M " + shaftStartLeftX.toFixed(4) + " " + shaftStartLeftY.toFixed(4),
    "L " + shaftEndLeftX.toFixed(4) + " " + shaftEndLeftY.toFixed(4),
    "L " + headLeftX.toFixed(4) + " " + headLeftY.toFixed(4),
    "L " + tipX.toFixed(4) + " " + tipY.toFixed(4),
    "L " + headRightX.toFixed(4) + " " + headRightY.toFixed(4),
    "L " + shaftEndRightX.toFixed(4) + " " + shaftEndRightY.toFixed(4),
    "L " + shaftStartRightX.toFixed(4) + " " + shaftStartRightY.toFixed(4),
    "A " + hs.toFixed(4) + " " + hs.toFixed(4) + " 0 0 0 " + shaftStartLeftX.toFixed(4) + " " + shaftStartLeftY.toFixed(4),
    "Z",
  ].join(" ");
}

