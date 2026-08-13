/**
 * DocumentCard
 *
 * Google Docs-style portrait thumbnail card for a single document.
 * Hover overlay exposes an Open action and a delete button.
 * Clicking delete raises onDelete — the parent renders the confirmation dialog.
 */
'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { StarIcon, Delete04Icon } from '@hugeicons/core-free-icons';
import type { DocumentSummary, DocumentStatus } from '@/api/documents.api';
import styles from './DocumentCard.module.css';

export const STATUS_LABELS: Record<DocumentStatus, string> = {
    DRAFT:     'Draft',
    FINALISED: 'Finalised',
    SIGNED:    'Signed',
    LOCKED:    'Locked',
};

const STATUS_CLASS: Record<DocumentStatus, string> = {
    DRAFT: styles.draft,
    FINALISED: styles.finalised,
    SIGNED: styles.signed,
    LOCKED: styles.locked,
};

/** Converts an ISO timestamp into a human-readable relative time string. */
function timeAgo(date: string): string {
    const diff  = Date.now() - new Date(date).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface DocumentCardProps {
    doc: DocumentSummary;
    starred: boolean;
    onDelete: (id: string, title: string) => void;
    onToggleStar: (id: string) => void;
}

/**
 * Renders a single document as a portrait-thumbnail card.
 * The star button is always visible when active; appears on card hover otherwise.
 * The hover overlay reveals Open and Delete actions.
 */
export function DocumentCard({ doc, starred, onDelete, onToggleStar }: DocumentCardProps) {
    const isOwner = doc.access?.isOwner ?? true;
    const canDelete = isOwner && (doc.status === 'DRAFT' || doc.status === 'FINALISED');
    const sharedBy = doc.access?.sharedBy?.displayName || doc.access?.sharedBy?.email || null;

    return (
        <div className={styles.card}>
            {/* ── Thumbnail ── */}
            <div className={styles.thumb}>
                <div className={styles.thumbAccent} />
                <div className={styles.thumbLines}>
                    <div className={`${styles.line} ${styles.lineHeading}`} />
                    <div className={`${styles.line} ${styles.lineFull}`} />
                    <div className={`${styles.line} ${styles.lineLong}`} />
                    <div className={`${styles.line} ${styles.lineFull}`} />
                    <div className={`${styles.line} ${styles.lineMedium}`} />
                    <div className={`${styles.line} ${styles.lineFull}`} />
                    <div className={`${styles.line} ${styles.lineShort}`} />
                </div>

                {/* Status badge — top right */}
                <div className={styles.badgeWrap}>
                    <span className={`${styles.status} ${STATUS_CLASS[doc.status]}`}>
                        {STATUS_LABELS[doc.status]}
                    </span>
                </div>
                {!isOwner && (
                    <span className={styles.accessBadge}>
                        Shared
                    </span>
                )}

                {/* Hover action overlay */}
                <div className={styles.hoverActions}>
                    <Link
                        href={`/documents/${doc.id}/edit`}
                        className={styles.openButton}
                    >
                        {doc.status === 'LOCKED' ? 'View' : 'Open'}
                    </Link>
                    {canDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(doc.id, doc.title); }}
                            className={styles.deleteButton}
                            aria-label={`Delete ${doc.title}`}
                            title="Delete"
                        >
                            <HugeiconsIcon icon={Delete04Icon} size={15} color="currentColor" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Card body ── */}
            <div className={styles.body}>
                <div className={styles.titleRow}>
                    <p className={styles.title}>{doc.title}</p>
                    <button
                        onClick={(e) => { e.preventDefault(); onToggleStar(doc.id); }}
                        className={`${styles.star}${starred ? ` ${styles.starActive}` : ''}`}
                        aria-label={starred ? `Unstar ${doc.title}` : `Star ${doc.title}`}
                        title={starred ? 'Remove from starred' : 'Add to starred'}
                    >
                        <HugeiconsIcon
                            icon={StarIcon}
                            size={14}
                            color="currentColor"
                            fill={starred ? 'currentColor' : 'none'}
                            strokeWidth={starred ? 1.5 : 2}
                        />
                    </button>
                </div>

                <div className={styles.meta}>
                    <span>{timeAgo(doc.updatedAt)}</span>
                    {doc.wordCount > 0 && (
                        <>
                            <span className={styles.metaDot} />
                            <span>{doc.wordCount.toLocaleString()} words</span>
                        </>
                    )}
                </div>

                {!isOwner && sharedBy && (
                    <p className={styles.sharedBy} title={`Shared by ${sharedBy}`}>
                        Shared by {sharedBy}
                    </p>
                )}

                {doc.tags.length > 0 && (
                    <div className={styles.tags}>
                        {doc.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
