'use client';

import type { RefObject, ReactNode } from 'react';
import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import type { CommentAnchorInput } from '@/store/editor/comment-anchor-extension';
import { RichTextEditor } from './RichTextEditor';
import { A4_PAPER_WIDTH_PX } from '@/constants/document-paper';
import type { DocumentHeaderFooter } from '@/lib/document-layout';

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
        'document-layout-frame--web-layout',
        showFormattingMarks ? 'document-layout-frame--show-marks' : '',
    ].filter(Boolean).join(' ');
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
    contentHeight,
    showFormattingMarks,
    paperStyle,
    headerFooter,
    overlayContent,
    commentAnchors,
    onContentChange,
    onEditorReady,
}: PagedDocumentCanvasProps) {
    const continuousMinHeight = Math.max(pageHeight, contentHeight);
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
                        data-document-page-gap="0"
                        style={{
                            minHeight: continuousMinHeight,
                            ['--document-page-gap' as string]: '0px',
                            ['--ded-tiptap-min-height' as string]: `${continuousMinHeight}px`,
                            transform: `scale(${zoomScale})`,
                            transformOrigin: 'top center',
                        }}
                    >
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
                            overlayContent={overlayContent}
                            commentAnchors={commentAnchors}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
