/**
 * Builds editable DOCX files from the rendered document editor.
 *
 * The PDF exporter intentionally captures pixels, but DOCX export must preserve
 * user data as Word paragraphs, tables, lists, and inline text formatting.
 */
'use client';

import {
    createDocxPageProperties,
} from '@/lib/document-layout-export-parity';
import { readDocumentLayoutFromElement } from '@/lib/document-layout';
import type { DocumentHeaderFooter } from '@/lib/document-layout';
import {
    BULLET_LIST_REFERENCE_BY_STYLE,
    ORDERED_LIST_REFERENCE_BY_STYLE,
} from '@/lib/editor-list-style';
import type { OrderedListStyle } from '@/constants';
import { convertEditorDomToDocxDocumentContent } from './export-document-docx-dom';

type DocxModule = typeof import('docx');
function getEditorElement(rootEl: HTMLElement) {
    const editorEl = rootEl.querySelector('.ProseMirror');
    if (!(editorEl instanceof HTMLElement)) {
        throw new Error('Could not find editable document content for DOCX export.');
    }

    return editorEl;
}

function getLayoutElement(rootEl: HTMLElement) {
    const layoutEl = rootEl.querySelector('.tiptap-editor-paper');
    return layoutEl instanceof HTMLElement ? layoutEl : rootEl;
}

function getBulletMarker(reference: string) {
    if (reference === BULLET_LIST_REFERENCE_BY_STYLE.circle) return '◦';
    if (reference === BULLET_LIST_REFERENCE_BY_STYLE.square) return '▪';
    return '•';
}

function getOrderedLevelFormat(style: OrderedListStyle, docx: DocxModule) {
    if (style === 'lower-alpha') return docx.LevelFormat.LOWER_LETTER;
    if (style === 'upper-alpha') return docx.LevelFormat.UPPER_LETTER;
    if (style === 'lower-roman') return docx.LevelFormat.LOWER_ROMAN;
    if (style === 'upper-roman') return docx.LevelFormat.UPPER_ROMAN;
    return docx.LevelFormat.DECIMAL;
}

function createNumberingLevels(docx: DocxModule, config: {
    format: 'bullet' | 'ordered';
    reference: string;
    orderedStyle?: OrderedListStyle;
}) {
    return Array.from({ length: 6 }, (_, level) => ({
        level,
        format: config.format === 'bullet'
            ? docx.LevelFormat.BULLET
            : getOrderedLevelFormat(config.orderedStyle ?? 'decimal', docx),
        text: config.format === 'bullet' ? getBulletMarker(config.reference) : `%${level + 1}.`,
        alignment: docx.AlignmentType.LEFT,
        suffix: docx.LevelSuffix.TAB,
        style: {
            paragraph: {
                indent: {
                    left: 720 + level * 360,
                    hanging: 360,
                },
            },
        },
    }));
}

function createNumberingConfig(docx: DocxModule) {
    return {
        config: [
            ...Object.values(BULLET_LIST_REFERENCE_BY_STYLE).map((reference) => ({
                reference,
                levels: createNumberingLevels(docx, { format: 'bullet', reference }),
            })),
            ...Object.entries(ORDERED_LIST_REFERENCE_BY_STYLE).map(([style, reference]) => ({
                reference,
                levels: createNumberingLevels(docx, {
                    format: 'ordered',
                    reference,
                    orderedStyle: style as OrderedListStyle,
                }),
            })),
        ],
    };
}

function createPageProperties(rootEl: HTMLElement) {
    const layout = readDocumentLayoutFromElement(getLayoutElement(rootEl));

    return createDocxPageProperties(layout);
}

function readHeaderFooter(rootEl: HTMLElement): DocumentHeaderFooter {
    const defaults = readDocumentLayoutFromElement(getLayoutElement(rootEl)).headerFooter;
    const frameEl = rootEl.matches('[data-document-export-root="true"]')
        ? rootEl
        : rootEl.closest('[data-document-export-root="true"]');

    if (!(frameEl instanceof HTMLElement)) return defaults;

    return {
        headerEnabled: frameEl.dataset.documentHeaderEnabled !== 'false',
        footerEnabled: frameEl.dataset.documentFooterEnabled !== 'false',
        pageNumbersEnabled: frameEl.dataset.documentPageNumbersEnabled !== 'false',
        headerText: frameEl.dataset.documentHeaderText ?? defaults.headerText,
        footerText: frameEl.dataset.documentFooterText ?? defaults.footerText,
    };
}

function createHeader(text: string, includePageNumber: boolean, docx: DocxModule) {
    return new docx.Header({
        children: [
            new docx.Paragraph({
                children: [
                    new docx.TextRun(text),
                    ...(includePageNumber
                        ? [
                            new docx.TextRun({ text: '\tPage ' }),
                            new docx.TextRun({ children: [docx.PageNumber.CURRENT] }),
                        ]
                        : []),
                ],
            }),
        ],
    });
}

function createFooter(text: string, includePageNumber: boolean, docx: DocxModule) {
    return new docx.Footer({
        children: [
            new docx.Paragraph({
                children: [
                    new docx.TextRun(text),
                    ...(includePageNumber
                        ? [
                            new docx.TextRun({ text: '\tPage ' }),
                            new docx.TextRun({ children: [docx.PageNumber.CURRENT] }),
                            new docx.TextRun({ text: ' of ' }),
                            new docx.TextRun({ children: [docx.PageNumber.TOTAL_PAGES] }),
                        ]
                        : []),
                ],
            }),
        ],
    });
}

function createSectionChrome(rootEl: HTMLElement, docx: DocxModule) {
    const headerFooter = readHeaderFooter(rootEl);

    return {
        ...(headerFooter.headerEnabled
            ? { headers: { default: createHeader(headerFooter.headerText, headerFooter.pageNumbersEnabled, docx) } }
            : {}),
        ...(headerFooter.footerEnabled
            ? { footers: { default: createFooter(headerFooter.footerText, headerFooter.pageNumbersEnabled, docx) } }
            : {}),
    };
}

/**
 * Creates an editable DOCX blob from the live document paper element.
 */
export async function createEditableDocxBlob(rootEl: HTMLElement) {
    const docx = await import('docx');
    const editorEl = getEditorElement(rootEl);
    const { children, footnotes } = convertEditorDomToDocxDocumentContent(editorEl, docx);
    const document = new docx.Document({
        numbering: createNumberingConfig(docx),
        ...(Object.keys(footnotes).length > 0 ? { footnotes } : {}),
        sections: [
            {
                properties: createPageProperties(rootEl),
                ...createSectionChrome(rootEl, docx),
                children,
            },
        ],
    });

    return docx.Packer.toBlob(document);
}
