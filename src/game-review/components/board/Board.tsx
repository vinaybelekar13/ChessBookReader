import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import useSoundFx from '../../hooks/useSoundFx';
import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useStageStore } from '../../stores/useStageStore';
import Arrows from './Arrows';
import Coors from './Coors';
import EndgameBadges from './EndgameBadges';
import EvalBar from './EvalBar';
import Highlight from './Highlight';
import MoveClassificationBadges from './MoveClassificationBadges';
import Pieces from './Pieces';
import PlayerBadge from './PlayerBadge';



export default function Board() {
  useSoundFx();

  const {
    currentGame,
    isFlipped,
    flipBoard,
  } = useBoardStore(useShallow(state => ({
    currentGame: state.currentGame,
    isFlipped: state.isFlipped,
    flipBoard: state.flipBoard,
  })));

  const isLoaded = useStageStore(state => state.computed.isLoaded);
  const username = useSelectGameStore(state => state.username);
  const { board } = useSettingsStore(state => state.settings);

  useEffect(() => {
    if (isLoaded && username) {
      // if game loaded through a site
      const white = currentGame.header().White;

      if (white && username.toLowerCase() === white.toLowerCase()) {
        flipBoard(false);
      }
      else {
        flipBoard(true);
      }
    }
  }, [isLoaded]);

  return (
    <div className="flex h-fit w-full max-w-[700px] lg:max-w-[min(700px,calc(100vh-150px))] flex-col gap-2" id="Board">
      <PlayerBadge color={isFlipped ? 'w' : 'b'} />
      <div
        className={`
          flex gap-1.5
          xs:gap-3
        `}
        id="Board&Bar"
      >
        <EvalBar />
        <div className="relative aspect-square w-[calc(100%-42px)]" id="actual-board">
          <img
            alt=""
            className="absolute rounded"
            src={`${import.meta.env.BASE_URL}game-review/boards/${board}.png`}
          />
          <Highlight />
          <Coors />
          <Pieces />
          <Arrows />
          <MoveClassificationBadges />
          <EndgameBadges />
        </div>
      </div>
      <PlayerBadge color={isFlipped ? 'b' : 'w'} />
    </div>
  );
}


