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
    PAPER_CONTENT_SAFETY_PX,
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
    /**
     * Breathing room kept between content and page chrome, top and bottom.
     * Without it a line can sit flush against the header rule or footer rule.
     */
    contentSafetyPadding?: number;
}

export interface TiptapPageGeometry {
    pageHeight: number;
    pageGap: number;
    pagePitch: number;
    headerHeight: number;
    footerHeight: number;
    margins: TiptapPageMargins;
    contentSafetyPadding: number;
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
    const pageGap = normalizePositiveNumber(input.pageGap, 0);
    const headerHeight = normalizePositiveNumber(input.headerHeight, PAPER_HEADER_HEIGHT_PX);
    const footerHeight = normalizePositiveNumber(input.footerHeight, PAPER_FOOTER_HEIGHT_PX);
    const margins = normalizeMargins(input.margins);
    const contentSafetyPadding = normalizePositiveNumber(input.contentSafetyPadding, 0);
    const printableTop = Math.min(
        pageHeight,
        headerHeight + margins.top + contentSafetyPadding,
    );
    const printableBottom = Math.max(
        printableTop,
        pageHeight - footerHeight - margins.bottom - contentSafetyPadding,
    );

    return {
        pageHeight,
        pageGap,
        pagePitch: pageHeight + pageGap,
        headerHeight,
        footerHeight,
        margins,
        contentSafetyPadding,
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
        contentSafetyPadding: input.contentSafetyPadding ?? PAPER_CONTENT_SAFETY_PX,
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
        contentSafetyPadding: input.contentSafetyPadding ?? PAPER_CONTENT_SAFETY_PX,
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
