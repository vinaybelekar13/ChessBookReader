import { describe, expect, it } from "vitest";
import { flipFenPlacement, parseFenPlacement, setFenPiece, withFenPlacement } from "./position-editor";

const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

describe("position editor", () => {
  it("parses compressed ranks into all 64 cells", () => {
    const board = parseFenPlacement(START_PLACEMENT);
    expect(board).toHaveLength(8);
    expect(board?.[0]).toEqual(["r", "n", "b", "q", "k", "b", "n", "r"]);
    expect(board?.[3]).toEqual(Array(8).fill(""));
  });

  it("adds and removes pieces without changing other squares", () => {
    expect(setFenPiece("8/8/8/8/8/8/8/8", 4, 3, "Q")).toBe("8/8/8/8/3Q4/8/8/8");
    expect(setFenPiece("8/8/8/8/3Q4/8/8/8", 4, 3, "")).toBe("8/8/8/8/8/8/8/8");
  });

  it("rotates all squares by 180 degrees and retains the rest of a FEN", () => {
    expect(flipFenPlacement(START_PLACEMENT)).toBe("RNBKQBNR/PPPPPPPP/8/8/8/8/pppppppp/rnbkqbnr");
    expect(withFenPlacement(`${START_PLACEMENT} b - - 0 1`, "8/8/8/8/8/8/8/8"))
      .toBe("8/8/8/8/8/8/8/8 b - - 0 1");
  });

  it("rejects malformed placements", () => {
    expect(parseFenPlacement("9/8/8/8/8/8/8/8")).toBeNull();
    expect(parseFenPlacement("8/8/8/8/8/8/8")).toBeNull();
  });
});
