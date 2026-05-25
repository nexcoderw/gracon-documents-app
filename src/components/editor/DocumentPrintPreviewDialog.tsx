'use client';

// Owns the modal print-preview shell while keeping experimental pagination isolated.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { saveCanvasPagesAsPdf, saveRenderedDocumentAs } from '@/lib/export-document';
import {
    A4_PAPER_HEIGHT_PX,
    A4_PAPER_WIDTH_PX,
    PAPER_PAGE_GAP_PX,
} from '@/constants/document-paper';
import { DEFAULT_DOCUMENT_LAYOUT, type DocumentLayout } from '@/lib/document-layout';
import { buildDocumentLayoutStyle } from '@/lib/document-layout';
import { DocumentPaginatedPrintPreviewRenderer } from './DocumentPaginatedPrintPreviewRenderer';
import { PagedDocumentCanvas } from './PagedDocumentCanvas';
import type { CommentAnchorInput } from '@/store/editor/comment-anchor-extension';
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

type PrintPreviewExportSource = 'paginated-preview' | 'gracon-canvas';

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

async function waitForRenderableAssets(rootEl: HTMLElement) {
    if ('fonts' in document) {
        await document.fonts.ready;
    }

    const images = Array.from(rootEl.querySelectorAll('img'));
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

function getPaginatedExportPageCount(rootEl: HTMLElement) {
    const parsedPageCount = Number.parseInt(rootEl.dataset.documentPageCount ?? '', 10);
    if (Number.isFinite(parsedPageCount) && parsedPageCount > 0) return parsedPageCount;

    const editorEl = rootEl.querySelector('.ProseMirror.rm-with-pagination');
    const pagesEl = editorEl?.querySelector('[data-rm-pagination]');
    return Math.max(pagesEl?.children.length ?? 1, 1);
}

function slicePaginatedSnapshotIntoA4Pages(
    snapshotCanvas: HTMLCanvasElement,
    pageCount: number,
    cssHeight: number,
) {
    const pixelsPerCssPixel = snapshotCanvas.height / cssHeight;
    const pageHeightPixels = Math.max(Math.round(A4_PAPER_HEIGHT_PX * pixelsPerCssPixel), 1);
    const pageGapPixels = Math.max(Math.round(PAPER_PAGE_GAP_PX * pixelsPerCssPixel), 0);

    return Array.from({ length: pageCount }, (_, pageIndex) => {
        const pageCanvas = document.createElement('canvas');
        const sourceY = pageIndex * (pageHeightPixels + pageGapPixels);
        const sourceHeight = Math.min(pageHeightPixels, snapshotCanvas.height - sourceY);

        pageCanvas.width = snapshotCanvas.width;
        pageCanvas.height = pageHeightPixels;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Failed to prepare paginated export canvas.');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(
            snapshotCanvas,
            0,
            sourceY,
            snapshotCanvas.width,
            sourceHeight,
            0,
            0,
            pageCanvas.width,
            sourceHeight,
        );

        return pageCanvas;
    });
}

