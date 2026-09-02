'use client';

import type { RefObject, ReactNode } from 'react';
import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import type { CommentAnchorInput } from '@/store/editor/comment-anchor-extension';
import { RichTextEditor } from './RichTextEditor';
import { A4_PAPER_WIDTH_PX } from '@/constants/document-paper';
import type { DocumentHeaderFooter } from '@/lib/document-layout';
import type { TiptapPageGeometryInput } from '@/lib/tiptap/tiptap-page-geometry';

interface PagedDocumentCanvasProps {
    canvasRef: RefObject<HTMLDivElement | null>;
    documentId: string;
    title: string;
    status: string;
    content: Record<string, unknown> | null;
    isReadOnly: boolean;
    zoomScale: number;
    pageCount: number;
    pageHeight: number;
    contentHeight: number;
    printLayout: boolean;
    showFormattingMarks: boolean;
    paperStyle: CSSProperties;
    headerFooter: DocumentHeaderFooter;
    /** Page geometry used to paginate the editable surface. */
    pageGeometry?: TiptapPageGeometryInput;
    showRepeatedPageChrome?: boolean;
    pageGap?: number;
    overlayContent?: ReactNode;
    commentAnchors: CommentAnchorInput[];
    onContentChange?: (content: Record<string, unknown>, wordCount: number) => void;
    onEditorReady: (editor: Editor) => void;
}

function getFrameClassName(showFormattingMarks: boolean) {
    return [
        'document-layout-frame',
        'document-layout-frame--paged',
        showFormattingMarks ? 'document-layout-frame--show-marks' : '',
    ].filter(Boolean).join(' ');
}

function createPageSurfaces(
    pageCount: number,
    pageHeight: number,
    pageGap: number,
    title: string,
    status: string,
    headerFooter: DocumentHeaderFooter,
) {
    const headerText = headerFooter.headerText || title;
    const footerText = headerFooter.footerText || `${status.toLowerCase()} document`;

    return Array.from({ length: Math.max(1, pageCount) }, (_, index) => {
        const pageNumber = index + 1;

        return (
            <section
                key={pageNumber}
                className="document-page-surface"
                style={{
                    top: (pageNumber - 1) * (pageHeight + pageGap),
                    height: pageHeight,
                }}
                aria-hidden="true"
            >
                <header className={`document-page-surface__header${headerFooter.headerEnabled ? '' : ' document-page-surface__chrome--hidden'}`}>
                    <span className="document-page-surface__title">{headerText}</span>
                    {headerFooter.pageNumbersEnabled && (
                        <span className="document-page-surface__tag">Page {pageNumber}</span>
                    )}
                </header>
                <footer className={`document-page-surface__footer${headerFooter.footerEnabled ? '' : ' document-page-surface__chrome--hidden'}`}>
                    <span>{footerText}</span>
                    {headerFooter.pageNumbersEnabled && (
                        <span>Page {pageNumber} of {pageCount}</span>
                    )}
                </footer>
            </section>
        );
    });
}

/**
 * Renders one continuous TipTap document surface.
 *
 * The legacy component name is kept so callers, signing overlays, comments,
 * print preview, and export wiring do not need a risky cross-app refactor.
 */
export function PagedDocumentCanvas({
    canvasRef,
    documentId,
    title,
    status,
    content,
    isReadOnly,
    zoomScale,
    pageCount,
    pageHeight,
    pageGap = 0,
    contentHeight,
    showFormattingMarks,
    paperStyle,
    headerFooter,
    pageGeometry,
    overlayContent,
    commentAnchors,
    onContentChange,
    onEditorReady,
}: PagedDocumentCanvasProps) {
    const safePageGap = Math.max(0, pageGap);
    const pageStackHeight = (pageCount * pageHeight) + (Math.max(0, pageCount - 1) * safePageGap);
    const continuousMinHeight = Math.max(pageHeight, contentHeight, pageStackHeight);
    const scaledFrameWidth = Math.round(A4_PAPER_WIDTH_PX * zoomScale);
    const scaledFrameHeight = continuousMinHeight * zoomScale;
    const headerText = headerFooter.headerText || title;
    const footerText = headerFooter.footerText || `${status.toLowerCase()} document`;

    return (
        <div ref={canvasRef} className="ded-canvas">
            <div className="document-workspace-stage" data-page-count={pageCount}>
                <div
                    className="document-layout-shell"
                    style={{ width: scaledFrameWidth, minHeight: scaledFrameHeight }}
                >
                    <div
                        className={getFrameClassName(showFormattingMarks)}
                        data-document-export-root="true"
                        data-document-page-count={pageCount}
                        data-document-page-height={pageHeight}
                        data-document-title={title}
                        data-document-status={status}
                        data-document-header-enabled={String(headerFooter.headerEnabled)}
                        data-document-footer-enabled={String(headerFooter.footerEnabled)}
                        data-document-page-numbers-enabled={String(headerFooter.pageNumbersEnabled)}
                        data-document-header-text={headerText}
                        data-document-footer-text={footerText}
                        data-document-page-gap={safePageGap}
                        style={{
                            minHeight: continuousMinHeight,
                            ['--document-page-gap' as string]: `${safePageGap}px`,
                            ['--ded-tiptap-min-height' as string]: `${pageHeight}px`,
                            transform: `scale(${zoomScale})`,
                            transformOrigin: 'top center',
                        }}
                    >
                        <div className="document-page-surfaces">
                            {createPageSurfaces(pageCount, pageHeight, safePageGap, title, status, headerFooter)}
                        </div>
                        <RichTextEditor
                            key={documentId}
                            initialContent={content}
                            onContentChange={isReadOnly ? undefined : onContentChange}
                            onEditorReady={onEditorReady}
                            hideToolbar
                            readOnly={isReadOnly}
                            paperMode
                            paperTitle={title}
                            paperStatus={status}
                            pageNumber={1}
                            pageCount={pageCount}
                            paperStyle={paperStyle}
                            pageGeometry={pageGeometry}
                            overlayContent={overlayContent}
                            commentAnchors={commentAnchors}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
