import { Button } from '@/components/ui/button';
import { InputGroupButton } from '@/components/ui/input-group';
import clsx from 'clsx';
import { useCopyToClipboard } from 'hooks/use-copy-to-clipboard';
import { CheckIcon, CopyIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { useCallback } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import type { TransformerForm } from 'transformer/types';

export const IsOptionalButton = ({ index }: { index: number }) => {
  return (
    <Controller<TransformerForm, `parsedItems.${number}.isOptional`>
      name={`parsedItems.${index}.isOptional`}
      render={({ field }) => (
        <InputGroupButton
          variant={'secondary'}
          size={'icon-xs'}
          className="font-mono relative"
          onClick={() => field.onChange(!field.value)}
        >
          <span
            className={clsx('ease-in-out duration-600', {
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

export const CopyButton = ({ value }: { value: string }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  const handleCopy = useCallback(() => {
    if (!value) return;
    copyToClipboard(value);
    toast.info(
      <div className="flex flex-row items-center gap-1">
        Copied to clipboard
        <CheckIcon className="size-4 text-green-300" />
      </div>,
    );
  }, []);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleCopy}
      disabled={!value}
      className="relative"
    >
      <span
        className="absolute duration-200 ease-in-out"
        style={{
          opacity: isCopied ? 0 : 1,
          transform: isCopied ? 'scale(0.8)' : 'scale(1)',
        }}
      >
        <CopyIcon />
      </span>
      <span
        className="absolute duration-200 ease-in-out"
        style={{
          opacity: isCopied ? 1 : 0,
          transform: isCopied ? 'scale(1)' : 'scale(0.8)',
        }}
      >
        <CheckIcon />
      </span>
    </Button>
  );
};
