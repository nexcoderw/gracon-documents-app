'use client';

// Owns the modal print-preview shell while keeping export on the stable Gracon canvas.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { saveRenderedDocumentAs } from '@/lib/export-document';
import { paginateTiptapDocument } from '@/lib/tiptap/tiptap-page-breaks';
import { createTiptapExportPageGeometry } from '@/lib/tiptap/tiptap-page-geometry';
import { DEFAULT_DOCUMENT_LAYOUT, type DocumentLayout } from '@/lib/document-layout';
import { buildDocumentLayoutStyle } from '@/lib/document-layout';
import { PagedDocumentCanvas } from './PagedDocumentCanvas';
import { A4_PAPER_HEIGHT_PX } from '@/constants/document-paper';
import type { CommentAnchorInput } from '@/store/editor/comment-anchor-extension';
import { Button } from '@/components/ui';
import styles from './DocumentPrintPreviewDialog.module.css';

interface DocumentPrintPreviewDialogProps {
    documentId: string;
    title: string;
    status: string;
    content: Record<string, unknown> | null;
    layout: DocumentLayout;
    pageCount: number;
    pageHeight: number;
    contentHeight: number;
    overlayContent?: ReactNode;
    onClose: () => void;
}

function getPreviewZoom() {
    if (typeof window === 'undefined') return 0.72;
    if (window.innerWidth < 720) return 0.46;
    if (window.innerWidth < 1100) return 0.58;
    return 0.72;
}

function usesDefaultHeaderFooterChrome(layout: DocumentLayout) {
    const defaults = DEFAULT_DOCUMENT_LAYOUT.headerFooter;

    return layout.headerFooter.headerEnabled === defaults.headerEnabled &&
        layout.headerFooter.footerEnabled === defaults.footerEnabled &&
        layout.headerFooter.pageNumbersEnabled === defaults.pageNumbersEnabled &&
        layout.headerFooter.headerText.trim() === defaults.headerText &&
        layout.headerFooter.footerText.trim() === defaults.footerText;
}

function getPreviewLayout(layout: DocumentLayout): DocumentLayout {
    if (!usesDefaultHeaderFooterChrome(layout)) return layout;

    return {
        ...layout,
        headerFooter: {
            ...layout.headerFooter,
            headerEnabled: false,
            footerEnabled: false,
            pageNumbersEnabled: false,
        },
    };
}

type PrintPreviewExportSource = 'gracon-canvas';

/**
 * Waits for the fonts and images that change how the document paginates.
 *
 * @param root Rendered preview surface.
 */
async function waitForPreviewAssets(root: HTMLElement) {
    if ('fonts' in document) {
        await document.fonts.ready;
    }

    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(images.map((image) => new Promise<void>((resolve) => {
        if (image.complete) {
            resolve();
            return;
        }

        const finish = () => resolve();
        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
    })));
}

function removeDetachedPaginatedExportHosts() {
    document
        .querySelectorAll('[data-print-preview-export-host="true"]')
        .forEach((element) => element.remove());
}

function auditPrintPreviewCleanup() {
    if (process.env.NODE_ENV === 'production') return;

    const leakedExportHosts = document.querySelectorAll('[data-print-preview-export-host="true"]').length;
    const leakedHiddenEditors = 0;

    if (leakedExportHosts > 0 || leakedHiddenEditors > 0) {
        console.warn('Print preview cleanup audit found stale hidden preview DOM.', {
            leakedExportHosts,
            leakedHiddenEditors,
        });
    }
}

function clearPreviewElementRefs(
    ...refs: Array<RefObject<HTMLDivElement | null>>
) {
    refs.forEach((ref) => {
        ref.current = null;
    });
}

/**
 * Displays the read-only document print preview and keeps PDF export on the stable renderer.
 */
