/**
 * Regression tests for line-aware Gracon page layout planning.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTiptapPageGeometry } from '../../src/lib/tiptap/tiptap-page-geometry.ts';
import {
    planTiptapPageLayout,
    planTiptapPageOffsetCorrections,
    type TiptapPageBlockLayoutInput,
    type TiptapPageLineMeasurement,
} from '../../src/lib/tiptap/tiptap-page-layout-plan.ts';

const GEOMETRY = createTiptapPageGeometry({
    pageHeight: 1000,
    headerHeight: 40,
    footerHeight: 50,
    margins: { top: 60, right: 80, bottom: 70, left: 80 },
});

/** Builds evenly spaced line boxes for a paragraph starting at `top`. */
function buildLines(top: number, count: number, lineHeight = 20): TiptapPageLineMeasurement[] {
    return Array.from({ length: count }, (_, index) => ({
        top: top + (index * lineHeight),
        bottom: top + (index * lineHeight) + lineHeight,
    }));
}

/** Builds a splittable paragraph block from its line boxes. */
function buildParagraph(top: number, lineCount: number, lineHeight = 20): TiptapPageBlockLayoutInput {
    return {
        top,
        height: lineCount * lineHeight,
        splittable: true,
        lines: buildLines(top, lineCount, lineHeight),
    };
}

test('paragraphs that fit on the current page are left untouched', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [buildParagraph(200, 4)]);

    assert.deepEqual(plan, {
        offset: 0,
        targetTop: 200,
        spacers: [],
        overflow: false,
        mode: 'none',
    });
});

test('a paragraph crossing the footer continues on the next page at a line boundary', () => {
    // Lines run 820-840, 840-860, 860-880, 880-900: the fourth line crosses the
    // printable bottom of 880 and must start on page two.
    const [plan] = planTiptapPageLayout(GEOMETRY, [buildParagraph(820, 4)]);

    assert.equal(plan.mode, 'line-split');
    assert.equal(plan.offset, 0);
    assert.deepEqual(plan.spacers, [{ lineIndex: 3, height: 220, targetTop: 1100 }]);
    assert.equal(plan.overflow, false);
});

test('a paragraph longer than one page splits once per page seam', () => {
    const plan = planTiptapPageLayout(GEOMETRY, [buildParagraph(100, 80)])[0];

    assert.equal(plan.mode, 'line-split');
    assert.equal(plan.overflow, false);
    assert.equal(plan.spacers.length, 2);
    assert.deepEqual(plan.spacers.map((spacer) => spacer.lineIndex), [39, 78]);
});

test('a paragraph whose first line does not fit moves as a whole instead of splitting', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [buildParagraph(870, 3)]);

    assert.equal(plan.offset, 230);
    assert.deepEqual(plan.spacers, []);
    assert.equal(plan.mode, 'automatic-offset');
});

test('later blocks are measured after earlier line splits displace them', () => {
    const plans = planTiptapPageLayout(GEOMETRY, [
        buildParagraph(820, 4),
        { top: 900, height: 40 },
    ]);

    // The paragraph pushed 220px of content down, so the following block starts
    // at 1120 — inside page two's printable region, needing no offset.
    assert.equal(plans[1].offset, 0);
    assert.equal(plans[1].mode, 'none');
    assert.equal(plans[1].targetTop, 1120);
});

test('manual page breaks still move a splittable block to the next page', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [
        { ...buildParagraph(320, 2), forceNextPage: true },
    ]);

    assert.equal(plan.mode, 'manual-break');
    assert.equal(plan.offset, 780);
    assert.deepEqual(plan.spacers, []);
});

test('manual breaks on long paragraphs move the block and then split it', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [
        { ...buildParagraph(320, 60), forceNextPage: true },
    ]);

    assert.equal(plan.mode, 'manual-break');
    assert.equal(plan.offset, 780);
    assert.equal(plan.spacers.length, 1);
});

test('unsplittable blocks keep whole-block behavior', () => {
    const plans = planTiptapPageLayout(GEOMETRY, [
        { top: 850, height: 60 },
        { top: 910, height: 900 },
    ]);

    assert.equal(plans[0].offset, 250);
    assert.equal(plans[0].mode, 'automatic-offset');
    assert.equal(plans[0].targetTop, 1100);
    assert.equal(plans[1].mode, 'oversized-overflow');
    assert.equal(plans[1].overflow, true);
});

