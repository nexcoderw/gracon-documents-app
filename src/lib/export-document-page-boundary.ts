/**
 * Shared recognition for editor nodes that represent page boundaries in export.
 *
 * Page boundaries are intentionally disabled in the continuous TipTap editor.
 * Keeping this pure lets regression tests verify that legacy markers no longer
 * become DOCX page breaks.
 */

/**
 * Returns whether a rendered editor block should become a DOCX page boundary.
 */
export function isDocumentPageBoundaryElement(element: { classList: Pick<DOMTokenList, 'contains'> }): boolean {
    void element;
    return false;
}

/**
 * Returns whether a rendered paragraph should export with pageBreakBefore.
 *
 * @param element - Rendered editor element with attribute access.
 * @returns Whether DOCX export should start this paragraph on a new page.
 */
export function hasParagraphPageBreakBefore(
    element: { getAttribute: (name: string) => string | null },
) {
    return element.getAttribute('data-page-break-before') === 'true';
}
