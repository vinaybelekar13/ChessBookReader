from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

start = s.index("  function completePromotion(")
end = s.index("  function handleSquareClick(", start)

new_handlers = """  function completePromotion(piece: "q" | "r" | "b" | "n") {
    if (!promotionRequest || !boardSession) return;
    const activeBoard = boardSession;
    try {
      const currentGame = new Chess(activeBoard.currentFen);
      const result = currentGame.move({
        from: promotionRequest.from,
        to: promotionRequest.to,
        promotion: piece,
      });
      const nextMoves = [...activeBoard.moves.slice(0, activeBoard.moveIndex), result.san];
      patchBoardSession({
        currentFen: currentGame.fen(),
        moves: nextMoves,
        moveIndex: nextMoves.length,
      });
      updateGameEndOverlay(currentGame);
      setLastMove({ from: promotionRequest.from, to: promotionRequest.to });
      setSelectedSquare(null);
      setPromotionRequest(null);
      setError("");
    } catch {
      setError("Unable to complete pawn promotion.");
      setPromotionRequest(null);
    }
  }

  function makeMove(from: Square, to: Square) {
    if (!boardSession) return;
    const activeBoard = boardSession;
    try {
      const currentGame = new Chess(activeBoard.currentFen);
      const mover = currentGame.get(from);
      const promote = mover?.type === "p" && (to.endsWith("8") || to.endsWith("1"));
      if (promote) {
        setPromotionRequest({ from, to });
        return;
      }
      const result = currentGame.move({ from, to });
      const nextMoves = [...activeBoard.moves.slice(0, activeBoard.moveIndex), result.san];
      patchBoardSession({
        currentFen: currentGame.fen(),
        moves: nextMoves,
        moveIndex: nextMoves.length,
      });
      updateGameEndOverlay(currentGame);
      setLastMove({ from, to });
      setSelectedSquare(null);
      setError("");
    } catch {
      const piece = game.get(to);
      if (piece && piece.color === game.turn()) setSelectedSquare(to);
      else setSelectedSquare(null);
    }
  }

"""

s = s[:start] + new_handlers + s[end:]
p.write_text(s, encoding="utf-8", newline="")
print("Replaced both handlers with correctly scoped active-board state.")
