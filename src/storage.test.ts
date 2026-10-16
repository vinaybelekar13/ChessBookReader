import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { newSession, START_FEN } from "./model";
import { getActiveBookId, getSession, putSession, setActiveBookId } from "./storage";

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("chessbook-reader");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

describe("per-book IndexedDB reading sessions", () => {
  it("restores exact analysis state independently for each book", async () => {
    const first = newSession("book-a");
    first.page = 42;
    first.selectedDiagramId = "diagram-3";
    first.originalFen = START_FEN;
    first.lineBaseFen = START_FEN;
    first.moves = ["e4", "e5", "Nf3"];
    first.moveIndex = 3;
    first.currentFen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
    first.flipped = true;

    const second = newSession("book-b");
    second.page = 118;
    second.currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    await Promise.all([putSession(first), putSession(second), setActiveBookId("book-a")]);
    const restoredFirst = await getSession("book-a");
    const restoredSecond = await getSession("book-b");

    expect(await getActiveBookId()).toBe("book-a");
    expect(restoredFirst).toMatchObject({
      page: 42,
      selectedDiagramId: "diagram-3",
      currentFen: first.currentFen,
      moves: ["e4", "e5", "Nf3"],
      moveIndex: 3,
      flipped: true,
    });
    expect(restoredSecond).toMatchObject({ page: 118, currentFen: second.currentFen, moves: [] });
  });
});
