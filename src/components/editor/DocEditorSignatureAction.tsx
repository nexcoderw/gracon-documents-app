/**
 * Signing CTA for the document editor header.
 *
 * Finalisation and signing are separate controls. Finalisation is owner-only,
 * while signing uses one readiness state from the documents signing flow.
 */
'use client';

import { Button } from '@/components/ui';

export type SigningActionStatus =
    | 'checking'
    | 'ready'
    | 'needs_certificate'
    | 'needs_identity_verification'
    | 'blocked'
    | 'not-required';

interface DocEditorSignatureActionProps {
    signingStatus: SigningActionStatus;
    canFinalise: boolean;
    canLock: boolean;
    canSign: boolean;
    onApplyForDigitalSignature: () => void;
    onCompleteIdentityVerification: () => void;
    onFinalise: () => void;
    onLock: () => void;
    onSign: () => void;
}

/** Renders the correct signing-related action for owners and invited signers. */
export function DocEditorSignatureAction({
    signingStatus,
    canFinalise,
    canLock,
    canSign,
    onApplyForDigitalSignature,
    onCompleteIdentityVerification,
    onFinalise,
    onLock,
    onSign,
}: DocEditorSignatureActionProps) {
    if (canFinalise) {
        return (
            <Button size="sm" onClick={onFinalise}>
                Finalise document
            </Button>
        );
    }

    if (canLock) {
        return (
            <Button size="sm" onClick={onLock}>
                Lock document
            </Button>
        );
    }

    if (!canSign) {
        return null;
    }

    if (signingStatus === 'checking') {
        return (
            <Button variant="ghost" size="sm" disabled loading loadingText="Checking signing…">
                Checking signing…
            </Button>
        );
    }

    if (signingStatus === 'needs_identity_verification') {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={onCompleteIdentityVerification}
                title="Complete identity verification in the main app"
            >
                Verify identity
            </Button>
        );
    }

    if (signingStatus === 'needs_certificate') {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={onApplyForDigitalSignature}
                title="Open your digital signature setup in the main app"
            >
                Set up signature
            </Button>
        );
    }

    if (signingStatus !== 'ready') {
        return (
            <Button variant="ghost" size="sm" disabled>
                Signing unavailable
            </Button>
        );
    }

    return (
        <Button size="sm" onClick={onSign}>
            Sign document
        </Button>
    );
}
