/**
 * DocumentFinaliseDialog
 *
 * Lets the owner finalise a draft while explicitly deciding whether their own
 * signature should be required. Finalisation no longer implies owner signing.
 */
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import styles from './DocumentFinaliseDialog.module.css';

interface DocumentFinaliseDialogProps {
    acceptedSignerCount: number;
    ownerSignaturePrepared: boolean;
    open: boolean;
    onClose: () => void;
    onConfirm: (options: { requireOwnerSignature: boolean }) => Promise<void>;
}

/** Modal used to confirm finalisation and owner-signature requirement. */
export function DocumentFinaliseDialog({
    acceptedSignerCount,
    ownerSignaturePrepared,
    open,
    onClose,
    onConfirm,
}: DocumentFinaliseDialogProps) {
    const [requireOwnerSignature, setRequireOwnerSignature] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const canFinalise = requireOwnerSignature || acceptedSignerCount > 0;

    useEffect(() => {
        if (open) {
            setRequireOwnerSignature(ownerSignaturePrepared);
            setSubmitting(false);
            return;
        }

        if (!open) {
            setRequireOwnerSignature(false);
            setSubmitting(false);
        }
    }, [open, ownerSignaturePrepared]);

    if (!open) {
        return null;
    }

    async function handleConfirm() {
        if (!canFinalise || submitting) {
            return;
        }

        setSubmitting(true);
        try {
            await onConfirm({ requireOwnerSignature });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="docs-finalise-dialog-title"
        >
            <div className={styles.dialog}>
                <div>
                    <p className={styles.eyebrow}>Finalise document</p>
                    <h2
                        id="docs-finalise-dialog-title"
                        className={styles.title}
                    >
                        Freeze content and choose required signers
                    </h2>
                    <p className={styles.copy}>
                        Finalising stops further editing. Only explicitly required signers will be asked to sign.
                    </p>
                </div>

                <div className={styles.summary}>
                    <div className={styles.summaryItem}>
                        <span>Accepted invited signers</span>
                        <strong>{acceptedSignerCount}</strong>
                    </div>
                    <div className={styles.summaryItem}>
                        <span>Owner signature required</span>
                        <strong>{requireOwnerSignature ? 'Yes' : 'No'}</strong>
                    </div>
                </div>

                <label className={styles.toggle}>
                    <input
                        type="checkbox"
                        checked={requireOwnerSignature}
                        onChange={(event) => setRequireOwnerSignature(event.target.checked)}
                        disabled={submitting || ownerSignaturePrepared}
                    />
                    <span>
                        <strong>Require my signature before completion</strong>
                        <small>
                            {ownerSignaturePrepared
                                ? 'Turn this off only if you remove your prepared signature block first.'
                                : 'Leave this off if only invited signers should sign and you will only lock later.'}
                        </small>
                    </span>
                </label>

                {!canFinalise ? (
                    <p className={styles.warning}>
                        Add at least one accepted signer with signing access or require your own signature before finalising.
                    </p>
                ) : null}

                <div className={styles.actions}>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleConfirm()}
                        disabled={!canFinalise || submitting}
                    >
                        {submitting ? 'Finalising…' : 'Finalise document'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
