import * as React from 'react';

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = React.useState(false);

  const copyToClipboard = React.useCallback(
    async (value: string, timeout?: number) => {
      setIsCopied(true);

      const copyPromise = navigator.clipboard.writeText(value);
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(1000, timeout ?? 0)),
      );

      try {
        await Promise.all([copyPromise, timeoutPromise]);
      } catch (error) {
        console.error('Failed to copy text: ', error);
      } finally {
        setIsCopied(false);
      }
    },
    [],
  );

  return { isCopied, copyToClipboard };
}