async function capturePaginatedPreviewPages(rootEl: HTMLElement) {
    const pageCount = getPaginatedExportPageCount(rootEl);
    const cssHeight = (A4_PAPER_HEIGHT_PX * pageCount) + (PAPER_PAGE_GAP_PX * Math.max(pageCount - 1, 0));
    const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2);

    await waitForRenderableAssets(rootEl);

    const { default: html2canvas } = await import('html2canvas');
    const snapshotCanvas = await html2canvas(rootEl, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
        logging: false,
        width: A4_PAPER_WIDTH_PX,
        height: cssHeight,
        windowWidth: Math.max(window.innerWidth, A4_PAPER_WIDTH_PX),
        windowHeight: Math.max(window.innerHeight, cssHeight),
        onclone: (clonedDocument) => {
            const clonedRoot = clonedDocument.querySelector('[data-document-paginated-export-root="true"]') as HTMLElement | null;
            if (!clonedRoot) return;

            clonedRoot.style.transform = 'none';
            clonedRoot.style.width = `${A4_PAPER_WIDTH_PX}px`;
            clonedRoot.style.minHeight = `${cssHeight}px`;
            clonedRoot.style.boxShadow = 'none';
        },
    });

    return slicePaginatedSnapshotIntoA4Pages(snapshotCanvas, pageCount, cssHeight);
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
    const paginatedExportRootRef = useRef<HTMLElement | null>(null);
    const isMountedRef = useRef(false);
    const [savingPdf, setSavingPdf] = useState(false);
    const [zoom, setZoom] = useState(getPreviewZoom);
    const [paginatedPreviewState, setPaginatedPreviewState] = useState<'preparing' | 'ready' | 'failed'>('preparing');
    const [previewPageCount, setPreviewPageCount] = useState(pageCount);

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
            paginatedExportRootRef.current = null;
            auditPrintPreviewCleanup();
        };
    }, []);

    async function handleSavePdf() {
        setSavingPdf(true);
        try {
            if (paginatedPreviewState === 'ready' && paginatedExportRootRef.current) {
                const pages = await capturePaginatedPreviewPages(paginatedExportRootRef.current);
                await saveCanvasPagesAsPdf(pages, title);
                return;
            }

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

    const handlePaginatedPreviewReady = useCallback((rootEl: HTMLElement, renderedPageCount: number) => {
        paginatedExportRootRef.current = rootEl;
        setPreviewPageCount(renderedPageCount);
        setPaginatedPreviewState('ready');
    }, []);

    const handlePaginatedPreviewFailed = useCallback(() => {
        paginatedExportRootRef.current = null;
        setPreviewPageCount(pageCount);
        setPaginatedPreviewState('failed');
    }, [pageCount]);

    const emptyAnchors: CommentAnchorInput[] = [];
    const previewLayout = getPreviewLayout(layout);
    const previewPaperStyle = buildDocumentLayoutStyle(previewLayout);
    const preparedPdfExportSource: PrintPreviewExportSource =
        paginatedPreviewState === 'ready' ? 'paginated-preview' : 'gracon-canvas';
    const previewIsPreparing = paginatedPreviewState === 'preparing';
    const continuousPreviewCanvas = (
        <PagedDocumentCanvas
            canvasRef={previewCanvasRef}
            documentId={`${documentId}-print-preview`}
            title={title}
            status={status}
            content={content}
            isReadOnly
            zoomScale={zoom}
            pageCount={pageCount}
            pageHeight={pageHeight}
            contentHeight={contentHeight}
            printLayout
            showFormattingMarks={false}
            paperStyle={previewPaperStyle}
            headerFooter={previewLayout.headerFooter}
            showRepeatedPageChrome
            pageGap={PAPER_PAGE_GAP_PX}
            overlayContent={overlayContent}
            commentAnchors={emptyAnchors}
            onEditorReady={() => undefined}
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
                    <span>
                        {previewPageCount} page{previewPageCount === 1 ? '' : 's'} · Same geometry as PDF export
                    </span>
                </div>
                <div className={styles.actions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>
                        Close
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={previewIsPreparing}
                        onClick={() => window.print()}
                    >
                        Print
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        disabled={savingPdf || previewIsPreparing}
                        onClick={() => { void handleSavePdf(); }}
                    >
                        {savingPdf ? 'Preparing…' : previewIsPreparing ? 'Preparing preview…' : 'Save PDF'}
                    </button>
                </div>
            </div>
            <div className={styles.body}>
                {paginatedPreviewState !== 'failed' ? (
                    <>
                        {paginatedPreviewState === 'preparing' && (
                            <div className={styles.previewStatus} role="status">
                                Preparing paginated preview…
                            </div>
                        )}
                        <DocumentPaginatedPrintPreviewRenderer
                            documentId={documentId}
                            title={title}
                            status={status}
                            content={content}
                            layout={previewLayout}
                            zoom={zoom}
                            overlayContent={overlayContent}
                            onReady={handlePaginatedPreviewReady}
                            onFailed={handlePaginatedPreviewFailed}
                        />
                    </>
                ) : continuousPreviewCanvas}
            </div>
        </div>
    );
}
