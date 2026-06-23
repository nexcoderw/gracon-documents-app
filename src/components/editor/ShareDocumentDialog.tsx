/**
 * ShareDocumentDialog
 *
 * Google Docs-style sharing modal. Lets the document owner search for
 * verified users, configure permissions, attach an optional note, and send
 * a secure invitation. Tabs expose current collaborators and the audit log.
 *
 * Sub-components (InviteForm) are defined here because they are not reused
 * outside this dialog. ShareDocumentAccessManager and ShareDocumentAuditLog
 * live in separate files because they are independently substantial.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Search01Icon, Share01Icon } from '@hugeicons/core-free-icons';
import {
    searchUsers,
    type UserSearchMode,
    type UserSearchResult,
} from '@/api/auth/search-users.api';
import {
    getUserPreferencesApi,
    type UserInviteVerificationPreference,
} from '@/api/auth/user-preferences.api';
import {
    getDocumentAccessList,
    shareDocumentAccess,
    type CollaboratorPermission,
    type InvitationVerificationRequirement,
} from '@/api/documents.api';
import { toast } from '@/components/ui';
import { ShareDocumentAuditLog } from './ShareDocumentAuditLog';
import { ShareDocumentAccessManager } from './ShareDocumentAccessManager';
import styles from './share-document-dialog.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS     = 350;
const MIN_QUERY_LEN   = 5;
const PLATFORM_ID_LEN = 11;
const CITIZEN_ID_LEN  = 16;

type AccessTab = 'invite' | 'people' | 'activity';

const PERMISSION_OPTIONS: Array<{
    value: Exclude<CollaboratorPermission, 'READ'>;
    label: string;
    description: string;
}> = [
    { value: 'COMMENT',       label: 'Comment',       description: 'Can review and leave comments'    },
    { value: 'SIGN',          label: 'Sign',           description: 'Can review and sign the document' },
    { value: 'EDIT',          label: 'Edit',           description: 'Can change the document content'  },
    { value: 'MANAGE_ACCESS', label: 'Manage access',  description: 'Can invite and update collaborators' },
];

const DEFAULT_VERIFICATION_REQUIREMENTS: InvitationVerificationRequirement[] = [];
const ACTIVE_VERIFICATION_FALLBACK: InvitationVerificationRequirement[] = ['EMAIL_OTP'];

const VERIFICATION_OPTIONS: Array<{
    value: InvitationVerificationRequirement | 'NONE';
    label: string;
    description: string;
}> = [
    {
        value: 'NONE',
        label: 'No verification',
        description: 'Recipient opens the invitation after signing in',
    },
    {
        value: 'EMAIL_OTP',
        label: 'Email code',
        description: 'Recipient confirms the invited email with a one-time code',
    },
    {
        value: 'IDENTITY_VERIFICATION',
        label: 'Identity check',
        description: 'Recipient completes the invitation identity challenge',
    },
];

const SEARCH_PLACEHOLDER: Record<UserSearchMode, string> = {
    email:      'Search by email address…',
    platformId: `Enter full Platform ID (${PLATFORM_ID_LEN} digits)…`,
    citizenId:  `Enter full Citizen ID (${CITIZEN_ID_LEN} digits)…`,
};

const SEARCH_HINT: Record<UserSearchMode, string> = {
    email:      `Type at least ${MIN_QUERY_LEN} characters to search`,
    platformId: `Enter the full Platform ID (${PLATFORM_ID_LEN} digits)`,
    citizenId:  `Enter the full Citizen ID (${CITIZEN_ID_LEN} digits)`,
};

const IDLE_COPY: Record<UserSearchMode, string> = {
    email:      'Enter an email address to find someone to share with',
    platformId: `Enter the full Platform ID (${PLATFORM_ID_LEN} digits) to find someone`,
    citizenId:  `Enter the full Citizen ID (${CITIZEN_ID_LEN} digits) to find someone`,
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns two-letter initials; falls back to the first character of the email. */
function getInitials(user: UserSearchResult): string {
    const f = user.postNames?.[0] ?? '';
    const l = user.surName?.[0] ?? '';
    return (f || l) ? `${f}${l}`.toUpperCase() : user.email[0].toUpperCase();
}

