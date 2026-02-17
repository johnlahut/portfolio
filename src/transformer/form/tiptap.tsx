import type { EditorContentProps } from '@tiptap/react';
import { useCallback, useEffect } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Language, Parser } from 'web-tree-sitter';

import { LanguageChoices } from '~/transformer/const';
import { JAVA_CONFIG } from '~/transformer/queries';
import type {
  LanguageFlag,
  ResolvedParsedItem,
  TransformerForm,
} from '~/transformer/types';

import { TipTapCode } from './tiptap/TipTapCode';

const treeSitter = new Parser();
const { parse, parseTree } = JAVA_CONFIG;

export const CodeEditor = ({
  language,
}: {
  language: Language | undefined;
}) => {
  const formatterLang = useWatch<TransformerForm, 'language'>({
    name: 'language',
  });

  const { flag } =
    LanguageChoices[LanguageChoices.findIndex((i) => i.flag === formatterLang)];

  return (
    <Controller<TransformerForm, 'code'>
      name={'code'}
      render={({ field }) => (
        <Editor
          className="h-full"
          value={field.value}
          onChange={(value) => field.onChange(value)}
          flag={flag}
          language={language}
        />
      )}
    />
  );
};

const Editor = ({
  value,
  onChange,
  flag,
  language,
}: {
  value: string;
  onChange: (value: string) => void;
  flag: LanguageFlag;
  language: Language | undefined;
} & Omit<EditorContentProps, 'editor' | 'onChange'>) => {
  const { setValue, getValues } = useFormContext<TransformerForm>();

  const handleSmartMerge = useCallback(
    (
      currentItems: ResolvedParsedItem[],
      newItems: ResolvedParsedItem[],
    ): ResolvedParsedItem[] => {
      const matchedCurrentIds = new Set<string>();
      const matchedNewIndices = new Set<number>();

      // our results is everything 'new' in the editor
      // we need to figure out what didn't change, what updated, and what is new
      const result: ResolvedParsedItem[] = new Array(newItems.length);

      // try and find an item with the same exact name
      newItems.forEach((newItem, index) => {
        const currentMatches = currentItems.filter(
          (c) => c.variableName === newItem.variableName,
        );

        // if there's only one item with the same name
        if (currentMatches.length === 1) {
          const existing = currentMatches[0];

          // check to see if the types match
          const isTypeMatch = existing.type.every((t) =>
            newItem.type.some((nt) => nt.tag === t.tag && t.name === nt.name),
          );

          // if exact match, recycle the item
          if (isTypeMatch) {
            matchedCurrentIds.add(existing.itemId);
            matchedNewIndices.add(index);
            result[index] = {
              ...newItem,
              itemId: existing.itemId,
            };
          }
        }
      });

      const unmatchedCurrent = currentItems.filter(
        (c) => !matchedCurrentIds.has(c.itemId),
      );
      let unmatchedCurrentIndex = 0;

      newItems.forEach((newItem, index) => {
        if (!matchedNewIndices.has(index)) {
          // heuristic: take next available item by index
          // since output is sorted, this generally is correct
          if (unmatchedCurrentIndex < unmatchedCurrent.length) {
            const recycledItem = unmatchedCurrent[unmatchedCurrentIndex];
            unmatchedCurrentIndex++;
            result[index] = { ...newItem, itemId: recycledItem.itemId };
          } else {
            // 'end of the rope' and we just add it to the end
            result[index] = newItem;
          }
        }
      });

      return result;
    },
    [],
  );

  const onParse = useCallback(() => {
    const { code, parsedItems: currentItems } = getValues();
    if (code && language) {
      treeSitter.setLanguage(language);

      const { className, parsedItems } = parseTree(
        code,
        treeSitter.parse(code),
        language,
      );

      // 'new' as in 'all new items'
      // not only nodes that have been added`
      const newParsedItems = Object.values(parsedItems)
        .sort((a, b) => a.startPosition - b.startPosition)
        .map<ResolvedParsedItem>((item) => ({
          ...parse(item),
          itemId: crypto.randomUUID(),
        }));

      const mergedItems = handleSmartMerge(currentItems, newParsedItems);

      setValue('typeName', className ?? '');

      setValue('parsedItems', mergedItems);
    }
  }, [language, handleSmartMerge, getValues, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim().length > 0 && language) {
        onParse();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [value, language, onParse]);

  return (
    <TipTapCode
      className="h-full"
      value={value}
      onChange={onChange}
      flag={flag}
    />
  );
};
