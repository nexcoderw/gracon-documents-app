/**
 * DocumentCommentsPanel
 *
 * Right-side comment drawer for document collaborators. Comments are separate
 * from editor content, so COMMENT-only users can review without write access.
 */
'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
    createDocumentComment,
    resolveDocumentComment,
    type DocumentComment,
} from '@/api/documents.api';
import { toast } from '@/components/ui';
import styles from './DocumentCommentsPanel.module.css';

interface DocumentCommentsPanelProps {
    documentId: string;
    editor: Editor | null;
    canComment: boolean;
    canResolve: boolean;
    open: boolean;
    comments: DocumentComment[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    activeCommentId: string | null;
    onCommentsChange: (comments: DocumentComment[]) => void;
    onReload: () => void | Promise<void>;
    onLoadMore: () => void | Promise<void>;
    onFocusComment: (comment: DocumentComment) => void;
    onClose: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
    const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
}

function formatCommentDate(value: string) {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getInitials(comment: DocumentComment) {
    const name = comment.author.displayName || comment.author.email;
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || comment.author.email[0].toUpperCase();
}

function getSelectedText(editor: Editor | null) {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    if (from === to) return '';
    return editor.state.doc
        .textBetween(from, to, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
}

function mergeCreatedComment(
    comments: DocumentComment[],
    created: DocumentComment,
) {
    if (!created.parentCommentId) {
        return [created, ...comments];
    }

    return comments.map((comment) => {
        if (comment.id !== created.parentCommentId) return comment;
        return {
            ...comment,
            replies: [...comment.replies, created],
        };
    });
}

function replaceComment(
    comments: DocumentComment[],
    updated: DocumentComment,
) {
    return comments.map((comment) => comment.id === updated.id ? updated : comment);
}

function cx(...classNames: Array<string | false>) {
    return classNames.filter(Boolean).join(' ');
}

function CommentCard({
    comment,
    active,
    canComment,
    canResolve,
    busyCommentId,
    replyDraft,
    onReplyChange,
    onReplySubmit,
    onResolve,
    onFocus,
}: {
    comment: DocumentComment;
    active: boolean;
    canComment: boolean;
    canResolve: boolean;
    busyCommentId: string | null;
    replyDraft: string;
    onReplyChange: (value: string) => void;
    onReplySubmit: () => void;
    onResolve: () => void;
    onFocus: () => void;
}) {
    const isResolved = Boolean(comment.resolvedAt);
    const isBusy = busyCommentId === comment.id;

    return (
        <article className={cx(styles.card, isResolved && styles.resolvedCard, active && styles.activeCard)}>
            <div className={styles.cardHead}>
                <div className={styles.avatar} aria-hidden="true">
                    <span className={styles.avatarText}>{getInitials(comment)}</span>
                </div>
                <div className={styles.identity}>
                    <p className={styles.identityName}>{comment.author.displayName}</p>
                    <time className={styles.metaTime} dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
                </div>
                {isResolved && <span className={styles.status}>Resolved</span>}
            </div>

            {comment.anchorText && (
                <button
                    type="button"
                    className={styles.anchor}
                    onClick={onFocus}
                    title="Go to commented text"
                >
                    {comment.anchorText}
                </button>
            )}

            <p className={styles.content}>{comment.content}</p>

            {comment.replies.length > 0 && (
                <div className={styles.replies}>
                    {comment.replies.map((reply) => (
                        <div key={reply.id} className={styles.reply}>
                            <div className={styles.replyMeta}>
                                <strong className={styles.replyAuthor}>{reply.author.displayName}</strong>
                                <time className={styles.metaTime} dateTime={reply.createdAt}>{formatCommentDate(reply.createdAt)}</time>
                            </div>
                            <p className={styles.replyContent}>{reply.content}</p>
                        </div>
                    ))}
                </div>
            )}

            {!isResolved && canComment && (
                <div className={styles.replyForm}>
                    <input
                        className={styles.replyInput}
                        value={replyDraft}
                        onChange={(event) => onReplyChange(event.target.value)}
                        placeholder="Reply..."
                        disabled={Boolean(busyCommentId)}
                        maxLength={4000}
                    />
                    <button
                        type="button"
                        className={styles.replyButton}
                        disabled={Boolean(busyCommentId) || !replyDraft.trim()}
                        onClick={onReplySubmit}
                    >
                        Reply
                    </button>
                </div>
            )}

            {!isResolved && canResolve && (
                <button
                    type="button"
                    className={styles.resolveButton}
                    disabled={Boolean(busyCommentId)}
                    onClick={onResolve}
                >
                    {isBusy ? 'Resolving...' : 'Resolve'}
                </button>
            )}
        </article>
    );
}

/** Renders the document comments drawer. */
export function DocumentCommentsPanel({
    documentId,
    editor,
    canComment,
    canResolve,
    open,
    comments,
    loading,
    loadingMore,
    error,
    hasMore,
    activeCommentId,
    onCommentsChange,
    onReload,
    onLoadMore,
    onFocusComment,
    onClose,
}: DocumentCommentsPanelProps) {
    const [content, setContent] = useState('');
    const [anchorText, setAnchorText] = useState('');
    const [anchorFrom, setAnchorFrom] = useState<number | null>(null);
    const [anchorTo, setAnchorTo] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) return;
        void onReload();
    }, [documentId, open, onReload]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    function captureSelection() {
        const selectedText = getSelectedText(editor);
        if (!selectedText) {
            toast.info('Select text in the document first.');
            return;
        }

        const selection = editor?.state.selection;
        setAnchorText(selectedText);
        setAnchorFrom(selection?.from ?? null);
        setAnchorTo(selection?.to ?? null);
    }

    async function submitComment() {
        const trimmedContent = content.trim();
        if (!trimmedContent || submitting) return;

        setSubmitting(true);
        try {
            const created = await createDocumentComment(documentId, {
                content: trimmedContent,
                ...(anchorText.trim() ? { anchorText: anchorText.trim() } : {}),
                ...(anchorFrom !== null ? { anchorFrom } : {}),
                ...(anchorTo !== null ? { anchorTo } : {}),
            });
            onCommentsChange(mergeCreatedComment(comments, created));
            setContent('');
            setAnchorText('');
            setAnchorFrom(null);
            setAnchorTo(null);
            toast.success('Comment added.');
        } catch (submitError: unknown) {
            toast.error(getErrorMessage(submitError, 'Unable to add comment.'));
        } finally {
            setSubmitting(false);
        }
    }

    async function submitReply(parentCommentId: string) {
        const draft = replyDrafts[parentCommentId]?.trim() ?? '';
        if (!draft || busyCommentId) return;

        setBusyCommentId(parentCommentId);
        try {
            const created = await createDocumentComment(documentId, {
                content: draft,
                parentCommentId,
            });
            onCommentsChange(mergeCreatedComment(comments, created));
            setReplyDrafts((current) => ({ ...current, [parentCommentId]: '' }));
        } catch (replyError: unknown) {
            toast.error(getErrorMessage(replyError, 'Unable to add reply.'));
        } finally {
            setBusyCommentId(null);
        }
    }

    async function resolveComment(commentId: string) {
        if (busyCommentId) return;

        setBusyCommentId(commentId);
        try {
            const updated = await resolveDocumentComment(documentId, commentId);
            onCommentsChange(replaceComment(comments, updated));
            toast.success('Comment resolved.');
        } catch (resolveError: unknown) {
            toast.error(getErrorMessage(resolveError, 'Unable to resolve comment.'));
        } finally {
            setBusyCommentId(null);
        }
    }

    return (
        <aside className={styles.panel} aria-label="Document comments">
            <div className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Review</p>
                    <h2 className={styles.title}>Comments</h2>
                </div>
                <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close comments">
                    &times;
                </button>
            </div>

            {canComment ? (
                <div className={styles.composer}>
                    <textarea
                        className={styles.composerTextarea}
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="Add a comment..."
                        maxLength={4000}
                        disabled={submitting}
                    />
                    {anchorText && (
                        <div className={styles.selection}>
                            <span className={styles.selectionText}>{anchorText}</span>
                            <button
                                type="button"
                                className={styles.selectionClear}
                                onClick={() => {
                                    setAnchorText('');
                                    setAnchorFrom(null);
                                    setAnchorTo(null);
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                    <div className={styles.composerActions}>
                        <button type="button" className={styles.ghostButton} onClick={captureSelection}>
                            Use selection
                        </button>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            disabled={submitting || !content.trim()}
                            onClick={submitComment}
                        >
                            {submitting ? 'Adding...' : 'Comment'}
                        </button>
                    </div>
                </div>
            ) : (
                <p className={styles.notice}>
                    You can view comments, but you do not have permission to add them.
                </p>
            )}

            <div className={styles.body}>
                {loading && <p className={styles.empty}>Loading comments...</p>}
                {error && (
                    <div className={styles.error}>
                        <p className={styles.errorText}>{error}</p>
                        <button type="button" className={styles.errorButton} onClick={() => void onReload()}>Try again</button>
                    </div>
                )}
                {!loading && !error && comments.length === 0 && (
                    <p className={styles.empty}>
                        No comments yet. Select text and start the review.
                    </p>
                )}
                {!loading && !error && comments.length > 0 && (
                    <div className={styles.list}>
                        {comments.map((comment) => (
                            <CommentCard
                                key={comment.id}
                                comment={comment}
                                active={activeCommentId === comment.id}
                                canComment={canComment}
                                canResolve={canResolve}
                                busyCommentId={busyCommentId}
                                replyDraft={replyDrafts[comment.id] ?? ''}
                                onReplyChange={(value) =>
                                    setReplyDrafts((current) => ({
                                        ...current,
                                        [comment.id]: value,
                                    }))
                                }
                                onReplySubmit={() => void submitReply(comment.id)}
                                onResolve={() => void resolveComment(comment.id)}
                                onFocus={() => onFocusComment(comment)}
                            />
                        ))}
                        {hasMore && (
                            <button
                                type="button"
                                className={styles.loadMoreButton}
                                disabled={loadingMore}
                                onClick={() => void onLoadMore()}
                            >
                                {loadingMore
                                    ? 'Loading older comments...'
                                    : 'Load older comments'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
