'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SignatureBlockSigner } from '@/lib/editor-signature-blocks';
import { Button } from '@/components/ui';
import styles from './SignatureBlockPreparationDialog.module.css';

interface SignatureBlockPreparationDialogProps {
    open: boolean;
    signers: SignatureBlockSigner[];
    existingSignerOrder: string[];
    onClose: () => void;
    onConfirm: (signers: SignatureBlockSigner[]) => void;
}

function move<T>(items: T[], fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= items.length) return items;

    const next = [...items];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
}

function getSignerKey(signer: SignatureBlockSigner) {
    return signer.userId || signer.accessId;
}

function sortSignersByExistingOrder(
    signers: SignatureBlockSigner[],
    existingSignerOrder: string[],
) {
    if (existingSignerOrder.length === 0) return signers;

    const order = new Map(existingSignerOrder.map((userId, index) => [userId, index]));
    return [...signers].sort((first, second) => {
        const firstOrder = order.get(first.userId) ?? Number.MAX_SAFE_INTEGER;
        const secondOrder = order.get(second.userId) ?? Number.MAX_SAFE_INTEGER;

        if (firstOrder !== secondOrder) return firstOrder - secondOrder;
        return signers.indexOf(first) - signers.indexOf(second);
    });
}

export function SignatureBlockPreparationDialog({
    open,
    signers,
    existingSignerOrder,
    onClose,
    onConfirm,
}: SignatureBlockPreparationDialogProps) {
    const [orderedSigners, setOrderedSigners] = useState<SignatureBlockSigner[]>([]);
    const [includeOwner, setIncludeOwner] = useState(false);
    const ownerSigner = useMemo(
        () => signers.find((signer) => signer.isOwner) ?? null,
        [signers],
    );
    const invitedSignerCount = signers.filter((signer) => !signer.isOwner).length;
    const preparedOwnerBlockExists = Boolean(
        ownerSigner && existingSignerOrder.includes(ownerSigner.userId),
    );
    const selectedSigners = orderedSigners.filter((signer) => (
        !signer.isOwner || includeOwner
    ));
    const canConfirm = selectedSigners.length > 0;

    function moveSigner(signer: SignatureBlockSigner, direction: -1 | 1) {
        setOrderedSigners((current) => {
            const fromIndex = current.findIndex((item) => getSignerKey(item) === getSignerKey(signer));
            return move(current, fromIndex, fromIndex + direction);
        });
    }

    useEffect(() => {
        if (!open) return;

        const ordered = sortSignersByExistingOrder(signers, existingSignerOrder);
        const ownerWasPrepared = Boolean(
            ownerSigner && existingSignerOrder.includes(ownerSigner.userId),
        );
        const shouldIncludeOwner = ownerWasPrepared || invitedSignerCount === 0;

        // Opening the dialog rebuilds its draft from authoritative signer props.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOrderedSigners(ordered);
        setIncludeOwner(shouldIncludeOwner);
    }, [existingSignerOrder, invitedSignerCount, open, ownerSigner, signers]);

    if (!open) return null;

    return (
        <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signature-block-dialog-title"
        >
            <div className={styles.dialog}>
                <div className={styles.header}>
                    <p className={styles.eyebrow}>Signature blocks</p>
                    <h2 id="signature-block-dialog-title">
                        Choose signer blocks and their order
                    </h2>
                    <p>
                        Blocks are placed one below another in this order. Invited users with signing access stay assigned to their own block.
                    </p>
                </div>

                {ownerSigner ? (
                    <label className={styles.owner}>
                        <span>
                            <strong>Add my signature block</strong>
                            <small>
                                {preparedOwnerBlockExists
                                    ? 'Your block is already prepared and will remain in the stack.'
                                    : 'Use this when you will also sign before locking the document.'}
                            </small>
                        </span>
                        <input
                            type="checkbox"
                            role="switch"
                            checked={includeOwner}
                            onChange={(event) => setIncludeOwner(event.target.checked)}
                        />
                    </label>
                ) : null}

                <div className={styles.list} aria-label="Signature block order">
                    {selectedSigners.map((signer, index) => (
                        <div
                            key={getSignerKey(signer)}
                            className={styles.row}
                        >
                            <span className={styles.handle} aria-hidden="true">
                                {index + 1}
                            </span>
                            <span className={styles.person}>
                                <strong>{signer.displayName}</strong>
                                <small>{signer.isOwner ? 'Document owner' : signer.email}</small>
                            </span>
                            <span className={styles.assignment}>
                                {signer.isOwner ? 'Owner signature' : 'Required signer'}
                            </span>
                            <div className={styles.moves}>
                                <button
                                    type="button"
                                    className={styles.moveButton}
                                    onClick={() => moveSigner(signer, -1)}
                                    disabled={index === 0}
                                >
                                    Up
                                </button>
                                <button
                                    type="button"
                                    className={styles.moveButton}
                                    onClick={() => moveSigner(signer, 1)}
                                    disabled={index === selectedSigners.length - 1}
                                >
                                    Down
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {!canConfirm ? (
                    <p className={styles.warning}>
                        Add your signature block or invite at least one signer before preparing blocks.
                    </p>
                ) : null}

                <div className={styles.actions}>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={!canConfirm}
                        onClick={() => onConfirm(selectedSigners)}
                    >
                        Prepare {selectedSigners.length} block{selectedSigners.length === 1 ? '' : 's'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
