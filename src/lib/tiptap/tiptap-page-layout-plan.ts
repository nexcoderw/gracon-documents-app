/**
 * Page placement rules for Gracon-owned pagination.
 *
 * Pagination runs as a single forward pass over the rendered document: each unit
 * — a block, a line inside a block, or a table row — is measured in the DOM as
 * it is reached, placed, and then the next unit is measured against the result.
 * Because every decision is made against the current rendered position, error
 * cannot accumulate down the document the way a measure-everything-first plan
 * allows.
 *
 * This module holds the pure decision for one unit. It has no DOM access, so the
 * rules stay testable on their own.
 */
import {
    getTiptapPageRegionAt,
    type TiptapPageGeometry,
} from './tiptap-page-geometry.ts';

/** Distance at which a unit already counts as starting a page. */
const PAGE_START_TOLERANCE_PX = 1;

/** What must happen to a measured unit for it to sit inside a page. */
export type TiptapPlacementAction =
    /** The unit already fits; leave it alone. */
    | 'keep'
    /** Move the whole unit down by `push` pixels. */
    | 'push'
    /** The unit's own lines must be separated across the page boundary. */
    | 'split'
    /** The unit cannot fit in any printable region, even alone on a page. */
    | 'overflow';

/** A measured unit awaiting placement. */
export interface TiptapPlacementInput {
    /** Unit top, in document coordinates. */
    top: number;
    /** Unit bottom, in document coordinates. */
    bottom: number;
    /** Whether the unit carries an explicit page break. */
    forceNextPage?: boolean;
    /** Whether the unit's content can be divided at an internal boundary. */
    splittable?: boolean;
}

/** How a unit should be placed. */
export interface TiptapPlacement {
    action: TiptapPlacementAction;
    /** Pixels to move the unit down; zero for every action but `push`. */
    push: number;
    /** Document coordinate the unit should end up at. */
    targetTop: number;
}

function getNextPrintableTop(geometry: TiptapPageGeometry, top: number) {
    const region = getTiptapPageRegionAt(geometry, top);
    return region.pageTop + geometry.pagePitch + geometry.printableTop;
}

/**
 * Resolves where a measured unit belongs on the page grid.
 *
 * @param geometry Normalized page geometry for the surface.
 * @param unit The unit's current measured bounds and flags.
 * @returns The action to take, the push required, and the resulting top.
 */
export function resolveTiptapPlacement(
    geometry: TiptapPageGeometry,
    unit: TiptapPlacementInput,
): TiptapPlacement {
    const region = getTiptapPageRegionAt(geometry, unit.top);
    const height = Math.max(0, unit.bottom - unit.top);
    const startsPage = Math.abs(unit.top - region.printableTop) <= PAGE_START_TOLERANCE_PX;

    if (geometry.printableHeight <= 0) {
        return { action: 'keep', push: 0, targetTop: unit.top };
    }

    // An explicit break moves the unit unless it already opens a page, where
    // pushing again would leave a page-sized hole above correct content.
    if (unit.forceNextPage === true && !startsPage) {
        const targetTop = unit.top < region.printableTop
            ? region.printableTop
            : getNextPrintableTop(geometry, unit.top);

        return {
            action: 'push',
            push: Math.max(0, Math.ceil(targetTop - unit.top)),
            targetTop,
        };
    }

    // Content rendered into the header band always drops into the page body.
    if (unit.top < region.printableTop) {
        return {
            action: 'push',
            push: Math.max(0, Math.ceil(region.printableTop - unit.top)),
            targetTop: region.printableTop,
        };
    }

    if (unit.bottom <= region.printableBottom) {
        return { action: 'keep', push: 0, targetTop: unit.top };
    }

    // Taller than a whole page: it cannot be placed, only divided.
    if (height > geometry.printableHeight) {
        return unit.splittable === true
            ? { action: 'split', push: 0, targetTop: unit.top }
            : { action: 'overflow', push: 0, targetTop: unit.top };
    }

    // It fits on a page, just not this one.
    const targetTop = getNextPrintableTop(geometry, unit.top);

    return {
        action: 'push',
        push: Math.max(0, Math.ceil(targetTop - unit.top)),
        targetTop,
    };
}
