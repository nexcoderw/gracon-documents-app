/**
 * Shared document paper geometry used by the editor and client-side exports.
 *
 * Keep these values aligned with the CSS custom properties in globals.css.
 * The pixel dimensions use the browser's 96 DPI CSS inch conversion.
 */
export const DOCUMENT_PAPER_DPI = 96;

export const A4_PAPER_WIDTH_PX = 794;
export const A4_PAPER_HEIGHT_PX = 1123;
export const A4_PAPER_MARGIN_PX = DOCUMENT_PAPER_DPI;

export const A4_PAPER_WIDTH_PT = 595.28;
export const A4_PAPER_HEIGHT_PT = 841.89;

export const PAPER_HEADER_HEIGHT_PX = 52;
export const PAPER_FOOTER_HEIGHT_PX = 48;
export const PAPER_CONTENT_HEIGHT_PX =
    A4_PAPER_HEIGHT_PX - PAPER_HEADER_HEIGHT_PX - PAPER_FOOTER_HEIGHT_PX;

export const PAPER_CONTENT_PADDING_TOP_PX = 56;
export const PAPER_CONTENT_PADDING_RIGHT_PX = 76;
export const PAPER_CONTENT_PADDING_BOTTOM_PX = 64;
export const PAPER_CONTENT_PADDING_LEFT_PX = 76;

export const PAPER_CONTENT_INNER_HEIGHT_PX =
    PAPER_CONTENT_HEIGHT_PX - PAPER_CONTENT_PADDING_TOP_PX - PAPER_CONTENT_PADDING_BOTTOM_PX;
export const PAPER_CONTENT_INNER_WIDTH_PX =
    A4_PAPER_WIDTH_PX - PAPER_CONTENT_PADDING_LEFT_PX - PAPER_CONTENT_PADDING_RIGHT_PX;

export const PAPER_PAGE_GAP_PX = 24;

/**
 * Breathing room kept between page content and the repeated header/footer rules.
 * Content that breaks across pages stops this far above the footer and resumes
 * this far below the header, so a page seam never looks flush or clipped.
 */
export const PAPER_CONTENT_SAFETY_PX = 18;

export const A4_PAPER_WIDTH_TWIP = 11906;
export const A4_PAPER_HEIGHT_TWIP = 16838;

export const A4_PAPER_ASPECT_RATIO = A4_PAPER_HEIGHT_PX / A4_PAPER_WIDTH_PX;
