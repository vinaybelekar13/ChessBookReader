import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMediaQuery } from 'react-responsive';
import { useShallow } from 'zustand/react/shallow';

import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';
import Settings from './Settings';

export default function GameNav() {
  const {
    currentGame,
    currentMoveNum,
    isFlipped,
    flipBoard,
    toFirstMove,
    toPrevMove,
    toNextMove,
    toFinalMove,
    reset,
  } = useBoardStore(
    useShallow(state => ({
      currentGame: state.currentGame,
      currentMoveNum: state.currentMoveNum,
      isFlipped: state.isFlipped,
      flipBoard: state.flipBoard,
      toFirstMove: state.toFirstMove,
      toPrevMove: state.toPrevMove,
      toNextMove: state.toNextMove,
      toFinalMove: state.toFinalMove,
      reset: state.reset,
    })),
  );

  const resetSelectGameStore = useSelectGameStore(state => state.reset);
  const stage = useStageStore(state => state.stage);
  const setStage = useStageStore(state => state.setStage);

  const reviewFinished = useStageStore(
    state => state.computed.reviewFinished,
  );

  const history = currentGame.history({ verbose: true });

  const isLg = useMediaQuery({
    query: '(min-width: 1024px)',
  });

  useHotkeys('right', () => {
    if (
      history.length === 0
      || currentMoveNum === history.length
      || !reviewFinished
    ) {
      return;
    }

    toNextMove();

    if (stage === 'review-overview' && currentMoveNum === 0) {
      setStage('review-moves');
    }
  });

  useHotkeys('left', () => {
    if (history.length === 0 || currentMoveNum === 0 || !reviewFinished)
      return;
    toPrevMove();
  });

  useHotkeys('up', () => {
    if (history.length === 0 || currentMoveNum === 0 || !reviewFinished)
      return;
    toFirstMove();
  });

  useHotkeys('down', () => {
    if (
      history.length === 0
      || currentMoveNum === history.length
      || !reviewFinished
    ) {
      return;
    }

    toFinalMove();

    if (stage === 'review-overview' && currentMoveNum === 0) {
      setStage('review-moves');
    }
  });

  useHotkeys('x', () => flipBoard());

  return (
    <div
      className={`
        fixed bottom-3 left-1/2 z-10 mt-auto flex w-11/12 max-w-[642px]
        -translate-x-2/4 flex-col flex-wrap justify-between gap-2 rounded-xl
        bg-default-50/90 p-3 ring-1 ring-foreground-300 backdrop-blur-sm
        xs:w-10/12 xs:flex-row
        lg:static lg:w-full lg:max-w-none lg:translate-x-0 lg:flex-col lg:gap-2 lg:bg-inherit lg:p-0
        lg:ring-0
      `}
      id="GameNav"
    >
      <div className="grid w-full grid-cols-4 gap-2">
        <Button
          aria-label="First move"
          className="h-12 w-full min-w-0 rounded-lg border border-default-200/60 bg-content2 text-default-500 shadow-none transition-colors hover:bg-default-300/20"
          isDisabled={
            history.length === 0 || currentMoveNum === 0 || !reviewFinished
          }
          isIconOnly
          onPress={toFirstMove}
          radius="sm"
          size={isLg ? 'md' : 'sm'}
        >
          <Icon icon="material-symbols:first-page-rounded" className="h-9 w-9 shrink-0" />
        </Button>
        <Button
          aria-label="Previous move"
          className="h-12 w-full min-w-0 rounded-lg border border-default-200/60 bg-content2 text-default-500 shadow-none transition-colors hover:bg-default-300/20"
          isDisabled={
            history.length === 0 || currentMoveNum === 0 || !reviewFinished
          }
          isIconOnly
          onPress={toPrevMove}
          radius="sm"
          size={isLg ? 'md' : 'sm'}
        >
          <Icon icon="material-symbols:chevron-left-rounded" className="h-9 w-9 shrink-0" />
        </Button>
        <Button
          aria-label="Next move"
          className="h-12 w-full min-w-0 rounded-lg border border-default-200/60 bg-content2 text-default-500 shadow-none transition-colors hover:bg-default-300/20"
          isDisabled={
            history.length === 0
            || currentMoveNum === history.length
            || !reviewFinished
          }
          isIconOnly
          onPress={() => {
            toNextMove();

            if (stage === 'review-overview' && currentMoveNum === 0) {
              setStage('review-moves');
            }
          }}
          radius="sm"
          size={isLg ? 'md' : 'sm'}
        >
          <Icon icon="material-symbols:chevron-right-rounded" className="h-9 w-9 shrink-0" />
        </Button>
        <Button
          aria-label="Final move"
          className="h-12 w-full min-w-0 rounded-lg border border-default-200/60 bg-content2 text-default-500 shadow-none transition-colors hover:bg-default-300/20"
          isDisabled={
            history.length === 0
            || currentMoveNum === history.length
            || !reviewFinished
          }
          isIconOnly
          onPress={() => {
            toFinalMove();

            if (stage === 'review-overview' && currentMoveNum === 0) {
              setStage('review-moves');
            }
          }}
          radius="sm"
          size={isLg ? 'md' : 'sm'}
        >
          <Icon icon="material-symbols:last-page-rounded" className="h-9 w-9 shrink-0" />
        </Button>
      </div>
      <div className="flex w-full items-center justify-between gap-3 pt-1" id="minor-buttons">
  <div className="flex items-center gap-2">
    <Button
      aria-label="Flip board"
      className="h-11 w-11 min-w-11 rounded-xl border border-default-200/70 bg-content2 text-default-500 shadow-sm transition-all hover:border-default-400 hover:bg-default-300/20"
      isIconOnly
      onPress={() => flipBoard()}
      radius="lg"
      size="md"
      variant="flat"
    >
      <Icon
        className="h-6 w-6 transition-transform"
        icon="material-symbols:sync"
        style={{
          transform: `rotate(${isFlipped ? '180deg' : '0'})`,
        }}
      />
    </Button>
    <Button
      className="h-11 min-w-[88px] rounded-xl border border-default-200/70 bg-content2 px-5 font-semibold text-foreground shadow-sm transition-all hover:border-default-400 hover:bg-default-300/20"
      onPress={() => {
        reset();
        resetSelectGameStore();
        setStage('home');
      }}
      size="md"
      variant="flat"
    >
      Reset
    </Button>
  </div>
  <Settings />
</div>
    </div>
  );
}





