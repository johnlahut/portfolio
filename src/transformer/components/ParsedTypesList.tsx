import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo } from 'react';
import { useFieldArray } from 'react-hook-form';

import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';

import { IsOptionalButton } from '~/transformer/form/button';
import { PropertyNameInput } from '~/transformer/form/input';
import type { ResolvedParsedItem, TransformerForm } from '~/transformer/types';

import { PropertyTypeInputGroup } from './PropertyTypeInputGroup';

const MotionButtonGroupText = motion.create(ButtonGroupText);

const ParsedPropertyRow = memo(({ fieldIndex }: { fieldIndex: number }) => {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <ButtonGroup orientation={'horizontal'} className="ml-3">
        <InputGroup className="w-auto box-content inline-flex">
          <PropertyNameInput index={fieldIndex} />

          <InputGroupAddon align={'inline-end'}>
            <IsOptionalButton index={fieldIndex} />
          </InputGroupAddon>
        </InputGroup>

        <MotionButtonGroupText
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0 }}
          transition={{ duration: 0.2 }}
          asChild
        >
          <Label className="font-mono text-syntax-punctuation p-0.5 whitespace-pre-wrap">
            {': '}
          </Label>
        </MotionButtonGroupText>

        <PropertyTypeInputGroup fieldIndex={fieldIndex} />

        <MotionButtonGroupText
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0 }}
          transition={{ duration: 0.2 }}
          asChild
        >
          <Label className="font-mono text-syntax-punctuation p-0.5">;</Label>
        </MotionButtonGroupText>
      </ButtonGroup>
    </AnimatePresence>
  );
});
ParsedPropertyRow.displayName = 'ParsedPropertyRow';

export const ParsedPropertyList = memo(() => {
  const { fields } = useFieldArray<TransformerForm, 'parsedItems'>({
    name: 'parsedItems',
  });

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {fields.map((field, fieldIndex) => (
        <MotionParsedPropertyRow
          // itemId is 'intelligently' set from the tiptap editor
          // it tries to preserve the itemId on simple updates
          // allowing us for smooth animations on insert/updates
          key={field.itemId}
          item={field}
          index={fieldIndex}
        />
      ))}
    </AnimatePresence>
  );
});
ParsedPropertyList.displayName = 'ParsedPropertyList';

const MotionParsedPropertyRow = ({
  item,
  index,
}: {
  item: ResolvedParsedItem;
  index: number;
}) => {
  const key = useMemo(
    () => `${item.variableName}|${item.type.map((t) => t.name).join('|')}`,
    [item.variableName, item.type],
  );
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className="rounded-md"
      // className="w-auto box-content inline-flex"
    >
      <ParsedPropertyRow fieldIndex={index} key={key} />
    </motion.div>
  );
};
