/**
 * Shared page geometry helpers for Gracon-owned TipTap pagination.
 */
import {
    A4_PAPER_HEIGHT_PX,
    PAPER_CONTENT_PADDING_BOTTOM_PX,
    PAPER_CONTENT_PADDING_LEFT_PX,
    PAPER_CONTENT_PADDING_RIGHT_PX,
    PAPER_CONTENT_PADDING_TOP_PX,
    PAPER_FOOTER_HEIGHT_PX,
    PAPER_HEADER_HEIGHT_PX,
    PAPER_PAGE_GAP_PX,
} from '../../constants/document-paper.ts';

export interface TiptapPageMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface TiptapPageGeometryInput {
    pageHeight?: number;
    pageGap?: number;
    headerHeight?: number;
    footerHeight?: number;
    margins?: Partial<TiptapPageMargins>;
}

export interface TiptapPageGeometry {
    pageHeight: number;
    pageGap: number;
    pagePitch: number;
    headerHeight: number;
    footerHeight: number;
    margins: TiptapPageMargins;
    printableTop: number;
    printableBottom: number;
    printableHeight: number;
}

export interface TiptapPageRegion {
    pageIndex: number;
    pageTop: number;
    pageBottom: number;
    printableTop: number;
    printableBottom: number;
}

export interface TiptapPageBlockMeasurement {
    top: number;
    height: number;
    forceNextPage?: boolean;
}

export interface TiptapPageBlockOffset {
    offset: number;
    overflow: boolean;
    mode: 'none' | 'manual-break' | 'automatic-offset' | 'oversized-overflow';
}

function normalizePositiveNumber(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.round(value)
        : fallback;
}

function normalizeMargins(value: Partial<TiptapPageMargins> | undefined): TiptapPageMargins {
    return {
        top: normalizePositiveNumber(value?.top, PAPER_CONTENT_PADDING_TOP_PX),
        right: normalizePositiveNumber(value?.right, PAPER_CONTENT_PADDING_RIGHT_PX),
        bottom: normalizePositiveNumber(value?.bottom, PAPER_CONTENT_PADDING_BOTTOM_PX),
        left: normalizePositiveNumber(value?.left, PAPER_CONTENT_PADDING_LEFT_PX),
    };
}

/**
 * Creates a normalized page-geometry model shared by live layout and export.
 *
 * @param input - Optional paper, chrome, and margin overrides.
 * @returns Page geometry with computed printable bounds.
 */
export function createTiptapPageGeometry(input: TiptapPageGeometryInput = {}): TiptapPageGeometry {
    const pageHeight = Math.max(1, normalizePositiveNumber(input.pageHeight, A4_PAPER_HEIGHT_PX));
    const pageGap = normalizePositiveNumber(input.pageGap, 0);
    const headerHeight = normalizePositiveNumber(input.headerHeight, PAPER_HEADER_HEIGHT_PX);
    const footerHeight = normalizePositiveNumber(input.footerHeight, PAPER_FOOTER_HEIGHT_PX);
    const margins = normalizeMargins(input.margins);
    const printableTop = Math.min(pageHeight, headerHeight + margins.top);
    const printableBottom = Math.max(printableTop, pageHeight - footerHeight - margins.bottom);

    return {
        pageHeight,
        pageGap,
        pagePitch: pageHeight + pageGap,
        headerHeight,
        footerHeight,
        margins,
        printableTop,
        printableBottom,
        printableHeight: Math.max(0, printableBottom - printableTop),
    };
}

/**
 * Creates page geometry for the live editor surface with visible page gaps.
 *
 * @param input - Optional paper, chrome, and margin overrides.
 * @returns Page geometry using the editor's Google Docs-style page gap.
 */
export function createTiptapLivePageGeometry(input: TiptapPageGeometryInput = {}): TiptapPageGeometry {
    return createTiptapPageGeometry({
        ...input,
        pageGap: input.pageGap ?? PAPER_PAGE_GAP_PX,
    });
}

/**
 * Creates page geometry for print/export capture with collapsed page gaps.
 *
 * @param input - Optional paper, chrome, and margin overrides.
 * @returns Page geometry with zero inter-page gap for exact page slicing.
 */
export function createTiptapExportPageGeometry(input: TiptapPageGeometryInput = {}): TiptapPageGeometry {
    return createTiptapPageGeometry({
        ...input,
        pageGap: 0,
    });
}

/**
 * Resolves the visual page region containing a vertical document coordinate.
 *
 * @param geometry - Normalized page geometry.
 * @param top - Vertical coordinate relative to the document root.
 * @returns Page bounds and printable bounds for that coordinate.
 */
