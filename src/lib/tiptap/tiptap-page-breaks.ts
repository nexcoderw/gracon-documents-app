/**
 * Paginates a rendered document surface for preview and export.
 *
 * The editable editor is one continuous TipTap surface. Pagination happens here,
 * on the static copy the user previews before downloading, which is the only
 * place real page surgery is safe: this code moves and splits rendered nodes,
 * which would corrupt the document model if it ran on a live ProseMirror view.
 *
 * The pass walks the document once in reading order. Each unit is measured at
 * the moment it is reached — after every earlier fix has already been applied —
 * so a placement is always decided against the true rendered position and error
 * cannot accumulate down a long document.
 */
import {
    createTiptapDocumentMetrics,
    createTiptapPageSpacerElement,
    findTiptapLineStartPoint,
    measureTiptapBlockLines,
    readTiptapDocumentBounds,
    PAGE_SPACER_ATTRIBUTE,
    type TiptapDocumentMetrics,
} from '@/lib/tiptap/tiptap-page-layout-dom';
import { resolveTiptapPlacement } from '@/lib/tiptap/tiptap-page-layout-plan';
import { splitTiptapTableAtRow } from '@/lib/tiptap/tiptap-table-pagination';
import {
    createTiptapPageGeometry,
    type TiptapPageGeometry,
    type TiptapPageGeometryInput,
} from '@/lib/tiptap/tiptap-page-geometry';

const PAGE_OVERFLOW_ATTR = 'data-document-page-overflow';

/** Blocks whose lines may be separated across a page boundary. */
const SPLITTABLE_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote';

/** Guard against a pathological document looping forever inside one unit. */
const MAX_SPLITS_PER_UNIT = 200;

export interface TiptapPaginationResult {
    /** Page count the paginated surface now occupies. */
    pageCount: number;
    /** Blocks moved to the next page whole. */
    pushedBlockCount: number;
    /** Blocks continued across a page at a line boundary. */
    lineSplitCount: number;
    /** Tables continued on a later page. */
    tableSplitCount: number;
    /** Units too tall for any page, left in place and marked. */
    overflowCount: number;
}

function createEmptyResult(): TiptapPaginationResult {
    return {
        pageCount: 1,
        pushedBlockCount: 0,
        lineSplitCount: 0,
        tableSplitCount: 0,
        overflowCount: 0,
    };
}

/**
 * Removes every pagination artifact from a rendered surface.
 *
 * @param root Rendered `.ProseMirror` element or export clone.
 */
export function clearTiptapPageLayout(root: HTMLElement) {
    root.querySelectorAll(`[${PAGE_SPACER_ATTRIBUTE}]`).forEach((spacer) => spacer.remove());
    root.querySelectorAll<HTMLElement>(`[${PAGE_OVERFLOW_ATTR}]`).forEach((element) => {
        element.removeAttribute(PAGE_OVERFLOW_ATTR);
    });
}

function insertSpacerBefore(element: Element, height: number) {
    const spacer = createTiptapPageSpacerElement(element.ownerDocument, height);
    element.parentElement?.insertBefore(spacer, element);
}

/**
 * Continues a text block on the next page at its first line that does not fit.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param geometry Normalized page geometry.
 * @param block Block being placed.
 * @returns True when a line spacer was inserted.
 */
function splitBlockAtLine(
    metrics: TiptapDocumentMetrics,
    geometry: TiptapPageGeometry,
    block: HTMLElement,
): boolean {
    const lines = measureTiptapBlockLines(metrics, block);

    for (const line of lines) {
        const placement = resolveTiptapPlacement(geometry, {
            top: line.top,
            bottom: line.bottom,
        });

        if (placement.action !== 'push' || placement.push <= 0) {
            continue;
        }

        const point = findTiptapLineStartPoint(metrics, block, line.top);
        if (!point) {
            return false;
        }

        const range = block.ownerDocument.createRange();
        try {
            range.setStart(point.node, point.offset);
            range.collapse(true);
            range.insertNode(
                createTiptapPageSpacerElement(block.ownerDocument, placement.push),
            );
        } finally {
            range.detach();
        }

        return true;
    }

    return false;
}

/**
 * Places one text or media block, continuing it across pages when it is long.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param geometry Normalized page geometry.
 * @param block Block to place.
 * @param result Running totals for the pass.
 */
