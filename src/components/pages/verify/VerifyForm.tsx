'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    verifyDocument,
    type VerifyDocumentResponse,
} from '@/api/documents.api';
import { Button, Card, Input } from '@/components/ui';
import { VerifySignerChain } from './VerifySignerChain';
import styles from './VerifyForm.module.css';

const DOCUMENT_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDateTime(value: string | undefined) {
    return value ? new Date(value).toLocaleString() : undefined;
}

function getPrimarySignerLabel(result: VerifyDocumentResponse) {
    return (result.signers?.length ?? 0) > 1 ? 'Primary seal by' : 'Signed by';
}

export function VerifyForm() {
    const searchParams = useSearchParams();
    const [documentId, setDocumentId] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<VerifyDocumentResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const lastAutoVerifiedIdRef = useRef<string | null>(null);

    async function runVerification(targetId: string) {
        setError(null);
        setResult(null);

        if (!DOCUMENT_ID_PATTERN.test(targetId)) {
            setError('Document ID must be a valid UUID.');
            return;
        }

        setLoading(true);

        try {
            const response = await verifyDocument(targetId);
            setResult(response);
        } catch (issue: unknown) {
            const message =
                (issue as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ??
                (issue instanceof Error
                    ? issue.message
                    : 'Verification request failed');
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    async function handleVerify() {
        const trimmedId = documentId.trim();
        await runVerification(trimmedId);
    }

    useEffect(() => {
        const presetId = searchParams.get('documentId')?.trim() ?? '';

        if (!presetId || !DOCUMENT_ID_PATTERN.test(presetId)) {
            return;
        }

        if (lastAutoVerifiedIdRef.current === presetId) {
            return;
        }

        lastAutoVerifiedIdRef.current = presetId;
        setDocumentId(presetId);
        void runVerification(presetId);
    }, [searchParams]);

    function reset() {
        setDocumentId('');
        setResult(null);
        setError(null);
        lastAutoVerifiedIdRef.current = null;
    }

    return (
        <Card strength="strong" padding="lg" className={styles.card}>
            <div className={styles.header}>
                <div className={styles.icon}>🔍</div>
                <h2 className={styles.title}>Verify a Document</h2>
                <p className={styles.description}>
                    Enter the document ID to confirm authenticity. No account
                    required.
                </p>
            </div>

            <div className={styles.field}>
                <Input
                    id="document-id"
                    label="Document ID"
                    value={documentId}
                    onChange={(event) => setDocumentId(event.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className={styles.documentId}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleVerify();
                        }
                    }}
                />
            </div>

            {error && (
                <div role="alert" className={styles.error}>
                    {error}
                </div>
            )}

            {result && (
                <div
                    className={`${styles.result} ${result.verified ? styles.successResult : styles.failureResult}`}
                >
                    <div
                        className={`${styles.resultHeader} ${result.verified ? styles.resultHeaderWithDetails : ''}`}
                    >
                        <span className={styles.resultIcon}>
                            {result.verified ? '✅' : '❌'}
                        </span>
                        <div>
                            <p
                                className={`${styles.resultTitle} ${result.verified ? styles.successText : styles.failureText}`}
                            >
                                {result.verified
                                    ? result.title
                                        ? `Document "${result.title}" is authentic`
                                        : 'Document is authentic'
                                    : 'Document could not be verified'}
                            </p>
                            {!result.verified && result.message && (
                                <p className={styles.resultMessage}>
                                    {result.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {result.verified && (
                        <div className={styles.details}>
                            {[
                                { label: 'Title', value: result.title },
                                {
                                    label: 'Verified signers',
                                    value: result.signers?.length
                                        ? `${result.signers.length}`
                                        : undefined,
                                },
                                {
                                    label: getPrimarySignerLabel(result),
                                    value: result.signedBy?.name,
                                },
                                {
                                    label: 'Signed at',
                                    value: formatDateTime(result.signedAt),
                                },
                                {
                                    label: 'Locked at',
                                    value: formatDateTime(result.lockedAt),
                                },
                            ]
                                .filter(
                                    (
                                        row,
                                    ): row is {
                                        label: string;
                                        value: string;
                                    } =>
                                        typeof row.value === 'string' &&
                                        row.value.length > 0,
                                )
                                .map(({ label, value }) => (
                                    <div
                                        key={label}
                                        className={styles.detailRow}
                                    >
                                        <span className={styles.detailLabel}>
                                            {label}
                                        </span>
                                        <span className={styles.detailValue}>
                                            {value}
                                        </span>
                                    </div>
                                ))}

                            {result.contentHash && (
                                <div className={styles.hash}>
                                    <p className={styles.hashLabel}>
                                        Content hash
                                    </p>
                                    <p className={styles.hashValue}>
                                        {result.contentHash}
                                    </p>
                                </div>
                            )}

                            {result.signers && result.signers.length > 0 && (
                                <VerifySignerChain signers={result.signers} />
                            )}
                        </div>
                    )}
                </div>
            )}

            {result ? (
                <Button type="button" variant="ghost" fullWidth onClick={reset}>
                    Verify Another Document
                </Button>
            ) : (
                <Button
                    type="button"
                    fullWidth
                    onClick={() => {
                        void handleVerify();
                    }}
                    loading={loading}
                    loadingText="Verifying…"
                >
                    Verify Document
                </Button>
            )}
        </Card>
    );
}
