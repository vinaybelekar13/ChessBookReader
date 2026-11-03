import React, { useRef, useState } from "react";
import type { Chess, Square } from "chess.js";
import { CburnettPiece } from "./CburnettPieces";
import type { ArrowBrush, BoardArrowShape, BoardCircleShape } from "./types";

interface ChessboardViewProps {
  game: Chess;
  flipped: boolean;
  lastMove: { from: Square; to: Square } | null;
  engineBestMoveUci: string | null;
  threatMoveUci: string | null;
  showEngineArrow: boolean;
  showThreatArrow: boolean;
  userArrows: BoardArrowShape[];
  userCircles: BoardCircleShape[];
  onMakeMove: (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => boolean;
  onToggleUserArrow: (arrow: BoardArrowShape) => void;
  onToggleUserCircle: (circle: BoardCircleShape) => void;
  onClearUserShapes: () => void;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function squareCenterCoords(sq: string, flipped: boolean): { x: number; y: number } {
  const fileIndex = sq.charCodeAt(0) - 97;
  const rankIndex = parseInt(sq[1], 10) - 1;
  const col = flipped ? 7 - fileIndex : fileIndex;
  const row = flipped ? rankIndex : 7 - rankIndex;
  return { x: col + 0.5, y: row + 0.5 };
}

function pointToSquare(clientX: number, clientY: number, rect: DOMRect, flipped: boolean): Square | null {
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }
  const col = Math.min(7, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8)));
  const row = Math.min(7, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8)));
  const fileIndex = flipped ? 7 - col : col;
  const rankIndex = flipped ? row : 7 - row;
  return `${FILES[fileIndex]}${rankIndex + 1}` as Square;
}

const BRUSH_COLORS: Record<ArrowBrush, { fill: string; opacity: number }> = {
  engine: { fill: "#003088", opacity: 0.42 },
  threat: { fill: "#882020", opacity: 0.45 },
  green: { fill: "#15781B", opacity: 0.78 },
  red: { fill: "#882020", opacity: 0.78 },
  blue: { fill: "#003088", opacity: 0.78 },
  yellow: { fill: "#e68f00", opacity: 0.78 },
};

