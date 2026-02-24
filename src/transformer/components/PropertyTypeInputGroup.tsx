import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React from 'react';
import { useFieldArray } from 'react-hook-form';

import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';

import {
  DecrementDimButton,
  IncrementDimButton,
} from '~/transformer/form/button';
import { PropertyTypeInput } from '~/transformer/form/input';
import { TypeMenuList } from '~/transformer/form/menu';
import { type TransformerForm } from '~/transformer/types';

const MotionInputGroup = motion.create(InputGroup);
const MotionButtonGroupText = motion.create(ButtonGroupText);

const PropertyTypeInputGroupComponent = ({
  fieldIndex,
}: {
  fieldIndex: number;
}) => {
  const { fields, append } = useFieldArray<
    TransformerForm,
    `parsedItems.${number}.type`
  >({ name: `parsedItems.${fieldIndex}.type` });

  return (
    <AnimatePresence initial={false}>
      {fields.map((fieldItem, index) => (
        <React.Fragment key={fieldItem.id}>
          <MotionInputGroup
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.2 }}
            className="box-content inline-flex w-auto"
          >
            <PropertyTypeInput vIndex={fieldIndex} tIndex={index} />
            <InputGroupAddon align={'inline-end'}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton className="text-muted-foreground">
                    <ChevronDownIcon />
                  </InputGroupButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-auto">
                  <Command
                    value={(fieldItem.tag === 'base' && fieldItem.name) || ''}
                  >
                    <CommandGroup></CommandGroup>
                    <div className="flex items-center gap-2">
                      <CommandInput placeholder="Search types..." />
                      <div className="flex items-center gap-0.5">
                        <Label
                          htmlFor="is-array"
                          className="font-mono text-syntax-punctuation"
                        >
                          {'[]'}
                        </Label>

                        <ButtonGroup className="ml-1">
                          <DecrementDimButton
                            vIndex={fieldIndex}
                            tIndex={index}
                          />
                          <IncrementDimButton
                            vIndex={fieldIndex}
                            tIndex={index}
                          />
                        </ButtonGroup>
                      </div>
                    </div>
                    <CommandList>
                      <TypeMenuList vIndex={fieldIndex} tIndex={index} />
                    </CommandList>
                  </Command>
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
            {index === fields.length - 1 && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  className="
                    text-primary
                    hover:bg-primary/10 hover:text-primary
                  "
                  onClick={() =>
                    append({
                      tag: 'base',
                      name: 'string',
                      isValid: true,
                      dim: 0,
                    })
                  }
                >
                  <PlusIcon className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </MotionInputGroup>
          {index !== fields.length - 1 && (
            <MotionButtonGroupText
              asChild
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Label className="p-0.5 font-mono text-syntax-punctuation">
                |
              </Label>
            </MotionButtonGroupText>
          )}
        </React.Fragment>
      ))}
    </AnimatePresence>
  );
};

export const PropertyTypeInputGroup = React.memo(
  PropertyTypeInputGroupComponent,
);

PropertyTypeInputGroup.displayName = 'PropertyTypeInputGroup';
