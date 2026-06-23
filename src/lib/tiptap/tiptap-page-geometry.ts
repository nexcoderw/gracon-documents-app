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
} from '../../constants/document-paper.ts';

export interface TiptapPageMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface TiptapPageGeometryInput {
    pageHeight?: number;
    headerHeight?: number;
    footerHeight?: number;
    margins?: Partial<TiptapPageMargins>;
}

export interface TiptapPageGeometry {
    pageHeight: number;
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
    const headerHeight = normalizePositiveNumber(input.headerHeight, PAPER_HEADER_HEIGHT_PX);
    const footerHeight = normalizePositiveNumber(input.footerHeight, PAPER_FOOTER_HEIGHT_PX);
    const margins = normalizeMargins(input.margins);
    const printableTop = Math.min(pageHeight, headerHeight + margins.top);
    const printableBottom = Math.max(printableTop, pageHeight - footerHeight - margins.bottom);

    return {
        pageHeight,
        headerHeight,
        footerHeight,
        margins,
        printableTop,
        printableBottom,
        printableHeight: Math.max(0, printableBottom - printableTop),
    };
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
    const pageIndex = Math.max(0, Math.floor(Math.max(0, top) / geometry.pageHeight));
    const pageTop = pageIndex * geometry.pageHeight;
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
        const nextPrintableTop = current.pageTop + geometry.pageHeight + geometry.printableTop;
        return Math.max(0, Math.ceil(nextPrintableTop - blockTop));
    }

    if (startsInHeader) {
        return Math.max(0, Math.ceil(current.printableTop - blockTop));
    }

    if (crossesFooter && blockHeight <= geometry.printableHeight) {
        const nextPrintableTop = current.pageTop + geometry.pageHeight + geometry.printableTop;
        return Math.max(0, Math.ceil(nextPrintableTop - blockTop));
    }

    return 0;
}
