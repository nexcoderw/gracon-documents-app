/**
 * Applies page layout to a static rendered document surface.
 *
 * The live editor paginates through ProseMirror decorations, because inserting
 * nodes into a contenteditable surface from outside TipTap would corrupt the
 * document model. Export clones are inert DOM, so they receive the same spacer
 * elements directly. Both paths share one planner, so a PDF page break lands
 * where the editor drew it.
 */
import {
    createTiptapPageSpacerElement,
    findTiptapLineStartPoint,
    measureTiptapPageBlocks,
    measureTiptapPageOffsetCorrections,
    applyTiptapPageRowOffset,
    clearTiptapPageRowOffsets,
    PAGE_MEASURING_CLASS,
    PAGE_SPACER_ATTRIBUTE,
    type TiptapAppliedPageOffset,
    type TiptapLineStartPoint,
    type TiptapMeasuredPageBlock,
} from '@/lib/tiptap/tiptap-page-layout-dom';
import { planTiptapPageLayout } from '@/lib/tiptap/tiptap-page-layout-plan';
import {
    createTiptapPageGeometry,
    type TiptapPageGeometryInput,
} from '@/lib/tiptap/tiptap-page-geometry';
import type { TiptapPageBlockLayoutPlan } from '@/lib/tiptap/tiptap-page-layout-plan';

const PAGE_OVERFLOW_ATTR = 'data-document-page-overflow';

/** Correction attempts allowed before a surface is accepted as-is. */
const MAX_CORRECTION_PASSES = 3;

/** One block's planned spacers, resolved to DOM insertion points. */
interface PlannedSpacerInsertion {
    block: TiptapMeasuredPageBlock;
    plan: TiptapPageBlockLayoutPlan;
    linePoints: Array<{ point: TiptapLineStartPoint; height: number; targetTop: number }>;
}
const LEGACY_OFFSET_VARS = [
    '--document-page-break-before-offset',
    '--document-page-auto-offset',
];

export interface TiptapPageLayoutOffsetResult {
    manualOffsetCount: number;
    automaticOffsetCount: number;
    lineSplitCount: number;
    overflowBlockCount: number;
}

/**
 * Removes every pagination artifact from a rendered surface.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 */
export function clearTiptapPageLayoutOffsets(root: HTMLElement) {
    root.querySelectorAll(`[${PAGE_SPACER_ATTRIBUTE}]`).forEach((spacer) => spacer.remove());
    clearTiptapPageRowOffsets(root);
    root.querySelectorAll<HTMLElement>(`[${PAGE_OVERFLOW_ATTR}]`).forEach((element) => {
        element.removeAttribute(PAGE_OVERFLOW_ATTR);
    });
    root.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
        LEGACY_OFFSET_VARS.forEach((variable) => element.style.removeProperty(variable));
    });
}

function insertSpacerBeforeBlock(element: HTMLElement, height: number, key: string) {
    const spacer = createTiptapPageSpacerElement(element.ownerDocument, height, key);
    element.parentElement?.insertBefore(spacer, element);
}

function insertSpacerAtPoint(
    ownerDocument: Document,
    point: TiptapLineStartPoint,
    height: number,
    key: string,
) {
    const range = ownerDocument.createRange();

    try {
        range.setStart(point.node, point.offset);
        range.collapse(true);
        range.insertNode(createTiptapPageSpacerElement(ownerDocument, height, key));
    } finally {
        range.detach();
    }
}

/**
 * Paginates a static rendered surface with block and line spacers.
 *
 * @param root - Rendered `.ProseMirror` clone to paginate.
 * @param input - Page geometry options for the current document layout.
 * @returns Counts describing how the pass resolved the document.
 */
