import clsx from 'clsx';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { Controller } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { InputGroupButton } from '@/components/ui/input-group';

import type { TransformerForm } from '~/transformer/types';

export const IsOptionalButton = ({ index }: { index: number }) => {
  return (
    <Controller<TransformerForm, `parsedItems.${number}.isOptional`>
      name={`parsedItems.${index}.isOptional`}
      render={({ field }) => (
        <InputGroupButton
          variant={'secondary'}
          size={'icon-xs'}
          className="relative font-mono"
          onClick={() => field.onChange(!field.value)}
        >
          <span
            className={clsx('duration-600 ease-in-out', {
              'blur-[2px]': !field.value,
              'text-blue-300': field.value,
            })}
          >
            ?
          </span>
        </InputGroupButton>
      )}
    />
  );
};

export const IncrementDimButton = ({
  vIndex,
  tIndex,
}: {
  vIndex: number;
  tIndex: number;
}) => {
  return (
    <Controller<TransformerForm, `parsedItems.${number}.type.${number}.dim`>
      name={`parsedItems.${vIndex}.type.${tIndex}.dim`}
      render={({ field }) => (
        <Button
          disabled={field.value >= 3}
          variant={'secondary'}
          size={'icon-xs'}
          onClick={() => field.onChange(field.value + 1)}
        >
          <PlusIcon />
        </Button>
      )}
    />
  );
};

export const DecrementDimButton = ({
  vIndex,
  tIndex,
}: {
  vIndex: number;
  tIndex: number;
}) => {
  return (
    <Controller<TransformerForm, `parsedItems.${number}.type.${number}.dim`>
      name={`parsedItems.${vIndex}.type.${tIndex}.dim`}
      render={({ field }) => (
        <Button
          disabled={field.value <= 0}
          variant={'secondary'}
          size={'icon-xs'}
          onClick={() => field.onChange(field.value - 1)}
        >
          <MinusIcon />
        </Button>
      )}
    />
  );
};
