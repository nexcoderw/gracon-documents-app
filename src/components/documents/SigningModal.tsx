/**
 * Modal that signs a finalised document hash and records the user's signature.
 *
 * The signing submit uses a local BFF route so the browser does not coordinate
 * separate signature-service and document-service calls.
 */
'use client';

import { useState } from 'react';
import { Button, Card, toast } from '@/components/ui';
import { signDocumentInOneStep, type DocumentDetail } from '@/api/documents.api';
import { DocumentLoadingState } from '@/components/editor/DocumentLoadingState';
import styles from './SigningModal.module.css';

interface SigningModalProps {
    document: DocumentDetail;
    onClose: () => void;
    onSigned: (updated: Partial<DocumentDetail>) => void;
}

type Step = 'review' | 'signing' | 'done';

export function SigningModal({ document: doc, onClose, onSigned }: SigningModalProps) {
    const [step, setStep] = useState<Step>('review');
    const [signatureBytes, setSignatureBytes] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    async function handleSign() {
        if (!doc.contentHash) { toast.error('Document has no content hash. Finalise it first.'); return; }

        setStep('signing');
        setLoading(true);
        try {
            const signed = await signDocumentInOneStep(doc.id, doc.contentHash, doc.title);
            setSignatureBytes(signed.signatureBytes ?? '');
            onSigned(signed);
            setStep('done');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Signing failed. Ensure your certificate is active in the Profile app.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    function copyHash() {
        if (doc.contentHash) { navigator.clipboard.writeText(doc.contentHash); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    }

    return (
        <div className={styles.backdrop}
            onClick={e => { if (e.target === e.currentTarget && step !== 'signing') onClose(); }}
        >
            <Card strength="strong" padding="lg" className={styles.panel}>

                {step === 'review' && (
                    <>
                        <h2 className={styles.title}>
                            {doc.status === 'FINALISED' ? 'Sign Document' : 'Document Already Locked'}
                        </h2>
                        <p className={styles.copy}>
                            {doc.status === 'FINALISED'
                                ? 'By signing, you confirm this document is accurate and complete. Your signature will be recorded against the frozen document.'
                                : 'This document has already been signed and locked.'}
                        </p>

                        {/* Document hash */}
                        <div className={styles.hashSection}>
                            <p className={styles.label}>
                                Document SHA-256 Hash
                            </p>
                            <div className={styles.hashWrap}>
                                <div className={styles.hash}>
                                    {doc.contentHash}
                                </div>
                                <button type="button" onClick={copyHash} className={`${styles.copyButton} ${copied ? styles.copyButtonDone : ''}`}>
                                    {copied ? '✓ Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className={styles.hint}>
                                This is the unique fingerprint of your document. Any change to the content would produce a completely different hash.
                            </p>
                        </div>

                        {doc.status === 'FINALISED' && (
                            <div className={styles.actions}>
                                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                                <Button onClick={() => { void handleSign(); }} disabled={loading}>
                                    Sign with My Certificate
                                </Button>
                            </div>
                        )}

                        {doc.status === 'LOCKED' && (
                            <Button fullWidth onClick={onClose}>Close</Button>
                        )}
                    </>
                )}

                {step === 'signing' && (
                    <div className={styles.signing}>
                        <DocumentLoadingState
                            variant="panel"
                            size={56}
                            minHeight="120px"
                            message="Signing document..."
                            detail="Do not close this window"
                        />
                        <p className={styles.signingCopy}>Your private key is being used to sign the document hash. Do not close this window.</p>
                    </div>
                )}

                {step === 'done' && (
                    <>
                        <div className={styles.doneHeader}>
                            <div className={styles.doneIcon}>🔐</div>
                            <h2 className={styles.title}>Signature Recorded</h2>
                            <p className={styles.copy}>
                                Your document has been cryptographically signed. The owner can lock it once all required signatures are complete.
                            </p>
                        </div>

                        {signatureBytes && (
                            <div className={styles.signatureSection}>
                                <p className={styles.label}>Signature Bytes (base64)</p>
                                <div className={styles.signature}>
                                    {signatureBytes}
                                </div>
                            </div>
                        )}

                        <Button fullWidth onClick={onClose}>
                            Done
                        </Button>
                    </>
                )}
            </Card>
        </div>
    );
}
