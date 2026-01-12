import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Trash2Icon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo } from 'react';
import { IsOptionalButton } from 'transformer/form/button';
import { PropertyNameInput } from 'transformer/form/input';
import type { ResolvedParsedItem } from 'transformer/types';

import { PropertyTypeInputGroup } from './PropertyTypeInputGroup';

const MotionButtonGroupText = motion.create(ButtonGroupText);

const ParsedPropertyRow = memo(
  ({ fieldIndex, onRemove }: { fieldIndex: number; onRemove: () => void }) => {
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <div className="flex items-center gap-1">
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

            <AnimatePresence>
              <PropertyTypeInputGroup fieldIndex={fieldIndex} />
            </AnimatePresence>

            <MotionButtonGroupText
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ duration: 0.2 }}
              asChild
            >
              <Label className="font-mono text-syntax-punctuation p-0.5">
                ;
              </Label>
            </MotionButtonGroupText>
          </ButtonGroup>
          <Button
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="opacity-20 hover:opacity-100 hover:text-destructive self-center"
          >
            <Trash2Icon />
          </Button>
        </div>
      </AnimatePresence>
    );
  },
);
ParsedPropertyRow.displayName = 'ParsedPropertyRow';

export const ParsedPropertyList = memo(
  ({
    parsedItems,
    onDelete,
  }: {
    parsedItems: ResolvedParsedItem[];
    onDelete: (index: number) => void;
  }) => {
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        {parsedItems.map((field, index) => (
          <MotionParsedPropertyRow
            // itemId is 'intelligently' set from the tiptap editor
            // it tries to preserve the itemId on simple updates
            // allowing us for smooth animations on insert/updates
            key={field.itemId}
            item={field}
            index={index}
            onRemove={() => onDelete(index)}
          />
        ))}
      </AnimatePresence>
    );
  },
);
ParsedPropertyList.displayName = 'ParsedPropertyList';

const MotionParsedPropertyRow = ({
  item,
  index,
  onRemove,
}: {
  item: ResolvedParsedItem;
  index: number;
  onRemove: () => void;
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
    >
      <ParsedPropertyRow fieldIndex={index} key={key} onRemove={onRemove} />
    </motion.div>
  );
};
