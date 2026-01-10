import { AutoGenerator } from './components/AutoGenerator';
import { ParsedPropertyList } from './components/ParsedTypesList';
import { TypescriptOutput } from './components/TypescriptOutput';
import { LanguageChoices } from './const';
import { ObjectNameInput } from './form/input';
import { ClassifierSelect, LanguageSelect } from './form/select';
import { ExportSwitch } from './form/switch';
import { CodeEditor } from './form/tiptap';
import { useLoadTreeSitterWasm, usePrettierFormat } from './hooks';
import { JAVA_CONFIG } from './queries';
import type { TransformerForm } from './types';
import { Button } from '@/components/ui/button';
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
import { useCopyToClipboard } from 'hooks/use-copy-to-clipboard';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { toast } from 'sonner';

const { generateTypescript } = JAVA_CONFIG;

export const TransformerLayout = () => {
  const form = useFormContext<TransformerForm>();

  const selectedClassifier = form.watch('classifier');
  const _flag = form.watch('language');

  const { parser, flag } =
    LanguageChoices[LanguageChoices.findIndex((i) => i.flag === _flag)];

  const [typescript, setTypescript] = useState<string>('');

  const { format } = usePrettierFormat();
  const { language } = useLoadTreeSitterWasm({ parser });

  const onGenerate = useCallback(() => {
    format(
      { code: generateTypescript(form.getValues()), parser: 'typescript' },
      {
        onSuccess: (value) => setTypescript(value),
      },
    );
  }, [format, form]);

  const { isCopied, copyToClipboard } = useCopyToClipboard();

  return (
    <div className="flex flex-col h-full overflow-auto">
      <AutoGenerator onGenerate={onGenerate} />
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
                    {selectedClassifier === 'type' && <span>{' = '}</span>}
                    <span className="text-syntax-punctuation">{'{'}</span>
                  </span>
                </div>

                <div
                  className="overflow-auto flex flex-col gap-0.5 py-2"
                  id="items-list"
                >
                  <ParsedPropertyList />
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
                  <Button
                    variant={'outline'}
                    onClick={() => {
                      copyToClipboard(typescript);
                      toast('Copied to clipboard.');
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </Button>
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
