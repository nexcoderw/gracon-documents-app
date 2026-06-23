import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    hasParagraphPageBreakBefore,
    isDocumentPageBoundaryElement,
} from '../../src/lib/export-document-page-boundary.ts';

function classListFor(classNames: string[]) {
    const names = new Set(classNames);

    return {
        contains: (className: string) => names.has(className),
    } as Pick<DOMTokenList, 'contains'>;
}

test('isDocumentPageBoundaryElement ignores legacy manual page breaks', () => {
    assert.equal(
        isDocumentPageBoundaryElement({
            classList: classListFor(['document-page-break']),
        }),
        false,
    );
});

test('isDocumentPageBoundaryElement ignores legacy section breaks', () => {
    assert.equal(
        isDocumentPageBoundaryElement({
            classList: classListFor(['document-section-break']),
        }),
        false,
    );
});

test('isDocumentPageBoundaryElement ignores normal editor blocks', () => {
    assert.equal(
        isDocumentPageBoundaryElement({
            classList: classListFor(['tableWrapper']),
        }),
        false,
    );
});

test('hasParagraphPageBreakBefore reads schema-backed paragraph breaks', () => {
    assert.equal(
        hasParagraphPageBreakBefore({
            getAttribute: (name: string) => (
                name === 'data-page-break-before' ? 'true' : null
            ),
        }),
        true,
    );
    assert.equal(
        hasParagraphPageBreakBefore({
            getAttribute: () => null,
        }),
        false,
    );
});
