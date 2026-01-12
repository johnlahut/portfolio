import { useEffect } from 'react';
import type { TransformerForm } from 'transformer/types';

export const AutoGenerator = ({
  isValid,
  watchedValues,
  onGenerate,
}: {
  isValid: boolean;
  watchedValues: Partial<TransformerForm>;
  onGenerate: () => void;
}) => {
  useEffect(
    () => {
      const timer = setTimeout(() => {
        isValid && onGenerate();
      }, 300);
      return () => clearTimeout(timer);
    },

    // important to explicity list the props that we want to auto-refresh on
    [
      watchedValues.classifier,
      watchedValues.parsedItems,
      watchedValues.export,
      watchedValues.typeName,
      isValid,
      onGenerate,
    ],
  );

  return null;
};