export function DocumentPrintPreviewDialog({
    documentId,
    title,
    status,
    content,
    layout,
    pageCount,
    pageHeight,
    contentHeight,
    overlayContent,
    onClose,
}: DocumentPrintPreviewDialogProps) {
    const previewCanvasRef = useRef<HTMLDivElement>(null);
    const isMountedRef = useRef(false);
    const [savingPdf, setSavingPdf] = useState(false);
    const [zoom, setZoom] = useState(getPreviewZoom);
    const previewLayout = getPreviewLayout(layout);
    const previewPaperStyle = buildDocumentLayoutStyle(previewLayout);
    const [previewEditor, setPreviewEditor] = useState<Editor | null>(null);
    const [paginatedPageCount, setPaginatedPageCount] = useState(pageCount);
    const [paginating, setPaginating] = useState(true);

    useEffect(() => {
        isMountedRef.current = true;
        document.body.classList.add('document-print-preview-active');
        let resizeFrame: number | null = null;
        const onResize = () => {
            if (resizeFrame !== null) {
                window.cancelAnimationFrame(resizeFrame);
            }
            resizeFrame = window.requestAnimationFrame(() => {
                resizeFrame = null;
                setZoom(getPreviewZoom());
            });
        };
        window.addEventListener('resize', onResize);
        return () => {
            isMountedRef.current = false;
            document.body.classList.remove('document-print-preview-active');
            window.removeEventListener('resize', onResize);
            if (resizeFrame !== null) {
                window.cancelAnimationFrame(resizeFrame);
            }
            removeDetachedPaginatedExportHosts();
            clearPreviewElementRefs(previewCanvasRef);
            auditPrintPreviewCleanup();
        };
    }, []);

    // Pagination runs on the surface the user is looking at, so the preview and
    // the downloaded PDF are the same rendered document rather than two attempts
    // at the same layout.
    useEffect(() => {
        const root = previewCanvasRef.current?.querySelector('.ProseMirror');
        if (!previewEditor || !(root instanceof HTMLElement)) return;

        let cancelled = false;
        setPaginating(true);

        const run = async () => {
            await waitForPreviewAssets(root);
            if (cancelled) return;

            const result = paginateTiptapDocument(root, createTiptapExportPageGeometry({
                pageHeight: A4_PAPER_HEIGHT_PX,
                margins: previewLayout.margins,
            }));

            if (cancelled) return;
            setPaginatedPageCount(result.pageCount);
            setPaginating(false);
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [previewEditor, previewLayout.margins, content]);

    async function handleSavePdf() {
        setSavingPdf(true);
        try {
            const exportHost = previewCanvasRef.current;
            const exportRoot = exportHost?.querySelector(
                '[data-document-export-root="true"]',
            ) as HTMLElement | null;
            if (!exportRoot) return;

            await saveRenderedDocumentAs('pdf', title, exportRoot);
        } finally {
            removeDetachedPaginatedExportHosts();
            auditPrintPreviewCleanup();
            if (isMountedRef.current) {
                setSavingPdf(false);
            }
        }
    }

    const emptyAnchors: CommentAnchorInput[] = [];
    const preparedPdfExportSource: PrintPreviewExportSource = 'gracon-canvas';
    const continuousPreviewCanvas = (
        <PagedDocumentCanvas
            canvasRef={previewCanvasRef}
            documentId={`${documentId}-print-preview`}
            title={title}
            status={status}
            content={content}
            isReadOnly
            zoomScale={zoom}
            pageCount={paginatedPageCount}
            pageHeight={pageHeight}
            contentHeight={contentHeight}
            printLayout
            showFormattingMarks={false}
            paperStyle={previewPaperStyle}
            headerFooter={previewLayout.headerFooter}
            showRepeatedPageChrome
            pageGap={0}
            overlayContent={overlayContent}
            commentAnchors={emptyAnchors}
            onEditorReady={setPreviewEditor}
        />
    );

    return (
        <div
            className={styles.preview}
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-print-preview-title"
            data-prepared-pdf-export-source={preparedPdfExportSource}
        >
            <div className={styles.toolbar}>
                <div>
                    <p className={styles.eyebrow}>Print preview</p>
                    <h2 id="document-print-preview-title">{title}</h2>
                    <span aria-live="polite">
                        {paginating
                            ? 'Laying out pages…'
                            : `${paginatedPageCount} page${paginatedPageCount === 1 ? '' : 's'} · Exactly what the PDF will contain`}
                    </span>
                </div>
                <div className={styles.actions}>
                    <button type="button" className={styles.ghostButton} onClick={onClose}>
                        Close
                    </button>
                    <button
                        type="button"
                        className={styles.ghostButton}
                        onClick={() => window.print()}
                    >
                        Print
                    </button>
                    <Button
                        type="button"
                        loading={savingPdf}
                        loadingText="Preparing..."
                        disabled={paginating}
                        onClick={() => { void handleSavePdf(); }}
                    >
                        Save PDF
                    </Button>
                </div>
            </div>
            <div className={styles.body}>
                {continuousPreviewCanvas}
            </div>
        </div>
    );
}
