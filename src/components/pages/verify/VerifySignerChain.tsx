'use client';

import styles from './VerifySignerChain.module.css';

type VerifySigner = {
    name: string;
    email: string;
    signedAt: string;
    isOwner: boolean;
    signingOrder: number;
};

interface VerifySignerChainProps {
    signers: VerifySigner[];
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString();
}

/** Renders the immutable signing order returned by the verification endpoint. */
export function VerifySignerChain({ signers }: VerifySignerChainProps) {
    if (signers.length === 0) {
        return null;
    }

    return (
        <div className={styles.chain}>
            <div>
                <p className={styles.heading}>Verified signing chain</p>
                <p className={styles.summary}>
                    {signers.length} completed signature
                    {signers.length === 1 ? '' : 's'} verified in recorded order
                </p>
            </div>

            {signers.map((signer) => (
                <div
                    key={`${signer.signingOrder}-${signer.email}`}
                    className={styles.signer}
                >
                    <div className={styles.signerHeader}>
                        <div className={styles.identity}>
                            <span className={styles.order}>
                                {signer.signingOrder}
                            </span>
                            <span className={styles.name}>{signer.name}</span>
                            {signer.isOwner && (
                                <span className={styles.owner}>Owner</span>
                            )}
                        </div>

                        <span className={styles.date}>
                            {formatDateTime(signer.signedAt)}
                        </span>
                    </div>

                    <div className={styles.email}>{signer.email}</div>
                </div>
            ))}
        </div>
    );
}
