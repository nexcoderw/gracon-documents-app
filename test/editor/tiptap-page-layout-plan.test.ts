/**
 * Regression tests for Gracon page placement rules.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTiptapPageGeometry } from '../../src/lib/tiptap/tiptap-page-geometry.ts';
import { resolveTiptapPlacement } from '../../src/lib/tiptap/tiptap-page-layout-plan.ts';

const GEOMETRY = createTiptapPageGeometry({
    pageHeight: 1000,
    headerHeight: 40,
    footerHeight: 50,
    margins: { top: 60, right: 80, bottom: 70, left: 80 },
});

test('a unit inside the printable region is left alone', () => {
    assert.deepEqual(
        resolveTiptapPlacement(GEOMETRY, { top: 200, bottom: 260 }),
        { action: 'keep', push: 0, targetTop: 200 },
    );
});

test('a unit crossing the footer moves to the next printable region', () => {
    assert.deepEqual(
        resolveTiptapPlacement(GEOMETRY, { top: 850, bottom: 910 }),
        { action: 'push', push: 250, targetTop: 1100 },
    );
});

test('a unit rendered into the page header drops into the page body', () => {
    assert.deepEqual(
        resolveTiptapPlacement(GEOMETRY, { top: 20, bottom: 60 }),
        { action: 'push', push: 80, targetTop: 100 },
    );
});

test('a splittable unit taller than a page is divided rather than moved', () => {
    assert.deepEqual(
        resolveTiptapPlacement(GEOMETRY, { top: 200, bottom: 1400, splittable: true }),
        { action: 'split', push: 0, targetTop: 200 },
    );
});

test('an unsplittable unit taller than a page is reported as overflow', () => {
    assert.deepEqual(
        resolveTiptapPlacement(GEOMETRY, { top: 200, bottom: 1400 }),
        { action: 'overflow', push: 0, targetTop: 200 },
    );
});

test('an explicit page break moves a unit that does not open a page', () => {
    const placement = resolveTiptapPlacement(GEOMETRY, {
        top: 320,
        bottom: 360,
        forceNextPage: true,
    });

    assert.equal(placement.action, 'push');
    assert.equal(placement.targetTop, 1100);
});

test('an explicit page break on a unit already starting a page does nothing', () => {
    assert.deepEqual(
        resolveTiptapPlacement(GEOMETRY, { top: 100, bottom: 160, forceNextPage: true }),
        { action: 'keep', push: 0, targetTop: 100 },
    );
});

test('placement accounts for the live page gap when one is configured', () => {
    const geometry = createTiptapPageGeometry({
        pageHeight: 1000,
        pageGap: 24,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
    });

    assert.deepEqual(
        resolveTiptapPlacement(geometry, { top: 850, bottom: 910 }),
        { action: 'push', push: 274, targetTop: 1124 },
    );
});

test('page safety padding pulls the printable region in on both edges', () => {
    const padded = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
        contentSafetyPadding: 18,
    });

    assert.equal(padded.printableTop, 118);
    assert.equal(padded.printableBottom, 862);
    assert.equal(resolveTiptapPlacement(padded, { top: 800, bottom: 870 }).action, 'push');
});

test('placement never returns a negative push', () => {
    const placement = resolveTiptapPlacement(GEOMETRY, {
        top: 1099,
        bottom: 1101,
        forceNextPage: true,
    });

    assert.ok(placement.push >= 0);
});
