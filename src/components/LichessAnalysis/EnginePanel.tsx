import React, { useState } from "react";
import { Target, Settings, Plus } from "lucide-react";
import type { EngineEvaluation } from "./types";
import { formatLichessEval } from "./stockfishWorkerClient";
import { toFigurativeSan } from "./CburnettPieces";

interface EnginePanelProps {
  enabled: boolean;
  onToggleEnabled: () => void;
  evaluation: EngineEvaluation | null;
  depth: number;
  onChangeDepth: (d: number) => void;
  showThreat: boolean;
  onToggleThreat: () => void;
  currentTurn: "w" | "b";
  currentMoveNumber: number;
  onPlayPvFirstMove?: (uci: string) => void;
}

export const EnginePanel: React.FC<EnginePanelProps> = ({
  enabled,
  onToggleEnabled,
  evaluation,
  depth,
  onChangeDepth,
  showThreat,
  onToggleThreat,
  currentTurn,
  currentMoveNumber,
  onPlayPvFirstMove,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pvExpanded, setPvExpanded] = useState(false);
  const [multiPvCount, setMultiPvCount] = useState(1);

  const evalFormatted = enabled ? formatLichessEval(evaluation) : "—";

  // Build formatted PV string matching `1... e5 2. ♘f3 ♘c6 3. ♗b5 ♘f6 4. O-O ♘xe4 5. ♖e1 ♘d6 6...`
  const formattedPvTokens = React.useMemo(() => {
    if (!enabled || !evaluation || evaluation.pvSan.length === 0) return [];
    const tokens: { label: string; uci?: string }[] = [];
    let moveNum = currentTurn === "b" ? Math.max(1, currentMoveNumber) : currentMoveNumber + 1;
    let side = currentTurn;

    evaluation.pvSan.forEach((san, idx) => {
      const fig = toFigurativeSan(san);
      const uci = evaluation.pvUci[idx];
      if (idx === 0 && side === "b") {
        tokens.push({ label: `${moveNum}... ${fig}`, uci });
        side = "w";
        moveNum++;
      } else if (side === "w") {
        tokens.push({ label: `${moveNum}. ${fig}`, uci });
        side = "b";
      } else {
        tokens.push({ label: fig, uci });
        side = "w";
        moveNum++;
      }
    });
    return tokens;
  }, [enabled, evaluation, currentTurn, currentMoveNumber]);

  return (
    <div className="li-ceval-section">
      {/* Top thin green engine progress bar */}
      <div className="li-ceval-progress-track">
        <div
          className="li-ceval-progress-bar"
          style={{ width: enabled ? `${Math.min(100, ((evaluation?.depth ?? depth) / 70) * 100)}%` : "0%" }}
        />
      </div>

      {/* Main Engine Header Strip */}
      <div className="li-ceval-header">
        {/* Lichess Green Toggle Switch with Checkmark */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle Stockfish evaluation"
          className={`li-ceval-switch ${enabled ? "on" : "off"}`}
          onClick={onToggleEnabled}
        >
          <span className="li-ceval-switch-knob">
            {enabled ? "✓" : ""}
          </span>
        </button>

        {/* Big Score Readout (+0.2) */}
        <output className="li-ceval-score">{evalFormatted}</output>

        {/* Engine Metadata Block (SF 19 1MB NNUE / Depth 70 CLOUD) */}
        <div className="li-ceval-meta">
          <div className="li-ceval-meta-top">
            <span className="li-sf-title">SF 19 1MB</span>
            <span className="li-nnue-badge">NNUE</span>
          </div>
          <div className="li-ceval-meta-bottom">
            <button
              type="button"
              className="li-depth-plus-btn"
              title="Increase search depth"
              onClick={() => onChangeDepth(Math.min(99, depth + 4))}
            >
              <Plus size={11} strokeWidth={3} />
            </button>
            <span className="li-depth-text">
              Depth {enabled ? evaluation?.depth ?? depth : 0}
            </span>
            {enabled && evaluation?.isCloud && (
              <span className="li-cloud-badge">CLOUD</span>
            )}
          </div>
        </div>

        {/* Right Controls: Threat Target & Settings Gear */}
        <div className="li-ceval-actions">
          <button
            type="button"
            className={`li-ceval-icon-btn ${showThreat ? "active" : ""}`}
            title="Show threat (x)"
            aria-label="Show threat"
            onClick={onToggleThreat}
          >
            <Target size={17} />
          </button>
          <button
            type="button"
            className={`li-ceval-icon-btn ${settingsOpen ? "active" : ""}`}
            title="Engine settings"
            aria-label="Engine settings"
            onClick={() => setSettingsOpen((s) => !s)}
          >
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Collapsible Engine Settings Drawer */}
      {settingsOpen && (
        <div className="li-ceval-settings-drawer">
          <label className="li-ceval-setting-row">
            <span>Search depth ({depth})</span>
            <input
              type="range"
              min={10}
              max={70}
              value={depth}
              onChange={(e) => onChangeDepth(Number(e.target.value))}
            />
          </label>
          <label className="li-ceval-setting-row">
            <span>Multiple lines ({multiPvCount})</span>
            <input
              type="range"
              min={1}
              max={3}
              value={multiPvCount}
              onChange={(e) => setMultiPvCount(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {/* Principal Variation Box (pv_box) */}
      <div className={`li-pv-box ${pvExpanded ? "expanded" : ""}`}>
        {enabled && formattedPvTokens.length > 0 ? (
          <>
            <div
              className="li-pv-line-text"
              title="Click to play best move on board"
              onClick={() => {
                if (evaluation?.bestMoveUci && onPlayPvFirstMove) {
                  onPlayPvFirstMove(evaluation.bestMoveUci);
                }
              }}
            >
              {formattedPvTokens.map((tok, i) => (
                <span key={i} className="li-pv-token">
                  {tok.label}{" "}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="li-pv-expand-caret"
              aria-label="Toggle full principal variation"
              onClick={() => setPvExpanded((e) => !e)}
            >
              ▾
            </button>
          </>
        ) : (
          <div className="li-pv-line-muted">
            {enabled ? "Calculating principal variation…" : "Engine disabled"}
          </div>
        )}
      </div>
    </div>
  );
};
