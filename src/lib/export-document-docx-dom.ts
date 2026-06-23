/**
 * Converts the rendered Tiptap editor DOM into editable DOCX document nodes.
 *
 * This intentionally exports semantic content instead of screenshots so the
 * downloaded DOCX remains searchable, selectable, and editable in Word.
 */
'use client';

import type {
    FileChild,
    IParagraphOptions,
    IRunStylePropertiesOptions,
    Paragraph,
    ParagraphChild,
    Table as DocxTable,
} from 'docx';
import { createParagraphExportGeometry } from './document-layout-export-parity';
import { getListReferenceForElement } from './editor-list-style';
import {
    hasParagraphPageBreakBefore,
    isDocumentPageBoundaryElement,
} from './export-document-page-boundary';

type DocxModule = typeof import('docx');
type TableCellChild = Paragraph | DocxTable;

interface RunStyle {
    bold?: boolean;
    color?: string;
    font?: IRunStylePropertiesOptions['font'];
    italics?: boolean;
    shading?: IRunStylePropertiesOptions['shading'];
    size?: number;
    strike?: boolean;
    underline?: IRunStylePropertiesOptions['underline'];
}

interface DocxFootnoteExport {
    children: Paragraph[];
}

interface DocxConversionContext {
    footnoteIds: Map<string, number>;
    footnotes: Record<string, DocxFootnoteExport>;
    nextFootnoteId: number;
}

export interface DocxDocumentContent {
    children: FileChild[];
    footnotes: Record<string, DocxFootnoteExport>;
}

const CSS_PX_TO_TWIP = 15;
const MAX_LIST_LEVEL = 5;

function parseCssPx(value: string) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function cssPxToTwip(value: string) {
    return Math.max(Math.round(parseCssPx(value) * CSS_PX_TO_TWIP), 0);
}

function cssPxToHalfPoints(value: string) {
    const halfPoints = Math.round(parseCssPx(value) * 1.5);
    return halfPoints > 0 ? halfPoints : undefined;
}

function getHexColor(value: string) {
    const match = value.match(/rgba?\(([^)]+)\)/i);
    if (!match) return undefined;

    const channels = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
    const [red = 0, green = 0, blue = 0, alpha = 1] = channels;
    if (alpha <= 0.05) return undefined;

    return [red, green, blue]
        .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

function getFontFamily(value: string) {
    const [font] = value.split(',');
    return font?.replaceAll('"', '').replaceAll("'", '').trim() || undefined;
}

function getAlignment(style: CSSStyleDeclaration, docx: DocxModule) {
    if (style.textAlign === 'center') return docx.AlignmentType.CENTER;
    if (style.textAlign === 'right' || style.textAlign === 'end') return docx.AlignmentType.RIGHT;
    if (style.textAlign === 'justify') return docx.AlignmentType.JUSTIFIED;
    return undefined;
}

function getHeading(tagName: string, docx: DocxModule) {
    const levels = {
        H1: docx.HeadingLevel.HEADING_1,
        H2: docx.HeadingLevel.HEADING_2,
        H3: docx.HeadingLevel.HEADING_3,
        H4: docx.HeadingLevel.HEADING_4,
        H5: docx.HeadingLevel.HEADING_5,
        H6: docx.HeadingLevel.HEADING_6,
    };

    return levels[tagName as keyof typeof levels];
}

function mergeRunStyle(element: HTMLElement, inherited: RunStyle, docx: DocxModule): RunStyle {
    const computed = window.getComputedStyle(element);
    const next: RunStyle = { ...inherited };
    const tagName = element.tagName;
    const fontWeight = Number.parseInt(computed.fontWeight, 10);
    const color = getHexColor(computed.color);
    const background = getHexColor(computed.backgroundColor);
    const fontSize = cssPxToHalfPoints(computed.fontSize);
    const font = getFontFamily(computed.fontFamily);

    next.bold = next.bold || tagName === 'B' || tagName === 'STRONG' || fontWeight >= 600;
    next.italics = next.italics || tagName === 'I' || tagName === 'EM';
    next.strike = next.strike || tagName === 'S' || tagName === 'DEL' || tagName === 'STRIKE';
    if (tagName === 'U' || computed.textDecorationLine.includes('underline')) {
        next.underline = { type: docx.UnderlineType.SINGLE };
    }
    if (color) next.color = color;
    if (fontSize) next.size = fontSize;
    if (font) next.font = font;
    if (tagName === 'CODE') next.font = 'Courier New';
    if (background && background !== 'FFFFFF') {
        next.shading = { type: docx.ShadingType.CLEAR, fill: background };
    }

    return next;
}

