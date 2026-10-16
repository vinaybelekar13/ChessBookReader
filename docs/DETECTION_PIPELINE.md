# Detection, crop geometry, and position transfer

## Data and coordinate contract

PDF.js renders each page to a canvas. The browser sends that raster to the optional FastAPI `/detect` endpoint. Candidate and manual crop rectangles use normalized `[0,1]` coordinates relative to that canvas image, not CSS pixels, the surrounding page stage, or device pixels. Candidate overlays are projected onto the displayed canvas; pointer coordinates are normalized against the canvas element's displayed `getBoundingClientRect()`. Crops are extracted from the original canvas `width` and `height`. Uniform detector downscaling preserves these normalized coordinates.

This resolves the previous mismatch where an overlay/crop could be measured against the page stage while candidate coordinates referred to the canvas bitmap. CSS sizing and zoom now affect only display geometry, not the crop's source pixels.

## Candidate pipeline

The service accepts PNG/JPEG images up to 12 MiB and bounds processing to a maximum side of 1800 pixels and 30 megapixels. Candidate proposals combine a multiscale square-window scan over grayscale cell samples with edge-contour boundary proposals. The score checks alternating texture over all 64 cells, geometry, repeated grid evidence, continuation of the checker pattern beyond a proposed edge, and visible boundary cues. Refinement and intersection-over-union suppression reduce loose/duplicate boxes. The response's `relative_score` is a ranking heuristic, not a calibrated probability or confidence percentage.

The partial-board negative case is explicitly tested; proposals that only cover four files do not pass the full 8×8 texture test. Missing outer borders are not by themselves disqualifying. Candidates are still heuristic: boards with pieces that obscure most square texture, perspective-distorted photos, faint scans, unusual colors, and tables or diagrams can cause misses or false positives. The detector does not recognize pieces, orientation, arrows, annotations, or FEN.

## Manual adjustment and board transfer

The reader supports drawing a crop, moving it, resizing from the edge/corner handles, resetting/canceling, and inspecting the resulting canvas crop preview. Crop state is stored in normalized source-image coordinates. Selecting an automatic or manual candidate does not alter the chessboard. **Use on Board** opens a confirmation step with the selected crop and a FEN field. `chess.js` validates the FEN; only explicit confirmation of a valid FEN updates the interactive board. Invalid or absent FEN does not silently fall back to the starting position. Automatic image-to-FEN recognition is not implemented.

## Reproducible synthetic benchmark

Run from `backend`:

```powershell
py tests\benchmark_detection.py
```

The benchmark creates seven synthetic raster pages with six ground-truth boards: clean digital, board embedded among text lines, two boards on one page, borderless edge-touching low-contrast board, small blurred low-resolution board, Sudoku-like negative, and a partial four-file negative. Matching is one-to-one at IoU >= 0.5.

Latest local run:

| Metric | Result |
|---|---:|
| Synthetic pages / ground-truth boards | 7 / 6 |
| Recall | 1.0000 |
| Precision | 1.0000 |
| Mean IoU of matched boxes | 0.9075 |
| False positives per page | 0.0000 |
| Partial-board errors | 0 |
| Mean / max detection latency | 1403.1 ms / 2715.5 ms |

These are results on generated images only, not real scanned/book PDFs, and the small synthetic sample cannot establish production accuracy. They measure geometric board localization only, not piece recognition or FEN accuracy. Detection latency is relatively high at larger raster sizes.

## Remaining validation

Build a legally sourced and labeled real-book benchmark that covers scan quality, varied board art, perspective, edge crops, and non-chess grids. Measure on a held-out set before tuning or claiming real-world accuracy. Piece recognition and perspective rectification require separate implementations and separate ground-truth evaluation.
