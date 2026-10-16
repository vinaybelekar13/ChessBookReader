import numpy as np
import pytest

from app.recognition import Detection, _decode_rows, _normalize_model_rows, assemble_position


def box_for_square(row, col, piece_class, confidence=0.9):
    x1, y1 = col * 80 + 20, row * 80 + 20
    return Detection(piece_class, confidence, (x1, y1, x1 + 40, y1 + 40))


def starting_position_detections(flipped=False):
    detections = [Detection(0, 0.99, (0, 0, 640, 640))]
    back_rank = [2, 4, 3, 6, 5, 3, 4, 2]
    for col, piece_class in enumerate(back_rank):
        visual_col = 7 - col if flipped else col
        home_row = 7 if flipped else 0
        pawn_row = 6 if flipped else 1
        detections.extend(
            [
                box_for_square(home_row, visual_col, piece_class),
                box_for_square(pawn_row, visual_col, 1),
            ]
        )
    for col, piece_class in enumerate([8, 10, 9, 12, 11, 9, 10, 8]):
        visual_col = 7 - col if flipped else col
        home_row = 0 if flipped else 7
        pawn_row = 1 if flipped else 6
        detections.extend(
            [
                box_for_square(home_row, visual_col, piece_class),
                box_for_square(pawn_row, visual_col, 7),
            ]
        )
    if flipped:
        detections.append(Detection(13, 0.88, (10, 10, 30, 30)))
    return detections


def test_recognizes_piece_placement_and_exposes_static_fen_assumptions():
    result = assemble_position(starting_position_detections(), 640, 640)

    assert result["placement"] == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
    assert result["fen"] == f'{result["placement"]} w - - 0 1'
    assert result["piece_count"] == 32
    assert result["orientation"] == "unknown"
    assert result["turn_inferred"] is False
    assert any("Castling rights" in warning for warning in result["warnings"])


def test_rank_one_marker_corrects_flipped_board_orientation():
    result = assemble_position(starting_position_detections(flipped=True), 640, 640)

    assert result["placement"] == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
    assert result["orientation"] == "flipped"


def test_rejects_crops_without_a_model_localized_board():
    with pytest.raises(ValueError, match="did not localize"):
        assemble_position([box_for_square(2, 2, 7)], 640, 640)


def test_decode_rows_unpads_boxes_and_discards_low_confidence():
    rows = [
        [180, 84, 260, 164, 0.9, 7],
        [0, 0, 1, 1, 0.1, 1],
    ]

    detections = _decode_rows(rows, 320, 640, 1.0, 160.0, 0.0)

    assert len(detections) == 1
    assert detections[0].box == (20.0, 84.0, 100.0, 164.0)


def test_decode_rows_accepts_python_lists_as_well_as_numpy_arrays():
    detections = _decode_rows([[180, 84, 260, 164, 0.9, 7]], 320, 640, 1.0, 160.0, 0.0)
    assert len(detections) == 1
    assert detections[0].class_id == 7
    assert detections[0].box == (20.0, 84.0, 100.0, 164.0)


def test_normalizes_batched_and_unbatched_model_outputs():
    rows = np.zeros((12, 6), dtype=np.float32)
    assert _normalize_model_rows(rows).shape == (12, 6)
    assert _normalize_model_rows(rows[None, :, :]).shape == (12, 6)


def test_rejects_unknown_model_output_layout_instead_of_misdecoding():
    with pytest.raises(ValueError, match="Unsupported OCR model output shape"):
        _normalize_model_rows(np.zeros((1, 84, 8400), dtype=np.float32))


def test_warns_when_board_is_detected_but_no_pieces_are_recognized():
    result = assemble_position([Detection(0, 0.99, (0, 0, 640, 640))], 640, 640)
    assert result["piece_count"] == 0
    assert any("No chess pieces were recognized" in warning for warning in result["warnings"])


def test_keeps_highest_confidence_piece_when_two_detections_share_square():
    detections = [
        Detection(0, 0.99, (0, 0, 640, 640)),
        box_for_square(3, 3, 7, 0.7),
        box_for_square(3, 3, 11, 0.95),
    ]
    result = assemble_position(detections, 640, 640)
    assert result["piece_count"] == 1
    assert result["collision_count"] == 1
    assert result["placement"].split("/")[3] == "3K4"
    assert any("overlapping piece detections" in warning for warning in result["warnings"])
