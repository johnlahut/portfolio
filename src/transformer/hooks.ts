import type { ParserChoice } from './types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'prettier/standalone.js';
import { Language } from 'web-tree-sitter';

import JavaPlugin from 'prettier-plugin-java';
import BabelPlugin from 'prettier/plugins/babel';
import EstreePlugin from 'prettier/plugins/estree';
import TypescriptPlugin from 'prettier/plugins/typescript';

export const usePrettierFormat = () => {
  const hook = useMutation({
    mutationFn: ({
      code,
      parser,
    }: {
      code: string;
      parser: ParserChoice;
    }) => {
      switch (parser) {
        case 'java':
          return format(code, { parser, plugins: [JavaPlugin] });
        case 'typescript':
          return format(code, { parser, plugins: [TypescriptPlugin, EstreePlugin] });
        case 'babel':
          return format(code, { parser, plugins: [BabelPlugin, EstreePlugin] });
        default:
          return Promise.reject('Unsupported language.')
      }
    },
  });

  return {
    format: hook.mutate,
    formatAsync: hook.mutateAsync,
    formattedCode: hook.data,
    isPending: hook.isPending,
  };
};

export const useLoadTreeSitterWasm = ({
  parser,
}: {
  parser: ParserChoice | '';
}) => {
  const hook = useQuery({
    queryKey: ['tree_sitter_wasm'],
    queryFn: () => {
      if (!parser) return Promise.reject();

      switch (parser) {
        case 'java':
          return Language.load('/tree-sitter-java.wasm');
        default:
          return Promise.reject();
      }
    },
    enabled: parser !== '',
  });

  return {
    language: hook.data,
    isFetching: hook.isFetching,
  };
};
