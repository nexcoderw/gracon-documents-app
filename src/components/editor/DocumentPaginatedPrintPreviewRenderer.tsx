'use client';

/**
 * Isolated print-preview pagination renderer.
 *
 * This component is intentionally not used by the live editor. It mounts a
 * short-lived read-only TipTap instance with tiptap-pagination-plus so preview
 * page breaks can be tested without letting third-party pagination touch
 * autosave, editing, rulers, or persisted document content.
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontFamily, FontSize, BackgroundColor } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { PaginationPlus } from 'tiptap-pagination-plus';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { A4_PAPER_HEIGHT_PX, A4_PAPER_WIDTH_PX, PAPER_PAGE_GAP_PX } from '@/constants/document-paper';
import type { DocumentLayout } from '@/lib/document-layout';
import { normalizeEditorLinkUrl } from '@/lib/editor-link';
import { removeDocumentBoundariesFromTiptapContent } from '@/lib/remove-document-boundaries';
import { ListStyleExtension } from '@/store/editor/list-style-extension';
import { ParagraphLayoutExtension } from '@/store/editor/paragraph-layout-extension';
import { SignatureBlockExtension } from '@/store/editor/signature-block-extension';
import { ImportedDocxStyleExtension } from '@/store/editor/imported-docx-style-extension';
import { ResizableImageExtension } from '@/store/editor/resizable-image-extension';
import { StyledTableCell, StyledTableHeader } from '@/store/editor/table-cell-style-extension';
import styles from './document-paginated-print-preview-renderer.module.css';

interface DocumentPaginatedPrintPreviewRendererProps {
    documentId: string;
    title: string;
    status: string;
    content: Record<string, unknown> | null;
    layout: DocumentLayout;
    zoom: number;
    overlayContent?: ReactNode;
    onReady: (rootEl: HTMLElement, pageCount: number) => void;
    onFailed: () => void;
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
        switch (character) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case '\'':
                return '&#39;';
            default:
                return character;
        }
    });
}

function getHeaderFooterOptions(title: string, status: string, layout: DocumentLayout) {
    const headerText = escapeHtml(layout.headerFooter.headerText || title);
    const footerText = escapeHtml(layout.headerFooter.footerText || `${status.toLowerCase()} document`);
    const pageNumberText = layout.headerFooter.pageNumbersEnabled ? 'Page {page}' : '';

    return {
        headerLeft: layout.headerFooter.headerEnabled ? headerText : '',
        headerRight: layout.headerFooter.headerEnabled ? pageNumberText : '',
        footerLeft: layout.headerFooter.footerEnabled ? footerText : '',
        footerRight: layout.headerFooter.footerEnabled ? pageNumberText : '',
    };
}

function removeDetachedPaginationStyles() {
    if (document.querySelector('.rm-with-pagination')) return;

    document
        .querySelectorAll('style[data-rm-pagination-style]')
        .forEach((styleEl) => styleEl.remove());
}

function getRenderedPageCount(rootEl: HTMLElement) {
    const pagesEl = rootEl.querySelector('[data-rm-pagination]');
    const count = pagesEl?.children.length ?? 0;
    return Math.max(count, 1);
}

/**
 * Renders read-only paginated preview content and reports a stable export root.
 */
