import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { DEFAULT_POSITION } from 'chess.js';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import MoveClassification from '../../icons/move-classifications/MoveClassification';
import { useBoardStore } from '../../stores/useBoardStore';
import { formatCp, useEvalStore } from '../../stores/useEvalStore';
import { chooseTextColor } from '../../utils/chooseColorFromClassification';
import cn from '../../utils/cn';
import lanToSan from '../../utils/lanToSan';
import makePair from '../../utils/makePair';
import EvalGraph from './EvalGraph';

import type { Move } from 'chess.js';

export default function ReviewMoves() {
  const {
    currentGame,
    currentMoveNum,
    isFlipped,
  } = useBoardStore(useShallow(state => ({
    currentGame: state.currentGame,
    currentMoveNum: state.currentMoveNum,
    isFlipped: state.isFlipped,
  })));

  const history = currentGame.history({ verbose: true });
  const fens = [DEFAULT_POSITION, ...history.map(move => move.after)];

  const {
    best3MovesWithClass,
    cps,
    classHistory,
    openingNames,
  } = useEvalStore(useShallow(state => ({
    best3MovesWithClass: state.best3MovesWithClass,
    cps: state.cps,
    classHistory: state.classHistory,
    openingNames: state.openingNames,
  })));

  const historyPairs = makePair(history);
  const currentMove = history[currentMoveNum - 1];
  const classification = classHistory[currentMoveNum - 1];
  const advs = cps.map(formatCp);
  const adv = (advs.length === 0) ? '0.0' : advs[currentMoveNum];

  const whiteHasAdv = useMemo(() => {
    let whiteHasAdv: boolean;

    if (typeof cps[currentMoveNum] === 'number') {
      whiteHasAdv = cps[currentMoveNum] >= 0;
    }
    else {
      whiteHasAdv = cps[currentMoveNum].startsWith('+') || cps[currentMoveNum] === '1-0';
    }

    return whiteHasAdv;
  }, [currentMoveNum]);

  const result = currentGame.header().Result;

  return (
    <div className="grid h-full min-h-0 overflow-hidden grid-rows-[auto_auto_auto_minmax(0,1fr)_88px] gap-3" id="ReviewMoves">
      <div className="flex flex-col gap-1">
        {currentMoveNum > 0 && (
          <p className="flex justify-between gap-3 text-base font-medium">
            <span>
              <MoveClassification
                classification={classification}
                className="mr-1 inline-block"
              />
              <span className="font-bold">
                {currentMove.san}
              </span>
              {' '}
              is
              {' '}
              {classification === 'book'
                ? 'a book move'
                : classification === 'inaccuracy'
                  ? 'an inaccuracy'
                  : ['blunder', 'mistake'].includes(classification)
                      ? `a ${classification}`
                      : classification}
            </span>
            <span
              className={cn(
                'rounded-sm px-2 py-1 text-center font-bold',
                whiteHasAdv ? 'bg-foreground text-background' : 'bg-default-100',
                adv === '1/2-1/2' ? 'w-20' : 'w-14',
              )}
            >
              {(adv.startsWith('-') || adv.startsWith('+')) ? adv.slice(1) : adv}
            </span>
          </p>
        )}
        {best3MovesWithClass[currentMoveNum - 1]
          ?.filter(move => move.pv !== currentMove.lan)
          .map((move, i) => {
            let adv;
            const san = lanToSan(move.pv, currentMoveNum - 1, fens);

            if (san.endsWith('#')) {
              const moveEval = move.eval as string;
              adv = moveEval.startsWith('+') ? '1-0' : '0-1';
            }
            else {
              adv = formatCp(move.eval);
            }

            let whiteHasAdv: boolean;

            if (typeof move.eval === 'number') {
              whiteHasAdv = move.eval >= 0;
            }
            else {
              whiteHasAdv = move.eval.startsWith('+');
            }

            return (
              <div
                className="grid grid-cols-[90px_1fr] items-center justify-items-start gap-4 text-base"
                key={i}
              >
                <p className="font-bold">
                  <MoveClassification
                    classification={move.classification}
                    className="mr-1 inline-block size-5"
                  />
                  {san}
                </p>
                <p
                  className={cn(
                    'w-12 rounded-sm px-2 py-1 text-center font-bold',
                    whiteHasAdv
                      ? 'bg-foreground text-background'
                      : `bg-default-100`,
                  )}
                >
                  {(adv.startsWith('-') || adv.startsWith('+')) ? adv.slice(1) : adv}
                </p>
              </div>
            );
          })}
      </div>
      <p className="text-small text-foreground-500">{openingNames[currentMoveNum]}</p>
      <div className="flex gap-4">
        <a
          className={`
            flex w-fit gap-0 text-tiny text-foreground-500
            hover:underline
          `}
          href={`https://www.chess.com/analysis?fen=${fens[currentMoveNum]}&flip=${isFlipped}`}
          target="_blank"
        >
          <span>chess.com</span>
          <Icon
            className="text-small"
            icon="material-symbols:arrow-outward-rounded"
          />
        </a>
        <a
          className={`
            flex w-fit gap-0 text-tiny text-foreground-500
            hover:underline
          `}
          href={`https://lichess.org/analysis/${fens[currentMoveNum]}`}
          target="_blank"
        >
          <span>lichess</span>
          <Icon
            className="text-small"
            icon="material-symbols:arrow-outward-rounded"
          />
        </a>
      </div>
      <div data-move-list className="min-h-0 h-full overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="flex flex-col">
          {historyPairs.map((pair, i) => (
            <div
              className={cn(
                `
                  grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)] items-center justify-items-start gap-2 px-2 py-1
                `,
                i % 2 === 1 && 'bg-default-100/50',
              )}
              key={i}
            >
              <p className="text-tiny text-foreground-500">
                {i + 1}
                .
              </p>
              <MoveButton move={pair[0]} pairIndex={i} />
              {pair[1] && <MoveButton move={pair[1]} pairIndex={i} />}
            </div>
          ),
          )}
          <p className="p-2 text-tiny font-bold text-foreground-500">{result}</p>
        </div>
      </div>
      <div className="h-[88px] min-h-[88px] w-full shrink-0 overflow-hidden"><EvalGraph /></div>
    </div>
  );
}

