import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { TransformerForm } from 'transformer/types';

export const AutoGenerator = ({ onGenerate }: { onGenerate: () => void }) => {
  const {
    control,
    formState: { isValid },
  } = useFormContext<TransformerForm>();

  const watchedValues = useWatch({
    control,
    name: ['export', 'classifier', 'typeName', 'parsedItems'],
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isValid) {
        onGenerate();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [watchedValues, isValid, onGenerate]);

  return null;
};
