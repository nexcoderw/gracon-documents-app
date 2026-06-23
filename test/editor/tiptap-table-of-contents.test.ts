import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createTableOfContentsNodes,
    extractTableOfContentsHeadings,
} from '../../src/lib/tiptap/tiptap-table-of-contents.ts';

test('extractTableOfContentsHeadings reads heading text in document order', () => {
    const headings = extractTableOfContentsHeadings({
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Overview' }],
            },
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Body' }],
            },
            {
                type: 'heading',
                attrs: { level: 3 },
                content: [
                    { type: 'text', text: 'Deep' },
                    { type: 'text', text: ' section' },
                ],
            },
        ],
    });

    assert.deepEqual(headings, [
        { level: 1, text: 'Overview' },
        { level: 3, text: 'Deep section' },
    ]);
});

test('createTableOfContentsNodes builds static indented TOC entries', () => {
    const nodes = createTableOfContentsNodes({
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Plan' }],
            },
        ],
    });

    assert.equal(nodes[0].type, 'heading');
    assert.deepEqual(nodes[1], {
        type: 'paragraph',
        attrs: {
            leftIndent: 24,
            firstLineIndent: 0,
            tabStops: [{ position: 480, align: 'right' }],
        },
        content: [
            { type: 'text', text: 'Plan' },
            { type: 'text', text: '\t' },
        ],
    });
});
