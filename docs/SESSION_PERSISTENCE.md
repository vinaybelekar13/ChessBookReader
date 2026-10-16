# Local session persistence

## Record layout

IndexedDB database `chessbook-reader`, version 1:

- `books`: one entry per imported PDF, including its Blob, stable ID, title, byte count and actual last-opened time.
- `sessions`: one entry per book, containing page, PDF zoom, selected diagram ID, original diagram FEN, current board FEN, SAN move sequence, orientation, coordinates visibility and cached detected candidates.
- `settings`: global `activeBookId`.

The active ID is global; all reading and chess state is book-specific. Recent books are ordered by `lastOpenedAt` and this timestamp is updated when the user explicitly opens/resumes a book, not on a component render. Every React session update immediately starts an IndexedDB write; callers wait for transaction completion rather than only the individual request event.

## Restoration and reset

The app waits for IndexedDB initialization before constructing visible book/board state. It restores the saved active book and that book's session. SAN moves are replayed from the stored line-base FEN to reconstruct move navigation; the exact current FEN is stored independently. If a PDF blob is unavailable, the saved record remains and a recovery message is shown.

Selecting a new diagram creates a new analysis context and records that diagram's original FEN. Refresh, page navigation, and panel changes only persist and restore; they do not invoke reset. **Reset Board** is the only control that changes current FEN back to the selected diagram's original FEN and clears the current line. It does not modify the book record or bookmarks.

This implementation is local to one browser profile. Cloud synchronization and conflict resolution are not implemented. IndexedDB eviction, profile changes or browser site-data deletion can make locally stored PDFs unavailable.