function createTextRuns(text: string, style: RunStyle, docx: DocxModule) {
    const lines = text.split('\n');
    return lines.flatMap((line, index) => {
        const runs: ParagraphChild[] = [];
        if (index > 0) runs.push(new docx.TextRun({ break: 1 }));
        line.split('\t').forEach((part, partIndex) => {
            if (partIndex > 0) {
                runs.push(new docx.TextRun({ children: [new docx.Tab()] }));
            }

            if (part) {
                runs.push(new docx.TextRun({ ...style, text: part }));
            }
        });
        return runs;
    });
}

function getFootnoteReferenceId(element: HTMLElement, context: DocxConversionContext) {
    const sourceId = element.dataset.footnoteId ?? element.dataset.footnoteText ?? '';
    const key = sourceId.trim() || `footnote-${context.nextFootnoteId}`;
    const existingId = context.footnoteIds.get(key);

    if (existingId) {
        return existingId;
    }

    const id = context.nextFootnoteId;
    context.nextFootnoteId += 1;
    context.footnoteIds.set(key, id);

    return id;
}

function createFootnoteReferenceRun(
    element: HTMLElement,
    docx: DocxModule,
    context: DocxConversionContext,
): ParagraphChild[] {
    const note = element.dataset.footnoteText?.replace(/\s+/g, ' ').trim();
    if (!note) return [];

    const id = getFootnoteReferenceId(element, context);
    const key = String(id);

    if (!context.footnotes[key]) {
        context.footnotes[key] = {
            children: [
                new docx.Paragraph({
                    children: [
                        new docx.FootnoteReferenceRun(id),
                        new docx.TextRun({ text: ` ${note}` }),
                    ],
                }),
            ],
        };
    }

    return [new docx.FootnoteReferenceRun(id)];
}

function collectInlineRuns(
    nodes: Node[],
    style: RunStyle,
    docx: DocxModule,
    context: DocxConversionContext,
): ParagraphChild[] {
    return nodes.flatMap((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return createTextRuns(node.textContent ?? '', style, docx);
        }
        if (!(node instanceof HTMLElement)) return [];
        if (node.tagName === 'BR') return [new docx.TextRun({ break: 1 })];
        if (node.matches('sup[data-footnote-id][data-footnote-text]')) {
            return createFootnoteReferenceRun(node, docx, context);
        }

        const nextStyle = mergeRunStyle(node, style, docx);
        const children = collectInlineRuns(Array.from(node.childNodes), nextStyle, docx, context);
        const href = node.tagName === 'A' ? node.getAttribute('href') : null;

        if (href && children.length > 0) {
            return [new docx.ExternalHyperlink({ link: href, children })];
        }

        return children;
    });
}

function getParagraphOptions(element: HTMLElement, docx: DocxModule): Omit<IParagraphOptions, 'children'> {
    const computed = window.getComputedStyle(element);
    const pageBreakBefore = hasParagraphPageBreakBefore(element);
    const paragraphGeometry = createParagraphExportGeometry({
        leftIndent: Number.parseFloat(element.getAttribute('data-left-indent') ?? ''),
        firstLineIndent: Number.parseFloat(element.getAttribute('data-first-line-indent') ?? ''),
        lineHeight: Number.parseFloat(element.getAttribute('data-line-height') ?? ''),
        tabStops: parseTabStopsAttribute(element.getAttribute('data-tab-stops')),
    });
    const tabStops = paragraphGeometry.docxTabStops.map((tabStop) => ({
        type: getDocxTabStopType(tabStop.align, docx),
        position: tabStop.position,
    }));

    return {
        alignment: getAlignment(computed, docx),
        heading: getHeading(element.tagName, docx),
        ...(Object.keys(paragraphGeometry.docxIndentTwips).length > 0 ? { indent: paragraphGeometry.docxIndentTwips } : {}),
        ...(tabStops.length > 0 ? { tabStops } : {}),
        spacing: {
            before: cssPxToTwip(computed.marginTop),
            after: cssPxToTwip(computed.marginBottom || '8px'),
            ...(paragraphGeometry.docxLineSpacing
                ? { line: paragraphGeometry.docxLineSpacing, lineRule: docx.LineRuleType.AUTO }
                : {}),
        },
        ...(pageBreakBefore ? { pageBreakBefore: true } : {}),
        widowControl: true,
    };
}

