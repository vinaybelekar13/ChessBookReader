from __future__ import annotations

import os
from pathlib import Path

def load_backend_env() -> None:
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.is_file():
        return
    for raw_line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")

load_backend_env()


from functools import lru_cache
from io import BytesIO
from typing import Annotated

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.lichess_oauth import router as lichess_oauth_router

from app.recognition import (
    RecognitionUnavailable,
    detect_board_candidates,
    recognize_image,
)

app = FastAPI(title="ChessBook Reader CV API", version="0.1.0")
app.include_router(lichess_oauth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chessbookreader.netlify.app"],
    allow_origin_regex=r"https?://(127\.0\.0\.1|localhost):\d+",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_DETECT_SIDE = 1800
_PARITY = np.fromfunction(lambda row, col: (-1.0) ** (row + col), (8, 8))
_EVEN_CELLS = _PARITY > 0
_ODD_CELLS = ~_EVEN_CELLS


class Candidate(BaseModel):
    id: str
    x: float
    y: float
    width: float
    height: float
    relative_score: float
    source: str = "automatic"


class DetectionResponse(BaseModel):
    status: str
    candidates: list[Candidate]


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "detector": "yolo26m-finetuned",
        "recognizer": "2d-chess-ocr/yolo26m-finetuned",
    }


