/**
 * Regression tests for Gracon-owned TipTap page geometry.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createTiptapExportPageGeometry,
    createTiptapLivePageGeometry,
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
