# Detection, crop and engine failure audit

## Board boundary and crop coordinate root cause

The current pipeline rendered a PDF.js viewport to a canvas and posted the canvas bitmap to `/detect`. The API normalized candidate rectangles against that bitmap's dimensions. The reader rendered overlays and manual rectangles in percentages against `.page-stage`, but CSS gave that stage a `min-width: 280px` and `min-height: 220px` independent of the canvas. On a narrow rendered page, the canvas could be smaller than the stage; normalized candidate coordinates then referred to different pixels. Both the API's contour proposal and the browser's pointer mapping consequently could produce a visibly displaced or partial crop.

The detector searched Canny contours, accepted broad aspect ratios, and scored only the number of Sobel peaks. It did not verify eight full ranks/files, regular cell spacing, checkerboard alternation, boundary containment, or border clipping. Contour bounding rectangles can correspond to one internal motif or extend beyond the actual board; the returned value was labeled as a confidence percent despite not being calibrated. Sorting and IoU deduplication could not repair a bad initial box.

## Board transfer root cause

Candidate click set `selectedDiagramId` and updated a toast, but there was no image crop, preview, `Use on Board` confirmation, or recognition interface. The separate global FEN editor could load a position but was not bound to the selected board region. Therefore selecting a diagram was not an end-to-end transfer.

## Stockfish and evaluation root cause

Source inspection found no Stockfish dependency, worker, WASM asset, UCI parser, engine lifecycle code, or evaluation state. The analysis button was permanently disabled and the evaluation bar was two static equal-height divs. There was no working engine to diagnose or repair; the root cause was absence of engine integration.

## Coordinate contract in the repair

Detection and browser crop geometry use normalized `[0,1]` page-image coordinates. The exact source is the current PDF.js canvas bitmap (`canvas.width` × `canvas.height`), not CSS pixels or device-pixel-ratio-scaled layout coordinates. Candidate detection runs on a resized working copy only; returned rectangles are scaled back to the submitted bitmap before normalization. Overlay positions use the displayed canvas element's bounding box and the stage is sized to the canvas aspect ratio. Pointer positions are divided by the canvas's displayed `getBoundingClientRect()` and the crop is extracted from the original canvas dimensions. CSS zoom thus affects display but not crop source geometry.

## Verification limits at audit time

No commercial scanned-book dataset or labels are present in the repository. Existing tests used only synthetic, clean grid images and asserted candidate count/center, not complete boundary IoU or partial-board rejection. A trained piece recognizer is absent. The engine cannot provide image-to-FEN; confirmed board crops will enter an explicit manual FEN confirmation workflow unless a separately verified recognizer is installed.
