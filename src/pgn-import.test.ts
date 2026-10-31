import { describe, expect, it } from "vitest";
import { parsePgn } from "./pgn-import";
import { START_FEN } from "./model";

describe("parsePgn", () => {
  it("parses a standard PGN and its headers", () => {
    const result = parsePgn(`[Event "Test Game"]
[White "Alice"]
[Black "Bob"]

1. e4 e5 2. Nf3 Nc6 *`);

    expect(result.headers.White).toBe("Alice");
    expect(result.headers.Black).toBe("Bob");
    expect(result.lineBaseFen).toBe(START_FEN);
    expect(result.moves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(result.finalFen).toBeTruthy();
  });

  it("supports a custom starting FEN", () => {
    const fen = "7k/8/8/8/8/8/8/KR6 w - - 0 1";
    const result = parsePgn(`[Event "Custom Position"]
[SetUp "1"]
[FEN "${fen}"]

1. Rb7 *`);

    expect(result.lineBaseFen).toBe(fen);
    expect(result.moves).toEqual(["Rb7"]);
  });

  it("rejects empty input", () => {
    expect(() => parsePgn("   ")).toThrow(/Paste or select/i);
  });

  it("rejects a PGN with no moves", () => {
    expect(() => parsePgn(`[Event "Empty Game"]

*`)).toThrow(/no moves/i);
  });

  it("rejects invalid move notation", () => {
    expect(() => parsePgn(`1. e4 ThisIsNotAMove`)).toThrow();
  });
});
