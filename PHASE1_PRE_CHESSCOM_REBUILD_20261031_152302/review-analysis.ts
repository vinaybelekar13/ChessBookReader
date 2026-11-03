import type { EngineScore } from "./stockfish";
import { ReviewEngine, type ReviewProgress } from "./review-engine";
import type { ReviewGame } from "./review-pgn";

export type MoveClassification =
  | "Best"
  | "Excellent"
  | "Good"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder";

export type ClassificationThresholds = {
  best: number;
  excellent: number;
  good: number;
  inaccuracy: number;
  mistake: number;
};

export const DEFAULT_CLASSIFICATION_THRESHOLDS: ClassificationThresholds = {
  best: 10,
  excellent: 30,
  good: 80,
  inaccuracy: 150,
  mistake: 300,
};

export type ReviewedMove = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  from: string;
  to: string;
  promotion?: string;
  playedMoveUci: string;
  bestMove?: string;
  playedMoveIsBest: boolean;
  before: EngineScore;
  after: EngineScore;
  evaluationLossCp: number;
  classification: MoveClassification;
};

export type ReviewAnalysis = {
  depth: number;
  positionsAnalyzed: number;
  moves: ReviewedMove[];
  positionScores: EngineScore[];
};

export type ReviewEnginePort = Pick<ReviewEngine, "analyzePositions">;

export function scoreToWhiteCentipawns(score: EngineScore): number {
  if (score.kind === "cp") return score.value;

  const distance = Math.min(99999, Math.abs(score.value));
  return Math.sign(score.value || 1) * (100000 - distance);
}

export function calculateMoveLoss(
  before: EngineScore,
  after: EngineScore,
  color: "w" | "b",
): number {
  const beforeCp = scoreToWhiteCentipawns(before);
  const afterCp = scoreToWhiteCentipawns(after);

  const loss = color === "w"
    ? beforeCp - afterCp
    : afterCp - beforeCp;

  return Math.max(0, Math.round(loss));
}

export function classifyMove(
  lossCp: number,
  thresholds: ClassificationThresholds = DEFAULT_CLASSIFICATION_THRESHOLDS,
): MoveClassification {
  if (!Number.isFinite(lossCp) || lossCp < 0) {
    throw new Error("Evaluation loss must be a finite, non-negative number.");
  }

  if (
    thresholds.best < 0 ||
    thresholds.excellent < thresholds.best ||
    thresholds.good < thresholds.excellent ||
    thresholds.inaccuracy < thresholds.good ||
    thresholds.mistake < thresholds.inaccuracy
  ) {
    throw new Error("Classification thresholds must be non-negative and increasing.");
  }

  if (lossCp <= thresholds.best) return "Best";
  if (lossCp <= thresholds.excellent) return "Excellent";
  if (lossCp <= thresholds.good) return "Good";
  if (lossCp <= thresholds.inaccuracy) return "Inaccuracy";
  if (lossCp <= thresholds.mistake) return "Mistake";
  return "Blunder";
}

export function buildReviewAnalysis(
  review: ReviewGame,
  positionScores: EngineScore[],
  depth: number,
  thresholds: ClassificationThresholds = DEFAULT_CLASSIFICATION_THRESHOLDS,
): ReviewAnalysis {
  if (positionScores.length !== review.positions.length + 1) {
    throw new Error("Expected one engine evaluation for every game position.");
  }

  const moves = review.positions.map((move, index): ReviewedMove => {
    const before = positionScores[index];
    const after = positionScores[index + 1];

    if (!before || !after) {
      throw new Error(`Missing engine evaluation around ply ${move.ply}.`);
    }

    const playedMoveUci =
      `${move.from}${move.to}${move.promotion ?? ""}`;

    const playedMoveIsBest = before.bestMove
      ? before.bestMove.toLowerCase() === playedMoveUci.toLowerCase()
      : false;

    const evaluationLossCp = calculateMoveLoss(
      before,
      after,
      move.color,
    );

    return {
      ply: move.ply,
      moveNumber: move.moveNumber,
      color: move.color,
      san: move.san,
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
      playedMoveUci,
      ...(before.bestMove ? { bestMove: before.bestMove } : {}),
      playedMoveIsBest,
      before,
      after,
      evaluationLossCp,
      classification: playedMoveIsBest
        ? "Best"
        : classifyMove(evaluationLossCp, thresholds),
    };
  });

  return {
    depth,
    positionsAnalyzed: positionScores.length,
    moves,
    positionScores,
  };
}

export async function analyzeReviewPositions(
  review: ReviewGame,
  engine: ReviewEnginePort,
  options: {
    depth: number;
    onProgress?: (progress: ReviewProgress) => void;
    thresholds?: ClassificationThresholds;
  },
): Promise<ReviewAnalysis> {
  const depth = Math.max(1, Math.min(24, Math.floor(options.depth)));

  const fens = [
    review.startingFen,
    ...review.positions.map((position) => position.afterFen),
  ];

  const positionScores = await engine.analyzePositions(fens, {
    depth,
    onProgress: options.onProgress,
  });

  return buildReviewAnalysis(
    review,
    positionScores,
    depth,
    options.thresholds,
  );
}
