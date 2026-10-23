import React, { useEffect, useMemo, useState } from "react";
import {
  buildFullFen,
  countKings,
  EMPTY_PLACEMENT,
  flipFenPlacement,
  moveFenPiece,
  parseFenPlacement,
  PIECE_LABELS,
  sanitizeCastlingRights,
  setFenPiece,
  START_PLACEMENT,
  validatePositionFen,
} from "./position-editor";

const WHITE_PIECES = ["K", "Q", "R", "B", "N", "P"] as const;
const BLACK_PIECES = ["k", "q", "r", "b", "n", "p"] as const;

export interface ManualBoardEditorProps {
  initialFen: string;
  onConfirm: (fen: string) => void;
  onCancel: () => void;
  confirmLabel: string;
  title: string;
  subtitle?: string;
  // Specific to recognition review (Feature A)
  cropPreviewUrl?: string;
  recognitionStatus?: "idle" | "loading" | "complete" | "failed";
  recognitionResult?: {
    board_confidence: number;
    mean_piece_confidence: number | null;
    piece_count: number;
    orientation: "normal" | "flipped" | "unknown";
    warnings: string[];
  } | null;
  recognitionError?: string;
  onRetryRecognition?: () => void;
  // Specific to setup mode (Feature B)
  showPresets?: boolean;
  currentAnalysisFen?: string;
}

