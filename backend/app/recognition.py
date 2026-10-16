from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

MODEL_PATH = Path(__file__).parents[1] / "models" / "yolo26m-finetuned.onnx"
MODEL_SIZE = 640
CONFIDENCE_THRESHOLD = 0.25
PIECE_TO_FEN = {
    1: "p", 2: "r", 3: "b", 4: "n", 5: "k", 6: "q",
    7: "P", 8: "R", 9: "B", 10: "N", 11: "K", 12: "Q",
}


class RecognitionUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class Detection:
    class_id: int
    confidence: float
    box: tuple[float, float, float, float]


@lru_cache(maxsize=1)
def _model_session():
    if not MODEL_PATH.is_file():
        raise RecognitionUnavailable(
            "The OCR model is not installed. Run `py download_ocr_model.py` in backend."
        )
    try:
        import onnxruntime
    except ImportError as cause:
        raise RecognitionUnavailable(
            "ONNX Runtime is not installed. Install backend/requirements-ocr.txt."
        ) from cause
    return onnxruntime.InferenceSession(
        str(MODEL_PATH), providers=["CPUExecutionProvider"]
    )


def _prepare_image(image: np.ndarray) -> tuple[np.ndarray, float, float, float]:
    height, width = image.shape[:2]
    scale = min(MODEL_SIZE / width, MODEL_SIZE / height)
    resized_width = round(width * scale)
    resized_height = round(height * scale)
    resized = cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)
    pad_x = (MODEL_SIZE - resized_width) / 2
    pad_y = (MODEL_SIZE - resized_height) / 2
    left, top = round(pad_x - 0.1), round(pad_y - 0.1)
    right, bottom = MODEL_SIZE - resized_width - left, MODEL_SIZE - resized_height - top
    padded = cv2.copyMakeBorder(
        resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )
    tensor = np.ascontiguousarray(
        padded[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32) / 255.0
    )
    return tensor, scale, float(left), float(top)


def _decode_rows(
    rows: np.ndarray,
    image_width: int,
    image_height: int,
    scale: float,
    pad_x: float,
    pad_y: float,
) -> list[Detection]:
    detections: list[Detection] = []
    for row in np.asarray(rows, dtype=np.float32).reshape(-1, 6):
        x1, y1, x2, y2, confidence, class_value = (float(value) for value in row)
        class_id = int(class_value)
        if confidence < CONFIDENCE_THRESHOLD or class_id not in range(16):
            continue
        box = (
            max(0.0, min(float(image_width), (x1 - pad_x) / scale)),
            max(0.0, min(float(image_height), (y1 - pad_y) / scale)),
            max(0.0, min(float(image_width), (x2 - pad_x) / scale)),
            max(0.0, min(float(image_height), (y2 - pad_y) / scale)),
        )
        if box[2] > box[0] and box[3] > box[1]:
            detections.append(Detection(class_id, confidence, box))
    return detections


def _fen_placement(
    pieces: dict[tuple[int, int], tuple[str, float]], flipped: bool
) -> tuple[str, dict[str, float], int]:
    ranks: list[str] = []
    confidences: dict[str, float] = {}
    collisions = 0
    for row in range(8):
        rank_text = ""
        empty_count = 0
        for col in range(8):
            visual_row = 7 - row if flipped else row
            visual_col = 7 - col if flipped else col
            piece = pieces.get((visual_row, visual_col))
            if piece is None:
                empty_count += 1
                continue
            if empty_count:
                rank_text += str(empty_count)
                empty_count = 0
            rank_text += piece[0]
            file_name = chr(ord("a") + col)
            rank_name = str(8 - row)
            confidences[file_name + rank_name] = piece[1]
        if empty_count:
            rank_text += str(empty_count)
        ranks.append(rank_text)
    return "/".join(ranks), confidences, collisions


