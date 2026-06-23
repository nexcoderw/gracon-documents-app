/**
 * Applies visual geometry for schema-backed paragraph page breaks.
 *
 * Page-break state is persisted in TipTap node attributes. These helpers only
 * set CSS variables on the rendered DOM so live editing and PDF capture can
 * place break-before blocks on the next page without mutating document JSON.
 */
const PAGE_BREAK_BEFORE_SELECTOR = '[data-page-break-before="true"]';
const PAGE_BREAK_OFFSET_VAR = '--document-page-break-before-offset';

/**
 * Clears computed page-break offsets from rendered editor blocks.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 */
export function clearTiptapPageBreakOffsets(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>(PAGE_BREAK_BEFORE_SELECTOR).forEach((element) => {
        element.style.removeProperty(PAGE_BREAK_OFFSET_VAR);
    });
}

/**
 * Computes CSS offsets that move break-before blocks to the next page.
 *
 * @param root - Rendered `.ProseMirror` element or export clone.
 * @param pageHeight - Page height in CSS pixels.
 * @returns Number of blocks that received a non-zero offset.
 */
export function applyTiptapPageBreakOffsets(root: HTMLElement, pageHeight: number) {
    const breakElements = Array.from(
        root.querySelectorAll<HTMLElement>(PAGE_BREAK_BEFORE_SELECTOR),
    );

    clearTiptapPageBreakOffsets(root);

    if (breakElements.length === 0 || pageHeight <= 0) {
        return 0;
    }

    let shiftedCount = 0;

    breakElements.forEach((element) => {
        const rootRect = root.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const top = elementRect.top - rootRect.top + root.scrollTop;
        const remainder = ((top % pageHeight) + pageHeight) % pageHeight;
        const offset = remainder <= 1 ? 0 : Math.ceil(pageHeight - remainder);

        if (offset > 0) {
            element.style.setProperty(PAGE_BREAK_OFFSET_VAR, `${offset}px`);
            shiftedCount += 1;
        }
    });

    return shiftedCount;
}
