/** Public document-integrity verification route. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyForm } from '@/components/pages/verify';
import styles from './VerifyPage.module.css';

export const metadata: Metadata = {
    title: 'Verify Document',
    description:
        'Check the authenticity and signer evidence of a digitally signed Gracon document.',
    alternates: { canonical: '/verify' },
    robots: { index: true, follow: true },
};

/** Renders public cryptographic document verification without private metadata. */
export default function VerifyPage() {
    return (
        <div className={styles.page}>
            <div className={styles.brand}>
                <div className={styles.brandRow}>
                    <div className={styles.brandMark}>G</div>
                    <span className={styles.brandName}>Gracon 360</span>
                </div>
                <p className={styles.tagline}>
                    Digital Trust Infrastructure Platform
                </p>
            </div>

            <Suspense fallback={null}>
                <VerifyForm />
            </Suspense>

            <p className={styles.assurance}>
                Verification checks the document&apos;s cryptographic evidence
                against its recorded signing chain. A valid result confirms the
                integrity of that evidence, not the truth of the document&apos;s claims.
            </p>
        </div>
    );
}
