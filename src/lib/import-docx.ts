/**
 * import-docx.ts
 *
 * Converts a .docx File into a TipTap JSON document using mammoth for the
 * DOCX → HTML step and TipTap's generateJSON for the HTML → JSON step.
 *
 * Only the extensions registered in the editor are included here so that the
 * resulting JSON is always valid for the current schema. Unsupported formatting
 * (custom fonts, images, text boxes) is silently dropped — this matches the
 * behaviour of Google Docs and Notion imports.
 */

import { generateJSON } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontFamily } from '@tiptap/extension-text-style';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { ListStyleExtension } from '@/store/editor/list-style-extension';
import { ParagraphLayoutExtension } from '@/store/editor/paragraph-layout-extension';
import { SignatureBlockExtension } from '@/store/editor/signature-block-extension';
import { StyledTableCell, StyledTableHeader } from '@/store/editor/table-cell-style-extension';
import { normalizeEditorLinkUrl } from '@/lib/editor-link';
import {
    annotateImportedDocxHtml,
    collectImportedParagraphLayouts,
    extractParagraphListStylesFromDocxXml,
    extractParagraphPageBreaksFromDocumentXml,
    extractParagraphTabStopsFromDocumentXml,
    mergeParagraphPageBreaksIntoLayouts,
    mergeParagraphTabStopsIntoLayouts,
} from '@/lib/import-docx-layout';

/**
 * The subset of TipTap extensions used when parsing imported HTML.
 * Must stay in sync with the extensions list in RichTextEditor.tsx.
 * Placeholder and CharacterCount are output-only — they don't affect parsing.
 */
const IMPORT_EXTENSIONS = [
    StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: { languageClassPrefix: 'language-' },
        link: false,
    }),
    TextStyle,
    FontFamily,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: true }),
    TableRow,
    StyledTableHeader,
    StyledTableCell,
    Highlight.configure({ multicolor: false }),
    Image.configure({
        allowBase64: false,
        inline: false,
        HTMLAttributes: {
            loading: 'lazy',
            decoding: 'async',
        },
    }),
    Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        isAllowedUri: (url) => normalizeEditorLinkUrl(url ?? '').ok,
        HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
        },
    }),
    ListStyleExtension,
    ParagraphLayoutExtension,
    SignatureBlockExtension,
];

/**
 * Style map rules passed to mammoth.
 * These map Word paragraph styles to semantic HTML so TipTap can parse them
 * correctly. Alignment styles are preserved via inline HTML attributes.
 */
const MAMMOTH_STYLE_MAP = [
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Heading 4'] => h4:fresh",
    "p[style-name='Heading 5'] => h5:fresh",
    "p[style-name='Heading 6'] => h6:fresh",
    "p[style-name='Title']     => h1:fresh",
    "p[style-name='Subtitle']  => h2:fresh",
];

export interface ImportResult {
    /** TipTap-compatible JSON document. */
    content: Record<string, unknown>;
    /** Suggested document title derived from the filename. */
    title: string;
}

async function readXmlPartsFromDocx(arrayBuffer: ArrayBuffer) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = zip.file('word/document.xml');
    const numberingXml = zip.file('word/numbering.xml');

    return {
        documentXml: documentXml ? await documentXml.async('text') : null,
        numberingXml: numberingXml ? await numberingXml.async('text') : null,
    };
}

/**
 * Converts a .docx File to a TipTap JSON document.
 *
 * Mammoth is dynamically imported so it stays out of the initial JS bundle
 * — it only loads when the user actually triggers a file import.
 *
 * @throws {Error} If the file is not a .docx, cannot be read, or cannot be parsed.
 */
export async function importDocxToTiptap(file: File): Promise<ImportResult> {
    if (!file.name.match(/\.docx?$/i)) {
        throw new Error('Only .docx files are supported.');
    }

    // Dynamic import keeps mammoth (~500 kB) out of the initial bundle.
    const mammoth = await import('mammoth');

    const arrayBuffer = await file.arrayBuffer();
    const { documentXml, numberingXml } = await readXmlPartsFromDocx(arrayBuffer);
    const paragraphTabStops = documentXml
        ? extractParagraphTabStopsFromDocumentXml(documentXml)
        : [];
    const paragraphPageBreaks = documentXml
        ? extractParagraphPageBreaksFromDocumentXml(documentXml)
        : [];
    const paragraphListStyles = documentXml
        ? extractParagraphListStylesFromDocxXml(documentXml, numberingXml)
        : [];

    let paragraphLayouts = collectImportedParagraphLayouts(null);

    const { value: rawHtml } = await mammoth.convertToHtml(
        { arrayBuffer },
        {
            styleMap: MAMMOTH_STYLE_MAP,
            transformDocument: (document) => {
                paragraphLayouts = mergeParagraphPageBreaksIntoLayouts(
                    mergeParagraphTabStopsIntoLayouts(
                        collectImportedParagraphLayouts(document),
                        paragraphTabStops,
                    ),
                    paragraphPageBreaks,
                );
                return document;
            },
        },
    );
    const html = annotateImportedDocxHtml(rawHtml, paragraphLayouts, paragraphListStyles);

    if (!html.trim()) {
        throw new Error('The document appears to be empty or could not be parsed.');
    }

    const content = generateJSON(html, IMPORT_EXTENSIONS) as Record<string, unknown>;

    // Strip the .docx extension and replace underscores/hyphens with spaces
    // to produce a clean default title the user can edit after import.
    const title = file.name
        .replace(/\.docx?$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim() || 'Imported Document';

    return { content, title };
}
