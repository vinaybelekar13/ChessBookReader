with open('src/styles.css', 'rb') as f:
    data = f.read()

marker = b'/* ==========================================================\n   GAME REVIEW WORKSPACE INTEGRATION'
if marker not in data:
    marker = marker.replace(b'\n', b'\r\n')

idx = data.find(marker)
assert idx != -1, "marker not found in styles.css"

new_section = b'''/* ==========================================================
   GAME REVIEW WORKSPACE INTEGRATION
   ========================================================== */

.workspace.game-review-active {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workspace.game-review-active:not(.library-collapsed) {
  grid-template-columns: 220px minmax(0, 1fr) !important;
}

.workspace.game-review-active.library-collapsed {
  grid-template-columns: minmax(0, 1fr) !important;
}

.workspace.game-review-active > .game-review-workspace {
  grid-column: 2 / -1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.workspace.game-review-active.library-collapsed > .game-review-workspace {
  grid-column: 1 / -1;
}

@media (max-width: 820px) {
  .workspace.game-review-active {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .workspace.game-review-active > .game-review-workspace {
    grid-column: 1 / -1;
  }
}

/* Game Review Navigation & Breadcrumb Header */
.game-review-nav-bar {
  flex: none;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--panel, #202423);
  border-bottom: 1px solid var(--border-subtle, #2d3532);
  z-index: 10;
}

.game-review-nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.game-review-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #edf2ed);
  background: var(--panel-elevated, #262c2a);
  border: 1px solid var(--border-subtle, #2d3532);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.14s ease;
}

.game-review-back-btn:hover {
  background: var(--panel-hover, #2e3532);
  border-color: #81B64C;
  color: #ffffff;
}

.game-review-nav-divider {
  width: 1px;
  height: 18px;
  background: var(--border-subtle, #2d3532);
}

.game-review-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.game-review-breadcrumb-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #a3b0a9);
  cursor: pointer;
  transition: color 0.14s ease;
}

.game-review-breadcrumb-link:hover {
  color: var(--text-primary, #edf2ed);
  text-decoration: underline;
}

.game-review-breadcrumb-sep {
  color: var(--text-muted, #738079);
}

.game-review-breadcrumb-current {
  font-weight: 600;
  color: #81B64C;
}

.game-review-nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.game-review-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #a3b0a9);
  background: var(--panel-elevated, #262c2a);
  border: 1px solid var(--border-subtle, #2d3532);
  border-radius: 12px;
}

.game-review-stage-container {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
}
'''

data = data[:idx] + new_section

with open('src/styles.css', 'wb') as f:
    f.write(data)

print('Successfully updated styles.css!')
