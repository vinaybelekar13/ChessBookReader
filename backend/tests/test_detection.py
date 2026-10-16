import numpy as np
import cv2
import pytest

from app.main import count_repeated_peaks, find_grid_candidates, intersection_over_union


def draw_board(image, x, y, size):
    cell = size // 8
    for row in range(8):
        for col in range(8):
            color = (90, 110, 140) if (row + col) % 2 else (220, 210, 190)
            cv2.rectangle(
                image,
                (x + col * cell, y + row * cell),
                (x + (col + 1) * cell - 1, y + (row + 1) * cell - 1),
                color,
                -1,
            )
    cv2.rectangle(image, (x, y), (x + size, y + size), (20, 20, 20), 2)


def test_count_repeated_peaks_finds_even_grid_lines():
    profile = np.zeros(160, dtype=np.float32)
    for line in range(10, 151, 20):
        profile[line] = 10
    assert count_repeated_peaks(profile) >= 7


def test_iou_is_one_for_matching_boxes():
    box = (10, 20, 80, 80, 0.8)
    assert intersection_over_union(box, box) == 1.0


def test_iou_is_zero_for_separate_boxes():
    assert intersection_over_union((0, 0, 10, 10, 1), (20, 20, 10, 10, 1)) == 0.0


def test_finds_two_separate_chessboard_candidates():
    page = np.full((900, 1200, 3), 245, dtype=np.uint8)
    draw_board(page, 100, 80, 400)
    draw_board(page, 700, 430, 320)

    candidates = find_grid_candidates(page)

    assert len(candidates) == 2
    centers = sorted((candidate.x + candidate.width / 2) for candidate in candidates)
    assert centers[0] == pytest.approx(0.25, abs=0.04)
    assert centers[1] == pytest.approx(0.72, abs=0.04)
    assert len({(round(candidate.x, 2), round(candidate.y, 2)) for candidate in candidates}) == 2
    assert all(candidate.width * page.shape[1] == pytest.approx(candidate.height * page.shape[0], abs=3) for candidate in candidates)
    ground_truth = [(100, 80, 400, 400, 0.0), (700, 430, 320, 320, 0.0)]
    detected = [
        (round(item.x * page.shape[1]), round(item.y * page.shape[0]),
         round(item.width * page.shape[1]), round(item.height * page.shape[0]), item.relative_score)
        for item in candidates
    ]
    assert all(max(intersection_over_union(candidate, truth) for candidate in detected) >= 0.5
               for truth in ground_truth)

def test_returns_all_sixteen_distinct_boards_on_a_page():
    page = np.full((900, 900, 3), 245, dtype=np.uint8)
    for row in range(4):
        for col in range(4):
            draw_board(page, 40 + col * 215, 40 + row * 215, 160)

    candidates = find_grid_candidates(page)

    assert len(candidates) == 16
    for row in range(4):
        for col in range(4):
            truth = (40 + col * 215, 40 + row * 215, 160, 160, 0.0)
            assert max(
                intersection_over_union(
                    (round(item.x * 900), round(item.y * 900), round(item.width * 900), round(item.height * 900), item.relative_score or 0),
                    truth,
                )
                for item in candidates
            ) >= 0.5


def test_finds_borderless_low_contrast_board_at_page_edge():
    page = np.full((640, 800, 3), 245, dtype=np.uint8)
    x, y, size = 0, 0, 256
    cell = size // 8
    for row in range(8):
        for col in range(8):
            value = 173 if (row + col) % 2 else 198
            cv2.rectangle(page, (x + col * cell, y + row * cell),
                          (x + (col + 1) * cell - 1, y + (row + 1) * cell - 1),
                          (value, value, value), -1)
    candidates = find_grid_candidates(page)
    assert candidates
    best = max(candidates, key=lambda item: item.width)
    assert best.x == pytest.approx(0, abs=0.03)
    assert best.y == pytest.approx(0, abs=0.03)
    assert best.width == pytest.approx(size / page.shape[1], abs=0.04)


def test_rejects_a_partial_four_file_grid():
    page = np.full((640, 800, 3), 245, dtype=np.uint8)
    cell = 24
    for row in range(8):
        for col in range(4):
            value = 85 if (row + col) % 2 else 220
            cv2.rectangle(page, (300 + col * cell, 170 + row * cell),
                          (299 + (col + 1) * cell, 169 + (row + 1) * cell),
                          (value, value, value), -1)
    assert find_grid_candidates(page) == []


def test_rejects_sudoku_like_grid_without_chessboard_texture():
    page = np.full((600, 800, 3), 245, dtype=np.uint8)
    x, y, size = 260, 150, 288
    cell = size // 9
    for index in range(10):
        thickness = 3 if index % 3 == 0 else 1
        cv2.line(page, (x + index * cell, y), (x + index * cell, y + size), (50, 50, 50), thickness)
        cv2.line(page, (x, y + index * cell), (x + size, y + index * cell), (50, 50, 50), thickness)
    assert find_grid_candidates(page) == []


def test_returns_no_candidates_for_flat_page():
    page = np.full((600, 800, 3), 245, dtype=np.uint8)
    assert find_grid_candidates(page) == []
