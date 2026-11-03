import React from "react";
import type { EngineEvaluation } from "./types";
import { computeWhiteBarPercentage, formatLichessEval } from "./stockfishWorkerClient";

interface EvaluationBarProps {
  evaluation: EngineEvaluation | null;
  enabled: boolean;
  flipped: boolean;
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({
  evaluation,
  enabled,
  flipped,
}) => {
  const whitePct = enabled ? computeWhiteBarPercentage(evaluation) : 50;
  const blackPct = 100 - whitePct;
  const label = enabled ? formatLichessEval(evaluation) : "0.0";

  return (
    <div
      className={`li-eval-gauge ${flipped ? "li-eval-flipped" : ""}`}
      title={`Evaluation: ${label}`}
      aria-label={`Evaluation bar ${label}`}
    >
      <div
        className="li-eval-black-bar"
        style={{ height: `${blackPct}%` }}
      />
      <div
        className="li-eval-white-bar"
        style={{ height: `${whitePct}%` }}
      />
      {/* Tick marks every 12.5% and orange 50% center marker matching Lichess */}
      <div className="li-eval-tick" style={{ top: "12.5%" }} />
      <div className="li-eval-tick" style={{ top: "25%" }} />
      <div className="li-eval-tick" style={{ top: "37.5%" }} />
      <div className="li-eval-zero-marker" />
      <div className="li-eval-tick" style={{ top: "62.5%" }} />
      <div className="li-eval-tick" style={{ top: "75%" }} />
      <div className="li-eval-tick" style={{ top: "87.5%" }} />
    </div>
  );
};
