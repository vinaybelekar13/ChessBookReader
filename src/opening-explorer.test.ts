import { describe, expect, it } from "vitest";
import { openingPositionAt, parseOpeningLine } from "./opening-explorer";
import { START_FEN } from "./model";

describe("opening explorer line parser", () => {
  it("starts from the normal initial position for an empty line", () => {
    expect(parseOpeningLine("").fen).toBe(START_FEN);
  });

  it("parses SAN and returns the resulting position", () => {
    const result = parseOpeningLine("1. e4 e5 2. Nf3 Nc6");
    expect(result.error).toBeNull();
    expect(result.sanMoves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(result.uciMoves).toEqual(["e2e4", "e7e5", "g1f3", "b8c6"]);
  });

  it("parses UCI moves", () => {
    const result = parseOpeningLine("e2e4 e7e5 g1f3");
    expect(result.error).toBeNull();
    expect(result.sanMoves).toEqual(["e4", "e5", "Nf3"]);
  });

  it("reports illegal moves without losing the valid prefix", () => {
    const result = parseOpeningLine("e4 e5 Qh9");
    expect(result.error).toContain("Invalid or illegal move");
    expect(result.sanMoves).toEqual(["e4", "e5"]);
  });

  it("returns the position at a requested ply", () => {
    const result = openingPositionAt("e4 e5 Nf3 Nc6", 2);
    expect(result.sanMoves).toEqual(["e4", "e5"]);
    expect(result.fen).toContain(" w KQkq ");
  });
});

