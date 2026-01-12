import JavaPlugin from 'prettier-plugin-java';
import BabelPlugin from 'prettier/plugins/babel';
import EstreePlugin from 'prettier/plugins/estree';
import TypescriptPlugin from 'prettier/plugins/typescript';

import type { LanguageChoice } from './types';

// https://github.com/wooorm/starry-night?tab=readme-ov-file#languages
export const LanguageChoices: LanguageChoice[] = [
  {
    label: 'TypeScript',
    parser: 'typescript',
    plugins: [TypescriptPlugin],
    flag: 'ts',
  },
  {
    label: 'JavaScript',
    parser: 'babel',
    plugins: [BabelPlugin, EstreePlugin],
    flag: 'js',
  },
  {
    label: 'Java',
    parser: 'java',
    plugins: [JavaPlugin],
    flag: 'java',
  },
  {
    label: 'Python',
    parser: 'acorn',
    plugins: [],
    flag: 'py',
  },
  {
    label: 'C#',
    parser: 'acorn',
    plugins: [],
    flag: 'cs',
  },
  {
    label: 'Kotlin',
    parser: 'acorn',
    plugins: [],
    flag: 'kt',
  },
];

type TypeOption = {
  label: string;
  types: string[];
  category: 'common' | 'advanced' | 'custom';
};
export const STANDARD_TYPES = [
  'string',
  'number',
  'object',
  'null',
  'boolean',
  'any',
  'unknown',
];
export const TypeOptions: TypeOption[] = [
  {
    label: '',
    types: [...STANDARD_TYPES],
    category: 'common',
  },
  {
    label: 'Custom',
    types: [],
    category: 'custom',
  },
];
