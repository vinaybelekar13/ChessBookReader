import React from "react";
import type { MoveNode } from "./types";
import { toFigurativeSan } from "./CburnettPieces";

interface MoveListPanelProps {
  moves: MoveNode[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export const MoveListPanel: React.FC<MoveListPanelProps> = ({
  moves,
  currentPly,
  onSelectPly,
}) => {
  // Group moves into pairs (White + Black per full move number)
  const movePairs = React.useMemo(() => {
    const rows: { moveNumber: number; white?: MoveNode; black?: MoveNode }[] = [];
    for (const node of moves) {
      let row = rows[rows.length - 1];
      if (!row || row.moveNumber !== node.moveNumber) {
        row = { moveNumber: node.moveNumber };
        rows.push(row);
      }
      if (node.color === "w") row.white = node;
      else row.black = node;
    }
    return rows;
  }, [moves]);

  return (
    <div className="li-moves-container" role="region" aria-label="Move list">
      {movePairs.map((pair) => (
        <div key={pair.moveNumber} className="li-move-row">
          <div className="li-move-index">{pair.moveNumber}</div>

          {pair.white ? (
            <button
              type="button"
              className={`li-move-cell ${currentPly === pair.white.ply ? "active" : ""}`}
              onClick={() => onSelectPly(pair.white!.ply)}
            >
              <span className="li-move-san">{toFigurativeSan(pair.white.san)}</span>
              {pair.white.evalFormatted && (
                <span className="li-move-eval">{pair.white.evalFormatted}</span>
              )}
            </button>
          ) : (
            <div className="li-move-cell li-move-empty">...</div>
          )}

          {pair.black ? (
            <button
              type="button"
              className={`li-move-cell ${currentPly === pair.black.ply ? "active" : ""}`}
              onClick={() => onSelectPly(pair.black!.ply)}
            >
              <span className="li-move-san">{toFigurativeSan(pair.black.san)}</span>
              {pair.black.evalFormatted && (
                <span className="li-move-eval">{pair.black.evalFormatted}</span>
              )}
            </button>
          ) : (
            <div className="li-move-cell li-move-empty" />
          )}
        </div>
      ))}
    </div>
  );
};
