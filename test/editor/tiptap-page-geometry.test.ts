/**
 * Regression tests for Gracon-owned TipTap page geometry.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    calculateTiptapCumulativePageBlockOffsets,
    calculateTiptapPageBlockOffset,
    createTiptapExportPageGeometry,
    createTiptapLivePageGeometry,
    createTiptapPageGeometry,
    getTiptapPageRegionAt,
    isTiptapPageBlockOverflowing,
    isTiptapPageBlockOversized,
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
    assert.equal(geometry.pagePitch, 1000);
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

test('getTiptapPageRegionAt includes live page gaps when configured', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        pageGap: 24,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.deepEqual(getTiptapPageRegionAt(geometry, 1250), {
        pageIndex: 1,
        pageTop: 1024,
        pageBottom: 2024,
        printableTop: 1124,
        printableBottom: 1904,
    });
});

test('live and export page geometry use separate page gap contracts', () => {
    assert.equal(createTiptapLivePageGeometry({ pageHeight: 1000 }).pageGap, 24);
    assert.equal(createTiptapLivePageGeometry({ pageHeight: 1000 }).pagePitch, 1024);
    assert.equal(createTiptapExportPageGeometry({ pageHeight: 1000, pageGap: 24 }).pageGap, 0);
    assert.equal(createTiptapExportPageGeometry({ pageHeight: 1000, pageGap: 24 }).pagePitch, 1000);
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

test('calculateTiptapPageBlockOffset preserves page gaps for manual breaks', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        pageGap: 24,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.equal(calculateTiptapPageBlockOffset(geometry, 320, 40, true), 804);
});

test('page geometry flags oversized overflowing blocks for future line pagination', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.equal(isTiptapPageBlockOversized(geometry, 900), true);
    assert.equal(isTiptapPageBlockOverflowing(geometry, 150, 900), true);
    assert.equal(isTiptapPageBlockOverflowing(geometry, 100, 100), false);
});

test('cumulative page offsets measure following blocks after prior offsets', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        pageGap: 24,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.deepEqual(calculateTiptapCumulativePageBlockOffsets(geometry, [
        { top: 820, height: 40 },
        { top: 850, height: 40 },
        { top: 890, height: 80 },
    ]), [
        { offset: 0, overflow: false, mode: 'none' },
        { offset: 274, overflow: false, mode: 'automatic-offset' },
        { offset: 0, overflow: false, mode: 'none' },
    ]);
});

test('cumulative page offsets classify manual breaks and oversized overflow separately', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.deepEqual(calculateTiptapCumulativePageBlockOffsets(geometry, [
        { top: 320, height: 40, forceNextPage: true },
        { top: 1200, height: 900 },
    ]), [
        { offset: 780, overflow: false, mode: 'manual-break' },
        { offset: 0, overflow: true, mode: 'oversized-overflow' },
    ]);
});

test('cumulative page offsets keep manual breaks strongest when blocks also overflow', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.deepEqual(calculateTiptapCumulativePageBlockOffsets(geometry, [
        { top: 850, height: 900, forceNextPage: true },
    ]), [
        { offset: 250, overflow: true, mode: 'manual-break' },
    ]);
});

test('cumulative page offsets preserve manual breaks after prior automatic offsets', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        pageGap: 24,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.deepEqual(calculateTiptapCumulativePageBlockOffsets(geometry, [
        { top: 850, height: 60 },
        { top: 910, height: 40, forceNextPage: true },
    ]), [
        { offset: 274, overflow: false, mode: 'automatic-offset' },
        { offset: 964, overflow: false, mode: 'manual-break' },
    ]);
});

test('cumulative page offsets do not mutate source block measurements', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });
    const blocks = [
        { top: 850, height: 60 },
    ];

    calculateTiptapCumulativePageBlockOffsets(geometry, blocks);

    assert.deepEqual(blocks, [
        { top: 850, height: 60 },
    ]);
});
