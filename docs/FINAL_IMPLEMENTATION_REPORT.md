# ChessBook Reader repair report

## Outcome

The existing React/TypeScript application was repaired in place. The current workflow supports PDF page rendering, heuristic board candidate overlays, manual crop creation and adjustment, exact crop preview, explicit FEN confirmation before changing the interactive board, and genuine local Stockfish analysis. It does not infer piece placement from the image.

## Root causes and changes

### Detection and partial crops

Before the fix, candidate geometry was normalized against the PDF.js canvas bitmap while browser overlay and pointer geometry used the page stage, whose minimum dimensions could differ from the displayed canvas. That mismatch shifted visible overlays and crop coordinates. The detector also accepted square-ish contours using line/edge peaks without checking that the region contained a complete 8×8 board.

The coordinate contract is now normalized to the source PDF.js canvas throughout: overlays map to its displayed bounds, pointer events normalize against its `getBoundingClientRect()`, and extraction uses intrinsic canvas dimensions. The detector now combines multiscale square-window texture scoring over all 64 cells with edge-contour proposals, boundary refinement, continuation penalties, and IoU deduplication. The API response calls its uncalibrated ranking value `relative_score`, not confidence.

### Crop correction and transfer

The editor tracks source-image normalized geometry, supports drawing/moving/resizing/reset/cancel, and previews the exact canvas crop. Selecting a candidate does not alter the board. **Use on Board** opens a confirmation flow and requires a valid user-provided FEN; only explicit confirmation updates the board. Invalid FEN is rejected. There is no automatic image-to-FEN recognition, so no position is fabricated.

### Stockfish and evaluation

The original application had no Stockfish worker, WASM engine, UCI parser, or live evaluation bar. It now bundles the official Stockfish 19 Lite single-threaded JS/WASM engine and its GPL-3.0 license. UCI readiness, bounded analysis, current-FEN replacement, stale-result suppression, best-move parsing, loading/error states, and White-perspective score conversion are handled by the engine integration. The evaluation bar maps genuine centipawn/mate output and is independent of board flipping.

### UI

The interface now uses muted green-gray/ivory design tokens, readable control sizing, consistent buttons and focus/disabled states, a classic licensed SVG Staunton set, crop controls/preview, and a distinct engine/evaluation panel. Responsive browser checks found no document horizontal overflow at desktop, tablet, or phone viewport widths.

## Detection benchmark

The reproducible benchmark (`py tests\benchmark_detection.py` from `backend`) uses seven generated synthetic raster pages and six annotated board boxes. A match is counted at IoU >= 0.5.

| Metric | Result |
|---|---:|
| Pages / ground-truth boards | 7 / 6 |
| Recall / precision | 1.0000 / 1.0000 |
| Mean matched IoU | 0.9075 |
| False positives per page | 0.0000 |
| Partial-board errors | 0 |
| Mean / maximum latency | 1403.1 ms / 2715.5 ms |

These results are synthetic-only and are not evidence of real scanned-book accuracy. The benchmark has no real PDFs, photographed pages, perspective correction, or piece-recognition labels. Performance is also slow on larger synthetic pages.

## Verification

- `npm test` — passed: 4 test files, 11 tests.
- `npm run build` — passed: TypeScript build and Vite production bundle. Vite reports a bundle-size advisory for the PDF worker and application JS; build succeeds.
- `py -m pytest` from `backend` — passed: 8 tests.
- `py tests\benchmark_detection.py` from `backend` — completed with the synthetic results above.
- Browser workflow — verified using an isolated local-origin synthetic one-page PDF: manual crop draw/resize and preview; selection left the board unchanged until confirmed FEN; confirmed FEN changed the board; Stockfish loaded and returned a real best move and score.
- Engine perspective — verified in browser: a White-favorable mate score was `#+9`; flipping the board left it unchanged; a Black-favorable position returned `#-10`; a Black-to-move mate position returned `#-1`. The starting position produced a near-equal evaluation. These are live engine outputs, not hardcoded values.
- Position persistence/error handling — after browser refresh, the tested FEN was restored from the local book session; analysis could be triggered again. Loading an invalid FEN displayed an error and left the current board position unchanged.
- Responsive smoke — document width matched the viewport at desktop, tablet, and phone sizes; no horizontal overflow was observed.

## Status and limitations

**Verified**
- Source-image crop coordinate mapping and manual crop interaction in the browser.
- Explicit FEN validation/confirmation before board changes.
- Invalid FEN feedback and current-position persistence across a browser refresh for the tested local book.
- Real bundled Stockfish UCI startup and browser analysis.
- White-perspective score sign, mate display, and board-flip invariance.
- Frontend/backend tests, production build, synthetic benchmark, and no-horizontal-overflow viewport checks.

**Partially verified**
- Automatic candidate accuracy: only generated synthetic fixtures were measured; no representative book/scan set has been tested.
- Worker/WASM hosting: locally verified in Vite, not validated on every production host or Content Security Policy.
- Multi-book isolation across multiple real books: existing unit tests cover storage behavior, but this repair's browser smoke did not exercise a full two-book workflow.

**Not implemented**
- Automatic chess-piece recognition and image-to-FEN.
- Perspective rectification for photographed pages.
- Cloud storage/authentication/synchronization.
- Real-world labeled detection benchmark, text search, and PDF thumbnails.

Synthetic boards, faint scans, small images, and perspective-distorted diagrams remain risky. Detection candidates should be inspected and corrected by the user; positions should be entered or verified manually.
