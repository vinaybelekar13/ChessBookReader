# Architecture

## Current application

- React + TypeScript + Vite user interface.
- `pdfjs-dist` renders only the active page to a canvas.
- `chess.js` enforces legal moves and provides FEN/SAN/PGN.
- IndexedDB (`books` and `sessions` stores) holds PDF blobs, metadata and independent per-book reading/analysis snapshots. `activeBookId` is a separate global key.
- Optional FastAPI/OpenCV service handles rendered-page board-candidate detection. The service does not recognize chess pieces.

Initialization awaits IndexedDB before rendering the persisted book or board state. The state model stores original diagram FEN separately from current FEN and stores the SAN move sequence, selected diagram ID, page, and orientation. Opening a selected diagram starts a new position context for that diagram; refresh does not. Reset is an explicit action and persists the original diagram FEN as the current board state.

## Current and planned boundaries

The current browser build does not contain Stockfish, user authentication, cloud synchronization, piece classification, OCR, or a database service. `.env.example` intentionally contains no privileged credentials. Cloud storage is not treated as enabled by local IndexedDB.

Production cloud storage should use a backend-authenticated identity (or equivalent authorization), private object storage, per-user database policies, and ownership-checked APIs. A service-role key must never be sent to the browser. No cloud implementation is claimed until this is implemented and upload/retrieval plus isolation are tested.

## PDF and CV

PDF page coordinates and rendered canvas coordinates are mapped by the same PDF.js viewport dimensions. Detection receives the displayed page image and returns normalized page-space rectangles; overlays are positioned against the page container, so scaling is shared. Detection is opt-in via a button, cached by book/page in the session. Current page is prioritized; no full-document scan runs.

The optional detector uses grayscale/thresholding, contour geometry, and a grid-like line test in OpenCV. It ranks square-ish candidates and performs non-maximum suppression. It is a heuristic and requires evaluation on a labeled book-page dataset. It is not a trained model and may miss skewed/small boards or confuse grids.