function getDocxTabStopType(align: 'left' | 'center' | 'right' | 'decimal', docx: DocxModule) {
    if (align === 'center') return docx.TabStopType.CENTER;
    if (align === 'right') return docx.TabStopType.RIGHT;
    if (align === 'decimal') return docx.TabStopType.DECIMAL;
    return docx.TabStopType.LEFT;
}

function parseTabStopsAttribute(value: string | null) {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((position): position is number => (
            typeof position === 'number' && Number.isFinite(position)
        ));
    } catch {
        return [];
    }
}

function createParagraph(
    element: HTMLElement,
    docx: DocxModule,
    context: DocxConversionContext,
    options: Omit<IParagraphOptions, 'children'> = {},
    runStyle: RunStyle = {},
) {
    const children = collectInlineRuns(Array.from(element.childNodes), runStyle, docx, context);
    return new docx.Paragraph({
        ...getParagraphOptions(element, docx),
        ...options,
        children: children.length > 0 ? children : [new docx.TextRun('')],
    });
}

function isNestedList(node: Node): node is HTMLElement {
    return node instanceof HTMLElement && ['UL', 'OL'].includes(node.tagName);
}

function getDirectBlockElements(element: HTMLElement) {
    return Array.from(element.children).filter((child): child is HTMLElement => {
        return ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE', 'DIV'].includes(child.tagName);
    });
}

function createListParagraph(
    element: HTMLElement,
    reference: string,
    level: number,
    docx: DocxModule,
    context: DocxConversionContext,
) {
    return createParagraph(element, docx, context, {
        numbering: { reference, level: Math.min(level, MAX_LIST_LEVEL) },
        spacing: { after: 80 },
    });
}

function convertListItem(
    itemEl: HTMLElement,
    reference: string,
    level: number,
    docx: DocxModule,
    context: DocxConversionContext,
): FileChild[] {
    const nestedLists = Array.from(itemEl.children).filter(isNestedList);
    const contentBlocks = getDirectBlockElements(itemEl).filter((child) => !isNestedList(child));
    const firstBlock = contentBlocks[0] ?? itemEl;
    const paragraphs: FileChild[] = [createListParagraph(firstBlock, reference, level, docx, context)];

    contentBlocks.slice(1).forEach((block) => {
        paragraphs.push(createParagraph(block, docx, context, {
            indent: { left: (level + 1) * 360 },
            spacing: { after: 80 },
        }));
    });

    nestedLists.forEach((list) => {
        paragraphs.push(...convertList(list, level + 1, docx, context));
    });

    return paragraphs;
}

function convertList(
    listEl: HTMLElement,
    level: number,
    docx: DocxModule,
    context: DocxConversionContext,
): FileChild[] {
    const reference = getListReferenceForElement(listEl);
    const items = Array.from(listEl.children).filter((child): child is HTMLElement => child.tagName === 'LI');

    return items.flatMap((item) => convertListItem(item, reference, level, docx, context));
}

function getTableCellChildren(
    cellEl: HTMLElement,
    docx: DocxModule,
    context: DocxConversionContext,
): TableCellChild[] {
    const blockChildren = getDirectBlockElements(cellEl);
    const children = blockChildren.length > 0
        ? blockChildren.flatMap((block) => convertBlock(block, docx, context))
        : [createParagraph(cellEl, docx, context, { spacing: { after: 0 } })];

    return children.filter((child): child is TableCellChild => {
        return child instanceof docx.Paragraph || child instanceof docx.Table;
    });
}