/** Full name when available; email prefix otherwise. */
function getDisplayName(user: UserSearchResult): string {
    return user.postNames || user.surName
        ? `${user.postNames ?? ''} ${user.surName ?? ''}`.trim()
        : user.email.split('@')[0];
}

/** Short label for the matchedBy field. */
function getMatchLabel(user: UserSearchResult): string {
    if (user.matchedBy === 'PLATFORM_ID') return 'Platform ID match';
    if (user.matchedBy === 'CITIZEN_ID')  return 'Citizen ID match';
    return 'Email match';
}

/** Pulls the API error message or returns a safe fallback. */
function extractApiError(error: unknown, fallback: string): string {
    const msg = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
    return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

/**
 * Converts auth-owned preference values into document invitation gate values.
 */
function mapDocumentPreferenceToRequirements(
    preferences: UserInviteVerificationPreference[],
): InvitationVerificationRequirement[] {
    if (preferences.includes('NO_VERIFICATION')) return [];

    return (['EMAIL_OTP', 'IDENTITY_VERIFICATION'] as const).filter((requirement) =>
        preferences.includes(requirement),
    );
}

/** Fixed-size user avatar with initials fallback for share dialog results. */
function ShareDialogAvatar({ user }: { user: UserSearchResult }) {
    return (
        <div className={styles.avatar} aria-hidden="true">
            <span className={styles.avatarInitials}>{getInitials(user)}</span>
        </div>
    );
}

// ── InviteForm ────────────────────────────────────────────────────────────────

interface InviteFormProps {
    user: UserSearchResult;
    permissions: CollaboratorPermission[];
    verificationRequirements: InvitationVerificationRequirement[];
    note: string;
    loading: boolean;
    error: string | null;
    canGrantManageAccess: boolean;
    onTogglePermission: (p: Exclude<CollaboratorPermission, 'READ'>) => void;
    onToggleVerificationRequirement: (requirement: InvitationVerificationRequirement) => void;
    onSetNoVerification: (enabled: boolean) => void;
    onNoteChange: (value: string) => void;
    onDeselect: () => void;
}

/**
 * Permission + note form that appears once the owner selects a recipient.
 * All state is lifted to the parent; this component is purely presentational.
 */
function InviteForm({
    user, permissions, verificationRequirements, note, loading, error, canGrantManageAccess,
    onTogglePermission, onToggleVerificationRequirement, onSetNoVerification, onNoteChange, onDeselect,
}: InviteFormProps) {
    const options = canGrantManageAccess
        ? PERMISSION_OPTIONS
        : PERMISSION_OPTIONS.filter((o) => o.value !== 'MANAGE_ACCESS');
    const noVerification = verificationRequirements.length === 0;

    return (
        <div className={styles.inviteForm}>
            {/* Recipient chip */}
            <div className={styles.recipient}>
                <ShareDialogAvatar user={user} />
                <div className={styles.recipientBody}>
                    <p className={styles.recipientMeta}>Selected recipient</p>
                    <p className={styles.recipientName}>{getDisplayName(user)}</p>
                    <p className={styles.recipientEmail}>{user.email}</p>
                </div>
                <button
                    className={styles.deselectBtn}
                    onClick={onDeselect}
                    aria-label="Deselect user"
                    disabled={loading}
                >
                    <HugeiconsIcon icon={Cancel01Icon} size={12} />
                </button>
            </div>

            {/* Permissions */}
            <div>
                <p className={styles.sectionTitle}>Permissions</p>
                <p className={styles.sectionHint}>
                    Read access is always included. Add one or more extra permissions.
                </p>
                <div className={styles.switchGrid}>
                    {options.map((option) => {
                        const checked = permissions.includes(option.value);
                        return (
                            <label
                                key={option.value}
                                className={`${styles.switchOption}${checked ? ` ${styles.switchOptionChecked}` : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onTogglePermission(option.value)}
                                />
                                <span className={styles.switchCopy}>
                                    <span className={styles.switchName}>{option.label}</span>
                                    <span className={styles.switchDesc}>{option.description}</span>
                                </span>
                                <span className={styles.switchTrack} aria-hidden="true">
                                    <span className={styles.switchThumb} />
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Verification requirements */}
            <div className={styles.verificationPanel}>
                <div className={styles.verificationHead}>
                    <div>
                        <p className={styles.sectionTitle}>Required verification</p>
                        <p className={styles.sectionHint}>
                            Choose the proof required before the invitation opens.
                        </p>
                    </div>
                    <span className={styles.verificationCount}>
                        {noVerification ? 'None' : `${verificationRequirements.length} active`}
                    </span>
                </div>
                <p className={styles.verificationLead}>
                    Login is always required. These settings control the extra checks after login.
                </p>
                <div className={styles.verificationGrid}>
                    {VERIFICATION_OPTIONS.map((option) => {
                        const isNoneOption = option.value === 'NONE';
                        const requirement = isNoneOption
                            ? null
                            : option.value as InvitationVerificationRequirement;
                        const checked = requirement
                            ? verificationRequirements.includes(requirement)
                            : noVerification;
                        const disabled = !isNoneOption && noVerification;
                        return (
                            <label
                                key={option.value}
                                className={[
                                    styles.verificationOption,
                                    checked ? styles.verificationOptionChecked : '',
                                    disabled ? styles.verificationOptionDisabled : '',
                                ].filter(Boolean).join(' ')}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() => {
                                        if (isNoneOption) {
                                            onSetNoVerification(!noVerification);
                                        } else if (requirement) {
                                            onToggleVerificationRequirement(requirement);
                                        }
                                    }}
                                />
                                <span className={styles.switchCopy}>
                                    <span className={styles.switchName}>{option.label}</span>
                                    <span className={styles.switchDesc}>{option.description}</span>
                                </span>
                                <span className={styles.switchTrack} aria-hidden="true">
                                    <span className={styles.switchThumb} />
                                </span>
                            </label>
                        );
                    })}
                </div>
                {noVerification && (
                    <p className={styles.verificationNote}>
                        No extra verification will be required after login.
                    </p>
                )}
            </div>

            {/* Note */}
            <div>
                <label htmlFor="share-note" className={styles.noteLabel}>
                    Note for the recipient
                </label>
                <textarea
                    id="share-note"
                    value={note}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Optional message for the invited user…"
                    maxLength={1000}
                    className={styles.noteField}
                />
            </div>

            {error && <p className={styles.inviteError}>{error}</p>}
        </div>
    );
}

// ── ShareDocumentDialog ───────────────────────────────────────────────────────

interface ShareDocumentDialogProps {
    documentId: string;
    docTitle: string;
    activityRefreshKey: number;
    /** When false, the MANAGE_ACCESS permission option is hidden. */
    canGrantManageAccess?: boolean;
    onActivityRecorded: () => void;
    onClose: () => void;
}

/**
 * Full-featured share dialog. The parent controls open/close state by
 * mounting or unmounting this component.
 */
export function ShareDocumentDialog({
    documentId,
    docTitle,
    activityRefreshKey,
    canGrantManageAccess = true,
    onActivityRecorded,
    onClose,
}: ShareDocumentDialogProps) {
    // ── Tab state ──
    const [activeTab,          setActiveTab]          = useState<AccessTab>('invite');
    const [accessCount,        setAccessCount]        = useState(0);
    const [activityCount,      setActivityCount]      = useState(0);
    const [accessRefreshKey,   setAccessRefreshKey]   = useState(0);

    // ── Existing access map (userId → 'active' | 'pending') ──
    // Used to mark search results so the owner knows who already has access.
    const [existingAccess, setExistingAccess] = useState<Map<string, 'active' | 'pending'>>(new Map());

    useEffect(() => {
        getDocumentAccessList(documentId)
            .then(({ collaborators }) => {
                const map = new Map<string, 'active' | 'pending'>();
                for (const c of collaborators) {
                    if (c.isActive && c.invitationStatus === 'ACCEPTED') map.set(c.userId, 'active');
                    else if (c.invitationStatus === 'PENDING') map.set(c.userId, 'pending');
                }
                setExistingAccess(map);
            })
            .catch(() => { /* silent — badge is cosmetic; API rejects duplicates anyway */ });
    }, [documentId, accessRefreshKey, activityRefreshKey]);

    // ── Search state ──
    const [searchMode,  setSearchMode]  = useState<UserSearchMode>('email');
    const [query,       setQuery]       = useState('');
    const [results,     setResults]     = useState<UserSearchResult[]>([]);
    const [selectedId,  setSelectedId]  = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
    const [loading,     setLoading]     = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    // ── Invite form state ──
    const [permissions,  setPermissions]  = useState<CollaboratorPermission[]>(['READ']);
    const [defaultVerificationRequirements, setDefaultVerificationRequirements] =
        useState<InvitationVerificationRequirement[]>(DEFAULT_VERIFICATION_REQUIREMENTS);
    const [verificationRequirements, setVerificationRequirements] =
        useState<InvitationVerificationRequirement[]>(DEFAULT_VERIFICATION_REQUIREMENTS);
    const [note,         setNote]         = useState('');
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError,   setShareError]   = useState<string | null>(null);

    const inputRef    = useRef<HTMLInputElement | null>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const verificationTouchedRef = useRef(false);

    // Auto-focus the search input on mount.
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Clean up the debounce timer on unmount.
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    // Hydrate the owner's saved document invitation defaults without blocking sharing.
    useEffect(() => {
        let cancelled = false;

        getUserPreferencesApi()
            .then(({ data }) => {
                if (cancelled) return;

                const nextDefaults = mapDocumentPreferenceToRequirements(
                    data.defaultDocumentInviteVerifications,
                );

                setDefaultVerificationRequirements(nextDefaults);
                if (!verificationTouchedRef.current) {
                    setVerificationRequirements(nextDefaults);
                }
            })
            .catch(() => {
                // Keep the local no-verification fallback; sharing still remains server-enforced.
            });

        return () => { cancelled = true; };
    }, []);

    const runSearch = useCallback(async (q: string, mode: UserSearchMode) => {
        setLoading(true);
        setSearchError(null);
        try {
            setResults(await searchUsers(q, mode));
            setHasSearched(true);
        } catch (err) {
            setSearchError(extractApiError(err, 'Search failed. Please try again.'));
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    function handleQueryChange(value: string) {
        const next = searchMode !== 'email' ? value.replace(/\D+/g, '') : value;
        setQuery(next);
        setSelectedId(null);
        if (timerRef.current) clearTimeout(timerRef.current);

        const trimmed     = next.trim();
        const requiredLen = searchMode === 'platformId' ? PLATFORM_ID_LEN
            : searchMode === 'citizenId' ? CITIZEN_ID_LEN : null;
        const ready = requiredLen !== null
            ? trimmed.length === requiredLen
            : trimmed.length >= MIN_QUERY_LEN;

        if (!ready) { setResults([]); setHasSearched(false); setSearchError(null); return; }
        timerRef.current = setTimeout(() => void runSearch(trimmed, searchMode), DEBOUNCE_MS);
    }

    function handleModeChange(mode: UserSearchMode) {
        setSearchMode(mode);
        setQuery(''); setResults([]); setSelectedId(null);
        setSelectedUser(null); setHasSearched(false); setSearchError(null);
        if (timerRef.current) clearTimeout(timerRef.current);
        inputRef.current?.focus();
    }

    function handleSelectUser(user: UserSearchResult) {
        setSelectedId(user.id);
        setSelectedUser(user);
        setShareError(null);
    }

    function handleDeselect() {
        setSelectedId(null);
        setSelectedUser(null);
        setShareError(null);
    }

    function handleTogglePermission(permission: Exclude<CollaboratorPermission, 'READ'>) {
        setPermissions((prev) =>
            prev.includes(permission)
                ? prev.filter((p) => p !== permission)
                : [...prev, permission],
        );
    }

    function handleToggleVerificationRequirement(requirement: InvitationVerificationRequirement) {
        verificationTouchedRef.current = true;
        setVerificationRequirements((prev) =>
            prev.includes(requirement)
                ? prev.filter((item) => item !== requirement)
                : [...prev, requirement],
        );
    }

    function handleSetNoVerification(enabled: boolean) {
        verificationTouchedRef.current = true;
        setVerificationRequirements(
            enabled
                ? []
                : defaultVerificationRequirements.length > 0
                  ? defaultVerificationRequirements
                  : ACTIVE_VERIFICATION_FALLBACK,
        );
    }

    async function handleSendInvitation() {
        if (!selectedUser || shareLoading) return;
        setShareLoading(true);
        setShareError(null);
        try {
            const response = await shareDocumentAccess(documentId, {
                userId: selectedUser.id,
                permissions,
                verificationRequirements,
                note: note.trim() || undefined,
            });
            if (response.emailStatus === 'failed') {
                toast.error('Access created, but the invitation email could not be sent.');
            } else {
            toast.success('Invitation sent successfully.');
            }
            setQuery(''); setResults([]); setSelectedId(null);
            setSelectedUser(null); setPermissions(['READ']);
            verificationTouchedRef.current = false;
            setVerificationRequirements(defaultVerificationRequirements);
            setNote('');
            setAccessRefreshKey((k) => k + 1);
            onActivityRecorded();
            setActiveTab('people');
        } catch (err) {
            setShareError(extractApiError(err, 'Unable to send the invitation right now.'));
        } finally {
            setShareLoading(false);
        }
    }

    const isSendMode = activeTab === 'invite' && Boolean(selectedUser);
    const showHint   = query.length > 0 && (
        searchMode === 'email'
            ? query.trim().length < MIN_QUERY_LEN
            : query.trim().length !== (searchMode === 'platformId' ? PLATFORM_ID_LEN : CITIZEN_ID_LEN)
    );
    const showEmpty   = hasSearched && !loading && results.length === 0 && !searchError;
    const showResults = results.length > 0;
    const accessListRefreshKey = accessRefreshKey + activityRefreshKey;

    const footerNote = activeTab === 'activity'
        ? 'Owner-only view. Sensitive network details stay server-side.'
        : activeTab === 'people'
        ? 'Every access change is server-enforced and recorded in the audit trail.'
        : selectedUser
        ? 'The invited user must sign in with the targeted verified account before accepting.'
        : 'Search for a verified user, then choose the permissions to grant.';

    return (
        <div
            ref={backdropRef}
            className={styles.backdrop}
            onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
        >
            <div className={styles.dialog}>
                {/* ── Header ── */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIcon} aria-hidden="true">
                            <HugeiconsIcon icon={Share01Icon} size={15} color="var(--color-primary)" />
                        </div>
                        <div>
                            <h2 id="share-dialog-title" className={styles.title}>Share document</h2>
                            <p className={styles.docName} title={docTitle}>{docTitle}</p>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close share dialog">
                        <HugeiconsIcon icon={Cancel01Icon} size={15} />
                    </button>
                </div>

                <div className={styles.divider} aria-hidden="true" />

                {/* ── Navigation tabs ── */}
                <div className={styles.tabs} role="tablist" aria-label="Share dialog sections">
                    {(['invite', 'people'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab}
                            className={`${styles.tab}${activeTab === tab ? ` ${styles.tabActive}` : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'invite' ? 'Invite user' : 'People with access'}
                            {tab === 'people' && accessCount > 0 && (
                                <span className={styles.tabCount}>{accessCount}</span>
                            )}
                        </button>
                    ))}
                    {canGrantManageAccess && (
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'activity'}
                            className={`${styles.tab}${activeTab === 'activity' ? ` ${styles.tabActive}` : ''}`}
                            onClick={() => setActiveTab('activity')}
                        >
                            Activity
                            {activityCount > 0 && (
                                <span className={styles.tabCount}>{activityCount}</span>
                            )}
                        </button>
                    )}
                </div>

                {/* ── Invite tab ── */}
                {activeTab === 'invite' && (
                    <>
                        {/* Search mode switch */}
                        <div className={styles.modeSwitch} role="tablist" aria-label="Search mode">
                            {(['email', 'platformId', 'citizenId'] as UserSearchMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    role="tab"
                                    aria-selected={searchMode === mode}
                                    className={`${styles.modeBtn}${searchMode === mode ? ` ${styles.modeBtnActive}` : ''}`}
                                    onClick={() => handleModeChange(mode)}
                                >
                                    {mode === 'email' ? 'Email' : mode === 'platformId' ? 'Platform ID' : 'Citizen ID'}
                                </button>
                            ))}
                        </div>

                        {/* Search input */}
                        <div className={styles.searchWrap}>
                            <div className={styles.searchIcon} aria-hidden="true">
                                {loading
                                    ? <span className={styles.searchSpinner} />
                                    : <HugeiconsIcon icon={Search01Icon} size={15} color="#9ca3af" />
                                }
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => handleQueryChange(e.target.value)}
                                placeholder={SEARCH_PLACEHOLDER[searchMode]}
                                className={styles.searchInput}
                                autoComplete="off"
                                spellCheck={false}
                                aria-label={`Search users by ${searchMode}`}
                                inputMode={searchMode !== 'email' ? 'numeric' : 'email'}
                            />
                            {query.length > 0 && (
                                <button
                                    className={styles.searchClear}
                                    onClick={() => handleQueryChange('')}
                                    aria-label="Clear search"
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={12} />
                                </button>
                            )}
                        </div>

                        {/* Scrollable results + form */}
                        <div className={styles.body}>
                            {!query && <p className={styles.idle}>{IDLE_COPY[searchMode]}</p>}
                            {showHint && <p className={styles.hint}>{SEARCH_HINT[searchMode]}</p>}
                            {searchError && <p className={styles.error}>{searchError}</p>}
                            {showEmpty && <p className={styles.empty}>No users found matching &quot;{query}&quot;</p>}

                            {showResults && (
                                <ul className={styles.results} role="listbox" aria-label="Search results">
                                    {results.map((user) => {
                                        const isSelected  = selectedId === user.id;
                                        const accessStatus = existingAccess.get(user.id);
                                        const hasAccess   = Boolean(accessStatus);
                                        const className   = [
                                            styles.result,
                                            isSelected && styles.resultSelected,
                                            hasAccess  && styles.resultHasAccess,
                                        ].filter(Boolean).join(' ');
                                        return (
                                            <li
                                                key={user.id}
                                                role="option"
                                                aria-selected={isSelected}
                                                aria-disabled={hasAccess}
                                                className={className}
                                                onClick={() => { if (!hasAccess) handleSelectUser(user); }}
                                            >
                                                <ShareDialogAvatar user={user} />
                                                <div className={styles.userInfo}>
                                                    <span className={styles.userName}>{getDisplayName(user)}</span>
                                                    <span className={styles.userEmail}>{user.email}</span>
                                                    <span className={styles.userMatch}>{getMatchLabel(user)}</span>
                                                </div>
                                                {accessStatus && (
                                                    <span className={`${styles.accessBadge} ${accessStatus === 'active' ? styles.accessBadgeActive : styles.accessBadgePending}`}>
                                                        {accessStatus === 'active' ? 'Has access' : 'Invite pending'}
                                                    </span>
                                                )}
                                                {isSelected && !hasAccess && (
                                                    <div className={styles.check} aria-hidden="true">
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                            <circle cx="8" cy="8" r="8" fill="var(--color-primary)" />
                                                            <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}

                            {/* Invite form — appears once a user is selected */}
                            {selectedUser && (
                                <>
                                    <div className={styles.inviteDivider} aria-hidden="true" />
                                    <InviteForm
                                        user={selectedUser}
                                        permissions={permissions}
                                        verificationRequirements={verificationRequirements}
                                        note={note}
                                        loading={shareLoading}
                                        error={shareError}
                                        canGrantManageAccess={canGrantManageAccess}
                                        onTogglePermission={handleTogglePermission}
                                        onToggleVerificationRequirement={handleToggleVerificationRequirement}
                                        onSetNoVerification={handleSetNoVerification}
                                        onNoteChange={setNote}
                                        onDeselect={handleDeselect}
                                    />
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* ── People tab ── */}
                {activeTab === 'people' && (
                    <div className={`${styles.body} share-dialog__body--access`}>
                        <ShareDocumentAccessManager
                            documentId={documentId}
                            canGrantManageAccess={canGrantManageAccess}
                            refreshKey={accessListRefreshKey}
                            onCountChange={setAccessCount}
                            onActivityRecorded={onActivityRecorded}
                        />
                    </div>
                )}

                {/* ── Activity tab ── */}
                {canGrantManageAccess && activeTab === 'activity' && (
                    <div className={`${styles.body} share-dialog__body--access`}>
                        <ShareDocumentAuditLog
                            documentId={documentId}
                            refreshKey={activityRefreshKey}
                            onCountChange={setActivityCount}
                        />
                    </div>
                )}

                {/* ── Footer ── */}
                <div className={styles.footer}>
                    <p className={styles.footerNote}>{footerNote}</p>
                    <button
                        className={styles.doneBtn}
                        onClick={isSendMode ? handleSendInvitation : onClose}
                        disabled={shareLoading}
                    >
                        {isSendMode ? (shareLoading ? 'Sending…' : 'Send invitation') : 'Done'}
                    </button>
                </div>
            </div>
        </div>
    );
}
