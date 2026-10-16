import { describe, expect, it } from "vitest";
import { START_FEN } from "./model";
import { fenWithTurn, makePosition } from "./chess-state";

describe("chess position state", () => {
  it("replays legal SAN from an arbitrary diagram position", () => {
    const game = makePosition(START_FEN, ["e4", "e5"], 2);
    expect(game.fen()).toContain(" w KQkq ");
    expect(game.history()).toEqual(["e4", "e5"]);
  });

  it("rejects invalid restored moves instead of substituting a position", () => {
    expect(() => makePosition(START_FEN, ["e5"], 1)).toThrow();
  });

  it("changes side to move and clears en-passant metadata", () => {
    expect(fenWithTurn("8/8/8/8/8/8/4k3/4K3 w - e6 0 1", "b"))
      .toBe("8/8/8/8/8/8/4k3/4K3 b - - 0 1");
  });
});