function getCellBorder(style: CSSStyleDeclaration, side: 'Top' | 'Right' | 'Bottom' | 'Left', docx: DocxModule) {
    const width = parseCssPx(style[`border${side}Width` as keyof CSSStyleDeclaration] as string);
    const color = getHexColor(style[`border${side}Color` as keyof CSSStyleDeclaration] as string) ?? '111827';

    if (width <= 0) {
        return { style: docx.BorderStyle.NIL, size: 0, color };
    }

    return {
        style: docx.BorderStyle.SINGLE,
        size: Math.max(2, Math.round(width * 6)),
        color,
    };
}

function getTableCellBorders(cellEl: HTMLElement, docx: DocxModule) {
    const style = window.getComputedStyle(cellEl);

    return {
        top: getCellBorder(style, 'Top', docx),
        right: getCellBorder(style, 'Right', docx),
        bottom: getCellBorder(style, 'Bottom', docx),
        left: getCellBorder(style, 'Left', docx),
    };
}

function convertTable(tableEl: HTMLElement, docx: DocxModule, context: DocxConversionContext) {
    const rows = Array.from(tableEl.querySelectorAll('tr')).map((rowEl) => {
        const cells = Array.from(rowEl.children).filter((child): child is HTMLElement => {
            return ['TD', 'TH'].includes(child.tagName);
        });

        return new docx.TableRow({
            cantSplit: true,
            children: cells.map((cellEl) => {
                const background = getHexColor(window.getComputedStyle(cellEl).backgroundColor);

                return new docx.TableCell({
                    children: getTableCellChildren(cellEl, docx, context),
                    shading: background && background !== 'FFFFFF'
                        ? { type: docx.ShadingType.CLEAR, fill: background }
                        : undefined,
                    borders: getTableCellBorders(cellEl, docx),
                    margins: { top: 120, right: 140, bottom: 120, left: 140 },
                    width: { size: Math.floor(100 / Math.max(cells.length, 1)), type: docx.WidthType.PERCENTAGE },
                });
            }),
        });
    });

    return new docx.Table({
        rows,
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        layout: docx.TableLayoutType.FIXED,
    });
}

function convertBlock(element: HTMLElement, docx: DocxModule, context: DocxConversionContext): FileChild[] {
    if (isDocumentPageBoundaryElement(element)) {
        return [new docx.Paragraph({ pageBreakBefore: true })];
    }
    if (element.classList.contains('tableWrapper')) {
        const table = element.querySelector('table');
        return table instanceof HTMLElement ? [convertTable(table, docx, context)] : [];
    }
    if (element.tagName === 'TABLE') return [convertTable(element, docx, context)];
    if (['UL', 'OL'].includes(element.tagName)) return convertList(element, 0, docx, context);
    if (element.tagName === 'HR') return [new docx.Paragraph({ thematicBreak: true })];
    if (element.tagName === 'BLOCKQUOTE') {
        return [createParagraph(element, docx, context, {
            indent: { left: 360 },
            shading: { type: docx.ShadingType.CLEAR, fill: 'F4F1FF' },
        })];
    }

    return [createParagraph(element, docx, context)];
}

/**
 * Converts the editor content element into editable DOCX content and footnotes.
 */
export function convertEditorDomToDocxDocumentContent(
    editorEl: HTMLElement,
    docx: DocxModule,
): DocxDocumentContent {
    const context: DocxConversionContext = {
        footnoteIds: new Map(),
        footnotes: {},
        nextFootnoteId: 1,
    };
    const children = Array.from(editorEl.children).flatMap((child) => {
        return child instanceof HTMLElement ? convertBlock(child, docx, context) : [];
    });

    return {
        children: children.length > 0 ? children : [new docx.Paragraph('')],
        footnotes: context.footnotes,
    };
}

/**
 * Converts the editor content element into editable DOCX paragraphs and tables.
 */
export function convertEditorDomToDocxChildren(editorEl: HTMLElement, docx: DocxModule): FileChild[] {
    return convertEditorDomToDocxDocumentContent(editorEl, docx).children;
}
