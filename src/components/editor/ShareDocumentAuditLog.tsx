/**
 * ShareDocumentAuditLog
 *
 * Owner-only timeline of document sharing and invitation events. The API
 * returns sanitized metadata only; sensitive network details stay server-side.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    getDocumentAccessAuditLog,
    type DocumentAccessAuditEntry,
    type DocumentAccessAuditEvent,
    type CollaboratorPermission,
} from '@/api/documents.api';
import { Button } from '@/components/ui';
import styles from './ShareDocumentAuditLog.module.css';

interface ShareDocumentAuditLogProps {
    documentId: string;
    refreshKey: number;
    onCountChange: (count: number) => void;
}

const EVENT_LABELS: Record<DocumentAccessAuditEvent, string> = {
    INVITE_CREATED: 'Invitation created',
    INVITE_EMAIL_QUEUED: 'Email queued',
    INVITE_EMAIL_SENT: 'Email sent',
    INVITE_EMAIL_FAILED: 'Email failed',
    INVITE_EMAIL_OTP_REQUIRED: 'Email OTP required',
    INVITE_EMAIL_OTP_SENT: 'Email OTP sent',
    INVITE_EMAIL_OTP_FAILED: 'Email OTP failed',
    INVITE_EMAIL_OTP_PASSED: 'Email OTP passed',
    INVITE_OPENED: 'Invitation opened',
    AUTH_REQUIRED: 'Authentication required',
    LOGIN_COMPLETED: 'Login completed',
    IDENTITY_VERIFICATION_REQUIRED: 'Identity verification required',
    IDENTITY_VERIFICATION_PASSED: 'Identity verification passed',
    IDENTITY_VERIFICATION_FAILED: 'Identity verification failed',
    INVITE_ACCEPTED: 'Invitation accepted',
    INVITE_DECLINED: 'Invitation declined',
    INVITE_REVOKED: 'Access revoked',
    PERMISSIONS_UPDATED: 'Permissions updated',
    COMMENT_CREATED: 'Comment added',
    COMMENT_REPLIED: 'Comment replied',
    COMMENT_RESOLVED: 'Comment resolved',
    DOCUMENT_SIGNED: 'Document signed',
    DOCUMENT_LOCKED: 'Document locked',
    SIGNATURE_REMINDER_SENT: 'Signature reminder sent',
    SIGNATURE_REMINDER_FAILED: 'Signature reminder failed',
};

function getErrorMessage(error: unknown, fallback: string) {
    const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
}

function formatDate(value: string) {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatPermission(permission: CollaboratorPermission) {
    if (permission === 'MANAGE_ACCESS') return 'Manage access';
    return permission.charAt(0) + permission.slice(1).toLowerCase();
}

function formatPermissions(permissions: CollaboratorPermission[]) {
    const visible = permissions.filter((permission) => permission !== 'READ');
    if (visible.length === 0) return 'Read only';
    const permissionsWithRead: CollaboratorPermission[] = ['READ', ...visible];
    return permissionsWithRead.map(formatPermission).join(', ');
}

function getNumericMetadata(
    event: DocumentAccessAuditEntry,
    key: string,
) {
    const value = event.metadata?.[key];
    return typeof value === 'number' ? value : null;
}

function getStringMetadata(
    event: DocumentAccessAuditEntry,
    key: string,
) {
    const value = event.metadata?.[key];
    return typeof value === 'string' && value.trim() ? value : null;
}

function getActorLabel(event: DocumentAccessAuditEntry) {
    if (event.actor) return event.actor.displayName;
    if (event.eventType === 'INVITE_OPENED') return 'Invitation link';
    return 'System';
}

function getEventDescription(event: DocumentAccessAuditEntry) {
    const target = event.target?.displayName ?? 'recipient';
    const actor = event.actor?.displayName ?? 'Someone';
    if (event.eventType === 'PERMISSIONS_UPDATED') {
        return `${target}: ${formatPermissions(event.fromPermissions)} -> ${formatPermissions(event.toPermissions)}`;
    }

    if (event.eventType === 'COMMENT_CREATED') {
        return event.metadata?.anchored
            ? `${actor} added an anchored comment.`
            : `${actor} added a document comment.`;
    }

    if (event.eventType === 'COMMENT_REPLIED') {
        return `${actor} replied to a document comment.`;
    }

    if (event.eventType === 'COMMENT_RESOLVED') {
        return `${actor} resolved a comment from ${target}.`;
    }

    if (event.eventType === 'DOCUMENT_SIGNED') {
        const order = typeof event.metadata?.signingOrder === 'number'
            ? ` (#${event.metadata.signingOrder})`
            : '';
        const pending = typeof event.metadata?.pendingSignatureCount === 'number'
            ? event.metadata.pendingSignatureCount
            : null;
        const pendingText = pending === null
            ? ''
            : pending === 0
                ? ' All required signatures are complete.'
                : ` ${pending} signer${pending === 1 ? '' : 's'} still pending.`;
        return `${actor} completed their signature${order}.${pendingText}`;
    }

    if (event.eventType === 'DOCUMENT_LOCKED') {
        const completed = typeof event.metadata?.completedSignatureCount === 'number'
            ? event.metadata.completedSignatureCount
            : null;
        return completed === null
            ? `${actor} locked the document.`
            : `${actor} locked the document after ${completed} completed signature${completed === 1 ? '' : 's'}.`;
    }

    if (event.eventType === 'INVITE_CREATED' && event.metadata?.resent) {
        return `New invitation token issued for ${target}.`;
    }

    if (event.eventType === 'INVITE_CREATED') return `${target} was invited.`;
    if (event.eventType === 'AUTH_REQUIRED') return `${target} must sign in with the invited account before reviewing the invitation.`;
    if (event.eventType === 'LOGIN_COMPLETED') return `${target} signed in with the invited account.`;
    if (event.eventType === 'INVITE_EMAIL_OTP_REQUIRED') return `${target} must verify their email before reviewing the invitation.`;
    if (event.eventType === 'INVITE_EMAIL_OTP_SENT') return `Invitation verification code sent to ${target}.`;
    if (event.eventType === 'INVITE_EMAIL_OTP_FAILED') return `Invitation email verification failed for ${target}.`;
    if (event.eventType === 'INVITE_EMAIL_OTP_PASSED') return `${target} passed the invitation email verification step.`;
    if (event.eventType === 'IDENTITY_VERIFICATION_REQUIRED') return `${target} must complete the invitation identity challenge before review is unlocked.`;
    if (event.eventType === 'IDENTITY_VERIFICATION_PASSED') return `${target} passed the invitation identity verification step.`;
    if (event.eventType === 'IDENTITY_VERIFICATION_FAILED') {
        const failReason = getStringMetadata(event, 'failReason');
        return failReason
            ? `${target} failed the invitation identity verification step: ${failReason}`
            : `${target} failed the invitation identity verification step.`;
    }
    if (event.eventType === 'INVITE_REVOKED') return `${target}'s access was removed.`;
    if (event.eventType === 'INVITE_ACCEPTED') return `${target} completed the full invitation proof chain and accepted the invitation.`;
    if (event.eventType === 'INVITE_DECLINED') return `${target} declined the invitation.`;
    if (event.eventType === 'INVITE_OPENED') return `${target} opened the invitation link.`;
    if (event.eventType === 'SIGNATURE_REMINDER_FAILED') return `Signature reminder delivery failed for ${target}.`;
    if (event.eventType === 'SIGNATURE_REMINDER_SENT') return `Signature reminder sent to ${target}.`;
    if (event.eventType === 'INVITE_EMAIL_FAILED') return `Email delivery failed for ${target}.`;
    if (event.eventType === 'INVITE_EMAIL_SENT') return `Invitation email sent to ${target}.`;
    if (event.eventType === 'INVITE_EMAIL_QUEUED') return `Invitation email queued for ${target}.`;
    return target;
}

function getEventMetrics(event: DocumentAccessAuditEntry) {
    if (event.eventType === 'DOCUMENT_SIGNED') {
        const signingOrder = getNumericMetadata(event, 'signingOrder');
        const totalRequired = getNumericMetadata(event, 'totalRequired');
        const totalSigned = getNumericMetadata(event, 'totalSigned');
        const pending = getNumericMetadata(event, 'pendingSignatureCount');
        const metrics: string[] = [];

        if (signingOrder !== null && totalRequired !== null) {
            metrics.push(`Order ${signingOrder}/${totalRequired}`);
        } else if (signingOrder !== null) {
            metrics.push(`Order #${signingOrder}`);
        }

        if (totalSigned !== null && totalRequired !== null) {
            metrics.push(`Completed ${totalSigned}/${totalRequired}`);
        }

        if (pending !== null) {
            metrics.push(`Pending ${pending}`);
        }

        return metrics;
    }

    if (event.eventType === 'DOCUMENT_LOCKED') {
        const completed = getNumericMetadata(event, 'completedSignatureCount');
        const lockedAt = getStringMetadata(event, 'lockedAt');
        const metrics: string[] = [];

        if (completed !== null) {
            metrics.push(`Completed signatures ${completed}`);
        }

        if (lockedAt) {
            metrics.push(`Locked ${formatDate(lockedAt)}`);
        }

        return metrics;
    }

    if (event.eventType === 'INVITE_EMAIL_OTP_SENT') {
        const sentAt = getStringMetadata(event, 'emailOtpSentAt');
        const expiresAt = getStringMetadata(event, 'emailOtpExpiresAt');
        const metrics: string[] = [];

        if (sentAt) {
            metrics.push(`Sent ${formatDate(sentAt)}`);
        }

        if (expiresAt) {
            metrics.push(`Expires ${formatDate(expiresAt)}`);
        }

        return metrics;
    }

    if (event.eventType === 'INVITE_EMAIL_OTP_PASSED') {
        const verifiedAt = getStringMetadata(event, 'emailOtpVerifiedAt');
        return verifiedAt ? [`Passed ${formatDate(verifiedAt)}`] : [];
    }

    if (
        event.eventType === 'IDENTITY_VERIFICATION_REQUIRED' ||
        event.eventType === 'IDENTITY_VERIFICATION_PASSED'
    ) {
        const challengeStartedAt = getStringMetadata(
            event,
            'identityChallengeStartedAt',
        );
        const verifiedAt = getStringMetadata(event, 'identityVerifiedAt');
        const attemptId = getStringMetadata(
            event,
            'identityVerificationAttemptId',
        );
        const metrics: string[] = [];

        if (challengeStartedAt) {
            metrics.push(`Challenge ${formatDate(challengeStartedAt)}`);
        }

        if (verifiedAt) {
            metrics.push(`Passed ${formatDate(verifiedAt)}`);
        }

        if (attemptId) {
            metrics.push(`Attempt ${attemptId.slice(0, 8)}`);
        }

        return metrics;
    }

    if (event.eventType === 'IDENTITY_VERIFICATION_FAILED') {
        const challengeStartedAt = getStringMetadata(
            event,
            'identityChallengeStartedAt',
        );
        const failedAt = getStringMetadata(
            event,
            'identityVerificationFailedAt',
        );
        const attemptId = getStringMetadata(
            event,
            'identityVerificationAttemptId',
        );
        const metrics: string[] = [];

        if (challengeStartedAt) {
            metrics.push(`Challenge ${formatDate(challengeStartedAt)}`);
        }

        if (failedAt) {
            metrics.push(`Failed ${formatDate(failedAt)}`);
        }

        if (attemptId) {
            metrics.push(`Attempt ${attemptId.slice(0, 8)}`);
        }

        return metrics;
    }

    if (event.eventType === 'INVITE_ACCEPTED') {
        const acceptedAt = getStringMetadata(event, 'acceptedAt');
        return acceptedAt ? [`Accepted ${formatDate(acceptedAt)}`] : [];
    }

    return [];
}

function getTone(eventType: DocumentAccessAuditEvent) {
    if (
        eventType === 'INVITE_EMAIL_FAILED' ||
        eventType === 'INVITE_EMAIL_OTP_FAILED' ||
        eventType === 'IDENTITY_VERIFICATION_FAILED' ||
        eventType === 'SIGNATURE_REMINDER_FAILED'
    ) return 'danger';
    if (
        eventType === 'INVITE_ACCEPTED' ||
        eventType === 'INVITE_EMAIL_OTP_PASSED' ||
        eventType === 'IDENTITY_VERIFICATION_PASSED' ||
        eventType === 'COMMENT_RESOLVED' ||
        eventType === 'DOCUMENT_SIGNED' ||
        eventType === 'DOCUMENT_LOCKED' ||
        eventType === 'SIGNATURE_REMINDER_SENT'
    ) return 'success';
    if (
        eventType === 'INVITE_REVOKED' ||
        eventType === 'INVITE_DECLINED' ||
        eventType === 'INVITE_EMAIL_OTP_REQUIRED'
    ) return 'muted';
    return 'default';
}

/** Fetches and renders the document access audit timeline. */
export function ShareDocumentAuditLog({
    documentId,
    refreshKey,
    onCountChange,
}: ShareDocumentAuditLogProps) {
    const [events, setEvents] = useState<DocumentAccessAuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAuditLog = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getDocumentAccessAuditLog(documentId);
            setEvents(response.events);
            onCountChange(response.events.length);
        } catch (loadError: unknown) {
            setError(getErrorMessage(loadError, 'Unable to load access activity.'));
        } finally {
            setLoading(false);
        }
    }, [documentId, onCountChange]);

    useEffect(() => {
        void loadAuditLog();
    }, [loadAuditLog, refreshKey]);

    if (loading) {
        return (
            <div className={styles.list}>
                {[0, 1, 2].map((i) => (
                    <div key={i} className={styles.skeleton}>
                        <div className={styles.skeletonAvatar} />
                        <div className={styles.skeletonLines}>
                            <div className={styles.skeletonLine} />
                            <div className={styles.skeletonLine} />
                            <div className={styles.skeletonLine} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.error}>
                <p>{error}</p>
                <Button type="button" size="sm" onClick={() => void loadAuditLog()}>Try again</Button>
            </div>
        );
    }

    if (events.length === 0) {
        return <p className={styles.empty}>No access activity has been recorded yet.</p>;
    }

    return (
        <ol className={styles.timeline}>
            {events.map((event) => (
                <li key={event.id} className={styles.item}>
                    <span className={`${styles.dot} ${getTone(event.eventType) === 'success' ? styles.successDot : getTone(event.eventType) === 'muted' ? styles.mutedDot : ''}`} />
                    <div className={styles.card}>
                        <div className={styles.head}>
                            <p className={styles.title}>{EVENT_LABELS[event.eventType]}</p>
                            <time className={styles.time} dateTime={event.createdAt}>
                                {formatDate(event.createdAt)}
                            </time>
                        </div>
                        <p className={styles.description}>
                            {getEventDescription(event)}
                        </p>
                        <p className={styles.meta}>
                            {['Actor: ' + getActorLabel(event), ...getEventMetrics(event)].join(' • ')}
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    );
}
