import clsx from 'clsx';
import { Controller } from 'react-hook-form';

import { Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';

import type { TransformerForm } from '~/transformer/types';

export const ExportSwitch = () => {
  return (
    <Controller<TransformerForm, 'export'>
      name="export"
      render={({ field }) => (
        <Field orientation={'horizontal'} className="w-auto">
          <Switch
            name={field.name}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
          <FieldLabel
            className={clsx('font-mono duration-500 ease-in-out', {
              'text-syntax-keyword': field.value,
              'text-gray-600 line-through': !field.value,
            })}
          >
            export
          </FieldLabel>
        </Field>
      )}
    />
  );
};
