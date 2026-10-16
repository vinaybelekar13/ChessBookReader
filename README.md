# ChessBook Reader

A local-first chess-book reading and analysis workspace. It supports durable PDF books, per-book reading/board sessions, PDF page rendering and navigation, legal chess moves, FEN/PGN export, automatic board-region candidates, manual crop adjustment, confirmed position transfer, and browser-based Stockfish analysis.

## Requirements

- Node.js 22.19+ recommended (Node 20+ may work with compatible dependencies).
- npm 10+.
- Optional Python 3.10+ for the board-candidate detection API.

## Run locally

```powershell
cd D:\chess\BookChess\ChessBookReader
npm install
npm run dev
```

Open the local URL printed by Vite. Add PDF books with **Add Book**. Files and session data are stored in this browser's IndexedDB; clearing site data removes those local copies.

Optional detector service:

```powershell
cd D:\chess\BookChess\ChessBookReader\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The frontend defaults to `http://127.0.0.1:8000`; set `VITE_API_BASE_URL` in `.env.local` only if the service uses another address. **Detect boards** sends the rendered current page image for multi-candidate detection. Results are heuristic candidate regions, not calibrated confidence or guaranteed chessboards. You can select a candidate or draw/adjust a crop, inspect its preview, then use **Use on Board** to open the crop's confirmation workflow. Automatic piece recognition is not implemented: a verified FEN must be entered and confirmed before the interactive board changes. If the detector service is unavailable, manual crop selection remains available.

Stockfish 19 Lite single-threaded WebAssembly assets are bundled under `public/stockfish` and licensed under GPL-3.0 (license included). Enable **Engine** to analyze the current board. The evaluation is shown from White's perspective; engine load or analysis errors are surfaced in the panel rather than replaced with a made-up score.

## Commands

```powershell
npm test
npm run build
```

## Current limitations

- No remote cloud storage/auth integration is configured; local IndexedDB is not cloud storage.
- Automatic candidate detection is an experimental OpenCV grid/texture heuristic, not a trained chess-diagram detector. Its included benchmark is synthetic only and does not establish accuracy on real books.
- Automatic piece recognition/FEN generation, perspective correction, cloud sync, PDF text search, and thumbnails are not implemented.
- Stockfish is real and bundled, but its browser behavior was smoke-tested locally; deployment-specific worker/WASM hosting and Content Security Policy still need validation.

See [docs/DETECTION_PIPELINE.md](./docs/DETECTION_PIPELINE.md) for the detector, coordinates, benchmark, and known limits, and [docs/FINAL_IMPLEMENTATION_REPORT.md](./docs/FINAL_IMPLEMENTATION_REPORT.md) for verified outcomes.
