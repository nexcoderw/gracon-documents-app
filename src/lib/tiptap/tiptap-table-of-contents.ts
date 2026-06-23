/**
 * Builds static table-of-contents TipTap content from document headings.
 */
export interface TiptapTableOfContentsHeading {
    level: number;
    text: string;
}

type TiptapJsonNode = Record<string, unknown>;

function isRecord(value: unknown): value is TiptapJsonNode {
    return typeof value === 'object' && value !== null;
}

function getTextContent(node: TiptapJsonNode): string {
    const directText = typeof node.text === 'string' ? node.text : '';
    const children = Array.isArray(node.content) ? node.content : [];

    return children.reduce((text, child) => {
        return isRecord(child) ? `${text}${getTextContent(child)}` : text;
    }, directText);
}

/**
 * Extracts heading levels and text from TipTap JSON in document order.
 *
 * @param content - TipTap JSON document content.
 * @returns Heading entries that have non-empty visible text.
 */
export function extractTableOfContentsHeadings(content: TiptapJsonNode): TiptapTableOfContentsHeading[] {
    const headings: TiptapTableOfContentsHeading[] = [];

    function visit(node: unknown) {
        if (!isRecord(node)) return;

        if (node.type === 'heading') {
            const attrs = isRecord(node.attrs) ? node.attrs : {};
            const level = typeof attrs.level === 'number' ? attrs.level : 1;
            const text = getTextContent(node).replace(/\s+/g, ' ').trim();

            if (text) {
                headings.push({
                    level: Math.min(6, Math.max(1, Math.round(level))),
                    text,
                });
            }
        }

        if (Array.isArray(node.content)) {
            node.content.forEach(visit);
        }
    }

    visit(content);
    return headings;
}

function createTextParagraph(text: string): TiptapJsonNode {
    return {
        type: 'paragraph',
        content: [{ type: 'text', text }],
    };
}

function createTocLine(heading: TiptapTableOfContentsHeading): TiptapJsonNode {
    const indent = Math.max(0, heading.level - 1) * 24;

    return {
        type: 'paragraph',
        attrs: {
            leftIndent: indent,
            firstLineIndent: 0,
            tabStops: [{ position: 480, align: 'right' }],
        },
        content: [
            { type: 'text', text: heading.text },
            { type: 'text', text: '\t' },
        ],
    };
}

/**
 * Creates insertable TipTap nodes for a static table of contents.
 *
 * @param content - Current TipTap JSON document.
 * @returns Nodes ready for `editor.commands.insertContent`.
 */
export function createTableOfContentsNodes(content: TiptapJsonNode): TiptapJsonNode[] {
    const headings = extractTableOfContentsHeadings(content);

    if (headings.length === 0) {
        return [
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Table of contents' }],
            },
            createTextParagraph('Add headings to build a table of contents.'),
        ];
    }

    return [
        {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Table of contents' }],
        },
        ...headings.map(createTocLine),
    ];
}