export function DocumentPaginatedPrintPreviewRenderer({
    documentId,
    title,
    status,
    content,
    layout,
    zoom,
    overlayContent,
    onReady,
    onFailed,
}: DocumentPaginatedPrintPreviewRendererProps) {
    const readyReportedRef = useRef(false);
    const frameRef = useRef<HTMLDivElement>(null);
    const [renderHeight, setRenderHeight] = useState(A4_PAPER_HEIGHT_PX);
    const [isReady, setIsReady] = useState(false);
    const sanitizedContent = useMemo(
        () => removeDocumentBoundariesFromTiptapContent(content)
            ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        [content],
    );
    const headerFooterOptions = useMemo(
        () => getHeaderFooterOptions(title, status, layout),
        [layout, status, title],
    );

    const editor = useEditor({
        immediatelyRender: false,
        editable: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4, 5, 6] },
                codeBlock: { languageClassPrefix: 'language-' },
                link: false,
                dropcursor: false,
            }),
            TextStyle,
            Color,
            BackgroundColor,
            FontFamily,
            FontSize,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: false }),
            TableRow,
            StyledTableHeader,
            StyledTableCell,
            Highlight.configure({ multicolor: true }),
            ResizableImageExtension.configure({
                allowBase64: false,
                inline: false,
                HTMLAttributes: {
                    loading: 'lazy',
                    decoding: 'async',
                },
            }),
            Link.configure({
                openOnClick: false,
                autolink: false,
                linkOnPaste: false,
                isAllowedUri: (url) => normalizeEditorLinkUrl(url ?? '').ok,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                },
            }),
            ListStyleExtension,
            ParagraphLayoutExtension,
            ImportedDocxStyleExtension,
            SignatureBlockExtension,
            PaginationPlus.configure({
                enabled: true,
                pageHeight: A4_PAPER_HEIGHT_PX,
                pageWidth: A4_PAPER_WIDTH_PX,
                pageGap: PAPER_PAGE_GAP_PX,
                pageBreakBackground: '#ffffff',
                pageGapBorderSize: 0,
                pageGapBorderColor: 'transparent',
                marginTop: layout.margins.top,
                marginRight: layout.margins.right,
                marginBottom: layout.margins.bottom,
                marginLeft: layout.margins.left,
                contentMarginTop: 0,
                contentMarginBottom: 0,
                ...headerFooterOptions,
            }),
        ],
        content: sanitizedContent,
    });

    useEffect(() => {
        if (!editor) return;
        editor.commands.setContent(sanitizedContent, { emitUpdate: false });
    }, [editor, sanitizedContent]);

    useEffect(() => {
        if (!editor) return undefined;

        let animationFrame = 0;
        let cancelled = false;
        const startedAt = performance.now();

        const checkReady = () => {
            if (cancelled) return;

            const rootEl = frameRef.current;
            const editorDom = rootEl?.querySelector('.ProseMirror.rm-with-pagination');
            const pagesEl = editorDom?.querySelector('[data-rm-pagination]');

            if (rootEl && editorDom instanceof HTMLElement && pagesEl) {
                const pageCount = getRenderedPageCount(editorDom);
                const measuredHeight = Math.max(
                    editorDom.scrollHeight,
                    (A4_PAPER_HEIGHT_PX * pageCount) + (PAPER_PAGE_GAP_PX * Math.max(pageCount - 1, 0)),
                );

                rootEl.dataset.documentPageCount = String(pageCount);
                rootEl.dataset.documentPageHeight = String(A4_PAPER_HEIGHT_PX);
                rootEl.dataset.documentPageGap = String(PAPER_PAGE_GAP_PX);
                setRenderHeight(measuredHeight);

                if (!readyReportedRef.current) {
                    readyReportedRef.current = true;
                    setIsReady(true);
                    onReady(rootEl, pageCount);
                }
                return;
            }

            if (performance.now() - startedAt > 4500) {
                onFailed();
                return;
            }

            animationFrame = window.requestAnimationFrame(checkReady);
        };

        animationFrame = window.requestAnimationFrame(checkReady);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(animationFrame);
            window.setTimeout(removeDetachedPaginationStyles, 0);
        };
    }, [editor, onFailed, onReady]);

    return (
        <div className={styles.stage} data-document-paginated-preview-ready={isReady}>
            <div
                className={styles.scaledShell}
                style={{
                    width: A4_PAPER_WIDTH_PX * zoom,
                    minHeight: renderHeight * zoom,
                }}
            >
                <div
                    key={documentId}
                    ref={frameRef}
                    className={styles.exportRoot}
                    data-document-paginated-export-root="true"
                    data-document-title={title}
                    data-document-status={status}
                    style={{
                        transform: `scale(${zoom})`,
                    }}
                >
                    <div className="tiptap-editor">
                        <EditorContent editor={editor} />
                    </div>
                    {overlayContent && (
                        <div className={styles.overlayLayer} aria-hidden="true">
                            {overlayContent}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
