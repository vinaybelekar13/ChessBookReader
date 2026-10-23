import type { Candidate } from "./model";

export type NotationHighlightKind = "continuous" | "variation" | "prose";

export type NotationHighlight = {
  id: string;
  candidateId: string;
  kind: NotationHighlightKind;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PDFTextItemInput = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

const MOVE_NUMBER_REGEX = /\b\d{1,3}\s*(\.{1,3}|…)/;
const FIGURINE_REGEX = /[♔♕♖♗♘♙♚♛♜♝♞♟]/;
const SAN_MOVE_REGEX = /\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[\+#]?|O-O(?:-O)?[\+#]?)\b/;
const FIGURINE_MOVE_REGEX = /[♔♕♖♗♘♙♚♛♜♝♞♟]x?[a-h][1-8](?:=[QRBN])?[\+#]?/;
const CHESS_SYMBOL_REGEX = /([!?]{1,2}|(\+\/?-|-\/?\+|\+\/=|=\/\+|±|∓|⩲|⩱|=|∞|⨁))/;
const CHESS_PROSE_REGEX = /\b(diagram|position|white to|black to|wins|draw|mate in|play|move|variation|defense|attack|advantage)\b/i;

export function isChessNotationText(text: string): { isNotation: boolean; kind: NotationHighlightKind } {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return { isNotation: false, kind: "continuous" };

  const hasMoveNum = MOVE_NUMBER_REGEX.test(trimmed);
  const hasSan = SAN_MOVE_REGEX.test(trimmed);
  const hasFigurine = FIGURINE_REGEX.test(trimmed) || FIGURINE_MOVE_REGEX.test(trimmed);
  const hasSymbol = CHESS_SYMBOL_REGEX.test(trimmed);
  const hasProse = CHESS_PROSE_REGEX.test(trimmed);

  if (trimmed.startsWith("(") || (trimmed.includes("(") && (hasSan || hasFigurine))) {
    return { isNotation: true, kind: "variation" };
  }

  if (hasMoveNum && (hasSan || hasFigurine)) {
    return { isNotation: true, kind: "continuous" };
  }

  if (hasSan && (hasFigurine || hasSymbol || trimmed.split(/\s+/).length >= 2)) {
    return { isNotation: true, kind: "continuous" };
  }

  if (hasFigurine && (hasSan || hasSymbol || hasMoveNum)) {
    return { isNotation: true, kind: "continuous" };
  }

  if (hasProse && (hasMoveNum || hasSan || hasFigurine || trimmed.toLowerCase().includes("diagram"))) {
    return { isNotation: true, kind: "prose" };
  }

  return { isNotation: false, kind: "continuous" };
}

type NormalizedTextLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: NotationHighlightKind;
};

export function extractNotationHighlights(
  items: PDFTextItemInput[],
  viewport: { width: number; height: number; convertToViewportPoint?: (x: number, y: number) => [number, number] },
  candidates: Candidate[],
): NotationHighlight[] {
  if (!items.length || !candidates.length || viewport.width <= 0 || viewport.height <= 0) {
    return [];
  }

  const textItems: { text: string; x: number; y: number; width: number; height: number }[] = [];

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const tx = item.transform[4];
    const ty = item.transform[5];
    const w = item.width || Math.abs(item.transform[0]) || 8;
    const h = item.height || Math.abs(item.transform[3]) || 10;

    let x1: number, y1: number, x2: number, y2: number;
    if (typeof viewport.convertToViewportPoint === "function") {
      [x1, y1] = viewport.convertToViewportPoint(tx, ty + h);
      [x2, y2] = viewport.convertToViewportPoint(tx + w, ty);
    } else {
      x1 = tx;
      y1 = viewport.height - (ty + h);
      x2 = tx + w;
      y2 = viewport.height - ty;
    }

    const normX = Math.max(0, Math.min(1, Math.min(x1, x2) / viewport.width));
    const normY = Math.max(0, Math.min(1, Math.min(y1, y2) / viewport.height));
    const normW = Math.max(0.005, Math.min(1 - normX, Math.abs(x2 - x1) / viewport.width));
    const normH = Math.max(0.005, Math.min(1 - normY, Math.abs(y2 - y1) / viewport.height));

    textItems.push({
      text: item.str,
      x: normX,
      y: normY,
      width: normW,
      height: normH,
    });
  }

  if (!textItems.length) return [];

  textItems.sort((a, b) => (Math.abs(a.y - b.y) < 0.008 ? a.x - b.x : a.y - b.y));

  const lines: NormalizedTextLine[] = [];
  let currentGroup: typeof textItems = [];

  function flushGroup() {
    if (!currentGroup.length) return;
    const text = currentGroup.map((i) => i.text).join(" ").trim();
    const { isNotation, kind } = isChessNotationText(text);

    if (isNotation) {
      const minX = Math.min(...currentGroup.map((i) => i.x));
      const minY = Math.min(...currentGroup.map((i) => i.y));
      const maxX = Math.max(...currentGroup.map((i) => i.x + i.width));
      const maxY = Math.max(...currentGroup.map((i) => i.y + i.height));
      lines.push({
        text,
        x: Math.max(0, minX - 0.003),
        y: Math.max(0, minY - 0.002),
        width: Math.min(1 - minX, (maxX - minX) + 0.006),
        height: Math.min(1 - minY, (maxY - minY) + 0.004),
        kind,
      });
    }
    currentGroup = [];
  }

  for (const item of textItems) {
    if (!currentGroup.length) {
      currentGroup.push(item);
    } else {
      const last = currentGroup[currentGroup.length - 1];
      const sameLine = Math.abs(item.y - last.y) < 0.01;
      const nearbyX = item.x - (last.x + last.width) < 0.08;
      if (sameLine && nearbyX) {
        currentGroup.push(item);
      } else {
        flushGroup();
        currentGroup.push(item);
      }
    }
  }
  flushGroup();

  if (!lines.length) return [];

  const result: NotationHighlight[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    let bestCandidate = candidates[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const candBottom = candidate.y + candidate.height;
      const candTop = candidate.y;
      const candCenterX = candidate.x + candidate.width / 2;
      const lineCenterX = line.x + line.width / 2;

      const isBelow = line.y >= candTop - 0.02 && line.y <= candBottom + 0.35;
      const xDist = Math.abs(lineCenterX - candCenterX);
      const yDist = line.y >= candBottom ? (line.y - candBottom) : Math.abs(line.y - candTop);

      const score = (isBelow ? 0 : 10) + yDist * 2 + xDist * 1.5;

      if (score < bestDistance) {
        bestDistance = score;
        bestCandidate = candidate;
      }
    }

    result.push({
      id: "highlight-" + bestCandidate.id + "-" + (index + 1),
      candidateId: bestCandidate.id,
      kind: line.kind,
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
    });
  }

  return result;
}
