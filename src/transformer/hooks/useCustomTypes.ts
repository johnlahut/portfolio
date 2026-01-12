import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { STANDARD_TYPES as STANDARD_TYPE_LIST } from 'transformer/const';
import { useTransformerContext } from 'transformer/context';
import type { ResolvedParsedItem, TransformerForm } from 'transformer/types';

// when we parse, we expose all 'non-standard' types
// and allow users to select them from the dropdown
export const extractCustomTypes = (
  parsedItems: ResolvedParsedItem[],
  typeName: string,
): string[] => {
  const STANDARD_TYPES = new Set(STANDARD_TYPE_LIST);
  const customTypes = new Set<string>();

  // always include class / type name
  customTypes.add(typeName);

  // for all the types we have parsed
  parsedItems.forEach((item) => {
    item.type.forEach((t) => {
      // check if its 'standard'
      // if not, add it to our tracking set
      switch (t.tag) {
        case 'base':
          if (!STANDARD_TYPES.has(t.name)) {
            customTypes.add(t.name);
          }
          break;
        case 'generic':
          if (!STANDARD_TYPES.has(t.name)) {
            customTypes.add(t.name);
          }
          t.args?.forEach((arg) => {
            if (!STANDARD_TYPES.has(arg)) {
              customTypes.add(arg);
            }
          });
          break;
        case 'map':
          if (!STANDARD_TYPES.has(t.key)) {
            customTypes.add(t.key);
          }
          if (!STANDARD_TYPES.has(t.value)) {
            customTypes.add(t.value);
          }
          break;
      }
    });
  });

  return Array.from(customTypes);
};

// hook to get all custom types we should show in the dropdown
export const useCustomTypes = (): string[] => {
  // get all 3 input sources:
  // 1. all types from the input pane (includes class / type name)
  // 2. current parsed items
  // 3. current type name

  const { inputTypes } = useTransformerContext();
  const parsedItems = useWatch<TransformerForm, 'parsedItems'>({
    name: 'parsedItems',
  });
  const typeName = useWatch<TransformerForm, 'typeName'>({
    name: 'typeName',
  });

  return useMemo(() => {
    const formTypes = extractCustomTypes(parsedItems, typeName);

    // Merge: original types (always) + current types (if in use)
    const mergedTypes = new Set([...inputTypes, ...formTypes]);

    return Array.from(mergedTypes).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }, [parsedItems, typeName, inputTypes]);
};
