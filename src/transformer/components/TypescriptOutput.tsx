import { useLoaderData } from '@tanstack/react-router';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { useMemo } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';

import type { LanguageFlag } from '~/transformer/types';

export const TypescriptOutput = ({
  value,
  flag,
}: {
  value: string;
  flag: LanguageFlag;
}) => {
  const starryNight = useLoaderData({ from: '/transformer' });

  const scope = useMemo(
    () => starryNight.flagToScope('ts') ?? flag,
    [starryNight, flag],
  );

  const highlighted = useMemo(
    () => starryNight.highlight(value, scope),
    [starryNight, value, scope],
  );

  return (
    <div className="font-mono whitespace-pre-wrap">
      {toJsxRuntime(highlighted, {
        Fragment,
        jsx,
        jsxs,
      })}
    </div>
  );
};
