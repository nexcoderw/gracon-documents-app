/**
 * Reads rendered editor geometry for line-aware pagination.
 *
 * Measurement is shared by the live editor extension and the export clone so
 * both surfaces paginate from the same numbers. Nothing here mutates TipTap
 * JSON: it only reads DOM rectangles and reports where pages must break.
 */
import {
    planTiptapPageOffsetCorrections,
    type TiptapPageBlockLayoutInput,
    type TiptapPageLineMeasurement,
} from './tiptap-page-layout-plan';

/** Blocks whose text may continue on the next page at a line boundary. */
const SPLITTABLE_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote';

/** Top-level blocks that are expanded into their list items. */
const LIST_BLOCK_SELECTOR = 'ul, ol';

/** Top-level blocks that are expanded into their rows. */
const TABLE_BLOCK_SELECTOR = 'table';

/** Class that offsets a table row into the next printable region. */
export const PAGE_ROW_OFFSET_CLASS = 'document-page-row-offset';

/** Custom property carrying a row's offset to its cells. */
export const PAGE_ROW_OFFSET_VAR = '--document-page-row-offset';

/** Identifies which planned offset a rendered row came from. */
export const PAGE_ROW_KEY_ATTRIBUTE = 'data-document-page-row-key';

/** The frame the stacked page surfaces are positioned inside. */
const PAGE_FRAME_SELECTOR = '[data-document-export-root="true"]';

/** Marks a rendered node as a pagination spacer rather than document content. */
export const PAGE_SPACER_ATTRIBUTE = 'data-document-page-spacer';

/** Class applied to every rendered pagination spacer. */
export const PAGE_SPACER_CLASS = 'document-page-spacer';

/** Identifies which planned spacer a rendered element came from. */
export const PAGE_SPACER_KEY_ATTRIBUTE = 'data-document-page-spacer-key';

/** Pixel difference below which a rendered offset counts as correct. */
const OFFSET_CORRECTION_TOLERANCE_PX = 1;

/** Class that hides spacers while a measurement pass runs. */
export const PAGE_MEASURING_CLASS = 'document-pagination-measuring';

/** Same-line tolerance in CSS pixels for grouping client rects into lines. */
const LINE_GROUP_TOLERANCE_PX = 2;

/** How a block's offset has to be applied to the rendered DOM. */
export type TiptapPageOffsetMode = 'spacer' | 'row-padding';

