import { Chess, validateFen } from "chess.js";

const PIECE_CODES = /^[prnbqkPRNBQK]$/;

export const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
export const EMPTY_PLACEMENT = "8/8/8/8/8/8/8/8";

export const PIECE_LABELS: Record<string, string> = {
  "": "Empty square",
  P: "White pawn",
  N: "White knight",
  B: "White bishop",
  R: "White rook",
  Q: "White queen",
  K: "White king",
  p: "Black pawn",
  n: "Black knight",
  b: "Black bishop",
  r: "Black rook",
  q: "Black queen",
  k: "Black king",
};

export function parseFenPlacement(placement: string): string[][] | null {
  const ranks = placement.split("/");
  if (ranks.length !== 8) return null;
  const board: string[][] = [];
  for (const rank of ranks) {
    const squares: string[] = [];
    for (const token of rank) {
      if (/^[1-8]$/.test(token)) squares.push(...Array(Number(token)).fill(""));
      else if (PIECE_CODES.test(token)) squares.push(token);
      else return null;
    }
    if (squares.length !== 8) return null;
    board.push(squares);
  }
  return board;
}

export function serializeFenPlacement(board: string[][]): string {
  if (board.length !== 8 || board.some((rank) => rank.length !== 8)) {
    throw new Error("A chess position must contain exactly 64 squares.");
  }
  return board.map((rank) => {
    let result = "";
    let empty = 0;
    for (const piece of rank) {
      if (!piece) {
        empty += 1;
      } else {
        if (!PIECE_CODES.test(piece)) throw new Error(`Invalid chess piece code: ${piece}`);
        if (empty) result += empty;
        empty = 0;
        result += piece;
      }
    }
    if (empty) result += empty;
    return result;
  }).join("/");
}

export function setFenPiece(placement: string, row: number, col: number, piece: string): string {
  const board = parseFenPlacement(placement);
  if (!board || row < 0 || row > 7 || col < 0 || col > 7) {
    throw new Error("Cannot edit an invalid chessboard position.");
  }
  if (piece && !PIECE_CODES.test(piece)) throw new Error(`Invalid chess piece code: ${piece}`);
  board[row][col] = piece;
  return serializeFenPlacement(board);
}

export function moveFenPiece(placement: string, fromRow: number, fromCol: number, toRow: number, toCol: number): string {
  const board = parseFenPlacement(placement);
  if (!board || fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 || toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) {
    throw new Error("Cannot move a piece on an invalid chessboard position.");
  }
  const piece = board[fromRow][fromCol];
  if (!piece) return placement;
  board[fromRow][fromCol] = "";
  board[toRow][toCol] = piece;
  return serializeFenPlacement(board);
}

export function flipFenPlacement(placement: string): string {
  const board = parseFenPlacement(placement);
  if (!board) throw new Error("Cannot flip an invalid chessboard position.");
  return serializeFenPlacement(board.reverse().map((rank) => rank.reverse()));
}

export function withFenPlacement(fen: string, placement: string): string {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6 || !parseFenPlacement(placement)) {
    throw new Error("A complete six-field FEN is required.");
  }
  fields[0] = placement;
  return fields.join(" ");
}

export function countKings(placementOrFen: string): { whiteKings: number; blackKings: number } {
  const placement = placementOrFen.trim().split(/\s+/)[0];
  const board = parseFenPlacement(placement);
  let whiteKings = 0;
  let blackKings = 0;
  if (board) {
    for (const rank of board) {
      for (const square of rank) {
        if (square === "K") whiteKings += 1;
        if (square === "k") blackKings += 1;
      }
    }
  }
  return { whiteKings, blackKings };
}

export function sanitizeCastlingRights(board: string[][], currentCastling: string): string {
  if (!currentCastling || currentCastling === "-") return "-";
  let result = "";
  // White king must be on e1 (row 7, col 4)
  const whiteKingOnE1 = board[7]?.[4] === "K";
  if (whiteKingOnE1) {
    if (currentCastling.includes("K") && board[7]?.[7] === "R") result += "K";
    if (currentCastling.includes("Q") && board[7]?.[0] === "R") result += "Q";
  }
  // Black king must be on e8 (row 0, col 4)
  const blackKingOnE8 = board[0]?.[4] === "k";
  if (blackKingOnE8) {
    if (currentCastling.includes("k") && board[0]?.[7] === "r") result += "k";
    if (currentCastling.includes("q") && board[0]?.[0] === "r") result += "q";
  }
  return result || "-";
}

export function buildFullFen(
  placement: string,
  turn: "w" | "b" = "w",
  castling?: string,
  enPassant: string = "-",
  halfmove: number = 0,
  fullmove: number = 1
): string {
  const board = parseFenPlacement(placement);
  if (!board) throw new Error("Invalid piece placement for FEN generation.");
  let effectiveCastling = castling;
  if (!effectiveCastling) {
    effectiveCastling = placement === START_PLACEMENT ? "KQkq" : "-";
  } else {
    effectiveCastling = sanitizeCastlingRights(board, effectiveCastling);
  }
  return `${placement} ${turn} ${effectiveCastling} ${enPassant} ${halfmove} ${fullmove}`;
}

export function validatePositionFen(fen: string): { isValid: boolean; error?: string } {
  const trimmed = fen.trim();
  if (!trimmed) {
    return { isValid: false, error: "Position FEN cannot be empty." };
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 6) {
    return { isValid: false, error: "FEN must contain exactly 6 space-separated fields." };
  }
  const [placement, turn] = fields;
  const board = parseFenPlacement(placement);
  if (!board) {
    return { isValid: false, error: "Invalid board piece placement." };
  }

  let whiteKings = 0;
  let blackKings = 0;
  let invalidPawns = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece === "K") whiteKings += 1;
      if (piece === "k") blackKings += 1;
      if ((r === 0 || r === 7) && (piece === "P" || piece === "p")) {
        invalidPawns += 1;
      }
    }
  }

  if (whiteKings === 0) {
    return { isValid: false, error: "Position is missing a White king (K)." };
  }
  if (whiteKings > 1) {
    return { isValid: false, error: `Position has ${whiteKings} White kings. Exactly one is required.` };
  }
  if (blackKings === 0) {
    return { isValid: false, error: "Position is missing a Black king (k)." };
  }
  if (blackKings > 1) {
    return { isValid: false, error: `Position has ${blackKings} Black kings. Exactly one is required.` };
  }
  if (invalidPawns > 0) {
    return { isValid: false, error: "Pawns cannot be placed on the first or eighth rank." };
  }
  if (turn !== "w" && turn !== "b") {
    return { isValid: false, error: "Side to move must be 'w' (White) or 'b' (Black)." };
  }

  const result = validateFen(trimmed);
  if (!result.ok) {
    return { isValid: false, error: result.error || "Invalid chess position." };
  }

  try {
    new Chess(trimmed);
  } catch (err: unknown) {
    return { isValid: false, error: err instanceof Error ? err.message : String(err) };
  }

  return { isValid: true };
}
