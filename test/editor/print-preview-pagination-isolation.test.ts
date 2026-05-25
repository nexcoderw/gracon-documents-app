/**
 * Guards the print-preview pagination dependency boundary.
 *
 * The app may use tiptap-pagination-plus only in the isolated read-only print
 * preview renderer. Live editor files must not import it because that would
 * reintroduce the freezing risk into editable document sessions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const PROJECT_ROOT = process.cwd();

function readProjectFile(relativePath: string) {
    return readFileSync(join(PROJECT_ROOT, relativePath), 'utf8');
}

test('live editor does not import tiptap-pagination-plus', () => {
    const liveEditorFiles = [
        'src/components/editor/RichTextEditor.tsx',
        'src/components/editor/PagedDocumentCanvas.tsx',
    ];

    liveEditorFiles.forEach((relativePath) => {
        assert.equal(
            readProjectFile(relativePath).includes('tiptap-pagination-plus'),
            false,
            `${relativePath} must not import preview-only pagination`,
        );
    });
});

test('preview pagination dependency remains isolated to the preview renderer', () => {
    const previewRenderer = readProjectFile('src/components/editor/DocumentPaginatedPrintPreviewRenderer.tsx');
    const previewDialog = readProjectFile('src/components/editor/DocumentPrintPreviewDialog.tsx');

    assert.match(previewRenderer, /from 'tiptap-pagination-plus'/);
    assert.equal(
        previewDialog.includes('tiptap-pagination-plus'),
        false,
        'DocumentPrintPreviewDialog should coordinate the renderer without importing the package directly',
    );
});