export function getTiptapPageRegionAt(
    geometry: TiptapPageGeometry,
    top: number,
): TiptapPageRegion {
    const pageIndex = Math.max(0, Math.floor(Math.max(0, top) / geometry.pagePitch));
    const pageTop = pageIndex * geometry.pagePitch;
    const pageBottom = pageTop + geometry.pageHeight;

    return {
        pageIndex,
        pageTop,
        pageBottom,
        printableTop: pageTop + geometry.printableTop,
        printableBottom: pageTop + geometry.printableBottom,
    };
}

/**
 * Calculates the CSS offset needed to start a block in the next printable page area.
 *
 * @param geometry - Normalized page geometry.
 * @param blockTop - Block top relative to the document root.
 * @param blockHeight - Rendered block height in CSS pixels.
 * @param forceNextPage - Whether this block has an explicit page-break-before.
 * @returns A non-negative offset in CSS pixels.
 */
export function calculateTiptapPageBlockOffset(
    geometry: TiptapPageGeometry,
    blockTop: number,
    blockHeight: number,
    forceNextPage = false,
) {
    const current = getTiptapPageRegionAt(geometry, blockTop);
    const blockBottom = blockTop + Math.max(0, blockHeight);
    const startsInHeader = blockTop < current.printableTop;
    const crossesFooter = blockBottom > current.printableBottom;

    if (forceNextPage) {
        const nextPrintableTop = current.pageTop + geometry.pagePitch + geometry.printableTop;
        return Math.max(0, Math.ceil(nextPrintableTop - blockTop));
    }

    if (startsInHeader) {
        return Math.max(0, Math.ceil(current.printableTop - blockTop));
    }

    if (crossesFooter && blockHeight <= geometry.printableHeight) {
        const nextPrintableTop = current.pageTop + geometry.pagePitch + geometry.printableTop;
        return Math.max(0, Math.ceil(nextPrintableTop - blockTop));
    }

    return 0;
}

/**
 * Returns whether a block is too tall to move as one whole printable block.
 *
 * @param geometry - Normalized page geometry.
 * @param blockHeight - Rendered block height in CSS pixels.
 * @returns Whether the block needs future line-level pagination.
 */
export function isTiptapPageBlockOversized(
    geometry: TiptapPageGeometry,
    blockHeight: number,
) {
    return Math.max(0, blockHeight) > geometry.printableHeight;
}

/**
 * Returns whether an oversized block currently crosses the printable footer zone.
 *
 * @param geometry - Normalized page geometry.
 * @param blockTop - Block top relative to the document root.
 * @param blockHeight - Rendered block height in CSS pixels.
 * @returns Whether the block should be flagged for future line pagination.
 */
export function isTiptapPageBlockOverflowing(
    geometry: TiptapPageGeometry,
    blockTop: number,
    blockHeight: number,
) {
    if (!isTiptapPageBlockOversized(geometry, blockHeight)) {
        return false;
    }

    const region = getTiptapPageRegionAt(geometry, blockTop);
    return blockTop + Math.max(0, blockHeight) > region.printableBottom;
}

function getTiptapPageBlockOffsetMode(
    block: TiptapPageBlockMeasurement,
    offset: number,
    overflow: boolean,
): TiptapPageBlockOffset['mode'] {
    if (offset > 0 && block.forceNextPage === true) {
        return 'manual-break';
    }

    if (offset > 0) {
        return 'automatic-offset';
    }

    if (overflow) {
        return 'oversized-overflow';
    }

    return 'none';
}

/**
 * Calculates page offsets for a sequence of blocks using cumulative layout.
 *
 * @param geometry - Normalized page geometry.
 * @param blocks - Natural block positions measured before offsets are applied.
 * @returns Render offsets and overflow flags in block order.
 */
export function calculateTiptapCumulativePageBlockOffsets(
    geometry: TiptapPageGeometry,
    blocks: TiptapPageBlockMeasurement[],
): TiptapPageBlockOffset[] {
    let cumulativeOffset = 0;

    return blocks.map((block) => {
        const effectiveTop = block.top + cumulativeOffset;
        const overflow = isTiptapPageBlockOverflowing(geometry, effectiveTop, block.height);
        const offset = calculateTiptapPageBlockOffset(
            geometry,
            effectiveTop,
            block.height,
            block.forceNextPage === true,
        );
        const mode = getTiptapPageBlockOffsetMode(block, offset, overflow);

        cumulativeOffset += offset;

        return { offset, overflow, mode };
    });
}
