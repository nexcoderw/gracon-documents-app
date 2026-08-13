'use client';

/**
 * InvitationAcceptanceView
 *
 * Public invitation review surface for the documents workspace.
 *
 * Loads a safe preview without revealing the document title. Once the
 * invited verified user passes the two verification gates (email OTP +
 * identity challenge), upgrades to the full review state with Accept /
 * Decline controls.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { Button, Card, PremiumLoader } from '@/components/ui';
import {
    acceptInvitation,
    declineInvitation,
    getInvitationGateStatus,
    getInvitationPreview,
    getInvitationReview,
    type InvitationGateStatus,
    type InvitationPreview,
    type InvitationReview,
} from '@/api/invitations.api';
import { getAccessToken } from '@/lib/session';
import { InvitationInfoCard } from './InvitationInfoCard';
import { InvitationReviewPanel } from './InvitationReviewPanel';
import { InvitationVerificationPanel } from './InvitationVerificationPanel';

type Props = { token: string };

// ─── Local helpers ────────────────────────────────────────────────────────────

/** Extracts a human-readable error message from an Axios response. */
function getApiMessage(error: unknown, fallback: string): string {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    const msg = axiosError.response?.data?.message ?? axiosError.response?.data?.error;
    return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

/** Inline spinner row shown during async fetches. */
function LoadingRow({ message }: { message: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0', color: 'var(--color-text-secondary)' }}>
            <PremiumLoader color="primary" />
            <span style={{ fontSize: 14 }}>{message}</span>
        </div>
    );
}

/** Inline alert block — error (red) or warning (amber) variant. */
function AlertBanner({ variant, children }: { variant: 'error' | 'warning'; children: React.ReactNode }) {
    const isError = variant === 'error';
    return (
        <div role="alert" style={{
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${isError ? 'var(--color-error-border)' : 'rgba(217,119,6,0.28)'}`,
            background: isError ? 'var(--color-error-subtle)' : 'var(--color-warning-subtle)',
            padding: '14px 16px',
            color: isError ? 'var(--color-error)' : 'var(--color-warning)',
            fontSize: 13, lineHeight: 1.6,
        }}>
            {children}
        </div>
    );
}

/** Describes the inviter-selected verification gates without exposing document details. */
function getVerificationIntro(preview: InvitationPreview | null): string {
    if (!preview) {
        return 'The document title stays hidden until the invited account is allowed to review this invitation.';
    }

    const requirements = preview?.invitation.verificationRequirements ?? [];

    if (requirements.length === 0) {
        return 'After signing in with the invited account, you can review this invitation without extra verification.';
    }

    if (requirements.length === 1 && requirements[0] === 'EMAIL_OTP') {
        return 'The document title stays hidden until the invited account confirms the invited email address.';
    }

    if (requirements.length === 1 && requirements[0] === 'IDENTITY_VERIFICATION') {
        return 'The document title stays hidden until the invited account completes identity verification.';
    }

    return 'The document title stays hidden until the invited account completes the required verification steps below.';
}

// ─── Main component ───────────────────────────────────────────────────────────

/** Full invitation acceptance page — handles loading, gate, and review states. */
export function InvitationAcceptanceView({ token }: Props) {
    const router = useRouter();

    const [preview,       setPreview]       = useState<InvitationPreview | null>(null);
    const [review,        setReview]        = useState<InvitationReview | null>(null);
    const [gateStatus,    setGateStatus]    = useState<InvitationGateStatus | null>(null);
    const [acceptedState, setAcceptedState] = useState<{ documentId: string; acceptedAt: string } | null>(null);

    const [loadingPreview, setLoadingPreview] = useState(true);
    const [loadingGate,    setLoadingGate]    = useState(false);
    const [loadingReview,  setLoadingReview]  = useState(false);
    const [submitting,     setSubmitting]     = useState<'accept' | 'decline' | null>(null);

    const [pageError,   setPageError]   = useState<string | null>(null);
    const [gateError,   setGateError]   = useState<string | null>(null);
    const [reviewError, setReviewError] = useState<string | null>(null);

    const hasSession = useMemo(() => Boolean(getAccessToken()), []);

    // Load the public preview (no authentication required).
    useEffect(() => {
        let cancelled = false;
        setLoadingPreview(true);
        setPageError(null);

        getInvitationPreview(token)
            .then((data) => { if (!cancelled) setPreview(data); })
            .catch((err: unknown) => {
                if (!cancelled) setPageError(getApiMessage(err, 'This invitation is invalid, expired, or no longer available.'));
            })
            .finally(() => { if (!cancelled) setLoadingPreview(false); });

        return () => { cancelled = true; };
    }, [token]);

    // Load gate status once a session is present.
    useEffect(() => {
        if (!hasSession) { setGateStatus(null); setGateError(null); return; }
        let cancelled = false;
        setLoadingGate(true);

        getInvitationGateStatus(token)
            .then((data) => { if (!cancelled) setGateStatus(data); })
            .catch((err: unknown) => {
                if (!cancelled) setGateError(getApiMessage(err, 'Sign in with the invited verified account to continue.'));
            })
            .finally(() => { if (!cancelled) setLoadingGate(false); });

        return () => { cancelled = true; };
    }, [hasSession, token]);

    // Load full review once the gate allows it.
    useEffect(() => {
        if (!hasSession || gateStatus?.nextStep !== 'review') {
            setReview(null);
            if (gateStatus?.nextStep !== 'review') setLoadingReview(false);
            return;
        }
        let cancelled = false;
        setLoadingReview(true);

        getInvitationReview(token)
            .then((data) => { if (!cancelled) setReview(data); })
            .catch((err: unknown) => {
                if (!cancelled) setReviewError(getApiMessage(err, 'Unable to open the invitation review right now.'));
            })
            .finally(() => { if (!cancelled) setLoadingReview(false); });

        return () => { cancelled = true; };
    }, [gateStatus?.nextStep, hasSession, token]);

    // Redirect to the document after acceptance.
    useEffect(() => {
        if (!acceptedState) return;
        const id = window.setTimeout(
            () => { router.replace(`/documents/${acceptedState.documentId}/edit`); },
            1200,
        );
        return () => { window.clearTimeout(id); };
    }, [acceptedState, router]);

    async function handleAccept() {
        setSubmitting('accept');
        setReviewError(null);
        try {
            const res = await acceptInvitation(token);
            setAcceptedState({ documentId: res.document.id, acceptedAt: res.acceptedAt });
        } catch (err: unknown) {
            setReviewError(getApiMessage(err, 'Unable to accept this invitation right now.'));
        } finally {
            setSubmitting(null);
        }
    }

    async function handleDecline() {
        setSubmitting('decline');
        setReviewError(null);
        try {
            await declineInvitation(token);
            router.replace('/documents');
        } catch (err: unknown) {
            setReviewError(getApiMessage(err, 'Unable to decline this invitation right now.'));
        } finally {
            setSubmitting(null);
        }
    }

    const loginHref = `/login?next=${encodeURIComponent(`/invitations/${token}`)}`;

    return (
        <div style={{
            minHeight: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
        }}>
            {/* ── Branding mark ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: 'var(--color-primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 18,
                    boxShadow: '0 2px 14px var(--color-primary-glow)',
                }}>
                    G
                </div>
                <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', lineHeight: 1.1 }}>
                        Gracon 360
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
                        Documents
                    </div>
                </div>
            </div>

            {/* ── Main card ── */}
            <Card strength="strong" style={{ width: '100%', maxWidth: 600 }}>
                {/* Card header */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        borderRadius: 999, padding: '5px 12px', marginBottom: 14,
                        background: 'var(--color-primary-subtle)',
                        color: 'var(--color-primary)',
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
                    }}>
                        Invitation Review
                    </div>
                    <h1 style={{ margin: '0 0 8px', fontSize: 26, lineHeight: 1.2, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        You&apos;ve been invited to access a document
                    </h1>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
                        {getVerificationIntro(preview)}
                    </p>
                </div>

                {/* ── State-driven content ── */}
                {loadingPreview ? (
                    <LoadingRow message="Loading invitation…" />
                ) : pageError ? (
                    <AlertBanner variant="error">{pageError}</AlertBanner>
                ) : preview ? (
                    <>
                        <InvitationInfoCard preview={preview} />

                        <div style={{ height: 1, background: 'var(--color-border)', margin: '24px 0' }} />

                        {!hasSession ? (
                            /* Not signed in — prompt to log in */
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--color-text-secondary)', maxWidth: 340 }}>
                                    Sign in with the invited account to start verification
                                    and review this invitation.
                                </p>
                                <a href={loginHref} style={{ textDecoration: 'none', flexShrink: 0 }}>
                                    <Button>Sign in to continue</Button>
                                </a>
                            </div>
                        ) : (
                            /* Signed in — gate → verification → review */
                            loadingGate
                                ? <LoadingRow message="Checking invitation access…" />
                            : gateError
                                ? <AlertBanner variant="error">{gateError}</AlertBanner>
                            : gateStatus && gateStatus.nextStep !== 'review'
                                ? (
                                    <>
                                        {reviewError && (
                                            <>
                                                <AlertBanner variant="error">{reviewError}</AlertBanner>
                                                <div style={{ height: 16 }} />
                                            </>
                                        )}
                                        <InvitationVerificationPanel
                                            token={token}
                                            gateStatus={gateStatus}
                                            onStatusChange={(s) => { setGateStatus(s); setReview(null); setGateError(null); setReviewError(null); }}
                                            onError={setReviewError}
                                        />
                                    </>
                                )
                            : loadingReview
                                ? <LoadingRow message="Opening secure invitation review…" />
                            : review
                                ? (
                                    <InvitationReviewPanel
                                        review={review}
                                        acceptedState={acceptedState}
                                        submitting={submitting}
                                        reviewError={reviewError}
                                        onAccept={() => { void handleAccept(); }}
                                        onDecline={() => { void handleDecline(); }}
                                    />
                                )
                            : (
                                <AlertBanner variant="warning">
                                    {reviewError ?? 'Unable to open the invitation review right now.'}
                                </AlertBanner>
                            )
                        )}
                    </>
                ) : null}
            </Card>
        </div>
    );
}
