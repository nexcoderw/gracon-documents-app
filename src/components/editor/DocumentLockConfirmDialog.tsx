/**
 * Confirmation dialog for permanently locking a fully signed document.
 */
'use client';

import { Button } from '@/components/ui';
import styles from './DocumentLockConfirmDialog.module.css';

interface DocumentLockConfirmDialogProps {
    open: boolean;
    submitting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Shows the irreversible lock warning before the owner locks the document. */
export function DocumentLockConfirmDialog({
    open,
    submitting,
    onCancel,
    onConfirm,
}: DocumentLockConfirmDialogProps) {
    if (!open) return null;

    return (
        <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="docs-lock-dialog-title"
        >
            <div className={styles.dialog}>
                <div>
                    <p className={styles.eyebrow}>Lock document</p>
                    <h2 id="docs-lock-dialog-title" className={styles.title}>
                        Permanently lock this signed document?
                    </h2>
                    <p className={styles.copy}>
                        After locking, the document becomes immutable. The verification QR code will be attached for authenticity checks.
                    </p>
                </div>

                <p className={styles.warning}>
                    This action should only be done after you have reviewed the signed content and confirmed all required signatures are complete.
                </p>

                <div className={styles.actions}>
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={submitting}
                    >
                        {submitting ? 'Locking…' : 'Yes, lock document'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
