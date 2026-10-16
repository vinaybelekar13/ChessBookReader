import { describe, expect, it } from "vitest";
import { boardSquareAtPoint, parseBestMove, squareCenter, toggleArrow } from "./board-annotations";

describe("chessboard annotation geometry", () => {
  const board = { left: 100, top: 50, width: 400, height: 400 };

  it("maps pointer coordinates to board squares at any displayed size", () => {
    expect(boardSquareAtPoint(125, 75, board)).toBe("a8");
    expect(boardSquareAtPoint(475, 425, board)).toBe("h1");
    expect(boardSquareAtPoint(500, 100, board)).toBeNull();
  });

  it("maps squares consistently when the board is flipped", () => {
    expect(boardSquareAtPoint(125, 75, board, true)).toBe("h1");
    expect(squareCenter("a1", false)).toEqual({ x: 0.5, y: 7.5 });
    expect(squareCenter("a1", true)).toEqual({ x: 7.5, y: 0.5 });
  });

  it("accepts valid UCI best moves and rejects absent or invalid moves", () => {
    expect(parseBestMove("e2e4")).toEqual({ from: "e2", to: "e4" });
    expect(parseBestMove("a7a8q")).toEqual({ from: "a7", to: "a8" });
    expect(parseBestMove("(none)")).toBeNull();
    expect(parseBestMove(undefined)).toBeNull();
  });

  it("toggles identical user arrows while preserving distinct arrows", () => {
    const first = { from: "e2" as const, to: "e4" as const };
    const second = { from: "d2" as const, to: "d4" as const };
    expect(toggleArrow([first], second)).toEqual([first, second]);
    expect(toggleArrow([first, second], first)).toEqual([second]);
  });
});
