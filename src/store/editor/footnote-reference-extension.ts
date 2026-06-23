'use client';

/**
 * Schema-backed inline footnote references for the TipTap document editor.
 */
import { Node, mergeAttributes } from '@tiptap/core';

export interface FootnoteReferenceAttrs {
    id?: string;
    note: string;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        footnoteReference: {
            /**
             * Inserts an inline footnote reference with persisted note text.
             */
            insertFootnoteReference: (attrs: FootnoteReferenceAttrs) => ReturnType;
        };
    }
}

function createFootnoteId() {
    return `fn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalizes user-entered footnote text before it enters editor JSON.
 *
 * @param value - Raw note text from import or user input.
 * @returns A single-line, trimmed footnote body.
 */
export function normalizeFootnoteNote(value: unknown) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Inline atom that stores a footnote reference and body text in document JSON.
 */
export const FootnoteReferenceExtension = Node.create({
    name: 'footnoteReference',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-footnote-id'),
                renderHTML: (attributes) => {
                    const id = typeof attributes.id === 'string' ? attributes.id : '';
                    return id ? { 'data-footnote-id': id } : {};
                },
            },
            note: {
                default: '',
                parseHTML: (element) => normalizeFootnoteNote(element.getAttribute('data-footnote-text')),
                renderHTML: (attributes) => {
                    const note = normalizeFootnoteNote(attributes.note);
                    return note ? { 'data-footnote-text': note, title: note } : {};
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'sup[data-footnote-id][data-footnote-text]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const note = normalizeFootnoteNote(HTMLAttributes['data-footnote-text']);

        return [
            'sup',
            mergeAttributes(HTMLAttributes, {
                class: 'document-footnote-reference',
                contenteditable: 'false',
                'aria-label': note ? `Footnote: ${note}` : 'Footnote',
            }),
            '',
        ];
    },

    addCommands() {
        return {
            insertFootnoteReference: (attrs) => ({ commands }) => {
                const note = normalizeFootnoteNote(attrs.note);
                if (!note) return false;

                return commands.insertContent([
                    {
                        type: this.name,
                        attrs: {
                            id: attrs.id ?? createFootnoteId(),
                            note,
                        },
                    },
                    { type: 'text', text: ' ' },
                ]);
            },
        };
    },
});
