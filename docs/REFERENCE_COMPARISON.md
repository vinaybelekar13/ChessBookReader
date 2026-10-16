# Public reference comparison

The Chessify scanner's rendered user workflow could not be observed in this environment. Its public HTML verifies only a client-rendered React shell and chess-related vendor assets. The interaction rows below are therefore marked unknown rather than attributed to Chessify.

| Capability | Chessify public evidence | ChessBook Reader implementation status |
|---|---|---|
| PDF loading | UNKNOWN: SPA did not render | Implemented locally through PDF.js and IndexedDB |
| Page rendering/navigation | UNKNOWN | Implemented: incremental current-page canvas, previous/next/page field and zoom |
| Multiple board detection | UNKNOWN | Partial: optional OpenCV grid-candidate heuristic; experimental, API required |
| Selectable diagram regions | UNKNOWN | Implemented: manual drag selection; detected candidate overlays when API is available |
| Position recognition/FEN | UNKNOWN | Not implemented automatically; manual FEN entry |
| Chess analysis engine | UNKNOWN | Not implemented |
| Progress/session persistence | UNKNOWN | Implemented locally per book, including page, diagram selection, FEN, move line and orientation |
| Remote storage | UNKNOWN | Not implemented; no cloud success is claimed |

The design is an independent dark, compact chess workstation. No reference branding, proprietary assets, source, or private endpoint is used.