function MoveButton({ pairIndex, move }: { pairIndex: number; move: Move }) {
  const ref = useRef<HTMLButtonElement>(null);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const toMove = useBoardStore(state => state.toMove);
  const classHistory = useEvalStore(state => state.classHistory);
  let realIndex = pairIndex * 2 + 1;

  if (move.color === 'b') {
    realIndex += 1;
  }

  const classification = classHistory[realIndex - 1];

  useEffect(() => {
    if (currentMoveNum !== realIndex || window.innerWidth < 1024) return;

    const moveElement = ref.current;
    const moveList = moveElement?.closest('[data-move-list]') as HTMLElement | null;

    if (!moveElement || !moveList) return;

    const moveRect = moveElement.getBoundingClientRect();
    const listRect = moveList.getBoundingClientRect();

    if (moveRect.top < listRect.top) {
      moveList.scrollBy({ top: moveRect.top - listRect.top - 8, behavior: 'smooth' });
    } else if (moveRect.bottom > listRect.bottom) {
      moveList.scrollBy({ top: moveRect.bottom - listRect.bottom + 8, behavior: 'smooth' });
    }
  }, [currentMoveNum, realIndex]);

  return (
    <div className="relative">
      {['inaccuracy', 'mistake', 'blunder'].includes(classification) && (
        <MoveClassification
          classification={classification}
          className="absolute top-1.5 -left-5 size-5 cursor-pointer"
          onClick={() => toMove(realIndex)}
        />
      )}
      <Button
        className={cn(
          'min-w-0 justify-start !rounded-none !border-0 !bg-transparent px-1 py-1 text-base font-semibold !shadow-none hover:!bg-transparent data-[hover=true]:!bg-transparent',
          currentMoveNum === realIndex && '!bg-default-200/30 rounded-sm underline decoration-2 underline-offset-4',

        )}
        disableAnimation
        onPress={() => toMove(realIndex)}
        radius="sm"
        ref={ref}
        size="sm"
        variant="light"
      >
        <span className={cn('font-semibold', chooseTextColor(classification))}>
          {move.san}
        </span>
      </Button>
    </div>
  );
}





