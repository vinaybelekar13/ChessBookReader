with open('src/App.tsx', 'rb') as f:
    data = f.read()

# 1. Replace the header opening and remove game-review-shell and conditional
old_header = b'''    <main className={`app-shell ${studyMode ? "study-focus-mode" : ""} ${workspaceMode === "game-review" ? "game-review-shell" : ""}`}>
      {workspaceMode !== "game-review" && (
      <header className="topbar">'''

new_header = b'''    <main className={`app-shell ${studyMode ? "study-focus-mode" : ""}`}>
      <header className="topbar">'''

# Handle CRLF if present
if old_header not in data:
    old_header = old_header.replace(b'\n', b'\r\n')
    new_header = new_header.replace(b'\n', b'\r\n')

assert old_header in data, "old_header not found"
data = data.replace(old_header, new_header, 1)

# 2. Update current-book in topbar
old_book = b'''        <div className="current-book" title={book?.title ?? "No book open"}>
          <span className="book-dot" />
          <strong>{book?.title ?? "No book open"}</strong>
          {book && <span className="muted">{session?.page ?? 1} / {session?.pageCount || "&#8211;"}</span>}
        </div>'''

new_book = b'''        <div className="current-book" title={workspaceMode === "game-review" ? "Game Review" : (book?.title ?? "No book open")}>
          <span className="book-dot" />
          <strong>{workspaceMode === "game-review" ? "Game Review" : (book?.title ?? "No book open")}</strong>
          {workspaceMode === "game-review" ? (
            <span className="muted">Game Analysis & Review</span>
          ) : book ? (
            <span className="muted">{session?.page ?? 1} / {session?.pageCount || "&#8211;"}</span>
          ) : null}
        </div>'''

if old_book not in data:
    old_book = old_book.replace(b'\n', b'\r\n')
    new_book = new_book.replace(b'\n', b'\r\n')

assert old_book in data, "old_book not found"
data = data.replace(old_book, new_book, 1)

# 3. Remove conditional close after header and restore libraryOpen check
old_sidebar = b'''      </header>
      )}

      <div className={`workspace ${libraryOpen ? "" : "library-collapsed"} ${workspaceMode === "opening-explorer" ? "opening-explorer-active" : ""} ${workspaceMode === "analysis" ? "analysis-board-active" : ""} ${workspaceMode === "coordinate-training" ? "coordinate-training-active" : ""} ${workspaceMode === "game-review" ? "game-review-active" : ""}`}>
        {libraryOpen && workspaceMode !== "game-review" && ('''

new_sidebar = b'''      </header>

      <div className={`workspace ${libraryOpen ? "" : "library-collapsed"} ${workspaceMode === "opening-explorer" ? "opening-explorer-active" : ""} ${workspaceMode === "analysis" ? "analysis-board-active" : ""} ${workspaceMode === "coordinate-training" ? "coordinate-training-active" : ""} ${workspaceMode === "game-review" ? "game-review-active" : ""}`}>
        {libraryOpen && ('''

if old_sidebar not in data:
    old_sidebar = old_sidebar.replace(b'\n', b'\r\n')
    new_sidebar = new_sidebar.replace(b'\n', b'\r\n')

assert old_sidebar in data, "old_sidebar not found"
data = data.replace(old_sidebar, new_sidebar, 1)

# 4. Clean up active={(workspaceMode as string) === "game-review"} to active={workspaceMode === "game-review"}
old_active = b'active={(workspaceMode as string) === "game-review"}'
new_active = b'active={workspaceMode === "game-review"}'
data = data.replace(old_active, new_active, 1)

with open('src/App.tsx', 'wb') as f:
    f.write(data)

print('Successfully updated App.tsx!')
