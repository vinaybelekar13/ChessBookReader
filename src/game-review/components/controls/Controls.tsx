import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useShallow } from 'zustand/react/shallow';

import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';
import cn from '../../utils/cn';
import Forms from './Forms';
import GameNav from './GameNav';
import Games from './Games';
import Months from './Months';
import Review from './Review';

export default function Controls() {
  const reset = useBoardStore(state => state.reset);

  const {
    stage,
    setStage,
  } = useStageStore(useShallow(state => ({
    stage: state.stage,
    setStage: state.setStage,
  })));

  const {
    site,
    resetSelectGameStore,
  } = useSelectGameStore(useShallow(state => ({
    site: state.site,
    resetSelectGameStore: state.reset,
  })));

  function back() {
    if (stage === 'select-month') {
      resetSelectGameStore();
      setStage('home');
    }

    else if (stage === 'select-game') {
      setStage('select-month');
    }

    else if (stage === 'loaded' || stage === 'reviewing' || stage === 'review-overview') {
      reset();

      if (site) {
        setStage('select-game');
      }
      else {
        resetSelectGameStore();
        setStage('home');
      }
    }
    else if (stage === 'review-moves') {
      setStage('review-overview');
    }
  }

  return (
    <div
      className={`
        flex h-[500px] max-w-[642px] min-w-[310px] grow flex-col gap-4
        backdrop-blur-sm
        xs:h-[660px]
        lg:mb-0 lg:h-auto lg:max-h-[min(696px,calc(100vh-210px))] lg:w-[420px] lg:max-w-[480px]
      `}
      // max-h-[696px] is the height of sibling element <Board />
      id="Controls"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button
          aria-label="Back"
          className={cn('h-10 min-w-[84px] rounded-xl border border-default-200/70 bg-content2 px-3 font-semibold text-foreground shadow-sm transition-all hover:border-default-400 hover:bg-default-300/20 active:scale-95', stage === 'home' && 'invisible')}
          
          onPress={back}
          radius="sm"
          size="sm"
          variant="light"
        >
          <Icon className="h-5 w-5" icon="material-symbols:arrow-left-rounded" /><span>Back</span>
        </Button>
        <p
          id="controls-title"
          className={cn(
            'flex w-full items-center justify-center text-xl font-extrabold tracking-wide text-foreground',
            stage === 'home' && 'text-2xl',
          )}
        >
          {stage === 'home'
            ? (
                <>
                  <img alt="" className="mr-1 size-5" src={`${import.meta.env.BASE_URL}game-review/star.svg`} />
                  <span>Game Review</span>
                </>
              )
            : stage === 'select-month' ? 'Select Month' : stage === 'select-game' ? 'Select Game' : 'Review'}
        </p>
      </div>
      <div className={`
        mb-32 grow overflow-y-auto
        xs:mb-16 xs:px-4
        lg:mb-0
      `}
      >
        {stage === 'home'
          ? <Forms />
          : stage === 'select-month'
            ? <Months />
            : stage === 'select-game'
              ? <Games />
              : <Review />}
      </div>
      <GameNav />
    </div>
  );
}