@app.post("/detect", response_model=DetectionResponse)
async def detect(image: Annotated[UploadFile, File(...)]) -> DetectionResponse:
    if image.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(
            status_code=415,
            detail="Upload a PNG or JPEG rendered page.",
        )

    content = await image.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Rendered page image exceeds 12 MiB.",
        )
    if not content:
        raise HTTPException(status_code=400, detail="Image is empty.")

    decoded = cv2.imdecode(
        np.frombuffer(content, dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )
    if decoded is None:
        raise HTTPException(
            status_code=400,
            detail="Image data could not be decoded.",
        )

    height, width = decoded.shape[:2]
    scale = min(
        1.0,
        MAX_DETECT_SIDE / max(width, height),
        (30_000_000 / (width * height)) ** 0.5,
    )
    working = decoded if scale == 1.0 else cv2.resize(
        decoded,
        (round(width * scale), round(height * scale)),
        interpolation=cv2.INTER_AREA,
    )

    try:
        model_candidates = detect_board_candidates(working)
    except RecognitionUnavailable:
        candidates = find_grid_candidates(working)
        return DetectionResponse(
            status="detected" if candidates else "none",
            candidates=candidates,
        )

    candidates = [
        Candidate(
            id=f"page-candidate-{index + 1}",
            x=item["x"],
            y=item["y"],
            width=item["width"],
            height=item["height"],
            relative_score=item["relative_score"],
            source="yolo",
        )
        for index, item in enumerate(model_candidates)
    ]

    return DetectionResponse(
        status="detected" if candidates else "none",
        candidates=candidates,
    )
@app.post("/recognize")
async def recognize(image: Annotated[UploadFile, File(...)]) -> dict:
    if image.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(status_code=415, detail="Upload a PNG or JPEG board crop.")
    content = await image.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Board crop exceeds 12 MiB.")
    if not content:
        raise HTTPException(status_code=400, detail="Board crop is empty.")
    decoded = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        raise HTTPException(status_code=400, detail="Board crop could not be decoded.")
    try:
        return recognize_image(decoded)
    except RecognitionUnavailable as cause:
        raise HTTPException(status_code=503, detail=str(cause)) from cause
    except ValueError as cause:
        raise HTTPException(status_code=422, detail=str(cause)) from cause


def count_repeated_peaks(values: np.ndarray) -> int:
    if len(values) < 12:
        return 0
    smooth = np.convolve(values, np.ones(3, dtype=np.float32) / 3, mode="same")
    threshold = float(np.mean(smooth) + np.std(smooth) * 0.45)
    peak_indices = np.where((smooth[1:-1] > smooth[:-2]) & (smooth[1:-1] >= smooth[2:]) & (smooth[1:-1] > threshold))[0] + 1
    count = 0
    last = -4
    for index in peak_indices:
        if index - last >= max(2, len(values) // 15):
            count += 1
            last = int(index)
    return count


@lru_cache(maxsize=256)
def cell_sample_offsets(size: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, int]:
    patch = max(1, size // 16)
    starts_x = np.arange(8) * size // 8 + (size // 8 - patch) // 2
    starts_y = np.arange(8) * size // 8 + (size // 8 - patch) // 2
    return starts_x, starts_y, starts_x + patch, starts_y + patch, patch


def checker_score(integral: np.ndarray, x: int, y: int, size: int) -> tuple[float, float]:
    """Score all 64 cells together; a partial grid cannot pass on line count alone."""
    starts_x, starts_y, ends_x, ends_y, patch = cell_sample_offsets(size)
    sums = (
        integral[y + ends_y[:, None], x + ends_x]
        - integral[y + starts_y[:, None], x + ends_x]
        - integral[y + ends_y[:, None], x + starts_x]
        + integral[y + starts_y[:, None], x + starts_x]
    )
    cells = (sums / (patch * patch)).astype(np.float32)
    centered = cells - cells.mean()
    variation = float(np.sqrt(np.sum(centered * centered)))
    if variation < 1:
        return 0.0, 0.0
    correlation = abs(float(np.sum(centered * _PARITY))) / (variation * 8)
    contrast = abs(float(cells[_EVEN_CELLS].mean() - cells[_ODD_CELLS].mean())) / max(variation / 8, 12.0)
    return correlation, contrast


def continuation_score(gray: np.ndarray, x: int, y: int, size: int, contrast: float) -> float:
    """Penalize a box when the alternating cells visibly continue outside its edge."""
    height, width = gray.shape[:2]
    band = max(2, size // 24)
    scores: list[float] = []
    for side, start, end in (
        ("left", x - band, x),
        ("right", x + size, x + size + band),
        ("top", y - band, y),
        ("bottom", y + size, y + size + band),
    ):
        if side in {"left", "right"}:
            start, end = max(0, start), min(width, end)
            if end - start < band:
                continue
            strip = gray[y : y + size, start:end]
            values = cv2.resize(strip, (1, 8), interpolation=cv2.INTER_AREA).reshape(8)
            expected = np.array([(-1.0) ** (row + (8 if side == "right" else -1)) for row in range(8)])
            board_mean = cv2.resize(gray[y : y + size, x : x + size], (8, 8), interpolation=cv2.INTER_AREA).mean()
        else:
            start, end = max(0, start), min(height, end)
            if end - start < band:
                continue
            strip = gray[start:end, x : x + size]
            values = cv2.resize(strip, (8, 1), interpolation=cv2.INTER_AREA).reshape(8)
            expected = np.array([(-1.0) ** ((0 if side == "top" else 8) + col) for col in range(8)])
            board_mean = cv2.resize(gray[y : y + size, x : x + size], (8, 8), interpolation=cv2.INTER_AREA).mean()
        correlation = abs(float(np.dot(values - board_mean, expected) / (np.linalg.norm(values - board_mean) * np.sqrt(8) + 1e-6)))
        scores.append(correlation)
    if not scores:
        return 0.0
    return max(scores) * min(1.0, contrast / 0.8)


def find_grid_candidates(image: np.ndarray) -> list[Candidate]:
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    integral = cv2.integral(gray, sdepth=cv2.CV_64F)
    smallest = 40
    largest = min(width, height)
    if largest < smallest:
        return []

    # A coarse, multiscale square-window scan finds borderless diagrams too.
    sizes: list[int] = []
    size = smallest
    while size <= largest:
        sizes.append(size)
        next_size = max(size + 1, round(size * 1.1))
        if next_size == size:
            break
        size = next_size
    if sizes[-1] != largest:
        sizes.append(largest)

    found: list[tuple[int, int, int, int, float]] = []
    for size in sizes:
        step = max(4, size // 4)
        xs = list(range(0, width - size + 1, step))
        ys = list(range(0, height - size + 1, step))
        if not xs or xs[-1] != width - size:
            xs.append(width - size)
        if not ys or ys[-1] != height - size:
            ys.append(height - size)
        for y in ys:
            for x in xs:
                correlation, contrast = checker_score(integral, x, y, size)
                if correlation < 0.3 or contrast < 0.5:
                    continue
                score = 0.72 * correlation + 0.28 * min(1.0, contrast / 1.2)
                if score >= 0.38:
                    found.append((x, y, size, size, score))

    # Contours add precise outer-frame seeds that a coarse texture scan can miss.
    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 40, 130)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        x, y, box_width, box_height = cv2.boundingRect(contour)
        if box_width < smallest or box_height < smallest:
            continue
        ratio = box_width / box_height
        if not 0.78 <= ratio <= 1.28:
            continue
        size = round((box_width + box_height) / 2)
        if size > largest:
            continue
        x = min(x, width - size)
        y = min(y, height - size)
        correlation, contrast = checker_score(integral, x, y, size)
        score = 0.72 * correlation + 0.28 * min(1.0, contrast / 1.2)
        if correlation >= 0.3 and contrast >= 0.5 and score >= 0.38:
            found.append((x, y, size, size, score))

    found.sort(key=lambda item: item[4], reverse=True)
    seeds: list[tuple[int, int, int, int, float]] = []
    for proposal in found:
        if any(intersection_over_union(proposal, existing) > 0.42 for existing in seeds):
            continue
        seeds.append(proposal)
        if len(seeds) == 32:
            break

    refined: list[tuple[int, int, int, int, float]] = []
    for seed_x, seed_y, seed_size, _, _ in seeds:
        position_step = max(2, seed_size // 32)
        size_step = max(2, seed_size // 32)
        minimum_size = max(smallest, seed_size - seed_size // 10)
        maximum_size = min(largest, seed_size + seed_size // 10)
        refine_sizes = list(range(minimum_size, maximum_size + 1, size_step))
        if not refine_sizes or refine_sizes[-1] != maximum_size:
            refine_sizes.append(maximum_size)
        for candidate_size in refine_sizes:
            for candidate_y in range(max(0, seed_y - seed_size // 4), min(height - candidate_size, seed_y + seed_size // 4) + 1, position_step):
                for candidate_x in range(max(0, seed_x - seed_size // 4), min(width - candidate_size, seed_x + seed_size // 4) + 1, position_step):
                    correlation, contrast = checker_score(integral, candidate_x, candidate_y, candidate_size)
                    if correlation < 0.3 or contrast < 0.5:
                        continue
                    score = 0.72 * correlation + 0.28 * min(1.0, contrast / 1.2)
                    refined.append((candidate_x, candidate_y, candidate_size, candidate_size, score))

    refined.sort(key=lambda item: item[4], reverse=True)
    proposals: list[tuple[int, int, int, int, float]] = []
    for proposal in refined:
        if any(intersection_over_union(proposal, existing) > 0.82 for existing in proposals):
            continue
        proposals.append(proposal)
        if len(proposals) == 384:
            break

    kept: list[tuple[int, int, int, int, float]] = []
    for candidate in proposals:
        if any(intersection_over_union(candidate, existing) > 0.42 for existing in kept):
            continue
        _, y, size, _, score = candidate
        contrast = checker_score(integral, candidate[0], y, size)[1]
        clipped = continuation_score(gray, candidate[0], y, size, contrast)
        if clipped > 0.82:
            continue
        candidate = (*candidate[:4], score - 0.28 * clipped)
        if candidate[4] < 0.70:
            continue
        kept.append(candidate)
        if len(kept) == 32:
            break

    return [
        Candidate(
            id=f"page-candidate-{index + 1}",
            x=working_x / width,
            y=working_y / height,
            width=working_width / width,
            height=working_height / height,
            relative_score=score,
        )
        for index, (working_x, working_y, working_width, working_height, score) in enumerate(
            sorted(kept, key=lambda item: (item[1], item[0]))
        )
    ]


def intersection_over_union(a: tuple[int, int, int, int, float], b: tuple[int, int, int, int, float]) -> float:
    ax, ay, aw, ah, _ = a
    bx, by, bw, bh, _ = b
    overlap_width = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    overlap_height = max(0, min(ay + ah, by + bh) - max(ay, by))
    intersection = overlap_width * overlap_height
    union = aw * ah + bw * bh - intersection
    return intersection / union if union else 0.0

