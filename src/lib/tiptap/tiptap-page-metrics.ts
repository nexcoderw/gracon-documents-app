/**
 * Measures live TipTap document content for page status and outline UI.
 *
 * These helpers read rendered editor geometry only. They must not mutate
 * TipTap JSON or become the persistence model for future manual page breaks.
 */
export interface TiptapPageMetric {
    pageNumber: number;
    top: number;
    bottom: number;
    blockCount: number;
    headingCount: number;
    overflow: boolean;
}

export interface TiptapOutlineMetric {
    id: string;
    label: string;
    page: number;
    top: number;
}

export interface TiptapPaginationMetrics {
    pageCount: number;
    activePage: number;
    pages: TiptapPageMetric[];
    outline: TiptapOutlineMetric[];
    measuredAt: number;
}

export interface MeasureTiptapPaginationOptions {
    pageHeight: number;
    pageGap: number;
    contentHeight: number;
}

const PAGE_BLOCK_SELECTOR = ':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > table, :scope > figure, :scope > img, :scope > .document-signature-block, :scope > [data-type="signature-block"], :scope > [data-type="page-break"]';
const PAGE_BLOCK_CLOSEST_SELECTOR = 'p, h1, h2, h3, ul, ol, table, figure, img, .document-signature-block, [data-type="signature-block"], [data-type="page-break"]';
const HEADING_SELECTOR = 'h1, h2, h3';

function clampPage(page: number, pageCount: number) {
    return Math.min(Math.max(1, page), Math.max(1, pageCount));
}

function getRelativeTop(root: HTMLElement, element: HTMLElement) {
    const rootRect = root.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    return elementRect.top - rootRect.top + root.scrollTop;
}

function getElementPage(root: HTMLElement, element: HTMLElement, pagePitch: number, pageCount: number) {
    const top = getRelativeTop(root, element);
    return clampPage(Math.floor(top / pagePitch) + 1, pageCount);
}

function getActivePage(root: HTMLElement, pagePitch: number, pageCount: number) {
    const selection = root.ownerDocument.getSelection();
    const anchorNode = selection?.anchorNode;

    if (!anchorNode || !root.contains(anchorNode)) {
        return 1;
    }

    const anchorElement = anchorNode.nodeType === Node.ELEMENT_NODE
        ? anchorNode as HTMLElement
        : anchorNode.parentElement;
    const selectedBlock = anchorElement?.closest<HTMLElement>(PAGE_BLOCK_CLOSEST_SELECTOR);

    if (selectedBlock && root.contains(selectedBlock)) {
        return getElementPage(root, selectedBlock, pagePitch, pageCount);
    }

    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    if (rect && rect.height > 0) {
        const rootRect = root.getBoundingClientRect();
        return clampPage(Math.floor((rect.top - rootRect.top + root.scrollTop) / pagePitch) + 1, pageCount);
    }

    return 1;
}

/**
 * Creates stable fallback metrics before the editor DOM is ready.
 *
 * @returns A single-page empty metrics object for initial render.
 */
export function createEmptyTiptapPaginationMetrics(): TiptapPaginationMetrics {
    return {
        pageCount: 1,
        activePage: 1,
        pages: [{
            pageNumber: 1,
            top: 0,
            bottom: 0,
            blockCount: 0,
            headingCount: 0,
            overflow: false,
        }],
        outline: [],
        measuredAt: 0,
    };
}

/**
 * Measures page counts, active page, per-page block totals, and headings.
 *
 * @param root - Rendered `.ProseMirror` editor element.
 * @param options - Page height, gap, and content-height limits in CSS pixels.
 * @returns Pagination metrics derived from the rendered editor DOM.
 */
export function measureTiptapPagination(
    root: HTMLElement,
    options: MeasureTiptapPaginationOptions,
): TiptapPaginationMetrics {
    const pagePitch = options.pageHeight + options.pageGap;
    const pageCount = Math.max(1, Math.ceil((root.scrollHeight + options.pageGap) / pagePitch));
    const pages = Array.from({ length: pageCount }, (_, index): TiptapPageMetric => ({
        pageNumber: index + 1,
        top: index * pagePitch,
        bottom: (index * pagePitch) + options.pageHeight,
        blockCount: 0,
        headingCount: 0,
        overflow: false,
    }));
    const outline: TiptapOutlineMetric[] = [];
    const blocks = Array.from(root.querySelectorAll<HTMLElement>(PAGE_BLOCK_SELECTOR));

    blocks.forEach((block, index) => {
        const pageNumber = getElementPage(root, block, pagePitch, pageCount);
        const page = pages[pageNumber - 1];
        const top = getRelativeTop(root, block);
        const bottom = top + block.getBoundingClientRect().height;
        const pageContentBottom = page.top + options.contentHeight;
        const isHeading = block.matches(HEADING_SELECTOR);

        page.blockCount += 1;
        page.headingCount += isHeading ? 1 : 0;
        page.overflow = page.overflow || bottom > pageContentBottom || block.getBoundingClientRect().height > options.contentHeight;

        if (isHeading) {
            const label = block.textContent?.replace(/\s+/g, ' ').trim();
            if (label) {
                outline.push({
                    id: block.id || `rendered-heading-${index + 1}`,
                    label,
                    page: pageNumber,
                    top,
                });
            }
        }
    });

    return {
        pageCount,
        activePage: getActivePage(root, pagePitch, pageCount),
        pages,
        outline,
        measuredAt: Date.now(),
    };
}
