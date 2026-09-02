/**
 * Reads rendered document geometry for pagination.
 *
 * Everything here is measurement only: it converts client rects into document
 * coordinates and locates the DOM point where a rendered line begins. It never
 * mutates TipTap JSON.
 *
 * Coordinates are measured against the frame that owns the stacked page
 * surfaces, not the editor root, because page tops are absolute positions inside
 * that frame — measuring from anywhere else shifts every page seam. Client rects
 * also arrive in zoom-scaled pixels while page geometry is in CSS pixels, so
 * every reading is divided by the measured scale.
 */

/** Attribute marking a rendered node as a pagination spacer. */
export const PAGE_SPACER_ATTRIBUTE = 'data-document-page-spacer';

/** Class applied to every rendered pagination spacer. */
export const PAGE_SPACER_CLASS = 'document-page-spacer';

/** The frame the stacked page surfaces are positioned inside. */
const PAGE_FRAME_SELECTOR = '[data-document-export-root="true"]';

/** Same-line tolerance in CSS pixels for grouping client rects into lines. */
const LINE_GROUP_TOLERANCE_PX = 2;

/** Coordinate conversion for one rendered document surface. */
export interface TiptapDocumentMetrics {
    /** Viewport offset of the document origin. */
    originTop: number;
    /** Zoom scale applied to the rendered frame. */
    scale: number;
}

/** Vertical bounds of a rendered element, in document coordinates. */
export interface TiptapDocumentBounds {
    top: number;
    bottom: number;
}

/** One rendered line box inside a block. */
export interface TiptapLineMeasurement {
    top: number;
    bottom: number;
}

/** A DOM point at the first character of a rendered line. */
export interface TiptapLineStartPoint {
    node: Node;
    offset: number;
}

/**
 * Captures the coordinate conversion for a rendered surface.
 *
 * @param root Rendered `.ProseMirror` element.
 * @returns Metrics for converting client rects into document coordinates.
 */
export function createTiptapDocumentMetrics(root: HTMLElement): TiptapDocumentMetrics {
    const frame = root.closest<HTMLElement>(PAGE_FRAME_SELECTOR) ?? root;
    const rect = frame.getBoundingClientRect();
    const measuredScale = frame.offsetWidth > 0 ? rect.width / frame.offsetWidth : 1;
    const scale = Number.isFinite(measuredScale) && measuredScale > 0.01 ? measuredScale : 1;

    return { originTop: rect.top, scale };
}

function toDocumentTop(metrics: TiptapDocumentMetrics, viewportTop: number) {
    return (viewportTop - metrics.originTop) / metrics.scale;
}

function toViewportTop(metrics: TiptapDocumentMetrics, documentTop: number) {
    return (documentTop * metrics.scale) + metrics.originTop;
}

/**
 * Reads an element's current vertical bounds in document coordinates.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param element Element to measure.
 * @returns The element's top and bottom.
 */
export function readTiptapDocumentBounds(
    metrics: TiptapDocumentMetrics,
    element: Element,
): TiptapDocumentBounds {
    const rect = element.getBoundingClientRect();

    return {
        top: toDocumentTop(metrics, rect.top),
        bottom: toDocumentTop(metrics, rect.bottom),
    };
}

/**
 * Groups a range's client rects into one measurement per rendered line.
 *
 * Inline styling and links produce several rects per visual line, so rects are
 * merged whenever their tops agree within a small tolerance.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param rects Client rects for a block's contents.
 * @returns Line boxes in document order.
 */
function groupRectsIntoLines(
    metrics: TiptapDocumentMetrics,
    rects: DOMRect[],
): TiptapLineMeasurement[] {
    const lines: TiptapLineMeasurement[] = [];

    rects
        .filter((rect) => rect.height > 0 || rect.width > 0)
        .sort((first, second) => first.top - second.top)
        .forEach((rect) => {
            const top = toDocumentTop(metrics, rect.top);
            const bottom = toDocumentTop(metrics, rect.bottom);
            const current = lines[lines.length - 1];

            if (current && Math.abs(current.top - top) <= LINE_GROUP_TOLERANCE_PX) {
                current.top = Math.min(current.top, top);
                current.bottom = Math.max(current.bottom, bottom);
                return;
            }

            lines.push({ top, bottom });
        });

    return lines;
}

/**
 * Measures the rendered line boxes inside one block element.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param element Block element to measure.
 * @returns Line boxes in document order.
 */
export function measureTiptapBlockLines(
    metrics: TiptapDocumentMetrics,
    element: HTMLElement,
): TiptapLineMeasurement[] {
    const range = element.ownerDocument.createRange();

    try {
        range.selectNodeContents(element);
        return groupRectsIntoLines(metrics, Array.from(range.getClientRects()));
    } finally {
        range.detach();
    }
}

function collectTextNodes(element: HTMLElement): Text[] {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;

        if (node instanceof Text && node.length > 0) {
            nodes.push(node);
        }
    }

    return nodes;
}

function getCharacterTop(range: Range, node: Text, offset: number) {
    range.setStart(node, offset);
    range.setEnd(node, Math.min(offset + 1, node.length));

    return range.getBoundingClientRect().top;
}

/**
 * Finds the DOM point where a rendered line begins inside a block.
 *
 * Character tops increase monotonically through a block, so the first character
 * at or below the line's top is found by binary search instead of walking every
 * character of a long paragraph.
 *
 * @param metrics Coordinate conversion for the surface.
 * @param element Block element that owns the line.
 * @param lineTop Line top in document coordinates.
 * @returns The text node and offset starting that line, or null when unresolved.
 */
export function findTiptapLineStartPoint(
    metrics: TiptapDocumentMetrics,
    element: HTMLElement,
    lineTop: number,
): TiptapLineStartPoint | null {
    const viewportLineTop = toViewportTop(metrics, lineTop);
    const range = element.ownerDocument.createRange();

    try {
        for (const node of collectTextNodes(element)) {
            const lastTop = getCharacterTop(range, node, Math.max(0, node.length - 1));

            if (lastTop < viewportLineTop - LINE_GROUP_TOLERANCE_PX) {
                continue;
            }

            let low = 0;
            let high = node.length - 1;

            while (low < high) {
                const middle = Math.floor((low + high) / 2);
                const top = getCharacterTop(range, node, middle);

                if (top < viewportLineTop - LINE_GROUP_TOLERANCE_PX) {
                    low = middle + 1;
                } else {
                    high = middle;
                }
            }

            return { node, offset: low };
        }
    } finally {
        range.detach();
    }

    return null;
}

/**
 * Creates the spacer element that continues content on the next page.
 *
 * @param ownerDocument Document that will own the element.
 * @param height Spacer height in CSS pixels.
 * @returns A non-editable block-level spacer element.
 */
export function createTiptapPageSpacerElement(ownerDocument: Document, height: number) {
    const spacer = ownerDocument.createElement('span');

    spacer.className = PAGE_SPACER_CLASS;
    spacer.setAttribute(PAGE_SPACER_ATTRIBUTE, 'true');
    spacer.setAttribute('contenteditable', 'false');
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.height = `${Math.max(0, Math.round(height))}px`;

    return spacer;
}
