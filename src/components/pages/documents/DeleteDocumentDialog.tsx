/**
 * DeleteDocumentDialog
 *
 * Confirmation dialog shown before permanently deleting a document.
 * Closes on Escape or backdrop click. Confirm button enters a loading
 * state while the delete request is in flight.
 */
'use client';

import { useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete04Icon } from '@hugeicons/core-free-icons';
import styles from './DeleteDocumentDialog.module.css';

interface DeleteDocumentDialogProps {
    docTitle: string;
    deleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Renders a centered confirmation dialog with a blurred backdrop.
 * The cancel button is auto-focused — safe default for destructive actions.
 */
export function DeleteDocumentDialog({
    docTitle,
    deleting,
    onConfirm,
    onCancel,
}: DeleteDocumentDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);

    // Auto-focus cancel on open — the safe default for destructive dialogs.
    useEffect(() => {
        cancelRef.current?.focus();
    }, []);

    // Close on Escape unless a delete is already in flight.
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape' && !deleting) onCancel();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [deleting, onCancel]);

    return (
        <div
            className={styles.backdrop}
            onClick={(e) => { if (e.target === e.currentTarget && !deleting) onCancel(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
        >
            <div className={styles.dialog}>
                {/* Top accent stripe */}
                <div className={styles.stripe} aria-hidden="true" />

                {/* Icon */}
                <div className={styles.iconWrap} aria-hidden="true">
                    <HugeiconsIcon icon={Delete04Icon} size={24} color="currentColor" />
                </div>

                {/* Copy */}
                <h2 id="delete-dialog-title" className={styles.title}>
                    Delete this document?
                </h2>
                <p className={styles.documentName} title={docTitle}>
                    {docTitle}
                </p>
                <p className={styles.warning}>
                    This will permanently remove the document and cannot be undone.
                </p>

                {/* Divider */}
                <div className={styles.divider} aria-hidden="true" />

                {/* Actions */}
                <div className={styles.actions}>
                    <button
                        type="button"
                        ref={cancelRef}
                        onClick={onCancel}
                        disabled={deleting}
                        className={`${styles.action} ${styles.cancel}`}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={deleting}
                        className={`${styles.action} ${styles.confirm}`}
                    >
                        {deleting ? (
                            <>
                                <span className={styles.spinner} aria-hidden="true" />
                                Deleting…
                            </>
                        ) : (
                            <>
                                <HugeiconsIcon icon={Delete04Icon} size={14} color="currentColor" />
                                Delete
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
