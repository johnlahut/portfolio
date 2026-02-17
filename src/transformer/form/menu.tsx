import { Controller } from 'react-hook-form';

import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';

import { TypeOptions } from '~/transformer/const';
import type { TransformerForm } from '~/transformer/types';

export const TypeMenuList = ({
  vIndex,
  tIndex,
}: {
  vIndex: number;
  tIndex: number;
}) => {
  return TypeOptions.map((option, index) => (
    <CommandGroup heading={option.label}>
      {option.types.map((type) => (
        <Controller<
          TransformerForm,
          `parsedItems.${number}.type.${number}.name`
        >
          name={`parsedItems.${vIndex}.type.${tIndex}.name`}
          render={({ field }) => (
            <CommandItem
              onSelect={field.onChange}
              className={`font-mono text-syntax-entity`}
            >
              {`${type}`}
            </CommandItem>
          )}
        />
      ))}
      {index !== TypeOptions.length - 1 && <CommandSeparator />}
    </CommandGroup>
  ));
};
