/**
 * Line-aware page layout planning for Gracon-owned TipTap pagination.
 *
 * This is the single pagination engine used by the live editor and by export
 * capture. It works on measurements only: block tops/heights plus, for blocks
 * whose text may flow across a page, the rendered line boxes inside them.
 *
 * Text blocks split at line boundaries the way a word processor does, so a
 * paragraph that no longer fits continues on the next page instead of running
 * through the footer, the inter-page gap, and the following page header. Blocks
 * that cannot be split — images, tables, signature blocks — still move as one
 * unit, and only report overflow when they are taller than a whole page.
 */
import {
    getTiptapPageRegionAt,
    type TiptapPageGeometry,
    type TiptapPageBlockMeasurement,
} from './tiptap-page-geometry.ts';

/** One rendered line box inside a block, relative to the document root. */
export interface TiptapPageLineMeasurement {
    top: number;
    bottom: number;
}

/** A measured block, optionally carrying the line boxes it can split at. */
export interface TiptapPageBlockLayoutInput extends TiptapPageBlockMeasurement {
    /** Whether the block's own lines may be separated across pages. */
    splittable?: boolean;
    /** Rendered line boxes measured without any pagination spacers applied. */
    lines?: TiptapPageLineMeasurement[];
}

/** Extra space inserted before one line so it starts on the next page. */
export interface TiptapPageLineSpacer {
    /** Index into the block's measured lines. */
    lineIndex: number;
    /** Spacer height in CSS pixels. */
    height: number;
}

/** How a block was resolved against the page grid. */
export type TiptapPageBlockLayoutMode =
    | 'none'
    | 'manual-break'
    | 'automatic-offset'
    | 'line-split'
    | 'oversized-overflow';

/** Layout decisions for one block. */
export interface TiptapPageBlockLayoutPlan {
    /** Space added before the block, moving it down the page grid. */
    offset: number;
    /** Line-level spacers that continue the block on later pages. */
    spacers: TiptapPageLineSpacer[];
    /** True when the block still cannot fit inside a printable region. */
    overflow: boolean;
    mode: TiptapPageBlockLayoutMode;
}

/** Distance at which a block already counts as starting a page. */
const PAGE_START_TOLERANCE_PX = 1;

function toPositiveHeight(value: number) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Calculates the push a forced break needs, if it needs one at all.
 *
 * A block that already opens a printable region must stay where it is: pushing
 * it again would leave a page-sized hole above content that was already correct.
 *
 * @param geometry - Normalized page geometry.
 * @param top - Block top after every offset applied so far.
 * @returns Pixels to push, or zero when the block already starts a page.
 */
function calculateForcedBreakPush(geometry: TiptapPageGeometry, top: number) {
    const region = getTiptapPageRegionAt(geometry, top);

    if (Math.abs(top - region.printableTop) <= PAGE_START_TOLERANCE_PX) {
        return 0;
    }

    if (top < region.printableTop) {
        return Math.max(0, Math.ceil(region.printableTop - top));
    }

    return Math.max(0, Math.ceil(getNextPrintableTop(geometry, top) - top));
}

function getNextPrintableTop(geometry: TiptapPageGeometry, top: number) {
    const region = getTiptapPageRegionAt(geometry, top);
    return region.pageTop + geometry.pagePitch + geometry.printableTop;
}

/**
 * Calculates how far one line must move to sit inside a printable region.
 *
 * @param geometry - Normalized page geometry.
 * @param top - Effective line top after every offset applied so far.
 * @param bottom - Effective line bottom after those offsets.
 * @returns A non-negative push in CSS pixels; zero when the line already fits.
 */
function calculateLinePush(
    geometry: TiptapPageGeometry,
    top: number,
    bottom: number,
) {
    const region = getTiptapPageRegionAt(geometry, top);

    if (top < region.printableTop) {
        return Math.max(0, Math.ceil(region.printableTop - top));
    }

    if (bottom > region.printableBottom) {
        return Math.max(0, Math.ceil(getNextPrintableTop(geometry, top) - top));
    }

    return 0;
}

function canSplitBlock(block: TiptapPageBlockLayoutInput) {
    return block.splittable === true
        && Array.isArray(block.lines)
        && block.lines.length > 1;
}

/**
 * Plans a block that moves as one unit: images, tables, and short text blocks.
 *
 * @param geometry - Normalized page geometry.
 * @param block - Measured block with its effective top already applied.
 * @param effectiveTop - Block top after all previously applied offsets.
 * @returns The block's offset, overflow flag, and resolved mode.
 */
