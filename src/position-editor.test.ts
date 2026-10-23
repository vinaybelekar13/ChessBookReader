import { describe, expect, it } from "vitest";
import {
  buildFullFen,
  countKings,
  EMPTY_PLACEMENT,
  flipFenPlacement,
  moveFenPiece,
  parseFenPlacement,
  sanitizeCastlingRights,
  setFenPiece,
  START_PLACEMENT,
  validatePositionFen,
  withFenPlacement,
} from "./position-editor";

describe("position editor", () => {
  it("parses compressed ranks into all 64 cells", () => {
    const board = parseFenPlacement(START_PLACEMENT);
    expect(board).toHaveLength(8);
    expect(board?.[0]).toEqual(["r", "n", "b", "q", "k", "b", "n", "r"]);
    expect(board?.[3]).toEqual(Array(8).fill(""));
  });

  it("adds and removes pieces without changing other squares", () => {
    expect(setFenPiece(EMPTY_PLACEMENT, 4, 3, "Q")).toBe("8/8/8/8/3Q4/8/8/8");
    expect(setFenPiece("8/8/8/8/3Q4/8/8/8", 4, 3, "")).toBe(EMPTY_PLACEMENT);
  });

  it("replaces a white piece with a black piece", () => {
    const withWhiteQueen = setFenPiece(EMPTY_PLACEMENT, 4, 3, "Q");
    const withBlackQueen = setFenPiece(withWhiteQueen, 4, 3, "q");
    expect(withBlackQueen).toBe("8/8/8/8/3q4/8/8/8");
  });

  it("moves pieces from one square to another", () => {
    const initial = setFenPiece(EMPTY_PLACEMENT, 4, 3, "N");
    const moved = moveFenPiece(initial, 4, 3, 2, 4);
    expect(moved).toBe("8/8/4N3/8/8/8/8/8");
  });

  it("rotates all squares by 180 degrees and retains the rest of a FEN", () => {
    expect(flipFenPlacement(START_PLACEMENT)).toBe("RNBKQBNR/PPPPPPPP/8/8/8/8/pppppppp/rnbkqbnr");
    expect(withFenPlacement(`${START_PLACEMENT} b - - 0 1`, EMPTY_PLACEMENT))
      .toBe(`${EMPTY_PLACEMENT} b - - 0 1`);
  });

  it("counts white and black kings accurately", () => {
    expect(countKings(EMPTY_PLACEMENT)).toEqual({ whiteKings: 0, blackKings: 0 });
    expect(countKings(START_PLACEMENT)).toEqual({ whiteKings: 1, blackKings: 1 });
    expect(countKings("8/8/8/8/4K3/8/8/4K3")).toEqual({ whiteKings: 2, blackKings: 0 });
  });

  it("sanitizes castling rights based on king and rook presence", () => {
    const boardStart = parseFenPlacement(START_PLACEMENT)!;
    expect(sanitizeCastlingRights(boardStart, "KQkq")).toBe("KQkq");

    // Remove white king from e1
    boardStart[7][4] = "";
    expect(sanitizeCastlingRights(boardStart, "KQkq")).toBe("kq");

    // Remove black kingside rook from h8
    boardStart[0][7] = "";
    expect(sanitizeCastlingRights(boardStart, "kq")).toBe("q");

    // Empty board
    const emptyBoard = parseFenPlacement(EMPTY_PLACEMENT)!;
    expect(sanitizeCastlingRights(emptyBoard, "KQkq")).toBe("-");
  });

  it("builds a full six-field FEN with appropriate defaults", () => {
    expect(buildFullFen(START_PLACEMENT, "w")).toBe(`${START_PLACEMENT} w KQkq - 0 1`);
    expect(buildFullFen("4k3/8/8/8/8/8/8/4K3", "b")).toBe("4k3/8/8/8/8/8/8/4K3 b - - 0 1");
  });

  it("validates chess positions thoroughly", () => {
    // Valid standard start
    expect(validatePositionFen(`${START_PLACEMENT} w KQkq - 0 1`)).toEqual({ isValid: true });

    // Valid custom endgame
    expect(validatePositionFen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")).toEqual({ isValid: true });

    // Missing white king
    const noWhiteKing = validatePositionFen("4k3/8/8/8/8/8/8/8 w - - 0 1");
    expect(noWhiteKing.isValid).toBe(false);
    expect(noWhiteKing.error).toContain("White king");

    // Missing black king
    const noBlackKing = validatePositionFen("8/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(noBlackKing.isValid).toBe(false);
    expect(noBlackKing.error).toContain("Black king");

    // Multiple kings
    const twoKings = validatePositionFen("4k3/8/8/8/8/8/4K3/4K3 w - - 0 1");
    expect(twoKings.isValid).toBe(false);
    expect(twoKings.error).toContain("White kings");

    // Pawns on edge rank
    const edgePawn = validatePositionFen("4k3/8/8/8/8/8/8/4KP2 w - - 0 1");
    expect(edgePawn.isValid).toBe(false);
    expect(edgePawn.error).toContain("first or eighth rank");

    // Malformed FEN
    expect(validatePositionFen("not-a-fen").isValid).toBe(false);
    expect(validatePositionFen("").isValid).toBe(false);
  });

  it("rejects malformed placements", () => {
    expect(parseFenPlacement("9/8/8/8/8/8/8/8")).toBeNull();
    expect(parseFenPlacement("8/8/8/8/8/8/8")).toBeNull();
  });
});
