import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Controller } from 'react-hook-form';
import { TypeOptions } from 'transformer/const';
import type { TransformerForm } from 'transformer/types';

export const TypeMenuList = ({
  vIndex,
  tIndex,
  customTypes,
}: {
  vIndex: number;
  tIndex: number;
  customTypes: string[];
}) => {
  return (
    <>
      {TypeOptions.filter((option) => option.category !== 'custom').map(
        (option, index, filteredOptions) => (
          <CommandGroup key={option.category} heading={option.label}>
            {option.types.map((type) => (
              <Controller<
                TransformerForm,
                `parsedItems.${number}.type.${number}.name`
              >
                key={type}
                name={`parsedItems.${vIndex}.type.${tIndex}.name`}
                render={({ field }) => (
                  <CommandItem
                    onSelect={field.onChange}
                    className={`font-mono text-syntax-entity`}
                  >
                    {type}
                  </CommandItem>
                )}
              />
            ))}
            {index !== filteredOptions.length - 1 && <CommandSeparator />}
          </CommandGroup>
        ),
      )}

      {customTypes.length > 0 && (
        <>
          <CommandSeparator />
          <CommandGroup heading="Custom">
            {customTypes.map((type) => (
              <Controller<
                TransformerForm,
                `parsedItems.${number}.type.${number}.name`
              >
                key={type}
                name={`parsedItems.${vIndex}.type.${tIndex}.name`}
                render={({ field }) => (
                  <CommandItem
                    onSelect={field.onChange}
                    className={`font-mono text-syntax-entity`}
                  >
                    {type}
                  </CommandItem>
                )}
              />
            ))}
          </CommandGroup>
        </>
      )}
    </>
  );
};
