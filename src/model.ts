export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type Candidate = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  relativeScore?: number;
  confidence?: number;
  source: "automatic" | "manual";
};

export type BookRecord = {
  id: string;
  title: string;
  file: Blob;
  byteLength: number;
  lastOpenedAt: number;
  addedAt: number;
};

export type SavedPosition = {
  id: string;
  title: string;
  fen: string;
  page: number;
  savedAt: number;
};

export type BookSession = {
  bookId: string;
  page: number;
  pageCount: number;
  zoom: number;
  selectedDiagramId: string | null;
  candidatesByPage: Record<string, Candidate[]>;
  originalFen: string;
  lineBaseFen: string;
  currentFen: string;
  moves: string[];
  moveIndex: number;
  flipped: boolean;
  coordinates: boolean;
  bookmarks: number[];
  positions: SavedPosition[];
};

export function newSession(bookId: string): BookSession {
  return {
    bookId,
    page: 1,
    pageCount: 0,
    zoom: 1,
    selectedDiagramId: null,
    candidatesByPage: {},
    originalFen: START_FEN,
    lineBaseFen: START_FEN,
    currentFen: START_FEN,
    moves: [],
    moveIndex: 0,
    flipped: false,
    coordinates: true,
    bookmarks: [],
    positions: [],
  };
}
