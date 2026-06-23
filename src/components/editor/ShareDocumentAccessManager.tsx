/**
 * ShareDocumentAccessManager
 *
 * Lists current collaborators and pending invitations for a document, then
 * lets an authorized user update permissions, resend an invitation, or revoke
 * access. Revocation uses an inline confirm overlay instead of window.confirm
 * so the UX stays smooth and native browser dialogs are avoided.
 */
'use client';

import { useEffect, useState } from 'react';
import { useSessionUser } from '@/app/(protected)/layout';
import {
    getDocumentAccessList,
    resendDocumentInvitation,
    revokeDocumentAccess,
    updateDocumentAccess,
    type CollaboratorPermission,
    type DocumentCollaboratorAccess,
} from '@/api/documents.api';
import { toast } from '@/components/ui';
import styles from './share-document-access-manager.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const PERMISSION_ORDER: CollaboratorPermission[] = ['READ', 'COMMENT', 'SIGN', 'EDIT', 'MANAGE_ACCESS'];

const ACCESS_PERMISSION_OPTIONS: Array<{ value: Exclude<CollaboratorPermission, 'READ'>; label: string }> = [
    { value: 'COMMENT',       label: 'Comment'       },
    { value: 'SIGN',          label: 'Sign'          },
    { value: 'EDIT',          label: 'Edit'          },
    { value: 'MANAGE_ACCESS', label: 'Manage access' },
];

// ── Pure helpers ──────────────────────────────────────────────────────────────

function normalizePermissions(permissions: CollaboratorPermission[]): CollaboratorPermission[] {
    const unique = new Set<CollaboratorPermission>(permissions);
    unique.add('READ');
    return PERMISSION_ORDER.filter((p) => unique.has(p));
}

function permissionSetsMatch(left: CollaboratorPermission[], right: CollaboratorPermission[]): boolean {
    return normalizePermissions(left).join('|') === normalizePermissions(right).join('|');
}

function togglePermission(
    permissions: CollaboratorPermission[],
    permission: Exclude<CollaboratorPermission, 'READ'>,
): CollaboratorPermission[] {
    const normalized = normalizePermissions(permissions);
    return normalized.includes(permission)
        ? normalized.filter((p) => p !== permission)
        : normalizePermissions([...normalized, permission]);
}

