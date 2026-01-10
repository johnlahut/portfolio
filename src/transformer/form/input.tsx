import { Input } from '@/components/ui/input';
import { InputGroupInput } from '@/components/ui/input-group';
import { Controller, useWatch } from 'react-hook-form';
import type { TransformerForm } from 'transformer/types';

export const ObjectNameInput = () => {
  return (
    <Controller<TransformerForm, 'typeName'>
      name={'typeName'}
      render={({ field }) => (
        <Input
          {...field}
          className={`font-mono box-content py-0 px-1 text-syntax-entity`}
          style={{
            width: `${field.value.length}ch`,
          }}
        />
      )}
    />
  );
};

export const PropertyNameInput = ({ index }: { index: number }) => {
  return (
    <Controller<TransformerForm, `parsedItems.${number}.variableName`>
      name={`parsedItems.${index}.variableName`}
      render={({ field }) => (
        <InputGroupInput
          {...field}
          className={`font-mono box-content py-0 px-1 text-syntax-variable`}
          style={{
            width: `${field.value.length}ch`,
          }}
        />
      )}
    />
  );
};

export const PropertyTypeInput = ({
  vIndex,
  tIndex,
}: {
  vIndex: number;
  tIndex: number;
}) => {
  const dim = useWatch<
    TransformerForm,
    `parsedItems.${number}.type.${number}.dim`
  >({ name: `parsedItems.${vIndex}.type.${tIndex}.dim` });

  return (
    <Controller<TransformerForm, `parsedItems.${number}.type.${number}.name`>
      name={`parsedItems.${vIndex}.type.${tIndex}.name`}
      render={({ field }) => (
        <InputGroupInput
          {...field}
          value={field.value + '[]'.repeat(dim)}
          className={`font-mono box-content py-0 px-1 text-syntax-entity`}
          style={{
            width: `${field.value?.length + dim * 2}ch`,
          }}
        />
      )}
    />
  );
};
