/**
 * Splits a rendered table across a page boundary.
 *
 * This only ever runs on a static export/preview clone, never on the editable
 * ProseMirror surface: it moves real nodes, which would corrupt the document
 * model if applied to a live view. The editor stays one continuous surface and
 * pagination is resolved when the document is previewed for download.
 *
 * A split closes the table before the row that no longer fits and opens a
 * continuation table on the next page, repeating the header row so the columns
 * stay readable — the behaviour a word processor gives a long table.
 */

/** Marks a table produced by splitting an earlier one. */
export const TABLE_CONTINUATION_ATTRIBUTE = 'data-document-table-continuation';

/**
 * Finds the header row to repeat on a continuation table.
 *
 * @param table Table being split.
 * @returns The header row, or null when the table has no header.
 */
function findHeaderRow(table: HTMLTableElement): HTMLTableRowElement | null {
    const headerRow = table.tHead?.rows[0];
    if (headerRow) {
        return headerRow;
    }

    // Editor tables often carry header cells in the first body row instead.
    const firstRow = table.rows[0];
    if (firstRow && firstRow.querySelector('th')) {
        return firstRow;
    }

    return null;
}

/**
 * Creates an empty continuation table that mirrors the source table.
 *
 * Column widths live in a `colgroup` for editor tables, so it is carried over
 * with the rest of the table's attributes to keep the columns aligned.
 *
 * @param table Table being split.
 * @returns A table element ready to receive the remaining rows.
 */
function createContinuationTable(table: HTMLTableElement): HTMLTableElement {
    const continuation = table.cloneNode(false) as HTMLTableElement;
    const colgroup = table.querySelector('colgroup');

    continuation.setAttribute(TABLE_CONTINUATION_ATTRIBUTE, 'true');

    if (colgroup) {
        continuation.appendChild(colgroup.cloneNode(true));
    }

    return continuation;
}

/**
 * Splits a table so the given row starts a continuation table.
 *
 * @param table Table to split.
 * @param row First row that must move to the next page.
 * @returns The continuation table, or null when the split is not possible.
 */
export function splitTiptapTableAtRow(
    table: HTMLTableElement,
    row: HTMLTableRowElement,
): HTMLTableElement | null {
    const section = row.parentElement;
    if (!(section instanceof HTMLTableSectionElement) || !table.parentElement) {
        return null;
    }

    // Splitting at the very first row would leave an empty table behind; the
    // caller should move the whole table instead.
    const isFirstRow = table.rows[0] === row;
    if (isFirstRow) {
        return null;
    }

    const headerRow = findHeaderRow(table);
    const continuation = createContinuationTable(table);
    const continuationSection = section.cloneNode(false) as HTMLTableSectionElement;

    if (headerRow && headerRow !== row) {
        continuationSection.appendChild(headerRow.cloneNode(true));
    }

    // Move this row and everything after it into the continuation table.
    const remaining: HTMLTableRowElement[] = [];
    let cursor: Element | null = row;
    while (cursor) {
        const next: Element | null = cursor.nextElementSibling;
        if (cursor instanceof HTMLTableRowElement) {
            remaining.push(cursor);
        }
        cursor = next;
    }

    if (remaining.length === 0) {
        return null;
    }

    remaining.forEach((movedRow) => continuationSection.appendChild(movedRow));
    continuation.appendChild(continuationSection);

    // Sections after this one belong to the continuation as well.
    let nextSection = section.nextElementSibling;
    while (nextSection) {
        const following: Element | null = nextSection.nextElementSibling;
        if (nextSection instanceof HTMLTableSectionElement) {
            continuation.appendChild(nextSection);
        }
        nextSection = following;
    }

    table.insertAdjacentElement('afterend', continuation);

    return continuation;
}
