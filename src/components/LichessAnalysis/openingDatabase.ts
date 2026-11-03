import { Chess } from "chess.js";
import rawOpenings from "./openings.json";

export interface OpeningRecord {
  eco: string;
  name: string;
  pgn: string;
  sanMoves: string[];
}

interface RawOpening {
  eco: string;
  name: string;
  pgn: string;
}

const parsedOpenings: OpeningRecord[] = [];

for (const record of rawOpenings as RawOpening[]) {
  try {
    const chess = new Chess();
    chess.loadPgn(record.pgn);

    const sanMoves = chess.history();

    if (sanMoves.length === 0) continue;

    parsedOpenings.push({
      eco: record.eco,
      name: record.name,
      pgn: record.pgn,
      sanMoves,
    });
  } catch {
    // Ignore malformed database entries.
  }
}

export const OPENING_DATABASE: OpeningRecord[] = parsedOpenings;

export type EcoGroup = "ALL" | "A" | "B" | "C" | "D" | "E";

function positionKey(fen: string): string {
  // Ignore half-move and full-move counters.
  return fen.split(/\s+/).slice(0, 4).join(" ");
}

const openingsByPosition = new Map<string, OpeningRecord[]>();

for (const opening of OPENING_DATABASE) {
  try {
    const chess = new Chess();
    chess.loadPgn(opening.pgn);

    const key = positionKey(chess.fen());
    const existing = openingsByPosition.get(key) ?? [];

    existing.push(opening);
    openingsByPosition.set(key, existing);
  } catch {
    // Ignore invalid records.
  }
}

// Prefer the shortest identifying line for duplicate positions.
for (const records of openingsByPosition.values()) {
  records.sort((a, b) => a.sanMoves.length - b.sanMoves.length);
}

export function identifyOpening(
  playedMoves: string[]
): OpeningRecord | null {
  try {
    const chess = new Chess();
    const positions: string[] = [positionKey(chess.fen())];

    for (const san of playedMoves) {
      chess.move(san);
      positions.push(positionKey(chess.fen()));
    }

    // Only recognise the current board position.
    // Do not keep displaying an old opening after the played line diverges.
    const currentPosition = positions[positions.length - 1];
    const matches = openingsByPosition.get(currentPosition);

    return matches?.[0] ?? null;
  } catch {
    return null;
  }
}

export function searchOpenings(
  query: string,
  group: EcoGroup = "ALL",
  limit = 40
): OpeningRecord[] {
  const normalizedQuery = query.trim().toLowerCase();

  return OPENING_DATABASE
    .filter((opening) => {
      const groupMatches =
        group === "ALL" || opening.eco.startsWith(group);

      if (!groupMatches) return false;
      if (!normalizedQuery) return true;

      return (
        opening.name.toLowerCase().includes(normalizedQuery) ||
        opening.eco.toLowerCase().includes(normalizedQuery) ||
        opening.pgn.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort(
      (a, b) =>
        a.eco.localeCompare(b.eco) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}

