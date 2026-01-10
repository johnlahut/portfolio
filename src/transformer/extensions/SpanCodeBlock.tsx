import CodeBlock from '@tiptap/extension-code-block';

export const SpanCodeBlock = CodeBlock.extend({
  content: 'text*',
  marks: 'classSpan',
});