function planWholeBlock(
    geometry: TiptapPageGeometry,
    block: TiptapPageBlockLayoutInput,
    effectiveTop: number,
): TiptapPageBlockLayoutPlan {
    const height = toPositiveHeight(block.height);
    const region = getTiptapPageRegionAt(geometry, effectiveTop);
    const forceNextPage = block.forceNextPage === true;
    const startsInHeader = effectiveTop < region.printableTop;
    const crossesFooter = effectiveTop + height > region.printableBottom;
    const oversized = height > geometry.printableHeight;
    let offset = 0;

    if (forceNextPage) {
        offset = calculateForcedBreakPush(geometry, effectiveTop);
    } else if (startsInHeader) {
        offset = Math.max(0, Math.ceil(region.printableTop - effectiveTop));
    } else if (crossesFooter && !oversized) {
        offset = Math.max(0, Math.ceil(getNextPrintableTop(geometry, effectiveTop) - effectiveTop));
    }

    const placedTop = effectiveTop + offset;
    const placedRegion = getTiptapPageRegionAt(geometry, placedTop);
    const overflow = oversized && placedTop + height > placedRegion.printableBottom;
    const mode: TiptapPageBlockLayoutMode = offset > 0 && forceNextPage
        ? 'manual-break'
        : offset > 0
            ? 'automatic-offset'
            : overflow
                ? 'oversized-overflow'
                : 'none';

    return { offset, spacers: [], overflow, mode };
}

/**
 * Plans a text block that may continue on the next page at a line boundary.
 *
 * The first line moves the whole block, because nothing can be left behind it.
 * Later lines receive spacers, which is what makes a long paragraph flow across
 * pages instead of overlapping page chrome.
 *
 * @param geometry - Normalized page geometry.
 * @param block - Measured block including its line boxes.
 * @param carry - Total displacement applied by earlier blocks.
 * @returns The block's offset, line spacers, overflow flag, and mode.
 */
function planSplittableBlock(
    geometry: TiptapPageGeometry,
    block: TiptapPageBlockLayoutInput,
    carry: number,
): TiptapPageBlockLayoutPlan {
    const lines = block.lines ?? [];
    const forceNextPage = block.forceNextPage === true;
    const spacers: TiptapPageLineSpacer[] = [];
    let offset = forceNextPage
        ? calculateForcedBreakPush(geometry, block.top + carry)
        : 0;
    let lineCarry = 0;
    let overflow = false;

    lines.forEach((line, index) => {
        const displacement = carry + offset + lineCarry;
        const top = line.top + displacement;
        const bottom = line.bottom + displacement;

        if (line.bottom - line.top > geometry.printableHeight) {
            overflow = true;
            return;
        }

        const push = calculateLinePush(geometry, top, bottom);
        if (push <= 0) {
            return;
        }

        if (index === 0) {
            offset += push;
            return;
        }

        spacers.push({ lineIndex: index, height: push });
        lineCarry += push;
    });

    const mode: TiptapPageBlockLayoutMode = forceNextPage && offset > 0
        ? 'manual-break'
        : spacers.length > 0
            ? 'line-split'
            : offset > 0
                ? 'automatic-offset'
                : overflow
                    ? 'oversized-overflow'
                    : 'none';

    return { offset, spacers, overflow, mode };
}

/**
 * Plans page placement for a document's blocks in reading order.
 *
 * @param geometry - Normalized page geometry for the current surface.
 * @param blocks - Natural block positions measured before any spacer is applied.
 * @returns One layout plan per block, in the same order.
 */
export function planTiptapPageLayout(
    geometry: TiptapPageGeometry,
    blocks: TiptapPageBlockLayoutInput[],
): TiptapPageBlockLayoutPlan[] {
    let carry = 0;

    if (geometry.printableHeight <= 0) {
        return blocks.map(() => ({
            offset: 0,
            spacers: [],
            overflow: false,
            mode: 'none' as const,
        }));
    }

    return blocks.map((block) => {
        const plan = canSplitBlock(block)
            ? planSplittableBlock(geometry, block, carry)
            : planWholeBlock(geometry, block, block.top + carry);
        const spacerHeight = plan.spacers.reduce((total, spacer) => total + spacer.height, 0);

        carry += plan.offset + spacerHeight;

        return plan;
    });
}

/** Whole-block offset result for callers that never split block content. */
export interface TiptapPageBlockOffset {
    offset: number;
    overflow: boolean;
    mode: TiptapPageBlockLayoutMode;
}

/**
 * Calculates whole-block page offsets for a sequence of blocks.
 *
 * This is the block-only view of {@link planTiptapPageLayout}, kept for callers
 * and regression tests that measure blocks without line boxes.
 *
 * @param geometry - Normalized page geometry.
 * @param blocks - Natural block positions measured before offsets are applied.
 * @returns Render offsets and overflow flags in block order.
 */
export function calculateTiptapCumulativePageBlockOffsets(
    geometry: TiptapPageGeometry,
    blocks: TiptapPageBlockMeasurement[],
): TiptapPageBlockOffset[] {
    return planTiptapPageLayout(
        geometry,
        blocks.map((block) => ({ top: block.top, height: block.height, forceNextPage: block.forceNextPage })),
    ).map((plan) => ({ offset: plan.offset, overflow: plan.overflow, mode: plan.mode }));
}