test('a single line taller than a printable page is reported as overflow', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [{
        top: 100,
        height: 900,
        splittable: true,
        lines: [
            { top: 100, bottom: 1000 },
            { top: 1000, bottom: 1020 },
        ],
    }]);

    assert.equal(plan.overflow, true);
});

test('blocks starting inside the page header are pushed into the printable area', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [{ top: 20, height: 40 }]);

    assert.deepEqual(plan, {
        offset: 80,
        targetTop: 100,
        spacers: [],
        overflow: false,
        mode: 'automatic-offset',
    });
});

test('planning never mutates the measurements it was given', () => {
    const blocks = [buildParagraph(820, 4)];
    const snapshot = JSON.stringify(blocks);

    planTiptapPageLayout(GEOMETRY, blocks);

    assert.equal(JSON.stringify(blocks), snapshot);
});

test('a forced break is skipped when the block already starts a page', () => {
    // 100 is exactly the printable top of page one.
    const [plan] = planTiptapPageLayout(GEOMETRY, [
        { ...buildParagraph(100, 3), forceNextPage: true },
    ]);

    assert.deepEqual(plan, {
        offset: 0,
        targetTop: 100,
        spacers: [],
        overflow: false,
        mode: 'none',
    });
});

test('a forced break inside page chrome moves to that page, not the next one', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [
        { top: 40, height: 40, forceNextPage: true },
    ]);

    assert.equal(plan.offset, 60);
});

test('page safety padding keeps content clear of header and footer chrome', () => {
    const padded = createTiptapPageGeometry({
        pageHeight: 1000,
        headerHeight: 40,
        footerHeight: 50,
        margins: { top: 60, right: 80, bottom: 70, left: 80 },
        contentSafetyPadding: 18,
    });

    assert.equal(padded.printableTop, 118);
    assert.equal(padded.printableBottom, 862);
    assert.equal(padded.contentSafetyPadding, 18);

    // A block that fits without padding now breaks earlier because of it.
    const [plan] = planTiptapPageLayout(padded, [{ top: 800, height: 70 }]);
    assert.equal(plan.mode, 'automatic-offset');
});

test('every planned offset carries the page coordinate it targets', () => {
    const [plan] = planTiptapPageLayout(GEOMETRY, [buildParagraph(870, 3)]);

    // The block moves to page two's printable top, and that is what a rendered
    // offset is later verified against.
    assert.equal(plan.offset, 230);
    assert.equal(plan.targetTop, 1100);
});

test('offset corrections compound down the document instead of per offset', () => {
    // Every seam renders 18px lower than planned, which is what turns a small
    // per-page error into a large gap dozens of pages later.
    const corrections = planTiptapPageOffsetCorrections([
        { key: 'a', height: 200, targetTop: 1100, measuredTop: 1118 },
        { key: 'b', height: 200, targetTop: 2200, measuredTop: 2236 },
        { key: 'c', height: 200, targetTop: 3300, measuredTop: 3354 },
    ]);

    // Each correction removes only this seam's own error, because the earlier
    // corrections already lifted the content below them.
    assert.deepEqual(corrections, [
        { key: 'a', currentHeight: 200, correctedHeight: 182 },
        { key: 'b', currentHeight: 200, correctedHeight: 182 },
        { key: 'c', currentHeight: 200, correctedHeight: 182 },
    ]);
});

test('offset corrections push content forward when it lands short of its target', () => {
    const corrections = planTiptapPageOffsetCorrections([
        { key: 'a', height: 120, targetTop: 1100, measuredTop: 1040 },
    ]);

    assert.deepEqual(corrections, [
        { key: 'a', currentHeight: 120, correctedHeight: 180 },
    ]);
});

test('offset corrections ignore differences within tolerance', () => {
    assert.deepEqual(
        planTiptapPageOffsetCorrections([
            { key: 'a', height: 200, targetTop: 1100, measuredTop: 1100.5 },
        ]),
        [],
    );
});

test('offset corrections never produce a negative height', () => {
    const corrections = planTiptapPageOffsetCorrections([
        { key: 'a', height: 20, targetTop: 1000, measuredTop: 1400 },
    ]);

    assert.deepEqual(corrections, [
        { key: 'a', currentHeight: 20, correctedHeight: 0 },
    ]);
});
