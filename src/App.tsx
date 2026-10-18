import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { fenWithTurn, makePosition } from "./chess-state";
import { boardSquareAtPoint, parseBestMove, squareCenter, toggleArrow, type BoardArrow } from "./board-annotations";
import { cropToPixels, editCrop, pointOnCanvas, type CropHandle } from "./crop-geometry";
import { flipFenPlacement, parseFenPlacement, setFenPiece, withFenPlacement } from "./position-editor";
import { formatEvaluation, StockfishEngine, whiteScoreShare, type EngineScore, type EngineStatus } from "./stockfish";
import {
  getActiveBookId,
  getBooks,
  getSession,
  getSession as getStoredSession,
  putBook,
  putSession,
  removeBook,
  removeSession,
  setActiveBookId,
} from "./storage";
import { newSession, START_FEN, type BookRecord, type BookSession, type Candidate } from "./model";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type LibraryTab = "all" | "recent" | "bookmarks" | "positions" | "progress" | "local";

const FILE_LIMIT = 100 * 1024 * 1024;
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8765").replace(/\/$/, "");
const CROP_HANDLES: CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
type CandidateInput = Omit<Candidate, "id" | "source" | "relativeScore"> &
  Partial<Pick<Candidate, "id" | "source" | "relativeScore">> & { relative_score?: number; confidence?: number };
type RecognitionResult = {
  fen: string;
  orientation: "normal" | "flipped" | "unknown";
  board_confidence: number;
  mean_piece_confidence: number | null;
  piece_count: number;
  warnings: string[];
};
type RecognitionStatus = "idle" | "loading" | "complete" | "failed";

const PIECE_LABELS: Record<string, string> = {
  "": "Empty square", P: "White pawn", N: "White knight", B: "White bishop",
  R: "White rook", Q: "White queen", K: "White king", p: "Black pawn",
  n: "Black knight", b: "Black bishop", r: "Black rook", q: "Black queen", k: "Black king",
};
function readableDate(timestamp: number): string {
  if (!timestamp) return "Not opened";
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function squareName(fileIndex: number, rankIndex: number): Square {
  return `${"abcdefgh"[fileIndex]}${rankIndex + 1}` as Square;
}

function normalizedCandidate(value: CandidateInput, index: number): Candidate {
  const { relative_score, confidence, ...candidate } = value;
  return {
    ...candidate,
    id: candidate.id || `candidate-${index + 1}`,
    source: candidate.source ?? "automatic",
    relativeScore: candidate.relativeScore ?? relative_score ?? confidence ?? 0,
  };
}

export default function App() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [sessionIndex, setSessionIndex] = useState<Record<string, BookSession>>({});
  const [book, setBook] = useState<BookRecord | null>(null);
  const [session, setSession] = useState<BookSession | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 900);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("recent");
  const [bookSearch, setBookSearch] = useState("");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [fenInput, setFenInput] = useState("");
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [userArrows, setUserArrows] = useState<BoardArrow[]>([]);
  const [arrowStart, setArrowStart] = useState<Square | null>(null);
  const [arrowHover, setArrowHover] = useState<Square | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [dragSelection, setDragSelection] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [cropEditingId, setCropEditingId] = useState<string | null>(null);
  const [transferCandidate, setTransferCandidate] = useState<Candidate | null>(null);
  const [transferPreview, setTransferPreview] = useState("");
  const [transferFen, setTransferFen] = useState("");
  const [recognitionStatus, setRecognitionStatus] = useState<RecognitionStatus>("idle");
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [recognitionError, setRecognitionError] = useState("");
  const [recognitionEdited, setRecognitionEdited] = useState(false);
  const [transferPiece, setTransferPiece] = useState("P");
  const [engineEnabled, setEngineEnabled] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("off");
  const [engineScore, setEngineScore] = useState<EngineScore | null>(null);
  const [engineMessage, setEngineMessage] = useState("");
  const [engineDepth, setEngineDepth] = useState(14);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageStageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const arrowGestureRef = useRef<Square | null>(null);
  const suppressBoardContextMenuRef = useRef(false);
