/**
 * Reads rendered editor geometry for line-aware pagination.
 *
 * Measurement is shared by the live editor extension and the export clone so
 * both surfaces paginate from the same numbers. Nothing here mutates TipTap
 * JSON: it only reads DOM rectangles and reports where pages must break.
 */
import type {
    TiptapPageBlockLayoutInput,
    TiptapPageLineMeasurement,
} from './tiptap-page-layout-plan';

/** Blocks whose text may continue on the next page at a line boundary. */
const SPLITTABLE_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote';

/** Top-level blocks that are expanded into their list items. */
const LIST_BLOCK_SELECTOR = 'ul, ol';

/** Marks a rendered node as a pagination spacer rather than document content. */
export const PAGE_SPACER_ATTRIBUTE = 'data-document-page-spacer';

/** Class applied to every rendered pagination spacer. */
export const PAGE_SPACER_CLASS = 'document-page-spacer';

/** Class that hides spacers while a measurement pass runs. */
export const PAGE_MEASURING_CLASS = 'document-pagination-measuring';

/** Same-line tolerance in CSS pixels for grouping client rects into lines. */
const LINE_GROUP_TOLERANCE_PX = 2;

/** A measured block paired with the element it was measured from. */
export interface TiptapMeasuredPageBlock extends TiptapPageBlockLayoutInput {
    element: HTMLElement;
    lines: TiptapPageLineMeasurement[];
}

/** A DOM point at the first character of a rendered line. */
export interface TiptapLineStartPoint {
    node: Node;
    offset: number;
}

/**
 * Viewport-to-document conversion for one measurement pass.
 *
 * The editor canvas is rendered inside a zoom transform, so client rects are in
 * scaled pixels while page geometry is in unscaled CSS pixels. Every measurement
 * is divided by that scale, otherwise page seams drift as soon as a reader zooms.
 */
interface RootMeasureContext {
    originTop: number;
    scale: number;
    scrollTop: number;
}

function createRootMeasureContext(root: HTMLElement): RootMeasureContext {
    const rect = root.getBoundingClientRect();
    const measuredScale = root.offsetWidth > 0 ? rect.width / root.offsetWidth : 1;
    const scale = Number.isFinite(measuredScale) && measuredScale > 0.01 ? measuredScale : 1;

    return { originTop: rect.top, scale, scrollTop: root.scrollTop };
}

function toDocumentTop(context: RootMeasureContext, viewportTop: number) {
    return ((viewportTop - context.originTop) / context.scale) + context.scrollTop;
}

function toViewportTop(context: RootMeasureContext, documentTop: number) {
    return ((documentTop - context.scrollTop) * context.scale) + context.originTop;
}

function toDocumentLength(context: RootMeasureContext, length: number) {
    return length / context.scale;
}

/**
 * Groups a range's client rects into one measurement per rendered line.
 *
 * Inline styling and links produce several rects per visual line, so rects are
 * merged whenever their tops agree within a small tolerance.
 *
 * @param context - Measurement context for the rendered root.
 * @param rects - Client rects for the block's contents.
 * @returns Line boxes in document order, relative to the root.
 */
function groupRectsIntoLines(
    context: RootMeasureContext,
    rects: DOMRect[],
): TiptapPageLineMeasurement[] {
    const lines: TiptapPageLineMeasurement[] = [];

    rects
        .filter((rect) => rect.height > 0 || rect.width > 0)
        .sort((first, second) => first.top - second.top)
        .forEach((rect) => {
            const top = toDocumentTop(context, rect.top);
            const bottom = top + toDocumentLength(context, rect.height);
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
 * @param context - Measurement context for the rendered root.
 * @param element - Block element to measure.
 * @returns Line boxes in document order.
 */
function measureBlockLines(
    context: RootMeasureContext,
    element: HTMLElement,
): TiptapPageLineMeasurement[] {
    const range = element.ownerDocument.createRange();

    try {
        range.selectNodeContents(element);
        return groupRectsIntoLines(context, Array.from(range.getClientRects()));
    } finally {
        range.detach();
    }
}

function isSplittableElement(element: HTMLElement) {
    return element.matches(SPLITTABLE_BLOCK_SELECTOR)
        && (element.textContent?.trim().length ?? 0) > 0;
}

function isLayoutElement(node: Element): node is HTMLElement {
    return node instanceof HTMLElement && !node.hasAttribute(PAGE_SPACER_ATTRIBUTE);
}

function collectLayoutElements(root: HTMLElement): HTMLElement[] {
    return Array.from(root.children).flatMap((child) => {
        if (!isLayoutElement(child)) {
            return [];
        }

        // Lists paginate per item so a long list continues on the next page.
        if (child.matches(LIST_BLOCK_SELECTOR)) {
            const items = Array.from(child.children).filter(isLayoutElement);

            return items.length > 0 ? items : [child];
        }

        return [child];
    });
}

/**
 * Measures every paginatable block in the rendered editor root.
 *
 * Call this while spacers are hidden — see {@link PAGE_MEASURING_CLASS} — so the
 * returned coordinates describe unpaginated content.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 * @returns Measured blocks in document order.
 */
export function measureTiptapPageBlocks(root: HTMLElement): TiptapMeasuredPageBlock[] {
    const context = createRootMeasureContext(root);

    return collectLayoutElements(root).map((element) => {
        const rect = element.getBoundingClientRect();
        const splittable = isSplittableElement(element);

        return {
            element,
            top: toDocumentTop(context, rect.top),
            height: toDocumentLength(context, rect.height),
            forceNextPage: element.getAttribute('data-page-break-before') === 'true',
            splittable,
            lines: splittable ? measureBlockLines(context, element) : [],
        };
    });
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
 * @param root - Rendered editor root used as the coordinate origin.
 * @param element - Block element that owns the line.
 * @param lineTop - Line top relative to the root, as measured.
 * @returns The text node and offset starting that line, or null when unresolved.
 */
export function findTiptapLineStartPoint(
    root: HTMLElement,
    element: HTMLElement,
    lineTop: number,
): TiptapLineStartPoint | null {
    const viewportLineTop = toViewportTop(createRootMeasureContext(root), lineTop);
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
 * Creates the rendered spacer element that continues a block on the next page.
 *
 * @param ownerDocument - Document that will own the element.
 * @param height - Spacer height in CSS pixels.
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
