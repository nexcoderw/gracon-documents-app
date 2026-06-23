import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    INSERT_ACTION_IDS,
    INSERT_ACTIONS,
    INSERT_MENU_ITEMS,
} from '../../src/constants/insert-menu.ts';

test('insert menu does not expose page or section boundaries', () => {
    assert.equal('pageBreak' in INSERT_ACTION_IDS, false);
    assert.equal('sectionBreak' in INSERT_ACTION_IDS, false);
    assert.equal('pageBreak' in INSERT_ACTIONS, false);
    assert.equal('sectionBreak' in INSERT_ACTIONS, false);
    assert.ok(!INSERT_MENU_ITEMS.some((item) => (
        item.type === 'action' && (
            item.actionId === 'insert:page-break' ||
            item.actionId === 'insert:section-break'
        )
    )));
});

test('insert menu exposes schema-backed page-break-before action only', () => {
    assert.equal(INSERT_ACTION_IDS.pageBreakBefore, 'insert:page-break-before');
    assert.equal(INSERT_ACTIONS.pageBreakBefore.status, 'ready');
    assert.ok(INSERT_MENU_ITEMS.some((item) => (
        item.type === 'action' &&
        item.actionId === INSERT_ACTION_IDS.pageBreakBefore
    )));
});

test('insert menu exposes header and footer settings', () => {
    assert.equal(INSERT_ACTIONS.headerFooter.status, 'ready');
    assert.ok(INSERT_MENU_ITEMS.some((item) => (
        item.type === 'action' && item.actionId === INSERT_ACTION_IDS.headerFooter
    )));
});

test('insert menu exposes signature blocks as a ready action', () => {
    assert.equal(INSERT_ACTION_IDS.signatureBlocks, 'insert:signature-blocks');
    assert.equal(INSERT_ACTIONS.signatureBlocks.status, 'ready');
    assert.ok(INSERT_MENU_ITEMS.some((item) => (
        item.type === 'action' && item.actionId === INSERT_ACTION_IDS.signatureBlocks
    )));
});

test('insert menu exposes comments as a ready action', () => {
    assert.equal(INSERT_ACTION_IDS.comment, 'insert:comment');
    assert.equal(INSERT_ACTIONS.comment.status, 'ready');
    assert.ok(INSERT_MENU_ITEMS.some((item) => (
        item.type === 'action' &&
        item.actionId === INSERT_ACTION_IDS.comment &&
        !item.disabled
    )));
});

test('insert menu exposes generated document aids as ready actions', () => {
    assert.equal(INSERT_ACTION_IDS.tableOfContents, 'insert:table-of-contents');
    assert.equal(INSERT_ACTIONS.tableOfContents.status, 'ready');
    assert.equal(INSERT_ACTION_IDS.footnote, 'insert:footnote');
    assert.equal(INSERT_ACTIONS.footnote.status, 'ready');
    assert.ok(INSERT_MENU_ITEMS.some((item) => (
        item.type === 'action' &&
        item.actionId === INSERT_ACTION_IDS.tableOfContents &&
        !item.disabled
    )));
    assert.ok(INSERT_MENU_ITEMS.some((item) => (
        item.type === 'action' &&
        item.actionId === INSERT_ACTION_IDS.footnote &&
        !item.disabled
    )));
});
