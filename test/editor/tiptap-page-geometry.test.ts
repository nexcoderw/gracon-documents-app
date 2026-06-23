import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    calculateTiptapPageBlockOffset,
    createTiptapPageGeometry,
    getTiptapPageRegionAt,
} from '../../src/lib/tiptap/tiptap-page-geometry.ts';

test('createTiptapPageGeometry builds printable page bounds from margins and chrome', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: {
            top: 60,
            right: 80,
            bottom: 70,
            left: 80,
        },
    });

    assert.equal(geometry.printableTop, 100);
    assert.equal(geometry.printableBottom, 880);
    assert.equal(geometry.printableHeight, 780);
});

test('getTiptapPageRegionAt resolves repeated printable regions', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.deepEqual(getTiptapPageRegionAt(geometry, 1250), {
        pageIndex: 1,
        pageTop: 1000,
        pageBottom: 2000,
        printableTop: 1100,
        printableBottom: 1880,
    });
});

test('calculateTiptapPageBlockOffset moves blocks away from page footer chrome', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.equal(calculateTiptapPageBlockOffset(geometry, 850, 60), 250);
    assert.equal(calculateTiptapPageBlockOffset(geometry, 820, 40), 0);
});

test('calculateTiptapPageBlockOffset keeps oversized blocks in place for later line pagination', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.equal(calculateTiptapPageBlockOffset(geometry, 200, 900), 0);
});

test('calculateTiptapPageBlockOffset gives manual page breaks precedence', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.equal(calculateTiptapPageBlockOffset(geometry, 320, 40, true), 780);
});