export const ChessboardView: React.FC<ChessboardViewProps> = ({
  game,
  flipped,
  lastMove,
  engineBestMoveUci,
  threatMoveUci,
  showEngineArrow,
  showThreatArrow,
  userArrows,
  userCircles,
  onMakeMove,
  onToggleUserArrow,
  onToggleUserCircle,
  onClearUserShapes,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: "w" | "b" } | null>(null);
  const [drawStart, setDrawStart] = useState<Square | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<Square | null>(null);
  const [drawBrush, setDrawBrush] = useState<ArrowBrush>("green");

  const boardMatrix = game.board();
  const inCheck = game.inCheck();
  const turnColor = game.turn();

  const legalDestinations = React.useMemo(() => {
    if (!selectedSquare) return new Map<Square, { isCapture: boolean; isPromotion: boolean }>();
    const moves = game.moves({ square: selectedSquare, verbose: true });
    const map = new Map<Square, { isCapture: boolean; isPromotion: boolean }>();
    for (const m of moves) {
      map.set(m.to as Square, {
        isCapture: Boolean(m.captured),
        isPromotion: Boolean(m.promotion),
      });
    }
    return map;
  }, [game, selectedSquare]);

  const attemptMove = (from: Square, to: Square) => {
    const piece = game.get(from);
    if (!piece) return;
    const isPawnPromo =
      piece.type === "p" &&
      ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));

    const legal = game.moves({ square: from, verbose: true }).some((m) => m.to === to);
    if (!legal) {
      const targetPiece = game.get(to);
      if (targetPiece && targetPiece.color === game.turn()) {
        setSelectedSquare(to);
      } else {
        setSelectedSquare(null);
      }
      return;
    }

    if (isPawnPromo) {
      setPendingPromotion({ from, to, color: piece.color });
      return;
    }

    onMakeMove(from, to);
    setSelectedSquare(null);
  };

  const handleSquareLeftClick = (sq: Square) => {
    if (userArrows.length > 0 || userCircles.length > 0) {
      onClearUserShapes();
    }
    if (selectedSquare && legalDestinations.has(sq)) {
      attemptMove(selectedSquare, sq);
      return;
    }
    const piece = game.get(sq);
    if (piece && piece.color === turnColor) {
      setSelectedSquare(sq === selectedSquare ? null : sq);
    } else {
      setSelectedSquare(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 2 || !boardRef.current) return;
    e.preventDefault();
    const sq = pointToSquare(e.clientX, e.clientY, boardRef.current.getBoundingClientRect(), flipped);
    if (!sq) return;
    const brush: ArrowBrush = e.shiftKey && e.altKey
      ? "yellow"
      : e.shiftKey
        ? "red"
        : e.altKey
          ? "blue"
          : "green";
    setDrawBrush(brush);
    setDrawStart(sq);
    setDrawCurrent(sq);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawStart || !boardRef.current) return;
    const sq = pointToSquare(e.clientX, e.clientY, boardRef.current.getBoundingClientRect(), flipped);
    if (sq) setDrawCurrent(sq);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawStart || !boardRef.current) return;
    const endSq =
      pointToSquare(e.clientX, e.clientY, boardRef.current.getBoundingClientRect(), flipped) ?? drawCurrent;
    if (endSq) {
      if (endSq === drawStart) {
        onToggleUserCircle({ square: endSq, brush: drawBrush });
      } else {
        onToggleUserArrow({ from: drawStart, to: endSq, brush: drawBrush });
      }
    }
    setDrawStart(null);
    setDrawCurrent(null);
  };

  // Combine engine best-move arrow, threat arrow, user arrows, and active preview arrow
  const allArrows: BoardArrowShape[] = [];
  if (showEngineArrow && engineBestMoveUci && engineBestMoveUci.length >= 4) {
    allArrows.push({
      from: engineBestMoveUci.slice(0, 2) as Square,
      to: engineBestMoveUci.slice(2, 4) as Square,
      brush: "engine",
    });
  }
  if (showThreatArrow && threatMoveUci && threatMoveUci.length >= 4) {
    allArrows.push({
      from: threatMoveUci.slice(0, 2) as Square,
      to: threatMoveUci.slice(2, 4) as Square,
      brush: "threat",
    });
  }
  allArrows.push(...userArrows);
  if (drawStart && drawCurrent && drawStart !== drawCurrent) {
    allArrows.push({ from: drawStart, to: drawCurrent, brush: drawBrush });
  }

  return (
    <div className="li-board-container">
      <div
        ref={boardRef}
        className="li-chessground-board"
        role="grid"
        aria-label="Lichess Analysis Chessboard"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {Array.from({ length: 64 }, (_, idx) => {
          const row = Math.floor(idx / 8);
          const col = idx % 8;
          const fileIndex = flipped ? 7 - col : col;
          const rankIndex = flipped ? row : 7 - row;
          const sq = `${FILES[fileIndex]}${rankIndex + 1}` as Square;
          const isLight = (fileIndex + rankIndex) % 2 === 1;
          const piece = boardMatrix[7 - rankIndex]?.[fileIndex] ?? null;
          const isLastMove = lastMove?.from === sq || lastMove?.to === sq;
          const isSelected = selectedSquare === sq;
          const legalInfo = legalDestinations.get(sq);
          const isKingInCheck = inCheck && piece?.type === "k" && piece?.color === turnColor;

          return (
            <div
              key={sq}
              role="gridcell"
              aria-label={`${sq}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : ""}`}
              data-square={sq}
              className={[
                "li-cg-square",
                isLight ? "li-cg-light" : "li-cg-dark",
                isLastMove ? "li-cg-last-move" : "",
                isSelected ? "li-cg-selected" : "",
                isKingInCheck ? "li-cg-check" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleSquareLeftClick(sq)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const fromSq = e.dataTransfer.getData("text/plain") as Square;
                if (fromSq && fromSq !== sq) {
                  attemptMove(fromSq, sq);
                }
              }}
            >
              {/* Rank coordinate on right-most column (col === 7) matching Lichess */}
              {col === 7 && (
                <span className={`li-coord-rank ${isLight ? "li-coord-on-light" : "li-coord-on-dark"}`}>
                  {rankIndex + 1}
                </span>
              )}

              {/* File coordinate on bottom-most row (row === 7) matching Lichess */}
              {row === 7 && (
                <span className={`li-coord-file ${isLight ? "li-coord-on-light" : "li-coord-on-dark"}`}>
                  {FILES[fileIndex]}
                </span>
              )}

              {/* Piece SVG */}
              {piece && (
                <div
                  className="li-piece-wrapper"
                  draggable={piece.color === turnColor}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", sq);
                    setSelectedSquare(sq);
                  }}
                >
                  <CburnettPiece color={piece.color} type={piece.type} />
                </div>
              )}

              {/* Legal move dot or capture corner ring */}
              {legalInfo && (
                <span className={legalInfo.isCapture ? "li-legal-capture-ring" : "li-legal-move-dot"} />
              )}
            </div>
          );
        })}

        {/* SVG Overlay for Engine Best-Move Arrow, Threat Arrow, User Arrows & Circles */}
        <svg className="li-cg-shapes-svg" viewBox="0 0 8 8" aria-hidden="true">
          {userCircles.map((circle, i) => {
            const center = squareCenterCoords(circle.square, flipped);
            const style = BRUSH_COLORS[circle.brush];
            return (
              <circle
                key={`circle-${circle.square}-${i}`}
                cx={center.x}
                cy={center.y}
                r={0.44}
                fill="none"
                stroke={style.fill}
                strokeWidth={0.075}
                opacity={style.opacity}
              />
            );
          })}

          {allArrows.map((arrow, i) => {
            const from = squareCenterCoords(arrow.from, flipped);
            const to = squareCenterCoords(arrow.to, flipped);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy);
            if (len < 0.01) return null;

            const ux = dx / len;
            const uy = dy / len;
            const px = -uy;
            const py = ux;

            // Match Lichess thick translucent best-move arrow proportions in screenshot
            const isEngine = arrow.brush === "engine";
            const shaftHalfWidth = isEngine ? 0.135 : 0.095;
            const headHalfWidth = isEngine ? 0.36 : 0.27;
            const headLength = isEngine ? 0.48 : 0.38;

            const tipX = to.x - ux * 0.05;
            const tipY = to.y - uy * 0.05;
            const neckX = tipX - ux * headLength;
            const neckY = tipY - uy * headLength;
            const startX = from.x;
            const startY = from.y;

            const pts = [
              [startX + px * shaftHalfWidth, startY + py * shaftHalfWidth],
              [neckX + px * shaftHalfWidth, neckY + py * shaftHalfWidth],
              [neckX + px * headHalfWidth, neckY + py * headHalfWidth],
              [tipX, tipY],
              [neckX - px * headHalfWidth, neckY - py * headHalfWidth],
              [neckX - px * shaftHalfWidth, neckY - py * shaftHalfWidth],
              [startX - px * shaftHalfWidth, startY - py * shaftHalfWidth],
            ]
              .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
              .join(" ");

            const brushStyle = BRUSH_COLORS[arrow.brush];
            return (
              <g key={`arrow-${arrow.from}-${arrow.to}-${i}`} opacity={brushStyle.opacity}>
                <circle cx={startX} cy={startY} r={shaftHalfWidth} fill={brushStyle.fill} />
                <polygon points={pts} fill={brushStyle.fill} />
              </g>
            );
          })}
        </svg>

        {/* Promotion Chooser Overlay */}
        {pendingPromotion && (
          <div className="li-promotion-overlay" onClick={() => setPendingPromotion(null)}>
            <div className="li-promotion-column" onClick={(e) => e.stopPropagation()}>
              {(["q", "n", "r", "b"] as const).map((promoPiece) => (
                <button
                  key={promoPiece}
                  type="button"
                  className="li-promotion-choice"
                  aria-label={`Promote to ${promoPiece}`}
                  onClick={() => {
                    onMakeMove(pendingPromotion.from, pendingPromotion.to, promoPiece);
                    setPendingPromotion(null);
                    setSelectedSquare(null);
                  }}
                >
                  <CburnettPiece color={pendingPromotion.color} type={promoPiece} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
