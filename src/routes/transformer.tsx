import { createFileRoute } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { TransformerLayout } from 'transformer/layout';
import { type TransformerForm } from 'transformer/types';

export const Route = createFileRoute('/transformer')({
  component: TransformerRoute,
});

const useTransformerForm = () => {
  const form = useForm<TransformerForm>({
    defaultValues: {
      code: '',
      language: 'java',
      parsedItems: [],
      classifier: 'type',
      export: true,
      typeName: '',
    },
  });

  return form;
};

// https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web
function TransformerRoute() {
  const form = useTransformerForm();

  return (
    <FormProvider {...form}>
      <TransformerLayout />
    </FormProvider>
  );
}
