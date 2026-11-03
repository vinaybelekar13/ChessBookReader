import { Button, Input } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import useLocalStorage from '../../hooks/useLocalStorage';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';

import type { Site } from '../../stores/useSelectGameStore';
import type { SubmitHandler } from 'react-hook-form';

interface Inputs {
  username: string;
}

export default function ChessSiteForm({ site }: { site: Site }) {
  const submitUsername = useSelectGameStore(state => state.submitUsername);
  const setStage = useStageStore(state => state.setStage);
  const { item: lastUsername, set } = useLocalStorage(`${site}-username`);
  const { handleSubmit, control, formState, watch } = useForm<Inputs>({ defaultValues: { username: lastUsername || '' } });

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    submitUsername(data.username, site);
    set(`${site}-username`, data.username);
    setStage('select-month');
  };

  return (
    <form className="flex w-full items-end gap-2" onSubmit={handleSubmit(onSubmit)}>
      <Controller
        control={control}
        name="username"
        render={({ field }) => (
          <Input
            {...field}
            aria-label="Chess.com username"
            classNames={{
              base: "min-w-0 flex-1",
              inputWrapper: "h-12 min-h-12 rounded-lg border border-default-300 bg-content1 px-3 shadow-none",
              input: "text-sm placeholder:text-default-500"
            }}
            placeholder="Enter your Chess.com username"
            size="md"
            variant="bordered"
          />
        )}
      />
      <Button
        className="h-12 min-w-[84px] shrink-0 font-semibold"
        color="primary"
        isDisabled={watch('username') === '' || !formState.isValid}
        radius="sm"
        type="submit"
      >
        Submit
      </Button>
    </form>
  );
}