export function ManualBoardEditor({
  initialFen,
  onConfirm,
  onCancel,
  confirmLabel,
  title,
  subtitle,
  cropPreviewUrl,
  recognitionStatus,
  recognitionResult,
  recognitionError,
  onRetryRecognition,
  showPresets = false,
  currentAnalysisFen,
}: ManualBoardEditorProps) {
  // Parse initial fields
  const parsedInitial = useMemo(() => {
    const trimmed = initialFen.trim();
    const fields = trimmed ? trimmed.split(/\s+/) : [];
    const placement = fields[0] && parseFenPlacement(fields[0]) ? fields[0] : START_PLACEMENT;
    const turn = fields[1] === "b" ? ("b" as const) : ("w" as const);
    const castling = fields[2] ?? "-";
    const ep = fields[3] ?? "-";
    const halfmove = Number(fields[4]) || 0;
    const fullmove = Number(fields[5]) || 1;
    const fen = buildFullFen(placement, turn, castling, ep, halfmove, fullmove);
    return { placement, turn, castling, ep, halfmove, fullmove, fen };
  }, [initialFen]);

  const [placement, setPlacement] = useState(parsedInitial.placement);
  const [turn, setTurn] = useState<"w" | "b">(parsedInitial.turn);
  const [castling, setCastling] = useState(parsedInitial.castling);
  const [activeTool, setActiveTool] = useState<string>("P"); // Piece symbol or "" for erase
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [history, setHistory] = useState<string[]>([parsedInitial.fen]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [fenInputText, setFenInputText] = useState(parsedInitial.fen);
  const [validationError, setValidationError] = useState<string>("");

  // When initialFen changes externally (e.g. recognition completes or retries), reset editor
  useEffect(() => {
    setPlacement(parsedInitial.placement);
    setTurn(parsedInitial.turn);
    setCastling(parsedInitial.castling);
    setHistory([parsedInitial.fen]);
    setHistoryIndex(0);
    setFenInputText(parsedInitial.fen);
    setValidationError("");
    setSelectedSquare(null);
  }, [parsedInitial]);

  const currentBoard = useMemo(() => parseFenPlacement(placement) ?? parseFenPlacement(EMPTY_PLACEMENT)!, [placement]);
  const currentFen = useMemo(() => buildFullFen(placement, turn, castling), [placement, turn, castling]);
  const validation = useMemo(() => validatePositionFen(currentFen), [currentFen]);
  const kingCounts = useMemo(() => countKings(placement), [placement]);

  // Push new state to history
  function pushState(newPlacement: string, newTurn: "w" | "b" = turn, newCastling: string = castling) {
    const board = parseFenPlacement(newPlacement);
    const sanitizedCastling = board ? sanitizeCastlingRights(board, newCastling) : "-";
    const newFen = buildFullFen(newPlacement, newTurn, sanitizedCastling);

    setPlacement(newPlacement);
    setTurn(newTurn);
    setCastling(sanitizedCastling);
    setFenInputText(newFen);
    setValidationError("");

    if (newFen !== history[historyIndex]) {
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(newFen);
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    }
  }

  function handleUndo() {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevFen = history[prevIndex];
      const fields = prevFen.split(/\s+/);
      setPlacement(fields[0]);
      setTurn(fields[1] === "b" ? "b" : "w");
      setCastling(fields[2] ?? "-");
      setFenInputText(prevFen);
      setHistoryIndex(prevIndex);
      setValidationError("");
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextFen = history[nextIndex];
      const fields = nextFen.split(/\s+/);
      setPlacement(fields[0]);
      setTurn(fields[1] === "b" ? "b" : "w");
      setCastling(fields[2] ?? "-");
      setFenInputText(nextFen);
      setHistoryIndex(nextIndex);
      setValidationError("");
    }
  }

  function handleSquareClick(row: number, col: number) {
    setSelectedSquare({ row, col });
    if (activeTool === "") {
      // Erase tool active
      const nextPlacement = setFenPiece(placement, row, col, "");
      pushState(nextPlacement);
    } else {
      // Place / Replace with active piece
      const nextPlacement = setFenPiece(placement, row, col, activeTool);
      pushState(nextPlacement);
    }
  }

  function handleToolSelect(tool: string) {
    setActiveTool(tool);
    // If a square is already selected and user picks a piece or erase, apply to that square
    if (selectedSquare) {
      const nextPlacement = setFenPiece(placement, selectedSquare.row, selectedSquare.col, tool);
      pushState(nextPlacement);
    }
  }

  function handleClearBoard() {
    pushState(EMPTY_PLACEMENT, turn, "-");
    setSelectedSquare(null);
  }

  function handleStartingPosition() {
    pushState(START_PLACEMENT, "w", "KQkq");
    setSelectedSquare(null);
  }

  function handleFlipBoard() {
    setFlipped((f) => !f);
  }

  function handleInvertPieces() {
    const nextPlacement = flipFenPlacement(placement);
    pushState(nextPlacement);
  }

  function handleTurnChange(newTurn: "w" | "b") {
    pushState(placement, newTurn, castling);
  }

  function handleFenInputChange(value: string) {
    setFenInputText(value);
    const trimmed = value.trim();
    const fields = trimmed.split(/\s+/);
    if (fields.length === 6) {
      const parsed = parseFenPlacement(fields[0]);
      if (parsed) {
        setPlacement(fields[0]);
        setTurn(fields[1] === "b" ? "b" : "w");
        setCastling(fields[2] ?? "-");
        setValidationError("");
        if (trimmed !== history[historyIndex]) {
          const nextHistory = history.slice(0, historyIndex + 1);
          nextHistory.push(trimmed);
          setHistory(nextHistory);
          setHistoryIndex(nextHistory.length - 1);
        }
        return;
      }
    }
    const val = validatePositionFen(trimmed);
    if (!val.isValid) {
      setValidationError(val.error || "Invalid FEN syntax.");
    }
  }

  // Keyboard navigation for selected square
  function handleKeyDown(event: React.KeyboardEvent) {
    if (!selectedSquare) return;
    const { row, col } = selectedSquare;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const nextPlacement = setFenPiece(placement, row, col, "");
      pushState(nextPlacement);
      return;
    }
    const key = event.key;
    if (/^[prnbqkPRNBQK]$/.test(key)) {
      event.preventDefault();
      const nextPlacement = setFenPiece(placement, row, col, key);
      pushState(nextPlacement);
      setActiveTool(key);
      return;
    }
    if (event.key === "Escape") {
      setSelectedSquare(null);
    }
  }

  function handleConfirmClick() {
    if (validationError) {
      return;
    }
    if (!validation.isValid) {
      setValidationError(validation.error || "Cannot confirm: position is not valid.");
      return;
    }
    onConfirm(currentFen);
  }

  const pieceAssetUrl = (piece: string) => {
    const color = piece === piece.toUpperCase() ? "w" : "b";
    const type = piece.toLowerCase();
    return `${import.meta.env.BASE_URL}assets/pieces/standalone/${color}${type}.svg`;
  };

  return (
    <div className="modal-backdrop" role="presentation" onKeyDown={handleKeyDown}>
      <section
        className="transfer-dialog manual-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            title="Cancel and close"
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        {showPresets && (
          <div className="editor-presets-bar">
            <span>START FROM:</span>
            {currentAnalysisFen && (
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  const fields = currentAnalysisFen.trim().split(/\s+/);
                  if (fields.length === 6 && parseFenPlacement(fields[0])) {
                    pushState(fields[0], fields[1] === "b" ? "b" : "w", fields[2]);
                  }
                }}
              >
                Edit Current Board
              </button>
            )}
            <button type="button" className="preset-btn" onClick={handleClearBoard}>
              Empty Board
            </button>
            <button type="button" className="preset-btn" onClick={handleStartingPosition}>
              Standard Starting Board
            </button>
          </div>
        )}

        {cropPreviewUrl && (
          <div className="recognition-layout">
            <img className="crop-preview" src={cropPreviewUrl} alt="Selected chess diagram crop" />
            <div className="recognition-summary" role="status">
              {recognitionStatus === "loading" && (
                <>
                  <span className="spinner" /> Recognizing pieces…
                </>
              )}
              {recognitionStatus === "complete" && (
                <>
                  <strong>Model-recognized position · Editable below</strong>
                  <span>
                    {recognitionResult?.piece_count ?? 0} pieces recognized · confidence{" "}
                    {recognitionResult?.board_confidence?.toFixed(2) ?? "—"}
                  </span>
                  <span>
                    Orientation: {recognitionResult?.orientation ?? "normal"}. Use "Flip position 180°" if needed.
                  </span>
                  {onRetryRecognition && (
                    <button
                      type="button"
                      className="mini-button retry-btn"
                      onClick={onRetryRecognition}
                    >
                      ↻ Retry recognition
                    </button>
                  )}
                </>
              )}
              {recognitionStatus === "failed" && (
                <>
                  <strong>Automatic recognition did not complete.</strong>
                  <span>{recognitionError || "Check the diagram crop and set up the pieces manually."}</span>
                  {onRetryRecognition && (
                    <button
                      type="button"
                      className="mini-button retry-btn"
                      onClick={onRetryRecognition}
                    >
                      ↻ Retry recognition
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="manual-editor-workspace">
          {/* Left: The Board */}
          <div className="manual-board-container">
            <div
              className={`manual-chessboard ${flipped ? "flipped" : ""}`}
              role="grid"
              aria-label="Interactive chess position editor"
            >
              {Array.from({ length: 64 }, (_, index) => {
                const visibleRow = Math.floor(index / 8);
                const visibleCol = index % 8;
                const boardRow = flipped ? 7 - visibleRow : visibleRow;
                const boardCol = flipped ? 7 - visibleCol : visibleCol;
                const piece = currentBoard[boardRow]?.[boardCol] ?? "";
                const isLight = (boardRow + boardCol) % 2 === 1;
                const isSelected = selectedSquare?.row === boardRow && selectedSquare?.col === boardCol;
                const fileLetter = "abcdefgh"[boardCol];
                const rankNumber = 8 - boardRow;
                const squareCode = `${fileLetter}${rankNumber}`;

                return (
                  <button
                    key={`${boardRow}-${boardCol}`}
                    type="button"
                    className={`recognized-square ${isLight ? "light-square" : "dark-square"} ${
                      isSelected ? "selected-square" : ""
                    }`}
                    aria-label={`${squareCode}: ${PIECE_LABELS[piece] || "Empty"}`}
                    title={`${squareCode}: ${PIECE_LABELS[piece] || "Empty square"}`}
                    onClick={() => handleSquareClick(boardRow, boardCol)}
                    draggable={Boolean(piece)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ type: "board-square", fromRow: boardRow, fromCol: boardCol, piece })
                      );
                      setSelectedSquare({ row: boardRow, col: boardCol });
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      try {
                        const raw = event.dataTransfer.getData("application/json");
                        if (!raw) return;
                        const data = JSON.parse(raw) as {
                          type: string;
                          fromRow?: number;
                          fromCol?: number;
                          piece: string;
                        };
                        if (data.type === "board-square" && data.fromRow !== undefined && data.fromCol !== undefined) {
                          if (data.fromRow === boardRow && data.fromCol === boardCol) return;
                          const nextPlacement = moveFenPiece(placement, data.fromRow, data.fromCol, boardRow, boardCol);
                          pushState(nextPlacement);
                          setSelectedSquare({ row: boardRow, col: boardCol });
                        } else if (data.type === "palette-piece" && data.piece) {
                          const nextPlacement = setFenPiece(placement, boardRow, boardCol, data.piece);
                          pushState(nextPlacement);
                          setSelectedSquare({ row: boardRow, col: boardCol });
                        }
                      } catch {
                        // ignore malformed drag payload
                      }
                    }}
                  >
                    {piece && (
                      <img
                        draggable={false}
                        alt={PIECE_LABELS[piece]}
                        src={pieceAssetUrl(piece)}
                      />
                    )}
                    {visibleCol === 0 && (
                      <span className={`rank-coordinate ${isLight ? "coord-dark" : "coord-light"}`}>
                        {rankNumber}
                      </span>
                    )}
                    {visibleRow === 7 && (
                      <span className={`file-coordinate ${isLight ? "coord-dark" : "coord-light"}`}>
                        {fileLetter}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="manual-board-subcontrols">
              <button
                type="button"
                className="mini-button"
                onClick={handleFlipBoard}
                title="Flip board perspective"
              >
                ↻ Flip View
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={handleInvertPieces}
                title="Rotate pieces 180 degrees"
              >
                ⇄ Invert Pieces
              </button>
              <button
                type="button"
                className="mini-button"
                disabled={historyIndex <= 0}
                onClick={handleUndo}
                title="Undo last manual edit"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                className="mini-button"
                disabled={historyIndex >= history.length - 1}
                onClick={handleRedo}
                title="Redo undone edit"
              >
                ↷ Redo
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={handleClearBoard}
                title="Clear all pieces from board"
              >
                Clear Board
              </button>
            </div>
          </div>

          {/* Right: Piece Palette & Settings */}
          <div className="manual-palette-container">
            <div className="palette-section-title">
              <strong>PIECE PALETTE</strong>
              <span className="palette-hint">
                {activeTool === ""
                  ? "Erase tool active · click a square to clear it"
                  : `Placing: ${PIECE_LABELS[activeTool] ?? "None"}`}
              </span>
            </div>

            <div className="piece-palette-grid">
              <div className="palette-color-group">
                <span className="color-label">WHITE</span>
                <div className="palette-row">
                  {WHITE_PIECES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`palette-piece-btn ${activeTool === code ? "palette-piece-active" : ""}`}
                      aria-label={PIECE_LABELS[code]}
                      title={PIECE_LABELS[code]}
                      onClick={() => handleToolSelect(code)}
                      draggable={true}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({ type: "palette-piece", piece: code })
                        );
                        setActiveTool(code);
                      }}
                    >
                      <img draggable={false} alt={code} src={pieceAssetUrl(code)} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="palette-color-group">
                <span className="color-label">BLACK</span>
                <div className="palette-row">
                  {BLACK_PIECES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`palette-piece-btn ${activeTool === code ? "palette-piece-active" : ""}`}
                      aria-label={PIECE_LABELS[code]}
                      title={PIECE_LABELS[code]}
                      onClick={() => handleToolSelect(code)}
                      draggable={true}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({ type: "palette-piece", piece: code })
                        );
                        setActiveTool(code);
                      }}
                    >
                      <img draggable={false} alt={code} src={pieceAssetUrl(code)} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="palette-actions-row">
                <button
                  type="button"
                  className={`erase-tool-btn ${activeTool === "" ? "erase-tool-active" : ""}`}
                  onClick={() => handleToolSelect("")}
                  title="Erase piece from square"
                >
                  ✕ Erase Piece
                </button>
                {selectedSquare && (
                  <button
                    type="button"
                    className="delete-selected-btn"
                    onClick={() => {
                      const nextPlacement = setFenPiece(placement, selectedSquare.row, selectedSquare.col, "");
                      pushState(nextPlacement);
                    }}
                    title="Remove piece from selected square"
                  >
                    Clear {"abcdefgh"[selectedSquare.col]}{8 - selectedSquare.row}
                  </button>
                )}
              </div>

              {/* Accessible Piece to Place select dropdown */}
              <label className="accessible-piece-select">
                Piece to place
                <select
                  value={activeTool}
                  onChange={(event) => handleToolSelect(event.target.value)}
                >
                  {Object.entries(PIECE_LABELS).map(([code, label]) => (
                    <option key={code || "empty"} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="turn-selection-section">
              <span className="section-title">SIDE TO MOVE</span>
              <div className="turn-toggle-group">
                <button
                  type="button"
                  className={`turn-btn ${turn === "w" ? "turn-btn-active" : ""}`}
                  onClick={() => handleTurnChange("w")}
                >
                  ○ White to move
                </button>
                <button
                  type="button"
                  className={`turn-btn ${turn === "b" ? "turn-btn-active" : ""}`}
                  onClick={() => handleTurnChange("b")}
                >
                  ♟ Black to move
                </button>
              </div>
            </div>

            <div className="king-count-status">
              <span>
                Kings: White {kingCounts.whiteKings === 1 ? "✓ 1" : `⚠️ ${kingCounts.whiteKings}`}, Black{" "}
                {kingCounts.blackKings === 1 ? "✓ 1" : `⚠️ ${kingCounts.blackKings}`}
              </span>
            </div>
          </div>
        </div>

        {/* FEN and Validation */}
        <div className="editor-fen-section">
          <label className="transfer-fen">
            FEN · edit manually or copy/paste
            <input
              value={fenInputText}
              onChange={(event) => handleFenInputChange(event.target.value)}
              placeholder="Paste a complete six-field FEN position"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div
            className={`editor-validation-badge ${
              validation.isValid && !validationError ? "badge-valid" : "badge-invalid"
            }`}
            role="status"
          >
            {validation.isValid && !validationError ? (
              <span>✓ Valid chess position ({turn === "w" ? "White" : "Black"} to move) · Ready to load</span>
            ) : (
              <span>⚠️ {validationError || validation.error}</span>
            )}
          </div>
        </div>

        <footer>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="green-button"
            disabled={!validation.isValid || Boolean(validationError)}
            onClick={handleConfirmClick}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
