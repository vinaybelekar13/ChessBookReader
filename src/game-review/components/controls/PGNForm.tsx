import { Button, Card, CardBody, CardFooter, Textarea } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';

import type { SubmitHandler } from 'react-hook-form';

interface Inputs {
  pgn: string;
}

export default function PGNForm() {
  const loadGame = useBoardStore(state => state.loadGame);
  const submitGame = useSelectGameStore(state => state.submitGame);
  const setStage = useStageStore(state => state.setStage);

  const { handleSubmit, control, setError, formState } = useForm<Inputs>({
    defaultValues: {
      pgn: '',
    },
    mode: 'onChange',
  });

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    try {
      loadGame(data.pgn);
      submitGame();
      setStage('loaded');
    }
    catch (error) {
      const err = error as Error;

      setError('pgn', {
        type: 'pgn-parsing',
        message: err.message,
      });
    }
  };

  return (
    <Card
      classNames={{
        base: 'w-full overflow-hidden rounded-2xl border border-default-200/70 bg-[#202124]/95 shadow-[0_12px_40px_rgba(0,0,0,0.22)]',
        body: 'p-4 sm:p-5',
        footer: 'px-4 pb-4 pt-0 sm:px-5 sm:pb-5',
      }}
      fullWidth
      shadow="none"
    >
      <form
        className="flex w-full flex-col gap-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <CardBody className="flex flex-col gap-5 p-0">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#81b64b]/30 bg-[#81b64b]/15 text-2xl text-[#91c957]">
              ♟
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Import a chess game
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-default-400">
                Paste your game notation below to start analysing your moves.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold text-foreground">
                PGN notation
              </label>
              <span className="rounded-md border border-default-300/40 bg-default-100/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-default-400">
                .pgn format
              </span>
            </div>

            <Controller
              control={control}
              name="pgn"
              rules={{ required: 'Please paste a PGN game before continuing.' }}
              render={({ field }) => (
                <Textarea
                  {...field}
                  aria-label="Paste PGN notation"
                  classNames={{
                    base: 'w-full',
                    inputWrapper: 'min-h-[190px] rounded-xl border border-[#45494f] bg-[#111315] px-4 py-3 shadow-none transition-all duration-200 group-data-[focus=true]:border-[#81b64b] group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-[#81b64b]/20',
                    input: 'min-h-[165px] resize-y font-mono text-sm leading-7 text-foreground placeholder:text-default-500',
                    errorMessage: 'px-1 text-xs text-danger',
                  }}
                  errorMessage={formState.errors.pgn?.message}
                  isInvalid={Boolean(formState.errors.pgn)}
                  maxRows={12}
                  minRows={7}
                  placeholder={'Paste your PGN here...\n\n[Event "Casual Game"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'}
                  variant="bordered"
                />
              )}
            />

            <p className="text-xs leading-relaxed text-default-500">
              You can paste the complete game, including headers and move
              notation.
            </p>
          </div>
        </CardBody>

        <CardFooter className="flex flex-col gap-3 p-0">
          <Button
            className="h-13 min-h-13 w-full rounded-xl border border-[#91c957]/30 bg-[#81b64b] text-base font-extrabold tracking-wide text-[#17210f] shadow-[0_3px_0_#527c2e] transition-all duration-150 hover:bg-[#91c957] active:translate-y-[2px] active:shadow-none disabled:border-default-300/20 disabled:bg-default-200 disabled:text-default-500 disabled:shadow-none"
            disableAnimation
            isDisabled={!formState.isDirty || !formState.isValid}
            radius="lg"
            type="submit"
          >
            Add Game
          </Button>
          <p className="text-center text-[11px] text-default-500">
            Your PGN is processed locally in ChessBook Reader.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
