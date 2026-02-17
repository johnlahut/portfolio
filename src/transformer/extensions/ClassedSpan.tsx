import { Mark, mergeAttributes } from '@tiptap/react';

export const ClassedSpan = Mark.create({
  name: 'classSpan',
  inclusive: true,
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: ({ classList }) => classList,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: ({ classList }) => classList,
        renderHTML: (attributes) => ({
          class: attributes.class,
        }),
      },
    };
  },
});
