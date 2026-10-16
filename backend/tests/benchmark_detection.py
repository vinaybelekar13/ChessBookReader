"""Reproducible synthetic detector benchmark; no external books or scans are used."""
from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import find_grid_candidates, intersection_over_union

IOU_THRESHOLD = 0.5


@dataclass
class Page:
    name: str
    image: np.ndarray
    truth: list[tuple[int, int, int, int]]


def draw_board(image: np.ndarray, x: int, y: int, size: int, light: int = 218, dark: int = 96, border: bool = True) -> None:
    cell = size // 8
    for row in range(8):
        for col in range(8):
            value = dark if (row + col) % 2 else light
            cv2.rectangle(image, (x + col * cell, y + row * cell),
                          (x + (col + 1) * cell - 1, y + (row + 1) * cell - 1),
                          (value, value, value), -1)
    if border:
        cv2.rectangle(image, (x, y), (x + size, y + size), (24, 24, 24), 2)


def pages() -> list[Page]:
    clean = np.full((900, 1200, 3), 246, np.uint8)
    draw_board(clean, 380, 180, 320)

    paragraph = np.full((1000, 1200, 3), 248, np.uint8)
    for y in range(120, 880, 28):
        cv2.line(paragraph, (100, y), (1070, y), (215, 215, 215), 1)
    draw_board(paragraph, 510, 340, 240)

    multiple = np.full((900, 1200, 3), 246, np.uint8)
    draw_board(multiple, 80, 80, 320)
    draw_board(multiple, 760, 550, 160)

    edge = np.full((640, 800, 3), 244, np.uint8)
    draw_board(edge, 0, 0, 256, light=198, dark=173, border=False)

    low_resolution = np.full((420, 560, 3), 243, np.uint8)
    draw_board(low_resolution, 48, 96, 160, light=202, dark=173, border=False)
    low_resolution = cv2.GaussianBlur(low_resolution, (3, 3), 0.35)

    sudoku = np.full((640, 800, 3), 246, np.uint8)
    x, y, size, cell = 260, 160, 288, 32
    for index in range(10):
        thickness = 3 if index % 3 == 0 else 1
        cv2.line(sudoku, (x + index * cell, y), (x + index * cell, y + size), (50, 50, 50), thickness)
        cv2.line(sudoku, (x, y + index * cell), (x + size, y + index * cell), (50, 50, 50), thickness)

    partial = np.full((640, 800, 3), 246, np.uint8)
    for row in range(8):
        for col in range(4):
            value = 85 if (row + col) % 2 else 220
            cv2.rectangle(partial, (300 + col * 24, 170 + row * 24),
                          (299 + (col + 1) * 24, 169 + (row + 1) * 24), (value, value, value), -1)

    return [
        Page("clean-digital", clean, [(380, 180, 320, 320)]),
        Page("embedded-in-text", paragraph, [(510, 340, 240, 240)]),
        Page("multiple-boards", multiple, [(80, 80, 320, 320), (760, 550, 160, 160)]),
        Page("edge-borderless-low-contrast", edge, [(0, 0, 256, 256)]),
        Page("small-blurred-low-resolution", low_resolution, [(48, 96, 160, 160)]),
        Page("sudoku-negative", sudoku, []),
        Page("partial-four-file-negative", partial, []),
    ]


def main() -> None:
    total_truth = 0
    true_positives = 0
    false_positives = 0
    ious: list[float] = []
    latencies: list[float] = []
    partial_errors = 0
    output = []
    for page in pages():
        start = time.perf_counter()
        candidates = find_grid_candidates(page.image)
        latencies.append(time.perf_counter() - start)
        total_truth += len(page.truth)
        boxes = [
            (round(c.x * page.image.shape[1]), round(c.y * page.image.shape[0]),
             round(c.width * page.image.shape[1]), round(c.height * page.image.shape[0]), c.relative_score)
            for c in candidates
        ]
        matches: list[tuple[float, int, int]] = []
        for truth_index, truth in enumerate(page.truth):
            for candidate_index, candidate in enumerate(boxes):
                matches.append((intersection_over_union((*truth, 0.0), candidate), truth_index, candidate_index))
        used_truth: set[int] = set()
        used_candidates: set[int] = set()
        for iou, truth_index, candidate_index in sorted(matches, reverse=True):
            if iou < IOU_THRESHOLD or truth_index in used_truth or candidate_index in used_candidates:
                continue
            true_positives += 1
            ious.append(iou)
            used_truth.add(truth_index)
            used_candidates.add(candidate_index)
        false_positives += len(boxes) - len(used_candidates)
        page_partial = sum(
            1 for index, candidate in enumerate(boxes) if index not in used_candidates and
            any(0.2 < intersection_over_union(candidate, (*truth, 0.0)) < IOU_THRESHOLD for truth in page.truth)
        )
        partial_errors += page_partial
        output.append({
            "page": page.name,
            "ground_truth": len(page.truth),
            "candidates": len(boxes),
            "matched": len(used_truth),
            "partial_errors": page_partial,
            "latency_ms": round(latencies[-1] * 1000, 1),
        })

    print(json.dumps({
        "synthetic_only": True,
        "pages": len(output),
        "ground_truth_boards": total_truth,
        "iou_threshold": IOU_THRESHOLD,
        "recall": round(true_positives / total_truth, 4) if total_truth else 0,
        "precision": round(true_positives / (true_positives + false_positives), 4) if true_positives + false_positives else 0,
        "mean_iou_matched": round(float(np.mean(ious)), 4) if ious else 0,
        "false_positives_per_page": round(false_positives / len(output), 4),
        "partial_board_errors": partial_errors,
        "mean_latency_ms": round(float(np.mean(latencies)) * 1000, 1),
        "max_latency_ms": round(max(latencies) * 1000, 1),
        "per_page": output,
    }, indent=2))


if __name__ == "__main__":
    main()
