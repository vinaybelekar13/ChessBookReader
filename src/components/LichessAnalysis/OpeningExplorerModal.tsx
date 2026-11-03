import React from "react";
import type { OpeningExplorerData } from "./types";

interface OpeningExplorerModalProps {
  data: OpeningExplorerData | null;
  loading: boolean;
  recognisedOpening: { eco: string; name: string } | null;
  onPlayUciMove: (uci: string) => void;
}

export const OpeningExplorerModal: React.FC<OpeningExplorerModalProps> = ({
  data,
  loading,
  recognisedOpening,
  onPlayUciMove,
}) => {
  if (loading && !data) {
    return <div className="li-explorer-panel">Loading opening database…</div>;
  }
  if (!data) return null;

  const totalGames = data.white + data.draws + data.black;

  return (
    <div className="li-explorer-panel" aria-label="Opening Explorer">
      <div className="li-explorer-header">
        <strong>
          {recognisedOpening ? `${recognisedOpening.eco} ${recognisedOpening.name}` : data.opening ? `${data.opening.eco} ${data.opening.name}` : "Masters Opening Explorer"}
        </strong>
        <span>{totalGames.toLocaleString()} games</span>
      </div>

      <table className="li-explorer-table">
        <thead>
          <tr>
            <th>Move</th>
            <th>Games</th>
            <th>White / Draw / Black</th>
          </tr>
        </thead>
        <tbody>
          {data.moves.map((m) => {
            const sum = m.white + m.draws + m.black || 1;
            const wPct = Math.round((m.white / sum) * 100);
            const dPct = Math.round((m.draws / sum) * 100);
            const bPct = Math.max(0, 100 - wPct - dPct);

            return (
              <tr
                key={m.uci}
                className="li-explorer-row"
                onClick={() => onPlayUciMove(m.uci)}
              >
                <td className="li-explorer-san">{m.san}</td>
                <td className="li-explorer-count">{sum.toLocaleString()}</td>
                <td className="li-explorer-bar-cell">
                  <div className="li-explorer-tricolor-bar">
                    <span className="li-bar-w" style={{ width: `${wPct}%` }}>
                      {wPct >= 18 ? `${wPct}%` : ""}
                    </span>
                    <span className="li-bar-d" style={{ width: `${dPct}%` }}>
                      {dPct >= 18 ? `${dPct}%` : ""}
                    </span>
                    <span className="li-bar-b" style={{ width: `${bPct}%` }}>
                      {bPct >= 18 ? `${bPct}%` : ""}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