def assemble_position(detections: list[Detection], image_width: int, image_height: int) -> dict:
    boards = [item for item in detections if item.class_id == 0]
    if not boards:
        raise ValueError("The OCR model did not localize a complete chessboard in this crop.")
    board = max(boards, key=lambda item: item.confidence)
    x1, y1, x2, y2 = board.box
    if x2 - x1 < 8 or y2 - y1 < 8:
        raise ValueError("The recognized board crop is too small. Adjust the crop and retry.")

    pieces: dict[tuple[int, int], tuple[str, float]] = {}
    unmatched_count = 0
    collisions = 0
    for item in detections:
        if item.class_id not in PIECE_TO_FEN:
            continue
        center_x = (item.box[0] + item.box[2]) / 2
        center_y = (item.box[1] + item.box[3]) / 2
        if not (x1 <= center_x < x2 and y1 <= center_y < y2):
            unmatched_count += 1
            continue
        col = min(7, int((center_x - x1) / ((x2 - x1) / 8)))
        row = min(7, int((center_y - y1) / ((y2 - y1) / 8)))
        previous = pieces.get((row, col))
        if previous is None or item.confidence > previous[1]:
            if previous is not None:
                collisions += 1
            pieces[(row, col)] = (PIECE_TO_FEN[item.class_id], item.confidence)
        else:
            collisions += 1

    orientation_marker = [item for item in detections if item.class_id == 13]
    orientation_detection = max(orientation_marker, key=lambda item: item.confidence) if orientation_marker else None
    flipped = bool(orientation_detection and (orientation_detection.box[1] + orientation_detection.box[3]) / 2 < (y1 + y2) / 2)
    orientation = "flipped" if flipped else "normal" if orientation_detection else "unknown"

    placement, piece_confidences, _ = _fen_placement(pieces, flipped)
    end_markers = [item for item in detections if item.class_id == 15]
    turn = "w"
    turn_inferred = False
    if end_markers:
        marker = max(end_markers, key=lambda item: item.confidence)
        marker_center = ((marker.box[0] + marker.box[2]) / 2, (marker.box[1] + marker.box[3]) / 2)
        for item in detections:
            if item.class_id in PIECE_TO_FEN and (
                item.box[0] <= marker_center[0] <= item.box[2]
                and item.box[1] <= marker_center[1] <= item.box[3]
            ):
                turn = "w" if item.class_id <= 6 else "b"
                turn_inferred = True
                break

    piece_scores = [score for _, score in pieces.values()]
    return {
        "fen": f"{placement} {turn} - - 0 1",
        "placement": placement,
        "orientation": orientation,
        "orientation_confidence": orientation_detection.confidence if orientation_detection else None,
        "turn_inferred": turn_inferred,
        "board_confidence": board.confidence,
        "mean_piece_confidence": sum(piece_scores) / len(piece_scores) if piece_scores else None,
        "piece_confidences": piece_confidences,
        "piece_count": len(pieces),
        "unmatched_piece_count": unmatched_count,
        "collision_count": collisions,
        "warnings": [
            *([] if orientation_detection else ["Board orientation was not detected; normal orientation is assumed."]),
            *([] if turn_inferred else ["Side to move is not visible; White is assumed."]),
            *(["No chess pieces were recognized. Do not trust this position; adjust the crop and retry."] if not pieces else []),
            *([f"{collisions} overlapping piece detections shared a square; the highest-confidence detection was kept."] if collisions else []),
            *([f"{unmatched_count} piece detections fell outside the detected board and were ignored."] if unmatched_count else []),
            "Castling rights and en-passant state cannot be determined from a static diagram; FEN defaults are used.",
        ],
    }


def _normalize_model_rows(output: np.ndarray) -> np.ndarray:
    """Normalize supported batched/unbatched [N, 6] detection outputs."""
    raw = np.asarray(output)
    original_shape = raw.shape
    if raw.ndim >= 3 and raw.shape[0] == 1:
        raw = raw[0]
    if raw.ndim == 1 and raw.size % 6 == 0:
        raw = raw.reshape(-1, 6)
    if raw.ndim != 2 or raw.shape[-1] != 6:
        raise ValueError(
            f"Unsupported OCR model output shape {original_shape}; expected detection rows [N, 6]."
        )
    return raw


def recognize_image(image: np.ndarray) -> dict:
    tensor, scale, pad_x, pad_y = _prepare_image(image)
    session = _model_session()
    outputs = session.run(None, {session.get_inputs()[0].name: tensor})
    if not outputs:
        raise ValueError("The OCR model returned no outputs. Verify that the installed model is compatible.")
    rows = _normalize_model_rows(outputs[0])
    detections = _decode_rows(
        rows, image.shape[1], image.shape[0], scale, pad_x, pad_y
    )
    result = assemble_position(detections, image.shape[1], image.shape[0])
    result["model"] = "2d-chess-ocr/yolo26m-finetuned"
    return result

