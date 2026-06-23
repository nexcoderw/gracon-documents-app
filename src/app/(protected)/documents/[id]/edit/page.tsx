/**
 * EditDocumentPage
 *
 * Google Docs-style document editor page. Renders a full-width sticky
 * DocEditorHeader (menu bar + toolbar) and a scrollable A4 paper canvas below.
 * All autosave, title-edit, finalise, and PDF-export logic is unchanged.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Editor } from '@tiptap/react';
import { toast } from '@/components/ui';
import { DocumentFinaliseDialog } from '@/components/editor/DocumentFinaliseDialog';
import { DocumentLockConfirmDialog } from '@/components/editor/DocumentLockConfirmDialog';
import { DocumentPageSetupDialog } from '@/components/editor/DocumentPageSetupDialog';
import { DocumentPrintPreviewDialog } from '@/components/editor/DocumentPrintPreviewDialog';
import { DocumentAccessTransitionBanner } from '@/components/editor/DocumentAccessTransitionBanner';
import { DocumentRulerOverlay, DocumentPageRulerSidebar } from '@/components/editor/DocumentRulerOverlay';
import { DocEditorHeader } from '@/components/editor/DocEditorHeader';
import { DocumentCommentsPanel } from '@/components/editor/DocumentCommentsPanel';
import { DocumentOutlinePanel } from '@/components/editor/DocumentOutlinePanel';
import { DocumentPageStatus } from '@/components/editor/DocumentPageStatus';
import { DocumentSigningProgressPanel } from '@/components/editor/DocumentSigningProgressPanel';
import { DocumentLoadingState } from '@/components/editor/DocumentLoadingState';
import { DocumentSurfaceErrorBoundary } from '@/components/editor/DocumentSurfaceErrorBoundary';
import { SignatureBlockPreparationDialog } from '@/components/editor/SignatureBlockPreparationDialog';
import { PagedDocumentCanvas } from '@/components/editor/PagedDocumentCanvas';
import { mergeDocumentShareState } from '@/store/editor/document-share-state';
import {
    publishDocumentShareSync,
    useDocumentShareSync,
} from '@/store/editor/document-share-sync';
import { focusCommentAnchor } from '@/store/editor/comment-anchor-extension';
import { useDocumentViewState } from '@/store/editor/use-document-view-state';
import { useActiveParagraphLayout } from '@/store/editor/use-active-paragraph-layout';
import { SigningModal } from '@/components/documents/SigningModal';
import { DocumentSignatureBlock } from '@/components/documents/DocumentSignatureBlock';
import type { SigningActionStatus } from '@/components/editor/DocEditorSignatureAction';
import { buildViewMenuItems } from '@/constants/view-menu';
import { A4_PAPER_HEIGHT_PX, A4_PAPER_WIDTH_PX, PAPER_PAGE_GAP_PX } from '@/constants';
import { useStarred } from '@/lib/hooks/useStarred';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import {
    createEmptyTiptapPaginationMetrics,
    measureTiptapPagination,
    type TiptapOutlineMetric,
} from '@/lib/tiptap/tiptap-page-metrics';
import { applyTiptapPageLayoutOffsets } from '@/lib/tiptap/tiptap-page-breaks';
import { createTiptapLivePageGeometry } from '@/lib/tiptap/tiptap-page-geometry';
import {
    hasDocumentPermission,
    isDocumentBaseReadOnly,
    isDocumentEditorReadOnly,
} from '@/lib/document-readonly';
import {
    getDigitalCertificateUrl,
    getIdentityVerificationUrl,
    redirectToLogin,
} from '@/lib/session';
import {
    applySignatureBlockEvidenceToContent,
    buildSignatureBlockInserts,
    getSignatureBlockSignerOrder,
    getSignatureBlockSigners,
    hasSignatureBlockForUser,
    type SignatureBlockSigner,
} from '@/lib/editor-signature-blocks';
import {
    buildDocumentLayoutStyle,
    clampHorizontalDocumentMargins,
    normalizeDocumentLayout,
    type DocumentLayout,
    type ParagraphIndentation,
    type ParagraphTabStop,
} from '@/lib/document-layout';
import { useSessionUser } from '@/app/(protected)/layout';
import {
    getDocument, autosaveDocument, updateDocumentMeta, finaliseDocument, lockDocument,
    getDocumentSigningReadiness, listDocumentComments,
    type DocumentComment, type DocumentDetail,
    type DocumentSigningReadiness,
} from '@/api/documents.api';

const AUTOSAVE_INTERVAL_MS = 30_000;

function getErrorMessage(error: unknown, fallback: string) {
    const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
}

function getContentFingerprint(content: Record<string, unknown> | null) {
    if (!content) return '';
    try {
        return JSON.stringify(content);
    } catch {
        return String(Date.now());
    }
}

export default function EditDocumentPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const user = useSessionUser();
    const { isStarred, toggleStar } = useStarred();

    const [doc, setDoc] = useState<DocumentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [accessTransitionMessage, setAccessTransitionMessage] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [editingTitle, setEditingTitle] = useState(false);
    const [title, setTitle] = useState('');
    const [showFinaliseDialog, setShowFinaliseDialog] = useState(false);
    const [showLockDialog, setShowLockDialog] = useState(false);
    const [lockingDocument, setLockingDocument] = useState(false);
    const [showSignatureBlockDialog, setShowSignatureBlockDialog] = useState(false);
    const [showPageSetupDialog, setShowPageSetupDialog] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [savingPageSetup, setSavingPageSetup] = useState(false);
    const [showSigning, setShowSigning] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [commentSelectionRequestKey, setCommentSelectionRequestKey] = useState(0);
    const [comments, setComments] = useState<DocumentComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const [commentsNextCursor, setCommentsNextCursor] = useState<string | null>(
        null,
    );
    const [commentsHasMore, setCommentsHasMore] = useState(false);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [shareActivityRefreshKey, setShareActivityRefreshKey] = useState(0);
    const [editorRecoveryKey, setEditorRecoveryKey] = useState(0);
    const [previewRecoveryKey, setPreviewRecoveryKey] = useState(0);

    useDocumentTitle(title || doc?.title || 'Loading Document');
    const [signingReadiness, setSigningReadiness] = useState<DocumentSigningReadiness | null>(null);
    const [signingReadinessLoading, setSigningReadinessLoading] = useState(false);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [paginationMetrics, setPaginationMetrics] = useState(
        createEmptyTiptapPaginationMetrics,
    );
    const continuousDocumentLayout = useMemo(() => ({
        pageCount: paginationMetrics.pageCount,
        activePage: paginationMetrics.activePage,
        pageHeight: A4_PAPER_HEIGHT_PX,
        pageGap: PAPER_PAGE_GAP_PX,
        contentHeight: Math.max(
            A4_PAPER_HEIGHT_PX,
            (paginationMetrics.pageCount * A4_PAPER_HEIGHT_PX) +
                (Math.max(0, paginationMetrics.pageCount - 1) * PAPER_PAGE_GAP_PX),
        ),
        pages: paginationMetrics.pages,
    }), [paginationMetrics]);
    const pageRootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const signatureRequests = doc?.signatureRequests ?? [];
    const currentSignatureRequest = signatureRequests.find(
        request => request.requestedUserId === user?.userId,
    ) ?? null;
    const hasSignedCurrentRequest = currentSignatureRequest?.status === 'SIGNED';
    const canFinaliseDocument = !!doc
        && doc.status === 'DRAFT'
        && (doc.access?.isOwner ?? true);
    const canLockDocument = !!doc
        && doc.status === 'SIGNED'
        && (doc.access?.isOwner ?? true);
    const canSignDocument = !!doc
        && doc.status === 'FINALISED'
        && Boolean(currentSignatureRequest)
        && !hasSignedCurrentRequest;
    const signingStatus: SigningActionStatus = !canSignDocument
        ? 'not-required'
        : signingReadinessLoading
            ? 'checking'
            : signingReadiness?.status === 'ready'
                ? 'ready'
                : signingReadiness?.status === 'needs_certificate'
                    ? 'needs_certificate'
                    : signingReadiness?.status === 'needs_identity_verification'
                        ? 'needs_identity_verification'
                        : signingReadiness
                            ? 'blocked'
                            : 'checking';

    const contentRef = useRef<Record<string, unknown> | null>(null);
    const wordCntRef = useRef(0);
    const dirtyRef = useRef(false);
    const lastSavedContentFingerprintRef = useRef('');
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rulerCommitLayoutRef = useRef<DocumentLayout | null>(null);
    const saveInFlightRef = useRef<Promise<boolean> | null>(null);
    const documentLayout = useMemo(
        () => normalizeDocumentLayout(doc?.layout),
        [doc?.layout],
    );
    const documentLayoutStyle = useMemo(
        () => buildDocumentLayoutStyle(documentLayout),
        [documentLayout],
    );
    const measurePaginationMetrics = useCallback(() => {
        const editorEl = canvasRef.current?.querySelector<HTMLElement>('.ProseMirror');
        if (!editorEl) return;

        const pageGeometry = createTiptapLivePageGeometry({
            pageHeight: A4_PAPER_HEIGHT_PX,
            margins: documentLayout.margins,
        });
        applyTiptapPageLayoutOffsets(editorEl, pageGeometry);
        setPaginationMetrics(measureTiptapPagination(editorEl, {
            pageHeight: A4_PAPER_HEIGHT_PX,
            pageGap: PAPER_PAGE_GAP_PX,
            contentHeight: pageGeometry.printableBottom,
        }));
    }, [documentLayout.margins]);
    const beginAccessTransition = useCallback((message: string) => {
        setAccessTransitionMessage((current) => current ?? message);

        if (redirectTimerRef.current) {
            return;
        }

        redirectTimerRef.current = setTimeout(() => {
            router.replace('/documents');
        }, 1400);
    }, [router]);
    const refreshSharedDocumentState = useCallback(async () => {
        try {
            const sharedState = await getDocument(id, false);
            setDoc((current) =>
                current ? mergeDocumentShareState(current, sharedState) : sharedState,
            );
            setShareActivityRefreshKey((current) => current + 1);
        } catch (error: unknown) {
            const status = (error as { response?: { status?: number } }).response?.status;

            if (status === 403 || status === 404) {
                beginAccessTransition(
                    'Your access to this document changed. Redirecting to documents…',
                );
            }
        }
    }, [beginAccessTransition, id]);
    const handleShareActivityRecorded = useCallback(
        () => {
            setShareActivityRefreshKey((current) => current + 1);
            publishDocumentShareSync(id);
        },
        [id],
    );
    const handleRemoteShareSync = useCallback(() => {
        void refreshSharedDocumentState();
    }, [refreshSharedDocumentState]);

    useDocumentShareSync(id, handleRemoteShareSync);

    useEffect(() => () => {
        if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
        }
    }, []);

    useEffect(() => {
        const editorEl = canvasRef.current?.querySelector<HTMLElement>('.ProseMirror');
        if (!editorEl) return;

        const animationFrame = window.requestAnimationFrame(measurePaginationMetrics);
        const resizeObserver = new ResizeObserver(measurePaginationMetrics);
        const handleSelectionChange = () => {
            const anchorNode = document.getSelection()?.anchorNode;
            if (anchorNode && canvasRef.current?.contains(anchorNode)) {
                window.requestAnimationFrame(measurePaginationMetrics);
            }
        };

        resizeObserver.observe(editorEl);
        window.addEventListener('resize', measurePaginationMetrics);
        document.addEventListener('selectionchange', handleSelectionChange);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            window.removeEventListener('resize', measurePaginationMetrics);
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [
        doc?.id,
        editor,
        measurePaginationMetrics,
    ]);

    // Load document
    useEffect(() => {
        let ignore = false;
        setLoading(true);
        setLoadError(null);
        getDocument(id, true)
            .then(d => {
                if (ignore) return;
                setDoc(d);
                setTitle(d.title);
                contentRef.current = d.content;
                lastSavedContentFingerprintRef.current = getContentFingerprint(d.content);
            })
            .catch((error: unknown) => {
                if (ignore) return;
                const message = getErrorMessage(error, 'Failed to load document.');
                setLoadError(message);
                toast.error(message);
            })
            .finally(() => { if (!ignore) setLoading(false); });
        return () => { ignore = true; };
    }, [id, retryKey]);

    const loadComments = useCallback(async (cursor?: string | null) => {
        const isLoadingMore = Boolean(cursor);
        if (isLoadingMore) {
            setCommentsLoadingMore(true);
        } else {
            setCommentsLoading(true);
        }
        setCommentsError(null);
        try {
            const response = await listDocumentComments(id, 50, cursor);
            setComments((current) =>
                isLoadingMore
                    ? [...current, ...response.comments]
                    : response.comments,
            );
            setCommentsNextCursor(response.nextCursor);
            setCommentsHasMore(response.hasMore);
        } catch (error: unknown) {
            setCommentsError(getErrorMessage(error, 'Unable to load comments.'));
        } finally {
            if (isLoadingMore) {
                setCommentsLoadingMore(false);
            } else {
                setCommentsLoading(false);
            }
        }
    }, [id]);

    const loadMoreComments = useCallback(async () => {
        if (!commentsNextCursor || commentsLoadingMore) return;
        await loadComments(commentsNextCursor);
    }, [commentsLoadingMore, commentsNextCursor, loadComments]);

    useEffect(() => {
        if (!doc?.id) return;
        void loadComments();
    }, [doc?.id, loadComments]);

    useEffect(() => {
        if (!doc?.id || !canSignDocument) {
            setSigningReadiness(null);
            setSigningReadinessLoading(false);
            return undefined;
        }

        let ignore = false;
        setSigningReadinessLoading(true);

        getDocumentSigningReadiness(doc.id)
            .then((readiness) => {
                if (!ignore) setSigningReadiness(readiness);
            })
            .catch(() => {
                if (!ignore) setSigningReadiness(null);
            })
            .finally(() => {
                if (!ignore) setSigningReadinessLoading(false);
            });

        return () => { ignore = true; };
    }, [canSignDocument, doc?.id]);

    const getSigningReturnPath = useCallback(() => {
        if (typeof window === 'undefined') return `/documents/${id}/edit?sign=1`;

        const url = new URL(window.location.href);
        url.searchParams.set('sign', '1');
        return `${url.pathname}${url.search}${url.hash}`;
    }, [id]);

    const consumeSigningReturnFlag = useCallback(() => {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        if (!url.searchParams.has('sign')) return;

        url.searchParams.delete('sign');
        window.history.replaceState(
            window.history.state,
            '',
            `${url.pathname}${url.search}${url.hash}`,
        );
    }, []);

    useEffect(() => {
        if (!doc?.id || !canSignDocument || signingReadinessLoading) return;
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        if (url.searchParams.get('sign') !== '1') return;

        if (signingReadiness?.status === 'ready') {
            consumeSigningReturnFlag();
            setShowSigning(true);
            return;
        }

        if (signingReadiness) {
            consumeSigningReturnFlag();
            toast.info(signingReadiness.message);
        }
    }, [
        canSignDocument,
        consumeSigningReturnFlag,
        doc?.id,
        signingReadiness,
        signingReadinessLoading,
    ]);

    const commentAnchors = useMemo(
        () => comments.map((comment) => ({
            id: comment.id,
            anchorText: comment.anchorText,
            anchorFrom: comment.anchorFrom,
            anchorTo: comment.anchorTo,
            resolvedAt: comment.resolvedAt,
            active: activeCommentId === comment.id,
        })),
        [activeCommentId, comments],
    );

    // Autosave logic
    const save = useCallback(async (force = false) => {
        if (saveInFlightRef.current) {
            if (!force) return false;
            await saveInFlightRef.current;
        }

        if (!dirtyRef.current && !force) return false;
        if (!contentRef.current) return false;
        if (doc?.status !== 'DRAFT') return false;
        if (!hasDocumentPermission(doc, 'EDIT')) return false;

        const content = contentRef.current;
        const wordCount = wordCntRef.current;
        const nextFingerprint = getContentFingerprint(content);
        if (!force && nextFingerprint === lastSavedContentFingerprintRef.current) {
            dirtyRef.current = false;
            return false;
        }

        setSaveStatus('saving');
        dirtyRef.current = false;

        const operation = (async () => {
            try {
                for (let attempt = 0; attempt < 2; attempt += 1) {
                    try {
                        await autosaveDocument(id, content, wordCount);
                        lastSavedContentFingerprintRef.current = nextFingerprint;
                        setSaveStatus('saved');
                        setTimeout(() => setSaveStatus('idle'), 2000);
                        return true;
                    } catch (err: unknown) {
                        const httpStatus = (err as { response?: { status?: number } })?.response?.status;

                        if (httpStatus === 409 && attempt === 0) {
                            await new Promise(resolve => setTimeout(resolve, 250));
                            continue;
                        }

                        if (httpStatus === 401) {
                            // The token refresh interceptor already attempted a silent refresh.
                            // Reaching here means the session is definitively expired — either
                            // the refresh was rejected as unauthenticated, or the refresh service
                            // was unreachable. Do not mark as dirty so autosave stops retrying,
                            // then redirect the user so they can log in again without losing context.
                            dirtyRef.current = false;
                            toast.error('Your session has expired. Redirecting to login…');
                            redirectToLogin(
                                `${window.location.pathname}${window.location.search}${window.location.hash}`,
                            );
                            return false;
                        }

                        setSaveStatus('error');
                        dirtyRef.current = true;
                        return false;
                    }
                }

                return false;
            } finally {
                saveInFlightRef.current = null;
            }
        })();

        saveInFlightRef.current = operation;
        return operation;
    }, [id, doc]);

    useEffect(() => {
        const interval = setInterval(() => { void save(); }, AUTOSAVE_INTERVAL_MS);
        return () => { clearInterval(interval); void save(); };
    }, [save]);

    const handleContentChange = useCallback((content: Record<string, unknown>, wordCount: number) => {
        contentRef.current = content;
        wordCntRef.current = wordCount;
        dirtyRef.current = true;
        setSaveStatus('idle');
        window.requestAnimationFrame(() => {
            measurePaginationMetrics();
        });
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { void save(); }, 3000);
    }, [measurePaginationMetrics, save]);

    const handleManualSave = useCallback(async () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        const saved = await save(true);

        if (saved) {
            toast.success('Document saved.');
        } else if (doc?.status !== 'DRAFT') {
            toast.info('Only draft documents can be saved manually.');
        } else if (!hasDocumentPermission(doc, 'EDIT')) {
            toast.warning('You do not have permission to save this document.');
        } else {
            toast.error('Document could not be saved. Your changes remain queued.');
        }
    }, [doc, save]);
    async function handleTitleSave() {
        setEditingTitle(false);
        if (title.trim() === doc?.title) return;
        if (!hasDocumentPermission(doc, 'EDIT')) {
            setTitle(doc?.title ?? title);
            toast.warning('You do not have permission to rename this document.');
            return;
        }
        try {
            const updated = await updateDocumentMeta(id, { title: title.trim() || 'Untitled' });
            setDoc(prev => prev ? { ...prev, title: updated.title } : prev);
            setTitle(updated.title);
        } catch { toast.error('Failed to update title.'); }
    }

    async function submitFinalise(options: { requireOwnerSignature: boolean }) {
        if (!doc) return;

        const isOwner = doc.access?.isOwner ?? true;

        if (!isOwner) {
            toast.warning('Only the document owner can finalise and sign this document.');
            return;
        }

        if (doc.status !== 'DRAFT') return;

        await save(true);
        try {
            const finalised = await finaliseDocument(id, {
                requireOwnerSignature: options.requireOwnerSignature,
            });
            setDoc(prev => prev ? { ...prev, ...finalised, status: 'FINALISED', contentHash: finalised.contentHash } : prev);
            setShowFinaliseDialog(false);
            toast.success('Document finalised. Required signatures can now be collected.');
            if (finalised.signatureRequests.some(request => request.requestedUserId === user?.userId)) {
                setShowSigning(true);
            }
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to finalise document.';
            toast.error(msg);
        }
    }

    function handleFinalise() {
        if (canFinaliseDocument) {
            setShowFinaliseDialog(true);
        }
    }

    async function handleSignDocument() {
        if (!doc) return;

        try {
            const readiness = signingReadiness?.documentId === doc.id && !signingReadinessLoading
                ? signingReadiness
                : await getDocumentSigningReadiness(doc.id);

            setSigningReadiness(readiness);

            if (readiness.status === 'ready') {
                setShowSigning(true);
                return;
            }

            if (readiness.status === 'needs_login') {
                redirectToLogin(`${window.location.pathname}${window.location.search}`);
                return;
            }

            if (readiness.status === 'needs_identity_verification') {
                window.location.href = getIdentityVerificationUrl(
                    getSigningReturnPath(),
                );
                return;
            }

            if (readiness.status === 'needs_certificate') {
                toast.warning(readiness.message);
                window.location.href = getDigitalCertificateUrl(getSigningReturnPath());
                return;
            }

            if (readiness.status === 'already_signed') {
                toast.info(readiness.message);
                return;
            }

            toast.warning(readiness.message);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Unable to check signing readiness.'));
        }
    }

    async function handleLockDocument() {
        if (!doc || !canLockDocument || lockingDocument) {
            return;
        }

        setLockingDocument(true);
        try {
            const locked = await lockDocument(id);
            setDoc(prev => prev ? { ...prev, ...locked, status: 'LOCKED' } : prev);
            setShowLockDialog(false);
            toast.success('Document locked. It is now permanently immutable.');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Failed to lock document.'));
        } finally {
            setLockingDocument(false);
        }
    }

    function handleApplyForDigitalSignature() {
        window.location.href = getDigitalCertificateUrl(getSigningReturnPath());
    }

    function handleCompleteIdentityVerification() {
        window.location.href = getIdentityVerificationUrl(getSigningReturnPath());
    }

    const canEdit = hasDocumentPermission(doc, 'EDIT');
    const baseIsReadOnly = isDocumentBaseReadOnly({
        status: doc?.status,
        access: doc?.access,
    });
    const { viewState, handleViewAction } = useDocumentViewState({
        canToggleMode: !baseIsReadOnly,
        fullscreenTargetRef: pageRootRef,
    });
    const viewMenuItems = useMemo(() => buildViewMenuItems({
        printLayout: viewState.printLayout,
        canToggleMode: !baseIsReadOnly,
        canConfigureLayout: !baseIsReadOnly,
        viewMode: viewState.viewMode,
        zoom: viewState.zoom,
        isFullscreen: viewState.isFullscreen,
        showRuler: viewState.showRuler,
        showFormattingMarks: viewState.showFormattingMarks,
    }), [baseIsReadOnly, viewState]);
    const handleHeaderViewAction = useCallback((actionId: string) => {
        if (actionId === 'view:page-setup') {
            if (baseIsReadOnly) {
                toast.warning('Page setup can only be changed while the document is still editable.');
                return;
            }

            setShowPageSetupDialog(true);
            return;
        }

        if (actionId === 'view:print-preview') {
            setShowPrintPreview(true);
            return;
        }

        handleViewAction(actionId);
    }, [baseIsReadOnly, handleViewAction]);
    const activeParagraphLayout = useActiveParagraphLayout(editor);
    const applyParagraphIndentation = useCallback((indentation: ParagraphIndentation) => {
        if (!editor || baseIsReadOnly || !activeParagraphLayout) {
            return;
        }

        editor.commands.setParagraphIndentation({
            leftIndent: indentation.leftIndent,
            firstLineIndent: indentation.firstLineIndent,
        });
    }, [activeParagraphLayout, baseIsReadOnly, editor]);
    const applyParagraphTabStops = useCallback((tabStops: ParagraphTabStop[]) => {
        if (!editor || baseIsReadOnly || !activeParagraphLayout) {
            return;
        }

        editor.commands.setParagraphTabStops(tabStops);
    }, [activeParagraphLayout, baseIsReadOnly, editor]);
    const applyHorizontalMarginsPreview = useCallback(
        (nextMargins: { left: number; right: number }) => {
            setDoc((current) => {
                if (!current) return current;

                const nextHorizontalMargins = clampHorizontalDocumentMargins(
                    A4_PAPER_WIDTH_PX,
                    nextMargins,
                );

                return {
                    ...current,
                    layout: {
                        ...normalizeDocumentLayout(current.layout),
                        margins: {
                            ...normalizeDocumentLayout(current.layout).margins,
                            ...nextHorizontalMargins,
                        },
                    },
                };
            });
        },
        [],
    );
    const commitHorizontalMargins = useCallback(
        async (nextMargins: { left: number; right: number }) => {
            const baselineLayout = rulerCommitLayoutRef.current;
            const currentLayout = doc ? normalizeDocumentLayout(doc.layout) : null;
            const sourceLayout = baselineLayout ?? currentLayout;

            if (!doc || baseIsReadOnly || !sourceLayout) {
                return;
            }

            const nextHorizontalMargins = clampHorizontalDocumentMargins(
                A4_PAPER_WIDTH_PX,
                nextMargins,
            );
            const nextLayout: DocumentLayout = {
                ...sourceLayout,
                margins: {
                    ...sourceLayout.margins,
                    ...nextHorizontalMargins,
                },
            };

            rulerCommitLayoutRef.current = null;

            if (
                nextLayout.margins.left === sourceLayout.margins.left &&
                nextLayout.margins.right === sourceLayout.margins.right
            ) {
                return;
            }

            try {
                const updated = await updateDocumentMeta(id, { layout: nextLayout });
                setDoc((current) => (
                    current
                        ? {
                            ...current,
                            layout: updated.layout,
                            updatedAt: updated.updatedAt,
                        }
                        : current
                ));
                toast.success('Margins updated.');
            } catch (error: unknown) {
                setDoc((current) => (
                    current
                        ? {
                            ...current,
                            layout: sourceLayout,
                        }
                        : current
                ));
                toast.error(getErrorMessage(error, 'Failed to update ruler margins.'));
            }
        },
        [baseIsReadOnly, doc, id],
    );
    const signatureBlockSigners = useMemo(
        () => (doc ? getSignatureBlockSigners(doc, user) : []),
        [doc, user],
    );
    const signatureBlockEvidence = useMemo(
        () => (
            doc
                ? buildSignatureBlockInserts(
                    signatureBlockSigners,
                    doc.completedSignatures,
                    doc.signatureSnapshot,
                )
                : []
        ),
        [doc, signatureBlockSigners],
    );

    useEffect(() => {
        if (!editor || signatureBlockEvidence.length === 0) {
            return;
        }

        editor.commands.updateSignatureBlockEvidence(signatureBlockEvidence);
    }, [editor, signatureBlockEvidence]);

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <DocumentLoadingState
                variant="panel"
                message="Opening document..."
                detail="Restoring content, permissions, and signing state"
            />
        );
    }

    if (!doc) {
        return (
            <div className="glass" style={{ maxWidth: 720, margin: '60px auto 0', borderRadius: 'var(--radius-xl)', padding: '28px 24px', display: 'grid', gap: 14, textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Unable to open this document
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {loadError ?? 'The editor could not load the requested document.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => setRetryKey(v => v + 1)} className="btn-primary" style={{ fontSize: 12 }}>Retry</button>
                    <button onClick={() => router.push('/documents')} className="btn-ghost" style={{ fontSize: 12 }}>Back to documents</button>
                </div>
            </div>
        );
    }

    if (doc.type !== 'RICH_TEXT') {
        return (
            <div className="glass" style={{ maxWidth: 760, margin: '60px auto 0', borderRadius: 'var(--radius-xl)', padding: '30px 26px', display: 'grid', gap: 16, textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Spreadsheet documents are no longer supported here
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    The documents workspace is now dedicated to rich text documents only.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => router.push('/documents')} className="btn-primary" style={{ fontSize: 12 }}>Back to documents</button>
                    <button onClick={() => router.push('/documents/new')} className="btn-ghost" style={{ fontSize: 12 }}>Create rich text document</button>
                </div>
            </div>
        );
    }

    const canComment = hasDocumentPermission(doc, 'COMMENT');
    const canSign = hasDocumentPermission(doc, 'SIGN');
    const canManageAccess = hasDocumentPermission(doc, 'MANAGE_ACCESS');
    const isOwner = doc.access?.isOwner ?? true;
    const isViewingMode = !baseIsReadOnly && viewState.viewMode === 'viewing';
    const isReadOnly = isDocumentEditorReadOnly({
        status: doc.status,
        access: doc.access,
        viewMode: viewState.viewMode,
    });
    const isLocked = doc.status === 'LOCKED';
    const pendingSignatureCount = signatureRequests.filter(
        request => request.status !== 'SIGNED',
    ).length;
    const canViewSignature = isLocked && (isOwner || canSign);
    const acceptedSignerCount = doc.collaborators.filter((collaborator) =>
        collaborator.isActive &&
        collaborator.invitationStatus === 'ACCEPTED' &&
        collaborator.permissions.includes('SIGN'),
    ).length;
    const remainingSignerLabel = `${pendingSignatureCount} remaining signer${pendingSignatureCount === 1 ? '' : 's'}`;
    const readOnlyBannerText = isViewingMode
        ? 'Viewing mode is on. Switch back to editing from View when you want to make changes.'
        : !canEdit && doc.status === 'DRAFT'
        ? 'You can view this shared document, but you do not have edit permission.'
        : isLocked
            ? 'This document is permanently locked. It has been signed and cannot be modified.'
            : canLockDocument
                ? 'All required signatures are complete. Lock this document when you are ready.'
            : hasSignedCurrentRequest
                ? `Your signature is recorded. Waiting for ${remainingSignerLabel}.`
                : canSignDocument
                    ? 'This document is finalised. Its content is frozen. Sign when you are ready.'
                    : doc.status === 'SIGNED'
                        ? 'All required signatures are complete. Waiting for the owner to lock this document.'
                        : `This document is finalised. Its content is frozen. Waiting for ${remainingSignerLabel}.`;
    const readOnlyBannerClass = isViewingMode
        ? 'readonly'
        : !canEdit && doc.status === 'DRAFT'
        ? 'readonly'
        : isLocked
            ? 'locked'
            : 'finalised';
    const zoomScale = viewState.zoom / 100;
    const currentEditorContent = editor?.getJSON() ?? contentRef.current ?? doc.content;
    const currentSignatureBlockOrder = getSignatureBlockSignerOrder(currentEditorContent);
    const previewContentWithSignatureEvidence = applySignatureBlockEvidenceToContent(
        contentRef.current ?? doc.content,
        signatureBlockEvidence,
    );
    const ownerSignatureBlockPrepared = hasSignatureBlockForUser(
        currentEditorContent,
        user?.userId,
    );

    function handlePrepareSignatureBlocks(selectedSigners: SignatureBlockSigner[]) {
        if (!editor || !doc) return;

        const blocks = buildSignatureBlockInserts(
            selectedSigners,
            doc.completedSignatures,
            doc.signatureSnapshot,
        );

        const inserted = editor.commands.syncAssignedSignatureBlocks(blocks);
        if (!inserted) {
            toast.error('Signature blocks could not be prepared.');
            return;
        }

        setShowSignatureBlockDialog(false);
        toast.success(
            `Prepared ${blocks.length} assigned signature block${blocks.length === 1 ? '' : 's'} in order.`,
        );
    }

    async function handleSavePageSetup(nextLayout: DocumentLayout) {
        if (!doc || baseIsReadOnly) {
            return;
        }

        setSavingPageSetup(true);
        try {
            const updated = await updateDocumentMeta(id, { layout: nextLayout });
            setDoc((current) => (
                current
                    ? {
                        ...current,
                        layout: updated.layout,
                        updatedAt: updated.updatedAt,
                      }
                    : current
            ));
            setShowPageSetupDialog(false);
            toast.success('Page setup updated.');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Failed to update page setup.'));
        } finally {
            setSavingPageSetup(false);
        }
    }

    const signatureStrip = isLocked ? (
        <DocumentSignatureBlock
            documentId={doc.id}
            documentTitle={doc.title}
            snapshot={doc.signatureSnapshot}
            completedSignatures={doc.completedSignatures}
            canAdjustPlacement={isLocked}
            onSnapshotUpdated={(signatureSnapshot) => {
                setDoc(prev => prev ? { ...prev, signatureSnapshot } : prev);
            }}
        />
    ) : null;

    function handleFocusComment(comment: DocumentComment) {
        setActiveCommentId(comment.id);
        const focused = focusCommentAnchor(editor, {
            id: comment.id,
            anchorText: comment.anchorText,
            anchorFrom: comment.anchorFrom,
            anchorTo: comment.anchorTo,
            resolvedAt: comment.resolvedAt,
            active: true,
        });

        if (!focused) {
            toast.info('The original text for this comment could not be found.');
        }
    }

    function handleOpenCommentComposer() {
        if (!canComment) {
            toast.warning('You do not have permission to add comments to this document.');
            return;
        }

        setCommentsOpen(true);
        setCommentSelectionRequestKey((current) => current + 1);
    }

    function handleSelectOutlineItem(item: TiptapOutlineMetric) {
        const canvasEl = canvasRef.current;
        const editorEl = canvasEl?.querySelector<HTMLElement>('.ProseMirror');
        if (!canvasEl || !editorEl) return;

        const editorTop = editorEl.getBoundingClientRect().top - canvasEl.getBoundingClientRect().top;
        const nextTop = Math.max(0, canvasEl.scrollTop + editorTop + (item.top * zoomScale) - 42);

        canvasEl.scrollTo({ top: nextTop, behavior: 'smooth' });
    }

    return (
        <div
            ref={pageRootRef}
            className={`ded-page${accessTransitionMessage ? ' ded-page--access-transition' : ''}`}
        >
            {/* ── Sticky Google Docs-style header ── */}
            <DocEditorHeader
                editor={editor}
                doc={doc}
                shareActivityRefreshKey={shareActivityRefreshKey}
                saveStatus={saveStatus}
                editingTitle={editingTitle}
                title={title}
                onTitleChange={setTitle}
                onTitleSave={handleTitleSave}
                onTitleEditStart={() => setEditingTitle(true)}
                onTitleKeyDown={e => {
                    if (e.key === 'Enter') { e.currentTarget.blur(); }
                    if (e.key === 'Escape') { setEditingTitle(false); setTitle(doc.title); }
                }}
                isReadOnly={isReadOnly}
                isLocked={isLocked}
                canShare={canManageAccess}
                canComment={canComment}
                canFinalise={canFinaliseDocument}
                canLock={canLockDocument && !lockingDocument}
                canSign={canSignDocument}
                canViewSignature={canViewSignature}
                canPrepareSignatureBlocks={isOwner && doc.status === 'DRAFT'}
                signatureBlockSigners={signatureBlockSigners}
                onPrepareSignatureBlocks={() => setShowSignatureBlockDialog(true)}
                viewMenuItems={viewMenuItems}
                signingStatus={signingStatus}
                isStarred={isStarred(doc.id)}
                onOpenComments={() => setCommentsOpen(true)}
                onCreateComment={handleOpenCommentComposer}
                onToggleStar={() => toggleStar(doc.id)}
                onManualSave={handleManualSave}
                onShareActivityRecorded={handleShareActivityRecorded}
                onApplyForDigitalSignature={handleApplyForDigitalSignature}
                onCompleteIdentityVerification={handleCompleteIdentityVerification}
                onFinalise={handleFinalise}
                onLock={() => setShowLockDialog(true)}
                onSign={handleSignDocument}
                onViewSignature={() => setShowSigning(true)}
                onViewAction={handleHeaderViewAction}
            />

            {/* ── Status banner (read-only) ── */}
            {isReadOnly && (
                <div className={`ded-status-banner ded-status-banner--${readOnlyBannerClass}`}>
                    {readOnlyBannerText}
                </div>
            )}

            {accessTransitionMessage && (
                <DocumentAccessTransitionBanner message={accessTransitionMessage} />
            )}

            <DocumentFinaliseDialog
                acceptedSignerCount={acceptedSignerCount}
                ownerSignaturePrepared={ownerSignatureBlockPrepared}
                open={showFinaliseDialog}
                onClose={() => setShowFinaliseDialog(false)}
                onConfirm={submitFinalise}
            />

            <DocumentLockConfirmDialog
                open={showLockDialog}
                submitting={lockingDocument}
                onCancel={() => {
                    if (!lockingDocument) setShowLockDialog(false);
                }}
                onConfirm={() => { void handleLockDocument(); }}
            />

            <SignatureBlockPreparationDialog
                open={showSignatureBlockDialog}
                signers={signatureBlockSigners}
                existingSignerOrder={currentSignatureBlockOrder}
                onClose={() => setShowSignatureBlockDialog(false)}
                onConfirm={handlePrepareSignatureBlocks}
            />

            {showPageSetupDialog && (
                <DocumentPageSetupDialog
                    layout={documentLayout}
                    saving={savingPageSetup}
                    onClose={() => setShowPageSetupDialog(false)}
                    onSave={handleSavePageSetup}
                />
            )}

            {showPrintPreview && (
                <DocumentSurfaceErrorBoundary
                    surface="preview"
                    resetKey={`${doc.id}:${previewRecoveryKey}:${title}:${doc.status}`}
                    onReset={() => setPreviewRecoveryKey((current) => current + 1)}
                    onClose={() => setShowPrintPreview(false)}
                >
                    <DocumentPrintPreviewDialog
                        key={`${doc.id}:${previewRecoveryKey}`}
                        documentId={doc.id}
                        title={title.trim() || doc.title}
                        status={doc.status}
                        content={previewContentWithSignatureEvidence}
                        layout={documentLayout}
                        pageCount={continuousDocumentLayout.pageCount}
                        pageHeight={continuousDocumentLayout.pageHeight}
                        contentHeight={continuousDocumentLayout.contentHeight}
                        overlayContent={signatureStrip}
                        onClose={() => setShowPrintPreview(false)}
                    />
                </DocumentSurfaceErrorBoundary>
            )}

            {/* ── Sticky horizontal ruler (Google Docs-style — stays below the header) ── */}
            {viewState.showRuler && (
                <DocumentRulerOverlay
                    rulerMode="top-only"
                    width={A4_PAPER_WIDTH_PX}
                    height={continuousDocumentLayout.pageHeight}
                    margins={documentLayout.margins}
                    paragraphIndent={activeParagraphLayout}
                    disabled={baseIsReadOnly}
                    onHorizontalMarginsPreview={(nextMargins) => {
                        if (!rulerCommitLayoutRef.current) {
                            rulerCommitLayoutRef.current = documentLayout;
                        }
                        applyHorizontalMarginsPreview(nextMargins);
                    }}
                    onHorizontalMarginsCommit={commitHorizontalMargins}
                    onParagraphIndentPreview={applyParagraphIndentation}
                    onParagraphIndentCommit={applyParagraphIndentation}
                    onParagraphTabStopsChange={applyParagraphTabStops}
                />
            )}

            {/* ── Page body: fixed ruler sidebar + scrollable document canvas ── */}
            <div className="ded-page-body">
                {/* Vertical ruler sidebar — scroll is driven by canvas, not the user */}
                {viewState.showRuler && (
                    <div className="ded-ruler-sidebar">
                        <DocumentPageRulerSidebar
                            canvasRef={canvasRef}
                            pages={continuousDocumentLayout.pages}
                            pageHeight={continuousDocumentLayout.pageHeight}
                            zoomScale={zoomScale}
                            margins={documentLayout.margins}
                            disabled={baseIsReadOnly}
                        />
                    </div>
                )}

                <DocumentOutlinePanel
                    outline={paginationMetrics.outline}
                    activePage={paginationMetrics.activePage}
                    onSelect={handleSelectOutlineItem}
                />

                <DocumentPageStatus metrics={paginationMetrics} />

                {/* ── Paper canvas ── */}
                <DocumentSurfaceErrorBoundary
                    surface="editor"
                    resetKey={`${doc.id}:${editorRecoveryKey}`}
                    onReset={() => {
                        setEditor(null);
                        setEditorRecoveryKey((current) => current + 1);
                    }}
                >
                    <PagedDocumentCanvas
                        canvasRef={canvasRef}
                        documentId={`${doc.id}:${editorRecoveryKey}`}
                        title={doc.title}
                        status={doc.status}
                        content={doc.content}
                        isReadOnly={isReadOnly}
                        zoomScale={zoomScale}
                        pageCount={continuousDocumentLayout.pageCount}
                        pageHeight={continuousDocumentLayout.pageHeight}
                        pageGap={continuousDocumentLayout.pageGap}
                        contentHeight={continuousDocumentLayout.contentHeight}
                        printLayout={viewState.printLayout}
                        showFormattingMarks={viewState.showFormattingMarks}
                        paperStyle={documentLayoutStyle}
                        headerFooter={documentLayout.headerFooter}
                        overlayContent={signatureStrip}
                        commentAnchors={commentAnchors}
                        onContentChange={handleContentChange}
                        onEditorReady={setEditor}
                    />
                </DocumentSurfaceErrorBoundary>
                <DocumentSigningProgressPanel
                    document={doc}
                    anchorRef={canvasRef}
                    currentUserId={user?.userId ?? null}
                    canManageAccess={canManageAccess}
                    onOpenSigning={() => { void handleSignDocument(); }}
                    onActivityRecorded={handleShareActivityRecorded}
                    onDocumentRefresh={() => setRetryKey(v => v + 1)}
                />
            </div>{/* /.ded-page-body */}

            <DocumentCommentsPanel
                documentId={doc.id}
                editor={editor}
                canComment={canComment}
                canResolve={doc.access?.isOwner ?? true}
                selectionRequestKey={commentSelectionRequestKey}
                open={commentsOpen}
                comments={comments}
                loading={commentsLoading}
                loadingMore={commentsLoadingMore}
                error={commentsError}
                hasMore={commentsHasMore}
                activeCommentId={activeCommentId}
                onCommentsChange={setComments}
                onReload={loadComments}
                onLoadMore={loadMoreComments}
                onFocusComment={handleFocusComment}
                onClose={() => setCommentsOpen(false)}
            />

            {/* ── Signing modal ── */}
            {showSigning && doc.contentHash && (
                <SigningModal
                    document={doc}
                    onClose={() => setShowSigning(false)}
                    onSigned={async (updated) => {
                        const signedCurrentRequest = updated.signatureRequests?.find(
                            request => request.requestedUserId === user?.userId,
                        );

                        editor?.setEditable(false, false);
                        setDoc(prev => prev ? { ...prev, ...updated } : prev);
                        setSigningReadiness((current) => (
                            current
                                ? {
                                    ...current,
                                    status: 'already_signed',
                                    canSign: false,
                                    message: 'Your signature is recorded. This document is now read-only for you.',
                                    signedAt: signedCurrentRequest?.signedAt ?? current.signedAt,
                                }
                                : current
                        ));
                        setSigningReadinessLoading(false);
                        setShowSigning(false);

                        try {
                            const refreshed = await getDocument(id, true);
                            setDoc((current) => current ? { ...current, ...refreshed } : refreshed);

                            const refreshedSigners = getSignatureBlockSigners(refreshed, user);
                            const refreshedEvidence = buildSignatureBlockInserts(
                                refreshedSigners,
                                refreshed.completedSignatures,
                                refreshed.signatureSnapshot,
                            );
                            editor?.commands.updateSignatureBlockEvidence(refreshedEvidence);
                        } catch (error: unknown) {
                            toast.warning(
                                getErrorMessage(
                                    error,
                                    'Signature recorded, but the signed block could not be refreshed yet.',
                                ),
                            );
                        }

                        if (updated.status === 'SIGNED') {
                            toast.success('All required signatures are complete. The owner can now lock the document.');
                            return;
                        }

                        toast.success(
                            `Signature recorded. Waiting for ${updated.pendingSignatureCount ?? 0} remaining signer${updated.pendingSignatureCount === 1 ? '' : 's'}.`,
                        );
                    }}
                />
            )}

            {accessTransitionMessage && <div className="ded-access-transition-scrim" aria-hidden="true" />}
        </div>
    );
}
