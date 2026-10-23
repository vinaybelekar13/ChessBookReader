import { describe, expect, it } from "vitest";
import {
  ANNOTATION_COLORS,
  boardSquareAtPoint,
  getAnnotationColor,
  getArrowPath,
  parseBestMove,
  squareCenter,
  toggleArrow,
  toggleSquareHighlight,
} from "./board-annotations";

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
    expect(parseBestMove("e2e4")).toEqual({ from: "e2", to: "e4", color: ANNOTATION_COLORS.engine });
    expect(parseBestMove("a7a8q")).toEqual({ from: "a7", to: "a8", color: ANNOTATION_COLORS.engine });
    expect(parseBestMove("(none)")).toBeNull();
    expect(parseBestMove(undefined)).toBeNull();
  });

  it("toggles identical user arrows while preserving distinct arrows", () => {
    const first = { from: "e2" as const, to: "e4" as const };
    const second = { from: "d2" as const, to: "d4" as const };
    expect(toggleArrow([first], second)).toEqual([first, second]);
    expect(toggleArrow([first, second], first)).toEqual([second]);
  });

  it("toggles arrow colors when repeated with a different color", () => {
    const red = { from: "e2" as const, to: "e4" as const, color: "#EF5350" };
    const green = { from: "e2" as const, to: "e4" as const, color: "#8BC34A" };
    expect(toggleArrow([red], green)).toEqual([green]);
    expect(toggleArrow([green], green)).toEqual([]);
  });

  it("toggles square highlights correctly", () => {
    expect(toggleSquareHighlight([], "e4")).toEqual([{ square: "e4", color: ANNOTATION_COLORS.red }]);
    expect(toggleSquareHighlight([{ square: "e4", color: ANNOTATION_COLORS.red }], "e4")).toEqual([]);
    expect(
      toggleSquareHighlight([{ square: "e4", color: ANNOTATION_COLORS.red }], "e4", ANNOTATION_COLORS.yellow),
    ).toEqual([{ square: "e4", color: ANNOTATION_COLORS.yellow }]);
  });

  it("resolves modifier key colors accurately", () => {
    expect(getAnnotationColor({ shiftKey: true })).toBe(ANNOTATION_COLORS.green);
    expect(getAnnotationColor({ ctrlKey: true })).toBe(ANNOTATION_COLORS.yellow);
    expect(getAnnotationColor({ altKey: true })).toBe(ANNOTATION_COLORS.blue);
    expect(getAnnotationColor({})).toBe(ANNOTATION_COLORS.red);
  });

  it("generates clean SVG arrow paths with triangular arrowhead and rounded base", () => {
    const path = getArrowPath("e2", "e4");
    expect(path).toContain("M ");
    expect(path).toContain(" L ");
    expect(path).toContain(" A ");
    expect(path.endsWith(" Z")).toBe(true);
    expect(getArrowPath("e4", "e4")).toBe("");
  });
});
