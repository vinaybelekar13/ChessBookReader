import type { Square } from "chess.js";

export type ChessVariant =
  | "Standard"
  | "Chess960"
  | "King of the Hill"
  | "Three-check"
  | "Antichess"
  | "Atomic"
  | "Horde"
  | "Racing Kings"
  | "Crazyhouse";

export type ArrowBrush = "engine" | "threat" | "green" | "red" | "blue" | "yellow";

export interface BoardArrowShape {
  from: Square;
  to: Square;
  brush: ArrowBrush;
}

export interface BoardCircleShape {
  square: Square;
  brush: ArrowBrush;
}

export interface EngineEvaluation {
  cp: number | null;      // Centipawns from White's perspective (+20 = +0.2)
  mate: number | null;    // Mate in N from White's perspective
  depth: number;
  maxDepth: number;
  knodes: number;
  bestMoveUci: string;    // e.g. "e7e5"
  threatMoveUci?: string;
  pvUci: string[];        // e.g. ["e7e5", "g1f3", "b8c6", "f1b5", "g8f6", "e1g1"]
  pvSan: string[];        // e.g. ["e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O"]
  isCloud: boolean;
  multiPvLines?: {
    multipv: number;
    cp: number | null;
    mate: number | null;
    pvSan: string[];
    pvUci: string[];
  }[];
}

export interface MoveNode {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  uci: string;
  from: Square;
  to: Square;
  fen: string;
  evalFormatted?: string; // e.g. "+0.2"
  evalCp?: number | null;
  evalMate?: number | null;
}

export interface WikiBookEntry {
  eco: string;
  title: string;          // e.g. "1. e4 Â· King's Pawn opening"
  quote?: {
    text: string;
    author: string;
  };
  paragraphs: string[];
  plans?: string[];
}

export interface WikiBookArticle {
  title: string;
  extract: string;
  url: string;
  source: "Wikibooks";
}

export interface OpeningExplorerMoveStat {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

export interface OpeningExplorerData {
  opening: { eco: string; name: string } | null;
  white: number;
  draws: number;
  black: number;
  moves: OpeningExplorerMoveStat[];
  source: "lichess-api" | "builtin-master-book";
}

