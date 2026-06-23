/**
 * Applies visual geometry for schema-backed and automatic page breaks.
 *
 * Page-break state is persisted in TipTap node attributes, while automatic
 * page offsets are temporary render data. These helpers only set CSS variables
 * on the rendered DOM so live editing and PDF capture avoid page chrome without
 * mutating document JSON.
 */
import {
    calculateTiptapPageBlockOffset,
    createTiptapPageGeometry,
    isTiptapPageBlockOverflowing,
    type TiptapPageGeometryInput,
} from '@/lib/tiptap/tiptap-page-geometry';

const PAGE_BREAK_BEFORE_SELECTOR = '[data-page-break-before="true"]';
const PAGE_BREAK_OFFSET_VAR = '--document-page-break-before-offset';
const PAGE_AUTO_OFFSET_VAR = '--document-page-auto-offset';
const PAGE_OVERFLOW_ATTR = 'data-document-page-overflow';
const PAGE_LAYOUT_BLOCK_SELECTOR = [
    ':scope > p',
    ':scope > h1',
    ':scope > h2',
    ':scope > h3',
    ':scope > h4',
    ':scope > h5',
    ':scope > h6',
    ':scope > ul',
    ':scope > ol',
    ':scope > table',
    ':scope > figure',
    ':scope > img',
    ':scope > .tableWrapper',
    ':scope > .document-signature-block',
    ':scope > [data-type="signature-block"]',
].join(', ');

export interface TiptapPageLayoutOffsetResult {
    manualOffsetCount: number;
    automaticOffsetCount: number;
    overflowBlockCount: number;
}

function getRelativeTop(root: HTMLElement, element: HTMLElement) {
    const rootRect = root.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    return elementRect.top - rootRect.top + root.scrollTop;
}

/**
 * Clears computed page-break offsets from rendered editor blocks.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 */
export function clearTiptapPageBreakOffsets(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>(PAGE_BREAK_BEFORE_SELECTOR).forEach((element) => {
        element.style.removeProperty(PAGE_BREAK_OFFSET_VAR);
    });
}

/**
 * Clears all computed pagination offsets from rendered editor blocks.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 */
export function clearTiptapPageLayoutOffsets(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>(PAGE_LAYOUT_BLOCK_SELECTOR).forEach((element) => {
        element.style.removeProperty(PAGE_BREAK_OFFSET_VAR);
        element.style.removeProperty(PAGE_AUTO_OFFSET_VAR);
        element.removeAttribute(PAGE_OVERFLOW_ATTR);
    });
}

/**
 * Computes CSS offsets that move break-before blocks to the next printable page.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 * @param pageHeight - Page height in CSS pixels.
 * @returns Number of blocks that received a non-zero offset.
 */
export function applyTiptapPageBreakOffsets(root: HTMLElement, pageHeight: number) {
    const result = applyTiptapPageLayoutOffsets(root, { pageHeight });

    return result.manualOffsetCount;
}

/**
 * Computes CSS offsets that keep editable blocks inside printable page regions.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 * @param input - Page geometry options for the current document layout.
 * @returns Counts for manual and automatic offsets applied during this pass.
 */
export function applyTiptapPageLayoutOffsets(
    root: HTMLElement,
    input: TiptapPageGeometryInput = {},
): TiptapPageLayoutOffsetResult {
    const geometry = createTiptapPageGeometry(input);
    const blocks = Array.from(root.querySelectorAll<HTMLElement>(PAGE_LAYOUT_BLOCK_SELECTOR));
    let manualOffsetCount = 0;
    let automaticOffsetCount = 0;
    let overflowBlockCount = 0;

    clearTiptapPageLayoutOffsets(root);

    if (blocks.length === 0 || geometry.pageHeight <= 0 || geometry.printableHeight <= 0) {
        return { manualOffsetCount, automaticOffsetCount, overflowBlockCount };
    }

    blocks.forEach((block) => {
        const manualBreak = block.getAttribute('data-page-break-before') === 'true';
        const top = getRelativeTop(root, block);
        const height = block.getBoundingClientRect().height;
        const overflowing = isTiptapPageBlockOverflowing(geometry, top, height);
        const offset = calculateTiptapPageBlockOffset(geometry, top, height, manualBreak);

        if (overflowing) {
            block.setAttribute(PAGE_OVERFLOW_ATTR, 'true');
            overflowBlockCount += 1;
        }

        if (offset <= 0) {
            return;
        }

        if (manualBreak) {
            block.style.setProperty(PAGE_BREAK_OFFSET_VAR, `${offset}px`);
            manualOffsetCount += 1;
        } else {
            block.style.setProperty(PAGE_AUTO_OFFSET_VAR, `${offset}px`);
            automaticOffsetCount += 1;
        }
    });

    return { manualOffsetCount, automaticOffsetCount, overflowBlockCount };
}