/** A measured block paired with the element it was measured from. */
export interface TiptapMeasuredPageBlock extends TiptapPageBlockLayoutInput {
    element: HTMLElement;
    lines: TiptapPageLineMeasurement[];
    /**
     * Table rows cannot host a spacer element — a stray node between rows is
     * pulled out of the table by the HTML parser — so they are offset by padding
     * their cells instead.
     */
    offsetMode: TiptapPageOffsetMode;
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

/**
 * Finds the element the stacked page surfaces are positioned against.
 *
 * Page tops are absolute positions inside the document frame, so measuring from
 * the editor root instead would shift every seam by the chrome between them.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 * @returns The page frame, or the root when no frame is present.
 */
function getPageOriginElement(root: HTMLElement): HTMLElement {
    const frame = root.closest<HTMLElement>(PAGE_FRAME_SELECTOR);
    return frame ?? root;
}

function createRootMeasureContext(root: HTMLElement): RootMeasureContext {
    const origin = getPageOriginElement(root);
    const rect = origin.getBoundingClientRect();
    const measuredScale = origin.offsetWidth > 0 ? rect.width / origin.offsetWidth : 1;
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

        // Tables paginate per row so a long table continues on the next page.
        if (child.matches(TABLE_BLOCK_SELECTOR)) {
            const rows = Array.from(child.querySelectorAll<HTMLElement>('tr'));

            return rows.length > 0 ? rows : [child];
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
        const isRow = element.tagName === 'TR';

        return {
            element,
            top: toDocumentTop(context, rect.top),
            height: toDocumentLength(context, rect.height),
            forceNextPage: element.getAttribute('data-page-break-before') === 'true',
            splittable,
            lines: splittable ? measureBlockLines(context, element) : [],
            offsetMode: isRow ? 'row-padding' : 'spacer',
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
export function createTiptapPageSpacerElement(
    ownerDocument: Document,
    height: number,
    key?: string,
) {
    const spacer = ownerDocument.createElement('span');

    spacer.className = PAGE_SPACER_CLASS;
    spacer.setAttribute(PAGE_SPACER_ATTRIBUTE, 'true');
    spacer.setAttribute('contenteditable', 'false');
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.height = `${Math.max(0, Math.round(height))}px`;

    if (key) {
        spacer.setAttribute(PAGE_SPACER_KEY_ATTRIBUTE, key);
    }

    return spacer;
}

/** An applied offset whose rendered result missed its planned target. */
export interface TiptapPageOffsetCorrection {
    /** Identifies the applied offset this correction belongs to. */
    key: string;
    /** Height the offset currently renders at. */
    currentHeight: number;
    /** Height that lands the content on its planned target. */
    correctedHeight: number;
}

/** One applied offset, described well enough to verify it. */
export interface TiptapAppliedPageOffset {
    key: string;
    /** Document coordinate the offset was supposed to place content at. */
    targetTop: number;
    /** Offset height currently applied. */
    height: number;
}

function getOffsetElement(root: HTMLElement, key: string): HTMLElement | null {
    return root.querySelector<HTMLElement>(
        `[${PAGE_SPACER_KEY_ATTRIBUTE}="${key}"], [${PAGE_ROW_KEY_ATTRIBUTE}="${key}"]`,
    );
}

/**
 * Reads where an applied offset actually put the content that follows it.
 *
 * @param context - Measurement context for the rendered root.
 * @param element - The spacer element, or the row whose cells were padded.
 * @param height - Offset height currently applied.
 * @returns The rendered content top in document coordinates.
 */
function getOffsetContentTop(
    context: RootMeasureContext,
    element: HTMLElement,
    height: number,
) {
    if (element.tagName !== 'TR') {
        // A spacer sits directly above the content it positions.
        return toDocumentTop(context, element.getBoundingClientRect().bottom);
    }

    // A padded row contains its content, so measure the content itself: the row
    // box still starts at the seam, only what is inside it moves down.
    const cellContent = element.querySelector<HTMLElement>('td > *, th > *');

    return cellContent
        ? toDocumentTop(context, cellContent.getBoundingClientRect().top)
        : toDocumentTop(context, element.getBoundingClientRect().top) + height;
}

/**
 * Verifies applied offsets against the targets the planner chose for them.
 *
 * A plan is built from measurements, so fractional line heights, web fonts, and
 * anonymous block boxes all leave a small error per offset. Those errors add up
 * down the document — a few pixels per page seam becomes a visible hole tens of
 * pages later — so corrections are computed cumulatively in document order, each
 * one accounting for how far the corrections above it have already moved this
 * content. Targets are absolute page coordinates, so content that landed in a
 * page gap is pushed forward to where it belongs rather than dragged back onto
 * the page above it.
 *
 * @param root - Rendered surface that has already received its offsets.
 * @param applied - The offsets that were applied, in document order.
 * @param tolerance - Ignore differences at or below this many pixels.
 * @returns One entry per offset that needs a different height.
 */
export function measureTiptapPageOffsetCorrections(
    root: HTMLElement,
    applied: TiptapAppliedPageOffset[],
    tolerance = OFFSET_CORRECTION_TOLERANCE_PX,
): TiptapPageOffsetCorrection[] {
    const context = createRootMeasureContext(root);
    const measurements = applied.flatMap((offset) => {
        const element = getOffsetElement(root, offset.key);

        if (!element) {
            return [];
        }

        return [{
            key: offset.key,
            height: offset.height,
            targetTop: offset.targetTop,
            measuredTop: getOffsetContentTop(context, element, offset.height),
        }];
    });

    return planTiptapPageOffsetCorrections(measurements, tolerance);
}

/**
 * Applies a row offset by padding the row's cells.
 *
 * @param row - Rendered table row.
 * @param height - Offset height in CSS pixels.
 * @param key - Identifier used when the offset is verified.
 */
export function applyTiptapPageRowOffset(row: HTMLElement, height: number, key: string) {
    row.classList.add(PAGE_ROW_OFFSET_CLASS);
    row.style.setProperty(PAGE_ROW_OFFSET_VAR, `${Math.max(0, Math.round(height))}px`);
    row.setAttribute(PAGE_ROW_KEY_ATTRIBUTE, key);
}

/**
 * Removes every row offset from a rendered surface.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 */
export function clearTiptapPageRowOffsets(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>(`.${PAGE_ROW_OFFSET_CLASS}`).forEach((row) => {
        row.classList.remove(PAGE_ROW_OFFSET_CLASS);
        row.style.removeProperty(PAGE_ROW_OFFSET_VAR);
        row.removeAttribute(PAGE_ROW_KEY_ATTRIBUTE);
    });
}