const scanAbortControllerRef = useRef<AbortController | null>(null);
  const scanRequestIdRef = useRef(0);
  const transferRequestRef = useRef(0);
  const cropEditStartRef = useRef<{ candidate: Candidate; handle: CropHandle; point: { x: number; y: number } } | null>(null);
  const cropBaselineRef = useRef<Candidate | null>(null);
  const engineRef = useRef<StockfishEngine | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const [storedBooks, activeId] = await Promise.all([getBooks(), getActiveBookId()]);
        const storedSessions: Record<string, BookSession> = {};
        await Promise.all(storedBooks.map(async (item) => {
          const stored = await getStoredSession(item.id);
          if (stored) storedSessions[item.id] = stored;
        }));
        if (cancelled) return;
        const ordered = storedBooks.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
        setSessionIndex(storedSessions);
        const activeBook = ordered.find((item) => item.id === activeId) ?? ordered[0] ?? null;
        if (activeBook) {
          const resumed = { ...activeBook, lastOpenedAt: Date.now() };
          await putBook(resumed);
          setBooks([resumed, ...ordered.filter((item) => item.id !== resumed.id)]);
          setBook(resumed);
          setSession(storedSessions[activeBook.id] ?? newSession(activeBook.id));
          if (activeBook.id !== activeId) await setActiveBookId(activeBook.id);
        } else {
          setBooks(ordered);
        }
      } catch (cause) {
        if (!cancelled) setError(`Could not restore the local library: ${messageOf(cause)}`);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !book || !session) return;
    const snapshot = session;
    void Promise.all([putSession(snapshot), setActiveBookId(book.id)])
      .then(() => setSessionIndex((current) => ({ ...current, [snapshot.bookId]: snapshot })))
      .catch((cause: unknown) => setError(`Could not save reading session: ${messageOf(cause)}`));
  }, [ready, book, session]);

  useEffect(() => {
    pdfRef.current?.cleanup();
    void loadingTaskRef.current?.destroy();
    setPdf(null);
    if (!book) {
      pdfRef.current = null;
      loadingTaskRef.current = null;
      return;
    }
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setPdfLoading(true);
    setError("");
    book.file.slice(0).arrayBuffer().then((data) => {
      if (cancelled) return;
      loadingTask = getDocument({ data });
      loadingTaskRef.current = loadingTask;
      return loadingTask.promise;
    }).then((document) => {
      if (!document) return;
      if (cancelled) {
        void document.cleanup();
        return;
      }
      pdfRef.current = document;
      setPdf(document);
      setPdfLoading(false);
      setSession((current) => current ? { ...current, pageCount: document.numPages } : current);
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setPdfLoading(false);
        setError(`Could not open this PDF: ${messageOf(cause)}`);
      }
    });
    return () => {
      cancelled = true;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [book]);

  useEffect(() => {
    if (!pdf || !session || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    setRendering(true);
    pdf.getPage(session.page).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: session.zoom * Math.min(1.4, 1100 / page.getViewport({ scale: 1 }).width) });
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({ canvas, canvasContext: context, viewport });
      renderTaskRef.current = task;
      return task.promise;
    }).then(() => {
      if (!cancelled) setRendering(false);
    }).catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof Error && cause.name === "RenderingCancelledException")) {
        setRendering(false);
        setError(`Could not render page ${session.page}: ${messageOf(cause)}`);
      }
    });
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, session?.page, session?.zoom]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!session || !book || isTypingTarget(event.target)) return;
      if (cropEditingId && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const candidate = (session.candidatesByPage[String(session.page)] ?? []).find((item) => item.id === cropEditingId);
        if (!candidate) return;
        const step = event.shiftKey ? 0.01 : 0.002;
        const x = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const y = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        const next = editCrop(candidate, "move", x, y);
        patchSession((current) => {
          const pageKey = String(current.page);
          return {
            ...current,
            candidatesByPage: {
              ...current.candidatesByPage,
              [pageKey]: (current.candidatesByPage[pageKey] ?? []).map((item) =>
                item.id === candidate.id ? { ...item, ...next } : item),
            },
          };
        });
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowLeft") changePage(-1);
      if (event.key === "ArrowRight") changePage(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => () => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  const sortedBooks = useMemo(() => [...books].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt), [books]);
  const visibleBooks = useMemo(() => {
    const needle = bookSearch.trim().toLowerCase();
    return sortedBooks.filter((item) => {
      const saved = sessionIndex[item.id];
      const matchesTab =
        libraryTab === "all" || libraryTab === "recent" || libraryTab === "local" ||
        (libraryTab === "bookmarks" && (saved?.bookmarks.length ?? 0) > 0) ||
        (libraryTab === "positions" && (saved?.positions.length ?? 0) > 0) ||
        (libraryTab === "progress" && (saved?.page ?? 1) > 1);
      return matchesTab && item.title.toLowerCase().includes(needle);
    });
  }, [bookSearch, libraryTab, sessionIndex, sortedBooks]);

  const game = useMemo(() => {
    if (!session) return new Chess();
    try {
      return makePosition(session.lineBaseFen, session.moves, session.moveIndex);
    } catch {
      try { return new Chess(session.currentFen); } catch { return new Chess(); }
    }
  }, [session]);
  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    return new Set(game.moves({ square: selectedSquare, verbose: true }).map((move) => move.to));
  }, [game, selectedSquare]);
  const pieceSquares = game.board();
  const moveHistory = useMemo(() => {
    try { return makePosition(session?.lineBaseFen ?? START_FEN, session?.moves ?? [], session?.moveIndex ?? 0).history({ verbose: true }); }
    catch { return []; }
  }, [session]);
  const highlightedMove = lastMove ?? (moveHistory.length
    ? { from: moveHistory[moveHistory.length - 1].from, to: moveHistory[moveHistory.length - 1].to }
    : null);
  const engineArrow = useMemo(
    () => engineEnabled ? parseBestMove(engineScore?.bestMove) : null,
    [engineEnabled, engineScore?.bestMove],
  );

  useEffect(() => {
    setUserArrows([]);
    setArrowStart(null);
    setArrowHover(null);
    setAnnotationMode(false);
  }, [book?.id, session?.currentFen]);

  useEffect(() => {
    if (engineEnabled) engineRef.current?.analyze(game.fen(), engineDepth);
  }, [engineEnabled, session?.currentFen, session?.moveIndex, engineDepth]);

  function messageOf(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }

  function toggleEngine() {
    if (engineEnabled) {
      engineRef.current?.dispose();
      engineRef.current = null;
      setEngineEnabled(false);
      setEngineStatus("off");
      setEngineScore(null);
      setEngineMessage("");
      return;
    }
    try {
      setEngineScore(null);
      setEngineMessage("");
      const client = new StockfishEngine(
        `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`,
        (status, message) => {
          setEngineStatus(status);
          if (status === "error") {
            setEngineMessage(message || "Stockfish could not start. Check the engine assets and browser worker support.");
            setEngineEnabled(false);
            setEngineScore(null);
            engineRef.current?.dispose();
            engineRef.current = null;
          }
        },
        setEngineScore,
      );
      engineRef.current = client;
      setEngineEnabled(true);
    } catch (cause) {
      setEngineStatus("error");
      setEngineMessage(`Stockfish could not start: ${messageOf(cause)}`);
      setEngineEnabled(false);
    }
  }

  function patchSession(change: Partial<BookSession> | ((current: BookSession) => BookSession)) {
    setSession((current) => {
      if (!current) return current;
      return typeof change === "function" ? change(current) : { ...current, ...change };
    });
  }

  async function openBook(item: BookRecord) {
    try {
      const existing = sessionIndex[item.id] ?? await getSession(item.id);
      const nextSession = existing ?? newSession(item.id);
      const opened = { ...item, lastOpenedAt: Date.now() };
      await Promise.all([putBook(opened), putSession(nextSession), setActiveBookId(opened.id)]);
      setBooks((current) => [...current.filter((candidate) => candidate.id !== opened.id), opened].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt));
      setSessionIndex((current) => ({ ...current, [opened.id]: nextSession }));
      setBook(opened);
      setSession(nextSession);
      setNotice(`Opened ${opened.title}`);
      setError("");
      setSelectedSquare(null);
    } catch (cause) {
      setError(`Could not open book: ${messageOf(cause)}`);
    }
  }

  async function addBook(file?: File) {
    if (!file) return;
    try {
      if (file.size > FILE_LIMIT) throw new Error("PDFs must be 100 MB or smaller.");
      const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (new TextDecoder().decode(header) !== "%PDF-") throw new Error("The selected file does not contain a valid PDF header.");
      const now = Date.now();
      const created: BookRecord = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ""),
        file: file.slice(0, file.size, "application/pdf"),
        byteLength: file.size,
        lastOpenedAt: now,
        addedAt: now,
      };
      const blank = newSession(created.id);
      await Promise.all([putBook(created), putSession(blank), setActiveBookId(created.id)]);
      setBooks((current) => [created, ...current]);
      setSessionIndex((current) => ({ ...current, [created.id]: blank }));
      setBook(created);
      setSession(blank);
      setNotice("PDF added to this browser's local library.");
      setError("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (cause) {
      setError(`Could not add PDF: ${messageOf(cause)}`);
    }
  }

  async function deleteBook(item: BookRecord) {
    if (!window.confirm(`Delete "${item.title}" and its saved reading progress from this browser? This cannot be undone.`)) return;

    try {
      await removeBook(item.id);
      await removeSession(item.id);

      setBooks((current) => current.filter((entry) => entry.id !== item.id));
      setSessionIndex((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });

      if (book?.id === item.id) {
        setBook(null);
        setSession(null);
        setPdf(null);
      }

      setNotice(`Removed "${item.title}" from your library.`);
      setError("");
    } catch (cause) {
      setError(`Could not remove book: ${messageOf(cause)}`);
    }
  }
  async function renameBook(item: BookRecord) {
    const title = window.prompt("Book title", item.title)?.trim();
    if (!title || title === item.title) return;
    const renamed = { ...item, title };
    try {
      await putBook(renamed);
      setBooks((current) => current.map((entry) => entry.id === item.id ? renamed : entry));
      if (book?.id === item.id) setBook(renamed);
    } catch (cause) {
      setError(`Could not rename book: ${messageOf(cause)}`);
    }
  }

  function changePage(delta: number) {
    if (!session) return;
    patchSession({ page: Math.max(1, Math.min(session.pageCount || 999_999, session.page + delta)) });
  }

  function goToPage(value: number) {
    if (!session || !Number.isFinite(value)) return;
    patchSession({ page: Math.max(1, Math.min(session.pageCount || 1, Math.floor(value))) });
  }

  function moveToPosition(fen: string): boolean {
    if (!session) return false;
    try {
      const next = new Chess(fen);
      patchSession({
        originalFen: fen,
        lineBaseFen: fen,
        currentFen: next.fen(),
        moves: [],
        moveIndex: 0,
      });
      setLastMove(null);
      setSelectedSquare(null);
      setNotice("Position loaded. Reset Board returns to this diagram position.");
      return true;
    } catch (cause) {
      setError(`Invalid chess position: ${messageOf(cause)}`);
      return false;
    }
  }

  function selectCandidate(candidate: Candidate) {
    if (!session) return;
    setCropEditingId(null);
    cropBaselineRef.current = null;
    patchSession({ selectedDiagramId: candidate.id });
    setNotice("Region selected. The current chess position is unchanged; use Adjust Crop or Use on Board to continue.");
  }

  function adjustSelectedCrop(candidate: Candidate) {
    if (cropEditingId !== candidate.id) cropBaselineRef.current = candidate;
    setCropEditingId(candidate.id);
  }

  function resetSelectedCrop() {
    const baseline = cropBaselineRef.current;
    if (!baseline || !session) return;
    patchSession((current) => {
      const pageKey = String(current.page);
      return {
        ...current,
        candidatesByPage: {
          ...current.candidatesByPage,
          [pageKey]: (current.candidatesByPage[pageKey] ?? []).map((candidate) =>
            candidate.id === baseline.id ? baseline : candidate),
        },
      };
    });
  }

  function cancelCandidateSelection() {
    const baseline = cropBaselineRef.current;
    if (baseline && session) {
      patchSession((current) => {
        const pageKey = String(current.page);
        return {
          ...current,
          candidatesByPage: {
            ...current.candidatesByPage,
            [pageKey]: (current.candidatesByPage[pageKey] ?? []).map((candidate) =>
              candidate.id === baseline.id ? baseline : candidate),
          },
        };
      });
    }
    setCropEditingId(null);
    cropBaselineRef.current = null;
    patchSession({ selectedDiagramId: null });
  }

  async function openTransfer(candidate: Candidate) {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      setError("The rendered page image is unavailable. Rerender the page before using this crop.");
      return;
    }
    let preview: HTMLCanvasElement;
    try {
      const crop = cropToPixels(candidate, canvas.width, canvas.height);
      preview = document.createElement("canvas");
      preview.width = crop.width;
      preview.height = crop.height;
      const context = preview.getContext("2d");
      if (!context) throw new Error("Could not prepare a crop preview in this browser.");
      context.drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    } catch (cause) {
      setError(`Could not create the crop preview: ${messageOf(cause)}`);
      return;
    }
    setTransferCandidate(candidate);
    setTransferPreview(preview.toDataURL("image/png"));
    setTransferFen("");
    setRecognitionResult(null);
    setRecognitionEdited(false);
    setRecognitionError("");
    setTransferPiece("P");
    const requestId = ++transferRequestRef.current;
    setRecognitionStatus("loading");
    try {
      const image = await new Promise<Blob>((resolve, reject) => {
        preview.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode the selected crop.")), "image/png");
      });
      const form = new FormData();
      form.append("image", image, `board-crop-${candidate.id}.png`);
      const response = await fetch(`${API_BASE}/recognize`, { method: "POST", body: form });
      const result = await response.json() as RecognitionResult & { detail?: string };
      if (!response.ok) throw new Error(result.detail ?? `Recognition service returned HTTP ${response.status}.`);
      if (requestId !== transferRequestRef.current) return;
      setTransferFen(result.fen);
      setRecognitionResult(result);
      setRecognitionStatus("complete");
      // A successful scan immediately becomes the active analysis position.
      // Keep the review dialog open so the user can correct uncertain squares;
      // the explicit confirmation button remains available for corrected FENs.
      if (moveToPosition(result.fen)) {
        setNotice("Scanned position loaded automatically onto the analysis board. Review the diagram and correct any uncertain squares before continuing.");
      }
    } catch (cause) {
      if (requestId !== transferRequestRef.current) return;
      setRecognitionStatus("failed");
      setRecognitionError(messageOf(cause));
    }
  }

  function closeTransfer() {
    transferRequestRef.current += 1;
    setTransferCandidate(null);
    setTransferPreview("");
    setTransferFen("");
    setRecognitionStatus("idle");
    setRecognitionResult(null);
    setRecognitionError("");
    setRecognitionEdited(false);
  }

  function editTransferSquare(displayRow: number, displayCol: number) {
    const fields = transferFen.trim().split(/\s+/);
    if (fields.length !== 6) {
      setRecognitionError("Enter or recognize a six-field FEN before editing individual squares.");
      return;
    }
    const board = parseFenPlacement(fields[0]);
    if (!board) {
      setRecognitionError("The FEN piece placement is invalid. Correct it before editing squares.");
      return;
    }
    const row = displayRow;
    const col = displayCol;
    try {
      const placement = setFenPiece(fields[0], row, col, transferPiece);
      setTransferFen(withFenPlacement(transferFen, placement));
      setRecognitionEdited(true);
      setRecognitionError("");
    } catch (cause) {
      setRecognitionError(messageOf(cause));
    }
  }

  function flipTransferPosition() {
    const fields = transferFen.trim().split(/\s+/);
    if (fields.length !== 6) {
      setRecognitionError("Recognize a position or enter a complete FEN before flipping it.");
      return;
    }
    try {
      setTransferFen(withFenPlacement(transferFen, flipFenPlacement(fields[0])));
      setRecognitionEdited(true);
      setRecognitionError("");
    } catch (cause) {
      setRecognitionError(messageOf(cause));
    }
  }

  function confirmTransfer() {
    if (!transferCandidate) return;
    if (!transferFen.trim()) {
      setRecognitionError("Enter or recognize a FEN position first.");
      return;
    }
    if (moveToPosition(transferFen.trim())) {
      closeTransfer();
    }
  }

  function makeMove(from: Square, to: Square) {
    if (!session) return;
    try {
      const currentGame = new Chess(session.currentFen);
      const mover = currentGame.get(from);
      const promote = mover?.type === "p" && (to.endsWith("8") || to.endsWith("1"));
      let promotion: "q" | "r" | "b" | "n" = "q";
      if (promote) {
        const choice = window.prompt("Promote to queen, rook, bishop, or knight? (q/r/b/n)", "q")?.toLowerCase();
        if (!choice) return;
        switch (choice) {
          case "q": promotion = "q"; break;
          case "r": promotion = "r"; break;
          case "b": promotion = "b"; break;
          case "n": promotion = "n"; break;
          default:
            setError("Promotion must be q, r, b, or n.");
            return;
        }
      }
      const result = currentGame.move({ from, to, promotion });
      const nextMoves = [...session.moves.slice(0, session.moveIndex), result.san];
      patchSession({
        currentFen: currentGame.fen(),
        moves: nextMoves,
        moveIndex: nextMoves.length,
      });
      setLastMove({ from, to });
      setSelectedSquare(null);
      setError("");
    } catch {
      const piece = game.get(to);
      if (piece && piece.color === game.turn()) setSelectedSquare(to);
      else setSelectedSquare(null);
    }
  }

  function handleSquareClick(square: Square) {
    if (!session) return;
    if (annotationMode) {
      if (!arrowStart) {
        setArrowStart(square);
        return;
      }
      if (arrowStart !== square) setUserArrows((arrows) => toggleArrow(arrows, { from: arrowStart, to: square }));
      setArrowStart(null);
      setArrowHover(null);
      return;
    }
    if (selectedSquare && legalTargets.has(square)) {
      makeMove(selectedSquare, square);
      return;
    }
    const piece = game.get(square);
    if (piece?.color === game.turn()) setSelectedSquare(square);
    else setSelectedSquare(null);
  }

  function boardArrowPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 2 || !boardRef.current) return;
    event.preventDefault();
    const bounds = boardRef.current.getBoundingClientRect();
    const square = boardSquareAtPoint(event.clientX, event.clientY, bounds, Boolean(session?.flipped));
    if (!square) return;
    suppressBoardContextMenuRef.current = true;
    arrowGestureRef.current = square;
    setArrowStart(square);
    setArrowHover(square);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function boardArrowPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!arrowGestureRef.current || !boardRef.current) return;
    const bounds = boardRef.current.getBoundingClientRect();
    setArrowHover(boardSquareAtPoint(event.clientX, event.clientY, bounds, Boolean(session?.flipped)));
  }

  function boardArrowPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const from = arrowGestureRef.current;
    if (!from || !boardRef.current) return;
    const bounds = boardRef.current.getBoundingClientRect();
    const to = boardSquareAtPoint(event.clientX, event.clientY, bounds, Boolean(session?.flipped));
    if (to && to !== from) setUserArrows((arrows) => toggleArrow(arrows, { from, to }));
    arrowGestureRef.current = null;
    setArrowStart(null);
    setArrowHover(null);
  }

  function cancelBoardArrowGesture() {
    arrowGestureRef.current = null;
    setArrowStart(null);
    setArrowHover(null);
  }

  function jumpToMove(index: number) {
    if (!session) return;
    try {
      const next = makePosition(session.lineBaseFen, session.moves, index);
      const last = next.history({ verbose: true }).at(-1);
      patchSession({ moveIndex: index, currentFen: next.fen() });
      setLastMove(last ? { from: last.from, to: last.to } : null);
      setSelectedSquare(null);
    } catch (cause) {
      setError(`Could not navigate to move: ${messageOf(cause)}`);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
    } catch (cause) {
      setError(`Clipboard access failed: ${messageOf(cause)}`);
    }
  }

  function stopBoardScan() {
    const controller = scanAbortControllerRef.current;
    if (!controller) return;

    ++scanRequestIdRef.current;
    scanAbortControllerRef.current = null;
    controller.abort();
    setDetecting(false);
    setNotice("Scan cancelled.");

    patchSession((current) => ({
      ...current,
      candidatesByPage: {
        ...current.candidatesByPage,
        [String(current.page)]: [],
      },
      selectedDiagramId: null,
    }));
  }


  function clearBoardScan() {
    // Invalidate any pending response before aborting the request.
    ++scanRequestIdRef.current;

    const controller = scanAbortControllerRef.current;
    scanAbortControllerRef.current = null;
    controller?.abort();

    setDetecting(false);
    setManualMode(false);
    setDragSelection(null);
    setCropEditingId(null);
    cropEditStartRef.current = null;
    dragStartRef.current = null;

    patchSession((current) => ({
      ...current,
      candidatesByPage: {
        ...current.candidatesByPage,
        [String(current.page)]: [],
      },
      selectedDiagramId: null,
    }));

    setError("");
    setNotice("Board detection cleared.");
  }
  async function detectBoards() {
    if (detecting) {
      stopBoardScan();
      return;
    }

    if (!canvasRef.current || !session) return;
    if (!API_BASE) {
      setError("Board detection API is not configured. Configure VITE_API_BASE_URL and start the optional CV service.");
      return;
    }

    scanAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    scanAbortControllerRef.current = abortController;
    const requestId = ++scanRequestIdRef.current;

    setDetecting(true);
    setError("");
    setNotice("Scanning current page...");
    patchSession((current) => ({
      ...current,
      candidatesByPage: {
        ...current.candidatesByPage,
        [String(current.page)]: [],
      },
      selectedDiagramId: null,
    }));

    try {
      const image = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob(
          (blob) => blob
            ? resolve(blob)
            : reject(new Error("Could not encode rendered PDF page.")),
          "image/png",
        );
      });

      if (requestId !== scanRequestIdRef.current) return;

      const form = new FormData();
      form.append("image", image, `page-${session.page}.png`);

      const response = await fetch(`${API_BASE}/detect`, {
        method: "POST",
        body: form,
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Detector returned HTTP ${response.status}.`);
      }

      const data = await response.json() as { candidates?: CandidateInput[] };
      const candidates = (data.candidates ?? []).map(
        (item, index) => normalizedCandidate({ ...item, source: "automatic" }, index),
      );

      if (requestId !== scanRequestIdRef.current) return;

      patchSession((current) => ({
        ...current,
        candidatesByPage: {
          ...current.candidatesByPage,
          [String(current.page)]: candidates,
        },
        selectedDiagramId: null,
      }));

      setNotice(
        candidates.length
          ? `Found ${candidates.length} board candidate${candidates.length === 1 ? "" : "s"}. Select a candidate to recognize its chess position and load it onto the analysis board.`
          : "No board candidates found.",
      );
    } catch (cause) {
      if (requestId !== scanRequestIdRef.current) return;

      if (abortController.signal.aborted) {
        setNotice("Scan cancelled.");
      } else {
        setError(`Board detection failed: ${messageOf(cause)}`);
      }
    } finally {
      if (requestId === scanRequestIdRef.current) {
        scanAbortControllerRef.current = null;
        setDetecting(false);
      }
    }
  }
  function pointerPosition(event: { clientX: number; clientY: number }) {
    const box = canvasRef.current?.getBoundingClientRect();
    return box ? pointOnCanvas(event.clientX, event.clientY, box) : null;
  }

  function startCropEdit(
    event: React.PointerEvent<HTMLElement>,
    candidate: Candidate,
    handle: CropHandle,
  ) {
    event.stopPropagation();
    const point = pointerPosition(event);
    const stage = pageStageRef.current;
    if (!point || !stage) return;
    cropEditStartRef.current = { candidate, handle, point };
    stage.setPointerCapture(event.pointerId);
  }

  function startRegion(event: React.PointerEvent<HTMLDivElement>) {
    if (cropEditStartRef.current) return;
    if (!manualMode) return;
const canvas = canvasRef.current;
if (!canvas) return;
const target = event.target as HTMLElement;
if (target.closest(".diagram-overlay, .crop-handle")) return;
const bounds = canvas.getBoundingClientRect();
if (
  event.clientX < bounds.left ||
  event.clientX > bounds.right ||
  event.clientY < bounds.top ||
  event.clientY > bounds.bottom
) return;
    const point = pointerPosition(event);
    if (!point) return;
    dragStartRef.current = point;
    const selection = { ...point, x2: point.x, y2: point.y };
    dragCurrentRef.current = selection;
    setDragSelection(selection);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveRegion(event: React.PointerEvent<HTMLDivElement>) {
    const edit = cropEditStartRef.current;
    if (edit) {
      const point = pointerPosition(event);
      if (!point || !session) return;
      const next = editCrop(edit.candidate, edit.handle, point.x - edit.point.x, point.y - edit.point.y);
      patchSession((current) => {
        const pageKey = String(current.page);
        return {
          ...current,
          candidatesByPage: {
            ...current.candidatesByPage,
            [pageKey]: (current.candidatesByPage[pageKey] ?? []).map((candidate) =>
              candidate.id === edit.candidate.id ? { ...candidate, ...next } : candidate),
          },
        };
      });
      return;
    }
    if (!dragStartRef.current) return;
    const point = pointerPosition(event);
    if (point) {
      const selection = { ...dragStartRef.current, x2: point.x, y2: point.y };
      dragCurrentRef.current = selection;
      setDragSelection(selection);
    }
  }

  function finishRegion() {
    if (cropEditStartRef.current) {
      cropEditStartRef.current = null;
      return;
    }
    const selection = dragCurrentRef.current;
    if (!dragStartRef.current || !selection || !session) return;
    const x = Math.min(selection.x, selection.x2);
    const y = Math.min(selection.y, selection.y2);
    const width = Math.abs(selection.x2 - selection.x);
    const height = Math.abs(selection.y2 - selection.y);
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragSelection(null);
    if (width < 0.025 || height < 0.025) return;
    const candidate: Candidate = {
      id: `manual-${crypto.randomUUID()}`,
      x, y, width, height,
      relativeScore: 1,
      source: "manual",
    };
    patchSession((current) => ({
      ...current,
      candidatesByPage: {
        ...current.candidatesByPage,
        [String(current.page)]: [...(current.candidatesByPage[String(current.page)] ?? []), candidate],
      },
      selectedDiagramId: candidate.id,
    }));
    setManualMode(false);
    setNotice("Manual crop selected. Adjust its boundary, then use it on the board when ready.");
  }

  function cancelRegion() {
    cropEditStartRef.current = null;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragSelection(null);
  }

  async function fitPage(mode: "width" | "page") {
    if (!pdf || !session || !pageStageRef.current) return;
    try {
      const page = await pdf.getPage(session.page);
      const base = page.getViewport({ scale: 1 });
      const renderScale = Math.min(1.4, 1100 / base.width);
      const availableWidth = Math.max(200, pageStageRef.current.parentElement?.clientWidth ?? base.width) - 44;
      const availableHeight = Math.max(250, pageStageRef.current.parentElement?.clientHeight ?? base.height) - 52;
      const scale = mode === "width"
        ? availableWidth / (base.width * renderScale)
        : Math.min(availableWidth / base.width, availableHeight / base.height) / renderScale;
      patchSession({ zoom: Math.max(0.45, Math.min(1.8, scale)) });
    } catch (cause) {
      setError(`Could not fit PDF page: ${messageOf(cause)}`);
    }
  }

  async function expandBoard() {
    const target = document.querySelector(".board-frame");
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch (cause) {
      setError(`Could not expand chessboard: ${messageOf(cause)}`);
    }
  }

  function saveBookmark() {
    if (!session) return;
    patchSession((current) => ({
      ...current,
      bookmarks: current.bookmarks.includes(current.page)
        ? current.bookmarks.filter((page) => page !== current.page)
        : [...current.bookmarks, current.page].sort((a, b) => a - b),
    }));
  }

  function savePosition() {
    if (!session) return;
    const position = {
      id: crypto.randomUUID(),
      title: `Page ${session.page} position`,
      fen: session.currentFen,
      page: session.page,
      savedAt: Date.now(),
    };
    patchSession((current) => ({ ...current, positions: [...current.positions, position] }));
    setNotice("Position saved to this book.");
  }

  function resetBoard() {
    if (!session) return;
    const original = new Chess(session.originalFen);
    patchSession({
      lineBaseFen: original.fen(),
      currentFen: original.fen(),
      moves: [],
      moveIndex: 0,
    });
    setLastMove(null);
    setSelectedSquare(null);
  }

  const currentCandidates = session?.candidatesByPage[String(session.page)] ?? [];
  const detectionAttempted = Boolean(session && Object.hasOwn(session.candidatesByPage, String(session.page)));
  const currentDiagram = currentCandidates.find((candidate) => candidate.id === session?.selectedDiagramId);
  const whiteTurn = game.turn() === "w";
  const transferFenFields = transferFen.trim() ? transferFen.trim().split(/\s+/) : [];
  const transferBoard = transferFenFields.length === 6 ? parseFenPlacement(transferFenFields[0]) : null;
  let transferFenValid = false;
  if (transferFen.trim()) {
    try {
      new Chess(transferFen.trim());
      transferFenValid = true;
    } catch {
      transferFenValid = false;
    }
  }

  if (!ready) {
    return <main className="startup"><div className="loader" /><span>Restoring your reading session...</span></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">♟</div>
        <button className="icon-button library-toggle" aria-label="Toggle library" onClick={() => setLibraryOpen((value) => !value)}>☰</button>
        <div className="brand-name">ChessBook <span>Reader</span></div>
        <div className="top-divider" />
        <div className="current-book" title={book?.title ?? "No book open"}>
          <span className="book-dot" />
          <strong>{book?.title ?? "No book open"}</strong>
          {book && <span className="muted">{session?.page ?? 1} / {session?.pageCount || "–"}</span>}
        </div>
        <div className="top-spacer" />
        <span className="storage-label"><i /> LOCAL LIBRARY</span>
        <button className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen((value) => !value)}>⚙</button>
      </header>

      <div className={`workspace ${libraryOpen ? "" : "library-collapsed"}`}>
        {libraryOpen && (
          <aside className="library-panel">
            <div className="library-heading"><span>LIBRARY</span><button className="text-button" onClick={() => fileInput.current?.click()}>➕ Add Book</button></div>
            <input
              ref={fileInput}
              className="hidden-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => void addBook(event.target.files?.[0])}
            />
            <label className="search-field"><span>🔍</span><input value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} placeholder="Search library" /></label>
            <nav className="library-nav" aria-label="Library sections">
              <LibraryNavItem active={libraryTab === "all"} onClick={() => setLibraryTab("all")} icon="🗂" label="All Books" />
              <LibraryNavItem active={libraryTab === "recent"} onClick={() => setLibraryTab("recent")} icon="📅" label="Recently Opened" />
            <LibraryNavItem active={libraryTab === "bookmarks"} onClick={() => setLibraryTab("bookmarks")} icon="⭐" label="Bookmarks" />
            <LibraryNavItem active={libraryTab === "positions"} onClick={() => setLibraryTab("positions")} icon="📌" label="Saved Positions" />
            <LibraryNavItem active={libraryTab === "progress"} onClick={() => setLibraryTab("progress")} icon="📈" label="Reading Progress" />
            <LibraryNavItem active={libraryTab === "local"} onClick={() => setLibraryTab("local")} icon="📁" label="Local Books" />
            </nav>
            <div className="library-list-title"><span>{libraryTab === "recent" ? "RECENTLY OPENED" : libraryTab.toUpperCase()}</span><span>{visibleBooks.length}</span></div>
            <div className="book-list">
              {visibleBooks.map((item, index) => {
                const saved = sessionIndex[item.id];
                const progress = saved?.pageCount ? Math.min(100, Math.round((saved.page / saved.pageCount) * 100)) : 0;
                return (
                  <div key={item.id} className={`book-row ${book?.id === item.id ? "active" : ""}`}>
                    <button className="book-open" onClick={() => void openBook(item)} aria-label={`Open ${item.title}`}>
                      <div className="book-cover"><span>♟</span><small>{index + 1}</small></div>
                      <span className="book-meta"><strong>{item.title}</strong><small>Page {saved?.page ?? 1}{saved?.pageCount ? ` of ${saved.pageCount}` : ""} · {readableDate(item.lastOpenedAt)}</small><span className="progress-track"><i style={{ width: `${progress}%` }} /></span></span>
                    </button>
                    <button type="button" className="book-delete-button" title={"Delete " + item.title} aria-label={"Delete " + item.title} onClick={(event) => { event.stopPropagation(); void deleteBook(item); }}>×</button>
                    <details className="book-menu"><summary aria-label={`Options for ${item.title}`}>⋯</summary><div className="book-menu-items"><button onClick={() => void renameBook(item)}>Rename</button><button onClick={() => void deleteBook(item)}>Delete book</button></div></details>
                  </div>
                );
              })}
              {!visibleBooks.length && <div className="empty-library"><div>📚</div><strong>{books.length ? "Nothing in this view" : "Your shelf is empty"}</strong><span>Add a PDF to begin reading. Your books stay in this browser.</span><button className="green-button" onClick={() => fileInput.current?.click()}>+ Add Book</button></div>}
            </div>
            <div className="library-footer"><span className="local-dot" /> Stored on this device <span className="footer-size">{formatSize(books.reduce((sum, item) => sum + item.byteLength, 0))}</span></div>
          </aside>
        )}

        <section className="board-panel" aria-label="Chessboard analysis">
          <div className="section-kicker"><span>POSITION ANALYSIS</span><span className={`engine-idle engine-${engineStatus}`}><i /> {engineStatus === "off" ? "ENGINE OFF" : `ENGINE ${engineStatus.toUpperCase()}`}</span></div>
          <div className="board-header">
            <div><strong>{session?.selectedDiagramId ? "Selected diagram" : "Analysis board"}</strong><span>{session?.selectedDiagramId ? `Page ${session.page} · ${session.selectedDiagramId.startsWith("manual-") ? "Manual region" : "Board candidate"}` : "Ready for a position"}</span></div>
            <button className="mini-button" onClick={() => patchSession({ flipped: !session?.flipped })} title="Flip board">↻ Flip</button>
          </div>
          <div className="board-area">
            <div
              className={`evaluation-bar ${engineScore ? "evaluation-ready" : ""}`}
              aria-label={engineScore ? `Evaluation ${formatEvaluation(engineScore)} from White's perspective` : engineStatus === "error" ? "Engine evaluation unavailable" : "Waiting for engine evaluation"}
              title={engineScore ? `White's perspective · depth ${engineScore.depth}` : engineStatus === "error" ? engineMessage : "No valid engine score yet"}
            >
              <div className="eval-white" style={{ height: `${engineScore ? whiteScoreShare(engineScore) * 100 : 50}%` }} />
              <div className="eval-black" style={{ height: `${engineScore ? (1 - whiteScoreShare(engineScore)) * 100 : 50}%` }} />
            </div>
            <div className="board-frame">
              <div
                className={`chessboard ${session?.flipped ? "flipped" : ""} ${annotationMode ? "annotation-mode" : ""}`}
                ref={boardRef}
                onPointerDown={boardArrowPointerDown}
                onPointerMove={boardArrowPointerMove}
                onPointerUp={boardArrowPointerUp}
                onPointerCancel={cancelBoardArrowGesture}
                onContextMenu={(event) => {
                  if (suppressBoardContextMenuRef.current) {
                    event.preventDefault();
                    suppressBoardContextMenuRef.current = false;
                  }
                }}
              >
                {Array.from({ length: 64 }, (_, index) => {
                  const visibleRow = Math.floor(index / 8);
                  const visibleCol = index % 8;
                  const fileIndex = session?.flipped ? 7 - visibleCol : visibleCol;
                  const rankIndex = session?.flipped ? visibleRow : 7 - visibleRow;
                  const square = squareName(fileIndex, rankIndex);
                  const piece = pieceSquares[7 - rankIndex]?.[fileIndex];
                  const legal = legalTargets.has(square);
                  const isLast = highlightedMove?.from === square || highlightedMove?.to === square;
                  const light = (fileIndex + rankIndex) % 2 === 1;
                  return (
                    <button
                      key={square}
                      className={`square ${light ? "light-square" : "dark-square"} ${selectedSquare === square ? "selected-square" : ""} ${isLast ? "last-square" : ""}`}
                      aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                      draggable={Boolean(piece && piece.color === game.turn())}
                      onClick={() => handleSquareClick(square)}
                      onDragStart={(event) => {
                        const image = event.currentTarget.querySelector("img");
                        if (image) {
                          const bounds = event.currentTarget.getBoundingClientRect();
                          event.dataTransfer.setDragImage(image, bounds.width / 2, bounds.height / 2);
                        }
                        event.dataTransfer.setData("text/plain", square);
                        setSelectedSquare(square);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => { event.preventDefault(); const from = event.dataTransfer.getData("text/plain") as Square; if (from) makeMove(from, square); }}
                      onDragEnd={() => setSelectedSquare(null)}
                    >
                      {piece && <span className={`piece ${piece.color === "w" ? "white-piece" : "black-piece"}`} aria-hidden="true"><img draggable={false} alt="" src={`${import.meta.env.BASE_URL}assets/pieces/standalone/${piece.color}${piece.type}.svg`} /></span>}
                      {legal && <span className={piece ? "legal-capture" : "legal-dot"} />}
                      {session?.coordinates && visibleCol === 0 && <span className={`rank-coordinate ${light ? "coord-dark" : "coord-light"}`}>{rankIndex + 1}</span>}
                      {session?.coordinates && visibleRow === 7 && <span className={`file-coordinate ${light ? "coord-dark" : "coord-light"}`}>{"abcdefgh"[fileIndex]}</span>}
                    </button>
                  );
                })}
                <svg className="board-arrows" viewBox="0 0 8 8" aria-hidden="true">
                  <defs>
                    <marker id="user-arrowhead" markerWidth="0.28" markerHeight="0.28" refX="0.22" refY="0.14" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0 0 L0.28 0.14 L0 0.28 Z" fill="#3277a8" />
                    </marker>
                    <marker id="engine-arrowhead" markerWidth="0.3" markerHeight="0.3" refX="0.24" refY="0.15" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0 0 L0.3 0.15 L0 0.3 Z" fill="#d49b38" />
                    </marker>
                  </defs>
                  {[
                    ...userArrows.map((arrow) => ({ arrow, kind: "user" as const })),
                    ...(engineArrow ? [{ arrow: engineArrow, kind: "engine" as const }] : []),
                    ...(arrowStart && arrowHover && arrowStart !== arrowHover
                      ? [{ arrow: { from: arrowStart, to: arrowHover }, kind: "preview" as const }]
                      : []),
                  ].map(({ arrow, kind }, index) => {
                    const from = squareCenter(arrow.from, Boolean(session?.flipped));
                    const to = squareCenter(arrow.to, Boolean(session?.flipped));
                    const color = kind === "engine" ? "#d49b38" : kind === "preview" ? "#3277a8aa" : "#3277a8";
                    return <line
                      key={`${kind}-${arrow.from}-${arrow.to}-${index}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={color}
                      strokeWidth={kind === "engine" ? 0.13 : 0.11}
                      strokeLinecap="round"
                      markerEnd={kind === "engine" ? "url(#engine-arrowhead)" : "url(#user-arrowhead)"}
                      className={`board-arrow board-arrow-${kind}`}
                    />;
                  })}
                </svg>
              </div>
            </div>
          </div>
          <div className="board-controls">
            <button title="First move" onClick={() => jumpToMove(0)}>⏮</button>
            <button title="Previous move" onClick={() => jumpToMove(Math.max(0, (session?.moveIndex ?? 0) - 1))}>◀</button>
            <button title="Next move" onClick={() => jumpToMove(Math.min(session?.moves.length ?? 0, (session?.moveIndex ?? 0) + 1))}>▶</button>
            <button title="Last move" onClick={() => jumpToMove(session?.moves.length ?? 0)}>⏭</button>
            <span className="controls-separator" />
            <button title="Undo move" onClick={() => jumpToMove(Math.max(0, (session?.moveIndex ?? 0) - 1))}>↶</button>
            <button title="Redo move" onClick={() => jumpToMove(Math.min(session?.moves.length ?? 0, (session?.moveIndex ?? 0) + 1))}>↷</button>
            <button title="Reset to original diagram position" onClick={resetBoard}>⟲ Reset</button>
            <button title="Toggle coordinates" onClick={() => patchSession({ coordinates: !session?.coordinates })}>⌗</button>
            <button title="Expand board" onClick={() => void expandBoard()}>⤢</button>
            <button
              className={annotationMode ? "annotation-active" : ""}
              title="Touch alternative: tap two squares to add or remove an analysis arrow. Right-drag works with a mouse."
              aria-pressed={annotationMode}
              onClick={() => { setAnnotationMode((mode) => !mode); setArrowStart(null); setArrowHover(null); }}
            >↔ Arrows</button>
            {userArrows.length > 0 && <button title="Clear user analysis arrows" onClick={() => setUserArrows([])}>Clear arrows</button>}
            <span className="controls-spacer" />
            <button title="Copy current FEN" onClick={() => void copyText(game.fen())}>FEN</button>
            <button title="Copy current PGN" onClick={() => void copyText(game.pgn())}>PGN</button>
          </div>
          <div className="turn-row">
            <span>TO MOVE</span>
            <button className={whiteTurn ? "turn-active" : ""} onClick={() => {
              try {
                const fen = fenWithTurn(game.fen(), "w");
                patchSession({ lineBaseFen: fen, currentFen: fen, moves: [], moveIndex: 0 });
                setLastMove(null);
              } catch (cause) { setError(messageOf(cause)); }
            }}>○ White</button>
            <button className={!whiteTurn ? "turn-active" : ""} onClick={() => {
              try {
                const fen = fenWithTurn(game.fen(), "b");
                patchSession({ lineBaseFen: fen, currentFen: fen, moves: [], moveIndex: 0 });
                setLastMove(null);
              } catch (cause) { setError(messageOf(cause)); }
            }}>♟ Black</button>
            <button className="save-position" onClick={savePosition}>↳ Save position</button>
          </div>
          <details className="position-editor">
            <summary>Board position · enter FEN to correct selected diagram</summary>
            <div className="fen-entry"><input value={fenInput} onChange={(event) => setFenInput(event.target.value)} placeholder="Paste verified FEN from the selected diagram" aria-label="Position FEN input" /><button className="green-button" onClick={() => { if (!fenInput.trim()) { setError("Enter a FEN position first."); return; } if (moveToPosition(fenInput.trim())) setFenInput(""); }}>Load FEN</button></div>
          </details>
          <div className="moves-panel">
            <div className="moves-heading"><span>MOVE LIST</span><button className="new-line" onClick={() => {
              if (!session) return;
              patchSession({ lineBaseFen: game.fen(), currentFen: game.fen(), moves: [], moveIndex: 0 });
              setLastMove(null);
              setNotice("New analysis line started from the current position.");
            }}>＋ New line</button></div>
            <div className="move-list">
              {moveHistory.length ? Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, row) => (
                <div className="move-pair" key={row}>
                  <span className="move-number">{row + 1}.</span>
                  {moveHistory[row * 2] && <button className={session?.moveIndex === row * 2 + 1 ? "active-move" : ""} onClick={() => jumpToMove(row * 2 + 1)}>{moveHistory[row * 2].san}</button>}
                  {moveHistory[row * 2 + 1] && <button className={session?.moveIndex === row * 2 + 2 ? "active-move" : ""} onClick={() => jumpToMove(row * 2 + 2)}>{moveHistory[row * 2 + 1].san}</button>}
                </div>
              )) : <span className="muted empty-moves">Select a position and play a move to start a line.</span>}
            </div>
          </div>
          <div className="board-fen"><span>{game.fen()}</span><span>{session?.moveIndex ? `MOVE ${session.moveIndex}` : "BOOK POSITION"}</span></div>
        </section>

        <section className="reader-panel" aria-label="PDF book reader">
          <div className="reader-toolbar">
            <div className="reader-title"><div className="document-icon">▤</div><div><strong>{book?.title ?? "Book reader"}</strong><span>{pdf ? `${session?.pageCount} pages · PDF document` : "Add a PDF book to begin"}</span></div></div>
            <div className="reader-actions">
              <button className={session?.bookmarks.includes(session.page) ? "active-action" : ""} title="Bookmark this page" disabled={!book} onClick={saveBookmark}>☆</button>
              <button title="Zoom out" disabled={!session} onClick={() => patchSession({ zoom: Math.max(0.65, (session?.zoom ?? 1) - 0.1) })}>−</button>
              <span className="zoom-value">{Math.round((session?.zoom ?? 1) * 100)}%</span>
              <button title="Zoom in" disabled={!session} onClick={() => patchSession({ zoom: Math.min(1.8, (session?.zoom ?? 1) + 0.1) })}>＋</button>
              <button title="Fit to width" disabled={!pdf} onClick={() => void fitPage("width")}>Fit width</button>
              <button title="Fit page" disabled={!pdf} onClick={() => void fitPage("page")}>Fit page</button>
            </div>
          </div>
          <div className="page-navigation">
            <button aria-label="Previous page" disabled={!pdf || session?.page === 1} onClick={() => changePage(-1)}>‹</button>
            <label>PAGE <input aria-label="Current page" type="number" min="1" max={session?.pageCount || 1} value={session?.page ?? 1} disabled={!pdf} onChange={(event) => goToPage(Number(event.target.value))} /> <span>of {session?.pageCount || "—"}</span></label>
            <button aria-label="Next page" disabled={!pdf || (session?.page ?? 1) >= (session?.pageCount ?? 1)} onClick={() => changePage(1)}>›</button>
            <span className="nav-separator" />
            <button className={`scan-button ${detecting ? "scan-active" : ""}`} disabled={!pdf || rendering} onClick={() => void detectBoards()}>{detecting ? "■ Stop scan" : "⚲ Detect boards"}</button>
            <button
              type="button"
              className="clear-scan-button"
              disabled={!pdf}
              onClick={clearBoardScan}
              title="Stop scanning and remove detected board overlays"
            >Clear</button>
            <span className="detection-status">{detecting ? "Scanning current page..." : currentCandidates.length ? `${currentCandidates.length} candidate${currentCandidates.length === 1 ? "" : "s"}` : detectionAttempted ? "No boards found" : "Not scanned"}</span>
          </div>
          <div className="page-workspace">
            {!book && <div className="reader-empty"><div className="empty-glyph">⚠</div><strong>Open a chess book</strong><span>Import a PDF to read pages and mark chess diagrams.</span><button className="green-button" onClick={() => fileInput.current?.click()}>Add a book</button></div>}
            {book && (
              <div className="page-scroll">
                <div
                  className={`page-stage ${rendering ? "is-rendering" : ""} ${manualMode ? "manual-mode" : ""}`}
                  ref={pageStageRef}
                  onPointerDown={startRegion}
                  onPointerMove={moveRegion}
                  onPointerUp={finishRegion}
                  onPointerCancel={cancelRegion}
                >
                  <canvas ref={canvasRef} aria-label={`PDF page ${session?.page ?? 1}`} />
                  {!pdf && !pdfLoading && <div className="page-error">PDF is unavailable. Your saved reading state has been kept.</div>}
                  {currentCandidates.map((candidate, index) => (
                    candidate.id === cropEditingId ? (
                      <div
                        key={candidate.id}
                        className="diagram-overlay diagram-selected crop-editor"
                        style={{ left: `${candidate.x * 100}%`, top: `${candidate.y * 100}%`, width: `${candidate.width * 100}%`, height: `${candidate.height * 100}%` }}
                        aria-label={`Adjust crop region ${index + 1}`}
                        onPointerDown={(event) => startCropEdit(event, candidate, "move")}
                      >
                        <span>{index + 1} · Drag to move</span>
                        {CROP_HANDLES.map((handle) => <button
                          key={handle}
                          type="button"
                          className={`crop-handle handle-${handle}`}
                          aria-label={`Resize crop ${handle}`}
                          onPointerDown={(event) => startCropEdit(event, candidate, handle)}
                        />)}
                      </div>
                    ) : (
                      <button
                        key={candidate.id}
                        className={`diagram-overlay ${candidate.id === session?.selectedDiagramId ? "diagram-selected" : ""} ${candidate.source === "manual" ? "manual-overlay" : ""}`}
                        style={{ left: `${candidate.x * 100}%`, top: `${candidate.y * 100}%`, width: `${candidate.width * 100}%`, height: `${candidate.height * 100}%` }}
                        aria-label={`Select diagram region ${index + 1}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); selectCandidate(candidate); if (candidate.source === "automatic") void openTransfer(candidate); }}
                      ><span>{index + 1} · {candidate.source === "manual" ? "Manual crop" : "Relative match"}</span></button>
                    )
                  ))}
                  {dragSelection && <div className="selection-rectangle" style={{ left: `${Math.min(dragSelection.x, dragSelection.x2) * 100}%`, top: `${Math.min(dragSelection.y, dragSelection.y2) * 100}%`, width: `${Math.abs(dragSelection.x2 - dragSelection.x) * 100}%`, height: `${Math.abs(dragSelection.y2 - dragSelection.y) * 100}%` }} />}
                  {rendering && <div className="rendering-label"><span className="spinner" /> Rendering page</div>}
                  {pdfLoading && <div className="rendering-label"><span className="spinner" /> Opening PDF</div>}
                </div>
                <div className="page-scroll-hint">Drag over the page to mark a diagram · {currentCandidates.length} regions</div>
              </div>
            )}
          </div>
          <div className="reader-footer">
            <div className="diagram-strip"><span className="strip-label">DIAGRAMS</span>{currentCandidates.length ? currentCandidates.map((candidate, index) => <button key={candidate.id} className={candidate.id === session?.selectedDiagramId ? "strip-selected" : ""} onClick={() => selectCandidate(candidate)} aria-label={`Select diagram ${index + 1}`}>{index + 1}</button>) : <span className="muted">None detected on this page</span>}</div>
            {currentDiagram && <div className="crop-actions">
              {cropEditingId === currentDiagram.id && <button onClick={resetSelectedCrop}>Reset crop</button>}
              <button onClick={() => adjustSelectedCrop(currentDiagram)}>{cropEditingId === currentDiagram.id ? "Adjusting…" : "Adjust Crop"}</button>
              <button className="green-button" onClick={() => void openTransfer(currentDiagram)}>Recognize Pieces</button>
              <button onClick={cancelCandidateSelection}>Cancel</button>
            </div>}
            <div className="scan-hint">{currentDiagram ? "Selection does not change the board; confirm with Use on Board." : "Select a detected board or draw a region."}</div>
          </div>
          <div className="analysis-strip">
            <div className="analysis-name"><span className="stockfish-mark">♞</span><div><strong>Stockfish 19 Lite</strong><span>{engineStatus === "error" ? "Engine unavailable" : engineStatus === "off" ? "Engine off" : engineStatus === "loading" ? "Loading engine…" : engineStatus === "analyzing" ? "Analyzing current position…" : "Ready · White-positive scores"}</span></div></div>
            <div className="analysis-divider" />
            <button className={`engine-toggle ${engineEnabled ? "engine-active" : ""}`} onClick={toggleEngine}>{engineEnabled ? "Stop analysis" : engineStatus === "error" ? "Retry Stockfish" : "Analyze position"}</button>
            <label className="depth-control">Depth <select value={engineDepth} onChange={(event) => setEngineDepth(Number(event.target.value))}><option value={10}>10</option><option value={12}>12</option><option value={14}>14</option><option value={16}>16</option><option value={18}>18</option></select></label>
            <div className="analysis-result"><span>Evaluation · White</span><strong>{engineScore ? formatEvaluation(engineScore) : "—"}</strong></div>
            <div className="analysis-result best-result"><span>Best move</span><strong>{engineScore?.bestMove ?? "—"}</strong></div>
            <div className="analysis-pv"><span>PRINCIPAL VARIATION</span><strong>{engineStatus === "error" ? engineMessage : engineScore?.pv?.join(" ") ?? (engineEnabled ? "Waiting for first valid score…" : "Enable Stockfish to analyze this position.")}</strong></div>
          </div>
        </section>
      </div>

      {settingsOpen && <div className="settings-popover"><strong>Workspace settings</strong><span>Books and analysis sessions are stored in IndexedDB on this device.</span><span>Stockfish runs locally in a browser worker. Cloud sync is not configured.</span><button onClick={() => setSettingsOpen(false)}>Close</button></div>}
      {transferCandidate && <div className="modal-backdrop" role="presentation">
        <section className="transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
          <header><div><h2 id="transfer-title">Review recognized position</h2><p>The scan is already loaded on the analysis board. Review and correct any uncertain squares, then confirm your edits.</p></div><button aria-label="Close crop preview" onClick={closeTransfer}>×</button></header>
          <div className="recognition-layout">
            {transferPreview && <img className="crop-preview" src={transferPreview} alt="Exact selected chess diagram crop" />}
            <div className="recognition-summary" role="status">
              {recognitionStatus === "loading" && <><span className="spinner" /> Recognizing pieces…</>}
              {recognitionStatus === "complete" && <>
                <strong>{recognitionEdited ? "Model result · Manually corrected" : "Model-generated position"}</strong>
                <span>{recognitionResult?.piece_count ?? 0} pieces · board score {recognitionResult?.board_confidence.toFixed(2)} · piece scores are uncalibrated</span>
                <span>Orientation: {recognitionResult?.orientation ?? "unknown"}; confirm against the source crop.</span>
              </>}
              {recognitionStatus === "failed" && <><strong>Automatic recognition did not complete.</strong><span>{recognitionError}</span><span>Review the source crop and enter or correct its FEN manually.</span></>}
            </div>
          </div>
          {recognitionStatus === "complete" && transferBoard && <div className="recognized-position">
            <div className="recognized-board" role="group" aria-label="Editable recognized chess position">
              {transferBoard.flatMap((rank, row) => rank.map((piece, col) => {
                const light = (row + col) % 2 === 1;
                return <button
                  key={`${row}-${col}`}
                  type="button"
                  className={`recognized-square ${light ? "light-square" : "dark-square"}`}
                  aria-label={`Rank ${8 - row}, file ${"abcdefgh"[col]}: ${PIECE_LABELS[piece]}`}
                  title={`${"abcdefgh"[col]}${8 - row} · ${PIECE_LABELS[piece]}`}
                  onClick={() => editTransferSquare(row, col)}
                >{piece && <img draggable={false} alt="" src={`${import.meta.env.BASE_URL}assets/pieces/standalone/${piece === piece.toUpperCase() ? "w" : "b"}${piece.toLowerCase()}.svg`} />}</button>;
              }))}
            </div>
            <div className="recognition-edit-controls">
              <label>Piece to place
                <select value={transferPiece} onChange={(event) => setTransferPiece(event.target.value)}>
                  {Object.entries(PIECE_LABELS).map(([code, label]) => <option key={code || "empty"} value={code}>{label}</option>)}
                </select>
              </label>
              <button type="button" onClick={flipTransferPosition}>Flip position 180°</button>
              <button type="button" onClick={() => void openTransfer(transferCandidate)}>Retry recognition</button>
            </div>
          </div>}
          {recognitionResult?.warnings.map((warning) => <p className="recognition-warning" key={warning}>{warning}</p>)}
          {recognitionError && recognitionStatus !== "failed" && <p className="recognition-error" role="alert">{recognitionError}</p>}
          {recognitionStatus === "failed" && <div className="recognition-retry"><button type="button" onClick={() => void openTransfer(transferCandidate)}>Retry recognition</button></div>}
          <label className="transfer-fen">FEN · edit manually if needed
            <input value={transferFen} onChange={(event) => { setTransferFen(event.target.value); setRecognitionEdited(true); setRecognitionError(""); }} placeholder="Paste a six-field FEN position" autoComplete="off" spellCheck={false} />
          </label>
          {transferFen && <p className={transferFenValid ? "fen-validation valid-fen" : "fen-validation"}>{transferFenValid ? "Syntactically valid chess position · visually verify it against the diagram." : "FEN is not a valid chess position yet."}</p>}
          <footer><button onClick={closeTransfer}>Cancel</button><button className="green-button" disabled={!transferFenValid} onClick={confirmTransfer}>Use on Board</button></footer>
        </section>
      </div>}
      {(error || notice) && <div className={`toast ${error ? "toast-error" : ""}`} role={error ? "alert" : "status"}><span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
    </main>
  );
}

function LibraryNavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return <button className={`library-nav-item ${active ? "nav-active" : ""}`} onClick={onClick}><span>{icon}</span>{label}</button>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