function placeBlock(
    metrics: TiptapDocumentMetrics,
    geometry: TiptapPageGeometry,
    block: HTMLElement,
    result: TiptapPaginationResult,
) {
    const splittable = block.matches(SPLITTABLE_BLOCK_SELECTOR)
        && (block.textContent?.trim().length ?? 0) > 0;

    for (let attempt = 0; attempt < MAX_SPLITS_PER_UNIT; attempt += 1) {
        const bounds = readTiptapDocumentBounds(metrics, block);
        const placement = resolveTiptapPlacement(geometry, {
            top: bounds.top,
            bottom: bounds.bottom,
            forceNextPage: block.getAttribute('data-page-break-before') === 'true',
            splittable,
        });

        if (placement.action === 'keep') {
            return;
        }

        if (placement.action === 'push') {
            insertSpacerBefore(block, placement.push);
            result.pushedBlockCount += 1;

            // A pushed block can still be longer than the page it landed on.
            if (!splittable) {
                return;
            }
            continue;
        }

        if (placement.action === 'split') {
            if (!splitBlockAtLine(metrics, geometry, block)) {
                block.setAttribute(PAGE_OVERFLOW_ATTR, 'true');
                result.overflowCount += 1;
                return;
            }

            result.lineSplitCount += 1;
            continue;
        }

        block.setAttribute(PAGE_OVERFLOW_ATTR, 'true');
        result.overflowCount += 1;
        return;
    }
}

/**
 * Finds the first row of a table that crosses its page's printable bottom.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param geometry Normalized page geometry.
 * @param table Table being measured.
 * @returns The crossing row, or null when every row fits.
 */
function findFirstCrossingRow(
    metrics: TiptapDocumentMetrics,
    geometry: TiptapPageGeometry,
    table: HTMLTableElement,
): HTMLTableRowElement | null {
    for (const row of Array.from(table.rows)) {
        const bounds = readTiptapDocumentBounds(metrics, row);
        const placement = resolveTiptapPlacement(geometry, {
            top: bounds.top,
            bottom: bounds.bottom,
        });

        if (placement.action !== 'keep') {
            return row;
        }
    }

    return null;
}

/**
 * Places a table, continuing it on later pages one row boundary at a time.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param geometry Normalized page geometry.
 * @param table Table to place.
 * @param result Running totals for the pass.
 */
function placeTable(
    metrics: TiptapDocumentMetrics,
    geometry: TiptapPageGeometry,
    table: HTMLTableElement,
    result: TiptapPaginationResult,
) {
    let current: HTMLTableElement | null = table;

    for (let attempt = 0; current && attempt < MAX_SPLITS_PER_UNIT; attempt += 1) {
        const bounds = readTiptapDocumentBounds(metrics, current);
        const placement = resolveTiptapPlacement(geometry, {
            top: bounds.top,
            bottom: bounds.bottom,
            forceNextPage: current.getAttribute('data-page-break-before') === 'true',
        });

        if (placement.action === 'keep') {
            return;
        }

        if (placement.action === 'push') {
            insertSpacerBefore(current, placement.push);
            result.pushedBlockCount += 1;
            continue;
        }

        // Longer than a page: continue at the first row that crosses the page,
        // repeating the header row on the continuation table.
        const crossingRow = findFirstCrossingRow(metrics, geometry, current);
        const continuation: HTMLTableElement | null = crossingRow
            ? splitTiptapTableAtRow(current, crossingRow)
            : null;

        if (!continuation) {
            current.setAttribute(PAGE_OVERFLOW_ATTR, 'true');
            result.overflowCount += 1;
            return;
        }

        result.tableSplitCount += 1;
        current = continuation;
    }
}

/**
 * Paginates a rendered document surface in place.
 *
 * @param root Rendered `.ProseMirror` element on a static preview/export copy.
 * @param input Page geometry options for the current document layout.
 * @returns Totals describing how the document was divided into pages.
 */
export function paginateTiptapDocument(
    root: HTMLElement,
    input: TiptapPageGeometryInput = {},
): TiptapPaginationResult {
    const geometry = createTiptapPageGeometry(input);
    const result = createEmptyResult();

    clearTiptapPageLayout(root);

    if (geometry.pageHeight <= 0 || geometry.printableHeight <= 0) {
        return result;
    }

    const metrics = createTiptapDocumentMetrics(root);

    // Siblings are re-read each step because splitting a table adds one.
    let child = root.firstElementChild;
    while (child) {
        const next = child.nextElementSibling;

        if (child instanceof HTMLTableElement) {
            placeTable(metrics, geometry, child, result);
        } else if (child instanceof HTMLElement && !child.hasAttribute(PAGE_SPACER_ATTRIBUTE)) {
            placeBlock(metrics, geometry, child, result);
        }

        child = next;
    }

    result.pageCount = Math.max(
        1,
        Math.ceil((root.scrollHeight + geometry.pageGap) / geometry.pagePitch),
    );

    return result;
}