export function applyTiptapPageLayoutOffsets(
    root: HTMLElement,
    input: TiptapPageGeometryInput = {},
): TiptapPageLayoutOffsetResult {
    const geometry = createTiptapPageGeometry(input);
    const result: TiptapPageLayoutOffsetResult = {
        manualOffsetCount: 0,
        automaticOffsetCount: 0,
        lineSplitCount: 0,
        overflowBlockCount: 0,
    };

    clearTiptapPageLayoutOffsets(root);

    if (geometry.pageHeight <= 0 || geometry.printableHeight <= 0) {
        return result;
    }

    // Measure and resolve every insertion point while the surface is still
    // unpaginated, then apply the spacers without measuring again.
    root.classList.add(PAGE_MEASURING_CLASS);
    const blocks = measureTiptapPageBlocks(root);
    const plans = planTiptapPageLayout(geometry, blocks);
    const insertions = blocks.map((block, index) => {
        const plan = plans[index];
        const linePoints = plan.spacers.flatMap((spacer) => {
            const line = block.lines[spacer.lineIndex];
            const point = line
                ? findTiptapLineStartPoint(root, block.element, line.top)
                : null;

            return point
                ? [{ point, height: spacer.height, targetTop: spacer.targetTop }]
                : [];
        });

        return { block, plan, linePoints };
    });
    root.classList.remove(PAGE_MEASURING_CLASS);

    const applied = applyPlannedSpacers(insertions, result);
    correctRenderedOffsets(root, applied);

    return result;
}

/**
 * Re-measures applied offsets and rewrites the ones that missed their target.
 *
 * @param root - Rendered surface that has already received its offsets.
 * @param applied - Offsets that were applied, with their planned targets.
 */
function correctRenderedOffsets(root: HTMLElement, applied: TiptapAppliedPageOffset[]) {
    let current = applied;

    for (let pass = 0; pass < MAX_CORRECTION_PASSES; pass += 1) {
        const corrections = measureTiptapPageOffsetCorrections(root, current);

        if (corrections.length === 0) {
            return;
        }

        const correctedHeights = new Map(
            corrections.map((correction) => [correction.key, correction.correctedHeight]),
        );

        current = current.map((offset) => {
            const height = correctedHeights.get(offset.key);
            if (height === undefined) {
                return offset;
            }

            const element = root.querySelector<HTMLElement>(
                `[${PAGE_SPACER_ATTRIBUTE}][data-document-page-spacer-key="${offset.key}"]`,
            );

            if (element) {
                element.style.height = `${height}px`;
            } else {
                const row = root.querySelector<HTMLElement>(
                    `[data-document-page-row-key="${offset.key}"]`,
                );
                row?.style.setProperty('--document-page-row-offset', `${height}px`);
            }

            return { ...offset, height };
        });
    }
}

function applyPlannedSpacers(
    insertions: PlannedSpacerInsertion[],
    result: TiptapPageLayoutOffsetResult,
): TiptapAppliedPageOffset[] {
    const applied: TiptapAppliedPageOffset[] = [];

    insertions.forEach(({ block, plan, linePoints }, index) => {
        if (plan.overflow) {
            block.element.setAttribute(PAGE_OVERFLOW_ATTR, 'true');
            result.overflowBlockCount += 1;
        }

        if (plan.offset > 0) {
            const key = `block-${index}`;

            if (block.offsetMode === 'row-padding') {
                applyTiptapPageRowOffset(block.element, plan.offset, key);
            } else {
                insertSpacerBeforeBlock(block.element, plan.offset, key);
            }

            applied.push({ key, targetTop: plan.targetTop, height: plan.offset });

            if (plan.mode === 'manual-break') {
                result.manualOffsetCount += 1;
            } else {
                result.automaticOffsetCount += 1;
            }
        }

        // Later lines are inserted first: splitting a text node at a later
        // offset keeps the earlier resolved points in that node valid. The
        // applied list stays in document order, which corrections depend on.
        [...linePoints].reverse().forEach((spacer, reverseIndex) => {
            insertSpacerAtPoint(
                block.element.ownerDocument,
                spacer.point,
                spacer.height,
                `line-${index}-${linePoints.length - 1 - reverseIndex}`,
            );
            result.lineSplitCount += 1;
        });

        linePoints.forEach((spacer, lineIndex) => {
            applied.push({
                key: `line-${index}-${lineIndex}`,
                targetTop: spacer.targetTop,
                height: spacer.height,
            });
        });
    });

    return applied;
}
