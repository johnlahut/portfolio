import { useLoaderData } from '@tanstack/react-router';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import {
  EditorContent,
  type EditorContentProps,
  useEditor,
} from '@tiptap/react';
import { toHtml } from 'hast-util-to-html';
import { useEffect, useMemo, useState } from 'react';

import { ClassedSpan } from '~/transformer/extensions/ClassedSpan';
import { SpanCodeBlock } from '~/transformer/extensions/SpanCodeBlock';
import type { LanguageFlag } from '~/transformer/types';

export const TipTapCode = ({
  value,
  onChange,
  flag,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  flag: LanguageFlag;
} & Omit<EditorContentProps, 'editor' | 'onChange'>) => {
  const starryNight = useLoaderData({ from: '__root__' });
  const [debouncedValue, setDebouncedValue] = useState(value);

  const scope = useMemo(
    () => starryNight.flagToScope(flag) ?? flag,
    [starryNight, flag],
  );

  const [initialContent] = useState(() =>
    toHtml(starryNight.highlight(value, scope)),
  );

  const editor = useEditor({
    extensions: [Document, Text, SpanCodeBlock, ClassedSpan],
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getText()),
    editorProps: {
      // when data is pasted in, re-highlight it
      handlePaste: (_, event) => {
        const { clipboardData } = event;
        if (!clipboardData) return false;

        const text = clipboardData.getData('text/plain');

        editor.commands.insertContent(
          toHtml(starryNight.highlight(text, scope)),
        );

        return true;
      },
      attributes: {
        // match textarea
        class:
          'h-full overflow-auto bg-input/20 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 resize-none rounded-md border px-2 py-2 text-sm transition-colors focus-visible:ring-[2px] aria-invalid:ring-[2px] md:text-xs/relaxed placeholder:text-muted-foreground field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50',
      },
    },
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, 300);
    return () => clearTimeout(handler);
  }, [value]);

  const debouncedContent = useMemo(
    () => toHtml(starryNight.highlight(debouncedValue, scope)),
    [scope, starryNight, debouncedValue],
  );

  // sync lang and starry night highlights
  useEffect(() => {
    editor.commands.setContent(
      toHtml(starryNight.highlight(editor.getText(), scope)),
    );
  }, [scope, editor, starryNight]);

  // sync tanstack form and tiptap
  useEffect(() => {
    if (!editor) return;

    const currentText = editor.getText();

    // Case 1: External Update (e.g. Reset, or loaded data).
    // update immediately
    if (value !== currentText) {
      editor.commands.setContent(toHtml(starryNight.highlight(value, scope)));
      return;
    }

    // Case 2: Value update
    // The text matches, but we may need to apply new syntax highlighting
    if (debouncedValue === value) {
      if (!editor.getHTML().includes(debouncedContent)) {
        const { from, to } = editor.state.selection;
        editor.commands.setContent(debouncedContent);
        editor.commands.setTextSelection({ from, to });
      }
    }
  }, [debouncedContent, debouncedValue, editor, value, scope, starryNight]);

  return <EditorContent spellCheck="false" editor={editor} {...props} />;
};
