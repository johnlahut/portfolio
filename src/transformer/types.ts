import { type BuiltInParserName, type Plugin } from 'prettier';

export const ParsedTokens = [
  'enum',
  'generic',
  'generic_class',
  'variable',
  'variable_array',
  'class',
] as const;
export type ParsedToken = (typeof ParsedTokens)[number];

export const ParsedTypes = ['enum', 'generic', 'variable', 'class'] as const;
type ParsedType = (typeof ParsedTypes)[number];

type BaseParsed = {
  startPosition: number;
  name: string;
  tag: ParsedType;
};

type ParsedEnum = {
  tag: 'enum';
  values: string[];
} & BaseParsed;

type ParsedGeneric = {
  tag: 'generic';
  type: string;
  args: string[];
} & BaseParsed;

type ParsedVariable = {
  tag: 'variable';
  type: string;
  dim: number;
} & BaseParsed;

type BaseResolvedType = {
  name: string;
  isValid: boolean;
  dim: number;
};

export type ParsedItem = ParsedEnum | ParsedGeneric | ParsedVariable;

export type ResolvedType = {
  tag: 'base';
} & BaseResolvedType;

export type ResolvedGenericType = {
  tag: 'generic';
  args: string[];
} & BaseResolvedType;

export type ResolvedMapType = {
  tag: 'map';
  key: string;
  value: string;
} & Omit<BaseResolvedType, 'type'>;

export type ResolvedParsedItem = {
  itemId: string;
  variableName: string;
  type: (ResolvedType | ResolvedGenericType | ResolvedMapType)[];
  isOptional: boolean;
};

export type TransformerForm = {
  code: string;
  language: LanguageFlag;
  parsedItems: ResolvedParsedItem[];
  export: boolean;
  classifier: 'type' | 'interface';
  typeName: string;
};

export const StarryNightLangs = [
  'ts',
  'js',
  'java',
  'py',
  'c',
  'cpp',
  'go',
  'rs',
  'php',
  'cs',
  'kt',
  'rb',
  'swift',
  'dart',
  'scala',
  'tsx',
] as const;
export type LanguageFlag = (typeof StarryNightLangs)[number];

export type ParserChoice = BuiltInParserName | 'java';

export type LanguageChoice = {
  parser: ParserChoice;
  label: string;
  plugins: Plugin[];
  flag: LanguageFlag;
};
