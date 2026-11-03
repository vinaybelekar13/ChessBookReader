import React from "react";
import {
  BookOpen,
  Target,
  Settings2,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Menu,
} from "lucide-react";

interface BoardControlsBarProps {
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  practiceMode: boolean;
  onTogglePractice: () => void;
  onSetupPosition: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

export const BoardControlsBar: React.FC<BoardControlsBarProps> = ({
  explorerOpen,
  onToggleExplorer,
  practiceMode,
  onTogglePractice,
  onSetupPosition,
  canGoBack,
  canGoForward,
  onFirst,
  onPrev,
  onNext,
  onLast,
  menuOpen,
  onToggleMenu,
}) => {
  return (
    <div className="li-controls-bar" role="toolbar" aria-label="Analysis board controls">
      <div className="li-controls-left">
        <button
          type="button"
          className={`li-ctrl-btn ${explorerOpen ? "active" : ""}`}
          title="Opening explorer & tablebase (e)"
          aria-label="Opening explorer"
          onClick={onToggleExplorer}
        >
          <BookOpen size={17} />
        </button>
        <button
          type="button"
          className={`li-ctrl-btn ${practiceMode ? "active" : ""}`}
          title="Practice with computer (c)"
          aria-label="Practice with computer"
          onClick={onTogglePractice}
        >
          <Target size={17} />
        </button>
        <button
          type="button"
          className="li-ctrl-btn"
          title="Set up a custom chess position"
          aria-label="Set Up Position"
          onClick={onSetupPosition}
        >
          <Settings2 size={17} />
        </button>
      </div>

      <div className="li-controls-MainNav">
        <button
          type="button"
          className="li-ctrl-btn"
          disabled={!canGoBack}
          title="First move (Home / Up)"
          aria-label="First move"
          onClick={onFirst}
        >
          <SkipBack size={17} />
        </button>
        <button
          type="button"
          className="li-ctrl-btn"
          disabled={!canGoBack}
          title="Previous move (Left arrow)"
          aria-label="Previous move"
          onClick={onPrev}
        >
          <ChevronLeft size={21} />
        </button>
        <button
          type="button"
          className="li-ctrl-btn"
          disabled={!canGoForward}
          title="Next move (Right arrow)"
          aria-label="Next move"
          onClick={onNext}
        >
          <ChevronRight size={21} />
        </button>
        <button
          type="button"
          className="li-ctrl-btn"
          disabled={!canGoForward}
          title="Last move (End / Down)"
          aria-label="Last move"
          onClick={onLast}
        >
          <SkipForward size={17} />
        </button>
      </div>

      <div className="li-controls-right">
        <button
          type="button"
          className={`li-ctrl-btn ${menuOpen ? "active" : ""}`}
          title="Action menu (Flip board, Reset, Copy FEN/PGN)"
          aria-label="Action menu"
          onClick={onToggleMenu}
        >
          <Menu size={18} />
        </button>
      </div>
    </div>
  );
};