def detect_board_candidates(
    image: np.ndarray,
    tile_size: int = 640,
    overlap: float = 0.25,
    max_candidates: int = 32,
    min_board_side: int = 32,
    nms_iou: float = 0.35,
) -> list[dict]:
    """
    Detect multiple chessboards across a page using overlapping tiles.

    Returns normalized page coordinates:
    x, y, width, height, relative_score.

    relative_score is the model's board confidence, not a calibrated
    probability that the entire position/FEN is correct.
    """
    if image is None or image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("Expected a decoded BGR image.")

    if tile_size < 64:
        raise ValueError("tile_size must be at least 64.")
    if not 0 <= overlap < 1:
        raise ValueError("overlap must be in the range [0, 1).")

    page_height, page_width = image.shape[:2]
    if page_width == 0 or page_height == 0:
        return []

    session = _model_session()
    input_name = session.get_inputs()[0].name

    stride = max(1, round(tile_size * (1.0 - overlap)))

    def tile_starts(length: int) -> list[int]:
        if length <= tile_size:
            return [0]
        starts = list(range(0, length - tile_size + 1, stride))
        last = length - tile_size
        if starts[-1] != last:
            starts.append(last)
        return starts

    # Each entry is (x1, y1, x2, y2, confidence) in page pixels.
    boxes: list[tuple[float, float, float, float, float]] = []

    for top in tile_starts(page_height):
        for left in tile_starts(page_width):
            right = min(left + tile_size, page_width)
            bottom = min(top + tile_size, page_height)
            tile = image[top:bottom, left:right]

            tensor, scale, pad_x, pad_y = _prepare_image(tile)
            outputs = session.run(None, {input_name: tensor})

            if not outputs:
                raise ValueError("The OCR model returned no outputs.")

            rows = _normalize_model_rows(outputs[0])
            detections = _decode_rows(
                rows,
                tile.shape[1],
                tile.shape[0],
                scale,
                pad_x,
                pad_y,
            )

            for detection in detections:
                if detection.class_id != 0:
                    continue

                x1, y1, x2, y2 = detection.box
                if x2 <= x1 or y2 <= y1:
                    continue
                if min(x2 - x1, y2 - y1) < min_board_side:
                    continue

                # Translate tile coordinates to original page coordinates.
                x1 += left
                x2 += left
                y1 += top
                y2 += top

                x1 = max(0.0, min(float(page_width), x1))
                x2 = max(0.0, min(float(page_width), x2))
                y1 = max(0.0, min(float(page_height), y1))
                y2 = max(0.0, min(float(page_height), y2))

                if x2 > x1 and y2 > y1:
                    boxes.append(
                        (x1, y1, x2, y2, detection.confidence)
                    )

    # Greedy non-maximum suppression removes duplicate boards from
    # overlapping tiles while keeping distinct nearby diagrams.
    boxes.sort(key=lambda box: box[4], reverse=True)
    kept: list[tuple[float, float, float, float, float]] = []

    for candidate in boxes:
        ax1, ay1, ax2, ay2, _ = candidate
        area_a = (ax2 - ax1) * (ay2 - ay1)
        duplicate = False

        for existing in kept:
            bx1, by1, bx2, by2, _ = existing
            ix1, iy1 = max(ax1, bx1), max(ay1, by1)
            ix2, iy2 = min(ax2, bx2), min(ay2, by2)
            intersection = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
            area_b = (bx2 - bx1) * (by2 - by1)
            union = area_a + area_b - intersection

            smaller_area = min(area_a, area_b)
            containment = intersection / smaller_area if smaller_area > 0 else 0.0

            # Remove partial detections contained within a stronger,
            # larger board candidate, even when ordinary IoU is low.
            if (
                (union > 0 and intersection / union > nms_iou)
                or containment > 0.80
            ):
                duplicate = True
                break

        if not duplicate:
            kept.append(candidate)
            if len(kept) >= max_candidates:
                break

    # The frontend expects normalized coordinates, independent of page size.
    kept.sort(key=lambda box: (box[1], box[0]))

    return [
        {
            "x": x1 / page_width,
            "y": y1 / page_height,
            "width": (x2 - x1) / page_width,
            "height": (y2 - y1) / page_height,
            "relative_score": confidence,
        }
        for x1, y1, x2, y2, confidence in kept
    ]
