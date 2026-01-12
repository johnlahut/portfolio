import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import { AutoGenerator } from './components/AutoGenerator';
import { ParsedPropertyList } from './components/ParsedTypesList';
import { TypescriptOutput } from './components/TypescriptOutput';
import { LanguageChoices } from './const';
import { CopyButton } from './form/button';
import { ObjectNameInput } from './form/input';
import { ClassifierSelect, LanguageSelect } from './form/select';
import { ExportSwitch } from './form/switch';
import { CodeEditor } from './form/tiptap';
import { useLoadTreeSitterWasm, usePrettierFormat } from './hooks';
import { JAVA_CONFIG } from './queries';
import type { TransformerForm } from './types';

const { generateTypescript } = JAVA_CONFIG;

export const TransformerLayout = () => {
  const {
    formState: { isValid },
  } = useFormContext<TransformerForm>();

  const { fields: parsedItems, remove: removeParsedItem } = useFieldArray<
    TransformerForm,
    'parsedItems'
  >({ name: 'parsedItems' });
  const inputLang = useWatch<TransformerForm, 'language'>({ name: 'language' });

  const [shouldExport, classifier, typeName] = useWatch<
    TransformerForm,
    ['export', 'classifier', 'typeName']
  >({
    name: ['export', 'classifier', 'typeName'],
  });

  const { parser, flag } =
    LanguageChoices[LanguageChoices.findIndex((i) => i.flag === inputLang)];

  const [typescript, setTypescript] = useState<string>('');

  // reset output when parsedItems is emptied
  useEffect(() => {
    if (parsedItems.length === 0) {
      setTypescript('');
    }
  }, [parsedItems]);

  const { format } = usePrettierFormat();
  const { language } = useLoadTreeSitterWasm({ parser });

  const onGenerate = useCallback(() => {
    format(
      {
        code: generateTypescript({
          parsedItems,
          typeName,
          classifier,
          export: shouldExport,
        }),
        parser: 'typescript',
      },
      {
        onSuccess: (value) => {
          setTypescript(value);
        },
      },
    );
  }, [format, parsedItems, shouldExport, typeName, classifier]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <AutoGenerator
        isValid={isValid}
        onGenerate={onGenerate}
        watchedValues={{
          classifier,
          typeName,
          parsedItems,
          export: shouldExport,
        }}
      />
      <div className="flex h-full overflow-auto mx-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="border rounded-lg max-w"
        >
          <ResizablePanel>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Input</CardTitle>
                <CardDescription>
                  Paste your code below to get started.
                </CardDescription>
                <CardAction>
                  <LanguageSelect />
                </CardAction>
              </CardHeader>
              <CardContent className="h-full overflow-auto">
                <CodeEditor language={language} />
              </CardContent>
            </Card>
          </ResizablePanel>
          <ResizableHandle className="mx-1" />
          <ResizablePanel>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Edit</CardTitle>
                <CardDescription>
                  Make any adjustments to the parsed structure here.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-row items-center gap-1 shrink-0">
                  <ExportSwitch />
                  <ClassifierSelect />
                  <ObjectNameInput />
                  <span className="font-mono text-xs text-nowrap">
                    {classifier === 'type' && <span>{' = '}</span>}
                    <span className="text-syntax-punctuation">{'{'}</span>
                  </span>
                </div>

                <div
                  className="overflow-auto flex flex-col gap-0.5 py-2"
                  id="items-list"
                >
                  <ParsedPropertyList
                    parsedItems={parsedItems}
                    onDelete={removeParsedItem}
                  />
                </div>
                <span className="font-mono text-xs text-syntax-punctuation">
                  {'};'}
                </span>
              </CardContent>
            </Card>
          </ResizablePanel>
          <ResizableHandle className="mx-1" />
          <ResizablePanel>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Output</CardTitle>
                <CardDescription>
                  Preview the final Typescript definition here.
                </CardDescription>
                <CardAction>
                  <CopyButton value={typescript} />
                </CardAction>
              </CardHeader>
              <CardContent className="h-full overflow-auto">
                <TypescriptOutput flag={flag} value={typescript} />
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};