function formatDate(value: string | null): string | null {
    if (!value) return null;
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAccessInitials(access: DocumentCollaboratorAccess): string {
    const f = access.user.postNames?.[0] ?? '';
    const l = access.user.surName?.[0] ?? '';
    return (f || l) ? `${f}${l}`.toUpperCase() : access.user.email[0].toUpperCase();
}

function getAccessStatus(access: DocumentCollaboratorAccess) {
    if (access.invitationStatus === 'ACCEPTED' && access.isActive) {
        return { label: 'Has access', detail: `Accepted ${formatDate(access.acceptedAt) ?? 'recently'}`,              tone: 'active'   };
    }
    if (access.invitationStatus === 'PENDING') {
        return { label: 'Pending',    detail: `Expires ${formatDate(access.invitationExpiresAt) ?? 'soon'}`,           tone: 'pending'  };
    }
    if (access.invitationStatus === 'DECLINED') {
        return { label: 'Declined',   detail: `Declined ${formatDate(access.declinedAt) ?? 'the invitation'}`,        tone: 'muted'    };
    }
    if (access.invitationStatus === 'REVOKED') {
        return { label: 'Revoked',    detail: `Removed ${formatDate(access.revokedAt) ?? 'from access'}`,             tone: 'danger'   };
    }
    return     { label: 'Expired',   detail: `Expired ${formatDate(access.invitationExpiresAt) ?? 'recently'}`,       tone: 'muted'    };
}

function extractApiError(error: unknown, fallback: string): string {
    const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
    return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

function getStatusClass(tone: string) {
    if (tone === 'active') return styles.statusActive;
    if (tone === 'pending') return styles.statusPending;
    if (tone === 'danger') return styles.statusDanger;
    return styles.statusMuted;
}

// ── SkeletonLoader ────────────────────────────────────────────────────────────

/** Three animated placeholder cards shown while the access list loads. */
function SkeletonLoader() {
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

// ── Component ─────────────────────────────────────────────────────────────────

interface ShareDocumentAccessManagerProps {
    documentId: string;
    canGrantManageAccess: boolean;
    refreshKey: number;
    onCountChange: (count: number) => void;
    onActivityRecorded: () => void;
}

/** Renders the access list and exposes collaborator management actions. */
export function ShareDocumentAccessManager({
    documentId,
    canGrantManageAccess,
    refreshKey,
    onCountChange,
    onActivityRecorded,
}: ShareDocumentAccessManagerProps) {
    const currentUser = useSessionUser();
    const [items,          setItems]          = useState<DocumentCollaboratorAccess[]>([]);
    const [drafts,         setDrafts]         = useState<Record<string, CollaboratorPermission[]>>({});
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState<string | null>(null);
    const [busyId,         setBusyId]         = useState<string | null>(null);
    const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

    const permissionOptions = canGrantManageAccess
        ? ACCESS_PERMISSION_OPTIONS
        : ACCESS_PERMISSION_OPTIONS.filter((o) => o.value !== 'MANAGE_ACCESS');

    async function loadAccessList() {
        setLoading(true);
        setError(null);
        try {
            const response = await getDocumentAccessList(documentId);
            setItems(response.collaborators);
            setDrafts(Object.fromEntries(
                response.collaborators.map((item) => [item.id, normalizePermissions(item.permissions)]),
            ));
            onCountChange(response.collaborators.length);
        } catch (loadError: unknown) {
            setError(extractApiError(loadError, 'Unable to load people with access.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void loadAccessList(); }, [documentId, refreshKey]);

    function replaceItem(updated: DocumentCollaboratorAccess) {
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
        setDrafts((current) => ({ ...current, [updated.id]: normalizePermissions(updated.permissions) }));
    }

    async function saveAccess(access: DocumentCollaboratorAccess) {
        setBusyId(`${access.id}:save`);
        try {
            const updated = await updateDocumentAccess(documentId, access.id, drafts[access.id] ?? access.permissions);
            replaceItem(updated);
            onActivityRecorded();
            toast.success('Access permissions updated.');
        } catch (saveError: unknown) {
            toast.error(extractApiError(saveError, 'Unable to update permissions.'));
        } finally {
            setBusyId(null);
        }
    }

    async function resendAccess(access: DocumentCollaboratorAccess) {
        setBusyId(`${access.id}:resend`);
        try {
            const updated = await resendDocumentInvitation(documentId, access.id);
            replaceItem(updated);
            onActivityRecorded();
            toast[updated.emailStatus === 'failed' ? 'error' : 'success'](
                updated.emailStatus === 'failed'
                    ? 'Token refreshed, but email delivery failed.'
                    : 'Invitation email resent.',
            );
        } catch (resendError: unknown) {
            toast.error(extractApiError(resendError, 'Unable to resend invitation.'));
        } finally {
            setBusyId(null);
        }
    }

    async function revokeAccess(access: DocumentCollaboratorAccess) {
        setBusyId(`${access.id}:revoke`);
        try {
            await revokeDocumentAccess(documentId, access.id);
            await loadAccessList();
            onActivityRecorded();
            toast.success('Access removed.');
        } catch (revokeError: unknown) {
            toast.error(extractApiError(revokeError, 'Unable to revoke access.'));
        } finally {
            setBusyId(null);
            setConfirmRevokeId(null);
        }
    }

    if (loading) return <SkeletonLoader />;

    if (error) {
        return (
            <div className={styles.errorState}>
                <p>{error}</p>
                <button type="button" onClick={() => void loadAccessList()}>Try again</button>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>No one else has access yet.</p>
                <span>Invite a verified user to share this document.</span>
            </div>
        );
    }

    return (
        <div className={styles.list}>
            {items.map((access) => {
                const status     = getAccessStatus(access);
                const draft      = drafts[access.id] ?? access.permissions;
                const hasChanges = !permissionSetsMatch(draft, access.permissions);
                const isSelf     = currentUser?.userId === access.userId;
                const isAccepted = access.invitationStatus === 'ACCEPTED' && access.isActive;
                const isRevoked  = access.invitationStatus === 'REVOKED';
                const isProtectedManager = !canGrantManageAccess && access.permissions.includes('MANAGE_ACCESS');
                const disabled = Boolean(busyId) || isRevoked || isSelf || isProtectedManager;

                return (
                    <article key={access.id} className={styles.card}>
                        {/* ── Inline revoke confirm overlay ── */}
                        {confirmRevokeId === access.id && (
                            <div className={styles.confirm} role="alertdialog" aria-label="Confirm revoke">
                                <p className={styles.confirmText}>Remove access for {access.user.displayName}?</p>
                                <p className={styles.confirmSub}>
                                    They will immediately lose the ability to open this document.
                                </p>
                                <div className={styles.confirmActions}>
                                    <button
                                        type="button"
                                        className={styles.confirmNo}
                                        onClick={() => setConfirmRevokeId(null)}
                                        disabled={busyId === `${access.id}:revoke`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.confirmYes}
                                        onClick={() => void revokeAccess(access)}
                                        disabled={busyId === `${access.id}:revoke`}
                                    >
                                        {busyId === `${access.id}:revoke` ? 'Removing…' : 'Remove'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Card top: avatar + user + status ── */}
                        <div className={styles.cardTop}>
                            <div className={styles.avatar} aria-hidden="true">
                                <span className={styles.avatarInitials}>{getAccessInitials(access)}</span>
                            </div>
                            <div className={styles.user}>
                                <p className={styles.name}>{access.user.displayName}</p>
                                <p className={styles.email}>{access.user.email}</p>
                            </div>
                            <span className={`${styles.status} ${getStatusClass(status.tone)}`}>
                                {status.label}
                            </span>
                        </div>

                        <p className={styles.detail}>{status.detail}</p>
                        {access.note && <p className={styles.note}>&quot;{access.note}&quot;</p>}

                        {/* ── Permission toggles ── */}
                        <div
                            className={styles.permissions}
                            aria-label={`Permissions for ${access.user.email}`}
                        >
                            <span className={`${styles.permission} ${styles.permissionRead}`}>
                                <span className={styles.permissionText}>Read</span>
                                <span className={styles.readBadge}>Always</span>
                            </span>
                            {permissionOptions.map((option) => (
                                <label
                                    key={option.value}
                                    className={[
                                        styles.permission,
                                        draft.includes(option.value) ? styles.permissionChecked : '',
                                        disabled ? styles.permissionDisabled : '',
                                    ].filter(Boolean).join(' ')}
                                >
                                    <input
                                        type="checkbox"
                                        checked={draft.includes(option.value)}
                                        disabled={disabled}
                                        onChange={() => setDrafts((current) => ({
                                            ...current,
                                            [access.id]: togglePermission(draft, option.value),
                                        }))}
                                    />
                                    <span className={styles.permissionText}>{option.label}</span>
                                    <span className={styles.switchTrack} aria-hidden="true">
                                        <span className={styles.switchThumb} />
                                    </span>
                                </label>
                            ))}
                        </div>

                        {(isSelf || isProtectedManager) && (
                            <p className={styles.warning}>
                                {isSelf
                                    ? 'You cannot change or remove your own access.'
                                    : 'Only the owner can modify another access manager.'}
                            </p>
                        )}

                        {/* ── Actions ── */}
                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                disabled={disabled || !hasChanges || busyId === `${access.id}:save`}
                                onClick={() => void saveAccess(access)}
                            >
                                {busyId === `${access.id}:save` ? 'Saving…' : 'Save changes'}
                            </button>

                            {!isAccepted && (
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    disabled={Boolean(busyId) || isSelf || isProtectedManager}
                                    onClick={() => void resendAccess(access)}
                                >
                                    {busyId === `${access.id}:resend` ? 'Sending…' : 'Resend invite'}
                                </button>
                            )}

                            {!isRevoked && (
                                <button
                                    type="button"
                                    className={styles.dangerBtn}
                                    disabled={Boolean(busyId) || isSelf || isProtectedManager}
                                    onClick={() => setConfirmRevokeId(access.id)}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
