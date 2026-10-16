const PIECE_CODES = /^[prnbqkPRNBQK]$/;

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
